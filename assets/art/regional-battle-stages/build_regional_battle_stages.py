#!/usr/bin/env python3
"""Build the deterministic regional battle-stage production wave."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "regional-battle-stages.source.json"
MANIFEST_PATH = ROOT / "manifest.json"
MODULE_PATH = ROOT / "regional-battle-stage-modules.png"
CONTACT_PATH = ROOT / "regional-battle-stages-contact-sheet.png"

EXPECTED_IDS = [
    "hsh-census-square", "c1-flooded-cedars", "fp1-wet-cedar-stage",
    "c1-tax-storehouse", "fp1-flooded-archive-stage", "hsh-prison-ferry", "hsh-bell-aqueduct",
    "sdg-rain-docks", "sdg-salt-warehouse", "ngi-tide-caves", "ngi-storm-reef",
    "kgr-ash-fields", "kgr-archive-furnace",
    "kzu-archive-roof", "kzu-public-tribunal", "c8-black-gate", "krh-outer-archive", "krh-observatory",
]
EXPECTED_KITS = {
    "rain-v01": ("takamine-rain", 3),
    "archive-v01": ("archive-indigo", 4),
    "coast-v01": ("coast-fog", 4),
    "ash-v01": ("kagura-ash", 2),
    "court-v01": ("court-vermilion", 5),
}
WATER_TAGS = {"water", "shallow-puddle", "storm-water", "cold-pool", "flowing-water"}
COURT_STYLES = {"archive-roof", "public-tribunal", "black-gate", "outer-archive", "throne-observatory"}
PLANK_STYLES = {"flooded-cedar", "cedar-service", "tax-storehouse", "prison-ferry", "rain-docks", "salt-warehouse"}
ROCK_STYLES = {"tide-caves", "storm-reef", "ash-fields"}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_sha(value: object) -> str:
    return sha256_bytes(json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def rgba(value: str) -> tuple[int, int, int, int]:
    value = value.removeprefix("#")
    if len(value) != 6:
        raise ValueError(f"Expected six-digit color, got {value!r}")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (255,)


def encode_png(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def ihdr(data: bytes) -> dict[str, int]:
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("Invalid PNG signature or IHDR placement")
    width, height, depth, color_type, compression, filter_method, interlace = struct.unpack(
        ">IIBBBBB", data[16:29]
    )
    return {
        "width": width, "height": height, "bitDepth": depth, "colorType": color_type,
        "compression": compression, "filter": filter_method, "interlace": interlace,
    }


def parse_cell(key: str) -> tuple[int, int]:
    try:
        x_text, y_text = key.split(",")
        return int(x_text), int(y_text)
    except (AttributeError, ValueError) as error:
        raise ValueError(f"Invalid cell key {key!r}") from error


def normalized_snapshot(board: dict) -> dict:
    return {
        "id": board["id"], "chapterId": board["chapterId"], "name": board["name"],
        "width": board["width"], "height": board["height"], "spacePx": board["spacePx"],
        "paletteId": board["paletteId"], "blocked": board["blocked"], "terrain": board["terrain"],
        "specialCells": board["specialCells"],
    }


def load_source() -> dict:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    if source.get("assetId") != "regional-battle-stages-v01":
        raise ValueError("Unexpected asset id")
    if source.get("geometry") != {"width": 384, "height": 224, "columns": 12, "rows": 7, "cellSize": 32}:
        raise ValueError("Regional stage geometry must remain exactly 384x224 / 12x7 / 32px")
    policy = source.get("renderPolicy", {})
    for key in ["bakeTelegraphs", "bakeActors", "bakeObjectives", "bakeInteractableIcons", "authenticReligiousSymbols", "authenticHeraldicSymbols"]:
        if policy.get(key) is not False:
            raise ValueError(f"renderPolicy.{key} must remain false")
    if policy.get("bakeVictimFixtures") is not True:
        raise ValueError("renderPolicy.bakeVictimFixtures must remain true")

    kits = source.get("kits", [])
    if [kit.get("id") for kit in kits] != list(EXPECTED_KITS):
        raise ValueError("Five material kits must remain in canonical order")
    for kit in kits:
        palette_id, _ = EXPECTED_KITS[kit["id"]]
        if kit.get("paletteId") != palette_id:
            raise ValueError(f"{kit['id']} palette binding changed")
        if set(kit.get("palette", {})) != {"base0", "base1", "seam", "edge", "blocked", "mass", "accent", "water", "dry", "paper"}:
            raise ValueError(f"{kit['id']} palette slots are incomplete")
        for value in kit["palette"].values():
            rgba(value)

    boards = source.get("boards", [])
    if [board.get("id") for board in boards] != EXPECTED_IDS:
        raise ValueError("The exact 18-board production wave changed")
    if len({board.get("style") for board in boards}) != 18:
        raise ValueError("Every board needs a distinct style preset")
    kit_by_id = {kit["id"]: kit for kit in kits}
    for kit_id, (palette_id, count) in EXPECTED_KITS.items():
        members = [board for board in boards if board.get("kitId") == kit_id]
        if len(members) != count or any(board.get("paletteId") != palette_id for board in members):
            raise ValueError(f"{kit_id} membership differs from the regional plan")

    for board in boards:
        if (board.get("width"), board.get("height"), board.get("spacePx")) != (12, 7, 32):
            raise ValueError(f"{board['id']} must be 12x7 at 32px")
        if board.get("kitId") not in kit_by_id:
            raise ValueError(f"{board['id']} references an unknown kit")
        if len(board["blocked"]) != len(set(board["blocked"])):
            raise ValueError(f"{board['id']} has duplicate blocked cells")
        fixtures = board.get("environmentalVictimFixtures")
        if board["style"] in {"black-gate", "outer-archive", "throne-observatory"}:
            if fixtures != {
                "count": len(board["blocked"]),
                "context": "fictional Kirishitan execution processional",
                "variants": ["crucified", "impaled"],
            }:
                raise ValueError(f"{board['id']} must bind one victim fixture to every blocked cell")
        elif fixtures is not None:
            raise ValueError(f"{board['id']} cannot add victim fixtures outside Kurohana")
        terrain_keys = [entry["at"] for entry in board["terrain"]]
        if len(terrain_keys) != len(set(terrain_keys)):
            raise ValueError(f"{board['id']} has duplicate terrain cells")
        audit_keys = list(board["blocked"]) + terrain_keys
        special = board["specialCells"]
        audit_keys += [entry["at"] for entry in special["exits"]]
        audit_keys += [entry["at"] for entry in special["interactables"]]
        audit_keys += [key for hazard in special["hazards"] for key in hazard["tiles"]]
        audit_keys += [f"{special['spawn']['x']},{special['spawn']['y']}"]
        for key in audit_keys:
            x, y = parse_cell(key)
            if not (0 <= x < 12 and 0 <= y < 7):
                raise ValueError(f"{board['id']} audit cell is out of bounds: {key}")
    return source


def paint_floor_cell(draw: ImageDraw.ImageDraw, x: int, y: int, palette: dict, style: str, column: int, row: int, style_index: int) -> None:
    base = palette["base0"] if (column + row + style_index) % 3 else palette["base1"]
    draw.rectangle((x, y, x + 31, y + 31), fill=base)
    if style in PLANK_STYLES:
        horizontal = style in {"flooded-cedar", "tax-storehouse", "salt-warehouse"}
        if horizontal:
            draw.line((x, y + 15, x + 31, y + 15), fill=palette["seam"])
            offset = 6 + ((row + style_index) % 3) * 8
            draw.line((x + offset, y, x + offset, y + 15), fill=palette["seam"])
            draw.line((x + (offset + 13) % 31, y + 16, x + (offset + 13) % 31, y + 31), fill=palette["seam"])
        else:
            draw.line((x + 15, y, x + 15, y + 31), fill=palette["seam"])
            offset = 5 + ((column + style_index) % 3) * 8
            draw.line((x, y + offset, x + 15, y + offset), fill=palette["seam"])
            draw.line((x + 16, y + (offset + 11) % 31, x + 31, y + (offset + 11) % 31), fill=palette["seam"])
        draw.point((x + 4 + (column * 7 + style_index) % 23, y + 5 + (row * 9 + style_index) % 21), fill=palette["edge"])
    elif style in ROCK_STYLES:
        shift = (column * 5 + row * 3 + style_index) % 7
        draw.line([(x + 2, y + 20 - shift), (x + 9, y + 15), (x + 17, y + 18 + shift // 2), (x + 29, y + 11)], fill=palette["seam"])
        draw.line([(x + 12, y + 2), (x + 15 + shift, y + 10), (x + 13, y + 17)], fill=palette["seam"])
    elif style == "archive-furnace":
        draw.line((x, y + 10, x + 31, y + 10), fill=palette["seam"])
        draw.line((x, y + 21, x + 31, y + 21), fill=palette["seam"])
        draw.line((x + (8 if row % 2 else 20), y, x + (8 if row % 2 else 20), y + 10), fill=palette["seam"])
        draw.line((x + (21 if row % 2 else 10), y + 11, x + (21 if row % 2 else 10), y + 21), fill=palette["seam"])
    elif style == "archive-roof":
        draw.line((x, y + 7, x + 31, y + 7), fill=palette["seam"])
        draw.line((x, y + 23, x + 31, y + 23), fill=palette["seam"])
        for offset in (4, 12, 20, 28):
            draw.line((x + offset, y + 8, x + offset - 2, y + 22), fill=palette["edge"])
    elif style in COURT_STYLES:
        inset = 4 + (style_index % 3)
        draw.rectangle((x + inset, y + inset, x + 31 - inset, y + 31 - inset), outline=palette["seam"])
        if style == "outer-archive":
            draw.line((x + 8, y + 11, x + 23, y + 11), fill=palette["edge"])
            draw.line((x + 8, y + 20, x + 23, y + 20), fill=palette["edge"])
        elif style == "throne-observatory":
            draw.line((x + 7, y + 22, x + 24, y + 22), fill=palette["edge"])
            draw.line((x + 24, y + 8, x + 24, y + 22), fill=palette["edge"])
        elif style == "black-gate":
            draw.line((x + 6, y + 16, x + 25, y + 16), fill=palette["mass"])
    else:
        seam_y = y + 15 + ((column + style_index) % 2)
        draw.line((x, seam_y, x + 31, seam_y), fill=palette["seam"])
        seam_x = x + 8 + ((row * 7 + style_index) % 16)
        draw.line((seam_x, y, seam_x, seam_y), fill=palette["seam"])
        draw.line((x + 31 - (seam_x - x), seam_y + 1, x + 31 - (seam_x - x), y + 31), fill=palette["seam"])
    draw.line((x, y + 31, x + 31, y + 31), fill=palette["seam"])
    draw.line((x + 31, y, x + 31, y + 31), fill=palette["seam"])


def paint_blocked_cell(draw: ImageDraw.ImageDraw, x: int, y: int, palette: dict, style: str, column: int, row: int) -> None:
    draw.rectangle((x + 2, y + 2, x + 29, y + 29), fill=palette["blocked"])
    if style in {"flooded-cedar", "cedar-service"}:
        draw.polygon([(x + 3, y + 24), (x + 9, y + 7), (x + 17, y + 4), (x + 28, y + 13), (x + 27, y + 28)], fill=palette["mass"])
        draw.line((x + 8, y + 21, x + 22, y + 9), fill=palette["accent"], width=2)
    elif style in {"tide-caves", "storm-reef", "ash-fields"}:
        draw.polygon([(x + 3, y + 27), (x + 6, y + 12), (x + 14, y + 4), (x + 25, y + 8), (x + 29, y + 22), (x + 24, y + 29)], fill=palette["mass"])
        draw.line((x + 11, y + 10, x + 18, y + 21), fill=palette["edge"])
    elif style in {"rain-docks", "salt-warehouse", "prison-ferry"}:
        draw.rectangle((x + 5, y + 4, x + 11, y + 28), fill=palette["mass"])
        draw.rectangle((x + 20, y + 3, x + 26, y + 27), fill=palette["mass"])
        draw.line((x + 5, y + 9, x + 26, y + 21), fill=palette["accent"], width=2)
    elif style == "archive-furnace":
        for brick_y in range(y + 5, y + 29, 8):
            draw.rectangle((x + 4, brick_y, x + 27, brick_y + 5), fill=palette["mass"])
            draw.line((x + 15 + ((brick_y // 8) % 2) * 5, brick_y, x + 15 + ((brick_y // 8) % 2) * 5, brick_y + 5), fill=palette["blocked"])
    elif style in COURT_STYLES:
        draw.rectangle((x + 5, y + 4, x + 26, y + 27), fill=palette["mass"], outline=palette["edge"])
        draw.rectangle((x + 8, y + 8, x + 23, y + 11), fill=palette["blocked"])
        draw.rectangle((x + 8, y + 17, x + 23, y + 20), fill=palette["blocked"])
        if style == "throne-observatory":
            draw.line((x + 7, y + 25, x + 24, y + 6), fill=palette["accent"], width=2)
        elif style == "black-gate":
            draw.rectangle((x + 14, y + 5, x + 17, y + 27), fill=palette["blocked"])
    else:
        draw.rectangle((x + 5, y + 5, x + 26, y + 27), fill=palette["mass"], outline=palette["edge"])
        draw.line((x + 8, y + 11, x + 23, y + 11), fill=palette["accent"])
        draw.line((x + 8, y + 19, x + 23, y + 19), fill=palette["accent"])
    draw.line((x + 3, y + 29, x + 28, y + 29), fill=palette["edge"])
    if style in {"black-gate", "outer-archive", "throne-observatory"}:
        paint_victim_fixture(draw, x, y, palette, column + row)


def paint_victim_fixture(draw: ImageDraw.ImageDraw, x: int, y: int, palette: dict, variant: int) -> None:
    """Paint a static fictional Kurohana victim fixture, separate from live actor authority."""
    stake_x = x + 16
    garment = palette["paper"] if variant % 3 == 0 else palette["edge"]
    if variant % 2 == 0:
        draw.line((stake_x, y + 3, stake_x, y + 29), fill=palette["accent"], width=2)
        draw.line((x + 7, y + 9, x + 25, y + 9), fill=palette["accent"], width=2)
        draw.ellipse((x + 14, y + 5, x + 18, y + 9), fill=palette["edge"])
        draw.line((x + 15, y + 10, x + 9, y + 13), fill=garment, width=2)
        draw.line((x + 17, y + 10, x + 23, y + 13), fill=garment, width=2)
        draw.polygon(((x + 13, y + 10), (x + 19, y + 10), (x + 20, y + 21), (x + 12, y + 21)), fill=garment)
        draw.line((x + 14, y + 21, x + 12, y + 26), fill=garment, width=2)
        draw.line((x + 18, y + 21, x + 20, y + 26), fill=garment, width=2)
        draw.rectangle((x + 17, y + 15, x + 18, y + 16), fill=palette["blocked"])
    else:
        draw.line((stake_x, y + 3, stake_x, y + 30), fill=palette["accent"], width=2)
        draw.ellipse((x + 12, y + 5, x + 17, y + 10), fill=palette["edge"])
        draw.line((x + 14, y + 10, x + 20, y + 20), fill=garment, width=3)
        draw.line((x + 18, y + 14, x + 23, y + 18), fill=garment, width=2)
        draw.line((x + 19, y + 20, x + 21, y + 26), fill=garment, width=2)
        draw.rectangle((x + 15, y + 18, x + 17, y + 19), fill=palette["blocked"])


def paint_terrain_cell(draw: ImageDraw.ImageDraw, x: int, y: int, palette: dict, tag: str, column: int, row: int) -> None:
    if tag in WATER_TAGS:
        draw.rectangle((x + 2, y + 3, x + 29, y + 28), fill=palette["water"])
        for wave_y in (y + 8, y + 17, y + 25):
            offset = (column * 5 + row * 3 + wave_y) % 7
            draw.line((x + 3 + offset, wave_y, x + 14 + offset, wave_y), fill=palette["edge"])
            draw.line((x + 19 - offset // 2, wave_y + 2, x + 27, wave_y + 2), fill=palette["seam"])
    elif tag == "dry-lantern":
        draw.rectangle((x + 4, y + 4, x + 27, y + 27), fill=palette["dry"], outline=palette["accent"])
        for px, py in ((7, 7), (23, 7), (7, 23), (23, 23)):
            draw.rectangle((x + px, y + py, x + px + 1, y + py + 1), fill=palette["paper"])
    elif tag == "paper-litter":
        for index, (px, py) in enumerate(((5, 7), (17, 5), (10, 19), (22, 21))):
            draw.rectangle((x + px, y + py, x + px + 7, y + py + 4), fill=palette["paper"] if index % 2 else palette["accent"])
            draw.line((x + px + 2, y + py + 2, x + px + 5, y + py + 2), fill=palette["seam"])
    elif tag == "furnace-grate":
        draw.rectangle((x + 3, y + 3, x + 28, y + 28), fill=palette["blocked"], outline=palette["accent"])
        for bar in range(7, 29, 5):
            draw.line((x + bar, y + 5, x + bar, y + 26), fill=palette["edge"], width=2)
    elif tag in {"ash-field", "ember-ash", "umbral-ash"}:
        draw.rectangle((x + 2, y + 2, x + 29, y + 29), fill=palette["mass"] if tag != "umbral-ash" else palette["blocked"])
        for index in range(9):
            px = x + 4 + (index * 7 + column * 3) % 24
            py = y + 4 + (index * 11 + row * 5) % 24
            draw.point((px, py), fill=palette["accent"] if tag != "umbral-ash" else palette["edge"])
    elif tag == "legal-seal":
        draw.rectangle((x + 7, y + 5, x + 24, y + 26), fill=palette["paper"], outline=palette["accent"])
        draw.rectangle((x + 10, y + 10, x + 21, y + 12), fill=palette["mass"])
        draw.rectangle((x + 13, y + 18, x + 22, y + 21), fill=palette["seam"])
    elif tag == "archive-floor":
        draw.rectangle((x + 3, y + 3, x + 28, y + 28), fill=palette["accent"], outline=palette["seam"])
        draw.line((x + 7, y + 11, x + 24, y + 11), fill=palette["paper"])
        draw.line((x + 7, y + 20, x + 20, y + 20), fill=palette["paper"])
    elif tag == "bell-node":
        draw.rectangle((x + 5, y + 5, x + 26, y + 26), fill=palette["mass"], outline=palette["accent"])
        draw.rectangle((x + 9, y + 9, x + 22, y + 22), outline=palette["edge"])
        draw.rectangle((x + 14, y + 12, x + 17, y + 19), fill=palette["accent"])
    elif tag == "wet-stone":
        draw.line((x + 5, y + 6, x + 20, y + 6), fill=palette["edge"])
        draw.line((x + 13, y + 18, x + 27, y + 18), fill=palette["edge"])


def paint_board_accents(draw: ImageDraw.ImageDraw, palette: dict, style: str) -> None:
    # Quiet architecture only; all marks stay outside rule-layer semantics.
    if style == "census-stone":
        draw.rectangle((150, 8, 233, 15), fill=palette["mass"])
        draw.line((160, 17, 222, 17), fill=palette["accent"])
    elif style == "flooded-archive":
        draw.line((128, 96, 255, 96), fill=palette["edge"])
        draw.line((128, 127, 255, 127), fill=palette["edge"])
    elif style == "bell-aqueduct":
        draw.line((64, 48, 127, 48), fill=palette["edge"], width=2)
        draw.line((256, 176, 319, 176), fill=palette["edge"], width=2)
    elif style == "salt-warehouse":
        for x in (96, 288):
            draw.rectangle((x, 68, x + 5, 155), fill=palette["mass"])
    elif style == "storm-reef":
        draw.line([(36, 112), (61, 101), (79, 116), (101, 105)], fill=palette["edge"], width=2)
    elif style == "archive-furnace":
        draw.rectangle((163, 69, 220, 154), outline=palette["accent"], width=2)
    elif style == "public-tribunal":
        draw.rectangle((128, 80, 255, 143), outline=palette["accent"])
        draw.line((160, 80, 160, 143), fill=palette["seam"])
        draw.line((223, 80, 223, 143), fill=palette["seam"])
    elif style == "black-gate":
        draw.rectangle((164, 66, 219, 157), outline=palette["edge"], width=2)
    elif style == "outer-archive":
        for y in (75, 96, 117, 138):
            draw.line((166, y, 217, y), fill=palette["accent"])
    elif style == "throne-observatory":
        draw.line((166, 147, 217, 76), fill=palette["accent"], width=3)
        draw.line((175, 151, 226, 80), fill=palette["edge"])


def render_board(board: dict, kit: dict, style_index: int) -> Image.Image:
    palette = {name: rgba(value) for name, value in kit["palette"].items()}
    image = Image.new("RGBA", (384, 224), palette["base0"])
    draw = ImageDraw.Draw(image)
    blocked = set(board["blocked"])
    terrain = {entry["at"]: entry["tag"] for entry in board["terrain"]}
    style = board["style"]
    for row in range(7):
        for column in range(12):
            x, y = column * 32, row * 32
            paint_floor_cell(draw, x, y, palette, style, column, row, style_index)
            key = f"{column},{row}"
            if key in blocked:
                paint_blocked_cell(draw, x, y, palette, style, column, row)
            elif key in terrain:
                paint_terrain_cell(draw, x, y, palette, terrain[key], column, row)
    paint_board_accents(draw, palette, style)
    draw.rectangle((0, 0, 383, 223), outline=palette["blocked"])
    return image


def render_module_sheet(source: dict) -> Image.Image:
    sheet = Image.new("RGBA", (640, 128), (0, 0, 0, 255))
    for kit_index, kit in enumerate(source["kits"]):
        palette = {name: rgba(value) for name, value in kit["palette"].items()}
        x0 = kit_index * 128
        demo_styles = [board["style"] for board in source["boards"] if board["kitId"] == kit["id"]]
        style = demo_styles[0]
        draw = ImageDraw.Draw(sheet)
        for row in range(2):
            for column in range(2):
                x, y = x0 + column * 64, row * 64
                draw.rectangle((x, y, x + 63, y + 63), fill=palette["base0"])
                for small_row in range(2):
                    for small_column in range(2):
                        paint_floor_cell(draw, x + small_column * 32, y + small_row * 32, palette, style, small_column, small_row, kit_index)
                if (column, row) == (1, 0):
                    paint_blocked_cell(draw, x + 16, y + 16, palette, style, 0, 0)
                elif (column, row) == (0, 1):
                    paint_terrain_cell(draw, x + 16, y + 16, palette, "flowing-water", 0, 0)
                elif (column, row) == (1, 1):
                    paint_terrain_cell(draw, x + 16, y + 16, palette, "dry-lantern", 0, 0)
        draw.rectangle((x0, 0, x0 + 127, 127), outline=palette["edge"])
    return sheet


def render_contact_sheet(source: dict, boards: dict[str, Image.Image]) -> Image.Image:
    sheet = Image.new("RGBA", (768, 640), rgba("#0B1020"))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, board in enumerate(source["boards"]):
        column, row = index % 4, index // 4
        x, y = column * 192, row * 128
        preview = boards[board["id"]].resize((192, 112), Image.Resampling.NEAREST)
        sheet.alpha_composite(preview, (x, y))
        draw.rectangle((x, y, x + 191, y + 127), outline="#4F7392")
        draw.rectangle((x, y + 112, x + 191, y + 127), fill="#0B1020")
        label = f"{board['id']} | {board['kitId']}"
        draw.text((x + 4, y + 114), label, fill="#F6E8B9", font=font)
    return sheet


def validate_outputs(source: dict, board_images: dict[str, Image.Image], board_bytes: dict[str, bytes], module_bytes: bytes, contact_bytes: bytes) -> dict:
    if len(set(sha256_bytes(data) for data in board_bytes.values())) != 18:
        raise ValueError("All 18 board exports must be visually and byte distinct")
    for board_id, image in board_images.items():
        if image.size != (384, 224) or image.mode != "RGBA":
            raise ValueError(f"{board_id} is not exact 384x224 RGBA")
        if image.getchannel("A").getextrema() != (255, 255):
            raise ValueError(f"{board_id} must be an opaque RGBA floor")
        metadata = ihdr(board_bytes[board_id])
        if metadata != {"width":384,"height":224,"bitDepth":8,"colorType":6,"compression":0,"filter":0,"interlace":0}:
            raise ValueError(f"{board_id} has unexpected IHDR {metadata}")
    if (ihdr(module_bytes)["width"], ihdr(module_bytes)["height"]) != (640, 128):
        raise ValueError("Module sheet must be exactly 640x128")
    if (ihdr(contact_bytes)["width"], ihdr(contact_bytes)["height"]) != (768, 640):
        raise ValueError("Contact sheet must be exactly 768x640")
    return {
        "boardCount": 18, "distinctBoardHashes": 18, "allBoardsRgba": True,
        "allBoardsOpaque": True, "allBoardIhdrExact": True,
        "kurohanaVictimFixtureCount": sum(board.get("environmentalVictimFixtures", {}).get("count", 0) for board in source["boards"]),
        "moduleSheetDimensions": [640, 128], "contactSheetDimensions": [768, 640],
        "twoIndependentRendersByteIdentical": True,
    }


def build_artifacts(source: dict) -> tuple[dict[str, bytes], bytes, bytes, dict]:
    kit_by_id = {kit["id"]: kit for kit in source["kits"]}
    board_images = {
        board["id"]: render_board(board, kit_by_id[board["kitId"]], index)
        for index, board in enumerate(source["boards"])
    }
    board_bytes = {board_id: encode_png(image) for board_id, image in board_images.items()}
    module_bytes = encode_png(render_module_sheet(source))
    contact_bytes = encode_png(render_contact_sheet(source, board_images))

    second_images = {
        board["id"]: render_board(board, kit_by_id[board["kitId"]], index)
        for index, board in enumerate(source["boards"])
    }
    second_board_bytes = {board_id: encode_png(image) for board_id, image in second_images.items()}
    if board_bytes != second_board_bytes:
        raise ValueError("Two independent board render passes differ")
    if module_bytes != encode_png(render_module_sheet(source)):
        raise ValueError("Two independent module-sheet render passes differ")
    if contact_bytes != encode_png(render_contact_sheet(source, second_images)):
        raise ValueError("Two independent contact-sheet render passes differ")
    validation = validate_outputs(source, board_images, board_bytes, module_bytes, contact_bytes)
    return board_bytes, module_bytes, contact_bytes, validation


def create_manifest(source: dict, board_bytes: dict[str, bytes], module_bytes: bytes, contact_bytes: bytes, validation: dict) -> dict:
    board_by_id = {board["id"]: board for board in source["boards"]}
    board_exports = []
    board_records = []
    for board_id in EXPECTED_IDS:
        board = board_by_id[board_id]
        filename = f"{board_id}-board-v01.png"
        data = board_bytes[board_id]
        snapshot = normalized_snapshot(board)
        board_exports.append({
            "id": f"{board_id}-board-v01", "boardId": board_id, "path": filename,
            "format": "png", "sha256": sha256_bytes(data), "ihdr": ihdr(data),
            "runtimeCandidate": True,
        })
        board_records.append({
            "id": board_id, "name": board["name"], "chapterId": board["chapterId"],
            "kitId": board["kitId"], "style": board["style"], "export": filename,
            "victimFixtureCount": board.get("environmentalVictimFixtures", {}).get("count", 0),
            "occupancySha256": canonical_sha(snapshot), "snapshot": snapshot,
        })
    return {
        "schemaVersion": 1, "assetId": source["assetId"], "status": "integrated-current-browser",
        "geometry": source["geometry"], "renderPolicy": source["renderPolicy"],
        "generator": {
            "path": Path(__file__).name, "pillow": PILLOW_VERSION,
            "determinism": "two independent in-process renders are byte-identical",
        },
        "sources": [
            {"path": SOURCE_PATH.name, "sha256": sha256_bytes(SOURCE_PATH.read_bytes())},
            {"path": Path(__file__).name, "sha256": sha256_bytes(Path(__file__).read_bytes())},
        ],
        "kits": [
            {"id": kit["id"], "paletteId": kit["paletteId"], "signature": kit["signature"],
             "boardIds": [board["id"] for board in source["boards"] if board["kitId"] == kit["id"]]}
            for kit in source["kits"]
        ],
        "exports": board_exports + [
            {"id":"regional-module-sheet","path":MODULE_PATH.name,"format":"png","sha256":sha256_bytes(module_bytes),"ihdr":ihdr(module_bytes),"runtimeCandidate":False},
            {"id":"labeled-contact-sheet","path":CONTACT_PATH.name,"format":"png","sha256":sha256_bytes(contact_bytes),"ihdr":ihdr(contact_bytes),"runtimeCandidate":False},
        ],
        "boards": board_records, "validation": validation,
        "review": {"internalSymbolConstraints":"applied","visualContactSheetReview":"passed-after-observatory-floor-revision","externalCulturalReview":"pending","artLock":False},
    }


def expected_files() -> dict[Path, bytes]:
    source = load_source()
    board_bytes, module_bytes, contact_bytes, validation = build_artifacts(source)
    manifest = create_manifest(source, board_bytes, module_bytes, contact_bytes, validation)
    files = {
        ROOT / f"{board_id}-board-v01.png": data for board_id, data in board_bytes.items()
    }
    files[MODULE_PATH] = module_bytes
    files[CONTACT_PATH] = contact_bytes
    files[MANIFEST_PATH] = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return files


def write_build(files: dict[Path, bytes]) -> None:
    for path, data in files.items():
        path.write_bytes(data)


def check_build(files: dict[Path, bytes]) -> None:
    expected_generated = {path.name for path in files}
    actual_generated = {path.name for path in ROOT.glob("*.png")} | ({MANIFEST_PATH.name} if MANIFEST_PATH.exists() else set())
    extras = actual_generated - expected_generated
    if extras:
        raise ValueError(f"Unexpected generated artifacts: {sorted(extras)}")
    for path, expected in files.items():
        if not path.exists():
            raise FileNotFoundError(f"Missing generated artifact: {path.name}")
        actual = path.read_bytes()
        if actual != expected:
            raise ValueError(f"{path.name} is stale: expected {sha256_bytes(expected)}, got {sha256_bytes(actual)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify byte-exact generated artifacts without writing")
    args = parser.parse_args()
    files = expected_files()
    if args.check:
        check_build(files)
    else:
        write_build(files)
        check_build(files)
    manifest = json.loads(files[MANIFEST_PATH].decode("utf-8"))
    print(json.dumps({
        "ok": True, "mode": "check" if args.check else "build", "assetId": manifest["assetId"],
        "boards": manifest["validation"]["boardCount"], "distinct": manifest["validation"]["distinctBoardHashes"],
        "moduleSheet": manifest["validation"]["moduleSheetDimensions"],
        "contactSheet": manifest["validation"]["contactSheetDimensions"],
    }, separators=(",", ":")))


if __name__ == "__main__":
    main()
