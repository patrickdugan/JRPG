#!/usr/bin/env python3
"""Build the deterministic top-down field prop and landmark atlas (field-prop-suite-v1).

Every frame is drawn from code-native integer pixel primitives at native 16 x 16
cell resolution under the explicit per-family palettes in
``field-prop-suite.source.json``. No raster input, generator, or external pixel
is read. ``--check`` rebuilds in memory and fails when any checked-in output,
including the byte-identical runtime copy, is stale.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

import PIL
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
SOURCE_PATH = ROOT / "field-prop-suite.source.json"
BUILDER_PATH = Path(__file__).resolve()
ATLAS_PATH = ROOT / "field-prop-atlas.png"
CONTACT_PATH = ROOT / "field-prop-contact-sheet.png"
MANIFEST_PATH = ROOT / "manifest.json"
RUNTIME_PATH = REPO / "game" / "assets" / "art" / "field-prop-suite-v1" / ATLAS_PATH.name
CELL = 16
TRANSPARENT = (0, 0, 0, 0)
SHADOW = (11, 16, 32, 112)

# Review-only floor swatches (world tileset "mid" values) for the contact sheet.
REVIEW_FLOORS = {
    "village": "#455666", "river": "#3F6470", "relay": "#665044", "ash": "#4B4B52",
    "castle": "#3C3340", "archive": "#665A57", "forge": "#44464A", "engine": "#46545A",
    "tall": "#3A4656",
}
FAMILY_TITLES = {
    "village": "Takamine rain village - kawara tile roofs, cedar, paper windows",
    "river": "Hoshigawa river ward - plank-and-plaster, stone-weighted plank roofs",
    "relay": "Sodegaura relay road - thatched post stations, lattice fronts",
    "ash": "Kagura ash pass - slate-roofed stone huts under ash",
    "castle": "Kurohana black castle - black lacquer walls, vermilion trim",
    "archive": "Hidden archive chapel - plaster storehouses, heavy tile",
    "forge": "Oni forge - soot masonry, ember vents",
    "engine": "Black bell engine - riveted iron, bronze pipes",
    "tall": "Shared tall props (1 x 2 cells)",
}


def color(value: str) -> tuple[int, int, int, int]:
    value = value.removeprefix("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), 255)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def idiv(numerator: int, denominator: int) -> int:
    """Round-half-up integer division for non-negative geometry."""
    return (2 * numerator + denominator) // (2 * denominator)


def in_ellipse(x: int, y: int, x0: int, y0: int, x1: int, y1: int) -> bool:
    cx2, cy2 = x0 + x1 + 1, y0 + y1 + 1
    rx2, ry2 = x1 - x0 + 1, y1 - y0 + 1
    dx, dy = 2 * x + 1 - cx2, 2 * y + 1 - cy2
    return dx * dx * ry2 * ry2 + dy * dy * rx2 * rx2 <= rx2 * rx2 * ry2 * ry2


class Canvas:
    """Integer pixel canvas with binary art alpha and one fixed shadow value."""

    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.image = Image.new("RGBA", (width, height), TRANSPARENT)
        self.pixels = self.image.load()

    def inside(self, x: int, y: int) -> bool:
        return 0 <= x < self.width and 0 <= y < self.height

    def put(self, x: int, y: int, value) -> None:
        if value is not None and self.inside(x, y):
            self.pixels[x, y] = value

    def get(self, x: int, y: int):
        return self.pixels[x, y] if self.inside(x, y) else TRANSPARENT

    def opaque(self, x: int, y: int) -> bool:
        return self.inside(x, y) and self.pixels[x, y][3] == 255

    def rect(self, x0: int, y0: int, x1: int, y1: int, value) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, value)

    def hline(self, x0: int, x1: int, y: int, value) -> None:
        self.rect(x0, y, x1, y, value)

    def vline(self, x: int, y0: int, y1: int, value) -> None:
        self.rect(x, y0, x, y1, value)

    def frame(self, x0: int, y0: int, x1: int, y1: int, value) -> None:
        self.hline(x0, x1, y0, value)
        self.hline(x0, x1, y1, value)
        self.vline(x0, y0, y1, value)
        self.vline(x1, y0, y1, value)

    def ellipse(self, x0: int, y0: int, x1: int, y1: int, value) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if in_ellipse(x, y, x0, y0, x1, y1):
                    self.put(x, y, value)

    def line(self, x0: int, y0: int, x1: int, y1: int, value) -> None:
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.put(x0, y0, value)
            if x0 == x1 and y0 == y1:
                return
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def points(self, coordinates, value) -> None:
        for x, y in coordinates:
            self.put(x, y, value)

    def shadow(self, x: int, y: int) -> None:
        if self.inside(x, y) and self.pixels[x, y][3] == 0:
            self.pixels[x, y] = SHADOW

    def shadow_rect(self, x0: int, y0: int, x1: int, y1: int) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.shadow(x, y)

    def shadow_ellipse(self, x0: int, y0: int, x1: int, y1: int) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if in_ellipse(x, y, x0, y0, x1, y1):
                    self.shadow(x, y)

    def outline_around(self, value, region=None) -> None:
        """Add a one-pixel authored contour around opaque art inside region."""
        x0, y0, x1, y1 = region or (0, 0, self.width - 1, self.height - 1)
        targets = []
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if self.pixels[x, y][3] == 255:
                    continue
                if any(self.opaque(x + dx, y + dy) and self.pixels[x + dx, y + dy] != value
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    targets.append((x, y))
        for x, y in targets:
            self.pixels[x, y] = value


# ---------------------------------------------------------------------------
# Roof, ridge, eave, and facade materials
# ---------------------------------------------------------------------------

def roof_ramp(pal: dict) -> list:
    return [pal["roofDeep"], pal["roofDark"], pal["roofMid"], pal["roofLight"], pal["roofHi"]]


def roof_index(fam: str, x: int, row: int) -> int:
    """Ramp index (0..4) for the roof material at column x, row counted from the ridge."""
    if fam in ("village", "archive"):
        index = (1, 2, 3, 2)[x % 4]
        if fam == "village" and row % 3 == 2 and x % 4 == 2:
            index = 2
        return index
    if fam == "castle":
        index = (1, 2, 3, 2)[x % 4]
        if row % 4 == 1 and x % 4 == 2:
            index = 4
        return index
    if fam == "river":
        course, step = divmod(row, 2)
        if (x + course * 5) % 8 == 0:
            return 1
        return 3 if step == 0 else 2
    if fam == "relay":
        return (2, 3, 2, 1, 2, 3, 4, 2)[(x + row * 3) % 8]
    if fam == "ash":
        course, step = divmod(row, 3)
        if (x + (4 if course % 2 else 0)) % 8 == 0:
            return 1
        return (3, 2, 1)[step]
    if fam == "forge":
        course, step = divmod(row, 4)
        if (x + (4 if course % 2 else 0)) % 8 == 7:
            return 0
        index = (3, 2, 2, 1)[step]
        if x % 16 == 5 and row % 6 < 3:
            index -= 1
        return index
    if fam == "engine":
        step, column = row % 5, x % 8
        if step == 4 or column == 7:
            return 0
        if step == 1 and column in (1, 5):
            return 4
        return 3 if step == 0 else 2
    raise ValueError(fam)


FACE_SHIFT = {"front": 0, "back": -1, "left": 1, "right": -1}


def roof_color(fam: str, pal: dict, x: int, row: int, face: str, first_row: bool = False):
    if fam == "river" and face in ("front", "back"):
        stone = {(3, 2): "stoneLight", (4, 2): "stoneMid", (3, 3): "stoneMid", (4, 3): "stoneDark",
                 (11, 6): "stoneLight", (12, 6): "stoneMid", (11, 7): "stoneMid", (12, 7): "stoneDark"}.get((x % 16, row % 8))
        if stone:
            return pal[stone]
    if fam == "ash":
        if (x * 7 + row * 11) % 37 == 0:
            return pal["special"]
        if (x * 5 + row * 3) % 53 == 0:
            return pal["specialHi"]
    index = roof_index(fam, x, row) + FACE_SHIFT[face] - (1 if first_row else 0)
    return roof_ramp(pal)[max(0, min(4, index))]


def ridge_color(fam: str, pal: dict, x: int, r: int, rows: int):
    last = r == rows - 1
    if fam == "village":
        if r == 0:
            return pal["ridgeA"]
        return pal["roofMid"] if x % 8 == 0 else pal["ridgeB"]
    if fam == "river":
        if r == 0:
            return pal["woodLight"]
        return pal["stoneLight"] if x % 8 == 3 else pal["woodMid"]
    if fam == "relay":
        if r == 0:
            return pal["ridgeA"]
        return pal["roofLight"] if x % 4 == 0 else pal["ridgeB"]
    if fam == "ash":
        if r == 0:
            return pal["ridgeA"]
        return pal["roofMid"] if x % 6 == 0 else pal["roofLight"]
    if fam == "castle":
        if r == 0:
            return pal["accentHi"]
        return pal["metalMid"] if x % 8 == 0 else pal["roofMid"]
    if fam == "archive":
        if r == 0:
            return pal["ridgeA"]
        return pal["wallDark"] if last and rows > 2 else pal["ridgeB"]
    if fam == "forge":
        return pal["ridgeA"] if r == 0 else pal["ridgeB"]
    if fam == "engine":
        if r == 0:
            return pal["woodLight"]
        return pal["woodDark"] if x % 8 == 0 else pal["woodMid"]
    raise ValueError(fam)


def eave_color(fam: str, pal: dict, x: int):
    if fam == "village":
        return pal["roofHi"] if x % 4 == 2 else pal["roofDark"]
    if fam == "river":
        return pal["woodDark"] if x % 8 == 0 else pal["woodLight"]
    if fam == "relay":
        return pal["roofLight"] if x % 2 == 0 else pal["roofMid"]
    if fam == "ash":
        return pal["special"] if x % 5 == 1 else pal["roofLight"]
    if fam == "castle":
        return pal["metalHi"] if x % 8 == 4 else pal["accentHi"]
    if fam == "archive":
        return pal["wallLight"]
    if fam == "forge":
        return pal["roofLight"]
    if fam == "engine":
        return pal["woodMid"] if x % 4 == 0 else pal["woodLight"]
    raise ValueError(fam)


def barge_colors(fam: str, pal: dict) -> tuple:
    """(lit west gable edge, shaded east gable edge)."""
    return {
        "village": (pal["woodLight"], pal["woodDark"]),
        "river": (pal["woodLight"], pal["woodDark"]),
        "relay": (pal["roofHi"], pal["roofDeep"]),
        "ash": (pal["roofHi"], pal["roofDeep"]),
        "castle": (pal["accentHi"], pal["accent"]),
        "archive": (pal["wallLight"], pal["wallDark"]),
        "forge": (pal["roofHi"], pal["roofDeep"]),
        "engine": (pal["woodLight"], pal["woodDark"]),
    }[fam]


def wall_px(fam: str, pal: dict, x: int, r: int, rows: int):
    """Facade wall background at column x and facade row r (0 = lintel row)."""
    if fam == "village":
        if r == 0:
            return pal["woodDark"]
        if r == rows - 1:
            return pal["woodDark"]
        if x % 8 == 0:
            return pal["woodDark"]
        if x % 8 == 1:
            return pal["woodLight"]
        return pal["wallDark"] if r % 3 == 0 else pal["wallMid"]
    if fam == "river":
        upper = (rows + 1) // 2
        if r == 0:
            return pal["woodMid"]
        if x % 8 == 0:
            return pal["woodDark"]
        if r < upper:
            return pal["wallMid"] if r == upper - 1 else pal["wallLight"]
        return pal["woodLight"] if (r - upper) % 2 == 0 else pal["woodMid"]
    if fam == "relay":
        if r == 0:
            return pal["woodDark"]
        if x % 8 == 0:
            return pal["woodMid"]
        if r == rows - 1:
            return pal["woodDark"]
        return pal["wallMid"] if r % 4 != 2 else pal["wallDark"]
    if fam == "ash":
        course, step = divmod(r, 2)
        offset = 3 if course % 2 else 0
        if (x + offset) % 6 == 0:
            return pal["wallDark"]
        if step == 1:
            return pal["wallDark"] if (x + offset) % 6 == 5 else pal["wallMid"]
        return pal["wallLight"] if (x + offset) % 6 == 1 else pal["wallMid"]
    if fam == "castle":
        stone_rows = 3 if rows >= 10 else 0
        if r >= rows - stone_rows:
            sr = r - (rows - stone_rows)
            offset = 4 if sr % 2 else 0
            if (x + offset) % 8 == 0 or sr == stone_rows - 1:
                return pal["stoneDark"]
            return pal["stoneLight"] if (x + offset) % 8 == 1 and sr == 0 else pal["stoneMid"]
        if r == 0:
            return pal["accentHi"]
        if r == 1:
            return pal["roofDeep"]
        if x % 8 == 0:
            return pal["woodDark"]
        if x % 8 == 2:
            return pal["wallLight"]
        return pal["wallMid"]
    if fam == "archive":
        plaster = max(2, rows // 2)
        if r == 0:
            return pal["wallMid"]
        if r < plaster:
            return pal["wallLight"]
        if r == plaster:
            return pal["woodDark"]
        return pal["woodLight"] if (x + r) % 4 == 0 or (x - r) % 4 == 0 else pal["woodMid"]
    if fam == "forge":
        course, step = divmod(r, 2)
        if step == 1:
            return pal["wallDark"]
        if (x + (4 if course % 2 else 0)) % 8 == 0:
            return pal["wallDark"]
        if r <= 1:
            return pal["wallDark"] if x % 3 == 0 else pal["wallMid"]
        return pal["wallLight"] if (x + (4 if course % 2 else 0)) % 8 == 1 else pal["wallMid"]
    if fam == "engine":
        band = rows // 2
        if r in (band, band + 1):
            if x % 8 == 0:
                return pal["woodDark"]
            return pal["woodLight"] if r == band else pal["woodMid"]
        if x % 8 == 7 or r % 4 == 3:
            return pal["wallDark"]
        if x % 8 in (1, 5) and r % 4 == 1:
            return pal["roofHi"]
        return pal["wallMid"]
    raise ValueError(fam)


def draw_window(c: Canvas, fam: str, pal: dict, xa: int, xb: int, ya: int, yb: int) -> None:
    """A lit opening in the facade span (inclusive)."""
    w, h = xb - xa + 1, yb - ya + 1
    mid_x = xa + w // 2
    if fam == "village":
        # Lit paper panels split by one mullion; no cross bars, so no glyph-like grid.
        c.rect(xa, ya, xb, yb, pal["paper"])
        c.vline(mid_x, ya, yb, pal["woodMid"])
        c.hline(xa, xb, yb, pal["accent"])
        for y in range(ya + max(0, (h - 3) // 2), ya + max(1, (h + 1) // 2)):
            c.put(mid_x - 1, y, pal["glow"])
            c.put(mid_x + 1, y, pal["glow"])
    elif fam == "river":
        c.rect(xa, ya, xb, yb, pal["woodDark"])
        c.rect(xa + 1, ya, xb - 1, yb - 1, pal["paper"])
        c.hline(xa + 1, xb - 1, ya + (h - 1) // 2, pal["glow"])
        if w >= 5:
            c.vline(mid_x, ya, yb - 1, pal["woodMid"])
    elif fam == "relay":
        c.rect(xa, ya, xb, yb, pal["glow"])
        for x in range(xa, xb + 1):
            if x % 2 == 0:
                c.vline(x, ya, yb, pal["woodDark"])
    elif fam == "ash":
        c.rect(xa, ya, xb, yb, pal["roofDeep"])
        c.rect(xa + 1, ya + (1 if h > 2 else 0), xb - 1, yb, pal["accent"])
        c.put(mid_x, yb, pal["glow"])
    elif fam == "castle":
        c.rect(xa, ya, xb, yb, pal["roofDeep"])
        c.hline(xa, xb, ya, pal["outline"])
        c.hline(xa + 1, xb - 1, yb - (1 if h > 3 else 0), pal["metalDark"])
        c.put(mid_x, yb - (1 if h > 3 else 0), pal["paper"])
    elif fam == "archive":
        c.rect(xa, ya, xb, yb, pal["roofDeep"])
        c.rect(xa + 1, ya + 1, xb - 1, yb - 1 if h > 2 else yb, pal["glow"])
        for x in range(xa + 1, xb):
            if (x - xa) % 2 == 0:
                c.vline(x, ya + 1, yb - 1 if h > 2 else yb, pal["wallDark"])
    elif fam == "forge":
        c.rect(xa, ya, xb, yb, pal["roofDeep"])
        c.rect(xa + 1, ya + (1 if h > 2 else 0), xb - 1, yb, pal["glow"])
        c.hline(xa + 1, xb - 1, yb, pal["paper"])
    elif fam == "engine":
        c.hline(xa + 1, xb - 1, ya, pal["woodLight"])
        c.hline(xa + 1, xb - 1, yb, pal["woodDark"])
        c.vline(xa, ya + 1, yb - 1, pal["woodLight"])
        c.vline(xb, ya + 1, yb - 1, pal["woodDark"])
        c.rect(xa + 1, ya + 1, xb - 1, yb - 1, pal["roofDeep"])
        c.put(mid_x, ya + 1, pal["accentHi"])
    else:
        raise ValueError(fam)


def draw_door(c: Canvas, fam: str, pal: dict, xa: int, xb: int, ya: int, yb: int) -> None:
    w, h = xb - xa + 1, yb - ya + 1
    mid_x = xa + w // 2
    if fam == "village":
        c.rect(xa, ya, xb, yb, pal["roofDeep"])
        cloth = max(1, min(3, h // 2))
        c.rect(xa, ya, xb, ya + cloth - 1, pal["fabric"])
        c.hline(xa, xb, ya, pal["fabricHi"])
        c.vline(mid_x, ya + 1, ya + cloth - 1, pal["roofDeep"])
        c.hline(xa + 1, xb - 1, yb, pal["glow"] if h >= 4 else pal["paper"])
    elif fam == "river":
        c.rect(xa, ya, xb, yb, pal["woodMid"])
        c.frame(xa, ya, xb, yb, pal["woodDark"])
        c.vline(mid_x, ya + 1, yb, pal["woodDark"])
        c.vline(mid_x + 1, ya + 1, yb - 1, pal["glow"])
    elif fam == "relay":
        c.rect(xa, ya, xb, yb, pal["roofDeep"])
        lx = mid_x - 1
        top = ya + (1 if h >= 4 else 0)
        c.hline(lx, lx + 2, top, pal["woodDark"])
        c.rect(lx, top + 1, lx + 2, min(yb, top + max(1, h // 2)), pal["accentHi"])
        c.put(lx + 1, top + 1, pal["glow"])
        c.vline(lx - 1, top + 1, min(yb, top + max(1, h // 2)), pal["accent"])
    elif fam == "ash":
        c.rect(xa, ya, xb, yb, pal["woodMid"])
        c.frame(xa, ya, xb, yb, pal["woodDark"])
        c.vline(mid_x, ya + 1, yb - 1, pal["woodLight"])
    elif fam == "castle":
        c.rect(xa, ya, xb, yb, pal["roofDeep"])
        c.vline(xa, ya, yb, pal["accent"])
        c.vline(xb, ya, yb, pal["accent"])
        for y in range(ya + 1, yb + 1, 2):
            for x in range(xa + 1, xb, 2):
                c.put(x, y, pal["metalMid"])
    elif fam == "archive":
        c.rect(xa, ya, xb, yb, pal["wallMid"])
        c.rect(xa + 1, ya + 1, xb - 1, yb, pal["woodDark"])
        c.put(mid_x, ya + 1 + (h - 1) // 2, pal["metalHi"])
    elif fam == "forge":
        c.rect(xa, ya, xb, yb, pal["metalMid"])
        c.frame(xa, ya, xb, yb, pal["metalDark"])
        for y in range(ya + 1, yb, 2):
            c.put(xa + 1, y, pal["metalHi"])
            c.put(xb - 1, y, pal["metalHi"])
        c.hline(xa + 1, xb - 1, yb, pal["glow"])
    elif fam == "engine":
        c.rect(xa, ya, xb, yb, pal["roofDeep"])
        c.frame(xa, ya, xb, yb, pal["woodLight"])
        c.hline(xa + 1, xb - 1, ya + h // 2, pal["accentHi"])
    else:
        raise ValueError(fam)


def draw_facade(c: Canvas, fam: str, pal: dict, x0: int, x1: int, y0: int, y1: int,
                windows=(), doors=(), end_posts=(True, True)) -> None:
    rows = y1 - y0 + 1
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c.put(x, y, wall_px(fam, pal, x, y - y0, rows))
    post = {"village": pal["woodDark"], "river": pal["woodDark"], "relay": pal["woodMid"], "ash": pal["wallDark"],
            "castle": pal["woodDark"], "archive": pal["wallDark"], "forge": pal["wallDark"], "engine": pal["wallDark"]}[fam]
    if end_posts[0]:
        c.vline(x0, y0, y1, post)
    if end_posts[1]:
        c.vline(x1, y0, y1, post)
    body_top = y0 + 1 + (1 if fam == "castle" else 0)
    body_bottom = y1 - (1 if fam in ("village", "relay") else 0)
    if fam == "castle" and rows >= 10:
        body_bottom = y1 - 3
    if fam == "archive":
        body_bottom = y0 + max(2, rows // 2) - 1
    for xa, xb in windows:
        top = body_top + (1 if rows >= 9 else 0)
        bottom = min(body_bottom, top + max(1, (rows - 3) // 2 + (1 if rows < 9 else 0)))
        if fam == "archive":
            top, bottom = y0 + 1, max(y0 + 2, body_bottom)
        draw_window(c, fam, pal, xa, xb, top, bottom)
    for xa, xb in doors:
        top = body_top
        bottom = y1 - (1 if fam in ("village", "relay") else 0)
        if fam == "castle" and rows >= 10:
            bottom = y1 - 1
        draw_door(c, fam, pal, xa, xb, top, bottom)


def draw_foundation(c: Canvas, pal: dict, x0: int, x1: int, y0: int, y1: int) -> None:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if y == y1:
                c.put(x, y, pal["stoneDark"])
            else:
                c.put(x, y, pal["stoneLight"] if x % 4 == 1 else pal["stoneMid"])


# ---------------------------------------------------------------------------
# Building strips and walls
# ---------------------------------------------------------------------------

STRIP_LAYOUT = {
    1: {"default": (0, 2, 4, 6, 1), "castle": (0, 2, 2, 8, 1), "forge": (0, 2, 3, 7, 1), "engine": (0, 2, 3, 7, 1)},
    2: {"default": (3, 2, 11, 11, 2), "archive": (2, 3, 11, 11, 2), "castle": (2, 2, 6, 17, 2),
        "forge": (3, 2, 9, 13, 2), "engine": (3, 2, 9, 13, 2)},
}

PIECE_OPENINGS = {
    "left": ((), ()),
    "mid-a": (((3, 6), (10, 13)), ()),
    "mid-b": (((10, 13),), ()),
    "mid-c": (((2, 5),), ((9, 14),)),
    "right": (((3, 6),), ()),
}
FAMILY_PIECE_OPENINGS = {
    "castle": {"left": ((), ()), "mid-a": (((5, 9),), ()), "mid-b": (((10, 14),), ()),
               "mid-c": ((), ((5, 10),)), "right": (((3, 7),), ())},
    "engine": {"left": ((), ()), "mid-a": (((10, 12),), ()), "mid-b": ((), ()),
               "mid-c": ((), ((4, 10),)), "right": ((), ())},
    "ash": {"left": ((), ()), "mid-a": (((5, 7),), ()), "mid-b": (((11, 13),), ()),
            "mid-c": ((), ((8, 12),)), "right": (((4, 6),), ())},
    "forge": {"left": ((), ()), "mid-a": (((5, 8),), ()), "mid-b": ((), ()),
              "mid-c": ((), ((8, 13),)), "right": (((4, 7),), ())},
}
TALL_PIECE_OPENINGS = {
    "left": (((5, 9),), ()),
    "mid-a": (((2, 6), (10, 14)), ()),
    "mid-b": ((), ((4, 11),)),
    "right": (((2, 6),), ()),
}


def roof_detail(c: Canvas, fam: str, pal: dict, ridge_y: int, front_y: int, front_rows: int) -> None:
    """Mid-b ridge or roof feature that breaks long runs."""
    if fam == "village":
        c.hline(6, 9, ridge_y - 1, pal["outline"])
        c.hline(5, 10, ridge_y, pal["ridgeA"])
        c.rect(6, ridge_y + 1, 9, ridge_y + 2, pal["roofDeep"])
        c.hline(7, 8, ridge_y + 1, pal["woodMid"])
    elif fam == "river":
        for x, y in ((6, front_y + 1), (13, front_y + front_rows - 2)):
            c.put(x, y, pal["stoneLight"])
            c.put(x + 1, y, pal["stoneMid"])
            c.put(x, y + 1, pal["stoneMid"])
            c.put(x + 1, y + 1, pal["stoneDark"])
    elif fam == "relay":
        c.rect(6, ridge_y - 1, 9, ridge_y + 1, pal["ridgeB"])
        c.hline(6, 9, ridge_y - 1, pal["roofLight"])
        c.hline(7, 8, ridge_y + 1, pal["roofDeep"])
    elif fam == "ash":
        top = max(0, front_y - 2)
        c.rect(10, top, 13, front_y + 1, pal["stoneMid"])
        c.vline(10, top, front_y + 1, pal["stoneLight"])
        c.vline(13, top, front_y + 1, pal["stoneDark"])
        c.hline(11, 12, top, pal["roofDeep"])
        c.put(11, top + 1, pal["accentHi"])
    elif fam == "castle":
        c.rect(7, ridge_y - 1, 8, ridge_y + 1, pal["metalMid"])
        c.put(7, ridge_y - 1, pal["metalHi"])
        c.put(8, ridge_y + 1, pal["metalDark"])
    elif fam == "archive":
        c.rect(6, ridge_y, 9, ridge_y + 1, pal["ridgeA"])
        c.hline(6, 9, ridge_y - 1, pal["outline"])
        c.hline(7, 8, ridge_y + 1, pal["wallDark"])
    elif fam == "forge":
        top = max(0, front_y - 3)
        c.rect(9, top, 13, front_y + 1, pal["wallMid"])
        c.vline(9, top, front_y + 1, pal["wallLight"])
        c.vline(13, top, front_y + 1, pal["wallDark"])
        c.rect(10, top, 12, top + 1, pal["roofDeep"])
        c.put(11, top + 1, pal["glow"])
        c.put(10, top + 1, pal["accent"])
    elif fam == "engine":
        cy = front_y + max(1, front_rows // 2 - 1)
        c.rect(5, cy - 1, 10, cy + 2, pal["woodMid"])
        c.hline(6, 9, cy - 1, pal["woodLight"])
        c.rect(6, cy, 9, cy + 1, pal["roofDeep"])
        c.put(7, cy + 1, pal["accent"])
        c.put(8, cy, pal["accentHi"])
        c.hline(6, 9, cy + 2, pal["woodDark"])


def draw_strip(fam: str, pal: dict, piece: str, height_cells: int) -> Image.Image:
    height = CELL * height_cells
    layout = STRIP_LAYOUT[height_cells].get(fam, STRIP_LAYOUT[height_cells]["default"])
    back, ridge, front, facade, foundation = layout
    c = Canvas(CELL, height)
    left, right = piece == "left", piece == "right"
    rx0, rx1 = (1 if left else 0), (14 if right else 15)
    fx0, fx1 = (2 if left else 0), (13 if right else 15)
    y = 0
    c.hline(rx0 + (1 if left else 0), rx1 - (1 if right else 0), y, pal["outline"])
    y += 1
    for r in range(back):
        for x in range(rx0, rx1 + 1):
            c.put(x, y, roof_color(fam, pal, x, back - 1 - r + 5, "back"))
        y += 1
    ridge_y = y
    for r in range(ridge):
        for x in range(rx0, rx1 + 1):
            c.put(x, y, ridge_color(fam, pal, x, r, ridge))
        y += 1
    front_y = y
    for r in range(front):
        for x in range(rx0, rx1 + 1):
            c.put(x, y, roof_color(fam, pal, x, r, "front", first_row=(r == 0)))
        y += 1
    eave_y = y
    for x in range(rx0, rx1 + 1):
        c.put(x, y, eave_color(fam, pal, x))
    y += 1
    c.hline(rx0, rx1, y, pal["outline"])
    y += 1
    facade_y = y
    if height_cells == 2:
        windows, doors = TALL_PIECE_OPENINGS[piece]
    else:
        windows, doors = FAMILY_PIECE_OPENINGS.get(fam, PIECE_OPENINGS)[piece]
    draw_facade(c, fam, pal, fx0, fx1, y, y + facade - 1, windows, doors, (left, right))
    y += facade
    draw_foundation(c, pal, fx0, fx1, y, y + foundation - 1)
    if piece == "mid-b":
        roof_detail(c, fam, pal, ridge_y, front_y, front)
    lit, shaded = barge_colors(fam, pal)
    if left:
        c.vline(rx0, 1, eave_y, lit)
        c.vline(rx0 + 1, ridge_y, ridge_y + ridge - 1, pal["outline"])
        c.rect(rx0 + 1, ridge_y - 1, rx0 + 2, ridge_y - 1, pal["outline"])
        c.put(rx0 + 2, ridge_y, lit)
        c.put(0, eave_y, None)
    if right:
        c.vline(rx1, 1, eave_y, shaded)
        c.vline(rx1 - 1, ridge_y, ridge_y + ridge - 1, pal["outline"])
        c.rect(rx1 - 2, ridge_y - 1, rx1 - 1, ridge_y - 1, pal["outline"])
        c.shadow_rect(15, 1, 15, height - 1)
        c.shadow_rect(14, facade_y, 15, height - 1)
    return c.image


def draw_wall(fam: str, pal: dict, piece: str) -> Image.Image:
    """North-south wall or fence run seen from above (top, middle, bottom end)."""
    c = Canvas(CELL, CELL)
    cap_top = 1 if piece == "top" else 0
    cap_bottom = 8 if piece == "bottom" else 15
    lit, shaded = barge_colors(fam, pal)
    if fam == "archive":
        lit, shaded = pal["roofHi"], pal["roofDeep"]
    for y in range(cap_top, cap_bottom + 1):
        c.put(3, y, pal["outline"])
        c.put(12, y, pal["outline"])
        for x in range(4, 12):
            if fam == "ash":
                course, step = divmod(y, 3)
                offset = 2 if course % 2 else 0
                if (x + offset) % 4 == 0 or step == 2:
                    value = pal["wallDark"]
                elif step == 0:
                    value = pal["wallLight"]
                else:
                    value = pal["wallMid"]
                if (x * 3 + y * 7) % 11 == 0:
                    value = pal["special"]
            elif fam == "engine":
                if x <= 7:
                    value = (pal["metalHi"], pal["metalMid"], pal["metalMid"], pal["metalDark"])[x - 4]
                    if y % 8 == 3:
                        value = pal["roofHi"]
                else:
                    value = (pal["woodLight"], pal["woodMid"], pal["woodMid"], pal["woodDark"])[x - 8]
                    if y % 8 == 6:
                        value = pal["woodDark"]
            elif fam == "forge":
                value = roof_color(fam, pal, y, x, "front")
            elif x in (7, 8):
                value = ridge_color(fam, pal, y, 0 if x == 7 else 1, 2)
            else:
                index = (1, 2, 3, 2)[y % 4] if fam not in ("river", "relay") else roof_index(fam, y, x)
                index += 1 if x < 7 else -1
                value = roof_ramp(pal)[max(0, min(4, index))]
            c.put(x, y, value)
        c.put(4, y, lit if fam not in ("engine", "ash") else c.get(4, y))
        c.put(11, y, shaded if fam not in ("engine", "ash") else c.get(11, y))
    if piece == "top":
        c.hline(4, 11, 0, pal["outline"])
        c.hline(5, 10, 1, lit if fam not in ("engine",) else pal["metalHi"])
    if piece == "bottom":
        c.hline(3, 12, 9, pal["outline"])
        draw_facade(c, fam, pal, 4, 11, 10, 14, (), (), (True, True))
        draw_foundation(c, pal, 4, 11, 15, 15)
        c.vline(3, 10, 15, pal["outline"])
        c.vline(12, 10, 15, pal["outline"])
    for y in range(0, 16):
        c.shadow(13, y)
        c.shadow(14, y)
    return c.image


# ---------------------------------------------------------------------------
# Multi-cell roof blocks
# ---------------------------------------------------------------------------

HIP_GEOMETRY = {
    (2, 2): {"ridge_y": 5, "ridge_x": (14, 17), "eave_y": 17, "facade": (19, 29), "foundation": (30, 31)},
    (3, 2): {"ridge_y": 5, "ridge_x": (14, 33), "eave_y": 17, "facade": (19, 29), "foundation": (30, 31)},
    (3, 3): {"ridge_y": 8, "ridge_x": (13, 34), "eave_y": 28, "facade": (30, 44), "foundation": (45, 47)},
}


def draw_hip_roof(c: Canvas, fam: str, pal: dict, ex0: int, ex1: int, top_y: int,
                  ridge_y: int, ridge_x0: int, ridge_x1: int, eave_y: int, ridge_rows: int = 2) -> None:
    """Hipped roof seen from a three-quarter top-down camera; light from the north-west."""
    c.hline(ex0 + 1, ex1 - 1, top_y, pal["outline"])
    ridge_end = ridge_y + ridge_rows - 1
    for y in range(top_y + 1, eave_y):
        if y < ridge_y:
            span = max(1, ridge_y - (top_y + 1))
            t = y - (top_y + 1)
            lb = ex0 + idiv((ridge_x0 - ex0) * t, span)
            rb = ex1 - idiv((ex1 - ridge_x1) * t, span)
            for x in range(ex0, ex1 + 1):
                if x < lb:
                    value = roof_color(fam, pal, x, y, "left")
                elif x > rb:
                    value = roof_color(fam, pal, x, y, "right")
                elif x == lb:
                    value = pal["roofHi"] if fam != "castle" else pal["roofLight"]
                elif x == rb:
                    value = pal["roofDeep"]
                else:
                    value = roof_color(fam, pal, x, ridge_y - 1 - y + 5, "back")
                c.put(x, y, value)
        elif y <= ridge_end:
            for x in range(ex0, ex1 + 1):
                if x < ridge_x0:
                    value = roof_color(fam, pal, x, y, "left")
                elif x > ridge_x1:
                    value = roof_color(fam, pal, x, y, "right")
                else:
                    value = ridge_color(fam, pal, x, y - ridge_y, ridge_rows)
                c.put(x, y, value)
        else:
            span = max(1, eave_y - 1 - ridge_end)
            t = y - ridge_end
            lf = ridge_x0 - idiv((ridge_x0 - ex0) * t, span)
            rf = ridge_x1 + idiv((ex1 - ridge_x1) * t, span)
            for x in range(ex0, ex1 + 1):
                if x < lf:
                    value = roof_color(fam, pal, x, y, "left")
                elif x > rf:
                    value = roof_color(fam, pal, x, y, "right")
                elif x == lf:
                    value = pal["roofHi"] if fam != "castle" else pal["roofLight"]
                elif x == rf:
                    value = pal["roofDeep"]
                else:
                    value = roof_color(fam, pal, x, y - ridge_end - 1, "front", first_row=(y == ridge_end + 1))
                c.put(x, y, value)
    for x in range(ex0, ex1 + 1):
        c.put(x, eave_y, eave_color(fam, pal, x))
    c.hline(ex0 + 1, ex1 - 1, eave_y + 1, pal["outline"])
    # Ridge end caps.
    lit, _ = barge_colors(fam, pal)
    c.put(ridge_x0, ridge_y - 1, pal["outline"])
    c.put(ridge_x1, ridge_y - 1, pal["outline"])
    c.put(ridge_x0, ridge_y, lit)


def draw_front_gable(c: Canvas, fam: str, pal: dict, apex_x: int, apex_y: int, base_y: int, half: int) -> None:
    """Triangular cross gable on the front slope of a 3 x 3 hall."""
    face = {"village": pal["woodLight"], "relay": pal["wallMid"], "archive": pal["wallLight"],
            "river": pal["wallLight"]}.get(fam, pal["roofLight"])
    face_shade = {"village": pal["woodMid"], "relay": pal["wallDark"], "archive": pal["wallMid"],
                  "river": pal["wallMid"]}.get(fam, pal["roofMid"])
    lit, shaded = barge_colors(fam, pal)
    height = base_y - apex_y
    for y in range(apex_y, base_y + 1):
        w = idiv(half * (y - apex_y), height)
        xl, xr = apex_x - w, apex_x + 1 + w
        for x in range(xl, xr + 1):
            if x <= xl + 1:
                value = roof_color(fam, pal, x, y, "left") if x == xl else lit
            elif x >= xr - 1:
                value = roof_color(fam, pal, x, y, "right") if x == xr else pal["outline"]
            else:
                value = face if x <= apex_x else face_shade
            c.put(x, y, value)
    beam_y = apex_y + (height * 3) // 5
    w = idiv(half * (beam_y - apex_y), height)
    c.hline(apex_x - w + 2, apex_x + w - 1, beam_y, pal["woodDark"])
    vent_y = apex_y + height // 3
    c.rect(apex_x - 1, vent_y, apex_x + 2, vent_y + 2, pal["roofDeep"])
    c.hline(apex_x, apex_x + 1, vent_y + 1, pal["glow"])
    c.put(apex_x, apex_y - 1, pal["outline"])
    c.put(apex_x + 1, apex_y - 1, pal["outline"])


def block_openings(fam: str, wc: int, hc: int, x0: int, x1: int):
    width = x1 - x0 + 1
    center = x0 + width // 2
    if wc == 2:
        return ((x0 + 3, x0 + 6), (x1 - 6, x1 - 3)), ()
    if hc == 2:
        return ((x0 + 3, x0 + 7), (x1 - 7, x1 - 3)), ((center - 4, center + 3),)
    return ((x0 + 3, x0 + 8), (x1 - 8, x1 - 3)), ((center - 5, center + 4),)


def draw_hip_block(fam: str, pal: dict, wc: int, hc: int) -> Image.Image:
    width, height = wc * CELL, hc * CELL
    g = HIP_GEOMETRY[(wc, hc)]
    c = Canvas(width, height)
    ex0, ex1 = 1, width - 3
    fy0, fy1 = g["facade"]
    fx0, fx1 = 3, width - 5
    windows, doors = block_openings(fam, wc, hc, fx0, fx1)
    if wc == 2 and fam in ("village", "relay", "archive"):
        doors, windows = ((fx0 + (fx1 - fx0) // 2 - 3, fx0 + (fx1 - fx0) // 2 + 3),), ()
    if fam == "castle" and hc == 3:
        draw_castle_tower(c, pal, width, g)
    else:
        ridge_rows = 3 if fam == "archive" and hc == 3 else 2
        draw_hip_roof(c, fam, pal, ex0, ex1, 0, g["ridge_y"], g["ridge_x"][0], g["ridge_x"][1], g["eave_y"], ridge_rows)
        if wc == 2:
            mx = (g["ridge_x"][0] + g["ridge_x"][1]) // 2
            finial = {"castle": pal["metalHi"], "engine": pal["woodLight"]}.get(fam, pal["accent"])
            c.rect(mx, g["ridge_y"] - 2, mx + 1, g["ridge_y"] - 1, finial)
            c.put(mx, g["ridge_y"] - 3, pal["outline"])
            c.put(mx + 1, g["ridge_y"] - 3, pal["outline"])
            c.put(mx + 1, g["ridge_y"] - 1, pal["outline"])
        if hc == 3 and fam in ("village", "relay", "archive"):
            draw_front_gable(c, fam, pal, width // 2 - 2, 12, g["eave_y"] - 1, 11)
        if hc == 3 and fam == "ash":
            roof_detail(c, fam, pal, g["ridge_y"], g["ridge_y"] + 4, 6)
        if hc == 3 and fam == "river":
            for x in range(8, 38, 6):
                c.put(x, g["eave_y"] - 2, pal["stoneLight"])
                c.put(x + 1, g["eave_y"] - 2, pal["stoneMid"])
    draw_facade(c, fam, pal, fx0, fx1, fy0, fy1, windows, doors, (True, True))
    draw_foundation(c, pal, fx0, fx1, g["foundation"][0], g["foundation"][1])
    c.shadow_rect(width - 2, 1, width - 1, height - 1)
    c.shadow_rect(fx1 + 1, fy0, width - 1, height - 1)
    return c.image


def draw_castle_tower(c: Canvas, pal: dict, width: int, g: dict) -> None:
    """Two-tier black-lacquer turret: lower skirt roof, upper story, upper hip roof."""
    draw_hip_roof(c, "castle", pal, 1, width - 3, 6, 10, 12, width - 15, g["eave_y"])
    # Upper story wall.
    c.rect(9, 13, width - 11, 19, pal["wallMid"])
    c.hline(9, width - 11, 13, pal["accentHi"])
    c.hline(9, width - 11, 19, pal["outline"])
    for x in range(9, width - 10):
        if x % 8 == 0:
            c.vline(x, 14, 18, pal["woodDark"])
        elif x % 8 == 2:
            c.vline(x, 14, 18, pal["wallLight"])
    for xa in (13, 21, 29):
        draw_window(c, "castle", pal, xa, xa + 3, 14, 18)
    c.vline(9, 13, 19, pal["outline"])
    c.vline(width - 11, 13, 19, pal["outline"])
    draw_hip_roof(c, "castle", pal, 6, width - 8, 0, 4, 17, width - 19, 11)
    for x in (16, width - 19):
        c.rect(x, 2, x + 1, 3, pal["metalHi"])
        c.put(x + 1, 3, pal["metalDark"])


def draw_forge_block(pal: dict, wc: int, hc: int) -> Image.Image:
    fam = "forge"
    width, height = wc * CELL, hc * CELL
    c = Canvas(width, height)
    g = HIP_GEOMETRY[(wc, hc)]
    fy0, fy1 = g["facade"]
    fx0, fx1 = 3, width - 5
    top_bottom = g["eave_y"]
    # Flat slab masonry top with a lip.
    c.hline(2, width - 4, 0, pal["outline"])
    for y in range(1, top_bottom):
        for x in range(1, width - 2):
            c.put(x, y, roof_color(fam, pal, x, y, "front"))
    c.vline(1, 1, top_bottom - 1, pal["roofHi"])
    c.vline(width - 3, 1, top_bottom - 1, pal["roofDeep"])
    c.hline(1, width - 3, top_bottom, pal["roofLight"])
    c.hline(2, width - 4, top_bottom + 1, pal["outline"])
    if (wc, hc) == (2, 2):
        cx, cy = width // 2 - 1, 8
        c.rect(cx - 5, cy - 4, cx + 6, cy + 4, pal["wallMid"])
        c.frame(cx - 5, cy - 4, cx + 6, cy + 4, pal["wallDark"])
        c.hline(cx - 5, cx + 6, cy - 4, pal["wallLight"])
        c.rect(cx - 3, cy - 2, cx + 4, cy + 2, pal["roofDeep"])
        c.rect(cx - 2, cy - 1, cx + 3, cy + 2, pal["glow"])
        c.hline(cx - 1, cx + 2, cy + 1, pal["paper"])
        c.hline(cx - 2, cx + 3, cy + 2, pal["accent"])
        doors = ((width // 2 - 5, width // 2 + 2),)
        windows = ()
    elif (wc, hc) == (3, 2):
        for cx in (11, 33):
            c.rect(cx - 4, 2, cx + 4, 11, pal["wallMid"])
            c.vline(cx - 4, 2, 11, pal["wallLight"])
            c.vline(cx + 4, 2, 11, pal["wallDark"])
            c.hline(cx - 4, cx + 4, 11, pal["wallDark"])
            c.ellipse(cx - 3, 2, cx + 3, 7, pal["roofDeep"])
            c.ellipse(cx - 2, 3, cx + 2, 6, pal["accent"])
            c.rect(cx - 1, 4, cx, 5, pal["glow"])
            c.put(cx - 1, 4, pal["paper"])
        c.hline(17, 27, 7, pal["metalMid"])
        c.hline(17, 27, 8, pal["metalDark"])
        windows, doors = ((5, 9), (35, 39)), ((15, 22), (24, 31))
    else:
        cx, cy = width // 2 - 1, 13
        c.ellipse(cx - 13, cy - 11, cx + 14, cy + 11, pal["wallDark"])
        c.ellipse(cx - 12, cy - 10, cx + 13, cy + 10, pal["wallMid"])
        for y in range(cy - 10, cy + 11):
            for x in range(cx - 12, cx + 14):
                if in_ellipse(x, y, cx - 12, cy - 10, cx + 13, cy + 10) and (x + (2 if (y // 2) % 2 else 0)) % 4 == 0 and y % 2 == 0:
                    c.put(x, y, pal["wallDark"])
        c.ellipse(cx - 12, cy - 10, cx + 1, cy - 1, None)
        for y in range(cy - 10, cy - 3):
            for x in range(cx - 12, cx - 2):
                if in_ellipse(x, y, cx - 12, cy - 10, cx + 13, cy + 10) and not in_ellipse(x, y, cx - 11, cy - 9, cx + 12, cy + 9):
                    c.put(x, y, pal["wallLight"])
        c.ellipse(cx - 8, cy - 7, cx + 9, cy + 7, pal["roofDeep"])
        c.ellipse(cx - 7, cy - 6, cx + 8, cy + 6, pal["accent"])
        c.ellipse(cx - 5, cy - 4, cx + 6, cy + 4, pal["glow"])
        c.ellipse(cx - 2, cy - 2, cx + 3, cy + 1, pal["paper"])
        c.points(((cx - 4, cy + 3), (cx + 5, cy - 2), (cx + 1, cy + 4)), pal["accent"])
        windows, doors = ((6, 10), (width - 15, width - 11)), ((width // 2 - 7, width // 2 + 4),)
    draw_facade(c, fam, pal, fx0, fx1, fy0, fy1, windows, doors, (True, True))
    draw_foundation(c, pal, fx0, fx1, g["foundation"][0], g["foundation"][1])
    c.shadow_rect(width - 2, 1, width - 1, height - 1)
    c.shadow_rect(fx1 + 1, fy0, width - 1, height - 1)
    return c.image


def draw_engine_block(pal: dict, wc: int, hc: int) -> Image.Image:
    fam = "engine"
    width, height = wc * CELL, hc * CELL
    c = Canvas(width, height)
    g = HIP_GEOMETRY[(wc, hc)]
    fy0, fy1 = g["facade"]
    fx0, fx1 = 3, width - 5
    top_bottom = g["eave_y"]
    c.hline(2, width - 4, 0, pal["outline"])
    for y in range(1, top_bottom):
        for x in range(1, width - 2):
            c.put(x, y, roof_color(fam, pal, x, y, "front"))
    c.vline(1, 1, top_bottom - 1, pal["roofHi"])
    c.vline(width - 3, 1, top_bottom - 1, pal["roofDeep"])
    for x in range(1, width - 2):
        c.put(x, top_bottom, eave_color(fam, pal, x))
    c.hline(2, width - 4, top_bottom + 1, pal["outline"])
    if (wc, hc) == (2, 2):
        cx, cy = width // 2 - 1, 8
        for y in range(cy - 7, cy + 8):
            for x in range(cx - 8, cx + 10):
                if in_ellipse(x, y, cx - 8, cy - 6, cx + 9, cy + 7):
                    inner = in_ellipse(x, y, cx - 6, cy - 4, cx + 7, cy + 5)
                    tooth = ((x - cx) * 3 + (y - cy) * 2) % 5 == 0
                    if not inner and not tooth:
                        continue
                    c.put(x, y, pal["woodMid"] if inner else pal["woodDark"])
        c.ellipse(cx - 6, cy - 4, cx + 7, cy + 5, pal["woodMid"])
        c.ellipse(cx - 6, cy - 4, cx + 3, cy + 1, pal["woodLight"])
        c.ellipse(cx - 4, cy - 2, cx + 5, cy + 3, pal["woodMid"])
        c.ellipse(cx - 2, cy - 1, cx + 3, cy + 2, pal["roofDeep"])
        c.put(cx, cy, pal["accentHi"])
        c.put(cx + 1, cy + 1, pal["accent"])
        for dx, dy in ((-8, 0), (9, 0), (0, -6), (1, 7), (-6, -5), (7, 6), (7, -5), (-6, 6)):
            c.put(cx + dx, cy + dy, pal["woodLight"])
        windows, doors = ((fx0 + 3, fx0 + 6),), ((fx1 - 9, fx1 - 4),)
    elif (wc, hc) == (3, 2):
        y0, y1 = 3, 14
        ramp = [pal["woodLight"], pal["woodLight"], pal["woodMid"], pal["woodMid"], pal["woodMid"], pal["woodMid"],
                pal["woodDark"], pal["woodDark"], pal["woodDark"], pal["roofDeep"], pal["roofDeep"], pal["outline"]]
        for y in range(y0, y1 + 1):
            for x in range(5, width - 7):
                value = ramp[y - y0]
                if (x - 5) % 9 == 0:
                    value = pal["metalHi"] if y < y0 + 4 else pal["metalMid"]
                c.put(x, y, value)
        c.put(5, y0, None)
        c.put(width - 8, y0, None)
        for cx in (4, width - 7):
            c.rect(cx - 1, y0 + 1, cx + 1, y1 - 1, pal["metalMid"])
            c.vline(cx - 1, y0 + 1, y1 - 1, pal["metalHi"])
            c.put(cx, (y0 + y1) // 2, pal["accentHi"])
        c.rect(20, 0, 23, y0, pal["woodMid"])
        c.vline(20, 0, y0, pal["woodLight"])
        c.hline(20, 23, 0, pal["woodLight"])
        windows, doors = ((fx0 + 4, fx0 + 8), (fx1 - 8, fx1 - 4)), ((width // 2 - 4, width // 2 + 2),)
    else:
        cx, cy = width // 2 - 1, 13
        for corner in ((3, 2), (width - 6, 2), (3, 24), (width - 6, 24)):
            c.line(corner[0], corner[1], cx + (1 if corner[0] > cx else 0), cy, pal["metalMid"])
        c.ellipse(cx - 12, cy - 11, cx + 13, cy + 11, pal["outline"])
        c.ellipse(cx - 11, cy - 10, cx + 12, cy + 10, pal["woodDark"])
        c.ellipse(cx - 11, cy - 10, cx + 9, cy + 7, pal["woodMid"])
        c.ellipse(cx - 10, cy - 9, cx + 4, cy + 2, pal["woodLight"])
        c.ellipse(cx - 8, cy - 8, cx - 1, cy - 3, pal["paper"])
        c.ellipse(cx - 7, cy - 6, cx + 8, cy + 6, None)
        c.ellipse(cx - 7, cy - 6, cx + 8, cy + 6, pal["woodMid"])
        c.ellipse(cx - 7, cy - 6, cx + 3, cy + 2, pal["woodLight"])
        c.ellipse(cx - 3, cy - 3, cx + 4, cy + 3, pal["woodDark"])
        c.rect(cx - 1, cy - 2, cx + 2, cy + 1, pal["roofDeep"])
        c.frame(cx - 1, cy - 2, cx + 2, cy + 1, pal["woodLight"])
        for x, y in ((cx + 8, cy + 6), (cx + 10, cy + 3), (cx - 9, cy + 7), (cx + 4, cy + 9)):
            c.put(x, y, pal["accentHi"])
            c.put(x + 1, y, pal["accent"])
        windows, doors = ((fx0 + 4, fx0 + 8), (fx1 - 8, fx1 - 4)), ((width // 2 - 5, width // 2 + 3),)
    draw_facade(c, fam, pal, fx0, fx1, fy0, fy1, windows, doors, (True, True))
    draw_foundation(c, pal, fx0, fx1, g["foundation"][0], g["foundation"][1])
    c.shadow_rect(width - 2, 1, width - 1, height - 1)
    c.shadow_rect(fx1 + 1, fy0, width - 1, height - 1)
    return c.image


def draw_block(fam: str, pal: dict, wc: int, hc: int) -> Image.Image:
    if fam == "forge":
        return draw_forge_block(pal, wc, hc)
    if fam == "engine":
        return draw_engine_block(pal, wc, hc)
    return draw_hip_block(fam, pal, wc, hc)


# ---------------------------------------------------------------------------
# Single-cell and wide props (family palettes)
# ---------------------------------------------------------------------------

STRAW = (color("#E2D2A0"), color("#B89E68"), color("#7E6640"), color("#4A3A26"))
CHARCOAL = (color("#6A625C"), color("#4A4440"), color("#2E2A28"), color("#18161A"))


def box3q(c: Canvas, x0: int, y0: int, w: int, top_h: int, front_h: int, top, top_line, front, front_dark,
          edge, outline) -> None:
    """A three-quarter box: lit top face over a shaded front face."""
    x1 = x0 + w - 1
    c.rect(x0, y0, x1, y0 + top_h - 1, top)
    for y in range(y0 + 1, y0 + top_h - 1, 2):
        c.hline(x0 + 1, x1 - 1, y, top_line)
    c.hline(x0, x1, y0, edge)
    fy = y0 + top_h
    c.rect(x0, fy, x1, fy + front_h - 1, front)
    c.vline(x1, fy, fy + front_h - 1, front_dark)
    c.hline(x0, x1, fy + front_h - 1, front_dark)
    c.frame(x0 - 1, y0 - 1, x1 + 1, fy + front_h, outline)
    c.put(x0 - 1, y0 - 1, None)
    c.put(x1 + 1, y0 - 1, None)


def sack(c: Canvas, x0: int, y0: int, x1: int, y1: int, ramp, outline, rope=None) -> None:
    light, mid, dark, deep = ramp
    rope = rope or dark
    c.ellipse(x0 - 1, y0 - 1, x1 + 1, y1 + 1, outline)
    c.ellipse(x0, y0, x1, y1, mid)
    c.ellipse(x0, y0, x1 - 2, y1 - 2, light)
    c.ellipse(x0 + 2, y0 + 2, x1, y1, mid)
    w = x1 - x0
    for x in (x0 + w // 3, x0 + (2 * w) // 3 + 1):
        c.vline(x, y0 + 1, y1 - 1, rope)
    c.hline(x0 + 1, x1 - 1, y1, dark)


def barrel(c: Canvas, x0: int, y0: int, pal: dict) -> None:
    c.rect(x0 - 1, y0 + 1, x0 + 7, y0 + 9, pal["outline"])
    c.ellipse(x0 - 1, y0 - 1, x0 + 7, y0 + 3, pal["outline"])
    c.rect(x0, y0 + 2, x0 + 6, y0 + 8, pal["woodMid"])
    c.vline(x0 + 1, y0 + 2, y0 + 8, pal["woodLight"])
    c.vline(x0 + 5, y0 + 2, y0 + 8, pal["woodDark"])
    c.vline(x0 + 6, y0 + 2, y0 + 8, pal["woodDark"])
    c.ellipse(x0, y0, x0 + 6, y0 + 2, pal["woodLight"])
    c.hline(x0 + 2, x0 + 4, y0 + 1, pal["woodDark"])
    for y in (y0 + 4, y0 + 7):
        c.hline(x0, x0 + 6, y, pal["metalDark"])
        c.put(x0 + 1, y, pal["metalMid"])


def canopy_cedar(c: Canvas, pal: dict, apex_x: int, top: int, base: int, half: int, trunk_top: int, trunk_bottom: int) -> None:
    c.rect(apex_x, trunk_top, apex_x + 1, trunk_bottom, pal["woodMid"])
    c.vline(apex_x + 1, trunk_top, trunk_bottom, pal["woodDark"])
    height = base - top
    for y in range(top, base + 1):
        tier = (y - top) % 4
        w = idiv(half * (y - top), height) + (1 if tier == 3 else 0)
        lean = 1 if (y - top) < height // 2 else 0
        xl, xr = apex_x - w - lean, apex_x + 1 + w - lean
        for x in range(xl - 1, xr + 2):
            if x < xl or x > xr:
                if tier == 3:
                    c.put(x, y, pal["leafDark"])
                continue
            if tier == 3:
                value = pal["leafDark"]
            elif tier == 0:
                value = pal["leafHi"] if x <= apex_x - lean else pal["leafLight"]
            else:
                value = pal["leafLight"] if x < apex_x - lean else pal["leafMid"]
                if x >= xr - 1:
                    value = pal["leafDark"]
            c.put(x, y, value)
    c.put(apex_x - (1 if height > 4 else 0), top - 1, pal["leafMid"])


def prop_cedar_canopy(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(4, 10, 15, 15)
    canopy_cedar(c, pal, 7, 1, 11, 6, 11, 14)
    c.hline(6, 9, 14, pal["woodDark"])


def pine_pad(c: Canvas, pal: dict, x0: int, y0: int, x1: int, y1: int) -> None:
    c.ellipse(x0, y0, x1, y1, pal["leafDark"])
    c.ellipse(x0 + 1, y0, x1 - 1, y1 - 1, pal["leafMid"])
    c.ellipse(x0 + 1, y0, x1 - 2, y0 + (y1 - y0) // 2, pal["leafLight"])
    for x in range(x0 + 2, x1 - 1, 3):
        c.put(x, y0 + 1, pal["leafHi"])


def prop_pine_canopy(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(3, 11, 15, 15)
    c.line(8, 14, 7, 9, pal["woodMid"])
    c.line(9, 14, 8, 10, pal["woodDark"])
    c.line(7, 9, 4, 6, pal["woodDark"])
    c.line(8, 9, 11, 5, pal["woodDark"])
    pine_pad(c, pal, 0, 3, 8, 8)
    pine_pad(c, pal, 6, 0, 15, 5)
    pine_pad(c, pal, 4, 6, 12, 11)
    c.hline(7, 9, 14, pal["woodDark"])


def prop_stone_lantern(c: Canvas, pal: dict, fam: str) -> None:
    s0, s1, s2 = pal["stoneDark"], pal["stoneMid"], pal["stoneLight"]
    c.shadow_ellipse(6, 11, 15, 15)
    c.frame(3, 12, 12, 15, pal["outline"])
    c.rect(4, 13, 11, 14, s1)
    c.hline(4, 11, 13, s2)
    c.rect(6, 9, 9, 12, s1)
    c.vline(6, 9, 12, s2)
    c.vline(9, 9, 12, s0)
    c.vline(5, 9, 11, pal["outline"])
    c.vline(10, 9, 11, pal["outline"])
    c.rect(4, 7, 11, 8, s1)
    c.hline(4, 11, 7, s2)
    c.hline(4, 11, 8, s0)
    c.rect(5, 4, 10, 6, s1)
    c.rect(7, 4, 8, 5, pal["glow"])
    c.put(7, 6, pal["paper"])
    c.put(8, 6, pal["paper"])
    c.vline(5, 4, 6, s2)
    c.vline(10, 4, 6, s0)
    c.hline(2, 13, 3, s2)
    c.hline(3, 12, 2, s1)
    c.hline(5, 10, 1, s1)
    c.rect(7, 0, 8, 0, s2)
    c.put(13, 3, s0)
    c.put(12, 2, s0)
    c.outline_around(pal["outline"], (1, 0, 14, 12))


def prop_crates(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(5, 10, 15, 15)
    box3q(c, 7, 2, 7, 3, 5, pal["woodLight"], pal["woodMid"], pal["woodMid"], pal["woodDark"], pal["accentHi"] if fam == "castle" else pal["woodLight"], pal["outline"])
    box3q(c, 2, 7, 7, 3, 5, pal["woodLight"], pal["woodMid"], pal["woodMid"], pal["woodDark"], pal["accentHi"] if fam == "castle" else pal["woodLight"], pal["outline"])
    c.line(2, 10, 7, 13, pal["woodLight"])
    c.line(8, 5, 12, 8, pal["woodLight"])


def prop_rice_sacks(c: Canvas, pal: dict, fam: str) -> None:
    ramp = CHARCOAL if fam == "ash" else STRAW
    c.shadow_ellipse(3, 11, 15, 15)
    sack(c, 1, 8, 7, 13, ramp, pal["outline"], pal["woodDark"])
    sack(c, 8, 8, 14, 13, ramp, pal["outline"], pal["woodDark"])
    sack(c, 4, 3, 11, 8, ramp, pal["outline"], pal["woodDark"])


def prop_barrels(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(5, 10, 15, 15)
    barrel(c, 8, 1, pal)
    barrel(c, 2, 5, pal)


def prop_water_jar(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(5, 10, 15, 15)
    c.ellipse(2, 3, 13, 15, pal["outline"])
    c.ellipse(3, 4, 12, 14, pal["stoneMid"])
    c.ellipse(3, 4, 9, 11, pal["stoneLight"])
    c.ellipse(5, 6, 12, 14, pal["stoneMid"])
    c.ellipse(8, 9, 12, 14, pal["stoneDark"])
    c.ellipse(3, 1, 12, 6, pal["outline"])
    c.ellipse(4, 2, 11, 5, pal["stoneLight"])
    c.ellipse(5, 3, 10, 5, pal["roofDeep"])
    c.hline(6, 8, 4, pal["specialHi"] if fam in ("river", "village") else pal["metalHi"])
    c.rect(8, 2, 11, 4, pal["woodLight"])
    c.hline(8, 11, 4, pal["woodMid"])


def prop_firewood_stack(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(5, 11, 15, 15)
    roof_light = pal["roofLight"] if fam != "forge" else pal["metalMid"]
    roof_mid = pal["roofMid"] if fam != "forge" else pal["metalDark"]
    c.rect(1, 4, 14, 14, pal["outline"])
    c.rect(2, 5, 13, 13, pal["woodDark"])
    logs = ((2, 5), (6, 5), (10, 5), (4, 8), (8, 8), (2, 11), (6, 11), (10, 11))
    for x, y in logs:
        c.rect(x, y, x + 3, y + 2, pal["woodLight"])
        c.put(x, y, pal["woodMid"])
        c.put(x + 3, y + 2, pal["woodMid"])
        c.rect(x + 1, y + 1, x + 2, y + 1, pal["paper"])
    c.points(((2, 8), (3, 9), (12, 8), (13, 9)), pal["woodMid"])
    c.hline(0, 15, 2, roof_light)
    c.hline(1, 14, 3, roof_mid)
    c.hline(1, 14, 1, pal["outline"])
    c.vline(1, 4, 14, pal["woodMid"])
    c.vline(14, 4, 14, pal["woodDark"])


def prop_fire_bell_frame(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(5, 11, 15, 15)
    post = pal["woodMid"]
    c.vline(2, 3, 14, pal["outline"])
    c.vline(3, 3, 14, post)
    c.vline(12, 3, 14, post)
    c.vline(13, 3, 14, pal["outline"])
    c.hline(2, 13, 3, pal["woodLight"])
    c.hline(1, 14, 1, pal["roofLight"] if fam != "engine" else pal["metalMid"])
    c.hline(1, 14, 2, pal["roofMid"] if fam != "engine" else pal["metalDark"])
    c.hline(2, 13, 0, pal["outline"])
    c.put(1, 2, pal["outline"])
    c.put(14, 2, pal["outline"])
    c.vline(7, 4, 4, pal["woodDark"])
    bronze = (pal["metalHi"], pal["metalMid"], pal["metalDark"])
    if fam == "engine":
        bronze = (pal["woodLight"], pal["woodMid"], pal["woodDark"])
    c.rect(6, 5, 9, 5, bronze[1])
    c.rect(5, 6, 10, 9, bronze[1])
    c.vline(5, 6, 9, bronze[0])
    c.vline(6, 5, 9, bronze[0])
    c.vline(10, 6, 9, bronze[2])
    c.hline(4, 11, 10, bronze[0])
    c.hline(4, 11, 11, bronze[2])
    c.outline_around(pal["outline"], (3, 4, 12, 12))
    c.hline(3, 12, 14, pal["woodDark"])


def prop_hydrangea_shrub(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(4, 10, 15, 15)
    c.ellipse(1, 3, 14, 14, pal["leafDark"])
    c.ellipse(2, 3, 13, 12, pal["leafMid"])
    c.ellipse(2, 3, 10, 8, pal["leafLight"])
    for cx, cy in ((4, 5), (9, 4), (11, 8), (5, 9), (8, 11)):
        c.rect(cx - 1, cy - 1, cx + 1, cy + 1, pal["special"])
        c.put(cx - 1, cy - 1, pal["specialHi"])
        c.put(cx + 1, cy + 1, pal["fabric"])
    c.put(7, 7, pal["leafHi"])
    c.put(3, 7, pal["leafHi"])


def prop_boulder(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(4, 10, 15, 15)
    c.ellipse(1, 3, 14, 14, pal["outline"])
    c.ellipse(2, 4, 13, 13, pal["stoneMid"])
    c.ellipse(2, 4, 9, 9, pal["stoneLight"])
    c.ellipse(6, 8, 13, 13, pal["stoneDark"])
    c.ellipse(5, 6, 11, 11, pal["stoneMid"])
    c.line(6, 6, 9, 9, pal["stoneDark"])
    c.line(9, 9, 12, 8, pal["stoneDark"])
    c.put(4, 5, pal["stoneLight"])
    if fam in ("village", "river"):
        c.points(((4, 4), (5, 4), (6, 5), (3, 6)), pal["leafLight"])
    elif fam == "ash":
        c.points(((4, 4), (5, 5), (8, 5), (10, 6)), pal["specialHi"])
    elif fam == "forge":
        c.points(((8, 10), (10, 11)), pal["accentHi"])
        c.put(9, 10, pal["paper"])


def prop_notice_board(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(5, 11, 15, 15)
    c.vline(3, 9, 14, pal["woodDark"])
    c.vline(12, 9, 14, pal["woodDark"])
    c.rect(1, 3, 14, 10, pal["outline"])
    c.rect(2, 4, 13, 9, pal["woodMid"])
    c.rect(3, 4, 12, 8, pal["woodLight"])
    c.hline(0, 15, 2, pal["roofLight"] if fam != "castle" else pal["accentHi"])
    c.hline(1, 14, 1, pal["roofMid"])
    c.hline(2, 13, 0, pal["outline"])
    c.rect(4, 5, 6, 8, pal["paper"])
    c.rect(8, 5, 11, 7, pal["paper"])
    c.vline(6, 5, 8, pal["wallDark"] if fam not in ("castle", "engine") else pal["metalDark"])
    c.vline(11, 5, 7, pal["wallDark"] if fam not in ("castle", "engine") else pal["metalDark"])
    c.put(5, 5, pal["accentHi"])


def prop_handcart(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(3, 11, 15, 15)
    c.vline(5, 11, 15, pal["woodMid"])
    c.vline(10, 11, 15, pal["woodMid"])
    c.rect(2, 5, 13, 11, pal["outline"])
    c.rect(3, 6, 12, 9, pal["woodLight"])
    c.hline(3, 12, 8, pal["woodMid"])
    c.hline(3, 12, 10, pal["woodDark"])
    ramp = CHARCOAL if fam in ("ash", "forge") else STRAW
    sack(c, 4, 2, 10, 6, ramp, pal["outline"], pal["woodDark"])
    for x in (1, 13):
        c.rect(x, 7, x + 1, 13, pal["outline"])
        c.vline(x + (1 if x == 1 else 0), 8, 12, pal["woodDark"])
        c.put(x + (1 if x == 1 else 0), 10, pal["woodLight"])


def prop_net_rack(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(4, 13, 15, 15)
    c.vline(2, 2, 14, pal["woodMid"])
    c.vline(13, 2, 14, pal["woodMid"])
    c.vline(3, 3, 14, pal["woodDark"])
    c.vline(14, 3, 14, pal["woodDark"])
    c.hline(1, 14, 2, pal["woodLight"])
    c.hline(1, 14, 1, pal["outline"])
    for y in range(3, 13):
        sag = 1 if 6 <= y else 0
        for x in range(4, 13):
            if (x + y) % 3 == 0 or (x - y) % 3 == 0:
                if not (y == 12 and x in (4, 12)):
                    c.put(x, y + (sag if 6 <= x <= 10 and y > 10 else 0), pal["metalMid"])
    for x in (5, 8, 11):
        c.put(x, 13, pal["paper"])
    c.hline(4, 12, 3, pal["metalHi"])


def prop_beached_skiff(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(3, 9, 15, 15)
    rows = {5: (4, 13), 6: (2, 14), 7: (1, 14), 8: (1, 14), 9: (2, 14), 10: (4, 13)}
    for y, (xa, xb) in rows.items():
        c.hline(xa, xb, y, pal["woodLight"])
    for y, (xa, xb) in rows.items():
        if y in (5, 10):
            continue
        c.hline(xa + 1, xb - 1, y, pal["woodDark"] if y >= 8 else pal["woodMid"])
    for x in (6, 10):
        c.vline(x, 6, 9, pal["woodLight"])
    c.hline(4, 13, 10, pal["woodMid"])
    c.put(13, 7, pal["woodLight"])
    c.put(13, 8, pal["woodLight"])
    c.outline_around(pal["outline"], (0, 3, 15, 12))
    c.put(0, 7, pal["outline"])
    c.put(0, 8, pal["outline"])


def prop_ash_cairn(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(4, 11, 15, 15)
    for x0, y0, x1, y1 in ((2, 10, 13, 14), (3, 7, 12, 11), (4, 4, 11, 8), (6, 1, 9, 5)):
        c.ellipse(x0 - 1, y0 - 1, x1 + 1, y1 + 1, pal["outline"])
        c.ellipse(x0, y0, x1, y1, pal["stoneMid"])
        c.hline(x0 + 2, x1 - 2, y0, pal["stoneLight"])
        c.hline(x0 + 1, x1 - 1, y1, pal["stoneDark"])
    c.points(((7, 1), (5, 4), (9, 4), (4, 7), (10, 7), (6, 10), (11, 10)), pal["specialHi"])
    c.points(((8, 2), (8, 5), (3, 10)), pal["special"])


def prop_lacquer_screen(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(4, 13, 15, 15)
    for i in range(4):
        x0 = 1 + i * 3 + (1 if i else 0)
        top = 3 if i % 2 == 0 else 4
        bottom = 13 if i % 2 == 0 else 12
        c.rect(x0, top, x0 + 2, bottom, pal["outline"])
        face = pal["metalMid"] if i % 2 == 0 else pal["metalDark"]
        c.rect(x0, top + 1, x0 + 2, bottom - 1, face)
        c.hline(x0, x0 + 2, top, pal["accentHi"])
        c.put(x0 + (0 if i % 2 == 0 else 2), top + 2, pal["metalHi"] if i % 2 == 0 else pal["roofLight"])
    c.hline(1, 14, 2, pal["outline"])
    c.put(1, 2, None)


def prop_registry_desk(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(4, 11, 15, 15)
    top = pal["woodLight"] if fam not in ("castle",) else pal["woodMid"]
    box3q(c, 2, 6, 12, 5, 2, top, top, pal["woodMid"] if fam != "castle" else pal["woodDark"], pal["woodDark"],
          pal["accentHi"] if fam == "castle" else pal["woodLight"], pal["outline"])
    c.vline(3, 14, 14, pal["outline"])
    c.vline(12, 14, 14, pal["outline"])
    c.rect(4, 4, 8, 8, pal["outline"])
    c.rect(4, 5, 8, 7, pal["paper"])
    c.hline(4, 8, 4, pal["glow"] if fam != "engine" else pal["paper"])
    c.vline(4, 5, 8, pal["accent"])
    c.hline(5, 8, 8, pal["wallDark"] if fam not in ("castle", "engine") else pal["metalDark"])
    c.rect(10, 7, 11, 8, pal["roofDeep"])
    c.put(10, 7, pal["roofHi"])
    c.line(9, 10, 12, 9, pal["woodDark"])


def prop_prisoner_lattice(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(4, 14, 15, 15)
    frame = pal["woodMid"] if fam not in ("forge",) else pal["metalMid"]
    hi = pal["woodLight"] if fam not in ("forge",) else pal["metalHi"]
    for x in (2, 13):
        c.vline(x, 2, 14, frame)
    c.vline(1, 2, 14, pal["outline"])
    c.vline(14, 2, 14, pal["outline"])
    c.hline(1, 14, 2, hi)
    c.hline(1, 14, 1, pal["outline"])
    c.hline(2, 13, 14, frame)
    for x in (4, 6, 8, 10, 12):
        c.vline(x, 3, 13, frame)
        c.put(x, 3, hi)
    for y in (7, 11):
        c.hline(3, 12, y, frame)
    c.put(8, 9, pal["metalHi"] if fam != "forge" else pal["glow"])


def prop_scroll_shelf(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(5, 11, 15, 15)
    c.rect(1, 2, 14, 14, pal["outline"])
    c.rect(2, 3, 13, 4, pal["accentHi"])
    c.rect(2, 5, 13, 13, pal["accent"])
    for y in (5, 9):
        c.rect(3, y, 12, y + 2, pal["roofDeep"])
        for x in range(3, 12, 3):
            c.rect(x, y + 1, x + 1, y + 2, pal["paper"])
            c.put(x, y + 1, pal["glow"])
        c.hline(2, 13, y + 3, pal["accentHi"])


def prop_forge_anvil(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(4, 11, 15, 15)
    c.rect(4, 9, 11, 14, pal["outline"])
    c.rect(5, 10, 10, 14, pal["woodMid"])
    c.vline(5, 10, 14, pal["woodLight"])
    c.vline(10, 10, 14, pal["woodDark"])
    c.rect(3, 4, 12, 8, pal["outline"])
    c.rect(4, 5, 11, 7, pal["metalMid"])
    c.hline(4, 11, 5, pal["metalHi"])
    c.hline(4, 11, 7, pal["metalDark"])
    c.rect(1, 5, 3, 6, pal["metalMid"])
    c.put(1, 5, pal["metalHi"])
    c.hline(0, 3, 4, pal["outline"])
    c.hline(0, 2, 7, pal["outline"])
    c.put(0, 5, pal["outline"])
    c.rect(6, 8, 9, 8, pal["metalDark"])
    if fam == "forge":
        c.put(9, 5, pal["glow"])
        c.put(10, 5, pal["paper"])


def prop_coal_bin(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(5, 11, 15, 15)
    box3q(c, 2, 4, 12, 5, 5, pal["roofDeep"], pal["roofDeep"], pal["woodMid"], pal["woodDark"], pal["woodLight"], pal["outline"])
    for x, y in ((3, 5), (6, 6), (9, 5), (11, 7), (4, 7), (8, 8)):
        c.put(x, y, pal["metalHi"])
        c.put(x + 1, y, pal["roofMid"])
    c.hline(2, 13, 11, pal["woodLight"])
    if fam == "forge":
        c.put(7, 6, pal["glow"])


def prop_gear_housing(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(4, 11, 15, 15)
    box3q(c, 2, 6, 12, 4, 4, pal["metalMid"], pal["metalMid"], pal["wallMid"], pal["wallDark"], pal["metalHi"], pal["outline"])
    cx, cy = 7, 5
    for y in range(cy - 4, cy + 4):
        for x in range(cx - 5, cx + 7):
            if in_ellipse(x, y, cx - 5, cy - 4, cx + 6, cy + 3) and not in_ellipse(x, y, cx - 4, cy - 3, cx + 5, cy + 2):
                if (x + y) % 2 == 0:
                    c.put(x, y, pal["woodDark"])
    c.ellipse(cx - 4, cy - 3, cx + 5, cy + 2, pal["woodMid"])
    c.ellipse(cx - 4, cy - 3, cx + 2, cy, pal["woodLight"])
    c.ellipse(cx - 1, cy - 1, cx + 2, cy + 1, pal["roofDeep"])
    c.put(cx, cy - 1, pal["accentHi"])
    c.hline(4, 11, 12, pal["roofHi"])


def prop_pipe_valve(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_ellipse(5, 11, 15, 15)
    c.rect(4, 12, 11, 14, pal["outline"])
    c.rect(5, 12, 10, 13, pal["metalMid"])
    c.hline(5, 10, 12, pal["metalHi"])
    c.rect(5, 4, 10, 12, pal["outline"])
    for x, value in zip(range(6, 10), (pal["woodLight"], pal["woodMid"], pal["woodMid"], pal["woodDark"])):
        c.vline(x, 4, 11, value)
    c.hline(5, 10, 8, pal["woodDark"])
    c.hline(5, 10, 9, pal["woodLight"])
    c.rect(10, 6, 14, 8, pal["outline"])
    c.hline(11, 14, 7, pal["woodMid"])
    c.hline(11, 14, 6, pal["woodLight"])
    c.ellipse(3, 0, 12, 4, pal["outline"])
    c.ellipse(4, 1, 11, 3, pal["metalMid"])
    c.ellipse(6, 1, 9, 3, None)
    c.ellipse(6, 1, 9, 3, pal["roofDeep"])
    c.hline(4, 11, 2, pal["metalMid"])
    c.put(4, 1, pal["metalHi"])
    c.rect(7, 2, 8, 2, pal["accentHi"])


PROP_DRAWERS = {
    "cedar-canopy": prop_cedar_canopy,
    "pine-canopy": prop_pine_canopy,
    "stone-lantern": prop_stone_lantern,
    "crates": prop_crates,
    "rice-sacks": prop_rice_sacks,
    "barrels": prop_barrels,
    "water-jar": prop_water_jar,
    "firewood-stack": prop_firewood_stack,
    "fire-bell-frame": prop_fire_bell_frame,
    "hydrangea-shrub": prop_hydrangea_shrub,
    "boulder": prop_boulder,
    "notice-board": prop_notice_board,
    "handcart": prop_handcart,
    "net-rack": prop_net_rack,
    "beached-skiff": prop_beached_skiff,
    "ash-cairn": prop_ash_cairn,
    "lacquer-screen": prop_lacquer_screen,
    "registry-desk": prop_registry_desk,
    "prisoner-lattice": prop_prisoner_lattice,
    "scroll-shelf": prop_scroll_shelf,
    "forge-anvil": prop_forge_anvil,
    "coal-bin": prop_coal_bin,
    "gear-housing": prop_gear_housing,
    "pipe-valve": prop_pipe_valve,
}


def draw_prop(fam: str, pal: dict, name: str) -> Image.Image:
    c = Canvas(CELL, CELL)
    PROP_DRAWERS[name](c, pal, fam)
    return c.image


def wide_drying_rack(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(4, 14, 31, 15)
    for x in (2, 16, 29):
        c.vline(x, 2, 14, pal["woodMid"])
        c.vline(x + 1, 3, 14, pal["woodDark"])
    c.hline(1, 30, 2, pal["woodLight"])
    c.hline(1, 30, 1, pal["outline"])
    c.hline(1, 30, 7, pal["woodLight"])
    c.hline(1, 30, 6, pal["outline"])
    if fam == "river":
        for y in range(3, 13):
            for x in range(4, 28):
                if x in (16, 17):
                    continue
                if ((x + y) % 3 == 0 or (x - y) % 3 == 0) and y != 7:
                    c.put(x, y, pal["metalMid"])
        for x in range(5, 28, 4):
            c.put(x, 13, pal["paper"])
    else:
        for x in range(4, 28, 3):
            if x in (16, 17):
                continue
            for top in (3, 8):
                length = 3 if top == 3 else 5
                c.vline(x, top, top + length - 1, STRAW[1])
                c.vline(x + 1, top, top + length - 1, STRAW[0] if (x // 3) % 2 else STRAW[2])
                c.put(x, top, STRAW[3])


def wide_lumber_stack(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(6, 13, 31, 15)
    for row, (y, x0, x1) in enumerate(((10, 1, 29), (7, 1, 29), (4, 3, 26))):
        c.rect(x0 - 1, y - 1, x1 + 1, y + 3, pal["outline"])
        c.hline(x0, x1, y, pal["woodLight"])
        c.rect(x0, y + 1, x1, y + 2, pal["woodMid"])
        c.hline(x0 + 2, x1, y + 2, pal["woodDark"])
        for x in range(x0 + 3 + row * 2, x1, 9):
            c.put(x, y + 1, pal["woodDark"])
        c.rect(x0, y, x0 + 2, y + 2, pal["woodLight"])
        c.put(x0 + 1, y + 1, pal["paper"])
    for x in (4, 25):
        c.rect(x, 13, x + 1, 14, pal["woodDark"])


def wide_cargo_stack(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(5, 13, 31, 15)
    edge = pal["accentHi"] if fam == "castle" else pal["woodLight"]
    top = pal["metalMid"] if fam == "engine" else pal["woodLight"]
    front = pal["wallMid"] if fam == "engine" else pal["woodMid"]
    box3q(c, 2, 6, 8, 3, 6, top, front, front, pal["woodDark"] if fam != "engine" else pal["wallDark"], edge, pal["outline"])
    box3q(c, 12, 3, 8, 3, 5, top, front, front, pal["woodDark"] if fam != "engine" else pal["wallDark"], edge, pal["outline"])
    box3q(c, 12, 10, 9, 2, 3, top, front, front, pal["woodDark"] if fam != "engine" else pal["wallDark"], edge, pal["outline"])
    if fam in ("archive", "castle", "engine"):
        barrel(c, 23, 4, pal)
    else:
        sack(c, 23, 6, 29, 12, STRAW, pal["outline"], pal["woodDark"])
        sack(c, 24, 1, 29, 6, STRAW, pal["outline"], pal["woodDark"])
    c.line(2, 9, 8, 13, edge)


def wide_market_stall(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(4, 14, 31, 15)
    c.vline(2, 5, 14, pal["woodDark"])
    c.vline(29, 5, 14, pal["woodDark"])
    c.rect(1, 9, 30, 13, pal["outline"])
    c.hline(2, 29, 9, pal["woodLight"])
    c.rect(2, 10, 29, 12, pal["woodMid"])
    c.hline(2, 29, 12, pal["woodDark"])
    for x, value in ((4, STRAW[1]), (8, pal["leafLight"]), (12, pal["stoneLight"]), (17, STRAW[0]),
                     (21, pal["leafHi"]), (25, pal["accentHi"])):
        c.rect(x, 7, x + 2, 8, value)
        c.put(x, 7, pal["paper"])
        c.hline(x, x + 2, 9, pal["woodDark"])
    c.rect(0, 0, 31, 5, pal["outline"])
    for x in range(1, 31):
        stripe = (x // 4) % 2 == 0
        c.vline(x, 1, 4, pal["fabricHi"] if stripe else pal["paper"])
        c.put(x, 1, pal["fabric"] if stripe else pal["wallLight"])
    for x in range(1, 31):
        if x % 4 in (1, 2):
            c.put(x, 5, pal["fabricHi"] if (x // 4) % 2 == 0 else pal["paper"])
            c.put(x, 6, pal["outline"])


def wide_freight_cart(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(4, 14, 31, 15)
    c.rect(26, 8, 31, 9, pal["woodMid"])
    c.hline(26, 31, 10, pal["woodDark"])
    c.rect(1, 3, 26, 11, pal["outline"])
    c.rect(2, 4, 25, 9, pal["woodLight"])
    for x in range(2, 26, 4):
        c.vline(x, 4, 9, pal["woodMid"])
    c.hline(2, 25, 10, pal["woodDark"])
    ramp = CHARCOAL if fam in ("ash", "forge") else STRAW
    if fam == "forge":
        for x, y in ((4, 2), (9, 1), (14, 2), (19, 1)):
            c.ellipse(x, y, x + 5, y + 4, pal["outline"])
            c.ellipse(x + 1, y + 1, x + 4, y + 3, pal["stoneMid"])
            c.put(x + 2, y + 1, pal["stoneLight"])
            c.put(x + 3, y + 3, pal["accent"])
    else:
        sack(c, 4, 2, 10, 7, ramp, pal["outline"], pal["woodDark"])
        sack(c, 12, 2, 18, 7, ramp, pal["outline"], pal["woodDark"])
        box3q(c, 20, 2, 5, 2, 4, pal["woodLight"], pal["woodMid"], pal["woodMid"], pal["woodDark"], pal["woodLight"], pal["outline"])
    for x in (5, 19):
        c.ellipse(x - 1, 9, x + 5, 15, pal["outline"])
        c.ellipse(x, 10, x + 4, 14, pal["woodMid"])
        c.rect(x + 2, 10, x + 2, 14, pal["woodDark"])
        c.hline(x, x + 4, 12, pal["woodDark"])
        c.put(x + 2, 12, pal["woodLight"])


def wide_checkpoint_barrier(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(4, 14, 31, 15)
    for x in (2, 15, 28):
        c.rect(x - 1, 3, x + 2, 14, pal["outline"])
        c.rect(x, 4, x + 1, 14, pal["woodMid"])
        c.vline(x, 4, 14, pal["woodLight"])
        c.hline(x - 1, x + 2, 3, pal["metalMid"])
    for y in (6, 10):
        c.rect(0, y - 1, 31, y + 1, pal["outline"])
        for x in range(0, 32):
            band = (x // 5) % 2 == 0
            c.put(x, y, pal["accentHi"] if band else pal["woodLight"])
            c.put(x, y + 1 if y + 1 < 16 else y, pal["accent"] if band else pal["woodMid"])
    for x in (2, 15, 28):
        c.rect(x, 5, x + 1, 5, pal["woodMid"])
        c.rect(x, 8, x + 1, 9, pal["woodMid"])
        c.vline(x, 8, 9, pal["woodLight"])


def wide_long_shelf(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(4, 14, 31, 15)
    c.rect(1, 2, 30, 14, pal["outline"])
    c.rect(2, 3, 29, 4, pal["accentHi"])
    c.rect(2, 5, 29, 13, pal["accent"])
    for y in (5, 9):
        c.rect(3, y, 28, y + 2, pal["roofDeep"])
        for x in range(3, 28, 3):
            if (x // 3 + y) % 4 == 0:
                c.rect(x, y, x + 2, y + 2, pal["woodLight"])
                c.put(x, y, pal["glow"])
                continue
            c.rect(x, y + 1, x + 1, y + 2, pal["paper"])
            c.put(x, y + 1, pal["glow"])
        c.hline(2, 29, y + 3, pal["accentHi"])
    c.vline(15, 5, 13, pal["accentHi"])


def wide_quench_trough(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(4, 13, 31, 15)
    box3q(c, 2, 4, 28, 5, 5, pal["stoneLight"], pal["stoneMid"], pal["stoneMid"], pal["stoneDark"], pal["stoneLight"], pal["outline"])
    c.rect(4, 5, 27, 7, pal["roofDeep"])
    c.hline(6, 12, 6, pal["metalHi"])
    c.hline(18, 21, 5, pal["metalMid"])
    c.line(22, 1, 28, 7, pal["metalMid"])
    c.line(23, 1, 29, 7, pal["metalDark"])
    c.put(22, 1, pal["metalHi"])
    for x in range(4, 28, 6):
        c.vline(x, 10, 12, pal["stoneDark"])


def wide_bellows_machine(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(4, 13, 31, 15)
    c.rect(1, 4, 20, 14, pal["outline"])
    for x in range(2, 20):
        pleat = (x // 2) % 2 == 0
        c.vline(x, 5, 12, pal["woodMid"] if pleat else pal["woodDark"])
        c.put(x, 5, pal["woodLight"] if pleat else pal["woodMid"])
    c.hline(2, 19, 13, pal["metalMid"])
    c.rect(2, 3, 19, 4, pal["metalMid"])
    c.hline(2, 19, 3, pal["metalHi"])
    c.rect(21, 7, 30, 10, pal["outline"])
    c.hline(21, 29, 8, pal["woodLight"])
    c.hline(21, 29, 9, pal["woodMid"])
    c.rect(26, 2, 30, 13, pal["outline"])
    c.rect(27, 3, 29, 12, pal["wallMid"])
    c.vline(27, 3, 12, pal["wallLight"])
    c.rect(28, 6, 28, 9, pal["accentHi"])
    c.put(28, 7, pal["accent"])
    c.hline(27, 29, 12, pal["wallDark"])


def wide_rock_pile(c: Canvas, pal: dict, fam: str) -> None:
    c.shadow_rect(5, 13, 31, 15)
    for x0, y0, x1, y1 in ((1, 6, 12, 14), (10, 3, 22, 13), (20, 7, 30, 14), (14, 9, 21, 14)):
        c.ellipse(x0 - 1, y0 - 1, x1 + 1, y1 + 1, pal["outline"])
        c.ellipse(x0, y0, x1, y1, pal["stoneMid"])
        c.ellipse(x0, y0, x0 + (x1 - x0) * 2 // 3, y0 + (y1 - y0) // 2, pal["stoneLight"])
        c.ellipse(x0 + (x1 - x0) // 2, y0 + (y1 - y0) // 2, x1, y1, pal["stoneDark"])
    for x, y in ((4, 7), (13, 4), (16, 4), (23, 8), (6, 8), (26, 9)):
        c.put(x, y, pal["specialHi"] if fam == "ash" else pal["leafLight"])


WIDE_DRAWERS = {
    "drying-rack": wide_drying_rack,
    "lumber-stack": wide_lumber_stack,
    "cargo-stack": wide_cargo_stack,
    "market-stall": wide_market_stall,
    "freight-cart": wide_freight_cart,
    "checkpoint-barrier": wide_checkpoint_barrier,
    "long-shelf": wide_long_shelf,
    "quench-trough": wide_quench_trough,
    "bellows-machine": wide_bellows_machine,
    "rock-pile": wide_rock_pile,
}


def draw_wide(fam: str, pal: dict, name: str) -> Image.Image:
    c = Canvas(CELL * 2, CELL)
    WIDE_DRAWERS[name](c, pal, fam)
    return c.image


# ---------------------------------------------------------------------------
# Shared tall props (1 x 2 cells, 16 x 32)
# ---------------------------------------------------------------------------

def tall_cedar(c: Canvas, t: dict) -> None:
    c.shadow_ellipse(5, 25, 15, 31)
    leaf = {"leafDark": t["leafDark"], "leafMid": t["leafMid"], "leafLight": t["leafLight"], "leafHi": t["leafHi"],
            "woodMid": t["woodMid"], "woodDark": t["woodDark"]}
    canopy_cedar(c, leaf, 7, 1, 25, 7, 24, 29)
    c.hline(6, 9, 29, t["woodDark"])
    c.put(7, 0, t["leafMid"])


def tall_pine(c: Canvas, t: dict) -> None:
    c.shadow_ellipse(4, 26, 15, 31)
    c.line(8, 29, 9, 22, t["woodMid"])
    c.line(9, 22, 6, 14, t["woodMid"])
    c.line(6, 14, 8, 6, t["woodMid"])
    c.line(9, 29, 10, 22, t["woodDark"])
    c.line(10, 22, 7, 14, t["woodDark"])
    c.line(7, 14, 9, 6, t["woodDark"])
    c.line(7, 10, 3, 8, t["woodDark"])
    c.line(8, 17, 12, 14, t["woodDark"])
    c.line(9, 21, 4, 20, t["woodDark"])
    pal = {"leafDark": t["pineDark"], "leafMid": t["pineMid"], "leafLight": t["pineLight"], "leafHi": t["pineHi"]}
    pine_pad(c, pal, 0, 4, 9, 10)
    pine_pad(c, pal, 5, 0, 14, 6)
    pine_pad(c, pal, 8, 10, 15, 16)
    pine_pad(c, pal, 0, 16, 8, 21)
    pine_pad(c, pal, 6, 19, 13, 23)
    c.hline(7, 10, 29, t["woodDark"])


def tall_dead_pine(c: Canvas, t: dict) -> None:
    c.shadow_ellipse(4, 26, 15, 31)
    for dx in (0, 1):
        c.line(7 + dx, 29, 8 + dx, 20, t["deadMid"] if dx == 0 else t["deadDark"])
        c.line(8 + dx, 20, 6 + dx, 10, t["deadMid"] if dx == 0 else t["deadDark"])
        c.line(6 + dx, 10, 7 + dx, 2, t["deadMid"] if dx == 0 else t["deadDark"])
    c.vline(7, 21, 28, t["deadLight"])
    for a, b in (((7, 8), (2, 5)), ((7, 13), (12, 9)), ((8, 18), (3, 15)), ((8, 22), (13, 19)), ((7, 5), (11, 2))):
        c.line(a[0], a[1], b[0], b[1], t["deadDark"])
        c.put(b[0], b[1], t["deadLight"])
    for x0, y0 in ((1, 3), (10, 7), (2, 13), (11, 17)):
        c.rect(x0, y0, x0 + 3, y0 + 1, t["deadLight"])
        c.put(x0, y0, t["ash"])
        c.put(x0 + 2, y0 + 1, t["deadDark"])
    c.points(((6, 2), (8, 11), (9, 20), (3, 6), (12, 10)), t["ash"])
    c.hline(6, 10, 29, t["deadDark"])


def tall_watch_post(c: Canvas, t: dict) -> None:
    c.shadow_rect(4, 28, 15, 31)
    for x in (3, 12):
        c.vline(x, 11, 30, t["woodMid"])
        c.vline(x + 1, 12, 30, t["woodDark"])
    c.line(4, 14, 11, 21, t["woodDark"])
    c.line(11, 14, 4, 21, t["woodDark"])
    c.line(4, 22, 11, 29, t["woodDark"])
    c.line(11, 22, 4, 29, t["woodDark"])
    c.rect(1, 8, 14, 11, t["outline"])
    c.hline(2, 13, 8, t["woodHi"])
    c.rect(2, 9, 13, 10, t["woodLight"])
    c.hline(2, 13, 10, t["woodMid"])
    c.vline(2, 5, 8, t["woodMid"])
    c.vline(13, 5, 8, t["woodDark"])
    c.rect(6, 6, 8, 7, t["glow"])
    c.put(7, 7, t["paper"])
    c.rect(0, 1, 15, 4, t["outline"])
    c.hline(1, 14, 2, t["roofLight"])
    c.hline(1, 14, 3, t["roofMid"])
    c.hline(2, 13, 4, t["roofDark"])
    c.hline(5, 10, 1, t["roofMid"])
    c.hline(5, 10, 0, t["outline"])


def tall_fire_bell_tower(c: Canvas, t: dict) -> None:
    c.shadow_rect(4, 28, 15, 31)
    c.vline(5, 10, 30, t["woodMid"])
    c.vline(10, 10, 30, t["woodMid"])
    c.vline(4, 10, 30, t["outline"])
    c.vline(11, 10, 30, t["woodDark"])
    for y in range(12, 30, 3):
        c.hline(6, 9, y, t["woodLight"])
    c.rect(1, 8, 14, 10, t["outline"])
    c.hline(2, 13, 8, t["woodHi"])
    c.hline(2, 13, 9, t["woodLight"])
    c.vline(2, 3, 8, t["woodMid"])
    c.vline(13, 3, 8, t["woodDark"])
    c.rect(6, 3, 9, 3, t["bronzeMid"])
    c.rect(5, 4, 10, 6, t["bronzeMid"])
    c.vline(5, 4, 6, t["bronzeHi"])
    c.vline(6, 3, 6, t["bronzeLight"])
    c.vline(10, 4, 6, t["bronzeDark"])
    c.hline(4, 11, 7, t["bronzeLight"])
    c.rect(0, 0, 15, 2, t["outline"])
    c.hline(1, 14, 1, t["roofLight"])
    c.hline(2, 13, 2, t["roofMid"])


def tall_chimney(c: Canvas, t: dict) -> None:
    c.shadow_ellipse(6, 26, 15, 31)
    c.rect(3, 4, 12, 30, t["outline"])
    for y in range(5, 30):
        for x in range(4, 12):
            course, step = divmod(y, 2)
            if step == 1 or (x + (2 if course % 2 else 0)) % 4 == 0:
                value = t["brickDark"]
            else:
                value = t["brickMid"]
            if x == 4 and step == 0:
                value = t["brickLight"]
            if x == 11:
                value = t["brickDark"]
            c.put(x, y, value)
    c.rect(2, 26, 13, 30, t["outline"])
    c.rect(3, 27, 12, 29, t["brickMid"])
    c.hline(3, 12, 27, t["brickLight"])
    c.ellipse(2, 1, 13, 7, t["outline"])
    c.ellipse(3, 2, 12, 6, t["brickLight"])
    c.ellipse(4, 3, 11, 6, t["ironDark"])
    c.ellipse(5, 3, 10, 5, t["ember"])
    c.rect(6, 4, 8, 4, t["emberHi"])
    for y in (10, 18):
        c.hline(4, 11, y, t["ironMid"])
        c.put(4, y, t["ironHi"])


def tall_pipe_stack(c: Canvas, t: dict) -> None:
    c.shadow_rect(4, 28, 15, 31)
    for x0, top in ((1, 5), (5, 1), (9, 8)):
        c.rect(x0, top, x0 + 4, 26, t["outline"])
        for i, value in enumerate((t["bronzeHi"], t["bronzeLight"], t["bronzeMid"])):
            c.vline(x0 + 1 + i, top + 2, 25, value)
        c.ellipse(x0, top, x0 + 4, top + 2, t["outline"])
        c.hline(x0 + 1, x0 + 3, top + 1, t["ironDark"])
        for y in range(top + 6, 25, 7):
            c.hline(x0 + 1, x0 + 3, y, t["ironLight"])
    c.rect(0, 22, 15, 30, t["outline"])
    c.rect(1, 23, 14, 29, t["ironMid"])
    c.hline(1, 14, 23, t["ironHi"])
    c.hline(1, 14, 29, t["ironDark"])
    c.rect(5, 26, 10, 26, t["crimson"])
    c.put(7, 26, t["vermilion"])
    for x in (2, 13):
        c.put(x, 25, t["ironHi"])


def tall_lacquer_lantern(c: Canvas, t: dict) -> None:
    c.shadow_ellipse(5, 26, 15, 31)
    c.rect(4, 26, 11, 30, t["outline"])
    c.rect(5, 27, 10, 29, t["lacquerLight"])
    c.hline(5, 10, 27, t["gold"])
    c.rect(6, 11, 9, 26, t["outline"])
    c.vline(7, 12, 26, t["lacquerLight"])
    c.vline(8, 12, 26, t["lacquerMid"])
    for y in (15, 21):
        c.hline(7, 8, y, t["vermilion"])
    c.rect(3, 4, 12, 11, t["outline"])
    c.rect(4, 5, 11, 10, t["lacquerMid"])
    c.rect(5, 5, 7, 9, t["glow"])
    c.rect(8, 5, 10, 9, t["paper"])
    c.vline(7, 5, 9, t["lacquerDark"])
    c.hline(4, 11, 10, t["vermilionDark"])
    c.rect(1, 2, 14, 3, t["outline"])
    c.hline(2, 13, 2, t["vermilion"])
    c.hline(2, 13, 3, t["lacquerDark"])
    c.rect(6, 0, 9, 1, t["outline"])
    c.hline(7, 8, 0, t["gold"])
    c.hline(7, 8, 1, t["gold"])


TALL_DRAWERS = {
    "cedar": tall_cedar,
    "pine": tall_pine,
    "dead-pine": tall_dead_pine,
    "watch-post": tall_watch_post,
    "fire-bell-tower": tall_fire_bell_tower,
    "chimney": tall_chimney,
    "pipe-stack": tall_pipe_stack,
    "lacquer-lantern": tall_lacquer_lantern,
}


def draw_tall(name: str, tall_palette: dict) -> Image.Image:
    c = Canvas(CELL, CELL * 2)
    TALL_DRAWERS[name](c, tall_palette)
    return c.image


# ---------------------------------------------------------------------------
# Atlas assembly, validation, contact sheet, manifest
# ---------------------------------------------------------------------------

def load_source() -> dict:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    if source.get("authorship") != "original-code-native-pixel-primitives":
        raise ValueError("Field props must retain code-native authorship")
    geometry = source["geometry"]
    if geometry != {"cell": 16, "columns": 16, "familyBandRows": 3, "sheetWidth": 256, "sheetHeight": 416, "tallBandRow": 24}:
        raise ValueError("Field prop geometry drifted")
    families = source["familyOrder"]
    if len(families) != 8 or set(source["themeFamilies"].values()) != set(families):
        raise ValueError("Field prop families must map the eight world themes one to one")
    for family in families:
        if len(source["familyProps"][family]) != source["propSlots"]["count"]:
            raise ValueError(f"{family} must fill every prop slot")
        if len(source["familyWideProps"][family]) != source["wideSlots"]["count"]:
            raise ValueError(f"{family} must fill every wide slot")
        unknown = [name for name in source["familyProps"][family] if name not in PROP_DRAWERS]
        unknown += [name for name in source["familyWideProps"][family] if name not in WIDE_DRAWERS]
        if unknown:
            raise ValueError(f"{family} names undrawn props: {unknown}")
    if [name for name in source["tallProps"] if name not in TALL_DRAWERS]:
        raise ValueError("Unknown tall prop")
    restricted = " ".join(source["restrictions"]).lower()
    for term in ("never define collision", "no text", "sacred objects", "no real insignia", "no image generator", "fallback"):
        if term not in restricted:
            raise ValueError(f"Missing field-prop boundary: {term}")
    return source


def frame_specs(source: dict) -> list[dict]:
    """Every frame in atlas order with its rectangle (mirrors game/field-prop-atlas.mjs)."""
    specs = []
    band = source["geometry"]["familyBandRows"]
    for f_index, family in enumerate(source["familyOrder"]):
        y_cells = f_index * band
        for piece in source["familyPieces"]:
            specs.append({
                "id": f"{family}:{piece['id']}", "family": family, "kind": "structure", "name": piece["id"],
                "column": piece["column"], "row": y_cells + piece["row"],
                "widthCells": piece["widthCells"], "heightCells": piece["heightCells"],
            })
        slots = source["propSlots"]
        for index, name in enumerate(source["familyProps"][family]):
            specs.append({
                "id": f"{family}:{name}", "family": family, "kind": "prop", "name": name,
                "column": slots["firstColumn"] + index, "row": y_cells + slots["row"], "widthCells": 1, "heightCells": 1,
            })
        wide = source["wideSlots"]
        for index, name in enumerate(source["familyWideProps"][family]):
            specs.append({
                "id": f"{family}:{name}", "family": family, "kind": "wide-prop", "name": name,
                "column": wide["firstColumn"] + index * wide["widthCells"], "row": y_cells + wide["row"],
                "widthCells": wide["widthCells"], "heightCells": 1,
            })
    for index, name in enumerate(source["tallProps"]):
        specs.append({
            "id": f"tall:{name}", "family": "tall", "kind": "tall-prop", "name": name,
            "column": index, "row": source["geometry"]["tallBandRow"], "widthCells": 1, "heightCells": 2,
        })
    for spec in specs:
        spec["rect"] = [spec["column"] * CELL, spec["row"] * CELL, spec["widthCells"] * CELL, spec["heightCells"] * CELL]
    return specs


def render_frame(spec: dict, palettes: dict, tall_palette: dict) -> Image.Image:
    family, name, kind = spec["family"], spec["name"], spec["kind"]
    if kind == "tall-prop":
        return draw_tall(name, tall_palette)
    pal = palettes[family]
    if kind == "prop":
        return draw_prop(family, pal, name)
    if kind == "wide-prop":
        return draw_wide(family, pal, name)
    if name.startswith("strip1-"):
        return draw_strip(family, pal, name.removeprefix("strip1-"), 1)
    if name.startswith("strip2-"):
        return draw_strip(family, pal, name.removeprefix("strip2-"), 2)
    if name.startswith("wall-"):
        return draw_wall(family, pal, name.removeprefix("wall-"))
    if name.startswith("block-"):
        wc, hc = (int(part) for part in name.removeprefix("block-").split("x"))
        return draw_block(family, pal, wc, hc)
    raise ValueError(spec["id"])


def validate_frame(spec: dict, image: Image.Image) -> dict:
    width, height = spec["rect"][2], spec["rect"][3]
    if image.size != (width, height) or image.mode != "RGBA":
        raise ValueError(f"{spec['id']} has wrong geometry {image.size}")
    alpha_values = set(image.getchannel("A").getdata())
    if not alpha_values <= {0, 255, SHADOW[3]}:
        raise ValueError(f"{spec['id']} uses unsupported alpha {sorted(alpha_values)}")
    colors = set()
    opaque = 0
    for value in image.getdata():
        if value[3] == SHADOW[3] and value != SHADOW:
            raise ValueError(f"{spec['id']} has a non-canonical shadow pixel")
        if value[3] == 255:
            opaque += 1
            colors.add(value)
    bounds = image.getchannel("A").getbbox()
    if not bounds or opaque == 0:
        raise ValueError(f"{spec['id']} is empty")
    coverage = opaque / (width * height)
    if spec["kind"] == "structure" and coverage < 0.6:
        raise ValueError(f"{spec['id']} structure covers only {coverage:.2f} of its cells")
    return {"alphaBounds": list(bounds), "colorCount": len(colors), "opaquePixels": opaque, "colors": colors}


def build_atlas(source: dict):
    palettes = {family: {key: color(value) for key, value in values.items()} for family, values in source["palettes"].items()}
    tall_palette = {key: color(value) for key, value in source["tallPalette"].items()}
    geometry = source["geometry"]
    atlas = Image.new("RGBA", (geometry["sheetWidth"], geometry["sheetHeight"]), TRANSPARENT)
    frames = []
    hashes = set()
    family_colors: dict[str, set] = {}
    occupied = set()
    for spec in frame_specs(source):
        image = render_frame(spec, palettes, tall_palette)
        stats = validate_frame(spec, image)
        x, y, w, h = spec["rect"]
        for cy in range(y // CELL, (y + h) // CELL):
            for cx in range(x // CELL, (x + w) // CELL):
                if (cx, cy) in occupied:
                    raise ValueError(f"{spec['id']} overlaps another frame")
                occupied.add((cx, cy))
        digest = sha256(image.tobytes())
        if digest in hashes:
            raise ValueError(f"Duplicate frame pixels: {spec['id']}")
        hashes.add(digest)
        family_colors.setdefault(spec["family"], set()).update(stats["colors"])
        atlas.paste(image, (x, y))
        frames.append({
            "id": spec["id"], "family": spec["family"], "kind": spec["kind"], "name": spec["name"],
            "rect": spec["rect"], "widthCells": spec["widthCells"], "heightCells": spec["heightCells"],
            "rgbaSha256": digest, "alphaBounds": stats["alphaBounds"], "colorCount": stats["colorCount"],
        })
    return atlas, frames, family_colors


def build_contact_sheet(source: dict, atlas: Image.Image, frames: list[dict]) -> Image.Image:
    scale, margin, gap, label_h, header_h = 3, 16, 8, 14, 22
    max_width = 1180
    font = ImageFont.load_default()
    sections = []
    for family in list(source["familyOrder"]) + ["tall"]:
        members = [frame for frame in frames if frame["family"] == family]
        rows, row, row_width = [], [], 0
        for frame in members:
            slot = max(frame["rect"][2] * scale, 96)
            if row and row_width + slot > max_width - 2 * margin:
                rows.append(row)
                row, row_width = [], 0
            row.append((frame, slot))
            row_width += slot + gap
        if row:
            rows.append(row)
        sections.append((family, rows))
    height = margin
    for _, rows in sections:
        height += header_h
        for row in rows:
            height += max(frame["rect"][3] * scale for frame, _ in row) + label_h + gap
        height += gap
    sheet = Image.new("RGBA", (max_width, height + margin), color("#111522"))
    draw = ImageDraw.Draw(sheet)
    y = margin
    for family, rows in sections:
        draw.text((margin, y + 4), FAMILY_TITLES[family], font=font, fill=color("#F6E8B9"))
        y += header_h
        floor = color(REVIEW_FLOORS[family])
        floor_alt = tuple(max(0, value - 10) for value in floor[:3]) + (255,)
        for row in rows:
            x = margin
            row_h = max(frame["rect"][3] * scale for frame, _ in row)
            for frame, slot in row:
                fx, fy, fw, fh = frame["rect"]
                tile = Image.new("RGBA", (fw * scale, fh * scale), floor)
                tile_draw = ImageDraw.Draw(tile)
                for cy in range(0, fh * scale, CELL * scale):
                    for cx in range(0, fw * scale, CELL * scale):
                        if (cx // (CELL * scale) + cy // (CELL * scale)) % 2:
                            tile_draw.rectangle((cx, cy, cx + CELL * scale - 1, cy + CELL * scale - 1), fill=floor_alt)
                crop = atlas.crop((fx, fy, fx + fw, fy + fh)).resize((fw * scale, fh * scale), Image.Resampling.NEAREST)
                tile.alpha_composite(crop)
                sheet.alpha_composite(tile, (x, y))
                draw.text((x, y + row_h + 2), frame["name"], font=font, fill=color("#C9D2E3"))
                x += slot + gap
            y += row_h + label_h + gap
        y += gap
    return sheet


def build_outputs(source: dict) -> dict[Path, bytes]:
    atlas, frames, family_colors = build_atlas(source)
    atlas_data = png_bytes(atlas)
    second, _, _ = build_atlas(source)
    if png_bytes(second) != atlas_data:
        raise ValueError("Two independent renders differ")
    contact = build_contact_sheet(source, atlas, frames)
    contact_data = png_bytes(contact)
    all_colors = set()
    for values in family_colors.values():
        all_colors |= values
    kinds = {}
    for frame in frames:
        kinds[frame["kind"]] = kinds.get(frame["kind"], 0) + 1
    manifest = {
        "assetId": source["assetId"],
        "status": "production-foundation-review",
        "authorship": source["authorship"],
        "provenanceLane": source["provenanceLane"],
        "provenance": "Pixel-authored production asset: deterministic code-native integer primitives at native 16 x 16 cell resolution under explicit per-family palettes. No image generator, traced reference, or external pixels.",
        "runtimeIntegration": "decorative-dressing-of-authored-impassable-cells-via-game/field-prop-dressing.mjs; collision stays level-owned",
        "pillowVersion": PIL.__version__,
        "sourceSha256": sha256(SOURCE_PATH.read_bytes()),
        "builderSha256": sha256(BUILDER_PATH.read_bytes()),
        "geometry": {
            **source["geometry"],
            "frameUnit": "16 x 16 cell multiples",
            "familyBandHeight": source["geometry"]["familyBandRows"] * CELL,
        },
        "alphaPolicy": source["alphaPolicy"],
        "familyOrder": source["familyOrder"],
        "themeFamilies": source["themeFamilies"],
        "frameCount": len(frames),
        "frameKinds": kinds,
        "distinctFrameHashes": len({frame["rgbaSha256"] for frame in frames}),
        "palette": {
            "totalOpaqueColors": len(all_colors),
            "perFamily": {family: len(values) for family, values in family_colors.items()},
        },
        "frames": frames,
        "exports": [
            {"file": ATLAS_PATH.name, "purpose": "transparent-runtime-atlas", "width": atlas.width, "height": atlas.height,
             "mode": "RGBA", "sha256": sha256(atlas_data)},
            {"file": CONTACT_PATH.name, "purpose": "labeled-3x-review-only-not-runtime", "width": contact.width,
             "height": contact.height, "mode": "RGBA", "sha256": sha256(contact_data)},
        ],
        "twoIndependentRendersByteIdentical": True,
        "runtimeCopy": "game/assets/art/field-prop-suite-v1/field-prop-atlas.png",
        "externalCulturalReview": "pending",
        "artLock": False,
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
        print("field prop suite is deterministic and current")
        return 0
    for path, data in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        print(f"wrote {path.relative_to(REPO).as_posix()} ({len(data)} bytes, sha256 {sha256(data)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
