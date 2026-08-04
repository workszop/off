# Paper collage office

## Objective

Unify the office as a deliberate paper-collage playset without changing
character personalities, dialogue, autonomous events, or four-frame walking
animation.

## Visual contract

- `body[data-art-direction="paper-collage"]` identifies the active system.
- Every room zone is a torn colored paper mat with a shared shadow and texture.
- Every character keeps its existing sprite frames, gains a cream cutout rim,
  and stands above a separate folded-paper base.
- Every furniture item gains the same cream rim, paper base, shallow curated
  tilt, and scale logic.
- Furniture can be moved, flipped, removed, and resized uniformly. Arbitrary
  90-degree rotation is removed because it breaks the illustrated perspective.
- Speech bubbles and controls use the same ink, paper, and shadow tokens.

## Behavioral invariants

- `SPRITE_MAP` remains the source of all idle and movement frames.
- `movementSprite()` continues cycling four frames while characters walk.
- Existing dialogue, activities, events, collision handling, and day phases
  remain operational.
- Character bases and collage decorations are noninteractive.
- Furniture types and activity keys do not change.

## Verification

- Desktop and mobile screenshots show one coherent paper system.
- Walking characters visibly change sprite frames.
- Dialogue bubbles still appear and track characters.
- Furniture resizing preserves a square asset box and respects minimum and
  maximum scale.
- Furniture editor exposes no 90-degree rotation control.
- Required DOM contract attributes can be inspected without visual scraping.
