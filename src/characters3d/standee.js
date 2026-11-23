// ---- Cardboard standees ----
// Each character is their original zine sprite printed on a cardboard
// cut-out that stands in the 3D room. The artwork is shown unlit and
// unchanged; only the card moves.
//
//   const andy = createStandee('andy');
//   scene.add(andy.root);
//   andy.heading = Math.PI / 2;               // direction the character faces
//   andy.update(time, dt, speed, camera);     // speed 0 idle .. 1 walking
//
// How it works:
// - The card turns about its vertical axis to face the camera (it never
//   tilts, so it stays planted on the floor).
// - Which drawing is shown depends on the character's heading relative to
//   the camera: walking toward you = front, away = back, otherwise the
//   three-quarter view, mirrored when they face left. (The side-profile
//   frames are not used: their walk poses barely differ.)
// - Changing view flips the card over like a real cut-out, showing its
//   kraft-board back and edge for a moment.
// - Walk frames: humans (including Margo) [walk1, idle, walk3, idle],
//   the ghost walk1-4, one cycle per 800 ms.
// - Party frames: an eight-frame front/back dance loop at 124 BPM. Dance
//   frames are loaded lazily, and the idle front/back drawings remain the
//   fallbacks while they arrive (or if a frame is unavailable).
// - Show acts (ACT_LOOPS, e.g. the garage band): an eight-frame front/back
//   loop set with setAct(name). An act beats the dance, which beats a carried
//   prop, which beats walk/idle. It shows only while the character stands
//   still, picks front or back by heading (never mirrored, no spin), and
//   falls through to the next drawing while its art is missing or loading.
// - The card casts a shadow shaped like its silhouette.
// - Art loads in two stages: the idle drawings first, the walk frames after.
//   Until a walk frame arrives the card shows the idle drawing instead.
//   createStandee(type, { autoLoad: false }) loads nothing until loadIdle(),
//   loadWalk() or load() is called (the office defers the ghost this way).

import * as THREE from 'three';

const SPRITE_ROOT = 'assets/sprites/zine';
const VIEWS = ['front', 'threequarter', 'back'];

// Restored art is 1280x1920 (2x density), from detailed per-view sources.
// Geometry stays in logical 640x960
// units: paper base 52 above the bottom, humans 863 from base to top.
const FRAME_W = 640, FRAME_H = 960, BASE_PX = 52;
const HUMAN_HEIGHT_M = 1.62;
const PX = HUMAN_HEIGHT_M / 863; // metres per sprite pixel
const SCALE = { andy: 1, jazz: 1, olex: 1, ghost: 0.72, margo: 1 };

const STEP_CYCLE_S = 0.8;
const DANCE_BPM = 124;
const DANCE_BEAT_S = 60 / DANCE_BPM;
const DANCE_FRAMES = [
  'dance_01', 'dance_02', 'dance_03', 'dance_04',
  'dance_05', 'dance_06', 'dance_07', 'dance_08',
];
const DANCE_CYCLE_BEATS = 4;
const DANCE_FRAME_S = DANCE_BEAT_S * DANCE_CYCLE_BEATS / DANCE_FRAMES.length;
const PROP_FRAMES = ['coffee', 'printouts'];
export const ACT_LOOPS = {
  band: {
    frames: ['band_01', 'band_02', 'band_03', 'band_04', 'band_05', 'band_06', 'band_07', 'band_08'],
    bpm: 132, cycleBeats: 4, views: ['front', 'back'], revision: 'band-1',
  },
};
const ACT_BOB_M = 0.012;
const FRONT_CONE = Math.cos(THREE.MathUtils.degToRad(38));
const HYSTERESIS = 0.08;
const FLIP_S = 0.22;
const BOARD = 0.004;         // cardboard thickness (m)
const KRAFT = 0xc7a477;
const KRAFT_EDGE = 0xa98457;
const KRAFT_COLOR = new THREE.Color(KRAFT);
const KRAFT_EDGE_COLOR = new THREE.Color(KRAFT_EDGE);

export const STANDEE_TYPES = ['andy', 'jazz', 'olex', 'ghost', 'margo'];

export function spriteUrl(type, view, frame) {
  const folder = type === 'margo' ? 'margo-v3' : type;
  const act = Object.values(ACT_LOOPS).find(loop => loop.frames.includes(frame));
  const revision = frame.startsWith('dance_') ? 'dance-3'
    : PROP_FRAMES.includes(frame) ? 'prop-1'
    : act ? act.revision
    : 'detail-1';
  return `${SPRITE_ROOT}/${folder}/${view}_${frame}.webp?v=${revision}`;
}

export function danceMotion(beat) {
  const phase = ((beat % 4) + 4) % 4;
  const flight = (phase % 2) / 0.7;
  const progress = Math.max(0, (phase - 2) / 2);
  return {
    jump: flight < 1 ? 0.22 * 4 * flight * (1 - flight) : 0,
    turn: progress * progress * (3 - 2 * progress) * Math.PI * 2,
  };
}

// Frame clock shared by the dance and the show acts: a loop of frames that
// spans a whole number of beats.
function beatLoop(frames, bpm, cycleBeats) {
  const beatS = 60 / bpm;
  const cycleS = beatS * cycleBeats;
  return { frames, beatS, cycleS, frameS: cycleS / frames.length };
}
const DANCE_LOOP = {
  frames: DANCE_FRAMES, beatS: DANCE_BEAT_S, cycleS: DANCE_BEAT_S * DANCE_CYCLE_BEATS, frameS: DANCE_FRAME_S,
};
const ACT_TIMING = Object.fromEntries(Object.entries(ACT_LOOPS)
  .map(([name, act]) => [name, beatLoop(act.frames, act.bpm, act.cycleBeats)]));
const advanceLoop = (loop, clock, dt) => (clock + dt) % loop.cycleS;
const loopFrame = (loop, clock) => loop.frames[Math.floor(clock / loop.frameS) % loop.frames.length];

function frameNames(type) {
  return type === 'ghost'
    ? ['walk_01', 'walk_02', 'walk_03', 'walk_04']
    : ['walk_01', 'idle', 'walk_03', 'idle'];
}

// ---- Textures ----

// One texture per image URL, shared by every standee that shows it.
// `ready` turns true once the image has arrived; `done` settles either way.
const loader = new THREE.TextureLoader();
const textureCache = new Map();
function loadTexture(url) {
  let entry = textureCache.get(url);
  if (!entry) {
    entry = { tex: null, ready: false, done: null };
    entry.done = new Promise(resolve => {
      entry.tex = loader.load(url, () => { entry.ready = true; resolve(); }, undefined, resolve);
    });
    entry.tex.colorSpace = THREE.SRGBColorSpace;
    entry.tex.anisotropy = 8;
    textureCache.set(url, entry);
  }
  return entry;
}

// A 1x1 see-through texture: what a card shows before its art arrives.
let blankTexture;
function blank() {
  if (!blankTexture) {
    blankTexture = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
    blankTexture.needsUpdate = true;
  }
  return blankTexture;
}

// A flat colour that takes only its alpha from the sprite, for the
// cardboard back and edge layers.
function boardMaterial(color, map) {
  const mat = new THREE.MeshBasicMaterial({ color, map, alphaTest: 0.5 });
  mat.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      'diffuseColor.a *= texture2D( map, vMapUv ).a;'
    );
  };
  mat.customProgramCacheKey = () => 'standee-board';
  return mat;
}

let blobTexture;
function contactShadowTexture() {
  if (!blobTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(60,45,30,0.55)');
    grad.addColorStop(1, 'rgba(60,45,30,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    blobTexture = new THREE.CanvasTexture(c);
  }
  return blobTexture;
}

// ---- Standee ----

export function createStandee(type, { resolve = spriteUrl, autoLoad = true } = {}) {
  const names = frameNames(type);
  const walkNames = [...new Set(names)].filter(name => name !== 'idle');
  const textures = {};              // view -> frame name -> cache entry, filled as stages load
  for (const view of VIEWS) textures[view] = {};
  function loadFrames(frames, views = VIEWS) {
    const pending = [];
    for (const view of views) for (const name of frames) {
      textures[view][name] ??= loadTexture(resolve(type, view, name));
      pending.push(textures[view][name].done);
    }
    return Promise.all(pending);
  }
  let idleLoad, walkLoad;
  let danceLoad;
  const propLoads = new Map();
  const actLoads = new Map();
  // The front standing drawing alone is enough to put a character on screen;
  // ready() shows it in place of a side or back drawing that has not arrived.
  let firstLoad;
  const loadFirst = () => (firstLoad ??= loadFrames(['idle'], ['front']));
  const loadIdle = () => (idleLoad ??= loadFrames(['idle']));
  const loadWalk = () => (walkLoad ??= loadFrames(walkNames));
  // Dance artwork is a paired front/back loop. Keeping this request separate
  // means normal office viewing never pays for frames used only during a party.
  // Load the idle back as part of this promise too, so an autoLoad:false
  // standee never exposes a blank rear face while dance art is arriving.
  const loadDance = () => (danceLoad ??= Promise.all([
    loadFrames(DANCE_FRAMES, ['front', 'back']),
    loadFrames(['idle'], ['back']),
  ]));
  const loadProp = prop => {
    if (type === 'ghost' || !PROP_FRAMES.includes(prop)) return Promise.resolve(false);
    let pending = propLoads.get(prop);
    if (!pending) {
      pending = loadFrames([prop]).then(() => true);
      propLoads.set(prop, pending);
    }
    return pending;
  };
  // An act is a paired front/back loop like the dance, fetched only when a
  // show asks for it. The ghost has no act art and requests none.
  const actFor = name => (type === 'ghost' || !Object.hasOwn(ACT_LOOPS, name) ? null : ACT_LOOPS[name]);
  const loadAct = name => {
    const act = actFor(name);
    if (!act) return Promise.resolve();
    let pending = actLoads.get(name);
    if (!pending) {
      pending = Promise.all([loadFrames(act.frames, act.views), loadFrames(['idle'], act.views)]).then(() => {});
      actLoads.set(name, pending);
    }
    return pending;
  };
  // The drawing to show: the wanted frame, else the view's idle, else the
  // front idle (the first drawing to arrive), else nothing new.
  const ready = (view, frame) => {
    const entry = textures[view][frame];
    if (entry?.ready) return entry.tex;
    const idle = textures[view].idle;
    if (idle?.ready) return idle.tex;
    const first = textures.front.idle;
    return first?.ready ? first.tex : null;
  };

  const scale = SCALE[type];
  const w = FRAME_W * PX * scale, h = FRAME_H * PX * scale;

  const root = new THREE.Group();   // placed in the world, never rotated
  root.name = type;
  const turn = new THREE.Group();   // faces the camera
  root.add(turn);
  const card = new THREE.Group();   // flips, hops and wobbles
  turn.add(card);
  const art = new THREE.Group();    // mirrored for left-facing views
  card.add(art);

  // Card plane with its pivot at the paper base.
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2 - BASE_PX * PX * scale, 0);

  const fronts = [];  // every printed face, for tint and opacity
  const layers = [];  // kraft edges and backs
  function printed(tex, shade = 1) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, toneMapped: false }));
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
    m.castShadow = true;
    m.userData.shade = shade;
    fronts.push(m);
    return m;
  }
  // Cardboard thickness: edge layers then a kraft back.
  function board(parent, tex, offset = 0) {
    for (let i = 1; i <= 3; i++) {
      const back = i === 3;
      const m = new THREE.Mesh(geo, boardMaterial(back ? KRAFT : KRAFT_EDGE, tex));
      m.position.z = -BOARD * (i / 3) - offset;
      if (back) m.rotation.y = Math.PI; // faces backward
      parent.add(m);
      layers.push(m);
    }
  }

  const front = printed(blank());
  art.add(front);
  board(art, blank());
  const rear = printed(blank());
  rear.name = 'dance-back';
  rear.rotation.y = Math.PI;
  rear.position.z = -BOARD - 0.001;
  rear.visible = false;
  art.add(rear);

  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.006;
  blob.scale.set(0.62 * scale + (type === 'ghost' ? 0.15 : 0), 0.34 * scale, 1);
  root.add(blob);

  const state = {
    view: 'front', mirror: false, frame: 'idle',
    flip: 1, pending: null, gait: Math.random() * STEP_CYCLE_S,
    danceClock: 0, dancing: false, prop: null,
    act: null, actPlaying: true, actClock: 0,
    seed: Math.random() * 10, speed: 0, opacity: 1,
  };

  const toCam = new THREE.Vector2();
  root.userData.dancing = false;
  root.userData.frame = 'idle';
  root.userData.prop = null;
  root.userData.act = null;
  // Leave the cut-out in a neutral pose. The next update can then pick the
  // appropriate walking/three-quarter/back drawing again.
  function restPose() {
    state.frame = 'idle';
    root.userData.frame = 'idle';
    card.position.y = 0;
    card.rotation.y = 0;
    card.rotation.z = 0;
    card.scale.y = 1;
    art.scale.x = 1;
    rear.visible = false;
    for (const layer of layers) layer.visible = true;
  }
  const api = {
    type, root, heading: 0,
    get view() { return state.view; },
    // Multiply the artwork by a colour (time-of-day light). White = as drawn.
    // Fade the whole cutout (the ghost materialising and dissolving).
    setOpacity(a) {
      if (a === state.opacity) return;
      state.opacity = a;
      const transparent = a < 1;
      for (const list of [fronts, layers]) for (const m of list) {
        m.material.opacity = a;
        // Recompile only when the card switches between solid and see-through.
        if (m.material.transparent !== transparent) {
          m.material.transparent = transparent;
          m.material.needsUpdate = true;
        }
      }
      root.visible = a > 0;
    },
    // Staged loading. Each returns a promise that settles when its frames
    // have arrived (or failed); calling again returns the same promise.
    loadFirst, loadIdle, loadWalk, loadDance, loadProp, loadAct,
    load: () => loadIdle().then(loadWalk),
    setProp(value) {
      const prop = type === 'ghost' || !PROP_FRAMES.includes(value) ? null : value;
      state.prop = prop;
      root.userData.prop = prop;
      if (prop) loadProp(prop);
      return prop;
    },
    get prop() { return state.prop; },
    setDancing(on) {
      const dancing = Boolean(on);
      if (state.dancing === dancing) return;
      state.dancing = dancing;
      root.userData.dancing = dancing;
      if (dancing) {
        state.danceClock = 0;
        state.view = 'front';
        state.mirror = false;
        state.pending = null;
        state.flip = 1;
        loadDance();
        rear.visible = true;
        // Keep the kraft silhouette until the back idle/dance texture is
        // ready. This closes the one-frame loading gap instead of exposing
        // the transparent placeholder plane.
        for (const layer of layers) layer.visible = true;
      } else {
        state.danceClock = 0;
        restPose();
      }
    },
    get dancing() { return state.dancing; },
    // Play a show act (a name from ACT_LOOPS), or null to stop. Paused acts
    // hold their first frame. Returns the act now set.
    setAct(name, { playing = true } = {}) {
      const act = actFor(name) ? name : null;
      state.actPlaying = Boolean(playing);
      if (state.act === act) return act;
      state.act = act;
      state.actClock = 0;
      root.userData.act = act;
      if (act) loadAct(act);
      else restPose();
      return act;
    },
    get act() { return state.act; },
    get frame() { return state.frame; },
    setTint(color) {
      for (const m of fronts) m.material.color.copy(color).multiplyScalar(m.userData.shade);
      for (const l of layers) l.material.color.copy(l.rotation.y ? KRAFT_COLOR : KRAFT_EDGE_COLOR).multiply(color);
    },
    get mirrored() { return state.mirror; },
    update(time, dt, speed, camera) {
      state.speed += (speed - state.speed) * Math.min(1, dt * 8);
      const k = state.speed;

      // Face the camera (yaw only).
      toCam.set(camera.position.x - root.position.x, camera.position.z - root.position.z);
      const camYaw = Math.atan2(toCam.x, toCam.y);
      turn.rotation.y = camYaw;

      // Pick the drawing from heading vs camera, with hysteresis. Dance art
      // is a paired front/back loop and deliberately never mirrors, so the
      // characters keep their printed characteristics while they spin.
      const fx = Math.sin(api.heading), fz = Math.cos(api.heading);
      toCam.normalize();
      const toward = fx * toCam.x + fz * toCam.y;           // +1 facing camera
      const rightward = fx * toCam.y - fz * toCam.x;        // + = screen right
      const walking = state.speed > 0.15;
      // A standing act takes the card when the art for its view is ready;
      // otherwise the next priority (dance, prop, idle) is drawn instead.
      const actLoop = state.act && !walking ? ACT_TIMING[state.act] : null;
      if (actLoop && state.actPlaying) state.actClock = advanceLoop(actLoop, state.actClock, dt);
      const actFrame = actLoop ? (state.actPlaying ? loopFrame(actLoop, state.actClock) : actLoop.frames[0]) : null;
      const actView = actLoop ? pickActView(state.view, toward) : null;
      const acting = Boolean(actLoop && textures[actView][actFrame]?.ready);
      const activeDance = state.dancing && !walking && !acting;
      const want = acting ? actView : activeDance ? 'front' : pickView(state.view, toward);
      const wantMirror = acting || activeDance ? false : want === 'threequarter' && rightward < 0;
      if (want !== state.view || wantMirror !== state.mirror) {
        if (!state.pending || state.pending.view !== want || state.pending.mirror !== wantMirror) {
          state.pending = { view: want, mirror: wantMirror };
        }
        // Start a flip whenever none is running. (A change asked for in the
        // second half of a flip comes too late for that flip's swap: it
        // needs a flip of its own, or the card keeps the old drawing.)
        if (state.flip >= 1) state.flip = 0;
      } else if (state.pending && state.flip < 0.5) {
        state.pending = null; // changed its mind before the swap: flip back
      }

      // Card flip: rotate to edge-on, swap the drawing, rotate back.
      if (state.flip < 1) {
        const before = state.flip < 0.5;
        state.flip = Math.min(1, state.flip + dt / FLIP_S);
        if (before && state.flip >= 0.5 && state.pending) {
          state.view = state.pending.view;
          state.mirror = state.pending.mirror;
          state.pending = null;
        }
      }
      const f = state.flip;
      card.rotation.y = f < 1 ? (f < 0.5 ? f : f - 1) * Math.PI * (state.mirror ? -1 : 1) : 0;
      art.scale.x = state.mirror ? -1 : 1;

      // Dance is four beats at 124 BPM. A stationary character gets the loop;
      // moving characters continue using the normal walk cycle so their card
      // does not skate across the floor while it dances.
      state.gait += dt * Math.min(1, k * 1.5);
      const p = (state.gait / STEP_CYCLE_S) * Math.PI * 2;
      if (activeDance) state.danceClock = advanceLoop(DANCE_LOOP, state.danceClock, dt);
      const normalFrame = acting ? actFrame
        : activeDance ? loopFrame(DANCE_LOOP, state.danceClock)
        : walking ? names[Math.floor((state.gait / STEP_CYCLE_S) * names.length) % names.length] : 'idle';
      const propEntry = !acting && !activeDance && state.prop ? textures[state.view][state.prop] : null;
      const propTexture = propEntry?.ready ? propEntry.tex : null;
      const frame = propTexture ? state.prop : normalFrame;
      state.frame = frame;
      root.userData.frame = frame;
      const tex = propTexture || ready(activeDance ? 'front' : state.view, normalFrame);
      if (tex && front.material.map !== tex) {
        front.material.map = tex;
        front.customDepthMaterial.map = tex;
        for (const l of layers) l.material.map = tex;
      }
      let rearReady = false;
      if (activeDance) {
        const backTex = ready('back', frame);
        rearReady = Boolean(backTex);
        rear.visible = rearReady;
        if (backTex && rear.material.map !== backTex) {
          rear.material.map = backTex;
          rear.customDepthMaterial.map = backTex;
        }
        for (const layer of layers) layer.visible = Boolean(!backTex);
      } else {
        // A dancer can be sent back to a destination while Party is still on.
        // Do not leave the dance rear face or hidden cardboard on a walker.
        rear.visible = false;
        for (const layer of layers) layer.visible = true;
      }

      // Paper hop and wobble while walking; slow breathing at rest.
      const dancePhase = state.danceClock / DANCE_BEAT_S * Math.PI * 2;
      const motion = danceMotion(state.danceClock / DANCE_BEAT_S);
      // Do not expose unprinted cardboard while rear artwork is loading.
      if (activeDance) card.rotation.y = rearReady ? motion.turn : 0;
      // An act bobs once a beat and otherwise stands square; a paused act is still.
      const actBob = acting && state.actPlaying
        ? Math.abs(Math.sin(state.actClock / actLoop.beatS * Math.PI)) * ACT_BOB_M : 0;
      const bob = acting ? actBob
        : activeDance
        ? motion.jump + Math.abs(Math.sin(dancePhase)) * 0.018
        : type === 'ghost'
        ? 0.04 + Math.sin(time * 1.6 + state.seed) * 0.03
        : Math.abs(Math.sin(p)) * 0.025 * k;
      card.position.y = bob;
      card.rotation.z = acting ? 0
        : activeDance
        ? Math.sin(dancePhase) * THREE.MathUtils.degToRad(4)
        : Math.sin(p) * THREE.MathUtils.degToRad(1.6) * k
        + Math.sin(time * 0.9 + state.seed) * THREE.MathUtils.degToRad(0.4) * (1 - k);
      card.scale.y = acting ? 1
        : activeDance
        ? 1 + Math.sin(dancePhase * 2) * 0.012
        : 1 + Math.sin(time * 2.1 + state.seed) * 0.005 * (1 - k);
      blob.material.opacity = Math.max(0.12, type === 'ghost' ? 0.7 - bob * 4 : 1 - bob * 2) * state.opacity;
    },
  };
  if (autoLoad) api.load();
  return api;
}

function pickView(current, toward) {
  const front = current === 'front' ? FRONT_CONE - HYSTERESIS : FRONT_CONE + HYSTERESIS;
  const back = current === 'back' ? -(FRONT_CONE - HYSTERESIS) : -(FRONT_CONE + HYSTERESIS);
  if (toward > front) return 'front';
  if (toward < back) return 'back';
  return 'threequarter';
}

// Acts are drawn front and back only: front while the character faces within
// 90 degrees of the camera, with the same hysteresis as the other views.
function pickActView(current, toward) {
  if (current === 'front') return toward < -HYSTERESIS ? 'back' : 'front';
  if (current === 'back') return toward > HYSTERESIS ? 'front' : 'back';
  return toward >= 0 ? 'front' : 'back';
}
