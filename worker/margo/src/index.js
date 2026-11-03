// ---- Talk to Margo: chat proxy ----
// A Cloudflare Worker between the static site (GitHub Pages) and the Claude
// API. It keeps the API key secret, adds Margo's persona, and limits what a
// visitor can send.
//
//   POST /chat   { "messages": [{ "role": "user", "content": "hi" }, ...] }
//   200          { "reply": "..." }
//
// Configuration (see README.md):
//   ANTHROPIC_API_KEY  secret  (wrangler secret put ANTHROPIC_API_KEY)
//   ALLOWED_ORIGINS    var     comma-separated site origins allowed to call

import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, DECLINE_LINE } from './persona.js';

const MODEL = 'claude-opus-5-5';
// Short chat replies: low effort keeps them quick and cheap. Thinking is
// always on for this model and counts toward max_tokens, which also caps
// the cost of one request on a public endpoint.
const EFFORT = 'low';
const MAX_TOKENS = 2048;

const MAX_MESSAGES = 16;        // conversation turns kept per request
const MAX_MESSAGE_CHARS = 600;
const MAX_TOTAL_CHARS = 6000;

// Best-effort per-visitor limit. Each Worker instance keeps its own counts,
// so pair this with a Cloudflare rate-limiting rule for real protection.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
const recent = new Map(); // ip -> timestamps

function rateLimited(ip, now = Date.now()) {
  const hits = (recent.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear(); // keep memory bounded
  return hits.length > RATE_MAX;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(origin ? corsHeaders(origin) : {}) },
  });
}

// Validate the visitor's conversation. Returns messages for the API or an error string.
export function validateMessages(body) {
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return 'messages must be a non-empty array';
  const trimmed = messages.slice(-MAX_MESSAGES);
  // The kept window must start with the visitor, as the API requires.
  while (trimmed.length && trimmed[0].role !== 'user') trimmed.shift();
  let total = 0;
  for (const [i, m] of trimmed.entries()) {
    if (m?.role !== (i % 2 === 0 ? 'user' : 'assistant')) return 'messages must alternate user/assistant, starting with user';
    if (typeof m.content !== 'string' || !m.content.trim()) return 'each message needs text content';
    if (m.content.length > MAX_MESSAGE_CHARS) return `messages are limited to ${MAX_MESSAGE_CHARS} characters`;
    total += m.content.length;
  }
  if (!trimmed.length || trimmed.at(-1).role !== 'user') return 'the last message must be from the user';
  if (total > MAX_TOTAL_CHARS) return 'conversation too long';
  return trimmed.map(m => ({ role: m.role, content: m.content.trim() }));
}

// Ask Claude for Margo's reply. Returns { reply } or throws an SDK error.
export async function askMargo(client, messages) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: EFFORT },
    // If a safety classifier declines, the API retries on a fallback model
    // chosen by refusal category, inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages,
  });
  if (response.stop_reason === 'refusal') return { reply: DECLINE_LINE };
  const reply = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();
  return { reply: reply || DECLINE_LINE };
}

export async function handleRequest(request, env, { client } = {}) {
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean);
  const origin = request.headers.get('Origin');
  const originOk = origin && allowed.includes(origin);

  if (request.method === 'OPTIONS') {
    return originOk ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 });
  }
  if (!originOk) return json({ error: 'origin not allowed' }, 403);
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.pathname !== '/chat') return json({ error: 'not found' }, 404, origin);

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (rateLimited(ip)) return json({ error: 'rate limited' }, 429, origin);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400, origin);
  }
  const messages = validateMessages(body);
  if (typeof messages === 'string') return json({ error: messages }, 400, origin);

  if (!env.ANTHROPIC_API_KEY && !client) return json({ error: 'chat is not configured' }, 503, origin);
  const anthropic = client ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  try {
    return json(await askMargo(anthropic, messages), 200, origin);
  } catch (error) {
    // Most specific first; details go to the Worker log, not the visitor.
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'busy' }, 429, origin);
    } else if (error instanceof Anthropic.APIConnectionError) {
      console.error('Claude API unreachable:', error.message);
      return json({ error: 'upstream unavailable' }, 502, origin);
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Claude API error ${error.status}:`, error.message);
      return json({ error: 'upstream error' }, 502, origin);
    }
    console.error('Unexpected error:', error);
    return json({ error: 'internal error' }, 500, origin);
  }
}

export default {
  fetch: (request, env) => handleRequest(request, env),
};
