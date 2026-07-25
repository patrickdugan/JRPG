from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SPEC_PATH = ROOT / "world-tileset-suite.source.json"
BUILDER_PATH = Path(__file__).resolve()
TOP_ATLAS = "top-down-regional-tiles-v1.png"
SIDE_ATLAS = "side-view-regional-tiles-v1.png"
TOP_CONTACT = "top-down-regional-tiles-contact-sheet-v1.png"
SIDE_CONTACT = "side-view-regional-tiles-contact-sheet-v1.png"
MANIFEST_NAME = "manifest.json"


def color(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (255,)


def sha256_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pixel_hash(seed: int, x: int, y: int) -> int:
    value = (seed + x * 374761393 + y * 668265263) & 0xFFFFFFFF
    value = (value ^ (value >> 13)) * 1274126177 & 0xFFFFFFFF
    return value ^ (value >> 16)


def texture(draw: ImageDraw.ImageDraw, bounds: tuple[int, int, int, int], palette: dict, seed: int, density: int = 9) -> None:
    left, top, right, bottom = bounds
    choices = (palette["shadow"], palette["light"], palette["material"])
    for y in range(top + 1, bottom - 1):
        for x in range(left + 1, right - 1):
            value = pixel_hash(seed, x, y)
            if value % density == 0:
                draw.point((x, y), fill=choices[(value >> 5) % len(choices)])


def motif_mark(draw: ImageDraw.ImageDraw, palette: dict, motif: str, size: int) -> None:
    center = size // 2
    if motif == "cedar":
        draw.line((center - 5, center, center + 5, center), fill=palette["material"], width=2)
        draw.point((center - 2, center - 1), fill=palette["accent"])
        draw.point((center + 3, center + 1), fill=palette["accent"])
    elif motif == "river":
        draw.arc((center - 6, center - 4, center + 3, center + 3), 15, 165, fill=palette["accent"])
        draw.arc((center - 2, center, center + 6, center + 5), 195, 345, fill=palette["light"])
    elif motif == "road":
        draw.line((center - 5, center - 4, center + 4, center + 5), fill=palette["material"])
        draw.line((center - 2, center - 5, center + 6, center + 3), fill=palette["accent"])
    elif motif == "ash":
        draw.line((center - 5, center + 4, center, center - 4, center + 5, center + 3), fill=palette["light"])
        draw.point((center, center - 1), fill=palette["hazard"])
    elif motif == "lacquer":
        draw.rectangle((center - 4, center - 4, center + 4, center + 4), outline=palette["accent"])
        draw.line((center, center - 3, center, center + 3), fill=palette["material"])
    elif motif == "archive":
        draw.rectangle((center - 5, center - 4, center + 5, center + 4), fill=palette["material"], outline=palette["outline"])
        draw.line((center - 3, center - 2, center + 3, center - 2), fill=palette["accent"])
        draw.line((center - 3, center + 1, center + 3, center + 1), fill=palette["light"])
    elif motif == "forge":
        draw.rectangle((center - 5, center - 4, center + 5, center + 4), fill=palette["shadow"], outline=palette["light"])
        draw.rectangle((center - 2, center - 2, center + 2, center + 2), fill=palette["hazard"])
    else:
        draw.ellipse((center - 5, center - 5, center + 5, center + 5), outline=palette["accent"], width=2)
        draw.ellipse((center - 2, center - 2, center + 2, center + 2), fill=palette["hazard"])


def draw_top_tile(theme: dict, role_index: int) -> Image.Image:
    palette = {key: color(value) for key, value in theme["palette"].items()}
    motif = theme["motif"]
    image = Image.new("RGBA", (16, 16), palette["mid"])
    draw = ImageDraw.Draw(image)
    seed = sum(ord(char) for char in theme["id"]) * 31 + role_index * 101

    if role_index in (0, 1, 2):
        image.paste(palette["mid"] if role_index != 1 else palette["shadow"], (0, 0, 16, 16))
        texture(draw, (0, 0, 16, 16), palette, seed, 10 if role_index == 0 else 7)
        if role_index == 2:
            motif_mark(draw, palette, motif, 16)
    elif role_index == 3:
        image.paste(palette["deep"], (0, 0, 16, 16))
        draw.rectangle((3, 0, 12, 15), fill=palette["material"])
        draw.line((4, 0, 4, 15), fill=palette["light"])
        draw.line((11, 0, 11, 15), fill=palette["shadow"])
        for y in (3, 9, 14):
            draw.point((7 + (y % 2), y), fill=palette["accent"])
    elif role_index in (4, 5):
        image.paste(palette["deep"], (0, 0, 16, 16))
        for y in range(1, 16, 5):
            offset = 0 if (y // 5) % 2 == 0 else 4
            for x in range(-offset, 16, 8):
                draw.rectangle((x, y, x + 6, y + 3), fill=palette["shadow"], outline=palette["outline"])
        if role_index == 5:
            draw.rectangle((0, 0, 15, 3), fill=palette["light"])
            draw.line((0, 3, 15, 3), fill=palette["accent"])
    elif role_index == 6:
        image.paste(palette["deep"], (0, 0, 16, 5))
        image.paste(palette["mid"], (0, 5, 16, 16))
        draw.line((0, 5, 15, 5), fill=palette["accent"])
        texture(draw, (0, 5, 16, 16), palette, seed)
    elif role_index == 7:
        image.paste(palette["mid"], (0, 0, 16, 11))
        image.paste(palette["deep"], (0, 11, 16, 16))
        draw.line((0, 10, 15, 10), fill=palette["accent"])
        texture(draw, (0, 0, 16, 11), palette, seed)
    elif role_index == 8:
        image.paste(palette["deep"], (0, 0, 5, 16))
        draw.line((5, 0, 5, 15), fill=palette["accent"])
        texture(draw, (5, 0, 16, 16), palette, seed)
    elif role_index == 9:
        image.paste(palette["deep"], (11, 0, 16, 16))
        draw.line((10, 0, 10, 15), fill=palette["accent"])
        texture(draw, (0, 0, 11, 16), palette, seed)
    elif role_index == 10:
        image.paste(palette["deep"], (0, 0, 16, 16))
        draw.rectangle((5, 5, 15, 15), fill=palette["mid"])
        draw.line((5, 5, 15, 5), fill=palette["accent"])
        draw.line((5, 5, 5, 15), fill=palette["accent"])
        texture(draw, (5, 5, 16, 16), palette, seed)
    elif role_index == 11:
        image.paste(palette["mid"], (0, 0, 16, 16))
        draw.rectangle((0, 0, 5, 5), fill=palette["deep"])
        draw.line((5, 0, 5, 5), fill=palette["accent"])
        draw.line((0, 5, 5, 5), fill=palette["accent"])
        texture(draw, (0, 0, 16, 16), palette, seed)
    elif role_index == 12:
        image.paste(palette["hazard"], (0, 0, 16, 16))
        for y in (3, 8, 13):
            draw.arc((1, y - 2, 9, y + 2), 180, 350, fill=palette["light"])
            draw.arc((7, y - 1, 15, y + 3), 10, 175, fill=palette["accent"])
    elif role_index == 13:
        texture(draw, (0, 0, 16, 16), palette, seed)
        motif_mark(draw, palette, motif, 16)
    elif role_index == 14:
        image.paste(palette["deep"], (0, 0, 16, 16))
        draw.rectangle((3, 1, 12, 15), fill=palette["outline"], outline=palette["accent"])
        draw.rectangle((5, 4, 10, 15), fill=palette["shadow"])
        draw.point((9, 9), fill=palette["light"])
    else:
        image.paste(palette["mid"], (0, 0, 16, 16))
        draw.rectangle((5, 0, 10, 15), fill=palette["material"], outline=palette["outline"])
        draw.line((6, 1, 6, 14), fill=palette["light"])
        draw.rectangle((3, 11, 12, 15), fill=palette["deep"])
    return image


def draw_side_tile(theme: dict, role_index: int) -> Image.Image:
    palette = {key: color(value) for key, value in theme["palette"].items()}
    motif = theme["motif"]
    image = Image.new("RGBA", (32, 32), palette["deep"])
    draw = ImageDraw.Draw(image)
    seed = sum(ord(char) for char in theme["id"]) * 47 + role_index * 131

    if role_index == 0:
        for y in range(32):
            draw.line((0, y, 31, y), fill=palette["deep"] if y < 16 else palette["shadow"])
        texture(draw, (0, 0, 32, 32), palette, seed, 17)
    elif role_index in (1, 2, 3):
        draw.rectangle((0, 17, 31, 31), fill=palette["shadow"])
        draw.line((0, 16, 31, 16), fill=palette["accent"], width=2)
        texture(draw, (0, 18, 32, 32), palette, seed, 9)
        if role_index == 1:
            draw.polygon(((0, 16), (7, 16), (2, 31), (0, 31)), fill=palette["outline"])
        elif role_index == 3:
            draw.polygon(((25, 16), (31, 16), (31, 31), (29, 31)), fill=palette["outline"])
    elif role_index in (4, 5, 6):
        draw.rectangle((0, 11, 31, 17), fill=palette["material"])
        draw.line((0, 10, 31, 10), fill=palette["accent"], width=2)
        draw.line((0, 18, 31, 18), fill=palette["outline"])
        if role_index == 4:
            draw.polygon(((0, 10), (7, 10), (2, 18), (0, 18)), fill=palette["outline"])
        elif role_index == 6:
            draw.polygon(((25, 10), (31, 10), (31, 18), (29, 18)), fill=palette["outline"])
    elif role_index == 7:
        image.paste(palette["shadow"], (0, 0, 32, 32))
        for y in range(1, 32, 7):
            offset = 0 if (y // 7) % 2 == 0 else 7
            for x in range(-offset, 32, 14):
                draw.rectangle((x, y, x + 11, y + 5), outline=palette["outline"])
        draw.line((2, 0, 2, 31), fill=palette["light"])
    elif role_index == 8:
        draw.rectangle((0, 0, 31, 11), fill=palette["shadow"])
        draw.line((0, 11, 31, 11), fill=palette["accent"], width=2)
        texture(draw, (0, 0, 32, 12), palette, seed, 8)
    elif role_index == 9:
        draw.polygon(((0, 31), (31, 8), (31, 31)), fill=palette["shadow"])
        draw.line((0, 30, 31, 7), fill=palette["accent"], width=2)
        for step in range(5, 30, 6):
            draw.line((step, 31 - step * 3 // 4, step + 5, 31 - step * 3 // 4), fill=palette["light"])
    elif role_index == 10:
        for step in range(0, 32, 6):
            draw.rectangle((step, 25 - step // 2, min(31, step + 7), 31), fill=palette["shadow"], outline=palette["accent"])
    elif role_index == 11:
        draw.rectangle((10, 0, 21, 31), fill=palette["material"], outline=palette["outline"])
        draw.line((12, 1, 12, 30), fill=palette["light"])
        draw.rectangle((6, 0, 25, 4), fill=palette["shadow"], outline=palette["accent"])
        draw.rectangle((6, 27, 25, 31), fill=palette["shadow"], outline=palette["accent"])
    elif role_index == 12:
        draw.rectangle((0, 23, 31, 31), fill=palette["hazard"])
        for x in range(0, 32, 6):
            draw.polygon(((x, 23), (x + 3, 14), (x + 6, 23)), fill=palette["accent"], outline=palette["outline"])
        draw.line((0, 25, 31, 25), fill=palette["light"])
    elif role_index == 13:
        motif_mark(draw, palette, motif, 32)
        draw.rectangle((7, 25, 24, 31), fill=palette["shadow"])
    elif role_index == 14:
        draw.rectangle((5, 2, 26, 31), fill=palette["material"], outline=palette["accent"], width=2)
        draw.rectangle((9, 7, 22, 31), fill=palette["outline"])
        draw.point((20, 18), fill=palette["light"])
    else:
        draw.rectangle((4, 0, 11, 31), fill=palette["material"], outline=palette["outline"])
        draw.rectangle((20, 0, 27, 31), fill=palette["material"], outline=palette["outline"])
        draw.line((5, 1, 5, 30), fill=palette["light"])
        draw.line((21, 1, 21, 30), fill=palette["light"])
    return image


def font(size: int) -> ImageFont.ImageFont:
    for name in ("DejaVuSansMono.ttf", "DejaVuSans.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def contact_sheet(atlas: Image.Image, themes: list[dict], tile_size: int, scale: int, title: str) -> Image.Image:
    row_height = tile_size * scale + 34
    width = atlas.width * scale + 24
    sheet = Image.new("RGB", (width, row_height * len(themes) + 34), (7, 11, 22))
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 8), title, font=font(16), fill=(240, 220, 160))
    for row, theme in enumerate(themes):
        y = 34 + row * row_height
        draw.text((12, y + 4), theme["name"], font=font(13), fill=(121, 196, 202))
        crop = atlas.crop((0, row * tile_size, atlas.width, (row + 1) * tile_size))
        enlarged = crop.resize((atlas.width * scale, tile_size * scale), Image.Resampling.NEAREST)
        sheet.paste(enlarged, (12, y + 28))
    return sheet


def tile_receipt(tile: Image.Image, theme: dict, role: str, index: int) -> dict:
    colors = {(r, g, b) for r, g, b, _ in tile.getdata()}
    return {
        "themeId": theme["id"],
        "role": role,
        "index": index,
        "sha256Rgba": hashlib.sha256(tile.tobytes()).hexdigest(),
        "actualColors": len(colors),
        "opaqueAlpha": set(tile.getchannel("A").getdata()) == {255},
    }


def build(output_root: Path) -> list[Path]:
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    themes = spec["themes"]
    top_contract = spec["topDown"]
    side_contract = spec["sideView"]
    top_atlas = Image.new("RGBA", (top_contract["atlasWidth"], top_contract["atlasHeight"]), (0, 0, 0, 255))
    side_atlas = Image.new("RGBA", (side_contract["atlasWidth"], side_contract["atlasHeight"]), (0, 0, 0, 255))
    top_receipts = []
    side_receipts = []
    for row, theme in enumerate(themes):
        for column, role in enumerate(top_contract["roleOrder"]):
            tile = draw_top_tile(theme, column)
            top_atlas.paste(tile, (column * 16, row * 16))
            top_receipts.append(tile_receipt(tile, theme, role, column))
        for column, role in enumerate(side_contract["roleOrder"]):
            tile = draw_side_tile(theme, column)
            side_atlas.paste(tile, (column * 32, row * 32))
            side_receipts.append(tile_receipt(tile, theme, role, column))

    top_path = output_root / TOP_ATLAS
    side_path = output_root / SIDE_ATLAS
    top_contact_path = output_root / TOP_CONTACT
    side_contact_path = output_root / SIDE_CONTACT
    top_atlas.save(top_path, optimize=False)
    side_atlas.save(side_path, optimize=False)
    contact_sheet(top_atlas, themes, 16, 4, "TOP-DOWN REGIONAL TILE FAMILIES · 16x16 NATIVE").save(top_contact_path, optimize=False)
    contact_sheet(side_atlas, themes, 32, 2, "SIDE-VIEW REGIONAL TILE FAMILIES · 32x32 NATIVE").save(side_contact_path, optimize=False)

    manifest = {
        "schemaVersion": 1,
        "assetId": spec["assetId"],
        "status": spec["status"],
        "provenance": spec["provenance"],
        "topDown": {
            "contract": top_contract,
            "atlas": TOP_ATLAS,
            "atlasSha256": sha256_path(top_path),
            "contactSheet": TOP_CONTACT,
            "contactSheetSha256": sha256_path(top_contact_path),
            "tiles": top_receipts,
        },
        "sideView": {
            "contract": side_contract,
            "atlas": SIDE_ATLAS,
            "atlasSha256": sha256_path(side_path),
            "contactSheet": SIDE_CONTACT,
            "contactSheetSha256": sha256_path(side_contact_path),
            "tiles": side_receipts,
        },
        "themes": themes,
        "builder": {
            "path": BUILDER_PATH.name,
            "sha256": sha256_path(BUILDER_PATH),
            "deterministic": True,
            "integerAligned": True,
            "resampling": "none at native scale; NEAREST for review sheets",
        },
    }
    manifest_path = output_root / MANIFEST_NAME
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return [Path(TOP_ATLAS), Path(SIDE_ATLAS), Path(TOP_CONTACT), Path(SIDE_CONTACT), Path(MANIFEST_NAME)]


def check() -> None:
    with tempfile.TemporaryDirectory(prefix="world-tileset-check-") as temp:
        temp_root = Path(temp)
        expected = build(temp_root)
        mismatches = []
        for relative in expected:
            current = ROOT / relative
            rebuilt = temp_root / relative
            if not current.exists():
                mismatches.append(f"missing: {relative.as_posix()}")
            elif current.read_bytes() != rebuilt.read_bytes():
                mismatches.append(f"changed: {relative.as_posix()}")
        if mismatches:
            raise SystemExit("Deterministic check failed:\n" + "\n".join(mismatches))
    print("Deterministic check passed: all tileset outputs are byte-identical.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build top-down and side-view regional tiles.")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
    else:
        build(ROOT)
        print("Built 128 top-down tiles and 128 side-view tiles across eight themes.")


if __name__ == "__main__":
    main()
