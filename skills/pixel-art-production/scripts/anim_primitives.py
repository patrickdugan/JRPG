#!/usr/bin/env python3
"""Deterministic mask primitives for code-authored pixel animation.

Shapes are rasterized at native resolution from integer-rounded vertices into
binary masks (Pillow mode ``L`` holding only 0 or 255). Masks are combined
with set operations, painted with named palette colors, shaded with hard edge
bands, and outlined with a 4-connected ink ring. Nothing is resampled,
filtered, blurred, or alpha-blended, so the output stays in the
pixel-authored lane.

Angle convention for side-view rigs drawn facing screen-right: an angle is
measured from straight *down* and grows toward the *forward* (+x) side.
0 = down, 90 = forward, 180 = up, -90 = backward, 135 = forward-up.
``limb_point`` and ``arc_band`` use it so key poses read like a choreographer's
notes ("blade at 150, elbow +30").

Run ``python anim_primitives.py --check`` for the self-test.
"""

from __future__ import annotations

import argparse
import math
from typing import Iterable, Mapping, Sequence

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from anim_timeline import cos_d, ri, rnd, sin_d

Point = tuple[float, float]


def rgba(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    if len(value) == 6:
        value += "FF"
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4, 6))  # type: ignore[return-value]


def limb_point(origin: Point, length: float, angle: float) -> Point:
    """End point of a segment of ``length`` at ``angle`` (0 down, 90 forward, 180 up)."""
    return (rnd(origin[0] + length * sin_d(angle)), rnd(origin[1] + length * cos_d(angle)))


def rotate_about(point: Point, pivot: Point, degrees: float) -> Point:
    """Rotate ``point`` about ``pivot``; positive degrees turn clockwise on screen (y down)."""
    c, s = cos_d(degrees), sin_d(degrees)
    x, y = point[0] - pivot[0], point[1] - pivot[1]
    return (rnd(pivot[0] + x * c - y * s), rnd(pivot[1] + x * s + y * c))


class Xf:
    """2-D affine transform ``(a, b, c, d, e, f)``: x' = ax + by + c, y' = dx + ey + f."""

    __slots__ = ("m",)

    def __init__(self, m: Sequence[float] = (1, 0, 0, 0, 1, 0)):
        self.m = tuple(float(v) for v in m)

    @staticmethod
    def translate(dx: float, dy: float) -> "Xf":
        return Xf((1, 0, dx, 0, 1, dy))

    @staticmethod
    def rotate(degrees: float, pivot: Point = (0.0, 0.0)) -> "Xf":
        c, s = cos_d(degrees), sin_d(degrees)
        px, py = pivot
        return Xf((c, -s, px - c * px + s * py, s, c, py - s * px - c * py))

    @staticmethod
    def scale(sx: float, sy: float | None = None, pivot: Point = (0.0, 0.0)) -> "Xf":
        sy = sx if sy is None else sy
        px, py = pivot
        return Xf((sx, 0, px - sx * px, 0, sy, py - sy * py))

    def then(self, other: "Xf") -> "Xf":
        """Apply ``self`` first, then ``other``."""
        a, b, c, d, e, f = self.m
        A, B, C, D, E, F = other.m
        return Xf((A * a + B * d, A * b + B * e, A * c + B * f + C,
                   D * a + E * d, D * b + E * e, D * c + E * f + F))

    def pt(self, x: float, y: float) -> Point:
        a, b, c, d, e, f = self.m
        return (rnd(a * x + b * y + c), rnd(d * x + e * y + f))

    def pts(self, points: Iterable[Point]) -> list[Point]:
        return [self.pt(x, y) for x, y in points]


# ---------------------------------------------------------------------------
# Binary masks
# ---------------------------------------------------------------------------


class Masks:
    """Mask factory bound to one canvas size and an integer origin offset."""

    def __init__(self, size: tuple[int, int], origin: tuple[int, int] = (0, 0)):
        self.size = size
        self.ox, self.oy = origin

    def blank(self) -> Image.Image:
        return Image.new("L", self.size, 0)

    def _ipts(self, points: Iterable[Point]) -> list[tuple[int, int]]:
        return [(ri(x) + self.ox, ri(y) + self.oy) for x, y in points]

    def poly(self, points: Sequence[Point]) -> Image.Image:
        mask = self.blank()
        pts = self._ipts(points)
        if len(pts) >= 3:
            ImageDraw.Draw(mask).polygon(pts, fill=255)
        elif pts:
            ImageDraw.Draw(mask).line(pts, fill=255, width=1)
        return mask

    def rect(self, x0: float, y0: float, x1: float, y1: float) -> Image.Image:
        mask = self.blank()
        (ax, ay), (bx, by) = self._ipts([(min(x0, x1), min(y0, y1)), (max(x0, x1), max(y0, y1))])
        ImageDraw.Draw(mask).rectangle((ax, ay, bx, by), fill=255)
        return mask

    def ellipse(self, cx: float, cy: float, rx: float, ry: float | None = None) -> Image.Image:
        ry = rx if ry is None else ry
        mask = self.blank()
        (ax, ay), (bx, by) = self._ipts([(cx - rx, cy - ry), (cx + rx, cy + ry)])
        if bx <= ax or by <= ay:
            ImageDraw.Draw(mask).point((ax, ay), fill=255)
        else:
            ImageDraw.Draw(mask).ellipse((ax, ay, bx, by), fill=255)
        return mask

    def taper(self, p0: Point, p1: Point, w0: float, w1: float) -> Image.Image:
        """Quadrilateral strip from ``p0`` (width ``w0``) to ``p1`` (width ``w1``)."""
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        length = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / length, dx / length
        h0, h1 = w0 / 2.0, w1 / 2.0
        return self.poly([
            (p0[0] + nx * h0, p0[1] + ny * h0), (p1[0] + nx * h1, p1[1] + ny * h1),
            (p1[0] - nx * h1, p1[1] - ny * h1), (p0[0] - nx * h0, p0[1] - ny * h0),
        ])

    def capsule(self, p0: Point, p1: Point, r0: float, r1: float | None = None) -> Image.Image:
        """Rounded limb: tapered strip plus end discs (radius ``r0`` -> ``r1``)."""
        r1 = r0 if r1 is None else r1
        return union(self.taper(p0, p1, r0 * 2.0, r1 * 2.0), self.ellipse(*p0, r0), self.ellipse(*p1, r1))

    def stroke(self, points: Sequence[Point], width: float) -> Image.Image:
        """Polyline of capsules with constant ``width`` (pixel-art friendly joints)."""
        if len(points) == 1:
            return self.ellipse(points[0][0], points[0][1], width / 2.0)
        return union(*(self.capsule(a, b, width / 2.0) for a, b in zip(points, points[1:])))

    def arc_band(self, center: Point, r_in: float, r_out: float, a0: float, a1: float,
                 steps: int = 10, taper_end: bool = True) -> Image.Image:
        """Curved band between radii, from angle ``a0`` to ``a1`` (rig convention).

        Used for smears: draw it on the strike's active frames so the eye reads
        the weapon arc. ``taper_end`` narrows the trailing end to a point.
        """
        steps = max(2, steps)
        outer, inner = [], []
        for index in range(steps + 1):
            u = index / steps
            angle = a0 + (a1 - a0) * u
            thickness = (r_out - r_in) * (u if taper_end else 1.0)
            outer.append(limb_point(center, r_in + thickness, angle))
            inner.append(limb_point(center, r_in, angle))
        return self.poly(outer + inner[::-1])


def union(*masks: Image.Image) -> Image.Image:
    masks = [m for m in masks if m is not None]
    out = masks[0].copy()
    for mask in masks[1:]:
        out = ImageChops.lighter(out, mask)
    return out


def inter(a: Image.Image, b: Image.Image) -> Image.Image:
    return ImageChops.darker(a, b)


def sub(a: Image.Image, b: Image.Image) -> Image.Image:
    return ImageChops.subtract(a, b)


def shift(mask: Image.Image, dx: int, dy: int) -> Image.Image:
    out = Image.new("L", mask.size, 0)
    bbox = mask.getbbox()
    if bbox is None:
        return out
    out.paste(mask.crop(bbox), (bbox[0] + int(dx), bbox[1] + int(dy)))
    return out


def dilate4(mask: Image.Image, steps: int = 1) -> Image.Image:
    out = mask
    for _ in range(steps):
        out = union(out, shift(out, 1, 0), shift(out, -1, 0), shift(out, 0, 1), shift(out, 0, -1))
    return out


def erode4(mask: Image.Image, steps: int = 1) -> Image.Image:
    out = mask
    for _ in range(steps):
        out = inter(inter(out, shift(out, 1, 0)), inter(inter(shift(out, -1, 0), shift(out, 0, 1)), shift(out, 0, -1)))
    return out


def is_empty(mask: Image.Image) -> bool:
    return mask.getbbox() is None


def edge_band(mask: Image.Image, dx: int, dy: int, width: int = 1) -> Image.Image:
    """Pixels of ``mask`` within ``width`` px of its edge in direction ``(dx, dy)``."""
    inner = mask
    for step in range(1, width + 1):
        inner = inter(inner, shift(mask, -dx * step, -dy * step))
    return sub(mask, inner)


def prune_orphans(mask: Image.Image) -> Image.Image:
    """Remove single pixels with no 4-connected neighbour (rotation/scale debris)."""
    neighbours = union(shift(mask, 1, 0), shift(mask, -1, 0), shift(mask, 0, 1), shift(mask, 0, -1))
    return inter(mask, neighbours)


def fill_pinholes(mask: Image.Image) -> Image.Image:
    """Fill empty pixels enclosed on all four sides (joint-gap pinholes)."""
    enclosed = inter(inter(shift(mask, 1, 0), shift(mask, -1, 0)), inter(shift(mask, 0, 1), shift(mask, 0, -1)))
    return union(mask, enclosed)


# ---------------------------------------------------------------------------
# Painting
# ---------------------------------------------------------------------------


class Canvas:
    """RGBA cel painted only with named palette colors through binary masks."""

    def __init__(self, size: tuple[int, int], palette: Mapping[str, str], origin: tuple[int, int] = (0, 0)):
        self.size = size
        self.palette = {name: rgba(value) for name, value in palette.items()}
        self.image = Image.new("RGBA", size, (0, 0, 0, 0))
        self.m = Masks(size, origin)

    def color(self, name: str) -> tuple[int, int, int, int]:
        try:
            return self.palette[name]
        except KeyError as error:
            raise KeyError(f"Color {name!r} is not in the palette {sorted(self.palette)}") from error

    def paint(self, mask: Image.Image, name: str) -> None:
        bbox = mask.getbbox()
        if bbox is not None:  # paste only the covered box: identical result, far less work
            self.image.paste(self.color(name), bbox, mask.crop(bbox))

    def clear(self, mask: Image.Image) -> None:
        bbox = mask.getbbox()
        if bbox is not None:
            self.image.paste((0, 0, 0, 0), bbox, mask.crop(bbox))

    def coverage(self) -> Image.Image:
        return self.image.getchannel("A").point(lambda value: 255 if value else 0)

    def paint_at(self, mask: Image.Image, name: str, offset: tuple[int, int]) -> None:
        """Paint a local mask whose (0, 0) sits at ``offset`` on the canvas."""
        bbox = mask.getbbox()
        if bbox is not None:
            box = (offset[0] + bbox[0], offset[1] + bbox[1], offset[0] + bbox[2], offset[1] + bbox[3])
            self.image.paste(self.color(name), box, mask.crop(bbox))

    def part(self, mask: Image.Image, base: str, dark: str | None = None, light: str | None = None,
             ring: str | None = None, dark_width: int = 2, light_width: int = 1,
             dark_dir: tuple[int, int] = (1, 1), light_dir: tuple[int, int] = (-1, -1)) -> None:
        """Paint a lit volume: optional ink ring, base fill, hard dark and light edge bands.

        Work happens on a crop around the mask (plus a margin for the ring), so
        cost scales with the part, not the canvas.
        """
        bbox = mask.getbbox()
        if bbox is None:
            return
        pad = 4
        box = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
               min(mask.width, bbox[2] + pad), min(mask.height, bbox[3] + pad))
        local = mask.crop(box)
        at = (box[0], box[1])
        if ring:
            self.paint_at(sub(dilate4(local), local), ring, at)
        self.paint_at(local, base, at)
        if dark and dark_width:
            band = union(edge_band(local, dark_dir[0], 0, dark_width), edge_band(local, 0, dark_dir[1], dark_width))
            self.paint_at(band, dark, at)
        if light and light_width:
            band = union(edge_band(local, light_dir[0], 0, light_width), edge_band(local, 0, light_dir[1], light_width))
            self.paint_at(band, light, at)

    def outline(self, name: str = "ink", eight_connected: bool = False) -> None:
        """Ring the whole silhouette once. 4-connected keeps corners crisp (selout-friendly)."""
        alpha = self.coverage()
        grown = alpha.filter(ImageFilter.MaxFilter(3)) if eight_connected else dilate4(alpha)
        self.paint(sub(grown, alpha), name)

    def colors_used(self) -> set[tuple[int, int, int, int]]:
        return {pixel for pixel in self.image.getdata() if pixel[3]}


def _self_test() -> None:
    canvas = Canvas((40, 40), {"ink": "#0B1020", "body": "#5A3A2C", "dark": "#2C2025", "light": "#8B6043"})
    arm = canvas.m.capsule((10, 10), limb_point((10, 10), 18, 90), 3)
    canvas.part(arm, "body", "dark", "light", ring="ink")
    canvas.outline()
    used = canvas.colors_used()
    assert used <= set(canvas.palette.values()), used
    alpha = canvas.image.getchannel("A")
    assert set(alpha.getdata()) <= {0, 255}, "binary alpha only"
    assert limb_point((0, 0), 10, 90) == (10.0, 0.0) and limb_point((0, 0), 10, 180) == (0.0, -10.0)
    xf = Xf.translate(5, 0).then(Xf.rotate(90))
    assert xf.pt(1, 0) == (0.0, 6.0)
    m = Masks((9, 9))
    dot = m.rect(4, 4, 4, 4)
    assert is_empty(prune_orphans(dot))
    ring = sub(m.rect(2, 2, 6, 6), m.rect(4, 4, 4, 4))
    assert fill_pinholes(ring).getpixel((4, 4)) == 255
    band = m.arc_band((4, 4), 1, 4, -90, 90)
    assert not is_empty(band)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="run the deterministic self-test")
    parser.parse_args()
    _self_test()
    print("anim_primitives self-test passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
