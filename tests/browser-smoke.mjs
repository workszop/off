// Browser smoke test for the 3D office (index.html): real headless Chrome
// with software WebGL, driven over the DevTools protocol. No packages needed.

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = new URL('../', import.meta.url).pathname;
const MIME = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const missingRequests = [];
const server = createServer((request, response) => {
  const rawPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relativePath = rawPath === '/' ? 'index.html' : rawPath.slice(1);
  const filePath = normalize(join(ROOT, relativePath));
  if (!filePath.startsWith(ROOT) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    missingRequests.push(rawPath);
    response.writeHead(404).end('Not found');
    return;
  }
  response.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
  response.end(readFileSync(filePath));
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const appPort = server.address().port;

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  return candidates.find(command =>
    spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0
  );
}

const chromeBin = findChrome();
assert.ok(chromeBin, 'Chrome or Chromium is required for the browser smoke test');
const debugPort = await freePort();
const profilePath = join(tmpdir(), `offquarium-smoke-${process.pid}`);
const chrome = spawn(chromeBin, [
  '--headless=new',
  '--no-sandbox',
  // Software WebGL, so the 3D office renders without a GPU.
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--disable-extensions',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profilePath}`,
  '--window-size=1440,900',
  // Fixed seed and phase: the simulation is repeatable and chatty.
  `http://127.0.0.1:${appPort}/?seed=7&phase=midday`,
], { stdio: ['ignore', 'ignore', 'pipe'] });

let chromeError = '';
chrome.stderr.on('data', chunk => { chromeError += chunk; });

async function retry(fn, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { return await fn(); } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw lastError || new Error('Timed out');
}

const page = await retry(async () => {
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  const match = pages.find(candidate => candidate.url.startsWith(`http://127.0.0.1:${appPort}/`));
  if (!match) throw new Error('App target is not ready');
  return match;
});

class Cdp {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.socket = new WebSocket(url);
    this.socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        this.events.push(message);
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    };
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.onopen = resolve;
      this.socket.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

const cdp = new Cdp(page.webSocketDebuggerUrl);
await cdp.open();

try {
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.reload', { ignoreCache: true });

  await retry(async () => {
    if (!(await cdp.evaluate('Boolean(window.__office?.ready)'))) throw new Error('Office not ready');
  }, 60000);

  const desktop = await cdp.evaluate(`(async () => {
    const office = window.__office;
    const cast = office.cast.map(c => c.type);
    // Run the simulation forward until someone speaks (about 20 s of office time).
    let speaker = null;
    for (let i = 0; i < 15 && !speaker; i++) {
      office.step(2, 8);
      speaker = office.cast.find(c => !c.bubble.hidden)?.type ?? null;
    }
    const nameTags = document.querySelectorAll('.label').length;
    // The ghost only visits: out of the room at the start, in it after a haunt.
    const ghost = office.cast.find(c => c.type === 'ghost');
    const ghostAwayAtStart = !ghost.present && !ghost.standee.root.visible;
    office.haunt();
    office.step(3, 8);
    const ghostHaunts = ghost.present && ghost.standee.root.visible;

    // Talk to Margo with no endpoint configured: she answers offline, in character.
    document.getElementById('talkMargo').click();
    const panelOpened = !document.getElementById('margoChat').hidden;
    document.getElementById('margoInput').value = 'Hello Margo';
    document.getElementById('margoForm').requestSubmit();
    await new Promise(resolve => setTimeout(resolve, 1200));
    const margo = office.cast.find(c => c.type === 'margo');
    const replies = [...document.querySelectorAll('.margo-msg--margo')].map(li => li.textContent);
    const visitorMessages = document.querySelectorAll('.margo-msg--you').length;
    const facingVisitor = margo.talkingToVisitor === true;
    document.getElementById('margoChat').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return {
      cast, speaker, nameTags, ghostAwayAtStart, ghostHaunts, panelOpened, visitorMessages, facingVisitor,
      greeted: replies.length >= 1,
      offlineReply: MARGO_LINES.offline.includes(replies.at(-1)),
      closedAgain: document.getElementById('margoChat').hidden && !margo.talkingToVisitor,
    };
  })()`);

  assert.deepEqual(desktop.cast, ['andy', 'jazz', 'olex', 'ghost', 'margo']);
  assert.ok(desktop.speaker, 'Someone should speak within ~20 s of office time');
  assert.equal(desktop.nameTags, 0, 'Names appear only inside speech bubbles');
  assert.ok(desktop.ghostAwayAtStart, 'The ghost is not in the room when the office opens');
  assert.ok(desktop.ghostHaunts, 'The ghost materialises for a haunt');
  assert.equal(desktop.panelOpened, true);
  assert.equal(desktop.greeted, true);
  assert.equal(desktop.visitorMessages, 1);
  assert.equal(desktop.offlineReply, true, 'Without an endpoint Margo gives an offline line');
  assert.equal(desktop.facingVisitor, true, 'Margo stops and faces the visitor while chatting');
  assert.equal(desktop.closedAgain, true, 'Escape closes the chat and releases Margo');

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  const mobile = await cdp.evaluate(`(() => {
    document.getElementById('talkMargo').click();
    const button = document.getElementById('talkMargo').getBoundingClientRect();
    const panel = document.getElementById('margoChat').getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      buttonOnScreen: button.right <= innerWidth && button.bottom <= innerHeight && button.width > 0,
      panelFits: panel.left >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight,
    };
  })()`);
  assert.deepEqual(mobile.viewport, [390, 844]);
  assert.equal(mobile.horizontalOverflow, false);
  assert.equal(mobile.buttonOnScreen, true);
  assert.equal(mobile.panelFits, true);

  const runtimeErrors = cdp.events.filter(event =>
    event.method === 'Runtime.exceptionThrown'
    || (event.method === 'Log.entryAdded' && event.params.entry.level === 'error')
    || (event.method === 'Network.loadingFailed'
      && !(event.params.canceled
        && event.params.type === 'Document'
        && event.params.errorText === 'net::ERR_ABORTED'))
  );
  assert.deepEqual(missingRequests, [], `Missing HTTP resources: ${missingRequests.join(', ')}`);
  assert.deepEqual(runtimeErrors, [], `Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);

  console.log(JSON.stringify({ desktop, mobile }, null, 2));
} finally {
  cdp.close();
  chrome.kill('SIGTERM');
  await new Promise(resolve => {
    if (chrome.exitCode !== null) { resolve(); return; }
    const timeout = setTimeout(() => { chrome.kill('SIGKILL'); resolve(); }, 1500);
    chrome.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
  await new Promise(resolve => server.close(resolve));
  // Chrome's helper processes can still be flushing the profile after the
  // main process exits, so try a few times rather than fail the run on cleanup.
  for (let attempt = 0; attempt < 10; attempt++) {
    try { rmSync(profilePath, { recursive: true, force: true }); break; }
    catch (error) {
      if (attempt === 9) { console.warn(`Left temporary profile ${profilePath}: ${error.message}`); break; }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
}
