# Murder mystery act sources

Source strips for the murder mystery show, which casts two acts
(`ACT_LOOPS.murder` and `ACT_LOOPS.body` in `src/characters3d/standee.js`):

- `murder`: Jazz the detective (deerstalker, magnifying glass), Olex on
  forensics (white gloves, notepad and pencil) and Margo the inspector
  (trench coat, fedora), standing and looking down at the floor in front of
  them. Front and rear views.
- `body`: Andy playing dead, lying on his back with his arms and legs
  sprawled, drawn as seen from directly above with his head at the top of
  the frame. One view only (the card lies face up on the floor).

The ghost does not take part.

## How they were made

Each strip was generated with the image tool through the `/img` skill, one
run per strip, on 2026-11-23. The reference was the character's own
`assets/sprites/zine/<name>/front_idle.webp` (front strips) or `back_idle.webp`
(rear strips). In-between and rear strips also got the already generated
strip of the same loop as a second reference, so pose, costume, props and
scale carry over. The exact prompts are below.

## Layout

Four figures in one row on a transparent background in every strip. Most
strips are 1536x1024 RGBA; `olex-between.png` came out 1774x887, which the
builder does not mind (see Scale).

For `jazz`, `olex` and `margo-v3` (act `murder`):

| File | View | Figures 1-4 become |
| --- | --- | --- |
| `<name>.png` | front, key poses | `front_murder_01`, `03`, `05`, `07` |
| `<name>-between.png` | front, in-betweens | `front_murder_02`, `04`, `06`, `08` |
| `<name>-back.png` | rear, key poses | `back_murder_01`, `03`, `05`, `07` |
| `<name>-back-between.png` | rear, in-betweens | `back_murder_02`, `04`, `06`, `08` |

For `andy` (act `body`, no rear view):

| File | View | Figures 1-4 become |
| --- | --- | --- |
| `andy.png` | from above, key poses | `front_body_01`, `03`, `05`, `07` |
| `andy-between.png` | from above, in-betweens | `front_body_02`, `04`, `06`, `08` |

In-between k sits between key pose k and k+1 (the fourth leads back to the
first). The figures are not in equal-width cells, so the builder splits each
strip at its transparent gutters (columns with alpha > 128) and refuses a
strip where it does not find exactly four figures.

Build the 56 frames (640x960 WebP, quality 85) with:

```sh
python3 tools/build-show-sprites.py murder
python3 -m unittest tests.test_show_sprites
```

## Scale

These strips were drawn at a different scale in every strip: Andy's
in-between figures are about an eighth smaller than his key poses (525 px
against 597 px tall), and Olex's in-between strip, a different image size
altogether, draws her about 5% larger than her key poses. So every strip is
normalised on its own: the median figure height of the strip (a median, so
one pose that leans forward or stretches up does not move the scale) is
fitted to the height of the character's standing `front_idle` figure times a
per-character ratio in `tools/build-show-sprites.py`. The same character is
then the same size from one frame to the next.

- Investigators (`murder`, standing on the baseline at y=908 like every
  other act): Jazz 1.06, Olex 1.0, Margo 1.04. Jazz's deerstalker and
  Margo's fedora add height above the head, so their ratios are above 1;
  Olex wears no hat. The ratios were tuned on contact sheets against the idle
  drawings: heads come out about the idle size, everything inside the frame.
- The body (`body`): Andy's body length (head to feet, paper backing
  included) is his standing idle figure height (ratio 1, 860 of 960 px). His
  sprawled arms make the figure about 540 px wide, which fits the 640-wide
  frame, so no reduction was needed (the builder prints the fit factor:
  1.000). In this scale the head comes out a little larger than in the idle
  drawing, because the lying figure is drawn with shorter limbs.

## Placement of the lying figure

Lying frames have no baseline. The figure's bounding box is centred
vertically in the frame (its middle at y=480) and its head horizontally (at
x=320; the middle of the head, unlike the bounding box, does not move when an
arm or a knee swings out). The standee lays the card down about its paper
base and shifts it back by half the frame, so the middle of the frame, the
middle of the body, lies on the character's mark, the head away from the
camera.

## Prompts

### jazz.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/jazz/front_idle.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing as a detective investigating a crime scene, wearing a brown checked deerstalker detective hat and holding a large round magnifying glass in one hand, looking down at the floor in front of her. Four different moments of one acting loop: 1) magnifying glass held low in front, leaning forward, peering down through it; 2) magnifying glass raised to her eye, one eyebrow up, head tilted; 3) straightening up, magnifying glass at chest height, free hand on chin, thinking; 4) pointing down at the floor with the free hand, mouth open in surprise, magnifying glass at her side. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### andy.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/andy/front_idle.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, lying flat on his back on the floor playing dead, seen from directly above in a bird's-eye view, drawn upright in the cell with his head at the top and his feet at the bottom, arms and legs sprawled out, glasses askew; the whole body from head to feet is visible and the paper backing follows the sprawled body. Four different moments of one acting loop: 1) eyes closed, tongue sticking out, arms spread wide; 2) one eye peeking open, tongue out, arms spread wide; 3) eyes closed, one hand lifted slightly off the floor, one knee bent outward; 4) both eyes open looking to the side, mouth shut tight, arms spread wide. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### olex.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/olex/front_idle.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing as a forensic photographer at a crime scene, wearing white disposable gloves and holding a small notepad in one hand and a pencil in the other, looking down at the floor in front of her. Four different moments of one acting loop: 1) writing on the notepad, head down; 2) pencil raised, looking down at the floor past the notepad, slight lean forward; 3) tapping the pencil against her chin, eyes up, thinking; 4) holding the notepad out and pointing at it with the pencil, head tilted. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### margo-v3.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/margo-v3/front_idle.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing as a police inspector at a crime scene, wearing a beige trench coat over her dress and a grey fedora hat, looking down at the floor in front of her; keep her circular articulated joints. Four different moments of one acting loop: 1) arms crossed, head tilted down, stern; 2) one hand on her hip, the other hand pointing down at the floor; 3) one hand adjusting the brim of the fedora, eyes narrowed; 4) both hands spread in a questioning shrug, head tilted. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### olex-back.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/olex/back_idle.webp
- reference: assets/sprites/show-sources/murder/olex.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing as a forensic photographer at a crime scene, wearing white disposable gloves and holding a small notepad in one hand and a pencil in the other, looking down at the floor in front of her. The first reference is the character seen from behind; the second reference is the same acting loop seen from the front. Draw the same four moments as seen from behind, in the same order: 1) writing on the notepad, head down; 2) pencil raised, looking down at the floor past the notepad, slight lean forward; 3) tapping the pencil against her chin, eyes up, thinking; 4) holding the notepad out and pointing at it with the pencil, head tilted. Same costume, same props and same scale as the front strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### olex-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/olex/front_idle.webp
- reference: assets/sprites/show-sources/murder/olex.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing as a forensic photographer at a crime scene, wearing white disposable gloves and holding a small notepad in one hand and a pencil in the other, looking down at the floor in front of her. The second reference image is the existing strip of four key poses of this acting loop (1) writing on the notepad, head down; 2) pencil raised, looking down at the floor past the notepad, slight lean forward; 3) tapping the pencil against her chin, eyes up, thinking; 4) holding the notepad out and pointing at it with the pencil, head tilted). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same costume and props, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### andy-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/andy/front_idle.webp
- reference: assets/sprites/show-sources/murder/andy.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, lying flat on his back on the floor playing dead, seen from directly above in a bird's-eye view, drawn upright in the cell with his head at the top and his feet at the bottom, arms and legs sprawled out, glasses askew; the whole body from head to feet is visible and the paper backing follows the sprawled body. The second reference image is the existing strip of four key poses of this acting loop (1) eyes closed, tongue sticking out, arms spread wide; 2) one eye peeking open, tongue out, arms spread wide; 3) eyes closed, one hand lifted slightly off the floor, one knee bent outward; 4) both eyes open looking to the side, mouth shut tight, arms spread wide). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same costume and props, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### jazz-back.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/jazz/back_idle.webp
- reference: assets/sprites/show-sources/murder/jazz.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing as a detective investigating a crime scene, wearing a brown checked deerstalker detective hat and holding a large round magnifying glass in one hand, looking down at the floor in front of her. The first reference is the character seen from behind; the second reference is the same acting loop seen from the front. Draw the same four moments as seen from behind, in the same order: 1) magnifying glass held low in front, leaning forward, peering down through it; 2) magnifying glass raised to her eye, one eyebrow up, head tilted; 3) straightening up, magnifying glass at chest height, free hand on chin, thinking; 4) pointing down at the floor with the free hand, mouth open in surprise, magnifying glass at her side. Same costume, same props and same scale as the front strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### jazz-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/jazz/front_idle.webp
- reference: assets/sprites/show-sources/murder/jazz.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing as a detective investigating a crime scene, wearing a brown checked deerstalker detective hat and holding a large round magnifying glass in one hand, looking down at the floor in front of her. The second reference image is the existing strip of four key poses of this acting loop (1) magnifying glass held low in front, leaning forward, peering down through it; 2) magnifying glass raised to her eye, one eyebrow up, head tilted; 3) straightening up, magnifying glass at chest height, free hand on chin, thinking; 4) pointing down at the floor with the free hand, mouth open in surprise, magnifying glass at her side). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same costume and props, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### margo-v3-back.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/margo-v3/back_idle.webp
- reference: assets/sprites/show-sources/murder/margo-v3.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing as a police inspector at a crime scene, wearing a beige trench coat over her dress and a grey fedora hat, looking down at the floor in front of her; keep her circular articulated joints. The first reference is the character seen from behind; the second reference is the same acting loop seen from the front. Draw the same four moments as seen from behind, in the same order: 1) arms crossed, head tilted down, stern; 2) one hand on her hip, the other hand pointing down at the floor; 3) one hand adjusting the brim of the fedora, eyes narrowed; 4) both hands spread in a questioning shrug, head tilted. Same costume, same props and same scale as the front strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### margo-v3-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/margo-v3/front_idle.webp
- reference: assets/sprites/show-sources/murder/margo-v3.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing as a police inspector at a crime scene, wearing a beige trench coat over her dress and a grey fedora hat, looking down at the floor in front of her; keep her circular articulated joints. The second reference image is the existing strip of four key poses of this acting loop (1) arms crossed, head tilted down, stern; 2) one hand on her hip, the other hand pointing down at the floor; 3) one hand adjusting the brim of the fedora, eyes narrowed; 4) both hands spread in a questioning shrug, head tilted). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same costume and props, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### olex-back-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/olex/back_idle.webp
- reference: assets/sprites/show-sources/murder/olex-back.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing as a forensic photographer at a crime scene, wearing white disposable gloves and holding a small notepad in one hand and a pencil in the other, looking down at the floor in front of her. The second reference image is the existing rear-view strip of four key poses of this acting loop. Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same costume and props, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### jazz-back-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/jazz/back_idle.webp
- reference: assets/sprites/show-sources/murder/jazz-back.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing as a detective investigating a crime scene, wearing a brown checked deerstalker detective hat and holding a large round magnifying glass in one hand, looking down at the floor in front of her. The second reference image is the existing rear-view strip of four key poses of this acting loop. Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same costume and props, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### margo-v3-back-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/margo-v3/back_idle.webp
- reference: assets/sprites/show-sources/murder/margo-v3-back.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing as a police inspector at a crime scene, wearing a beige trench coat over her dress and a grey fedora hat, looking down at the floor in front of her; keep her circular articulated joints. The second reference image is the existing rear-view strip of four key poses of this acting loop. Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same costume and props, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.
