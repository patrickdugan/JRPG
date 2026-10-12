#!/usr/bin/env python3
"""Build the deterministic side-view action objective sprite suite.

Provenance lane: pixel-authored deterministic production. Every frame is
composed from explicit integer-coordinate Pillow primitives under the named
palette in action-objective-suite-v1.source.json. Nothing is sampled from a
generated concept, photograph, or external raster.

    python build_action_objective_suite.py          # write outputs
    python build_action_objective_suite.py --check  # non-writing byte check
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import struct
from pathlib import Path

import PIL
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
SOURCE_PATH = ROOT / "action-objective-suite-v1.source.json"
ATLAS_NAME = "action-objective-atlas-v1.png"
REVIEW_NAME = "action-objective-review-sheet-v1.png"
MANIFEST_NAME = "manifest.json"
RUNTIME_DIR = REPO / "game" / "assets" / "art" / "action-objective-suite-v1"
RUNTIME_ATLAS = RUNTIME_DIR / ATLAS_NAME
PILLOW_VERSION = "11.3.0"

SOURCE = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
GEOMETRY = SOURCE["geometry"]
W = GEOMETRY["cellWidth"]
H = GEOMETRY["cellHeight"]
FOOT = GEOMETRY["footRow"]
COLORS = {
    name: tuple(int(value[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
    for name, value in SOURCE["palette"].items()
}
CLEAR = (0, 0, 0, 0)


class Cell:
    """One native-resolution 64 x 80 RGBA cell drawn with integer primitives."""

    def __init__(self) -> None:
        self.image = Image.new("RGBA", (W, H), CLEAR)
        self.draw = ImageDraw.Draw(self.image)

    def r(self, x0: int, y0: int, x1: int, y1: int, color: str) -> None:
        self.draw.rectangle((x0, y0, x1, y1), fill=COLORS[color])

    def clear(self, x0: int, y0: int, x1: int, y1: int) -> None:
        self.draw.rectangle((x0, y0, x1, y1), fill=CLEAR)

    def p(self, x: int, y: int, color: str) -> None:
        self.draw.point((x, y), fill=COLORS[color])

    def ps(self, points, color: str) -> None:
        for x, y in points:
            self.p(x, y, color)

    def h(self, x0: int, x1: int, y: int, color: str) -> None:
        self.r(x0, y, x1, y, color)

    def v(self, x: int, y0: int, y1: int, color: str) -> None:
        self.r(x, y0, x, y1, color)

    def poly(self, points, color: str) -> None:
        self.draw.polygon(points, fill=COLORS[color])

    def line(self, points, color: str) -> None:
        self.draw.line(points, fill=COLORS[color], width=1)

    def ellipse(self, box, color: str) -> None:
        self.draw.ellipse(box, fill=COLORS[color])

    def spans(self, rows, color: str) -> None:
        """rows: iterable of (y, x0, x1)."""
        for y, x0, x1 in rows:
            self.h(x0, x1, y, color)

    def paste(self, other: Image.Image, x: int, y: int) -> None:
        self.image.alpha_composite(other, (x, y))


# ---------------------------------------------------------------------------
# Shared motifs
# ---------------------------------------------------------------------------

def contact(c: Cell, x0: int, x1: int) -> None:
    c.h(x0, x1, FOOT, "ink2")


def halo(c: Cell, cx: int, cy: int, radius: int, color: str) -> None:
    """Eight hard single-pixel light marks; no blur or ramps."""
    d = radius * 7 // 10
    c.ps([
        (cx - radius, cy), (cx + radius, cy), (cx, cy - radius), (cx, cy + radius),
        (cx - d, cy - d), (cx + d, cy - d), (cx - d, cy + d), (cx + d, cy + d),
    ], color)


def chochin(c: Cell, cx: int, top: int, level: int) -> None:
    """Round paper lantern, 7 x 10. level: 0 unlit, 1 dim, 2 bright."""
    dark, mid, hi = {
        0: ("paper_s", "paper", "paper_l"),
        1: ("flame_d", "flame", "flame_l"),
        2: ("flame", "flame_l", "paper_l"),
    }[level]
    c.h(cx - 2, cx + 2, top, "cedar_d")
    c.h(cx - 2, cx + 2, top + 1, dark)
    c.r(cx - 3, top + 2, cx + 3, top + 7, dark)
    c.r(cx - 2, top + 2, cx + 2, top + 7, mid)
    c.h(cx - 2, cx + 2, top + 8, dark)
    c.v(cx - 1, top + 3, top + 6, hi)
    c.h(cx - 3, cx + 3, top + 4, dark)
    c.p(cx - 1, top + 4, mid)
    c.h(cx - 2, cx + 2, top + 9, "cedar_d")
    if level == 2:
        halo(c, cx, top + 5, 7, "flame")
        halo(c, cx, top + 5, 10, "flame_d")


def wisp(c: Cell, x: int, y: int, length: int, light: bool = True) -> None:
    """A low bank of rain-indigo fog: flat base with stepped, uneven puffs."""
    c.h(x, x + length, y, "rain2")
    c.h(x + 2, x + length - 2, y + 1, "rain")
    for index, bx in enumerate(range(x + 1, x + length - 3, 5)):
        height = 2 + (index * 7 + length) % 3
        c.r(bx, y - height, bx + 4, y - 1, "rain2")
        c.h(bx + 1, bx + 3, y - height - 1, "fog")
        if light and index % 2 == 0:
            c.p(bx + 1, y - height - 1, "fog_l")


def chain(c: Cell, points) -> None:
    """Heavy readable chain: alternating flat and edge-on links."""
    for index, (x, y) in enumerate(points):
        if index % 2 == 0:
            c.h(x - 1, x + 1, y, "iron_l")
            c.h(x - 1, x + 1, y + 1, "iron_d")
        else:
            c.v(x, y - 1, y + 1, "iron")
            c.p(x, y - 1, "iron_l")


def post(c: Cell, x0: int, x1: int, y0: int, y1: int) -> None:
    c.r(x0, y0, x1, y1, "cedar")
    c.v(x0, y0, y1, "cedar_l")
    c.v(x0 + 1, y0, y1, "cedar_m")
    c.v(x1, y0, y1, "cedar_d")


def stone_block(c: Cell, x0: int, y0: int, x1: int, y1: int) -> None:
    c.r(x0, y0, x1, y1, "stone")
    c.h(x0, x1, y0, "stone_l")
    c.v(x1, y0, y1, "stone_d")
    c.h(x0, x1, y1, "stone_d")


def masonry(c: Cell, x0: int, y0: int, x1: int, y1: int, course: int = 6) -> None:
    c.r(x0, y0, x1, y1, "stone")
    for row, y in enumerate(range(y0 + course, y1 + 1, course)):
        c.h(x0, x1, y, "stone_d")
        c.h(x0, x1, y - course + 1, "stone_l")
        offset = 0 if row % 2 == 0 else course
        for x in range(x0 + 3 + offset, x1, course * 2):
            c.v(x, y - course + 1, y - 1, "stone_d")


def sparkle(c: Cell, x: int, y: int, color: str = "dawn_l") -> None:
    c.ps([(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], color)


# ---------------------------------------------------------------------------
# Anchor kinds
# ---------------------------------------------------------------------------

def draw_river_gate(c: Cell, state: str) -> None:
    stone_block(c, 9, 72, 18, 77)
    stone_block(c, 45, 72, 54, 77)
    if state == "locked":
        c.r(17, 33, 46, 72, "cedar_m")
        for x in range(18, 46, 4):
            c.v(x, 33, 72, "cedar")
        c.v(31, 33, 72, "ink2")
        c.v(32, 33, 72, "cedar_d")
        c.h(17, 46, 34, "cedar_l")
        c.r(14, 48, 49, 50, "iron")
        c.h(14, 49, 48, "iron_l")
        c.h(14, 49, 50, "iron_d")
        c.r(29, 46, 34, 53, "iron_d")
        c.r(30, 47, 33, 52, "bronze")
        c.p(31, 49, "ink")
        c.h(17, 46, 71, "cedar_d")
    else:
        c.r(17, 33, 46, 72, "ink2")
        c.r(17, 49, 46, 55, "rain")
        c.h(17, 46, 49, "rain2")
        c.ps([(20, 47), (21, 46), (23, 48), (40, 47), (42, 45), (43, 47)], "rain")
        c.r(17, 56, 46, 72, "water_d")
        c.h(19, 25, 59, "water")
        c.h(30, 41, 62, "water")
        c.h(21, 27, 66, "water_l")
        c.h(35, 44, 69, "water")
        c.h(24, 30, 71, "water")
        c.r(17, 33, 19, 72, "cedar_m")
        c.v(19, 33, 72, "cedar_d")
        c.r(44, 33, 46, 72, "cedar_m")
        c.v(44, 33, 72, "cedar_l")
        chochin(c, 32, 36, 2 if state == "complete" else 1)
        if state == "complete":
            c.h(22, 41, 72, "dawn")
            c.ps([(24, 70), (30, 69), (37, 70), (27, 67), (34, 66)], "dawn_l")
            c.ps([(16, 40), (16, 46), (47, 42), (47, 48)], "flame")
    for x0 in (11, 47):
        post(c, x0, x0 + 5, 22, 72)
    c.r(17, 30, 46, 32, "cedar_m")
    c.h(17, 46, 30, "cedar_l")
    c.h(17, 46, 32, "cedar_d")
    c.r(6, 18, 57, 21, "cedar")
    c.h(6, 57, 18, "cedar_l")
    c.h(6, 57, 21, "cedar_d")
    c.poly([(3, 17), (60, 17), (54, 10), (9, 10)], "iron")
    c.h(3, 60, 17, "iron_d")
    c.h(9, 54, 10, "iron_l")
    for x in range(11, 54, 4):
        c.line([(x, 11), (x - 1, 16)], "iron_d")
    c.r(12, 7, 51, 9, "iron_d")
    c.h(13, 50, 7, "iron_l")
    c.ps([(2, 16), (61, 16), (2, 15), (61, 15)], "iron_l")


def draw_archive_door(c: Cell, state: str) -> None:
    c.r(6, 74, 57, 77, "stone")
    c.h(6, 57, 74, "stone_l")
    c.h(6, 57, 77, "stone_d")
    if state == "locked":
        c.r(15, 21, 48, 73, "lacq_d")
        for y in (30, 46, 62):
            c.h(15, 48, y, "iron")
            c.h(15, 48, y + 1, "iron_d")
            for x in range(17, 48, 5):
                c.p(x, y, "bronze_l")
        c.v(31, 21, 73, "ink")
        c.v(32, 21, 73, "ink")
        c.v(16, 21, 73, "lacq")
        c.v(33, 21, 73, "lacq")
        c.r(12, 52, 51, 54, "iron")
        c.h(12, 51, 52, "iron_l")
        c.h(12, 51, 54, "iron_d")
        c.ps([(28, 48), (29, 47), (30, 48), (29, 49)], "bronze")
        c.ps([(35, 48), (34, 47), (33, 48), (34, 49)], "bronze")
    else:
        light, glint = ("dawn", "dawn_l") if state == "complete" else ("rain", "rain2")
        c.r(15, 21, 48, 73, "ink")
        c.r(21, 29, 42, 71, "ink2")
        c.r(26, 37, 37, 69, light)
        c.r(28, 40, 35, 69, glint)
        c.poly([(15, 73), (48, 73), (37, 69), (26, 69)], "stone_d")
        c.line([(15, 21), (26, 37)], "stone_d")
        c.line([(48, 21), (37, 37)], "stone_d")
        c.r(15, 21, 18, 73, "lacq_d")
        c.v(18, 21, 73, "lacq")
        c.r(45, 21, 48, 73, "lacq_d")
        c.v(45, 21, 73, "ink")
        for y in (30, 46, 62):
            c.h(15, 18, y, "iron")
            c.h(45, 48, y, "iron")
        if state == "complete":
            c.h(25, 38, 72, "dawn")
            c.h(28, 35, 71, "dawn_l")
            c.ps([(22, 70), (41, 70), (31, 66), (33, 63)], "dawn_l")
            c.h(10, 53, 74, "dawn")
    c.r(8, 21, 14, 76, "lacq_d")
    c.v(8, 21, 76, "lacq")
    c.v(14, 21, 76, "ink")
    c.r(49, 21, 55, 76, "lacq_d")
    c.v(49, 21, 76, "lacq")
    c.v(55, 21, 76, "ink")
    for y in (26, 40, 54, 68):
        c.p(11, y, "bronze_l")
        c.p(52, y, "bronze_l")
    c.r(4, 17, 59, 20, "iron_d")
    c.h(4, 59, 17, "iron_l")
    c.poly([(7, 16), (56, 16), (49, 9), (14, 9)], "lacq_d")
    c.h(7, 56, 16, "ink")
    c.h(14, 49, 9, "lacq")
    c.h(12, 51, 13, "bronze_d")
    c.r(30, 6, 33, 8, "iron_d")
    c.h(30, 33, 6, "iron_l")


def draw_lantern_boat(c: Cell, state: str) -> None:
    for x0, x1, y, color in (
        (1, 9, 77, "water"), (14, 24, 77, "water_l"), (30, 41, 77, "water"),
        (46, 53, 77, "water_l"), (56, 62, 76, "water"), (3, 7, 75, "water_l"),
        (58, 61, 74, "water_l"),
    ):
        c.h(x0, x1, y, color)
    c.poly([(5, 62), (58, 62), (54, 73), (10, 73)], "cedar")
    c.h(10, 54, 73, "cedar_d")
    c.h(7, 56, 68, "cedar_m")
    c.h(9, 55, 71, "cedar_d")
    c.poly([(54, 62), (60, 55), (62, 56), (58, 62)], "cedar")
    c.line([(58, 62), (62, 56)], "cedar_l")
    c.poly([(5, 62), (2, 58), (4, 58), (8, 62)], "cedar")
    c.h(4, 59, 62, "cedar_l")
    c.h(5, 58, 63, "wood_hi")
    c.h(5, 58, 64, "cedar_d")
    c.r(14, 58, 29, 61, "straw_d")
    c.h(14, 29, 58, "straw")
    for x in range(16, 29, 3):
        c.p(x, 60, "straw")
    c.v(22, 57, 61, "rope")
    c.r(48, 24, 49, 61, "cedar_m")
    c.v(49, 24, 61, "cedar_d")
    c.h(41, 49, 24, "cedar_d")
    c.h(42, 48, 23, "cedar_m")
    c.v(43, 25, 26, "rope")
    chochin(c, 43, 27, 1 if state == "waiting" else 2)
    if state == "boarding":
        c.line([(1, 76), (9, 63)], "cedar_l")
        c.line([(2, 76), (10, 63)], "cedar_m")
        c.line([(3, 76), (11, 63)], "cedar_d")
    if state == "complete":
        c.poly([(50, 18), (57, 20), (50, 23)], "dawn")
        c.line([(50, 18), (50, 23)], "dawn_l")
        c.v(49, 18, 23, "cedar_d")
        c.ps([(15, 56), (20, 55), (26, 56)], "dawn_l")


def draw_safe_shelter(c: Cell, state: str) -> None:
    c.r(10, 75, 53, 77, "straw_d")
    c.h(10, 53, 75, "straw")
    for x in range(12, 53, 4):
        c.p(x, 76, "straw")
    post(c, 7, 9, 33, 77)
    c.r(52, 39, 54, 77, "cedar")
    c.v(52, 39, 77, "cedar_m")
    c.v(54, 39, 77, "cedar_d")
    c.poly([(2, 30), (61, 37), (61, 42), (2, 35)], "straw_d")
    c.poly([(2, 27), (61, 34), (61, 37), (2, 30)], "straw")
    for x in range(4, 61, 3):
        y = 30 + (x - 2) * 7 // 59
        c.p(x, y, "straw_d")
        c.p(x + 1, y + 3, "straw")
    c.line([(2, 35), (61, 42)], "cedar_d")
    c.r(10, 37, 27, 39, "straw_d")
    c.h(10, 27, 37, "straw")
    for x in (13, 24):
        c.v(x, 40, 43, "rope")
    c.v(31, 39, 40, "rope")
    chochin(c, 31, 41, 2 if state == "complete" else 1)
    if state == "complete":
        c.r(16, 71, 29, 74, "cloth_w")
        c.h(16, 29, 71, "fog_l")
        c.h(16, 29, 74, "cloth_w_d")
        c.v(22, 71, 74, "cloth_w_d")
        c.ps([(12, 74), (20, 74), (36, 74), (44, 74), (51, 74)], "dawn")
        c.h(34, 50, 77, "dawn")


def draw_escape_arch(c: Cell, state: str) -> None:
    masonry(c, 6, 22, 57, 77)
    c.ellipse((13, 27, 50, 53), "stone_l")
    c.r(13, 40, 50, 77, "stone_l")
    c.ellipse((16, 30, 47, 50), "ink")
    c.r(16, 40, 47, 77, "ink")
    for x in (14, 49):
        c.v(x, 40, 77, "stone_d")
    if state == "complete":
        c.r(26, 48, 37, 71, "dawn")
        c.r(28, 51, 35, 71, "dawn_l")
        c.poly([(16, 77), (47, 77), (37, 71), (26, 71)], "stone_d")
        c.h(24, 39, 72, "dawn")
        chochin(c, 9, 46, 2)
        c.v(9, 43, 45, "rope")
    else:
        c.r(29, 52, 34, 70, "rain")
        c.r(30, 55, 33, 70, "rain2")
        c.poly([(16, 77), (47, 77), (36, 70), (27, 70)], "stone_d")
    c.r(16, 72, 47, 77, "water_d")
    c.h(18, 24, 74, "water")
    c.h(30, 38, 75, "water_l" if state == "complete" else "water")
    c.h(41, 46, 76, "water")
    for x in range(18, 47, 4):
        c.v(x, 32, 38, "iron")
        c.p(x, 39, "iron_l")
    c.h(17, 46, 33, "iron_d")


def draw_canal_lock(c: Cell, state: str) -> None:
    masonry(c, 5, 28, 15, 77, 5)
    masonry(c, 48, 28, 58, 77, 5)
    c.v(5, 28, 77, "stone_l")
    c.v(58, 28, 77, "stone_d")
    gate_bottom = 77 if state == "closed" else 46
    c.r(16, 27, 47, gate_bottom, "cedar_m")
    for y in range(31, gate_bottom, 5):
        c.h(16, 47, y, "cedar_d")
        c.h(16, 47, y + 1, "cedar_l")
    for x in (22, 41):
        c.v(x, 27, gate_bottom, "iron")
    if state == "closed":
        c.h(16, 47, 77, "water")
        c.ps([(19, 76), (27, 76), (36, 76), (44, 76)], "water_l")
    else:
        c.r(16, 47, 47, 77, "water_d")
        c.r(16, 58, 47, 77, "water")
        for x0, y in ((18, 60), (28, 63), (38, 61), (21, 67), (33, 70), (17, 74), (40, 73)):
            c.h(x0, x0 + 5, y, "water_l")
        c.h(16, 47, 47, "iron_d")
        c.v(24, 21, 27, "iron_l")
        c.v(39, 21, 27, "iron_l")
    c.r(3, 22, 60, 26, "cedar")
    c.h(3, 60, 22, "cedar_l")
    c.h(3, 60, 26, "cedar_d")
    c.ellipse((25, 8, 38, 21), "cedar_d")
    c.ellipse((27, 10, 36, 19), "cedar_l")
    c.ellipse((29, 12, 34, 17), "cedar_d")
    c.line([(31, 8), (31, 21)], "cedar_m")
    c.line([(25, 14), (38, 14)], "cedar_m")
    c.r(30, 13, 33, 16, "iron")
    c.p(31, 14, "iron_l")
    c.r(29, 20, 34, 22, "iron_d")



def draw_chain_post(c: Cell, state: str) -> None:
    c.r(23, 73, 40, 77, "stone")
    c.h(23, 40, 73, "stone_l")
    c.h(23, 40, 77, "stone_d")
    post(c, 28, 35, 24, 72)
    c.r(27, 22, 36, 24, "cedar_d")
    c.h(28, 35, 22, "cedar_m")
    for y in (32, 60):
        c.r(27, y, 36, y + 2, "iron")
        c.h(27, 36, y, "iron_l")
    c.r(36, 41, 39, 45, "iron_l")
    c.r(37, 42, 38, 44, "ink")
    c.v(39, 42, 45, "iron_d")
    if state == "chained":
        points = [(39, 47), (40, 49), (41, 51), (42, 53), (43, 55), (45, 57), (46, 59), (48, 61),
                  (49, 63), (51, 65), (52, 67), (53, 69)]
        chain(c, points)
        c.r(51, 71, 58, 76, "iron_l")
        c.clear(53, 72, 56, 75)
        c.h(51, 58, 76, "iron_d")
        c.v(58, 71, 76, "iron_d")
    else:
        chain(c, [(39, 47), (40, 49), (41, 51)])
        c.ps([(42, 53), (43, 53)], "iron_l")
        chain(c, [(44, 76), (47, 76), (50, 75)])
        c.r(53, 72, 58, 76, "iron_l")
        c.clear(54, 73, 57, 75)
        c.clear(53, 72, 54, 73)
        c.v(58, 72, 76, "iron_d")
        c.ps([(44, 72), (45, 71)], "dawn_l")
        sparkle(c, 47, 66)


def draw_release_gate(c: Cell, state: str) -> None:
    c.r(14, 19, 50, 74, "ink")
    if state == "open":
        c.r(17, 24, 47, 74, "ink2")
        c.poly([(18, 74), (46, 74), (40, 66), (24, 66)], "stone_d")
        c.ps([(28, 72), (34, 71), (40, 73)], "dawn")
        c.poly([(1, 20), (9, 17), (9, 77), (1, 74)], "cedar_m")
        for x in (3, 5, 7):
            c.v(x, 19, 75, "cedar_d")
        for y in (26, 46, 66):
            c.line([(1, y), (9, y - 2)], "cedar")
        c.ps([(22, 75), (23, 75), (24, 76), (25, 76)], "lacq")
        c.ps([(36, 76), (37, 76), (38, 75)], "lacq_l")
        c.r(42, 44, 45, 47, "iron_d")
        c.r(42, 48, 45, 52, "bronze")
        c.ps([(43, 41), (44, 42), (45, 43), (42, 42)], "iron_l")
    else:
        for x in range(16, 50, 4):
            c.r(x, 19, x + 1, 74, "cedar_m")
            c.v(x + 1, 19, 74, "cedar_d")
        for y in (24, 44, 64):
            c.r(14, y, 50, y + 1, "cedar")
            c.h(14, 50, y, "cedar_l")
        c.r(41, 40, 47, 50, "iron_d")
        c.r(42, 41, 46, 49, "iron")
        c.r(42, 46, 46, 52, "bronze")
        c.p(44, 49, "ink")
        c.r(37, 34, 39, 57, "lacq")
        c.v(37, 34, 57, "lacq_l")
        c.ps([(38, 58), (37, 59)], "lacq")
        if state == "ready":
            c.r(42, 46, 46, 52, "dawn_l")
            c.p(44, 49, "dawn")
            halo(c, 44, 48, 7, "dawn")
            c.v(39, 34, 57, "dawn")
    post(c, 9, 13, 19, 77)
    post(c, 51, 55, 19, 77)
    c.r(7, 14, 57, 18, "cedar_d")
    c.h(7, 57, 14, "cedar_m")
    c.r(7, 75, 57, 77, "stone_d")
    c.h(7, 57, 75, "stone")


def draw_lantern_relay(c: Cell, state: str) -> None:
    c.r(22, 73, 41, 77, "iron_d")
    c.h(22, 41, 73, "iron_l")
    c.r(26, 69, 37, 72, "iron")
    c.h(26, 37, 69, "iron_l")
    c.r(30, 32, 33, 68, "iron")
    c.v(30, 32, 68, "iron_l")
    c.v(33, 32, 68, "iron_d")
    c.line([(25, 32), (30, 38)], "iron")
    c.line([(38, 32), (33, 38)], "iron")
    c.r(23, 13, 40, 31, "iron_d")
    windows = {"dark": ("ink2", "rain"), "charging": ("flame_d", "flame"), "lit": ("flame", "flame_l")}[state]
    for x0 in (25, 34):
        c.r(x0, 15, x0 + 4, 29, windows[0])
        c.r(x0 + 1, 16, x0 + 3, 28, windows[1])
        if state == "charging":
            c.r(x0, 15, x0 + 4, 21, "ink2")
            c.h(x0 + 1, x0 + 3, 22, "flame")
        c.v(x0 + 2, 15, 29, "iron_d")
        c.h(x0, x0 + 4, 22, "iron_d")
    if state == "lit":
        c.r(26, 23, 28, 28, "paper_l")
        c.r(35, 23, 37, 28, "paper_l")
        halo(c, 31, 22, 14, "flame")
        halo(c, 31, 22, 18, "flame_d")
    if state == "dark":
        c.ps([(26, 17), (35, 17)], "rain2")
    c.r(21, 31, 42, 32, "iron")
    c.h(21, 42, 31, "iron_l")
    c.poly([(20, 13), (43, 13), (36, 6), (27, 6)], "iron_d")
    c.h(20, 43, 13, "iron")
    c.h(27, 36, 6, "iron_l")
    c.line([(21, 12), (27, 7)], "iron_l")
    c.r(31, 2, 32, 5, "iron_l")
    if state == "charging":
        c.ps([(27, 4), (37, 2), (24, 8), (40, 6), (34, 1)], "flame")
        c.ps([(22, 72), (41, 72), (31, 71)], "dawn")


def draw_net_post(c: Cell, state: str) -> None:
    c.r(8, 74, 30, 77, "straw_d")
    c.h(9, 29, 74, "rope")
    c.ps([(12, 75), (17, 76), (22, 75), (27, 76)], "rope")
    for start, end in (((29, 34), (10, 76)), ((29, 42), (15, 76)), ((29, 52), (21, 76)), ((29, 62), (26, 76))):
        c.line([start, end], "rope")
    for start, end in (((14, 48), (29, 70)), ((19, 40), (29, 56)), ((11, 60), (24, 76)), ((24, 37), (29, 44))):
        c.line([start, end], "straw_d")
    for x, y in ((14, 58), (19, 49), (22, 66), (25, 41)):
        c.r(x, y, x + 2, y + 1, "bronze")
        c.p(x, y, "bronze_l")
    post(c, 30, 35, 28, 77)
    c.r(29, 25, 36, 28, "cedar_d")
    c.h(30, 35, 25, "cedar_m")
    for y in (35, 37):
        c.h(29, 36, y, "rope")
    c.p(36, 36, "straw_d")
    if state == "fogged":
        wisp(c, 3, 50, 40)
        wisp(c, 14, 59, 44)
        wisp(c, 2, 68, 36)
        wisp(c, 34, 44, 24, False)
        c.ps([(41, 53), (12, 63)], "violet_l")
        c.p(42, 54, "violet")
    elif state == "clearing":
        wisp(c, 6, 60, 18)
        wisp(c, 40, 66, 16, False)
        for x, y in ((12, 46), (44, 50), (20, 38), (48, 40)):
            sparkle(c, x, y)
    else:
        c.h(36, 41, 33, "cedar_d")
        chochin(c, 41, 34, 2)
        c.h(4, 26, 77, "dawn")


def draw_seal_dais(c: Cell, state: str) -> None:
    c.r(10, 70, 53, 77, "stone")
    c.h(10, 53, 70, "stone_l")
    c.h(10, 53, 77, "stone_d")
    c.v(53, 70, 77, "stone_d")
    c.r(16, 63, 47, 69, "stone")
    c.h(16, 47, 63, "stone_l")
    c.v(47, 63, 69, "stone_d")
    groove = {"dormant": "stone_d", "active": "red_glow", "broken": "stone_d"}[state]
    socket = {"dormant": "ink2", "active": "court", "broken": "ink"}[state]
    c.poly([(26, 65), (31, 63), (38, 65), (35, 68), (28, 68)], socket)
    c.line([(14, 73), (22, 73), (25, 75)], groove)
    c.line([(49, 73), (41, 73), (38, 75)], groove)
    c.line([(29, 74), (34, 74)], groove)
    c.line([(18, 66), (23, 66)], groove)
    c.line([(40, 66), (45, 66)], groove)
    if state == "active":
        c.ps([(31, 65), (32, 66), (33, 65)], "red_glow")
        for (x, y) in ((22, 50), (40, 46), (31, 40)):
            c.poly([(x, y), (x + 3, y + 2), (x + 1, y + 6), (x - 2, y + 3)], "lacq")
            c.p(x, y + 1, "red_glow")
            c.p(x + 1, y + 3, "lacq_l")
        c.ps([(18, 58), (46, 56), (27, 54), (36, 52), (15, 64), (49, 61)], "court")
        c.ps([(24, 60), (39, 59)], "red_glow")
    if state == "broken":
        c.line([(30, 63), (28, 66), (31, 69), (29, 72), (32, 77)], "ink")
        c.line([(36, 70), (38, 73), (37, 77)], "ink")
        c.clear(46, 63, 47, 65)
        c.clear(51, 70, 53, 72)
        stone_block(c, 54, 74, 57, 77)
        stone_block(c, 6, 75, 8, 77)
        c.ps([(44, 62), (45, 62), (12, 69)], "stone_l")


def bell_rows(top: int):
    """Half-width profile of the invented harbor fog bell (no inscriptions)."""
    profile = [2, 4, 6, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9, 9, 10, 10, 10, 10, 10, 11, 11, 11, 12, 13, 13]
    return [(top + i, w) for i, w in enumerate(profile)]


def paint_bell(c: Cell, cx: int, top: int, lean: int = 0, clapper: bool = True) -> None:
    c.r(cx - 1, top - 3, cx + 1, top - 1, "bronze_d")
    c.p(cx, top - 2, "ink")
    for index, (y, w) in enumerate(bell_rows(top)):
        shift = (lean * index) // 24
        x0, x1 = cx - w + shift, cx + w + shift
        c.h(x0, x1, y, "bronze")
        c.h(x0, x0 + max(1, w // 4), y, "bronze_l")
        c.h(x1 - max(1, w // 3), x1, y, "bronze_d")
        if index in (6, 15):
            c.h(x0, x1, y, "bronze_d")
    last_y, last_w = bell_rows(top)[-1]
    shift = lean
    c.h(cx - last_w + 2 + shift, cx + last_w - 2 + shift, last_y, "ink2")
    if clapper:
        c.r(cx + shift, last_y + 1, cx + 1 + shift, last_y + 3, "iron")


def draw_fog_bell(c: Cell, state: str) -> None:
    stone_block(c, 6, 73, 15, 77)
    stone_block(c, 48, 73, 57, 77)
    post(c, 9, 12, 16, 72)
    post(c, 51, 54, 16, 72)
    c.line([(13, 60), (19, 72)], "cedar_m")
    c.line([(50, 60), (44, 72)], "cedar_m")
    c.r(4, 12, 59, 16, "cedar")
    c.h(4, 59, 12, "cedar_l")
    c.h(4, 59, 16, "cedar_d")
    c.ps([(3, 11), (60, 11)], "cedar_l")
    if state == "ringing":
        c.v(32, 17, 22, "rope")
        paint_bell(c, 31, 25, 3)
        for x, y in ((18, 30), (17, 33), (17, 36), (18, 39), (15, 28), (14, 33), (14, 38), (15, 43)):
            c.p(x, y, "fog_l")
        for x, y in ((47, 31), (48, 34), (48, 37), (47, 40), (50, 29), (51, 34), (51, 39), (50, 44)):
            c.p(x, y, "fog_l")
        wisp(c, 17, 70, 26, False)
    else:
        c.v(32, 17, 20, "rope")
        c.ps([(31, 21), (33, 22), (32, 22)], "rope")
        paint_bell(c, 31, 53, -2, clapper=False)
        c.line([(33, 55), (35, 60), (33, 65), (36, 71), (35, 76)], "ink")
        c.line([(35, 60), (39, 62)], "ink")
        c.clear(41, 73, 44, 77)
        c.ps([(41, 72), (42, 72)], "bronze_d")
        c.poly([(46, 77), (49, 74), (51, 77)], "bronze_d")
        c.p(48, 75, "bronze")
        c.h(16, 47, 77, "ink2")


def draw_slip_box(c: Cell, state: str) -> None:
    c.r(21, 70, 22, 77, "cedar_d")
    c.r(41, 70, 42, 77, "cedar_d")
    contact(c, 19, 44)
    if state == "full":
        slips = ((22, 50), (25, 47), (28, 51), (31, 46), (34, 49), (37, 48), (40, 52))
        for index, (x, y) in enumerate(slips):
            c.r(x, y, x + 1, 57, "paper_l" if index % 2 else "paper")
            c.p(x + 1, y, "paper_s")
        c.ps([(26, 45), (32, 44)], "paper")
    c.r(19, 58, 44, 69, "cedar_m")
    c.h(19, 44, 58, "cedar_l")
    c.h(19, 44, 69, "cedar_d")
    c.v(44, 58, 69, "cedar_d")
    c.r(22, 61, 41, 66, "cedar")
    c.h(19, 44, 63, "rope")
    c.p(31, 63, "straw")
    if state == "empty":
        c.poly([(45, 55), (48, 55), (49, 76), (46, 76)], "cedar_m")
        c.line([(45, 55), (46, 76)], "cedar_l")
        c.line([(48, 55), (49, 76)], "cedar_d")
        c.r(20, 58, 43, 59, "cedar_d")


def draw_water_trough(c: Cell, state: str) -> None:
    c.v(19, 47, 77, "cedar_d")
    c.ps([(18, 47), (20, 47), (17, 46), (21, 46)], "cedar_d")
    for i in range(18):
        x = 14 + i
        y = 44 + i * 6 // 17
        c.p(x, y, "moss_l")
        c.p(x, y + 1, "moss")
        c.p(x, y + 2, "ink2" if i % 6 == 5 else "moss")
    for i in range(3):
        c.v(15 + i * 6, 44 + i * 2, 47 + i * 2, "moss_l")
    for y in range(53, 63):
        c.p(31 + (y % 2), y, "water_l" if y % 3 else "water")
    c.r(17, 63, 48, 74, "cedar_m")
    c.h(17, 48, 63, "cedar_l")
    c.r(19, 64, 46, 66, "water")
    c.h(19, 46, 64, "water_l")
    c.ps([(23, 65), (33, 65), (41, 65)], "water_l")
    for x in (25, 33, 41):
        c.v(x, 67, 74, "cedar_d")
    c.h(17, 48, 74, "cedar_d")
    c.r(19, 75, 20, 77, "cedar_d")
    c.r(45, 75, 46, 77, "cedar_d")
    c.ps([(49, 66), (50, 68), (50, 71), (51, 74)], "water_l")
    c.h(48, 53, 77, "water_d")
    if state == "released":
        c.poly([(34, 62), (41, 61), (42, 63), (35, 64)], "paper_l")
        c.h(35, 41, 63, "paper_s")
        c.ps([(31, 59), (44, 58), (38, 56), (46, 61)], "dawn_l")
        c.h(21, 24, 65, "dawn")
        c.h(43, 45, 65, "dawn")
        sparkle(c, 38, 52)


def draw_release_mark(c: Cell, state: str) -> None:
    lit = state == "complete"
    pebble, top = ("dawn", "dawn_l") if lit else ("stone", "stone_l")
    c.draw.ellipse((8, 71, 55, 77), outline=COLORS["dawn" if lit else "stone_d"])
    ring = ((10, 75), (14, 73), (20, 72), (27, 71), (36, 71), (43, 72), (49, 73), (53, 75),
            (49, 77), (42, 77), (32, 77), (22, 77), (14, 77))
    for x, y in ring:
        c.r(x, max(71, y - 1), x + 2, y, pebble)
        c.h(x, x + 1, max(71, y - 1), top)
    c.r(31, 56, 32, 76, "cedar")
    c.p(31, 56, "cedar_l")
    c.p(32, 76, "cedar_d")
    if lit:
        streamer = [(33, 57), (34, 56), (35, 55), (36, 55), (37, 54), (38, 53), (39, 53), (40, 52), (41, 51), (42, 51)]
        for x, y in streamer:
            c.r(x, y, x, y + 1, "paper_l")
        for x, y in ((36, 46), (44, 44), (28, 48), (40, 38)):
            sparkle(c, x, y)
        c.ps([(24, 66), (39, 64), (31, 61)], "dawn")
    else:
        streamer = [(33, 57), (34, 58), (34, 59), (35, 60), (35, 61), (36, 62), (36, 63), (35, 64), (35, 65)]
        for x, y in streamer:
            c.r(x, y, x + 1, y, "paper")
        c.p(36, 65, "paper_s")


def draw_orders_lectern(c: Cell, state: str) -> None:
    c.line([(22, 77), (40, 53)], "lacq_d")
    c.line([(23, 77), (41, 53)], "lacq")
    c.line([(41, 77), (23, 53)], "lacq_d")
    c.line([(42, 77), (24, 53)], "lacq_d")
    c.h(21, 24, 77, "ink")
    c.h(40, 43, 77, "ink")
    c.poly([(17, 51), (46, 44), (47, 47), (18, 54)], "lacq_d")
    c.line([(17, 51), (46, 44)], "lacq_l")
    if state == "disabled":
        c.poly([(22, 48), (40, 44), (41, 47), (23, 51)], "cedar_d")
        c.line([(22, 48), (40, 44)], "paper_s")
        c.line([(23, 50), (40, 46)], "lacq_d")
        for x0 in (12, 47):
            c.h(x0, x0 + 6, 77, "court")
            c.p(x0 + 3, 76, "court_d")
        return
    c.poly([(20, 47), (31, 44), (31, 49), (20, 52)], "paper")
    c.poly([(32, 44), (43, 41), (43, 46), (32, 49)], "paper_l")
    c.line([(31, 44), (31, 49)], "paper_s")
    for i in (0, 2):
        c.line([(22, 48 + i), (29, 46 + i)], "paper_s")
        c.line([(33, 45 + i), (41, 43 + i)], "paper_s")
    c.r(41, 38, 44, 41, "lacq_l")
    c.p(42, 38, "red_glow")
    if state == "active":
        for x0, y0 in ((10, 20), (49, 16)):
            c.r(x0, y0, x0 + 3, y0 + 16, "court")
            c.v(x0, y0, y0 + 16, "lacq_l")
            c.h(x0, x0 + 3, y0 + 16, "court_d")
        c.ps([(15, 26), (48, 22), (12, 39), (52, 35), (31, 36), (26, 40), (37, 39)], "red_glow")
    else:
        for x0, y0 in ((10, 22), (49, 18)):
            c.r(x0, y0, x0 + 3, y0 + 6, "court")
            c.v(x0, y0, y0 + 6, "lacq_l")
            c.r(x0 + 1, y0 + 9, x0 + 4, y0 + 15, "court")
            c.v(x0 + 1, y0 + 9, y0 + 15, "lacq_l")
        for x, y in ((16, 30), (46, 26), (30, 36), (24, 33)):
            sparkle(c, x, y)


def draw_testimony_table(c: Cell, state: str) -> None:
    c.r(8, 58, 55, 60, "cedar_l")
    c.h(8, 55, 58, "wood_hi")
    c.h(8, 55, 60, "cedar")
    c.r(10, 61, 53, 63, "cedar")
    c.h(10, 53, 63, "cedar_d")
    for x in (10, 51):
        c.r(x, 64, x + 2, 77, "cedar_m")
        c.v(x + 2, 64, 77, "cedar_d")
    contact(c, 8, 55)
    c.r(33, 56, 37, 57, "stone")
    c.h(33, 37, 56, "stone_l")
    c.p(35, 57, "ink")
    if state == "pending":
        c.r(13, 56, 20, 57, "paper_l")
        c.r(23, 56, 29, 57, "paper")
        c.poly([(43, 57), (49, 57), (50, 61), (44, 61)], "paper")
        c.h(44, 49, 61, "paper_s")
        c.r(48, 50, 49, 57, "paper_l")
        c.p(48, 49, "ink")
        c.line([(38, 55), (42, 53)], "cedar_d")
        c.p(38, 55, "ink")
    else:
        for i, color in enumerate(("paper_s", "paper", "paper_l", "paper", "paper_l")):
            c.h(14 + (i % 2), 27 + (i % 2), 57 - i, color)
        c.v(21, 52, 57, "dawn")
        c.r(47, 50, 48, 57, "paper_l")
        c.ps([(47, 48), (48, 49), (47, 49)], "flame")
        c.p(47, 47, "flame_l")
        halo(c, 47, 48, 5, "flame")
        c.line([(38, 55), (42, 55)], "cedar_d")


def draw_corrections_shelf(c: Cell, state: str) -> None:
    c.r(17, 27, 46, 76, "cedar_d")
    c.r(14, 26, 16, 77, "cedar")
    c.v(14, 26, 77, "cedar_l")
    c.r(47, 26, 49, 77, "cedar")
    c.v(49, 26, 77, "cedar_d")
    c.r(12, 23, 51, 25, "cedar_m")
    c.h(12, 51, 23, "cedar_l")
    for y in (39, 53, 67):
        c.r(17, y, 46, y + 1, "cedar_m")
        c.h(17, 46, y, "cedar_l")
    contact(c, 12, 51)

    def scrolls(x0: int, y_bottom: int, count: int) -> None:
        for i in range(count):
            x = x0 + (i % 3) * 4
            y = y_bottom - 3 - (i // 3) * 4
            c.r(x, y, x + 2, y + 2, "paper")
            c.p(x + 1, y + 1, "cedar_d")
            c.p(x, y, "paper_l")

    def stack(x0: int, x1: int, y_bottom: int, layers: int) -> None:
        for i in range(layers):
            c.h(x0, x1, y_bottom - i, "paper_l" if i % 2 else "paper")
        c.h(x0, x1, y_bottom - layers, "paper_s")

    scrolls(18, 38, 6)
    stack(32, 45, 38, 7)
    stack(18, 26, 52, 5)
    scrolls(38, 52, 6)
    scrolls(18, 66, 9)
    stack(32, 45, 66, 9)
    c.r(19, 70, 44, 75, "cedar")
    c.h(19, 44, 70, "cedar_l")
    c.p(31, 72, "bronze_l")
    if state == "pending":
        c.ps([(29, 52), (33, 52)], "cedar")
        c.poly([(51, 75), (57, 74), (58, 76), (52, 77)], "paper")
        c.h(52, 57, 76, "paper_s")
    else:
        stack(28, 36, 52, 6)
        c.v(32, 46, 52, "dawn")
        c.p(32, 45, "dawn_l")
        sparkle(c, 38, 44)


def draw_record_chest(c: Cell, state: str) -> None:
    contact(c, 11, 52)
    c.r(12, 60, 51, 76, "cedar_m")
    c.h(12, 51, 60, "cedar_l")
    c.v(51, 60, 76, "cedar_d")
    c.h(12, 51, 76, "cedar_d")
    for x in range(16, 50, 6):
        c.v(x, 61, 75, "cedar")
    for x0 in (12, 48):
        c.r(x0, 60, x0 + 3, 63, "iron")
        c.r(x0, 73, x0 + 3, 76, "iron")
    c.p(12, 60, "iron_l")
    c.p(48, 60, "iron_l")
    if state == "pending":
        c.r(11, 54, 52, 59, "cedar")
        c.h(11, 52, 54, "cedar_l")
        c.h(11, 52, 59, "cedar_d")
        c.r(29, 57, 34, 63, "bronze")
        c.p(31, 60, "ink")
        c.p(29, 57, "bronze_l")
    else:
        c.poly([(12, 54), (51, 54), (48, 44), (15, 44)], "cedar")
        c.line([(15, 44), (48, 44)], "cedar_l")
        c.h(12, 51, 54, "cedar_d")
        c.r(13, 55, 50, 59, "cedar_d")
        for x0 in (15, 24, 39):
            c.r(x0, 55, x0 + 7, 58, "paper_l")
            c.h(x0, x0 + 7, 58, "paper_s")
            c.v(x0 + 3, 55, 58, "dawn")
        c.r(33, 50, 36, 58, "paper")
        c.h(33, 36, 50, "paper_l")
        sparkle(c, 44, 48)


def draw_tower_lantern(c: Cell, state: str) -> None:
    c.r(24, 72, 39, 77, "cedar_d")
    c.h(24, 39, 72, "cedar_m")
    c.r(22, 76, 41, 77, "cedar_d")
    c.r(30, 32, 33, 71, "cedar")
    c.v(30, 32, 71, "cedar_l")
    c.v(33, 32, 71, "cedar_d")
    c.r(22, 12, 41, 31, "cedar_d")
    paper, glow = ("flame_l", "paper_l") if state == "lit" else ("paper_s", "paper")
    c.r(24, 14, 39, 29, paper)
    c.r(26, 16, 29, 27, glow)
    c.v(31, 14, 29, "cedar_d")
    c.h(24, 39, 21, "cedar_d")
    c.poly([(19, 12), (44, 12), (38, 6), (25, 6)], "cedar_d")
    c.h(25, 38, 6, "cedar_m")
    c.line([(20, 11), (25, 7)], "cedar_m")
    c.r(31, 3, 32, 5, "cedar_m")
    c.r(20, 31, 43, 32, "cedar_m")
    if state == "lit":
        halo(c, 31, 21, 14, "flame")
        halo(c, 31, 21, 18, "flame_d")


def draw_shelter_crates(c: Cell, _state: str) -> None:
    contact(c, 7, 55)

    def crate(x0: int, y0: int, x1: int, y1: int) -> None:
        c.r(x0, y0, x1, y1, "cedar_m")
        c.h(x0, x1, y0, "cedar_l")
        c.v(x0, y0, y1, "cedar_l")
        c.v(x1, y0, y1, "cedar_d")
        c.h(x0, x1, y1, "cedar_d")
        c.line([(x0 + 1, y1 - 1), (x1 - 1, y0 + 1)], "cedar_d")
        c.r(x0, y0, x0 + 1, y1, "cedar")
        c.r(x1 - 1, y0, x1, y1, "cedar_d")

    crate(8, 56, 29, 76)
    crate(12, 42, 27, 55)
    c.r(31, 62, 55, 76, "straw")
    c.h(31, 55, 62, "fog_l")
    c.h(31, 55, 76, "straw_d")
    for x in range(33, 55, 3):
        c.v(x, 64, 74, "straw_d")
    for x in (37, 49):
        c.v(x, 62, 76, "rope")
    c.r(16, 36, 22, 41, "ochre")
    c.h(16, 22, 36, "ochre_l")
    c.ps([(18, 35), (19, 34), (20, 35)], "ochre_l")


# ---------------------------------------------------------------------------
# Protected and attackable entities
# ---------------------------------------------------------------------------

def draw_courier(c: Cell, state: str) -> None:
    v = CIVILIANS["courier"]
    if state == "down":
        civ_down(c, v)
        return
    top, top_l, top_d, skin, lower = v["top"], v["top_l"], v["top_d"], v["skin"], v["lower"]
    lean = -1 if state == "hurt" else 0
    contact(c, 19, 43)
    c.ellipse((18 + lean, 51, 29 + lean, 64), "straw_d")
    c.ellipse((19 + lean, 52, 28 + lean, 63), "straw")
    c.ps([(23 + lean, 57), (24 + lean, 58)], "straw_d")
    c.r(22, 71, 31, 76, lower)
    c.h(22, 31, 71, v["lower_l"])
    c.r(19, 75, 22, 77, "cedar_d")
    c.r(30, 65, 38, 69, lower)
    c.h(30, 38, 65, v["lower_l"])
    c.r(36, 69, 38, 76, v["skin_d"])
    c.r(36, 76, 41, 77, "cedar_d")
    c.r(25, 63, 32, 71, lower)
    tx = 28 + lean
    c.r(tx, 52, tx + 9, 64, top)
    c.h(tx + 1, tx + 8, 51, top)
    c.v(tx + 9, 53, 64, top_l)
    c.v(tx, 53, 64, top_d)
    c.ps([(tx + 7, 51), (tx + 6, 52), (tx + 7, 52), (tx + 5, 53), (tx + 6, 53)], "cloth_w")
    c.r(tx, 61, tx + 9, 62, v["sash"])
    c.h(tx, tx + 9, 61, v["sash_l"])
    c.r(tx + 4, 49, tx + 6, 50, v["skin_d"])
    civ_head(c, v, tx + 1, 41, eyes_closed=state == "hurt")
    bx = tx + 7
    by = 54 if state == "safe" else 57
    c.r(bx, by, bx + 8, by + 8, "ochre")
    c.h(bx, bx + 8, by, "ochre_l")
    c.v(bx, by, by + 8, "ochre_l")
    c.v(bx + 8, by, by + 8, "bronze_d")
    c.ps([(bx + 3, by - 1), (bx + 4, by - 2), (bx + 5, by - 1)], "ochre_l")
    c.p(bx + 4, by - 1, "bronze_d")
    c.p(bx + 2, by + 1, "paper_l")
    c.r(bx - 3, by + 3, bx + 2, by + 5, top_l)
    c.r(bx + 3, by + 3, bx + 4, by + 5, skin)
    if state == "hurt":
        for x, y in ((47, 47), (51, 43), (44, 41)):
            c.r(x, y, x + 2, y + 1, "paper_l")
            c.p(x + 2, y + 1, "paper_s")


def print_block_face(c: Cell, x0: int, y0: int, x1: int, y1: int) -> None:
    c.r(x0, y0, x1, y1, "wood_hi")
    c.h(x0, x1, y0, "paper")
    c.v(x1, y0, y1, "cedar_l")
    c.h(x0, x1, y1, "cedar_l")
    for row, y in enumerate(range(y0 + 2, y1 - 1, 3)):
        for x in range(x0 + 2 + (row % 2), x1 - 1, 4):
            c.r(x, y, x + 1, y, "cedar_d")
    c.line([(x0 + 2, y1 - 2), (x0 + 6, y1 - 4), (x0 + 10, y1 - 2)], "cedar")


def draw_print_block(c: Cell, state: str) -> None:
    contact(c, 9, 54)
    if state == "destroyed":
        c.poly([(8, 74), (36, 70), (37, 72), (9, 76)], "cedar")
        c.line([(8, 74), (36, 70)], "cedar_l")
        c.line([(44, 77), (50, 66)], "cedar_m")
        c.line([(14, 77), (11, 70)], "cedar_m")
        half = Cell()
        print_block_face(half, 16, 46, 28, 57)
        piece_a = half.image.crop((16, 46, 29, 58)).rotate(90, expand=True)
        c.paste(piece_a, 16, 63)
        half_b = Cell()
        print_block_face(half_b, 29, 46, 42, 57)
        c.paste(half_b.image.crop((29, 46, 43, 58)), 33, 66)
        c.line([(33, 66), (35, 70), (34, 74)], "ink")
        for x, y in ((6, 77), (52, 76), (56, 77), (40, 77)):
            c.r(x, y, x + 3, y, "paper_l")
        c.ps([(30, 75), (31, 76), (45, 74)], "cedar_l")
        return
    for x in (13, 46):
        c.line([(x, 77), (x + 3, 62)], "cedar_m")
        c.line([(x + 6, 77), (x + 3, 62)], "cedar_d")
    c.r(10, 58, 53, 61, "cedar")
    c.h(10, 53, 58, "cedar_l")
    c.h(10, 53, 61, "cedar_d")
    print_block_face(c, 15, 45, 41, 57)
    c.r(42, 47, 42, 57, "cedar")
    c.r(44, 53, 52, 57, "paper")
    c.h(44, 52, 53, "paper_l")
    c.h(44, 52, 55, "paper_l")
    c.h(45, 51, 57, "paper_s")
    c.r(47, 50, 51, 52, "straw_d")
    c.h(47, 51, 50, "straw")
    if state in ("damaged", "cracked"):
        c.clear(37, 45, 41, 48)
        c.ps([(37, 49), (38, 48), (39, 49), (40, 49)], "cedar_l")
        c.ps([(50, 76), (51, 77), (20, 77)], "cedar_l")
        c.poly([(48, 53), (52, 53), (52, 55), (50, 56)], "paper_s")
    if state == "cracked":
        c.line([(27, 45), (25, 49), (28, 52), (26, 57)], "ink")
        c.line([(26, 49), (22, 50)], "ink")
        c.line([(16, 66), (17, 70)], "ink")
        c.clear(15, 54, 17, 57)
        for x, y in ((4, 77), (56, 76)):
            c.r(x, y, x + 4, y, "paper_l")


def draw_archive_core(c: Cell, state: str) -> None:
    stone_block(c, 5, 71, 58, 77)
    if state == "destroyed":
        c.poly([(9, 70), (54, 70), (52, 56), (44, 60), (38, 52), (30, 58), (22, 50), (15, 57), (10, 54)], "lacq_d")
        c.line([(10, 54), (15, 57), (22, 50), (30, 58), (38, 52), (44, 60), (52, 56)], "ink")
        for x0 in (13, 27, 41):
            c.r(x0, 62, x0 + 8, 67, "ink2")
            c.h(x0, x0 + 8, 62, "lacq")
        c.poly([(2, 74), (12, 72), (13, 77), (3, 77)], "lacq_d")
        c.poly([(50, 76), (60, 72), (61, 75), (52, 77)], "lacq_d")
        for x, y in ((4, 70), (18, 69), (57, 69), (34, 69), (47, 68), (24, 76), (40, 76)):
            c.r(x, y, x + 3, y, "paper")
        c.ps([(28, 48), (40, 47)], "stone_l")
        return
    c.r(8, 16, 55, 70, "lacq_d")
    c.v(8, 16, 70, "lacq")
    c.v(9, 16, 70, "lacq")
    c.v(55, 16, 70, "ink")
    c.v(54, 16, 70, "ink2")
    seam = {"intact": "dawn", "damaged": "dawn", "critical": "ink2"}[state]
    for row in range(6):
        y = 19 + row * 8
        for col in range(4):
            x = 11 + col * 11
            c.r(x, y, x + 9, y + 6, "ink2")
            c.r(x + 1, y + 1, x + 8, y + 5, "lacq_d")
            c.h(x + 1, x + 8, y + 1, "lacq")
            c.r(x + 3, y + 3, x + 6, y + 3, "paper_s")
            c.p(x + 4, y + 5, "bronze_l")
        if row < 5:
            c.h(11, 52, y + 7, seam)
    if state == "damaged":
        for row in (3, 4):
            c.h(11, 52, 19 + row * 8 + 7, "ink2")
        c.r(34, 44, 44, 51, "lacq_d")
        c.h(34, 44, 44, "lacq")
        c.r(34, 51, 44, 52, "ink")
        c.ps([(37, 43), (38, 42), (41, 43)], "paper_l")
        c.line([(19, 16), (22, 26), (20, 34)], "ink")
        for x, y in ((44, 76), (12, 77)):
            c.r(x, y, x + 3, y, "paper_l")
    if state == "critical":
        c.ps([(14, 26), (36, 34), (47, 50), (25, 58)], "dawn")
        c.clear(33, 27, 43, 33)
        c.r(33, 27, 43, 33, "ink")
        c.poly([(34, 34), (44, 34), (46, 40), (36, 40)], "lacq_d")
        c.line([(34, 34), (44, 34)], "lacq")
        c.r(12, 51, 21, 57, "ink")
        c.line([(19, 16), (22, 26), (20, 34), (24, 44)], "ink")
        c.line([(48, 40), (45, 52), (49, 64)], "ink")
        for x, y in ((50, 26), (52, 31), (51, 44), (53, 58)):
            c.r(x, y, x + 1, y + 2, "court")
        c.p(52, 32, "court_d")
        for x, y in ((40, 42), (44, 46), (13, 60), (3, 76), (47, 76), (56, 74), (22, 76)):
            c.r(x, y, x + 3, y, "paper_l")
            c.p(x + 3, y, "paper_s")
    c.r(5, 11, 58, 15, "lacq")
    c.h(5, 58, 11, "lacq_l")
    c.h(5, 58, 15, "ink")
    c.h(7, 56, 13, "bronze_d")
    for x0 in (5, 54):
        c.r(x0, 11, x0 + 4, 15, "iron")
        c.r(x0 + 3, 66, x0 + 4, 70, "iron")
    c.r(18, 6, 45, 10, "paper")
    c.h(18, 45, 6, "paper_l")
    for x in range(19, 45, 4):
        c.p(x, 8, "paper_s")
    c.v(31, 5, 10, "dawn" if state != "critical" else "court")
    c.v(32, 5, 10, "dawn" if state != "critical" else "court")
    if state == "intact":
        for x, y in ((4, 30), (59, 38), (3, 52), (60, 22)):
            c.p(x, y, "dawn")


def node_shell(c: Cell, cx: int, top: int, core_dark: str, core: str, core_hi: str) -> None:
    pts = [(cx, top), (cx + 8, top + 6), (cx + 9, top + 20), (cx + 4, top + 30),
           (cx - 4, top + 30), (cx - 9, top + 20), (cx - 8, top + 6)]
    c.poly(pts, "iron_d")
    c.poly([(cx, top + 1), (cx - 7, top + 6), (cx - 8, top + 20), (cx - 1, top + 22)], "iron")
    c.line([(cx, top + 1), (cx - 7, top + 6)], "iron_l")
    c.line([(cx - 7, top + 6), (cx - 8, top + 19)], "iron_l")
    c.line([(cx - 3, top + 29), (cx + 3, top + 29)], "iron")
    c.poly([(cx, top + 8), (cx + 4, top + 15), (cx, top + 24), (cx - 4, top + 15)], core_dark)
    c.poly([(cx, top + 10), (cx + 2, top + 15), (cx, top + 21), (cx - 2, top + 15)], core)
    c.v(cx, top + 12, top + 17, core_hi)


def node_plates(c: Cell, cx: int, cy: int, spread: int, color: str, edge: str) -> None:
    for (dx, dy, w, h) in ((-spread - 3, -3, 3, 6), (spread, -3, 3, 6), (-2, -spread - 9, 5, 3), (-2, spread + 6, 5, 3)):
        x, y = cx + dx, cy + dy
        c.r(x, y, x + w - 1, y + h - 1, color)
        c.p(x, y, edge)


def draw_bell_node(c: Cell, state: str) -> None:
    cx, top = 32, 22
    if state == "broken":
        for pts, color in (
            ([(18, 77), (24, 71), (27, 77)], "iron"),
            ([(28, 77), (31, 68), (36, 70), (34, 77)], "iron_d"),
            ([(38, 77), (42, 72), (46, 77)], "iron"),
            ([(12, 77), (15, 74), (17, 77)], "iron_d"),
            ([(48, 77), (50, 75), (53, 77)], "iron"),
        ):
            c.poly(pts, color)
        c.line([(24, 71), (26, 76)], "iron_l")
        c.line([(31, 68), (33, 73)], "iron_l")
        c.ps([(32, 72), (33, 74)], "violet_d")
        for y in range(44, 66, 1):
            c.p(31 + ((y // 4) % 3) - 1, y, "dawn" if y % 3 else "dawn_l")
        sparkle(c, 30, 40)
        return
    if state == "dormant":
        node_shell(c, cx, top, "ink2", "violet_d", "violet_d")
        node_plates(c, cx, top + 15, 9, "iron", "iron_l")
        c.h(27, 37, 77, "ink2")
        return
    charging = state == "charging"
    core_hi = "fog_l" if charging else "violet_l"
    node_shell(c, cx, top, "violet_d", "violet_l" if charging else "violet", core_hi)
    node_plates(c, cx, top + 15, 14 if charging else 11, "iron_l", "violet_l")
    for y in range(top + 33, 70, 2):
        c.p(cx, y, "violet_d")
    c.h(26, 38, 76, "violet_d")
    c.h(29, 35, 75, "violet")
    if charging:
        halo(c, cx, top + 15, 20, "violet_l")
        halo(c, cx, top + 15, 24, "dawn_l")
        c.ps([(cx - 1, top + 14), (cx + 1, top + 14)], "fog_l")
    else:
        c.ps([(19, 28), (46, 24), (44, 50), (20, 48)], "violet_l")


# ---------------------------------------------------------------------------
# Civilian tokens (non-combatant silhouettes)
# ---------------------------------------------------------------------------

CIVILIANS = {
    "civilian-a": {"skin": "skin_a", "skin_d": "skin_a_d", "hair": "hair", "top": "indigo", "top_l": "indigo_l",
                    "top_d": "ink2", "sash": "plum", "sash_l": "plum_l", "lower": "indigo", "lower_l": "indigo_l",
                    "style": "robe", "head": "scarf"},
    "civilian-b": {"skin": "skin_b", "skin_d": "skin_b_d", "hair": "hair_g", "top": "ochre", "top_l": "ochre_l",
                    "top_d": "bronze_d", "sash": "cloth_w_d", "sash_l": "cloth_w", "lower": "indigo", "lower_l": "indigo_l",
                    "style": "trousers", "head": "topknot"},
    "civilian-c": {"skin": "skin_c", "skin_d": "skin_c_d", "hair": "hair", "top": "moss", "top_l": "moss_l",
                    "top_d": "ink2", "sash": "cedar", "sash_l": "cedar_l", "lower": "moss", "lower_l": "moss_l",
                    "style": "cape", "head": "band"},
    "courier": {"skin": "skin_b", "skin_d": "skin_b_d", "hair": "hair", "top": "indigo", "top_l": "indigo_l",
                 "top_d": "ink2", "sash": "cloth_w_d", "sash_l": "cloth_w", "lower": "indigo", "lower_l": "indigo_l",
                 "style": "courier", "head": "hachimaki"},
}


def civ_head(c: Cell, v: dict, x: int, y: int, bowed: bool = False, eyes_closed: bool = False) -> None:
    """8 x 9 head facing right; (x, y) is the top-left of the hair mass."""
    skin, skin_d, hair = v["skin"], v["skin_d"], v["hair"]
    c.spans([(y, x + 2, x + 5), (y + 1, x + 1, x + 6), (y + 2, x, x + 7)], hair)
    c.r(x + 3, y + 2, x + 7, y + 7, skin)
    c.r(x, y + 3, x + 2, y + 6, hair)
    c.p(x + 3, y + 5, skin_d)
    c.h(x + 4, x + 6, y + 8, skin)
    c.p(x + 3, y + 7, skin_d)
    c.p(x + 7, y + 7, skin_d)
    eye_y = y + 5 if bowed else y + 4
    if eyes_closed or bowed:
        c.h(x + 5, x + 6, eye_y, skin_d)
    else:
        c.p(x + 6, eye_y, "ink")
    if v["head"] == "scarf":
        c.spans([(y - 1, x + 2, x + 5), (y, x + 1, x + 6), (y + 1, x, x + 7), (y + 2, x, x + 4)], "cloth_w")
        c.h(x, x + 2, y + 2, "cloth_w_d")
        c.ps([(x - 1, y + 3), (x - 1, y + 4), (x - 2, y + 5)], "cloth_w_d")
    elif v["head"] == "topknot":
        c.r(x + 2, y - 2, x + 3, y - 1, hair)
        c.p(x + 4, y - 2, hair)
        c.h(x + 1, x + 6, y, "hair_g")
        c.p(x + 7, y + 6, skin_d)
    elif v["head"] == "hachimaki":
        c.h(x + 1, x + 7, y + 2, "cloth_w")
        c.ps([(x, y + 3), (x - 1, y + 3), (x - 2, y + 4)], "cloth_w_d")
        c.r(x + 3, y - 2, x + 4, y - 1, hair)
    else:
        c.h(x, x + 7, y + 2, "lacq")
        c.ps([(x - 1, y + 3), (x - 2, y + 4)], "lacq")


def civ_cape(c: Cell, top_y: int) -> None:
    """Straw rain cape: narrow at the neck, flaring to a ragged hem, basket behind."""
    c.r(22, top_y + 4, 26, top_y + 12, "straw_d")
    for y in range(top_y + 5, top_y + 12, 2):
        c.h(22, 26, y, "straw")
    c.h(23, 25, top_y + 3, "straw")
    for i in range(13):
        half = 3 + (i * 5) // 12
        c.h(32 - half - 1, 33 + half, top_y + i, "straw")
    for x in range(25, 42):
        if x % 2 == 0:
            bottom = top_y + 11 + (x * 5) % 4
            c.v(x, top_y + 3, bottom, "straw_d")
        else:
            c.p(x, top_y + 12 + (x * 3) % 3, "straw")
    c.h(29, 36, top_y, "straw_d")


def civ_standing(c: Cell, v: dict, state: str) -> None:
    walk = state == "walk"
    raised = state == "safe"
    bob = -1 if walk else 0
    top, top_l, top_d = v["top"], v["top_l"], v["top_d"]
    contact(c, 26, 39)
    if v["style"] == "trousers":
        if walk:
            c.poly([(30, 62), (34, 62), (29, 76), (26, 76)], v["lower"])
            c.poly([(33, 62), (36, 62), (39, 76), (35, 76)], v["lower_l"])
            c.r(24, 76, 28, 77, "cedar_d")
            c.r(35, 76, 40, 77, "cedar_d")
        else:
            c.r(29, 62, 31, 75, v["lower"])
            c.r(33, 62, 35, 75, v["lower_l"])
            c.r(28, 76, 31, 77, "cedar_d")
            c.r(33, 76, 37, 77, "cedar_d")
            c.v(32, 64, 75, "ink2")
    elif v["style"] == "cape":
        c.r(28, 58 + bob, 37, 66, v["lower"])
        c.h(28, 37, 66, v["top_d"])
        if walk:
            c.line([(30, 67), (27, 75)], v["skin_d"])
            c.line([(31, 67), (28, 75)], v["skin_d"])
            c.line([(34, 67), (37, 75)], v["skin_d"])
            c.line([(35, 67), (38, 75)], v["skin_d"])
            c.r(25, 76, 28, 77, "cedar_d")
            c.r(36, 76, 40, 77, "cedar_d")
        else:
            c.r(30, 67, 31, 75, v["skin_d"])
            c.r(34, 67, 35, 75, v["skin_d"])
            c.r(29, 76, 32, 77, "cedar_d")
            c.r(34, 76, 37, 77, "cedar_d")
            c.ps([(30, 70), (34, 70)], "cloth_w_d")
    else:
        if walk:
            c.poly([(28, 57), (37, 57), (39, 73), (34, 73), (32, 66), (30, 73), (26, 73)], v["lower"])
            c.line([(34, 58), (32, 66)], top_d)
            c.r(26, 74, 29, 75, v["skin_d"])
            c.r(35, 74, 38, 75, v["skin_d"])
            c.r(24, 76, 29, 77, "cedar_d")
            c.r(35, 76, 40, 77, "cedar_d")
        else:
            c.r(28, 57, 37, 73, v["lower"])
            c.r(27, 70, 38, 73, v["lower"])
            c.v(37, 58, 73, v["lower_l"])
            c.line([(35, 58), (31, 73)], top_d)
            c.r(30, 74, 31, 75, v["skin_d"])
            c.r(34, 74, 35, 75, v["skin_d"])
            c.r(29, 76, 32, 77, "cedar_d")
            c.r(33, 76, 37, 77, "cedar_d")
    body_bottom = 61 if v["style"] == "trousers" else 57
    c.r(28, 46 + bob, 37, body_bottom, top)
    c.h(29, 36, 45 + bob, top)
    c.v(37, 47 + bob, body_bottom, top_l)
    c.v(28, 47 + bob, body_bottom, top_d)
    c.ps([(35, 45 + bob), (34, 46 + bob), (35, 46 + bob), (33, 47 + bob), (34, 47 + bob)], "cloth_w")
    sash_y = 58 if v["style"] == "trousers" else 54
    c.r(28, sash_y, 37, sash_y + 2, v["sash"])
    c.h(28, 37, sash_y, v["sash_l"])
    c.r(26, 48 + bob, 28, 56 + bob, top_d)
    if v["style"] == "cape":
        civ_cape(c, 45 + bob)
    if walk:
        c.poly([(33, 48 + bob), (37, 48 + bob), (34, 57), (31, 57)], top_l)
        c.r(31, 57, 33, 58, v["skin"])
    elif v["style"] == "cape":
        c.r(36, 55, 38, 58, top_l)
        c.r(36, 59, 38, 60, v["skin"])
    else:
        c.r(34, 48, 38, 56, top_l)
        c.v(38, 48, 56, top)
        c.r(36, 57, 38, 58, v["skin"])
    c.r(32, 44 + bob, 34, 45 + bob, v["skin_d"])
    civ_head(c, v, 29, 36 + bob)
    if v["style"] == "robe":
        bx = 36 if not walk else 33
        by = 53 + bob
        c.r(bx, by, bx + 5, by + 5, "ochre")
        c.h(bx, bx + 5, by, "ochre_l")
        c.v(bx + 5, by, by + 5, "bronze_d")
        c.ps([(bx + 2, by - 1), (bx + 3, by - 1)], "ochre_l")
    if v["style"] == "trousers":
        tip = 41 if not walk else 42
        c.line([(38, 57), (tip, 77)], "cedar_m")
        c.line([(38, 52), (38, 56)], "cedar_m")
    if raised:
        sparkle(c, 33, 30)
        c.ps([(29, 32), (37, 31)], "dawn")
        c.h(21, 25, 77, "dawn")
        c.h(42, 46, 77, "dawn")
        c.ps([(23, 76), (44, 76)], "dawn_l")


def civ_bound(c: Cell, v: dict) -> None:
    top, top_l, top_d = v["top"], v["top_l"], v["top_d"]
    contact(c, 22, 42)
    c.r(24, 72, 40, 77, v["lower"])
    c.h(24, 40, 72, v["lower_l"])
    c.r(22, 75, 25, 77, "cedar_d")
    c.r(28, 66, 40, 72, v["lower"])
    c.h(29, 40, 66, v["lower_l"])
    c.r(27, 54, 36, 67, top)
    c.v(36, 55, 67, top_l)
    c.v(27, 55, 67, top_d)
    c.ps([(34, 54), (33, 55), (34, 55)], "cloth_w")
    c.r(27, 63, 36, 65, v["sash"])
    c.r(25, 56, 27, 64, top_d)
    if v["style"] == "cape":
        civ_cape(c, 53)
    c.poly([(33, 56), (37, 56), (39, 65), (35, 65)], top_l)
    c.r(37, 64, 40, 66, v["skin"])
    for x in (36, 38, 40):
        c.v(x, 64, 66, "rope")
    c.h(36, 41, 67, "rope")
    c.line([(41, 67), (46, 72), (52, 74)], "rope")
    c.r(31, 52, 33, 53, v["skin_d"])
    civ_head(c, v, 29, 44, bowed=True)


def civ_down(c: Cell, v: dict) -> None:
    """Incapacitated but non-gory: seated, knees drawn up, head bowed."""
    top, top_l, top_d = v["top"], v["top_l"], v["top_d"]
    contact(c, 20, 46)
    if v["style"] == "courier":
        c.ellipse((16, 57, 27, 69), "straw_d")
        c.ellipse((17, 58, 26, 68), "straw")
        c.p(21, 62, "straw_d")
    c.r(22, 71, 32, 76, v["lower"])
    c.h(22, 32, 71, v["lower_l"])
    c.poly([(27, 71), (36, 62), (41, 62), (41, 66), (33, 73)], v["lower"])
    c.line([(28, 70), (36, 62)], v["lower_l"])
    c.h(36, 41, 62, v["lower_l"])
    shin = v["skin_d"] if v["style"] in ("cape", "courier") else v["lower"]
    c.r(39, 66, 42, 75, shin)
    c.r(39, 76, 45, 77, "cedar_d")
    c.poly([(22, 71), (22, 60), (26, 55), (33, 55), (37, 61), (32, 71)], top)
    c.line([(22, 61), (22, 70)], top_d)
    c.line([(23, 59), (26, 56)], top_d)
    c.line([(27, 55), (33, 55)], top_l)
    c.r(23, 66, 31, 68, v["sash"])
    if v["style"] == "cape":
        c.poly([(21, 66), (21, 60), (25, 54), (34, 53), (37, 59), (30, 66)], "straw")
        for x in range(22, 36, 2):
            c.v(x, 57, 64 - (x % 3), "straw_d")
    c.poly([(31, 57), (35, 57), (41, 63), (38, 65)], top_l)
    c.r(39, 62, 42, 64, v["skin"])
    civ_head(c, v, 32, 50, bowed=True, eyes_closed=True)
    if v["style"] == "robe":
        c.r(10, 72, 16, 77, "ochre")
        c.h(10, 16, 72, "ochre_l")
        c.ps([(12, 71), (13, 71)], "ochre_l")
    elif v["style"] == "trousers":
        c.line([(4, 77), (19, 75)], "cedar_m")
    elif v["style"] == "cape":
        c.r(9, 70, 15, 77, "straw_d")
        for y in (71, 73, 75):
            c.h(9, 15, y, "straw")
    else:
        c.r(7, 70, 15, 77, "ochre")
        c.h(7, 15, 70, "ochre_l")
        c.ps([(10, 69), (11, 68), (12, 69)], "ochre_l")
        for x, y in ((2, 77), (48, 77), (53, 76), (57, 77)):
            c.r(x, y, x + 3, y, "paper_l")


def make_civilian(variant: str):
    v = CIVILIANS[variant]

    def draw(c: Cell, state: str) -> None:
        if state == "bound":
            civ_bound(c, v)
        elif state == "down":
            civ_down(c, v)
        else:
            civ_standing(c, v, state)

    return draw


DRAWERS = {
    "river-gate": draw_river_gate,
    "archive-door": draw_archive_door,
    "lantern-boat": draw_lantern_boat,
    "safe-shelter": draw_safe_shelter,
    "escape-arch": draw_escape_arch,
    "canal-lock": draw_canal_lock,
    "chain-post": draw_chain_post,
    "release-gate": draw_release_gate,
    "lantern-relay": draw_lantern_relay,
    "net-post": draw_net_post,
    "seal-dais": draw_seal_dais,
    "fog-bell": draw_fog_bell,
    "slip-box": draw_slip_box,
    "water-trough": draw_water_trough,
    "release-mark": draw_release_mark,
    "orders-lectern": draw_orders_lectern,
    "testimony-table": draw_testimony_table,
    "corrections-shelf": draw_corrections_shelf,
    "record-chest": draw_record_chest,
    "tower-lantern": draw_tower_lantern,
    "shelter-crates": draw_shelter_crates,
    "courier": draw_courier,
    "print-block": draw_print_block,
    "archive-core": draw_archive_core,
    "bell-node": draw_bell_node,
    "civilian-a": make_civilian("civilian-a"),
    "civilian-b": make_civilian("civilian-b"),
    "civilian-c": make_civilian("civilian-c"),
}


# ---------------------------------------------------------------------------
# Validation, export, and manifest
# ---------------------------------------------------------------------------

def validate_source() -> None:
    kinds = SOURCE["kinds"]
    if [kind["id"] for kind in kinds] != list(DRAWERS):
        raise ValueError("Source kind order must match the builder drawer order")
    if GEOMETRY["rows"] != len(kinds):
        raise ValueError("Geometry rows must equal the kind count")
    if max(len(kind["states"]) for kind in kinds) > GEOMETRY["columns"]:
        raise ValueError("A kind has more states than atlas columns")
    if GEOMETRY["sheetWidth"] != W * GEOMETRY["columns"] or GEOMETRY["sheetHeight"] != H * GEOMETRY["rows"]:
        raise ValueError("Sheet dimensions do not match the cell grid")
    forbidden = ("torii", "kamon", "crucifix", "rosary", "reliquary", "sutra", "shimenawa", "mandala", "coat of arms")
    for kind in kinds:
        text = kind["motif"].lower()
        if any(term in text for term in forbidden):
            raise ValueError(f"Restricted motif term in {kind['id']}")


def frame_record(image: Image.Image, kind: dict, state: str, row: int, column: int) -> dict:
    alpha = image.getchannel("A")
    values = set(alpha.getdata())
    if not values <= {0, 255}:
        raise ValueError(f"Partial alpha in {kind['id']}:{state}")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError(f"Empty frame {kind['id']}:{state}")
    left, top, right, bottom = bbox
    if left < GEOMETRY["minimumSideGutter"] or W - right < GEOMETRY["minimumSideGutter"]:
        raise ValueError(f"Side gutter violated in {kind['id']}:{state}: {bbox}")
    if top < GEOMETRY["minimumTopGutter"]:
        raise ValueError(f"Top gutter violated in {kind['id']}:{state}: {bbox}")
    if bottom - 1 > FOOT:
        raise ValueError(f"Pixels below the foot row in {kind['id']}:{state}: {bbox}")
    colors = {pixel for pixel in image.getdata() if pixel[3] == 255}
    unknown = colors - set(COLORS.values())
    if unknown:
        raise ValueError(f"Off-palette color in {kind['id']}:{state}: {sorted(unknown)[:3]}")
    opaque = sum(1 for value in alpha.getdata() if value)
    return {
        "id": f"{kind['id']}:{state}",
        "kind": kind["id"],
        "state": state,
        "row": row,
        "column": column,
        "rect": [column * W, row * H, W, H],
        "pivot": list(GEOMETRY["pivot"]),
        "alphaBounds": [left, top, right - left, bottom - top],
        "visualHeight": FOOT + 1 - top,
        "opaquePixelCount": opaque,
        "colorCount": len(colors),
        "rgbaSha256": hashlib.sha256(image.tobytes()).hexdigest(),
    }


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def ihdr(data: bytes) -> dict:
    width, height, bit_depth, color_type, _c, _f, interlace = struct.unpack(">IIBBBBB", data[16:29])
    return {"width": width, "height": height, "bitDepth": bit_depth, "colorType": color_type, "interlace": interlace}


def build_review_sheet(atlas: Image.Image) -> Image.Image:
    scale = 2
    cell_w, cell_h = W * scale, H * scale
    columns = GEOMETRY["columns"]
    group_w = 12 + columns * (cell_w + 6)
    groups = 2
    per_group = (len(SOURCE["kinds"]) + groups - 1) // groups
    row_h = cell_h + 26
    width = 16 + group_w * groups
    height = 34 + per_group * row_h
    sheet = Image.new("RGB", (width, height), (22, 35, 58))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((10, 10), "ACTION OBJECTIVE SUITE V1 - 2X NEAREST REVIEW SHEET (NOT RUNTIME) - FOOT ROW MARKED", fill=(215, 201, 154), font=font)
    for index, kind in enumerate(SOURCE["kinds"]):
        group, local = divmod(index, per_group)
        gx = 8 + group * group_w
        gy = 30 + local * row_h
        draw.text((gx + 4, gy + 2), f"{index:02d} {kind['id'].upper()} ({kind['role']})", fill=(246, 232, 185), font=font)
        for column, state in enumerate(kind["states"]):
            x = gx + 4 + column * (cell_w + 6)
            y = gy + 14
            draw.rectangle((x, y, x + cell_w - 1, y + cell_h - 1), fill=(11, 16, 32), outline=(39, 70, 107))
            draw.line((x, y + FOOT * scale + scale, x + cell_w - 1, y + FOOT * scale + scale), fill=(105, 81, 99))
            frame = atlas.crop((column * W, index * H, (column + 1) * W, (index + 1) * H))
            scaled = frame.resize((cell_w, cell_h), Image.Resampling.NEAREST)
            sheet.paste(scaled.convert("RGB"), (x, y), scaled.getchannel("A"))
            draw.text((x + 3, y + cell_h - 12), state.upper(), fill=(136, 200, 197), font=font)
    return sheet


def build_artifacts() -> dict[str, bytes]:
    validate_source()
    atlas = Image.new("RGBA", (GEOMETRY["sheetWidth"], GEOMETRY["sheetHeight"]), CLEAR)
    frames = []
    kind_records = []
    for row, kind in enumerate(SOURCE["kinds"]):
        hashes = set()
        heights = []
        for column, state in enumerate(kind["states"]):
            cell = Cell()
            DRAWERS[kind["id"]](cell, state)
            record = frame_record(cell.image, kind, state, row, column)
            if record["rgbaSha256"] in hashes:
                raise ValueError(f"State {kind['id']}:{state} duplicates another state")
            hashes.add(record["rgbaSha256"])
            heights.append(record["visualHeight"])
            frames.append(record)
            atlas.alpha_composite(cell.image, (column * W, row * H))
        kind_records.append({
            "id": kind["id"],
            "role": kind["role"],
            "row": row,
            "states": kind["states"],
            "visualHeight": max(heights),
        })
    atlas_data = png_bytes(atlas)
    review_data = png_bytes(build_review_sheet(atlas))
    used_colors = sorted({pixel[:3] for pixel in atlas.getdata() if pixel[3] == 255})
    palette_names = {value[:3]: name for name, value in COLORS.items()}
    source_data = SOURCE_PATH.read_bytes()
    builder_data = Path(__file__).read_bytes()
    manifest = {
        "schemaVersion": 1,
        "assetId": SOURCE["assetId"],
        "status": SOURCE["status"],
        "provenance": {
            "classification": SOURCE["classification"],
            "lane": "pixel-authored deterministic production (code-native primitives)",
            "generatorUsed": False,
            "externalPixels": False,
            "handPixeledClaim": False,
            "originalityPolicy": SOURCE["originalityPolicy"],
        },
        "geometry": GEOMETRY,
        "palette": {
            "declared": len(COLORS),
            "used": len(used_colors),
            "usedNames": sorted(palette_names[color] for color in used_colors),
        },
        "kinds": kind_records,
        "frames": frames,
        "sources": [
            {"path": SOURCE_PATH.name, "sha256": hashlib.sha256(source_data).hexdigest()},
            {"path": Path(__file__).name, "sha256": hashlib.sha256(builder_data).hexdigest()},
        ],
        "outputs": [
            {"path": ATLAS_NAME, "purpose": "transparent-runtime-atlas", "runtime": True,
             "sha256": hashlib.sha256(atlas_data).hexdigest(), "ihdr": ihdr(atlas_data)},
            {"path": REVIEW_NAME, "purpose": "labelled-2x-nearest-review-sheet", "runtime": False,
             "sha256": hashlib.sha256(review_data).hexdigest(), "ihdr": ihdr(review_data)},
        ],
        "runtimeCopy": {
            "path": "game/assets/art/action-objective-suite-v1/" + ATLAS_NAME,
            "byteIdenticalToAtlas": True,
        },
        "builder": {
            "pillowVersion": PILLOW_VERSION,
            "deterministic": True,
            "integerAligned": True,
            "nativeResampling": "none",
            "reviewResampling": "nearest-neighbor",
            "twoCleanBuildsByteIdentical": True,
        },
        "restrictions": SOURCE["restrictions"],
    }
    return {
        ATLAS_NAME: atlas_data,
        REVIEW_NAME: review_data,
        MANIFEST_NAME: (json.dumps(manifest, indent=2) + "\n").encode("utf-8"),
    }


def build_twice() -> dict[str, bytes]:
    first = build_artifacts()
    second = build_artifacts()
    for name in first:
        if first[name] != second[name]:
            raise SystemExit(f"Non-deterministic output detected: {name}")
    return first


def targets(artifacts: dict[str, bytes]) -> list[tuple[Path, bytes]]:
    result = [(ROOT / name, data) for name, data in artifacts.items()]
    result.append((RUNTIME_ATLAS, artifacts[ATLAS_NAME]))
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="verify outputs without writing")
    args = parser.parse_args()
    if PIL.__version__ != PILLOW_VERSION:
        raise SystemExit(f"Pillow {PILLOW_VERSION} is required for byte identity; found {PIL.__version__}")
    artifacts = build_twice()
    if args.check:
        mismatches = []
        for path, data in targets(artifacts):
            if not path.exists():
                mismatches.append(f"missing {path.relative_to(REPO).as_posix()}")
            elif path.read_bytes() != data:
                mismatches.append(f"stale {path.relative_to(REPO).as_posix()}")
        if mismatches:
            raise SystemExit("Action objective suite check failed: " + ", ".join(mismatches))
        print("Action objective suite is deterministic and current: atlas, review sheet, manifest, and runtime copy are byte-identical.")
        return
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    for path, data in targets(artifacts):
        path.write_bytes(data)
    print(f"Wrote {len(artifacts)} suite outputs and the runtime atlas copy.")


if __name__ == "__main__":
    main()
