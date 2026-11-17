#!/usr/bin/env python3
"""Deterministically build the v2 boss animation suite (20-30 unique frames per clip).

Every frame is rasterized at native resolution from integer-rounded,
code-native primitives driven by keyframed pose parameters
(``boss_performances_v2`` -> ``boss_rigs_v2`` -> the pixel-art-production
toolkit). Identity (palettes, motifs, inventory) comes from the v1 boss suite,
which stays the static runtime fallback. No raster input, generator,
resampling, filtering, partial alpha, or dithering is involved.

    python build_boss_animation_suite_v2.py                 # write sheets, manifests, review, runtime copies
    python build_boss_animation_suite_v2.py --check         # byte-identical rebuild check (no writes)
    python build_boss_animation_suite_v2.py --boss mateus   # limit to one boss (development; no suite manifest)
    python build_boss_animation_suite_v2.py --boss mateus --review-dir DIR   # extra strips/onion skins

Bosses are built one at a time and released, so peak memory stays at one
character's frames.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(REPO / "skills" / "pixel-art-production" / "scripts"))

from PIL import Image, __version__ as PILLOW_VERSION  # noqa: E402

from anim_preview import contact_sheet, frame_strip, motion_gif, onion_skin  # noqa: E402
from anim_sheet import Clip, Frame, build_character, manifest_bytes, png_bytes, sha256, write_or_check  # noqa: E402
from anim_timeline import Timeline, band_times, loop_times, weights_to_durations  # noqa: E402
from boss_performances_v2 import PERFORMANCES, RIGS, SECONDARY  # noqa: E402
from boss_rigs_v2 import CELL, ORIGIN, canvas_for  # noqa: E402

SOURCE_PATH = ROOT / "boss-animation-suite-v2.source.json"
SOURCE = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
IDENTITY_PATH = (ROOT / SOURCE["identitySource"]).resolve()
IDENTITY = json.loads(IDENTITY_PATH.read_text(encoding="utf-8"))
RUNTIME_DIR = REPO / "game" / "assets" / "art" / "boss-animation-suite-v2"
REVIEW_DIR = ROOT / "review"
GEOMETRY = SOURCE["geometry"]
FOOT = tuple(GEOMETRY["footPoint"])
GUTTER = GEOMETRY["minimumTransparentGutter"]
IDENTITY_ORDER = tuple(item["id"] for item in IDENTITY["bosses"])
BOSS_ORDER = tuple(item["id"] for item in SOURCE["bosses"])  # code-authored bosses; see SOURCE["externalBosses"]
LOOSE = False  # --loose: report gutter breaks as warnings while authoring (never for committed output)
MODULES = ("boss_rigs_v2.py", "boss_rigs_creature_v2.py", "boss_motion_v2.py", "boss_cast_humanoid_v2.py",
           "boss_cast_creature_v2.py", "boss_performances_v2.py", "build_boss_animation_suite_v2.py")
TOOLKIT = ("anim_timeline.py", "anim_primitives.py", "anim_sheet.py", "anim_preview.py")

if tuple(GEOMETRY["logicalFrame"]) != CELL or tuple(GEOMETRY["authoringOrigin"]) != ORIGIN:
    raise SystemExit("Rig geometry and source geometry disagree")
if tuple(b for b in IDENTITY_ORDER if b in BOSS_ORDER) != BOSS_ORDER or (
        set(BOSS_ORDER) | {item["id"] for item in SOURCE["externalBosses"]} != set(IDENTITY_ORDER)):
    raise SystemExit("v2 code bosses plus external bosses must cover the v1 identity rows in order")
if SOURCE["safety"] != IDENTITY["safety"]:
    raise SystemExit("v2 safety contract must match the v1 identity source")


def keyed_timeline(start: dict, keys: list) -> Timeline:
    """Keys carry the easing that *arrives* at them; convert to leaving-eases for ``Timeline``."""
    entries = [(0.0, start, keys[0][2] if keys else "linear")]
    for index, (t, delta, _ease) in enumerate(keys):
        leave = keys[index + 1][2] if index + 1 < len(keys) else "linear"
        entries.append((t, delta, leave))
    return Timeline.from_poses(entries, defaults=start)


def smear_pass(poses: list, angle_key: str) -> list:
    """Each smeared frame sweeps from the previous frame's weapon angle."""
    out = []
    for index, pose in enumerate(poses):
        q = dict(pose)
        if q.get("smear", 0) > 0 and index > 0:
            q["smearFrom"] = poses[index - 1][angle_key]
        out.append(q)
    return out


def clip_poses(perf: dict, plan: dict) -> list[dict]:
    neutral = perf["neutral"]
    kind = plan["kind"]
    secondary = perf.get("secondary") or SECONDARY.get(perf["rig"], lambda poses, loop: poses)
    if kind == "loop":
        sampler = perf[plan["id"]]
        return secondary([sampler(t) for t in loop_times(plan["frames"])], True)
    if kind == "attack":
        out, bands, start = [], [], dict(neutral)
        for band in ("windup", "active", "recovery"):
            timeline = keyed_timeline(start, perf[plan["id"]][band])
            for t in band_times(plan["bands"][band]["frames"]):
                out.append(timeline.sample(t))
                bands.append(band)
            start = out[-1]
        out = smear_pass(secondary(out, False), perf.get("smear_key", "wpn"))
        return perf["post"](plan["id"], out, bands) if perf.get("post") else out
    keys = perf[plan["id"]]
    first = {**neutral, **keys[0][1]}
    timeline = keyed_timeline(first, keys[1:])
    poses = secondary([timeline.sample(t) for t in band_times(plan["frames"], include_start=True)], False)
    return perf["post"](plan["id"], poses, [None] * len(poses)) if perf.get("post") else poses


def render_pose(boss: dict, perf: dict, pose: dict, label: str) -> Image.Image:
    c = canvas_for(boss["palette"])
    RIGS[perf["rig"]](c, pose, perf["style"])
    bbox = c.image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"{label}: empty frame")
    left, top, right, bottom = bbox
    if min(left, top, CELL[0] - right, CELL[1] - bottom) < GUTTER:
        if not LOOSE:
            raise ValueError(f"{label}: frame breaks the {GUTTER}px gutter {bbox}")
        print(f"warning: {label}: frame breaks the {GUTTER}px gutter {bbox}", file=sys.stderr)
    return c.image


def build_clip(boss: dict, perf: dict, plan: dict) -> Clip:
    poses = clip_poses(perf, plan)
    frames: list[Frame] = []
    if plan["kind"] == "attack":
        cursor = 0
        for band in ("windup", "active", "recovery"):
            spec = plan["bands"][band]
            durations = weights_to_durations(spec["weights"], spec["durationMs"])
            key_index = {"windup": spec["frames"] - 1, "active": 1, "recovery": spec["frames"] - 1}[band]
            for index in range(spec["frames"]):
                image = render_pose(boss, perf, poses[cursor], f"{boss['id']}:{plan['id']}:{band}:{index}")
                frames.append(Frame(image, durations[index], band=band,
                                    events=tuple(spec.get("events", {}).get(str(index), [])), key=index == key_index))
                cursor += 1
    else:
        keys = set(plan.get("keyFrames", [0]))
        events = plan.get("events", {})
        for index, pose in enumerate(poses):
            image = render_pose(boss, perf, pose, f"{boss['id']}:{plan['id']}:{index}")
            frames.append(Frame(image, plan["durationMs"], events=tuple(events.get(str(index), [])), key=index in keys))
    notes = {"drivenBy": plan["drivenBy"]}
    if plan["id"] in ("strike", "signature"):
        notes.update(boss["clips"][plan["id"]])
    return Clip(plan["id"], plan["kind"], frames, notes=notes)


def boss_record(boss_id: str) -> dict:
    identity = next(item for item in IDENTITY["bosses"] if item["id"] == boss_id)
    plan = next(item for item in SOURCE["bosses"] if item["id"] == boss_id)
    return {
        "id": boss_id,
        "label": identity["label"],
        "encounterId": identity["encounterId"],
        "paletteId": identity["paletteId"],
        "palette": IDENTITY["palettes"][identity["paletteId"]],
        "clips": {"strike": plan["strike"], "signature": plan["signature"]},
        "rig": plan["rig"],
    }


def attack_map(boss: dict) -> dict:
    return {f"enemy:{boss['id']}:{attack}": clip_id
            for clip_id in ("strike", "signature") for attack in boss["clips"][clip_id]["attacks"]}


def build_boss(boss_id: str):
    boss = boss_record(boss_id)
    perf = PERFORMANCES[boss_id]
    if perf["rig"] != boss["rig"]:
        raise ValueError(f"{boss_id}: rig mismatch")
    clips = [build_clip(boss, perf, plan) for plan in SOURCE["clips"]]
    provenance = {
        "lane": SOURCE["provenanceLane"],
        "authorship": SOURCE["authorship"],
        "builder": f"assets/art/boss-animation-suite-v2/{Path(__file__).name}",
        "identitySource": "assets/art/boss-combat-suite/boss-combat-suite.source.json",
        "pillow": PILLOW_VERSION,
    }
    extra = {
        "assetId": f"{SOURCE['assetId']}:{boss_id}",
        "label": boss["label"],
        "encounterId": boss["encounterId"],
        "paletteId": boss["paletteId"],
        "presentationPixelScale": GEOMETRY["presentationPixelScale"],
        "attackClips": attack_map(boss),
    }
    return build_character(boss_id, clips, logical_size=CELL, foot_point=FOOT, sheet_basename=boss_id,
                           native_facing=GEOMETRY["nativeFacing"], provenance=provenance, extra=extra,
                           max_width=GEOMETRY["maxSheetWidth"])


def review_files(build, boss_id: str, review_dir: Path, extended: bool) -> dict[Path, bytes]:
    manifest, sheets = build.manifest, build.sheets
    out = {
        review_dir / f"{boss_id}-contact.png": png_bytes(contact_sheet(
            manifest, sheets, scale=1, columns=15,
            title=f"{manifest['label']} - V2 CLIP REVIEW (NOT RUNTIME) - pixel-authored code primitives")),
        review_dir / f"{boss_id}-tells.gif": motion_gif(manifest, sheets, ["strike", "signature", "stagger"], scale=2),
    }
    if extended:
        for clip in manifest["clips"]:
            out[review_dir / f"{boss_id}-{clip['id']}-strip.png"] = png_bytes(frame_strip(manifest, sheets, clip["id"], scale=2))
            out[review_dir / f"{boss_id}-{clip['id']}-onion.png"] = png_bytes(onion_skin(manifest, sheets, clip["id"], scale=3))
    return out


def build_outputs(job: tuple) -> tuple[str, dict[str, bytes], dict]:
    """Worker: render one boss and return its output bytes plus a summary (frames are released here)."""
    boss_id, with_review, loose = job
    global LOOSE
    LOOSE = loose
    build = build_boss(boss_id)
    named = dict(build.outputs())
    if with_review:
        named.update({f"review/{path.name}": data for path, data in review_files(build, boss_id, Path("review"), False).items()})
    summary = {
        "id": boss_id,
        "sheets": build.manifest["sheets"],
        "manifest": {"path": f"{boss_id}.json", "sha256": sha256(manifest_bytes(build.manifest))},
        "clips": {clip["id"]: {"frames": clip["frameCount"], "unique": clip["uniqueFrames"],
                               **({"bands": {b["name"]: b["count"] for b in clip["bands"]}} if clip.get("bands") else {})}
                  for clip in build.manifest["clips"]},
    }
    return boss_id, named, summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="fail unless every artifact is byte-identical")
    parser.add_argument("--boss", action="append", help="limit to a boss id (repeatable)")
    parser.add_argument("--review-dir", type=Path, help="also write strips and onion skins here (never checked)")
    parser.add_argument("--no-review", action="store_true", help="skip the committed contact sheet and GIF")
    parser.add_argument("--loose", action="store_true", help="authoring aid: warn instead of failing on gutter breaks")
    parser.add_argument("--jobs", type=int, default=1, help="build bosses in N worker processes (each holds one boss)")
    args = parser.parse_args()
    global LOOSE
    LOOSE = args.loose
    if args.loose and (args.check or not args.boss):
        raise SystemExit("--loose is an authoring aid; combine it with --boss and never with --check")
    bosses = args.boss or list(BOSS_ORDER)
    missing = [b for b in bosses if b not in PERFORMANCES]
    if missing:
        raise SystemExit(f"Unknown or unimplemented boss: {missing}")
    status = 0
    summaries = []
    jobs = max(1, min(args.jobs, len(bosses)))
    work = [(boss_id, not args.no_review, args.loose) for boss_id in bosses]
    if jobs > 1:
        import multiprocessing
        pool = multiprocessing.get_context("spawn").Pool(jobs, maxtasksperchild=2)
        results = pool.imap(build_outputs, work, chunksize=1)
    else:
        pool = None
        results = map(build_outputs, work)
    try:
        for boss_id, named, summary in results:  # one boss's bytes in the parent at a time
            outputs = {}
            for name, data in named.items():
                if name.startswith("review/"):
                    outputs[ROOT / name] = data
                else:
                    outputs[ROOT / name] = data
                    outputs[RUNTIME_DIR / name] = data
            status |= write_or_check(outputs, args.check, label=boss_id)
            summaries.append(summary)
            del outputs, named
            if args.review_dir:
                write_or_check(review_files(build_boss(boss_id), boss_id, args.review_dir, True), False,
                               label=f"{boss_id} review")
    finally:
        if pool is not None:
            pool.close()
            pool.join()
    summaries.sort(key=lambda item: BOSS_ORDER.index(item["id"]))
    if not args.boss:
        scripts = REPO / "skills" / "pixel-art-production" / "scripts"
        suite = {
            "schemaVersion": 1,
            "assetId": SOURCE["assetId"],
            "status": SOURCE["status"],
            "authorship": SOURCE["authorship"],
            "provenanceLane": SOURCE["provenanceLane"],
            "canonicalSource": SOURCE_PATH.name,
            "builder": Path(__file__).name,
            "geometry": GEOMETRY,
            "standard": SOURCE["standard"],
            "sources": [{"path": SOURCE_PATH.name, "sha256": sha256(SOURCE_PATH.read_bytes())}]
            + [{"path": name, "sha256": sha256((ROOT / name).read_bytes())} for name in MODULES]
            + [{"path": "../boss-combat-suite/boss-combat-suite.source.json", "sha256": sha256(IDENTITY_PATH.read_bytes())}],
            "toolkit": [{"path": f"skills/pixel-art-production/scripts/{name}", "sha256": sha256((scripts / name).read_bytes())}
                        for name in TOOLKIT],
            "bosses": summaries,
            "externalBosses": SOURCE["externalBosses"],
            "totals": {
                "bosses": len(summaries),
                "frames": sum(c["frames"] for s in summaries for c in s["clips"].values()),
                "uniqueFrames": sum(c["unique"] for s in summaries for c in s["clips"].values()),
                "sheetBytes": sum(sh["bytes"] for s in summaries for sh in s["sheets"]),
                "decodedBytesPerBoss": {s["id"]: sum(sh["decodedBytes"] for sh in s["sheets"]) for s in summaries},
            },
            "safety": SOURCE["safety"],
        }
        status |= write_or_check({ROOT / "manifest.json": manifest_bytes(suite)}, args.check, label="suite manifest")
    return status


if __name__ == "__main__":
    raise SystemExit(main())
