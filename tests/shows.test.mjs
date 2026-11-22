import test from 'node:test';
import assert from 'node:assert/strict';

const { NavGrid } = await import('../src/office3d/nav.js');
const { createSim } = await import('../src/office3d/sim.js');
const { SHOWS, BAND_LINES, BAND_REPORTS } = await import('../src/office3d/data.js');

const CAST = ['andy', 'jazz', 'olex', 'ghost', 'margo'];

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// The same small office as tests/regression.test.mjs.
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
    { x: -3.5, z: -3.0, heading: 0, type: 'plant_snake' },
  ];
  const landmarks = { lamp: { x: 2, z: 1 }, whiteboard: { x: -5.1, z: 1.2 }, printer: { x: -1.65, z: -3.55 } };
  const clock = { phase };
  const sim = createSim({ nav, spots, types: CAST, phase: () => clock.phase, landmarks, random: seeded(seed) });
  const run = seconds => { for (let i = 0; i < seconds * 30; i++) sim.update(1 / 30); };
  return { nav, sim, clock, run, who: type => sim.cast.find(c => c.type === type) };
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
  for (const type of ['andy', 'jazz', 'olex', 'margo']) {
    assert.ok(BAND_LINES[type].length >= 4, type);
    for (const line of BAND_LINES[type]) assert.doesNotMatch(line, new RegExp(String.fromCharCode(0x2014)),`${type}: no em-dashes`);
  }
  assert.equal(BAND_REPORTS.length, 3);
  assert.deepEqual(Object.keys(SHOWS.band.roles).sort(), ['andy', 'jazz', 'margo', 'olex']);
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

test('incidents come back after a show', () => {
  const o = testOffice(7); o.run(5);
  assert.equal(o.sim.trigger('meeting'), true);
  // The page may switch the phase first: the meeting then ends under the
  // show's `events: 0`.
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
