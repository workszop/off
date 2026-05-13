// ============================
//  Office Friends Playground
//  Pure HTML/CSS/JS - Vanilla
// ============================

// ---- Dialogue Banks ----
const DIALOGUE_BANKS = {
  andy: [
    // Office life — leaning into the bit
    "The new coffee machine has a touchscreen. I am not its biological friend.",
    "I swear the printer can smell fear. Mine, specifically.",
    "We had a meeting to plan the meeting. I took notes about the notes.",
    "My to-do list has its own to-do list. They're not on speaking terms.",
    "Lunch options: sandwich place, sad desk salad, or emotionally consuming a granola bar.",
    "I've been 'circling back' for so long I'm legally a roundabout.",
    "Is it 5pm yet? Asking for a friend. The friend is also me.",
    "Tried to print double-sided. Now I have a sequel.",
    "Boss said 'let's take this offline'. So I closed my laptop and went home.",
    "Spent 40 minutes phrasing an email so it didn't sound passive aggressive. Now it sounds aggressive aggressive.",
    "I have three plants on my desk. One's alive. I don't know which two are bluffing.",
    "Muted myself to sneeze. Then talked for three minutes still muted. Classic.",
    "My out-of-office reply has more personality than I do.",
    "If anyone asks, I'm 'in deep focus'. I'm watching a video about ducks.",
    // TikTok
    "My nephew tried to teach me a TikTok dance. I pulled something philosophical.",
    "Went on TikTok for 'two minutes' last night. Woke up at 3am as a different person.",
    "TikTok thinks I'm a 14-year-old who loves cake decorating now. I'm not correcting it.",
    // Books
    "Finally finished that thriller. The ending was… a choice.",
    "Started a self-help book. It told me to start another self-help book.",
    "Reading on the bus is great until your stop disappears behind you.",
    // Bikes
    "Bought a bike last spring. Still admiring it from the box.",
    "Commute is 12 minutes by bike, 45 by car. Guess which one I drive.",
    "Saw a guy on a unicycle this morning. He looked smug. He'd earned it.",
    // Broken arms
    "Broke my arm in 8th grade. Skateboard. Do not recommend.",
    "Got my cast off and one arm is noticeably skinnier. Free asymmetry.",
    "You can break a wrist tripping on a curb. I bring this up uninvited.",
  ],
  jazz: [
    "Have you tried turning it off and on again?",
    "I brought cookies! They're on the kitchen counter.",
    "This spreadsheet is going to be the death of me.",
    "Andy, you said you'd file that report yesterday!",
    "Team lunch Friday? I'm buying!",
    "Who keeps changing the thermostat? It's freezing!",
    "I organized the supply closet. You're welcome.",
    // TikTok
    "I posted a TikTok of the office plants. Twelve views and one is mine.",
    "My algorithm is just dogs in costumes and I'm not mad about it.",
    "Made a 'get ready with me' for putting together IKEA shelves.",
    // Books
    "Book club chose the longest novel imaginable. I'm three chapters in.",
    "Just finished a memoir — already buying the author's other one.",
    "Reading in the bath is a leap of faith. The book did not survive.",
    // Bikes
    "I started biking to work. My calves now have opinions.",
    "Got panniers! I'm one waterproof poncho away from a personality.",
    "Andy, want to bike to lunch tomorrow? It's like 15 minutes.",
    // Broken arms
    "My cousin broke her wrist roller-skating. Loving the cast signatures.",
    "When I broke my arm I learned ALL my friends have terrible handwriting.",
    "The worst part wasn't the break. It was showering with a plastic bag.",
  ],
  olex: [
    "I had the weirdest dream about code last night.",
    "Does anyone actually read these status reports?",
    "The WiFi name should be 'ItWorksOnMyMachine'.",
    "I just fixed a bug I created three months ago. Oops.",
    "Coffee is just bean water and I need it.",
    "My code compiled on the first try. Something's wrong.",
    "Monday morning: exists. Me: why.",
    // TikTok
    "TikTok is a content firehose pointed at your prefrontal cortex.",
    "I'm on dev TikTok. It is 90% people lying about their salaries.",
    "Watched a 47-second video about kerning. Reorganized my entire codebase.",
    // Books
    "Reading 'Designing Data-Intensive Applications'. Started in 2022.",
    "Finished the book. Plot twist: the database was the problem.",
    "Yesterday I read for 30 minutes. It was a TikTok transcript.",
    // Bikes
    "I bike to work. I arrive sweaty and somehow angrier.",
    "Replaced my brake pads with internet advice. Will report back.",
    "If I get one more flat tire I'm going back to the bus.",
    // Broken arms
    "Pretty sure I'd break my arm just thinking about a treadmill.",
    "Broke my arm coding once. Long story. It involved a standing desk.",
    "My cousin's cast had a QR code on it. Linked to his Venmo.",
  ],
};

const GREETINGS = {
  andy: [
    "Oh hey — am I in trouble?",
    "Currently 12% of a person. How can I help?",
    "You found me. I was hiding from the report.",
    "Hey! Pretend I look busy.",
    "Andy, reporting in. Mildly.",
  ],
  jazz: ["Hi! Great to see you ✨", "Jazz at your service.", "Hey friend, what's the plan?", "*finger guns*"],
  olex: ["Sup.", "You rang?", "Bean water acquired. What now?", "Oh, hello there."],
};

const COFFEE_DIALOGUE = {
  andy: [
    "Coffee time! ☕",
    "This mug is technically my third breakfast.",
    "If I don't get coffee the report won't survive. Honestly, neither will I.",
    "Strong enough to compile.",
  ],
  jazz: [
    "Coffee break! Who's joining? ☕",
    "A warm cup of productivity.",
    "I switched to oat milk. Don't tell my old self.",
    "I brought biscuits!",
  ],
  olex: [
    "Bean water, my only friend. ☕",
    "Coffee: because adulting is hard.",
    "If this mug had a personality, it'd be mine.",
    "I trust the machine more than the standup.",
  ],
};

const MEETING_DIALOGUE = {
  andy: [
    "So… are we starting?",
    "I have notes from last meeting. Possibly.",
    "Quick question — does anyone actually want to be here?",
    "Item one: do we need item one?",
  ],
  jazz: [
    "Okay team! Let's get aligned.",
    "I made a slide deck. There are 47 slides.",
    "Quick standup: what's blocking us?",
    "Let's parking-lot that and circle back.",
  ],
  olex: [
    "Is this meeting strictly necessary?",
    "I'll just listen. From the corner.",
    "Five-minute meeting? Bold prediction.",
    "Can we put my points in writing instead?",
  ],
};

const COLORS = {
  andy: { color: '#D4765F', border: '#D4765F', bg: '#FFF8F0' },
  jazz: { color: '#7BA38C', border: '#7BA38C', bg: '#F0FFF5' },
  olex: { color: '#A894C7', border: '#A894C7', bg: '#F5F0FF' },
};

const SPRITE_MAP = {
  andy: { idle: 'assets/char1_idle.png', left: 'assets/char1_walk_left.png', right: 'assets/char1_walk_right.png' },
  jazz: { idle: 'assets/char2_idle.png', left: 'assets/char2_walk_left.png', right: 'assets/char2_walk_right.png' },
  olex: { idle: 'assets/char3_idle.png', left: 'assets/char3_walk_left.png', right: 'assets/char3_walk_right.png' },
};

// ---- Obstacles (relative 0-1 coords within the room area) ----
// Room is fully sealed — top, bottom, left, and right walls span edge-to-edge
// so the characters are confined and have no doorways to walk through.
const OBSTACLES = [
  { x: 0.00, y: 0.00, w: 1.00, h: 0.02 },  // top wall
  { x: 0.00, y: 0.98, w: 1.00, h: 0.02 },  // bottom wall
  { x: 0.00, y: 0.00, w: 0.02, h: 1.00 },  // left wall
  { x: 0.98, y: 0.00, w: 0.02, h: 1.00 },  // right wall
  { x: 0.42, y: 0.02, w: 0.18, h: 0.10 },  // coffee station
  { x: 0.68, y: 0.18, w: 0.14, h: 0.18 },  // desks-1
  { x: 0.55, y: 0.45, w: 0.16, h: 0.22 },  // desks-2
  { x: 0.02, y: 0.02, w: 0.08, h: 0.12 },  // plant-1
  { x: 0.02, y: 0.72, w: 0.08, h: 0.18 },  // plant-2
];

// ---- Game Constants ----
const BASE_SPEED = 1.0;            // a touch quicker — characters cover more ground
const PROXIMITY = 70;              // chat only when characters are genuinely close
const REPULSION = 45;
const SPRITE_W = 80;
const SPRITE_H = 160;
const WAVE_DURATION = 1500;
const TARGET_STUCK_FRAMES = 90;
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
  stats: { conversations: 0, steps: 0, coffee: 0, meetings: 0 },
  stepsAcc: 0,
  convPairs: new Set(),
  pendingTimers: new Set(),
  keys: new Set(),
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
};

// ---- DOM refs ----
const canvas = document.getElementById('gameCanvas');
const charsLayer = document.getElementById('charactersLayer');
const bubblesLayer = document.getElementById('bubblesLayer');

// ---- Helpers ----
function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx*dx + dy*dy); }

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function getCanvasSize() {
  return { w: canvas.clientWidth, h: canvas.clientHeight };
}

function getScaledObstacles() {
  const { w, h } = getCanvasSize();
  return OBSTACLES.map(o => ({
    x: o.x * w, y: o.y * h,
    w: o.w * w, h: o.h * h,
  }));
}

function wouldHitObstacle(x, y, obstacles) {
  for (const o of obstacles) {
    if (rectsOverlap(x, y, SPRITE_W, SPRITE_H, o.x, o.y, o.w, o.h)) {
      const cx = x + SPRITE_W / 2, cy = y + SPRITE_H / 2;
      const ocx = o.x + o.w / 2, ocy = o.y + o.h / 2;
      const dx = cx - ocx, dy = cy - ocy;
      const ox = (SPRITE_W + o.w) / 2 - Math.abs(dx);
      const oy = (SPRITE_H + o.h) / 2 - Math.abs(dy);
      if (ox < oy) return { hit: true, px: dx > 0 ? ox : -ox, py: 0 };
      return { hit: true, px: 0, py: dy > 0 ? oy : -oy };
    }
  }
  return { hit: false, px: 0, py: 0 };
}

// Iterative pushback — a single push can land inside a second obstacle,
// so we repeat up to 3 times. `bounce` = true reflects velocity.
function resolveObstacles(c, obstacles, bounce = false) {
  for (let i = 0; i < 3; i++) {
    const col = wouldHitObstacle(c.x, c.y, obstacles);
    if (!col.hit) break;
    c.x += col.px;
    c.y += col.py;
    if (bounce) {
      if (col.px !== 0) c.vx = -c.vx;
      if (col.py !== 0) c.vy = -c.vy;
    }
  }
}

// Find a valid point near (x, y) that is inside the room and clear of obstacles.
function safeGatherPoint(x, y) {
  const { w, h } = getCanvasSize();
  const obstacles = getScaledObstacles();
  const cx = Math.max(SPAWN_MARGIN, Math.min(w - SPRITE_W - SPAWN_MARGIN, x));
  const cy = Math.max(SPAWN_MARGIN, Math.min(h - SPRITE_H - SPAWN_MARGIN, y));
  if (!wouldHitObstacle(cx, cy, obstacles).hit) return { x: cx, y: cy };
  for (let r = 20; r <= 160; r += 20) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const nx = Math.max(SPAWN_MARGIN, Math.min(w - SPRITE_W - SPAWN_MARGIN, cx + Math.cos(a) * r));
      const ny = Math.max(SPAWN_MARGIN, Math.min(h - SPRITE_H - SPAWN_MARGIN, cy + Math.sin(a) * r));
      if (!wouldHitObstacle(nx, ny, obstacles).hit) return { x: nx, y: ny };
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
  const c = COLORS[type];
  return {
    id, name, type, x, y,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    speed: BASE_SPEED * speedMod,
    speedMod,
    color: c.color, borderColor: c.border, bgColor: c.bg,
    state: 'walking',
    facing: Math.random() > 0.5 ? 'right' : 'left',
    targetX: null, targetY: null,
    targetStuckFrames: 0,
    idleTimer: 0, waveTimer: 0,
    isChatting: false,
    el: null, innerEl: null, imgEl: null, bubbleEl: null,
    lastSpriteSrc: '',
    lastInnerClass: '',
  };
}

// Pick a random spawn point that's safely inside the room and not overlapping
// any obstacle. Used for init and reset so characters never start clipped
// into the walls or desks.
function findSpawnPoint(existing = []) {
  const { w, h } = getCanvasSize();
  const obstacles = getScaledObstacles();
  for (let i = 0; i < 60; i++) {
    const x = rand(SPAWN_MARGIN, w - SPRITE_W - SPAWN_MARGIN);
    const y = rand(SPAWN_MARGIN, h - SPRITE_H - SPAWN_MARGIN);
    if (wouldHitObstacle(x, y, obstacles).hit) continue;
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
    createCharacter('andy', 'Andy', 'andy', 0, 0, 1.0),
    createCharacter('jazz', 'Jazz', 'jazz', 0, 0, 1.2),
    createCharacter('olex', 'Olex', 'olex', 0, 0, 0.85),
  ];
  const placed = [];
  for (const c of state.chars) {
    const p = findSpawnPoint(placed);
    c.x = p.x; c.y = p.y;
    placed.push(p);
  }
  state.chars.forEach(c => renderCharacter(c));
}

// ---- DOM Rendering ----
function renderCharacter(c) {
  const el = document.createElement('div');
  el.className = 'character';
  el.dataset.id = c.id;
  el.dataset.type = c.type;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${c.name} — click or press Enter to select`);
  el.setAttribute('aria-pressed', 'false');
  el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;

  // Inner element carries the walking/wave bob so it composes cleanly
  // with the root's translate3d positioning.
  const inner = document.createElement('div');
  inner.className = 'character-inner walking';

  const img = document.createElement('img');
  img.src = SPRITE_MAP[c.type][c.facing === 'right' ? 'right' : 'left'];
  img.alt = '';
  img.draggable = false;
  c.lastSpriteSrc = img.src;
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
  let innerCls = 'character-inner';
  let src;

  if (c.state === 'waving') {
    innerCls += ' waving';
    src = SPRITE_MAP[c.type].idle;
  } else if (c.state === 'idle' || c.state === 'chatting') {
    src = SPRITE_MAP[c.type].idle;
  } else if (isMoving) {
    innerCls += ' walking';
    src = SPRITE_MAP[c.type][c.facing === 'right' ? 'right' : 'left'];
  } else {
    src = SPRITE_MAP[c.type].idle;
  }

  if (innerCls !== c.lastInnerClass) {
    c.innerEl.className = innerCls;
    c.lastInnerClass = innerCls;
  }
  if (src !== c.lastSpriteSrc) {
    c.imgEl.src = src;
    c.lastSpriteSrc = src;
  }

  // is-walking drives the CSS waist-up crop: full body when moving or waving,
  // portrait crop when idle / chatting.
  const showFullBody = c.state === 'waving' || isMoving;
  c.el.classList.toggle('is-walking', showFullBody);

  const sel = state.selectedId === c.id;
  c.el.classList.toggle('selected', sel);
  c.el.setAttribute('aria-pressed', sel ? 'true' : 'false');
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
  const centerX = c.x + SPRITE_W / 2;
  let left = centerX - bw / 2;
  // Clamp to canvas with 8px padding so the bubble can't clip off-screen.
  left = Math.max(8, Math.min(w - bw - 8, left));
  c.bubbleEl.style.left = left + 'px';
  c.bubbleEl.style.top = (c.y - 20) + 'px';
  // Keep the bubble's pointer triangle aimed at the character's head.
  const pointerLeft = Math.max(12, Math.min(bw - 12, centerX - left));
  c.bubbleEl.style.setProperty('--pointer-x', pointerLeft + 'px');
}

// ---- Stats ----
// Mutate state immediately; only debounce the DOM render. This prevents
// back-to-back updates from losing increments inside the debounce window.
function bumpStat(name, by = 1) {
  state.stats[name] += by;
  scheduleStatsRender();
}
function setStat(name, value) {
  if (state.stats[name] === value) return;
  state.stats[name] = value;
  scheduleStatsRender();
}
function scheduleStatsRender() {
  state.statsDirty = true;
  if (state.statsRenderTimer) return;
  state.statsRenderTimer = setTimeout(() => {
    state.statsRenderTimer = 0;
    if (!state.statsDirty) return;
    state.statsDirty = false;
    document.getElementById('statConversations').textContent = state.stats.conversations;
    document.getElementById('statSteps').textContent = state.stats.steps;
    document.getElementById('statCoffee').textContent = state.stats.coffee;
    document.getElementById('statMeetings').textContent = state.stats.meetings;

    const bar = document.getElementById('statsBar');
    bar.querySelectorAll('.stat-pill').forEach(p => {
      p.classList.remove('pulse');
      void p.offsetWidth;
      p.classList.add('pulse');
    });
  }, STATS_RENDER_DEBOUNCE_MS);
}

// ---- Game Loop ----
function gameLoop(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const frameDelta = timestamp - state.lastTime;
  const dt = Math.min(frameDelta / 16.667, 3);
  state.lastTime = timestamp;

  if (state.isPlaying) {
    const { w, h } = getCanvasSize();
    const obstacles = getScaledObstacles();
    let stepsAcc = 0;

    for (const c of state.chars) {
      // Wave timer
      if (c.waveTimer > 0) {
        c.waveTimer -= frameDelta;
        if (c.waveTimer <= 0) { c.state = 'walking'; c.waveTimer = 0; }
        continue;
      }

      // Idle timer
      if (c.idleTimer > 0) {
        c.idleTimer -= frameDelta;
        if (c.idleTimer <= 0) { c.state = 'walking'; c.idleTimer = 0; }
        continue;
      }

      // Stop completely while chatting — freeze in place and face each other.
      if (c.isChatting) {
        c.vx = 0; c.vy = 0;
        continue;
      }

      // Target-based movement (meeting, scatter, click-to-move)
      if (c.targetX !== null && c.targetY !== null) {
        const dx = c.targetX - c.x, dy = c.targetY - c.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 10) {
          c.targetX = null; c.targetY = null;
          c.targetStuckFrames = 0;
          c.state = 'idle'; c.idleTimer = state.activeScene ? 999999 : 2000;
          c.vx = 0; c.vy = 0;
        } else {
          const spd = c.speed * state.walkSpeed;
          c.vx = (dx / d) * spd; c.vy = (dy / d) * spd;
          const prevX = c.x, prevY = c.y;
          c.x += c.vx * dt; c.y += c.vy * dt;
          stepsAcc += Math.abs(c.vx * dt) + Math.abs(c.vy * dt);
          c.facing = c.vx > 0 ? 'right' : 'left';

          resolveObstacles(c, obstacles);   // iterative pushback
          if (Math.hypot(c.x - prevX, c.y - prevY) < 0.5) {
            c.targetStuckFrames++;
            if (c.targetStuckFrames > TARGET_STUCK_FRAMES) {
              c.targetStuckFrames = 0;
              if (state.activeScene) {
                // During a scene keep trying: nudge sideways to get around the corner.
                const angle = Math.random() * Math.PI * 2;
                c.x += Math.cos(angle) * 8;
                c.y += Math.sin(angle) * 8;
                resolveObstacles(c, obstacles);
              } else {
                c.targetX = null; c.targetY = null;
                c.vx = 0; c.vy = 0; c.state = 'idle'; c.idleTimer = 600;
              }
            }
          } else {
            c.targetStuckFrames = 0;
          }
        }
        continue;
      }

      // ---- Keyboard control for selected character ----
      if (state.selectedId === c.id) {
        const keys = state.keys;
        let kx = 0, ky = 0;
        if (keys.has('arrowleft') || keys.has('a')) kx -= 1;
        if (keys.has('arrowright') || keys.has('d')) kx += 1;
        if (keys.has('arrowup') || keys.has('w')) ky -= 1;
        if (keys.has('arrowdown') || keys.has('s')) ky += 1;

        if (kx !== 0 || ky !== 0) {
          const len = Math.sqrt(kx*kx + ky*ky) || 1;
          const spd = c.speed * state.walkSpeed * 1.5;
          c.vx = (kx / len) * spd;
          c.vy = (ky / len) * spd;
          c.state = 'walking';
          c.x += c.vx * dt; c.y += c.vy * dt;
          stepsAcc += Math.abs(c.vx * dt) + Math.abs(c.vy * dt);
          c.facing = c.vx > 0 ? 'right' : 'left';

          resolveObstacles(c, obstacles);  // iterative, no bounce for keyboard
        } else {
          c.vx = 0; c.vy = 0; c.state = 'idle';
        }
        continue;
      }

      // During a scripted scene (Coffee/Meeting), characters that have arrived
      // at their gather spot stand still until the scene finishes — they
      // shouldn't wander out of the cluster between dialogue lines.
      if (state.activeScene) {
        c.vx = 0; c.vy = 0;
        if (c.state !== 'chatting') c.state = 'idle';
        continue;
      }

      // ---- Autonomous random walk (cumulative thresholds — each branch reachable) ----
      // Lower direction-change probability than before so characters commit to
      // a direction longer and actually traverse the room instead of jittering.
      const roll = Math.random();
      if (roll < 0.012 * dt) {
        const angle = Math.random() * Math.PI * 2;
        c.vx = Math.cos(angle) * c.speed * state.walkSpeed;
        c.vy = Math.sin(angle) * c.speed * state.walkSpeed;
        c.state = 'walking';
      } else if (roll < 0.018 * dt) {
        // Center bias — nudge toward middle of the room so they don't loiter.
        const cx = w / 2, cy = h / 2;
        const dx = cx - c.x, dy = cy - c.y;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        c.vx += (dx / d) * 0.3 * state.walkSpeed;
        c.vy += (dy / d) * 0.3 * state.walkSpeed;
      } else if (roll < 0.022 * dt) {
        // Brief rest — keep these short so they don't stand still much.
        c.state = 'idle';
        c.idleTimer = 600 + Math.random() * 1000;
        c.vx = 0; c.vy = 0;
      }

      // Guarantee a minimum velocity so characters always feel "in motion".
      const sp = Math.hypot(c.vx, c.vy);
      const minSp = 0.4 * c.speed * state.walkSpeed;
      if (sp < minSp && c.state === 'walking') {
        const angle = Math.random() * Math.PI * 2;
        c.vx = Math.cos(angle) * c.speed * state.walkSpeed;
        c.vy = Math.sin(angle) * c.speed * state.walkSpeed;
      }

      c.x += c.vx * dt; c.y += c.vy * dt;
      stepsAcc += Math.abs(c.vx * dt) + Math.abs(c.vy * dt);
      if (Math.abs(c.vx) > 0.1) c.facing = c.vx > 0 ? 'right' : 'left';

      // Repulsion from other characters
      for (const o of state.chars) {
        if (o.id === c.id) continue;
        const d = dist(c, o);
        if (d < REPULSION && d > 0) {
          const overlap = REPULSION - d;
          const dx = c.x - o.x, dy = c.y - o.y;
          c.x += (dx / d) * overlap * 0.05 * dt;
          c.y += (dy / d) * overlap * 0.05 * dt;
        }
      }

      // Iterative billiard bounce — also resolves any overlap caused by repulsion.
      resolveObstacles(c, obstacles, true);
      if (Math.hypot(c.vx, c.vy) < 0.3) {
        const angle = Math.random() * Math.PI * 2;
        c.vx = Math.cos(angle) * c.speed * state.walkSpeed;
        c.vy = Math.sin(angle) * c.speed * state.walkSpeed;
      }

      // Hard clamp inside the wall band — last-resort safety net.
      const wallW = w * 0.02, wallH = h * 0.02;
      c.x = Math.max(wallW, Math.min(w - SPRITE_W - wallW, c.x));
      c.y = Math.max(wallH, Math.min(h - SPRITE_H - wallH, c.y));
    }

    if (stepsAcc > 0) {
      state.stepsAcc += stepsAcc;
      setStat('steps', Math.floor(state.stepsAcc / 100));
    }

    // Conversations — suppressed while a scripted scene is running so the
    // gather-and-talk dialogue isn't drowned in random chatter.
    const chatProb = state.activeScene ? 0 : state.chatFreq / 100;
    const chars = state.chars;
    for (let i = 0; i < chars.length; i++) {
      for (let j = i + 1; j < chars.length; j++) {
        const a = chars[i], b = chars[j];
        const d = dist(a, b);
        const pairKey = [a.id, b.id].sort().join('-');

        if (d < PROXIMITY && !state.convPairs.has(pairKey) && !a.isChatting && !b.isChatting) {
          if (Math.random() < chatProb * 0.02 * dt) {
            state.convPairs.add(pairKey);
            a.isChatting = true; b.isChatting = true;
            a.state = 'chatting'; b.state = 'chatting';
            // Stop them in place and face each other.
            a.vx = 0; a.vy = 0; a.targetX = null; a.targetY = null;
            b.vx = 0; b.vy = 0; b.targetX = null; b.targetY = null;
            a.facing = a.x <= b.x ? 'right' : 'left';
            b.facing = b.x <= a.x ? 'right' : 'left';

            showBubble(a, pick(DIALOGUE_BANKS[a.type]), 2800);

            trackedTimeout(() => {
              if (!b.isChatting) return;
              showBubble(b, pick(DIALOGUE_BANKS[b.type]), 2800);
            }, 3000);

            trackedTimeout(() => {
              state.convPairs.delete(pairKey);
              a.isChatting = false; b.isChatting = false;
              if (a.state === 'chatting') a.state = 'walking';
              if (b.state === 'chatting') b.state = 'walking';
            }, 6000);

            bumpStat('conversations');
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
function onCharClick(id) {
  const c = state.chars.find(ch => ch.id === id);
  if (!c) return;

  if (state.selectedId === id) {
    state.selectedId = null;
  } else {
    state.selectedId = id;
    // Trigger the wave animation that was previously dead code.
    c.state = 'waving';
    c.waveTimer = WAVE_DURATION;
    showBubble(c, pick(GREETINGS[c.type]), 2600);

    if (!state.hasSeenHelp) {
      trackedTimeout(() => {
        showBubble(c, 'Use WASD or click to move!', 2600);
      }, 3000);
    }
  }
  updateCanvasCursor();
  state.chars.forEach(updateCharDOM);
}

function onCanvasClick(e) {
  if (!state.selectedId) return;
  if (e.target.closest('[data-id]')) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - SPRITE_W / 2;
  const y = e.clientY - rect.top - SPRITE_H / 2;
  const c = state.chars.find(ch => ch.id === state.selectedId);
  if (!c) return;
  c.targetX = x;
  c.targetY = y;
  c.targetStuckFrames = 0;
  c.state = 'walking';
}

function updateCanvasCursor() {
  canvas.classList.toggle('has-selection', !!state.selectedId);
}

// ---- Control Panel ----
document.getElementById('btnPlay').addEventListener('click', () => {
  state.isPlaying = !state.isPlaying;
  document.getElementById('playIcon').textContent = state.isPlaying ? '⏸' : '▶';
  document.getElementById('playText').textContent = state.isPlaying ? 'Pause' : 'Play';
  if (!state.isPlaying) {
    // Don't let queued chat callbacks pop bubbles on paused characters.
    clearPendingTimers();
    state.convPairs.clear();
    for (const c of state.chars) {
      c.isChatting = false;
      if (c.state === 'chatting') c.state = 'idle';
    }
  }
});

document.getElementById('speedSlider').addEventListener('input', (e) => {
  state.walkSpeed = parseFloat(e.target.value);
  document.getElementById('speedValue').textContent = state.walkSpeed.toFixed(1) + 'x';
});

const CHAT_LABELS = [
  [0, 'Silent'], [10, 'Rare'], [30, 'Low'],
  [50, 'Normal'], [70, 'Chatty'], [100, 'Non-stop'],
];
document.getElementById('chatSlider').addEventListener('input', (e) => {
  state.chatFreq = parseInt(e.target.value);
  let label = CHAT_LABELS[0][1];
  for (const [thr, name] of CHAT_LABELS) {
    if (state.chatFreq >= thr) label = name;
  }
  document.getElementById('chatValue').textContent = label;
});

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
    c.idleTimer = 0;
    c.waveTimer = 0;
  });
  state.selectedId = null;
  updateCanvasCursor();
  state.activeScene = true;

  state.chars.forEach((c, i) => {
    const p = positions[i];
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
          showBubble(c, pick(dialogueBank[c.type]), 2800);
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
  ];
}

document.getElementById('btnCoffee').addEventListener('click', () => {
  bumpStat('coffee');
  gatherAndChat(coffeeGatherPositions(), COFFEE_DIALOGUE, 2);
});

document.getElementById('btnScatter').addEventListener('click', () => {
  const { w, h } = getCanvasSize();
  // Keep targets a safe distance inside the sealed walls so characters
  // don't immediately collide and get stuck against the perimeter.
  const M = SPAWN_MARGIN;
  state.chars.forEach(c => {
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: c.targetX = rand(M, w - SPRITE_W - M); c.targetY = M; break;
      case 1: c.targetX = w - SPRITE_W - M; c.targetY = rand(M, h - SPRITE_H - M); break;
      case 2: c.targetX = rand(M, w - SPRITE_W - M); c.targetY = h - SPRITE_H - M; break;
      default: c.targetX = M; c.targetY = rand(M, h - SPRITE_H - M); break;
    }
    c.targetStuckFrames = 0;
    c.state = 'walking';
  });
});

document.getElementById('btnMeeting').addEventListener('click', () => {
  bumpStat('meetings');
  gatherAndChat(meetingGatherPositions(), MEETING_DIALOGUE, 3);
});

document.getElementById('btnReset').addEventListener('click', () => {
  clearPendingTimers();
  const placed = [];
  state.chars.forEach(c => {
    const p = findSpawnPoint(placed);
    c.x = p.x; c.y = p.y;
    placed.push(p);
    c.vx = (Math.random() - 0.5) * 2; c.vy = (Math.random() - 0.5) * 2;
    c.targetX = null; c.targetY = null;
    c.targetStuckFrames = 0;
    c.state = 'walking'; c.isChatting = false;
    c.waveTimer = 0; c.idleTimer = 0;
    if (c.bubbleEl) { c.bubbleEl.remove(); c.bubbleEl = null; }
  });
  state.convPairs.clear();
  state.selectedId = null;
  state.stepsAcc = 0;
  state.stats = { conversations: 0, steps: 0, coffee: 0, meetings: 0 };
  scheduleStatsRender();
  updateCanvasCursor();
  state.chars.forEach(updateCharDOM);
});

document.getElementById('panelToggle').addEventListener('click', () => {
  state.panelOpen = !state.panelOpen;
  document.getElementById('controlPanel').classList.toggle('collapsed', !state.panelOpen);
});

// ---- Canvas click ----
canvas.addEventListener('click', onCanvasClick);

// ---- Keyboard ----
window.addEventListener('keydown', (e) => {
  state.keys.add(e.key.toLowerCase());
  if (e.key === 'Escape') {
    state.selectedId = null;
    updateCanvasCursor();
    state.chars.forEach(updateCharDOM);
  }
  if (state.selectedId && ['arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) {
    // Stop arrow keys from scrolling the page while driving a character.
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  state.keys.delete(e.key.toLowerCase());
});

// ---- Modal ----
const modal = document.getElementById('howToPlayModal');
function openModal() { modal.classList.add('active'); }
function closeModal() {
  modal.classList.remove('active');
  lsSet('office-friends-seen-help', 'true');
  state.hasSeenHelp = true;
}
document.getElementById('helpBtn').addEventListener('click', openModal);
document.getElementById('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

if (!state.hasSeenHelp) {
  setTimeout(openModal, 800);
}

// ---- Floating Particles ----
function initParticles() {
  const container = document.getElementById('particles');
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
window.addEventListener('resize', () => {
  const { w, h } = getCanvasSize();
  const wallW = w * 0.02, wallH = h * 0.02;
  state.chars.forEach(c => {
    c.x = Math.max(wallW, Math.min(w - SPRITE_W - wallW, c.x));
    c.y = Math.max(wallH, Math.min(h - SPRITE_H - wallH, c.y));
    if (c.bubbleEl) positionBubble(c);
    updateCharDOM(c);
  });
});

// ---- Init ----
initParticles();
initCharacters();
updateCanvasCursor();
state.rafId = requestAnimationFrame(gameLoop);
