# Talk to Margo: chat proxy

A small Cloudflare Worker that lets visitors of the Offquarium site chat with
Margo. The site is static (GitHub Pages) and cannot keep an API key secret,
so the browser talks to this Worker, and the Worker talks to the Claude API.

What it does:

- Keeps the Anthropic API key secret (a Worker secret, never in the site).
- Adds Margo's persona as the system prompt (`src/persona.js`).
- Accepts requests only from the origins in `ALLOWED_ORIGINS`.
- Limits message size and conversation length, and rate-limits each visitor
  (best effort; see "Protecting your bill" below).
- Model: Claude Opus 5.5 at low effort, with server-side fallback if a
  request is declined by a safety classifier.

## Deploy

You need a Cloudflare account and an Anthropic API key.

```sh
cd worker/margo
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when asked
npx wrangler deploy
```

`wrangler deploy` prints the Worker's address, for example
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
requests per minute per IP), and set a monthly spend limit for the API key
in the Claude Console.

## Develop and test

```sh
npm install
npm test          # unit tests with a fake API, no key needed
npx wrangler dev  # local Worker; put ANTHROPIC_API_KEY=... in .dev.vars
```
