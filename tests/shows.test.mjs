import test from 'node:test';
import assert from 'node:assert/strict';

const { NavGrid } = await import('../src/office3d/nav.js');
const { createSim } = await import('../src/office3d/sim.js');
const {
  SHOWS, BAND_LINES, BAND_REPORTS, XMAS_LINES, XMAS_REPORTS, MURDER_LINES, MURDER_REPORTS,
  GUEST, NAMES, DIALOGUE_BANKS, DIRECTED_LINES, ARRIVE_DIALOGUE, LEAVE_DIALOGUE, DAY_PHASES, PARTY_PHASE,
} = await import('../src/office3d/data.js');
const { createCarryController } = await import('../src/office3d/carry.js');
const { createShows } = await import('../src/office3d/shows.js');

// The staff office most of these tests run in. Mr. T, the guest, has his own
// tests at the end of the file, in an office with him in the cast (FULL_CAST).
const CAST = ['andy', 'jazz', 'olex', 'ghost', 'margo'];
const FULL_CAST = [...CAST, 'mrt'];

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// The same small office as tests/regression.test.mjs.
function testOffice(seed, phase = 'midday', types = CAST) {
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
    { x: -3.5, z: -3.0, heading: 0, type: 'plant_snake' },
  ];
  const landmarks = { lamp: { x: 2, z: 1 }, whiteboard: { x: -5.1, z: 1.2 }, printer: { x: -1.65, z: -3.55 } };
  const clock = { phase };
  const sim = createSim({ nav, spots, types, phase: () => clock.phase, landmarks, random: seeded(seed), guestRandom: seeded(seed * 31 + 5) });
  const run = seconds => { for (let i = 0; i < seconds * 30; i++) sim.update(1 / 30); };
  return { nav, sim, clock, run, spots, who: type => sim.cast.find(c => c.type === type) };
}

// Which cells are walkable, as a string: compares two moments of the floor.
const pathCells = nav => {
  let out = '';
  for (let r = 0; r < nav.rows; r++) for (let c = 0; c < nav.cols; c++) out += nav.free(c, r) ? '.' : '#';
  return out;
};

test('temporary blocks come and go without touching furniture', () => {
  const nav = new NavGrid({ x0: -6, z0: -4, x1: 6, z1: 4, cell: 0.2 });
  nav.blockRect(-4.5, -3.6, -2.5, -2.4, 0.24);
  const before = Uint8Array.from(nav.blocked);
  nav.blockTemp(-0.5, -0.5, 0.5, 0.5, 0.24);
  assert.equal(nav.freeAt(0, 0), false);
  const inBlock = ([x, z]) => Math.abs(x) < 0.5 && Math.abs(z) < 0.5;
  assert.equal(nav.path(-2, 0, 2, 0).some(inBlock), false);
  assert.deepEqual(nav.blocked, before);
  const [c, r] = nav.nearestFree(0, 0);
  assert.equal(nav.free(c, r), true);
  nav.clearTemp();
  assert.equal(nav.freeAt(0, 0), true);
  assert.deepEqual(nav.blocked, before);
  assert.equal(nav.freeAt(-3.5, -3.0), false);
});

test('the band show has its lines and diary entries', () => {
  for (const type of ['andy', 'jazz', 'olex', 'margo', 'mrt']) {
    assert.ok(BAND_LINES[type].length >= 4, type);
    for (const line of BAND_LINES[type]) assert.doesNotMatch(line, new RegExp(String.fromCharCode(0x2014)),`${type}: no em-dashes`);
  }
  assert.equal(BAND_REPORTS.length, 3);
  assert.deepEqual(Object.keys(SHOWS.band.roles).sort(), ['andy', 'jazz', 'margo', 'mrt', 'olex']);
});

test('the band takes its places and loops play and break', () => {
  const o = testOffice(7); o.run(5);
  assert.equal(o.sim.setShow('band'), true);
  assert.equal(o.sim.setShow('band'), false, 'one show at a time');
  assert.equal(o.sim.setShow('nope'), false);
  assert.equal(o.sim.show, 'band');
  o.clock.phase = 'band';
  o.run(30);
  for (const type of ['jazz', 'olex', 'andy', 'margo']) {
    const c = o.who(type), m = SHOWS.band.roles[type].mark;
    assert.ok(Math.hypot(c.pos.x - m.x, c.pos.y - m.z) < 0.25, type);
    assert.equal(o.sim.state.show.acts[type], 'band');
  }
  assert.equal(o.sim.state.show.acts.ghost, undefined);
  const beats = new Set();
  for (let i = 0; i < 100; i++) { o.run(1); beats.add(o.sim.state.show.beat); }
  assert.deepEqual([...beats].sort(), ['break', 'play']);
  assert.equal(o.sim.event, null);
});

test('stopping the show frees everyone and the floor', () => {
  const o = testOffice(7); const before = pathCells(o.nav);
  o.sim.setShow('band'); o.clock.phase = 'band'; o.run(3);    // still walking
  assert.notEqual(pathCells(o.nav), before, 'the set blocks the floor');
  o.sim.setShow(null); o.clock.phase = 'midday';
  assert.equal(o.sim.state.show, null);
  assert.equal(o.sim.show, null);
  assert.ok(o.sim.cast.every(c => !c.busy));
  assert.deepEqual(pathCells(o.nav), before);
  o.run(60);
  assert.ok(o.sim.cast.some(c => c.type !== 'ghost' && c.spot));   // back to a normal day
});

test('released members stop where they are', () => {
  const o = testOffice(7);
  o.sim.setShow('band'); o.clock.phase = 'band'; o.run(1);    // on their way to the marks
  const walking = o.sim.cast.filter(c => c.busy && c.path.length);
  assert.ok(walking.length > 0, 'someone is still walking to a mark');
  o.sim.setShow(null); o.clock.phase = 'midday';
  for (const c of walking) {
    assert.equal(c.path.length, 0, `${c.type} drops the walk to the mark`);
    assert.ok(Math.hypot(c.dest.x - c.pos.x, c.dest.z - c.pos.y) < 1e-9, `${c.type} stops on the spot`);
  }
});

test('a member who gives way to a bandmate on a mark still gets to their own', () => {
  const o = testOffice(7);
  o.sim.setShow('band'); o.clock.phase = 'band'; o.run(30);
  const andy = o.who('andy'), olex = o.who('olex'), mark = SHOWS.band.roles.andy.mark;
  assert.equal(o.sim.state.show.acts.olex, 'band', 'Olex stands on his mark');
  // Andy comes round the drum kit, past the front of Olex, to his mark on the left.
  Object.assign(andy, { path: [], wait: 0 });
  andy.pos.x = 1; andy.pos.y = 0;
  o.run(20);
  assert.ok(Math.hypot(andy.pos.x - mark.x, andy.pos.y - mark.z) < 0.25, `Andy reached his mark (at ${andy.pos.x.toFixed(2)}, ${andy.pos.y.toFixed(2)})`);
});

test('incidents come back after a show', () => {
  const o = testOffice(7); o.run(5);
  assert.equal(o.sim.trigger('meeting'), true);
  // The page may switch the phase first; either way the meeting ends because
  // start() stops the running incident.
  o.clock.phase = 'band'; o.sim.setShow('band'); o.run(240);
  assert.equal(o.sim.trigger('printerJam'), false, 'no incidents during a show');
  o.sim.setShow(null); o.clock.phase = 'midday';
  o.run(60);
  assert.equal(o.sim.event, null, 'a normal gap first, not straight away');
  let seen = false;
  for (let i = 0; i < 600 && !seen; i++) { o.run(1); seen = o.sim.event !== null; }
  assert.ok(seen, 'an incident within 10 minutes');
});

test('a show takes over a running incident', () => {
  const o = testOffice(3); o.run(5);
  assert.equal(o.sim.trigger('meeting'), true);
  o.sim.setShow('band'); o.clock.phase = 'band';
  assert.equal(o.sim.event, null);
  o.run(30);
  assert.equal(Object.keys(o.sim.state.show.acts).length, 4);
});

test('a steered character joins once released', () => {
  const o = testOffice(5); o.run(5);
  o.sim.drive('andy', 1, 0);
  o.sim.setShow('band'); o.clock.phase = 'band'; o.run(5);
  assert.equal(o.who('andy').busy, null);
  o.sim.drive(null); o.run(30);
  assert.equal(o.sim.state.show.acts.andy, 'band');
});

test('late arrivals join and marks are free with the set in place', () => {
  const o = testOffice(9, 'night'); o.run(20);              // staff are out at night
  o.sim.setShow('band'); o.clock.phase = 'band'; o.run(90);
  assert.equal(Object.keys(o.sim.state.show.acts).length, 4);
  for (const r of Object.values(SHOWS.band.roles)) assert.equal(o.nav.freeAt(r.mark.x, r.mark.z), true);
});

test('Christmas has its lines and diary entries, and no em-dashes', () => {
  assert.equal(SHOWS.xmas.lines, XMAS_LINES);
  assert.equal(SHOWS.xmas.reports, XMAS_REPORTS);
  for (const type of ['andy', 'jazz', 'olex', 'margo']) {
    assert.ok(XMAS_LINES[type].length >= 5, type);
    for (const line of XMAS_LINES[type]) assert.doesNotMatch(line, new RegExp(String.fromCharCode(0x2014)), `${type}: no em-dashes`);
  }
  assert.equal(XMAS_REPORTS.length, 3);
  for (const line of XMAS_REPORTS) assert.doesNotMatch(line, new RegExp(String.fromCharCode(0x2014)));
  assert.deepEqual(Object.keys(SHOWS.xmas.roles).sort(), ['andy', 'jazz', 'margo', 'olex']);
  assert.ok(Object.values(SHOWS.xmas.roles).every(r => r.act === 'xmas' && r.mark.heading === 0));
  assert.match(SHOWS.xmas.chatContext, /Christmas/);
});

test('Christmas puts all four on their marks by the tree and loops carols and chat', () => {
  const o = testOffice(7); o.run(5);
  assert.equal(o.sim.setShow('xmas'), true);
  o.clock.phase = 'xmas';
  o.run(40);
  for (const type of ['andy', 'jazz', 'olex', 'margo']) {
    const c = o.who(type), m = SHOWS.xmas.roles[type].mark;
    assert.ok(Math.hypot(c.pos.x - m.x, c.pos.y - m.z) < 0.25, `${type} at (${c.pos.x.toFixed(2)}, ${c.pos.y.toFixed(2)})`);
    assert.equal(o.sim.state.show.acts[type], 'xmas');
  }
  assert.equal(o.sim.state.show.acts.ghost, undefined);
  for (const r of Object.values(SHOWS.xmas.roles)) assert.equal(o.nav.freeAt(r.mark.x, r.mark.z), true, 'marks stay free with the tree up');
  const beats = new Set();
  for (let i = 0; i < 120; i++) { o.run(1); beats.add(o.sim.state.show.beat); }
  assert.deepEqual([...beats].sort(), ['break', 'play']);
});

test('switching from the band straight to Christmas swaps sets and marks', () => {
  const o = testOffice(7); const before = pathCells(o.nav);
  o.sim.setShow('band'); o.clock.phase = 'band'; o.run(30);
  assert.equal(Object.keys(o.sim.state.show.acts).length, 4, 'the band is playing');
  // The page switches a show off before it starts the next (office.js setShow).
  o.sim.setShow(null);
  assert.equal(o.sim.setShow('xmas'), true);
  o.clock.phase = 'xmas';
  assert.equal(o.sim.show, 'xmas', 'exactly one show');
  assert.equal(o.sim.state.show.key, 'xmas');
  const blocked = (fp, x, z) => !o.nav.freeAt(x, z);
  for (const p of SHOWS.band.set) {
    if (!p.footprint) continue;
    const [x0, z0, x1, z1] = p.footprint, x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    const xmasHere = SHOWS.xmas.set.some(q => q.footprint && x >= q.footprint[0] - 0.3 && x <= q.footprint[2] + 0.3 && z >= q.footprint[1] - 0.3 && z <= q.footprint[3] + 0.3);
    if (!xmasHere) assert.equal(blocked(p.footprint, x, z), false, `the band's ${p.piece} no longer blocks the floor`);
  }
  for (const p of SHOWS.xmas.set) {
    if (!p.footprint) continue;
    const [x0, z0, x1, z1] = p.footprint;
    assert.equal(o.nav.freeAt((x0 + x1) / 2, (z0 + z1) / 2), false, `the ${p.piece} blocks the floor`);
  }
  o.run(40);
  for (const type of ['andy', 'jazz', 'olex', 'margo']) {
    const c = o.who(type), m = SHOWS.xmas.roles[type].mark;
    assert.ok(Math.hypot(c.pos.x - m.x, c.pos.y - m.z) < 0.25, `${type} on the Christmas mark`);
    assert.equal(o.sim.state.show.acts[type], 'xmas');
    assert.equal(c.busy?.key, 'xmas');
  }
  o.sim.setShow(null); o.clock.phase = 'midday';
  assert.deepEqual(pathCells(o.nav), before, 'stopping restores the floor');
  assert.ok(o.sim.cast.every(c => !c.busy));
});

// Every blocking square of a show's set: `footprint` and `footprints`.
const blocks = spec => spec.set.flatMap(p => [p.footprint, ...(p.footprints ?? [])].filter(Boolean));
const onMarks = (o, key) => {
  for (const [type, role] of Object.entries(SHOWS[key].roles)) {
    const c = o.who(type), m = role.mark;
    if (!c) continue;   // a role for someone who is not in this office's cast (the guest)
    assert.ok(Math.hypot(c.pos.x - m.x, c.pos.y - m.z) < 0.25, `${key}: ${type} at (${c.pos.x.toFixed(2)}, ${c.pos.y.toFixed(2)})`);
    assert.equal(o.sim.state.show.acts[type], role.act, `${key}: ${type} plays ${role.act}`);
    assert.equal(c.busy?.key, key);
  }
};

test('the murder mystery has its lines, diary entries and cast', () => {
  assert.equal(SHOWS.murder.lines, MURDER_LINES);
  assert.equal(SHOWS.murder.reports, MURDER_REPORTS);
  const dash = new RegExp(String.fromCharCode(0x2014));
  for (const type of ['andy', 'jazz', 'olex', 'margo']) {
    assert.ok(MURDER_LINES[type].length >= 6, type);
    for (const line of MURDER_LINES[type]) assert.doesNotMatch(line, dash, `${type}: no em-dashes`);
  }
  assert.equal(MURDER_REPORTS.length, 3);
  for (const line of MURDER_REPORTS) assert.doesNotMatch(line, dash);
  assert.deepEqual([SHOWS.murder.key, SHOWS.murder.label, SHOWS.murder.bpm, SHOWS.murder.playS, SHOWS.murder.breakS], ['murder', 'Murder', 92, 36, 14]);
  for (const field of ['events', 'chat', 'speed', 'ghostVis', 'ghostHid', 'ghostSpeed', 'lampWeight', 'staff']) {
    assert.deepEqual(SHOWS.murder[field], SHOWS.xmas[field], `the same phase field ${field} as the other shows`);
  }
  assert.deepEqual(Object.fromEntries(Object.entries(SHOWS.murder.roles).map(([t, r]) => [t, r.act])),
    { andy: 'body', jazz: 'murder', olex: 'murder', margo: 'murder' });
  assert.ok(Object.values(SHOWS.murder.roles).every(r => r.mark.heading === 0), 'everyone faces the front wall');
  assert.ok(Object.values(SHOWS.murder.roles).every(r => r.mark.z <= SHOWS.murder.roles.andy.mark.z), 'the body lies in front, nearest the camera');
  assert.match(SHOWS.murder.chatContext, /murder mystery/);
  assert.match(SHOWS.murder.chatContext, /Andy/);
  assert.match(SHOWS.murder.chatContext, /Margo is the inspector/);
  const pieces = SHOWS.murder.set.map(p => p.piece);
  assert.equal(pieces.filter(p => p === 'chalk_outline').length, 1);
  assert.equal(pieces.filter(p => p === 'crime_tape').length, 1);
  assert.equal(pieces.filter(p => p === 'evidence').length, 1);
  assert.ok(pieces.filter(p => p === 'evidence_marker').length >= 3);
  const chalk = SHOWS.murder.set.find(p => p.piece === 'chalk_outline'), body = SHOWS.murder.roles.andy.mark;
  assert.deepEqual([chalk.x, chalk.z, chalk.footprint], [body.x, body.z, null], 'the chalk outline lies round the body and does not block');
  const blood = SHOWS.murder.set.find(p => p.piece === 'blood_pool'), knife = SHOWS.murder.set.find(p => p.piece === 'knife');
  assert.deepEqual([blood.x, blood.z, blood.footprint], [body.x, body.z, null], 'the blood pools round the body and does not block');
  assert.equal(knife.on, 'andy', 'the knife is there only while the body is');
  assert.ok(Math.hypot(knife.x - body.x, knife.z - body.z) < 0.15 && knife.footprint === null, 'the knife stands in the belly');
  const tape = SHOWS.murder.set.find(p => p.piece === 'crime_tape');
  assert.equal(tape.posts.length, 4);
  assert.equal(tape.footprints.length, 4, 'each post blocks a small square');
  for (const [x0, z0, x1, z1] of tape.footprints) assert.ok(x1 - x0 <= 0.3 && z1 - z0 <= 0.3, 'small post footprints');
});

test('the murder mystery puts all four on their marks round the body and loops investigating and accusations', () => {
  const o = testOffice(7); o.run(5);
  assert.equal(o.sim.setShow('murder'), true);
  const victim = o.who('andy'), lies = SHOWS.murder.roles.andy.mark;
  assert.deepEqual([victim.pos.x, victim.pos.y, victim.heading, victim.path.length], [lies.x, lies.z, lies.heading, 0], 'the victim is on his mark the moment the show opens');
  assert.equal(o.sim.state.show.acts.andy, 'body', 'and already lying in the blood');
  assert.deepEqual(Object.keys(o.sim.state.show.acts), ['andy'], 'the investigators still walk in');
  o.clock.phase = 'murder';
  o.run(45);
  onMarks(o, 'murder');
  assert.equal(o.sim.state.show.acts.andy, 'body');
  for (const type of ['jazz', 'olex', 'margo']) assert.equal(o.sim.state.show.acts[type], 'murder');
  assert.equal(o.sim.state.show.acts.ghost, undefined, 'the ghost keeps haunting');
  for (const r of Object.values(SHOWS.murder.roles)) assert.equal(o.nav.freeAt(r.mark.x, r.mark.z), true, 'marks stay free with the set up');
  for (const [x0, z0, x1, z1] of blocks(SHOWS.murder)) assert.equal(o.nav.freeAt((x0 + x1) / 2, (z0 + z1) / 2), false, 'the posts block');
  const beats = new Set();
  for (let i = 0; i < 120; i++) { o.run(1); beats.add(o.sim.state.show.beat); }
  assert.deepEqual([...beats].sort(), ['break', 'play']);
});

test('late arrivals reach the murder marks at night', () => {
  const o = testOffice(9, 'night'); o.run(20);
  o.sim.setShow('murder'); o.clock.phase = 'murder'; o.run(90);
  onMarks(o, 'murder');
});

test('band to murder to Christmas: one show at a time, footprints swap, everyone on the new marks', () => {
  const o = testOffice(7); const before = pathCells(o.nav);
  const blockedBy = key => blocks(SHOWS[key]).map(([x0, z0, x1, z1]) => !o.nav.freeAt((x0 + x1) / 2, (z0 + z1) / 2));
  const near = (fp, others) => others.some(q => {
    const x = (fp[0] + fp[2]) / 2, z = (fp[1] + fp[3]) / 2;
    return x >= q[0] - 0.3 && x <= q[2] + 0.3 && z >= q[1] - 0.3 && z <= q[3] + 0.3;
  });
  const switchTo = key => {
    o.sim.setShow(null);   // the page switches a show off before it starts the next (office.js setShow)
    assert.equal(o.sim.setShow(key), true);
    o.clock.phase = key;
    assert.equal(o.sim.show, key, 'exactly one show');
    assert.equal(o.sim.state.show.key, key);
  };
  o.sim.setShow('band'); o.clock.phase = 'band'; o.run(30);
  onMarks(o, 'band');
  switchTo('murder');
  assert.ok(blockedBy('murder').every(Boolean), 'the cordon posts block');
  blocks(SHOWS.band).forEach((fp, i) => {
    if (!near(fp, blocks(SHOWS.murder))) assert.equal(blockedBy('band')[i], false, 'the band set no longer blocks');
  });
  o.run(45);
  onMarks(o, 'murder');
  switchTo('xmas');
  assert.ok(blockedBy('xmas').every(Boolean), 'the tree blocks');
  blocks(SHOWS.murder).forEach((fp, i) => {
    if (!near(fp, blocks(SHOWS.xmas))) assert.equal(blockedBy('murder')[i], false, 'the cordon is gone');
  });
  o.run(45);
  onMarks(o, 'xmas');
  // And back the other way, straight from Christmas to the murder.
  switchTo('murder');
  o.run(45);
  onMarks(o, 'murder');
  assert.equal(o.sim.cast.filter(c => c.busy).length, 4, 'nobody is left in an old show');
  o.sim.setShow(null); o.clock.phase = 'midday';
  assert.deepEqual(pathCells(o.nav), before, 'stopping restores the floor');
  assert.ok(o.sim.cast.every(c => !c.busy));
  assert.equal(o.sim.state.show, null);
});

test('the band carries its own lines and diary entries', () => {
  assert.equal(SHOWS.band.lines, BAND_LINES);
  assert.equal(SHOWS.band.reports, BAND_REPORTS);
});

test('the first song starts once someone is on their mark', () => {
  const o = testOffice(7); o.run(5);
  o.sim.setShow('band'); o.clock.phase = 'band';
  let t = 0;
  assert.equal(o.sim.state.show.beat, 'break', 'no music over an empty stage');
  while (!Object.keys(o.sim.state.show.acts).length && t < 60) {
    o.run(1 / 30); t += 1 / 30;
    if (!Object.keys(o.sim.state.show.acts).length) assert.equal(o.sim.state.show.beat, 'break', `still walking in at ${t.toFixed(1)} s`);
  }
  assert.ok(t > 1 && t < 60, `someone reached a mark (after ${t.toFixed(1)} s)`);
  assert.equal(o.sim.state.show.beat, 'play', 'the song starts with the first player on a mark');
  o.run(SHOWS.band.playS - 2);
  assert.equal(o.sim.state.show.beat, 'play', 'a whole song from the first arrival');
  o.run(4);
  assert.equal(o.sim.state.show.beat, 'break');
});

test('nobody talks between songs during the walk-in', () => {
  const said = [];
  const cast = ['olex'].map(type => ({ type, present: true, shift: 'in', path: [], pos: { x: 5, y: 3 }, busy: null, chat: null }));
  const state = {};
  let time = 0;
  const pending = [];
  const shows = createShows({
    cast, nav: new NavGrid({ x0: -6, z0: -4, x1: 6, z1: 4, cell: 0.2 }), state, random: seeded(2), now: () => time,
    say: (c, text) => said.push(text), pickLine: (type, bank) => bank?.[type]?.[0] ?? null,
    later: (d, fn) => pending.push({ at: time + d, fn }), record() {}, sendTo() {}, stopIncident() {},
  });
  shows.start('band');
  for (; time < 120; time += 0.5) {
    shows.update();
    for (let i = pending.length - 1; i >= 0; i--) if (time >= pending[i].at) pending.splice(i, 1)[0].fn();
  }
  assert.equal(state.show.beat, 'break', 'Olex never gets to his mark: no song');
  assert.deepEqual(said, [], 'no break lines while the band walks in');
});

test('a show with no lines, reports or music runs and stops', () => {
  const said = [], recorded = [];
  const quiet = {
    key: 'quiet', playS: 4, breakS: 2,
    roles: { olex: { act: 'quiet', mark: { x: 1, z: 1, heading: 0 } } },
    set: [{ piece: 'rug', x: 0, z: 0, rot: 0, footprint: null }],
  };
  const olex = { type: 'olex', present: true, shift: 'in', path: [], pos: { x: 3, y: 2 }, busy: null, chat: null };
  const state = {};
  let time = 0;
  const pending = [];
  const shows = createShows({
    cast: [olex], nav: new NavGrid({ x0: -6, z0: -4, x1: 6, z1: 4, cell: 0.2 }), state, random: seeded(3), now: () => time,
    say: (c, text) => said.push(text), pickLine: (type, bank) => bank[type][0],   // throws on a missing bank
    later: (d, fn) => pending.push({ at: time + d, fn }), record: text => recorded.push(text),
    sendTo: (c, x, z) => { c.pos.x = x; c.pos.y = z; }, stopIncident() {},
    shows: { quiet },
  });
  assert.equal(shows.start('quiet'), true);
  const beats = new Set();
  for (; time < 30; time += 0.25) {
    shows.update();
    for (let i = pending.length - 1; i >= 0; i--) if (time >= pending[i].at) pending.splice(i, 1)[0].fn();
    beats.add(state.show.beat);
  }
  assert.deepEqual([...beats].sort(), ['break', 'play']);
  assert.deepEqual(said, []);
  assert.deepEqual(recorded, []);
  shows.stop();
  assert.equal(state.show, null);
  assert.equal(olex.busy, null);
});

test('a show tidies up a donut race and a printer jam', () => {
  for (const incident of ['donut', 'printerJam']) {
    const o = testOffice(4); o.run(5);
    const started = incident === 'donut' ? o.sim.dropDonut(1.5, 1.5) : o.sim.trigger('printerJam');
    assert.ok(started, `${incident} started`);
    assert.ok(o.sim.state.donut || o.sim.state.printerJammed, `${incident} is on`);
    o.sim.setShow('band'); o.clock.phase = 'band';
    assert.equal(o.sim.state.donut, null, `${incident}: no donut`);
    assert.equal(o.sim.state.printerJammed, false, `${incident}: printer fine`);
    o.run(10);
    assert.equal(o.sim.state.donut, null);
    assert.equal(o.sim.state.printerJammed, false);
  }
});

test('someone talking to the visitor joins the show when the talk ends', () => {
  const o = testOffice(5); o.run(5);
  const andy = o.who('andy');
  andy.talkingToVisitor = true;
  o.sim.setShow('band'); o.clock.phase = 'band'; o.run(10);
  assert.equal(andy.busy, null, 'not taken out of a conversation');
  andy.talkingToVisitor = false; o.run(40);
  assert.ok(andy.busy, 'claimed once the talk ends');
  assert.equal(o.sim.state.show.acts.andy, 'band', 'and on the mark');
});

// Just enough of Web Audio to run sound.js in Node and see what it schedules.
function fakeAudio() {
  const made = { oscillators: [], shapers: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = extra => ({ connect: n => n, start() {}, stop() {}, ...extra });
  class Ctx {
    constructor() { made.ctx = this; this.currentTime = 1; this.state = 'running'; this.sampleRate = 8000; this.destination = node(); }
    resume() {}
    createGain() { return node({ gain: param() }); }
    createBiquadFilter() { return node({ frequency: param() }); }
    createBufferSource() { return node(); }
    createWaveShaper() { made.shapers++; return node(); }
    createOscillator() { const o = node({ frequency: param() }); made.oscillators.push(o); return o; }
    createBuffer(_, length) { return { getChannelData: () => new Float32Array(length) }; }
  }
  return { Ctx, made };
}

test('the band track switches over from the party on one timer, and stops', async () => {
  const { createSound, TRACK_BPM } = await import('../src/office3d/sound.js');
  assert.equal(TRACK_BPM.band, SHOWS.band.bpm);
  const { Ctx, made } = fakeAudio();
  const saved = { ctx: globalThis.AudioContext, set: globalThis.setInterval, clear: globalThis.clearInterval };
  const timers = new Set();
  let next = 1, tick = null;
  globalThis.AudioContext = Ctx;
  globalThis.setInterval = fn => { tick = fn; const id = next++; timers.add(id); return id; };
  globalThis.clearInterval = id => timers.delete(id);
  try {
    const sound = createSound();
    assert.equal(sound.setEnabled(true), true);
    sound.startMusic();
    assert.equal(sound.bpm, 124, 'no argument is the party');
    assert.equal(made.shapers, 0, 'the party has no amp');
    sound.startMusic('band');
    assert.equal(sound.bpm, 132);
    assert.equal(timers.size, 1, 'one music timer');
    made.ctx.currentTime += 0.5;   // past the party steps already scheduled
    tick();
    assert.equal(made.shapers, 1, 'the band goes through the amp');
    assert.ok(made.oscillators.some(o => o.type === 'sawtooth'), 'sawtooth power chords');
    assert.ok(sound.beat() >= 0);
    sound.startMusic('party');
    assert.equal(sound.bpm, 124);
    assert.equal(timers.size, 1);
    sound.stopMusic();
    assert.equal(timers.size, 0, 'stopMusic stops the timer');
    assert.equal(sound.musicWanted, false);
    assert.equal(sound.beat(), 0);
  } finally {
    globalThis.AudioContext = saved.ctx;
    globalThis.setInterval = saved.set;
    globalThis.clearInterval = saved.clear;
  }
});

test('the Christmas track plays bells at its own tempo and has a beat', async () => {
  const { createSound, TRACK_BPM, hasTrack } = await import('../src/office3d/sound.js');
  for (const key of Object.keys(SHOWS)) if (hasTrack(key)) assert.equal(TRACK_BPM[key], SHOWS[key].bpm, key);
  assert.equal(TRACK_BPM.xmas, 104);
  const { Ctx, made } = fakeAudio();
  const saved = { ctx: globalThis.AudioContext, set: globalThis.setInterval, clear: globalThis.clearInterval };
  let tick = null;
  globalThis.AudioContext = Ctx;
  globalThis.setInterval = fn => { tick = fn; return 1; };
  globalThis.clearInterval = () => {};
  try {
    const sound = createSound();
    sound.setEnabled(true);
    sound.startMusic('band');
    sound.startMusic('xmas');
    assert.equal(sound.bpm, 104, 'band switches straight to Christmas');
    const before = made.oscillators.length;
    for (let i = 0; i < 10; i++) { made.ctx.currentTime += 0.2; tick(); }
    const bells = made.oscillators.slice(before);
    assert.ok(bells.length > 10, 'notes are scheduled');
    assert.ok(bells.every(o => o.type !== 'sawtooth' && o.type !== 'square'), 'soft voices only');
    assert.ok(sound.beat() > 0, 'the beat follows the low notes');
    sound.stopMusic();
    assert.equal(sound.beat(), 0);
  } finally {
    globalThis.AudioContext = saved.ctx;
    globalThis.setInterval = saved.set;
    globalThis.clearInterval = saved.clear;
  }
});

test('the murder track is slow noir jazz at 92 BPM with a beat', async () => {
  const { createSound, TRACK_BPM, hasTrack } = await import('../src/office3d/sound.js');
  assert.equal(hasTrack('murder'), true);
  assert.equal(TRACK_BPM.murder, SHOWS.murder.bpm);
  const { Ctx, made } = fakeAudio();
  const saved = { ctx: globalThis.AudioContext, set: globalThis.setInterval, clear: globalThis.clearInterval };
  let tick = null;
  globalThis.AudioContext = Ctx;
  globalThis.setInterval = fn => { tick = fn; return 1; };
  globalThis.clearInterval = () => {};
  try {
    const sound = createSound();
    sound.setEnabled(true);
    sound.startMusic('xmas');
    sound.startMusic('murder');
    assert.equal(sound.bpm, 92, 'Christmas switches straight to the murder');
    const before = made.oscillators.length;
    for (let i = 0; i < 30; i++) { made.ctx.currentTime += 0.2; tick(); }
    const notes = made.oscillators.slice(before);
    assert.ok(notes.length > 20, 'notes are scheduled');
    assert.ok(notes.some(o => o.type === 'triangle'), 'an upright bass');
    assert.ok(notes.every(o => o.type !== 'sawtooth' && o.type !== 'square'), 'no distortion, no chiptune');
    assert.equal(made.shapers, 0, 'no amp');
    assert.ok(sound.beat() > 0, 'the beat follows the bass');
    sound.stopMusic();
    assert.equal(sound.beat(), 0);
  } finally {
    globalThis.AudioContext = saved.ctx;
    globalThis.setInterval = saved.set;
    globalThis.clearInterval = saved.clear;
  }
});

test('only a show with its own track has music', async () => {
  const { hasTrack } = await import('../src/office3d/sound.js');
  assert.equal(hasTrack('band'), true);
  assert.equal(hasTrack('xmas'), true);
  assert.equal(hasTrack('party'), true);
  assert.equal(hasTrack('quiet'), false);
  assert.equal(hasTrack('toString'), false);
});

// ---- Mr. T, the guest ----

const guestOffice = (seed, phase = 'midday') => testOffice(seed, phase, FULL_CAST);
const DOOR = { x: -2.0, z: 3.3 };
const EM_DASH = new RegExp(String.fromCharCode(0x2014));

test('Mr. T is a guest: his own lines, no desk, no shift, a role in the band only', () => {
  assert.equal(GUEST.type, 'mrt');
  assert.equal(NAMES.mrt, 'Mr. T');
  for (const p of [...DAY_PHASES, PARTY_PHASE]) assert.equal(p.staff.includes('mrt'), false, `${p.key}: he is not staff`);
  const passing = Object.values(DIRECTED_LINES.mrt).flat();
  assert.deepEqual(Object.keys(DIRECTED_LINES.mrt).sort(), ['andy', 'jazz', 'margo', 'olex'], 'a word for everyone he can pass');
  const all = [...DIALOGUE_BANKS.mrt, ...passing, ...ARRIVE_DIALOGUE.mrt, ...LEAVE_DIALOGUE.mrt, ...BAND_LINES.mrt];
  assert.ok(DIALOGUE_BANKS.mrt.length >= 20 && all.length >= 40, `about forty lines, got ${all.length}`);
  assert.equal(new Set(all).size, all.length, 'no line twice');
  for (const line of all) {
    assert.ok(typeof line === 'string' && line.trim().length > 10, line);
    assert.doesNotMatch(line, EM_DASH, `no em-dashes: ${line}`);
  }
  assert.ok(BAND_LINES.mrt.length >= 5);
  // The band is his only show.
  assert.deepEqual(SHOWS.band.roles.mrt.act, 'band');
  assert.equal(SHOWS.band.roles.mrt.wild, true, 'the frontman goes wild');
  assert.ok(SHOWS.band.staff.includes('mrt'), 'the band brings him in');
  for (const key of ['xmas', 'murder']) {
    assert.equal(SHOWS[key].roles.mrt, undefined, `${key}: no role`);
    assert.equal(SHOWS[key].staff.includes('mrt'), false, `${key}: not called in`);
    assert.equal(Object.keys(SHOWS[key].roles).length, 4);
  }
  for (const [type, role] of Object.entries(SHOWS.band.roles)) if (type !== 'mrt') assert.equal(role.wild, undefined, `${type} keeps the small bob`);
});

test('the frontman has room on the stage', () => {
  const mark = SHOWS.band.roles.mrt.mark;
  assert.equal(mark.heading, 0, 'facing the front');
  const o = testOffice(3); o.sim.setShow('band');
  assert.equal(o.nav.freeAt(mark.x, mark.z), true, 'his mark is free with the set up');
  for (const [type, role] of Object.entries(SHOWS.band.roles)) {
    if (type === 'mrt') continue;
    assert.ok(Math.hypot(role.mark.x - mark.x, role.mark.z - mark.z) >= 1, `clear of ${type}`);
    assert.ok(mark.z > role.mark.z, `in front of ${type}`);
  }
  const mic = SHOWS.band.set.find(p => p.piece === 'mic_stand');
  assert.ok(Math.hypot(mic.x - mark.x, mic.z - mark.z) >= 0.7, 'clear of the mic stand');
  // From the front (a camera on the front wall, level with the middle of the
  // marks) he does not stand in front of anyone's face: he is tall and wide.
  const marks = Object.values(SHOWS.band.roles).map(r => r.mark);
  const cam = { x: marks.reduce((sum, m) => sum + m.x, 0) / marks.length, z: 3.6 };
  for (const type of ['jazz', 'margo', 'olex', 'andy']) {
    const m = SHOWS.band.roles[type].mark;
    const t = (cam.z - mark.z) / (cam.z - m.z);
    const x = cam.x + (m.x - cam.x) * t;   // where the line to their face passes his depth
    assert.ok(Math.abs(x - mark.x) >= 0.3, `${type}'s face stays in view (${(x - mark.x).toFixed(2)} m to the side of him)`);
  }
});

test('Mr. T comes in by himself, walks his rounds, says something and leaves; he is away most of the time', () => {
  const own = new Set([...DIALOGUE_BANKS.mrt, ...Object.values(DIRECTED_LINES.mrt).flat(), ...ARRIVE_DIALOGUE.mrt, ...LEAVE_DIALOGUE.mrt]);
  for (const phase of ['midday', 'night']) {
    const o = guestOffice(13, phase), t = o.who('mrt');
    assert.equal(t.present, false, 'out when the office opens');
    assert.ok(o.sim.guestDueIn() >= GUEST.firstS[0] && o.sim.guestDueIn() <= GUEST.firstS[1], 'his first visit is a little while off');
    let visits = 0, frames = 0, here = 0, was = false, lines = 0, seq = t.lineSeq, walked = 0, last = null, away = 0, longestStay = 0, stay = 0;
    const gaps = [];
    for (let i = 0; i < 1500 * 30; i++) {
      o.sim.update(1 / 30);
      frames++;
      if (t.present) {
        here++; stay++;
        if (!was) {
          visits++;
          if (visits > 1) gaps.push(away / 30);
          assert.ok(Math.hypot(t.pos.x - DOOR.x, t.pos.y - DOOR.z) < 0.3, `${phase}: he comes in at the door`);
          last = { ...t.pos };
        }
        walked += Math.hypot(t.pos.x - last.x, t.pos.y - last.y);
        last = { ...t.pos };
        assert.ok(o.nav.nearestFree(t.pos.x, t.pos.y) && Math.abs(t.pos.x) <= 6 && Math.abs(t.pos.y) <= 4, 'he stays on the floor');
        assert.equal(t.busy, null, 'no incident has him');
        assert.equal(t.chat, null, 'he does not stop for a chat');
        if (t.lineSeq !== seq) { seq = t.lineSeq; lines++; assert.ok(own.has(t.line), `his own line: ${t.line}`); }
        away = 0;
      } else {
        if (was) {
          assert.ok(Math.hypot(t.pos.x - DOOR.x, t.pos.y - DOOR.z) < 0.6, `${phase}: he leaves by the door (${t.pos.x.toFixed(2)}, ${t.pos.y.toFixed(2)})`);
          longestStay = Math.max(longestStay, stay / 30);
          stay = 0;
        }
        away++;
      }
      was = t.present;
    }
    assert.ok(visits >= 6, `${phase}: several visits in 25 minutes, got ${visits}`);
    assert.ok(here / frames < 0.45, `${phase}: away most of the time (in ${(100 * here / frames).toFixed(0)} %)`);
    assert.ok(here / frames > 0.08, `${phase}: but he does turn up (in ${(100 * here / frames).toFixed(0)} %)`);
    assert.ok(walked / visits > 12, `${phase}: a few rounds each visit (${(walked / visits).toFixed(1)} m)`);
    assert.ok(lines >= visits, `${phase}: a remark or two a visit (${lines} lines in ${visits} visits)`);
    assert.ok(longestStay < 140, `${phase}: a visit ends (${longestStay.toFixed(0)} s)`);
    for (const gap of gaps) assert.ok(gap >= GUEST.awayS[0] - 1 && gap <= GUEST.awayS[1] + 1, `${phase}: ${gap.toFixed(0)} s between visits`);
    assert.ok(o.sim.log.filter(e => /Mr\. T/.test(e.text)).length <= 5, 'he does not fill the diary');
  }
});

test('the staff day is the same with Mr. T in the cast, until he walks in', () => {
  for (const seed of [7, 21]) {
    const a = testOffice(seed), b = guestOffice(seed);
    const snap = o => JSON.stringify(o.sim.cast.filter(c => c.type !== 'mrt').map(c => [c.pos.x, c.pos.y, c.heading, c.line, c.present, c.needs]));
    let frames = 0;
    while (!b.who('mrt').present && frames < 200 * 30) {
      assert.equal(snap(b), snap(a), `seed ${seed}: the same office at ${(frames / 30).toFixed(1)} s`);
      a.sim.update(1 / 30); b.sim.update(1 / 30);
      frames++;
    }
    assert.ok(frames >= GUEST.firstS[0] * 30 && b.who('mrt').present, 'he did come in');
    assert.deepEqual(b.sim.log.slice(0, a.sim.log.length - 1), a.sim.log.slice(0, a.sim.log.length - 1), 'and the same diary');
  }
  // Two offices with the same seeds do the same thing, guest and all.
  const x = guestOffice(5), y = guestOffice(5);
  x.run(400); y.run(400);
  assert.deepEqual(x.sim.cast.map(c => [c.pos.x, c.pos.y, c.line]), y.sim.cast.map(c => [c.pos.x, c.pos.y, c.line]));
});

test('Mr. T never carries a cup or printouts', () => {
  const zones = [{ type: 'coffee_station', x: 0, z: 0 }, { type: 'printer', x: 8, z: 0 }];
  const still = { type: 'mrt', pos: { x: 0, y: 0 }, speed: 0, present: true, shift: 'in', busy: null };
  assert.equal(createCarryController({ spots: zones, random: () => 0 }).update(still, 0), null, 'no cup at the coffee station');
  const walker = { ...still, pos: { x: 8, y: 0 }, speed: 0.5 };
  assert.equal(createCarryController({ spots: zones, random: () => 0 }).update(walker, 1), null, 'no printouts at the printer');
  // And over a long day in the office, wherever his rounds take him.
  const o = guestOffice(17), t = o.who('mrt');
  const carry = createCarryController({ spots: o.spots, random: () => 0 });
  let seen = 0;
  for (let i = 0; i < 900 * 30; i++) {
    o.sim.update(1 / 30);
    if (t.present) seen++;
    assert.equal(carry.update(t, o.sim.time, {}), null);
  }
  assert.ok(seen > 0, 'he was in');
});

test('the band calls Mr. T in: he comes through the door, takes the front of the stage and stays until it stops', () => {
  for (const phase of ['midday', 'night']) {
    const o = guestOffice(9, phase), t = o.who('mrt'), mark = SHOWS.band.roles.mrt.mark;
    o.run(10);
    assert.equal(t.present, false, 'out before the show');
    o.sim.setShow('band'); o.clock.phase = 'band';
    // He makes his entrance last: a few seconds after the other four are on
    // their marks (or after waiting GUEST.showWaitS for them).
    let cameIn = null, setAt = null, waited = 0;
    const others = () => ['andy', 'jazz', 'olex', 'margo'].every(type => o.sim.state.show.acts[type]);
    for (let i = 0; i < (GUEST.showWaitS + GUEST.showInS[1] + 2) * 30 && cameIn === null; i++) {
      o.sim.update(1 / 30); waited += 1 / 30;
      if (setAt === null && others()) setAt = waited;
      if (t.present) cameIn = { ...t.pos };
    }
    assert.ok(cameIn, `${phase}: the band brings him in`);
    if (setAt !== null) assert.ok(waited - setAt >= GUEST.showInS[0] - 0.1 && waited - setAt <= GUEST.showInS[1] + 0.2, `${phase}: last, ${(waited - setAt).toFixed(1)} s after the others were set`);
    else assert.ok(waited >= GUEST.showWaitS, `${phase}: or once he has waited long enough (${waited.toFixed(1)} s)`);
    assert.ok(Math.hypot(cameIn.x - DOOR.x, cameIn.y - DOOR.z) < 0.3, 'through the door');
    o.run(40);
    assert.equal(o.sim.state.show.acts.mrt, 'band', `${phase}: on his mark (at ${t.pos.x.toFixed(2)}, ${t.pos.y.toFixed(2)})`);
    assert.ok(Math.hypot(t.pos.x - mark.x, t.pos.y - mark.z) < 0.25);
    assert.equal(t.busy?.key, 'band');
    // Through a few songs and breaks he does not wander off or go home.
    for (let i = 0; i < 300; i++) {
      o.run(1);
      assert.equal(t.present, true);
      assert.equal(o.sim.state.show.acts.mrt, 'band', `still on his mark after ${i} s`);
    }
    assert.equal(Object.keys(o.sim.state.show.acts).length, 5, `${phase}: all five play`);
    const lines = new Set();
    for (let i = 0; i < 600 * 30; i++) { o.sim.update(1 / 30); if (t.line) lines.add(t.line); }
    assert.ok(lines.size >= 2 && [...lines].every(l => BAND_LINES.mrt.includes(l)), `frontman lines between songs: ${[...lines].join(' | ')}`);
    // The show stops: he is released and goes out again, then keeps his habit.
    o.sim.setShow(null); o.clock.phase = phase;
    assert.equal(t.busy, null);
    o.run(40);
    assert.equal(t.present, false, `${phase}: he leaves after the show`);
    let back = false;
    for (let i = 0; i < (GUEST.awayS[1] + 10) * 30 && !back; i++) { o.sim.update(1 / 30); back = t.present; }
    assert.ok(back, `${phase}: and drops by again later`);
  }
});

test('the band claims Mr. T when it starts in the middle of a visit', () => {
  const o = guestOffice(13), t = o.who('mrt');
  for (let i = 0; i < 200 * 30 && !(t.present && t.path.length); i++) o.sim.update(1 / 30);
  assert.ok(t.present, 'he is on his rounds');
  o.sim.setShow('band'); o.clock.phase = 'band';
  o.run(40);
  assert.equal(o.sim.state.show.acts.mrt, 'band');
  o.sim.setShow(null); o.clock.phase = 'midday';
  o.run(40);
  assert.equal(t.present, false, 'out after the show');
});

test('Christmas and the murder mystery go on without Mr. T', () => {
  for (const [key, walkIn] of [['xmas', 40], ['murder', 45]]) {
    const o = guestOffice(7), t = o.who('mrt');
    o.run(5);
    assert.equal(o.sim.setShow(key), true);
    o.clock.phase = key;
    o.run(walkIn);
    onMarks(o, key);
    assert.equal(Object.keys(o.sim.state.show.acts).length, 4, `${key}: all four on their marks`);
    for (let i = 0; i < 400; i++) {
      o.run(1);
      assert.equal(t.present, false, `${key}: he keeps out of a show that is not his (${i} s)`);
      assert.equal(o.sim.state.show.acts.mrt, undefined);
    }
    onMarks(o, key);
    o.sim.setShow(null); o.clock.phase = 'midday';
    let back = false;
    for (let i = 0; i < (GUEST.awayS[1] + 10) * 30 && !back; i++) { o.sim.update(1 / 30); back = t.present; }
    assert.ok(back, `${key}: he drops by again once it is over`);
  }
  // A show that starts while he is on his rounds: he finishes up and goes.
  const o = guestOffice(13), t = o.who('mrt');
  for (let i = 0; i < 200 * 30 && !(t.present && t.path.length); i++) o.sim.update(1 / 30);
  assert.ok(t.present);
  o.sim.setShow('murder'); o.clock.phase = 'murder';
  o.run(45);
  assert.equal(t.present, false, 'he has left the scene of the crime');
  onMarks(o, 'murder');
});

test('Mr. T can be poked on his rounds, and dances at the party only by standing still', () => {
  const o = guestOffice(13), t = o.who('mrt');
  for (let i = 0; i < 200 * 30 && !(t.present && t.opacity === 1 && t.path.length); i++) o.sim.update(1 / 30);
  const seq = t.lineSeq;
  t.sayUntil = 0;
  assert.equal(o.sim.poke(t), true, 'a click gets his attention');
  assert.ok(t.lineSeq > seq && DIALOGUE_BANKS.mrt.includes(t.line), `he says something dry: ${t.line}`);
  o.run(2);
  assert.ok(t.speed < 0.2, 'and stops to face the glass');
  // The party is no show: his visits carry on, and he stands still now and then (which is when a standee dances).
  const party = guestOffice(13, 'party'), p = party.who('mrt');
  let still = 0, seen = 0;
  for (let i = 0; i < 600 * 30; i++) { party.sim.update(1 / 30); if (p.present) { seen++; if (p.speed <= 0.15) still++; } }
  assert.ok(seen > 0 && still / 30 > 3, `he stood still for ${(still / 30).toFixed(1)} s of ${(seen / 30).toFixed(0)} s at the party`);
});
