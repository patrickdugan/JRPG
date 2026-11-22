"""Yearless Bell painted-key pendulum motion smoke tests."""
from __future__ import annotations
import importlib.util
from pathlib import Path
import math
import tempfile
import unittest

from PIL import Image, ImageChops, ImageDraw

SRC = Path(__file__).with_name("hd-yearless-pendulum-preview.py")
spec = importlib.util.spec_from_file_location("bell_pendulum", SRC)
bell = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bell)


class YearlessBellPendulumTest(unittest.TestCase):
    def source(self):
        canvas = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((20, 24, 360, 52), fill=(110, 70, 42, 255))
        draw.ellipse((122, 115, 266, 319), fill=(85, 91, 100, 255))
        return canvas

    def test_asymmetric_swing_is_smooth_periodic_and_has_24_distinct_positions(self):
        angles = bell.pendulum_angles()
        self.assertEqual(len(angles), 24)
        self.assertEqual(len({round(v, 6) for v in angles}), 24)
        self.assertLess(max(abs(a) for a in angles), 9)
        jumps = [abs(angles[(i + 1) % 24] - angles[i]) for i in range(24)]
        self.assertLess(max(jumps), 3)

    def test_static_wooden_beam_is_preserved(self):
        original = self.source()
        frames, _ = bell.swing_frames(original)
        self.assertEqual(len(frames), 24)
        for image in frames:
            self.assertEqual(image.size, (384, 384))
            self.assertEqual(image.getpixel((50, 36)), original.getpixel((50, 36)))
            self.assertEqual(image.getpixel((320, 36)), original.getpixel((320, 36)))
        self.assertIsNotNone(ImageChops.difference(frames[0], frames[6]).getbbox())

    def test_atlas_and_lossless_webp_are_24_unique_decoded_frames(self):
        source = self.source()
        frames, _ = bell.swing_frames(source)
        atlas = bell.atlas_from_frames(frames)
        self.assertEqual(atlas.size, (2304, 384))
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "candidate.webp"
            atlas.save(path, format="WEBP", lossless=True, method=6)
            with Image.open(path) as image:
                self.assertEqual(image.size, (2304, 384))
                rgba = image.convert("RGBA")
            hashes = [
                bell.sha256(rgba.crop(((i % 12) * 192, (i // 12) * 192,
                                     ((i % 12) + 1) * 192, ((i // 12) + 1) * 192)).tobytes())
                for i in range(24)
            ]
            self.assertEqual(len(set(hashes)), 24)

    def test_geometry_checks_reject_other_source_sizes(self):
        with self.assertRaisesRegex(ValueError, "384px"):
            bell.swing_frames(Image.new("RGBA", (192, 192)))
        with self.assertRaisesRegex(ValueError, "frame count"):
            bell.atlas_from_frames([self.source()] * 23)


if __name__ == "__main__":
    unittest.main()
