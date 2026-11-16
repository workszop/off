// ---- The director ----
// Chooses what the camera shows, so the office can be watched like a sitcom.
// Each frame it is told what is going on (who is where, who is speaking, who
// is chatting with whom, which office event is running) and answers with one
// shot: where the camera stands, what it looks at and how wide the lens is.
//
//   const director = createDirector({ bounds });
//   const shot = director.update(scene, dt);   // { key, kind, pos, target, fov }
//
// A shot's `key` changes when the director cuts; while the key stays the
// same the shot may still drift (people move), and the camera eases after it.
//
// How it decides:
//   1. Everything worth showing right now is a 'beat' with a score: a visitor
//      talking to Margo, an office event, the ghost turning up, someone
//      arriving, a chat, somebody saying a line, the character picked in the
//      toolbar, and the wide view of the room when nothing else is on.
//   2. The best beat wins, but a shot is held for a minimum time, and a beat
//      that has had its time rests for a while so the others get a turn.
//   3. A chat is covered the usual way: both people first, then whoever is
//      speaking, and both again for the last line. The camera stays on one
//      side of the pair for the whole chat, so they never appear to swap.
//
// No Three.js or DOM here, so the tests run it in Node.

import { reach } from './view.js';

const DEG = Math.PI / 180;
const EYE = 1.45;            // camera height for people shots
const MIN_HOLD = 3;          // seconds a shot stays before a better beat may replace it
const URGENT = 70;           // beats scoring this much may cut in sooner
const URGENT_HOLD = 1.2;     // but never sooner than this
const SUB_HOLD = 1.8;        // the same, between the shots within one chat
const NEAREST = 1.6;         // the camera never stands closer to its subject than this
const ARRIVAL_S = 5;         // how long someone coming in is worth watching

const len = (x, z) => Math.hypot(x, z) || 1;
const unit = (x, z) => { const l = len(x, z); return { x: x / l, z: z / l }; };
const turn = (d, a) => ({ x: d.x * Math.cos(a) + d.z * Math.sin(a), z: d.z * Math.cos(a) - d.x * Math.sin(a) });
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The widest lens (vertical field of view, degrees) that just fits a subject
// `halfWidth` wide and `halfHeight` tall at `dist` metres.
export function fovToFit(halfWidth, halfHeight, dist, aspect) {
  const across = Math.atan(Math.tan(Math.atan(halfWidth / dist)) / aspect);
  return clamp(2 * Math.max(across, Math.atan(halfHeight / dist)) / DEG, 22, 78);
}

export function createDirector({ bounds, clear = () => true, random = Math.random }) {
  let time = 0;
  let current = null;            // { beat, since, plan }
  let shot = null;
  let shotSince = 0;             // when the shot on screen began
  const rest = new Map();        // beat key -> time until which it rests
  const screenTime = new Map();  // character type -> seconds on screen
  const wasPresent = new Map();  // character type -> present last frame
  const arrivedAt = new Map();   // character type -> time they came in
  let masterTurn = 0;

  // Stand the camera `dist` metres from `at` along `dir`, at height `y`, but
  // never outside the room. Returns the position and the distance it got.
  function stand(at, dir, dist, y = EYE) {
    const room = reach({ x: at.x, y, z: at.z }, { x: dir.x, y: 0, z: dir.z }, bounds);
    const d = Math.min(dist, room);
    return { pos: { x: at.x + dir.x * d, y, z: at.z + dir.z * d }, dist: d };
  }

  // Is anyone standing within `r` metres of where the camera would be?
  let people = [];
  const crowded = (pos, r) => people.some(c => len(c.x - pos.x, c.z - pos.z) < r);

  // Toward the open middle of the room, a little to the front, so the back
  // windows end up behind the subject.
  const inward = p => unit(p.x * 0.4 - p.x, (p.z < 1.2 ? 3 : -1.5) - p.z);

  // The first of several directions from `at` that leaves room for the camera
  // and has a clear line to the subject.
  function vantage(at, dirs, dist, lookY, y = EYE) {
    let best = null;
    for (const dir of dirs) {
      const s = stand(at, dir, dist, y);
      if (s.dist < NEAREST) continue;
      best ??= { ...s, dir };
      if (!crowded(s.pos, 1.1) && clear(s.pos, { x: at.x, y: lookY, z: at.z })) return { ...s, dir };
    }
    return best ?? { ...stand(at, inward(at), dist, y), dir: inward(at) };
  }

  // ---- Shots ----

  const MASTERS = [
    { pos: { x: 0, y: 1.9, z: 3.45 }, target: { x: 0, y: 1.0, z: -0.6 } },
    { pos: { x: -5.2, y: 2.0, z: 3.3 }, target: { x: 0.8, y: 0.9, z: -1.0 } },
    { pos: { x: 5.2, y: 2.0, z: 3.3 }, target: { x: -0.8, y: 0.9, z: -1.0 } },
  ];
  const TALL_MASTER = { pos: { x: -5.5, y: 1.9, z: 0 }, target: { x: 0, y: 1.0, z: -0.2 } };

  function master(scene, plan) {
    const m = scene.aspect < 0.9 ? TALL_MASTER : MASTERS[plan.variant];
    return { kind: 'master', pos: m.pos, target: m.target, fov: scene.aspect < 0.9 ? 84 : 70 };
  }

  // One person, from the side they are facing (or, in a chat, from beside
  // the person they are talking to). Facing a wall or a cupboard, they are
  // taken from further round, in profile, before the camera settles for their back.
  function single(scene, c, plan, kind = 'single') {
    const small = c.type === 'ghost';
    const lookY = small ? 0.7 : 1.3, y = small ? 1.0 : EYE;
    if (!plan.dir) {
      const facing = { x: Math.sin(c.heading), z: Math.cos(c.heading) };
      plan.dir = vantage(c, plan.prefer ?? [facing, turn(facing, 0.6), turn(facing, -0.6), turn(facing, 1.2), turn(facing, -1.2), inward(c)], 2.7, lookY, y).dir;
    }
    const s = stand(c, plan.dir, 2.7, y);
    // Closer than planned (a wall behind the camera): widen the lens to match.
    const fov = clamp(2 * Math.atan(Math.tan((scene.aspect < 0.9 ? 21 : 16) * DEG) * 2.7 / s.dist) / DEG, 24, 70);
    return { kind, pos: s.pos, target: { x: c.x, y: lookY, z: c.z }, fov };
  }

  // Two people, seen square on from one side of the line between them.
  function twoShot(scene, a, b, plan) {
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const apart = len(b.x - a.x, b.z - a.z);
    if (!plan.side) {
      const axis = unit(b.x - a.x, b.z - a.z);
      const n = { x: -axis.z, z: axis.x };
      // Prefer the side with more room; between equals, the front of the room.
      const sides = [n, { x: -n.x, z: -n.z }].sort((p, q) =>
        (stand(mid, q, 6).dist + q.z * 0.5) - (stand(mid, p, 6).dist + p.z * 0.5));
      plan.side = vantage(mid, sides, 3.2, 1.2).dir;
    }
    const half = apart / 2 + 0.75;
    const want = clamp(half / Math.tan(24 * DEG) / Math.max(1, scene.aspect), 2.6, 5);
    const s = stand(mid, plan.side, want);
    return { kind: 'two', pos: s.pos, target: { x: mid.x, y: 1.2, z: mid.z }, fov: fovToFit(half, 1.05, s.dist, scene.aspect) };
  }

  // Something in the room: the printer, a donut on the floor, the cake.
  function insert(scene, at, plan, { dist = 3, lookY = 0.8, fov = 42, y = EYE } = {}) {
    plan.dir ??= vantage(at, [inward(at), turn(inward(at), 0.7), turn(inward(at), -0.7)], dist, lookY, y).dir;
    const s = stand(at, plan.dir, dist, y);
    return { kind: 'insert', pos: s.pos, target: { x: at.x, y: lookY, z: at.z }, fov: scene.aspect < 0.9 ? fov * 1.3 : fov };
  }

  // A fixed camera that turns to follow someone walking about.
  function follow(scene, c, plan) {
    const setUp = () => vantage(c, [inward(c), turn(inward(c), 0.8), turn(inward(c), -0.8)], 3.8, 1.1).pos;
    plan.pos ??= setUp();
    // They have walked up to the camera or far away from it: set up again (a cut).
    const d = len(c.x - plan.pos.x, c.z - plan.pos.z);
    if (d < 1.2 || d > 7.5) { plan.pos = setUp(); plan.moved = (plan.moved ?? 0) + 1; }
    return { kind: 'follow', pos: plan.pos, target: { x: c.x, y: c.type === 'ghost' ? 0.7 : 1.1, z: c.z }, fov: scene.aspect < 0.9 ? 58 : 46 };
  }

  // ---- A chat, shot by shot ----
  function chat(scene, beat, plan, age) {
    const a = scene.cast.find(c => c.type === beat.a), b = scene.cast.find(c => c.type === beat.b);
    const speaker = [a, b].filter(c => c.speaking).sort((p, q) => q.lineSeq - p.lineSeq)[0];
    const last = speaker && beat.turnsLeft === 0;
    let want = plan.sub;
    if (!want) want = 'two';
    else if (last) want = 'two';
    else if (speaker && (plan.sub === 'two' ? age > MIN_HOLD : plan.on !== speaker.type)) want = 'single';
    if (want !== plan.sub || (want === 'single' && speaker && plan.on !== speaker.type)) {
      if (!plan.sub || time - plan.subSince >= SUB_HOLD) {
        plan.sub = want;
        plan.on = want === 'single' ? speaker.type : null;
        plan.subSince = time;
        plan.single = {};
      }
    }
    const wide = twoShot(scene, a, b, plan);   // also fixes the side of the pair the camera keeps to
    if (plan.sub !== 'single') return { ...wide, sub: 'two' };
    const on = plan.on === a.type ? a : b, other = on === a ? b : a;
    const toOther = unit(other.x - on.x, other.z - on.z);
    // From beside the listener, on the camera's side of the pair.
    const dir = unit(toOther.x * 0.75 + plan.side.x * 0.66, toOther.z * 0.75 + plan.side.z * 0.66);
    plan.single.prefer ??= [dir, unit(toOther.x * 0.4 + plan.side.x * 0.9, toOther.z * 0.4 + plan.side.z * 0.9), plan.side];
    return { ...single(scene, on, plan.single), sub: `single:${on.type}` };
  }

  // ---- Beats ----
  // key: what it is (also how long it rests). score: how much it matters.
  // hold: the longest it stays on. rest: how long before it may come back.
  function beats(scene) {
    const list = [];
    const here = scene.cast.filter(c => c.present && c.visible);
    const least = Math.min(...here.map(c => screenTime.get(c.type) ?? 0), Infinity);
    const fresh = c => clamp(8 - ((screenTime.get(c.type) ?? 0) - least) * 0.2, 0, 8); // a little extra for whoever has been seen least
    const star = scene.star;

    const margo = here.find(c => c.withVisitor);
    if (margo) list.push({ key: 'visitor', score: 100, hold: Infinity, rest: 0, who: [margo.type], shoot: (plan) => single(scene, margo, plan, 'visitor') });

    const ev = scene.events;
    if (ev.donut) list.push({ key: 'donut', score: 85, hold: 12, rest: 8, who: [], shoot: plan => insert(scene, ev.donut, plan, { dist: 4.2, lookY: 0.5, fov: 54, y: 1.7 }) });
    if (ev.cake) list.push({ key: 'cake', score: 82, hold: 7, rest: 25, who: [], shoot: plan => insert(scene, ev.cake, plan, { dist: 3.8, lookY: 0.9, fov: 50, y: 2.0 }) });
    if (ev.printer) list.push({ key: 'jam', score: 80, hold: 6, rest: 25, who: [], shoot: plan => insert(scene, ev.printer, plan, { dist: 3.8, lookY: 0.9, fov: 48, y: 2.1 }) });
    if (ev.lamp) list.push({ key: 'lamp', score: 78, hold: 5, rest: 10, who: [], shoot: plan => insert(scene, ev.lamp, plan, { dist: 4, lookY: 1.4, fov: 50 }) });
    if (ev.meeting) list.push({ key: 'meeting', score: 60, hold: 8, rest: 20, who: [], shoot: plan => insert(scene, ev.meeting, plan, { dist: 4.8, lookY: 1.1, fov: 56, y: 2.0 }) });

    const ghost = here.find(c => c.type === 'ghost');
    if (ghost && !ghost.chat) list.push({ key: 'ghost', score: 70, hold: 5, rest: 40, who: ['ghost'], shoot: plan => follow(scene, ghost, plan) });

    for (const c of here) {
      const since = arrivedAt.get(c.type);
      if (since !== undefined && time - since < ARRIVAL_S && !c.chat) {
        list.push({ key: `arrive:${c.type}`, score: 65, hold: ARRIVAL_S, rest: 30, who: [c.type], shoot: plan => follow(scene, c, plan) });
      }
    }

    const seen = new Set();
    for (const c of here) {
      if (!c.chat || seen.has(c.chat)) continue;
      const other = here.find(o => o !== c && o.chat === c.chat);
      if (!other) continue;
      seen.add(c.chat);
      const beat = { key: `chat:${c.chat}`, a: c.type, b: other.type, turnsLeft: c.turnsLeft, hold: 45, rest: 0, who: [c.type, other.type] };
      beat.score = 50 + Math.max(fresh(c), fresh(other)) + (star && beat.who.includes(star) ? 15 : 0);
      beat.shoot = (plan, age) => chat(scene, beat, plan, age);
      list.push(beat);
    }

    // Anyone saying something on their own.
    for (const c of here) {
      if (!c.speaking || c.chat || c.withVisitor) continue;
      list.push({ key: `says:${c.type}:${c.lineSeq}`, score: 30 + fresh(c) + (c.type === star ? 15 : 0), hold: 9, rest: 0, who: [c.type], shoot: plan => single(scene, c, plan) });
    }

    const starred = star && here.find(c => c.type === star);
    if (starred) list.push({ key: `star:${star}`, score: 28, hold: 25, rest: 6, who: [star], shoot: plan => follow(scene, starred, plan) });

    // Nothing in particular: the room, then a look at someone, and round again.
    list.push({ key: 'master', score: 8, hold: 9, rest: 7, who: [], shoot: plan => master(scene, plan) });
    const staff = here.filter(c => c.type !== 'ghost');
    if (staff.length) {
      list.push({
        key: 'wander', score: 6, hold: 7, rest: 5, who: [],
        // Whoever has been seen least when the shot starts, and then the same person throughout.
        shoot: plan => {
          plan.on ??= [...staff].sort((p, q) => (screenTime.get(p.type) ?? 0) - (screenTime.get(q.type) ?? 0))[0].type;
          const c = staff.find(p => p.type === plan.on);
          return c ? { ...follow(scene, c, plan), who: [c.type] } : master(scene, { variant: 0 });
        },
      });
    }
    return list;
  }

  const resting = key => (rest.get(key) ?? 0) > time;

  function update(scene, dt) {
    time += dt;
    for (const c of scene.cast) {
      const was = wasPresent.get(c.type);
      if (c.present && was === false) arrivedAt.set(c.type, time);
      wasPresent.set(c.type, c.present);
    }

    people = scene.cast.filter(c => c.present && c.visible);
    const list = beats(scene);
    const value = b => b.score - (resting(b.key) ? 60 : 0);
    const best = list.reduce((p, q) => (value(q) > value(p) ? q : p));
    const live = current && list.find(b => b.key === current.beat.key);
    const age = current ? Math.min(time - current.since, time - shotSince) : 0; // how long this shot has been up

    const soonEnough = b => age >= MIN_HOLD || (value(b) >= URGENT && age >= URGENT_HOLD);
    let next = null;
    if (!live) {
      // What the shot was about is over. Stay on it until it has been up
      // long enough to read, then move on.
      if (current && shot && !soonEnough(best)) return shot;
      next = best;
    } else if (time - current.since >= live.hold) {
      // Had its time: rest it and move on.
      rest.set(live.key, time + live.rest);
      next = list.reduce((p, q) => (value(q) > value(p) ? q : p));
    } else if (best.key !== live.key && value(best) > value(live) && soonEnough(best)) next = best;

    if (next && next.key !== current?.beat.key) {
      const plan = {};
      if (next.key === 'master') plan.variant = masterTurn++ % MASTERS.length;
      current = { beat: next, since: time, plan };
    } else if (live) current.beat = live;

    const s = current.beat.shoot(current.plan, time - current.since);
    // Someone has walked up to the camera: lift it over their head.
    if (crowded(s.pos, 0.9) && s.pos.y < 2.3) s.pos = { ...s.pos, y: 2.3 };
    const who = s.who ?? current.beat.who;
    for (const type of who) screenTime.set(type, (screenTime.get(type) ?? 0) + dt);
    const key = [current.beat.key, s.sub, current.plan.moved].filter(p => p !== undefined && p !== null).join('/');
    // However the cut came about, the shot on screen gets a moment first.
    // (Only Margo answering a visitor cuts in at once.)
    if (shot && key !== shot.key && time - shotSince < URGENT_HOLD && current.beat.score < 100) return shot;
    if (!shot || key !== shot.key) shotSince = time;
    shot = { key, beat: current.beat.key, kind: s.kind, pos: s.pos, target: s.target, fov: s.fov, who };
    return shot;
  }

  return { update, get shot() { return shot; }, get time() { return time; } };
}
