"""Party animation suite v2: banded combat clips and the tired loop.

Pixel-authored lane. Every frame is composed from the frozen native-resolution
key poses of roster-animation-runtime-v1 with integer puppet operations
(pose_puppet.py) and code-drawn accents (party_clips.py). No generated art, no
resampling, binary alpha. `--check` rebuilds into a temp folder and compares
every output byte for byte.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, __version__ as PILLOW_VERSION

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import party_clips as pc  # noqa: E402

SOURCE_KEYS = ROOT.parent / "roster-animation-runtime-v1" / "sources" / "party-combat-key-poses-v1.png"
SOURCE_SPEC = ROOT.parent / "roster-animation-runtime-v1" / "roster-animation-runtime.source.json"
ATLAS_NAME = "party-animation-atlas-v2.png"
CONTACT_NAME = "party-animation-tired-contact-sheet-v2.png"
MANIFEST_NAME = "manifest.json"
COLUMNS = 30

BANDS = {"windup": [0, 6], "active": [7, 12], "recovery": [13, 20]}
CLIPS = [
    dict(id="idle", frames=24, ms=90, loop=True, sampling="time"),
    dict(id="move", frames=20, ms=40, loop=True, sampling="time"),
    dict(id="tired", frames=24, ms=60, loop=False, sampling="cooldown-progress",
         bands={"slump-in": [0, 5], "heavy-breath": [6, 17], "straighten": [18, 23]}),
    dict(id="ready-snap", frames=6, ms=45, loop=False, sampling="time"),
    dict(id="basic-strike", frames=21, ms=40, loop=False, sampling="phase-progress",
         bands=BANDS, event={"name": "damage", "frame": 7}),
    dict(id="guard", frames=24, ms=35, loop=False, sampling="time", event={"name": "guard", "frame": 3}),
    dict(id="hurt", frames=22, ms=20, loop=False, sampling="hit-stun-progress"),
    dict(id="signature-a", frames=21, ms=40, loop=False, sampling="phase-progress",
         bands=BANDS, event={"name": "skill-a", "frame": 7}),
    dict(id="signature-b", frames=21, ms=40, loop=False, sampling="phase-progress",
         bands=BANDS, event={"name": "skill-b", "frame": 7}),
    dict(id="defeat", frames=20, ms=55, loop=False, sampling="time"),
]
BUILDERS = {
    "idle": pc.idle,
    "move": pc.move,
    "tired": pc.tired,
    "ready-snap": pc.ready_snap,
    "basic-strike": pc.basic_strike,
    "guard": pc.guard,
    "hurt": pc.hurt,
    "signature-a": lambda rig: pc.signature(rig, False),
    "signature-b": lambda rig: pc.signature(rig, True),
    "defeat": pc.defeat,
}
MIN_UNIQUE = 20
MIN_UNIQUE_BY_CLIP = {"ready-snap": 6}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    out = io.BytesIO()
    image.save(out, format="PNG", optimize=False, compress_level=9)
    return out.getvalue()


def accent(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def load_rigs() -> list[pc.Rig]:
    sheet = Image.open(SOURCE_KEYS).convert("RGBA")
    spec = json.loads(SOURCE_SPEC.read_text(encoding="utf-8"))
    rigs = []
    for row, character in enumerate(spec["party"]["characters"]):
        keys = [sheet.crop((c * 48, row * 64, c * 48 + 48, row * 64 + 64)) for c in range(10)]
        rigs.append(pc.Rig(character["id"], keys, accent(character["accent"]), character["vfx"]))
    return rigs


def assert_binary(frame: Image.Image, label: str) -> None:
    alphas = set(frame.getchannel("A").tobytes())
    if not alphas <= {0, 255}:
        raise ValueError(f"{label}: alpha not binary {sorted(alphas)}")


def build(output_root: Path) -> list[Path]:
    rigs = load_rigs()
    rows = len(rigs) * len(CLIPS)
    atlas = Image.new("RGBA", (COLUMNS * 48, rows * 64), (0, 0, 0, 0))
    records, summary = [], {}
    tired_strip: dict[str, list[Image.Image]] = {}
    for char_index, rig in enumerate(rigs):
        summary[rig.id] = {}
        for clip_index, clip in enumerate(CLIPS):
            frames = BUILDERS[clip["id"]](rig)
            if len(frames) != clip["frames"]:
                raise ValueError(f"{rig.id}:{clip['id']} built {len(frames)}, expected {clip['frames']}")
            digests = set()
            row = char_index * len(CLIPS) + clip_index
            for local, frame in enumerate(frames):
                assert_binary(frame, f"{rig.id}:{clip['id']}:{local}")
                digest = sha(frame.tobytes())
                digests.add(digest)
                atlas.alpha_composite(frame, (local * 48, row * 64))
                records.append({
                    "id": f"{rig.id}:{clip['id']}:{local}",
                    "rect": [local * 48, row * 64, 48, 64],
                    "rgbaSha256": digest,
                    "visibleBounds": list(frame.getchannel("A").getbbox() or []),
                })
            need = MIN_UNIQUE_BY_CLIP.get(clip["id"], MIN_UNIQUE)
            if len(digests) < need:
                raise ValueError(f"{rig.id}:{clip['id']} has {len(digests)} unique frames, need {need}")
            summary[rig.id][clip["id"]] = {"frames": len(frames), "uniqueFrames": len(digests)}
            if clip["id"] in ("tired", "ready-snap"):
                tired_strip.setdefault(rig.id, []).extend(frames)
    contact = tired_contact(rigs, tired_strip)
    output_root.mkdir(parents=True, exist_ok=True)
    (output_root / ATLAS_NAME).write_bytes(png_bytes(atlas))
    (output_root / CONTACT_NAME).write_bytes(png_bytes(contact))
    spec = json.loads(SOURCE_SPEC.read_text(encoding="utf-8"))
    manifest = {
        "schemaVersion": 1,
        "assetId": "party-animation-suite-v2",
        "status": "runtime-candidate",
        "provenance": {
            "classification": "pixel-authored-production-extension",
            "sourceMethod": "Integer puppet operations (row stretch, whole-pixel shear, head block, split legs, cloth hem and weapon-tip sway, hit flash) over the frozen native-resolution party key poses, plus code-drawn breath, sweat, fan, smear and signature marks. No generated art, no resampling.",
            "source": "../roster-animation-runtime-v1/sources/party-combat-key-poses-v1.png",
            "sourceSha256": sha(SOURCE_KEYS.read_bytes()),
        },
        "geometry": {
            "frameWidth": 48, "frameHeight": 64, "columns": COLUMNS, "rows": rows,
            "width": COLUMNS * 48, "height": rows * 64, "pivot": [24, 58], "footPoint": [24, 58],
            "alphaPolicy": "binary", "facing": "right", "rowOrder": "character-major, clip-minor",
        },
        "characters": [{"id": r.id, "firstRow": i * len(CLIPS)} for i, r in enumerate(rigs)],
        "clips": CLIPS,
        "minimumUniqueFramesPerClip": MIN_UNIQUE,
        "uniqueFrameSummary": summary,
        "frames": records,
        "outputs": [
            {"path": ATLAS_NAME, "sha256": sha((output_root / ATLAS_NAME).read_bytes()), "purpose": "runtime-atlas"},
            {"path": CONTACT_NAME, "sha256": sha((output_root / CONTACT_NAME).read_bytes()), "purpose": "review-contact-sheet"},
        ],
        "builder": {
            "files": {name: sha((ROOT / name).read_bytes()) for name in (
                "build_party_animation_suite.py", "party_clips.py", "pose_puppet.py")},
            "pillowVersion": PILLOW_VERSION,
            "deterministic": True,
            "sourceSpec": SOURCE_SPEC.name,
            "sourceSpecCharacters": [c["id"] for c in spec["party"]["characters"]],
        },
    }
    (output_root / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return [Path(ATLAS_NAME), Path(CONTACT_NAME), Path(MANIFEST_NAME)]


def tired_contact(rigs: list[pc.Rig], frames_by_char: dict[str, list]) -> Image.Image:
    scale = 2
    cell_w, cell_h = 48 * scale, 64 * scale
    sheet = Image.new("RGBA", (COLUMNS * cell_w, len(rigs) * cell_h), (46, 52, 64, 255))
    draw = ImageDraw.Draw(sheet)
    for row, rig in enumerate(rigs):
        for col, frame in enumerate(frames_by_char[rig.id]):
            x0, y0 = col * cell_w, row * cell_h
            tone = (54, 61, 74, 255) if (col + row) % 2 == 0 else (50, 57, 69, 255)
            draw.rectangle((x0, y0, x0 + cell_w - 1, y0 + cell_h - 1), fill=tone)
            if col == 24:
                draw.line((x0, y0, x0, y0 + cell_h - 1), fill=(214, 186, 110, 255), width=2)
            sheet.alpha_composite(frame.resize((cell_w, cell_h), Image.NEAREST), (x0, y0))
    return sheet


def check() -> None:
    with tempfile.TemporaryDirectory(prefix="party-animation-v2-check-") as temp:
        temp_root = Path(temp)
        expected = build(temp_root)
        mismatches = []
        for relative in expected:
            current = ROOT / relative
            if not current.exists():
                mismatches.append(f"missing: {relative.as_posix()}")
            elif current.read_bytes() != (temp_root / relative).read_bytes():
                mismatches.append(f"changed: {relative.as_posix()}")
        if mismatches:
            raise SystemExit("Deterministic check failed:\n" + "\n".join(mismatches))
    print("Deterministic check passed: party animation suite v2 outputs are byte-identical.")


def write_strips(folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for rig in load_rigs():
        for clip in CLIPS:
            frames = BUILDERS[clip["id"]](rig)
            cols, scale = 12, 3
            sheet = Image.new("RGBA", (cols * 48 * scale, ((len(frames) + cols - 1) // cols) * 64 * scale), (58, 66, 78, 255))
            for i, frame in enumerate(frames):
                sheet.alpha_composite(frame.resize((48 * scale, 64 * scale), Image.NEAREST), ((i % cols) * 48 * scale, (i // cols) * 64 * scale))
            sheet.save(folder / f"{rig.id}-{clip['id']}.png")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the v2 party animation atlas.")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--strips", type=Path, help="write per-character clip strips here for review")
    args = parser.parse_args()
    if args.strips:
        write_strips(args.strips)
    elif args.check:
        check()
    else:
        build(ROOT)
        print("Built party animation atlas v2.")


if __name__ == "__main__":
    main()
