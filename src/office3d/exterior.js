// ---- The view outside ----
// Trees, a street and card buildings outside the back and right walls,
// seen only through the windows.
//
// Window panes write 1 into the stencil buffer (see room.js); everything
// here draws only where the stencil is 1. So the street shows through the
// glass at any camera angle, but never pokes above the walls in the
// overview and vanishes when a wall folds down for the cut-away.
//
// Everything outside uses its own materials: the interior's shared,
// cached materials must stay free of stencil tests.

import * as THREE from 'three';
import { C, canvasTexture, grainTexture } from './materials.js';

const PORTAL_REF = 1;
const ORDER = 2; // after the room (0) and the window panes (1)
// The office is one floor up: the street is this far below the room floor,
// so the windows look down on treetops and over the lower roofs to the sky.
const STOREY = 4.2;

export function portalWriter(mat) {
  Object.assign(mat, {
    stencilWrite: true, stencilRef: PORTAL_REF,
    stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    depthWrite: false,
  });
  return mat;
}

function portalOnly(mat) {
  Object.assign(mat, {
    stencilWrite: true, stencilRef: PORTAL_REF,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
    fog: false,
  });
  return mat;
}

// ---- Materials (exterior-only, stencil-tested) ----

let exteriorRampTex;
function exteriorRamp() {
  if (!exteriorRampTex) {
    const data = new Uint8Array([200, 200, 200, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
    exteriorRampTex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    exteriorRampTex.minFilter = exteriorRampTex.magFilter = THREE.NearestFilter;
    exteriorRampTex.needsUpdate = true;
  }
  return exteriorRampTex;
}
const card = (color, extra = {}) => portalOnly(new THREE.MeshToonMaterial({ color, gradientMap: exteriorRamp(), map: grainTexture(), ...extra }));
const flatMat = color => portalOnly(new THREE.MeshBasicMaterial({ color }));

let hull;
function inkHull() {
  if (!hull) {
    hull = portalOnly(new THREE.MeshBasicMaterial({ color: C.ink, side: THREE.BackSide }));
    hull.onBeforeCompile = s => {
      s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.028;');
    };
    hull.customProgramCacheKey = () => 'exterior-hull';
  }
  return hull;
}
let line;
const inkLine = () => (line ??= portalOnly(new THREE.LineBasicMaterial({ color: C.ink })));

function mesh(geo, mat, { edges = false, outline = false } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), inkLine()));
  if (outline) m.add(new THREE.Mesh(geo, inkHull()));
  return m;
}

// ---- Textures ----

let streetTex;
function streetTexture() {
  streetTex ??= canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#9da4a6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4efe5';
    g.fillRect(0, h / 2 - 2, w * 0.55, 4); // dashed centre line, repeats along U
  });
  return streetTex;
}

// Facade: a grid of ink-outlined windows. `lit` paints only some windows,
// on black, for the night-time emissive map.
const facadeCache = new Map();
function facadeTexture(tint, lit) {
  const key = `${tint}-${lit}`;
  if (!facadeCache.has(key)) {
    let seed = tint.length * 31 + (lit ? 7 : 3);
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    facadeCache.set(key, canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = lit ? '#000' : '#fff';
      g.fillRect(0, 0, w, h);
      for (const [x, y] of [[18, 16], [74, 16], [18, 74], [74, 74]]) {
        if (lit) {
          if (rnd() < 0.7) { g.fillStyle = rnd() < 0.7 ? '#ffd88a' : '#ffeec4'; g.fillRect(x, y, 36, 40); }
        } else {
          g.fillStyle = tint;
          g.fillRect(x, y, 36, 40);
          g.strokeStyle = '#292824';
          g.lineWidth = 3;
          g.strokeRect(x, y, 36, 40);
          g.beginPath(); g.moveTo(x + 18, y); g.lineTo(x + 18, y + 40); g.stroke();
        }
      }
    }));
  }
  return facadeCache.get(key);
}

// ---- Pieces ----

const TREE_GREENS = [0x9fb38f, 0x8ea686, 0xa9bb9f, 0x93ab8a];

function tree(parent, x, z, h, seed) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const trunk = mesh(new THREE.CylinderGeometry(0.1 * h / 4, 0.16 * h / 4, h * 0.45, 8), card(0xb79a76), { outline: true });
  trunk.position.y = h * 0.225;
  g.add(trunk);
  const green = card(TREE_GREENS[seed % TREE_GREENS.length]);
  const blobs = [[0, 0.62, 0, 0.33], [-0.18, 0.5, 0.05, 0.25], [0.2, 0.52, -0.04, 0.26], [0.04, 0.8, 0.02, 0.24]];
  for (const [bx, by, bz, r] of blobs) {
    const b = mesh(new THREE.IcosahedronGeometry(r * h, 1), green, { outline: true });
    b.position.set(bx * h, by * h, bz * h);
    b.rotation.set(seed, seed * 2, 0);
    g.add(b);
  }
  parent.add(g);
}

function bush(parent, x, z, s) {
  const b = mesh(new THREE.IcosahedronGeometry(s, 1), card(0x8ea686), { outline: true });
  b.position.set(x, s * 0.6, z);
  b.scale.y = 0.75;
  parent.add(b);
}

const FACADES = [
  [0xefe6d3, '#bcd4e6'], [0xe6bfae, '#c9dbe8'], [0xc3d0d6, '#e9f1f6'],
  [0xe7d6a8, '#bcd4e6'], [0xcfd8c4, '#d9e7ef'],
];

function building(parent, x, z, w, d, h, kind, glow, haze = 0) {
  const [base, glass] = FACADES[kind % FACADES.length];
  const color = new THREE.Color(base).lerp(new THREE.Color(0xdfe8ee), haze);
  const map = facadeTexture(glass, false).clone();
  const emissiveMap = facadeTexture(glass, true).clone();
  for (const t of [map, emissiveMap]) { t.needsUpdate = true; t.repeat.set(1, 1); }
  const wall = card(color, { map, emissiveMap, emissive: 0x000000 });
  const roof = card(0xd9cfbd);
  const geo = new THREE.BoxGeometry(w, h, d);
  // Scale UVs so each window bay is ~3 m wide and one storey tall.
  const uv = geo.attributes.uv, nrm = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    if (ny > 0.5) continue;
    const across = nx > 0.5 ? d : w;
    uv.setXY(i, uv.getX(i) * across / 6, uv.getY(i) * h / 6.4);
  }
  const b = mesh(geo, [wall, wall, roof, roof, wall, wall], { edges: true });
  b.position.set(x, h / 2, z);
  parent.add(b);
  glow.push(wall);
  // Rooftop clutter.
  if (kind % 2 === 0) {
    const tank = mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12), card(0xb79a76), { edges: true });
    tank.position.set(x + w * 0.2, h + 0.8, z);
    parent.add(tank);
  } else {
    const hut = mesh(new THREE.BoxGeometry(w * 0.3, 1.4, d * 0.3), roof, { edges: true });
    hut.position.set(x - w * 0.18, h + 0.7, z);
    parent.add(hut);
  }
}

function streetLamp(parent, x, z, bulbs) {
  const pole = mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8), card(0x5d6064));
  pole.position.set(x, 2.1, z);
  parent.add(pole);
  const bulb = mesh(new THREE.SphereGeometry(0.22, 12, 8), portalOnly(new THREE.MeshBasicMaterial({ color: 0xefe9dc })));
  bulb.position.set(x, 4.25, z);
  parent.add(bulb);
  bulbs.push(bulb.material);
}

function cloud(parent, x, y, z, s, clouds) {
  const shape = new THREE.Shape();
  shape.moveTo(-2 * s, 0);
  shape.absarc(-1.1 * s, 0.4 * s, 0.9 * s, Math.PI, 0.2, true);
  shape.absarc(0.2 * s, 0.9 * s, 1.1 * s, Math.PI * 0.9, 0.1, true);
  shape.absarc(1.4 * s, 0.35 * s, 0.8 * s, Math.PI * 0.8, 0, true);
  shape.lineTo(-2 * s, 0);
  const mat = flatMat(0xffffff);
  const c = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), mat);
  c.position.set(x, y, z);
  parent.add(c);
  clouds.push(mat);
}

// One side of the street scene. Local frame: -Z points away from the room,
// local X runs along the wall; `wall` is the outer wall face distance.
// `windows` lists the local X of each window, so trees stand in the gaps.
function side(root, { rotationY, wall, from, to, windows = [] }, out) {
  const g = new THREE.Group();
  g.rotation.y = rotationY;
  root.add(g);
  const span = to - from, mid = (from + to) / 2;
  let seed = Math.round(wall * 13);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  // Lawn, sidewalk, street.
  const lawn = mesh(new THREE.PlaneGeometry(span, 60), card(0xbfc9a6));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(mid, -0.01, -wall - 30);
  g.add(lawn);
  const walk = mesh(new THREE.PlaneGeometry(span, 2.4), card(0xe4dccb));
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(mid, 0.0, -wall - 8.2);
  g.add(walk);
  const tex = streetTexture().clone();
  tex.needsUpdate = true;
  tex.repeat.set(span / 4, 1);
  const street = mesh(new THREE.PlaneGeometry(span, 7), card(0xffffff, { map: tex }));
  street.rotation.x = -Math.PI / 2;
  street.position.set(mid, 0.005, -wall - 13);
  g.add(street);
  const far = mesh(new THREE.PlaneGeometry(span, 2.4), card(0xe4dccb));
  far.rotation.x = -Math.PI / 2;
  far.position.set(mid, 0.0, -wall - 17.7);
  g.add(far);

  // Hedge just outside, then trees on the lawn.
  for (let x = from + 0.8; x < to; x += 1.5 + rnd()) bush(g, x, -wall - 0.9 - rnd() * 0.4, 0.45 + rnd() * 0.25);
  // Trees between the windows, so each window frames the street.
  for (let x = from + 2; x < to; x += 3.5 + rnd() * 3) {
    if (windows.some(wx => Math.abs(x - wx) < 2.2)) continue;
    tree(g, x, -wall - 3.5 - rnd() * 2.5, 5.2 + rnd() * 1.8, Math.floor(rnd() * 100));
  }
  for (let x = from + 2; x < to; x += 9) streetLamp(g, x, -wall - 9.6, out.bulbs);

  // Buildings across the street, then a far skyline row.
  // Across the street: low shops and mid-rise blocks with gaps for sky.
  for (let x = from + 2, k = Math.floor(rnd() * 5); x < to - 2; k++) {
    const w = 6 + rnd() * 6;
    // Mostly 2-3 storeys so sky shows over the roofs; the odd taller block.
    let h = rnd() < 0.72 ? 6.4 + rnd() * 2.8 : 11 + rnd() * 4;
    // Anything the windows can see stays low, so every window keeps its sky;
    // taller blocks stand only further along the street.
    const off = Math.abs(x + w / 2);
    if (off < 11) h = Math.min(h, 5.4);       // two-storey shops straight across
    else if (off < 18) h = Math.min(h, 7.6);
    building(g, x + w / 2, -wall - 27 - rnd() * 3, w, 9, h, k, out.glow);
    x += w + 2.5 + rnd() * 4;
  }
  // Far skyline, paler with distance.
  for (let x = from - 14, k = 2; x < to + 14; k++) {
    const w = 9 + rnd() * 8;
    building(g, x + w / 2, -wall - 62 - rnd() * 8, w, 12, 9 + rnd() * 15, k, out.glow, 0.45);
    x += w + 3 + rnd() * 5;
  }
  for (let i = 0; i < 4; i++) cloud(g, from + span * (0.15 + i * 0.24), 18 + rnd() * 10, -wall - 70, 3 + rnd() * 2, out.clouds);
}

export function buildExterior({ W, D, T }) {
  const group = new THREE.Group();
  group.name = 'exterior';
  const out = { glow: [], bulbs: [], clouds: [] };
  // Window positions must match buildRoom() in room.js.
  side(group, { rotationY: 0, wall: D / 2 + T, from: -34, to: 34, windows: [-3.8, 0, 3.9] }, out);   // behind the back wall
  side(group, { rotationY: -Math.PI / 2, wall: W / 2 + T, from: -3, to: 34, windows: [0.4] }, out);  // beyond the right wall
  group.position.y = -STOREY;
  group.traverse(o => { o.renderOrder = ORDER; });

  const white = new THREE.Color(0xffffff);
  const glowColor = new THREE.Color();
  const bulbOff = new THREE.Color(0xefe9dc), bulbOn = new THREE.Color(0xffd27a);
  return {
    group,
    // lit: 0 (day) .. 1 (night); sky: current sky colour.
    update(lit, sky) {
      glowColor.setRGB(1.3 * lit, 1.2 * lit, 0.95 * lit);
      for (const m of out.glow) m.emissive.copy(glowColor);
      for (const m of out.bulbs) m.color.copy(bulbOff).lerp(bulbOn, lit);
      for (const m of out.clouds) m.color.copy(sky).lerp(white, 0.65 - 0.4 * lit);
    },
  };
}
