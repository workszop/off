import importlib.util
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("extract_atlas", ROOT / "tools" / "extract-atlas.py")
EXTRACT = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(EXTRACT)


class ExtractAtlasTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
