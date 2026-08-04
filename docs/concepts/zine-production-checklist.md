# Zine paper asset production

Reference: `character-sprites-proposition-3-zine-paper.png`

Production assets:

- Character animation: `assets/sprites/zine/`
- Furniture: `assets/`
- Generated source atlases and extraction previews remain in `docs/concepts/`

## Character sprite contract

Each character uses four directional sets. Right-facing three-quarter and side
views are mirrored from the left-facing source. Every set contains one idle
frame and four walking frames.

### Andy

- [x] Front: idle + walk 01–04
- [x] Front-left three-quarter: idle + walk 01–04
- [x] Left side: idle + walk 01–04
- [x] Back: idle + walk 01–04

### Jazz

- [x] Front: idle + walk 01–04
- [x] Front-left three-quarter: idle + walk 01–04
- [x] Left side: idle + walk 01–04
- [x] Back: idle + walk 01–04

### Olex

- [x] Front: idle + walk 01–04
- [x] Front-left three-quarter: idle + walk 01–04
- [x] Left side: idle + walk 01–04
- [x] Back: idle + walk 01–04

### Ghost

- [x] Front: idle + float 01–04
- [x] Front-left three-quarter: idle + float 01–04
- [x] Left side: idle + float 01–04
- [x] Back: idle + float 01–04

## Furniture contract

All objects use the same slightly elevated front three-quarter viewpoint,
photocopied ink texture, off-white torn-paper rim, and transparent exterior.

- [x] Desk cluster
- [x] Coffee station
- [x] Two-seat couch
- [x] Armchair
- [x] Café table
- [x] Snake plant
- [x] Boxes stack
- [x] Filing cabinet
- [x] Arc floor lamp
- [x] Printer
- [x] Whiteboard

## Integration

- [x] Directional sprite selection follows horizontal and vertical movement
- [x] Right-facing views mirror the left-facing source
- [x] Idle view follows the last movement direction
- [x] Furniture palette and default office use the zine assets
- [x] Production files promoted from concepts into canonical game assets
- [x] Legacy sprite and furniture entry points replaced with zine artwork
- [x] Desktop and mobile smoke checks pass
