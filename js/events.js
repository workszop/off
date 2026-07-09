// Office Friends — events, scenes, ambient systems

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
  state.selectedId = null;
  updateCanvasCursor();
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
  c.activity = { key, piece, phase: 'walking', remaining: rand(dMin, dMax), nextLineIn: rand(8000, 20000) };
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
      if (helper.idleTimer === SCENE_IDLE_LOCK) helper.idleTimer = 3000;
      showBubble(helper, pickFresh(PRINTER_JAM_DIALOGUE[helper.type], state.recentLines[helper.type]), 2800);
    }, 2500 + i * 2200);
  });
  [jammer, ...helpers].forEach(ch => { ch.moodWord = 'grumpy'; ch.moodUntil = Date.now() + 5 * 60 * 1000; });
  // Safety unfreeze: a helper who arrives after their line-timeout fired would
  // otherwise sit on SCENE_IDLE_LOCK until the ambient chat scan rescues them.
  trackedTimeout(() => {
    helpers.forEach(h => { if (h.idleTimer === SCENE_IDLE_LOCK) h.idleTimer = 1000; });
  }, 12000);
  appendDiary('printer jammed; ' + jammer.name + ' blamed the ghost');
  bumpStat('events');
}

// ---- events.js boot (runs after game.js init) ----
const persistedBlob = loadPersistence();
