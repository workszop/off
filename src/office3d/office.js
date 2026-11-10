// ---- Offquarium office in 3D ----
// The page: scene, furniture layout, camera, toolbar and the frame loop.
// What the cast does lives in sim.js, the time-of-day look in lighting.js and
// the speech bubbles in bubbles.js. Lighting follows the real clock through
// DAY_PHASES (data.js), or a phase picked in the toolbar.
//
// URL params: ?hour=N (clock override), ?phase=night,
// ?cam=x,y,z,tx,ty,tz, ?seed=N (deterministic wander for screenshots).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { createStandee, STANDEE_TYPES } from '../characters3d/standee.js';
import { buildRoom, updateWalls, ROOM } from './room.js';
import { BUILDERS } from './furniture.js';
import { NavGrid } from './nav.js';
import { buildExterior } from './exterior.js';
import { initMargoChat } from './margo-chat.js';
import { MARGO_LINES, phaseForHour } from './data.js';
import { createSim } from './sim.js';
import { createLighting } from './lighting.js';
import { createBubbles } from './bubbles.js';

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

// ---- Time of day ----
const hourOverride = params.has('hour') ? Number(params.get('hour')) : null;
let phaseChoice = params.get('phase') || 'live';
const currentPhase = () => phaseChoice !== 'live' ? phaseChoice : phaseForHour(hourOverride ?? new Date().getHours());

// ---- Cast ----
// The simulation owns each character's state; the page adds their standee
// and speech bubble to the same object.
const ACCENTS = { andy: '--coral', jazz: '--sage', olex: '--violet', ghost: '--blue', margo: '--indigo' };
const NAMES = { andy: 'Andy', jazz: 'Jazz', olex: 'Olex', ghost: 'Ghost', margo: 'Margo' };

const sim = createSim({ nav, spots, types: STANDEE_TYPES, phase: currentPhase });
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

function frame(dt) {
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
    ghost.standee.setOpacity(ghost.opacity);
  }
  for (const c of cast) {
    if (!c.present) continue;
    c.standee.root.position.set(c.pos.x, 0, c.pos.y);
    c.standee.heading = c.heading;
    c.standee.update(sim.time, dt, c.speed, camera);
  }
  bubbles.sync();
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
  onOpenChange(open) {
    margo.talkingToVisitor = open;
    if (open && margo.chat) { margo.chat.order.length = 0; } // finish any office chat first
  },
  onReply(reply) {
    sim.say(margo, reply.length > BUBBLE_MAX_CHARS ? `${reply.slice(0, BUBBLE_MAX_CHARS - 1)}…` : reply);
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
// The "setting up" note goes once the cast's standing drawings are in.
artReady.then(() => document.getElementById('loading')?.remove());

// Debug / test hook.
window.__office = {
  scene, camera, cast, nav, sim, spots: sim.spots, setPhase, setFocus, say: sim.say, margoChat, haunt: sim.haunt,
  step(seconds, fps = 30) { for (let i = 0; i < seconds * fps; i++) frame(1 / fps); },
  ready: true,
};
