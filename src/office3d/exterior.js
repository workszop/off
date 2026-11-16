// ---- The view outside ----
// Trees, a street, card buildings and a sky with clouds outside the back
// and right walls, seen only through the windows.
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
const SKY_RADIUS = 100; // beyond the far skyline, inside the camera's range

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

// Matt card, shaded by the same sun and sky light as the room.
const card = (color, extra = {}) => portalOnly(new THREE.MeshStandardMaterial({ color, roughness: 0.95, map: grainTexture(), ...extra }));
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

// Repeatable random numbers for textures and planting.
function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

// Facade tile: two window bays wide, two storeys tall (6 m x 6.4 m). Each
// window has a recess, a frame, a sill and a blind drawn to its own height.
// `lit` paints the same windows on black, some of them glowing, for the
// night-time emissive map.
const facadeCache = new Map();
function facadeTexture(kind, glass, lit) {
  const key = `${kind}-${lit}`;
  if (!facadeCache.has(key)) {
    const rnd = seeded(kind * 97 + 11);
    const wins = [];
    for (const y of [26, 154]) for (const x of [32, 160]) wins.push({ x, y, blind: rnd() * 0.6, on: rnd() < 0.55, warm: rnd() < 0.7 });
    facadeCache.set(key, canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = lit ? '#000' : '#fff';
      g.fillRect(0, 0, w, h);
      if (!lit) {
        // Weathering: faint streaks down the wall, a string course per storey.
        for (let i = 0; i < 26; i++) {
          g.fillStyle = `rgba(90,80,65,${0.02 + rnd() * 0.035})`;
          g.fillRect(rnd() * w, 0, 2 + rnd() * 7, h);
        }
        for (const y of [0, 128]) {
          g.fillStyle = 'rgba(60,52,44,0.3)'; g.fillRect(0, y + 122, w, 2);
          g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, y + 124, w, 4);
        }
      }
      const W = 64, H = 80;
      for (const { x, y, blind, on, warm } of wins) {
        if (lit) {
          if (!on) continue;
          g.fillStyle = warm ? '#ffd88a' : '#ffeec4';
          g.fillRect(x, y, W, H);
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.fillRect(x, y, W, H * blind);
          continue;
        }
        g.fillStyle = 'rgba(40,34,28,0.28)';                       // shadow of the reveal
        g.fillRect(x - 5, y - 5, W + 10, H + 8);
        g.fillStyle = '#f3ede0';                                    // frame
        g.fillRect(x - 3, y - 3, W + 6, H + 6);
        const pane = g.createLinearGradient(0, y, 0, y + H);        // glass: dark room above, sky below
        pane.addColorStop(0, '#46535e'); pane.addColorStop(0.55, '#6d8191'); pane.addColorStop(1, glass);
        g.fillStyle = pane;
        g.fillRect(x, y, W, H);
        g.fillStyle = 'rgba(255,255,255,0.16)';                     // a streak of reflected sky
        g.beginPath(); g.moveTo(x + 10, y + H); g.lineTo(x + 34, y); g.lineTo(x + 46, y); g.lineTo(x + 22, y + H); g.fill();
        g.fillStyle = '#e9dfca';                                    // blind
        g.fillRect(x, y, W, H * blind);
        g.fillStyle = 'rgba(40,34,28,0.22)';
        g.fillRect(x, y + H * blind, W, 3);
        g.fillStyle = '#f3ede0';                                    // glazing bars
        g.fillRect(x + W / 2 - 2, y, 4, H);
        g.fillRect(x, y + H * 0.38, W, 3);
        g.fillStyle = '#f7f2e6';                                    // sill, and its shadow
        g.fillRect(x - 8, y + H + 3, W + 16, 6);
        g.fillStyle = 'rgba(40,34,28,0.3)';
        g.fillRect(x - 6, y + H + 9, W + 12, 4);
        g.strokeStyle = 'rgba(41,40,36,0.55)';
        g.lineWidth = 1.5;
        g.strokeRect(x - 3, y - 3, W + 6, H + 6);
      }
    }));
  }
  return facadeCache.get(key);
}

// Shopfront tile for the ground floor (6 m x 3 m): a fascia in the shop's
// colour, two display windows and a door.
const shopCache = new Map();
function shopTexture(accent, lit) {
  const key = `${accent}-${lit}`;
  if (!shopCache.has(key)) {
    shopCache.set(key, canvasTexture(256, 128, (g, w, h) => {
      g.fillStyle = lit ? '#000' : '#efe7d6';
      g.fillRect(0, 0, w, h);
      const panes = [[12, 40, 88, 62], [112, 40, 78, 62], [204, 40, 40, 80]];
      if (lit) {
        g.fillStyle = '#ffdf9a';
        for (const [x, y, pw, ph] of panes.slice(0, 2)) g.fillRect(x, y, pw, ph);
        g.fillStyle = '#b89a5e';
        g.fillRect(...panes[2]);
        return;
      }
      g.fillStyle = accent;                                         // fascia and awning stripes
      g.fillRect(0, 0, w, 30);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = 0; x < w; x += 24) g.fillRect(x, 18, 12, 12);
      g.fillStyle = 'rgba(40,34,28,0.3)';
      g.fillRect(0, 30, w, 5);
      for (const [x, y, pw, ph] of panes) {
        g.fillStyle = '#f3ede0';
        g.fillRect(x - 3, y - 3, pw + 6, ph + 6);
        const pane = g.createLinearGradient(0, y, 0, y + ph);
        pane.addColorStop(0, '#3d4852'); pane.addColorStop(1, '#7b8f9c');
        g.fillStyle = pane;
        g.fillRect(x, y, pw, ph);
        g.fillStyle = 'rgba(255,255,255,0.14)';
        g.beginPath(); g.moveTo(x + 6, y + ph); g.lineTo(x + pw * 0.5, y); g.lineTo(x + pw * 0.7, y); g.lineTo(x + pw * 0.3, y + ph); g.fill();
        g.strokeStyle = 'rgba(41,40,36,0.55)';
        g.lineWidth = 1.5;
        g.strokeRect(x - 3, y - 3, pw + 6, ph + 6);
      }
      g.fillStyle = '#cfc5b2';                                      // plinth
      g.fillRect(0, 108, 200, 20);
    }));
  }
  return shopCache.get(key);
}

let lawnTex;
// Mown grass: mottled greens, lighter and darker patches.
function lawnTexture() {
  lawnTex ??= canvasTexture(256, 256, (g, w, h) => {
    const rnd = seeded(5);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const v = rnd();
      g.fillStyle = v < 0.5 ? `rgba(60,90,40,${0.02 + rnd() * 0.035})` : `rgba(235,240,190,${0.02 + rnd() * 0.035})`;
      g.beginPath();
      g.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 34, 8 + rnd() * 22, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  return lawnTex;
}

// The sky, painted on the inside of a wide drum around the scene: haze that
// thickens toward the horizon and soft cumulus clouds. It is white on clear;
// the material's colour tints it for the time of day.
function skyTexture() {
  return canvasTexture(2048, 512, (g, w, h) => {
    const rnd = seeded(41);
    const haze = g.createLinearGradient(0, 0, 0, h);
    haze.addColorStop(0.3, 'rgba(255,255,255,0)');
    haze.addColorStop(0.7, 'rgba(255,255,255,0.14)');
    haze.addColorStop(0.87, 'rgba(255,255,255,0.5)');
    haze.addColorStop(1, 'rgba(255,255,255,0.6)');
    g.fillStyle = haze;
    g.fillRect(0, 0, w, h);
    const puff = (x, y, r, a) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(255,255,255,${a})`);
      grad.addColorStop(0.55, `rgba(255,255,255,${a * 0.75})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    };
    // Clouds stay clear of the texture's seam, which faces the windowless wall.
    // The windows show the sky from the horizon (0.87 of the way down the
    // texture) to about a third of the way up it, so most clouds sit there.
    for (let i = 0; i < 26; i++) {
      const cx = 140 + rnd() * (w - 280), base = h * (0.34 + rnd() * 0.47);
      const half = 50 + rnd() * 90, tall = 16 + rnd() * 26;
      // Smaller and flatter toward the horizon, as distance makes them.
      const far = (base / h - 0.34) / 0.47, k = 1 - far * 0.55;
      for (let j = 0; j < 16; j++) {
        const t = rnd() * 2 - 1, bulge = 1 - t * t;
        puff(cx + t * half * k, base - rnd() * tall * k * bulge, (14 + rnd() * 26 * bulge + 8) * k, 0.75 + rnd() * 0.25);
      }
      // Flat, slightly shaded underside.
      const under = g.createLinearGradient(0, base - 4, 0, base + 12 * k);
      under.addColorStop(0, 'rgba(150,160,178,0.22)');
      under.addColorStop(1, 'rgba(150,160,178,0)');
      g.fillStyle = under;
      g.beginPath(); g.ellipse(cx, base + 2, half * k * 0.9, 9 * k, 0, 0, Math.PI * 2); g.fill();
    }
  });
}

// ---- Pieces ----

// Several meshes' worth of triangles as one geometry (position, normal, colour).
function mergeLumps(lumps) {
  const total = lumps.reduce((n, l) => n + l.position.length, 0);
  const position = new Float32Array(total), normal = new Float32Array(total), color = new Float32Array(total);
  let at = 0;
  for (const l of lumps) { position.set(l.position, at); normal.set(l.normal, at); color.set(l.color, at); at += l.position.length; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return geo;
}

// One clump of leaves: a ball pushed in and out so its outline is irregular,
// lighter on top where the sky reaches it and darker underneath. Each small
// face takes its own shade and catches the light at its own angle, which
// breaks the surface up the way sprays of leaves do.
const lumpBase = new THREE.IcosahedronGeometry(1, 2);
const leafTop = new THREE.Color(), leafLow = new THREE.Color(), leafTint = new THREE.Color();
const corner = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const faceN = new THREE.Vector3(), edge = new THREE.Vector3(), mixed = new THREE.Vector3();
function leafLump(cx, cy, cz, r, green, seed, squash = 1) {
  const src = lumpBase.attributes.position;
  const position = new Float32Array(src.count * 3), normal = new Float32Array(src.count * 3), color = new Float32Array(src.count * 3);
  leafTop.set(green).offsetHSL(0.01, 0.03, 0.08);
  leafLow.set(green).offsetHSL(-0.015, 0.02, -0.1);
  for (let f = 0; f < src.count; f += 3) {
    for (let k = 0; k < 3; k++) {
      const x = src.getX(f + k), y = src.getY(f + k), z = src.getZ(f + k);
      // The same point always moves the same way, so the faces stay joined.
      const bump = 1 + 0.13 * Math.sin(x * 5.1 + seed) * Math.sin(y * 4.3 + seed * 1.7)
        + 0.09 * Math.sin(z * 7.3 + seed * 0.6 + x * 3.1) + 0.07 * Math.sin(x * 13 + y * 11 + z * 15 + seed * 2.3);
      corner[k].set(x * r * bump, y * r * bump * squash, z * r * bump);
    }
    faceN.subVectors(corner[1], corner[0]).cross(edge.subVectors(corner[2], corner[0])).normalize();
    // A shade per face, repeatable from where the face is.
    const fleck = 0.86 + 0.28 * Math.abs(Math.sin(corner[0].x * 37.1 + corner[1].y * 51.7 + corner[2].z * 43.3 + seed));
    for (let k = 0; k < 3; k++) {
      const i = (f + k) * 3, y = src.getY(f + k);
      position.set([cx + corner[k].x, cy + corner[k].y, cz + corner[k].z], i);
      mixed.set(src.getX(f + k), y, src.getZ(f + k)).multiplyScalar(0.55).addScaledVector(faceN, 0.45).normalize();
      normal.set([mixed.x, mixed.y, mixed.z], i);
      leafTint.copy(leafLow).lerp(leafTop, THREE.MathUtils.smoothstep(y, -0.9, 0.8)).multiplyScalar(fleck);
      color.set([leafTint.r, leafTint.g, leafTint.b], i);
    }
  }
  return { position, normal, color };
}

let leafMat;
const leaves = () => (leafMat ??= portalOnly(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

const TREE_GREENS = [0x7d9a62, 0x6f8f5a, 0x8aa56c, 0x76946a];
const BARK = 0x8f7558;

function tree(parent, x, z, h, seed) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const rnd = seeded(seed * 13 + 7);
  const bark = card(BARK);
  const trunk = mesh(new THREE.CylinderGeometry(0.07 * h / 4, 0.17 * h / 4, h * 0.5, 8), bark, { outline: true });
  trunk.position.y = h * 0.25;
  g.add(trunk);
  // Boughs reaching up into the crown.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + seed, len = h * (0.24 + rnd() * 0.08);
    const bough = mesh(new THREE.CylinderGeometry(0.025 * h / 4, 0.06 * h / 4, len, 6), bark);
    bough.position.set(Math.sin(a) * len * 0.3, h * 0.47 + len * 0.36, Math.cos(a) * len * 0.3);
    bough.rotation.set(Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7);
    g.add(bough);
  }
  // The crown: a ring of clumps around a core, with smaller ones on top.
  const green = TREE_GREENS[seed % TREE_GREENS.length];
  const lumps = [leafLump(0, h * 0.68, 0, h * 0.24, green, seed)];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd(), out = h * (0.17 + rnd() * 0.08);
    lumps.push(leafLump(Math.sin(a) * out, h * (0.54 + rnd() * 0.2), Math.cos(a) * out, h * (0.12 + rnd() * 0.06), green, seed + i * 3.1, 0.85));
  }
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2, out = h * (0.06 + rnd() * 0.07);
    lumps.push(leafLump(Math.sin(a) * out, h * (0.82 + rnd() * 0.1), Math.cos(a) * out, h * (0.1 + rnd() * 0.05), green, seed + 40 + i));
  }
  g.add(new THREE.Mesh(mergeLumps(lumps), leaves()));
  parent.add(g);
}

function bush(parent, x, z, s, seed = 1) {
  const lumps = [
    leafLump(0, s * 0.55, 0, s, 0x74915f, seed, 0.75),
    leafLump(s * 0.7, s * 0.42, s * 0.1, s * 0.7, 0x6c8a58, seed + 5, 0.75),
    leafLump(-s * 0.65, s * 0.45, -s * 0.1, s * 0.75, 0x7b9865, seed + 9, 0.75),
  ];
  const b = new THREE.Mesh(mergeLumps(lumps), leaves());
  b.position.set(x, 0, z);
  parent.add(b);
}

const FACADES = [
  [0xefe6d3, '#bcd4e6', '#d4765f'], [0xe6bfae, '#c9dbe8', '#7d93ab'], [0xc3d0d6, '#e9f1f6', '#d7ba78'],
  [0xe7d6a8, '#bcd4e6', '#93a88c'], [0xcfd8c4, '#d9e7ef', '#b98a6b'],
];

// Scale a box's side UVs so a texture tile covers `tileW` x `tileH` metres.
function tileSides(geo, w, h, d, tileW, tileH) {
  const uv = geo.attributes.uv, nrm = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(nrm.getY(i)) > 0.5) continue;
    const across = Math.abs(nrm.getX(i)) > 0.5 ? d : w;
    uv.setXY(i, uv.getX(i) * across / tileW, uv.getY(i) * h / tileH);
  }
  return geo;
}

function building(parent, x, z, w, d, h, kind, glow, haze = 0) {
  const [base, glass, accent] = FACADES[kind % FACADES.length];
  const pale = new THREE.Color(0xdfe8ee);
  const color = new THREE.Color(base).lerp(pale, haze);
  const textured = (map, emissiveMap, tint) => {
    for (const t of [map, emissiveMap]) { t.needsUpdate = true; t.repeat.set(1, 1); }
    const mat = card(tint, { map, emissiveMap, emissive: 0x000000 });
    glow.push(mat);
    return mat;
  };
  const wall = textured(facadeTexture(kind % FACADES.length, glass, false).clone(), facadeTexture(kind % FACADES.length, glass, true).clone(), color);
  const roof = card(new THREE.Color(0xb9b0a0).lerp(pale, haze));
  // Each window bay is 3 m wide and a storey 3.2 m tall.
  const b = mesh(tileSides(new THREE.BoxGeometry(w, h, d), w, h, d, 6, 6.4), [wall, wall, roof, roof, wall, wall], { edges: true });
  b.position.set(x, h / 2, z);
  parent.add(b);
  // A parapet round the roof, proud of the wall.
  const trim = card(new THREE.Color(base).multiplyScalar(0.9).lerp(pale, haze));
  const parapet = mesh(new THREE.BoxGeometry(w + 0.36, 0.45, d + 0.36), trim, { edges: true });
  parapet.position.set(x, h + 0.1, z);
  parent.add(parapet);
  // Near buildings have a shop at street level.
  if (!haze) {
    const front = textured(shopTexture(accent, false).clone(), shopTexture(accent, true).clone(), 0xffffff);
    const shop = mesh(tileSides(new THREE.BoxGeometry(w + 0.14, 3, d + 0.14), w, 3, d, 6, 3), [front, front, trim, trim, front, front], { edges: true });
    shop.position.set(x, 1.5, z);
    parent.add(shop);
  }
  // Rooftop clutter.
  if (kind % 2 === 0) {
    const tank = mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 16), card(new THREE.Color(0x9a8468).lerp(pale, haze)), { edges: true });
    tank.position.set(x + w * 0.2, h + 1.1, z);
    parent.add(tank);
  } else {
    const hut = mesh(new THREE.BoxGeometry(w * 0.3, 1.4, d * 0.3), trim, { edges: true });
    hut.position.set(x - w * 0.18, h + 1.0, z);
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

// One side of the street scene. Local frame: -Z points away from the room,
// local X runs along the wall; `wall` is the outer wall face distance.
// `windows` lists the local X of each window, so trees stand in the gaps.
function side(root, { rotationY, wall, from, to, windows = [], lift = 0 }, out) {
  const g = new THREE.Group();
  g.rotation.y = rotationY;
  g.position.y = lift;
  root.add(g);
  const span = to - from, mid = (from + to) / 2;
  let seed = Math.round(wall * 13);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  // Lawn, sidewalk, street.
  const grass = lawnTexture().clone();
  grass.needsUpdate = true;
  grass.repeat.set(span / 9, 60 / 9);
  const lawn = mesh(new THREE.PlaneGeometry(span, 60), card(0xa9bd8a, { map: grass }));
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
  for (let x = from + 0.8; x < to; x += 1.5 + rnd()) bush(g, x, -wall - 0.9 - rnd() * 0.4, 0.45 + rnd() * 0.25, x * 3.7);
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
}

export function buildExterior({ W, D, T }) {
  const group = new THREE.Group();
  group.name = 'exterior';
  const out = { glow: [], bulbs: [], clouds: [] };
  // Window positions must match buildRoom() in room.js.
  side(group, { rotationY: 0, wall: D / 2 + T, from: -34, to: 34, windows: [-3.8, 0, 3.9] }, out);   // behind the back wall
  // The second side reaches past the front corner, so no view from the right
  // window runs off the ground, and stands a hair higher: where the two
  // sides' lawns and streets overlap, one is always on top.
  side(group, { rotationY: -Math.PI / 2, wall: W / 2 + T, from: -24, to: 34, windows: [0.4], lift: 0.015 }, out);  // beyond the right wall
  // The sky drum. It is drawn last and behind everything, so it only shows
  // where no building or tree stands.
  const skyMat = portalOnly(new THREE.MeshBasicMaterial({ map: skyTexture(), transparent: true, depthWrite: false, side: THREE.BackSide }));
  skyMat.map.wrapT = THREE.ClampToEdgeWrapping;
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(SKY_RADIUS, SKY_RADIUS, 84, 48, 1, true), skyMat);
  sky.position.y = 37; // the horizon sits low on the drum
  group.add(sky);
  out.clouds.push(skyMat);
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
      // Haze and clouds: near white by day, sinking into the sky at night.
      for (const m of out.clouds) m.color.copy(sky).lerp(white, 0.8 - 0.55 * lit);
    },
  };
}
