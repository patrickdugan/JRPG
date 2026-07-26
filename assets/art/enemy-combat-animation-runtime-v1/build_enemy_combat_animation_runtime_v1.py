#!/usr/bin/env python3
"""Pack the reviewed V2/V3 enemy animation families into one runtime atlas."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image, __version__ as PILLOW_VERSION


PACKAGE_ROOT = Path(__file__).resolve().parent
ART_ROOT = PACKAGE_ROOT.parent
REPO_ROOT = ART_ROOT.parent.parent
RUNTIME_ROOT = REPO_ROOT / "game" / "assets" / "art" / PACKAGE_ROOT.name
OUTPUT_NAME = "enemy-combat-animation-atlas-v1.png"
MANIFEST_NAME = "manifest.json"
FRAME_WIDTH = 160
FRAME_HEIGHT = 160
CLIP_COLUMNS = 6
CLIP_ROWS = 4
ATLAS_COLUMNS = CLIP_COLUMNS * CLIP_ROWS
SUITES = (
    ("enemy-animation-suite-v2", "enemy-animation-suite-v2.source.json", "v2"),
    ("enemy-animation-suite-v3", "enemy-animation-suite-v3.source.json", "v3"),
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_sources() -> tuple[list[dict], list[dict], list[dict]]:
    enemies: list[dict] = []
    clips: list[dict] | None = None
    source_records: list[dict] = []
    for suite_name, contract_name, version in SUITES:
        suite_root = ART_ROOT / suite_name
        contract_bytes = (suite_root / contract_name).read_bytes()
        contract = json.loads(contract_bytes.decode("utf-8"))
        if clips is None:
            clips = contract["clips"]
        elif clips != contract["clips"]:
            raise ValueError(f"{suite_name} clip contract differs from the shared runtime contract")
        source_records.append(
            {
                "package": suite_name,
                "contract": f"../{suite_name}/{contract_name}",
                "contractSha256": sha256(contract_bytes),
            }
        )
        for enemy in contract["enemies"]:
            atlas_name = f"{enemy['id']}-atlas-{version}.png"
            atlas_path = suite_root / atlas_name
            atlas_bytes = atlas_path.read_bytes()
            source_records.append(
                {
                    "package": suite_name,
                    "enemyId": enemy["id"],
                    "path": f"../{suite_name}/{atlas_name}",
                    "sha256": sha256(atlas_bytes),
                }
            )
            enemies.append(
                {
                    **enemy,
                    "sourcePackage": suite_name,
                    "sourceVersion": version,
                    "atlasPath": atlas_path,
                }
            )
    return enemies, clips or [], source_records


def pack_atlas(enemies: list[dict]) -> tuple[Image.Image, bytes]:
    atlas = Image.new(
        "RGBA",
        (ATLAS_COLUMNS * FRAME_WIDTH, len(enemies) * FRAME_HEIGHT),
        (0, 0, 0, 0),
    )
    for runtime_row, enemy in enumerate(enemies):
        with Image.open(enemy["atlasPath"]) as source:
            rgba = source.convert("RGBA")
            if rgba.size != (CLIP_COLUMNS * FRAME_WIDTH, CLIP_ROWS * FRAME_HEIGHT):
                raise ValueError(f"{enemy['id']} has unexpected atlas size {rgba.size}")
            for clip_row in range(CLIP_ROWS):
                for frame_index in range(CLIP_COLUMNS):
                    cell = rgba.crop(
                        (
                            frame_index * FRAME_WIDTH,
                            clip_row * FRAME_HEIGHT,
                            (frame_index + 1) * FRAME_WIDTH,
                            (clip_row + 1) * FRAME_HEIGHT,
                        )
                    )
                    runtime_column = clip_row * CLIP_COLUMNS + frame_index
                    atlas.alpha_composite(
                        cell,
                        (runtime_column * FRAME_WIDTH, runtime_row * FRAME_HEIGHT),
                    )
    buffer = io.BytesIO()
    atlas.save(buffer, format="PNG", optimize=False, compress_level=9)
    return atlas, buffer.getvalue()


def build_manifest(
    enemies: list[dict],
    clips: list[dict],
    source_records: list[dict],
    atlas: Image.Image,
    atlas_bytes: bytes,
) -> dict:
    pixels = atlas.getdata()
    alpha_values = sorted({pixel[3] for pixel in pixels})
    visible_colors = len({pixel for pixel in pixels if pixel[3]})
    builder_bytes = Path(__file__).read_bytes()
    return {
        "schemaVersion": 1,
        "assetId": "enemy-combat-animation-runtime-v1",
        "status": "runtime-integrated-candidate",
        "provenance": {
            "classification": "deterministically pixelified runtime repack",
            "notPixelAuthored": True,
            "source": "Reviewed V2/V3 deterministically pixelified enemy atlases derived from AI-generated stylized animation concepts.",
            "operation": "Lossless integer-aligned cel repacking only; no resampling, recoloring, interpolation, or generated pixels.",
        },
        "geometry": {
            "frameWidth": FRAME_WIDTH,
            "frameHeight": FRAME_HEIGHT,
            "columns": ATLAS_COLUMNS,
            "rows": len(enemies),
            "atlasWidth": atlas.width,
            "atlasHeight": atlas.height,
            "facing": "screen-left",
            "rootMotionOwnership": "runtime-simulation",
            "alphaPolicy": "binary",
            "alphaValues": alpha_values,
            "visibleColorCountAcrossRoster": visible_colors,
        },
        "clips": [
            {
                **clip,
                "startColumn": index * CLIP_COLUMNS,
            }
            for index, clip in enumerate(clips)
        ],
        "rows": [
            {
                "row": row,
                "id": enemy["id"],
                "name": enemy["name"],
                "profile": enemy["profile"],
                "signatureId": enemy["signatureId"],
                "sourcePackage": enemy["sourcePackage"],
                "sourceVersion": enemy["sourceVersion"],
            }
            for row, enemy in enumerate(enemies)
        ],
        "sources": source_records,
        "output": {
            "path": OUTPUT_NAME,
            "runtimePath": f"game/assets/art/{PACKAGE_ROOT.name}/{OUTPUT_NAME}",
            "sha256": sha256(atlas_bytes),
            "width": atlas.width,
            "height": atlas.height,
            "mode": atlas.mode,
        },
        "builder": {
            "path": Path(__file__).name,
            "sha256": sha256(builder_bytes),
            "pillowVersion": PILLOW_VERSION,
        },
    }


def render() -> tuple[bytes, bytes]:
    enemies, clips, sources = load_sources()
    atlas, atlas_bytes = pack_atlas(enemies)
    manifest = build_manifest(enemies, clips, sources, atlas, atlas_bytes)
    manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return atlas_bytes, manifest_bytes


def write_or_check(path: Path, expected: bytes, check: bool) -> None:
    if check:
        if not path.exists() or path.read_bytes() != expected:
            raise SystemExit(f"stale or missing generated artifact: {path}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(expected)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    atlas_bytes, manifest_bytes = render()
    write_or_check(PACKAGE_ROOT / OUTPUT_NAME, atlas_bytes, args.check)
    write_or_check(PACKAGE_ROOT / MANIFEST_NAME, manifest_bytes, args.check)
    write_or_check(RUNTIME_ROOT / OUTPUT_NAME, atlas_bytes, args.check)
    if not args.check:
        print(
            f"packed {ATLAS_COLUMNS}x{len(json.loads(manifest_bytes)['rows'])} frames -> "
            f"{ATLAS_COLUMNS * FRAME_WIDTH}x"
            f"{len(json.loads(manifest_bytes)['rows']) * FRAME_HEIGHT} {OUTPUT_NAME}"
        )


if __name__ == "__main__":
    main()
