# Character prop artwork

Generated with the built-in image-generation tool using each character's
original front, three-quarter and rear idle drawings as references.

Prompt brief: preserve the exact character, face, hair, glasses, outfit,
proportions and textured paper-collage style. Produce six full-body poses
in a three-column, two-row transparent atlas. Top row: holding a ceramic
coffee mug, front / three-quarter / rear. Bottom row: carrying two or three
printout sheets in the same three views. No readable text, scene or labels.
Margo retains her circular articulated joints. The ghost is excluded.

Each PNG is the retained source atlas. Rebuild the 24 extracted 1280x1920
WebP frames with `python3 tools/build-prop-sprites.py`.

The office uses these variants during occasional coffee-corner stops and
printer encounters. Their selection policy lives in `src/office3d/carry.js`.
