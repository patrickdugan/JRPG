#!/usr/bin/env python3
"""Pack per-character animation clips into sheets and a clip manifest.

Input: ordered clips of logical-cell RGBA frames (every frame the same
``logical_size``, all sharing one foot point). Output: one or more PNG sheets
no wider than 4096 px (rows wrap) and a JSON manifest in the
``bbc-animation-clips/1`` schema that ``game/animation-clip-runtime.mjs``
validates and samples.

Packing trims each frame to its alpha bounds (plus a transparent padding
ring), de-duplicates identical frames (same pixels at the same offset, i.e. a
hold), and shelf-packs in first-appearance order. Each manifest frame stores
its sheet rectangle and its pivot (the shared foot point expressed in rect
coordinates), so a runtime draws ``rect`` at ``anchor - pivot * scale``.

Unique-frame counting is translation-invariant: a frame counts as unique only
if its trimmed pixels differ from every other frame in the clip, so sliding a
whole sprite by a pixel does not satisfy the 20-30 unique-frame standard.

Library use::

    from anim_sheet import Clip, Frame, build_character, write_or_check
    build = build_character("ren", clips, logical_size=(48, 64), foot_point=(24, 58),
                            sheet_basename="ren-combat", provenance={...})
    write_or_check({out / name: data for name, data in build.outputs().items()}, check)

``python anim_sheet.py --validate manifest.json`` validates a manifest and its
sheets from disk. ``python anim_sheet.py --check`` runs the self-test.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import struct
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from PIL import Image

SCHEMA = "bbc-animation-clips/1"
MAX_SHEET_WIDTH = 4096
MAX_SHEET_HEIGHT = 4096
ATTACK_BANDS = ("windup", "active", "recovery")
CLIP_KINDS = ("loop", "attack", "progress", "oneshot")
MIN_UNIQUE = 20
MAX_UNIQUE = 30


@dataclass
class Frame:
    """One authored frame: a logical-cell RGBA image plus timing and tags."""

    image: Image.Image
    duration_ms: int
    band: str | None = None
    events: tuple[str, ...] = ()
    key: bool = False


@dataclass
class Clip:
    """An ordered clip. ``kind`` is loop | attack | progress | oneshot.

    * ``loop`` samples by elapsed time and wraps (idle, locomotion, hover).
    * ``attack`` holds three contiguous bands (windup, active, recovery) that a
      runtime samples by the simulation phase's progress fraction.
    * ``progress`` is sampled by a 0..1 fraction from a gameplay timer (stagger,
      phase transition, defeat) and holds its last frame.
    * ``oneshot`` samples by elapsed time and holds its last frame.
    """

    id: str
    kind: str
    frames: list[Frame]
    notes: dict = field(default_factory=dict)
    min_unique: int = MIN_UNIQUE
    max_unique: int = MAX_UNIQUE


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    """Deterministic PNG encoding (no optimizer search, fixed compression)."""
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def ihdr(data: bytes) -> dict:
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Invalid PNG signature")
    width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", data[16:29])
    return {"width": width, "height": height, "bitDepth": depth, "colorType": color,
            "compression": compression, "filter": filtering, "interlace": interlace}


def trim(image: Image.Image, padding: int = 0) -> tuple[Image.Image, tuple[int, int]]:
    """Crop to alpha bounds plus ``padding``; returns the crop and its offset in the cell."""
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Cannot trim an empty frame")
    left, top, right, bottom = bbox
    crop = image.crop((left, top, right, bottom))
    if padding:
        padded = Image.new("RGBA", (crop.width + padding * 2, crop.height + padding * 2), (0, 0, 0, 0))
        padded.paste(crop, (padding, padding))
        return padded, (left - padding, top - padding)
    return crop, (left, top)


def content_hash(image: Image.Image) -> str:
    """Translation-invariant pixel identity: trimmed size plus RGBA bytes."""
    crop, _ = trim(image)
    return sha256(f"{crop.width}x{crop.height}:".encode("ascii") + crop.tobytes())


def unique_count(frames: Iterable[Frame]) -> int:
    return len({content_hash(frame.image) for frame in frames})


def validate_bands(clip: Clip) -> list[dict]:
    """Return contiguous band records for an attack clip, or raise."""
    if clip.kind != "attack":
        if any(frame.band for frame in clip.frames):
            raise ValueError(f"{clip.id}: only attack clips carry bands")
        return []
    names = [frame.band for frame in clip.frames]
    bands = []
    cursor = 0
    for band in ATTACK_BANDS:
        start = cursor
        while cursor < len(names) and names[cursor] == band:
            cursor += 1
        count = cursor - start
        if count < 1:
            raise ValueError(f"{clip.id}: band {band!r} is missing or out of order")
        keys = [index for index in range(start, cursor) if clip.frames[index].key]
        bands.append({"name": band, "start": start, "count": count, "key": keys[-1] if keys else cursor - 1})
    if cursor != len(names):
        raise ValueError(f"{clip.id}: frames after the recovery band or unknown band {names[cursor]!r}")
    return bands


@dataclass
class CharacterBuild:
    manifest: dict
    sheets: list[Image.Image]
    sheet_names: list[str]
    manifest_name: str

    def outputs(self) -> dict[str, bytes]:
        data = {name: png_bytes(sheet) for name, sheet in zip(self.sheet_names, self.sheets)}
        data[self.manifest_name] = manifest_bytes(self.manifest)
        return data


def manifest_bytes(manifest: Mapping) -> bytes:
    return (json.dumps(manifest, indent=1, ensure_ascii=False) + "\n").encode("utf-8")


def build_character(
    character_id: str,
    clips: Sequence[Clip],
    *,
    logical_size: tuple[int, int],
    foot_point: tuple[int, int],
    sheet_basename: str,
    native_facing: str = "right",
    provenance: Mapping | None = None,
    extra: Mapping | None = None,
    max_width: int = MAX_SHEET_WIDTH,
    max_height: int = MAX_SHEET_HEIGHT,
    padding: int = 1,
) -> CharacterBuild:
    """Validate the clip standard, pack sheets, and return the manifest plus images."""
    if native_facing not in ("left", "right"):
        raise ValueError("native_facing must be 'left' or 'right'")
    seen_ids = set()
    packed: dict[tuple[str, int, int], dict] = {}
    order: list[tuple[tuple[str, int, int], Image.Image]] = []
    clip_records = []
    for clip in clips:
        if clip.id in seen_ids:
            raise ValueError(f"Duplicate clip id {clip.id!r}")
        seen_ids.add(clip.id)
        if clip.kind not in CLIP_KINDS:
            raise ValueError(f"{clip.id}: unknown kind {clip.kind!r}")
        if not clip.frames:
            raise ValueError(f"{clip.id}: no frames")
        bands = validate_bands(clip)
        frame_refs = []
        hashes = []
        for index, frame in enumerate(clip.frames):
            if frame.image.size != tuple(logical_size) or frame.image.mode != "RGBA":
                raise ValueError(f"{clip.id}[{index}]: frame must be RGBA {logical_size}, got {frame.image.mode} {frame.image.size}")
            if not isinstance(frame.duration_ms, int) or frame.duration_ms < 1:
                raise ValueError(f"{clip.id}[{index}]: durationMs must be a positive integer")
            alpha_values = set(frame.image.getchannel("A").getdata())
            if not alpha_values <= {0, 255}:
                raise ValueError(f"{clip.id}[{index}]: alpha must be binary (0 or 255)")
            crop, offset = trim(frame.image, padding)
            identity = (sha256(crop.tobytes()), offset[0], offset[1])
            hashes.append(content_hash(frame.image))
            if identity not in packed:
                packed[identity] = {"offset": offset, "size": crop.size}
                order.append((identity, crop))
            frame_refs.append(identity)
        unique = len(set(hashes))
        if not clip.min_unique <= unique <= clip.max_unique:
            raise ValueError(
                f"{character_id}:{clip.id} has {unique} unique frames; the standard requires "
                f"{clip.min_unique}-{clip.max_unique} (holds and pure translations do not count)")
        clip_records.append((clip, bands, frame_refs, hashes, unique))

    # Shelf packing in first-appearance order, wrapping rows at max_width.
    sheets_layout: list[list[tuple[tuple[str, int, int], Image.Image, int, int]]] = [[]]
    sheet_heights = [0]
    x = y = shelf = 0
    for identity, crop in order:
        w, h = crop.size
        if w > max_width:
            raise ValueError(f"Frame wider than the {max_width}px sheet limit")
        if x + w > max_width:
            x, y = 0, y + shelf
            shelf = 0
        if y + h > max_height:
            sheets_layout.append([])
            sheet_heights.append(0)
            x = y = shelf = 0
        sheets_layout[-1].append((identity, crop, x, y))
        packed[identity]["sheet"] = len(sheets_layout) - 1
        packed[identity]["rect"] = [x, y, w, h]
        x += w
        shelf = max(shelf, h)
        sheet_heights[-1] = max(sheet_heights[-1], y + shelf)

    sheet_names = [f"{sheet_basename}.png" if len(sheets_layout) == 1 else f"{sheet_basename}-{i + 1}.png"
                   for i in range(len(sheets_layout))]
    sheets = []
    sheet_records = []
    for name, layout, height in zip(sheet_names, sheets_layout, sheet_heights):
        width = max(x0 + crop.width for _, crop, x0, _ in layout)
        sheet = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        for _, crop, x0, y0 in layout:
            sheet.paste(crop, (x0, y0))
        sheets.append(sheet)
        data = png_bytes(sheet)
        sheet_records.append({"path": name, "width": width, "height": height,
                              "sha256": sha256(data), "bytes": len(data),
                              "decodedBytes": width * height * 4})

    fx, fy = foot_point
    manifest_clips = []
    for clip, bands, frame_refs, hashes, unique in clip_records:
        frames_out = []
        for index, (frame, identity, digest) in enumerate(zip(clip.frames, frame_refs, hashes)):
            record = packed[identity]
            ox, oy = record["offset"]
            entry = {
                "sheet": record["sheet"],
                "rect": list(record["rect"]),
                "pivot": [fx - ox, fy - oy],
                "durationMs": frame.duration_ms,
            }
            if frame.band:
                entry["band"] = frame.band
            if frame.events:
                entry["events"] = list(frame.events)
            if frame.key:
                entry["key"] = True
            entry["hash"] = digest[:16]
            frames_out.append(entry)
        record = {
            "id": clip.id,
            "kind": clip.kind,
            "loop": clip.kind == "loop",
            "frameCount": len(clip.frames),
            "uniqueFrames": unique,
            "durationMs": sum(frame.duration_ms for frame in clip.frames),
            "keyFrames": [index for index, frame in enumerate(clip.frames) if frame.key] or [0],
        }
        if bands:
            record["bands"] = bands
        if clip.notes:
            record["notes"] = dict(clip.notes)
        record["frames"] = frames_out
        manifest_clips.append(record)

    manifest = {
        "schema": SCHEMA,
        "characterId": character_id,
        "nativeFacing": native_facing,
        "logicalFrame": list(logical_size),
        "footPoint": [fx, fy],
        "maxSheetWidth": max_width,
        "uniqueFrameStandard": [MIN_UNIQUE, MAX_UNIQUE],
        "alphaPolicy": "binary",
    }
    if provenance:
        manifest["provenance"] = dict(provenance)
    if extra:
        manifest.update(dict(extra))
    manifest["sheets"] = sheet_records
    manifest["clips"] = manifest_clips
    return CharacterBuild(manifest, sheets, sheet_names, f"{sheet_basename}.json")


def frame_from_sheet(sheets: Sequence[Image.Image], manifest: Mapping, entry: Mapping) -> Image.Image:
    """Rebuild a logical-cell RGBA frame from a manifest frame entry."""
    width, height = manifest["logicalFrame"]
    fx, fy = manifest["footPoint"]
    x, y, w, h = entry["rect"]
    crop = sheets[entry["sheet"]].crop((x, y, x + w, y + h))
    cell = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    cell.paste(crop, (fx - entry["pivot"][0], fy - entry["pivot"][1]))
    return cell


def validate_manifest(manifest: Mapping, sheets: Sequence[Image.Image] | None = None,
                      min_unique: int = MIN_UNIQUE, max_unique: int = MAX_UNIQUE,
                      max_width: int = MAX_SHEET_WIDTH) -> list[str]:
    """Python mirror of the runtime validator. Returns a list of errors (empty = valid)."""
    errors: list[str] = []
    if manifest.get("schema") != SCHEMA:
        return [f"schema must be {SCHEMA}"]
    sheet_records = manifest.get("sheets") or []
    if not sheet_records:
        errors.append("no sheets")
    for index, record in enumerate(sheet_records):
        if not (0 < record.get("width", 0) <= max_width) or record.get("height", 0) <= 0:
            errors.append(f"sheet {index} has invalid dimensions {record.get('width')}x{record.get('height')}")
        if sheets is not None and index < len(sheets) and sheets[index].size != (record["width"], record["height"]):
            errors.append(f"sheet {index} is {sheets[index].size}, manifest says {record['width']}x{record['height']}")
    for clip in manifest.get("clips", []):
        cid = clip.get("id")
        frames = clip.get("frames") or []
        if not frames:
            errors.append(f"{cid}: no frames")
            continue
        if clip.get("kind") not in CLIP_KINDS:
            errors.append(f"{cid}: unknown kind")
        for i, entry in enumerate(frames):
            sheet = entry.get("sheet", -1)
            if not 0 <= sheet < len(sheet_records):
                errors.append(f"{cid}[{i}]: bad sheet index")
                continue
            x, y, w, h = entry["rect"]
            if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > sheet_records[sheet]["width"] or y + h > sheet_records[sheet]["height"]:
                errors.append(f"{cid}[{i}]: rect outside sheet")
        unique = len({entry.get("hash") for entry in frames})
        if not min_unique <= unique <= max_unique:
            errors.append(f"{cid}: {unique} unique frames (standard {min_unique}-{max_unique})")
        if clip.get("kind") == "attack":
            bands = clip.get("bands") or []
            if [band.get("name") for band in bands] != list(ATTACK_BANDS):
                errors.append(f"{cid}: bands must be windup, active, recovery")
            else:
                cursor = 0
                for band in bands:
                    if band["start"] != cursor or band["count"] < 1:
                        errors.append(f"{cid}: band {band['name']} is not contiguous")
                    for entry in frames[band["start"]:band["start"] + band["count"]]:
                        if entry.get("band") != band["name"]:
                            errors.append(f"{cid}: frame band tag disagrees with {band['name']}")
                            break
                    cursor = band["start"] + band["count"]
                if cursor != len(frames):
                    errors.append(f"{cid}: bands do not cover every frame")
    if sheets is not None:
        for clip in manifest.get("clips", []):
            for i, entry in enumerate(clip.get("frames") or []):
                try:
                    image = frame_from_sheet(sheets, manifest, entry)
                except Exception as error:  # noqa: BLE001 - report every broken frame
                    errors.append(f"{clip['id']}[{i}]: cannot rebuild frame ({error})")
                    continue
                if content_hash(image)[:16] != entry.get("hash"):
                    errors.append(f"{clip['id']}[{i}]: pixel hash does not match the manifest")
    return errors


def write_or_check(outputs: Mapping[Path, bytes], check: bool, label: str = "outputs") -> int:
    """Write every output, or with ``check`` verify byte identity without writing. Returns an exit code."""
    if check:
        stale = [str(path) for path, data in outputs.items() if not path.exists() or path.read_bytes() != data]
        if stale:
            print(f"{label}: {len(stale)} stale file(s):\n  " + "\n  ".join(stale), file=sys.stderr)
            return 1
        print(f"{label}: {len(outputs)} file(s) byte-identical")
        return 0
    for path, data in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() or path.read_bytes() != data:
            path.write_bytes(data)
    print(f"{label}: wrote {len(outputs)} file(s)")
    return 0


def load_sheets(manifest_path: Path, manifest: Mapping) -> list[Image.Image]:
    return [Image.open(manifest_path.parent / record["path"]).convert("RGBA") for record in manifest["sheets"]]


def _self_test() -> None:
    from PIL import ImageDraw

    def cel(i: int, shift_only: bool = False) -> Image.Image:
        image = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        if shift_only:
            draw.rectangle((2 + i % 14, 2, 8 + i % 14, 8), fill=(200, 10, 10, 255))
        else:
            draw.rectangle((2, 2, 4 + i % 12, 8 + i // 12), fill=(200, 10, 10, 255))
        return image

    frames = [Frame(cel(i), 40, key=(i == 0)) for i in range(20)]
    attack = [Frame(cel(i), 30, band="windup" if i < 10 else "active" if i < 13 else "recovery", key=i in (9, 11))
              for i in range(22)]
    build = build_character("demo", [Clip("idle", "loop", frames), Clip("hit", "attack", attack)],
                            logical_size=(24, 24), foot_point=(12, 22), sheet_basename="demo", max_width=64)
    assert build.manifest["clips"][1]["bands"][0] == {"name": "windup", "start": 0, "count": 10, "key": 9}
    assert all(sheet.width <= 64 for sheet in build.sheets)
    assert validate_manifest(build.manifest, build.sheets) == []
    again = build_character("demo", [Clip("idle", "loop", frames), Clip("hit", "attack", attack)],
                            logical_size=(24, 24), foot_point=(12, 22), sheet_basename="demo", max_width=64)
    assert again.outputs() == build.outputs(), "packing must be deterministic"
    sliding = [Frame(cel(i, shift_only=True), 40) for i in range(20)]
    try:
        build_character("slide", [Clip("idle", "loop", sliding)], logical_size=(24, 24), foot_point=(12, 22),
                        sheet_basename="slide")
    except ValueError as error:
        assert "1 unique frames" in str(error)
    else:
        raise AssertionError("pure translation must not count as unique frames")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="run the deterministic self-test")
    parser.add_argument("--validate", type=Path, help="validate a manifest JSON and its sheets")
    args = parser.parse_args()
    if args.validate:
        manifest = json.loads(args.validate.read_text(encoding="utf-8"))
        errors = validate_manifest(manifest, load_sheets(args.validate, manifest))
        for error in errors:
            print(error, file=sys.stderr)
        print(f"{args.validate}: {'valid' if not errors else f'{len(errors)} error(s)'}")
        return 1 if errors else 0
    _self_test()
    print("anim_sheet self-test passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
