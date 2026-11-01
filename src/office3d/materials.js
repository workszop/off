// ---- Paper-craft materials ----
// The office is a paper diorama: cream card, ink outlines, collage patches.
// Shared helpers keep every piece in the same hand.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

// Colours sampled from the zine furniture art and css/style.css tokens.
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

let ramp;
// Soft three-step toon ramp: shading stays flat and papery.
function toonRamp() {
  if (!ramp) {
    const steps = [196, 232, 255];
    const data = new Uint8Array(steps.length * 4);
    steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
    ramp = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.generateMipmaps = false;
    ramp.needsUpdate = true;
  }
  return ramp;
}

const matCache = new Map();
export function paper(color, { map, side = THREE.FrontSide, emissive } = {}) {
  const key = map || emissive ? null : `${color}-${side}`;
  if (key && matCache.has(key)) return matCache.get(key);
  const mat = new THREE.MeshToonMaterial({
    color, gradientMap: toonRamp(), map: map ?? grainTexture(), side,
    emissive: emissive ?? 0x000000,
  });
  if (key) matCache.set(key, mat);
  return mat;
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
