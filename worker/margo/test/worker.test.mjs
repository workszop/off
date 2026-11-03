// Tests for the Talk to Margo proxy. A fake fetch stands in for OpenRouter,
// so these check exactly what would be sent without calling the API.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleRequest, validateMessages } from '../src/index.js';
import { SYSTEM_PROMPT, DECLINE_LINE } from '../src/persona.js';

const ORIGIN = 'https://workszop.github.io';
const env = { ALLOWED_ORIGINS: `${ORIGIN}, http://localhost:8000`, OPENROUTER_API_KEY: 'test-key' };
let ipCounter = 0;

function chatRequest(body, { origin = ORIGIN, ip } = {}) {
  return new Request('https://margo.example.workers.dev/chat', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip ?? `10.0.0.${++ipCounter}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function fakeFetch(respond) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) });
    return respond();
  };
  return { fetchFn, calls };
}

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const completion = (content, finish_reason = 'stop') => jsonResponse({
  id: 'gen-test', object: 'chat.completion', model: 'deepseek/deepseek-v4.1-flash',
  choices: [{ index: 0, finish_reason, message: { role: 'assistant', content } }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
});

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

test('sends Margo persona, model and reasoning settings; returns the text reply', async () => {
  const { fetchFn, calls } = fakeFetch(() => completion('Enthusiasm at 14%. Answering anyway.'));
  const res = await handleRequest(chatRequest({ messages: [{ role: 'user', content: 'Hello Margo' }] }), env, { fetchFn });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.deepEqual(await res.json(), { reply: 'Enthusiasm at 14%. Answering anyway.' });

  assert.equal(calls.length, 1);
  const { url, headers, body } = calls[0];
  assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(headers.get('authorization'), 'Bearer test-key', 'the API key is sent');
  assert.equal(headers.get('x-openrouter-title'), 'Offquarium');
  assert.equal(body.model, 'deepseek/deepseek-v4.1-flash');
  assert.deepEqual(body.reasoning, { effort: 'low', exclude: true });
  assert.equal(body.max_tokens, 2048);
  assert.deepEqual(body.messages, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: 'Hello Margo' },
  ]);
});

test('the MODEL var overrides the default model', async () => {
  const { fetchFn, calls } = fakeFetch(() => completion('ok'));
  await handleRequest(chatRequest({ messages: [{ role: 'user', content: 'hi' }] }), { ...env, MODEL: 'deepseek/deepseek-v4-flash' }, { fetchFn });
  assert.equal(calls[0].body.model, 'deepseek/deepseek-v4-flash');
});

test('a content filter stop or empty reply becomes a polite in-character decline', async () => {
  for (const respond of [() => completion(null, 'content_filter'), () => completion('')]) {
    const { fetchFn } = fakeFetch(respond);
    const res = await handleRequest(chatRequest({ messages: [{ role: 'user', content: 'something odd' }] }), env, { fetchFn });
    assert.deepEqual(await res.json(), { reply: DECLINE_LINE });
  }
});

test('upstream rate limits and errors map to safe statuses', async () => {
  const send = fetchFn => handleRequest(chatRequest({ messages: [{ role: 'user', content: 'hi' }] }), env, { fetchFn });
  const quiet = console.error;
  console.error = () => {};
  try {
    const r1 = await send(fakeFetch(() => jsonResponse({ error: { code: 429, message: 'slow down' } }, 429)).fetchFn);
    assert.equal(r1.status, 429);
    assert.deepEqual(await r1.json(), { error: 'busy' });

    const r2 = await send(fakeFetch(() => jsonResponse({ error: { code: 500, message: 'boom' } }, 500)).fetchFn);
    assert.equal(r2.status, 502);
    assert.deepEqual(await r2.json(), { error: 'upstream error' });

    const r3 = await send(fakeFetch(() => jsonResponse({ error: { code: 502, message: 'provider down' } })).fetchFn);
    assert.equal(r3.status, 502, 'an error inside a 200 body is still an error');

    const r4 = await send(async () => { throw new TypeError('network down'); });
    assert.equal(r4.status, 502);
    assert.deepEqual(await r4.json(), { error: 'upstream unavailable' });
  } finally {
    console.error = quiet;
  }
});

test('missing key reports the chat as not configured', async () => {
  const res = await handleRequest(chatRequest({ messages: [{ role: 'user', content: 'hi' }] }), { ALLOWED_ORIGINS: ORIGIN });
  assert.equal(res.status, 503);
});

test('one visitor is rate limited after a burst', async () => {
  const { fetchFn } = fakeFetch(() => completion('ok'));
  const statuses = [];
  for (let i = 0; i < 10; i++) {
    const res = await handleRequest(chatRequest({ messages: [{ role: 'user', content: 'hi' }] }, { ip: '192.0.2.7' }), env, { fetchFn });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses.slice(0, 8), Array(8).fill(200));
  assert.equal(statuses[8], 429);
});
