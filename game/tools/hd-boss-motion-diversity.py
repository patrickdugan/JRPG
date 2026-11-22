#!/usr/bin/env python3
"""Perceptual HD boss motion audit: hash-distinct cells can remain visually static.

Measures visible motion over composited pixels and reports how much variation
can be explained by rigid 2D translation. Metrics are review hints, never
automatic evidence of articulation or manual approval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
IDS = (
    "captain-kaji", "widow-of-fog", "furnace-abbot", "ujiro",
    "bell-warden-chiyo", "lady-enma", "yearless-bell",
)
CLIPS = (
    "idle", "locomotion", "windup", "active", "recovery",
    "guard", "hurt", "defeat", "signature", "stagger",
)
SAMPLES = (0, 4, 8, 12, 16, 20, 23)
CELL = 192
DOWNSAMPLE = 48
COLOR_BG = (79, 84, 92)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def frames_from_atlas(atlas: Image.Image, hashes: list[str]) -> list[Image.Image]:
    if atlas.size != (2304, 384) or len(hashes) != 24:
        raise ValueError("Clip expected 12x2 192px grid with 24 frame hashes")
    frames = []
    for i in range(24):
        x, y = (i % 12) * CELL, (i // 12) * CELL
        cell = atlas.crop((x, y, x + CELL, y + CELL)).convert("RGBA")
        if sha256(cell.tobytes()) != hashes[i]:
            raise ValueError(f"Clip source frame SHA-256 mismatch at {i}")
        frames.append(cell)
    return frames


def flattened(frame: Image.Image, bg=COLOR_BG) -> Image.Image:
    out = Image.new("RGBA", frame.size, (*bg, 255))
    out.alpha_composite(frame.convert("RGBA"))
    return out.convert("RGB")


def perceptual_frame(frame: Image.Image) -> np.ndarray:
    thumb = flattened(frame).resize((DOWNSAMPLE, DOWNSAMPLE), Image.Resampling.BILINEAR)
    return np.asarray(thumb.convert("L"), dtype=np.float32)


def compare_aligned(first: np.ndarray, second: np.ndarray) -> tuple[float, float, tuple[int, int]]:
    """Compare fixed 42x42 center against translations up to ±3 thumbnail px."""
    if first.shape != (48, 48) or second.shape != (48, 48):
        raise ValueError("Expected grayscale 48x48 motion thumbnails")
    center = first[3:45, 3:45]
    unaligned = float(np.abs(center - second[3:45, 3:45]).mean())
    best = unaligned
    shift = (0, 0)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            if dx == 0 and dy == 0:
                continue
            mae = float(np.abs(center - second[3 + dy:45 + dy, 3 + dx:45 + dx]).mean())
            if mae < best:
                best, shift = mae, (dx, dy)
    return round(unaligned, 4), round(best, 4), shift


def silhouette_center(frame: Image.Image):
    alpha = np.asarray(frame.getchannel("A"), dtype=np.uint8)
    y, x = np.nonzero(alpha >= 64)
    if len(x) == 0:
        return None
    return (float(x.mean()), float(y.mean()))


def analyze_motion(frames: list[Image.Image]) -> dict:
    if len(frames) != 24 or any(f.size != (CELL, CELL) for f in frames):
        raise ValueError("Expected 24 source-derived 192px frames")
    small = [perceptual_frame(frame) for frame in frames]
    distances = [float(np.abs(a - small[0]).mean()) for a in small]
    changes = [float(np.abs(small[i + 1] - small[i]).mean()) for i in range(23)]
    alignments = []
    explanations = []
    for index in (6, 12, 18, 23):
        raw, aligned, shift = compare_aligned(small[0], small[index])
        explained = max(0.0, 1.0 - aligned / max(raw, 0.0001))
        alignments.append({
            "frame": index + 1, "unalignedGrayscaleMAE": raw,
            "translationAlignedMAE": aligned,
            "bestTranslationThumbnailPx": list(shift),
            "translationExplainedFraction": round(explained, 4),
        })
        if raw >= 1.0:
            explanations.append(explained)
    centers = [silhouette_center(frame) for frame in frames]
    anchored = [pos for pos in centers if pos is not None]
    x_travel = max(x for x, y in anchored) - min(x for x, y in anchored) if anchored else 0.0
    y_travel = max(y for x, y in anchored) - min(y for x, y in anchored) if anchored else 0.0
    max_visible = max(distances)
    median_alignment = float(np.median(explanations)) if explanations else 0.0
    median_adjacent = float(np.median(changes))
    # These flags only prioritize manual playback inspection, never art approval.
    return {
        "frames": 24,
        "thumbnailSize": [48, 48],
        "grayscaleBackdropRGB": list(COLOR_BG),
        "maxVisibleDifferenceFromFirst": round(max_visible, 4),
        "medianVisibleDifferenceFromFirst": round(float(np.median(distances)), 4),
        "framesDifferentFromFirstAt2": sum(d > 2.0 for d in distances),
        "medianAdjacentGrayscaleMAE": round(median_adjacent, 4),
        "maxAdjacentGrayscaleMAE": round(max(changes), 4),
        "translationExplainedFractionMedian": round(median_alignment, 4),
        "alignmentsVsFirst": alignments,
        "silhouetteCentroidXTravelPx": round(x_travel, 3),
        "silhouetteCentroidYTravelPx": round(y_travel, 3),
        "nearStaticReviewCandidate": max_visible < 2.0,
        "rigidShiftReviewCandidate": max_visible >= 2.0 and median_alignment >= .70,
        "qualityInterpretation": "Perceptual grayscale 48px thumbnail MAE is a motion triage proxy, not an articulation verdict",
    }


def contact_sheet(id: str, frame_by_clip: dict[str, list[Image.Image]], out: Path) -> None:
    size, gap, label_w = 144, 10, 178
    width = label_w + 7 * (size + gap) + 16
    height = 84 + 10 * (size + gap + 4)
    board = Image.new("RGB", (width, height), (17, 21, 28))
    draw = ImageDraw.Draw(board)
    draw.text((18, 15), id.upper() + " / SOURCE-DERIVED HD MOTION SAMPLER / REVIEW ONLY",
              fill=(233, 208, 166))
    draw.text((18, 40), "Cells shown from real 24-frame WebP clips; timeline sample indices below",
              fill=(173, 168, 156))
    for column, index in enumerate(SAMPLES):
        draw.text((label_w + column * (size + gap) + 4, 65),
                  "F" + str(index + 1).zfill(2), fill=(228, 188, 127))
    for row, name in enumerate(CLIPS):
        y = 84 + row * (size + gap + 4)
        draw.text((18, y + 44), name.upper(), fill=(233, 222, 201))
        for column, index in enumerate(SAMPLES):
            x = label_w + column * (size + gap)
            src = flattened(frame_by_clip[name][index])
            src = src.resize((size, size), Image.Resampling.LANCZOS)
            board.paste(src, (x, y))
            draw.rectangle((x, y, x + size - 1, y + size - 1), outline=(104, 98, 86))
    board.save(out, optimize=True)


def run(root: Path, out: Path) -> dict:
    root, out = root.resolve(), out.resolve()
    keys = load(root / "game/assets/art/hd-painted-v1/manifest.json")
    motion = load(root / "game/assets/art/hd-painted-v1/motion-manifest.json")
    roster = load(root / "assets/art/roster-keystone/roster.json")
    if motion.get("motionClipCount") != 70 or motion.get("frameTotal") != 1680:
        raise ValueError("Expected exactly seven bosses / 70 clips / 1680 frames")
    out.mkdir(parents=True, exist_ok=True)
    reports = {}
    for id in IDS:
        row = [x for x in roster["identities"] if x.get("id") == id and x.get("kind") == "named-boss"]
        art = keys["actors"][id]
        actor = motion["actors"][id]
        if len(row) != 1 or row[0]["visualApproval"] != "pending":
            raise ValueError("Manual art approval gate changed for " + id)
        if actor["sourceSheetSha256"] != art["sha256"]:
            raise ValueError("Source art / motion provenance drift for " + id)
        entry = {}
        all_frames = {}
        for name in CLIPS:
            clip = actor["clipSet"][name]
            path = root / "game/assets/art/hd-painted-v1" / clip["path"]
            if sha256(path.read_bytes()) != clip["sha256"] or clip["frames"] != 24:
                raise ValueError("WebP binary receipt mismatch: " + id + "/" + name)
            with Image.open(path) as img:
                cells = frames_from_atlas(img, clip["frameRGBAsha256"])
            entry[name] = {**analyze_motion(cells), "sourcePose": clip["sourcePose"],
                           "frameMs": clip["frameMs"], "clipSha256": clip["sha256"]}
            all_frames[name] = cells
        contact_sheet(id, all_frames, out / f"motion-timeline-{id}.png")
        reports[id] = entry
    ranked = sorted((
        {"id": id, "clip": clip, "maxVisibleDifferenceFromFirst": m["maxVisibleDifferenceFromFirst"],
         "translationExplainedFractionMedian": m["translationExplainedFractionMedian"],
         "nearStaticReviewCandidate": m["nearStaticReviewCandidate"],
         "rigidShiftReviewCandidate": m["rigidShiftReviewCandidate"]}
        for id, actor in reports.items() for clip, m in actor.items()
    ), key=lambda row: row["maxVisibleDifferenceFromFirst"])
    count_near = sum(x["nearStaticReviewCandidate"] for x in ranked)
    count_rigid = sum(x["rigidShiftReviewCandidate"] for x in ranked)
    result = {
        "schema": "jrpg-hd-boss-perceptual-motion-audit/1",
        "bossCount": 7, "motionClipCount": 70, "decodedFrameCount": 1680,
        "allDecodedFrameHashesVerified": True, "originalAssetWrites": 0,
        "manualVisualApproval": "pending", "nearStaticReviewCandidates": count_near,
        "rigidShiftReviewCandidates": count_rigid, "bosses": reports,
        "rankedNearStatic": ranked,
    }
    (out / "motion-metrics.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    lines = ["# Seven-boss motion diversity audit", "",
             "Actual GIF-like motion is stored as WebP atlases with 24 composited cells per clip.",
             "All 1680 decoded RGBA hashes match their source receipts.",
             f"**Near-static thumbnail candidates: {count_near}/70. Rigid-shift candidates: {count_rigid}/70.**",
             "These are review cues rather than failed-art or passed-art judgements.", "",
             "## Lowest measured visible variation from first frame", "",
             "| Boss | Clip | Max grayscale Δ/255 | Visibly changed frames >2/255 | Translation explained |",
             "| --- | --- | ---: | ---: | ---: |"]
    for x in ranked[:25]:
        m = reports[x["id"]][x["clip"]]
        lines.append(f"| {x['id']} | {x['clip']} | {m['maxVisibleDifferenceFromFirst']:.3f} | "
                     f"{m['framesDifferentFromFirstAt2']}/24 | "
                     f"{m['translationExplainedFractionMedian']:.1%} |")
    lines += ["", "## Review interpretation", "",
              "These clips contain 24 hash-distinct source-derived deformation cells, not individually",
              "articulated animation drawings. A pixel hash can differ for changes outside visible",
              "silhouettes; this audit composites onto a neutral backing and compares downsampled",
              "grayscale appearance. Translation alignment is limited to ±3 48px-thumbnail pixels.",
              "Check the seven timeline contact sheets, then review full-speed windup and active",
              "attacks in the browser studio and optional ?art=hd gameplay mode before approval.", ""]
    (out / "motion-report.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts/hd-motion-diversity")
    a = parser.parse_args()
    run(a.root, a.output_dir)


if __name__ == "__main__":
    main()
