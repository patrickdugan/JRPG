"""Synthetic tests of perceptual boss-motion screening, without actual art assets."""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

SRC = Path(__file__).resolve().parents[1] / "audit-hd-boss-motion.py"
SPEC = importlib.util.spec_from_file_location("hd_boss_motion_qc", SRC)
QC = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(QC)


def body_frame(dx=0, dy=0, *, flicker=0, alpha=255):
    frame = Image.new("RGBA", (192, 192))
    painter = ImageDraw.Draw(frame)
    # Large opaque painted body and an asymmetric weapon arm.
    painter.polygon([
        (40+dx, 30+dy), (135+dx, 30+dy),
        (150+dx, 150+dy), (30+dx, 150+dy),
    ], fill=(110+flicker, 80, 55, alpha))
    painter.ellipse((112+dx, 25+dy, 175+dx, 73+dy),
                    fill=(205, 130, 70, alpha))
    return frame


class MotionScreenTests(unittest.TestCase):
    def test_pixel_unique_static_frame_variants_are_held(self):
        frames = [body_frame(flicker=i) for i in range(24)]
        output = QC.frame_metrics(frames, clip="active")
        self.assertEqual(output["visual_motion_screen"], "hold_static_motion")
        self.assertEqual(output["perceptual_pose_count"], 1)
        self.assertEqual(output["max_frame0_silhouette_disagreement"], 0)
        self.assertFalse(output["screening_checks"]["silhouette_variation"])

    def test_obvious_animated_body_travel_passes(self):
        # Five distinct large physical body displacements, with repeated frames
        # between movement keys to simulate held animation cels.
        frames = [body_frame(dx=[-35, -18, 0, 18, 35][i // 5]
                             if i < 20 else -35) for i in range(24)]
        output = QC.frame_metrics(frames, clip="active")
        self.assertEqual(output["visual_motion_screen"], "candidate_for_manual_review")
        self.assertGreaterEqual(output["perceptual_pose_count"], 3)

    def test_glow_flicker_without_pose_change_does_not_count(self):
        frames = [body_frame(flicker=(i * 7) % 100) for i in range(24)]
        result = QC.frame_metrics(frames, clip="windup")
        self.assertEqual(result["visual_motion_screen"], "hold_static_motion")

    def test_undersized_or_empty_strip_fails(self):
        with self.assertRaisesRegex(ValueError, "exactly 24"):
            QC.frame_metrics([body_frame()] * 23, clip="active")
        with self.assertRaisesRegex(ValueError, "expected 2304 x 384"):
            QC.split_strip(Image.new("RGBA", (192, 192)))
        with self.assertRaisesRegex(ValueError, "empty character frame"):
            QC.frame_metrics([Image.new("RGBA", (192, 192))] * 24, clip="active")

    def test_report_from_tiny_motion_manifest(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = root / "motion" / "test-boss"
            path.mkdir(parents=True)
            strip = Image.new("RGBA", (2304, 384))
            for i in range(24):
                sprite = body_frame(flicker=i)
                strip.alpha_composite(sprite, (192*(i % 12), 192*(i // 12)))
            strip.save(path / "idle.webp", lossless=True)
            (root / "motion-manifest.json").write_text(json.dumps({
                "actors": {"test-boss": {"clipSet": {
                    "idle": {"frames": 24, "path": "motion/test-boss/idle.webp"}
                }}}
            }), encoding="utf-8")
            report = QC.audit(root, ("test-boss",))
            self.assertEqual(report["hold_clips"]["test-boss"], ["idle"])
            self.assertFalse(report["passes_all_screening_gates"])
            self.assertEqual(report["visual_approval"], "pending_manual_review")


if __name__ == "__main__":
    unittest.main()
