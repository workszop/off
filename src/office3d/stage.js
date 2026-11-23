// ---- Stage ----
// The set a show puts up in the office (SHOWS in data.js), in the same
// cut-card style as furniture.js: for the garage band a drum kit, two amps,
// a keyboard on an X stand, a mic stand and a rug; for Christmas a decorated
// tree, piles of gifts and strings of coloured lights high on the walls; for
// the murder mystery a chalk outline, a taped-off cordon, evidence markers
// and the weapon (a stapler). Two
// warm spotlights wash the set while a show is on; the room look is in
// lighting.js and the music in sound.js.
//
//   const stage = createStage({ scene });
//   stage.update(sim.state.show, time, dt, beat);   // beat 0..1, or null
//   director.look(stage.subject('band'));
//
// A set is built the first time its show is on and kept afterwards. Like the
// party's lights, the spotlights live as long as the page and only change
// intensity: adding or removing a light makes three.js rebuild every shader.
// They cast no shadows (the sun is the only shadow-casting light).

import * as THREE from 'three';
import { C, paper, box, rbox, cyl, rod, patch, ink, canvasTexture, contactShadow } from './materials.js';
import { SHOWS } from './data.js';

const PI = Math.PI;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const chrome = () => paper(0xb8bcc4, { finish: 'metal' });
const brass = () => paper(0xd7b25a, { finish: 'metal' });
const black = () => paper(0x2d2c35, { finish: 'plastic' });

// A soft shadow on the rug under a piece (the rug lies at 0.004 m).
function shade(parent, w, d, opacity) {
  const m = contactShadow(w, d, opacity);
  m.position.y = 0.007;
  parent.add(m);
}

// A three-legged stand foot at (x, z) on the floor under a pole.
function tripod(g, x, z, spread = 0.16, height = 0.22) {
  for (let i = 0; i < 3; i++) {
    const a = i * (PI * 2 / 3) + PI / 6;
    rod(g, v(x, height, z), v(x + Math.cos(a) * spread, 0, z + Math.sin(a) * spread), 0.009, chrome());
  }
}

// A drum: a shell with a white head on top, standing on its own axis (y).
function drum(parent, r, h, [x, y, z], shell, tilt = 0) {
  const d = new THREE.Group();
  d.position.set(x, y, z);
  d.rotation.x = tilt;
  cyl(d, [r, r, h], [0, -h / 2, 0], shell, { edges: 40, hull: 0.006 }, 28);
  cyl(d, [r * 1.02, r * 1.02, 0.014], [0, h / 2 - 0.012, 0], chrome(), { edges: 0, hull: 0 }, 28);
  cyl(d, [r * 0.97, r * 0.97, 0.004], [0, h / 2, 0], paper(C.white), { edges: 0, hull: 0 }, 28);
  parent.add(d);
  return d;
}

// A cymbal: a shallow brass cone with a little bell, on a pole from the floor.
function cymbal(parent, r, [x, y, z], tilt = 0) {
  rod(parent, v(x, 0.2, z), v(x, y, z), 0.009, chrome());
  tripod(parent, x, z);
  const c = new THREE.Group();
  c.position.set(x, y, z);
  c.rotation.x = tilt;
  cyl(c, [0.03, r, 0.018], [0, 0, 0], brass(), { edges: 0, hull: 0.004 }, 24);
  cyl(c, [0.012, 0.03, 0.02], [0, 0.016, 0], brass(), { edges: 0, hull: 0 }, 12);
  parent.add(c);
  return c;
}

// ---- Pieces ----
// Each builder gets its set entry and the show (for extra fields such as a
// light string's `length`, or the show's tempo) and returns { object } and,
// for a piece that moves, animate(time, hit, playing, show): called every frame
// while the set is up, with hit 0..1 on the beat of the music (0 without
// sound or between songs) and playing true while the show plays. The
// object's origin is on the floor at the piece's centre (or at its pins, for
// a piece hung at height `y`), front = +z (toward the default camera).

// Drum kit, about 1.4 m x 0.6 m. The drummer stands behind it (-z), so the
// kit stays low: nothing above 1.1 m, the middle under 0.75 m.
function drumKit() {
  const g = new THREE.Group();
  const shell = paper(C.coral, { finish: 'satin' });
  // Bass drum on its side, the front head to the audience with a band patch.
  const bass = new THREE.Group();
  bass.position.set(0, 0.27, 0.05);
  bass.rotation.x = PI / 2;
  cyl(bass, [0.26, 0.26, 0.36], [0, -0.18, 0], shell, { edges: 40, hull: 0.006 }, 32);
  for (const y of [-0.18, 0.168]) cyl(bass, [0.268, 0.268, 0.012], [0, y, 0], chrome(), { edges: 0, hull: 0 }, 32);
  const head = cyl(bass, [0.25, 0.25, 0.004], [0, 0.18, 0], paper(C.white), { edges: 0, hull: 0 }, 32);
  g.add(bass);
  patch(g, 0.26, 0.12, C.blue, [0, 0.27, 0.235], [0, 0, 0.05], 7);
  for (const x of [-0.2, 0.2]) rod(g, v(x, 0.1, 0.18), v(x * 1.5, 0, 0.26), 0.01, chrome());   // spurs
  // Snare on its stand, to the drummer's left of the bass drum.
  rod(g, v(-0.36, 0.2, -0.14), v(-0.36, 0.5, -0.14), 0.01, chrome());
  tripod(g, -0.36, -0.14);
  drum(g, 0.17, 0.13, [-0.36, 0.56, -0.14], shell, -0.12);
  // Two toms on the bass drum, leaning to the drummer.
  rod(g, v(0, 0.52, 0.02), v(0, 0.6, -0.02), 0.012, chrome());
  drum(g, 0.12, 0.15, [-0.14, 0.64, -0.03], shell, -0.3);
  drum(g, 0.13, 0.16, [0.15, 0.65, -0.03], shell, -0.3);
  // Floor tom on three short legs.
  for (const [dx, dz] of [[-0.16, 0.1], [0.16, 0.1], [0, -0.18]]) rod(g, v(0.48 + dx * 0.9, 0.2, -0.08 + dz * 0.9), v(0.48 + dx * 1.2, 0, -0.08 + dz * 1.2), 0.01, chrome());
  drum(g, 0.19, 0.32, [0.48, 0.38, -0.08], shell);
  // Hi-hat: two cymbals on one pole, far left.
  const hats = new THREE.Group();
  rod(g, v(-0.6, 0.2, 0), v(-0.6, 0.86, 0), 0.009, chrome());
  tripod(g, -0.6, 0);
  hats.position.set(-0.6, 0.85, 0);
  for (const y of [0, 0.026]) cyl(hats, [0.025, 0.16, 0.014], [0, y, 0], brass(), { edges: 0, hull: 0.004 }, 24);
  g.add(hats);
  // Crash and ride, the highest things in the kit, out at the sides.
  const crash = cymbal(g, 0.2, [-0.4, 1.02, 0.2], 0.2);
  const ride = cymbal(g, 0.22, [0.6, 0.96, 0.18], 0.16);
  shade(g, 1.6, 0.8, 0.3);
  const cymbals = [crash, ride, hats];
  // The kit answers the music while the band plays, and is still between songs.
  function animate(time, hit) {
    for (let i = 0; i < cymbals.length; i++) cymbals[i].rotation.z = hit * 0.09 * Math.sin(time * 19 + i * 2.1);
    bass.scale.set(1 + hit * 0.03, 1, 1 + hit * 0.03);
    head.scale.set(1 + hit * 0.04, 1, 1 + hit * 0.04);
  }
  return { object: g, animate };
}

// Combo amp, about 0.6 m wide, 0.6 m tall, 0.4 m deep.
function amp() {
  const g = new THREE.Group();
  rbox(g, [0.6, 0.6, 0.4], [0, 0, 0], black(), 0.03);
  box(g, [0.52, 0.4, 0.01], [0, 0.05, 0.2], paper(0x4a4652, { finish: 'fabric' }), { edges: 0, hull: 0 });   // grille cloth
  box(g, [0.56, 0.07, 0.01], [0, 0.5, 0.2], paper(C.ochre, { finish: 'metal' }), { edges: 0, hull: 0 });    // control panel
  for (let i = 0; i < 5; i++) {
    const knob = cyl(g, [0.014, 0.014, 0.014], [-0.2 + i * 0.1, 0.535, 0.206], black(), { edges: 0, hull: 0 }, 12);
    knob.rotation.x = PI / 2;
  }
  patch(g, 0.16, 0.05, C.coral, [0.15, 0.37, 0.207], [0, 0, -0.04], 4);   // the badge
  rod(g, v(-0.12, 0.62, 0), v(0.12, 0.62, 0), 0.012, black());               // handle
  shade(g, 0.8, 0.6, 0.32);
  return { object: g };
}

let keysTex;
// Keyboard on an X stand: the keys at about 0.9 m.
function keyboard() {
  const g = new THREE.Group();
  // The stand: a pair of crossed legs at each end and a bar between them.
  for (const x of [-0.36, 0.36]) {
    rod(g, v(x, 0, -0.14), v(x, 0.82, 0.12), 0.012, black());
    rod(g, v(x, 0, 0.14), v(x, 0.82, -0.12), 0.012, black());
  }
  rod(g, v(-0.36, 0.41, 0), v(0.36, 0.41, 0), 0.01, black());
  for (const x of [-0.36, 0.36]) rod(g, v(x, 0.82, -0.12), v(x, 0.82, 0.12), 0.012, black());
  // The instrument: a body, a key bed facing the player (-z) and a panel.
  rbox(g, [1.0, 0.07, 0.3], [0, 0.83, 0], black(), 0.02);
  keysTex ??= canvasTexture(512, 64, (c, w, h) => {
    c.fillStyle = '#fbf8f1';
    c.fillRect(0, 0, w, h);
    const n = 36, kw = w / n;
    c.strokeStyle = '#8d877c';
    for (let i = 1; i < n; i++) { c.beginPath(); c.moveTo(i * kw, 0); c.lineTo(i * kw, h); c.stroke(); }
    c.fillStyle = '#2d2c35';
    for (let i = 0; i < n - 1; i++) if (![2, 6].includes(i % 7)) c.fillRect((i + 0.68) * kw, 0, kw * 0.64, h * 0.6);
  });
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.15), paper(C.white, { map: keysTex }));
  keys.rotation.x = -PI / 2;
  keys.rotation.z = PI;               // the low notes to the player's left
  keys.position.set(0, 0.902, -0.06);
  keys.receiveShadow = true;
  g.add(keys);
  box(g, [0.9, 0.012, 0.1], [0, 0.9, 0.09], paper(C.screen, { finish: 'gloss' }), { edges: 0, hull: 0 });
  patch(g, 0.2, 0.05, C.ochre, [-0.3, 0.913, 0.09], [-PI / 2, 0, 0], 9);
  shade(g, 1.1, 0.5, 0.22);
  return { object: g };
}

// Mic stand, about 1.2 m: a round base, a pole and a boom that brings the
// mic back to the singer behind it (-z), at the chin of the drawing on a
// 1.62 m card, so the face stays in view above it.
function micStand() {
  const g = new THREE.Group();
  cyl(g, [0.13, 0.14, 0.025], [0, 0, 0], black(), { edges: 0, hull: 0.004 }, 24);
  rod(g, v(0, 0.02, 0), v(0, 1.07, 0), 0.01, black());
  rod(g, v(0, 1.04, 0.08), v(0, 1.17, -0.2), 0.009, black());
  const mic = new THREE.Group();
  mic.position.set(0, 1.17, -0.2);
  mic.rotation.x = -PI / 2 + 0.25;   // tipped up a little, to the singer's mouth
  cyl(mic, [0.02, 0.014, 0.1], [0, 0, 0], black(), { edges: 0, hull: 0.004 }, 12);
  const grille = ink(new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), chrome()), { edges: 0, hull: 0.004 });
  grille.position.y = 0.12;
  mic.add(grille);
  g.add(mic);
  return { object: g };
}

let rugTex;
// Rug, 3.6 m x 2.6 m, flat on the floor just above it (no z-fighting).
function rug() {
  rugTex ??= canvasTexture(360, 260, (c, w, h) => {
    c.fillStyle = '#b85a48';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e7c88a';
    c.lineWidth = 8;
    c.strokeRect(14, 14, w - 28, h - 28);
    c.strokeStyle = '#2f3d52';
    c.lineWidth = 4;
    c.strokeRect(28, 28, w - 56, h - 56);
    c.fillStyle = 'rgba(231,200,138,0.55)';
    for (let x = 60; x < w - 40; x += 40) for (let y = 60; y < h - 40; y += 40) {
      c.beginPath();
      c.moveTo(x, y - 9); c.lineTo(x + 9, y); c.lineTo(x, y + 9); c.lineTo(x - 9, y);
      c.fill();
    }
  });
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), paper(C.white, { map: rugTex, finish: 'fabric' }));
  m.rotation.x = -PI / 2;
  m.position.y = 0.004;
  m.receiveShadow = true;
  g.add(m);
  return { object: g };
}

// ---- Christmas ----

// Fairy-light bulbs, shared by the tree and every light string: four colours,
// unlit (they glow, no real lights: the page makes its lights once), in two
// groups that take turns, red and gold against green and blue.
const BULB_COLORS = [0xff5a45, 0x4fd27a, 0xffc84f, 0x5f9dff];
const bulbs = BULB_COLORS.map(color => {
  const m = new THREE.MeshBasicMaterial({ color });
  m.userData.base = new THREE.Color(color);
  return m;
});
let twinkledAt = NaN;
// Twinkle: on the beat while the carol plays (each beat lights the other
// group, and a hit of the music brightens both), a slow swell between carols.
function twinkle(time, hit, playing, bpm) {
  if (time === twinkledAt) return;    // every piece calls this; once a frame is enough
  twinkledAt = time;
  let a, b;
  if (playing) {
    const even = Math.floor(time * bpm / 60) % 2 === 0;
    a = (even ? 1 : 0.4) + hit * 0.4;
    b = (even ? 0.4 : 1) + hit * 0.4;
  } else {
    const k = 0.5 + 0.5 * Math.sin(time * 1.4);
    a = 0.45 + 0.5 * k;
    b = 0.45 + 0.5 * (1 - k);
  }
  for (let i = 0; i < bulbs.length; i++) bulbs[i].color.copy(bulbs[i].userData.base).multiplyScalar(i % 2 === 0 ? a : b);
}

const bulbGeometry = new THREE.SphereGeometry(1, 10, 8);
const capGeometry = new THREE.CylinderGeometry(0.6, 0.6, 1, 8);
// Bulbs at the given points, one InstancedMesh per colour (point i gets
// colour i % 4), each hanging a little under its point.
function bulbString(parent, points, radius, { caps = true } = {}) {
  const dummy = new THREE.Object3D();
  BULB_COLORS.forEach((_, c) => {
    const mine = points.filter((_, i) => i % BULB_COLORS.length === c);
    if (!mine.length) return;
    const mesh = new THREE.InstancedMesh(bulbGeometry, bulbs[c], mine.length);
    const cap = caps ? new THREE.InstancedMesh(capGeometry, black(), mine.length) : null;
    mine.forEach((p, i) => {
      dummy.position.set(p.x, p.y - radius * 1.5, p.z);
      dummy.scale.set(radius, radius * 1.35, radius);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (cap) {
        dummy.position.set(p.x, p.y - radius * 0.1, p.z);
        dummy.scale.set(radius, radius * 0.9, radius);
        dummy.updateMatrix();
        cap.setMatrixAt(i, dummy.matrix);
      }
    });
    parent.add(mesh);
    if (cap) parent.add(cap);
  });
}

// A path through the given points, for a cord or a garland.
class Polyline extends THREE.Curve {
  constructor(points) { super(); this.points = points; }
  getPoint(t, target = new THREE.Vector3()) {
    const n = this.points.length - 1, f = Math.min(n - 1e-6, Math.max(0, t * n)), i = Math.floor(f);
    return target.copy(this.points[i]).lerp(this.points[i + 1], f - i);
  }
}

// A string of lights, `length` metres along its local x, hung at its origin
// (the pins) and sagging between them; bulbs every 0.27 m. The cord is thin
// and dark and carries no contour of its own.
const BULB_GAP = 0.27;
function lightString(entry = {}) {
  const length = entry.length ?? 4;
  const g = new THREE.Group();
  const spans = Math.max(1, Math.round(length / 1.35)), span = length / spans, sag = 0.17;
  const y = x => {
    const u = ((x + length / 2) / span) % 1;
    return -sag * 4 * u * (1 - u);
  };
  const cord = [];
  for (let i = 0, n = spans * 16; i <= n; i++) {
    const x = -length / 2 + (length * i) / n;
    cord.push(v(x, y(x), 0));
  }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new Polyline(cord), spans * 32, 0.006, 5, false), black());
  g.add(tube);
  // A pin at each end and between the spans: a small card tab tacked to the wall.
  for (let i = 0; i <= spans; i++) box(g, [0.035, 0.05, 0.02], [-length / 2 + i * span, -0.02, -0.01], paper(C.ochre), { edges: 0, hull: 0 });
  const points = [];
  const count = Math.floor(length / BULB_GAP);
  for (let i = 0; i <= count; i++) {
    const x = -length / 2 + (length - count * BULB_GAP) / 2 + i * BULB_GAP;
    points.push(v(x, y(x), 0.008));
  }
  bulbString(g, points, 0.028);
  return { object: g, hang: true };
}

// The tree, about 2.4 m: a pot, a short trunk, four green tiers, a gold star,
// baubles (one instanced mesh, coloured per bauble) and a spiral of bulbs.
const TIERS = [   // [bottom, radius, height]
  [0.48, 0.6, 0.72],
  [0.88, 0.49, 0.64],
  [1.26, 0.37, 0.58],
  [1.62, 0.25, 0.6],
];
const BAUBLE_COLORS = [0xd4483b, 0xd7b25a, 0x5d7fc7, 0xfbf8f1, 0xb54a8a];
let starShape;
function xmasTree(entry, spec) {
  const g = new THREE.Group();
  // Pot and soil.
  cyl(g, [0.27, 0.21, 0.32], [0, 0, 0], paper(C.coral, { finish: 'satin' }), { edges: 40, hull: 0.006 }, 28);
  cyl(g, [0.285, 0.285, 0.05], [0, 0.29, 0], paper(0xc0634e, { finish: 'satin' }), { edges: 40, hull: 0.006 }, 28);
  cyl(g, [0.25, 0.25, 0.01], [0, 0.32, 0], paper(C.coffee), { edges: 0, hull: 0 }, 24);
  patch(g, 0.2, 0.1, C.ochre, [0, 0.15, 0.255], [0, 0, 0.05], 11);
  cyl(g, [0.06, 0.075, 0.3], [0, 0.3, 0], paper(0x7a5236), { edges: 40, hull: 0.006 }, 12);
  // The tiers: cones of two greens, each overlapping the one below.
  const greens = [paper(0x4f7d57, { finish: 'leaf' }), paper(0x5f8f63, { finish: 'leaf' })];
  TIERS.forEach(([y, r, h], i) => cyl(g, [0.015, r, h], [0, y, 0], greens[i % 2], { edges: 40, hull: 0.006 }, 32));
  // The widest tier at a height: the outside of the tree.
  const envelope = y => TIERS.reduce((best, [y0, r, h]) => (y >= y0 && y <= y0 + h ? Math.max(best, r * (1 - (y - y0) / h)) : best), 0);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Baubles round the lower part of each tier, all the way round.
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const places = [];
  TIERS.forEach(([y0, r, h], t) => {
    const n = [12, 10, 8, 6][t];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + t * 0.7 + rnd() * 0.3, yy = y0 + h * (0.08 + rnd() * 0.25);
      const rr = r * (1 - (yy - y0) / h) + 0.02;
      places.push([Math.sin(a) * rr, yy, Math.cos(a) * rr]);
    }
  });
  const baubles = new THREE.InstancedMesh(bulbGeometry, paper(C.white, { finish: 'gloss' }), places.length);
  places.forEach(([x, y, z], i) => {
    dummy.position.set(x, y - 0.045, z);
    dummy.scale.setScalar(0.045 + (i % 3) * 0.008);
    dummy.updateMatrix();
    baubles.setMatrixAt(i, dummy.matrix);
    baubles.setColorAt(i, color.set(BAUBLE_COLORS[i % BAUBLE_COLORS.length]));
  });
  g.add(baubles);
  // A gold garland and a string of bulbs wound round it, bottom to top.
  const turns = 3.2, from = 0.55, to = 2.08;
  const wound = (n, out) => Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, y = from + (to - from) * t, a = t * turns * PI * 2 + 0.4;
    const r = envelope(y) + out;
    return v(Math.sin(a) * r, y, Math.cos(a) * r);
  });
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new Polyline(wound(240, 0.012)), 480, 0.01, 5, false), brass()));
  bulbString(g, wound(46, 0.03).slice(1), 0.022, { caps: false });
  // The star, flat and facing the room.
  if (!starShape) {
    starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI * 2, r = i % 2 === 0 ? 0.15 : 0.065;
      const x = Math.sin(a) * r, y = Math.cos(a) * r;
      if (i === 0) starShape.moveTo(x, y); else starShape.lineTo(x, y);
    }
    starShape.closePath();
  }
  const star = ink(new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.03, bevelEnabled: false }),
    paper(0xf2c24e, { finish: 'satin', emissive: 0x8a6414 })), { edges: 30 });
  star.position.set(0, 2.33, -0.015);
  g.add(star);
  shade(g, 1.4, 1.4, 0.3);
  const bpm = spec?.bpm ?? 100;
  return { object: g, animate: (time, hit, playing) => twinkle(time, hit, playing, bpm) };
}

// A pile of three or four wrapped gifts, each with a ribbon cross and a bow.
const GIFTS = [   // [w, h, d, x, y, z, turn, paper, ribbon]
  [0.42, 0.3, 0.34, 0, 0, 0, 0, C.coral, C.white],
  [0.3, 0.22, 0.26, 0.36, 0, 0.1, 0.4, C.blue, C.ochre],
  [0.22, 0.17, 0.22, 0.02, 0.3, -0.01, -0.3, C.sage, 0xc0473b],
  [0.24, 0.14, 0.18, -0.3, 0, 0.18, -0.5, C.ochre, 0x4f7d57],
];
function gifts() {
  const g = new THREE.Group();
  for (const [w, h, d, x, y, z, turn, wrap, ribbon] of GIFTS) {
    const gift = new THREE.Group();
    gift.position.set(x, y, z);
    gift.rotation.y = turn;
    box(gift, [w, h, d], [0, 0, 0], paper(wrap, { finish: 'satin' }));
    const band = paper(ribbon, { finish: 'satin' });
    box(gift, [0.04, h + 0.004, d + 0.006], [0, -0.002, 0], band, { edges: 0, hull: 0 });
    box(gift, [w + 0.006, h + 0.004, 0.04], [0, -0.002, 0], band, { edges: 0, hull: 0 });
    for (const side of [-1, 1]) {
      const loop = ink(new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.01, 6, 14), band), { edges: 0, hull: 0.004 });
      loop.position.set(side * 0.03, h + 0.025, 0);
      loop.rotation.set(0, PI / 2, side * 0.5);
      gift.add(loop);
    }
    g.add(gift);
  }
  shade(g, 1.0, 0.8, 0.26);
  return { object: g };
}

// ---- Murder mystery ----

// Chalk outline round the body, flat on the floor (the lying card, about
// 1.0 m x 1.6 m, lies just above it, see standee.js). The line follows the
// edge of the card itself (head up = -z), a hand's width outside it, in a
// rough double stroke of chalk with a faint grey edge, so it reads on the
// pale floor and the body lies inside it.
const CHALK_W = 1.3, CHALK_D = 1.95, CHALK_PX = 240;   // metres, texture pixels per metre
// The edge of the lying card in its frame (640 x 960), the union of all eight
// drawings, traced on 64 rays from (320, 500), clockwise from the right.
const SPRAWL_MID = [320, 500];
const SPRAWL = [
  [598, 500], [584, 526], [572, 550], [568, 575], [572, 604], [566, 632], [562, 662], [566, 702],
  [578, 758], [592, 832], [565, 867], [531, 895], [489, 907], [445, 911], [401, 906], [360, 905],
  [320, 892], [280, 902], [240, 904], [196, 909], [151, 907], [111, 891], [80, 859], [64, 812],
  [113, 707], [105, 676], [98, 648], [83, 627], [78, 600], [76, 574], [67, 550], [68, 525],
  [58, 500], [56, 474], [61, 448], [69, 424], [80, 401], [86, 375], [101, 354], [100, 319],
  [121, 301], [141, 282], [157, 256], [162, 204], [177, 154], [200, 104], [235, 73], [276, 53],
  [320, 48], [364, 54], [404, 75], [439, 107], [464, 152], [484, 194], [480, 261], [504, 276],
  [528, 292], [547, 313], [550, 346], [561, 371], [581, 392], [595, 417], [599, 445], [599, 473],
];
const SPRAWL_PX = 1.62 / 863;   // metres per pixel of the lying drawing (standee.js PX)
const CHALK_GAP = 0.055;        // metres between the card's edge and the chalk
let chalkTex;
function chalkOutline() {
  chalkTex ??= canvasTexture(Math.round(CHALK_W * CHALK_PX), Math.round(CHALK_D * CHALK_PX), (c, w, h) => {
    // A frame pixel on the canvas, pushed out from the middle by the gap.
    const at = ([fx, fy]) => {
      const dx = fx - SPRAWL_MID[0], dy = fy - SPRAWL_MID[1], r = Math.hypot(dx, dy);
      const k = (r + CHALK_GAP / SPRAWL_PX) / r * SPRAWL_PX * CHALK_PX;
      return [w / 2 + (fx - dx - 320) * SPRAWL_PX * CHALK_PX + dx * k, h / 2 + (fy - dy - 480) * SPRAWL_PX * CHALK_PX + dy * k];
    };
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
    c.lineJoin = c.lineCap = 'round';
    // A grey edge first, then two passes of chalk a little apart, like a hand going round twice.
    for (const [width, jitter, colour] of [[17, 2, '#7d776c'], [12, 2, '#ffffff'], [7, 3.5, '#ffffff']]) {
      c.strokeStyle = colour;
      c.lineWidth = width;
      const pts = SPRAWL.map(p => { const [x, y] = at(p); return [x + rnd() * jitter, y + rnd() * jitter]; });
      // A curve through the midpoints, so the line has no corners.
      const mid = i => [(pts[i][0] + pts[(i + 1) % pts.length][0]) / 2, (pts[i][1] + pts[(i + 1) % pts.length][1]) / 2];
      c.beginPath();
      c.moveTo(...mid(pts.length - 1));
      for (let i = 0; i < pts.length; i++) c.quadraticCurveTo(...pts[i], ...mid(i));
      c.closePath();
      c.stroke();
    }
  }, { srgb: true });
  const g = new THREE.Group();
  const mat = paper(C.white, { map: chalkTex, finish: 'card' });
  mat.alphaTest = 0.5;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(CHALK_W, CHALK_D), mat);
  m.rotation.x = -PI / 2;
  m.position.y = 0.004;
  m.receiveShadow = true;
  g.add(m);
  return { object: g };
}

// Crime scene tape: low posts at `posts` (room coordinates; a weighted base
// and a pole) with yellow-and-black striped tape sagging between them, along
// the back and the sides; the front is left open so the camera sees in. The
// tape sways a little. Its stripes carry no lettering.
let tapeTex, postGeometry, baseGeometry;
const TAPE_H = 0.07;
function crimeTape(entry) {
  tapeTex ??= canvasTexture(64, 16, (c, w, h) => {
    c.fillStyle = '#f2c93a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#26252a';
    for (let x = -h; x < w + h; x += 32) {
      c.beginPath();
      c.moveTo(x, h); c.lineTo(x + 14, 0); c.lineTo(x + 28, 0); c.lineTo(x + 14, h);
      c.fill();
    }
  });
  postGeometry ??= new THREE.CylinderGeometry(0.022, 0.022, 0.86, 10);
  baseGeometry ??= new THREE.CylinderGeometry(0.11, 0.13, 0.04, 20);
  const tapeY = entry.tapeY ?? 0.78;
  const g = new THREE.Group();
  const yellow = paper(0xf2c93a, { finish: 'plastic' });
  const local = ([x, z]) => v(x - entry.x, 0, z - entry.z);
  const posts = (entry.posts ?? []).map(local);
  for (const p of posts) {
    const base = ink(new THREE.Mesh(baseGeometry, black()), { edges: 30 });
    base.position.set(p.x, 0.02, p.z);
    const pole = ink(new THREE.Mesh(postGeometry, yellow), { edges: 0, hull: 0.004 });
    pole.position.set(p.x, 0.47, p.z);
    const cap = ink(new THREE.Mesh(baseGeometry, black()), { edges: 30 });
    cap.scale.set(0.3, 1, 0.3);
    cap.position.set(p.x, 0.9, p.z);
    g.add(base, pole, cap);
    shade(g, 0.4, 0.4, 0.25);
    g.children.at(-1).position.set(p.x, 0.007, p.z);
  }
  // Tape from each post to the next, the last (front) span left open.
  const tapeMat = paper(C.white, { map: tapeTex, side: THREE.DoubleSide, finish: 'plastic' });
  const spans = [];
  for (let i = 0; i + 1 < posts.length; i++) {
    const a = posts[i], b = posts[i + 1], length = a.distanceTo(b), n = 24;
    const geo = new THREE.PlaneGeometry(length, TAPE_H, n, 1);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    const sag = 0.05 + length * 0.025;
    for (let k = 0; k < pos.count; k++) {
      const u = (pos.getX(k) + length / 2) / length;
      pos.setY(k, pos.getY(k) - sag * 4 * u * (1 - u));
      uv.setX(k, u * length / 0.24);
    }
    geo.computeVertexNormals();
    const span = new THREE.Group();
    span.position.set((a.x + b.x) / 2, tapeY, (a.z + b.z) / 2);
    span.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    const tape = ink(new THREE.Mesh(geo, tapeMat), { edges: 0, hull: 0.003 });
    tape.castShadow = false;
    span.add(tape);
    g.add(span);
    spans.push(tape);
  }
  // A slow sway, a little livelier while the music plays.
  function animate(time, hit, playing) {
    for (let i = 0; i < spans.length; i++) spans[i].rotation.x = Math.sin(time * (playing ? 1.3 : 0.8) + i * 1.9) * 0.12;
  }
  return { object: g, animate };
}

// An evidence marker: a small yellow folded-card tent standing on the floor
// (no number on it).
let tentGeometry;
function evidenceMarker() {
  if (!tentGeometry) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.055, 0); shape.lineTo(0.055, 0); shape.lineTo(0, 0.12); shape.closePath();
    tentGeometry = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
    tentGeometry.translate(0, 0, -0.05);
  }
  const g = new THREE.Group();
  const tent = ink(new THREE.Mesh(tentGeometry, paper(0xf2c93a, { finish: 'plastic' })), { edges: 30 });
  tent.rotation.y = PI / 2;   // the sloping faces to the front and back
  g.add(tent);
  shade(g, 0.22, 0.22, 0.25);
  return { object: g };
}

// The weapon: a stapler lying on the floor, a little larger than life so it
// reads from across the room. Base, a hinged top tipped open, a chrome hinge.
function evidence() {
  const g = new THREE.Group();
  const red = paper(0xc0473b, { finish: 'plastic' });
  rbox(g, [0.26, 0.03, 0.07], [0, 0, 0], black(), 0.012);
  const top = new THREE.Group();
  top.position.set(-0.11, 0.035, 0);
  top.rotation.z = 0.22;
  rbox(top, [0.25, 0.04, 0.062], [0.125, 0, 0], red, 0.015);
  g.add(top);
  cyl(g, [0.018, 0.018, 0.07], [-0.11, 0.005, 0], chrome(), { edges: 0, hull: 0.003 }, 12).rotation.x = PI / 2;
  // Two staples that got away.
  for (const [x, z, turn] of [[0.2, 0.08, 0.4], [0.12, -0.1, -0.8]]) {
    const staple = box(g, [0.03, 0.004, 0.006], [x, 0, z], chrome(), { edges: 0, hull: 0 });
    staple.rotation.y = turn;
  }
  shade(g, 0.4, 0.22, 0.28);
  return { object: g };
}

// Blood on the floor round the body: a pool spreading out from under the
// torso, runs, drops and a smear toward the weapon. Flat red paper, darker at
// the edge, under the chalk line (0.004), which stays white across it.
const BLOOD_W = 2.3, BLOOD_D = 2.2, BLOOD_PX = 200;
const BLOOD = '#8e1317', BLOOD_EDGE = '#4f090d', BLOOD_SHINE = '#b8302c';
// Pools as [x, z, radius] in metres from the body's middle; drops likewise.
const POOLS = [
  [0.34, -0.02, 0.4], [0.62, 0.1, 0.27], [0.5, -0.32, 0.22], [0.8, 0.3, 0.16],
  [-0.38, 0.02, 0.33], [-0.6, -0.16, 0.2], [-0.56, 0.24, 0.17], [0.05, 0.1, 0.45],
];
const DROPS = [
  [0.95, 0.52, 0.05], [1.02, 0.36, 0.03], [0.9, -0.42, 0.045], [0.74, -0.6, 0.03], [1.05, -0.1, 0.035],
  [-0.82, -0.38, 0.045], [-0.9, 0.12, 0.03], [-0.76, 0.5, 0.05], [-0.98, -0.12, 0.025], [-0.66, 0.68, 0.03],
  [0.4, -0.78, 0.04], [-0.3, -0.86, 0.03], [0.62, 0.86, 0.045], [-0.5, 0.92, 0.035], [0.86, 0.72, 0.025],
  [0.2, 1.02, 0.03], [-0.15, -1.0, 0.025], [1.08, 0.14, 0.02], [-1.04, 0.3, 0.02],
];
function bloodBlobs(c, at, px, blobs, seed0) {
  let seed = seed0;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Each blob is a wobbly round shape; drawn dark and wide first, then red inside.
  const shapes = blobs.map(([x, z, r]) => {
    const n = 14, phase = rnd() * 6;
    return Array.from({ length: n }, (_, i) => {
      const a = i / n * PI * 2, rr = r * (0.82 + rnd() * 0.3 + Math.sin(a * 3 + phase) * 0.08);
      const [px0, py0] = at(x + Math.cos(a) * rr, z + Math.sin(a) * rr);
      return [px0, py0];
    });
  });
  const trace = pts => {
    const mid = i => [(pts[i][0] + pts[(i + 1) % pts.length][0]) / 2, (pts[i][1] + pts[(i + 1) % pts.length][1]) / 2];
    c.beginPath();
    c.moveTo(...mid(pts.length - 1));
    for (let i = 0; i < pts.length; i++) c.quadraticCurveTo(...pts[i], ...mid(i));
    c.closePath();
  };
  c.lineJoin = 'round';
  c.fillStyle = c.strokeStyle = BLOOD_EDGE;
  c.lineWidth = 0.035 * px;
  for (const pts of shapes) { trace(pts); c.fill(); c.stroke(); }
  c.fillStyle = BLOOD;
  for (const pts of shapes) { trace(pts); c.fill(); }
  // A wet glint on each.
  c.strokeStyle = BLOOD_SHINE;
  c.lineCap = 'round';
  blobs.forEach(([x, z, r]) => {
    if (r < 0.04) return;
    c.lineWidth = Math.max(2, r * 0.09 * px);
    c.beginPath();
    c.arc(...at(x, z), r * 0.62 * px, PI * 1.12, PI * 1.42);
    c.stroke();
  });
}
let bloodTex;
function bloodPool() {
  bloodTex ??= canvasTexture(Math.round(BLOOD_W * BLOOD_PX), Math.round(BLOOD_D * BLOOD_PX), (c, w, h) => {
    const at = (x, z) => [w / 2 + x * BLOOD_PX, h / 2 + z * BLOOD_PX];
    // A smear dragged toward the weapon.
    c.strokeStyle = BLOOD_EDGE;
    c.lineCap = 'round';
    for (const [dz, width] of [[0, 0.07], [0.06, 0.03], [-0.05, 0.025]]) {
      c.lineWidth = width * BLOOD_PX;
      c.beginPath();
      c.moveTo(...at(0.55, 0.2 + dz));
      c.quadraticCurveTo(...at(0.78, 0.26 + dz), ...at(0.92, 0.44 + dz));
      c.stroke();
    }
    bloodBlobs(c, at, BLOOD_PX, [...POOLS, ...DROPS], 7);
  }, { srgb: true });
  const g = new THREE.Group();
  const mat = paper(C.white, { map: bloodTex, finish: 'plastic' });
  mat.alphaTest = 0.5;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(BLOOD_W, BLOOD_D), mat);
  m.rotation.x = -PI / 2;
  m.position.y = 0.002;
  m.receiveShadow = true;
  g.add(m);
  return { object: g };
}

// The knife in the victim's belly: a kitchen knife standing in the lying
// body, a little larger than life, with a blood stain on the shirt round it
// and runs down both sides. It shows only while the cast member named by
// `on` is in place (the body is on its mark), so nobody walks through it.
// The lying card floats at 0.01 m (standee.js LIE_Y); the stain lies on it.
let stainTex;
function knife(entry) {
  stainTex ??= canvasTexture(256, 256, (c, w) => {
    const at = (x, z) => [w / 2 + x * 512, w / 2 + z * 512];
    bloodBlobs(c, at, 512, [
      [0, 0, 0.1], [0.07, 0.05, 0.06], [-0.08, 0.03, 0.055], [0.02, 0.1, 0.05],
      [0.13, 0.1, 0.03], [-0.14, 0.09, 0.028], [0.16, 0.16, 0.02], [-0.17, 0.15, 0.018], [0.05, 0.18, 0.022],
    ], 23);
  }, { srgb: true });
  const g = new THREE.Group();
  const mat = paper(C.white, { map: stainTex, finish: 'plastic' });
  mat.alphaTest = 0.5;
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat);
  stain.rotation.x = -PI / 2;
  stain.position.y = 0.015;
  g.add(stain);
  const blade = new THREE.Group();
  blade.position.y = 0.012;
  blade.rotation.set(0.25, 0.5, -0.6);   // leaning to his left, clear of his face from the front, the flat of the blade to the camera
  box(blade, [0.062, 0.13, 0.008], [0, 0, 0], chrome(), { edges: 30, hull: 0.004 });
  box(blade, [0.1, 0.022, 0.03], [0, 0.13, 0], brass(), { edges: 0, hull: 0.004 });
  rbox(blade, [0.05, 0.16, 0.034], [0, 0.152, 0], black(), 0.012);
  for (const y of [0.19, 0.27]) cyl(blade, [0.008, 0.008, 0.038], [0, y, 0], brass(), { edges: 0, hull: 0 }, 8).rotation.x = PI / 2;
  g.add(blade);
  g.visible = false;
  const animate = (time, hit, playing, show) => { g.visible = !entry.on || Boolean(show?.acts?.[entry.on]); };
  return { object: g, animate };
}

const BUILDERS = {
  drum_kit: drumKit,
  amp,
  keyboard,
  mic_stand: micStand,
  rug,
  xmas_tree: xmasTree,
  gifts,
  light_string: lightString,
  chalk_outline: chalkOutline,
  crime_tape: crimeTape,
  evidence_marker: evidenceMarker,
  evidence,
  blood_pool: bloodPool,
  knife,
};

// ---- The stage ----

const WASH = 0xffe2b8;
const WASH_I = 16;

export function createStage({ scene, shows = SHOWS } = {}) {
  const root = new THREE.Group();     // always in the scene, so the lights always count
  root.name = 'stage';
  scene?.add(root);
  const sets = new Map();             // show key -> { group, rise, hanging, animated }

  // Two warm spotlights high on either side of the room's front, aimed at the band.
  const aim = v(0, 0.7, -0.8);
  const lights = [-2.8, 2.8].map(x => {
    const spot = new THREE.SpotLight(WASH, 0, 0, 0.62, 0.7, 1.4);
    spot.position.set(x, 3.3, 1.8);
    spot.target.position.copy(aim);
    root.add(spot, spot.target);
    return spot;
  });

  // The pieces of a show's set, in one group centred on the set so the
  // camera can look at it. Standing pieces rise from the floor together
  // (`rise`); pieces hung at a height (`y`, the light strings on the walls)
  // drop from their pins on their own.
  function build(key) {
    const spec = shows[key];
    const set = spec?.set ?? [];
    const marks = Object.values(spec?.roles ?? {}).map(r => r.mark);
    const mean = axis => (marks.length ? marks.reduce((sum, m) => sum + m[axis], 0) / marks.length : 0);
    const centre = set.find(p => p.piece === 'rug') ?? { x: mean('x'), z: mean('z') };
    const group = new THREE.Group();
    group.name = `stage-${key}`;
    group.position.set(centre.x, 0, centre.z);
    group.visible = false;
    const rise = new THREE.Group();
    group.add(rise);
    const hanging = [], animated = [];
    for (const p of set) {
      const built = BUILDERS[p.piece]?.(p, spec);
      if (!built) continue;
      built.object.position.set(p.x - centre.x, p.y ?? 0, p.z - centre.z);
      built.object.rotation.y = p.rot ?? 0;
      if (p.y) { group.add(built.object); hanging.push(built.object); } else rise.add(built.object);
      if (built.animate) animated.push(built);
    }
    root.add(group);
    const entry = { group, rise, hanging, animated };
    sets.set(key, entry);
    return entry;
  }

  const state = { fade: 0, key: null };

  return {
    group: root,
    lights,
    state,
    update(show, time, dt, beat01 = null) {
      const on = Boolean(show && shows[show.key]);
      if (on && show.key !== state.key) {
        // Another show takes over at once; the old set goes.
        if (state.key) sets.get(state.key).group.visible = false;
        state.key = show.key;
      }
      if (on && !sets.has(state.key)) build(state.key);
      state.fade += ((on ? 1 : 0) - state.fade) * Math.min(1, dt * 3);
      if (!on && state.fade < 0.01) state.fade = 0;
      if (on && state.fade > 0.999) state.fade = 1;
      const f = state.fade;
      for (const l of lights) l.intensity = f * WASH_I;
      const set = state.key ? sets.get(state.key) : null;
      if (!set) return;
      set.group.visible = f > 0;
      if (f === 0) return;
      // The set rises from the floor like a pop-up page; the strings on
      // the walls unfold down from their pins.
      const s = Math.max(0.001, f * f * (3 - 2 * f));
      set.rise.scale.set(1, s, 1);
      for (const h of set.hanging) h.scale.set(1, s, 1);
      // Moving pieces follow the music while the show plays.
      const playing = on && show.beat === 'play';
      const hit = playing && typeof beat01 === 'number' ? beat01 : 0;
      for (const piece of set.animated) piece.animate(time, hit, playing, show);
    },
    // What the camera can look at for a show: its set, or null before it is built.
    subject(key) { return sets.get(key)?.group ?? null; },
  };
}
