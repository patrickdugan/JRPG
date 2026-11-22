"""Furnace Abbot alpha-haze proposal tests with visible/far-field controls."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

PATH = Path(__file__).with_name("hd-furnace-alpha-haze.py")
spec = importlib.util.spec_from_file_location("furnace_alpha", PATH)
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)


class FurnaceAlphaTest(unittest.TestCase):
    def make_tile(self):
        tile = Image.new("RGBA", (384, 384), (11, 27, 37, 0))
        draw = ImageDraw.Draw(tile)
        draw.rectangle((64, 80, 140, 200), fill=(100, 80, 64, 255))
        tile.putpixel((60, 90), (150, 130, 110, 8))
        tile.putpixel((350, 350), (120, 120, 120, 8))
        tile.putpixel((320, 320), (210, 190, 170, 80))
        tile.putpixel((340, 340), (210, 200, 180, 190))
        return tile

    def test_far_weak_haze_removed_near_antialias_and_smoke_preserved(self):
        before = self.make_tile()
        after, marks, receipt = repair.clean_cell(before)
        self.assertEqual(receipt["clearedPixels"], 1)
        self.assertEqual(after.getpixel((350, 350))[3], 0)
        self.assertEqual(marks.getpixel((350, 350)), (255, 85, 101, 255))
        self.assertEqual(after.getpixel((60, 90))[3], 8)
        self.assertEqual(after.getpixel((320, 320))[3], 80)
        self.assertEqual(after.getpixel((340, 340))[3], 190)
        self.assertEqual(after.getpixel((100, 100))[3], 255)
        self.assertEqual(before.convert("RGB").tobytes(), after.convert("RGB").tobytes())

    def test_opaque_white_costume_and_purple_fx_untouched(self):
        before = self.make_tile()
        before.putpixel((250, 250), (254, 254, 254, 255))
        before.putpixel((25, 25), (180, 30, 235, 230))
        after, _, _ = repair.clean_cell(before)
        self.assertEqual(after.getpixel((250, 250)), before.getpixel((250, 250)))
        self.assertEqual(after.getpixel((25, 25)), before.getpixel((25, 25)))

    def test_guard_catches_diagonal_opaque_neighbors(self):
        tile = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
        tile.putpixel((100, 100), (31, 42, 53, 255))
        tile.putpixel((108, 108), (110, 110, 110, 8))
        tile.putpixel((109, 109), (110, 110, 110, 8))
        candidate, _, metrics = repair.clean_cell(tile)
        self.assertEqual(metrics["clearedPixels"], 1)
        self.assertEqual(candidate.getpixel((108, 108))[3], 8)
        self.assertEqual(candidate.getpixel((109, 109))[3], 0)

    def test_budget_refuses_to_nuke_a_faint_intentional_plane(self):
        tile = Image.new("RGBA", (384, 384), (33, 44, 55, 10))
        with self.assertRaisesRegex(ValueError, "change budget"):
            repair.clean_cell(tile)

    def test_six_key_cells_do_not_interfere_at_an_atlas_boundary(self):
        a = self.make_tile()
        b = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
        b.putpixel((0, 70), (12, 19, 30, 255))
        a.putpixel((383, 70), (128, 111, 90, 8))
        fixed, _, _ = repair.clean_cell(a)
        self.assertEqual(fixed.getpixel((383, 70))[3], 0)


if __name__ == "__main__":
    unittest.main()
