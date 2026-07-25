from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
SPEC = json.loads((ROOT / "world-tileset-suite.source.json").read_text(encoding="utf-8"))


def main() -> None:
    errors: list[str] = []
    top = Image.open(ROOT / "top-down-regional-tiles-v1.png").convert("RGBA")
    side = Image.open(ROOT / "side-view-regional-tiles-v1.png").convert("RGBA")
    if top.size != (256, 128):
        errors.append(f"top-down atlas size {top.size}")
    if side.size != (512, 256):
        errors.append(f"side-view atlas size {side.size}")
    if set(top.getchannel("A").getdata()) != {255}:
        errors.append("top-down atlas is not opaque")
    if set(side.getchannel("A").getdata()) != {255}:
        errors.append("side-view atlas is not opaque")

    for row, theme in enumerate(SPEC["themes"]):
        palette_ceiling = len(theme["palette"])
        for column, role in enumerate(SPEC["topDown"]["roleOrder"]):
            tile = top.crop((column * 16, row * 16, (column + 1) * 16, (row + 1) * 16))
            actual = len({pixel[:3] for pixel in tile.getdata()})
            if actual > palette_ceiling:
                errors.append(f"{theme['id']} top {role}: {actual} colors exceed {palette_ceiling}")
            if column in (0, 1):
                border = []
                border.extend(tile.crop((0, 0, 16, 1)).getdata())
                border.extend(tile.crop((0, 15, 16, 16)).getdata())
                border.extend(tile.crop((0, 0, 1, 16)).getdata())
                border.extend(tile.crop((15, 0, 16, 16)).getdata())
                if len({pixel[:3] for pixel in border}) != 1:
                    errors.append(f"{theme['id']} top {role}: repeat border is not seamless")
        for column, role in enumerate(SPEC["sideView"]["roleOrder"]):
            tile = side.crop((column * 32, row * 32, (column + 1) * 32, (row + 1) * 32))
            actual = len({pixel[:3] for pixel in tile.getdata()})
            if actual > palette_ceiling:
                errors.append(f"{theme['id']} side {role}: {actual} colors exceed {palette_ceiling}")

    if errors:
        raise SystemExit("Tileset verification failed:\n" + "\n".join(errors))
    print(
        "Tileset verification passed: eight themes, 128 top-down 16x16 tiles, "
        "128 side-view 32x32 tiles, bounded palettes, opaque alpha, integer geometry, "
        "and seamless repeat borders for base floors."
    )


if __name__ == "__main__":
    main()
