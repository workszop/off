#!/usr/bin/env python3
"""Cut a character sprite atlas into the game's 20 zine frames.

The atlas is one image on a flat magenta (#FF00FF) background, laid out as
5 columns x 4 rows (the same layout as docs/concepts/zine-sprites/source/):

    columns: idle, walk 01, walk 02, walk 03, walk 04
    rows:    front, three-quarter, side, back

Each frame is keyed out, trimmed, scaled so the tallest standing figure is
863 logical px from paper base to top, and placed on a transparent canvas.
The default density is 2x: output frames are 1280x1920 px, with the paper
base 104 px above the bottom edge. The density can be changed with
``--scale`` without changing the logical character size, so the 2D app and
the 3D standees need no per-character offsets.

Usage:
    python3 tools/extract-atlas.py ATLAS.png NAME [--height 863] [--scale 2]
        [--preview PNG]

Writes assets/sprites/zine/NAME/{front,threequarter,back}_{idle,walk_01..04}.webp
(the side row is read but not written: the standees do not use it)
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

FRAME_W, FRAME_H = 640, 960     # logical frame dimensions
BASE_FROM_BOTTOM = 52            # logical px above the frame bottom
ROWS = ['front', 'threequarter', 'side', 'back']
UNUSED_ROWS = {'side'}          # the standees never show the side profile
COLS = ['idle', 'walk_01', 'walk_02', 'walk_03', 'walk_04']
ROOT = Path(__file__).resolve().parent.parent


def validate_scale(scale):
    """Return a valid integer output density or raise a useful error."""
    if isinstance(scale, bool) or not isinstance(scale, int) or scale < 1:
        raise ValueError('scale must be a positive integer')
    return scale


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


def prepare_atlas(img):
    """Prepare a source atlas without destroying a real alpha channel.

    Chroma-keying is only needed for the older flat-magenta atlases. A PNG
    with any non-opaque pixels already carries the intended matte, so retain
    its RGB and alpha values exactly and let ``cells`` use that alpha mask.
    """
    rgba = img.convert('RGBA')
    alpha = rgba.getchannel('A')
    width, height = rgba.size
    corners = [
        alpha.getpixel((0, 0)),
        alpha.getpixel((width - 1, 0)),
        alpha.getpixel((0, height - 1)),
        alpha.getpixel((width - 1, height - 1)),
    ]
    # A single translucent interior pixel is not enough evidence that the
    # atlas has a real transparent matte. Require a transparent background
    # signal at most corners, or across most of the outer border.
    if sum(value <= 16 for value in corners) >= 3:
        return rgba
    border = [
        alpha.getpixel((x, y))
        for x in range(width)
        for y in (0, height - 1)
    ] + [
        alpha.getpixel((x, y))
        for y in range(1, height - 1)
        for x in (0, width - 1)
    ]
    if sum(value <= 16 for value in border) >= len(border) * 0.5:
        return rgba
    return key_out(rgba)


def compose_frame(figure, tallest, height=863, scale=2):
    """Fit one trimmed figure on a density-scaled transparent frame."""
    density = validate_scale(scale)
    if tallest <= 0 or height <= 0:
        raise ValueError('figure height and tallest figure must be positive')
    frame_w, frame_h = FRAME_W * density, FRAME_H * density
    base = BASE_FROM_BOTTOM * density
    target_height = height * density
    if target_height > frame_h - base:
        raise ValueError('target figure height exceeds available frame height')
    fit = target_height / tallest
    resized = figure.resize(
        (round(figure.width * fit), round(figure.height * fit)),
        Image.Resampling.LANCZOS,
    )
    if resized.width > frame_w:
        raise ValueError('figure is wider than the frame after scaling; reduce --height')
    canvas = Image.new('RGBA', (frame_w, frame_h), (0, 0, 0, 0))
    x = (frame_w - resized.width) // 2
    visible = resized.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
    if not visible:
        raise ValueError('figure has no visible alpha after resampling')
    y = frame_h - base - visible[3]
    canvas.alpha_composite(resized, (x, y))
    return canvas


def _largest_component_mask(alpha, threshold=128):
    """Return an 8-connected mask for the largest opaque alpha component."""
    width, height = alpha.size
    pixels = alpha.load()
    seen = bytearray(width * height)
    largest = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if seen[index] or pixels[x, y] <= threshold:
                continue
            seen[index] = 1
            stack = [(x, y)]
            component = []
            while stack:
                cx, cy = stack.pop()
                component.append((cx, cy))
                for nx in range(max(0, cx - 1), min(width, cx + 2)):
                    for ny in range(max(0, cy - 1), min(height, cy + 2)):
                        neighbor = ny * width + nx
                        if seen[neighbor] or pixels[nx, ny] <= threshold:
                            continue
                        seen[neighbor] = 1
                        stack.append((nx, ny))
            if len(component) > len(largest):
                largest = component

    mask = Image.new('L', (width, height), 0)
    mask_pixels = mask.load()
    for x, y in largest:
        mask_pixels[x, y] = 255
    return mask


def clean_cell(cell):
    """Drop detached opaque debris while retaining a one-pixel alpha feather."""
    rgba = cell.convert('RGBA')
    component = _largest_component_mask(rgba.getchannel('A'))
    # A one-pixel dilation keeps antialiased edge pixels adjacent to the
    # opaque figure, without reconnecting isolated speckles in the cell.
    keep = component.filter(ImageFilter.MaxFilter(3))
    rgba.putalpha(ImageChops.multiply(rgba.getchannel('A'), keep))
    return rgba


def grid_cells(img, rows=None, cols=None):
    """Read a regular 5x4 atlas and clean each cell's largest figure.

    This mode is intended for generated atlases whose transparent cells have
    occasional detached speckles. The default ``cells`` function remains gap
    driven for the original hand-composed atlases.
    """
    rows = list(ROWS if rows is None else rows)
    cols = list(COLS if cols is None else cols)
    if not rows or not cols:
        raise ValueError('grid rows and columns must not be empty')
    width, height = img.size
    for row_index, row in enumerate(rows):
        y0 = round(row_index * height / len(rows))
        y1 = round((row_index + 1) * height / len(rows))
        for col_index, col in enumerate(cols):
            x0 = round(col_index * width / len(cols))
            x1 = round((col_index + 1) * width / len(cols))
            yield row, col, clean_cell(img.crop((x0, y0, x1, y1)))


def trim_frame(image):
    """Clean a standalone generated frame and remove transparent gutters."""
    cleaned = clean_cell(image)
    bbox = cleaned.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
    if not bbox:
        raise ValueError('frame contains no opaque figure')
    return cleaned.crop(bbox)


def parse_labels(value, label):
    """Parse a comma-separated list of atlas labels and validate it."""
    labels = [part.strip() for part in value.split(',') if part.strip()]
    if not labels or len(labels) != len(set(labels)):
        raise ValueError(f'{label} must contain unique, non-empty comma-separated names')
    return labels


def frame_label(value):
    """Validate the output name passed to ``--frame``."""
    allowed_views = set(ROWS)
    if not value or '_' not in value:
        raise ValueError('frame must be VIEW_FRAME, for example front_walk_01')
    view, frame = value.split('_', 1)
    if view not in allowed_views:
        raise ValueError(f'frame view must be one of: {", ".join(ROWS)}')
    if frame not in COLS:
        raise ValueError(f'frame name must be one of: {", ".join(COLS)}')
    return value


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
    ap.add_argument('--scale', type=int, default=2, help='output density multiplier (default: 2)')
    ap.add_argument('--grid', action='store_true',
                    help='read a regular 5x4 grid and remove detached cell speckles')
    ap.add_argument('--rows', default=','.join(ROWS),
                    help='comma-separated grid row labels (default: front,threequarter,side,back)')
    ap.add_argument('--cols', default=','.join(COLS),
                    help='comma-separated grid column labels (default: idle,walk_01,walk_02,walk_03,walk_04)')
    ap.add_argument('--frame', metavar='VIEW_FRAME',
                    help='extract one standalone full-frame image, e.g. front_walk_01')
    ap.add_argument('--output-dir', type=Path,
                    help='directory for generated WebP frames (default: assets/sprites/zine/NAME)')
    ap.add_argument('--preview', help='optional contact-sheet PNG to write')
    args = ap.parse_args()
    try:
        density = validate_scale(args.scale)
        rows = parse_labels(args.rows, 'rows')
        cols = parse_labels(args.cols, 'columns')
        if args.frame:
            frame_name = frame_label(args.frame)
    except ValueError as exc:
        ap.error(str(exc))

    atlas = prepare_atlas(Image.open(args.atlas))
    out_dir = args.output_dir or (ROOT / 'assets' / 'sprites' / 'zine' / args.name)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.frame:
        try:
            figure = trim_frame(atlas)
            canvas = compose_frame(figure, tallest=figure.height, height=args.height, scale=density)
        except ValueError as exc:
            ap.error(str(exc))
        path = out_dir / f'{frame_name}.webp'
        canvas.save(path, 'WEBP', lossless=True, method=6)
        print(f'Wrote 1 frame to {path} (density {density}x, lossless WebP)')
        return

    frames = []
    cell_reader = (lambda image: grid_cells(image, rows=rows, cols=cols)) if args.grid else cells
    for row, col, cell in cell_reader(atlas):
        bbox = cell.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
        if not bbox:
            sys.exit(f'Empty cell: {row} {col}. Is the atlas 5 columns x 4 rows on magenta?')
        frames.append((row, col, cell.crop(bbox)))

    # One scale for every frame, so walking never changes the figure's size.
    tallest = max(f.height for _, _, f in frames)

    written, saved = [], 0
    for row, col, f in frames:
        try:
            canvas = compose_frame(f, tallest=tallest, height=args.height, scale=density)
        except ValueError as exc:
            sys.exit(f'{row} {col}: {exc}')
        written.append(canvas)  # the preview shows the whole atlas
        if row in UNUSED_ROWS and row in ROWS:
            continue
        path = out_dir / f'{row}_{col}.webp'
        canvas.save(path, 'WEBP', lossless=True, method=6)
        saved += 1

    if args.preview:
        sheet = Image.new('RGBA', (len(cols) * 160, len(rows) * 240), (244, 239, 229, 255))
        for i, frame in enumerate(written):
            thumb = frame.resize((160, 240), Image.LANCZOS)
            sheet.alpha_composite(thumb, ((i % len(cols)) * 160, (i // len(cols)) * 240))
        sheet.save(args.preview)

    fit_scale = args.height * density / tallest
    try:
        shown_dir = out_dir.relative_to(ROOT)
    except ValueError:
        shown_dir = out_dir
    print(f'Wrote {saved} frames to {shown_dir} '
          f'(density {density}x, figure scale {fit_scale:.3f}, lossless WebP)')


if __name__ == '__main__':
    main()
