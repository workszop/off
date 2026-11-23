#!/usr/bin/env python3
"""Extract eight paired front/rear dance poses without touching idle/walk art."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from loop_sprites import ROOT, build_loop  # noqa: E402

TYPES = ('andy', 'jazz', 'olex', 'ghost', 'margo-v3')


def build():
    build_loop(ROOT / 'assets/sprites/dance-sources', 'dance', TYPES)


if __name__ == '__main__':
    build()
