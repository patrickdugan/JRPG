#!/usr/bin/env python3
"""Build the deterministic side-view action-stage backdrop suite (v1).

Every pixel is authored by integer-coordinate code primitives drawn at the
native 480 x 270 resolution under an explicit per-stage palette. No raster is
imported, sampled, resampled, or generated. The runtime presents each backdrop
at an exact 2x integer scale on the 960 x 540 action canvas, and draws the
ground and one-way platform surfaces from the companion 16 x 16 surface-tile
atlas aligned to the physics contract in ``game/action-stages.mjs``.

Run without arguments to write outputs, or with ``--check`` for a non-writing
byte-identity receipt (two independent in-memory renders must also match).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
BUILDER_PATH = Path(__file__).resolve()
SUITE_ID = "action-stage-backdrop-suite-v1"
RUNTIME_ROOT = REPO / "game" / "assets" / "art" / SUITE_ID
MANIFEST_PATH = ROOT / "manifest.json"
TILES_NAME = "action-stage-surface-tiles.png"
REVIEW_NAME = "action-stage-backdrop-review-sheet.png"
BACKDROP_DIR = "backdrops"

W, H = 480, 270          # native backdrop size
SCALE = 2                # exact runtime integer scale -> 960 x 540
CANVAS_W, CANVAS_H = W * SCALE, H * SCALE
TILE = 16                # native surface tile size
TILE_ROLES = ("ground-a", "ground-b", "platform-left", "platform-middle", "platform-right", "support")
CALM_BAND_TOP = 64       # native row where the fighters' band begins

# --------------------------------------------------------------------------
# Stage geometry. Mirrors game/action-stages.mjs in canvas pixels; the Node
# acceptance test fails if either side drifts. Art never defines collision.
# --------------------------------------------------------------------------

STAGES = [
    ("hsh-census-square", 446, [("river-stair", 754, 906, 350)]),
    ("c1-flooded-cedars", 452, [("cedar-root-west", 76, 238, 342), ("cedar-root-east", 650, 852, 318)]),
    ("c1-tax-storehouse", 442, [("ledger-loft", 610, 858, 294)]),
    ("fp1-wet-cedar-stage", 452, [("wet-root-west", 66, 232, 334), ("wet-root-east", 704, 878, 350)]),
    ("fp1-flooded-archive-stage", 448, [("archive-gallery-west", 72, 292, 294), ("archive-gallery-east", 656, 888, 294)]),
    ("tkm-bell-chamber", 440, [("ward-dais-west", 102, 282, 304), ("ward-dais-east", 678, 858, 304)]),
    ("sdg-rain-docks", 454, [("cargo-crane-walk", 552, 792, 318)]),
    ("sdg-salt-warehouse", 446, [("salt-stack-west", 70, 272, 312), ("salt-stack-east", 688, 888, 312)]),
    ("ngi-tide-caves", 456, [("tide-shelf-west", 58, 264, 324), ("tide-shelf-east", 690, 904, 286)]),
    ("ngi-storm-reef", 458, [("reef-spine-west", 84, 310, 326), ("reef-spine-east", 638, 878, 298)]),
    ("kgr-ash-fields", 448, [("ash-barrow", 624, 864, 320)]),
    ("kgr-archive-furnace", 440, [("furnace-gantry-west", 58, 294, 284), ("furnace-gantry-east", 662, 898, 284)]),
    ("kzu-archive-roof", 450, [("roof-ridge-west", 64, 326, 308), ("roof-ridge-east", 634, 896, 308)]),
    ("kzu-public-tribunal", 442, [("tribunal-bench", 620, 876, 300)]),
    ("hsh-prison-ferry", 452, [("ferry-deck", 602, 892, 316)]),
    ("hsh-bell-aqueduct", 448, [("aqueduct-west", 52, 298, 304), ("aqueduct-east", 662, 908, 304)]),
    ("c8-black-gate", 444, [("gate-wall-west", 54, 284, 290), ("gate-wall-east", 676, 906, 290)]),
    ("krh-outer-archive", 442, [("archive-stack-west", 52, 300, 300), ("archive-stack-east", 660, 908, 300)]),
    ("krh-observatory", 438, [("observatory-ring-west", 64, 306, 296), ("observatory-ring-east", 654, 896, 296)]),
    ("epi-hoshigawa-archive", 448, [("memorial-gallery", 612, 892, 310)]),
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.removeprefix("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


class Rng:
    """xorshift32 seeded from a SHA-256 of a text key; integer-only."""

    def __init__(self, key: str) -> None:
        self.state = int.from_bytes(hashlib.sha256(key.encode("utf-8")).digest()[:4], "big") or 0x9E3779B9

    def next(self) -> int:
        x = self.state
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        self.state = x & 0xFFFFFFFF
        return self.state

    def int(self, lo: int, hi: int) -> int:
        if hi <= lo:
            return lo
        return lo + self.next() % (hi - lo + 1)

    def chance(self, num: int, den: int) -> bool:
        return self.next() % den < num

    def pick(self, items):
        return items[self.next() % len(items)]


# --------------------------------------------------------------------------
# Canvas primitives (integer geometry; palette keys only)
# --------------------------------------------------------------------------

class Canvas:
    def __init__(self, palette: dict[str, str], width: int = W, height: int = H, fill: str = "sky0", mode: str = "RGB") -> None:
        self.palette = {key: hex_rgb(value) for key, value in palette.items()}
        self.w, self.h = width, height
        base = self.palette[fill] if fill else (0, 0, 0)
        self.img = Image.new(mode, (width, height), base if mode == "RGB" else base + (0,))
        self.mode = mode
        self.pix = self.img.load()
        self.draw = ImageDraw.Draw(self.img)

    def c(self, key: str):
        rgb = self.palette[key]
        return rgb if self.mode == "RGB" else rgb + (255,)

    def put(self, x: int, y: int, key: str) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.pix[x, y] = self.c(key)

    def get(self, x: int, y: int):
        x = min(max(x, 0), self.w - 1)
        y = min(max(y, 0), self.h - 1)
        return self.pix[x, y]

    def rect(self, x: int, y: int, w: int, h: int, key: str) -> None:
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(self.w, x + w), min(self.h, y + h)
        if x1 > x0 and y1 > y0:
            self.draw.rectangle((x0, y0, x1 - 1, y1 - 1), fill=self.c(key))

    def hline(self, x0: int, x1: int, y: int, key: str) -> None:
        if x1 < x0:
            x0, x1 = x1, x0
        self.rect(x0, y, x1 - x0 + 1, 1, key)

    def vline(self, x: int, y0: int, y1: int, key: str) -> None:
        if y1 < y0:
            y0, y1 = y1, y0
        self.rect(x, y0, 1, y1 - y0 + 1, key)

    def line(self, x0: int, y0: int, x1: int, y1: int, key: str) -> None:
        self.draw.line((x0, y0, x1, y1), fill=self.c(key), width=1)

    def poly(self, points, key: str) -> None:
        self.draw.polygon([(int(x), int(y)) for x, y in points], fill=self.c(key))

    def ellipse(self, x0: int, y0: int, x1: int, y1: int, key: str) -> None:
        self.draw.ellipse((x0, y0, x1, y1), fill=self.c(key))

    def checker(self, x: int, y: int, w: int, h: int, key: str, phase: int = 0) -> None:
        for yy in range(max(0, y), min(self.h, y + h)):
            for xx in range(max(0, x), min(self.w, x + w)):
                if (xx + yy + phase) % 2 == 0:
                    self.pix[xx, yy] = self.c(key)

    def sparse(self, x: int, y: int, w: int, h: int, key: str, step: int = 4, phase: int = 0) -> None:
        """Quarter-density ordered pattern for one-row transitions."""
        for yy in range(max(0, y), min(self.h, y + h)):
            for xx in range(max(0, x), min(self.w, x + w)):
                if (xx + 2 * (yy % 2) + phase) % step == 0:
                    self.pix[xx, yy] = self.c(key)

    def fill_heights(self, heights: list[int], bottom: int, key: str, x0: int = 0) -> None:
        for i, top in enumerate(heights):
            x = x0 + i
            if 0 <= x < self.w and top < bottom:
                self.rect(x, top, 1, bottom - top, key)

    def rim_heights(self, heights: list[int], key: str, x0: int = 0, every: int = 1) -> None:
        for i, top in enumerate(heights):
            if i % every == 0:
                self.put(x0 + i, top, key)

    def mask(self) -> tuple[Image.Image, ImageDraw.ImageDraw]:
        image = Image.new("1", (self.w, self.h), 0)
        return image, ImageDraw.Draw(image)

    def fill_mask(self, mask_image: Image.Image, key: str) -> None:
        self.img.paste(self.c(key), (0, 0, self.w, self.h), mask_image)
        self.pix = self.img.load()
        self.draw = ImageDraw.Draw(self.img)


def heightline(rng: Rng, width: int, base: int, amp: int, rough_num: int = 11, rough_den: int = 20) -> list[int]:
    """Integer midpoint-displacement ridge profile."""
    n = 1
    while n < width:
        n *= 2
    pts = [0] * (n + 1)
    pts[0] = rng.int(-amp, amp)
    pts[n] = rng.int(-amp, amp)
    seg, scale = n, amp
    while seg > 1:
        half = seg // 2
        for i in range(half, n, seg):
            mid = (pts[i - half] + pts[i + half]) // 2
            pts[i] = mid + (rng.int(-scale, scale) if scale > 0 else 0)
        seg = half
        scale = scale * rough_num // rough_den
    return [base + pts[x] for x in range(width)]


def bands(cv: Canvas, y0: int, y1: int, keys: list[str]) -> None:
    """Stepped bands; each boundary gets a two-row 25%/50% ordered transition."""
    n = len(keys)
    span = y1 - y0
    for i, key in enumerate(keys):
        a = y0 + span * i // n
        b = y0 + span * (i + 1) // n
        cv.rect(0, a, cv.w, b - a, key)
    for i in range(1, n):
        b = y0 + span * i // n
        lower, upper = keys[i], keys[i - 1]
        for x in range(cv.w):
            if (x + b) % 2 == 0:
                cv.put(x, b - 1, lower)
            if (x + 2 * (b % 2)) % 4 == 0:
                cv.put(x, b, upper)


def rain(cv: Canvas, rng: Rng, count: int, key: str, region=(0, 0, W, H), length: int = 4, slope: int = 3) -> None:
    x0, y0, x1, y1 = region
    for _ in range(count):
        x = rng.int(x0, x1 - 1)
        y = rng.int(y0, y1 - 1)
        for j in range(length):
            cv.put(x - j // slope, y + j, key)


def specks(cv: Canvas, rng: Rng, count: int, keys: list[str], region=(0, 0, W, H), tall: bool = False) -> None:
    x0, y0, x1, y1 = region
    for _ in range(count):
        x = rng.int(x0, x1 - 1)
        y = rng.int(y0, y1 - 1)
        key = rng.pick(keys)
        cv.put(x, y, key)
        if tall:
            cv.put(x, y + 1, key)


def stars(cv: Canvas, rng: Rng, count: int, keys: list[str], region) -> None:
    specks(cv, rng, count, keys, region)


def cloud_strata(cv: Canvas, rng: Rng, y: int, h: int, key: str, count: int, min_w: int = 30, max_w: int = 110) -> None:
    for _ in range(count):
        w = rng.int(min_w, max_w)
        x = rng.int(-20, cv.w - 10)
        yy = y + rng.int(0, max(0, h - 3))
        cv.rect(x + 3, yy, w - 6, 1, key)
        cv.rect(x, yy + 1, w, 2, key)
        cv.rect(x + 6, yy + 3, w - 14, 1, key)


def moon(cv: Canvas, x: int, y: int, r: int, body: str, halo_outer: str, halo_inner: str, shade: str | None = None) -> None:
    cv.ellipse(x - r - 6, y - r - 6, x + r + 6, y + r + 6, halo_outer)
    cv.ellipse(x - r - 3, y - r - 3, x + r + 3, y + r + 3, halo_inner)
    cv.ellipse(x - r, y - r, x + r, y + r, body)
    if shade:
        cv.ellipse(x - r + 2, y - r + 1, x + r // 3, y + r // 3 - 1, shade)
        cv.ellipse(x - r, y - r, x + r - 3, y + r - 2, body)


def cedar(cv: Canvas, rng: Rng, x: int, base: int, h: int, w: int, key: str, rim: str | None = None, trunk: str | None = None, tiers: int = 6) -> None:
    """Japanese cedar silhouette: narrow tiered spire with a short trunk."""
    top = base - h
    crown = h * 5 // 6
    tier_h = max(3, crown // tiers)
    for row in range(crown):
        tier = row // tier_h
        k = row % tier_h
        outer = (w // 2) * (tier + 1) // tiers
        inner = (w // 2) * tier // (tiers + 1)
        hw = inner + (outer - inner) * (k + 1) // tier_h
        hw = max(0, hw + rng.int(-1, 0))
        y = top + row
        cv.hline(x - hw, x + hw, y, key)
        if rim and hw > 1 and k >= tier_h - 2:
            cv.put(x + hw, y, rim)
    cv.rect(x - max(0, w // 14), top + crown, max(1, w // 7), h - crown, trunk or key)


def cedar_row(cv: Canvas, rng: Rng, y_base: int, count: int, h_range, w_range, key: str, rim: str | None = None, x_range=(-10, W + 10)) -> None:
    for _ in range(count):
        x = rng.int(*x_range)
        h = rng.int(*h_range)
        w = rng.int(*w_range)
        cedar(cv, rng, x, y_base + rng.int(-3, 3), h, w, key, rim)


def trunk(cv: Canvas, rng: Rng, x: int, y0: int, y1: int, w: int, dark: str, mid: str, light: str, groove: str | None = None, stubs: int = 0) -> None:
    cv.rect(x, y0, w, y1 - y0, mid)
    cv.rect(x, y0, max(1, w // 4), y1 - y0, dark)
    cv.rect(x + w - 1, y0, 1, y1 - y0, light)
    groove = groove or dark
    for _ in range(max(1, w // 3)):
        gx = rng.int(x + w // 4 + 1, x + w - 3)
        gy = rng.int(y0, y1 - 8)
        cv.vline(gx, gy, min(y1 - 1, gy + rng.int(10, 40)), groove)
    for i in range(stubs):
        sy = y0 + 20 + (y1 - y0 - 60) * i // max(1, stubs) + rng.int(0, 10)
        if i % 2:
            cv.line(x + w, sy, x + w + rng.int(3, 6), sy - rng.int(2, 4), mid)
        else:
            cv.line(x - 1, sy, x - rng.int(3, 6), sy - rng.int(2, 4), dark)


def root_flare(cv: Canvas, x: int, w: int, base: int, key: str, spread: int = 8) -> None:
    cv.poly([(x - spread, base), (x, base - spread * 2), (x + w, base - spread * 2), (x + w + spread, base)], key)


def roof(cv: Canvas, x0: int, x1: int, y: int, h: int, key: str, ridge: str | None = None, eave: str | None = None, lines: str | None = None, flare: int = 2) -> None:
    inset = max(2, h + 1)
    pts = [
        (x0 + inset, y), (x1 - inset, y), (x1, y + h - 1), (x1 + 1, y + h - 1 - flare),
        (x1 + 1, y + h), (x0 - 1, y + h), (x0 - 1, y + h - 1 - flare), (x0, y + h - 1),
    ]
    cv.poly(pts, key)
    if lines:
        for lx in range(x0 + 2, x1 - 1, 3):
            if lx < x0 + inset:
                top = y + (x0 + inset - lx) * (h - 1) // inset
            elif lx > x1 - inset:
                top = y + (lx - (x1 - inset)) * (h - 1) // inset
            else:
                top = y
            if top + 1 <= y + h - 1:
                cv.vline(lx, top + 1, y + h - 1, lines)
    if ridge:
        cv.hline(x0 + inset - 1, x1 - inset + 1, y - 1, ridge)
        cv.rect(x0 + inset - 2, y - 2, 2, 2, ridge)
        cv.rect(x1 - inset + 1, y - 2, 2, 2, ridge)
    if eave:
        cv.hline(x0, x1, y + h + 1, eave)


def shoji(cv: Canvas, x: int, y: int, w: int, h: int, paper: str, frame: str) -> None:
    cv.rect(x, y, w, h, frame)
    cv.rect(x + 1, y + 1, w - 2, h - 2, paper)
    for lx in range(x + 3, x + w - 1, 3):
        cv.vline(lx, y + 1, y + h - 2, frame)
    for ly in range(y + 4, y + h - 1, 4):
        cv.hline(x + 1, x + w - 2, ly, frame)


def lantern(cv: Canvas, x: int, y: int, body: str, cap: str, halo_outer: str, halo_inner: str, hi: str | None = None, size: int = 1) -> None:
    r = 4 + 2 * size
    cv.ellipse(x - r - 2, y - r - 1, x + r + 2, y + r + 2, halo_outer)
    cv.ellipse(x - r + 1, y - r + 2, x + r - 1, y + r - 1, halo_inner)
    bw, bh = 1 + size, 2 + 2 * size
    cv.rect(x - bw, y - bh + 1, bw * 2 + 1, bh * 2 - 1, body)
    cv.hline(x - bw, x + bw, y - bh, cap)
    cv.hline(x - bw, x + bw, y + bh, cap)
    if hi:
        cv.vline(x + bw - 1, y - bh + 2, y + bh - 2, hi)


def bell(cv: Canvas, cx: int, top: int, w: int, h: int, body: str, dark: str, hi: str, band: str, seam: str | None = None, mid: str | None = None) -> None:
    """Generic unmarked bell: rounded crown, near-straight waist, flared lip, cylindrical shading."""
    from math import isqrt
    half = w // 2
    cv.rect(cx - 3, top - 4, 7, 4, dark)
    cv.rect(cx - 1, top - 7, 3, 3, dark)
    dome = max(3, h // 4)

    def width_at(r: int) -> int:
        if r < dome:
            dy = dome - r
            return max(2, (half - 1) * isqrt(dome * dome - dy * dy) // dome)
        return min(half + 1, (half - 1) + (r - dome) * 3 // max(1, h - dome))

    for r in range(h):
        hw = width_at(r)
        y = top + r
        cv.hline(cx - hw, cx + hw, y, body)
        cv.hline(cx - hw, cx - hw + max(1, hw // 5), y, dark)
        if mid:
            cv.hline(cx, cx + hw * 2 // 3, y, mid)
        if r >= dome - 1:
            hx = cx + hw // 3
            cv.hline(hx, hx + max(0, hw // 9), y, hi)
        cv.put(cx + hw, y, dark)
    for frac in (h * 2 // 5, h * 3 // 5):
        hw = width_at(frac)
        cv.hline(cx - hw + 1, cx + hw - 1, top + frac, band)
    cv.hline(cx - half - 1, cx + half + 1, top + h - 2, band)
    cv.hline(cx - half - 1, cx + half + 1, top + h - 1, dark)
    if seam:
        sx = cx - half // 4
        for r in range(dome, h - 3):
            cv.put(sx + (1 if r % 6 < 2 else 0), top + r, seam)


def shelves(cv: Canvas, rng: Rng, x: int, y: int, w: int, h: int, frame: str, back: str, items: list[str], gap: int = 10, accent: str | None = None, accent_rate: int = 14) -> None:
    """Archive shelving with low-contrast box stacks; accents are rare."""
    cv.rect(x, y, w, h, frame)
    cv.rect(x + 2, y + 2, w - 4, h - 4, back)
    sy = y + 2
    while sy + gap <= y + h - 2:
        cv.hline(x + 1, x + w - 2, sy + gap - 1, frame)
        xx = x + 3
        while xx < x + w - 4:
            iw = rng.int(3, 7)
            ih = rng.int(max(2, gap - 6), gap - 3)
            key = accent if accent and rng.chance(1, accent_rate) else rng.pick(items)
            if rng.chance(7, 8):
                cv.rect(xx, sy + gap - 1 - ih, min(iw, x + w - 3 - xx), ih, key)
            xx += iw + 1
        sy += gap


def arcade(cv: Canvas, rng: Rng, x0: int, x1: int, top: int, bottom: int, span: int, pier: int, stone: str, joint: str, rim: str | None = None, start: int | None = None) -> list[int]:
    """Stone arcade with semicircular openings; openings keep the farther layers."""
    mask_img, md = cv.mask()
    md.rectangle((x0, top, x1 - 1, bottom - 1), fill=1)
    centres = []
    x = (x0 + pier) if start is None else start
    spring = top + (bottom - top) // 3
    while x + span <= x1:
        md.rectangle((x, spring + span // 2, x + span - 1, bottom - 1), fill=0)
        md.ellipse((x, spring, x + span - 1, spring + span - 1), fill=0)
        centres.append(x + span // 2)
        x += span + pier
    cv.fill_mask(mask_img, stone)
    mp = mask_img.load()
    for yy in range(top, bottom):
        for xx in range(max(0, x0), min(cv.w, x1)):
            if not mp[xx, yy]:
                continue
            course = (yy - top) // 6
            if (yy - top) % 6 == 5 or (xx + course * 5) % 13 == 0:
                cv.put(xx, yy, joint)
            elif rim and yy > 0 and not mp[xx, yy - 1]:
                cv.put(xx, yy, rim)
    return centres


def chain(cv: Canvas, x: int, y0: int, y1: int, key: str, hi: str | None = None) -> None:
    for y in range(y0, y1):
        if (y - y0) % 3 == 0:
            cv.put(x - 1, y, key)
            cv.put(x + 1, y, key)
        else:
            cv.put(x, y, key)
            if hi and (y - y0) % 3 == 1:
                cv.put(x, y, hi)


def reflect(cv: Canvas, rng: Rng, surface: int, end: int, palette_keys: list[str], wobble: int = 1, stretch: int = 1) -> None:
    """Mirror the scene above the surface into the water band, darkened to listed keys."""
    targets = [(key, cv.palette[key]) for key in palette_keys]

    def nearest(rgb):
        best, dist = targets[0][0], None
        for key, value in targets:
            d = sum((a - b) * (a - b) for a, b in zip(rgb, value))
            if dist is None or d < dist:
                best, dist = key, d
        return best

    water = cv.palette[palette_keys[0]]
    cache: dict = {}
    rows = []
    for y in range(surface, end):
        d = y - surface
        src = surface - 1 - d // stretch
        shift = (rng.int(-wobble, wobble) if d % 3 == 0 else 0)
        row = []
        for x in range(cv.w):
            rgb = cv.get(x + shift, src)[:3]
            if rgb not in cache:
                blended = tuple((a * 5 + b * 7) // 12 for a, b in zip(rgb, water))
                cache[rgb] = nearest(blended)
            row.append(cache[rgb])
        rows.append(row)
    for i, row in enumerate(rows):
        for x, key in enumerate(row):
            cv.put(x, surface + i, key)


def ripples(cv: Canvas, rng: Rng, y0: int, y1: int, key: str, count: int, min_len: int = 2, max_len: int = 9, x0: int = 0, x1: int = W) -> None:
    for _ in range(count):
        y = rng.int(y0, y1 - 1)
        x = rng.int(x0, x1 - 1)
        cv.hline(x, x + rng.int(min_len, max_len), y, key)


def light_column(cv: Canvas, rng: Rng, x: int, y0: int, y1: int, key: str, width: int = 4) -> None:
    for y in range(y0, y1, 2):
        w = rng.int(1, width)
        cv.hline(x - w // 2 + rng.int(-1, 1), x + w // 2 + rng.int(-1, 1), y, key)


def fog_band(cv: Canvas, rng: Rng, y: int, h: int, key: str, amp: int = 3) -> None:
    edge = heightline(rng, cv.w, y, amp, 1, 2)
    for x, top in enumerate(edge):
        cv.rect(x, top, 1, y + h - top, key)


# --------------------------------------------------------------------------
# Surface tiles (16 x 16 native, binary alpha; row 0 is the walkable surface)
# --------------------------------------------------------------------------

def tile_canvas(palette: dict[str, str]) -> Canvas:
    return Canvas(palette, TILE, TILE, fill=None, mode="RGBA")


def ground_tile(palette: dict[str, str], material: str, variant: int) -> Image.Image:
    t = tile_canvas(palette)
    if material == "stone":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 1, "lip")
        t.rect(0, 2, 16, 3, "g3")
        t.rect(0, 5, 16, 1, "g0")
        t.rect(0, 6, 16, 4, "g2")
        off = 5 if variant else 11
        t.vline(off, 2, 4, "g1")
        t.vline((off + 8) % 16, 6, 9, "g0")
        t.put(off + 1, 2, "lip")
        if variant:
            t.hline(2, 6, 3, "water_hi")
        t.rect(0, 10, 16, 1, "g0")
    elif material == "flood":
        for x in range(16):
            t.put(x, 0, "lip_hi" if (x + variant * 3) % 5 else "lip")
        t.rect(0, 1, 16, 1, "lip")
        t.hline(2 + variant * 6, 6 + variant * 6, 3, "water_hi")
        t.hline(9 - variant * 5, 11 - variant * 5, 6, "water1")
    elif material == "plank":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 3, "lip")
        t.rect(0, 4, 16, 1, "wood0")
        t.rect(0, 5, 16, 5, "wood1")
        t.rect(0, 10, 16, 1, "wood0")
        seam = 7 if variant else 15
        t.vline(seam, 1, 3, "wood0")
        t.put(3 + variant * 6, 2, "wood2")
        t.put(10 - variant * 4, 7, "wood0")
        t.put(11 - variant * 4, 7, "wood0")
    elif material == "dock":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 2, "lip")
        t.rect(0, 3, 16, 1, "wood0")
        t.rect(0, 4, 16, 4, "wood1")
        t.rect(0, 8, 16, 1, "wood0")
        t.vline(5 + variant * 6, 1, 2, "wood0")
        t.put(12 - variant * 7, 5, "wood2")
    elif material == "rock":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 3, "lip")
        t.rect(0, 4, 16, 4, "g3")
        cracks = [(3, 1), (11, 2)] if variant else [(7, 1), (14, 3)]
        for cx, cy in cracks:
            t.vline(cx, cy, cy + 3, "g1")
            t.put(cx + 1, cy + 3, "g1")
        t.put(5 + variant * 4, 5, "lip")
        t.rect(0, 8, 16, 1, "g1")
    elif material == "ash":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 3, "lip")
        t.rect(0, 4, 16, 3, "g3")
        for x in range(0, 16, 4):
            t.put(x + variant, 1 + (x // 4) % 2, "g3")
        t.put(6 + variant * 5, 5, "accent" if variant else "g2")
        t.rect(0, 7, 16, 1, "g2")
    elif material == "iron":
        t.rect(0, 0, 16, 1, "metal1")
        t.rect(0, 1, 16, 1, "metal0")
        for x in range(16):
            if x % 4 in (1, 2):
                t.rect(x, 2, 1, 3, "glow1")
            else:
                t.rect(x, 2, 1, 3, "metal0")
        if variant:
            t.rect(6, 3, 2, 1, "glow2")
        t.rect(0, 5, 16, 1, "metal1")
        t.rect(0, 6, 16, 3, "g2")
        t.vline(7 + variant * 4, 6, 8, "g0")
    elif material == "roof":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 2, "lip")
        for x in range(16):
            col = "g3" if x % 4 in (0, 1) else "g2"
            t.rect(x, 3, 1, 6, col)
            if x % 4 == 3:
                t.rect(x, 3, 1, 6, "g1")
        t.rect(0, 9, 16, 1, "g1")
        if variant:
            t.put(1, 5, "lip")
    elif material == "gravel":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 4, "lip")
        for i in range(10):
            x = (i * 7 + variant * 3) % 16
            y = 1 + (i * 3 + variant) % 4
            t.put(x, y, "g3" if i % 2 else "lip_hi")
        t.rect(0, 5, 16, 1, "g2")
        t.rect(0, 6, 16, 3, "g3")
        t.vline(4 + variant * 8, 6, 8, "g1")
    elif material == "lacquer":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 1, "accent")
        t.rect(0, 2, 16, 4, "lip")
        t.put(3 + variant * 7, 3, "rim")
        t.rect(0, 6, 16, 1, "metal0")
        t.rect(0, 7, 16, 2, "g2")
    else:
        raise ValueError(f"unknown ground material {material}")
    return t.img


def platform_tile(palette: dict[str, str], material: str, part: str) -> Image.Image:
    t = tile_canvas(palette)
    left, right = part == "left", part == "right"
    if material == "beam":
        t.rect(0, 0, 16, 1, "wood2")
        t.rect(0, 1, 16, 3, "wood1")
        t.rect(0, 4, 16, 1, "wood0")
        t.rect(0, 5, 16, 2, "lip")
        t.rect(0, 7, 16, 1, "wood0")
        t.vline(11, 1, 3, "wood0")
        t.put(4, 2, "wood2")
        if left or right:
            edge = 0 if left else 15
            t.vline(edge, 0, 7, "wood0")
            bx = 3 if left else 8
            for r in range(5):
                t.hline(bx + (r if left else 0), bx + 4 - (0 if left else r), 8 + r, "wood0")
            t.vline(bx + 2, 8, 12, "wood1")
    elif material == "stone":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 1, "lip")
        t.rect(0, 2, 16, 3, "g3")
        t.rect(0, 5, 16, 1, "g1")
        t.rect(0, 6, 16, 3, "g2")
        t.rect(0, 9, 16, 1, "g0")
        t.vline(5, 2, 4, "g1")
        t.vline(13, 6, 8, "g1")
        if left or right:
            edge = 0 if left else 15
            t.vline(edge, 1, 9, "g1")
            t.put(edge, 0, "lip")
            for r in range(3):
                x0 = (2 + r * 2) if left else 0
                x1 = 15 if left else (13 - r * 2)
                t.hline(x0, x1, 10 + r, "g1")
    elif material == "root":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 2, "wood2")
        t.rect(0, 3, 16, 3, "wood1")
        t.rect(0, 6, 16, 1, "wood0")
        t.hline(2, 7, 2, "wood1")
        t.hline(9, 13, 4, "wood0")
        t.put(5, 4, "wood2")
        if left or right:
            for r in range(7):
                cut = max(0, 4 - r) if r < 4 else 0
                if left:
                    for x in range(cut):
                        t.img.putpixel((x, r), (0, 0, 0, 0))
                else:
                    for x in range(16 - cut, 16):
                        t.img.putpixel((x, r), (0, 0, 0, 0))
            tx = 6 if left else 9
            t.vline(tx, 7, 13, "wood0")
            t.vline(tx + (2 if left else -2), 7, 10, "wood0")
            t.put(tx, 14, "wood1")
        else:
            t.vline(4, 7, 9, "wood0")
            t.vline(12, 7, 11, "wood0")
    elif material == "rock":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 2, "lip")
        t.rect(0, 3, 16, 4, "g3")
        depth = [9, 10, 11, 10, 9, 10, 12, 11, 10, 9, 10, 11, 12, 10, 9, 10]
        for x in range(16):
            d = depth[x]
            if left:
                d = min(d, 6 + x // 2)
            if right:
                d = min(d, 6 + (15 - x) // 2)
            t.rect(x, 7, 1, d - 7, "g2")
            t.put(x, d, "g1")
        t.vline(6, 1, 4, "g2")
        t.put(11, 3, "lip")
        if left:
            t.vline(0, 0, 6, "g2")
        if right:
            t.vline(15, 0, 6, "g2")
    elif material == "lacquer":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 1, "rim")
        t.rect(0, 2, 16, 4, "lip")
        t.rect(0, 6, 16, 1, "accent_dim")
        t.rect(0, 7, 16, 1, "g1")
        t.put(5, 3, "rim")
        if left or right:
            edge = 0 if left else 15
            t.vline(edge, 1, 7, "g1")
            t.put(edge, 0, "lip")
            inner = 1 if left else 14
            t.put(inner, 2, "metal1")
            t.put(inner, 5, "metal1")
            bx = 4 if left else 7
            for r in range(3):
                t.hline(bx + (r if left else 0), bx + 4 - (0 if left else r), 8 + r, "g1")
    elif material == "iron":
        t.rect(0, 0, 16, 1, "metal1")
        t.rect(0, 1, 16, 1, "metal0")
        for x in range(16):
            t.rect(x, 2, 1, 2, "glow1" if x % 3 == 1 else "metal0")
        t.rect(0, 4, 16, 1, "metal1")
        t.rect(0, 5, 16, 1, "metal0")
        for r in range(6):
            t.put(r * 16 // 6, 6 + r, "metal0")
            t.put(15 - r * 16 // 6, 6 + r, "metal0")
        t.rect(0, 11, 16, 1, "metal0")
        if left or right:
            edge = 0 if left else 15
            t.vline(edge, 0, 11, "metal1")
    elif material == "roof":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 2, "lip")
        t.rect(0, 3, 16, 1, "g1")
        for x in range(16):
            t.rect(x, 4, 1, 4, "g3" if x % 4 in (0, 1) else ("g1" if x % 4 == 3 else "g2"))
        t.rect(0, 8, 16, 1, "g0")
        if left or right:
            bx = 0 if left else 9
            t.rect(bx, 0, 7, 9, "g2")
            t.rect(bx, 0, 7, 1, "lip_hi")
            t.rect(bx + 2, 3, 3, 3, "g0")
            t.put(bx + 3, 4, "lip")
    elif material == "sack":
        t.rect(0, 0, 16, 1, "wood2")
        t.rect(0, 1, 16, 2, "wood1")
        t.rect(0, 3, 16, 1, "wood0")
        for sx in (0, 8):
            t.ellipse(sx, 3, sx + 7, 11, "salt1")
            t.hline(sx + 2, sx + 5, 4, "salt2")
            t.put(sx + 1, 9, "salt0")
            t.vline(sx + 7, 6, 9, "salt0")
        if left:
            for y in range(0, 3):
                t.put(0, y, "wood0")
        if right:
            for y in range(0, 3):
                t.put(15, y, "wood0")
    elif material == "bronze":
        t.rect(0, 0, 16, 1, "lip_hi")
        t.rect(0, 1, 16, 3, "metal1")
        for x in range(0, 16, 4):
            t.vline(x + 1, 1, 2, "lip_hi")
        t.rect(0, 4, 16, 1, "metal0")
        t.rect(0, 5, 16, 2, "accent")
        t.rect(0, 7, 16, 1, "g1")
        if left or right:
            kx = 1 if left else 11
            t.rect(kx, 0, 4, 9, "metal0")
            t.rect(kx + 1, 1, 2, 6, "metal1")
    else:
        raise ValueError(f"unknown platform material {material}")
    return t.img


def support_tile(palette: dict[str, str], material: str) -> Image.Image:
    t = tile_canvas(palette)
    if material == "none":
        return t.img
    if material == "post":
        t.rect(5, 0, 6, 16, "wood1")
        t.vline(5, 0, 15, "wood0")
        t.vline(10, 0, 15, "wood0")
        t.vline(8, 0, 15, "wood2")
        t.vline(7, 3, 9, "wood0")
        t.hline(5, 10, 15, "wood0")
    elif material == "stone":
        t.rect(4, 0, 8, 16, "g2")
        t.vline(4, 0, 15, "g1")
        t.vline(11, 0, 15, "g0")
        t.hline(4, 11, 7, "g1")
        t.hline(4, 11, 15, "g1")
        t.vline(8, 0, 6, "g1")
        t.put(5, 1, "g3")
        t.put(5, 9, "g3")
    elif material == "root":
        widths = [5, 5, 6, 6, 5, 4, 4, 5, 6, 6, 5, 5, 4, 5, 5, 5]
        for y, w in enumerate(widths):
            x0 = 8 - w // 2 + (1 if 4 <= y <= 9 else 0)
            t.hline(x0, x0 + w - 1, y, "wood1")
            t.put(x0, y, "wood0")
            t.put(x0 + w - 1, y, "wood0")
        t.vline(8, 2, 6, "wood2")
    elif material == "rock":
        widths = [8, 9, 9, 8, 7, 8, 9, 10, 9, 8, 8, 9, 9, 8, 8, 8]
        for y, w in enumerate(widths):
            x0 = 8 - w // 2
            t.hline(x0, x0 + w - 1, y, "g2")
            t.put(x0, y, "g1")
            t.put(x0 + w - 1, y, "g0")
        t.vline(7, 3, 8, "g1")
        t.put(6, 12, "g3")
    elif material == "lacquer":
        t.rect(5, 0, 6, 16, "lip")
        t.vline(5, 0, 15, "g1")
        t.vline(10, 0, 15, "g1")
        t.vline(9, 0, 15, "rim")
    elif material == "iron":
        t.vline(4, 0, 15, "metal0")
        t.vline(11, 0, 15, "metal0")
        for y in range(16):
            t.put(4 + (y * 7) // 15, y, "metal0")
            t.put(11 - (y * 7) // 15, y, "metal0")
        t.put(4, 0, "metal1")
        t.put(11, 8, "metal1")
    elif material == "sack":
        t.ellipse(2, 0, 13, 8, "salt1")
        t.ellipse(2, 8, 13, 16, "salt1")
        t.hline(4, 10, 1, "salt2")
        t.hline(4, 10, 9, "salt2")
        t.hline(3, 12, 7, "salt0")
        t.hline(3, 12, 15, "salt0")
    else:
        raise ValueError(f"unknown support material {material}")
    return t.img


# --------------------------------------------------------------------------
# Surface plan: identical math to game/action-stage-backdrop-atlas.mjs
# --------------------------------------------------------------------------

def support_xs(left: int, right: int) -> list[int]:
    """Post x positions (canvas px): both ends plus one every ~128 px between."""
    first, last = left + 16, right - 48
    gaps = max(1, (last - first + 64) // 128)
    return [(first + (last - first) * i // gaps) // 2 * 2 for i in range(gaps + 1)]


def surface_plan(ground_y: int, platforms, supports: bool = True, row: int = 0) -> list[dict]:
    """Draw ops in canvas pixels; identical to planActionStageSurfaces() in JS."""
    step = TILE * SCALE
    ops = []

    def op(role: str, sw: int, sh: int, dx: int, dy: int) -> None:
        ops.append({"role": role, "sx": TILE_ROLES.index(role) * TILE, "sy": row * TILE, "sw": sw, "sh": sh,
                    "dx": dx, "dy": dy, "dw": sw * SCALE, "dh": sh * SCALE})

    for _pid, left, right, y in (platforms if supports else []):
        for sx in support_xs(left, right):
            yy = y + 16
            while yy < ground_y:
                h = min(step, ground_y - yy)
                op("support", TILE, h // SCALE, sx, yy)
                yy += h
    for _pid, left, right, y in platforms:
        op("platform-left", TILE, TILE, left, y)
        x = left + step
        while x < right - step:
            w = min(step, right - step - x)
            op("platform-middle", w // SCALE, TILE, x, y)
            x += w
        op("platform-right", TILE, TILE, right - step, y)
    for i in range(CANVAS_W // step):
        op("ground-b" if i % 3 == 2 else "ground-a", TILE, TILE, i * step, ground_y)
    return ops


def surface_plan_sha256(ground_y: int, platforms, supports: bool, row: int) -> str:
    text = json.dumps(surface_plan(ground_y, platforms, supports, row), separators=(",", ":"))
    return sha256(text.encode("utf-8"))


def composite_surfaces(base: Image.Image, tiles: dict[str, Image.Image], ground_y: int, platforms, include_platforms: bool, supports: bool = True) -> Image.Image:
    """Composite at native scale (every canvas coordinate is even)."""
    out = base.convert("RGBA")
    for op in surface_plan(ground_y, platforms if include_platforms else [], supports):
        tile = tiles[op["role"]].crop((0, 0, op["sw"], op["sh"]))
        out.alpha_composite(tile, (op["dx"] // SCALE, op["dy"] // SCALE))
    return out


# --------------------------------------------------------------------------
# Palettes (explicit; art-direction anchors plus local colours)
# --------------------------------------------------------------------------

RAIN_NIGHT = {
    "sky0": "#0b1020", "sky1": "#101a2d", "sky2": "#16233a", "sky3": "#1e3048",
    "cloud": "#1a2840", "far0": "#1b2a3f", "far1": "#24384f", "fog": "#2a3d53",
    "mid0": "#0c121e", "mid1": "#121c2c", "mid2": "#1a283a", "rim": "#3d5873",
    "wood0": "#1a1411", "wood1": "#33251d", "wood2": "#5a3a2c",
    "paper": "#d7c99a", "paper_dim": "#6f6650", "paper_low": "#47453c", "warm": "#f6e8b9",
    "glow1": "#1f2a37", "glow2": "#3b3a34", "accent": "#b65c4d", "accent_dim": "#5c3330",
    "metal0": "#3c463f", "metal1": "#7d7350",
    "water0": "#0e1726", "water1": "#172539", "water_hi": "#4f7392",
    "g0": "#070b14", "g1": "#0f1724", "g2": "#172334", "g3": "#22304a",
    "lip": "#33445d", "lip_hi": "#5b7690", "rain": "#2c4262", "ink": "#06080f",
}


def P(base: dict[str, str], **overrides: str) -> dict[str, str]:
    palette = dict(base)
    palette.update(overrides)
    return palette


PALETTES = {
    "hsh-census-square": P(RAIN_NIGHT, far0="#1c2a40", fog="#25374d", lip="#34465e", lip_hi="#61798f"),
    "c1-flooded-cedars": P(RAIN_NIGHT, sky0="#0a0f1a", sky1="#0f1824", sky2="#15212f", sky3="#1b2a39",
                             far0="#1e2e3a", far1="#283c49", fog="#2d4250", mid0="#0b1119", mid1="#111b25", mid2="#1a2834",
                             rim="#3e5a66", water0="#0d1620", water1="#16242f", water_hi="#4d6f80", lip="#2f4655", lip_hi="#557483",
                             wood1="#2c2420", wood2="#4a3529", rain="#2a4050"),
    "c1-tax-storehouse": P(RAIN_NIGHT, sky0="#0a0d1b", sky1="#12132a", sky2="#1a1b36", sky3="#242742",
                             far0="#2a2b44", far1="#35344f", fog="#3a3a55", mid0="#0d0d1a", mid1="#151526", mid2="#1f1f35",
                             rim="#57527a", wood0="#16110f", wood1="#2e221c", wood2="#4f3a2b", paper="#e8dcc0", paper_dim="#6c6458",
                             glow1="#3a2c2c", glow2="#6d4a35", accent="#987cc0", accent_dim="#3f3558", warm="#f2d79a",
                             g0="#08070e", g1="#120f18", g2="#1d1822", g3="#2b2330", lip="#3e3240", lip_hi="#65536a",
                             water_hi="#4a4a6a", rain="#2d2d4a"),
    "fp1-wet-cedar-stage": P(RAIN_NIGHT, sky0="#0b1120", sky1="#121d2c", sky2="#1a2a38", sky3="#243846",
                               far0="#203240", far1="#2b4250", fog="#30485a", mid0="#0b1218", mid1="#121d24", mid2="#1b2b31",
                               rim="#476b6c", lip="#33504f", lip_hi="#5d8178", g3="#1f3236", g2="#152328", g1="#0e171b",
                               water_hi="#55807f", wood2="#4f3a2b", accent="#b65c4d", rain="#2c4658"),
    "fp1-flooded-archive-stage": P(RAIN_NIGHT, sky0="#0a0d1b", sky1="#10132a", sky2="#171a35", sky3="#202441",
                                     far0="#24284a", far1="#2e3255", fog="#363a5c", mid0="#0b0c19", mid1="#121427", mid2="#1b1e36",
                                     rim="#56598a", wood0="#141019", wood1="#2a2129", wood2="#4b3a3a", paper="#e8dcc0", paper_dim="#615c66",
                                     glow1="#2f2c40", glow2="#5e5048", accent="#987cc0", accent_dim="#3b3358",
                                     water0="#0c0e1e", water1="#151a30", water_hi="#5a6194", g0="#06070f", g1="#0d0f1d",
                                     g2="#151a2c", g3="#1e2440", lip="#2c3458", lip_hi="#525c8c", rain="#2a2e4e"),
    "tkm-bell-chamber": P(RAIN_NIGHT, sky0="#0a0d1b", sky1="#10142a", sky2="#171c36", sky3="#212843",
                            far0="#232a46", far1="#2d3552", fog="#323a58", mid0="#0b0c18", mid1="#121526", mid2="#1b2036",
                            rim="#4f5a85", wood0="#140f10", wood1="#2b1f1e", wood2="#4a332b", paper="#e8dcc0", paper_dim="#5c5866",
                            metal0="#3a3629", metal1="#6c6449", bronze_shade="#221f19", bronze_mid="#4a4534", glow1="#2a2a3d", glow2="#565049",
                            accent="#8f3a3c", accent_dim="#4a2630", g0="#07070e", g1="#100e18", g2="#1a1622", g3="#282131",
                            lip="#3b2f3e", lip_hi="#655167", rain="#2a2f4c"),
    "sdg-rain-docks": P(RAIN_NIGHT, sky0="#0b1422", sky1="#112032", sky2="#182c40", sky3="#22394d",
                          cloud="#1a2b3e", far0="#1f3446", far1="#2a4356", fog="#31495a", mid0="#0b131c", mid1="#121e2a", mid2="#1b2c3a",
                          rim="#466877", water0="#0e1a26", water1="#162736", water_hi="#5f8790", accent="#d1b66a", accent_dim="#5e5440",
                          wood0="#16120f", wood1="#2e241c", wood2="#54402c", lip="#3d3a33", lip_hi="#6b6250",
                          g0="#070b10", g1="#0e151d", g2="#15202b", g3="#1f2c38", rain="#2e4a5a"),
    "sdg-salt-warehouse": P(RAIN_NIGHT, sky0="#0b1422", sky1="#122233", sky2="#1b2f41", sky3="#26404f",
                              far0="#22394a", far1="#2d4757", fog="#355060", mid0="#0d1218", mid1="#151d25", mid2="#1f2a33",
                              rim="#4c6a72", wood0="#17120f", wood1="#30251d", wood2="#56432f",
                              salt0="#363a3b", salt1="#4b4d49", salt2="#6a6a60", accent="#d1b66a", accent_dim="#5e5440",
                              water_hi="#5f8790", lip="#3c3a35", lip_hi="#6a6556", g0="#080b0f", g1="#10161c", g2="#182029", g3="#212b35",
                              rain="#2e4a5a"),
    "ngi-tide-caves": P(RAIN_NIGHT, sky0="#0b1422", sky1="#12253a", sky2="#193447", sky3="#214252",
                          far0="#203a48", far1="#2a4856", fog="#31505e", mid0="#080d13", mid1="#0f1820", mid2="#18252f",
                          rim="#3f6670", water0="#0c1a24", water1="#142a37", water_hi="#5f8f98", accent="#d1b66a", accent_dim="#5a5341",
                          paper="#b9d8d4", paper_dim="#506b6c", g0="#060a0e", g1="#0d1519", g2="#152127", g3="#1f2f37",
                          lip="#2d4652", lip_hi="#557884", rain="#3a5a66"),
    "ngi-storm-reef": P(RAIN_NIGHT, sky0="#0b1422", sky1="#122233", sky2="#1a3042", sky3="#24404f",
                          cloud="#1c3040", far0="#26404f", far1="#31505e", fog="#3b5a66", mid0="#091018", mid1="#101b25", mid2="#192a36",
                          rim="#4d7480", water0="#0d1a25", water1="#152a38", water_hi="#6a959b", accent="#d1b66a", accent_dim="#5e5440",
                          wood0="#15110f", wood1="#2a211c", wood2="#47372b", g0="#060a0e", g1="#0e161c", g2="#162229", g3="#203039",
                          lip="#2f4954", lip_hi="#5c7f88", rain="#365866"),
    "kgr-ash-fields": P(RAIN_NIGHT, sky0="#130e18", sky1="#1d1620", sky2="#2a2026", sky3="#3a2b2c",
                          cloud="#2e2428", far0="#30262a", far1="#3e3232", fog="#4a3b3b", mid0="#100c10", mid1="#191317", mid2="#241c1f",
                          rim="#6a5048", wood0="#160f0d", wood1="#2e211b", wood2="#4f382a", paper="#d8c6a6", paper_dim="#6c5f52",
                          accent="#dd7042", accent_dim="#6a3424", glow1="#3e2a26", glow2="#7a4630",
                          g0="#0b0809", g1="#151012", g2="#211a1b", g3="#2f2526", lip="#463837", lip_hi="#6e5a52",
                          rain="#4a3e3c", warm="#f0a060"),
    "kgr-archive-furnace": P(RAIN_NIGHT, sky0="#130e18", sky1="#1a1319", sky2="#22181c", sky3="#2c1f21",
                               far0="#2a2023", far1="#35292a", fog="#3d2e2c", mid0="#0e0a0d", mid1="#161013", mid2="#21181b",
                               rim="#6b4a3d", wood0="#150e0c", wood1="#2a1d18", wood2="#463024", paper="#d8c6a6", paper_dim="#5e5048",
                               metal0="#3a3232", metal1="#6e5c4c", accent="#dd7042", accent_dim="#5e2c20",
                               glow1="#4a2a20", glow2="#8a4a2a", warm="#f4a050",
                               g0="#090607", g1="#130d0e", g2="#1d1516", g3="#2a1f1f", lip="#3e2e2c", lip_hi="#66504a", rain="#3a2a28"),
    "kzu-archive-roof": P(RAIN_NIGHT, sky0="#120d1c", sky1="#191326", sky2="#221a30", sky3="#2d223a",
                            cloud="#231b2f", far0="#2a2036", far1="#352a42", fog="#3d3149", mid0="#17111f", mid1="#211a2c", mid2="#2c2339",
                            water1="#241d33", rim="#5b4a6a", accent="#b84748", accent_dim="#5a2632", paper="#dfc16f", paper_dim="#6a5a40",
                            glow1="#2c1f2c", glow2="#5c2f35", warm="#f0d290",
                            water_hi="#5a5274", g0="#09070d", g1="#110d17", g2="#1a1422", g3="#251c2e", lip="#342839", lip_hi="#5a4a60",
                            rain="#33294a"),
    "kzu-public-tribunal": P(RAIN_NIGHT, sky0="#120d1c", sky1="#181225", sky2="#20182e", sky3="#2a2039",
                               far0="#2a2036", far1="#352a42", fog="#3c3149", mid0="#140f1c", mid1="#1d1628", mid2="#2a2036",
                               rim="#5a4868", wood0="#120c10", wood1="#241820", wood2="#3e2a2e", accent="#b84748", accent_dim="#552531",
                               paper="#dfc16f", paper_dim="#6a5a46", glow1="#2e2028", glow2="#6a3d30", warm="#f2cf86",
                               metal0="#3e3a3a", metal1="#8a7448",
                               water0="#120f1c", water1="#1c1828", water_hi="#5a5274",
                               g0="#0b090f", g1="#15121a", g2="#211d27", g3="#2f2a35", lip="#47414c", lip_hi="#6c6470",
                               rain="#33294a"),
    "hsh-prison-ferry": P(RAIN_NIGHT, sky0="#0a0d1b", sky1="#10142a", sky2="#171d36", sky3="#202843",
                            far0="#20284a", far1="#2a3354", fog="#323c5c", mid0="#0a0c17", mid1="#111525", mid2="#1a2034",
                            rim="#4f5d88", wood0="#130f12", wood1="#2a2025", wood2="#463635", paper="#e8dcc0", paper_dim="#5e5a68",
                            glow1="#2a2a3c", glow2="#5a5048", accent="#987cc0", accent_dim="#3b3358", metal0="#3a3e48", metal1="#6a6a70",
                            water0="#0c0f1f", water1="#151b32", water_hi="#5a6a9a", g0="#06070f", g1="#0d0f1c", g2="#151a2c",
                            g3="#1f2540", lip="#3a3240", lip_hi="#625468", rain="#2a3050"),
    "hsh-bell-aqueduct": P(RAIN_NIGHT, sky0="#0a0d1b", sky1="#10152b", sky2="#181f38", sky3="#222b46",
                             far0="#232c4a", far1="#2d3756", fog="#36405e", mid0="#0b0d19", mid1="#121628", mid2="#1c2238",
                             rim="#56628c", metal0="#40483e", metal1="#86784f", accent="#987cc0", accent_dim="#3b3358",
                             water0="#0c1020", water1="#151c34", water_hi="#5e6e9c", g0="#06070f", g1="#0e101d", g2="#171b2e",
                             g3="#222842", lip="#353c5c", lip_hi="#5c6588", rain="#2a3252"),
    "c8-black-gate": P(RAIN_NIGHT, sky0="#120d1c", sky1="#1c1124", sky2="#28152a", sky3="#36192e",
                         cloud="#2a1428", far0="#2a1b30", far1="#36243c", fog="#41293f", mid0="#150f1b", mid1="#1f1726", mid2="#2b2032",
                         blood_glass="#4e1f2c", umbral_dim="#3a2350",
                         rim="#5e3e58", accent="#b84748", accent_dim="#5a2230", paper="#dfc16f", paper_dim="#6a5440",
                         glow1="#2c1a24", glow2="#6a3a2e", warm="#f0c878", metal0="#3a3236", metal1="#8a7046",
                         water0="#100b16", water1="#1a1222", water_hi="#5a3e5c", g0="#08060b", g1="#110d14", g2="#1b151f",
                         g3="#271e2c", lip="#3a2c3e", lip_hi="#5e4a62", rain="#3a2440", ember="#dd7042", umbral="#6a3a8a"),
    "krh-outer-archive": P(RAIN_NIGHT, sky0="#120d1c", sky1="#180f20", sky2="#201326", sky3="#2a182e",
                             far0="#2a1d33", far1="#34253e", fog="#3a2a44", mid0="#130e18", mid1="#1c1523", mid2="#271d2f",
                             rim="#5f4266", accent="#b84748", accent_dim="#4e1f2c", paper="#dfc16f", paper_dim="#5a4a3a",
                             glow1="#2a1626", glow2="#5a2236", warm="#e6b870", metal0="#3a2e34", metal1="#86683e",
                             g0="#07050a", g1="#0f0b13", g2="#18111d", g3="#22182a", lip="#2f2234", lip_hi="#57405c",
                             blood="#781e39", vein="#401d42", rain="#2a1a30"),
    "krh-observatory": P(RAIN_NIGHT, sky0="#0c0a18", sky1="#130f22", sky2="#1b142c", sky3="#251a36",
                           far0="#2a1f3a", far1="#352846", fog="#3d2e4e", mid0="#130e1a", mid1="#1c1527", mid2="#271d34",
                           rim="#5a4470", accent="#b84748", accent_dim="#4e1f2c", paper="#dfc16f", paper_dim="#5c4c3c",
                           glow1="#281a2e", glow2="#5a3240", warm="#e8c070", metal0="#3e3236", metal1="#9a7a44",
                           g0="#07050a", g1="#0e0a12", g2="#17111c", g3="#211829", lip="#2e2236", lip_hi="#7a6040",
                           blood="#781e39", vein="#401d42", dawn="#88c8c5", rain="#2a1a30"),
    "epi-hoshigawa-archive": P(RAIN_NIGHT, sky0="#263a45", sky1="#34505a", sky2="#46696c", sky3="#517a77",
                                 cloud="#7fa89c", far0="#4a6a6a", far1="#5f8080", fog="#6f8c86", mid0="#1a2326", mid1="#243034",
                                 mid2="#323e40", rim="#8aa69a", wood0="#2a1f18", wood1="#4a3726", wood2="#7a5a3a", wood3="#a58d65",
                                 paper="#e8dcb8", paper_dim="#a59a7a", warm="#f6e8b9", glow1="#4a4a3e", glow2="#8a7a58",
                                 accent="#e1b85d", accent_dim="#7a6034", metal0="#4a5048", metal1="#a08b58", dawn="#8fbfae",
                                 g0="#141716", g1="#1f2422", g2="#2c3230", g3="#3c4440", lip="#5a5240", lip_hi="#a58d65",
                                 water_hi="#88c8c5", rain="#5a7a7a"),
}


STAGE_STYLE = {
    "hsh-census-square": ("Census Square in Rain", "stone", "stone", "stone"),
    "c1-flooded-cedars": ("Flooded Cedars", "flood", "root", "none"),
    "c1-tax-storehouse": ("Abandoned Tax Storehouse", "plank", "beam", "post"),
    "fp1-wet-cedar-stage": ("Wet Cedar Service Path", "stone", "root", "none"),
    "fp1-flooded-archive-stage": ("Flooded Archive", "flood", "beam", "post"),
    "tkm-bell-chamber": ("Takamine Bell Chamber", "plank", "lacquer", "lacquer"),
    "sdg-rain-docks": ("Sodegaura Rain Docks", "dock", "beam", "post"),
    "sdg-salt-warehouse": ("Salt Warehouse", "plank", "beam", "post"),
    "ngi-tide-caves": ("Nagi Tide Caves", "rock", "rock", "none"),
    "ngi-storm-reef": ("Storm Reef on the Fog Sea", "rock", "rock", "none"),
    "kgr-ash-fields": ("Kagura Ash Pass", "ash", "rock", "rock"),
    "kgr-archive-furnace": ("Oni Forge Archive Furnace", "iron", "iron", "iron"),
    "kzu-archive-roof": ("Kozui Archive Roof", "roof", "roof", "post"),
    "kzu-public-tribunal": ("Kozui Public Tribunal", "gravel", "lacquer", "lacquer"),
    "hsh-prison-ferry": ("Hushroad Prison Ferry", "dock", "beam", "post"),
    "hsh-bell-aqueduct": ("Hushroad Bell Aqueduct", "stone", "stone", "stone"),
    "c8-black-gate": ("Kurohana Black Gate", "stone", "stone", "stone"),
    "krh-outer-archive": ("Kurohana Outer Archive", "lacquer", "lacquer", "lacquer"),
    "krh-observatory": ("Kurohana Throne Observatory", "lacquer", "bronze", "iron"),
    "epi-hoshigawa-archive": ("Hoshigawa Public Archive at Daybreak", "plank", "beam", "post"),
}


# --------------------------------------------------------------------------
# Ground bodies (below the 16-pixel surface tile row)
# --------------------------------------------------------------------------

def body_stone(cv: Canvas, rng: Rng, gy: int, keys=("g2", "g1", "g0")) -> None:
    y = gy + 11
    row = 0
    while y < H:
        key = keys[min(len(keys) - 1, row // 2)]
        cv.rect(0, y, W, 7, key)
        cv.hline(0, W - 1, y, keys[-1] if row else "g1")
        x = -rng.int(0, 16)
        while x < W:
            bw = rng.int(14, 24)
            cv.vline(x, y + 1, y + 6, keys[-1])
            if row < 2:
                cv.put(x + 2, y + 1, "g3")
            x += bw
        y += 7
        row += 1
    cv.rect(0, H - 6, W, 6, "g0")


def body_planks(cv: Canvas, rng: Rng, gy: int) -> None:
    cv.rect(0, gy + 11, W, H - gy - 11, "g1")
    cv.rect(0, gy + 11, W, 1, "wood0")
    for x in range(-rng.int(0, 30), W, 64):
        cv.rect(x + 20, gy + 12, 7, H - gy - 12, "wood0")
        cv.vline(x + 21, gy + 12, H - 1, "wood1")
    for y in range(gy + 18, H, 9):
        cv.hline(0, W - 1, y, "g0")
    cv.rect(0, H - 8, W, 8, "g0")


def body_dock(cv: Canvas, rng: Rng, gy: int) -> None:
    reflect(cv, rng, gy + 9, H, ["water0", "water1", "g0", "g1", "mid0", "mid1", "rim", "water_hi"], wobble=2)
    for x in range(-rng.int(0, 20), W, 46):
        cv.rect(x + 12, gy + 9, 6, H - gy - 9, "wood0")
        cv.vline(x + 13, gy + 9, H - 1, "wood1")
        cv.hline(x + 12, x + 17, gy + 20 + (x // 46) % 3, "metal0")
    ripples(cv, rng, gy + 12, H, "water_hi", 30, 2, 6)
    cv.rect(0, H - 4, W, 4, "g0")


def body_flood(cv: Canvas, rng: Rng, gy: int, keys) -> None:
    reflect(cv, rng, gy + 2, H, keys, wobble=1)
    ripples(cv, rng, gy + 4, H - 4, "water1", 70, 3, 12)
    ripples(cv, rng, gy + 4, H - 10, "water_hi", 24, 2, 6)
    cv.rect(0, H - 3, W, 3, "water0")


def body_rock(cv: Canvas, rng: Rng, gy: int) -> None:
    cv.rect(0, gy + 8, W, H - gy - 8, "g1")
    x = -rng.int(0, 10)
    while x < W:
        bw = rng.int(18, 40)
        top = gy + 8 + rng.int(0, 4)
        cv.poly([(x, top + 3), (x + 3, top), (x + bw - 4, top + rng.int(0, 2)), (x + bw, top + 5), (x + bw - 2, H), (x + 1, H)], "g2")
        cv.hline(x + 3, x + bw - 5, top, "g3")
        cv.vline(x + bw - 1, top + 5, H - 1, "g0")
        x += bw + rng.int(1, 3)
    specks(cv, rng, 40, ["g3", "lip"], (0, gy + 10, W, H - 6))
    cv.rect(0, H - 5, W, 5, "g0")


def body_ash(cv: Canvas, rng: Rng, gy: int) -> None:
    cv.rect(0, gy + 7, W, H - gy - 7, "g2")
    edge = heightline(rng, W, gy + 18, 3)
    cv.fill_heights(edge, H, "g1")
    edge2 = heightline(rng, W, gy + 32, 3)
    cv.fill_heights(edge2, H, "g0")
    specks(cv, rng, 70, ["g3", "lip"], (0, gy + 8, W, gy + 30))
    specks(cv, rng, 12, ["accent_dim"], (0, gy + 8, W, H - 4))


def body_iron(cv: Canvas, rng: Rng, gy: int) -> None:
    cv.rect(0, gy + 9, W, H - gy - 9, "g1")
    for x in range(0, W, 24):
        cv.rect(x, gy + 9, 2, H - gy - 9, "metal0")
        for y in range(gy + 14, H - 6, 8):
            cv.hline(x + 5, x + 19, y, "glow1" if (x // 24 + y) % 3 else "accent_dim")
    cv.rect(0, gy + 9, W, 1, "metal0")
    cv.rect(0, H - 7, W, 7, "g0")


def body_roof(cv: Canvas, rng: Rng, gy: int) -> None:
    keys = ["g3", "g2", "g2", "g1", "g1", "g0"]
    y = gy + 10
    row = 0
    while y < H:
        key = keys[min(row, len(keys) - 1)]
        cv.rect(0, y, W, 6, key)
        for x in range((row % 2) * 2, W, 4):
            cv.vline(x + 3, y, y + 5, "g0" if row > 2 else "g1")
            if row < 3:
                cv.put(x, y + 1, "lip")
        cv.hline(0, W - 1, y + 5, "g0")
        y += 6
        row += 1


def body_gravel(cv: Canvas, rng: Rng, gy: int) -> None:
    cv.rect(0, gy + 9, W, H - gy - 9, "g2")
    cv.rect(0, gy + 9, W, 1, "g1")
    for y in range(gy + 10, gy + 22, 2):
        for x in range((y // 2) % 3, W, 5):
            if rng.chance(1, 2):
                cv.put(x, y, "g3")
    cv.rect(0, gy + 22, W, 2, "g1")
    x = -rng.int(0, 10)
    while x < W:
        cv.vline(x, gy + 24, H - 1, "g0")
        x += rng.int(20, 34)
    cv.rect(0, gy + 24, W, H - gy - 24, "g1")
    for y in range(gy + 24, H, 8):
        cv.hline(0, W - 1, y, "g0")
    cv.rect(0, H - 6, W, 6, "g0")


def body_lacquer(cv: Canvas, rng: Rng, gy: int, keys) -> None:
    reflect(cv, rng, gy + 9, H, keys, wobble=0, stretch=1)
    for y in range(gy + 9, H, 3):
        cv.hline(0, W - 1, y, keys[0])
    cv.rect(0, gy + 9, W, 1, "metal0")
    cv.rect(0, H - 4, W, 4, "g0")


def ground_body(cv: Canvas, rng: Rng, gy: int, material: str) -> None:
    if material == "stone":
        body_stone(cv, rng, gy)
    elif material == "plank":
        body_planks(cv, rng, gy)
    elif material == "dock":
        body_dock(cv, rng, gy)
    elif material == "flood":
        body_flood(cv, rng, gy, ["water0", "water1", "g0", "g1", "g2", "mid0", "mid1", "rim"])
    elif material == "rock":
        body_rock(cv, rng, gy)
    elif material == "ash":
        body_ash(cv, rng, gy)
    elif material == "iron":
        body_iron(cv, rng, gy)
    elif material == "roof":
        body_roof(cv, rng, gy)
    elif material == "gravel":
        body_gravel(cv, rng, gy)
    elif material == "lacquer":
        body_lacquer(cv, rng, gy, ["g0", "g1", "g2", "mid0", "mid1", "accent_dim", "rim"])
    else:
        raise ValueError(material)


# --------------------------------------------------------------------------
# Stage compositions (native 480 x 270; gy = native ground row)
# --------------------------------------------------------------------------

def stage_census_square(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, 150, ["sky0", "sky1", "sky2", "sky3"])
    cloud_strata(cv, rng, 12, 44, "cloud", 9)
    kurohana_keep(cv, 62, 112, 2, "far0", light="accent_dim")
    ridge = heightline(rng, W, 114, 10)
    cv.fill_heights(ridge, 160, "far0")
    ridge2 = heightline(rng, W, 132, 6)
    cv.fill_heights(ridge2, 170, "far1")
    fog_band(cv, rng, 152, 30, "fog", 2)
    # river and far-bank warehouses on the right, behind the river stair
    cv.rect(336, 180, W - 336, gy - 180, "water1")
    reflect(cv, rng, 180, gy, ["water0", "water1", "far0", "fog", "rim"], wobble=2)
    ripples(cv, rng, 182, gy - 2, "water_hi", 14, 2, 7)
    cv.rect(336, 164, W - 336, 16, "far1")
    roof(cv, 330, W + 8, 156, 7, "far0", ridge="far0")
    for wx in range(350, W, 34):
        cv.rect(wx, 168, 10, 8, "far0")
        cv.rect(wx + 3, 170, 4, 4, "paper_low")
    cv.poly([(404, 198), (448, 198), (442, 203), (410, 203)], "mid1")
    cv.vline(436, 186, 198, "mid1")
    # machiya row
    keys = {"wall": "mid1", "roof": "mid0", "slat": "mid2", "front": "mid0", "door": "ink", "lit": "paper", "noren": "accent_dim"}
    x = -8
    i = 0
    while x < 326:
        w = rng.int(44, 58)
        facade(cv, rng, x, w, rng.int(118, 126), gy, lit=i in (0, 4), keys=keys)
        x += w + 2
        i += 1
    # census notice board: roofed board on posts; pinned sheets are blank
    cv.rect(156, 150, 2, gy - 150, "wood0")
    cv.rect(214, 150, 2, gy - 150, "wood0")
    roof(cv, 150, 222, 142, 5, "wood0", ridge="wood0")
    cv.rect(158, 152, 56, 26, "wood1")
    cv.hline(158, 213, 152, "wood2")
    for bx, by in ((162, 156), (176, 157), (190, 156), (202, 158), (168, 167), (184, 168), (198, 167)):
        cv.rect(bx, by, 9, 8, "paper_low")
        cv.put(bx + 4, by, "wood0")
    # fire-watch tower with its fractured alarm bell
    for lx in (292, 314):
        cv.rect(lx, 40, 3, gy - 40, "wood0")
    for y in range(52, gy, 14):
        cv.hline(293, 315, y, "wood0")
        cv.line(294, y, 314, y + 13, "mid0")
    cv.rect(288, 36, 32, 4, "wood0")
    roof(cv, 286, 322, 26, 8, "wood0", ridge="wood0")
    bell(cv, 304, 40, 10, 12, "metal0", "wood0", "metal1", "wood0", seam="accent_dim")
    box_lantern(cv, 24, 156, "wood0", "paper", "glow1", "glow2", gy)
    rain(cv, rng, 140, "rain", (0, 0, W, gy))
    rain(cv, rng, 36, "rim", (0, 0, W, 90), length=5)


def stage_flooded_cedars(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, gy, ["sky0", "sky1", "sky2", "sky3", "fog"])
    sugi_row(cv, rng, 190, 13, (120, 170), (22, 32), "far0", rim="far1")
    fog_band(cv, rng, 168, gy - 168, "fog", 3)
    for x, w in ((60, 7), (128, 4), (186, 9), (238, 5), (300, 6), (356, 8), (402, 4)):
        trunk(cv, rng, x, 0, gy, w, "mid2", "far0", "far1", groove="mid2", stubs=4)
    fog_band(cv, rng, 198, gy - 198, "far1", 2)
    canopy(cv, rng, 30, "mid0", rim="mid1")
    # near trunks: the root platforms grow out of these two
    for x, w, root_y, side in ((14, 24, 171, 1), (426, 24, 159, -1)):
        trunk(cv, rng, x, 0, gy, w, "mid0", "mid1", "rim", groove="mid0")
        root_flare(cv, x, w, gy, "mid0", 8)
        kx = x + w if side > 0 else x
        cv.poly([(kx, root_y - 6), (kx + 8 * side, root_y - 1), (kx + 8 * side, root_y + 9), (kx, root_y + 16)], "mid1")
    box_lantern(cv, 300, 178, "wood0", "paper", "glow1", "glow2", gy)
    rain(cv, rng, 150, "rain", (0, 30, W, gy))
    rain(cv, rng, 24, "rim", (0, 30, W, 100), length=5)


def stage_tax_storehouse(cv: Canvas, rng: Rng, gy: int) -> None:
    cv.rect(0, 0, W, gy, "far0")
    cv.rect(0, 150, W, gy - 150, "mid2")
    for y in range(150, gy):
        for x in range(W):
            if (x + y) % 12 == 0 or (x - y) % 12 == 0:
                cv.put(x, y, "far0")
    cv.hline(0, W - 1, 149, "mid1")
    cv.hline(0, W - 1, 148, "far1")
    cv.rect(0, 0, W, 18, "mid0")
    for x in range(-4, W, 30):
        cv.rect(x, 0, 6, 34, "mid1")
        cv.vline(x + 5, 0, 33, "mid2")
    cv.rect(0, 28, W, 10, "wood0")
    cv.hline(0, W - 1, 28, "wood1")
    for x in (20, 140, 260, 380):
        cv.rect(x, 38, 10, gy - 38, "wood0")
        cv.vline(x + 9, 38, gy - 1, "wood1")
    cv.rect(206, 56, 38, 28, "mid0")
    cv.rect(208, 58, 34, 24, "sky1")
    rain(cv, rng, 8, "rim", (208, 58, 242, 82), length=3)
    for bx in range(210, 242, 5):
        cv.rect(bx, 58, 2, 24, "wood0")
    for y in range(86, 214, 2):
        k = (y - 86) // 3
        cv.sparse(206 + k // 2, y, 34 + k // 3, 1, "far1", step=4, phase=y)
    cv.rect(14, 64, 62, gy - 64, "far1")
    cv.rect(20, 72, 50, gy - 72, "sky1")
    hill = heightline(rng, 50, 150, 6)
    cv.fill_heights(hill, gy, "sky2", x0=20)
    rain(cv, rng, 24, "rim", (20, 72, 70, gy), length=4)
    cv.poly([(76, 66), (96, 74), (96, gy), (76, gy)], "fog")
    cv.poly([(78, 70), (94, 77), (94, gy), (78, gy)], "far1")
    for y in range(90, gy, 26):
        cv.line(78, y, 94, y + 4, "mid1")
    for row, count in enumerate((5, 4, 3)):
        for i in range(count):
            bx = 104 + i * 20 + row * 10
            by = gy - 16 - row * 14
            cv.ellipse(bx, by, bx + 19, by + 15, "wood1")
            cv.ellipse(bx + 2, by + 1, bx + 17, by + 6, "wood2")
            for sx in range(bx + 3, bx + 17, 3):
                cv.put(sx, by + 9, "wood0")
            cv.vline(bx + 5, by + 2, by + 14, "wood0")
            cv.vline(bx + 14, by + 2, by + 14, "wood0")
    for i, cx in enumerate(range(306, 420, 28)):
        ch = 30 if i % 2 else 40
        cv.rect(cx, gy - ch, 24, ch, "wood0")
        for dy in range(6, ch, 10):
            cv.hline(cx + 1, cx + 22, gy - ch + dy, "wood1")
            cv.put(cx + 12, gy - ch + dy + 3, "metal1")
    for hx in (318, 336, 361, 380, 404):
        cv.vline(hx, 150, 156 + (hx % 3), "wood0")
        cv.rect(hx - 2, 156 + (hx % 3), 5, 7, "paper_low")
    # iron brazier on three legs with banked coals
    cv.ellipse(432, 186, 456, 210, "glow1")
    cv.ellipse(437, 191, 451, 205, "glow2")
    cv.poly([(434, 200), (454, 200), (450, 207), (438, 207)], "metal0")
    cv.hline(434, 453, 200, "metal1")
    cv.rect(437, 198, 14, 2, "accent")
    cv.put(441, 197, "warm")
    cv.put(446, 196, "accent")
    for lx, dx in ((438, -2), (444, 0), (450, 2)):
        cv.line(lx, 207, lx + dx, gy - 1, "metal0")
    specks(cv, rng, 4, ["warm", "glow2"], (436, 182, 452, 196))


def stage_wet_cedar(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, 152, ["sky0", "sky1", "sky2", "sky3"])
    cloud_strata(cv, rng, 10, 30, "sky1", 8)
    ridge = heightline(rng, W, 96, 16)
    cv.fill_heights(ridge, 170, "far0")
    # Takamine temple halls up the mountain (generic roofs, one warm window)
    roof(cv, 286, 344, 66, 9, "far0", ridge="far0")
    cv.rect(292, 75, 46, 16, "far0")
    roof(cv, 338, 372, 78, 6, "far0")
    cv.rect(342, 84, 26, 10, "far0")
    cv.rect(312, 81, 4, 3, "paper_low")
    sugi_row(cv, rng, 140, 18, (40, 64), (12, 18), "far1", rim="fog")
    fog_band(cv, rng, 150, 46, "fog", 3)
    # stone steps climbing into mist toward a roofed gatehouse with walls
    for i in range(11):
        y = 200 - i * 6
        w = 40 - i * 2
        cv.rect(240 - w // 2, y, w, 6, "far1" if i > 5 else "mid2")
        cv.hline(240 - w // 2, 240 + w // 2 - 1, y, "fog" if i > 5 else "rim")
    cv.rect(190, 126, 100, 14, "far1")
    roof(cv, 186, 294, 120, 5, "far0")
    cv.rect(222, 112, 36, 28, "far0")
    roof(cv, 214, 266, 100, 10, "far0", ridge="far0", lines="far1")
    cv.rect(230, 118, 20, 22, "mid2")
    cv.vline(240, 118, 139, "far0")
    # ishigaki retaining wall at left, wooden fence at right
    y = 150
    row = 0
    while y < gy:
        x = -(row % 2) * 9
        while x < 124:
            bw = rng.int(12, 20)
            cv.rect(x, y, bw - 1, 7, "mid1")
            cv.hline(x, x + bw - 2, y, "mid2")
            x += bw
        y += 8
        row += 1
    for x in range(330, W, 10):
        cv.rect(x, 180, 2, gy - 180, "mid1")
    cv.hline(330, W - 1, 186, "mid1")
    cv.hline(330, W - 1, 200, "mid1")
    # cedars; the two root platforms grow from the edge trunks
    for x, h, w in ((84, 200, 40), (168, 176, 30), (402, 206, 40)):
        sugi(cv, rng, x, gy, h, w, "mid0", rim="mid2", trunk_key="mid0")
    for x, w, root_y, side in ((10, 23, 167, 1), (439, 24, 175, -1)):
        trunk(cv, rng, x, 0, gy, w, "mid0", "mid1", "rim")
        root_flare(cv, x, w, gy, "mid0", 6)
        kx = x + w if side > 0 else x
        cv.poly([(kx, root_y - 6), (kx + 8 * side, root_y - 1), (kx + 8 * side, root_y + 9), (kx, root_y + 16)], "mid1")
    rain(cv, rng, 150, "rain", (0, 0, W, gy))
    rain(cv, rng, 28, "rim", (0, 0, W, 80), length=5)


def stage_flooded_archive(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, gy, ["mid1", "mid2", "far0", "far0"])
    cv.rect(0, 0, W, 20, "mid0")
    for x in range(-6, W, 40):
        cv.rect(x, 0, 6, 26, "mid0")
    cv.rect(0, 20, W, 6, "wood0")
    # central lattice window: rain and a moonlit cloud bank (no disc)
    cv.rect(186, 40, 108, 112, "mid0")
    cv.rect(190, 44, 100, 104, "sky1")
    cv.rect(190, 60, 100, 26, "sky2")
    cv.rect(206, 66, 70, 12, "sky3")
    cloud_strata(cv, rng, 92, 30, "sky2", 3, 20, 50)
    rain(cv, rng, 36, "rim", (190, 44, 290, 148), length=4)
    for lx in range(190, 291, 12):
        cv.rect(lx, 44, 2, 104, "mid0")
    for ly in range(44, 149, 14):
        cv.rect(190, ly, 100, 2, "mid0")
    cv.rect(186, 40, 108, 4, "mid0")
    cv.rect(186, 148, 108, 4, "mid0")
    cv.rect(186, 40, 4, 112, "mid0")
    cv.rect(290, 40, 4, 112, "mid0")
    for sx in (6, 66, 122):
        shelves(cv, rng, sx, 36, 50, gy - 36, "mid0", "mid1", ["mid2", "far0"], gap=12, accent="paper_low")
    for sx in (304, 362, 420):
        shelves(cv, rng, sx, 36, 52, gy - 36, "mid0", "mid1", ["mid2", "far0"], gap=12, accent="paper_low")
    fog_band(cv, rng, 192, gy - 192, "far1", 2)
    for lx in (174, 306):
        cv.vline(lx, 26, 118, "wood0")
        lantern(cv, lx, 124, "paper", "wood0", "glow1", "glow2", hi="warm", size=0)
    rain(cv, rng, 14, "water_hi", (186, 152, 294, gy), length=2, slope=9)


def stage_bell_chamber(cv: Canvas, rng: Rng, gy: int) -> None:
    cv.rect(0, 0, W, gy, "far0")
    for x in range(0, W, 120):
        cv.rect(x + 6, 64, 108, 82, "mid2")
        cv.rect(x + 6, 154, 108, gy - 154, "mid2")
    for x in range(0, W + 1, 120):
        cv.rect(x - 4, 0, 9, gy, "mid1")
        cv.vline(x + 4, 0, gy - 1, "far1")
    for y in (56, 146):
        cv.rect(0, y, W, 8, "mid1")
        cv.hline(0, W - 1, y, "far1")
    # ceiling: rafters and one great wall-to-wall bell beam with knee braces
    cv.rect(0, 0, W, 12, "ink")
    for x in range(0, W, 20):
        cv.rect(x, 12, 6, 4, "ink")
    cv.rect(0, 20, W, 12, "wood0")
    cv.hline(0, W - 1, 20, "wood1")
    cv.hline(0, W - 1, 31, "ink")
    for x in (120, 360):
        cv.line(x - 4, 56, x + (24 if x < 240 else -24), 32, "wood0")
        cv.line(x - 3, 56, x + (25 if x < 240 else -23), 32, "wood0")
    for wx in (12, 396):
        cv.rect(wx + 4, 72, 64, 66, "mid0")
        cv.rect(wx + 6, 74, 60, 62, "sky2")
        rain(cv, rng, 22, "rim", (wx + 6, 74, wx + 66, 136), length=4)
        for lx in range(wx + 6, wx + 67, 6):
            cv.vline(lx, 74, 135, "mid0")
        for ly in range(74, 137, 8):
            cv.hline(wx + 6, wx + 65, ly, "mid0")
    # iron hanger block and the great bell (generic, unmarked)
    cv.rect(228, 32, 24, 5, "metal0")
    cv.hline(228, 251, 32, "metal1")
    cv.rect(236, 37, 8, 4, "bronze_shade")
    bell(cv, 240, 48, 58, 70, "metal0", "bronze_shade", "metal1", "bronze_shade", seam="accent_dim", mid="bronze_mid")
    # striking log hung on two ropes from the beam
    cv.vline(186, 32, 94, "wood1")
    cv.vline(204, 32, 94, "wood1")
    cv.rect(176, 94, 40, 6, "wood1")
    cv.hline(177, 214, 94, "wood2")
    cv.vline(176, 95, 98, "wood0")
    cv.vline(215, 95, 98, "wood0")


def stage_rain_docks(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, 160, ["sky0", "sky1", "sky2", "sky3"])
    cloud_strata(cv, rng, 8, 50, "cloud", 10)
    head = heightline(rng, 200, 120, 12)
    cv.fill_heights(head, 166, "far0", x0=280)
    # far quay with warehouses
    x = -4
    while x < 300:
        w = rng.int(36, 52)
        top = rng.int(132, 140)
        cv.rect(x, top + 6, w, 166 - top - 6, "far1")
        roof(cv, x - 1, x + w + 1, top, 6, "far0", ridge="far0")
        cv.rect(x + 4, top + 14, w - 8, 2, "fog")
        x += w + 4
    cv.rect(0, 166, W, gy - 166, "water1")
    reflect(cv, rng, 166, gy, ["water0", "water1", "far0", "rim"], wobble=2)
    ripples(cv, rng, 168, gy - 2, "water_hi", 30, 2, 8)
    # moored boats and masts
    for mx in (60, 132, 214):
        cv.poly([(mx - 18, 176), (mx + 18, 176), (mx + 13, 182), (mx - 13, 182)], "mid1")
        cv.vline(mx, 96, 176, "mid1")
        cv.line(mx - 13, 130, mx + 11, 117, "mid1")
        cv.line(mx - 13, 131, mx + 11, 118, "mid1")
        cv.line(mx, 97, mx - 17, 175, "mid0")
        cv.line(mx, 97, mx + 17, 175, "mid0")
    # cargo jib crane (its walk is the runtime platform)
    cv.rect(300, 40, 6, gy - 40, "wood0")
    cv.vline(305, 40, gy - 1, "wood1")
    cv.line(306, 44, 380, 96, "wood0")
    cv.line(306, 45, 380, 97, "wood0")
    cv.line(306, 70, 380, 97, "wood0")
    chain(cv, 380, 98, 140, "metal0")
    cv.rect(374, 140, 12, 8, "wood1")
    # lantern boats at the escort exit (right)
    for i, (bx, by) in enumerate(((410, 196), (452, 204))):
        cv.poly([(bx - 24, by), (bx + 24, by), (bx + 18, by + 7), (bx - 18, by + 7)], "mid0")
        cv.vline(bx - 6, by - 26, by, "wood0")
        lantern(cv, bx - 6, by - 22, "accent", "wood0", "glow1", "glow2", hi="warm", size=0)
        light_column(cv, rng, bx - 6, by + 9, gy, "accent_dim", 5)
    rain(cv, rng, 170, "rain", (0, 0, W, gy))
    rain(cv, rng, 40, "rim", (0, 0, W, 96), length=5)


def stage_salt_warehouse(cv: Canvas, rng: Rng, gy: int) -> None:
    cv.rect(0, 0, W, gy, "mid1")
    for x in range(0, W, 8):
        cv.vline(x, 40, gy - 1, "mid0")
        if x % 24 == 0:
            cv.vline(x + 1, 40, gy - 1, "mid2")
    cv.rect(0, 0, W, 14, "ink")
    cv.poly([(0, 14), (240, 0), (480, 14)], "mid0")
    for x in range(10, W, 30):
        cv.vline(x, 14, 40, "wood0")
    cv.rect(0, 36, W, 6, "wood0")
    cv.hline(0, W - 1, 36, "wood1")
    cv.rect(150, 50, 180, 40, "sky1")
    cv.rect(150, 90, 180, 40, "sky2")
    cv.rect(150, 130, 180, 30, "sky3")
    cv.rect(150, 160, 180, gy - 160, "water1")
    reflect(cv, rng, 160, gy, ["water0", "water1", "sky2", "rim"], wobble=2)
    cv.poly([(196, 158), (244, 158), (238, 163), (202, 163)], "far0")
    cv.vline(220, 120, 158, "far0")
    cv.line(209, 136, 231, 126, "far0")
    rain(cv, rng, 46, "rim", (150, 50, 330, gy), length=5, slope=2)
    for dx in (140, 330):
        cv.rect(dx, 42, 10, gy - 42, "wood0")
        cv.vline(dx + 9, 42, gy - 1, "wood1")
    cv.rect(140, 42, 200, 8, "wood0")
    for dx in (102, 340):
        cv.rect(dx, 54, 38, gy - 54, "wood1")
        for y in range(60, gy, 12):
            cv.hline(dx, dx + 37, y, "wood0")
        cv.vline(dx + 19, 54, gy - 1, "wood0")
    cv.rect(234, 14, 12, 4, "metal0")
    chain(cv, 240, 18, 72, "metal0", hi="metal1")
    cv.rect(236, 72, 9, 3, "metal1")
    cv.put(240, 76, "accent")
    bag_pile(cv, rng, -8, 104, gy, 7, "salt0", "salt1", "mid0", "wood1")
    bag_pile(cv, rng, 376, W + 8, gy, 7, "salt0", "salt1", "mid0", "wood1")
    specks(cv, rng, 16, ["salt2"], (0, 170, 100, gy))
    specks(cv, rng, 16, ["salt2"], (380, 170, W, gy))
    rain(cv, rng, 18, "rain", (0, 40, 150, 100), length=3)
    rain(cv, rng, 18, "rain", (330, 40, W, 100), length=3)


def stage_tide_caves(cv: Canvas, rng: Rng, gy: int) -> None:
    cv.rect(0, 0, W, gy, "mid0")
    mouth = cave_mouth_mask(cv, rng, 248, 118, 70, 62, gy, 12)
    mp = mouth.load()
    for y in range(0, gy):
        key = "sky1" if y < 100 else "sky2" if y < 140 else "sky3"
        for x in range(W):
            if mp[x, y]:
                cv.put(x, y, key)
    isle = heightline(rng, 60, 148, 6)
    for i, top in enumerate(isle):
        x = 270 + i
        for y in range(top, 166):
            if mp[x, y]:
                cv.put(x, y, "far0")
    for y in range(166, gy):
        for x in range(W):
            if mp[x, y]:
                cv.put(x, y, "far1" if y < 174 else "fog" if y < 200 else "far1")
    ripples(cv, rng, 174, gy, "far0", 22, 3, 10)
    for cx, cy, rx, ry in ((40, 60, 70, 60), (120, 30, 60, 34), (30, 170, 60, 60), (150, 150, 34, 70),
                           (250, 20, 90, 30), (380, 28, 70, 40), (450, 90, 50, 80), (350, 150, 36, 70),
                           (450, 200, 60, 40), (96, 100, 40, 40), (400, 100, 40, 40)):
        boulder(cv, rng, cx, cy, rx, ry, "mid1", rim="mid2", shade="ink")
    for cx, cy, rx, ry in ((60, 120, 30, 20), (420, 160, 30, 22)):
        boulder(cv, rng, cx, cy, rx, ry, "mid2", rim="rim", shade="mid0")
    for sx in range(170, 330, 9):
        h = rng.int(5, 16)
        top = 46 + abs(sx - 248) // 5
        cv.poly([(sx, top - 4), (sx + 6, top - 4), (sx + 3, top + h)], "mid1")
        cv.put(sx + 3, top + h, "rim")
    for i in range(46):
        x = 52 + i
        sag = (i * (45 - i)) // 60
        cv.put(x, 92 + sag, "paper_dim")
        if i % 4 == 0:
            for d in range(1, 26 - abs(i - 23) // 2, 3):
                cv.put(x + (d % 2), 92 + sag + d, "paper_dim")
    for px, pw in ((20, 40), (400, 52)):
        cv.ellipse(px, gy - 9, px + pw, gy - 3, "water1")
        cv.hline(px + 6, px + pw // 2, gy - 7, "water_hi")
    rain(cv, rng, 14, "water_hi", (150, 40, 340, gy), length=2, slope=9)


def stage_storm_reef(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, 170, ["sky0", "sky1", "sky2", "sky3"])
    for y in (10, 26, 44, 60):
        cloud_strata(cv, rng, y, 12, "cloud", 7, 40, 140)
    cv.rect(0, 150, W, 22, "far0")
    # the carrack wreck: broken hull, stern castle, snapped masts
    cv.poly([(104, 152), (196, 152), (204, 140), (186, 142), (180, 132), (166, 132), (164, 142), (112, 144)], "far1")
    cv.line(128, 144, 120, 92, "far1")
    cv.line(129, 144, 121, 92, "far1")
    cv.line(122, 102, 112, 124, "far1")
    cv.line(150, 144, 160, 104, "far1")
    cv.line(176, 132, 196, 116, "far1")
    cv.line(121, 96, 150, 120, "far0")
    fog_band(cv, rng, 154, 22, "fog", 3)
    cv.rect(0, 176, W, gy - 176, "water1")
    for y in range(179, gy, 6):
        x = -rng.int(0, 20)
        while x < W:
            w = rng.int(10, 26)
            cv.hline(x, x + w, y, "rim" if y < 192 else "water0")
            cv.hline(x + 2, x + w - 2, y + 1, "water0")
            x += w + rng.int(10, 26)
    for rx, rw, rh in ((-6, 70, 58), (190, 56, 36), (300, 70, 60), (414, 72, 46)):
        cv.poly([(rx, gy), (rx + rw // 4, gy - rh), (rx + rw // 2, gy - rh + 14), (rx + rw * 3 // 4, gy - rh - 6), (rx + rw, gy)], "mid1")
        cv.line(rx + rw // 4, gy - rh, rx + rw // 2, gy - rh + 14, "mid2")
    specks(cv, rng, 40, ["water_hi", "fog"], (0, 160, W, 200))
    rain(cv, rng, 140, "rain", (0, 0, W, gy), length=5, slope=2)


def stage_ash_fields(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, 160, ["sky0", "sky1", "sky2", "sky3"])
    for y in (16, 34):
        cloud_strata(cv, rng, y, 12, "cloud", 6, 40, 120)
    cv.poly([(96, 142), (176, 56), (198, 54), (292, 142)], "far0")
    cv.poly([(176, 56), (198, 54), (214, 72), (186, 66)], "far1")
    cv.hline(178, 196, 55, "accent_dim")
    cv.put(186, 56, "accent")
    cv.put(190, 57, "accent_dim")
    puff_plume(cv, rng, 188, 46, 9, "cloud", "far1", "sky1")
    ridge = heightline(rng, W, 128, 12)
    cv.fill_heights(ridge, 172, "far1")
    for tx in (30, 360, 430):
        top = ridge[tx] - 22
        cv.vline(tx, top, ridge[tx], "far0")
        cv.vline(tx + 6, top, ridge[tx], "far0")
        cv.rect(tx - 2, top - 4, 11, 5, "far0")
    fog_band(cv, rng, 160, 24, "fog", 3)
    dune = heightline(rng, W, 180, 7)
    cv.fill_heights(dune, gy, "mid2")
    cv.rim_heights(dune, "rim", every=3)
    dune2 = heightline(rng, W, 198, 5)
    cv.fill_heights(dune2, gy, "mid1")
    for x, h in ((128, 30), (196, 22), (452, 34)):
        charred_tree(cv, x, dune[x] + 2, h, "mid0")
    for cx, cy, rx, ry in ((260, 196, 14, 8), (300, 200, 9, 6), (20, 200, 12, 7)):
        boulder(cv, rng, cx, cy, rx, ry, "mid0", rim="mid2", shade="ink")
    # relay station hut on stilts
    for sx in (70, 100):
        cv.rect(sx, 150, 3, gy - 150, "wood0")
    cv.rect(64, 136, 44, 16, "mid1")
    roof(cv, 60, 112, 128, 7, "mid0", ridge="mid0")
    cv.rect(80, 140, 6, 6, "glow2")
    cv.hline(64, 107, 152, "wood0")
    cv.line(70, 170, 100, 152, "wood0")
    # warning posts, cloth strips streaming downwind
    for wx in (156, 236, 410):
        base = dune[wx] + 4
        cv.vline(wx, base - 44, base, "wood1")
        cv.rect(wx + 1, base - 44, 8, 2, "accent_dim")
        cv.rect(wx + 1, base - 39, 6, 2, "accent_dim")
    # release channel: a short sunken stone race near the bound oni
    cv.rect(330, 206, 150, 6, "mid0")
    cv.hline(330, W - 1, 206, "rim")
    cv.rect(332, 208, 148, 3, "water1")
    ripples(cv, rng, 208, 210, "water_hi", 6, 2, 4, x0=334, x1=470)
    for _ in range(60):
        x = rng.int(0, W)
        y = rng.int(184, gy - 2)
        cv.line(x, y, x + rng.int(2, 4), y - rng.int(3, 7), "mid0")
    specks(cv, rng, 70, ["paper_dim", "cloud"], (0, 0, W, gy))
    specks(cv, rng, 12, ["accent"], (0, 80, W, gy))


def stage_archive_furnace(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, gy, ["mid0", "mid1", "mid2", "mid2"])
    cv.rect(170, 30, 140, gy - 30, "far0")
    cv.poly([(170, 30), (240, 4), (310, 30)], "far0")
    cv.rect(226, 0, 28, 10, "far0")
    cv.rect(200, 46, 80, 40, "glow1")
    cv.rect(206, 52, 68, 30, "glow2")
    cv.rect(214, 58, 52, 20, "accent")
    for bx in range(214, 266, 8):
        cv.rect(bx, 58, 2, 20, "glow2")
    cv.rect(196, 100, 88, gy - 100, "metal0")
    for y in range(106, gy, 12):
        cv.hline(198, 282, y, "far1")
    cv.vline(240, 100, gy - 1, "g0")
    cv.vline(239, 100, gy - 1, "glow1")
    cv.vline(241, 100, gy - 1, "glow1")
    for sx in (14, 70, 360, 416):
        shelves(cv, rng, sx, 60, 50, gy - 60, "metal0", "mid1", ["mid2", "far0"], gap=10, accent="accent_dim")
    for fx in (140, 330):
        cv.rect(fx, 0, 10, gy, "mid0")
        cv.vline(fx + 9, 0, gy - 1, "far1")
    for cx in (122, 356):
        chain(cv, cx, 0, 120, "metal0", hi="metal1")
    specks(cv, rng, 34, ["accent", "warm", "glow2"], (150, 0, 330, 100))
    specks(cv, rng, 24, ["accent_dim"], (0, 0, W, gy))


def stage_archive_roof(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, 170, ["sky0", "sky1", "sky2", "sky3"])
    cloud_strata(cv, rng, 10, 40, "cloud", 8)
    moon(cv, 384, 46, 10, "paper_dim", "sky2", "sky3", shade="sky3")
    # far city roofs
    for layer, (key, base, step) in enumerate((("far1", 140, 30), ("far0", 160, 36))):
        x = -rng.int(0, 20)
        while x < W:
            w = rng.int(step - 8, step + 10)
            top = base + rng.int(-6, 6)
            cv.rect(x, top + 4, w, 200 - top, key)
            roof(cv, x - 1, x + w + 1, top, 4, key)
            if layer == 1 and rng.chance(1, 3):
                cv.rect(x + w // 2, top + 8, 3, 2, "accent_dim")
            x += w + 2
    # archive storehouse tower
    cv.rect(206, 70, 40, 110, "mid1")
    roof(cv, 198, 254, 62, 8, "mid0", ridge="mid0")
    roof(cv, 200, 252, 100, 6, "mid0")
    cv.rect(220, 80, 12, 10, "paper_dim")
    # canal glimmer and a rain haze between the roof layers
    cv.rect(0, 182, W, 6, "water1")
    ripples(cv, rng, 183, 187, "water_hi", 20, 2, 6)
    fog_band(cv, rng, 170, 18, "fog", 2)
    # nearer roof masses, lifted so dark sprites keep their silhouettes
    x = -10
    while x < W:
        w = rng.int(60, 90)
        top = rng.int(180, 190)
        cv.rect(x, top + 8, w, gy - top - 8, "mid1")
        roof(cv, x - 3, x + w + 3, top, 9, "mid2", ridge="mid0", lines="mid1")
        cv.hline(x - 2, x + w + 2, top + 10, "mid0")
        x += w + 4
    for lx in (60, 170, 300, 430):
        lantern(cv, lx, 204, "accent", "mid0", "glow1", "glow2", size=0)
    rain(cv, rng, 100, "rain", (0, 0, W, gy))


def stage_public_tribunal(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, 120, ["sky0", "sky1", "sky2", "sky3"])
    ridge = heightline(rng, W, 96, 8)
    cv.fill_heights(ridge, 130, "far0")
    cv.rect(0, 110, W, gy - 110, "mid1")
    roof(cv, -10, 490, 86, 22, "mid0", ridge="ink", eave="ink", lines="mid1", flare=3)
    cv.rect(0, 110, W, 7, "accent_dim")
    for k in range(0, W, 6):
        cv.vline(k, 110, 116, "mid0")
    cv.hline(0, W - 1, 116, "accent")
    for px in range(20, W, 64):
        cv.rect(px, 117, 7, gy - 117, "mid0")
        cv.vline(px + 6, 117, gy - 1, "mid2")
    for cx in range(27, W - 40, 64):
        cv.rect(cx + 6, 126, 45, 54, "mid2")
        for k in range(cx + 6, cx + 51, 9):
            cv.vline(k, 126, 179, "mid1")
    # blank notice boards on the hall front (no lettering)
    for bx in (92, 220):
        cv.rect(bx, 136, 16, 22, "wood1")
        cv.rect(bx + 2, 138, 12, 18, "paper_low")
    cv.rect(0, 182, W, 6, "wood1")
    cv.hline(0, W - 1, 182, "wood2")
    cv.rect(0, 188, W, gy - 188, "mid0")
    for sx in range(8, W, 16):
        cv.rect(sx, 190, 3, gy - 190, "wood0")
    # iron tripod braziers
    for bx in (36, 286):
        cv.ellipse(bx - 11, 151, bx + 11, 173, "glow1")
        cv.ellipse(bx - 6, 156, bx + 6, 168, "glow2")
        cv.poly([(bx - 7, 163), (bx + 7, 163), (bx + 5, 168), (bx - 5, 168)], "metal0")
        cv.hline(bx - 7, bx + 7, 163, "metal1")
        cv.rect(bx - 5, 161, 11, 2, "accent")
        for dx in (-5, 0, 5):
            cv.line(bx + dx // 2, 168, bx + dx, gy - 1, "metal0")
        specks(cv, rng, 5, ["warm", "accent"], (bx - 4, 152, bx + 4, 160))
    # canal lock at the far right: stone walls, sliding gate board, winch wheel
    cv.rect(440, 140, 14, gy - 140, "far0")
    cv.rect(468, 140, 12, gy - 140, "far0")
    cv.hline(440, 453, 140, "far1")
    cv.rect(454, 150, 14, gy - 150, "wood0")
    for y in range(154, gy, 8):
        cv.hline(454, 467, y, "wood1")
    cv.rect(452, 132, 18, 4, "wood0")
    cv.draw.ellipse((454, 118, 468, 132), outline=cv.c("wood1"))
    cv.line(454, 125, 468, 125, "wood1")
    cv.line(457, 119, 465, 131, "wood1")
    cv.line(465, 119, 457, 131, "wood1")
    rain(cv, rng, 60, "rain", (0, 0, W, 110))


def stage_prison_ferry(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, 150, ["sky0", "sky1", "sky2", "sky3"])
    cloud_strata(cv, rng, 12, 36, "sky1", 9)
    ridge = heightline(rng, W, 112, 12)
    cv.fill_heights(ridge, 150, "far0")
    sugi_row(cv, rng, 146, 26, (18, 30), (8, 12), "far1")
    for lx in (40, 96, 150, 380):
        cv.rect(lx, 142, 2, 2, "paper_dim")
    cv.rect(0, 150, W, gy - 150, "water1")
    for y in range(152, gy, 4):
        x = -rng.int(0, 30)
        while x < W:
            w = rng.int(14, 40)
            cv.hline(x, x + w, y, "water0" if y % 8 else "far1")
            x += w + rng.int(14, 34)
    cv.line(0, 40, W - 1, 92, "metal0")
    cv.rect(460, 80, 6, 100, "wood0")
    cv.poly([(40, 186), (200, 186), (190, 198), (50, 198)], "mid0")
    cv.rect(70, 150, 100, 36, "mid1")
    for bx in range(72, 170, 6):
        cv.vline(bx, 150, 185, "metal0")
    cv.rect(66, 146, 108, 4, "wood0")
    lantern(cv, 60, 160, "paper", "wood0", "glow1", "glow2", hi="warm", size=0)
    light_column(cv, rng, 60, 200, gy, "glow2", 4)
    for px in (240, 270):
        cv.rect(px, 170, 4, gy - 170, "wood0")
    rain(cv, rng, 130, "rain", (0, 0, W, gy))


def stage_bell_aqueduct(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, 180, ["sky0", "sky1", "sky2", "sky3"])
    ridge = heightline(rng, W, 120, 14)
    cv.fill_heights(ridge, 190, "far0")
    fog_band(cv, rng, 150, 50, "fog", 3)
    # the aqueduct arcade
    centres = arcade(cv, rng, -10, W + 10, 54, gy, 62, 18, "mid1", "mid0", rim="rim", start=6)
    cv.rect(0, 46, W, 8, "mid2")
    cv.hline(0, W - 1, 46, "rim")
    # water spilling from the channel through broken stones
    for sx in (92, 352):
        for y in range(54, gy, 1):
            if (y // 2) % 3:
                cv.put(sx, y, "water_hi")
            cv.put(sx + 1, y, "water1")
    # hanging bells under the arches (four counts)
    for i, cx in enumerate(centres[:7]):
        if i % 2 == 0:
            chain(cv, cx, 74, 98, "metal0")
            bell(cv, cx, 100, 14, 16, "metal0", "mid0", "metal1", "mid0")
    rain(cv, rng, 120, "rain", (0, 0, W, gy))


def stage_black_gate(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, 160, ["sky0", "sky1", "sky2", "sky3"])
    for y in (8, 24, 42):
        cloud_strata(cv, rng, y, 12, "cloud", 6, 40, 120)
    kurohana_keep(cv, 240, 104, 3, "far0", light="accent_dim", rim="far1")
    # outer walls with stone courses
    cv.rect(0, 100, W, gy - 100, "mid1")
    cv.hline(0, W - 1, 100, "far1")
    for y in range(104, gy, 7):
        cv.hline(0, W - 1, y, "mid0")
        for x in range((y // 7) % 2 * 10, W, 20):
            cv.vline(x, y + 1, y + 6, "mid0")
    # flanking gate towers
    for tx in (120, 300):
        cv.rect(tx, 62, 60, gy - 62, "mid2")
        cv.vline(tx, 62, gy - 1, "far0")
        roof(cv, tx - 8, tx + 68, 52, 10, "mid0", ridge="ink", eave="accent_dim", flare=3)
        cv.rect(tx + 24, 76, 12, 16, "accent_dim")
        cv.rect(tx + 26, 78, 8, 12, "blood_glass")
    # the Black Gate: lacquer doors framed in vermilion, iron studs
    cv.rect(180, 96, 120, gy - 96, "ink")
    roof(cv, 172, 308, 84, 12, "ink", ridge="ink", eave="accent", flare=4)
    cv.rect(186, 104, 108, gy - 104, "mid0")
    cv.rect(186, 104, 108, 2, "accent_dim")
    cv.vline(186, 104, gy - 1, "accent_dim")
    cv.vline(293, 104, gy - 1, "accent_dim")
    cv.vline(240, 106, gy - 1, "ink")
    for px in (190, 242):
        for py in range(110, gy - 6, 22):
            cv.rect(px + 2, py, 44, 18, "mid1")
            cv.hline(px + 2, px + 45, py, "mid2")
    for y in range(116, gy, 22):
        for x in range(196, 290, 10):
            cv.put(x, y, "metal1")
    # umbral veins creeping across the doors (architecture, not blood)
    for vx in (204, 268):
        x = vx
        for y in range(118, 196):
            x += (1 if (y * 7 + vx) % 5 == 0 else 0) - (1 if (y * 3 + vx) % 7 == 0 else 0)
            cv.put(x, y, "umbral_dim")
            if y % 17 == 0:
                cv.hline(x, x + 4, y, "umbral_dim")
    # ash haze rolling along the causeway, behind the fighters
    fog_band(cv, rng, gy - 36, 36, "fog", 4)
    fog_band(cv, rng, gy - 18, 18, "far1", 3)
    for lx in (88, 392):
        cv.rect(lx - 1, 100, 3, gy - 100, "ink")
        lantern(cv, lx, 94, "paper", "ink", "glow1", "glow2", hi="warm", size=1)
    specks(cv, rng, 26, ["ember", "accent"], (0, 0, W, gy))
    specks(cv, rng, 20, ["umbral"], (0, 0, W, gy))


def stage_outer_archive(cv: Canvas, rng: Rng, gy: int) -> None:
    bands(cv, 0, gy, ["mid0", "mid1", "mid1", "mid2"])
    # tall slatted windows of blood-dark glass (renji-mado style, no arches)
    for wx in (192, 266):
        cv.rect(wx, 30, 22, 112, "ink")
        cv.rect(wx + 2, 34, 18, 104, "accent_dim")
        cv.rect(wx + 4, 54, 4, 30, "blood")
        for sx in range(wx + 2, wx + 21, 4):
            cv.vline(sx, 34, 137, "ink")
        cv.rect(wx - 2, 28, 26, 3, "mid2")
        cv.rect(wx - 2, 141, 26, 3, "mid2")
    # a bell mouth opening in the far wall: the castle's living bell network
    cv.ellipse(222, 150, 258, 186, "mid0")
    cv.ellipse(226, 154, 254, 182, "vein")
    cv.ellipse(230, 158, 250, 178, "ink")
    for i, sx in enumerate((0, 50, 100, 330, 380, 430)):
        top = 20 + (i % 3) * 6
        shelves(cv, rng, sx, top, 48, gy - top, "ink", "mid1", ["mid2", "far0"], gap=11, accent="accent_dim", accent_rate=10)
    for px in (160, 312):
        cv.rect(px, 0, 14, gy, "ink")
        cv.vline(px + 13, 0, gy - 1, "rim")
        cv.ellipse(px + 2, 96, px + 11, 108, "vein")
        cv.ellipse(px + 4, 99, px + 9, 106, "mid0")
    for vx in (164, 316):
        x = vx
        for y in range(20, gy):
            x += (1 if (y * 5 + vx) % 9 == 0 else 0) - (1 if (y * 11 + vx) % 13 == 0 else 0)
            cv.put(min(max(x, vx - 2), vx + 6), y, "vein")
    cv.rect(0, 0, W, 10, "ink")
    for x in range(0, W, 24):
        cv.rect(x, 10, 4, 6, "ink")


def stage_observatory(cv: Canvas, rng: Rng, gy: int) -> None:
    cv.rect(0, 0, W, gy, "mid1")
    mask_img, md = cv.mask()
    md.ellipse((40, -150, 440, 250), fill=1)
    cv.fill_mask(mask_img, "mid2")
    m2, md2 = cv.mask()
    md2.ellipse((150, -80, 330, 80), fill=1)
    cv.fill_mask(m2, "sky0")
    stars(cv, rng, 40, ["paper_dim", "rim", "dawn"], (160, 0, 320, 70))
    for rx in (60, 110, 370, 420):
        cv.line(240, -40, rx, 200, "mid0")
    cv.draw.ellipse((150, 20, 330, 120), outline=cv.c("metal0"))
    cv.draw.ellipse((170, 10, 310, 130), outline=cv.c("metal0"))
    cv.draw.arc((140, 40, 340, 100), 180, 360, fill=cv.c("metal1"))
    cv.vline(240, 0, 20, "metal0")
    bell(cv, 240, 26, 56, 66, "mid0", "ink", "rim", "accent_dim", seam="blood", mid="mid1")
    # bell-mouth niches in the dome wall (the castle's living bell network)
    for nx in (140, 176, 304, 340):
        cv.ellipse(nx - 6, 128, nx + 6, 146, "mid0")
        cv.ellipse(nx - 4, 132, nx + 4, 146, "vein")
        cv.hline(nx - 6, nx + 6, 146, "metal0")
    for i in range(4):
        cv.rect(200 - i * 10, 190 + i * 7, 80 + i * 20, 7, "mid0" if i % 2 else "mid2")
        cv.hline(200 - i * 10, 279 + i * 10, 190 + i * 7, "rim")
    cv.rect(226, 156, 28, 34, "ink")
    cv.rect(222, 150, 36, 8, "ink")
    cv.hline(222, 257, 150, "accent_dim")
    for px in (20, 96, 370, 446):
        cv.rect(px, 0, 14, gy, "ink")
        cv.vline(px + 12, 0, gy - 1, "rim")
        cv.rect(px - 2, 40, 18, 4, "metal0")


def stage_epilogue_archive(cv: Canvas, rng: Rng, gy: int) -> None:
    cv.rect(0, 0, W, gy, "mid1")
    for wx in (40, 196, 352):
        cv.rect(wx, 30, 88, 104, "mid0")
        for key, y, hh in (("sky1", 34, 22), ("sky2", 56, 26), ("sky3", 82, 32), ("dawn", 114, 8)):
            cv.rect(wx + 4, y, 80, hh, key)
        hill = heightline(rng, 80, 116, 5)
        cv.fill_heights(hill, 130, "far1", x0=wx + 4)
        cv.hline(wx + 10, wx + 40, 50, "cloud")
        cv.hline(wx + 30, wx + 70, 66, "cloud")
        for bx in range(wx + 22, wx + 84, 20):
            cv.rect(bx, 34, 3, 96, "mid0")
        for by in (60, 96):
            cv.rect(wx + 4, by, 80, 2, "mid0")
        cv.rect(wx - 14, 30, 12, 104, "wood1")
        cv.rect(wx + 90, 30, 12, 104, "wood1")
        cv.rect(wx - 2, 134, 92, 4, "wood2")
        cv.rect(wx + 4, 138, 80, 30, "mid2")
        for px in range(wx + 6, wx + 84, 8):
            cv.vline(px, 138, 167, "mid1")
    cv.rect(410, 96, 8, 34, "far0")
    roof(cv, 402, 426, 90, 5, "far0")
    cv.rect(411, 98, 6, 5, "warm")
    for sx in (134, 290):
        shelves(cv, rng, sx, 30, 56, gy - 30, "wood0", "mid2", ["wood1", "mid1"], gap=12, accent="paper_dim", accent_rate=8)
    cv.rect(0, 0, W, 22, "wood0")
    for x in range(0, W, 40):
        cv.rect(x, 0, 8, 30, "wood1")
        cv.rect(x + 2, 22, 4, 8, "wood3")
    for wx in (40, 196, 352):
        cv.poly([(wx + 4, 170), (wx + 84, 170), (wx + 96, gy), (wx + 16, gy)], "mid2")
    cv.rect(96, 196, 40, 4, "wood2")
    cv.rect(100, 200, 3, gy - 200, "wood1")
    cv.rect(129, 200, 3, gy - 200, "wood1")
    cv.rect(104, 192, 10, 4, "paper")
    specks(cv, rng, 24, ["dawn", "paper"], (0, 30, W, 170))


def sugi(cv: Canvas, rng: Rng, x: int, base: int, h: int, w: int, key: str, rim: str | None = None, trunk_key: str | None = None) -> None:
    """Japanese cedar: straight trunk, narrow cone of drooping foliage clumps."""
    top = base - h
    crown = h * 3 // 4
    tw = max(1, w // 9)
    cv.rect(x - tw // 2, top + crown // 4, tw, h - crown // 4, trunk_key or key)
    n = max(4, crown // 7)
    for i in range(n):
        cy = top + crown - crown * i // n
        half = max(2, (w // 2) * (n - i) // n + rng.int(-1, 1))
        ch = max(3, crown // n + 2)
        side = rng.int(-1, 1)
        cv.ellipse(x - half + side, cy - ch, x + half + side, cy, key)
        cv.put(x - half + side - 1, cy - 1, key)
        cv.put(x + half + side + 1, cy - 1, key)
        if rim and half > 2:
            for dx in range(-half // 2, half // 3):
                if (dx + i) % 3:
                    cv.put(x + dx + side, cy - ch, rim)
    cv.vline(x, top - 3, top + 2, key)


def sugi_row(cv: Canvas, rng: Rng, y_base: int, count: int, h_range, w_range, key: str, rim: str | None = None, x_range=(-10, W + 10)) -> None:
    for i in range(count):
        span = (x_range[1] - x_range[0]) // count
        x = x_range[0] + i * span + rng.int(0, span)
        sugi(cv, rng, x, y_base + rng.int(-3, 3), rng.int(*h_range), rng.int(*w_range), key, rim)


def canopy(cv: Canvas, rng: Rng, depth: int, key: str, rim: str | None = None) -> None:
    edge = heightline(rng, cv.w, depth, depth // 3)
    for x, bottom in enumerate(edge):
        cv.rect(x, 0, 1, max(0, bottom), key)
    for _ in range(cv.w // 9):
        cx = rng.int(0, cv.w - 1)
        cy = edge[cx] + rng.int(-4, 2)
        r = rng.int(5, 11)
        cv.ellipse(cx - r, cy - r // 2, cx + r, cy + r // 2, key)
        if rim:
            cv.hline(cx - r // 2, cx + r // 3, cy + r // 2, rim)


def box_lantern(cv: Canvas, x: int, y: int, wood: str, paper: str, halo_outer: str, halo_inner: str, base: int) -> None:
    """Square wooden roadside lantern on a post (secular, unmarked)."""
    cv.ellipse(x - 9, y - 9, x + 9, y + 9, halo_outer)
    cv.ellipse(x - 6, y - 6, x + 6, y + 6, halo_inner)
    cv.rect(x - 1, y + 5, 3, base - y - 5, wood)
    cv.rect(x - 4, y - 4, 9, 9, wood)
    cv.rect(x - 3, y - 3, 7, 7, paper)
    cv.vline(x, y - 3, y + 3, wood)
    cv.poly([(x - 6, y - 5), (x, y - 9), (x + 6, y - 5)], wood)
    cv.rect(x - 3, y + 5, 7, 1, wood)


def cave_mouth_mask(cv: Canvas, rng: Rng, cx: int, cy: int, a: int, b: int, bottom: int, jitter: int):
    """Irregular arch opening from an integer ellipse with ridge-noise edges."""
    from math import isqrt
    mask_img, _md = cv.mask()
    mp = mask_img.load()
    left = heightline(rng, bottom - (cy - b) + 1, 0, jitter)
    right = heightline(rng, bottom - (cy - b) + 1, 0, jitter)
    for i, y in enumerate(range(cy - b, bottom)):
        dy = y - cy
        hw = a * isqrt(b * b - dy * dy) // b if dy < 0 else a + dy // 6
        x0 = cx - hw + abs(left[i])
        x1 = cx + hw - abs(right[i])
        for x in range(max(0, x0), min(cv.w, x1 + 1)):
            mp[x, y] = 1
    return mask_img


def facade(cv: Canvas, rng: Rng, x: int, w: int, top: int, base: int, lit: bool, keys: dict) -> None:
    """Two-storey townhouse front: upper slat window, lower eave, lattice front."""
    cv.rect(x, top + 8, w, base - top - 8, keys["wall"])
    roof(cv, x - 2, x + w + 2, top, 8, keys["roof"], ridge=keys["roof"], eave=keys["roof"], lines=keys["wall"])
    win_w = max(8, w // 2)
    wx = x + (w - win_w) // 2
    if lit:
        shoji(cv, wx, top + 13, win_w, 8, keys["lit"], keys["roof"])
    else:
        cv.rect(wx, top + 13, win_w, 8, keys["roof"])
        for sx in range(wx + 1, wx + win_w - 1, 2):
            cv.vline(sx, top + 14, top + 19, keys["slat"])
    hy = top + 25
    cv.poly([(x - 3, hy + 4), (x + 1, hy), (x + w - 1, hy), (x + w + 3, hy + 4)], keys["roof"])
    cv.rect(x, hy + 5, w, base - hy - 5, keys["front"])
    door = x + w - max(10, w // 3) - 2
    for sx in range(x + 2, door - 1, 2):
        cv.vline(sx, hy + 8, base - 1, keys["slat"])
    cv.rect(door, hy + 7, max(10, w // 3), base - hy - 7, keys["door"])
    if keys.get("noren") and rng.chance(1, 2):
        cv.rect(door, hy + 7, max(10, w // 3), 7, keys["noren"])
        cv.vline(door + max(10, w // 3) // 2, hy + 7, hy + 13, keys["door"])


def kurohana_keep(cv: Canvas, cx: int, base: int, s: int, key: str, light: str | None = None, rim: str | None = None) -> None:
    """Distant black-lacquer keep (invented): battered stone base, four flared tiers, bell-mouth finial."""
    cv.poly([(cx - 13 * s, base), (cx + 13 * s, base), (cx + 11 * s, base - 4 * s), (cx - 11 * s, base - 4 * s)], key)
    y = base - 4 * s
    for hw, th in ((10, 5), (8, 4), (6, 4), (4, 3)):
        cv.rect(cx - hw * s, y - th * s, 2 * hw * s + 1, th * s, key)
        roof(cv, cx - hw * s - 2 * s, cx + hw * s + 2 * s, y - th * s - 2 * s, 2 * s, key, flare=s)
        if rim:
            cv.hline(cx - hw * s - 2 * s, cx - hw * s, y - th * s, rim)
        y -= th * s + 2 * s
    cv.ellipse(cx - 2 * s, y - 3 * s, cx + 2 * s, y, key)
    if light:
        cv.rect(cx - s, base - 7 * s, max(1, s), max(1, s), light)
        cv.rect(cx + 3 * s, base - 13 * s, max(1, s), max(1, s), light)


UNIT12 = ((100, 0), (87, 50), (50, 87), (0, 100), (-50, 87), (-87, 50), (-100, 0), (-87, -50), (-50, -87), (0, -100), (50, -87), (87, -50))


def boulder(cv: Canvas, rng: Rng, cx: int, cy: int, rx: int, ry: int, key: str, rim: str | None = None, shade: str | None = None) -> None:
    """Jagged rock mass from a 12-point integer polygon with top rim and under-shade."""
    pts = []
    for ux, uy in UNIT12:
        k = rng.int(70, 112)
        pts.append((cx + ux * rx * k // 10000, cy + uy * ry * k // 10000))
    mask_img, md = cv.mask()
    md.polygon(pts, fill=1)
    cv.fill_mask(mask_img, key)
    mp = mask_img.load()
    x0, x1 = max(0, cx - rx - 2), min(cv.w, cx + rx + 3)
    y0, y1 = max(1, cy - ry - 2), min(cv.h - 1, cy + ry + 3)
    for y in range(y0, y1):
        for x in range(x0, x1):
            if not mp[x, y]:
                continue
            if rim and not mp[x, y - 1] and (x + y) % 5:
                cv.put(x, y, rim)
            elif shade and not mp[x, y + 1]:
                cv.put(x, y, shade)


def puff_plume(cv: Canvas, rng: Rng, x: int, y: int, steps: int, body: str, lit: str, shade: str) -> None:
    """Billowing smoke: distinct puffs rising then bending downwind."""
    for i in range(steps):
        r = 4 + i * 2 // 3 + rng.int(0, 2)
        cx = x + (i * i) // 3 + rng.int(-1, 1)
        cy = y - i * 6 + (i * i) // 5
        cv.ellipse(cx - r, cy - r, cx + r, cy + r, body)
        cv.ellipse(cx - r + 1, cy + r // 3, cx + r - 1, cy + r, shade)
        cv.ellipse(cx - r + 1, cy - r, cx + r // 2, cy - r // 3, lit)
        cv.ellipse(cx - r + 2, cy - r // 3, cx + r - 2, cy + r // 3, body)


def bag_pile(cv: Canvas, rng: Rng, x0: int, x1: int, base: int, rows: int, body: str, lit: str, shade: str, tie: str) -> None:
    """Straw salt bags heaped in loose courses; rounded, irregular, low contrast."""
    for row in range(rows):
        y = base - 1 - row * 7
        inset = row * 5
        x = x0 + inset + rng.int(0, 5)
        while x + 10 <= x1 - inset:
            w = rng.int(11, 16)
            h = rng.int(7, 9)
            yy = y + rng.int(-1, 0)
            cv.ellipse(x, yy - h, x + w, yy, body)
            cv.hline(x + 3, x + w - 4, yy - h, lit)
            cv.hline(x + 2, x + w - 2, yy, shade)
            cv.vline(x + w - 1, yy - h + 3, yy - 1, shade)
            cv.vline(x + 2 + rng.int(0, 1), yy - h + 2, yy - 2, tie)
            x += w - 2


def charred_tree(cv: Canvas, x: int, base: int, h: int, key: str) -> None:
    cv.rect(x, base - h, 2, h, key)
    cv.line(x, base - h * 2 // 3, x - 6, base - h + 2, key)
    cv.line(x + 1, base - h // 2, x + 8, base - h // 2 - 7, key)
    cv.line(x, base - h // 3, x - 4, base - h // 3 - 3, key)


STAGE_DRAWERS = {
    "hsh-census-square": stage_census_square,
    "c1-flooded-cedars": stage_flooded_cedars,
    "c1-tax-storehouse": stage_tax_storehouse,
    "fp1-wet-cedar-stage": stage_wet_cedar,
    "fp1-flooded-archive-stage": stage_flooded_archive,
    "tkm-bell-chamber": stage_bell_chamber,
    "sdg-rain-docks": stage_rain_docks,
    "sdg-salt-warehouse": stage_salt_warehouse,
    "ngi-tide-caves": stage_tide_caves,
    "ngi-storm-reef": stage_storm_reef,
    "kgr-ash-fields": stage_ash_fields,
    "kgr-archive-furnace": stage_archive_furnace,
    "kzu-archive-roof": stage_archive_roof,
    "kzu-public-tribunal": stage_public_tribunal,
    "hsh-prison-ferry": stage_prison_ferry,
    "hsh-bell-aqueduct": stage_bell_aqueduct,
    "c8-black-gate": stage_black_gate,
    "krh-outer-archive": stage_outer_archive,
    "krh-observatory": stage_observatory,
    "epi-hoshigawa-archive": stage_epilogue_archive,
}


def stage_tiles(stage_id: str) -> dict[str, Image.Image]:
    palette = PALETTES[stage_id]
    _title, ground, platform, support = STAGE_STYLE[stage_id]
    return {
        "ground-a": ground_tile(palette, ground, 0),
        "ground-b": ground_tile(palette, ground, 1),
        "platform-left": platform_tile(palette, platform, "left"),
        "platform-middle": platform_tile(palette, platform, "middle"),
        "platform-right": platform_tile(palette, platform, "right"),
        "support": support_tile(palette, support),
    }


def render_backdrop(stage_id: str, ground_y: int, tiles: dict[str, Image.Image]) -> Image.Image:
    palette = PALETTES[stage_id]
    cv = Canvas(palette)
    rng = Rng(f"{SUITE_ID}:{stage_id}")
    gy = ground_y // SCALE
    STAGE_DRAWERS[stage_id](cv, rng, gy)
    ground_body(cv, Rng(f"{SUITE_ID}:{stage_id}:ground"), gy, STAGE_STYLE[stage_id][1])
    out = composite_surfaces(cv.img, tiles, ground_y, [], include_platforms=False)
    allowed = {hex_rgb(v) + (255,) for v in palette.values()}
    stray = {c for c in out.getdata() if c not in allowed}
    if stray:
        raise ValueError(f"{stage_id} contains off-palette pixels: {sorted(stray)[:4]}")
    return out


# --------------------------------------------------------------------------
# Readability metrics for the fighters' band
# --------------------------------------------------------------------------

def rel_luminance(rgb) -> float:
    def lin(c):
        c = c / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb[:3]
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def calm_band_metrics(image: Image.Image, ground_y: int) -> dict:
    gy = ground_y // SCALE
    pix = image.load()
    lums = []
    for y in range(CALM_BAND_TOP, gy):
        for x in range(W):
            lums.append(rel_luminance(pix[x, y]))
    lums.sort()
    n = len(lums)
    bright = sum(1 for v in lums if v > 0.2)
    return {
        "rows": [CALM_BAND_TOP, gy],
        "meanLuminanceMilli": round(1000 * sum(lums) / n),
        "p05LuminanceMilli": round(1000 * lums[n * 5 // 100]),
        "p95LuminanceMilli": round(1000 * lums[n * 95 // 100]),
        "maxLuminanceMilli": round(1000 * lums[-1]),
        "brightPixelPermille": round(1000 * bright / n, 2),
    }


# --------------------------------------------------------------------------
# Review sheet with a tiny embedded bitmap font (no system fonts)
# --------------------------------------------------------------------------

FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
    " ": ["00000"] * 7,
}


def draw_text(image: Image.Image, x: int, y: int, text: str, color) -> None:
    pix = image.load()
    for ch in text.upper():
        glyph = FONT.get(ch, FONT[" "])
        for gy_, row in enumerate(glyph):
            for gx, bit in enumerate(row):
                if bit == "1" and 0 <= x + gx < image.width and 0 <= y + gy_ < image.height:
                    pix[x + gx, y + gy_] = color
        x += 6


def review_sheet(composites: list[tuple[str, int, Image.Image]]) -> Image.Image:
    cols, gutter, label = 4, 8, 12
    rows = (len(composites) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * W + (cols + 1) * gutter, 20 + rows * (H + label + gutter) + gutter), (7, 9, 16, 255))
    draw_text(sheet, gutter, 6, "ACTION STAGE BACKDROP SUITE V1 - 480X270 NATIVE - RUNTIME 2X - PLATFORMS FROM SURFACE TILES", (240, 220, 160, 255))
    for index, (stage_id, ground_y, image) in enumerate(composites):
        x = gutter + (index % cols) * (W + gutter)
        y = 20 + gutter + (index // cols) * (H + label + gutter)
        sheet.alpha_composite(image, (x, y + label))
        draw_text(sheet, x, y + 2, f"{index + 1:02d} {stage_id}  GROUNDY={ground_y}", (121, 196, 202, 255))
    return sheet


# --------------------------------------------------------------------------
# Outputs
# --------------------------------------------------------------------------

def build_outputs() -> dict[Path, bytes]:
    stage_ids = [stage_id for stage_id, _gy, _p in STAGES]
    if len(stage_ids) != 20 or len(set(stage_ids)) != 20:
        raise ValueError("Exactly 20 unique action stages are required")
    if set(stage_ids) != set(PALETTES) or set(stage_ids) != set(STAGE_STYLE) or set(stage_ids) != set(STAGE_DRAWERS):
        raise ValueError("Palette, style, and drawer coverage drifted from the stage list")
    tile_atlas = Image.new("RGBA", (TILE * len(TILE_ROLES), TILE * len(STAGES)), (0, 0, 0, 0))
    outputs: dict[Path, bytes] = {}
    records = []
    composites = []
    hashes = set()
    for row, (stage_id, ground_y, platforms) in enumerate(STAGES):
        if ground_y % SCALE or any(v % SCALE for _id, l, r, y in platforms for v in (l, r, y)):
            raise ValueError(f"{stage_id} geometry is not aligned to the {SCALE}x grid")
        tiles = stage_tiles(stage_id)
        for column, role in enumerate(TILE_ROLES):
            tile_atlas.alpha_composite(tiles[role], (column * TILE, row * TILE))
        image = render_backdrop(stage_id, ground_y, tiles)
        data = png_bytes(image)
        raw_hash = sha256(image.tobytes())
        if raw_hash in hashes:
            raise ValueError(f"duplicate backdrop pixels for {stage_id}")
        hashes.add(raw_hash)
        relative = f"{BACKDROP_DIR}/{stage_id}.png"
        outputs[ROOT / relative] = data
        outputs[RUNTIME_ROOT / relative] = data
        composite = composite_surfaces(image, tiles, ground_y, platforms, include_platforms=True, supports=STAGE_STYLE[stage_id][3] != "none")
        composites.append((stage_id, ground_y, composite))
        title, ground, platform, support = STAGE_STYLE[stage_id]
        records.append({
            "stageId": stage_id,
            "levelId": stage_id,
            "index": row,
            "title": title,
            "file": relative,
            "width": W,
            "height": H,
            "mode": image.mode,
            "sha256": sha256(data),
            "rgbaSha256": raw_hash,
            "colorCount": len(set(image.getdata())),
            "paletteSize": len(set(PALETTES[stage_id].values())),
            "groundY": ground_y,
            "platforms": [{"id": pid, "left": l, "right": r, "y": y} for pid, l, r, y in platforms],
            "surfaceMaterials": {"ground": ground, "platform": platform, "support": support},
            "supports": support != "none",
            "surfacePlanSha256": surface_plan_sha256(ground_y, platforms, support != "none", row),
            "tileRow": row,
            "calmBand": calm_band_metrics(image, ground_y),
        })
    tiles_data = png_bytes(tile_atlas)
    outputs[ROOT / TILES_NAME] = tiles_data
    outputs[RUNTIME_ROOT / TILES_NAME] = tiles_data
    sheet = review_sheet(composites)
    sheet_data = png_bytes(sheet)
    outputs[ROOT / REVIEW_NAME] = sheet_data
    alpha_values = sorted({a for *_rgb, a in tile_atlas.getdata()})
    manifest = {
        "schemaVersion": 1,
        "assetId": SUITE_ID,
        "status": "production-foundation-review",
        "provenance": {
            "lane": "pixel-authored deterministic production",
            "method": "integer-coordinate Pillow primitives at native resolution under explicit per-stage palettes",
            "generatedConceptPixels": False,
            "externalPixels": False,
            "resampling": "none in runtime outputs; review sheet is native 1x",
            "claimsNotMade": ["hand-pixeled", "hand-authored"],
        },
        "tooling": {"python": "3.12", "pillow": "11.3.0", "requirements": "requirements.txt"},
        "builderSha256": sha256(BUILDER_PATH.read_bytes()),
        "geometry": {
            "nativeWidth": W, "nativeHeight": H, "runtimeScale": SCALE,
            "canvasWidth": CANVAS_W, "canvasHeight": CANVAS_H,
            "calmBandTopNative": CALM_BAND_TOP,
            "tileSize": TILE, "tileRoles": list(TILE_ROLES),
        },
        "surfaceTiles": {
            "file": TILES_NAME, "width": tile_atlas.width, "height": tile_atlas.height,
            "columns": len(TILE_ROLES), "rows": len(STAGES), "mode": tile_atlas.mode,
            "alphaPolicy": "binary", "alphaValues": alpha_values, "sha256": sha256(tiles_data),
        },
        "reviewSheet": {"file": REVIEW_NAME, "width": sheet.width, "height": sheet.height, "purpose": "labelled-review-only", "sha256": sha256(sheet_data)},
        "renderPolicy": {
            "presentationOnly": True,
            "collisionAuthority": "game/action-stages.mjs",
            "alphaPolicy": "opaque backdrops; binary-alpha surface tiles",
            "bakeActors": False, "bakeText": False, "bakeUi": False,
            "bakeSacredObjects": False, "bakeAuthenticHeraldry": False, "bakeVictimFixtures": False, "gore": False,
        },
        "coverage": {"backdropCount": len(records), "distinctBackdropHashes": len(hashes), "stageIds": stage_ids},
        "runtimeCopies": [f"game/assets/art/{SUITE_ID}/{BACKDROP_DIR}/<stage-id>.png", f"game/assets/art/{SUITE_ID}/{TILES_NAME}"],
        "twoIndependentRendersByteIdentical": True,
        "externalCulturalReview": "pending",
        "artLock": False,
        "backdrops": records,
    }
    outputs[MANIFEST_PATH] = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="verify checked-in outputs without writing")
    parser.add_argument("--preview", metavar="DIR", help="also write 2x nearest-neighbour composites to DIR (review only)")
    args = parser.parse_args()
    first = build_outputs()
    second = build_outputs()
    if first != second:
        raise ValueError("Independent action-stage backdrop renders are not byte-identical")
    if args.check:
        stale = [str(path.relative_to(REPO)) for path, expected in first.items() if not path.exists() or path.read_bytes() != expected]
        if stale:
            print("stale or missing: " + ", ".join(stale), file=sys.stderr)
            return 1
        print(f"action stage backdrop suite is deterministic and current ({len(first)} outputs)")
        return 0
    for path, data in first.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    if args.preview:
        out = Path(args.preview)
        out.mkdir(parents=True, exist_ok=True)
        for stage_id, ground_y, platforms in STAGES:
            tiles = stage_tiles(stage_id)
            image = Image.open(io.BytesIO(first[ROOT / f"{BACKDROP_DIR}/{stage_id}.png"])).convert("RGBA")
            composite = composite_surfaces(image, tiles, ground_y, platforms, include_platforms=True, supports=STAGE_STYLE[stage_id][3] != "none")
            composite.resize((CANVAS_W, CANVAS_H), Image.Resampling.NEAREST).save(out / f"{stage_id}.png")
    print(f"wrote {len(first)} action-stage backdrop outputs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
