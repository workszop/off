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
