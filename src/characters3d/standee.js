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
// - Walk frames: humans [walk1, idle, walk3, idle], the ghost walk1-4,
//   one cycle per 800 ms. Margo is different: she is a jointed paper
//   puppet (MARGO_RIG) whose arms and legs swing about their joints.
// - The card casts a shadow shaped like its silhouette.

import * as THREE from 'three';

const SPRITE_ROOT = 'assets/sprites/zine';
const VIEWS = ['front', 'threequarter', 'back'];

// Frames are 640x960. The paper base of every drawing sits 52 px above the
// frame bottom and humans are 863 px tall from base to top.
const FRAME_W = 640, FRAME_H = 960, BASE_PX = 52;
const HUMAN_HEIGHT_M = 1.62;
const PX = HUMAN_HEIGHT_M / 863; // metres per sprite pixel
const SCALE = { andy: 1, jazz: 1, olex: 1, ghost: 0.72, margo: 1 }; // ghost scale from js/data.js

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
  return `${SPRITE_ROOT}/${type}/${view}_${frame}.webp`;
}

function frameNames(type) {
  return type === 'ghost' ? ['walk_01', 'walk_02', 'walk_03', 'walk_04'] : ['walk_01', 'idle', 'walk_03', 'idle'];
}

// ---- Margo's jointed puppet ----
// Margo is drawn as a mannequin with ball joints, so instead of cutting
// between stride drawings she is assembled from pieces of her idle frames
// (tools/rig-margo.py) that swing about their joints while she walks:
// legs from the hip (the skirt hides the cut), the shin from the knee in
// profile, arms from the shoulder. Pivots are frame pixels, origin top
// left; swing/bend in degrees; lift is how much a limb foreshortens when
// it comes toward the viewer; z is the layer order in millimetres: the
// plate (the whole drawing, limbs painted over) at the back, then limbs,
// then the body with holes where the limbs swing behind it.
const RIG_VIEW = { front: 'front', threequarter: 'side', back: 'back' };
const MARGO_RIG = {
  front: [
    { piece: 'plate', z: -2.1 }, { piece: 'body', z: 0 },
    { piece: 'leg_l', pivot: [292, 668], z: -0.7, phase: 0, swing: 4, lift: 0.14 },
    { piece: 'leg_r', pivot: [352, 668], z: -0.7, phase: Math.PI, swing: -4, lift: 0.14 },
    { piece: 'arm_l', pivot: [241, 330], z: -0.7, phase: Math.PI, swing: -10, lift: 0.12 },
    { piece: 'arm_r', pivot: [399, 330], z: -0.7, phase: 0, swing: 10, lift: 0.12 },
  ],
  back: [
    { piece: 'plate', z: -2.1 }, { piece: 'body', z: 0 },
    { piece: 'leg_l', pivot: [272, 665], z: -0.7, phase: Math.PI, swing: 4, lift: 0.14 },
    { piece: 'leg_r', pivot: [336, 665], z: -0.7, phase: 0, swing: -4, lift: 0.14 },
    { piece: 'arm_l', pivot: [236, 308], z: -0.7, phase: 0, swing: -10, lift: 0.12 },
    { piece: 'arm_r', pivot: [370, 308], z: -0.7, phase: Math.PI, swing: 10, lift: 0.12 },
  ],
  side: [
    { piece: 'plate', z: -2.1 }, { piece: 'body', z: 0 },
    { piece: 'thigh', pivot: [345, 682], z: -1.4, phase: Math.PI, swing: 26, shade: 0.8, knee: { piece: 'shin', pivot: [348, 706], bend: 38 } },
    { piece: 'thigh', pivot: [345, 682], z: -0.7, phase: 0, swing: 26, knee: { piece: 'shin', pivot: [348, 706], bend: 38 } },
    { piece: 'arm', pivot: [333, 335], z: 0.7, phase: Math.PI, swing: 22 },
  ],
};
const RIG_BOARD_OFFSET = 0.003; // the kraft layers sit behind the plate

// ---- Textures ----

const loader = new THREE.TextureLoader();
function loadTexture(url) {
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function loadSet(type, resolve) {
  const set = {};
  const names = new Set(['idle', ...frameNames(type)]);
  for (const view of VIEWS) {
    set[view] = {};
    for (const name of names) set[view][name] = loadTexture(resolve(type, view, name));
  }
  return set;
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

export function createStandee(type, { resolve = spriteUrl } = {}) {
  const rig = type === 'margo' ? MARGO_RIG : null;
  const textures = rig ? null : loadSet(type, resolve);
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

  let front = null;
  const puppets = {};
  if (!rig) {
    front = printed(textures.front.idle);
    art.add(front);
    board(art, textures.front.idle);
  } else {
    // Joint position in card space: x from the frame centre, y from the paper base.
    const joint = ([px, py]) => [(px - FRAME_W / 2) * PX * scale, (FRAME_H - BASE_PX - py) * PX * scale];
    const pieceTexture = name => loadTexture(`${SPRITE_ROOT}/${type}/rig/${name}.webp`);
    for (const [view, parts] of Object.entries(rig)) {
      const group = new THREE.Group();
      group.visible = view === 'front';
      art.add(group);
      const limbs = [];
      for (const part of parts) {
        const tex = pieceTexture(`${view}_${part.piece}`);
        if (!part.pivot) {
          const plate = printed(tex);
          plate.position.z = part.z / 1000;
          group.add(plate);
          if (part.piece === 'plate') board(group, tex, RIG_BOARD_OFFSET);
          continue;
        }
        const [jx, jy] = joint(part.pivot);
        const limb = new THREE.Group();
        limb.position.set(jx, jy, part.z / 1000);
        const mesh = printed(tex, part.shade);
        mesh.position.set(-jx, -jy, 0);
        limb.add(mesh);
        group.add(limb);
        let knee = null;
        if (part.knee) {
          const [kx, ky] = joint(part.knee.pivot);
          knee = new THREE.Group();
          knee.position.set(kx - jx, ky - jy, -0.0002);
          const shin = printed(pieceTexture(`${view}_${part.knee.piece}`), part.shade);
          shin.position.set(-kx, -ky, 0);
          knee.add(shin);
          limb.add(knee);
        }
        limbs.push({ part, limb, knee });
      }
      puppets[view] = { group, limbs };
    }
  }

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

  const api = {
    type, root, heading: 0,
    get view() { return state.view; },
    // Multiply the artwork by a colour (time-of-day light). White = as drawn.
    // Fade the whole cutout (the ghost materialising and dissolving).
    setOpacity(a) {
      state.opacity = a;
      for (const m of [...fronts, ...layers]) {
        m.material.transparent = a < 1;
        m.material.opacity = a;
        m.material.needsUpdate = true;
      }
      root.visible = a > 0;
    },
    setTint(color) {
      for (const m of fronts) m.material.color.copy(color).multiplyScalar(m.userData.shade);
      for (const l of layers) l.material.color.copy(l.rotation.y ? KRAFT_COLOR : KRAFT_EDGE_COLOR).multiply(color);
    },
    get mirrored() { return state.mirror; },
    update(time, dt, speed, camera) {
      state.speed += (speed - state.speed) * Math.min(1, dt * 8);
      const k = state.speed;

      // Face the camera (yaw only).
      const toCam = new THREE.Vector2(camera.position.x - root.position.x, camera.position.z - root.position.z);
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
      if (rig) {
        // Show this view's puppet and swing its limbs with the gait.
        const active = RIG_VIEW[state.view];
        for (const [view, puppet] of Object.entries(puppets)) puppet.group.visible = view === active;
        for (const { part, limb, knee } of puppets[active].limbs) {
          const ph = p + part.phase;
          const s = Math.sin(ph);
          limb.rotation.z = THREE.MathUtils.degToRad(part.swing) * s * k;
          limb.scale.y = 1 - (part.lift || 0) * Math.max(0, s) * k;
          if (knee) knee.rotation.z = -THREE.MathUtils.degToRad(part.knee.bend) * Math.max(0, Math.cos(ph)) * k;
        }
      } else {
        const names = frameNames(type);
        const walking = k > 0.15;
        const frame = walking ? names[Math.floor((state.gait / STEP_CYCLE_S) * names.length) % names.length] : 'idle';
        const tex = textures[state.view][frame];
        if (front.material.map !== tex) {
          front.material.map = tex;
          front.customDepthMaterial.map = tex;
          for (const l of layers) l.material.map = tex;
        }
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
  return api;
}

function pickView(current, toward) {
  const front = current === 'front' ? FRONT_CONE - HYSTERESIS : FRONT_CONE + HYSTERESIS;
  const back = current === 'back' ? -(FRONT_CONE - HYSTERESIS) : -(FRONT_CONE + HYSTERESIS);
  if (toward > front) return 'front';
  if (toward < back) return 'back';
  return 'threequarter';
}
