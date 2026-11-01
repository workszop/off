// ---- Paper-craft furniture ----
// The 11 pieces from FURNITURE_PALETTE (js/data.js) rebuilt as 3D card
// models, following the zine furniture art in assets/*.webp: cream card,
// ink edges, and the same blue and coral collage patches.
//
// Every builder returns:
//   object    - THREE.Group, origin on the floor at the piece's centre, front = +Z
//   footprint - [x0, z0, x1, z1] local floor rectangle that blocks walking
//   spots     - [{ x, z, heading }] local places a character can stand to use it
//   glow      - meshes that light up at night (screens, bulbs)
//   light     - optional THREE.Light owned by the piece (the arc lamp)
//
// Sizes are metres, calibrated against a 1.62 m character as the 2D
// palette is (desk at hip height, whiteboard and lamp near person height).

import * as THREE from 'three';
import { C, paper, box, rbox, cyl, rod, patch, ink, canvasTexture, grainTexture } from './materials.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const faceTo = (x, z, tx = 0, tz = 0) => Math.atan2(tx - x, tz - z);
const PI = Math.PI;

function piece(object, footprint, spots = [], extra = {}) {
  return { object, footprint, spots, glow: [], ...extra };
}

// ---- Small props ----

function mug(parent, x, y, z, color = C.white, r = 0.045, h = 0.09) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  cyl(g, [r, r * 0.92, h], [0, 0, 0], paper(color));
  cyl(g, [r * 0.86, r * 0.86, 0.004], [0, h - 0.012, 0], paper(C.coffee), { edges: 0, hull: 0 });
  const handle = ink(new THREE.Mesh(new THREE.TorusGeometry(h * 0.27, 0.007, 8, 16, PI), paper(color)), { edges: 0, hull: 0.004 });
  handle.position.set(r + 0.002, h * 0.5, 0);
  handle.rotation.z = -PI / 2;
  g.add(handle);
  parent.add(g);
  return g;
}

function laptop(parent, x, y, z, rotY, glow) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  box(g, [0.34, 0.018, 0.24], [0, 0, 0], paper(C.cardDeep));
  box(g, [0.26, 0.002, 0.1], [0, 0.018, -0.02], paper(C.card), { edges: 0 }); // keyboard
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.018, -0.12);
  hinge.rotation.x = -0.28;
  g.add(hinge);
  box(hinge, [0.34, 0.22, 0.012], [0, 0, 0], paper(C.cardDeep));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), paper(C.screen, { emissive: 0x000000 }));
  screen.position.set(0, 0.11, 0.0065);
  hinge.add(screen);
  glow.push(screen);
  parent.add(g);
}

// ---- Desk cluster (L-shaped, two laptops) ----

export function deskCluster() {
  const g = new THREE.Group();
  const top = paper(C.card), leg = paper(C.cardDeep);
  const glow = [];
  box(g, [1.7, 0.04, 0.75], [-0.15, 0.72, -0.05], top);
  box(g, [0.7, 0.04, 0.7], [0.35, 0.72, 0.675], top);
  for (const [x, z] of [[-0.97, -0.39], [-0.97, 0.29], [0.67, -0.39], [0.03, 1.0], [0.67, 1.0]]) {
    box(g, [0.045, 0.72, 0.045], [x, 0, z], leg);
  }
  box(g, [1.6, 0.34, 0.02], [-0.15, 0.36, -0.4], leg);          // modesty panel
  box(g, [0.02, 0.34, 0.62], [0.68, 0.36, 0.66], leg);          // wing side panel
  patch(g, 0.42, 0.24, C.blue, [0.692, 0.53, 0.75], [0, PI / 2, 0], 3);
  patch(g, 0.2, 0.3, C.coral, [-0.99, 0.4, -0.05], [0, -PI / 2, 0], 5);

  laptop(g, -0.55, 0.76, -0.12, 0, glow);
  laptop(g, 0.32, 0.76, 0.7, -PI / 2, glow);
  mug(g, -0.95, 0.76, 0.05);
  // Pen cup with pencils.
  cyl(g, [0.035, 0.035, 0.09], [0.05, 0.76, -0.25], paper(C.card));
  for (const [dx, dz, c] of [[0, 0, C.coral], [0.012, 0.008, C.blue], [-0.01, 0.006, C.ochre]]) {
    rod(g, v(0.05 + dx, 0.8, -0.25 + dz), v(0.05 + dx * 2.5, 0.92, -0.25 + dz * 2), 0.0045, paper(c));
  }
  box(g, [0.07, 0.008, 0.14], [0.2, 0.76, 0.42], paper(C.screen));        // phone
  box(g, [0.15, 0.006, 0.2], [-0.2, 0.76, 0.1], paper(C.white));          // notepad
  rod(g, v(-0.24, 0.77, 0.08), v(-0.14, 0.77, 0.16), 0.004, paper(C.ink), { edges: 0, hull: 0 });

  return piece(g, [-1.0, -0.43, 0.7, 1.03], [
    { x: -0.5, z: 0.62, heading: PI },
    { x: -0.3, z: 0.8, heading: PI / 2 },
  ], { glow });
}

// ---- Office chair ----

export function officeChair() {
  const g = new THREE.Group();
  const dark = paper(C.screen), seat = paper(C.blue);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    rod(g, v(0, 0.06, 0), v(Math.sin(a) * 0.27, 0.035, Math.cos(a) * 0.27), 0.015, dark);
    cyl(g, [0.025, 0.025, 0.035], [Math.sin(a) * 0.27, 0, Math.cos(a) * 0.27], dark);
  }
  cyl(g, [0.025, 0.025, 0.36], [0, 0.06, 0], dark);
  rbox(g, [0.48, 0.08, 0.46], [0, 0.42, 0], seat, 0.03);
  const back = rbox(g, [0.44, 0.44, 0.07], [0, 0.52, -0.2], seat, 0.03);
  back.rotation.x = -0.1;
  rod(g, v(0, 0.46, -0.2), v(0, 0.6, -0.23), 0.02, dark);
  return piece(g, [-0.28, -0.28, 0.28, 0.28]);
}

// ---- Printer on a stand ----

export function printer() {
  const g = new THREE.Group();
  const glow = [];
  box(g, [0.62, 0.62, 0.5], [0, 0, 0], paper(C.card));
  box(g, [0.56, 0.5, 0.01], [0, 0.06, 0.251], paper(C.cardDeep), { edges: 20 });   // stand door
  box(g, [0.1, 0.02, 0.02], [0.18, 0.5, 0.262], paper(C.card));
  patch(g, 0.2, 0.3, C.blue, [-0.311, 0.3, 0.05], [0, -PI / 2, 0], 7);

  box(g, [0.52, 0.24, 0.42], [0, 0.62, -0.02], paper(C.white));
  box(g, [0.5, 0.035, 0.38], [0, 0.86, -0.03], paper(C.card));
  box(g, [0.36, 0.05, 0.012], [0, 0.66, 0.196], paper(C.screen), { edges: 0 });     // paper slot
  box(g, [0.32, 0.012, 0.16], [0, 0.66, 0.26], paper(C.cardDeep));                  // output tray
  box(g, [0.24, 0.003, 0.15], [0, 0.673, 0.25], paper(C.white), { edges: 20 });     // printed page
  const sheet = box(g, [0.22, 0.003, 0.29], [0, 0.9, -0.12], paper(C.white));       // input paper
  sheet.rotation.x = 0.55;
  const display = box(g, [0.11, 0.045, 0.01], [0.15, 0.78, 0.196], paper(C.screen, { emissive: 0x000000 }), { edges: 0 });
  glow.push(display);
  for (const x of [0.06, 0.09]) cyl(g, [0.008, 0.008, 0.01], [x, 0.785, 0.2], paper(C.cardDeep), { edges: 0, hull: 0.002 }).rotation.x = PI / 2;
  patch(g, 0.14, 0.12, C.coral, [0.261, 0.7, 0.05], [0, PI / 2, 0], 11);

  return piece(g, [-0.31, -0.25, 0.31, 0.27], [{ x: 0, z: 0.62, heading: PI }], { glow });
}

// ---- Filing cabinet ----

export function filingCabinet() {
  const g = new THREE.Group();
  box(g, [0.5, 0.78, 0.58], [0, 0, 0], paper(C.card));
  for (let i = 0; i < 3; i++) {
    const y = 0.05 + i * 0.245;
    box(g, [0.44, 0.215, 0.018], [0, y, 0.298], paper(C.cardDeep));
    box(g, [0.14, 0.022, 0.03], [0, y + 0.15, 0.316], paper(C.card));
    box(g, [0.07, 0.035, 0.004], [0, y + 0.09, 0.308], paper(C.white), { edges: 20 });
  }
  patch(g, 0.2, 0.18, C.coral, [-0.12, 0.781, 0.14], [-PI / 2, 0, 0.2], 13);
  patch(g, 0.18, 0.4, C.blue, [0.251, 0.32, 0.12], [0, PI / 2, 0], 17);
  return piece(g, [-0.25, -0.29, 0.25, 0.33], [{ x: 0, z: 0.68, heading: PI }]);
}

// ---- Coffee station ----

export function coffeeStation() {
  const g = new THREE.Group();
  box(g, [1.5, 0.86, 0.6], [0, 0, 0], paper(C.card));
  box(g, [1.56, 0.04, 0.64], [0, 0.86, 0], paper(C.kraft));
  box(g, [0.7, 0.005, 0.005], [-0.35, 0.45, 0.302], paper(C.ink), { edges: 0 });   // cupboard seam
  patch(g, 0.42, 0.13, C.blue, [-0.5, 0.11, 0.302], [0, 0, 0], 19);
  patch(g, 0.28, 0.12, C.coral, [0.55, 0.11, 0.302], [0, 0, 0], 23);

  // Espresso machine.
  const m = new THREE.Group();
  m.position.set(-0.42, 0.9, -0.06);
  g.add(m);
  box(m, [0.42, 0.42, 0.34], [0, 0, 0], paper(C.white));
  box(m, [0.4, 0.03, 0.32], [0, 0.42, 0], paper(C.cardDeep));
  box(m, [0.36, 0.2, 0.08], [0, 0, 0.21], paper(C.cardDeep));                       // drip base
  box(m, [0.36, 0.08, 0.08], [0, 0.34, 0.21], paper(C.cardDeep));                    // head
  cyl(m, [0.04, 0.035, 0.05], [-0.06, 0.29, 0.22], paper(C.screen), { edges: 0, hull: 0.004 });
  rod(m, v(-0.06, 0.29, 0.22), v(-0.06, 0.28, 0.38), 0.012, paper(C.screen));        // portafilter
  for (const x of [-0.13, 0.11]) {
    const dial = cyl(m, [0.028, 0.028, 0.02], [x, 0.36, 0.25], paper(C.white));
    dial.rotation.x = PI / 2;
  }
  box(m, [0.1, 0.06, 0.004], [0.11, 0.24, 0.251], paper(C.screen), { edges: 0 });   // gauge panel
  mug(m, -0.06, 0.2, 0.22, C.white, 0.035, 0.07);

  mug(g, 0.05, 0.9, 0.12, C.white, 0.05, 0.1);
  // Stack of cups.
  for (let i = 0; i < 4; i++) {
    const cup = new THREE.Group();
    cup.position.set(0.48, 0.9 + i * 0.055, -0.02);
    cyl(cup, [0.055, 0.042, 0.075], [0, 0, 0], paper(C.white));
    const handle = ink(new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 16, PI), paper(C.white)), { edges: 0, hull: 0.004 });
    handle.position.set(0.058, 0.04, 0);
    handle.rotation.z = -PI / 2;
    cup.add(handle);
    g.add(cup);
  }
  return piece(g, [-0.78, -0.32, 0.78, 0.32], [
    { x: -0.4, z: 0.72, heading: PI },
    { x: 0.35, z: 0.72, heading: PI },
  ]);
}

// ---- Café table ----

export function cafeTable() {
  const g = new THREE.Group();
  cyl(g, [0.38, 0.38, 0.035], [0, 0.72, 0], paper(C.card), { edges: 0, hull: 0.007 }, 48);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + 0.4;
    rod(g, v(Math.sin(a) * 0.16, 0.72, Math.cos(a) * 0.16), v(Math.sin(a) * 0.33, 0, Math.cos(a) * 0.33), 0.016, paper(C.cardDeep));
  }
  cyl(g, [0.075, 0.075, 0.01], [0.05, 0.755, 0.02], paper(C.white), { edges: 0, hull: 0.004 });
  mug(g, 0.05, 0.765, 0.02, C.white, 0.035, 0.055);
  patch(g, 0.3, 0.3, C.blue, [-0.15, 0.01, 0.12], [-PI / 2, 0, 0.5], 29);
  patch(g, 0.26, 0.24, C.coral, [0.22, 0.012, -0.08], [-PI / 2, 0, -0.3], 31);
  const spots = [[-0.7, 0.25], [0.68, 0.3], [0.05, 0.72]].map(([x, z]) => ({ x, z, heading: faceTo(x, z) }));
  return piece(g, [-0.42, -0.42, 0.42, 0.42], spots);
}

// ---- Whiteboard on a mobile stand ----

let scribbles;
function scribbleTexture() {
  scribbles ??= canvasTexture(512, 320, (g, w, h) => {
    g.fillStyle = '#fbfaf6';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,58,54,0.85)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    const scrawl = (x, y, n, r) => {
      g.beginPath();
      g.moveTo(x, y);
      for (let i = 0; i < n; i++) g.lineTo(x + i * 6 + Math.sin(i * 1.7) * r, y + Math.cos(i * 1.3) * r);
      g.stroke();
    };
    scrawl(60, 70, 16, 14);
    scrawl(330, 230, 18, 16);
    g.beginPath(); g.ellipse(410, 110, 46, 32, 0.2, 0, PI * 2); g.stroke();
    g.beginPath(); g.arc(120, 180, 22, 0, PI * 2); g.moveTo(85, 180); g.lineTo(155, 180); g.moveTo(120, 145); g.lineTo(120, 215); g.stroke();
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(250 + Math.random() * 40, 150 + Math.random() * 40, 3, 0, PI * 2); g.fill(); }
    g.beginPath(); g.moveTo(180, 260); g.lineTo(240, 230); g.moveTo(190, 70); g.lineTo(250, 92); g.stroke();
    g.fillStyle = 'rgba(60,58,54,0.85)';
  });
  return scribbles;
}

export function whiteboard() {
  const g = new THREE.Group();
  const frame = paper(0xcac6bd);
  for (const x of [-0.72, 0.72]) {
    box(g, [0.05, 1.72, 0.05], [x, 0.04, 0], frame);
    box(g, [0.06, 0.04, 0.56], [x, 0.04, 0], frame);
    for (const z of [-0.25, 0.25]) {
      const wheel = cyl(g, [0.03, 0.03, 0.02], [x, 0.0, z], paper(C.screen), { edges: 0, hull: 0.003 });
      wheel.rotation.z = PI / 2;
      wheel.position.y = 0.03;
    }
  }
  const boardMat = paper(C.white, { map: scribbleTexture() });
  const side = paper(C.white);
  const board = ink(new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.86, 0.03), [side, side, side, side, boardMat, side]));
  board.position.set(0, 1.25, 0);
  g.add(board);
  box(g, [1.42, 0.03, 0.045], [0, 1.665, 0], frame);
  box(g, [1.42, 0.03, 0.045], [0, 0.805, 0], frame);
  box(g, [0.55, 0.02, 0.08], [0, 0.82, 0.05], frame);                                 // marker tray
  [C.coral, C.blue, C.ink].forEach((c, i) => {
    rod(g, v(-0.15 + i * 0.12, 0.85, 0.06), v(-0.06 + i * 0.12, 0.85, 0.06), 0.008, paper(c));
  });
  patch(g, 0.18, 0.22, C.coral, [-0.55, 0.95, 0.017], [0, 0, 0.1], 37);
  return piece(g, [-0.76, -0.3, 0.76, 0.3], [{ x: 0, z: 0.8, heading: PI }, { x: -0.5, z: 0.85, heading: PI - 0.3 }]);
}

// ---- Sofa and armchair ----

function upholstered({ width, seats, accentRight }) {
  const g = new THREE.Group();
  const cloth = paper(C.card), deep = paper(C.cardDeep), accent = paper(C.coral);
  const half = width / 2;
  for (const x of [-half + 0.08, half - 0.08]) for (const z of [-0.33, 0.33]) {
    cyl(g, [0.025, 0.02, 0.08], [x, 0, z], paper(C.screen), { edges: 0, hull: 0.003 });
  }
  rbox(g, [width - 0.1, 0.24, 0.8], [0, 0.08, 0], deep, 0.04);
  rbox(g, [width - 0.2, 0.52, 0.2], [0, 0.3, -0.3], deep, 0.06);
  const seatW = (width - 0.42) / seats;
  for (let i = 0; i < seats; i++) {
    const x = -((seats - 1) * seatW) / 2 + i * seatW;
    rbox(g, [seatW - 0.02, 0.15, 0.6], [x, 0.31, 0.08], cloth, 0.05);
    const back = rbox(g, [seatW - 0.03, 0.42, 0.17], [x, 0.43, -0.16], cloth, 0.06);
    back.rotation.x = -0.12;
  }
  rbox(g, [0.2, 0.56, 0.82], [-half + 0.1, 0.08, 0], cloth, 0.08);
  rbox(g, [0.2, 0.56, 0.82], [half - 0.1, 0.08, 0], accentRight ? accent : cloth, 0.08);
  patch(g, 0.3, 0.26, C.blue, [-half - 0.002, 0.38, -0.1], [0, -PI / 2, 0], 41);
  return g;
}

export function couch() {
  const g = upholstered({ width: 1.72, seats: 2, accentRight: true });
  return piece(g, [-0.86, -0.42, 0.86, 0.42], [
    { x: -0.4, z: 0.72, heading: 0 },
    { x: 0.4, z: 0.72, heading: 0 },
  ]);
}

export function armchair() {
  const g = upholstered({ width: 0.96, seats: 1, accentRight: true });
  return piece(g, [-0.48, -0.42, 0.48, 0.42], [{ x: 0, z: 0.72, heading: 0 }]);
}

// ---- Arc floor lamp ----

export function arcLamp() {
  const g = new THREE.Group();
  const glow = [];
  cyl(g, [0.17, 0.19, 0.045], [0, 0, 0], paper(C.card), { edges: 0, hull: 0.006 }, 40);
  const curve = new THREE.CatmullRomCurve3([
    v(0, 0.04, 0), v(0, 0.9, 0), v(0.05, 1.5, 0), v(0.3, 1.92, 0), v(0.72, 1.98, 0), v(0.98, 1.78, 0),
  ]);
  ink(g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.016, 8), paper(C.card))).children.at(-1), { edges: 0, hull: 0.005 });
  const shade = ink(new THREE.Mesh(
    new THREE.LatheGeometry([[0.19, 0], [0.15, 0.05], [0.07, 0.15], [0.03, 0.17]].map(([r, y]) => new THREE.Vector2(r, y)), 32),
    paper(C.card, { side: THREE.DoubleSide })
  ), { edges: 0, hull: 0.006 });
  shade.position.set(1.0, 1.6, 0);
  g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf5ead2 }));
  bulb.position.set(1.0, 1.63, 0);
  g.add(bulb);
  glow.push(bulb);
  const light = new THREE.PointLight(0xffc66e, 0, 6, 1.4);
  light.position.set(1.0, 1.5, 0);
  g.add(light);
  patch(g, 0.22, 0.12, C.blue, [0.02, 0.046, 0.04], [-PI / 2, 0, 0.3], 43);
  return piece(g, [-0.22, -0.22, 0.22, 0.22], [], { glow, light });
}

// ---- Snake plant ----

let potTex, leafTex;
export function snakePlant() {
  const g = new THREE.Group();
  potTex ??= canvasTexture(512, 128, (c, w, h) => {
    c.fillStyle = '#f3ecdf';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#292824';
    c.lineWidth = 2;
    for (const y of [26, 60, 98]) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.strokeStyle = '#d4765f'; c.lineWidth = 5;
    c.beginPath();
    for (let x = 0; x <= w; x += 4) c.lineTo(x, 80 + Math.sin(x / 18) * 8);
    c.stroke();
    c.strokeStyle = '#7d93ab'; c.lineWidth = 4;
    c.beginPath();
    for (let x = 0; x <= w; x += 16) c.lineTo(x, (x / 16) % 2 ? 34 : 52);
    c.stroke();
  });
  // Lathe UV v runs bottom (0) to top (1); the band sits mid-pot.
  const pot = ink(new THREE.Mesh(
    new THREE.LatheGeometry([[0.001, 0], [0.15, 0], [0.165, 0.04], [0.19, 0.3], [0.205, 0.34], [0.19, 0.34]].map(([r, y]) => new THREE.Vector2(r, y)), 40),
    paper(C.white, { map: potTex })
  ), { edges: 0, hull: 0.006 });
  g.add(pot);
  cyl(g, [0.185, 0.185, 0.01], [0, 0.31, 0], paper(C.coffee), { edges: 0, hull: 0 });

  leafTex ??= canvasTexture(64, 256, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(70,80,60,0.45)';
    c.lineWidth = 3;
    for (let y = 8; y < h; y += 16) {
      c.beginPath();
      for (let x = 0; x <= w; x += 4) c.lineTo(x, y + Math.sin(x / 7 + y) * 4);
      c.stroke();
    }
  });
  const leafMat = paper(C.leaf, { map: leafTex, side: THREE.DoubleSide });
  const blades = [
    [0, 0.85, 0, 0.05], [0.9, 0.72, 0.18, 0.06], [2.0, 0.78, 0.2, -0.05], [3.1, 0.66, 0.24, 0.08],
    [4.2, 0.74, 0.16, 0], [5.3, 0.62, 0.26, -0.06], [1.5, 0.55, 0.32, 0.1], [3.7, 0.5, 0.34, -0.1],
  ];
  for (const [yaw, h, lean, twist] of blades) {
    const w = 0.075;
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.quadraticCurveTo(-w * 0.75, h * 0.55, 0, h);
    s.quadraticCurveTo(w * 0.75, h * 0.55, w / 2, 0);
    s.closePath();
    const geo = new THREE.ShapeGeometry(s, 10);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + w) / (2 * w), uv.getY(i) / h);
    const blade = ink(new THREE.Mesh(geo, leafMat), { edges: 1 });
    blade.position.y = 0.3;
    blade.rotation.set(-lean, yaw, twist, 'YXZ');
    g.add(blade);
  }
  return piece(g, [-0.22, -0.22, 0.22, 0.22]);
}

// ---- Stack of boxes ----

export function boxesStack() {
  const g = new THREE.Group();
  const tape = paper(C.blue);
  const sizes = [[0.62, 0.38, 0.5, 0, 0.02], [0.52, 0.32, 0.44, 0.38, 0.1], [0.42, 0.28, 0.36, 0.7, -0.08]];
  for (const [w, h, d, y, rot] of sizes) {
    const b = box(g, [w, h, d], [0, y, 0], paper(C.kraft));
    b.rotation.y = rot;
    const strip = (size, pos) => { const t = new THREE.Mesh(new THREE.BoxGeometry(...size), tape); t.position.set(...pos); b.add(t); };
    strip([0.08, 0.003, d + 0.004], [0, h / 2 + 0.002, 0]);
    strip([0.08, 0.12, 0.003], [0, h / 2 - 0.06, d / 2 + 0.002]);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.003, 0.004), paper(C.ink));
    seam.position.set(0, h / 2 + 0.003, 0);
    b.add(seam);
  }
  patch(g, 0.2, 0.16, C.coral, [0.2, 0.08, 0.252], [0, 0, 0.2], 47);
  return piece(g, [-0.33, -0.28, 0.33, 0.28]);
}

export const BUILDERS = {
  desk_cluster: deskCluster,
  office_chair: officeChair,
  printer,
  filing_cabinet: filingCabinet,
  coffee_station: coffeeStation,
  table_cafe: cafeTable,
  whiteboard,
  couch_2seater: couch,
  armchair,
  lamp_arc_big: arcLamp,
  plant_snake: snakePlant,
  boxes_stack: boxesStack,
};

export { grainTexture };
