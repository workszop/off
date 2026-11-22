"""Contract for generated coffee-cup and printout artwork."""
import hashlib
from pathlib import Path
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


class PropSpritesTest(unittest.TestCase):
    def test_all_four_characters_have_distinct_transparent_prop_views(self):
        for name in ('andy', 'jazz', 'olex', 'margo-v3'):
            hashes = set()
            for prop in ('coffee', 'printouts'):
                for view in ('front', 'threequarter', 'back'):
                    path = ROOT / f'assets/sprites/zine/{name}/{view}_{prop}.webp'
                    with self.subTest(path=path), Image.open(path) as image:
                        self.assertEqual(image.size, (1280, 1920))
                        alpha = image.getchannel('A')
                        self.assertEqual(alpha.getextrema()[0], 0)
                        self.assertGreaterEqual(alpha.getextrema()[1], 250)
                        box = alpha.point(lambda a: 255 if a > 128 else 0).getbbox()
                        self.assertGreater(box[0], 0)
                        self.assertLess(box[2], 1280)
                        self.assertEqual(box[3], 1816)
                        hashes.add(hashlib.sha256(image.tobytes()).hexdigest())
            self.assertEqual(len(hashes), 6)
        for prop in ('coffee', 'printouts'):
            self.assertFalse(list((ROOT / 'assets/sprites/zine/ghost').glob(f'*_{prop}.webp')))


if __name__ == '__main__':
    unittest.main()
