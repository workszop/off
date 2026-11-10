// ---- Wall art ----
// Framed pictures for the two walls without windows: the door wall and the
// pinboard wall. Every picture is painted here, on a canvas, in the manner
// of a familiar kind of modern art (grid and primaries, drip painting, op
// art, nested squares), plus three office charts.
//
// Each picture has its own seeded random numbers, so it is the same picture
// on every visit and painting it never disturbs the simulation's ?seed.
//
//   hangWallArt({ front, left });   // the room's wall objects (room.js)

import * as THREE from 'three';
import { C, paper, box, canvasTexture } from './materials.js';

const PX_PER_M = 420;
const INK = '#292824', CREAM = '#f6f1e4';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Paintings ----

// Black grid, a few panes in red, yellow and blue.
function grid(g, w, h, rnd) {
  const panes = [{ x: 0, y: 0, w, h }];
  for (let i = 0; i < 10; i++) {
    // Split the largest pane across its longer side.
    panes.sort((a, b) => b.w * b.h - a.w * a.h);
    const p = panes.shift(), t = 0.3 + rnd() * 0.4;
    if (p.w > p.h) panes.push({ ...p, w: p.w * t }, { ...p, x: p.x + p.w * t, w: p.w * (1 - t) });
    else panes.push({ ...p, h: p.h * t }, { ...p, y: p.y + p.h * t, h: p.h * (1 - t) });
  }
  // One pane of each colour among the smaller ones, one black, the rest left cream.
  panes.sort((a, b) => a.w * a.h - b.w * b.h);
  const colours = ['#d2402f', '#2c5a9c', '#e9c53a', INK, '#d2402f'];
  const pick = [2, 4, 6, 0, 8];
  g.fillStyle = CREAM;
  g.fillRect(0, 0, w, h);
  pick.forEach((i, n) => { const p = panes[i]; g.fillStyle = colours[n]; g.fillRect(p.x, p.y, p.w, p.h); });
  g.strokeStyle = INK;
  g.lineWidth = w * 0.024;
  for (const p of panes) g.strokeRect(p.x, p.y, p.w, p.h);
}

// Drip painting: layers of thrown, looping lines and spatter.
function drips(g, w, h, rnd) {
  g.fillStyle = '#e6dcc4';
  g.fillRect(0, 0, w, h);
  g.lineCap = g.lineJoin = 'round';
  const layers = [[INK, 22, 1], ['#f8f4ea', 20, 0.9], ['#c8952c', 14, 0.85], ['#3d6f73', 12, 0.85], [INK, 16, 1], ['#f8f4ea', 10, 0.9]];
  for (const [colour, count, alpha] of layers) {
    g.strokeStyle = g.fillStyle = colour;
    g.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      let x = rnd() * w, y = rnd() * h, dir = rnd() * Math.PI * 2;
      let width = 1 + rnd() * rnd() * w * 0.012;
      for (let step = 0; step < 26; step++) {
        dir += (rnd() - 0.5) * 1.5;
        const len = w * (0.02 + rnd() * 0.06);
        const nx = x + Math.cos(dir) * len, ny = y + Math.sin(dir) * len;
        g.lineWidth = width = Math.max(0.8, width + (rnd() - 0.5) * 2);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + (rnd() - 0.5) * len, y + (rnd() - 0.5) * len, nx, ny);
        g.stroke();
        if (rnd() < 0.3) { // spatter beside the line
          g.beginPath();
          g.arc(nx + (rnd() - 0.5) * len * 2, ny + (rnd() - 0.5) * len * 2, 0.6 + rnd() * width * 1.3, 0, Math.PI * 2);
          g.fill();
        }
        x = nx; y = ny;
      }
    }
  }
  g.globalAlpha = 1;
}

// Op art: black and white bands that ripple down the sheet.
function waves(g, w, h) {
  g.fillStyle = CREAM;
  g.fillRect(0, 0, w, h);
  g.fillStyle = INK;
  const bands = 30, bw = w / bands, amp = bw * 1.6;
  const edge = (i, y) => i * bw + amp * Math.sin((y / h) * Math.PI * 3 + i * 0.42) * Math.sin((y / h) * Math.PI);
  for (let i = -2; i < bands + 2; i += 2) {
    g.beginPath();
    for (let y = 0; y <= h; y += 4) g.lineTo(edge(i, y), y);
    for (let y = h; y >= 0; y -= 4) g.lineTo(edge(i + 1, y), y);
    g.fill();
  }
}

// Op art: a chequerboard that swells into a sphere in the middle.
function bulge(g, w, h) {
  g.fillStyle = CREAM;
  g.fillRect(0, 0, w, h);
  const n = 18, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46;
  const warp = (x, y) => {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) / R;
    if (r >= 1) return [x, y];
    const k = r > 1e-6 ? Math.pow(r, 0.6) / r : 0; // push the middle outward, meeting the flat board at the rim
    return [cx + dx * k, cy + dy * k];
  };
  const cw = w / n, ch = h / n, sub = 4;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if ((i + j) % 2) continue;
    const near = Math.hypot((i + 0.5) * cw - cx, (j + 0.5) * ch - cy) / R;
    g.fillStyle = near < 0.55 ? '#c9502f' : near < 1 ? '#3b3f7a' : INK;
    g.beginPath();
    // Walk the cell's outline in short steps so the warped edges stay curved.
    const pts = [];
    for (let s = 0; s < sub; s++) pts.push([i + s / sub, j]);
    for (let s = 0; s < sub; s++) pts.push([i + 1, j + s / sub]);
    for (let s = 0; s < sub; s++) pts.push([i + 1 - s / sub, j + 1]);
    for (let s = 0; s < sub; s++) pts.push([i, j + 1 - s / sub]);
    for (const [u, v] of pts) g.lineTo(...warp(u * cw, v * ch));
    g.fill();
  }
}

// Nested squares, each sitting a little low in the one around it.
function squares(g, w, h) {
  const colours = ['#d9a441', '#e4bd62', '#c9762f', '#9f4527'];
  colours.forEach((colour, i) => {
    const inset = i * w * 0.115;
    g.fillStyle = colour;
    g.fillRect(inset, inset * 1.45, w - inset * 2, h - inset * 2);
  });
}

// ---- Charts ----

function chartSheet(g, w, h, title) {
  g.fillStyle = '#fbf8f1';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(160,178,178,0.45)';
  g.lineWidth = 1;
  for (let y = h * 0.3; y < h * 0.86; y += h * 0.11) { g.beginPath(); g.moveTo(w * 0.1, y); g.lineTo(w * 0.94, y); g.stroke(); }
  g.fillStyle = INK;
  g.font = `600 ${Math.round(h * 0.13)}px Caveat, cursive`;
  g.textBaseline = 'middle';
  g.fillText(title, w * 0.08, h * 0.12);
  // Axes.
  g.strokeStyle = INK;
  g.lineWidth = Math.max(2, w * 0.006);
  g.beginPath();
  g.moveTo(w * 0.1, h * 0.24); g.lineTo(w * 0.1, h * 0.88); g.lineTo(w * 0.94, h * 0.88);
  g.stroke();
}

function barChart(g, w, h, rnd) {
  chartSheet(g, w, h, 'coffee per day');
  const n = 7, slot = (w * 0.8) / n;
  for (let i = 0; i < n; i++) {
    const v = 0.25 + (i / n) * 0.5 + rnd() * 0.2;
    g.fillStyle = i === n - 1 ? '#d4765f' : '#7d93ab';
    g.fillRect(w * 0.13 + i * slot, h * 0.88 - v * h * 0.6, slot * 0.62, v * h * 0.6);
  }
}

function lineChart(g, w, h, rnd) {
  chartSheet(g, w, h, 'focus vs meetings');
  g.lineJoin = g.lineCap = 'round';
  const series = [['#5a5e9e', 0.25, 0.6], ['#d4765f', 0.75, -0.5]]; // colour, start, trend
  for (const [colour, start, trend] of series) {
    g.strokeStyle = g.fillStyle = colour;
    g.lineWidth = Math.max(3, w * 0.012);
    g.beginPath();
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const v = start + trend * (i / 7) + (rnd() - 0.5) * 0.14;
      pts.push([w * 0.14 + (i / 7) * w * 0.76, h * 0.86 - Math.min(0.95, Math.max(0.05, v)) * h * 0.58]);
    }
    for (const p of pts) g.lineTo(...p);
    g.stroke();
    for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, w * 0.013, 0, Math.PI * 2); g.fill(); }
  }
}

function pieChart(g, w, h) {
  g.fillStyle = '#fbf8f1';
  g.fillRect(0, 0, w, h);
  g.fillStyle = INK;
  g.font = `600 ${Math.round(h * 0.11)}px Caveat, cursive`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('where the day goes', w / 2, h * 0.1);
  const slices = [[0.38, '#7ba38c'], [0.27, '#d4765f'], [0.2, '#d7ba78'], [0.15, '#5a5e9e']];
  const cx = w / 2, cy = h * 0.56, r = Math.min(w, h) * 0.34;
  let a = -Math.PI / 2;
  g.strokeStyle = '#fbf8f1';
  g.lineWidth = w * 0.012;
  for (const [share, colour] of slices) {
    g.fillStyle = colour;
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, r, a, a + share * Math.PI * 2);
    g.closePath();
    g.fill();
    g.stroke();
    a += share * Math.PI * 2;
  }
  g.fillStyle = '#fbf8f1';
  g.beginPath();
  g.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
  g.fill();
}

// ---- Hanging ----

// One framed picture, w x h metres, with its bottom edge at the group's origin.
function framed(paint, w, h, seed, frameColour) {
  const g = new THREE.Group();
  g.name = 'wall-art';
  const tex = canvasTexture(Math.round(w * PX_PER_M), Math.round(h * PX_PER_M), (c, cw, ch) => paint(c, cw, ch, seeded(seed)));
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const rim = 0.035;
  box(g, [w + rim * 2, h + rim * 2, 0.03], [0, -rim, 0], paper(frameColour));
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h), paper(C.white, { map: tex }));
  sheet.position.set(0, h / 2, 0.017);
  sheet.receiveShadow = true;
  g.add(sheet);
  return g;
}

// Where each picture hangs: the wall, the room coordinate along it (x on the
// door wall, z on the pinboard wall), the height of its bottom edge, its
// size and what is painted on it.
const HANGING = [
  // Door wall, left to right as seen from inside the room.
  { wall: 'front', at: 4.75, y: 1.2, w: 0.8, h: 0.8, paint: squares, seed: 5, frame: C.white },
  { wall: 'front', at: 3.15, y: 1.1, w: 1.0, h: 1.0, paint: bulge, seed: 4, frame: C.ink },
  { wall: 'front', at: 1.55, y: 0.95, w: 0.9, h: 1.25, paint: waves, seed: 3, frame: C.ink },
  { wall: 'front', at: -0.1, y: 1.1, w: 1.0, h: 1.0, paint: grid, seed: 12, frame: C.ink },
  { wall: 'front', at: -4.25, y: 1.05, w: 1.7, h: 1.05, paint: drips, seed: 7, frame: C.white },
  // Pinboard wall: the charts, either side of the whiteboard.
  { wall: 'left', at: -3.15, y: 1.25, w: 0.95, h: 0.7, paint: barChart, seed: 21, frame: C.white },
  { wall: 'left', at: 0.05, y: 1.3, w: 0.95, h: 0.7, paint: lineChart, seed: 22, frame: C.white },
  { wall: 'left', at: 2.55, y: 1.2, w: 0.8, h: 0.8, paint: pieChart, seed: 23, frame: C.white },
];

// `walls` are room.js wall objects by name. Each wall's own x axis runs the
// opposite way to the room coordinate along it.
export function hangWallArt(walls, thickness) {
  for (const p of HANGING) {
    const picture = framed(p.paint, p.w, p.h, p.seed, p.frame);
    picture.position.set(-p.at, p.y, thickness / 2 + 0.018);
    walls[p.wall].full.add(picture);
  }
  return HANGING.length;
}
