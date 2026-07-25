from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
MANIFEST_PATH = ROOT / "manifest.json"
COVERAGE_SPEC = ROOT.parent / "combat-character-coverage-v1" / "combat-character-coverage.source.json"


def sha256_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rgba_hash(image: Image.Image) -> str:
    return hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest()


def records() -> list[dict]:
    spec = json.loads(COVERAGE_SPEC.read_text(encoding="utf-8"))
    return [record for board in spec["boards"] for record in board["rows"]]


def minimum_gutter(image: Image.Image) -> int:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        return -1
    return min(bbox[0], bbox[1], image.width - bbox[2], image.height - bbox[3])


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    expected_records = records()
    expected_ids = [record["id"] for record in expected_records]
    assert manifest["rowOrder"] == expected_ids
    assert len(expected_ids) == 32
    assert manifest["geometry"] == {
        "frameWidth": 48,
        "frameHeight": 48,
        "columns": 20,
        "rows": 32,
        "atlasWidth": 960,
        "atlasHeight": 1536,
        "pivot": [24, 46],
        "footPoint": [24, 46],
        "minimumTransparentGutter": 1,
        "alphaPolicy": "binary",
        "visibleColorCeilingPerFrame": 16,
    }
    assert len(manifest["columnOrder"]) == 20
    assert len(manifest["frames"]) == 640
    assert len(manifest["characters"]) == 32

    atlas_path = ROOT / manifest["atlas"]["path"]
    atlas = Image.open(atlas_path).convert("RGBA")
    assert atlas.size == (960, 1536)
    assert sha256_path(atlas_path) == manifest["atlas"]["sha256"]

    frame_by_id = {frame["id"]: frame for frame in manifest["frames"]}
    assert len(frame_by_id) == 640
    for frame in manifest["frames"]:
        x, y, width, height = frame["rect"]
        crop = atlas.crop((x, y, x + width, y + height))
        assert rgba_hash(crop) == frame["rgbaSha256"], frame["id"]
        assert set(crop.getchannel("A").getdata()).issubset({0, 255}), frame["id"]
        assert len({pixel[:3] for pixel in crop.getdata() if pixel[3]}) <= 16, frame["id"]
        assert minimum_gutter(crop) >= 1, frame["id"]

    for row, character in enumerate(manifest["characters"]):
        path = ROOT / character["path"]
        sheet = Image.open(path).convert("RGBA")
        assert sheet.size == (960, 48)
        assert sha256_path(path) == character["sha256"]
        assert sheet.tobytes() == atlas.crop((0, row * 48, 960, row * 48 + 48)).tobytes()
        for phase in ("idle", "contact", "compression", "passing", "extension"):
            west = frame_by_id[f'{character["assetId"]}:west:{phase}']
            east = frame_by_id[f'{character["assetId"]}:east:{phase}']
            west_crop = atlas.crop((west["rect"][0], west["rect"][1], west["rect"][0] + 48, west["rect"][1] + 48))
            east_crop = atlas.crop((east["rect"][0], east["rect"][1], east["rect"][0] + 48, east["rect"][1] + 48))
            assert east_crop.tobytes() == west_crop.transpose(Image.Transpose.FLIP_LEFT_RIGHT).tobytes()
        for direction in ("north", "east", "south", "west"):
            walk_hashes = {
                frame_by_id[f'{character["assetId"]}:{direction}:{phase}']["rgbaSha256"]
                for phase in ("contact", "compression", "passing", "extension")
            }
            assert len(walk_hashes) == 4, f'{character["assetId"]}:{direction} repeats a walk phase'

    motion_path = ROOT / manifest["motionPreview"]["path"]
    motion = Image.open(motion_path)
    assert motion.n_frames == 16
    assert sha256_path(motion_path) == manifest["motionPreview"]["sha256"]
    contact_path = ROOT / manifest["contactSheet"]["path"]
    assert sha256_path(contact_path) == manifest["contactSheet"]["sha256"]

    print(
        "Field-animation verification passed: 32 state sheets, 640 native 48x48 frames, "
        "four directional four-phase walk clips, binary alpha, bounded per-frame palettes, "
        "fixed pivots, minimum gutters, exact mirrors, and review GIF integrity."
    )


if __name__ == "__main__":
    main()
