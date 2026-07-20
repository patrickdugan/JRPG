#!/usr/bin/env python3
"""Build the deterministic 25-item Camp icon atlas and review sheet."""

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
SOURCE_PATH = ROOT / "item-icon-suite.source.json"
ATLAS_PATH = ROOT / "item-icon-atlas.png"
CONTACT_PATH = ROOT / "item-icon-contact-sheet.png"
MANIFEST_PATH = ROOT / "manifest.json"
RUNTIME_PATH = REPO / "game" / "assets" / "art" / "item-icon-suite" / "item-icon-atlas.png"
CELL = 16
COLUMNS = 5
ITEM_IDS = (
    "courier-saber", "warding-brush", "salt-etched-rapier", "dusk-censer", "cedar-maul",
    "pilgrim-knife", "dawnsteel-blade", "bellglass-focus", "quilted-haori", "river-silk-robe",
    "bell-iron-lamellar", "ash-lacquer-coat", "dawn-thread-mantle", "road-sandals", "lantern-bead-cord",
    "frostglass-pin", "storm-kite-toggle", "iron-knot", "cedar-route-note", "temple-charm",
    "river-salve", "ward-tonic", "spirit-tea", "dawn-salt", "traveler-plum",
)


def rgba(value: str) -> tuple[int, int, int, int]:
    value = value.removeprefix("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (255,)


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def alpha_bounds(image: Image.Image) -> list[int] | None:
    bounds = image.getchannel("A").getbbox()
    return list(bounds) if bounds else None


def load_source() -> dict:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    if source.get("authorship") != "original-code-native-pixel-primitives":
        raise ValueError("Item icons must retain original code-native authorship")
    if source.get("frame") != {"width": 16, "height": 16, "transparentGutter": 1}:
        raise ValueError("Item icon geometry drifted")
    if source.get("sheet") != {"columns": 5, "rows": 5}:
        raise ValueError("Item icon sheet must remain 5 x 5")
    items = source.get("items", [])
    if tuple(item.get("id") for item in items) != ITEM_IDS:
        raise ValueError("Item icon order must match the live item catalogue")
    if len({item.get("motif") for item in items}) != len(ITEM_IDS):
        raise ValueError("Every live item needs a distinct motif")
    for item in items:
        if set(item.get("palette", {})) != {"outline", "shadow", "body", "light", "accent"}:
            raise ValueError(f"Incomplete palette for {item['id']}")
    restricted = " ".join(source.get("restrictions", [])).lower()
    if "never as a sacred collectible" not in restricted:
        raise ValueError("Secular reward-art restriction must remain explicit")
    return source


def draw_icon(item: dict) -> Image.Image:
    image = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    colors = {name: rgba(value) for name, value in item["palette"].items()}
    rect = lambda box, key: draw.rectangle(box, fill=colors[key])
    line = lambda points, key, width=1: draw.line(points, fill=colors[key], width=width)
    poly = lambda points, key: draw.polygon(points, fill=colors[key])
    motif = item["motif"]

    if motif == "saber":
        line([(3, 13), (12, 4)], "outline", 3); line([(3, 13), (12, 4)], "body")
        line([(10, 3), (13, 6)], "light", 2); line([(3, 10), (6, 13)], "accent", 2); rect((2, 13, 4, 14), "shadow")
    elif motif == "brush":
        line([(4, 13), (10, 3)], "outline", 3); line([(4, 13), (10, 3)], "body")
        poly([(9, 2), (13, 2), (11, 7)], "outline"); poly([(10, 3), (12, 3), (11, 6)], "light"); rect((3, 12, 5, 14), "accent")
    elif motif == "rapier":
        line([(3, 13), (13, 3)], "outline", 3); line([(3, 13), (13, 3)], "light")
        line([(2, 10), (6, 13)], "accent", 2); rect((1, 12, 3, 14), "shadow"); rect((12, 2, 14, 4), "body")
    elif motif == "censer":
        line([(4, 2), (7, 7), (10, 9)], "accent"); rect((3, 1, 5, 3), "light")
        poly([(7, 8), (12, 8), (14, 11), (12, 14), (8, 14), (6, 11)], "outline")
        rect((8, 9, 12, 12), "body"); rect((9, 9, 11, 10), "light"); rect((9, 13, 11, 14), "shadow")
    elif motif == "maul":
        line([(4, 13), (10, 5)], "outline", 3); line([(4, 13), (10, 5)], "body")
        poly([(6, 2), (13, 3), (14, 7), (7, 6)], "outline"); rect((7, 3, 12, 5), "light"); rect((7, 6, 12, 7), "shadow")
    elif motif == "knife":
        poly([(4, 12), (10, 3), (13, 2), (11, 7), (6, 13)], "outline")
        poly([(7, 10), (10, 4), (12, 3), (10, 7)], "light"); rect((3, 11, 6, 13), "accent"); rect((2, 13, 4, 14), "shadow")
    elif motif == "greatsword":
        line([(3, 13), (12, 3)], "outline", 4); line([(4, 12), (12, 3)], "body", 2)
        line([(11, 2), (13, 5)], "light", 2); line([(2, 10), (7, 13)], "accent", 2); rect((2, 12, 4, 14), "shadow")
    elif motif == "focus":
        poly([(8, 1), (13, 5), (11, 12), (8, 14), (4, 11), (3, 5)], "outline")
        poly([(8, 3), (11, 5), (10, 10), (8, 12), (5, 10), (5, 6)], "body"); poly([(8, 3), (10, 5), (7, 9), (5, 8)], "light"); rect((7, 12, 9, 14), "accent")
    elif motif == "haori":
        poly([(4, 2), (7, 1), (9, 1), (12, 3), (14, 8), (12, 10), (11, 14), (5, 14), (4, 10), (2, 8)], "outline")
        poly([(5, 3), (7, 2), (8, 5), (9, 2), (11, 4), (12, 8), (10, 9), (10, 13), (6, 13), (6, 9), (4, 8)], "body"); line([(8, 5), (8, 13)], "accent")
    elif motif == "robe":
        poly([(5, 2), (8, 1), (11, 3), (12, 7), (14, 13), (9, 14), (3, 13), (5, 7)], "outline")
        poly([(6, 3), (8, 2), (10, 4), (10, 7), (12, 12), (9, 13), (5, 12), (6, 7)], "body"); line([(7, 4), (10, 7)], "light"); line([(5, 10), (11, 10)], "accent")
    elif motif == "lamellar":
        poly([(4, 2), (12, 2), (14, 6), (12, 14), (4, 14), (2, 6)], "outline")
        rect((4, 3, 11, 12), "body"); line([(4, 6), (11, 6)], "accent"); line([(4, 9), (11, 9)], "accent"); line([(6, 3), (6, 12)], "light"); line([(9, 3), (9, 12)], "shadow")
    elif motif == "coat":
        poly([(4, 2), (7, 1), (9, 1), (12, 3), (13, 13), (9, 14), (8, 10), (7, 14), (3, 13)], "outline")
        poly([(5, 3), (7, 2), (8, 5), (9, 2), (11, 4), (11, 12), (9, 13), (8, 8), (7, 13), (5, 12)], "body"); rect((9, 6, 10, 7), "light"); rect((6, 8, 7, 9), "accent")
    elif motif == "mantle":
        poly([(3, 4), (7, 1), (10, 2), (14, 6), (12, 14), (8, 12), (4, 14), (2, 7)], "outline")
        poly([(4, 5), (7, 3), (9, 3), (12, 6), (11, 12), (8, 10), (5, 12), (4, 7)], "body"); line([(5, 5), (11, 6)], "light"); rect((7, 3, 8, 4), "accent")
    elif motif == "sandals":
        poly([(2, 5), (6, 3), (8, 5), (6, 11), (2, 12), (1, 9)], "outline"); poly([(9, 4), (13, 3), (14, 6), (13, 12), (9, 13), (8, 9)], "outline")
        poly([(3, 6), (6, 5), (6, 9), (3, 10)], "body"); poly([(10, 5), (13, 5), (13, 10), (10, 11)], "body"); line([(3, 6), (6, 9)], "light"); line([(10, 5), (13, 9)], "light")
    elif motif == "beads":
        line([(4, 4), (2, 8), (5, 13), (10, 13), (13, 9), (12, 4), (8, 2), (4, 4)], "outline", 2)
        for x, y in ((4,4),(2,8),(5,13),(10,13),(13,9),(12,4),(8,2)): rect((x, y, x+1, y+1), "body")
        rect((7, 8, 9, 10), "accent"); rect((8, 8, 8, 8), "light")
    elif motif == "pin":
        poly([(8, 1), (13, 6), (10, 11), (8, 14), (6, 11), (3, 6)], "outline")
        poly([(8, 3), (11, 6), (9, 10), (8, 12), (6, 9), (5, 6)], "body"); poly([(8, 3), (9, 6), (7, 8), (5, 6)], "light"); rect((7, 13, 9, 14), "accent")
    elif motif == "toggle":
        poly([(8, 1), (14, 7), (8, 13), (2, 7)], "outline"); poly([(8, 3), (12, 7), (8, 11), (4, 7)], "body")
        line([(8, 3), (8, 11)], "light"); line([(4, 7), (12, 7)], "accent"); rect((7, 13, 9, 14), "shadow")
    elif motif == "knot":
        line([(3, 4), (12, 13)], "outline", 3); line([(12, 4), (3, 13)], "outline", 3)
        line([(4, 4), (12, 12)], "body"); line([(11, 4), (3, 12)], "light"); rect((6, 6, 9, 9), "accent"); rect((7, 7, 8, 8), "shadow")
    elif motif == "note":
        poly([(3, 2), (11, 1), (14, 4), (12, 14), (3, 13)], "outline"); poly([(4, 3), (10, 2), (12, 4), (11, 12), (4, 12)], "body")
        line([(6, 5), (10, 5)], "accent"); line([(5, 7), (10, 7)], "shadow"); line([(5, 9), (8, 9)], "shadow"); rect((10, 2, 12, 4), "light")
    elif motif == "registry-token":
        poly([(4, 2), (12, 2), (14, 5), (13, 13), (10, 14), (3, 12), (2, 5)], "outline")
        poly([(5, 3), (11, 3), (12, 5), (11, 12), (9, 13), (4, 11), (4, 5)], "body"); rect((6, 5, 10, 6), "light"); line([(5, 9), (10, 8)], "accent", 2)
    elif motif == "salve":
        rect((5, 2, 11, 4), "outline"); rect((6, 2, 10, 3), "light"); poly([(4, 5), (12, 5), (14, 8), (12, 14), (4, 14), (2, 8)], "outline")
        rect((4, 7, 12, 12), "body"); rect((5, 7, 11, 8), "light"); rect((7, 9, 9, 11), "accent")
    elif motif == "tonic":
        rect((6, 1, 10, 4), "outline"); rect((7, 1, 9, 3), "light"); poly([(5, 4), (11, 4), (13, 7), (12, 14), (4, 14), (3, 7)], "outline")
        poly([(5, 6), (11, 6), (11, 12), (5, 12)], "body"); rect((6, 6, 10, 7), "light"); line([(6, 10), (10, 8)], "accent", 2)
    elif motif == "tea":
        poly([(2, 6), (11, 6), (12, 12), (9, 14), (4, 14), (2, 11)], "outline"); rect((3, 7, 10, 11), "body"); rect((4, 7, 9, 8), "light")
        line([(11, 8), (13, 8), (13, 12), (11, 12)], "outline", 2); line([(5, 4), (6, 2)], "accent"); line([(8, 4), (9, 2)], "accent")
    elif motif == "packet":
        poly([(3, 2), (12, 2), (14, 5), (12, 14), (3, 14), (1, 5)], "outline"); poly([(4, 3), (11, 3), (12, 5), (11, 12), (4, 12), (3, 5)], "body")
        line([(4, 5), (11, 5)], "light"); poly([(8, 7), (10, 9), (8, 11), (6, 9)], "accent")
    elif motif == "plum":
        poly([(4, 5), (7, 3), (11, 4), (14, 8), (12, 13), (8, 14), (3, 12), (2, 8)], "outline"); poly([(5, 6), (8, 4), (11, 5), (12, 8), (11, 12), (8, 13), (4, 11), (4, 8)], "body")
        rect((5, 6, 7, 7), "light"); line([(8, 4), (10, 1)], "accent", 2); rect((10, 1, 12, 2), "accent")
    else:
        raise ValueError(f"Unsupported item motif {motif}")

    bounds = alpha_bounds(image)
    if bounds is None or bounds[0] < 1 or bounds[1] < 1 or bounds[2] > 15 or bounds[3] > 15:
        raise ValueError(f"Icon {item['id']} violates the one-pixel transparent gutter: {bounds}")
    return image


def build_outputs(source: dict) -> dict[Path, bytes]:
    rows = len(ITEM_IDS) // COLUMNS
    atlas = Image.new("RGBA", (CELL * COLUMNS, CELL * rows), (0, 0, 0, 0))
    frames = []
    frame_hashes = set()
    for index, item in enumerate(source["items"]):
        column, row = index % COLUMNS, index // COLUMNS
        frame = draw_icon(item)
        frame_hash = sha256(frame.tobytes())
        if frame_hash in frame_hashes:
            raise ValueError(f"Duplicate icon frame for {item['id']}")
        frame_hashes.add(frame_hash)
        atlas.alpha_composite(frame, (column * CELL, row * CELL))
        frames.append({
            "id": item["id"], "motif": item["motif"],
            "rect": [column * CELL, row * CELL, CELL, CELL],
            "localAlphaBounds": alpha_bounds(frame), "rgbaSha256": frame_hash,
        })

    atlas_data = png_bytes(atlas)
    scale, margin, label_h, gap = 7, 18, 22, 12
    tile_w, tile_h = CELL * scale, CELL * scale
    contact = Image.new("RGBA", (
        margin * 2 + COLUMNS * tile_w + (COLUMNS - 1) * gap,
        margin * 2 + rows * (tile_h + label_h) + (rows - 1) * gap,
    ), rgba("#151b2b"))
    contact_draw = ImageDraw.Draw(contact)
    font = ImageFont.load_default()
    for index, item in enumerate(source["items"]):
        column, row = index % COLUMNS, index // COLUMNS
        x = margin + column * (tile_w + gap)
        y = margin + row * (tile_h + label_h + gap)
        for checker_y in range(y, y + tile_h, 8):
            for checker_x in range(x, x + tile_w, 8):
                fill = "#263044" if ((checker_x // 8) + (checker_y // 8)) % 2 else "#344058"
                contact_draw.rectangle((checker_x, checker_y, checker_x + 7, checker_y + 7), fill=rgba(fill))
        frame = atlas.crop((column * CELL, row * CELL, (column + 1) * CELL, (row + 1) * CELL))
        contact.alpha_composite(frame.resize((tile_w, tile_h), Image.Resampling.NEAREST), (x, y))
        label = item["id"][:18]
        contact_draw.text((x + 2, y + tile_h + 6), label, font=font, fill=rgba("#f6e8b9"))
    contact_data = png_bytes(contact)

    manifest = {
        "assetId": source["assetId"], "status": "production-foundation-review",
        "authorship": source["authorship"],
        "runtimeIntegration": "camp-inventory-and-shop-decorative-icons-with-text-fallback",
        "geometry": {
            "frameWidth": CELL, "frameHeight": CELL, "columns": COLUMNS, "rows": rows,
            "sheetWidth": atlas.width, "sheetHeight": atlas.height, "transparentGutter": 1,
        },
        "itemOrder": list(ITEM_IDS), "frames": frames,
        "exports": [
            {"file": ATLAS_PATH.name, "purpose": "transparent-runtime-atlas", "width": atlas.width, "height": atlas.height, "sha256": sha256(atlas_data)},
            {"file": CONTACT_PATH.name, "purpose": "labeled-review-only-not-runtime", "width": contact.width, "height": contact.height, "sha256": sha256(contact_data)},
        ],
        "restrictions": source["restrictions"],
    }
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return {ATLAS_PATH: atlas_data, CONTACT_PATH: contact_data, MANIFEST_PATH: manifest_data, RUNTIME_PATH: atlas_data}


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
        print("item icon suite is deterministic and current")
        return 0
    for path, data in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        print(f"wrote {path.relative_to(REPO)} ({len(data)} bytes, sha256 {sha256(data)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
