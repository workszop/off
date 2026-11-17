#!/usr/bin/env python3
"""Extract eight paired front/rear dance poses without touching idle/walk art."""
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
        groups = []
        for suffix, rows in (('', ['front']), ('-between', ['front']), ('-back', ['back1', 'back2'])):
            with Image.open(ROOT / f'assets/sprites/dance-sources/{name}{suffix}.png') as source:
                frames = [EXTRACT.trim_frame(cell) for _, _, cell in EXTRACT.grid_cells(
                    source, rows=rows, cols=['1', '2', '3', '4'])]
            groups.append(frames)
        idle = Image.open(ROOT / f'assets/sprites/zine/{name}/front_idle.webp')
        bbox = idle.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
        # Source strips can have different pixel densities. Normalise each
        # strip once, then share the target height across both printed faces.
        heights = [max(f.height for f in frames) for frames in groups]
        width_ratio = max(f.width / tallest for frames, tallest in zip(groups, heights) for f in frames)
        height = min(bbox[3] - bbox[1], (1280 - 40) / width_ratio)
        for group_index, (frames, tallest) in enumerate(zip(groups, heights)):
            for index, frame in enumerate(frames):
                view = 'back' if group_index == 2 else 'front'
                number = index + 1 if view == 'back' else index * 2 + group_index + 1
                out = EXTRACT.compose_frame(frame, tallest, height=height / 2, scale=2)
                path = ROOT / f'assets/sprites/zine/{name}/{view}_dance_{number:02}.webp'
                temporary = path.with_suffix('.tmp')
                out.save(temporary, 'WEBP', quality=94, method=4)
                temporary.replace(path)
                print(path.relative_to(ROOT), flush=True)


if __name__ == '__main__':
    build()
