import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("extract_atlas", ROOT / "tools" / "extract-atlas.py")
EXTRACT = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(EXTRACT)
BUILD_SPEC = importlib.util.spec_from_file_location("rebuild_sprites", ROOT / "tools" / "rebuild-sprites.py")
BUILD = importlib.util.module_from_spec(BUILD_SPEC)
BUILD_SPEC.loader.exec_module(BUILD)


class ExtractAtlasTests(unittest.TestCase):
    def test_resampled_visible_alpha_stays_on_the_paper_baseline(self):
        figure = Image.new('RGBA', (5, 8), (20, 40, 60, 255))
        for x in range(5):
            figure.putpixel((x, 7), (20, 40, 60, 0))
        figure.putpixel((2, 7), (20, 40, 60, 129))
        canvas = EXTRACT.compose_frame(figure, tallest=8)
        visible = canvas.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
        self.assertEqual(visible[3], 1816)

    def test_custom_grid_preview_matches_requested_rows_and_columns(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            atlas = Image.new('RGBA', (20, 40), (0, 0, 0, 0))
            for x in range(5, 15):
                for y in range(5, 35):
                    atlas.putpixel((x, y), (30, 60, 80, 255))
            atlas.save(root / 'atlas.png')
            subprocess.run([sys.executable, str(ROOT / 'tools/extract-atlas.py'),
                            str(root / 'atlas.png'), 'test', '--grid', '--rows', 'front',
                            '--cols', 'idle', '--output-dir', str(root / 'out'),
                            '--preview', str(root / 'preview.png')], check=True, capture_output=True)
            with Image.open(root / 'preview.png') as preview:
                self.assertEqual(preview.size, (160, 240))

    def test_runtime_encoding_keeps_exact_alpha_without_lossless_color_bloat(self):
        image = Image.new('RGBA', (64, 64), (32, 65, 101, 255))
        image.putpixel((0, 0), (0, 0, 0, 0))
        image.putpixel((1, 0), (32, 65, 101, 127))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'sprite.webp'
            BUILD.save_runtime(image, path)
            self.assertEqual(Image.open(path).getchannel('A').tobytes(), image.getchannel('A').tobytes())
            self.assertIn(b'VP8 ', path.read_bytes())

    def test_scaled_canvas_keeps_baseline_at_high_density(self):
        figure = Image.new("RGBA", (80, 863), (30, 30, 30, 255))

        canvas = EXTRACT.compose_frame(figure, tallest=863, height=863, scale=2)

        self.assertEqual(canvas.size, (1280, 1920))
        self.assertEqual(canvas.getbbox(), (560, 90, 720, 1816))

    def test_transparent_atlas_preserves_existing_alpha_and_rgb(self):
        atlas = Image.new("RGBA", (16, 16), (236, 172, 131, 0))
        atlas.putpixel((7, 8), (11, 22, 33, 96))

        prepared = EXTRACT.prepare_atlas(atlas)

        self.assertEqual(prepared.mode, "RGBA")
        self.assertEqual(prepared.getpixel((7, 8)), (11, 22, 33, 96))
        self.assertEqual(prepared.getpixel((0, 0)), (236, 172, 131, 0))

    def test_translucent_opaque_magenta_atlas_is_still_chroma_keyed(self):
        atlas = Image.new("RGBA", (16, 16), (255, 0, 255, 255))
        atlas.putpixel((7, 8), (11, 22, 33, 96))

        prepared = EXTRACT.prepare_atlas(atlas)

        self.assertEqual(prepared.getpixel((0, 0))[3], 0)

    def test_compose_frame_rejects_figure_taller_than_canvas(self):
        figure = Image.new("RGBA", (80, 900), (30, 30, 30, 255))

        with self.assertRaisesRegex(ValueError, "exceeds available frame height"):
            EXTRACT.compose_frame(figure, tallest=900, height=1000, scale=2)

    def test_scale_must_be_a_positive_integer(self):
        with self.assertRaises(ValueError):
            EXTRACT.validate_scale(0)
        with self.assertRaises(ValueError):
            EXTRACT.validate_scale(-1)
        self.assertEqual(EXTRACT.validate_scale(2), 2)

    def test_grid_cells_keep_main_figure_and_nearby_alpha_feather(self):
        atlas = Image.new("RGBA", (50, 40), (0, 0, 0, 0))
        # The first 10x10 grid cell contains a connected figure, a soft edge
        # pixel, and an opaque detached speck that must not ship.
        for y in range(2, 8):
            for x in range(2, 8):
                atlas.putpixel((x, y), (30, 40, 50, 255))
        atlas.putpixel((1, 4), (30, 40, 50, 96))
        atlas.putpixel((9, 9), (255, 230, 20, 255))

        cells = list(EXTRACT.grid_cells(atlas))

        self.assertEqual(len(cells), 20)
        first = cells[0][2]
        self.assertEqual(first.getpixel((2, 2))[3], 255)
        self.assertEqual(first.getpixel((1, 4))[3], 96)
        self.assertEqual(first.getpixel((9, 9))[3], 0)

    def test_grid_cells_accept_custom_three_by_three_labels(self):
        atlas = Image.new("RGBA", (90, 60), (0, 0, 0, 0))
        # Give every cell a connected opaque mark so grid extraction can
        # distinguish the requested rows and columns without gap detection.
        for row in range(3):
            for col in range(3):
                x0, y0 = col * 30, row * 20
                for y in range(y0 + 3, y0 + 17):
                    for x in range(x0 + 4, x0 + 26):
                        atlas.putpixel((x, y), (row * 60, col * 60, 80, 255))

        cells = list(EXTRACT.grid_cells(
            atlas,
            rows=["front", "threequarter", "back"],
            cols=["idle", "walk_01", "walk_03"],
        ))

        self.assertEqual([(row, col) for row, col, _ in cells], [
            ("front", "idle"), ("front", "walk_01"), ("front", "walk_03"),
            ("threequarter", "idle"), ("threequarter", "walk_01"), ("threequarter", "walk_03"),
            ("back", "idle"), ("back", "walk_01"), ("back", "walk_03"),
        ])
        self.assertEqual(cells[0][2].size, (30, 20))

    def test_trim_frame_removes_transparent_gutters_and_detached_specks(self):
        image = Image.new("RGBA", (100, 140), (0, 0, 0, 0))
        for y in range(18, 122):
            for x in range(30, 72):
                image.putpixel((x, y), (30, 40, 50, 255))
        image.putpixel((3, 4), (255, 255, 255, 255))

        trimmed = EXTRACT.trim_frame(image)

        self.assertEqual(trimmed.size, (42, 104))
        self.assertEqual(trimmed.getpixel((0, 0))[3], 255)

    def test_frame_cli_writes_lossless_normalized_webp_to_output_dir(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "andy.png"
            output = Path(directory) / "sprites"
            image = Image.new("RGBA", (100, 140), (0, 0, 0, 0))
            for y in range(18, 122):
                for x in range(30, 72):
                    image.putpixel((x, y), (30, 40, 50, 255))
            image.save(source)

            result = subprocess.run([
                sys.executable, str(ROOT / "tools" / "extract-atlas.py"),
                str(source), "andy", "--frame", "front_walk_01",
                "--output-dir", str(output),
            ], capture_output=True, text=True, check=False)

            self.assertEqual(result.returncode, 0, result.stderr)
            written = output / "front_walk_01.webp"
            self.assertTrue(written.exists())
            decoded = Image.open(written).convert("RGBA")
            self.assertEqual(decoded.size, (1280, 1920))
            self.assertEqual(decoded.getpixel((640, 90)), (30, 40, 50, 255))
            self.assertEqual(decoded.getpixel((0, 0))[3], 0)


if __name__ == "__main__":
    unittest.main()
