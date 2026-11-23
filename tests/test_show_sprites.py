"""Production show act asset contract: every show loop (the garage band, the
Christmas carols) for the four staff, and no show art for the ghost."""
import hashlib
from pathlib import Path
import re
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
HUMANS = ('andy', 'jazz', 'olex', 'margo-v3')


def act_loops():
    """The act names in ACT_LOOPS (src/characters3d/standee.js)."""
    source = (ROOT / 'src/characters3d/standee.js').read_text()
    table = re.search(r'^export const ACT_LOOPS = \{(.*?)\n\};', source, re.S | re.M).group(1)
    return re.findall(r'^  (\w+): \{', table, re.M)


class ShowSpritesTest(unittest.TestCase):
    def test_the_loops_are_known(self):
        self.assertEqual(act_loops(), ['band', 'xmas'])

    def test_eight_distinct_transparent_grounded_frames_per_loop_human_and_view(self):
        for act in act_loops():
            for name in HUMANS:
                for view in ('front', 'back'):
                    hashes = set()
                    for number in range(1, 9):
                        path = ROOT / f'assets/sprites/zine/{name}/{view}_{act}_{number:02}.webp'
                        with self.subTest(path=path), Image.open(path) as image:
                            self.assertEqual(image.size, (640, 960))   # same size as the dance frames
                            alpha = image.getchannel('A')
                            self.assertEqual(alpha.getextrema(), (0, 255))
                            bbox = alpha.point(lambda a: 255 if a > 128 else 0).getbbox()
                            self.assertGreater(bbox[0], 0)
                            self.assertLess(bbox[2], 640)
                            self.assertGreater(bbox[1], 0)   # nothing cut off at the top (hats, a raised bell)
                            self.assertEqual(bbox[3], 908)
                            hashes.add(hashlib.sha256(image.tobytes()).hexdigest())
                    self.assertEqual(len(hashes), 8, (act, name, view))

    def test_the_ghost_takes_part_in_no_show(self):
        for act in act_loops():
            self.assertEqual(sorted((ROOT / 'assets/sprites/zine/ghost').glob(f'*_{act}_*')), [], act)


if __name__ == '__main__':
    unittest.main()
