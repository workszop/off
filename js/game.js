// ============================================================
//  Offquarium — core simulation (pure HTML/CSS/JS, no build)
//
//  Script load order matters (see index.html):
//    data.js   → dialogue banks, sprite map, furniture catalogue
//    game.js   → state, game loop, movement, DOM rendering (this file)
//    events.js → scenes, activities, scheduler, persistence
//  game.js may call events.js functions freely: nothing here runs
//  before all three scripts have executed (rAF + event handlers only).
// ============================================================

// ---- Obstacles ----
// OBSTACLES holds pixel-space rects for the walls plus every furniture
// piece. Rebuilt by rebuildObstacles() whenever furniture changes or the
// canvas resizes (a ResizeObserver covers window resizes AND panel
// collapse, which changes the canvas width without a window resize).
const WALL_FRAC = 0.02; // wall band thickness as a fraction of canvas size
let OBSTACLES = [];

// Furniture pieces placed at runtime.
// { type, rx, ry, pw, ph, rotation, flipX, el } — position is fractional
// (survives resize), size is in pixels.
const furniturePieces = [];

function rebuildObstacles() {
  const { w, h } = getCanvasSize();
  const wallW = w * WALL_FRAC, wallH = h * WALL_FRAC;
  OBSTACLES = [
    { x: 0, y: 0, w: w, h: wallH },          // top wall
    { x: 0, y: h - wallH, w: w, h: wallH },  // bottom wall
    { x: 0, y: 0, w: wallW, h: h },          // left wall
    { x: w - wallW, y: 0, w: wallW, h: h },  // right wall
    ...furniturePieces.map(p => ({ x: p.rx * w, y: p.ry * h, w: p.pw, h: p.ph })),
  ];
}

// ---- Game Constants ----
const BASE_SPEED = 1.0;            // a touch quicker — characters cover more ground
const PROXIMITY = 70;              // preserve the original interaction geometry
const REPULSION = 45;
// Recomputed by updateSpriteSize() on load and on every resize.
// Desktop figures target 30% of viewport height. Narrow screens also cap them
// against viewport width so the paper figures and furniture remain legible.
let SPRITE_W = 80;
let SPRITE_H = 160;
let ATTRACT_RANGE = SPRITE_H * 2;
const CHAT_COOLDOWN_MS = 24000;
const INITIAL_SOCIAL_DELAY = [5000, 9000];
const SOCIAL_COOLDOWN = [12000, 22000];
const SOCIAL_RETRY = [1500, 3500];
const BETWEEN_CONVERSATIONS = [5000, 9000];
const DEPARTURE_WALK = [3200, 5200];
const TARGET_STUCK_FRAMES = 90;
const SCENE_IDLE_LOCK = 999_999; // idleTimer value that keeps a character frozen until the scene clears it
// A locked idleTimer decays each frame, so "still locked" means "way larger
// than any organic idle could ever be", not an exact match.
function isSceneLocked(c) { return c.idleTimer > 100_000; }
const DOM_SYNC_INTERVAL_MS = 100;
const STATS_RENDER_DEBOUNCE_MS = 200;
const SPAWN_MARGIN = 40;           // safe distance from canvas edge for spawns

// ---- Motion tuning (natural-movement pass) ----
// All steering/gait/social-motion knobs in one place. Ranges are [min, max]
// for rand(); times in ms; angles in radians.
const MOTION = {
  ACCEL_MS: 400,               // time from standstill to full speed
  TURN_RATE_SLOW: 4.5,         // rad/s turn cap when (nearly) stopped
  TURN_RATE_FAST: 1.6,         // rad/s turn cap at full speed
  WANDER_JITTER: 1.1,          // rad/s of random heading drift while wandering
  WALL_BIAS_MARGIN: 0.18,      // canvas fraction near a wall where center-bias engages
  WALL_BIAS_TURN_FRAC: 0.4,    // fraction of TURN_RATE_SLOW used to steer back to center
  SWERVE_TURN_MULT: 3,         // turn-rate multiplier for obstacle look-ahead swerves
  DEPART_PUSH_FRAC: 0.4,       // pointAwayFrom push-off speed as a fraction of target
  ESCAPE_PUSH_FRAC: 0.5,       // escape-hatch push-off speed as a fraction of target
  SPEED_WOBBLE: 0.15,          // targetSpeed oscillates ±this fraction
  SPEED_WOBBLE_PERIOD_MS: 7000,
  ARRIVE_RADIUS: 80,           // braking zone before a movement target (px)
  ARRIVE_MIN_FRAC: 0.25,       // speed floor inside the braking zone
  STRIDE_FRAC: 0.35,           // gait cycle length as a fraction of SPRITE_H
  FACING_HOLD_MS: 200,         // sustained direction needed before facing flips
  VIEW_HOLD_MS: 200,           // same for viewDirection
  PAUSE_EVERY_MS: [10000, 25000],
  PAUSE_DUR_MS: [1000, 3000],
  GLANCE_RANGE_FRAC: 1.2,      // glance trigger distance in SPRITE_W units
  GLANCE_PROB: 0.3,
  GLANCE_DUR_MS: [400, 700],
  GLANCE_COOLDOWN_MS: 12000,   // per character pair
  PART_GAZE_MS: [600, 1200],   // how long the stayer watches the leaver
  DISPERSE_STAGGER_MS: 1800,   // departure window after scenes/conversations
};

// Debug counters for behavior probes (exposed on window.__off in events.js).
const MOTION_COUNTERS = { pauses: 0, glances: 0, convTurns: 0 };

// ---- localStorage helpers (safe under private browsing / disabled storage) ----
function lsGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch (_) { /* no-op */ }
}

// Character types are exactly the dialogue-bank keys — single source of truth
// (data.js loads first, see the header comment).
const CHAR_TYPES = Object.keys(DIALOGUE_BANKS);
function freshStats() { return { conversations: 0, steps: 0, coffee: 0, meetings: 0, events: 0 }; }
function freshRecentLines() { return Object.fromEntries(CHAR_TYPES.map(t => [t, new Set()])); }

// ---- Game State ----
const state = {
  chars: [],
  selectedId: null,
  isPlaying: true,
  walkSpeed: 1.0,
  chatFreq: 50,
  stats: freshStats(),
  diary: [],
  dayCount: 1,
  stepsAcc: 0,
  convPairs: new Set(),
  glanceCooldowns: new Map(), // pairKey -> epoch ms of last glance roll
  socialPauseTimer: rand(3000, 6000),
  pendingTimers: new Set(),
  lastTime: 0,
  domSyncAcc: 0,
  statsDirty: false,
  statsRenderTimer: 0,
  panelOpen: false,
  drawerView: null,
  editMode: false,
  hasSeenHelp: lsGet('office-friends-seen-help') === 'true',
  // True while a scripted scene (Coffee/Meeting) is gathering the characters
  // and running their conversation — suppresses autonomous chat triggers.
  activeScene: false,
  // Per-character set of recently-used line indices — prevents repeating the
  // same line until the recency window (≤ 1/3 of bank size) has cleared.
  recentLines: freshRecentLines(),
  // Multipliers driven by the day/night phase (Task 7) — everything reads
  // through this now so the phase system has a single hook point later.
  phaseMult: { events: 1, chat: 1, speed: 1, ghostVis: 1, ghostHid: 1, ghostSpeed: 1, lampWeight: 1 },
};

// ---- DOM refs ----
const $ = (id) => document.getElementById(id);
const canvas = $('gameCanvas');
const charsLayer = $('charactersLayer');
const bubblesLayer = $('bubblesLayer');
const furnitureLayer = $('furnitureLayer');
const statEls = {
  conversations: $('statConversations'),
  steps: $('statSteps'),
  coffee: $('statCoffee'),
  meetings: $('statMeetings'),
  events: $('statEvents'),
};

// ---- Sprite size (responsive) ----
function updateSpriteSize() {
  const desktopHeight = window.innerHeight * 0.30;
  const mobileHeight = Math.min(window.innerHeight * 0.22, window.innerWidth * 0.34);
  SPRITE_H = Math.round(window.innerWidth <= 768 ? Math.max(110, mobileHeight) : desktopHeight);
  SPRITE_W = Math.round(SPRITE_H * 0.5);
  ATTRACT_RANGE = SPRITE_H * 2;
  const root = document.documentElement.style;
  root.setProperty('--sprite-h', SPRITE_H + 'px');
  root.setProperty('--sprite-w', SPRITE_W + 'px');
}

// ---- Helpers ----
function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Speak a line from `bank` that this character hasn't used recently.
function sayFresh(c, bank) { showBubble(c, pickFresh(bank[c.type], state.recentLines[c.type])); }

function clearTarget(c) { c.targetX = null; c.targetY = null; c.targetStuckFrames = 0; }

// Release a character from any chat/approach commitment. Doesn't touch
// timers — callers decide what happens to socialTimer/idleTimer.
function releaseSocial(c) {
  c.isChatting = false;
  c.chatPartner = null;
  c.approachPartner = null;
  c.listeningTo = null;
  if (c.state === 'chatting') c.state = 'idle';
}

// Shortest-arc turn from `from` toward `to`, limited to maxDelta radians.
function turnToward(from, to, maxDelta) {
  const diff = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return from + clamp(diff, -maxDelta, maxDelta);
}

// Turn cap in rad/s: generous when slow (can pivot in place), tight when
// moving fast (carves arcs instead of snapping).
function turnRate(c) {
  const f = clamp(c.curSpeed / Math.max(0.001, effectiveSpeed(c)), 0, 1);
  return MOTION.TURN_RATE_SLOW + (MOTION.TURN_RATE_FAST - MOTION.TURN_RATE_SLOW) * f;
}

// Integrate curSpeed toward targetSpeed under the acceleration cap, derive
// vx/vy from heading, advance position and the gait odometer. Returns the
// distance stepped this frame (for the step counter).
function applyMotion(c, dt, frameDelta) {
  const accelPerFrame = effectiveSpeed(c) / (MOTION.ACCEL_MS / 16.667);
  c.curSpeed = c.curSpeed < c.targetSpeed
    ? Math.min(c.targetSpeed, c.curSpeed + accelPerFrame * dt)
    : Math.max(c.targetSpeed, c.curSpeed - accelPerFrame * dt);
  if (!Number.isFinite(c.heading)) c.heading = Math.random() * Math.PI * 2;
  c.vx = Math.cos(c.heading) * c.curSpeed;
  c.vy = Math.sin(c.heading) * c.curSpeed;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  const stepped = Math.hypot(c.vx * dt, c.vy * dt);
  c.gaitDist += stepped;
  return stepped;
}

// Facing follows horizontal velocity, but only after the new direction has
// been sustained - kills sprite flicker when vx hovers around zero.
function setFacingFromVX(c, frameDelta) {
  const want = c.vx > 0.1 ? 'right' : c.vx < -0.1 ? 'left' : c.facing;
  if (want === c.facing) { c.facingHold = 0; return; }
  c.facingHold += frameDelta;
  if (c.facingHold >= MOTION.FACING_HOLD_MS) { c.facing = want; c.facingHold = 0; }
}

// Pick a line that wasn't recently used by this character type.
// The recency window is at most 1/3 of the bank size (capped at 15) so
// characters with small banks still cycle through all lines before repeating.
function pickFresh(bank, recentSet) {
  const max = Math.min(Math.floor(bank.length / 3), 15);
  const pool = bank.map((_, i) => i).filter(i => !recentSet.has(i));
  const idx = pool.length ? pool[Math.floor(Math.random() * pool.length)]
                          : Math.floor(Math.random() * bank.length);
  recentSet.add(idx);
  if (recentSet.size > max) { const [oldest] = recentSet; recentSet.delete(oldest); }
  return bank[idx];
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function getCanvasSize() {
  return { w: canvas.clientWidth, h: canvas.clientHeight };
}

// Walk speed in px/frame for this character right now: base speed × the
// user's speed slider × the day-phase multiplier (ghost gets its own extra
// multiplier so it can prowl faster at night).
function effectiveSpeed(c) {
  return c.speed * state.walkSpeed * state.phaseMult.speed
       * (c.type === 'ghost' ? state.phaseMult.ghostSpeed : 1);
}

function socialDelay(range = SOCIAL_COOLDOWN, multiplier = 1) {
  const strength = (state.chatFreq / 100) * state.phaseMult.chat;
  if (strength <= 0) return Number.POSITIVE_INFINITY;
  const normalised = clamp(0.5 / strength, 0.55, 5);
  return rand(range[0], range[1]) * normalised * multiplier;
}

function abortSocialApproach(c) {
  const partner = state.chars.find(p => p.id === c.approachPartner);
  const participants = partner ? [c, partner] : [c];
  for (const participant of participants) {
    participant.approachPartner = null;
    participant.targetStuckFrames = 0;
    participant.idleTimer = 0;
    if (!participant.isChatting) participant.state = 'walking';
    participant.socialTimer = socialDelay(SOCIAL_RETRY);
  }
}

function pointAwayFrom(c, sourceX, sourceY, cooldownMultiplier = 1) {
  let angle = Math.atan2(c.y - sourceY, c.x - sourceX);
  if (!Number.isFinite(angle) || (Math.abs(c.x - sourceX) < 0.01 && Math.abs(c.y - sourceY) < 0.01)) {
    angle = Math.random() * Math.PI * 2;
  }
  angle += rand(-0.32, 0.32);
  const spd = effectiveSpeed(c);
  c.heading = angle;
  c.targetSpeed = spd;
  c.curSpeed = Math.max(c.curSpeed, spd * MOTION.DEPART_PUSH_FRAC); // push off, don't crawl away
  c.vx = Math.cos(angle) * c.curSpeed;
  c.vy = Math.sin(angle) * c.curSpeed;
  c.departTimer = rand(DEPARTURE_WALK[0], DEPARTURE_WALK[1]);
  c.dirTimer = c.departTimer;
  c.idleTimer = 0;
  clearTarget(c);
  releaseSocial(c);
  c.socialTimer = socialDelay(SOCIAL_COOLDOWN, cooldownMultiplier);
  c.state = 'walking';
}

function disperseCharacters(cooldownMultiplier = 1, initial = false) {
  if (!state.chars.length) return;
  const cx = state.chars.reduce((sum, c) => sum + c.x, 0) / state.chars.length;
  const cy = state.chars.reduce((sum, c) => sum + c.y, 0) / state.chars.length;
  state.chars.forEach((c, i) => {
    // Nobody moves on the same frame: departures spread over a short window.
    // First mover leaves immediately so scene-ends don't feel laggy.
    const delay = initial || i === 0 ? 0 : rand(0, MOTION.DISPERSE_STAGGER_MS);
    if (delay === 0) {
      pointAwayFrom(c, cx, cy, cooldownMultiplier);
    } else {
      trackedTimeout(() => pointAwayFrom(c, cx, cy, cooldownMultiplier), delay);
    }
    if (initial) c.socialTimer = socialDelay(INITIAL_SOCIAL_DELAY);
  });
  state.socialPauseTimer = initial
    ? rand(3000, 6000)
    : rand(BETWEEN_CONVERSATIONS[0], BETWEEN_CONVERSATIONS[1]);
}

// Hard clamp inside the wall band — final safety net after obstacle pushback.
function clampToRoom(c, w, h) {
  const wallW = w * WALL_FRAC, wallH = h * WALL_FRAC;
  c.x = clamp(c.x, wallW, w - SPRITE_W - wallW);
  c.y = clamp(c.y, wallH, h - SPRITE_H - wallH);
}

// vx/vy are the character's current velocity — used to pick the push axis.
// When approaching a desk from the side (horizontal velocity dominant), we must
// push horizontally; the old min-overlap rule incorrectly pushed vertically
// because SPRITE_H > desk height makes the y-overlap smaller.
function wouldHitObstacle(x, y, vx, vy, obstacles) {
  for (const o of obstacles) {
    if (rectsOverlap(x, y, SPRITE_W, SPRITE_H, o.x, o.y, o.w, o.h)) {
      const cx = x + SPRITE_W / 2, cy = y + SPRITE_H / 2;
      const ocx = o.x + o.w / 2, ocy = o.y + o.h / 2;
      const dx = cx - ocx, dy = cy - ocy;
      const ox = (SPRITE_W + o.w) / 2 - Math.abs(dx);
      const oy = (SPRITE_H + o.h) / 2 - Math.abs(dy);
      // Resolve along the axis of motion when moving; fall back to min-overlap
      // for stationary characters (idle push-out).
      const speed = Math.hypot(vx, vy);
      const resolveX = speed > 0.1 ? Math.abs(vx) >= Math.abs(vy) : ox <= oy;
      if (resolveX) return { hit: true, px: dx > 0 ? ox : -ox, py: 0 };
      return { hit: true, px: 0, py: dy > 0 ? oy : -oy };
    }
  }
  return { hit: false, px: 0, py: 0 };
}

// Iterative pushback — repeat up to 3 times so a push into one obstacle
// doesn't silently embed the character in a second one.
function resolveObstacles(c, obstacles) {
  for (let iter = 0; iter < 3; iter++) {
    const col = wouldHitObstacle(c.x, c.y, c.vx, c.vy, obstacles);
    if (!col.hit) break;
    c.x += col.px;
    c.y += col.py;
  }
}

// Find a valid point near (x, y) that is inside the room and clear of obstacles.
function safeGatherPoint(x, y) {
  const { w, h } = getCanvasSize();
  const cx = clamp(x, SPAWN_MARGIN, w - SPRITE_W - SPAWN_MARGIN);
  const cy = clamp(y, SPAWN_MARGIN, h - SPRITE_H - SPAWN_MARGIN);
  if (!wouldHitObstacle(cx, cy, 0, 0, OBSTACLES).hit) return { x: cx, y: cy };
  for (let r = 20; r <= 160; r += 20) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const nx = clamp(cx + Math.cos(a) * r, SPAWN_MARGIN, w - SPRITE_W - SPAWN_MARGIN);
      const ny = clamp(cy + Math.sin(a) * r, SPAWN_MARGIN, h - SPRITE_H - SPAWN_MARGIN);
      if (!wouldHitObstacle(nx, ny, 0, 0, OBSTACLES).hit) return { x: nx, y: ny };
    }
  }
  return findSpawnPoint();
}

// Tracked timers — clearable on pause/reset so they can't fire after state changes
function trackedTimeout(fn, ms) {
  const id = setTimeout(() => {
    state.pendingTimers.delete(id);
    fn();
  }, ms);
  state.pendingTimers.add(id);
  return id;
}
function clearPendingTimers() {
  for (const id of state.pendingTimers) clearTimeout(id);
  state.pendingTimers.clear();
  // A pending scene's whole timeline lives in these timers, so cancelling
  // them ends the scene.
  state.activeScene = false;
}
function clearAllBubbles() {
  state.chars.forEach(c => {
    if (c.bubbleEl) { c.bubbleEl.remove(); c.bubbleEl = null; }
  });
}

// ---- Character Factory ----
function createCharacter(id, name, type, x, y, speedMod) {
  return {
    id, name, type, x, y,
    vx: 0, vy: 0,
    // Steering state: motion is heading × curSpeed; curSpeed chases
    // targetSpeed under an acceleration cap, turns are rate-limited.
    heading: Math.random() * Math.PI * 2,
    curSpeed: 0,
    targetSpeed: 0,
    gaitDist: Math.random() * 1000, // walk-cycle odometer, random initial phase
    facingHold: 0,
    viewHold: 0,
    pauseIn: rand(MOTION.PAUSE_EVERY_MS[0], MOTION.PAUSE_EVERY_MS[1]),
    pauseTimer: 0,
    glanceTimer: 0,
    glanceFacing: 'left',
    listeningTo: null,
    dirTimer: rand(0, 1500),
    speed: BASE_SPEED * speedMod,
    speedMod,
    state: 'walking',
    facing: Math.random() > 0.5 ? 'right' : 'left',
    viewDirection: 'front',
    targetX: null, targetY: null,
    targetStuckFrames: 0,
    departTimer: 0,
    escapeFrames: 0,
    lastEscapeAt: 0,
    idleTimer: 0,
    isChatting: false,
    approachPartner: null,
    socialTimer: socialDelay(INITIAL_SOCIAL_DELAY),
    activity: null, moodWord: null, moodUntil: 0,
    // Ghost-only: visibility cycling. ghostVisible starts false so the ghost
    // materialises a few seconds after page load rather than at the start.
    ghostVisible: false,
    ghostTimer: 3000 + Math.random() * 7000,
    el: null, innerEl: null, imgEl: null, bubbleEl: null,
    lastSpriteSrc: '',
    lastSpriteTransform: '',
    lastInnerClass: '',
    movePhaseOffset: Math.random() * 1000,
  };
}

// Pick a random spawn point that's safely inside the room and not overlapping
// any obstacle. Used for init and reset so characters never start clipped
// into the walls or desks.
function findSpawnPoint(existing = []) {
  const { w, h } = getCanvasSize();
  for (let i = 0; i < 60; i++) {
    const x = rand(SPAWN_MARGIN, w - SPRITE_W - SPAWN_MARGIN);
    const y = rand(SPAWN_MARGIN, h - SPRITE_H - SPAWN_MARGIN);
    if (wouldHitObstacle(x, y, 0, 0, OBSTACLES).hit) continue;
    // Keep characters from spawning on top of each other.
    let overlapsOther = false;
    for (const p of existing) {
      if (Math.hypot(p.x - x, p.y - y) < SPRITE_W) { overlapsOther = true; break; }
    }
    if (!overlapsOther) return { x, y };
  }
  return { x: w / 2 - SPRITE_W / 2, y: h / 2 - SPRITE_H / 2 };
}

function initCharacters() {
  state.chars = [
    createCharacter('andy',  'Andy',  'andy',  0, 0, 1.0),
    createCharacter('jazz',  'Jazz',  'jazz',  0, 0, 1.2),
    createCharacter('olex',  'Olex',  'olex',  0, 0, 0.85),
    createCharacter('ghost', 'Ghost', 'ghost', 0, 0, 1.1),
  ];
  const placed = [];
  for (const c of state.chars) {
    const p = findSpawnPoint(placed);
    c.x = p.x; c.y = p.y;
    placed.push(p);
  }
  disperseCharacters(1, true);
  state.chars.forEach(c => {
    renderCharacter(c);
    if (c.type === 'ghost') c.el.classList.add('ghost-hidden');
  });
}

// Step cadence: faster walk = faster steps. 0.8s at 1.0 effective speed.
// Derived from effectiveSpeed so cadence can't drift from the actual walk
// speed — this also folds in the ghost's night-prowl multiplier.
function stepCycleMs(c) {
  return 800 / Math.max(0.3, effectiveSpeed(c) / BASE_SPEED);
}
function stepDur(c) {
  return (stepCycleMs(c) / 1000).toFixed(3) + 's';
}

function movementView(c) {
  const ax = Math.abs(c.vx);
  const ay = Math.abs(c.vy);
  if (ay > ax * 1.35) return c.vy >= 0 ? 'front' : 'back';
  if (ax > ay * 1.35) return 'side';
  return 'threequarter';
}

function directionalSprite(c, base) {
  return {
    src: base.src,
    scale: base.scale,
    flip: c.facing === 'left' ? !base.flip : base.flip,
  };
}

// Gait phase comes from distance walked (the odometer applyMotion advances),
// not wall-clock time - feet stop sliding when speed changes.
function movementSprite(c) {
  const frames = SPRITE_MAP[c.type].directions[c.viewDirection].move;
  const stride = SPRITE_H * MOTION.STRIDE_FRAC;
  const phase = ((c.gaitDist + c.movePhaseOffset) % stride) / stride;
  const base = frames[Math.floor(phase * frames.length) % frames.length];
  return directionalSprite(c, base);
}

function idleSprite(c) {
  const base = SPRITE_MAP[c.type].directions[c.viewDirection].idle;
  return directionalSprite(c, base);
}

// Hold references so the browser can't GC the images mid-fetch.
const preloadedSprites = [];
function preloadMovementSprites() {
  Object.values(SPRITE_MAP).forEach(def => {
    Object.values(def.directions).forEach(direction => {
      [direction.idle, ...direction.move].forEach(frame => {
        const img = new Image();
        img.src = frame.src;
        preloadedSprites.push(img);
      });
    });
  });
}
// Re-derive every character's CSS step cadence (speed slider / phase change).
function refreshStepDurations() {
  state.chars.forEach(c => c.el && c.el.style.setProperty('--step-dur', stepDur(c)));
}

// ---- DOM Rendering ----
function renderCharacter(c) {
  const el = document.createElement('div');
  el.className = 'character';
  el.dataset.id = c.id;
  el.dataset.type = c.type;
  el.dataset.paperFigure = 'true';
  el.dataset.motion = 'walking';
  el.style.setProperty('--step-dur', stepDur(c));
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${c.name} — click or press Enter to select`);
  el.setAttribute('aria-pressed', 'false');
  el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;

  // Inner element carries the walking/wave bob so it composes cleanly
  // with the root's translate3d positioning.
  const inner = document.createElement('div');
  inner.className = 'character-inner walking';
  inner.style.animationDelay = (-Math.random() * 0.8).toFixed(2) + 's';

  const initialSprite = movementSprite(c);
  el.dataset.spriteFrame = initialSprite.src;
  el.dataset.facing = c.facing;
  const initialTransform = spriteTransform(initialSprite);
  const img = document.createElement('img');
  img.src = initialSprite.src;
  img.style.transform = initialTransform;
  img.alt = '';
  img.draggable = false;
  c.lastSpriteSrc = img.src;
  c.lastSpriteTransform = initialTransform;
  c.lastInnerClass = inner.className;

  const label = document.createElement('span');
  label.className = 'name-label';
  label.textContent = c.name;

  const stand = document.createElement('span');
  stand.className = 'character-stand';
  stand.setAttribute('aria-hidden', 'true');

  el.appendChild(stand);
  inner.appendChild(img);
  el.appendChild(inner);
  el.appendChild(label);   // sibling of inner — not clipped by character-inner's clip-path

  el.addEventListener('click', (e) => { e.stopPropagation(); onCharClick(c.id); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCharClick(c.id); }
  });

  c.el = el;
  c.innerEl = inner;
  c.imgEl = img;
  charsLayer.appendChild(el);
}

function updateCharDOM(c) {
  if (!c.el) return;

  // Position via transform — no layout, GPU-accelerated.
  c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;

  const isMoving = Math.abs(c.vx) > 0.1 || Math.abs(c.vy) > 0.1;
  const walking = c.state === 'walking' && isMoving;
  // viewDirection switches only after the candidate has been stable for
  // VIEW_HOLD_MS (updateCharDOM runs at ~10Hz, hence the interval step).
  if (walking) {
    const want = movementView(c);
    if (want !== c.viewDirection) {
      c.viewHold += DOM_SYNC_INTERVAL_MS;
      if (c.viewHold >= MOTION.VIEW_HOLD_MS) { c.viewDirection = want; c.viewHold = 0; }
    } else {
      c.viewHold = 0;
    }
  } else {
    c.viewHold = 0;
    c.facingHold = 0;
  }
  const innerCls = walking ? 'character-inner walking' : 'character-inner';
  const sprite = walking ? movementSprite(c) : idleSprite(c);

  if (innerCls !== c.lastInnerClass) {
    c.innerEl.className = innerCls;
    c.lastInnerClass = innerCls;
  }
  if (sprite.src !== c.lastSpriteSrc) {
    c.imgEl.src = sprite.src;
    c.lastSpriteSrc = sprite.src;
  }
  const tx = spriteTransform(sprite);
  if (tx !== c.lastSpriteTransform) {
    c.imgEl.style.transform = tx;
    c.lastSpriteTransform = tx;
  }

  // is-walking drives the gait and shadow pulse. The collage keeps the full
  // paper figure visible in both idle and walking states.
  c.el.classList.toggle('is-walking', isMoving);
  c.el.dataset.motion = walking ? 'walking' : 'idle';
  c.el.dataset.social = c.isChatting
    ? (c.listeningTo ? 'listening' : 'chatting')
    : c.approachPartner !== null ? 'approaching' : 'independent';
  c.el.dataset.socialCooldown = Number.isFinite(c.socialTimer)
    ? String(Math.ceil(c.socialTimer / 1000))
    : 'silent';
  c.el.dataset.spriteFrame = sprite.src;
  c.el.dataset.facing = c.facing;
  c.el.dataset.viewDirection = c.viewDirection;

  c.el.classList.toggle('selected', state.selectedId === c.id);
}

// How long a bubble stays up — scales with line length so long lines can
// actually be read; short quips (the ghost's "uhu") don't linger.
const BUBBLE_MIN_MS = 3500;
const BUBBLE_MAX_MS = 8000;
function bubbleDuration(text) {
  return Math.min(BUBBLE_MAX_MS, Math.max(BUBBLE_MIN_MS, 1800 + text.length * 45));
}

function showBubble(c, text, duration = bubbleDuration(text)) {
  // Character inspection owns the reading layer while it is open, preventing
  // autonomous dialogue from covering or competing with the detail card.
  if (obsCardEl) return;
  if (c.bubbleEl) { c.bubbleEl.remove(); c.bubbleEl = null; }

  const b = document.createElement('div');
  b.className = 'speech-bubble';
  b.dataset.type = c.type;

  const name = document.createElement('div');
  name.className = 'bubble-name';
  name.textContent = c.name;

  const msg = document.createElement('div');
  msg.textContent = text;

  b.appendChild(name);
  b.appendChild(msg);
  bubblesLayer.appendChild(b);
  c.bubbleEl = b;

  // Position after appending so offsetWidth is correct.
  positionBubble(c);

  trackedTimeout(() => {
    if (!c.bubbleEl) return;
    const el = c.bubbleEl;
    el.classList.add('exiting');
    trackedTimeout(() => {
      el.remove();
      if (c.bubbleEl === el) c.bubbleEl = null;
    }, 300);
  }, duration);
}

function positionBubble(c) {
  if (!c.bubbleEl) return;
  const el = c.bubbleEl;
  const { w } = getCanvasSize();
  // Measure once — bubble size is static after creation, and this now runs
  // every frame, so re-measuring would force a layout per positioning pass.
  if (!el._bw) { el._bw = el.offsetWidth; el._bh = el.offsetHeight; }
  const bw = el._bw || 220;
  const bh = el._bh || 70;
  const centerX = c.x + SPRITE_W / 2;
  // Clamp horizontally so the bubble can't clip off the canvas edge.
  const left = clamp(centerX - bw / 2, 8, w - bw - 8);
  // The 2:3 sprite images letterbox inside the 1:2 character box under
  // object-fit:contain, so the drawn content (the head) starts 12.5% down
  // from the box top. Place the bubble so its triangle tip (8px below the
  // bubble's bottom edge) lands just above that, with a 4px clearance gap.
  let top = c.y + SPRITE_H * 0.125 - bh - 8 - 4;
  // Don't let the bubble disappear above the canvas.
  top = Math.max(8, top);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  // Keep the pointer triangle aimed at the character's head.
  const pointerLeft = clamp(centerX - left, 12, bw - 12);
  el.style.setProperty('--pointer-x', pointerLeft + 'px');
}

// ---- Stats ----
// Mutate state immediately; only debounce the DOM render. This prevents
// back-to-back updates from losing increments inside the debounce window.
function bumpStat(name, by = 1) {
  state.stats[name] += by;
  scheduleStatsRender();
  persistSoon();
}
function setStat(name, value) {
  if (state.stats[name] === value) return;
  state.stats[name] = value;
  scheduleStatsRender();
  persistSoon();
}
function scheduleStatsRender() {
  state.statsDirty = true;
  if (state.statsRenderTimer) return;
  state.statsRenderTimer = setTimeout(() => {
    state.statsRenderTimer = 0;
    if (!state.statsDirty) return;
    state.statsDirty = false;
    for (const [key, el] of Object.entries(statEls)) {
      const text = String(state.stats[key]);
      if (el.textContent === text) continue;
      el.textContent = text;
      // Pulse only the pill whose value actually changed.
      const pill = el.closest('.stat-pill');
      pill.classList.remove('pulse');
      void pill.offsetWidth; // restart the pulse animation
      pill.classList.add('pulse');
    }
  }, STATS_RENDER_DEBOUNCE_MS);
}

// ---- Game Loop ----

// Advance c one frame toward (tx, ty). d is the current distance to the
// target (precomputed by the caller, must be > 0). Brakes inside
// ARRIVE_RADIUS (with a floor so stuck detection keeps working) and turns
// toward the target through the turn cap, so approaches curve in and slow
// down instead of driving straight in and stopping dead. Returns the
// distance walked plus stuck=true after TARGET_STUCK_FRAMES of no progress.
function moveToward(c, tx, ty, d, dt, frameDelta, obstacles) {
  const spd = effectiveSpeed(c);
  const targetHeading = Math.atan2(ty - c.y, tx - c.x);
  c.heading = turnToward(c.heading, targetHeading, turnRate(c) * (frameDelta / 1000));
  c.targetSpeed = spd * clamp(d / MOTION.ARRIVE_RADIUS, MOTION.ARRIVE_MIN_FRAC, 1);
  const prevX = c.x, prevY = c.y;
  const stepped = applyMotion(c, dt, frameDelta);
  setFacingFromVX(c, frameDelta);
  c.state = 'walking';
  // Resolve against obstacles BEFORE measuring progress — a character
  // blocked by furniture must register zero net movement here, or the
  // stuck detection below never fires.
  resolveObstacles(c, obstacles);
  if (Math.hypot(c.x - prevX, c.y - prevY) < 0.5) {
    c.targetStuckFrames++;
  } else {
    c.targetStuckFrames = 0;
  }
  return { stepped, stuck: c.targetStuckFrames > TARGET_STUCK_FRAMES };
}

function gameLoop(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const frameDelta = timestamp - state.lastTime;
  const dt = Math.min(frameDelta / 16.667, 3);
  state.lastTime = timestamp;

  if (state.isPlaying) {
    const { w, h } = getCanvasSize();
    const obstacles = OBSTACLES;
    let stepsAcc = 0;
    state.socialPauseTimer = Math.max(0, state.socialPauseTimer - frameDelta);

    for (const c of state.chars) {
      if (Number.isFinite(c.socialTimer) && c.socialTimer > 0) {
        c.socialTimer = Math.max(0, c.socialTimer - frameDelta);
      }

      if (c.isChatting) {
        // ---- chatting: freeze in place ----
        c.vx = 0; c.vy = 0;

      } else if (c.idleTimer > 0) {
        // ---- idle countdown ----
        c.idleTimer -= frameDelta;
        if (c.idleTimer <= 0) { c.state = 'walking'; c.idleTimer = 0; }

      } else if (c.approachPartner !== null) {
        // ---- approach: walk toward partner ----
        const partner = state.chars.find(p => p.id === c.approachPartner);
        const blocked = !partner || partner.isChatting || state.activeScene
                     || partner.approachPartner !== c.id
                     || (partner.type === 'ghost' && !partner.ghostVisible)
                     || (c.type === 'ghost' && !c.ghostVisible);
        if (blocked) {
          abortSocialApproach(c);
          c.vx = 0; c.vy = 0;
        } else {
          const ad = dist(c, partner);
          if (ad < PROXIMITY) {
            c.vx = 0; c.vy = 0;
            c.state = 'idle';
          } else {
            const r = moveToward(c, partner.x, partner.y, ad, dt, frameDelta, obstacles);
            stepsAcc += r.stepped;
            if (r.stuck) {
              // Give up on the partner: hop a small random step out of the
              // blocked spot and release both sides of the social pair.
              const esc = Math.random() * Math.PI * 2;
              c.x += Math.cos(esc) * 20;
              c.y += Math.sin(esc) * 20;
              c.vx = 0; c.vy = 0;
              abortSocialApproach(c);
            }
          }
        }

      } else if (c.activity && c.activity.phase === 'holding') {
        // ---- ambient activity: hold at furniture, occasionally speak ----
        c.vx = 0; c.vy = 0;
        tickActivity(c, frameDelta);

      } else if (c.targetX !== null && c.targetY !== null) {
        // ---- target-based movement (scene gather / activity walk) ----
        const td = Math.hypot(c.targetX - c.x, c.targetY - c.y);
        if (td < 10) {
          clearTarget(c);
          c.vx = 0; c.vy = 0;
          if (c.activity && c.activity.phase === 'walking') {
            // Arrived at the activity spot — hold there, facing the furniture.
            c.activity.phase = 'holding';
            c.state = 'activity';
            const p = c.activity.piece;
            const pieceCx = p.rx * w + p.pw / 2;
            c.facing = pieceCx >= c.x + SPRITE_W / 2 ? 'right' : 'left';
          } else {
            c.state = 'idle';
            c.idleTimer = SCENE_IDLE_LOCK;
          }
        } else {
          const r = moveToward(c, c.targetX, c.targetY, td, dt, frameDelta, obstacles);
          stepsAcc += r.stepped;
          if (r.stuck) {
            c.targetStuckFrames = 0;
            // Activity walkers give up after a few failed nudges — there is no
            // pathfinding, so a blocked direct line would grind forever.
            if (c.activity && c.activity.phase === 'walking'
                && ++c.activity.stuckHits >= 3) {
              cancelActivity(c);
            } else {
              const angle = Math.random() * Math.PI * 2;
              c.x += Math.cos(angle) * 8;
              c.y += Math.sin(angle) * 8;
            }
          }
        }

      } else if (state.activeScene) {
        // ---- scene: arrived characters stand still ----
        c.vx = 0; c.vy = 0;
        if (c.state !== 'chatting') c.state = 'idle';

      } else {
        // ---- autonomous wander: heading drifts, speed breathes, turns capped ----
        const spd = effectiveSpeed(c);
        const departing = c.departTimer > 0;
        if (departing) c.departTimer = Math.max(0, c.departTimer - frameDelta);
        c.dirTimer = Math.max(0, c.dirTimer - frameDelta);

        // Ambient activity roll: when the gate opens, sometimes head to a
        // furniture spot instead of wandering (events.js).
        if (!departing && c.dirTimer <= 0 && Math.random() < 0.012 * dt * 0.4 * state.phaseMult.events) {
          if (maybeStartActivity(c)) continue;
          c.dirTimer = 1200 + Math.random() * 2000;
        }

        // Micro-pause: every so often stop, look around, then move on.
        // Wander-only by construction (this branch is never reached during
        // scenes, approaches, or activities).
        if (c.pauseTimer > 0) {
          c.pauseTimer -= frameDelta;
          c.targetSpeed = 0;
          applyMotion(c, dt, frameDelta); // decelerate smoothly to a stop
          if (c.curSpeed < 0.05) {
            c.state = 'idle';
            // Glance around: swap the viewed direction ~twice per pause.
            if (Math.random() < frameDelta / 1200) {
              c.viewDirection = pick(['front', 'side', 'threequarter']);
            }
          }
          if (c.pauseTimer <= 0) {
            c.heading = Math.random() * Math.PI * 2; // depart somewhere new
            c.pauseIn = rand(MOTION.PAUSE_EVERY_MS[0], MOTION.PAUSE_EVERY_MS[1]);
            c.state = 'walking';
          }
        } else if (!departing && (c.pauseIn -= frameDelta) <= 0) {
          c.pauseTimer = rand(MOTION.PAUSE_DUR_MS[0], MOTION.PAUSE_DUR_MS[1]);
          MOTION_COUNTERS.pauses++;
        } else {
          // Slow per-character speed wobble around the effective speed.
          const wobble = Math.sin(
            (timestamp + c.movePhaseOffset * 7) / MOTION.SPEED_WOBBLE_PERIOD_MS * Math.PI * 2);
          c.targetSpeed = spd * (1 + MOTION.SPEED_WOBBLE * wobble);

          // Heading drifts by bounded noise instead of jumping to random angles.
          c.heading += rand(-1, 1) * MOTION.WANDER_JITTER * (frameDelta / 1000);

          // Near a wall, bias gently back toward the room center.
          const marginX = w * MOTION.WALL_BIAS_MARGIN, marginY = h * MOTION.WALL_BIAS_MARGIN;
          if (c.x < marginX || c.x > w - SPRITE_W - marginX
              || c.y < marginY || c.y > h - SPRITE_H - marginY) {
            const toCenter = Math.atan2(h / 2 - c.y, w / 2 - c.x);
            c.heading = turnToward(c.heading, toCenter,
              MOTION.TURN_RATE_SLOW * MOTION.WALL_BIAS_TURN_FRAC * (frameDelta / 1000));
          }

          // Obstacle look-ahead: steer away through the turn cap (smooth
          // swerve); if the very next frame would collide, snap (emergency).
          const lx = c.x + c.vx * dt * 3, ly = c.y + c.vy * dt * 3;
          if (wouldHitObstacle(lx, ly, c.vx, c.vy, obstacles).hit) {
            const away = c.heading + Math.PI * (0.5 + Math.random() * 0.5)
                       * (Math.random() > 0.5 ? 1 : -1);
            if (wouldHitObstacle(c.x + c.vx * dt, c.y + c.vy * dt, c.vx, c.vy, obstacles).hit) {
              c.heading = away; // emergency: about to embed, snap now
            } else {
              c.heading = turnToward(c.heading, away, turnRate(c) * (frameDelta / 1000) * MOTION.SWERVE_TURN_MULT);
            }
          }

          stepsAcc += applyMotion(c, dt, frameDelta);
          setFacingFromVX(c, frameDelta);
          c.state = 'walking';
        }
      }

      // ---- ALWAYS: separate from other characters, resolve obstacles,
      // clamp — runs for EVERY character regardless of state, so idle,
      // activity-holding, and just-arrived characters can't stay stacked
      // on top of each other (previously this only ran during wander).
      if (!c.isChatting) {
        for (const o of state.chars) {
          if (o.id === c.id || o.isChatting) continue;
          // A mutually committed pair must be allowed through personal-space
          // repulsion. Otherwise REPULSION keeps them farther apart than the
          // PROXIMITY threshold that starts their conversation.
          if (c.approachPartner === o.id && o.approachPartner === c.id) continue;
          const rd = dist(c, o);
          if (rd < REPULSION) {
            const ov = REPULSION - rd;
            let rdx = c.x - o.x, rdy = c.y - o.y;
            if (rd < 0.01) {
              // Exact overlap: dist() gives no direction, so pick one.
              const a = Math.random() * Math.PI * 2;
              rdx = Math.cos(a); rdy = Math.sin(a);
            } else {
              rdx /= rd; rdy /= rd;
            }
            c.x += rdx * ov * 0.05 * dt;
            c.y += rdy * ov * 0.05 * dt;
          }
        }
      }
      // Passerby glance: when two free characters pass close by, one may
      // briefly look at the other without changing course.
      if (!c.isChatting && !state.activeScene && c.approachPartner === null
          && !c.activity && c.pauseTimer <= 0) {
        for (const o of state.chars) {
          if (o.id === c.id || o.isChatting || o.approachPartner !== null) continue;
          if (o.type === 'ghost' && !o.ghostVisible) continue;
          if (dist(c, o) > SPRITE_W * MOTION.GLANCE_RANGE_FRAC) continue;
          const key = [c.id, o.id].sort().join('-');
          const last = state.glanceCooldowns.get(key) || 0;
          if (performance.now() - last < MOTION.GLANCE_COOLDOWN_MS) continue;
          state.glanceCooldowns.set(key, performance.now());
          if (Math.random() < MOTION.GLANCE_PROB) {
            c.glanceTimer = rand(MOTION.GLANCE_DUR_MS[0], MOTION.GLANCE_DUR_MS[1]);
            c.glanceFacing = o.x >= c.x ? 'right' : 'left';
            MOTION_COUNTERS.glances++;
          }
        }
      }
      // While a glance is active it overrides walk facing (path unchanged).
      if (c.glanceTimer > 0) {
        c.glanceTimer -= frameDelta;
        c.facing = c.glanceFacing;
      }
      resolveObstacles(c, obstacles);
      clampToRoom(c, w, h);
      // Escape hatch: if pushback can't free a character pinned in a pocket
      // (deep overlap, or squeezed between obstacle and wall), relocate to
      // the nearest clear spot after ~1 s instead of leaving a statue.
      // Checked AFTER the wall clamp: in the obstacle-vs-wall pocket the
      // pushback frees the character into the wall band and the clamp shoves
      // it straight back into the obstacle — only the final resting position
      // reveals the pin.
      if (wouldHitObstacle(c.x, c.y, 0, 0, obstacles).hit) {
        c.escapeFrames = (c.escapeFrames || 0) + 1;
        if (c.escapeFrames > 60) {
          // Re-pinned shortly after an escape → the nearest clear spot is a
          // trap mouth; relocate somewhere genuinely open instead.
          const rePinned = performance.now() - (c.lastEscapeAt || 0) < 5000;
          const p = rePinned ? findSpawnPoint(state.chars.filter(o => o !== c))
                             : safeGatherPoint(c.x, c.y);
          const away = Math.atan2(p.y - c.y, p.x - c.x);
          c.x = p.x; c.y = p.y;
          c.escapeFrames = 0;
          c.lastEscapeAt = performance.now();
          cancelActivity(c);
          if (c.approachPartner !== null) abortSocialApproach(c);
          clearTarget(c);
          // Point every motion intent away from the pocket so wander
          // doesn't immediately walk back in.
          c.heading = away;
          c.targetSpeed = effectiveSpeed(c);
          c.curSpeed = c.targetSpeed * MOTION.ESCAPE_PUSH_FRAC;
          c.dirTimer = 1500;
        }
      } else {
        c.escapeFrames = 0;
      }
    }

    if (stepsAcc > 0) {
      state.stepsAcc += stepsAcc;
      setStat('steps', Math.floor(state.stepsAcc / 100));
    }

    // Ghost visibility cycling — appears and disappears at random intervals.
    for (const c of state.chars) {
      if (c.type !== 'ghost') continue;
      c.ghostTimer -= frameDelta;
      if (c.ghostTimer <= 0) {
        c.ghostVisible = !c.ghostVisible;
        c.ghostTimer = c.ghostVisible
          ? (8000  + Math.random() * 12000) * state.phaseMult.ghostVis
          : (10000 + Math.random() * 20000) * state.phaseMult.ghostHid;
        if (c.el) c.el.classList.toggle('ghost-hidden', !c.ghostVisible);
        if (!c.ghostVisible) {
          // End any active interaction when the ghost vanishes.
          c.isChatting = false;
          if (c.approachPartner !== null) abortSocialApproach(c);
          cancelActivity(c);
          if (c.bubbleEl) { c.bubbleEl.remove(); c.bubbleEl = null; }
          if (c.state === 'chatting') c.state = 'walking';
        }
      }
    }

    // Conversations are intentionally sparse. Characters first wander on
    // their own, then one ready pair may approach and talk. A per-character
    // cooldown and a single-pair gate prevent the whole office forming one
    // permanent conversation knot.
    const chatProb = state.activeScene ? 0 : (state.chatFreq / 100) * state.phaseMult.chat;
    const chars = state.chars;
    let socialBusy = chars.some(c => c.isChatting || c.approachPartner !== null);

    if (!state.activeScene && !socialBusy && state.socialPauseTimer <= 0 && chatProb > 0) {
      const ready = chars
        .filter(c => c.socialTimer <= 0
          && !c.activity
          && !(c.type === 'ghost' && !c.ghostVisible))
        .sort((a, b) => a.socialTimer - b.socialTimer);
      const initiator = ready[0];
      if (initiator) {
        const partners = ready
          .filter(c => c !== initiator
            && dist(initiator, c) < ATTRACT_RANGE
            && !state.convPairs.has([initiator.id, c.id].sort().join('-')))
          .sort((a, b) => dist(initiator, a) - dist(initiator, b));
        const partner = partners[0];
        if (partner) {
          initiator.approachPartner = partner.id;
          partner.approachPartner = initiator.id;
          cancelActivity(initiator);
          cancelActivity(partner);
          initiator.targetX = null;
          initiator.targetY = null;
          partner.targetX = null;
          partner.targetY = null;
          initiator.idleTimer = 0;
          partner.idleTimer = 0;
          initiator.state = 'walking';
          partner.state = 'walking';
          socialBusy = true;
        }
      }
    }

    conversationScan:
    for (let i = 0; i < chars.length; i++) {
      for (let j = i + 1; j < chars.length; j++) {
        const a = chars[i], b = chars[j];
        if (a.isChatting || b.isChatting) continue;
        // Invisible ghost cannot chat or approach.
        if (a.type === 'ghost' && !a.ghostVisible) continue;
        if (b.type === 'ghost' && !b.ghostVisible) continue;
        const pairKey = [a.id, b.id].sort().join('-');
        if (state.convPairs.has(pairKey)) continue;

        const d = dist(a, b);
        const partnered = a.approachPartner === b.id && b.approachPartner === a.id;

        if (d < PROXIMITY) {
          // Only a mutually committed pair talks. Incidental passers-by keep
          // walking until their independent social timers choose a meeting.
          if (partnered) {
            a.approachPartner = null; b.approachPartner = null;
            a.departTimer = 0; b.departTimer = 0;
            cancelActivity(a); cancelActivity(b);
            state.convPairs.add(pairKey);
            a.isChatting = true; b.isChatting = true;
            a.chatPartner = b.name; b.chatPartner = a.name;
            a.state = 'chatting'; b.state = 'chatting';
            // Stop them in place and face each other.
            a.vx = 0; a.vy = 0; clearTarget(a);
            b.vx = 0; b.vy = 0; clearTarget(b);

            // PROXIMITY measures box-corner distance, so two characters can
            // trigger a chat while standing almost exactly on top of each
            // other. Nudge them to a visible talking distance apart.
            const CHAT_GAP = Math.max(70, REPULSION * 0.9);
            if (d < CHAT_GAP) {
              let sepX = a.x - b.x, sepY = a.y - b.y;
              if (d < 0.01) {
                const ang = Math.random() * Math.PI * 2;
                sepX = Math.cos(ang); sepY = Math.sin(ang);
              } else {
                sepX /= d; sepY /= d;
              }
              const push = (CHAT_GAP - d) / 2;
              a.x += sepX * push; a.y += sepY * push;
              b.x -= sepX * push; b.y -= sepY * push;
            }

            a.facing = a.x <= b.x ? 'right' : 'left';
            b.facing = b.x <= a.x ? 'right' : 'left';

            // Three spoken turns with an explicit listener; the listener nods
            // (CSS reacts to data-social="listening").
            const speak = (speaker, listener) => {
              if (!speaker.isChatting) return;
              sayFresh(speaker, DIALOGUE_BANKS);
              speaker.listeningTo = null;
              listener.listeningTo = speaker.name;
              MOTION_COUNTERS.convTurns++;
            };
            speak(a, b);
            trackedTimeout(() => speak(b, a), 2600);
            trackedTimeout(() => speak(a, b), 5200);

            // Parting: a random member leaves first; the other watches them
            // go for a beat, then departs too.
            trackedTimeout(() => {
              const [leaver, stayer] = Math.random() < 0.5 ? [a, b] : [b, a];
              pointAwayFrom(leaver, stayer.x, stayer.y);
              stayer.facing = leaver.x >= stayer.x ? 'right' : 'left';
              trackedTimeout(() => {
                pointAwayFrom(stayer, leaver.x, leaver.y);
              }, rand(MOTION.PART_GAZE_MS[0], MOTION.PART_GAZE_MS[1]));
              state.socialPauseTimer = rand(
                BETWEEN_CONVERSATIONS[0],
                BETWEEN_CONVERSATIONS[1]
              );
            }, 7800);
            trackedTimeout(() => {
              state.convPairs.delete(pairKey);
            }, 7800 + CHAT_COOLDOWN_MS);

            bumpStat('conversations');
            socialBusy = true;
            break conversationScan;
          }
        }
      }
    }

    // Smooth motion: write positions every frame — trivially cheap for four
    // characters. The heavier DOM sync below (sprite swaps, classes, dataset)
    // stays at ~10Hz, where its cost matters and its jitter doesn't show.
    for (const c of state.chars) {
      if (c.el) c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
      if (c.bubbleEl) positionBubble(c);
    }
  }

  // Sync the rest of the DOM at ~10Hz using a frame-rate-independent accumulator.
  state.domSyncAcc += frameDelta;
  if (state.domSyncAcc >= DOM_SYNC_INTERVAL_MS) {
    state.domSyncAcc = 0;
    for (const c of state.chars) updateCharDOM(c);
  }

  requestAnimationFrame(gameLoop);
}

// ---- Event Handlers ----

// ---- Tap the glass ----
const TAP_RADIUS = 220;

function tapGlass(e) {
  if (e.target.closest('[data-id]')) return;
  closeObsCard();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;

  const ripple = document.createElement('div');
  ripple.className = 'glass-ripple';
  ripple.style.left = x + 'px';
  ripple.style.top = y + 'px';
  canvas.appendChild(ripple);
  // Raw timer: UI-chrome cleanup must survive clearPendingTimers() (see the
  // timer rule at the top of events.js), or a scene starting within 900ms
  // would orphan the ripple element in the DOM.
  setTimeout(() => ripple.remove(), 900);

  for (const c of state.chars) {
    if (c.isChatting || state.activeScene) continue;
    if (c.type === 'ghost' && !c.ghostVisible) continue;
    const cx = c.x + SPRITE_W / 2, cy = c.y + SPRITE_H / 2;
    if (Math.hypot(cx - x, cy - y) > TAP_RADIUS) continue;
    // Glance at the tap.
    c.facing = x >= cx ? 'right' : 'left';
    if (c.activity) continue; // busy characters just look up
    c.idleTimer = 600 + Math.random() * 800;
    c.state = 'idle';
    c.vx = 0; c.vy = 0;
    if (Math.random() < 0.3) {
      // Curious: wander toward the tap (normal wander, not a command).
      c.heading = Math.atan2(y - cy, x - cx);
      c.targetSpeed = effectiveSpeed(c);
      c.dirTimer = 2000;
      c.idleTimer = 0;
      c.state = 'walking';
    }
  }
}

// ---- Observation card ----
let obsCardEl = null, obsCardTimer = 0;

function describeChar(c) {
  if (c.type === 'ghost') return 'uhu';
  if (c.isChatting && c.chatPartner) return 'chatting with ' + c.chatPartner;
  if (c.activity) return ACTIVITIES[c.activity.key].label;
  if (c.state === 'idle') return 'standing around';
  return 'wandering';
}

function moodOf(c) {
  if (c.type === 'ghost') return 'uhu';
  if (c.moodWord && Date.now() < c.moodUntil) return c.moodWord;
  const words = MOOD_WORDS[c.type];
  // Stable-ish default: rotates slowly with the clock so it isn't jittery.
  return words[Math.floor(Date.now() / (5 * 60 * 1000)) % words.length];
}

function closeObsCard() {
  if (obsCardEl) { obsCardEl.remove(); obsCardEl = null; }
  if (obsCardTimer) { clearTimeout(obsCardTimer); obsCardTimer = 0; }
  state.selectedId = null;
  state.chars.forEach(updateCharDOM);
}

function openObsCard(c) {
  closeObsCard();
  clearAllBubbles();
  state.selectedId = c.id;
  const card = document.createElement('div');
  card.className = 'obs-card';
  card.dataset.type = c.type;
  card.setAttribute('role', 'status'); // announce the card to screen readers
  const name = document.createElement('div');
  name.className = 'obs-name';
  name.textContent = c.name;
  const doing = document.createElement('div');
  doing.className = 'obs-doing';
  doing.textContent = describeChar(c);
  const mood = document.createElement('div');
  mood.className = 'obs-mood';
  mood.textContent = 'mood: ' + moodOf(c);
  card.append(name, doing, mood);
  canvas.appendChild(card);
  obsCardEl = card;
  const { w } = getCanvasSize();
  const left = clamp(c.x + SPRITE_W + 10, 8, w - card.offsetWidth - 8);
  card.style.left = left + 'px';
  card.style.top = Math.max(8, c.y) + 'px';
  obsCardTimer = setTimeout(closeObsCard, 8000);
  state.chars.forEach(updateCharDOM);
}

function onCharClick(id) {
  const c = state.chars.find(ch => ch.id === id);
  if (!c) return;
  if (state.selectedId === id) { closeObsCard(); return; }
  openObsCard(c);
}

// ---- Control Panel ----
$('btnPlay').addEventListener('click', () => {
  state.isPlaying = !state.isPlaying;
  $('playIcon').setAttribute('d', state.isPlaying ? 'M8 6v12M16 6v12' : 'm8 5 11 7-11 7V5Z');
  $('playText').textContent = state.isPlaying ? 'Pause' : 'Play';
  if (!state.isPlaying) {
    // Don't let queued chat callbacks pop bubbles on paused characters.
    clearPendingTimers();
    // Their removal timers just died with clearPendingTimers — without this,
    // any bubble on screen at pause time would linger forever after resume.
    clearAllBubbles();
    state.convPairs.clear();
    for (const c of state.chars) {
      releaseSocial(c);
      cancelActivity(c);
      // The scene that owned these targets/locks is dead too — clear them so
      // characters don't finish a ghost errand (or stand frozen on
      // SCENE_IDLE_LOCK for ~16 minutes) after resume.
      clearTarget(c);
      if (isSceneLocked(c)) c.idleTimer = 0;
    }
  }
});

$('speedSlider').addEventListener('input', (e) => {
  state.walkSpeed = parseFloat(e.target.value);
  $('speedValue').textContent = state.walkSpeed.toFixed(1) + 'x';
  refreshStepDurations();
});

const CHAT_LABELS = [
  [0, 'Silent'], [10, 'Rare'], [30, 'Low'],
  [50, 'Normal'], [70, 'Chatty'], [100, 'Non-stop'],
];
$('chatSlider').addEventListener('input', (e) => {
  state.chatFreq = parseInt(e.target.value);
  if (state.chatFreq > 0) {
    state.chars.forEach(c => {
      if (!Number.isFinite(c.socialTimer)) c.socialTimer = socialDelay(INITIAL_SOCIAL_DELAY);
    });
  }
  let label = CHAT_LABELS[0][1];
  for (const [thr, name] of CHAT_LABELS) {
    if (state.chatFreq >= thr) label = name;
  }
  $('chatValue').textContent = label;
});

$('btnReset').addEventListener('click', () => {
  clearPendingTimers();
  const placed = [];
  state.chars.forEach(c => {
    const p = findSpawnPoint(placed);
    c.x = p.x; c.y = p.y;
    placed.push(p);
    c.heading = Math.random() * Math.PI * 2;
    c.curSpeed = 0;
    c.targetSpeed = c.speed;
    c.dirTimer = rand(0, 1200);
    clearTarget(c);
    releaseSocial(c);
    cancelActivity(c);
    c.state = 'walking';
    c.idleTimer = 0;
    if (c.bubbleEl) { c.bubbleEl.remove(); c.bubbleEl = null; }
  });
  disperseCharacters(1, true);
  state.convPairs.clear();
  closeObsCard();
  state.stepsAcc = 0;
  state.stats = freshStats();
  state.recentLines = freshRecentLines();
  scheduleStatsRender();
  persistSoon(); // without this, a reload right after Reset restores the old stats
  state.chars.forEach(updateCharDOM);
});

const DRAWERS = {
  diary: { title: 'Office diary', section: 'drawerDiary', button: 'btnDiary' },
  edit: { title: 'Edit office', section: 'drawerEdit', button: 'btnEditOffice' },
  settings: { title: 'Settings', section: 'drawerSettings', button: 'btnSettings' },
};

function clearFurnitureSelection() {
  document.querySelectorAll('.furniture.is-selected').forEach(el => el.classList.remove('is-selected'));
}

function closeDrawer() {
  state.panelOpen = false;
  state.drawerView = null;
  state.editMode = false;
  $('controlPanel').classList.add('collapsed');
  document.body.classList.remove('edit-mode');
  clearFurnitureSelection();
  Object.values(DRAWERS).forEach(d => $(d.button).classList.remove('is-active'));
  $('btnSettings').setAttribute('aria-expanded', 'false');
}

function openDrawer(view) {
  if (state.panelOpen && state.drawerView === view) { closeDrawer(); return; }
  const def = DRAWERS[view];
  state.panelOpen = true;
  state.drawerView = view;
  state.editMode = view === 'edit';
  $('panelTitle').textContent = def.title;
  $('controlPanel').classList.remove('collapsed');
  Object.entries(DRAWERS).forEach(([key, item]) => {
    $(item.section).hidden = key !== view;
    $(item.button).classList.toggle('is-active', key === view);
  });
  document.body.classList.toggle('edit-mode', state.editMode);
  if (!state.editMode) clearFurnitureSelection();
  $('btnSettings').setAttribute('aria-expanded', String(view === 'settings'));
}

$('panelToggle').addEventListener('click', closeDrawer);
$('btnDiary').addEventListener('click', () => openDrawer('diary'));
$('btnEditOffice').addEventListener('click', () => openDrawer('edit'));
$('btnSettings').addEventListener('click', () => openDrawer('settings'));

// ---- Canvas click ----
canvas.addEventListener('click', (e) => {
  if (state.editMode) { clearFurnitureSelection(); return; }
  tapGlass(e);
});

// ---- Keyboard ----
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  closeObsCard();
  if (state.panelOpen) closeDrawer();
  if (modal.classList.contains('active')) closeModal();
});

// ---- Modal ----
const modal = $('howToPlayModal');
function openModal() { modal.classList.add('active'); }
function closeModal() {
  modal.classList.remove('active');
  lsSet('office-friends-seen-help', 'true');
  state.hasSeenHelp = true;
}
$('helpBtn').addEventListener('click', openModal);
$('modalClose').addEventListener('click', closeModal);
$('modalStart').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

if (!state.hasSeenHelp) {
  setTimeout(openModal, 800);
}

// ---- Floating Particles ----
function initParticles() {
  const container = $('particles');
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = 4 + Math.random() * 4;
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${size}px; height: ${size}px;
      animation-duration: ${15 + Math.random() * 10}s;
      animation-delay: ${Math.random() * 20}s;
    `;
    container.appendChild(p);
  }
}

// ---- Resize ----
// Observe the canvas rather than the window: collapsing the control panel
// also changes the canvas width, and obstacles/clamps must follow.
new ResizeObserver(() => {
  updateSpriteSize();
  rebuildObstacles();
  const { w, h } = getCanvasSize();
  state.chars.forEach(c => {
    clampToRoom(c, w, h);
    if (c.bubbleEl) positionBubble(c);
    updateCharDOM(c);
  });
}).observe(canvas);


// Furniture art keeps its authored perspective. Only horizontal mirroring is
// allowed; rotating an illustrated viewpoint by 90 degrees breaks the collage.
function applyFurnitureTransform(img, piece) {
  img.style.transform = piece.flipX ? 'scaleX(-1)' : '';
}

// Helper: create a small action button that appears on furniture hover.
// kind is 'delete' or 'flip' — it picks both the icon and the CSS class.
const FURNITURE_BTN_ICONS = {
  delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>',
  flip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M7 9l-3 3 3 3m10-6 3 3-3 3"/></svg>',
};
function furnitureBtn(kind, ariaLabel, onClick) {
  const btn = document.createElement('button');
  btn.className = `furniture-btn furniture-${kind}-btn`;
  btn.innerHTML = FURNITURE_BTN_ICONS[kind];
  btn.setAttribute('aria-label', ariaLabel);
  btn.addEventListener('pointerdown', e => e.stopPropagation());
  btn.addEventListener('click', e => { e.stopPropagation(); onClick(); });
  return btn;
}

// Wire drag-to-move, resize handle, and action buttons onto a furniture element.
function makeFurnitureDraggable(el, piece, img) {
  // ---- Action buttons (revealed on hover) ----
  el.appendChild(furnitureBtn('delete', 'Remove', () => {
    const idx = furniturePieces.indexOf(piece);
    if (idx !== -1) furniturePieces.splice(idx, 1);
    el.remove();
    rebuildObstacles();
  }));
  el.appendChild(furnitureBtn('flip', 'Flip horizontal', () => {
    piece.flipX = !piece.flipX;
    applyFurnitureTransform(img, piece);
  }));

  // Resize handle — bottom-right corner
  const handle = document.createElement('div');
  handle.className = 'furniture-resize-handle';
  el.appendChild(handle);

  // Prevent furniture clicks from reaching the canvas click handler
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (!state.editMode) return;
    clearFurnitureSelection();
    el.classList.add('is-selected');
  });

  // ---- Drag to move ----
  let drag = null;
  el.addEventListener('pointerdown', e => {
    if (!state.editMode || e.target.closest('.furniture-btn, .furniture-resize-handle')) return;
    e.stopPropagation();
    clearFurnitureSelection();
    el.classList.add('is-selected');
    const { w, h } = getCanvasSize();
    drag = { startPx: e.clientX, startPy: e.clientY,
             startRx: piece.rx,  startRy: piece.ry, w, h };
    el.setPointerCapture(e.pointerId);
    el.classList.add('furniture-dragging');
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const { w, h } = getCanvasSize();
    piece.rx = clamp(drag.startRx + (e.clientX - drag.startPx) / drag.w, 0, 1 - piece.pw / w);
    piece.ry = clamp(drag.startRy + (e.clientY - drag.startPy) / drag.h, 0, 1 - piece.ph / h);
    el.style.left = piece.rx * 100 + '%';
    el.style.top  = piece.ry * 100 + '%';
    rebuildObstacles();
  });
  el.addEventListener('pointerup', () => { drag = null; el.classList.remove('furniture-dragging'); });

  // ---- Uniform resize ----
  let resize = null;
  handle.addEventListener('pointerdown', e => {
    e.stopPropagation();
    resize = { startPx: e.clientX, startPy: e.clientY, startSize: piece.pw };
    handle.setPointerCapture(e.pointerId);
    el.classList.add('furniture-resizing');
  });
  handle.addEventListener('pointermove', e => {
    if (!resize) return;
    const def = piece.def;
    const delta = ((e.clientX - resize.startPx) + (e.clientY - resize.startPy)) / 2;
    const minSize = Math.round((def.minScale || 0.3) * SPRITE_H);
    const maxSize = Math.round((def.maxScale || 1.4) * SPRITE_H);
    const size = clamp(resize.startSize + delta, minSize, maxSize);
    piece.pw = size;
    piece.ph = size;
    piece.scale = size / SPRITE_H;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.dataset.scale = piece.scale.toFixed(3);
    rebuildObstacles();
  });
  handle.addEventListener('pointerup', () => { resize = null; el.classList.remove('furniture-resizing'); });
}

// Place a single furniture piece on the canvas (called when user clicks a
// palette item). Tries centre first, then random spots until it finds a
// clear area. The user can drag it to the exact position afterwards.
function placeFurniturePiece(def, atRx, atRy) {
  const { w, h } = getCanvasSize();
  const size = Math.round(def.scale * SPRITE_H);
  const EDGE = 16, GAP = 20;
  let px, py;

  if (atRx !== undefined && atRy !== undefined) {
    // Explicit position (default office layout) — no search needed.
    px = atRx * w;
    py = atRy * h;
  } else {
    px = w / 2 - size / 2;
    py = h / 2 - size / 2;
    outer: for (let attempt = 0; attempt < 80; attempt++) {
      const tx = attempt === 0 ? px : rand(EDGE, w - size - EDGE);
      const ty = attempt === 0 ? py : rand(EDGE, h - size - EDGE);
      for (const q of furniturePieces) {
        if (rectsOverlap(tx - GAP, ty - GAP, size + GAP * 2, size + GAP * 2,
                         q.rx * w, q.ry * h, q.pw, q.ph)) continue outer;
      }
      px = tx; py = ty; break;
    }
  }
  px = clamp(px, EDGE, w - size - EDGE);
  py = clamp(py, EDGE, h - size - EDGE);

  const rx = px / w, ry = py / h;
  const piece = {
    type: def.type,
    rx,
    ry,
    pw: size,
    ph: size,
    scale: def.scale,
    tilt: def.tilt || 0,
    flipX: def.flip,
    def,
  };
  furniturePieces.push(piece);

  const el = document.createElement('div');
  el.className = 'furniture';
  el.dataset.furniture = def.type;
  el.dataset.paperCutout = 'true';
  el.dataset.scale = def.scale.toFixed(3);
  el.dataset.collageTilt = piece.tilt.toFixed(1);
  el.style.cssText = `left:${rx*100}%;top:${ry*100}%;width:${size}px;height:${size}px;--collage-tilt:${piece.tilt}deg;`;
  const img = document.createElement('img');
  img.src = def.src;
  img.alt = '';
  img.draggable = false;
  el.appendChild(img);
  applyFurnitureTransform(img, piece);
  piece.el = el;
  makeFurnitureDraggable(el, piece, img);
  furnitureLayer.appendChild(el);
  rebuildObstacles();
}

// Populate the right-panel furniture palette from FURNITURE_PALETTE.
function initFurniturePalette() {
  const container = $('furniturePalette');
  for (const def of FURNITURE_PALETTE) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'palette-item';
    item.title = `Add ${def.label}`;
    const img = document.createElement('img');
    img.src = def.src;
    img.alt = def.label;
    img.draggable = false;
    const label = document.createElement('span');
    label.textContent = def.label;
    item.appendChild(img);
    item.appendChild(label);
    item.addEventListener('click', () => placeFurniturePiece(def));
    container.appendChild(item);
  }
}

// Starter layout so the aquarium has scenery + activity targets on first load.
// Users can still move/remove everything. Skipped if furniture already exists.
function initDefaultOffice() {
  if (furniturePieces.length) return;
  const byType = t => FURNITURE_PALETTE.find(d => d.type === t);
  const desktopLayout = [
    ['desk_cluster',   0.07, 0.08],
    ['printer',        0.31, 0.08],
    ['filing_cabinet', 0.04, 0.33],
    ['coffee_station', 0.61, 0.08],
    ['table_cafe',     0.78, 0.18],
    ['whiteboard',     0.05, 0.55],
    ['couch_2seater',  0.68, 0.56],
    ['armchair',       0.86, 0.57],
    ['lamp_arc_big',   0.61, 0.66],
    ['plant_snake',    0.92, 0.79],
  ];
  const mobileLayout = [
    ['desk_cluster',   0.04, 0.07],
    ['printer',        0.32, 0.18],
    ['filing_cabinet', 0.05, 0.33],
    ['coffee_station', 0.61, 0.07],
    ['table_cafe',     0.80, 0.21],
    ['whiteboard',     0.04, 0.59],
    ['couch_2seater',  0.58, 0.60],
    ['armchair',       0.72, 0.72],
    ['lamp_arc_big',   0.50, 0.82],
    ['plant_snake',    0.86, 0.83],
  ];
  // Same breakpoint source as updateSpriteSize — the canvas can be narrower
  // than the window (open panel), which must not flip the layout choice.
  const layout = window.innerWidth <= 768 ? mobileLayout : desktopLayout;
  for (const [type, rx, ry] of layout) placeFurniturePiece(byType(type), rx, ry);
}

// ---- Init ----
updateSpriteSize();      // must be first — SPRITE_W/H drive layout everywhere
rebuildObstacles();      // populate OBSTACLES with walls before character spawn
initParticles();
preloadMovementSprites();
initFurniturePalette();  // build the right-panel furniture picker
initDefaultOffice();     // starter furniture layout (before characters spawn)
initCharacters();
requestAnimationFrame(gameLoop);
