from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "enemy-animation-suite-v2.source.json"
BUILDER_PATH = Path(__file__).resolve()
REVIEW_BACKGROUND = (11, 16, 32)
REVIEW_PANEL = (20, 28, 44)
REVIEW_RULE = (51, 70, 99)
REVIEW_TEXT = (215, 201, 154)
REVIEW_MUTED = (136, 200, 197)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def gif_bytes(frames: list[Image.Image], durations: list[int]) -> bytes:
    if len(frames) != len(durations):
        raise ValueError("GIF frame and duration counts must match")
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


def load_config() -> dict[str, Any]:
    return json.loads(SOURCE_PATH.read_text(encoding="utf-8"))


def proportional_cell(
    source: Image.Image,
    column: int,
    row: int,
    columns: int,
    rows: int,
) -> Image.Image:
    left = round(column * source.width / columns)
    right = round((column + 1) * source.width / columns)
    top = round(row * source.height / rows)
    bottom = round((row + 1) * source.height / rows)
    return source.crop((left, top, right, bottom))


def binary_alpha(image: Image.Image, threshold: int = 128) -> Image.Image:
    result = image.convert("RGBA")
    result.putalpha(
        result.getchannel("A").point(lambda value: 255 if value >= threshold else 0)
    )
    return result


def remove_small_alpha_components(
    frame: Image.Image,
    minimum_pixels: int,
    maximum_edge_debris_pixels: int,
    edge_debris_inset: int,
) -> Image.Image:
    alpha = frame.getchannel("A")
    remaining = {
        (x, y)
        for y in range(frame.height)
        for x in range(frame.width)
        if alpha.getpixel((x, y)) == 255
    }
    keep: set[tuple[int, int]] = set()
    while remaining:
        seed = remaining.pop()
        component = {seed}
        frontier = [seed]
        while frontier:
            x, y = frontier.pop()
            for neighbor in (
                (x - 1, y),
                (x + 1, y),
                (x, y - 1),
                (x, y + 1),
            ):
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.add(neighbor)
                    frontier.append(neighbor)
        touches_edge = any(
            x <= edge_debris_inset
            or y <= edge_debris_inset
            or x >= frame.width - edge_debris_inset - 1
            or y >= frame.height - edge_debris_inset - 1
            for x, y in component
        )
        is_edge_debris = (
            touches_edge
            and len(component) <= maximum_edge_debris_pixels
        )
        if len(component) >= minimum_pixels and not is_edge_debris:
            keep.update(component)

    clean_alpha = Image.new("L", frame.size, 0)
    clean_alpha.putdata(
        [
            255 if (x, y) in keep else 0
            for y in range(frame.height)
            for x in range(frame.width)
        ]
    )
    clean = frame.copy()
    clean.putalpha(clean_alpha)
    return clean


def normalize_cell(
    cell: Image.Image,
    frame_size: tuple[int, int],
    maximum_content: tuple[int, int],
    bottom_gutter: int,
    minimum_component_pixels: int,
    maximum_edge_debris_pixels: int,
    edge_debris_inset: int,
) -> Image.Image:
    hardened = binary_alpha(cell)
    clean = remove_small_alpha_components(
        hardened,
        minimum_pixels=minimum_component_pixels,
        maximum_edge_debris_pixels=maximum_edge_debris_pixels,
        edge_debris_inset=edge_debris_inset,
    )
    bounds = clean.getchannel("A").getbbox()
    if not bounds:
        clean = remove_small_alpha_components(
            hardened,
            minimum_pixels=minimum_component_pixels,
            maximum_edge_debris_pixels=0,
            edge_debris_inset=0,
        )
        bounds = clean.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Source grid cell contains no opaque art")
    trimmed = clean.crop(bounds)
    scale = min(
        maximum_content[0] / trimmed.width,
        maximum_content[1] / trimmed.height,
    )
    resized_size = (
        max(1, round(trimmed.width * scale)),
        max(1, round(trimmed.height * scale)),
    )
    resized = trimmed.resize(resized_size, Image.Resampling.BOX)
    resized = binary_alpha(resized)
    frame = Image.new("RGBA", frame_size, (0, 0, 0, 0))
    x = (frame_size[0] - resized.width) // 2
    y = frame_size[1] - bottom_gutter - resized.height
    if x < 0 or y < 0:
        raise ValueError(f"Normalized content does not fit: {resized.size}")
    frame.alpha_composite(resized, (x, y))
    return frame


def palette_seed(frames: list[Image.Image], colors: int) -> Image.Image:
    montage = Image.new(
        "RGB",
        (frames[0].width, frames[0].height * len(frames)),
        REVIEW_BACKGROUND,
    )
    for index, frame in enumerate(frames):
        layer = Image.new("RGB", frame.size, REVIEW_BACKGROUND)
        layer.paste(frame.convert("RGB"), mask=frame.getchannel("A"))
        montage.paste(layer, (0, index * frame.height))
    return montage.quantize(
        colors=colors,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )


def apply_bounded_palette(
    frame: Image.Image,
    palette: Image.Image,
) -> Image.Image:
    rgb = Image.new("RGB", frame.size, REVIEW_BACKGROUND)
    rgb.paste(frame.convert("RGB"), mask=frame.getchannel("A"))
    paletted = rgb.quantize(
        palette=palette,
        dither=Image.Dither.NONE,
    ).convert("RGB")
    result = paletted.convert("RGBA")
    result.putalpha(frame.getchannel("A"))
    return result


def alpha_bounds(frame: Image.Image) -> list[int]:
    bounds = frame.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Runtime frame cannot be empty")
    return list(bounds)


def transparent_gutter(frame: Image.Image) -> dict[str, int]:
    left, top, right, bottom = alpha_bounds(frame)
    return {
        "left": left,
        "top": top,
        "right": frame.width - right,
        "bottom": frame.height - bottom,
    }


def visible_color_count(frame: Image.Image) -> int:
    return len({pixel[:3] for pixel in frame.getdata() if pixel[3]})


def validate_runtime_frame(
    frame: Image.Image,
    frame_id: str,
    minimum_gutter: int,
    color_ceiling: int,
) -> dict[str, Any]:
    alpha_values = sorted(set(frame.getchannel("A").getdata()))
    if alpha_values != [0, 255]:
        raise ValueError(f"{frame_id} has non-binary alpha: {alpha_values}")
    gutter = transparent_gutter(frame)
    if min(gutter.values()) < minimum_gutter:
        raise ValueError(
            f"{frame_id} violates the {minimum_gutter}px gutter: {gutter}"
        )
    colors = visible_color_count(frame)
    if colors > color_ceiling:
        raise ValueError(f"{frame_id} exceeds {color_ceiling} colors: {colors}")
    return {
        "alphaBounds": alpha_bounds(frame),
        "transparentGutter": gutter,
        "visibleColors": colors,
        "alphaValues": alpha_values,
    }


def build_atlas(
    frames: list[Image.Image],
    columns: int,
    rows: int,
    frame_size: tuple[int, int],
) -> Image.Image:
    if len(frames) != columns * rows:
        raise ValueError(f"Expected {columns * rows} frames, got {len(frames)}")
    atlas = Image.new(
        "RGBA",
        (columns * frame_size[0], rows * frame_size[1]),
        (0, 0, 0, 0),
    )
    for index, frame in enumerate(frames):
        column = index % columns
        row = index // columns
        atlas.alpha_composite(
            frame,
            (column * frame_size[0], row * frame_size[1]),
        )
    return atlas


def review_frame(frame: Image.Image, scale: int = 2) -> Image.Image:
    enlarged = frame.resize(
        (frame.width * scale, frame.height * scale),
        Image.Resampling.NEAREST,
    )
    panel = Image.new("RGB", enlarged.size, REVIEW_PANEL)
    panel.paste(enlarged.convert("RGB"), mask=enlarged.getchannel("A"))
    return panel


def load_review_font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def make_roster_contact_sheet(
    enemy_frames: list[tuple[dict[str, Any], list[Image.Image]]],
) -> Image.Image:
    columns = 4
    rows = 3
    art_size = 320
    label_height = 52
    header_height = 54
    width = columns * art_size
    height = header_height + rows * (art_size + label_height)
    sheet = Image.new("RGB", (width, height), REVIEW_BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    title_font = load_review_font(20)
    label_font = load_review_font(14)
    draw.text(
        (16, 16),
        "CANONICAL ENEMY ANIMATION SUITE V2 - SIGNATURE READABILITY FRAMES",
        fill=REVIEW_TEXT,
        font=title_font,
    )
    for index, (enemy, frames) in enumerate(enemy_frames):
        column = index % columns
        row = index // columns
        x = column * art_size
        y = header_height + row * (art_size + label_height)
        active = frames[enemy.get("reviewFrameIndex", 2 * 6 + 3)]
        sheet.paste(review_frame(active), (x, y))
        draw.rectangle(
            (x, y, x + art_size - 1, y + art_size + label_height - 1),
            outline=REVIEW_RULE,
        )
        draw.text(
            (x + 10, y + art_size + 8),
            f"{enemy['catalogId']}  {enemy['name']}",
            fill=REVIEW_TEXT,
            font=label_font,
        )
        draw.text(
            (x + 10, y + art_size + 29),
            enemy["signatureId"],
            fill=REVIEW_MUTED,
            font=label_font,
        )
    return sheet


def source_record(path: Path, role: str, enemy_id: str) -> dict[str, Any]:
    data = path.read_bytes()
    with Image.open(io.BytesIO(data)) as image:
        return {
            "enemyId": enemy_id,
            "role": role,
            "path": path.relative_to(ROOT).as_posix(),
            "sha256": sha256(data),
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
        }


def export_record(
    path: str,
    role: str,
    data: bytes,
    width: int,
    height: int,
    mode: str,
    enemy_id: str | None = None,
) -> dict[str, Any]:
    record: dict[str, Any] = {
        "path": path,
        "role": role,
        "sha256": sha256(data),
        "width": width,
        "height": height,
        "mode": mode,
    }
    if enemy_id is not None:
        record["enemyId"] = enemy_id
    return record


def build_artifacts() -> dict[str, bytes]:
    config = load_config()
    grid = config["sourceGrid"]
    runtime = config["runtimeAtlas"]
    columns = grid["columns"]
    rows = grid["rows"]
    frame_size = (runtime["frameWidth"], runtime["frameHeight"])
    maximum_content = (
        runtime["maximumContentWidth"],
        runtime["maximumContentHeight"],
    )
    clips_by_row = {
        clip["row"]: clip
        for clip in config["clips"]
    }

    artifacts: dict[str, bytes] = {}
    sources: list[dict[str, Any]] = []
    exports: list[dict[str, Any]] = []
    frame_records: list[dict[str, Any]] = []
    enemy_records: list[dict[str, Any]] = []
    contact_inputs: list[tuple[dict[str, Any], list[Image.Image]]] = []

    for enemy in config["enemies"]:
        alpha_path = ROOT / enemy["sourceAlpha"]
        chroma_path = ROOT / enemy["sourceChroma"]
        sources.append(source_record(chroma_path, "generated-chroma-source", enemy["id"]))
        sources.append(source_record(alpha_path, "transparent-source", enemy["id"]))
        source = Image.open(alpha_path).convert("RGBA")
        raw_frames: list[Image.Image] = []
        for row in range(rows):
            for column in range(columns):
                raw_frames.append(
                    normalize_cell(
                        proportional_cell(
                            source,
                            column,
                            row,
                            columns,
                            rows,
                        ),
                        frame_size=frame_size,
                        maximum_content=maximum_content,
                        bottom_gutter=runtime["bottomGutter"],
                        minimum_component_pixels=runtime[
                            "minimumComponentPixelsAtSourceResolution"
                        ],
                        maximum_edge_debris_pixels=runtime[
                            "maximumEdgeDebrisPixelsAtSourceResolution"
                        ],
                        edge_debris_inset=runtime[
                            "edgeDebrisInsetAtSourceResolution"
                        ],
                    )
                )

        palette = palette_seed(raw_frames, runtime["visibleColorCeiling"])
        frames = [
            apply_bounded_palette(frame, palette)
            for frame in raw_frames
        ]
        rgba_hashes = [sha256(frame.tobytes()) for frame in frames]
        if len(set(rgba_hashes)) != columns * rows:
            raise ValueError(f"{enemy['id']} does not have 24 distinct runtime cels")

        enemy_frame_records: list[dict[str, Any]] = []
        for index, (frame, rgba_hash) in enumerate(zip(frames, rgba_hashes, strict=True)):
            row = index // columns
            column = index % columns
            clip = clips_by_row[row]
            validation = validate_runtime_frame(
                frame,
                f"{enemy['id']}:{clip['id']}:{column}",
                minimum_gutter=runtime["minimumTransparentGutter"],
                color_ceiling=runtime["visibleColorCeiling"],
            )
            events = [
                (
                    enemy["signatureId"]
                    if event["name"] == "enemy-signature"
                    else event["name"]
                )
                for event in clip["events"]
                if event["frameIndex"] == column
            ]
            record = {
                "id": f"{enemy['id']}:{clip['id']}:{column}",
                "enemyId": enemy["id"],
                "clipId": clip["id"],
                "row": row,
                "frameIndex": column,
                "rect": [
                    column * frame_size[0],
                    row * frame_size[1],
                    frame_size[0],
                    frame_size[1],
                ],
                "durationMs": clip["frameDurationsMs"][column],
                "phase": clip["phases"][column],
                "events": events,
                "pivot": config["anchorProfiles"][enemy["profile"]]["pivot"],
                "foot": config["anchorProfiles"][enemy["profile"]]["foot"],
                "hurtBounds": config["anchorProfiles"][enemy["profile"]][
                    "hurtBounds"
                ],
                "rgbaSha256": rgba_hash,
                **validation,
            }
            frame_records.append(record)
            enemy_frame_records.append(record)

        atlas = build_atlas(frames, columns, rows, frame_size)
        atlas_name = f"{enemy['id']}-atlas-v2.png"
        atlas_data = png_bytes(atlas)
        artifacts[atlas_name] = atlas_data
        exports.append(
            export_record(
                atlas_name,
                "transparent-runtime-candidate",
                atlas_data,
                atlas.width,
                atlas.height,
                atlas.mode,
                enemy["id"],
            )
        )

        review_frames = [review_frame(frame) for frame in frames]
        durations = [
            clips_by_row[index // columns]["frameDurationsMs"][index % columns]
            for index in range(columns * rows)
        ]
        gif_name = f"{enemy['id']}-all-actions-v2.gif"
        gif_data = gif_bytes(review_frames, durations)
        artifacts[gif_name] = gif_data
        exports.append(
            export_record(
                gif_name,
                "nearest-neighbor-review-only",
                gif_data,
                review_frames[0].width,
                review_frames[0].height,
                "P",
                enemy["id"],
            )
        )
        enemy_records.append(
            {
                **{
                    key: enemy[key]
                    for key in (
                        "catalogId",
                        "id",
                        "name",
                        "role",
                        "profile",
                        "signatureId",
                    )
                },
                "reviewFrameIndex": enemy.get("reviewFrameIndex", 15),
                "atlas": atlas_name,
                "reviewGif": gif_name,
                "frameCount": len(frames),
                "distinctFrameCount": len(set(rgba_hashes)),
                "maximumVisibleColorsInFrame": max(
                    record["visibleColors"]
                    for record in enemy_frame_records
                ),
            }
        )
        contact_inputs.append((enemy, frames))

    contact_sheet = make_roster_contact_sheet(contact_inputs)
    contact_name = "enemy-animation-roster-contact-sheet-v2.png"
    contact_data = png_bytes(contact_sheet)
    artifacts[contact_name] = contact_data
    exports.append(
        export_record(
            contact_name,
            "labeled-review-only-not-runtime",
            contact_data,
            contact_sheet.width,
            contact_sheet.height,
            contact_sheet.mode,
        )
    )

    manifest = {
        "schemaVersion": 1,
        "assetId": config["assetId"],
        "title": config["title"],
        "status": config["status"],
        "provenance": config["provenance"],
        "build": {
            "builder": BUILDER_PATH.name,
            "builderSha256": sha256(BUILDER_PATH.read_bytes()),
            "sourceContract": SOURCE_PATH.name,
            "sourceContractSha256": sha256(SOURCE_PATH.read_bytes()),
            "pillowVersion": PILLOW_VERSION,
            "deterministicCheck": (
                "python build_enemy_animation_suite_v2.py --check"
            ),
        },
        "geometry": {
            "columns": columns,
            "rows": rows,
            "frameWidth": frame_size[0],
            "frameHeight": frame_size[1],
            "atlasWidth": runtime["atlasWidth"],
            "atlasHeight": runtime["atlasHeight"],
            "minimumTransparentGutter": runtime["minimumTransparentGutter"],
        },
        "palette": {
            "visibleColorCeilingPerEnemy": runtime["visibleColorCeiling"],
            "dither": runtime["dither"],
            "resampling": runtime["resampling"],
            "alphaPolicy": runtime["alphaPolicy"],
        },
        "clips": config["clips"],
        "anchorProfiles": config["anchorProfiles"],
        "enemyOrder": [enemy["id"] for enemy in config["enemies"]],
        "enemies": enemy_records,
        "sources": sources,
        "exports": exports,
        "frames": frame_records,
        "runtimeIntegration": {
            "status": "reviewed-runtime-candidates-not-yet-wired",
            "remaining": (
                "Choose per-encounter scale, pivots, hurt boxes, hit boxes, "
                "and event anchors in the action-combat runtime before promotion."
            ),
        },
    }
    artifacts["manifest.json"] = canonical_json_bytes(manifest)
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
        print(
            f"OK: {len(artifacts)} enemy animation artifacts are byte-identical"
        )
    else:
        print(f"Wrote {len(artifacts)} enemy animation artifacts")


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
