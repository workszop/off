# Offquarium

An office aquarium — tap the glass, watch them live. Four characters (Andy,
Jazz, Olex, and the Ghost) wander a little office, chat, take coffee breaks,
hold meetings, jam the printer, and follow the real clock: mornings are busy,
nights belong to the ghost.

Pure HTML/CSS/JS. No build step, no dependencies — open `index.html` in a
browser, or serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Architecture

Three classic scripts share the global scope. **Load order matters** (see
`index.html`):

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
