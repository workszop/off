// Deterministic visual regression for the standee sprite set.
// Screenshots are review evidence and intentionally live under scratch/.

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = new URL('../', import.meta.url).pathname;
const OUT = join(ROOT, 'scratch', 'sprite-sharpness', 'output');
const BEFORE = join(ROOT, 'scratch', 'sprite-sharpness', 'before');
mkdirSync(OUT, { recursive: true });
assert.ok(existsSync(BEFORE), 'Keep the original sprite snapshot at scratch/sprite-sharpness/before');

const MIME = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};
const missingRequests = new Set();
const server = createServer((request, response) => {
  const rawPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relativePath = rawPath === '/' ? 'characters3d.html' : rawPath.slice(1);
  const filePath = normalize(join(ROOT, relativePath));
  if (!filePath.startsWith(ROOT) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    missingRequests.add(rawPath);
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
  const candidates = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  return candidates.find(command => spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0);
}
async function retry(fn, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { return await fn(); } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw lastError || new Error('Timed out');
}

const chromeBin = findChrome();
assert.ok(chromeBin, 'Chrome or Chromium is required for sprite-quality');
const debugPort = await freePort();
const profilePath = join(tmpdir(), 'offquarium-sprites-' + process.pid);
const chrome = spawn(chromeBin, [
  '--headless=new', '--no-sandbox', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-extensions',
  '--remote-debugging-port=' + debugPort, '--user-data-dir=' + profilePath,
  '--window-size=1280,760',
  'http://127.0.0.1:' + appPort + '/characters3d.html?mode=stand&t=0',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const page = await retry(async () => {
  const pages = await (await fetch('http://127.0.0.1:' + debugPort + '/json')).json();
  const match = pages.find(candidate => candidate.url.startsWith('http://127.0.0.1:' + appPort + '/'));
  if (!match) throw new Error('Sprite page is not ready');
  return match;
});

class Cdp {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.socket = new WebSocket(url);
    const fail = error => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
    };
    this.socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (!message.id) { this.events.push(message); return; }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    };
    this.socket.onerror = () => fail(new Error('CDP WebSocket error'));
    this.socket.onclose = () => fail(new Error('CDP WebSocket closed'));
  }
  open(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP open timed out')), timeoutMs);
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP open failed')); }, { once: true });
    });
  }
  send(method, params = {}, timeoutMs = 10000) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP ' + method + ' timed out'));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
  }
  async evaluate(expression, timeoutMs = 15000) {
    const result = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    }, timeoutMs);
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }
  close() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('CDP closed'));
    }
    this.pending.clear();
    this.socket.close();
  }
}

const cdp = new Cdp(page.webSocketDebuggerUrl);
await cdp.open();
const comparisonSetup = String.raw`(async () => {
  const THREE = await import('three');
  const mod = await import('./src/characters3d/standee.js');
  const createStandee = mod.createStandee;
  const spriteUrl = mod.spriteUrl;
  const previousRoot = 'scratch/sprite-sharpness/before';
  const currentRoot = 'assets/sprites/zine';
  const canvas = document.createElement('canvas');
  canvas.id = 'sprite-quality-canvas';
  canvas.width = 1280; canvas.height = 760;
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:#f4efe5';
  document.body.replaceChildren(canvas);
  const label = document.createElement('div');
  label.id = 'sprite-quality-label';
  label.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);width:240px;z-index:2;font:600 12px Inter,sans-serif;line-height:1.25;text-align:center;white-space:normal;color:#292824;background:#fffdf8dd;border:1px solid #292824;border-radius:8px;padding:6px 8px';
  document.body.append(label);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4efe5);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d0c2, 1.7));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshBasicMaterial({ color: 0xf4efe5 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const camera = new THREE.PerspectiveCamera(30, 1280 / 760, 0.05, 60);
  const oldRandom = Math.random; Math.random = () => 0.5;
  const make = (type, root) => createStandee(type, {
    resolve: (t, view, frame) => root === currentRoot
      ? spriteUrl(t, view, frame)
      : previousRoot + '/' + spriteUrl(t, view, frame).replace(/^assets\/sprites\/zine\//, '').replace(/\?.*$/, ''),
  });
  Math.random = oldRandom;
  const pairs = {};
  for (const type of ['andy', 'jazz', 'olex', 'ghost', 'margo']) {
    pairs[type] = { previous: make(type, previousRoot), current: make(type, currentRoot) };
    scene.add(pairs[type].previous.root, pairs[type].current.root);
  }
  await Promise.all(Object.values(pairs).flatMap(pair => [pair.previous.load(), pair.current.load()]));
  const previous = pairs.andy.previous;
  const current = pairs.andy.current;
  const mapUrl = standee => standee.root.children[0].children[0].children[0].children[0].material.map?.source?.data?.src || '';
  const card = standee => standee.root.children[0].children[0];
  const update = (standee, x, heading, speed, dt, count) => {
    standee.root.position.set(x, 0, 0);
    standee.heading = heading;
    for (let i = 0; i < count; i++) standee.update(i * dt, dt, speed, camera);
  };
  const settle = async (standee, x, heading, frame, distance) => {
    camera.position.set(0, 1.18, distance); camera.lookAt(0, 0.82, 0);
    // Let the card finish choosing its directional drawing before selecting
    // a gait frame. Otherwise a target frame can be observed while the card
    // is edge-on during the view flip.
    for (let i = 0; i < 24; i++) update(standee, x, heading, 0, 0.05, 1);
    let targetSeen = false;
    let minRotation = Infinity;
    for (let i = 0; i < 128; i++) {
      update(standee, x, heading, frame === 'idle' ? 0 : 1, 0.05, 1);
      const fileName = mapUrl(standee).split('/').at(-1).split('?')[0];
      if (fileName.endsWith('_' + frame + '.webp')) targetSeen = true;
      minRotation = Math.min(minRotation, Math.abs(card(standee).rotation.y));
      if (fileName.endsWith('_' + frame + '.webp') && Math.abs(card(standee).rotation.y) < 0.02) {
        return { url: mapUrl(standee), view: standee.view, mirrored: standee.mirrored };
      }
    }
    throw new Error('Could not settle ' + standee.type + ' frame ' + frame + ' heading ' + heading + ' targetSeen ' + targetSeen + ' minRotation ' + minRotation + ' url ' + mapUrl(standee) + ' view ' + standee.view + ' mirrored ' + standee.mirrored);
  };
  const renderScenario = async (name, heading, frame, distance, viewText, type = 'andy') => {
    const pair = pairs[type] || pairs.andy;
    for (const entry of Object.values(pairs)) {
      entry.previous.root.visible = false;
      entry.current.root.visible = false;
    }
    pair.previous.root.visible = true;
    pair.current.root.visible = true;
    await settle(pair.previous, -0.78, heading, frame, distance);
    await settle(pair.current, 0.78, heading, frame, distance);
    label.textContent = 'Sprite sharpness  |  ' + name + '\nLEFT  previous  ·  RIGHT  current  |  ' + viewText + ' · ' + frame + ' · ' + distance + 'm';
    renderer.render(scene, camera);
  };
  const textures = [];
  const probes = [];
  const frameNamesFor = type => type === 'ghost'
    ? ['idle', 'walk_01', 'walk_02', 'walk_03', 'walk_04']
    : ['idle', 'walk_01', 'walk_03'];
  const directions = [
    { heading: 0, view: 'front', mirrored: false },
    { heading: Math.PI / 2, view: 'threequarter', mirrored: false },
    { heading: -Math.PI / 2, view: 'threequarter', mirrored: true },
    { heading: Math.PI, view: 'back', mirrored: false },
  ];
  for (const type of ['andy', 'jazz', 'olex', 'ghost', 'margo']) {
    const probe = make(type, currentRoot);
    await probe.load();
    for (const direction of directions) {
      for (const frame of frameNamesFor(type)) {
        const settled = await settle(probe, 0, direction.heading, frame, 5.2);
        const map = probe.root.children[0].children[0].children[0].children[0].material.map;
        const width = map?.image?.width || map?.source?.data?.naturalWidth;
        const height = map?.image?.height || map?.source?.data?.naturalHeight;
        probes.push({
          type: type, frame: frame, expectedView: direction.view, expectedMirrored: direction.mirrored,
          actualView: settled.view, actualMirrored: settled.mirrored, url: settled.url,
          nonblank: Boolean(settled.url), width: width, height: height,
        });
      }
    }
    const map = probe.root.children[0].children[0].children[0].children[0].material.map;
    textures.push({ type: type, width: map?.image?.width || map?.source?.data?.naturalWidth, height: map?.image?.height || map?.source?.data?.naturalHeight, url: mapUrl(probe) });
  }
  const cases = [
    ['near-front-idle', 0, 'idle', 3.2, 'front · near'],
    ['near-front-walk-01', 0, 'walk_01', 3.2, 'front · near'],
    ['near-front-walk-03', 0, 'walk_03', 3.2, 'front · near'],
    ['far-threequarter-mirrored', -Math.PI / 2, 'idle', 6.8, 'three-quarter · mirrored'],
    ['near-threequarter', Math.PI / 2, 'walk_01', 3.2, 'three-quarter'],
    ['far-back', Math.PI, 'walk_03', 6.8, 'back · far'],
  ];
  const metadata = { textures: textures, probes: probes, scenarios: [] };
  for (const item of cases) {
    await renderScenario(item[0], item[1], item[2], item[3], item[4]);
    metadata.scenarios.push({ name: item[0], previous: mapUrl(previous), current: mapUrl(current) });
  }
  window.__spriteQualityRender = renderScenario;
  window.__spriteQualityMetadata = metadata;
  return { canvas: [canvas.width, canvas.height], textures: textures, probes: probes, scenarios: metadata.scenarios };
})()`;

try {
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 760, deviceScaleFactor: 1, mobile: false,
  });
  await retry(async () => {
    if (!(await cdp.evaluate('Boolean(document.querySelector("#stage"))'))) throw new Error('Showcase not ready');
  });
  const metadata = await cdp.evaluate(comparisonSetup, 60000);
  assert.deepEqual(metadata.canvas, [1280, 760]);
  assert.equal(metadata.textures.length, 5);
  for (const texture of metadata.textures) {
    assert.deepEqual([texture.width, texture.height], [1280, 1920], texture.type + ' current texture must be 1280x1920');
    assert.match(texture.url, /_(?:idle|walk_01|walk_02|walk_03|walk_04)\.webp(?:\?.*)?$/);
  }
  assert.equal(metadata.probes.length, 68);
  for (const probe of metadata.probes) {
    assert.equal(probe.nonblank, true, probe.type + ' ' + probe.frame + ' must map a nonblank texture');
    assert.deepEqual([probe.width, probe.height], [1280, 1920], probe.type + ' ' + probe.frame + ' dimensions');
    assert.equal(probe.actualView, probe.expectedView, probe.type + ' directional view');
    assert.equal(probe.actualMirrored, probe.expectedMirrored, probe.type + ' mirror state');
    assert.match(probe.url, /_(?:idle|walk_01|walk_02|walk_03|walk_04)\.webp(?:\?.*)?$/);
  }
  assert.equal(metadata.scenarios.length, 6);
  for (const scenario of metadata.scenarios) {
    assert.match(scenario.previous, /\.webp(?:\?.*)?$/);
    assert.match(scenario.current, /\.webp(?:\?.*)?$/);
  }
  const captures = [
    ['near-front-idle', 0, 'idle', 3.2, 'front · near', 'andy'],
    ['near-front-walk-01', 0, 'walk_01', 3.2, 'front · near', 'andy'],
    ['near-front-walk-03', 0, 'walk_03', 3.2, 'front · near', 'andy'],
    ['far-threequarter-mirrored', -Math.PI / 2, 'idle', 6.8, 'three-quarter · mirrored', 'andy'],
    ['near-threequarter', Math.PI / 2, 'walk_01', 3.2, 'three-quarter', 'andy'],
    ['far-back', Math.PI, 'walk_03', 6.8, 'back · far', 'andy'],
    ['jazz-front-walk-01', 0, 'walk_01', 3.2, 'front · near', 'jazz'],
    ['olex-front-walk-01', 0, 'walk_01', 3.2, 'front · near', 'olex'],
    ['ghost-front-walk-01', 0, 'walk_01', 3.2, 'front · near', 'ghost'],
    ['margo-front-walk-01', 0, 'walk_01', 3.2, 'front · near', 'margo'],
  ];
  for (const item of captures) {
    await cdp.evaluate('window.__spriteQualityRender(' + JSON.stringify(item[0]) + ',' + item[1] + ',' + JSON.stringify(item[2]) + ',' + item[3] + ',' + JSON.stringify(item[4]) + ',' + JSON.stringify(item[5]) + ')', 30000);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 15000);
    writeFileSync(join(OUT, item[0] + '.png'), Buffer.from(shot.data, 'base64'));
  }

  const phases = {};
  for (const phase of ['midday', 'evening', 'night']) {
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + appPort + '/index.html?seed=7&phase=' + phase }, 15000);
    await retry(async () => {
      if (!(await cdp.evaluate('Boolean(window.__office?.ready)'))) throw new Error('Office not ready: ' + phase);
    }, 60000);
    await retry(async () => {
      const ready = await cdp.evaluate('(() => { const office = window.__office; if (document.getElementById("loading")) return false; return office.cast.filter(c => c.present && c.standee.root.visible).every(c => { const mesh = c.standee.root.children[0]?.children[0]?.children[0]?.children[0]; return Boolean(mesh?.material?.map?.image?.width); }); })()');
      if (!ready) throw new Error('Office art not ready: ' + phase);
    }, 60000);
    phases[phase] = await cdp.evaluate('(() => { const office = window.__office; office.setPhase(' + JSON.stringify(phase) + '); office.step(0.5, 10); return { ready: office.ready === true, phase: document.querySelector("[data-phase][aria-pressed=true]")?.dataset.phase, cast: office.cast.map(c => c.type), visible: office.cast.filter(c => c.present && c.standee.root.visible).length }; })()');
    assert.equal(phases[phase].ready, true);
    assert.equal(phases[phase].phase, phase);
    assert.equal(phases[phase].cast.length, 5);
    const phaseShot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 15000);
    writeFileSync(join(OUT, 'office-' + phase + '.png'), Buffer.from(phaseShot.data, 'base64'));
  }
  const runtimeErrors = cdp.events.filter(event =>
    event.method === 'Runtime.exceptionThrown'
    || (event.method === 'Log.entryAdded' && event.params.entry.level === 'error')
    || (event.method === 'Network.loadingFailed' && !event.params.canceled)
  );
  assert.deepEqual([...missingRequests], [], 'Missing HTTP resources: ' + [...missingRequests].join(', '));
  assert.deepEqual(runtimeErrors, [], 'Browser runtime errors: ' + JSON.stringify(runtimeErrors));
  console.log(JSON.stringify({ output: OUT, probeCount: metadata.probes.length, metadata: metadata, phases: phases }, null, 2));
} finally {
  cdp.close();
  chrome.kill('SIGTERM');
  await new Promise(resolve => {
    if (chrome.exitCode !== null) { resolve(); return; }
    const timer = setTimeout(() => { chrome.kill('SIGKILL'); resolve(); }, 1500);
    chrome.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  await new Promise(resolve => server.close(resolve));
  try { rmSync(profilePath, { recursive: true, force: true }); } catch {}
}
