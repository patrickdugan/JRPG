"""Synthetic unit tests for conservatively scored HD boss art heuristics."""
import importlib.util
import unittest
import hashlib
from pathlib import Path
from PIL import Image, ImageDraw

SRC = Path(__file__).with_name("hd-boss-art-diagnostics.py")
spec = importlib.util.spec_from_file_location("hd_boss_art_diagnostics", SRC)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class ArtDiagnosticsTest(unittest.TestCase):
    def test_neutral_white_halo_near_dark_silhouette(self):
        im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)
        draw.rectangle((8, 8, 24, 24), fill=(55, 65, 70, 255))
        draw.line((7, 8, 7, 24), fill=(250, 250, 249, 110))
        result = mod.fringe_metrics(im)
        self.assertGreater(result["brightMatteSuspects"], 0)
        self.assertEqual(result["darkMatteSuspects"], 0)
        self.assertEqual(result["opaqueCornerFraction"], 0)
        self.assertFalse(any(result["touchesCellBoundary"].values()))

    def test_legitimate_white_edge_not_flagged(self):
        im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)
        draw.rectangle((8, 8, 24, 24), fill=(244, 240, 235, 255))
        draw.line((7, 8, 7, 24), fill=(247, 244, 242, 110))
        result = mod.fringe_metrics(im)
        self.assertEqual(result["brightMatteSuspects"], 0)
        self.assertEqual(result["darkMatteSuspects"], 0)

    def test_charcoal_halo_and_cropping(self):
        im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)
        draw.rectangle((1, 8, 24, 24), fill=(220, 175, 140, 255))
        draw.line((0, 8, 0, 24), fill=(21, 22, 22, 140))
        result = mod.fringe_metrics(im)
        self.assertGreater(result["darkMatteSuspects"], 0)
        self.assertFalse(result["touchesCellBoundary"]["left"])
        im.putpixel((0, 16), (21, 22, 22, 255))
        self.assertTrue(mod.fringe_metrics(im)["touchesCellBoundary"]["left"])

    def test_transparent_rgb_is_not_a_visible_delta(self):
        im = Image.new("RGBA", (32, 32), (255, 0, 255, 0))
        other = Image.new("RGBA", (32, 32), (0, 255, 0, 0))
        self.assertEqual(mod.visual_delta(im, other), 0)
        other.putpixel((16, 16), (255, 255, 255, 255))
        self.assertGreater(mod.visual_delta(im, other), 0)

    def test_motion_atlas_hashes_and_frame_continuity(self):
        atlas = Image.new("RGBA", (2304, 384), (0, 0, 0, 0))
        expected = []
        for i in range(24):
            frame = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
            ImageDraw.Draw(frame).rectangle((87 + i % 3, 140, 105 + i % 3, 182), fill=(90, 120, 160, 255))
            expected.append(hashlib.sha256(frame.tobytes()).hexdigest())
            atlas.paste(frame, ((i % 12) * 192, (i // 12) * 192))
        result = mod.analyze_clip(atlas, expected)
        self.assertEqual(result["sourceDerivedCells"], 24)
        self.assertGreater(result["maxAdjacentRGBDelta"], 0)
        self.assertEqual(result["maxAdjacentFootStepPx"], 0)
        self.assertGreaterEqual(result["loopSeamRGBDelta"], 0)
        expected[1] = "f" * 64
        with self.assertRaisesRegex(ValueError, "Decoded WebP frame hash mismatch"):
            mod.analyze_clip(atlas, expected)

if __name__ == "__main__":
    unittest.main()
