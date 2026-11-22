"""Synthetic checks for the two non-runtime articulated windup candidates."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

FILE = Path(__file__).with_name("hd-boss-windup-articulation.py")
spec = importlib.util.spec_from_file_location("windup", FILE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def example(boss):
    image = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    pen = ImageDraw.Draw(image)
    if boss == "yearless-bell":
        pen.rectangle((30, 22, 350, 57), fill=(108, 83, 63, 255))
        pen.rectangle((40, 58, 58, 370), fill=(104, 79, 57, 255))
        pen.rectangle((320, 58, 340, 370), fill=(104, 79, 57, 255))
        pen.ellipse((115, 124, 277, 318), fill=(145, 110, 74, 255))
        pen.ellipse((151, 214, 244, 263), fill=(124, 82, 180, 255))
    else:
        pen.ellipse((182, 46, 235, 96), fill=(205, 160, 126, 255))
        pen.polygon(((145, 127), (235, 133), (275, 357), (79, 357)), fill=(105, 37, 30, 255))
        pen.ellipse((49, 12, 156, 103), fill=(194, 59, 25, 255))
        pen.line((82, 97, 153, 145), fill=(200, 141, 108, 255), width=11)
    return image


class WindupArticulationTests(unittest.TestCase):
    def test_yearless_beam_and_fixed_pillars_stay_unchanged(self):
        source = example("yearless-bell")
        images, mask = mod.make_frames(source, mod.PROFILES["yearless-bell"])
        self.assertEqual(len(images), 24)
        self.assertEqual(images[0].tobytes(), source.tobytes())
        self.assertEqual(mask.size, (384, 384))
        for image in images:
            self.assertEqual(image.getpixel((50, 36)), source.getpixel((50, 36)))
            self.assertEqual(image.getpixel((320, 36)), source.getpixel((320, 36)))
        self.assertGreater(len({mod.digest(f.tobytes()) for f in images}), 20)

    def test_enma_face_and_foot_stay_fixed_during_charge(self):
        source = example("lady-enma")
        images, mask = mod.make_frames(source, mod.PROFILES["lady-enma"])
        self.assertEqual(images[0].tobytes(), source.tobytes())
        for frame in images:
            self.assertEqual(frame.getpixel((208, 73)), source.getpixel((208, 73)))
            self.assertEqual(frame.getpixel((194, 352)), source.getpixel((194, 352)))
        self.assertGreater(len({mod.digest(f.tobytes()) for f in images}), 20)
        self.assertLessEqual(mod.PROFILES["lady-enma"]["flameBrightnessGain"], 1.0)

    def test_24_cell_webp_geometry_decodes_losslessly(self):
        frames, _ = mod.make_frames(example("yearless-bell"), mod.PROFILES["yearless-bell"])
        atlas = mod.pack_webp(frames)
        self.assertEqual(atlas.size, (2304, 384))
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "candidate.webp"
            atlas.save(output, "WEBP", lossless=True, method=6)
            with Image.open(output) as image:
                self.assertEqual(image.size, (2304, 384))
                rendered = image.convert("RGBA")
            hashes = []
            for i in range(24):
                x, y = i % 12 * 192, i // 12 * 192
                hashes.append(mod.digest(rendered.crop((x, y, x + 192, y + 192)).tobytes()))
            self.assertGreaterEqual(len(set(hashes)), 18)

    def test_invalid_geometry_and_incomplete_clip_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "384x384"):
            mod.separate_layer(Image.new("RGBA", (192, 192)), mod.PROFILES["lady-enma"])
        with self.assertRaisesRegex(ValueError, "24 frames"):
            mod.pack_webp([example("lady-enma")] * 23)

    def test_smoothstep_is_monotonic_for_one_shot_windup(self):
        values = [mod.smoothstep(i / 23) for i in range(24)]
        self.assertEqual(values[0], 0)
        self.assertEqual(values[-1], 1)
        self.assertTrue(all(values[i] < values[i+1] for i in range(23)))


if __name__ == "__main__":
    unittest.main()
