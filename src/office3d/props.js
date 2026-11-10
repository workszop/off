// ---- Event props ----
// Small paper models that appear during office events: the donut everyone
// races for and the birthday cake. Each is hidden until placed.
//
//   const props = createProps();  scene.add(props.group);
//   props.update(sim.state, time);   // show / hide / animate from the sim's state

import * as THREE from 'three';
import { C, paper, cyl, ink } from './materials.js';

const PINK = 0xe9a3ad, DOUGH = 0xd9a565, SPONGE = 0xf1dfc0;

function buildDonut() {
  const g = new THREE.Group();
  const lift = new THREE.Group();   // hovers and turns so it can be seen from afar
  g.add(lift);
  const ring = new THREE.TorusGeometry(0.13, 0.065, 12, 28);
  const dough = ink(new THREE.Mesh(ring, paper(DOUGH)), { edges: 0, hull: 0.008 });
  dough.rotation.x = Math.PI / 2;
  const icing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.052, 10, 28), paper(PINK));
  icing.rotation.x = Math.PI / 2;
  icing.position.y = 0.03;
  icing.scale.set(1, 1, 0.75);
  lift.add(dough, icing);
  lift.rotation.z = 0.5;            // tipped toward the viewer
  return { group: g, lift };
}

function buildCake() {
  const g = new THREE.Group();
  cyl(g, [0.3, 0.3, 0.02], [0, 0, 0], paper(C.white));                 // plate
  cyl(g, [0.22, 0.22, 0.16], [0, 0.02, 0], paper(SPONGE));
  cyl(g, [0.225, 0.225, 0.045], [0, 0.15, 0], paper(PINK), { edges: 0, hull: 0.004 });
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const x = Math.sin(a) * 0.13, z = Math.cos(a) * 0.13;
    cyl(g, [0.008, 0.008, 0.09], [x, 0.195, z], paper(C.white), { edges: 0, hull: 0.002 }, 8);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc66e }));
    flame.position.set(x, 0.3, z);
    g.add(flame);
    flames.push(flame);
  }
  return { group: g, flames };
}

export function createProps() {
  const group = new THREE.Group();
  group.name = 'props';
  const donut = buildDonut(), cake = buildCake();
  donut.group.visible = cake.group.visible = false;
  group.add(donut.group, cake.group);
  const pop = { donut: 0, cake: 0 };   // 0..1 scale-in

  function place(prop, key, at, dt) {
    prop.group.visible = Boolean(at) || pop[key] > 0.01;
    pop[key] += ((at ? 1 : 0) - pop[key]) * Math.min(1, dt * 9);
    if (at) prop.group.position.set(at.x, 0, at.z);
    prop.group.scale.setScalar(Math.max(0.001, pop[key]));
  }

  return {
    group,
    update(state, time, dt) {
      place(donut, 'donut', state.donut, dt);
      place(cake, 'cake', state.cake, dt);
      if (donut.group.visible) {
        donut.lift.position.y = 0.34 + Math.sin(time * 3) * 0.05;
        donut.lift.rotation.y = time * 1.6;
      }
      if (cake.group.visible) {
        cake.flames.forEach((f, i) => f.scale.setScalar(0.85 + Math.sin(time * 11 + i * 2.1) * 0.2));
      }
    },
  };
}
