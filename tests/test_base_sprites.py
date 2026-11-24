"""Production idle/walk contract for Mr. T, the human added after the first
archive, and the figure splitter his band strips need."""
import hashlib
import sys
from pathlib import Path
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from loop_sprites import alpha_run_figures, component_figures, separate_figures  # noqa: E402

VIEWS = ('front', 'threequarter', 'back')


def opaque_bbox(image):
    return image.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()


class MrTBaseSpritesTest(unittest.TestCase):
    def test_fifteen_grounded_frames_with_three_distinct_poses_per_view(self):
        for view in VIEWS:
            hashes = {}
            for frame in ('idle', 'walk_01', 'walk_02', 'walk_03', 'walk_04'):
                path = ROOT / f'assets/sprites/zine/mrt/{view}_{frame}.webp'
                with self.subTest(path=path), Image.open(path) as image:
                    self.assertEqual(image.size, (1280, 1920))   # the idle/walk density of every human
                    self.assertEqual(image.getchannel('A').getextrema(), (0, 255))
                    box = opaque_bbox(image)
                    self.assertGreater(box[0], 0)
                    self.assertLess(box[2], 1280)
                    self.assertGreater(box[1], 0)
                    self.assertEqual(box[3], 1816)
                    hashes[frame] = hashlib.sha256(image.tobytes()).hexdigest()
            self.assertEqual(hashes['walk_02'], hashes['walk_01'], view)
            self.assertEqual(hashes['walk_04'], hashes['walk_03'], view)
            self.assertEqual(len(set(hashes.values())), 3, view)

    def test_his_standing_height_follows_the_other_humans(self):
        heights = {}
        for name in ('andy', 'olex', 'margo-v3', 'mrt'):
            with Image.open(ROOT / f'assets/sprites/zine/{name}/front_idle.webp') as image:
                box = opaque_bbox(image)
                heights[name] = box[3] - box[1]
        for name in ('andy', 'olex', 'margo-v3'):
            self.assertLessEqual(abs(heights['mrt'] - heights[name]) / heights[name], 0.03, name)

    def test_no_soft_halo_survives_round_any_of_his_frames(self):
        from PIL import ImageChops, ImageFilter
        for path in sorted((ROOT / 'assets/sprites/zine/mrt').glob('*.webp')):
            with self.subTest(path=path), Image.open(path) as image:
                alpha = image.getchannel('A')
                # Only the edge feather may be translucent: two logical pixels at most.
                reach = 5 if image.width == 640 else 9
                near = alpha.point(lambda a: 255 if a > 128 else 0).filter(ImageFilter.MaxFilter(reach))
                stray = ImageChops.multiply(alpha.point(lambda a: 255 if a > 8 else 0), ImageChops.invert(near))
                self.assertIsNone(stray.getbbox())

    def test_he_has_only_base_dance_and_band_frames(self):
        names = {path.name for path in (ROOT / 'assets/sprites/zine/mrt').iterdir()}
        expected = {f'{view}_{frame}.webp' for view in VIEWS
                    for frame in ('idle', 'walk_01', 'walk_02', 'walk_03', 'walk_04')}
        expected |= {f'{view}_{loop}_{number:02}.webp' for view in ('front', 'back')
                     for loop in ('dance', 'band') for number in range(1, 9)}
        self.assertEqual(names, expected)


class ComponentFiguresTest(unittest.TestCase):
    def strip(self):
        """Four blocks; the second has an arm reaching over the first one's columns."""
        image = Image.new('RGBA', (400, 100), (0, 0, 0, 0))
        for index, x in enumerate((20, 120, 220, 320)):
            image.paste((10 * index, 60, 90, 255), (x, 20, x + 60, 90))
        image.paste((10, 60, 90, 255), (60, 5, 125, 12))     # the arm, above the first block
        image.paste((10, 60, 90, 255), (120, 5, 125, 20))    # ... joined to the second block
        image.paste((200, 0, 0, 255), (330, 2, 333, 5))      # a detached speck
        return image

    def test_overlapping_columns_defeat_the_gutter_split_but_not_the_component_split(self):
        strip = self.strip()
        with self.assertRaises(ValueError):
            alpha_run_figures(strip, 1)
        figures = component_figures(strip, 1)
        self.assertEqual([figure.size for figure in figures], [(60, 70), (120, 85), (60, 70), (60, 70)])   # the arm stays with its own figure
        self.assertEqual([f.size for f in separate_figures(strip, 1)], [f.size for f in figures])

    def test_clear_gutters_give_the_same_figures_either_way(self):
        strip = Image.new('RGBA', (400, 100), (0, 0, 0, 0))
        for x in (20, 120, 220, 320):
            strip.paste((30, 60, 90, 255), (x, 20, x + 60, 90))
        for one, other in zip(alpha_run_figures(strip, 1), component_figures(strip, 1)):
            self.assertEqual(one.tobytes(), other.tobytes())

    def test_a_strip_without_four_figures_is_refused(self):
        strip = Image.new('RGBA', (400, 100), (0, 0, 0, 0))
        strip.paste((30, 60, 90, 255), (20, 20, 80, 90))
        with self.assertRaises(ValueError):
            component_figures(strip, 1)


if __name__ == '__main__':
    unittest.main()
