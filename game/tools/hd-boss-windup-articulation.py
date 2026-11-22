#!/usr/bin/env python3
"""Build two review-only keyed windup candidates from immutable JRPG source art.

Yearless Bell: the suspended bell recoils beneath fixed wooden supports.
Lady Enma: the cinder fan rotates about her wrist and charges brighter.
These are layered painting deformations, not separately illustrated in-betweens.
All output stays under the requested artifact directory. The game, source
manifests, attack timing, hitboxes and visual-approval ledger are untouched.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
POSE_SIZE = 384
FRAME_SIZE = 192
COUNT = 24
SAMPLES = (0, 4, 8, 12, 16, 20, 23)
PROFILES = {
    "yearless-bell": {
        "name": "Yearless Bell",
        "clip": "windup", "poseIndex": 2,
        "pivot": (192, 90), "totalDegrees": -15.0,
        "flameBrightnessGain": 0.0,
        "maskPolygon": (
            (180, 85), (149, 105), (133, 120), (116, 153), (105, 212),
            (111, 279), (121, 321), (139, 330), (258, 330),
            (283, 310), (292, 279), (282, 202), (260, 138),
            (230, 111), (205, 91),
        ),
        "feather": 1.8,
        "fixed": ((50, 36), (320, 36)),
        "description": "bell draws back under stationary crossbeam; live game telegraphs unchanged",
    },
    "lady-enma": {
        "name": "Lady Enma",
        "clip": "windup", "poseIndex": 2,
        "pivot": (91, 99), "totalDegrees": -21.0,
        "flameBrightnessGain": 1.0,
        "maskPolygon": (
            (38, 3), (147, 1), (160, 19), (153, 71), (121, 100),
            (83, 104), (47, 75),
        ),
        "feather": 1.4,
        "fixed": ((208, 73), (194, 352)),
        "description": "fan pivots around hand and brightens as it charges; torso and feet fixed",
    },
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def smoothstep(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def separate_layer(original: Image.Image, profile: dict):
    if original.size != (POSE_SIZE, POSE_SIZE):
        raise ValueError("Expected a painted 384x384 key-pose source")
    source = original.convert("RGBA")
    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).polygon(profile["maskPolygon"], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(profile["feather"]))
    alphas = source.getchannel("A").tobytes()
    vals = mask.tobytes()
    static_alpha = bytes(round(a * (1.0 - m / 255)) for a, m in zip(alphas, vals))
    moving_alpha = bytes(round(a * m / 255) for a, m in zip(alphas, vals))
    stationary = source.copy()
    moving = source.copy()
    stationary.putalpha(Image.frombytes("L", source.size, static_alpha))
    moving.putalpha(Image.frombytes("L", source.size, moving_alpha))
    return stationary, moving, mask


def make_frames(original: Image.Image, profile: dict) -> tuple[list[Image.Image], Image.Image]:
    stationary, moving, mask = separate_layer(original, profile)
    frames = []
    for i in range(COUNT):
        if i == 0:
            frames.append(original.convert("RGBA").copy())
            continue
        t = smoothstep(i / (COUNT - 1))
        warped = moving.rotate(
            profile["totalDegrees"] * t,
            resample=Image.Resampling.BICUBIC,
            center=profile["pivot"],
            expand=False,
            fillcolor=(0, 0, 0, 0),
        )
        gain = profile["flameBrightnessGain"]
        if gain:
            previous_alpha = warped.getchannel("A")
            enhanced_rgb = ImageEnhance.Brightness(warped.convert("RGB")).enhance(1 + gain * t)
            warped = enhanced_rgb.convert("RGBA")
            warped.putalpha(previous_alpha)
        candidate = Image.alpha_composite(stationary, warped)
        for pt in profile["fixed"]:
            if candidate.getpixel(pt) != original.getpixel(pt):
                raise AssertionError("Protected stationary painting changed at " + str(pt))
        frames.append(candidate)
    if len(frames) != COUNT:
        raise AssertionError("Expected 24 ordered frames")
    return frames, mask


def pack_webp(frames: list[Image.Image]) -> Image.Image:
    if len(frames) != COUNT:
        raise ValueError("A candidate must contain 24 frames")
    atlas = Image.new("RGBA", (FRAME_SIZE * 12, FRAME_SIZE * 2), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        small = frame.resize((FRAME_SIZE, FRAME_SIZE), Image.Resampling.LANCZOS)
        atlas.paste(small, ((i % 12) * FRAME_SIZE, (i // 12) * FRAME_SIZE))
    return atlas


def contact(original: Image.Image, frames: list[Image.Image], profile: dict, path: Path) -> None:
    size, gap = 256, 12
    width = 7 * (size + gap) + 24
    height = 2 * (size + 36) + 82
    board = Image.new("RGB", (width, height), (18, 22, 29))
    pen = ImageDraw.Draw(board)
    pen.text((15, 12), profile["name"].upper() + " / WINDUP ARTICULATION STUDY", fill=(229, 203, 167))
    pen.text((15, 36), "TOP: VERIFIED ORIGINAL KEY   BOTTOM: NEW SOURCE-DERIVED RECOIL / FAN CHARGE", fill=(177, 169, 158))
    for row in range(2):
        for j, i in enumerate(SAMPLES):
            bg = Image.new("RGBA", (POSE_SIZE, POSE_SIZE), (49, 56, 66, 255))
            bg.alpha_composite(original if row == 0 else frames[i])
            preview = bg.convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
            x, y = 12 + j * (size + gap), 76 + row * (size + 36)
            board.paste(preview, (x, y))
            pen.rectangle((x, y, x + size - 1, y + size - 1), outline=(122, 111, 97))
            pen.text((x + 3, y + size + 4), "SOURCE" if row == 0 else "FRAME " + str(i + 1).zfill(2),
                     fill=(228, 207, 174))
    board.save(path, optimize=True)


def motion_audit_module() -> object:
    path = Path(__file__).with_name("hd-boss-motion-diversity.py")
    spec = importlib.util.spec_from_file_location("hd_motion_diversity", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(root: Path, output: Path) -> dict:
    root, output = root.resolve(), output.resolve()
    keys = json.loads((root / "game/assets/art/hd-painted-v1/manifest.json").read_text())
    motion = json.loads((root / "game/assets/art/hd-painted-v1/motion-manifest.json").read_text())
    roster = json.loads((root / "assets/art/roster-keystone/roster.json").read_text())
    audit = motion_audit_module()
    output.mkdir(parents=True, exist_ok=True)
    receipts = {}
    for boss_id, profile in PROFILES.items():
        rows = [r for r in roster["identities"] if r.get("id") == boss_id and r.get("kind") == "named-boss"]
        if len(rows) != 1 or rows[0].get("visualApproval") != "pending" or rows[0].get("assetInGit") is not True:
            raise ValueError("Pending visual review gate changed for " + boss_id)
        intake = json.loads((root / f"assets/art/roster-keystone/{boss_id}-hd-intake.json").read_text())
        art = keys["actors"][boss_id]
        entry = motion["actors"][boss_id]["clipSet"][profile["clip"]]
        if (intake["bossId"] != boss_id or art["sha256"] != intake["sixKeyAtlasSha256"]
                or motion["actors"][boss_id]["sourceSheetSha256"] != art["sha256"]
                or entry["sourcePose"] != profile["poseIndex"]):
            raise ValueError("Provenance mismatch for " + boss_id)
        source_path = root / "game/assets/art/hd-painted-v1" / art["file"]
        original_motion_path = root / "game/assets/art/hd-painted-v1" / entry["path"]
        if digest(source_path.read_bytes()) != art["sha256"] \
                or digest(original_motion_path.read_bytes()) != entry["sha256"]:
            raise ValueError("Git source or motion binary mutated for " + boss_id)
        with Image.open(source_path) as im:
            six_keys = im.convert("RGBA")
        with Image.open(original_motion_path) as im:
            source_motion = im.convert("RGBA")
        if six_keys.size != (2304, 384):
            raise ValueError("Painted source no longer has six key poses")
        p = profile["poseIndex"]
        original = six_keys.crop((p * POSE_SIZE, 0, (p + 1) * POSE_SIZE, POSE_SIZE))
        frames, mask = make_frames(original, profile)
        atlas = pack_webp(frames)
        candidate_path = output / f"{boss_id}-windup-review.webp"
        atlas.save(candidate_path, "WEBP", lossless=True, method=6)
        with Image.open(candidate_path) as im:
            candidate_atlas = im.convert("RGBA")
        if candidate_atlas.size != (2304, 384):
            raise ValueError("WebP decoding changed clip geometry")
        hashes = [digest(candidate_atlas.crop((
            (i % 12) * FRAME_SIZE, (i // 12) * FRAME_SIZE,
            ((i % 12) + 1) * FRAME_SIZE, ((i // 12) + 1) * FRAME_SIZE
        )).tobytes()) for i in range(COUNT)]
        if len(set(hashes)) != COUNT:
            raise ValueError("Lossless WebP has duplicate decoded frames: " + boss_id)
        source_cells = audit.frames_from_atlas(source_motion, entry["frameRGBAsha256"])
        result_cells = audit.frames_from_atlas(candidate_atlas, hashes)
        original_metrics = audit.analyze_motion(source_cells)
        candidate_metrics = audit.analyze_motion(result_cells)
        original_score = original_metrics["maxForegroundDifferenceFromFirst"]
        candidate_score = candidate_metrics["maxForegroundDifferenceFromFirst"]
        if candidate_score <= original_score + 1.0:
            raise ValueError("Insufficient foreground motion gain for " + boss_id
                             + f": {original_score} -> {candidate_score}")
        if candidate_metrics["framesDifferentFromFirstAt4Foreground"] < 8:
            raise ValueError("Too few visibly different frames for " + boss_id)
        contact(original, frames, profile, output / f"{boss_id}-windup-contact.png")
        mask_file = output / f"{boss_id}-moving-layer-mask.png"
        mask.save(mask_file)
        receipts[boss_id] = {
            "bossId": boss_id,
            "clip": profile["clip"],
            "authoredKeyPoseIndex": p,
            "sourceSixKeyAtlasSha256": art["sha256"],
            "originalWindupWebPSha256": entry["sha256"],
            "candidateWebPSha256": digest(candidate_path.read_bytes()),
            "candidateFrameRGBAsha256": hashes,
            "movingMaskSha256": digest(mask_file.read_bytes()),
            "pivot": profile["pivot"],
            "rotationDegreesFinal": profile["totalDegrees"],
            "brightnessGainFinal": profile["flameBrightnessGain"],
            "frameMs": entry["frameMs"],
            "footAnchor": entry["foot"],
            "stationaryValidationPixels": profile["fixed"],
            "originalPerceptualMotion": original_metrics,
            "candidatePerceptualMotion": candidate_metrics,
            "visualApproval": "pending",
            "reviewAuthority": "non-runtime source-derived candidate; manual QA required",
            "limitations": "rigged pixels from one painted source; occlusions and wrists require human inspection",
        }
    receipt = {
        "schema": "jrpg-hd-boss-two-windup-studies/1",
        "date": "2026-11-22",
        "candidateCount": len(receipts),
        "candidateTotalFrames": COUNT * len(receipts),
        "sourceAssetWrites": 0,
        "canonicalVisualApproval": "pending-for-all-seven",
        "candidates": receipts,
    }
    (output / "candidate-receipts.json").write_text(json.dumps(receipt, indent=2) + "\n")
    summary = [
        "# Two articulated windup studies", "",
        "Generated only in CI artifacts. The playable animation manifest remains unchanged.", "",
        "| Boss | Original max foreground delta | Candidate max foreground delta | Visibly different frames |",
        "| --- | ---: | ---: | ---: |",
    ]
    for boss_id, r in receipts.items():
        m, n = r["originalPerceptualMotion"], r["candidatePerceptualMotion"]
        summary.append(f"| {boss_id} | {m['maxForegroundDifferenceFromFirst']:.3f} | "
                       f"{n['maxForegroundDifferenceFromFirst']:.3f} | "
                       f"{n['framesDifferentFromFirstAt4Foreground']}/24 |")
    summary += ["", "The Yearless Bell joint is constrained below its beam. Lady Enma's fan",
                "rotation and progressive charge preserve the face and bottom silhouette.",
                "These are sourced layer moves; source paintings are not hand-inbetweened.", ""]
    (output / "report.md").write_text("\n".join(summary))
    print("\n".join(summary))
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts/hd-boss-windup-studies")
    args = parser.parse_args()
    run(args.root, args.output_dir)


if __name__ == "__main__":
    main()
