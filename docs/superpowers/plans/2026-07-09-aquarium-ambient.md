# Ambient Aquarium Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Office Friends into an ambient "office aquarium": the tank generates moments on its own (activities, events, day rhythm), the user mostly observes, and interaction shrinks to tapping the glass, peeking at a character, and dropping a donut.

**Architecture:** Split the single `js/game.js` (1,669 lines) into three plain scripts loaded in order — `js/data.js` (static data), `js/game.js` (state + loop + rendering + input), `js/events.js` (scheduler, scenes, activities, diary, persistence, day rhythm). Globals are shared across files (existing style). `events.js` functions are only called from inside the rAF loop, timers, or listeners — never from `game.js` top-level init — so script load order is safe.

**Tech Stack:** Vanilla HTML/CSS/JS, no build step, no dependencies, no test framework. Verification per task = `node --check` on every JS file + a scripted browser check against `python3 -m http.server`. Pure helpers additionally get `node -e` micro-tests.

**Spec:** `docs/superpowers/specs/2026-07-09-aquarium-ambient-design.md`

## Global Constraints

- Pure vanilla HTML/CSS/JS, no build step.
- **No new binary assets.** All new visuals are CSS or inline SVG (data URIs, same pattern as the ghost sprites in `js/game.js:366-383`).
- Reuse existing systems: target-walking, obstacle avoidance, `gatherAndChat`, `showBubble`, `safeGatherPoint`, `trackedTimeout`, bubbles, stats.
- Script load order in `index.html`: `data.js`, `game.js`, `events.js`. `game.js` top-level init must never call an `events.js` function.
- localStorage key: `offquarium-v1`. Use existing `lsGet`/`lsSet` helpers only.
- Every JS file passes `node --check` after every task.
- Zero console errors in the browser check of every task.
- Branch: `aquarium-ambient`. One commit per task, message prefix `feat:`/`refactor:` as noted.

## Testing model (read once)

There is no test framework in this repo and the code is DOM-bound; the project's established verification (see spec §Verification) is syntax check + browser. Every task therefore ends with:

1. `node --check js/data.js && node --check js/game.js && node --check js/events.js` → expect silence (exit 0).
2. Browser check: `python3 -m http.server 8000 --directory /home/andrzey/git-claude/off` then drive `http://localhost:8000` (Claude-in-Chrome or manual), with the task's explicit expected observations, and `read_console_messages` → expect zero errors.

Pure functions (weighted pick, diary ring buffer, fast-forward estimator) get a `node -e` micro-test written BEFORE the implementation (red → green), since they don't touch the DOM.

---

### Task 1: Split game.js into data.js / game.js / events.js (pure move)

**Files:**
- Create: `js/data.js`
- Create: `js/events.js`
- Modify: `js/game.js` (remove moved blocks)
- Modify: `index.html:161` (script tags)

**Interfaces:**
- Consumes: current `js/game.js` (single file, 1,669 lines).
- Produces: three globals-sharing scripts. `data.js` defines `DIALOGUE_BANKS`, `GREETINGS`, `COFFEE_DIALOGUE`, `MEETING_DIALOGUE`, `COLORS`, `_svg`, `GHOST_IDLE_URI`, `GHOST_WALK_URI`, `SPRITE_MAP`, `spriteTransform`, `FURNITURE_PALETTE`. `events.js` defines `SCENE_LINE_GAP_MS`, `SCENE_CYCLE_PAUSE_MS`, `SCENE_ARRIVAL_TIMEOUT_MS`, `SCENE_ARRIVAL_POLL_MS`, `gatherAndChat(positions, dialogueBank, lineCount)`, `coffeeGatherPositions()`, `meetingGatherPositions()`. Everything else stays in `game.js`. **No behavior change.**

- [ ] **Step 1: Create `js/data.js`** — move these blocks verbatim from the current `js/game.js` (line numbers refer to the file as of commit `245ade3`):
  - Header comment lines 1–4 (adapt to `// Office Friends — static data`).
  - Lines 6–412: `DIALOGUE_BANKS`, `GREETINGS`, `COFFEE_DIALOGUE`, `MEETING_DIALOGUE`, `COLORS`, `_svg` + `GHOST_IDLE_URI` + `GHOST_WALK_URI` (with their comment), `SPRITE_MAP`, `spriteTransform`.
  - Lines 1498–1512: the `FURNITURE_PALETTE` comment + array.

- [ ] **Step 2: Create `js/events.js`** — move verbatim from current `js/game.js`:
  - Lines 1291–1384: the scripted-scenes comment block, `SCENE_LINE_GAP_MS`, `SCENE_CYCLE_PAUSE_MS`, `SCENE_ARRIVAL_TIMEOUT_MS`, `SCENE_ARRIVAL_POLL_MS`, `gatherAndChat`, `coffeeGatherPositions`, `meetingGatherPositions`.
  - Top-of-file header: `// Office Friends — events, scenes, ambient systems`.
  - Note: the `btnCoffee`/`btnMeeting` listeners (lines 1386–1395) STAY in `game.js` for now — they call `gatherAndChat` only on click, which happens after all scripts load. (They are deleted entirely in Task 6.)

- [ ] **Step 3: Delete the moved blocks from `js/game.js`** (lines 6–412, 1291–1384, 1498–1512 of the original). Everything else — constants, `state`, DOM refs, helpers, factory, rendering, loop, handlers, panel wiring, furniture placement code, init — stays.

- [ ] **Step 4: Update `index.html`** — replace line 161:

```html
  <script src="js/data.js"></script>
  <script src="js/game.js"></script>
  <script src="js/events.js"></script>
```

- [ ] **Step 5: Syntax check**

Run: `node --check js/data.js && node --check js/game.js && node --check js/events.js && echo OK`
Expected: `OK`

- [ ] **Step 6: Browser check** — load the page. Expected: 4 characters wander exactly as before; click a character → greeting bubble + ring; Coffee and Meeting buttons still gather everyone and run dialogue; furniture palette places pieces; zero console errors.

- [ ] **Step 7: Commit**

```bash
git add js/data.js js/events.js js/game.js index.html
git commit -m "refactor: split game.js into data.js / game.js / events.js"
```

---

### Task 2: New static data in data.js

**Files:**
- Modify: `js/data.js` (append at end)

**Interfaces:**
- Produces (all globals, consumed by Tasks 4–10): `ACTIVITIES`, `ACTIVITY_LINES`, `PRINTER_JAM_DIALOGUE`, `BIRTHDAY_DIALOGUE`, `LAMP_FLICKER_DIALOGUE`, `DONUT_DIALOGUE`, `EVENT_DECK`, `DAY_PHASES`, `MOOD_WORDS`. Shapes exactly as written below — later tasks index them with these exact keys.

- [ ] **Step 1: Append activity data to `js/data.js`:**

```js
// ---- Ambient activities (idle vignettes) ----
// spot = fractional offset inside the furniture rect; the character's box is
// placed so its bottom edge lands at ry + dy*ph, centered at rx + dx*pw,
// then nudged to a free spot via safeGatherPoint().
const ACTIVITIES = {
  desk_cluster:   { spot: { dx: 0.5,  dy: 1.05 }, label: 'typing at a desk',          dur: [15000, 40000], weight: 3 },
  coffee_station: { spot: { dx: 0.5,  dy: 1.05 }, label: 'getting a coffee',          dur: [8000, 15000],  weight: 2 },
  plant_snake:    { spot: { dx: 0.5,  dy: 1.05 }, label: 'watering the plant',        dur: [6000, 12000],  weight: 1 },
  printer:        { spot: { dx: 0.5,  dy: 1.05 }, label: 'printing something',        dur: [6000, 12000],  weight: 2 },
  couch_2seater:  { spot: { dx: 0.35, dy: 0.8 },  label: 'dozing on the couch',       dur: [20000, 50000], weight: 2 },
  whiteboard:     { spot: { dx: 0.5,  dy: 1.1 },  label: 'staring at the whiteboard', dur: [10000, 25000], weight: 2 },
};

// 3+ lines per character per activity; ghost is always "uhu" variants.
const ACTIVITY_LINES = {
  desk_cluster: {
    andy: ["Row 4,000 of the spreadsheet. Send help.", "I've typed 'per my last email' three times today.", "This keyboard owes me an apology."],
    jazz: ["Inbox zero by lunch. Watch me.", "Color-coding this doc is self-care.", "One more slide. Okay, four more slides."],
    olex: ["It compiles. I don't trust it.", "Renaming variables counts as work.", "This function is 300 lines and afraid of nothing."],
    ghost: ["uhu...", "uhu uhu", "...uhu"],
  },
  coffee_station: {
    andy: ["Third cup. The report demands it.", "The machine hissed at me. Fair.", "Decaf? In this economy?"],
    jazz: ["Oat milk foam is an art form.", "Anyone else want one while I'm up?", "This mug sparks joy. The coffee sparks me."],
    olex: ["Bean water refill protocol initiated.", "The machine's uptime beats our CI.", "Caffeine is a dependency I've accepted."],
    ghost: ["uhu ☕", "uhu?", "uhuuu"],
  },
  plant_snake: {
    andy: ["Drink up. You're the stable one here.", "This plant has outlasted three managers.", "Am I overwatering? Blink once for yes."],
    jazz: ["Who's a thriving little succulent? You are.", "I named it Beyoncé. Obviously.", "New leaf! Everyone, NEW LEAF!"],
    olex: ["Photosynthesis: still the best energy pipeline.", "Watering schedule is in the shared calendar.", "The plant does nothing and is thriving. Noted."],
    ghost: ["uhu 🌱", "...uhu", "uhu uhu"],
  },
  printer: {
    andy: ["Please just print. I'll say nice things about you.", "Tray 2 is a myth.", "It smells fear. Stay calm."],
    jazz: ["Printing the birthday calendar! Finally!", "Double-sided, stapled, dreams achieved.", "Why is it warming up? It's been on all day."],
    olex: ["PC LOAD LETTER. Classic.", "The printer firmware is older than my career.", "Print queue depth: 14. Confidence: low."],
    ghost: ["uhu?", "uhu uhu uhu", "UHU"],
  },
  couch_2seater: {
    andy: ["Just resting my eyes. For a quarter.", "The couch understands me.", "Five minutes. Maybe forty."],
    jazz: ["Power nap! It's in my calendar as 'strategy'.", "This cushion is my emotional support cushion.", "Wake me if anything fun happens."],
    olex: ["Entering low-power mode.", "The couch has better ergonomics than my chair.", "Background processes only."],
    ghost: ["uhu...", "uhuuuu", "...uhu..."],
  },
  whiteboard: {
    andy: ["Whose diagram is this? Whose ARE any of these?", "The arrow just points at another arrow.", "I understand nothing and it's beautiful."],
    jazz: ["We should really erase Q3.", "I'm adding a smiley to the roadmap.", "This brainstorm has been 'live' since March."],
    olex: ["That architecture cannot work. I'll allow it.", "Someone drew the database as a cloud. Bold.", "Do not erase. Do not implement either."],
    ghost: ["uhu?", "...uhu", "uhu uhu"],
  },
};
```

- [ ] **Step 2: Append event dialogue banks:**

```js
// ---- Event dialogue ----
const PRINTER_JAM_DIALOGUE = {
  andy: ["It jammed. Of course it jammed. It saw me coming.", "I blame the ghost. This has ghost energy.", "There is no paper IN tray 2!"],
  jazz: ["Okay okay — everyone stay calm, I know the trick.", "You just have to open it and say something kind.", "I'm laminating a sign about this."],
  olex: ["Have you tried turning the printer off and on again?", "Jam location: sector 7. As always.", "I'll add it to the incident channel."],
  ghost: ["uhu?!", "uhu uhu!", "...uhu"],
};
const BIRTHDAY_DIALOGUE = {
  andy: ["Wait — whose birthday is it? I signed the card blind.", "Cake at 3pm is the best meeting of the quarter.", "I only came for the icing. And the friendship. Mostly icing."],
  jazz: ["SURPRISE! Okay it's not a surprise, I sent three reminders.", "Make a wish! Something with reasonable scope!", "There's a vegan slice, I checked twice."],
  olex: ["Statistically someone's birthday was inevitable.", "The candles are a fire-code discussion for another day.", "Happy birthday. The cake-to-meeting ratio today is acceptable."],
  ghost: ["UHU!", "uhu uhu uhu!", "uhu 🎂"],
};
const LAMP_FLICKER_DIALOGUE = {
  andy: ["Did it just get cold in here?", "The lamp's doing the thing again. Gerald?", "I'm sure that's just the wiring. I'm sure. I'm sure."],
  jazz: ["I KNEW this office was haunted. I knew it!", "Everyone say hi so it knows we're friendly!", "That's the second floor ghost. They visit."],
  olex: ["Voltage fluctuation. Probably.", "Adding 'haunted' to the facilities ticket.", "If it flickers in binary I'm listening."],
  ghost: ["UHU?!", "uhu!!", "UHU UHU"],
};
const DONUT_DIALOGUE = {
  andy: ["A donut just... appeared? Not questioning it.", "Dibs on the sprinkles half.", "This undoes the whole morning. Thank you."],
  jazz: ["DONUT! Office morale +10!", "We split it four ways, no arguments.", "Someone out there loves us."],
  olex: ["Donut acquired. Source: unknown. Risk: acceptable.", "The torus is the perfect pastry topology.", "I'll log this as a production sugar incident."],
  ghost: ["uhu 🍩", "uhu uhu", "UHU!"],
};
```

- [ ] **Step 3: Append event deck, day phases, mood words:**

```js
// ---- Autonomous event deck ----
// cooldownMs = per-event minimum gap between firings.
const EVENT_DECK = [
  { key: 'coffee',      weight: 4, cooldownMs: 5 * 60 * 1000 },
  { key: 'meeting',     weight: 3, cooldownMs: 8 * 60 * 1000 },
  { key: 'birthday',    weight: 1, cooldownMs: 20 * 60 * 1000 },
  { key: 'lampFlicker', weight: 2, cooldownMs: 4 * 60 * 1000 },
];

// ---- Day rhythm (real local clock) ----
// from = first hour of the phase (24h). tint/tintOpacity drive #dayOverlay.
// ghostVis/ghostHid scale the ghost's visible/hidden interval ranges;
// ghostSpeed scales ghost walk speed; lampWeight scales the lampFlicker deck weight.
const DAY_PHASES = [
  { key: 'morning',   from: 7,  to: 11, tint: 'transparent',          tintOpacity: 0,    events: 1.2, chat: 1.0, speed: 1.1,  ghostVis: 1, ghostHid: 1,   ghostSpeed: 1,   lampWeight: 1 },
  { key: 'midday',    from: 11, to: 14, tint: '#FFB347',              tintOpacity: 0.05, events: 1.0, chat: 1.2, speed: 1.0,  ghostVis: 1, ghostHid: 1,   ghostSpeed: 1,   lampWeight: 1 },
  { key: 'afternoon', from: 14, to: 17, tint: 'transparent',          tintOpacity: 0,    events: 0.8, chat: 0.8, speed: 0.85, ghostVis: 1, ghostHid: 1,   ghostSpeed: 1,   lampWeight: 1 },
  { key: 'evening',   from: 17, to: 21, tint: '#E8722C',              tintOpacity: 0.08, events: 0.7, chat: 0.7, speed: 0.9,  ghostVis: 1, ghostHid: 1,   ghostSpeed: 1,   lampWeight: 1 },
  { key: 'night',     from: 21, to: 7,  tint: '#1B2A4A',              tintOpacity: 0.25, events: 0.4, chat: 0.4, speed: 0.7,  ghostVis: 2, ghostHid: 0.5, ghostSpeed: 1.3, lampWeight: 3 },
];

// ---- Observation-card mood words (default rotation per character) ----
const MOOD_WORDS = {
  andy: ['coping', 'peckish', 'contemplative', 'circling back'],
  jazz: ['sparkling', 'organized', 'plotting a surprise', 'cozy'],
  olex: ['compiling', 'skeptical', 'optimizing', 'low power'],
  ghost: ['uhu'],
};
```

- [ ] **Step 4: Syntax check** — `node --check js/data.js && echo OK` → `OK`.

- [ ] **Step 5: Data sanity micro-test:**

Run:
```bash
node -e "
eval(require('fs').readFileSync('js/data.js','utf8').replace(/^const /gm,'globalThis.'));
const assert = require('assert');
for (const k of Object.keys(ACTIVITIES)) {
  assert(ACTIVITY_LINES[k], 'lines for '+k);
  for (const t of ['andy','jazz','olex','ghost']) assert(ACTIVITY_LINES[k][t].length >= 3, k+'/'+t);
}
for (const bank of [PRINTER_JAM_DIALOGUE, BIRTHDAY_DIALOGUE, LAMP_FLICKER_DIALOGUE, DONUT_DIALOGUE])
  for (const t of ['andy','jazz','olex','ghost']) assert(bank[t].length >= 3, t);
assert.equal(EVENT_DECK.length, 4);
assert.equal(DAY_PHASES.length, 5);
console.log('DATA OK');
"
```
Expected: `DATA OK`. (Note: `eval` trick is needed because data.js has no exports; the regex only rewrites top-level `const` for this check. If the replace approach fails on this file, wrap with `vm.runInNewContext` instead — same assertions.)

- [ ] **Step 6: Browser check** — page still behaves identically (data is unused so far); zero console errors.

- [ ] **Step 7: Commit**

```bash
git add js/data.js
git commit -m "feat: add ambient data — activities, event deck, day phases, moods, dialogue"
```

---

### Task 3: Furniture types, inline-SVG printer & whiteboard, default office layout

Activities and events target furniture by type, but pieces currently store no type and nothing is auto-placed. This task makes furniture addressable and guarantees a starter layout.

**Files:**
- Modify: `js/data.js` (FURNITURE_PALETTE entries + 2 new items)
- Modify: `js/game.js` (`placeFurniturePiece`, new `initDefaultOffice`, init block)

**Interfaces:**
- Consumes: `FURNITURE_PALETTE`, `furniturePieces`, `placeFurniturePiece(def)`, `_svg()` from data.js.
- Produces: each entry of `FURNITURE_PALETTE` gains `type` (string). Each piece in `furniturePieces` gains `type` (string) and `el` (its DOM element). `placeFurniturePiece(def, atRx, atRy)` accepts optional fractional position. `initDefaultOffice()` places the starter layout when the room is empty. Later tasks look up pieces via `furniturePieces.find(p => p.type === '...')`.

- [ ] **Step 1: Add `type` to every FURNITURE_PALETTE entry in `js/data.js`** — the type is the asset basename:

```js
const FURNITURE_PALETTE = [
  { type: 'desk_cluster',   src: 'assets/desk_cluster.png',   scale: 1.00, flip: false, label: 'Desk'     },
  { type: 'coffee_station', src: 'assets/coffee_station.png', scale: 0.90, flip: false, label: 'Coffee'   },
  { type: 'couch_2seater',  src: 'assets/couch_2seater.png',  scale: 1.05, flip: false, label: 'Sofa'     },
  { type: 'armchair',       src: 'assets/armchair.png',       scale: 0.72, flip: false, label: 'Armchair' },
  { type: 'table_cafe',     src: 'assets/table_cafe.png',     scale: 0.70, flip: false, label: 'Table'    },
  { type: 'plant_snake',    src: 'assets/plant_snake.png',    scale: 0.45, flip: false, label: 'Plant'    },
  { type: 'boxes_stack',    src: 'assets/boxes_stack.png',    scale: 0.50, flip: false, label: 'Boxes'    },
  { type: 'filing_cabinet', src: 'assets/filing_cabinet.png', scale: 0.55, flip: false, label: 'Cabinet'  },
  { type: 'lamp_arc_big',   src: 'assets/lamp_arc_big.png',   scale: 0.55, flip: false, label: 'Lamp'     },
  { type: 'printer',        src: PRINTER_URI,                 scale: 0.42, flip: false, label: 'Printer'  },
  { type: 'whiteboard',     src: WHITEBOARD_URI,              scale: 0.80, flip: false, label: 'Board'    },
];
```

- [ ] **Step 2: Add the two inline SVGs to `js/data.js`**, directly ABOVE `FURNITURE_PALETTE` (they reuse the existing `_svg()` helper — no binary assets):

```js
// Printer and whiteboard have no PNG asset — inline SVG, same style family.
const PRINTER_URI = _svg(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect x="14" y="38" width="72" height="34" rx="6" fill="#E8E2D8" stroke="#2C2C2C" stroke-width="2.5"/>' +
  '<rect x="28" y="20" width="44" height="22" rx="3" fill="#F5F0E8" stroke="#2C2C2C" stroke-width="2.5"/>' +
  '<rect x="26" y="60" width="48" height="16" rx="2" fill="#FFFDF8" stroke="#2C2C2C" stroke-width="2.5"/>' +
  '<circle cx="76" cy="48" r="3.5" fill="#7BA38C"/>' +
  '<rect x="24" y="46" width="20" height="4" rx="2" fill="#2C2C2C" opacity="0.35"/>' +
  '</svg>'
);
const WHITEBOARD_URI = _svg(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect x="10" y="14" width="80" height="54" rx="4" fill="#FFFDF8" stroke="#2C2C2C" stroke-width="3"/>' +
  '<path d="M22 32c10-8 18 6 28-2s16 2 26-4" fill="none" stroke="#D4765F" stroke-width="2.5" stroke-linecap="round"/>' +
  '<path d="M24 48h24M24 56h34" stroke="#6AA3D8" stroke-width="2.5" stroke-linecap="round"/>' +
  '<circle cx="72" cy="52" r="7" fill="none" stroke="#7BA38C" stroke-width="2.5"/>' +
  '<path d="M30 68l-8 20M70 68l8 20" stroke="#2C2C2C" stroke-width="3" stroke-linecap="round"/>' +
  '</svg>'
);
```

- [ ] **Step 3: In `js/game.js`, extend `placeFurniturePiece`** — signature `placeFurniturePiece(def, atRx, atRy)`. Changes inside the existing function:
  - After the placement loop, before `const rx = px / w, ry = py / h;` add:

```js
  if (atRx !== undefined && atRy !== undefined) {
    px = Math.max(EDGE, Math.min(w - size - EDGE, atRx * w));
    py = Math.max(EDGE, Math.min(h - size - EDGE, atRy * h));
  }
```

  - Change the piece literal to carry type and (after creating `el`) the element:

```js
  const piece = { type: def.type, rx, ry, pw: size, ph: size, rotation: 0, flipX: def.flip };
  // ... existing el/img creation unchanged ...
  piece.el = el;
```

  (`piece.el = el;` goes right before `makeFurnitureDraggable(el, piece, img);`. The delete button already splices the piece, so `el` needs no extra cleanup.)

- [ ] **Step 4: Add `initDefaultOffice()` to `js/game.js`** (above the `// ---- Init ----` block) and call it from init:

```js
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
```

In the init block at the bottom, insert `initDefaultOffice();` between `initFurniturePalette();` and `initCharacters();` (characters must spawn AFTER obstacles exist so they don't spawn inside furniture).

- [ ] **Step 5: Syntax check** — `node --check js/data.js && node --check js/game.js && node --check js/events.js && echo OK` → `OK`.

- [ ] **Step 6: Browser check** — fresh load shows the 8-piece starter office (printer and whiteboard render as line-art SVGs matching the style); characters spawn clear of furniture and route around it; palette can still add/drag/remove pieces; zero console errors.

- [ ] **Step 7: Commit**

```bash
git add js/data.js js/game.js
git commit -m "feat: typed furniture, SVG printer/whiteboard, default office layout"
```

---

### Task 4: Diary + persistence + Day N

**Files:**
- Modify: `js/events.js` (append diary/persistence section + init at file bottom)
- Modify: `js/game.js` (state fields; `bumpStat`/`setStat` call `persistSoon`)
- Modify: `index.html` (Day pill + diary section)
- Modify: `css/style.css` (diary styles)

**Interfaces:**
- Consumes: `lsGet`/`lsSet`, `state`, `scheduleStatsRender()` from game.js.
- Produces: `appendDiary(text, tsOverride)` — appends `{t: epochMs, text}` to `state.diary` (ring, max 50), re-renders, persists. `persistSoon()` — debounced (1 s) write of `{stats, dayCount, diary, lastSeen}` to `offquarium-v1`. `loadPersistence()` — restores on boot, increments `dayCount` on first visit of a calendar day, returns the parsed blob (or null) so Task 10 can read `lastSeen`. `renderDiary()`. New state fields: `state.diary = []`, `state.dayCount = 1`.

- [ ] **Step 1: Add state fields in `js/game.js`** — inside the `state` literal, after `stats: {...}`:

```js
  diary: [],
  dayCount: 1,
```

- [ ] **Step 2: Add HTML** — in `index.html`, append a Day pill inside `#statsBar` (after the meetings pill):

```html
        <div class="stat-pill" title="Day"><span class="stat-icon" aria-hidden="true">&#x1F4C5;</span><span class="stat-value" id="statDay">1</span></div>
```

And insert the diary section in the control panel, between the furniture palette `</div>` (closing `.furniture-palette-panel`) and the `<!-- Legend -->` comment:

```html
          <!-- Office diary -->
          <div class="diary-panel">
            <button class="diary-toggle" id="diaryToggle" aria-expanded="false">&#x1F4D3; Office diary <span class="chevron" aria-hidden="true">&#x203A;</span></button>
            <ul class="diary-list" id="diaryList" hidden></ul>
          </div>
```

- [ ] **Step 3: Append to `js/events.js`:**

```js
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
```

- [ ] **Step 4: Persist on stat changes** — in `js/game.js`, add `if (typeof persistSoon === 'function') persistSoon();` as the last line of BOTH `bumpStat` and `setStat` (the `typeof` guard keeps game.js self-sufficient if events.js ever fails to load).

- [ ] **Step 5: Diary CSS** — append to `css/style.css`:

```css
/* ===== Office diary ===== */
.diary-panel { margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(44,44,44,0.06); }
.diary-toggle {
  width: 100%; display: flex; align-items: center; gap: 6px;
  background: none; border: none; cursor: pointer;
  font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
  color: #2C2C2C; padding: 4px 0;
}
.diary-toggle .chevron { margin-left: auto; transition: transform 0.2s; }
.diary-toggle.open .chevron { transform: rotate(90deg); }
.diary-list {
  list-style: none; margin: 6px 0 0; padding: 0;
  max-height: 180px; overflow-y: auto;
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: #555; display: flex; flex-direction: column; gap: 4px;
}
```

- [ ] **Step 6: Ring-buffer micro-test (before browser check):**

Run:
```bash
node -e "
const state = { diary: [] };
const DIARY_MAX = 50;
function appendDiary(text, t) {
  state.diary.push({ t, text });
  if (state.diary.length > DIARY_MAX) state.diary.splice(0, state.diary.length - DIARY_MAX);
}
for (let i = 0; i < 60; i++) appendDiary('e' + i, i);
const a = require('assert');
a.equal(state.diary.length, 50);
a.equal(state.diary[0].text, 'e10');
a.equal(state.diary[49].text, 'e59');
console.log('RING OK');
"
```
Expected: `RING OK`. (This pins the splice logic used verbatim in Step 3.)

- [ ] **Step 7: Syntax + browser check** — `node --check` all three files. Browser: diary section toggles open (empty list is fine); reload the page → stats persist across reload; DevTools → `localStorage.getItem('offquarium-v1')` shows the JSON blob; Day pill shows a number; zero console errors. To test day rollover: in the console run `let b=JSON.parse(localStorage.getItem('offquarium-v1')); b.lastSeen=Date.now()-86400000*2; localStorage.setItem('offquarium-v1',JSON.stringify(b)); location.reload()` → Day increments and the diary gains a "day N ... begins" entry.

- [ ] **Step 8: Commit**

```bash
git add js/events.js js/game.js index.html css/style.css
git commit -m "feat: persistence, office diary, Day counter"
```

---

### Task 5: Activity engine + printer jam

**Files:**
- Modify: `js/events.js` (activity engine section)
- Modify: `js/game.js` (loop hooks, `updateCharDOM`, factory fields, reset/pause/scene cleanup)

**Interfaces:**
- Consumes: `ACTIVITIES`, `ACTIVITY_LINES`, `PRINTER_JAM_DIALOGUE` (data.js); `furniturePieces` with `.type` (Task 3); `appendDiary`, `persistSoon` (Task 4); `safeGatherPoint`, `showBubble`, `bumpStat`, `pickFresh`, `pick`, `rand`, `state`, `SPRITE_W/H`, `trackedTimeout`.
- Produces: `maybeStartActivity(c)` → boolean (true if an activity was started; called from the wander branch). `tickActivity(c, frameDelta)` (called from the loop while holding). `cancelActivity(c)` (called by scenes/pause/reset/selection). New character fields: `c.activity = null` (shape `{ key, piece, phase: 'walking'|'holding', remaining, nextLineIn }`), `c.moodWord = null`, `c.moodUntil = 0`. New state fields: `state.phaseMult = { events: 1, chat: 1, speed: 1, ghostVis: 1, ghostHid: 1, ghostSpeed: 1, lampWeight: 1 }` (Task 7 will drive it; everything reads it from now on). New character state string: `'activity'`.

- [ ] **Step 1: game.js groundwork.**
  - In the `state` literal add: `phaseMult: { events: 1, chat: 1, speed: 1, ghostVis: 1, ghostHid: 1, ghostSpeed: 1, lampWeight: 1 },`
  - In `createCharacter` add: `activity: null, moodWord: null, moodUntil: 0,`
  - In `updateCharDOM`, extend the idle-sprite condition: `} else if (c.state === 'idle' || c.state === 'chatting' || c.state === 'activity') {`

- [ ] **Step 2: Loop hooks in `js/game.js`.** Three edits inside `gameLoop`:

  (a) In the wander branch, right after `c.dirTimer = Math.max(0, c.dirTimer - frameDelta);` and BEFORE the random-direction-change block, add:

```js
        // Ambient activity roll: when a turn decision comes due, sometimes
        // head to a furniture spot instead of wandering (events.js).
        if (c.dirTimer <= 0 && Math.random() < 0.012 * dt * 0.4) {
          if (typeof maybeStartActivity === 'function' && maybeStartActivity(c)) continue;
        }
```

  (b) In the target-arrival branch (`if (td < 10) {` inside the `c.targetX !== null` branch), replace the body with:

```js
          c.targetX = null; c.targetY = null;
          c.targetStuckFrames = 0;
          c.vx = 0; c.vy = 0;
          if (c.activity && c.activity.phase === 'walking') {
            // Arrived at the activity spot — hold there.
            c.activity.phase = 'holding';
            c.state = 'activity';
            const p = c.activity.piece;
            const pieceCx = p.rx * getCanvasSize().w + p.pw / 2;
            c.facing = pieceCx >= c.x + SPRITE_W / 2 ? 'right' : 'left';
          } else {
            c.state = 'idle';
            c.idleTimer = SCENE_IDLE_LOCK;
          }
```

  (c) Add a new branch BEFORE the `c.targetX !== null` branch (after the `approachPartner` branch):

```js
      } else if (c.activity && c.activity.phase === 'holding') {
        // ---- ambient activity: hold at furniture, occasionally speak ----
        c.vx = 0; c.vy = 0;
        tickActivity(c, frameDelta);
```

  (d) `SCENE_IDLE_LOCK` note: scenes force-target characters via `gatherAndChat`, which must now also cancel activities — see Step 4.

- [ ] **Step 3: Activity engine in `js/events.js`** (append):

```js
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
```

  Note: `state.stats.events` doesn't exist yet — add it in game.js `state.stats` literal AND the reset handler's stats literal: `{ conversations: 0, steps: 0, coffee: 0, meetings: 0, events: 0 }`. (`bumpStat('events')` renders nothing until Task 6's stats render tolerates it — so ALSO guard `scheduleStatsRender` now: wrap each `document.getElementById('stat...')` line, or simply skip: the render function writes only the four known ids; an extra stats key is harmless.)

- [ ] **Step 4: Cleanup paths in `js/game.js`** — activities must cancel cleanly:
  - `gatherAndChat` (events.js): inside the `state.chars.forEach` reset block add `if (typeof cancelActivity === 'function') cancelActivity(c);` (before setting targets).
  - Pause handler (`btnPlay`): in the `for (const c of state.chars)` loop add `if (typeof cancelActivity === 'function') cancelActivity(c);`
  - Reset handler (`btnReset`): same line inside its `state.chars.forEach`.
  - Ghost-vanish block in the loop (`if (!c.ghostVisible) {`): add `if (typeof cancelActivity === 'function') cancelActivity(c);`
  - `onCharClick` (selection): after `c.approachPartner = null;` add the same cancel line (a selected character shouldn't stay glued to a desk).

- [ ] **Step 5: pickWeighted micro-test:**

```bash
node -e "
function pickWeighted(entries) {
  const total = entries.reduce((s, e) => s + e[1], 0);
  let roll = Math.random() * total;
  for (const [key, w] of entries) { roll -= w; if (roll <= 0) return key; }
  return entries.length ? entries[entries.length - 1][0] : null;
}
const a = require('assert');
a.equal(pickWeighted([['only', 5]]), 'only');
a.equal(pickWeighted([['a', 0], ['b', 3]]), 'b');
a.equal(pickWeighted([]), null);
const counts = { a: 0, b: 0 };
for (let i = 0; i < 5000; i++) counts[pickWeighted([['a', 1], ['b', 9]])]++;
a.ok(counts.b > counts.a * 3, JSON.stringify(counts));
console.log('WEIGHTED OK');
"
```
Expected: `WEIGHTED OK`.

- [ ] **Step 6: Syntax + browser check.** `node --check` all three. Browser (speed things up with the speed slider): within ~1 minute characters walk to furniture, stop, face it, and idle there; a desk-sitter eventually speaks a desk line; a couch-dozer shows 💤; at most one character per furniture piece; a character in an activity gets pulled cleanly into a Coffee scene (button still exists until Task 6); force a jam from the console with `printerJam(state.chars[0])` → jam line + 1–2 helpers walk over + dialogue + a diary entry appears, and helpers resume wandering afterwards. Coffee activity bumps the ☕ stat. Zero console errors.

- [ ] **Step 7: Commit**

```bash
git add js/events.js js/game.js
git commit -m "feat: ambient activity engine with printer-jam vignette"
```

---

### Task 6: Autonomous event scheduler (coffee, meeting, birthday, lamp flicker)

**Files:**
- Modify: `js/events.js` (scheduler + new scenes; append)
- Modify: `js/game.js` (delete `btnCoffee`/`btnMeeting` listeners)
- Modify: `index.html` (delete the two buttons)
- Modify: `css/style.css` (lamp flicker keyframes, cake element)

**Interfaces:**
- Consumes: `EVENT_DECK`, `BIRTHDAY_DIALOGUE`, `LAMP_FLICKER_DIALOGUE` (data.js); `gatherAndChat`, `coffeeGatherPositions`, `meetingGatherPositions` (Task 1); `pickWeighted`, `appendDiary`, `cancelActivity` (Tasks 4–5); `state.phaseMult` (Task 5); `furniturePieces` with `.type`/`.el` (Task 3).
- Produces: `EVENT_HANDLERS` (object `{coffee, meeting, birthday, lampFlicker}`), `triggerEvent(key)` — runs one event immediately (respects nothing; debug path), `schedulerTick()` on a 15 s `setInterval`, `window.__off = { trigger: triggerEvent }`.

- [ ] **Step 1: Remove manual triggers.**
  - `index.html`: delete the whole `<div class="control-row quick-actions">…</div>` block (both buttons). Keep the `quick-actions` CSS class — Task 9 reuses it for the donut button.
  - `js/game.js`: delete the `btnCoffee` and `btnMeeting` `addEventListener` blocks (and the stray blank line between them).

- [ ] **Step 2: Append scheduler + scenes to `js/events.js`:**

```js
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
      trackedTimeout(() => cake.remove(), 25000);
    }
    gatherAndChat(birthdayGatherPositions(), BIRTHDAY_DIALOGUE, 2);
    state.chars.forEach(c => { c.moodWord = 'festive'; c.moodUntil = Date.now() + 5 * 60 * 1000; });
    appendDiary("someone's birthday — cake appeared on the café table 🎂");
  },
  lampFlicker() {
    bumpStat('events');
    const lamp = furniturePieces.find(p => p.type === 'lamp_arc_big');
    if (lamp && lamp.el) {
      lamp.el.classList.add('lamp-flicker');
      trackedTimeout(() => lamp.el.classList.remove('lamp-flicker'), 2000);
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
```

  Placement note: this block must sit ABOVE the `loadPersistence()` boot line at the bottom of events.js (keep all boot calls last).

- [ ] **Step 3: CSS** — append to `css/style.css`:

```css
/* ===== Autonomous events ===== */
.event-cake {
  position: absolute;
  top: -18px; left: 50%;
  transform: translateX(-50%);
  font-size: 28px;
  animation: cakePop 0.4s ease;
  pointer-events: none;
  z-index: 3;
}
@keyframes cakePop {
  0% { transform: translateX(-50%) scale(0); }
  70% { transform: translateX(-50%) scale(1.2); }
  100% { transform: translateX(-50%) scale(1); }
}
.furniture.lamp-flicker img {
  animation: lampFlicker 2s steps(1, end);
}
@keyframes lampFlicker {
  0%, 8%, 20%, 40%, 65%, 100% { opacity: 1; filter: none; }
  4%, 14%, 30%, 55%, 80% { opacity: 0.35; filter: brightness(1.6); }
}
```

- [ ] **Step 4: Also update `PRINTER_JAM` mood note from Task 5** — nothing to do if Task 5 landed; this is just the reminder that `events` stat key must exist by now (`state.stats` and the reset literal include `events: 0`).

- [ ] **Step 5: Syntax + browser check.** `node --check` all three. Browser: Coffee/Meeting buttons are gone; `window.__off.trigger('coffee')` gathers everyone at the machine with coffee dialogue and bumps ☕; `__off.trigger('meeting')` runs the meeting; `__off.trigger('birthday')` shows 🎂 on the café table + gather + dialogue; `__off.trigger('lampFlicker')` flickers the lamp for 2 s, ghost appears if hidden and says "UHU?!", humans react in place; each event appends a diary entry; leave the tab running 5+ minutes at defaults → at least one autonomous event fires by itself; zero console errors.

- [ ] **Step 6: Commit**

```bash
git add js/events.js js/game.js index.html css/style.css
git commit -m "feat: autonomous event scheduler — coffee, meeting, birthday, lamp flicker"
```

---

### Task 7: Day rhythm

**Files:**
- Modify: `js/events.js` (day-phase controller; append above boot lines)
- Modify: `js/game.js` (apply `state.phaseMult` to speed, chat, ghost timers)
- Modify: `index.html` (overlay div)
- Modify: `css/style.css` (overlay)

**Interfaces:**
- Consumes: `DAY_PHASES` (data.js), `state.phaseMult` (Task 5), `appendDiary` (Task 4).
- Produces: `currentPhase()` → a `DAY_PHASES` entry (honors `?hour=N` URL override), `applyPhase()` (sets `state.phaseMult`, tints `#dayOverlay`, diary entry on change), checked every 60 s. `state.phaseKey` (string) for the observation card and fast-forward.

- [ ] **Step 1: Overlay div** — in `index.html`, inside `#gameCanvas` after the bubbles layer:

```html
        <div class="day-overlay" id="dayOverlay" aria-hidden="true"></div>
```

CSS append:

```css
/* ===== Day rhythm overlay ===== */
.day-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: transparent;
  opacity: 0;
  transition: background-color 3s ease, opacity 3s ease;
  z-index: 4;
}
```

- [ ] **Step 2: Controller in `js/events.js`** (above the boot lines):

```js
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
  if (!first) appendDiary(p.key + ' settles over the office');
}

setInterval(applyPhase, 60000);
applyPhase();
```

  (`applyPhase()` runs at boot too — keep it with the boot lines at the bottom, after `loadPersistence()`. `state.phaseKey` starts undefined; the `first` flag suppresses a boot-time diary entry.)

- [ ] **Step 3: Apply multipliers in `js/game.js`:**
  - Speed — every `const spd = c.speed * state.walkSpeed;` in the loop (approach, target, wander branches) becomes:

```js
        const spd = c.speed * state.walkSpeed * state.phaseMult.speed
                  * (c.type === 'ghost' ? state.phaseMult.ghostSpeed : 1);
```

  - Chat — `const chatProb = state.activeScene ? 0 : state.chatFreq / 100;` becomes:

```js
    const chatProb = state.activeScene ? 0 : (state.chatFreq / 100) * state.phaseMult.chat;
```

  - Ghost intervals — in the ghost visibility block, the two ranges become:

```js
        c.ghostTimer = c.ghostVisible
          ? (8000  + Math.random() * 12000) * state.phaseMult.ghostVis
          : (10000 + Math.random() * 20000) * state.phaseMult.ghostHid;
```

  - Activity roll — in the Task 5 hook, multiply by the events multiplier: `Math.random() < 0.012 * dt * 0.4 * state.phaseMult.events`.

- [ ] **Step 4: Night dimming** — CSS append (the spec's "dimmed bg" at night):

```css
body.night .office-bg { filter: brightness(0.75) saturate(0.8); transition: filter 3s ease; }
.office-bg { transition: filter 3s ease; }
```

- [ ] **Step 5: Syntax + browser check.** `node --check` all three. Browser: visit `?hour=9`, `?hour=13`, `?hour=15`, `?hour=19`, `?hour=23` — no tint / warm 5% / no tint / orange 8% / dark blue 25% + dimmed background respectively; at `?hour=23` the ghost is visible noticeably more often, moves faster than the sluggish humans, and `__off.trigger('lampFlicker')`-style events skew toward the lamp (verify weight via console: `state.phaseMult.lampWeight === 3`); switching phases appends a diary entry (simulate by loading `?hour=19` after `?hour=15` — entry appears on the second load only if phase changed within one session; instead verify via console: `HOUR_OVERRIDE` is const, so run `state.phaseKey='morning'; applyPhase()` at `?hour=19` → diary gains "evening settles over the office"); zero console errors.

- [ ] **Step 6: Commit**

```bash
git add js/events.js js/game.js index.html css/style.css
git commit -m "feat: real-clock day rhythm with tints and behavior multipliers"
```

---

### Task 8: Tap the glass — remove control, add ripple, glances, observation card

**Files:**
- Modify: `js/game.js` (remove WASD/click-command/selection; new tap + card)
- Modify: `index.html` (hero subtitle)
- Modify: `css/style.css` (ripple + card; remove selected-ring rules)

**Interfaces:**
- Consumes: `MOOD_WORDS` (data.js), `ACTIVITIES` labels (via `c.activity`), `state.phaseKey`.
- Produces: `tapGlass(e)` (canvas click), `openObsCard(c)` / `closeObsCard()`, `describeChar(c)` → activity label string, `moodOf(c)` → mood word. Character field `c.chatPartner` (name string, set while chatting). Removed: keyboard-drive branch, `onCanvasClick` command semantics, `state.keys` usage for movement, selection ring meaning (`state.selectedId` stays only as "card open for id").

- [ ] **Step 1: Remove control code in `js/game.js`:**
  - In `gameLoop`, delete the entire `} else if (state.selectedId === c.id) {` branch (keyboard + click-to-move, ~45 lines). The chatting branch now falls through to waving/idle/approach branches for every character.
  - Delete `onCanvasClick` and replace the canvas listener line with `canvas.addEventListener('click', tapGlass);`
  - In the `keydown` listener: remove `state.keys.add(...)` and the arrow-key `preventDefault` block; keep Escape, now closing the card: body becomes

```js
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeObsCard();
});
```

  Delete the `keyup` listener and the `keys: new Set(),` state field.
  - In the chat-start block (where `a.isChatting = true; b.isChatting = true;`) add `a.chatPartner = b.name; b.chatPartner = a.name;` and in the chat-release `trackedTimeout` add `a.chatPartner = null; b.chatPartner = null;`. Also remove the `if (state.selectedId === a.id || ...) continue;` guard in the chat loop — there is no driven character anymore.
  - Delete the `updateCanvasCursor` function and its call sites; delete the `.selected` toggling lines in `updateCharDOM` (`const sel = ...` through the `aria-pressed` line) and instead keep `c.el.classList.toggle('selected', state.selectedId === c.id);` (ring now marks "being observed" — subtler CSS below).
  - Delete the `hasSeenHelp` first-click hint (`if (!state.hasSeenHelp) { ... 'Use WASD or click to move!' ... }`) inside `onCharClick`.

- [ ] **Step 2: Tap-the-glass + observation card in `js/game.js`** (replace `onCharClick` and add new functions):

```js
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
      const spd = c.speed * state.walkSpeed * state.phaseMult.speed;
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
```

  Also: in the pause/reset handlers replace any `state.selectedId = null; updateCanvasCursor();` remnants with `closeObsCard();`, and in `gatherAndChat` (events.js) replace `state.selectedId = null; updateCanvasCursor();` with `if (typeof closeObsCard === 'function') closeObsCard();`.

- [ ] **Step 3: CSS** — append; also REPLACE the `.character.selected::after` block (and its `is-walking.selected` + per-type border-color rules) with the subtle observed-ring version:

```css
/* ===== Tap the glass ===== */
.glass-ripple {
  position: absolute;
  width: 14px; height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 50%;
  border: 2px solid rgba(106,163,216,0.8);
  pointer-events: none;
  animation: glassRipple 0.9s ease-out forwards;
  z-index: 5;
}
@keyframes glassRipple {
  0% { transform: scale(0.4); opacity: 0.9; }
  100% { transform: scale(4); opacity: 0; }
}

/* Observed marker — quiet dot above the head instead of the old dashed ring */
.character.selected::after {
  content: '';
  position: absolute;
  top: -12px; left: 50%;
  width: 8px; height: 8px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: #6AA3D8;
  animation: obsPulse 1.2s ease-in-out infinite;
  pointer-events: none;
}
@keyframes obsPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* ===== Observation card ===== */
.obs-card {
  position: absolute;
  z-index: 15;
  background: #FFFDF8;
  border: 2px solid #2C2C2C;
  border-radius: 12px;
  padding: 10px 14px;
  font-family: 'Inter', sans-serif;
  box-shadow: 4px 4px 0 rgba(44,44,44,0.15);
  animation: bubbleIn 0.25s ease;
  max-width: 200px;
}
.obs-card[data-type="andy"]  { border-color: #D4765F; }
.obs-card[data-type="jazz"]  { border-color: #7BA38C; }
.obs-card[data-type="olex"]  { border-color: #A894C7; }
.obs-card[data-type="ghost"] { border-color: #6AA3D8; }
.obs-card .obs-name { font-weight: 700; font-size: 14px; color: #2C2C2C; }
.obs-card .obs-doing { font-size: 12px; color: #555; margin-top: 2px; }
.obs-card .obs-mood { font-size: 11px; color: #888; margin-top: 4px; font-style: italic; }
```

  Also delete the `.canvas.has-selection` cursor rule if present in style.css (search `has-selection`).

- [ ] **Step 4: Copy tweak** — `index.html` hero subtitle (line 18) becomes:

```html
        <p class="subtitle">An office aquarium — tap the glass, watch them live.</p>
```

- [ ] **Step 5: Syntax + browser check.** `node --check` all three. Browser: WASD does nothing; clicking the floor shows a ripple and nearby characters turn toward it (some stroll over); clicking a character opens the card with name + doing + mood (ghost card: "uhu"/"uhu"); card closes on outside click, Escape, and by itself after 8 s; Enter on a focused character opens the card (existing keydown on the element still calls `onCharClick`); during a coffee scene, clicked characters still show sensible labels; zero console errors.

- [ ] **Step 6: Commit**

```bash
git add js/game.js index.html css/style.css
git commit -m "feat: tap-the-glass interaction — ripple, glances, observation cards"
```

---

### Task 9: Donut button, slimmed panel with ⚙ popover, How-to-Play rewrite

**Files:**
- Modify: `index.html` (panel restructure, modal text)
- Modify: `js/game.js` (donut handler, settings toggle)
- Modify: `js/events.js` (donut scene)
- Modify: `css/style.css` (donut element, popover)

**Interfaces:**
- Consumes: `DONUT_DIALOGUE` (data.js), `gatherAndChat`, `safeGatherPoint`, `findSpawnPoint`, `appendDiary`, `bumpStat`, `trackedTimeout`.
- Produces: `dropDonut()` in events.js (called by the button); button id `btnDonut`, popover ids `btnSettings` / `settingsPop`.

- [ ] **Step 1: Panel restructure in `index.html`.** Replace the Play/Pause control-row through the Reset control-row with:

```html
          <!-- Play/Pause + Donut -->
          <div class="control-row quick-actions">
            <button class="btn-play" id="btnPlay">
              <span id="playIcon">&#x23F8;</span> <span id="playText">Pause</span>
            </button>
            <button class="btn-action" id="btnDonut" title="Drop a donut">
              <span class="action-icon" aria-hidden="true">&#x1F369;</span>
              <span>Donut</span>
            </button>
            <button class="btn-action" id="btnSettings" aria-expanded="false" title="Settings" aria-label="Settings">
              <span class="action-icon" aria-hidden="true">&#x2699;&#xFE0F;</span>
            </button>
          </div>

          <!-- Settings popover: speed + chat sliders -->
          <div class="settings-pop" id="settingsPop" hidden>
            <div class="control-row">
              <label class="control-label">
                <span>Speed</span>
                <span class="control-value" id="speedValue">1.0x</span>
              </label>
              <input type="range" class="slider" id="speedSlider" min="0.5" max="3" step="0.1" value="1">
            </div>
            <div class="control-row">
              <label class="control-label">
                <span>Chat Frequency</span>
                <span class="control-value" id="chatValue">Normal</span>
              </label>
              <input type="range" class="slider" id="chatSlider" min="0" max="100" step="10" value="50">
            </div>
            <div class="control-row">
              <button class="btn-reset" id="btnReset">&#x1F504; Reset</button>
            </div>
          </div>
```

  (Slider/reset listeners in game.js keep working — same ids. The furniture palette, diary, and legend sections stay as they are.)

- [ ] **Step 2: Settings toggle in `js/game.js`** (near the panelToggle listener):

```js
document.getElementById('btnSettings').addEventListener('click', () => {
  const pop = document.getElementById('settingsPop');
  const btn = document.getElementById('btnSettings');
  pop.hidden = !pop.hidden;
  btn.setAttribute('aria-expanded', String(!pop.hidden));
});
```

- [ ] **Step 3: Donut scene in `js/events.js`** (above the boot lines):

```js
// ---- Drop a donut -----------------------------------------------------------
const DONUT_COOLDOWN_MS = 3 * 60 * 1000;
let lastDonutAt = 0;

function dropDonut() {
  const now = Date.now();
  if (now - lastDonutAt < DONUT_COOLDOWN_MS) return;
  lastDonutAt = now;
  const btn = document.getElementById('btnDonut');
  btn.disabled = true;
  trackedTimeout(() => { btn.disabled = false; }, DONUT_COOLDOWN_MS);

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
  trackedTimeout(() => donut.remove(), 16000);
}

document.getElementById('btnDonut').addEventListener('click', dropDonut);
```

- [ ] **Step 4: CSS append:**

```css
/* ===== Donut ===== */
.donut-drop {
  position: absolute;
  font-size: 30px;
  transform: translate(-50%, -50%);
  z-index: 3;
  pointer-events: none;
  animation: cakePop 0.4s ease;
}
/* ===== Settings popover ===== */
.settings-pop {
  margin-bottom: 16px;
  padding: 12px;
  border: 1.5px solid rgba(44,44,44,0.12);
  border-radius: 12px;
  background: rgba(245,240,232,0.6);
}
.settings-pop .control-row:last-child { margin-bottom: 0; }
```

- [ ] **Step 5: Rewrite the How-to-Play modal body in `index.html`** (replace the five `.instruction` divs):

```html
        <div class="instruction">
          <span class="instr-num">1</span>
          <p><strong>Watch.</strong> The office runs itself — desk sessions, coffee runs, meetings, birthdays, the occasional ghost. It follows the real clock: mornings are busy, nights belong to the ghost.</p>
        </div>
        <div class="instruction">
          <span class="instr-num">2</span>
          <p><strong>Tap the glass.</strong> Click anywhere on the floor and nearby characters will look up — some will come see what you wanted.</p>
        </div>
        <div class="instruction">
          <span class="instr-num">3</span>
          <p><strong>Peek at someone.</strong> Click a character to see what they're up to and how they're feeling.</p>
        </div>
        <div class="instruction">
          <span class="instr-num">4</span>
          <p><strong>Drop a donut 🍩</strong> when they've earned it. Everyone will gather.</p>
        </div>
        <div class="instruction">
          <span class="instr-num">5</span>
          <p><strong>Check the diary 📓</strong> in the panel to see what you missed — the office keeps living while you're away.</p>
        </div>
```

  Also update `index.html` `<title>` to `Offquarium — an office aquarium` and the `<h1>` to `Offquarium`.

- [ ] **Step 6: Syntax + browser check.** `node --check` all three. Browser: panel shows Play/Pause + Donut + ⚙ up top; ⚙ toggles the slider/reset popover; Donut → 🍩 lands on the floor, everyone gathers around it, donut dialogue plays, donut disappears, diary entry appears, button greys out (cooldown); help modal shows the new copy; zero console errors.

- [ ] **Step 7: Commit**

```bash
git add index.html js/game.js js/events.js css/style.css
git commit -m "feat: donut drop, slimmed panel with settings popover, new help copy"
```

---

### Task 10: Fast-forward — "while you were away"

**Files:**
- Modify: `js/events.js` (fast-forward section + visibility listener; above boot lines, plus one boot call)
- Modify: `index.html` (toast element)
- Modify: `css/style.css` (toast)

**Interfaces:**
- Consumes: `persistedBlob` (Task 4 boot), `appendDiary(text, tsOverride)`, `bumpStat`, `state.phaseMult`, `EVENT_MEAN_GAP_MS`, `fmtClock`.
- Produces: `estimateAway(elapsedMs, eventsMult, chatMult)` → `{conversations, coffees, ghostAppearances, events}` (pure — micro-tested), `fastForward(elapsedMs)` (applies stats + diary + toast), `showToast(text)`.

- [ ] **Step 1: Micro-test FIRST (red):**

```bash
node -e "
$(true) # estimator not implemented yet — this is the spec:
node --version >/dev/null
" 2>/dev/null
node -e "
function estimateAway(elapsedMs, eventsMult, chatMult) {
  const minutes = elapsedMs / 60000;
  const events = Math.round(minutes / 3 * eventsMult);          // one event ≈ every 3 min
  const conversations = Math.round(minutes / 1.5 * chatMult);   // chats ≈ every 90 s at normal
  const coffees = Math.max(0, Math.round(events * 0.4));
  const ghostAppearances = Math.round(minutes / 0.5 / 2);       // ghost cycles ~every 30 s, visible half
  return { conversations, coffees, ghostAppearances, events };
}
const a = require('assert');
const r = estimateAway(30 * 60000, 1, 1);
a.ok(r.events >= 8 && r.events <= 12, 'events ' + r.events);
a.ok(r.conversations >= 15 && r.conversations <= 25, 'conv ' + r.conversations);
const night = estimateAway(30 * 60000, 0.4, 0.4);
a.ok(night.events < r.events && night.conversations < r.conversations, 'night quieter');
a.deepEqual(estimateAway(0, 1, 1), { conversations: 0, coffees: 0, ghostAppearances: 0, events: 0 });
console.log('ESTIMATE OK');
"
```
Expected: `ESTIMATE OK` (the function body shown here is the implementation to paste in Step 2 — write the test invocation first, watch it fail with `estimateAway is not defined` if run without the body, then paste the body).

- [ ] **Step 2: Fast-forward in `js/events.js`:**

```js
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
  trackedTimeout(() => t.classList.remove('show'), 9000);
  t.onclick = () => t.classList.remove('show');
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    persistSoon();
  } else if (hiddenAt) {
    fastForward(Date.now() - hiddenAt);
    hiddenAt = 0;
  }
});
let hiddenAt = 0;
```

  Boot line (bottom of events.js, after `loadPersistence()` / `applyPhase()`):

```js
if (persistedBlob && persistedBlob.lastSeen) fastForward(Date.now() - persistedBlob.lastSeen);
```

- [ ] **Step 3: Toast element** — `index.html`, inside `#gameCanvas` after `#dayOverlay`:

```html
        <div class="away-toast" id="awayToast" role="status"></div>
```

CSS append:

```css
/* ===== Away toast ===== */
.away-toast {
  position: absolute;
  top: 16px; left: 50%;
  transform: translate(-50%, -20px);
  background: #FFFDF8;
  border: 2px solid #2C2C2C;
  border-radius: 12px;
  box-shadow: 4px 4px 0 rgba(44,44,44,0.15);
  padding: 10px 18px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: #2C2C2C;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s ease, transform 0.4s ease;
  z-index: 20;
  max-width: 70%;
  text-align: center;
}
.away-toast.show {
  opacity: 1;
  transform: translate(-50%, 0);
  pointer-events: auto;
  cursor: pointer;
}
```

- [ ] **Step 4: Syntax + browser check.** `node --check` all three. Browser: switch to another tab for ~70 s, come back → toast "While you were away: …" with plausible numbers, stats bumped, 1+ diary entries with interpolated timestamps between when you left and now; toast dismisses on click and by itself; reload after being closed for >60 s (the `lastSeen` path) → same toast on load; hiding for <60 s → no toast; zero console errors.

- [ ] **Step 5: Commit**

```bash
git add js/events.js index.html css/style.css
git commit -m "feat: while-you-were-away fast-forward with toast and diary backfill"
```

---

### Task 11: Walking gait (Level 1)

**Files:**
- Modify: `css/style.css` (gait keyframes, shadow, ghost float)
- Modify: `js/game.js` (cadence variable, desync delay)

**Interfaces:**
- Consumes: `.character-inner.walking` (style.css:288), `updateCharDOM`, `renderCharacter`, `speedSlider` listener.
- Produces: CSS var `--step-dur` per character element; keyframes `walkGait`, `shadowPulse`, `ghostFloat`; `.character::before` contact shadow.

- [ ] **Step 1: CSS — replace the walking-bob block.** Replace `.character-inner.walking { ... }` and `@keyframes walkBob` (style.css:288-295) with:

```css
/* Paper-puppet gait: bob at step frequency, rock at half frequency,
   pivot at the feet so weight visibly transfers. */
.character-inner.walking {
  clip-path: inset(0 0 0% 0);  /* full body while in motion */
  transform-origin: 50% 92%;
  animation: walkGait var(--step-dur, 0.8s) ease-in-out infinite;
}
@keyframes walkGait {
  0%   { transform: translateY(0)    rotate(-2.5deg); }
  25%  { transform: translateY(-3px) rotate(0deg); }
  50%  { transform: translateY(0)    rotate(2.5deg); }
  75%  { transform: translateY(-3px) rotate(0deg); }
  100% { transform: translateY(0)    rotate(-2.5deg); }
}
```

- [ ] **Step 2: CSS — grounded shadow.** Append (shadow lives on `.character` so `character-inner`'s clip-path can't cut it; it follows the name-label pattern for idle-vs-walking placement):

```css
/* Grounded contact shadow under the feet */
.character::before {
  content: '';
  position: absolute;
  left: 50%;
  top: calc(55% - 6px);            /* under the waist-up crop when idle */
  width: 46%; height: 10px;
  transform: translateX(-50%) scaleX(0.92);
  background: radial-gradient(ellipse at center, rgba(44,44,44,0.28) 0%, rgba(44,44,44,0) 70%);
  pointer-events: none;
  transition: top 0.18s ease;
}
.character.is-walking::before {
  top: calc(100% - 8px);           /* at the feet when full body shows */
  animation: shadowPulse var(--step-dur, 0.8s) ease-in-out infinite;
  animation-delay: calc(var(--step-dur, 0.8s) * -0.25); /* counter-phase with bob */
}
@keyframes shadowPulse {
  0%, 50%, 100% { transform: translateX(-50%) scaleX(1); }
  25%, 75%      { transform: translateX(-50%) scaleX(0.85); }
}

/* Ghosts don't step: no shadow, no rock — a slow sine float instead */
.character[data-type="ghost"]::before { display: none; }
.character[data-type="ghost"] .character-inner,
.character[data-type="ghost"] .character-inner.walking {
  animation: ghostFloat 3s ease-in-out infinite;
  transform-origin: 50% 50%;
}
@keyframes ghostFloat {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-7px); }
}
```

- [ ] **Step 3: Cadence + desync in `js/game.js`:**
  - In `renderCharacter`, after `el.dataset.type = c.type;` add:

```js
  el.style.setProperty('--step-dur', stepDur(c));
  inner.style.animationDelay = (-Math.random() * 0.8).toFixed(2) + 's';
```

  - Add the helper near `spriteTransform` usage (game.js helpers section):

```js
// Step cadence: faster walk = faster steps. 0.8s at 1.0 effective speed.
function stepDur(c) {
  const eff = c.speedMod * state.walkSpeed * (state.phaseMult ? state.phaseMult.speed : 1);
  return (0.8 / Math.max(0.3, eff)).toFixed(3) + 's';
}
```

  - In the `speedSlider` input listener, after setting `state.walkSpeed`, add:

```js
  state.chars.forEach(c => c.el && c.el.style.setProperty('--step-dur', stepDur(c)));
```

  - In `applyPhase()` (events.js), after setting `state.phaseMult`, add the same `state.chars.forEach(...)` line guarded: `if (state.chars) state.chars.forEach(c => c.el && c.el.style.setProperty('--step-dur', stepDur(c)));`

- [ ] **Step 4: Syntax + browser check.** `node --check` all three. Browser: walkers rock ±2.5° around their feet with the bob (paper-puppet look); soft ellipse shadow under walking feet, pulsing against the bob; idle characters keep a static softer shadow under the waist-up crop; ghost floats on a slow sine, never rocks, casts no shadow; drag the speed slider 0.5→3 → step cadence visibly speeds up; the four characters are NOT marching in sync (random delays); `?hour=15` (slump) walks with slower cadence than `?hour=9`; zero console errors.

- [ ] **Step 5: Commit**

```bash
git add css/style.css js/game.js js/events.js
git commit -m "feat: paper-puppet walking gait — rock, bob, grounded shadow, cadence"
```

---

### Task 12: Full-spec verification pass + PR

**Files:** none (verification only; fixes go where they belong)

- [ ] **Step 1:** Run the spec's full verification list (spec §Verification) end-to-end in the browser: all five `?hour` tints; every `__off.trigger(...)` event; activities visible; tap/card/donut; hide-tab toast; reload persistence + Day N; gait checklist; zero console errors throughout.
- [ ] **Step 2:** Use superpowers:requesting-code-review, fix findings.
- [ ] **Step 3:** Push and open a PR from `aquarium-ambient` → `main` titled "Ambient aquarium redesign" summarizing the six workstreams, per superpowers:finishing-a-development-branch.

---

## Self-review notes (kept for the executor)

- **Spec coverage:** A→Task 5 (+2,3 data/furniture), B→Task 6, C→Task 7, D→Tasks 8–9, E→Tasks 4+10, F→Task 11, file split→Task 1, modal copy→Task 9, debug hook→Task 6, verification→Task 12. The spec's `printer`/`whiteboard` activities require furniture that has no PNG asset — Task 3 adds them as inline SVG (allowed by the "CSS or inline SVG" constraint) plus a default office layout, without which a fresh page has no furniture and the ambient systems would have nothing to target.
- **Scheduler vs `clearPendingTimers`:** the scheduler and day-phase check deliberately use raw `setInterval` (never cleared) and gate on `state.isPlaying` / `state.activeScene` internally — `clearPendingTimers()` runs at the start of every scene and on pause, and would otherwise kill them. Activity timing is loop-driven (`frameDelta`), so it pauses with the sim for free.
- **Type consistency spot-checks:** `state.phaseMult` keys (`events, chat, speed, ghostVis, ghostHid, ghostSpeed, lampWeight`) match `DAY_PHASES` columns and every consumer; `c.activity = {key, piece, phase, remaining, nextLineIn}` consistent across Tasks 5/8; `appendDiary(text, tsOverride)` two-arg form used by Task 10; `estimateAway` return keys match the toast string; `stepDur(c)` defined in Task 11 and called from game.js + events.js; `events` stat key added in Task 5 and used by Tasks 6/9/10.
