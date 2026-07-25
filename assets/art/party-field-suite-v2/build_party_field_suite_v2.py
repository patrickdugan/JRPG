from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "party-field-suite-v2.source.json"
CANONICAL_PATH = ROOT.parent / "party-field-suite" / "party-field-suite.source.json"
RUNTIME_ROOT = ROOT.parents[2] / "game" / "assets" / "art" / "party-field-suite-v2"

ATLAS_NAME = "party-field-atlas-v2.png"
CONTACT_NAME = "party-field-contact-sheet-v2.png"
MOTION_NAME = "party-field-motion-preview-v2.gif"
MANIFEST_NAME = "manifest.json"

FRAME_W = 40
FRAME_H = 56
PIVOT = (20, 52)
ROWS = ("ren", "aya", "lise", "mateus", "genta", "kiku", "miyo")
DIRECTIONS = ("north", "east", "south", "west")
PHASES = ("contact", "compression", "passing", "extension")
COLUMNS = tuple(
    f"{direction}-{state}"
    for direction in DIRECTIONS
    for state in ("idle", *PHASES)
) + ("south-interact", "south-hurt")

OUTLINE = "#0b1020"
DEEP = "#16233a"
SKIN_SHADOW = "#8b6043"
SKIN = "#c58b63"
SKIN_LIGHT = "#d7b080"
PAPER = "#d7c99a"
CANDLE = "#f6e8b9"
METAL_DARK = "#394b59"
METAL = "#637462"
BRASS = "#a08b58"
WHITE = "#f6e8b9"

DISPLAY_NAMES = {
    "ren": "REN",
    "aya": "AYA",
    "lise": "NIKOLA",
    "mateus": "MATEUS",
    "genta": "GENTA",
    "kiku": "KIKU",
    "miyo": "MIYO",
}


def rgba(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (alpha,)


def shade(value: str, factor: float) -> str:
    value = value.lstrip("#")
    channels = [int(value[index:index + 2], 16) for index in (0, 2, 4)]
    if factor >= 1:
        channels = [round(channel + (255 - channel) * (factor - 1)) for channel in channels]
    else:
        channels = [round(channel * factor) for channel in channels]
    return "#" + "".join(f"{max(0, min(255, channel)):02x}" for channel in channels)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def gif_bytes(frames: list[Image.Image], durations: list[int]) -> bytes:
    stream = io.BytesIO()
    frames[0].save(
        stream,
        format="GIF",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=False,
    )
    return stream.getvalue()


def load_contracts() -> tuple[dict, dict]:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    canonical = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
    assert source["classification"] == "pixel-authored-production-asset"
    assert source["authorship"] == "original-code-native-pixel-primitives"
    assert source["frame"] == {
        "width": FRAME_W,
        "height": FRAME_H,
        "pivot": list(PIVOT),
        "footPoint": list(PIVOT),
        "transparentGutter": 1,
        "alphaPolicy": "binary",
    }
    assert tuple(source["rows"]) == ROWS
    assert tuple(source["directions"]) == DIRECTIONS
    assert tuple(source["walkPhases"]) == PHASES
    assert tuple(source["columns"]) == COLUMNS
    assert tuple(character["id"] for character in source["characters"]) == ROWS
    assert tuple(character["id"] for character in canonical["characters"]) == ROWS
    return source, canonical


def palette_for(canonical: dict, character_id: str) -> dict[str, str]:
    character = next(entry for entry in canonical["characters"] if entry["id"] == character_id)
    colors = {**canonical["sharedPalette"], **character["colors"]}
    colors.update({
        "outline": OUTLINE,
        "deep": DEEP,
        "skinShadow": SKIN_SHADOW,
        "skin": SKIN,
        "skinLight": SKIN_LIGHT,
        "paper": PAPER,
        "candle": CANDLE,
        "metalDark": METAL_DARK,
        "metal": METAL,
        "brass": BRASS,
        "primaryShadow": shade(colors["primary"], 0.62),
        "primaryHighlight": shade(colors["primary"], 1.28),
        "secondaryShadow": shade(colors["secondary"], 0.66),
        "secondaryHighlight": shade(colors["secondary"], 1.2),
        "hairHighlight": shade(colors["hair"], 1.42),
    })
    return colors


class Cel:
    def __init__(self, palette: dict[str, str], direction: str, state: str):
        self.image = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)
        self.c = {key: rgba(value) for key, value in palette.items()}
        self.direction = direction
        self.state = state
        self.phase = PHASES.index(state) if state in PHASES else None
        self.bob = (0, 1, 0, -1)[self.phase] if self.phase is not None else (-1 if state == "hurt" else 0)
        self.body_shift = 0

    def color(self, key: str):
        return self.c[key]

    def rect(self, box, fill: str, outline: str | None = None, width: int = 1):
        self.draw.rectangle(tuple(round(value) for value in box), fill=self.color(fill), outline=self.color(outline) if outline else None, width=width)

    def poly(self, points, fill: str, outline: str | None = None, width: int = 1):
        points = [(round(x), round(y)) for x, y in points]
        self.draw.polygon(points, fill=self.color(fill))
        if outline:
            self.draw.line(points + [points[0]], fill=self.color(outline), width=width, joint="curve")

    def line(self, points, fill: str, width: int = 1):
        self.draw.line([(round(x), round(y)) for x, y in points], fill=self.color(fill), width=width)


def draw_weapon_behind(cel: Cel, character_id: str):
    y = cel.bob
    direction = cel.direction
    if character_id == "ren":
        if direction in ("south", "north"):
            x = 8 if direction == "south" else 31
            cel.line([(x, 9 + y), (x, 50)], "outline", 3)
            cel.line([(x, 9 + y), (x, 50)], "metalDark", 1)
            cel.poly([(x, 5 + y), (x - 3, 11 + y), (x + 3, 11 + y)], "metal", "outline")
            cel.line([(x - 1, 6 + y), (x - 1, 10 + y)], "primaryHighlight")
        else:
            cel.line([(7, 47), (32, 12 + y)], "outline", 3)
            cel.line([(7, 47), (32, 12 + y)], "metalDark")
            cel.poly([(34, 7 + y), (29, 13 + y), (34, 14 + y)], "metal", "outline")
    elif character_id == "aya":
        if direction == "east":
            cel.rect((9, 22 + y, 15, 40 + y), "deep", "outline", 2)
            cel.rect((10, 24 + y, 13, 37 + y), "secondaryShadow")
        else:
            x0 = 8 if direction == "south" else 25
            cel.rect((x0, 22 + y, x0 + 7, 41 + y), "deep", "outline", 2)
            cel.rect((x0 + 2, 24 + y, x0 + 5, 38 + y), "secondaryShadow")
    elif character_id == "lise":
        if direction == "east":
            cel.line([(8, 48), (32, 13 + y)], "outline", 4)
            cel.line([(8, 48), (32, 13 + y)], "metalDark", 2)
            cel.rect((6, 46, 10, 50), "brass", "outline")
        else:
            cel.line([(9, 47), (31, 18 + y)], "outline", 4)
            cel.line([(9, 47), (31, 18 + y)], "metalDark", 2)
            cel.rect((7, 45, 11, 49), "brass", "outline")
    elif character_id == "mateus":
        cel.poly([(11, 23 + y), (29, 23 + y), (31, 48), (23, 46), (20, 50), (16, 46), (9, 48)], "secondaryShadow", "outline")
    elif character_id == "genta":
        if direction == "east":
            cel.line([(9, 46), (30, 12 + y)], "outline", 5)
            cel.line([(9, 46), (30, 12 + y)], "metalDark", 3)
            cel.rect((27, 8 + y, 35, 15 + y), "metal", "outline", 2)
        else:
            cel.line([(9, 12 + y), (31, 47)], "outline", 5)
            cel.line([(9, 12 + y), (31, 47)], "metalDark", 3)
            cel.rect((6, 8 + y, 14, 15 + y), "metal", "outline", 2)
    elif character_id == "kiku":
        x0 = 26 if direction != "north" else 7
        cel.rect((x0, 23 + y, x0 + 8, 42 + y), "paper", "outline", 2)
        cel.rect((x0 + 2, 25 + y, x0 + 6, 39 + y), "secondary")
        cel.rect((x0 + 3, 27 + y, x0 + 5, 29 + y), "accent")
    elif character_id == "miyo":
        if direction == "east":
            cel.line([(8, 43), (33, 15 + y)], "outline", 4)
            cel.line([(8, 43), (33, 15 + y)], "accent", 2)
            cel.rect((17, 31 + y, 21, 35 + y), "brass", "outline")
        else:
            cel.line([(8, 43), (31, 18 + y)], "outline", 4)
            cel.line([(8, 43), (31, 18 + y)], "accent", 2)
            cel.rect((17, 31 + y, 21, 35 + y), "brass", "outline")


def draw_legs(cel: Cel, broad: bool = False, long_coat: bool = False):
    y = cel.bob
    width = 5 if broad else 4
    if cel.direction in ("south", "north"):
        if cel.phase is None:
            left_y, right_y = 45 + y, 45 + y
        else:
            left_y, right_y = ((46, 43), (45, 44), (43, 46), (43, 47))[cel.phase]
        left_x = 14 - (1 if broad else 0)
        right_x = 22
        cel.rect((left_x, left_y, left_x + width, min(51, left_y + 6)), "outline")
        cel.rect((right_x, right_y, right_x + width, min(51, right_y + 6)), "outline")
        cel.rect((left_x + 1, left_y, left_x + width - 1, min(49, left_y + 4)), "deep")
        cel.rect((right_x + 1, right_y, right_x + width - 1, min(49, right_y + 4)), "deep")
        cel.rect((left_x - 1, min(51, left_y + 5), left_x + width, min(51, left_y + 6)), "outline")
        cel.rect((right_x - 1, min(51, right_y + 5), right_x + width, min(51, right_y + 6)), "outline")
    else:
        positions = ((15, 23), (17, 22), (20, 18), (22, 16))[cel.phase] if cel.phase is not None else (18, 22)
        back_x, front_x = positions
        base_y = 44 + y
        cel.rect((back_x - 2, base_y, back_x + 2, min(51, base_y + 6)), "outline")
        cel.rect((front_x, base_y - 1, front_x + width, min(51, base_y + 5)), "outline")
        cel.rect((back_x - 1, base_y, back_x + 1, min(49, base_y + 4)), "deep")
        cel.rect((front_x + 1, base_y - 1, front_x + width - 1, min(49, base_y + 3)), "deep")
    if long_coat:
        cel.rect((18 + cel.body_shift, 41 + y, 22 + cel.body_shift, 47 + y), "secondaryShadow")


def draw_body(cel: Cel, character_id: str, *, broad: bool = False, long_coat: bool = False):
    x = cel.body_shift
    y = cel.bob
    if cel.direction == "south":
        outer = [(10 + x, 23 + y), (14 + x, 20 + y), (26 + x, 20 + y), (30 + x, 23 + y), (28 + x, 42 + y), (24 + x, 46 + y), (16 + x, 46 + y), (12 + x, 42 + y)]
        inner = [(13 + x, 24 + y), (16 + x, 22 + y), (24 + x, 22 + y), (27 + x, 24 + y), (25 + x, 41 + y), (22 + x, 44 + y), (17 + x, 44 + y), (14 + x, 41 + y)]
    elif cel.direction == "north":
        outer = [(10 + x, 24 + y), (14 + x, 20 + y), (26 + x, 20 + y), (30 + x, 24 + y), (28 + x, 43 + y), (23 + x, 46 + y), (16 + x, 46 + y), (12 + x, 43 + y)]
        inner = [(13 + x, 25 + y), (16 + x, 22 + y), (24 + x, 22 + y), (27 + x, 25 + y), (25 + x, 41 + y), (22 + x, 44 + y), (17 + x, 44 + y), (14 + x, 41 + y)]
    else:
        outer = [(12 + x, 24 + y), (16 + x, 20 + y), (25 + x, 21 + y), (29 + x, 25 + y), (27 + x, 43 + y), (23 + x, 46 + y), (16 + x, 45 + y), (13 + x, 40 + y)]
        inner = [(15 + x, 25 + y), (17 + x, 22 + y), (23 + x, 23 + y), (26 + x, 26 + y), (24 + x, 41 + y), (21 + x, 44 + y), (17 + x, 43 + y), (16 + x, 39 + y)]
    cel.poly(outer, "outline")
    cel.poly(inner, "primary")

    if broad:
        cel.rect((10 + x, 23 + y, 15 + x, 31 + y), "metalDark", "outline")
        cel.rect((25 + x, 23 + y, 30 + x, 31 + y), "metalDark", "outline")
        cel.rect((11 + x, 24 + y, 14 + x, 27 + y), "metal")
        cel.rect((26 + x, 24 + y, 29 + x, 27 + y), "metal")
    else:
        cel.poly([(11 + x, 24 + y), (14 + x, 22 + y), (16 + x, 26 + y), (14 + x, 37 + y), (10 + x, 35 + y)], "primaryShadow", "outline")
        if cel.state == "interact":
            cel.poly([(25 + x, 22 + y), (28 + x, 23 + y), (35 + x, 20 + y), (37 + x, 22 + y), (29 + x, 28 + y), (25 + x, 27 + y)], "secondary", "outline")
            cel.rect((35 + x, 19 + y, 38 + x, 23 + y), "skin", "outline")
        else:
            cel.poly([(25 + x, 22 + y), (29 + x, 24 + y), (30 + x, 35 + y), (26 + x, 37 + y), (24 + x, 27 + y)], "secondaryShadow", "outline")

    if long_coat:
        cel.poly([(13 + x, 33 + y), (27 + x, 33 + y), (29 + x, 47 + y), (22 + x, 45 + y), (20 + x, 49 + y), (17 + x, 45 + y), (11 + x, 47 + y)], "primaryShadow", "outline")
        cel.line([(20 + x, 34 + y), (20 + x, 46 + y)], "secondary")

    cel.line([(14 + x, 31 + y), (26 + x, 31 + y)], "primaryHighlight")
    cel.line([(15 + x, 39 + y), (24 + x, 42 + y)], "primaryShadow")
    if cel.direction == "north":
        cel.line([(14 + x, 25 + y), (25 + x, 24 + y)], "primaryHighlight")


def draw_head(cel: Cel, character_id: str):
    x = cel.body_shift
    y = cel.bob + (-2 if cel.state == "hurt" else 0)
    hair = "hair"
    if cel.direction == "south":
        cel.poly([(13 + x, 11 + y), (16 + x, 8 + y), (24 + x, 8 + y), (27 + x, 11 + y), (26 + x, 20 + y), (23 + x, 23 + y), (16 + x, 22 + y), (13 + x, 19 + y)], "outline")
        cel.rect((15 + x, 12 + y, 25 + x, 20 + y), "skin")
        cel.poly([(14 + x, 11 + y), (16 + x, 9 + y), (24 + x, 9 + y), (26 + x, 12 + y), (24 + x, 14 + y), (19 + x, 13 + y), (16 + x, 15 + y), (14 + x, 14 + y)], hair)
        cel.line([(16 + x, 10 + y), (22 + x, 9 + y)], "hairHighlight")
        cel.rect((16 + x, 16 + y, 17 + x, 17 + y), "outline")
        cel.rect((23 + x, 16 + y, 24 + x, 17 + y), "outline")
        cel.rect((19 + x, 18 + y, 21 + x, 19 + y), "skinLight")
        if character_id in ("lise", "mateus", "genta"):
            cel.line([(17 + x, 20 + y), (23 + x, 20 + y)], "hair")
        if character_id == "lise":
            cel.rect((18 + x, 19 + y, 22 + x, 20 + y), "hair")
        if character_id == "mateus":
            cel.rect((17 + x, 9 + y, 24 + x, 10 + y), "hairHighlight")
    elif cel.direction == "north":
        cel.poly([(13 + x, 11 + y), (16 + x, 8 + y), (24 + x, 8 + y), (27 + x, 11 + y), (27 + x, 20 + y), (24 + x, 23 + y), (16 + x, 23 + y), (13 + x, 20 + y)], "outline")
        cel.poly([(15 + x, 11 + y), (17 + x, 9 + y), (23 + x, 9 + y), (25 + x, 11 + y), (25 + x, 19 + y), (22 + x, 21 + y), (17 + x, 21 + y), (15 + x, 19 + y)], hair)
        cel.line([(16 + x, 11 + y), (22 + x, 9 + y), (24 + x, 12 + y)], "hairHighlight")
        cel.line([(15 + x, 18 + y), (20 + x, 21 + y), (25 + x, 18 + y)], "hairHighlight")
    else:
        cel.poly([(14 + x, 11 + y), (17 + x, 8 + y), (24 + x, 9 + y), (28 + x, 13 + y), (27 + x, 20 + y), (23 + x, 23 + y), (16 + x, 21 + y), (14 + x, 18 + y)], "outline")
        cel.poly([(18 + x, 11 + y), (24 + x, 11 + y), (26 + x, 14 + y), (25 + x, 20 + y), (21 + x, 21 + y), (18 + x, 18 + y)], "skin")
        cel.poly([(15 + x, 11 + y), (18 + x, 9 + y), (24 + x, 10 + y), (26 + x, 13 + y), (23 + x, 14 + y), (19 + x, 13 + y), (18 + x, 18 + y), (15 + x, 17 + y)], hair)
        cel.line([(17 + x, 10 + y), (22 + x, 10 + y)], "hairHighlight")
        cel.rect((24 + x, 15 + y, 25 + x, 16 + y), "outline")
        cel.rect((26 + x, 17 + y, 27 + x, 18 + y), "skinLight")
        if character_id in ("lise", "mateus", "genta"):
            cel.line([(22 + x, 20 + y), (25 + x, 20 + y)], "hair")

    if character_id in ("aya", "kiku", "miyo"):
        if cel.direction == "south":
            cel.rect((12 + x, 11 + y, 14 + x, 24 + y), "hair", "outline")
            cel.rect((26 + x, 11 + y, 28 + x, 24 + y), "hair", "outline")
        elif cel.direction == "north":
            cel.rect((12 + x, 12 + y, 15 + x, 24 + y), "hair", "outline")
            cel.rect((25 + x, 12 + y, 28 + x, 24 + y), "hair", "outline")
        else:
            cel.rect((14 + x, 14 + y, 17 + x, 25 + y), "hair", "outline")


def draw_costume_detail(cel: Cel, character_id: str):
    x = cel.body_shift
    y = cel.bob
    if character_id == "ren":
        cel.line([(14 + x, 24 + y), (25 + x, 40 + y)], "accent", 2)
        cel.poly([(21 + x, 34 + y), (28 + x, 33 + y), (29 + x, 41 + y), (24 + x, 44 + y), (20 + x, 40 + y)], "secondaryShadow", "outline")
        cel.rect((24 + x, 34 + y, 26 + x, 36 + y), "brass")
        cel.line([(14 + x, 23 + y), (25 + x, 23 + y)], "secondary")
    elif character_id == "aya":
        cel.poly([(12 + x, 25 + y), (16 + x, 22 + y), (18 + x, 34 + y), (14 + x, 39 + y), (10 + x, 35 + y)], "paper", "outline")
        cel.poly([(24 + x, 23 + y), (28 + x, 25 + y), (30 + x, 35 + y), (26 + x, 39 + y), (22 + x, 34 + y)], "paper", "outline")
        cel.line([(14 + x, 35 + y), (26 + x, 35 + y)], "accent", 2)
        cel.poly([(27 + x, 26 + y), (35 + x, 22 + y), (37 + x, 25 + y), (30 + x, 29 + y)], "paper", "outline")
        cel.line([(30 + x, 27 + y), (35 + x, 23 + y)], "accent")
    elif character_id == "lise":
        cel.poly([(15 + x, 22 + y), (25 + x, 22 + y), (27 + x, 28 + y), (24 + x, 39 + y), (16 + x, 39 + y), (13 + x, 28 + y)], "secondary", "outline")
        cel.rect((17 + x, 23 + y, 23 + x, 27 + y), "paper")
        cel.rect((19 + x, 25 + y, 21 + x, 31 + y), "paper")
        cel.line([(15 + x, 34 + y), (25 + x, 34 + y)], "brass", 2)
        cel.rect((19 + x, 33 + y, 21 + x, 36 + y), "brass", "outline")
        cel.line([(14 + x, 25 + y), (12 + x, 42 + y)], "primaryHighlight")
    elif character_id == "mateus":
        cel.rect((15 + x, 21 + y, 25 + x, 26 + y), "outline")
        cel.poly([(17 + x, 22 + y), (20 + x, 26 + y), (23 + x, 22 + y), (24 + x, 35 + y), (20 + x, 42 + y), (16 + x, 35 + y)], "secondaryShadow")
        cel.line([(14 + x, 28 + y), (14 + x, 43 + y)], "primaryHighlight")
        cel.rect((25 + x, 37 + y, 27 + x, 39 + y), "brass", "outline")
        cel.rect((27 + x, 39 + y, 29 + x, 41 + y), "metal", "outline")
    elif character_id == "genta":
        cel.poly([(8 + x, 25 + y), (14 + x, 20 + y), (17 + x, 25 + y), (16 + x, 43 + y), (10 + x, 46 + y), (6 + x, 40 + y)], "metalDark", "outline", 2)
        cel.line([(9 + x, 27 + y), (14 + x, 24 + y), (14 + x, 40 + y), (9 + x, 42 + y)], "metal")
        cel.line([(16 + x, 29 + y), (26 + x, 29 + y)], "brass", 2)
        cel.rect((18 + x, 22 + y, 24 + x, 25 + y), "secondary")
    elif character_id == "kiku":
        cel.poly([(11 + x, 23 + y), (20 + x, 21 + y), (27 + x, 25 + y), (26 + x, 39 + y), (20 + x, 45 + y), (12 + x, 39 + y)], "primaryHighlight", "outline")
        cel.poly([(12 + x, 29 + y), (25 + x, 34 + y), (21 + x, 44 + y), (13 + x, 39 + y)], "primary")
        cel.rect((28 + x, 27 + y, 31 + x, 31 + y), "accent", "outline")
        cel.rect((29 + x, 32 + y, 32 + x, 37 + y), "paper", "outline")
        cel.line([(14 + x, 27 + y), (18 + x, 31 + y)], "paper")
    elif character_id == "miyo":
        cel.poly([(11 + x, 24 + y), (17 + x, 21 + y), (20 + x, 29 + y), (16 + x, 39 + y), (10 + x, 35 + y)], "primaryHighlight", "outline")
        cel.poly([(23 + x, 22 + y), (29 + x, 25 + y), (30 + x, 35 + y), (25 + x, 40 + y), (21 + x, 29 + y)], "primary", "outline")
        cel.line([(14 + x, 36 + y), (26 + x, 36 + y)], "secondary", 2)
        cel.rect((18 + x, 34 + y, 22 + x, 37 + y), "brass", "outline")
        cel.line([(12 + x, 41 + y), (20 + x, 44 + y), (28 + x, 40 + y)], "secondaryHighlight")

    if cel.state == "hurt":
        cel.line([(29, 16 + y), (35, 12 + y)], "candle", 2)
        cel.line([(30, 12 + y), (35, 17 + y)], "candle", 2)
        cel.rect((32, 14 + y, 33, 15 + y), "accent")
    elif cel.state == "interact":
        cel.rect((36 + x, 17 + y, 37 + x, 18 + y), "candle")
        cel.rect((38 + x, 15 + y, 38 + x, 16 + y), "accent")


def render_sprite(canonical: dict, character_id: str, tag: str) -> Image.Image:
    direction, state = tag.split("-", 1)
    palette = palette_for(canonical, character_id)
    cel = Cel(palette, direction, state)
    broad = character_id == "genta"
    long_coat = character_id == "mateus"
    draw_weapon_behind(cel, character_id)
    draw_legs(cel, broad=broad, long_coat=long_coat)
    draw_body(cel, character_id, broad=broad, long_coat=long_coat)
    draw_costume_detail(cel, character_id)
    draw_head(cel, character_id)
    if direction == "west":
        cel.image = ImageOps.mirror(cel.image)
    return cel.image


def visible_colors(image: Image.Image) -> list[str]:
    return sorted(
        {
            "#{:02x}{:02x}{:02x}".format(red, green, blue)
            for red, green, blue, alpha in image.getdata()
            if alpha
        }
    )


def validate_frame(image: Image.Image, frame_id: str, max_colors: int):
    assert image.mode == "RGBA"
    assert image.size == (FRAME_W, FRAME_H)
    alpha = image.getchannel("A")
    assert set(alpha.getdata()).issubset({0, 255}), f"{frame_id}: alpha must be binary"
    bounds = alpha.getbbox()
    assert bounds, f"{frame_id}: frame is empty"
    assert bounds[0] >= 1 and bounds[1] >= 1 and bounds[2] <= FRAME_W - 1 and bounds[3] <= FRAME_H - 3, f"{frame_id}: gutter breach {bounds}"
    colors = visible_colors(image)
    assert len(colors) <= max_colors, f"{frame_id}: {len(colors)} visible colors exceeds {max_colors}"


def render_atlas(source: dict, canonical: dict) -> tuple[Image.Image, list[dict]]:
    atlas = Image.new("RGBA", (FRAME_W * len(COLUMNS), FRAME_H * len(ROWS)), (0, 0, 0, 0))
    frames = []
    max_colors = source["qualityContract"]["maximumVisibleColorsPerFrame"]
    for row, character_id in enumerate(ROWS):
        for column, tag in enumerate(COLUMNS):
            frame = render_sprite(canonical, character_id, tag)
            frame_id = f"{character_id}:{tag}"
            validate_frame(frame, frame_id, max_colors)
            x = column * FRAME_W
            y = row * FRAME_H
            atlas.alpha_composite(frame, (x, y))
            alpha = frame.getchannel("A")
            colors = visible_colors(frame)
            state = tag.split("-", 1)[1]
            phase = state if state in PHASES else "hold" if state == "idle" else state
            duration = (
                source["animation"]["walkFrameDurationMs"][PHASES.index(state)]
                if state in PHASES
                else source["animation"]["idleFrameDurationMs"]
                if state == "idle"
                else source["animation"][f"{state}FrameDurationMs"]
            )
            frames.append({
                "id": frame_id,
                "characterId": character_id,
                "direction": tag.split("-", 1)[0],
                "state": state,
                "phase": phase,
                "durationMs": duration,
                "rect": [x, y, FRAME_W, FRAME_H],
                "pivot": list(PIVOT),
                "footPoint": list(PIVOT),
                "alphaBounds": list(alpha.getbbox()),
                "opaquePixelCount": sum(1 for value in alpha.getdata() if value),
                "visibleColorCount": len(colors),
                "visibleColors": colors,
                "rgbaSha256": sha256(frame.tobytes()),
            })
    return atlas, frames


def checker(width: int, height: int, tile: int = 8) -> Image.Image:
    image = Image.new("RGBA", (width, height), rgba("#111824"))
    draw = ImageDraw.Draw(image)
    colors = (rgba("#111824"), rgba("#1b2635"))
    for y in range(0, height, tile):
        for x in range(0, width, tile):
            draw.rectangle((x, y, min(width - 1, x + tile - 1), min(height - 1, y + tile - 1)), fill=colors[(x // tile + y // tile) % 2])
    return image


CONTACT_TAGS = (
    "north-idle", "north-contact", "north-passing",
    "east-idle", "east-contact", "east-passing",
    "south-idle", "south-contact", "south-compression", "south-passing", "south-extension",
    "west-idle", "west-contact", "west-passing",
    "south-interact", "south-hurt",
)


def render_contact(atlas: Image.Image) -> Image.Image:
    scale = 3
    label_w = 112
    header_h = 42
    cell_w = FRAME_W * scale
    cell_h = FRAME_H * scale
    output = checker(label_w + len(CONTACT_TAGS) * cell_w, header_h + len(ROWS) * cell_h, 12)
    draw = ImageDraw.Draw(output)
    font = ImageFont.load_default()
    for column, tag in enumerate(CONTACT_TAGS):
        x = label_w + column * cell_w + 4
        draw.text((x, 13), tag.replace("-", " ").upper(), fill=rgba("#d7c99a"), font=font)
    for row, character_id in enumerate(ROWS):
        y = header_h + row * cell_h
        draw.text((10, y + cell_h // 2 - 5), DISPLAY_NAMES[character_id], fill=rgba("#f6e8b9"), font=font)
        for display_column, tag in enumerate(CONTACT_TAGS):
            source_column = COLUMNS.index(tag)
            frame = atlas.crop((source_column * FRAME_W, row * FRAME_H, (source_column + 1) * FRAME_W, (row + 1) * FRAME_H))
            enlarged = frame.resize((cell_w, cell_h), Image.Resampling.NEAREST)
            output.alpha_composite(enlarged, (label_w + display_column * cell_w, y))
            draw.rectangle(
                (label_w + display_column * cell_w, y, label_w + (display_column + 1) * cell_w - 1, y + cell_h - 1),
                outline=rgba("#31546f"),
                width=1,
            )
            pivot_x = label_w + display_column * cell_w + PIVOT[0] * scale
            pivot_y = y + PIVOT[1] * scale
            draw.line((pivot_x - 3, pivot_y, pivot_x + 3, pivot_y), fill=rgba("#88c8c5"))
            draw.line((pivot_x, pivot_y - 3, pivot_x, pivot_y + 3), fill=rgba("#88c8c5"))
    return output.convert("RGBA")


def render_motion_preview(atlas: Image.Image) -> tuple[list[Image.Image], list[int]]:
    scale = 4
    card_w = FRAME_W * scale + 24
    card_h = FRAME_H * scale + 38
    columns = 4
    rows = 2
    frames = []
    durations = []
    font = ImageFont.load_default()
    for direction in DIRECTIONS:
        for phase in PHASES:
            output = checker(card_w * columns, card_h * rows, 12)
            draw = ImageDraw.Draw(output)
            for index, character_id in enumerate(ROWS):
                card_x = (index % columns) * card_w
                card_y = (index // columns) * card_h
                source_column = COLUMNS.index(f"{direction}-{phase}")
                source_row = ROWS.index(character_id)
                frame = atlas.crop((source_column * FRAME_W, source_row * FRAME_H, (source_column + 1) * FRAME_W, (source_row + 1) * FRAME_H))
                enlarged = frame.resize((FRAME_W * scale, FRAME_H * scale), Image.Resampling.NEAREST)
                output.alpha_composite(enlarged, (card_x + 12, card_y + 25))
                draw.text((card_x + 10, card_y + 7), f"{DISPLAY_NAMES[character_id]}  {direction.upper()} / {phase.upper()}", fill=rgba("#f6e8b9"), font=font)
                draw.rectangle((card_x, card_y, card_x + card_w - 1, card_y + card_h - 1), outline=rgba("#31546f"))
            frames.append(output.convert("P", palette=Image.Palette.ADAPTIVE, colors=128))
            durations.append(80)
    return frames, durations


def build_files() -> dict[Path, bytes]:
    source, canonical = load_contracts()
    atlas, frames = render_atlas(source, canonical)
    contact = render_contact(atlas)
    motion_frames, motion_durations = render_motion_preview(atlas)
    atlas_data = png_bytes(atlas)
    contact_data = png_bytes(contact)
    motion_data = gif_bytes(motion_frames, motion_durations)
    palette_ids = {
        entry["id"]: entry["paletteId"]
        for entry in canonical["characters"]
    }
    source_bytes = SOURCE_PATH.read_bytes()
    canonical_bytes = CANONICAL_PATH.read_bytes()
    atlas_alpha = atlas.getchannel("A")
    manifest = {
        "assetId": source["assetId"],
        "formatVersion": source["formatVersion"],
        "classification": source["classification"],
        "authorship": source["authorship"],
        "tool": {
            "builder": Path(__file__).name,
            "pillow": PILLOW_VERSION,
            "resampling": "none-runtime-nearest-review-only",
        },
        "geometry": {
            "frameWidth": FRAME_W,
            "frameHeight": FRAME_H,
            "columns": len(COLUMNS),
            "rows": len(ROWS),
            "sheetWidth": atlas.width,
            "sheetHeight": atlas.height,
            "pivot": list(PIVOT),
            "footPoint": list(PIVOT),
            "transparentGutter": 1,
            "alphaBounds": list(atlas_alpha.getbbox()),
        },
        "rowOrder": list(ROWS),
        "columnOrder": list(COLUMNS),
        "directions": list(DIRECTIONS),
        "walkPhases": list(PHASES),
        "clips": {
            direction: {
                "idle": [f"{direction}-idle"],
                "walk": [f"{direction}-{phase}" for phase in PHASES],
                "frameDurationMs": source["animation"]["walkFrameDurationMs"],
                "loop": True,
            }
            for direction in DIRECTIONS
        } | {
            "interact": {"frames": ["south-interact"], "frameDurationMs": [source["animation"]["interactFrameDurationMs"]], "loop": False},
            "hurt": {"frames": ["south-hurt"], "frameDurationMs": [source["animation"]["hurtFrameDurationMs"]], "loop": False},
        },
        "paletteIds": palette_ids,
        "frames": frames,
        "sources": [
            {
                "path": SOURCE_PATH.name,
                "role": "editable-geometry-timing-quality-contract",
                "sha256": sha256(source_bytes),
            },
            {
                "path": "../party-field-suite/party-field-suite.source.json",
                "role": "canonical-party-palette-and-identity-contract",
                "sha256": sha256(canonical_bytes),
            },
            {
                "path": source["sideViewQualityReference"],
                "role": "visual-quality-reference-not-raster-input",
                "rasterSampled": False,
            },
        ],
        "exports": [
            {"path": ATLAS_NAME, "purpose": "transparent-runtime-atlas", "width": atlas.width, "height": atlas.height, "mode": atlas.mode, "sha256": sha256(atlas_data)},
            {"path": CONTACT_NAME, "purpose": "opaque-review-contact-sheet", "width": contact.width, "height": contact.height, "mode": contact.mode, "previewScale": 3, "sha256": sha256(contact_data)},
            {"path": MOTION_NAME, "purpose": "nearest-neighbor-motion-review", "width": motion_frames[0].width, "height": motion_frames[0].height, "frames": len(motion_frames), "previewScale": 4, "sha256": sha256(motion_data)},
        ],
        "validation": {
            "frameCount": len(frames),
            "expectedFrameCount": len(ROWS) * len(COLUMNS),
            "binaryAlpha": set(atlas_alpha.getdata()).issubset({0, 255}),
            "maximumVisibleColorsPerFrame": source["qualityContract"]["maximumVisibleColorsPerFrame"],
            "actualMaximumVisibleColorsPerFrame": max(frame["visibleColorCount"] for frame in frames),
            "uniqueFrameHashes": len({frame["rgbaSha256"] for frame in frames}),
            "allFramesUnique": len({frame["rgbaSha256"] for frame in frames}) == len(frames),
            "runtimeCopy": str((RUNTIME_ROOT / ATLAS_NAME).relative_to(ROOT.parents[2])),
        },
        "review": {
            "topDownPerspective": source["qualityContract"]["perspective"],
            "runtimeIntegration": "campaign-field-leader-and-followers-four-phase-directional-walk",
            "remaining": "human in-game scale review and external cultural review remain advisable",
        },
    }
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return {
        ROOT / ATLAS_NAME: atlas_data,
        ROOT / CONTACT_NAME: contact_data,
        ROOT / MOTION_NAME: motion_data,
        ROOT / MANIFEST_NAME: manifest_data,
        RUNTIME_ROOT / ATLAS_NAME: atlas_data,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs = build_files()
    if args.check:
        failures = []
        for path, expected in outputs.items():
            actual = path.read_bytes() if path.exists() else None
            if actual != expected:
                failures.append(str(path))
        if failures:
            raise SystemExit("Generated outputs differ:\n" + "\n".join(failures))
        print(f"PASS byte-identical rebuild: {len(outputs)} files")
        return 0
    for path, data in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        print(f"WROTE {path.relative_to(ROOT.parents[2])} ({len(data)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
