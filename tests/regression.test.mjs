// Static checks for the 3D office: shared data, character art, local assets
// and the page's script wiring. No browser needed (see browser-smoke.mjs).

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(ROOT, path), 'utf8');

// The data, navigation and simulation modules have no browser or Three.js
// dependencies, so they are imported directly.
const data = await import('../src/office3d/data.js');
const { NavGrid } = await import('../src/office3d/nav.js');
const { createSim } = await import('../src/office3d/sim.js');
const loadData = () => data;

// Repeatable random numbers for the simulation tests.
function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const CAST = [...read('src/characters3d/standee.js').match(/STANDEE_TYPES = \[([^\]]+)\]/)[1].matchAll(/'(\w+)'/g)].map(m => m[1]);

// Pull the two small pure helpers out of the module so their production
// routing and frame policy can be checked without importing Three.js.
function loadSpriteHelpers() {
  const source = read('src/characters3d/standee.js');
  const rootDecl = source.match(/^const SPRITE_ROOT = [^;]+;/m)?.[0];
  const spriteDecl = source.match(/export function spriteUrl\(type, view, frame\) \{[\s\S]*?\n\}/)?.[0]?.replace('export ', '');
  const frameDecl = source.match(/function frameNames\(type\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(rootDecl && spriteDecl && frameDecl, 'standee sprite helpers must remain extractable');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${rootDecl}\n${spriteDecl}\n${frameDecl}\nthis.spriteUrl = spriteUrl; this.frameNames = frameNames;`, context);
  return context;
}

// WebP header reader, enough to check frame sizes without a library.
function webpSize(path) {
  const b = readFileSync(path);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF', `${path} is not a WebP file`);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
  }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; // VP8
}

test('the cast is the five characters, Margo included', () => {
  assert.deepEqual(CAST, ['andy', 'jazz', 'olex', 'ghost', 'margo']);
});

test('standee sprite URLs use Margo v3 while other casts keep their roots', () => {
  const { spriteUrl } = loadSpriteHelpers();
  assert.equal(spriteUrl('margo', 'front', 'walk_01'), 'assets/sprites/zine/margo-v3/front_walk_01.webp');
  for (const type of ['andy', 'jazz', 'olex', 'ghost']) {
    assert.equal(spriteUrl(type, 'threequarter', 'walk_03'), `assets/sprites/zine/${type}/threequarter_walk_03.webp`);
  }
});

test('Margo shares the human stride and neutral-pose cycle; Ghost keeps four frames', () => {
  const { frameNames } = loadSpriteHelpers();
  assert.deepEqual(Array.from(frameNames('ghost')), ['walk_01', 'walk_02', 'walk_03', 'walk_04']);
  for (const type of ['andy', 'jazz', 'olex', 'margo']) {
    assert.deepEqual(Array.from(frameNames(type)), ['walk_01', 'idle', 'walk_03', 'idle']);
  }
});

test('every character has lines in every dialogue bank', () => {
  const data = loadData();
  const banks = ['DIALOGUE_BANKS', 'COFFEE_DIALOGUE', 'MEETING_DIALOGUE', 'PRINTER_JAM_DIALOGUE',
    'BIRTHDAY_DIALOGUE', 'LAMP_FLICKER_DIALOGUE', 'DONUT_DIALOGUE'];
  for (const bank of banks) {
    for (const type of CAST) {
      const lines = data[bank][type];
      assert.ok(Array.isArray(lines) && lines.length >= 3, `${bank}.${type} needs at least 3 lines`);
      assert.ok(lines.every(l => typeof l === 'string' && l.trim()), `${bank}.${type} has an empty line`);
    }
  }
  for (const [activity, byType] of Object.entries(data.ACTIVITY_LINES)) {
    if (activity === 'armchair') continue; // Margo's serial break only
    for (const type of CAST) assert.ok(byType[type]?.length, `ACTIVITY_LINES.${activity}.${type} is missing`);
  }
  assert.ok(data.ACTIVITY_LINES.armchair.margo.length >= 3);
  assert.ok(data.MARGO_LINES.offline.length >= 2, 'Talk to Margo needs offline lines');
});

test('dialogue the 3D office looks up by furniture spot exists', () => {
  const data = loadData();
  const sim = read('src/office3d/sim.js');
  const spotBank = sim.match(/const SPOT_LINES = \{([\s\S]*?)\};/)[1];
  const refs = [...spotBank.matchAll(/(ACTIVITY_LINES|COFFEE_DIALOGUE)(?:\.(\w+))?/g)];
  assert.ok(refs.length > 0);
  for (const [, bank, key] of refs) {
    const lines = key ? data[bank][key] : data[bank];
    assert.ok(lines, `SPOT_LINES refers to missing ${bank}${key ? '.' + key : ''}`);
  }
});

test('day phases cover all 24 hours exactly once', () => {
  const { DAY_PHASES, phaseForHour } = loadData();
  for (let hour = 0; hour < 24; hour++) {
    assert.ok(DAY_PHASES.some(p => p.key === phaseForHour(hour)), `hour ${hour} has no phase`);
    const matches = DAY_PHASES.filter(p => (p.from < p.to ? hour >= p.from && hour < p.to : hour >= p.from || hour < p.to));
    assert.equal(matches.length, 1, `hour ${hour} matches ${matches.length} phases`);
    assert.equal(typeof matches[0].chat, 'number');
  }
});

test('every character has complete standee art at the shared size', () => {
  // Standees show the front, three-quarter and back drawings.
  const { spriteUrl } = loadSpriteHelpers();
  for (const type of CAST) {
    for (const view of ['front', 'threequarter', 'back']) {
      for (const frame of ['idle', 'walk_01', 'walk_02', 'walk_03', 'walk_04']) {
        const url = spriteUrl(type, view, frame);
        const path = join(ROOT, url);
        assert.ok(existsSync(path) && statSync(path).size > 0, `Missing sprite: ${url}`);
        assert.deepEqual(webpSize(path), [640, 960], `${url} must be 640x960`);
      }
    }
  }
});

test('no unused artwork is shipped', () => {
  const art = readdirSync(join(ROOT, 'assets', 'sprites', 'zine'), { recursive: true }).map(String);
  assert.deepEqual(art.filter(f => /(^|[\\/])side_/.test(f)), [], 'side frames are not used by the standees');
  const { spriteUrl } = loadSpriteHelpers();
  const folders = new Set(CAST.map(type => spriteUrl(type, 'front', 'idle').split('/').at(-2)));
  assert.deepEqual(readdirSync(join(ROOT, 'assets', 'sprites', 'zine')).sort(), [...folders].sort());
  assert.deepEqual(readdirSync(join(ROOT, 'assets')).sort(), ['fonts', 'sprites']);
});

test('standee art loads idle drawings first and can be deferred', () => {
  const source = read('src/characters3d/standee.js');
  assert.match(source, /autoLoad = true/, 'createStandee takes an autoLoad option');
  assert.match(source, /load: \(\) => loadIdle\(\)\.then\(loadWalk\)/, 'load() fetches idle frames before walk frames');
  const office = read('src/office3d/office.js');
  assert.match(office, /createStandee\(c\.type, \{ autoLoad: false \}\)/, 'the office stages the art itself');
  assert.match(office, /staff\.map\(c => c\.standee\.loadIdle\(\)\)/);
  assert.match(office, /ghostDueIn\(\) < GHOST_ART_LEAD_S/, "the ghost's art waits until a visit is near");
});

// A small office for the simulation: the real room size with a desk block.
function testOffice(seed, phase = 'midday') {
  const nav = new NavGrid({ x0: -6, z0: -4, x1: 6, z1: 4, cell: 0.2 });
  nav.blockRect(-4.5, -3.6, -2.5, -2.4, 0.24);
  const spots = [
    { x: -3.5, z: -2.0, heading: Math.PI, type: 'desk_cluster' },
    { x: 4.6, z: -2.5, heading: Math.PI / 2, type: 'coffee_station' },
    { x: 5.0, z: 2.0, heading: 0, type: 'armchair' },
    { x: -3.5, z: -3.0, heading: 0, type: 'printer' }, // inside the desk: must be dropped
  ];
  return { nav, sim: createSim({ nav, spots, types: CAST, phase: () => phase, random: seeded(seed) }) };
}

test('the simulation runs without a browser: the cast walks, stays on the floor and talks', () => {
  const { nav, sim } = testOffice(7);
  assert.equal(sim.spots.length, 3, 'spots inside furniture are not used');
  const start = sim.cast.map(c => ({ ...c.pos }));
  const speakers = new Set();
  let lines = 0;
  const seen = new Map();
  for (let i = 0; i < 180 * 30; i++) {
    sim.update(1 / 30);
    for (const c of sim.cast) {
      if (!c.present) continue;
      assert.ok(Math.abs(c.pos.x) <= 6 && Math.abs(c.pos.y) <= 4, `${c.type} left the room`);
      if (c.line !== null && seen.get(c) !== c.lineSeq) {
        seen.set(c, c.lineSeq);
        speakers.add(c.type);
        lines++;
        assert.ok(data.DIALOGUE_BANKS[c.type].includes(c.line)
          || Object.values(data.ACTIVITY_LINES).some(bank => bank[c.type]?.includes(c.line))
          || data.COFFEE_DIALOGUE[c.type]?.includes(c.line)
          || data.MARGO_LINES.ghostSpotted.includes(c.line), `${c.type} said an unknown line: ${c.line}`);
      }
    }
  }
  assert.ok(Math.abs(sim.time - 180) < 1e-6);
  const moved = sim.cast.filter((c, i) => c.type !== 'ghost' && Math.hypot(c.pos.x - start[i].x, c.pos.y - start[i].y) > 0.5);
  assert.ok(moved.length >= 3, 'most of the staff should have walked somewhere');
  assert.ok(speakers.size >= 2 && lines >= 4, `expected some talk, got ${lines} lines from ${[...speakers]}`);
  for (const c of sim.cast) if (c.present && c.speed < 0.05) assert.ok(nav.nearestFree(c.pos.x, c.pos.y), `${c.type} is stuck`);
});

test('the ghost starts away, materialises on a haunt and leaves again', () => {
  const { sim } = testOffice(11, 'night');
  const ghost = sim.cast.find(c => c.type === 'ghost');
  assert.equal(ghost.present, false);
  assert.equal(ghost.opacity, 0);
  const due = sim.ghostDueIn();
  assert.ok(due >= 30 && due <= 90, `first visit should be 30-90 s away, got ${due}`);
  sim.haunt();
  assert.equal(sim.ghostDueIn(), 0);
  for (let i = 0; i < 3 * 30; i++) sim.update(1 / 30);
  assert.equal(ghost.present, true);
  assert.equal(ghost.opacity, 1);
  for (let i = 0; i < 120 * 30 && ghost.present; i++) sim.update(1 / 30);
  assert.equal(ghost.present, false, 'the ghost dissolves when the haunt is over');
  assert.equal(ghost.line, null);
});

test('a character talking to the visitor stops and turns to face them', () => {
  const { sim } = testOffice(3);
  const margo = sim.cast.find(c => c.type === 'margo');
  for (let i = 0; i < 10 * 30; i++) sim.update(1 / 30);
  margo.talkingToVisitor = true;
  sim.visitor.x = margo.pos.x;
  sim.visitor.z = margo.pos.y + 10;
  for (let i = 0; i < 4 * 30; i++) sim.update(1 / 30);
  assert.ok(margo.speed < 0.02, 'Margo stands still');
  assert.ok(Math.abs(Math.sin(margo.heading)) < 0.05 && Math.cos(margo.heading) > 0.99, 'Margo faces the visitor');
  assert.ok(sim.say(margo, 'Status: tested.') > 0);
  assert.equal(margo.line, 'Status: tested.');
});

test('fonts and Three.js are local; the pages make no third-party requests', () => {
  for (const family of ['Caveat', 'Inter']) {
    assert.ok(existsSync(join(ROOT, 'assets', 'fonts', `${family}-Variable.woff2`)), `Missing font: ${family}`);
    assert.ok(existsSync(join(ROOT, 'assets', 'fonts', `OFL-${family}.txt`)), `Missing font license: ${family}`);
  }
  for (const file of ['three.module.min.js', 'LICENSE', 'addons/OrbitControls.js', 'addons/RoundedBoxGeometry.js']) {
    assert.ok(existsSync(join(ROOT, 'vendor', 'three', file)), `Missing vendored Three.js file: ${file}`);
  }
  for (const page of ['index.html', 'characters3d.html']) {
    assert.doesNotMatch(read(page), /(?:src|href)="https?:/, `${page} must not load third-party URLs`);
  }
});

test('index.html loads the office module and offers Talk to Margo', () => {
  const html = read('index.html');
  assert.match(html, /<script type="module" src="src\/office3d\/office\.js\?v=[0-9a-f]+">/);
  assert.doesNotMatch(html, /<script src=/, 'every script is a module');
  assert.match(html, /<meta name="margo-endpoint" content="[^"]*">/);
  for (const id of ['talkMargo', 'margoChat', 'margoLog', 'margoForm', 'margoInput', 'margoStatus', 'margoClose']) {
    assert.match(html, new RegExp(`id="${id}"`), `Missing #${id}`);
  }
});

test('the simulation module needs no browser or Three.js', () => {
  for (const file of ['data.js', 'nav.js', 'sim.js']) {
    const source = read(`src/office3d/${file}`);
    assert.doesNotMatch(source, /from 'three|\b(?:document|window)\.[A-Za-z]/, `${file} must stay free of Three.js and the DOM`);
  }
});
