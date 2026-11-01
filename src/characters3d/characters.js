// ---- The 3D cast ----
// Andy, Jazz, Olex and the Ghost rebuilt as toon-shaded, ink-outlined 3D
// figures that follow the zine sprites in assets/sprites/zine/*.
//
// Every character faces +Z, stands on y = 0, and is about 1.6 m tall
// (Ghost ~1.1 m, matching its 0.72 sprite scale). Units are metres.
//
//   const c = createCharacter('jazz');
//   scene.add(c.root);
//   c.update(time, dt, speed);   // speed 0 = idle, 1 = full walk

import * as THREE from 'three';
import {
  PALETTE as P, toon, flat, part, sweep, taper, lathe, stroke, v3,
  hairTexture, HeadSurface,
} from './kit.js';

const HIP_Y = 0.72;
const HEAD_R = 0.165;
const HEAD_SCALE = v3(1, 1.04, 0.97);
const HEAD_Y = 0.70; // head centre above the hips (torso space)
const BODY_DEPTH = 0.72; // torsos are ellipses, not cylinders

// ---- Specs taken from the sprites ----

const SPECS = {
  andy: {
    scale: 1.04,
    shirt: P.cream, shirtStyle: 'polo',
    torso: [[0.142, -0.08], [0.14, -0.02], [0.138, 0.1], [0.145, 0.22], [0.152, 0.32], [0.15, 0.39], [0.135, 0.44], [0.1, 0.47], [0.055, 0.49], [0, 0.495]],
    shoulderX: 0.178,
    pants: P.charcoal, cuff: null, thighR: 0.068, shinR: 0.064,
    shoe: P.cream, shoeAccent: P.peach,
    eyes: { w: 0.019, h: 0.024, lashes: false },
    glasses: true, brows: true, ears: true, blush: false, nose: 0.013,
    hair: null,
  },
  jazz: {
    scale: 1,
    shirt: P.cream, shirtStyle: 'tee',
    torso: [[0.128, -0.07], [0.126, -0.02], [0.12, 0.08], [0.128, 0.2], [0.138, 0.3], [0.136, 0.38], [0.122, 0.43], [0.095, 0.465], [0.055, 0.485], [0, 0.49]],
    shoulderX: 0.165,
    pants: P.denimLight, cuff: P.denimLightCuff, thighR: 0.064, shinR: 0.056,
    shoe: P.cream, shoeAccent: P.peach,
    eyes: { w: 0.026, h: 0.034, lashes: true },
    glasses: false, brows: true, ears: false, blush: true, nose: 0.009,
    hair: jazzHair,
  },
  olex: {
    scale: 1,
    shirt: P.cream, shirtStyle: 'tee',
    torso: [[0.128, -0.07], [0.126, -0.02], [0.12, 0.08], [0.128, 0.2], [0.137, 0.3], [0.135, 0.38], [0.121, 0.43], [0.094, 0.465], [0.055, 0.485], [0, 0.49]],
    shoulderX: 0.165,
    pants: P.denimMid, cuff: P.denimMidCuff, thighR: 0.064, shinR: 0.057,
    shoe: P.cream, shoeAccent: P.coral,
    eyes: { w: 0.024, h: 0.031, lashes: true },
    glasses: true, brows: false, ears: false, blush: true, nose: 0.009,
    hair: olexHair,
  },
};

// ---- Public API ----

export const CHARACTER_TYPES = ['andy', 'jazz', 'olex', 'ghost'];

export function createCharacter(type) {
  return type === 'ghost' ? buildGhost() : buildHuman(type, SPECS[type]);
}

// ---- Human ----

function buildHuman(type, spec) {
  const mats = {
    skin: toon(P.skin),
    shirt: toon(spec.shirt),
    shirtInner: toon(spec.shirt, { side: THREE.DoubleSide }),
    trim: toon(P.creamDeep),
    pants: toon(spec.pants),
    pantsInner: toon(spec.pants, { side: THREE.DoubleSide }),
    cuff: spec.cuff ? toon(spec.cuff) : null,
    shoe: toon(spec.shoe),
    sole: toon(P.white),
    accent: toon(spec.shoeAccent),
  };

  const root = new THREE.Group();
  root.name = type;
  const body = new THREE.Group();
  body.scale.setScalar(spec.scale);
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = HIP_Y;
  body.add(hips);

  // Pelvis ties the legs into the shirt hem.
  const pelvis = part(new THREE.SphereGeometry(1, 24, 16), mats.pants);
  pelvis.scale.set(spec.torso[0][0] * 0.97, 0.11, spec.torso[0][0] * BODY_DEPTH * 0.97);
  pelvis.position.y = -0.03;
  hips.add(pelvis);

  const legs = [1, -1].map(side => buildLeg(side, spec, mats));
  legs.forEach(l => hips.add(l.hip));

  const torso = new THREE.Group();
  hips.add(torso);

  const shirt = part(lathe(spec.torso), mats.shirt);
  shirt.scale.z = BODY_DEPTH;
  torso.add(shirt);
  // Hem band closes the open bottom edge of the shirt.
  const [hemR, hemY] = spec.torso[0];
  const hem = part(new THREE.TorusGeometry(hemR, 0.009, 8, 40), mats.shirt, { outline: 0.004 });
  hem.rotation.x = Math.PI / 2;
  hem.scale.set(1, BODY_DEPTH, 1);
  hem.position.y = hemY;
  torso.add(hem);
  if (spec.shirtStyle === 'polo') addPoloDetails(torso, mats);
  else addTeeNeckline(torso, mats);

  const arms = [1, -1].map(side => buildArm(side, spec, mats));
  arms.forEach(a => torso.add(a.shoulder));

  const neck = part(new THREE.CylinderGeometry(0.042, 0.047, 0.13, 16, 1, true), mats.skin);
  neck.position.y = 0.53;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.y = HEAD_Y;
  torso.add(head);
  const skull = part(new THREE.SphereGeometry(HEAD_R, 40, 28), mats.skin);
  skull.scale.copy(HEAD_SCALE);
  head.add(skull);

  const surface = new HeadSurface(HEAD_R, HEAD_SCALE);
  const face = buildFace(head, surface, spec, mats);

  const rig = { root, body, hips, torso, head, legs, arms, eyes: face.eyes, sway: [], bob: [] };
  spec.hair?.(rig, surface);

  return withAnimation(type, rig, humanUpdate);
}

function buildLeg(side, spec, mats) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.068, -0.03, 0);

  const thigh = part(new THREE.CapsuleGeometry(spec.thighR, 0.2, 6, 16), mats.pants);
  thigh.position.y = -0.15;
  hip.add(thigh);

  const knee = new THREE.Group();
  knee.position.y = -0.31;
  hip.add(knee);

  const shin = part(new THREE.CapsuleGeometry(spec.shinR, 0.19, 6, 16), mats.pants);
  shin.position.y = -0.135;
  knee.add(shin);

  if (spec.cuff) {
    // Rolled-up jeans with a peek of ankle, as in the sprites.
    const cuff = part(new THREE.CylinderGeometry(spec.shinR + 0.008, spec.shinR + 0.01, 0.045, 20), mats.cuff);
    cuff.position.y = -0.255;
    knee.add(cuff);
    const ankle = part(new THREE.CylinderGeometry(0.03, 0.032, 0.05, 12), mats.skin, { outline: 0.004 });
    ankle.position.y = -0.295;
    knee.add(ankle);
  } else {
    // Straight trouser hem that breaks over the shoe.
    const hem = part(new THREE.CylinderGeometry(spec.shinR + 0.002, spec.shinR + 0.006, 0.07, 20, 1, true), mats.pantsInner);
    hem.position.y = -0.27;
    knee.add(hem);
  }

  const foot = new THREE.Group();
  foot.position.y = -0.3;
  knee.add(foot);
  buildShoe(foot, mats);

  return { hip, knee, foot };
}

function buildShoe(foot, mats) {
  const upper = part(new THREE.CapsuleGeometry(0.046, 0.085, 6, 16), mats.shoe);
  upper.rotation.x = Math.PI / 2;
  upper.scale.set(1, 1, 0.85);
  upper.position.set(0, -0.032, 0.03);
  foot.add(upper);

  const sole = part(new THREE.CapsuleGeometry(0.05, 0.09, 4, 16), mats.sole);
  sole.rotation.x = Math.PI / 2;
  sole.scale.set(1, 1, 0.3);
  sole.position.set(0, -0.064, 0.03);
  foot.add(sole);

  // Laces patch and heel tab in the accent colour.
  const laces = part(new THREE.SphereGeometry(1, 16, 10), mats.accent, { outline: 0.003 });
  laces.scale.set(0.026, 0.012, 0.034);
  laces.position.set(0, 0.002, 0.045);
  laces.rotation.x = 0.35;
  foot.add(laces);
  const heel = part(new THREE.SphereGeometry(1, 12, 8), mats.accent, { outline: 0.003 });
  heel.scale.set(0.022, 0.024, 0.012);
  heel.position.set(0, -0.025, -0.032);
  foot.add(heel);
}

function buildArm(side, spec, mats) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * spec.shoulderX, 0.4, 0);
  shoulder.rotation.z = side * 0.07;

  const cap = part(new THREE.SphereGeometry(0.052, 20, 14), mats.shirt);
  shoulder.add(cap);
  const sleeve = part(new THREE.CylinderGeometry(0.052, 0.058, 0.13, 20, 1, true), mats.shirtInner);
  sleeve.position.y = -0.065;
  shoulder.add(sleeve);
  const hem = part(new THREE.TorusGeometry(0.057, 0.0065, 8, 24), mats.trim, { outline: 0.003 });
  hem.rotation.x = Math.PI / 2;
  hem.position.y = -0.128;
  shoulder.add(hem);

  const upper = part(new THREE.CapsuleGeometry(0.036, 0.17, 6, 12), mats.skin);
  upper.position.y = -0.12;
  shoulder.add(upper);

  const elbow = new THREE.Group();
  elbow.position.y = -0.235;
  shoulder.add(elbow);
  const fore = part(new THREE.CapsuleGeometry(0.032, 0.15, 6, 12), mats.skin);
  fore.position.y = -0.09;
  elbow.add(fore);
  const hand = part(new THREE.SphereGeometry(0.042, 16, 12), mats.skin);
  hand.scale.set(0.8, 1.12, 0.95);
  hand.position.y = -0.195;
  elbow.add(hand);

  return { shoulder, elbow, side };
}

function addTeeNeckline(torso, mats) {
  const rib = part(new THREE.TorusGeometry(0.05, 0.009, 10, 32), mats.trim, { outline: 0.004 });
  rib.rotation.x = Math.PI / 2;
  rib.scale.set(1, 0.85, 1);
  rib.position.y = 0.478;
  torso.add(rib);
}

function addPoloDetails(torso, mats) {
  const band = part(new THREE.TorusGeometry(0.052, 0.014, 10, 32), mats.shirt, { outline: 0.004 });
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.49;
  torso.add(band);

  // Two pointed collar flaps resting on the chest slope.
  for (const side of [1, -1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(side * 0.072, 0.008);
    shape.lineTo(side * 0.028, -0.058);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1,
    });
    const flap = part(geo, mats.shirt, { outline: 0.004 });
    flap.position.set(side * 0.008, 0.488, 0.05);
    flap.rotation.set(-0.75, 0, side * -0.12);
    torso.add(flap);
  }

  const placket = part(new THREE.BoxGeometry(0.03, 0.085, 0.006), mats.shirt, { outline: 0.003 });
  placket.position.set(0, 0.41, 0.104);
  placket.rotation.x = -0.18;
  torso.add(placket);
  for (const y of [0.428, 0.392]) {
    const button = part(new THREE.SphereGeometry(0.0065, 10, 8), mats.trim, { outline: 0.002 });
    button.position.set(0, y, 0.11 + (0.428 - y) * 0.18);
    torso.add(button);
  }
}

// ---- Face ----

function buildEye(spec) {
  const eye = new THREE.Group();
  const { w, h } = spec.eyes;
  const iris = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), flat(0x221d1a));
  iris.scale.set(w, h, 0.012);
  eye.add(iris);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), flat(0xffffff));
  glint.scale.setScalar(w * 0.3);
  glint.position.set(w * 0.35, h * 0.38, 0.009);
  eye.add(glint);
  const glint2 = glint.clone();
  glint2.scale.setScalar(w * 0.14);
  glint2.position.set(-w * 0.3, -h * 0.35, 0.009);
  eye.add(glint2);
  if (spec.eyes.lashes) {
    // Upper lid line with a little outer flick.
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.08 + 0.84 * i / 10);
      pts.push(v3(Math.cos(a) * w * 1.15, Math.sin(a) * h * 1.05, 0.006));
    }
    eye.add(stroke(pts, 0.0035));
    eye.userData.lashes = true;
  }
  return eye;
}

function buildFace(head, surface, spec, mats) {
  const eyes = [];
  for (const side of [1, -1]) {
    const eye = buildEye(spec);
    surface.place(eye, side * 0.36, -0.07, 0.002, 0.2);
    head.add(eye);
    eyes.push(eye);

    if (spec.ears) {
      const ear = part(new THREE.SphereGeometry(1, 16, 12), mats.skin, { outline: 0.004 });
      ear.scale.set(0.03, 0.046, 0.016);
      surface.place(ear, side * Math.PI / 2, -0.1, 0.006);
      ear.rotateY(side * -0.75);
      head.add(ear);
    }
    if (spec.brows) {
      const phi = spec.glasses ? 0.36 : 0.27;
      head.add(stroke(surface.arc([side * 0.2, phi], [side * 0.52, phi - 0.04], 0.003, 0.05), spec.glasses ? 0.0045 : 0.0035));
    }
    if (spec.blush) {
      const blush = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10),
        flat(P.blush, { transparent: true, opacity: 0.45, depthWrite: false }));
      blush.scale.set(0.03, 0.016, 0.004);
      surface.place(blush, side * 0.62, -0.28, 0.0015);
      head.add(blush);
    }
  }

  // Smile: corners a touch higher than the middle.
  head.add(stroke(surface.arc([-0.13, -0.4], [0.13, -0.4], 0.003, -0.04), 0.0045));

  const nose = part(new THREE.SphereGeometry(spec.nose, 12, 10), mats.skin, { outline: 0.003 });
  nose.position.copy(surface.point(0, -0.21, 0.002));
  head.add(nose);

  if (spec.glasses) addGlasses(head, surface);
  return { eyes };
}

function addGlasses(head, surface) {
  const ink = flat(P.ink);
  const ringR = 0.05, lift = 0.03;
  const centres = [];
  for (const side of [1, -1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.0062, 8, 40), ink);
    surface.place(ring, side * 0.36, -0.07, lift, 0.65);
    head.add(ring);
    centres.push(ring.position.clone());

    // Temple arm back to the ear.
    const c = ring.position;
    head.add(stroke([
      v3(c.x + side * ringR * 0.95, c.y + 0.008, c.z - 0.012),
      surface.point(side * 1.05, 0.0, 0.022),
      surface.point(side * 1.5, -0.04, 0.012),
    ], 0.0045, ink));
  }
  const [l, r] = centres;
  head.add(stroke([
    v3(l.x - ringR * 0.92, l.y + 0.008, l.z),
    v3(0, l.y + 0.016, Math.max(l.z, r.z) + 0.008),
    v3(r.x + ringR * 0.92, r.y + 0.008, r.z),
  ], 0.0045, ink));
}

// ---- Hair ----

// Hair caps hug the skull: a short front piece (the hairline over the
// forehead) and a longer back piece that comes down over the sides.
function hairCap(material, { front, back, span = 2.1, lift = 1.07 }) {
  const r = HEAD_R * lift;
  const group = new THREE.Group();
  const f = part(new THREE.SphereGeometry(r, 40, 16, Math.PI / 2 - span / 2, span, 0, front), material, { outline: 0.005 });
  const b = part(new THREE.SphereGeometry(r, 48, 24, Math.PI / 2 + span / 2, Math.PI * 2 - span, 0, back), material, { outline: 0.005 });
  for (const m of [f, b]) { m.scale.copy(HEAD_SCALE); group.add(m); }
  return group;
}

function smoothstep(a, b, t) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

// Jazz: long, straight, centre-parted black hair down to the waist, with
// locks falling forward over both shoulders.
function jazzHair(rig, surface) {
  const mat = toon(P.hairBlack, { map: hairTexture(150, 240), side: THREE.DoubleSide });
  rig.head.add(hairCap(mat, { front: Math.PI * 0.35, back: Math.PI * 0.86, span: 1.6 }));

  // Centre parting.
  rig.head.add(stroke(surface.arc([0, 0.5], [0, 1.45], HEAD_R * 0.072, 0, 12), 0.0028, flat(P.skin)));

  // Face-framing locks: from the parting, over the temples, down the front.
  for (const side of [1, -1]) {
    const pts = [
      surface.point(side * 0.06, 0.66, 0.013),
      surface.point(side * 0.45, 0.42, 0.02),
      surface.point(side * 0.86, 0.05, 0.022),
      surface.point(side * 1.02, -0.35, 0.03),
      v3(side * 0.152, -0.22, 0.072),
      v3(side * 0.128, -0.34, 0.105),
      v3(side * 0.118, -0.5, 0.106),
    ];
    const geo = sweep(pts, {
      width: t => 0.02 + 0.02 * Math.sin(Math.PI * Math.min(1, t * 1.3)) * (1 - 0.4 * t),
      depth: 0.013,
      curl: t => 0.006 * smoothstep(0.5, 0.8, t),
      sideRef: t => v3(0, 0.2, 1).lerp(v3(side, 0, 0.25), smoothstep(0.4, 0.68, t)).normalize(),
      segments: 40,
    });
    rig.head.add(part(geo, mat, { outline: 0.004 }));
  }

  // The long back curtain hangs from the torso so it can sway as she walks.
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.75, -0.12);
  rig.torso.add(pivot);
  const back = [
    v3(0, 0.07, 0.02), v3(0, -0.13, -0.055), v3(0, -0.3, -0.05),
    v3(0, -0.49, -0.03), v3(0, -0.68, -0.02),
  ];
  const curtain = sweep(back, {
    width: t => 0.152 + 0.034 * Math.sin(Math.PI * Math.min(1, t * 1.5)) - 0.05 * smoothstep(0.65, 1, t),
    depth: t => 0.03 - 0.015 * smoothstep(0.7, 1, t),
    curl: 0.055,
    segments: 40,
    radial: 20,
  });
  pivot.add(part(curtain, mat, { outline: 0.005 }));
  rig.sway.push({ node: pivot, base: 0.02, amount: 1 });
}

// Olex: blond, swept up into a messy top bun, with loose wisps at the
// temples and a fringe of flyaways over the forehead.
function olexHair(rig, surface) {
  const mat = toon(P.hairBlond, { map: hairTexture(255, 178), side: THREE.DoubleSide });
  rig.head.add(hairCap(mat, { front: Math.PI * 0.32, back: Math.PI * 0.8, span: 1.75 }));

  // Bun with a few loose loops wrapped round it.
  const bunGroup = new THREE.Group();
  bunGroup.position.copy(surface.point(Math.PI, 1.3, 0.045));
  rig.head.add(bunGroup);
  const bun = part(new THREE.SphereGeometry(0.07, 28, 20), mat, { outline: 0.005 });
  bun.scale.set(1.05, 0.88, 1);
  bunGroup.add(bun);
  const loops = [
    { tilt: 0.5, yaw: 0.3, r: 0.066 }, { tilt: -0.6, yaw: 1.6, r: 0.07 }, { tilt: 1.1, yaw: 2.6, r: 0.062 },
  ];
  for (const { tilt, yaw, r } of loops) {
    const pts = [];
    for (let i = 0; i <= 9; i++) {
      const a = -0.4 + i * 0.45;
      pts.push(v3(Math.cos(a) * r, Math.sin(a) * r * 0.35, Math.sin(a) * r));
    }
    const loop = part(sweep(pts, {
      width: t => 0.016 * taper(0.3)(t), depth: 0.009, sideRef: v3(0, 1, 0),
    }), mat, { outline: 0.003 });
    loop.rotation.set(tilt, yaw, 0);
    bunGroup.add(loop);
  }
  // Flyaways sticking up from the bun.
  for (const [x, z, h] of [[0.03, 0.02, 0.07], [-0.035, -0.01, 0.06]]) {
    const pts = [v3(x * 0.5, 0.04, z * 0.5), v3(x, 0.04 + h * 0.6, z), v3(x * 1.8, 0.04 + h, z * 1.5)];
    bunGroup.add(part(sweep(pts, { width: t => 0.008 * (1 - t) + 0.002, depth: 0.004 }), mat, { outline: 0.0025 }));
  }
  rig.bob.push(bunGroup);

  // Fringe: short flyaway strands over the forehead.
  const fringe = [
    [-0.55, -0.68, 0.3], [-0.36, -0.42, 0.24], [-0.18, -0.1, 0.27], [0.0, 0.1, 0.22],
    [0.16, 0.26, 0.28], [0.34, 0.44, 0.23], [0.52, 0.66, 0.3],
  ];
  for (const [t0, t1, end] of fringe) {
    const pts = [
      surface.point(t0 * 0.7, 0.66, 0.011),
      surface.point((t0 + t1) / 2, 0.46, 0.014),
      surface.point(t1, end, 0.012),
    ];
    rig.head.add(part(sweep(pts, {
      width: t => 0.017 * (1 - 0.8 * t) + 0.002, depth: 0.006, sideRef: v3(1, 0, 0),
    }), mat, { outline: 0.0018 }));
  }

  // Wavy loose strands framing the face down to the jaw.
  for (const side of [1, -1]) {
    for (const [dTheta, len] of [[0, 1], [0.12, 0.8]]) {
      const pts = [
        surface.point(side * (0.98 + dTheta), 0.35, 0.012),
        surface.point(side * (1.08 + dTheta), -0.05, 0.022),
        surface.point(side * (0.98 + dTheta), -0.35 * len - 0.05, 0.03),
        surface.point(side * (1.06 + dTheta), -0.55 * len - 0.08, 0.034),
      ];
      rig.head.add(part(sweep(pts, {
        width: t => 0.013 * (1 - 0.7 * t) + 0.002, depth: 0.005, sideRef: v3(0, 0, 1),
      }), mat, { outline: 0.0018 }));
    }
  }
}

// ---- Ghost ----
// A cream sheet with a wavy hem and two ring eyes - cute, not scary.

function buildGhost() {
  const root = new THREE.Group();
  root.name = 'ghost';
  const body = new THREE.Group();
  body.scale.setScalar(1.1);
  root.add(body);

  const sheet = new THREE.Group();
  body.add(sheet);
  // Listed hem -> crown so the lathe's normals face outward.
  const profile = [
    [0.356, 0.0], [0.352, 0.05], [0.334, 0.16], [0.318, 0.3], [0.308, 0.45], [0.298, 0.6],
    [0.278, 0.75], [0.24, 0.86], [0.18, 0.94], [0.1, 0.985], [0.0, 1.0],
  ];
  const geo = lathe(profile, 48);
  const mat = toon(P.ghost, { side: THREE.DoubleSide });
  const shell = part(geo, mat, { outline: 0.008 });
  sheet.add(shell);

  // Remember each hem vertex's angle so the hem can ripple.
  const pos = geo.attributes.position;
  const base = Float32Array.from(pos.array);
  const hem = [];
  for (let i = 0; i < pos.count; i++) {
    const y = base[i * 3 + 1];
    if (y < 0.17) hem.push({ i, angle: Math.atan2(base[i * 3], base[i * 3 + 2]), w: 1 - y / 0.17 });
  }

  const eyes = [];
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 10, 32), flat(P.ink));
    const x = side * 0.095, y = 0.63;
    const r = 0.296;
    const z = Math.sqrt(r * r - x * x);
    eye.position.set(x, y, z + 0.006);
    eye.lookAt(new THREE.Vector3(x * 3, y, z * 3));
    eye.scale.set(1, 1.15, 1);
    sheet.add(eye);
    eyes.push(eye);
  }

  const rig = { root, body, sheet, geo, base, hem, eyes };
  return withAnimation('ghost', rig, ghostUpdate);
}

// ---- Animation ----

function withAnimation(type, rig, step) {
  const state = {
    gait: 0, speed: 0, seed: Math.random() * 10,
    blinkAt: 1 + Math.random() * 3, blinkUntil: 0,
  };
  return {
    type,
    root: rig.root,
    rig,
    // speed: 0 (idle) .. 1 (full walk). Smoothed internally.
    update(time, dt, speed = 0) {
      state.speed += (speed - state.speed) * Math.min(1, dt * 6);
      step(rig, state, time, dt);
    },
  };
}

function blink(eyes, state, time) {
  if (time > state.blinkAt) {
    state.blinkUntil = time + 0.12;
    state.blinkAt = time + 2.5 + Math.random() * 3.5;
  }
  const s = time < state.blinkUntil ? 0.12 : 1;
  for (const e of eyes) e.scale.y = s * (e.userData.baseScaleY ??= e.scale.y);
}

const WALK_HZ = 1.7;

function humanUpdate(rig, state, time, dt) {
  const k = state.speed;
  state.gait += dt * Math.PI * 2 * WALK_HZ * Math.min(1, k * 1.5);
  const ph = state.gait, idle = 1 - k, s = state.seed;

  // Legs: positive X rotation swings a leg backward. Knees fold mid-swing.
  rig.legs.forEach((leg, i) => {
    const p = ph + i * Math.PI;
    leg.hip.rotation.x = Math.sin(p) * 0.5 * k;
    leg.knee.rotation.x = Math.max(0, -Math.cos(p)) * 0.85 * k;
    leg.foot.rotation.x = -Math.max(0, Math.sin(p)) * 0.3 * k;
  });

  // Arms swing opposite the legs; a gentle sway at rest.
  rig.arms.forEach((arm, i) => {
    const p = ph + (i + 1) * Math.PI;
    arm.shoulder.rotation.x = Math.sin(p) * 0.42 * k + Math.sin(time * 1.3 + s + i) * 0.03 * idle;
    arm.elbow.rotation.x = -0.12 - Math.max(0, -Math.sin(p)) * 0.3 * k;
  });

  rig.body.position.y = (1 - Math.abs(Math.sin(ph))) * 0.022 * k;
  rig.hips.rotation.y = Math.sin(ph) * 0.1 * k;
  rig.torso.rotation.y = -Math.sin(ph) * 0.16 * k;
  rig.torso.rotation.x = 0.05 * k;
  rig.torso.position.y = Math.sin(time * 2.2 + s) * 0.004 * idle; // breathing

  rig.head.rotation.y = Math.sin(ph) * 0.06 * k + Math.sin(time * 0.45 + s) * 0.22 * idle;
  rig.head.rotation.z = Math.sin(time * 0.7 + s) * 0.04 * idle;
  rig.head.rotation.x = -0.03 * k;

  for (const { node, base, amount } of rig.sway) {
    node.rotation.x = base + (0.12 * k + Math.sin(ph * 2) * 0.03 * k + Math.sin(time * 1.4 + s) * 0.012) * amount;
    node.rotation.z = Math.sin(ph) * 0.03 * k;
  }
  for (const node of rig.bob) node.rotation.z = Math.sin(ph * 2) * 0.06 * k;

  blink(rig.eyes, state, time);
}

function ghostUpdate(rig, state, time) {
  const k = state.speed;
  rig.body.position.y = 0.14 + Math.sin(time * 1.6 + state.seed) * 0.045;
  rig.sheet.rotation.x = 0.16 * k;
  rig.sheet.rotation.z = Math.sin(time * 1.1 + state.seed) * 0.04;

  const pos = rig.geo.attributes.position;
  const amp = 0.022 + 0.018 * k;
  for (const { i, angle, w } of rig.hem) {
    const wave = Math.sin(angle * 6 + time * (2.2 + 2 * k)) * amp * w;
    pos.array[i * 3 + 1] = rig.base[i * 3 + 1] + wave;
    // Trail the hem behind when gliding forward.
    pos.array[i * 3 + 2] = rig.base[i * 3 + 2] - 0.05 * k * w;
  }
  pos.needsUpdate = true;
  rig.geo.computeVertexNormals();

  blink(rig.eyes, state, time);
}
