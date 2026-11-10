// ---- Office events ----
// Things that happen to the whole office: the printer jams, a donut turns
// up, someone calls a meeting, it is somebody's birthday. One event runs at
// a time. Characters taking part are marked `busy`, which stops them
// wandering off or starting other chats until the event lets them go.
//
// Part of the simulation (see sim.js): no Three.js, no DOM. What the page
// should draw is in `state`: printerJammed, donut and cake positions.
//
// Events start on their own every minute or two (more often when
// DAY_PHASES[].events is high) and the page can start them too:
//   events.start('printerJam');  events.dropDonut(x, z);

import {
  PRINTER_JAM_DIALOGUE, BIRTHDAY_DIALOGUE, MEETING_DIALOGUE, DONUT_DIALOGUE,
  DONUT_WIN_DIALOGUE, MARGO_LINES, NAMES,
} from './data.js';

const FIRST_EVENT_S = [50, 100];     // office time before the first event
const EVENT_GAP_S = [75, 160];       // between events, divided by the phase's `events`
const DONUT_REACH = 0.5;             // metres: close enough to grab it
const MEETING_REPORTS = [
  'A meeting was held. It could have been an email.',
  'There was a meeting. Margo took notes. Mostly risks.',
  'A meeting happened at the whiteboard. An arrow now points at another arrow.',
];

// A copy of `list` in random order.
export function shuffled(list, random) {
  return list.map(item => [random(), item]).sort((a, b) => a[0] - b[0]).map(pair => pair[1]);
}

export function createEvents({
  cast, nav, spots, landmarks, state, random, phaseInfo,
  now, free, say, pickLine, later, record, sendTo, pointNear, flickerLamp,
}) {
  const margo = cast.find(c => c.type === 'margo');
  const between = ([lo, hi]) => lo + random() * (hi - lo);
  const shuffle = list => shuffled(list, random);
  const people = () => cast.filter(c => c.type !== 'ghost' && free(c));
  const near = (c, x, z, r) => Math.hypot(c.pos.x - x, c.pos.y - z) < r;

  let current = null;   // { type, members, update() -> true when finished, end() }
  let nextAt = between(FIRST_EVENT_S);
  let hadBirthday = false;

  // Take a character into an event: they drop what they were doing and
  // stand still until the event sends them somewhere.
  function join(event, c) {
    c.busy = event;
    c.spot = null;
    c.goal = null;
    c.look = null;
    c.path = [];
    c.dest = { x: c.pos.x, z: c.pos.y, heading: null, face: null };
    event.members.push(c);
  }
  function finish() {
    if (!current) return;
    current.end?.();
    for (const c of current.members) {
      if (c.busy !== current) continue;
      c.busy = null;
      c.wait = 0.6 + random() * 2.5;   // drift apart
    }
    current = null;
    nextAt = now() + between(EVENT_GAP_S) / (phaseInfo().events ?? 1);
  }
  // Stand the members around a point, facing `face` (default: the point).
  function gather(event, members, x, z, r, face = { x, z }) {
    const start = random() * Math.PI * 2;
    members.forEach((c, i) => {
      join(event, c);
      const at = pointNear(x, z, r, start + (i / members.length) * Math.PI * 2);
      if (at) sendTo(c, at.x, at.z, { face });
      else c.dest = { x: c.pos.x, z: c.pos.y, heading: null, face };
    });
  }
  // A member says a line from a bank, if they are still part of the event.
  const speak = (event, c, bank) => { if (c.busy === event && !c.talkingToVisitor) say(c, pickLine(c.type, bank)); };

  // ---- Printer jam ----
  // A couple of people gather and complain. Margo says she is not fixing it,
  // walks over and fixes it. Without her, it sorts itself out eventually.
  function printerJam() {
    const spot = spots.find(s => s.type === 'printer');
    if (!spot || state.printerJammed) return null;
    const started = now();
    const event = { type: 'printerJam', members: [] };
    state.printerJammed = true;
    record('The printer jammed.', { kind: 'printer' });

    const printer = landmarks.printer ?? spot;
    const fixer = margo && free(margo) ? margo : null;
    const witnesses = shuffle(people().filter(c => c !== fixer)).slice(0, 2);
    gather(event, witnesses, spot.x, spot.z, 1.1, printer);
    witnesses.forEach((c, i) => later(1.2 + i * 3.2, () => speak(event, c, PRINTER_JAM_DIALOGUE)));

    let fixAt = 0, fixed = false;
    if (fixer) {
      join(event, fixer);
      later(2.4, () => {
        if (fixer.busy !== event) return;
        say(fixer, MARGO_LINES.printerFix[0]);
        sendTo(fixer, spot.x, spot.z, { face: printer });
      });
    }
    const clear = line => {
      fixed = true;
      state.printerJammed = false;
      record(line, { kind: 'printer' });
    };
    event.update = () => {
      const t = now() - started;
      if (fixed) return t > fixAt + 3;
      if (fixer && fixer.busy === event && !fixer.talkingToVisitor) {
        // At the printer (or it has taken too long to get there): fix it.
        const there = t > 4 && !fixer.path.length && near(fixer, spot.x, spot.z, 0.6);
        if (!fixAt && (there || t > 24)) fixAt = t + 2.2;
        if (fixAt && t >= fixAt) {
          say(fixer, MARGO_LINES.printerFix[1]);
          clear('Margo fixed the printer. She would like that kept quiet.');
          fixAt = t;
        }
      } else if (t > 16) {
        clear('The printer un-jammed itself. Nobody trusts it.');
        fixAt = t;
      }
      return false;
    };
    event.end = () => { state.printerJammed = false; };
    return event;
  }

  // ---- Donut race ----
  // A donut appears. Everyone who is free goes for it; the first to reach it
  // wins and the rest have feelings about that.
  function donutRace(x, z) {
    if (state.donut || !nav.freeAt(x, z)) return null;
    const racers = cast.filter(c => free(c));
    const started = now();
    const event = { type: 'donut', members: [] };
    state.donut = { x, z };
    for (const c of racers) { join(event, c); sendTo(c, x, z); }

    let wonAt = 0;
    event.update = () => {
      const t = now() - started;
      if (wonAt) return t > wonAt + 4.5;
      const winner = event.members.find(c => c.busy === event && c.present && near(c, x, z, DONUT_REACH));
      if (winner) {
        wonAt = t;
        state.donut = null;
        state.donutWins++;
        say(winner, pickLine(winner.type, DONUT_WIN_DIALOGUE));
        record(`${NAMES[winner.type]} won the donut race.`, { kind: 'donut' });
        const losers = event.members.filter(c => c !== winner && c.busy === event);
        losers.forEach((c, i) => {
          c.path = [];
          c.dest = { x: c.pos.x, z: c.pos.y, heading: null, face: { x: winner.pos.x, z: winner.pos.y } };
          if (i < 2) later(1.4 + i * 2.2, () => speak(event, c, DONUT_DIALOGUE));
        });
      } else if (t > 30 || (t > 2 && !event.members.some(c => c.busy === event && c.present))) {
        state.donut = null;
        record('A donut went uneaten. This has never happened before.', { kind: 'donut' });
        return true;
      }
      return false;
    };
    event.end = () => { state.donut = null; };
    return event;
  }

  // ---- Birthday ----
  // Cake appears next to the birthday person and everyone gathers round.
  function birthday() {
    const guests = people();
    const stars = guests.filter(c => c !== margo);
    if (guests.length < 2 || !stars.length) return null;
    const star = stars[Math.floor(random() * stars.length)];
    const cake = pointNear(star.pos.x, star.pos.y, 0.65);
    if (!cake) return null;
    const started = now();
    const event = { type: 'birthday', members: [] };
    state.cake = cake;
    join(event, star);
    star.path = [];
    star.dest = { x: star.pos.x, z: star.pos.y, heading: null, face: cake };
    const others = guests.filter(c => c !== star);
    gather(event, others, cake.x, cake.z, 1.25);
    // Guests first, the birthday person last.
    const order = [...shuffle(others), star];
    order.forEach((c, i) => later(3 + i * 3.4, () => speak(event, c, BIRTHDAY_DIALOGUE)));
    const length = 3 + order.length * 3.4 + 3;
    record(`It was ${NAMES[star.type]}'s birthday. There was cake.`, { kind: 'birthday' });
    event.update = () => now() - started > length;
    event.end = () => { state.cake = null; };
    return event;
  }

  // ---- Meeting ----
  // Everyone free gathers at the whiteboard and takes turns.
  function meeting() {
    const spot = spots.find(s => s.type === 'whiteboard');
    const attendees = people();
    if (!spot || attendees.length < 2) return null;
    const started = now();
    const event = { type: 'meeting', members: [] };
    gather(event, attendees, spot.x, spot.z, 1.0, landmarks.whiteboard ?? spot);
    const turns = Math.min(6, attendees.length + 2);
    const order = shuffle(attendees);
    for (let i = 0; i < turns; i++) later(4.5 + i * 3.6, () => speak(event, order[i % order.length], MEETING_DIALOGUE));
    const length = 4.5 + turns * 3.6 + 2.5;
    event.update = () => now() - started > length;
    event.end = () => record(MEETING_REPORTS[Math.floor(random() * MEETING_REPORTS.length)], { kind: 'meeting' });
    return event;
  }

  const STARTERS = { printerJam, birthday, meeting };

  function begin(event) {
    if (!event) return false;
    current = event;
    return true;
  }
  function start(type) {
    if (current || !STARTERS[type]) return false;
    const started = begin(STARTERS[type]());
    if (started && type === 'birthday') hadBirthday = true;
    return started;
  }
  // Put a donut on the floor at (x, z), or somewhere free if left out.
  function dropDonut(x, z) {
    if (current) return false;
    if (x === undefined || !nav.freeAt(x, z)) [x, z] = nav.randomFree(random);
    return begin(donutRace(x, z));
  }

  // Something for the office to do when it has been quiet for a while.
  function somethingHappens() {
    const crowd = people().length;
    const options = ['printerJam', 'printerJam', 'donut'];
    if (crowd >= 2) options.push('meeting', 'meeting', 'donut');
    if (crowd >= 3 && !hadBirthday) options.push('birthday');
    if (landmarks.lamp) options.push('lamp');
    const pick = options[Math.floor(random() * options.length)];
    if (pick === 'lamp') return flickerLamp();
    return pick === 'donut' ? dropDonut() : start(pick);
  }

  return {
    start, dropDonut,
    get current() { return current; },
    update() {
      if (current) {
        if (current.update()) finish();
        return;
      }
      if (now() < nextAt) return;
      // If nothing could happen, try again soon. (A started event sets the
      // next time itself when it finishes; a lamp flicker is over quickly.)
      const happened = somethingHappens();
      if (!current) nextAt = now() + (happened ? between(EVENT_GAP_S) / 2 : 20);
    },
  };
}
