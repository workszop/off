// ---- Speech bubbles ----
// One paper card per character, shown over their head while they have a line
// (see sim.js: `line` and `lineSeq`).
//
//   const bubbles = createBubbles(cast, { names, accents });   // adds c.bubble
//   bubbles.sync();            // show / hide / change text to match the sim
//   bubbles.place(camera);     // keep each bubble over its speaker
//
// A bubble's size is measured once per line, not every frame, and it is moved
// with the CSS `translate` property, which the browser can apply without
// redoing layout. (`transform` is left free for the pop-in animation.)

import * as THREE from 'three';

const MARGIN = 8;   // px kept clear at the window edges
const GAP = 12;     // px between the bubble and the speaker's head

export function createBubbles(cast, { names, accents, headY }) {
  const proj = new THREE.Vector3();
  const items = cast.map(c => {
    const el = document.createElement('div');
    el.className = 'speech-bubble';
    el.hidden = true;
    el.style.setProperty('--c', `var(${accents[c.type]})`);
    const name = document.createElement('div');
    name.className = 'bubble-name';
    name.textContent = names[c.type];
    const text = document.createElement('div');
    el.append(name, text);
    document.body.appendChild(el);
    c.bubble = el;
    return { c, el, text, seq: -1, w: 0, h: 0, measured: false, x: NaN, y: NaN, px: NaN, culled: false };
  });

  // A resize can change the bubble's width (phone layout): measure again.
  window.addEventListener('resize', () => { for (const b of items) b.measured = false; });

  return {
    sync() {
      for (const b of items) {
        const { c, el } = b;
        if (c.line === null) {
          if (!el.hidden) el.hidden = true;
          continue;
        }
        if (b.seq === c.lineSeq && !el.hidden) continue;
        b.seq = c.lineSeq;
        b.text.textContent = c.line;
        b.measured = false;
        el.hidden = false;
        el.style.animation = 'none';
        void el.offsetWidth; // restart the pop-in animation
        el.style.animation = '';
      }
    },

    place(camera) {
      const w = window.innerWidth, h = window.innerHeight;
      for (const b of items) {
        const { c, el } = b;
        if (el.hidden) continue;
        proj.set(c.pos.x, headY(c), c.pos.y).project(camera);
        const culled = proj.z > 1;
        if (culled !== b.culled) {
          b.culled = culled;
          el.style.visibility = culled ? 'hidden' : '';
        }
        if (culled) continue;
        if (!b.measured) {
          b.w = el.offsetWidth;
          b.h = el.offsetHeight;
          b.measured = true;
          b.x = b.y = b.px = NaN;
        }
        const x = (proj.x + 1) / 2 * w, y = (1 - proj.y) / 2 * h;
        const left = Math.round(THREE.MathUtils.clamp(x - b.w / 2, MARGIN, w - b.w - MARGIN));
        const top = Math.round(Math.max(MARGIN, y - b.h - GAP));
        const pointer = Math.round(THREE.MathUtils.clamp(x - left, 14, b.w - 14));
        if (left !== b.x || top !== b.y) {
          b.x = left;
          b.y = top;
          el.style.translate = `${left}px ${top}px`;
        }
        if (pointer !== b.px) {
          b.px = pointer;
          el.style.setProperty('--pointer-x', `${pointer}px`);
        }
      }
    },
  };
}
