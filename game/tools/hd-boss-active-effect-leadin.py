#!/usr/bin/env python3
"""Review-only anticipation effects for the two HD boss attack cutovers.

Extracts bright colored release effects from the immutable original active
frame one. Introduces only selected effect pixels, outside the painted
candidate silhouette, during the final eight windup cells. The figure and
release WebP remain unchanged. Does not imply human art approval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
IDS = ("yearless-bell", "lady-enma")
CELL = 192
COUNT = 24


def load_tool(name, path):
    import importlib.util
    spec = importlib.util.spec_from_file_location(name, path)
    if not spec or not spec.loader:
        raise ImportError("Missing art audit " + str(path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def effect_mask(active_first: Image.Image, candidate_last: Image.Image,
                boss_id: str) -> Image.Image:
    """Copy only high-saturation emission outside the proposed windup body.

    These profile thresholds are tuned to the retained source paintings and
    intentionally leave dark costume folds, skin and opaque body pixels alone.
    """
    if boss_id not in IDS:
        raise ValueError("Unknown boss effect profile")
    if active_first.size != (CELL, CELL) or candidate_last.size != (CELL, CELL):
        raise ValueError("Expected 192px WebP cells")
    release = np.asarray(active_first.convert("RGBA"), dtype=np.float32)
    windup = np.asarray(candidate_last.convert("RGBA"), dtype=np.float32)
    r, g, b, alpha = [release[:, :, i] for i in range(4)]
    y, x = np.mgrid[0:CELL, 0:CELL]
    if boss_id == "yearless-bell":
        eligible = ((b > g * 1.33) & (r > g * 1.10) &
                    (b > 120) & (r > 90) & (alpha > 45) &
                    (x > 4) & (x < 188) & (y > 22) & (y < 188))
    else:
        eligible = ((r > 162) & (g > 68) & (r > g * 1.30) &
                    (g > b * 1.15) & (alpha > 45) &
                    (x > 1) & (x < 186) & (y > 15) & (y < 143))
    eligible &= windup[:, :, 3] < 128
    result = np.asarray(active_first.convert("RGBA"), dtype=np.uint8).copy()
    result[:, :, 3] = (alpha * eligible).astype(np.uint8)
    return Image.fromarray(result, "RGBA")


def smoothstep(x: float) -> float:
    t = max(0.0, min(1.0, x))
    return t * t * (3 - 2 * t)


def compose_windup(frames: list[Image.Image], effect: Image.Image) -> list[Image.Image]:
    if len(frames) != COUNT or effect.size != (CELL, CELL):
        raise ValueError("Expected 24 windup frames and 192px effect layer")
    effect_arr = np.asarray(effect.convert("RGBA"), dtype=np.uint8)
    result = []
    for i, frame in enumerate(frames):
        if frame.size != (CELL, CELL):
            raise ValueError("Mismatched source frame size")
        if i < 16:
            result.append(frame.copy())
            continue
        strength = smoothstep((i - 15) / 8)
        base = np.asarray(frame.convert("RGBA"), dtype=np.uint8)
        overlay = effect_arr.copy()
        opacity = (base[:, :, 3] < 128)
        overlay[:, :, 3] = np.rint(overlay[:, :, 3].astype(float) * strength * opacity).astype(np.uint8)
        composited = Image.alpha_composite(frame.convert("RGBA"), Image.fromarray(overlay, "RGBA"))
        result.append(composited)
    return result


def pack(frames: list[Image.Image]) -> Image.Image:
    if len(frames) != COUNT:
        raise ValueError("24 frames required")
    atlas = Image.new("RGBA", (2304, 384), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        atlas.paste(frame, ((i % 12) * CELL, (i // 12) * CELL))
    return atlas


def run(root: Path, out: Path) -> dict:
    root, out = root.resolve(), out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    tools_dir = Path(__file__).parent
    windup_tool = load_tool("windup_candidates", tools_dir / "hd-boss-windup-articulation.py")
    audit = load_tool("perceptual_motion", tools_dir / "hd-boss-motion-diversity.py")
    boundary = load_tool("phase_boundary", tools_dir / "hd-boss-attack-seam-audit.py")
    cand_dir = out / "generated-source-windups"
    prior_receipts = windup_tool.run(root, cand_dir)
    motion = json.loads((root / "game/assets/art/hd-painted-v1/motion-manifest.json").read_text())
    roster = json.loads((root / "assets/art/roster-keystone/roster.json").read_text())
    outputs = {}
    for id in IDS:
        row = [r for r in roster["identities"]
               if r.get("kind") == "named-boss" and r.get("id") == id]
        if len(row) != 1 or row[0].get("visualApproval") != "pending":
            raise ValueError("Manual approval gate changed for " + id)
        clips = motion["actors"][id]["clipSet"]
        active = clips["active"]
        active_path = root / "game/assets/art/hd-painted-v1" / active["path"]
        if sha(active_path.read_bytes()) != active["sha256"]:
            raise ValueError("Original active clip changed for " + id)
        with Image.open(active_path) as source:
            original_active = audit.frames_from_atlas(
                source.convert("RGBA"), active["frameRGBAsha256"])
        candidate_path = cand_dir / (id + "-windup-review.webp")
        prior = prior_receipts["candidates"][id]
        if sha(candidate_path.read_bytes()) != prior["candidateWebPSha256"]:
            raise ValueError("Source-derived candidate windup hash changed")
        with Image.open(candidate_path) as source:
            original_candidate = audit.frames_from_atlas(
                source.convert("RGBA"), prior["candidateFrameRGBAsha256"])
        effect = effect_mask(original_active[0], original_candidate[-1], id)
        effect_count = sum(value > 0 for value in effect.getchannel("A").tobytes())
        if effect_count < 100:
            raise ValueError("Effect segmentation too sparse: " + id)
        result_frames = compose_windup(original_candidate, effect)
        for i in range(16):
            if result_frames[i].tobytes() != original_candidate[i].tobytes():
                raise AssertionError("Anticipation changed early windup frame " + str(i))
        output_path = out / (id + "-windup-effect-leadin.webp")
        pack(result_frames).save(output_path, "WEBP", lossless=True, method=6)
        with Image.open(output_path) as image:
            candidate_atlas = image.convert("RGBA")
        candidate_hashes = []
        for i in range(COUNT):
            x, y = (i % 12) * CELL, (i // 12) * CELL
            cell = candidate_atlas.crop((x, y, x + CELL, y + CELL))
            candidate_hashes.append(sha(cell.tobytes()))
        if len(set(candidate_hashes)) != COUNT:
            raise ValueError("Proposed windup has duplicate frame hashes for " + id)
        proposed = audit.frames_from_atlas(candidate_atlas, candidate_hashes)
        old_seam = boundary.join_metrics(original_candidate[-1], original_active[0], audit)
        new_seam = boundary.join_metrics(proposed[-1], original_active[0], audit)
        before = old_seam["grayscaleMAE48ForegroundUnion"]
        after = new_seam["grayscaleMAE48ForegroundUnion"]
        if after >= before:
            raise ValueError("Effect lead-in did not reduce seam delta: " + id +
                             f" {before} -> {after}")
        effect.save(out / (id + "-active-effect-layer.png"))
        boundary.seam_board(original_candidate, proposed, original_active,
                            id, out / (id + "-effect-handoff-contact.png"))
        boundary.seam_gif(original_candidate, proposed, original_active,
                          id, out / (id + "-effect-handoff-loop.gif"),
                          clips["windup"]["frameMs"], active["frameMs"])
        outputs[id] = {
            "sourceWindupCandidateSha256": prior["candidateWebPSha256"],
            "immutableActiveSha256": active["sha256"],
            "leadInWebPSha256": sha(output_path.read_bytes()),
            "decodedFrameHashes": candidate_hashes,
            "effectPixelCount": effect_count,
            "ramp": "frames 17-24, smoothstep",
            "before": old_seam,
            "after": new_seam,
            "deltaReduced": round(before - after, 4),
            "reductionPercent": round((before - after) / before * 100, 2),
            "limitation": "Only source-active emission over transparent windup exterior; body and wrist pose jump remain",
            "reviewApproval": "pending",
        }
    report = {
        "schema": "jrpg-hd-boss-attack-effect-leadin/1",
        "candidateCount": 2, "changedOriginalAssets": False,
        "gameplayAuthority": "none; output artifacts only",
        "bosses": outputs,
    }
    (out / "effect-leadin-receipts.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# Attack-effect anticipation experiments", "",
        "Existing active attack art, timings, source PNGs and Roster Keystone are immutable.",
        "", "| Boss | Original candidate seam | With effect prelude | Reduced jump | Effect pixels |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for id, entry in outputs.items():
        lines.append(
            f'| {id} | {entry["before"]["grayscaleMAE48ForegroundUnion"]:.3f} | '
            f'{entry["after"]["grayscaleMAE48ForegroundUnion"]:.3f} | '
            f'{entry["reductionPercent"]:.2f}% | {entry["effectPixelCount"]} |')
    lines += [
        "", "The generator selectively reveals original active-frame glow during windup.",
        "It cannot fix Lady Enma's full-body pose swap, and Yearless Bell still",
        "needs a dedicated physical bell-release pose for a continuous silhouette.",
        "All GIFs and WebPs are non-runtime studies for human art inspection.", "",
    ]
    (out / "effect-leadin-report.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path,
                        default=ROOT / "artifacts/hd-active-effect-leadin")
    args = parser.parse_args()
    run(args.root, args.output_dir)
