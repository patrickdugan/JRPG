"""Perceptual motion audit distinguishes hash differences from visible motion."""
import hashlib
import importlib.util
from pathlib import Path
import unittest

from PIL import Image, ImageDraw

SRC = Path(__file__).with_name("hd-boss-motion-diversity.py")
spec = importlib.util.spec_from_file_location("motion_audit", SRC)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def frame(index=0, dx=0, arm=False):
    # Different invisible RGB data generate different RGBA hashes.
    im = Image.new("RGBA", (192, 192), ((index * 11) % 255, 20, 100, 0))
    draw = ImageDraw.Draw(im)
    draw.rectangle((75 + dx, 80, 117 + dx, 166), fill=(140, 100, 70, 255))
    if arm:
        draw.line((113 + dx, 100, 147 + dx, 65 + index), fill=(225, 195, 170, 255), width=9)
    return im


class MotionDiversityTest(unittest.TestCase):
    def test_unique_rgba_hashes_can_contain_identical_visible_frames(self):
        frames = [frame(i) for i in range(24)]
        self.assertEqual(len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames}), 24)
        metrics = audit.analyze_motion(frames)
        self.assertEqual(metrics["maxVisibleDifferenceFromFirst"], 0)
        self.assertEqual(metrics["maxForegroundDifferenceFromFirst"], 0)
        self.assertEqual(metrics["framesDifferentFromFirstAt2"], 0)
        self.assertTrue(metrics["nearStaticReviewCandidate"])
        self.assertFalse(metrics["rigidShiftReviewCandidate"])

    def test_visible_animated_arm_increases_measured_motion(self):
        frames = [frame(i, arm=True) for i in range(24)]
        metrics = audit.analyze_motion(frames)
        self.assertGreater(metrics["maxForegroundDifferenceFromFirst"], 4)
        self.assertGreater(metrics["maxVisibleDifferenceFromFirst"], 1.0)
        self.assertFalse(metrics["nearStaticReviewCandidate"])
        self.assertGreater(metrics["maxAdjacentGrayscaleMAE"], 0)

    def test_shift_alignment_can_detect_substantial_rigid_motion(self):
        a = audit.perceptual_frame(frame(0, dx=0))
        b = audit.perceptual_frame(frame(0, dx=8))
        raw, aligned, shift = audit.compare_aligned(a, b)
        self.assertGreater(raw, aligned)
        self.assertNotEqual(shift, (0, 0))
        self.assertGreater(1 - aligned / raw, .3)

    def test_rejects_wrong_cell_shapes_and_decoded_hashes(self):
        frames = [frame(0)] * 23
        with self.assertRaisesRegex(ValueError, "24 source-derived"):
            audit.analyze_motion(frames)
        atlas = Image.new("RGBA", (2304, 384), (0, 0, 0, 0))
        frames = [frame(i, dx=i % 3) for i in range(24)]
        hashes = []
        for i, cell in enumerate(frames):
            atlas.paste(cell, ((i % 12) * 192, (i // 12) * 192))
            hashes.append(hashlib.sha256(cell.tobytes()).hexdigest())
        recovered = audit.frames_from_atlas(atlas, hashes)
        self.assertEqual(len(recovered), 24)
        hashes[7] = "f" * 64
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            audit.frames_from_atlas(atlas, hashes)


if __name__ == "__main__":
    unittest.main()
