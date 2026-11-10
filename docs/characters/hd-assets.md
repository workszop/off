# High-density character artwork

The runtime set contains 75 transparent WebP frames at 1280 x 1920 pixels (2x the original canvas size). Logical world dimensions are unchanged. Human figure target height is 863 logical pixels; Ghost remains 580 logical pixels, preserving its existing artwork scale.

Andy now uses the same cream paper, muted slate/terracotta scraps and halftone collage treatment as the cast. The original source atlases are retained.

## Generation and quality limit

Tool: built-in image generation/editing. Each original atlas was edited separately. Andy also used Olex as a style reference. Final prompt set: preserve the exact 5-column by 4-row atlas, all 20 identities/poses, proportions, clothes and paper cutout framing; restore fine ink and paper detail; use an opaque flat magenta chroma-key background without debris. Andy additionally gains matching blue/terracotta collage scraps and beige halftone paper backing.

The image tool returned the original atlas dimensions despite requests for larger output. Therefore the final 2x WebPs are resampled from restored atlases, not native 2x redraws. This improves packaging density and updates the art, but does not guarantee new detail at extreme zoom.

## Rebuild

Run from the project root:

```sh
python3 tools/extract-atlas.py docs/concepts/zine-sprites/source/andy-restored-atlas-chroma.png andy --scale 2
python3 tools/extract-atlas.py docs/concepts/zine-sprites/source/jazz-restored-atlas-chroma.png jazz --scale 2
python3 tools/extract-atlas.py docs/concepts/zine-sprites/source/olex-restored-atlas-chroma.png olex --scale 2
python3 tools/extract-atlas.py docs/concepts/zine-sprites/source/ghost-restored-atlas-chroma.png ghost --height 580 --scale 2
python3 tools/extract-atlas.py docs/concepts/zine-sprites/source/margo-v3-restored-atlas-chroma.png margo-v3 --scale 2
```

All animation frames share one scale per character and a baseline 104 output pixels above the bottom. The side row is not shipped because it is not used.

## Verification

- 30 runtime regression tests passed.
- Six extractor unit tests passed.
- Syntax and cache-stamp checks passed.
- All 75 decoded WebPs checked for 1280 x 1920 dimensions, real alpha, no clipping and matching baseline.
- Existing Chrome desktop/mobile smoke test passed, including walking views, office events and chat controls.
- All five exported contact sheets visually inspected. Interactive browser viewer was unavailable; visual in-app review was not performed.

## Edited files

- [Office entry page cache stamps](/home/andrzey/git-claude/off/index.html)
- [Showcase cache stamps](/home/andrzey/git-claude/off/characters3d.html)
- [Extractor](/home/andrzey/git-claude/off/tools/extract-atlas.py)
- [Extractor tests](/home/andrzey/git-claude/off/tests/test_extract_atlas.py)
- [Runtime regression tests](/home/andrzey/git-claude/off/tests/regression.test.mjs)
- [Logical standee geometry](/home/andrzey/git-claude/off/src/characters3d/standee.js)

## Restored source atlases

- [andy](/home/andrzey/git-claude/off/docs/concepts/zine-sprites/source/andy-restored-atlas-chroma.png)
- [jazz](/home/andrzey/git-claude/off/docs/concepts/zine-sprites/source/jazz-restored-atlas-chroma.png)
- [olex](/home/andrzey/git-claude/off/docs/concepts/zine-sprites/source/olex-restored-atlas-chroma.png)
- [ghost](/home/andrzey/git-claude/off/docs/concepts/zine-sprites/source/ghost-restored-atlas-chroma.png)
- [margo-v3](/home/andrzey/git-claude/off/docs/concepts/zine-sprites/source/margo-v3-restored-atlas-chroma.png)

## Runtime frames

### andy

- [front idle](/home/andrzey/git-claude/off/assets/sprites/zine/andy/front_idle.webp)
- [front walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/andy/front_walk_01.webp)
- [front walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/andy/front_walk_02.webp)
- [front walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/andy/front_walk_03.webp)
- [front walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/andy/front_walk_04.webp)
- [threequarter idle](/home/andrzey/git-claude/off/assets/sprites/zine/andy/threequarter_idle.webp)
- [threequarter walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/andy/threequarter_walk_01.webp)
- [threequarter walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/andy/threequarter_walk_02.webp)
- [threequarter walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/andy/threequarter_walk_03.webp)
- [threequarter walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/andy/threequarter_walk_04.webp)
- [back idle](/home/andrzey/git-claude/off/assets/sprites/zine/andy/back_idle.webp)
- [back walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/andy/back_walk_01.webp)
- [back walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/andy/back_walk_02.webp)
- [back walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/andy/back_walk_03.webp)
- [back walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/andy/back_walk_04.webp)

### jazz

- [front idle](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/front_idle.webp)
- [front walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/front_walk_01.webp)
- [front walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/front_walk_02.webp)
- [front walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/front_walk_03.webp)
- [front walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/front_walk_04.webp)
- [threequarter idle](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/threequarter_idle.webp)
- [threequarter walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/threequarter_walk_01.webp)
- [threequarter walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/threequarter_walk_02.webp)
- [threequarter walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/threequarter_walk_03.webp)
- [threequarter walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/threequarter_walk_04.webp)
- [back idle](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/back_idle.webp)
- [back walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/back_walk_01.webp)
- [back walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/back_walk_02.webp)
- [back walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/back_walk_03.webp)
- [back walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/jazz/back_walk_04.webp)

### olex

- [front idle](/home/andrzey/git-claude/off/assets/sprites/zine/olex/front_idle.webp)
- [front walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/olex/front_walk_01.webp)
- [front walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/olex/front_walk_02.webp)
- [front walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/olex/front_walk_03.webp)
- [front walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/olex/front_walk_04.webp)
- [threequarter idle](/home/andrzey/git-claude/off/assets/sprites/zine/olex/threequarter_idle.webp)
- [threequarter walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/olex/threequarter_walk_01.webp)
- [threequarter walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/olex/threequarter_walk_02.webp)
- [threequarter walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/olex/threequarter_walk_03.webp)
- [threequarter walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/olex/threequarter_walk_04.webp)
- [back idle](/home/andrzey/git-claude/off/assets/sprites/zine/olex/back_idle.webp)
- [back walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/olex/back_walk_01.webp)
- [back walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/olex/back_walk_02.webp)
- [back walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/olex/back_walk_03.webp)
- [back walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/olex/back_walk_04.webp)

### ghost

- [front idle](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/front_idle.webp)
- [front walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/front_walk_01.webp)
- [front walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/front_walk_02.webp)
- [front walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/front_walk_03.webp)
- [front walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/front_walk_04.webp)
- [threequarter idle](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/threequarter_idle.webp)
- [threequarter walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/threequarter_walk_01.webp)
- [threequarter walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/threequarter_walk_02.webp)
- [threequarter walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/threequarter_walk_03.webp)
- [threequarter walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/threequarter_walk_04.webp)
- [back idle](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/back_idle.webp)
- [back walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/back_walk_01.webp)
- [back walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/back_walk_02.webp)
- [back walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/back_walk_03.webp)
- [back walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/ghost/back_walk_04.webp)

### margo-v3

- [front idle](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/front_idle.webp)
- [front walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/front_walk_01.webp)
- [front walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/front_walk_02.webp)
- [front walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/front_walk_03.webp)
- [front walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/front_walk_04.webp)
- [threequarter idle](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/threequarter_idle.webp)
- [threequarter walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/threequarter_walk_01.webp)
- [threequarter walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/threequarter_walk_02.webp)
- [threequarter walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/threequarter_walk_03.webp)
- [threequarter walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/threequarter_walk_04.webp)
- [back idle](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/back_idle.webp)
- [back walk_01](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/back_walk_01.webp)
- [back walk_02](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/back_walk_02.webp)
- [back walk_03](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/back_walk_03.webp)
- [back walk_04](/home/andrzey/git-claude/off/assets/sprites/zine/margo-v3/back_walk_04.webp)

