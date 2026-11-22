#!/usr/bin/env python3
"""Measure meaningful visual motion in JRPG's 24-cell boss animation strips.

This is an art-review diagnostic, separate from exact ZIP and per-frame hash
integrity. File hashes, tiny pixel changes, alpha noise or a different source
pose across clips cannot establish articulated motion *within* each clip.

Usage:
  python game/tools/audit-hd-boss-motion.py --out /tmp/boss-motion-qc.json
  python game/tools/audit-hd-boss-motion.py --strict

Default exits 0 and reports visual-review holds. --strict exits 1 when any
required motion clip fails the declared heuristic, for use *after* art revision.
"""
from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[2]
BOSSES = ("captain-kaji", "widow-of-fog", "furnace-abbot", "ujiro")
MOTION_ROOT = ROOT / "game/assets/art/hd-painted-v1"
CELL = 192
COLUMNS = 12
ROWS = 2
FRAMES = 24
SAMPLE = 64
# A stroke, glow fluctuation or alpha matte jitter by itself is not a character
# animation. These are screening thresholds, not a substitute for review of the
# actual poses at native battle-camera scale.
ACTIVE = frozenset(("locomotion", "windup", "active", "recovery",
                    "hurt", "defeat", "signature", "stagger"))
PASSIVE = frozenset(("idle", "guard"))
MOTION_GATES = {
    "active": {
        "minimum_perceptual_poses": 3,
        "minimum_silhouette_change": 0.10,
        "minimum_bbox_shift_px": 4,
        "minimum_rgb_difference": 0.055,
    },
    "passive": {
        "minimum_perceptual_poses": 2,
        "minimum_silhouette_change": 0.022,
        "minimum_bbox_shift_px": 1.5,
        "minimum_rgb_difference": 0.018,
    },
}


def _mean_rgb_delta(a: Image.Image, b: Image.Image) -> float:
    """Average absolute RGB change, normalized to 0..1, over the frame area."""
    diff = ImageChops.difference(a, b)
    return sum(ImageStat.Stat(diff).mean[:3]) / (3 * 255)


def _mask(a: Image.Image):
    return a.getchannel("A").resize((SAMPLE, SAMPLE), Image.Resampling.BILINEAR).point(
        lambda alpha: 255 if alpha >= 64 else 0
    )


def _silhouette_difference(a: Image.Image, b: Image.Image) -> float:
    """1 minus foreground intersection-over-union, computed from alpha masks."""
    intersection = ImageStat.Stat(ImageChops.darker(a, b)).sum[0]
    union = ImageStat.Stat(ImageChops.lighter(a, b)).sum[0]
    return 1 - intersection / union if union else 0.0


def _canvas(frame: Image.Image):
    rgba = frame.convert("RGBA")
    solid = Image.new("RGBA", rgba.size, (40, 42, 48, 255))
    solid.alpha_composite(rgba)
    return solid.convert("RGB").resize((SAMPLE, SAMPLE), Image.Resampling.BILINEAR)


def frame_metrics(frames: list[Image.Image], *, clip: str) -> dict:
    if len(frames) != FRAMES:
        raise ValueError(f"expected exactly {FRAMES} frames")
    kind = "passive" if clip in PASSIVE else "active"
    if clip not in ACTIVE | PASSIVE:
        raise ValueError(f"unknown clip type: {clip}")
    masks = [_mask(f) for f in frames]
    images = [_canvas(f) for f in frames]
    boxes = [f.convert("RGBA").getchannel("A").point(
        lambda alpha: 255 if alpha >= 64 else 0
    ).getbbox() for f in frames]
    if any(box is None for box in boxes):
        raise ValueError("empty character frame in motion atlas")
    centers = [((x0 + x1) / 2, (y0 + y1) / 2)
               for x0, y0, x1, y1 in boxes]

    # Represent the sequence with visually separate canonical key poses.
    # A tiny RGB perturbation may change the decoded hash yet remain in the
    # same perceptual pose cluster. Require BOTH silhouette and RGB changes.
    keys = [0]
    for i in range(1, FRAMES):
        if all(_silhouette_difference(masks[i], masks[j]) >= 0.08
               and _mean_rgb_delta(images[i], images[j]) >= 0.025 for j in keys):
            keys.append(i)

    rgb = [_mean_rgb_delta(images[0], images[i]) for i in range(1, FRAMES)]
    sil = [_silhouette_difference(masks[0], masks[i]) for i in range(1, FRAMES)]
    neighbor = [_mean_rgb_delta(images[i - 1], images[i]) for i in range(1, FRAMES)]
    dx = max(c[0] for c in centers) - min(c[0] for c in centers)
    dy = max(c[1] for c in centers) - min(c[1] for c in centers)
    bbox_motion = (dx**2 + dy**2) ** 0.5
    gates = MOTION_GATES[kind]
    checks = {
        "perceptual_pose_count": len(keys) >= gates["minimum_perceptual_poses"],
        "silhouette_variation": max(sil) >= gates["minimum_silhouette_change"],
        "bbox_or_silhouette_travel": (
            bbox_motion >= gates["minimum_bbox_shift_px"]
            or max(sil) >= gates["minimum_silhouette_change"] * 2
        ),
        "painted_image_variation": max(rgb) >= gates["minimum_rgb_difference"],
    }
    return {
        "clip": clip, "kind": kind, "frames": len(frames),
        "key_pose_frames": keys, "perceptual_pose_count": len(keys),
        "max_frame0_rgb_delta": round(max(rgb), 5),
        "max_frame0_silhouette_disagreement": round(max(sil), 5),
        "median_adjacent_rgb_delta": round(statistics.median(neighbor), 5),
        "max_alpha_bbox_centroid_travel_px": round(bbox_motion, 3),
        "screening_checks": checks, "visual_motion_screen": (
            "candidate_for_manual_review" if all(checks.values()) else "hold_static_motion"
        ),
        "gates": gates,
    }


def split_strip(image: Image.Image) -> list[Image.Image]:
    if image.size != (COLUMNS * CELL, ROWS * CELL):
        raise ValueError(f"expected {COLUMNS * CELL} x {ROWS * CELL}, got {image.size}")
    image = image.convert("RGBA")
    return [image.crop(((i % COLUMNS) * CELL, (i // COLUMNS) * CELL,
                        (i % COLUMNS + 1) * CELL, (i // COLUMNS + 1) * CELL))
            for i in range(FRAMES)]


def audit(root: Path = MOTION_ROOT, bosses: tuple[str, ...] = BOSSES) -> dict:
    manifest = json.loads((root / "motion-manifest.json").read_text(encoding="utf-8"))
    report = {}
    for boss in bosses:
        actor = manifest["actors"][boss]
        clips = {}
        for clip, info in sorted(actor["clipSet"].items()):
            if info["frames"] != FRAMES:
                raise ValueError(f"unexpected frame count: {boss}/{clip}")
            path = root / info["path"]
            with Image.open(path) as image:
                clips[clip] = frame_metrics(split_strip(image), clip=clip)
        report[boss] = {
            "clips": clips,
            "hold_clips": [name for name, stats in clips.items()
                           if stats["visual_motion_screen"] == "hold_static_motion"],
        }
    holds = {boss: row["hold_clips"] for boss, row in report.items()}
    return {
        "schema": "jrpg.hd_boss_motion_visual_screen.v1",
        "evidence": "decoded WebP frame differences, not independent visual approval",
        "goal": "detect visually static animation strips despite distinct pixel hashes",
        "screening_thresholds": MOTION_GATES,
        "bosses": report,
        "hold_clips": holds,
        "visual_approval": "pending_manual_review",
        "passes_all_screening_gates": all(not items for items in holds.values()),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=MOTION_ROOT)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--bosses", nargs="*", default=list(BOSSES))
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args(argv)
    result = audit(root=args.root, bosses=tuple(args.bosses))
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    for name, row in result["bosses"].items():
        print(f"{name}: {len(row['hold_clips'])}/10 clips flagged for visibly static motion "
              f"({', '.join(row['hold_clips']) or 'none'})")
    print("Visual approval:", result["visual_approval"])
    if args.strict and not result["passes_all_screening_gates"]:
        parser.exit(1, "Motion-quality hold: review and reanimate flagged strips.\n")


if __name__ == "__main__":
    main()
