#!/usr/bin/env python3
"""Build the original enemy key-pose atlas and its non-runtime review sheet."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import struct
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "enemy-combat-suite.source.json"
ATLAS_PATH = ROOT / "enemy-combat-atlas.png"
CONTACT_PATH = ROOT / "enemy-combat-contact-sheet.png"
MANIFEST_PATH = ROOT / "manifest.json"
POSES = ("neutral", "windup", "attack", "stagger", "defeat", "recovery")
FAMILIES = (
    "hound", "wisp", "ashen-oni", "court-retainer",
    "widow", "furnace", "bell-warden", "black-court",
)


def rgba(value: str) -> tuple[int, int, int, int]:
    value = value.removeprefix("#")
    if len(value) != 6:
        raise ValueError(f"Expected six-digit color, got {value!r}")
    return tuple(int(value[offset:offset + 2], 16) for offset in (0, 2, 4)) + (255,)


def load_source() -> dict:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    geometry = source.get("geometry", {})
    expected_geometry = {
        "columns": 6,
        "rows": 8,
        "cellWidth": 64,
        "cellHeight": 80,
        "minimumTransparentGutter": 4,
        "coordinateOrigin": "top-left",
    }
    if geometry != expected_geometry:
        raise ValueError(f"Geometry contract changed: {geometry!r}")
    if tuple(pose.get("id") for pose in source.get("poses", [])) != POSES:
        raise ValueError(
            "Pose order must be neutral, windup, attack, stagger, defeat, recovery"
        )
    families = source.get("families", [])
    if tuple(family.get("id") for family in families) != FAMILIES:
        raise ValueError("Family order differs from the eight live runtime families")
    if [family.get("row") for family in families] != list(range(8)):
        raise ValueError("Family row metadata must be consecutive from zero")

    templates: set[str] = set()
    palette_ids = set(source.get("paletteSets", {}))
    forbidden_design_terms = (
        "torii", "kamon", "coat of arms", "crucifix", "mandala", "shimenawa",
        "halo", "rosary", "reliquary", "sutra", "shrine", "sacred emblem",
    )
    for family in families:
        if family.get("paletteId") not in palette_ids:
            raise ValueError(f"Unknown palette for {family['id']}")
        design_copy = f"{family.get('label', '')} {family.get('motif', '')}".lower()
        if any(term in design_copy for term in forbidden_design_terms):
            raise ValueError(f"Restricted real-world design term in {family['id']}")
        family_templates = family.get("templateIds", [])
        if not family_templates or templates.intersection(family_templates):
            raise ValueError(f"Missing or duplicate templates in {family['id']}")
        templates.update(family_templates)
        if set(family.get("anchors", {})) != set(POSES):
            raise ValueError(f"Incomplete anchors for {family['id']}")
        for pose, anchors in family["anchors"].items():
            if set(anchors) != {"pivot", "ground", "contact"}:
                raise ValueError(f"Incomplete {family['id']}:{pose} anchor set")
            for name, point in anchors.items():
                if (
                    not isinstance(point, list) or len(point) != 2
                    or any(not isinstance(value, int) for value in point)
                    or not 0 <= point[0] < 64 or not 0 <= point[1] < 80
                ):
                    raise ValueError(f"Invalid {family['id']}:{pose}:{name} anchor")
    return source


class PixelSurface:
    """Native-resolution, integer-only RGBA drawing surface."""

    def __init__(self, palette: dict[str, str]):
        geometry = SOURCE["geometry"]
        self.image = Image.new(
            "RGBA", (geometry["cellWidth"], geometry["cellHeight"]), (0, 0, 0, 0)
        )
        self.draw = ImageDraw.Draw(self.image)
        self.colors = {name: rgba(value) for name, value in palette.items()}

    def c(self, name: str) -> tuple[int, int, int, int]:
        return self.colors[name]

    def rect(self, box: tuple[int, int, int, int], color: str) -> None:
        self.draw.rectangle(box, fill=self.c(color))

    def polygon(self, points: list[tuple[int, int]], color: str) -> None:
        self.draw.polygon(points, fill=self.c(color))

    def ellipse(self, box: tuple[int, int, int, int], color: str) -> None:
        self.draw.ellipse(box, fill=self.c(color))

    def line(self, points: list[tuple[int, int]], color: str, width: int = 1) -> None:
        self.draw.line(points, fill=self.c(color), width=width, joint="curve")

    def shadow(self, left: int, right: int) -> None:
        self.rect((left + 3, 72, right - 3, 74), "shade")
        self.rect((left, 73, right, 73), "shade")


def draw_hound(s: PixelSurface, pose: str) -> None:
    if pose == "neutral":
        s.shadow(12, 51)
        s.polygon([(8, 49), (14, 45), (18, 47), (15, 51), (22, 55), (20, 58), (13, 54)], "shade")
        s.polygon([(18, 48), (27, 43), (43, 45), (49, 51), (44, 60), (25, 61), (17, 55)], "body")
        s.polygon([(25, 45), (39, 46), (44, 50), (31, 51)], "light")
        s.polygon([(43, 44), (49, 40), (55, 44), (56, 53), (49, 57), (43, 52)], "body")
        s.polygon([(53, 48), (59, 49), (59, 53), (53, 54)], "shade")
        s.polygon([(46, 42), (49, 36), (52, 43)], "shade")
        s.rect((45, 51, 49, 55), "accent")
        s.rect((51, 45, 52, 46), "metal")
        s.polygon([(21, 58), (27, 59), (25, 70), (20, 70)], "shade")
        s.polygon([(39, 58), (45, 57), (49, 70), (44, 70)], "shade")
    elif pose == "windup":
        s.shadow(11, 48)
        s.polygon([(7, 58), (13, 52), (19, 54), (15, 59), (21, 63), (18, 66)], "shade")
        s.polygon([(17, 53), (27, 49), (42, 52), (48, 58), (43, 65), (23, 66), (16, 61)], "body")
        s.polygon([(22, 54), (39, 54), (44, 58), (27, 59)], "light")
        s.polygon([(40, 51), (46, 48), (52, 52), (53, 61), (45, 64), (40, 60)], "body")
        s.polygon([(48, 57), (56, 59), (54, 63), (47, 62)], "shade")
        s.polygon([(43, 51), (45, 44), (49, 51)], "shade")
        s.rect((40, 58, 44, 62), "accent")
        s.rect((47, 54, 48, 55), "metal")
        s.polygon([(20, 63), (27, 64), (24, 71), (18, 71)], "shade")
        s.polygon([(38, 63), (45, 62), (49, 71), (43, 71)], "shade")
    elif pose == "attack":
        s.shadow(15, 55)
        s.polygon([(12, 51), (5, 45), (8, 42), (18, 47), (22, 52), (19, 56)], "shade")
        s.polygon([(22, 47), (33, 43), (48, 46), (53, 53), (47, 62), (28, 62), (20, 55)], "body")
        s.polygon([(28, 47), (44, 48), (49, 52), (33, 53)], "light")
        s.polygon([(47, 43), (53, 39), (58, 43), (59, 51), (54, 55), (47, 51)], "body")
        s.polygon([(55, 48), (59, 47), (59, 51), (55, 53)], "shade")
        s.polygon([(50, 42), (52, 36), (55, 42)], "shade")
        s.rect((48, 49, 52, 53), "accent")
        s.rect((55, 44, 56, 45), "metal")
        s.polygon([(28, 59), (35, 60), (32, 71), (26, 71)], "shade")
        s.polygon([(44, 59), (50, 56), (55, 66), (51, 68)], "shade")
    else:
        s.shadow(9, 45)
        s.polygon([(34, 49), (44, 43), (51, 45), (43, 50), (38, 56)], "shade")
        s.polygon([(15, 47), (25, 44), (40, 49), (44, 56), (37, 64), (20, 62), (13, 54)], "body")
        s.polygon([(20, 49), (34, 50), (39, 54), (25, 56)], "light")
        s.polygon([(10, 43), (15, 39), (22, 43), (23, 52), (17, 57), (11, 52)], "body")
        s.polygon([(5, 47), (12, 46), (12, 51), (7, 52)], "shade")
        s.polygon([(13, 41), (16, 35), (18, 42)], "shade")
        s.rect((18, 50, 22, 54), "accent")
        s.rect((15, 44, 16, 45), "metal")
        s.polygon([(18, 59), (24, 60), (20, 71), (14, 70)], "shade")
        s.polygon([(34, 61), (40, 58), (45, 68), (41, 70)], "shade")


def draw_wisp(s: PixelSurface, pose: str) -> None:
    layouts = {
        "neutral": ((31, 47), [(17, 43), (23, 31), (33, 24), (45, 35), (48, 50), (37, 62), (22, 60)]),
        "windup": ((28, 52), [(17, 50), (21, 39), (29, 32), (39, 42), (40, 54), (31, 64), (20, 61)]),
        "attack": ((38, 45), [(18, 45), (28, 32), (42, 25), (53, 34), (59, 42), (49, 53), (34, 60)]),
        "stagger": ((25, 50), [(8, 38), (20, 31), (31, 35), (43, 45), (37, 60), (21, 64), (11, 53)]),
    }
    (cx, cy), points = layouts[pose]
    s.shadow(max(10, cx - 17), min(53, cx + 17))
    s.polygon(points, "body")
    s.polygon([(cx - 10, cy - 8), (cx, cy - 17), (cx + 11, cy - 7), (cx + 8, cy + 10), (cx, cy + 16), (cx - 11, cy + 8)], "light")
    s.rect((cx - 5, cy - 5, cx + 5, cy + 5), "shade")
    s.rect((cx - 2, cy - 2, cx + 2, cy + 2), "accent")
    shards = {
        "neutral": [(13, 29, 18, 36), (48, 25, 53, 32), (12, 57, 18, 63), (46, 59, 51, 65)],
        "windup": [(13, 43, 18, 48), (38, 32, 44, 38), (13, 61, 18, 66), (39, 59, 44, 64)],
        "attack": [(9, 41, 16, 46), (47, 21, 53, 28), (53, 54, 59, 60), (20, 59, 27, 64)],
        "stagger": [(5, 30, 11, 36), (34, 23, 39, 30), (43, 61, 49, 67), (8, 61, 14, 67)],
    }[pose]
    for left, top, right, bottom in shards:
        s.polygon([(left, top + 2), (right - 2, top), (right, bottom - 2), (left + 2, bottom)], "metal")
    if pose == "attack":
        s.line([(44, 42), (58, 42)], "accent", 2)
        s.rect((58, 40, 59, 44), "accent")
    elif pose == "stagger":
        s.line([(12, 40), (20, 46)], "accent", 2)


def draw_bailiff(s: PixelSurface, pose: str) -> None:
    x = {"neutral": 0, "windup": -2, "attack": 3, "stagger": -5}[pose]
    s.shadow(10 + x, 52 + x)
    s.polygon([(18 + x, 39), (26 + x, 33), (40 + x, 34), (49 + x, 43), (47 + x, 61), (41 + x, 68), (22 + x, 68), (15 + x, 59)], "body")
    s.polygon([(15 + x, 41), (25 + x, 35), (24 + x, 49), (13 + x, 53)], "light")
    s.polygon([(39 + x, 36), (50 + x, 42), (52 + x, 54), (43 + x, 51)], "light")
    s.polygon([(23 + x, 25), (36 + x, 22), (43 + x, 29), (41 + x, 40), (27 + x, 41), (21 + x, 34)], "body")
    s.polygon([(20 + x, 23), (36 + x, 18), (43 + x, 22), (34 + x, 26), (21 + x, 28)], "shade")
    s.rect((28 + x, 31, 38 + x, 34), "shade")
    s.rect((35 + x, 31, 38 + x, 32), "accent")
    s.rect((24 + x, 50, 40 + x, 53), "metal")
    s.rect((28 + x, 54, 31 + x, 57), "accent")
    s.polygon([(20 + x, 65), (29 + x, 66), (27 + x, 72), (18 + x, 72)], "shade")
    s.polygon([(36 + x, 65), (45 + x, 63), (48 + x, 72), (39 + x, 72)], "shade")
    if pose == "neutral":
        s.line([(47, 38), (51, 63)], "shade", 4)
        s.rect((47, 39, 55, 47), "metal")
        s.rect((49, 41, 53, 45), "shade")
    elif pose == "windup":
        s.line([(19, 40), (15, 24)], "shade", 4)
        s.rect((10, 18, 22, 28), "metal")
        s.rect((13, 21, 19, 25), "shade")
    elif pose == "attack":
        s.line([(47, 47), (54, 63)], "shade", 4)
        s.rect((49, 61, 59, 69), "metal")
        s.rect((52, 63, 57, 67), "shade")
    else:
        s.line([(17, 43), (11, 35)], "shade", 4)
        s.rect((5, 33, 15, 41), "metal")
        s.rect((8, 35, 13, 39), "shade")


def draw_retainer(s: PixelSurface, pose: str) -> None:
    x = {"neutral": 0, "windup": -2, "attack": 4, "stagger": -5}[pose]
    s.shadow(14 + x, 48 + x)
    s.polygon([(25 + x, 31), (39 + x, 32), (43 + x, 48), (48 + x, 66), (36 + x, 69), (31 + x, 58), (26 + x, 70), (15 + x, 67), (22 + x, 48)], "body")
    s.polygon([(26 + x, 36), (37 + x, 36), (39 + x, 52), (31 + x, 57), (24 + x, 49)], "light")
    s.polygon([(27 + x, 18), (38 + x, 20), (42 + x, 28), (38 + x, 37), (27 + x, 35), (23 + x, 27)], "body")
    s.polygon([(23 + x, 24), (41 + x, 23), (39 + x, 30), (26 + x, 31)], "shade")
    s.rect((28 + x, 26, 37 + x, 27), "accent")
    s.rect((28 + x, 45, 40 + x, 48), "shade")
    s.rect((24 + x, 64, 29 + x, 72), "shade")
    s.rect((38 + x, 64, 43 + x, 72), "shade")
    if pose == "neutral":
        s.line([(39, 43), (50, 61)], "metal", 3)
        s.line([(48, 58), (53, 55)], "accent", 2)
    elif pose == "windup":
        s.line([(25, 42), (13, 29)], "metal", 3)
        s.line([(13, 29), (16, 22)], "accent", 2)
    elif pose == "attack":
        s.line([(42, 44), (58, 46)], "metal", 3)
        s.line([(56, 44), (59, 39)], "accent", 2)
        s.polygon([(44, 37), (55, 38), (50, 42)], "body")
    else:
        s.line([(21, 41), (10, 36)], "metal", 3)
        s.line([(9, 35), (13, 30)], "accent", 2)


def draw_widow(s: PixelSurface, pose: str) -> None:
    x = {"neutral": 0, "windup": -2, "attack": 4, "stagger": -5}[pose]
    s.shadow(11 + x, 52 + x)
    s.polygon([(20 + x, 31), (31 + x, 20), (42 + x, 29), (45 + x, 45), (52 + x, 62), (43 + x, 68), (34 + x, 57), (26 + x, 69), (12 + x, 63), (19 + x, 47)], "body")
    s.polygon([(24 + x, 31), (31 + x, 25), (38 + x, 31), (36 + x, 41), (27 + x, 41)], "shade")
    s.rect((29 + x, 32, 34 + x, 34), "accent")
    s.polygon([(22 + x, 43), (39 + x, 42), (44 + x, 58), (35 + x, 54), (29 + x, 61), (19 + x, 56)], "light")
    s.polygon([(17 + x, 38), (9 + x, 47), (15 + x, 51), (24 + x, 44)], "metal")
    s.polygon([(42 + x, 39), (52 + x, 45), (48 + x, 51), (39 + x, 45)], "metal")
    s.rect((26 + x, 48, 29 + x, 53), "shade")
    s.rect((34 + x, 48, 37 + x, 53), "shade")
    if pose == "windup":
        s.line([(18, 44), (14, 31), (20, 25)], "accent", 2)
        s.line([(41, 42), (46, 31), (42, 25)], "accent", 2)
    elif pose == "attack":
        s.polygon([(47, 38), (59, 35), (56, 42), (59, 47), (47, 45)], "accent")
        s.line([(43, 43), (58, 40)], "light", 2)
    elif pose == "stagger":
        s.polygon([(8, 35), (14, 30), (18, 36), (13, 42)], "accent")
        s.line([(17, 42), (9, 38)], "light", 2)
    else:
        s.rect((47, 45, 50, 48), "accent")


def draw_furnace(s: PixelSurface, pose: str) -> None:
    x = {"neutral": 0, "windup": -2, "attack": 4, "stagger": -5}[pose]
    s.shadow(12 + x, 51 + x)
    s.polygon([(20 + x, 30), (41 + x, 30), (48 + x, 40), (48 + x, 62), (42 + x, 69), (20 + x, 68), (14 + x, 59), (15 + x, 40)], "body")
    s.polygon([(18 + x, 35), (43 + x, 35), (45 + x, 46), (17 + x, 46)], "light")
    s.rect((21 + x, 44, 42 + x, 61), "shade")
    s.polygon([(24 + x, 48), (39 + x, 48), (36 + x, 58), (27 + x, 58)], "accent")
    s.rect((29 + x, 51, 34 + x, 55), "metal")
    s.polygon([(23 + x, 30), (24 + x, 19), (31 + x, 16), (33 + x, 29)], "shade")
    s.polygon([(35 + x, 30), (37 + x, 21), (44 + x, 23), (43 + x, 33)], "shade")
    s.rect((18 + x, 62, 27 + x, 72), "shade")
    s.rect((37 + x, 62, 46 + x, 72), "shade")
    s.rect((17 + x, 39, 20 + x, 42), "metal")
    s.rect((42 + x, 39, 45 + x, 42), "metal")
    if pose == "neutral":
        s.line([(46, 39), (51, 64)], "metal", 3)
        s.line([(48, 64), (55, 64)], "accent", 3)
    elif pose == "windup":
        s.line([(20, 38), (15, 24)], "metal", 3)
        s.line([(11, 22), (20, 25)], "accent", 3)
    elif pose == "attack":
        s.line([(48, 42), (57, 61)], "metal", 3)
        s.line([(54, 63), (59, 63)], "accent", 3)
        s.rect((53, 56, 55, 59), "metal")
    else:
        s.line([(18, 40), (10, 34)], "metal", 3)
        s.line([(6, 34), (13, 38)], "accent", 3)


def draw_warden(s: PixelSurface, pose: str) -> None:
    x = {"neutral": 0, "windup": -2, "attack": 4, "stagger": -5}[pose]
    s.shadow(11 + x, 52 + x)
    s.polygon([(19 + x, 31), (42 + x, 29), (49 + x, 43), (47 + x, 65), (39 + x, 70), (21 + x, 68), (14 + x, 58), (15 + x, 41)], "body")
    s.polygon([(20 + x, 36), (41 + x, 34), (45 + x, 45), (40 + x, 58), (23 + x, 58), (18 + x, 48)], "light")
    s.rect((25 + x, 43, 39 + x, 56), "shade")
    s.rect((29 + x, 46, 35 + x, 52), "accent")
    s.rect((18 + x, 63, 27 + x, 72), "shade")
    s.rect((37 + x, 63, 46 + x, 72), "shade")
    s.polygon([(14 + x, 35), (17 + x, 21), (24 + x, 15), (42 + x, 18), (50 + x, 29), (47 + x, 35), (42 + x, 25), (25 + x, 22), (21 + x, 35)], "shade")
    s.rect((25 + x, 18, 32 + x, 23), "metal")
    s.rect((39 + x, 21, 45 + x, 28), "metal")
    s.rect((15 + x, 43, 20 + x, 51), "metal")
    s.rect((43 + x, 42, 49 + x, 50), "metal")
    if pose == "neutral":
        s.line([(47, 39), (51, 59)], "shade", 3)
        s.rect((47, 56, 55, 63), "accent")
    elif pose == "windup":
        s.line([(20, 39), (16, 24)], "shade", 3)
        s.rect((11, 18, 22, 27), "accent")
    elif pose == "attack":
        s.line([(49, 41), (56, 55)], "shade", 3)
        s.rect((52, 52, 59, 60), "accent")
    else:
        s.line([(17, 42), (10, 34)], "shade", 3)
        s.rect((5, 32, 15, 40), "accent")


def draw_black_court(s: PixelSurface, pose: str) -> None:
    x = {"neutral": 0, "windup": -2, "attack": 4, "stagger": -6}[pose]
    s.shadow(13 + x, 50 + x)
    s.polygon([(25 + x, 27), (38 + x, 27), (43 + x, 41), (49 + x, 67), (38 + x, 69), (32 + x, 58), (26 + x, 70), (14 + x, 67), (21 + x, 42)], "body")
    s.polygon([(26 + x, 31), (37 + x, 31), (39 + x, 48), (32 + x, 56), (24 + x, 47)], "light")
    s.polygon([(22 + x, 39), (12 + x, 49), (17 + x, 57), (26 + x, 49)], "body")
    s.polygon([(40 + x, 38), (51 + x, 47), (46 + x, 56), (37 + x, 48)], "body")
    s.polygon([(27 + x, 14), (37 + x, 16), (41 + x, 25), (37 + x, 34), (27 + x, 33), (23 + x, 24)], "shade")
    s.polygon([(25 + x, 17), (32 + x, 12), (40 + x, 18), (36 + x, 22), (27 + x, 21)], "body")
    s.rect((27 + x, 24, 37 + x, 26), "metal")
    s.rect((35 + x, 24, 38 + x, 25), "accent")
    s.rect((25 + x, 42, 38 + x, 45), "shade")
    s.rect((22 + x, 65, 28 + x, 72), "shade")
    s.rect((37 + x, 64, 43 + x, 72), "shade")
    if pose == "neutral":
        s.line([(42, 37), (50, 61)], "metal", 2)
        s.rect((48, 59, 52, 64), "accent")
    elif pose == "windup":
        s.line([(24, 39), (16, 26)], "metal", 2)
        s.polygon([(13, 22), (19, 25), (16, 31)], "accent")
    elif pose == "attack":
        s.line([(42, 39), (59, 42)], "metal", 2)
        s.polygon([(56, 39), (59, 42), (56, 46)], "accent")
        s.polygon([(45, 31), (54, 35), (49, 39)], "body")
    else:
        s.line([(20, 39), (10, 34)], "metal", 2)
        s.polygon([(7, 31), (13, 34), (9, 39)], "accent")


def detail_hound(s: PixelSurface, pose: str) -> None:
    """Articulate the animal planes and keep the collar gauge readable at 1x."""
    if pose == "neutral":
        s.line([(9, 49), (13, 47), (17, 48)], "light", 1)
        s.line([(10, 51), (7, 54), (12, 53)], "body", 2)
        s.polygon([(20, 50), (26, 46), (29, 47), (25, 51)], "light")
        s.line([(31, 52), (41, 52), (44, 55)], "shade", 1)
        s.rect((46, 52, 48, 54), "metal")
        s.rect((47, 52, 47, 52), "accent")
        s.polygon([(21, 58), (27, 59), (25, 64), (24, 70), (19, 70), (21, 63)], "body")
        s.rect((22, 61, 24, 65), "light")
        s.rect((19, 69, 25, 71), "body")
        s.polygon([(39, 58), (45, 57), (46, 63), (49, 69), (44, 70), (42, 63)], "body")
        s.rect((42, 59, 44, 63), "light")
        s.rect((44, 69, 50, 71), "body")
        s.rect((56, 50, 58, 50), "metal")
    elif pose == "windup":
        s.line([(8, 58), (13, 54), (18, 56)], "light", 1)
        s.line([(9, 60), (6, 64), (12, 62)], "body", 2)
        s.polygon([(20, 56), (27, 52), (31, 53), (27, 57)], "light")
        s.line([(28, 60), (41, 60), (44, 62)], "shade", 1)
        s.rect((41, 59, 43, 61), "metal")
        s.rect((42, 59, 42, 59), "accent")
        s.polygon([(19, 62), (27, 63), (24, 66), (22, 71), (17, 71), (20, 65)], "body")
        s.rect((20, 63, 23, 66), "light")
        s.rect((17, 69, 24, 71), "body")
        s.polygon([(38, 62), (45, 61), (47, 66), (51, 70), (45, 71), (43, 66)], "body")
        s.rect((41, 62, 44, 65), "light")
        s.rect((44, 69, 51, 71), "body")
        s.rect((51, 59, 54, 59), "metal")
    elif pose == "attack":
        s.line([(13, 51), (8, 47), (5, 46)], "light", 1)
        s.line([(12, 53), (7, 57), (13, 55)], "body", 2)
        s.polygon([(24, 49), (32, 45), (36, 46), (31, 50)], "light")
        s.line([(36, 54), (48, 54), (51, 56)], "shade", 1)
        s.rect((49, 50, 51, 52), "metal")
        s.rect((50, 50, 50, 50), "accent")
        s.polygon([(27, 59), (35, 60), (32, 65), (30, 71), (25, 71), (28, 64)], "body")
        s.rect((29, 60, 32, 64), "light")
        s.rect((25, 69, 32, 71), "body")
        s.polygon([(44, 58), (50, 56), (51, 61), (56, 66), (53, 69), (48, 63)], "body")
        s.rect((47, 58, 49, 61), "light")
        s.rect((51, 66, 57, 69), "body")
        s.rect((57, 49, 59, 49), "metal")
        s.rect((56, 52, 58, 52), "metal")
    else:
        s.line([(39, 50), (45, 46), (49, 46)], "light", 1)
        s.line([(39, 52), (46, 55), (49, 58)], "body", 2)
        s.polygon([(18, 49), (25, 46), (29, 48), (24, 51)], "light")
        s.line([(25, 56), (38, 57), (41, 59)], "shade", 1)
        s.rect((19, 51, 21, 53), "metal")
        s.rect((20, 51, 20, 51), "accent")
        s.polygon([(17, 59), (24, 60), (21, 65), (18, 71), (13, 71), (17, 64)], "body")
        s.rect((18, 60, 21, 64), "light")
        s.rect((13, 69, 21, 71), "body")
        s.polygon([(34, 60), (40, 58), (42, 63), (47, 68), (43, 71), (38, 65)], "body")
        s.rect((37, 60, 39, 63), "light")
        s.rect((40, 69, 47, 71), "body")
        s.rect((6, 48, 10, 48), "metal")


def detail_wisp(s: PixelSurface, pose: str) -> None:
    centers = {
        "neutral": (31, 47), "windup": (28, 52),
        "attack": (38, 45), "stagger": (25, 50),
    }
    cx, cy = centers[pose]
    s.rect((cx - 7, cy - 7, cx + 7, cy - 6), "metal")
    s.rect((cx - 7, cy + 6, cx + 7, cy + 7), "body")
    s.rect((cx - 7, cy - 5, cx - 6, cy + 5), "body")
    s.rect((cx + 6, cy - 5, cx + 7, cy + 5), "light")
    s.rect((cx - 1, cy - 1, cx + 1, cy + 1), "accent")
    if pose == "windup":
        s.line([(18, 52), (22, 49), (25, 50)], "metal", 1)
        s.line([(32, 46), (38, 43)], "accent", 1)
    elif pose == "attack":
        s.line([(42, 39), (49, 38), (54, 41)], "metal", 1)
        s.rect((55, 41, 59, 43), "accent")
    elif pose == "stagger":
        s.line([(14, 43), (19, 46), (17, 51)], "metal", 1)
        s.rect((8, 36, 11, 38), "accent")


def detail_bailiff(s: PixelSurface, pose: str) -> None:
    x = {"neutral": 0, "windup": -2, "attack": 3, "stagger": -5}[pose]
    # Three separate docket plates and their hard rivets prevent a flat torso read.
    for plate_x in (24, 30, 36):
        s.rect((plate_x + x, 45, plate_x + x + 4, 49), "shade")
        s.rect((plate_x + x + 1, 45, plate_x + x + 3, 47), "metal")
        s.rect((plate_x + x + 2, 45, plate_x + x + 2, 45), "light")
    s.line([(18 + x, 43), (22 + x, 52), (19 + x, 59)], "shade", 2)
    s.line([(45 + x, 43), (42 + x, 52), (46 + x, 58)], "shade", 2)
    s.rect((23 + x, 55, 40 + x, 57), "accent")
    s.rect((25 + x, 56, 27 + x, 56), "metal")
    s.rect((36 + x, 56, 38 + x, 56), "metal")
    s.line([(28 + x, 38), (38 + x, 38)], "light", 1)
    # Offset brow fastening and jaw guard.
    s.rect((22 + x, 23, 25 + x, 25), "metal")
    s.rect((39 + x, 24, 41 + x, 27), "accent")
    s.line([(27 + x, 35), (39 + x, 35)], "shade", 2)
    # Square maul face gets a socket, bright top edge and wrapped grip.
    mauls = {
        "neutral": ((47, 39, 55, 47), (49, 41, 53, 45), [(47, 49), (50, 62)]),
        "windup": ((10, 18, 22, 28), (13, 21, 19, 25), [(18, 29), (21, 42)]),
        "attack": ((49, 61, 59, 69), (52, 63, 57, 67), [(48, 49), (53, 61)]),
        "stagger": ((5, 33, 15, 41), (8, 35, 13, 39), [(15, 40), (20, 46)]),
    }
    outer, socket, grip = mauls[pose]
    s.rect(outer, "metal")
    s.rect((outer[0], outer[1], outer[2], outer[1] + 1), "light")
    s.rect(socket, "shade")
    s.rect((socket[0] + 1, socket[1] + 1, socket[2] - 1, socket[3] - 1), "body")
    s.line(grip, "metal", 2)
    for gy in range(min(grip[0][1], grip[1][1]) + 2, max(grip[0][1], grip[1][1]), 4):
        gx = grip[0][0] if pose in {"neutral", "attack"} else grip[1][0]
        s.rect((gx - 1, gy, gx + 1, gy), "accent")


def detail_retainer(s: PixelSurface, pose: str) -> None:
    x = {"neutral": 0, "windup": -2, "attack": 4, "stagger": -5}[pose]
    s.polygon([(26 + x, 37), (31 + x, 43), (28 + x, 49), (24 + x, 45)], "shade")
    s.polygon([(38 + x, 37), (33 + x, 43), (37 + x, 49), (40 + x, 44)], "accent")
    s.line([(31 + x, 49), (31 + x, 61)], "metal", 1)
    s.rect((22 + x, 51, 26 + x, 56), "shade")
    s.rect((23 + x, 52, 25 + x, 54), "metal")
    s.rect((24 + x, 52, 24 + x, 52), "accent")
    s.rect((26 + x, 26, 29 + x, 27), "metal")
    s.rect((36 + x, 26, 39 + x, 27), "light")
    s.line([(19 + x, 65), (24 + x, 68)], "light", 1)
    s.line([(41 + x, 63), (45 + x, 67)], "shade", 1)
    # Re-articulate the docket blade as a wrapped grip, pale spine and two-step hook.
    blade = {
        "neutral": ([(39, 42), (49, 59)], [(49, 59), (54, 56), (52, 62)], (39, 43)),
        "windup": ([(25, 42), (14, 30)], [(14, 30), (17, 23), (11, 27)], (24, 41)),
        "attack": ([(42, 44), (57, 47)], [(57, 47), (58, 40), (54, 45)], (43, 44)),
        "stagger": ([(21, 41), (10, 36)], [(10, 36), (13, 30), (7, 34)], (20, 41)),
    }[pose]
    spine, hook, grip = blade
    s.line(spine, "metal", 2)
    s.line(spine, "light", 1)
    s.line(hook, "accent", 2)
    s.rect((grip[0] - 2, grip[1] - 2, grip[0] + 1, grip[1] + 2), "shade")
    s.line([(grip[0] - 1, grip[1] - 1), (grip[0] + 1, grip[1] + 1)], "metal", 1)


def detail_widow(s: PixelSurface, pose: str) -> None:
    x = {"neutral": 0, "windup": -2, "attack": 4, "stagger": -5}[pose]
    # Faceted hood, spindle axle, and separate bobbins.
    s.line([(23 + x, 32), (31 + x, 24), (39 + x, 32)], "light", 1)
    s.line([(26 + x, 40), (31 + x, 43), (36 + x, 40)], "shade", 1)
    s.rect((29 + x, 47, 34 + x, 55), "shade")
    s.rect((31 + x, 48, 32 + x, 54), "metal")
    s.rect((29 + x, 50, 34 + x, 52), "accent")
    s.rect((13 + x, 45, 17 + x, 50), "shade")
    s.rect((15 + x, 46, 18 + x, 48), "accent")
    s.rect((46 + x, 44, 50 + x, 49), "shade")
    s.rect((44 + x, 45, 48 + x, 47), "accent")
    # Crossed net threads remain sparse so legal-cell transparency stays clear.
    s.line([(18 + x, 48), (30 + x, 55), (43 + x, 47)], "metal", 1)
    s.line([(20 + x, 43), (31 + x, 55), (42 + x, 43)], "light", 1)
    s.line([(20 + x, 58), (25 + x, 62), (22 + x, 66)], "shade", 2)
    s.line([(42 + x, 57), (37 + x, 62), (41 + x, 66)], "shade", 2)
    if pose == "windup":
        s.line([(14, 31), (19, 27), (18, 23)], "light", 1)
        s.line([(46, 31), (42, 27), (43, 23)], "light", 1)
    elif pose == "attack":
        s.line([(46, 39), (54, 37), (59, 39)], "light", 1)
        s.line([(48, 43), (55, 45), (58, 43)], "metal", 1)
    elif pose == "stagger":
        s.line([(8, 36), (13, 33), (16, 36)], "light", 1)
        s.line([(9, 42), (14, 45), (17, 43)], "metal", 1)


def detail_furnace(s: PixelSurface, pose: str) -> None:
    x = {"neutral": 0, "windup": -2, "attack": 4, "stagger": -5}[pose]
    # Mantle panel bevels, rivets, grate, and separately jointed sleeves.
    s.line([(18 + x, 37), (21 + x, 33), (41 + x, 33), (45 + x, 38)], "metal", 1)
    s.line([(19 + x, 44), (19 + x, 58), (23 + x, 64)], "shade", 2)
    s.line([(44 + x, 44), (44 + x, 58), (40 + x, 65)], "shade", 2)
    s.polygon([(15 + x, 42), (10 + x, 47), (12 + x, 60), (18 + x, 57)], "shade")
    s.polygon([(48 + x, 42), (53 + x, 48), (51 + x, 60), (46 + x, 57)], "shade")
    s.rect((11 + x, 49, 14 + x, 55), "light")
    s.rect((49 + x, 49, 52 + x, 55), "light")
    for rx, ry in ((20, 39), (42, 39), (20, 60), (42, 60)):
        s.rect((rx + x, ry, rx + x + 1, ry + 1), "metal")
        s.rect((rx + x, ry, rx + x, ry), "light")
    s.rect((22 + x, 46, 41 + x, 48), "metal")
    s.rect((24 + x, 49, 39 + x, 61), "shade")
    s.rect((27 + x, 51, 36 + x, 58), "accent")
    s.rect((29 + x, 52, 34 + x, 55), "metal")
    for tooth_x in (27, 31, 35):
        s.rect((tooth_x + x, 58, tooth_x + x + 1, 61), "body")
    # Broken twin chimney mouths use different heights and hard lips.
    s.rect((22 + x, 18, 32 + x, 21), "shade")
    s.rect((23 + x, 18, 31 + x, 18), "metal")
    s.rect((35 + x, 21, 44 + x, 24), "shade")
    s.rect((36 + x, 21, 43 + x, 21), "light")
    if pose == "windup":
        s.polygon([(15, 45), (8, 38), (10, 30), (15, 27), (20, 37)], "body")
        s.line([(11, 32), (15, 30), (18, 37)], "light", 2)
        s.rect((8, 37, 11, 42), "shade")
    elif pose == "attack":
        s.polygon([(48, 43), (55, 46), (59, 53), (56, 58), (49, 54)], "body")
        s.line([(50, 45), (54, 48), (57, 54)], "light", 2)
        s.rect((54, 55, 58, 59), "shade")
    elif pose == "stagger":
        s.polygon([(15, 42), (8, 40), (6, 35), (10, 31), (18, 36)], "body")
        s.line([(8, 35), (12, 34), (16, 38)], "light", 2)
        s.rect((7, 39, 11, 43), "shade")
    else:
        s.rect((11, 54, 16, 60), "body")
        s.rect((48, 54, 53, 60), "body")
    rake = {
        "neutral": ([(47, 39), (51, 63)], [(48, 63), (55, 63)], (50, 55)),
        "windup": ([(20, 38), (15, 24)], [(11, 22), (20, 25)], (17, 31)),
        "attack": ([(48, 42), (57, 61)], [(53, 64), (58, 64)], (53, 53)),
        "stagger": ([(18, 40), (10, 34)], [(6, 34), (13, 38)], (14, 37)),
    }[pose]
    shaft, edge, hand = rake
    s.line(shaft, "metal", 3)
    s.line(shaft, "light", 1)
    s.line(edge, "accent", 2)
    for point in edge:
        s.rect((point[0], point[1], point[0] + 1, point[1] + 2), "metal")
    s.rect((hand[0] - 2, hand[1] - 2, hand[0] + 2, hand[1] + 2), "body")
    s.rect((hand[0], hand[1] - 1, hand[0] + 1, hand[1]), "light")


def detail_warden(s: PixelSurface, pose: str) -> None:
    x = {"neutral": 0, "windup": -2, "attack": 4, "stagger": -5}[pose]
    # The yoke is explicitly offset, stepped, and mechanically jointed.
    s.rect((17 + x, 25, 21 + x, 37), "shade")
    s.rect((18 + x, 27, 21 + x, 34), "metal")
    s.rect((23 + x, 18, 31 + x, 22), "light")
    s.rect((24 + x, 19, 30 + x, 22), "metal")
    s.rect((35 + x, 20, 43 + x, 25), "body")
    s.rect((39 + x, 22, 47 + x, 29), "metal")
    s.rect((42 + x, 24, 46 + x, 28), "shade")
    s.line([(22 + x, 32), (27 + x, 37), (41 + x, 36), (46 + x, 32)], "light", 1)
    # Separate damper blocks and cables.
    s.rect((14 + x, 42, 21 + x, 51), "shade")
    s.rect((15 + x, 43, 19 + x, 49), "metal")
    s.rect((43 + x, 41, 51 + x, 50), "shade")
    s.rect((45 + x, 42, 49 + x, 48), "metal")
    s.line([(20 + x, 35), (17 + x, 42)], "accent", 1)
    s.line([(44 + x, 33), (48 + x, 41)], "accent", 1)
    # Front aperture has a bevel, pin, and lower calibration plate.
    s.rect((23 + x, 42, 41 + x, 58), "shade")
    s.rect((25 + x, 44, 39 + x, 56), "metal")
    s.rect((28 + x, 46, 36 + x, 54), "accent")
    s.rect((30 + x, 48, 34 + x, 52), "shade")
    s.rect((31 + x, 49, 33 + x, 51), "light")
    s.rect((25 + x, 59, 40 + x, 62), "body")
    s.rect((28 + x, 59, 30 + x, 60), "light")
    hammer = {
        "neutral": ((47, 56, 55, 63), [(47, 43), (51, 57)], (50, 51)),
        "windup": ((11, 18, 22, 27), [(20, 39), (17, 27)], (18, 33)),
        "attack": ((52, 52, 59, 60), [(49, 41), (55, 53)], (52, 47)),
        "stagger": ((5, 32, 15, 40), [(17, 42), (13, 39)], (15, 40)),
    }[pose]
    head, shaft, hand = hammer
    s.rect(head, "accent")
    s.rect((head[0], head[1], head[2], head[1] + 1), "light")
    s.rect((head[0] + 2, head[1] + 2, head[2] - 2, head[3] - 1), "metal")
    s.rect((head[0] + 3, head[1] + 3, head[2] - 3, head[3] - 2), "shade")
    s.line(shaft, "metal", 3)
    s.line(shaft, "light", 1)
    s.rect((hand[0] - 2, hand[1] - 2, hand[0] + 2, hand[1] + 2), "body")


def detail_black_court(s: PixelSurface, pose: str) -> None:
    x = {"neutral": 0, "windup": -2, "attack": 4, "stagger": -6}[pose]
    # Cut stepped tiers into the mantle instead of leaving one uninterrupted mass.
    s.polygon([(15 + x, 46), (20 + x, 42), (23 + x, 45), (20 + x, 50)], "shade")
    s.polygon([(11 + x, 52), (17 + x, 49), (20 + x, 53), (16 + x, 58)], "light")
    s.polygon([(44 + x, 44), (50 + x, 48), (47 + x, 53), (41 + x, 49)], "shade")
    s.polygon([(47 + x, 54), (53 + x, 58), (48 + x, 62), (43 + x, 57)], "light")
    s.line([(23 + x, 37), (31 + x, 42), (40 + x, 37)], "accent", 1)
    s.polygon([(26 + x, 42), (32 + x, 46), (38 + x, 42), (37 + x, 51), (32 + x, 57), (27 + x, 51)], "accent")
    s.line([(32 + x, 46), (32 + x, 57)], "body", 1)
    s.rect((27 + x, 24, 30 + x, 25), "metal")
    s.rect((35 + x, 24, 39 + x, 25), "light")
    s.rect((29 + x, 29, 36 + x, 31), "body")
    # Belt docket and articulated weapon hand.
    s.rect((23 + x, 54, 28 + x, 59), "shade")
    s.rect((24 + x, 55, 27 + x, 57), "metal")
    s.rect((25 + x, 55, 25 + x, 55), "accent")
    hand = {
        "neutral": (42, 39), "windup": (24, 39),
        "attack": (43, 40), "stagger": (20, 39),
    }[pose]
    s.rect((hand[0] - 2, hand[1] - 2, hand[0] + 2, hand[1] + 2), "shade")
    s.rect((hand[0], hand[1] - 1, hand[0] + 1, hand[1]), "metal")
    blade = {
        "neutral": ([(42, 38), (50, 61)], [(49, 59), (53, 64), (48, 64)]),
        "windup": ([(24, 38), (16, 26)], [(13, 22), (19, 25), (16, 31)]),
        "attack": ([(43, 40), (59, 42)], [(56, 39), (59, 42), (56, 46)]),
        "stagger": ([(20, 38), (10, 34)], [(7, 31), (13, 34), (9, 39)]),
    }[pose]
    spine, tip = blade
    s.line(spine, "metal", 3)
    s.line(spine, "light", 1)
    s.polygon(tip, "accent")
    if pose == "attack":
        s.rect((53, 41, 55, 43), "metal")
        s.line([(47, 37), (53, 39)], "body", 2)


def defeat_hound(s: PixelSurface) -> None:
    """Contained collapse: latch dark, paws folded, split tail released."""
    s.shadow(9, 56)
    s.polygon([(7, 59), (15, 54), (26, 55), (37, 58), (47, 57), (56, 61),
               (53, 68), (37, 70), (20, 68), (11, 65)], "shade")
    s.polygon([(14, 55), (27, 50), (43, 54), (48, 60), (42, 66), (24, 66),
               (12, 62)], "body")
    s.polygon([(24, 52), (39, 54), (44, 58), (31, 59), (19, 57)], "light")
    s.polygon([(43, 56), (50, 52), (58, 56), (58, 63), (52, 67), (44, 64)], "body")
    s.rect((47, 60, 52, 64), "metal")
    s.rect((49, 61, 50, 62), "shade")
    s.polygon([(13, 58), (7, 54), (9, 62), (16, 65)], "accent")
    s.polygon([(10, 64), (18, 66), (16, 70), (8, 68)], "body")
    s.rect((22, 66, 30, 70), "shade")
    s.rect((39, 65, 47, 69), "shade")


def defeat_wisp(s: PixelSurface) -> None:
    """Non-gory dispersal into hard vapor facets around a dimmed core."""
    s.polygon([(23, 43), (30, 37), (39, 42), (41, 52), (34, 59), (24, 56),
               (19, 49)], "shade")
    s.polygon([(26, 43), (31, 40), (37, 44), (37, 51), (32, 55), (25, 52)], "body")
    s.rect((29, 45, 34, 51), "metal")
    s.rect((31, 47, 33, 50), "shade")
    s.polygon([(9, 35), (17, 31), (18, 40), (12, 44)], "light")
    s.polygon([(43, 31), (54, 35), (49, 43), (42, 40)], "body")
    s.polygon([(48, 51), (58, 55), (52, 62), (44, 58)], "light")
    s.polygon([(33, 62), (39, 70), (29, 72), (25, 65)], "body")
    s.polygon([(8, 57), (17, 53), (20, 62), (13, 67)], "metal")
    s.rect((20, 33, 23, 36), "accent")
    s.rect((40, 65, 43, 68), "accent")
    s.rect((54, 45, 57, 48), "metal")


def defeat_bailiff(s: PixelSurface) -> None:
    """Heavy kneel with ledger plates closed and square maul grounded."""
    s.shadow(7, 57)
    s.polygon([(17, 45), (29, 39), (41, 43), (47, 54), (43, 68), (24, 71),
               (14, 62)], "shade")
    s.polygon([(21, 43), (33, 41), (43, 48), (43, 59), (36, 67), (22, 65),
               (17, 55)], "body")
    s.polygon([(25, 45), (35, 44), (41, 50), (31, 52), (21, 49)], "light")
    s.rect((22, 53, 39, 57), "metal")
    s.rect((24, 54, 28, 56), "accent")
    s.rect((31, 54, 34, 56), "shade")
    s.rect((36, 54, 38, 56), "shade")
    s.polygon([(18, 60), (28, 62), (25, 71), (13, 70)], "body")
    s.polygon([(36, 61), (47, 62), (51, 70), (38, 71)], "body")
    s.line([(43, 51), (52, 66)], "metal", 4)
    s.rect((48, 64, 58, 72), "shade")
    s.rect((50, 65, 57, 69), "metal")
    s.rect((52, 66, 56, 67), "light")


def defeat_retainer(s: PixelSurface) -> None:
    """Disarmed kneel: visor lowered and docket blade set aside."""
    s.shadow(8, 56)
    s.polygon([(18, 43), (31, 38), (43, 44), (47, 57), (41, 68), (20, 69),
               (14, 57)], "shade")
    s.polygon([(22, 42), (33, 40), (41, 46), (43, 57), (36, 65), (23, 64),
               (18, 54)], "body")
    s.polygon([(25, 43), (34, 42), (39, 47), (31, 49), (22, 47)], "light")
    s.rect((25, 36, 38, 42), "shade")
    s.rect((28, 38, 36, 40), "metal")
    s.rect((31, 39, 34, 40), "accent")
    s.polygon([(21, 60), (31, 62), (28, 71), (15, 70)], "body")
    s.polygon([(35, 61), (44, 64), (48, 71), (35, 71)], "body")
    s.rect((24, 52, 29, 58), "shade")
    s.rect((25, 53, 28, 56), "metal")
    s.line([(43, 57), (55, 70)], "metal", 3)
    s.polygon([(53, 66), (59, 71), (54, 73), (49, 68)], "accent")


def defeat_widow(s: PixelSurface) -> None:
    """Fog dispersal leaves the harmless net spindle and loose ribbons."""
    s.shadow(9, 55)
    s.polygon([(22, 45), (31, 39), (41, 45), (43, 55), (36, 63), (24, 61),
               (18, 53)], "shade")
    s.polygon([(26, 44), (32, 42), (38, 47), (38, 54), (32, 59), (24, 55)], "body")
    s.rect((29, 47, 35, 54), "metal")
    s.line([(30, 48), (34, 53), (30, 53), (35, 48)], "light", 1)
    s.polygon([(18, 52), (9, 57), (14, 64), (25, 59)], "light")
    s.polygon([(40, 51), (55, 55), (50, 63), (36, 59)], "body")
    s.polygon([(13, 65), (25, 61), (31, 70), (20, 73), (8, 70)], "body")
    s.polygon([(33, 61), (45, 64), (57, 70), (48, 73), (35, 69)], "light")
    s.rect((11, 50, 14, 53), "accent")
    s.rect((51, 48, 54, 51), "metal")


def defeat_furnace(s: PixelSurface) -> None:
    """Cold shutdown with closed grate, buckled mantle, and parked rake."""
    s.shadow(6, 58)
    s.polygon([(13, 43), (27, 38), (43, 41), (51, 51), (49, 66), (39, 71),
               (18, 70), (9, 59)], "shade")
    s.polygon([(17, 42), (31, 40), (45, 45), (47, 57), (42, 66), (21, 66),
               (14, 56)], "body")
    s.polygon([(20, 43), (34, 42), (43, 47), (31, 50), (17, 47)], "light")
    s.rect((21, 51, 42, 61), "metal")
    s.rect((24, 53, 39, 59), "shade")
    s.line([(27, 53), (27, 59)], "body", 2)
    s.line([(33, 53), (33, 59)], "body", 2)
    s.rect((19, 36, 25, 43), "shade")
    s.rect((29, 33, 36, 41), "body")
    s.rect((39, 36, 45, 43), "shade")
    s.polygon([(17, 61), (27, 64), (25, 72), (12, 70)], "body")
    s.polygon([(38, 63), (49, 64), (54, 71), (39, 72)], "body")
    s.line([(44, 49), (56, 69)], "metal", 3)
    s.rect((52, 67, 59, 72), "accent")


def defeat_warden(s: PixelSurface) -> None:
    """Released resonator yoke settles with both dampers safely open."""
    s.shadow(7, 57)
    s.polygon([(15, 44), (28, 39), (43, 43), (50, 54), (46, 68), (24, 71),
               (12, 61)], "shade")
    s.polygon([(20, 43), (33, 41), (44, 47), (46, 58), (39, 66), (22, 65),
               (16, 54)], "body")
    s.polygon([(23, 44), (35, 43), (42, 48), (31, 51), (19, 48)], "light")
    s.polygon([(17, 40), (27, 34), (35, 38), (31, 45), (21, 46)], "metal")
    s.polygon([(37, 39), (50, 42), (48, 51), (40, 49)], "metal")
    s.rect((21, 47, 27, 54), "shade")
    s.rect((40, 50, 47, 57), "shade")
    s.rect((27, 52, 39, 59), "metal")
    s.rect((30, 54, 36, 57), "accent")
    s.polygon([(18, 60), (29, 63), (26, 72), (12, 69)], "body")
    s.polygon([(37, 62), (48, 64), (54, 71), (39, 72)], "body")
    s.line([(45, 55), (57, 69)], "metal", 3)
    s.rect((53, 67, 59, 72), "light")


def defeat_black_court(s: PixelSurface) -> None:
    """Broken mantle folds inward while the decree blade lies released."""
    s.shadow(6, 58)
    s.polygon([(14, 42), (29, 36), (43, 41), (51, 54), (48, 67), (37, 71),
               (18, 69), (9, 57)], "shade")
    s.polygon([(19, 41), (32, 38), (44, 45), (46, 56), (39, 65), (21, 64),
               (14, 53)], "body")
    s.polygon([(22, 42), (34, 40), (42, 46), (31, 49), (18, 47)], "light")
    s.polygon([(16, 50), (23, 46), (28, 52), (22, 58), (13, 55)], "accent")
    s.polygon([(36, 49), (46, 46), (51, 53), (44, 59), (37, 56)], "accent")
    s.rect((26, 34, 39, 40), "shade")
    s.rect((29, 36, 36, 38), "metal")
    s.rect((31, 37, 34, 38), "accent")
    s.rect((25, 53, 30, 59), "shade")
    s.rect((26, 54, 29, 57), "metal")
    s.polygon([(18, 59), (30, 62), (27, 71), (11, 69)], "body")
    s.polygon([(36, 61), (47, 63), (54, 70), (39, 72)], "body")
    s.line([(43, 57), (57, 69)], "metal", 3)
    s.polygon([(54, 65), (59, 69), (56, 73), (50, 68)], "accent")


def recovery_hound(s: PixelSurface) -> None:
    """Low post-lunge reset: forepaws brake while the split tail settles."""
    s.shadow(10, 53)
    s.polygon([(9, 55), (14, 50), (20, 53), (17, 59), (12, 63), (8, 60)], "shade")
    s.polygon([(17, 50), (27, 46), (43, 48), (50, 55), (44, 63),
               (25, 64), (15, 57)], "body")
    s.polygon([(23, 49), (38, 50), (45, 54), (31, 55)], "light")
    s.polygon([(43, 48), (49, 45), (56, 49), (58, 57), (52, 61), (44, 57)], "body")
    s.polygon([(53, 54), (59, 55), (58, 59), (52, 59)], "shade")
    s.polygon([(47, 47), (49, 40), (53, 47)], "shade")
    s.rect((45, 55, 50, 59), "metal")
    s.rect((47, 56, 48, 57), "accent")
    s.rect((53, 51, 54, 52), "metal")
    s.polygon([(20, 61), (27, 62), (24, 71), (18, 71)], "shade")
    s.polygon([(39, 61), (46, 59), (52, 68), (48, 71), (43, 65)], "shade")
    s.rect((17, 70, 25, 72), "body")
    s.rect((47, 68, 54, 71), "body")


def recovery_wisp(s: PixelSurface) -> None:
    """Contracting orbit: emitted facets fold back toward a stabilizing core."""
    s.shadow(14, 50)
    s.polygon([(15, 46), (22, 34), (33, 29), (44, 37), (50, 49),
               (42, 61), (28, 65), (18, 57)], "body")
    s.polygon([(23, 43), (32, 34), (43, 42), (42, 54), (33, 61),
               (22, 54)], "light")
    s.rect((27, 45, 39, 55), "shade")
    s.rect((30, 47, 36, 53), "metal")
    s.rect((32, 49, 35, 52), "accent")
    s.polygon([(9, 39), (16, 36), (19, 43), (13, 47)], "metal")
    s.polygon([(45, 29), (52, 33), (49, 40), (43, 36)], "body")
    s.polygon([(48, 56), (57, 59), (52, 65), (44, 62)], "metal")
    s.polygon([(17, 60), (24, 65), (19, 70), (12, 66)], "light")
    s.line([(18, 44), (25, 48)], "accent", 1)
    s.line([(42, 48), (49, 46)], "metal", 1)


def recovery_bailiff(s: PixelSurface) -> None:
    """Weighted reset: shoulders roll forward as the maul returns to guard."""
    s.shadow(8, 55)
    s.polygon([(17, 39), (26, 33), (41, 36), (49, 46), (47, 62),
               (40, 69), (21, 68), (14, 57)], "body")
    s.polygon([(15, 42), (24, 36), (23, 51), (12, 55)], "light")
    s.polygon([(39, 38), (49, 44), (52, 55), (43, 54)], "light")
    s.polygon([(24, 26), (37, 23), (44, 30), (41, 41), (27, 42), (21, 34)], "body")
    s.polygon([(21, 23), (37, 19), (44, 23), (35, 27), (22, 29)], "shade")
    s.rect((28, 32, 39, 35), "shade")
    s.rect((36, 32, 39, 33), "accent")
    for plate_x in (24, 30, 36):
        s.rect((plate_x, 48, plate_x + 4, 52), "shade")
        s.rect((plate_x + 1, 48, plate_x + 3, 50), "metal")
    s.rect((23, 55, 40, 58), "accent")
    s.polygon([(19, 65), (29, 66), (27, 73), (17, 72)], "shade")
    s.polygon([(36, 65), (46, 63), (49, 72), (39, 73)], "shade")
    s.line([(45, 43), (51, 58)], "metal", 3)
    s.rect((48, 55, 57, 63), "metal")
    s.rect((51, 57, 55, 61), "shade")
    s.rect((48, 55, 57, 56), "light")


def recovery_retainer(s: PixelSurface) -> None:
    """Blade withdrawal: rear foot plants while the hooked docket lowers."""
    s.shadow(11, 53)
    s.polygon([(20, 35), (29, 31), (41, 36), (46, 49), (43, 65),
               (36, 69), (20, 68), (15, 54)], "body")
    s.polygon([(22, 37), (30, 34), (37, 39), (32, 48), (22, 45)], "light")
    s.polygon([(25, 19), (36, 18), (41, 28), (38, 36), (27, 36), (22, 27)], "shade")
    s.rect((26, 27, 38, 30), "metal")
    s.rect((34, 28, 38, 29), "accent")
    s.polygon([(25, 39), (31, 45), (28, 50), (23, 46)], "shade")
    s.polygon([(38, 39), (33, 45), (37, 50), (41, 45)], "accent")
    s.line([(31, 49), (31, 62)], "metal", 1)
    s.rect((23, 52, 28, 58), "shade")
    s.rect((24, 53, 27, 56), "metal")
    s.polygon([(19, 65), (27, 65), (25, 72), (17, 72)], "shade")
    s.polygon([(36, 64), (44, 62), (48, 70), (41, 72)], "shade")
    s.rect((40, 46, 44, 51), "shade")
    s.line([(42, 49), (52, 61)], "metal", 2)
    s.line([(42, 49), (52, 61)], "light", 1)
    s.polygon([(51, 59), (57, 62), (53, 66), (49, 62)], "accent")


def recovery_widow(s: PixelSurface) -> None:
    """Post-cast recoil: bobbins retract and fog ribbons curl inward."""
    s.shadow(10, 52)
    s.polygon([(22, 35), (31, 27), (41, 35), (46, 48), (41, 60),
               (32, 67), (21, 61), (16, 48)], "body")
    s.polygon([(25, 34), (31, 30), (38, 36), (37, 43), (31, 47), (23, 42)], "light")
    s.polygon([(23, 31), (31, 23), (41, 32), (37, 39), (27, 39)], "shade")
    s.rect((28, 47, 35, 56), "shade")
    s.rect((30, 48, 33, 55), "metal")
    s.rect((28, 51, 35, 53), "accent")
    s.line([(18, 45), (28, 53), (41, 46)], "metal", 1)
    s.line([(20, 40), (31, 53), (42, 41)], "light", 1)
    s.rect((12, 44, 17, 49), "shade")
    s.rect((14, 45, 18, 47), "accent")
    s.rect((45, 43, 50, 48), "shade")
    s.rect((43, 44, 48, 46), "accent")
    s.polygon([(20, 57), (13, 61), (8, 67), (18, 70), (27, 63)], "light")
    s.polygon([(40, 57), (48, 60), (57, 66), (49, 70), (36, 63)], "body")


def recovery_furnace(s: PixelSurface) -> None:
    """Cooling reset: rake is drawn back while the grate vents a last ember."""
    s.shadow(8, 55)
    s.polygon([(17, 35), (26, 29), (41, 31), (49, 41), (49, 61),
               (42, 69), (20, 69), (13, 59), (13, 44)], "body")
    s.polygon([(19, 37), (25, 33), (42, 34), (46, 42), (38, 45), (21, 43)], "light")
    s.rect((22, 47, 43, 63), "metal")
    s.rect((25, 50, 40, 61), "shade")
    s.rect((28, 52, 37, 58), "accent")
    s.rect((30, 53, 35, 56), "metal")
    for tooth_x in (28, 32, 36):
        s.rect((tooth_x, 58, tooth_x + 1, 61), "body")
    s.rect((21, 19, 31, 32), "shade")
    s.rect((22, 18, 30, 21), "metal")
    s.rect((35, 22, 44, 33), "shade")
    s.rect((36, 21, 43, 24), "light")
    s.polygon([(15, 43), (9, 48), (11, 59), (17, 57)], "shade")
    s.polygon([(48, 43), (54, 48), (52, 59), (46, 57)], "shade")
    s.polygon([(18, 65), (27, 66), (25, 73), (15, 72)], "shade")
    s.polygon([(38, 65), (47, 63), (52, 71), (42, 73)], "shade")
    s.line([(45, 43), (51, 59)], "metal", 3)
    s.line([(45, 43), (51, 59)], "light", 1)
    s.line([(49, 60), (57, 61)], "accent", 2)


def recovery_warden(s: PixelSurface) -> None:
    """Damped reset: yoke settles unevenly and the calibration hammer drops."""
    s.shadow(8, 55)
    s.polygon([(17, 35), (26, 30), (42, 32), (50, 43), (48, 61),
               (40, 69), (21, 69), (13, 58)], "body")
    s.polygon([(20, 36), (28, 33), (43, 36), (47, 44), (38, 47), (21, 43)], "light")
    s.rect((17, 25, 22, 38), "shade")
    s.rect((18, 27, 21, 35), "metal")
    s.rect((24, 19, 32, 24), "light")
    s.rect((25, 20, 31, 24), "metal")
    s.rect((36, 21, 44, 27), "body")
    s.rect((40, 23, 48, 31), "metal")
    s.rect((43, 25, 47, 29), "shade")
    s.line([(22, 33), (28, 38), (42, 37), (47, 33)], "light", 1)
    s.rect((14, 43, 21, 52), "shade")
    s.rect((15, 44, 19, 50), "metal")
    s.rect((43, 42, 51, 51), "shade")
    s.rect((45, 43, 49, 49), "metal")
    s.rect((23, 44, 41, 59), "shade")
    s.rect((26, 46, 39, 57), "metal")
    s.rect((29, 48, 36, 55), "accent")
    s.rect((31, 50, 34, 53), "light")
    s.polygon([(18, 65), (28, 66), (26, 73), (15, 72)], "shade")
    s.polygon([(37, 65), (47, 63), (52, 71), (41, 73)], "shade")
    s.line([(44, 46), (51, 59)], "metal", 3)
    s.rect((48, 56, 58, 64), "accent")
    s.rect((50, 58, 56, 62), "shade")


def recovery_black_court(s: PixelSurface) -> None:
    """Measured withdrawal: mantle closes and the seal-breaking blade lowers."""
    s.shadow(9, 53)
    s.polygon([(24, 27), (38, 28), (44, 42), (49, 67), (38, 70),
               (31, 59), (25, 70), (14, 67), (20, 43)], "body")
    s.polygon([(25, 32), (37, 32), (40, 48), (32, 57), (23, 48)], "light")
    s.polygon([(27, 15), (37, 17), (41, 26), (37, 35), (27, 34), (23, 25)], "shade")
    s.polygon([(25, 18), (32, 13), (40, 19), (36, 23), (27, 22)], "body")
    s.rect((27, 25, 38, 27), "metal")
    s.rect((35, 25, 39, 26), "accent")
    s.polygon([(15, 47), (21, 43), (25, 47), (20, 52), (11, 53)], "shade")
    s.polygon([(43, 43), (51, 47), (48, 53), (40, 49)], "light")
    s.polygon([(25, 43), (32, 47), (38, 43), (37, 52), (32, 58), (27, 52)], "accent")
    s.line([(32, 47), (32, 58)], "body", 1)
    s.rect((23, 55, 29, 60), "shade")
    s.rect((24, 56, 28, 58), "metal")
    s.rect((39, 46, 44, 51), "shade")
    s.line([(42, 49), (52, 61)], "metal", 3)
    s.line([(42, 49), (52, 61)], "light", 1)
    s.polygon([(50, 59), (57, 62), (53, 66), (49, 63)], "accent")
    s.rect((22, 65, 28, 73), "shade")
    s.rect((37, 64, 44, 73), "shade")


DRAWERS = {
    "hound": draw_hound,
    "wisp": draw_wisp,
    "ashen-oni": draw_bailiff,
    "court-retainer": draw_retainer,
    "widow": draw_widow,
    "furnace": draw_furnace,
    "bell-warden": draw_warden,
    "black-court": draw_black_court,
}

DETAILERS = {
    "hound": detail_hound,
    "wisp": detail_wisp,
    "ashen-oni": detail_bailiff,
    "court-retainer": detail_retainer,
    "widow": detail_widow,
    "furnace": detail_furnace,
    "bell-warden": detail_warden,
    "black-court": detail_black_court,
}

DEFEAT_DRAWERS = {
    "hound": defeat_hound,
    "wisp": defeat_wisp,
    "ashen-oni": defeat_bailiff,
    "court-retainer": defeat_retainer,
    "widow": defeat_widow,
    "furnace": defeat_furnace,
    "bell-warden": defeat_warden,
    "black-court": defeat_black_court,
}

RECOVERY_DRAWERS = {
    "hound": recovery_hound,
    "wisp": recovery_wisp,
    "ashen-oni": recovery_bailiff,
    "court-retainer": recovery_retainer,
    "widow": recovery_widow,
    "furnace": recovery_furnace,
    "bell-warden": recovery_warden,
    "black-court": recovery_black_court,
}


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def ihdr(data: bytes) -> dict:
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("Invalid PNG signature or missing IHDR")
    width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(
        ">IIBBBBB", data[16:29]
    )
    return {
        "width": width,
        "height": height,
        "bitDepth": bit_depth,
        "colorType": color_type,
        "compression": compression,
        "filter": filtering,
        "interlace": interlace,
    }


def frame_metadata(image: Image.Image, family: dict, pose: str, column: int) -> dict:
    cell_width = SOURCE["geometry"]["cellWidth"]
    cell_height = SOURCE["geometry"]["cellHeight"]
    minimum_gutter = SOURCE["geometry"]["minimumTransparentGutter"]
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError(f"Empty frame {family['id']}:{pose}")
    left, top, right, bottom = bbox
    gutters = {
        "left": left,
        "top": top,
        "right": cell_width - right,
        "bottom": cell_height - bottom,
    }
    if min(gutters.values()) < minimum_gutter:
        raise ValueError(f"Insufficient gutter in {family['id']}:{pose}: {gutters}")
    opaque_pixels = sum(1 for value in alpha.getdata() if value)
    if opaque_pixels < 140:
        raise ValueError(f"Frame {family['id']}:{pose} is too sparse ({opaque_pixels} pixels)")
    anchors = family["anchors"][pose]
    return {
        "id": f"{family['id']}:{pose}",
        "familyId": family["id"],
        "templateIds": family["templateIds"],
        "pose": pose,
        "tag": next(item["tag"] for item in SOURCE["poses"] if item["id"] == pose),
        "event": next(item["event"] for item in SOURCE["poses"] if item["id"] == pose),
        "paletteId": family["paletteId"],
        "rect": {
            "x": column * cell_width,
            "y": family["row"] * cell_height,
            "width": cell_width,
            "height": cell_height,
        },
        "pivot": anchors["pivot"],
        "ground": anchors["ground"],
        "contact": anchors["contact"],
        "alphaBounds": {"x": left, "y": top, "width": right - left, "height": bottom - top},
        "transparentGutter": gutters,
        "opaquePixelCount": opaque_pixels,
        "rgbaSha256": sha256(image.tobytes()),
    }


def build_contact_sheet(atlas: Image.Image, families: list[dict]) -> Image.Image:
    geometry = SOURCE["geometry"]
    cell_width = geometry["cellWidth"]
    cell_height = geometry["cellHeight"]
    frame_scale = 2
    frame_width = cell_width * frame_scale + 8
    row_height = cell_height * frame_scale + 24
    sheet_width = 16 + frame_width * len(POSES)
    sheet = Image.new("RGB", (sheet_width, 28 + row_height * len(families)), (11, 16, 32))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((8, 7), "ENEMY COMBAT KEY POSES - REVIEW ONLY / NOT RUNTIME", fill=(215, 201, 154), font=font)
    for family in families:
        row_y = 28 + family["row"] * row_height
        draw.rectangle((4, row_y, sheet_width - 5, row_y + row_height - 4), outline=(39, 70, 107), width=1)
        draw.text((8, row_y + 5), f"{family['row'] + 1:02d}  {family['label']}", fill=(246, 232, 185), font=font)
        for column, pose in enumerate(POSES):
            cell_x = 8 + column * frame_width
            draw.text((cell_x, row_y + 18), pose.upper(), fill=(136, 200, 197), font=font)
            frame = atlas.crop((
                column * cell_width,
                family["row"] * cell_height,
                (column + 1) * cell_width,
                (family["row"] + 1) * cell_height,
            ))
            scaled = frame.resize((cell_width * frame_scale, cell_height * frame_scale), Image.Resampling.NEAREST)
            sheet.paste(scaled.convert("RGB"), (cell_x, row_y + 32), scaled.getchannel("A"))
    return sheet


def build_artifacts() -> dict[str, bytes]:
    geometry = SOURCE["geometry"]
    atlas = Image.new(
        "RGBA",
        (geometry["columns"] * geometry["cellWidth"], geometry["rows"] * geometry["cellHeight"]),
        (0, 0, 0, 0),
    )
    frames: list[dict] = []
    seen_masks: dict[str, set[str]] = {}
    for family in SOURCE["families"]:
        seen_masks[family["id"]] = set()
        palette = SOURCE["paletteSets"][family["paletteId"]]
        for column, pose in enumerate(POSES):
            surface = PixelSurface(palette)
            if pose == "defeat":
                DEFEAT_DRAWERS[family["id"]](surface)
            elif pose == "recovery":
                RECOVERY_DRAWERS[family["id"]](surface)
            else:
                DRAWERS[family["id"]](surface, pose)
                DETAILERS[family["id"]](surface, pose)
            mask_hash = sha256(surface.image.getchannel("A").tobytes())
            if mask_hash in seen_masks[family["id"]]:
                raise ValueError(f"Pose silhouette repeated in {family['id']}:{pose}")
            seen_masks[family["id"]].add(mask_hash)
            frames.append(frame_metadata(surface.image, family, pose, column))
            atlas.alpha_composite(surface.image, (
                column * geometry["cellWidth"],
                family["row"] * geometry["cellHeight"],
            ))

    atlas_data = png_bytes(atlas)
    contact_data = png_bytes(build_contact_sheet(atlas, SOURCE["families"]))
    source_data = SOURCE_PATH.read_bytes()
    builder_data = Path(__file__).read_bytes()
    manifest = {
        "assetId": SOURCE["assetId"],
        "status": "editable-production-key-pose-suite",
        "runtimeIntegration": "current-browser-neutral-windup-attack-stagger-defeat-recovery",
        "canonicalSource": SOURCE_PATH.name,
        "builder": Path(__file__).name,
        "originality": "Original integer-pixel primitives; no generated or external raster pixels used.",
        "geometry": geometry,
        "poseOrder": list(POSES),
        "familyOrder": list(FAMILIES),
        "paletteSets": SOURCE["paletteSets"],
        "familyMappings": [
            {
                "id": family["id"],
                "row": family["row"],
                "label": family["label"],
                "paletteId": family["paletteId"],
                "scaleClass": family["scaleClass"],
                "templateIds": family["templateIds"],
            }
            for family in SOURCE["families"]
        ],
        "sources": [
            {"path": SOURCE_PATH.name, "format": "json", "sha256": sha256(source_data)},
            {"path": Path(__file__).name, "format": "python", "sha256": sha256(builder_data)},
        ],
        "exports": [
            {
                "path": ATLAS_PATH.name,
                "role": "transparent-runtime-atlas",
                "runtime": True,
                "sha256": sha256(atlas_data),
                "ihdr": ihdr(atlas_data),
            },
            {
                "path": CONTACT_PATH.name,
                "role": "labeled-review-contact-sheet",
                "runtime": False,
                "sha256": sha256(contact_data),
                "ihdr": ihdr(contact_data),
            },
        ],
        "frames": frames,
    }
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return {
        ATLAS_PATH.name: atlas_data,
        CONTACT_PATH.name: contact_data,
        MANIFEST_PATH.name: manifest_data,
    }


def write_or_check(artifacts: dict[str, bytes], check: bool) -> None:
    if check:
        mismatches = []
        for name, expected in artifacts.items():
            path = ROOT / name
            if not path.exists():
                mismatches.append(f"missing {name}")
            elif path.read_bytes() != expected:
                mismatches.append(f"stale {name}")
        if mismatches:
            raise SystemExit("Enemy combat suite check failed: " + ", ".join(mismatches))
        print("Enemy combat suite is byte-identical to a clean deterministic build.")
        return
    for name, data in artifacts.items():
        (ROOT / name).write_bytes(data)
    print(f"Wrote {', '.join(artifacts)}")


def verify_two_clean_builds() -> None:
    first = build_artifacts()
    second = build_artifacts()
    for name in first:
        if first[name] != second[name]:
            raise ValueError(f"Non-deterministic output detected: {name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if checked-in artifacts differ")
    args = parser.parse_args()
    SOURCE = load_source()
    verify_two_clean_builds()
    write_or_check(build_artifacts(), args.check)
