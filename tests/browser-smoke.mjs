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
  '--disable-gpu',
  '--disable-extensions',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profilePath}`,
  '--window-size=1440,900',
  `http://127.0.0.1:${appPort}/classic.html`, // the 2D app
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
    const ready = await cdp.evaluate(
      "document.readyState === 'complete' && Boolean(window.__off) && state.chars.length === 4"
    );
    if (!ready) throw new Error('Application has not booted');
    return true;
  });

  const desktop = await cdp.evaluate(`(async () => {
    closeModal();
    await document.fonts.ready;
    await Promise.all([...document.images].map(image =>
      image.complete ? Promise.resolve() : new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      })
    ));

    const externalFonts = performance.getEntriesByType('resource')
      .map(entry => entry.name)
      .filter(name => /fonts\\.(googleapis|gstatic)\\.com/.test(name));

    const firstPiece = document.querySelector('.furniture');
    const hiddenDelete = firstPiece.querySelector('.furniture-delete-btn');
    const beforeGuard = furniturePieces.length;
    hiddenDelete.click();
    const guardedOutsideEdit = furniturePieces.length === beforeGuard;
    const hiddenControlState = {
      pointerEvents: getComputedStyle(hiddenDelete).pointerEvents,
      visibility: getComputedStyle(hiddenDelete).visibility,
      tabIndex: hiddenDelete.tabIndex,
    };

    document.getElementById('btnEditOffice').click();
    firstPiece.click();
    const selectedDelete = firstPiece.querySelector('.furniture-delete-btn');
    const enabledInsideEdit = getComputedStyle(selectedDelete).pointerEvents === 'auto'
      && selectedDelete.tabIndex === 0;
    selectedDelete.click();
    const deletedInsideEdit = furniturePieces.length === beforeGuard - 1;
    closeDrawer();
    await Promise.all([...document.images].map(image =>
      image.complete ? Promise.resolve() : new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      })
    ));

    document.getElementById('btnPlay').click();
    const paused = !state.isPlaying
      && document.body.dataset.playing === 'false'
      && canvas.dataset.playing === 'false';
    document.getElementById('btnPlay').click();
    const resumed = state.isPlaying && document.body.dataset.playing === 'true';

    window.__off.trigger('meeting');
    await new Promise(resolve => setTimeout(resolve, 250));
    const sceneStarted = state.activeScene && state.chars.some(c => c.targetX !== null);
    document.getElementById('btnReset').click();
    const resetClean = !state.activeScene
      && state.pendingTimers.size === 0
      && state.chars.every(c => c.targetX === null && !c.activity && !c.isChatting);
    await new Promise(resolve => setTimeout(resolve, 150));

    const gaitFrames = {};
    for (const c of state.chars.filter(character => character.type !== 'ghost')) {
      c.state = 'walking';
      c.vx = BASE_SPEED;
      c.vy = 0;
      c.facing = 'right';
      c.viewDirection = 'threequarter';
      c.movePhaseOffset = 0;
      gaitFrames[c.type] = [0, 0.25, 0.5, 0.75].map(phase => {
        c.gaitClock = stepCycleMs(c) * phase;
        updateCharSprite(c, 0);
        return c.lastSpriteSrc.split('/').pop();
      });
    }

    state.chars.forEach(c => { c.socialTimer = 999999; });
    state.socialPauseTimer = 999999;
    state.ambientTalkTimer = 0;
    await new Promise(resolve => setTimeout(resolve, 150));
    const ambientSpeaker = state.chars.find(c => c.bubbleEl)?.type || null;
    clearAllBubbles();

    return {
      characters: document.querySelectorAll('.character').length,
      furniture: furniturePieces.length,
      missingImages: [...document.images]
        .filter(image => !image.naturalWidth)
        .map(image => image.currentSrc || image.src),
      externalFonts,
      fontsReady: document.fonts.status,
      guardedOutsideEdit,
      hiddenControlState,
      enabledInsideEdit,
      deletedInsideEdit,
      paused,
      resumed,
      sceneStarted,
      resetClean,
      gaitFrames,
      ambientSpeaker,
      chatDefaults: {
        state: state.chatFreq,
        slider: Number(document.getElementById('chatSlider').value),
        label: document.getElementById('chatValue').textContent,
      },
      appContract: {
        playing: document.body.dataset.playing,
        scene: document.body.dataset.scene,
        drawer: document.body.dataset.drawer,
        editMode: document.body.dataset.editMode,
      },
    };
  })()`);

  assert.equal(desktop.characters, 4);
  assert.equal(desktop.missingImages.length, 0, `Missing images: ${desktop.missingImages.join(', ')}`);
  assert.equal(desktop.externalFonts.length, 0, 'The app must not request external fonts');
  assert.equal(desktop.fontsReady, 'loaded');
  assert.equal(desktop.guardedOutsideEdit, true);
  assert.deepEqual(desktop.hiddenControlState, {
    pointerEvents: 'none',
    visibility: 'hidden',
    tabIndex: -1,
  });
  assert.equal(desktop.enabledInsideEdit, true);
  assert.equal(desktop.deletedInsideEdit, true);
  assert.equal(desktop.paused, true);
  assert.equal(desktop.resumed, true);
  assert.equal(desktop.sceneStarted, true);
  assert.equal(desktop.resetClean, true);
  for (const [type, frames] of Object.entries(desktop.gaitFrames)) {
    assert.deepEqual(frames, [
      'threequarter_walk_01.webp',
      'threequarter_idle.webp',
      'threequarter_walk_03.webp',
      'threequarter_idle.webp',
    ], `${type} must alternate contact and passing poses`);
  }
  assert.ok(desktop.ambientSpeaker, 'An eligible character should make an ambient remark');
  assert.deepEqual(desktop.chatDefaults, { state: 70, slider: 70, label: 'Chatty' });
  assert.deepEqual(desktop.appContract, {
    playing: 'true',
    scene: 'idle',
    drawer: 'none',
    editMode: 'false',
  });

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await new Promise(resolve => setTimeout(resolve, 350));
  const mobile = await cdp.evaluate(`({
    viewport: [innerWidth, innerHeight],
    spriteH: SPRITE_H,
    furnitureScaled: furniturePieces.every(piece =>
      Math.abs(piece.pw - Math.round(piece.scale * SPRITE_H)) <= 1
      && piece.pw === piece.ph
    ),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  })`);
  assert.deepEqual(mobile.viewport, [390, 844]);
  assert.equal(mobile.furnitureScaled, true);
  assert.equal(mobile.horizontalOverflow, false);

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
  rmSync(profilePath, { recursive: true, force: true });
}
