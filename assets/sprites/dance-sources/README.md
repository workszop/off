# Dance sources

Source strips for the party dance loop (`<view>_dance_01..08.webp`, 640x960,
figure bottom at y=908). Build with `python3 tools/build-dance-sprites.py`
(add `--only <name>` to rebuild one character and leave the others untouched)
and check with `python3 -m unittest tests.test_dance_sprites`.

## Layout

Andy, Jazz, Olex, Margo and the ghost have three sheets each, read as
equal-width cells:

| File | View | Figures become |
| --- | --- | --- |
| `<name>.png` | front, key poses (1x4) | `front_dance_01`, `03`, `05`, `07` |
| `<name>-between.png` | front, in-betweens (1x4) | `front_dance_02`, `04`, `06`, `08` |
| `<name>-back.png` | rear, all eight (2x4) | `back_dance_01` to `08` |

## Mr. T

Mr. T (`mrt`, added on 2026-11-24) dances like a stiff dad at a wedding, in
his suit, with a deadpan face: 1) fists at chest height, shuffling; 2) one
finger pointing up, a hand on the hip; 3) forearms rolling, knees bent;
4) a stiff finger-snap with both hands, one foot stepping out.

His sources follow the show act layout instead: four 1536x1024 RGBA strips of
four figures each, split at their transparent gutters.

| File | View | Figures 1-4 become |
| --- | --- | --- |
| `mrt.png` | front, key poses | `front_dance_01`, `03`, `05`, `07` |
| `mrt-between.png` | front, in-betweens | `front_dance_02`, `04`, `06`, `08` |
| `mrt-back.png` | rear, key poses | `back_dance_01`, `03`, `05`, `07` |
| `mrt-back-between.png` | rear, in-betweens | `back_dance_02`, `04`, `06`, `08` |

Each strip is scaled on its own by its median figure height (the rear
in-between strip came out about 4% larger than the other three), with a
height ratio of 1.01 that keeps his body the size of his standing idle
drawing. The strips were generated with the image tool through the `/img`
skill, one run per strip; the reference is his identity drawing
(`docs/concepts/zine-sprites/hd/sources/mrt/identity.webp`) for the front
strips and his rear walk strip for the rear strips.

### mrt.png

- date: 2026-11-24
- aspect: landscape
- reference: docs/concepts/zine-sprites/hd/sources/mrt/identity.webp
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing and dancing like a stiff, awkward dad at a wedding, in his suit, with a completely serious deadpan face and closed mouth in every pose. Four different moments of one dance loop: 1) both fists held at chest height with elbows tucked in, shuffling, one heel lifted; 2) one arm pointing diagonally up to the side with the index finger, the other hand on his hip, hips pushed to the side; 3) both forearms rolling in front of his chest, knees slightly bent, leaning a little to one side; 4) a stiff finger-snap with both hands at shoulder height, elbows out, one foot stepping out to the side. The character is a tall slim man about 45 years old with thick wavy medium-length brown hair swept back, clean shaven, a serious deadpan face, wearing a black two-button suit with the jacket open, a white shirt with an open collar and no tie, a black belt and black leather shoes. Preserve the exact character from the character reference: same face, hair, suit, body proportions, long legs, and the textured paper-collage cutout style with sharp fine black ink contours on a cream torn-paper backing with blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Nothing is cropped by the image edges. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no dark halo.

### mrt-between.png

- date: 2026-11-24
- aspect: landscape
- reference: docs/concepts/zine-sprites/hd/sources/mrt/identity.webp
- reference: assets/sprites/dance-sources/mrt.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, front view, standing and dancing like a stiff, awkward dad at a wedding, in his suit, with a completely serious deadpan face and closed mouth in every pose. The second reference image is the existing strip of four key poses of this dance loop (1) both fists held at chest height with elbows tucked in, shuffling, one heel lifted; 2) one arm pointing diagonally up to the side with the index finger, the other hand on his hip, hips pushed to the side; 3) both forearms rolling in front of his chest, knees slightly bent, leaning a little to one side; 4) a stiff finger-snap with both hands at shoulder height, elbows out, one foot stepping out to the side). Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same scale and the same drawing style as that strip. The character is a tall slim man about 45 years old with thick wavy medium-length brown hair swept back, clean shaven, a serious deadpan face, wearing a black two-button suit with the jacket open, a white shirt with an open collar and no tie, a black belt and black leather shoes. Preserve the exact character from the character reference: same face, hair, suit, body proportions, long legs, and the textured paper-collage cutout style with sharp fine black ink contours on a cream torn-paper backing with blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Nothing is cropped by the image edges. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no dark halo.

### mrt-back.png

- date: 2026-11-24
- aspect: landscape
- reference: docs/concepts/zine-sprites/hd/sources/mrt/back_strip_01.webp
- reference: assets/sprites/dance-sources/mrt.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing and dancing like a stiff, awkward dad at a wedding, in his suit, with a completely serious deadpan face and closed mouth in every pose. The first reference shows the character seen from behind; the second reference is the same dance loop seen from the front. Draw the same four moments as seen from behind, in the same order: 1) both fists held at chest height with elbows tucked in, shuffling, one heel lifted; 2) one arm pointing diagonally up to the side with the index finger, the other hand on his hip, hips pushed to the side; 3) both forearms rolling in front of his chest, knees slightly bent, leaning a little to one side; 4) a stiff finger-snap with both hands at shoulder height, elbows out, one foot stepping out to the side. Same scale as the front strip. The character is a tall slim man about 45 years old with thick wavy medium-length brown hair swept back, clean shaven, a serious deadpan face, wearing a black two-button suit with the jacket open, a white shirt with an open collar and no tie, a black belt and black leather shoes. Preserve the exact character from the character reference: same face, hair, suit, body proportions, long legs, and the textured paper-collage cutout style with sharp fine black ink contours on a cream torn-paper backing with blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Nothing is cropped by the image edges. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no dark halo.

### mrt-back-between.png

- date: 2026-11-24
- aspect: landscape
- reference: docs/concepts/zine-sprites/hd/sources/mrt/back_strip_01.webp
- reference: assets/sprites/dance-sources/mrt-back.png
- prompt: A wide sprite strip with exactly four equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, the face is not visible), standing and dancing like a stiff, awkward dad at a wedding, in his suit, with a completely serious deadpan face and closed mouth in every pose. The first reference shows the character seen from behind; the second reference image is the existing rear-view strip of four key poses of this dance loop. Draw four NEW in-between poses, each halfway between one key pose and the next (1 to 2, 2 to 3, 3 to 4, 4 back to 1), with the same scale and the same drawing style as that strip. The character is a tall slim man about 45 years old with thick wavy medium-length brown hair swept back, clean shaven, a serious deadpan face, wearing a black two-button suit with the jacket open, a white shirt with an open collar and no tie, a black belt and black leather shoes. Preserve the exact character from the character reference: same face, hair, suit, body proportions, long legs, and the textured paper-collage cutout style with sharp fine black ink contours on a cream torn-paper backing with blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Nothing is cropped by the image edges. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no dark halo.
