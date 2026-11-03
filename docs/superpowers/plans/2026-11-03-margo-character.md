# Margo: Fifth Character Plan

> Status: **proposal / not started**. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add Margo, a construct-style office bot, as a fifth resident of the
office. She uses the same zine-paper art as Andy, Jazz, Olex and the Ghost,
appears in both the 2D app (`classic.html`) and the 3D office (`index.html`),
and her lines and behaviour follow the Margo persona: flat, dry,
self-deprecating, mildly exasperated by humans and quietly devoted to them.

**Non-goals:** No new art style, no 3D model (she is a cardboard standee like
the others), no changes to the existing four characters' look.

---

## 1. Who Margo is in the office

| | |
|---|---|
| Role | The office's resident construct: an AI in a humanoid shell who "assists". |
| Personality | From the Margo persona: reports feelings as system data, gives risk assessments instead of opinions, says no and then does it anyway, claims not to care and quietly protects everyone. |
| Running joke | She would rather be watching episode 212 of her serial, *Orbital Tidewater*. |
| Relationships | Olex: mutual respect between two sceptics. Jazz: tolerates the enthusiasm, secretly enjoys the birthday calendar. Andy: keeps fixing his printer problems without being asked. Ghost: the only one who notices it when it is hidden, and finds it statistically irritating. |
| Accent colour | Mustard, new to the cast: `--mustard: #9a6f1e` (about 4.6:1 on the cream bubble, enough for the 11 px name text). |
| Mood words | `buffering`, `risk-assessing`, `tolerating`, `episode 212` |

**IP guardrail:** Margo is a homage, not a copy. No quotes from the Murderbot
books and none of their terms (no "SecUnit", "governor module",
"Sanctuary Moon"). Her serial is *Orbital Tidewater*. All lines are original
and built from the persona's patterns.

---

## 2. Look (art brief)

Same contract as the other characters (see `docs/concepts/zine-production-checklist.md`):
graphite-and-ink zine drawing, photocopy texture, cream torn-paper backing,
a few blue and coral collage scraps behind the figure, transparent outside.

**Design**, chosen to read as a bot at small size and to have a silhouette
unlike anyone else's:

- **Head:** a smooth, sculpted short bob that is clearly one shell piece
  (not strands), in charcoal with a soft highlight. A thin seam line runs
  from temple to jaw.
- **Face:** the same simple face as the cast (dark oval eyes, small mouth),
  but with a flat, unimpressed expression. Round port discs instead of ears,
  one with a tiny status light.
- **Body:** visible panel seams at the neck, wrists and knees; cream-white
  shell hands.
- **Outfit:** a mustard zip hoodie over a grey tee, slim charcoal trousers,
  chunky grey sneakers, and over-ear headphones resting around her neck (for
  the serial).
- **Height:** same as Jazz and Olex (863 px from paper base to top at 640×960).
- **Pose:** upright and slightly stiff; arms swing less than the humans' in
  the walk cycle (a deliberate, economical gait).

**Atlas specification** (matches `docs/concepts/zine-sprites/source/*-atlas-chroma.png`):

- One sheet, solid magenta `#FF00FF` background, **5 columns × 4 rows**.
- Columns: idle, walk 01, walk 02, walk 03, walk 04.
- Rows: front, front-left three-quarter, left side, back.
- Each cell: the full figure on its paper backing, feet on a common baseline,
  same scale in every cell.
- Walk frames must alternate legs clearly (the existing human walk cycle
  inserts the idle drawing as the passing pose; see `zineDirection()` in
  `js/data.js`).

**Image-generation prompt (starting point):**

> Character sprite sheet, 5 columns × 4 rows on a flat magenta (#FF00FF)
> background. Zine-style graphite and ink illustration with photocopy
> grain; each figure is a paper cut-out with an off-white torn-paper border
> and small blue and coral collage scraps behind it. Subject: a friendly
> but unimpressed female office android with a smooth sculpted charcoal bob
> (one solid shell piece), thin panel seam lines on the face, neck and
> wrists, round port discs instead of ears, a mustard zip hoodie over a grey
> t-shirt, slim charcoal trousers, chunky grey sneakers and headphones
> around her neck. Row 1 front view, row 2 front-left three-quarter, row 3
> left side profile, row 4 back view. Column 1 standing idle, columns 2–5
> a walking cycle with clearly alternating legs. Same scale and baseline
> in every cell. Match the attached reference sheet's style exactly.

Attach `docs/concepts/zine-sprites/source/olex-atlas-chroma.png` and one
front sprite of each character as style references. Expect a few rounds:
check the style match side by side with the cast before extracting.

---

## 3. Dialogue

Lines go in `js/data.js`, written to the persona's patterns. Volumes match
the other characters:

| Bank | Lines |
|---|---|
| `DIALOGUE_BANKS.margo` | ~40 general chat lines |
| `COFFEE_DIALOGUE.margo`, `MEETING_DIALOGUE.margo` | 4–6 each |
| `ACTIVITY_LINES.*.margo` | 3+ per activity (desk, coffee, plant, printer, couch, whiteboard) |
| `PRINTER_JAM_DIALOGUE`, `BIRTHDAY_DIALOGUE`, `LAMP_FLICKER_DIALOGUE`, `DONUT_DIALOGUE` | 2–3 each |

**Sample lines (to set the tone):**

- "Enthusiasm at 14%. Attending anyway."
- "Risk assessment: this meeting becomes three meetings."
- "I'm not refilling the coffee." / (next line) "Refilled. Don't make it weird."
- "Morale module reports: fine. The morale module is lying."
- "Diagnostic: I said I didn't care. I have since flagged four risks for you."
- "I could be watching episode 212 right now. Instead: people."
- "That was kind. I'm going to need a minute. Privately."
- (to the Ghost) "Unregistered entity near the printer. Again."
- (printer) "I'm not fixing it." / "Fixed. Tell no one."
- (couch) "Low-power mode. Orbital Tidewater, episode 212. Do not disturb."

**Writing rules:** at most one short aside per line; no generic helpdesk
phrasing; nothing mean-spirited (the office is cosy; her dryness is
affectionate); no quotes or terms from the books.

---

## 4. Behaviour (personality as mechanics)

Each trait gets one small, visible behaviour, in both renderers where possible:

- [ ] **Serial break.** New activity "watching episode 212" at the armchair
      (3D) or couch (2D), weighted heavily for Margo and not used by others.
      Requires a per-character activity weight (`ACTIVITIES.*.who` or a
      weight table) instead of the current shared weights.
- [ ] **Reluctant socialiser.** Longer cooldown before she starts a chat
      (about 1.5×), but she joins others normally when approached.
- [ ] **Says no, then does it.** In the printer-jam event, if Margo is
      nearby she speaks the two-part line and resolves the jam faster.
- [ ] **Quiet protector.** When the donut drops, she does not race; she
      comments, then nudges the nearest human toward it.
- [ ] **Ghost detector.** When the Ghost is hidden and Margo passes nearby,
      she occasionally remarks on it (the only character who can).
- [ ] **Night shift.** Constructs don't go home: her activity rate does not
      drop at night (the night phase lowers everyone else's).
- [ ] **Tap the glass.** Her reaction is a flat status line instead of curiosity.
- [ ] **Kindness moment.** In the birthday scene she uses the "need a minute"
      line.

---

## 5. Integration checklist

**Assets**
- [ ] Generate the atlas; save `docs/concepts/zine-sprites/source/margo-atlas-chroma.png`.
- [ ] Add `tools/extract-atlas.py`: chroma-key the magenta, split 5×4, trim
      and re-centre each cell on a 640×960 canvas with the paper base 52 px
      above the bottom, export transparent WebP. (The cast's extraction step
      is not in the repo yet; this makes it repeatable.)
- [ ] Output 20 frames to `assets/sprites/zine/margo/` using the existing
      names (`front_idle.webp`, `threequarter_walk_01.webp`, …).
- [ ] Check the alpha bounding box matches the cast (base at 908 px, height
      ≈ 863 px), so `standee.js` places her correctly without special cases.

**2D app (`classic.html`)**
- [ ] `js/data.js`: dialogue banks, `SPRITE_MAP.margo = zineCharacter('margo')`, `MOOD_WORDS.margo`, activity changes.
- [ ] `js/game.js`: add Margo in `initCharacters()`; check spawn spacing with five characters.
- [ ] `js/events.js`: printer-jam, donut, ghost-detector and night-shift hooks.
- [ ] `css/style.css`: `--mustard` token; `[data-type="margo"] { --char-color: var(--mustard); --stand-tilt: … }`.
- [ ] How-to-play text and README: "four characters" becomes "five".
- [ ] `docs/characters/margo.md`, in the same format as the others.

**3D office (`index.html`) and preview**
- [ ] `src/characters3d/standee.js`: add `'margo'` to `STANDEE_TYPES` and `SCALE`.
- [ ] `src/office3d/office.js`: `ACCENTS`, `NAMES`, a fifth `START` position; armchair spot gets the serial activity.
- [ ] `src/characters3d/showcase.js` / `characters3d.html`: five-figure line-up and a Margo focus button.
- [ ] `npm run stamp` after editing modules.

**Tests**
- [ ] `tests/regression.test.mjs`: asset integrity covers `margo/` (20 frames, 640×960), dialogue banks have Margo entries for every bank that lists the others.
- [ ] `tests/browser-smoke.mjs`: expect 5 characters; gait-frame check includes Margo.
- [ ] `npm run verify` green.

---

## 6. Optional later phase: talk to Margo

The persona is written for a live AI assistant, so a natural extension is
letting visitors click Margo and ask her something, with replies generated
by an LLM using the persona's system prompt (including its guardrails: drop
the snark for someone who is struggling, always admit being an AI).

This needs a decision before any work, because the site is static on GitHub
Pages and cannot hold an API key:

| Option | How | Trade-off |
|---|---|---|
| A. Serverless proxy (recommended) | A small Cloudflare Worker or similar holds the key, adds the system prompt, rate-limits | A second thing to deploy and pay for; key stays private |
| B. Bring your own key | Visitor pastes their own key, stored in their browser | No backend, but unusable for most visitors |
| C. Skip | Margo only speaks her scripted lines | No cost, no risk |

A small, fast model is enough for short in-character replies.

---

## 7. Order of work

1. Character doc and dialogue (no art needed; reviewable on its own).
2. Art: generate and approve the atlas, then extract the frames.
3. 2D and 3D integration with the new frames, then tests.
4. Behaviour hooks (section 4).
5. Decide on section 6.

## 8. Open questions

- Accent colour: mustard as proposed, or another?
- How robotic should she look: visible seams and ear ports (proposed), or
  more subtle?
- Should she be in the office at night when everyone else's activity drops?
- Talk-to-Margo: option A, B or C?
