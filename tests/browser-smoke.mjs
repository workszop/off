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
  // Serve the office with the chat endpoint blanked, so the test never calls
  // the live Margo Worker and checks the offline path deterministically.
  const body = relativePath === 'index.html'
    ? readFileSync(filePath, 'utf8').replace(/(<meta name="margo-endpoint" content=")[^"]*"/, '$1"')
    : readFileSync(filePath);
  response.end(body);
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

  const gait = await cdp.evaluate(`(async () => {
    const { createStandee } = await import('./src/characters3d/standee.js');
    const random = Math.random;
    let margo, jazz;
    try {
      Math.random = () => 0.5;
      margo = createStandee('margo');
      jazz = createStandee('jazz');
    } finally { Math.random = random; }
    await Promise.all([margo.load(), jazz.load()]); // idle drawings, then walk frames
    const camera = { position: { x: 0, z: 5 } };
    const snapshot = standee => {
      const card = standee.root.children[0].children[0];
      const art = card.children[0];
      const url = art.children[0].material.map.source.data?.src || '';
      return { frame: url.split('/').at(-1).split('?')[0], bob: card.position.y, wobble: card.rotation.z,
        view: standee.view, mirrored: standee.mirrored };
    };
    let matched = true;
    const frames = new Set(), views = new Set();
    for (const heading of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      margo.heading = jazz.heading = heading;
      for (let i = 0; i < 24; i++) {
        margo.update(i * 0.05, 0.05, 1, camera);
        jazz.update(i * 0.05, 0.05, 1, camera);
        const a = snapshot(margo), b = snapshot(jazz);
        matched &&= JSON.stringify(a) === JSON.stringify(b);
        frames.add(a.frame);
        views.add(a.view);
      }
    }
    for (let i = 0; i < 40; i++) margo.update(5 + i * 0.05, 0.05, 0, camera);
    return { matched, frames: [...frames], views: [...views], stopped: snapshot(margo).frame };
  })()`);
  assert.ok(gait.matched, 'Margo and Jazz must share frames, bob, wobble and directional flips');
  assert.equal(gait.views.length, 3);
  assert.ok(gait.frames.some(frame => frame.includes('walk_01')));
  assert.ok(gait.frames.some(frame => frame.includes('walk_03')));
  assert.ok(gait.stopped.endsWith('_idle.webp'), 'Margo returns to idle when stopped');

  // Views: the office opens with the camera standing in the room, where a
  // real drag still turns it and the wheel still zooms; Outside is the
  // dollhouse overview.
  const viewState = () => cdp.evaluate(`(async () => {
    const { ROOM } = await import('./src/office3d/room.js');
    const office = window.__office, p = office.camera.position;
    return {
      view: office.view,
      indoors: Math.abs(p.x) < ROOM.W / 2 && Math.abs(p.z) < ROOM.D / 2 && p.y > 0 && p.y < ROOM.HI,
      position: p.toArray(),
      distance: p.distanceTo(office.controls.target),
      pressed: document.querySelector('[data-view][aria-pressed="true"]')?.dataset.view,
    };
  })()`);
  const mouse = (type, x, y, extra = {}) => cdp.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
  const settle = () => new Promise(resolve => setTimeout(resolve, 600));
  const opened = await viewState();
  assert.deepEqual([opened.view, opened.indoors, opened.pressed], ['inside', true, 'inside'], 'The office opens with the camera inside the room');
  await mouse('mousePressed', 720, 450, { button: 'left', clickCount: 1 });
  for (let x = 690; x >= 420; x -= 30) await mouse('mouseMoved', x, 450, { button: 'left', buttons: 1 });
  await mouse('mouseReleased', 420, 450, { button: 'left', clickCount: 1 });
  await settle();
  const turned = await viewState();
  assert.ok(Math.hypot(turned.position[0] - opened.position[0], turned.position[2] - opened.position[2]) > 1, 'A drag turns the inside view');
  assert.equal(turned.indoors, true, 'Turning keeps the camera indoors');
  for (let i = 0; i < 6; i++) await mouse('mouseWheel', 720, 450, { deltaX: 0, deltaY: -120 });
  await settle();
  const zoomed = await viewState();
  assert.ok(zoomed.distance < turned.distance - 0.3, 'The wheel zooms the inside view');
  assert.equal(zoomed.indoors, true, 'Zooming keeps the camera indoors');
  await cdp.evaluate(`document.querySelector('[data-view="outside"]').click()`);
  const outside = await viewState();
  assert.deepEqual([outside.view, outside.indoors, outside.pressed], ['outside', false, 'outside'], 'Outside shows the room from outside');
  await cdp.evaluate(`document.querySelector('[data-view="inside"]').click()`);
  const back = await viewState();
  assert.deepEqual([back.view, back.indoors, back.pressed], ['inside', true, 'inside'], 'Inside brings the camera back into the room');

  // The open door leaf is solid: no walkable floor under it, and the doorway
  // beside it is still usable.
  const doorway = await cdp.evaluate(`(async () => {
    const { doorLeaf } = await import('./src/office3d/room.js');
    const office = window.__office, [hinge, tip] = doorLeaf();
    let walkable = 0;
    for (let t = 0.1; t <= 1; t += 0.05) if (office.nav.freeAt(hinge.x + (tip.x - hinge.x) * t, hinge.z + (tip.z - hinge.z) * t)) walkable++;
    const door = office.spots.find(s => s.type === 'door');
    return { walkable, door: door ? [door.x, door.z] : null, tip: [tip.x, tip.z] };
  })()`);
  assert.equal(doorway.walkable, 0, 'Nobody can walk through the open door leaf');
  assert.ok(doorway.door, 'The doorway is still a usable spot');
  assert.ok(Math.hypot(doorway.door[0] - doorway.tip[0], doorway.door[1] - doorway.tip[1]) > 0.3, 'The doorway spot is clear of the leaf');

  // Wall art: five pictures on the door wall, three charts on the pinboard wall.
  const wallArt = await cdp.evaluate(`(() => {
    const count = name => { let n = 0; window.__office.scene.getObjectByName(name).traverse(o => { if (o.name === 'wall-art') n++; }); return n; };
    return { front: count('front'), left: count('left') };
  })()`);
  assert.deepEqual(wallArt, { front: 5, left: 3 }, 'The walls without windows carry their pictures');

  const desktop = await cdp.evaluate(`(async () => {
    const { MARGO_LINES } = await import('./src/office3d/data.js');
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

    // Poking the office: tap the glass, follow someone, jam the printer, drop a donut.
    const sim = office.sim;
    for (let i = 0; i < 40 && sim.event; i++) office.step(2, 8);
    document.querySelector('[data-action="tap"]').click();
    office.step(3, 8);
    const tapLogged = sim.log.some(e => e.kind === 'tap');
    document.querySelector('[data-focus="jazz"]').click();
    const following = document.querySelector('[data-focus="jazz"]').getAttribute('aria-pressed') === 'true';
    document.querySelector('[data-focus=""]').click();
    const jamStarted = sim.trigger('printerJam');
    office.step(1, 8);
    const jamShown = sim.state.printerJammed;
    for (let i = 0; i < 40 && sim.event; i++) office.step(2, 8);
    const jamCleared = !sim.state.printerJammed;
    document.querySelector('[data-action="donut"]').click();
    const donutDropped = Boolean(sim.state.donut);
    for (let i = 0; i < 30 && sim.event; i++) office.step(2, 8);
    const donutWon = sim.log.some(e => /won the donut race/.test(e.text));
    // The diary lists what happened.
    document.getElementById('logToggle').click();
    const diaryOpen = !document.getElementById('dayLog').hidden;
    const diary = [...document.querySelectorAll('#dayLogList li')].map(li => li.textContent);
    document.getElementById('dayLogClose').click();
    // Staff go home at night; Margo stays.
    office.setPhase('night');
    for (let i = 0; i < 80 && office.cast.some(c => c.present && !['margo', 'ghost'].includes(c.type)); i++) office.step(2, 8);
    const nightStaff = office.cast.filter(c => c.present && c.type !== 'ghost').map(c => c.type);
    office.setPhase('midday');
    return {
      tapLogged, following, jamStarted, jamShown, jamCleared, donutDropped, donutWon, diaryOpen, nightStaff,
      diaryHasJam: diary.some(text => text.includes('The printer jammed.')),
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
  assert.equal(desktop.tapLogged, true, 'Tap the glass reaches the office');
  assert.equal(desktop.following, true, 'Follow buttons are wired');
  assert.equal(desktop.jamStarted && desktop.jamShown, true, 'The printer can be jammed');
  assert.equal(desktop.jamCleared, true, 'The jam gets fixed');
  assert.equal(desktop.donutDropped, true, 'Drop a donut puts a donut in the room');
  assert.equal(desktop.donutWon, true, 'Someone wins the donut race');
  assert.equal(desktop.diaryOpen && desktop.diaryHasJam, true, 'The diary lists what happened');
  assert.deepEqual(desktop.nightStaff, ['margo'], 'At night only Margo is in');

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

  console.log(JSON.stringify({ gait, desktop, mobile }, null, 2));
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
