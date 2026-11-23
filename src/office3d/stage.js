// ---- Stage ----
// The set a show puts up in the middle of the office (SHOWS in data.js): for
// the garage band a drum kit, two amps, a keyboard on an X stand, a mic stand
// and a rug, in the same cut-card style as furniture.js. Two warm spotlights
// wash the band while a show is on; the room look is in lighting.js and the
// music in sound.js.
//
//   const stage = createStage({ scene });
//   stage.update(sim.state.show, time, dt, beat);   // beat 0..1, or null
//   director.look(stage.subject('band'));
//
// A set is built the first time its show is on and kept afterwards. Like the
// party's lights, the spotlights live as long as the page and only change
// intensity: adding or removing a light makes three.js rebuild every shader.
// They cast no shadows (the sun is the only shadow-casting light).

import * as THREE from 'three';
import { C, paper, box, rbox, cyl, rod, patch, ink, canvasTexture, contactShadow } from './materials.js';
import { SHOWS } from './data.js';

const PI = Math.PI;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const chrome = () => paper(0xb8bcc4, { finish: 'metal' });
const brass = () => paper(0xd7b25a, { finish: 'metal' });
const black = () => paper(0x2d2c35, { finish: 'plastic' });

// A soft shadow on the rug under a piece (the rug lies at 0.004 m).
function shade(parent, w, d, opacity) {
  const m = contactShadow(w, d, opacity);
  m.position.y = 0.007;
  parent.add(m);
}

// A three-legged stand foot at (x, z) on the floor under a pole.
function tripod(g, x, z, spread = 0.16, height = 0.22) {
  for (let i = 0; i < 3; i++) {
    const a = i * (PI * 2 / 3) + PI / 6;
    rod(g, v(x, height, z), v(x + Math.cos(a) * spread, 0, z + Math.sin(a) * spread), 0.009, chrome());
  }
}

// A drum: a shell with a white head on top, standing on its own axis (y).
function drum(parent, r, h, [x, y, z], shell, tilt = 0) {
  const d = new THREE.Group();
  d.position.set(x, y, z);
  d.rotation.x = tilt;
  cyl(d, [r, r, h], [0, -h / 2, 0], shell, { edges: 40, hull: 0.006 }, 28);
  cyl(d, [r * 1.02, r * 1.02, 0.014], [0, h / 2 - 0.012, 0], chrome(), { edges: 0, hull: 0 }, 28);
  cyl(d, [r * 0.97, r * 0.97, 0.004], [0, h / 2, 0], paper(C.white), { edges: 0, hull: 0 }, 28);
  parent.add(d);
  return d;
}

// A cymbal: a shallow brass cone with a little bell, on a pole from the floor.
function cymbal(parent, r, [x, y, z], tilt = 0) {
  rod(parent, v(x, 0.2, z), v(x, y, z), 0.009, chrome());
  tripod(parent, x, z);
  const c = new THREE.Group();
  c.position.set(x, y, z);
  c.rotation.x = tilt;
  cyl(c, [0.03, r, 0.018], [0, 0, 0], brass(), { edges: 0, hull: 0.004 }, 24);
  cyl(c, [0.012, 0.03, 0.02], [0, 0.016, 0], brass(), { edges: 0, hull: 0 }, 12);
  parent.add(c);
  return c;
}

// ---- Pieces ----
// Each builder returns { object, ...animated parts }: a group with its origin
// on the floor at the piece's centre, front = +z (toward the default camera).

// Drum kit, about 1.4 m x 0.6 m. The drummer stands behind it (-z), so the
// kit stays low: nothing above 1.1 m, the middle under 0.75 m.
function drumKit() {
  const g = new THREE.Group();
  const shell = paper(C.coral, { finish: 'satin' });
  // Bass drum on its side, the front head to the audience with a band patch.
  const bass = new THREE.Group();
  bass.position.set(0, 0.27, 0.05);
  bass.rotation.x = PI / 2;
  cyl(bass, [0.26, 0.26, 0.36], [0, -0.18, 0], shell, { edges: 40, hull: 0.006 }, 32);
  for (const y of [-0.18, 0.168]) cyl(bass, [0.268, 0.268, 0.012], [0, y, 0], chrome(), { edges: 0, hull: 0 }, 32);
  const head = cyl(bass, [0.25, 0.25, 0.004], [0, 0.18, 0], paper(C.white), { edges: 0, hull: 0 }, 32);
  g.add(bass);
  patch(g, 0.26, 0.12, C.blue, [0, 0.27, 0.235], [0, 0, 0.05], 7);
  for (const x of [-0.2, 0.2]) rod(g, v(x, 0.1, 0.18), v(x * 1.5, 0, 0.26), 0.01, chrome());   // spurs
  // Snare on its stand, to the drummer's left of the bass drum.
  rod(g, v(-0.36, 0.2, -0.14), v(-0.36, 0.5, -0.14), 0.01, chrome());
  tripod(g, -0.36, -0.14);
  drum(g, 0.17, 0.13, [-0.36, 0.56, -0.14], shell, -0.12);
  // Two toms on the bass drum, leaning to the drummer.
  rod(g, v(0, 0.52, 0.02), v(0, 0.6, -0.02), 0.012, chrome());
  drum(g, 0.12, 0.15, [-0.14, 0.64, -0.03], shell, -0.3);
  drum(g, 0.13, 0.16, [0.15, 0.65, -0.03], shell, -0.3);
  // Floor tom on three short legs.
  for (const [dx, dz] of [[-0.16, 0.1], [0.16, 0.1], [0, -0.18]]) rod(g, v(0.48 + dx * 0.9, 0.2, -0.08 + dz * 0.9), v(0.48 + dx * 1.2, 0, -0.08 + dz * 1.2), 0.01, chrome());
  drum(g, 0.19, 0.32, [0.48, 0.38, -0.08], shell);
  // Hi-hat: two cymbals on one pole, far left.
  const hats = new THREE.Group();
  rod(g, v(-0.6, 0.2, 0), v(-0.6, 0.86, 0), 0.009, chrome());
  tripod(g, -0.6, 0);
  hats.position.set(-0.6, 0.85, 0);
  for (const y of [0, 0.026]) cyl(hats, [0.025, 0.16, 0.014], [0, y, 0], brass(), { edges: 0, hull: 0.004 }, 24);
  g.add(hats);
  // Crash and ride, the highest things in the kit, out at the sides.
  const crash = cymbal(g, 0.2, [-0.4, 1.02, 0.2], 0.2);
  const ride = cymbal(g, 0.22, [0.6, 0.96, 0.18], 0.16);
  shade(g, 1.6, 0.8, 0.3);
  return { object: g, cymbals: [crash, ride, hats], bass, head };
}

// Combo amp, about 0.6 m wide, 0.6 m tall, 0.4 m deep.
function amp() {
  const g = new THREE.Group();
  rbox(g, [0.6, 0.6, 0.4], [0, 0, 0], black(), 0.03);
  box(g, [0.52, 0.4, 0.01], [0, 0.05, 0.2], paper(0x4a4652, { finish: 'fabric' }), { edges: 0, hull: 0 });   // grille cloth
  box(g, [0.56, 0.07, 0.01], [0, 0.5, 0.2], paper(C.ochre, { finish: 'metal' }), { edges: 0, hull: 0 });    // control panel
  for (let i = 0; i < 5; i++) {
    const knob = cyl(g, [0.014, 0.014, 0.014], [-0.2 + i * 0.1, 0.535, 0.206], black(), { edges: 0, hull: 0 }, 12);
    knob.rotation.x = PI / 2;
  }
  patch(g, 0.16, 0.05, C.coral, [0.15, 0.37, 0.207], [0, 0, -0.04], 4);   // the badge
  rod(g, v(-0.12, 0.62, 0), v(0.12, 0.62, 0), 0.012, black());               // handle
  shade(g, 0.8, 0.6, 0.32);
  return { object: g };
}

let keysTex;
// Keyboard on an X stand: the keys at about 0.9 m.
function keyboard() {
  const g = new THREE.Group();
  // The stand: a pair of crossed legs at each end and a bar between them.
  for (const x of [-0.36, 0.36]) {
    rod(g, v(x, 0, -0.14), v(x, 0.82, 0.12), 0.012, black());
    rod(g, v(x, 0, 0.14), v(x, 0.82, -0.12), 0.012, black());
  }
  rod(g, v(-0.36, 0.41, 0), v(0.36, 0.41, 0), 0.01, black());
  for (const x of [-0.36, 0.36]) rod(g, v(x, 0.82, -0.12), v(x, 0.82, 0.12), 0.012, black());
  // The instrument: a body, a key bed facing the player (-z) and a panel.
  rbox(g, [1.0, 0.07, 0.3], [0, 0.83, 0], black(), 0.02);
  keysTex ??= canvasTexture(512, 64, (c, w, h) => {
    c.fillStyle = '#fbf8f1';
    c.fillRect(0, 0, w, h);
    const n = 36, kw = w / n;
    c.strokeStyle = '#8d877c';
    for (let i = 1; i < n; i++) { c.beginPath(); c.moveTo(i * kw, 0); c.lineTo(i * kw, h); c.stroke(); }
    c.fillStyle = '#2d2c35';
    for (let i = 0; i < n - 1; i++) if (![2, 6].includes(i % 7)) c.fillRect((i + 0.68) * kw, 0, kw * 0.64, h * 0.6);
  });
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.15), paper(C.white, { map: keysTex }));
  keys.rotation.x = -PI / 2;
  keys.rotation.z = PI;               // the low notes to the player's left
  keys.position.set(0, 0.902, -0.06);
  keys.receiveShadow = true;
  g.add(keys);
  box(g, [0.9, 0.012, 0.1], [0, 0.9, 0.09], paper(C.screen, { finish: 'gloss' }), { edges: 0, hull: 0 });
  patch(g, 0.2, 0.05, C.ochre, [-0.3, 0.913, 0.09], [-PI / 2, 0, 0], 9);
  shade(g, 1.1, 0.5, 0.22);
  return { object: g };
}

// Mic stand, about 1.2 m: a round base, a pole and a boom that brings the
// mic back to the singer behind it (-z), at the chin of the drawing on a
// 1.62 m card, so the face stays in view above it.
function micStand() {
  const g = new THREE.Group();
  cyl(g, [0.13, 0.14, 0.025], [0, 0, 0], black(), { edges: 0, hull: 0.004 }, 24);
  rod(g, v(0, 0.02, 0), v(0, 1.07, 0), 0.01, black());
  rod(g, v(0, 1.04, 0.08), v(0, 1.17, -0.2), 0.009, black());
  const mic = new THREE.Group();
  mic.position.set(0, 1.17, -0.2);
  mic.rotation.x = -PI / 2 + 0.25;   // tipped up a little, to the singer's mouth
  cyl(mic, [0.02, 0.014, 0.1], [0, 0, 0], black(), { edges: 0, hull: 0.004 }, 12);
  const grille = ink(new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), chrome()), { edges: 0, hull: 0.004 });
  grille.position.y = 0.12;
  mic.add(grille);
  g.add(mic);
  return { object: g };
}

let rugTex;
// Rug, 3.6 m x 2.6 m, flat on the floor just above it (no z-fighting).
function rug() {
  rugTex ??= canvasTexture(360, 260, (c, w, h) => {
    c.fillStyle = '#b85a48';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e7c88a';
    c.lineWidth = 8;
    c.strokeRect(14, 14, w - 28, h - 28);
    c.strokeStyle = '#2f3d52';
    c.lineWidth = 4;
    c.strokeRect(28, 28, w - 56, h - 56);
    c.fillStyle = 'rgba(231,200,138,0.55)';
    for (let x = 60; x < w - 40; x += 40) for (let y = 60; y < h - 40; y += 40) {
      c.beginPath();
      c.moveTo(x, y - 9); c.lineTo(x + 9, y); c.lineTo(x, y + 9); c.lineTo(x - 9, y);
      c.fill();
    }
  });
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), paper(C.white, { map: rugTex, finish: 'fabric' }));
  m.rotation.x = -PI / 2;
  m.position.y = 0.004;
  m.receiveShadow = true;
  g.add(m);
  return { object: g };
}

const BUILDERS = {
  drum_kit: drumKit,
  amp,
  keyboard,
  mic_stand: micStand,
  rug,
};

// ---- The stage ----

const WASH = 0xffe2b8;
const WASH_I = 16;

export function createStage({ scene, shows = SHOWS } = {}) {
  const root = new THREE.Group();     // always in the scene, so the lights always count
  root.name = 'stage';
  scene?.add(root);
  const sets = new Map();             // show key -> { group, kit }

  // Two warm spotlights high on either side of the room's front, aimed at the band.
  const aim = v(0, 0.7, -0.8);
  const lights = [-2.8, 2.8].map(x => {
    const spot = new THREE.SpotLight(WASH, 0, 0, 0.62, 0.7, 1.4);
    spot.position.set(x, 3.3, 1.8);
    spot.target.position.copy(aim);
    root.add(spot, spot.target);
    return spot;
  });

  // The pieces of a show's set, in one group centred on the set so the
  // camera can look at it and it can rise from the floor.
  function build(key) {
    const set = shows[key]?.set ?? [];
    const centre = set.find(p => p.piece === 'rug') ?? { x: 0, z: 0 };
    const group = new THREE.Group();
    group.name = `stage-${key}`;
    group.position.set(centre.x, 0, centre.z);
    group.visible = false;
    let kit = null;
    for (const p of set) {
      const built = BUILDERS[p.piece]?.();
      if (!built) continue;
      built.object.position.set(p.x - centre.x, 0, p.z - centre.z);
      built.object.rotation.y = p.rot ?? 0;
      group.add(built.object);
      if (p.piece === 'drum_kit') kit = built;
    }
    root.add(group);
    const entry = { group, kit };
    sets.set(key, entry);
    return entry;
  }

  const state = { fade: 0, key: null };

  return {
    group: root,
    lights,
    state,
    update(show, time, dt, beat01 = null) {
      const on = Boolean(show && shows[show.key]);
      if (on && show.key !== state.key) {
        // Another show takes over at once; the old set goes.
        if (state.key) sets.get(state.key).group.visible = false;
        state.key = show.key;
      }
      if (on && !sets.has(state.key)) build(state.key);
      state.fade += ((on ? 1 : 0) - state.fade) * Math.min(1, dt * 3);
      if (!on && state.fade < 0.01) state.fade = 0;
      if (on && state.fade > 0.999) state.fade = 1;
      const f = state.fade;
      for (const l of lights) l.intensity = f * WASH_I;
      const set = state.key ? sets.get(state.key) : null;
      if (!set) return;
      set.group.visible = f > 0;
      if (f === 0) return;
      // The set rises from the floor like a pop-up page.
      const s = f * f * (3 - 2 * f);
      set.group.scale.set(1, Math.max(0.001, s), 1);

      // The kit answers the music while the band plays, and is still between songs.
      const kit = set.kit;
      if (!kit) return;
      const hit = on && show.beat === 'play' && typeof beat01 === 'number' ? beat01 : 0;
      kit.cymbals.forEach((c, i) => {
        c.rotation.z = hit * 0.09 * Math.sin(time * 19 + i * 2.1);
      });
      kit.bass.scale.set(1 + hit * 0.03, 1, 1 + hit * 0.03);
      kit.head.scale.set(1 + hit * 0.04, 1, 1 + hit * 0.04);
    },
    // What the camera can look at for a show: its set, or null before it is built.
    subject(key) { return sets.get(key)?.group ?? null; },
  };
}
