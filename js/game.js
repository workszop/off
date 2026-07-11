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
const PROXIMITY = 70;              // chat only when characters are genuinely close
const REPULSION = 45;
// Recomputed by updateSpriteSize() on load and on every resize.
// SPRITE_H targets 30% of the viewport height; SPRITE_W keeps the 1:2 ratio.
let SPRITE_W = 80;
let SPRITE_H = 160;
let ATTRACT_RANGE = SPRITE_H * 2; // within 2 character-heights → walk toward each other
const CHAT_COOLDOWN_MS = 10000;     // pair can't re-engage for this long after chat ends
const TARGET_STUCK_FRAMES = 90;
const SCENE_IDLE_LOCK = 999_999; // idleTimer value that keeps a character frozen until the scene clears it
// A locked idleTimer decays each frame, so "still locked" means "way larger
// than any organic idle could ever be", not an exact match.
function isSceneLocked(c) { return c.idleTimer > 100_000; }
const DOM_SYNC_INTERVAL_MS = 100;
const STATS_RENDER_DEBOUNCE_MS = 200;
const SPAWN_MARGIN = 40;           // safe distance from canvas edge for spawns

// ---- localStorage helpers (safe under private browsing / disabled storage) ----
function lsGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch (_) { /* no-op */ }
}

// ---- Game State ----
const state = {
  chars: [],
  selectedId: null,
  isPlaying: true,
  walkSpeed: 1.0,
  chatFreq: 50,
  stats: { conversations: 0, steps: 0, coffee: 0, meetings: 0, events: 0 },
  diary: [],
  dayCount: 1,
  stepsAcc: 0,
  convPairs: new Set(),
  pendingTimers: new Set(),
  lastTime: 0,
  rafId: 0,
  domSyncAcc: 0,
  statsDirty: false,
  statsRenderTimer: 0,
  panelOpen: true,
  hasSeenHelp: lsGet('office-friends-seen-help') === 'true',
  // True while a scripted scene (Coffee/Meeting) is gathering the characters
  // and running their conversation — suppresses autonomous chat triggers.
  activeScene: false,
  // Per-character set of recently-used line indices — prevents repeating the
  // same line until the recency window (≤ 1/3 of bank size) has cleared.
  recentLines: { andy: new Set(), jazz: new Set(), olex: new Set(), ghost: new Set() },
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
};
const statPills = document.querySelectorAll('#statsBar .stat-pill');

// ---- Sprite size (responsive) ----
function updateSpriteSize() {
  SPRITE_H = Math.round(window.innerHeight * 0.30);
  SPRITE_W = Math.round(SPRITE_H * 0.5);
  ATTRACT_RANGE = SPRITE_H * 2;
  const root = document.documentElement.style;
  root.setProperty('--sprite-h', SPRITE_H + 'px');
  root.setProperty('--sprite-w', SPRITE_W + 'px');
}

// ---- Helpers ----
function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

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

// Hard clamp inside the wall band — final safety net after obstacle pushback.
function clampToRoom(c, w, h) {
  const wallW = w * WALL_FRAC, wallH = h * WALL_FRAC;
  c.x = Math.max(wallW, Math.min(w - SPRITE_W - wallW, c.x));
  c.y = Math.max(wallH, Math.min(h - SPRITE_H - wallH, c.y));
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
  const cx = Math.max(SPAWN_MARGIN, Math.min(w - SPRITE_W - SPAWN_MARGIN, x));
  const cy = Math.max(SPAWN_MARGIN, Math.min(h - SPRITE_H - SPAWN_MARGIN, y));
  if (!wouldHitObstacle(cx, cy, 0, 0, OBSTACLES).hit) return { x: cx, y: cy };
  for (let r = 20; r <= 160; r += 20) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const nx = Math.max(SPAWN_MARGIN, Math.min(w - SPRITE_W - SPAWN_MARGIN, cx + Math.cos(a) * r));
      const ny = Math.max(SPAWN_MARGIN, Math.min(h - SPRITE_H - SPAWN_MARGIN, cy + Math.sin(a) * r));
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
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    // Desired velocity — autonomous walk lerps toward this, preventing instant
    // direction flips. dirTimer gates how often the direction can change.
    targetVx: (Math.random() - 0.5) * 2,
    targetVy: (Math.random() - 0.5) * 2,
    dirTimer: rand(0, 1500),
    speed: BASE_SPEED * speedMod,
    speedMod,
    state: 'walking',
    facing: Math.random() > 0.5 ? 'right' : 'left',
    targetX: null, targetY: null,
    targetStuckFrames: 0,
    escapeFrames: 0,
    lastEscapeAt: 0,
    idleTimer: 0,
    isChatting: false,
    approachPartner: null,
    activity: null, moodWord: null, moodUntil: 0,
    // Ghost-only: visibility cycling. ghostVisible starts false so the ghost
    // materialises a few seconds after page load rather than at the start.
    ghostVisible: false,
    ghostTimer: 3000 + Math.random() * 7000,
    el: null, innerEl: null, imgEl: null, bubbleEl: null,
    lastSpriteSrc: '',
    lastSpriteTransform: '',
    lastInnerClass: '',
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
  state.chars.forEach(c => {
    renderCharacter(c);
    if (c.type === 'ghost') c.el.classList.add('ghost-hidden');
  });
}

// Step cadence: faster walk = faster steps. 0.8s at 1.0 effective speed.
function stepDur(c) {
  const eff = c.speedMod * state.walkSpeed * state.phaseMult.speed;
  return (0.8 / Math.max(0.3, eff)).toFixed(3) + 's';
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

  const initialSprite = SPRITE_MAP[c.type][c.facing === 'right' ? 'right' : 'left'];
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
  const innerCls = walking ? 'character-inner walking' : 'character-inner';
  const sprite = walking ? SPRITE_MAP[c.type][c.facing] : SPRITE_MAP[c.type].idle;

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

  // is-walking drives the CSS waist-up crop: full body when moving,
  // portrait crop when idle / chatting.
  c.el.classList.toggle('is-walking', isMoving);

  c.el.classList.toggle('selected', state.selectedId === c.id);
}

function showBubble(c, text, duration = 4000) {
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
  const { w } = getCanvasSize();
  const bw = c.bubbleEl.offsetWidth || 220;
  const bh = c.bubbleEl.offsetHeight || 70;
  const centerX = c.x + SPRITE_W / 2;
  let left = centerX - bw / 2;
  // Clamp horizontally so the bubble can't clip off the canvas edge.
  left = Math.max(8, Math.min(w - bw - 8, left));
  // The 2:3 sprite images letterbox inside the 1:2 character box under
  // object-fit:contain, so the drawn content (the head) starts 12.5% down
  // from the box top. Place the bubble so its triangle tip (8px below the
  // bubble's bottom edge) lands just above that, with a 4px clearance gap.
  let top = c.y + SPRITE_H * 0.125 - bh - 8 - 4;
  // Don't let the bubble disappear above the canvas.
  top = Math.max(8, top);
  c.bubbleEl.style.left = left + 'px';
  c.bubbleEl.style.top = top + 'px';
  // Keep the pointer triangle aimed at the character's head.
  const pointerLeft = Math.max(12, Math.min(bw - 12, centerX - left));
  c.bubbleEl.style.setProperty('--pointer-x', pointerLeft + 'px');
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
    for (const [key, el] of Object.entries(statEls)) el.textContent = state.stats[key];
    statPills.forEach(p => {
      p.classList.remove('pulse');
      void p.offsetWidth; // restart the pulse animation
      p.classList.add('pulse');
    });
  }, STATS_RENDER_DEBOUNCE_MS);
}

// ---- Game Loop ----

// Advance c one frame toward (tx, ty). d is the current distance to the
// target (precomputed by the caller, must be > 0). Returns the distance
// walked this frame (for the step counter) plus stuck=true once the
// character has made no progress for TARGET_STUCK_FRAMES straight frames —
// the caller decides how to bail out (there is no pathfinding).
function moveToward(c, tx, ty, d, dt, obstacles) {
  const spd = effectiveSpeed(c);
  c.vx = ((tx - c.x) / d) * spd;
  c.vy = ((ty - c.y) / d) * spd;
  const prevX = c.x, prevY = c.y;
  c.x += c.vx * dt; c.y += c.vy * dt;
  const stepped = Math.abs(c.vx * dt) + Math.abs(c.vy * dt);
  c.facing = c.vx > 0 ? 'right' : 'left';
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

    for (const c of state.chars) {
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
                     || (partner.type === 'ghost' && !partner.ghostVisible)
                     || (c.type === 'ghost' && !c.ghostVisible);
        if (blocked) {
          c.approachPartner = null;
          c.vx = 0; c.vy = 0;
          c.state = 'walking';
        } else {
          const ad = dist(c, partner);
          if (ad < PROXIMITY) {
            c.vx = 0; c.vy = 0;
            c.state = 'idle';
          } else {
            const r = moveToward(c, partner.x, partner.y, ad, dt, obstacles);
            stepsAcc += r.stepped;
            if (r.stuck) {
              // Give up on the partner: hop a small random step out of the
              // blocked spot and go back to wandering.
              c.approachPartner = null;
              c.targetStuckFrames = 0;
              const esc = Math.random() * Math.PI * 2;
              c.x += Math.cos(esc) * 20;
              c.y += Math.sin(esc) * 20;
              c.vx = 0; c.vy = 0;
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
          c.targetX = null; c.targetY = null;
          c.targetStuckFrames = 0;
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
          const r = moveToward(c, c.targetX, c.targetY, td, dt, obstacles);
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
        // ---- autonomous walk — always moving, smooth direction changes ----
        const spd = effectiveSpeed(c);

        // Count down direction-change timer so turns can't happen every frame.
        c.dirTimer = Math.max(0, c.dirTimer - frameDelta);

        // Ambient activity roll: when a turn decision comes due, sometimes
        // head to a furniture spot instead of wandering (events.js).
        if (c.dirTimer <= 0 && Math.random() < 0.012 * dt * 0.4 * state.phaseMult.events) {
          if (maybeStartActivity(c)) continue;
        }

        // Random direction change (gated by timer).
        if (c.dirTimer <= 0 && Math.random() < 0.012 * dt) {
          const a = Math.random() * Math.PI * 2;
          c.targetVx = Math.cos(a) * spd;
          c.targetVy = Math.sin(a) * spd;
          c.dirTimer = 1200 + Math.random() * 2000; // 1.2–3.2 s before next turn
        }

        // Gentle centre drift so characters don't pile into corners.
        if (Math.random() < 0.003 * dt) {
          const a = Math.atan2(h / 2 - c.y, w / 2 - c.x) + (Math.random() - 0.5) * 1.2;
          c.targetVx = Math.cos(a) * spd;
          c.targetVy = Math.sin(a) * spd;
          c.dirTimer = Math.max(c.dirTimer, 400);
        }

        // Look-ahead: deflect early when heading into an obstacle (3-frame horizon).
        const lx = c.x + c.vx * dt * 3, ly = c.y + c.vy * dt * 3;
        if (wouldHitObstacle(lx, ly, c.vx, c.vy, obstacles).hit) {
          const a = Math.atan2(c.vy, c.vx);
          const d = Math.PI * (0.5 + Math.random() * 0.5) * (Math.random() > 0.5 ? 1 : -1);
          c.targetVx = Math.cos(a + d) * spd;
          c.targetVy = Math.sin(a + d) * spd;
          c.dirTimer = 200;
        }

        // Smoothly lerp current velocity toward target (prevents instant flipping).
        const lerp = Math.min(1, 0.07 * dt);
        c.vx += (c.targetVx - c.vx) * lerp;
        c.vy += (c.targetVy - c.vy) * lerp;

        // Guarantee minimum speed so characters never drift to a stop.
        if (Math.hypot(c.vx, c.vy) < spd * 0.25) {
          const a = Math.atan2(c.vy, c.vx) || Math.random() * Math.PI * 2;
          c.vx = Math.cos(a) * spd * 0.5;
          c.vy = Math.sin(a) * spd * 0.5;
          c.targetVx = c.vx; c.targetVy = c.vy;
        }

        c.x += c.vx * dt; c.y += c.vy * dt;
        stepsAcc += Math.abs(c.vx * dt) + Math.abs(c.vy * dt);
        if (Math.abs(c.vx) > 0.1) c.facing = c.vx > 0 ? 'right' : 'left';
        c.state = 'walking';
      }

      // ---- ALWAYS: separate from other characters, resolve obstacles,
      // clamp — runs for EVERY character regardless of state, so idle,
      // activity-holding, and just-arrived characters can't stay stacked
      // on top of each other (previously this only ran during wander).
      if (!c.isChatting) {
        for (const o of state.chars) {
          if (o.id === c.id || o.isChatting) continue;
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
          c.approachPartner = null;
          c.targetX = null; c.targetY = null; c.targetStuckFrames = 0;
          // Point every motion intent away from the pocket so wander
          // doesn't immediately walk back in.
          const spd = effectiveSpeed(c);
          c.vx = Math.cos(away) * spd; c.vy = Math.sin(away) * spd;
          c.targetVx = c.vx; c.targetVy = c.vy;
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
          c.approachPartner = null;
          cancelActivity(c);
          if (c.bubbleEl) { c.bubbleEl.remove(); c.bubbleEl = null; }
          if (c.state === 'chatting') c.state = 'walking';
        }
      }
    }

    // Conversations — suppressed while a scripted scene is running so the
    // gather-and-talk dialogue isn't drowned in random chatter.
    const chatProb = state.activeScene ? 0 : (state.chatFreq / 100) * state.phaseMult.chat;
    const chars = state.chars;
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
          // Within talking distance. Deterministic if they just walked here
          // on purpose; otherwise still gated by the chat-frequency slider
          // so two random passers-by don't always strike up a conversation.
          if (partnered || Math.random() < chatProb * 0.02 * dt) {
            a.approachPartner = null; b.approachPartner = null;
            cancelActivity(a); cancelActivity(b);
            state.convPairs.add(pairKey);
            a.isChatting = true; b.isChatting = true;
            a.chatPartner = b.name; b.chatPartner = a.name;
            a.state = 'chatting'; b.state = 'chatting';
            // Stop them in place and face each other.
            a.vx = 0; a.vy = 0; a.targetX = null; a.targetY = null;
            b.vx = 0; b.vy = 0; b.targetX = null; b.targetY = null;

            // PROXIMITY measures box-corner distance, so two characters can
            // trigger a chat while standing almost exactly on top of each
            // other. Nudge them to a visible talking distance apart.
            const CHAT_GAP = 55;
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

            showBubble(a, pickFresh(DIALOGUE_BANKS[a.type], state.recentLines[a.type]), 2800);

            trackedTimeout(() => {
              if (!b.isChatting) return;
              showBubble(b, pickFresh(DIALOGUE_BANKS[b.type], state.recentLines[b.type]), 2800);
            }, 3000);

            // Release chat lock at 6s so they can move again, but keep the
            // pair in convPairs until CHAT_COOLDOWN_MS so they don't immediately
            // glue back together — they get a chance to wander off first.
            trackedTimeout(() => {
              a.isChatting = false; b.isChatting = false;
              a.chatPartner = null; b.chatPartner = null;
              if (a.state === 'chatting') a.state = 'walking';
              if (b.state === 'chatting') b.state = 'walking';
            }, 6000);
            trackedTimeout(() => {
              state.convPairs.delete(pairKey);
            }, CHAT_COOLDOWN_MS);

            bumpStat('conversations');
          }
        } else if (d < ATTRACT_RANGE && !a.approachPartner && !b.approachPartner) {
          // Within 2 character-heights → roll for approach. Once committed,
          // both characters walk toward each other until d < PROXIMITY and
          // the close-range branch above fires deterministically.
          if (Math.random() < chatProb * 0.02 * dt) {
            a.approachPartner = b.id;
            b.approachPartner = a.id;
            cancelActivity(a); cancelActivity(b);
            a.targetX = null; a.targetY = null;
            b.targetX = null; b.targetY = null;
            a.state = 'walking'; b.state = 'walking';
            a.idleTimer = 0; b.idleTimer = 0;
          }
        }
      }
    }
  }

  // Sync DOM at ~10Hz using a frame-rate-independent accumulator.
  state.domSyncAcc += frameDelta;
  if (state.domSyncAcc >= DOM_SYNC_INTERVAL_MS) {
    state.domSyncAcc = 0;
    for (const c of state.chars) {
      updateCharDOM(c);
      if (c.bubbleEl) positionBubble(c);
    }
  }

  state.rafId = requestAnimationFrame(gameLoop);
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
  trackedTimeout(() => ripple.remove(), 900);

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
      const a = Math.atan2(y - cy, x - cx);
      const spd = effectiveSpeed(c);
      c.targetVx = Math.cos(a) * spd;
      c.targetVy = Math.sin(a) * spd;
      c.dirTimer = 2000;
      c.idleTimer = 0;
      c.state = 'walking';
    }
  }
}

// ---- Observation card ----
let obsCardEl = null, obsCardTimer = 0, obsCardCharId = null;

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
  obsCardCharId = null;
  state.chars.forEach(updateCharDOM);
}

function openObsCard(c) {
  closeObsCard();
  state.selectedId = c.id;
  obsCardCharId = c.id;
  const card = document.createElement('div');
  card.className = 'obs-card';
  card.dataset.type = c.type;
  card.innerHTML = '';
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
  const left = Math.max(8, Math.min(w - card.offsetWidth - 8, c.x + SPRITE_W + 10));
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
  $('playIcon').textContent = state.isPlaying ? '⏸' : '▶';
  $('playText').textContent = state.isPlaying ? 'Pause' : 'Play';
  if (!state.isPlaying) {
    // Don't let queued chat callbacks pop bubbles on paused characters.
    clearPendingTimers();
    state.convPairs.clear();
    for (const c of state.chars) {
      c.isChatting = false;
      c.approachPartner = null;
      cancelActivity(c);
      if (c.state === 'chatting') c.state = 'idle';
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
    const ra = Math.random() * Math.PI * 2;
    c.vx = Math.cos(ra) * c.speed; c.vy = Math.sin(ra) * c.speed;
    c.targetVx = c.vx; c.targetVy = c.vy;
    c.dirTimer = rand(0, 1200);
    c.targetX = null; c.targetY = null;
    c.targetStuckFrames = 0;
    c.state = 'walking'; c.isChatting = false;
    c.approachPartner = null;
    cancelActivity(c);
    c.idleTimer = 0;
    if (c.bubbleEl) { c.bubbleEl.remove(); c.bubbleEl = null; }
  });
  state.convPairs.clear();
  closeObsCard();
  state.stepsAcc = 0;
  state.stats = { conversations: 0, steps: 0, coffee: 0, meetings: 0, events: 0 };
  state.recentLines = { andy: new Set(), jazz: new Set(), olex: new Set(), ghost: new Set() };
  scheduleStatsRender();
  persistSoon(); // without this, a reload right after Reset restores the old stats
  state.chars.forEach(updateCharDOM);
});

$('panelToggle').addEventListener('click', () => {
  state.panelOpen = !state.panelOpen;
  $('controlPanel').classList.toggle('collapsed', !state.panelOpen);
});

$('btnSettings').addEventListener('click', () => {
  const pop = $('settingsPop');
  pop.hidden = !pop.hidden;
  $('btnSettings').setAttribute('aria-expanded', String(!pop.hidden));
});

// ---- Canvas click ----
canvas.addEventListener('click', tapGlass);

// ---- Keyboard ----
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  closeObsCard();
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


// Apply the current rotation + flip state to a furniture image element.
function applyFurnitureTransform(img, piece) {
  const flip = piece.flipX ? 'scaleX(-1)' : '';
  img.style.transform = piece.rotation
    ? `rotate(${piece.rotation}deg)${flip ? ' ' + flip : ''}`
    : flip;
}

// Helper: create a small action button that appears on furniture hover.
function furnitureBtn(label, ariaLabel, onClick) {
  const btn = document.createElement('button');
  btn.className = `furniture-btn ${label === '×' ? 'furniture-delete-btn'
                                 : label === '↻' ? 'furniture-rotate-btn'
                                                 : 'furniture-flip-btn'}`;
  btn.textContent = label;
  btn.setAttribute('aria-label', ariaLabel);
  btn.addEventListener('pointerdown', e => e.stopPropagation());
  btn.addEventListener('click', e => { e.stopPropagation(); onClick(); });
  return btn;
}

// Wire drag-to-move, resize handle, and action buttons onto a furniture element.
function makeFurnitureDraggable(el, piece, img) {
  // ---- Action buttons (revealed on hover) ----
  el.appendChild(furnitureBtn('×', 'Remove', () => {
    const idx = furniturePieces.indexOf(piece);
    if (idx !== -1) furniturePieces.splice(idx, 1);
    el.remove();
    rebuildObstacles();
  }));
  el.appendChild(furnitureBtn('↻', 'Rotate 90°', () => {
    piece.rotation = (piece.rotation + 90) % 360;
    applyFurnitureTransform(img, piece);
  }));
  el.appendChild(furnitureBtn('↔', 'Flip horizontal', () => {
    piece.flipX = !piece.flipX;
    applyFurnitureTransform(img, piece);
  }));

  // Resize handle — bottom-right corner
  const handle = document.createElement('div');
  handle.className = 'furniture-resize-handle';
  el.appendChild(handle);

  // Prevent furniture clicks from reaching the canvas click handler
  el.addEventListener('click', e => e.stopPropagation());

  // ---- Drag to move ----
  let drag = null;
  el.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const { w, h } = getCanvasSize();
    drag = { startPx: e.clientX, startPy: e.clientY,
             startRx: piece.rx,  startRy: piece.ry, w, h };
    el.setPointerCapture(e.pointerId);
    el.classList.add('furniture-dragging');
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const { w, h } = getCanvasSize();
    piece.rx = Math.max(0, Math.min(1 - piece.pw / w, drag.startRx + (e.clientX - drag.startPx) / drag.w));
    piece.ry = Math.max(0, Math.min(1 - piece.ph / h, drag.startRy + (e.clientY - drag.startPy) / drag.h));
    el.style.left = piece.rx * 100 + '%';
    el.style.top  = piece.ry * 100 + '%';
    rebuildObstacles();
  });
  el.addEventListener('pointerup', () => { drag = null; el.classList.remove('furniture-dragging'); });

  // ---- Resize ----
  let resize = null;
  handle.addEventListener('pointerdown', e => {
    e.stopPropagation();
    resize = { startPx: e.clientX, startPy: e.clientY, startW: piece.pw, startH: piece.ph };
    handle.setPointerCapture(e.pointerId);
    el.classList.add('furniture-resizing');
  });
  handle.addEventListener('pointermove', e => {
    if (!resize) return;
    piece.pw = Math.max(48, resize.startW + (e.clientX - resize.startPx));
    piece.ph = Math.max(48, resize.startH + (e.clientY - resize.startPy));
    el.style.width  = piece.pw + 'px';
    el.style.height = piece.ph + 'px';
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
  px = Math.max(EDGE, Math.min(w - size - EDGE, px));
  py = Math.max(EDGE, Math.min(h - size - EDGE, py));

  const rx = px / w, ry = py / h;
  const piece = { type: def.type, rx, ry, pw: size, ph: size, rotation: 0, flipX: def.flip };
  furniturePieces.push(piece);

  const el = document.createElement('div');
  el.className = 'furniture';
  el.style.cssText = `left:${rx*100}%;top:${ry*100}%;width:${size}px;height:${size}px;`;
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
    const item = document.createElement('div');
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
  const layout = [
    ['desk_cluster',   0.10, 0.08],
    ['coffee_station', 0.44, 0.04],
    ['printer',        0.78, 0.06],
    ['whiteboard',     0.04, 0.45],
    ['couch_2seater',  0.80, 0.40],
    ['table_cafe',     0.45, 0.55],
    ['plant_snake',    0.92, 0.78],
    ['lamp_arc_big',   0.02, 0.78],
  ];
  for (const [type, rx, ry] of layout) placeFurniturePiece(byType(type), rx, ry);
}

// ---- Init ----
updateSpriteSize();      // must be first — SPRITE_W/H drive layout everywhere
rebuildObstacles();      // populate OBSTACLES with walls before character spawn
initParticles();
initFurniturePalette();  // build the right-panel furniture picker
initDefaultOffice();     // starter furniture layout (before characters spawn)
initCharacters();
state.rafId = requestAnimationFrame(gameLoop);
