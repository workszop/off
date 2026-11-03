# Offquarium

An office aquarium — watch them live through the glass. Five characters
(Andy, Jazz, Olex, the Ghost, and Margo, the office's resident construct)
wander a paper-diorama office in 3D, chat in speech bubbles, and follow the
real clock: mornings are busy, nights are quiet and lamp-lit. You can also
talk to Margo.

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

`office3d.html` redirects to `index.html` for old links. The earlier 2D
version of the app is kept on the `backup` branch.

URL options for the office: `?phase=night` (or `morning`, `midday`,
`afternoon`, `evening`), `?hour=N` (clock override), `?cam=x,y,z,tx,ty,tz`
(camera), `?seed=N` (repeatable simulation).

## Code

| Path | Role |
|------|------|
| `js/data.js` | Dialogue banks and day phases (classic script, loaded first; its globals are read by the modules). |
| `src/office3d/office.js` | The office page: scene, layout, time-of-day lighting, the cast's wandering and speech. |
| `src/office3d/room.js` | Room, walls with dollhouse cut-away, windows, door, zone mats, clock, pinboard. |
| `src/office3d/furniture.js` | Paper-craft furniture models. |
| `src/office3d/exterior.js` | The street seen through the windows (drawn through a stencil portal). |
| `src/office3d/nav.js` | Walkability grid and A* paths. |
| `src/office3d/materials.js` | Paper and ink materials. |
| `src/office3d/margo-chat.js` | The Talk to Margo panel. |
| `src/characters3d/standee.js` | Characters as camera-facing cardboard standees of their sprite art. |
| `worker/margo/` | Chat proxy for Talk to Margo (Cloudflare Worker). |
| `tools/extract-atlas.py` | Turns a character sprite sheet into game frames. |

Character personalities and dialogue guidelines live in `docs/characters/`;
plans and specs in `docs/superpowers/`.

## Talk to Margo

The office has a **Talk to Margo** button (or click her). Replies come from
DeepSeek V4.1 Flash via OpenRouter, through a small chat proxy in `worker/margo/` that keeps the API key
secret and adds Margo's persona. Deploy steps are in
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
python3 tools/extract-atlas.py docs/concepts/zine-sprites/source/margo-v3-atlas-chroma.png margo-v3
npm run stamp
```

Margo's active standee uses the v3 paper-cutout sprites in
`assets/sprites/zine/margo-v3/`: the same relaxed walk/idle/walk/idle cycle
as Andy, Jazz and Olex, with the shared 800 ms rhythm, hop and wobble.
The older `assets/sprites/zine/margo/` frames and jointed-puppet cutting tool
(`tools/rig-margo.py`) remain as historical material, but are no longer used
by the standee. The old runtime rig has been removed.

Margo's source atlas lives in `docs/concepts/zine-sprites/source/margo-v3-atlas-chroma.png`.

## Script versions (cache busting)

GitHub Pages lets browsers cache files for about 10 minutes, so a visitor
could get a new page with old scripts. Every first-party script is loaded
with a `?v=<content hash>` stamp (modules through the page's import map).
After editing anything in `src/` or `js/data.js`, run:

```sh
npm run stamp
```

`npm run check` fails if a stamp is out of date.

## Verification

The tests use Node and Chrome directly, with no installed packages:

```sh
npm run check          # JavaScript syntax and script stamps
npm test               # data, character art, local assets, page wiring
npm run test:browser   # the office in real headless Chrome (software WebGL)
npm run verify         # all of the above
npm run test:worker    # the chat proxy (run npm install in worker/margo first)
```

The browser test checks that the five-character cast loads, someone speaks,
there are no name tags outside speech bubbles, Talk to Margo opens, answers
offline and closes, the phone layout fits, and there are no missing files or
errors.
