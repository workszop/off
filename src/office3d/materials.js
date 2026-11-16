// ---- Paper-craft materials ----
// The office is a paper diorama: cream card, ink outlines, collage patches.
// Shared helpers keep every piece in the same hand. Surfaces are shaded
// physically, and a finish says what each one is made of (see FINISH).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

// Colours sampled from the zine furniture art and the page's colour tokens.
export const C = {
  ink: 0x292824,
  paper: 0xf4efe5,
  card: 0xefe6d3,
  cardDeep: 0xe1d5be,
  kraft: 0xd9c3a0,
  white: 0xfbf8f1,
  coral: 0xd4765f,
  blue: 0x7d93ab,
  ochre: 0xd7ba78,
  sage: 0xa9bb9f,
  leaf: 0x93a88c,
  screen: 0x39414b,
  coffee: 0x5a3b2a,
  matBlue: 0xbdced1,
  matCoral: 0xd8a08d,
  matOchre: 0xd7ba78,
  matSage: 0xb8c7af,
};

// ---- Textures ----

export function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.anisotropy = 8;
  return tex;
}

let grain;
// Faint paper grain and fibres, multiplied into every card surface.
export function grainTexture() {
  grain ??= canvasTexture(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 240 + Math.random() * 15;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(150,130,105,0.09)';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 34, y + (Math.random() - 0.5) * 34);
      g.stroke();
    }
  });
  return grain;
}

let weave;
// Woven cloth as a height map: threads over and under, for upholstery.
function weaveTexture() {
  weave ??= canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, w, h);
    const n = 8, cell = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const over = (x + y) % 2 === 0;
      const grad = over ? g.createLinearGradient(x * cell, 0, (x + 1) * cell, 0) : g.createLinearGradient(0, y * cell, 0, (y + 1) * cell);
      grad.addColorStop(0, '#5a5a5a'); grad.addColorStop(0.5, '#c8c8c8'); grad.addColorStop(1, '#5a5a5a');
      g.fillStyle = grad;
      g.fillRect(x * cell, y * cell, cell, cell);
    }
  }, { repeat: [9, 9], srgb: false });
  return weave;
}

// ---- Finishes ----
// Everything is card-coloured, but not everything answers light like card.
// A finish sets how rough a surface is, whether it is metal, and how much of
// the room it mirrors (`env`, see environment.js). Card, the default, is
// matt and mirrors nothing.
const FINISH = {
  card:    { roughness: 0.94, metalness: 0, env: 0 },
  fabric:  { roughness: 1, metalness: 0, env: 0, weave: true },
  rubber:  { roughness: 0.78, metalness: 0, env: 0.12 },
  leaf:    { roughness: 0.5, metalness: 0, env: 0.2 },
  satin:   { roughness: 0.5, metalness: 0, env: 0.4 },   // laminate, painted wood and steel
  plastic: { roughness: 0.36, metalness: 0, env: 0.7 },
  gloss:   { roughness: 0.14, metalness: 0, env: 1 },   // glazed ceramic, whiteboard, screens
  metal:   { roughness: 0.3, metalness: 0.9, env: 1 },
};

// The room's reflection map and its brightness (time of day), shared by
// every finish that mirrors.
const mirrors = new Set();
let envMap = null, envLevel = 1;
function reflect(mat) {
  mat.envMap = envMap;
  mat.envMapIntensity = mat.userData.env * envLevel;
}
export function setEnvironment(texture) {
  envMap = texture;
  for (const m of mirrors) { reflect(m); m.needsUpdate = true; }
}
export function setEnvLevel(level) {
  if (level === envLevel) return;
  envLevel = level;
  for (const m of mirrors) m.envMapIntensity = m.userData.env * level;
}

const matCache = new Map();
export function paper(color, { map, side = THREE.FrontSide, emissive, finish = 'card' } = {}) {
  const key = map || emissive ? null : `${color}-${side}-${finish}`;
  if (key && matCache.has(key)) return matCache.get(key);
  const f = FINISH[finish];
  const mat = new THREE.MeshStandardMaterial({
    color, map: map ?? grainTexture(), side,
    roughness: f.roughness, metalness: f.metalness,
    emissive: emissive ?? 0x000000,
  });
  if (f.weave) { mat.bumpMap = weaveTexture(); mat.bumpScale = 0.6; }
  if (f.env) {
    mat.userData.env = f.env;
    mirrors.add(mat);
    mat.addEventListener('dispose', () => mirrors.delete(mat));
    reflect(mat);
  }
  if (key) matCache.set(key, mat);
  return mat;
}

// Window glass: adds only what it mirrors to the view behind it.
export function glass() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000, roughness: 0.04, metalness: 0,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mat.userData.env = 0.3;
  mirrors.add(mat);
  reflect(mat);
  return mat;
}

// ---- Contact shadows ----
// Soft dark card under and around things, where little light reaches. They
// do not depend on the sun, so they ground a piece at any time of day.

// Alpha that fades from 1 inside a rounded rectangle to 0 over `feather`
// pixels outside it (or the reverse, with `invert`). Drawn pixel by pixel:
// canvas blur filters are missing in Safari.
function softRect(g, w, h, inset, feather, invert = false) {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = Math.max(inset - x, x - (w - 1 - inset), 0), dy = Math.max(inset - y, y - (h - 1 - inset), 0);
    const t = Math.min(1, Math.hypot(dx, dy) / feather);
    const inside = 1 - t * t * (3 - 2 * t);
    img.data[(y * w + x) * 4 + 3] = 255 * (invert ? 1 - inside : inside);
  }
  g.putImageData(img, 0, 0);
}

const SHADE = 0x3a3028;
function shadeMesh(w, d, map, opacity) {
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map, color: SHADE, transparent: true, opacity, depthWrite: false })
  );
  m.raycast = () => {};
  return m;
}

let blobTex;
// A soft-edged dark rectangle to lay on the floor under a piece.
export function contactShadow(w, d, opacity = 0.3) {
  blobTex ??= canvasTexture(96, 96, (g, cw, ch) => softRect(g, cw, ch, 40, 38));
  const m = shadeMesh(w, d, blobTex, opacity);
  m.rotation.x = -Math.PI / 2;
  return m;
}

// The same idea for a whole surface: dark toward its edges, where it meets
// the walls. Sizes in metres; `reach` is how far the shade comes in.
export function edgeShadow(w, d, opacity = 0.3, reach = 0.6) {
  const px = 32; // texture pixels per metre
  const tex = canvasTexture(Math.round(w * px), Math.round(d * px), (g, cw, ch) => softRect(g, cw, ch, reach * px, reach * px, true));
  return shadeMesh(w, d, tex, opacity);
}

// ---- Ink ----

export const LINE = new THREE.LineBasicMaterial({ color: C.ink });

const hullMats = new Map();
function hullMaterial(width) {
  if (!hullMats.has(width)) {
    const mat = new THREE.MeshBasicMaterial({ color: C.ink, side: THREE.BackSide });
    mat.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `vec3 transformed = position + normal * ${width.toFixed(4)};`
      );
    };
    mat.customProgramCacheKey = () => `hull-${width}`;
    hullMats.set(width, mat);
  }
  return hullMats.get(width);
}

// Ink a mesh: crease lines along hard edges, and optionally an outline hull
// for curved silhouettes (cylinders, cushions) that have no hard edges.
export function ink(mesh, { edges = 32, hull = 0 } = {}) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (edges) {
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, edges), LINE);
    lines.raycast = () => {};
    mesh.add(lines);
  }
  if (hull) {
    const h = new THREE.Mesh(mesh.geometry, hullMaterial(hull));
    h.raycast = () => {};
    mesh.add(h);
  }
  return mesh;
}

// ---- Primitive helpers (all positions in metres, y = bottom) ----

export function box(parent, [w, h, d], [x, y, z], mat, opts = {}) {
  const m = ink(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), opts);
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}

export function rbox(parent, [w, h, d], [x, y, z], mat, radius = 0.05, opts = { edges: 0, hull: 0.008 }) {
  const m = ink(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), mat), opts);
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}

export function cyl(parent, [rTop, rBottom, h], [x, y, z], mat, opts = { edges: 40, hull: 0.006 }, segments = 28) {
  const m = ink(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat), opts);
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}

// A thin rod between two points (legs, poles).
export function rod(parent, a, b, radius, mat, opts = { edges: 0, hull: 0.005 }) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = ink(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 10), mat), opts);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(m);
  return m;
}

// Collage patch: a torn scrap of coloured paper glued onto a face. The
// scrap lies in its local XY plane; position/rotate it onto a surface.
export function patch(parent, w, h, color, position, rotation = [0, 0, 0], seed = 1) {
  let s = seed * 9301;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const shape = new THREE.Shape();
  const pts = [];
  const n = 7;
  for (let i = 0; i < n; i++) pts.push([-w / 2 + (w * i) / n, -h / 2 + (rnd() - 0.5) * h * 0.08]);
  for (let i = 0; i < n; i++) pts.push([w / 2 + (rnd() - 0.5) * w * 0.08, -h / 2 + (h * i) / n]);
  for (let i = 0; i < n; i++) pts.push([w / 2 - (w * i) / n, h / 2 + (rnd() - 0.5) * h * 0.08]);
  for (let i = 0; i < n; i++) pts.push([-w / 2 + (rnd() - 0.5) * w * 0.08, h / 2 - (h * i) / n]);
  shape.moveTo(...pts[0]);
  for (const p of pts.slice(1)) shape.lineTo(...p);
  const geo = new THREE.ShapeGeometry(shape);
  // Planar UVs so the paper grain maps across the scrap.
  const pos = geo.attributes.position, uv = [];
  for (let i = 0; i < pos.count; i++) uv.push(pos.getX(i) / 0.5, pos.getY(i) / 0.5);
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.Mesh(geo, paper(color));
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
