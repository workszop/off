// ---- Time-of-day lighting ----
// One look per DAY_PHASES key: the sun, the sky in the windows, the arc lamp,
// screen glow and a gentle tint on the cardboard cast. Changing phase blends
// from the current look to the new one; once the blend has settled, update()
// does nothing until the phase changes again.
//
//   const lighting = createLighting({ scene, sun, hemi, skyMat, outside, lamps, glow, standees });
//   lighting.update('night', dt);

import * as THREE from 'three';

const LOOK = {
  morning:   { sky: 0xd3e4ec, sun: 0xffd9a6, sunI: 2.0, sunPos: [9, 5, -1], hemiSky: 0xfff4e6, hemiGround: 0xd8ccb8, hemiI: 1.55, bg: 0xf2ece1, tint: 0xfff6ec, lamp: 0, screens: 0.15 },
  midday:    { sky: 0xbfd9ee, sun: 0xfff8ec, sunI: 2.3, sunPos: [2, 10, 4], hemiSky: 0xffffff, hemiGround: 0xd9d0c2, hemiI: 1.7, bg: 0xf4efe5, tint: 0xffffff, lamp: 0, screens: 0.1 },
  afternoon: { sky: 0xc6dbe0, sun: 0xffe6c2, sunI: 2.1, sunPos: [-7, 6, 4], hemiSky: 0xfff8ee, hemiGround: 0xd6ccb8, hemiI: 1.55, bg: 0xf1ebe0, tint: 0xfdf7ee, lamp: 0, screens: 0.15 },
  evening:   { sky: 0xe7a47c, sun: 0xff9f66, sunI: 1.25, sunPos: [-10, 3.5, 2], hemiSky: 0xf4d7c0, hemiGround: 0x9a8a7a, hemiI: 1.0, bg: 0xe6d9c9, tint: 0xf3dcc8, lamp: 0.75, screens: 0.55 },
  night:     { sky: 0x22314b, sun: 0x8ea5d6, sunI: 0.42, sunPos: [-4, 9, 6], hemiSky: 0x7d8bb3, hemiGround: 0x3a3a48, hemiI: 0.6, bg: 0x1d2130, tint: 0xa3adc9, lamp: 1, screens: 1 },
};
const COLORS = ['sky', 'sun', 'hemiSky', 'hemiGround', 'bg', 'tint'];
const NUMBERS = ['sunI', 'hemiI', 'lamp', 'screens'];
const BLEND_RATE = 1.5;      // per second
const SETTLED = 0.002;       // largest remaining difference that counts as arrived

// Each look as ready-made colours and vectors, built once.
const TARGETS = Object.fromEntries(Object.entries(LOOK).map(([key, t]) => [key, {
  ...t,
  ...Object.fromEntries(COLORS.map(name => [name, new THREE.Color(t[name])])),
  sunPos: new THREE.Vector3(...t.sunPos),
}]));

export const LOOK_KEYS = Object.keys(LOOK);

export function createLighting({ scene, sun, hemi, skyMat, outside, lamps, glow, standees }) {
  let look = null;      // live, blended values
  let settledOn = null; // phase key the look has fully reached
  const screenGlow = new THREE.Color();
  const hsl = {};

  // Move the look toward the target by k (0..1). Returns the largest
  // difference still left.
  function blend(t, k) {
    let rest = 0;
    for (const name of COLORS) {
      const c = look[name].lerp(t[name], k), goal = t[name];
      rest = Math.max(rest, Math.abs(c.r - goal.r), Math.abs(c.g - goal.g), Math.abs(c.b - goal.b));
    }
    for (const name of NUMBERS) {
      look[name] += (t[name] - look[name]) * k;
      rest = Math.max(rest, Math.abs(t[name] - look[name]));
    }
    look.sunPos.lerp(t.sunPos, k);
    return Math.max(rest, look.sunPos.distanceTo(t.sunPos) * 0.02);
  }

  function apply() {
    sun.color.copy(look.sun);
    sun.intensity = look.sunI;
    sun.position.copy(look.sunPos);
    hemi.color.copy(look.hemiSky);
    hemi.groundColor.copy(look.hemiGround);
    hemi.intensity = look.hemiI;
    skyMat.color.copy(look.sky);
    outside.update(Math.max(0, (look.screens - 0.15) / 0.85), look.sky);
    scene.background.copy(look.bg);
    scene.fog.color.copy(look.bg);
    document.body.style.background = `#${look.bg.getHexString()}`;
    document.body.classList.toggle('is-dark', look.bg.getHSL(hsl).l < 0.4);
    for (const s of standees) s.setTint(look.tint);
    for (const l of lamps) {
      l.light.intensity = look.lamp * 4;
      l.glow[0].material.color.setRGB(0.96, 0.92 - 0.05 * look.lamp, 0.82 - 0.35 * look.lamp);
    }
    screenGlow.set(0x9fc3e0).multiplyScalar(look.screens * 0.8);
    for (const m of glow) if (m.material.emissive) m.material.emissive.copy(screenGlow);
  }

  return {
    get settled() { return settledOn !== null; },
    update(key, dt) {
      if (key === settledOn) return;
      const t = TARGETS[key] ?? TARGETS.midday;
      settledOn = null;
      let rest = 0;
      if (!look) {
        // First call: start at the target, no blend.
        look = { sunPos: t.sunPos.clone() };
        for (const name of COLORS) look[name] = t[name].clone();
        for (const name of NUMBERS) look[name] = t[name];
      } else {
        rest = blend(t, Math.min(1, dt * BLEND_RATE));
      }
      if (rest < SETTLED) {
        blend(t, 1);
        settledOn = key;
      }
      apply();
    },
  };
}
