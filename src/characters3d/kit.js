// ---- Character kit ----
// Shared building blocks for the 3D cast: zine palette, toon materials with
// paper grain, inverted-hull ink outlines, a swept "ribbon" geometry for hair,
// and helpers for placing facial features on an ellipsoid head.

import * as THREE from 'three';

export const PALETTE = {
  ink: 0x2a2420,
  paper: 0xf4ecdd,
  skin: 0xf3d6b8,
  blush: 0xf0a596,
  cream: 0xefe5d1,
  creamDeep: 0xdccfb6,
  white: 0xfaf6ee,
  peach: 0xeba57e,
  coral: 0xd9644a,
  charcoal: 0x34312f,
  denimLight: 0x7d97b6,
  denimLightCuff: 0xa4b8cf,
  denimMid: 0x5d7798,
  denimMidCuff: 0x86a0bd,
  hairBlack: 0x3b3430,
  hairBlond: 0xe9cd93,
  ghost: 0xf1e7d3,
};

// ---- Textures ----

function canvasTexture(size, draw, repeat = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

let paperTex;
// Faint paper grain: keeps flat toon colours from looking plastic.
export function paperTexture() {
  paperTex ??= canvasTexture(256, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 238 + Math.random() * 17;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // A few fibres.
    ctx.strokeStyle = 'rgba(160,140,120,0.08)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      const x = Math.random() * s, y = Math.random() * s;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30);
      ctx.stroke();
    }
  }, 2);
  return paperTex;
}

const hairTexCache = new Map();
// Strand streaks running along the texture's V axis (crown -> tips).
// base/streak are 0-255 grey levels multiplied into the hair colour.
export function hairTexture(base, streak) {
  const key = `${base}-${streak}`;
  if (!hairTexCache.has(key)) {
    hairTexCache.set(key, canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = `rgb(${base},${base},${base})`;
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * s;
        const a = 0.25 + Math.random() * 0.5;
        ctx.strokeStyle = `rgba(${streak},${streak},${streak},${a})`;
        ctx.lineWidth = 0.6 + Math.random() * 1.6;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 6, s * 0.33, x - 6, s * 0.66, x + (Math.random() - 0.5) * 8, s);
        ctx.stroke();
      }
    }));
  }
  return hairTexCache.get(key);
}

let gradient;
// Three-band toon ramp: soft shadow, mid, lit. Nearest filtering keeps the
// bands crisp like gouache fills.
export function toonGradient() {
  if (!gradient) {
    const steps = [168, 222, 255];
    const data = new Uint8Array(steps.length * 4);
    steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
    gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient(),
    map: opts.map === undefined ? paperTexture() : opts.map,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}

export function flat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

// ---- Ink outlines (inverted hull) ----
// A back-face-only copy of the mesh, pushed out along its normals and filled
// with ink. It reads as a hand-drawn contour from every angle.

const outlineMaterials = new Map();
function outlineMaterial(width) {
  if (!outlineMaterials.has(width)) {
    const mat = new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.BackSide });
    mat.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `vec3 transformed = position + normal * ${width.toFixed(4)};`
      );
    };
    mat.customProgramCacheKey = () => `outline-${width}`;
    outlineMaterials.set(width, mat);
  }
  return outlineMaterials.get(width);
}

export function part(geometry, material, { outline = 0.006, shadow = true } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  if (outline) {
    const hull = new THREE.Mesh(geometry, outlineMaterial(outline));
    hull.raycast = () => {};
    hull.userData.isOutline = true;
    mesh.add(hull);
  }
  return mesh;
}

// ---- Geometry helpers ----

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export { v3 };

const valueAt = (v, t) => (typeof v === 'function' ? v(t) : v);

// Sweep an elliptical cross-section along a smooth curve. Width runs along
// `sideRef` (projected off the tangent), depth along tangent x side. `curl`
// bends the cross-section into a crescent so wide hair panels wrap the body.
export function sweep(points, {
  width = 0.04, depth = 0.015, curl = 0, sideRef = v3(1, 0, 0),
  segments = 28, radial = 12,
} = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const positions = [], uvs = [], indices = [];
  const N = new THREE.Vector3(), B = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const P = curve.getPointAt(t);
    const T = curve.getTangentAt(t);
    const ref = valueAt(sideRef, t);
    N.copy(ref).addScaledVector(T, -ref.dot(T));
    if (N.lengthSq() < 1e-6) N.set(0, 0, 1).addScaledVector(T, -T.z);
    N.normalize();
    B.crossVectors(T, N).normalize();
    const w = valueAt(width, t), d = valueAt(depth, t), c = valueAt(curl, t);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      positions.push(
        P.x + N.x * ca * w + B.x * (sa * d + c * ca * ca),
        P.y + N.y * ca * w + B.y * (sa * d + c * ca * ca),
        P.z + N.z * ca * w + B.z * (sa * d + c * ca * ca),
      );
      uvs.push(j / radial, 1 - t);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + ((j + 1) % radial);
      const c = a + radial, d = b + radial;
      indices.push(a, c, b, b, c, d);
    }
  }
  // End caps.
  for (const [ring, flip] of [[0, true], [segments, false]]) {
    const P = curve.getPointAt(ring / segments);
    const centre = positions.length / 3;
    positions.push(P.x, P.y, P.z);
    uvs.push(0.5, ring === 0 ? 1 : 0);
    for (let j = 0; j < radial; j++) {
      const a = ring * radial + j, b = ring * radial + ((j + 1) % radial);
      if (flip) indices.push(centre, b, a); else indices.push(centre, a, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Bell-shaped taper: `min` at both ends, full width at `peak` (0..1).
export const taper = (min = 0.25, peak = 0.5) => t => {
  const f = t < peak ? 0.5 * t / peak : 0.5 + 0.5 * (t - peak) / (1 - peak);
  return min + (1 - min) * Math.sin(Math.PI * f);
};

// Lathe with its seam rotated to the back, so the outline never shows a
// crack down the front of a shirt or a ghost.
export function lathe(profile, segments = 32) {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
  geo.rotateY(Math.PI);
  return geo;
}

// A thin ink stroke along points (eyebrows, mouths, glasses arms).
export function stroke(points, radius = 0.004, material = flat(PALETTE.ink)) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 6, false), material);
  mesh.castShadow = false;
  return mesh;
}

// ---- Head surface mapping ----
// Features are placed by spherical angles on the head ellipsoid:
// theta = left/right from the face centre, phi = up/down from the equator.

export class HeadSurface {
  constructor(radius, scale) {
    this.r = radius;
    this.s = scale; // THREE.Vector3
  }
  point(theta, phi, lift = 0) {
    const r = this.r + lift;
    return v3(
      r * Math.cos(phi) * Math.sin(theta) * this.s.x,
      r * Math.sin(phi) * this.s.y,
      r * Math.cos(phi) * Math.cos(theta) * this.s.z,
    );
  }
  normal(theta, phi) {
    const p = this.point(theta, phi);
    return v3(p.x / (this.s.x ** 2), p.y / (this.s.y ** 2), p.z / (this.s.z ** 2)).normalize();
  }
  // Place obj on the surface facing outward. `forward` (0..1) blends the
  // facing toward +Z so flat things like glasses do not splay sideways.
  place(obj, theta, phi, lift = 0, forward = 0) {
    obj.position.copy(this.point(theta, phi, lift));
    const n = this.normal(theta, phi).lerp(v3(0, 0, 1), forward).normalize();
    obj.quaternion.setFromUnitVectors(v3(0, 0, 1), n);
    return obj;
  }
  // Curve of surface points between angle pairs, for strokes.
  arc(from, to, lift, bulge = 0, n = 10) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const theta = from[0] + (to[0] - from[0]) * t;
      const phi = from[1] + (to[1] - from[1]) * t + bulge * Math.sin(Math.PI * t);
      pts.push(this.point(theta, phi, lift));
    }
    return pts;
  }
}
