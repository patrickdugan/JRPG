#!/usr/bin/env python3
"""Pose-parameter keyframing for code-authored pixel animation.

A *pose* is a flat ``dict[str, float]`` of named rig parameters (root offset,
lean, limb angles, prop states, glow steps, ...). A builder authors a handful
of key poses, places them on a normalized 0..1 timeline with an easing per
segment, and samples one pose per frame. The builder then rasterizes each
sampled pose with integer-rounded primitives, so every pixel stays
code-authored at native resolution.

Everything here is deterministic: trigonometry is rounded to 9 decimals and
there is no randomness, wall-clock time, or platform-dependent state.

Typical use::

    from anim_timeline import Timeline, band_times, loop_times, wave

    strike = Timeline.from_poses(
        [(0.0, NEUTRAL, "in-out"), (0.45, LOAD, "in"), (1.0, PEAK, "out")],
        defaults=NEUTRAL,
    )
    windup = [strike.sample(t) for t in band_times(12)]

Run ``python anim_timeline.py --check`` to execute the module self-test.
"""

from __future__ import annotations

import argparse
import math
from typing import Callable, Iterable, Mapping, Sequence

Pose = dict[str, float]

_DIGITS = 9


def rnd(value: float) -> float:
    """Round a float to the module's deterministic precision."""
    return round(float(value), _DIGITS)


def ri(value: float) -> int:
    """Round half away from zero to an integer pixel coordinate."""
    return int(math.floor(value + 0.5)) if value >= 0 else -int(math.floor(-value + 0.5))


def sin_d(degrees: float) -> float:
    return rnd(math.sin(math.radians(degrees)))


def cos_d(degrees: float) -> float:
    return rnd(math.cos(math.radians(degrees)))


def clamp01(t: float) -> float:
    return 0.0 if t <= 0 else 1.0 if t >= 1 else float(t)


# ---------------------------------------------------------------------------
# Easing. Every curve maps 0 -> 0 and 1 -> 1. "back" curves overshoot or dip,
# which is how anticipation (in-back) and follow-through (out-back) are keyed.
# ---------------------------------------------------------------------------

_BACK = 1.70158

EASINGS: dict[str, Callable[[float], float]] = {
    "linear": lambda t: t,
    "hold": lambda t: 0.0 if t < 1.0 else 1.0,  # step: keep the left key until the next key
    "in": lambda t: t * t,
    "out": lambda t: 1.0 - (1.0 - t) * (1.0 - t),
    "in-out": lambda t: 2.0 * t * t if t < 0.5 else 1.0 - 2.0 * (1.0 - t) * (1.0 - t),
    "in3": lambda t: t * t * t,
    "out3": lambda t: 1.0 - (1.0 - t) ** 3,
    "in-out3": lambda t: 4.0 * t ** 3 if t < 0.5 else 1.0 - 4.0 * (1.0 - t) ** 3,
    "out5": lambda t: 1.0 - (1.0 - t) ** 5,  # very fast attack, long cushion: strike frames
    "sine": lambda t: 0.5 - 0.5 * math.cos(math.pi * t),
    "in-back": lambda t: t * t * ((_BACK + 1.0) * t - _BACK),
    "out-back": lambda t: 1.0 + (t - 1.0) ** 2 * ((_BACK + 1.0) * (t - 1.0) + _BACK),
    "settle": lambda t: 1.0 - math.cos(t * math.pi * 2.5) * math.exp(-5.0 * t) * (1.0 - t),
}


def ease(name: str, t: float) -> float:
    """Apply a named easing curve to ``t`` (clamped to 0..1)."""
    try:
        curve = EASINGS[name]
    except KeyError as error:
        raise KeyError(f"Unknown easing {name!r}; choose from {sorted(EASINGS)}") from error
    t = clamp01(t)
    if t in (0.0, 1.0) and name != "hold":
        return t
    return rnd(curve(t))


def lerp(a: float, b: float, u: float) -> float:
    return rnd(a + (b - a) * u)


def lerp_pose(a: Mapping[str, float], b: Mapping[str, float], u: float) -> Pose:
    """Interpolate the union of two poses; a missing parameter holds the other side."""
    keys = sorted(set(a) | set(b))
    return {key: lerp(a.get(key, b.get(key, 0.0)), b.get(key, a.get(key, 0.0)), u) for key in keys}


# ---------------------------------------------------------------------------
# Tracks and timelines
# ---------------------------------------------------------------------------


class Track:
    """One parameter keyed on a normalized timeline.

    ``keys`` is a sequence of ``(t, value)`` or ``(t, value, ease)``. The ease
    on a key shapes the segment that *leaves* that key. Sampling before the
    first key or after the last key holds the end value.
    """

    def __init__(self, keys: Sequence[tuple]):
        if not keys:
            raise ValueError("A track needs at least one key")
        parsed = []
        for key in keys:
            t, value = float(key[0]), float(key[1])
            curve = key[2] if len(key) > 2 else "in-out"
            if curve not in EASINGS:
                raise KeyError(f"Unknown easing {curve!r}")
            parsed.append((t, value, curve))
        times = [item[0] for item in parsed]
        if times != sorted(times):
            raise ValueError(f"Track keys must be time-ordered: {times}")
        self.keys = parsed

    def sample(self, t: float) -> float:
        keys = self.keys
        if t <= keys[0][0]:
            return keys[0][1]
        for (t0, v0, curve), (t1, v1, _) in zip(keys, keys[1:]):
            if t <= t1:
                span = t1 - t0
                u = 1.0 if span <= 0 else (t - t0) / span
                return lerp(v0, v1, ease(curve, u))
        return keys[-1][1]


class Timeline:
    """A bundle of named tracks plus constant defaults, sampled as one pose."""

    def __init__(self, tracks: Mapping[str, Track | Sequence[tuple]] | None = None,
                 defaults: Mapping[str, float] | None = None):
        self.defaults = {key: float(value) for key, value in (defaults or {}).items()}
        self.tracks = {
            name: track if isinstance(track, Track) else Track(track)
            for name, track in (tracks or {}).items()
        }

    @classmethod
    def from_poses(cls, keyed_poses: Sequence[tuple], defaults: Mapping[str, float] | None = None) -> "Timeline":
        """Build tracks from ``(t, pose)`` or ``(t, pose, ease)`` key poses.

        Each key pose may name only the parameters it changes; omitted values
        carry forward from the previous key (or ``defaults`` for the first).
        """
        defaults = dict(defaults or {})
        names = sorted(set(defaults).union(*(set(item[1]) for item in keyed_poses)))
        running = dict(defaults)
        resolved = []
        for item in keyed_poses:
            t, pose = item[0], item[1]
            curve = item[2] if len(item) > 2 else "in-out"
            running = {**running, **pose}
            resolved.append((t, dict(running), curve))
        tracks = {}
        for name in names:
            tracks[name] = Track([(t, pose.get(name, defaults.get(name, 0.0)), curve) for t, pose, curve in resolved])
        return cls(tracks, defaults)

    def sample(self, t: float) -> Pose:
        pose = dict(self.defaults)
        for name, track in self.tracks.items():
            pose[name] = track.sample(t)
        return pose

    def sample_many(self, times: Iterable[float]) -> list[Pose]:
        return [self.sample(t) for t in times]


def overlay(base: Mapping[str, float], *layers: Mapping[str, float]) -> Pose:
    """Add parameter offsets (``layers``) onto a base pose. Use for loops on top of holds."""
    pose = dict(base)
    for layer in layers:
        for key, value in layer.items():
            pose[key] = rnd(pose.get(key, 0.0) + value)
    return pose


# ---------------------------------------------------------------------------
# Frame schedules
# ---------------------------------------------------------------------------


def loop_times(count: int) -> list[float]:
    """``count`` evenly spaced phases in [0, 1) for a seamless loop (no repeated end frame)."""
    if count < 1:
        raise ValueError("count must be positive")
    return [rnd(index / count) for index in range(count)]


def band_times(count: int, include_start: bool = False, include_end: bool = True) -> list[float]:
    """Sample positions for one band of a one-shot clip.

    By default the band *ends exactly on its last key* (t=1) and starts one
    step after t=0, so consecutive bands do not duplicate their shared key.
    """
    if count < 1:
        raise ValueError("count must be positive")
    if include_start and include_end:
        return [0.0] if count == 1 else [rnd(index / (count - 1)) for index in range(count)]
    if include_start:
        return [rnd(index / count) for index in range(count)]
    if include_end:
        return [rnd((index + 1) / count) for index in range(count)]
    return [rnd((index + 0.5) / count) for index in range(count)]


def weights_to_durations(weights: Sequence[float], total_ms: int) -> list[int]:
    """Distribute ``total_ms`` integer milliseconds proportionally to ``weights`` (exact sum)."""
    if not weights or total_ms < len(weights):
        raise ValueError("Need at least one millisecond per frame")
    scale = sum(weights)
    raw = [w * total_ms / scale for w in weights]
    out = [max(1, int(math.floor(value))) for value in raw]
    remainder = total_ms - sum(out)
    order = sorted(range(len(raw)), key=lambda i: (-(raw[i] - math.floor(raw[i])), i))
    index = 0
    while remainder != 0:
        target = order[index % len(order)]
        step = 1 if remainder > 0 else -1
        if out[target] + step >= 1:
            out[target] += step
            remainder -= step
        index += 1
    return out


# ---------------------------------------------------------------------------
# Secondary motion
# ---------------------------------------------------------------------------


def wave(t: float, cycles: float = 1.0, phase: float = 0.0, amplitude: float = 1.0) -> float:
    """Deterministic sine on a normalized loop: ``amplitude * sin(2pi (cycles*t + phase))``."""
    return rnd(amplitude * math.sin(2.0 * math.pi * (cycles * t + phase)))


def follow_through(drivers: Sequence[float], stiffness: float = 0.3, damping: float = 0.3,
                   gain: float = 1.0, loop: bool = False, warmup_cycles: int = 2) -> list[float]:
    """Damped spring that trails ``drivers`` (one value per frame).

    Returns the lagging, overshooting response used for cloth, hair, chains,
    ribbons, and tails. ``loop=True`` runs the spring over extra cycles first
    so the result is periodic (frame 0 continues frame N-1 seamlessly).
    """
    if not drivers:
        return []
    values = [float(v) * gain for v in drivers]
    position = values[0]
    velocity = 0.0
    sequence = values * (warmup_cycles + 1) if loop else values
    out: list[float] = []
    for target in sequence:
        velocity = (velocity + (target - position) * stiffness) * (1.0 - damping)
        position += velocity
        out.append(rnd(position))
    return out[-len(values):]


def velocity_of(values: Sequence[float], loop: bool = False) -> list[float]:
    """Per-frame first difference (the motion that drives drag on secondary parts)."""
    if not values:
        return []
    out = []
    for index, value in enumerate(values):
        if index == 0:
            prev = values[-1] if loop else value
        else:
            prev = values[index - 1]
        out.append(rnd(value - prev))
    return out


def expand_holds(frames: Sequence, holds: Mapping[int, int]) -> list:
    """Repeat frames for authored holds (``{index: extra_repeats}``). Holds never add unique frames."""
    out = []
    for index, frame in enumerate(frames):
        out.extend([frame] * (1 + int(holds.get(index, 0))))
    return out


# ---------------------------------------------------------------------------
# Self-test (also serves as an executable usage example)
# ---------------------------------------------------------------------------


def _self_test() -> None:
    for name in EASINGS:
        if name == "hold":
            assert ease(name, 0.5) == 0.0 and ease(name, 1.0) == 1.0
            continue
        assert ease(name, 0.0) == 0.0 and ease(name, 1.0) == 1.0, name
    assert ease("in-back", 0.2) < 0.0, "in-back must dip below zero (anticipation)"
    assert ease("out-back", 0.8) > 1.0, "out-back must overshoot (follow-through)"
    timeline = Timeline.from_poses(
        [(0.0, {"arm": 0, "lean": 0}), (0.5, {"arm": -60}, "in"), (1.0, {"arm": 90, "lean": 8}, "out5")],
        defaults={"arm": 0, "lean": 0, "glow": 1},
    )
    poses = timeline.sample_many(band_times(10))
    assert poses[-1]["arm"] == 90 and poses[-1]["lean"] == 8 and poses[-1]["glow"] == 1
    assert len({round(p["arm"], 3) for p in poses}) == 10
    assert loop_times(4) == [0.0, 0.25, 0.5, 0.75]
    assert band_times(4) == [0.25, 0.5, 0.75, 1.0]
    assert sum(weights_to_durations([1, 2, 1, 3], 333)) == 333
    trail = follow_through([0] + [10] * 10)
    assert trail[1] < 10 and max(trail) > 10, "spring must lag then overshoot"
    periodic = follow_through([wave(t, amplitude=5) for t in loop_times(12)], loop=True)
    again = follow_through([wave(t, amplitude=5) for t in loop_times(12)], loop=True)
    assert periodic == again
    assert expand_holds(["a", "b"], {1: 2}) == ["a", "b", "b", "b"]
    assert ri(2.5) == 3 and ri(-2.5) == -3 and ri(2.49) == 2


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="run the deterministic self-test")
    args = parser.parse_args()
    _self_test()
    print("anim_timeline self-test passed" if args.check else "anim_timeline: library module; self-test passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
