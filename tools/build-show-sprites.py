#!/usr/bin/env python3
"""Build the eight-frame show act loops (for now the garage band) of the staff.

Usage: python3 tools/build-show-sprites.py band

Sources live in assets/sprites/show-sources/<act>/ (see the README there):
per character a key pose strip and an in-between strip for each view.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from loop_sprites import ACT_STRIPS, ROOT, alpha_run_figures, build_loop  # noqa: E402

HUMANS = ('andy', 'jazz', 'olex', 'margo-v3')
ACTS = {
    # Jazz plays the drums seated on a stool. Her strips draw her smaller
    # than the standing staff (about 0.78 of their tallest figure), so a ratio
    # tuned by eye against front_idle and back_idle keeps her head the idle
    # size; the seated figure ends up about as tall as her standing drawing.
    'band': {'jazz': 1.03},
}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('act', choices=sorted(ACTS))
    act = parser.parse_args(argv).act
    build_loop(ROOT / f'assets/sprites/show-sources/{act}', act, HUMANS, strips=ACT_STRIPS,
               split=alpha_run_figures, shared_scale=True, height_ratio=ACTS[act])


if __name__ == '__main__':
    main()
