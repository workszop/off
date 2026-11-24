"""Production show act asset contract: every show loop (the garage band, the
Christmas carols, the murder mystery's investigators and its lying body) for
the staff who play it (Mr. T sings in the band only), and no show art for
the ghost."""
import hashlib
from pathlib import Path
import re
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
HUMANS = ('andy', 'jazz', 'olex', 'margo-v3')
STAFF = (*HUMANS, 'mrt')   # everyone who could be cast
# Who plays each act (SHOWS[key].roles in src/office3d/data.js).
CAST = {
    'band': STAFF,
    'xmas': HUMANS,
    'murder': ('jazz', 'olex', 'margo-v3'),
    'body': ('andy',),
}


def act_loops():
    """The acts in ACT_LOOPS (src/characters3d/standee.js): name -> (views, lay)."""
    source = (ROOT / 'src/characters3d/standee.js').read_text()
    table = re.search(r'^export const ACT_LOOPS = \{(.*?)\n\};', source, re.S | re.M).group(1)
    loops = {}
    for name, body in re.findall(r'^  (\w+): \{(.*?)\n  \},', table, re.S | re.M):
        views = re.findall(r"'(\w+)'", re.search(r'views: \[([^\]]*)\]', body).group(1))
        loops[name] = (tuple(views), bool(re.search(r'\blay: true\b', body)))
    return loops


def opaque_bbox(image):
    return image.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()


class ShowSpritesTest(unittest.TestCase):
    def test_the_loops_are_known(self):
        loops = act_loops()
        self.assertEqual(sorted(loops), sorted(CAST))
        self.assertEqual(loops['body'], (('front',), True))
        for act in ('band', 'xmas', 'murder'):
            self.assertEqual(loops[act], (('front', 'back'), False), act)

    def test_eight_distinct_transparent_frames_per_loop_player_and_view(self):
        for act, (views, lay) in act_loops().items():
            for name in CAST[act]:
                for view in views:
                    hashes = set()
                    for number in range(1, 9):
                        path = ROOT / f'assets/sprites/zine/{name}/{view}_{act}_{number:02}.webp'
                        with self.subTest(path=path), Image.open(path) as image:
                            self.assertEqual(image.size, (640, 960))   # same size as the dance frames
                            alpha = image.getchannel('A')
                            self.assertEqual(alpha.getextrema(), (0, 255))
                            bbox = opaque_bbox(image)
                            self.assertGreater(bbox[0], 0)
                            self.assertLess(bbox[2], 640)
                            self.assertGreater(bbox[1], 0)   # nothing cut off at the top (hats, a raised bell)
                            if lay:
                                # A lying figure is centred in the frame (the card lies
                                # down with the frame centre on the mark): its box in the
                                # middle vertically, clear of every edge, its length that
                                # of a standing figure.
                                self.assertLess(bbox[3], 960)
                                self.assertLessEqual(abs((bbox[1] + bbox[3]) / 2 - 480), 3)
                                self.assertLessEqual(abs((bbox[0] + bbox[2]) / 2 - 320), 60)
                                self.assertGreater(bbox[3] - bbox[1], 780)
                            else:
                                self.assertEqual(bbox[3], 908)   # standing on the shared baseline
                            hashes.add(hashlib.sha256(image.tobytes()).hexdigest())
                    self.assertEqual(len(hashes), 8, (act, name, view))

    def test_one_view_acts_have_no_other_views(self):
        for act, (views, _) in act_loops().items():
            for name in CAST[act]:
                for view in {'front', 'back', 'threequarter'} - set(views):
                    self.assertEqual(sorted((ROOT / f'assets/sprites/zine/{name}').glob(f'{view}_{act}_*')), [], (act, name, view))

    def test_only_the_cast_has_an_act(self):
        for act in act_loops():
            for name in set(STAFF) - set(CAST[act]):
                self.assertEqual(sorted((ROOT / f'assets/sprites/zine/{name}').glob(f'*_{act}_*')), [], (act, name))

    def test_the_ghost_takes_part_in_no_show(self):
        for act in act_loops():
            self.assertEqual(sorted((ROOT / 'assets/sprites/zine/ghost').glob(f'*_{act}_*')), [], act)


if __name__ == '__main__':
    unittest.main()
