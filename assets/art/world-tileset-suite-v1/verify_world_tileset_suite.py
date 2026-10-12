from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
SPEC = json.loads((ROOT / "world-tileset-suite.source.json").read_text(encoding="utf-8"))


def main() -> None:
    errors: list[str] = []
    runtime = json.loads((ROOT / "world-tileset-runtime-v1.json").read_text(encoding="utf-8"))
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
    if runtime["themeOrder"] != [theme["id"] for theme in SPEC["themes"]]:
        errors.append("runtime theme order does not match source")
    for view_id in ("topDown", "sideView"):
        view = runtime["views"][view_id]
        source_view = SPEC[view_id]
        if [role["id"] for role in view["roles"]] != source_view["roleOrder"]:
            errors.append(f"{view_id} runtime role order does not match source")
        for column, role in enumerate(view["roles"]):
            if role["column"] != column:
                errors.append(f"{view_id} {role['id']}: runtime column mismatch")
            if role["collisionHint"] not in {
                "none", "passable", "solid", "one-way", "slope-up", "stairs-up", "level-authored",
            }:
                errors.append(f"{view_id} {role['id']}: invalid collision hint")
            if role["layer"] not in {
                "background", "ground", "structure", "effect", "interaction", "foreground",
            }:
                errors.append(f"{view_id} {role['id']}: invalid render layer")
    if runtime["runtimePolicy"]["collisionAuthority"] != SPEC["runtimePolicy"]["collisionAuthority"]:
        errors.append("runtime collision authority drifted")

    bands = SPEC["topDown"]["autotileBands"]
    if runtime["views"]["topDown"].get("autotileBands") != bands:
        errors.append("runtime autotile bands drifted from source")
    roles = SPEC["topDown"]["roleOrder"]
    for row, theme in enumerate(SPEC["themes"]):
        liquid = theme.get("topDownLiquid", {})
        if liquid.get("kind") not in {"water", "ember", "corruption"}:
            errors.append(f"{theme['id']}: invalid top-down liquid kind")
        outline = tuple(int(theme["palette"]["outline"].lstrip("#")[index:index + 2], 16) for index in (0, 2, 4))
        shadow = tuple(int(theme["palette"]["shadow"].lstrip("#")[index:index + 2], 16) for index in (0, 2, 4))

        def tile_at(role: str) -> Image.Image:
            column = roles.index(role)
            return top.crop((column * 16, row * 16, (column + 1) * 16, (row + 1) * 16))

        def region(tile: Image.Image, box: tuple[int, int, int, int]) -> set[tuple[int, int, int]]:
            return {pixel[:3] for pixel in tile.crop(box).getdata()}

        strip_contract = (
            ("edge-north", (0, 0, 16, 1), outline),
            ("edge-north", (0, 1, 16, bands["north"]), shadow),
            ("edge-south", (0, 16 - bands["south"], 16, 16), outline),
            ("edge-west", (0, 0, 1, 16), outline),
            ("edge-west", (1, 0, bands["west"], 16), shadow),
            ("edge-east", (16 - bands["east"], 0, 16, 16), outline),
            ("outer-corner", (0, 0, 1, 1), outline),
            ("outer-corner", (15, 15, 16, 16), outline),
            ("inner-corner", (0, 0, 1, 1), outline),
            ("inner-corner", (15, 0, 16, 1), outline),
            ("inner-corner", (0, 15, 1, 16), outline),
            ("inner-corner", (15, 15, 16, 16), outline),
        )
        for role, box, expected in strip_contract:
            if region(tile_at(role), box) != {expected}:
                errors.append(f"{theme['id']} top {role}: autotile strip {box} breaks the band contract")

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
        "seamless repeat borders for base floors, the field autotile band contract, "
        "and level-authoritative runtime semantics."
    )


if __name__ == "__main__":
    main()
