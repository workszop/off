# Offquarium

An office aquarium — watch them live through the glass. Five characters
(Andy, Jazz, Olex, the Ghost, and Margo, the office's resident construct)
live in a paper-diorama office in 3D and follow the real clock: the staff
come in through the door in the morning and go home in the evening, leaving
Margo and the ghost to the lamp-lit night. Things happen (the printer jams,
a donut turns up, someone calls a meeting), you can poke the office through
the glass, and you can talk to Margo.

Pure HTML/CSS/JS with a vendored Three.js. No build step. Serve the folder
(the pages use ES modules, which browsers will not load from `file://`):

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Pages

| Page | What it is |
|------|------------|
| `index.html` | **The office.** A paper-diorama room with the cast as cardboard standees, a street outside the windows, and lighting that follows the time of day. |
| `characters3d.html` | Preview of the cardboard standees on their own. |

## What happens in the office

- **Needs.** Each character has four needs (coffee, focus, rest, company)
  that grow at their own pace: Andy runs on coffee, Jazz on people, Olex on
  work, Margo on tickets and her serial. A pressing need sends them to the
  furniture that settles it; otherwise they wander.
- **Conversations.** Two people who meet pick a subject both have lines on
  (tea, the Rolling Stones, ghosts, ...) and stay on it.
- **Shifts.** `DAY_PHASES[].staff` says who is at work in each part of the
  day. The others walk out of the door, and walk back in when their shift
  starts.
- **Events**, every minute or two: a printer jam (Margo says she won't fix
  it, then does), a donut race, a meeting at the whiteboard, a birthday with
  cake, and the lamp flickering when the ghost arrives.
- **Poking the office.** Click a character and they turn to the glass and
  say something (clicking Margo opens her chat). Click the printer to jam
  it. Double-click the floor to drop a donut and start a race.
  *Tap the glass* makes everyone look up.
- **Dancing.** Turn on Party (or press P): stationary characters use their
  own eight-pose dance sprites, printed front and back for full turns.
  Moving characters retain their normal walk;
  turning Party off restores normal behaviour. The original idle/walk art
  is unchanged. Dance source strips live in `assets/sprites/dance-sources/`;
  rebuild only the dance frames with `python3 tools/build-dance-sprites.py`.
- **The director.** The camera stands in the room and a director moves it,
  so you can watch the office like a sitcom: it travels slowly between a few
  places along the walls and turns to whatever is going on, and now and then
  (one chat in every 6 to 12) it cuts in close on a conversation. Drag, scroll or pinch to take the camera yourself;
  the director takes it back a few seconds after you let go. The *Director*
  button turns it off (remembered in the browser), and the camera never
  leaves the room.
- **First person.** See the office through the eyes of the character picked
  in the bottom bar (Jazz, if nobody is). Their own lines show as captions;
  drag to turn the head, and walk them about with W A S D or the arrow
  keys (let go and they return to their own day). *Everyone* leaves it. `?pov=olex` starts there.
- **Follow and Spin** keep the camera on one character or turn the room.
- **Today** is a diary of what has happened, kept in the browser for the
  day. **Sound** turns on a quiet room tone and small synthesised sounds
  (off by default).

`office3d.html` redirects to `index.html` for old links. The earlier 2D
version of the app is kept on the `backup` branch.

URL options for the office: `?phase=night` (or `morning`, `midday`,
`afternoon`, `evening`), `?hour=N` (clock override), `?director=off`
(start with the camera in your own hands), `?seed=N` (repeatable simulation).

## Code

| Path | Role |
|------|------|
| `src/office3d/office.js` | The office page: scene, furniture layout, camera, toolbar and the frame loop. |
| `src/office3d/view.js` | Camera maths for the inside view: keeps the camera between the walls while drag, tilt and zoom all stay live. No Three.js or DOM. |
| `src/office3d/director.js` | The director: roams the camera around the room, turns it to what the cast is doing, and cuts in on one chat in every 6 to 12, so the office can be watched like a sitcom. No Three.js or DOM. |
| `src/office3d/sim.js` | The simulation: needs, walking, conversations, shifts, the ghost and reactions to the visitor. No Three.js or DOM, so tests run it in Node. |
| `src/office3d/events.js` | Office events: printer jam, donut race, meeting, birthday. Part of the simulation. |
| `src/office3d/data.js` | Dialogue banks, conversation topics, day phases and staff shifts. |
| `src/office3d/props.js` | The donut and the birthday cake. |
| `src/office3d/sound.js` | Synthesised ambient sound (Web Audio, no audio files). |
| `src/office3d/daylog.js` | The Today diary. |
| `src/office3d/lighting.js` | Time-of-day lighting; blends between phases and then rests. |
| `src/office3d/bubbles.js` | Speech bubbles over the speakers' heads. |
| `src/office3d/room.js` | Room, walls, windows, door, zone mats, clock, pinboard, ceiling and the hallway behind the door. |
| `src/office3d/posters.js` | Wall art for the walls without windows: pictures painted on a canvas in code (grid and primaries, drip painting, op art, nested squares) and three office charts. |
| `src/office3d/furniture.js` | Paper-craft furniture models. |
| `src/office3d/exterior.js` | The street seen through the windows (drawn through a stencil portal). |
| `src/office3d/nav.js` | Walkability grid and A* paths. |
| `src/office3d/materials.js` | Paper materials, and which meshes get inked. |
| `src/office3d/outline.js` | The ink contours: one pass over the finished picture that draws a line wherever depth, facing or object changes, at the same width near and far. |
| `src/office3d/margo-chat.js` | The Talk to Margo panel. |
| `src/characters3d/standee.js` | Characters as camera-facing cardboard standees of their sprite art. |
| `worker/margo/` | Chat proxy for Talk to Margo (Cloudflare Worker). |
| `tools/extract-atlas.py` | Turns a character sprite sheet into game frames. |

Character personalities and dialogue guidelines live in `docs/characters/`;
plans and specs in `docs/superpowers/`.

## Talk to Margo

The office has a **Talk to Margo** button (or click her). Replies come from
DeepSeek V4.1 Flash via OpenRouter, through a small chat proxy in `worker/margo/` that keeps the API key
secret and adds Margo's persona. Each message also carries a short note on
the office right now (time of day, who is in, recent diary entries), so she
can refer to what just happened. Deploy steps are in
`worker/margo/README.md`; once deployed, put its `/chat` address in the
`margo-endpoint` meta tag in `index.html`. Until then, the chat still opens
and Margo says, in character, that her link isn't connected.

## Character art

Characters are zine-paper sprite frames in `assets/sprites/zine/<name>/`:
three directions (front, three-quarter, back), each with an idle frame
and four walk frames. Textures are 1280×1920; geometry remains 640×960
logical pixels with the paper base 52 logical pixels above the bottom.
`tools/extract-atlas.py` turns a sprite sheet (5 columns × 4 rows on flat
magenta) into those frames. The sheet's side-profile row is not used by the
standees, so it is not written:

```sh
python3 tools/extract-atlas.py docs/concepts/zine-sprites/source/margo-v3-atlas-chroma.png margo-v3
npm run stamp
```

Margo's active standee uses the v3 paper-cutout sprites in
`assets/sprites/zine/margo-v3/`: the same relaxed walk/idle/walk/idle cycle
as Andy, Jazz and Olex, with the shared 800 ms rhythm, hop and wobble.
Her earlier sprite sets and the jointed-puppet cutting tool were removed;
they are in the git history before this change.

The office loads the art in stages so it appears quickly: everyone's standing
drawings first, then the walk frames. The ghost is away when the office
opens, so its art is fetched only when a visit is about 20 seconds off.

Margo's source atlas lives in `docs/concepts/zine-sprites/source/margo-v3-atlas-chroma.png`.

The current close-up artwork is restored from separate high-detail pose
strips in `docs/concepts/zine-sprites/hd/`, not enlarged from the old dense
5×4 atlases. Native figures are 629–949 pixels tall before normalization.
Their source manifest records the original per-pose heights, source hashes,
and compatibility aliases for the unused human walk-02/walk-04 frames.
The ghost retains all four distinct walk frames. Rebuild or validate with:

```sh
npm run build:sprites
npm run test:sprites
npm run test:sprite-views
```

The last command uses real Chrome/WebGL and saves before/current captures
under `scratch/sprite-sharpness/output/`. To compare a future restoration,
copy the previous `assets/sprites/zine/` tree to
`scratch/sprite-sharpness/before/` before rebuilding. The regular browser
smoke test does not need this comparison backup.

## Script versions (cache busting)

GitHub Pages lets browsers cache files for about 10 minutes, so a visitor
could get a new page with old scripts. Every first-party script is loaded
with a `?v=<content hash>` stamp (modules through the page's import map).
After editing anything in `src/`, run:

```sh
npm run stamp
```

`npm run check` fails if a stamp is out of date.

## Verification

The tests use Node and Chrome directly, with no installed packages:

```sh
npm run check          # JavaScript syntax (every script, found by folder) and script stamps
npm test               # data, the simulation, character art, local assets, page wiring
npm run test:browser   # the office in real headless Chrome (software WebGL)
npm run verify         # all of the above
npm run test:worker    # the chat proxy (run npm install in worker/margo first)
```

The browser test checks that the five-character cast loads, someone speaks,
there are no name tags outside speech bubbles, Talk to Margo opens, answers
offline and closes, the glass can be tapped, a character followed, the
printer jammed and fixed, a donut dropped and won, the diary filled, the
staff go home at night, the phone layout fits, and there are no missing
files or errors.

The office page has a test hook, `window.__office`: `sim` is the simulation
(`sim.trigger('printerJam')`, `sim.dropDonut()`, `sim.tapGlass()`), and
`step(seconds)` fast-forwards it.
