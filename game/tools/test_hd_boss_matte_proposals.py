import importlib.util
from pathlib import Path
import unittest
from PIL import Image, ImageDraw

SRC = Path(__file__).with_name("hd-boss-matte-proposals.py")
spec = importlib.util.spec_from_file_location("matte", SRC)
matte = importlib.util.module_from_spec(spec)
spec.loader.exec_module(matte)


class MatteTest(unittest.TestCase):
    def fixture(self, matte_color, interior_color):
        im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)
        draw.rectangle((8, 8, 24, 24), fill=(*interior_color, 255))
        draw.line((7, 8, 7, 24), fill=(*matte_color, 80))
        return im

    def test_bright_matte_recolors_only_rgb_and_marks_change(self):
        src = self.fixture((250, 250, 250), (45, 65, 80))
        dst, marks, count = matte.propose_matte_edge(src, "bright")
        self.assertGreater(count, 0)
        self.assertEqual(src.getchannel("A").tobytes(), dst.getchannel("A").tobytes())
        self.assertEqual(dst.getpixel((8, 16)), src.getpixel((8, 16)))
        self.assertLess(sum(dst.getpixel((7, 16))[:3]), sum(src.getpixel((7, 16))[:3]))
        self.assertEqual(marks.getpixel((7, 16))[3], 255)
        self.assertEqual(marks.getpixel((8, 16))[3], 0)

    def test_dark_matte_proposal(self):
        src = self.fixture((21, 20, 21), (195, 180, 160))
        dst, marks, count = matte.propose_matte_edge(src, "dark")
        self.assertGreater(count, 0)
        self.assertEqual(src.getchannel("A").tobytes(), dst.getchannel("A").tobytes())
        self.assertGreater(sum(dst.getpixel((7, 16))[:3]), sum(src.getpixel((7, 16))[:3]))

    def test_legitimate_pale_costume_is_preserved(self):
        src = self.fixture((250, 250, 250), (245, 230, 220))
        dst, marks, count = matte.propose_matte_edge(src, "bright")
        self.assertEqual(count, 0)
        self.assertEqual(src.tobytes(), dst.tobytes())

    def test_non_neutral_magic_effects_are_preserved(self):
        src = self.fixture((240, 30, 210), (50, 50, 50))
        dst, marks, count = matte.propose_matte_edge(src, "bright")
        self.assertEqual(count, 0)
        self.assertEqual(src.tobytes(), dst.tobytes())

    def test_reject_invalid_matte_profile(self):
        with self.assertRaisesRegex(ValueError, "Unsupported matte"):
            matte.propose_matte_edge(Image.new("RGBA", (16, 16)), "global")


if __name__ == "__main__":
    unittest.main()
