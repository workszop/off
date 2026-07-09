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

// ---- events.js boot (runs after game.js init) ----
const persistedBlob = loadPersistence();
