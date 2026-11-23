"""Production show act asset contract: the garage band loop for the four staff."""
import hashlib
from pathlib import Path
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
HUMANS = ('andy', 'jazz', 'olex', 'margo-v3')


class ShowSpritesTest(unittest.TestCase):
    def test_eight_distinct_transparent_grounded_band_frames_per_human_and_view(self):
        for name in HUMANS:
            for view in ('front', 'back'):
                hashes = set()
                for number in range(1, 9):
                    path = ROOT / f'assets/sprites/zine/{name}/{view}_band_{number:02}.webp'
                    with self.subTest(path=path), Image.open(path) as image:
                        self.assertEqual(image.size, (640, 960))   # same size as the dance frames
                        alpha = image.getchannel('A')
                        self.assertEqual(alpha.getextrema(), (0, 255))
                        bbox = alpha.point(lambda a: 255 if a > 128 else 0).getbbox()
                        self.assertGreater(bbox[0], 0)
                        self.assertLess(bbox[2], 640)
                        self.assertGreater(bbox[1], 0)
                        self.assertEqual(bbox[3], 908)
                        hashes.add(hashlib.sha256(image.tobytes()).hexdigest())
                self.assertEqual(len(hashes), 8, (name, view))

    def test_the_ghost_does_not_play_in_the_band(self):
        self.assertEqual(sorted((ROOT / 'assets/sprites/zine/ghost').glob('*_band_*')), [])


if __name__ == '__main__':
    unittest.main()
