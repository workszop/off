// Office Friends — events, scenes, ambient systems

// Timer rule: anything that must outlive a scene or pause (scheduler ticks,
// day-phase checks, cooldowns, UI-chrome cleanup) uses raw setInterval/
// setTimeout. trackedTimeout is ONLY for scene/dialogue timelines that
// clearPendingTimers() is supposed to kill.

// ---- Scripted "gather" scenes (Coffee / Meeting) -------------------------
// Send everyone to a clustered set of positions, then run a short scripted
// conversation in turn. Autonomous chat is suppressed while a scene runs
// (see state.activeScene) so the scripted dialogue isn't talked over.

const SCENE_LINE_GAP_MS = 1400;     // delay between characters in a cycle
const SCENE_CYCLE_PAUSE_MS = 800;   // beat between dialogue cycles
const SCENE_ARRIVAL_TIMEOUT_MS = 12000; // start talking anyway after this long
const SCENE_ARRIVAL_POLL_MS = 200;

function gatherAndChat(positions, dialogueBank, lineCount = 2) {
  // Cancel any prior scene, drop existing bubbles, and reset chat locks
  // so the new conversation can show cleanly.
  clearPendingTimers();
  clearAllBubbles();
  state.convPairs.clear();
  state.chars.forEach(c => {
    c.isChatting = false;
    c.approachPartner = null;
    if (typeof cancelActivity === 'function') cancelActivity(c);
    c.idleTimer = 0;
    c.waveTimer = 0;
  });
  if (typeof closeObsCard === 'function') closeObsCard();
  state.activeScene = true;

  state.chars.forEach((c, i) => {
    const p = positions[i % positions.length];
    c.targetX = p.x; c.targetY = p.y;
    c.targetStuckFrames = 0;
    c.state = 'walking';
  });

  const sceneStartedAt = performance.now();

  const startDialogue = () => {
    const cycleDuration = state.chars.length * SCENE_LINE_GAP_MS + SCENE_CYCLE_PAUSE_MS;
    for (let line = 0; line < lineCount; line++) {
      state.chars.forEach((c, i) => {
        const delay = line * cycleDuration + i * SCENE_LINE_GAP_MS;
        trackedTimeout(() => {
          showBubble(c, pickFresh(dialogueBank[c.type], state.recentLines[c.type]), 2800);
        }, delay);
      });
    }
    const sceneEnd = lineCount * cycleDuration + 1500;
    trackedTimeout(() => { state.activeScene = false; }, sceneEnd);
  };

  // Poll for arrival. Each character clears its targetX when it reaches its
  // gather spot (or gives up via the stuck-frame logic). Once everyone has
  // resolved one way or another, kick off the dialogue.
  const tickArrival = () => {
    if (!state.activeScene) return;
    const settled = state.chars.every(c => c.targetX === null);
    const timeoutHit = performance.now() - sceneStartedAt > SCENE_ARRIVAL_TIMEOUT_MS;
    if (settled || timeoutHit) {
      // Snap any still-moving stragglers so they don't fidget through dialogue.
      state.chars.forEach(c => {
        if (c.targetX !== null) { c.targetX = null; c.targetY = null; }
        c.vx = 0; c.vy = 0;
        c.state = 'idle';
      });
      startDialogue();
    } else {
      trackedTimeout(tickArrival, SCENE_ARRIVAL_POLL_MS);
    }
  };
  trackedTimeout(tickArrival, 600);
}

function coffeeGatherPositions() {
  const { w, h } = getCanvasSize();
  // Cluster just below the coffee-station obstacle (top-center of the room).
  const cx = Math.min(Math.max(w * 0.5, 250), w - 250);
  const y = Math.max(h * 0.18, 90);
  return [
    safeGatherPoint(cx - 110 - SPRITE_W / 2, y),
    safeGatherPoint(cx - SPRITE_W / 2,        y + 6),
    safeGatherPoint(cx + 110 - SPRITE_W / 2, y),
    safeGatherPoint(cx - SPRITE_W / 2, y + SPRITE_H * 0.45),
  ];
}

function meetingGatherPositions() {
  const { w, h } = getCanvasSize();
  // Open spot in the lower-left quadrant, clear of desks and plants.
  const cx = Math.min(Math.max(w * 0.3, 200), w - 260);
  const y = Math.min(Math.max(h * 0.62, h - SPRITE_H - 120), h - SPRITE_H - 60);
  return [
    safeGatherPoint(cx - 100 - SPRITE_W / 2, y),
    safeGatherPoint(cx - SPRITE_W / 2,        y + 6),
    safeGatherPoint(cx + 100 - SPRITE_W / 2, y),
    safeGatherPoint(cx - SPRITE_W / 2, y - SPRITE_H * 0.45),
  ];
}

// ---- Diary + persistence -------------------------------------------------
const LS_KEY = 'offquarium-v1';
const DIARY_MAX = 50;
let persistTimer = 0;

function persistSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = 0;
    lsSet(LS_KEY, JSON.stringify({
      stats: state.stats,
      dayCount: state.dayCount,
      diary: state.diary,
      lastSeen: Date.now(),
    }));
  }, 1000);
}

function fmtClock(t) {
  const d = new Date(t);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function appendDiary(text, tsOverride) {
  state.diary.push({ t: tsOverride || Date.now(), text });
  if (state.diary.length > DIARY_MAX) state.diary.splice(0, state.diary.length - DIARY_MAX);
  renderDiary();
  persistSoon();
}

function renderDiary() {
  const list = document.getElementById('diaryList');
  if (!list) return;
  list.innerHTML = '';
  for (let i = state.diary.length - 1; i >= 0; i--) {
    const e = state.diary[i];
    const li = document.createElement('li');
    li.textContent = fmtClock(e.t) + ' — ' + e.text;
    list.appendChild(li);
  }
}

function loadPersistence() {
  let blob = null;
  try { blob = JSON.parse(lsGet(LS_KEY) || 'null'); } catch (_) { blob = null; }
  if (blob) {
    if (blob.stats) {
      for (const k of Object.keys(state.stats)) {
        if (typeof blob.stats[k] === 'number') state.stats[k] = blob.stats[k];
      }
      state.stepsAcc = (state.stats.steps || 0) * 100;
    }
    if (Array.isArray(blob.diary)) state.diary = blob.diary.slice(-DIARY_MAX);
    state.dayCount = blob.dayCount || 1;
    const last = blob.lastSeen ? new Date(blob.lastSeen) : null;
    if (last && last.toDateString() !== new Date().toDateString()) {
      state.dayCount++;
      appendDiary('day ' + state.dayCount + ' at the office begins');
    }
  }
  const dayEl = document.getElementById('statDay');
  if (dayEl) dayEl.textContent = state.dayCount;
  scheduleStatsRender();
  renderDiary();
  persistSoon();
  return blob;
}

document.getElementById('diaryToggle').addEventListener('click', () => {
  const list = document.getElementById('diaryList');
  const btn = document.getElementById('diaryToggle');
  const open = list.hidden;
  list.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  btn.classList.toggle('open', open);
});

// ---- Activity engine (idle vignettes) -------------------------------------
function pickWeighted(entries) {
  // entries: [ [key, weight], ... ] — returns a key.
  const total = entries.reduce((s, e) => s + e[1], 0);
  let roll = Math.random() * total;
  for (const [key, w] of entries) { roll -= w; if (roll <= 0) return key; }
  return entries.length ? entries[entries.length - 1][0] : null;
}

function activitySpot(key, piece) {
  const { w, h } = getCanvasSize();
  const spec = ACTIVITIES[key].spot;
  const px = piece.rx * w + spec.dx * piece.pw - SPRITE_W / 2;
  const py = piece.ry * h + spec.dy * piece.ph - SPRITE_H;
  return safeGatherPoint(px, py);
}

function maybeStartActivity(c) {
  if (c.type === 'ghost' && !c.ghostVisible) return false;
  if (state.activeScene) return false;
  // Candidate activities: furniture of that type exists and is unoccupied.
  const busy = new Set(state.chars.filter(o => o.activity).map(o => o.activity.piece));
  const candidates = [];
  for (const [key, def] of Object.entries(ACTIVITIES)) {
    const piece = furniturePieces.find(p => p.type === key && !busy.has(p));
    if (piece) candidates.push([key, def.weight, piece]);
  }
  if (!candidates.length) return false;
  const key = pickWeighted(candidates.map(([k, w]) => [k, w]));
  const piece = candidates.find(e => e[0] === key)[2];
  const spot = activitySpot(key, piece);
  const [dMin, dMax] = ACTIVITIES[key].dur;
  c.activity = { key, piece, phase: 'walking', remaining: rand(dMin, dMax), nextLineIn: rand(8000, 20000), stuckHits: 0 };
  c.targetX = spot.x; c.targetY = spot.y;
  c.targetStuckFrames = 0;
  c.state = 'walking';
  return true;
}

function tickActivity(c, frameDelta) {
  const act = c.activity;
  act.remaining -= frameDelta;
  act.nextLineIn -= frameDelta;
  if (act.nextLineIn <= 0) {
    act.nextLineIn = rand(8000, 20000);
    if (Math.random() < 0.6 && !c.bubbleEl) {
      if (act.key === 'couch_2seater') {
        showBubble(c, '💤', 2600);
      } else {
        showBubble(c, pick(ACTIVITY_LINES[act.key][c.type]), 2800);
      }
    }
  }
  if (act.remaining <= 0) finishActivity(c);
}

function finishActivity(c) {
  const key = c.activity.key;
  c.activity = null;
  c.state = 'walking';
  if (key === 'coffee_station') bumpStat('coffee');
  // Sampled diary entries — not every activity is newsworthy.
  if (Math.random() < 0.35) {
    appendDiary(c.name + ' finished ' + ACTIVITIES[key].label);
  }
  if (key === 'printer' && Math.random() < 0.15) printerJam(c);
}

function cancelActivity(c) {
  if (!c.activity) return;
  c.activity = null;
  // A walking-phase activity owns the character's current target — drop it
  // so callers don't inherit a stale destination.
  c.targetX = null; c.targetY = null;
  c.targetStuckFrames = 0;
  if (c.state === 'activity') c.state = 'walking';
}

// ---- Printer jam mini-scene -----------------------------------------------
function printerJam(jammer) {
  if (state.activeScene) return;
  const piece = furniturePieces.find(p => p.type === 'printer');
  if (!piece) return;
  showBubble(jammer, pickFresh(PRINTER_JAM_DIALOGUE[jammer.type], state.recentLines[jammer.type]), 2800);
  jammer.idleTimer = 4000;
  jammer.state = 'idle';
  // 1–2 nearest free colleagues walk over.
  const helpers = state.chars
    .filter(o => o !== jammer && !o.isChatting && !o.activity && !(o.type === 'ghost' && !o.ghostVisible))
    .sort((a, b) => dist(a, jammer) - dist(b, jammer))
    .slice(0, 1 + Math.floor(Math.random() * 2));
  helpers.forEach((helper, i) => {
    const spot = safeGatherPoint(jammer.x + (i === 0 ? -90 : 90), jammer.y);
    helper.targetX = spot.x; helper.targetY = spot.y;
    helper.targetStuckFrames = 0;
    helper.state = 'walking';
    trackedTimeout(() => {
      if (helper.idleTimer > 100000) helper.idleTimer = 3000;
      showBubble(helper, pickFresh(PRINTER_JAM_DIALOGUE[helper.type], state.recentLines[helper.type]), 2800);
    }, 2500 + i * 2200);
  });
  [jammer, ...helpers].forEach(ch => { ch.moodWord = 'grumpy'; ch.moodUntil = Date.now() + 5 * 60 * 1000; });
  // Safety unfreeze: a helper who arrives after their line-timeout fired would
  // otherwise sit on SCENE_IDLE_LOCK until the ambient chat scan rescues them.
  trackedTimeout(() => {
    helpers.forEach(h => { if (h.idleTimer > 100000) h.idleTimer = 1000; });
  }, 12000);
  appendDiary('printer jammed; ' + jammer.name + ' blamed the ghost');
  bumpStat('events');
}

// ---- Autonomous event scheduler --------------------------------------------
// A tick every 15 s; a roll fires an event on average every 2–4 minutes,
// scaled by the day-phase events multiplier. Per-event cooldowns prevent repeats.
const SCHEDULER_TICK_MS = 15000;
const EVENT_MEAN_GAP_MS = 3 * 60 * 1000; // avg one event per ~3 min at multiplier 1
const lastFired = {}; // eventKey -> epoch ms

function eventWeight(deckEntry) {
  let w = deckEntry.weight;
  if (deckEntry.key === 'lampFlicker') w *= state.phaseMult.lampWeight;
  return w;
}

function schedulerTick() {
  if (document.hidden) return; // hidden tabs are simulated by fastForward instead
  if (!state.isPlaying || state.activeScene) return;
  const p = SCHEDULER_TICK_MS / EVENT_MEAN_GAP_MS * state.phaseMult.events;
  if (Math.random() >= p) return;
  const now = Date.now();
  const ready = EVENT_DECK.filter(e => !lastFired[e.key] || now - lastFired[e.key] > e.cooldownMs);
  if (!ready.length) return;
  const key = pickWeighted(ready.map(e => [e.key, eventWeight(e)]));
  triggerEvent(key);
}

function triggerEvent(key) {
  const fn = EVENT_HANDLERS[key];
  if (!fn) { console.warn('unknown event', key); return; }
  lastFired[key] = Date.now();
  fn();
}

function birthdayGatherPositions() {
  const { w, h } = getCanvasSize();
  const table = furniturePieces.find(p => p.type === 'table_cafe');
  const cx = table ? table.rx * w + table.pw / 2 : w * 0.5;
  const cy = table ? table.ry * h + table.ph + 10 : h * 0.5;
  return [
    safeGatherPoint(cx - 120 - SPRITE_W / 2, cy),
    safeGatherPoint(cx - SPRITE_W / 2, cy + 8),
    safeGatherPoint(cx + 120 - SPRITE_W / 2, cy),
    safeGatherPoint(cx - SPRITE_W / 2, cy - SPRITE_H - 20),
  ];
}

const EVENT_HANDLERS = {
  coffee() {
    bumpStat('coffee');
    gatherAndChat(coffeeGatherPositions(), COFFEE_DIALOGUE, 2);
    state.chars.forEach(c => { c.moodWord = 'caffeinated'; c.moodUntil = Date.now() + 5 * 60 * 1000; });
    appendDiary('coffee break — everyone gathered at the machine');
  },
  meeting() {
    bumpStat('meetings');
    gatherAndChat(meetingGatherPositions(), MEETING_DIALOGUE, 3);
    appendDiary('an impromptu meeting broke out');
  },
  birthday() {
    bumpStat('events');
    const table = furniturePieces.find(p => p.type === 'table_cafe');
    if (table && table.el) {
      const cake = document.createElement('div');
      cake.className = 'event-cake';
      cake.textContent = '🎂';
      table.el.appendChild(cake);
      // Raw timer: gatherAndChat's clearPendingTimers() would kill a tracked one.
      setTimeout(() => cake.remove(), 25000);
    }
    gatherAndChat(birthdayGatherPositions(), BIRTHDAY_DIALOGUE, 2);
    state.chars.forEach(c => { c.moodWord = 'festive'; c.moodUntil = Date.now() + 5 * 60 * 1000; });
    appendDiary("someone's birthday — cake appeared on the café table 🎂");
  },
  lampFlicker() {
    bumpStat('events');
    const lamp = furniturePieces.find(p => p.type === 'lamp_arc_big');
    if (lamp && lamp.el) {
      lamp.el.classList.remove('lamp-flicker');
      lamp.el.classList.add('lamp-flicker');
      setTimeout(() => lamp.el.classList.remove('lamp-flicker'), 2000);
    }
    const ghost = state.chars.find(c => c.type === 'ghost');
    if (ghost && !ghost.ghostVisible) {
      // Force the ghost visible for its moment.
      ghost.ghostVisible = true;
      ghost.ghostTimer = 12000;
      if (ghost.el) ghost.el.classList.remove('ghost-hidden');
    }
    if (ghost) trackedTimeout(() => showBubble(ghost, 'UHU?!', 2600), 800);
    // Humans react in place — no gathering.
    state.chars.filter(c => c.type !== 'ghost').forEach((c, i) => {
      trackedTimeout(() => {
        showBubble(c, pickFresh(LAMP_FLICKER_DIALOGUE[c.type], state.recentLines[c.type]), 2800);
      }, 1600 + i * 1800);
    });
    appendDiary('the arc lamp flickered; the ghost seemed pleased');
  },
};

// Debug hook: window.__off.trigger('birthday') etc.
window.__off = { trigger: triggerEvent };

setInterval(schedulerTick, SCHEDULER_TICK_MS);

// ---- Day rhythm -------------------------------------------------------------
// Real local clock; ?hour=N overrides for testing.
const HOUR_OVERRIDE = (() => {
  const v = new URLSearchParams(location.search).get('hour');
  return v === null ? null : Math.max(0, Math.min(23, parseInt(v, 10) || 0));
})();

function currentPhase() {
  const hour = HOUR_OVERRIDE !== null ? HOUR_OVERRIDE : new Date().getHours();
  return DAY_PHASES.find(p =>
    p.from < p.to ? (hour >= p.from && hour < p.to)
                  : (hour >= p.from || hour < p.to)   // night wraps midnight
  ) || DAY_PHASES[0];
}

function applyPhase() {
  const p = currentPhase();
  if (state.phaseKey === p.key) return;
  const first = !state.phaseKey;
  state.phaseKey = p.key;
  state.phaseMult = {
    events: p.events, chat: p.chat, speed: p.speed,
    ghostVis: p.ghostVis, ghostHid: p.ghostHid,
    ghostSpeed: p.ghostSpeed, lampWeight: p.lampWeight,
  };
  const ov = document.getElementById('dayOverlay');
  ov.style.backgroundColor = p.tint;
  ov.style.opacity = p.tintOpacity;
  document.body.classList.toggle('night', p.key === 'night');
  if (state.chars) state.chars.forEach(c => c.el && c.el.style.setProperty('--step-dur', stepDur(c)));
  if (!first) appendDiary(p.key + ' settles over the office');
}

setInterval(applyPhase, 60000);

// ---- Drop a donut -----------------------------------------------------------
const DONUT_COOLDOWN_MS = 3 * 60 * 1000;
let lastDonutAt = 0;

function dropDonut() {
  const now = Date.now();
  if (now - lastDonutAt < DONUT_COOLDOWN_MS) return;
  lastDonutAt = now;
  const btn = document.getElementById('btnDonut');
  btn.disabled = true;
  // Raw timers: gatherAndChat's clearPendingTimers() would kill tracked ones.
  setTimeout(() => { btn.disabled = false; }, DONUT_COOLDOWN_MS);

  const spot = findSpawnPoint(state.chars);
  const donut = document.createElement('div');
  donut.className = 'donut-drop';
  donut.textContent = '🍩';
  donut.style.left = spot.x + SPRITE_W / 2 + 'px';
  donut.style.top = spot.y + SPRITE_H - 20 + 'px';
  canvas.appendChild(donut);

  const positions = state.chars.map((c, i) => {
    const a = (i / state.chars.length) * Math.PI * 2;
    return safeGatherPoint(spot.x + Math.cos(a) * 110, spot.y + Math.sin(a) * 70);
  });
  gatherAndChat(positions, DONUT_DIALOGUE, 2);
  bumpStat('events');
  appendDiary('a donut appeared from the sky; morale improved');
  setTimeout(() => donut.remove(), 16000);
}

document.getElementById('btnDonut').addEventListener('click', dropDonut);

// ---- While you were away ------------------------------------------------------
function estimateAway(elapsedMs, eventsMult, chatMult) {
  const minutes = elapsedMs / 60000;
  const events = Math.round(minutes / 3 * eventsMult);          // one event ≈ every 3 min
  const conversations = Math.round(minutes / 1.5 * chatMult);   // chats ≈ every 90 s at normal
  const coffees = Math.max(0, Math.round(events * 0.4));
  const ghostAppearances = Math.round(minutes / 0.5 / 2);       // ghost cycles ~every 30 s, visible half
  return { conversations, coffees, ghostAppearances, events };
}

const AWAY_DIARY_POOL = [
  'Jazz reorganized the kitchen again',
  'Olex closed a ticket nobody had opened',
  'Andy circled back, twice',
  'the printer made an unexplained noise',
  'someone watered the plant out of turn',
  'the ghost rearranged the whiteboard magnets',
  'a meeting almost happened, then didn\'t',
  'the coffee machine won an argument',
];

function fastForward(elapsedMs) {
  if (elapsedMs < 60000) return;
  const est = estimateAway(elapsedMs, state.phaseMult.events, state.phaseMult.chat);
  state.stats.conversations += est.conversations;
  state.stats.coffee += est.coffees;
  state.stats.events = (state.stats.events || 0) + est.events;
  scheduleStatsRender();
  const entries = Math.min(5, Math.max(1, Math.round(elapsedMs / (10 * 60 * 1000))));
  const start = Date.now() - elapsedMs;
  for (let i = 0; i < entries; i++) {
    const ts = start + (elapsedMs / (entries + 1)) * (i + 1);
    appendDiary(pick(AWAY_DIARY_POOL), ts);
  }
  showToast('While you were away: ' + est.conversations + ' conversations, '
    + est.coffees + ' coffees, the ghost appeared ' + est.ghostAppearances + ' times.');
  persistSoon();
}

function showToast(text) {
  const t = document.getElementById('awayToast');
  t.textContent = text;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 9000);
  t.onclick = () => t.classList.remove('show');
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    persistSoon();
  } else if (hiddenAt) {
    fastForward(Date.now() - hiddenAt);
    hiddenAt = 0;
  }
});

// ---- events.js boot (runs after game.js init) ----
const persistedBlob = loadPersistence();
applyPhase();
if (persistedBlob && persistedBlob.lastSeen) fastForward(Date.now() - persistedBlob.lastSeen);
