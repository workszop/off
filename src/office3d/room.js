// ---- The room ----
// A paper diorama on a card base: gridded paper floor, four card walls with
// windows and a door, the four zone mats from the 2D office with their
// handwritten labels, a pinboard, and a wall clock that keeps real time.
//
// Walls on the camera's side fold down to knee height (dollhouse cut-away),
// so the room is always visible from any orbit angle.

import * as THREE from 'three';
import { C, paper, ink, box, cyl, canvasTexture, grainTexture } from './materials.js';
import { portalWriter } from './exterior.js';

export const ROOM = { W: 12, D: 8, H: 2.5, T: 0.12 };
const LOW = 0.26; // cut-away wall height

// ---- Floor ----

function floorTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#f2ecdf';
    g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(160,178,178,0.55)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, w, h);
  }, { repeat: [ROOM.W, ROOM.D] });
}

function buildBase(group) {
  const { W, D } = ROOM;
  const side = paper(C.kraft);
  const top = paper(C.white, { map: floorTexture() });
  const base = ink(new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.3, D + 0.5), [side, side, top, side, side, side]));
  base.position.y = -0.15;
  base.castShadow = false;
  group.add(base);
}

// ---- Zone mats ----

const ZONES = [
  { label: 'focus corner', color: '#bdced1', rect: [-5.8, -3.85, -0.85, -1.15], rot: -0.012, seed: 1 },
  { label: 'coffee nook', color: '#d8a08d', rect: [2.75, -3.85, 5.8, -0.85], rot: 0.014, seed: 2 },
  { label: 'thinking wall', color: '#d7ba78', rect: [-5.8, -0.1, -2.55, 3.1], rot: 0.01, seed: 3, align: 'right' },
  { label: 'soft landing', color: '#b8c7af', rect: [1.25, -0.05, 5.8, 3.45], rot: -0.01, seed: 4 },
];

function jaggedRect(w, h, seed) {
  let s = seed * 7919;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const shape = new THREE.Shape();
  const pts = [];
  const step = 0.35;
  const edge = (x0, y0, x1, y1) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const nx = -(y1 - y0), ny = x1 - x0, len = Math.hypot(nx, ny);
      const j = (rnd() - 0.5) * 0.09;
      pts.push([x0 + (x1 - x0) * t + (nx / len) * j, y0 + (y1 - y0) * t + (ny / len) * j]);
    }
  };
  edge(-w / 2, -h / 2, w / 2, -h / 2);
  edge(w / 2, -h / 2, w / 2, h / 2);
  edge(w / 2, h / 2, -w / 2, h / 2);
  edge(-w / 2, h / 2, -w / 2, -h / 2);
  shape.moveTo(...pts[0]);
  for (const p of pts.slice(1)) shape.lineTo(...p);
  return shape;
}

function buildMats(group) {
  ZONES.forEach((z, i) => {
    const [x0, z0, x1, z1] = z.rect;
    const w = x1 - x0, d = z1 - z0;
    const px = 140; // texture pixels per metre
    const tex = canvasTexture(Math.round(w * px), Math.round(d * px), (g, cw, ch) => {
      g.fillStyle = z.color;
      g.fillRect(0, 0, cw, ch);
      g.globalAlpha = 0.07;
      g.drawImage(grainTexture().image, 0, 0, cw, ch);
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,255,255,0.32)';
      g.lineWidth = 2;
      for (let y = 46; y < ch; y += 46) { g.beginPath(); g.moveTo(0, y); g.lineTo(cw, y); g.stroke(); }
      g.fillStyle = 'rgba(41,40,36,0.62)';
      g.font = '600 64px Caveat, cursive';
      // Front edge, nearest the camera; right-aligned where furniture sits at the left.
      g.textAlign = z.align === 'right' ? 'right' : 'left';
      g.fillText(z.label, z.align === 'right' ? cw - 34 : 34, ch - 30);
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const geo = new THREE.ShapeGeometry(jaggedRect(w, d, z.seed));
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    // Shape Y becomes world -Z after the rotation below, so the label
    // (top of the canvas) lands at the back edge of the mat.
    for (let k = 0; k < pos.count; k++) uv.setXY(k, pos.getX(k) / w + 0.5, pos.getY(k) / d + 0.5);
    const mat = new THREE.Mesh(geo, paper(C.white, { map: tex }));
    mat.rotation.set(-Math.PI / 2, 0, z.rot);
    mat.position.set((x0 + x1) / 2, 0.003 + i * 0.0006, (z0 + z1) / 2);
    mat.receiveShadow = true;
    group.add(mat);
  });
}

// ---- Walls ----

// Wall outline in its own XY plane (x along the wall, y up), with door
// notches cut from the bottom edge and window holes.
function wallGeometry(length, height, { doors = [], windows = [] }) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  for (const d of [...doors].sort((a, b) => a.x - b.x)) {
    const x0 = d.x - d.w / 2 + length / 2, x1 = d.x + d.w / 2 + length / 2, h = Math.min(d.h, height - 0.05);
    s.lineTo(x0, 0); s.lineTo(x0, h); s.lineTo(x1, h); s.lineTo(x1, 0);
  }
  s.lineTo(length, 0);
  s.lineTo(length, height);
  s.lineTo(0, height);
  s.closePath();
  for (const win of windows) {
    if (win.y1 > height) continue;
    const x0 = win.x - win.w / 2 + length / 2, x1 = x0 + win.w;
    const hole = new THREE.Path();
    hole.moveTo(x0, win.y0); hole.lineTo(x1, win.y0); hole.lineTo(x1, win.y1); hole.lineTo(x0, win.y1); hole.closePath();
    s.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: ROOM.T, bevelEnabled: false });
  geo.translate(-length / 2, 0, -ROOM.T / 2);
  // Planar UVs in metres for the paper grain.
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + pos.getZ(i)) / 1.5, pos.getY(i) / 1.5);
  return geo;
}

function windowFrame(parent, win, skyMat) {
  const g = new THREE.Group();
  const frame = paper(C.white);
  const cx = win.x, w = win.w, h = win.y1 - win.y0, t = 0.05;
  box(g, [w + 0.08, t, ROOM.T + 0.04], [cx, win.y0 - t, 0], frame);           // sill
  box(g, [w + 0.08, t, ROOM.T + 0.02], [cx, win.y1, 0], frame);
  box(g, [t, h, ROOM.T + 0.02], [cx - w / 2 - t / 2, win.y0, 0], frame);
  box(g, [t, h, ROOM.T + 0.02], [cx + w / 2 + t / 2, win.y0, 0], frame);
  box(g, [0.035, h, 0.04], [cx, win.y0, 0], frame);                          // mullion
  box(g, [w, 0.035, 0.04], [cx, win.y0 + h * 0.55, 0], frame);               // transom
  // The pane paints the sky and opens the stencil 'portal' the outside
  // world is drawn through (exterior.js).
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), skyMat);
  pane.renderOrder = 1;
  pane.position.set(cx, win.y0 + h / 2, -0.03);
  g.add(pane);
  parent.add(g);
  return g;
}

function buildWall({ name, length, position, rotationY, doors = [], windows = [] }, skyMat) {
  const group = new THREE.Group();
  group.name = name;
  group.position.copy(position);
  group.rotation.y = rotationY;
  const mat = paper(0xece3d1);

  const full = new THREE.Group();
  const wall = ink(new THREE.Mesh(wallGeometry(length, ROOM.H, { doors, windows }), mat), { edges: 30 });
  full.add(wall);
  for (const win of windows) windowFrame(full, win, skyMat);
  // Coloured paper skirting strip along the inside.
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.08), paper(C.cardDeep));
  strip.position.set(0, 0.04, ROOM.T / 2 + 0.002);
  full.add(strip);
  group.add(full);

  const low = ink(new THREE.Mesh(wallGeometry(length, LOW, { doors }), mat), { edges: 30 });
  low.visible = false;
  group.add(low);

  // Inward normal in world space, for the cut-away test.
  const inward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
  return { group, full, low, inward, cut: 0, extras: [] };
}

// ---- Wall decorations ----

function wallClock() {
  const g = new THREE.Group();
  const face = cyl(g, [0.22, 0.22, 0.03], [0, -0.015, 0], paper(C.white), { edges: 0, hull: 0.008 }, 48);
  face.rotation.x = Math.PI / 2;
  face.position.set(0, 0, 0.015);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.012, i % 3 ? 0.025 : 0.045, 0.004), paper(C.ink));
    tick.position.set(Math.sin(a) * 0.18, Math.cos(a) * 0.18, 0.032);
    tick.rotation.z = -a;
    g.add(tick);
  }
  const hand = (len, w) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.006), paper(C.ink));
    m.position.y = len / 2 - 0.02;
    pivot.add(m);
    pivot.position.z = 0.036;
    g.add(pivot);
    return pivot;
  };
  const hour = hand(0.11, 0.016), minute = hand(0.16, 0.01);
  const second = hand(0.17, 0.004);
  second.children[0].material = paper(C.coral);
  return {
    object: g,
    update(date) {
      const s = date.getSeconds(), m = date.getMinutes() + s / 60, h = (date.getHours() % 12) + m / 60;
      hour.rotation.z = -(h / 12) * Math.PI * 2;
      minute.rotation.z = -(m / 60) * Math.PI * 2;
      second.rotation.z = -(s / 60) * Math.PI * 2;
    },
  };
}

function pinboard() {
  const g = new THREE.Group();
  box(g, [1.2, 0.8, 0.03], [0, 0, 0], paper(0xc9a26d));
  for (const [x, y, w, h] of [[0, -0.02, 1.26, 0.03], [0, 0.79, 1.26, 0.03], [-0.615, 0, 0.03, 0.82], [0.615, 0, 0.03, 0.82]]) {
    box(g, [w, h, 0.045], [x, y, 0], paper(C.white));
  }
  const notes = [
    [-0.36, 0.5, C.ochre, 0.08], [-0.05, 0.56, C.white, -0.06], [0.3, 0.48, C.matCoral, 0.05],
    [-0.3, 0.17, C.matBlue, -0.04], [0.08, 0.2, C.matSage, 0.1], [0.38, 0.14, C.white, -0.08],
  ];
  for (const [x, y, color, rot] of notes) {
    const note = ink(new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), paper(color)), { edges: 1 });
    note.position.set(x, y + 0.1, 0.017);
    note.rotation.z = rot;
    g.add(note);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), paper(C.coral));
    pin.position.set(x, y + 0.18, 0.03);
    g.add(pin);
  }
  return g;
}

// ---- Build ----

export function buildRoom() {
  const { W, D, T } = ROOM;
  const group = new THREE.Group();
  buildBase(group);
  buildMats(group);

  const skyMat = portalWriter(new THREE.MeshBasicMaterial({ color: 0xbcd8ee, fog: false }));
  // Big windows: sill just above desk height, head close to the ceiling line.
  const win = (x, w = 2.4) => ({ x, w, y0: 0.85, y1: 2.3 });
  const walls = [
    buildWall({ name: 'back', length: W + 2 * T, position: new THREE.Vector3(0, 0, -D / 2 - T / 2), rotationY: 0, windows: [win(-3.8), win(0), win(3.9)] }, skyMat),
    buildWall({ name: 'front', length: W + 2 * T, position: new THREE.Vector3(0, 0, D / 2 + T / 2), rotationY: Math.PI, doors: [{ x: 2.0, w: 1.0, h: 2.1 }] }, skyMat),
    buildWall({ name: 'left', length: D, position: new THREE.Vector3(-W / 2 - T / 2, 0, 0), rotationY: Math.PI / 2 }, skyMat),
    buildWall({ name: 'right', length: D, position: new THREE.Vector3(W / 2 + T / 2, 0, 0), rotationY: -Math.PI / 2, windows: [win(0.4, 3.0)] }, skyMat),
  ];
  for (const w of walls) group.add(w.group);

  // Door leaf, swung open into the room (front wall's local X is mirrored).
  const front = walls[1];
  const hinge = new THREE.Group();
  hinge.position.set(2.0 - 0.5, 0, T / 2);
  hinge.rotation.y = -1.2; // negative swings toward local +Z, into the room
  box(hinge, [0.96, 2.06, 0.04], [0.48, 0, 0.02], paper(C.cardDeep));
  cyl(hinge, [0.025, 0.025, 0.05], [0.86, 1.0, 0.06], paper(C.white)).rotation.x = Math.PI / 2;
  front.full.add(hinge);

  const clock = wallClock();
  clock.object.position.set(2.0, 2.05 - 0.05, T / 2 + 0.005);
  walls[0].full.add(clock.object);

  const board = pinboard();
  board.position.set(1.4, 1.0, T / 2 + 0.02);
  walls[2].full.add(board);

  return { group, walls, skyMat, clock };
}

// Fold down walls standing between the camera and the room.
export function updateWalls(walls, camera, dt) {
  for (const w of walls) {
    const toCam = camera.position.clone().sub(w.group.position);
    toCam.y = 0;
    const target = toCam.dot(w.inward) < 0 ? 1 : 0;
    w.cut += (target - w.cut) * Math.min(1, dt * 5);
    if (Math.abs(w.cut - target) < 0.01) w.cut = target;
    const lowRatio = LOW / ROOM.H;
    w.full.scale.y = 1 - (1 - lowRatio) * w.cut;
    w.full.visible = w.cut < 0.99;
    w.low.visible = !w.full.visible;
  }
}
