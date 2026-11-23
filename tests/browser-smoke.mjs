// Browser smoke test for the 3D office (index.html): real headless Chrome
// with software WebGL, driven over the DevTools protocol. No packages needed.

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = new URL('../', import.meta.url).pathname;
mkdirSync(join(ROOT, 'scratch'), { recursive: true });
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
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    };
    const fail = reason => () => {
      for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(new Error(reason)); }
      this.pending.clear();
    };
    this.socket.addEventListener('close', fail('DevTools connection closed'));
    this.socket.addEventListener('error', fail('DevTools connection failed'));
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.onopen = resolve;
      this.socket.onerror = reject;
    });
  }

  send(method, params = {}, timeoutMs = 120000) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs} ms: ${JSON.stringify(params).slice(0, 160)}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
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
  // The ghost only visits: out of the room when the office opens. (Checked
  // now: after a few minutes of office time it may well be visiting.)
  const ghostAwayAtStart = await cdp.evaluate(`(() => {
    const ghost = window.__office.cast.find(c => c.type === 'ghost');
    return !ghost.present && !ghost.standee.root.visible;
  })()`);

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

  // Camera: the office opens with the director in charge and the camera in
  // the room. A real drag takes the camera over and turns it, the wheel
  // zooms, and it stays indoors throughout; the Director button turns the
  // director off and on.
  const viewState = () => cdp.evaluate(`(async () => {
    const { ROOM } = await import('./src/office3d/room.js');
    const office = window.__office, p = office.camera.position;
    return {
      directing: office.directing,
      mode: document.body.dataset.camera,
      shot: office.shot?.kind ?? null,
      indoors: Math.abs(p.x) < ROOM.W / 2 && Math.abs(p.z) < ROOM.D / 2 && p.y > 0 && p.y < ROOM.HI,
      position: p.toArray(),
      distance: p.distanceTo(office.controls.target),
      pressed: document.querySelector('[data-director]')?.getAttribute('aria-pressed'),
      outsideButton: Boolean(document.querySelector('[data-view]')),
    };
  })()`);
  const mouse = (type, x, y, extra = {}) => cdp.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
  const settle = () => new Promise(resolve => setTimeout(resolve, 600));
  const opened = await viewState();
  assert.deepEqual([opened.directing, opened.mode, opened.indoors, opened.pressed], [true, 'director', true, 'true'], 'The office opens with the director in charge, inside the room');
  assert.ok(opened.shot, 'The director has chosen a shot');
  assert.equal(opened.outsideButton, false, 'There is no outside view any more');
  // The director keeps the camera indoors, keeps it moving, and seldom cuts.
  const directed = await cdp.evaluate(`(async () => {
    const { ROOM } = await import('./src/office3d/room.js');
    const office = window.__office, kinds = new Set();
    const start = office.shot.pos, cut = office.shot.cut;
    let outdoors = 0, travelled = 0, last = start;
    for (let i = 0; i < 240; i++) {
      office.step(0.5);
      const p = office.camera.position;
      if (!(Math.abs(p.x) < ROOM.W / 2 && Math.abs(p.z) < ROOM.D / 2 && p.y > 0 && p.y < ROOM.HI)) outdoors++;
      kinds.add(office.shot.kind);
      travelled += Math.hypot(office.shot.pos.x - last.x, office.shot.pos.z - last.z);
      last = office.shot.pos;
    }
    return { outdoors, travelled, cuts: office.shot.cut - cut, kinds: [...kinds] };
  })()`);
  assert.equal(directed.outdoors, 0, 'The camera stays inside the room');
  assert.ok(directed.kinds.includes('roam'), `The director should roam, got ${directed.kinds}`);
  assert.ok(directed.travelled > 3, `In two minutes the camera should travel, got ${directed.travelled.toFixed(1)} m`);
  assert.ok(directed.cuts <= 3, `In two minutes the director should cut rarely, got ${directed.cuts}`);
  const before = await viewState();
  await mouse('mousePressed', 720, 450, { button: 'left', clickCount: 1 });
  for (let x = 690; x >= 420; x -= 30) await mouse('mouseMoved', x, 450, { button: 'left', buttons: 1 });
  await mouse('mouseReleased', 420, 450, { button: 'left', clickCount: 1 });
  await settle();
  const turned = await viewState();
  assert.deepEqual([turned.directing, turned.mode], [false, 'manual'], 'A drag takes the camera from the director');
  assert.ok(Math.hypot(turned.position[0] - before.position[0], turned.position[2] - before.position[2]) > 0.5, 'A drag turns the camera');
  assert.equal(turned.indoors, true, 'Turning keeps the camera indoors');
  // Zoom well in: near a wall the camera already stands closer than the
  // orbit asks for, and only a zoom past that distance moves it.
  for (let i = 0; i < 6; i++) await mouse('mouseWheel', 720, 450, { deltaX: 0, deltaY: -600 });
  await settle();
  // The orbit controls apply the zoom on their next update: a few frames,
  // however slowly this machine draws them.
  await cdp.evaluate(`window.__office.step(0.2)`);
  const zoomed = await viewState();
  assert.ok(zoomed.distance < turned.distance - 0.2, `The wheel zooms the camera (${turned.distance.toFixed(2)} m to ${zoomed.distance.toFixed(2)} m, at ${turned.position.map(v => v.toFixed(2))})`);
  assert.equal(zoomed.indoors, true, 'Zooming keeps the camera indoors');
  await cdp.evaluate(`window.__office.step(9)`);
  const resumed = await viewState();
  assert.equal(resumed.directing, true, 'Left alone, the director takes the camera back');
  await cdp.evaluate(`document.querySelector('[data-director]').click()`);
  await cdp.evaluate(`window.__office.step(1)`);
  const off = await viewState();
  assert.deepEqual([off.directing, off.pressed, off.indoors], [false, 'false', true], 'The Director button turns the director off');
  await cdp.evaluate(`document.querySelector('[data-director]').click()`);
  await cdp.evaluate(`window.__office.step(1)`);
  const on = await viewState();
  assert.deepEqual([on.directing, on.pressed], [true, 'true'], 'and on again');

  // First person: the camera sits in the picked character's head, their
  // cutout is hidden and a drag turns the head without leaving it.
  const povState = () => cdp.evaluate(`(() => {
    const office = window.__office, me = office.cast.find(c => c.type === office.eyes), p = office.camera.position;
    return {
      mode: document.body.dataset.camera, eyes: office.eyes,
      pressed: document.querySelector('[data-pov]').getAttribute('aria-pressed'),
      picked: document.querySelector('[data-focus][aria-pressed="true"]')?.dataset.focus,
      off: me ? Math.hypot(p.x - me.pos.x, p.z - me.pos.y) : null, height: p.y,
      hidden: me ? !me.standee.root.visible : null,
      facing: (() => { const d = new office.camera.position.constructor(); office.camera.getWorldDirection(d); return [d.x, d.z]; })(),
      heading: me ? [Math.sin(me.heading), Math.cos(me.heading)] : null,
    };
  })()`);
  await cdp.evaluate(`document.querySelector('[data-pov]').click()`);
  await cdp.evaluate(`window.__office.step(3)`);
  const eyes = await povState();
  assert.deepEqual([eyes.mode, eyes.pressed, eyes.hidden], ['pov', 'true', true], 'First person puts the camera in a character, with their cutout hidden');
  assert.equal(eyes.eyes, eyes.picked, 'It is the character picked in the toolbar');
  assert.ok(eyes.off < 0.6 && eyes.height > 1.2 && eyes.height < 1.8, `The camera is at their eyes (off ${eyes.off}, height ${eyes.height})`);
  assert.ok(eyes.facing[0] * eyes.heading[0] + eyes.facing[1] * eyes.heading[1] > 0.7, 'It looks the way they face');
  await mouse('mousePressed', 720, 450, { button: 'left', clickCount: 1 });
  for (let x = 700; x >= 520; x -= 20) await mouse('mouseMoved', x, 450, { button: 'left', buttons: 1 });
  await cdp.evaluate(`window.__office.step(0.3)`);
  const looking = await povState();
  await mouse('mouseReleased', 520, 450, { button: 'left', clickCount: 1 });
  assert.equal(looking.mode, 'pov', 'A drag in first person stays in first person');
  assert.ok(looking.facing[0] * looking.heading[0] + looking.facing[1] * looking.heading[1] < 0.85, 'and turns the head');
  // W walks the character forward; the camera goes with them.
  const key = (type, code, k) => cdp.send('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) });
  const place = () => cdp.evaluate(`(() => { const o = window.__office, me = o.cast.find(c => c.type === o.eyes); return { x: me.pos.x, z: me.pos.y, driving: me.driving, hint: document.querySelector('.title small').textContent }; })()`);
  await cdp.evaluate(`(() => { const o = window.__office, me = o.cast.find(c => c.type === o.eyes); Object.assign(me, { path: [], chat: null, busy: null, heading: 0 }); me.pos.x = 0; me.pos.y = 0; })()`);
  const stood = await place();
  assert.match(stood.hint, /W A S D/, 'First person says how to walk');
  await key('keyDown', 'KeyW', 'w');
  await cdp.evaluate(`window.__office.step(1.5)`);
  const walked = await place();
  await key('keyUp', 'KeyW', 'w');
  assert.ok(walked.driving && walked.z - stood.z > 0.6, `W walks them forward (moved ${(walked.z - stood.z).toFixed(2)} m)`);
  await cdp.evaluate(`window.__office.step(0.5)`);
  assert.equal((await place()).driving, false, 'Letting go of the key lets go of the character');
  await cdp.evaluate(`document.querySelector('[data-focus="andy"]').click()`);
  await cdp.evaluate(`window.__office.step(2)`);
  const andy = await povState();
  if (andy.mode === 'pov') assert.equal(andy.eyes, 'andy', 'Picking someone else moves into their head');
  await cdp.evaluate(`document.querySelector('[data-focus=""]').click()`);
  await cdp.evaluate(`window.__office.step(1)`);
  const out = await cdp.evaluate(`({
    mode: document.body.dataset.camera,
    pressed: document.querySelector('[data-pov]').getAttribute('aria-pressed'),
    shown: window.__office.cast.filter(c => c.present && c.opacity > 0).every(c => c.standee.root.visible),
  })`);
  assert.deepEqual([out.mode, out.pressed, out.shown], ['director', 'false', true], 'Everyone leaves first person: the director is back and every cutout shows');

  // Party: the button (and the P key) turns the lights down and brings the
  // disco ball, the boombox, the mess and the moon; the whole team stays; and
  // turning it off leaves the room as it was.
  const partyState = () => cdp.evaluate(`(() => {
    const o = window.__office, moon = o.scene.getObjectByName('moon');
    let cups = 0;
    o.party.group.traverse(c => { if (c.isMesh && c.parent?.parent?.name === 'party-mess') cups++; });
    return {
      on: o.partyOn, body: document.body.dataset.partyMode,
      pressed: document.querySelector('[data-party]').getAttribute('aria-pressed'),
      fade: o.party.state.fade, light: o.party.lights.map(l => l.intensity),
      lights: o.party.lights.length, stuff: o.party.group.children[0].visible,
      moon: moon.visible ? moon.material.opacity : 0, music: o.sound.musicWanted,
      staff: ['andy', 'jazz', 'olex'].every(t => o.cast.find(c => c.type === t).present),
    };
  })()`);
  const before_ = await partyState();
  assert.deepEqual([before_.on, before_.pressed, before_.stuff, before_.light.every(i => i === 0)], [false, 'false', false, true], 'No party until asked for');
  // The button only comes alive once every dance frame has arrived.
  await cdp.evaluate(`window.__office.partyReady.then(() => new Promise(r => setTimeout(r, 0)))`);
  assert.equal(await cdp.evaluate(`document.querySelector('[data-party]').disabled`), false, 'Party is available once the dance art has loaded');
  await cdp.evaluate(`document.querySelector('[data-party]').click()`);
  // Freeze the cast in place for a beat so the party's dedicated dance loop
  // can be observed without a walker skating through the frames.
  await cdp.evaluate(`window.__office.step(40)`);
  await cdp.evaluate(`(() => {
    const o = window.__office;
    for (const c of o.cast) {
      if (!c.present) continue;
      Object.assign(c, { speed: 0, path: [], dest: null, goal: null, busy: null, wait: 100 });
    }
  })()`);
  await cdp.evaluate(`window.__office.step(2)`);
  const partying = await partyState();
  assert.deepEqual([partying.on, partying.body, partying.pressed, partying.stuff, partying.music], [true, 'on', 'true', true, true], 'The Party button starts the party and the boombox');
  assert.ok(partying.fade > 0.99 && partying.light[0] > 1 && partying.light[1] > 1, `The disco light is on (${partying.light})`);
  assert.ok(partying.moon > 0.9, `The moon is out (${partying.moon})`);
  assert.equal(partying.staff, true, 'The whole team is at the party');
  const dancers = await cdp.evaluate(`(() => window.__office.cast
    .filter(c => c.present)
    .map(c => ({ type: c.type, dancing: c.standee.dancing, frame: c.standee.frame,
      rootDancing: c.standee.root.userData.dancing })))()`);
  assert.ok(dancers.length >= 4, `The party should have several visible dancers: ${JSON.stringify(dancers)}`);
  assert.ok(dancers.every(c => c.dancing && c.rootDancing && /^dance_0[1-8]$/.test(c.frame)),
    `Stationary party cast use dance frames: ${JSON.stringify(dancers)}`);
  const danceScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(ROOT, 'scratch', 'dance-party.png'), Buffer.from(danceScreenshot.data, 'base64'));
  await cdp.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }))`);
  await cdp.evaluate(`window.__office.step(4)`);
  const ended = await partyState();
  assert.deepEqual([ended.on, ended.body, ended.pressed, ended.stuff, ended.music, ended.fade, ended.lights], [false, 'off', 'false', false, false, 0, partying.lights], 'The P key ends it: everything goes away and the lights stay (so shaders are not rebuilt)');
  assert.ok(ended.light.every(i => i === 0), 'No light is left on');
  assert.ok(ended.moon < 0.01, 'The midday sky has no moon');
  const stoppedDancers = await cdp.evaluate(`(() => window.__office.cast
    .map(c => ({ type: c.type, dancing: c.standee.dancing, frame: c.standee.frame,
      rootDancing: c.standee.root.userData.dancing, prop: c.standee.prop, spot: c.spot?.type ?? null })))()`);
  // The ghost wanders in and out on its own, so it may be mid-walk; it only
  // has to be out of the dance. The staff stand still, idle or holding the
  // prop the carry policy handed them (someone standing at the coffee spot
  // when the party ends may pick up a cup, see src/office3d/carry.js).
  assert.ok(stoppedDancers.every(c => !c.dancing && !c.rootDancing && !/^dance/.test(c.frame)
    && (c.type === 'ghost' || c.frame === 'idle' || (c.prop !== null && c.frame === c.prop))),
    `Turning the party off resets dance state: ${JSON.stringify(stoppedDancers)}`);

  // The band: the Band button loads the band art once (a second click while
  // it loads does nothing more), then the staff take their marks. A show and
  // the party switch each other off, and stopping the show frees everyone.
  const showState = () => cdp.evaluate(`(() => {
    const o = window.__office, b = document.querySelector('button[data-show="band"]');
    return {
      show: o.show, sim: o.sim.show, body: document.body.dataset.show, party: o.partyOn,
      pressed: b.getAttribute('aria-pressed'), busy: b.getAttribute('aria-busy'), disabled: b.disabled,
      acts: Object.keys(o.sim.state.show?.acts ?? {}).sort(),
      busyCast: o.cast.filter(c => c.busy).map(c => c.type),
      standeeActs: o.cast.filter(c => c.standee.act).map(c => c.type).sort(),
      // What each card actually shows (a card stuck mid-flip would show an old drawing).
      drawn: Object.fromEntries(o.cast.filter(c => c.standee.act).map(c => [c.type,
        c.standee.root.getObjectByName('dance-back').parent.children[0].material.map?.source?.data?.src?.split('/').at(-1).split('?')[0] ?? null])),
      stage: o.stage.state.fade, music: o.sound.musicWanted,
    };
  })()`);
  const idle = await showState();
  assert.deepEqual([idle.show, idle.body, idle.pressed, idle.disabled], [null, 'off', 'false', false], 'No show until asked for; the Band button is ready');
  const clicked = await cdp.evaluate(`(() => {
    const o = window.__office, b = document.querySelector('button[data-show="band"]');
    window.__bandLoads = 0;
    for (const c of o.cast) {
      const load = c.standee.loadAct;
      c.standee.loadAct = name => { window.__bandLoads++; return load(name); };
    }
    b.click();
    const busy = b.getAttribute('aria-busy');
    b.click();   // impatient: a second click while the art loads
    return { busy, show: o.show };
  })()`);
  assert.equal(clicked.busy, 'true', 'The Band button shows it is loading');
  assert.equal(clicked.show, null, 'The show waits for its art');
  await retry(async () => {
    if ((await cdp.evaluate(`window.__office.show`)) !== 'band') throw new Error('The band has not started');
  });
  await cdp.evaluate(`window.__office.step(40)`);
  const playing = await showState();
  assert.equal(await cdp.evaluate(`window.__bandLoads`), 4, 'The band art is asked for once per human, however often the button is clicked');
  assert.deepEqual([playing.show, playing.sim, playing.body, playing.pressed, playing.busy, playing.party], ['band', 'band', 'band', 'true', null, false], 'The Band button starts the show');
  assert.deepEqual(playing.acts, ['andy', 'jazz', 'margo', 'olex'], 'All four are on their marks');
  assert.deepEqual(playing.standeeActs, ['andy', 'jazz', 'margo', 'olex'], 'and playing the band act');
  assert.ok(Object.values(playing.drawn).every(src => /^(front|back)_band_0[1-8]\.webp$/.test(src)), `Every card shows its band drawing: ${JSON.stringify(playing.drawn)}`);
  assert.ok(playing.stage > 0.99, 'The set is up');
  await cdp.evaluate(`window.__office.setParty(true)`);
  const partied = await showState();
  assert.deepEqual([partied.show, partied.sim, partied.party, partied.body, partied.pressed], [null, null, true, 'off', 'false'], 'The party stops the show');
  await cdp.evaluate(`window.__office.setShow('band').then(() => window.__office.step(0.1))`);   // the music follows the beat from the next frame
  const back = await showState();
  assert.deepEqual([back.show, back.party, back.music], ['band', false, true], 'A show stops the party; the band track plays');
  await cdp.evaluate(`document.querySelector('button[data-show="band"]').click()`);
  await cdp.evaluate(`window.__office.step(60)`);
  const over = await showState();
  assert.deepEqual([over.show, over.sim, over.body, over.pressed, over.busyCast, over.standeeActs, over.music, over.stage],
    [null, null, 'off', 'false', [], [], false, 0], 'A second click stops the show: everyone is free and the set is gone');

  // Christmas: the button starts it; from the band it switches over directly
  // (the band's set goes, the tree comes, the staff take the new marks and
  // the music changes), and a second click stops it.
  const xmasState = () => cdp.evaluate(`(() => {
    const o = window.__office, b = document.querySelector('button[data-show="xmas"]');
    const set = key => o.stage.subject(key);
    return {
      show: o.show, sim: o.sim.show, body: document.body.dataset.show, party: o.partyOn,
      pressed: b.getAttribute('aria-pressed'), bandPressed: document.querySelector('button[data-show="band"]').getAttribute('aria-pressed'),
      beat: o.sim.state.show?.beat ?? null,
      acts: Object.entries(o.sim.state.show?.acts ?? {}).map(([t, a]) => t + ':' + a).sort(),
      busyCast: o.cast.filter(c => c.busy).map(c => c.type),
      drawn: Object.fromEntries(o.cast.filter(c => c.standee.act).map(c => [c.type,
        c.standee.root.getObjectByName('dance-back').parent.children[0].material.map?.source?.data?.src?.split('/').at(-1).split('?')[0] ?? null])),
      bandSet: set('band')?.visible ?? null, xmasSet: set('xmas')?.visible ?? null,
      stage: o.stage.state.fade, music: o.sound.musicWanted, bpm: o.sound.bpm,
    };
  })()`);
  const stepUntil = async (test, label, limit = 120) => {
    for (let i = 0; i < limit; i++) {
      if (await cdp.evaluate(`(() => { const o = window.__office; return ${test}; })()`)) return;
      await cdp.evaluate(`window.__office.step(1)`);
    }
    throw new Error(`Timed out: ${label}`);
  };
  const fourOn = act => `Object.values(o.sim.state.show?.acts ?? {}).filter(a => a === '${act}').length === 4`;
  await cdp.evaluate(`document.querySelector('button[data-show="xmas"]').click()`);
  await retry(async () => {
    if ((await cdp.evaluate(`window.__office.show`)) !== 'xmas') throw new Error('Christmas has not started');
  });
  await stepUntil(`${fourOn('xmas')} && o.sim.state.show.beat === 'play'`, 'four carol singers on their marks');
  await cdp.evaluate(`window.__office.step(0.2)`);
  const carols = await xmasState();
  assert.deepEqual([carols.show, carols.sim, carols.body, carols.pressed, carols.party], ['xmas', 'xmas', 'xmas', 'true', false], 'The Christmas button starts the show');
  assert.deepEqual(carols.acts, ['andy:xmas', 'jazz:xmas', 'margo:xmas', 'olex:xmas'], 'All four sing on their marks');
  assert.ok(Object.values(carols.drawn).length === 4 && Object.values(carols.drawn).every(src => /^(front|back)_xmas_0[1-8]\.webp$/.test(src)), `Every card shows its Christmas drawing: ${JSON.stringify(carols.drawn)}`);
  assert.equal(carols.xmasSet, true, 'The tree is up');
  // Band, then straight to Christmas.
  await cdp.evaluate(`window.__office.setShow('band')`);
  await stepUntil(`o.show === 'band' && ${fourOn('band')} && o.sim.state.show.beat === 'play'`, 'the band on its marks');
  await cdp.evaluate(`window.__office.step(0.2)`);
  const bandOn = await xmasState();
  assert.deepEqual([bandOn.show, bandOn.bandSet, bandOn.xmasSet, bandOn.bpm], ['band', true, false, 132], 'Band takes over from Christmas');
  await cdp.evaluate(`window.__office.setShow('xmas')`);
  await stepUntil(`o.show === 'xmas' && ${fourOn('xmas')} && o.sim.state.show.beat === 'play'`, 'from the band straight to the carols');
  await cdp.evaluate(`window.__office.step(0.2)`);
  const switched = await xmasState();
  assert.deepEqual([switched.show, switched.sim, switched.bandPressed, switched.pressed, switched.bandSet, switched.xmasSet, switched.bpm, switched.music],
    ['xmas', 'xmas', 'false', 'true', false, true, 104, true], 'Band to Christmas: one show, the old set gone, the new one up, the carol playing');
  assert.deepEqual(switched.acts, ['andy:xmas', 'jazz:xmas', 'margo:xmas', 'olex:xmas'], 'and everyone on the Christmas marks');
  const blockedNow = await cdp.evaluate(`(() => {
    const o = window.__office;
    return { tree: !o.nav.freeAt(0, -1.7), amps: !o.nav.freeAt(-1.6, -1.7) || !o.nav.freeAt(1.5, -2.1), keyboard: !o.nav.freeAt(1.4, -0.4) };
  })()`);
  assert.deepEqual(blockedNow, { tree: true, amps: false, keyboard: false }, 'The tree blocks the floor; the band\'s amps and keyboard no longer do');
  await cdp.evaluate(`window.__office.setParty(true)`);
  const xmasParty = await xmasState();
  assert.deepEqual([xmasParty.show, xmasParty.party], [null, true], 'The party stops Christmas');
  await cdp.evaluate(`window.__office.setShow('xmas')`);
  await retry(async () => {
    if ((await cdp.evaluate(`window.__office.show`)) !== 'xmas') throw new Error('Christmas has not restarted');
  });
  assert.equal(await cdp.evaluate(`window.__office.partyOn`), false, 'Christmas stops the party');
  await cdp.evaluate(`document.querySelector('button[data-show="xmas"]').click()`);
  await cdp.evaluate(`window.__office.step(60)`);
  const xmasOver = await xmasState();
  assert.deepEqual([xmasOver.show, xmasOver.sim, xmasOver.pressed, xmasOver.busyCast, xmasOver.music, xmasOver.stage],
    [null, null, 'false', [], false, 0], 'A second click stops Christmas: nobody is busy and the set is gone');

  // Contours are drawn in one pass over the finished picture: furniture is
  // marked for it, nothing carries line meshes of its own any more, and
  // switching the pass off takes the ink out of the picture.
  const inked = await cdp.evaluate(`(() => {
    const office = window.__office, canvas = document.getElementById('stage'), gl = canvas.getContext('webgl2');
    office.setDirector(false);
    office.camera.position.set(0, 1.6, 3.4); office.camera.lookAt(0, 1, -4);
    const dark = on => {
      office.outline.enabled = on;
      office.step(0.04);
      office.camera.position.set(0, 1.6, 3.4); office.camera.lookAt(0, 1, -4);
      office.step(0.04);
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let n = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] < 210) n++;
      return n / (w * h);
    };
    let marked = 0, lines = 0;
    office.scene.traverse(o => {
      for (let p = o; p; p = p.parent) if (p.userData.outline === 'skip') return;
      if (o.userData.ink) marked++;
      if (o.isLine) lines++;
    });
    const without = dark(false), drawn = dark(true), coverage = office.outline.coverage();
    office.setDirector(true);
    return { marked, lines, without, drawn, coverage };
  })()`);
  assert.ok(inked.marked > 100 && inked.lines === 0, `Furniture is marked for ink and carries no line meshes (${inked.marked} marked, ${inked.lines} lines)`);
  assert.ok(inked.coverage > 0.3, `The outline pass sees the room (${inked.coverage})`);
  // With 0.8 px contours (outline.js WIDTH) the pass adds about 0.0016 of the
  // picture in dark pixels here (it was over 0.004 with 1.25 px lines).
  assert.ok(inked.drawn > inked.without + 0.001, `The outline pass puts ink on the picture (${inked.without} without, ${inked.drawn} with)`);

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
    // The ghost materialises for a haunt.
    const ghost = office.cast.find(c => c.type === 'ghost');
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
    sim.dropDonut();   // a double-click on the floor does this; there is no button
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
      cast, speaker, nameTags, ghostHaunts, panelOpened, visitorMessages, facingVisitor,
      greeted: replies.length >= 1,
      offlineReply: MARGO_LINES.offline.includes(replies.at(-1)),
      closedAgain: document.getElementById('margoChat').hidden && !margo.talkingToVisitor,
    };
  })()`);

  assert.deepEqual(desktop.cast, ['andy', 'jazz', 'olex', 'ghost', 'margo']);
  assert.ok(desktop.speaker, 'Someone should speak within ~20 s of office time');
  assert.equal(desktop.nameTags, 0, 'Names appear only inside speech bubbles');
  assert.ok(ghostAwayAtStart, 'The ghost is not in the room when the office opens');
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
  assert.equal(desktop.donutDropped, true, 'Dropping a donut puts a donut in the room');
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

  // The band from the default camera, and from behind after a drag that
  // orbits the camera half way round, in a page of its own (?show=band,
  // the director off). The screenshots in scratch/ are for looking at.
  const bandTarget = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`http://127.0.0.1:${appPort}/?seed=7&phase=midday&director=off&show=band`)}`, { method: 'PUT' })).json();
  const bandPage = new Cdp(bandTarget.webSocketDebuggerUrl);
  let bandErrors = [];
  try {
    await bandPage.open();
    await bandPage.send('Runtime.enable');
    await bandPage.send('Page.enable');
    await bandPage.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await retry(async () => {
      if ((await bandPage.evaluate('window.__office?.show ?? null')) !== 'band') throw new Error('?show=band has not started');
    }, 60000);
    assert.equal(await bandPage.evaluate('window.__office.sound.enabled'), false, '?show=band starts without sound');
    await bandPage.evaluate('window.__office.step(40)');
    const onMarks = await bandPage.evaluate('Object.keys(window.__office.sim.state.show.acts).length');
    assert.equal(onMarks, 4, 'With ?show=band all four take their marks');
    const front = await bandPage.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(ROOT, 'scratch', 'band-front.png'), Buffer.from(front.data, 'base64'));
    // Orbit: half the canvas height across is half a turn for OrbitControls.
    const mouse = (type, x, buttons = 1) => bandPage.send('Input.dispatchMouseEvent', { type, x, y: 450, button: 'left', buttons, clickCount: 1 });
    await mouse('mousePressed', 495);
    for (let x = 520; x <= 945; x += 25) await mouse('mouseMoved', x);
    await mouse('mouseReleased', 945, 0);
    await bandPage.evaluate('window.__office.step(3)');
    const behind = await bandPage.evaluate('window.__office.camera.position.z');
    assert.ok(behind < 0, `The drag took the camera behind the band (z ${behind.toFixed(2)})`);
    const rear = await bandPage.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(ROOT, 'scratch', 'band-behind.png'), Buffer.from(rear.data, 'base64'));
    bandErrors = bandPage.events.filter(event => event.method === 'Runtime.exceptionThrown');
  } finally {
    bandPage.close();
    await fetch(`http://127.0.0.1:${debugPort}/json/close/${bandTarget.id}`).catch(() => {});
  }
  assert.deepEqual(bandErrors, [], `Band page runtime errors: ${JSON.stringify(bandErrors)}`);

  // Christmas from the default front camera, during a carol (?show=xmas, the
  // director off). The screenshot in scratch/ is for looking at.
  const xmasTarget = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`http://127.0.0.1:${appPort}/?seed=7&phase=midday&director=off&show=xmas`)}`, { method: 'PUT' })).json();
  const xmasPage = new Cdp(xmasTarget.webSocketDebuggerUrl);
  let xmasErrors = [];
  try {
    await xmasPage.open();
    await xmasPage.send('Runtime.enable');
    await xmasPage.send('Page.enable');
    await xmasPage.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await retry(async () => {
      if ((await xmasPage.evaluate('window.__office?.show ?? null')) !== 'xmas') throw new Error('?show=xmas has not started');
    }, 60000);
    let ready = false;
    for (let i = 0; i < 90 && !ready; i++) {
      await xmasPage.evaluate('window.__office.step(1)');
      ready = await xmasPage.evaluate(`(() => { const s = window.__office.sim.state.show; return Object.keys(s.acts).length === 4 && s.beat === 'play'; })()`);
    }
    assert.ok(ready, 'With ?show=xmas all four take their marks and sing');
    await xmasPage.evaluate('window.__office.step(10)');   // past the first captions, still in the carol
    assert.equal(await xmasPage.evaluate('window.__office.sim.state.show.beat'), 'play');
    const front = await xmasPage.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(ROOT, 'scratch', 'xmas-front.png'), Buffer.from(front.data, 'base64'));
    xmasErrors = xmasPage.events.filter(event => event.method === 'Runtime.exceptionThrown');
  } finally {
    xmasPage.close();
    await fetch(`http://127.0.0.1:${debugPort}/json/close/${xmasTarget.id}`).catch(() => {});
  }
  assert.deepEqual(xmasErrors, [], `Christmas page runtime errors: ${JSON.stringify(xmasErrors)}`);

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
