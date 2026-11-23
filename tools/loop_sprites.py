"""Build eight-frame front/back act loops (dance, band) from generated strips.

A loop is assembled from a few source strips per character. Each strip is a
``Strip``: the file suffix, the view it shows, how many rows of four figures
it holds, and which frame numbers its figures become (``first``, ``first +
step``, ...). The output frames are 640x960 WebP files whose visible figure
bottom sits on the shared baseline, like the idle and walk art at half size.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Callable, NamedTuple

from PIL import Image

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


def build_loop(source_dir: Path, loop: str, names: tuple[str, ...], *,
               strips: tuple[Strip, ...] = DANCE_STRIPS,
               split: Callable[[Image.Image, int], list[Image.Image]] = grid_figures,
               shared_scale: bool | str = False,
               height_ratio: dict[str, float] | None = None) -> None:
    """Write ``zine/<name>/<view>_<loop>_NN.webp`` for every name.

    ``shared_scale`` False normalises each strip by its own tallest figure (the
    dance strips have different pixel densities); True scales all strips of a
    character by one factor, from the tallest figure across them; 'view'
    shares one factor between the strips of each view (front, back), for
    sources whose front and rear strips came out at different sizes. The tallest
    figure matches the idle figure height times ``height_ratio[name]`` (1 by
    default; a seated character is shorter than her standing idle drawing).
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
        if shared_scale == 'view':
            heights = [max(h for h, other in zip(heights, strips) if other.view == strip.view) for strip in strips]
        elif shared_scale:
            heights = [max(heights)] * len(groups)
        width_ratio = max(f.width / tallest for frames, tallest in zip(groups, heights) for f in frames)
        height = min((bbox[3] - bbox[1]) * height_ratio.get(name, 1), (1280 - 40) / width_ratio)
        for strip, frames, tallest in zip(strips, groups, heights):
            for index, frame in enumerate(frames):
                number = strip.first + index * strip.step
                out = EXTRACT.compose_frame(frame, tallest, height=height / 2, scale=2).resize(SIZE, Image.LANCZOS)
                path = ROOT / f'assets/sprites/zine/{name}/{strip.view}_{loop}_{number:02}.webp'
                temporary = path.with_suffix('.tmp')
                out.save(temporary, 'WEBP', quality=85, method=4)
                temporary.replace(path)
                print(path.relative_to(ROOT), flush=True)
