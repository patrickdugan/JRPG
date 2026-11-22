#!/usr/bin/env python3
"""Reversible matte RGB proposals, generated strictly outside the game runtime.

The masks and SHA-pinned imported originals are immutable. This script writes
optional side-by-side previews only; a human must examine every proposed change.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
# Profile-specific fringe hypotheses. No global foreground/background key.
PROFILES = {
    "lady-enma": "dark",
    "furnace-abbot": "bright",
    "yearless-bell": "bright",
    "captain-kaji": "bright",
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def luma(rgb) -> float:
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def find_neighbor(pixels, x: int, y: int, w: int, h: int):
    offsets = [(0, -1), (1, 0), (0, 1), (-1, 0),
               (0, -2), (2, 0), (0, 2), (-2, 0)]
    for dx, dy in offsets:
        xx, yy = x + dx, y + dy
        if 0 <= xx < w and 0 <= yy < h:
            neighbor = pixels[xx, yy]
            if neighbor[3] >= 248:
                return neighbor
    return None


def propose_matte_edge(tile: Image.Image, mode: str):
    """RGB-only conservative edge changes; alpha preserved exactly.

    This cannot repair opaque background contamination, and it can change
    intended painterly highlights. It is a review experiment, not production.
    """
    if mode not in ("bright", "dark"):
        raise ValueError("Unsupported matte hypothesis")
    src = tile.convert("RGBA")
    dst = src.copy()
    marks = Image.new("RGBA", src.size, (0, 0, 0, 0))
    before, after, heat = src.load(), dst.load(), marks.load()
    w, h = src.size
    changed = 0
    for y in range(h):
        for x in range(w):
            color = before[x, y]
            if not 16 <= color[3] <= 176:
                continue
            if max(color[:3]) - min(color[:3]) > 18:
                continue
            inner = find_neighbor(before, x, y, w, h)
            if inner is None:
                continue
            edge_luma, inner_luma = luma(color), luma(inner)
            if mode == "bright":
                qualifies = edge_luma >= 230 and inner_luma <= 155 and edge_luma - inner_luma >= 90
            else:
                qualifies = edge_luma <= 36 and inner_luma >= 145 and inner_luma - edge_luma >= 95
            if not qualifies:
                continue
            rgb = tuple(round(0.20 * color[c] + 0.80 * inner[c]) for c in range(3))
            if rgb == color[:3]:
                continue
            after[x, y] = (*rgb, color[3])
            heat[x, y] = (245, 78, 96, 255)
            changed += 1
    if src.getchannel("A").tobytes() != dst.getchannel("A").tobytes():
        raise AssertionError("Alpha changed in review-only matte preview")
    return dst, marks, changed


def contact_sheet(original: Image.Image, proposed: Image.Image,
                  name: str, changed: int, output: Path) -> None:
    tile_w, top, gutter = 218, 84, 12
    width = 6 * (tile_w + gutter) + 32
    height = 4 * (tile_w + 27) + 100
    board = Image.new("RGB", (width, height), (16, 21, 29))
    draw = ImageDraw.Draw(board)
    draw.text((16, 12), f"{name.upper()} / NON-RUNTIME MATTE EXPERIMENT", fill=(231, 205, 166))
    draw.text((16, 36), f"{changed} proposed RGB-only edge edits; ALPHA IDENTICAL; approval PENDING",
              fill=(178, 172, 160))
    backgrounds = [(29, 35, 45), (219, 205, 183)]
    for col in range(6):
        box = (384 * col, 0, 384 * (col + 1), 384)
        before = original.crop(box).resize((tile_w, tile_w), Image.Resampling.LANCZOS)
        after = proposed.crop(box).resize((tile_w, tile_w), Image.Resampling.LANCZOS)
        for row, (asset, color) in enumerate((
            (before, backgrounds[0]), (after, backgrounds[0]),
            (before, backgrounds[1]), (after, backgrounds[1])
        )):
            x = 16 + col * (tile_w + gutter)
            y = top + row * (tile_w + 27)
            bg = Image.new("RGBA", (tile_w, tile_w), (*color, 255))
            bg.alpha_composite(asset)
            board.paste(bg.convert("RGB"), (x, y))
            draw.rectangle((x, y, x + tile_w - 1, y + tile_w - 1), outline=(112, 103, 89))
            label = ["BEFORE / DARK", "PROPOSED / DARK", "BEFORE / PAPER", "PROPOSED / PAPER"][row]
            draw.text((x + 2, y + tile_w + 3), f"{col + 1} {label}", fill=(231, 207, 179))
    output.parent.mkdir(parents=True, exist_ok=True)
    board.save(output, optimize=True)


def run(root: Path, out: Path) -> dict:
    root, out = root.resolve(), out.resolve()
    manifest = json.loads((root / "game/assets/art/hd-painted-v1/manifest.json").read_text())
    roster = json.loads((root / "assets/art/roster-keystone/roster.json").read_text())
    out.mkdir(parents=True, exist_ok=True)
    entries = {}
    for id, mode in PROFILES.items():
        rows = [row for row in roster["identities"]
                if row["id"] == id and row["kind"] == "named-boss"]
        if len(rows) != 1 or rows[0]["visualApproval"] != "pending":
            raise ValueError("Art signoff gate changed for " + id)
        info = manifest["actors"][id]
        original_path = root / "game/assets/art/hd-painted-v1" / info["file"]
        if digest(original_path.read_bytes()) != info["sha256"]:
            raise ValueError("Original SHA-256 mismatch for " + id)
        with Image.open(original_path) as im:
            original = im.convert("RGBA")
        if original.size != (2304, 384):
            raise ValueError("Six pose geometry changed for " + id)
        output = original.copy()
        heatmap = Image.new("RGBA", original.size, (0, 0, 0, 0))
        per_pose = []
        for pose in range(6):
            box = (pose * 384, 0, (pose + 1) * 384, 384)
            new, marks, changed = propose_matte_edge(original.crop(box), mode)
            output.paste(new, box[:2])
            heatmap.paste(marks, box[:2])
            per_pose.append({"pose": info["poses"][pose], "changedPixels": changed})
        if output.getchannel("A").tobytes() != original.getchannel("A").tobytes():
            raise AssertionError("Global alpha changed for " + id)
        candidate_path = out / f"proposed-{id}.png"
        heatmap_path = out / f"hotspots-{id}.png"
        output.save(candidate_path, optimize=True)
        heatmap.save(heatmap_path, optimize=True)
        changes = sum(item["changedPixels"] for item in per_pose)
        contact_sheet(original, output, id, changes, out / f"comparison-{id}.png")
        entries[id] = {
            "mode": mode, "originalSha256": info["sha256"],
            "originalAlphaSha256": digest(original.getchannel("A").tobytes()),
            "candidateSha256": digest(candidate_path.read_bytes()),
            "candidateAlphaSha256": digest(output.getchannel("A").tobytes()),
            "changedPixels": changes, "poses": per_pose, "reviewOnly": True,
        }
    data = {
        "schema": "jrpg-hd-boss-matte-proposals/1", "canonicalArtApproval": "pending",
        "immutableOriginals": True, "changedAlphaPixels": 0, "bosses": entries,
    }
    (out / "proposals.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    lines = ["# Matte edge proposals (review-only)", "",
             "Original Git assets are unchanged. No candidate is approved or loaded by the game.", "",
             "| Boss | Hypothesis | Proposed RGB pixel edits | Alpha changes |",
             "| --- | --- | ---: | ---: |"]
    for id, entry in entries.items():
        lines.append(f"| {id} | {entry['mode']} fringe | {entry['changedPixels']} | 0 |")
    lines += ["", "Inspect the four comparison sheets, candidate atlases and hotspot PNGs.",
              "Salt spray, smoke and purple effects may be intentional; decide per pose manually.", ""]
    (out / "report.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return data


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=ROOT)
    ap.add_argument("--output-dir", type=Path, default=ROOT / "artifacts/hd-boss-matte-proposals")
    args = ap.parse_args()
    run(args.root, args.output_dir)


if __name__ == "__main__":
    main()
