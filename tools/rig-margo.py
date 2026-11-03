#!/usr/bin/env python3
"""Cut Margo's idle frames into the pieces of a jointed paper puppet.

Margo is drawn as a mannequin with ball joints, so the 3D office moves her
limbs instead of flipping between stride drawings. This tool cuts each idle
frame (front, side, back) into body, arms and legs:

  assets/sprites/zine/margo/rig/<view>_<piece>.webp   (640x960, transparent)

A piece is the drawn figure inside a hand-placed polygon. Inside the polygon
the sticker backing (paper halo, torn scrap, transparent) is found by flood
filling from seed points without crossing the figure's dark outline, and is
left behind, so only the limb moves. Three layers come out per view, like a
real paper doll: the `plate` (the whole drawing with every limb painted over
with surrounding paper), the limbs, and the `body` on top, which has a
transparent hole wherever a limb swings behind it (the hem hides the leg
tops) and is painted over where a limb swings in front (the profile arm).

Pivots (joints) live in src/characters3d/standee.js (MARGO_RIG); the
coordinates below are frame pixels, origin top left.

Usage: python3 tools/rig-margo.py [--debug PNG]
"""

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'sprites' / 'zine' / 'margo'
OUT = SRC / 'rig'
DARK = 90   # luminance below this is outline (the torn blue scrap is ~115)

# polygon: the region to search; seeds: points that are backing ('cut') or
# figure ('inner'); fill: which way to look for paint to cover the hole in
# the body ('out' = away from the figure centre, 'in' = toward it).
PIECES = {
  'front': {
    'centre': 321,
    'leg_l': dict(mode='cut', poly=[(235, 668), (321, 668), (321, 915), (235, 915)], seeds=[(237, 700), (237, 912)], fill='out'),
    'leg_r': dict(mode='cut', poly=[(321, 668), (410, 668), (410, 915), (321, 915)], seeds=[(408, 700), (408, 912)], fill='out'),
    'arm_l': dict(mode='cut', poly=[(226, 386), (268, 386), (262, 470), (250, 540), (248, 612), (190, 612), (196, 540), (200, 470)], seeds=[(203, 480), (194, 600)], fill='out'),
    'arm_r': dict(mode='cut', poly=[(372, 386), (414, 386), (440, 470), (444, 540), (450, 612), (392, 612), (390, 540), (378, 470)], seeds=[(437, 480), (446, 600)], fill='out'),
  },
  'back': {
    'centre': 304,
    'leg_l': dict(mode='cut', poly=[(225, 665), (304, 665), (304, 915), (225, 915)], seeds=[(227, 700), (227, 912)], fill='out'),
    'leg_r': dict(mode='cut', poly=[(304, 665), (385, 665), (385, 915), (304, 915)], seeds=[(383, 700), (383, 912)], fill='out'),
    'arm_l': dict(mode='cut', poly=[(218, 372), (258, 372), (255, 450), (250, 520), (248, 590), (192, 590), (196, 520), (200, 450)], seeds=[(202, 460), (196, 580)], fill='out'),
    'arm_r': dict(mode='cut', poly=[(348, 372), (392, 372), (410, 450), (416, 520), (420, 590), (362, 590), (360, 520), (356, 450)], seeds=[(408, 460), (416, 580)], fill='out'),
  },
  'side': {
    'centre': 345,
    # The side leg bends at the knee (y 706): thigh above, shin below, overlapping a little.
    'leg': dict(mode='cut', poly=[(285, 680), (420, 680), (420, 915), (285, 915)], seeds=[(287, 700), (287, 912), (418, 700), (418, 912)], fill='out',
                parts={'thigh': lambda y: y < 716, 'shin': lambda y: y >= 698}),
    'arm': dict(mode='inner', layer='front', poly=[(312, 350), (352, 350), (356, 450), (352, 520), (362, 600), (318, 600), (318, 520), (312, 450)], seeds=[(336, 400), (340, 520), (338, 585)], fill='in'),
  },
}


def luminance(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def flood(img, inside, seeds, passable):
    """Pixels reachable from seeds through `passable` pixels, within `inside`."""
    w, h = img.size
    px = img.load()
    seen = set()
    queue = deque(s for s in seeds if inside[s[1]][s[0]])
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h) or not inside[y][x]:
            continue
        if not passable(px[x, y]):
            continue
        seen.add((x, y))
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return seen


def piece_mask(img, spec):
    w, h = img.size
    poly_img = Image.new('1', (w, h), 0)
    ImageDraw.Draw(poly_img).polygon(spec['poly'], fill=1)
    pp = poly_img.load()
    inside = [[pp[x, y] for x in range(w)] for y in range(h)]
    is_light = lambda p: p[3] < 128 or luminance(p) >= DARK
    if spec['mode'] == 'cut':
        backing = flood(img, inside, spec['seeds'], is_light)
        return {(x, y) for y in range(h) for x in range(w) if inside[y][x] and (x, y) not in backing}
    # inner: the figure region around the seed, plus its outline (dilate 4 px)
    core = flood(img, inside, spec['seeds'], lambda p: p[3] >= 128 and luminance(p) >= DARK)
    mask = set()
    for x, y in core:
        for dx in range(-4, 5):
            for dy in range(-4, 5):
                if 0 <= x + dx < w and 0 <= y + dy < h and inside[y + dy][x + dx]:
                    mask.add((x + dx, y + dy))
    return mask


def dilate(pixels, r, w, h):
    out = set()
    for x, y in pixels:
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r and 0 <= x + dx < w and 0 <= y + dy < h:
                    out.add((x + dx, y + dy))
    return out


def inpaint(img, hole):
    """Fill `hole` from its edge inward, each pixel the mean of its already
    known neighbours. Dark (outline) pixels are not used as sources, so the
    figure's lines don't bleed into the backing."""
    px = img.load()
    w, h = img.size
    usable = lambda p: p[3] < 40 or (p[3] >= 200 and luminance(p) >= DARK)
    known = {}
    frontier = deque()
    for x, y in hole:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if (nx, ny) in hole or not (0 <= nx < w and 0 <= ny < h):
                continue
            if usable(px[nx, ny]):
                frontier.append((x, y))
                break
    todo = set(hole)
    while frontier:
        x, y = frontier.popleft()
        if (x, y) not in todo:
            continue
        acc = [0, 0, 0, 0]
        n = 0
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if (dx or dy) and 0 <= nx < w and 0 <= ny < h and (nx, ny) not in todo:
                    p = known.get((nx, ny), px[nx, ny])
                    if (nx, ny) not in known and not usable(p):
                        continue
                    a = p[3] / 255
                    acc[0] += p[0] * a; acc[1] += p[1] * a; acc[2] += p[2] * a; acc[3] += p[3]
                    n += 1
        if not n:
            frontier.append((x, y))
            continue
        a = acc[3] / n
        colour = (round(acc[0] / n / max(a / 255, 1e-6)), round(acc[1] / n / max(a / 255, 1e-6)), round(acc[2] / n / max(a / 255, 1e-6)), round(a)) if a > 0 else (0, 0, 0, 0)
        colour = tuple(min(255, c) for c in colour)
        known[(x, y)] = colour
        px[x, y] = colour
        todo.discard((x, y))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) in todo:
                frontier.append((x + dx, y + dy))
    # Smooth the fill: relax each hole pixel toward the mean of its
    # neighbours, so the patch is a soft gradient rather than streaks.
    hole_list = list(known)
    for _ in range(80):
        nxt = {}
        for x, y in hole_list:
            acc = [0, 0, 0, 0]
            n = 0
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < w and 0 <= ny < h):
                    continue
                p = known.get((nx, ny))
                if p is None:
                    p = px[nx, ny]
                    if not usable(p):
                        continue
                for i in range(4):
                    acc[i] += p[i]
                n += 1
            if n:
                nxt[(x, y)] = tuple(round(v / n) for v in acc)
        known.update(nxt)
    for (x, y), colour in known.items():
        px[x, y] = colour


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--debug', help='write a contact sheet showing the pieces')
    args = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    debug_tiles = []
    for view, specs in PIECES.items():
        centre = specs['centre']
        src = Image.open(SRC / f'{view}_idle.webp').convert('RGBA')
        w, h = src.size
        body = src.copy()
        bpx = body.load()
        spx = src.load()
        behind_holes = set()
        tint = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        tpx = tint.load()
        colours = [(220, 60, 60, 150), (60, 120, 220, 150), (60, 180, 90, 150), (230, 160, 40, 150)]
        for i, (name, spec) in enumerate((k, v) for k, v in specs.items() if k != 'centre'):
            mask = piece_mask(src, spec)
            # The piece takes a 2 px margin of fringe with it; the hole on the
            # body is wider still, so the inpaint samples beyond the outline's
            # soft dark edge instead of smearing it.
            piece_px = dilate(mask, 2, w, h)
            hole = dilate(mask, 6, w, h)
            if spec.get('layer', 'behind') == 'behind':
                behind_holes |= dilate(mask, 4, w, h)
            for part, keep in spec.get('parts', {'': lambda y: True}).items():
                piece = Image.new('RGBA', (w, h), (0, 0, 0, 0))
                ppx = piece.load()
                for x, y in piece_px:
                    if keep(y):
                        ppx[x, y] = spx[x, y]
                piece.save(OUT / f"{view}_{part or name}.webp", 'WEBP', quality=90, method=6)
            for x, y in mask:
                tpx[x, y] = colours[i % len(colours)]
            inpaint(body, hole)
        body.save(OUT / f'{view}_plate.webp', 'WEBP', quality=90, method=6)
        for x, y in behind_holes:
            bpx[x, y] = (0, 0, 0, 0)
        body.save(OUT / f'{view}_body.webp', 'WEBP', quality=90, method=6)
        if args.debug:
            shown = Image.alpha_composite(Image.new('RGBA', (w, h), (244, 239, 229, 255)), src)
            shown = Image.alpha_composite(shown, tint)
            debug_tiles.append(shown)
            debug_tiles.append(Image.alpha_composite(Image.new('RGBA', (w, h), (244, 239, 229, 255)), body))
    if args.debug:
        sheet = Image.new('RGBA', (640 * len(debug_tiles) // 2, 960 * 2))
        for i, tile in enumerate(debug_tiles):
            sheet.paste(tile, ((i // 2) * 640, (i % 2) * 960))
        sheet.save(args.debug)
    print(f'Wrote rig pieces to {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
