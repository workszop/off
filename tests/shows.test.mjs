import test from 'node:test';
import assert from 'node:assert/strict';

const { NavGrid } = await import('../src/office3d/nav.js');

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
