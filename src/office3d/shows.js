// ---- Shows ----
// A show takes the office over until it is switched off: whatever was going
// on stops, the set (SHOWS[key].set) goes up in the middle of the room, each
// role walks to its mark and, once someone is on theirs, the show loops
// through play and break. Lines and diary entries come from the entry too
// (`lines`, `reports`), and either may be left out. One show runs at a time.
// Members are marked `busy` with the show, the same way an office incident
// marks the people taking part in it.
//
// Part of the simulation (see sim.js): no Three.js, no DOM. What the page
// should draw is in `state.show`:
//   null | { key, beat: 'play' | 'break', acts: { [type]: act } }
// A type is in `acts` only while it stands on its mark.

import { SHOWS } from './data.js';
import { shuffled } from './events.js';

const PAD = 0.24;        // the character radius furniture is blocked with
const ON_MARK = 0.25;    // metres: close enough to count as on the mark

export function createShows({ cast, nav, state, random, now, say, pickLine, later, record, sendTo, stopIncident, shows = SHOWS }) {
  let current = null;   // { key, spec, members, beat, beatAt }

  // Free for the show to take: in the room, on shift and not in anyone's hands.
  const ready = c => c.present && c.shift === 'in' && !c.drive && !c.talkingToVisitor;
  const onMark = (c, m) => !c.path.length && Math.hypot(c.pos.x - m.x, c.pos.y - m.z) < ON_MARK;

  function endChat(c) {
    const chat = c.chat;
    if (!chat) return;
    for (const p of [chat.a, chat.b]) {
      p.chat = null;
      p.chatReady = now() + 10;
      p.wait = 0.8 + random() * 2.5;
    }
  }

  // Take a character into the show and send them to their mark.
  function claim(show, c, mark) {
    endChat(c);
    c.busy = show;
    c.spot = null;
    c.goal = null;
    c.look = null;
    c.path = [];
    c.dest = { x: c.pos.x, z: c.pos.y, heading: null, face: null };
    show.members.push(c);
    sendTo(c, mark.x, mark.z, { heading: mark.heading });
  }

  // Put the set up: block its footprints, move anyone standing in one out of
  // the way and re-plan walks that would cross it.
  function buildSet(spec) {
    for (const piece of spec.set) if (piece.footprint) nav.blockTemp(...piece.footprint, PAD);
    for (const c of cast) {
      if (!c.present) continue;
      if (!nav.freeAt(c.pos.x, c.pos.y)) {
        const cell = nav.nearestFree(c.pos.x, c.pos.y);
        if (cell) [c.pos.x, c.pos.y] = nav.toWorld(...cell);
      }
      if (c.path.length && c.dest) c.path = nav.path(c.pos.x, c.pos.y, c.dest.x, c.dest.z) || [];
    }
  }

  // A member says a line from the show's bank, if they are still in it.
  function speak(show, c) {
    if (show.spec.lines && c.busy === show && !c.talkingToVisitor) say(c, pickLine(c.type, show.spec.lines));
  }

  function nextBeat(show) {
    show.beat = show.beat === 'play' ? 'break' : 'play';
    show.beatAt = now() + (show.beat === 'play' ? show.spec.playS : show.spec.breakS);
    const players = show.members.filter(c => c.busy === show && onMark(c, show.spec.roles[c.type].mark));
    const order = shuffled(players, random);
    // Between songs a couple of them talk; at the count-in, one does.
    order.slice(0, show.beat === 'break' ? 2 : 1).forEach((c, i) => later(0.3 + i * 2.8, () => speak(show, c)));
  }

  function update() {
    const show = current;
    if (!show) return;
    if (now() >= show.beatAt) nextBeat(show);   // never before the first song (beatAt is Infinity)
    const acts = {};
    for (const [type, role] of Object.entries(show.spec.roles)) {
      const c = cast.find(o => o.type === type);
      if (!c) continue;
      if (c.busy !== show) {
        if (ready(c)) claim(show, c, role.mark);
        continue;
      }
      if (!c.present) continue;
      if (onMark(c, role.mark)) { acts[type] = role.act; continue; }
      // Off the mark with nowhere to go (gave way, or was steered off it):
      // head back once nobody has hold of them. Someone who stopped to give
      // way to a bandmate on a mark would wait for ever, so squeeze past for
      // a moment, the way people heading for the door do (sim.js).
      if (!c.path.length && ready(c) && !c.driving) {
        if (c.blocked) c.pushUntil = now() + 2.5;
        sendTo(c, role.mark.x, role.mark.z, { heading: role.mark.heading });
      }
    }
    // The first song starts when the first player gets to a mark, not over
    // an empty stage while they walk in.
    if (show.beatAt === Infinity && Object.keys(acts).length) nextBeat(show);
    state.show = { key: show.key, beat: show.beat, acts };
  }

  function start(key) {
    const spec = Object.hasOwn(shows, key) ? shows[key] : null;
    if (current || !spec) return false;
    stopIncident();
    // A break until somebody is on their mark (see update).
    current = { key, spec, members: [], beat: 'break', beatAt: Infinity };
    buildSet(spec);
    const reports = spec.reports;
    if (reports?.length) record(reports[Math.floor(random() * reports.length)], { kind: 'show' });
    update();
    return true;
  }

  function stop() {
    const show = current;
    if (!show) return;
    for (const c of show.members) {
      if (c.busy !== show) continue;
      c.busy = null;
      // Stop on the spot: nobody finishes the walk to a mark that is gone.
      c.path = [];
      c.dest = { x: c.pos.x, z: c.pos.y, heading: null, face: null };
      c.wait = 0.6 + random() * 2.5;   // drift apart
    }
    nav.clearTemp();
    current = null;
    state.show = null;
  }

  return {
    start, stop, update,
    get current() { return current?.key ?? null; },
  };
}
