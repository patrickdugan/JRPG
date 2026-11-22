#!/usr/bin/env python3
"""Audit exact windup -> active transitions for Yearless Bell and Lady Enma.

Regenerates the review-only source-key candidate windups from the pinned Git
artwork. Measures the actual final windup frame against the current active
frame one; never writes into the gameplay asset or roster directories.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
IDS = ("yearless-bell", "lady-enma")
CELL = 192
SAMPLES = (20, 21, 22, 23, 0, 1, 2, 3)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def import_tool(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if not spec or not spec.loader:
        raise ImportError("Unable to import art-audit helper " + str(path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def silhouette(frame: Image.Image, threshold: int = 64) -> np.ndarray:
    alpha = frame.convert("RGBA").getchannel("A")
    return np.asarray(alpha, dtype=np.uint8) >= threshold


def join_metrics(before: Image.Image, after: Image.Image, audit) -> dict:
    """Quantify image discontinuity, preserving unknown artistic meaning."""
    if before.size != (CELL, CELL) or after.size != (CELL, CELL):
        raise ValueError("Expected original decoded 192x192 cells")
    a, b = audit.perceptual_frame(before), audit.perceptual_frame(after)
    ma = np.asarray(before.getchannel("A").resize((48, 48), Image.Resampling.BILINEAR),
                    dtype=np.uint8) >= 24
    mb = np.asarray(after.getchannel("A").resize((48, 48), Image.Resampling.BILINEAR),
                    dtype=np.uint8) >= 24
    union_mask = ma | mb
    visible = np.abs(a - b)
    large_a = silhouette(before)
    large_b = silhouette(after)
    intersection = int(np.count_nonzero(large_a & large_b))
    area_union = int(np.count_nonzero(large_a | large_b))
    overlap = intersection / area_union if area_union else 1.0
    center_a, center_b = audit.silhouette_center(before), audit.silhouette_center(after)
    movement = (
        round(float(np.hypot(center_a[0] - center_b[0], center_a[1] - center_b[1])), 4)
        if center_a and center_b else None
    )
    return {
        "grayscaleMAE48Full": round(float(visible.mean()), 4),
        "grayscaleMAE48ForegroundUnion": round(float(visible[union_mask].mean()), 4)
        if union_mask.any() else 0.0,
        "silhouetteAlphaIoU": round(overlap, 4),
        "silhouetteCentroidShiftPx": movement,
        "foregroundPixelsInFullResolution": area_union,
        "threshold": {"alphaIoU": 64, "foreground48": 24},
    }


def draw_frame(frame: Image.Image, size: int = 256, bg=(48, 54, 65)) -> Image.Image:
    base = Image.new("RGBA", frame.size, (*bg, 255))
    base.alpha_composite(frame.convert("RGBA"))
    return base.convert("RGB").resize((size, size), Image.Resampling.LANCZOS)


def seam_board(original_windup, proposed_windup, original_active, name: str,
               output: Path) -> None:
    size, gap, left = 208, 12, 160
    width = left + 8 * (size + gap) + 14
    height = 2 * (size + 42) + 116
    sheet = Image.new("RGB", (width, height), (16, 22, 30))
    pen = ImageDraw.Draw(sheet)
    pen.text((18, 17), name.upper() + " / EXACT WINDUP -> EXISTING ACTIVE FRAME SEAM",
             fill=(237, 207, 169))
    pen.text((18, 45), "Original and candidate windups join to the SAME unchanged original attack",
             fill=(183, 178, 167))
    for row, (label, windup) in enumerate((
        ("ORIGINAL", original_windup),
        ("CANDIDATE", proposed_windup),
    )):
        y = 92 + row * (size + 42)
        pen.text((17, y + 87), label, fill=(237, 205, 164))
        for col, sample in enumerate(SAMPLES):
            is_windup = col < 4
            frame = windup[sample] if is_windup else original_active[sample]
            x = left + col * (size + gap)
            sheet.paste(draw_frame(frame, size), (x, y))
            pen.rectangle((x, y, x + size - 1, y + size - 1), outline=(112, 99, 88))
            text = ("WINDUP " + str(sample+1).zfill(2)) if is_windup else ("ACTIVE " + str(sample+1).zfill(2))
            pen.text((x + 5, y + size + 5), text, fill=(225, 196, 156))
        boundary = left + 4 * (size + gap) - 6
        pen.line((boundary, y - 4, boundary, y + size + 20),
                 fill=(237, 113, 83), width=4)
    sheet.save(output, optimize=True)


def seam_gif(original_windup, proposed_windup, active, name: str, output: Path,
             windup_ms: int, active_ms: int) -> None:
    frames = []
    duration = []
    for i in range(16):
        is_windup = i < 8
        index = 16 + i if is_windup else i - 8
        left = original_windup[index] if is_windup else active[index]
        right = proposed_windup[index] if is_windup else active[index]
        panel = Image.new("RGB", (564, 325), (18, 22, 30))
        pen = ImageDraw.Draw(panel)
        pen.text((22, 14), name.upper() + " / ORIGINAL", fill=(224, 195, 154))
        pen.text((302, 14), name.upper() + " / PROPOSED", fill=(224, 195, 154))
        panel.paste(draw_frame(left), (20, 40))
        panel.paste(draw_frame(right), (288, 40))
        pen.line((281, 25, 281, 307), fill=(103, 98, 88), width=2)
        phase = "WINDUP" if is_windup else "ACTIVE"
        pen.text((22, 301), phase + " " + str(index+1).zfill(2) + " / 24",
                 fill=(235, 181, 132) if is_windup else (157, 221, 191))
        if i == 8:
            pen.rectangle((286, 35, 550, 298), outline=(239, 124, 98), width=3)
        frames.append(panel)
        duration.append(max(55, 2 * (windup_ms if is_windup else active_ms)))
    frames[0].save(output, format="GIF", save_all=True, append_images=frames[1:],
                   duration=duration, loop=0, disposal=2, optimize=False)


def run(root: Path, output: Path) -> dict:
    root, output = root.resolve(), output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    generator = import_tool("windup_candidates", Path(__file__).with_name("hd-boss-windup-articulation.py"))
    audit = import_tool("motion_metrics", Path(__file__).with_name("hd-boss-motion-diversity.py"))
    candidate_root = output / "generated-candidates"
    receipts = generator.run(root, candidate_root)
    if receipts.get("candidateCount") != 2:
        raise ValueError("Expected two provenance-checked windup candidates")
    manifest = json.loads((root / "game/assets/art/hd-painted-v1/motion-manifest.json").read_text())
    roster = json.loads((root / "assets/art/roster-keystone/roster.json").read_text())
    results = {}
    for id in IDS:
        rows = [r for r in roster["identities"] if r.get("id") == id and r.get("kind") == "named-boss"]
        if len(rows) != 1 or rows[0].get("visualApproval") != "pending":
            raise ValueError("Canonical approval changed for " + id)
        clips = manifest["actors"][id]["clipSet"]
        windup, active = clips["windup"], clips["active"]
        original_windup_path = root / "game/assets/art/hd-painted-v1" / windup["path"]
        original_active_path = root / "game/assets/art/hd-painted-v1" / active["path"]
        if sha256(original_windup_path.read_bytes()) != windup["sha256"] or \
                sha256(original_active_path.read_bytes()) != active["sha256"]:
            raise ValueError("Pinned runtime animation byte hashes changed for " + id)
        with Image.open(original_windup_path) as image:
            old_cells = audit.frames_from_atlas(image.convert("RGBA"), windup["frameRGBAsha256"])
        with Image.open(original_active_path) as image:
            active_cells = audit.frames_from_atlas(image.convert("RGBA"), active["frameRGBAsha256"])
        c = candidate_root / (id + "-windup-review.webp")
        if sha256(c.read_bytes()) != receipts["candidates"][id]["candidateWebPSha256"]:
            raise ValueError("Generated candidate WebP hash changed for " + id)
        with Image.open(c) as image:
            proposed_cells = audit.frames_from_atlas(
                image.convert("RGBA"), receipts["candidates"][id]["candidateFrameRGBAsha256"])
        old_boundary = join_metrics(old_cells[-1], active_cells[0], audit)
        new_boundary = join_metrics(proposed_cells[-1], active_cells[0], audit)
        old_intra = join_metrics(old_cells[-2], old_cells[-1], audit)
        candidate_intra = join_metrics(proposed_cells[-2], proposed_cells[-1], audit)
        active_intra = join_metrics(active_cells[0], active_cells[1], audit)
        ratio = round(new_boundary["grayscaleMAE48ForegroundUnion"] /
                      max(old_boundary["grayscaleMAE48ForegroundUnion"], 1e-6), 4)
        name = generator.PROFILES[id]["name"]
        seam_board(old_cells, proposed_cells, active_cells, name, output / (id + "-handoff-contact.png"))
        seam_gif(old_cells, proposed_cells, active_cells, name, output / (id + "-handoff-loop.gif"),
                 windup["frameMs"], active["frameMs"])
        results[id] = {
            "originalWindupSha256": windup["sha256"],
            "originalActiveSha256": active["sha256"],
            "candidateWindupSha256": receipts["candidates"][id]["candidateWebPSha256"],
            "windupFrameMs": windup["frameMs"],
            "activeFrameMs": active["frameMs"],
            "originalWindupToActive": old_boundary,
            "candidateWindupToActive": new_boundary,
            "originalWindupFinalInternal": old_intra,
            "candidateWindupFinalInternal": candidate_intra,
            "activeFirstInternal": active_intra,
            "candidateBoundaryVsOriginalForegroundRatio": ratio,
            "seamWorsenedAtRatioAbove": 1.15,
            "seamWorseningReviewFlag": ratio > 1.15,
            "approval": "pending-human-art-review",
        }
    report = {
        "schema": "jrpg-hd-boss-attack-transition-audit/1",
        "candidateCount": len(results),
        "immutableGameplayAssets": True,
        "canonicalApproval": "pending",
        "summary": results,
        "interpretation": "Pixel discontinuities and silhouette intersections are review priorities, not calibrated artistic pass/fail thresholds.",
    }
    (output / "seam-metrics.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# Windup to active animation handoff", "",
        "All measurements use the actual final windup frame and existing active frame one.",
        "The candidate and original handoffs share the same unchanged active attack.",
        "",
        "| Boss | Original seam foreground MAE | Candidate seam foreground MAE | Candidate/original ratio | Original alpha IoU | Candidate alpha IoU |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for id in IDS:
        row = results[id]
        a, b = row["originalWindupToActive"], row["candidateWindupToActive"]
        lines.append("| " + id + " | " + f'{a["grayscaleMAE48ForegroundUnion"]:.3f}' +
                     " | " + f'{b["grayscaleMAE48ForegroundUnion"]:.3f}' +
                     " | " + f'{row["candidateBoundaryVsOriginalForegroundRatio"]:.2f}' +
                     " | " + f'{a["silhouetteAlphaIoU"]:.3f}' +
                     " | " + f'{b["silhouetteAlphaIoU"]:.3f}' + " |")
    lines += [
        "", "The report includes the final within-windup change, first within-active change,",
        "and the silhouette centroid jump. A high seam ratio indicates the candidate",
        "may require a dedicated windup-end pose and artist-authored continuity.",
        "Review the exact GIF transition at frame 24 to active frame 1 for wrist",
        "connections, chain attachment, silhouette change, and attack tell readability.",
        "The game runtime and existing clip hashes remain unchanged.", "",
    ]
    (output / "seam-report.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts/hd-boss-attack-seams")
    args = parser.parse_args()
    run(args.root, args.output_dir)
