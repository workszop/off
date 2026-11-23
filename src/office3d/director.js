// ---- The director ----
// Chooses what the camera shows, so the office can be watched like a sitcom.
// Each frame it is told what is going on (who is where, who is speaking, who
// is chatting with whom, which office event is running) and answers with one
// shot: where the camera stands, what it looks at and how wide the lens is.
//
//   const director = createDirector({ bounds });
//   const shot = director.update(scene, dt);   // { kind, pos, target, fov, cut, ease }
//
// `cut` is a counter: when it goes up, the camera jumps to the new shot.
// Otherwise it glides after the shot, at `ease` per second.
//
// The camera mostly moves, and seldom cuts:
//   1. Roaming. Most of the time the camera travels slowly between a handful
//      of places along the front and sides of the room, stopping for a while
//      at each. As it goes it turns toward whatever is going on (an office
//      event, the character picked in the toolbar, a chat, someone speaking)
//      and closes the lens on it a little. It stays with a subject for a
//      while and looks at the room again before turning to the next, so it
//      never flits from chat to chat.
//   2. One conversation in several gets a cut. Chats are counted as they
//      start, and every 6th to 12th one (a new random number each time) the
//      camera cuts to the two people and stays with them: square on from one
//      side, drifting in, leaning toward whoever is speaking. When they have
//      finished it glides back out to its roaming.
//   3. Margo answering a visitor also gets a cut, for as long as that lasts.
//
// No Three.js or DOM here, so the tests run it in Node.

import { reach } from './view.js';

const DEG = Math.PI / 180;
const EYE = 1.45;            // camera height for shots of people
const NEAREST = 1.6;         // the camera never stands closer to its subject than this
const COVER_EVERY = [6, 12]; // a cut to one chat in this many, a new random number each time
const CUT_GAP = 8;           // seconds that must pass between two cuts
const TRAVEL = 0.3;          // roaming speed, metres a second
const DWELL = [14, 26];      // seconds the roaming camera rests at each place
const STAY = 9;              // seconds the roaming camera stays with a subject before a better one may take over
const BREATHER = 6;          // seconds it looks at the room between two subjects
const URGENT = 4;            // subjects ranked this high are turned to at once
const TURN = 0.7;            // how fast the roaming camera turns to a new subject (per second)
const ZOOM = 0.45;           // how fast its lens opens and closes (per second)
const LINGER = 1.6;          // seconds a covered chat stays on screen after its last line
const GLIDE = 0.8;           // ease of the move back out to roaming (per second)
const GLIDE_S = 5;           // how long that slower ease lasts

const len = (x, z) => Math.hypot(x, z) || 1;
const unit = (x, z) => { const l = len(x, z); return { x: x / l, z: z / l }; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = t => t * t * (3 - 2 * t);
const toward = (from, to, k) => ({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k });

// The widest lens (vertical field of view, degrees) that just fits a subject
// `halfWidth` wide and `halfHeight` tall at `dist` metres.
export function fovToFit(halfWidth, halfHeight, dist, aspect) {
  const across = Math.atan(Math.tan(Math.atan(halfWidth / dist)) / aspect);
  return clamp(2 * Math.max(across, Math.atan(halfHeight / dist)) / DEG, 22, 78);
}

// Where the roaming camera stops: along the front wall and down the sides.
const PLACES = [
  { x: 0, y: 1.9, z: 3.45 }, { x: -3.2, y: 1.8, z: 3.4 }, { x: 3.2, y: 1.8, z: 3.4 },
  { x: -5.2, y: 2.0, z: 2.6 }, { x: 5.2, y: 2.0, z: 2.6 },
  { x: -5.3, y: 1.9, z: 0.2 }, { x: 5.3, y: 1.9, z: 0.3 },
];

export function createDirector({ bounds, clear = () => true, random = Math.random }) {
  const between = ([lo, hi]) => lo + random() * (hi - lo);
  const coverAfter = () => COVER_EVERY[0] + Math.floor(random() * (COVER_EVERY[1] - COVER_EVERY[0] + 1));

  let time = 0;
  let shot = null;
  let cuts = 0;                  // goes up with every cut
  let lastCut = -Infinity;
  let people = [];

  // Roaming.
  const roam = {
    pos: { ...PLACES[0] }, from: { ...PLACES[0] }, to: { ...PLACES[0] }, t: 1, T: 1, restUntil: between(DWELL),
    look: { x: 0, y: 1.0, z: -0.4 },   // where it is looking now
    fov: 66,
    subject: null, since: 0, freeAt: 0, // what it has turned to, since when, and when it may turn again
  };

  // Counting chats toward the next cut.
  const chatsSeen = new Set();
  let chatsSince = 0;
  let coverAt = coverAfter();
  let cover = null;              // the chat being covered: { id, a, b, side, since, over, last }
  let visitor = null;            // Margo with a visitor: { dir }
  let glideUntil = 0;

  const crowded = (pos, r) => people.some(c => len(c.x - pos.x, c.z - pos.z) < r);

  // Stand the camera `dist` metres from `at` along `dir`, at height `y`, but
  // never outside the room. Returns the position and the distance it got.
  function stand(at, dir, dist, y = EYE) {
    const room = reach({ x: at.x, y, z: at.z }, { x: dir.x, y: 0, z: dir.z }, bounds);
    const d = Math.min(dist, room);
    return { pos: { x: at.x + dir.x * d, y, z: at.z + dir.z * d }, dist: d };
  }

  // The first of several directions from `at` that leaves room for the camera
  // and has a clear line to the subject.
  function vantage(at, dirs, dist, lookY, y = EYE) {
    let best = null;
    for (const dir of dirs) {
      const s = stand(at, dir, dist, y);
      if (s.dist < NEAREST) continue;
      best ??= dir;
      if (!crowded(s.pos, 1.1) && clear(s.pos, { x: at.x, y: lookY, z: at.z })) return dir;
    }
    return best ?? unit(-at.x || 0.01, 2 - at.z);
  }

  // ---- Roaming ----

  // What is worth turning to. `rank` decides who wins; `tight` is how far
  // across the subject is, for the lens.
  function subjects(scene, here) {
    const list = [];
    const ev = scene.events;
    const at = (key, rank, p, y, tight) => p && list.push({ key, rank, x: p.x, y, z: p.z, tight });
    at('donut', 5, ev.donut, 0.5, 2.6);
    at('cake', 5, ev.cake, 0.9, 2.2);
    at('jam', 5, ev.printer, 0.9, 2.2);
    at('lamp', 5, ev.lamp, 1.3, 2.4);
    at('meeting', 4, ev.meeting, 1.1, 2.8);
    at('party', 3, ev.party, 1.0, 3.4);
    at('show', 3, ev.show, 1.1, 3.6);
    at('ghost', 4, here.find(c => c.type === 'ghost'), 0.7, 1.6);
    if (scene.star) at(`star:${scene.star}`, 3.5, here.find(c => c.type === scene.star), 1.1, 1.6);
    const seen = new Set();
    for (const c of here) {
      if (!c.chat || seen.has(c.chat)) continue;
      const other = here.find(o => o !== c && o.chat === c.chat);
      if (!other) continue;
      seen.add(c.chat);
      at(`chat:${c.chat}`, 2, { x: (c.x + other.x) / 2, z: (c.z + other.z) / 2 }, 1.2, 1.9);
    }
    for (const c of here) if (c.speaking && !c.chat) at(`says:${c.type}`, 1, c, c.type === 'ghost' ? 0.7 : 1.25, 1.5);
    return list;
  }

  function roaming(scene, here, dt) {
    // Travel, rest, pick the next place.
    if (roam.t < 1) {
      roam.t = Math.min(1, roam.t + dt / roam.T);
      roam.pos = toward(roam.from, roam.to, smooth(roam.t));
      if (roam.t === 1) roam.restUntil = time + between(DWELL);
    } else if (time >= roam.restUntil) {
      const options = PLACES.filter(p => {
        const d = Math.hypot(p.x - roam.pos.x, p.z - roam.pos.z);
        return d > 1 && d < 6.5 && len(p.x - roam.look.x, p.z - roam.look.z) > 2.5;
      });
      if (options.length) {
        roam.from = { ...roam.pos };
        roam.to = options[Math.floor(random() * options.length)];
        roam.T = Math.max(4, Math.hypot(roam.to.x - roam.from.x, roam.to.z - roam.from.z) / TRAVEL);
        roam.t = 0;
      } else roam.restUntil = time + 2;
    }

    // Turn to a subject and stay with it. When it is over, look at the room
    // for a moment before turning to the next (unless that one is urgent).
    const list = subjects(scene, here);
    const best = list.reduce((p, q) => (!p || q.rank > p.rank ? q : p), null);
    let on = roam.subject && list.find(s => s.key === roam.subject);
    if (on) {
      if (best.rank >= on.rank + 1 && (best.rank >= URGENT || time - roam.since > STAY)) on = best;
    } else {
      if (roam.subject) { roam.subject = null; roam.freeAt = time + BREATHER; }
      if (best && (best.rank >= URGENT || time >= roam.freeAt)) on = best;
    }
    if (on && on.key !== roam.subject) { roam.subject = on.key; roam.since = time; }

    // With nothing on, look at the middle of wherever people are.
    let goal, wide = 66;
    if (on) {
      goal = on;
      const d = Math.hypot(on.x - roam.pos.x, on.z - roam.pos.z);
      wide = clamp(fovToFit(on.tight, 1.25, Math.max(d, 2), scene.aspect), 36, 66);
    } else {
      const staff = here.filter(c => c.type !== 'ghost');
      const n = staff.length || 1;
      goal = { x: staff.reduce((s, c) => s + c.x, 0) / n * 0.5, y: 1.0, z: staff.reduce((s, c) => s + c.z, 0) / n * 0.5 - 0.3 };
    }
    if (scene.aspect < 0.9) wide = Math.min(84, wide * 1.3);
    roam.look = toward(roam.look, goal, 1 - Math.exp(-dt * TURN));
    roam.fov += (wide - roam.fov) * (1 - Math.exp(-dt * ZOOM));
    return { kind: 'roam', pos: roam.pos, target: roam.look, fov: roam.fov, on: roam.subject, who: [] };
  }

  // ---- A covered chat ----
  // Two people, seen square on from one side of the line between them. The
  // camera keeps to that side, drifts in over the chat and leans toward
  // whoever is speaking.
  function covered(scene, a, b) {
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const apart = len(b.x - a.x, b.z - a.z);
    if (!cover.side) {
      const axis = unit(b.x - a.x, b.z - a.z);
      const n = { x: -axis.z, z: axis.x };
      // Prefer the side with more room; between equals, the front of the room.
      const sides = [n, { x: -n.x, z: -n.z }].sort((p, q) =>
        (stand(mid, q, 6).dist + q.z * 0.5) - (stand(mid, p, 6).dist + p.z * 0.5));
      cover.side = vantage(mid, sides, 3.2, 1.2);
    }
    const half = apart / 2 + 0.75;
    const closer = 1 - 0.18 * smooth(clamp((time - cover.since) / 14, 0, 1));
    const want = clamp(half / Math.tan(24 * DEG) / Math.max(1, scene.aspect), 2.8, 5) * closer;
    const s = stand(mid, cover.side, Math.max(want, NEAREST + 0.4));
    const speaker = [a, b].filter(c => c.speaking).sort((p, q) => q.lineSeq - p.lineSeq)[0];
    const lean = speaker ? 0.3 : 0;
    const target = { x: mid.x + ((speaker?.x ?? mid.x) - mid.x) * lean, y: 1.2, z: mid.z + ((speaker?.z ?? mid.z) - mid.z) * lean };
    return { kind: 'two', pos: s.pos, target, fov: fovToFit(half, 1.05, s.dist / closer, scene.aspect), who: [a.type, b.type] };
  }

  // Margo, from the side she is facing: the visitor's side.
  function withVisitor(scene, margo) {
    visitor.dir ??= vantage(margo, [{ x: Math.sin(margo.heading), z: Math.cos(margo.heading) }, unit(-margo.x || 0.01, 2 - margo.z)], 2.7, 1.3);
    const s = stand(margo, visitor.dir, 2.7);
    const fov = clamp(2 * Math.atan(Math.tan((scene.aspect < 0.9 ? 21 : 16) * DEG) * 2.7 / s.dist) / DEG, 24, 70);
    return { kind: 'visitor', pos: s.pos, target: { x: margo.x, y: 1.3, z: margo.z }, fov, who: ['margo'] };
  }

  function update(scene, dt) {
    time += dt;
    const here = people = scene.cast.filter(c => c.present && c.visible);

    // Count chats as they start; decide whether this one gets the cut.
    const pairs = new Map();
    for (const c of here) if (c.chat) (pairs.get(c.chat) ?? pairs.set(c.chat, []).get(c.chat)).push(c);
    for (const [id, pair] of pairs) {
      if (chatsSeen.has(id) || pair.length < 2) continue;
      chatsSeen.add(id);
      chatsSince++;
      if (chatsSince >= coverAt && !cover && !visitor && time - lastCut >= CUT_GAP) {
        cover = { id, a: pair[0].type, b: pair[1].type, side: null, since: time, over: null, last: null };
        chatsSince = 0;
        coverAt = coverAfter();
        cuts++;
        lastCut = time;
      }
    }

    const margo = here.find(c => c.withVisitor);
    if (margo && !visitor) { visitor = {}; cover = null; cuts++; lastCut = time; }
    if (!margo && visitor) { visitor = null; glideUntil = time + GLIDE_S; }

    // The roaming camera keeps travelling even while another shot is on, so
    // it is somewhere sensible when the camera comes back to it.
    const wandering = roaming(scene, here, dt);
    let s = wandering;
    if (visitor) s = withVisitor(scene, margo);
    else if (cover) {
      const a = here.find(c => c.type === cover.a), b = here.find(c => c.type === cover.b);
      if (pairs.get(cover.id)?.length === 2 && a && b) { cover.last = covered(scene, a, b); cover.over = null; }
      else cover.over ??= time;          // the chat has ended: hold the frame a moment
      if (!cover.last || (cover.over !== null && time - cover.over > LINGER)) { cover = null; glideUntil = time + GLIDE_S; }
      else s = cover.last;
    }

    // Someone has walked up to the camera: lift it over their head.
    if (crowded(s.pos, 0.9) && s.pos.y < 2.3) s = { ...s, pos: { ...s.pos, y: 2.3 } };
    const ease = s.kind !== 'roam' ? 1.5 : time < glideUntil ? GLIDE : 3;
    shot = { kind: s.kind, pos: s.pos, target: s.target, fov: s.fov, who: s.who, on: s.on ?? null, cut: cuts, ease };
    return shot;
  }

  return {
    update,
    get shot() { return shot; },
    get time() { return time; },
    // How many more chats until one gets the cut.
    get chatsToCut() { return Math.max(0, coverAt - chatsSince); },
  };
}
