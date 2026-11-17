#!/usr/bin/env python3
"""Non-humanoid code-native rigs for the v2 boss suite.

* ``quadruped``: Tithe Hound (ledger predator: rib plates, docket latch, chain tail, jaw).
* ``widow``: Widow of Fog (hollow hood, net spindle, filament arms, tide ribbons).
* ``enma``: Lady Enma of Ash (layered kosode, cinder fan in the back hand, broken parasol wing in the front hand).
* ``furnace``: Furnace Abbot (riveted mantle, chimney bank, vent face, clinker rake).
* ``bell``: Yearless Bell (registry resonator: chime plates, braces, core, four node sockets).

Same authoring space and conventions as ``boss_rigs_v2`` (v1 cell, soles on
y 114, facing screen-right, angles 0 down / 90 forward / 180 up).
"""

from __future__ import annotations

import math

from anim_primitives import Xf, limb_point, sub, union
from boss_rigs_v2 import GROUND, brackets, clamp, floor_clamped, leg_ik, lerp, rnd, shadow, smear_band, spark_burst, wave


def glow_color(level: float) -> str:
    return "spark" if level >= 2.5 else "accent"


# ---------------------------------------------------------------------------
# Quadruped: Tithe Hound
# ---------------------------------------------------------------------------

QUADRUPED_NEUTRAL = {
    "x": 0, "y": 0, "crouch": 0, "pitch": 0, "head": 0, "neck": 0, "jaw": 0.1,
    "lbf": 0, "lbn": 0, "lff": 0, "lfn": 0, "hbf": 0, "hbn": 0, "hff": 0, "hfn": 0,
    "tail": 0, "tail2": 0, "latch": 0, "rib": 0, "glow": 0, "ink": 0, "smear": 0, "smearFrom": 0,
    "fold": 0, "brk": 0, "wave": 0, "breath": 0,
}

# Leg anchors in body space (relative to the body centre), far side first.
_LEGS = (
    ("lbf", "hbf", (-22, 11), -1, "deep"),   # hind, far
    ("lff", "hff", (17, 12), 1, "deep"),     # fore, far
    ("lbn", "hbn", (-9, 15), -1, "body"),    # hind, near
    ("lfn", "hfn", (27, 9), 1, "body"),      # fore, near
)


def quadruped_frame(c, p: dict, st: dict) -> dict:
    cx = 50 + p["x"]
    cy = 78 + p["y"] + p["crouch"]
    body = Xf.rotate(p["pitch"], (0, 0)).then(Xf.translate(cx, cy))
    pts = {"center": (cx, cy)}
    fold = p["fold"]
    feet_x = []

    def leg(key_dx, key_lift, anchor, bend, color, near):
        hip = body.pt(*anchor)
        foot = (hip[0] + p[key_dx] + (3 if bend > 0 else -3), GROUND - p[key_lift])
        if fold > 0:  # legs tuck under the settling body
            foot = (lerp(foot[0], hip[0] - 10 * bend, fold), lerp(foot[1], GROUND, fold))
        knee, foot = leg_ik(hip, foot, 13, 13, bend)
        m = union(c.m.capsule(hip, knee, 4.5, 3.5), c.m.capsule(knee, foot, 3.5, 3))
        c.part(m, color, "deep" if near else "ink", "light" if near else "body", ring="ink", dark_width=1)
        c.part(c.m.rect(foot[0] - 5, foot[1] - 2, foot[0] + 5, foot[1] + 1), "deep" if near else "ink", None, None)
        feet_x.append(foot[0])

    shadow(c, cx - 38, cx + 40)
    for key_dx, key_lift, anchor, bend, color in _LEGS[:2]:
        leg(key_dx, key_lift, anchor, bend, "ink" if color == "deep" else color, False)

    # Split chain tail with lagging second link.
    base = body.pt(-26, -5)
    t1 = limb_point(base, 11, -150 + p["tail"])
    t2 = limb_point(t1, 10, -150 + p["tail"] + p["tail2"])
    c.part(c.m.stroke([base, t1, t2], 3), "metal", None, None, ring="ink")
    c.paint(c.m.stroke([t1, limb_point(t1, 7, -110 + p["tail2"] * 1.4)], 2), "accent")

    hull = c.m.poly(body.pts([(-31, -8), (-16, -23 - p["breath"]), (17, -22 - p["breath"]), (32, -9), (28, 13),
                              (14, 23), (-18, 20), (-34, 8)]))
    c.part(hull, "body", "deep", None, ring="ink", dark_width=2)
    c.paint(c.m.poly(body.pts([(-20, -18 - p["breath"]), (10, -18 - p["breath"]), (22, -11), (-12, -6)])), "light")
    flare = p["rib"]
    for k, px in enumerate((-16, -5, 6, 17)):
        lift = flare * (5 + 2 * (k % 2))
        plate = body.pts([(px, -11 - lift), (px + 7, -12 - lift - flare * 3), (px + 8, 2), (px + 2, 5)])
        c.part(c.m.poly(plate), "deep", None, "body", ring="ink")
        c.paint(c.m.rect(*body.pt(px + 2, -10 - lift), *body.pt(px + 5, -8 - lift)), "metal")

    # Gauge collar and docket latch (opens on the signature and the phase transition).
    c.part(c.m.poly(body.pts([(15, -8), (23, -8), (23, 8), (15, 8)])), "accent", None, "spark", ring="ink")
    door = p["latch"]
    hinge = body.pt(15, -5)
    if door > 0.05:
        c.paint(c.m.poly(body.pts([(17, -5), (21, -5), (21, 1), (17, 1)])), glow_color(p["glow"] + 1))
        c.part(c.m.taper(hinge, limb_point(hinge, 7, -90 - 80 * door + p["pitch"]), 3, 3), "metal", None, None, ring="ink")
    else:
        c.paint(c.m.poly(body.pts([(17, -5), (21, -5), (21, 1), (17, 1)])), "spark")
        c.paint(c.m.poly(body.pts([(18, -4), (20, -4), (20, 0), (18, 0)])), "ink")

    # Head on a short neck: jaw hinges open; ``ink`` projects the Consume Ink line.
    neck = body.pt(23 + p["neck"] * 0.4, -16)
    head = Xf.rotate(p["head"] + p["pitch"] * 0.5, (0, 0)).then(Xf.translate(neck[0] + p["neck"], neck[1]))
    jaw_angle = 8 + 38 * p["jaw"]
    jaw = Xf.rotate(jaw_angle, (2, 4)).then(head)
    c.part(c.m.poly(jaw.pts([(2, 2), (24, 4), (23, 9), (4, 9)])), "deep", None, "body", ring="ink")
    if p["jaw"] > 0.35:
        c.paint(c.m.poly(head.pts([(6, 4), (20, 4)]) + jaw.pts([(20, 5), (6, 5)])), "ink")
        for tx in (9, 14, 19):
            c.paint(c.m.poly([head.pt(tx, 4), head.pt(tx + 2, 4), head.pt(tx + 1, 7)]), "spark")
    skull = c.m.poly(head.pts([(-9, -1), (3, -12), (17, -8), (26, -2), (25, 4), (2, 5), (-8, 6)]))
    c.part(skull, "deep", None, "body", ring="ink")
    c.paint(c.m.poly(head.pts([(10, -4), (25, -1), (25, 3), (10, 3)])), "body")
    c.paint(c.m.rect(*head.pt(21, -1), *head.pt(24, 1)), "ink")
    eye = 2 if p["glow"] < 2 else 3
    c.paint(c.m.rect(*head.pt(9, -6), *head.pt(9 + eye, -5)), "spark")
    mouth = jaw.pt(24, 6)
    pts["mouth"] = mouth
    if p["ink"] > 0.05:  # Consume Ink: ledger-ink line drawn out of the open jaw
        reach = 8 + 36 * p["ink"]
        end = (mouth[0] + reach, mouth[1] + 2)
        c.part(c.m.taper(mouth, end, 5, 2), "accent", None, None, ring="ink")
        c.paint(c.m.stroke([mouth, (mouth[0] + reach * 0.7, mouth[1] + 2)], 1), "spark")
    if p["smear"] > 0:  # bite arc in front of the muzzle
        smear_band(c, head.pt(8, 2), 14, 22, p["smearFrom"] + 90, p["head"] + 90, p["smear"])

    for key_dx, key_lift, anchor, bend, color in _LEGS[2:]:
        leg(key_dx, key_lift, anchor, bend, color, True)
    c.outline("ink")
    brackets(c, cx + 2, 20, p["brk"])
    return pts


# ---------------------------------------------------------------------------
# Hovering robe: Widow of Fog
# ---------------------------------------------------------------------------

WIDOW_NEUTRAL = {
    "x": 0, "y": 0, "lean": 0, "hood": 0, "spread": 13, "arms": 0, "net": 0, "glow": 0, "wave": 0,
    "ribbon": 0, "ribbonLift": 0, "ring": 0, "drag": 0, "disperse": 0, "brk": 0, "hem": 1.0,
}


def widow_frame(c, p: dict, st: dict) -> dict:
    dx, dy = p["x"], p["y"]
    pivot = (56 + dx, 60 + dy)
    body = Xf.rotate(p["lean"], (0, 0)).then(Xf.translate(*pivot))
    d = p["disperse"]
    rise = -dy
    width = clamp(32 - rise * 0.35, 18, 40) * (1 - 0.4 * d)
    shadow(c, pivot[0] - width, pivot[0] + width)
    pts = {"center": pivot}

    # Tide ribbons trail behind the robe; ``ribbonLift`` inverts them upward (signature).
    for side, color, phase in ((-1, "deep", 0.0), (1, "accent", 0.37)):
        root = body.pt(side * 22, 22)
        seg = []
        point = root
        for k in range(6):
            sway = wave(p["ribbon"] + phase + k * 0.13, 1, 0, 7 + 2 * k)
            angle = lerp(10 * side, 180 - 25 * side, p["ribbonLift"]) + sway
            point = limb_point(point, 6 + d * 3, angle + p["lean"])
            point = (point[0], min(point[1], GROUND - 1))  # a trailing ribbon drags on the floor, never through it
            seg.append(point)
        if d < 0.95:
            c.part(c.m.stroke([root] + seg, 4 - 2 * d), color, None, None, ring="ink")

    if d < 0.98:
        hem_pts = []
        for k in range(7):
            u = k / 6
            hx = lerp(-32, 30, u)
            hy = 46 + wave(p["wave"] + u * 0.6, 1, 0, 4 * p["hem"]) + (6 if k % 2 else 0)
            hem_pts.append((hx, hy + d * 18))
        robe = [(-32, -3), (-19, -31), (-1, -44), (17, -29), (30, -1)] + hem_pts[::-1]
        robe = [(x * (1 - 0.3 * d), y) for x, y in robe]
        robe_world = [(x, min(y, GROUND + 1)) for x, y in body.pts(robe)]  # sinking fog pools on the floor
        c.part(c.m.poly(robe_world), "body", "deep", "light", ring="ink", dark_width=2)
        if d > 0.2:  # dispersal: the robe breaks into falling fog strips
            for k in range(5):
                gx = -24 + k * 12
                gap = body.pts([(gx, -10 + k * 3), (gx + 3 + 3 * d, -10 + k * 3), (gx + 3 + 3 * d, 60), (gx, 60)])
                c.clear(c.m.poly(gap))
        hood = c.m.poly(body.pts([(-17, -23), (-1, -38), (14, -22), (8, -4), (-10, -4)]))
        c.part(hood, "deep", None, "body", ring="ink")
        tilt = Xf.rotate(p["hood"], (0, -14)).then(body)
        c.paint(c.m.poly(tilt.pts([(-9, -17), (9, -17), (9, -12), (-9, -12)])), "ink")
        eye_w = 4 if p["glow"] < 2 else 7
        c.paint(c.m.poly(tilt.pts([(-1, -16), (-1 + eye_w, -16), (-1 + eye_w, -14), (-1, -14)])), "spark")

    # Net spindle and filament arms with a spark net between them.
    spindle = body.pt(0, 12)
    pts["spindle"] = spindle
    if d < 0.9:
        c.part(c.m.poly(body.pts([(-6, 3), (5, 3), (5, 22), (-6, 22)])), "ink", None, None)
        c.paint(c.m.poly(body.pts([(-3, 5), (2, 5), (2, 20), (-3, 20)])), "metal")
        c.paint(c.m.poly(body.pts([(-8, 10), (7, 10), (7, 15), (-8, 15)])), glow_color(p["glow"]))
    spread = p["spread"] * (1 - p["drag"] * 0.7) * (1 - d)
    arm_y = 8 + p["arms"]
    left = body.pt(-35 - spread, arm_y + 3)
    right = body.pt(35 + spread, arm_y - p["arms"] * 0.4)
    if d < 0.9:
        c.paint(c.m.stroke([body.pt(-8, 6), left], 3), "metal")
        c.paint(c.m.stroke([body.pt(7, 6), right], 3), "light")
        low = body.pt(0, 24)
        c.paint(c.m.stroke([left, low, right], 1), "spark")
        if p["net"] > 0.1:
            fan = int(1 + 4 * p["net"])
            for k in range(fan):
                u = (k + 1) / (fan + 1)
                mid = (lerp(left[0], right[0], u), lerp(left[1], right[1], u) - 10 * p["net"] * math.sin(math.pi * u))
                c.paint(c.m.stroke([spindle, mid], 1), "spark")
            c.paint(c.m.stroke([left, (lerp(left[0], right[0], 0.5), left[1] - 14 * p["net"]), right], 1), "metal")
    pts.update(left_hand=left, right_hand=right)
    if d >= 0.9:  # final dispersal: a small pile of fog strips around the dropped spindle
        for k in range(5):
            x0 = 30 + k * 10
            c.part(c.m.poly([(x0, 108 - k % 2 * 3), (x0 + 7, 104 - k % 2 * 2), (x0 + 9, 112), (x0 + 1, 113)]),
                   "body" if k % 2 else "light", None, None, ring="ink")
        c.part(c.m.rect(52, 100, 63, 111), "ink", None, None)
        c.paint(c.m.rect(55, 103, 60, 107), "spark" if p["glow"] > 0.5 else "metal")
    c.outline("ink")
    if p["ring"] > 0.05:  # Receding Call: frost ring pulse from the spindle
        r = 10 + 34 * p["ring"]
        c.paint(c.m.arc_band(spindle, r, r + 2, 20, 340, 24, taper_end=False), "spark" if p["ring"] < 0.6 else "metal")
    brackets(c, pivot[0], 8, p["brk"])
    return pts


# ---------------------------------------------------------------------------
# Lady Enma of Ash
# ---------------------------------------------------------------------------

ENMA_NEUTRAL = {
    "x": 0, "y": 0, "lean": 0, "head": 0, "fa": 30, "fe": 30, "ba": -30, "be": 20,
    "fan": -150, "fanOpen": 0.35, "wing": 60, "wingOpen": 0.3, "sleeve": 0, "pins": 0, "glow": 0,
    "kneel": 0, "ash": 0, "smear": 0, "smearFrom": 60, "wave": 0, "brk": 0, "drop": 0,
}


def fan_mask(c, hand, angle, open_amount, length, broken=False):
    half = 8 + 62 * open_amount
    pts = [hand]
    steps = 6
    for k in range(steps + 1):
        a = angle - half + 2 * half * k / steps
        r = length - (5 if broken and k in (2, 5) else 0)
        pts.append(limb_point(hand, r, a))
    return c.m.poly(pts), [limb_point(hand, length - 2, angle - half + 2 * half * k / steps) for k in range(steps + 1)]


def enma_frame(c, p: dict, st: dict) -> dict:
    k = p["kneel"]
    cx = 56 + p["x"]
    cy = 64 + p["y"] + 14 * k
    body = Xf.rotate(p["lean"], (0, 0)).then(Xf.translate(cx, cy))
    shadow(c, cx - 36, cx + 38)
    pts = {"center": (cx, cy)}
    sleeve = p["sleeve"]

    # Back arm (behind): sleeve + cinder fan.
    sb = body.pt(-10, -11)
    hb = limb_point(limb_point(sb, 12, p["ba"] + p["lean"]), 11, p["ba"] + p["be"] + p["lean"])
    c.part(c.m.poly([sb, limb_point(sb, 6, p["ba"] - 80), limb_point(hb, 6 + sleeve * 0.3, p["ba"] + p["be"] - 60 + sleeve),
                     limb_point(hb, 5, p["ba"] + p["be"] + 90), hb]), "deep", None, "body", ring="ink")
    fan_poly, ribs = fan_mask(c, hb, p["fan"], p["fanOpen"], 24)
    c.part(fan_poly, "accent", "deep", "spark" if p["glow"] >= 2 else None, ring="ink", dark_width=1)
    for rib in ribs[1:-1]:
        c.paint(c.m.stroke([hb, rib], 1), "metal")
    if p["ash"] > 0.05:  # cinders gather on the fan ribs
        for idx, rib in enumerate(ribs[::2]):
            if idx / 4 <= p["ash"]:
                spark_burst(c, limb_point(rib, 3, p["fan"]), 0.35 + 0.3 * p["ash"], "spark" if idx % 2 else "light")
    pts["fan_hand"] = hb

    # Layered kosode / uchikake: kneeling drops the hem to the floor.
    hem = 46 - 14 * k
    folds = [(x, hem + wave(p["wave"] + u * 0.5, 1, 0, 2.2) + (3 if i % 2 else 0))
             for i, (u, x) in enumerate([(0, -34), (0.25, -18), (0.5, 0), (0.75, 18), (1.0, 36)])]
    outer = [(-18, -13), (-31, 1), (-37, 28)] + folds + [(38, 30), (31, 1), (17, -13)]
    c.part(c.m.poly(body.pts(outer)), "body", "deep", "light", ring="ink", dark_width=2)
    c.paint(c.m.poly(body.pts([(-13, -13), (0, -5), (13, -13), (11, 27), (0, 38), (-12, 26)])), "deep")
    c.paint(c.m.stroke(body.pts([(-14, -1), (0, 9), (13, -2)]), 2), "metal")
    c.part(c.m.poly(body.pts([(-7, 6), (7, 6), (7, 23), (-7, 23)])), "ink", None, None)
    c.paint(c.m.poly(body.pts([(-3, 10), (3, 10), (3, 18), (-3, 18)])), glow_color(p["glow"]))

    # Head: white stage face, swept hair, uneven hairpins that sway.
    head = Xf.rotate(p["head"], (0, -14)).then(body)
    c.part(c.m.poly(head.pts([(-11, -33), (-3, -41), (9, -38), (14, -25), (9, -11), (-8, -12), (-14, -24)])), "deep",
           None, None, ring="ink")
    c.paint(c.m.poly(head.pts([(-7, -30), (10, -30), (10, -15), (-7, -15)])), "light")
    c.paint(c.m.poly(head.pts([(1, -25), (5, -25), (5, -23), (1, -23)])), "ink")
    c.paint(c.m.poly(head.pts([(7, -25), (10, -25), (10, -23), (7, -23)])), "ink")
    c.paint(c.m.poly(head.pts([(5, -18), (8, -18), (8, -16), (5, -16)])), "accent")
    c.paint(c.m.poly(head.pts([(-9, -33), (-4, -45), (9, -46), (16, -35), (8, -31)])), "ink")
    sway = p["pins"]
    pin_a = head.pt(-13, -38)
    pin_b = head.pt(10, -40)
    tip_a = limb_point(pin_a, 19, -120 + sway)
    tip_b = limb_point(pin_b, 23, 112 + sway * 1.3)
    c.paint(c.m.stroke([pin_a, tip_a], 2), "metal")
    c.paint(c.m.stroke([pin_b, tip_b], 2), "metal")
    c.paint(c.m.rect(tip_a[0] - 3, tip_a[1] - 2, tip_a[0] + 3, tip_a[1] + 2), "accent")
    c.paint(c.m.rect(tip_b[0] - 3, tip_b[1] - 2, tip_b[0] + 3, tip_b[1] + 2), "spark")
    pts["head_top"] = head.pt(2, -46)

    # Front arm: sleeve and the broken paper-parasol wing (the cutting edge).
    sf = body.pt(10, -11)
    hf = limb_point(limb_point(sf, 12, p["fa"] + p["lean"]), 11, p["fa"] + p["fe"] + p["lean"])
    wing_poly, wing_ribs = fan_mask(c, hf, p["wing"], p["wingOpen"], 28, broken=True)
    if p["smear"] > 0:
        smear_band(c, hf, 12, 32, p["smearFrom"], p["wing"], p["smear"])
    if p["drop"] > 0.5:  # subdued: wing folded and set down, fan separated
        c.part(c.m.poly([(72, 108), (96, 104), (93, 110)]), "accent", None, None, ring="ink")
    else:
        c.part(wing_poly, "deep", None, "light", ring="ink")
        c.paint(c.m.stroke([hf, wing_ribs[0]], 2), "metal")
        for rib in wing_ribs[1::2]:
            c.paint(c.m.stroke([hf, rib], 1), "light")
    c.part(c.m.poly([sf, limb_point(sf, 6, p["fa"] + 80), limb_point(hf, 6 + sleeve * 0.3, p["fa"] + p["fe"] + 60 - sleeve),
                     limb_point(hf, 5, p["fa"] + p["fe"] - 90), hf]), "body", "deep", "light", ring="ink", dark_width=1)
    pts["wing_hand"] = hf
    c.outline("ink")
    brackets(c, cx, 6, p["brk"])
    return pts


# ---------------------------------------------------------------------------
# Construct: Furnace Abbot
# ---------------------------------------------------------------------------

FURNACE_NEUTRAL = {
    "x": 0, "y": 0, "tilt": 0, "squash": 0, "rake": 20, "vent": 1, "plates": 0, "puff": 0, "puffAmt": 0.4,
    "buckle": 0, "collapse": 0, "smear": 0, "smearFrom": 20, "impact": 0, "blast": 0, "brk": 0, "swell": 0, "wave": 0,
}


def furnace_frame(c, p: dict, st: dict) -> dict:
    col = p["collapse"]
    base = (56 + p["x"], 108 + p["y"])
    sq = p["squash"] + col * 22
    sw = p["swell"]
    # Squash scales height about the base; tilt rocks about the base.
    body = Xf.scale(1 + sw * 0.06, (77 - sq) / 77, (0, 0)).then(Xf.rotate(p["tilt"] + col * 12, (0, 0))).then(
        Xf.translate(*base))
    shadow(c, base[0] - 40, base[0] + 40)
    pts = {"base": base}

    # Chimney bank with smoke puffs that rise and drift (secondary motion).
    for k, (px, top) in enumerate(((-23, -95), (-7, -100), (11, -90))):
        bob = wave(p["wave"] + k * 0.21, 1, 0, 1.2) * (1 - col)
        c.part(c.m.poly(body.pts([(px, top + bob), (px + 11, top + bob), (px + 11, -64), (px, -64)])), "deep", None,
               "body", ring="ink")
        c.paint(c.m.poly(body.pts([(px, top + bob), (px + 11, top + bob), (px + 11, top + 4 + bob), (px, top + 4 + bob)])),
                "metal")
        if p["puffAmt"] > 0.05 and col < 0.7:
            for j in range(2):
                phase = (p["puff"] + k * 0.31 + j * 0.5) % 1.0
                rise = 4 + 22 * phase
                size = (2 + 4 * phase) * p["puffAmt"] * (1 - col)
                if size > 0.8:
                    sx, sy = body.pt(px + 5 - 6 * phase, top - rise)
                    c.part(c.m.ellipse(sx, sy, size, size * 0.8), "ink" if j else "deep", None, None)

    mantle = [(-32, -66), (-16, -77), (20, -75), (34, -59), (31, -16), (20, 0), (-21, 0), (-36, -17)]
    if p["buckle"]:
        mantle[3] = (34, -59 + 8 * p["buckle"])
        mantle[2] = (20, -75 + 6 * p["buckle"])
    c.part(c.m.poly(body.pts(mantle)), "body", "deep", None, ring="ink", dark_width=2)
    c.paint(c.m.poly(body.pts([(-27, -61), (25, -63), (28, -47), (-31, -46)])), "light")
    for rx in (-27, 26):
        for ry in (-58, -24):
            c.paint(c.m.poly(body.pts([(rx, ry), (rx + 3, ry), (rx + 3, ry + 3), (rx, ry + 3)])), "metal")

    # Vent face: three plates slide outward as ``plates`` opens; glow steps 0..3.
    c.part(c.m.poly(body.pts([(-22, -45), (21, -45), (21, -14), (-22, -14)])), "ink", None, None)
    level = p["vent"]
    inner = c.m.poly(body.pts([(-16, -39), (15, -39), (15, -20), (-16, -20)]))
    c.paint(inner, "accent" if level >= 0.5 else "deep")
    if level >= 1.5:
        c.paint(c.m.poly(body.pts([(-9, -35), (8, -35), (8, -25), (-9, -25)])), "spark")
    if level >= 2.5:
        c.paint(c.m.poly(body.pts([(-14, -38), (13, -38), (13, -21), (-14, -21)])), "spark")
        c.paint(c.m.poly(body.pts([(-5, -33), (4, -33), (4, -27), (-5, -27)])), "light")
    for k, px in enumerate((-17, -4, 9)):
        slide = p["plates"] * (8 if k != 1 else 0) * (-1 if k == 0 else 1)
        lift = p["plates"] * (10 if k == 1 else 3)
        c.part(c.m.poly(body.pts([(px + slide, -44 - lift), (px + 8 + slide, -44 - lift), (px + 8 + slide, -38 - lift),
                                  (px + slide, -38 - lift)])), "metal", None, "spark", ring="ink")
    pts["vent"] = body.pt(0, -30)
    if p["blast"] > 0.05:  # Forge Sermon release: a hard-edged heat wedge from the vent
        v = pts["vent"]
        reach = 10 + 30 * p["blast"]
        wedge = c.m.poly([(v[0] + 8, v[1] - 8), (v[0] + 8 + reach, v[1] - 14 - 8 * p["blast"]),
                          (v[0] + 8 + reach, v[1] + 14 + 8 * p["blast"]), (v[0] + 8, v[1] + 8)])
        c.paint(wedge, "accent")
        c.paint(c.m.poly([(v[0] + 8, v[1] - 4), (v[0] + 6 + reach * 0.8, v[1] - 6), (v[0] + 6 + reach * 0.8, v[1] + 6),
                          (v[0] + 8, v[1] + 4)]), "spark")

    # Rake arm from the right shoulder.
    shoulder = body.pt(31, -41 + 8 * p["buckle"])
    rake = floor_clamped(shoulder, p["rake"], 52)
    tip = limb_point(shoulder, 44, rake)
    if p["smear"] > 0:
        smear_band(c, shoulder, 22, 50, p["smearFrom"], rake, p["smear"])
    c.part(c.m.taper(shoulder, tip, 7, 5), "metal", None, "spark", ring="ink")
    head_a = limb_point(tip, 7, rake + 90)
    head_b = limb_point(tip, 7, rake - 90)
    c.part(c.m.taper(head_a, head_b, 5, 5), "accent", None, "spark", ring="ink")
    c.part(c.m.ellipse(shoulder[0], shoulder[1], 5), "deep", None, "metal", ring="ink")
    pts["rake_tip"] = tip
    c.outline("ink")
    if p["impact"] > 0.05:  # Crush impact ring at the rake head
        r = 4 + 10 * p["impact"]
        x, y = tip
        c.paint(sub(c.m.rect(x - r, y - r, x + r, y + r), c.m.rect(x - r + 3, y - r + 3, x + r - 3, y + r - 3)),
                "spark" if p["impact"] < 0.6 else "light")
    brackets(c, base[0], 2, p["brk"])
    return pts


# ---------------------------------------------------------------------------
# Object: Yearless Bell
# ---------------------------------------------------------------------------

BELL_NEUTRAL = {
    "x": 0, "y": 0, "swing": 0, "plateL": 0, "plateR": 0, "core": 1, "sockets": 0, "ring": 0, "ring2": 0,
    "crack": 0, "collapse": 0, "brk": 0, "hum": 0, "wave": 0,
}


def bell_frame(c, p: dict, st: dict) -> dict:
    col = p["collapse"]
    top = (55 + p["x"], 18 + p["y"] + col * 40)
    body = Xf.scale(1, 1 - col * 0.45, (0, 0)).then(Xf.rotate(p["swing"] + col * 9, (0, 0))).then(Xf.translate(*top))
    shadow(c, top[0] - 42 + col * 4, top[0] + 42)
    pts = {"top": top}

    # Side chime plates hang from offset braces and swing on their own pivots.
    for side, color, angle in ((-1, "metal", p["plateL"]), (1, "light", p["plateR"])):
        hinge = body.pt(side * 30, 22 if side < 0 else 15)
        plate = Xf.rotate(angle, (0, 0)).then(Xf.translate(*hinge))
        x0, x1 = (-5, 6) if side < 0 else (-6, 6)
        h = 41 if side < 0 else 43
        c.part(c.m.poly(plate.pts([(x0, 0), (x1, 0), (x1, h), (x0, h)])), color, "deep", None, ring="ink", dark_width=1)
        c.paint(c.m.stroke([body.pt(side * 22, 18 if side < 0 else 6), hinge], 3), "metal")

    shell = [(-28, 14), (-11, 0), (19, 5), (33, 25), (28, 74), (14, 90), (-18, 88), (-33, 70)]
    c.part(c.m.poly(body.pts(shell)), "deep", "ink", "body", ring="ink", dark_width=2)
    c.part(c.m.poly(body.pts([(-25, 21), (25, 21), (25, 73), (-25, 73)])), "body", "deep", "light", ring="ink", dark_width=1)
    c.paint(c.m.poly(body.pts([(-19, 27), (19, 27), (19, 66), (-19, 66)])), "ink")
    core = p["core"]
    grow = 1 + 0.12 * max(0.0, core - 1)
    c.paint(c.m.poly(body.pts([(-12 * grow, 35 - 3 * (grow - 1) * 10), (12 * grow, 35 - 3 * (grow - 1) * 10),
                               (12 * grow, 60 + 3 * (grow - 1) * 10), (-12 * grow, 60 + 3 * (grow - 1) * 10)])),
            "accent" if core >= 0.5 else "deep")
    if core >= 1.0:
        c.paint(c.m.poly(body.pts([(-6, 41), (6, 41), (6, 54), (-6, 54)])), "spark")
    if core >= 2.5:
        c.paint(c.m.poly(body.pts([(-10, 38), (10, 38), (10, 57), (-10, 57)])), "spark")
        c.paint(c.m.poly(body.pts([(-3, 45), (3, 45), (3, 50), (-3, 50)])), "light")
    c.paint(c.m.stroke(body.pts([(-24, 21), (-9, 2)]), 4), "metal")
    c.paint(c.m.stroke(body.pts([(20, 7), (35, 25)]), 4), "metal")
    if p["crack"] > 0.05:  # break read: a jagged spark fracture across the core
        n = p["crack"]
        c.paint(c.m.stroke(body.pts([(-14, 32), (-4 + 4 * n, 46), (-11, 58 + 4 * n)]), 2 + (1 if n > 0.6 else 0)), "spark")

    # Four node sockets light in a square sequence (fractional ``sockets`` = partial step).
    for k, (sx, sy) in enumerate(((-27, 71), (-12, 80), (13, 80), (28, 68))):
        order = (0, 1, 3, 2)[k]
        lit = p["sockets"] - order
        x0, y0 = body.pt(sx, sy)
        c.part(c.m.rect(x0, y0, x0 + 8, y0 + 8), "ink", None, None)
        if lit >= 1:
            c.paint(c.m.rect(x0 + 1, y0 + 1, x0 + 7, y0 + 7), "accent")
            c.paint(c.m.rect(x0 + 2, y0 + 2, x0 + 6, y0 + 6), "spark")
        elif lit > 0.3:
            c.paint(c.m.rect(x0 + 2, y0 + 2, x0 + 6, y0 + 6), "accent")
        else:
            c.paint(c.m.rect(x0 + 3, y0 + 3, x0 + 5, y0 + 5), "metal" if col < 0.5 else "deep")
    pts["core"] = body.pt(0, 47)
    c.outline("ink")
    for value, color in ((p["ring"], "spark"), (p["ring2"], "metal")):
        if value > 0.05:
            r = 16 + 40 * value
            c.paint(c.m.arc_band(pts["core"], r, r + 2, 20, 340, 28, taper_end=False), color)
    brackets(c, top[0], 0, p["brk"])
    return pts
