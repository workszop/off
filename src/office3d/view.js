// ---- The inside view ----
// Camera maths for standing in the room. The visitor still steers an orbit
// around a point in the room (drag to turn and tilt, scroll or pinch to
// zoom), but the camera is kept inside the walls: it sits on the ray from
// that point toward where the orbit wants it, between `near` metres from the
// point and the wall the ray reaches.
//
// So every gesture always does something: turning slides the camera along
// the walls, tilting raises or lowers it, zooming walks it toward the point.
//
// No Three.js or DOM here, so the tests run it in Node.

// The box the camera may be in: the room, less a margin that keeps the lens
// out of the walls, the floor and the ceiling.
export function insideBounds(room, margin = 0.35) {
  return { x: room.W / 2 - margin, z: room.D / 2 - margin, y0: 0.3, y1: room.H - 0.2 };
}

// How far a ray from `from` along the unit direction `dir` travels before it
// leaves the box. `from` is expected to be inside.
export function reach(from, dir, b) {
  const along = (pos, d, lo, hi) => (d > 1e-9 ? (hi - pos) / d : d < -1e-9 ? (lo - pos) / d : Infinity);
  return Math.max(0, Math.min(
    along(from.x, dir.x, -b.x, b.x),
    along(from.y, dir.y, b.y0, b.y1),
    along(from.z, dir.z, -b.z, b.z),
  ));
}

// Distance from the look-at point to the camera. `off` is the offset the
// orbit asks for (any length), `zoom` runs from 0 (closest) to 1 (at the wall).
export function insideDistance(target, off, bounds, zoom, near = 1.2) {
  const len = Math.hypot(off.x, off.y, off.z) || 1;
  const wall = reach(target, { x: off.x / len, y: off.y / len, z: off.z / len }, bounds);
  if (wall <= near) return wall;
  return near + (wall - near) * Math.min(1, Math.max(0, zoom));
}

// Keep the look-at point away from the walls, so a camera behind it still
// has room to stand.
export function insetPoint(x, z, bounds, inset = 1.3) {
  const clamp = (v, limit) => Math.min(limit, Math.max(-limit, v));
  return { x: clamp(x, bounds.x - inset), z: clamp(z, bounds.z - inset) };
}
