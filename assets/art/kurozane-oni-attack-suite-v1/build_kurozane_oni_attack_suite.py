from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "kurozane-oni-attack-suite.source.json"
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


def load_rgba(path: Path, expected_size: tuple[int, int]) -> Image.Image:
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


def fixed_cell_frame(source: Image.Image, frame_size: int = 160, gutter: int = 2) -> Image.Image:
    content_size = frame_size - gutter * 2
    resized = source.resize((content_size, content_size), Image.Resampling.BOX)
    frame = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    frame.alpha_composite(resized, (gutter, gutter))
    return frame


def trim_fit_frame(
    source: Image.Image,
    maximum_extent: int,
    frame_size: int = 160,
    gutter: int = 2,
) -> Image.Image:
    bounds = source.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Source cell is fully transparent")
    cropped = source.crop(bounds)
    available = min(frame_size - gutter * 2, maximum_extent)
    scale = min(available / cropped.width, available / cropped.height)
    target = (
        max(1, int(cropped.width * scale)),
        max(1, int(cropped.height * scale)),
    )
    resized = cropped.resize(target, Image.Resampling.BOX)
    x = (frame_size - resized.width) // 2
    y = frame_size - gutter - resized.height
    frame = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    frame.alpha_composite(resized, (x, y))
    return frame


def remove_small_alpha_components(
    frame: Image.Image,
    minimum_pixels: int,
    sliver_aspect_ratio: float,
    minimum_sliver_height: int,
    alpha_threshold: int = 128,
) -> Image.Image:
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
        xs = [point[0] for point in component]
        ys = [point[1] for point in component]
        width = max(xs) - min(xs) + 1
        height = max(ys) - min(ys) + 1
        is_vertical_sliver = (
            height >= minimum_sliver_height
            and height >= width * sliver_aspect_ratio
        )
        if len(component) >= minimum_pixels and not is_vertical_sliver:
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


def build_atlas(
    frames: list[Image.Image],
    columns: int,
    rows: int,
    frame_width: int,
    frame_height: int,
) -> Image.Image:
    if len(frames) != columns * rows:
        raise ValueError(f"Atlas expects {columns * rows} frames, got {len(frames)}")
    atlas = Image.new(
        "RGBA",
        (columns * frame_width, rows * frame_height),
        (0, 0, 0, 0),
    )
    for index, frame in enumerate(frames):
        atlas.alpha_composite(
            frame,
            ((index % columns) * frame_width, (index // columns) * frame_height),
        )
    return atlas


def review_frame(frame: Image.Image, scale: int) -> Image.Image:
    enlarged = frame.resize(
        (frame.width * scale, frame.height * scale),
        Image.Resampling.NEAREST,
    )
    panel = Image.new("RGB", enlarged.size, REVIEW_PANEL)
    panel.paste(enlarged.convert("RGB"), mask=enlarged.getchannel("A"))
    return panel


def make_contact_sheet(
    frames: list[Image.Image],
    frame_metadata: list[dict[str, Any]],
) -> Image.Image:
    scale = 2
    columns = 6
    rows = 6
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
    draw.text(
        (10, 13),
        "KUROZANE ONI ATTACK KEYFRAMES - REVIEW ONLY",
        fill=REVIEW_TEXT,
        font=font,
    )
    for index, (frame, metadata) in enumerate(zip(frames, frame_metadata, strict=True)):
        column = index % columns
        row = index // columns
        x = column * panel_width
        y = header_height + row * (art_height + label_height)
        sheet.paste(review_frame(frame, scale), (x, y))
        draw.rectangle(
            (x, y, x + panel_width - 1, y + art_height + label_height - 1),
            outline=REVIEW_RULE,
        )
        label = (
            f"{metadata['clipId']} {metadata['frameIndex'] + 1}/"
            f"{metadata['frameCount']} {metadata['phase']}"
        )
        draw.text(
            (x + 7, y + art_height + 9),
            label,
            fill=REVIEW_MUTED,
            font=font,
        )
    return sheet


def gif_bytes(frames: list[Image.Image], durations: list[int], scale: int = 3) -> bytes:
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
    paletted = [
        frame.quantize(palette=palette, dither=Image.Dither.NONE)
        for frame in review_frames
    ]
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


def alpha_bounds(frame: Image.Image) -> list[int] | None:
    bounds = frame.getchannel("A").getbbox()
    return list(bounds) if bounds else None


def transparent_gutter(frame: Image.Image) -> dict[str, int]:
    bounds = frame.getchannel("A").getbbox()
    if not bounds:
        return {
            "left": frame.width,
            "top": frame.height,
            "right": frame.width,
            "bottom": frame.height,
        }
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


def build_source_segment_frames(
    segment: dict[str, Any],
    board_configs: dict[str, dict[str, Any]],
    boards: dict[str, Image.Image],
    minimum_component_pixels: int,
    sliver_aspect_ratio: float,
    minimum_sliver_height: int,
) -> list[Image.Image]:
    board_config = board_configs[segment["board"]]
    board = boards[segment["board"]]
    frames: list[Image.Image] = []
    for column in range(board_config["columns"]):
        cell = crop_grid_cell(
            board,
            column,
            segment["row"],
            board_config["cellWidth"],
            board_config["cellHeight"],
        )
        if board_config["fitMode"] == "fixed-cell":
            frame = fixed_cell_frame(cell)
        elif board_config["fitMode"] == "trim-fit":
            frame = trim_fit_frame(cell, board_config["maximumExtent"])
        else:
            raise ValueError(f"Unknown fit mode {board_config['fitMode']}")
        frames.append(
            remove_small_alpha_components(
                frame,
                minimum_component_pixels,
                sliver_aspect_ratio,
                minimum_sliver_height,
            )
        )
    return frames


def build_artifacts() -> dict[str, bytes]:
    config = load_config()
    board_configs = config["sources"]["boards"]
    boards = {
        board_id: load_rgba(
            ROOT / board["alpha"],
            (board["width"], board["height"]),
        )
        for board_id, board in board_configs.items()
    }
    runtime = config["combat"]["runtimeAtlas"]
    minimum_component_pixels = config["palette"]["minimumComponentPixels"]
    sliver_aspect_ratio = config["palette"]["sliverAspectRatio"]
    minimum_sliver_height = config["palette"]["minimumSliverHeight"]

    unquantized_frames: list[Image.Image] = []
    frame_metadata: list[dict[str, Any]] = []
    clip_ranges: dict[str, tuple[int, int]] = {}
    for clip in config["combat"]["clips"]:
        clip_start = len(unquantized_frames)
        clip_frame_index = 0
        for segment in clip["sourceSegments"]:
            segment_frames = build_source_segment_frames(
                segment,
                board_configs,
                boards,
                minimum_component_pixels,
                sliver_aspect_ratio,
                minimum_sliver_height,
            )
            for frame in segment_frames:
                unquantized_frames.append(frame)
                frame_metadata.append(
                    {
                        "clipId": clip["id"],
                        "frameIndex": clip_frame_index,
                        "frameCount": len(clip["frameDurationsMs"]),
                        "phase": clip["phases"][clip_frame_index],
                    }
                )
                clip_frame_index += 1
        expected_count = len(clip["frameDurationsMs"])
        if clip_frame_index != expected_count or len(clip["phases"]) != expected_count:
            raise ValueError(
                f"{clip['id']} expected {expected_count} frames, built {clip_frame_index}"
            )
        clip_ranges[clip["id"]] = (clip_start, len(unquantized_frames))

    stable_palette_frames = [
        frame
        for segment in config["palette"]["stableSeedSegments"]
        for frame in build_source_segment_frames(
            segment,
            board_configs,
            boards,
            minimum_component_pixels,
            sliver_aspect_ratio,
            minimum_sliver_height,
        )
    ]
    palette = palette_seed(
        stable_palette_frames,
        config["palette"]["visibleColorCeiling"],
    )
    frames = [apply_bounded_palette(frame, palette) for frame in unquantized_frames]
    atlas = build_atlas(
        frames,
        runtime["columns"],
        runtime["rows"],
        runtime["frameWidth"],
        runtime["frameHeight"],
    )

    artifacts: dict[str, bytes] = {
        config["outputs"]["atlas"]: png_bytes(atlas),
        config["outputs"]["contactSheet"]: png_bytes(
            make_contact_sheet(frames, frame_metadata)
        ),
        config["outputs"]["allClipsGif"]: gif_bytes(
            frames,
            [
                duration
                for clip in config["combat"]["clips"]
                for duration in clip["frameDurationsMs"]
            ],
        ),
    }
    for clip in config["combat"]["clips"]:
        start, end = clip_ranges[clip["id"]]
        gif_name = config["outputs"]["clipGifPattern"].format(clipId=clip["id"])
        artifacts[gif_name] = gif_bytes(
            frames[start:end],
            clip["frameDurationsMs"],
        )

    anchor_profiles = config["combat"]["anchorProfiles"]
    minimum_gutter = runtime["minimumTransparentGutter"]
    frame_records: list[dict[str, Any]] = []
    for global_index, (frame, metadata) in enumerate(
        zip(frames, frame_metadata, strict=True)
    ):
        clip = next(
            candidate
            for candidate in config["combat"]["clips"]
            if candidate["id"] == metadata["clipId"]
        )
        local_index = metadata["frameIndex"]
        if "anchorProfileByFrame" in clip:
            anchor_profile_id = clip["anchorProfileByFrame"][local_index]
        else:
            anchor_profile_id = clip["anchorProfile"]
        anchor_profile = anchor_profiles[anchor_profile_id]
        events = [
            event for event in clip["events"] if event["frameIndex"] == local_index
        ]
        frame_records.append(
            {
                "id": f"{clip['id']}:{local_index}",
                "atlasRect": [
                    (global_index % runtime["columns"]) * runtime["frameWidth"],
                    (global_index // runtime["columns"]) * runtime["frameHeight"],
                    runtime["frameWidth"],
                    runtime["frameHeight"],
                ],
                "rawRgbaSha256": sha256(frame.tobytes()),
                "alphaBounds": alpha_bounds(frame),
                "transparentGutter": validate_gutter(
                    frame,
                    minimum_gutter,
                    f"{clip['id']}:{local_index}",
                ),
                "clipId": clip["id"],
                "frameIndex": local_index,
                "phase": clip["phases"][local_index],
                "durationMs": clip["frameDurationsMs"][local_index],
                "state": clip["state"],
                "anchorProfile": anchor_profile_id,
                "pivot": anchor_profile["pivot"],
                "foot": anchor_profile["foot"],
                "hurtBounds": anchor_profile["hurtBounds"],
                "events": events,
            }
        )

    atlas_alpha = alpha_values(atlas)
    if atlas_alpha != [0, 255]:
        raise ValueError(f"Atlas requires binary alpha, got {atlas_alpha}")
    visible_colors = visible_color_count(atlas)
    if visible_colors > config["palette"]["visibleColorCeiling"]:
        raise ValueError(f"Atlas has {visible_colors} visible colors")
    if len({record["rawRgbaSha256"] for record in frame_records}) != len(frame_records):
        raise ValueError("Atlas contains duplicate cels")

    source_records = []
    for board in board_configs.values():
        source_records.append(source_record(board["chroma"]))
        source_records.append(source_record(board["alpha"]))
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
        "sources": source_records,
        "combat": {
            "geometry": runtime,
            "visibleColors": visible_colors,
            "alphaValues": atlas_alpha,
            "clips": config["combat"]["clips"],
            "frames": frame_records,
        },
        "safety": config["safety"],
        "artifacts": {
            name: artifact_record(data) for name, data in sorted(artifacts.items())
        },
        "review": {
            "humanVisualReviewRequired": True,
            "gifPolicy": (
                "Review artifacts only; runtime timing, events, pivots, and bounds "
                "remain authoritative in this manifest."
            ),
            "remainingBeforeRuntimeIntegration": [
                "Bind the five Oni attack IDs to the canonical Kurozane phase controller.",
                "Author gameplay hitboxes and projectile trajectories from the declared event frames.",
                "Verify jump root motion, spear reach, beam lanes, and spiral-fireball readability in the live renderer.",
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
        print(f"OK: {len(artifacts)} Oni attack artifacts are byte-identical")
    else:
        print(f"Wrote {len(artifacts)} Oni attack artifacts")


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
