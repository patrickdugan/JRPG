#!/usr/bin/env python3
"""SHA-pinned, non-runtime proposal to remove faint Furnace Abbot background haze.

Only alpha values 1..12, at least nine Chebyshev pixels away from any pixel
of alpha >=192 in the same 384x384 key cell, may be zeroed. RGB bytes,
high-confidence silhouette pixels, source art and runtime files are preserved.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
BOSS = "furnace-abbot"
CELL = 384
MAX_ALPHA = 12
STRONG_ALPHA = 192
GUARD_RADIUS = 8
MAX_CHANGED_FRACTION = .125


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def clean_cell(tile: Image.Image) -> tuple[Image.Image, Image.Image, dict]:
    if tile.size != (CELL, CELL):
        raise ValueError("Expected a single 384x384 key-pose cell")
    source = tile.convert("RGBA")
    alpha = source.getchannel("A")
    strong = alpha.point(lambda x: 255 if x >= STRONG_ALPHA else 0)
    # A square guard is deliberately more conservative than circular distance:
    # diagonal body/smoke pixels protect their nearby anti-aliased edges too.
    protected = strong.filter(ImageFilter.MaxFilter(2 * GUARD_RADIUS + 1))
    old_alpha = alpha.tobytes()
    new_alpha = bytearray(old_alpha)
    strong_near = protected.tobytes()
    heat = bytearray(CELL * CELL * 4)
    removed = 0
    for i, (a, neighbor) in enumerate(zip(old_alpha, strong_near)):
        if 0 < a <= MAX_ALPHA and neighbor == 0:
            new_alpha[i] = 0
            heat[i * 4:i * 4 + 4] = b"\xff\x55\x65\xff"
            removed += 1
    if removed > MAX_CHANGED_FRACTION * CELL * CELL:
        raise ValueError("Proposal exceeded maximum weak-alpha change budget")
    candidate = source.copy()
    candidate.putalpha(Image.frombytes("L", source.size, bytes(new_alpha)))
    if candidate.convert("RGB").tobytes() != source.convert("RGB").tobytes():
        raise AssertionError("The opaque RGB channels were modified")
    for i, a in enumerate(old_alpha):
        if a >= MAX_ALPHA + 1 or strong_near[i]:
            if new_alpha[i] != a:
                raise AssertionError("Protected alpha pixel was modified")
    return candidate, Image.frombytes("RGBA", source.size, bytes(heat)), {
        "clearedPixels": removed,
        "weakPixelsBefore": sum(0 < x <= MAX_ALPHA for x in old_alpha),
        "weakPixelsAfter": sum(0 < x <= MAX_ALPHA for x in new_alpha),
        "highAlphaPixelsUnchanged": sum(x >= STRONG_ALPHA for x in old_alpha),
        "maxAlphaChange": MAX_ALPHA,
    }


def proof_board(original: Image.Image, candidate: Image.Image, poses: list[str], path: Path) -> None:
    scale, pad, step = 284, 16, 14
    width = 6 * (scale + step) + 2 * pad
    height = 4 * (scale + 36) + 88
    board = Image.new("RGB", (width, height), (16, 20, 27))
    draw = ImageDraw.Draw(board)
    draw.text((pad, 17), "FURNACE ABBOT / SOURCE-VERIFIED ALPHA HAZE PREVIEW / HUMAN REVIEW ONLY",
              fill=(236, 211, 169))
    draw.text((pad, 44), "ORIGINAL DARK | CANDIDATE DARK | ORIGINAL PAPER | CANDIDATE PAPER",
              fill=(171, 170, 168))
    pairs = (
        (original, (23, 30, 40), "BEFORE / DARK"),
        (candidate, (23, 30, 40), "ALPHA CLEAN / DARK"),
        (original, (216, 201, 183), "BEFORE / PAPER"),
        (candidate, (216, 201, 183), "ALPHA CLEAN / PAPER"),
    )
    for row, (atlas, bg, label) in enumerate(pairs):
        for n, pose in enumerate(poses):
            x = pad + n * (scale + step)
            y = 80 + row * (scale + 36)
            cropped = atlas.crop((n * CELL, 0, (n + 1) * CELL, CELL))
            art = cropped.resize((scale, scale), Image.Resampling.LANCZOS)
            ground = Image.new("RGBA", (scale, scale), (*bg, 255))
            ground.alpha_composite(art)
            board.paste(ground.convert("RGB"), (x, y))
            draw.rectangle((x, y, x + scale - 1, y + scale - 1), outline=(116, 104, 91))
            draw.text((x + 3, y + scale + 4), f"{n+1}. {label} · {pose[:18]}", fill=(229, 205, 175))
    board.save(path, optimize=True)


def run(root: Path, out: Path) -> dict:
    root, out = root.resolve(), out.resolve()
    atlas_manifest = json.loads((root / "game/assets/art/hd-painted-v1/manifest.json").read_text())
    roster = json.loads((root / "assets/art/roster-keystone/roster.json").read_text())
    intake = json.loads((root / f"assets/art/roster-keystone/{BOSS}-hd-intake.json").read_text())
    row = [r for r in roster["identities"] if r.get("id") == BOSS and r.get("kind") == "named-boss"]
    if len(row) != 1 or row[0]["assetInGit"] is not True or row[0]["visualApproval"] != "pending":
        raise ValueError("Roster Keystone changed or art was approved before preview")
    record = atlas_manifest["actors"][BOSS]
    if intake["bossId"] != BOSS or record["sha256"] != intake["sixKeyAtlasSha256"]:
        raise ValueError("Original painting manifest / intake mismatch")
    original_png = root / "game/assets/art/hd-painted-v1" / record["file"]
    painted_master = root / f"assets/art/hd-painted-boss-review-v1/{BOSS}/{BOSS}-six-poses-original.png"
    if sha256(original_png.read_bytes()) != record["sha256"] or \
            sha256(painted_master.read_bytes()) != intake["sourceSha256"]:
        raise ValueError("Git-tracked original art SHA-256 changed")
    with Image.open(original_png) as png:
        original = png.convert("RGBA")
    if original.size != (6 * CELL, CELL) or len(record["poses"]) != 6:
        raise ValueError("Unexpected source atlas dimensions")
    out.mkdir(parents=True, exist_ok=True)
    candidate = Image.new("RGBA", original.size, (0, 0, 0, 0))
    heatmap = Image.new("RGBA", original.size, (0, 0, 0, 0))
    by_pose = []
    for n, pose in enumerate(record["poses"]):
        area = (n * CELL, 0, (n + 1) * CELL, CELL)
        cleaned, highlights, metrics = clean_cell(original.crop(area))
        candidate.paste(cleaned, (area[0], area[1]))
        heatmap.paste(highlights, (area[0], area[1]))
        by_pose.append({"pose": pose, **metrics})
    if candidate.convert("RGB").tobytes() != original.convert("RGB").tobytes():
        raise AssertionError("Global RGB preservation failed")
    old_alpha, new_alpha = original.getchannel("A").tobytes(), candidate.getchannel("A").tobytes()
    count = sum(before != after for before, after in zip(old_alpha, new_alpha))
    if count != sum(p["clearedPixels"] for p in by_pose):
        raise AssertionError("Diff did not match red hotspot receipt")
    result_file = out / "furnace-abbot-alpha-candidate.png"
    candidate.save(result_file, optimize=True)
    heatmap.save(out / "furnace-abbot-alpha-hotspots.png", optimize=True)
    proof_board(original, candidate, record["poses"], out / "furnace-abbot-alpha-before-after.png")
    receipt = {
        "schema": "jrpg-hd-furnace-alpha-haze-candidate/1",
        "bosssId": BOSS,
        "provenance": {"sourcePaintingSha256": intake["sourceSha256"],
                       "originalSixPoseAtlasSha256": record["sha256"]},
        "candidateSha256": sha256(result_file.read_bytes()),
        "originalRgbSha256": sha256(original.convert("RGB").tobytes()),
        "candidateRgbSha256": sha256(candidate.convert("RGB").tobytes()),
        "originalAlphaSha256": sha256(old_alpha),
        "candidateAlphaSha256": sha256(new_alpha),
        "parameters": {"alphaMax": MAX_ALPHA, "strongAlphaMin": STRONG_ALPHA,
                       "guardRadiusChebyshevPx": GUARD_RADIUS},
        "alphaPixelsCleared": count,
        "poseMetrics": by_pose,
        "canonicalVisualApproval": "pending",
        "outputAuthority": "downloadable review-only artifact; no runtime write or animation rehash",
    }
    (out / "furnace-abbot-alpha-receipt.json").write_text(
        json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"alphaPixelsCleared": count, "poses": by_pose,
                      "originalSourceSha256": record["sha256"],
                      "originalPixelsUnchangedInGit": True}, indent=2))
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path,
                        default=ROOT / "artifacts/hd-furnace-alpha-haze")
    args = parser.parse_args()
    run(args.root, args.output_dir)


if __name__ == "__main__":
    main()
