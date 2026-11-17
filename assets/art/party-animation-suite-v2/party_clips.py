"""Clip recipes for the party animation suite.

Each recipe returns a list of RGBA 48x64 frames built only from the frozen
key poses with integer puppet operations (pose_puppet.py) and code-drawn
accents. Recipes are deterministic; no random numbers and no resampling.
"""
from __future__ import annotations

import math
from typing import Callable

from PIL import Image, ImageDraw

import pose_puppet as pp
from pose_puppet import CREAM, PUFF, PUFF_DARK, SWEAT, SWEAT_LIGHT, W, H

KEY = dict(idle=0, move=1, guard=2, hit=3, windup=4, active=5, sig_a=6, sig_b=7, recover=8, down=9)

# per-character idiom: which key carries the tired slump, how heavy it is, and the tell
PROFILES = {
    "ren": dict(slump=8, droop=2, heave=2, sway=1, tell="steam", hem=1),
    "aya": dict(slump=8, droop=3, heave=1, sway=1, tell="sweat", hem=1),
    "lise": dict(slump=0, droop=2, heave=2, sway=2, tell="steam", hem=1),
    "mateus": dict(slump=8, droop=3, heave=1, sway=2, tell="sweat", hem=2),
    "genta": dict(slump=8, droop=3, heave=2, sway=1, tell="steam", hem=0),
    "kiku": dict(slump=8, droop=2, heave=1, sway=1, tell="fan", hem=1),
    "miyo": dict(slump=8, droop=2, heave=1, sway=1, tell="shake", hem=1),
}

HEAD_OVERRIDE = {"genta": (16, 26)}


def sine(i: int, n: int, cycles: float = 1.0, phase: float = 0.0) -> float:
    return math.sin(2 * math.pi * (cycles * i / n + phase))


def rnd(value: float) -> int:
    return int(math.floor(value + 0.5))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def smooth(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


class Rig:
    def __init__(self, char_id: str, keys: list[Image.Image], accent: tuple, vfx: str):
        self.id = char_id
        self.keys = keys
        self.accent = accent
        self.vfx = vfx
        self.lm = pp.landmarks(keys[0])
        if char_id in HEAD_OVERRIDE:
            x0, x1 = HEAD_OVERRIDE[char_id]
            self.lm = pp.Landmarks(self.lm.top, self.lm.neck, x0, x1, self.lm.split_x)
        # key poses with a different crouch height get their own landmarks
        self.lms: dict[int, pp.Landmarks] = {}
        for index, key in enumerate(keys[:9]):
            box = key.getchannel("A").getbbox()
            dy = box[1] - self.lm.top
            self.lms[index] = pp.Landmarks(
                self.lm.top + dy, self.lm.neck + dy, self.lm.head_x0, self.lm.head_x1, self.lm.split_x
            )

    def p(self, key: int, **kw) -> Image.Image:
        legs_key = kw.pop("legs_key", None)
        if legs_key is not None:
            kw["legs_from"] = self.keys[legs_key]
        return pp.pose(self.keys[key], self.lms[key], **kw)


# ---------------------------------------------------------------- accents

def px(frame: Image.Image, x: int, y: int, color) -> None:
    if 0 <= x < W and 0 <= y < H:
        frame.putpixel((x, y), color)


def puff(frame: Image.Image, rig: Rig, age: int, forward: int = 1) -> None:
    """Breath cloud leaving the mouth: grows, drifts up and forward, thins out."""
    mx = rig.lm.head_x1 + 2
    my = rig.lm.top + 8
    if age < 0 or age > 6:
        return
    size = (2, 3, 3, 4, 3, 2, 1)[age]
    ox = mx + age * forward
    oy = my - (age // 2)
    for dx in range(size):
        for dy in range(max(1, size - 1)):
            if age >= 5 and (dx + dy) % 2:
                continue
            px(frame, ox + dx, oy - dy, PUFF if age < 4 else PUFF_DARK)


def sweat(frame: Image.Image, rig: Rig, age: int, side: int = 0) -> None:
    """A bead forms at the temple, runs down, falls past the chin."""
    if age < 0 or age > 6:
        return
    x = rig.lm.head_x0 + (1 if side == 0 else rig.lm.head_x1 - rig.lm.head_x0 - 1)
    y = rig.lm.top + 3 + age * 2
    for ox, oy in ((0, 0), (1, 0), (0, 1), (1, 1), (0, 2)):
        px(frame, x + ox - 1, y + oy, SWEAT)
    px(frame, x - 1, y, SWEAT_LIGHT)
    if age >= 5:
        px(frame, x, y + 2, (0, 0, 0, 0))


def fan(frame: Image.Image, rig: Rig, step: int) -> None:
    """A folded paper fan flicked in front of the face."""
    cx = rig.lm.head_x1 + 4
    cy = rig.lm.top + 12
    tilt = (-2, -1, 0, 1, 2, 1, 0, -1)[step % 8]
    pts = [(cx, cy), (cx + 1, cy - 2 - tilt), (cx + 2, cy - 4 - tilt), (cx + 3, cy - 2 - tilt), (cx + 3, cy)]
    for x, y in pts:
        px(frame, x, y, CREAM)
        px(frame, x + 1, y, CREAM)
        px(frame, x, y - 1, CREAM)
    px(frame, cx + 1, cy + 1, rig.accent)
    px(frame, cx + 2, cy, rig.accent)


def glint(frame: Image.Image, x: int, y: int, size: int) -> None:
    px(frame, x, y, CREAM)
    for d in range(1, size + 1):
        for ox, oy in ((d, 0), (-d, 0), (0, d), (0, -d)):
            px(frame, x + ox, y + oy, CREAM if d == 1 else rig_glint_edge)


rig_glint_edge = (200, 186, 140, 255)


def arc_points(cx: float, cy: float, rx: float, ry: float, a0: float, a1: float, steps: int):
    pts = []
    for s in range(steps + 1):
        a = math.radians(lerp(a0, a1, s / steps))
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    return pts


def draw_poly(frame: Image.Image, pts, color, width: int = 1) -> None:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).line([(round(x), round(y)) for x, y in pts], fill=color, width=width)
    for y in range(H):
        for x in range(W):
            pixel = layer.getpixel((x, y))
            if pixel[3]:
                frame.putpixel((x, y), (pixel[0], pixel[1], pixel[2], 255))


def sweep(frame: Image.Image, rig: Rig, t0: float, t1: float, reach: float = 15.0) -> None:
    """Weapon smear: a banded crescent from angle t0 to t1 (fractions of the swing)."""
    cx, cy = 26.0, 30.0
    a_start, a_end = -125.0, 35.0
    a0, a1 = lerp(a_start, a_end, t0), lerp(a_start, a_end, t1)
    if abs(a1 - a0) < 2:
        return
    white = CREAM
    draw_poly(frame, arc_points(cx, cy, reach, reach * 0.9, a0, a1, 10), rig.accent, 3)
    draw_poly(frame, arc_points(cx, cy, reach - 2, reach * 0.9 - 2, a0, a1, 10), rig.accent, 1)
    draw_poly(frame, arc_points(cx, cy, reach + 1, reach * 0.9 + 1, lerp(a0, a1, 0.55), a1, 6), white, 1)


# ------------------------------------------------------------------ idle

def idle(rig: Rig, n: int = 24) -> list[Image.Image]:
    frames = []
    for i in range(n):
        breath = sine(i, n)
        frames.append(rig.p(
            KEY["idle"],
            chest=rnd(0.9 * breath),
            bob=1 if breath < -0.35 else 0,
            lean=rnd(1.2 * sine(i, n, 1, 0.2)),
            head=(rnd(1.4 * sine(i, n, 1, 0.55)), rnd(0.9 * sine(i, n, 2, 0.1))),
            body_dx=rnd(1.2 * sine(i, n, 1, 0.0)),
            leg_l=(rnd(0.7 * sine(i, n, 1, 0.65)), 0),
            hem=rnd(1.6 * sine(i, n, 2, 0.8)),
            tip=rnd(1.4 * sine(i, n, 3, 0.15)),
        ))
    return frames


# ------------------------------------------------------------------ move

def move(rig: Rig, n: int = 20) -> list[Image.Image]:
    frames = []
    for i in range(n):
        th = 2 * math.pi * i / n
        step_l, step_r = math.sin(th), -math.sin(th)
        lift_l, lift_r = max(0.0, math.cos(th)), max(0.0, -math.cos(th))
        frames.append(rig.p(
            KEY["move"],
            leg_l=(rnd(3.2 * step_l), -rnd(2.4 * lift_l)),
            leg_r=(rnd(3.2 * step_r), -rnd(2.4 * lift_r)),
            bob=rnd(1.2 * math.cos(2 * th)),
            lean=2 + rnd(0.9 * math.sin(2 * th + 0.5)),
            chest=rnd(0.6 * math.sin(2 * th + 1.2)),
            head=(rnd(0.9 * math.sin(th)), rnd(0.8 * math.cos(2 * th + 1.0))),
            body_dx=rnd(0.9 * math.sin(th + 0.4)),
            hem=-rnd(1.4 * math.sin(th - 0.8)),
        ))
    return frames


# ----------------------------------------------------------------- tired

def tired(rig: Rig, n: int = 24) -> list[Image.Image]:
    """Slump in, heavy double breath, straighten. Sampled by cooldown progress."""
    prof = PROFILES[rig.id]
    droop, heave, sway = prof["droop"], prof["heave"], prof["sway"]
    frames = []
    for i in range(n):
        if i < 6:
            w = smooth((i + 1) / 6)          # slump in
            key = prof["slump"] if i >= 3 else KEY["idle"]
        elif i < 18:
            w = 1.0                          # heavy breathing
            key = prof["slump"]
        else:
            w = 1.0 - smooth((i - 17) / 6)   # straighten toward ready
            key = prof["slump"] if i < 20 else KEY["idle"]
        breath = sine(i - 6, 12, 1.0) if 6 <= i < 18 else (0.5 if i < 6 else 0.2)
        heave_px = rnd(heave * breath) if 6 <= i < 18 else rnd(heave * 0.5 * w)
        frames.append(rig.p(
            key,
            lean=rnd(lerp(0, droop, w)) + (1 if breath > 0.6 and w > 0.9 else 0),
            bob=rnd(lerp(0, 2, w)) + (1 if breath < -0.5 and w > 0.9 else 0),
            chest=heave_px,
            head=(rnd(lerp(0, 1, w)) + rnd(0.6 * sine(i, n, 1, 0.3)), rnd(lerp(0, droop, w)) + (1 if breath > 0.4 else 0)),
            body_dx=rnd(sway * 0.9 * sine(i, n, 2, 0.1) * w),
            leg_l=(0, 0) if w < 0.5 else (-1, 0),
            leg_r=(1 if w > 0.5 else 0, 0),
            hem=rnd(prof["hem"] * sine(i, n, 2, 0.45)),
        ))
        frame = frames[-1]
        tell = prof["tell"]
        if tell == "steam" and i >= 4:
            puff(frame, rig, (i - 4) % 12 if (i - 4) % 12 < 7 else -1)
        elif tell == "sweat" and i >= 5:
            sweat(frame, rig, (i - 5) % 10 if (i - 5) % 10 < 7 else -1, 0 if ((i - 5) // 10) % 2 == 0 else 1)
        elif tell == "fan" and i >= 5:
            fan(frame, rig, i)
        elif tell == "shake" and i >= 5:
            sweat(frame, rig, (i - 5) % 11 if (i - 5) % 11 < 7 else -1, 1)
    return frames


def ready_snap(rig: Rig, n: int = 6) -> list[Image.Image]:
    """Snap to ready: a small rise past upright and settle into the idle stance."""
    table = [(2, 1, 0), (1, 0, -1), (0, 0, -1), (1, 0, 0), (0, 0, 1), (0, 0, 0)]
    frames = []
    for i in range(n):
        lean, bob, chest = table[i]
        frame = rig.p(KEY["idle"], lean=lean, bob=bob, chest=chest, head=(0, -1 if i in (1, 2) else 0))
        if i in (1, 2, 3):
            glint(frame, rig.lm.head_x1 + 3, rig.lm.top + 2, 1 if i != 2 else 2)
        frames.append(frame)
    return frames


# ---------------------------------------------------------------- attacks

def basic_strike(rig: Rig) -> list[Image.Image]:
    """7 wind-up, 6 active, 8 recovery frames."""
    frames = []
    # wind-up: gather weight back, weapon drawn
    wind = [(0, 0, 0, 0), (-1, 0, 1, 0), (-1, 0, 1, 1), (-2, 4, 1, 0), (-3, 4, 2, 0), (-3, 4, 2, -1), (-4, 4, 2, 0)]
    for i, (lean, key, bob, chest) in enumerate(wind):
        frame = rig.p(key, lean=lean, bob=bob, chest=chest, body_dx=-(i // 2),
                      leg_l=(-(i // 3), 0), leg_r=(0, 0), head=(-(i // 3), 0))
        if i >= 4:
            sweep(frame, rig, 0.0, 0.0 + 0.04 * (i - 3))
        frames.append(frame)
    # active: contact smear sweeps across, body lunges
    active = [(1, 0.0, 0.40, 3, 1), (3, 0.10, 0.70, 4, 2), (4, 0.35, 0.95, 4, 3), (4, 0.60, 1.0, 3, 3), (3, 0.80, 1.0, 2, 2), (2, 0.92, 1.0, 1, 2)]
    for i, (lean, t0, t1, bob, dx) in enumerate(active):
        frame = rig.p(5, lean=lean, bob=min(1, i % 2) if i < 4 else 1, chest=0, body_dx=dx,
                      leg_l=(1 + i // 3, 0), leg_r=(-1, 0), head=(1, 0))
        sweep(frame, rig, t0, t1)
        frames.append(frame)
    # recovery: overshoot, brace, catch breath, return to ready
    recov = [(3, 8, 1, 1), (3, 8, 2, 1), (2, 8, 2, 0), (2, 8, 1, 0), (1, 8, 1, 0), (1, 0, 1, 0), (0, 0, 1, 0), (0, 0, 0, 0)]
    for i, (lean, key, bob, dx) in enumerate(recov):
        frame = rig.p(key, lean=lean, bob=bob, body_dx=dx, head=(0, 1 if i < 4 else 0),
                      leg_l=(1 if i < 5 else 0, 0), leg_r=(0, 0), chest=1 if i in (2, 3) else 0)
        if i == 0:
            sweep(frame, rig, 0.9, 1.0)
        frames.append(frame)
    return frames


def signature(rig: Rig, alt: bool) -> list[Image.Image]:
    """7 charge, 6 release, 8 recovery frames."""
    key_charge, key_release = (4, 7 if alt else 6)
    frames = []
    for i in range(7):
        stage = "charge"
        frame = rig.p(key_charge if i < 4 else key_release, lean=-i // 2, bob=1 if i > 1 else 0,
                      body_dx=-(i // 3), head=(0, -1 if i in (3, 4) else 0), chest=1 if i % 3 == 1 else 0,
                      leg_l=(-(i // 4), 0))
        if i >= 2:
            charge_marks(frame, rig, i - 2, alt)
        frames.append(frame)
    for i in range(6):
        frame = rig.p(key_release, lean=(1, 3, 4, 3, 2, 1)[i], bob=(0, 1, 1, 1, 1, 0)[i],
                      body_dx=(1, 3, 4, 4, 3, 2)[i], head=(1, 0), leg_l=(1 + i // 3, 0), leg_r=(-1, 0))
        release_marks(frame, rig, i, alt)
        frames.append(frame)
    for i in range(8):
        frame = rig.p(8 if i < 5 else 0, lean=(3, 3, 2, 2, 1, 1, 0, 0)[i], bob=(1, 2, 2, 1, 1, 1, 0, 0)[i],
                      body_dx=(3, 2, 1, 1, 0, 0, 0, 0)[i], head=(0, 1 if i < 4 else 0),
                      chest=1 if i in (2, 3) else 0)
        if i < 2:
            release_marks(frame, rig, 5 + i, alt, fade=True)
        frames.append(frame)
    return frames


def charge_marks(frame: Image.Image, rig: Rig, step: int, alt: bool) -> None:
    accent, white = rig.accent, CREAM
    cx, cy = 39, 22
    r = min(4, 1 + step)
    for k in range(4):
        a = math.radians(45 + 90 * k + step * 28)
        px(frame, round(cx + (r + 1) * math.cos(a)), round(cy + (r + 1) * math.sin(a)), accent)
    px(frame, cx, cy, white)
    if step >= 2:
        for k in range(4):
            a = math.radians(90 * k + step * 40)
            px(frame, round(cx + r * math.cos(a)), round(cy + r * math.sin(a)), white)


def release_marks(frame: Image.Image, rig: Rig, step: int, alt: bool, fade: bool = False) -> None:
    accent, white = rig.accent, CREAM
    cx, cy = 38, 24
    reach = min(9, 5 + step * 2)
    if rig.vfx in ("crescent", "weather-ruler"):
        a0 = -110 + step * 14
        draw_poly(frame, arc_points(cx - 8, cy + 4, reach, reach * 0.8, a0, a0 + 100, 8), accent, 2)
        draw_poly(frame, arc_points(cx - 8, cy + 4, reach - 2, reach * 0.8 - 2, a0 + 20, a0 + 100, 6), white, 1)
    elif rig.vfx == "paper-fan":
        for k in range(-2, 3):
            a = math.radians(-20 + k * 16 + (8 if alt else 0))
            draw_poly(frame, [(cx - 2, cy), (cx - 2 + reach * math.cos(a), cy + reach * math.sin(a))], accent if k % 2 else white, 1)
    elif rig.vfx == "lance-radiance":
        length = 8 + step * 3
        draw_poly(frame, [(cx - 8, cy + 2), (min(47, cx - 8 + length), cy + 2)], white, 2)
        draw_poly(frame, [(cx - 8, cy), (min(47, cx - 8 + length), cy)], accent, 1)
        draw_poly(frame, [(cx - 8, cy + 4), (min(47, cx - 8 + length), cy + 4)], accent, 1)
    elif rig.vfx == "hidden-cross-light":
        h = 4 + step * 2
        draw_poly(frame, [(cx + 2, cy - h), (cx + 2, cy + h)], accent, 2)
        draw_poly(frame, [(cx + 2 - h, cy), (min(47, cx + 2 + h), cy)], accent, 2)
        px(frame, cx + 2, cy, white)
    elif rig.vfx == "hammer-spark":
        for k in range(8):
            a = math.radians(45 * k + step * 9)
            draw_poly(frame, [(cx + 2, cy + 2), (cx + 2 + (2 + step * 1.2) * math.cos(a), cy + 2 + (2 + step * 1.2) * math.sin(a))], accent if k % 2 else white, 1)
    elif rig.vfx == "herb-lantern":
        r2 = 3 + step
        draw_poly(frame, arc_points(cx + 1, cy + 2, r2, r2, 0, 360, 14), accent, 1)
        draw_poly(frame, arc_points(cx + 1, cy + 2, max(1, r2 - 3), max(1, r2 - 3), 0, 360, 10), white, 1)
    if alt:
        px(frame, 44 - step, 35, accent)
        px(frame, 45 - step, 34, white)


# ------------------------------------------------------------------ guard

def guard(rig: Rig, n: int = 24) -> list[Image.Image]:
    """7 raise, 11 hold (braced shudder), 6 release."""
    frames = []
    raise_n, hold_end = 7, 18
    for i in range(n):
        if i < raise_n:
            t = (i + 1) / raise_n
            key = KEY["guard"] if i >= 2 else KEY["idle"]
            lean, bob, dx = rnd(2 * t), 1 if i >= 2 else 0, rnd(2 * t)
        elif i < hold_end:
            j = i - raise_n
            key = KEY["guard"]
            lean = 2 + (1 if j % 3 == 0 else 0)
            bob = 1 + (1 if j in (1, 2, 6, 7) else 0)
            dx = 2 + (1 if j in (0, 4, 5, 9) else 0) - (1 if j in (2, 3, 8) else 0)
        else:
            j = i - hold_end
            key = KEY["guard"] if j < 2 else KEY["idle"]
            lean, bob, dx = (2, 1, 1, 0, 0, 0)[j], (1, 1, 0, 0, 0, 0)[j], (2, 1, 1, 0, 0, 0)[j]
        braced = 2 <= i < hold_end + 2
        frame = rig.p(
            key, lean=lean, bob=bob, body_dx=dx,
            head=(1 if braced else 0, (-1 if i % 5 == 1 else (1 if i % 5 == 3 else 0)) if braced else 0),
            chest=1 if raise_n <= i < hold_end and i % 4 in (0, 1) else 0,
            tip=((i % 3) - 1) if raise_n <= i < hold_end else 0,
            hem=((i % 4) - 1) if 3 <= i < hold_end + 2 else 0,
            leg_l=(1 if braced else 0, 0), leg_r=(-1 if braced else 0, 0),
        )
        if 3 <= i < hold_end + 1:
            flick = i % 2
            draw_poly(frame, [(36 + flick, 20), (41, 25)], rig.accent, 2)
            draw_poly(frame, [(36 + flick, 31), (41, 26)], rig.accent, 2)
            if raise_n <= i < hold_end and i % 4 in (0, 1):
                px(frame, 42, 26, CREAM)
                px(frame, 43 + flick, 25, CREAM)
                px(frame, 43 + flick, 27, CREAM)
        frames.append(frame)
    return frames


# ------------------------------------------------------------------- hurt

def hurt(rig: Rig, n: int = 22) -> list[Image.Image]:
    """Flash, recoil, stagger, regain footing. Sampled by hit-stun progress."""
    frames = []
    for i in range(n):
        if i < 3:
            key, lean, bob, dx = KEY["hit"], -(2 + i), 0, -(1 + i)
        elif i < 10:
            key = KEY["hit"]
            decay = 1.0 - (i - 3) / 7
            lean, bob, dx = -rnd(5 * decay) - 1, rnd(1 + decay), -rnd(4 * decay) - (1 if i % 2 else 0)
        elif i < 16:
            key = 8
            lean, bob, dx = -(15 - i) // 2, 1 + (i % 2), -((16 - i) // 3)
        else:
            key = 8 if i < 19 else 0
            lean, bob, dx = -((21 - i) // 3), 1 if i < 20 else 0, -(1 if i == 16 else 0)
        frame = rig.p(key, lean=lean, bob=bob, body_dx=dx, head=(-1 if i < 12 else 0, -1 if i % 4 == 1 else 0),
                      leg_l=(-1 if i < 14 else 0, 0), leg_r=(1 if 3 <= i < 12 else 0, 0), chest=1 if 3 <= i < 8 and i % 2 else 0, tip=(i % 3) - 1 if i < 16 else 0, hem=(i % 3) - 1 if 3 <= i < 18 else 0)
        if i < 3:
            frame = pp.flash(frame, 2 if i != 2 else 1)
        if i in (1, 2, 3, 4):
            cx, cy = 14 + dx, 24 - (i % 2)
            for ox, oy in ((0, 0), (-2, -2), (2, -2), (-2, 2), (2, 2)):
                if i in (1, 2) or (ox, oy) == (0, 0):
                    px(frame, cx + ox * (i), cy + oy * (i // 2 + 1), CREAM)
        frames.append(frame)
    return frames


# ----------------------------------------------------------------- defeat

def defeat(rig: Rig, n: int = 20) -> list[Image.Image]:
    """Stagger, buckle to the knees, fall, settle. Final frames hold the downed key."""
    frames = []
    down = rig.keys[KEY["down"]]
    for i in range(n):
        if i < 5:
            frame = rig.p(KEY["hit"], lean=-(1 + i), bob=i // 2, body_dx=-(i), head=(-1, 0), leg_r=(i // 2, 0))
            if i < 2:
                frame = pp.flash(frame, 1)
        elif i < 10:
            j = i - 5
            frame = rig.p(8, lean=-(4 - j // 2) if j < 4 else 0, bob=1 + j, body_dx=-4 - j // 2, head=(-1, j // 2),
                          leg_l=(-(j // 2), 0), leg_r=(j // 2, 0))
        elif i < 16:
            j = i - 10
            # collapsing: the downed key drops in from above with a sideways slide
            frame = pp.blank()
            drop = (-14, -10, -6, -3, -1, 1)[j]
            slide = (-2, -1, 0, 0, 1, 0)[j]
            pp.paste(frame, down, slide, drop)
            if j < 4:
                upright = rig.p(8, lean=-5, bob=min(6, 3 + j * 2), body_dx=-6, head=(-1, j + 1))
                clip = pp.blank()
                pp.paste(clip, upright, 0, 0)
                for y in range(H):
                    for x in range(W):
                        if y < 36 + j * 3 and clip.getpixel((x, y))[3] and not frame.getpixel((x, y))[3]:
                            frame.putpixel((x, y), clip.getpixel((x, y)))
        else:
            j = i - 16
            frame = pp.blank()
            pp.paste(frame, down, (0, 1, 0, -1)[j], (0, -1, 0, 0)[j])
            dust = ((10, 57), (11, 56), (12, 57), (9, 58))[j]
            for k in range(1 + j % 3):
                px(frame, dust[0] + k * (2 + j % 2), dust[1] - (k % 2) - j // 2, PUFF if j < 2 else PUFF_DARK)
        frames.append(frame)
    return frames
