from __future__ import annotations

import argparse
import hashlib
import json
import math
import tempfile
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SPEC_PATH = ROOT / "late-snes-roster-suite.source.json"
BUILDER_PATH = Path(__file__).resolve()
POSES = ("idle", "move", "signature", "hurt-defeat")
CONTACT_NAME = "late-snes-roster-contact-sheet-v1.png"
MANIFEST_NAME = "manifest.json"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_path(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def proportional_bounds(index: int, count: int, length: int) -> tuple[int, int]:
    return round(index * length / count), round((index + 1) * length / count)


def detect_grid_boundaries(
    image: Image.Image,
    key: tuple[int, int, int],
    columns: int,
    rows: int,
    threshold: int = 92,
) -> tuple[list[int], list[int]]:
    """Find low-ink valleys near expected grid divisions to avoid model cell drift."""
    rgb = image.convert("RGB")
    width, height = rgb.size
    threshold_sq = threshold * threshold
    column_counts = [0] * width
    row_counts = [0] * height
    for index, (r, g, b) in enumerate(rgb.getdata()):
        distance_sq = (r - key[0]) ** 2 + (g - key[1]) ** 2 + (b - key[2]) ** 2
        if distance_sq > threshold_sq:
            x = index % width
            y = index // width
            column_counts[x] += 1
            row_counts[y] += 1

    def find_boundaries(counts: list[int], sections: int) -> list[int]:
        length = len(counts)
        section = length / sections
        boundaries = [0]
        for division in range(1, sections):
            expected = round(division * section)
            radius = round(section * 0.28)
            start = max(boundaries[-1] + round(section * 0.45), expected - radius)
            end = min(length - 1, expected + radius)
            candidates: list[tuple[float, int, int]] = []
            for position in range(start, end + 1):
                low = max(0, position - 2)
                high = min(length, position + 3)
                neighborhood = sum(counts[low:high]) / (high - low)
                candidates.append((neighborhood, abs(position - expected), position))
            boundaries.append(min(candidates)[2])
        boundaries.append(length)
        return boundaries

    return find_boundaries(column_counts, columns), find_boundaries(row_counts, rows)


def key_color(image: Image.Image) -> tuple[int, int, int]:
    samples: list[tuple[int, int, int]] = []
    rgb = image.convert("RGB")
    w, h = rgb.size
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        samples.append(rgb.getpixel((x, y)))
    return tuple(sorted(channel_values)[len(channel_values) // 2] for channel_values in zip(*samples))


def remove_chroma(cell: Image.Image, key: tuple[int, int, int], threshold: int = 92) -> Image.Image:
    rgba = cell.convert("RGBA")
    pixels = list(rgba.getdata())
    threshold_sq = threshold * threshold
    cleaned: list[tuple[int, int, int, int]] = []
    for r, g, b, _ in pixels:
        distance_sq = (r - key[0]) ** 2 + (g - key[1]) ** 2 + (b - key[2]) ** 2
        if distance_sq <= threshold_sq:
            cleaned.append((0, 0, 0, 0))
        else:
            cleaned.append((r, g, b, 255))
    rgba.putdata(cleaned)
    return rgba


def filter_components(
    image: Image.Image,
    *,
    preserve_distant_vfx: bool,
) -> Image.Image:
    """Drop isolated source-board debris without deleting meaningful detached VFX."""
    width, height = image.size
    alpha = image.getchannel("A")
    occupied = bytearray(1 if value else 0 for value in alpha.getdata())
    visited = bytearray(width * height)
    components: list[dict] = []

    for seed, is_occupied in enumerate(occupied):
        if not is_occupied or visited[seed]:
            continue
        visited[seed] = 1
        queue = deque([seed])
        indices: list[int] = []
        min_x = width
        min_y = height
        max_x = 0
        max_y = 0
        while queue:
            index = queue.popleft()
            indices.append(index)
            x = index % width
            y = index // width
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
            if x > 0:
                neighbor = index - 1
                if occupied[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if x + 1 < width:
                neighbor = index + 1
                if occupied[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y > 0:
                neighbor = index - width
                if occupied[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y + 1 < height:
                neighbor = index + width
                if occupied[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
        components.append(
            {
                "indices": indices,
                "count": len(indices),
                "bbox": (min_x, min_y, max_x + 1, max_y + 1),
            }
        )

    if not components:
        return image
    largest = max(components, key=lambda component: component["count"])
    largest_count = largest["count"]
    lx0, ly0, lx1, ly1 = largest["bbox"]
    near_distance = round(max(width, height) * (0.12 if preserve_distant_vfx else 0.04))
    retained = bytearray(width * height)

    for component in components:
        x0, y0, x1, y1 = component["bbox"]
        gap_x = max(lx0 - x1, x0 - lx1, 0)
        gap_y = max(ly0 - y1, y0 - ly1, 0)
        near_main = max(gap_x, gap_y) <= near_distance
        substantial_shape = min(x1 - x0, y1 - y0) >= max(3, round(min(width, height) * 0.05))
        meaningful_distant = (
            component["count"] >= max(16, round(largest_count * 0.05))
            and substantial_shape
        )
        meaningful_near = component["count"] >= max(4, round(largest_count * 0.001))
        if (
            component is largest
            or (preserve_distant_vfx and meaningful_distant)
            or (near_main and meaningful_near)
        ):
            for index in component["indices"]:
                retained[index] = 255

    cleaned = image.copy()
    cleaned.putalpha(Image.frombytes("L", image.size, bytes(retained)))
    return cleaned


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError("Chroma removal produced an empty frame")
    return bbox


def quantize_visible(image: Image.Image, colors: int) -> Image.Image:
    alpha = image.getchannel("A")
    quantized = image.quantize(
        colors=colors,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.NONE,
    ).convert("RGBA")
    quantized.putalpha(alpha.point(lambda value: 255 if value >= 128 else 0))
    return quantized


def build_frame(
    cell: Image.Image,
    key: tuple[int, int, int],
    frame_width: int,
    frame_height: int,
    max_width: int,
    max_height: int,
    bottom_gutter: int,
    colors: int,
    preserve_distant_vfx: bool,
) -> Image.Image:
    transparent = filter_components(
        remove_chroma(cell, key),
        preserve_distant_vfx=preserve_distant_vfx,
    )
    subject = transparent.crop(visible_bbox(transparent))
    scale = min(max_width / subject.width, max_height / subject.height)
    target = (
        max(1, round(subject.width * scale)),
        max(1, round(subject.height * scale)),
    )
    subject = subject.resize(target, Image.Resampling.BOX)
    subject.putalpha(subject.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
    subject = quantize_visible(subject, colors)
    canvas = Image.new("RGBA", (frame_width, frame_height), (0, 0, 0, 0))
    x = (frame_width - subject.width) // 2
    y = frame_height - bottom_gutter - subject.height
    canvas.alpha_composite(subject, (x, y))
    return canvas


def visible_palette_count(image: Image.Image) -> int:
    return len({(r, g, b) for r, g, b, a in image.getdata() if a > 0})


def binary_alpha(image: Image.Image) -> bool:
    return set(image.getchannel("A").getdata()).issubset({0, 255})


def transparent_gutters(image: Image.Image) -> dict[str, int]:
    bbox = visible_bbox(image)
    return {
        "left": bbox[0],
        "top": bbox[1],
        "right": image.width - bbox[2],
        "bottom": image.height - bbox[3],
    }


def checker_preview(atlas: Image.Image, scale: int = 4) -> Image.Image:
    large = atlas.resize((atlas.width * scale, atlas.height * scale), Image.Resampling.NEAREST)
    background = Image.new("RGBA", large.size, (12, 18, 31, 255))
    draw = ImageDraw.Draw(background)
    tile = 16
    for y in range(0, large.height, tile):
        for x in range(0, large.width, tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(20, 32, 52, 255))
    background.alpha_composite(large)
    return background.convert("RGB")


def load_font(size: int) -> ImageFont.ImageFont:
    for name in ("DejaVuSansMono.ttf", "DejaVuSans.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def contact_sheet(records: list[dict], atlases: dict[str, Image.Image]) -> Image.Image:
    columns = 3
    card_width = 536
    card_height = 174
    header_height = 34
    rows = math.ceil(len(records) / columns)
    sheet = Image.new("RGB", (columns * card_width, rows * card_height), (7, 11, 23))
    draw = ImageDraw.Draw(sheet)
    title_font = load_font(16)
    meta_font = load_font(12)
    for index, record in enumerate(records):
        column = index % columns
        row = index // columns
        x = column * card_width
        y = row * card_height
        fill = (13, 22, 38) if (column + row) % 2 == 0 else (16, 27, 46)
        draw.rectangle((x + 1, y + 1, x + card_width - 2, y + card_height - 2), fill=fill, outline=(42, 69, 102))
        draw.text((x + 10, y + 7), record["name"], font=title_font, fill=(240, 220, 160))
        meta = f'{record["catalogId"]} · {record["group"]} · {record["signature"]}'
        draw.text((x + 10, y + 23), meta, font=meta_font, fill=(123, 197, 203))
        enlarged = atlases[record["id"]].resize((512, 128), Image.Resampling.NEAREST)
        sheet.paste(enlarged, (x + 12, y + header_height + 6), enlarged)
    return sheet


def collect_expected_paths(records: list[dict]) -> list[Path]:
    paths = [Path(CONTACT_NAME), Path(MANIFEST_NAME)]
    for record in records:
        paths.append(Path("sprites") / f'{record["id"]}-four-pose-v1.png')
        paths.append(Path("previews") / f'{record["id"]}-four-pose-preview-v1.png')
    return paths


def build(output_root: Path) -> list[Path]:
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    runtime = spec["runtimeAtlas"]
    frame_width = runtime["frameWidth"]
    frame_height = runtime["frameHeight"]
    max_width = runtime["maximumContentWidth"]
    max_height = runtime["maximumContentHeight"]
    bottom_gutter = runtime["bottomGutter"]
    colors = runtime["visibleColorCeiling"]
    (output_root / "sprites").mkdir(parents=True, exist_ok=True)
    (output_root / "previews").mkdir(parents=True, exist_ok=True)

    records: list[dict] = []
    atlases: dict[str, Image.Image] = {}
    source_receipts: list[dict] = []
    asset_receipts: list[dict] = []

    for board in spec["boards"]:
        source_path = ROOT / board["source"]
        source = Image.open(source_path).convert("RGBA")
        key = key_color(source)
        column_bounds, row_bounds = detect_grid_boundaries(
            source,
            key,
            columns=4,
            rows=len(board["rows"]),
        )
        source_receipts.append(
            {
                "boardId": board["id"],
                "path": board["source"],
                "sha256": sha256_path(source_path),
                "width": source.width,
                "height": source.height,
                "rows": len(board["rows"]),
                "columns": 4,
                "keyColor": list(key),
                "detectedColumnBounds": column_bounds,
                "detectedRowBounds": row_bounds,
            }
        )
        for row_index, record in enumerate(board["rows"]):
            y0, y1 = row_bounds[row_index], row_bounds[row_index + 1]
            frames: list[Image.Image] = []
            frame_receipts: list[dict] = []
            for column_index, pose in enumerate(POSES):
                x0, x1 = column_bounds[column_index], column_bounds[column_index + 1]
                cell = source.crop((x0, y0, x1, y1))
                inset_x = round(cell.width * board.get("cellInsetXRatio", 0.01))
                inset_y = round(cell.height * board.get("cellInsetYRatio", 0.02))
                if inset_x or inset_y:
                    cell = cell.crop(
                        (
                            inset_x,
                            inset_y,
                            cell.width - inset_x,
                            cell.height - inset_y,
                        )
                    )
                pose_masks = record.get("poseMasks", {}).get(pose, [])
                if pose_masks:
                    mask_draw = ImageDraw.Draw(cell)
                    for left, top, right, bottom in pose_masks:
                        mask_draw.rectangle(
                            (
                                round(left * cell.width),
                                round(top * cell.height),
                                round(right * cell.width),
                                round(bottom * cell.height),
                            ),
                            fill=(*key, 255),
                        )
                frame = build_frame(
                    cell,
                    key,
                    frame_width,
                    frame_height,
                    max_width,
                    max_height,
                    bottom_gutter,
                    colors,
                    pose == "signature",
                )
                native_masks = record.get("nativePoseMasks", {}).get(pose, [])
                if native_masks:
                    native_draw = ImageDraw.Draw(frame)
                    for left, top, right, bottom in native_masks:
                        native_draw.rectangle(
                            (left, top, right, bottom),
                            fill=(0, 0, 0, 0),
                        )
                frames.append(frame)
                frame_receipts.append(
                    {
                        "pose": pose,
                        "sha256Rgba": sha256_bytes(frame.tobytes()),
                        "visibleColors": visible_palette_count(frame),
                        "binaryAlpha": binary_alpha(frame),
                        "visibleBounds": list(visible_bbox(frame)),
                        "transparentGutters": transparent_gutters(frame),
                    }
                )
            atlas = Image.new("RGBA", (frame_width * 4, frame_height), (0, 0, 0, 0))
            for frame_index, frame in enumerate(frames):
                atlas.alpha_composite(frame, (frame_index * frame_width, 0))
            atlas_path = output_root / "sprites" / f'{record["id"]}-four-pose-v1.png'
            preview_path = output_root / "previews" / f'{record["id"]}-four-pose-preview-v1.png'
            atlas.save(atlas_path, optimize=False)
            checker_preview(atlas).save(preview_path, optimize=False)
            atlases[record["id"]] = atlas
            records.append(record)
            asset_receipts.append(
                {
                    **record,
                    "sourceBoard": board["id"],
                    "sourceRow": row_index,
                    "atlas": atlas_path.relative_to(output_root).as_posix(),
                    "atlasSha256": sha256_path(atlas_path),
                    "preview": preview_path.relative_to(output_root).as_posix(),
                    "previewSha256": sha256_path(preview_path),
                    "frames": frame_receipts,
                }
            )

    sheet_path = output_root / CONTACT_NAME
    contact_sheet(records, atlases).save(sheet_path, optimize=False)
    manifest = {
        "schemaVersion": 1,
        "assetId": spec["assetId"],
        "status": spec["status"],
        "provenance": spec["provenance"],
        "runtimeAtlas": runtime,
        "poseOrder": list(POSES),
        "identityCount": len(records),
        "combatantCount": 36,
        "bossStateCount": 4,
        "sourceBoards": source_receipts,
        "builder": {
            "path": BUILDER_PATH.name,
            "sha256": sha256_path(BUILDER_PATH),
            "deterministic": True,
        },
        "contactSheet": {
            "path": CONTACT_NAME,
            "sha256": sha256_path(sheet_path),
            "width": Image.open(sheet_path).width,
            "height": Image.open(sheet_path).height,
        },
        "assets": asset_receipts,
    }
    manifest_path = output_root / MANIFEST_NAME
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return collect_expected_paths(records)


def check() -> None:
    with tempfile.TemporaryDirectory(prefix="late-snes-roster-check-") as temp:
        temp_root = Path(temp)
        expected = build(temp_root)
        mismatches: list[str] = []
        for relative in expected:
            committed = ROOT / relative
            rebuilt = temp_root / relative
            if not committed.exists():
                mismatches.append(f"missing: {relative.as_posix()}")
            elif committed.read_bytes() != rebuilt.read_bytes():
                mismatches.append(f"changed: {relative.as_posix()}")
        if mismatches:
            raise SystemExit("Deterministic check failed:\n" + "\n".join(mismatches))
    print("Deterministic check passed: all generated outputs are byte-identical.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the original late-16-bit JRPG combat roster suite.")
    parser.add_argument("--check", action="store_true", help="Rebuild in a temporary directory and compare bytes.")
    args = parser.parse_args()
    if args.check:
        check()
    else:
        outputs = build(ROOT)
        print(f"Built {len(outputs) - 2} atlases/previews plus contact sheet and manifest.")


if __name__ == "__main__":
    main()
