from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
import math
import os
from pathlib import Path
from types import ModuleType

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "enemy-field-suite-v3.source.json"
BUILDER_PATH = Path(__file__).resolve()
COVERAGE_ROOT = ROOT.parent / "combat-character-coverage-v1"
SHARED_BUILDER = ROOT.parent / "late-snes-roster-suite-v1" / "build_late_snes_roster_suite.py"
RUNTIME_ROOT = ROOT.parents[2] / "game" / "assets" / "art" / "enemy-field-suite-v3"

FIELD_ATLAS_NAME = "enemy-field-atlas-v3.png"
TRIGGER_ATLAS_NAME = "enemy-encounter-trigger-atlas-v3.png"
CONTACT_NAME = "enemy-field-contact-sheet-v3.png"
MOTION_NAME = "enemy-field-motion-preview-v3.gif"
TRIGGER_PREVIEW_NAME = "enemy-encounter-trigger-preview-v3.gif"
MANIFEST_NAME = "manifest.json"

FRAME_W = 80
FRAME_H = 80
PIVOT = (40, 77)
DIRECTIONS = ("north", "east", "south", "west")
SOURCE_KEYS = ("south-idle", "west-contact", "north-idle", "south-extension")
PHASES = (
    "contact-a",
    "compression-a",
    "passing-a",
    "extension-a",
    "contact-b",
    "compression-b",
    "passing-b",
    "extension-b",
)
FIELD_COLUMNS = tuple(
    f"{direction}-{state}"
    for direction in DIRECTIONS
    for state in ("idle", *PHASES)
) + ("south-alert", "south-hurt")
TRIGGER_COLUMNS = tuple(f"trigger-{index:02d}" for index in range(12))

STRIDE = (0, 1, 2, 1, 0, -1, -2, -1)
SWAY = (-1, -1, 0, 1, 1, 1, 0, -1)
BOB_BY_PROFILE = {
    "humanoid": (0, 1, 1, 0, 0, -1, -1, 0),
    "rush": (0, 1, 0, -1, 0, 1, 0, -1),
    "hover": (1, 2, 1, 0, -1, -2, -1, 0),
    "beast": (0, 1, 1, 0, 0, -1, -1, 0),
    "heavy": (0, 0, 1, 0, 0, 0, -1, 0),
    "ambush": (0, 1, 0, -1, 0, 1, 0, -1),
}
MOTION_GAIN = {
    "humanoid": 1.0,
    "rush": 1.35,
    "hover": 0.55,
    "beast": 1.2,
    "heavy": 0.65,
    "ambush": 0.8,
}
DISPLAY_NAMES: dict[str, str] = {}


def load_shared_builder() -> ModuleType:
    spec = importlib.util.spec_from_file_location("enemy_field_shared_builder", SHARED_BUILDER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load shared builder: {SHARED_BUILDER}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


SHARED = load_shared_builder()


def clean_display_name(value: str) -> str:
    return value.replace("â€”", "—").replace("â€“", "–")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def gif_bytes(frames: list[Image.Image], durations: list[int]) -> bytes:
    stream = io.BytesIO()
    frames[0].save(
        stream,
        format="GIF",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=False,
    )
    return stream.getvalue()


def load_contract() -> tuple[dict, dict, list[dict]]:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    coverage_path = ROOT / source["sourceCoverageSpec"]
    coverage = json.loads(coverage_path.read_text(encoding="utf-8"))
    records = [
        {**record, "name": clean_display_name(record["name"])}
        for board in coverage["boards"]
        for record in board["rows"]
    ]
    ids = tuple(record["id"] for record in records)
    assert source["classification"] == "deterministically-pixelified"
    assert source["sourceClassification"] == "AI-generated pixel-styled concept"
    assert source["frame"] == {
        "width": FRAME_W,
        "height": FRAME_H,
        "pivot": list(PIVOT),
        "footPoint": list(PIVOT),
        "transparentGutter": 2,
        "alphaPolicy": "binary",
    }
    assert tuple(source["sourceColumnOrder"]) == SOURCE_KEYS
    assert tuple(source["runtimeDirectionOrder"]) == DIRECTIONS
    assert tuple(source["walkPhases"]) == PHASES
    assert set(source["profiles"]) == set(ids)
    assert len(records) == 32
    DISPLAY_NAMES.clear()
    DISPLAY_NAMES.update({record["id"]: record["name"] for record in records})
    return source, coverage, records


def binary_source(cell: Image.Image) -> Image.Image:
    result = cell.convert("RGBA")
    alpha = result.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    result.putalpha(alpha)
    return result


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("Source cell contains no visible pixels.")
    return bounds


def fit_source_keys(
    keys: dict[str, Image.Image],
    maximum: tuple[int, int],
) -> dict[str, Image.Image]:
    subjects = {key: binary_source(image).crop(visible_bbox(binary_source(image))) for key, image in keys.items()}
    maximum_width = max(subject.width for subject in subjects.values())
    maximum_height = max(subject.height for subject in subjects.values())
    scale = min(maximum[0] / maximum_width, maximum[1] / maximum_height)
    output: dict[str, Image.Image] = {}
    for key, subject in subjects.items():
        width = max(1, round(subject.width * scale))
        height = max(1, round(subject.height * scale))
        resized = subject.resize((width, height), Image.Resampling.BOX)
        resized.putalpha(resized.getchannel("A").point(lambda value: 255 if value >= 80 else 0))
        frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        x = (FRAME_W - width) // 2
        y = PIVOT[1] - 2 - height
        frame.alpha_composite(resized, (x, y))
        output[key] = frame
    return output


def shared_palette(frames: dict[str, Image.Image], colors: int) -> dict[str, Image.Image]:
    strip = Image.new("RGBA", (FRAME_W * len(SOURCE_KEYS), FRAME_H), (0, 0, 0, 0))
    for index, key in enumerate(SOURCE_KEYS):
        strip.alpha_composite(frames[key], (index * FRAME_W, 0))
    alpha = strip.getchannel("A").point(lambda value: 255 if value >= 80 else 0)
    matte = Image.new("RGB", strip.size, (255, 0, 255))
    matte.paste(strip.convert("RGB"), mask=alpha)
    quantized = matte.quantize(
        colors=colors,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    ).convert("RGBA")
    quantized.putalpha(alpha)
    return {
        key: quantized.crop((index * FRAME_W, 0, (index + 1) * FRAME_W, FRAME_H))
        for index, key in enumerate(SOURCE_KEYS)
    }


def mirror(image: Image.Image) -> Image.Image:
    return image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)


def keep_gutter(image: Image.Image, gutter: int = 2) -> Image.Image:
    bounds = visible_bbox(image)
    dx = 0
    dy = 0
    if bounds[0] < gutter:
        dx = gutter - bounds[0]
    elif bounds[2] > FRAME_W - gutter:
        dx = FRAME_W - gutter - bounds[2]
    if bounds[1] < gutter:
        dy = gutter - bounds[1]
    elif bounds[3] > FRAME_H - gutter:
        dy = FRAME_H - gutter - bounds[3]
    if dx == 0 and dy == 0:
        return image
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output.alpha_composite(image, (dx, dy))
    return output


def row_shear(base: Image.Image, phase: int, profile: str) -> Image.Image:
    output = Image.new("RGBA", base.size, (0, 0, 0, 0))
    stride = STRIDE[phase]
    sway = SWAY[phase]
    bob = BOB_BY_PROFILE[profile][phase]
    gain = MOTION_GAIN[profile]
    bounds = visible_bbox(base)
    vertical_span = max(1, bounds[3] - bounds[1])
    for y in range(FRAME_H):
        normalized = max(0.0, min(1.0, (y - bounds[1]) / vertical_span))
        lower = max(0.0, min(1.0, (normalized - 0.56) / 0.44))
        upper = max(0.0, min(1.0, (0.62 - normalized) / 0.62))
        if profile == "hover":
            shift_x = round(sway * 0.45)
        elif profile == "ambush":
            shift_x = round(sway * (0.2 + upper * 0.8))
        else:
            shift_x = round((sway * (0.25 + upper * 0.35) + stride * lower) * gain)
        target_y = y + bob
        if not 0 <= target_y < FRAME_H:
            continue
        output.alpha_composite(base.crop((0, y, FRAME_W, y + 1)), (shift_x, target_y))
    if profile in {"heavy", "ambush"} and phase in {1, 5}:
        bounds = visible_bbox(output)
        subject = output.crop(bounds)
        target_height = max(1, subject.height - 1)
        subject = subject.resize((subject.width, target_height), Image.Resampling.NEAREST)
        compressed = Image.new("RGBA", output.size, (0, 0, 0, 0))
        compressed.alpha_composite(subject, (bounds[0], bounds[3] - target_height))
        output = compressed
    return keep_gutter(binary_source(output))


def upper_recoil(base: Image.Image) -> Image.Image:
    bounds = visible_bbox(base)
    split = bounds[1] + max(6, round((bounds[3] - bounds[1]) * 0.64))
    output = Image.new("RGBA", base.size, (0, 0, 0, 0))
    output.alpha_composite(base.crop((0, 0, FRAME_W, split)), (2, -1))
    output.alpha_composite(base.crop((0, split, FRAME_W, FRAME_H)), (0, split))
    return keep_gutter(binary_source(output))


def alert_pose(base: Image.Image, strong: bool = False) -> Image.Image:
    output = base.copy()
    bounds = visible_bbox(output)
    draw = ImageDraw.Draw(output)
    x = min(FRAME_W - 4, max(3, bounds[2] - 5))
    y = min(FRAME_H - 9, max(3, bounds[1] + 2))
    gold = (249, 220, 112, 255)
    pale = (255, 246, 204, 255)
    draw.line((x, y, x, y + (5 if strong else 4)), fill=pale, width=2 if strong else 1)
    draw.point((x, y + 7), fill=gold)
    if strong:
        draw.point((x - 2, y + 1), fill=gold)
        draw.point((x + 2, y + 1), fill=gold)
    return keep_gutter(binary_source(output))


def hurt_pose(base: Image.Image) -> Image.Image:
    output = upper_recoil(base)
    bounds = visible_bbox(output)
    draw = ImageDraw.Draw(output)
    x = min(FRAME_W - 7, max(4, bounds[2] - 7))
    y = min(FRAME_H - 8, max(4, bounds[1] + 6))
    draw.line((x, y, x + 5, y + 5), fill=(240, 226, 184, 255), width=1)
    draw.line((x + 5, y, x, y + 5), fill=(191, 57, 57, 255), width=1)
    return keep_gutter(binary_source(output))


def encounter_mark(base: Image.Image, kind: str, strength: int = 1) -> Image.Image:
    output = base.copy()
    bounds = visible_bbox(output)
    draw = ImageDraw.Draw(output)
    x = min(FRAME_W - 5, max(4, bounds[2] - 6))
    y = min(FRAME_H - 9, max(4, bounds[1] + 4))
    if kind == "sense":
        color = (112, 218, 224, 255)
        draw.arc((x - 3, y - 2, x + 4, y + 5), 210, 520, fill=color, width=1)
        draw.point((x, y + 7), fill=color)
    elif kind == "alert":
        color = (255, 232, 142, 255)
        draw.line((x, y, x, y + 5), fill=color, width=1 + int(strength > 1))
        draw.point((x, y + 7), fill=(222, 94, 63, 255))
        if strength > 1:
            draw.point((x - 3, y + 1), fill=color)
            draw.point((x + 3, y + 1), fill=color)
    elif kind == "contact":
        color = (255, 239, 184, 255)
        radius = 2 + strength
        draw.line((x - radius, y, x + radius, y), fill=color, width=1)
        draw.line((x, y - radius, x, y + radius), fill=(210, 66, 62, 255), width=1)
        if strength > 1:
            draw.line((x - 2, y - 2, x + 2, y + 2), fill=color, width=1)
            draw.line((x + 2, y - 2, x - 2, y + 2), fill=color, width=1)
    return keep_gutter(binary_source(output))


def visible_color_count(image: Image.Image) -> int:
    return len({pixel[:3] for pixel in image.getdata() if pixel[3]})


def validate_frame(frame: Image.Image, frame_id: str) -> None:
    assert frame.mode == "RGBA"
    assert frame.size == (FRAME_W, FRAME_H)
    alpha = frame.getchannel("A")
    assert set(alpha.getdata()).issubset({0, 255}), f"{frame_id}: alpha must be binary"
    bounds = visible_bbox(frame)
    assert bounds[0] >= 2 and bounds[1] >= 2, f"{frame_id}: gutter breach {bounds}"
    assert bounds[2] <= FRAME_W - 2 and bounds[3] <= FRAME_H - 2, f"{frame_id}: gutter breach {bounds}"
    assert visible_color_count(frame) <= 56, f"{frame_id}: palette exceeds derivative allowance"


def frame_receipt(
    frame: Image.Image,
    asset_id: str,
    profile: str,
    tag: str,
    row: int,
    column: int,
) -> dict:
    alpha = frame.getchannel("A")
    return {
        "id": f"{asset_id}:{tag}",
        "assetId": asset_id,
        "profile": profile,
        "state": tag,
        "row": row,
        "column": column,
        "rect": [column * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H],
        "pivot": list(PIVOT),
        "footPoint": list(PIVOT),
        "alphaBounds": list(visible_bbox(frame)),
        "opaquePixelCount": sum(1 for value in alpha.getdata() if value),
        "visibleColorCount": visible_color_count(frame),
        "rgbaSha256": sha256(frame.tobytes()),
    }


def build_field_frames(keys: dict[str, Image.Image], profile: str) -> dict[str, Image.Image]:
    bases = {
        "south": keys["south-idle"],
        "north": keys["north-idle"],
        "west": keys["west-contact"],
        "east": mirror(keys["west-contact"]),
    }
    frames: dict[str, Image.Image] = {}
    for direction in DIRECTIONS:
        frames[f"{direction}-idle"] = keep_gutter(binary_source(bases[direction]))
        for phase_index, phase in enumerate(PHASES):
            phase_base = keys["south-extension"] if direction == "south" and phase_index in {3, 7} else bases[direction]
            frames[f"{direction}-{phase}"] = row_shear(phase_base, phase_index, profile)
    frames["south-alert"] = alert_pose(bases["south"], strong=True)
    frames["south-hurt"] = hurt_pose(bases["south"])
    for tag, frame in frames.items():
        validate_frame(frame, tag)
    return frames


def build_trigger_frames(field_frames: dict[str, Image.Image]) -> list[Image.Image]:
    dormant = field_frames["south-idle"]
    frames = [
        dormant,
        field_frames["south-compression-a"],
        field_frames["south-idle"],
        encounter_mark(field_frames["south-contact-a"], "sense"),
        encounter_mark(field_frames["south-passing-a"], "sense", 2),
        encounter_mark(field_frames["south-alert"], "alert"),
        encounter_mark(field_frames["south-alert"], "alert", 2),
        field_frames["south-contact-a"],
        field_frames["south-contact-b"],
        encounter_mark(field_frames["south-extension-a"], "contact"),
        encounter_mark(field_frames["south-extension-b"], "contact", 2),
        field_frames["south-hurt"],
    ]
    for index, frame in enumerate(frames):
        validate_frame(frame, f"trigger-{index:02d}")
    return frames


def extract_source_keys(
    source: dict,
    coverage: dict,
    records: list[dict],
) -> tuple[dict[str, dict[str, Image.Image]], list[dict]]:
    by_id: dict[str, dict[str, Image.Image]] = {}
    source_receipts: list[dict] = []
    record_ids = {record["id"] for record in records}
    for board in coverage["boards"]:
        chroma_path = COVERAGE_ROOT / board["chromaSource"]
        alpha_path = COVERAGE_ROOT / board["alphaSource"]
        chroma = Image.open(chroma_path).convert("RGBA")
        alpha = Image.open(alpha_path).convert("RGBA")
        key = SHARED.key_color(chroma)
        column_bounds, row_bounds = SHARED.detect_grid_boundaries(
            chroma,
            key,
            columns=5,
            rows=len(board["rows"]),
        )
        source_receipts.append({
            "boardId": board["id"],
            "classification": source["sourceClassification"],
            "alphaPath": Path(os.path.relpath(alpha_path, ROOT)).as_posix(),
            "alphaSha256": sha256(alpha_path.read_bytes()),
            "chromaPath": Path(os.path.relpath(chroma_path, ROOT)).as_posix(),
            "chromaSha256": sha256(chroma_path.read_bytes()),
            "dimensions": [alpha.width, alpha.height],
            "detectedColumnBounds": column_bounds,
            "detectedRowBounds": row_bounds,
        })
        for row, record in enumerate(board["rows"]):
            y0, y1 = row_bounds[row], row_bounds[row + 1]
            raw_keys = {
                key_name: alpha.crop((column_bounds[column], y0, column_bounds[column + 1], y1))
                for column, key_name in enumerate(SOURCE_KEYS, start=1)
            }
            profile = source["profiles"][record["id"]]
            maximum = tuple(source["conversion"]["profileContentBoxes"][profile])
            fitted = fit_source_keys(raw_keys, maximum)
            by_id[record["id"]] = shared_palette(
                fitted,
                source["conversion"]["paletteCeilingPerEnemy"],
            )
    assert set(by_id) == record_ids
    return by_id, source_receipts


def checker(width: int, height: int, tile: int = 10) -> Image.Image:
    output = Image.new("RGBA", (width, height), (13, 19, 30, 255))
    draw = ImageDraw.Draw(output)
    colors = ((13, 19, 30, 255), (22, 32, 46, 255))
    for y in range(0, height, tile):
        for x in range(0, width, tile):
            draw.rectangle(
                (x, y, min(width - 1, x + tile - 1), min(height - 1, y + tile - 1)),
                fill=colors[(x // tile + y // tile) % 2],
            )
    return output


def render_contact(atlas: Image.Image, records: list[dict], source: dict) -> Image.Image:
    preview_tags = ("south-idle", "east-idle", "north-idle", "south-alert")
    scale = 2
    card_w = FRAME_W * scale * len(preview_tags) + 16
    card_h = FRAME_H * scale + 28
    columns = 4
    rows = math.ceil(len(records) / columns)
    output = checker(card_w * columns, card_h * rows, 12)
    draw = ImageDraw.Draw(output)
    font = ImageFont.load_default()
    for index, record in enumerate(records):
        card_x = (index % columns) * card_w
        card_y = (index // columns) * card_h
        draw.rectangle(
            (card_x, card_y, card_x + card_w - 1, card_y + card_h - 1),
            outline=(53, 84, 112, 255),
        )
        profile = source["profiles"][record["id"]]
        draw.text(
            (card_x + 6, card_y + 7),
            f'{record["name"]}  [{profile.upper()}]',
            fill=(246, 232, 185, 255),
            font=font,
        )
        for preview_column, tag in enumerate(preview_tags):
            source_column = FIELD_COLUMNS.index(tag)
            frame = atlas.crop((
                source_column * FRAME_W,
                index * FRAME_H,
                (source_column + 1) * FRAME_W,
                (index + 1) * FRAME_H,
            ))
            enlarged = frame.resize((FRAME_W * scale, FRAME_H * scale), Image.Resampling.NEAREST)
            output.alpha_composite(enlarged, (card_x + 8 + preview_column * FRAME_W * scale, card_y + 26))
    return output


def roster_preview_frame(
    atlas: Image.Image,
    records: list[dict],
    column: int,
    *,
    scale: int = 2,
) -> Image.Image:
    columns = 8
    rows = math.ceil(len(records) / columns)
    cell_w = FRAME_W * scale
    cell_h = FRAME_H * scale
    output = checker(columns * cell_w, rows * cell_h, 12)
    for index in range(len(records)):
        frame = atlas.crop((
            column * FRAME_W,
            index * FRAME_H,
            (column + 1) * FRAME_W,
            (index + 1) * FRAME_H,
        ))
        enlarged = frame.resize((cell_w, cell_h), Image.Resampling.NEAREST)
        x = (index % columns) * cell_w
        y = (index // columns) * cell_h
        output.alpha_composite(enlarged, (x, y))
    return output.convert("P", palette=Image.Palette.ADAPTIVE, colors=192)


def render_motion(atlas: Image.Image, records: list[dict]) -> tuple[list[Image.Image], list[int]]:
    frames: list[Image.Image] = []
    durations: list[int] = []
    for direction in DIRECTIONS:
        for phase in PHASES:
            frames.append(roster_preview_frame(atlas, records, FIELD_COLUMNS.index(f"{direction}-{phase}")))
            durations.append(54)
    return frames, durations


def render_trigger_motion(atlas: Image.Image, records: list[dict]) -> tuple[list[Image.Image], list[int]]:
    durations = [280, 320, 110, 160, 120, 170, 230, 90, 105, 120, 80, 180]
    frames = [roster_preview_frame(atlas, records, column) for column in range(len(TRIGGER_COLUMNS))]
    return frames, durations


def build_files() -> dict[Path, bytes]:
    source, coverage, records = load_contract()
    source_keys, board_receipts = extract_source_keys(source, coverage, records)
    field_atlas = Image.new(
        "RGBA",
        (FRAME_W * len(FIELD_COLUMNS), FRAME_H * len(records)),
        (0, 0, 0, 0),
    )
    trigger_atlas = Image.new(
        "RGBA",
        (FRAME_W * len(TRIGGER_COLUMNS), FRAME_H * len(records)),
        (0, 0, 0, 0),
    )
    field_receipts: list[dict] = []
    trigger_receipts: list[dict] = []
    profile_counts: dict[str, int] = {}
    for row, record in enumerate(records):
        asset_id = record["id"]
        profile = source["profiles"][asset_id]
        profile_counts[profile] = profile_counts.get(profile, 0) + 1
        frames = build_field_frames(source_keys[asset_id], profile)
        trigger_frames = build_trigger_frames(frames)
        for column, tag in enumerate(FIELD_COLUMNS):
            frame = frames[tag]
            field_atlas.alpha_composite(frame, (column * FRAME_W, row * FRAME_H))
            field_receipts.append(frame_receipt(frame, asset_id, profile, tag, row, column))
        for column, frame in enumerate(trigger_frames):
            trigger_atlas.alpha_composite(frame, (column * FRAME_W, row * FRAME_H))
            trigger_receipts.append(
                frame_receipt(frame, asset_id, profile, TRIGGER_COLUMNS[column], row, column)
            )

    contact = render_contact(field_atlas, records, source)
    motion_frames, motion_durations = render_motion(field_atlas, records)
    trigger_motion_frames, trigger_motion_durations = render_trigger_motion(trigger_atlas, records)

    field_data = png_bytes(field_atlas)
    trigger_data = png_bytes(trigger_atlas)
    contact_data = png_bytes(contact)
    motion_data = gif_bytes(motion_frames, motion_durations)
    trigger_motion_data = gif_bytes(trigger_motion_frames, trigger_motion_durations)

    coverage_spec_path = ROOT / source["sourceCoverageSpec"]
    coverage_manifest_path = ROOT / source["sourceCoverageManifest"]
    field_alpha = field_atlas.getchannel("A")
    trigger_alpha = trigger_atlas.getchannel("A")
    manifest = {
        "assetId": source["assetId"],
        "formatVersion": source["formatVersion"],
        "classification": source["classification"],
        "sourceClassification": source["sourceClassification"],
        "qualityTarget": source["qualityTarget"],
        "authorshipNote": "Generated concept ancestry is retained; these derived frames are not pixel-authored.",
        "tool": {
            "builder": BUILDER_PATH.name,
            "pillow": PILLOW_VERSION,
            "runtimeResampling": source["conversion"]["resampling"],
            "animationResampling": source["conversion"]["animationResampling"],
            "reviewResampling": source["conversion"]["previewResampling"],
            "dither": source["conversion"]["dither"],
        },
        "geometry": {
            "frameWidth": FRAME_W,
            "frameHeight": FRAME_H,
            "pivot": list(PIVOT),
            "footPoint": list(PIVOT),
            "transparentGutter": 2,
            "alphaPolicy": "binary",
        },
        "fieldAtlas": {
            "path": FIELD_ATLAS_NAME,
            "columns": len(FIELD_COLUMNS),
            "rows": len(records),
            "width": field_atlas.width,
            "height": field_atlas.height,
            "sha256": sha256(field_data),
        },
        "triggerAtlas": {
            "path": TRIGGER_ATLAS_NAME,
            "columns": len(TRIGGER_COLUMNS),
            "rows": len(records),
            "width": trigger_atlas.width,
            "height": trigger_atlas.height,
            "sha256": sha256(trigger_data),
        },
        "rowOrder": [record["id"] for record in records],
        "rows": [
            {
                "id": record["id"],
                "name": record["name"],
                "catalogId": record["catalogId"],
                "group": record["group"],
                "profile": source["profiles"][record["id"]],
            }
            for record in records
        ],
        "profileCounts": profile_counts,
        "columnOrder": list(FIELD_COLUMNS),
        "triggerColumnOrder": list(TRIGGER_COLUMNS),
        "directions": list(DIRECTIONS),
        "walkPhases": list(PHASES),
        "clips": {
            direction: {
                "idle": [f"{direction}-idle"],
                "walk": [f"{direction}-{phase}" for phase in PHASES],
                "frameDurationMs": source["animation"]["walkFrameDurationMs"],
                "loop": True,
            }
            for direction in DIRECTIONS
        } | {
            "alert": {
                "frames": ["south-alert"],
                "frameDurationMs": [source["animation"]["alertFrameDurationMs"]],
                "loop": False,
            },
            "hurt": {
                "frames": ["south-hurt"],
                "frameDurationMs": [source["animation"]["hurtFrameDurationMs"]],
                "loop": False,
            },
        },
        "triggerClips": source["triggerClips"],
        "rootMotionOwnership": source["animation"]["rootMotion"],
        "conversion": source["conversion"],
        "sources": [
            {
                "path": SOURCE_PATH.name,
                "role": "conversion-geometry-timing-contract",
                "sha256": sha256(SOURCE_PATH.read_bytes()),
            },
            {
                "path": Path(os.path.relpath(coverage_spec_path, ROOT)).as_posix(),
                "role": "generated-source-grid-and-roster-contract",
                "classification": source["sourceClassification"],
                "sha256": sha256(coverage_spec_path.read_bytes()),
            },
            {
                "path": Path(os.path.relpath(coverage_manifest_path, ROOT)).as_posix(),
                "role": "source-provenance-and-grid-receipts",
                "sha256": sha256(coverage_manifest_path.read_bytes()),
            },
            *board_receipts,
        ],
        "frames": field_receipts,
        "triggerFrames": trigger_receipts,
        "exports": [
            {
                "path": FIELD_ATLAS_NAME,
                "purpose": "transparent-field-runtime-atlas",
                "width": field_atlas.width,
                "height": field_atlas.height,
                "mode": field_atlas.mode,
                "sha256": sha256(field_data),
            },
            {
                "path": TRIGGER_ATLAS_NAME,
                "purpose": "transparent-encounter-trigger-runtime-atlas",
                "width": trigger_atlas.width,
                "height": trigger_atlas.height,
                "mode": trigger_atlas.mode,
                "sha256": sha256(trigger_data),
            },
            {
                "path": CONTACT_NAME,
                "purpose": "opaque-nearest-neighbor-review",
                "width": contact.width,
                "height": contact.height,
                "previewScale": 2,
                "sha256": sha256(contact_data),
            },
            {
                "path": MOTION_NAME,
                "purpose": "nearest-neighbor-four-direction-motion-review",
                "width": motion_frames[0].width,
                "height": motion_frames[0].height,
                "frames": len(motion_frames),
                "sha256": sha256(motion_data),
            },
            {
                "path": TRIGGER_PREVIEW_NAME,
                "purpose": "nearest-neighbor-encounter-trigger-review",
                "width": trigger_motion_frames[0].width,
                "height": trigger_motion_frames[0].height,
                "frames": len(trigger_motion_frames),
                "sha256": sha256(trigger_motion_data),
            },
        ],
        "validation": {
            "fieldFrameCount": len(field_receipts),
            "expectedFieldFrameCount": len(records) * len(FIELD_COLUMNS),
            "triggerFrameCount": len(trigger_receipts),
            "expectedTriggerFrameCount": len(records) * len(TRIGGER_COLUMNS),
            "fieldBinaryAlpha": set(field_alpha.getdata()).issubset({0, 255}),
            "triggerBinaryAlpha": set(trigger_alpha.getdata()).issubset({0, 255}),
            "maximumVisibleColorsPerFieldFrame": max(frame["visibleColorCount"] for frame in field_receipts),
            "maximumVisibleColorsPerTriggerFrame": max(frame["visibleColorCount"] for frame in trigger_receipts),
            "uniqueFieldFrameHashes": len({frame["rgbaSha256"] for frame in field_receipts}),
            "uniqueTriggerFrameHashes": len({frame["rgbaSha256"] for frame in trigger_receipts}),
            "runtimeCopies": [
                str((RUNTIME_ROOT / FIELD_ATLAS_NAME).relative_to(ROOT.parents[2])),
                str((RUNTIME_ROOT / TRIGGER_ATLAS_NAME).relative_to(ROOT.parents[2])),
            ],
        },
        "review": {
            "runtimeIntegration": "campaign enemy tokens plus isolated encounter-trigger sampler",
            "remaining": "human in-game scale review and external cultural review remain advisable",
        },
    }
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return {
        ROOT / FIELD_ATLAS_NAME: field_data,
        ROOT / TRIGGER_ATLAS_NAME: trigger_data,
        ROOT / CONTACT_NAME: contact_data,
        ROOT / MOTION_NAME: motion_data,
        ROOT / TRIGGER_PREVIEW_NAME: trigger_motion_data,
        ROOT / MANIFEST_NAME: manifest_data,
        RUNTIME_ROOT / FIELD_ATLAS_NAME: field_data,
        RUNTIME_ROOT / TRIGGER_ATLAS_NAME: trigger_data,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs = build_files()
    if args.check:
        failures = [
            str(path)
            for path, expected in outputs.items()
            if not path.exists() or path.read_bytes() != expected
        ]
        if failures:
            raise SystemExit("Generated outputs differ:\n" + "\n".join(failures))
        print(f"PASS byte-identical rebuild: {len(outputs)} files")
        return 0
    for path, data in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        print(f"WROTE {path.relative_to(ROOT.parents[2])} ({len(data)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
