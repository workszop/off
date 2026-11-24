"""Build eight-frame front/back act loops (dance, show acts) from generated strips.

A loop is assembled from a few source strips per character. Each strip is a
``Strip``: the file suffix, the view it shows, how many rows of four figures
it holds, and which frame numbers its figures become (``first``, ``first +
step``, ...). The output frames are 640x960 WebP files whose visible figure
bottom sits on the shared baseline, like the idle and walk art at half size.
A lying loop (``lay=True``, a card that lies flat on the floor) is centred in
the frame instead: see ``compose_lying``.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from statistics import median
from typing import Callable, NamedTuple

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('extract', ROOT / 'tools/extract-atlas.py')
EXTRACT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXTRACT)
# Loop frames ship at half the idle/walk size (about 7 MB for the whole dance
# set instead of 26 MB); they load before the act can start.
SIZE = (640, 960)
FIGURES_PER_ROW = 4


class Strip(NamedTuple):
    suffix: str        # source file is <name><suffix>.png
    view: str          # 'front' or 'back'
    rows: int          # rows of four figures in the strip
    first: int         # frame number of the strip's first figure
    step: int          # frame number increment between figures


# The party dance: front key poses on odd frames, in-betweens on even ones,
# and a 2x4 rear sheet read in order.
DANCE_STRIPS = (
    Strip('', 'front', 1, 1, 2),
    Strip('-between', 'front', 1, 2, 2),
    Strip('-back', 'back', 2, 1, 1),
)
# Show acts: a key pose strip and an in-between strip for each view.
ACT_STRIPS = (
    Strip('', 'front', 1, 1, 2),
    Strip('-between', 'front', 1, 2, 2),
    Strip('-back', 'back', 1, 1, 2),
    Strip('-back-between', 'back', 1, 2, 2),
)

# A lying act (the murder show's body): front key poses and in-betweens only.
LYING_STRIPS = (
    Strip('', 'front', 1, 1, 2),
    Strip('-between', 'front', 1, 2, 2),
)
LYING_MARGIN = 20      # pixels (at 2x) kept clear on every side of a lying figure


def head_centre_x(figure: Image.Image, share: float = 0.12) -> float:
    """The horizontal middle of the opaque pixels in the top ``share`` of a figure.

    For a figure drawn lying on its back, seen from above with the head at
    the top, this is the middle of the head: unlike the bounding box it does
    not move when an arm or a knee swings out to one side.
    """
    alpha = figure.getchannel('A')
    rows = max(1, round(figure.height * share))
    pixels = alpha.load()
    total = weight = 0
    for y in range(rows):
        for x in range(figure.width):
            if pixels[x, y] > 128:
                total += x
                weight += 1
    return total / weight if weight else figure.width / 2


def compose_lying(figure: Image.Image, reference: float, height: float, scale: int = 2) -> Image.Image:
    """Fit a lying figure on a density-scaled frame, centred on the frame.

    The figure is scaled by ``height * scale / reference`` (``reference`` is
    the strip's median figure height), its bounding box is centred vertically
    and its head horizontally, so the middle of the frame is the middle of
    the body: the standee lays the card down with the frame centre on the
    character's mark.
    """
    frame_w, frame_h = 640 * scale, 960 * scale
    fit = height * scale / reference
    resized = figure.resize((round(figure.width * fit), round(figure.height * fit)), Image.Resampling.LANCZOS)
    visible = resized.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
    if not visible:
        raise ValueError('figure has no visible alpha after resampling')
    x = round(frame_w / 2 - head_centre_x(resized))
    y = round(frame_h / 2 - (visible[1] + visible[3]) / 2)
    if (x + visible[0] < LYING_MARGIN or x + visible[2] > frame_w - LYING_MARGIN
            or y + visible[1] < LYING_MARGIN or y + visible[3] > frame_h - LYING_MARGIN):
        raise ValueError('lying figure does not fit the frame; reduce its height')
    canvas = Image.new('RGBA', (frame_w, frame_h), (0, 0, 0, 0))
    canvas.alpha_composite(resized, (x, y))
    return canvas


def lying_fit(groups: list[list[Image.Image]], references: list[float], height: float, scale: int = 2) -> float:
    """The largest factor (at most 1) that keeps every lying figure inside the frame."""
    frame_w, frame_h = 640 * scale, 960 * scale
    factor = 1.0
    for frames, reference in zip(groups, references):
        fit = height * scale / reference
        for figure in frames:
            head = head_centre_x(figure) * fit
            half_w = max(head, figure.width * fit - head)
            factor = min(factor, (frame_w / 2 - LYING_MARGIN - 2) / half_w,
                         (frame_h - 2 * LYING_MARGIN - 4) / (figure.height * fit))
    return factor


def grid_figures(source: Image.Image, rows: int) -> list[Image.Image]:
    """Split a strip into equal-width cells, row by row, and trim each figure."""
    labels = [str(index) for index in range(rows)]
    return [EXTRACT.trim_frame(cell) for _, _, cell in EXTRACT.grid_cells(
        source, rows=labels, cols=[str(c + 1) for c in range(FIGURES_PER_ROW)])]


def alpha_run_figures(source: Image.Image, rows: int) -> list[Image.Image]:
    """Split a one-row strip at its transparent gutters, left to right.

    Generated strips do not place their figures in equal-width cells, so the
    figures are found as runs of columns holding opaque pixels (alpha > 128).
    """
    if rows != 1:
        raise ValueError('alpha run splitting reads one row of figures')
    mask = source.getchannel('A').point(lambda a: 255 if a > 128 else 0)
    width, height = mask.size
    pixels = mask.load()
    occupied = [any(pixels[x, y] for y in range(height)) for x in range(width)]
    spans, start = [], None
    for x, filled in enumerate(occupied + [False]):
        if filled and start is None:
            start = x
        elif not filled and start is not None:
            spans.append((start, x))
            start = None
    if len(spans) != FIGURES_PER_ROW:
        raise ValueError(f'found {len(spans)} figures separated by transparent gutters, '
                         f'expected {FIGURES_PER_ROW}')
    # Cut halfway through each gutter so soft edges stay with their figure.
    cuts = [0] + [(left[1] + right[0]) // 2 for left, right in zip(spans, spans[1:])] + [width]
    return [EXTRACT.trim_frame(source.crop((x0, 0, x1, height))) for x0, x1 in zip(cuts, cuts[1:])]


def component_figures(source: Image.Image, rows: int) -> list[Image.Image]:
    """Split a one-row strip into its four largest connected figures, left to right.

    For strips whose figures do not touch but lean into each other's columns
    (a guitar neck over the next figure's hair, a kicked-out leg), so that no
    transparent column separates them. A figure is an 8-connected set of
    opaque pixels (alpha > 128); smaller detached specks are dropped and a
    one-pixel feather is kept, as ``trim_frame`` does.
    """
    if rows != 1:
        raise ValueError('component splitting reads one row of figures')
    rgba = source.convert('RGBA')
    alpha = rgba.getchannel('A')
    width, height = alpha.size
    data = alpha.point(lambda a: 255 if a > 128 else 0).tobytes()
    parent: list[int] = []

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    runs: list[tuple[int, int, int]] = []          # (y, x0, x1) for run i
    previous: list[int] = []
    for y in range(height):
        row = data[y * width:(y + 1) * width]
        current, x = [], row.find(b'\xff')
        while x != -1:
            end = row.find(b'\x00', x)
            end = width if end == -1 else end
            index = len(runs)
            runs.append((y, x, end))
            parent.append(index)
            for other in previous:
                _, ox0, ox1 = runs[other]
                if ox0 <= end and ox1 >= x:        # touching, diagonals included
                    parent[find(other)] = find(index)
            current.append(index)
            x = row.find(b'\xff', end)
        previous = current
    groups: dict[int, list[tuple[int, int, int]]] = {}
    for index, run in enumerate(runs):
        groups.setdefault(find(index), []).append(run)
    largest = sorted(groups.values(), key=lambda g: sum(x1 - x0 for _, x0, x1 in g), reverse=True)[:FIGURES_PER_ROW]
    if len(largest) != FIGURES_PER_ROW:
        raise ValueError(f'found {len(largest)} separate figures, expected {FIGURES_PER_ROW}')
    largest.sort(key=lambda g: sum((x0 + x1) * (x1 - x0) for _, x0, x1 in g) / sum(x1 - x0 for _, x0, x1 in g))
    figures = []
    for group in largest:
        mask = Image.new('L', (width, height), 0)
        draw = ImageDraw.Draw(mask)
        for y, x0, x1 in group:
            draw.line((x0, y, x1 - 1, y), fill=255)
        figure = rgba.copy()
        figure.putalpha(ImageChops.multiply(alpha, mask.filter(ImageFilter.MaxFilter(3))))
        figures.append(figure.crop(mask.getbbox()))
    return figures


def separate_figures(source: Image.Image, rows: int) -> list[Image.Image]:
    """``alpha_run_figures``, or ``component_figures`` when no clear gutters separate the figures."""
    try:
        return alpha_run_figures(source, rows)
    except ValueError:
        return component_figures(source, rows)


def build_loop(source_dir: Path, loop: str, names: tuple[str, ...], *,
               strips: tuple[Strip, ...] = DANCE_STRIPS,
               split: Callable[[Image.Image, int], list[Image.Image]] = grid_figures,
               shared_scale: bool | str = False,
               height_ratio: dict[str, float] | None = None,
               lay: bool = False) -> None:
    """Write ``zine/<name>/<view>_<loop>_NN.webp`` for every name.

    ``shared_scale`` False normalises each strip by its own tallest figure (the
    dance strips have different pixel densities); True scales all strips of a
    character by one factor, from the tallest figure across them; 'view'
    shares one factor between the strips of each view (front, back), for
    sources whose front and rear strips came out at different sizes; 'strip'
    scales every strip on its own by its median figure height, for sources
    drawn at a different scale in every strip (a median, unlike the tallest
    figure, is not thrown by one pose that leans or stretches). The tallest
    (or median) figure matches the idle figure height times
    ``height_ratio[name]`` (1 by default; a seated character is shorter than
    her standing idle drawing).

    ``lay`` builds a lying loop: the figure, drawn seen from above with the
    head at the top, gets the body length of the standing idle figure (times
    the ratio, reduced only as far as the frame needs) and is centred in the
    frame (see ``compose_lying``) instead of standing on the baseline.
    """
    height_ratio = height_ratio or {}
    for name in names:
        groups = []
        for strip in strips:
            with Image.open(source_dir / f'{name}{strip.suffix}.png') as source:
                frames = split(source, strip.rows)
            if len(frames) != strip.rows * FIGURES_PER_ROW:
                raise ValueError(f'{name}{strip.suffix}.png: found {len(frames)} figures')
            groups.append(frames)
        idle = Image.open(ROOT / f'assets/sprites/zine/{name}/front_idle.webp')
        bbox = idle.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
        heights = [max(f.height for f in frames) for frames in groups]
        if shared_scale == 'strip':
            heights = [median(f.height for f in frames) for frames in groups]
        elif shared_scale == 'view':
            heights = [max(h for h, other in zip(heights, strips) if other.view == strip.view) for strip in strips]
        elif shared_scale:
            heights = [max(heights)] * len(groups)
        if lay:
            height = (bbox[3] - bbox[1]) * height_ratio.get(name, 1) / 2
            factor = lying_fit(groups, heights, height)
            height *= factor
            print(f'{name}: lying body length {height:.0f} px of 960 (fit factor {factor:.3f})', flush=True)
        else:
            width_ratio = max(f.width / tallest for frames, tallest in zip(groups, heights) for f in frames)
            height = min((bbox[3] - bbox[1]) * height_ratio.get(name, 1), (1280 - 40) / width_ratio) / 2
        for strip, frames, tallest in zip(strips, groups, heights):
            for index, frame in enumerate(frames):
                number = strip.first + index * strip.step
                composed = (compose_lying(frame, tallest, height) if lay
                            else EXTRACT.compose_frame(frame, tallest, height=height, scale=2))
                out = composed.resize(SIZE, Image.LANCZOS)
                path = ROOT / f'assets/sprites/zine/{name}/{strip.view}_{loop}_{number:02}.webp'
                temporary = path.with_suffix('.tmp')
                out.save(temporary, 'WEBP', quality=85, method=4)
                temporary.replace(path)
                print(path.relative_to(ROOT), flush=True)
