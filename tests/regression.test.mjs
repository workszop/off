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
  const propDecl = source.match(/^const PROP_FRAMES = [^;]+;/m)?.[0];
  const spriteDecl = source.match(/export function spriteUrl\(type, view, frame\) \{[\s\S]*?\n\}/)?.[0]?.replace('export ', '');
  const frameDecl = source.match(/function frameNames\(type\) \{[\s\S]*?\n\}/)?.[0];
  const actDecl = source.match(/^export const ACT_LOOPS = \{[\s\S]*?\n\};/m)?.[0]?.replace('export ', '') ?? 'const ACT_LOOPS = undefined;';
  assert.ok(rootDecl && spriteDecl && frameDecl, 'standee sprite helpers must remain extractable');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${rootDecl}\n${propDecl}\n${actDecl}\n${spriteDecl}\n${frameDecl}\nthis.spriteUrl = spriteUrl; this.frameNames = frameNames; this.ACT_LOOPS = ACT_LOOPS;`, context);
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
  assert.equal(spriteUrl('margo', 'front', 'walk_01'), 'assets/sprites/zine/margo-v3/front_walk_01.webp?v=detail-1');
  for (const type of ['andy', 'jazz', 'olex', 'ghost']) {
    assert.equal(spriteUrl(type, 'threequarter', 'walk_03'), `assets/sprites/zine/${type}/threequarter_walk_03.webp?v=detail-1`);
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
        const path = join(ROOT, url.split('?')[0]);
        assert.ok(existsSync(path) && statSync(path).size > 0, `Missing sprite: ${url}`);
        assert.deepEqual(webpSize(path), [1280, 1920], `${url} must be 1280x1920`);
      }
    }
  }
});

test('dance motion jumps, lands and completes a smooth full turn', () => {
  const source = read('src/characters3d/standee.js');
  const helper = source.match(/export function danceMotion\(beat\) \{[\s\S]*?\n\}/);
  assert.ok(helper, 'dance motion must be independently testable');
  const motion = vm.runInNewContext(helper[0].replace('export ', '') + '; danceMotion');
  assert.equal(motion(0).jump, 0);
  assert.ok(motion(0.35).jump >= 0.2, 'jump clearly leaves the floor');
  assert.equal(motion(1).jump, 0, 'lands before the next beat');
  assert.equal(motion(2).turn, 0);
  assert.ok(Math.abs(motion(3).turn - Math.PI) < 1e-9, 'turns right around');
  assert.ok(motion(3.999).turn > Math.PI * 1.99);
  assert.equal(motion(4).turn, 0, 'loop returns facing forward');
  for (let beat = 0; beat < 8; beat += 0.05) {
    assert.ok(motion(beat).jump >= 0 && motion(beat).jump <= 0.22 + 1e-12);
  }
});

test('every character has a complete front/back party dance loop', () => {
  const source = read('src/characters3d/standee.js');
  assert.match(source, /const DANCE_BPM = 124/);
  assert.match(source, /const DANCE_FRAMES = \[[\s\S]*'dance_08',[\s\S]*\]/);
  assert.match(source, /const DANCE_FRAME_S = DANCE_BEAT_S \* DANCE_CYCLE_BEATS \/ DANCE_FRAMES.length/);
  assert.match(source, /const loadDance = \(\) =>/);
  assert.match(source, /loadFrames\(DANCE_FRAMES, \['front', 'back'\]\)/);
  assert.match(source, /rear\.rotation\.y = Math\.PI/);
  assert.match(source, /setDancing\(on\)/);
  assert.match(read('src/office3d/office.js'), /setDancing\(partyOn && c\.present && c\.speed <= 0\.15\)/);
  const { spriteUrl } = loadSpriteHelpers();
  for (const type of CAST) {
    for (const view of ['front', 'back']) {
      for (const frame of Array.from({ length: 8 }, (_, index) => `dance_${String(index + 1).padStart(2, '0')}`)) {
        const url = spriteUrl(type, view, frame);
        const path = join(ROOT, url.split('?')[0]);
        assert.ok(existsSync(path) && statSync(path).size > 0, `Missing dance sprite: ${url}`);
        assert.deepEqual(webpSize(path), [640, 960], `${url} must be 640x960`);
      }
    }
  }
});

test('standees have an eight-frame act loop with its own art revision for every show act', () => {
  const { ACT_LOOPS, spriteUrl } = loadSpriteHelpers();
  assert.ok(ACT_LOOPS?.band, 'ACT_LOOPS.band must exist');
  assert.equal(ACT_LOOPS.band.bpm, 132);
  assert.ok(ACT_LOOPS?.xmas, 'ACT_LOOPS.xmas must exist');
  assert.equal(ACT_LOOPS.xmas.bpm, 104);
  assert.equal(ACT_LOOPS.xmas.revision, 'xmas-1');
  assert.ok(ACT_LOOPS?.murder && ACT_LOOPS?.body, 'the murder mystery has an investigating act and a lying body');
  assert.deepEqual([ACT_LOOPS.murder.bpm, ACT_LOOPS.murder.cycleBeats, [...ACT_LOOPS.murder.views], ACT_LOOPS.murder.revision],
    [92, 4, ['front', 'back'], 'murder-1']);
  assert.deepEqual([ACT_LOOPS.body.bpm, ACT_LOOPS.body.cycleBeats, [...ACT_LOOPS.body.views], ACT_LOOPS.body.lay, ACT_LOOPS.body.revision],
    [92, 8, ['front'], true, 'body-1'], 'the body twitches slowly, lying, drawn from above only');
  for (const [name, loop] of Object.entries(ACT_LOOPS)) {
    assert.deepEqual([...loop.frames], Array.from({ length: 8 }, (_, i) => `${name}_0${i + 1}`), name);
    assert.ok([4, 8].includes(loop.cycleBeats), `${name}: a loop spans four or eight beats`);
    // Front and back, or one drawn view; a lying act shows only its front (the card's face is up).
    assert.ok(['front,back', 'front'].includes([...loop.views].join()), `${name}: views ${loop.views}`);
    if (loop.lay) assert.deepEqual([...loop.views], ['front'], `${name}: a lying act has one view`);
    else assert.equal(loop.lay, undefined, `${name}: only lying acts say so`);
    assert.equal(loop.revision, `${name}-1`, name);
    for (const view of loop.views) {
      assert.ok(spriteUrl('olex', view, `${name}_03`).endsWith(`zine/olex/${view}_${name}_03.webp?v=${name}-1`));
      assert.ok(spriteUrl('margo', view, `${name}_01`).endsWith(`zine/margo-v3/${view}_${name}_01.webp?v=${name}-1`));
    }
  }
  // Every act a show casts has its art, in every view it is drawn in.
  for (const [key, spec] of Object.entries(data.SHOWS)) {
    for (const [type, role] of Object.entries(spec.roles)) {
      const folder = type === 'margo' ? 'margo-v3' : type;
      for (const view of ACT_LOOPS[role.act].views) {
        for (const frame of ACT_LOOPS[role.act].frames) {
          assert.ok(existsSync(join(ROOT, 'assets/sprites/zine', folder, `${view}_${frame}.webp`)), `${key}: ${folder}/${view}_${frame}`);
        }
      }
    }
  }
  assert.ok(spriteUrl('andy', 'front', 'idle').endsWith('?v=detail-1'), 'idle art keeps its revision');
  assert.match(read('src/office3d/office.js'), /setDancing\(partyOn && c\.present && c\.speed <= 0\.15\)/);
  const standee = read('src/characters3d/standee.js');
  assert.match(standee, /const loadAct = name =>/);
  assert.match(standee, /setAct\(name, \{ playing = true \} = \{\}\)/);
  assert.match(read('src/characters3d/showcase.js'), /loadAct\(/, 'the showcase can preview an act with ?act=');
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
  assert.match(source, /loadFirst = \(\) => \(firstLoad \?\?= loadFrames\(\['idle'\], \['front'\]\)\)/, 'the first stage is the front idle only');
  assert.match(office, /firstArt\.then\(\(\) => document\.getElementById\('loading'\)\?\.remove\(\)\)/, 'the office opens on the front drawings');
  assert.match(office, /artReady = firstArt\.then\(/, 'the other standing views load after the first');
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

  // Leaving together never jams at the door.
  for (let seed = 30; seed < 70; seed++) {
    const office = testOffice(seed);
    office.run(40 + seed * 3);
    office.clock.phase = 'night';
    office.run(160);
    const left = office.sim.cast.filter(c => c.present && c.type !== 'ghost' && c.type !== 'margo').map(c => c.type);
    assert.deepEqual(left, [], `seed ${seed}: still in at night`);
  }

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

test('topic patterns match whole words, not parts of other words', () => {
  const topic = key => data.TOPICS.find(t => t.key === key).match;
  assert.doesNotMatch('My coat has had three compliments today.', topic('vegans'));
  assert.doesNotMatch('My throat is still recovering.', topic('vegans'));
  assert.match('Oat milk foam is an art form.', topic('vegans'));
  assert.doesNotMatch('There is no consensus algorithm for the air conditioning.', topic('tiktok'));
  assert.doesNotMatch('I booked the table.', topic('books'));
  assert.doesNotMatch('Answered promptly.', topic('ai'));
  assert.doesNotMatch('The socket is loose.', topic('clothes'));
});

test('nobody says the same line twice in a row, even from a small set', () => {
  const { sim, run, who } = testOffice(29);
  run(5);
  const olex = who('olex');
  let last = null;
  for (let i = 0; i < 40; i++) {
    olex.sayUntil = 0;           // ready to speak again
    olex.look = null;
    assert.equal(sim.poke(olex), true);
    assert.notEqual(olex.line, last, 'a poke should not repeat the previous line');
    last = olex.line;
  }
  // Margo's glass-tap set has only three lines.
  const margo = who('margo');
  last = null;
  for (let i = 0; i < 12; i++) {
    margo.sayUntil = 0;
    assert.equal(sim.poke(margo), true);
    assert.ok(data.MARGO_LINES.tapGlass.includes(margo.line));
    assert.notEqual(margo.line, last);
    last = margo.line;
  }
});

test('joining an event stops what a character was doing', () => {
  const { sim, run, who } = testOffice(31);
  run(3);
  const andy = who('andy');
  Object.assign(andy.needs, { coffee: 1, focus: 0, rest: 0, social: 0 });
  andy.wait = 0;
  for (let i = 0; i < 20 * 30 && !(andy.goal === 'coffee' && andy.path.length); i++) sim.update(1 / 30);
  assert.ok(andy.path.length, 'Andy is on his way to coffee');
  assert.equal(sim.trigger('meeting'), true);
  assert.ok(andy.busy, 'Andy is in the meeting');
  assert.equal(andy.goal, null, 'the coffee run is dropped');
  for (let i = 0; i < 12 * 30; i++) sim.update(1 / 30);
  assert.ok(Math.hypot(andy.pos.x - -4.3, andy.pos.y - 1.5) < 2.2, 'Andy went to the whiteboard, not the coffee');
});

test('a birthday that cannot start does not use up the day\'s birthday', () => {
  const { sim, clock, run } = testOffice(33, 'night');
  run(2);
  assert.equal(sim.trigger('birthday'), false, 'no guests at night');
  clock.phase = 'midday';
  run(60);
  for (let i = 0; i < 60 * 30 && sim.event; i++) sim.update(1 / 30);
  assert.equal(sim.trigger('birthday'), true, 'the birthday can still happen later');
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
    assert.equal(sim.state.donutWins, 1, 'the page plays the win sound once');
    assert.equal(sim.log.filter(e => /won the donut race/.test(e.text)).length, 1, `seed ${seed}: ${sim.log.map(e => e.text).join(' | ')}`);
    assert.ok(sim.cast.every(c => !c.busy));
  }
  // Dropped anywhere, in a full office, somebody always gets it.
  for (let seed = 40; seed < 70; seed++) {
    const { sim, run } = testOffice(seed);
    run(8);
    for (let i = 0; i < 60 * 30 && sim.event; i++) sim.update(1 / 30);
    assert.equal(sim.dropDonut(), true);
    for (let i = 0; i < 45 * 30 && sim.event; i++) sim.update(1 / 30);
    assert.equal(sim.state.donutWins, 1, `seed ${seed}: ${sim.log.at(-1)?.text}`);
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
  for (const hook of ['data-spin', 'data-party', 'data-action="tap"', 'id="soundToggle"', 'id="logToggle"', 'id="dayLog"', 'id="dayLogList"']) {
    assert.ok(html.includes(hook), `Missing ${hook}`);
  }
  assert.match(read('src/office3d/margo-chat.js'), /context: getContext\(\)/, 'the chat sends the office context');
});

test('the inside view keeps the camera in the room and every gesture live', async () => {
  const { insideBounds, reach, insideDistance, insetPoint } = await import('../src/office3d/view.js');
  const room = { W: 12, D: 8, H: 2.5, HI: 3.6 };
  const b = insideBounds(room);
  const target = { x: 0, y: 1, z: -0.2 };
  const inRoom = p => Math.abs(p.x) <= b.x + 1e-9 && Math.abs(p.z) <= b.z + 1e-9 && p.y >= b.y0 - 1e-9 && p.y <= b.y1 + 1e-9;
  const cameraAt = (off, zoom) => {
    const len = Math.hypot(off.x, off.y, off.z), dist = insideDistance(target, off, b, zoom);
    return { dist, x: target.x + off.x / len * dist, y: target.y + off.y / len * dist, z: target.z + off.z / len * dist };
  };
  // Any turn, tilt and zoom the controls allow lands inside the walls, under the ceiling.
  let last = null;
  for (let turn = 0; turn < Math.PI * 2; turn += 0.05) {
    for (const tilt of [0.9, 1.36, 1.68]) {
      const off = { x: Math.sin(tilt) * Math.sin(turn) * 9, y: Math.cos(tilt) * 9, z: Math.sin(tilt) * Math.cos(turn) * 9 };
      for (const zoom of [0, 0.5, 1]) assert.ok(inRoom(cameraAt(off, zoom)), `camera left the room at turn ${turn.toFixed(2)}, tilt ${tilt}`);
      // Zooming always moves the camera.
      assert.ok(cameraAt(off, 1).dist > cameraAt(off, 0.5).dist && cameraAt(off, 0.5).dist > cameraAt(off, 0).dist);
      if (tilt === 1.36) {
        // Turning always moves it too: no dead zone in a corner.
        const now = cameraAt(off, 1);
        if (last) assert.ok(Math.hypot(now.x - last.x, now.z - last.z) > 0.01, `turning stalled at ${turn.toFixed(2)}`);
        last = now;
      }
    }
  }
  assert.equal(reach(target, { x: 1, y: 0, z: 0 }, b), b.x);
  // A followed character at the wall: the look-at point stays far enough in for a camera behind it.
  const p = insetPoint(5.9, -3.9, b);
  assert.ok(b.x - p.x >= 1.2 && b.z + p.z >= 1.2);
  assert.doesNotMatch(read('src/office3d/view.js'), /from 'three|\b(?:document|window)\.[A-Za-z]/, 'view.js must stay free of Three.js and the DOM');
});

test('the page has a Director button and no outside view', () => {
  const html = read('index.html');
  assert.match(html, /data-director/, 'Missing the Director button');
  assert.match(html, /data-pov/, 'Missing the First person button');
  assert.doesNotMatch(html, /data-view=/, 'The outside view is gone');
  assert.doesNotMatch(read('src/office3d/director.js'), /from 'three|\b(?:document|window)\.[A-Za-z]/, 'director.js must stay free of Three.js and the DOM');
});

test('a show opens on a frontal shot and the director keeps to frontal views', async () => {
  const { createDirector } = await import('../src/office3d/director.js');
  const { insideBounds } = await import('../src/office3d/view.js');
  const director = createDirector({ bounds: insideBounds({ W: 12, D: 8, HI: 3.6 }), random: seeded(9) });
  // Let the camera wander off to a side wall first.
  let shot;
  for (let i = 0; i < 240 * 30; i++) shot = director.update(directorScene(), 1 / 30);
  const cutsBefore = shot.cut;
  const band = (extra = {}) => directorScene({
    cast: directorScene().cast.map((c, i) => ({ ...c, ...(extra.chat && i < 2 ? { chat: extra.chat, speaking: i === 0, lineSeq: 1 } : {}) })),
    events: { ...directorScene().events, show: { x: -0.3, z: -0.8 } },
    star: extra.star ?? '',
  });
  shot = director.update(band(), 1 / 30);
  assert.equal(shot.cut, cutsBefore + 1, 'the show starts with a cut');
  assert.ok(Math.abs(shot.pos.x) < 0.5 && shot.pos.z > 3.3, `the opening shot is square on from the front: ${JSON.stringify(shot.pos)}`);
  assert.equal(shot.on, 'show');
  assert.ok(Math.hypot(shot.target.x + 0.3, shot.target.z + 0.8) < 0.2, 'and looks at the band at once');
  // Ten minutes of show, with chats starting and a character picked in the toolbar.
  const places = new Set();
  let travelled = 0, last = shot.pos;
  for (let i = 1; i <= 600 * 30; i++) {
    shot = director.update(band({ chat: `c${Math.floor(i / 600)}`, star: 'olex' }), 1 / 30);
    assert.equal(shot.kind, 'roam', 'no cut-away during a show');
    assert.equal(shot.on, 'show', 'the camera stays on the band');
    assert.ok(shot.pos.z > 3.3 && Math.abs(shot.pos.x) <= 1.3, `a show shot left the front: ${JSON.stringify(shot.pos)}`);
    travelled += Math.hypot(shot.pos.x - last.x, shot.pos.z - last.z); last = shot.pos;
    places.add(Math.round(shot.pos.x * 2) / 2);
  }
  assert.equal(shot.cut, cutsBefore + 1, 'and never cuts again');
  assert.ok(travelled > 2 && places.size >= 3, 'it still moves between frontal places');
  // When the show is over the camera roams the whole room again.
  let wide = false;
  for (let i = 0; i < 600 * 30 && !wide; i++) wide = Math.abs(director.update(directorScene(), 1 / 30).pos.x) > 3;
  assert.ok(wide, 'after the show the camera goes back to the sides');
});

// A scene for the director: two people a metre apart in the middle of the room.
function directorScene(overrides = {}) {
  const person = (type, x, z, extra = {}) => ({ type, x, z, heading: 0, present: true, visible: true, speaking: false, lineSeq: 0, chat: null, turnsLeft: 0, withVisitor: false, ...extra });
  return {
    aspect: 1.6, star: '',
    cast: [person('andy', -0.5, 0), person('jazz', 0.5, 0), person('olex', 4, -2)],
    events: { donut: null, cake: null, printer: null, lamp: null, meeting: null },
    ...overrides,
  };
}

test('a character can be steered by hand, round the furniture, and then goes their own way', () => {
  const { nav, sim, run, who } = testOffice(5);
  const andy = who('andy');
  // Stand him in open floor, facing along +x, and walk him forward.
  Object.assign(andy, { heading: Math.PI / 2, path: [], chat: null, busy: null });
  andy.pos.x = -1; andy.pos.y = 0.3;
  assert.ok(nav.freeAt(-1, 0.3) && nav.freeAt(0.5, 0.3), 'the test needs open floor');
  sim.drive('andy', 1, 0);
  run(1);
  assert.ok(andy.driving, 'he is in the visitor\'s hands');
  assert.ok(andy.pos.x > -0.4 && Math.abs(andy.pos.y - 0.3) < 0.05, `forward follows his heading (now at ${andy.pos.x.toFixed(2)}, ${andy.pos.y.toFixed(2)})`);
  // Turning left swings the heading round; backwards is slower than forwards.
  const before = andy.heading;
  sim.drive('andy', 0, 1);
  run(0.5);
  assert.ok(andy.heading > before + 0.8, 'left turns him left');
  // However long he is pushed at a wall, he never leaves the floor he can walk on.
  sim.drive('andy', 1, 0);
  for (let i = 0; i < 20 * 30; i++) { sim.update(1 / 30); assert.ok(nav.freeAt(andy.pos.x, andy.pos.y), 'steered into something solid'); }
  // Released: he waits a moment, then takes up his own day again.
  sim.drive(null);
  run(0.2);
  assert.equal(andy.driving, false);
  const left = { ...andy.pos };
  run(1);
  assert.ok(Math.hypot(andy.pos.x - left.x, andy.pos.y - left.y) < 0.2, 'left alone, he stands where he was left at first');
  run(40);
  assert.ok(Math.hypot(andy.pos.x - left.x, andy.pos.y - left.y) > 0.5 || andy.chat || andy.line !== null, 'and then goes back to his own day');
});

test('first person looks out of a character at eye height, the way they face', async () => {
  const { eyeView } = await import('../src/office3d/view.js');
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  // Facing the back wall (heading PI looks along -z).
  const v = eyeView({ type: 'jazz', x: 2, z: 1, heading: Math.PI });
  assert.ok(near(v.pos.y, 1.5) && Math.hypot(v.pos.x - 2, v.pos.z - 1) < 0.2, 'the camera is at her eyes');
  assert.ok(v.target.z < v.pos.z - 3 && Math.abs(v.target.x - v.pos.x) < 1e-6, 'looking where she faces');
  assert.ok(v.target.y < v.pos.y, 'and very slightly down');
  // The ghost is shorter; a turned head looks to the side; walking bobs.
  assert.ok(eyeView({ type: 'ghost', x: 0, z: 0, heading: 0 }).pos.y < 1);
  const turned = eyeView({ type: 'jazz', x: 2, z: 1, heading: Math.PI }, { yaw: Math.PI / 2, pitch: 0 });
  assert.ok(Math.abs(turned.target.x - turned.pos.x) > 3 && Math.abs(turned.target.z - turned.pos.z) < 1e-6);
  assert.ok(eyeView({ type: 'jazz', x: 0, z: 0, heading: 0 }, undefined, 0.01).pos.y > 1.5);
});

test('the director roams without cutting and gives one chat in 6 to 12 a cut', async () => {
  const { createDirector } = await import('../src/office3d/director.js');
  const { insideBounds } = await import('../src/office3d/view.js');
  const b = insideBounds({ W: 12, D: 8, HI: 3.6 });
  const director = createDirector({ bounds: b, random: seeded(4) });
  const inRoom = s => Math.abs(s.pos.x) <= b.x + 1e-6 && Math.abs(s.pos.z) <= b.z + 1e-6 && s.pos.y >= b.y0 && s.pos.y <= b.y1;
  const run = (scene, seconds) => { let s; for (let i = 0; i < seconds * 30; i++) { s = director.update(scene, 1 / 30); assert.ok(inRoom(s), `a ${s.kind} shot left the room`); } return s; };
  const chatting = (id, speaker) => {
    const scene = directorScene();
    for (const c of scene.cast.slice(0, 2)) Object.assign(c, { chat: id, speaking: c.type === speaker, lineSeq: c.type === speaker ? id : 0 });
    return scene;
  };

  // Nothing happening: the camera roams, and travels.
  let travelled = 0, last = run(directorScene(), 1).pos;
  for (let i = 0; i < 40; i++) {
    const s = run(directorScene(), 1);
    assert.equal(s.kind, 'roam');
    assert.equal(s.cut, 0, 'roaming never cuts');
    assert.ok(Math.hypot(s.pos.x - last.x, s.pos.z - last.z) <= 0.5, 'and never faster than a slow walk');
    travelled += Math.hypot(s.pos.x - last.x, s.pos.z - last.z);
    last = s.pos;
  }
  assert.ok(travelled > 2, `in 40 s the roaming camera should travel, got ${travelled.toFixed(1)} m`);

  // Chats come and go. The camera turns to them, and cuts to one in 6 to 12.
  const gaps = [];
  let since = 0, cut = 0;
  for (let id = 1; id <= 60; id++) {
    const before = director.shot.cut;
    const during = run(chatting(id, 'andy'), 12);
    since++;
    if (during.cut !== before) {
      assert.equal(during.kind, 'two', 'the cut goes to the two people chatting');
      assert.deepEqual(during.who, ['andy', 'jazz']);
      gaps.push(since);
      since = 0;
      cut = during.cut;
    } else {
      assert.equal(during.kind, 'roam');
      assert.equal(during.on, `chat:${id}`, 'the roaming camera has turned to the chat');
    }
    const after = run(directorScene(), 10);
    assert.equal(after.kind, 'roam', 'after a chat the camera is roaming again');
    assert.equal(after.cut, cut, 'and it glided back: no second cut');
  }
  assert.ok(gaps.length >= 5, `60 chats should bring several cuts, got ${gaps.length}`);
  for (const gap of gaps) assert.ok(gap >= 6 && gap <= 12, `a cut came after ${gap} chats`);
  assert.ok(new Set(gaps).size > 1, 'the number of chats between cuts varies');

  // Margo talking to the visitor has the camera for as long as it lasts.
  const visitor = directorScene();
  visitor.cast.push({ ...visitor.cast[2], type: 'margo', x: 2, z: 1, withVisitor: true });
  const withMargo = run(visitor, 3);
  assert.equal(withMargo.kind, 'visitor');
  assert.equal(withMargo.cut, cut + 1);
  assert.equal(run(visitor, 30).kind, 'visitor');
});

test('over ten minutes of office life the director cuts rarely and moves slowly', async () => {
  const { createDirector } = await import('../src/office3d/director.js');
  const { insideBounds } = await import('../src/office3d/view.js');
  const { sim } = testOffice(11);
  const director = createDirector({ bounds: insideBounds({ W: 12, D: 8, HI: 3.6 }), random: seeded(11) });
  const ids = new Map();
  let prev = null, cuts = 0, lastCutAt = -Infinity, closest = Infinity, fastest = 0, turns = 0, on = null;
  for (let i = 0; i < 600 * 30; i++) {
    sim.update(1 / 30);
    const shot = director.update({
      aspect: 1.6, star: '',
      cast: sim.cast.map(c => ({
        type: c.type, x: c.pos.x, z: c.pos.y, heading: c.heading, present: c.present, visible: c.opacity > 0.5,
        speaking: c.line !== null, lineSeq: c.lineSeq,
        chat: c.chat ? (ids.get(c.chat) ?? ids.set(c.chat, ids.size + 1).get(c.chat)) : null,
        turnsLeft: c.chat?.order.length ?? 0, withVisitor: false,
      })),
      events: { donut: sim.state.donut, cake: sim.state.cake, printer: null, lamp: null, meeting: null },
    }, 1 / 30);
    if (prev && shot.cut !== prev.cut) {
      cuts++;
      closest = Math.min(closest, i / 30 - lastCutAt);
      lastCutAt = i / 30;
    } else if (prev && shot.kind === 'roam' && prev.kind === 'roam') {
      fastest = Math.max(fastest, Math.hypot(shot.pos.x - prev.pos.x, shot.pos.z - prev.pos.z) * 30);
    }
    if (shot.kind === 'roam' && shot.on && shot.on !== on) turns++;
    on = shot.kind === 'roam' ? shot.on : on;
    prev = shot;
  }
  assert.ok(ids.size >= 10, 'the cast should have chatted');
  assert.ok(cuts >= 1 && cuts <= Math.ceil(ids.size / 6), `${cuts} cuts for ${ids.size} chats`);
  assert.ok(closest >= 8, `two cuts came ${closest.toFixed(1)} s apart`);
  assert.ok(fastest < 0.6, `the roaming camera reached ${fastest.toFixed(2)} m/s`);
  assert.ok(turns <= 600 / 8, `the camera turned to a new subject ${turns} times in ten minutes`);
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
  for (const file of ['data.js', 'nav.js', 'sim.js', 'events.js', 'shows.js']) {
    const source = read(`src/office3d/${file}`);
    assert.doesNotMatch(source, /from 'three|\b(?:document|window)\.[A-Za-z]/, `${file} must stay free of Three.js and the DOM`);
  }
});

test('the party keeps the whole team at work, even at night', () => {
  assert.ok(!data.DAY_PHASES.some(p => p.key === data.PARTY_PHASE.key), 'the party is not a time of day');
  assert.deepEqual([...data.PARTY_PHASE.staff].sort(), ['andy', 'jazz', 'olex']);
  const night = testOffice(5, 'night');
  night.run(90);
  assert.ok(['andy', 'jazz', 'olex'].every(t => !night.who(t).present), 'nobody works at night');
  const party = testOffice(5, 'night');
  party.clock.phase = 'party';
  party.run(90);
  assert.ok(['andy', 'jazz', 'olex'].every(t => party.who(t).present), 'everyone shows up for the party');
  party.clock.phase = 'night';
  party.run(90);
  assert.ok(['andy', 'jazz', 'olex'].every(t => !party.who(t).present), 'they go home when it ends');
});

test('party mode is wired in: look, moon, boombox, button, key and URL', () => {
  assert.match(read('src/office3d/lighting.js'), /^\s*party:\s+\{ sky:/m, 'a party look');
  const exterior = read('src/office3d/exterior.js');
  assert.match(exterior, /name = 'moon'/);
  assert.match(exterior, /new THREE\.Points\(/, 'stars');
  const sound = read('src/office3d/sound.js');
  for (const name of ['startMusic', 'stopMusic', 'duck', 'beat']) assert.match(sound, new RegExp(`\\b${name}\\(`), `sound.${name}`);
  const party = read('src/office3d/party.js');
  assert.match(party, /export function createParty/);
  assert.match(party, /new THREE\.PointLight/, 'the disco light');
  const office = read('src/office3d/office.js');
  assert.match(office, /e\.code === 'KeyP'/, 'the P key');
  assert.match(office, /params\.get\('party'\) === '1'/, '?party=1');
  assert.match(office, /sound\.duck\(open \? 0\.3 : 1\)/, 'music ducks while Margo is listened to');
  assert.match(read('index.html'), /<button data-party aria-pressed="false" disabled/, 'the Party button starts disabled');
  assert.match(office, /if \(on && !partyArtLoaded\) return;/, 'Party waits for the dance art');
  assert.match(office, /partyReady\.then\(\(\) => setParty\(true/, '?party=1 waits for the dance art');
});

// ---- Band show: set, look and track ----

// The LOOK table from lighting.js, evaluated without Three.js: the literal
// plus any looks derived from it afterwards (LOOK.band = { ...LOOK.evening }).
function loadLooks() {
  const source = read('src/office3d/lighting.js');
  const table = source.match(/^const LOOK = \{[\s\S]*?\n\};/m)?.[0];
  assert.ok(table, 'lighting.js keeps its LOOK table');
  const derived = source.match(/^LOOK\.\w+ = [^;]+;/gm) ?? [];
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${table}\n${derived.join('\n')}\nthis.LOOK = LOOK;`, context);
  return context.LOOK;
}

test('the band has its own look, an evening with the lights down', () => {
  const LOOK = loadLooks();
  assert.ok(LOOK.band, 'a band look');
  for (const key of Object.keys(LOOK.evening)) {
    if (!['hemiI', 'lamp', 'screens'].includes(key)) assert.deepEqual(LOOK.band[key], LOOK.evening[key], `LOOK.band.${key} comes from the evening`);
  }
  assert.equal(LOOK.band.hemiI, 0.9);
  assert.equal(LOOK.band.lamp, 0.5);
  assert.equal(LOOK.band.screens, 0.6);
});

test('Christmas has its own look, a cosy evening', () => {
  const LOOK = loadLooks();
  assert.ok(LOOK.xmas, 'a Christmas look');
  for (const key of Object.keys(LOOK.evening)) {
    if (!['hemiI', 'lamp', 'screens'].includes(key)) assert.deepEqual(LOOK.xmas[key], LOOK.evening[key], `LOOK.xmas.${key} comes from the evening`);
  }
  assert.equal(LOOK.xmas.hemiI, 0.8);
  assert.equal(LOOK.xmas.lamp, 0.6);
  assert.equal(LOOK.xmas.screens, 0.3);
});

test('the murder mystery has its own look, a cool noir night', () => {
  const LOOK = loadLooks();
  assert.ok(LOOK.murder, 'a murder look');
  for (const key of ['sky', 'sun', 'sunPos', 'hemiSky', 'hemiGround', 'bg']) assert.deepEqual(LOOK.murder[key], LOOK.night[key], `LOOK.murder.${key} comes from the night`);
  assert.ok(LOOK.murder.hemiI < LOOK.night.hemiI && LOOK.murder.lamp < LOOK.night.lamp, 'darker than the night, the lamp low');
  const rgb = hex => [hex >> 16, (hex >> 8) & 255, hex & 255];
  const [r, g, b] = rgb(LOOK.murder.tint);
  assert.ok(b > r && b > g, 'a bluish tint');
  assert.ok(Math.min(r, g, b) > 0xa8 && r > rgb(LOOK.night.tint)[0], 'the cast stays readable: the tint is lighter than the night\'s');
});

test('every show has a look with every key the party look has', () => {
  const LOOK = loadLooks();
  for (const show of Object.keys(data.SHOWS)) {
    assert.ok(LOOK[show], `LOOK.${show}`);
    for (const key of Object.keys(LOOK.party)) assert.ok(Object.hasOwn(LOOK[show], key), `LOOK.${show}.${key}`);
  }
});

test('every piece of every show set has a builder in stage.js', () => {
  const stage = read('src/office3d/stage.js');
  const builders = stage.match(/^const BUILDERS = \{([\s\S]*?)\n?\};/m)?.[1];
  assert.ok(builders, 'stage.js has a BUILDERS table');
  const keys = new Set([...builders.matchAll(/(\w+)\s*(?:[:,]|$)/gm)].map(m => m[1]));
  for (const [show, spec] of Object.entries(data.SHOWS)) {
    for (const { piece } of spec.set) assert.ok(keys.has(piece), `${show}: a builder for ${piece}`);
  }
  assert.match(stage, /export function createStage/);
  assert.match(stage, /new THREE\.SpotLight\(/, 'stage spotlights');
  const update = stage.match(/update\(show[\s\S]*?\n    subject\(/)?.[0];
  assert.ok(update, 'createStage has update() and subject()');
  assert.doesNotMatch(update, /new THREE\.\w*Light\(/, 'the lights are made once, not per frame');
  assert.doesNotMatch(update, /new THREE\.|\.clone\(\)/, 'nothing is allocated per frame');
  assert.doesNotMatch(stage, /castShadow\s*=\s*true/, 'the stage lights add no shadow maps');
  assert.match(stage, /animate\(/, 'built pieces animate through one hook');
  // Every footprint of every piece lies on the floor of the room and is small
  // enough not to wall anyone in; several small blocks go in `footprints`.
  for (const [show, spec] of Object.entries(data.SHOWS)) {
    for (const piece of spec.set) {
      for (const [x0, z0, x1, z1] of [piece.footprint, ...(piece.footprints ?? [])].filter(Boolean)) {
        assert.ok(x0 < x1 && z0 < z1 && x0 > -6 && x1 < 6 && z0 > -4 && z1 < 4, `${show}: ${piece.piece} footprint`);
      }
    }
  }
  assert.match(read('src/office3d/shows.js'), /piece\.footprints \?\? \[\]/, 'a piece may block several small squares');
});

test('a lying act lies flat on the floor and stands up again', () => {
  const standee = read('src/characters3d/standee.js');
  assert.match(standee, /const lying = acting && Boolean\(ACT_LOOPS\[state\.act\]\.lay\)/, 'only an act that shows (never a walker) lies');
  assert.match(standee, /turn\.rotation\.y = lying \? api\.heading : camYaw/, 'a lying card does not face the camera');
  assert.match(standee, /card\.rotation\.x = on \? -Math\.PI \/ 2 : 0/, 'face up, the head away from the heading');
  assert.match(standee, /card\.position\.y = lying \? LIE_Y : bob/, 'just above the floor, no bob');
  assert.match(standee, /for \(const m of fronts\) m\.castShadow = !on/, 'no tall shadow from a lying card');
  assert.match(standee, /function restPose\(\) \{[\s\S]*?stand\(\);\n  \}/, 'setAct(null) stands the card up');
  assert.match(standee, /actViews\.length === 1 \? actViews\[0\]/, 'an act drawn in one view always shows it');
});

test('every show has a button, an act for each role and a track at its own tempo', async () => {
  const html = read('index.html');
  const { ACT_LOOPS } = loadSpriteHelpers();
  const { TRACK_BPM, hasTrack } = await import('../src/office3d/sound.js');
  for (const [key, spec] of Object.entries(data.SHOWS)) {
    assert.equal(spec.key, key);
    assert.match(html, new RegExp(`<button data-show="${key}" aria-pressed="false" disabled[^>]*>${spec.label}</button>`), `a ${spec.label} button`);
    for (const role of Object.values(spec.roles)) assert.ok(ACT_LOOPS[role.act], `${key}: ACT_LOOPS.${role.act}`);
    if (hasTrack(key)) {
      assert.equal(TRACK_BPM[key], spec.bpm, `${key}: the track keeps the show's tempo`);
      for (const role of Object.values(spec.roles)) assert.equal(ACT_LOOPS[role.act].bpm, spec.bpm, `${key}: the art keeps the show's tempo`);
    }
  }
  assert.ok(hasTrack('xmas'), 'Christmas has a track');
  assert.ok(hasTrack('murder'), 'the murder mystery has a track');
  assert.match(html, /data-show="band"[^>]*>Band<\/button>\s*<button data-show="xmas"/, 'the Christmas button comes right after Band');
  assert.match(html, /data-show="xmas"[^>]*>Christmas<\/button>\s*<button data-show="murder"/, 'the Murder button comes right after Christmas');
  // Every act of every show keeps the show's tempo, and so does its track.
  for (const [key, spec] of Object.entries(data.SHOWS)) {
    const acts = new Set(Object.values(spec.roles).map(r => r.act));
    for (const act of acts) assert.equal(ACT_LOOPS[act].bpm, spec.bpm, `${key}: ACT_LOOPS.${act}.bpm`);
    if (hasTrack(key)) assert.equal(TRACK_BPM[key], spec.bpm, `${key}: TRACK_BPM`);
  }
  assert.deepEqual([TRACK_BPM.murder, data.SHOWS.murder.bpm, ACT_LOOPS.murder.bpm, ACT_LOOPS.body.bpm], [92, 92, 92, 92]);
  assert.deepEqual(Object.fromEntries(Object.entries(data.SHOWS.murder.roles).map(([t, r]) => [t, r.act])),
    { andy: 'body', jazz: 'murder', olex: 'murder', margo: 'murder' }, 'Andy plays the body, the others investigate');
});

test('the band track keeps time with the band art; Party keeps its own beat', async () => {
  const sound = read('src/office3d/sound.js');
  assert.match(sound, /startMusic\(track = 'party'\)/, 'startMusic() with no argument plays the party track');
  const { TRACK_BPM } = await import('../src/office3d/sound.js');
  assert.equal(TRACK_BPM.party, 124);
  assert.equal(TRACK_BPM.band, data.SHOWS.band.bpm);
  const { ACT_LOOPS } = loadSpriteHelpers();
  assert.equal(ACT_LOOPS.band.bpm, data.SHOWS.band.bpm);
});

// ---- Band show: the page ----

test('the Band button runs the show; a show and the party never overlap', () => {
  const office = read('src/office3d/office.js');
  assert.match(read('index.html'), /<button data-show="band" aria-pressed="false" disabled[^>]*>Band<\/button>/, 'the Band button starts disabled');
  assert.match(office, /^\s*if \(on\) setShow\(null\);/m, 'Party stops the show first');
  assert.match(office, /^\s*if \(partyOn\) setParty\(false\);/m, 'a show turns the party off first');
  assert.match(office, /params\.get\('show'\)/, '?show=band');
  assert.match(office, /createStage\(\{ scene/, 'the stage is in the scene');
  assert.match(office, /setAct\(show\?\.acts\[c\.type\] \?\? null, \{ playing: show\?\.beat === 'play' \}\)/, 'members play their act');
  assert.match(office, /loadAct\(/, 'the band art loads on demand');
  assert.match(office, /showKey && SHOWS\[showKey\]\.chatContext/, 'Margo knows about the show that runs');
  assert.doesNotMatch(office, /showKey === '\w+'|'(band|xmas|murder|body)'/, 'no show or act is named in the page code');
  assert.match(office, /loadAct\(SHOWS\[key\]\.roles\[c\.type\]\?\.act\)/, 'each character loads the act of their own role');
  assert.equal(data.SHOWS.band.chatContext, 'the staff have formed a garage band in the middle of the office');
  assert.match(office, /if \(beat === 'play' && hasTrack\(showKey\)\) sound\.startMusic\(showKey\);/, 'a show without a track is silent');
  assert.doesNotMatch(office, /e\.code === 'Key\w'[^\n]*setShow/, 'a show has no keyboard shortcut');
});

test('the director turns to a running show', async () => {
  const { createDirector } = await import('../src/office3d/director.js');
  const { insideBounds } = await import('../src/office3d/view.js');
  const director = createDirector({ bounds: insideBounds({ W: 12, D: 8, HI: 3.6 }), random: seeded(4) });
  const scene = directorScene();
  scene.events.show = { x: 0, z: -0.8 };
  let shot;
  for (let i = 0; i < 20 * 30; i++) shot = director.update(scene, 1 / 30);
  assert.equal(shot.kind, 'roam');
  assert.equal(shot.on, 'show', 'the roaming camera has turned to the band');
});
