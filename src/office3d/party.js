// ---- Party ----
// What the Party button brings into the office: a disco ball that throws
// coloured light and moving beams, a boombox whose speakers pump with the
// music, and the mess a party leaves behind (cups, bottles, trash, confetti).
// The room goes dim and the moon comes out through the windows elsewhere
// (lighting.js look "party", exterior.js); the beat itself is in sound.js.
//
//   const party = createParty({ nav });
//   scene.add(party.group);
//   party.update(on, time, dt, beat);   // beat 0..1, or null for a steady fake one
//
// The two lights live for as long as the page does and only change intensity:
// adding or removing a light makes three.js rebuild every shader.

import * as THREE from 'three';
import { C, paper, box, rbox, cyl, ink } from './materials.js';
import { ROOM } from './room.js';

const PI = Math.PI;
const BPM = 124;
const BEAMS = 18;
export const BALL = { x: 0, y: 2.72, z: 0.3, r: 0.3 };
export const BOOMBOX = { x: 1.8, z: 1.5, rot: -0.3 };

const hueColor = (h, l = 0.55) => new THREE.Color().setHSL(((h % 1) + 1) % 1, 1, l);
const additive = color => new THREE.MeshBasicMaterial({
  color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
});
// Anything that glows or is see-through stays out of the ink pass.
const bare = mesh => { mesh.userData.outline = 'skip'; mesh.castShadow = mesh.receiveShadow = false; return mesh; };

// ---- Disco ball ----
// A sphere of small mirror tiles. Each tile throws back whatever colour is
// swinging past it, so the colours swirl round the ball like a vortex and
// twinkle: the tile colours are repainted every frame (see update()).

const TILES_U = 28, TILES_V = 18;

function buildBall() {
  const g = new THREE.Group();
  g.position.set(BALL.x, BALL.y, BALL.z);
  const geo = new THREE.SphereGeometry(BALL.r, TILES_U, TILES_V).toNonIndexed();
  const pos = geo.attributes.position;
  const tris = pos.count / 3;
  // Which tile each triangle belongs to (two triangles per tile), and how the
  // top of the ball is lit more than the bottom.
  const column = new Uint8Array(tris), row = new Uint8Array(tris), lit = new Float32Array(tris);
  for (let t = 0; t < tris; t++) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { x += pos.getX(t * 3 + k); y += pos.getY(t * 3 + k); z += pos.getZ(t * 3 + k); }
    const len = Math.hypot(x, y, z) || 1;
    const u = (Math.atan2(z, x) / (PI * 2) + 1) % 1;
    const v = Math.acos(THREE.MathUtils.clamp(y / len, -1, 1)) / PI;
    column[t] = Math.min(TILES_U - 1, Math.floor(u * TILES_U));
    row[t] = Math.min(TILES_V - 1, Math.floor(v * TILES_V));
    lit[t] = 0.78 + 0.22 * (y / len);
  }
  const colors = new Float32Array(pos.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const ball = ink(new THREE.Mesh(geo, mat), { edges: 0, hull: 0.006 });
  g.add(ball);
  // The cord up to a little ceiling mount.
  const rise = ROOM.HI - BALL.y;
  cyl(g, [0.006, 0.006, rise - BALL.r], [0, BALL.r, 0], paper(C.ink), { edges: 0, hull: 0 }, 6);
  cyl(g, [0.07, 0.07, 0.04], [0, rise - 0.04, 0], paper(C.ink), { edges: 0, hull: 0.003 }, 16);

  const c = new THREE.Color();
  return {
    group: g, ball,
    // Spin, and repaint every tile: the hue winds round the ball in a spiral
    // that drifts with time, and each tile twinkles on its own beat.
    update(time, kick) {
      ball.rotation.y = time * 0.6;
      for (let t = 0; t < tris; t++) {
        const u = column[t], v = row[t];
        const hue = (u / TILES_U) * 2 + (v / TILES_V) * 1.4 + time * 0.12;
        const twinkle = 0.5 + 0.5 * Math.sin(time * 2.6 + u * 1.3 + v * 2.1);
        const light = (0.3 + 0.32 * twinkle + ((u + v) & 1) * 0.08 + kick * 0.16) * lit[t];
        c.setHSL(hue % 1, 0.95, Math.min(0.78, light + 0.1));
        for (let k = 0; k < 3; k++) c.toArray(colors, (t * 3 + k) * 3);
      }
      geo.attributes.color.needsUpdate = true;
    },
  };
}

// ---- Boombox ----

function buildBoombox() {
  const g = new THREE.Group();
  g.position.set(BOOMBOX.x, 0, BOOMBOX.z);
  g.rotation.y = BOOMBOX.rot;
  const shell = paper(0x2d2c35, { finish: 'plastic' });
  const trim = paper(0xb8bcc4, { finish: 'metal' });
  const lift = 0.04;
  rbox(g, [0.56, 0.27, 0.17], [0, lift, 0], shell, 0.03);
  // Two speakers, the cones that move with the beat.
  const woofers = [];
  for (const x of [-0.185, 0.185]) {
    const ring = cyl(g, [0.105, 0.105, 0.012], [x, lift + 0.135 - 0.006, 0.085], trim, { edges: 0, hull: 0.003 }, 32);
    ring.rotation.x = PI / 2;
    const cone = cyl(g, [0.085, 0.085, 0.02], [x, lift + 0.135 - 0.01, 0.093], paper(0x15151a, { finish: 'rubber' }), { edges: 0, hull: 0 }, 32);
    cone.rotation.x = PI / 2;
    const dome = cyl(g, [0.03, 0.03, 0.02], [x, lift + 0.135 - 0.01, 0.103], trim, { edges: 0, hull: 0 }, 16);
    dome.rotation.x = PI / 2;
    woofers.push(cone, dome);
  }
  // Tape deck and display in the middle.
  box(g, [0.14, 0.1, 0.012], [0, lift + 0.12, 0.087], paper(0x9fa4ad, { finish: 'plastic' }), { edges: 0, hull: 0 });
  const display = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.024, 0.006), new THREE.MeshBasicMaterial({ color: 0x7dff5a }));
  display.position.set(0, lift + 0.21, 0.095);
  g.add(bare(display));
  for (const [x, c] of [[-0.05, C.coral], [0, C.ochre], [0.05, C.blue]]) {
    const knob = cyl(g, [0.014, 0.014, 0.014], [x, lift + 0.07, 0.092], paper(c, { finish: 'plastic' }), { edges: 0, hull: 0 }, 12);
    knob.rotation.x = PI / 2;
  }
  // Handle and antenna.
  const handle = ink(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 8, 24, PI), trim), { edges: 0, hull: 0.004 });
  handle.position.set(0, lift + 0.27, 0);
  g.add(handle);
  const aerial = cyl(g, [0.004, 0.004, 0.3], [0.24, lift + 0.27, -0.05], trim, { edges: 0, hull: 0 }, 6);
  aerial.rotation.z = -0.35;
  return { group: g, woofers, display };
}

// ---- The mess ----
// Cups and bottles are party-sized: a little larger than life, so they read
// from the middle of the room. A pivot puts an item at (x, y, z) and scales it.
const pivot = (parent, x, y, z, k = 1.6) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(k);
  parent.add(g);
  return g;
};

const CUP_COLORS = [0xd4563f, 0xd4563f, 0xd4563f, 0x7d93ab, 0xfbf8f1, 0xd7ba78];
const DRINKS = [0x6b3a22, 0x6b3a22, 0xd98a2b, 0x7a2233, 0xa8c46a];   // cola, juice, wine, lime
const BOTTLES = [
  { glass: 0x4f8a5b, drink: 0x6f8f3a, label: 0xf1e6c8, band: 0xd4563f, foil: 0xd7ba78 },   // green beer
  { glass: 0xb5783a, drink: 0xc98a2b, label: 0xf1e6c8, band: 0x2f5d8a, foil: 0xc9ccd2 },   // amber beer
  { glass: 0xcfe0e0, drink: 0xe8d98a, label: 0xfbf8f1, band: 0x93a88c, foil: 0xc9ccd2 },   // clear lager
  { glass: 0x6f9bb5, drink: 0x8fb8d0, label: 0xfbf8f1, band: 0xd4563f, foil: 0xd7ba78 },   // blue soda
];
const V2 = (x, y) => new THREE.Vector2(x, y);
const lathe = (points, mat, segments = 20) => new THREE.Mesh(new THREE.LatheGeometry(points.map(([x, y]) => V2(x, y)), segments), mat);
const ring = (radius, tube, y, mat, parent) => {
  const m = ink(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 24), mat), { edges: 0, hull: 0 });
  m.rotation.x = PI / 2;
  m.position.y = y;
  parent.add(m);
  return m;
};

function spill(parent, x, y, z, r, color, random) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -PI / 2;
  m.position.set(x, y + 0.003, z);
  m.scale.set(1, 0.6 + random() * 0.6, 1);
  m.rotation.z = random() * PI;
  parent.add(bare(m));
}

// A party cup on a surface at (x, y, z). A hollow shell with a white inside, a
// rolled rim and moulded ridges; upright (maybe with a drink left, maybe
// crushed) or on its side with a spill.
function cup(parent, x, y, z, random, { fallen = random() < 0.4 } = {}) {
  const color = CUP_COLORS[Math.floor(random() * CUP_COLORS.length)];
  const rt = 0.042, rb = 0.028, h = 0.1, wall = 0.0025;
  const at = t => rb + (rt - rb) * t;                  // radius at a fraction of the height
  const outer = paper(color, { finish: 'plastic', side: THREE.DoubleSide });
  const inner = paper(color === 0xfbf8f1 ? 0xeee8da : 0xfbf8f1, { finish: 'plastic', side: THREE.DoubleSide });
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  body.add(ink(lathe([[0, 0], [rb, 0], [rt, h]], outer), { edges: 0, hull: 0.004 }));
  body.add(ink(lathe([[rt - wall, h], [rb - wall, wall], [0, wall]], inner), { edges: 0, hull: 0 }));
  ring(rt, 0.0032, h, outer, body);                    // the rolled rim
  for (const t of [0.3, 0.55]) ring(at(t) + 0.0012, 0.0018, h * t, outer, body);   // ridges
  ring(rb + 0.001, 0.0018, 0.004, outer, body);
  if (fallen) {
    g.position.set(x, y + rt * 0.92, z);
    g.rotation.set(0, random() * PI * 2, (random() < 0.5 ? 1 : -1) * (1.35 + random() * 0.2));
    body.position.y = -h / 2;
    spill(parent, x + (random() - 0.5) * 0.12, y, z + (random() - 0.5) * 0.12, 0.05 + random() * 0.05, 0x7a4a2a, random);
  } else {
    g.position.set(x, y, z);
    if (random() < 0.25) { body.scale.set(1.14, 0.6, 0.92); g.rotation.z = (random() - 0.5) * 0.3; }   // stepped on
    else if (random() < 0.5) {
      const level = 0.25 + random() * 0.3;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(at(level) - wall - 0.001, 20), new THREE.MeshStandardMaterial({ color: DRINKS[Math.floor(random() * DRINKS.length)], roughness: 0.25 }));
      disc.rotation.x = -PI / 2;
      disc.position.y = h * level;
      body.add(bare(disc));
    }
  }
  parent.add(g);
}

// A see-through or glowing mesh at (x, y, z), kept out of the ink pass.
function placed(mesh, x, y, z) { mesh.position.set(x, y, z); return bare(mesh); }

// A bottle: moulded glass with a shoulder and neck, a paper label, foil and a
// crown cap. Standing or lying, empty or half full (the glass is see-through).
function bottle(parent, x, y, z, random, { fallen = random() < 0.45 } = {}) {
  const kind = BOTTLES[Math.floor(random() * BOTTLES.length)];
  const half = random() < 0.45;
  const tall = random() < 0.4;
  const r = tall ? 0.03 : 0.036, body = tall ? 0.2 : 0.14, neck = tall ? 0.11 : 0.085;
  const glassMat = new THREE.MeshStandardMaterial({ color: kind.glass, transparent: true, opacity: 0.55, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const top = body + neck;
  const g = new THREE.Group();
  const inside = new THREE.Group();   // origin on the bottle's base
  inside.add(placed(lathe([
    [0, 0], [r * 0.9, 0], [r, 0.008], [r, body], [r * 0.94, body + 0.02], [r * 0.7, body + neck * 0.35],
    [0.0175, body + neck * 0.7], [0.0148, top - 0.014], [0.0148, top - 0.006], [0.0172, top - 0.006], [0.0172, top],
  ], glassMat, 24), 0, 0, 0));
  if (half) {
    const level = body * (0.3 + random() * 0.25), ri = r - 0.003;
    inside.add(placed(lathe([[0, 0.006], [ri, 0.006], [ri, level], [0, level]], new THREE.MeshStandardMaterial({ color: kind.drink, roughness: 0.25 }), 24), 0, 0, 0));
    inside.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(ri * 0.98, ri * 0.98, 0.005, 24), new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.8 })), 0, level + 0.002, 0));
  }
  // The label: a paper wrap with a coloured band and a small round badge.
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.0014, r + 0.0014, 0.07, 28, 1, true), paper(kind.label, { side: THREE.DoubleSide }));
  inside.add(placed(wrap, 0, 0.056, 0));
  inside.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.0022, r + 0.0022, 0.02, 28, 1, true), paper(kind.band, { side: THREE.DoubleSide })), 0, 0.058, 0));
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.012, 14), paper(kind.label));
  badge.position.set(0, 0.058, r + 0.0032);
  inside.add(bare(badge));
  // Neck foil and the crown cap.
  inside.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.0163, 0.0178, 0.03, 16, 1, true), paper(kind.foil, { finish: 'metal', side: THREE.DoubleSide })), 0, top - 0.026, 0));
  const cap = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.0178, 0.0178, 0.008, 16), paper(C.ink, { finish: 'metal' })), { edges: 0, hull: 0 });
  cap.position.y = top + 0.004;
  inside.add(cap);
  ring(0.0178, 0.0026, top + 0.001, paper(C.ink, { finish: 'metal' }), inside);
  // Lying down, half full: it has leaked.
  if (fallen) {
    g.position.set(x, y + r, z);
    g.rotation.set(0, random() * PI * 2, PI / 2);
    inside.position.y = -body / 2;
    if (half) spill(parent, x, y, z, 0.07 + random() * 0.04, kind.drink, random);
  } else {
    g.position.set(x, y, z);
  }
  g.add(inside);
  parent.add(g);
}

function crumple(parent, x, y, z, random) {
  const r = 0.03 + random() * 0.03;
  const m = ink(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), paper(random() < 0.7 ? C.white : C.kraft)), { edges: 0, hull: 0 });
  m.scale.set(1 + random() * 0.3, 0.8 + random() * 0.3, 1 + random() * 0.3);
  m.position.set(x, y + r * 0.8, z);
  m.rotation.set(random() * 3, random() * 3, random() * 3);
  parent.add(m);
}

function can(parent, x, y, z, random) {
  const g = new THREE.Group();
  const color = [0xc9ccd2, C.coral, C.blue, 0x93a88c][Math.floor(random() * 4)];
  const h = 0.115, r = 0.033;
  const mat = paper(color, { finish: 'metal' });
  if (random() < 0.5) {
    g.position.set(x, y + r, z);
    g.rotation.set(0, random() * PI * 2, PI / 2);
    cyl(g, [r, r, h], [0, -h / 2, 0], mat, { edges: 0, hull: 0.003 }, 14);
  } else {
    g.position.set(x, y, z);
    cyl(g, [r, r, h * (random() < 0.3 ? 0.7 : 1)], [0, 0, 0], mat, { edges: 0, hull: 0.003 }, 14);
  }
  parent.add(g);
}

function crisps(parent, x, y, z, random) {
  const color = [C.coral, C.blue, C.ochre][Math.floor(random() * 3)];
  const m = ink(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.2), paper(color, { finish: 'plastic' })), { edges: 0, hull: 0.003 });
  m.position.set(x, y + 0.012, z);
  m.rotation.set((random() - 0.5) * 0.2, random() * PI * 2, (random() - 0.5) * 0.2);
  parent.add(m);
}

// A wedge of pizza with its point at the origin: cheese, a crust along the
// outer edge, pepperoni and a leaf of basil. `from` and `arc` are angles.
function pizzaSlice(radius, from, arc, random) {
  const g = new THREE.Group();
  const wedge = ink(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.014, 10, 1, false, from, arc), paper(0xe9b957, { finish: 'satin' })), { edges: 0, hull: 0.003 });
  wedge.position.y = 0.007;
  g.add(wedge);
  const crust = ink(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0145, 8, 12, arc), paper(0xc98746)), { edges: 0, hull: 0.003 });
  crust.rotation.set(PI / 2, 0, PI / 2 - (from + arc));   // the torus' arc, laid flat to match the wedge
  crust.position.y = 0.012;
  g.add(crust);
  const mid = from + arc / 2;
  const topping = (rho, da, r, color) => {
    const a = mid + da;
    const m = ink(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.005, 14), paper(color)), { edges: 0, hull: 0 });
    m.position.set(Math.sin(a) * rho, 0.0165, Math.cos(a) * rho);
    g.add(m);
    return m;
  };
  topping(radius * 0.55, -arc * 0.1, 0.017, 0xb3402e);
  topping(radius * 0.8, arc * 0.12, 0.017, 0xb3402e);
  if (random() < 0.6) topping(radius * 0.38, arc * 0.15, 0.011, 0x4f7a3a).scale.set(1.3, 1, 0.8);     // a leaf of basil
  if (random() < 0.5) topping(radius * 0.7, -arc * 0.2, 0.009, 0x2d2c2a);                              // an olive
  // Browned cheese blisters.
  for (let i = 0; i < 3; i++) {
    const a = from + arc * (0.15 + random() * 0.7), rho = radius * (0.3 + random() * 0.5);
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.008 + random() * 0.006, 8), new THREE.MeshBasicMaterial({ color: 0xc9892f, transparent: true, opacity: 0.7 }));
    m.rotation.x = -PI / 2;
    m.position.set(Math.sin(a) * rho, 0.0145, Math.cos(a) * rho);
    g.add(bare(m));
  }
  return g;
}

// A cardboard pizza box, lid propped open behind it, a printed logo on the lid
// and grease on the tray, with a few slices left (and one that got away).
function pizzaBox(parent, x, z, random) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = random() * PI * 2;
  const kraft = paper(0xe3cfa6), inner = paper(0xcdb88c);
  const S = 0.4, wall = 0.008, H = 0.042;
  box(g, [S, 0.006, S], [0, 0, 0], inner, { edges: 0, hull: 0.004 });
  box(g, [S, H, wall], [0, 0, S / 2 - wall / 2], kraft, { edges: 0, hull: 0.003 });
  box(g, [S, H, wall], [0, 0, -S / 2 + wall / 2], kraft, { edges: 0, hull: 0.003 });
  box(g, [wall, H, S - 2 * wall], [S / 2 - wall / 2, 0, 0], kraft, { edges: 0, hull: 0.003 });
  box(g, [wall, H, S - 2 * wall], [-S / 2 + wall / 2, 0, 0], kraft, { edges: 0, hull: 0.003 });
  // Grease soaked into the tray.
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.03 + random() * 0.05, 14), new THREE.MeshBasicMaterial({ color: 0x7a5530, transparent: true, opacity: 0.3, depthWrite: false }));
    m.rotation.x = -PI / 2;
    m.position.set((random() - 0.5) * 0.3, 0.0075, (random() - 0.5) * 0.3);
    g.add(bare(m));
  }
  // What is left of the pizza: a few slices side by side, the rest eaten.
  const pie = new THREE.Group();
  pie.position.y = 0.006;
  const left = 2 + Math.floor(random() * 3), start = random() * PI * 2;
  for (let i = 0; i < left; i++) pie.add(pizzaSlice(0.17, start + i * (PI / 4), PI / 4 - 0.03, random));
  g.add(pie);
  // The lid, hinged at the back and propped open.
  const hinge = new THREE.Group();
  hinge.position.set(0, H, -S / 2);
  hinge.rotation.x = -(1.45 + random() * 0.25);
  const lid = box(hinge, [S, 0.008, S], [0, 0, S / 2], kraft, { edges: 0, hull: 0.003 });
  lid.position.set(0, 0.004, S / 2);
  const logo = (y, side) => {
    const dot = cyl(hinge, [0.085, 0.085, 0.002], [0, y, S / 2], paper(0xd4563f), { edges: 0, hull: 0 }, 24);
    cyl(hinge, [0.06, 0.06, 0.002], [0, y + 0.002 * side, S / 2], paper(0xfbf8f1), { edges: 0, hull: 0 }, 24);
    cyl(hinge, [0.035, 0.035, 0.002], [0, y + 0.004 * side, S / 2], paper(0xd4563f), { edges: 0, hull: 0 }, 24);
    for (const dz of [-0.14, 0.14]) box(hinge, [0.2, 0.002, 0.014], [0, y + 0.002 * side, S / 2 + dz], paper(0xd4563f), { edges: 0, hull: 0 });
    return dot;
  };
  logo(0.008, 1);
  g.add(hinge);
  parent.add(g);
  // The slice that got away, next to the box.
  const stray = pizzaSlice(0.2, -0.35, 0.7, random);
  stray.position.set(S * 0.7, 0, S * 0.2);
  stray.rotation.y = random() * PI * 2;
  g.add(stray);
}

// Confetti: one instanced mesh of tiny flat pieces on the floor.
function confetti(parent, nav, random, count = 180) {
  const geo = new THREE.PlaneGeometry(0.06, 0.03);
  geo.rotateX(-PI / 2);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const [px, pz] = nav.randomFree(random);
    e.set((random() - 0.5) * 0.3, random() * PI * 2, (random() - 0.5) * 0.3);
    m.compose(new THREE.Vector3(px + (random() - 0.5) * 0.2, 0.006 + random() * 0.004, pz + (random() - 0.5) * 0.2), q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHSL(random(), 0.9, 0.6));
  }
  mesh.userData.outline = 'skip';
  mesh.frustumCulled = false;
  parent.add(mesh);
}

// Where things go: scattered over the free floor, and a few on tables. Table
// tops are world positions measured against furniture.js (desk top 0.76 m, cafe
// table 0.755 m); the mug and plate on the cafe tables sit at +0.05, +0.02.
const TABLES = [
  { x: -3.9, z: -3.05, y: 0.76, spread: [[-0.95, -0.3], [-0.2, 0.25], [0.55, -0.3], [0.45, 0.68], [0.2, 0.75]] },
  { x: 3.85, z: -2.25, y: 0.755, spread: [[-0.2, 0.1], [-0.1, -0.22]] },
  { x: -3.75, z: 1.45, y: 0.755, spread: [[-0.18, 0.12], [0.15, -0.2]] },
];

function buildMess(nav, random) {
  const g = new THREE.Group();
  g.name = 'party-mess';
  const floor = () => { const [x, z] = nav.randomFree(random); return { x, z }; };
  const jitter = () => (random() - 0.5) * 0.12;

  for (let i = 0; i < 12; i++) { const p = floor(); cup(pivot(g, p.x + jitter(), 0, p.z + jitter()), 0, 0, 0, random); }
  for (let i = 0; i < 8; i++) { const p = floor(); bottle(pivot(g, p.x, 0, p.z), 0, 0, 0, random); }
  for (let i = 0; i < 14; i++) { const p = floor(); crumple(pivot(g, p.x + jitter(), 0, p.z + jitter()), 0, 0, 0, random); }
  for (let i = 0; i < 5; i++) { const p = floor(); can(pivot(g, p.x, 0, p.z), 0, 0, 0, random); }
  for (let i = 0; i < 4; i++) { const p = floor(); crisps(pivot(g, p.x, 0, p.z), 0, 0, 0, random); }
  for (let i = 0; i < 2; i++) { const p = floor(); pizzaBox(pivot(g, 0, 0, 0, 1.3), p.x / 1.3, p.z / 1.3, random); }

  // On the desk and the cafe tables: a cup, a bottle or two, a tipped cup.
  for (const t of TABLES) {
    t.spread.forEach(([dx, dz], i) => {
      const x = t.x + dx, z = t.z + dz;
      if (i % 3 === 1) bottle(pivot(g, x, t.y, z, 1.3), 0, 0, 0, random, { fallen: false });
      else cup(pivot(g, x, t.y, z, 1.3), 0, 0, 0, random, { fallen: i % 3 === 2 && random() < 0.7 });
    });
    crumple(pivot(g, t.x + (random() - 0.5) * 0.3, t.y, t.z + (random() - 0.5) * 0.3, 1.3), 0, 0, 0, random);
  }

  confetti(g, nav, random);
  return g;
}

// ---- The whole party ----

export function createParty({ nav, random = () => Math.random() }) {
  const root = new THREE.Group();     // always in the scene, so the lights always count
  root.name = 'party';
  const stuff = new THREE.Group();    // what shows only while the party is on
  stuff.visible = false;
  root.add(stuff);

  const ballPart = buildBall();
  const box_ = buildBoombox();
  const mess = buildMess(nav, random);
  stuff.add(ballPart.group, box_.group, mess);

  // The light the ball throws: one colour that drifts, one that sweeps the room.
  const glow = new THREE.PointLight(0xff3d81, 0, 0, 2);
  glow.position.set(BALL.x, BALL.y - 0.15, BALL.z);
  const sweep = new THREE.SpotLight(0x35e0ff, 0, 0, 0.55, 0.85, 1.6);
  sweep.position.set(BALL.x, BALL.y - 0.1, BALL.z);
  root.add(glow, sweep, sweep.target);

  // A pink glow from the boombox itself.
  const bass = new THREE.PointLight(0xff3d81, 0, 2.4, 2);
  bass.position.set(BOOMBOX.x, 0.4, BOOMBOX.z + 0.3);
  root.add(bass);

  // Beams from the ball, each ending where it meets the room, with a bright
  // spot there.
  const coneGeo = new THREE.ConeGeometry(1, 1, 10, 1, true);
  coneGeo.translate(0, -0.5, 0);    // apex at the origin, opening toward -y
  const spotGeo = new THREE.CircleGeometry(1, 20);
  // A soft, faded blob instead of a hard-edged disc.
  const blob = document.createElement('canvas');
  blob.width = blob.height = 64;
  const bg = blob.getContext('2d');
  const grad = bg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.8)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  bg.fillStyle = grad; bg.fillRect(0, 0, 64, 64);
  const blobTex = new THREE.CanvasTexture(blob);
  const beams = [];
  for (let i = 0; i < BEAMS; i++) {
    const cone = bare(new THREE.Mesh(coneGeo, additive(0xffffff)));
    const dot = bare(new THREE.Mesh(spotGeo, additive(0xffffff)));
    dot.material.map = blobTex;
    cone.frustumCulled = dot.frustumCulled = false;
    stuff.add(cone, dot);
    beams.push({ cone, dot, tilt: 0.25 + (i % 4) * 0.17, spin: i * (PI * 2 / BEAMS) * 1.0 + (i % 2) * 0.6 });
  }

  const dir = new THREE.Vector3(), up = new THREE.Vector3(0, -1, 0), normal = new THREE.Vector3(), from = new THREE.Vector3(BALL.x, BALL.y, BALL.z);
  const ceil = ROOM.HI - 0.03;
  const hx = ROOM.W / 2 - 0.03, hz = ROOM.D / 2 - 0.03;
  // Where a ray from the ball meets the floor or a wall; fills `normal`.
  function hit(d) {
    let t = Infinity;
    const test = (dist, nx, ny, nz) => { if (dist > 0 && dist < t) { t = dist; normal.set(nx, ny, nz); } };
    if (d.y < -1e-3) test((0 - from.y) / d.y, 0, 1, 0); else if (d.y > 1e-3) test((ceil - from.y) / d.y, 0, -1, 0);
    if (d.x > 1e-3) test((hx - from.x) / d.x, -1, 0, 0); else if (d.x < -1e-3) test((-hx - from.x) / d.x, 1, 0, 0);
    if (d.z > 1e-3) test((hz - from.z) / d.z, 0, 0, -1); else if (d.z < -1e-3) test((-hz - from.z) / d.z, 0, 0, 1);
    return t;
  }

  const state = { on: false, fade: 0, beat: 0, intensity: 0 };
  const q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
  const period = 60 / BPM;

  return {
    group: root,
    boombox: { x: BOOMBOX.x, z: BOOMBOX.z },
    lights: [glow, sweep, bass],
    state,
    update(on, time, dt, beat = null) {
      state.on = on;
      state.fade += ((on ? 1 : 0) - state.fade) * Math.min(1, dt * 3);
      if (!on && state.fade < 0.01) state.fade = 0;
      const f = state.fade;
      stuff.visible = on || f > 0;
      for (const l of [glow, sweep, bass]) if (f === 0) l.intensity = 0;
      if (f === 0) return;

      // Without music (sound off) the lights keep time on their own.
      const kick = beat ?? Math.exp(-((time % period) / period) * 7);
      state.beat = kick;

      const hue = time * 0.07;
      glow.color.copy(hueColor(hue));
      glow.intensity = f * (6 + kick * 12);
      sweep.color.copy(hueColor(hue + 0.5));
      sweep.intensity = f * (18 + kick * 16);
      const a = time * 0.5;
      sweep.target.position.set(BALL.x + Math.cos(a) * 3.4, 0, BALL.z + Math.sin(a * 1.3) * 2.2);
      bass.color.copy(hueColor(hue + 0.15));
      bass.intensity = f * kick * 3;
      state.intensity = glow.intensity;

      // The ball turns and sparkles.
      ballPart.update(time, kick);

      // Beams swing about under the ball.
      beams.forEach((b, i) => {
        const theta = time * (0.45 + (i % 3) * 0.12) * (i % 2 ? -1 : 1) + b.spin;
        const phi = PI * (0.5 + 0.42 * Math.sin(time * (0.25 + (i % 5) * 0.06) + i * 2.4));   // down, sideways and up
        dir.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
        const len = hit(dir);
        const colour = hueColor(hue + i / BEAMS, 0.6);
        const end = 0.1 + len * 0.025;
        b.cone.position.copy(from);
        b.cone.quaternion.setFromUnitVectors(up, dir);
        b.cone.scale.set(end, len, end);
        b.cone.material.color.copy(colour);
        b.cone.material.opacity = f * (0.06 + kick * 0.05);
        b.dot.position.copy(from).addScaledVector(dir, len).addScaledVector(normal, 0.012);
        b.dot.quaternion.copy(q.setFromUnitVectors(zAxis, normal));
        b.dot.scale.setScalar(0.4 + kick * 0.08);
        b.dot.material.color.copy(colour);
        b.dot.material.opacity = f * (0.22 + kick * 0.12);
      });

      // The speakers pump.
      for (const w of box_.woofers) w.scale.set(1 + kick * 0.1, 1, 1 + kick * 0.1);
      box_.display.material.color.copy(hueColor(hue + 0.3, 0.45 + kick * 0.15));
      box_.group.position.y = kick * 0.004;
    },
  };
}
