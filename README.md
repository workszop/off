# Offquarium (Godot)

An office aquarium — watch them live through the glass. Five characters
(Andy, Jazz, Olex, the Ghost, and Margo, the office's resident construct)
live in a paper-diorama office in 3D and follow the real clock: the staff
come in through the door in the morning and go home in the evening, leaving
Margo and the ghost to the lamp-lit night. Things happen (the printer jams,
a donut turns up, someone calls a meeting), you can poke the office through
the glass, and you can talk to Margo.

This branch is the app rewritten in **Godot 4.4** (GDScript). The earlier
browser version (HTML/JS with three.js) is on `main`.

## Running it

Open the folder in Godot 4.4 or later and press Play, or from a terminal:

```sh
godot --path .                 # the first run imports the art (a few seconds)
```

Options go after `--`:

```sh
godot --path . -- --phase=night        # morning, midday, afternoon, evening, night
godot --path . -- --hour=18            # pretend it is 18:00
godot --path . -- --director=off       # start with the camera in your own hands
godot --path . -- --pov=olex           # start in first person
godot --path . -- --party              # start the party once the dance art is in
godot --path . -- --seed=3             # repeatable simulation
godot --path . -- --step=60            # fast-forward a minute at start-up
godot --path . -- --screenshot=out.png # save one frame and quit
```

Exports: `export_presets.cfg` has Linux, Windows, macOS and Web presets
(install the export templates from the editor first). The Web export uses
Godot's Compatibility renderer, which has no ink-outline pass.

## What happens in the office

- **Needs.** Each character has four needs (coffee, focus, rest, company)
  that grow at their own pace: Andy runs on coffee, Jazz on people, Olex on
  work, Margo on tickets and her serial. A pressing need sends them to the
  furniture that settles it; otherwise they wander.
- **Conversations.** Two people who meet pick a subject both have lines on
  (tea, the Rolling Stones, ghosts, ...) and stay on it.
- **Shifts.** `DAY_PHASES[].staff` in `data/dialogue.json` says who is at
  work in each part of the day. The others walk out of the door, and walk
  back in when their shift starts.
- **Events**, every minute or two: a printer jam (Margo says she won't fix
  it, then does), a donut race, a meeting at the whiteboard, a birthday with
  cake, and the lamp flickering when the ghost arrives.
- **Poking the office.** Click a character and they turn to the glass and
  say something (clicking Margo opens her chat). Click the printer to jam
  it. Double-click the floor to drop a donut and start a race.
  *Tap the glass* makes everyone look up.
- **Party** (button or P): the lights go down, a disco ball, boombox and
  party mess appear, and anyone standing still dances, front and back.
- **The director.** A director moves the camera so you can watch the office
  like a sitcom: it travels slowly between places along the walls, turns to
  whatever is going on, and now and then (one chat in every 6 to 12) cuts in
  close on a conversation. Drag or scroll to take the camera yourself; the
  director takes it back a few seconds after you let go. The *Director*
  button turns it off (remembered between runs).
- **First person.** See the office through the eyes of the character picked
  in the dock (Jazz, if nobody is). Drag to turn the head, W A S D or the
  arrow keys to walk them about. *Everyone* leaves it.
- **Follow and Spin** keep the camera on one character or turn the room.
- **Today** is a diary of what has happened, kept for the day in
  `user://daylog.json`. **Sound** turns on a quiet room tone and small
  synthesised sounds (no audio files).

## Code

| Path | Role |
|------|------|
| `scenes/office.tscn`, `scripts/office.gd` | The office: scene set-up, camera (hand-held, director, first person), clicks and the frame loop. |
| `scripts/sim.gd` | The simulation: needs, walking, conversations, shifts, the ghost, reactions to the visitor. No nodes, so tests run it headless. |
| `scripts/events.gd` | Office events: printer jam, donut race, meeting, birthday. |
| `scripts/data.gd`, `data/dialogue.json` | Dialogue banks, conversation topics, day phases and staff shifts. |
| `scripts/layout.gd` | Where the furniture stands, its footprints and use spots, and the walkable floor built from them. |
| `scripts/nav_grid.gd` | Walkability grid and A* paths. |
| `scripts/director.gd`, `scripts/view_math.gd` | The director's shots, and the maths that keeps the camera inside the walls. |
| `scripts/standee.gd` | Characters as camera-facing cardboard cut-outs of their sprite art, with card flips, walk and dance cycles. |
| `scripts/room.gd`, `scripts/furniture.gd`, `scripts/posters.gd` | The room, the paper-craft furniture and the wall art. |
| `scripts/exterior.gd` | The street seen through the windows. |
| `scripts/lighting.gd` | Time-of-day lighting; blends between phases and then rests. |
| `scripts/props.gd`, `scripts/party.gd` | The donut and cake; the party's disco ball, beams, boombox and mess. |
| `scripts/paper.gd` | Paper materials and primitive builders. |
| `shaders/ink_outline.gdshader` | The ink contours drawn over the finished picture. |
| `scripts/hud.gd` | The overlay: toolbar, speech bubbles, Today diary, chat panel. |
| `scripts/margo_chat.gd` | Talk to Margo (HTTP to the chat proxy). |
| `scripts/sound.gd` | Synthesised sound and the party beat. |
| `scripts/daylog.gd` | The Today diary's storage. |
| `worker/margo/` | Chat proxy for Talk to Margo (Cloudflare Worker). |
| `tools/` | Sprite tools: atlas extraction and dance sprite builds (Python). |

Character personalities and dialogue guidelines live in `docs/characters/`.

## Talk to Margo

Replies come from the chat proxy in `worker/margo/`, which keeps the API key
secret and adds Margo's persona; each message carries a short note on the
office right now. The address is the `offquarium/margo_endpoint` project
setting (empty means offline: Margo says, in character, that her link isn't
connected). The proxy only answers origins in its `ALLOWED_ORIGINS`: a web
export sends its page's origin, and a desktop build sends the
`offquarium/margo_origin` setting (`app://offquarium` by default), so add
that value to `ALLOWED_ORIGINS` to let desktop builds talk to her. The
proxy's password is asked for once and kept in `user://settings.cfg`.

## Character art

Characters are zine-paper sprite frames in `assets/sprites/zine/<name>/`:
three views (front, three-quarter, back), each with an idle frame, four walk
frames and, for front and back, eight dance frames. The sources are
1280×1920; the project imports them VRAM-compressed with mipmaps at up to
1024 px (`[importer_defaults]` in `project.godot`), which keeps the whole
cast's art at a manageable size. Geometry stays at 640×960 logical pixels
with the paper base 52 above the bottom. The office loads the art on
background threads in stages: everyone's standing drawings, then walking,
then dancing (the Party button waits for that), and the ghost's art only
when a visit is about 20 seconds off.

`tools/extract-atlas.py` turns a sprite sheet into frames, and
`tools/build-dance-sprites.py` rebuilds the dance frames from
`assets/sprites/dance-sources/`.

## Tests

```sh
godot --headless --path . --import                            # once, after cloning
godot --headless --path . --script res://tests/test_sim.gd    # simulation, nav, director
godot --headless --path . --script res://tests/test_office.gd # the whole scene, poked like a visitor
python3 -m unittest discover -s tests -p 'test*.py'          # sprite tools
```

`test_office.gd` loads the scene, waits for the art, and checks that people
speak, the glass can be tapped, the printer jams and is fixed, a donut is
won, the diary fills, the director keeps the camera in the room, first
person and the party work, Margo turns to the visitor, and the staff go
home at night.
