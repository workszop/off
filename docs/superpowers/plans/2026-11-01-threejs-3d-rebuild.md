# Offquarium 3D: Three.js Rebuild Plan

> Status: **in progress**. Branch: `three`.
> Steps use checkbox (`- [ ]`) syntax for tracking.

> **Update (2026-11-01): cardboard standees confirmed.** Modelled 3D
> figures (option B) were prototyped and rejected; the characters stay as
> their original sprites on cardboard standees (option A). Phase 2's standee
> is built in `src/characters3d/standee.js`: camera-facing card,
> camera-relative front / three-quarter / back drawings with mirroring and
> hysteresis, the 2D app's walk frames and cadence, a card flip with a
> kraft-board edge when the view changes, silhouette shadows and a contact
> shadow. Preview it at `characters3d.html`.
>
> **Update (2026-11-01): standees approved; office modelled.** The office is
> built as a paper diorama in `src/office3d/` and previewed at
> `office3d.html`: card base with gridded paper floor, four card walls with
> windows, a door, a pinboard and a real-time wall clock, dollhouse cut-away
> of walls facing the camera, the four zone mats with handwritten labels,
> all 11 palette pieces plus an office chair as ink-outlined paper-craft
> models, a nav grid with A* so the cast wanders between furniture spots,
> and DAY_PHASES lighting (sun, window sky, arc lamp, screen glow, cast
> tint). The office sits one floor up: through the windows (a stencil
> portal, `exterior.js`) you see treetops, a street with lamps, card
> buildings whose windows light up at night, and a hazy skyline. Still to do: wire the real simulation (Phase 0), bubbles and
> picking (Phase 3), edit mode in 3D (Phase 4).

**Goal:** Rebuild Offquarium as a full 3D simulation in Three.js - a real
diorama office with depth, light, shadows, a free camera, 3D furniture and
navigation - while keeping the four main characters (Andy, Jazz, Olex, the
Ghost) looking exactly as they do today.

**Non-goal:** Redrawing or remodelling the characters. Their zine-paper
artwork is the identity of the app.

---

## 1. The core design decision: characters as paper standees

The character sprites are already drawn as **paper cut-outs**: hand-inked
figures on a cream paper backing with a torn edge (Jazz even has collage
scraps behind her). That makes the 3D translation natural instead of a
compromise:

> In 3D, each character becomes a **physical paper standee** standing on the
> office floor - the same artwork, mapped onto an upright card that lives in a
> real 3D room.

This is the "Paper Mario" / "Don't Starve" technique (2.5D actors in a 3D
world). It is the only approach that keeps appearance *literally* intact.

| Option | Appearance kept? | Cost | Verdict |
|---|---|---|---|
| **A. Paper standees (directional billboards)** | Yes, pixel-identical | Low; reuses all 80 frames | **Chosen** |
| B. Rigged 3D models re-sculpted from the art | No; a 3D reinterpretation, risks uncanny look | Very high (modelling, rigging, animation) | Rejected |
| C. Flat sprites as screen overlay on top of 3D | Yes, but they no longer *live* in the world (no occlusion, light, shadow) | Low | Rejected; not "full 3D" |

### How a standee works

- **Geometry:** a vertical plane, sized from the sprite aspect (640x960 ->
  2:3) and scaled so a standing human is ~1.7 m tall (Ghost keeps its `0.72`
  scale). Pivot at the feet, so it stands on the floor.
- **Upright billboarding:** the card rotates only around the vertical (Y) axis
  to face the camera. It never tilts, so characters stay grounded and never
  go edge-on.
- **Directional frames:** each frame we compute the angle between the
  character's *heading* and the *camera view direction*, and pick the
  existing art set:

  | Angle (heading vs. camera) | Sprite set | Mirror |
  |---|---|---|
  | walking toward camera (±30°) | `front` | - |
  | 30°-150° to the right | `threequarter` | no |
  | 30°-150° to the left | `threequarter` | yes |
  | walking away (±30°) | `back` | - |

  This is the same rule as `movementView()` in `js/game.js` today, just
  measured against the camera instead of the screen axes. We keep using
  `threequarter` instead of `side` for sideways motion, for the reason already
  documented in `movementView()`: the side walk frames barely change between
  poses. Hysteresis (already in the motion system) keeps the set from flickering
  near the boundaries.
- **Walk cycle:** unchanged. Same frame order (`[walk1, idle, walk3, idle]`),
  same fixed cadence (`stepCycleMs`), same gait bob, now applied as a small Y
  translation and a ±1.5° Z-wobble of the card ("paper hop").
- **Lighting must not repaint them:** character materials are
  `MeshBasicMaterial` (unlit), `colorSpace = SRGBColorSpace`, tone mapping off.
  Day phases tint them with one gentle uniform multiply (the same as today's
  CSS overlay opacity). That means they never take on PBR shading that would
  change the drawing.
- **They still belong in the world:**
  - Depth-tested, so desks and the couch correctly hide their legs.
  - `alphaTest` cut-out + `customDepthMaterial`, so they **cast real shadows**
    shaped like their silhouettes.
  - A soft contact-shadow decal under the feet.
  - A thin paper edge: an optional second, slightly offset back plane in
    the paper colour gives the card 1-2 mm of visible thickness when the camera
    orbits.
- **Ghost:** same standee, plus additive glow sprite, `opacity` driven by the
  existing `ghostVisible` logic, gentle float on Y, and a faint point light at
  night.

**Acceptance test for "appearance intact":** with the camera at the default
front view, a screenshot crop of each idle character must match its source
WebP within a small perceptual tolerance (see Phase 6).

---

## 2. What changes and what stays

### Stays (ported almost verbatim)

- `js/data.js`: dialogue banks, sprite map, furniture catalogue, activities,
  event deck, `DAY_PHASES`, mood words.
- Simulation behaviour from `js/game.js` / `js/events.js`: character state
  machine, steering and natural motion (`MOTION` block), conversations, scenes
  (coffee, meeting, birthday), printer jam, donut race, scheduler, day rhythm,
  diary, `localStorage` (`offquarium-v1`), "while you were away".
- The HTML UI chrome: stats bar, dock, drawer, diary, settings, how-to-play
  modal, fonts, colour tokens in `css/style.css`.
- Speech bubbles stay HTML (Caveat font, same CSS), but they are positioned by
  projecting each character's head position from 3D to the screen
  (`CSS2DRenderer` or a manual `Vector3.project`).

### Changes

| Today (2D DOM) | 3D version |
|---|---|
| Pixel coordinates on a canvas `div` | World units in metres on the XZ floor plane (room ≈ 12 m × 8 m) |
| `office_bg.jpg` line drawing | A modelled room: floor, walls, door opening, cut-away dollhouse walls |
| Furniture = flat WebP images | 3D paper-craft furniture (Phase 4); WebP standees as an interim step |
| Obstacles = rects + push-back | Grid nav-map + A* paths, plus the existing steering for smooth local motion |
| Fixed top-down view | Diorama camera: orbit, zoom, pan, follow-a-character |
| CSS tint overlay for time of day | Real lights: sun angle/colour per phase, lamp light at night, ghost glow |
| Tap = screen point | Tap = raycast to floor point; ripple decal on the floor |
| Click character = DOM hit | Raycast against standees (alpha-aware) |
| Donut = DOM element | 3D donut with a simple gravity/bounce drop |

---

## 3. Target architecture

Move from three global classic scripts to **ES modules**, with a hard split
between *simulation* (no rendering, no DOM) and *presentation*.

```
index.html              importmap -> vendor/three.module.js
vendor/three/           pinned Three.js build + addons (OrbitControls, CSS2DRenderer)
src/
  main.js               boot: load data, create sim, create renderer, start loop
  data/                 data.js split into modules (dialogue, sprites, furniture, phases)
  sim/
    world.js            room bounds, nav grid, furniture footprints (metres)
    characters.js       state machine + steering (ported from gameLoop)
    scenes.js           gatherAndChat, coffee, meeting, birthday
    activities.js       ambient activities, printer jam, donut race
    scheduler.js        event deck, day phases
    persistence.js      localStorage, diary, fast-forward
    clock.js            fixed-step sim clock (pause, speed slider)
  render3d/
    stage.js            renderer, scene, camera, controls, resize
    room.js             floor, walls, door, paper materials
    standee.js          character standee: frame selection, billboarding, shadow
    furniture3d.js      furniture meshes + edit-mode gizmos
    lighting.js         day-phase lights
    fx.js               ripple, particles, ghost glow, printer paper
    picking.js          raycasting for tap / select / furniture drag
  ui/
    hud.js              stats, dock, drawer, diary, settings (existing DOM)
    bubbles.js          HTML bubbles projected from 3D
    obsCard.js          observation card
tests/
```

**Contract between sim and renderer.** The sim emits plain data each tick;
the renderer only reads it:

```js
// per character, per frame
{ id, type, x, z, heading, speed, state, gaitClock, ghostVisible, activity }
// events
sim.on('say',   ({ id, text, ms }) => ...)
sim.on('event', ({ key }) => ...)       // coffee, meeting, printerJam, donut...
```

This makes the sim testable in plain Node without a browser, and lets the 2D
DOM renderer and the 3D renderer coexist during migration.

**Fixed timestep.** The sim runs at a fixed 30 Hz (`clock.js`), the
renderer interpolates at display rate. This replaces today's
"fixed-timestep-ish" loop plus the 10 Hz DOM sync.

**No build step (kept).** Three.js is vendored at a pinned version and loaded
through an `<script type="importmap">`.
**Trade-off:** ES modules do not load from `file://`, so the app must be
served (`python3 -m http.server`), as the README already recommends.
Everything still works offline.

---

## 4. Visual direction: a paper diorama

Keep the zine / paper-collage identity in 3D:

- **Camera default:** a high three-quarter "aquarium" view (about 35-45°
  pitch), perspective with a narrow FOV (~30°) so it reads like a model
  under glass. Orthographic is an option in settings.
- **Room:** cream paper floor with the existing paper grain; walls as
  thick card with an ink outline. The two walls facing the camera fade/cut away
  automatically (dollhouse style), so the view is never blocked.
- **Ink lines:** outline post-process (normal + depth edge detection) in the
  ink colour, so 3D furniture matches the hand-drawn standees. Fallback:
  `EdgesGeometry` line segments on low-end devices.
- **Palette:** reuse the CSS custom properties (read them at boot with
  `getComputedStyle`), so 2D UI and 3D scene share one palette.
- **Glass:** an optional subtle vignette and reflection pass sell the
  "aquarium" idea; the tap ripple is drawn on the glass *and* as a floor decal.

---

## 5. Phased plan

Every phase ends with a working, shippable app and green `npm run verify`.

### Phase 0 - Separate the simulation from rendering (still 2D)

The rebuild is low-risk only if the sim stops touching the DOM first.

- [ ] Convert scripts to ES modules under `src/`; vendor Three.js; add importmap.
- [ ] Extract simulation state and logic from `game.js`/`events.js` into
      `src/sim/*` with the data contract above. Remove all `document.*` use
      from sim code.
- [ ] Move coordinates to world units (metres). Keep a 2D adapter that maps
      metres -> pixels so the **current DOM renderer keeps working unchanged**.
- [ ] Port existing tests; add pure-Node sim tests (state machine, scenes,
      scheduler, persistence) driven by the fixed clock.
- **Done when:** the app looks and behaves exactly as today, with the sim
  running headless in Node tests.

### Phase 1 - 3D stage and room, behind a flag

- [ ] `?renderer=3d` URL flag selects the new renderer; the 2D one stays default.
- [ ] Renderer, camera, `OrbitControls` (clamped: no going under the floor, limited
      pitch, zoom range), resize handling, pixel-ratio cap for mobile.
- [ ] Room from the current floor plan: floor, walls, door gap, dollhouse
      cut-away.
- [ ] Day-phase lighting driven by `DAY_PHASES` (`?hour=N` still works).
- **Done when:** an empty lit paper office renders and can be orbited.

### Phase 2 - Characters as paper standees (the critical phase)

- [ ] `standee.js`: plane geometry, foot pivot, Y-only billboarding.
- [ ] Camera-relative direction selection with hysteresis plus mirroring.
- [ ] Walk cycle on the existing cadence; paper-hop bob/wobble; idle breathing.
- [ ] Unlit sRGB materials, alpha cut-out, silhouette shadows, contact shadow,
      optional paper edge thickness.
- [ ] Ghost: transparency from `ghostVisible`, float, glow, night light.
- [ ] **Texture budget:** 80 frames × 640×960 RGBA ≈ 196 MB of GPU memory if
      uploaded raw. Instead, generate per-character atlases at 2 sizes
      (e.g. 320×480 and 160×240 cells) with mipmaps, load directions lazily
      (same idea as today's `warmSpriteDirection`), and dispose unused ones.
      Target < 40 MB texture memory.
- [ ] Appearance golden test (Phase 6) passes for all four characters.
- **Done when:** characters walk the 3D room, look identical from the front,
  turn correctly as the camera orbits, and cast silhouette shadows.

### Phase 3 - Bubbles, interaction, picking

- [ ] HTML bubbles anchored to projected head positions; hidden when the
      character is behind the camera; stacked to avoid overlap; same CSS.
- [ ] Tap the glass: raycast to the floor, show the ripple decal, run the
      existing `tapGlass` reaction logic in world units (`TAP_RADIUS` -> metres).
- [ ] Click a character: alpha-aware raycast -> observation card; optional
      "follow cam" that smoothly tracks them.
- [ ] Donut: 3D model dropped with simple gravity/bounce, then the existing race.

### Phase 4 - 3D furniture and navigation

- [ ] Interim: furniture as paper standees from the existing WebPs, so the app is
      complete early.
- [ ] Final: low-poly paper-craft models (desk cluster, coffee station, couch,
      armchair, café table, plant, boxes, cabinet, arc lamp, printer,
      whiteboard), built procedurally in code or as small glTF files, with paper
      textures and ink edges. Heights keep the calibration in `data.js`
      (desk at hip height, whiteboard/lamp near person height).
- [ ] Each piece declares a **footprint** (nav blocking) and **interaction
      slots** (where to stand / sit / face for coffee, desk work, whiteboard,
      couch).
- [ ] Nav grid (≈ 0.25 m cells) rebuilt when furniture changes; A* paths for
      scene gathering and activities; the existing steering follows the path, and
      separation still runs locally. This replaces push-back plus the
      stuck-escape hatch.
- [ ] **Sitting without new art:** a character at a desk or couch stands behind it
      with the standee lowered slightly. The furniture occludes the legs,
      which reads as seated. True sitting poses would need new artwork in the
      same zine style; that is listed under future work, not required.
- [ ] Edit office in 3D: palette, drag on floor (raycast), rotate in 90°/15° steps,
      snap to grid, red footprint when blocked. Keep the edit-mode isolation that
      the current tests cover (sim paused while editing).

### Phase 5 - Atmosphere and polish

- [ ] Outline post-process; ambient occlusion (SSAO or baked contact shadows).
- [ ] Lamp flicker as a real light; monitors glowing at night; window light
      sweeping across the floor through the day.
- [ ] Printer jam: animated paper sheets; coffee steam particles; birthday confetti.
- [ ] Audio (optional, off by default): room tone, footsteps, coffee machine.
- [ ] Quality tiers: auto-detect GPU; low tier disables shadows/post, caps DPR at 1.
- [ ] Respect `prefers-reduced-motion`: slower camera, no wobble.

### Phase 6 - Verification, switch-over, cleanup

- [ ] **Appearance golden test:** headless Chrome (WebGL via SwiftShader) renders
      each character idle, front view, fixed camera; crop and compare with the
      source WebP (allowing for downscale) under a perceptual threshold.
- [ ] Browser smoke test ported: controls, pause/resume, scenes, reset, edit
      isolation, persistence, mobile viewport, no console errors, no WebGL
      context loss on resize.
- [ ] Performance budget: 60 fps on a mid-range laptop, ≥ 30 fps on a mid-range
      phone; < 150 draw calls; < 40 MB textures.
- [ ] Make 3D the default; keep `?renderer=2d` for one release as a fallback
      (also used automatically if WebGL is unavailable). Then delete the DOM renderer.
- [ ] Update README (architecture, run instructions, debugging hooks) and
      `progress.md`.

---

## 6. Debug hooks (kept and extended)

- `?hour=N`: clock override (unchanged).
- `?renderer=2d|3d`: renderer choice during migration.
- `window.__off.trigger('coffee' | 'meeting' | 'birthday' | 'lampFlicker')`: unchanged.
- New: `window.__off.camera('front' | 'iso' | 'top' | 'follow:andy')`,
  `window.__off.debug({ nav: true, footprints: true, stats: true })` (draws the nav
  grid and shows a renderer stats panel).

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Standees look "flat" when orbiting | Y-only billboarding plus direction swapping means they are never edge-on; paper-edge thickness and silhouette shadows add depth; camera pitch is clamped |
| Direction set flickers at angle boundaries | Reuse the existing hysteresis; minimum hold time per direction |
| Shading changes the artwork | Unlit materials, sRGB, no tone mapping on standees; golden test guards it |
| GPU memory from 80 large frames | Atlases, two resolutions, mipmaps, lazy loading per direction, dispose |
| Big-bang rewrite breaks behaviour | Phase 0 makes the sim renderer-agnostic first; both renderers run behind a flag until parity |
| `file://` no longer works | Documented; `python3 -m http.server` already the recommended path |
| Low-end/mobile performance | Quality tiers, DPR cap, shadow and post toggles, 2D fallback |
| Mismatch between 3D furniture and the hand-drawn characters | Shared palette tokens, paper textures, ink outline pass |

---

## 8. Future work (out of scope)

- New zine-style art for sitting, typing, and drinking-coffee poses (would
  slot straight into the standee system as extra frame sets).
- Redrawn side-profile walk frames (then `side` can be used for 90° views).
- Multiple rooms or floors; elevator or kitchen.
- Optional VR/WebXR "look into the aquarium" mode.

---

## 9. Suggested order of first pull requests

1. `three/phase-0-modules`: ES modules + vendored Three.js, no behaviour change.
2. `three/phase-0-sim-split`: headless sim plus Node tests, 2D renderer adapter.
3. `three/phase-1-stage`: lit room behind `?renderer=3d`.
4. `three/phase-2-standees`: characters in 3D plus the appearance golden test.

After PR 4, the core risk ("can they stay themselves in 3D?") is answered,
and the rest is incremental.
