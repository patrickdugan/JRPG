#!/usr/bin/env python3
"""Non-destructive HD boss art diagnostics for human visual review.

Reports neutral-color matte edge suspects, alpha crop flags, and temporal
frame-discontinuity metrics. Source art, Roster Keystone and gameplay stay
unchanged. None of the metrics can grant or revoke manual art approval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import statistics
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageStat

IDS = (
    "captain-kaji", "widow-of-fog", "furnace-abbot", "ujiro",
    "bell-warden-chiyo", "lady-enma", "yearless-bell",
)
CLIPS = (
    "idle", "locomotion", "windup", "active", "recovery", "guard",
    "hurt", "defeat", "signature", "stagger",
)
LOOPING = frozenset(("idle", "locomotion", "guard"))
FRAME = 192
ROOT = Path(__file__).resolve().parents[2]
RISK = ("lady-enma", "yearless-bell", "furnace-abbot")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def assert_source_hash(path: Path, expected: str) -> None:
    if sha256(path.read_bytes()) != expected:
        raise ValueError("Committed art SHA-256 mismatch: " + str(path))


def rgb_brightness(rgb) -> float:
    r, g, b = rgb[:3]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def fringe_metrics(tile: Image.Image) -> dict:
    """Count neutral matte-like fringe pixels near solid silhouette pixels.

    Bright clothes and inked linework may trigger these heuristics; only an
    artist examining the original artwork can determine whether it is a flaw.
    """
    im = tile.convert("RGBA")
    pixels = im.load()
    w, h = im.size
    directions = [(d, 0) for d in (-2, -1, 1, 2)] + [(0, d) for d in (-2, -1, 1, 2)]
    candidates = white = charcoal = 0
    for y in range(h):
        for x in range(w):
            p = pixels[x, y]
            if not 16 <= p[3] <= 239:
                continue
            chosen = None
            for dx, dy in directions:
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h:
                    neighbor = pixels[xx, yy]
                    if neighbor[3] >= 248:
                        chosen = neighbor
                        break
            if chosen is None:
                continue
            candidates += 1
            c, inside = rgb_brightness(p), rgb_brightness(chosen)
            neutral = max(p[:3]) - min(p[:3]) <= 32
            if neutral and c >= 220 and inside <= 165 and c - inside >= 65:
                white += 1
            if neutral and c <= 48 and inside >= 120 and inside - c >= 65:
                charcoal += 1
    alpha = im.getchannel("A")
    opaque = alpha.point(lambda value: 255 if value >= 224 else 0)
    clipped = {
        "left": any(opaque.getpixel((0, y)) for y in range(h)),
        "right": any(opaque.getpixel((w - 1, y)) for y in range(h)),
        "top": any(opaque.getpixel((x, 0)) for x in range(w)),
        "bottom": any(opaque.getpixel((x, h - 1)) for x in range(w)),
    }
    corner = max(1, min(24, w // 8, h // 8))
    corners = (
        (0, 0, corner, corner), (w - corner, 0, w, corner),
        (0, h - corner, corner, h), (w - corner, h - corner, w, h),
    )
    corner_opaque = sum(
        sum(alpha.crop(box).histogram()[224:]) for box in corners
    )
    return {
        "eligibleEdgePixels": candidates,
        "brightMatteSuspects": white,
        "darkMatteSuspects": charcoal,
        "suspectRatio": round((white + charcoal) / max(candidates, 1), 5),
        "opaqueCornerFraction": round(corner_opaque / (4 * corner * corner), 5),
        "touchesCellBoundary": clipped,
        "opaqueBounds": opaque.getbbox(),
    }


def alpha_bounds(frame: Image.Image, cutoff: int = 64):
    alpha = frame.getchannel("A")
    return alpha.point(lambda a: 255 if a >= cutoff else 0).getbbox()


def visual_delta(first: Image.Image, second: Image.Image) -> float:
    """Mean difference over three RGB channels on a neutral background."""
    def flatten(frame):
        backing = Image.new("RGBA", frame.size, (88, 88, 88, 255))
        backing.alpha_composite(frame.convert("RGBA"))
        return backing.convert("RGB")
    a, b = flatten(first), flatten(second)
    return round(statistics.mean(ImageStat.Stat(ImageChops.difference(a, b)).mean), 3)


def analyze_clip(atlas: Image.Image, hashes: list[str]) -> dict:
    if atlas.size != (2304, 384) or len(hashes) != 24:
        raise ValueError("Invalid 24-frame 12x2 WebP geometry")
    frames = []
    for n in range(24):
        x, y = (n % 12) * FRAME, (n // 12) * FRAME
        frame = atlas.crop((x, y, x + FRAME, y + FRAME)).convert("RGBA")
        if sha256(frame.tobytes()) != hashes[n]:
            raise ValueError("Decoded WebP frame hash mismatch at index " + str(n))
        frames.append(frame)
    positions = []
    for frame in frames:
        box = alpha_bounds(frame)
        positions.append({
            "xMid": (box[0] + box[2]) / 2 if box else None,
            "bottom": box[3] if box else None,
            "bounds": box,
        })
    delta = [visual_delta(frames[i], frames[i + 1]) for i in range(23)]
    seam = visual_delta(frames[-1], frames[0])
    worst = max(range(23), key=lambda i: delta[i])
    foot_steps = [abs(positions[i + 1]["bottom"] - positions[i]["bottom"])
                  for i in range(23) if positions[i]["bottom"] is not None
                  and positions[i + 1]["bottom"] is not None]
    x_steps = [abs(positions[i + 1]["xMid"] - positions[i]["xMid"])
               for i in range(23) if positions[i]["xMid"] is not None
               and positions[i + 1]["xMid"] is not None]
    median = statistics.median(delta)
    return {
        "meanAdjacentRGBDelta": round(statistics.mean(delta), 3),
        "medianAdjacentRGBDelta": round(median, 3),
        "maxAdjacentRGBDelta": delta[worst],
        "maxAdjacentPair": [worst + 1, worst + 2],
        "loopSeamRGBDelta": seam,
        "seamToMedianRatio": round(seam / max(0.5, median), 3),
        "maxAdjacentFootStepPx": max(foot_steps, default=0),
        "maxAdjacentXMidStepPx": max(x_steps, default=0),
        "sourceDerivedCells": 24,
    }


def create_alpha_contact(atlas: Image.Image, poses: list[str], name: str, output: Path) -> None:
    """Show six key poses on both dark and paper backgrounds."""
    tile_size, gutter = 224, 14
    start_x, start_y = 30, 85
    sheet = Image.new("RGB", (6 * (tile_size + gutter) + 46, 2 * (tile_size + 36) + 125), (16, 21, 28))
    draw = ImageDraw.Draw(sheet)
    draw.text((start_x, 18), name.upper() + " / SIX-KEY MATTE DIAGNOSTIC", fill=(231, 205, 166))
    draw.text((start_x, 43), "DARK STAGE / WARM PAPER STAGE", fill=(164, 162, 156))
    for i, pose in enumerate(poses):
        src = atlas.crop((384 * i, 0, 384 * (i + 1), 384)).convert("RGBA")
        scaled = src.resize((tile_size, tile_size), Image.Resampling.LANCZOS)
        for row, color in enumerate(((25, 32, 42), (216, 202, 180))):
            x = start_x + i * (tile_size + gutter)
            y = start_y + row * (tile_size + 36)
            ground = Image.new("RGBA", (tile_size, tile_size), (*color, 255))
            ground.alpha_composite(scaled)
            sheet.paste(ground.convert("RGB"), (x, y))
            draw.rectangle((x, y, x + tile_size - 1, y + tile_size - 1), outline=(112, 103, 89))
            draw.text((x + 2, y + tile_size + 4), f"{i + 1}. {pose[:26]}", fill=(225, 207, 181))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)


def run(root: Path, out: Path) -> dict:
    root, out = root.resolve(), out.resolve()
    keys = load_json(root / "game/assets/art/hd-painted-v1/manifest.json")
    motion = load_json(root / "game/assets/art/hd-painted-v1/motion-manifest.json")
    roster = load_json(root / "assets/art/roster-keystone/roster.json")
    if motion.get("motionClipCount") != 70 or motion.get("frameTotal") != 1680:
        raise ValueError("Seven-boss motion manifest incomplete")
    out.mkdir(parents=True, exist_ok=True)
    boss_reports = {}
    for id in IDS:
        record = keys["actors"][id]
        animator = motion["actors"][id]
        ledger = [x for x in roster["identities"] if x.get("id") == id and x.get("kind") == "named-boss"]
        if len(ledger) != 1 or ledger[0].get("visualApproval") != "pending":
            raise ValueError("Canonical visual approval has drifted for " + id)
        intake = load_json(root / f"assets/art/roster-keystone/{id}-hd-intake.json")
        source_path = root / f"assets/art/hd-painted-boss-review-v1/{id}/{id}-six-poses-original.png"
        key_path = root / "game/assets/art/hd-painted-v1" / record["file"]
        if intake["bossId"] != id or intake["sixKeyAtlasSha256"] != record["sha256"]:
            raise ValueError("Intake checksum mismatch for " + id)
        assert_source_hash(source_path, intake["sourceSha256"])
        assert_source_hash(key_path, record["sha256"])
        with Image.open(source_path) as im:
            original_mode, original_dims = im.mode, list(im.size)
        with Image.open(key_path) as im:
            atlas = im.convert("RGBA")
        if original_dims != [1536, 1024] or atlas.size != (2304, 384) or len(record["poses"]) != 6:
            raise ValueError("Six-pose master geometry invalid for " + id)
        pose_reports = {}
        for n, pose in enumerate(record["poses"]):
            tile = atlas.crop((n * 384, 0, (n + 1) * 384, 384))
            pose_reports[pose] = fringe_metrics(tile)
        create_alpha_contact(atlas, record["poses"], id, out / f"matte-contact-{id}.png")
        clip_reports = {}
        for name in CLIPS:
            clip = animator["clipSet"][name]
            if clip["frames"] != 24:
                raise ValueError("Unexpected clip length for " + id + "/" + name)
            path = root / "game/assets/art/hd-painted-v1" / clip["path"]
            assert_source_hash(path, clip["sha256"])
            with Image.open(path) as im:
                image = im.convert("RGBA")
            m = analyze_clip(image, clip["frameRGBAsha256"])
            m["frameMs"], m["sourcePose"] = clip["frameMs"], clip["sourcePose"]
            m["loopExpected"] = name in LOOPING
            m["seamReviewCandidate"] = (
                name in LOOPING and m["loopSeamRGBDelta"] >= 5.0
                and m["seamToMedianRatio"] >= 2.0
            )
            clip_reports[name] = m
        boss_reports[id] = {
            "original": {"path": str(source_path.relative_to(root)), "mode": original_mode,
                         "pixels": original_dims, "sha256": intake["sourceSha256"]},
            "keyAtlas": {"path": str(key_path.relative_to(root)), "sha256": record["sha256"]},
            "canonicalVisualApproval": "pending",
            "manualMattePriority": id in RISK,
            "poseMetrics": pose_reports, "clipMetrics": clip_reports,
        }
    worst = sorted((
        {"id": id, "clip": name, "maxAdjacentRGBDelta": metrics["maxAdjacentRGBDelta"],
         "maxAdjacentPair": metrics["maxAdjacentPair"],
         "seamReviewCandidate": metrics["seamReviewCandidate"]}
        for id, data in boss_reports.items()
        for name, metrics in data["clipMetrics"].items()
    ), key=lambda item: -item["maxAdjacentRGBDelta"])
    metrics = {
        "schema": "jrpg-hd-boss-optical-diagnostics/1",
        "scope": "automated-heuristics-for-human-review",
        "sourcePreservation": "all original SHA-256 and decoded 24-frame hashes validated",
        "canonicalVisualApproval": "pending-for-all-seven",
        "clipCount": 70, "frameCount": 1680, "bosses": boss_reports,
        "rankedTransitionCandidates": worst,
    }
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    lines = ["# Seven-boss optical QA diagnostics", "",
             "Automated heuristics for manual art review. All canonical visual approvals remain pending.", "",
             "All seven original paintings, six-key PNGs, and seventy WebP strips matched their SHA-256 receipts.", "",
             "## Matte edge candidates", "",
             "| Boss | Bright fringe pixels | Dark fringe pixels | Opaque corner pixels (%) |",
             "| --- | ---: | ---: | ---: |"]
    for id in IDS:
        poses = boss_reports[id]["poseMetrics"].values()
        bright = sum(x["brightMatteSuspects"] for x in poses)
        dark = sum(x["darkMatteSuspects"] for x in poses)
        max_corner = max(x["opaqueCornerFraction"] for x in poses)
        lines.append(f"| {id} | {bright} | {dark} | {max_corner * 100:.2f} |")
    lines += ["", "## Largest adjacent-frame differences", "",
              "| Boss | Clip | Frames | Mean RGB difference (0-255) |",
              "| --- | --- | --- | ---: |"]
    for row in worst[:15]:
        lines.append(f"| {row['id']} | {row['clip']} | {row['maxAdjacentPair'][0]}–{row['maxAdjacentPair'][1]} | {row['maxAdjacentRGBDelta']:.3f} |")
    seams = [(id, name, clip) for id, report in boss_reports.items()
             for name, clip in report["clipMetrics"].items() if clip["seamReviewCandidate"]]
    lines += ["", f"## Suspected looping seams: {len(seams)}", ""]
    for id, name, clip in seams:
        lines.append(f"- {id}/{name}: seam RGB delta {clip['loopSeamRGBDelta']:.3f} vs median adjacent {clip['medianAdjacentRGBDelta']:.3f}")
    lines += ["", "**Interpretation:** neutral edge-color heuristics may flag naturally bright garments or inked outlines. "
             "Adjacent-frame pixel difference can rise during intended attacks. "
             "These scores prioritize where a human should inspect and cannot establish visual failure or approval.", ""]
    (out / "report.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts/hd-boss-optical-diagnostics")
    args = parser.parse_args()
    run(args.root, args.output_dir)


if __name__ == "__main__":
    main()
