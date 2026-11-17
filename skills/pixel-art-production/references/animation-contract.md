# Pixel-animation contract

Use this contract for action clips, sprite sheets, GIF previews, and runtime atlases.

## Frame standard (20-30 unique frames per cycle)

Every clip that loops or plays as a unit has **20-30 unique frames**: idle,
locomotion (walk, run, hover, drift), each attack cycle, hit/stagger, phase
transition, and defeat.

- **Unique** means a distinct alpha-trimmed RGBA image. Uniqueness is
  translation-invariant: sliding the whole sprite by a pixel does not make a new
  frame, and neither does a hold.
- **Holds do not count.** Repeat a frame (or give it a larger duration weight)
  to hold a key; the hold adds time, not unique frames.
- A loop has no duplicated end frame: frame N-1 flows into frame 0.
- `anim_sheet.build_character` refuses any clip outside 20-30 unique frames,
  and `game/animation-clip-runtime.mjs` rejects such a manifest at load time.

## Attacks: three bands aligned to the simulation

An attack clip is authored as three contiguous bands that match the kernel's
attack phases: **wind-up**, **active**, **recovery**. The bands together hold
20-30 unique frames (the boss pilot uses 10-16 / 4 / 10).

The renderer never plays an attack by wall-clock time. It samples the band of
the simulation's current phase by that phase's progress fraction
(`sampleAttackPhase(prepared, clip, phase, progress)`). Frame durations inside
a band are relative weights. The consequences:

- the first active frame is on screen exactly when the kernel enters `active`,
  whatever wind-up length gameplay tuning chooses;
- a retuned attack (220 ms or 600 ms wind-up) keeps its authored spacing;
- weight the last wind-up frames (1.25, 1.5, 2) to hold the peak tell.

Tag events on frames: `windupStart` (first wind-up frame), `telegraphPeak` (last
wind-up frame, also the band's key frame), `activeStart`, `hit` (inside the
active band), `recoveryStart`, `complete`. Events are a visual audit map; the
kernel remains the authority for damage, hitboxes, and cooldowns.

Signature or command attacks get their own clip with a **distinct tell**: a
silhouette change no ordinary strike makes (a raised case and order banner, a
crescent gathering overhead, sockets lighting in sequence). Reduced motion
shows each band's key frame, so the tell always reads.

## Craft

- **Easing:** key the wind-up slow-in to the peak (`out3`), the strike fast
  (`in`/`linear`, two to four frames), and the recovery as a cushioned settle.
  `anim_timeline.EASINGS` includes `in-back` (anticipation dip), `out-back`
  (follow-through overshoot), and `settle` (damped landing).
- **Anticipation:** the peak wind-up pose moves weight and weapon opposite the
  strike and changes the silhouette at 1x; a glint (`spark`) or glow step marks
  the peak.
- **Smears:** one or two active frames may carry a hard-edged, in-palette smear
  along the weapon arc (`Masks.arc_band`). No alpha, no blur.
- **Secondary motion:** cloth, hair, ribbons, chains, tails, and plates trail
  the body through a damped spring (`anim_timeline.follow_through`), not by
  hand-tuned offsets.
- **Holds:** hold keys with duration weights or repeated frames; holds read as
  intent and never count toward the standard.

## Geometry

Define before authoring:

- native frame width and height (the logical cell);
- grid columns and rows, or trimmed packing (below);
- pivot and foot point;
- minimum transparent gutter;
- facing convention (`nativeFacing` in the manifest);
- root-motion ownership;
- weapon and VFX overflow policy.

All frame rectangles must be integer-aligned. Review previews must use integer nearest-neighbor scaling.

## Per-character sheets and manifest

One character, one manifest (`bbc-animation-clips/1`), one or more sheets:

- sheets are at most **4096 px wide**; frames are trimmed to their alpha bounds
  plus a one-pixel transparent ring and shelf-packed in clip order; rows wrap,
  and a further sheet starts after 4096 px of height;
- identical frames (same pixels at the same offset) share one rectangle;
- the manifest lists `clips -> frames`, and every frame entry carries `sheet`,
  `rect [x, y, w, h]`, `pivot` (the shared foot point in rect coordinates),
  `durationMs`, optional `band`, `events`, `key`, and a 16-hex `hash` of its
  trimmed pixels;
- attack clips carry `bands: [{name, start, count, key}]`; every clip carries
  `kind` (`loop`, `attack`, `progress`, `oneshot`), `keyFrames`, `uniqueFrames`;
- sheets record exact `width`, `height`, `sha256`, `bytes`, and `decodedBytes`.
  The runtime refuses an image whose natural size differs;
- optional: `attackClips` (kernel attack id -> clip), `phaseForms` (boss phase
  id -> form) with form variants named `clip@form`.

Example (abridged):

```json
{
 "schema": "bbc-animation-clips/1",
 "characterId": "mateus",
 "nativeFacing": "right",
 "logicalFrame": [232, 160],
 "footPoint": [116, 148],
 "sheets": [{"path": "mateus.png", "width": 4050, "height": 536, "sha256": "...", "decodedBytes": 8683200}],
 "clips": [
  {"id": "strike", "kind": "attack", "loop": false, "uniqueFrames": 26,
   "bands": [{"name": "windup", "start": 0, "count": 12, "key": 11},
             {"name": "active", "start": 12, "count": 4, "key": 13},
             {"name": "recovery", "start": 16, "count": 10, "key": 25}],
   "frames": [{"sheet": 0, "rect": [0, 0, 61, 97], "pivot": [27, 93], "durationMs": 38,
               "band": "windup", "events": ["windupStart"], "hash": "1f0c..."}]}
 ]
}
```

## Provenance

The lane rules in `provenance-contract.md` apply unchanged.

- Code-authored builders that rasterize keyed pose parameters with integer
  primitives (`anim_primitives`) stay **pixel-authored**.
- Raster-derived clips stay labelled by their source lane. The cut-out rig
  (`anim_rig`) re-renders source pixels; its output inherits the source lane:
  `deterministically-pixelified` becomes `deterministically-pixelified
  (rig-posed)`; `pixel-authored` becomes `pixel-authored (rig-posed)`. Never
  relabel rig output as hand-pixeled.
- Record the lane in the manifest's `provenance.lane`.

## Toolkit (`skills/pixel-art-production/scripts/`)

Pillow only, deterministic. `anim_timeline`, `anim_primitives`, and `anim_sheet`
run a self-test with `--check` (`anim_rig.py --self-test`). Every writer
(`anim_rig.py --spec`, `anim_preview.py`, the boss builders) exposes `--check`
(byte identity, no writes) through `anim_sheet.write_or_check`. Keep sources
LF: builders hash their own source.

| Module | Use it for |
| --- | --- |
| `anim_timeline.py` | Pose-parameter keyframes: `Timeline.from_poses`, `Track`, `EASINGS`, `band_times`, `loop_times`, `wave`, `follow_through`, `velocity_of`, `weights_to_durations`, `expand_holds`. |
| `anim_primitives.py` | Code-authored drawing: `Canvas` (palette-only paint, `part` shading, 4-connected `outline`), `Masks` (`poly`, `capsule`, `taper`, `stroke`, `ellipse`, `arc_band` smears), `Xf` transforms, `limb_point` (0 down, 90 forward, 180 up). |
| `anim_rig.py` | Raster cut-out rig: `cut_part` (rect or polygon slices with pivots), `Rig` (hierarchical transforms, joint caps, optional orphan prune and pinhole fill, ink re-outline), `two_part_rig` (waist-bend moving holds for one key), RotSprite-style sampling (Scale2x x3, then nearest-neighbour). Spec CLI: `--spec rig.json --out-dir DIR [--review-dir DIR] [--check]`. |
| `anim_sheet.py` | `Frame`, `Clip`, `build_character` (standard check, trim, dedupe, shelf pack, manifest), `validate_manifest`, `write_or_check`. CLI: `--validate manifest.json`. |
| `anim_preview.py` | Review only: `contact_sheet`, `frame_strip`, `onion_skin`, `motion_gif`. CLI: `--manifest M --out-dir DIR [--check]`. |

### Worked example 1: a code-authored party member

```python
import sys; sys.path.insert(0, "skills/pixel-art-production/scripts")
from anim_primitives import Canvas, limb_point
from anim_sheet import Clip, Frame, build_character, write_or_check
from anim_timeline import Timeline, band_times, loop_times, wave

NEUTRAL = {"lean": 0, "arm": 20, "spear": 30}

def draw(p):  # one frame from one pose
    c = Canvas((96, 96), PALETTE, origin=(24, 16))
    hand = limb_point((30, 30), 14, p["arm"] + p["lean"])
    c.part(c.m.capsule((30, 30), hand, 3), "body", "deep", "light", ring="ink")
    c.part(c.m.taper(hand, limb_point(hand, 30, p["spear"]), 3, 1), "metal", ring="ink")
    c.outline("ink")
    return c.image

idle = [dict(NEUTRAL, lean=wave(t, 1, 0, 1.5), arm=20 + wave(t, 1, 0.3, 4)) for t in loop_times(24)]
thrust = Timeline.from_poses([(0, NEUTRAL), (0.6, {"arm": -40, "spear": 80}, "in-out"),
                              (1, {"arm": -55, "spear": 88}, "out3")], defaults=NEUTRAL)
windup = [Frame(draw(thrust.sample(t)), 40, band="windup") for t in band_times(12)]
# ...active (4 frames) and recovery (10 frames) the same way, from the previous band's end pose
build = build_character("ren", [Clip("idle", "loop", [Frame(draw(p), 70) for p in idle]),
                                Clip("thrust", "attack", windup + active + recovery)],
                        logical_size=(96, 96), foot_point=(48, 88), sheet_basename="ren-combat",
                        provenance={"lane": "pixel-authored"})
raise SystemExit(write_or_check({out / name: data for name, data in build.outputs().items()}, check))
```

Run secondary motion (`follow_through` over `velocity_of` a driver) across the
whole clip before drawing, so cloaks trail the body. The full reference is
`assets/art/boss-animation-suite-v2/` (rigs, casts, shared motion, a builder
with `--jobs` that holds one character in memory per worker).

### Worked example 2: a raster enemy (pixelified) through the rig

Write a spec beside the enemy's atlas and run `python anim_rig.py --spec`:

```json
{
 "id": "cinder-hound", "sourceLane": "deterministically-pixelified",
 "source": "enemy-combat-animation-atlas-v1.png", "sourceRect": [0, 0, 160, 160],
 "cell": [160, 160], "footPoint": [80, 151], "nativeFacing": "left",
 "parts": [
  {"name": "body", "rect": [30, 60, 100, 60], "pivot": [80, 120]},
  {"name": "head", "polygon": [[20, 50], [60, 45], [64, 90], [24, 92]], "pivot": [58, 74], "parent": "body", "z": 2, "cap": 3},
  {"name": "tail", "rect": [110, 50, 40, 40], "pivot": [112, 80], "parent": "body", "z": 0, "cap": 2}
 ],
 "clips": [
  {"id": "idle", "kind": "loop", "frames": 24, "durationMs": 70,
   "keys": [{"t": 0, "pose": {"head": {"angle": 0}}}],
   "waves": [{"param": "head.angle", "amplitude": 3}, {"param": "tail.angle", "amplitude": 8, "phase": 0.3},
             {"param": "body.dy", "amplitude": 1, "cycles": 2}]},
  {"id": "bite", "kind": "attack", "bands": {
    "windup": {"frames": 12, "keys": [{"t": 0, "pose": {}}, {"t": 1, "pose": {"root": {"dx": 6}, "head": {"angle": 12}}, "ease": "out3"}]},
    "active": {"frames": 4, "keys": [{"t": 0, "pose": {"root": {"dx": 6}}}, {"t": 1, "pose": {"root": {"dx": -10}, "head": {"angle": -8}}, "ease": "in"}]},
    "recovery": {"frames": 10, "keys": [{"t": 0, "pose": {"root": {"dx": -10}}}, {"t": 1, "pose": {}, "ease": "settle"}]}}}
 ]
}
```

Slice parts so they overlap their parent 2-4 px past the joint and give each
child a `cap` (joint patch radius). Keep rotations small (under about 15
degrees per part) and check the onion skin for seams. Where a source has
several keys (the Kurozane kits), render each key through `two_part_rig` and
fill between keys with moving holds; see
`assets/art/kurozane-boss-clips-v2/build_kurozane_boss_clips_v2.py`. Normalise
each source row to one sole line first: kit rows rarely share a ground row.

### Worked example 3: a field walk cycle

A field walk is a locomotion loop: 24 frames per direction, contact / down /
passing / up twice, foot contacts on the movement cadence.

- Code-authored (32 x 48 party field sprites): key the foot offsets with
  `cos(2 pi t)`, lift with `max(0, -sin(2 pi t))`, bob on `cos(4 pi t)`, swing the
  arms in counter-phase, and run a cloak `follow_through` over `velocity_of` the
  bob (see `boss_motion_v2.humanoid_walk`).
- Raster (existing field frames): slice the legs as polygon parts pivoting at
  the hips, swing them +/-10 degrees in opposite phase, bob the torso part, and
  render 24 phases through `Rig`.
- Package the four facings as clips `walk@north` ... `walk@west` in one manifest;
  mirror only where the animation bible allows it.

## Runtime (`game/animation-clip-runtime.mjs`)

DOM-free. `validateAnimationManifest(m, {requiredClips, expectedCharacterId})`
returns `{ok, errors}`; `prepareAnimationManifest` freezes and indexes it.
`sampleClipAtTime` (loops wrap, one-shots hold), `sampleClipAtProgress`
(gameplay-timed stagger, transition, defeat), `sampleAttackPhase` (bands), and
`animationDrawPlacement` (pivot anchoring and native-facing flip).
`createAnimationSheetLoader({resolveManifestUrl, fetchJson, createImage})`
fetches one character's manifest and only its own sheets on `request(id)`;
states are `unrequested`, `loading`, `ready`, `unavailable`, `invalid`, and
`wrong-size`, and `get(id)` returns a record only when `ready`, so callers keep
their existing fallback for every other state. Reduced motion: loops hold
their first key frame, attack bands show their key frame, and progress clips
step through key frames only.

## Action phases

Movement clips should expose contact, compression, passing, and airborne or extension phases.

Attacks should expose:

1. anticipation or wind-up;
2. commitment;
3. active contact frame;
4. recoil or follow-through;
5. recovery.

Record the exact damage-event frame separately from the artwork. A large VFX frame must still preserve the attacker silhouette unless an authored full-screen effect explicitly owns the shot.

## Consistency

Check across every frame:

- identity, proportions, costume, palette, and facing;
- weapon length, grip, and motion arc;
- foot placement relative to the pivot;
- body volume through squash and stretch;
- hair, cloth, chain, and ribbon follow-through;
- no neighboring-cell bleed;
- readable pose at 1x without labels.

## Runtime evidence

Store in a manifest:

- action and frame order;
- frame durations;
- pivot, foot point, hit anchor, and hurt bounds;
- wind-up, active, and recovery phases;
- event name and frame index;
- source and frame hashes;
- atlas dimensions and alpha policy.

GIFs are review artifacts. They do not replace runtime timing, hitbox, root-motion, or event data.
