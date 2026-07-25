from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
SPEC = json.loads((ROOT / "combat-character-coverage.source.json").read_text(encoding="utf-8"))
INVENTORY = json.loads((ROOT / "character-art-inventory-v1.json").read_text(encoding="utf-8"))


def audit_frame(image: Image.Image, colors: int, gutter: int, label: str, errors: list[str]) -> None:
    rgba = image.convert("RGBA")
    alpha_values = set(rgba.getchannel("A").getdata())
    if not alpha_values.issubset({0, 255}):
        errors.append(f"{label}: alpha is not binary")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        errors.append(f"{label}: empty")
        return
    gutters = (bbox[0], bbox[1], rgba.width - bbox[2], rgba.height - bbox[3])
    if min(gutters) < gutter:
        errors.append(f"{label}: gutter {gutters} is below {gutter}")
    actual_colors = len({(r, g, b) for r, g, b, alpha in rgba.getdata() if alpha})
    if actual_colors > colors:
        errors.append(f"{label}: {actual_colors} colors exceed {colors}")


def main() -> None:
    records = [record for board in SPEC["boards"] for record in board["rows"]]
    errors: list[str] = []
    if len(records) != 32:
        errors.append(f"expected 32 generated state packages, found {len(records)}")
    for record in records:
        asset_id = record["id"]
        portrait = Image.open(ROOT / "portraits" / f"{asset_id}-portrait-v1.png").convert("RGBA")
        field = Image.open(ROOT / "field" / f"{asset_id}-field-four-view-v1.png").convert("RGBA")
        if portrait.size != (96, 96):
            errors.append(f"{asset_id}: portrait size {portrait.size}")
        if field.size != (192, 48):
            errors.append(f"{asset_id}: field atlas size {field.size}")
        audit_frame(portrait, 32, 2, f"{asset_id}:portrait", errors)
        for index in range(4):
            frame = field.crop((index * 48, 0, (index + 1) * 48, 48))
            audit_frame(frame, 16, 2, f"{asset_id}:field[{index}]", errors)
        side = ROOT.parent / "late-snes-roster-suite-v1" / "sprites" / f"{asset_id}-four-pose-v1.png"
        if not side.exists() or Image.open(side).size != (256, 64):
            errors.append(f"{asset_id}: missing or invalid side-view atlas")
    if INVENTORY["statePackageCount"] != 39:
        errors.append("inventory does not contain 39 state packages")
    if not all(entry["coverageComplete"] for entry in INVENTORY["entries"]):
        errors.append("inventory contains an incomplete entry")
    if errors:
        raise SystemExit("Coverage verification failed:\n" + "\n".join(errors))
    print(
        "Coverage verification passed: 39/39 state packages have portrait, "
        "top-down, and side-view coverage; 32 generated portraits and 128 "
        "generated top-down cels satisfy geometry, palette, alpha, and gutter contracts."
    )


if __name__ == "__main__":
    main()
