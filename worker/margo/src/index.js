// ---- Talk to Margo: chat proxy ----
// A Cloudflare Worker between the static site (GitHub Pages) and the
// OpenRouter API. It keeps the API key secret, adds Margo's persona, and
// limits what a visitor can send.
//
//   POST /chat   { "messages": [{ "role": "user", "content": "hi" }, ...] }
//   200          { "reply": "..." }
//   POST /auth   checks the password only: 204, or 401 if it is wrong
//
// Both routes need the password in the X-Margo-Password header.
//
// Configuration (see README.md):
//   OPENROUTER_API_KEY  secret  (wrangler secret put OPENROUTER_API_KEY)
//   CHAT_PASSWORD       secret  (wrangler secret put CHAT_PASSWORD)
//   ALLOWED_ORIGINS     var     comma-separated site origins allowed to call
//   MODEL               var     optional OpenRouter model id override

import { SYSTEM_PROMPT, DECLINE_LINE } from './persona.js';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek/deepseek-v4.1-flash';
const APP_URL = 'https://workszop.github.io/off/';
const APP_TITLE = 'Offquarium';
// Short chat replies: low reasoning effort keeps them quick and cheap.
// Reasoning counts toward max_tokens, which also caps the cost of one
// request on a public endpoint.
const EFFORT = 'low';
const MAX_TOKENS = 2048;
const UPSTREAM_TIMEOUT_MS = 25_000;

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
    'Access-Control-Allow-Headers': 'Content-Type, X-Margo-Password',
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

// Compare SHA-256 digests in constant time, so neither the password's
// length nor its content leaks through response timing.
async function digest(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
export async function passwordMatches(given, expected) {
  const [a, b] = await Promise.all([digest(given ?? ''), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
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

export class UpstreamError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Ask the model for Margo's reply. Returns { reply } or throws UpstreamError
// (status 0 means the API could not be reached).
export async function askMargo(messages, { apiKey, model = DEFAULT_MODEL, fetchFn = fetch }) {
  let res;
  try {
    res = await fetchFn(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': APP_URL,
        'X-OpenRouter-Title': APP_TITLE,
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        reasoning: { effort: EFFORT, exclude: true },
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    throw new UpstreamError(0, error.message);
  }
  const data = await res.json().catch(() => null);
  // OpenRouter can also report an error inside a 200 body.
  if (!res.ok || data?.error) {
    throw new UpstreamError(data?.error?.code ?? res.status, data?.error?.message ?? `HTTP ${res.status}`);
  }
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'content_filter') return { reply: DECLINE_LINE };
  const reply = typeof choice?.message?.content === 'string' ? choice.message.content.trim() : '';
  return { reply: reply || DECLINE_LINE };
}

export async function handleRequest(request, env, { fetchFn } = {}) {
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean);
  const origin = request.headers.get('Origin');
  const originOk = origin && allowed.includes(origin);

  if (request.method === 'OPTIONS') {
    return originOk ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 });
  }
  if (!originOk) return json({ error: 'origin not allowed' }, 403);
  const url = new URL(request.url);
  if (request.method !== 'POST' || !['/chat', '/auth'].includes(url.pathname)) return json({ error: 'not found' }, 404, origin);

  // Rate limit before the password check, which also slows down guessing.
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (rateLimited(ip)) return json({ error: 'rate limited' }, 429, origin);

  if (!env.CHAT_PASSWORD || !env.OPENROUTER_API_KEY) return json({ error: 'chat is not configured' }, 503, origin);
  if (!(await passwordMatches(request.headers.get('X-Margo-Password'), env.CHAT_PASSWORD))) {
    return json({ error: 'password required' }, 401, origin);
  }
  if (url.pathname === '/auth') return new Response(null, { status: 204, headers: corsHeaders(origin) });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400, origin);
  }
  const messages = validateMessages(body);
  if (typeof messages === 'string') return json({ error: messages }, 400, origin);

  try {
    const reply = await askMargo(messages, { apiKey: env.OPENROUTER_API_KEY, model: env.MODEL || undefined, fetchFn });
    return json(reply, 200, origin);
  } catch (error) {
    // Details go to the Worker log, not the visitor.
    if (!(error instanceof UpstreamError)) {
      console.error('Unexpected error:', error);
      return json({ error: 'internal error' }, 500, origin);
    }
    if (error.status === 429) return json({ error: 'busy' }, 429, origin);
    console.error(error.status ? `OpenRouter error ${error.status}:` : 'OpenRouter unreachable:', error.message);
    return json({ error: error.status ? 'upstream error' : 'upstream unavailable' }, 502, origin);
  }
}

export default {
  fetch: (request, env) => handleRequest(request, env),
};
