// Static checks for the 3D office: shared data, character art, local assets
// and the page's script wiring. No browser needed (see browser-smoke.mjs).

import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(ROOT, path), 'utf8');

// js/data.js is a classic script of globals; evaluate it in a sandbox.
function loadData() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${read('js/data.js')}
    this.data = { DIALOGUE_BANKS, COFFEE_DIALOGUE, MEETING_DIALOGUE, ACTIVITY_LINES,
      PRINTER_JAM_DIALOGUE, BIRTHDAY_DIALOGUE, LAMP_FLICKER_DIALOGUE, DONUT_DIALOGUE,
      MARGO_LINES, DAY_PHASES };`, context);
  return context.data;
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

test('standee sprite URLs use Margo v2 while other casts keep their roots', () => {
  const { spriteUrl } = loadSpriteHelpers();
  assert.equal(spriteUrl('margo', 'front', 'walk_01'), 'assets/sprites/zine/margo-v2/front_walk_01.webp');
  for (const type of ['andy', 'jazz', 'olex', 'ghost']) {
    assert.equal(spriteUrl(type, 'threequarter', 'walk_03'), `assets/sprites/zine/${type}/threequarter_walk_03.webp`);
  }
});

test('standee frame cycles give Margo four genuine walk frames', () => {
  const { frameNames } = loadSpriteHelpers();
  assert.deepEqual(Array.from(frameNames('margo')), ['walk_01', 'walk_02', 'walk_03', 'walk_04']);
  assert.deepEqual(Array.from(frameNames('ghost')), ['walk_01', 'walk_02', 'walk_03', 'walk_04']);
  for (const type of ['andy', 'jazz', 'olex']) {
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
  const office = read('src/office3d/office.js');
  const spotBank = office.match(/const SPOT_LINES = \{([\s\S]*?)\};/)[1];
  const refs = [...spotBank.matchAll(/(ACTIVITY_LINES|COFFEE_DIALOGUE)(?:\.(\w+))?/g)];
  assert.ok(refs.length > 0);
  for (const [, bank, key] of refs) {
    const lines = key ? data[bank][key] : data[bank];
    assert.ok(lines, `SPOT_LINES refers to missing ${bank}${key ? '.' + key : ''}`);
  }
});

test('day phases cover all 24 hours exactly once', () => {
  const { DAY_PHASES } = loadData();
  for (let hour = 0; hour < 24; hour++) {
    const matches = DAY_PHASES.filter(p => (p.from < p.to ? hour >= p.from && hour < p.to : hour >= p.from || hour < p.to));
    assert.equal(matches.length, 1, `hour ${hour} matches ${matches.length} phases`);
    assert.equal(typeof matches[0].chat, 'number');
  }
});

test('every character has complete standee art at the shared size', () => {
  // Standees use front, three-quarter and back; side frames are kept for future use.
  for (const type of CAST) {
    for (const view of ['front', 'threequarter', 'side', 'back']) {
      for (const frame of ['idle', 'walk_01', 'walk_02', 'walk_03', 'walk_04']) {
        const path = join(ROOT, 'assets', 'sprites', 'zine', type, `${view}_${frame}.webp`);
        assert.ok(existsSync(path) && statSync(path).size > 0, `Missing sprite: ${type}/${view}_${frame}`);
        assert.deepEqual(webpSize(path), [640, 960], `${type}/${view}_${frame} must be 640x960`);
      }
    }
  }
});

test('Margo v2 standee art has every direction and frame at the shared size', () => {
  for (const view of ['front', 'threequarter', 'side', 'back']) {
    for (const frame of ['idle', 'walk_01', 'walk_02', 'walk_03', 'walk_04']) {
      const path = join(ROOT, 'assets', 'sprites', 'zine', 'margo-v2', `${view}_${frame}.webp`);
      assert.ok(existsSync(path) && statSync(path).size > 0, `Missing sprite: margo-v2/${view}_${frame}`);
      assert.deepEqual(webpSize(path), [640, 960], `margo-v2/${view}_${frame} must be 640x960`);
    }
  }
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

test('index.html loads data before the office module and offers Talk to Margo', () => {
  const html = read('index.html');
  const data = html.indexOf('src="js/data.js');
  const office = html.indexOf('src="src/office3d/office.js');
  assert.ok(data > 0 && office > data, 'js/data.js must load before the office module');
  assert.match(html, /<meta name="margo-endpoint" content="[^"]*">/);
  for (const id of ['talkMargo', 'margoChat', 'margoLog', 'margoForm', 'margoInput', 'margoStatus', 'margoClose']) {
    assert.match(html, new RegExp(`id="${id}"`), `Missing #${id}`);
  }
});

test('shared data declares each global once', () => {
  const names = [...read('js/data.js').matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  assert.equal(new Set(names).size, names.length, `Duplicate globals: ${names}`);
});
