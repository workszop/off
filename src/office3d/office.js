// ---- Offquarium office in 3D ----
// The page: scene, furniture layout, camera, toolbar, clicks and the frame
// loop. What the cast does lives in sim.js and events.js, the time-of-day
// look in lighting.js, speech bubbles in bubbles.js, event props in props.js,
// sound in sound.js and the diary in daylog.js. Lighting follows the real clock through
// DAY_PHASES (data.js), or a phase picked in the toolbar.
//
// The camera stands in the room, between its walls and under its ceiling.
// A director (director.js) picks the shots, so the office can be watched
// like a sitcom; a drag or a scroll takes the camera over for a while, and
// the Director button turns it off altogether. First person puts the camera
// in the head of the character picked in the toolbar.
//
// URL params: ?hour=N (clock override), ?phase=night, ?director=off, ?pov=jazz,
// ?seed=N (deterministic wander for screenshots), ?party=1 (start with the party on),
// ?show=band, ?show=xmas or ?show=murder (start with that show on).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { createStandee, STANDEE_TYPES, SCALE } from '../characters3d/standee.js';
import { buildRoom, doorLeaf, ROOM } from './room.js';
import { BUILDERS } from './furniture.js';
import { NavGrid } from './nav.js';
import { buildExterior } from './exterior.js';
import { createOutline } from './outline.js';
import { initMargoChat } from './margo-chat.js';
import { GUEST, MARGO_LINES, NAMES, PARTY_PHASE, SHOWS, phaseForHour } from './data.js';
import { createSim } from './sim.js';
import { createCarryController } from './carry.js';
import { createLighting } from './lighting.js';
import { createBubbles } from './bubbles.js';
import { createProps } from './props.js';
import { createParty } from './party.js';
import { createStage } from './stage.js';
import { createSound, hasTrack } from './sound.js';
import { createDayLog } from './daylog.js';
import { insideBounds, insideDistance, insetPoint, reach, eyeView, EYE_FOV } from './view.js';
import { createDirector } from './director.js';
import { buildEnvironment } from './environment.js';
import { setEnvironment, contactShadow } from './materials.js';

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
// Highlights on glazed, plastic and metal things are brighter than paper
// white. The neutral curve leaves the card colours as they are and only rolls
// off what would otherwise clip.
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

setEnvironment(buildEnvironment(renderer));
const outline = createOutline(renderer);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4efe5);
scene.fog = new THREE.Fog(0xf4efe5, 26, 48);

const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 170); // far enough for the sky outside
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.autoRotateSpeed = 0.8;

const hemi = new THREE.HemisphereLight(0xffffff, 0xd9d0c2, 1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff8ee, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
// The shadow map covers the room and no more: everything that casts a shadow
// is within 7.7 m of the middle of the floor, and the sun is 10 to 12 m away.
Object.assign(sun.shadow.camera, { left: -7.8, right: 7.8, top: 7.8, bottom: -7.8, near: 1, far: 20 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

await loadFonts();
const room = buildRoom();
scene.add(room.group);
const outside = buildExterior(ROOM);
outside.group.userData.outline = 'skip'; // the street keeps its own, heavier lines
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
const furniture = [];  // every piece's object: what can stand between the camera and its subject
for (const [type, x, z, rot] of LAYOUT) {
  const p = BUILDERS[type]();
  pieces[type] ??= { piece: p, x, z };
  p.object.position.set(x, 0, z);
  p.object.rotation.y = rot;
  scene.add(p.object);
  furniture.push(p.object);
  glow.push(...p.glow);
  if (p.light) lamps.push(p);

  // A soft shadow under the piece, a little wider than its footprint.
  {
    const [x0, z0, x1, z1] = p.footprint;
    const shade = contactShadow(x1 - x0 + 0.34, z1 - z0 + 0.34, p.shade ?? 0.3);
    shade.position.set((x0 + x1) / 2, 0.008, (z0 + z1) / 2);
    p.object.add(shade);
  }

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
let partyOn = false;   // the Party button: it replaces the time of day until it is turned off again
let showKey = null;    // the show that runs (a SHOWS key): it replaces the time of day the same way
const clockPhase = () => phaseChoice !== 'live' ? phaseChoice : phaseForHour(hourOverride ?? new Date().getHours());
const currentPhase = () => showKey ?? (partyOn ? PARTY_PHASE.key : clockPhase());

// ---- Cast ----
// The simulation owns each character's state; the page adds their standee
// and speech bubble to the same object.
const ACCENTS = { andy: '--coral', jazz: '--sage', olex: '--violet', ghost: '--blue', margo: '--indigo', [GUEST.type]: '--ochre' };

// Things office events happen around. The lamp's shade hangs 1 m to the side
// of its base.
const at = type => pieces[type] && { x: pieces[type].x, z: pieces[type].z };
const landmarks = {
  printer: at('printer'),
  whiteboard: at('whiteboard'),
  lamp: pieces.lamp_arc_big && { x: pieces.lamp_arc_big.x + 1, z: pieces.lamp_arc_big.z },
};
// The guest rolls his own dice (sim.js), so a seeded office is the same with
// him in the cast.
let guestSeed = params.has('seed') ? (Number(params.get('seed')) || 1) + 7919 : crypto.getRandomValues(new Uint32Array(1))[0];
const sim = createSim({ nav, spots, types: STANDEE_TYPES, phase: currentPhase, landmarks, guestRandom: () => {
  guestSeed = (Math.imul(guestSeed, 1664525) + 1013904223) >>> 0;
  return guestSeed / 4294967296;
} });
// A separate stream keeps cosmetic choices from changing the simulation.
let carrySeed = params.has('seed') ? Number(params.get('seed')) || 1 : crypto.getRandomValues(new Uint32Array(1))[0];
const carry = createCarryController({ spots, random: () => {
  carrySeed = (Math.imul(carrySeed, 1664525) + 1013904223) >>> 0;
  return carrySeed / 4294967296;
} });
const cast = sim.cast;
const ghost = cast.find(c => c.type === 'ghost');
// The guest (data.js: GUEST) is out most of the time, like the ghost.
const guest = cast.find(c => c.type === GUEST.type);
for (const c of cast) {
  // The guest's card is made outside the ?seed stream (it draws on
  // Math.random), so the staff's seeded day is the one it was without him.
  const seeded = Math.random;
  if (c === guest) Math.random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  try { c.standee = createStandee(c.type, { autoLoad: false }); } finally { Math.random = seeded; }
  scene.add(c.standee.root);
}
const margo = cast.find(c => c.type === 'margo');
const bubbles = createBubbles(cast, {
  names: NAMES, accents: ACCENTS,
  headY: c => (c.type === 'ghost' ? 0.98 : 1.74 * SCALE[c.type]),
});

// Character art arrives in stages, so the office appears quickly: everyone's
// standing drawings first, then the walk frames. The ghost is out of the room
// at the start, so its art waits until a visit is near (see frame()); so does
// the guest's, which is fetched when he is about to walk in or a show casts him.
const staff = cast.filter(c => c !== ghost && c !== guest);
// The office opens as soon as each front standing drawing is in; the side and
// back drawings follow in the background.
const firstArt = Promise.all(staff.map(c => c.standee.loadFirst()));
const artReady = firstArt.then(() => Promise.all(staff.map(c => c.standee.loadIdle())));
// The party's dance art comes last. The Party button stays disabled until it
// has all arrived, so the party never starts on a half-loaded cast.
const partyReady = artReady
  .then(() => Promise.all(staff.map(c => c.standee.loadWalk())))
  .then(() => Promise.all(staff.map(c => c.standee.loadDance())));
const GHOST_ART_LEAD_S = 20;
let ghostArtRequested = false;
// The guest's standing, walking and dance drawings, fetched once. A missing
// drawing settles too (the card then shows what it has), so nothing waits on it.
const GUEST_ART_LEAD_S = 20;
let guestArt = null;
const loadGuestArt = () => (guestArt ??= guest.standee.load().then(() => guest.standee.loadDance()));

const lighting = createLighting({
  scene, sun, hemi, skyMat: room.skyMat, outside, lamps, glow, panels: room.panels,
  standees: cast.map(c => c.standee),
});
lighting.update(currentPhase(), 0);

const props = createProps();
scene.add(props.group);
const party = createParty({ nav });
scene.add(party.group);
// The stage adds its own group to the scene. Three.js draws on Math.random
// for object ids, so it is built outside the ?seed stream: the set and its
// lights must not change what a seeded office does.
const stage = (() => {
  const seeded = Math.random;
  Math.random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  try { return createStage({ scene, shows: SHOWS }); } finally { Math.random = seeded; }
})();
const sound = createSound();
const daylog = createDayLog({
  list: document.getElementById('dayLogList'),
  count: document.getElementById('logCount'),
  empty: document.getElementById('dayLogEmpty'),
});

// ---- What the simulation shows and sounds like ----
// The sim only keeps state; each frame the page compares it with the last
// frame to wobble the printer, flicker the lamp, play sounds and fill the diary.
const PITCH = { andy: 0.8, jazz: 1.25, olex: 1.0, ghost: 1.6, margo: 0.65, [GUEST.type]: 0.72 };
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
function setFocus(t) {
  focus = t;
  press('[data-focus]', b => b.dataset.focus === t);
  if (!t && pov) setPov(false); // 'Everyone' has no eyes to look through
}
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
const ACTIONS = { tap: tapGlass };
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

// The party: the room goes dark and the disco ball, boombox and mess appear.
// The phase buttons keep what they were, so turning it off brings the day back.
let partyArtLoaded = false;
const partyButtons = document.querySelectorAll('[data-party]');
const partyTitle = partyButtons[0]?.title ?? '';
partyButtons.forEach(b => { b.title = 'Loading the dance art...'; });
partyReady.then(() => {
  partyArtLoaded = true;
  partyButtons.forEach(b => { b.disabled = false; b.title = partyTitle; });
});
function setParty(on, { gesture = true } = {}) {
  if (on && !partyArtLoaded) return;   // button and P key wait for the art
  if (on) setShow(null);   // one or the other
  partyOn = Boolean(on);
  press('[data-party]', () => partyOn);
  document.body.dataset.partyMode = partyOn ? 'on' : 'off';
  if (partyOn) {
    if (gesture && !sound.enabled) setSound(true);   // the click that got us here allows it
    sound.startMusic();
  } else sound.stopMusic();
}
document.querySelectorAll('[data-party]').forEach(b => b.addEventListener('click', () => setParty(!partyOn)));
if (params.get('party') === '1') partyReady.then(() => setParty(true, { gesture: false }));   // for screenshots and tests: no sound without a click

// Shows (shows.js): the Band, Christmas and Murder buttons put a show's set up
// in the room. A show's art for the four humans (each the act of their own
// role), and for the guest if the show casts him, loads on the first click (the button is busy meanwhile); a click
// while the show runs ends it. Like the party, a show replaces the time of
// day, and the phase buttons keep what they were.
const showButtons = document.querySelectorAll('button[data-show]');
const showLoads = new Map();   // show key -> promise of its art
let showWanted = null;         // what was last asked for, while its art may still be loading
let showBeat = null;           // the beat the music last followed
artReady.then(() => showButtons.forEach(b => { b.disabled = false; }));
function showShow() {
  press('button[data-show]', b => b.dataset.show === showKey);
  showButtons.forEach(b => {
    if (showLoads.has(b.dataset.show) && b.dataset.show === showWanted && showKey !== showWanted) b.setAttribute('aria-busy', 'true');
    else b.removeAttribute('aria-busy');
  });
  document.body.dataset.show = showKey ?? 'off';
}
function loadShow(key) {
  let load = showLoads.get(key);
  if (!load) {
    load = artReady.then(() => Promise.all([
      ...staff.map(c => c.standee.loadAct(SHOWS[key].roles[c.type]?.act)),
      // The guest comes in for a show that casts him: his walk-in art too.
      guest && SHOWS[key].roles[guest.type] && Promise.all([loadGuestArt(), guest.standee.loadAct(SHOWS[key].roles[guest.type].act)]),
    ]));
    showLoads.set(key, load);
    // A failed load can be tried again with the next click.
    load.catch(() => { showLoads.delete(key); if (showWanted === key) showWanted = null; showShow(); });
  }
  return load;
}
function setShow(key, { gesture = true } = {}) {
  const next = key !== null && Object.hasOwn(SHOWS, key) ? key : null;
  showWanted = next;
  if (next === showKey) { showShow(); return Promise.resolve(); }
  if (showKey) {
    sim.setShow(null);
    showKey = null;
    showBeat = null;
    sound.stopMusic();
  }
  if (!next) { showShow(); return Promise.resolve(); }
  if (gesture && !sound.enabled) setSound(true);   // in the click itself, which allows it
  const load = loadShow(next);
  showShow();
  return load.then(() => {
    if (showWanted !== next || showKey) return;   // switched off, or the party, while it loaded
    if (partyOn) setParty(false);
    if (!sim.setShow(next)) return;
    showKey = next;
    showShow();
    frontOfShow(next);
  }, () => {});
}
// A show is watched from the front. The director cuts there itself; a visitor
// holding the camera is put square on to the performers, from the front wall.
function frontOfShow(key) {
  if (directorOn || inPov) return;
  const marks = Object.values(SHOWS[key].roles).map(r => r.mark);
  const mid = (axis) => marks.reduce((sum, m) => sum + m[axis], 0) / marks.length;
  controls.target.set(mid('x'), 1.1, mid('z'));
  idealOff.setFromSphericalCoords(INSIDE.maxDist, 1.42, 0);   // as far back as the room allows, straight on
}
// A show's music follows its beat: on while it plays, off between songs.
// A show without a track of its own stays silent.
function showMusic() {
  const beat = showKey ? sim.state.show?.beat ?? null : null;
  if (beat === showBeat) return;
  showBeat = beat;
  if (beat === 'play' && hasTrack(showKey)) sound.startMusic(showKey);
  else sound.stopMusic();
}
showButtons.forEach(b => b.addEventListener('click', () => setShow(showKey === b.dataset.show ? null : b.dataset.show)));   // a click while the art loads changes nothing
if (params.has('show')) setShow(params.get('show'), { gesture: false });   // for screenshots and tests: no sound without a click
showShow();

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
// By hand: the orbit controls steer `idealOff`, the offset from the look-at
// point that the visitor asks for; placeInside() then stands the camera on
// that line, inside the walls (see view.js).
const INSIDE = {
  fov: 70, fovTall: 84,         // wide lens; wider still on a tall phone screen
  minDist: 1, maxDist: 9,       // the orbit's range, read as zoom 0..1
  minPolar: 0.9, maxPolar: 1.68,  // from looking down into the room to slightly up at the ceiling
  followZoom: 0.6,              // come this much closer to a followed character
  home: new THREE.Vector3(0, 1.0, -0.2), // look-at point: the middle of the room, chest height
};
const NEAR = 1.2;               // the closest the hand-held camera comes to its look-at point (as in view.js)
const bounds = insideBounds(ROOM);
const idealOff = new THREE.Vector3();
const isTall = () => window.innerWidth / window.innerHeight < 0.9;
const baseFov = () => (isTall() ? INSIDE.fovTall : INSIDE.fov);
Object.assign(controls, {
  minDistance: INSIDE.minDist, maxDistance: INSIDE.maxDist,
  minPolarAngle: INSIDE.minPolar, maxPolarAngle: INSIDE.maxPolar,
});
// Start at a wall, looking across the room: along its length on a tall screen.
controls.target.copy(INSIDE.home);
idealOff.setFromSphericalCoords(INSIDE.maxDist, 1.42, isTall() ? -Math.PI / 2 : 0);

function placeInside() {
  const zoom = (idealOff.length() - INSIDE.minDist) / (INSIDE.maxDist - INSIDE.minDist);
  const closer = THREE.MathUtils.lerp(1, INSIDE.followZoom, focusBlend);
  const dist = insideDistance(controls.target, idealOff, bounds, zoom * closer, NEAR);
  camera.position.copy(controls.target).addScaledVector(idealOff, dist / idealOff.length());
}

// The orbit controls update themselves on every drag and wheel event as well
// as once a frame. Wrap that update, so each one starts from the offset the
// visitor asked for and ends with the camera brought indoors. While the
// director has the camera, the controls leave it alone.
const orbitUpdate = controls.update.bind(controls);
controls.update = dt => {
  if (directing || inPov) return false;
  camera.position.copy(controls.target).add(idealOff);
  const changed = orbitUpdate(dt);
  idealOff.copy(camera.position).sub(controls.target);
  placeInside();
  return changed;
};

// ---- The director ----
// director.js decides the shot from what the simulation is doing; this part
// feeds it, moves the camera (it glides after the shot, and jumps only when
// the director calls a cut), and hands the camera to the visitor whenever
// they reach for it.
const DIRECTOR_KEY = 'offquarium.director';
const HANDS_OFF_S = 7;     // after the visitor lets go, the director waits this long
const sight = new THREE.Raycaster();
const sightDir = new THREE.Vector3();
// Nothing but air between the camera and what it looks at? (Stops short of
// the subject, which may be sitting on, or standing at, a piece of furniture.)
function clearView(pos, target) {
  sightDir.set(target.x - pos.x, target.y - pos.y, target.z - pos.z);
  const far = sightDir.length() - 0.9;
  if (far <= 0) return true;
  sight.set(tmp.set(pos.x, pos.y, pos.z), sightDir.normalize());
  sight.far = far;
  return sight.intersectObjects(furniture, true).length === 0;
}
const director = createDirector({ bounds, clear: clearView });

const chatIds = new WeakMap();
let chatCount = 0;
const chatId = chat => chatIds.get(chat) ?? (chatIds.set(chat, ++chatCount), chatCount);
// What the director is told each frame.
function sceneNow() {
  const { state } = sim;
  return {
    aspect: camera.aspect,
    star: focus,
    cast: cast.map(c => ({
      type: c.type, x: c.pos.x, z: c.pos.y, heading: c.heading,
      present: c.present, visible: c.opacity > 0.5,
      speaking: c.line !== null, lineSeq: c.lineSeq,
      chat: c.chat ? chatId(c.chat) : null, turnsLeft: c.chat?.order.length ?? 0,
      withVisitor: Boolean(c.talkingToVisitor),
    })),
    events: {
      donut: state.donut,
      cake: state.cake,
      printer: state.printerJammed ? landmarks.printer : null,
      lamp: state.lampFlicker ? landmarks.lamp : null,
      meeting: sim.event === 'meeting' ? landmarks.whiteboard : null,
      party: partyOn ? party.boombox : null,
      show: showKey ? stage.subject(showKey)?.position ?? null : null,
    },
  };
}

let directorOn = true;       // the Director button
let directing = false;       // the director has the camera this frame
let handsOffUntil = 0;       // the visitor has it until then (seconds on `now`)
let now = 0;
let lastCut = -1;            // the director's cut counter when the camera last jumped
let settleUntil = 0;         // after the visitor lets go, the camera glides back gently until then
const lookAt = new THREE.Vector3().copy(INSIDE.home);
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
let focusBlend = 0;

// Who has the camera, and the kind of shot, on <body> for the page and tests.
const hint = document.querySelector('.title small');
const HINTS = { pov: 'First person · W A S D or arrow keys to walk · drag to look around · Everyone to leave' };
const defaultHint = hint?.textContent ?? '';
function showCamera() {
  const mode = inPov ? 'pov' : directing ? 'director' : 'manual';
  if (document.body.dataset.camera !== mode) {
    document.body.dataset.camera = mode;
    if (hint) hint.textContent = HINTS[mode] ?? defaultHint;
  }
  const kind = directing ? director.shot?.kind ?? '' : '';
  if (document.body.dataset.shot !== kind) document.body.dataset.shot = kind;
}

// Give the camera to the visitor where it stands: the orbit continues from
// the director's shot instead of jumping back to the default view.
function handOver() {
  if (!directing) return;
  directing = false;
  syncOrbit();
  showCamera();
}
// Set the orbit controls up to carry on from where the camera is now.
function syncOrbit() {
  const p = insetPoint(lookAt.x, lookAt.z, bounds);
  controls.target.set(p.x, THREE.MathUtils.clamp(lookAt.y, 0.7, 1.5), p.z);
  idealOff.copy(camera.position).sub(controls.target);
  const d = idealOff.length() || 1;
  const wall = reach(controls.target, { x: idealOff.x / d, y: idealOff.y / d, z: idealOff.z / d }, bounds);
  const zoom = wall > NEAR ? THREE.MathUtils.clamp((d - NEAR) / (wall - NEAR), 0, 1) : 1;
  idealOff.setLength(INSIDE.minDist + zoom * (INSIDE.maxDist - INSIDE.minDist));
}

// ---- First person ----
// The camera in the head of the character picked in the toolbar (view.js has
// the geometry). Their own cutout is hidden, their lines become captions, and
// a drag turns the head; let go and it comes back to where they are facing.
// W A S D or the arrow keys walk them about (sim.drive); left alone, they go
// back to their own day.
// While they are out of the room, the camera does what it would otherwise do.
let pov = false;             // the First person button
let inPov = false;           // the camera is in someone's head this frame
let povHidden = null;        // whose cutout is hidden
let povYaw = 0;              // their heading, smoothed
let povTurnedAt = -Infinity; // when the visitor last turned the head
const povLook = { yaw: 0, pitch: 0 };
const KEYS = {
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};
const held = new Set();      // which of forward / back / left / right are held down
const typing = e => e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
window.addEventListener('keydown', e => {
  const way = KEYS[e.code];
  if (!way || !inPov || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  held.add(way);
  e.preventDefault(); // the arrow keys would scroll the page
});
window.addEventListener('keyup', e => { held.delete(KEYS[e.code]); });
window.addEventListener('keydown', e => {
  if (e.code === 'KeyP' && !e.repeat && !typing(e) && !e.ctrlKey && !e.metaKey && !e.altKey) setParty(!partyOn);
});
window.addEventListener('blur', () => held.clear());
const eyes = () => (pov ? cast.find(c => c.type === focus && c.present && c.opacity > 0.5) : null);
function setPov(on) {
  pov = Boolean(on);
  // Somebody's eyes are needed: Jazz's, if nobody is picked.
  if (pov && !focus) setFocus(cast.find(c => c.type === 'jazz' && c.present)?.type ?? cast.find(c => c.present && c.type !== 'ghost')?.type ?? 'jazz');
  povLook.yaw = povLook.pitch = 0;
  press('[data-pov]', () => pov);
}
document.querySelectorAll('[data-pov]').forEach(b => b.addEventListener('click', () => setPov(!pov)));
function showOwn(c) {
  if (povHidden === c) return;
  if (povHidden) povHidden.standee.root.visible = povHidden.opacity > 0;
  povHidden = c;
}
// Returns true while the camera is in a character's head.
function updatePov(dt) {
  const me = eyes();
  if (!me) {
    if (inPov) {
      // Out of the head: the orbit carries on from here (the director glides away from here).
      inPov = false;
      controls.enabled = true;
      syncOrbit();
    }
    showOwn(null);
    held.clear();
    sim.drive(null);
    return false;
  }
  sim.drive(me.type, (held.has('forward') ? 1 : 0) - (held.has('back') ? 1 : 0), (held.has('left') ? 1 : 0) - (held.has('right') ? 1 : 0));
  if (!inPov || povHidden !== me) povYaw = me.heading;
  inPov = true;
  directing = false;
  controls.enabled = false;
  showOwn(me);
  povYaw += Math.atan2(Math.sin(me.heading - povYaw), Math.cos(me.heading - povYaw)) * Math.min(1, dt * 6);
  if (now - povTurnedAt > 1.5) {
    const back = Math.exp(-dt * 2.5);
    povLook.yaw *= back;
    povLook.pitch *= back;
  }
  const bob = Math.sin(sim.time * 9) * 0.014 * Math.min(1, me.speed);
  const view = eyeView({ type: me.type, x: me.pos.x, z: me.pos.y, heading: povYaw }, povLook, bob);
  const k = 1 - Math.exp(-dt * 7);
  camera.position.lerp(tmp.set(view.pos.x, view.pos.y, view.pos.z), k);
  lookAt.lerp(tmp2.set(view.target.x, view.target.y, view.target.z), k);
  const fov = isTall() ? 92 : EYE_FOV;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * k; camera.updateProjectionMatrix(); }
  camera.lookAt(lookAt);
  return true;
}
function takeOver() {
  handsOffUntil = now + HANDS_OFF_S;
  handOver();
}
function setDirector(on, { remember = true } = {}) {
  directorOn = Boolean(on);
  if (!directorOn) handOver();
  handsOffUntil = 0;
  press('[data-director]', () => directorOn);
  if (remember) { try { localStorage.setItem(DIRECTOR_KEY, directorOn ? 'on' : 'off'); } catch { /* private mode */ } }
}
document.querySelectorAll('[data-director]').forEach(b => b.addEventListener('click', () => setDirector(!directorOn)));

// A drag (not a click, which pokes someone), a pinch or the wheel takes over.
{
  let down = null;
  let last = null;
  canvas.addEventListener('pointerdown', e => { down = last = [e.clientX, e.clientY]; }, true);
  window.addEventListener('pointerup', () => { down = null; });
  canvas.addEventListener('pointermove', e => {
    if (!down) return;
    if (inPov) {
      // In first person a drag turns the head.
      povLook.yaw = THREE.MathUtils.clamp(povLook.yaw + (e.clientX - last[0]) * 0.006, -2.2, 2.2);
      povLook.pitch = THREE.MathUtils.clamp(povLook.pitch + (e.clientY - last[1]) * 0.004, -0.6, 0.6);
      last = [e.clientX, e.clientY];
      povTurnedAt = now;
    } else if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) takeOver();
  }, true);
  canvas.addEventListener('wheel', () => { if (!inPov) takeOver(); }, { capture: true, passive: true });
}

function updateCamera(dt) {
  now += dt;
  if (controls.autoRotate) takeOver(); // Spin is the visitor's own camera move
  const c = followed();
  focusBlend += ((c ? 1 : 0) - focusBlend) * Math.min(1, dt * 3);
  // The director keeps working out its shot even in first person, so its
  // roaming camera is somewhere sensible when it gets the camera back.
  const shot = directorOn ? director.update(sceneNow(), dt) : null;
  if (updatePov(dt)) { showCamera(); return; }

  if (shot && now >= handsOffUntil) {
    // Taking the camera back from the visitor is a glide too, not a jump.
    if (!directing && lastCut >= 0) { settleUntil = now + 4; lastCut = shot.cut; }
    const cut = shot.cut !== lastCut;
    directing = true;
    lastCut = shot.cut;
    const k = cut ? 1 : 1 - Math.exp(-dt * (now < settleUntil ? Math.min(shot.ease, 0.9) : shot.ease));
    camera.position.lerp(tmp.set(shot.pos.x, shot.pos.y, shot.pos.z), k);
    lookAt.lerp(tmp2.set(shot.target.x, shot.target.y, shot.target.z), k);
    camera.fov += (shot.fov - camera.fov) * k;
    camera.updateProjectionMatrix();
    camera.lookAt(lookAt);
  } else {
    handOver();
    // By hand: look at the followed character, or the middle of the room.
    if (c) {
      const p = insetPoint(c.pos.x, c.pos.y, bounds);
      tmp.set(p.x, c.type === 'ghost' ? 0.6 : 1.0, p.z);
    }
    controls.target.lerp(c ? tmp : INSIDE.home, Math.min(1, dt * (c ? 3 : 0.6)));
    if (Math.abs(camera.fov - baseFov()) > 0.05) {
      camera.fov += (baseFov() - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }
  }
  showCamera();
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (!directing && !inPov) camera.fov = baseFov();
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
{
  let stored = null;
  try { stored = localStorage.getItem(DIRECTOR_KEY); } catch { /* private mode */ }
  setDirector((params.get('director') || stored || 'on') !== 'off', { remember: false });
  controls.update(0);
  // First person starts only when asked for in the address: ?pov=jazz.
  // (An unknown name gets the default eyes rather than nobody's.)
  if (params.has('pov')) {
    const who = params.get('pov');
    if (cast.some(c => c.type === who)) setFocus(who);
    setPov(true);
  }
}

// ---- Loop ----
const clock = new THREE.Clock();

// One step of the office. `draw` false skips the rendering (fast-forward).
function frame(dt, draw = true) {
  lighting.update(currentPhase(), dt);
  updateCamera(dt);
  controls.update(dt);
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
  if (guest && !guestArt && sim.guestDueIn() < GUEST_ART_LEAD_S) loadGuestArt();
  showEvents();
  props.update(sim.state, sim.time, dt);
  party.update(partyOn, sim.time, dt, sound.enabled && sound.musicWanted ? sound.beat() : null);
  showMusic();
  stage.update(sim.state.show, sim.time, dt, sound.enabled && sound.musicWanted ? sound.beat() : null);
  const show = sim.state.show;
  if (!logPanel.hidden) daylog.seen();
  for (const c of cast) {
    c.standee.setOpacity(c.opacity);
    c.standee.setProp(carry.update(c, sim.time, { partyOn, printerJammed: sim.state.printerJammed }));
    // Reset an absent character too, otherwise a dancer who leaves during a
    // party could reappear still flagged as dancing after the mode changes.
    c.standee.setDancing(partyOn && c.present && c.speed <= 0.15);
    c.standee.setAct(show?.acts[c.type] ?? null, { playing: show?.beat === 'play' });
    c.standee.setWild(Boolean(show && SHOWS[show.key].roles[c.type]?.wild));
    if (!c.present) continue;
    c.standee.root.position.set(c.pos.x, 0, c.pos.y);
    c.standee.heading = c.heading;
    // Party mode turns stationary characters into dancers. Walkers keep the
    // ordinary gait so the dance frames never make a moving standee skate.
    c.standee.update(sim.time, dt, c.speed, camera);
  }
  if (povHidden) povHidden.standee.root.visible = false; // seen from inside, their own cutout would fill the view
  bubbles.sync();
  if (!draw) return;
  renderer.render(scene, camera);
  outline.render(scene, camera);
  bubbles.place(camera, inPov ? povHidden : null);
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
      partyOn && 'there is a party: the lights are low, a disco ball is turning and the boombox is loud',
      showKey && SHOWS[showKey].chatContext,
    ].filter(Boolean).join('; ');
    const recent = daylog.recent(4).join(' ');
    return [`Time of day: ${clockPhase()}.`, `In the room: ${here}.`, now && `Right now: ${now}.`, recent && `Earlier today: ${recent}`]
      .filter(Boolean).join(' ').slice(0, 600);
  },
  onOpenChange(open) {
    margo.talkingToVisitor = open;
    sound.duck(open ? 0.3 : 1);   // the boombox goes down while Margo is being listened to
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
    // (Not the one whose eyes the camera is in: their hidden cutout is right behind it.)
    const roots = cast.filter(c => c.present && c !== povHidden).map(c => c.standee.root);
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
firstArt.then(() => document.getElementById('loading')?.remove());

// Debug / test hook.
window.__office = {
  partyReady,
  scene, camera, controls, cast, nav, sim, daylog, sound, tapGlass, spots: sim.spots, setPhase, setFocus, setDirector,
  outline, director, get directing() { return directing; }, get shot() { return director.shot; },
  party, setParty, get partyOn() { return partyOn; },
  stage, setShow, get show() { return showKey; },
  setPov, get pov() { return inPov; }, get eyes() { return povHidden?.type ?? null; },
  say: sim.say, margoChat, haunt: sim.haunt,
  // Fast-forward: simulate every frame, draw only the last one.
  step(seconds, fps = 30) { const n = Math.round(seconds * fps); for (let i = 1; i <= n; i++) frame(1 / fps, i === n); },
  ready: true,
};
