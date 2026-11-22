import assert from 'node:assert/strict';
import test from 'node:test';
import { createCarryController } from '../src/office3d/carry.js';

const spots = [
  { type: 'coffee_station', x: 0, z: 0 },
  { type: 'table_cafe', x: 4, z: 0 },
  { type: 'printer', x: 8, z: 0 },
];
const character = (type = 'andy', overrides = {}) => ({
  type, pos: { x: 0, y: 0 }, speed: 0, present: true, shift: 'in', busy: null,
  ...overrides,
});
const fixed = value => () => value;
const at = (c, x, z, speed = 0) => {
  c.pos.x = x;
  c.pos.y = z;
  c.speed = speed;
};

test('coffee is occasional, stable after a failed roll, and only while stationary in a coffee zone', () => {
  const c = character();
  const carry = createCarryController({ spots, random: fixed(0.6) });
  assert.equal(carry.update(c, 0), 'coffee');
  assert.equal(carry.update(c, 1), 'coffee');
  at(c, 0, 0, 0.3);
  assert.equal(carry.update(c, 2), null);
  at(c, 0, 0, 0);
  assert.equal(carry.update(c, 3), 'coffee', 'stopping again in the same visit keeps the cup');

  const failed = character();
  const draws = [0.9, 0];
  const noCup = createCarryController({ spots, random: () => draws.shift() ?? 0.9 });
  assert.equal(noCup.update(failed, 0), null);
  assert.equal(noCup.update(failed, 1), null, 'a failed visit is not rerolled every frame');
  at(failed, 2, 0);
  assert.equal(noCup.update(failed, 2), null, 'a different zone does not create a cup');
  at(failed, 0, 0);
  assert.equal(noCup.update(failed, 3), 'coffee', 're-entering creates a new visit');
});

test('coffee applies to all human characters but never the ghost', () => {
  for (const type of ['andy', 'jazz', 'olex', 'margo']) {
    const c = character(type);
    assert.equal(createCarryController({ spots, random: fixed(0) }).update(c, 0), 'coffee');
  }
  const ghost = character('ghost');
  assert.equal(createCarryController({ spots, random: fixed(0) }).update(ghost, 0), null);
});

test('printouts trigger once on printer entry, persist while walking, and expire', () => {
  const c = character();
  const carry = createCarryController({ spots, random: fixed(0.5) });
  assert.equal(carry.update(c, 0), 'coffee');
  at(c, 8, 0, 0.5);
  assert.equal(carry.update(c, 1), 'printouts');
  assert.equal(carry.update(c, 2), 'printouts');
  at(c, 8, 0, 0);
  assert.equal(carry.update(c, 14.9), 'printouts');
  assert.equal(carry.update(c, 15.1), null);
  at(c, 12, 0, 0.5);
  assert.equal(carry.update(c, 16), null);
  at(c, 8, 0, 0.5);
  assert.equal(carry.update(c, 20), null, 'cooldown prevents a second pickup');
  at(c, 12, 0, 0.5);
  carry.update(c, 21);
  at(c, 8, 0, 0.5);
  assert.equal(carry.update(c, 46), 'printouts', 'pickup is possible after cooldown');
});

test('printer jam, party, absence, shift and busy state clear props and prevent pickups', () => {
  const c = character();
  const carry = createCarryController({ spots, random: fixed(0) });
  assert.equal(carry.update(c, 0), 'coffee');
  c.busy = { type: 'printerJam' };
  assert.equal(carry.update(c, 1), null);
  c.busy = null;
  at(c, 8, 0, 0.5);
  assert.equal(carry.update(c, 2, { printerJammed: true }), null);
  assert.equal(carry.update(c, 3, { printerJammed: true }), null);
  c.present = false;
  assert.equal(carry.update(c, 4), null);
  c.present = true;
  c.shift = 'out';
  assert.equal(carry.update(c, 5), null);
  c.shift = 'in';
  c.pos.x = 8;
  assert.equal(carry.update(c, 6, { partyOn: true }), null);
});

test('non-finite times do not poison carry expiry', () => {
  const c = character();
  const carry = createCarryController({ spots, random: fixed(0) });
  at(c, 8, 0, 0.5);
  assert.equal(carry.update(c, 0), 'printouts');
  assert.equal(carry.update(c, Number.NaN), 'printouts');
  assert.equal(carry.update(c, 10), 'printouts');
});
