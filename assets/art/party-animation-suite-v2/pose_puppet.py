"""Integer pixel puppet operations for the party animation suite.

Every operation works on 48x64 RGBA key poses at native resolution. Nothing
here resamples or blends: rows and columns are moved or repeated whole, so the
output keeps the binary alpha and the palette of the source key poses.
"""
from __future__ import annotations

from dataclasses import dataclass

from PIL import Image

W, H = 48, 64
HIP = 47          # last torso row; legs occupy rows 48..58
FOOT = 58
OUTLINE_LIMIT = 70  # channel sum under which a pixel counts as dark outline

CREAM = (246, 231, 176, 255)
PUFF = (214, 222, 226, 255)
PUFF_DARK = (150, 164, 176, 255)
SWEAT = (150, 214, 236, 255)
SWEAT_LIGHT = (222, 244, 250, 255)
OUTLINE = (16, 14, 24, 255)


def blank() -> Image.Image:
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def opaque(pixel) -> bool:
    return pixel[3] != 0


def runs_in_row(img: Image.Image, y: int) -> list[tuple[int, int]]:
    result, start = [], None
    for x in range(W + 1):
        on = x < W and opaque(img.getpixel((x, y)))
        if on and start is None:
            start = x
        elif not on and start is not None:
            result.append((start, x - 1))
            start = None
    return result


@dataclass(frozen=True)
class Landmarks:
    top: int
    neck: int
    head_x0: int
    head_x1: int
    split_x: int


def landmarks(key0: Image.Image) -> Landmarks:
    box = key0.getchannel("A").getbbox()
    top = box[1]
    face_runs = runs_in_row(key0, top + 4)
    x0, x1 = max(face_runs, key=lambda run: run[1] - run[0])
    leg_runs = runs_in_row(key0, 52)
    split = (leg_runs[0][1] + leg_runs[-1][0]) // 2 if len(leg_runs) >= 2 else W // 2
    return Landmarks(top=top, neck=top + 14, head_x0=x0, head_x1=x1, split_x=split)


def paste(dst: Image.Image, src: Image.Image, dx: int = 0, dy: int = 0) -> None:
    """Composite src onto dst moved by whole pixels; the source is not resampled."""
    shifted = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(H):
        ty = y + dy
        if not 0 <= ty < H:
            continue
        for x in range(W):
            tx = x + dx
            if 0 <= tx < W:
                pixel = src.getpixel((x, y))
                if pixel[3]:
                    shifted.putpixel((tx, ty), pixel)
    dst.alpha_composite(shifted)


def crop_rows(img: Image.Image, y0: int, y1: int, x0: int = 0, x1: int = W - 1) -> Image.Image:
    out = blank()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            out.putpixel((x, y), img.getpixel((x, y)))
    return out


def stretch_band(img: Image.Image, y0: int, y1: int, delta: int) -> Image.Image:
    """Repeat (delta > 0) or drop (delta < 0) whole rows inside the band
    y0..y1, anchored at y1, so the chest rises or sinks while the hip stays."""
    if delta == 0:
        return img
    rows = list(range(y0, y1 + 1))
    n = len(rows)
    out_n = max(2, n + delta)
    mapped = [rows[min(n - 1, (i * n) // out_n)] for i in range(out_n)]
    out = blank()
    start = y1 - out_n + 1
    for y in range(0, y0):  # rows above the band ride along with the chest
        ty = y - delta
        if 0 <= ty < H:
            for x in range(W):
                pixel = img.getpixel((x, y))
                if pixel[3]:
                    out.putpixel((x, ty), pixel)
    for i, src_y in enumerate(mapped):
        ty = start + i
        if 0 <= ty < H:
            for x in range(W):
                pixel = img.getpixel((x, src_y))
                if pixel[3]:
                    out.putpixel((x, ty), pixel)
    return out


def shear_rows(img: Image.Image, y_pivot: int, y_top: int, lean: float, power: float = 1.0) -> Image.Image:
    """Shift rows horizontally in whole pixels, zero at y_pivot and `lean` at y_top."""
    if lean == 0:
        return img
    out = blank()
    span = max(1, y_pivot - y_top)
    for y in range(H):
        if y >= y_pivot:
            dx = 0
        else:
            dx = round(lean * (min(1.0, (y_pivot - y) / span) ** power))
        for x in range(W):
            pixel = img.getpixel((x, y))
            if pixel[3] and 0 <= x + dx < W:
                out.putpixel((x + dx, y), pixel)
    return out


def hem_sway(img: Image.Image, dx: int) -> Image.Image:
    """Cloth swing: the last torso rows slide sideways by whole pixels."""
    out = img.copy()
    for k, y in enumerate(range(HIP - 4, HIP + 1)):
        shift = round(dx * (k + 1) / 5)
        for x in range(W):
            out.putpixel((x, y), (0, 0, 0, 0))
        for x in range(W):
            pixel = img.getpixel((x, y))
            if pixel[3] and 0 <= x + shift < W:
                out.putpixel((x + shift, y), pixel)
    return out


def tip_sway(img: Image.Image, lm: Landmarks, dx: int, chest: int) -> Image.Image:
    """Weapon tip / hair ornament: columns beside the head above the neck slide sideways."""
    out = img.copy()
    y1 = lm.neck - chest
    for y in range(0, max(0, y1)):
        for x in range(lm.head_x1 + 1, W):
            out.putpixel((x, y), (0, 0, 0, 0))
    for y in range(0, max(0, y1)):
        for x in range(lm.head_x1 + 1, W):
            pixel = img.getpixel((x, y))
            if pixel[3] and 0 <= x + dx < W:
                out.putpixel((x + dx, y), pixel)
    return out


def flash(img: Image.Image, strength: int) -> Image.Image:
    """Hit flash: light pixels go to cream, outline stays. strength 1 keeps half."""
    out = img.copy()
    for y in range(H):
        for x in range(W):
            r, g, b, a = out.getpixel((x, y))
            if not a or r + g + b < OUTLINE_LIMIT:
                continue
            if strength >= 2 or r + g + b > 330:
                out.putpixel((x, y), CREAM)
    return out


def pose(
    key: Image.Image,
    lm: Landmarks,
    *,
    legs_from: Image.Image | None = None,
    lean: float = 0,
    top_dx: int = 0,
    bob: int = 0,
    chest: int = 0,
    head: tuple[int, int] = (0, 0),
    leg_l: tuple[int, int] = (0, 0),
    leg_r: tuple[int, int] = (0, 0),
    body_dx: int = 0,
    power: float = 1.0,
    hem: int = 0,
    tip: int = 0,
) -> Image.Image:
    """Compose a frame from one key pose.

    tip      weapon tip sway beside the head
    hem      cloth swing of the bottom torso rows
    lean     whole-pixel horizontal shear of the upper body, zero at the hip
    bob      moves everything above the hip down (+) or up (-)
    chest    repeats (+) or drops (-) torso rows so the chest swells or sags
    head     (dx, dy) of the head block relative to the torso
    leg_l/r  (dx, dy) of each foot; dy < 0 lifts the foot
    body_dx  moves the upper body sideways (feet stay registered)
    """
    legs_src = legs_from or key
    out = blank()

    # legs: split at lm.split_x and move independently
    left = crop_rows(legs_src, HIP + 1, FOOT + 1, 0, lm.split_x)
    right = crop_rows(legs_src, HIP + 1, FOOT + 1, lm.split_x + 1, W - 1)
    paste(out, left, leg_l[0], leg_l[1])
    paste(out, right, leg_r[0], leg_r[1])
    # a lifted foot leaves a gap under the hip: extend the hip row down into it
    for (dx, dy), x0, x1 in ((leg_l, 0, lm.split_x), (leg_r, lm.split_x + 1, W - 1)):
        for k in range(max(0, -dy)):
            y = HIP + 1 + k
            for x in range(x0, x1 + 1):
                hip_pixel = legs_src.getpixel((x, HIP + 1))
                if hip_pixel[3] and not out.getpixel((x, y))[3]:
                    out.putpixel((x, y), hip_pixel)

    # torso block: everything down to the hip, minus the head columns above the neck
    upper = blank()
    for y in range(0, HIP + 1):
        for x in range(W):
            if lm.top <= y < lm.neck and lm.head_x0 <= x <= lm.head_x1:
                continue
            pixel = key.getpixel((x, y))
            if pixel[3]:
                upper.putpixel((x, y), pixel)
    if chest:
        upper = stretch_band(upper, lm.neck, HIP, chest)
    if lean:
        upper = shear_rows(upper, HIP, lm.top, lean, power)
    if hem:
        upper = hem_sway(upper, hem)
    if tip:
        upper = tip_sway(upper, lm, tip, chest)
    head_img = crop_rows(key, lm.top, lm.neck - 1, lm.head_x0, lm.head_x1)

    paste(out, upper, body_dx, bob)
    if bob < 0:
        # torso rose: repeat its bottom row down to the legs so the body stays whole
        for y in range(HIP + bob + 1, HIP + 1):
            for x in range(W):
                if not out.getpixel((x, y))[3]:
                    pixel = out.getpixel((x, HIP + bob))
                    if pixel[3]:
                        out.putpixel((x, y), pixel)

    head_lean = round(lean * (HIP - (lm.top + 6)) / max(1, HIP - lm.top)) if lean else 0
    paste(out, head_img, head_lean + head[0] + body_dx, head[1] + bob - chest)
    return out
