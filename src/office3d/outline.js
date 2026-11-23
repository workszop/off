// ---- Ink outlines ----
// The office is drawn twice. The second drawing is not shown: every inked
// thing writes which way its surface faces and which object it is, and how
// far away it is lands in the depth buffer. A full-screen pass then looks for
// the places where that changes from one pixel to the next and puts ink
// there, over the picture already on screen.
//
// So a contour is the same width on screen whether the thing is at the
// camera's elbow or across the room, and a mug standing on a desk gets a
// line where the two meet, which no line fastened to the mug itself can do
// (the desk hides it).
//
// What takes part:
//   mesh.userData.ink            written by ink() in materials.js: gets contours
//   mesh.userData.inkAs          another object this one counts as part of: no line where they join
//   other solid meshes           no contour of their own, but they hide what is behind them
//   cutouts (alphaTest + map)    the cast: they carry their own drawn outline
//   see-through materials, lines, and anything with userData.outline === 'skip'
//                                left out (glass, shadows, the street outside)

import * as THREE from 'three';

const INK = new THREE.Color(0x292824);
const WIDTH = 0.8;    // CSS pixels: the width of a contour across the room
const NEAR_GAIN = 0.5; // how much heavier a line gets right in front of the camera
// Smooth lines: on an ordinary screen the hidden drawing is made at one and a half times the
// size, the ink is found at that size and then shrunk onto the picture, so
// the edge of a line fades over a pixel instead of stepping. A dense screen
// (phones, HiDPI) has the pixels already and is drawn one to one. Capped, so
// a very large window does not ask for a very large drawing.
const FINE = 1.5, FINE_BELOW = 1.5, MAX_PIXELS = 8.5e6;

// Inked surfaces: rg = the view-space normal, b = which object, a = 1.
const SURFACE_VERT = /* glsl */`
  varying vec3 vNormal;
  void main() {
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const SURFACE_FRAG = /* glsl */`
  uniform float id;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    gl_FragColor = vec4(n.xy * 0.5 + 0.5, id, 1.0);
  }`;

const IDS = 251; // a prime, so neighbouring meshes rarely share a number
const surfaces = [];
function surface(mesh) {
  const k = (mesh.userData.inkAs ?? mesh).id % IDS;
  return surfaces[k] ??= new THREE.ShaderMaterial({
    uniforms: { id: { value: (k + 1) / 255 } },
    vertexShader: SURFACE_VERT, fragmentShader: SURFACE_FRAG, side: THREE.DoubleSide,
  });
}

// Everything else that is solid writes "nothing to ink here" (all zeros) and
// its depth, so it still covers the contours of what stands behind it.
const blank = mat => {
  mat.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', 'gl_FragColor = vec4(0.0);');
  };
  mat.customProgramCacheKey = () => 'outline-blank';
  return mat;
};
const SOLID = blank(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
const cutouts = new WeakMap();
function cutout(material) {
  const { map, alphaTest } = material;
  if (!cutouts.has(map)) cutouts.set(map, blank(new THREE.MeshBasicMaterial({ map, alphaTest, side: THREE.DoubleSide })));
  return cutouts.get(map);
}

const EDGE_FRAG = /* glsl */`
  uniform sampler2D tSurface, tDepth;
  uniform vec2 texel;
  uniform float near, far, width, nearGain;
  varying vec2 vUv;

  // One over the distance from the camera. Unlike the distance itself this
  // runs in a straight line across any flat surface on screen, however
  // steeply it is seen, so a floor running off to the far wall is not
  // mistaken for a row of edges.
  float inverseDistance(vec2 uv) {
    return (far - texture2D(tDepth, uv).x * (far - near)) / (near * far);
  }
  vec3 normalOf(vec4 s) {
    vec2 n = s.rg * 2.0 - 1.0;
    return vec3(n, sqrt(max(0.0, 1.0 - dot(n, n))));
  }

  void main() {
    vec4 c = texture2D(tSurface, vUv);
    if (c.a < 0.5) { gl_FragColor = vec4(0.0); return; }
    float wc = inverseDistance(vUv), zc = 1.0 / wc;
    vec3 nc = normalOf(c);
    float tol = 0.012 + 0.006 * zc;                       // metres that count as a step in depth
    vec2 reach = texel * width * (1.0 + nearGain * clamp((3.0 - zc) / 2.5, 0.0, 1.0));
    float edge = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 dir = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(0.0, 1.0) : i == 2 ? vec2(0.707, 0.707) : vec2(-0.707, 0.707);
      vec2 ua = vUv + dir * reach, ub = vUv - dir * reach;
      vec4 a = texture2D(tSurface, ua), b = texture2D(tSurface, ub);
      float wa = inverseDistance(ua), wb = inverseDistance(ub);
      // A silhouette: this pixel stands proud of the line through its two
      // neighbours. Only the nearer side of a step does, so the line is
      // drawn once, on the thing in front.
      edge = max(edge, smoothstep(tol, 2.0 * tol, (2.0 * wc - wa - wb) * zc * zc));
      // Where two things touch (a mug on a desk, a sheet of paper lying
      // flat) there is no step. The one with the higher number draws the line.
      if (a.a > 0.5 && c.b - a.b > 0.002 && 1.0 / wa - zc > -tol) edge = 1.0;
      if (b.a > 0.5 && c.b - b.b > 0.002 && 1.0 / wb - zc > -tol) edge = 1.0;
      // A crease within one thing: the surface turns sharply. Looked for on
      // one side only, or the line would be twice as wide as the others.
      if (a.a > 0.5 && abs(c.b - a.b) < 0.002) edge = max(edge, smoothstep(0.9, 0.8, dot(nc, normalOf(a))));
    }
    gl_FragColor = vec4(edge);
  }`;

// The ink found above, laid over the picture. Four taps half a pixel out,
// each already a blend of its neighbours, so a line's edge is soft.
const LAY_FRAG = /* glsl */`
  uniform sampler2D tInk;
  uniform vec2 pixel;
  uniform vec3 ink;
  varying vec2 vUv;
  void main() {
    float a = 0.25 * (
      texture2D(tInk, vUv + pixel * vec2(0.5, 0.5)).r + texture2D(tInk, vUv + pixel * vec2(-0.5, 0.5)).r +
      texture2D(tInk, vUv + pixel * vec2(0.5, -0.5)).r + texture2D(tInk, vUv + pixel * vec2(-0.5, -0.5)).r);
    a = min(1.0, a * 1.3); // the softening takes a little off the middle of a thin line: put it back
    if (a <= 0.004) discard;
    gl_FragColor = vec4(ink, a);
  }`;

export function createOutline(renderer) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
  });
  const uniforms = {
    tSurface: { value: target.texture }, tDepth: { value: target.depthTexture },
    texel: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 100 },
    width: { value: WIDTH }, nearGain: { value: NEAR_GAIN },
  };
  const found = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }); // the ink, before it is laid on the picture
  const lay = {
    tInk: { value: found.texture }, pixel: { value: new THREE.Vector2() },
    ink: { value: new THREE.Vector3(...INK.clone().convertLinearToSRGB().toArray()) }, // drawn as is, past the tone curve
  };
  const sheetGeometry = new THREE.BufferGeometry()
    .setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
    .setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const SHEET_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const sheet = (uniforms, fragmentShader, transparent) => {
    const m = new THREE.Mesh(sheetGeometry, new THREE.ShaderMaterial({ uniforms, fragmentShader, vertexShader: SHEET_VERT, transparent, depthTest: false, depthWrite: false }));
    m.frustumCulled = false;
    return m;
  };
  const finder = sheet(uniforms, EDGE_FRAG, false), paper = sheet(lay, LAY_FRAG, true);
  const flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // What the hidden drawing changed, to be put back after it.
  const swapped = [], hidden = [];
  const seeThrough = m => (Array.isArray(m) ? m.some(seeThrough) : m.transparent || m.colorWrite === false);
  function dress(o) {
    if (!o.visible) return;
    if (o.userData.outline === 'skip' || o.isLine || o.isPoints || o.isSprite) { o.visible = false; hidden.push(o); return; }
    if (o.isMesh) {
      const m = o.material;
      if (!o.userData.ink && seeThrough(m)) { o.visible = false; hidden.push(o); return; }
      swapped.push(o, m);
      o.material = o.userData.ink ? surface(o) : !Array.isArray(m) && m.alphaTest > 0 && m.map ? cutout(m) : SOLID;
    }
    for (const child of o.children) dress(child);
  }
  function undress() {
    for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
    for (const o of hidden) o.visible = true;
    swapped.length = hidden.length = 0;
  }

  const size = new THREE.Vector2(), clear = new THREE.Color();
  return {
    enabled: true,
    // The share of the last picture that was inked surface, for the tests.
    coverage() {
      const w = target.width, h = target.height, px = new Uint8Array(w * h * 4);
      renderer.readRenderTargetPixels(target, 0, 0, w, h, px);
      let inked = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 127) inked++;
      return inked / (w * h);
    },
    // Draw the contours of `scene` over what is already on screen.
    render(scene, camera) {
      if (!this.enabled) return;
      renderer.getDrawingBufferSize(size);
      lay.pixel.value.set(1 / size.x, 1 / size.y);
      const ratio = renderer.getPixelRatio();
      const fine = Math.max(1, Math.min(ratio < FINE_BELOW ? FINE : 1, Math.sqrt(MAX_PIXELS / (size.x * size.y))));
      size.multiplyScalar(fine).round();
      if (target.width !== size.x || target.height !== size.y) { target.setSize(size.x, size.y); found.setSize(size.x, size.y); }
      uniforms.texel.value.set(1 / size.x, 1 / size.y);
      uniforms.near.value = camera.near;
      uniforms.far.value = camera.far;
      uniforms.width.value = WIDTH * ratio * fine;

      const background = scene.background, shadows = renderer.shadowMap.autoUpdate, auto = renderer.autoClear;
      const alpha = renderer.getClearAlpha();
      renderer.getClearColor(clear);
      scene.background = null;
      renderer.shadowMap.autoUpdate = false; // the shadows of this frame are already drawn
      dress(scene);
      try {
        renderer.setRenderTarget(target);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        renderer.render(scene, camera);
        undress();
        renderer.setRenderTarget(found);
        renderer.render(finder, flat);
      } finally {
        undress();
        scene.background = background;
        renderer.shadowMap.autoUpdate = shadows;
        renderer.setRenderTarget(null);
        renderer.setClearColor(clear, alpha);
      }
      renderer.autoClear = false;
      renderer.render(paper, flat);
      renderer.autoClear = auto;
    },
    dispose() { target.dispose(); found.dispose(); sheetGeometry.dispose(); finder.material.dispose(); paper.material.dispose(); },
  };
}
