// ---- Office simulation ----
// Who walks where, who talks to whom, and when the ghost visits. No Three.js
// and no DOM in here: the page (office.js) reads each character's state every
// frame and draws it, and tests can run the office in plain Node.
//
//   const sim = createSim({ nav, spots, types, phase: () => 'midday' });
//   sim.update(dt);              // advance by dt seconds
//   sim.cast[0].pos              // { x, y } on the floor (y is world z)
//   sim.cast[0].line             // what they are saying now, or null
//
// A character's `line` is the text of their speech bubble; `lineSeq` goes up
// by one every time they start a new line (also when the text repeats).

import {
  DIALOGUE_BANKS, COFFEE_DIALOGUE, ACTIVITY_LINES, MARGO_LINES, DAY_PHASES,
} from './data.js';

const WALK_SPEED = 1.05, TURN_RATE = 4;
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
const CHAT_RANGE = 2.2;      // metres between two idle characters to start chatting
const CHAT_GAP_S = 0.45;     // pause between turns
const GHOST_FADE_S = 1.8;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// Long enough to read: 1.8 s plus 45 ms a character, 3.5 to 8 s.
const readSeconds = text => Math.min(8, Math.max(3.5, 1.8 + text.length * 0.045));

// nav: a NavGrid. spots: places to stand ({ x, z, heading, type }).
// types: the cast, in order. phase: () => current DAY_PHASES key.
// random: () => 0..1 (defaults to Math.random, read at call time so a seeded
// Math.random still applies).
export function createSim({ nav, spots, types, phase, random = () => Math.random() }) {
  let time = 0;
  const usableSpots = spots.filter(s => nav.freeAt(s.x, s.z));

  const cast = types.map((type, i) => {
    const [x, y] = START[i % START.length];
    return {
      type, pos: { x, y }, heading: random() * Math.PI * 2, speed: 0,
      path: [], spot: null, dest: null, wait: 1 + random() * 3, blocked: 0,
      chat: null, chatReady: 4 + random() * 6, nextRemark: 8 + random() * 10,
      line: null, lineSeq: 0, sayUntil: 0,
      present: true, opacity: 1, talkingToVisitor: false,
    };
  });
  const margo = cast.find(c => c.type === 'margo');
  const ghost = cast.find(c => c.type === 'ghost');
  // Where a character looks while talking to the visitor (the camera).
  const visitor = { x: 0, z: 10 };

  const phaseInfo = () => DAY_PHASES.find(p => p.key === phase()) ?? {};
  const chatMultiplier = () => phaseInfo().chat ?? 1;
  // Margo is a construct: the evening/night quiet doesn't apply to her.
  const chatMultiplierFor = c => (c.type === 'margo' ? Math.max(1, chatMultiplier()) : chatMultiplier());
  const idle = c => !c.path.length && !c.chat && !c.talkingToVisitor;
  const distance = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);

  // ---- Walking ----

  function chooseDestination(c) {
    const taken = new Set(cast.filter(o => o !== c && o.spot).map(o => o.spot));
    const options = usableSpots.filter(s => !taken.has(s) && Math.hypot(s.x - c.pos.x, s.z - c.pos.y) > 1.2);
    let dest;
    const armchair = c.type === 'margo' && options.find(s => s.type === 'armchair');
    if (armchair && random() < 0.35) {
      dest = armchair; // episode 212 isn't going to watch itself
      c.spot = dest;
    } else if (options.length && random() < 0.75) {
      dest = options[Math.floor(random() * options.length)];
      c.spot = dest;
    } else {
      const [x, z] = nav.randomFree();
      dest = { x, z, heading: null };
      c.spot = null;
    }
    c.dest = dest;
    c.path = nav.path(c.pos.x, c.pos.y, dest.x, dest.z) || [];
    c.blocked = 0;
  }

  function arrived(c) {
    if (c.type === 'margo' && c.spot?.type === 'armchair') {
      c.wait = 20 + random() * 20; // a whole scene of Orbital Tidewater
      say(c, pickLine('margo', ACTIVITY_LINES.armchair));
      return;
    }
    const bank = c.spot && SPOT_LINES[c.spot.type];
    if (bank && random() < 0.6) say(c, pickLine(c.type, bank));
  }

  function tick(c, dt) {
    let wantSpeed = 0, wantHeading = c.heading;
    if (c.talkingToVisitor) {
      c.path = [];
      c.wait = Math.max(c.wait, 2);
      wantHeading = Math.atan2(visitor.x - c.pos.x, visitor.z - c.pos.y);
    } else if (c.path.length) {
      const [wx, wz] = c.path[0];
      const dx = wx - c.pos.x, dz = wz - c.pos.y, d = Math.hypot(dx, dz);
      if (d < 0.12) {
        c.path.shift();
        if (!c.path.length) { c.wait = (c.type === 'ghost' ? 2 : 3) + random() * 5; arrived(c); }
      } else {
        wantHeading = Math.atan2(dx, dz);
        wantSpeed = c.path.length === 1 ? Math.min(1, d / 0.6 + 0.25) : 1;
      }
      // Give way to anyone close in front.
      const ahead = cast.some(o => {
        if (o === c || !o.present) return false;
        const ox = o.pos.x - c.pos.x, oz = o.pos.y - c.pos.y, od = Math.hypot(ox, oz);
        return od < 0.75 && (ox * Math.sin(c.heading) + oz * Math.cos(c.heading)) / od > 0.45;
      });
      if (ahead) {
        wantSpeed = 0;
        c.blocked += dt;
        if (c.blocked > 1.6 + random()) chooseDestination(c);
      } else c.blocked = 0;
    } else {
      if (c.dest?.heading != null) wantHeading = c.dest.heading;
      c.wait -= dt;
      if (c.wait <= 0) chooseDestination(c);
    }
    c.heading += clamp(angleDelta(c.heading, wantHeading), -TURN_RATE * dt, TURN_RATE * dt);
    const align = Math.max(0, Math.cos(angleDelta(c.heading, wantHeading)));
    c.speed += (wantSpeed * align - c.speed) * Math.min(1, dt * 6);
    c.pos.x += Math.sin(c.heading) * WALK_SPEED * c.speed * dt;
    c.pos.y += Math.cos(c.heading) * WALK_SPEED * c.speed * dt;
  }

  // ---- Speech ----
  // Chats between characters who meet (DIALOGUE_BANKS), a line on arriving
  // somewhere (SPOT_LINES), and the odd remark while standing around. How
  // chatty everyone is follows the time of day (DAY_PHASES[].chat).

  const recentLines = new Map();
  // Pick a line the character has not said recently.
  function pickLine(type, bank) {
    const lines = bank?.[type];
    if (!lines?.length) return null;
    const used = recentLines.get(type) ?? new Set();
    recentLines.set(type, used);
    let pool = lines.filter(l => !used.has(l));
    if (!pool.length) { used.clear(); pool = lines; }
    const line = pool[Math.floor(random() * pool.length)];
    used.add(line);
    if (used.size > Math.min(12, lines.length - 1)) used.delete(used.values().next().value);
    return line;
  }

  // Start a speech bubble. Returns how long it stays up, in seconds.
  function say(c, text) {
    if (!text) return 0;
    c.line = text;
    c.lineSeq++;
    const s = readSeconds(text);
    c.sayUntil = time + s;
    return s;
  }

  function startChat(a, b) {
    const turns = 2 + Math.floor(random() * 3);
    const order = [];
    for (let i = 0; i < turns; i++) order.push(i % 2 ? b : a);
    const chat = { a, b, order, next: time + 0.3 };
    for (const [c, other] of [[a, b], [b, a]]) {
      c.chat = chat;
      c.path = [];
      c.dest = { x: c.pos.x, z: c.pos.y, heading: Math.atan2(other.pos.x - c.pos.x, other.pos.y - c.pos.y) };
    }
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
        chat.next = time + say(speaker, pickLine(speaker.type, DIALOGUE_BANKS)) + CHAT_GAP_S;
      } else {
        for (const c of [chat.a, chat.b]) {
          c.chat = null;
          // Margo waits longer before starting another chat.
          c.chatReady = time + (16 + random() * 12) / mult * (c.type === 'margo' ? 1.5 : 1);
          c.wait = 0.8 + random() * 2.5; // drift apart soon after
        }
      }
    }
    // Two idle characters close together may strike up a chat.
    for (let i = 0; i < cast.length; i++) for (let j = i + 1; j < cast.length; j++) {
      const a = cast[i], b = cast[j];
      if (!a.present || !b.present) continue;
      if (!idle(a) || !idle(b) || time < a.chatReady || time < b.chatReady) continue;
      if (distance(a, b) > CHAT_RANGE) continue;
      if (random() < dt * 0.6 * mult) startChat(a, b);
    }
    // The odd remark while standing around alone.
    for (const c of cast) {
      if (!c.present || !idle(c) || time < c.nextRemark || time < c.sayUntil) continue;
      c.nextRemark = time + (14 + random() * 14) / chatMultiplierFor(c);
      if (random() < 0.45) say(c, pickLine(c.type, DIALOGUE_BANKS));
    }
  }

  // ---- The ghost ----
  // A ghost is not staff. It is out of the room most of the time and
  // materialises now and then for a short haunt, more often and for longer at
  // night (DAY_PHASES[].ghostVis / ghostHid), then dissolves again. Margo is
  // the only one who notices (MARGO_LINES.ghostSpotted).
  const haunting = { fade: 0, dir: 0, at: 0, spotted: 0 };

  function hideGhost() {
    ghost.present = false;
    ghost.path = [];
    ghost.chat = null;
    ghost.line = null;
    ghost.opacity = 0;
  }

  function scheduleHaunt(first = false) {
    const { ghostVis = 1, ghostHid = 1 } = phaseInfo();
    const away = first ? 30 + random() * 60 : (120 + random() * 180) * ghostHid / ghostVis;
    haunting.at = time + away;
  }

  function haunt() {
    if (!ghost) return;
    const [x, z] = nav.randomFree();
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
      if (margo && idle(margo) && random() < 0.7) say(margo, pickLine('margo', MARGO_LINES.ghostSpotted));
    }
    if (time >= haunting.at && !ghost.chat) { ghost.line = null; haunting.dir = -1; }
  }

  if (ghost) { hideGhost(); scheduleHaunt(true); } // the ghost's first visit is a while off

  return {
    cast, spots: usableSpots, visitor, say, haunt,
    get time() { return time; },
    // Seconds until the ghost next materialises (0 while it is in the room,
    // Infinity with no ghost in the cast).
    ghostDueIn() {
      if (!ghost) return Infinity;
      return ghost.present ? 0 : Math.max(0, haunting.at - time);
    },
    update(dt) {
      time += dt;
      if (ghost) updateGhost(dt);
      for (const c of cast) if (c.present) tick(c, dt);
      updateSpeech(dt);
    },
  };
}
