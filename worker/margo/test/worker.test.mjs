// Tests for the Talk to Margo proxy. The real SDK client is used with a fake
// fetch, so these check exactly what would be sent to the Claude API without
// calling it.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { handleRequest, validateMessages } from '../src/index.js';
import { SYSTEM_PROMPT, DECLINE_LINE } from '../src/persona.js';

const ORIGIN = 'https://workszop.github.io';
const env = { ALLOWED_ORIGINS: `${ORIGIN}, http://localhost:8000` };
let ipCounter = 0;

function chatRequest(body, { origin = ORIGIN, ip } = {}) {
  return new Request('https://margo.example.workers.dev/chat', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip ?? `10.0.0.${++ipCounter}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function fakeClient(respond) {
  const calls = [];
  const client = new Anthropic({
    apiKey: 'test-key',
    maxRetries: 0,
    fetch: async (url, init) => {
      calls.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) });
      return respond();
    },
  });
  return { client, calls };
}

const message = (content, stop_reason = 'end_turn') => new Response(JSON.stringify({
  id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
  content, stop_reason, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5 },
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('validateMessages accepts a normal conversation and trims whitespace', () => {
  assert.deepEqual(validateMessages({ messages: [{ role: 'user', content: '  hi  ' }] }), [{ role: 'user', content: 'hi' }]);
  const long = Array.from({ length: 31 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  const kept = validateMessages({ messages: long });
  assert.equal(kept[0].role, 'user', 'the kept window starts with the visitor');
  assert.equal(kept.at(-1).content, 'm30');
});

test('validateMessages rejects malformed or oversized input', () => {
  assert.equal(typeof validateMessages({}), 'string');
  assert.equal(typeof validateMessages({ messages: [{ role: 'assistant', content: 'x' }] }), 'string');
  assert.equal(typeof validateMessages({ messages: [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }] }), 'string');
  assert.equal(typeof validateMessages({ messages: [{ role: 'user', content: 'x'.repeat(601) }] }), 'string');
  assert.equal(typeof validateMessages({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }), 'string');
  assert.equal(typeof validateMessages({ messages: [{ role: 'user', content: 42 }] }), 'string');
});

test('CORS: allowed origins get a preflight answer, others are refused', async () => {
  const ok = await handleRequest(new Request('https://w/chat', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env);
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const denied = await handleRequest(new Request('https://w/chat', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(denied.status, 403);
  const post = await handleRequest(chatRequest({ messages: [{ role: 'user', content: 'hi' }] }, { origin: 'https://evil.example' }), env);
  assert.equal(post.status, 403);
});

test('sends Margo persona, model, effort and fallbacks; returns the text reply', async () => {
  const { client, calls } = fakeClient(() => message([
    { type: 'thinking', thinking: '', signature: 'sig' },
    { type: 'text', text: 'Enthusiasm at 14%. Answering anyway.' },
  ]));
  const res = await handleRequest(chatRequest({ messages: [{ role: 'user', content: 'Hello Margo' }] }), env, { client });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.deepEqual(await res.json(), { reply: 'Enthusiasm at 14%. Answering anyway.' });

  assert.equal(calls.length, 1);
  const { url, headers, body } = calls[0];
  assert.match(url, /\/v1\/messages/);
  assert.match(headers.get('authorization') ?? '', /test-key/, 'the API key is sent');
  assert.match(headers.get('anthropic-beta') ?? '', /server-side-fallback-2026-07-01/);
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.fallbacks, 'default');
  assert.deepEqual(body.output_config, { effort: 'low' });
  assert.equal(body.system[0].text, SYSTEM_PROMPT);
  assert.deepEqual(body.system[0].cache_control, { type: 'ephemeral' });
  assert.deepEqual(body.messages, [{ role: 'user', content: 'Hello Margo' }]);
  assert.equal(body.betas, undefined, 'betas travel as a header, not in the body');
});

test('a refusal becomes a polite in-character decline', async () => {
  const { client } = fakeClient(() => message([], 'refusal'));
  const res = await handleRequest(chatRequest({ messages: [{ role: 'user', content: 'something odd' }] }), env, { client });
  assert.deepEqual(await res.json(), { reply: DECLINE_LINE });
});

test('upstream rate limits and errors map to safe statuses', async () => {
  const limited = fakeClient(() => new Response(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }), { status: 429, headers: { 'Content-Type': 'application/json' } }));
  const r1 = await handleRequest(chatRequest({ messages: [{ role: 'user', content: 'hi' }] }), env, { client: limited.client });
  assert.equal(r1.status, 429);
  assert.deepEqual(await r1.json(), { error: 'busy' });

  const broken = fakeClient(() => new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'boom' } }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
  const r2 = await handleRequest(chatRequest({ messages: [{ role: 'user', content: 'hi' }] }), env, { client: broken.client });
  assert.equal(r2.status, 502);
});

test('missing key reports the chat as not configured', async () => {
  const res = await handleRequest(chatRequest({ messages: [{ role: 'user', content: 'hi' }] }), env);
  assert.equal(res.status, 503);
});

test('one visitor is rate limited after a burst', async () => {
  const { client } = fakeClient(() => message([{ type: 'text', text: 'ok' }]));
  const statuses = [];
  for (let i = 0; i < 10; i++) {
    const res = await handleRequest(chatRequest({ messages: [{ role: 'user', content: 'hi' }] }, { ip: '192.0.2.7' }), env, { client });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses.slice(0, 8), Array(8).fill(200));
  assert.equal(statuses[8], 429);
});
