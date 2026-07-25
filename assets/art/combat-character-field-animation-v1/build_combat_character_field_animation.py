from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "combat-character-field-animation.source.json"
COVERAGE_ROOT = ROOT.parent / "combat-character-coverage-v1"
COVERAGE_SPEC_PATH = COVERAGE_ROOT / "combat-character-coverage.source.json"
COVERAGE_MANIFEST_PATH = COVERAGE_ROOT / "manifest.json"
BUILDER_PATH = Path(__file__).resolve()

CHARACTER_DIR = "characters"
ATLAS_NAME = "combat-character-field-animation-atlas-v1.png"
CONTACT_NAME = "combat-character-field-animation-contact-sheet-v1.png"
MOTION_NAME = "combat-character-field-animation-motion-preview-v1.gif"
MANIFEST_NAME = "manifest.json"

FRAME_W = 48
FRAME_H = 48
DIRECTIONS = ("north", "east", "south", "west")
PHASES = ("idle", "contact", "compression", "passing", "extension")
WALK_PHASES = ("contact", "compression", "passing", "extension")
COLUMNS = tuple(f"{direction}-{phase}" for direction in DIRECTIONS for phase in PHASES)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_path(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png_bytes(image))


def load_records() -> list[dict]:
    coverage = json.loads(COVERAGE_SPEC_PATH.read_text(encoding="utf-8"))
    return [record for board in coverage["boards"] for record in board["rows"]]


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Animation source frame has no visible pixels.")
    return bbox


def binary_alpha(image: Image.Image) -> Image.Image:
    result = image.convert("RGBA")
    result.putalpha(result.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
    return result


def shifted(image: Image.Image, dx: int = 0, dy: int = 0) -> Image.Image:
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output.alpha_composite(image, (dx, dy))
    return output


def anchored_compression(image: Image.Image) -> Image.Image:
    """Compress one native row while preserving the subject's grounded edge."""
    bbox = visible_bbox(image)
    subject = image.crop(bbox)
    target_height = max(1, subject.height - 1)
    subject = subject.resize((subject.width, target_height), Image.Resampling.NEAREST)
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output.alpha_composite(subject, (bbox[0], bbox[3] - target_height))
    return output


def upper_body_lean(image: Image.Image, dx: int) -> Image.Image:
    """Shift the upper mass by one integer pixel while retaining grounded feet."""
    split = min(31, max(24, visible_bbox(image)[1] + 25))
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    upper = image.crop((0, 0, FRAME_W, split))
    lower = image.crop((0, split, FRAME_W, FRAME_H))
    output.alpha_composite(upper, (dx, 0))
    output.alpha_composite(lower, (0, split))
    return output


def mirror(image: Image.Image) -> Image.Image:
    return image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)


def source_keys(asset_id: str) -> dict[str, Image.Image]:
    path = COVERAGE_ROOT / "field" / f"{asset_id}-field-four-view-v1.png"
    atlas = Image.open(path).convert("RGBA")
    if atlas.size != (192, 48):
        raise ValueError(f"{path.name} has unexpected size {atlas.size}.")
    return {
        "south-idle": binary_alpha(atlas.crop((0, 0, 48, 48))),
        "west-contact": binary_alpha(atlas.crop((48, 0, 96, 48))),
        "north-idle": binary_alpha(atlas.crop((96, 0, 144, 48))),
        "south-extension": binary_alpha(atlas.crop((144, 0, 192, 48))),
    }


def directional_frames(keys: dict[str, Image.Image], direction: str) -> dict[str, Image.Image]:
    if direction == "south":
        idle = keys["south-idle"]
        contact = upper_body_lean(idle, -1)
        extension = keys["south-extension"]
        lean = 1
    elif direction == "north":
        idle = keys["north-idle"]
        contact = upper_body_lean(idle, 1)
        extension = upper_body_lean(idle, -1)
        lean = -1
    elif direction == "west":
        contact = keys["west-contact"]
        idle = upper_body_lean(contact, 1)
        extension = upper_body_lean(contact, -1)
        lean = -1
    elif direction == "east":
        west = directional_frames(keys, "west")
        return {phase: mirror(west[phase]) for phase in PHASES}
    else:
        raise ValueError(f"Unsupported direction {direction}.")

    compression = anchored_compression(contact)
    passing = shifted(upper_body_lean(idle, lean), 0, -1)
    return {
        "idle": binary_alpha(idle),
        "contact": binary_alpha(contact),
        "compression": binary_alpha(compression),
        "passing": binary_alpha(passing),
        "extension": binary_alpha(extension),
    }


def frame_colors(image: Image.Image) -> int:
    return len({pixel[:3] for pixel in image.getdata() if pixel[3]})


def frame_receipt(image: Image.Image, asset_id: str, direction: str, phase: str, column: int, row: int) -> dict:
    bbox = visible_bbox(image)
    return {
        "id": f"{asset_id}:{direction}:{phase}",
        "assetId": asset_id,
        "direction": direction,
        "phase": phase,
        "row": row,
        "column": column,
        "rect": [column * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H],
        "pivot": [24, 46],
        "footPoint": [24, 46],
        "visibleBounds": list(bbox),
        "transparentGutters": {
            "left": bbox[0],
            "top": bbox[1],
            "right": FRAME_W - bbox[2],
            "bottom": FRAME_H - bbox[3],
        },
        "visibleColors": frame_colors(image),
        "binaryAlpha": set(image.getchannel("A").getdata()).issubset({0, 255}),
        "rgbaSha256": sha256_bytes(image.tobytes()),
    }


def font(size: int) -> ImageFont.ImageFont:
    for name in ("DejaVuSansMono.ttf", "DejaVuSans.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def contact_sheet(records: list[dict], sheets: dict[str, Image.Image], scale: int) -> Image.Image:
    label_width = 296
    header_height = 42
    row_height = FRAME_H * scale + 4
    width = label_width + len(COLUMNS) * FRAME_W * scale + 12
    height = header_height + len(records) * row_height + 8
    image = Image.new("RGB", (width, height), (7, 11, 22))
    draw = ImageDraw.Draw(image)
    draw.text((10, 8), "FIELD ANIMATION · IDLE + CONTACT / COMPRESSION / PASSING / EXTENSION", font=font(16), fill=(240, 220, 160))
    for row, record in enumerate(records):
        y = header_height + row * row_height
        fill = (13, 22, 38) if row % 2 == 0 else (16, 27, 46)
        draw.rectangle((0, y, width - 1, y + row_height - 2), fill=fill)
        draw.text((10, y + 10), record["name"], font=font(13), fill=(121, 196, 202))
        draw.text((210, y + 10), record["catalogId"], font=font(11), fill=(176, 184, 198))
        enlarged = sheets[record["id"]].resize((len(COLUMNS) * FRAME_W * scale, FRAME_H * scale), Image.Resampling.NEAREST)
        image.paste(enlarged.convert("RGB"), (label_width, y), enlarged)
    return image


def motion_preview(records: list[dict], animation_frames: dict[str, dict[str, dict[str, Image.Image]]], scale: int, duration: int) -> list[Image.Image]:
    columns = 8
    rows = math.ceil(len(records) / columns)
    margin = 8
    cell_w = FRAME_W * scale
    cell_h = FRAME_H * scale
    frames: list[Image.Image] = []
    for direction in DIRECTIONS:
        for phase in WALK_PHASES:
            review = Image.new("RGB", (margin * 2 + columns * cell_w, margin * 2 + rows * cell_h), (7, 11, 22))
            for index, record in enumerate(records):
                x = margin + (index % columns) * cell_w
                y = margin + (index // columns) * cell_h
                sprite = animation_frames[record["id"]][direction][phase]
                enlarged = sprite.resize((cell_w, cell_h), Image.Resampling.NEAREST)
                review.paste(enlarged.convert("RGB"), (x, y), enlarged)
            frames.append(review)
    return frames


def expected_paths(records: list[dict]) -> list[Path]:
    paths = [
        Path(ATLAS_NAME),
        Path(CONTACT_NAME),
        Path(MOTION_NAME),
        Path(MANIFEST_NAME),
    ]
    paths.extend(Path(CHARACTER_DIR) / f'{record["id"]}-field-animation-v1.png' for record in records)
    return paths


def build(output_root: Path) -> list[Path]:
    spec = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    records = load_records()
    atlas = Image.new("RGBA", (len(COLUMNS) * FRAME_W, len(records) * FRAME_H), (0, 0, 0, 0))
    character_sheets: dict[str, Image.Image] = {}
    all_frames: dict[str, dict[str, dict[str, Image.Image]]] = {}
    frame_receipts: list[dict] = []
    character_receipts: list[dict] = []

    for row, record in enumerate(records):
        keys = source_keys(record["id"])
        by_direction = {direction: directional_frames(keys, direction) for direction in DIRECTIONS}
        all_frames[record["id"]] = by_direction
        sheet = Image.new("RGBA", (len(COLUMNS) * FRAME_W, FRAME_H), (0, 0, 0, 0))
        for column, tag in enumerate(COLUMNS):
            direction, phase = tag.split("-", 1)
            frame = by_direction[direction][phase]
            sheet.alpha_composite(frame, (column * FRAME_W, 0))
            atlas.alpha_composite(frame, (column * FRAME_W, row * FRAME_H))
            frame_receipts.append(frame_receipt(frame, record["id"], direction, phase, column, row))
        character_sheets[record["id"]] = sheet
        relative = Path(CHARACTER_DIR) / f'{record["id"]}-field-animation-v1.png'
        path = output_root / relative
        save_png(sheet, path)
        character_receipts.append({
            "assetId": record["id"],
            "name": record["name"],
            "catalogId": record["catalogId"],
            "group": record["group"],
            "source": f'../combat-character-coverage-v1/field/{record["id"]}-field-four-view-v1.png',
            "sourceSha256": sha256_path(COVERAGE_ROOT / "field" / f'{record["id"]}-field-four-view-v1.png'),
            "path": relative.as_posix(),
            "sha256": sha256_path(path),
            "dimensions": list(sheet.size),
        })

    atlas_path = output_root / ATLAS_NAME
    contact_path = output_root / CONTACT_NAME
    motion_path = output_root / MOTION_NAME
    save_png(atlas, atlas_path)
    save_png(contact_sheet(records, character_sheets, spec["preview"]["contactSheetScale"]), contact_path)
    motion_frames = motion_preview(
        records,
        all_frames,
        spec["preview"]["motionPreviewScale"],
        spec["preview"]["motionPreviewFrameDurationMs"],
    )
    motion_frames[0].save(
        motion_path,
        save_all=True,
        append_images=motion_frames[1:],
        duration=spec["preview"]["motionPreviewFrameDurationMs"],
        loop=0,
        disposal=2,
        optimize=False,
    )

    manifest = {
        "schemaVersion": 1,
        "assetId": spec["assetId"],
        "status": spec["status"],
        "provenance": {
            "classification": spec["classification"],
            "claim": "deterministically pixelified field-animation derivatives",
            "animationSpec": SOURCE_PATH.name,
            "animationSpecSha256": sha256_path(SOURCE_PATH),
            "sourcePackage": spec["sourceCoveragePackage"],
            "sourceSpec": "../combat-character-coverage-v1/combat-character-coverage.source.json",
            "sourceSpecSha256": sha256_path(COVERAGE_SPEC_PATH),
            "sourceManifestSha256": sha256_path(COVERAGE_MANIFEST_PATH),
            "authorshipNote": "Generated concept ancestry is retained; these derived frames are not pixel-authored.",
        },
        "geometry": {
            "frameWidth": FRAME_W,
            "frameHeight": FRAME_H,
            "columns": len(COLUMNS),
            "rows": len(records),
            "atlasWidth": atlas.width,
            "atlasHeight": atlas.height,
            "pivot": spec["frame"]["pivot"],
            "footPoint": spec["frame"]["footPoint"],
            "minimumTransparentGutter": spec["frame"]["minimumTransparentGutter"],
            "alphaPolicy": spec["frame"]["alphaPolicy"],
            "visibleColorCeilingPerFrame": spec["frame"]["visibleColorCeiling"],
        },
        "columnOrder": list(COLUMNS),
        "rowOrder": [record["id"] for record in records],
        "clips": {
            direction: {
                "idle": [f"{direction}-idle"],
                "walk": [f"{direction}-{phase}" for phase in WALK_PHASES],
                "frameDurationMs": [spec["frameDurationMs"][phase] for phase in WALK_PHASES],
                "loop": True,
            }
            for direction in DIRECTIONS
        },
        "rootMotionOwnership": spec["rootMotionOwnership"],
        "eastPolicy": spec["eastPolicy"],
        "atlas": {
            "path": ATLAS_NAME,
            "sha256": sha256_path(atlas_path),
            "dimensions": list(atlas.size),
        },
        "contactSheet": {
            "path": CONTACT_NAME,
            "sha256": sha256_path(contact_path),
            "dimensions": list(Image.open(contact_path).size),
            "previewScale": spec["preview"]["contactSheetScale"],
            "purpose": "nearest-neighbor review only",
        },
        "motionPreview": {
            "path": MOTION_NAME,
            "sha256": sha256_path(motion_path),
            "dimensions": list(motion_frames[0].size),
            "previewScale": spec["preview"]["motionPreviewScale"],
            "frames": len(motion_frames),
            "frameDurationMs": spec["preview"]["motionPreviewFrameDurationMs"],
            "purpose": "review only; runtime timing remains manifest-authoritative",
        },
        "characters": character_receipts,
        "frames": frame_receipts,
        "builder": {
            "path": BUILDER_PATH.name,
            "sha256": sha256_path(BUILDER_PATH),
            "pillowVersion": PILLOW_VERSION,
            "deterministic": True,
            "integerAligned": True,
            "resampling": spec["derivation"]["resampling"],
        },
    }
    manifest_path = output_root / MANIFEST_NAME
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return expected_paths(records)


def check() -> None:
    with tempfile.TemporaryDirectory(prefix="field-animation-check-") as temp:
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
    print("Deterministic check passed: all character field-animation outputs are byte-identical.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Expand combat-character field keys into four-phase directional cycles.")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
    else:
        outputs = build(ROOT)
        print(f"Built {len(outputs)} field-animation outputs for 32 enemy and boss states.")


if __name__ == "__main__":
    main()
