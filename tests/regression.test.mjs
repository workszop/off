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

// A small office for the simulation: the real room size, a desk block, the
// furniture spots events need, and the door staff come and go through.
function testOffice(seed, phase = 'midday') {
  const nav = new NavGrid({ x0: -6, z0: -4, x1: 6, z1: 4, cell: 0.2 });
  nav.blockRect(-4.5, -3.6, -2.5, -2.4, 0.24);
  const spots = [
    { x: -3.5, z: -2.0, heading: Math.PI, type: 'desk_cluster' },
    { x: 4.6, z: -2.5, heading: Math.PI / 2, type: 'coffee_station' },
    { x: 3.2, z: -2.0, heading: Math.PI / 2, type: 'table_cafe' },
    { x: 5.0, z: 2.0, heading: 0, type: 'armchair' },
    { x: 3.4, z: 2.2, heading: 0, type: 'couch_2seater' },
    { x: -1.6, z: -3.0, heading: Math.PI, type: 'printer' },
    { x: -4.3, z: 1.5, heading: -Math.PI / 2, type: 'whiteboard' },
    { x: 0, z: -3.3, heading: Math.PI, type: 'window' },
    { x: -2.0, z: 3.3, heading: 0, type: 'door' },
    { x: -3.5, z: -3.0, heading: 0, type: 'plant_snake' }, // inside the desk: must be dropped
  ];
  const landmarks = { lamp: { x: 2, z: 1 }, whiteboard: { x: -5.1, z: 1.2 }, printer: { x: -1.65, z: -3.55 } };
  const clock = { phase };
  const sim = createSim({ nav, spots, types: CAST, phase: () => clock.phase, landmarks, random: seeded(seed) });
  const run = seconds => { for (let i = 0; i < seconds * 30; i++) sim.update(1 / 30); };
  return { nav, sim, clock, run, who: type => sim.cast.find(c => c.type === type) };
}

// Every line anyone can say, to check speech comes from the written banks.
const ALL_LINES = new Set();
(function collect(value) {
  if (typeof value === 'string') ALL_LINES.add(value);
  else if (value && typeof value === 'object' && !(value instanceof RegExp)) Object.values(value).forEach(collect);
})(data);

test('the simulation runs without a browser: the cast walks, stays on the floor and talks', () => {
  const { nav, sim } = testOffice(7);
  assert.equal(sim.spots.length, 9, 'spots inside furniture are not used');
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
        assert.ok(ALL_LINES.has(c.line), `${c.type} said an unknown line: ${c.line}`);
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
  const { sim, run, who } = testOffice(11, 'night');
  const ghost = who('ghost');
  assert.equal(ghost.present, false);
  assert.equal(ghost.opacity, 0);
  const due = sim.ghostDueIn();
  assert.ok(due >= 30 && due <= 90, `first visit should be 30-90 s away, got ${due}`);
  sim.haunt();
  assert.equal(sim.ghostDueIn(), 0);
  run(3);
  assert.equal(ghost.present, true);
  assert.equal(ghost.opacity, 1);
  for (let i = 0; i < 120 * 30 && ghost.present; i++) sim.update(1 / 30);
  assert.equal(ghost.present, false, 'the ghost dissolves when the haunt is over');
  assert.equal(ghost.line, null);
  assert.ok(sim.log.some(e => e.kind === 'ghost'), 'the visit is in the diary');
});

test('a character talking to the visitor stops and turns to face them', () => {
  const { sim, run, who } = testOffice(3);
  const margo = who('margo');
  run(10);
  margo.talkingToVisitor = true;
  sim.visitor.x = margo.pos.x;
  sim.visitor.z = margo.pos.y + 10;
  run(4);
  assert.ok(margo.speed < 0.02, 'Margo stands still');
  assert.ok(Math.abs(Math.sin(margo.heading)) < 0.05 && Math.cos(margo.heading) > 0.99, 'Margo faces the visitor');
  assert.ok(sim.say(margo, 'Status: tested.') > 0);
  assert.equal(margo.line, 'Status: tested.');
});

test('needs send people to the right furniture', () => {
  const { sim, who } = testOffice(5);
  const andy = who('andy');
  Object.assign(andy.needs, { coffee: 1, focus: 0, rest: 0, social: 0 });
  andy.wait = 0;
  for (let i = 0; i < 40 * 30 && !(andy.goal === 'coffee' && !andy.path.length); i++) sim.update(1 / 30);
  assert.equal(andy.goal, 'coffee');
  assert.ok(['coffee_station', 'table_cafe'].includes(andy.spot?.type), `Andy went to ${andy.spot?.type}`);
  assert.ok(andy.needs.coffee < 0.2, 'having coffee settles the need');
});

test('staff go home in the evening and at night, and come back in the morning', () => {
  const { sim, clock, run, who } = testOffice(9);
  const inRoom = () => sim.cast.filter(c => c.present && c.type !== 'ghost').map(c => c.type).sort();
  assert.deepEqual(inRoom(), ['andy', 'jazz', 'margo', 'olex']);
  clock.phase = 'evening';
  run(150);
  assert.deepEqual(inRoom(), ['andy', 'margo', 'olex'], 'Jazz leaves first');
  assert.equal(who('jazz').opacity, 0);
  clock.phase = 'night';
  run(150);
  assert.deepEqual(inRoom(), ['margo'], 'only Margo is left at night');
  clock.phase = 'morning';
  run(60);
  assert.deepEqual(inRoom(), ['andy', 'jazz', 'margo', 'olex']);
  const shifts = sim.log.filter(e => e.kind === 'shift').map(e => e.text);
  assert.ok(shifts.includes('Jazz went home.') && shifts.includes('Jazz came in.'), shifts.join(' '));

  // Opening the office at night: the staff are already gone.
  const night = testOffice(9, 'night');
  assert.deepEqual(night.sim.cast.filter(c => c.present).map(c => c.type), ['margo']);
});

test('a chat on a topic keeps both speakers on it', () => {
  const { TOPICS, DIALOGUE_BANKS } = data;
  for (const t of TOPICS) {
    const speakers = ['andy', 'jazz', 'olex'].filter(type => DIALOGUE_BANKS[type].filter(l => t.match.test(l)).length >= 2);
    assert.ok(speakers.length >= 1, `nobody can open a chat about ${t.label}`);
  }
  const { sim } = testOffice(21);
  const said = new Map();
  for (let i = 0; i < 600 * 30; i++) {
    sim.update(1 / 30);
    for (const c of sim.cast) if (c.chat?.topic && c.line && c.chat.order) said.set(c.line, c.chat.topic);
  }
  const topical = sim.log.filter(e => e.kind === 'chat');
  assert.ok(topical.length >= 2, 'some chats should have a subject');
  assert.match(topical[0].text, /^\w+ and \w+ talked about .+\.$/);
  const onTopic = [...said].filter(([line, topic]) => topic.match.test(line)).length;
  assert.ok(onTopic / said.size > 0.6, `${onTopic} of ${said.size} chat lines were on their topic`);
});

test('the printer jams, people gather, and Margo fixes it', () => {
  const { sim, run, who } = testOffice(13);
  run(5);
  assert.equal(sim.trigger('printerJam'), true);
  assert.equal(sim.state.printerJammed, true);
  assert.equal(sim.event, 'printerJam');
  assert.equal(sim.trigger('meeting'), false, 'one event at a time');
  const margo = who('margo');
  const heard = new Set();
  for (let i = 0; i < 60 * 30 && sim.event; i++) { sim.update(1 / 30); if (margo.line) heard.add(margo.line); }
  assert.equal(sim.state.printerJammed, false);
  assert.equal(sim.event, null);
  for (const line of data.MARGO_LINES.printerFix) assert.ok(heard.has(line), `Margo should say: ${line}`);
  assert.ok(sim.cast.every(c => !c.busy), 'everyone is released afterwards');
  const texts = sim.log.map(e => e.text);
  assert.ok(texts.includes('The printer jammed.') && texts.some(t => t.startsWith('Margo fixed the printer')));
});

test('a dropped donut starts a race with one winner', () => {
  for (const seed of [2, 3, 4, 5, 6]) {
    const { sim, run } = testOffice(seed);
    run(5);
    assert.equal(sim.dropDonut(1, 1), true);
    assert.deepEqual(sim.state.donut, { x: 1, z: 1 });
    for (let i = 0; i < 45 * 30 && sim.event; i++) sim.update(1 / 30);
    assert.equal(sim.state.donut, null);
    assert.equal(sim.log.filter(e => /won the donut race/.test(e.text)).length, 1, `seed ${seed}: ${sim.log.map(e => e.text).join(' | ')}`);
    assert.ok(sim.cast.every(c => !c.busy));
  }
});

test('meetings and birthdays gather the office and end', () => {
  for (const [type, kind] of [['meeting', 'meeting'], ['birthday', 'birthday']]) {
    const { sim, run } = testOffice(17);
    run(5);
    assert.equal(sim.trigger(type), true, `${type} should start`);
    const members = sim.cast.filter(c => c.busy);
    assert.ok(members.length >= 3, `${type} gathers the staff`);
    if (type === 'birthday') assert.ok(sim.state.cake, 'there is cake');
    const spoke = new Set();
    for (let i = 0; i < 80 * 30 && sim.event; i++) { sim.update(1 / 30); for (const c of members) if (c.line) spoke.add(c.type); }
    assert.equal(sim.event, null, `${type} should end`);
    assert.equal(sim.state.cake, null);
    assert.ok(spoke.size >= 2, `${type}: people speak`);
    assert.ok(sim.log.some(e => e.kind === kind));
  }
});

test('tapping the glass and poking a character get a reaction', () => {
  const { sim, run, who } = testOffice(19);
  run(6);
  sim.visitor.x = 0;
  sim.visitor.z = 12;
  assert.equal(sim.tapGlass(), true);
  assert.equal(sim.tapGlass(), false, 'taps have a short cooldown');
  const lines = new Set();
  for (let i = 0; i < 4 * 30; i++) { sim.update(1 / 30); for (const c of sim.cast) if (c.line) lines.add(c.line); }
  const tapLines = [...data.MARGO_LINES.tapGlass, ...Object.values(data.GLASS_TAP_DIALOGUE).flat()];
  assert.ok([...lines].some(l => tapLines.includes(l)), 'someone reacts to the tap');
  assert.ok(sim.log.some(e => e.kind === 'tap'));
  const olex = who('olex');
  run(8);
  const before = olex.lineSeq;
  assert.equal(sim.poke(olex), true);
  assert.ok(olex.lineSeq > before || olex.line, 'a poked character says something');
  assert.equal(sim.poke(who('ghost')), false, 'nobody to poke when the ghost is away');
});

test('events happen on their own and every phase has a staff list', () => {
  for (const p of data.DAY_PHASES) {
    assert.ok(Array.isArray(p.staff), `${p.key} needs a staff list`);
    assert.ok(p.staff.every(type => ['andy', 'jazz', 'olex'].includes(type)));
  }
  const { sim } = testOffice(23);
  const kinds = new Set();
  for (let i = 0; i < 900 * 20; i++) { sim.update(1 / 20); if (sim.event) kinds.add(sim.event); }
  assert.ok(kinds.size >= 2, `expected a few different events in 15 minutes, got ${[...kinds]}`);
  assert.ok(sim.cast.every(c => !c.busy || sim.event), 'nobody is left stuck in a finished event');
});

test('the page offers follow, poke, sound and diary controls', () => {
  const html = read('index.html');
  for (const type of ['', ...CAST]) assert.match(html, new RegExp(`data-focus="${type}"`), `Missing follow button: ${type || 'everyone'}`);
  for (const hook of ['data-spin', 'data-action="tap"', 'data-action="donut"', 'id="soundToggle"', 'id="logToggle"', 'id="dayLog"', 'id="dayLogList"']) {
    assert.ok(html.includes(hook), `Missing ${hook}`);
  }
  assert.match(read('src/office3d/margo-chat.js'), /context: getContext\(\)/, 'the chat sends the office context');
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
  for (const file of ['data.js', 'nav.js', 'sim.js', 'events.js']) {
    const source = read(`src/office3d/${file}`);
    assert.doesNotMatch(source, /from 'three|\b(?:document|window)\.[A-Za-z]/, `${file} must stay free of Three.js and the DOM`);
  }
});
