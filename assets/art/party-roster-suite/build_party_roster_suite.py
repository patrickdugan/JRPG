#!/usr/bin/env python3
"""Build deterministic player-facing party key art from the authored combat atlas."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "party-roster-suite.source.json"
COMBAT_PATH = ROOT.parent / "party-combat-suite" / "party-combat-actions.png"
FIELD_SOURCE_PATH = ROOT.parent / "party-field-suite" / "party-field-suite.source.json"
OUTPUT_NAME = "party-roster-key-art.png"
MANIFEST_NAME = "manifest.json"
README_NAME = "README.md"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encode_png(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def alpha_composite_at(base: Image.Image, overlay: Image.Image, x: int, y: int) -> None:
    base.alpha_composite(overlay, (x, y))


def build_background(width: int, height: int) -> Image.Image:
    image = Image.new("RGBA", (width, height), (7, 11, 24, 255))
    draw = ImageDraw.Draw(image)
    # Hard-edged eight-pixel value clusters keep the image visibly pixel-authored.
    for y in range(0, height, 8):
        shade = (10 + (y // 8) % 3 * 3, 18 + (y // 16) % 3 * 4, 35 + (y // 24) % 3 * 5, 255)
        draw.rectangle((0, y, width - 1, min(height - 1, y + 7)), fill=shade)
    # Stepped moon and restrained halo.
    draw.ellipse((592, 64, 848, 320), fill=(31, 40, 57, 255))
    draw.ellipse((620, 92, 820, 292), fill=(157, 153, 136, 255))
    for y in range(108, 286, 16):
        draw.rectangle((642 + (y // 16) % 4 * 9, y, 782, y + 5), fill=(137, 137, 128, 255))
    # Paper-window side masses and wet cedar stage.
    for left in (0, 1216):
        draw.rectangle((left, 80, left + 223, 590), fill=(8, 14, 27, 255), outline=(48, 58, 70, 255), width=5)
        for x in range(left + 28, left + 224, 48):
            draw.rectangle((x, 88, x + 4, 580), fill=(43, 50, 62, 255))
        for y in range(126, 590, 68):
            draw.rectangle((left + 8, y, left + 215, y + 4), fill=(43, 50, 62, 255))
    draw.rectangle((0, 706, width - 1, height - 1), fill=(20, 21, 27, 255))
    for y in range(706, height, 24):
        draw.rectangle((0, y, width - 1, y + 3), fill=(64, 49, 43, 255))
    for x in range(-80, width, 160):
        draw.line((x, 706, x + 95, height - 1), fill=(48, 38, 37, 255), width=5)
    # Fixed rain cadence; no random source or antialiasing.
    for index in range(180):
        x = (index * 83 + 29) % width
        y = (index * 137 + 17) % 690
        length = 12 + (index % 4) * 4
        draw.line((x, y, x - 4, y + length), fill=(46, 72, 100, 150), width=2)
    return image


def reflection(sprite: Image.Image, height: int = 118) -> Image.Image:
    reflected = sprite.transpose(Image.Transpose.FLIP_TOP_BOTTOM).crop((0, 0, sprite.width, height))
    alpha = reflected.getchannel("A")
    pixels = alpha.load()
    for y in range(reflected.height):
        opacity = max(0, 76 - y // 2)
        for x in range(reflected.width):
            pixels[x, y] = pixels[x, y] * opacity // 255
    reflected.putalpha(alpha)
    return reflected


def render() -> Image.Image:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    field = json.loads(FIELD_SOURCE_PATH.read_text(encoding="utf-8"))
    rows = source["rowOrder"]
    if rows != [entry["id"] for entry in field["characters"]]:
        raise ValueError("roster rows must match the canonical field source")
    atlas = Image.open(COMBAT_PATH).convert("RGBA")
    if atlas.size != (480, 384):
        raise ValueError(f"combat atlas must be 480x384, got {atlas.size}")
    width, height = source["canvas"]["width"], source["canvas"]["height"]
    scale, baseline = source["sprite"]["integerScale"], source["sprite"]["baselineY"]
    image = build_background(width, height)
    draw = ImageDraw.Draw(image)
    centers = (130, 366, 602, 838, 1074, 1310)
    for row, (character_id, center_x) in enumerate(zip(rows, centers, strict=True)):
        cell = atlas.crop((0, row * 64, 48, row * 64 + 64))
        sprite = cell.resize((48 * scale, 64 * scale), Image.Resampling.NEAREST)
        left, top = center_x - sprite.width // 2, baseline - sprite.height
        draw.ellipse((center_x - 78, baseline - 16, center_x + 78, baseline + 14), fill=(1, 3, 8, 150))
        alpha_composite_at(image, sprite, left, top)
        alpha_composite_at(image, reflection(sprite), left, baseline + 8)
        # Palette-owned plinth ticks distinguish the six positions without text.
        color = field["characters"][row]["colors"]["accent"]
        draw.rectangle((center_x - 36, baseline + 2, center_x + 36, baseline + 7), fill=color)
    return image


def build_files() -> dict[str, bytes]:
    image = render()
    output = encode_png(image)
    source_data = SOURCE_PATH.read_bytes()
    source = json.loads(source_data)
    combat_data = COMBAT_PATH.read_bytes()
    field_data = FIELD_SOURCE_PATH.read_bytes()
    builder_data = Path(__file__).read_bytes()
    manifest = {
        "assetId": source["assetId"],
        "status": "deterministic-runtime-key-art",
        "authorship": "original-code-native-pixel-composition",
        "geometry": {"width": image.width, "height": image.height, "mode": image.mode},
        "rowOrder": ["ren", "aya", "lise", "mateus", "genta", "kiku"],
        "presentationNames": source["presentationNames"],
        "nikolaLineage": source["nikolaLineage"],
        "sources": [
            {"path": SOURCE_PATH.name, "role": "editable-composition-contract", "sha256": sha256(source_data)},
            {"path": "../party-combat-suite/party-combat-actions.png", "role": "canonical-authored-sprite-input", "sha256": sha256(combat_data)},
            {"path": "../party-field-suite/party-field-suite.source.json", "role": "canonical-palette-and-name-contract", "sha256": sha256(field_data)},
            {"path": Path(__file__).name, "role": "deterministic-builder", "sha256": sha256(builder_data)},
        ],
        "exports": [{"path": OUTPUT_NAME, "role": "player-facing-runtime-key-art", "width": image.width, "height": image.height, "mode": image.mode, "sha256": sha256(output)}],
        "validation": {"deterministicCommand": "python build_party_roster_suite.py --check", "integerScalingOnly": True, "containsText": False},
        "review": {"visualInspection": "pending", "externalCulturalReview": "pending", "realPersonLikeness": "excluded-by-code-native-source"},
    }
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    readme = """# Deterministic party roster key art

This player-facing 1440 × 900 pixel-art composition is built entirely from the authored party combat atlas. It replaces the obsolete generated roster on live Campaign chapters. The third row retains the internal compatibility key `lise`, but its visible/source identity is Nikola Dražanić: a Croatian-born frontier minor aristocrat who claims Wallachian hunter descent and membership in the invented Covenant of the Severed Dragon. This lineage is entirely alternate-history fiction and makes no real-world claim that vampires, vampire hunters, or the Covenant existed.

- `party-roster-suite.source.json` fixes dimensions, row order, presentation names, and input contracts.
- `party-roster-key-art.png` is the runtime image.
- `manifest.json` records all source and export hashes.
- The composition contains no lettering, real-person likeness, generated-raster input, or sacred-object prop.

Run `python build_party_roster_suite.py` to rebuild or `python build_party_roster_suite.py --check` to byte-compare generated outputs.
""".encode("utf-8")
    return {OUTPUT_NAME: output, MANIFEST_NAME: manifest_data, README_NAME: readme}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    files = build_files()
    if args.check:
        mismatches = [name for name, data in files.items() if not (ROOT / name).exists() or (ROOT / name).read_bytes() != data]
        if mismatches:
            raise SystemExit("generated outputs differ: " + ", ".join(mismatches))
        print("party roster suite is byte-identical")
        return 0
    for name, data in files.items():
        (ROOT / name).write_bytes(data)
        print(f"wrote {name}: {len(data)} bytes sha256={sha256(data)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
