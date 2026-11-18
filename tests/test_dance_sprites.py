"""Production dance asset contract, independent of the original walk archive."""
import hashlib
from pathlib import Path
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


class DanceSpritesTest(unittest.TestCase):
    def test_eight_distinct_transparent_grounded_frames_per_character_and_view(self):
        for name in ('andy', 'jazz', 'olex', 'ghost', 'margo-v3'):
            for view in ('front', 'back'):
                hashes = set()
                for number in range(1, 9):
                    path = ROOT / f'assets/sprites/zine/{name}/{view}_dance_{number:02}.webp'
                    with self.subTest(path=path), Image.open(path) as image:
                        self.assertEqual(image.size, (640, 960))   # half the idle/walk size: fast to load
                        alpha = image.getchannel('A')
                        self.assertEqual(alpha.getextrema(), (0, 255))
                        bbox = alpha.point(lambda a: 255 if a > 128 else 0).getbbox()
                        self.assertGreater(bbox[0], 0)
                        self.assertLess(bbox[2], 640)
                        self.assertEqual(bbox[3], 908)
                        hashes.add(hashlib.sha256(image.tobytes()).hexdigest())
                self.assertEqual(len(hashes), 8, (name, view))


if __name__ == '__main__':
    unittest.main()
