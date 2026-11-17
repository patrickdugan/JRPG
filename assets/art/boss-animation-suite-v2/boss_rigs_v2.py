#!/usr/bin/env python3
"""Code-native pixel rigs for the v2 boss animation suite.

Each rig draws one frame from a flat pose dict (see ``boss_performances_v2``)
with integer-rounded mask primitives from the pixel-art-production toolkit.
Authoring space is the v1 boss cell (112 x 128, soles on y 114) shifted by
``ORIGIN`` into the 232 x 160 logical frame, so v1 identity carries over.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "skills" / "pixel-art-production" / "scripts"))

from anim_primitives import Canvas, Xf, dilate4, edge_band, inter, is_empty, limb_point, sub, union  # noqa: E402
from anim_timeline import ri, rnd, wave  # noqa: E402

CELL = (232, 160)
ORIGIN = (60, 32)


def canvas_for(palette: dict) -> Canvas:
    return Canvas(CELL, palette, origin=ORIGIN)


GROUND = 114  # authoring-space sole line (foot point y 116 in v1 space -> 132 in the 144 cell)


def lerp(a: float, b: float, u: float) -> float:
    return a + (b - a) * u


def clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def leg_ik(hip, foot, l1, l2, forward=1.0):
    """Two-bone IK: knee bends toward ``forward`` (+1 = screen-right)."""
    dx, dy = foot[0] - hip[0], foot[1] - hip[1]
    d = math.hypot(dx, dy) or 0.001
    d_c = clamp(d, abs(l1 - l2) + 0.01, l1 + l2 - 0.01)
    a = (l1 * l1 - l2 * l2 + d_c * d_c) / (2 * d_c)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    ux, uy = dx / d, dy / d
    px, py = -uy, ux
    if px * forward < 0:
        px, py = uy, -ux
    knee = (rnd(hip[0] + ux * a + px * h), rnd(hip[1] + uy * a + py * h))
    end = (rnd(hip[0] + ux * d_c), rnd(hip[1] + uy * d_c))
    return knee, end


def shadow(c: Canvas, left: float, right: float, y: float = 116):
    c.paint(c.m.rect(left + 4, y, right - 4, y + 2), "ink")
    c.paint(c.m.rect(left, y + 1, right, y + 1), "ink")


def brackets(c: Canvas, cx: float, top: float, amount: float):
    """Phase-transition corner brackets (v1 motif) that open with ``amount`` 0..1."""
    if amount <= 0.05:
        return
    spread = 22 + 12 * amount
    arm = 4 + 8 * amount
    c.paint(c.m.stroke([(cx - spread + 4, top + 12), (cx - spread, top + 12), (cx - spread, top + 12 + arm)], 3), "accent")
    c.paint(c.m.stroke([(cx + spread - 4, top + 12), (cx + spread, top + 12), (cx + spread, top + 12 + arm)], 3), "spark")
    if amount > 0.5:
        c.paint(c.m.rect(cx - 3, top, cx + 3, top + 5), "metal")


def smear_band(c: Canvas, center, r_in, r_out, a0, a1, strength):
    """Hard-edged weapon smear on active frames (light outer band, spark core)."""
    if strength <= 0 or abs(a1 - a0) < 6:
        return
    steps = max(4, int(abs(a1 - a0) / 12))
    outer = c.m.arc_band(center, r_in, r_out, a0, a1, steps)
    c.paint(outer, "light")
    if strength >= 0.5:
        core = c.m.arc_band(center, r_in + (r_out - r_in) * 0.55, r_out - 1, a0 + (a1 - a0) * 0.35, a1, steps)
        c.paint(core, "spark")


def spark_burst(c: Canvas, at, size, color="spark"):
    if size <= 0.2:
        return
    x, y = at
    s = 2 + size * 4
    c.paint(c.m.poly([(x - s, y), (x - 1, y - 1), (x, y - s), (x + 1, y - 1), (x + s, y), (x + 1, y + 1),
                      (x, y + s), (x - 1, y + 1)]), color)


# ---------------------------------------------------------------------------
# Humanoid rig (Mateus, Kaji, Ujiro, Chiyo, Kurozane)
# ---------------------------------------------------------------------------

HUMANOID_NEUTRAL = {
    "x": 0, "y": 0, "crouch": 0, "lean": 2, "head": 0, "hx": 0, "hy": 0,
    "fa": 22, "fe": 32, "ba": -10, "be": 14,
    "ff": 9, "bf": -9, "fl": 0, "bl": 0,
    "coat": 0, "flare": 0, "wave": 0, "breath": 0,
    "wpn": 35, "wlen": 1, "grip": 0, "drop": 0,
    "smear": 0, "smearFrom": 35, "glow": 0, "kneel": 0, "tremble": 0,
    "p1": 0, "p2": 0, "p3": 0, "p4": 0, "p5": 0, "p6": 0,
}


def humanoid_frame(c: Canvas, p: dict, st: dict) -> dict:
    """Draw one humanoid frame. Returns key world points for FX hooks."""
    b = st.get("broad", 0)
    hx = 56 + p["x"]
    hy = 82 + p["y"] + p["crouch"]
    lean = p["lean"]
    torso = Xf.rotate(lean, (0, 0)).then(Xf.translate(hx, hy))
    breath = p["breath"]

    # Feet and legs (IK). Kneel folds the back knee to the floor.
    ff = (hx + p["ff"], GROUND - p["fl"])
    bf = (hx + p["bf"], GROUND - p["bl"])
    hip_f = torso.pt(3, 0)
    hip_b = torso.pt(-4, 0)
    knee_f, ff = leg_ik(hip_f, ff, 17, 17, 1)
    knee_b, bf = leg_ik(hip_b, bf, 17, 17, 1)
    left = min(ff[0], bf[0], hx - 18) - 8
    right = max(ff[0], bf[0], hx + 18) + 8
    shadow(c, left, right)

    pts = {"hip": (hx, hy)}
    # Back arm (behind body).
    sb = torso.pt(-11 - b * 0.6, -31 + breath * 0.5)
    eb = limb_point(sb, 13, p["ba"] + lean)
    hb = limb_point(eb, 12, p["ba"] + p["be"] + lean)
    pts.update(back_shoulder=sb, back_elbow=eb, back_hand=hb)
    arm_b = union(c.m.capsule(sb, eb, 3.5, 3), c.m.capsule(eb, hb, 3, 2.5))
    c.part(arm_b, "deep", None, "body", ring="ink", light_width=1)
    if st.get("back_prop"):
        st["back_prop"](c, p, pts)

    # Legs: back leg dark, front leg mid.
    def leg(hip, knee, foot, base, lite):
        m = union(c.m.capsule(hip, knee, 4, 3.5), c.m.capsule(knee, foot, 3.5, 3))
        c.part(m, base, None, lite, ring="ink")
        boot = c.m.poly([(foot[0] - 5, foot[1] - 4), (foot[0] + 3, foot[1] - 5), (foot[0] + 8, foot[1] - 1),
                         (foot[0] + 8, foot[1] + 1), (foot[0] - 5, foot[1] + 1)])
        c.part(boot, "ink", None, "deep", ring=None)

    leg(hip_b, knee_b, bf, "ink", "deep")
    leg(hip_f, knee_f, ff, "deep", "body")
    pts.update(front_foot=ff, back_foot=bf, front_knee=knee_f)

    # Coat skirt panels hang from the waist and lag with ``coat``.
    hem_y = min(112, 108 + p["crouch"] * 0.45 + p["kneel"] * 4)
    swing = p["coat"]
    flare = p["flare"] + st.get("coat_flare", 0)
    wb = torso.pt(-14 - b * 0.5, -7)
    wm = torso.pt(-1, -2)
    wf = torso.pt(13 + b * 0.5, -7)
    back_hem = []
    front_hem = []
    for i in range(5):
        u = i / 4
        wy = wave(p["wave"] + u * 0.35, 1, 0, 1.6)
        back_hem.append((rnd(lerp(hx - 24 - flare - swing, hx - 2 - swing * 0.4, u)), rnd(hem_y + wy + u * 1.5)))
        front_hem.append((rnd(lerp(hx + 1 - swing * 0.35, hx + 22 + flare - swing * 0.5, u)), rnd(hem_y + 1 + wave(p["wave"] + 0.3 + u * 0.35, 1, 0, 1.4))))
    coat_back = c.m.poly([wb, wm] + back_hem[::-1])
    c.part(coat_back, st.get("coat_back", "deep"), "ink", "body", ring="ink", dark_width=1)
    coat_front = c.m.poly([wm, wf] + front_hem[::-1])
    c.part(coat_front, st.get("coat_front", "body"), "deep", "light", ring="ink", dark_width=2)

    # Torso.
    torso_poly = torso.pts([(-15 - b, -34 + breath), (-8, -42), (10, -41), (17 + b, -31 + breath),
                            (14, -6), (6, 2), (-10, 1), (-16, -6)])
    c.part(c.m.poly(torso_poly), "body", "deep", None, ring="ink", dark_width=2)
    chest = c.m.poly(torso.pts([(-9, -31 + breath), (8, -33 + breath), (11, -12), (0, -4), (-11, -13)]))
    c.paint(chest, "light")
    c.paint(c.m.stroke(torso.pts([(0, -33), (0, 0)]), 2), "ink")
    c.paint(c.m.rect(*torso.pt(-3, -17), *torso.pt(3, -13)), "metal")
    if st.get("torso_prop"):
        st["torso_prop"](c, p, torso, pts)

    # Head with hood, face plate, forward visor.
    neck = torso.pt(1, -40)
    head = Xf.rotate(p["head"], (0, 0)).then(Xf.translate(neck[0] + p["hx"], neck[1] + p["hy"]))
    hood = c.m.poly(head.pts([(-13, -4), (-11, -23), (4, -28), (14, -18), (10, -3), (-4, 1)]))
    c.part(hood, st.get("hood", "deep"), None, "body", ring="ink")
    face = c.m.poly(head.pts([(-6, -21), (6, -23), (11, -15), (7, -7), (-5, -8), (-8, -15)]))
    c.paint(face, st.get("face", "body"))
    c.paint(c.m.poly(head.pts([(-3, -16), (10, -17), (10, -13), (-3, -12)])), "ink")
    eye = 2 if p["glow"] < 2 else 3
    c.paint(c.m.rect(*head.pt(4, -16), *head.pt(4 + eye + 1, -15 + (1 if p["glow"] >= 3 else 0))), "spark")
    pts["head"] = head.pt(2, -15)
    pts["head_top"] = head.pt(2, -28)
    if st.get("head_prop"):
        st["head_prop"](c, p, head, pts)

    # Front arm and weapon.
    sf = torso.pt(11 + b * 0.6, -31 + breath * 0.5)
    ef = limb_point(sf, 13, p["fa"] + lean)
    hf = limb_point(ef, 12, p["fa"] + p["fe"] + lean)
    pts.update(front_shoulder=sf, front_elbow=ef, front_hand=hf)
    weapon = st.get("weapon")
    if weapon:
        weapon(c, p, pts, st)
    arm_f = union(c.m.capsule(sf, ef, 3.5, 3), c.m.capsule(ef, hf, 3, 2.5))
    c.part(arm_f, "body", "deep", "light", ring="ink", dark_width=1)
    c.paint(c.m.rect(hf[0] - 2, hf[1] - 2, hf[0] + 2, hf[1] + 2), "metal")
    if st.get("front_prop"):
        st["front_prop"](c, p, pts)
    if st.get("fx"):
        st["fx"](c, p, pts)
    c.outline("ink")
    if st.get("fx_over"):
        st["fx_over"](c, p, pts)
    return pts


def weapon_base(p, pts, st):
    """Hand-held weapon root and angle, blended toward a resting place on the floor by ``drop``."""
    hand = pts["front_hand"]
    angle = p["wpn"]
    if p["drop"] > 0:
        dx, dy, da = st.get("drop_to", (22, GROUND - 1, 92))
        target = (pts["hip"][0] + dx, dy)
        u = p["drop"]
        hand = (lerp(hand[0], target[0], u), lerp(hand[1], target[1], u))
        angle = lerp(angle, da, u)
        # Never let a falling weapon pass through the floor: lift it by the overlap.
        reach = st.get("wlen", 30) + 4
        lowest = max(hand[1] + reach * math.cos(math.radians(angle)), hand[1] - 18 * math.cos(math.radians(angle)))
        if lowest > GROUND + 1:
            hand = (hand[0], hand[1] - (lowest - GROUND - 1))
    return hand, floor_clamped(hand, angle, st.get("wlen", 30) + 6)


def floor_clamped(hand, angle: float, reach: float) -> float:
    """Rotate a held weapon toward level just enough that its tip rests on the floor instead of sinking."""
    room = GROUND + 1 - hand[1]
    if room >= reach or reach * math.cos(math.radians(angle)) <= room:
        return angle
    a = ((angle + 180.0) % 360.0) - 180.0
    limit = math.degrees(math.acos(clamp(room / reach, -1.0, 1.0)))
    return rnd(angle + ((limit if a >= 0 else -limit) - a))


def weapon_blade(c, p, pts, st):
    root, angle = weapon_base(p, pts, st)
    length = st.get("wlen", 36) * p["wlen"]
    tip = limb_point(root, length, angle)
    back = limb_point(root, -5, angle)
    if p["smear"] > 0:
        smear_band(c, pts["front_shoulder"], 14, 25 + length, p["smearFrom"], angle, p["smear"])
    blade = c.m.taper(back, tip, 4, 1)
    c.part(blade, "metal", None, None, ring="ink")
    c.paint(c.m.stroke([limb_point(root, 3, angle), limb_point(root, length - 3, angle)], 1), "spark")
    guard_a = limb_point(root, 4, angle + 90)
    guard_b = limb_point(root, 4, angle - 90)
    c.paint(c.m.stroke([guard_a, guard_b], 3), "accent")
    pts["weapon_tip"] = tip


def weapon_hook(c, p, pts, st):
    root, angle = weapon_base(p, pts, st)
    length = st.get("wlen", 30) * p["wlen"]
    tip = limb_point(root, length, angle)
    if p["smear"] > 0:
        smear_band(c, pts["front_shoulder"], 14, 22 + length, p["smearFrom"], angle, p["smear"])
    c.part(c.m.taper(limb_point(root, -4, angle), tip, 3, 3), "metal", None, None, ring="ink")
    hook_a = limb_point(tip, 7, angle + 150)
    hook_b = limb_point(hook_a, 6, angle + 220)
    c.part(c.m.stroke([tip, hook_a, hook_b], 3), "spark", None, None, ring="ink")
    pts["weapon_tip"] = tip


def weapon_baton(c, p, pts, st):
    root, angle = weapon_base(p, pts, st)
    length = st.get("wlen", 30) * p["wlen"]
    tip = limb_point(root, length, angle)
    if p["smear"] > 0:
        smear_band(c, pts["front_shoulder"], 14, 22 + length, p["smearFrom"], angle, p["smear"])
    c.part(c.m.taper(limb_point(root, -4, angle), tip, 4, 4), "metal", None, "spark", ring="ink", light_width=1)
    head = c.m.poly([limb_point(tip, 5, angle + 45), limb_point(tip, 5, angle + 135),
                     limb_point(tip, 5, angle - 135), limb_point(tip, 5, angle - 45)])
    c.part(head, "spark" if p["glow"] >= 2 else "accent", None, "spark", ring="ink")
    pts["weapon_tip"] = tip


def weapon_hammer(c, p, pts, st):
    root, angle = weapon_base(p, pts, st)
    length = st.get("wlen", 30) * p["wlen"]
    tip = limb_point(root, length, angle)
    if p["smear"] > 0:
        smear_band(c, pts["front_shoulder"], 14, 24 + length, p["smearFrom"], angle, p["smear"])
    c.part(c.m.taper(limb_point(root, -4, angle), tip, 4, 4), "metal", None, None, ring="ink")
    a, b2 = limb_point(tip, 7, angle + 90), limb_point(tip, 7, angle - 90)
    head = c.m.poly([limb_point(a, -3, angle), limb_point(a, 6, angle), limb_point(b2, 6, angle), limb_point(b2, -3, angle)])
    c.part(head, "accent", "deep", "spark", ring="ink", dark_width=1, light_width=2 if p["glow"] >= 2 else 1)
    pts["weapon_tip"] = limb_point(tip, 3, angle)


def weapon_spear(c, p, pts, st):
    root, angle = weapon_base(p, pts, st)
    length = st.get("wlen", 54) * p["wlen"]
    grip = p["grip"]
    start = limb_point(root, -16 - grip, angle)
    tip = limb_point(root, length - grip, angle)
    if p["smear"] > 0:
        # Straight thrust smear: a tapering streak behind the point.
        streak = c.m.taper(limb_point(tip, -26 * p["smear"], angle), tip, 1, 5)
        c.paint(streak, "light")
    c.part(c.m.taper(start, tip, 3, 3), "metal", None, None, ring="ink")
    c.paint(c.m.stroke([limb_point(root, -10 - grip, angle), limb_point(tip, -2, angle)], 1), "spark")
    point = c.m.poly([limb_point(tip, 9, angle), limb_point(tip, 4, angle + 90), limb_point(tip, -2, angle),
                      limb_point(tip, 4, angle - 90)])
    c.part(point, "spark" if p["glow"] >= 2 else "accent", None, "spark", ring="ink")  # glint marks the tell peak
    pts["weapon_tip"] = limb_point(tip, 8, angle)



