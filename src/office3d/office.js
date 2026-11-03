// ---- Offquarium office in 3D ----
// The paper-diorama office with the cardboard cast wandering between
// furniture. Lighting follows the real clock through DAY_PHASES (js/data.js),
// or a phase picked in the toolbar.
//
// URL params: ?hour=N (clock override, as in the 2D app), ?phase=night,
// ?cam=x,y,z,tx,ty,tz, ?seed=N (deterministic wander for screenshots).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { createStandee, STANDEE_TYPES } from '../characters3d/standee.js';
import { buildRoom, updateWalls, ROOM } from './room.js';
import { BUILDERS } from './furniture.js';
import { NavGrid } from './nav.js';
import { buildExterior } from './exterior.js';
import { initMargoChat } from './margo-chat.js';

const params = new URLSearchParams(location.search);

// Deterministic randomness when ?seed is given (screenshots, tests).
if (params.has('seed')) {
  let s = Number(params.get('seed')) || 1;
  Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// Wait for the handwriting font before drawing the zone-mat labels.
async function loadFonts() {
  try {
    const caveat = new FontFace('Caveat', 'url(assets/fonts/Caveat-Variable.woff2)', { weight: '400 700' });
    document.fonts.add(await caveat.load());
  } catch { /* labels fall back to cursive */ }
}

// ---- Layout ----
// Designed for the 3D room rather than copied from the 2D screen: tall
// pieces stand against walls, low pieces sit forward, and the middle of the
// room stays open as the walkway. The 12 m x 8 m room's back wall is at
// z = -4 (top of the 2D screen); rotation is about Y, 0 faces the camera.
const LAYOUT = [
  // Focus corner (back left): desk under the window, printer and cabinet beside it.
  ['desk_cluster', -3.9, -3.05, 0],
  ['office_chair', -5.2, -2.1, Math.PI - 0.5],
  ['filing_cabinet', -2.3, -3.6, 0],
  ['printer', -1.65, -3.55, 0],
  ['plant_snake', -5.55, -3.55, 0],
  // Coffee nook (back right): counter on the right wall, cafe table in front.
  ['coffee_station', 5.6, -2.55, -Math.PI / 2],
  ['table_cafe', 3.85, -2.25, 0],
  ['plant_snake', 1.0, -3.6, 1.2],
  // Thinking wall (front left): whiteboard on the left wall, standing table.
  ['whiteboard', -5.15, 1.15, Math.PI / 2 - 0.55], // angled to face the room
  ['table_cafe', -3.75, 1.45, 0],
  ['boxes_stack', -5.35, 3.4, 0.25],
  ['plant_snake', -1.0, 3.55, 0.8],
  // Soft landing (front right): sofa facing the room, armchair angled in, arc lamp.
  ['couch_2seater', 3.45, 1.25, 0],
  ['armchair', 5.25, 2.35, -1.0],
  ['lamp_arc_big', 2.05, 0.95, 0],
  ['plant_snake', 5.55, 3.55, 2.1],
];

// ---- Scene ----
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true }); // stencil: window portals
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4efe5);
scene.fog = new THREE.Fog(0xf4efe5, 26, 48);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
const VIEW_DIR = new THREE.Vector3(0, 0.62, 0.785).normalize();
const overview = { target: new THREE.Vector3(0, 0.5, -0.35), dist: 16 };
camera.position.copy(overview.target).addScaledVector(VIEW_DIR, overview.dist);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(overview.target);
controls.enableDamping = true;
controls.minDistance = 2;
controls.maxDistance = 34;
controls.maxPolarAngle = 1.5; // nearly level: eye-height views out of the windows, never below the floor
controls.autoRotateSpeed = 0.8;
if (params.has('cam')) {
  const [x, y, z, tx, ty, tz] = params.get('cam').split(',').map(Number);
  camera.position.set(x, y, z);
  controls.target.set(tx, ty, tz);
}

const hemi = new THREE.HemisphereLight(0xffffff, 0xd9d0c2, 1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff8ee, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

await loadFonts();
const room = buildRoom();
scene.add(room.group);
const outside = buildExterior(ROOM);
scene.add(outside.group);

// ---- Furniture ----
const nav = new NavGrid({ x0: -ROOM.W / 2, z0: -ROOM.D / 2, x1: ROOM.W / 2, z1: ROOM.D / 2, cell: 0.2 });
const CHAR_RADIUS = 0.24;
// Keep characters off the walls.
nav.blockRect(-ROOM.W / 2, -ROOM.D / 2, ROOM.W / 2, -ROOM.D / 2 + 0.05, CHAR_RADIUS);
nav.blockRect(-ROOM.W / 2, ROOM.D / 2 - 0.05, ROOM.W / 2, ROOM.D / 2, CHAR_RADIUS);
nav.blockRect(-ROOM.W / 2, -ROOM.D / 2, -ROOM.W / 2 + 0.05, ROOM.D / 2, CHAR_RADIUS);
nav.blockRect(ROOM.W / 2 - 0.05, -ROOM.D / 2, ROOM.W / 2, ROOM.D / 2, CHAR_RADIUS);

const glow = [];
const lamps = [];
const spots = [];
for (const [type, x, z, rot] of LAYOUT) {
  const p = BUILDERS[type]();
  p.object.position.set(x, 0, z);
  p.object.rotation.y = rot;
  scene.add(p.object);
  glow.push(...p.glow);
  if (p.light) lamps.push(p);

  // Footprint corners to world space, then block their bounding box.
  const [fx0, fz0, fx1, fz1] = p.footprint;
  const corners = [[fx0, fz0], [fx1, fz0], [fx1, fz1], [fx0, fz1]].map(([lx, lz]) => [
    x + lx * Math.cos(rot) + lz * Math.sin(rot),
    z - lx * Math.sin(rot) + lz * Math.cos(rot),
  ]);
  const xs = corners.map(c => c[0]), zs = corners.map(c => c[1]);
  nav.blockRect(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), CHAR_RADIUS);

  for (const s of p.spots) {
    spots.push({
      x: x + s.x * Math.cos(rot) + s.z * Math.sin(rot),
      z: z - s.x * Math.sin(rot) + s.z * Math.cos(rot),
      heading: s.heading + rot,
      type,
    });
  }
}
// Window-gazing spots and the doorway.
spots.push({ x: 0, z: -3.3, heading: Math.PI, type: 'window' });
spots.push({ x: 5.2, z: 0.4, heading: -Math.PI / 2, type: 'window' });
spots.push({ x: -2.0, z: 3.3, heading: 0, type: 'door' });
const usableSpots = spots.filter(s => nav.freeAt(s.x, s.z));

// ---- Cast ----
const ACCENTS = { andy: '--coral', jazz: '--sage', olex: '--violet', ghost: '--blue', margo: '--green' };
const NAMES = { andy: 'Andy', jazz: 'Jazz', olex: 'Olex', ghost: 'Ghost', margo: 'Margo' };
const WALK_SPEED = 1.05, TURN_RATE = 4;
const START = [[-1.2, 0.2], [0.2, -0.6], [1.0, 0.8], [-0.4, 1.6], [2.4, 0.2]];

const cast = STANDEE_TYPES.map((type, i) => {
  const standee = createStandee(type);
  scene.add(standee.root);
  // Speech bubble, styled like the 2D app's: the speaker's name, then the line.
  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  bubble.hidden = true;
  bubble.style.setProperty('--c', `var(${ACCENTS[type]})`);
  const name = document.createElement('div');
  name.className = 'bubble-name';
  name.textContent = NAMES[type];
  const text = document.createElement('div');
  bubble.append(name, text);
  document.body.appendChild(bubble);
  const [x, z] = START[i];
  return {
    standee, type, bubble, bubbleText: text, sayUntil: 0,
    pos: new THREE.Vector2(x, z), heading: Math.random() * Math.PI * 2, speed: 0,
    path: [], spot: null, wait: 1 + Math.random() * 3, blocked: 0,
    chat: null, chatReady: 4 + Math.random() * 6, nextRemark: 8 + Math.random() * 10,
    headY: type === 'ghost' ? 0.98 : 1.74,
  };
});

const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function chooseDestination(c) {
  const taken = new Set(cast.filter(o => o !== c && o.spot).map(o => o.spot));
  const options = usableSpots.filter(s => !taken.has(s) && Math.hypot(s.x - c.pos.x, s.z - c.pos.y) > 1.2);
  let dest;
  const armchair = c.type === 'margo' && options.find(s => s.type === 'armchair');
  if (armchair && Math.random() < 0.35) {
    dest = armchair; // episode 212 isn't going to watch itself
    c.spot = dest;
  } else if (options.length && Math.random() < 0.75) {
    dest = options[Math.floor(Math.random() * options.length)];
    c.spot = dest;
  } else {
    const [x, z] = nav.randomFree();
    dest = { x, z, heading: null };
    c.spot = null;
  }
  c.dest = dest;
  c.path = nav.path(c.pos.x, c.pos.y, dest.x, dest.z) || [];
  c.blocked = 0;
}

function tick(c, dt) {
  let wantSpeed = 0, wantHeading = c.heading;
  if (c.talkingToVisitor) {
    c.path = [];
    c.wait = Math.max(c.wait, 2);
    wantHeading = Math.atan2(camera.position.x - c.pos.x, camera.position.z - c.pos.y);
  } else if (c.path.length) {
    const [wx, wz] = c.path[0];
    const dx = wx - c.pos.x, dz = wz - c.pos.y, d = Math.hypot(dx, dz);
    if (d < 0.12) {
      c.path.shift();
      if (!c.path.length) { c.wait = (c.type === 'ghost' ? 2 : 3) + Math.random() * 5; arrived(c); }
    } else {
      wantHeading = Math.atan2(dx, dz);
      wantSpeed = c.path.length === 1 ? Math.min(1, d / 0.6 + 0.25) : 1;
    }
    // Give way to anyone close in front.
    const ahead = cast.some(o => {
      if (o === c) return false;
      const ox = o.pos.x - c.pos.x, oz = o.pos.y - c.pos.y, od = Math.hypot(ox, oz);
      return od < 0.75 && (ox * Math.sin(c.heading) + oz * Math.cos(c.heading)) / od > 0.45;
    });
    if (ahead) {
      wantSpeed = 0;
      c.blocked += dt;
      if (c.blocked > 1.6 + Math.random()) chooseDestination(c);
    } else c.blocked = 0;
  } else {
    if (c.dest?.heading != null) wantHeading = c.dest.heading;
    c.wait -= dt;
    if (c.wait <= 0) chooseDestination(c);
  }
  c.heading += THREE.MathUtils.clamp(angleDelta(c.heading, wantHeading), -TURN_RATE * dt, TURN_RATE * dt);
  const align = Math.max(0, Math.cos(angleDelta(c.heading, wantHeading)));
  c.speed += (wantSpeed * align - c.speed) * Math.min(1, dt * 6);
  c.pos.x += Math.sin(c.heading) * WALK_SPEED * c.speed * dt;
  c.pos.y += Math.cos(c.heading) * WALK_SPEED * c.speed * dt;
}

// ---- Speech ----
// Reuses the 2D app's dialogue from js/data.js: chats between characters
// who meet (DIALOGUE_BANKS), a line on arriving somewhere (ACTIVITY_LINES,
// COFFEE_DIALOGUE), and the odd remark while standing around. How chatty
// everyone is follows the time of day (DAY_PHASES[].chat).

const SPOT_LINES = {
  desk_cluster: ACTIVITY_LINES.desk_cluster,
  coffee_station: ACTIVITY_LINES.coffee_station,
  table_cafe: COFFEE_DIALOGUE,
  printer: ACTIVITY_LINES.printer,
  whiteboard: ACTIVITY_LINES.whiteboard,
  couch_2seater: ACTIVITY_LINES.couch_2seater,
  armchair: ACTIVITY_LINES.couch_2seater,
};
const CHAT_RANGE = 2.2;      // metres between two idle characters to start chatting
const CHAT_GAP_S = 0.45;     // pause between turns
const recentLines = new Map();

// Pick a line the character has not said recently.
function pickLine(type, bank) {
  const lines = bank?.[type];
  if (!lines?.length) return null;
  const used = recentLines.get(type) ?? new Set();
  recentLines.set(type, used);
  let pool = lines.filter(l => !used.has(l));
  if (!pool.length) { used.clear(); pool = lines; }
  const line = pool[Math.floor(Math.random() * pool.length)];
  used.add(line);
  if (used.size > Math.min(12, lines.length - 1)) used.delete(used.values().next().value);
  return line;
}

// Same reading-time rule as the 2D app's bubbleDuration().
const readSeconds = text => Math.min(8, Math.max(3.5, 1.8 + text.length * 0.045));

function say(c, text) {
  if (!text) return 0;
  c.bubbleText.textContent = text;
  c.bubble.hidden = false;
  c.bubble.style.animation = 'none';
  void c.bubble.offsetWidth; // restart the pop-in animation
  c.bubble.style.animation = '';
  const s = readSeconds(text);
  c.sayUntil = time + s;
  return s;
}

const chatMultiplier = () => DAY_PHASES.find(p => p.key === currentPhase())?.chat ?? 1;
// Margo is a construct: the evening/night quiet doesn't apply to her.
const chatMultiplierFor = c => (c.type === 'margo' ? Math.max(1, chatMultiplier()) : chatMultiplier());

function arrived(c) {
  if (c.type === 'margo' && c.spot?.type === 'armchair') {
    c.wait = 20 + Math.random() * 20; // a whole scene of Orbital Tidewater
    say(c, pickLine('margo', ACTIVITY_LINES.armchair));
    return;
  }
  const bank = c.spot && SPOT_LINES[c.spot.type];
  if (bank && Math.random() < 0.6) say(c, pickLine(c.type, bank));
}

const idle = c => !c.path.length && !c.chat && !c.talkingToVisitor;

function startChat(a, b) {
  const turns = 2 + Math.floor(Math.random() * 3);
  const order = [];
  for (let i = 0; i < turns; i++) order.push(i % 2 ? b : a);
  const chat = { a, b, order, next: time + 0.3 };
  for (const [c, other] of [[a, b], [b, a]]) {
    c.chat = chat;
    c.path = [];
    c.dest = { x: c.pos.x, z: c.pos.y, heading: Math.atan2(other.pos.x - c.pos.x, other.pos.y - c.pos.y) };
  }
}

function updateSpeech(dt) {
  const mult = chatMultiplier();
  for (const c of cast) {
    if (!c.bubble.hidden && time > c.sayUntil) c.bubble.hidden = true;
    if (c.chat) c.wait = Math.max(c.wait, 1); // stay put while talking
  }
  // Run conversations turn by turn.
  for (const chat of new Set(cast.map(c => c.chat).filter(Boolean))) {
    if (time < chat.next) continue;
    const speaker = chat.order.shift();
    if (speaker) {
      chat.next = time + say(speaker, pickLine(speaker.type, DIALOGUE_BANKS)) + CHAT_GAP_S;
    } else {
      for (const c of [chat.a, chat.b]) {
        c.chat = null;
        // Margo waits longer before starting another chat.
        c.chatReady = time + (16 + Math.random() * 12) / mult * (c.type === 'margo' ? 1.5 : 1);
        c.wait = 0.8 + Math.random() * 2.5; // drift apart soon after
      }
    }
  }
  // Two idle characters close together may strike up a chat.
  for (let i = 0; i < cast.length; i++) for (let j = i + 1; j < cast.length; j++) {
    const a = cast[i], b = cast[j];
    if (!idle(a) || !idle(b) || time < a.chatReady || time < b.chatReady) continue;
    if (a.pos.distanceTo(b.pos) > CHAT_RANGE) continue;
    if (Math.random() < dt * 0.6 * mult) startChat(a, b);
  }
  // The odd remark while standing around alone.
  for (const c of cast) {
    if (!idle(c) || time < c.nextRemark || time < c.sayUntil) continue;
    c.nextRemark = time + (14 + Math.random() * 14) / chatMultiplierFor(c);
    if (Math.random() < 0.45) say(c, pickLine(c.type, DIALOGUE_BANKS));
  }
}

// Keep each bubble over its speaker's head, inside the window.
function placeBubbles() {
  const w = window.innerWidth, h = window.innerHeight;
  for (const c of cast) {
    if (c.bubble.hidden) continue;
    proj.set(c.pos.x, c.headY, c.pos.y).project(camera);
    if (proj.z > 1) { c.bubble.style.visibility = 'hidden'; continue; }
    c.bubble.style.visibility = '';
    const x = (proj.x + 1) / 2 * w, y = (1 - proj.y) / 2 * h;
    const bw = c.bubble.offsetWidth, bh = c.bubble.offsetHeight;
    const left = THREE.MathUtils.clamp(x - bw / 2, 8, w - bw - 8);
    c.bubble.style.left = `${left}px`;
    c.bubble.style.top = `${Math.max(8, y - bh - 12)}px`;
    c.bubble.style.setProperty('--pointer-x', `${THREE.MathUtils.clamp(x - left, 14, bw - 14)}px`);
  }
}

// ---- Time of day ----
// Visual settings per DAY_PHASES key. The 2D app tints a CSS overlay; here
// the same phases drive the sun, the sky in the windows, the arc lamp and
// a gentle tint on the cardboard cast.
const LOOK = {
  morning:   { sky: 0xd3e4ec, sun: 0xffd9a6, sunI: 2.0, sunPos: [9, 5, -1], hemiSky: 0xfff4e6, hemiGround: 0xd8ccb8, hemiI: 1.55, bg: 0xf2ece1, tint: 0xfff6ec, lamp: 0, screens: 0.15 },
  midday:    { sky: 0xbfd9ee, sun: 0xfff8ec, sunI: 2.3, sunPos: [2, 10, 4], hemiSky: 0xffffff, hemiGround: 0xd9d0c2, hemiI: 1.7, bg: 0xf4efe5, tint: 0xffffff, lamp: 0, screens: 0.1 },
  afternoon: { sky: 0xc6dbe0, sun: 0xffe6c2, sunI: 2.1, sunPos: [-7, 6, 4], hemiSky: 0xfff8ee, hemiGround: 0xd6ccb8, hemiI: 1.55, bg: 0xf1ebe0, tint: 0xfdf7ee, lamp: 0, screens: 0.15 },
  evening:   { sky: 0xe7a47c, sun: 0xff9f66, sunI: 1.25, sunPos: [-10, 3.5, 2], hemiSky: 0xf4d7c0, hemiGround: 0x9a8a7a, hemiI: 1.0, bg: 0xe6d9c9, tint: 0xf3dcc8, lamp: 0.75, screens: 0.55 },
  night:     { sky: 0x22314b, sun: 0x8ea5d6, sunI: 0.42, sunPos: [-4, 9, 6], hemiSky: 0x7d8bb3, hemiGround: 0x3a3a48, hemiI: 0.6, bg: 0x1d2130, tint: 0xa3adc9, lamp: 1, screens: 1 },
};

function phaseForHour(hour) {
  for (const p of DAY_PHASES) {
    const inside = p.from < p.to ? hour >= p.from && hour < p.to : hour >= p.from || hour < p.to;
    if (inside) return p.key;
  }
  return 'midday';
}
const hourOverride = params.has('hour') ? Number(params.get('hour')) : null;
let phaseChoice = params.get('phase') || 'live';
const currentPhase = () => phaseChoice !== 'live' ? phaseChoice : phaseForHour(hourOverride ?? new Date().getHours());

const look = {}; // live, lerped values
const col = hex => new THREE.Color(hex);
function applyLook(key, k) {
  const t = LOOK[key];
  for (const name of ['sky', 'sun', 'hemiSky', 'hemiGround', 'bg', 'tint']) {
    look[name] ??= col(t[name]);
    look[name].lerp(col(t[name]), k);
  }
  for (const name of ['sunI', 'hemiI', 'lamp', 'screens']) {
    look[name] = look[name] === undefined ? t[name] : look[name] + (t[name] - look[name]) * k;
  }
  look.sunPos ??= new THREE.Vector3(...t.sunPos);
  look.sunPos.lerp(new THREE.Vector3(...t.sunPos), k);

  sun.color.copy(look.sun);
  sun.intensity = look.sunI;
  sun.position.copy(look.sunPos);
  hemi.color.copy(look.hemiSky);
  hemi.groundColor.copy(look.hemiGround);
  hemi.intensity = look.hemiI;
  room.skyMat.color.copy(look.sky);
  outside.update(Math.max(0, (look.screens - 0.15) / 0.85), look.sky);
  scene.background.copy(look.bg);
  scene.fog.color.copy(look.bg);
  document.body.style.background = `#${look.bg.getHexString()}`;
  document.body.classList.toggle('is-dark', look.bg.getHSL({}).l < 0.4);
  for (const c of cast) c.standee.setTint(look.tint);
  for (const l of lamps) {
    l.light.intensity = look.lamp * 4;
    l.glow[0].material.color.setRGB(0.96, 0.92 - 0.05 * look.lamp, 0.82 - 0.35 * look.lamp);
  }
  const screenGlow = col(0x9fc3e0).multiplyScalar(look.screens * 0.8);
  for (const m of glow) if (m.material.emissive) m.material.emissive.copy(screenGlow);
}
applyLook(currentPhase(), 1);

// ---- UI ----
let focus = '';
function press(sel, on) { document.querySelectorAll(sel).forEach(b => b.setAttribute('aria-pressed', String(on(b)))); }
function setPhase(p) { phaseChoice = p; press('[data-phase]', b => b.dataset.phase === p); }
function setFocus(t) { focus = t; press('[data-focus]', b => b.dataset.focus === t); }
document.querySelectorAll('[data-phase]').forEach(b => b.addEventListener('click', () => setPhase(b.dataset.phase)));
document.querySelectorAll('[data-focus]').forEach(b => b.addEventListener('click', () => setFocus(b.dataset.focus)));
const spinBtn = document.querySelector('[data-spin]');
// Optional: pages may leave out the follow/turntable menu.
spinBtn?.addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; spinBtn.setAttribute('aria-pressed', String(controls.autoRotate)); });
setPhase(phaseChoice);

const tmp = new THREE.Vector3();
let focusBlend = 0;
function updateCamera(dt) {
  focusBlend += ((focus ? 1 : 0) - focusBlend) * Math.min(1, dt * 3);
  const c = cast.find(x => x.type === focus);
  const goal = c ? tmp.set(c.pos.x, c.type === 'ghost' ? 0.5 : 0.95, c.pos.y) : overview.target;
  if (params.has('cam') && !c) return;
  controls.target.lerp(goal, Math.min(1, dt * 3));
  if (c || focusBlend > 0.01) {
    const want = THREE.MathUtils.lerp(overview.dist, 4.2, focusBlend);
    const off = camera.position.clone().sub(controls.target);
    off.setLength(off.length() + (want - off.length()) * Math.min(1, dt * 3));
    camera.position.copy(controls.target).add(off);
  }
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.9 ? 44 : 32;
  camera.updateProjectionMatrix();
  // Fit the room's width (plus the base) in view.
  const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  overview.dist = Math.max(15.5, 7.4 / halfW);
  if (!focus && !params.has('cam')) {
    const off = camera.position.clone().sub(controls.target).setLength(overview.dist);
    camera.position.copy(controls.target).add(off);
  }
}
window.addEventListener('resize', resize);
resize();

// ---- Loop ----
const clock = new THREE.Clock();
const proj = new THREE.Vector3();
let time = 0;

function frame(dt) {
  time += dt;
  applyLook(currentPhase(), Math.min(1, dt * 1.5));
  updateCamera(dt);
  controls.update(dt);
  updateWalls(room.walls, camera, dt);
  room.clock.update(hourOverride === null ? new Date() : new Date(2026, 0, 1, hourOverride, new Date().getMinutes(), new Date().getSeconds()));
  for (const c of cast) {
    tick(c, dt);
    c.standee.root.position.set(c.pos.x, 0, c.pos.y);
    c.standee.heading = c.heading;
    c.standee.update(time, dt, c.speed, camera);
  }
  updateSpeech(dt);
  renderer.render(scene, camera);
  placeBubbles();
}
renderer.setAnimationLoop(() => frame(Math.min(clock.getDelta(), 1 / 20)));

// ---- Talk to Margo ----
// The chat endpoint comes from <meta name="margo-endpoint"> in the page
// (see worker/margo/README.md); empty means the chat runs offline.
const margo = cast.find(c => c.type === 'margo');
const BUBBLE_MAX_CHARS = 160;
const margoChat = margo && document.getElementById('margoChat') && initMargoChat({
  endpoint: document.querySelector('meta[name="margo-endpoint"]')?.content.trim() || '',
  offlineLines: MARGO_LINES.offline,
  onOpenChange(open) {
    margo.talkingToVisitor = open;
    if (open && margo.chat) { margo.chat.order.length = 0; } // finish any office chat first
  },
  onReply(reply) {
    say(margo, reply.length > BUBBLE_MAX_CHARS ? `${reply.slice(0, BUBBLE_MAX_CHARS - 1)}…` : reply);
  },
});

// Clicking Margo herself also opens the chat (a click, not the end of a drag).
if (margoChat) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt = null;
  canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObject(margo.standee.root, true).length) margoChat.open();
  });
}
document.getElementById('loading')?.remove();

// Debug / test hook.
window.__office = {
  scene, camera, cast, nav, spots: usableSpots, setPhase, setFocus, say, margoChat,
  step(seconds, fps = 30) { for (let i = 0; i < seconds * fps; i++) frame(1 / fps); },
  ready: true,
};
