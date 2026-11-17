#!/usr/bin/env python3
"""Non-humanoid boss cast for the v2 suite: Tithe Hound, Widow of Fog, Furnace Abbot, Lady Enma, Yearless Bell.

Key poses and loops only; rigs live in ``boss_rigs_creature_v2`` and the key
format is documented in ``boss_motion_v2``.
"""

from __future__ import annotations

import math

from boss_motion_v2 import chain, trailing
from boss_rigs_creature_v2 import BELL_NEUTRAL, ENMA_NEUTRAL, FURNACE_NEUTRAL, QUADRUPED_NEUTRAL, WIDOW_NEUTRAL
from boss_rigs_v2 import rnd, wave

CAST: dict[str, dict] = {}
SECONDARY: dict[str, object] = {}


def settle(neutral: dict, *keys, **extra) -> dict:
    return {**{k: neutral[k] for k in keys}, **extra}


# ---------------------------------------------------------------------------
# Tithe Hound
# ---------------------------------------------------------------------------

HOUND_N = dict(QUADRUPED_NEUTRAL)
HOUND_LEGS = ("lbf", "lbn", "lff", "lfn", "hbf", "hbn", "hff", "hfn")


def hound_idle(t):
    p = dict(HOUND_N)
    p.update(breath=rnd(1 + wave(t, 1, 0, 1)), y=wave(t, 1, 0.1, 0.8), head=wave(t, 1, 0.2, 4),
             jaw=rnd(0.12 + max(0.0, wave(t, 1, 0.6, 0.18))), tail=wave(t, 1, 0.3, 10), rib=rnd(0.1 + wave(t, 1, 0.4, 0.1)),
             neck=wave(t, 1, 0.45, 1.5), pitch=wave(t, 1, 0.25, 1.5), lfn=wave(t, 1, 0.5, 1.5),
             lbn=wave(t, 1, 0.75, 1.2), wave=t)
    return p


def hound_prowl(t):
    p = dict(HOUND_N)
    # Diagonal pairs: near-hind with far-fore, far-hind with near-fore.
    for key, lift, offset in (("lbn", "hbn", 0.0), ("lff", "hff", 0.0), ("lbf", "hbf", 0.5), ("lfn", "hfn", 0.5)):
        phase = 2 * math.pi * (t + offset)
        p[key] = rnd(7 * math.cos(phase))
        p[lift] = rnd(4.5 * max(0.0, -math.sin(phase)))
    p.update(y=wave(t, 2, 0.1, 1.2), head=wave(t, 2, 0.35, 3) + 3, pitch=2 + wave(t, 2, 0.6, 1),
             tail=wave(t, 1, 0.2, 14), jaw=0.15, neck=wave(t, 2, 0.5, 1), breath=1, wave=t * 2, rib=0.15)
    return p


CAST["tithe-hound"] = {
    "rig": "quadruped",
    "style": {},
    "neutral": HOUND_N,
    "smear_key": "head",
    "idle": hound_idle,
    "locomotion": hound_prowl,
    "strike": {  # Ledger Maul: crouch back, front feet reach, lunge with the jaw
        "windup": [
            (0.3, {"head": -6, "crouch": 2, "x": -1, "jaw": 0.3, "tail": 10}, "out"),
            (0.65, {"x": -6, "crouch": 7, "pitch": -6, "head": 8, "lff": 6, "lfn": 8, "lbf": -2, "lbn": -3, "rib": 0.4,
                    "jaw": 0.6, "tail": 25}, "in-out"),
            (1.0, {"x": -8, "crouch": 9, "pitch": -9, "head": 12, "jaw": 0.9, "rib": 0.7, "glow": 2, "tail": 35,
                   "neck": -2, "lfn": 9, "lff": 7}, "out3"),
        ],
        "active": [
            (0.25, {"x": 6, "crouch": 2, "pitch": 8, "head": 4, "jaw": 1.0, "neck": 4, "smear": 1, "lbn": -8, "lbf": -6,
                    "lfn": 14, "lff": 12, "hfn": 4, "hff": 3, "tail": 10}, "in"),
            (0.5, {"x": 14, "pitch": 12, "head": 16, "jaw": 0.2, "neck": 6, "smear": 0.8, "hfn": 0, "hff": 0}, "linear"),
            (0.75, {"x": 15, "pitch": 10, "head": 18, "jaw": 0.15, "smear": 0}, "out"),
            (1.0, {"x": 14, "pitch": 8, "head": 14, "jaw": 0.2, "glow": 1, "tail": -6}, "out"),
        ],
        "recovery": [
            (0.4, {"x": 10, "crouch": 5, "pitch": 2, "head": 6, "jaw": 0.2, "tail": -12, "glow": 0, "lbn": -4, "lbf": -3,
                   "lfn": 6, "lff": 5}, "out"),
            (1.0, settle(HOUND_N, "x", "crouch", "pitch", "head", "jaw", "neck", "rib", "tail", *HOUND_LEGS), "in-out"),
        ],
    },
    "signature": {  # Consume Ink: rear up, latch springs open, ribs flare, jaw unhinges, ink line drawn
        "windup": [
            (0.2, {"x": -2, "head": -8, "jaw": 0.3, "rib": 0.2, "crouch": 3}, "out"),
            (0.5, {"pitch": -16, "crouch": 0, "y": -2, "head": -10, "latch": 0.6, "rib": 0.7, "jaw": 0.6, "hfn": 8, "hff": 6,
                   "lfn": 4, "lff": 3, "tail": 30, "glow": 1}, "in-out"),
            (0.85, {"pitch": -20, "head": -14, "latch": 1, "rib": 1, "jaw": 1.15, "hfn": 12, "hff": 9, "glow": 2,
                    "tail": 40, "ink": 0.08}, "in-out"),
            (1.0, {"pitch": -21, "head": -15, "jaw": 1.3, "latch": 1, "rib": 1.1, "glow": 3, "ink": 0.18}, "out"),
        ],
        "active": [
            (0.25, {"pitch": 4, "head": 6, "hfn": 0, "hff": 0, "jaw": 1.3, "ink": 0.6, "x": 4, "y": 0}, "in"),
            (0.5, {"pitch": 8, "head": 8, "ink": 1.0, "x": 6}, "linear"),
            (0.75, {"ink": 0.95, "jaw": 1.2, "x": 6, "pitch": 7}, "linear"),
            (1.0, {"ink": 0.7, "jaw": 1.0, "glow": 2, "pitch": 6}, "out"),
        ],
        "recovery": [
            (0.4, {"ink": 0, "jaw": 0.5, "latch": 0.6, "rib": 0.5, "pitch": 2, "head": 4, "glow": 1, "x": 3}, "out"),
            (1.0, settle(HOUND_N, "x", "crouch", "pitch", "head", "jaw", "neck", "rib", "tail", "latch", "glow", "y",
                         *HOUND_LEGS), "in-out"),
        ],
    },
    "stagger": [
        (0.0, {"x": -4, "pitch": -12, "head": -16, "jaw": 0.6, "rib": 0.5, "lfn": -4}, "linear"),
        (0.12, {"x": -8, "pitch": -15, "head": -22, "hfn": 5, "hff": 3, "tail": 40, "jaw": 0.8}, "out5"),
        (0.36, {"x": -9, "pitch": 6, "head": 18, "jaw": 0.3, "crouch": 5, "lfn": -6, "lff": -4, "hfn": 0, "hff": 0,
                "tail": 5}, "in-out"),
        (0.72, {"x": -8, "pitch": 7, "head": 22, "crouch": 6, "tail": -10, "rib": 0.2}, "in-out"),
        (1.0, settle(HOUND_N, "x", "crouch", "pitch", "head", "jaw", "rib", "tail", *HOUND_LEGS), "in-out"),
    ],
    "transition": [
        (0.0, {}, "linear"),
        (0.3, {"crouch": 6, "head": 10, "pitch": 4, "rib": 0.3}, "in-out"),
        (0.6, {"pitch": -18, "head": -16, "latch": 1, "rib": 1.2, "jaw": 1.0, "glow": 3, "brk": 1, "hfn": 10, "hff": 8,
               "crouch": 0, "tail": 35}, "out3"),
        (1.0, {"pitch": 0, "head": 0, "latch": 0.4, "rib": 0.4, "jaw": 0.3, "glow": 1, "brk": 0.2, "hfn": 0, "hff": 0,
               "tail": 0}, "in-out"),
    ],
    "defeat": [
        (0.0, {"pitch": -8, "head": -10, "jaw": 0.6}, "linear"),
        (0.3, {"crouch": 6, "pitch": 6, "head": 14, "fold": 0.3, "jaw": 0.4, "tail": -10}, "out"),
        (0.65, {"crouch": 11, "fold": 0.8, "head": 24, "pitch": 7, "latch": 0, "tail": -24, "jaw": 0.2, "rib": 0.1}, "in-out"),
        (1.0, {"crouch": 13, "fold": 1.0, "head": 30, "pitch": 5, "tail": -32, "rib": 0, "glow": 0, "jaw": 0.05}, "out"),
    ],
}
SECONDARY["tithe-hound"] = trailing("tail2", lambda p: p["x"] * 2 + p["pitch"] + p["tail"] * 0.5, gain=-1.6, limit=35)


# ---------------------------------------------------------------------------
# Widow of Fog
# ---------------------------------------------------------------------------

WIDOW_N = dict(WIDOW_NEUTRAL)


def widow_idle(t):
    p = dict(WIDOW_N)
    p.update(y=wave(t, 1, 0, 2.5), lean=wave(t, 1, 0.2, 2), hood=wave(t, 1, 0.1, 4), spread=13 + wave(t, 1, 0.3, 3),
             arms=wave(t, 1, 0.45, 2), ribbon=t, wave=t)
    return p


def widow_drift(t):
    p = dict(WIDOW_N)
    p.update(y=wave(t, 2, 0, 2) - 2, lean=6 + wave(t, 1, 0.2, 2), hood=4 + wave(t, 1, 0.1, 3), spread=10 + wave(t, 1, 0.3, 2),
             arms=2 + wave(t, 1, 0.45, 2), ribbon=t * 2, wave=t * 2, hem=1.5)
    return p


CAST["widow-of-fog"] = {
    "rig": "widow",
    "style": {},
    "neutral": WIDOW_N,
    "idle": widow_idle,
    "locomotion": widow_drift,
    "strike": {  # Name Drag: rears back and rises, filaments flung wide and high, then hauled inward
        "windup": [
            (0.3, {"spread": 19, "arms": -6, "lean": -4, "glow": 1, "ribbon": 0.2, "y": -2, "ribbonLift": 0.15,
                   "hood": -4}, "out"),
            (0.7, {"spread": 25, "arms": -12, "lean": -9, "net": 0.5, "ribbon": 0.5, "y": -6, "hood": -9,
                   "ribbonLift": 0.35}, "in-out"),
            (1.0, {"spread": 28, "arms": -15, "lean": -11, "net": 0.8, "glow": 2, "ribbon": 0.7, "y": -7, "hood": -11,
                   "ribbonLift": 0.45}, "out3"),
        ],
        "active": [
            (0.25, {"drag": 0.5, "lean": 3, "x": 3, "arms": 0, "net": 0.9, "ribbon": 0.8, "y": -3, "ribbonLift": 0.2}, "in"),
            (0.5, {"drag": 1.0, "lean": 10, "x": 6, "arms": 8, "net": 0.6, "ribbon": 0.9, "y": -1, "ribbonLift": 0.1}, "linear"),
            (0.75, {"drag": 0.9, "lean": 11, "x": 6, "arms": 9, "net": 0.4, "ribbon": 1.0, "y": 0, "ribbonLift": 0}, "out"),
            (1.0, {"drag": 0.8, "lean": 10, "x": 6, "arms": 8, "net": 0.3, "glow": 1, "ribbon": 1.1}, "out"),
        ],
        "recovery": [
            (0.4, {"drag": 0.4, "lean": 5, "x": 3, "arms": 3, "net": 0, "glow": 0, "ribbon": 1.3, "y": 1, "hood": 5}, "out"),
            (1.0, settle(WIDOW_N, "drag", "lean", "x", "arms", "net", "glow", "y", "hood", "spread", "ribbonLift",
                         ribbon=1.6), "in-out"),
        ],
    },
    "signature": {  # Receding Call: rise, ribbons invert upward, net opens into a ring
        "windup": [
            (0.2, {"y": -3, "ribbonLift": 0.2, "spread": 16, "arms": -3, "glow": 1, "ribbon": 0.2}, "out"),
            (0.55, {"y": -8, "ribbonLift": 0.7, "spread": 22, "arms": -7, "net": 0.5, "glow": 2, "lean": -3, "ribbon": 0.5,
                    "hem": 1.6}, "in-out"),
            (0.85, {"y": -10, "ribbonLift": 1.0, "spread": 25, "arms": -10, "net": 0.9, "glow": 3, "lean": -4, "ribbon": 0.8,
                    "hem": 2.0, "hood": -8}, "in-out"),
            (1.0, {"y": -11, "spread": 26, "arms": -11, "net": 1.0, "ribbon": 0.95, "hood": -10}, "out"),
        ],
        "active": [
            (0.25, {"ring": 0.25, "spread": 22, "arms": -6, "y": -9, "ribbon": 1.05}, "in"),
            (0.5, {"ring": 0.55, "spread": 20, "arms": -4, "ribbon": 1.15}, "linear"),
            (0.75, {"ring": 0.8, "spread": 19, "ribbon": 1.25, "net": 0.8}, "out"),
            (1.0, {"ring": 1.0, "spread": 18, "ribbon": 1.35, "net": 0.6, "glow": 2}, "out"),
        ],
        "recovery": [
            (0.4, {"ring": 0, "ribbonLift": 0.4, "y": -4, "net": 0.2, "glow": 1, "ribbon": 1.6, "hood": 2}, "out"),
            (1.0, settle(WIDOW_N, "ribbonLift", "y", "net", "glow", "spread", "arms", "lean", "hood", "hem", ribbon=2.0),
             "in-out"),
        ],
    },
    "stagger": [
        (0.0, {"lean": -12, "x": -4, "hood": -12, "spread": 6, "arms": -6, "ribbon": 0.1}, "linear"),
        (0.14, {"lean": -16, "x": -7, "hood": -16, "spread": 3, "arms": -9, "ribbon": 0.25, "y": -2}, "out5"),
        (0.4, {"lean": 6, "x": -8, "hood": 12, "spread": 4, "arms": 8, "y": 6, "ribbon": 0.5, "hem": 0.5}, "in-out"),
        (0.72, {"lean": 8, "x": -7, "hood": 14, "spread": 6, "arms": 9, "y": 7, "ribbon": 0.8}, "in-out"),
        (1.0, settle(WIDOW_N, "lean", "x", "hood", "spread", "arms", "y", "hem", ribbon=1.1), "in-out"),
    ],
    "transition": [
        (0.0, {}, "linear"),
        (0.3, {"y": 3, "ribbonLift": 0, "spread": 8, "hood": 8, "ribbon": 0.3, "lean": 4}, "in-out"),
        (0.6, {"y": -10, "ribbonLift": 1.0, "spread": 26, "arms": -10, "net": 1.0, "glow": 3, "brk": 1, "ribbon": 0.7,
               "hood": -8, "lean": -4}, "out3"),
        (1.0, {"y": -2, "ribbonLift": 0.35, "spread": 15, "arms": -2, "net": 0.2, "glow": 1, "brk": 0.2, "ribbon": 1.1,
               "hood": 0, "lean": 0}, "in-out"),
    ],
    "defeat": [
        (0.0, {"lean": -10, "hood": -10, "spread": 8, "glow": 1}, "linear"),
        (0.3, {"disperse": 0.3, "y": 4, "lean": 4, "hood": 10, "spread": 4, "ribbon": 0.4, "glow": 1}, "out"),
        (0.7, {"disperse": 0.75, "y": 10, "lean": 6, "spread": 1, "ribbon": 0.8, "glow": 0.6}, "in-out"),
        (1.0, {"disperse": 1.0, "y": 12, "ribbon": 1.0, "glow": 0.6}, "out"),
    ],
}


# ---------------------------------------------------------------------------
# Furnace Abbot
# ---------------------------------------------------------------------------

FURNACE_N = dict(FURNACE_NEUTRAL)


def furnace_idle(t):
    p = dict(FURNACE_N)
    p.update(puff=t, wave=t, squash=wave(t, 1, 0, 1.4), tilt=wave(t, 1, 0.2, 1.2), rake=20 + wave(t, 1, 0.3, 5),
             vent=rnd(1.1 + 0.6 * wave(t, 2, 0.1, 1)))
    return p


def furnace_lumber(t):
    p = dict(FURNACE_N)
    p.update(puff=t * 3, wave=t, tilt=wave(t, 2, 0, 3) + wave(t, 1, 0.3, 1), y=-abs(wave(t, 2, 0.0, 2)),
             squash=wave(t, 2, 0.25, 1.5) + wave(t, 1, 0.7, 0.8), rake=24 + wave(t, 2, 0.15, 7) + wave(t, 1, 0.5, 3),
             vent=rnd(1.2 + 0.5 * wave(t, 1, 0.4, 1)), puffAmt=0.6)
    return p


CAST["furnace-abbot"] = {
    "rig": "furnace",
    "style": {},
    "neutral": FURNACE_N,
    "smear_key": "rake",
    "idle": furnace_idle,
    "locomotion": furnace_lumber,
    "strike": {  # Hammer Decree: rake rises overhead, the mantle stretches, slam with a Crush ring
        "windup": [
            (0.3, {"rake": 80, "tilt": -1, "squash": -1, "vent": 1.4, "puff": 0.2}, "out"),
            (0.7, {"rake": 175, "tilt": -5, "squash": -3, "vent": 1.8, "puff": 0.5, "puffAmt": 0.6}, "in-out"),
            (1.0, {"rake": 212, "tilt": -8, "squash": -4, "vent": 2.6, "puff": 0.7, "puffAmt": 0.8}, "out3"),
        ],
        "active": [
            (0.25, {"rake": 140, "tilt": -1, "squash": -2, "smear": 1, "puff": 0.8}, "in"),
            (0.5, {"rake": 62, "tilt": 7, "squash": 3, "smear": 1, "impact": 0.3, "puff": 0.9, "x": 2}, "linear"),
            (0.75, {"rake": 42, "tilt": 9, "squash": 4, "smear": 0.4, "impact": 0.7, "puff": 1.0, "x": 3}, "out"),
            (1.0, {"rake": 38, "tilt": 8, "squash": 4, "smear": 0, "impact": 1.0, "puff": 1.1, "vent": 1.6}, "out"),
        ],
        "recovery": [
            (0.4, {"rake": 30, "tilt": 4, "squash": 2, "impact": 0, "puff": 1.3, "x": 2, "vent": 1.2}, "out"),
            (1.0, settle(FURNACE_N, "rake", "tilt", "squash", "x", "vent", "puffAmt", puff=1.8), "in-out"),
        ],
    },
    "signature": {  # Forge Sermon: vent plates open in three steps, chimneys puff, mantle swells white-hot
        "windup": [
            (0.12, {"plates": 0.0, "vent": 1.4, "puffAmt": 0.6, "puff": 0.2, "rake": 45, "squash": 1}, "out"),
            (0.3, {"plates": 0.35, "vent": 1.7, "puffAmt": 0.8, "puff": 0.5, "swell": 0.3, "squash": -1}, "out"),
            (0.55, {"plates": 0.68, "vent": 2.2, "puffAmt": 0.9, "puff": 0.9, "swell": 0.6, "squash": -2, "tilt": -2}, "out"),
            (0.82, {"plates": 1.0, "vent": 2.9, "puffAmt": 1.0, "puff": 1.3, "swell": 0.9, "squash": -3, "tilt": -3,
                    "rake": 60}, "out"),
            (1.0, {"vent": 3.0, "puff": 1.6, "swell": 1.0, "squash": -4, "tilt": -4}, "out"),
        ],
        "active": [
            (0.25, {"blast": 0.35, "tilt": 2, "squash": -1, "puff": 1.7}, "in"),
            (0.5, {"blast": 0.75, "tilt": 5, "squash": 1, "puff": 1.8, "x": 2}, "linear"),
            (0.75, {"blast": 1.0, "tilt": 6, "squash": 2, "puff": 1.9, "x": 3}, "out"),
            (1.0, {"blast": 0.85, "tilt": 6, "squash": 2, "puff": 2.0, "x": 3}, "out"),
        ],
        "recovery": [
            (0.4, {"blast": 0, "vent": 2.0, "plates": 0.6, "swell": 0.4, "tilt": 3, "squash": 1, "puff": 2.3, "x": 2}, "out"),
            (1.0, settle(FURNACE_N, "vent", "plates", "swell", "tilt", "squash", "x", "rake", "puffAmt", puff=2.8), "in-out"),
        ],
    },
    "stagger": [
        (0.0, {"tilt": -8, "squash": 2, "buckle": 0.6, "vent": 0.4, "rake": 100, "x": -3}, "linear"),
        (0.14, {"tilt": -11, "squash": 3, "buckle": 1.0, "vent": 0.2, "rake": 140, "x": -6, "puff": 0.3}, "out5"),
        (0.4, {"tilt": 6, "squash": 5, "buckle": 0.8, "vent": 0.8, "rake": 10, "x": -7, "puff": 0.6}, "in-out"),
        (0.72, {"tilt": 7, "squash": 5, "buckle": 0.6, "vent": 0.7, "rake": 6, "x": -6, "puff": 0.9}, "in-out"),
        (1.0, settle(FURNACE_N, "tilt", "squash", "buckle", "vent", "rake", "x", puff=1.2), "in-out"),
    ],
    "transition": [
        (0.0, {}, "linear"),
        (0.3, {"squash": 4, "tilt": 4, "vent": 1.8, "plates": 0.3, "puff": 0.4, "puffAmt": 0.8}, "in-out"),
        (0.6, {"squash": -4, "tilt": -4, "vent": 3.0, "plates": 1.0, "buckle": 1.0, "swell": 1.0, "brk": 1, "puff": 0.9,
               "puffAmt": 1.0, "rake": 120}, "out3"),
        (1.0, {"squash": 0, "tilt": 2, "vent": 2.0, "plates": 0.7, "buckle": 0.6, "swell": 0.2, "brk": 0.2, "puff": 1.4,
               "rake": 30}, "in-out"),
    ],
    "defeat": [
        (0.0, {"vent": 3.0, "tilt": -6, "puffAmt": 1.0, "rake": 70}, "linear"),
        (0.3, {"vent": 2.0, "collapse": 0.25, "tilt": 3, "puffAmt": 0.6, "rake": 50, "puff": 0.4}, "out"),
        (0.65, {"vent": 0.8, "collapse": 0.7, "tilt": 6, "puffAmt": 0.2, "rake": 80, "puff": 0.8, "buckle": 0.8}, "in-out"),
        (1.0, {"vent": 0.0, "collapse": 1.0, "tilt": 5, "puffAmt": 0.0, "rake": 92, "puff": 1.0, "buckle": 1.0}, "out"),
    ],
}


# ---------------------------------------------------------------------------
# Lady Enma of Ash
# ---------------------------------------------------------------------------

ENMA_N = dict(ENMA_NEUTRAL)


def enma_idle(t):
    p = dict(ENMA_N)
    p.update(y=wave(t, 1, 0, 1.5), sleeve=wave(t, 1, 0.2, 5), pins=wave(t, 1, 0.35, 7), fan=-150 + wave(t, 1, 0.1, 8),
             wing=60 + wave(t, 1, 0.5, 6), head=wave(t, 1, 0.15, 3), lean=wave(t, 1, 0.3, 1.5), fa=30 + wave(t, 1, 0.6, 4),
             ba=-30 + wave(t, 1, 0.8, 4), wave=t)
    return p


def enma_glide(t):
    p = dict(ENMA_N)
    p.update(y=wave(t, 2, 0, 1.5) - 1, lean=5 + wave(t, 1, 0.3, 1.5), sleeve=6 + wave(t, 2, 0.2, 4),
             pins=-8 + wave(t, 2, 0.35, 5), fan=-160 + wave(t, 1, 0.1, 6), wing=50 + wave(t, 1, 0.5, 5),
             head=2 + wave(t, 2, 0.15, 2), fa=24 + wave(t, 1, 0.6, 5), ba=-40 + wave(t, 1, 0.8, 5), wave=t * 2)
    return p


CAST["lady-enma"] = {
    "rig": "enma",
    "style": {},
    "neutral": ENMA_N,
    "smear_key": "wing",
    "idle": enma_idle,
    "locomotion": enma_glide,
    "strike": {  # Cinder Parasol Wing: wing swept back and opened, then a full forward arc
        "windup": [
            (0.3, {"fa": 0, "wing": -20, "wingOpen": 0.5, "lean": -2, "head": 4, "sleeve": -4}, "out"),
            (0.7, {"fa": -60, "fe": 20, "wing": -110, "wingOpen": 0.85, "lean": -8, "sleeve": -10, "glow": 1, "pins": 8}, "in-out"),
            (1.0, {"fa": -75, "fe": 24, "wing": -140, "wingOpen": 1.0, "lean": -10, "sleeve": -12, "glow": 2, "pins": 10,
                   "head": 8}, "out3"),
        ],
        "active": [
            (0.25, {"fa": 20, "fe": 10, "wing": -40, "smear": 1, "lean": 0, "sleeve": 0}, "in"),
            (0.5, {"fa": 90, "fe": 4, "wing": 70, "smear": 1, "lean": 10, "x": 3, "sleeve": 10, "pins": -6}, "linear"),
            (0.75, {"fa": 110, "fe": 0, "wing": 110, "smear": 0.4, "lean": 12, "x": 4, "sleeve": 12}, "out"),
            (1.0, {"fa": 112, "fe": 2, "wing": 120, "smear": 0, "lean": 11, "x": 4, "glow": 1, "sleeve": 10}, "out"),
        ],
        "recovery": [
            (0.4, {"fa": 70, "wing": 90, "wingOpen": 0.6, "lean": 6, "x": 2, "glow": 0, "sleeve": 4, "pins": 4}, "out"),
            (1.0, settle(ENMA_N, "fa", "fe", "wing", "wingOpen", "lean", "x", "sleeve", "pins", "head"), "in-out"),
        ],
    },
    "signature": {  # Paired Ashes / Abandonment Cry: fan snaps open overhead, wing flares, cinders gather
        "windup": [
            (0.2, {"ba": 60, "be": 40, "fan": 120, "fanOpen": 0.5, "head": -2, "sleeve": 4}, "out"),
            (0.5, {"ba": 150, "be": 10, "fan": 180, "fanOpen": 0.9, "fa": 120, "wing": -150, "wingOpen": 0.9,
                   "sleeve": 10, "head": -6, "glow": 1, "ash": 0.3, "y": -2}, "in-out"),
            (0.82, {"ba": 166, "be": 6, "fan": 186, "fanOpen": 1.0, "fa": 135, "wing": -165, "wingOpen": 1.0,
                    "sleeve": 14, "head": -10, "glow": 2, "ash": 0.8, "y": -4, "pins": -10}, "in-out"),
            (1.0, {"ba": 170, "fan": 188, "fa": 138, "sleeve": 15, "head": -11, "glow": 3, "ash": 1.0, "y": -5}, "out"),
        ],
        "active": [
            (0.25, {"ba": 120, "fan": 130, "ash": 0.4, "lean": 4, "y": -3}, "in"),
            (0.5, {"ba": 95, "fan": 92, "ash": 0, "lean": 10, "x": 3, "fa": 80, "wing": 40, "y": -1}, "linear"),
            (0.75, {"ba": 88, "fan": 86, "lean": 11, "x": 4, "fa": 70}, "out"),
            (1.0, {"ba": 86, "fan": 84, "lean": 11, "x": 4, "fa": 66, "glow": 2}, "out"),
        ],
        "recovery": [
            (0.4, {"ba": 40, "fan": 0, "fanOpen": 0.5, "lean": 6, "x": 2, "glow": 1, "sleeve": 6, "y": 0}, "out"),
            (1.0, settle(ENMA_N, "ba", "be", "fan", "fanOpen", "fa", "fe", "wing", "wingOpen", "lean", "x", "glow",
                         "sleeve", "head", "pins"), "in-out"),
        ],
    },
    "stagger": [
        (0.0, {"lean": -12, "head": -12, "fan": -60, "wingOpen": 0.15, "sleeve": -10, "x": -3, "pins": 12}, "linear"),
        (0.14, {"lean": -16, "head": -16, "fan": -40, "ba": -70, "fa": -40, "wing": -30, "sleeve": -14, "x": -6,
                "pins": 16}, "out5"),
        (0.4, {"lean": 8, "head": 14, "fan": -120, "ba": -10, "fa": 20, "wing": 20, "sleeve": 6, "x": -7, "pins": -8,
               "y": 3}, "in-out"),
        (0.72, {"lean": 9, "head": 16, "x": -6, "pins": -10, "y": 3}, "in-out"),
        (1.0, settle(ENMA_N, "lean", "head", "fan", "wingOpen", "sleeve", "x", "pins", "ba", "fa", "wing", "y"), "in-out"),
    ],
    "transition": [
        (0.0, {}, "linear"),
        (0.3, {"lean": 6, "head": 10, "ba": 10, "fa": 50, "fanOpen": 0.1, "wingOpen": 0.1, "sleeve": -6}, "in-out"),
        (0.6, {"lean": -6, "head": -10, "ba": 140, "fan": 200, "fanOpen": 1.0, "fa": 130, "wing": -170, "wingOpen": 1.0,
               "sleeve": 14, "glow": 3, "brk": 1, "ash": 0.6, "y": -4}, "out3"),
        (1.0, {"lean": 0, "head": 0, "ba": -30, "fan": -150, "fanOpen": 0.7, "fa": 30, "wing": 60, "wingOpen": 0.6,
               "sleeve": 2, "glow": 1, "brk": 0.2, "ash": 0, "y": 0}, "in-out"),
    ],
    "defeat": [
        (0.0, {"lean": -10, "head": -10, "fan": -60, "sleeve": -6}, "linear"),
        (0.3, {"kneel": 0.4, "lean": 8, "head": 12, "fan": -20, "ba": -10, "fanOpen": 0.2, "wingOpen": 0.2}, "out"),
        (0.65, {"kneel": 0.85, "lean": 10, "head": 18, "ba": 0, "fan": 10, "fanOpen": 0.05, "fa": 10, "drop": 0.6,
                "glow": 0}, "in-out"),
        (1.0, {"kneel": 1.0, "lean": 6, "head": 20, "ba": 10, "fan": 20, "fanOpen": 0.0, "fa": 6, "drop": 1.0,
               "sleeve": -2}, "out"),
    ],
}
SECONDARY["lady-enma"] = chain(
    trailing("pins", lambda p: p["x"] * 2 + p["lean"] + p["y"], gain=-3.0, limit=16),
    trailing("sleeve", lambda p: p["x"] * 2 + p["lean"], gain=-2.0, limit=12),
)


# ---------------------------------------------------------------------------
# Yearless Bell
# ---------------------------------------------------------------------------

BELL_N = dict(BELL_NEUTRAL)


def bell_idle(t):
    p = dict(BELL_N)
    p.update(swing=wave(t, 1, 0, 2), y=wave(t, 1, 0.25, 1.2), core=rnd(1 + 0.7 * wave(t, 2, 0.1, 1)),
             plateL=wave(t, 1, 0.4, 3), plateR=wave(t, 1, 0.65, 3), wave=t)
    return p


def bell_drift(t):
    p = dict(BELL_N)
    p.update(swing=4 + wave(t, 2, 0, 3) + wave(t, 1, 0.1, 1.5), y=-2 + wave(t, 2, 0.25, 1.5) + wave(t, 1, 0.6, 0.8),
             core=rnd(1.2 + 0.5 * wave(t, 2, 0.6, 1) + 0.3 * wave(t, 1, 0.2, 1)),
             plateL=-4 + wave(t, 2, 0.35, 5) + wave(t, 1, 0.8, 2), plateR=-3 + wave(t, 2, 0.6, 5) + wave(t, 1, 0.3, 2),
             wave=t * 2)
    return p


CAST["yearless-bell"] = {
    "rig": "bell",
    "style": {},
    "neutral": BELL_N,
    "idle": bell_idle,
    "locomotion": bell_drift,
    "strike": {  # radius-2 ring: tilt back, swing through, close ring
        "windup": [
            (0.3, {"swing": -4, "core": 1.5, "plateL": -6, "plateR": -4, "sockets": 0.5}, "out"),
            (0.7, {"swing": -10, "core": 2.0, "plateL": -14, "plateR": -10, "sockets": 1.2, "y": -2}, "in-out"),
            (1.0, {"swing": -14, "core": 2.6, "plateL": -18, "plateR": -14, "sockets": 2.0, "y": -3}, "out3"),
        ],
        "active": [
            (0.25, {"swing": 2, "ring": 0.2, "plateL": -4, "plateR": 2, "y": -1}, "in"),
            (0.5, {"swing": 10, "ring": 0.45, "ring2": 0.15, "plateL": 12, "plateR": 16, "y": 0}, "linear"),
            (0.75, {"swing": 12, "ring": 0.65, "ring2": 0.35, "plateL": 16, "plateR": 20}, "out"),
            (1.0, {"swing": 11, "ring": 0.8, "ring2": 0.5, "plateL": 14, "plateR": 18, "core": 1.8}, "out"),
        ],
        "recovery": [
            (0.4, {"swing": -4, "ring": 0, "ring2": 0, "plateL": -6, "plateR": -8, "core": 1.4, "sockets": 1.0}, "out"),
            (1.0, settle(BELL_N, "swing", "plateL", "plateR", "core", "sockets", "y"), "settle"),
        ],
    },
    "signature": {  # radius-4 ring: sockets light in a square sequence, plates swing wide, the core swells
        "windup": [
            (0.25, {"sockets": 1.0, "core": 1.4, "plateL": -8, "plateR": 8, "swing": -2}, "out"),
            (0.5, {"sockets": 2.0, "core": 1.9, "plateL": -14, "plateR": 14, "swing": 2, "y": -2}, "out"),
            (0.75, {"sockets": 3.0, "core": 2.4, "plateL": -20, "plateR": 20, "swing": -2, "y": -3}, "out"),
            (1.0, {"sockets": 4.0, "core": 3.0, "plateL": -24, "plateR": 24, "swing": 0, "y": -4}, "out"),
        ],
        "active": [
            (0.25, {"ring": 0.3, "ring2": 0.05, "swing": 4, "plateL": -10, "plateR": 10}, "in"),
            (0.5, {"ring": 0.6, "ring2": 0.3, "swing": 6, "plateL": 4, "plateR": -4, "y": -2}, "linear"),
            (0.75, {"ring": 0.85, "ring2": 0.55, "swing": 5, "plateL": 10, "plateR": -10}, "out"),
            (1.0, {"ring": 1.0, "ring2": 0.75, "swing": 4, "plateL": 12, "plateR": -12, "core": 2.2}, "out"),
        ],
        "recovery": [
            (0.4, {"ring": 0, "ring2": 0, "sockets": 2.0, "core": 1.6, "swing": -2, "plateL": -4, "plateR": 4, "y": -1}, "out"),
            (1.0, settle(BELL_N, "sockets", "core", "swing", "plateL", "plateR", "y"), "settle"),
        ],
    },
    "stagger": [
        (0.0, {"crack": 1.0, "swing": -8, "core": 0.2, "plateL": -20, "plateR": -16, "x": -2}, "linear"),
        (0.15, {"crack": 0.9, "swing": -13, "core": 0.0, "plateL": -26, "plateR": -22, "x": -4}, "out5"),
        (0.4, {"crack": 0.6, "swing": 9, "core": 0.6, "plateL": 18, "plateR": 22, "x": -5, "y": 3}, "in-out"),
        (0.7, {"crack": 0.4, "swing": -5, "core": 0.4, "plateL": -8, "plateR": -6, "x": -4, "y": 3}, "in-out"),
        (1.0, settle(BELL_N, "crack", "swing", "core", "plateL", "plateR", "x", "y"), "settle"),
    ],
    "transition": [
        (0.0, {}, "linear"),
        (0.2, {"sockets": 1.0, "core": 1.6, "swing": -3}, "out"),
        (0.4, {"sockets": 2.0, "core": 2.2, "swing": 3, "brk": 0.5}, "out"),
        (0.6, {"sockets": 4.0, "core": 3.0, "plateL": -24, "plateR": 24, "swing": 0, "brk": 1, "y": -4, "ring2": 0.3}, "out"),
        (1.0, {"sockets": 1.0, "core": 1.4, "plateL": -2, "plateR": 2, "swing": 0, "brk": 0.2, "y": 0, "ring2": 0}, "in-out"),
    ],
    "defeat": [
        (0.0, {"core": 2.0, "sockets": 4.0, "crack": 0.6, "swing": -6}, "linear"),
        (0.3, {"core": 1.2, "sockets": 2.5, "crack": 0.9, "swing": 6, "collapse": 0.2, "plateL": 10, "plateR": -8}, "out"),
        (0.65, {"core": 0.6, "sockets": 1.0, "crack": 1.0, "swing": 4, "collapse": 0.65, "plateL": 30, "plateR": -26}, "in-out"),
        (1.0, {"core": 0.0, "sockets": 0.0, "crack": 1.0, "swing": 2, "collapse": 1.0, "plateL": 40, "plateR": -36}, "out"),
    ],
}
SECONDARY["yearless-bell"] = chain(
    trailing("plateL", lambda p: p["swing"] + p["x"], gain=-2.2, limit=26),
    trailing("plateR", lambda p: p["swing"] + p["x"], gain=-2.6, limit=26, stiffness=0.25),
)
