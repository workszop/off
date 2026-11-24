# Close-up sprite sources

These lossless WebP strips are the source artwork for the production sprites.
They were restored with the built-in ImageGen tool, using the existing zine
character sheets as identity and pose references. No API key was used.

`manifest.json` maps each strip's regular cells to direction/frame names,
records native dimensions and hashes, and preserves the old per-pose height.
The actual native figures are 629–949 pixels tall, rather than approximately
200–260 pixels inside the original 5×4 sheets. Production textures retain
their existing 1280×1920 frame dimensions and the 1816-pixel paper baseline.

## Prompt set

Shared instruction used for the restored strips:

> Use case: identity-preserve. Asset: high-resolution game sprite strip.
> Restore only the selected reference row, keeping the original character
> identity, outfit, proportions, gestures, cream paper cutout and blue/red/tan
> collage panels. Reconstruct genuinely sharp fine black ink contours,
> distinct facial features, clothing details and small paper fibers, not a
> blurry enlargement. Output one landscape row with equal-width cells,
> equal character scales, aligned paper bases and transparent gutters on
> every side. No additional characters or rows, redesign, glow, outside
> shadows, text or magenta. Fully transparent outside the paper silhouettes.

For humans, reference rows were front, three-quarter and back; columns were
idle, walk-01 and walk-03. For the ghost, each direction used one three-cell
strip for idle/walk-01/walk-02 and one two-cell strip for walk-03/walk-04.
Direction-specific instructions preserved the back without a visible face,
or the right-facing three-quarter view. Margo's instructions additionally
preserved her short curled bob, dress, belt and circular articulated joints.
Andy uses the restored collage atlas, not the earlier narrow-border sheet.

Rebuild with `python3 tools/rebuild-sprites.py` from the repository root.
Validate with `python3 tools/rebuild-sprites.py --check`.

## Mr. T

Mr. T (`mrt`) joined on 2026-11-24. He has no old sprites to restore: his
three strips (idle, walk-01, walk-03 for front, three-quarter and back) were
generated new with the image tool through the `/img` skill, from his approved
identity drawing, kept here as `sources/mrt/identity.webp` (cut at alpha > 128,
which removes the soft dark halo the first drawing had round its paper).
The three-quarter and back strips also got the front strip as a second
reference, and one existing character's frame as a guide for the viewing
angle only.

Add or replace his strips and build only his frames (every other character's
files stay untouched) with:

```sh
python3 tools/rebuild-sprites.py --add mrt \
  --strip front=<front.png> --strip threequarter=<threequarter.png> --strip back=<back.png> \
  --idle-height front=860 --idle-height threequarter=864.5 --idle-height back=868
python3 tools/rebuild-sprites.py --only mrt   # rebuild from the archive
```

The idle heights are the logical heights of his paper backing; they differ a
little between views so that the figure itself (hair to soles, about 815 px
of the 960) is the same size in all three, and the front one follows the
other humans' standing height. Walk poses keep the scale of the idle figure
of their strip.

### identity.webp (first drawing)

- date: 2026-11-24
- aspect: portrait
- style reference: assets/sprites/zine/andy/front_idle.webp
- style reference: assets/sprites/zine/olex/front_idle.webp
- prompt: A new character for the same game, drawn in exactly the style of the two reference characters: a textured paper-collage cutout with sharp fine black ink contours, on a cream torn-paper backing with blue, red and tan collage panels behind the figure. The character: a tall, slim man about 45 years old with a full head of thick wavy medium-length brown hair swept back from the forehead, clean shaven, a serious deadpan face with slightly raised eyebrows and a hint of mischief in the eyes. He wears a black two-button suit with the jacket open, a white shirt with an open collar and no tie, a black belt, black suit trousers and black leather shoes. Same cartoon proportions and head-to-body ratio as the reference characters, but with slightly longer legs so he reads as the tallest. Full body, front view, standing relaxed and upright, arms at his sides, feet together on the baseline, centred. Single figure. Fully transparent background outside the paper backing. No text, no letters, no logos, no lanyard, no microphone, no scene, no floor, no shadow outside the figure, no glow.

### front_strip_01.webp

- date: 2026-11-24
- aspect: landscape
- reference: docs/concepts/zine-sprites/hd/sources/mrt/identity.webp
- prompt: A wide sprite strip with exactly three equal-width cells in one row, each showing the same character, full body, front view. Three poses: 1) standing still, relaxed and upright, arms at his sides, feet together; 2) mid-stride walking step with his left leg forward and his right arm swinging forward; 3) the opposite mid-stride walking step with his right leg forward and his left arm swinging forward. The character is a tall slim man about 45 years old with thick wavy medium-length brown hair swept back, clean shaven, a serious deadpan face, wearing a black two-button suit with the jacket open, a white shirt with an open collar and no tie, a black belt and black leather shoes. Preserve the exact character from the character reference: same face, hair, suit, body proportions, long legs, and the textured paper-collage cutout style with sharp fine black ink contours on a cream torn-paper backing with blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Nothing is cropped by the image edges. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no dark halo.

### threequarter_strip_01.webp

- date: 2026-11-24
- aspect: landscape
- reference: docs/concepts/zine-sprites/hd/sources/mrt/identity.webp
- reference: docs/concepts/zine-sprites/hd/sources/mrt/front_strip_01.webp
- reference: assets/sprites/zine/olex/threequarter_walk_01.webp
- prompt: A wide sprite strip with exactly three equal-width cells in one row, each showing the same character, full body, in a three-quarter view: his body and face are turned about 45 degrees towards the right side of the image, so he faces and walks to the right. The first reference is the character; the second reference is the same three poses seen from the front; the third reference is a different character and is only a guide for the three-quarter viewing angle and walking pose, do not copy that person. Three poses: 1) standing still, relaxed and upright, arms at his sides, feet together; 2) mid-stride walking step with his left leg forward and his right arm swinging forward; 3) the opposite mid-stride walking step with his right leg forward and his left arm swinging forward. The character is a tall slim man about 45 years old with thick wavy medium-length brown hair swept back, clean shaven, a serious deadpan face, wearing a black two-button suit with the jacket open, a white shirt with an open collar and no tie, a black belt and black leather shoes. Preserve the exact character from the character reference: same face, hair, suit, body proportions, long legs, and the textured paper-collage cutout style with sharp fine black ink contours on a cream torn-paper backing with blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Nothing is cropped by the image edges. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no dark halo.

### back_strip_01.webp

- date: 2026-11-24
- aspect: landscape
- reference: docs/concepts/zine-sprites/hd/sources/mrt/identity.webp
- reference: docs/concepts/zine-sprites/hd/sources/mrt/front_strip_01.webp
- reference: assets/sprites/zine/olex/back_walk_01.webp
- prompt: A wide sprite strip with exactly three equal-width cells in one row, each showing the same character, full body, seen from directly behind (rear view, walking away from the viewer, only the back of his head and hair, the face is not visible at all). The first reference is the character seen from the front; the second reference is the same three poses seen from the front; the third reference is a different character and is only a guide for the rear viewing angle and walking pose, do not copy that person. Draw the back of his black suit jacket with a centre seam, the back of his wavy brown hair, the back of his trousers and the heels of his shoes. Three poses: 1) standing still, relaxed and upright, arms at his sides, feet together; 2) mid-stride walking step with his left leg forward and his right arm swinging forward; 3) the opposite mid-stride walking step with his right leg forward and his left arm swinging forward. The character is a tall slim man about 45 years old with thick wavy medium-length brown hair swept back, clean shaven, a serious deadpan face, wearing a black two-button suit with the jacket open, a white shirt with an open collar and no tie, a black belt and black leather shoes. Preserve the exact character from the character reference: same face, hair, suit, body proportions, long legs, and the textured paper-collage cutout style with sharp fine black ink contours on a cream torn-paper backing with blue, red and tan paper panels. The paper backing behind the figure keeps the same simple shape in every cell. Same character scale in every cell, feet on the same baseline. Wide empty transparent gutters between the cells: the figures must not touch or overlap each other and nothing crosses between cells. Nothing is cropped by the image edges. Fully transparent background. No text, no letters, no logos, no labels, no scene, no floor, no shadows outside the figure, no glow, no dark halo.
