// ---- Office simulation ----
// Who walks where and why, who talks to whom about what, who is at work, and
// when the ghost visits. No Three.js and no DOM in here: the page (office.js)
// reads each character's state every frame and draws it, and tests can run
// the office in plain Node. Office events (printer jam, donut race, ...) are
// in events.js, shows (the band, ...) in shows.js. Mr. T, the guest who drops
// by (data.js: GUEST), is at the end of "Coming and going".
//
//   const sim = createSim({ nav, spots, types, phase: () => 'midday' });
//   sim.update(dt);              // advance by dt seconds
//   sim.cast[0].pos              // { x, y } on the floor (y is world z)
//   sim.cast[0].line             // what they are saying now, or null
//   sim.log                      // [{ time, text }] what has happened so far
//
// A character's `line` is the text of their speech bubble; `lineSeq` goes up
// by one every time they start a new line (also when the text repeats).
//
// Why characters move: each has four needs (coffee, focus, rest, social)
// that grow over time at rates set by their temperament. When one is strong
// enough they go and deal with it; otherwise they wander.

import {
  DIALOGUE_BANKS, COFFEE_DIALOGUE, ACTIVITY_LINES, MARGO_LINES, DAY_PHASES, PARTY_PHASE, SHOWS,
  GLASS_TAP_DIALOGUE, ARRIVE_DIALOGUE, LEAVE_DIALOGUE, LAMP_FLICKER_DIALOGUE, TOPICS, NAMES, DIRECTED_LINES, GUEST,
} from './data.js';
import { createEvents, shuffled } from './events.js';
import { createShows } from './shows.js';

const WALK_SPEED = 1.05, TURN_RATE = 4;
const DRIVE_TURN = 2.2;      // radians a second a character turns in the visitor's hands
const DRIVE_REST = 4;        // seconds they stand where they were left before going their own way again
const START = [[-1.2, 0.2], [0.2, -0.6], [1.0, 0.8], [-0.4, 1.6], [2.4, 0.2]];

// Lines said on arriving at a piece of furniture.
const SPOT_LINES = {
  desk_cluster: ACTIVITY_LINES.desk_cluster,
  coffee_station: ACTIVITY_LINES.coffee_station,
  table_cafe: COFFEE_DIALOGUE,
  printer: ACTIVITY_LINES.printer,
  whiteboard: ACTIVITY_LINES.whiteboard,
  couch_2seater: ACTIVITY_LINES.couch_2seater,
  armchair: ACTIVITY_LINES.couch_2seater,
};

// ---- Needs ----
// Where each need is met, and how long the visit lasts (seconds).
const NEEDS = {
  coffee: { spots: ['coffee_station', 'table_cafe'], stay: [4, 9] },
  focus: { spots: ['desk_cluster', 'whiteboard', 'printer'], stay: [7, 15] },
  rest: { spots: ['couch_2seater', 'armchair', 'window'], stay: [8, 16] },
  social: { spots: [], stay: [2, 4] },
};
const NEED_KEYS = Object.keys(NEEDS);
const NEED_THRESHOLD = 0.4;   // below this, nothing is pressing: wander
// Seconds for a need to go from 0 to 1. Short = it comes up often.
const TEMPERAMENT = {
  andy: { coffee: 70, focus: 170, rest: 120, social: 130 },   // runs on coffee
  jazz: { coffee: 130, focus: 160, rest: 220, social: 60 },   // runs on people
  olex: { coffee: 110, focus: 60, rest: 240, social: 180 },   // runs on work
  margo: { coffee: 420, focus: 95, rest: 85, social: 280 },   // tickets, then her serial
};

const CHAT_RANGE = 2.2;      // metres between two idle characters to start chatting
const CHAT_GAP_S = 0.45;     // pause between turns
const TOPIC_CHANCE = 0.75;   // how often a chat sticks to one subject
const DIRECTED_CHANCE = 0.3; // how often a turn is a line meant for the other person
const FADE_S = 0.7;          // staff appearing / disappearing at the door
const GHOST_FADE_S = 1.8;
const LOG_LIMIT = 200;
const RECENT_LINES = 14;     // how many of a character's latest lines are not repeated

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// Long enough to read: 1.8 s plus 45 ms a character, 3.5 to 8 s.
const readSeconds = text => Math.min(8, Math.max(3.5, 1.8 + text.length * 0.045));

// Each character's general lines sorted by topic: type -> topic key -> lines.
const TOPIC_LINES = Object.fromEntries(Object.entries(DIALOGUE_BANKS).map(([type, lines]) => [
  type,
  Object.fromEntries(TOPICS.map(t => [t.key, lines.filter(l => t.match.test(l))])),
]));

// nav: a NavGrid. spots: places to stand ({ x, z, heading, type }).
// types: the cast, in order. phase: () => current DAY_PHASES key.
// landmarks: { lamp, whiteboard, printer } floor positions ({ x, z }) of
// things events happen around. random: () => 0..1 (defaults to Math.random,
// read at call time so a seeded Math.random still applies). guestRandom: the
// guest's own stream of random numbers. Everything he rolls comes from it, so
// the staff's day is the same with or without him until he walks in.
const GUEST_SEED = 20261124;
function ownStream(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function createSim({ nav, spots, types, phase, landmarks = {}, random = () => Math.random(), guestRandom = ownStream(GUEST_SEED) }) {
  let time = 0;
  const usableSpots = spots.filter(s => nav.freeAt(s.x, s.z));
  const door = usableSpots.find(s => s.type === 'door') ?? null;
  const between = ([lo, hi]) => lo + random() * (hi - lo);

  // A running show replaces the time of day, as the party does: the page
  // passes its key as the phase.
  const phaseInfo = () => {
    const key = phase();
    if (key === PARTY_PHASE.key) return PARTY_PHASE;
    if (Object.hasOwn(SHOWS, key)) return SHOWS[key];
    return DAY_PHASES.find(p => p.key === key) ?? {};
  };
  // Margo lives in the office and the ghost keeps its own hours; the rest
  // work the shifts in DAY_PHASES[].staff.
  const isStaff = type => type !== 'margo' && type !== 'ghost';
  // The guest comes and goes through the door as the staff do, but on his own
  // clock: he is due while a visit is on (`visit.due`), or while a show that
  // lists him in its staff runs.
  const isGuest = type => Boolean(door) && type === GUEST.type;
  const visit = { due: false, at: 0, stroll: null, strolled: false, calledAt: 0 };
  const showWantsGuest = () => (phaseInfo().staff ?? []).includes(GUEST.type);
  const onShift = type => {
    if (!isStaff(type) || !door) return true;
    if (isGuest(type)) return visit.due || showWantsGuest();
    return (phaseInfo().staff ?? types).includes(type);
  };
  // Whose dice: the guest rolls his own.
  const dice = type => (isGuest(type) ? guestRandom : random);

  const cast = types.map((type, i) => {
    const [x, y] = START[i % START.length];
    const here = onShift(type);
    const random = dice(type);
    return {
      type, pos: { x, y }, heading: random() * Math.PI * 2, speed: 0,
      path: [], spot: null, dest: null, goal: null, wait: 1 + random() * 3, blocked: 0, pushUntil: 0,
      stroll: null,              // the guest's walk round the room, while he is on it (updateGuest)
      needs: Object.fromEntries(NEED_KEYS.map(k => [k, random() * 0.5])),
      chat: null, chatReady: 4 + random() * 6, nextRemark: 8 + random() * 10,
      line: null, lineSeq: 0, sayUntil: 0,
      present: here, opacity: here ? 1 : 0, fade: 0,
      shift: here ? 'in' : 'out', shiftAt: 0,   // in | leaving | out, and when to change
      busy: null,                // the office event or show this character is part of
      look: null,                // { x, z, until }: something to face for a moment
      talkingToVisitor: false,
      drive: null,               // { move, turn }: the visitor is steering (see drive())
      driving: false,            // ...and did so this frame
    };
  });
  const margo = cast.find(c => c.type === 'margo');
  const ghost = cast.find(c => c.type === 'ghost');
  const guest = cast.find(c => isGuest(c.type)) ?? null;
  if (guest) visit.at = GUEST.firstS[0] + guestRandom() * (GUEST.firstS[1] - GUEST.firstS[0]);
  // Where a character looks while talking to the visitor (the camera).
  const visitor = { x: 0, z: 10 };

  const chatMultiplier = () => phaseInfo().chat ?? 1;
  // Margo is a construct: the evening/night quiet doesn't apply to her.
  const chatMultiplierFor = c => (c.type === 'margo' ? Math.max(1, chatMultiplier()) : chatMultiplier());
  const idle = c => c.present && c.shift === 'in' && !c.path.length && !c.chat && !c.talkingToVisitor && !c.busy && !c.driving && !c.stroll;
  // Free to be pulled into something (an event, a reaction). The guest on
  // his rounds is passing through: he joins nothing and chats to nobody.
  const free = c => c.present && c.shift === 'in' && !c.chat && !c.talkingToVisitor && !c.busy && !c.stroll;
  const distance = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);

  // ---- Log and delayed actions ----

  const log = [];
  const lastLogged = new Map();
  // Record something that happened. With `every`, entries of the same kind
  // are at least that many seconds apart.
  function record(text, { kind = 'note', every = 0 } = {}) {
    if (every && time - (lastLogged.get(kind) ?? -Infinity) < every) return;
    lastLogged.set(kind, time);
    log.push({ time, kind, text });
    if (log.length > LOG_LIMIT) log.shift();
  }

  const pending = [];
  // Run fn after `delay` seconds of office time.
  function later(delay, fn) { pending.push({ at: time + delay, fn }); }
  function runPending() {
    for (let i = pending.length - 1; i >= 0; i--) {
      if (time >= pending[i].at) pending.splice(i, 1)[0].fn();
    }
  }

  // ---- Walking ----

  // Walk to a point. `face` is a point to look at on arrival.
  function sendTo(c, x, z, { face = null, heading = null } = {}) {
    c.spot = null;
    c.goal = null;
    c.dest = { x, z, heading, face };
    c.path = nav.path(c.pos.x, c.pos.y, x, z) || [];
    c.blocked = 0;
  }

  // A free floor point about r metres from (x, z), or null.
  function pointNear(x, z, r, startAngle = random() * Math.PI * 2) {
    for (const radius of [r, r + 0.3, r - 0.3, r + 0.6]) {
      for (let i = 0; i < 10; i++) {
        const a = startAngle + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * (Math.PI / 5);
        const px = x + Math.sin(a) * radius, pz = z + Math.cos(a) * radius;
        if (nav.freeAt(px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  }

  const takenSpots = c => new Set(cast.filter(o => o !== c && o.present && o.spot).map(o => o.spot));

  function wander(c) {
    const taken = takenSpots(c);
    const options = usableSpots.filter(s => !taken.has(s) && Math.hypot(s.x - c.pos.x, s.z - c.pos.y) > 1.2);
    let dest;
    if (options.length && random() < 0.6) {
      dest = options[Math.floor(random() * options.length)];
      c.spot = dest;
    } else {
      const [x, z] = nav.randomFree(random);
      dest = { x, z, heading: null };
      c.spot = null;
    }
    c.goal = null;
    c.dest = dest;
    c.path = nav.path(c.pos.x, c.pos.y, dest.x, dest.z) || [];
    c.blocked = 0;
  }

  function chooseDestination(c) {
    const temper = TEMPERAMENT[c.type];
    if (!temper) { wander(c); return; } // the ghost just drifts
    // The most pressing need, with a little noise so days differ.
    let need = null, best = NEED_THRESHOLD;
    for (const key of NEED_KEYS) {
      const v = c.needs[key] + random() * 0.25;
      if (v > best) { best = v; need = key; }
    }
    if (!need) { wander(c); return; }

    if (need === 'social') {
      // Go and stand next to whoever is nearest and available.
      const others = cast.filter(o => o !== c && o.type !== 'ghost' && free(o)).sort((a, b) => distance(c, a) - distance(c, b));
      const friend = others[0];
      const at = friend && pointNear(friend.pos.x, friend.pos.y, 1.1);
      if (!at) { c.needs.social = 0.2; wander(c); return; }
      sendTo(c, at.x, at.z, { face: { x: friend.pos.x, z: friend.pos.y } });
      c.goal = 'social';
      return;
    }
    const taken = takenSpots(c);
    let options = usableSpots.filter(s => NEEDS[need].spots.includes(s.type) && !taken.has(s) && s !== c.spot);
    // Margo's rest is her serial, in the armchair, whenever it is free.
    const armchair = c.type === 'margo' && need === 'rest' && options.find(s => s.type === 'armchair');
    if (armchair) options = [armchair];
    if (!options.length) { c.needs[need] *= 0.6; wander(c); return; }
    const dest = options[Math.floor(random() * options.length)];
    c.spot = dest;
    c.goal = need;
    c.dest = dest;
    c.path = nav.path(c.pos.x, c.pos.y, dest.x, dest.z) || [];
    c.blocked = 0;
  }

  function arrived(c) {
    if (c.shift === 'leaving') { c.fade = -1; return; } // at the door: out they go
    if (c.busy || c.stroll) return;                      // the event (or his round) decides what happens next
    if (c.goal) {
      c.needs[c.goal] = 0;
      c.wait = between(NEEDS[c.goal].stay);
      if (c.goal === 'social') c.chatReady = Math.min(c.chatReady, time + 0.4);
    }
    if (c.type === 'margo' && c.spot?.type === 'armchair') {
      c.wait = 20 + random() * 20; // a whole scene of Orbital Tidewater
      say(c, pickLine('margo', ACTIVITY_LINES.armchair));
      return;
    }
    const bank = c.spot && SPOT_LINES[c.spot.type];
    if (bank && random() < 0.6) say(c, pickLine(c.type, bank));
  }

  function tick(c, dt) {
    const temper = TEMPERAMENT[c.type];
    if (temper) for (const key of NEED_KEYS) c.needs[key] = Math.min(1, c.needs[key] + dt / temper[key]);
    if (c.look && time > c.look.until) c.look = null;

    // In the visitor's hands: walk where they steer, round the furniture.
    // Left alone, the character stands for a moment, then carries on with
    // their own day (and may well chat to whoever they were walked up to).
    c.driving = false;
    if (c.drive && (c.drive.move || c.drive.turn) && c.present && c.shift === 'in' && !c.talkingToVisitor) {
      const { move, turn } = c.drive;
      Object.assign(c, { path: [], spot: null, dest: null, goal: null, blocked: 0, look: null, driving: true });
      c.wait = Math.max(c.wait, DRIVE_REST);
      c.heading += turn * DRIVE_TURN * dt;
      const pace = move > 0 ? move : move * 0.6;   // backwards is slower
      c.speed += (Math.abs(pace) - c.speed) * Math.min(1, dt * 6);
      const step = WALK_SPEED * pace * dt, sx = Math.sin(c.heading) * step, sz = Math.cos(c.heading) * step;
      // Blocked straight ahead: slide along whichever way is open.
      if (nav.freeAt(c.pos.x + sx, c.pos.y + sz)) { c.pos.x += sx; c.pos.y += sz; }
      else if (nav.freeAt(c.pos.x + sx, c.pos.y)) c.pos.x += sx;
      else if (nav.freeAt(c.pos.x, c.pos.y + sz)) c.pos.y += sz;
      else c.speed = 0;
      return;
    }

    let wantSpeed = 0, wantHeading = c.heading;
    if (c.talkingToVisitor) {
      c.path = [];
      c.wait = Math.max(c.wait, 2);
      wantHeading = Math.atan2(visitor.x - c.pos.x, visitor.z - c.pos.y);
    } else if (c.look && !c.busy) {
      // Something caught their attention: stop and face it.
      c.wait = Math.max(c.wait, 0.5);
      wantHeading = Math.atan2(c.look.x - c.pos.x, c.look.z - c.pos.y);
    } else if (c.path.length) {
      const [wx, wz] = c.path[0];
      const dx = wx - c.pos.x, dz = wz - c.pos.y, d = Math.hypot(dx, dz);
      if (d < 0.12) {
        c.path.shift();
        if (!c.path.length) { c.wait = (c.type === 'ghost' ? 2 : 3) + dice(c.type)() * 5; arrived(c); }
      } else {
        wantHeading = Math.atan2(dx, dz);
        wantSpeed = c.path.length === 1 ? Math.min(1, d / 0.6 + 0.25) : 1;
      }
      // Give way to anyone close in front. (Not in a donut race: nobody
      // is that polite, and waiting for each other would leave it uneaten.)
      const ahead = c.busy?.type !== 'donut' && time >= c.pushUntil && cast.some(o => {
        if (o === c || !o.present) return false;
        const ox = o.pos.x - c.pos.x, oz = o.pos.y - c.pos.y, od = Math.hypot(ox, oz);
        return od < 0.75 && (ox * Math.sin(c.heading) + oz * Math.cos(c.heading)) / od > 0.45;
      });
      if (ahead) {
        wantSpeed = 0;
        c.blocked += dt;
        if (c.blocked > 1.6 + dice(c.type)()) {
          if (c.shift === 'leaving') {
            // People heading for the door together can end up waiting for
            // each other: squeeze past for a moment.
            c.blocked = 0;
            c.pushUntil = time + 2 + dice(c.type)() * 2;
            c.path = nav.path(c.pos.x, c.pos.y, door.x, door.z) || [];
            if (!c.path.length) c.fade = -1;
          }
          else if (c.busy || c.stroll) { c.path = []; }  // close enough: stop here
          else chooseDestination(c);
        }
      } else c.blocked = 0;
    } else {
      const d = c.dest;
      if (d?.face) wantHeading = Math.atan2(d.face.x - c.pos.x, d.face.z - c.pos.y);
      else if (d?.heading != null) wantHeading = d.heading;
      if (!c.busy && !c.stroll && c.shift === 'in') {
        c.wait -= dt;
        if (c.wait <= 0) chooseDestination(c);
      }
    }
    c.heading += clamp(angleDelta(c.heading, wantHeading), -TURN_RATE * dt, TURN_RATE * dt);
    const align = Math.max(0, Math.cos(angleDelta(c.heading, wantHeading)));
    c.speed += (wantSpeed * align - c.speed) * Math.min(1, dt * 6);
    c.pos.x += Math.sin(c.heading) * WALK_SPEED * c.speed * dt;
    c.pos.y += Math.cos(c.heading) * WALK_SPEED * c.speed * dt;
  }

  // ---- Coming and going ----
  // Staff arrive through the door when their shift starts and walk out of it
  // when it ends, a little apart from each other.

  function updateShifts(dt) {
    for (const c of cast) {
      if (!isStaff(c.type)) continue;
      // Fading in or out at the door.
      if (c.fade) {
        c.opacity = clamp(c.opacity + c.fade * dt / FADE_S, 0, 1);
        if (c.opacity === 1) c.fade = 0;
        else if (c.opacity === 0) {
          c.fade = 0;
          c.present = false;
          c.shift = 'out';
          c.shiftAt = 0;
          c.spot = null;
          c.line = null;
          // The guest's next visit is counted from the moment he is out.
          if (c === guest) visit.at = time + guestBetween(GUEST.awayS);
          else record(`${NAMES[c.type]} went home.`, { kind: 'shift' });
        }
        continue;
      }
      const due = onShift(c.type);
      if (c.shift === 'in' && !due) {
        // The guest goes when his rounds are done; the staff, a little apart.
        c.shiftAt ||= time + (c === guest ? 0 : 4 + random() * 40);
        if (time >= c.shiftAt && free(c)) {
          c.shift = 'leaving';
          c.shiftAt = 0;
          c.spot = null;
          c.look = null;
          sendTo(c, door.x, door.z);
          say(c, pickLine(c.type, LEAVE_DIALOGUE, dice(c.type)));
          if (!c.path.length) c.fade = -1; // already at the door
        }
      } else if (c.shift === 'leaving' && due) {
        c.shift = 'in';                    // plans changed: stay
        c.wait = 0.5;
      } else if (c.shift === 'out' && due) {
        // The guest is in on time for his own visits (timed in updateGuest).
        // A show that calls him gets him last: he waits outside until the
        // rest of its cast are on their marks (or he has waited long
        // enough), then makes his entrance a little after that.
        let hold = false;
        if (c === guest && !visit.due && !c.shiftAt) {
          visit.calledAt ||= time;
          const others = Object.keys(phaseInfo().roles ?? {}).filter(t => t !== c.type && cast.some(o => o.type === t));
          hold = time - visit.calledAt < GUEST.showWaitS && !others.every(t => state.show?.acts?.[t]);
        }
        if (!hold) c.shiftAt ||= time + (c !== guest ? 2 + random() * 25 : visit.due ? 0 : guestBetween(GUEST.showInS));
        if (!hold && time >= c.shiftAt) {
          c.shiftAt = 0;
          c.pos.x = door.x;
          c.pos.y = door.z;
          c.heading = Math.PI;             // facing into the room
          c.speed = 0;
          c.present = true;
          c.shift = 'in';
          c.fade = 1;
          c.wait = 1.2;
          c.chatReady = time + 5;
          if (c === guest) {
            visit.strolled = false;
            // Called in by a show, he says nothing at the door: he is on his way to the stage.
            if (visit.due) {
              say(c, pickLine(c.type, ARRIVE_DIALOGUE, guestRandom));
              record(`${NAMES[c.type]} dropped by, did a few rounds of the office and left again.`, { kind: 'guest', every: GUEST.diaryEveryS });
            }
          } else {
            say(c, pickLine(c.type, ARRIVE_DIALOGUE));
            record(`${NAMES[c.type]} came in.`, { kind: 'shift' });
          }
        }
      } else if (c.shift === 'in') c.shiftAt = 0;
    }
  }

  // ---- The guest ----
  // Mr. T is nobody's colleague: he walks in through the door every minute or
  // two, does a few rounds of the room (stops on a ring about the middle of
  // it, one after the other), drops a remark or two on the way, sometimes at
  // whoever stands near, and walks out again. The door is the staff's
  // (updateShifts): this part only says when he is due, and walks his rounds.
  // While he is on them `c.stroll` is set, which keeps him out of chats and
  // incidents. A show that lists him in its staff has him in for as long as
  // it runs (the band); during any other show he stays away.
  const guestBetween = ([lo, hi]) => lo + guestRandom() * (hi - lo);

  function startStroll(c) {
    const points = GUEST.roundPoints;
    const stops = Math.round(guestBetween(GUEST.rounds)) * points;
    const { ring } = GUEST;
    // Stops he says something at: not the first (he has just said hello) and
    // not the last (the door, and goodbye, follow).
    const sayAt = new Set();
    const remarks = Math.min(stops - 2, Math.round(guestBetween(GUEST.remarks)));
    while (sayAt.size < remarks) sayAt.add(2 + Math.floor(guestRandom() * (stops - 2)));
    c.stroll = visit.stroll = {
      stops, reached: 0, sayAt,
      angle: Math.atan2(c.pos.x - ring.x, c.pos.y - ring.z),
      turn: (guestRandom() < 0.5 ? 1 : -1) * Math.PI * 2 / points,
      pauseUntil: time + FADE_S + 0.5,   // in at the door first
    };
    visit.strolled = true;
    c.spot = null;
    c.goal = null;
  }

  function endStroll(c) {
    c.stroll = visit.stroll = null;
  }

  // The next stop on the ring, moved to the nearest free floor.
  function nextStop(stroll) {
    const { ring } = GUEST;
    stroll.angle += stroll.turn * (0.8 + guestRandom() * 0.4);
    const x = ring.x + Math.sin(stroll.angle) * guestBetween(ring.rx);
    const z = ring.z + Math.cos(stroll.angle) * guestBetween(ring.rz);
    const cell = nav.nearestFree(x, z);
    return cell ? nav.toWorld(...cell) : [x, z];
  }

  // Something dry, for whoever is near enough to hear it, or for the room.
  function remark(c) {
    const near = cast
      .filter(o => o !== c && o.present && o.opacity > 0.5 && DIRECTED_LINES[c.type]?.[o.type] && distance(c, o) < GUEST.atRange)
      .sort((a, b) => distance(c, a) - distance(c, b))[0];
    if (near && guestRandom() < GUEST.atChance) {
      c.dest = { x: c.pos.x, z: c.pos.y, heading: null, face: { x: near.pos.x, z: near.pos.y } };
      say(c, pickFrom(c.type, DIRECTED_LINES[c.type][near.type], guestRandom));
      // Whoever it was for looks round, if they have nothing better to do.
      if (free(near) && !near.path.length && !near.look) near.look = { x: c.pos.x, z: c.pos.y, until: time + 2.2 };
    } else say(c, pickLine(c.type, DIALOGUE_BANKS, guestRandom));
  }

  function updateGuest() {
    const c = guest;
    const showOn = Boolean(shows.current);
    if (!showWantsGuest() || c.shift !== 'out') visit.calledAt = 0;   // no show is waiting for him
    if (c.shift === 'out') {
      // Time for a visit? Not into the middle of somebody else's show.
      if (!c.fade && !visit.due && time >= visit.at && !showOn) visit.due = true;
      return;
    }
    if (c.shift !== 'in' || !c.present) return;          // on his way out
    if (showWantsGuest() || c.busy) {
      // The show has him (or is about to): the rounds are off, and when it
      // lets him go again he leaves.
      if (c.stroll) endStroll(c);
      visit.due = false;
      return;
    }
    if (!visit.due) return;                              // done: updateShifts walks him out
    if (!c.stroll) {
      if (visit.strolled) { visit.due = false; return; }
      startStroll(c);
    }
    const stroll = c.stroll;
    if (c.driving || c.look || c.path.length || time < stroll.pauseUntil) return;
    if (stroll.sayAt.delete(stroll.reached)) {
      remark(c);
      stroll.pauseUntil = time + guestBetween(GUEST.pauseS);
      return;
    }
    if (stroll.reached >= stroll.stops || showOn) {
      // Rounds done (or a show he is not in has started): off he goes.
      endStroll(c);
      visit.due = false;
      return;
    }
    stroll.reached++;
    const [x, z] = nextStop(stroll);
    sendTo(c, x, z);
  }

  // ---- Speech ----
  // Chats between characters who meet, a line on arriving somewhere
  // (SPOT_LINES), and the odd remark while standing around. How chatty
  // everyone is follows the time of day (DAY_PHASES[].chat).

  const recentLines = new Map();   // type -> lines said lately, across all banks
  const lastLine = new Map();      // type -> the last line picked
  // Pick one of `lines` the character has not said recently.
  function pickFrom(type, lines, roll = random) {
    if (!lines?.length) return null;
    const used = recentLines.get(type) ?? new Set();
    recentLines.set(type, used);
    let pool = lines.filter(l => !used.has(l));
    if (!pool.length) {
      // Every line here was said recently: start this set again, but never
      // repeat what they said last.
      for (const l of lines) used.delete(l);
      pool = lines.length > 1 ? lines.filter(l => l !== lastLine.get(type)) : lines;
    }
    const line = pool[Math.floor(roll() * pool.length)];
    used.add(line);
    lastLine.set(type, line);
    if (used.size > RECENT_LINES) used.delete(used.values().next().value);
    return line;
  }
  const pickLine = (type, bank, roll = random) => pickFrom(type, bank?.[type], roll);

  // Start a speech bubble. Returns how long it stays up, in seconds.
  function say(c, text) {
    if (!text) return 0;
    c.line = text;
    c.lineSeq++;
    const s = readSeconds(text);
    c.sayUntil = time + s;
    return s;
  }

  // A subject both can talk about: the opener needs two lines on it, the
  // other at least one.
  function pickTopic(a, b) {
    if (random() > TOPIC_CHANCE) return null;
    const shared = TOPICS.filter(t => TOPIC_LINES[a.type][t.key].length >= 2 && TOPIC_LINES[b.type][t.key].length >= 1);
    return shared.length ? shared[Math.floor(random() * shared.length)] : null;
  }

  function startChat(a, b) {
    const turns = 2 + Math.floor(random() * 3);
    const order = [];
    for (let i = 0; i < turns; i++) order.push(i % 2 ? b : a);
    const chat = { a, b, order, next: time + 0.3, topic: pickTopic(a, b) };
    for (const [c, other] of [[a, b], [b, a]]) {
      c.chat = chat;
      c.path = [];
      c.spot = null;
      c.dest = { x: c.pos.x, z: c.pos.y, heading: null, face: { x: other.pos.x, z: other.pos.y } };
    }
  }

  function chatLine(speaker, chat) {
    // Now and then something meant for this listener, if the speaker has any.
    // A chat with a subject only takes the ones that are on it.
    const listener = speaker === chat.a ? chat.b : chat.a;
    let personal = DIRECTED_LINES[speaker.type]?.[listener.type];
    if (personal && chat.topic) personal = personal.filter(l => chat.topic.match.test(l));
    if (personal?.length && random() < DIRECTED_CHANCE) return pickFrom(speaker.type, personal);
    const onTopic = chat.topic && pickFrom(speaker.type, TOPIC_LINES[speaker.type][chat.topic.key]);
    return onTopic || pickLine(speaker.type, DIALOGUE_BANKS);
  }

  const chats = new Set();
  function updateSpeech(dt) {
    const mult = chatMultiplier();
    chats.clear();
    for (const c of cast) {
      if (c.line !== null && time > c.sayUntil) c.line = null;
      if (c.chat) { c.wait = Math.max(c.wait, 1); chats.add(c.chat); } // stay put while talking
    }
    // Run conversations turn by turn.
    for (const chat of chats) {
      if (time < chat.next) continue;
      const speaker = chat.order.shift();
      if (speaker) {
        chat.next = time + say(speaker, chatLine(speaker, chat)) + CHAT_GAP_S;
      } else {
        for (const c of [chat.a, chat.b]) {
          c.chat = null;
          c.needs.social = 0;
          // Margo waits longer before starting another chat.
          c.chatReady = time + (16 + random() * 12) / mult * (c.type === 'margo' ? 1.5 : 1);
          c.wait = 0.8 + random() * 2.5; // drift apart soon after
        }
        if (chat.topic && chat.a.type !== 'ghost' && chat.b.type !== 'ghost') {
          record(`${NAMES[chat.a.type]} and ${NAMES[chat.b.type]} talked about ${chat.topic.label}.`, { kind: 'chat', every: 45 });
        }
      }
    }
    // Two idle characters close together may strike up a chat.
    for (let i = 0; i < cast.length; i++) for (let j = i + 1; j < cast.length; j++) {
      const a = cast[i], b = cast[j];
      if (!idle(a) || !idle(b) || a.look || b.look || time < a.chatReady || time < b.chatReady) continue;
      if (distance(a, b) > CHAT_RANGE) continue;
      // The one who came over to talk opens the conversation.
      if (random() < dt * 0.6 * mult) (b.needs.social > a.needs.social ? startChat(b, a) : startChat(a, b));
    }
    // The odd remark while standing around alone.
    for (const c of cast) {
      if (!idle(c) || time < c.nextRemark || time < c.sayUntil) continue;
      c.nextRemark = time + (14 + random() * 14) / chatMultiplierFor(c);
      if (random() < 0.45) say(c, pickLine(c.type, DIALOGUE_BANKS));
    }
  }

  // ---- The visitor ----

  // A tap on one character: they turn to the glass and say something.
  function poke(c) {
    if (!c?.present || c.busy || c.shift !== 'in') return false;
    if (!c.chat) c.look = { x: visitor.x, z: visitor.z, until: time + 3.5 };
    const lines = c.type === 'margo' ? MARGO_LINES.tapGlass : DIALOGUE_BANKS[c.type];
    if (time > c.sayUntil - 1) say(c, pickFrom(c.type, lines, dice(c.type)));
    return true;
  }

  let nextTap = 0;
  // A tap on the glass: everyone looks up, and a couple of them react.
  function tapGlass() {
    if (time < nextTap) return false;
    nextTap = time + 5;
    const heard = cast.filter(c => free(c));
    for (const c of heard) c.look = { x: visitor.x, z: visitor.z, until: time + 2.5 + random() * 1.5 };
    const others = heard.filter(c => c !== margo && c.type !== 'ghost');
    const first = others[Math.floor(random() * others.length)];
    if (first) later(0.4, () => { if (free(first)) say(first, pickLine(first.type, GLASS_TAP_DIALOGUE)); });
    if (margo && heard.includes(margo)) later(first ? 1.8 : 0.4, () => { if (free(margo)) say(margo, pickFrom('margo', MARGO_LINES.tapGlass)); });
    if (ghost && heard.includes(ghost)) later(0.9, () => { if (ghost.present) say(ghost, pickLine('ghost', GLASS_TAP_DIALOGUE)); });
    record('A visitor tapped on the glass.', { kind: 'tap', every: 120 });
    return true;
  }

  // ---- The ghost ----
  // A ghost is not staff. It is out of the room most of the time and
  // materialises now and then for a short haunt, more often and for longer at
  // night (DAY_PHASES[].ghostVis / ghostHid), then dissolves again. The lamp
  // tends to flicker when it arrives, and Margo is the only one who actually
  // sees it (MARGO_LINES.ghostSpotted).
  const haunting = { fade: 0, dir: 0, at: 0, spotted: 0 };
  // What the page draws and sounds: donutWins counts races won so far.
  const state = { printerJammed: false, lampFlicker: false, donut: null, donutWins: 0, cake: null, show: null };

  function hideGhost() {
    ghost.present = false;
    ghost.path = [];
    ghost.chat = null;
    ghost.busy = null;
    ghost.line = null;
    ghost.opacity = 0;
  }

  function scheduleHaunt(first = false) {
    const { ghostVis = 1, ghostHid = 1 } = phaseInfo();
    const away = first ? 30 + random() * 60 : (120 + random() * 180) * ghostHid / ghostVis;
    haunting.at = time + away;
  }

  // The lamp stutters for a few seconds and whoever is around has a theory.
  function flickerLamp() {
    if (state.lampFlicker) return false;
    state.lampFlicker = true;
    later(5 + random() * 2, () => { state.lampFlicker = false; });
    const lamp = landmarks.lamp;
    const witnesses = shuffled(cast.filter(c => c.type !== 'ghost' && c.type !== 'margo' && free(c)), random).slice(0, 2);
    witnesses.forEach((c, i) => later(0.8 + i * 2.6, () => {
      if (!free(c)) return;
      if (lamp) c.look = { x: lamp.x, z: lamp.z, until: time + 3 };
      say(c, pickLine(c.type, LAMP_FLICKER_DIALOGUE));
    }));
    if (ghost?.present) later(1.6, () => { if (ghost.present) say(ghost, pickLine('ghost', LAMP_FLICKER_DIALOGUE)); });
    const blamer = witnesses[0];
    record(blamer ? `The lamp flickered. ${NAMES[blamer.type]} has a theory.` : 'The lamp flickered. Nobody was there to see it.', { kind: 'lamp', every: 30 });
    return true;
  }

  function haunt() {
    if (!ghost) return;
    const [x, z] = nav.randomFree(random);
    ghost.pos.x = x;
    ghost.pos.y = z;
    ghost.heading = random() * Math.PI * 2;
    ghost.speed = 0;
    ghost.present = true;
    ghost.wait = 1 + random() * 2;
    ghost.chatReady = time + 3;
    haunting.dir = 1;
    const { ghostVis = 1 } = phaseInfo();
    haunting.at = time + (20 + random() * 25) * ghostVis;
    haunting.spotted = time + 2 + random() * 3;
    if (random() < 0.7) flickerLamp();
  }

  function updateGhost(dt) {
    if (haunting.dir) {
      haunting.fade = clamp(haunting.fade + haunting.dir * dt / GHOST_FADE_S, 0, 1);
      ghost.opacity = haunting.fade;
      if (haunting.fade === 0) { hideGhost(); haunting.dir = 0; scheduleHaunt(); }
      else if (haunting.fade === 1) haunting.dir = 0;
      return;
    }
    if (!ghost.present) { if (time >= haunting.at) haunt(); return; }
    if (haunting.spotted && time >= haunting.spotted) {
      haunting.spotted = 0;
      const noticed = margo && idle(margo) && random() < 0.7;
      if (noticed) say(margo, pickFrom('margo', MARGO_LINES.ghostSpotted));
      record(noticed ? 'The ghost dropped by. Only Margo noticed.' : 'The ghost dropped by. Nobody noticed.', { kind: 'ghost' });
    }
    if (time >= haunting.at && !ghost.chat && !ghost.busy) { ghost.line = null; haunting.dir = -1; }
  }

  if (ghost) { hideGhost(); scheduleHaunt(true); } // the ghost's first visit is a while off

  const events = createEvents({
    cast, nav, spots: usableSpots, landmarks, state, random, phaseInfo,
    now: () => time, free, say, pickLine, later, record, sendTo, pointNear, flickerLamp,
  });
  const shows = createShows({
    cast, nav, state, random, now: () => time, say, pickLine, later, record, sendTo, stopIncident: events.stop,
  });

  return {
    // Steer one character by hand: move is 1 forward, -1 back; turn is 1 left,
    // -1 right. Anyone else is released; drive(null) releases everyone.
    drive(type, move = 0, turn = 0) {
      for (const c of cast) c.drive = c.type === type ? { move, turn } : null;
    },
    cast, spots: usableSpots, visitor, state, log, say, haunt, poke, tapGlass, flickerLamp,
    // Office events: trigger('printerJam' | 'meeting' | 'birthday') or
    // dropDonut(x, z). Each returns false if it cannot happen right now
    // (also while a show is on).
    trigger: type => !shows.current && events.start(type),
    dropDonut: (x, z) => !shows.current && events.dropDonut(x, z),
    get event() { return events.current?.type ?? null; },
    // Shows: setShow('band') starts one (false for an unknown key or while
    // one is on); setShow(null) ends it and the office goes back to its day.
    setShow(key) {
      if (key !== null) return shows.start(key);
      if (!shows.current) return false;
      shows.stop();
      events.rest();
      return true;
    },
    get show() { return shows.current; },
    get time() { return time; },
    // Seconds until the ghost next materialises (0 while it is in the room,
    // Infinity with no ghost in the cast).
    ghostDueIn() {
      if (!ghost) return Infinity;
      return ghost.present ? 0 : Math.max(0, haunting.at - time);
    },
    // Seconds until the guest next walks in by himself (0 while he is in or
    // on his way, Infinity with no guest in the cast). A show may call him
    // in sooner.
    guestDueIn() {
      if (!guest) return Infinity;
      return guest.present || visit.due ? 0 : Math.max(0, visit.at - time);
    },
    update(dt) {
      time += dt;
      runPending();
      if (ghost) updateGhost(dt);
      if (door) updateShifts(dt);
      if (guest) updateGuest();
      if (shows.current) shows.update();
      else events.update();
      for (const c of cast) if (c.present) tick(c, dt);
      updateSpeech(dt);
    },
  };
}
