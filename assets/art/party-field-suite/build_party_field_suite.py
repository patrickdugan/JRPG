#!/usr/bin/env python3
"""Build the original party field foundation sprites deterministically."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "party-field-suite.source.json"
EXTENSION_SOURCE_PATH = ROOT / "party-field-walk-inbetweens.source.json"
RUNTIME_PNG = "party-field-foundation.png"
CONTACT_PNG = "party-field-foundation-contact-sheet.png"
MANIFEST_JSON = "manifest.json"
README_MD = "README.md"

FRAME_W = 32
FRAME_H = 48
LEGACY_COLUMNS = (
    "north-idle", "north-walk", "east-idle", "east-walk",
    "south-idle", "south-walk", "west-idle", "west-walk",
    "south-interact", "south-hurt",
)
WALK_B_COLUMNS = ("north-walk-b", "east-walk-b", "south-walk-b", "west-walk-b")
SHEET_COLUMNS = LEGACY_COLUMNS + WALK_B_COLUMNS
SHEET_ROWS = ("ren", "aya", "lise", "mateus", "genta", "kiku")


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = hex_color.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (alpha,)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def load_source() -> tuple[dict, dict]:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    extension = json.loads(EXTENSION_SOURCE_PATH.read_text(encoding="utf-8"))
    frame = source["frame"]
    assert (frame["width"], frame["height"]) == (FRAME_W, FRAME_H)
    assert tuple(source["sheet"]["columns"]) == LEGACY_COLUMNS
    assert tuple(source["sheet"]["rows"]) == SHEET_ROWS
    assert tuple(character["id"] for character in source["characters"]) == SHEET_ROWS
    assert extension["canonicalSource"] == SOURCE_PATH.name
    assert extension["authorship"] == source["authorship"]
    assert tuple(extension["appendColumns"]) == WALK_B_COLUMNS
    assert extension["frameContract"] == frame
    return source, extension


class Sprite:
    def __init__(self, palette: dict[str, str], direction: str, state: str):
        self.image = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)
        self.c = {name: rgba(value) for name, value in palette.items()}
        self.direction = direction
        self.state = state
        self.walk = state in ("walk", "walk-b")
        self.walk_phase = "b" if state == "walk-b" else "a"
        self.mirror = direction == "west"

    def _x(self, x: int) -> int:
        return FRAME_W - 1 - x if self.mirror else x

    def rect(self, box: tuple[int, int, int, int], color: str):
        x0, y0, x1, y1 = box
        if self.mirror:
            x0, x1 = self._x(x1), self._x(x0)
        self.draw.rectangle((x0, y0, x1, y1), fill=self.c[color])

    def polygon(self, points: list[tuple[int, int]], color: str):
        self.draw.polygon([(self._x(x), y) for x, y in points], fill=self.c[color])

    def line(self, points: list[tuple[int, int]], color: str, width: int = 1):
        self.draw.line([(self._x(x), y) for x, y in points], fill=self.c[color], width=width)

    def pixel(self, x: int, y: int, color: str):
        self.draw.point((self._x(x), y), fill=self.c[color])


def base_palette(source: dict, character: dict) -> dict[str, str]:
    return {**source["sharedPalette"], **character["colors"]}


def draw_head(s: Sprite, style: str):
    """Small directional portrait clusters with a continuous dark outer read."""
    if s.direction == "north":
        s.rect((12, 8, 19, 9), "outline")
        s.rect((10, 10, 21, 15), "outline")
        s.rect((11, 10, 20, 14), "hair")
        s.rect((12, 15, 19, 17), "skinShadow")
        s.pixel(11, 13, "deep")
        s.pixel(20, 13, "deep")
    elif s.direction in ("east", "west"):
        s.rect((11, 8, 19, 9), "outline")
        s.rect((10, 10, 21, 16), "outline")
        s.rect((11, 10, 18, 14), "hair")
        s.rect((13, 13, 20, 16), "skin")
        s.pixel(19, 13, "skinLight")
        s.pixel(20, 14, "outline")
        s.pixel(18, 14, "deep")
        s.rect((11, 15, 14, 17), "skinShadow")
    else:
        s.rect((12, 8, 19, 9), "outline")
        s.rect((10, 10, 21, 16), "outline")
        s.rect((11, 10, 20, 12), "hair")
        s.rect((11, 13, 20, 16), "skin")
        s.pixel(12, 13, "skinLight")
        s.pixel(19, 13, "skinLight")
        s.pixel(13, 15, "deep")
        s.pixel(18, 15, "deep")
        s.rect((14, 16, 17, 17), "skinShadow")

    if style == "lise":
        s.rect((10, 9, 12, 15), "hair")
        s.pixel(9, 13, "hair")
        s.pixel(20, 10, "light")
    elif style == "mateus":
        s.rect((11, 8, 20, 10), "hair")
        s.pixel(10, 11, "hair")
        s.pixel(20, 12, "skinShadow")
    elif style == "genta":
        s.rect((10, 8, 21, 10), "hair")
        s.pixel(9, 11, "hair")
        s.pixel(21, 11, "hair")
        if s.direction == "south":
            s.rect((13, 16, 18, 18), "hair")
    elif style == "kiku":
        s.rect((10, 9, 12, 17), "hair")
        s.rect((19, 9, 21, 17), "hair")
        s.pixel(9, 15, "accent")
    elif style == "aya":
        s.rect((10, 9, 12, 17), "hair")
        s.rect((19, 9, 21, 17), "hair")
        s.pixel(9, 14, "hair")


def draw_legs(s: Sprite, primary: str = "primary", long_coat: bool = False):
    if long_coat:
        s.polygon([(12, 29), (19, 29), (21, 39), (18, 42), (13, 42), (10, 39)], "outline")
        s.polygon([(13, 29), (18, 29), (19, 38), (17, 40), (14, 40), (12, 38)], primary)
    if s.walk and s.walk_phase == "b":
        s.rect((11, 35, 14, 41), "outline")
        s.rect((18, 36, 21, 42), "outline")
        s.rect((9, 41, 14, 43), "outline")
        s.rect((18, 42, 23, 44), "outline")
        s.pixel(10, 41, primary)
        s.pixel(19, 42, primary)
    elif s.walk:
        s.rect((11, 36, 14, 42), "outline")
        s.rect((18, 35, 21, 41), "outline")
        s.rect((9, 42, 14, 44), "outline")
        s.rect((18, 41, 23, 43), "outline")
        s.pixel(10, 42, primary)
        s.pixel(19, 41, primary)
    else:
        s.rect((11, 35, 15, 43), "outline")
        s.rect((17, 35, 21, 43), "outline")
        s.rect((9, 43, 15, 44), "outline")
        s.rect((17, 43, 23, 44), "outline")
        s.rect((12, 36, 14, 41), primary)
        s.rect((18, 36, 20, 41), primary)


def draw_ren(s: Sprite):
    draw_legs(s)
    # Spear remains a clean one-pixel vertical/diagonal read in every facing.
    spear_x = 26 if s.direction in ("south", "east") else 5
    s.line([(spear_x, 5), (spear_x - (2 if s.direction == "east" else 0), 41)], "outline", 2)
    s.line([(spear_x, 6), (spear_x - (2 if s.direction == "east" else 0), 39)], "brass")
    s.polygon([(spear_x, 4), (spear_x - 2, 8), (spear_x + 1, 7)], "metal")
    s.polygon([(10, 18), (21, 18), (23, 31), (20, 37), (11, 36), (8, 29)], "outline")
    s.polygon([(11, 19), (20, 19), (21, 30), (19, 34), (12, 34), (10, 29)], "primary")
    s.rect((12, 20, 19, 24), "secondary")
    s.line([(12, 25), (19, 31)], "light", 1)
    # Satchel is deliberately asymmetric and separated from the coat edge.
    satchel_x = 5
    s.rect((satchel_x, 24, satchel_x + 5, 32), "outline")
    s.rect((satchel_x + 1, 25, satchel_x + 4, 30), "light")
    s.line([(12, 18), (20, 31)], "accent")
    draw_head(s, "ren")


def draw_aya(s: Sprite):
    draw_legs(s)
    s.polygon([(9, 18), (22, 18), (24, 31), (20, 37), (11, 37), (7, 31)], "outline")
    s.polygon([(10, 19), (21, 19), (22, 30), (19, 35), (12, 35), (9, 30)], "primary")
    s.rect((12, 20, 19, 27), "secondary")
    s.rect((10, 26, 13, 34), "light")
    s.rect((18, 26, 21, 34), "light")
    # Archive case: hard square mass, brass corner pixels, clear air around it.
    case_x = 23
    s.rect((case_x, 20, case_x + 6, 31), "outline")
    s.rect((case_x + 1, 21, case_x + 5, 29), "deep")
    s.pixel(case_x + 1, 21, "brass")
    s.pixel(case_x + 5, 29, "brass")
    # Folded record fan: invented plain paper geometry, not a devotional object.
    s.polygon([(6, 22), (2, 17), (8, 18), (11, 23)], "outline")
    s.line([(3, 18), (9, 22)], "paper", 2)
    s.pixel(5, 18, "accent")
    s.line([(12, 29), (19, 29)], "accent")
    draw_head(s, "aya")


def draw_lise(s: Sprite):
    draw_legs(s, long_coat=True)
    # Wind-broken cape gives a different rear contour from the coat.
    s.polygon([(9, 18), (20, 18), (24, 27), (22, 36), (17, 32), (11, 37), (7, 27)], "outline")
    s.polygon([(10, 19), (19, 19), (22, 27), (20, 33), (16, 30), (12, 34), (9, 27)], "primary")
    s.rect((12, 20, 19, 30), "secondary")
    s.line([(13, 21), (18, 29)], "light")
    # Compact crossbow held across body and needle-thin rapier at hip.
    s.line([(5, 24), (24, 24)], "outline", 2)
    s.line([(7, 23), (11, 20), (16, 24), (21, 20), (24, 23)], "brass")
    s.line([(22, 27), (27, 40)], "metal")
    s.pixel(27, 41, "paper")
    draw_head(s, "lise")


def draw_mateus(s: Sprite):
    draw_legs(s, long_coat=True)
    # High collar and one unbroken narrow coat line create the still silhouette.
    s.rect((11, 16, 20, 21), "outline")
    s.rect((13, 16, 18, 20), "light")
    s.polygon([(10, 20), (21, 20), (22, 38), (19, 42), (12, 42), (9, 38)], "outline")
    s.polygon([(11, 21), (20, 21), (20, 37), (18, 40), (13, 40), (11, 37)], "primary")
    s.rect((15, 21, 16, 38), "secondary")
    s.rect((11, 24, 13, 34), "light")
    s.rect((18, 24, 20, 34), "light")
    s.pixel(15, 24, "accent")
    # Plain keys, three distinct teeth, no emblem.
    s.line([(21, 29), (25, 34)], "brass")
    s.rect((24, 33, 26, 35), "outline")
    s.pixel(25, 34, "brass")
    s.line([(25, 35), (27, 39)], "metal")
    s.pixel(27, 39, "brass")
    draw_head(s, "mateus")


def draw_genta(s: Sprite):
    draw_legs(s)
    # Wide mantle: 24px shoulder span versus the party's usual 13-16px.
    s.polygon([(5, 19), (10, 16), (21, 16), (27, 20), (24, 27), (21, 24), (21, 37), (10, 37), (10, 25), (7, 27)], "outline")
    s.polygon([(7, 20), (11, 18), (20, 18), (25, 20), (23, 24), (20, 22), (19, 34), (12, 34), (11, 22), (8, 24)], "primary")
    s.rect((12, 21, 19, 30), "secondary")
    s.rect((11, 24, 20, 26), "light")
    s.pixel(12, 23, "brass")
    s.pixel(19, 23, "brass")
    # Shield face is blank battered metal; maul head is a rectangular counter-mass.
    shield_x = 2
    s.polygon([(shield_x, 23), (shield_x + 6, 21), (shield_x + 8, 25), (shield_x + 7, 36), (shield_x + 3, 39), (shield_x, 34)], "outline")
    s.polygon([(shield_x + 1, 24), (shield_x + 5, 23), (shield_x + 6, 26), (shield_x + 6, 34), (shield_x + 3, 37), (shield_x + 1, 33)], "metal")
    s.line([(23, 17), (27, 39)], "brass", 2)
    s.rect((22, 14, 29, 20), "outline")
    s.rect((23, 15, 28, 18), "metalDark")
    s.pixel(27, 15, "brass")
    draw_head(s, "genta")


def draw_kiku(s: Sprite):
    draw_legs(s)
    s.polygon([(9, 18), (22, 18), (24, 27), (21, 35), (17, 32), (14, 36), (8, 31), (7, 25)], "outline")
    s.polygon([(10, 19), (21, 19), (22, 27), (20, 32), (17, 30), (14, 34), (10, 30), (9, 25)], "primary")
    s.rect((12, 20, 19, 27), "secondary")
    s.line([(10, 24), (20, 30)], "light")
    # Medicine case has shelves and closures, not script or ritual marks.
    box_x = 22
    s.rect((box_x, 22, box_x + 7, 34), "outline")
    s.rect((box_x + 1, 23, box_x + 6, 32), "secondary")
    s.line([(box_x + 1, 27), (box_x + 6, 27)], "primary")
    s.pixel(box_x + 3, 24, "accent")
    s.pixel(box_x + 4, 30, "brass")
    # Bottle and packet hang separately for a recognizable tool cluster.
    s.rect((4, 25, 7, 31), "outline")
    s.rect((5, 26, 6, 29), "accent")
    s.pixel(5, 30, "paper")
    s.polygon([(7, 33), (11, 32), (12, 37), (8, 38)], "outline")
    s.rect((8, 33, 10, 36), "paper")
    draw_head(s, "kiku")


DRAWERS = {
    "ren": draw_ren,
    "aya": draw_aya,
    "lise": draw_lise,
    "mateus": draw_mateus,
    "genta": draw_genta,
    "kiku": draw_kiku,
}


def draw_field_pose_overlay(sprite: Sprite, character_id: str, state: str):
    """Add small event-readable gestures without introducing prop iconography."""
    if state == "interact":
        reaches = {
            "ren": ((18, 25), (23, 23), (27, 20)),
            "aya": ((18, 25), (23, 22), (27, 21)),
            "lise": ((19, 25), (23, 23), (27, 22)),
            "mateus": ((19, 25), (23, 24), (27, 21)),
            "genta": ((19, 26), (23, 25), (27, 23)),
            "kiku": ((18, 25), (23, 24), (27, 22)),
        }
        start, elbow, hand = reaches[character_id]
        sprite.line([start, elbow, hand], "outline", 4)
        sprite.line([start, elbow, hand], "primary", 2)
        sprite.rect((hand[0] - 1, hand[1] - 1, hand[0] + 1, hand[1] + 1), "skin")
        sprite.line([(27, 16), (29, 14)], "candle")
        sprite.line([(28, 18), (30, 18)], "brass")
    elif state == "hurt":
        # Cross-body brace and two plain recoil ticks; no wound, blood, or injury detail.
        sprite.line([(21, 22), (17, 27), (12, 25)], "outline", 5)
        sprite.line([(20, 22), (17, 26), (13, 25)], "primary", 2)
        sprite.rect((11, 24, 13, 27), "skinShadow")
        sprite.line([(26, 16), (29, 13)], "candle", 2)
        sprite.line([(27, 20), (30, 19)], "brass", 2)
        sprite.line([(24, 13), (25, 10)], "outline")


def render_sprite(source: dict, character: dict, column: str) -> Image.Image:
    direction, state = column.split("-", 1)
    sprite = Sprite(base_palette(source, character), direction, state)
    DRAWERS[character["id"]](sprite)
    if state in source["poseSemantics"]:
        draw_field_pose_overlay(sprite, character["id"], state)
    validate_frame(sprite.image, character["id"], column)
    return sprite.image


def validate_frame(image: Image.Image, character_id: str, column: str):
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError(f"empty frame: {character_id}/{column}")
    # The full outer pixel border and bottom three rows are real transparent gutters.
    for x in range(FRAME_W):
        if alpha.getpixel((x, 0)) or alpha.getpixel((x, FRAME_H - 1)):
            raise ValueError(f"vertical gutter breach: {character_id}/{column}")
    for y in range(FRAME_H):
        if alpha.getpixel((0, y)) or alpha.getpixel((FRAME_W - 1, y)):
            raise ValueError(f"horizontal gutter breach: {character_id}/{column}")
    if any(alpha.getpixel((x, y)) for y in (45, 46, 47) for x in range(FRAME_W)):
        raise ValueError(f"foot gutter breach: {character_id}/{column}")


def render_runtime(source: dict) -> tuple[Image.Image, list[dict]]:
    sheet = Image.new("RGBA", (FRAME_W * len(SHEET_COLUMNS), FRAME_H * len(SHEET_ROWS)), (0, 0, 0, 0))
    frames = []
    characters = {entry["id"]: entry for entry in source["characters"]}
    for row, character_id in enumerate(SHEET_ROWS):
        for column, tag in enumerate(SHEET_COLUMNS):
            sprite = render_sprite(source, characters[character_id], tag)
            x, y = column * FRAME_W, row * FRAME_H
            sheet.alpha_composite(sprite, (x, y))
            frames.append({
                "id": f"{character_id}-{tag}",
                "characterId": character_id,
                "tag": tag,
                "direction": tag.split("-")[0],
                "state": tag.split("-", 1)[1],
                "rect": [x, y, FRAME_W, FRAME_H],
                "pivot": [16, 44],
                "footPoint": [16, 44],
                "localAlphaBounds": list(sprite.getchannel("A").getbbox()),
                "rgbaSha256": sha256(sprite.tobytes()),
            })
    return sheet, frames


FONT = {
    "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
    "B": ("11110", "10001", "10001", "11110", "10001", "10001", "11110"),
    "C": ("01111", "10000", "10000", "10000", "10000", "10000", "01111"),
    "D": ("11110", "10001", "10001", "10001", "10001", "10001", "11110"),
    "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
    "G": ("01111", "10000", "10000", "10111", "10001", "10001", "01111"),
    "H": ("10001", "10001", "10001", "11111", "10001", "10001", "10001"),
    "I": ("11111", "00100", "00100", "00100", "00100", "00100", "11111"),
    "K": ("10001", "10010", "10100", "11000", "10100", "10010", "10001"),
    "L": ("10000", "10000", "10000", "10000", "10000", "10000", "11111"),
    "M": ("10001", "11011", "10101", "10101", "10001", "10001", "10001"),
    "N": ("10001", "11001", "10101", "10011", "10001", "10001", "10001"),
    "O": ("01110", "10001", "10001", "10001", "10001", "10001", "01110"),
    "R": ("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
    "S": ("01111", "10000", "10000", "01110", "00001", "00001", "11110"),
    "T": ("11111", "00100", "00100", "00100", "00100", "00100", "00100"),
    "U": ("10001", "10001", "10001", "10001", "10001", "10001", "01110"),
    "V": ("10001", "10001", "10001", "10001", "10001", "01010", "00100"),
    "W": ("10001", "10001", "10001", "10101", "10101", "11011", "10001"),
    "Y": ("10001", "10001", "01010", "00100", "00100", "00100", "00100"),
    "-": ("00000", "00000", "00000", "11111", "00000", "00000", "00000"),
    " ": ("00000",) * 7,
}


def draw_label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, color: tuple[int, int, int, int], scale: int = 2):
    x, y = xy
    for character in text.upper():
        glyph = FONT.get(character, FONT[" "])
        for gy, row in enumerate(glyph):
            for gx, value in enumerate(row):
                if value == "1":
                    draw.rectangle((x + gx * scale, y + gy * scale, x + (gx + 1) * scale - 1, y + (gy + 1) * scale - 1), fill=color)
        x += 6 * scale


def render_contact(runtime: Image.Image) -> Image.Image:
    scale = 4
    left = 80
    top = 42
    cell_w = FRAME_W * scale
    cell_h = FRAME_H * scale
    width = left + cell_w * len(SHEET_COLUMNS) + 16
    height = top + cell_h * len(SHEET_ROWS) + 16
    contact = Image.new("RGBA", (width, height), rgba("#0b1020"))
    draw = ImageDraw.Draw(contact)
    draw.rectangle((left - 1, top - 1, width - 17, height - 17), outline=rgba("#4f7392"))
    for index, column in enumerate(SHEET_COLUMNS):
        short = column.replace("north", "N").replace("east", "E").replace("south", "S").replace("west", "W").replace("idle", "IDLE").replace("walk", "WALK")
        draw_label(draw, (left + index * cell_w + 5, 10), short, rgba("#d7c99a"), 1)
    for index, character_id in enumerate(SHEET_ROWS):
        draw_label(draw, (8, top + index * cell_h + 88), character_id, rgba("#d7c99a"), 2)
    for row in range(len(SHEET_ROWS)):
        for column in range(len(SHEET_COLUMNS)):
            frame = runtime.crop((column * FRAME_W, row * FRAME_H, (column + 1) * FRAME_W, (row + 1) * FRAME_H))
            frame = frame.resize((cell_w, cell_h), Image.Resampling.NEAREST)
            x, y = left + column * cell_w, top + row * cell_h
            checker = Image.new("RGBA", (cell_w, cell_h), rgba("#16233a"))
            checker_draw = ImageDraw.Draw(checker)
            for cy in range(0, cell_h, 16):
                for cx in range(0, cell_w, 16):
                    if (cx // 16 + cy // 16) % 2:
                        checker_draw.rectangle((cx, cy, cx + 15, cy + 15), fill=rgba("#202d3d"))
            contact.alpha_composite(checker, (x, y))
            contact.alpha_composite(frame, (x, y))
            draw.rectangle((x, y, x + cell_w - 1, y + cell_h - 1), outline=rgba("#27466b"))
            # Pivot marker is outside/under the sprite pixels and only on this review sheet.
            px, py = x + 16 * scale, y + 44 * scale
            draw.line((px - 4, py, px + 4, py), fill=rgba("#88c8c5"))
            draw.line((px, py - 4, px, py + 4), fill=rgba("#88c8c5"))
    return contact


def build_files() -> dict[str, bytes]:
    source, extension = load_source()
    runtime, frames = render_runtime(source)
    legacy_lines = [
        f"{frame['id']}:{frame['rgbaSha256']}"
        for frame in frames
        if frame["tag"] in LEGACY_COLUMNS
    ]
    legacy_digest = sha256(("\n".join(legacy_lines) + "\n").encode("utf-8"))
    expected_legacy_digest = extension["animationSemantics"]["legacyFrameRgbaSha256Digest"]
    if legacy_digest != expected_legacy_digest:
        raise ValueError(
            "legacy party-field frame pixels changed: "
            f"expected {expected_legacy_digest}, got {legacy_digest}"
        )
    contact = render_contact(runtime)
    runtime_data = png_bytes(runtime)
    contact_data = png_bytes(contact)
    source_data = SOURCE_PATH.read_bytes()
    extension_source_data = EXTENSION_SOURCE_PATH.read_bytes()
    builder_data = Path(__file__).read_bytes()
    palettes = {entry["id"]: entry["paletteId"] for entry in source["characters"]}
    alpha = runtime.getchannel("A")
    unique_rgba = sorted(set(runtime.getdata()))
    manifest = {
        "assetId": source["assetId"],
        "status": "production-foundation-review",
        "authorship": source["authorship"],
        "geometry": {
            "frameWidth": FRAME_W,
            "frameHeight": FRAME_H,
            "columns": len(SHEET_COLUMNS),
            "rows": len(SHEET_ROWS),
            "sheetWidth": runtime.width,
            "sheetHeight": runtime.height,
            "pivot": [16, 44],
            "footPoint": [16, 44],
            "transparentGutter": 1,
            "alphaBoundingBox": list(alpha.getbbox()),
        },
        "layerOrder": ["rear-tools", "feet", "body-and-cloth", "front-tools", "head-and-face", "one-pixel-material-highlights"],
        "rowOrder": list(SHEET_ROWS),
        "columnOrder": list(SHEET_COLUMNS),
        "poseSemantics": source["poseSemantics"],
        "animationSemantics": extension["animationSemantics"],
        "paletteIds": palettes,
        "frames": frames,
        "sources": [
            {"path": SOURCE_PATH.name, "format": "json", "sha256": sha256(source_data)},
            {"path": EXTENSION_SOURCE_PATH.name, "format": "json", "sha256": sha256(extension_source_data)},
            {"path": Path(__file__).name, "format": "python", "sha256": sha256(builder_data)},
        ],
        "exports": [
            {"path": RUNTIME_PNG, "purpose": "transparent-runtime-candidate", "width": runtime.width, "height": runtime.height, "mode": runtime.mode, "sha256": sha256(runtime_data)},
            {"path": CONTACT_PNG, "purpose": "labeled-review-only-not-runtime", "width": contact.width, "height": contact.height, "mode": contact.mode, "sha256": sha256(contact_data)},
        ],
        "validation": {
            "frameCount": len(frames),
            "legacyFrameCount": len(legacy_lines),
            "legacyFrameRgbaSha256Digest": legacy_digest,
            "uniqueRgbaValues": len(unique_rgba),
            "allOuterFrameBordersTransparent": True,
            "bottomTransparentRowsPerFrame": 3,
            "deterministicCommand": "python build_party_field_suite.py --check",
        },
        "review": {
            "internalArtDirectionConstraints": "applied",
            "externalCulturalReview": "pending",
            "runtimeIntegration": "current-browser-selectable-field-leader-two-phase-directional-walk-interact-hurt",
            "fullAnimationExpansion": "alternate-action-facings-and-additional-inbetweens-pending",
        },
    }
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    readme = f"""# Party field suite foundation\n\nThis directory contains an original, code-authored 32 x 48 field-sprite foundation for the six canonical party members. Pixels are drawn from the editable JSON palette and deterministic Pillow primitives; no generated atlas or concept pixels are inputs.\n\n## Files\n\n- `{SOURCE_PATH.name}`: byte-stable canonical frame, palette, silhouette, row, and legacy-column contract shared by the combat and portrait pipelines.\n- `{EXTENSION_SOURCE_PATH.name}`: editable four-column directional-walk in-between extension and legacy-hash contract.\n- `{Path(__file__).name}`: deterministic native-resolution pixel builder.\n- `{RUNTIME_PNG}`: transparent {runtime.width} x {runtime.height} flattened sheet; current browser runtime input.\n- `{CONTACT_PNG}`: labeled {contact.width} x {contact.height} review sheet with checkerboard and cyan pivot marks; never use it at runtime.\n- `{MANIFEST_JSON}`: frame rectangles, stable pivots, per-cell RGBA hashes, palette IDs, dimensions, and review state.\n\nRows are `ren`, `aya`, `lise`, `mateus`, `genta`, `kiku`. The first ten columns retain the original north/east/south/west idle/walk cells plus south interact and south hurt. Four appended `walk-b` cells provide the complementary directional step. All six rows are authored and addressable; the current field leader is Ren, so live Campaign movement samples Ren's pair while the other five pairs are ready for a future leader/formation authority. Standing and reduced-motion presentation use the original idle cell. Interact is a brief reach driven by the rendered field control; hurt is a non-gory recoil driven only by committed `hazard-hit` events. Every frame has a 32 x 48 logical box, pivot/foot point `(16, 44)`, a transparent outer border, and three transparent rows below the feet. The builder verifies a single digest over all 60 legacy frame IDs and RGBA hashes before it can emit files.\n\nRun `python build_party_field_suite.py` to rebuild. Run `python build_party_field_suite.py --check` to build in memory and byte-compare all generated outputs.\n\n## Scope and limits\n\nThis is a readable field key-pose suite with a minimal two-phase directional walk for the active Ren field leader and authored matching keys for the other five members, not the complete 4-6 frame idle or 6-8 frame walk requirement. It establishes character silhouettes, four-direction movement, foot registration, palette ownership, and live interaction/hazard reactions. A selectable leader or visible formation, alternate facings and in-betweens for interaction and recoil, portraits, and external cultural review remain separate approval work. Mateus uses an original fictional face and proportions. Costume and tool marks use only plain, invented geometry; there are no sacred-object props.\n"""
    readme = readme.replace(
        "All six rows are authored and addressable; the current field leader is Ren, so live Campaign movement samples Ren's pair while the other five pairs are ready for a future leader/formation authority.",
        "All six rows are authored, addressable, and reachable through Campaign's level-formation-owned field-leader selector wherever that member is present. Old saves and formations without the preferred member fall back to the formation's first canonical member without erasing the preference.",
    ).replace(
        "Interact is a brief reach driven by the rendered field control; hurt is a non-gory recoil driven only by committed `hazard-hit` events.",
        "Interact is a brief reach driven by the rendered field control; hurt is a non-gory recoil driven only by committed `hazard-hit` events and follows the visible leader.",
    ).replace(
        "This is a readable field key-pose suite with a minimal two-phase directional walk for the active Ren field leader and authored matching keys for the other five members, not the complete 4-6 frame idle or 6-8 frame walk requirement.",
        "This is a readable field key-pose suite with a selectable two-phase directional walk for all six formation-owned field leaders, not the complete 4-6 frame idle or 6-8 frame walk requirement.",
    ).replace(
        "A selectable leader or visible formation, alternate facings",
        "A visible following formation, alternate facings",
    )
    return {
        RUNTIME_PNG: runtime_data,
        CONTACT_PNG: contact_data,
        MANIFEST_JSON: manifest_data,
        README_MD: readme.encode("utf-8"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify generated files are byte-identical")
    args = parser.parse_args()
    files = build_files()
    if args.check:
        errors = []
        for name, expected in files.items():
            path = ROOT / name
            if not path.exists():
                errors.append(f"missing {name}")
            elif path.read_bytes() != expected:
                errors.append(f"stale {name}")
        if errors:
            for error in errors:
                print(error, file=sys.stderr)
            return 1
        print(f"OK: {len(files)} generated files are byte-identical")
        return 0
    for name, data in files.items():
        (ROOT / name).write_bytes(data)
        print(f"wrote {name}: {len(data)} bytes sha256={sha256(data)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
