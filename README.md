# Offquarium

An office aquarium — tap the glass, watch them live. Five characters (Andy,
Jazz, Olex, the Ghost, and Margo, the office's resident construct) wander a
little office, chat, take coffee breaks, hold meetings, jam the printer, and
follow the real clock: mornings are busy, nights belong to the ghost. In the
3D office you can also talk to Margo.

Pure HTML/CSS/JS with a vendored Three.js. No build step. Serve the folder
(the 3D pages use ES modules, which browsers will not load from `file://`):

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Pages

| Page | What it is |
|------|------------|
| `index.html` | **The 3D office.** A paper-diorama room with the cast as cardboard standees, a street outside the windows, and lighting that follows the time of day. Code in `src/office3d/` and `src/characters3d/standee.js`. |
| `classic.html` | The original 2D office with the full simulation (chats, scenes, events, diary, edit mode). |
| `characters3d.html` | Preview of the cardboard standees on their own. |

In the 3D office the cast wanders, chats and remarks using the 2D dialogue,
but the full simulation (scenes, events, diary, edit mode) is not wired in
yet; the plan for that is in
`docs/superpowers/plans/2026-11-01-threejs-3d-rebuild.md`. `office3d.html`
redirects to `index.html` for old links. 3D debug params: `?phase=night`,
`?hour=N`, `?cam=x,y,z,tx,ty,tz`, `?seed=N`.

### Script versions (cache busting)

GitHub Pages lets browsers cache files for about 10 minutes, so a visitor
could get a new page with old scripts. Every first-party script in the 3D
pages is loaded with a `?v=<content hash>` stamp (modules through the page's
import map). After editing anything in `src/` or `js/data.js`, run:

```sh
npm run stamp
```

`npm run check` fails if a stamp is out of date.

## Talk to Margo

The 3D office has a **Talk to Margo** button (or click her). Replies come
from Claude, through a small chat proxy in `worker/margo/` that keeps the API
key secret and adds Margo's persona. Deploy steps are in
`worker/margo/README.md`; once deployed, put its `/chat` address in the
`margo-endpoint` meta tag in `index.html`. Until then, the chat still opens
and Margo says, in character, that her link isn't connected.

## Character art

Characters are zine-paper sprite frames in `assets/sprites/zine/<name>/`:
four directions (front, three-quarter, side, back), each with an idle frame
and four walk frames, 640×960 with the paper base 52 px above the bottom.
`tools/extract-atlas.py` turns a sprite sheet (5 columns × 4 rows on flat
magenta) into those frames:

```sh
python3 tools/extract-atlas.py margo-atlas.png margo
npm run stamp
```

Margo's current frames are placeholders until her final design is supplied.

## Architecture (2D app, `classic.html`)

Three classic scripts share the global scope. **Load order matters** (see
`classic.html`):

| File | Role |
|------|------|
| `js/data.js` | Static data: dialogue banks, sprite map, furniture catalogue, activity specs, event deck, day phases, mood words |
| `js/game.js` | Core simulation: game state, rAF loop, movement/collision, character & bubble DOM rendering, controls, furniture placement |
| `js/events.js` | Higher-level systems: scripted scenes (coffee/meeting/birthday), ambient activities, autonomous event scheduler, day rhythm, diary + localStorage persistence, "while you were away" |

Nothing in `game.js` runs before all three scripts execute (only rAF
callbacks and event handlers), so it may call `events.js` functions freely.

### Key systems

- **Game loop** (`gameLoop`): fixed-timestep-ish rAF loop; per-character
  state machine (chatting → idle countdown → approach partner → activity
  hold → scene target → autonomous wander), then a shared block for
  character separation, obstacle pushback, wall clamp, and a stuck-escape
  hatch. DOM syncs at ~10 Hz.
- **Obstacles**: `OBSTACLES` holds pixel rects for walls + furniture,
  rebuilt by `rebuildObstacles()` on furniture changes and canvas resizes
  (a `ResizeObserver` on the canvas also catches panel collapse).
- **Scenes** (`gatherAndChat`): send everyone to gather points, poll for
  arrival, run scripted dialogue. `state.activeScene` suppresses ambient
  chatter; `trackedTimeout` timers are killable via `clearPendingTimers()`.
  Raw `setTimeout`/`setInterval` is reserved for things that must survive a
  scene cancel (scheduler, cooldowns, UI chrome).
- **Day rhythm**: real local clock mapped to phases (`DAY_PHASES`) that
  scale event/chat/speed/ghost multipliers via `state.phaseMult`.
- **Persistence**: stats, diary, and day count in `localStorage`
  (`offquarium-v1`), debounced via `persistSoon()`. Returning after the tab
  was hidden/closed fast-forwards estimated activity into the diary.

## Debugging

- `?hour=N` in the URL overrides the clock (e.g. `?hour=23` for night mode).
- `window.__off.trigger('coffee' | 'meeting' | 'birthday' | 'lampFlicker')`
  fires an event immediately.

Character personalities and dialogue guidelines live in `docs/characters/`.

## Assets

- Runtime artwork uses transparent WebP: 80 character frames at 640×960 and
  11 furniture pieces at 640×640.
- Startup warms only the likely sprite directions. Remaining directions load
  on demand, and the furniture palette is created only when Edit office opens.
- Inter, Caveat, and JetBrains Mono are bundled under `assets/fonts/`; their
  OFL licenses are stored beside the font files. The app makes no external font
  requests.

## Verification

The test suite uses Node and Chrome directly, with no installed packages:

```sh
npm run check          # JavaScript syntax
npm test               # static contracts and asset integrity
npm run test:browser   # real headless-Chrome interaction smoke test
npm run verify         # all of the above
```

The browser smoke test (run against `classic.html`) covers edit-mode isolation, pause/resume, scene reset,
local fonts and images, the app-level `data-*` contract, and responsive
furniture scaling at a 390×844 mobile viewport.
