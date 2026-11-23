# Band act sources

Source strips for the garage band show act (`ACT_LOOPS.band` in
`src/characters3d/standee.js`). Jazz plays drums seated on a stool, Olex an
electric guitar, Andy a bass and Margo an invisible keyboard; the ghost does
not play.

## How they were made

Each strip was generated with the image tool through the `/img` skill, one
run per strip, on 2026-11-22. The reference was the character's own
`assets/sprites/zine/<name>/front_idle.webp` (front strips) or `back_idle.webp`
(rear strips). In-between and rear strips also got the already generated
strip of the same loop as a second reference, so pose, instrument and scale
carry over. The exact prompts are below.

## Layout

Per character (`andy`, `jazz`, `olex`, `margo-v3`) four 1536x1024 RGBA strips,
each with four figures in one row on a transparent background:

| File | View | Figures 1-4 become |
| --- | --- | --- |
| `<name>.png` | front, key poses | `front_band_01`, `03`, `05`, `07` |
| `<name>-between.png` | front, in-betweens | `front_band_02`, `04`, `06`, `08` |
| `<name>-back.png` | rear, key poses | `back_band_01`, `03`, `05`, `07` |
| `<name>-back-between.png` | rear, in-betweens | `back_band_02`, `04`, `06`, `08` |

In-between k sits between key pose k and k+1 (the fourth leads back to the
first). The figures are not in equal-width cells, so the builder splits each
strip at its transparent gutters (columns with alpha > 128) and refuses a
strip where it does not find exactly four figures.

Build the 64 frames (640x960 WebP, figure bottom at y=908) with:

```sh
python3 tools/build-show-sprites.py band
python3 -m unittest tests.test_show_sprites
```

All frames of one character share one scale, fitted to the height of the
standing `front_idle` figure. Jazz is seated, so she has her own height ratio
in `tools/build-show-sprites.py`, tuned to keep her head the size it has in her
idle drawing.

## Prompts

### andy.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/andy/front_idle.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing and playing a four-string electric bass guitar on a strap, with a long neck and a dark body. Four different moments of one playing loop: 1) plucking hand resting on the strings, head level; 2) plucking hand pulled away, slight lean back; 3) bass neck tipped up, one knee bent, head nodding down; 4) weight on the other leg, shoulders swaying, head tilted. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### andy-between.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/andy/front_idle.webp
- reference: assets/sprites/show-sources/band/andy.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing and playing a four-string electric bass guitar on a strap, with a long neck and a dark body. The second reference image is the existing strip of four key poses of this playing loop (1) plucking hand resting on the strings, head level; 2) plucking hand pulled away, slight lean back; 3) bass neck tipped up, one knee bent, head nodding down; 4) weight on the other leg, shoulders swaying, head tilted). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same instrument, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### andy-back.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/andy/back_idle.webp
- reference: assets/sprites/show-sources/band/andy.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing and playing a four-string electric bass guitar on a strap, with a long neck and a dark body. The first reference is the character seen from behind; the second reference is the same playing loop seen from the front. Draw the same four moments as seen from behind, in the same order: 1) plucking hand resting on the strings, head level; 2) plucking hand pulled away, slight lean back; 3) bass neck tipped up, one knee bent, head nodding down; 4) weight on the other leg, shoulders swaying, head tilted. Same instrument and same scale as the front strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### andy-back-between.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/andy/back_idle.webp
- reference: assets/sprites/show-sources/band/andy-back.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing and playing a four-string electric bass guitar on a strap, with a long neck and a dark body. The second reference image is the existing rear-view strip of four key poses of this playing loop. Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same instrument, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### jazz.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/jazz/front_idle.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, sitting upright on a small round drum stool, playing drums with a wooden drumstick in each hand; no drums or cymbals are drawn, only the character, the stool and the sticks. Four different moments of one playing loop: 1) right stick raised high, left stick low; 2) right stick striking down in front, left stick rising; 3) left stick raised high, right stick low, head tilted; 4) both sticks crossing low in front, leaning forward. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### jazz-between.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/jazz/front_idle.webp
- reference: assets/sprites/show-sources/band/jazz.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, sitting upright on a small round drum stool, playing drums with a wooden drumstick in each hand; no drums or cymbals are drawn, only the character, the stool and the sticks. The second reference image is the existing strip of four key poses of this playing loop (1) right stick raised high, left stick low; 2) right stick striking down in front, left stick rising; 3) left stick raised high, right stick low, head tilted; 4) both sticks crossing low in front, leaning forward). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same instrument, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### jazz-back.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/jazz/back_idle.webp
- reference: assets/sprites/show-sources/band/jazz.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), sitting upright on a small round drum stool, playing drums with a wooden drumstick in each hand; no drums or cymbals are drawn, only the character, the stool and the sticks. The first reference is the character seen from behind; the second reference is the same playing loop seen from the front. Draw the same four moments as seen from behind, in the same order: 1) right stick raised high, left stick low; 2) right stick striking down in front, left stick rising; 3) left stick raised high, right stick low, head tilted; 4) both sticks crossing low in front, leaning forward. Same instrument and same scale as the front strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### jazz-back-between.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/jazz/back_idle.webp
- reference: assets/sprites/show-sources/band/jazz-back.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), sitting upright on a small round drum stool, playing drums with a wooden drumstick in each hand; no drums or cymbals are drawn, only the character, the stool and the sticks. The second reference image is the existing rear-view strip of four key poses of this playing loop. Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same instrument, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### olex.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/olex/front_idle.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character from the reference, full body, front view, standing and playing an electric guitar on a strap. Four different moments of one strumming loop: 1) strumming hand up, head level; 2) strumming hand down across the strings, slight lean forward; 3) guitar neck raised, one knee bent, head tilted back; 4) strumming hand down, weight on the other leg, head nodding. Preserve the exact character: same face, hair, glasses if any, outfit, body proportions and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The guitar is drawn in the same paper-collage style. Same character scale in every cell, feet on the same baseline, each figure standing on its small paper base as in the reference, clear transparent gutters between cells, nothing crossing between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### olex-between.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/olex/front_idle.webp
- reference: assets/sprites/show-sources/band/olex.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing and playing an electric guitar on a strap. The second reference image is the existing strip of four key poses of this playing loop (1) strumming hand up, head level; 2) strumming hand down across the strings, slight lean forward; 3) guitar neck raised, one knee bent, head tilted back; 4) strumming hand down, weight on the other leg, head nodding). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same instrument, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### olex-back.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/olex/back_idle.webp
- reference: assets/sprites/show-sources/band/olex.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing and playing an electric guitar on a strap. The first reference is the character seen from behind; the second reference is the same playing loop seen from the front. Draw the same four moments as seen from behind, in the same order: 1) strumming hand up, head level; 2) strumming hand down across the strings, slight lean forward; 3) guitar neck raised, one knee bent, head tilted back; 4) strumming hand down, weight on the other leg, head nodding. Same instrument and same scale as the front strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### olex-back-between.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/olex/back_idle.webp
- reference: assets/sprites/show-sources/band/olex-back.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing and playing an electric guitar on a strap. The second reference image is the existing rear-view strip of four key poses of this playing loop. Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same instrument, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### margo-v3.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/margo-v3/front_idle.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing and playing an invisible keyboard at waist height in front of her, both forearms held forward with fingers spread downward; no keyboard or instrument is drawn, only the character; keep her circular articulated joints. Four different moments of one playing loop: 1) both hands down level; 2) left hand lifted, right hand down, slight lean left; 3) right hand lifted, left hand down, slight lean right, head tilted; 4) both hands lifted a little, head nodding down. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### margo-v3-between.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/margo-v3/front_idle.webp
- reference: assets/sprites/show-sources/band/margo-v3.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing and playing an invisible keyboard at waist height in front of her, both forearms held forward with fingers spread downward; no keyboard or instrument is drawn, only the character; keep her circular articulated joints. The second reference image is the existing strip of four key poses of this playing loop (1) both hands down level; 2) left hand lifted, right hand down, slight lean left; 3) right hand lifted, left hand down, slight lean right, head tilted; 4) both hands lifted a little, head nodding down). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same instrument, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### margo-v3-back.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/margo-v3/back_idle.webp
- reference: assets/sprites/show-sources/band/margo-v3.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing and playing an invisible keyboard at waist height in front of her, both forearms held forward with fingers spread downward; no keyboard or instrument is drawn, only the character; keep her circular articulated joints. The first reference is the character seen from behind; the second reference is the same playing loop seen from the front. Draw the same four moments as seen from behind, in the same order: 1) both hands down level; 2) left hand lifted, right hand down, slight lean left; 3) right hand lifted, left hand down, slight lean right, head tilted; 4) both hands lifted a little, head nodding down. Same instrument and same scale as the front strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.


### margo-v3-back-between.png

- date: 2026-11-22
- aspect: landscape
- reference: assets/sprites/zine/margo-v3/back_idle.webp
- reference: assets/sprites/show-sources/band/margo-v3-back.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing and playing an invisible keyboard at waist height in front of her, both forearms held forward with fingers spread downward; no keyboard or instrument is drawn, only the character; keep her circular articulated joints. The second reference image is the existing rear-view strip of four key poses of this playing loop. Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same instrument, the same scale and the same drawing style as that strip. Preserve the exact character from the character reference: same face, hair, glasses, outfit, body proportions, and the textured paper-collage cutout style with sharp fine black ink contours and cream, blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no amplifier, no microphone, no cable.
