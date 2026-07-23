from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "kurozane-final-battle.source.json"
REVIEW_BACKGROUND = "#0B1020"
REVIEW_PANEL = "#141C2C"
REVIEW_RULE = "#334663"
REVIEW_TEXT = "#D7C99A"
REVIEW_MUTED = "#88C8C5"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def load_config() -> dict[str, Any]:
    return json.loads(SOURCE_PATH.read_text(encoding="utf-8"))


def load_rgba(relative_path: str, expected_size: tuple[int, int]) -> Image.Image:
    path = ROOT / relative_path
    image = Image.open(path).convert("RGBA")
    if image.size != expected_size:
        raise ValueError(f"{path.name} must be {expected_size}, got {image.size}")
    return image


def crop_grid_cell(
    source: Image.Image,
    column: int,
    row: int,
    cell_width: int,
    cell_height: int,
) -> Image.Image:
    left = column * cell_width
    top = row * cell_height
    return source.crop((left, top, left + cell_width, top + cell_height))


def resize_with_fixed_gutter(
    source: Image.Image,
    frame_size: tuple[int, int],
    content_size: tuple[int, int],
    content_offset: tuple[int, int],
) -> Image.Image:
    resized = source.resize(content_size, Image.Resampling.BOX)
    frame = Image.new("RGBA", frame_size, (0, 0, 0, 0))
    frame.alpha_composite(resized, content_offset)
    return frame


def remove_small_alpha_components(
    frame: Image.Image,
    minimum_pixels: int,
    alpha_threshold: int = 128,
    maximum_edge_debris_pixels: int | None = None,
) -> Image.Image:
    """Remove isolated chroma-key debris while retaining authored silhouettes and VFX."""
    alpha = frame.getchannel("A")
    remaining = {
        (x, y)
        for y in range(frame.height)
        for x in range(frame.width)
        if alpha.getpixel((x, y)) >= alpha_threshold
    }
    keep: set[tuple[int, int]] = set()
    while remaining:
        seed = remaining.pop()
        component = {seed}
        frontier = [seed]
        while frontier:
            x, y = frontier.pop()
            for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.add(neighbor)
                    frontier.append(neighbor)
        touches_safe_edge = any(
            x <= 2 or y <= 2 or x >= frame.width - 3 or y >= frame.height - 3
            for x, y in component
        )
        is_edge_debris = (
            maximum_edge_debris_pixels is not None
            and touches_safe_edge
            and len(component) <= maximum_edge_debris_pixels
        )
        if len(component) >= minimum_pixels and not is_edge_debris:
            keep.update(component)

    clean_alpha = Image.new("L", frame.size, 0)
    clean_alpha.putdata(
        [
            alpha.getpixel((x, y)) if (x, y) in keep else 0
            for y in range(frame.height)
            for x in range(frame.width)
        ]
    )
    clean = frame.copy()
    clean.putalpha(clean_alpha)
    return clean


def palette_seed(frames: list[Image.Image], colors: int) -> Image.Image:
    width = max(frame.width for frame in frames)
    height = sum(frame.height for frame in frames)
    montage = Image.new("RGB", (width, height), REVIEW_BACKGROUND)
    top = 0
    for frame in frames:
        layer = Image.new("RGB", frame.size, REVIEW_BACKGROUND)
        layer.paste(frame.convert("RGB"), mask=frame.getchannel("A"))
        montage.paste(layer, (0, top))
        top += frame.height
    return montage.quantize(
        colors=colors,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )


def apply_bounded_palette(
    frame: Image.Image,
    palette: Image.Image,
    alpha_threshold: int = 128,
) -> Image.Image:
    rgb = Image.new("RGB", frame.size, REVIEW_BACKGROUND)
    rgb.paste(frame.convert("RGB"), mask=frame.getchannel("A"))
    paletted = rgb.quantize(palette=palette, dither=Image.Dither.NONE).convert("RGB")
    alpha = frame.getchannel("A").point(lambda value: 255 if value >= alpha_threshold else 0)
    result = paletted.convert("RGBA")
    result.putalpha(alpha)
    return result


def alpha_bounds(frame: Image.Image) -> list[int] | None:
    box = frame.getchannel("A").getbbox()
    return list(box) if box else None


def transparent_gutter(frame: Image.Image) -> dict[str, int]:
    bounds = frame.getchannel("A").getbbox()
    if not bounds:
        return {"left": frame.width, "top": frame.height, "right": frame.width, "bottom": frame.height}
    left, top, right, bottom = bounds
    return {
        "left": left,
        "top": top,
        "right": frame.width - right,
        "bottom": frame.height - bottom,
    }


def validate_gutter(frame: Image.Image, minimum: int, frame_id: str) -> dict[str, int]:
    gutter = transparent_gutter(frame)
    if min(gutter.values()) < minimum:
        raise ValueError(f"{frame_id} violates {minimum}px gutter: {gutter}")
    return gutter


def visible_color_count(image: Image.Image) -> int:
    return len({pixel[:3] for pixel in image.getdata() if pixel[3]})


def alpha_values(image: Image.Image) -> list[int]:
    return sorted(set(image.getchannel("A").getdata()))


def build_atlas(
    frames: list[Image.Image],
    columns: int,
    rows: int,
    frame_width: int,
    frame_height: int,
) -> Image.Image:
    if len(frames) != columns * rows:
        raise ValueError(f"Expected {columns * rows} frames, got {len(frames)}")
    atlas = Image.new("RGBA", (columns * frame_width, rows * frame_height), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        column = index % columns
        row = index // columns
        atlas.alpha_composite(frame, (column * frame_width, row * frame_height))
    return atlas


def review_frame(frame: Image.Image, scale: int) -> Image.Image:
    enlarged = frame.resize((frame.width * scale, frame.height * scale), Image.Resampling.NEAREST)
    panel = Image.new("RGB", enlarged.size, REVIEW_PANEL)
    panel.paste(enlarged.convert("RGB"), mask=enlarged.getchannel("A"))
    return panel


def make_portrait_contact_sheet(
    frames: list[Image.Image],
    expressions: list[dict[str, Any]],
) -> Image.Image:
    scale = 3
    columns = 4
    rows = 2
    panel_width = frames[0].width * scale
    art_height = frames[0].height * scale
    label_height = 34
    header_height = 42
    sheet = Image.new(
        "RGB",
        (columns * panel_width, header_height + rows * (art_height + label_height)),
        REVIEW_BACKGROUND,
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((10, 13), "KUROZANE PORTRAIT EXPRESSIONS - REVIEW ONLY", fill=REVIEW_TEXT, font=font)
    for index, (frame, expression) in enumerate(zip(frames, expressions, strict=True)):
        column = index % columns
        row = index // columns
        x = column * panel_width
        y = header_height + row * (art_height + label_height)
        sheet.paste(review_frame(frame, scale), (x, y))
        draw.rectangle((x, y, x + panel_width - 1, y + art_height + label_height - 1), outline=REVIEW_RULE)
        label = f"{index + 1:02d} {expression['id'].upper()} / {expression['state']}"
        draw.text((x + 8, y + art_height + 10), label, fill=REVIEW_MUTED, font=font)
    return sheet


def make_combat_contact_sheet(
    frames: list[Image.Image],
    clips: list[dict[str, Any]],
) -> Image.Image:
    scale = 2
    columns = 6
    rows = 4
    panel_width = frames[0].width * scale
    art_height = frames[0].height * scale
    label_height = 32
    header_height = 42
    sheet = Image.new(
        "RGB",
        (columns * panel_width, header_height + rows * (art_height + label_height)),
        REVIEW_BACKGROUND,
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((10, 13), "KUROZANE FINAL BATTLE KEYFRAMES - REVIEW ONLY", fill=REVIEW_TEXT, font=font)
    for row, clip in enumerate(clips):
        for column in range(columns):
            index = row * columns + column
            frame = frames[index]
            x = column * panel_width
            y = header_height + row * (art_height + label_height)
            sheet.paste(review_frame(frame, scale), (x, y))
            draw.rectangle((x, y, x + panel_width - 1, y + art_height + label_height - 1), outline=REVIEW_RULE)
            phase = clip["phases"][column]
            label = f"{clip['id']} {column + 1}/6 {phase}"
            draw.text((x + 7, y + art_height + 9), label, fill=REVIEW_MUTED, font=font)
    return sheet


def gif_bytes(
    frames: list[Image.Image],
    durations: list[int],
    scale: int,
) -> bytes:
    if len(frames) != len(durations):
        raise ValueError("GIF frame and duration counts differ")
    review_frames = [review_frame(frame, scale) for frame in frames]
    palette_montage = Image.new(
        "RGB",
        (review_frames[0].width, review_frames[0].height * len(review_frames)),
        REVIEW_BACKGROUND,
    )
    for index, frame in enumerate(review_frames):
        palette_montage.paste(frame, (0, index * frame.height))
    palette = palette_montage.quantize(
        colors=256,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )
    paletted = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in review_frames]
    stream = io.BytesIO()
    paletted[0].save(
        stream,
        format="GIF",
        save_all=True,
        append_images=paletted[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=False,
    )
    return stream.getvalue()


def artifact_record(data: bytes) -> dict[str, Any]:
    with Image.open(io.BytesIO(data)) as image:
        return {
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
            "format": image.format,
            "frameCount": getattr(image, "n_frames", 1),
            "sha256": sha256(data),
            "bytes": len(data),
        }


def source_record(relative_path: str) -> dict[str, Any]:
    path = ROOT / relative_path
    data = path.read_bytes()
    with Image.open(io.BytesIO(data)) as image:
        return {
            "path": relative_path,
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
            "sha256": sha256(data),
            "bytes": len(data),
        }


def frame_record(
    frame: Image.Image,
    frame_id: str,
    atlas_column: int,
    atlas_row: int,
    frame_width: int,
    frame_height: int,
    minimum_gutter: int,
) -> dict[str, Any]:
    return {
        "id": frame_id,
        "atlasRect": [
            atlas_column * frame_width,
            atlas_row * frame_height,
            frame_width,
            frame_height,
        ],
        "rawRgbaSha256": sha256(frame.tobytes()),
        "alphaBounds": alpha_bounds(frame),
        "transparentGutter": validate_gutter(frame, minimum_gutter, frame_id),
    }


def build_artifacts() -> dict[str, bytes]:
    config = load_config()
    expected_size = tuple(config["sources"]["sourceDimensions"])
    portrait_source = load_rgba(config["sources"]["portraitAlpha"], expected_size)
    combat_source = load_rgba(config["sources"]["combatAlpha"], expected_size)

    portrait_grid = config["portrait"]["sourceGrid"]
    portrait_runtime = config["portrait"]["runtimeAtlas"]
    portrait_unquantized: list[Image.Image] = []
    for expression in config["portrait"]["expressions"]:
        source_column, source_row = expression["source"]
        cell = crop_grid_cell(
            portrait_source,
            source_column,
            source_row,
            portrait_grid["cellWidth"],
            portrait_grid["cellHeight"],
        )
        portrait_unquantized.append(
            remove_small_alpha_components(
                resize_with_fixed_gutter(
                    cell,
                    (portrait_runtime["frameWidth"], portrait_runtime["frameHeight"]),
                    (93, 124),
                    (17, 2),
                ),
                config["palette"]["portraitMinimumComponentPixels"],
            )
        )
    portrait_palette = palette_seed(
        portrait_unquantized,
        config["palette"]["portraitVisibleColorCeiling"],
    )
    portrait_frames = [
        apply_bounded_palette(frame, portrait_palette)
        for frame in portrait_unquantized
    ]
    portrait_atlas = build_atlas(
        portrait_frames,
        portrait_runtime["columns"],
        portrait_runtime["rows"],
        portrait_runtime["frameWidth"],
        portrait_runtime["frameHeight"],
    )

    combat_grid = config["combat"]["sourceGrid"]
    combat_runtime = config["combat"]["runtimeAtlas"]
    combat_unquantized: list[Image.Image] = []
    for row in range(combat_grid["rows"]):
        for column in range(combat_grid["columns"]):
            cell = crop_grid_cell(
                combat_source,
                column,
                row,
                combat_grid["cellWidth"],
                combat_grid["cellHeight"],
            )
            combat_unquantized.append(
                remove_small_alpha_components(
                    resize_with_fixed_gutter(
                        cell,
                        (combat_runtime["frameWidth"], combat_runtime["frameHeight"]),
                        (156, 156),
                        (2, 2),
                    ),
                    config["palette"]["combatMinimumComponentPixels"],
                    maximum_edge_debris_pixels=config["palette"][
                        "combatMaximumEdgeDebrisPixels"
                    ],
                )
            )
    combat_palette = palette_seed(
        combat_unquantized,
        config["palette"]["combatVisibleColorCeiling"],
    )
    combat_frames = [
        apply_bounded_palette(frame, combat_palette)
        for frame in combat_unquantized
    ]
    combat_atlas = build_atlas(
        combat_frames,
        combat_runtime["columns"],
        combat_runtime["rows"],
        combat_runtime["frameWidth"],
        combat_runtime["frameHeight"],
    )

    artifacts: dict[str, bytes] = {
        config["outputs"]["portraitAtlas"]: png_bytes(portrait_atlas),
        config["outputs"]["portraitContactSheet"]: png_bytes(
            make_portrait_contact_sheet(portrait_frames, config["portrait"]["expressions"])
        ),
        config["outputs"]["portraitGif"]: gif_bytes(
            portrait_frames,
            [expression["previewDurationMs"] for expression in config["portrait"]["expressions"]],
            scale=4,
        ),
        config["outputs"]["combatAtlas"]: png_bytes(combat_atlas),
        config["outputs"]["combatContactSheet"]: png_bytes(
            make_combat_contact_sheet(combat_frames, config["combat"]["clips"])
        ),
    }

    all_clip_frames: list[Image.Image] = []
    all_clip_durations: list[int] = []
    for clip in config["combat"]["clips"]:
        row = clip["row"]
        start = row * combat_runtime["columns"]
        clip_frames = combat_frames[start:start + combat_runtime["columns"]]
        clip_durations = list(clip["frameDurationsMs"])
        clip_durations[-1] += 380
        gif_name = config["outputs"]["clipGifPattern"].replace("{clipId}", clip["id"])
        artifacts[gif_name] = gif_bytes(clip_frames, clip_durations, scale=3)
        all_clip_frames.extend(frame.copy() for frame in clip_frames)
        all_clip_durations.extend(clip_durations)
    artifacts[config["outputs"]["allClipsGif"]] = gif_bytes(
        all_clip_frames,
        all_clip_durations,
        scale=3,
    )

    portrait_minimum = portrait_runtime["minimumTransparentGutter"]
    portrait_records = []
    for index, (frame, expression) in enumerate(
        zip(portrait_frames, config["portrait"]["expressions"], strict=True)
    ):
        record = frame_record(
            frame,
            expression["id"],
            index,
            0,
            portrait_runtime["frameWidth"],
            portrait_runtime["frameHeight"],
            portrait_minimum,
        )
        record.update(
            {
                "state": expression["state"],
                "sourceCell": expression["source"],
                "previewDurationMs": expression["previewDurationMs"],
            }
        )
        portrait_records.append(record)

    combat_minimum = combat_runtime["minimumTransparentGutter"]
    combat_records = []
    anchor_profiles = config["combat"]["anchorProfiles"]
    for clip in config["combat"]["clips"]:
        row = clip["row"]
        for column in range(combat_runtime["columns"]):
            index = row * combat_runtime["columns"] + column
            frame = combat_frames[index]
            if "anchorProfileByFrame" in clip:
                anchor_profile_id = clip["anchorProfileByFrame"][column]
            else:
                anchor_profile_id = clip["anchorProfile"]
            events = [
                event
                for event in clip["events"]
                if event["frameIndex"] == column
            ]
            record = frame_record(
                frame,
                f"{clip['id']}:{column}",
                column,
                row,
                combat_runtime["frameWidth"],
                combat_runtime["frameHeight"],
                combat_minimum,
            )
            record.update(
                {
                    "clipId": clip["id"],
                    "frameIndex": column,
                    "phase": clip["phases"][column],
                    "durationMs": clip["frameDurationsMs"][column],
                    "state": clip["state"],
                    "anchorProfile": anchor_profile_id,
                    "pivot": anchor_profiles[anchor_profile_id]["pivot"],
                    "foot": anchor_profiles[anchor_profile_id]["foot"],
                    "hurtBounds": anchor_profiles[anchor_profile_id]["hurtBounds"],
                    "events": events,
                }
            )
            combat_records.append(record)

    portrait_alpha = alpha_values(portrait_atlas)
    combat_alpha = alpha_values(combat_atlas)
    if portrait_alpha != [0, 255] or combat_alpha != [0, 255]:
        raise ValueError(
            f"Atlases require binary alpha; portrait={portrait_alpha}, combat={combat_alpha}"
        )
    portrait_colors = visible_color_count(portrait_atlas)
    combat_colors = visible_color_count(combat_atlas)
    if portrait_colors > config["palette"]["portraitVisibleColorCeiling"]:
        raise ValueError(f"Portrait atlas has {portrait_colors} visible colors")
    if combat_colors > config["palette"]["combatVisibleColorCeiling"]:
        raise ValueError(f"Combat atlas has {combat_colors} visible colors")
    if len({record["rawRgbaSha256"] for record in portrait_records}) != len(portrait_records):
        raise ValueError("Portrait atlas contains duplicate cels")
    if len({record["rawRgbaSha256"] for record in combat_records}) != len(combat_records):
        raise ValueError("Combat atlas contains duplicate cels")

    manifest = {
        "schemaVersion": 1,
        "assetId": config["assetId"],
        "status": config["status"],
        "provenance": config["provenance"],
        "build": {
            "builder": {
                "path": Path(__file__).name,
                "sha256": sha256(Path(__file__).read_bytes()),
            },
            "sourceContract": {
                "path": SOURCE_PATH.name,
                "sha256": sha256(SOURCE_PATH.read_bytes()),
            },
            "pillowVersion": PILLOW_VERSION,
            "resampling": config["palette"]["resampling"],
            "dither": config["palette"]["dither"],
            "alphaPolicy": config["palette"]["alphaPolicy"],
        },
        "sources": [
            source_record(config["sources"]["portraitChroma"]),
            source_record(config["sources"]["portraitAlpha"]),
            source_record(config["sources"]["combatChroma"]),
            source_record(config["sources"]["combatAlpha"]),
        ],
        "portrait": {
            "geometry": portrait_runtime,
            "visibleColors": portrait_colors,
            "alphaValues": portrait_alpha,
            "frames": portrait_records,
        },
        "combat": {
            "geometry": combat_runtime,
            "visibleColors": combat_colors,
            "alphaValues": combat_alpha,
            "clips": config["combat"]["clips"],
            "frames": combat_records,
        },
        "safety": config["safety"],
        "artifacts": {
            name: artifact_record(data)
            for name, data in sorted(artifacts.items())
        },
        "review": {
            "humanVisualReviewRequired": True,
            "gifPolicy": "Review artifacts only; runtime timing, events, pivots, and bounds remain authoritative in this manifest.",
            "remainingBeforeRuntimeIntegration": [
                "Bind portrait expression IDs to Chapter 9 dialogue gesture cues.",
                "Add a Kurozane-specific atlas loader and select clips from canonical boss phase and skill events.",
                "Verify weapon anchors, hurt bounds, and dawn-lane VFX inside the live battle renderer.",
            ],
        },
    }
    artifacts[config["outputs"]["manifest"]] = canonical_json_bytes(manifest)
    return artifacts


def write_or_check(artifacts: dict[str, bytes], check: bool) -> None:
    mismatches: list[str] = []
    for name, expected in artifacts.items():
        path = ROOT / name
        if check:
            if not path.exists():
                mismatches.append(f"missing {name}")
            elif path.read_bytes() != expected:
                mismatches.append(f"changed {name}")
        else:
            path.write_bytes(expected)
    if mismatches:
        raise SystemExit("Build check failed: " + ", ".join(mismatches))
    if check:
        print(f"OK: {len(artifacts)} Kurozane animation artifacts are byte-identical")
    else:
        print(f"Wrote {len(artifacts)} Kurozane animation artifacts")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="Rebuild in memory and require byte-identical checked-in artifacts.",
    )
    args = parser.parse_args()
    write_or_check(build_artifacts(), args.check)


if __name__ == "__main__":
    main()
