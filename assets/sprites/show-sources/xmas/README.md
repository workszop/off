# Christmas act sources

Source strips for the Christmas show act (`ACT_LOOPS.xmas` in
`src/characters3d/standee.js`). Everyone wears a Santa hat and sings a carol:
Andy holds a wrapped gift, Jazz an open songbook, Olex rings a small hand
bell (and wears a striped scarf) and Margo carries a plate of star cookies;
the ghost does not take part.

## How they were made

Each strip was generated with the image tool through the `/img` skill, one
run per strip, on 2026-11-23. The reference was the character's own
`assets/sprites/zine/<name>/front_idle.webp` (front strips) or `back_idle.webp`
(rear strips). In-between and rear strips also got the already generated
strip of the same loop as a second reference, so pose, hat, held object and
scale carry over. The exact prompts are below.

## Layout

Per character (`andy`, `jazz`, `olex`, `margo-v3`) four 1536x1024 RGBA strips,
each with four figures in one row on a transparent background:

| File | View | Figures 1-4 become |
| --- | --- | --- |
| `<name>.png` | front, key poses | `front_xmas_01`, `03`, `05`, `07` |
| `<name>-between.png` | front, in-betweens | `front_xmas_02`, `04`, `06`, `08` |
| `<name>-back.png` | rear, key poses | `back_xmas_01`, `03`, `05`, `07` |
| `<name>-back-between.png` | rear, in-betweens | `back_xmas_02`, `04`, `06`, `08` |

In-between k sits between key pose k and k+1 (the fourth leads back to the
first). The figures are not in equal-width cells, so the builder splits each
strip at its transparent gutters (columns with alpha > 128) and refuses a
strip where it does not find exactly four figures.

Build the 64 frames (640x960 WebP, quality 85, figure bottom at y=908) with:

```sh
python3 tools/build-show-sprites.py xmas
python3 -m unittest tests.test_show_sprites
```

## Scale

The front and rear strips came out at different sizes (Olex's front figures
are about a fifth smaller than her rear ones), so the front strips of a
character share one scale and the rear strips another. In each view the
tallest figure, hat included, is fitted to the height of the standing
`front_idle` figure times a per-character ratio in
`tools/build-show-sprites.py` (Andy 1.05, Jazz 1.09, Olex 1.05, Margo 1.07).
The hat adds height above the head, so a ratio of 1 would shrink everyone;
the ratios were tuned on contact sheets against the idle drawings. Keeping
the heads exactly the idle size would need about 1.1 to 1.15, which would
push the top of the hat out of the 640x960 frame, so these are the largest
ratios that keep it inside: heads come out about the idle size and bodies
about 5% shorter.

## Prompts

### andy.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/andy/front_idle.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing, wearing a red Santa hat with white fur trim and a white pompom, holding a wrapped Christmas gift box in green paper with a red ribbon bow in both hands in front of his chest, singing a Christmas carol. Four different moments of one singing loop: 1) gift held at chest height, mouth open singing, head level; 2) gift lifted a little and offered forward, slight lean forward; 3) gift held to one side, one knee bent, head tilted, eyes closed; 4) gift lowered to waist height, weight on the other leg, head nodding. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### andy-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/andy/front_idle.webp
- reference: assets/sprites/show-sources/xmas/andy.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing, wearing a red Santa hat with white fur trim and a white pompom, holding a wrapped Christmas gift box in green paper with a red ribbon bow in both hands in front of his chest, singing a Christmas carol. The second reference image is the existing strip of four key poses of this singing loop (1) gift held at chest height, mouth open singing, head level; 2) gift lifted a little and offered forward, slight lean forward; 3) gift held to one side, one knee bent, head tilted, eyes closed; 4) gift lowered to waist height, weight on the other leg, head nodding). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same hat and held object, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### andy-back.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/andy/back_idle.webp
- reference: assets/sprites/show-sources/xmas/andy.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing, wearing a red Santa hat with white fur trim and a white pompom, holding a wrapped Christmas gift box in green paper with a red ribbon bow in both hands in front of his chest, singing a Christmas carol. The first reference is the character seen from behind; the second reference is the same singing loop seen from the front. Draw the same four moments as seen from behind, in the same order: 1) gift held at chest height, mouth open singing, head level; 2) gift lifted a little and offered forward, slight lean forward; 3) gift held to one side, one knee bent, head tilted, eyes closed; 4) gift lowered to waist height, weight on the other leg, head nodding. Same hat, same held object and same scale as the front strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### andy-back-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/andy/back_idle.webp
- reference: assets/sprites/show-sources/xmas/andy-back.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing, wearing a red Santa hat with white fur trim and a white pompom, holding a wrapped Christmas gift box in green paper with a red ribbon bow in both hands in front of his chest, singing a Christmas carol. The second reference image is the existing rear-view strip of four key poses of this singing loop. Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same hat and held object, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### jazz.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/jazz/front_idle.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing, wearing a red Santa hat with white fur trim and a white pompom, holding an open red carol songbook in both hands in front of her, singing a Christmas carol. Four different moments of one singing loop: 1) songbook at chest height, mouth open singing, looking ahead; 2) songbook lowered a little, slight lean left, looking down at the page; 3) songbook raised, one knee bent, head tilted back, eyes closed, mouth wide open; 4) songbook at chest height, slight lean right, head nodding. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### jazz-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/jazz/front_idle.webp
- reference: assets/sprites/show-sources/xmas/jazz.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing, wearing a red Santa hat with white fur trim and a white pompom, holding an open red carol songbook in both hands in front of her, singing a Christmas carol. The second reference image is the existing strip of four key poses of this singing loop (1) songbook at chest height, mouth open singing, looking ahead; 2) songbook lowered a little, slight lean left, looking down at the page; 3) songbook raised, one knee bent, head tilted back, eyes closed, mouth wide open; 4) songbook at chest height, slight lean right, head nodding). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same hat and held object, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### jazz-back.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/jazz/back_idle.webp
- reference: assets/sprites/show-sources/xmas/jazz.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing, wearing a red Santa hat with white fur trim and a white pompom, holding an open red carol songbook in both hands in front of her, singing a Christmas carol. The first reference is the character seen from behind; the second reference is the same singing loop seen from the front. Draw the same four moments as seen from behind, in the same order: 1) songbook at chest height, mouth open singing, looking ahead; 2) songbook lowered a little, slight lean left, looking down at the page; 3) songbook raised, one knee bent, head tilted back, eyes closed, mouth wide open; 4) songbook at chest height, slight lean right, head nodding. Same hat, same held object and same scale as the front strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### jazz-back-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/jazz/back_idle.webp
- reference: assets/sprites/show-sources/xmas/jazz-back.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing, wearing a red Santa hat with white fur trim and a white pompom, holding an open red carol songbook in both hands in front of her, singing a Christmas carol. The second reference image is the existing rear-view strip of four key poses of this singing loop. Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same hat and held object, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### olex.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/olex/front_idle.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing, wearing a red Santa hat with white fur trim and a white pompom and a striped red and white scarf, singing a Christmas carol and ringing a small golden hand bell held up in one hand. Four different moments of one singing loop: 1) bell raised to shoulder height, mouth open singing, head level; 2) bell swung to the left, slight lean left; 3) bell raised higher, one knee bent, head tilted back, eyes closed; 4) bell swung to the right, weight on the other leg, head nodding. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### olex-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/olex/front_idle.webp
- reference: assets/sprites/show-sources/xmas/olex.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing, wearing a red Santa hat with white fur trim and a white pompom and a striped red and white scarf, singing a Christmas carol and ringing a small golden hand bell held up in one hand. The second reference image is the existing strip of four key poses of this singing loop (1) bell raised to shoulder height, mouth open singing, head level; 2) bell swung to the left, slight lean left; 3) bell raised higher, one knee bent, head tilted back, eyes closed; 4) bell swung to the right, weight on the other leg, head nodding). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same hat and held object, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### olex-back.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/olex/back_idle.webp
- reference: assets/sprites/show-sources/xmas/olex.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing, wearing a red Santa hat with white fur trim and a white pompom and a striped red and white scarf, singing a Christmas carol and ringing a small golden hand bell held up in one hand. The first reference is the character seen from behind; the second reference is the same singing loop seen from the front. Draw the same four moments as seen from behind, in the same order: 1) bell raised to shoulder height, mouth open singing, head level; 2) bell swung to the left, slight lean left; 3) bell raised higher, one knee bent, head tilted back, eyes closed; 4) bell swung to the right, weight on the other leg, head nodding. Same hat, same held object and same scale as the front strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### olex-back-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/olex/back_idle.webp
- reference: assets/sprites/show-sources/xmas/olex-back.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing, wearing a red Santa hat with white fur trim and a white pompom and a striped red and white scarf, singing a Christmas carol and ringing a small golden hand bell held up in one hand. The second reference image is the existing rear-view strip of four key poses of this singing loop. Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same hat and held object, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### margo-v3.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/margo-v3/front_idle.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing, wearing a red Santa hat with white fur trim and a white pompom, holding a round plate of gingerbread star cookies in both hands at waist height, singing a Christmas carol; keep her circular articulated joints. Four different moments of one singing loop: 1) plate held level, mouth open singing, head level; 2) plate offered forward a little, slight lean left; 3) plate held to one side, head tilted, eyes closed; 4) plate lifted to chest height, slight lean right, head nodding. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### margo-v3-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/margo-v3/front_idle.webp
- reference: assets/sprites/show-sources/xmas/margo-v3.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing, wearing a red Santa hat with white fur trim and a white pompom, holding a round plate of gingerbread star cookies in both hands at waist height, singing a Christmas carol; keep her circular articulated joints. The second reference image is the existing strip of four key poses of this singing loop (1) plate held level, mouth open singing, head level; 2) plate offered forward a little, slight lean left; 3) plate held to one side, head tilted, eyes closed; 4) plate lifted to chest height, slight lean right, head nodding). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same hat and held object, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### margo-v3-back.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/margo-v3/back_idle.webp
- reference: assets/sprites/show-sources/xmas/margo-v3.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing, wearing a red Santa hat with white fur trim and a white pompom, holding a round plate of gingerbread star cookies in both hands at waist height, singing a Christmas carol; keep her circular articulated joints. The first reference is the character seen from behind; the second reference is the same singing loop seen from the front. Draw the same four moments as seen from behind, in the same order: 1) plate held level, mouth open singing, head level; 2) plate offered forward a little, slight lean left; 3) plate held to one side, head tilted, eyes closed; 4) plate lifted to chest height, slight lean right, head nodding. Same hat, same held object and same scale as the front strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.

### margo-v3-back-between.png

- date: 2026-11-23
- aspect: landscape
- reference: assets/sprites/zine/margo-v3/back_idle.webp
- reference: assets/sprites/show-sources/xmas/margo-v3-back.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing, wearing a red Santa hat with white fur trim and a white pompom, holding a round plate of gingerbread star cookies in both hands at waist height, singing a Christmas carol; keep her circular articulated joints. The second reference image is the existing rear-view strip of four key poses of this singing loop. Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same hat and held object, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow.
