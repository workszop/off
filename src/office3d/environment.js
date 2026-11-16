// ---- What shiny things mirror ----
// A rough model of the office as light: warm walls, bright windows along the
// back and right walls, the ceiling panels and a pale floor. It is rendered
// once into a blurred reflection map; mugs, screens, metal and glass pick
// their highlights from it (see FINISH in materials.js).

import * as THREE from 'three';

const EYE = 1.3; // height the room is mirrored from: about table-top level

export function buildEnvironment(renderer) {
  const scene = new THREE.Scene();
  const lit = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide });
  const slab = (size, pos, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    m.position.set(pos[0], pos[1] - EYE, pos[2]); // the map is taken from the origin
    scene.add(m);
  };
  const wall = lit(0.5, 0.46, 0.4);
  slab([12, 3.6, 0.1], [0, 1.8, -4], wall);
  slab([12, 3.6, 0.1], [0, 1.8, 4], wall);
  slab([0.1, 3.6, 8], [-6, 1.8, 0], wall);
  slab([0.1, 3.6, 8], [6, 1.8, 0], wall);
  slab([12, 0.1, 8], [0, 3.6, 0], lit(0.42, 0.39, 0.34));   // ceiling
  slab([12, 0.1, 8], [0, 0, 0], lit(0.75, 0.71, 0.63));     // floor
  const sky = lit(6.5, 7.0, 7.6);
  for (const x of [-3.8, 0, 3.9]) slab([2.4, 1.45, 0.05], [x, 1.58, -3.9], sky);
  slab([0.05, 1.45, 3.0], [5.9, 1.58, 0.4], sky);
  const panel = lit(4.2, 4.0, 3.7);
  for (const x of [-3.9, 0, 3.9]) for (const z of [-2, 2]) slab([1.6, 0.05, 0.7], [x, 3.5, z], panel);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, 0.03).texture;
  pmrem.dispose();
  scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return texture;
}
