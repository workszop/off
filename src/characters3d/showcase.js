// ---- 3D cast showcase ----
// A paper stage for the cardboard standees: stand in a line-up, walk a loop,
// orbit, and follow one character up close.
//
// URL params (handy for screenshots/tests):
//   ?mode=walk|stand  ?focus=andy  ?azimuth=45 (deg)  ?t=2.5 (freeze time)

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { createStandee, STANDEE_TYPES } from './standee.js';

const INK = 0x292824;

const params = new URLSearchParams(location.search);
const frozenTime = params.has('t') ? Number(params.get('t')) : null;

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4efe5);
scene.fog = new THREE.Fog(0xf4efe5, 12, 24);

const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
camera.position.set(0, 1.5, 7.4);
const overview = { target: new THREE.Vector3(0, 0.85, 0), dist: 7.6 };
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.85, 0);
controls.enableDamping = true;
controls.minDistance = 1.1;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI / 2 - 0.04;
controls.autoRotateSpeed = 1.2;

if (params.has('cam')) {
  const [x, y, z, tx, ty, tz] = params.get('cam').split(',').map(Number);
  camera.position.set(x, y, z);
  controls.target.set(tx, ty, tz);
  overview.target.set(tx, ty, tz);
}
if (params.has('azimuth')) {
  const a = THREE.MathUtils.degToRad(Number(params.get('azimuth')));
  const off = camera.position.clone().sub(controls.target);
  const r = Math.hypot(off.x, off.z);
  camera.position.set(controls.target.x + Math.sin(a) * r, camera.position.y, controls.target.z + Math.cos(a) * r);
}

// ---- Lights ----
scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d0c2, 1.7));
const sun = new THREE.DirectionalLight(0xfff8ee, 2.1);
sun.position.set(-4, 6, 1.2); // from the left, so silhouette shadows fall beside the cards
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

// ---- Paper stage ----
// Flat paper colours (unlit) plus a transparent shadow catcher on top, so
// the floor matches the page background exactly and still shows shadows.
const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshBasicMaterial({ color: 0xf4efe5 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const mat = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), new THREE.MeshBasicMaterial({ color: 0xe9e0d2 }));
mat.rotation.x = -Math.PI / 2;
mat.position.y = 0.001;
scene.add(mat);
const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.ShadowMaterial({ color: 0x5b4c37, opacity: 0.2 }));
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = 0.004;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);
const rim = new THREE.Mesh(new THREE.RingGeometry(3.18, 3.21, 96), new THREE.MeshBasicMaterial({ color: INK }));
rim.rotation.x = -Math.PI / 2;
rim.position.y = 0.002;
scene.add(rim);

// ---- Cast ----
const LINEUP_X = [-2.2, -1.1, 0, 1.1, 2.2];
const LOOP_R = 2.2;
const WALK_SPEED = 1.1; // m/s at speed 1
const TURN_RATE = 4.5;  // rad/s

const ACCENTS = { andy: '--coral', jazz: '--sage', olex: '--violet', ghost: '--blue', margo: '--green' };
const NAMES = { andy: 'Andy', jazz: 'Jazz', olex: 'Olex', ghost: 'Ghost', margo: 'Margo' };

const cast = STANDEE_TYPES.map((type, i) => {
  const standee = createStandee(type);
  scene.add(standee.root);
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = NAMES[type];
  label.style.setProperty('--c', `var(${ACCENTS[type]})`);
  document.body.appendChild(label);
  const home = new THREE.Vector2(LINEUP_X[i], 0);
  return { standee, type, i, label, home, pos: home.clone(), heading: 0, speed: 0, labelY: type === 'ghost' ? 1.02 : 1.84 };
});

// ---- Modes ----
let mode = params.get('mode') === 'walk' ? 'walk' : 'stand';
let focus = params.get('focus') || '';
let focusBlend = focus ? 1 : 0;

function angleDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

function steer(c, dt) {
  let target, pace = null;
  if (mode === 'walk') {
    // Each character owns a slot on the loop, a quarter-turn apart, that
    // travels slightly slower than walking pace. They steer at a point just
    // ahead of their slot and speed up or ease off to keep station.
    const slot = loopClock + c.i * Math.PI / 2;
    const lag = angleDelta(Math.atan2(c.pos.x, c.pos.y), slot);
    const lead = slot + 0.4;
    target = new THREE.Vector2(Math.sin(lead) * LOOP_R, Math.cos(lead) * LOOP_R);
    pace = THREE.MathUtils.clamp(0.85 + lag * 0.9, 0.45, 1.2);
  } else {
    target = c.home;
  }
  const d = target.clone().sub(c.pos);
  const dist = d.length();
  let wantSpeed = 0, wantHeading = 0;
  if (dist > 0.04) {
    wantHeading = Math.atan2(d.x, d.y);
    wantSpeed = pace ?? Math.min(1, dist / 0.5);
  }
  c.heading += THREE.MathUtils.clamp(angleDelta(c.heading, wantHeading), -TURN_RATE * dt, TURN_RATE * dt);
  // Do not stride off sideways: slow down while turning hard.
  const align = Math.max(0, Math.cos(angleDelta(c.heading, wantHeading)));
  c.speed = wantSpeed * align;
  c.pos.x += Math.sin(c.heading) * WALK_SPEED * c.speed * dt;
  c.pos.y += Math.cos(c.heading) * WALK_SPEED * c.speed * dt;
}

// ---- UI ----
function setMode(m) {
  mode = m;
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
}
function setFocus(type) {
  focus = type;
  document.querySelectorAll('.topbar [data-focus]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.focus === type)));
}
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.querySelectorAll('[data-focus]').forEach(b => b.addEventListener('click', () => setFocus(b.dataset.focus)));
const orbitBtn = document.querySelector('[data-orbit]');
orbitBtn.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  orbitBtn.setAttribute('aria-pressed', String(controls.autoRotate));
});
setMode(mode);
setFocus(focus);

// ---- Camera follow ----
const tmp = new THREE.Vector3();
function updateCamera(dt) {
  focusBlend += ((focus ? 1 : 0) - focusBlend) * Math.min(1, dt * 3);
  const c = cast.find(x => x.type === focus);
  const goal = c ? tmp.set(c.pos.x, c.type === 'ghost' ? 0.5 : 0.95, c.pos.y) : overview.target;
  controls.target.lerp(goal, Math.min(1, dt * 4));
  if (!params.has('cam') && (c || focusBlend > 0.01)) {
    const want = THREE.MathUtils.lerp(overview.dist, 2.6, focusBlend);
    const off = camera.position.clone().sub(controls.target);
    const len = off.length();
    off.setLength(len + (want - len) * Math.min(1, dt * 3));
    camera.position.copy(controls.target).add(off);
  }
}

// ---- Loop ----
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Keep the whole line-up (about 4.6 m wide) in frame on narrow screens by
  // backing the overview camera off until the horizontal field of view fits.
  camera.fov = w / h < 0.8 ? 40 : 30;
  camera.updateProjectionMatrix();
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  overview.dist = Math.max(8.6, 2.9 / halfH);
  if (!params.has('cam') && !focus) {
    const off = camera.position.clone().sub(controls.target).setLength(overview.dist);
    camera.position.copy(controls.target).add(off);
  }
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
const proj = new THREE.Vector3();
let time = 0;

let loopClock = 0; // angle of slot 0 on the walking loop

function frame(dt) {
  time = frozenTime ?? time + dt;
  if (mode === 'walk' && frozenTime === null) loopClock += dt * 0.85 * WALK_SPEED / LOOP_R;
  // Camera first, so cards face where the camera is this frame.
  updateCamera(frozenTime === null ? dt : 1);
  controls.update(dt);
  for (const c of cast) {
    if (frozenTime === null) steer(c, dt);
    c.standee.root.position.set(c.pos.x, 0, c.pos.y);
    c.standee.heading = c.heading;
    c.standee.update(time, frozenTime === null ? dt : 1, c.speed, camera);
  }
  renderer.render(scene, camera);

  const w = window.innerWidth, h = window.innerHeight;
  for (const c of cast) {
    proj.set(c.pos.x, c.labelY, c.pos.y).project(camera);
    const visible = proj.z < 1 && (!focus || focus === c.type);
    c.label.style.display = visible ? '' : 'none';
    c.label.style.transform = `translate(${(proj.x + 1) / 2 * w}px, ${(1 - proj.y) / 2 * h}px) translate(-50%, -100%)`;
  }
}

renderer.setAnimationLoop(() => frame(Math.min(clock.getDelta(), 1 / 20)));

// Test/debug hook.
window.__cast = {
  setMode, setFocus, cast, renderer, scene, camera,
  // Advance the simulation deterministically (for headless screenshots).
  step(seconds, fps = 30) {
    for (let i = 0; i < seconds * fps; i++) frame(1 / fps);
  },
  ready: true,
};
