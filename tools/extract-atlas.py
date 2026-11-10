#!/usr/bin/env python3
"""Cut a character sprite atlas into the game's 20 zine frames.

The atlas is one image on a flat magenta (#FF00FF) background, laid out as
5 columns x 4 rows (the same layout as docs/concepts/zine-sprites/source/):

    columns: idle, walk 01, walk 02, walk 03, walk 04
    rows:    front, three-quarter, side, back

Each frame is keyed out, trimmed, scaled so the tallest standing figure is
863 px from paper base to top, and placed on a 640x960 transparent canvas
with the paper base 52 px above the bottom edge. That matches every other
character, so the 2D app and the 3D standees need no per-character offsets.

Usage:
    python3 tools/extract-atlas.py ATLAS.png NAME [--height 863] [--preview PNG]

Writes assets/sprites/zine/NAME/{front,threequarter,back}_{idle,walk_01..04}.webp
(the side row is read but not written: the standees do not use it)
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageFilter

FRAME_W, FRAME_H = 640, 960
BASE_FROM_BOTTOM = 52           # paper base sits 52 px above the frame bottom
ROWS = ['front', 'threequarter', 'side', 'back']
UNUSED_ROWS = {'side'}          # the standees never show the side profile
COLS = ['idle', 'walk_01', 'walk_02', 'walk_03', 'walk_04']
ROOT = Path(__file__).resolve().parent.parent


def key_out(img, tolerance=110):
    """Make magenta transparent and pull magenta spill out of the edges."""
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # Distance from pure magenta, measured on the green channel and the
            # red/blue balance: magenta is high R, high B, low G.
            magenta = min(r, b) - g
            if magenta > tolerance:
                px[x, y] = (0, 0, 0, 0)
            elif magenta > 30:
                # Edge pixel: fade it and remove the pink cast.
                keep = 1 - (magenta - 30) / (tolerance - 30)
                avg = (r + g + b) // 3
                px[x, y] = (min(r, avg + 10), g, min(b, avg + 10), int(a * keep))
    # Soften the matte by one pixel so edges are not jagged.
    alpha = img.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    img.putalpha(alpha)
    return img


def runs(profile, min_len, min_gap):
    """Index ranges where profile is non-zero, merging gaps shorter than min_gap."""
    spans, start = [], None
    for i, v in enumerate(profile + [0]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            spans.append([start, i])
            start = None
    merged = []
    for s in spans:
        if merged and s[0] - merged[-1][1] < min_gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return [s for s in merged if s[1] - s[0] >= min_len]


def cells(img):
    """Find the figures by their gaps rather than assuming an even grid:
    sprite sheets rarely space their cells exactly evenly."""
    mask = img.getchannel('A').point(lambda v: 1 if v > 128 else 0)
    w, h = mask.size
    data = mask.load()
    row_profile = [sum(data[x, y] for x in range(w)) > 2 for y in range(h)]
    bands = runs(row_profile, min_len=h // 12, min_gap=6)
    if len(bands) != len(ROWS):
        sys.exit(f'Found {len(bands)} rows of figures, expected {len(ROWS)}.')
    for row, (y0, y1) in zip(ROWS, bands):
        col_profile = [sum(data[x, y] for y in range(y0, y1)) > 2 for x in range(w)]
        segs = runs(col_profile, min_len=w // 30, min_gap=4)
        if len(segs) != len(COLS):
            sys.exit(f'Row "{row}": found {len(segs)} figures, expected {len(COLS)}.')
        for col, (x0, x1) in zip(COLS, segs):
            yield row, col, img.crop((x0, y0, x1, y1))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('atlas')
    ap.add_argument('name', help='character id, e.g. margo')
    ap.add_argument('--height', type=int, default=863, help='figure height in px (863 = human cast)')
    ap.add_argument('--preview', help='optional contact-sheet PNG to write')
    args = ap.parse_args()

    atlas = key_out(Image.open(args.atlas))
    frames = []
    for row, col, cell in cells(atlas):
        bbox = cell.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
        if not bbox:
            sys.exit(f'Empty cell: {row} {col}. Is the atlas 5 columns x 4 rows on magenta?')
        frames.append((row, col, cell.crop(bbox)))

    # One scale for every frame, so walking never changes the figure's size.
    tallest = max(f.height for _, _, f in frames)
    scale = args.height / tallest
    out_dir = ROOT / 'assets' / 'sprites' / 'zine' / args.name
    out_dir.mkdir(parents=True, exist_ok=True)

    written, saved = [], 0
    for row, col, f in frames:
        f = f.resize((round(f.width * scale), round(f.height * scale)), Image.LANCZOS)
        if f.width > FRAME_W:
            sys.exit(f'{row} {col} is wider than the frame after scaling; reduce --height.')
        canvas = Image.new('RGBA', (FRAME_W, FRAME_H), (0, 0, 0, 0))
        x = (FRAME_W - f.width) // 2
        y = FRAME_H - BASE_FROM_BOTTOM - f.height
        canvas.alpha_composite(f, (x, y))
        written.append(canvas)  # the preview shows the whole atlas
        if row in UNUSED_ROWS:
            continue
        path = out_dir / f'{row}_{col}.webp'
        canvas.save(path, 'WEBP', quality=90, method=6)
        saved += 1

    if args.preview:
        sheet = Image.new('RGBA', (len(COLS) * 160, len(ROWS) * 240), (244, 239, 229, 255))
        for i, frame in enumerate(written):
            thumb = frame.resize((160, 240), Image.LANCZOS)
            sheet.alpha_composite(thumb, ((i % len(COLS)) * 160, (i // len(COLS)) * 240))
        sheet.save(args.preview)

    print(f'Wrote {saved} frames to {out_dir.relative_to(ROOT)} (scale {scale:.3f})')


if __name__ == '__main__':
    main()
