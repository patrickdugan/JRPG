#!/usr/bin/env python3
"""Shared motion for v2 boss performances: loops, secondary motion, and clip templates.

A performance (see ``boss_cast_*_v2``) is a dict:

* ``rig``: rig id in ``boss_rigs_v2.RIGS``; ``style``: rig options and draw hooks;
* ``neutral``: the rest pose every clip starts from;
* ``idle`` / ``locomotion``: ``f(t) -> pose`` for t in [0, 1) (seamless loops);
* ``strike`` / ``signature``: ``{"windup": keys, "active": keys, "recovery": keys}``;
* ``stagger`` / ``transition`` / ``defeat``: keys, the first entry at t=0.

Keys are ``(t, pose_delta, ease_arriving_at_this_key)`` on the band's own
normalized 0..1 time. Each attack band starts from the previous band's final
pose, so wind-up, strike, and recovery chain without pops. Angles follow the
toolkit convention: 0 down, 90 forward (screen-right), 180 up, -90 back;
weapon angles are continuous (an overhead cut runs -160 -> -300).
"""

from __future__ import annotations

import math

from anim_timeline import follow_through, velocity_of
from boss_rigs_v2 import clamp, rnd, wave


def humanoid_idle(neutral: dict, amp: float = 1.0, extra=None):
    """Weighted boss breathing idle: chest, shoulders, weapon drift, hem wave.

    Each part runs on its own phase so every one of the 24 frames differs in
    content (no frame is a translated copy of another).
    """
    def pose(t):
        p = dict(neutral)
        p["breath"] = rnd(1 + wave(t, 1, 0, 1.0 * amp))
        p["lean"] = neutral["lean"] + wave(t, 1, 0.12, 1.4 * amp)
        p["fa"] = neutral["fa"] + wave(t, 1, 0.3, 4 * amp)
        p["fe"] = neutral["fe"] + wave(t, 1, 0.42, 5 * amp)
        p["ba"] = neutral["ba"] + wave(t, 1, 0.58, 4 * amp)
        p["be"] = neutral["be"] + wave(t, 1, 0.7, 4 * amp)
        p["wpn"] = neutral["wpn"] + wave(t, 1, 0.36, 7 * amp)
        p["head"] = neutral["head"] + wave(t, 1, 0.05, 3 * amp)
        p["crouch"] = neutral["crouch"] + wave(t, 2, 0.25, 0.8 * amp)
        p["wave"] = t
        if extra:
            p.update(extra(t, p))
        return p
    return pose


def humanoid_walk(neutral: dict, stride: float = 11, lift: float = 5, swing: float = 14, extra=None):
    """Two-step heavy walk: contact, down, passing, up, mirrored; arms counter-swing."""
    def pose(t):
        p = dict(neutral)
        c = math.cos(2 * math.pi * t)
        s = math.sin(2 * math.pi * t)
        p["ff"] = rnd(stride * c + 1)
        p["bf"] = rnd(-stride * c - 1)
        p["fl"] = rnd(lift * max(0.0, -s))
        p["bl"] = rnd(lift * max(0.0, s))
        p["crouch"] = neutral["crouch"] + rnd(1.5 + 1.6 * math.cos(4 * math.pi * t - 0.6))
        p["lean"] = neutral["lean"] + 4 + wave(t, 2, 0.1, 1.2)
        p["fa"] = neutral["fa"] - swing * c
        p["ba"] = neutral["ba"] + swing * c
        p["fe"] = neutral["fe"] + wave(t, 1, 0.2, 6)
        p["be"] = neutral["be"] + wave(t, 1, 0.7, 6)
        p["wpn"] = neutral["wpn"] - swing * 0.8 * c + 6
        p["head"] = neutral["head"] + wave(t, 2, 0.35, 2)
        p["coat"] = rnd(3 + wave(t, 2, -0.15, 1.5))
        p["wave"] = rnd(t * 2)
        if extra:
            p.update(extra(t, p))
        return p
    return pose


def humanoid_secondary(poses: list, loop: bool) -> list:
    """Coat hem trails root motion and lean (damped spring follow-through)."""
    drive = [rnd(v * 1.4) for v in velocity_of([p["x"] + p["lean"] * 0.35 for p in poses], loop)]
    trail = follow_through(drive, stiffness=0.35, damping=0.32, loop=loop)
    out = []
    for p, extra in zip(poses, trail):
        q = dict(p)
        q["coat"] = rnd(p.get("coat", 0) + clamp(extra, -6, 6))
        out.append(q)
    return out


def trailing(param: str, driver, gain: float = 1.0, stiffness: float = 0.3, damping: float = 0.3, limit: float = 30):
    """Secondary-motion pass factory: ``param`` += spring response to the velocity of ``driver(pose)``."""
    def apply(poses: list, loop: bool) -> list:
        drive = [rnd(v * gain) for v in velocity_of([driver(p) for p in poses], loop)]
        trail = follow_through(drive, stiffness=stiffness, damping=damping, loop=loop)
        return [{**p, param: rnd(p.get(param, 0) + clamp(v, -limit, limit))} for p, v in zip(poses, trail)]
    return apply


def chain(*passes):
    def apply(poses: list, loop: bool) -> list:
        for item in passes:
            poses = item(poses, loop)
        return poses
    return apply


def humanoid_stagger(neutral: dict, fling: float = -98, daze: float = 6, extra=None) -> list:
    """Poise break: snap back, stumble a step, doubled-over daze, recover to guard."""
    e = extra or {}
    return [
        (0.0, {"lean": -16, "head": -14, "hx": -3, "fa": -30, "fe": 10, "ba": -60, "be": 5, "wpn": fling + 38,
               "x": -3, "crouch": 2, "flare": 3, **e.get("impact", {})}, "linear"),
        (0.12, {"lean": -21, "head": -18, "hx": -4, "fa": -58, "ba": -82, "wpn": fling, "x": -6, "crouch": 3,
                "bf": -17, "ff": 6, **e.get("fling", {})}, "out5"),
        (0.36, {"lean": 7, "head": 18, "hx": 0, "fa": 6, "fe": 22, "ba": -18, "wpn": daze - 4, "x": -7,
                "crouch": 8, "bf": -16, "ff": 4, **e.get("daze", {})}, "in-out"),
        (0.72, {"lean": 12, "head": 21, "fa": 12, "fe": 18, "wpn": daze + 6, "x": -6, "crouch": 9, "bf": -14,
                "ff": 5, **e.get("hold", {})}, "in-out"),
        (1.0, {**{k: neutral[k] for k in ("lean", "head", "fa", "fe", "ba", "be", "wpn", "ff", "bf")},
               "x": 0, "crouch": 1, "flare": 0, "hx": 0, **e.get("end", {})}, "in-out"),
    ]


def humanoid_defeat(start_wpn: float = -40, extra=None) -> list:
    """Non-lethal resolution: knees give, weapon leaves the hand and rests on the floor."""
    e = extra or {}
    return [
        (0.0, {"lean": -10, "head": -10, "fa": -20, "wpn": start_wpn, "crouch": 2, **e.get("start", {})}, "linear"),
        (0.25, {"lean": 14, "head": 14, "crouch": 8, "fa": 20, "fe": 30, "wpn": start_wpn + 60, "kneel": 0.3,
                "bf": -12, **e.get("buckle", {})}, "out"),
        (0.6, {"lean": 18, "head": 22, "crouch": 14, "kneel": 0.8, "fa": 40, "fe": 40, "drop": 0.6, "ff": 10,
               "bf": -17, "ba": 10, "be": 30, **e.get("fall", {})}, "in-out"),
        (1.0, {"lean": 10, "head": 26, "crouch": 16, "kneel": 1.0, "fa": 10, "fe": 20, "ba": 5, "be": 25, "drop": 1.0,
               "ff": 11, "bf": -18, **e.get("rest", {})}, "out"),
    ]


def settle_to(neutral: dict, keys=("lean", "fa", "fe", "wpn", "ba", "be", "ff", "bf", "head"), **extra) -> dict:
    """Recovery end pose: the neutral values of ``keys`` plus overrides."""
    return {**{k: neutral[k] for k in keys}, **extra}
