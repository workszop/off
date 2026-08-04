# Natural Motion and Social Behavior - Design

Date: 2026-08-04
Status: approved (sections reviewed in-session)
Scope: Stage 1 of the naturalness pass - movement kinematics and social interactions.
A needs-driven motivation layer was explicitly deferred: the decision on its depth
will be made after this stage ships and can be observed.

## Problem

Characters move like particles, not people:

- constant speed, instant starts and dead stops (`moveToward` runs at full speed
  until `td < 10`, then zeroes velocity),
- direction changes are random angle jumps every 1.2-3.2 s, up to full reversals,
- the wander loop guarantees perpetual motion (minimum-speed clause), so nobody
  ever stands still,
- gait phase is wall-clock based, so feet slide when speed changes,
- `facing`/`viewDirection` flip instantly at velocity thresholds and flicker on
  diagonal movement,
- conversations freeze both characters in place for 6 s with two bubbles, then
  both leave simultaneously; scene dispersal starts everyone on the same frame.

## Goals

Perceived naturalness of motion and social behavior, with zero architecture
change: everything stays in the existing `state.chars` objects and the existing
`gameLoop` branches in `js/game.js` plus scene code in `js/events.js`.

## Non-goals

- No needs/motivation system (deferred decision).
- No pathfinding.
- No physics engine (forces/mass model was considered and rejected: tuning cost
  disproportionate for four characters).

## Design

### 1. Wander kinematics

New per-character motion state: `heading` (radians), `curSpeed` (px/frame),
`targetSpeed`. `vx/vy` become derived each frame: `cos/sin(heading) * curSpeed`.
The autonomous-walk branch changes from velocity-target lerping to:

- heading drifts by bounded per-frame noise (random walk on the angle), with a
  gentle bias toward the room center when close to a wall (replaces the random
  "centre drift" events),
- `curSpeed` approaches `targetSpeed` under an acceleration cap (full speed in
  roughly 0.4 s; symmetric deceleration),
- `targetSpeed` oscillates slowly at +/-15% around `effectiveSpeed(c)` with a
  per-character phase, so each character keeps a slightly different pace,
- turn rate is capped, and the cap shrinks as speed grows: fast characters carve
  arcs, slow ones can turn in place. The existing obstacle look-ahead now sets a
  desired heading only; the turn cap turns avoidance into a smooth swerve. The
  emergency instant deflection stays for imminent (next-frame) collisions.

`pointAwayFrom` sets `heading` (and `curSpeed`) directly; departures behave as
today. NaN guard on `heading` (atan2 of a zero vector falls back to a random
angle).

### 2. Arrive (target approach)

`moveToward` gains a braking zone of ~80 px (roughly `SPRITE_H * 0.5`): speed
scales down with distance, floored at 25% of full speed so the stuck detection
(no-progress frames) keeps working. Heading toward the target also passes
through the turn cap. Applies to social approaches, scene gathers, and activity
walks - characters walk up to a spot instead of driving into it and stopping
dead.

### 3. Micro-pauses and glancing around

While wandering (and only there - never during scenes, approaches, or
activities), roughly every 10-25 s a character decelerates to a stop, stands
for 1-3 s, changes `viewDirection` once or twice (looking around), then departs
in a new heading. The minimum-speed guarantee in the wander branch is removed;
stopping is now a legal, intentional state.

### 4. Odometer gait + facing hysteresis

- Gait phase derives from distance walked (`c.gaitDist` accumulated from actual
  displacement, divided by a stride length constant), replacing the wall-clock
  cycle in `movementSprite`. Feet stop sliding when speed changes; stopping
  freezes the cycle where it is (the idle sprite takes over anyway).
- `facing` and `viewDirection` only switch after the new direction has been
  sustained for ~200 ms, removing sprite flicker at the `movementView`
  thresholds during diagonal or slow movement.

### 5. Idle breathing (CSS only)

Non-walking characters get an `idleBreath` animation (~3.5 s ease-in-out loop:
translateY(-0.5px) plus a barely visible scaleY), reusing the existing random
`animation-delay` so characters never breathe in sync. The ghost keeps its float
animation instead. `prefers-reduced-motion` already disables all animations.

### 6. Social interactions

- **Turn-taking in conversations**: instead of A(0 s), B(3 s), end(6 s), the
  exchange becomes A, then B, then a short comeback from A. The listener carries
  `data-social="listening"` during the speaker's turn and plays one subtle CSS
  nod. Total duration stays ~8 s.
- **Natural parting**: a randomly chosen member of the pair leaves first; the
  other faces the leaver for ~1 s before departing. Scene dispersal (`disperseCharacters` and scene
  ends) staggers departures across a 0-1.8 s window per character.
- **Passerby glances**: when two non-interacting characters pass within ~1.2
  sprite widths, with ~30% probability one briefly faces the other for ~0.5 s
  (facing only - the walk path is unchanged), with a per-pair cooldown of 10+ s.
  Disabled during scenes and chats.
- **Gather orientation**: on arriving at a scene gather spot, a character turns
  to face the centroid of the gathering instead of keeping its last walking
  facing.

### 7. Tuning and verification

- All new constants live in a single `MOTION` block at the top of `js/game.js`:
  acceleration, turn-rate caps, stride length, speed-oscillation amplitude and
  period, pause frequency and duration, glance range/probability/cooldown,
  arrive radius and floor, parting delays.
- Debug counters exposed on `window.__off` (pauses, glances, conversation
  turns) so browser probes can verify behavior without scraping the UI.
- DOM contract addition: `data-social` gains the `listening` value.
- Verification: in-browser probes via the local server (speed profiles show
  acceleration; heading delta per frame stays under the cap; pauses and glances
  occur at plausible rates; conversation timeline has three turns), plus visual
  inspection. Existing behaviors re-verified after the change: obstacle
  avoidance, stuck escapes, scene gathers, donut race, pause/resume.

## Files touched

- `js/game.js` - motion state, wander branch rewrite, `moveToward` arrive,
  gait/facing changes, MOTION constants, debug counters.
- `js/events.js` - staggered dispersal, conversation turns, parting, gather
  facing.
- `css/style.css` - `idleBreath`, listener nod, no color/token changes.
- `index.html` - none expected.
