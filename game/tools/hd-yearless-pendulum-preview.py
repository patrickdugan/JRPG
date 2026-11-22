#!/usr/bin/env python3
"""Reversible Yearless Bell pendulum motion-study candidate.

Source illustration is untouched. A manually traced pivot mask allows
only the hanging bell to swing while the wooden support frame stays fixed.
The resulting 24-frame WebP is a review artifact, not a runtime replacement.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
BOSS = "yearless-bell"
CELL = 384
MOTION_CELL = 192
PIVOT = (192, 79)
DEGREES = 8.0
PERIOD_FRAMES = 24
# Conservative hand-reviewed silhouette path for *idle* key 1 only. It never
# affects other six-key poses or any source-art hash.
BELL_POLYGON = [
    (191, 78), (166, 90), (145, 110), (125, 131), (114, 153),
    (107, 240), (107, 291), (119, 321), (135, 326), (250, 326),
    (273, 314), (282, 286), (281, 215), (273, 162), (255, 130),
    (234, 112), (214, 96),
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def pendulum_angles():
    return [DEGREES * math.sin(2 * math.pi * i / PERIOD_FRAMES) for i in range(PERIOD_FRAMES)]


def mask_swingable_bell(pose: Image.Image):
    if pose.size != (CELL, CELL):
        raise ValueError("Yearless Bell swing only supports original 384px key cell")
    original = pose.convert("RGBA")
    mask = Image.new("L", (CELL, CELL), 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(BELL_POLYGON, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(2.0))
    source_alpha = original.getchannel("A")
    stationary_alpha = Image.frombytes("L", original.size, bytes(
        round(a * (1 - m / 255)) for a, m in zip(source_alpha.tobytes(), mask.tobytes())))
    moving_alpha = Image.frombytes("L", original.size, bytes(
        round(a * (m / 255)) for a, m in zip(source_alpha.tobytes(), mask.tobytes())))
    stationary = original.copy()
    stationary.putalpha(stationary_alpha)
    movable = original.copy()
    movable.putalpha(moving_alpha)
    # Beam and posts stay unchanged in all positions; decorative loose ribbons
    # outside the mask remain static. The bell is moved rigidly about the hinge.
    if stationary.getpixel((50, 36)) != original.getpixel((50, 36)):
        raise AssertionError("Stationary wooden beam was unexpectedly touched")
    return stationary, movable, mask


def swing_frames(pose: Image.Image):
    stationary, movable, mask = mask_swingable_bell(pose)
    frames = []
    for angle in pendulum_angles():
        rotated = movable.rotate(angle, resample=Image.Resampling.BICUBIC,
                                 center=PIVOT, expand=False, fillcolor=(0, 0, 0, 0))
        composited = Image.alpha_composite(stationary, rotated)
        frames.append(composited)
    if len(frames) != PERIOD_FRAMES:
        raise AssertionError("Expected exactly 24 pendulum frames")
    return frames, mask


def atlas_from_frames(frames: list[Image.Image]):
    if len(frames) != 24:
        raise ValueError("Wrong frame count")
    out = Image.new("RGBA", (12 * MOTION_CELL, 2 * MOTION_CELL), (0, 0, 0, 0))
    for i, source in enumerate(frames):
        image = source.resize((MOTION_CELL, MOTION_CELL), Image.Resampling.LANCZOS)
        out.paste(image, ((i % 12) * MOTION_CELL, (i // 12) * MOTION_CELL))
    return out


def draw_board(original: Image.Image, candidate: list[Image.Image], path: Path):
    samples = (0, 4, 8, 12, 16, 20, 23)
    gap, size = 10, 284
    width = len(samples) * (size + gap) + 32
    height = 2 * (size + 44) + 80
    board = Image.new("RGB", (width, height), (17, 22, 29))
    draw = ImageDraw.Draw(board)
    draw.text((17, 16), "YEARLESS BELL / ARTICULATED PENDULUM IDLE / NON-RUNTIME CANDIDATE",
              fill=(235, 210, 167))
    draw.text((17, 40), "CURRENT PAINTED KEY / SWING CANDIDATE - UNCHANGED WOOD FRAME",
              fill=(171, 167, 159))
    for row in range(2):
        for col, frame_index in enumerate(samples):
            source = original if row == 0 else candidate[frame_index]
            preview = Image.new("RGBA", (CELL, CELL), (58, 64, 74, 255))
            preview.alpha_composite(source)
            scaled = preview.convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
            x, y = 16 + col * (size + gap), 80 + row * (size + 44)
            board.paste(scaled, (x, y))
            draw.rectangle((x, y, x + size - 1, y + size - 1), outline=(112, 107, 95))
            title = "SOURCE POSE" if row == 0 else f"SWING {pendulum_angles()[frame_index]:+.1f}°"
            draw.text((x + 3, y + size + 5), f"F{frame_index+1:02d} {title}", fill=(232, 211, 184))
    board.save(path, optimize=True)


def load_audit():
    path = Path(__file__).with_name("hd-boss-motion-diversity.py")
    spec = importlib.util.spec_from_file_location("motion_diversity", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(root: Path, out: Path):
    root, out = root.resolve(), out.resolve()
    keys = json.loads((root / "game/assets/art/hd-painted-v1/manifest.json").read_text())
    motion = json.loads((root / "game/assets/art/hd-painted-v1/motion-manifest.json").read_text())
    roster = json.loads((root / "assets/art/roster-keystone/roster.json").read_text())
    intake = json.loads((root / f"assets/art/roster-keystone/{BOSS}-hd-intake.json").read_text())
    row = [r for r in roster["identities"] if r.get("id") == BOSS and r.get("kind") == "named-boss"]
    if len(row) != 1 or row[0]["visualApproval"] != "pending":
        raise ValueError("Yearless Bell art approval gate changed")
    art = keys["actors"][BOSS]
    clip = motion["actors"][BOSS]["clipSet"]["idle"]
    if clip["sourcePose"] != 0 or intake["sixKeyAtlasSha256"] != art["sha256"] \
            or motion["actors"][BOSS]["sourceSheetSha256"] != art["sha256"]:
        raise ValueError("Yearless Bell source key identity mismatch")
    source = root / "game/assets/art/hd-painted-v1" / art["file"]
    old_motion = root / "game/assets/art/hd-painted-v1" / clip["path"]
    if sha256(source.read_bytes()) != art["sha256"] or sha256(old_motion.read_bytes()) != clip["sha256"]:
        raise ValueError("Original painted and motion SHA-256 identities do not match")
    with Image.open(source) as im:
        original = im.convert("RGBA").crop((0, 0, CELL, CELL))
    with Image.open(old_motion) as im:
        original_motion = im.convert("RGBA")
    frames, mask = swing_frames(original)
    atlas = atlas_from_frames(frames)
    out.mkdir(parents=True, exist_ok=True)
    outfile = out / "yearless-bell-idle-swing-candidate.webp"
    atlas.save(outfile, format="WEBP", lossless=True, method=6)
    draw_board(original, frames, out / "yearless-bell-idle-swing-timeline.png")
    mask.save(out / "yearless-bell-manual-pivot-mask.png")
    audit = load_audit()
    with Image.open(outfile) as im:
        decoded = im.convert("RGBA")
    new_hashes = [sha256(f.tobytes()) for f in audit.frames_from_atlas(
        decoded, [sha256(decoded.crop(((i % 12) * MOTION_CELL, (i // 12) * MOTION_CELL,
                                      ((i % 12) + 1) * MOTION_CELL, ((i // 12) + 1) * MOTION_CELL))
                             .convert("RGBA").tobytes()) for i in range(24)])]
    old_frames = audit.frames_from_atlas(original_motion, clip["frameRGBAsha256"])
    new_frames = audit.frames_from_atlas(decoded, new_hashes)
    old_metrics = audit.analyze_motion(old_frames)
    new_metrics = audit.analyze_motion(new_frames)
    if len(set(new_hashes)) != 24:
        raise ValueError("Pendulum candidate repeated a decoded frame")
    if new_metrics["maxForegroundDifferenceFromFirst"] <= old_metrics["maxForegroundDifferenceFromFirst"] + 2:
        raise ValueError("New motion failed to improve visible idle movement")
    result = {
        "schema": "jrpg-yearless-idle-pendulum-candidate/1",
        "bossId": BOSS, "clip": "idle", "frames": 24,
        "sourceSixKeyAtlasSha256": art["sha256"],
        "originalMotionSha256": clip["sha256"],
        "candidateMotionSha256": sha256(outfile.read_bytes()),
        "candidateDecodedFrameRGBAsha256": new_hashes,
        "sourcePoseIndex": 0,
        "footAnchor": clip["foot"], "frameMs": clip["frameMs"],
        "pivot": PIVOT, "degreesAmplitude": DEGREES,
        "pendulumAnglesDeg": [round(v, 4) for v in pendulum_angles()],
        "oldPerceptualMetrics": old_metrics, "candidatePerceptualMetrics": new_metrics,
        "reviewStatus": "manual-human-art-approval-pending",
        "productionAuthority": "review-only downloadable WebP; no runtime manifest write",
    }
    (out / "yearless-bell-pendulum-receipt.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"oldMaxForegroundDifference": old_metrics["maxForegroundDifferenceFromFirst"],
                      "newMaxForegroundDifference": new_metrics["maxForegroundDifferenceFromFirst"],
                      "candidateSha256": result["candidateMotionSha256"],
                      "frameSha256s": len(new_hashes),
                      "gameplayAssetsModified": False}, indent=2))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts/yearless-pendulum")
    args = parser.parse_args()
    run(args.root, args.output_dir)


if __name__ == "__main__":
    main()
