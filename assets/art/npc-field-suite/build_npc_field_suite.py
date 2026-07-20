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
ROLES = (
    "speaker", "interviewee", "confined-person", "courier",
    "dock-worker", "ferry-captain", "market-seller", "trade-broker",
    "print-organizer", "port-clerk", "physician", "resident",
    "former-retainer", "caretaker", "net-mender", "post-keeper",
)
POSES = ("south-idle", "south-gesture")


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
    assert tuple(source["sheet"]["rows"]) == POSES
    assert tuple(role["id"] for role in source["roleTaxonomy"]) == ROLES
    return source


def draw_person(role: dict, pose: str) -> Image.Image:
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
    elif role["id"] == "courier":
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
    else:
        # Twelve explicit community roles share one grounded field grammar but
        # retain separate palettes, secular work silhouettes, and props. The
        # role comes only from authored metadata; this builder never infers it
        # from names, prose, religion, or ethnicity.
        role_index = ROLES.index(role["id"]) - 4
        left = 7 + (role_index % 3 == 0)
        right = 25 - (role_index % 4 == 0)
        poly([(left, 22), (11, 17), (21, 17), (right, 22), (22, 40), (10, 40)], "outline")
        poly([(left + 2, 23), (12, 19), (20, 19), (right - 2, 23), (20, 38), (12, 38)], "primary")
        poly([(11, 25), (16, 21), (21, 25), (19, 36), (13, 36)], "secondary")
        rect((7, 25, 10, 34), "outline")
        rect((8, 26, 10, 32), "primary")
        rect((22, 25, 25, 34), "outline")
        rect((22, 26, 24, 32), "primary")
        rect((8, 33, 10, 35), "skin")
        rect((22, 33, 24, 35), "skin")

        if role["id"] == "dock-worker":
            draw.arc((3, 26, 12, 39), 80, 285, fill=c["accent"], width=2)
        elif role["id"] == "ferry-captain":
            rect((7, 18, 24, 20), "light")
            rect((10, 16, 21, 18), "primary")
        elif role["id"] == "market-seller":
            rect((21, 31, 28, 39), "outline")
            rect((22, 32, 27, 38), "accent")
            rect((23, 32, 24, 33), "light")
            rect((26, 34, 27, 35), "secondary")
        elif role["id"] == "trade-broker":
            draw.line((12, 21, 22, 35), fill=c["accent"], width=2)
            rect((19, 32, 24, 38), "secondary")
        elif role["id"] == "print-organizer":
            rect((5, 28, 11, 37), "outline")
            rect((6, 29, 10, 36), "light")
            rect((7, 31, 9, 31), "accent")
        elif role["id"] == "port-clerk":
            rect((21, 30, 27, 38), "outline")
            rect((22, 31, 26, 37), "secondary")
            rect((23, 32, 25, 32), "accent")
        elif role["id"] == "physician":
            rect((5, 30, 11, 38), "outline")
            rect((6, 31, 10, 37), "secondary")
            draw.line((8, 30, 7, 25), fill=c["accent"], width=1)
            rect((6, 24, 7, 26), "light")
        elif role["id"] == "former-retainer":
            rect((5, 30, 11, 38), "outline")
            rect((6, 31, 10, 37), "secondary")
        elif role["id"] == "caretaker":
            poly([(8, 8), (12, 4), (21, 5), (24, 10), (22, 18), (10, 18)], "deep")
            rect((5, 31, 10, 38), "secondary")
        elif role["id"] == "net-mender":
            draw.arc((20, 29, 30, 41), 70, 300, fill=c["accent"], width=2)
            draw.line((22, 31, 28, 38), fill=c["light"], width=1)
        elif role["id"] == "post-keeper":
            draw.line((12, 21, 21, 34), fill=c["accent"], width=2)
            rect((19, 32, 24, 38), "secondary")

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
    if pose == "south-gesture":
        # One empty raised hand supplies a conversation loop. It is a visual
        # state only and never changes interaction range, timing, or authority.
        poly([(23, 25), (25, 20), (27, 18), (29, 20), (27, 23), (26, 29)], "outline")
        poly([(24, 25), (26, 21), (27, 20), (28, 20), (26, 27)], "primary")
        rect((27, 17, 29, 20), "skin")
        rect((28, 16, 29, 17), "skinLight")
    return image


def alpha_bounds(image: Image.Image) -> list[int] | None:
    box = image.getchannel("A").getbbox()
    return list(box) if box else None


def build_outputs(source: dict) -> dict[Path, bytes]:
    atlas = Image.new("RGBA", (CELL_W * len(ROLES), CELL_H * len(POSES)), (0, 0, 0, 0))
    frames = []
    for row, pose in enumerate(POSES):
        for column, role_id in enumerate(ROLES):
            role = next(item for item in source["roleTaxonomy"] if item["id"] == role_id)
            frame = draw_person(role, pose)
            atlas.alpha_composite(frame, (column * CELL_W, row * CELL_H))
            frames.append({
                "id": f"{role_id}-{pose}", "role": role_id, "pose": pose,
                "rect": [column * CELL_W, row * CELL_H, CELL_W, CELL_H],
                "pivot": [16, 44], "footPoint": [16, 44],
                "localAlphaBounds": alpha_bounds(frame),
                "rgbaSha256": sha256(frame.tobytes()),
            })

    atlas_data = png_bytes(atlas)
    scale, margin, label_h, roles_per_row = 4, 24, 28, 4
    role_block_w = CELL_W * scale * len(POSES)
    role_block_h = label_h + CELL_H * scale
    role_rows = (len(ROLES) + roles_per_row - 1) // roles_per_row
    contact_w = margin * 2 + role_block_w * roles_per_row
    contact_h = margin * 2 + role_block_h * role_rows
    contact = Image.new("RGBA", (contact_w, contact_h), rgba("#151b2b"))
    contact_draw = ImageDraw.Draw(contact)
    checker = 8
    for y in range(margin, contact_h - margin, checker):
        for x in range(margin, contact_w - margin, checker):
            fill = "#263044" if ((x // checker) + (y // checker)) % 2 else "#344058"
            contact_draw.rectangle((x, y, x + checker - 1, y + checker - 1), fill=rgba(fill))
    font = ImageFont.load_default()
    for column, role_id in enumerate(ROLES):
        grid_x = column % roles_per_row
        grid_y = column // roles_per_row
        x = margin + grid_x * role_block_w
        y = margin + grid_y * role_block_h
        contact_draw.text((x + 4, y + 6), role_id.upper(), font=font, fill=rgba("#f6e8b9"))
        for row, _pose in enumerate(POSES):
            enlarged = atlas.crop((
                column * CELL_W, row * CELL_H,
                (column + 1) * CELL_W, (row + 1) * CELL_H,
            )).resize((CELL_W * scale, CELL_H * scale), Image.Resampling.NEAREST)
            pose_x = x + row * CELL_W * scale
            contact.alpha_composite(enlarged, (pose_x, y + label_h))
            pivot_y = y + label_h + 44 * scale
            contact_draw.line((pose_x + 13 * scale, pivot_y, pose_x + 19 * scale, pivot_y), fill=rgba("#66d9ef"), width=1)
    contact_data = png_bytes(contact)
    manifest = {
        "assetId": source["assetId"],
        "status": "production-foundation-review",
        "authorship": source["authorship"],
        "geometry": {
            "frameWidth": CELL_W, "frameHeight": CELL_H, "columns": len(ROLES), "rows": len(POSES),
            "sheetWidth": atlas.width, "sheetHeight": atlas.height,
            "pivot": [16, 44], "footPoint": [16, 44], "transparentGutter": 1,
            "alphaBoundingBox": alpha_bounds(atlas),
        },
        "roleOrder": list(ROLES),
        "poseOrder": list(POSES),
        "mappingContracts": {role["id"]: role["liveContract"] for role in source["roleTaxonomy"]},
        "paletteIds": {role["id"]: role["paletteId"] for role in source["roleTaxonomy"]},
        "frames": frames,
        "exports": [
            {"file": ATLAS_PATH.name, "purpose": "transparent-runtime-atlas", "width": atlas.width, "height": atlas.height, "sha256": sha256(atlas_data)},
            {"file": CONTACT_PATH.name, "purpose": "labeled-review-only-not-runtime", "width": contact.width, "height": contact.height, "sha256": sha256(contact_data)},
        ],
        "review": {
            "runtimeIntegration": "campaign-explicit-field-characters-only-with-geometric-fallback",
            "animationExpansion": "south-idle-and-conversation-gesture-live; additional-directions-and-motion-pending",
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
