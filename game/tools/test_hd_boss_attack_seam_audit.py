"""Synthetic controls for phase-boundary optical diagnostics."""
from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

PATH = Path(__file__).with_name("hd-boss-attack-seam-audit.py")
spec = importlib.util.spec_from_file_location("boss_seam", PATH)
seam = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seam)
audit = seam.import_tool("motion_metrics_tests", PATH.with_name("hd-boss-motion-diversity.py"))


def frame(dx=0, fill=(150, 88, 54, 255)):
    img = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
    painter = ImageDraw.Draw(img)
    painter.ellipse((70 + dx, 46, 116 + dx, 145), fill=fill)
    return img


class PhaseJoinTests(unittest.TestCase):
    def test_identical_frames_have_perfect_seam_and_overlap(self):
        a = frame()
        stats = seam.join_metrics(a, a.copy(), audit)
        self.assertEqual(stats["grayscaleMAE48Full"], 0)
        self.assertEqual(stats["grayscaleMAE48ForegroundUnion"], 0)
        self.assertEqual(stats["silhouetteAlphaIoU"], 1)
        self.assertEqual(stats["silhouetteCentroidShiftPx"], 0)

    def test_displaced_attack_pose_is_detected(self):
        a, b = frame(0), frame(21)
        stats = seam.join_metrics(a, b, audit)
        self.assertGreater(stats["grayscaleMAE48ForegroundUnion"], 0)
        self.assertLess(stats["silhouetteAlphaIoU"], 1)
        self.assertGreater(stats["silhouetteCentroidShiftPx"], 10)

    def test_invisible_rgb_differences_do_not_count_as_seam(self):
        a = Image.new("RGBA", (192, 192), (255, 20, 90, 0))
        b = Image.new("RGBA", (192, 192), (0, 140, 215, 0))
        stats = seam.join_metrics(a, b, audit)
        self.assertEqual(stats["grayscaleMAE48Full"], 0)
        self.assertEqual(stats["grayscaleMAE48ForegroundUnion"], 0)
        self.assertEqual(stats["silhouetteAlphaIoU"], 1)
        self.assertIsNone(stats["silhouetteCentroidShiftPx"])

    def test_reject_wrong_size(self):
        with self.assertRaisesRegex(ValueError, "192x192"):
            seam.join_metrics(frame(), Image.new("RGBA", (384, 384)), audit)

    def test_review_board_and_actual_cutover_gif_are_rendered(self):
        original = [frame(i % 4) for i in range(24)]
        proposed = [frame(i // 3) for i in range(24)]
        active = [frame(20 - i) for i in range(24)]
        with tempfile.TemporaryDirectory() as folder:
            board = Path(folder) / "seam.png"
            gif = Path(folder) / "seam.gif"
            seam.seam_board(original, proposed, active, "Synthetic", board)
            seam.seam_gif(original, proposed, active, "Synthetic", gif, 43, 34)
            with Image.open(board) as image:
                self.assertGreater(image.width, 1800)
                self.assertGreater(image.height, 500)
            with Image.open(gif) as image:
                self.assertEqual(image.size, (564, 325))
                self.assertGreaterEqual(image.n_frames, 12)


if __name__ == "__main__":
    unittest.main()
