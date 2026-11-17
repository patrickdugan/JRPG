#!/usr/bin/env python3
"""Humanoid boss cast for the v2 suite: Mateus, Kaji, Ujiro, Chiyo.

Key poses and prop hooks only; the rig lives in ``boss_rigs_v2`` and shared
motion in ``boss_motion_v2`` (see its docstring for the key format).
"""

from __future__ import annotations

from boss_motion_v2 import humanoid_defeat, humanoid_idle, humanoid_stagger, humanoid_walk, settle_to
from boss_rigs_v2 import (GROUND, HUMANOID_NEUTRAL, brackets, limb_point, smear_band, spark_burst, sub, wave,
                          weapon_base, weapon_baton, weapon_blade, weapon_hammer)

CAST: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Father Mateus Avelar
# ---------------------------------------------------------------------------


def mateus_torso(c, p, torso, pts):
    c.paint(c.m.stroke(torso.pts([(-11, -29), (8, -7)]), 3), "accent")
    c.paint(c.m.rect(*torso.pt(-14, -26), *torso.pt(-10, -22)), "metal")  # split key-ring guard


def mateus_fx(c, p, pts):
    top = pts["head_top"]
    # Thorned crescent gathers overhead (signature tell) and launches forward on the active band.
    grow, travel = p["p1"], p["p2"]
    if grow > 0.05 and travel < 0.98:
        r = 5 + 9 * grow + 4 * travel
        cx = top[0] + 4 + 36 * travel
        cy = top[1] - 8 - 2 * grow + 14 * travel
        mid = 180 - 90 * travel
        half = 40 + 55 * grow
        band = c.m.arc_band((cx, cy), r, r + 2 + 2 * grow * (1 - travel), mid - half, mid + half, 10, taper_end=False)
        c.paint(band, "spark" if p["glow"] >= 3 and travel < 0.2 else "accent")
        thorns = int(2 + 3 * grow)
        for i in range(thorns):
            a = mid - half + (2 * half) * (i + 0.5) / thorns
            base = limb_point((cx, cy), r + 2, a)
            c.paint(c.m.poly([limb_point(base, 3, a - 70), limb_point(base, 4 + 2 * grow, a),
                              limb_point(base, 3, a + 70)]), "deep")
    # Phase reveal: a broken court key rises above the open coat.
    if p["p3"] > 0.05:
        rise = p["p3"]
        kx, ky = top[0] + 1, top[1] - 4 - 13 * rise
        gap = 1 + 3 * rise
        c.paint(c.m.rect(kx - 1, ky - 9 - gap, kx + 1, ky - gap), "metal")
        c.paint(c.m.rect(kx - 1, ky, kx + 1, ky + 7), "metal")
        c.paint(c.m.rect(kx + 1, ky + 4, kx + 4, ky + 7), "accent")
        c.paint(c.m.ellipse(kx, ky - 12 - gap, 3, 3), "metal")
        c.paint(c.m.rect(kx - 1, ky - 13 - gap, kx + 1, ky - 11 - gap), "ink")
    brackets(c, pts["hip"][0], 6, p["p4"])


MATEUS_N = {**HUMANOID_NEUTRAL}

CAST["mateus"] = {
    "rig": "humanoid",
    "style": {"weapon": weapon_blade, "wlen": 36, "torso_prop": mateus_torso, "fx": mateus_fx,
              "drop_to": (16, GROUND - 1, 92)},
    "neutral": MATEUS_N,
    "idle": humanoid_idle(MATEUS_N),
    "locomotion": humanoid_walk(MATEUS_N, stride=10, lift=4, swing=12),
    "strike": {
        "windup": [
            (0.25, {"head": 6, "lean": 0, "fa": 12, "fe": 42, "wpn": 18, "crouch": 1, "ba": -4}, "out"),
            (0.6, {"lean": -9, "crouch": 5, "fa": -60, "fe": 60, "wpn": -112, "ff": 13, "bf": -13, "head": 5,
                   "flare": 2, "ba": 12, "be": 30}, "in-out"),
            (1.0, {"lean": -17, "crouch": 9, "fa": -112, "fe": 30, "wpn": -132, "ff": 17, "bf": -16, "fl": 2,
                   "flare": 5, "glow": 2, "head": 9, "ba": 36, "be": 42}, "out3"),
        ],
        "active": [
            (0.25, {"lean": 4, "crouch": 4, "fa": -18, "fe": 20, "wpn": -226, "smear": 1, "ff": 18, "bf": -14,
                    "ba": -10}, "in"),
            (0.5, {"lean": 12, "crouch": 3, "fa": 70, "fe": 8, "wpn": -268, "smear": 1, "ba": -42, "be": 10}, "linear"),
            (0.75, {"lean": 14, "crouch": 4, "fa": 86, "fe": 4, "wpn": -290, "smear": 0.4, "x": 3}, "out"),
            (1.0, {"lean": 13, "crouch": 5, "fa": 72, "fe": 10, "wpn": -304, "smear": 0, "x": 4, "glow": 1}, "out"),
        ],
        "recovery": [
            (0.35, {"lean": 8, "crouch": 6, "fa": 46, "fe": 18, "wpn": -318, "x": 3, "head": 6, "glow": 0,
                    "ba": -26, "be": 12}, "out"),
            (1.0, {"lean": 3, "crouch": 1, "fa": 24, "fe": 30, "wpn": -326, "x": 0, "head": 1, "ff": 10, "bf": -10,
                   "flare": 0, "ba": -11, "be": 14}, "in-out"),
        ],
    },
    "signature": {
        "windup": [
            # Hands lock at the chest with the blade hanging point-down (no forward feint).
            (0.18, {"fa": 58, "fe": 92, "ba": 52, "be": 98, "wpn": 4, "lean": 3, "head": 8, "crouch": 2}, "out"),
            # The blade turns up *behind* the hands (through -90) as both arms rise.
            (0.45, {"fa": 140, "fe": 24, "ba": 130, "be": 26, "wpn": -178, "lean": -6, "head": -6, "crouch": -1,
                    "flare": 2, "glow": 1, "p1": 0.22}, "in-out"),
            (0.78, {"fa": 116, "fe": 10, "ba": -114, "be": -10, "wpn": -160, "lean": -10, "head": -10, "flare": 5,
                    "glow": 2, "p1": 0.72, "crouch": 0}, "in-out"),
            (1.0, {"fa": 112, "fe": 6, "ba": -118, "be": -12, "wpn": -155, "lean": -12, "head": -12, "flare": 6,
                   "glow": 3, "p1": 1.0}, "out"),
        ],
        "active": [
            (0.25, {"fa": 96, "fe": 0, "ba": -82, "wpn": -238, "lean": 4, "p2": 0.25, "smear": 1, "crouch": 2}, "in"),
            (0.5, {"fa": 88, "fe": 0, "ba": -60, "wpn": -264, "lean": 12, "p2": 0.55, "smear": 0.5, "crouch": 4,
                   "ff": 16, "bf": -14}, "linear"),
            (0.75, {"lean": 14, "p2": 0.8, "smear": 0, "crouch": 5, "x": 2, "wpn": -268}, "out"),
            (1.0, {"lean": 15, "p2": 1.0, "crouch": 6, "glow": 2, "x": 3, "wpn": -272}, "out"),
        ],
        "recovery": [
            (0.4, {"crouch": 9, "lean": 20, "fa": 30, "fe": 15, "wpn": -348, "ba": -20, "be": 10, "head": 16, "glow": 1,
                   "p1": 0, "x": 2}, "out"),
            (1.0, {"crouch": 4, "lean": 9, "fa": 24, "fe": 28, "wpn": -330, "ba": -12, "be": 14, "head": 7, "glow": 0,
                   "x": 0, "ff": 10, "bf": -10, "flare": 0, "p2": 0}, "in-out"),
        ],
    },
    "stagger": [
        (0.0, {"lean": -16, "head": -14, "hx": -3, "fa": -30, "fe": 10, "ba": -60, "be": 5, "wpn": -60, "x": -3,
               "crouch": 2, "flare": 3}, "linear"),
        (0.12, {"lean": -21, "head": -18, "hx": -4, "fa": -58, "ba": -82, "wpn": -98, "x": -6, "crouch": 3, "bf": -17,
                "ff": 6}, "out5"),
        (0.36, {"lean": 7, "head": 18, "hx": 0, "fa": 6, "fe": 22, "ba": -18, "wpn": 2, "x": -7, "crouch": 8,
                "bf": -16, "ff": 4}, "in-out"),
        (0.72, {"lean": 12, "head": 21, "fa": 12, "fe": 18, "wpn": 12, "x": -6, "crouch": 9, "bf": -14, "ff": 5},
         "in-out"),
        (1.0, {"lean": 3, "head": 2, "fa": 22, "fe": 32, "ba": -10, "be": 14, "wpn": 35, "x": 0, "crouch": 1,
               "bf": -9, "ff": 9, "flare": 0}, "in-out"),
    ],
    "transition": [
        (0.0, {}, "linear"),
        (0.25, {"crouch": 5, "lean": 10, "head": 10, "fa": 42, "fe": 62, "ba": 30, "be": 72, "wpn": 150}, "in-out"),
        (0.55, {"crouch": -1, "lean": -8, "head": -10, "fa": 150, "fe": 10, "ba": -150, "be": -10, "wpn": 176,
                "flare": 8, "glow": 3, "p3": 0.8, "p4": 1}, "out3"),
        (0.7, {"p3": 1.0, "flare": 9, "fa": 146, "ba": -146}, "linear"),
        (1.0, {"crouch": 2, "lean": 4, "head": 0, "fa": 30, "fe": 30, "ba": -14, "be": 14, "wpn": 40, "flare": 2,
               "glow": 1, "p3": 0, "p4": 0.2}, "in-out"),
    ],
    "defeat": [
        (0.0, {"lean": -10, "head": -10, "fa": -20, "wpn": -40, "crouch": 2}, "linear"),
        (0.25, {"lean": 14, "head": 14, "crouch": 8, "fa": 20, "fe": 30, "wpn": 20, "kneel": 0.3, "bf": -12}, "out"),
        (0.6, {"lean": 18, "head": 22, "crouch": 14, "kneel": 0.8, "fa": 40, "fe": 40, "wpn": 60, "drop": 0.6,
               "ff": 10, "bf": -17, "ba": 10, "be": 30}, "in-out"),
        (1.0, {"lean": 10, "head": 26, "crouch": 16, "kneel": 1.0, "fa": 10, "fe": 20, "ba": 5, "be": 25, "wpn": 92,
               "drop": 1.0, "ff": 11, "bf": -18}, "out"),
    ],
}


# ---------------------------------------------------------------------------
# Captain Kaji: cable spool, two-step cargo hook thrown on a cable
# ---------------------------------------------------------------------------


def kaji_torso(c, p, torso, pts):
    box = c.m.poly(torso.pts([(-19, -24), (-6, -24), (-6, -5), (-19, -5)]))
    c.part(box, "deep", None, "body", ring="ink")
    hub = torso.pt(-12.5, -14.5)
    c.part(c.m.ellipse(hub[0], hub[1], 5), "metal", None, "spark", ring="ink")
    spin = p["p1"] * 360 + p["wave"] * 40
    for k in range(3):
        c.paint(c.m.stroke([hub, limb_point(hub, 4, spin + k * 120)], 1), "ink")
    pts["spool"] = hub


def kaji_weapon(c, p, pts, st):
    """Hook in hand, or flying on its cable when ``p2`` (cable reach) > 0."""
    hand, angle = weapon_base(p, pts, st)
    flying = p["p2"] > 0.02
    reach = 6 + 24 * p["p2"]
    head = limb_point(hand, reach, angle) if flying else hand
    spool = pts.get("spool", hand)
    if p["smear"] > 0:
        r = (reach + 10) if flying else 44
        center = hand if flying else pts["front_shoulder"]
        smear_band(c, center, max(6, r - 14), r + 4, p["smearFrom"], angle, p["smear"])
    c.paint(c.m.stroke([spool, hand], 2), "accent")
    if flying:
        c.paint(c.m.stroke([hand, head], 2), "accent")
        if p["p3"] > 0.3:  # storm sparks crawl along the cable
            for k in range(3):
                u = ((k + 0.5) / 3 + p["wave"] * 2) % 1.0
                at = (hand[0] + (head[0] - hand[0]) * u, hand[1] + (head[1] - hand[1]) * u)
                spark_burst(c, at, 0.4 + 0.3 * p["p3"])
    shaft = 24 if not flying else 10
    tip = limb_point(head, shaft, angle)
    c.part(c.m.taper(limb_point(head, -3, angle), tip, 3, 3), "metal", None, None, ring="ink")
    hook_a = limb_point(tip, 7, angle + 150)
    hook_b = limb_point(hook_a, 6, angle + 220)
    c.part(c.m.stroke([tip, hook_a, hook_b], 3), "spark", None, None, ring="ink")
    pts["weapon_tip"] = tip


def kaji_fx(c, p, pts):
    brackets(c, pts["hip"][0], 8, p["p4"])


KAJI_N = {**HUMANOID_NEUTRAL, "fa": 18, "fe": 30, "wpn": 28, "ff": 11, "bf": -11, "lean": 4}

CAST["captain-kaji"] = {
    "rig": "humanoid",
    "style": {"broad": 3, "weapon": kaji_weapon, "torso_prop": kaji_torso, "fx": kaji_fx,
              "drop_to": (20, GROUND - 1, 88)},
    "neutral": KAJI_N,
    "idle": humanoid_idle(KAJI_N, extra=lambda t, p: {"p1": t}),
    "locomotion": humanoid_walk(KAJI_N, stride=12, lift=5, swing=14, extra=lambda t, p: {"p1": t * 2}),
    "strike": {  # Salt Cut / Chain Haul: low back-swing, flat forward rake of the hook
        "windup": [
            (0.3, {"lean": 0, "crouch": 2, "fa": -10, "fe": 40, "wpn": -40, "head": 6, "ba": 10}, "out"),
            (0.65, {"lean": -10, "crouch": 6, "fa": -70, "fe": 30, "wpn": -112, "ff": 15, "bf": -15, "ba": 40,
                    "be": 40, "flare": 3}, "in-out"),
            (1.0, {"lean": -14, "crouch": 9, "fa": -96, "fe": 22, "wpn": -136, "ff": 18, "bf": -16, "fl": 2,
                   "ba": 52, "be": 46, "flare": 5, "glow": 2, "head": 9, "p1": 0.4}, "out3"),
        ],
        "active": [
            (0.25, {"lean": 0, "crouch": 7, "fa": -10, "fe": 10, "wpn": -40, "smear": 1, "ba": 0, "fl": 0}, "in"),
            (0.5, {"lean": 14, "crouch": 6, "fa": 72, "fe": 4, "wpn": 64, "smear": 1, "ba": -40, "x": 3}, "linear"),
            (0.75, {"lean": 18, "crouch": 6, "fa": 96, "fe": 0, "wpn": 104, "smear": 0.4, "x": 5}, "out"),
            (1.0, {"lean": 17, "crouch": 7, "fa": 100, "fe": 6, "wpn": 120, "smear": 0, "x": 5, "glow": 1}, "out"),
        ],
        "recovery": [
            (0.35, {"lean": 12, "crouch": 8, "fa": 70, "fe": 14, "wpn": 70, "head": 8, "glow": 0, "ba": -20}, "out"),
            (1.0, settle_to(KAJI_N, crouch=1, x=0, flare=0, p1=0.6), "in-out"),
        ],
    },
    "signature": {  # Crane Surge: brake off, hook circles on its cable, storm sparks, hurled forward
        "windup": [
            (0.15, {"fa": 120, "fe": 30, "wpn": 200, "lean": -2, "crouch": 2, "p1": 0.5, "head": -4, "ba": -20}, "out"),
            (0.4, {"fa": 160, "fe": 10, "wpn": 70, "p2": 0.55, "p1": 1.5, "lean": -6, "crouch": 4, "flare": 2,
                   "glow": 1, "smear": 0.4}, "in"),
            (0.7, {"fa": 166, "fe": 6, "wpn": -100, "p2": 0.85, "p1": 2.6, "p3": 0.6, "lean": -9, "crouch": 5,
                   "flare": 4, "glow": 2, "ff": 15, "bf": -15, "smear": 0.4}, "linear"),
            (0.96, {"fa": 170, "fe": 4, "wpn": -200, "p2": 1.0, "p1": 3.3, "p3": 1.0, "lean": -12, "crouch": 7,
                    "flare": 6, "glow": 3, "ff": 17, "bf": -16, "head": -8, "smear": 0.3}, "out"),
            (1.0, {"wpn": -205, "p1": 3.4, "smear": 0}, "linear"),
        ],
        "active": [
            (0.25, {"fa": 120, "fe": 0, "wpn": -250, "p2": 1.1, "smear": 1, "lean": 2, "crouch": 5}, "in"),
            (0.5, {"fa": 92, "fe": 0, "wpn": -272, "p2": 1.15, "smear": 0.6, "lean": 14, "crouch": 6, "x": 3,
                   "ba": -50}, "linear"),
            (0.75, {"fa": 88, "wpn": -278, "p2": 1.12, "smear": 0, "lean": 16, "x": 4, "p3": 0.6}, "out"),
            (1.0, {"fa": 86, "wpn": -284, "p2": 1.05, "lean": 16, "x": 4, "p3": 0.2, "glow": 2}, "out"),
        ],
        "recovery": [
            (0.45, {"fa": 60, "fe": 20, "wpn": -300, "p2": 0.4, "p3": 0, "lean": 10, "crouch": 7, "glow": 1,
                    "p1": 4.4, "head": 6}, "in-out"),
            (1.0, settle_to(KAJI_N, wpn=-332, p2=0, crouch=1, x=0, flare=0, glow=0, p1=5.0), "in-out"),
        ],
    },
    "stagger": humanoid_stagger(KAJI_N, fling=-110, daze=8, extra={"end": {"p1": 0.5}}),
    "transition": [
        (0.0, {}, "linear"),
        (0.3, {"crouch": 6, "lean": 12, "head": 12, "fa": 40, "fe": 60, "wpn": 60, "p1": 1.0}, "in-out"),
        (0.6, {"crouch": 0, "lean": -8, "head": -8, "fa": 150, "fe": 20, "ba": -140, "be": -10, "wpn": 160,
               "flare": 7, "glow": 3, "p1": 3.0, "p2": 0.6, "p4": 1}, "out3"),
        (1.0, {"crouch": 2, "lean": 5, "head": 0, "fa": 22, "fe": 30, "ba": -12, "be": 14, "wpn": 30, "flare": 1,
               "glow": 1, "p1": 4.0, "p2": 0, "p4": 0.2}, "in-out"),
    ],
    "defeat": humanoid_defeat(-50, extra={"rest": {"wpn": 88, "p1": 0}}),
}


# ---------------------------------------------------------------------------
# Magistrate Ujiro: plain docket case, command baton, order slip
# ---------------------------------------------------------------------------


def ujiro_case(c, p, pts):
    """Docket case in the back hand; ``p1`` opens the lid, ``p2`` unfurls the order slip.

    Held low, the slip spills downward; raised overhead (the command tell), it
    unfurls *upward* as a banner so the tell reads above the head.
    """
    hx, hy = pts["back_hand"]
    w, h = 14, 17
    raised = p["ba"] > 100
    x0, y0 = hx - w / 2, (hy - h + 2) if raised else (hy - 2)
    if p["p2"] > 0.05:
        length = 6 + 24 * p["p2"]
        sway = p["p3"] * 8
        if raised:
            top = y0 - length
            slip = c.m.poly([(x0 + 3, y0 + 1), (x0 + w - 3, y0 + 1), (x0 + w - 3 - sway, top), (x0 + 3 - sway, top)])
            rows = [y0 - k * 6 for k in range(1, int(length / 6) + 1)]
        else:
            top = y0 + 2 + length
            slip = c.m.poly([(x0 + 3, y0 + 2), (x0 + w - 3, y0 + 2), (x0 + w - 3 + sway, top), (x0 + 3 + sway, top)])
            rows = [y0 + 2 + k * 6 for k in range(1, int(length / 6) + 1)]
        c.part(slip, "spark", None, None, ring="ink")
        for yy in rows:
            off = sway * abs(yy - y0) / length * (-1 if raised else 1)
            c.paint(c.m.rect(x0 + 5 + off, yy, x0 + w - 6 + off, yy), "ink")
    c.part(c.m.rect(x0, y0, x0 + w, y0 + h), "ink", None, "deep", ring="ink")
    c.paint(c.m.rect(x0 + 3, y0 + 3, x0 + w - 3, y0 + h - 3), "accent")
    c.paint(c.m.rect(x0 + 5, y0 + 5, x0 + 9, y0 + 8), "spark")
    if p["p1"] > 0.05:
        hinge = (x0 + w, y0) if raised else (x0, y0)
        lid = c.m.taper(hinge, limb_point(hinge, w, (90 + 100 * p["p1"]) * (1 if not raised else -1) + (0 if not raised else 360)), 4, 4)
        c.part(lid, "deep", None, "accent", ring="ink")


def ujiro_case_behind(c, p, pts):
    if p["ba"] <= 100:
        ujiro_case(c, p, pts)


def ujiro_fx(c, p, pts):
    if p["ba"] > 100:  # raised overhead: the case and slip read in front of everything
        ujiro_case(c, p, pts)
    if p["p4"] > 0.05 and "weapon_tip" in pts:  # Crush impact: square ring at the gavel line's head
        x, y = pts["weapon_tip"]
        r = 4 + 9 * p["p4"]
        ring = sub(c.m.rect(x - r, y - r, x + r, y + r), c.m.rect(x - r + 3, y - r + 3, x + r - 3, y + r - 3))
        c.paint(ring, "spark" if p["p4"] < 0.6 else "light")
    if p["glow"] >= 3 and p["p2"] > 0.5:
        spark_burst(c, (pts["back_hand"][0], pts["back_hand"][1] - 6), 0.8)
    brackets(c, pts["hip"][0], 6, p["p5"])


UJIRO_N = {**HUMANOID_NEUTRAL, "fa": 20, "fe": 34, "wpn": 30, "ba": -6, "be": 20}

CAST["ujiro"] = {
    "rig": "humanoid",
    "style": {"weapon": weapon_baton, "wlen": 30, "back_prop": ujiro_case_behind, "fx": ujiro_fx,
              "drop_to": (18, GROUND - 2, 84)},
    "neutral": UJIRO_N,
    "idle": humanoid_idle(UJIRO_N, amp=1.1),
    "locomotion": humanoid_walk(UJIRO_N, stride=10, lift=4, swing=10),
    "strike": {  # Gavel Line: baton rises overhead, slams down-forward with a square Crush ring
        "windup": [
            (0.3, {"fa": 70, "fe": 60, "wpn": 120, "lean": 0, "head": 6, "crouch": 1}, "out"),
            (0.65, {"fa": 160, "fe": 20, "wpn": 190, "lean": -8, "crouch": 3, "head": 2, "ff": 13, "bf": -13,
                    "flare": 2}, "in-out"),
            (1.0, {"fa": 172, "fe": 12, "wpn": 222, "lean": -14, "crouch": 6, "head": 6, "ff": 16, "bf": -15,
                   "flare": 4, "glow": 2, "fl": 2, "ba": 20, "be": 40}, "out3"),
        ],
        "active": [
            (0.25, {"fa": 140, "fe": 4, "wpn": 160, "smear": 1, "lean": 0, "crouch": 4, "fl": 0}, "in"),
            (0.5, {"fa": 92, "fe": 0, "wpn": 98, "smear": 1, "lean": 14, "crouch": 7, "x": 3, "p4": 0.2}, "linear"),
            (0.75, {"fa": 66, "fe": 4, "wpn": 70, "smear": 0.4, "lean": 18, "crouch": 9, "x": 4, "p4": 0.6}, "out"),
            (1.0, {"fa": 60, "fe": 6, "wpn": 64, "smear": 0, "lean": 18, "crouch": 9, "x": 4, "p4": 1.0, "glow": 1}, "out"),
        ],
        "recovery": [
            (0.35, {"fa": 50, "fe": 14, "wpn": 52, "lean": 14, "crouch": 8, "p4": 0, "glow": 0, "head": 10}, "out"),
            (1.0, settle_to(UJIRO_N, crouch=1, x=0, flare=0), "in-out"),
        ],
    },
    "signature": {  # Seizure Order / Call Clerks: command tell (case open overhead, slip, baton to the sky)
        "windup": [
            (0.2, {"ba": 60, "be": 70, "fa": 40, "fe": 50, "wpn": 70, "lean": -2, "head": -2}, "out"),
            (0.5, {"ba": 150, "be": 20, "fa": 150, "fe": 20, "wpn": 176, "p1": 0.6, "lean": -8, "head": -10,
                   "crouch": -1, "glow": 1}, "in-out"),
            (0.8, {"ba": 166, "be": 6, "fa": 170, "fe": 6, "wpn": 180, "p1": 1.0, "p2": 0.7, "lean": -12, "head": -14,
                   "glow": 2, "flare": 3}, "in-out"),
            (1.0, {"ba": 170, "be": 4, "fa": 174, "fe": 4, "wpn": 182, "p1": 1.0, "p2": 1.0, "lean": -13, "head": -15,
                   "glow": 3, "flare": 4, "p3": 0.2}, "out"),
        ],
        "active": [
            (0.25, {"fa": 120, "fe": 0, "wpn": 120, "smear": 1, "lean": 0, "p3": 0.6, "head": -2}, "in"),
            (0.5, {"fa": 92, "fe": 0, "wpn": 92, "smear": 0.5, "lean": 10, "p3": 1.0, "crouch": 3, "x": 2}, "linear"),
            (0.75, {"fa": 90, "wpn": 90, "smear": 0, "lean": 12, "p3": 0.8, "crouch": 4, "x": 3, "ba": 120}, "out"),
            (1.0, {"fa": 88, "wpn": 89, "lean": 12, "p3": 0.6, "crouch": 4, "x": 3, "ba": 100, "glow": 2}, "out"),
        ],
        "recovery": [
            (0.45, {"fa": 50, "fe": 20, "wpn": 50, "ba": 30, "be": 40, "p1": 0.3, "p2": 0.2, "p3": 0, "lean": 6,
                    "crouch": 3, "glow": 1, "head": 4}, "in-out"),
            (1.0, settle_to(UJIRO_N, p1=0, p2=0, crouch=1, x=0, flare=0, glow=0), "in-out"),
        ],
    },
    "stagger": humanoid_stagger(UJIRO_N, fling=-120, daze=10, extra={
        "impact": {"p1": 0.8}, "fling": {"p1": 1.0, "p2": 0.4}, "hold": {"p1": 0.4, "p2": 0.1}, "end": {"p1": 0, "p2": 0}}),
    "transition": [
        (0.0, {}, "linear"),
        (0.3, {"ba": 90, "be": 40, "fa": 60, "fe": 50, "wpn": 120, "lean": 4, "crouch": 3, "p1": 0.5, "p5": 0.4}, "in-out"),
        (0.6, {"ba": 160, "be": 10, "fa": 160, "fe": 10, "wpn": 176, "p1": 1.0, "p2": 1.0, "p3": 0.5, "lean": -10,
               "head": -12, "glow": 3, "flare": 5, "p5": 1}, "out3"),
        (1.0, {"ba": -6, "be": 20, "fa": 26, "fe": 34, "wpn": 36, "p1": 0, "p2": 0, "p3": 0, "lean": 3, "head": 0,
               "glow": 1, "flare": 1, "p5": 0.2}, "in-out"),
    ],
    "defeat": humanoid_defeat(-60, extra={"start": {"p1": 1.0}, "buckle": {"p1": 1.0, "p2": 0.6},
                                          "fall": {"p2": 1.0, "p3": 0.6, "ba": 40, "be": 60},
                                          "rest": {"wpn": 84, "p1": 1.0, "p2": 1.0, "p3": 1.0, "ba": 30, "be": 70}}),
}


# ---------------------------------------------------------------------------
# Bell Warden Chiyo: resonator yoke, dampers, rescue reels, calibration hammer
# ---------------------------------------------------------------------------


def chiyo_torso(c, p, torso, pts):
    sep = p["p1"] * 7
    buzz = wave(p["wave"] * 6, 1, 0, 1.5 * p["p1"])
    yoke = torso.pts([(-25, -28), (-30, -57), (-13, -69), (22, -63), (31, -38)])
    c.paint(c.m.stroke(yoke, 9), "ink")
    c.paint(c.m.stroke(yoke, 5), "metal")
    c.paint(c.m.stroke(torso.pts([(-29, -52), (-14, -64), (20, -59)]), 1), "spark")
    left = [(x - sep, y + buzz) for x, y in [(-35, -41), (-23, -41), (-23, -25), (-35, -25)]]
    right = [(x + sep, y - buzz) for x, y in [(23, -44), (38, -44), (38, -28), (23, -28)]]
    c.part(c.m.poly(torso.pts(left)), "accent", None, "spark", ring="ink")
    c.part(c.m.poly(torso.pts(right)), "deep", None, "light", ring="ink")
    for bx in (-11.5, 17.5):
        hub = torso.pt(bx, -6)
        c.part(c.m.ellipse(hub[0], hub[1], 6), "ink", None, "deep")
        spin = p["p2"] * 360
        for k in range(2):
            c.paint(c.m.stroke([limb_point(hub, 4, spin + k * 180), limb_point(hub, -4, spin + k * 180)], 1), "accent")
        if p["p4"] > 0.3:  # break pins exposed during the transition
            c.paint(c.m.rect(hub[0] - 1, hub[1] - 9, hub[0] + 1, hub[1] - 7), "spark")
        slack = 4 + 10 * p["p4"]
        c.paint(c.m.stroke([hub, (hub[0] + 1, hub[1] + 14 + slack)], 2), "metal")
    pts["yoke_top"] = torso.pt(4, -68)


def chiyo_fx(c, p, pts):
    if p["p3"] > 0.05:
        top = pts["yoke_top"]
        for k in range(2):
            r = 6 + 22 * p["p3"] - 8 * k
            if r > 4:
                c.paint(c.m.arc_band(top, r, r + 2, 110, 250, 12, taper_end=False), "spark" if k == 0 else "metal")
    if p["p5"] > 0.05 and "weapon_tip" in pts:  # chain cast: chain line flies forward from the hammer
        tip = pts["weapon_tip"]
        end = limb_point(tip, 6 + 14 * p["p5"], 58)
        c.paint(c.m.stroke([tip, end], 2), "metal")
        c.paint(c.m.rect(end[0] - 2, end[1] - 2, end[0] + 2, end[1] + 2), "spark")
    brackets(c, pts["hip"][0], 4, p["p6"])


CHIYO_N = {**HUMANOID_NEUTRAL, "fa": 26, "fe": 30, "wpn": 40, "ff": 12, "bf": -12}

CAST["bell-warden-chiyo"] = {
    "rig": "humanoid",
    "style": {"broad": 4, "weapon": weapon_hammer, "wlen": 26, "torso_prop": chiyo_torso, "fx": chiyo_fx,
              "drop_to": (20, GROUND - 3, 80)},
    "neutral": CHIYO_N,
    "idle": humanoid_idle(CHIYO_N, extra=lambda t, p: {"p2": t * 0.5}),
    "locomotion": humanoid_walk(CHIYO_N, stride=12, lift=5, swing=12, extra=lambda t, p: {"p2": t}),
    "strike": {  # Chain Cast: hammer swung back low, flung forward releasing a chain line
        "windup": [
            (0.3, {"fa": -10, "fe": 40, "wpn": -30, "lean": 0, "crouch": 2, "head": 6}, "out"),
            (0.65, {"fa": -80, "fe": 30, "wpn": -120, "lean": -9, "crouch": 6, "ff": 15, "bf": -15, "flare": 3,
                    "p2": 0.4}, "in-out"),
            (1.0, {"fa": -110, "fe": 24, "wpn": -150, "lean": -13, "crouch": 8, "ff": 17, "bf": -16, "flare": 5,
                   "glow": 2, "p2": 0.7, "head": 8, "fl": 2}, "out3"),
        ],
        "active": [
            (0.25, {"fa": -20, "fe": 10, "wpn": -50, "smear": 1, "lean": 2, "crouch": 7, "fl": 0}, "in"),
            (0.5, {"fa": 70, "fe": 4, "wpn": 70, "smear": 1, "lean": 14, "crouch": 6, "x": 3, "p5": 0.5}, "linear"),
            (0.75, {"fa": 92, "fe": 0, "wpn": 96, "smear": 0.4, "lean": 16, "x": 4, "p5": 1.0}, "out"),
            (1.0, {"fa": 94, "fe": 4, "wpn": 100, "smear": 0, "lean": 15, "x": 4, "p5": 0.9, "glow": 1}, "out"),
        ],
        "recovery": [
            (0.4, {"fa": 60, "fe": 16, "wpn": 64, "lean": 10, "crouch": 6, "p5": 0.3, "glow": 0, "p2": 1.1}, "out"),
            (1.0, settle_to(CHIYO_N, crouch=1, x=0, flare=0, p5=0, p2=1.4), "in-out"),
        ],
    },
    "signature": {  # Ringing Count / Warden Bell: dampers separate, hammer rises behind the head, strikes the yoke
        "windup": [
            (0.2, {"fa": 60, "fe": 70, "wpn": 120, "crouch": 3, "lean": 2, "p1": 0.2, "head": 2}, "out"),
            (0.5, {"fa": 150, "fe": 30, "wpn": 200, "crouch": 6, "lean": -6, "p1": 0.6, "ff": 15, "bf": -15,
                   "flare": 3, "glow": 1}, "in-out"),
            (0.8, {"fa": 164, "fe": 22, "wpn": 210, "crouch": 9, "lean": -12, "p1": 0.9, "glow": 2, "flare": 5,
                   "head": -6}, "in-out"),
            (1.0, {"fa": 166, "fe": 24, "wpn": 216, "crouch": 10, "lean": -14, "p1": 1.0, "glow": 3, "flare": 6,
                   "head": -8, "ff": 17, "bf": -16}, "out"),
        ],
        "active": [
            (0.25, {"fa": 160, "fe": 30, "wpn": 160, "smear": 1, "lean": -6, "p3": 0.25}, "in"),
            (0.5, {"fa": 150, "fe": 26, "wpn": 128, "smear": 0.5, "lean": -2, "p3": 0.55, "crouch": 8}, "linear"),
            (0.75, {"fa": 146, "fe": 24, "wpn": 124, "smear": 0, "p3": 0.8, "crouch": 7}, "out"),
            (1.0, {"fa": 140, "fe": 24, "wpn": 120, "p3": 1.0, "crouch": 7, "glow": 2}, "out"),
        ],
        "recovery": [
            (0.4, {"fa": 80, "fe": 40, "wpn": 90, "p3": 0, "p1": 0.6, "lean": 4, "crouch": 5, "glow": 1}, "out"),
            (1.0, settle_to(CHIYO_N, p1=0, crouch=1, flare=0, glow=0), "in-out"),
        ],
    },
    "stagger": humanoid_stagger(CHIYO_N, fling=-104, daze=6, extra={
        "impact": {"p1": 0.6}, "fling": {"p1": 0.9}, "hold": {"p1": 0.3}, "end": {"p1": 0}}),
    "transition": [
        (0.0, {}, "linear"),
        (0.3, {"crouch": 6, "lean": 10, "head": 10, "fa": 40, "fe": 60, "wpn": 70, "p1": 0.5, "p2": 0.5}, "in-out"),
        (0.6, {"crouch": 0, "lean": -8, "head": -8, "fa": 150, "fe": 20, "ba": -140, "be": -10, "wpn": 200,
               "flare": 6, "glow": 3, "p1": 1.0, "p2": 2.0, "p4": 1.0, "p6": 1}, "out3"),
        (1.0, {"crouch": 2, "lean": 4, "head": 0, "fa": 28, "fe": 30, "ba": -12, "be": 14, "wpn": 42, "flare": 1,
               "glow": 1, "p1": 0.2, "p2": 2.6, "p4": 0.6, "p6": 0.2}, "in-out"),
    ],
    "defeat": humanoid_defeat(-40, extra={"buckle": {"p4": 0.4, "p1": 0.6}, "fall": {"p4": 0.9, "p1": 1.0},
                                          "rest": {"wpn": 80, "p4": 1.0, "p1": 1.0}}),
}
