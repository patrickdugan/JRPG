#!/usr/bin/env python3
"""Build deterministic transparent pixel overlays for every live field terrain tag."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
SOURCE_PATH = ROOT / "field-terrain-suite.source.json"
ATLAS_PATH = ROOT / "field-terrain-atlas.png"
CONTACT_PATH = ROOT / "field-terrain-contact-sheet.png"
MANIFEST_PATH = ROOT / "manifest.json"
README_PATH = ROOT / "README.md"
RUNTIME_PATH = REPO / "game" / "assets" / "art" / "field-terrain-suite" / ATLAS_PATH.name
CELL = 16
COLUMNS = 5


def color(value: str) -> tuple[int, int, int, int]:
    value = value.removeprefix("#")
    if len(value) == 6:
        value += "ff"
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4, 6))


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_source() -> dict:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    if source.get("authorship") != "original-code-native-pixel-primitives":
        raise ValueError("Field terrain must retain code-native authorship")
    if source.get("frame") != {"width": 16, "height": 16}:
        raise ValueError("Field terrain frame geometry drifted")
    if source.get("sheet") != {"columns": 5, "rows": 4}:
        raise ValueError("Field terrain sheet geometry drifted")
    terrain = source.get("terrainOrder", [])
    if len(terrain) != 19 or len(set(terrain)) != len(terrain) or terrain[0] != "stone":
        raise ValueError("Field terrain must cover the 19 live base/tag keys exactly once")
    restricted = " ".join(source.get("restrictions", [])).lower()
    for term in ("never define collision", "do not depict sacred objects", "fallback"):
        if term not in restricted:
            raise ValueError(f"Missing field-art boundary: {term}")
    return source


def draw_tile(tag: str) -> Image.Image:
    image = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    dark = color("#09101f70")
    shade = color("#26334f72")
    pale = color("#e9f2ff4f")
    water = color("#a9e5f078")
    ash = color("#d2c9c05a")
    ember = color("#ff956f86")
    gold = color("#e5bd6b73")
    paper = color("#efe2bc88")
    wood = color("#b58a6670")
    violet = color("#a393d073")
    red = color("#d7727c7a")

    if tag == "stone":
        draw.line([(0, 7), (15, 7)], fill=dark); draw.line([(5, 0), (5, 7)], fill=shade); draw.line([(11, 7), (11, 15)], fill=shade)
        draw.point((2, 2), fill=pale); draw.point((13, 11), fill=pale)
    elif tag == "wet-stone":
        draw.line([(0, 7), (15, 7)], fill=dark); draw.line([(5, 0), (5, 7)], fill=shade); draw.line([(11, 7), (11, 15)], fill=shade)
        draw.line([(2, 3), (5, 2)], fill=water); draw.line([(9, 11), (13, 10)], fill=water)
    elif tag == "shallow-puddle":
        draw.ellipse((1, 4, 14, 12), outline=water); draw.line([(4, 7), (11, 7)], fill=pale); draw.line([(6, 10), (9, 10)], fill=shade)
    elif tag == "paper-litter":
        draw.polygon([(2, 3), (7, 2), (8, 7), (3, 8)], fill=paper); draw.line([(4, 4), (7, 4)], fill=dark)
        draw.polygon([(10, 9), (14, 8), (13, 14), (9, 13)], fill=color("#b9a98a70"))
    elif tag == "cracked-board":
        draw.line([(0, 5), (15, 5), (15, 11), (0, 11)], fill=wood); draw.line([(7, 0), (7, 5), (5, 8), (9, 11), (9, 15)], fill=dark)
    elif tag == "swing-beam-lane":
        draw.rectangle((1, 6, 14, 9), fill=wood); draw.line([(2, 6), (5, 9), (8, 6), (11, 9), (14, 6)], fill=pale); draw.point((2, 7), fill=dark); draw.point((13, 8), fill=dark)
    elif tag == "water":
        for y, offset in ((3, 0), (8, 3), (13, 1)):
            draw.line([(offset, y), (offset + 4, y), (offset + 6, y - 1), (min(15, offset + 11), y - 1)], fill=water)
    elif tag == "storm-water":
        draw.line([(0, 4), (4, 2), (9, 5), (15, 2)], fill=water, width=2); draw.line([(1, 12), (6, 9), (11, 12), (15, 10)], fill=pale); draw.line([(2, 7), (14, 7)], fill=dark)
    elif tag == "cold-pool":
        draw.ellipse((1, 2, 14, 14), outline=water); draw.line([(8, 3), (8, 13), (3, 8), (13, 8)], fill=pale); draw.line([(4, 4), (12, 12), (12, 4), (4, 12)], fill=shade)
    elif tag == "ash-field":
        for point in ((2, 3), (6, 11), (10, 5), (13, 13), (4, 7), (14, 2)):
            draw.rectangle((point[0], point[1], point[0] + 1, point[1] + 1), fill=ash)
        draw.line([(0, 15), (5, 13), (10, 15), (15, 13)], fill=shade)
    elif tag == "ember-ash":
        for point in ((3, 4), (11, 3), (7, 9), (13, 12), (2, 13)):
            draw.point(point, fill=ember); draw.point((point[0], min(15, point[1] + 1)), fill=ash)
        draw.line([(0, 7), (5, 8), (10, 6), (15, 8)], fill=shade)
    elif tag == "umbral-ash":
        draw.line([(0, 4), (4, 2), (8, 5), (12, 3), (15, 5)], fill=violet); draw.line([(0, 12), (4, 10), (8, 13), (13, 9), (15, 11)], fill=dark)
        draw.point((3, 7), fill=pale); draw.point((12, 14), fill=violet)
    elif tag == "bell-node":
        draw.ellipse((4, 3, 11, 10), outline=gold, width=2); draw.line([(4, 9), (3, 12), (12, 12), (11, 9)], fill=dark); draw.rectangle((7, 11, 8, 14), fill=gold)
    elif tag == "furnace-grate":
        draw.rectangle((1, 2, 14, 14), outline=dark); [draw.line([(x, 3), (x, 13)], fill=shade) for x in (4, 8, 12)]
        draw.line([(2, 6), (13, 6)], fill=ember); draw.line([(2, 10), (13, 10)], fill=ember)
    elif tag == "legal-seal":
        draw.rectangle((3, 3, 12, 12), outline=red, width=2); draw.line([(5, 6), (10, 6), (7, 4), (7, 11), (5, 9), (10, 9)], fill=red)
    elif tag == "flowing-water":
        draw.line([(0, 2), (4, 4), (8, 2), (12, 4), (15, 2)], fill=water); draw.line([(0, 8), (4, 10), (8, 8), (12, 10), (15, 8)], fill=pale)
        draw.line([(0, 14), (5, 12), (10, 14), (15, 12)], fill=water)
    elif tag == "high-gallery":
        draw.line([(1, 3), (14, 3), (14, 13), (1, 13), (1, 3)], fill=shade); draw.line([(4, 3), (4, 13), (8, 3), (8, 13), (12, 3), (12, 13)], fill=dark)
        draw.line([(2, 4), (13, 4)], fill=pale)
    elif tag == "archive-floor":
        draw.rectangle((1, 1, 7, 6), outline=wood); draw.rectangle((9, 2, 14, 8), outline=paper); draw.rectangle((3, 9, 11, 14), outline=shade)
        draw.line([(4, 11), (10, 11)], fill=paper)
    elif tag == "dry-lantern":
        draw.rectangle((5, 3, 10, 11), outline=gold); draw.line([(4, 3), (11, 3), (9, 1), (6, 1), (4, 3)], fill=dark); draw.line([(6, 6), (9, 6), (7, 4), (7, 10)], fill=gold)
        draw.rectangle((7, 12, 8, 14), fill=shade)
    else:
        raise ValueError(f"Unsupported live terrain tag: {tag}")
    if image.getchannel("A").getbbox() is None:
        raise ValueError(f"Terrain overlay is empty: {tag}")
    return image


def build_readme() -> bytes:
    text = """# Field terrain overlay suite

This directory contains one original, deterministic 16 x 16 transparent pixel overlay for the default field floor and every terrain tag used by the 48 live Campaign levels. The browser first paints the existing level-owned flat color, then may composite the matching overlay; art never becomes movement, collision, hazard, exit, or interaction authority.

`field-terrain-suite.source.json` owns the exact live tag order and boundaries. `build_field_terrain_suite.py` produces the transparent runtime atlas, a labeled review-only contact sheet, the manifest, and the byte-identical browser copy. Run it with `--check` to prove checked-in outputs are current.

Unknown tags, image failure, or a wrong-size image retain the existing flat-color/geometric renderer. The motifs are secular material reads only: paving, water, wood, ash, metal, paper, and invented court hardware. They contain no sacred objects, devotional symbols, real heraldry, text, or readable historical documents.
"""
    return text.encode("utf-8")


def build_outputs(source: dict) -> dict[Path, bytes]:
    terrain = source["terrainOrder"]
    atlas = Image.new("RGBA", (CELL * COLUMNS, CELL * source["sheet"]["rows"]), (0, 0, 0, 0))
    frames = []
    hashes = set()
    for index, tag in enumerate(terrain):
        frame = draw_tile(tag)
        frame_hash = sha256(frame.tobytes())
        if frame_hash in hashes:
            raise ValueError(f"Duplicate terrain overlay: {tag}")
        hashes.add(frame_hash)
        column, row = index % COLUMNS, index // COLUMNS
        atlas.alpha_composite(frame, (column * CELL, row * CELL))
        frames.append({
            "id": tag,
            "rect": [column * CELL, row * CELL, CELL, CELL],
            "rgbaSha256": frame_hash,
            "alphaBounds": list(frame.getchannel("A").getbbox()),
        })
    atlas_data = png_bytes(atlas)

    scale, margin, gap, label_h = 6, 16, 10, 18
    tile = CELL * scale
    rows = source["sheet"]["rows"]
    contact = Image.new("RGBA", (margin * 2 + COLUMNS * tile + (COLUMNS - 1) * gap, margin * 2 + rows * (tile + label_h) + (rows - 1) * gap), color("#151b2b"))
    contact_draw = ImageDraw.Draw(contact)
    font = ImageFont.load_default()
    for index, tag in enumerate(terrain):
        column, row = index % COLUMNS, index // COLUMNS
        x = margin + column * (tile + gap)
        y = margin + row * (tile + label_h + gap)
        base = color("#45516aff") if (column + row) % 2 else color("#38445cff")
        contact_draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=base)
        frame = atlas.crop((column * CELL, row * CELL, (column + 1) * CELL, (row + 1) * CELL))
        contact.alpha_composite(frame.resize((tile, tile), Image.Resampling.NEAREST), (x, y))
        contact_draw.text((x + 2, y + tile + 4), tag, font=font, fill=color("#f6e8b9ff"))
    contact_data = png_bytes(contact)

    manifest = {
        "assetId": source["assetId"],
        "status": "production-foundation-review",
        "authorship": source["authorship"],
        "runtimeIntegration": "campaign-decorative-overlays-over-level-owned-color-with-geometric-fallback",
        "coverage": {"liveLevelCount": 48, "liveTerrainKeys": len(terrain)},
        "geometry": {"frameWidth": CELL, "frameHeight": CELL, "columns": COLUMNS, "rows": rows, "sheetWidth": atlas.width, "sheetHeight": atlas.height},
        "terrainOrder": terrain,
        "frames": frames,
        "exports": [
            {"file": ATLAS_PATH.name, "purpose": "transparent-runtime-atlas", "width": atlas.width, "height": atlas.height, "sha256": sha256(atlas_data)},
            {"file": CONTACT_PATH.name, "purpose": "labeled-review-only-not-runtime", "width": contact.width, "height": contact.height, "sha256": sha256(contact_data)},
        ],
        "restrictions": source["restrictions"],
    }
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return {ATLAS_PATH: atlas_data, CONTACT_PATH: contact_data, MANIFEST_PATH: manifest_data, README_PATH: build_readme(), RUNTIME_PATH: atlas_data}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail when checked-in outputs are stale")
    args = parser.parse_args()
    outputs = build_outputs(load_source())
    if args.check:
        failures = [str(path) for path, expected in outputs.items() if not path.exists() or path.read_bytes() != expected]
        if failures:
            print("stale or missing: " + ", ".join(failures), file=sys.stderr)
            return 1
        print("field terrain suite is deterministic and current")
        return 0
    for path, data in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        print(f"wrote {path.relative_to(REPO)} ({len(data)} bytes, sha256 {sha256(data)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
