#!/usr/bin/env python3
"""Extract eight paired front/rear dance poses without touching idle/walk art.

Usage: python3 tools/build-dance-sprites.py [--only NAME ...]
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from loop_sprites import ACT_STRIPS, ROOT, build_loop, separate_figures  # noqa: E402

TYPES = ('andy', 'jazz', 'olex', 'ghost', 'margo-v3')
# Characters whose dance sources are laid out like a show act: four 1x4 strips
# (key poses and in-betweens for each view, see dance-sources/README.md), split
# at their transparent gutters. Every strip is scaled on its own by its median
# figure height (Mr. T's rear in-between strip came out about 4% larger than
# his other three). The ratio keeps the body the size of the standing idle
# drawing: his dance paper backing is about 1.07 of the figure inside it, his
# idle backing 998 px around a 942 px figure, so (942 / 998) * 1.07 = 1.01.
ACT_STYLE = {'mrt': 1.01}


def build(only=None):
    wanted = lambda names: tuple(name for name in names if only is None or name in only)  # noqa: E731
    build_loop(ROOT / 'assets/sprites/dance-sources', 'dance', wanted(TYPES))
    build_loop(ROOT / 'assets/sprites/dance-sources', 'dance', wanted(ACT_STYLE), strips=ACT_STRIPS,
               split=separate_figures, shared_scale='strip', height_ratio=ACT_STYLE)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--only', action='append', choices=sorted([*TYPES, *ACT_STYLE]), metavar='NAME',
                        help='build only this character (repeatable); the others stay untouched')
    arguments = parser.parse_args()
    build(set(arguments.only) if arguments.only else None)
