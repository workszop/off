# Natural Motion and Social Behavior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the particle-style character movement with steering kinematics (heading, capped turns, acceleration, arrive braking, micro-pauses, odometer gait) and make conversations/scenes read as social behavior (turn-taking, staggered departures, glances).

**Architecture:** Everything stays inside the existing classic-script architecture: motion state lives on the character objects in `state.chars`, logic in the existing `gameLoop` branches in `js/game.js`, scene changes in `js/events.js`, presentation in `css/style.css`. No new files, no framework, no build step.

**Tech Stack:** Vanilla JS (classic scripts, no modules), CSS animations, verification via `node --check` plus in-browser probes (`python3 -m http.server` + browser JS console / claude-in-chrome `javascript_tool`).

**Spec:** `docs/superpowers/specs/2026-08-04-natural-motion-design.md` (approved).

## Global Constraints

- No build step; the app must keep working from `file://` and `python3 -m http.server`.
- camelCase variables, SCREAMING_SNAKE_CASE constants, section comments `// ─── Title ───` style already in use (`// ---- Title ----`); follow the existing `// ---- ... ----` form.
- Never use em-dashes in generated content; use "-" or "–".
- All colors via CSS custom properties; this plan adds no colors.
- All new tuning constants go in the single `MOTION` block (Task 1); no magic numbers sprinkled in logic.
- `state.chars` has exactly 4 characters; per-frame O(n²) passes are fine.
- Timer rule (top of `js/events.js`): scene/dialogue timelines use `trackedTimeout`; anything that must survive `clearPendingTimers()` uses raw timers.
- After each task: `node --check js/game.js js/events.js` must pass, and the listed probes must pass in a real browser before committing.
- Work happens on branch `feat/natural-motion` (already created; spec is committed there).

## How to run browser probes

Every task's "Probe" steps assume:

```bash
python3 -m http.server 8741 &   # serve repo root
# open http://localhost:8741/index.html in a browser tab
```

Probe snippets are pasted into the console (or run via claude-in-chrome
`javascript_tool`). The page must be visible/foregrounded, otherwise
`requestAnimationFrame` does not run; if the tab reports `document.hidden ===
true`, drive frames manually with the stub pattern:

```js
// Run ~1s of simulated frames synchronously without duplicating the rAF loop.
function pump(frames = 30, stepMs = 33) {
  const realRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = () => 0;
  try { let t = state.lastTime || performance.now();
        for (let i = 0; i < frames; i++) { t += stepMs; gameLoop(t); } }
  finally { window.requestAnimationFrame = realRAF; }
}
```

---

### Task 1: Motion foundation (constants, helpers, character fields, debug counters)

**Files:**
- Modify: `js/game.js` (constants near line 37, helpers section near line 130, `createCharacter` near line 316)
- Modify: `js/events.js:398` (`window.__off`)

**Interfaces:**
- Consumes: existing `clamp(v, min, max)`, `rand(min, max)`, `effectiveSpeed(c)`.
- Produces (later tasks rely on these exact names):
  - `MOTION` constant object (fields listed below),
  - `MOTION_COUNTERS = { pauses: 0, glances: 0, convTurns: 0 }`,
  - `turnToward(from, to, maxDelta)` -> number (radians),
  - `turnRate(c)` -> number (rad/s),
  - `applyMotion(c, dt, frameDelta)` -> number (px stepped this frame),
  - character fields: `heading`, `curSpeed`, `targetSpeed`, `gaitDist`, `facingHold`, `viewHold`, `pauseIn`, `pauseTimer`, `glanceTimer`, `glanceFacing`, `listeningTo`.

- [ ] **Step 1: Add the MOTION constants block and counters**

In `js/game.js`, directly under the `SPAWN_MARGIN` constant (end of the `// ---- Game Constants ----` block), add:

```js
// ---- Motion tuning (natural-movement pass) ----
// All steering/gait/social-motion knobs in one place. Ranges are [min, max]
// for rand(); times in ms; angles in radians.
const MOTION = {
  ACCEL_MS: 400,               // time from standstill to full speed
  TURN_RATE_SLOW: 4.5,         // rad/s turn cap when (nearly) stopped
  TURN_RATE_FAST: 1.6,         // rad/s turn cap at full speed
  WANDER_JITTER: 1.1,          // rad/s of random heading drift while wandering
  WALL_BIAS_MARGIN: 0.18,      // canvas fraction near a wall where center-bias engages
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
```

- [ ] **Step 2: Add the steering helpers**

In the `// ---- Helpers ----` section of `js/game.js` (after `releaseSocial`), add:

```js
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
```

- [ ] **Step 3: Add the new fields to `createCharacter`**

In `createCharacter` (js/game.js), replace the `targetVx`/`targetVy`/`dirTimer` cluster:

```js
    // Desired velocity — autonomous walk lerps toward this, preventing instant
    // direction flips. dirTimer gates how often the direction can change.
    targetVx: (Math.random() - 0.5) * 2,
    targetVy: (Math.random() - 0.5) * 2,
    dirTimer: rand(0, 1500),
```

with:

```js
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
```

(Keep `dirTimer` for now - the wander rewrite in Task 2 still uses it to gate
activity rolls. Keep the initial `vx`/`vy` lines; they become dead in Task 2.)

- [ ] **Step 4: Expose counters on the debug hook**

In `js/events.js`, change:

```js
window.__off = { trigger: triggerEvent };
```

to:

```js
window.__off = { trigger: triggerEvent, counters: MOTION_COUNTERS };
```

- [ ] **Step 5: Syntax check**

Run: `node --check js/game.js && node --check js/events.js`
Expected: no output (both pass).

- [ ] **Step 6: Browser probe**

```js
JSON.stringify({
  fields: ['heading','curSpeed','targetSpeed','gaitDist','pauseIn','listeningTo']
    .every(k => k in state.chars[0]),
  counters: window.__off.counters,
  turn: turnToward(0, Math.PI, 0.5).toFixed(2),        // "0.50"
  turnWrap: turnToward(0.1, Math.PI * 2 - 0.1, 5).toFixed(2), // "-0.10" (shortest arc)
})
```
Expected: `fields: true`, `counters: {pauses:0,glances:0,convTurns:0}`, `turn: "0.50"`, `turnWrap: "-0.10"`. The app must still run visually as before (nothing consumes the new fields yet).

- [ ] **Step 7: Commit**

```bash
git add js/game.js js/events.js
git commit -m "feat: motion foundation - MOTION constants, steering helpers, character fields"
```

---

### Task 2: Wander kinematics (heading drift, acceleration, capped turns)

**Files:**
- Modify: `js/game.js` - the autonomous-walk branch in `gameLoop` (near line 784), `pointAwayFrom` (near 203), the escape hatch (near 898), `tapGlass` (near 1074), `btnReset` handler (near 1232), `createCharacter` (drop dead lines).

**Interfaces:**
- Consumes: `MOTION`, `turnToward`, `turnRate`, `applyMotion` from Task 1.
- Produces: the wander branch and every departure path drive `c.heading`/`c.targetSpeed` only; `targetVx`/`targetVy` no longer exist anywhere. Later tasks (4, 9) insert code into the rewritten wander branch at the marked comment anchors.

- [ ] **Step 1: Rewrite the autonomous-walk branch**

In `gameLoop`, replace the entire `} else {` wander branch (from `// ---- autonomous walk — always moving, smooth direction changes ----` down to, and including, `c.state = 'walking';` just before the `// ---- ALWAYS:` comment) with:

```js
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

        // [MICRO-PAUSE ANCHOR - Task 4 inserts the pause block here]

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
            MOTION.TURN_RATE_SLOW * 0.4 * (frameDelta / 1000));
        }

        // Obstacle look-ahead: steer away through the turn cap (smooth swerve);
        // if the very next frame would collide, deflect instantly (emergency).
        const lx = c.x + c.vx * dt * 3, ly = c.y + c.vy * dt * 3;
        if (wouldHitObstacle(lx, ly, c.vx, c.vy, obstacles).hit) {
          const away = c.heading + Math.PI * (0.5 + Math.random() * 0.5)
                     * (Math.random() > 0.5 ? 1 : -1);
          if (wouldHitObstacle(c.x + c.vx * dt, c.y + c.vy * dt, c.vx, c.vy, obstacles).hit) {
            c.heading = away; // emergency: about to embed, snap now
          } else {
            c.heading = turnToward(c.heading, away, turnRate(c) * (frameDelta / 1000) * 3);
          }
        }

        stepsAcc += applyMotion(c, dt, frameDelta);
        setFacingFromVX(c, frameDelta);
        c.state = 'walking';
      }
```

Note: `setFacingFromVX` arrives in Task 5; until then use the old line
`if (Math.abs(c.vx) > 0.1) c.facing = c.vx > 0 ? 'right' : 'left';` in its
place and swap it in Task 5.

- [ ] **Step 2: Rewrite `pointAwayFrom`'s velocity setup**

In `pointAwayFrom`, replace:

```js
  const spd = effectiveSpeed(c);
  c.vx = Math.cos(angle) * spd;
  c.vy = Math.sin(angle) * spd;
  c.targetVx = c.vx;
  c.targetVy = c.vy;
```

with:

```js
  const spd = effectiveSpeed(c);
  c.heading = angle;
  c.targetSpeed = spd;
  c.curSpeed = Math.max(c.curSpeed, spd * 0.4); // push off, don't crawl away
  c.vx = Math.cos(angle) * c.curSpeed;
  c.vy = Math.sin(angle) * c.curSpeed;
```

- [ ] **Step 3: Update the remaining `targetVx` sites**

1. Escape hatch (in `gameLoop`, after `clearTarget(c);` in the pinned-character block) - replace:
```js
          const spd = effectiveSpeed(c);
          c.vx = Math.cos(away) * spd; c.vy = Math.sin(away) * spd;
          c.targetVx = c.vx; c.targetVy = c.vy;
          c.dirTimer = 1500;
```
with:
```js
          c.heading = away;
          c.targetSpeed = effectiveSpeed(c);
          c.curSpeed = c.targetSpeed * 0.5;
          c.dirTimer = 1500;
```

2. `tapGlass` curious-walk block - replace:
```js
      const a = Math.atan2(y - cy, x - cx);
      const spd = effectiveSpeed(c);
      c.targetVx = Math.cos(a) * spd;
      c.targetVy = Math.sin(a) * spd;
      c.dirTimer = 2000;
```
with:
```js
      c.heading = Math.atan2(y - cy, x - cx);
      c.targetSpeed = effectiveSpeed(c);
      c.dirTimer = 2000;
```

3. `btnReset` handler - replace:
```js
    const ra = Math.random() * Math.PI * 2;
    c.vx = Math.cos(ra) * c.speed; c.vy = Math.sin(ra) * c.speed;
    c.targetVx = c.vx; c.targetVy = c.vy;
```
with:
```js
    c.heading = Math.random() * Math.PI * 2;
    c.curSpeed = 0;
    c.targetSpeed = c.speed;
```

4. `createCharacter` - delete the now-dead initial `vx`/`vy` random lines and set `vx: 0, vy: 0`.

Then verify no site remains: `rg -n "targetVx|targetVy" js/` must return nothing.

- [ ] **Step 4: Syntax check**

Run: `node --check js/game.js`
Expected: passes.

- [ ] **Step 5: Browser probes (acceleration, bounded turning, no NaN)**

Reload the page, then:

```js
// (a) acceleration: from standstill, speed must ramp, not jump
const c = state.chars[0];
c.pauseTimer = 0; c.curSpeed = 0; c.targetSpeed = 0;
const speeds = [];
pump(1); // one frame
for (let i = 0; i < 20; i++) { pump(1); speeds.push(+Math.hypot(c.vx, c.vy).toFixed(3)); }
// (b) heading delta per frame bounded by jitter + wall bias + swerve
let maxDelta = 0, prev = c.heading;
for (let i = 0; i < 60; i++) { pump(1);
  const d = Math.abs(((c.heading - prev + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  maxDelta = Math.max(maxDelta, d); prev = c.heading; }
JSON.stringify({
  ramps: speeds[2] > 0 && speeds[2] < speeds[10],
  maxHeadingDeltaDeg: (maxDelta * 180 / Math.PI).toFixed(1),
  anyNaN: state.chars.some(o => !Number.isFinite(o.x) || !Number.isFinite(o.heading)),
})
```
Expected: `ramps: true`, `maxHeadingDeltaDeg` under ~25 (emergency deflections excepted - rerun if a collision frame was caught), `anyNaN: false`. Visually: characters wander in curves, accelerate out of conversations, never teleport-turn.

- [ ] **Step 6: Regression probe (departures still work)**

```js
window.__off.trigger('coffee');
await new Promise(r => setTimeout(r, 500));
pump(400); // let the scene gather and finish under manual pumping
JSON.stringify({ sceneOver: !state.activeScene || state.chars.some(c => c.targetX !== null) })
```
Expected: no exceptions; characters gather and later disperse smoothly (visual check with the tab foregrounded is the real gate here).

- [ ] **Step 7: Commit**

```bash
git add js/game.js
git commit -m "feat: steering-based wander - heading drift, acceleration, capped turns"
```

---

### Task 3: Arrive braking in moveToward

**Files:**
- Modify: `js/game.js` - `moveToward` (near line 661).

**Interfaces:**
- Consumes: `MOTION.ARRIVE_RADIUS`, `MOTION.ARRIVE_MIN_FRAC`, `turnToward`, `turnRate`, `applyMotion`.
- Produces: `moveToward(c, tx, ty, d, dt, frameDelta, obstacles)` - NOTE the added `frameDelta` parameter; both call sites in `gameLoop` change accordingly. Return shape `{ stepped, stuck }` is unchanged.

- [ ] **Step 1: Rewrite `moveToward`**

Replace the function body:

```js
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
```

(Until Task 5 lands, keep the old facing line
`c.facing = c.vx > 0 ? 'right' : 'left';` instead of `setFacingFromVX`.)

- [ ] **Step 2: Update both call sites**

In `gameLoop`, both calls gain `frameDelta`:

```js
const r = moveToward(c, partner.x, partner.y, ad, dt, frameDelta, obstacles);
```
```js
const r = moveToward(c, c.targetX, c.targetY, td, dt, frameDelta, obstacles);
```

- [ ] **Step 3: Syntax check**

Run: `node --check js/game.js`
Expected: passes.

- [ ] **Step 4: Browser probe (braking profile)**

```js
const c = state.chars[0];
c.targetX = c.x + 300; c.targetY = c.y; c.targetStuckFrames = 0; c.state = 'walking';
c.curSpeed = 0; c.pauseTimer = 0; c.idleTimer = 0;
const samples = [];
while (c.targetX !== null && samples.length < 400) {
  pump(1);
  samples.push({ d: c.targetX === null ? 0 : Math.hypot(c.targetX - c.x, c.targetY - c.y),
                 s: +c.curSpeed.toFixed(2) });
}
const far = samples.filter(x => x.d > 120).map(x => x.s);
const near = samples.filter(x => x.d < 40 && x.d > 0).map(x => x.s);
JSON.stringify({
  arrived: c.targetX === null,
  fastFar: Math.max(...far) > Math.max(...near),   // slower near target than far away
  nonZeroNear: Math.min(...near) > 0,              // floor keeps it moving
})
```
Expected: `arrived: true, fastFar: true, nonZeroNear: true`.

- [ ] **Step 5: Commit**

```bash
git add js/game.js
git commit -m "feat: arrive braking and capped turn-in for target approaches"
```

---

### Task 4: Micro-pauses with glancing around

**Files:**
- Modify: `js/game.js` - the wander branch (Task 2's `[MICRO-PAUSE ANCHOR]`).

**Interfaces:**
- Consumes: `MOTION.PAUSE_EVERY_MS`, `MOTION.PAUSE_DUR_MS`, `applyMotion`, `MOTION_COUNTERS`, character fields `pauseIn`/`pauseTimer` (Task 1).
- Produces: `MOTION_COUNTERS.pauses` increments; during a pause `c.state === 'idle'` once stopped.

- [ ] **Step 1: Insert the pause block at the anchor**

Replace the `// [MICRO-PAUSE ANCHOR - Task 4 inserts the pause block here]` comment with:

```js
        // Micro-pause: every so often stop, look around, then move on.
        // Wander-only by construction (this branch is never reached during
        // scenes, approaches, or activities).
        if (c.pauseTimer > 0) {
          c.pauseTimer -= frameDelta;
          c.targetSpeed = 0;
          applyMotion(c, dt, frameDelta); // decelerate smoothly to a stop
          if (c.curSpeed < 0.05) {
            c.state = 'idle';
            // Glance: swap the viewed direction roughly twice per pause.
            if (Math.random() < frameDelta / 1200) {
              c.viewDirection = pick(['front', 'side', 'threequarter']);
            }
          }
          if (c.pauseTimer <= 0) {
            c.heading = Math.random() * Math.PI * 2; // depart somewhere new
            c.pauseIn = rand(MOTION.PAUSE_EVERY_MS[0], MOTION.PAUSE_EVERY_MS[1]);
            c.state = 'walking';
          }
          continue;
        }
        c.pauseIn -= frameDelta;
        if (!departing && c.pauseIn <= 0) {
          c.pauseTimer = rand(MOTION.PAUSE_DUR_MS[0], MOTION.PAUSE_DUR_MS[1]);
          MOTION_COUNTERS.pauses++;
          continue;
        }
```

IMPORTANT: do NOT use `continue` here - in this loop `continue` skips the
shared separation/obstacle/clamp section too, and a paused character must
still be pushable by others. Use this `else`-structured form, which replaces
the anchor comment AND the movement code below it (wobble through
`c.state = 'walking';`) in one piece - the final wander branch reads:

```js
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
              MOTION.TURN_RATE_SLOW * 0.4 * (frameDelta / 1000));
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
              c.heading = turnToward(c.heading, away, turnRate(c) * (frameDelta / 1000) * 3);
            }
          }

          stepsAcc += applyMotion(c, dt, frameDelta);
          setFacingFromVX(c, frameDelta);
          c.state = 'walking';
        }
```

Note: `(c.pauseIn -= frameDelta) <= 0` decrements the pause schedule as part
of the check; while `departing`, the schedule simply doesn't tick, so freshly
dispersed characters walk a while before their first pause.

- [ ] **Step 2: Syntax check**

Run: `node --check js/game.js`
Expected: passes.

- [ ] **Step 3: Browser probe**

```js
const c = state.chars[0];
c.idleTimer = 0; c.pauseIn = 0; c.pauseTimer = 0;
pump(2); // triggers the pause
const during = { paused: c.pauseTimer > 0, counter: window.__off.counters.pauses };
pump(150); // ~5s: pause must complete and walking resume
JSON.stringify({ ...during, resumed: c.pauseTimer <= 0 && c.state === 'walking',
  nextScheduled: c.pauseIn >= MOTION.PAUSE_EVERY_MS[0] - 5500 })
```
Expected: `paused: true`, `counter >= 1`, `resumed: true`, `nextScheduled: true`. Visually (foregrounded tab): a character occasionally halts, looks around, walks off in a new direction.

- [ ] **Step 4: Commit**

```bash
git add js/game.js
git commit -m "feat: micro-pauses with glancing during wander"
```

---

### Task 5: Odometer gait and facing/view hysteresis

**Files:**
- Modify: `js/game.js` - `movementSprite` (near line 418), `updateCharDOM` (near line 507), new helper `setFacingFromVX` in the helpers section, swap-in at the two markers left in Tasks 2/3.

**Interfaces:**
- Consumes: `c.gaitDist` (advanced by `applyMotion`), `MOTION.STRIDE_FRAC`, `MOTION.FACING_HOLD_MS`, `MOTION.VIEW_HOLD_MS`.
- Produces: `setFacingFromVX(c, frameDelta)`; `movementSprite(c)` loses its `now` parameter.

- [ ] **Step 1: Add `setFacingFromVX` and switch `movementSprite` to the odometer**

Helpers section:

```js
// Facing follows horizontal velocity, but only after the new direction has
// been sustained — kills sprite flicker when vx hovers around zero.
function setFacingFromVX(c, frameDelta) {
  const want = c.vx > 0.1 ? 'right' : c.vx < -0.1 ? 'left' : c.facing;
  if (want === c.facing) { c.facingHold = 0; return; }
  c.facingHold += frameDelta;
  if (c.facingHold >= MOTION.FACING_HOLD_MS) { c.facing = want; c.facingHold = 0; }
}
```

`movementSprite` - replace the whole function:

```js
// Gait phase comes from distance walked (the odometer applyMotion advances),
// not wall-clock time — feet stop sliding when speed changes.
function movementSprite(c) {
  const frames = SPRITE_MAP[c.type].directions[c.viewDirection].move;
  const stride = SPRITE_H * MOTION.STRIDE_FRAC;
  const phase = ((c.gaitDist + c.movePhaseOffset) % stride) / stride;
  const base = frames[Math.floor(phase * frames.length) % frames.length];
  return directionalSprite(c, base);
}
```

Both existing call sites (`renderCharacter`, `updateCharDOM`) already call it
as `movementSprite(c)` - no caller change needed.

- [ ] **Step 2: View-direction hysteresis in `updateCharDOM`**

Replace `if (walking) c.viewDirection = movementView(c);` with:

```js
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
  }
```

- [ ] **Step 3: Swap in `setFacingFromVX` at the Task 2/3 markers**

Replace the interim facing lines in the wander branch and in `moveToward` with
`setFacingFromVX(c, frameDelta);`.

- [ ] **Step 4: Syntax check**

Run: `node --check js/game.js`
Expected: passes.

- [ ] **Step 5: Browser probe**

```js
const c = state.chars[0];
// (a) gait advances with distance, not time
const g0 = c.gaitDist; pump(30); const walked = c.gaitDist - g0;
c.pauseTimer = 4000; pump(60); const still = c.gaitDist; pump(30); // paused: no gait advance once stopped
// (b) facing hysteresis: a 1-frame vx flip must NOT flip facing
c.pauseTimer = 0; c.state = 'walking';
const f0 = c.facing; c.vx = c.facing === 'left' ? 2 : -2; setFacingFromVX(c, 33);
const flippedTooFast = c.facing !== f0;
JSON.stringify({ gaitMoves: walked > 0, gaitFrozen: Math.abs(c.gaitDist - still) < 1,
                 flickerFree: !flippedTooFast })
```
Expected: `gaitMoves: true, gaitFrozen: true, flickerFree: true`. Visually: change the Speed slider while watching feet - the stride stays glued to the floor; diagonal walkers no longer flicker between side/threequarter views.

- [ ] **Step 6: Commit**

```bash
git add js/game.js
git commit -m "feat: odometer-driven gait and facing/view hysteresis"
```

---

### Task 6: Idle breathing and listener nod (CSS)

**Files:**
- Modify: `css/style.css` - `.character-inner` block (near line 495) and the ghost overrides (near line 605).

**Interfaces:**
- Consumes: existing `.character-inner` / `.character-inner.walking` structure, existing random `animation-delay` set in `renderCharacter`.
- Produces: `@keyframes idleBreath`, `@keyframes listenNod`; selector `.character[data-social="listening"]` consumed by Task 7.

- [ ] **Step 1: Add breathing to idle characters**

After the `.character-inner` rule, add:

```css
/* Idle life: a barely-visible breath so standing characters aren't statues.
   .walking replaces the animation (walkGait), and the ghost rules further
   down override both with ghostFloat, so this only ever runs while idle. */
.character-inner {
  animation: idleBreath 3.5s ease-in-out infinite;
}
@keyframes idleBreath {
  0%, 100% { transform: translateY(0) scaleY(1); }
  50%      { transform: translateY(-0.5px) scaleY(1.005); }
}
```

Note: `.character-inner` already exists - add the `animation` line to the
existing rule instead of a duplicate selector, and put `@keyframes idleBreath`
next to `@keyframes walkGait`. Verify `.character-inner.walking` still declares
its own `animation` (it does: `walkGait`), which overrides the breath.

- [ ] **Step 2: Add the listener nod**

Next to the other character animations:

```css
/* One soft nod when a character becomes the listener in a conversation
   (data-social="listening" set by game.js). Ghost keeps floating instead. */
.character[data-social="listening"]:not([data-type="ghost"]) .character-inner {
  animation: listenNod 1.3s ease-in-out 1, idleBreath 3.5s ease-in-out 1.3s infinite;
}
@keyframes listenNod {
  0%, 100% { transform: rotate(0deg); }
  30%      { transform: rotate(1.6deg); }
  60%      { transform: rotate(-0.6deg); }
}
```

Placement: this rule must appear BEFORE the ghost float overrides in the file
(the ghost selectors have equal specificity and must win via source order); the
`:not([data-type="ghost"])` guard makes the intent explicit either way.

- [ ] **Step 3: Verify in browser**

Reload, watch an idle character (during a micro-pause or conversation): subtle
breath, no jitter. Then run:

```js
const c = state.chars[0];
c.el.dataset.social = 'listening';
getComputedStyle(c.innerEl).animationName   // → "listenNod, idleBreath"
```
Expected: `"listenNod, idleBreath"`. Reset with `c.el.dataset.social = 'independent'`.
Also confirm the ghost still floats (`getComputedStyle` on the ghost's inner el
shows `ghostFloat`).

- [ ] **Step 4: Commit**

```bash
git add css/style.css
git commit -m "feat: idle breathing and listener nod animations"
```

---

### Task 7: Conversation turn-taking and natural parting

**Files:**
- Modify: `js/game.js` - the conversation-start block inside `conversationScan` (near line 972), `updateCharDOM`'s `data-social` line, `pointAwayFrom` (clear `listeningTo`).

**Interfaces:**
- Consumes: `sayFresh`, `pointAwayFrom`, `trackedTimeout`, `MOTION.PART_GAZE_MS`, `MOTION_COUNTERS`, CSS `data-social="listening"` (Task 6), field `listeningTo` (Task 1).
- Produces: conversation timeline A(0) → B(2.6s) → A(5.2s) → parting(7.8s); `data-social` emits `listening`; `MOTION_COUNTERS.convTurns` counts spoken turns.

- [ ] **Step 1: Emit `listening` in `data-social`**

In `updateCharDOM`, replace:

```js
  c.el.dataset.social = c.isChatting
    ? 'chatting'
    : c.approachPartner !== null ? 'approaching' : 'independent';
```

with:

```js
  c.el.dataset.social = c.isChatting
    ? (c.listeningTo ? 'listening' : 'chatting')
    : c.approachPartner !== null ? 'approaching' : 'independent';
```

- [ ] **Step 2: Clear `listeningTo` on release**

In `releaseSocial` (helpers section), add `c.listeningTo = null;` alongside the
other clears.

- [ ] **Step 3: Replace the conversation timeline**

Inside the `conversationScan` block, replace everything from
`sayFresh(a, DIALOGUE_BANKS);` through the `trackedTimeout(... convPairs.delete ...)` call with:

```js
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
```

`pointAwayFrom` already calls `releaseSocial`, which now clears `listeningTo`,
so the stayer keeps `isChatting` (frozen, facing the leaver) until their own
delayed `pointAwayFrom` fires. If the pause button kills these timers,
the existing pause cleanup (releaseSocial + clearTarget for all) unfreezes
everyone - no new handling needed.

- [ ] **Step 4: Syntax check**

Run: `node --check js/game.js`
Expected: passes.

- [ ] **Step 5: Browser probe**

```js
// Force a conversation: put two characters adjacent with ready timers.
const [a, b] = state.chars;
state.convPairs.clear(); state.socialPauseTimer = 0;
a.socialTimer = 0; b.socialTimer = 0; a.activity = null; b.activity = null;
b.x = a.x + 60; b.y = a.y;
const t0 = window.__off.counters.convTurns;
pump(4);                                   // pairing + first turn
const firstTurn = window.__off.counters.convTurns === t0 + 1
  && b.listeningTo === a.name && a.listeningTo === null;
await new Promise(r => setTimeout(r, 2800)); pump(2);
const secondTurn = a.listeningTo === b.name;
await new Promise(r => setTimeout(r, 5400)); pump(30);
JSON.stringify({ firstTurn, secondTurn,
  turns: window.__off.counters.convTurns - t0,      // 3
  parted: !a.isChatting || !b.isChatting })          // at least the leaver left
```
Expected: `firstTurn: true, secondTurn: true, turns: 3, parted: true`. Note: real timers drive the turn delays, so this probe needs the page foregrounded (or accept that pump only advances frames, not `trackedTimeout` - the `setTimeout` waits above handle that).
Visually: two speakers alternate, the listener nods, one walks off first while the other watches.

- [ ] **Step 6: Commit**

```bash
git add js/game.js
git commit -m "feat: conversation turn-taking, listener state, natural parting"
```

---

### Task 8: Staggered dispersal and gather facing

**Files:**
- Modify: `js/game.js` - `disperseCharacters` (near line 223).
- Modify: `js/events.js` - `tickArrival` settle block in `gatherAndChat`.

**Interfaces:**
- Consumes: `pointAwayFrom`, `trackedTimeout`, `MOTION.DISPERSE_STAGGER_MS`.
- Produces: none consumed later; behavior only.

- [ ] **Step 1: Stagger `disperseCharacters`**

Replace the loop body in `disperseCharacters`:

```js
  for (const c of state.chars) {
    pointAwayFrom(c, cx, cy, cooldownMultiplier);
    if (initial) c.socialTimer = socialDelay(INITIAL_SOCIAL_DELAY);
  }
```

with:

```js
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
```

(`trackedTimeout` is correct here: if a new scene or the pause button clears
pending timers, the pause cleanup / beginScene resets already unfreeze the
characters, so a swallowed departure cannot strand anyone.)

- [ ] **Step 2: Face the gathering on arrival**

In `js/events.js`, in `tickArrival`'s settle block, after the existing
`state.chars.forEach(...)` snap loop, add:

```js
      // Everyone turns toward the middle of the gathering instead of keeping
      // whatever facing they walked in with.
      const gcx = state.chars.reduce((s, c) => s + c.x, 0) / state.chars.length;
      state.chars.forEach(c => {
        c.facing = gcx >= c.x + SPRITE_W / 2 ? 'right' : 'left';
      });
```

- [ ] **Step 3: Syntax check**

Run: `node --check js/game.js && node --check js/events.js`
Expected: passes.

- [ ] **Step 4: Browser probe**

```js
window.__off.trigger('meeting');
// wait (foregrounded) until dialogue ends and dispersal starts, then:
const depart = state.chars.map(c => c.departTimer > 0);
// facing check right after settle:
const gcx = state.chars.reduce((s, c) => s + c.x, 0) / state.chars.length;
const facingsOk = state.chars.every(c =>
  (gcx >= c.x + SPRITE_W / 2) === (c.facing === 'right'));
```
The load-bearing verification is visual: trigger `meeting` with the tab
foregrounded - characters turn toward each other when they arrive, and leave
one by one at the end, not in formation. `facingsOk` must be true immediately
after the settle snap.

- [ ] **Step 5: Commit**

```bash
git add js/game.js js/events.js
git commit -m "feat: staggered scene dispersal and gather facing"
```

---

### Task 9: Passerby glances

**Files:**
- Modify: `js/game.js` - shared post-movement section of `gameLoop` (the `// ---- ALWAYS:` block) and the state object (`glanceCooldowns`).

**Interfaces:**
- Consumes: `MOTION.GLANCE_*`, `dist`, `MOTION_COUNTERS`, fields `glanceTimer`/`glanceFacing` (Task 1).
- Produces: `MOTION_COUNTERS.glances` increments; `state.glanceCooldowns` (Map pairKey → epoch ms).

- [ ] **Step 1: Add the cooldown store**

In the `state` object literal, after `convPairs: new Set(),` add:

```js
  glanceCooldowns: new Map(), // pairKey -> epoch ms of last glance roll
```

- [ ] **Step 2: Glance trigger and facing override**

In `gameLoop`, inside the per-character shared section (immediately after the
character-separation `for` loop, before `resolveObstacles`), add:

```js
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
```

- [ ] **Step 3: Syntax check**

Run: `node --check js/game.js`
Expected: passes.

- [ ] **Step 4: Browser probe**

```js
const [a, b] = state.chars;
state.glanceCooldowns.clear();
const g0 = window.__off.counters.glances;
// Walk them through each other repeatedly to beat the 30% probability.
let hits = 0;
for (let i = 0; i < 20; i++) {
  b.x = a.x + 40; b.y = a.y;
  state.glanceCooldowns.clear();
  pump(1);
  if (a.glanceTimer > 0 || b.glanceTimer > 0) hits++;
  a.glanceTimer = 0; b.glanceTimer = 0;
}
JSON.stringify({ counted: window.__off.counters.glances > g0, hits })
```
Expected: `counted: true`, `hits` around 4-12 of 20 (each pass rolls both
characters at ~30%). Visually: two characters crossing paths sometimes turn
their heads toward each other for half a second.

- [ ] **Step 5: Commit**

```bash
git add js/game.js
git commit -m "feat: passerby glances with per-pair cooldown"
```

---

### Task 10: Full regression pass and progress note

**Files:**
- Modify: `progress.md` (append one line).
- No code changes expected; fix regressions here if found.

**Interfaces:**
- Consumes: everything above.
- Produces: verified feature branch ready for PR.

- [ ] **Step 1: Syntax + leftover scan**

```bash
node --check js/game.js && node --check js/events.js && node --check js/data.js
rg -n "targetVx|targetVy|MICRO-PAUSE ANCHOR" js/   # must return nothing
```

- [ ] **Step 2: Full behavior regression in a foregrounded browser tab**

With the page served and visible, verify each item (existing behaviors from
before this feature):

1. Characters wander in curves, accelerate/decelerate, occasionally pause and look around, never jitter-turn or moonwalk.
2. `window.__off.trigger('coffee')`, `('meeting')`, `('birthday')`, `('lampFlicker')` - gathers arrive, face the center, talk in turn, disperse one by one.
3. Donut button: race still resolves, winner eats, others react, dispersal staggered.
4. Pause mid-scene → resume: nobody frozen (`state.chars.every(c => c.idleTimer < 100000)`), no stale bubbles.
5. Speed slider and `?hour=23` night phase still modulate pace; step cadence follows.
6. Drag a furniture piece into a walker's path: smooth swerve, no embedding; pinned-character escape still works (drop a big piece on top of someone).
7. Conversations: three turns, listener nods, natural parting.
8. Counters sane: `window.__off.counters` shows pauses/glances/convTurns all > 0 after a few minutes.

- [ ] **Step 3: Update progress.md**

Append under the existing list:

```markdown
- [x] Natural motion pass: steering wander, arrive braking, micro-pauses, odometer gait, hysteresis, idle breathing, conversation turns, staggered dispersal, glances (spec: docs/superpowers/specs/2026-08-04-natural-motion-design.md).
```

- [ ] **Step 4: Commit**

```bash
git add progress.md
git commit -m "docs: record natural-motion pass in progress log"
```

---

## Out of scope (explicitly)

- Needs/motivation system (deferred pending review of this stage).
- Pathfinding, physics forces model.
- Any color/token or layout changes.
