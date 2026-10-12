#!/usr/bin/env python3
"""Pixel-authored V4 side-view combat families: wards, seals, echoes, records.

Every cel is rasterized at native 160x160 resolution from integer-rounded,
code-native primitives (polygons, ellipses, pixel runs, and mask edge
operations) under an explicit per-family palette. No source raster, image
generator, resampling, interpolation, partial alpha, or dithering is involved.

    python build_enemy_animation_suite_v4.py          # write artifacts
    python build_enemy_animation_suite_v4.py --check  # byte-identical rebuild
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "enemy-animation-suite-v4.source.json"
MANIFEST_NAME = "manifest.json"
CONTACT_SHEET_NAME = "enemy-animation-roster-contact-sheet-v4.png"
F = 160
COLS = 6
ROWS = 4
GUTTER = 2
REVIEW_SCALE = 3
LENIENT = False


# ---------------------------------------------------------------------------
# Deterministic raster primitives (mode "1" masks; 1 = covered pixel)
# ---------------------------------------------------------------------------


def ri(value: float) -> int:
    return int(math.floor(value + 0.5))


def rgba(hex_color: str) -> tuple[int, int, int, int]:
    value = hex_color.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), 255)


def blank() -> Image.Image:
    return Image.new("1", (F, F), 0)


def _pts(points):
    return [(ri(x), ri(y)) for x, y in points]


def poly(points) -> Image.Image:
    mask = blank()
    ImageDraw.Draw(mask).polygon(_pts(points), fill=1)
    return mask


def ellipse(cx: float, cy: float, rx: float, ry: float) -> Image.Image:
    mask = blank()
    ImageDraw.Draw(mask).ellipse((ri(cx - rx), ri(cy - ry), ri(cx + rx), ri(cy + ry)), fill=1)
    return mask


def rect(x0: float, y0: float, x1: float, y1: float) -> Image.Image:
    mask = blank()
    ImageDraw.Draw(mask).rectangle((ri(x0), ri(y0), ri(x1), ri(y1)), fill=1)
    return mask


def line(points, width: int = 1) -> Image.Image:
    mask = blank()
    ImageDraw.Draw(mask).line(_pts(points), fill=1, width=width)
    return mask


def dots(coords) -> Image.Image:
    mask = blank()
    access = mask.load()
    for x, y in coords:
        x, y = ri(x), ri(y)
        if 0 <= x < F and 0 <= y < F:
            access[x, y] = 1
    return mask


def union(*masks) -> Image.Image:
    out = blank()
    for mask in masks:
        out = ImageChops.logical_or(out, mask)
    return out


def inter(a: Image.Image, b: Image.Image) -> Image.Image:
    return ImageChops.logical_and(a, b)


def sub(a: Image.Image, b: Image.Image) -> Image.Image:
    return ImageChops.logical_xor(a, ImageChops.logical_and(a, b))


def shift(mask: Image.Image, dx: int, dy: int) -> Image.Image:
    out = blank()
    out.paste(mask, (dx, dy))
    return out


def dilate(mask: Image.Image, radius: int = 1) -> Image.Image:
    out = mask
    for _ in range(radius):
        out = union(out, shift(out, 1, 0), shift(out, -1, 0), shift(out, 0, 1), shift(out, 0, -1))
    return out


def erode(mask: Image.Image) -> Image.Image:
    return inter(mask, inter(inter(shift(mask, 1, 0), shift(mask, -1, 0)),
                             inter(shift(mask, 0, 1), shift(mask, 0, -1))))


def empty(mask: Image.Image) -> bool:
    return mask.getbbox() is None


def hash2(x: int, y: int, seed: int = 0) -> int:
    value = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    value = ((value ^ (value >> 13)) * 1274126177) & 0xFFFFFFFF
    return (value ^ (value >> 16)) & 0xFFFF


def circle_pts(cx: float, cy: float, rx: float, ry: float, count: int = 32, start: float = 0.0):
    out = []
    for index in range(count):
        angle = math.radians(start + index * 360.0 / count)
        out.append((cx + rx * round(math.cos(angle), 12), cy + ry * round(math.sin(angle), 12)))
    return out


def polar(cx: float, cy: float, radius: float, degrees: float) -> tuple[float, float]:
    angle = math.radians(degrees)
    return (cx + radius * round(math.cos(angle), 12), cy + radius * round(math.sin(angle), 12))


class Xf:
    """Local-to-cel transform: optional mirror, scale, clockwise rotation, offset."""

    def __init__(self, ox: float = 0.0, oy: float = 0.0, ang: float = 0.0,
                 sx: float = 1.0, sy: float = 1.0, flip: bool = False,
                 pre: tuple[float, float] = (0.0, 0.0)):
        radians = math.radians(ang)
        self.c = round(math.cos(radians), 12)
        self.s = round(math.sin(radians), 12)
        self.ox, self.oy, self.sx, self.sy, self.flip = ox, oy, sx, sy, flip
        self.pre = pre

    def pt(self, x: float, y: float) -> tuple[float, float]:
        x += self.pre[0]
        y += self.pre[1]
        if self.flip:
            x = -x
        x *= self.sx
        y *= self.sy
        return (self.ox + x * self.c - y * self.s, self.oy + x * self.s + y * self.c)

    def pts(self, points):
        return [self.pt(x, y) for x, y in points]

    def poly(self, points) -> Image.Image:
        return poly(self.pts(points))

    def circle(self, x: float, y: float, radius: float) -> Image.Image:
        cx, cy = self.pt(x, y)
        if self.sx == self.sy:
            return ellipse(cx, cy, radius * self.sx, radius * self.sx)
        return poly(self.pts(circle_pts(x, y, radius, radius, max(12, int(radius * 4)))))

    def oval(self, x: float, y: float, rx: float, ry: float, count: int = 32) -> Image.Image:
        return poly(self.pts(circle_pts(x, y, rx, ry, count)))

    def line(self, points, width: int = 1) -> Image.Image:
        return line(self.pts(points), width)

    def dots(self, points) -> Image.Image:
        return dots(self.pts(points))


class Canvas:
    def __init__(self, palette: dict[str, str]):
        self.palette = {name: rgba(value) for name, value in palette.items()}
        self.img = Image.new("RGBA", (F, F), (0, 0, 0, 0))

    def fill(self, mask: Image.Image, color: str) -> None:
        self.img.paste(self.palette[color], (0, 0), mask)

    def clear(self, mask: Image.Image) -> None:
        self.img.paste((0, 0, 0, 0), (0, 0), mask)

    def coverage(self) -> Image.Image:
        alpha = self.img.getchannel("A").point(lambda value: 255 if value else 0)
        return alpha.convert("1", dither=Image.Dither.NONE)

    def part(self, mask: Image.Image, ramp: dict[str, str], outline: bool = True,
             shadow: int = 2, light: int = 1, deep: bool = False) -> None:
        """Paint a lit volume: outer ink ring, mid fill, lower-right shadow, upper-left light."""
        if empty(mask):
            return
        if outline:
            self.fill(sub(dilate(mask), mask), ramp["o"])
        self.fill(mask, ramp["m"])
        if shadow:
            inner = inter(shift(mask, -shadow, 0), shift(mask, 0, -shadow))
            self.fill(sub(mask, inner), ramp["d"])
        if deep and "s" in ramp:
            inner = inter(shift(mask, -1, 0), shift(mask, 0, -1))
            self.fill(sub(mask, inner), ramp["s"])
        if light:
            inner = inter(shift(mask, light, 0), shift(mask, 0, light))
            self.fill(sub(mask, inner), ramp["l"])


def ramp(o: str, s: str, d: str, m: str, l: str, h: str) -> dict[str, str]:
    return {"o": o, "s": s, "d": d, "m": m, "l": l, "h": h}


def ground_offset(points, ground: float) -> float:
    return ground - max(y for _, y in points)


# ---------------------------------------------------------------------------
# SUM-001 / SUM-002 Blood Ward Seal (west and east)
# ---------------------------------------------------------------------------

WARD_TABLET = [(-11, -33), (11, -33), (19, -25), (19, 25), (11, 33), (-11, 33), (-19, 25), (-19, -25)]
WARD_TABLET_LEFT = [(-11, -33), (0, -33), (0, 33), (-11, 33), (-19, 25), (-19, -25)]
WARD_TABLET_RIGHT = [(0, -33), (11, -33), (19, -25), (19, 25), (11, 33), (0, 33)]
WARD_PANEL = [(-8, -28), (8, -28), (14, -22), (14, 22), (8, 28), (-8, 28), (-14, 22), (-14, -22)]
WARD_ROOF = [(-28, -31), (-24, -36), (-13, -41), (13, -41), (24, -36), (28, -31), (21, -33), (-21, -33)]
WARD_RIDGE = [(-7, -46), (7, -46), (8, -41), (-8, -41)]
WARD_FINIAL = [(-10, 33), (10, 33), (6, 39), (0, 46), (-6, 39)]
WARD_GLYPH_THORNS = [(-7, -5), (-8, -6), (-8, 1), (-9, 1), (-6, 6), (-7, 7)]
WARD_CRACKS = [
    [[(-5, -15), (-1, -9), (-4, -3), (1, 3)]],
    [[(1, 3), (5, 9), (2, 15)], [(-1, -9), (5, -12)]],
    [[(-4, -3), (-8, 2)], [(5, 9), (8, 6)], [(2, 15), (-2, 19)], [(-5, -15), (-3, -20)]],
]


class BloodWard:
    base = (80, 70)

    def __init__(self, variant: str):
        self.variant = variant
        self.flip = variant == "east"
        palette = {
            "ink": "#0B1020",
            "lq0": "#120F1C", "lq1": "#1C1729", "lq2": "#2A2238", "lq3": "#40344F", "lq4": "#5E4D6C",
            "ch1": "#2B2C3B", "ch2": "#4A4C5E", "ch3": "#7C8094",
        }
        if variant == "west":
            palette.update({
                "b0": "#4A3820", "b1": "#6E5A30", "b2": "#A08B58", "b3": "#D2BA7C", "b4": "#F2E2A8",
                "g0": "#2A0814", "g1": "#4E1022", "g2": "#7A1A32", "g3": "#AA2840",
                "g4": "#D8485A", "g5": "#F48A84", "g6": "#FFE0CC",
            })
        else:
            palette.update({
                "b0": "#26302A", "b1": "#3E4A3E", "b2": "#637462", "b3": "#8FA07A", "b4": "#C4D0A0",
                "g0": "#1E0816", "g1": "#3A0E26", "g2": "#5C1636", "g3": "#842244",
                "g4": "#B03A5C", "g5": "#DC7890", "g6": "#FFDCE0",
            })
        self.palette = palette
        self.lacquer = ramp("ink", "lq0", "lq1", "lq2", "lq3", "lq4")
        self.brass = ramp("ink", "b0", "b1", "b2", "b3", "b4")
        self.chain = ramp("ink", "ch1", "ch1", "ch2", "ch3", "ch3")
        self.poses = self._poses()

    # -- pose tables -------------------------------------------------------
    def _poses(self) -> dict[str, list[dict]]:
        def p(**kw):
            base = dict(ox=0, oy=0, ang=0, glass=0, phase=0, orbit=1.0, sway=0, aura=0,
                        doors=0, crack=0, beam=0, project=0, chips=0, align=False, broken=0)
            base.update(kw)
            return base

        bob = [0, -1, -3, -4, -3, -1]
        loco = [p(oy=bob[i], ang=[0, -1, -2, -2, -1, 0][i], sway=[0, 1, 2, 2, 1, 0][i],
                  phase=i * 60, glass=[0, 0, 1, 1, 0, 0][i]) for i in range(6)]
        basic = [
            p(oy=-1, phase=10),
            p(oy=3, ang=3, glass=-1, orbit=0.7, phase=20),
            p(oy=-2, ang=-2, glass=1, orbit=0.85, aura=1, phase=50),
            p(oy=-4, ang=-3, glass=3, orbit=1.25, aura=3, phase=90),
            p(oy=-3, glass=1, orbit=1.1, aura=4, phase=130),
            p(oy=-1, phase=170),
        ]
        signature = [
            p(oy=1, phase=345),
            p(oy=2, ang=6, glass=-1, doors=1, phase=15, orbit=0.8),
            p(oy=-3, ang=2, glass=2, doors=3, align=True, aura=1, phase=30),
            p(oy=-4, ang=-4, glass=3, doors=4, align=True, beam=2, project=2, aura=2, phase=45),
            p(oy=-2, ang=4, glass=1, doors=2, beam=1, project=1, phase=90),
            p(oy=0, doors=1, phase=140),
        ]
        hurt = [
            p(ox=4, ang=9, glass=4, orbit=1.35, phase=200),
            p(ox=3, oy=3, ang=4, crack=1, phase=215),
            p(ox=1, oy=1, ang=-6, crack=2, chips=1, glass=-1, phase=230),
            p(broken=1, crack=3, glass=-1),
            p(broken=2, crack=3, glass=-2),
            p(broken=3, crack=3, glass=-2),
        ]
        return {"locomotion": loco, "basic-attack": basic, "signature-attack": signature, "hurt-defeat": hurt}

    # -- helpers -----------------------------------------------------------
    def glass_ramp(self, level: int) -> dict[str, str]:
        mid = max(1, min(5, 2 + level))
        pick = lambda index: f"g{max(0, min(6, index))}"
        return {"o": "ink", "s": pick(mid - 2), "d": pick(mid - 1), "m": pick(mid),
                "l": pick(mid + 1), "h": pick(mid + 2), "x": pick(mid + 3)}

    def draw_shards(self, cv: Canvas, cx: float, cy: float, pose: dict, front: bool) -> None:
        for index in range(4):
            degrees = pose["phase"] + index * 90 + (35 if self.flip else 0)
            if pose["align"]:
                sx = cx + (-31 if index < 2 else 31)
                sy = cy + (-14 if index % 2 == 0 else 14)
                is_front = True
            else:
                sx, sy = polar(cx, cy + 8, 33 * pose["orbit"], degrees)
                sy = cy + 8 + (sy - cy - 8) * 0.24
                is_front = math.sin(math.radians(degrees)) >= 0
            if is_front != front:
                continue
            size = 3 if is_front else 2
            shard = poly([(sx, sy - size * 2), (sx + size - 1, sy), (sx, sy + size * 2), (sx - size + 1, sy)])
            cv.fill(sub(dilate(shard), shard), "ink")
            cv.fill(shard, "g3" if is_front else "g2")
            cv.fill(inter(shard, shift(shard, -1, 0)), "g2" if is_front else "g1")
            cv.fill(dots([(sx - 1, sy - 1), (sx - 1, sy)]), "g5" if is_front else "g4")

    def draw_chain(self, cv: Canvas, anchor: tuple[float, float], end: tuple[float, float]) -> None:
        ax, ay = anchor
        ex, ey = end
        length = max(1, int(math.hypot(ex - ax, ey - ay)))
        link_pixels = []
        bead_pixels = []
        for step in range(length + 1):
            t = step / length
            x = ax + (ex - ax) * t
            y = ay + (ey - ay) * t
            link_pixels.append((x, y))
            if step % 4 == 2:
                bead_pixels.append((x, y))
        links = dots(link_pixels)
        beads = union(*[rect(ri(x) - 1, ri(y) - 1, ri(x), ri(y) + 1) for x, y in bead_pixels]) if bead_pixels else blank()
        cv.fill(sub(dilate(union(links, beads)), union(links, beads)), "ink")
        cv.fill(links, "ch1")
        cv.fill(beads, "ch2")
        cv.fill(dots([(ri(x) - 1, ri(y) - 1) for x, y in bead_pixels]), "ch3")
        weight = poly([(ex, ey + 1), (ex + 3, ey + 5), (ex, ey + 10), (ex - 3, ey + 5)])
        cv.part(weight, self.brass, shadow=1)
        bead = ellipse(ex, ey + 13, 2, 2)
        cv.fill(sub(dilate(bead), bead), "ink")
        cv.fill(bead, "g4")
        cv.fill(dots([(ex - 1, ey + 12)]), "g6")

    def draw_projection(self, cv: Canvas, cx: float, cy: float, strength: int) -> None:
        px, py = cx - 42, cy + 4
        outer = ellipse(px, py, 21, 21)
        cut = ellipse(px + 7, py - 3, 18, 18)
        crescent = sub(outer, cut)
        thorns = union(
            poly([(px - 18, py - 10), (px - 27, py - 15), (px - 20, py - 4)]),
            poly([(px - 21, py + 2), (px - 30, py + 3), (px - 21, py + 7)]),
            poly([(px - 16, py + 13), (px - 23, py + 21), (px - 13, py + 16)]),
        )
        shape = union(crescent, thorns)
        if strength == 1:
            keep = blank()
            access = keep.load()
            for y in range(F):
                for x in range(F):
                    if hash2(x // 3, y // 3, 71) % 3:
                        access[x, y] = 1
            shape = inter(shape, keep)
            cv.fill(shape, "g4")
            cv.fill(erode(shape), "g5")
            return
        cv.fill(sub(dilate(shape), shape), "g2")
        cv.fill(shape, "g5")
        cv.fill(erode(erode(shape)), "g6")
        sparks = [(px - 30, py - 20), (px - 6, py - 26), (px + 8, py + 24), (px - 32, py + 16), (px - 12, py + 30)]
        for sx, sy in sparks:
            cv.fill(poly([(sx, sy - 2), (sx + 1, sy), (sx, sy + 2), (sx - 1, sy)]), "g5")

    def draw_beam(self, cv: Canvas, top_x: float, top_y: float, strength: int) -> None:
        if strength >= 2:
            cv.fill(rect(top_x - 2, GUTTER, top_x + 2, top_y), "g4")
            cv.fill(rect(top_x - 1, GUTTER, top_x + 1, top_y), "g6")
        else:
            for y in range(GUTTER, ri(top_y), 6):
                cv.fill(rect(top_x - 1, y, top_x + 1, min(top_y, y + 2)), "g5")

    def draw_aura(self, cv: Canvas, cx: float, cy: float, level: int) -> None:
        if level <= 0:
            return
        radius = {1: 30, 2: 36, 3: 42, 4: 48}[level]
        ry = radius + 6
        ring = sub(ellipse(cx, cy, radius, ry), ellipse(cx, cy, radius - 2, ry - 2))
        keep = blank()
        access = keep.load()
        segments = 18 if level < 4 else 12
        for y in range(F):
            for x in range(F):
                angle = math.degrees(math.atan2(y - cy, x - cx)) % 360
                band = int(angle // (360 / segments))
                if level == 4:
                    if band % 2 == 0 and hash2(band, level, 3) % 4:
                        access[x, y] = 1
                elif band % 3 != 2:
                    access[x, y] = 1
        ring = inter(ring, keep)
        cv.fill(ring, "g3" if level in (1, 4) else "g4")
        if level == 3:
            cv.fill(inter(ring, shift(ring, 1, 1)), "g6")
            for degrees in range(0, 360, 45):
                sx, sy = polar(cx, cy, radius + 5, degrees + 22)
                sy = cy + (sy - cy) * (ry / radius)
                cv.fill(poly([(sx, sy - 3), (sx + 1, sy), (sx, sy + 3), (sx - 1, sy)]), "g5")

    # -- body --------------------------------------------------------------
    def draw_body(self, cv: Canvas, T: Xf, pose: dict, roof_T: Xf | None = None,
                  finial_T: Xf | None = None, show_roof: bool = True) -> None:
        glass = self.glass_ramp(pose["glass"] if pose["glass"] < 4 else 3)
        doors = pose["doors"]
        if doors:
            body_left = T.poly([(x - doors, y) for x, y in WARD_TABLET_LEFT])
            body_right = T.poly([(x + doors, y) for x, y in WARD_TABLET_RIGHT])
            core = T.poly([(-doors - 1, -30), (doors + 1, -30), (doors + 1, 30), (-doors - 1, 30)])
            cv.part(core, glass, shadow=1)
            cv.part(body_left, self.lacquer)
            cv.part(body_right, self.lacquer)
            tablet = union(body_left, body_right)
        else:
            tablet = T.poly(WARD_TABLET)
            cv.part(tablet, self.lacquer)
        panel = inter(T.poly(WARD_PANEL), tablet)
        if doors:
            panel = union(inter(T.poly([(x - doors, y) for x, y in WARD_PANEL if x <= 0] + [(-doors, 28), (-doors, -28)]), tablet),
                          inter(T.poly([(x + doors, y) for x, y in WARD_PANEL if x >= 0] + [(doors, 28), (doors, -28)]), tablet))
        cv.fill(panel, "lq2")
        cv.fill(sub(panel, inter(shift(panel, -1, 0), shift(panel, 0, -1))), "lq3")
        cv.fill(sub(panel, inter(shift(panel, 1, 0), shift(panel, 0, 1))), "lq1")
        bands = inter(tablet, union(T.poly([(-22, -34), (22, -34), (22, -30), (-22, -30)]),
                                    T.poly([(-22, 30), (22, 30), (22, 34), (-22, 34)])))
        cv.fill(bands, "b2")
        cv.fill(sub(bands, inter(shift(bands, 0, 1), shift(bands, 1, 0))), "b3")
        cv.fill(sub(bands, inter(shift(bands, 0, -1), shift(bands, -1, 0))), "b1")
        studs = [(-15 - doors, -23), (15 + doors, -23), (-15 - doors, 23), (15 + doors, 23)]
        for sx, sy in studs:
            cx, cy = T.pt(sx, sy)
            cv.fill(rect(ri(cx) - 1, ri(cy) - 1, ri(cx), ri(cy)), "b2")
            cv.fill(dots([(ri(cx) - 1, ri(cy) - 1)]), "b4")
        if not doors:
            cv.fill(inter(T.line([(0, -29), (0, 29)]), tablet), "lq0")
        offset = max(4, 14 - doors * 2)
        lens = inter(T.circle(-offset, 0, 24), T.circle(offset, 0, 24))
        frame_ring = sub(dilate(lens), lens)
        cv.fill(sub(dilate(frame_ring), union(frame_ring, lens)), "ink")
        spill = inter(sub(dilate(lens, 3), dilate(lens, 2)), erode(tablet))
        cv.fill(spill, "g1")
        cv.fill(frame_ring, "b2")
        cv.fill(inter(frame_ring, sub(frame_ring, shift(frame_ring, -1, -1))), "b3")
        cv.part(lens, glass, outline=False, shadow=3, light=2, deep=True)
        if pose["glass"] >= 4:
            cv.fill(erode(lens), "g6")
            cv.fill(sub(lens, erode(lens)), "g5")
        spec = T.poly([(-6, -14), (-4, -14), (-4, -7), (-6, -7)]) if offset > 6 else T.poly([(-4, -16), (-2, -16), (-2, -8), (-4, -8)])
        cv.fill(inter(spec, lens), glass["h"])
        crescent = sub(T.circle(0, 0, 7), T.circle(3, -1, 6))
        thorns = T.dots(WARD_GLYPH_THORNS)
        seed = T.dots([(1, 0), (1, 1)])
        glyph = inter(union(crescent, thorns, seed), lens)
        cv.fill(inter(sub(dilate(crescent), crescent), lens), glass["l"])
        cv.fill(glyph, glass["x"] if pose["glass"] >= 0 else glass["h"])
        for level in range(pose["crack"]):
            for crack in WARD_CRACKS[level]:
                stroke = inter(T.line(crack), lens)
                cv.fill(inter(shift(stroke, 1, 0), lens), "g5")
                cv.fill(stroke, "g0")
        if show_roof:
            self.draw_roof(cv, roof_T or T)
        FT = finial_T or T
        finial = FT.poly(WARD_FINIAL)
        cv.part(finial, self.lacquer, shadow=1)
        collar = inter(finial, FT.poly([(-11, 33), (11, 33), (11, 36), (-11, 36)]))
        cv.fill(collar, "b2")
        cv.fill(inter(collar, sub(collar, shift(collar, 0, -1))), "b3")
        drop = union(FT.circle(0, 51, 3), FT.poly([(-2, 49), (2, 49), (0, 45)]))
        cv.fill(sub(dilate(drop), drop), "ink")
        cv.fill(drop, glass["l"])
        tip_x, tip_y = FT.pt(-1, 50)
        cv.fill(dots([(tip_x, tip_y)]), glass["x"])

    def render(self, clip: str, index: int) -> Image.Image:
        pose = self.poses[clip][index]
        cv = Canvas(self.palette)
        bx, by = self.base
        cx, cy = bx + pose["ox"], by + pose["oy"]
        if pose["broken"]:
            self.render_broken(cv, pose)
            return cv.img
        T = Xf(cx, cy, pose["ang"], flip=self.flip)
        self.draw_aura(cv, cx, cy + 2, pose["aura"])
        self.draw_shards(cv, cx, cy, pose, front=False)
        sway = pose["sway"] + (pose["ox"] // 2)
        for side in (-1, 1):
            anchor = T.pt(25 * side, -32)
            end = (anchor[0] + sway, anchor[1] + 34)
            self.draw_chain(cv, anchor, end)
        self.draw_body(cv, T, pose)
        self.draw_shards(cv, cx, cy, pose, front=True)
        if pose["beam"]:
            top_x, top_y = T.pt(0, -57)
            self.draw_beam(cv, top_x, top_y, pose["beam"])
        if pose["project"]:
            self.draw_projection(cv, cx, cy, pose["project"])
        if pose["chips"]:
            for sx, sy in [(cx - 26, cy - 10), (cx - 31, cy + 4), (cx + 24, cy - 18)]:
                cv.fill(poly([(sx, sy - 2), (sx + 2, sy), (sx, sy + 2), (sx - 2, sy)]), "g4")
        return cv.img

    def draw_roof(self, cv: Canvas, RT: Xf, lit: bool = True) -> None:
        roof = RT.poly(WARD_ROOF)
        ridge = RT.poly(WARD_RIDGE)
        ring = sub(RT.circle(0, -51, 5), RT.circle(0, -51, 2))
        cv.part(ring, self.brass, shadow=1)
        cv.part(ridge, self.lacquer, shadow=1)
        cv.part(roof, self.lacquer)
        eave = inter(roof, sub(roof, shift(roof, 0, -1)))
        cv.fill(eave, "b2")
        if lit:
            cv.fill(inter(eave, sub(eave, shift(eave, 2, 0))), "b3")
            for tx, ty in (RT.pt(-27, -32), RT.pt(27, -32)):
                cv.fill(dots([(tx, ty)]), "b4")

    def render_broken(self, cv: Canvas, pose: dict) -> None:
        stage = pose["broken"]
        ground = 147
        roof_extent = WARD_ROOF + [(-5, -56), (5, -56)]
        body_extent = WARD_TABLET + [(0, 54), (-25, -33), (25, -33)]
        if stage == 1:
            body = Xf(86, 96, 26, flip=self.flip)
            roof = Xf(58, 50, -32, flip=self.flip, pre=(0, 42))
            shards = [(50, 74), (60, 104), (108, 80), (114, 106), (76, 126), (40, 96)]
        else:
            body_ang = 76 if stage == 2 else 90
            roof_ang = -16 if stage == 2 else -7
            probe = Xf(0, 0, body_ang, flip=self.flip).pts(body_extent)
            body = Xf(82, ground_offset(probe, ground), body_ang, flip=self.flip)
            probe = Xf(0, 0, roof_ang, flip=self.flip, pre=(0, 42)).pts(roof_extent)
            roof = Xf(122, ground_offset(probe, ground), roof_ang, flip=self.flip, pre=(0, 42))
            if stage == 2:
                shards = [(24, ground - 1), (46, ground - 3), (98, ground - 1), (106, ground - 26), (140, ground - 2)]
            else:
                shards = [(22, ground), (48, ground - 1), (100, ground), (146, ground)]
        for sx, sy in shards:
            shard = poly([(sx, sy - 3), (sx + 2, sy), (sx, sy + 2), (sx - 2, sy)])
            cv.fill(sub(dilate(shard), shard), "ink")
            cv.fill(shard, "g2" if stage == 3 else "g3")
            cv.fill(dots([(sx - 1, sy - 1)]), "g4" if stage == 3 else "g5")
        broken_pose = dict(pose)
        broken_pose["doors"] = 0
        self.draw_body(cv, body, broken_pose, show_roof=False)
        self.draw_roof(cv, roof, lit=stage < 3)


# ---------------------------------------------------------------------------
# SUM-003 Tithe Seal (Exposed Seal): hovering ink-and-wax registry seal
# ---------------------------------------------------------------------------

SEAL_SPLIT = [(1, -30), (1, -26), (-2, -13), (2, -3), (-1, 8), (2, 18), (0, 30)]
SEAL_LEFT = [(-34, -34), (1, -34)] + SEAL_SPLIT + [(0, 34), (-34, 34)]
SEAL_RIGHT = [(34, -34), (1, -34)] + SEAL_SPLIT + [(0, 34), (34, 34)]
SEAL_CRACKS = [
    [[(-14, -12), (-7, -6), (-9, 1)]],
    [[(-9, 1), (-3, 6), (-5, 13)], [(-7, -6), (0, -9)]],
    [[(9, -14), (5, -8), (8, -2)], [(-5, 13), (-10, 17)]],
]


def scallop_pts(radius: float, bumps: int, depth: float, count: int = 96, sy: float = 1.04):
    out = []
    for index in range(count):
        angle = 2 * math.pi * index / count
        r = radius + depth * round(math.cos(bumps * angle), 12)
        out.append((r * round(math.cos(angle), 12), r * sy * round(math.sin(angle), 12)))
    return out


SEAL_DISC = scallop_pts(24, 12, 1.6)
SEAL_FIELD = circle_pts(0, 0, 18, 18.5, 48)
SEAL_MARK_OUTER = [(0, -10), (10, 0), (0, 10), (-10, 0)]
SEAL_MARK_INNER = [(0, -7), (7, 0), (0, 7), (-7, 0)]


SEAL_SCALE = 1.12


class TitheSeal:
    base = (80, 68)

    def __init__(self):
        self.palette = {
            "ink": "#0B1020",
            "w0": "#3A0E14", "w1": "#621820", "w2": "#8E2A2C", "w3": "#B8443A", "w4": "#DC6E52", "w5": "#F6A880",
            "p0": "#5A5244", "p1": "#8A7E62", "p2": "#B8AA84", "p3": "#D7C99A", "p4": "#F6E8B9",
            "k0": "#16233A", "k1": "#27466B", "k2": "#4F7392", "k3": "#8FB4C8",
            "y0": "#A08B58", "y1": "#E8CF7B", "y2": "#FFF2C0",
        }
        self.wax = ramp("ink", "w0", "w1", "w2", "w3", "w4")
        self.paper = ramp("p0", "p1", "p1", "p2", "p3", "p4")
        self.cord = ramp("ink", "k0", "k0", "k1", "k2", "k3")
        self.poses = self._poses()

    def _poses(self) -> dict[str, list[dict]]:
        def p(**kw):
            base = dict(ox=0, oy=0, ang=0, sx=1.0, flutter=0, swing=0, phase=0, orbit=1.0, glow=0,
                        burst=0, spikes=0, crack=0, flash=False, chips=0, broken=0)
            base.update(kw)
            return base

        bob = [0, -1, -2, -3, -2, -1]
        loco = [p(oy=bob[i], ang=[0, -2, -3, -2, 0, 1][i], flutter=i * 60, phase=i * 30,
                  swing=[2, 3, 4, 3, 2, 1][i]) for i in range(6)]
        basic = [
            p(oy=-1, phase=10, flutter=30, swing=1),
            p(oy=-6, ang=12, sx=0.84, phase=20, orbit=0.8, flutter=90, swing=-4),
            p(ox=-4, oy=-2, ang=-10, sx=0.92, phase=35, flutter=150, swing=5),
            p(ox=-10, oy=2, ang=-18, phase=55, orbit=1.2, burst=2, flutter=210, swing=8),
            p(ox=-6, oy=1, ang=-8, phase=70, orbit=1.1, burst=1, flutter=270, swing=5),
            p(ox=-2, ang=-2, phase=85, flutter=330, swing=2),
        ]
        signature = [
            p(oy=1, phase=350, flutter=10, swing=0),
            p(oy=-2, glow=1, orbit=0.65, phase=20, flutter=80, swing=-6),
            p(oy=-4, glow=2, orbit=0.45, phase=70, flutter=140, swing=6),
            p(oy=-3, glow=3, orbit=1.45, phase=110, spikes=2, flutter=200, swing=9),
            p(oy=-1, ang=6, glow=1, orbit=1.15, phase=140, spikes=1, flutter=260, swing=4),
            p(oy=0, phase=170, flutter=320, swing=1),
        ]
        hurt = [
            p(ox=4, ang=12, flash=True, orbit=1.3, phase=200, flutter=40, swing=10),
            p(ox=3, oy=2, ang=6, crack=1, phase=215, flutter=100, swing=6),
            p(ox=1, ang=-8, crack=2, chips=1, phase=230, flutter=160, swing=-6),
            p(broken=1, crack=3),
            p(broken=2, crack=3),
            p(broken=3, crack=3),
        ]
        return {"locomotion": loco, "basic-attack": basic, "signature-attack": signature, "hurt-defeat": hurt}

    def draw_strip(self, cv: Canvas, T: Xf, x: float, top: float, width: float, length: float,
                   angle: float, seed: int) -> None:
        S = Xf(*T.pt(x, top), ang=angle + math.degrees(math.atan2(T.s, T.c)), sx=T.sx, sy=T.sy)
        half = width / 2
        teeth = []
        steps = 4
        for step in range(steps + 1):
            tx = half - width * step / steps
            teeth.append((tx, length - (3 if (step + seed) % 2 else 0)))
        outline = [(-half, 0), (half, 0)] + teeth + [(-half, length - 2)]
        strip = S.poly(outline)
        cv.part(strip, self.paper, shadow=1)
        for row in range(5, int(length) - 4, 4):
            dash_w = 2 + (hash2(row, seed, 5) % 3)
            start = -half + 2 + (hash2(seed, row, 9) % 2)
            cv.fill(inter(S.line([(start, row), (start + dash_w, row)]), strip), "k0")

    def draw_beads(self, cv: Canvas, cx: float, cy: float, pose: dict, front: bool) -> None:
        for index in range(6):
            degrees = pose["phase"] + index * 60
            bx, by = polar(cx, cy + 4, 40 * pose["orbit"], degrees)
            bx, by = ri(bx), ri(cy + 4 + (by - cy - 4) * 0.32)
            is_front = math.sin(math.radians(degrees)) >= 0
            if is_front != front:
                continue
            bead = union(rect(bx - 1, by - 1, bx + 1, by + 1), dots([(bx, by - 2), (bx, by - 3)]))
            if index % 2 == 0:
                bead = union(bead, dots([(bx + 2, by), (bx + 2, by - 1)]))
            cv.fill(sub(dilate(bead), bead), "ink")
            cv.fill(bead, "k1" if is_front else "k0")
            cv.fill(dots([(bx + 1, by + 1)]), "k0")
            cv.fill(dots([(bx - 1, by - 1)]), "k3" if is_front else "k2")

    def draw_disc(self, cv: Canvas, T: Xf, pose: dict, clip_local=None) -> None:
        clip = T.poly(clip_local) if clip_local else None

        def cut(mask):
            return inter(mask, clip) if clip is not None else mask

        disc = cut(T.poly(SEAL_DISC))
        cv.part(disc, self.wax, shadow=3, light=2, deep=True)
        field = cut(T.poly(SEAL_FIELD))
        cv.fill(field, "w1")
        cv.fill(sub(field, inter(shift(field, 2, 0), shift(field, 0, 2))), "w0")
        cv.fill(sub(field, inter(shift(field, -1, 0), shift(field, 0, -1))), "w3")
        mark = cut(union(sub(T.poly(SEAL_MARK_OUTER), T.poly(SEAL_MARK_INNER)),
                         T.poly([(-14, -1), (14, -1), (14, 1), (-14, 1)]),
                         T.poly([(-1, -5), (1, -5), (1, -3), (-1, -3)])))
        glow = pose["glow"]
        if pose["flash"]:
            cv.fill(erode(disc), "w5")
            cv.fill(mark, "y2")
        elif glow:
            cv.fill(sub(dilate(mark), mark) if glow < 3 else dilate(dilate(mark)), "w4" if glow < 3 else "y1")
            cv.fill(mark, {1: "y0", 2: "y1", 3: "y2"}[glow])
        else:
            cv.fill(mark, "w2")
            cv.fill(sub(mark, inter(shift(mark, 1, 0), shift(mark, 0, 1))), "w4")
            cv.fill(sub(mark, inter(shift(mark, -1, 0), shift(mark, 0, -1))), "w0")
        rim_spec = cut(T.dots([(-15, -17), (-16, -16), (-17, -14), (-18, -12)]))
        cv.fill(rim_spec, "w5")
        for level in range(pose["crack"]):
            for crack in SEAL_CRACKS[level]:
                stroke = inter(T.line(crack), disc)
                cv.fill(inter(shift(stroke, 1, 1), disc), "w4")
                cv.fill(stroke, "ink")

    def draw_cord(self, cv: Canvas, T: Xf) -> None:
        loop = sub(T.oval(0, -31, 7, 9), T.oval(0, -31, 4, 6))
        cv.part(loop, self.cord, shadow=1)
        twist = inter(loop, T.dots([(x, y) for y in range(-40, -21) for x in range(-8, 9) if (x + y) % 4 == 0]))
        cv.fill(twist, "k0")
        knot = T.oval(0, -23, 3, 2, 12)
        cv.part(knot, self.cord, shadow=1)

    def draw_burst(self, cv: Canvas, cx: float, cy: float, level: int) -> None:
        bx, by = cx - 34, cy + 6
        ring = sub(ellipse(bx, by, 7, 22), ellipse(bx + 1, by, 5, 19))
        if level == 2:
            cv.fill(sub(dilate(ring), ring), "k0")
            cv.fill(ring, "k1")
            cv.fill(inter(ring, shift(ring, 1, 0)), "k2")
            drops = [(bx - 12, by - 18), (bx - 16, by - 4), (bx - 14, by + 10), (bx - 9, by + 22),
                     (bx - 20, by + 2), (bx - 6, by - 26)]
            for index, (dx, dy) in enumerate(drops):
                drop = rect(dx - 1, dy - 1, dx + (1 if index % 2 else 0), dy + 1)
                cv.fill(drop, "k1")
                cv.fill(dots([(dx - 1, dy - 1)]), "k3")
            for sx, sy, ang in [(bx - 4, by - 30, -20), (bx - 10, by + 26, 25)]:
                scrap = Xf(sx, sy, ang).poly([(-3, -2), (3, -2), (3, 2), (-3, 2)])
                cv.part(scrap, self.paper, shadow=1)
        else:
            keep = dots([(x, y) for y in range(F) for x in range(F) if hash2(x // 2, y // 2, 13) % 3 == 0])
            cv.fill(inter(ring, keep), "k1")
            for dx, dy in [(bx - 18, by - 10), (bx - 22, by + 6), (bx - 15, by + 18)]:
                cv.fill(rect(dx, dy, dx + 1, dy + 1), "k0")

    def draw_spikes(self, cv: Canvas, cx: float, cy: float, level: int) -> None:
        for index in range(12):
            degrees = index * 30 + 15
            if level == 1 and index % 2:
                continue
            inner = 30 if level == 2 else 34
            outer = 42 if level == 2 else 40
            a = polar(cx, cy, inner, degrees)
            b = polar(cx, cy, outer, degrees)
            a = (a[0], cy + (a[1] - cy) * 0.95)
            b = (b[0], cy + (b[1] - cy) * 0.95)
            stroke = line([a, b], 2 if level == 2 else 1)
            cv.fill(stroke, "k1" if index % 2 else "k2")
            cv.fill(dots([b]), "y1" if level == 2 else "k3")
        if level == 2:
            ring = sub(ellipse(cx, cy, 31, 32), ellipse(cx, cy, 29, 30))
            keep = dots([(x, y) for y in range(F) for x in range(F)
                         if int((math.degrees(math.atan2(y - cy, x - cx)) % 360) // 15) % 2 == 0])
            cv.fill(inter(ring, keep), "y1")

    def draw_whole(self, cv: Canvas, T: Xf, pose: dict, cx: float, cy: float) -> None:
        self.draw_beads(cv, cx, cy, pose, front=False)
        flutter = pose["flutter"]
        swing = pose["swing"]
        for index, (x, width, length, base_ang) in enumerate([(-11, 7, 32, 7), (13, 7, 28, -9), (1, 8, 40, 0)]):
            angle = base_ang + swing + 3 * round(math.sin(math.radians(flutter + index * 110)), 12)
            self.draw_strip(cv, T, x, 10, width, length, angle, index + 1)
        self.draw_cord(cv, T)
        self.draw_disc(cv, T, pose)
        self.draw_beads(cv, cx, cy, pose, front=True)

    def render(self, clip: str, index: int) -> Image.Image:
        pose = self.poses[clip][index]
        cv = Canvas(self.palette)
        bx, by = self.base
        cx, cy = bx + pose["ox"], by + pose["oy"]
        if pose["broken"]:
            self.render_broken(cv, pose)
            return cv.img
        T = Xf(cx, cy, pose["ang"], sx=pose["sx"] * SEAL_SCALE, sy=SEAL_SCALE)
        self.draw_whole(cv, T, pose, cx, cy)
        if pose["burst"]:
            self.draw_burst(cv, cx, cy, pose["burst"])
        if pose["spikes"]:
            self.draw_spikes(cv, cx, cy, pose["spikes"])
        if pose["chips"]:
            for sx, sy in [(cx - 30, cy - 8), (cx - 27, cy + 12), (cx + 29, cy - 16)]:
                chip = poly([(sx, sy - 2), (sx + 2, sy), (sx, sy + 2), (sx - 2, sy)])
                cv.fill(sub(dilate(chip), chip), "ink")
                cv.fill(chip, "w3")
        return cv.img

    def render_broken(self, cv: Canvas, pose: dict) -> None:
        stage = pose["broken"]
        ground = 147
        if stage == 1:
            left = Xf(68, 86, -20)
            right = Xf(94, 92, 22)
            cord = Xf(80, 46, 30, pre=(0, 30))
            strips = [(54, 110, 40), (102, 118, -55), (82, 122, 80)]
        elif stage == 2:
            left = Xf(60, ground - 14, -8, sy=0.62)
            right = Xf(100, ground - 13, 12, sy=0.62)
            cord = Xf(118, ground - 4, 75, pre=(0, 30))
            strips = [(34, ground - 3, 84), (128, ground - 2, -82), (80, ground - 2, 88)]
        else:
            left = Xf(58, ground - 10, -4, sy=0.45)
            right = Xf(102, ground - 10, 7, sy=0.45)
            cord = Xf(126, ground - 2, 90, pre=(0, 30))
            strips = [(32, ground - 1, 90), (136, ground - 1, -90), (84, ground, 90)]
        for index, (sx, sy, ang) in enumerate(strips):
            S = Xf(sx, sy, ang)
            strip = S.poly([(-3, -12), (3, -12), (3, 12), (-3, 12)])
            cv.part(strip, self.paper, shadow=1)
            for row in range(-8, 10, 4):
                cv.fill(inter(S.line([(-1, row), (1, row)]), strip), "k0")
        loop = sub(cord.oval(0, -31, 7, 9), cord.oval(0, -31, 4, 6))
        cv.part(loop, self.cord, shadow=1)
        self.draw_disc(cv, left, pose, SEAL_LEFT)
        self.draw_disc(cv, right, pose, SEAL_RIGHT)
        if stage == 3:
            for dx, dy in [(40, ground), (76, ground - 1), (120, ground)]:
                cv.fill(rect(dx, dy - 1, dx + 2, dy), "k1")


# ---------------------------------------------------------------------------
# SUM-004 Court Clone: umbral echo of Kurozane's armored spear silhouette
# ---------------------------------------------------------------------------

CLONE_GROUND = 151
CLONE_K = 1.16
CLONE_HEAD_K = 1.28
CLONE_THIGH = 24 * CLONE_K
CLONE_SHIN = 24 * CLONE_K
CLONE_UPPER = 18 * CLONE_K
CLONE_FORE = 17 * CLONE_K


def seg_end(joint: tuple[float, float], length: float, degrees: float) -> tuple[float, float]:
    """0 degrees hangs straight down; positive swings forward (screen-left)."""
    angle = math.radians(degrees)
    return (joint[0] - length * round(math.sin(angle), 12), joint[1] + length * round(math.cos(angle), 12))


def limb(a: tuple[float, float], b: tuple[float, float], wa: float, wb: float) -> Image.Image:
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / length, dx / length
    return poly([(a[0] + nx * wa, a[1] + ny * wa), (b[0] + nx * wb, b[1] + ny * wb),
                 (b[0] - nx * wb, b[1] - ny * wb), (a[0] - nx * wa, a[1] - ny * wa)])


def ik2(shoulder, target, upper: float, fore: float, bend: int = -1):
    dx, dy = target[0] - shoulder[0], target[1] - shoulder[1]
    distance = math.hypot(dx, dy)
    reach = upper + fore - 0.5
    if distance > reach:
        dx, dy = dx * reach / distance, dy * reach / distance
        distance = reach
    distance = max(distance, abs(upper - fore) + 0.5)
    base = math.atan2(dy, dx)
    cosine = (upper * upper + distance * distance - fore * fore) / (2 * upper * distance)
    bend_angle = math.acos(max(-1.0, min(1.0, cosine)))
    elbow_angle = base + bend * bend_angle
    elbow = (shoulder[0] + upper * round(math.cos(elbow_angle), 12),
             shoulder[1] + upper * round(math.sin(elbow_angle), 12))
    hand = (shoulder[0] + dx, shoulder[1] + dy)
    return elbow, hand


class TorsoFrame:
    def __init__(self, hip: tuple[float, float], lean: float):
        radians = math.radians(lean)
        self.hip = hip
        self.u = (-round(math.sin(radians), 12), -round(math.cos(radians), 12))
        self.v = (-round(math.cos(radians), 12), round(math.sin(radians), 12))

    def pt(self, u: float, v: float) -> tuple[float, float]:
        u *= CLONE_K
        v *= CLONE_K
        return (self.hip[0] + u * self.u[0] + v * self.v[0], self.hip[1] + u * self.u[1] + v * self.v[1])

    def pts(self, points):
        return [self.pt(u, v) for u, v in points]


CLONE_DO = [(3, -10), (3, 10), (16, 12), (27, 13), (34, 11), (38, 6), (38, -7), (33, -11), (18, -11)]
CLONE_HEAD_DOME = circle_pts(1, -3, 9, 7, 28)
CLONE_SHIKORO = [
    [(-1, -2), (10, -3), (13, 2), (4, 3)],
    [(1, 1), (12, 1), (15, 6), (5, 7)],
    [(3, 5), (13, 5), (17, 10), (7, 11)],
]
CLONE_VISOR = [(-11, -5), (-3, -6), (-3, -3), (-12, -2)]
CLONE_FACE = [(-9, -2), (-2, -2), (0, 4), (-3, 9), (-8, 8), (-10, 3)]
CLONE_HORN_A = [(-4, -9), (-2, -10), (-10, -17), (-13, -16), (-12, -18)]
CLONE_HORN_B = [(-1, -10), (1, -10), (7, -17), (5, -18)]


def stance(**kw):
    base = dict(dx=0, lean=6, head=0, nt=14, ns=2, ft=-12, fs=-20, hand=(-10, 24), far_hand=None,
                spear=dict(grip="near", ang=32, fwd=40, back=34), trail=3, phase=0, seal=None,
                flash=False, dissolve=0, petals=0, floor_seal=0, motes=0, hold=False, bend=-1)
    base.update(kw)
    return base


class CourtClone:
    hip_x = 88

    def __init__(self):
        self.palette = {
            "ink": "#07060E",
            "u0": "#0E0B19", "u1": "#181430", "u2": "#262044", "u3": "#3A3060", "u4": "#56478C",
            "v1": "#7A5CB4", "v2": "#AE90E0", "v3": "#DCCDF6",
            "c0": "#3A0C1C", "c1": "#6E1A34", "c2": "#A82E48", "c3": "#E25C6A", "c4": "#FFB8B0",
        }
        self.armor = ramp("ink", "u0", "u1", "u2", "u3", "u4")
        self.far = ramp("ink", "u0", "u0", "u1", "u2", "u3")
        self.cloth = ramp("ink", "u0", "u0", "u1", "u2", "u3")
        self.poses = self._poses()

    def _poses(self) -> dict[str, list[dict]]:
        S = stance
        loco = [
            S(lean=8, nt=26, ns=12, ft=-20, fs=-30, hand=(-8, 24), spear=dict(grip="near", ang=30, fwd=40, back=34), trail=6, phase=0),
            S(lean=9, nt=18, ns=-6, ft=-14, fs=-46, hand=(-9, 25), spear=dict(grip="near", ang=28, fwd=40, back=34), trail=7, phase=60),
            S(lean=8, nt=2, ns=-8, ft=8, fs=-38, hand=(-10, 23), spear=dict(grip="near", ang=30, fwd=40, back=34), trail=8, phase=120),
            S(lean=9, nt=-16, ns=-20, ft=24, fs=6, hand=(-9, 24), spear=dict(grip="near", ang=32, fwd=40, back=34), trail=7, phase=180),
            S(lean=8, nt=-20, ns=-30, ft=26, fs=12, hand=(-8, 25), spear=dict(grip="near", ang=30, fwd=40, back=34), trail=6, phase=240),
            S(trail=3, phase=300),
        ]
        basic = [
            S(spear=dict(grip="near", ang=24, fwd=40, back=34), hand=(-11, 23), phase=20),
            S(dx=5, lean=-4, nt=10, ns=0, ft=-18, fs=-26, hand=(6, 22), spear=dict(grip="near", ang=12, fwd=40, back=34), trail=4, phase=60),
            S(dx=-2, lean=10, nt=30, ns=10, ft=-22, fs=-30, hand=(-14, 20), spear=dict(grip="near", ang=4, fwd=40, back=34), trail=7, phase=100),
            S(dx=-6, lean=15, nt=40, ns=18, ft=-28, fs=-36, hand=(-21, 15), spear=dict(grip="near", ang=0, fwd=34, back=34), trail=10, phase=140,
              seal=dict(kind="tip", r=7, stage=2)),
            S(dx=-5, lean=12, nt=36, ns=14, ft=-26, fs=-34, hand=(-18, 17), spear=dict(grip="near", ang=3, fwd=34, back=36), trail=9, phase=180,
              seal=dict(kind="tip", r=6, stage=1)),
            S(dx=-1, lean=7, nt=18, ns=4, ft=-14, fs=-22, hand=(-12, 22), spear=dict(grip="near", ang=20, fwd=40, back=34), trail=5, phase=220),
        ]
        planted = dict(grip="far", ang=90, fwd=44, back=40)
        signature = [
            S(spear=dict(grip="near", ang=36, fwd=40, back=34), hand=(-9, 25), phase=330, trail=2),
            S(lean=2, hand=(-6, 10), far_hand=(10, 20), spear=planted, trail=3, phase=10),
            S(lean=-2, head=-6, hand=(-18, -14), far_hand=(10, 20), spear=planted, trail=5, phase=50,
              seal=dict(kind="hand", r=6, stage=1)),
            S(lean=8, nt=22, ns=8, hand=(-28, 2), far_hand=(10, 20), spear=planted, trail=9, phase=90,
              seal=dict(kind="cast", r=15, stage=2)),
            S(lean=4, nt=18, ns=6, hand=(-20, 10), far_hand=(10, 20), spear=planted, trail=7, phase=130,
              seal=dict(kind="cast", r=15, stage=1), petals=1),
            S(lean=6, hand=(-10, 22), spear=dict(grip="near", ang=40, fwd=40, back=34), trail=4, phase=170),
        ]
        hurt = [
            S(dx=5, lean=-14, head=-10, nt=6, ns=-4, ft=-20, fs=-28, hand=(8, 8), spear=dict(grip="near", ang=50, fwd=40, back=34),
              flash=True, trail=10, phase=200, motes=1),
            S(dx=3, lean=20, head=12, nt=22, ns=-18, ft=-16, fs=-50, hand=(-4, 18), spear=dict(grip="near", ang=14, fwd=40, back=34),
              trail=6, phase=230, motes=1),
            S(dx=6, lean=-6, head=-4, nt=-6, ns=-14, ft=14, fs=-8, hand=(6, 24), spear=dict(grip="near", ang=62, fwd=40, back=34),
              trail=12, phase=260, dissolve=1, motes=2),
            S(dx=2, lean=22, head=16, nt=84, ns=0, ft=-6, fs=-88, hand=(-6, 30), spear=dict(grip="near", ang=-22, fwd=40, back=30),
              trail=4, phase=290, dissolve=2, motes=3, bend=-1),
            S(dx=2, lean=26, head=24, nt=84, ns=0, ft=-6, fs=-88, hand=(-4, 32), spear=None,
              trail=2, phase=320, dissolve=3, motes=4, floor_seal=1),
            S(dx=2, spear=None, hold=True, floor_seal=2, motes=5, phase=350),
        ]
        return {"locomotion": loco, "basic-attack": basic, "signature-attack": signature, "hurt-defeat": hurt}

    # -- skeleton ------------------------------------------------------------
    def solve(self, pose: dict) -> dict:
        hip0 = (self.hip_x + pose["dx"], 0.0)
        near_hip = (hip0[0] - 1, hip0[1])
        far_hip = (hip0[0] + 2, hip0[1])
        nk = seg_end(near_hip, CLONE_THIGH, pose["nt"])
        na = seg_end(nk, CLONE_SHIN, pose["ns"])
        fk = seg_end(far_hip, CLONE_THIGH, pose["ft"])
        fa = seg_end(fk, CLONE_SHIN, pose["fs"])
        lowest = max(na[1] + 4, fa[1] + 4, nk[1] + 3, fk[1] + 3)
        dy = CLONE_GROUND - lowest
        move = lambda q: (q[0], q[1] + dy)
        hip = move(hip0)
        return {
            "hip": hip, "near_hip": move(near_hip), "far_hip": move(far_hip),
            "nk": move(nk), "na": move(na), "fk": move(fk), "fa": move(fa),
            "torso": TorsoFrame(hip, pose["lean"]),
        }

    def draw_leg(self, cv: Canvas, hip, knee, ankle, ramp_name: dict, near: bool) -> None:
        thigh = union(limb(hip, knee, 5.5, 4.5), ellipse(knee[0], knee[1], 3.5, 3.5))
        shin = limb(knee, ankle, 4.5, 3.5)
        foot = poly([(ankle[0] + 3, ankle[1] - 2), (ankle[0] + 3, ankle[1] + 3), (ankle[0] - 9, ankle[1] + 3),
                     (ankle[0] - 8, ankle[1] + 1), (ankle[0] - 2, ankle[1] - 2)])
        cv.part(thigh, ramp_name)
        cv.part(union(shin, foot), ramp_name)
        guard = limb(seg_point(knee, ankle, 0.15), seg_point(knee, ankle, 0.75), 4.5, 3.5)
        cv.fill(guard, ramp_name["l"] if near else ramp_name["m"])
        cv.fill(sub(guard, shift(guard, -1, 0)), ramp_name["d"])
        cv.fill(dots([knee]), "c1" if near else "u1")

    def draw_arm(self, cv: Canvas, shoulder, hand_target, ramp_name: dict, bend: int, near: bool):
        elbow, hand = ik2(shoulder, hand_target, CLONE_UPPER, CLONE_FORE, bend)
        upper = union(limb(shoulder, elbow, 4.5, 3.5), ellipse(elbow[0], elbow[1], 3.5, 3.5))
        fore = limb(elbow, hand, 4, 3.5)
        cv.part(upper, ramp_name)
        cv.part(fore, ramp_name)
        band = limb(seg_point(elbow, hand, 0.55), seg_point(elbow, hand, 0.7), 3.5, 3.5)
        cv.fill(band, "c1" if near else "u1")
        fist = rect(hand[0] - 2, hand[1] - 2, hand[0] + 2, hand[1] + 2)
        cv.part(fist, ramp_name, shadow=1)
        return elbow, hand

    def draw_sode(self, cv: Canvas, shoulder, elbow, ramp_name: dict) -> None:
        dx, dy = elbow[0] - shoulder[0], elbow[1] - shoulder[1]
        length = math.hypot(dx, dy) or 1.0
        ux, uy = dx / length, dy / length
        nx, ny = -uy, ux
        corners = [(-2, 9), (-2, -9), (19, -11), (19, 11)]
        plate = poly([(shoulder[0] + ux * a + nx * b, shoulder[1] + uy * a + ny * b) for a, b in corners])
        cv.part(plate, ramp_name)
        for a in (4, 9, 14):
            stroke = line([(shoulder[0] + ux * a + nx * 11, shoulder[1] + uy * a + ny * 11),
                           (shoulder[0] + ux * a - nx * 11, shoulder[1] + uy * a - ny * 11)])
            cv.fill(inter(stroke, erode(plate)), ramp_name["s"])
            lace = line([(shoulder[0] + ux * (a + 1) + nx * 2, shoulder[1] + uy * (a + 1) + ny * 2),
                         (shoulder[0] + ux * (a + 1) - nx * 2, shoulder[1] + uy * (a + 1) - ny * 2)])
            cv.fill(inter(lace, erode(plate)), "c1")

    def draw_spear(self, cv: Canvas, grip, spear: dict) -> tuple[float, float]:
        angle = math.radians(spear["ang"])
        direction = (-round(math.cos(angle), 12), -round(math.sin(angle), 12))
        normal = (-direction[1], direction[0])
        butt = (grip[0] - direction[0] * spear["back"], grip[1] - direction[1] * spear["back"])
        base = (grip[0] + direction[0] * (spear["fwd"] - 14), grip[1] + direction[1] * (spear["fwd"] - 14))
        tip = (grip[0] + direction[0] * spear["fwd"], grip[1] + direction[1] * spear["fwd"])
        shaft = line([butt, base], 2)
        cv.fill(sub(dilate(shaft), shaft), "ink")
        cv.fill(shaft, "u2")
        cv.fill(inter(shaft, shift(shaft, 1, 1)), "u3")
        blade = poly([
            (base[0] + normal[0] * 2, base[1] + normal[1] * 2),
            (base[0] + direction[0] * 5 + normal[0] * 3, base[1] + direction[1] * 5 + normal[1] * 3),
            tip,
            (base[0] + direction[0] * 5 - normal[0] * 3, base[1] + direction[1] * 5 - normal[1] * 3),
            (base[0] - normal[0] * 2, base[1] - normal[1] * 2),
        ])
        cv.fill(sub(dilate(blade), blade), "ink")
        cv.fill(blade, "u1")
        edge = line([(base[0] + direction[0] * 3, base[1] + direction[1] * 3), tip])
        cv.fill(inter(edge, blade), "v2")
        collar = ellipse(base[0], base[1], 2, 2)
        cv.fill(collar, "c2")
        cv.fill(dots([(base[0] - 1, base[1] - 1)]), "c3")
        return tip

    def draw_head(self, cv: Canvas, center, angle: float, flash: bool) -> None:
        H = Xf(center[0], center[1], angle, sx=CLONE_HEAD_K, sy=CLONE_HEAD_K)
        for index, lame in enumerate(reversed(CLONE_SHIKORO)):
            cv.part(H.poly(lame), self.armor if index == 2 else self.far, shadow=1)
        horn_b = H.poly(CLONE_HORN_B)
        cv.part(horn_b, self.far, shadow=1, light=0)
        cv.fill(sub(horn_b, shift(horn_b, 1, 0)), "c2")
        dome = H.poly(CLONE_HEAD_DOME)
        cv.part(dome, self.armor, shadow=2, light=1)
        cv.fill(inter(dome, H.poly([(-9, -6), (10, -6), (10, -4), (-9, -4)])), "u1")
        face = H.poly(CLONE_FACE)
        cv.fill(sub(dilate(face), face), "ink")
        cv.fill(face, "ink")
        cv.fill(inter(face, H.poly([(-9, 4), (-1, 4), (-1, 5), (-9, 5)])), "u1")
        visor = H.poly(CLONE_VISOR)
        cv.part(visor, self.armor, shadow=1)
        horn_a = H.poly(CLONE_HORN_A)
        cv.part(horn_a, self.armor, shadow=1, light=0)
        cv.fill(sub(horn_a, shift(horn_a, 1, 0)), "c3" if flash else "c2")
        crest = H.dots([(-3, -10), (-2, -10), (-3, -11)])
        cv.fill(crest, "c3")
        eye = H.dots([(-7, 0), (-6, 0)])
        cv.fill(dilate(eye), "c1")
        cv.fill(eye, "c4" if flash else "c3")

    def draw_mantle(self, cv: Canvas, rig: dict, pose: dict) -> None:
        TF = rig["torso"]
        hip = rig["hip"]
        trail = pose["trail"]
        top = TF.pts([(37, -5), (36, -11), (22, -14)])
        bottom_y = hip[1] + 34
        hem = []
        teeth = 6
        for index in range(teeth + 1):
            t = index / teeth
            x = hip[0] + 18 + trail - t * (20 + trail * 0.6)
            wobble = 3 * round(math.sin(math.radians(pose["phase"] + index * 70)), 12)
            y = bottom_y + (5 if index % 2 else 0) + wobble - t * 4
            hem.append((x, y))
        mantle = poly(top + hem + TF.pts([(12, -11)]))
        cv.part(mantle, self.cloth, shadow=3)
        for index in range(3):
            fold_top = TF.pt(30 - index * 7, -12)
            fold_bottom = (hip[0] + 14 + trail * 0.8 - index * 7, bottom_y - 4)
            cv.fill(inter(line([fold_top, fold_bottom]), erode(mantle)), "u0")

    def draw_torso(self, cv: Canvas, rig: dict) -> None:
        TF = rig["torso"]
        do = poly(TF.pts(CLONE_DO))
        cv.part(do, self.armor, shadow=3, deep=True)
        for u in (9, 14, 19, 24, 29):
            stroke = inter(line(TF.pts([(u, -11), (u, 13)])), erode(do))
            cv.fill(stroke, "u0")
            lace = inter(dots(TF.pts([(u + 1, v) for v in range(-8, 12, 3)])), erode(do))
            cv.fill(lace, "c1")
        plate = inter(poly(TF.pts([(19, 2), (32, 2), (32, 11), (19, 11)])), erode(do))
        cv.fill(sub(dilate(plate), plate), "ink")
        cv.fill(plate, "c1")
        cv.fill(sub(plate, inter(shift(plate, 1, 0), shift(plate, 0, 1))), "c2")
        cv.fill(sub(plate, inter(shift(plate, -1, 0), shift(plate, 0, -1))), "c0")
        seal_c = TF.pt(25.5, 6.5)
        rosette = union(*[dots([polar(seal_c[0], seal_c[1], 2, a)]) for a in range(0, 360, 45)])
        cv.fill(inter(dilate(rosette), plate), "ink")
        cv.fill(inter(rosette, plate), "c0")
        cv.fill(dots([seal_c]), "c3")
        belt = inter(line(TF.pts([(4, -11), (4, 12)]), 2), dilate(do))
        cv.fill(belt, "c1")

    def draw_kusazuri(self, cv: Canvas, rig: dict) -> None:
        TF = rig["torso"]
        plates = []
        for index, (v0, v1, flare) in enumerate([(-12, -4, 4), (-5, 4, 1), (3, 12, -3)]):
            a = TF.pt(5, v0)
            b = TF.pt(5, v1)
            plate = poly([a, b, (b[0] + flare - 1, b[1] + 24), (a[0] + flare + 1, a[1] + 24)])
            plates.append(plate)
            cv.part(plate, self.armor if index == 2 else self.far, shadow=2)
            for offset in (6, 12, 18):
                stroke = line([(a[0] + flare * offset / 24, a[1] + offset), (b[0] + flare * offset / 24, b[1] + offset)])
                cv.fill(inter(stroke, erode(plate)), "u0")
        return union(*plates)

    def draw_seal(self, cv: Canvas, center, radius: int, stage: int) -> None:
        cx, cy = center
        if radius <= 7:
            ring = sub(ellipse(cx, cy, radius, radius), ellipse(cx, cy, radius - 2, radius - 2))
            petals = union(*[line([center, polar(cx, cy, radius, a)]) for a in range(0, 360, 45)])
            body = union(ring, petals)
            cv.fill(sub(dilate(body), body), "c2" if stage == 2 else "c1")
            cv.fill(body, "ink")
            cv.fill(dots([center]), "c3")
            if stage == 2:
                glow = sub(ellipse(cx, cy, radius + 4, radius + 4), ellipse(cx, cy, radius + 3, radius + 3))
                keep = dots([(x, y) for y in range(F) for x in range(F) if (x + y) % 3 == 0])
                cv.fill(inter(glow, keep), "v2")
            return
        shapes = []
        for index in range(12):
            degrees = index * 30 + (0 if stage == 2 else 8)
            direction = polar(0, 0, 1, degrees)
            normal = (-direction[1], direction[0])
            reach = radius if index % 2 == 0 else radius - 3
            petal = poly([
                (cx + normal[0] * 1.5, cy + normal[1] * 1.5),
                (cx + direction[0] * reach * 0.55 + normal[0] * reach * 0.24,
                 cy + direction[1] * reach * 0.55 + normal[1] * reach * 0.24),
                (cx + direction[0] * reach, cy + direction[1] * reach),
                (cx + direction[0] * reach * 0.55 - normal[0] * reach * 0.24,
                 cy + direction[1] * reach * 0.55 - normal[1] * reach * 0.24),
                (cx - normal[0] * 1.5, cy - normal[1] * 1.5),
            ])
            shapes.append(petal)
        flower = union(*shapes)
        if stage == 1:
            keep = dots([(x, y) for y in range(F) for x in range(F) if hash2(x // 2, y // 2, 41) % 5 > 1])
            flower = inter(flower, keep)
            cv.fill(sub(dilate(flower), flower), "c1")
            cv.fill(flower, "ink")
            return
        cv.fill(sub(dilate(dilate(flower)), dilate(flower)), "v1")
        cv.fill(sub(dilate(flower), flower), "c2")
        cv.fill(flower, "ink")
        cv.fill(inter(flower, sub(flower, erode(flower))), "c1")
        core = ellipse(cx, cy, 3, 3)
        cv.fill(core, "c2")
        cv.fill(ellipse(cx, cy, 1, 1), "c4")
        crack = line([(cx - radius + 4, cy - 5), (cx - 2, cy + 1), (cx + 3, cy - 2), (cx + radius - 3, cy + 6)])
        cv.fill(inter(crack, flower), "c3")
        for degrees in range(15, 360, 60):
            sx, sy = polar(cx, cy, radius + 6, degrees)
            cv.fill(poly([(sx, sy - 2), (sx + 1, sy), (sx, sy + 2), (sx - 1, sy)]), "v2")

    def draw_floor_seal(self, cv: Canvas, cx: float, stage: int) -> None:
        cy = CLONE_GROUND - 3
        outer = ellipse(cx, cy, 22 if stage == 2 else 16, 4 if stage == 2 else 3)
        petals = dots([polar(cx, cy, 1, 0)])
        for degrees in range(0, 360, 30):
            px, py = polar(cx, cy, 18 if stage == 2 else 13, degrees)
            py = cy + (py - cy) * 0.2
            petals = union(petals, line([(cx, cy), (px, py)]))
        cv.fill(sub(dilate(outer), outer), "c1" if stage == 2 else "c0")
        cv.fill(outer, "u0")
        cv.fill(inter(petals, outer), "ink")
        cv.fill(inter(line([(cx - 14, cy - 1), (cx - 3, cy + 1), (cx + 6, cy - 1), (cx + 15, cy + 2)]), outer), "c2")

    def draw_motes(self, cv: Canvas, rig: dict, pose: dict) -> None:
        count = {1: 6, 2: 10, 3: 16, 4: 22, 5: 6}[pose["motes"]]
        hip = rig["hip"]
        seed = int(pose["phase"])
        rise = pose["motes"] * 6
        for index in range(count):
            hx = hash2(index, seed, 17)
            hy = hash2(seed, index, 23)
            x = hip[0] + 4 + (hx % 44) - 18 + pose["trail"]
            y = hip[1] + 40 - (hy % 70) - rise
            if pose["hold"]:
                x = hip[0] - 20 + (hx % 40)
                y = CLONE_GROUND - 12 - (hy % 26)
            if not (GUTTER + 1 <= x <= F - GUTTER - 3 and GUTTER + 1 <= y <= F - GUTTER - 3):
                continue
            size = 2 if index % 3 else 1
            mote = rect(x, y, x + size - 1, y + size - 1)
            cv.fill(mote, "v1" if index % 4 == 0 else "u3")

    def punch_holes(self, cv: Canvas, rig: dict, pose: dict) -> None:
        coverage = cv.coverage()
        hip_y = rig["hip"][1]
        seed = int(pose["phase"]) // 10 + 3
        level = pose["dissolve"]
        holes = blank()
        access = holes.load()
        interior = erode(erode(coverage))
        cover = coverage.load()
        inner = interior.load()
        for y in range(F):
            for x in range(F):
                if not cover[x, y]:
                    continue
                depth = (y - (hip_y - 6)) / 50.0
                if depth > 0:
                    density = 0.10 + depth * 0.28 + level * 0.16
                elif inner[x, y]:
                    density = 0.03 + level * 0.06
                else:
                    density = 0.0
                if level >= 3 and y > hip_y - 14:
                    density = 0.98
                if hash2(x // 2, y // 2, seed) / 65535.0 < density:
                    access[x, y] = 1
        cv.clear(holes)

    def rim_light(self, cv: Canvas, flash: bool) -> None:
        coverage = cv.coverage()
        edge = sub(coverage, inter(shift(coverage, 1, 0), shift(coverage, 0, 1)))
        strong = sub(coverage, union(shift(coverage, 1, 0), shift(coverage, 0, 1)))
        current = cv.img.load()
        ink = cv.palette["ink"]
        rim = blank()
        access = rim.load()
        edge_px = edge.load()
        for y in range(F):
            for x in range(F):
                if edge_px[x, y] and current[x, y] == ink:
                    access[x, y] = 1
        cv.fill(rim, "v2" if flash else "v1")
        cv.fill(inter(strong, rim), "v3" if flash else "v2")

    def render(self, clip: str, index: int) -> Image.Image:
        pose = self.poses[clip][index]
        cv = Canvas(self.palette)
        if pose["hold"]:
            self.draw_floor_seal(cv, self.hip_x - 4, 2)
            self.draw_motes(cv, {"hip": (self.hip_x, CLONE_GROUND - 40)}, pose)
            crest = Xf(self.hip_x + 18, CLONE_GROUND - 4, 70).poly(CLONE_HORN_A)
            cv.part(crest, self.armor, shadow=1, light=0)
            cv.fill(sub(crest, shift(crest, 0, 1)), "c2")
            return cv.img
        rig = self.solve(pose)
        TF = rig["torso"]
        near_shoulder = TF.pt(35, 1)
        far_shoulder = TF.pt(35, -3)
        spear = pose["spear"]
        near_target = (near_shoulder[0] + pose["hand"][0] * CLONE_K, near_shoulder[1] + pose["hand"][1] * CLONE_K)
        _, near_hand = ik2(near_shoulder, near_target, CLONE_UPPER, CLONE_FORE, pose["bend"])
        far_target = None
        grip = None
        if spear:
            angle = math.radians(spear["ang"])
            direction = (-round(math.cos(angle), 12), -round(math.sin(angle), 12))
            if spear["grip"] == "near":
                grip = near_hand
                far_target = (grip[0] - direction[0] * 17, grip[1] - direction[1] * 17)
            else:
                far_target = (far_shoulder[0] + pose["far_hand"][0] * CLONE_K, far_shoulder[1] + pose["far_hand"][1] * CLONE_K)
                _, grip = ik2(far_shoulder, far_target, CLONE_UPPER, CLONE_FORE, -1)
        if far_target is None:
            far_target = (far_shoulder[0] + 4, far_shoulder[1] + 28)
        if pose["floor_seal"]:
            self.draw_floor_seal(cv, rig["hip"][0] - 6, pose["floor_seal"])
        self.draw_mantle(cv, rig, pose)
        far_elbow, _ = self.draw_arm(cv, far_shoulder, far_target, self.far, -1, near=False)
        self.draw_sode(cv, far_shoulder, far_elbow, self.far)
        self.draw_leg(cv, rig["far_hip"], rig["fk"], rig["fa"], self.far, near=False)
        self.draw_torso(cv, rig)
        self.draw_leg(cv, rig["near_hip"], rig["nk"], rig["na"], self.armor, near=True)
        self.draw_kusazuri(cv, rig)
        tip = None
        if spear:
            tip = self.draw_spear(cv, grip, spear)
        near_elbow, _ = self.draw_arm(cv, near_shoulder, near_target, self.armor, pose["bend"], near=True)
        self.draw_sode(cv, near_shoulder, near_elbow, self.armor)
        head_center = TF.pt(46, 1)
        self.draw_head(cv, head_center, -(pose["lean"] + pose["head"]), pose["flash"])
        self.rim_light(cv, pose["flash"])
        self.punch_holes(cv, rig, pose)
        if pose["motes"]:
            self.draw_motes(cv, rig, pose)
        seal = pose["seal"]
        if seal:
            if seal["kind"] == "tip" and tip is not None:
                center = (tip[0] + (3 if seal["stage"] == 2 else -4), tip[1])
            elif seal["kind"] == "hand":
                center = (near_hand[0] - 2, near_hand[1] - 9)
            else:
                center = (near_hand[0] - 20, near_hand[1] - 2)
            self.draw_seal(cv, center, seal["r"], seal["stage"])
        return cv.img


def seg_point(a, b, t: float) -> tuple[float, float]:
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


# ---------------------------------------------------------------------------
# SUM-005 Unfiled Testimony: non-hostile paper-and-ash record spirit
# ---------------------------------------------------------------------------

TESTIMONY_ROBE = [(-15, -15), (15, -15), (20, 0), (19, 22), (23, 38), (26, 52), (23, 62), (14, 53),
                  (5, 48), (-4, 42), (-12, 32), (-18, 14), (-19, 0)]
TESTIMONY_SHEETS = [
    # (x, y, width, height, angle, tone): page shingles clipped to the robe, drawn bottom-up
    (5, 47, 11, 16, 10, "a"), (17, 49, 11, 16, 18, "b"),
    (-7, 31, 12, 20, -2, "a"), (6, 31, 12, 20, 5, "b"), (17, 32, 12, 20, 12, "a"),
    (-12, 14, 13, 20, -4, "b"), (0, 14, 13, 20, 2, "a"), (12, 14, 13, 20, 7, "b"),
    (-10, -4, 14, 20, -6, "a"), (3, -4, 14, 20, 4, "b"), (14, -4, 12, 20, 9, "a"),
]
TESTIMONY_SHED = {1: (10, 7), 2: (10, 7, 4, 1)}
TESTIMONY_SHOULDER_PAGES = [(-19, -8, 10, 14, -20), (19, -8, 10, 14, 18)]
TESTIMONY_TATTERS = [(-4, 40, 24, 11), (9, 48, 30, 13), (21, 58, 38, 10)]
TESTIMONY_HOOD = [(-4, -47), (7, -45), (14, -35), (15, -21), (9, -13), (-11, -13), (-15, -24), (-12, -38)]
TESTIMONY_RECESS = [(-12, -31), (-4, -36), (2, -29), (1, -19), (-10, -18), (-14, -25)]


class UnfiledTestimony:
    base = (80, 74)

    def __init__(self):
        self.palette = {
            "ink": "#0B1020",
            "pa0": "#4A4436", "pa1": "#7E7458", "pa2": "#B4A67E", "pa3": "#D7C99A", "pa4": "#F6E8B9",
            "pb1": "#6E6A5C", "pb2": "#9C9478", "pb3": "#C2B898",
            "k0": "#16233A", "k1": "#3A4A66",
            "a0": "#2E2A2C", "a1": "#4C4446", "a2": "#7A706C", "a3": "#A89E96",
            "g1": "#C89A48", "g2": "#E8C46A", "g3": "#FFF0C0",
            "t0": "#1E3A48", "t1": "#3E6E7A", "t2": "#88C8C5", "t3": "#D7F0D5",
        }
        self.paper_a = ramp("pa0", "pa1", "pa1", "pa2", "pa3", "pa4")
        self.paper_b = ramp("pa0", "pb1", "pb1", "pb2", "pb3", "pa3")
        self.cord = ramp("t0", "t0", "t0", "t1", "t2", "t3")
        self.poses = self._poses()

    def _poses(self) -> dict[str, list[dict]]:
        def p(**kw):
            base = dict(ox=0, oy=0, ang=0, sy=1.0, spread=1.0, flutter=0, jitter=1.0, phase=0, ash=0,
                        glow=0, fan=0, scroll=0, puff=0, shed=0, heap=0, hood_tilt=0)
            base.update(kw)
            return base

        bob = [0, -1, -2, -3, -2, -1]
        loco = [p(oy=bob[i], ang=[0, -1, -2, -1, 0, 1][i], flutter=i * 60, phase=i * 30, ash=i) for i in range(6)]
        basic = [
            p(oy=-1, flutter=20, phase=15, ash=1),
            p(oy=-4, spread=0.82, flutter=70, phase=25, ash=2, glow=1),
            p(oy=-2, ang=-6, spread=1.08, flutter=130, phase=40, ash=3, glow=1, fan=1),
            p(oy=-1, ang=-8, spread=1.12, flutter=190, phase=60, ash=4, glow=2, fan=2, puff=1),
            p(oy=-1, ang=-4, spread=1.05, flutter=250, phase=80, ash=5, glow=1, fan=1),
            p(oy=0, flutter=310, phase=100, ash=0),
        ]
        signature = [
            p(oy=1, flutter=340, phase=350, ash=2),
            p(oy=-3, spread=1.15, flutter=40, phase=10, ash=3, glow=1),
            p(oy=-4, spread=1.1, flutter=100, phase=30, ash=4, glow=2, scroll=1),
            p(oy=-3, ang=-4, spread=1.12, flutter=160, phase=50, ash=5, glow=3, scroll=3, puff=2),
            p(oy=-2, spread=1.05, flutter=220, phase=70, ash=0, glow=1, scroll=2),
            p(oy=0, flutter=280, phase=90, ash=1),
        ]
        hurt = [
            p(ox=4, ang=6, spread=1.22, jitter=3.0, flutter=30, phase=200, ash=2, puff=1),
            p(ox=3, oy=3, sy=0.92, spread=0.94, jitter=2.0, flutter=90, phase=210, ash=3),
            p(ox=2, oy=4, ang=-5, spread=1.18, jitter=2.5, flutter=150, phase=220, ash=4, shed=1),
            p(ox=1, oy=18, ang=6, sy=0.9, spread=1.3, jitter=2.0, flutter=210, phase=230, ash=5, shed=2, hood_tilt=18),
            p(heap=1, ash=1, phase=240),
            p(heap=2, ash=2, phase=250),
        ]
        return {"locomotion": loco, "basic-attack": basic, "signature-attack": signature, "hurt-defeat": hurt}

    def draw_sheet(self, cv: Canvas, S: Xf, width: float, height: float, tone: str, singed: bool,
                   seed: int, dog_ear: bool = False, lines: str = "k1", clip: Image.Image | None = None) -> Image.Image:
        hw, hh = width / 2, height / 2
        outline = [(-hw, -hh), (hw - (3 if dog_ear else 0), -hh), (hw, -hh + (3 if dog_ear else 0)), (hw, hh), (-hw, hh)]
        sheet = S.poly(outline)
        if clip is not None:
            sheet = inter(sheet, clip)
        cv.part(sheet, self.paper_a if tone == "a" else self.paper_b, shadow=1)
        for row in range(int(-hh) + 3, int(hh) - 3, 3):
            x = -hw + 2
            while x < hw - 3:
                length = 1 + hash2(seed, row * 7 + int(x), 31) % 4
                gap = 1 + hash2(int(x), row, seed) % 2
                cv.fill(inter(S.line([(x, row), (min(hw - 3, x + length), row)]), erode(sheet)), lines)
                x += length + gap + 1
        if singed:
            char = inter(sheet, S.poly([(-hw - 1, hh - 3), (hw + 1, hh - 3), (hw + 1, hh + 1), (-hw - 1, hh + 1)]))
            cv.fill(char, "a1")
            edge = inter(sheet, S.poly([(-hw - 1, hh - 1), (hw + 1, hh - 1), (hw + 1, hh + 1), (-hw - 1, hh + 1)]))
            cv.fill(edge, "a0")
            bite = dots([(x, y) for y in range(F) for x in range(F) if hash2(x, y, seed + 7) % 3 == 0])
            cv.clear(inter(edge, bite))
        return sheet

    def draw_ash(self, cv: Canvas, cx: float, cy: float, pose: dict) -> None:
        for index in range(12):
            hx = hash2(index, 3, 91)
            hy = hash2(index, 5, 93)
            x = cx - 36 + hx % 72
            span = 96
            y = cy + 50 - ((hy % span) + pose["ash"] * 5) % span
            if pose["heap"]:
                y = 147 - 6 - (hy % 30) - pose["ash"] * 3
            if not (GUTTER + 1 <= x <= F - GUTTER - 3 and GUTTER + 1 <= y <= F - GUTTER - 2):
                continue
            size = 2 if index % 3 == 0 else 1
            cv.fill(rect(x, y, x + size - 1, y), "a2" if index % 2 else "a3")

    def draw_loose_pages(self, cv: Canvas, cx: float, cy: float, pose: dict, front: bool) -> None:
        for index in range(2):
            degrees = pose["phase"] * 2 + index * 180 + 40
            px, py = polar(cx, cy - 6, 38, degrees)
            py = cy - 6 + (py - cy + 6) * 0.3
            is_front = math.sin(math.radians(degrees)) >= 0
            if is_front != front:
                continue
            S = Xf(px, py, (degrees % 60) - 30)
            self.draw_sheet(cv, S, 7, 9, "a" if index else "b", False, 50 + index)

    def draw_body(self, cv: Canvas, T: Xf, pose: dict, cx: float, cy: float) -> None:
        spread = pose["spread"]
        base_angle = math.degrees(math.atan2(T.s, T.c))
        sway = 3 * round(math.sin(math.radians(pose["flutter"])), 12) * pose["jitter"]
        cord_pts = [T.pt(8, 8), T.pt(24, 22), T.pt(22, 36), T.pt(31, 46), T.pt(30 + sway, 54)]
        cord = line(cord_pts, 2)
        cv.fill(sub(dilate(cord), cord), "t0")
        cv.fill(cord, "t1")
        cv.fill(inter(cord, shift(cord, -1, -1)), "t2")
        for side, (a, b, width) in enumerate([((15, -11), (27, 11), 6), ((-15, -12), (-28, 12), 7)]):
            sleeve_angle = math.degrees(math.atan2(-(b[0] - a[0]), b[1] - a[1]))
            mid = ((a[0] + b[0]) / 2 * spread, (a[1] + b[1]) / 2)
            jit = pose["jitter"] * 4 * round(math.sin(math.radians(pose["flutter"] + side * 140)), 12)
            S = Xf(*T.pt(*mid), ang=base_angle - sleeve_angle * spread + jit, sx=T.sx, sy=T.sy)
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            self.draw_sheet(cv, S, width, length, "b" if side == 0 else "a", True, 20 + side)
        for index, (x, y, angle, length) in enumerate(TESTIMONY_TATTERS):
            jit = pose["jitter"] * 5 * round(math.sin(math.radians(pose["flutter"] + index * 100)), 12)
            S = Xf(*T.pt(x * spread + sway * 0.5, y), ang=base_angle + angle + jit, sx=T.sx, sy=T.sy, pre=(0, length / 2))
            self.draw_sheet(cv, S, 4, length, "b", True, 40 + index)
        robe_pts = [(x * spread + (sway if y > 30 else 0) * (y - 30) / 30, y) for x, y in TESTIMONY_ROBE]
        robe = T.poly(robe_pts)
        cv.part(robe, self.paper_b, shadow=2)
        for index, (x, y, width, height, angle, tone) in enumerate(TESTIMONY_SHEETS):
            if pose["shed"] and index in TESTIMONY_SHED[pose["shed"]]:
                continue
            jit = pose["jitter"] * 2.2 * round(math.sin(math.radians(pose["flutter"] + index * 47)), 12)
            S = Xf(*T.pt(x * spread, y), ang=base_angle + angle * spread + jit, sx=T.sx, sy=T.sy)
            self.draw_sheet(cv, S, width, height, tone, False, index + 1, dog_ear=index % 4 == 1, clip=robe)
        hem_band = sub(robe, shift(robe, 0, -3))
        cv.fill(hem_band, "a1")
        hem_edge = sub(robe, shift(robe, 0, -1))
        cv.fill(hem_edge, "a0")
        bites = dots([(x, y) for y in range(F) for x in range(F) if hash2(x, y, 7) % 3 == 0])
        cv.clear(inter(hem_edge, bites))
        for index, (x, y, width, height, angle) in enumerate(TESTIMONY_SHOULDER_PAGES):
            jit = pose["jitter"] * 3 * round(math.sin(math.radians(pose["flutter"] + 60 + index * 150)), 12)
            S = Xf(*T.pt(x * spread, y), ang=base_angle + angle * spread + jit, sx=T.sx, sy=T.sy)
            self.draw_sheet(cv, S, width, height, "a", False, 30 + index)
        H = Xf(*T.pt(0, -14), ang=base_angle + pose["hood_tilt"], sx=T.sx, sy=T.sy, pre=(0, 14))
        hood = H.poly(TESTIMONY_HOOD)
        cv.part(hood, self.paper_a, shadow=2)
        fold = inter(H.line([(-4, -46), (2, -30), (6, -14)]), erode(hood))
        cv.fill(fold, "pa1")
        fold2 = inter(H.line([(7, -44), (12, -26)]), erode(hood))
        cv.fill(fold2, "pa1")
        recess = H.poly(TESTIMONY_RECESS)
        cv.fill(recess, "k0")
        cv.fill(sub(recess, inter(shift(recess, -1, 0), shift(recess, 0, -1))), "ink")
        lx, ly = H.pt(-6, -27)
        cv.fill(rect(lx, ly, lx + 1, ly), "g2" if pose["glow"] else "g1")
        if pose["glow"] >= 2:
            cv.fill(dots([(lx, ly - 1), (lx + 1, ly + 1)]), "g3")
        gap = T.poly([(-7, -6), (5, -6), (5, 10), (-7, 10)])
        cv.fill(sub(dilate(gap), gap), "pa0")
        cv.fill(gap, "k0")
        border = sub(gap, erode(gap))
        dashes = dots([(x, y) for y in range(F) for x in range(F) if (x + y) % 4 < 2])
        cv.fill(inter(border, dashes), {0: "g1", 1: "g2", 2: "g2", 3: "g3"}[pose["glow"]])
        if pose["glow"] >= 2:
            cv.fill(inter(erode(gap), dots([(x, y) for y in range(F) for x in range(F) if (x * 3 + y) % 7 == 0])),
                    "g1")

    def draw_fan(self, cv: Canvas, cx: float, cy: float, stage: int) -> None:
        count = 4 if stage == 2 else 2
        for index in range(count):
            reach = 1.0 if stage == 2 else 0.55
            px = cx - 18 - (12 + index * 8) * reach
            py = cy - 16 + index * 9
            S = Xf(px, py, -38 + index * 22)
            sheet = self.draw_sheet(cv, S, 12, 15, "a", False, 70 + index, lines="k0")
            if stage == 2:
                cv.fill(sub(sheet, erode(sheet)), "g2")
        if stage == 2:
            for sx, sy in [(cx - 62, cy - 22), (cx - 66, cy + 4), (cx - 58, cy + 24)]:
                cv.fill(poly([(sx, sy - 2), (sx + 1, sy), (sx, sy + 2), (sx - 1, sy)]), "g3")

    def draw_scroll(self, cv: Canvas, cx: float, cy: float, stage: int) -> None:
        length = {1: 4, 2: 30, 3: 54}[stage]
        x0 = cx - 10
        x1 = x0 - length
        top, bottom = cy - 6, cy + 7
        if length > 6:
            band = rect(x1, top, x0, bottom)
            cv.part(band, self.paper_a, shadow=1)
            x = x1 + 3
            while x < x0 - 3:
                for row in (top + 3, top + 6, top + 9):
                    width = 1 + hash2(int(x), row, 61) % 3
                    cv.fill(rect(x, row, min(x0 - 3, x + width), row), "k0" if stage == 3 else "k1")
                x += 6
            if stage == 3:
                cv.fill(sub(band, erode(band)), "g2")
        roller = rect(x1 - 3, top - 3, x1, bottom + 3)
        cv.part(roller, ramp("pa0", "a0", "a1", "a2", "a3", "a3"), shadow=1)
        cv.fill(rect(x1 - 3, top - 3, x1, top - 2), "g1")
        cv.fill(rect(x1 - 3, bottom + 2, x1, bottom + 3), "g1")
        if stage == 3:
            for sx, sy in [(x1 - 8, top - 10), (x1 + 14, bottom + 10), (x1 + 30, top - 12), (x1 - 6, bottom + 12)]:
                cv.fill(poly([(sx, sy - 2), (sx + 1, sy), (sx, sy + 2), (sx - 1, sy)]), "g3")

    def draw_puff(self, cv: Canvas, cx: float, cy: float, stage: int) -> None:
        for index in range(10 if stage == 2 else 6):
            degrees = 100 + index * 16 + hash2(index, stage, 77) % 9
            radius = 30 + hash2(index, stage, 79) % 14
            px, py = polar(cx, cy, radius, degrees)
            size = 2 if index % 2 else 1
            cv.fill(rect(px, py, px + size, py + size - 1), "a2" if index % 3 else "a3")

    def render_heap(self, cv: Canvas, pose: dict) -> None:
        ground = 147
        if pose["heap"] == 1:
            layout = [(52, ground - 2, -8, "b"), (74, ground - 3, 6, "a"), (96, ground - 2, -4, "a"),
                      (64, ground - 7, 12, "a"), (88, ground - 8, -10, "b"), (110, ground - 1, 3, "b"),
                      (78, ground - 13, 4, "a")]
            for index, (x, y, angle, tone) in enumerate(layout):
                self.draw_sheet(cv, Xf(x, y, angle), 18, 5, tone, index < 3, 90 + index)
            hood = Xf(118, ground - 7, 64).poly([(-8, -6), (6, -8), (8, 4), (-6, 7)])
            cv.part(hood, self.paper_a, shadow=1)
            return
        stack_x = 80
        for level in range(6):
            y = ground - 1 - level * 3
            offset = (-1, 1, 0, -2, 1, 0)[level]
            sheet = rect(stack_x - 17 + offset, y - 2, stack_x + 17 + offset, y)
            cv.part(sheet, self.paper_a if level % 2 else self.paper_b, shadow=1, light=0)
            cv.fill(inter(sheet, line([(stack_x - 15 + offset, y - 1), (stack_x + 15 + offset, y - 1)])),
                    "pa3" if level % 2 else "pb3")
        top_y = ground - 1 - 6 * 3
        top = rect(stack_x - 16, top_y - 2, stack_x + 16, top_y)
        cv.part(top, ramp("pa0", "g1", "g1", "pa4", "g3", "g3"), shadow=1, light=0)
        for x in range(stack_x - 13, stack_x + 13, 4):
            cv.fill(rect(x, top_y - 1, x + 1, top_y - 1), "k1")
        band = rect(stack_x + 4, top_y - 3, stack_x + 6, ground)
        cv.fill(sub(dilate(band), band), "t0")
        cv.fill(band, "t1")
        cv.fill(rect(stack_x + 4, top_y - 3, stack_x + 4, ground), "t2")
        bow = union(poly([(stack_x + 5, top_y - 3), (stack_x - 2, top_y - 8), (stack_x - 1, top_y - 2)]),
                    poly([(stack_x + 5, top_y - 3), (stack_x + 12, top_y - 8), (stack_x + 11, top_y - 2)]))
        cv.part(bow, self.cord, shadow=1)
        cv.fill(rect(stack_x + 4, top_y - 4, stack_x + 6, top_y - 2), "t2")
        for sx, sy in [(stack_x - 10, top_y - 10), (stack_x + 16, top_y - 14), (stack_x - 2, top_y - 19)]:
            cv.fill(poly([(sx, sy - 1), (sx + 1, sy), (sx, sy + 1), (sx - 1, sy)]), "g3")

    def render(self, clip: str, index: int) -> Image.Image:
        pose = self.poses[clip][index]
        cv = Canvas(self.palette)
        bx, by = self.base
        cx, cy = bx + pose["ox"], by + pose["oy"]
        self.draw_ash(cv, cx, cy, pose)
        if pose["heap"]:
            self.render_heap(cv, pose)
            return cv.img
        T = Xf(cx, cy, pose["ang"], sy=pose["sy"])
        self.draw_loose_pages(cv, cx, cy, pose, front=False)
        self.draw_body(cv, T, pose, cx, cy)
        self.draw_loose_pages(cv, cx, cy, pose, front=True)
        if pose["shed"]:
            for k, (sx, sy, angle) in enumerate([(cx + 34, cy + 10, 30), (cx + 40, cy - 14, -50)][:pose["shed"]]):
                self.draw_sheet(cv, Xf(sx, sy + pose["shed"] * 6, angle), 13, 18, "b", True, 60 + k)
        if pose["fan"]:
            self.draw_fan(cv, cx, cy, pose["fan"])
        if pose["scroll"]:
            self.draw_scroll(cv, cx, cy, pose["scroll"])
        if pose["puff"]:
            self.draw_puff(cv, cx, cy, pose["puff"])
        return cv.img


# ---------------------------------------------------------------------------
# Build pipeline
# ---------------------------------------------------------------------------


def load_source() -> tuple[dict, bytes]:
    source_bytes = SOURCE_PATH.read_bytes()
    return json.loads(source_bytes.decode("utf-8")), source_bytes


def make_family(enemy_id: str):
    if enemy_id == "blood-ward-west":
        return BloodWard("west")
    if enemy_id == "blood-ward-east":
        return BloodWard("east")
    if enemy_id == "tithe-seal":
        return TitheSeal()
    if enemy_id == "court-clone":
        return CourtClone()
    if enemy_id == "unfiled-testimony":
        return UnfiledTestimony()
    raise KeyError(enemy_id)


def png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=False, compress_level=9)
    return buffer.getvalue()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_cel(enemy_id: str, clip_id: str, index: int, cel: Image.Image, palette: dict) -> dict:
    allowed = {rgba(value) for value in palette.values()}
    pixels = list(cel.getdata())
    alpha_values = sorted({pixel[3] for pixel in pixels})
    if any(value not in (0, 255) for value in alpha_values):
        raise ValueError(f"{enemy_id}:{clip_id}:{index} has partial alpha {alpha_values}")
    visible = {pixel for pixel in pixels if pixel[3]}
    stray = visible - allowed
    if stray:
        raise ValueError(f"{enemy_id}:{clip_id}:{index} has off-palette colors {sorted(stray)[:4]}")
    bounds = cel.getbbox()
    if bounds is None:
        raise ValueError(f"{enemy_id}:{clip_id}:{index} is empty")
    gutter = {"left": bounds[0], "top": bounds[1], "right": F - bounds[2], "bottom": F - bounds[3]}
    if min(gutter.values()) < GUTTER:
        if LENIENT:
            print(f"WARN {enemy_id}:{clip_id}:{index} gutter {gutter}")
        else:
                raise ValueError(f"{enemy_id}:{clip_id}:{index} violates the {GUTTER}px gutter: {gutter}")
    return {
        "alphaBounds": list(bounds),
        "transparentGutter": gutter,
        "visibleColors": len(visible),
        "alphaValues": alpha_values,
    }


def review_sheet(enemy: dict, cels: dict, clips: list[dict], profile: dict) -> Image.Image:
    font = ImageFont.load_default_imagefont()
    cell = F * REVIEW_SCALE
    label_h = 18
    title_h = 30
    sheet = Image.new("RGB", (COLS * cell, title_h + ROWS * (cell + label_h)), (10, 12, 22))
    draw = ImageDraw.Draw(sheet)
    draw.text((10, 10), f"{enemy['catalogId']} {enemy['name'].upper()} / {enemy['id']} - 3X REVIEW ONLY, NOT RUNTIME",
              fill=(232, 207, 123), font=font)
    pivot = profile["pivot"]
    for clip in clips:
        row = clip["row"]
        for index in range(COLS):
            x0 = index * cell
            y0 = title_h + row * (cell + label_h)
            for ty in range(0, cell, 24):
                for tx in range(0, cell, 24):
                    shade = (30, 34, 50) if (tx // 24 + ty // 24) % 2 else (36, 41, 60)
                    draw.rectangle((x0 + tx, y0 + ty, x0 + tx + 23, y0 + ty + 23), fill=shade)
            gy = y0 + pivot[1] * REVIEW_SCALE
            draw.line((x0, gy, x0 + cell - 1, gy), fill=(92, 70, 96))
            px = x0 + pivot[0] * REVIEW_SCALE
            draw.line((px - 6, gy, px + 6, gy), fill=(120, 200, 196))
            draw.line((px, gy - 6, px, gy + 6), fill=(120, 200, 196))
            big = cels[(clip["id"], index)].resize((cell, cell), Image.Resampling.NEAREST)
            sheet.paste(big, (x0, y0), big)
            draw.rectangle((x0, y0, x0 + cell - 1, y0 + cell - 1), outline=(60, 72, 104))
            event = next((e["name"] for e in clip["events"] if e["frameIndex"] == index), "")
            label = f"{clip['id']} {index + 1}/6 {clip['phases'][index]} {clip['frameDurationsMs'][index]}ms {event}"
            draw.text((x0 + 6, y0 + cell + 4), label, fill=(170, 186, 210), font=font)
    return sheet


CONTACT_KEYS = [
    ("locomotion", 5, "idle/ready"),
    ("locomotion", 2, "move"),
    ("basic-attack", 1, "wind-up"),
    ("basic-attack", 3, "active"),
    ("signature-attack", 2, "sig charge"),
    ("signature-attack", 3, "sig active"),
    ("hurt-defeat", 0, "hurt"),
    ("hurt-defeat", 5, "defeat hold"),
]


def contact_sheet(enemies: list[dict], all_cels: dict) -> Image.Image:
    font = ImageFont.load_default_imagefont()
    scale = 2
    cell = F * scale
    label_h = 16
    title_h = 28
    row_h = cell + label_h
    sheet = Image.new("RGB", (len(CONTACT_KEYS) * cell, title_h + len(enemies) * row_h), (10, 12, 22))
    draw = ImageDraw.Draw(sheet)
    draw.text((10, 9), "ENEMY ANIMATION SUITE V4 - PIXEL-AUTHORED KEY FRAMES AT 2X - REVIEW ONLY", fill=(232, 207, 123), font=font)
    for row, enemy in enumerate(enemies):
        for column, (clip_id, index, label) in enumerate(CONTACT_KEYS):
            x0 = column * cell
            y0 = title_h + row * row_h
            draw.rectangle((x0, y0, x0 + cell - 1, y0 + cell - 1), fill=(28, 32, 48), outline=(56, 66, 96))
            big = all_cels[enemy["id"]][(clip_id, index)].resize((cell, cell), Image.Resampling.NEAREST)
            sheet.paste(big, (x0, y0), big)
            draw.text((x0 + 4, y0 + cell + 3), f"{enemy['id']} {label}", fill=(170, 186, 210), font=font)
    return sheet


def render_all(only: set[str] | None = None) -> tuple[dict[str, bytes], dict]:
    source, source_bytes = load_source()
    clips = source["clips"]
    outputs: dict[str, bytes] = {}
    enemy_records = []
    frame_records = []
    exports = []
    all_cels = {}
    enemies = [enemy for enemy in source["enemies"] if not only or enemy["id"] in only]
    for enemy in enemies:
        family = make_family(enemy["id"])
        profile = source["anchorProfiles"][enemy["profile"]]
        atlas = Image.new("RGBA", (COLS * F, ROWS * F), (0, 0, 0, 0))
        cels = {}
        hashes = set()
        max_colors = 0
        for clip in clips:
            for index in range(COLS):
                cel = family.render(clip["id"], index)
                stats = validate_cel(enemy["id"], clip["id"], index, cel, family.palette)
                cels[(clip["id"], index)] = cel
                atlas.alpha_composite(cel, (index * F, clip["row"] * F))
                digest = sha256(cel.tobytes())
                hashes.add(digest)
                max_colors = max(max_colors, stats["visibleColors"])
                events = [e["name"] for e in clip["events"] if e["frameIndex"] == index]
                if clip["id"] == "signature-attack" and index == 3:
                    events = [enemy["signatureId"]]
                frame_records.append({
                    "id": f"{enemy['id']}:{clip['id']}:{index}",
                    "enemyId": enemy["id"],
                    "clipId": clip["id"],
                    "row": clip["row"],
                    "frameIndex": index,
                    "rect": [index * F, clip["row"] * F, F, F],
                    "durationMs": clip["frameDurationsMs"][index],
                    "phase": clip["phases"][index],
                    "events": events,
                    "pivot": profile["pivot"],
                    "foot": profile["foot"],
                    "hurtBounds": profile["hurtBounds"],
                    "rgbaSha256": digest,
                    **stats,
                })
        if len(hashes) != COLS * ROWS:
            if not LENIENT:
                raise ValueError(f"{enemy['id']} must keep {COLS * ROWS} distinct cels; found {len(hashes)}")
            print(f"WARN {enemy['id']} distinct cels {len(hashes)}")
        atlas_colors = {pixel for pixel in atlas.getdata() if pixel[3]}
        if len(atlas_colors) > source["runtimeAtlas"]["visibleColorCeiling"]:
            raise ValueError(f"{enemy['id']} uses {len(atlas_colors)} colors")
        atlas_name = f"{enemy['id']}-atlas-v4.png"
        review_name = f"{enemy['id']}-review-3x-v4.png"
        outputs[atlas_name] = png_bytes(atlas)
        outputs[review_name] = png_bytes(review_sheet(enemy, cels, clips, profile))
        all_cels[enemy["id"]] = cels
        exports.append({"path": atlas_name, "role": "transparent-runtime-atlas", "enemyId": enemy["id"],
                        "sha256": sha256(outputs[atlas_name]), "width": atlas.width, "height": atlas.height,
                        "mode": atlas.mode, "runtime": True})
        review_image = Image.open(io.BytesIO(outputs[review_name]))
        exports.append({"path": review_name, "role": "labeled-3x-review-only-not-runtime", "enemyId": enemy["id"],
                        "sha256": sha256(outputs[review_name]), "width": review_image.width,
                        "height": review_image.height, "mode": review_image.mode, "runtime": False})
        enemy_records.append({
            **{key: enemy[key] for key in ("catalogId", "group", "id", "name", "role", "profile", "signatureId", "idleLoop")},
            "atlas": atlas_name,
            "review": review_name,
            "frameCount": COLS * ROWS,
            "distinctFrameCount": len(hashes),
            "paletteSize": len(family.palette),
            "palette": family.palette,
            "visibleColorsInAtlas": len(atlas_colors),
            "maximumVisibleColorsInFrame": max_colors,
        })
    contact = contact_sheet(enemies, all_cels)
    outputs[CONTACT_SHEET_NAME] = png_bytes(contact)
    exports.append({"path": CONTACT_SHEET_NAME, "role": "labeled-2x-key-frame-contact-sheet-review-only",
                    "sha256": sha256(outputs[CONTACT_SHEET_NAME]), "width": contact.width,
                    "height": contact.height, "mode": contact.mode, "runtime": False})
    builder_bytes = Path(__file__).read_bytes()
    manifest = {
        "schemaVersion": 1,
        "assetId": source["assetId"],
        "title": source["title"],
        "status": source["status"],
        "provenance": source["provenance"],
        "build": {
            "builder": Path(__file__).name,
            "builderSha256": sha256(builder_bytes),
            "source": SOURCE_PATH.name,
            "sourceSha256": sha256(source_bytes),
            "pillowVersion": PILLOW_VERSION,
            "check": f"python {Path(__file__).name} --check",
        },
        "geometry": source["runtimeAtlas"],
        "clips": clips,
        "anchorProfiles": source["anchorProfiles"],
        "enemyOrder": [enemy["id"] for enemy in enemies],
        "enemies": enemy_records,
        "exports": exports,
        "frames": frame_records,
        "runtimeIntegration": {
            "status": "packed-into-enemy-combat-animation-runtime-v1",
            "runtimeAtlas": "../enemy-combat-animation-runtime-v1/enemy-combat-animation-atlas-v1.png",
            "notes": "Rows are appended after the V2/V3 families; pivots, profiles, and idle-loop flags are mirrored in game/enemy-combat-animation-atlas.mjs.",
        },
    }
    outputs[MANIFEST_NAME] = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return outputs, manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--only", nargs="*", default=None, help="development preview into --out")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()
    if args.only is not None:
        global LENIENT
        LENIENT = True
        outputs, _ = render_all(set(args.only) if args.only else None)
        out_dir = Path(args.out or ROOT / "_preview")
        out_dir.mkdir(parents=True, exist_ok=True)
        for name, data in outputs.items():
            (out_dir / name).write_bytes(data)
        print(f"preview -> {out_dir}")
        return
    outputs, manifest = render_all()
    if args.check:
        stale = [name for name, data in outputs.items()
                 if not (ROOT / name).exists() or (ROOT / name).read_bytes() != data]
        if stale:
            raise SystemExit(f"stale or missing generated artifacts: {stale}")
        print(f"{len(outputs)} V4 artifacts are byte-identical")
        return
    for name, data in outputs.items():
        (ROOT / name).write_bytes(data)
    print(f"wrote {len(outputs)} V4 artifacts for {len(manifest['enemies'])} families")


if __name__ == "__main__":
    main()
