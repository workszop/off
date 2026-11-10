// ---- Offquarium office in 3D ----
// The page: scene, furniture layout, camera, toolbar, clicks and the frame
// loop. What the cast does lives in sim.js and events.js, the time-of-day
// look in lighting.js, speech bubbles in bubbles.js, event props in props.js,
// sound in sound.js and the diary in daylog.js. Lighting follows the real clock through
// DAY_PHASES (data.js), or a phase picked in the toolbar.
//
// Two views of the same room: 'inside' (the default) stands the camera in
// the room, between its walls and under its ceiling; 'outside' is the
// dollhouse overview. Drag, tilt and zoom work the same way in both.
//
// URL params: ?hour=N (clock override), ?phase=night, ?view=outside,
// ?cam=x,y,z,tx,ty,tz, ?seed=N (deterministic wander for screenshots).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { createStandee, STANDEE_TYPES } from '../characters3d/standee.js';
import { buildRoom, updateWalls, doorLeaf, ROOM } from './room.js';
import { BUILDERS } from './furniture.js';
import { NavGrid } from './nav.js';
import { buildExterior } from './exterior.js';
import { initMargoChat } from './margo-chat.js';
import { MARGO_LINES, NAMES, phaseForHour } from './data.js';
import { createSim } from './sim.js';
import { createLighting } from './lighting.js';
import { createBubbles } from './bubbles.js';
import { createProps } from './props.js';
import { createSound } from './sound.js';
import { createDayLog } from './daylog.js';
import { insideBounds, insideDistance, insetPoint } from './view.js';

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
// Designed for a 3D room: tall
// pieces stand against walls, low pieces sit forward, and the middle of the
// room stays open as the walkway. The 12 m x 8 m room's back wall is at
// z = -4; rotation is about Y, 0 faces the camera.
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
const VIEW_DIR = new THREE.Vector3(0, 0.5, 0.866).normalize(); // 30° above the floor
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
// The door stands open into the room: nobody walks through the leaf. It
// crosses the floor at an angle, so it is blocked as a row of small squares,
// with a little less clearance than furniture gets, which keeps the doorway
// beside it wide enough to use.
{
  const [hinge, tip] = doorLeaf();
  for (let t = 0; t <= 1; t += 0.125) {
    const x = hinge.x + (tip.x - hinge.x) * t, z = hinge.z + (tip.z - hinge.z) * t;
    nav.blockRect(x, z, x, z, 0.2);
  }
}

const glow = [];
const lamps = [];
const spots = [];
const pieces = {};   // the first piece of each type: { piece, x, z }
for (const [type, x, z, rot] of LAYOUT) {
  const p = BUILDERS[type]();
  pieces[type] ??= { piece: p, x, z };
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
// The doorway: the free half of the opening, beside the open leaf.
spots.push({ x: -2.3, z: 3.3, heading: 0, type: 'door' });

// ---- Time of day ----
const hourOverride = params.has('hour') ? Number(params.get('hour')) : null;
let phaseChoice = params.get('phase') || 'live';
const currentPhase = () => phaseChoice !== 'live' ? phaseChoice : phaseForHour(hourOverride ?? new Date().getHours());

// ---- Cast ----
// The simulation owns each character's state; the page adds their standee
// and speech bubble to the same object.
const ACCENTS = { andy: '--coral', jazz: '--sage', olex: '--violet', ghost: '--blue', margo: '--indigo' };

// Things office events happen around. The lamp's shade hangs 1 m to the side
// of its base.
const at = type => pieces[type] && { x: pieces[type].x, z: pieces[type].z };
const landmarks = {
  printer: at('printer'),
  whiteboard: at('whiteboard'),
  lamp: pieces.lamp_arc_big && { x: pieces.lamp_arc_big.x + 1, z: pieces.lamp_arc_big.z },
};
const sim = createSim({ nav, spots, types: STANDEE_TYPES, phase: currentPhase, landmarks });
const cast = sim.cast;
for (const c of cast) {
  c.standee = createStandee(c.type, { autoLoad: false });
  scene.add(c.standee.root);
}
const ghost = cast.find(c => c.type === 'ghost');
const margo = cast.find(c => c.type === 'margo');
const bubbles = createBubbles(cast, {
  names: NAMES, accents: ACCENTS,
  headY: c => (c.type === 'ghost' ? 0.98 : 1.74),
});

// Character art arrives in stages, so the office appears quickly: everyone's
// standing drawings first, then the walk frames. The ghost is out of the room
// at the start, so its art waits until a visit is near (see frame()).
const staff = cast.filter(c => c !== ghost);
const artReady = Promise.all(staff.map(c => c.standee.loadIdle()));
artReady.then(() => { for (const c of staff) c.standee.loadWalk(); });
const GHOST_ART_LEAD_S = 20;
let ghostArtRequested = false;

const lighting = createLighting({
  scene, sun, hemi, skyMat: room.skyMat, outside, lamps, glow,
  standees: cast.map(c => c.standee),
});
lighting.update(currentPhase(), 0);

const props = createProps();
scene.add(props.group);
const sound = createSound();
const daylog = createDayLog({
  list: document.getElementById('dayLogList'),
  count: document.getElementById('logCount'),
  empty: document.getElementById('dayLogEmpty'),
});

// ---- What the simulation shows and sounds like ----
// The sim only keeps state; each frame the page compares it with the last
// frame to wobble the printer, flicker the lamp, play sounds and fill the diary.
const PITCH = { andy: 0.8, jazz: 1.25, olex: 1.0, ghost: 1.6, margo: 0.65 };
const printerPiece = pieces.printer?.piece;
const lampPiece = pieces.lamp_arc_big?.piece;
const JAM_COLOR = new THREE.Color(0xd4563f);
// The printer's display shares its material with other screens: give it its
// own, so only the printer blinks.
for (const m of printerPiece?.glow ?? []) m.material = m.material.clone();
const seen = {
  jam: false, flicker: false, donut: false, donutWins: 0, cake: false, logEntry: null,
  lines: new Map(cast.map(c => [c, c.lineSeq])),
  present: new Map(cast.map(c => [c, c.present])),
};
let lastSpeakSound = 0;

function showEvents() {
  const { state } = sim;
  const t = sim.time;
  // The jammed printer shudders and its display blinks red.
  if (printerPiece) {
    if (state.printerJammed) {
      printerPiece.object.rotation.z = Math.sin(t * 40) * 0.012;
      for (const m of printerPiece.glow) m.material.emissive.copy(JAM_COLOR).multiplyScalar(0.55 + 0.45 * Math.sin(t * 9));
    } else if (seen.jam) {
      printerPiece.object.rotation.z = 0;
      lighting.refresh();
    }
  }
  // The lamp stutters, whatever the time of day.
  if (lampPiece) {
    if (state.lampFlicker) {
      const on = Math.sin(t * 31) + Math.sin(t * 17.3) > 0.1;
      lampPiece.light.intensity = on ? 3.6 : 0.15;
      lampPiece.glow[0].material.color.setRGB(on ? 1 : 0.5, on ? 0.86 : 0.47, on ? 0.5 : 0.4);
    } else if (seen.flicker) lighting.refresh();
  }

  if (state.printerJammed !== seen.jam) sound.play(state.printerJammed ? 'jam' : 'fixed');
  if (state.lampFlicker && !seen.flicker) sound.play('flicker');
  if (state.donut && !seen.donut) sound.play('donut');
  if (state.donutWins !== seen.donutWins) sound.play('win');
  if (state.cake && !seen.cake) sound.play('cake');
  seen.jam = state.printerJammed;
  seen.flicker = state.lampFlicker;
  seen.donut = Boolean(state.donut);
  seen.donutWins = state.donutWins;
  seen.cake = Boolean(state.cake);

  for (const c of cast) {
    if (c.lineSeq !== seen.lines.get(c)) {
      seen.lines.set(c, c.lineSeq);
      if (t - lastSpeakSound > 0.25) { lastSpeakSound = t; sound.play('speak', { pitch: PITCH[c.type] }); }
    }
    if (c.present !== seen.present.get(c)) {
      seen.present.set(c, c.present);
      sound.play(c === ghost ? 'ghost' : 'door');
    }
  }
  // New diary entries, oldest first.
  const log = sim.log;
  let from = log.length;
  while (from > 0 && log[from - 1] !== seen.logEntry) from--;
  for (let i = from; i < log.length; i++) daylog.add(log[i].text);
  if (log.length) seen.logEntry = log.at(-1);
}

// ---- UI ----
let focus = '';
// Follow someone only while they are in the room.
const followed = () => cast.find(c => c.type === focus && c.present);
function press(sel, on) { document.querySelectorAll(sel).forEach(b => b.setAttribute('aria-pressed', String(on(b)))); }
function setPhase(p) { phaseChoice = p; press('[data-phase]', b => b.dataset.phase === p); }
function setFocus(t) { focus = t; press('[data-focus]', b => b.dataset.focus === t); }
document.querySelectorAll('[data-phase]').forEach(b => b.addEventListener('click', () => setPhase(b.dataset.phase)));
document.querySelectorAll('[data-focus]').forEach(b => b.addEventListener('click', () => setFocus(b.dataset.focus)));
const spinBtn = document.querySelector('[data-spin]');
spinBtn?.addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; spinBtn.setAttribute('aria-pressed', String(controls.autoRotate)); });
setPhase(phaseChoice);

// Poking the office.
function tapGlass() {
  if (!sim.tapGlass()) return;
  sound.play('tap');
  canvas.classList.remove('tapped');
  void canvas.offsetWidth; // restart the knock animation
  canvas.classList.add('tapped');
}
const ACTIONS = { tap: tapGlass, donut: () => sim.dropDonut() };
document.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () => ACTIONS[b.dataset.action]?.()));

const soundBtn = document.getElementById('soundToggle');
function setSound(on) {
  const now = sound.setEnabled(on);
  soundBtn?.setAttribute('aria-pressed', String(now));
}
soundBtn?.addEventListener('click', () => setSound(!sound.enabled));
// Sound was on last visit: browsers only allow it to start after a click.
// A click on the Sound button itself is left to the button, which turns it on.
if (sound.wasOn()) {
  window.addEventListener('pointerdown', e => { if (!sound.enabled && !soundBtn?.contains(e.target)) setSound(true); }, { once: true });
}

const logBtn = document.getElementById('logToggle');
const logPanel = document.getElementById('dayLog');
function setLogOpen(open) {
  logPanel.hidden = !open;
  logBtn.setAttribute('aria-expanded', String(open));
  if (open) { daylog.seen(); daylog.scrollToEnd(); }
}
logBtn?.addEventListener('click', () => setLogOpen(logPanel.hidden));
document.getElementById('dayLogClose')?.addEventListener('click', () => { setLogOpen(false); logBtn.focus(); });
logPanel?.addEventListener('keydown', e => { if (e.key === 'Escape') { setLogOpen(false); logBtn.focus(); } });

// ---- Camera ----
// Inside view: the orbit controls steer `idealOff`, the offset from the
// look-at point that the visitor asks for; placeInside() then stands the
// camera on that line, inside the walls (see view.js).
const INSIDE = {
  fov: 70, fovTall: 84,         // wide lens; wider still on a tall phone screen
  minDist: 1, maxDist: 9,       // the orbit's range, read as zoom 0..1
  minPolar: 0.9, maxPolar: 1.68,  // from looking down into the room to slightly up at the ceiling
  followZoom: 0.6,              // come this much closer to a followed character
  home: new THREE.Vector3(0, 1.0, -0.2), // look-at point: the middle of the room, chest height
};
const OUTSIDE = { minDist: 2, maxDist: 34, minPolar: 0, maxPolar: 1.5 };
const VIEW_KEY = 'offquarium.view';
const bounds = insideBounds(ROOM);
const idealOff = new THREE.Vector3();
let view = 'outside';
const isTall = () => window.innerWidth / window.innerHeight < 0.9;

function placeInside() {
  const zoom = (idealOff.length() - INSIDE.minDist) / (INSIDE.maxDist - INSIDE.minDist);
  const closer = THREE.MathUtils.lerp(1, INSIDE.followZoom, focusBlend);
  const dist = insideDistance(controls.target, idealOff, bounds, zoom * closer);
  camera.position.copy(controls.target).addScaledVector(idealOff, dist / idealOff.length());
}

// The orbit controls update themselves on every drag and wheel event as well
// as once a frame. Wrap that update, so each one starts from the offset the
// visitor asked for and ends with the camera brought indoors.
const orbitUpdate = controls.update.bind(controls);
controls.update = dt => {
  if (view !== 'inside') return orbitUpdate(dt);
  camera.position.copy(controls.target).add(idealOff);
  const changed = orbitUpdate(dt);
  idealOff.copy(camera.position).sub(controls.target);
  placeInside();
  return changed;
};

function setView(next, { remember = true } = {}) {
  view = next === 'outside' ? 'outside' : 'inside';
  const inside = view === 'inside';
  const limits = inside ? INSIDE : OUTSIDE;
  Object.assign(controls, {
    minDistance: limits.minDist, maxDistance: limits.maxDist,
    minPolarAngle: limits.minPolar, maxPolarAngle: limits.maxPolar,
    enablePan: !inside,
  });
  room.setInside(inside);
  resize();
  if (inside) {
    // Start at a wall, looking across the room: along its length on a tall screen.
    controls.target.copy(INSIDE.home);
    idealOff.setFromSphericalCoords(INSIDE.maxDist, 1.42, isTall() ? -Math.PI / 2 : 0);
  } else {
    controls.target.copy(overview.target);
    camera.position.copy(overview.target).addScaledVector(VIEW_DIR, overview.dist);
  }
  controls.update(0);
  updateWalls(room.walls, camera, Infinity); // no fold animation: the walls are simply there
  press('[data-view]', b => b.dataset.view === view);
  document.body.dataset.view = view;
  if (remember) { try { localStorage.setItem(VIEW_KEY, view); } catch { /* private mode */ } }
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

const tmp = new THREE.Vector3();
const FOLLOW_DIST = 7;   // metres from a followed character: close, with room to see who they meet
let focusBlend = 0;
function updateCamera(dt) {
  const c = followed();
  // Zoom in only while the followed character is in the room.
  focusBlend += ((c ? 1 : 0) - focusBlend) * Math.min(1, dt * 3);
  if (view === 'inside') {
    // Look at the followed character, or the middle of the room.
    if (c) {
      const p = insetPoint(c.pos.x, c.pos.y, bounds);
      tmp.set(p.x, c.type === 'ghost' ? 0.6 : 1.0, p.z);
    }
    controls.target.lerp(c ? tmp : INSIDE.home, Math.min(1, dt * 3));
    return;
  }
  const goal = c ? tmp.set(c.pos.x, c.type === 'ghost' ? 0.5 : 0.95, c.pos.y) : overview.target;
  if (params.has('cam') && !c) return;
  controls.target.lerp(goal, Math.min(1, dt * 3));
  if (c || focusBlend > 0.01) {
    const want = THREE.MathUtils.lerp(overview.dist, FOLLOW_DIST, focusBlend);
    const off = camera.position.clone().sub(controls.target);
    off.setLength(off.length() + (want - off.length()) * Math.min(1, dt * 3));
    camera.position.copy(controls.target).add(off);
  }
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (view === 'inside') camera.fov = isTall() ? INSIDE.fovTall : INSIDE.fov;
  else camera.fov = isTall() ? 44 : 32;
  camera.updateProjectionMatrix();
  if (view === 'inside') return;
  // Fit the room's width (plus the base) in view.
  const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  overview.dist = Math.max(15.5, 7.4 / halfW);
  if (!followed() && !params.has('cam')) {
    const off = camera.position.clone().sub(controls.target).setLength(overview.dist);
    camera.position.copy(controls.target).add(off);
  }
}
window.addEventListener('resize', resize);
resize();
// An explicit ?cam is a view from outside. Otherwise: ?view, the last choice, or inside.
if (!params.has('cam')) {
  let stored = null;
  try { stored = localStorage.getItem(VIEW_KEY); } catch { /* private mode */ }
  setView(params.get('view') || stored || 'inside', { remember: false });
} else {
  press('[data-view]', b => b.dataset.view === view);
  document.body.dataset.view = view;
}

// ---- Loop ----
const clock = new THREE.Clock();

// One step of the office. `draw` false skips the rendering (fast-forward).
function frame(dt, draw = true) {
  lighting.update(currentPhase(), dt);
  updateCamera(dt);
  controls.update(dt);
  updateWalls(room.walls, camera, dt);
  room.clock.update(hourOverride === null ? new Date() : new Date(2026, 0, 1, hourOverride, new Date().getMinutes(), new Date().getSeconds()));
  sim.visitor.x = camera.position.x;
  sim.visitor.z = camera.position.z;
  sim.update(dt);
  if (ghost) {
    if (!ghostArtRequested && sim.ghostDueIn() < GHOST_ART_LEAD_S) {
      ghostArtRequested = true;
      ghost.standee.load();
    }
  }
  showEvents();
  props.update(sim.state, sim.time, dt);
  if (!logPanel.hidden) daylog.seen();
  for (const c of cast) {
    c.standee.setOpacity(c.opacity);
    if (!c.present) continue;
    c.standee.root.position.set(c.pos.x, 0, c.pos.y);
    c.standee.heading = c.heading;
    c.standee.update(sim.time, dt, c.speed, camera);
  }
  bubbles.sync();
  if (!draw) return;
  renderer.render(scene, camera);
  bubbles.place(camera);
}
renderer.setAnimationLoop(() => frame(Math.min(clock.getDelta(), 1 / 20)));

// ---- Talk to Margo ----
// The chat endpoint comes from <meta name="margo-endpoint"> in the page
// (see worker/margo/README.md); empty means the chat runs offline.
const BUBBLE_MAX_CHARS = 160;
const margoChat = margo && document.getElementById('margoChat') && initMargoChat({
  endpoint: document.querySelector('meta[name="margo-endpoint"]')?.content.trim() || '',
  offlineLines: MARGO_LINES.offline,
  // What Margo can see right now, so her replies can mention it.
  getContext() {
    const here = cast.filter(c => c.present).map(c => NAMES[c.type]).join(', ');
    const now = [
      sim.state.printerJammed && 'the printer is jammed',
      sim.state.donut && 'there is a donut on the floor and people are racing for it',
      sim.state.cake && 'there is a birthday cake out',
      sim.state.lampFlicker && 'the lamp is flickering',
      sim.event === 'meeting' && 'a meeting is going on at the whiteboard',
    ].filter(Boolean).join('; ');
    const recent = daylog.recent(4).join(' ');
    return [`Time of day: ${currentPhase()}.`, `In the room: ${here}.`, now && `Right now: ${now}.`, recent && `Earlier today: ${recent}`]
      .filter(Boolean).join(' ').slice(0, 600);
  },
  onOpenChange(open) {
    margo.talkingToVisitor = open;
    if (open && margo.chat) { margo.chat.order.length = 0; } // finish any office chat first
  },
  onReply(reply) {
    sim.say(margo, reply.length > BUBBLE_MAX_CHARS ? `${reply.slice(0, BUBBLE_MAX_CHARS - 1)}…` : reply);
  },
});

// ---- Clicks in the room ----
// A click (not the end of a drag) on a character pokes them: they turn to the
// glass and say something. Margo opens her chat instead. A click on the
// printer jams it; a double click on the floor drops a donut there.
{
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  let downAt = null;
  const aim = e => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  };
  // The character under the pointer, nearest first.
  const characterAt = () => {
    const roots = cast.filter(c => c.present).map(c => c.standee.root);
    const first = raycaster.intersectObjects(roots, true)[0];
    return first && cast.find(c => { for (let o = first.object; o; o = o.parent) if (o === c.standee.root) return true; return false; });
  };
  canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    aim(e);
    const c = characterAt();
    if (c === margo && margoChat) margoChat.open();
    else if (c) sim.poke(c);
    else if (printerPiece && raycaster.intersectObject(printerPiece.object, true).length) sim.trigger('printerJam');
  });
  canvas.addEventListener('dblclick', e => {
    aim(e);
    if (characterAt() || !raycaster.ray.intersectPlane(floor, hit)) return;
    if (Math.abs(hit.x) < ROOM.W / 2 && Math.abs(hit.z) < ROOM.D / 2) sim.dropDonut(hit.x, hit.z);
  });
}
// The "setting up" note goes once the cast's standing drawings are in.
artReady.then(() => document.getElementById('loading')?.remove());

// Debug / test hook.
window.__office = {
  scene, camera, controls, cast, nav, sim, daylog, sound, tapGlass, spots: sim.spots, setPhase, setFocus, setView,
  get view() { return view; }, say: sim.say, margoChat, haunt: sim.haunt,
  // Fast-forward: simulate every frame, draw only the last one.
  step(seconds, fps = 30) { const n = Math.round(seconds * fps); for (let i = 1; i <= n; i++) frame(1 / fps, i === n); },
  ready: true,
};
