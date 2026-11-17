#!/usr/bin/env python3
"""Build Shogun Kurozane's boss clips from the existing pixelified kits (20-30 unique frames per clip).

Sources are the two approved Kurozane kits, read only:

* ``kurozane-final-battle-v1``: court command, yearless thrust, blood-eclipse
  transform, black-chrysanthemum defeat (6 keys each);
* ``kurozane-oni-attack-suite-v1``: five Oni attacks (36 keys).

Every output frame is one kit key, normalised to a shared sole line and
re-rendered through the toolkit's two-part cut-out rig (``anim_rig.two_part_rig``:
Scale2x x3 + nearest-neighbour rotation, no new colours, binary alpha). The
keys stay the only full pose changes; rig-posed moving holds (lean toward the
next key, held-tell tremble, drive, recoil, daze, settle, breathing, stalking)
fill each clip to the 20-30 unique-frame standard. Provenance is inherited:
the output is ``deterministically-pixelified (rig-posed)``, never pixel-authored.

    python build_kurozane_boss_clips_v2.py          # write sheet, manifest, review, runtime copy
    python build_kurozane_boss_clips_v2.py --check  # byte-identical rebuild check
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
sys.path.insert(0, str(REPO / "skills" / "pixel-art-production" / "scripts"))

from PIL import Image, __version__ as PILLOW_VERSION  # noqa: E402

from anim_preview import contact_sheet, motion_gif  # noqa: E402
from anim_rig import alpha_centroid, two_part_rig  # noqa: E402
from anim_sheet import Clip, Frame, build_character, manifest_bytes, png_bytes, sha256, write_or_check  # noqa: E402
from anim_timeline import ease, rnd, weights_to_durations  # noqa: E402

SOURCE_PATH = ROOT / "kurozane-boss-clips-v2.source.json"
SOURCE = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
GEOMETRY = SOURCE["geometry"]
CELL = tuple(GEOMETRY["logicalFrame"])
SRC_CELL = tuple(GEOMETRY["sourceCell"])
OFFSET = tuple(GEOMETRY["sourceOffset"])
FOOT = tuple(GEOMETRY["footPoint"])
SOLE = GEOMETRY["soleRowInSourceCell"]
RUNTIME_DIR = REPO / "game" / "assets" / "art" / "boss-animation-suite-v2"
FORWARD = -1  # the kits face screen-left: forward is -x, a forward lean is a negative (counter-clockwise) angle


class Kits:
    """Read-only access to the kit atlases, addressed as ``kit:clip:frameIndex``."""

    def __init__(self):
        self.atlases = {}
        self.frames = {}
        self.ground = {}
        for kit_id, kit in SOURCE["kits"].items():
            self.atlases[kit_id] = Image.open(ROOT / kit["atlas"]).convert("RGBA")
            manifest = json.loads((ROOT / kit["manifest"]).read_text(encoding="utf-8"))
            for frame in manifest["combat"]["frames"]:
                self.frames[f"{kit_id}:{frame['id']}"] = (kit_id, tuple(frame["atlasRect"]))
        self._cache = {}

    def raw(self, key: str) -> Image.Image:
        kit_id, (x, y, w, h) = self.frames[key]
        return self.atlases[kit_id].crop((x, y, x + w, y + h))

    def ground_row(self, key: str) -> int:
        """Median sole row of the key's kit clip (lowest row with >= 8 opaque pixels per key)."""
        clip = key.rsplit(":", 1)[0]
        if clip not in self.ground:
            rows = []
            for name in sorted(k for k in self.frames if k.rsplit(":", 1)[0] == clip):
                alpha = self.raw(name).getchannel("A").load()
                for y in range(SRC_CELL[1] - 1, -1, -1):
                    if sum(1 for x in range(SRC_CELL[0]) if alpha[x, y]) >= 8:
                        rows.append(y)
                        break
            self.ground[clip] = int(round(statistics.median(rows)))
        return self.ground[clip]

    def cell(self, key: str) -> Image.Image:
        """The key on the logical cell, shifted so its kit clip's sole row lands on the shared sole line."""
        if key not in self._cache:
            out = Image.new("RGBA", CELL, (0, 0, 0, 0))
            out.paste(self.raw(key), (OFFSET[0], OFFSET[1] + SOLE - self.ground_row(key)))
            self._cache[key] = out
        return self._cache[key]


def clampf(value: float, limit: float) -> float:
    return max(-limit, min(limit, value))


def pose(root_angle=0.0, root_dx=0.0, root_dy=0.0, up_angle=0.0, up_dx=0.0, up_dy=0.0) -> dict:
    return {"root": {"angle": rnd(root_angle), "dx": rnd(root_dx), "dy": rnd(root_dy)},
            "upper": {"angle": rnd(up_angle), "dx": rnd(up_dx), "dy": rnd(up_dy)}}


def toward_target(kits: Kits, key: str, toward: str) -> dict:
    """How far the upper body travels toward the next key (bounded small-angle moving hold)."""
    a, b = kits.cell(key), kits.cell(toward)
    split = FOOT[1] - 70
    ax, ay = alpha_centroid(a, (0, 0, CELL[0], split))
    bx, by = alpha_centroid(b, (0, 0, CELL[0], split))
    dx, dy = bx - ax, by - ay
    target = {"up_dx": clampf(dx * 0.25, 3), "up_dy": clampf(dy * 0.25, 3),
              "up_angle": clampf(dx * 0.12, 3.5), "root_angle": clampf(dx * 0.04, 1.5)}
    if max(abs(v) for v in target.values()) < 0.8:
        target = {"up_dx": FORWARD * 1.0, "up_dy": 1.0, "up_angle": FORWARD * 1.6, "root_angle": FORWARD * 0.5}
    return target


def motion_poses(kits: Kits, segment: dict) -> list[dict]:
    """Rig poses for one segment. The first pose of every non-settling segment is the exact key."""
    n = segment["frames"]
    motion = segment["motion"]
    out = []
    for i in range(n):
        t = i / n
        if motion == "toward":
            target = toward_target(kits, segment["key"], segment["toward"])
            u = ease("in-out", t)
            wobble = 0.35 * (i % 2) if i else 0.0
            out.append(pose(root_angle=target["root_angle"] * u, up_dx=target["up_dx"] * u,
                            up_dy=target["up_dy"] * u - wobble, up_angle=target["up_angle"] * u + wobble))
        elif motion == "tremble":  # the held tell: strain in place, never still
            if i == 0:
                out.append(pose())
            else:
                sign = -1 if i % 2 else 1
                out.append(pose(root_angle=0.35 * sign, up_angle=sign * (0.7 + 0.3 * i), up_dy=-(i % 2) - 0.2 * i,
                                up_dx=FORWARD * 0.25 * i))
        elif motion == "drive":  # active: weight drives through the strike
            out.append(pose(root_dx=FORWARD * 1.6 * i, up_angle=FORWARD * 0.9 * i, up_dx=FORWARD * 0.6 * i,
                            up_dy=0.3 * i))
        elif motion == "recoil":  # knocked back from the key, torso snapping back then sagging
            k = ease("out", t)
            out.append(pose(root_dx=-FORWARD * 3.0 * k, root_angle=-FORWARD * 1.2 * k,
                            up_angle=-FORWARD * (3.2 * k - 1.2 * k * k), up_dy=1.5 * k))
        elif motion == "daze":  # unsteady sway around the key
            out.append(pose(root_angle=1.1 * math.sin(2 * math.pi * t * 1.5), up_angle=2.2 * math.sin(2 * math.pi * t + 0.7),
                            up_dy=1.0 + math.sin(2 * math.pi * t * 2), up_dx=0.8 * math.cos(2 * math.pi * t)))
        elif motion == "settle":  # arrive on the exact key: offsets ease out to zero on the last frame
            u = 1.0 - ease("out", (i + 1) / n)
            out.append(pose(root_dx=-FORWARD * 1.5 * u, up_angle=-FORWARD * 2.4 * u, up_dy=2.0 * u, root_angle=0.8 * u))
        elif motion == "breathe":  # loop: chest rise, shoulder roll, weight shift on separate phases
            a = 2 * math.pi * t
            out.append(pose(root_angle=0.7 * math.sin(a + 2.1), up_angle=1.3 * math.sin(a + 1.3),
                            up_dy=1.2 * math.sin(a), up_dx=0.5 * math.sin(a + 0.6)))
        elif motion == "stalk":  # loop: heavy gliding advance, weight rolls over the lead foot
            a = 2 * math.pi * t
            out.append(pose(root_dx=FORWARD * 1.5 * math.sin(a), root_dy=-1.0 * abs(math.sin(a)),
                            root_angle=FORWARD * (0.9 + 0.6 * math.sin(a + 0.9)), up_angle=FORWARD * 1.4 * math.sin(a + 0.4),
                            up_dy=0.9 * math.cos(2 * a), up_dx=0.6 * math.sin(a + 2.0)))
        else:
            raise ValueError(f"Unknown motion {motion!r}")
    return out


def render_segment(kits: Kits, segment: dict) -> list[Image.Image]:
    rig, _ = two_part_rig(kits.cell(segment["key"]), FOOT, waist_fraction=0.52)
    images = []
    for item in motion_poses(kits, segment):
        image = rig.render(item)
        bbox = image.getchannel("A").getbbox()
        if bbox is None or min(bbox[0], bbox[1], CELL[0] - bbox[2], CELL[1] - bbox[3]) < 2:
            raise ValueError(f"{segment['key']}: frame breaks the 2px gutter {bbox}")
        images.append(image)
    return images


def build_clip(kits: Kits, plan: dict) -> Clip:
    frames: list[Frame] = []
    if plan["kind"] == "attack":
        for band in ("windup", "active", "recovery"):
            spec = plan["bands"][band]
            images = [image for segment in spec["segments"] for image in render_segment(kits, segment)]
            durations = weights_to_durations(spec["weights"], spec["durationMs"])
            if len(images) != len(spec["weights"]):
                raise ValueError(f"{plan['id']}:{band}: {len(images)} frames but {len(spec['weights'])} weights")
            key_index = {"windup": len(images) - 1, "active": 1, "recovery": len(images) - 1}[band]
            for index, image in enumerate(images):
                frames.append(Frame(image, durations[index], band=band,
                                    events=tuple(spec.get("events", {}).get(str(index), [])), key=index == key_index))
    else:
        images = [image for segment in plan["segments"] for image in render_segment(kits, segment)]
        keys = set(plan.get("keyFrames", [0]))
        for index, image in enumerate(images):
            frames.append(Frame(image, plan["durationMs"], events=tuple(plan.get("events", {}).get(str(index), [])),
                                key=index in keys))
    sources = sorted({segment["key"] for segment in (plan.get("segments") or
                      [s for band in plan.get("bands", {}).values() for s in band["segments"]])})
    return Clip(plan["id"], plan["kind"], frames, notes={"drivenBy": plan["drivenBy"], "form": plan["form"],
                                                         "sourceKeys": sources})


def build():
    kits = Kits()
    clips = [build_clip(kits, plan) for plan in SOURCE["clips"]]
    kit_sources = []
    for kit_id, kit in SOURCE["kits"].items():
        for role in ("atlas", "manifest"):
            path = (ROOT / kit[role]).resolve()
            kit_sources.append({"kit": kit_id, "role": role, "path": path.relative_to(REPO).as_posix(),
                                "sha256": sha256(path.read_bytes())})
    provenance = {
        **SOURCE["provenance"],
        "builder": "assets/art/kurozane-boss-clips-v2/build_kurozane_boss_clips_v2.py",
        "sources": kit_sources,
        "groundRows": {clip: row for clip, row in sorted(kits.ground.items())},
        "pillow": PILLOW_VERSION,
    }
    extra = {
        "assetId": f"{SOURCE['assetId']}:kurozane",
        "label": "SHOGUN KUROZANE",
        "encounterId": "c9-kurozane",
        "presentationPixelScale": GEOMETRY["presentationPixelScale"],
        "attackClips": SOURCE["attackClips"],
        "phaseForms": SOURCE["phaseForms"],
    }
    return build_character("kurozane", clips, logical_size=CELL, foot_point=FOOT, sheet_basename="kurozane",
                           native_facing=GEOMETRY["nativeFacing"], provenance=provenance, extra=extra,
                           max_width=GEOMETRY["maxSheetWidth"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="fail unless every artifact is byte-identical")
    args = parser.parse_args()
    built = build()
    outputs = {}
    for name, data in built.outputs().items():
        outputs[ROOT / name] = data
        outputs[RUNTIME_DIR / name] = data
    manifest, sheets = built.manifest, built.sheets
    outputs[ROOT / "review" / "kurozane-contact.png"] = png_bytes(contact_sheet(
        manifest, sheets, scale=1, columns=15,
        title="SHOGUN KUROZANE - V2 CLIPS FROM THE PIXELIFIED KITS (RIG-POSED) - REVIEW ONLY, NOT RUNTIME"))
    outputs[ROOT / "review" / "kurozane-tells.gif"] = motion_gif(
        manifest, sheets, ["strike", "signature", "eclipse", "chrysanthemum"], scale=1)
    summary = {
        "schemaVersion": 1,
        "assetId": SOURCE["assetId"],
        "status": SOURCE["status"],
        "provenance": manifest["provenance"],
        "sources": [{"path": SOURCE_PATH.name, "sha256": sha256(SOURCE_PATH.read_bytes())},
                    {"path": Path(__file__).name, "sha256": sha256(Path(__file__).read_bytes())}],
        "toolkit": [{"path": f"skills/pixel-art-production/scripts/{name}",
                     "sha256": sha256((REPO / "skills" / "pixel-art-production" / "scripts" / name).read_bytes())}
                    for name in ("anim_timeline.py", "anim_primitives.py", "anim_rig.py", "anim_sheet.py", "anim_preview.py")],
        "sheets": manifest["sheets"],
        "manifest": {"path": "kurozane.json", "sha256": sha256(manifest_bytes(manifest))},
        "clips": {clip["id"]: {"frames": clip["frameCount"], "unique": clip["uniqueFrames"], "form": clip["notes"]["form"]}
                  for clip in manifest["clips"]},
    }
    outputs[ROOT / "manifest.json"] = manifest_bytes(summary)
    return write_or_check(outputs, args.check, label="kurozane")


if __name__ == "__main__":
    raise SystemExit(main())
