from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
SPEC_PATH = ROOT / "late-snes-roster-suite.source.json"
MANIFEST_PATH = ROOT / "manifest.json"


def main() -> None:
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    runtime = spec["runtimeAtlas"]
    frame_width = runtime["frameWidth"]
    frame_height = runtime["frameHeight"]
    color_ceiling = runtime["visibleColorCeiling"]
    minimum_gutter = runtime["minimumTransparentGutter"]
    expected_records = [record for board in spec["boards"] for record in board["rows"]]

    errors: list[str] = []
    if len(expected_records) != 39:
        errors.append(f"expected 39 state atlases, found {len(expected_records)}")
    if manifest["identityCount"] != len(expected_records):
        errors.append("manifest identityCount does not match the source contract")
    if len(manifest["sourceBoards"]) != 10:
        errors.append("expected ten grouped source-board receipts")

    manifest_by_id = {asset["id"]: asset for asset in manifest["assets"]}
    for record in expected_records:
        asset_id = record["id"]
        atlas_path = ROOT / "sprites" / f"{asset_id}-four-pose-v1.png"
        preview_path = ROOT / "previews" / f"{asset_id}-four-pose-preview-v1.png"
        if not atlas_path.exists():
            errors.append(f"{asset_id}: missing atlas")
            continue
        if not preview_path.exists():
            errors.append(f"{asset_id}: missing preview")
        atlas = Image.open(atlas_path).convert("RGBA")
        if atlas.size != (frame_width * 4, frame_height):
            errors.append(f"{asset_id}: atlas size {atlas.size} is not 256x64")
            continue
        if asset_id not in manifest_by_id:
            errors.append(f"{asset_id}: absent from manifest")
        for frame_index in range(4):
            frame = atlas.crop(
                (
                    frame_index * frame_width,
                    0,
                    (frame_index + 1) * frame_width,
                    frame_height,
                )
            )
            alpha_values = set(frame.getchannel("A").getdata())
            if not alpha_values.issubset({0, 255}):
                errors.append(f"{asset_id}[{frame_index}]: alpha is not binary")
            bbox = frame.getchannel("A").getbbox()
            if bbox is None:
                errors.append(f"{asset_id}[{frame_index}]: frame is empty")
                continue
            gutters = (
                bbox[0],
                bbox[1],
                frame_width - bbox[2],
                frame_height - bbox[3],
            )
            if min(gutters) < minimum_gutter:
                errors.append(
                    f"{asset_id}[{frame_index}]: gutter {gutters} is below {minimum_gutter}"
                )
            visible_colors = len(
                {(r, g, b) for r, g, b, alpha in frame.getdata() if alpha}
            )
            if visible_colors > color_ceiling:
                errors.append(
                    f"{asset_id}[{frame_index}]: {visible_colors} colors exceed {color_ceiling}"
                )

    if errors:
        raise SystemExit("Acceptance verification failed:\n" + "\n".join(errors))
    print(
        "Acceptance verification passed: 39 atlases, 156 native cels, "
        "64x64 geometry, <=24 visible colors per cel, binary alpha, "
        "and >=2px transparent gutters."
    )


if __name__ == "__main__":
    main()
