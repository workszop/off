#!/usr/bin/env python3
"""Extract four reference-guided dance poses without touching idle/walk art."""
import importlib.util
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('extract', ROOT / 'tools/extract-atlas.py')
EXTRACT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXTRACT)
TYPES = ('andy', 'jazz', 'olex', 'ghost', 'margo-v3')


def build():
    for name in TYPES:
        source = Image.open(ROOT / f'assets/sprites/dance-sources/{name}.png')
        frames = [EXTRACT.trim_frame(cell) for _, _, cell in EXTRACT.grid_cells(
            source, rows=['front'], cols=['dance_01', 'dance_02', 'dance_03', 'dance_04'])]
        idle = Image.open(ROOT / f'assets/sprites/zine/{name}/front_idle.webp')
        bbox = idle.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
        tallest = max(frame.height for frame in frames)
        # One common scale prevents head/body size changing between poses.
        height = min(bbox[3] - bbox[1], (1280 - 40) * tallest / max(f.width for f in frames))
        for index, frame in enumerate(frames, 1):
            out = EXTRACT.compose_frame(frame, tallest, height=height / 2, scale=2)
            path = ROOT / f'assets/sprites/zine/{name}/front_dance_{index:02}.webp'
            out.save(path, 'WEBP', quality=95, method=6)
            print(path.relative_to(ROOT))


if __name__ == '__main__':
    build()
