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
  return `${SPRITE_ROOT}/${folder}/${view}_${frame}.webp?v=detail-1`;
}

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
  function loadFrames(frames) {
    const pending = [];
    for (const view of VIEWS) for (const name of frames) {
      textures[view][name] ??= loadTexture(resolve(type, view, name));
      pending.push(textures[view][name].done);
    }
    return Promise.all(pending);
  }
  let idleLoad, walkLoad;
  const loadIdle = () => (idleLoad ??= loadFrames(['idle']));
  const loadWalk = () => (walkLoad ??= loadFrames(walkNames));
  // The drawing to show: the wanted frame, else the view's idle, else nothing new.
  const ready = (view, frame) => {
    const entry = textures[view][frame];
    if (entry?.ready) return entry.tex;
    const idle = textures[view].idle;
    return idle?.ready ? idle.tex : null;
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
    seed: Math.random() * 10, speed: 0, opacity: 1,
  };

  const toCam = new THREE.Vector2();
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
    loadIdle, loadWalk,
    load: () => loadIdle().then(loadWalk),
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

      // Pick the drawing from heading vs camera, with hysteresis.
      const fx = Math.sin(api.heading), fz = Math.cos(api.heading);
      toCam.normalize();
      const toward = fx * toCam.x + fz * toCam.y;           // +1 facing camera
      const rightward = fx * toCam.y - fz * toCam.x;        // + = screen right
      const want = pickView(state.view, toward);
      const wantMirror = want === 'threequarter' && rightward < 0;
      if (want !== state.view || wantMirror !== state.mirror) {
        if (!state.pending || state.pending.view !== want || state.pending.mirror !== wantMirror) {
          state.pending = { view: want, mirror: wantMirror };
          if (state.flip >= 1) state.flip = 0;
        }
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

      // Walk cycle at one step every 800 ms; idle drawing when still.
      state.gait += dt * Math.min(1, k * 1.5);
      const p = (state.gait / STEP_CYCLE_S) * Math.PI * 2;
      const walking = k > 0.15;
      const frame = walking ? names[Math.floor((state.gait / STEP_CYCLE_S) * names.length) % names.length] : 'idle';
      const tex = ready(state.view, frame);
      if (tex && front.material.map !== tex) {
        front.material.map = tex;
        front.customDepthMaterial.map = tex;
        for (const l of layers) l.material.map = tex;
      }

      // Paper hop and wobble while walking; slow breathing at rest.
      const bob = type === 'ghost'
        ? 0.04 + Math.sin(time * 1.6 + state.seed) * 0.03
        : Math.abs(Math.sin(p)) * 0.025 * k;
      card.position.y = bob;
      card.rotation.z = Math.sin(p) * THREE.MathUtils.degToRad(1.6) * k
        + Math.sin(time * 0.9 + state.seed) * THREE.MathUtils.degToRad(0.4) * (1 - k);
      card.scale.y = 1 + Math.sin(time * 2.1 + state.seed) * 0.005 * (1 - k);
      blob.material.opacity = (type === 'ghost' ? 0.7 - bob * 4 : 1) * state.opacity;
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
