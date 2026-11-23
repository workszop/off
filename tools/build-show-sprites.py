#!/usr/bin/env python3
"""Build the eight-frame show act loops (the garage band, Christmas) of the staff.

Usage: python3 tools/build-show-sprites.py band   (or xmas)

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
    # Christmas: everyone wears a Santa hat, which makes the tallest figure
    # taller than the head and body alone, so each character gets a ratio
    # above 1, tuned by eye against front_idle and back_idle. Keeping the head
    # exactly the idle size would need about 1.1 to 1.15, which puts the top
    # of the hat above the 640x960 frame; these are the largest ratios that
    # keep the hat inside it (a few pixels of margin): heads come out about
    # the idle size, bodies about 5% shorter. Jazz's idle drawing leaves room
    # above her head, so she gets a little more.
    'xmas': {'andy': 1.05, 'jazz': 1.09, 'olex': 1.05, 'margo-v3': 1.07},
}
# Strips that share one scale: 'view' for Christmas, whose front and rear
# strips were generated at different sizes (Olex's front figures are about a
# fifth smaller than her rear ones).
SHARED = {'band': True, 'xmas': 'view'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('act', choices=sorted(ACTS))
    act = parser.parse_args(argv).act
    build_loop(ROOT / f'assets/sprites/show-sources/{act}', act, HUMANS, strips=ACT_STRIPS,
               split=alpha_run_figures, shared_scale=SHARED[act], height_ratio=ACTS[act])


if __name__ == '__main__':
    main()
