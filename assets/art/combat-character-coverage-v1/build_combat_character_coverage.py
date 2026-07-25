from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import os
import tempfile
from pathlib import Path
from types import ModuleType

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SPEC_PATH = ROOT / "combat-character-coverage.source.json"
BUILDER_PATH = Path(__file__).resolve()
SHARED_BUILDER = ROOT.parent / "late-snes-roster-suite-v1" / "build_late_snes_roster_suite.py"
CONTACT_NAME = "combat-character-coverage-contact-sheet-v1.png"
MANIFEST_NAME = "manifest.json"
INVENTORY_NAME = "character-art-inventory-v1.json"


def load_shared_builder() -> ModuleType:
    spec = importlib.util.spec_from_file_location("character_coverage_shared_builder", SHARED_BUILDER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load shared builder: {SHARED_BUILDER}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


SHARED = load_shared_builder()


def sha256_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def binary_source(cell: Image.Image) -> Image.Image:
    rgba = cell.convert("RGBA")
    rgba.putalpha(rgba.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
    return SHARED.filter_components(rgba, preserve_distant_vfx=True)


def fit_asset(
    cell: Image.Image,
    size: tuple[int, int],
    maximum: tuple[int, int],
    colors: int,
    *,
    bottom_gutter: int | None,
) -> Image.Image:
    cleaned = binary_source(cell)
    subject = cleaned.crop(SHARED.visible_bbox(cleaned))
    scale = min(maximum[0] / subject.width, maximum[1] / subject.height)
    target = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(target, Image.Resampling.BOX)
    subject.putalpha(subject.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
    subject = SHARED.quantize_visible(subject, colors)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - subject.width) // 2
    y = (size[1] - subject.height) // 2 if bottom_gutter is None else size[1] - bottom_gutter - subject.height
    canvas.alpha_composite(subject, (x, y))
    return canvas


def font(size: int) -> ImageFont.ImageFont:
    for name in ("DejaVuSansMono.ttf", "DejaVuSans.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def checker(size: tuple[int, int], tile: int = 12) -> Image.Image:
    image = Image.new("RGBA", size, (10, 16, 29, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(18, 30, 49, 255))
    return image


def coverage_preview(portrait: Image.Image, field: Image.Image) -> Image.Image:
    preview = checker((610, 208))
    preview.alpha_composite(portrait.resize((192, 192), Image.Resampling.NEAREST), (8, 8))
    preview.alpha_composite(field.resize((384, 96), Image.Resampling.NEAREST), (216, 56))
    return preview.convert("RGB")


def contact_sheet(records: list[dict], portraits: dict[str, Image.Image], fields: dict[str, Image.Image]) -> Image.Image:
    columns = 4
    card_width = 500
    card_height = 138
    rows = math.ceil(len(records) / columns)
    sheet = Image.new("RGB", (columns * card_width, rows * card_height), (7, 11, 22))
    draw = ImageDraw.Draw(sheet)
    name_font = font(15)
    meta_font = font(11)
    for index, record in enumerate(records):
        column = index % columns
        row = index // columns
        x = column * card_width
        y = row * card_height
        fill = (13, 22, 38) if (column + row) % 2 == 0 else (16, 27, 46)
        draw.rectangle((x + 1, y + 1, x + card_width - 2, y + card_height - 2), fill=fill, outline=(44, 70, 102))
        draw.text((x + 8, y + 5), record["name"], font=name_font, fill=(240, 220, 160))
        draw.text((x + 8, y + 23), f'{record["catalogId"]} · {record["group"]}', font=meta_font, fill=(121, 196, 202))
        sheet.paste(portraits[record["id"]], (x + 8, y + 38), portraits[record["id"]])
        field_large = fields[record["id"]].resize((384, 96), Image.Resampling.NEAREST)
        sheet.paste(field_large, (x + 108, y + 38), field_large)
    return sheet


def visible_colors(image: Image.Image) -> int:
    return len({(r, g, b) for r, g, b, alpha in image.getdata() if alpha})


def frame_receipt(image: Image.Image) -> dict:
    bbox = SHARED.visible_bbox(image)
    return {
        "sha256Rgba": hashlib.sha256(image.tobytes()).hexdigest(),
        "visibleColors": visible_colors(image),
        "binaryAlpha": set(image.getchannel("A").getdata()).issubset({0, 255}),
        "visibleBounds": list(bbox),
        "transparentGutters": {
            "left": bbox[0],
            "top": bbox[1],
            "right": image.width - bbox[2],
            "bottom": image.height - bbox[3],
        },
    }


def party_inventory() -> list[dict]:
    names = [
        ("ren", "Ren Ishikawa", "PTY-001", 0),
        ("aya", "Aya Shinohara", "PTY-002", 1),
        ("nikola-drazanic", "Nikola Dražanić", "PTY-003", 2),
        ("mateus", "Father Mateus Avelar", "PTY-004", 3),
        ("genta", "Genta Mononobe", "PTY-005", 4),
        ("kiku", "Kiku Nawa", "PTY-006", 5),
        ("miyo-senda", "Miyo Senda", "PTY-007", 6),
    ]
    entries = []
    for asset_id, name, catalog_id, row in names:
        entries.append(
            {
                "id": asset_id,
                "name": name,
                "catalogId": catalog_id,
                "group": "party",
                "portrait": {
                    "path": "../party-portrait-suite-v2/party-portrait-expressions-v2.png",
                    "row": row,
                    "neutralColumn": 0,
                    "frameSize": [96, 96],
                },
                "topDown": {
                    "path": "../party-field-suite/party-field-foundation.png",
                    "row": row,
                    "frameSize": [32, 48],
                    "directions": ["north", "east", "south", "west"],
                },
                "sideView": {
                    "path": f"../late-snes-roster-suite-v1/sprites/{asset_id}-four-pose-v1.png",
                    "frameSize": [64, 64],
                },
                "coverageComplete": True,
            }
        )
    return entries


def expected_paths(records: list[dict]) -> list[Path]:
    paths = [Path(CONTACT_NAME), Path(MANIFEST_NAME), Path(INVENTORY_NAME)]
    for record in records:
        paths.extend(
            [
                Path("portraits") / f'{record["id"]}-portrait-v1.png',
                Path("field") / f'{record["id"]}-field-four-view-v1.png',
                Path("previews") / f'{record["id"]}-coverage-preview-v1.png',
            ]
        )
    return paths


def build(output_root: Path) -> list[Path]:
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    portrait_contract = spec["portrait"]
    field_contract = spec["field"]
    for folder in ("portraits", "field", "previews"):
        (output_root / folder).mkdir(parents=True, exist_ok=True)

    records: list[dict] = []
    portraits: dict[str, Image.Image] = {}
    fields: dict[str, Image.Image] = {}
    source_receipts: list[dict] = []
    asset_receipts: list[dict] = []

    for board in spec["boards"]:
        chroma_path = ROOT / board["chromaSource"]
        alpha_path = ROOT / board["alphaSource"]
        chroma = Image.open(chroma_path).convert("RGBA")
        alpha = Image.open(alpha_path).convert("RGBA")
        key = SHARED.key_color(chroma)
        column_bounds, row_bounds = SHARED.detect_grid_boundaries(
            chroma,
            key,
            columns=5,
            rows=len(board["rows"]),
        )
        source_receipts.append(
            {
                "boardId": board["id"],
                "chromaPath": board["chromaSource"],
                "chromaSha256": sha256_path(chroma_path),
                "alphaPath": board["alphaSource"],
                "alphaSha256": sha256_path(alpha_path),
                "dimensions": [alpha.width, alpha.height],
                "detectedColumnBounds": column_bounds,
                "detectedRowBounds": row_bounds,
            }
        )
        for row_index, record in enumerate(board["rows"]):
            y0, y1 = row_bounds[row_index], row_bounds[row_index + 1]
            portrait_cell = alpha.crop((column_bounds[0], y0, column_bounds[1], y1))
            portrait = fit_asset(
                portrait_cell,
                (portrait_contract["width"], portrait_contract["height"]),
                (portrait_contract["maximumContentWidth"], portrait_contract["maximumContentHeight"]),
                portrait_contract["visibleColorCeiling"],
                bottom_gutter=None,
            )
            field_frames: list[Image.Image] = []
            field_receipts: list[dict] = []
            for column_index in range(1, 5):
                cell = alpha.crop((column_bounds[column_index], y0, column_bounds[column_index + 1], y1))
                frame = fit_asset(
                    cell,
                    (field_contract["frameWidth"], field_contract["frameHeight"]),
                    (field_contract["maximumContentWidth"], field_contract["maximumContentHeight"]),
                    field_contract["visibleColorCeiling"],
                    bottom_gutter=field_contract["bottomGutter"],
                )
                field_frames.append(frame)
                field_receipts.append(frame_receipt(frame))
            field_atlas = Image.new(
                "RGBA",
                (field_contract["atlasWidth"], field_contract["atlasHeight"]),
                (0, 0, 0, 0),
            )
            for frame_index, frame in enumerate(field_frames):
                field_atlas.alpha_composite(frame, (frame_index * field_contract["frameWidth"], 0))

            portrait_path = output_root / "portraits" / f'{record["id"]}-portrait-v1.png'
            field_path = output_root / "field" / f'{record["id"]}-field-four-view-v1.png'
            preview_path = output_root / "previews" / f'{record["id"]}-coverage-preview-v1.png'
            portrait.save(portrait_path, optimize=False)
            field_atlas.save(field_path, optimize=False)
            coverage_preview(portrait, field_atlas).save(preview_path, optimize=False)
            portraits[record["id"]] = portrait
            fields[record["id"]] = field_atlas
            records.append(record)

            side_path = ROOT.parent / "late-snes-roster-suite-v1" / "sprites" / f'{record["id"]}-four-pose-v1.png'
            if not side_path.exists():
                raise RuntimeError(f"Missing side-view coverage: {side_path}")
            asset_receipts.append(
                {
                    **record,
                    "sourceBoard": board["id"],
                    "sourceRow": row_index,
                    "portrait": {
                        "path": portrait_path.relative_to(output_root).as_posix(),
                        "sha256": sha256_path(portrait_path),
                        **frame_receipt(portrait),
                    },
                    "topDown": {
                        "path": field_path.relative_to(output_root).as_posix(),
                        "sha256": sha256_path(field_path),
                        "frames": field_receipts,
                    },
                    "sideView": {
                        "path": Path(os.path.relpath(side_path, ROOT)).as_posix(),
                        "sha256": sha256_path(side_path),
                    },
                    "preview": {
                        "path": preview_path.relative_to(output_root).as_posix(),
                        "sha256": sha256_path(preview_path),
                    },
                }
            )

    sheet_path = output_root / CONTACT_NAME
    contact_sheet(records, portraits, fields).save(sheet_path, optimize=False)

    inventory_entries = party_inventory()
    for record in records:
        inventory_entries.append(
            {
                "id": record["id"],
                "name": record["name"],
                "catalogId": record["catalogId"],
                "group": record["group"],
                "portrait": {"path": f'portraits/{record["id"]}-portrait-v1.png', "frameSize": [96, 96]},
                "topDown": {"path": f'field/{record["id"]}-field-four-view-v1.png', "frameSize": [48, 48]},
                "sideView": {
                    "path": f'../late-snes-roster-suite-v1/sprites/{record["id"]}-four-pose-v1.png',
                    "frameSize": [64, 64],
                },
                "coverageComplete": True,
            }
        )
    inventory = {
        "schemaVersion": 1,
        "combatIdentityCount": 36,
        "statePackageCount": len(inventory_entries),
        "portraitCoverage": len(inventory_entries),
        "topDownCoverage": len(inventory_entries),
        "sideViewCoverage": len(inventory_entries),
        "entries": inventory_entries,
    }
    inventory_path = output_root / INVENTORY_NAME
    inventory_path.write_text(json.dumps(inventory, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    manifest = {
        "schemaVersion": 1,
        "assetId": spec["assetId"],
        "status": spec["status"],
        "provenance": spec["provenance"],
        "portraitContract": portrait_contract,
        "fieldContract": field_contract,
        "generatedStatePackages": len(records),
        "inventoryStatePackages": len(inventory_entries),
        "sourceBoards": source_receipts,
        "builder": {
            "path": BUILDER_PATH.name,
            "sha256": sha256_path(BUILDER_PATH),
            "sharedBuilder": Path(os.path.relpath(SHARED_BUILDER, ROOT)).as_posix(),
            "sharedBuilderSha256": sha256_path(SHARED_BUILDER),
            "deterministic": True,
        },
        "contactSheet": {
            "path": CONTACT_NAME,
            "sha256": sha256_path(sheet_path),
            "dimensions": list(Image.open(sheet_path).size),
        },
        "inventory": {"path": INVENTORY_NAME, "sha256": sha256_path(inventory_path)},
        "assets": asset_receipts,
    }
    manifest_path = output_root / MANIFEST_NAME
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return expected_paths(records)


def check() -> None:
    with tempfile.TemporaryDirectory(prefix="character-coverage-check-") as temp:
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
    print("Deterministic check passed: character coverage outputs are byte-identical.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build combat-character portrait and top-down coverage.")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
    else:
        outputs = build(ROOT)
        print(f"Built {len(outputs)} generated coverage files.")


if __name__ == "__main__":
    main()
