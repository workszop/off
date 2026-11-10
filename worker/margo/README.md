# Talk to Margo: chat proxy

A small Cloudflare Worker that lets visitors of the Offquarium site chat with
Margo. The site is static (GitHub Pages) and cannot keep an API key secret,
so the browser talks to this Worker, and the Worker talks to OpenRouter.

What it does:

- Keeps the OpenRouter API key secret (a Worker secret, never in the site).
- Adds Margo's persona as the system prompt (`src/persona.js`).
- Accepts requests only from the origins in `ALLOWED_ORIGINS`.
- Limits message size and conversation length, and rate-limits each visitor
  (best effort; see "Protecting your bill" below).
- Model: DeepSeek V4.1 Flash (`deepseek/deepseek-v4.1-flash`) through
  OpenRouter, with low reasoning effort. To switch models, set `MODEL` in
  `wrangler.toml` to any OpenRouter model id and deploy again.

## Deploy

You need a Cloudflare account and an OpenRouter API key
(https://openrouter.ai/settings/keys).

```sh
cd worker/margo
npm install
npx wrangler login
npx wrangler deploy                          # first: uploads the code
npx wrangler secret put OPENROUTER_API_KEY   # then paste the key when asked
npx wrangler secret put CHAT_PASSWORD        # the password visitors type in the chat
```

Until both secrets are set the chat answers 503 (not configured). Every
request needs the password in the `X-Margo-Password` header; the chat panel
asks for it once and remembers it in the visitor's browser.

Keep this order: `secret put` on a Worker that does not exist yet creates an
empty placeholder that fails with error 1101. `wrangler deploy` prints the Worker's address, for example
`https://offquarium-margo.<your-subdomain>.workers.dev`.

Then point the site at it: in `index.html` at the repository root, set

```html
<meta name="margo-endpoint" content="https://offquarium-margo.<your-subdomain>.workers.dev/chat">
```

Until this is set, Talk to Margo still opens, and Margo explains (in
character) that her chat link is not connected.

If the site is served from a different address, add that origin to
`ALLOWED_ORIGINS` in `wrangler.toml` and deploy again.

## Protecting your bill

The endpoint is public. The Worker's built-in limit is per instance, so also
add a Cloudflare rate-limiting rule for the Worker's route (for example, 10
requests per minute per IP), and set a credit limit on the API key in the
OpenRouter key settings.

## Develop and test

```sh
npm install
npm test          # unit tests with a fake API, no key needed
npx wrangler dev  # local Worker; put OPENROUTER_API_KEY=... in .dev.vars
```

## Office context

The page sends an optional `context` string with each chat message: a short
note on the office right now (time of day, who is in, what just happened).
The Worker flattens it to one line, limits it to 600 characters and passes
it to the model as a second system message, after the persona, marked as
information rather than instructions. A Worker deployed before this was
added ignores the field, so the site keeps working; redeploy
(`npm run deploy`) for Margo to start using it.
