#!/usr/bin/env python3
"""Extract cup/printout artwork; do not alter existing character animations."""
import importlib.util
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('extract', ROOT / 'tools/extract-atlas.py')
EXTRACT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXTRACT)
TYPES = ('andy', 'jazz', 'olex', 'margo-v3')
VIEWS = ('front', 'threequarter', 'back')
PROPS = ('coffee', 'printouts')


def build():
    for name in TYPES:
        with Image.open(ROOT / f'assets/sprites/prop-sources/{name}.png') as source:
            cells = [(prop, view, EXTRACT.trim_frame(cell)) for prop, view, cell in
                     EXTRACT.grid_cells(source, rows=PROPS, cols=VIEWS)]
        tallest = max(cell.height for _, _, cell in cells)
        with Image.open(ROOT / f'assets/sprites/zine/{name}/front_idle.webp') as idle:
            bbox = idle.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
        target_height = min(bbox[3] - bbox[1], 1240 * tallest / max(cell.width for _, _, cell in cells))
        for prop, view, cell in cells:
            frame = EXTRACT.compose_frame(cell, tallest, height=target_height / 2, scale=2)
            output = ROOT / f'assets/sprites/zine/{name}/{view}_{prop}.webp'
            temporary = output.with_suffix('.tmp')
            frame.save(temporary, 'WEBP', quality=94, method=4)
            temporary.replace(output)
            print(output.relative_to(ROOT), flush=True)


if __name__ == '__main__':
    build()
