#!/usr/bin/env python3
"""Build the eight-frame show act loops (the garage band, Christmas, the murder mystery) of the staff.

Usage: python3 tools/build-show-sprites.py band   (or xmas, murder)

Sources live in assets/sprites/show-sources/<show>/ (see the README there):
per character a key pose strip and an in-between strip for each view. A show
may give its characters different acts (the murder mystery: Andy plays the
body, lying on the floor, the others investigate); each act is built in turn.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from loop_sprites import ACT_STRIPS, LYING_STRIPS, ROOT, alpha_run_figures, build_loop  # noqa: E402

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

# The murder mystery has two acts. Its strips were drawn at a different scale
# in every strip (Andy's in-between figures are about an eighth smaller than
# his key poses, Olex's in-between strip is a different size altogether), so
# every strip is scaled on its own by its median figure height ('strip').
# - 'murder': Jazz (deerstalker), Olex and Margo (fedora), standing. The hats
#   add height above the head; the ratios, tuned on contact sheets against the
#   idle drawings, keep the heads about the idle size.
# - 'body': Andy lying on his back, drawn from above with his head at the top,
#   one view only. His body length is his standing idle height (ratio 1); his
#   sprawled arms fit the 640-wide frame without shrinking (the builder
#   prints the fit factor), and the figure is centred in the frame so the
#   card lies with the middle of his body on his mark.
MURDER = (
    {'act': 'murder', 'names': ('jazz', 'olex', 'margo-v3'), 'strips': ACT_STRIPS,
     'ratio': {'jazz': 1.06, 'olex': 1.0, 'margo-v3': 1.04}},
    {'act': 'body', 'names': ('andy',), 'strips': LYING_STRIPS, 'ratio': {'andy': 1.0}, 'lay': True},
)


def builds(show):
    """The act loops a show's sources make: (act, names, strips, shared, ratio, lay)."""
    if show == 'murder':
        return [(b['act'], b['names'], b['strips'], 'strip', b['ratio'], b.get('lay', False)) for b in MURDER]
    return [(show, HUMANS, ACT_STRIPS, SHARED[show], ACTS[show], False)]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('show', choices=sorted([*ACTS, 'murder']))
    show = parser.parse_args(argv).show
    for act, names, strips, shared, ratio, lay in builds(show):
        build_loop(ROOT / f'assets/sprites/show-sources/{show}', act, names, strips=strips,
                   split=alpha_run_figures, shared_scale=shared, height_ratio=ratio, lay=lay)


if __name__ == '__main__':
    main()
