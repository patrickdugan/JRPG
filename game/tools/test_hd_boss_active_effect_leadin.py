"""Smoke tests for original-attack effect-only windup anticipation."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

from PIL import Image

PATH = Path(__file__).with_name("hd-boss-active-effect-leadin.py")
spec = importlib.util.spec_from_file_location("effect_leadin", PATH)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


class EffectLeadInTests(unittest.TestCase):
    def test_yearless_purple_arc_selected_only_outside_bell(self):
        release = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
        release.putpixel((18, 100), (170, 75, 225, 220))
        release.putpixel((24, 110), (170, 75, 225, 220))
        windup = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
        windup.putpixel((24, 110), (100, 80, 45, 255))
        effect = tool.effect_mask(release, windup, "yearless-bell")
        self.assertEqual(effect.getpixel((18, 100))[3], 220)
        self.assertEqual(effect.getpixel((24, 110))[3], 0)

    def test_enma_bright_cinder_selected_excluding_face(self):
        release = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
        release.putpixel((18, 75), (229, 145, 55, 255))
        release.putpixel((115, 34), (229, 145, 55, 255))
        windup = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
        windup.putpixel((115, 34), (200, 160, 125, 255))
        effect = tool.effect_mask(release, windup, "lady-enma")
        self.assertEqual(effect.getpixel((18, 75))[3], 255)
        self.assertEqual(effect.getpixel((115, 34))[3], 0)

    def test_early_windup_and_opaque_figure_remain_unchanged(self):
        source = [Image.new("RGBA", (192, 192), (0, 0, 0, 0)) for _ in range(24)]
        for frame in source:
            frame.putpixel((20, 80), (150, 90, 75, 255))
        effect = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
        effect.putpixel((28, 82), (235, 175, 75, 225))
        effect.putpixel((20, 80), (235, 175, 75, 225))
        proposed = tool.compose_windup(source, effect)
        self.assertEqual(len(proposed), 24)
        for i in range(16):
            self.assertEqual(source[i].tobytes(), proposed[i].tobytes())
        self.assertEqual(proposed[-1].getpixel((20, 80)), source[-1].getpixel((20, 80)))
        self.assertGreater(proposed[-1].getpixel((28, 82))[3],
                           proposed[-2].getpixel((28, 82))[3])
        self.assertGreater(proposed[-2].getpixel((28, 82))[3], 0)

    def test_invalid_source_profile_and_geometry_fail_closed(self):
        source = Image.new("RGBA", (192, 192))
        with self.assertRaisesRegex(ValueError, "Unknown boss"):
            tool.effect_mask(source, source, "unknown")
        with self.assertRaisesRegex(ValueError, "192px"):
            tool.effect_mask(source, Image.new("RGBA", (384, 384)), "lady-enma")
        with self.assertRaisesRegex(ValueError, "24 windup"):
            tool.compose_windup([source] * 23, source)

    def test_webp_atlas_contract(self):
        frames = [Image.new("RGBA", (192, 192), (i*10, i*3, i, 255)) for i in range(24)]
        atlas = tool.pack(frames)
        self.assertEqual(atlas.size, (2304, 384))
        self.assertEqual(atlas.crop((0, 0, 192, 192)).getpixel((0, 0)), frames[0].getpixel((0, 0)))
        self.assertEqual(atlas.crop((2112, 192, 2304, 384)).getpixel((0, 0)),
                         frames[-1].getpixel((0, 0)))


if __name__ == "__main__":
    unittest.main()
