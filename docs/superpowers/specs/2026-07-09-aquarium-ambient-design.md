# Offquarium: Ambient Aquarium Redesign

**Date:** 2026-07-09
**Repo:** workszop/off
**Goal:** Shift the sim from "small game with buttons" to "office aquarium": the tank
generates moments on its own, the user mostly observes, and interaction is limited to
tapping the glass. Six workstreams: idle vignettes, autonomous events, day rhythm,
tap-the-glass interaction, persistence + diary, and a paper-puppet walking gait.

## Constraints

- Pure vanilla HTML/CSS/JS, no build step (unchanged).
- No new binary assets. All new visuals are CSS or inline SVG.
- Existing systems are reused wherever possible: target-walking, obstacle avoidance,
  scripted-scene machinery (gather + turn-based dialogue), bubbles, stats.
- Changes land via PR(s) on branch `aquarium-ambient`, browser-verified before push.

## File structure

`js/game.js` (1,670 lines) splits into three plain scripts, loaded in order by
`index.html`:

1. **`js/data.js`** — all static data: `DIALOGUE_BANKS`, `GREETINGS`,
   `COFFEE_DIALOGUE`, `MEETING_DIALOGUE`, `COLORS`, ghost SVG URIs, `SPRITE_MAP`,
   plus new `ACTIVITIES`, `EVENT_DECK`, `DAY_PHASES`, `MOOD_WORDS`, and new dialogue
   banks (printer jam, birthday, donut, lamp flicker, activity lines).
2. **`js/game.js`** — state, character factory, game loop, movement, DOM rendering,
   chat, control panel, tap-the-glass input.
3. **`js/events.js`** — event scheduler, scripted scenes (moved), activity engine,
   diary, persistence, fast-forward, day-phase controller.

Globals are shared across files (existing style). Each file passes `node --check`.

## A. Idle vignettes (activity engine)

New character state `'activity'`, driven by an `ACTIVITIES` table in `data.js`:

```js
ACTIVITIES = {
  desk_cluster:   { spot: {dx: 0.5, dy: 1.05}, label: 'typing at a desk',   dur: [15000, 40000], weight: 3 },
  coffee_station: { spot: {dx: 0.5, dy: 1.05}, label: 'getting a coffee',   dur: [8000, 15000],  weight: 2 },
  plant_snake:    { spot: {dx: 0.5, dy: 1.05}, label: 'watering the plant', dur: [6000, 12000],  weight: 1 },
  printer:        { spot: {dx: 0.5, dy: 1.05}, label: 'printing something', dur: [6000, 12000],  weight: 2 },
  couch_2seater:  { spot: {dx: 0.35, dy: 0.8}, label: 'dozing on the couch',dur: [20000, 50000], weight: 2 },
  whiteboard:     { spot: {dx: 0.5, dy: 1.1},  label: 'staring at the whiteboard', dur: [10000, 25000], weight: 2 },
}
```

- `spot` is a fractional offset relative to the furniture rect (`furniturePieces`
  already stores `rx, ry, pw, ph`); the resolved point is nudged to a free spot via
  the existing `safeGatherPoint()`.
- Idle characters roll for an activity instead of (some) wander targets: when a
  wander decision fires, ~40% of rolls pick a weighted activity (day-phase multiplier
  applies), walk there, then hold.
- While holding: state `'activity'`, idle sprite, no walk animation, facing toward
  the furniture. Every 8–20 s a small chance to speak an activity line from
  `ACTIVITY_LINES[activityKey][charType]` (3+ lines per character per activity;
  ghost gets "uhu" variants). Bubbles reuse `showBubble`.
- Couch dozing shows a drifting "💤" as the bubble text and suppresses chat triggers.
- A character in an activity can still be pulled into a scene/event (scene code
  already force-targets characters); the activity is cancelled cleanly.
- Concurrency guard: max one character per furniture piece at a time.
- Each completed activity appends a diary entry and bumps a stat where sensible
  (coffee activity bumps the existing coffee stat).

**Printer jam:** when the printer activity ends, 15% chance of a jam: the printing
character says a jam line, 1–2 nearest free characters walk over (reuse gather
targeting), everyone plays 1 cycle of `PRINTER_JAM_DIALOGUE`, diary entry
("14:03 — printer jammed; Andy blamed the ghost").

## B. Autonomous events (scheduler)

`events.js` runs a scheduler tick every 15 s (tracked timer, paused with the sim):

- A roll fires on average every 2–4 minutes (per-event cooldowns prevent repeats).
- Weighted `EVENT_DECK`:
  - **coffee** (weight 4) — existing coffee scene, unchanged mechanics.
  - **meeting** (weight 3) — existing meeting scene.
  - **birthday** (weight 1, ≥20 min cooldown) — gather at the café table, a 🎂
    element appears on the table for the scene, `BIRTHDAY_DIALOGUE` cycle.
  - **lamp flicker** (weight 2, needs ghost visible or forces it visible) — the arc
    lamp element gets a 2 s CSS flicker animation; ghost says "UHU?!"; each human in
    the office says one `LAMP_FLICKER_DIALOGUE` line ("did it just get cold in
    here?"). No gathering — reactions happen in place.
- Events are suppressed while `state.activeScene` is true or the sim is paused.
- Every event appends a diary entry and bumps stats (coffee/meetings reuse existing
  counters; a new `events` counter covers the rest).
- The **Coffee** and **Meeting** buttons are removed from the panel (the deck owns
  them now). A debug hook `window.__off.trigger(name)` fires any event for testing.

## C. Day rhythm

`DAY_PHASES` (real local clock, checked once a minute; `?hour=N` URL param overrides
for testing):

| phase     | hours  | tint (overlay)            | multipliers                                  |
|-----------|--------|---------------------------|----------------------------------------------|
| morning   | 7–11   | none                      | events ×1.2, chat ×1.0, speed ×1.1           |
| midday    | 11–14  | warm +5%                  | events ×1.0, chat ×1.2, speed ×1.0           |
| afternoon | 14–17  | none                      | events ×0.8, chat ×0.8, speed ×0.85 (slump)  |
| evening   | 17–21  | warm dusk (orange 8%)     | events ×0.7, chat ×0.7, speed ×0.9           |
| night     | 21–7   | dark blue 25% + dimmed bg | events ×0.4, chat ×0.4, speed ×0.7           |

- Implementation: one full-canvas overlay `div` whose background color/opacity is set
  from the phase (CSS transition 3 s, `pointer-events: none`).
- **Night is ghost time:** ghost visible-interval range doubles, hidden-interval
  range halves, ghost speed ×1.3, and lamp-flicker weight ×3. Humans' multipliers
  above make them sluggish and quiet.
- Phase changes append a diary entry ("evening settles over the office").

## D. Tap the glass (interaction reshape)

Removed: WASD/arrow character control, click-floor-to-command, the selection ring
semantics tied to control.

New:

- **Click floor** = tap on the glass: a small ripple dot renders at the click;
  characters within ~220 px turn to face the point; each has a 30% chance to wander
  toward it (normal wander, not a command).
- **Click character** (or focus + Enter — characters stay keyboard-focusable) opens
  an **observation card** anchored near them: name, current activity label
  ("wandering", "chatting with Jazz", "dozing on the couch"), and a mood word.
  Mood is cosmetic, derived from recent history: "caffeinated" for 5 min after
  coffee, "grumpy" for 5 min after a printer jam, "festive" after birthday, else a
  per-character default rotation from `MOOD_WORDS`. Ghost card shows "uhu" for
  everything. Card dismisses on outside click / Escape / 8 s timeout.
- **🍩 Drop a donut** button (panel): places a donut emoji element at a random free
  floor spot; all free characters gather (reuse gather machinery), play
  `DONUT_DIALOGUE`, donut disappears, diary entry. 3 min cooldown on the button.
- Panel slims down: Play/Pause and 🍩 stay visible; the speed and chat-frequency
  sliders move into a small ⚙ popover. Stats stay. The "How to Play" modal text in
  `index.html` is rewritten for the new model (watch, tap the glass, click a
  character to peek, drop a donut).

## E. Persistence, diary, while-you-were-away

- **Persistence:** `stats`, a `dayCount` (increments on first visit of a calendar
  day), and the diary buffer persist to localStorage key `offquarium-v1` (existing
  safe `lsGet`/`lsSet` helpers; debounced writes). Stats panel header shows
  "Day N".
- **Diary:** capped ring buffer (last 50 entries, `{t, text}`), rendered newest-first
  in a collapsible "📓 Office diary" section under the stats. Sources: events,
  printer jams, completed activities (sampled — not every one), phase changes, ghost
  appearances (sampled), fast-forward summaries.
- **Fast-forward:** on `visibilitychange` → visible (and on load with a stored
  `lastSeen`), compute elapsed hidden time. If > 60 s: estimate event/conversation
  counts from the scheduler's average rates × phase multipliers over the elapsed
  span, bump stats, append up to 5 plausible diary entries with interpolated
  timestamps, and show a dismissible toast: "While you were away: 7 conversations,
  2 coffees, the ghost appeared 3 times." No actual simulation runs while hidden.

## F. Walking gait (Level 1, no new art)

- **Rock + bob:** `.character-inner.walking` gets a combined keyframe: existing
  ±3 px bob plus ±2.5° rotation, `transform-origin: 50% 92%` (pivot at the feet),
  rotation phase-shifted against the bob so weight visibly transfers.
- **Grounded shadow:** a `::before` ellipse under the feet (soft radial gradient)
  that scales 1 → 0.85 in counter-phase with the bob. Also rendered (static, softer)
  when idle. The ghost gets no contact shadow; instead its whole sprite floats on a
  slow 3 s sine drift and its walk uses no rock (ghosts don't step).
- **Cadence from speed:** JS sets `--step-dur` on each character element from
  `c.speed × state.walkSpeed` (recomputed when the slider moves); the walk animation
  uses `animation-duration: var(--step-dur)`. Faster walk = faster steps.
- **Desync:** each character gets a random negative `animation-delay` at creation.

## Out of scope

Two-frame step sprites (Level 2 — follow-up PR), sound, real weather, visible
mood/relationship meters, mobile-specific work beyond what already exists.

## Verification

- `node --check` on all three JS files.
- Browser session against a local static server:
  - `?hour=9|13|15|19|23` shows each tint; night shows ghost-heavy behavior.
  - `window.__off.trigger('birthday')` etc. fires each event; diary fills; stats bump.
  - Activities: characters visibly sit/stand at furniture and speak activity lines.
  - Tap floor → glances; click character → observation card; 🍩 → gather.
  - Hide tab ≥ 60 s → return shows toast + diary entries; reload keeps stats and
    "Day N".
  - Gait: rock/bob/shadow present, cadence follows the speed slider, no sync-marching.
  - Zero console errors throughout.
