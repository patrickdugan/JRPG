#!/usr/bin/env python3
"""Build the generic field-NPC atlas from deterministic pixel primitives."""

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
SOURCE_PATH = ROOT / "npc-field-suite.source.json"
ATLAS_PATH = ROOT / "npc-field-atlas.png"
CONTACT_PATH = ROOT / "npc-field-contact-sheet.png"
MANIFEST_PATH = ROOT / "manifest.json"
RUNTIME_PATH = REPO / "game" / "assets" / "art" / "npc-field-suite" / "npc-field-atlas.png"
CELL_W, CELL_H = 32, 48
ROLES = ("speaker", "interviewee", "confined-person", "courier")


def rgba(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (255,)


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_source() -> dict:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    assert source["authorship"] == "original-code-native-pixel-primitives"
    assert source["frame"] == {
        "width": CELL_W, "height": CELL_H, "pivot": [16, 44],
        "footPoint": [16, 44], "transparentGutter": 1,
    }
    assert tuple(source["sheet"]["columns"]) == ROLES
    assert source["sheet"]["rows"] == ["south-idle"]
    assert tuple(role["id"] for role in source["roleTaxonomy"]) == ROLES
    return source


def draw_person(role: dict) -> Image.Image:
    image = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shared = {
        "outline": "#0b1020", "deep": "#182238", "skinShadow": "#80583f",
        "skin": "#b97d58", "skinLight": "#d4a174", "foot": "#252630",
    }
    c = {name: rgba(value) for name, value in {**shared, **role["colors"]}.items()}
    rect = lambda box, fill: draw.rectangle(box, fill=c[fill])
    poly = lambda points, fill: draw.polygon(points, fill=c[fill])

    # Feet and registered ground contact. Rows 45-47 stay transparent.
    rect((8, 40, 14, 43), "outline")
    rect((18, 40, 24, 43), "outline")
    rect((9, 40, 14, 42), "foot")
    rect((18, 40, 23, 42), "foot")

    # Distinct, modest civilian silhouettes; neither carries a prop or symbol.
    if role["id"] == "speaker":
        poly([(7, 21), (11, 17), (21, 17), (25, 22), (23, 40), (9, 40)], "outline")
        poly([(9, 22), (12, 19), (20, 19), (23, 23), (21, 38), (11, 38)], "primary")
        poly([(11, 25), (16, 20), (21, 25), (20, 35), (12, 35)], "secondary")
        rect((6, 24, 9, 34), "outline")
        rect((7, 25, 9, 31), "primary")
        # Open hand is a conversation cue, not an item.
        rect((23, 24, 26, 31), "outline")
        rect((24, 25, 26, 28), "primary")
        rect((25, 29, 27, 31), "skin")
    elif role["id"] == "interviewee":
        poly([(6, 21), (10, 17), (22, 17), (26, 21), (23, 40), (9, 40)], "outline")
        poly([(8, 22), (11, 19), (21, 19), (24, 22), (21, 38), (11, 38)], "primary")
        poly([(7, 21), (12, 17), (20, 17), (25, 22), (22, 27), (10, 27)], "light")
        poly([(10, 27), (16, 24), (22, 27), (20, 37), (12, 37)], "secondary")
        rect((6, 24, 9, 33), "outline")
        rect((7, 25, 9, 31), "light")
        rect((23, 24, 26, 33), "outline")
        rect((23, 25, 25, 31), "light")
        rect((7, 32, 9, 34), "skin")
        rect((23, 32, 25, 34), "skin")
    elif role["id"] == "confined-person":
        # Close stance and lowered empty hands communicate confinement without
        # baking a cage, chain, or other prop into the person sprite.
        poly([(8, 22), (11, 18), (21, 18), (24, 23), (22, 40), (10, 40)], "outline")
        poly([(10, 23), (12, 20), (20, 20), (22, 24), (20, 38), (12, 38)], "primary")
        poly([(11, 25), (16, 22), (21, 25), (19, 36), (13, 36)], "secondary")
        rect((7, 25, 10, 35), "outline")
        rect((8, 26, 10, 33), "light")
        rect((22, 25, 25, 35), "outline")
        rect((22, 26, 24, 33), "light")
        rect((8, 34, 10, 36), "skin")
        rect((22, 34, 24, 36), "skin")
    else:
        # The unarmed courier leans into motion; the diagonal is a plain
        # satchel strap and deliberately carries no symbol or mark.
        poly([(8, 21), (12, 17), (23, 18), (26, 23), (23, 40), (10, 40)], "outline")
        poly([(10, 22), (13, 19), (22, 20), (24, 24), (21, 38), (12, 38)], "primary")
        poly([(11, 24), (16, 20), (22, 24), (20, 36), (13, 36)], "light")
        draw.line((12, 21, 22, 35), fill=c["outline"], width=3)
        draw.line((13, 21, 22, 34), fill=c["accent"], width=1)
        rect((19, 32, 24, 38), "outline")
        rect((20, 33, 23, 37), "secondary")
        rect((7, 24, 10, 33), "outline")
        rect((8, 25, 10, 31), "primary")
        rect((24, 25, 27, 33), "outline")
        rect((24, 26, 26, 31), "primary")
        rect((8, 32, 10, 34), "skin")
        rect((24, 32, 26, 34), "skin")

    # Original generic face and hair clusters.
    rect((10, 7, 22, 18), "outline")
    poly([(11, 9), (13, 6), (21, 7), (23, 10), (21, 17), (12, 17), (10, 13)], "skinShadow")
    rect((12, 9, 20, 16), "skin")
    rect((13, 8, 21, 11), "hair")
    rect((11, 10, 14, 14), "hair")
    rect((14, 13, 15, 14), "outline")
    rect((19, 13, 20, 14), "outline")
    rect((16, 16, 19, 16), "skinShadow")
    rect((20, 9, 21, 12), "skinLight")
    rect((14, 18, 19, 20), "outline")
    rect((15, 18, 18, 19), "skinShadow")

    # One-pixel cloth/material accents, intentionally non-symbolic.
    rect((12, 30, 12, 35), "light")
    rect((19, 29, 19, 34), "accent")
    return image


def alpha_bounds(image: Image.Image) -> list[int] | None:
    box = image.getchannel("A").getbbox()
    return list(box) if box else None


def build_outputs(source: dict) -> dict[Path, bytes]:
    atlas = Image.new("RGBA", (CELL_W * len(ROLES), CELL_H), (0, 0, 0, 0))
    frames = []
    for column, role_id in enumerate(ROLES):
        role = next(item for item in source["roleTaxonomy"] if item["id"] == role_id)
        frame = draw_person(role)
        atlas.alpha_composite(frame, (column * CELL_W, 0))
        frames.append({
            "id": f"{role_id}-south-idle", "role": role_id,
            "rect": [column * CELL_W, 0, CELL_W, CELL_H],
            "pivot": [16, 44], "footPoint": [16, 44],
            "localAlphaBounds": alpha_bounds(frame),
            "rgbaSha256": sha256(frame.tobytes()),
        })

    atlas_data = png_bytes(atlas)
    scale, margin, label_h = 7, 24, 28
    contact_w = margin * 2 + CELL_W * scale * len(ROLES)
    contact_h = margin * 2 + label_h + CELL_H * scale
    contact = Image.new("RGBA", (contact_w, contact_h), rgba("#151b2b"))
    contact_draw = ImageDraw.Draw(contact)
    checker = 8
    for y in range(margin + label_h, contact_h - margin, checker):
        for x in range(margin, contact_w - margin, checker):
            fill = "#263044" if ((x // checker) + (y // checker)) % 2 else "#344058"
            contact_draw.rectangle((x, y, x + checker - 1, y + checker - 1), fill=rgba(fill))
    font = ImageFont.load_default()
    for column, role_id in enumerate(ROLES):
        x = margin + column * CELL_W * scale
        contact_draw.text((x + 4, margin + 6), role_id.upper(), font=font, fill=rgba("#f6e8b9"))
        enlarged = atlas.crop((column * CELL_W, 0, (column + 1) * CELL_W, CELL_H)).resize(
            (CELL_W * scale, CELL_H * scale), Image.Resampling.NEAREST,
        )
        contact.alpha_composite(enlarged, (x, margin + label_h))
        pivot_y = margin + label_h + 44 * scale
        contact_draw.line((x + 13 * scale, pivot_y, x + 19 * scale, pivot_y), fill=rgba("#66d9ef"), width=1)
    contact_data = png_bytes(contact)
    manifest = {
        "assetId": source["assetId"],
        "status": "production-foundation-review",
        "authorship": source["authorship"],
        "geometry": {
            "frameWidth": CELL_W, "frameHeight": CELL_H, "columns": len(ROLES), "rows": 1,
            "sheetWidth": atlas.width, "sheetHeight": atlas.height,
            "pivot": [16, 44], "footPoint": [16, 44], "transparentGutter": 1,
            "alphaBoundingBox": alpha_bounds(atlas),
        },
        "roleOrder": list(ROLES),
        "mappingContracts": {role["id"]: role["liveContract"] for role in source["roleTaxonomy"]},
        "paletteIds": {role["id"]: role["paletteId"] for role in source["roleTaxonomy"]},
        "frames": frames,
        "exports": [
            {"file": ATLAS_PATH.name, "purpose": "transparent-runtime-atlas", "width": atlas.width, "height": atlas.height, "sha256": sha256(atlas_data)},
            {"file": CONTACT_PATH.name, "purpose": "labeled-review-only-not-runtime", "width": contact.width, "height": contact.height, "sha256": sha256(contact_data)},
        ],
        "review": {
            "runtimeIntegration": "campaign-explicit-field-characters-only-with-geometric-fallback",
            "animationExpansion": "additional-directions-and-motion-pending",
            "unmapped": source["exclusions"],
        },
    }
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return {ATLAS_PATH: atlas_data, CONTACT_PATH: contact_data, MANIFEST_PATH: manifest_data, RUNTIME_PATH: atlas_data}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="byte-compare deterministic outputs")
    args = parser.parse_args()
    outputs = build_outputs(load_source())
    if args.check:
        failures = [str(path) for path, expected in outputs.items() if not path.exists() or path.read_bytes() != expected]
        if failures:
            print("stale or missing: " + ", ".join(failures), file=sys.stderr)
            return 1
        print("npc field suite is deterministic and current")
        return 0
    for path, data in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        print(f"wrote {path.relative_to(REPO)} ({len(data)} bytes, sha256 {sha256(data)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
