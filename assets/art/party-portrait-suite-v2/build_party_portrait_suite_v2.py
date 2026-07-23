#!/usr/bin/env python3
"""Build the 96px party portrait expression atlas deterministically."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
CONTRACT_PATH = ROOT / "party-portrait-suite-v2.source.json"
ATLAS_NAME = "party-portrait-expressions-v2.png"
CONTACT_NAME = "party-portrait-expressions-v2-contact-sheet.png"
MANIFEST_NAME = "manifest.json"
README_NAME = "README.md"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def rgba(hex_color: str) -> tuple[int, int, int, int]:
    value = hex_color.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (255,)


def load_contract() -> dict:
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    frame = contract["frame"]
    atlas = contract["atlas"]
    sheet = contract["sheet"]
    source_sheet = contract["sourceSheet"]
    assert frame["width"] == frame["height"] == 96
    assert atlas["width"] == frame["width"] * atlas["columns"]
    assert atlas["height"] == frame["height"] * atlas["rows"]
    assert len(sheet["rows"]) == atlas["rows"]
    assert len(sheet["columns"]) == atlas["columns"]
    assert source_sheet["width"] == source_sheet["cellWidth"] * source_sheet["columns"]
    assert source_sheet["height"] == source_sheet["cellHeight"] * source_sheet["rows"]
    assert tuple(sheet["rows"]) == tuple(character["id"] for character in contract["characters"])
    assert tuple(sheet["columns"]) == tuple(contract["expressions"])
    return contract


def crop_expression(source: Image.Image, contract: dict, expression: str) -> Image.Image:
    source_sheet = contract["sourceSheet"]
    source_column, source_row = contract["sheet"]["sourceCoordinates"][expression]
    cell_left = source_column * source_sheet["cellWidth"]
    cell_top = source_row * source_sheet["cellHeight"]
    crop_left, crop_top, crop_right, crop_bottom = source_sheet["squareCropWithinCell"]
    return source.crop((
        cell_left + crop_left,
        cell_top + crop_top,
        cell_left + crop_right,
        cell_top + crop_bottom,
    ))


def downsample_frame(source_crop: Image.Image, contract: dict) -> Image.Image:
    frame_size = contract["frame"]["width"]
    inset = contract["sourceSheet"]["nativeInset"]
    native_size = frame_size - inset * 2
    reduced = source_crop.convert("RGBA").resize(
        (native_size, native_size),
        Image.Resampling.BOX,
    )
    frame = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    frame.alpha_composite(reduced, (inset, inset))
    return frame


def load_native_frames(contract: dict) -> tuple[list[dict], list[dict]]:
    frames: list[dict] = []
    source_records: list[dict] = []
    source_sheet = contract["sourceSheet"]
    expressions = contract["sheet"]["columns"]
    for character in contract["characters"]:
        source_path = ROOT / character["source"]
        source_bytes = source_path.read_bytes()
        with Image.open(io.BytesIO(source_bytes)) as opened:
            source = opened.convert("RGBA")
            source_mode = opened.mode
        if source.size != (source_sheet["width"], source_sheet["height"]):
            raise ValueError(f"{source_path.name} has wrong size {source.size}")
        alpha_values = set(source.getchannel("A").getdata())
        if min(alpha_values) != 0 or max(alpha_values) != 255:
            raise ValueError(f"{source_path.name} must contain transparent and opaque pixels")
        source_records.append({
            "path": character["source"],
            "role": "ai-generated-expression-source-with-chroma-removed",
            "width": source.width,
            "height": source.height,
            "mode": source_mode,
            "sha256": sha256(source_bytes),
        })
        for expression in expressions:
            crop = crop_expression(source, contract, expression)
            frames.append({
                "characterId": character["id"],
                "characterName": character["name"],
                "expression": expression,
                "sourceCell": contract["sheet"]["sourceCoordinates"][expression],
                "native": downsample_frame(crop, contract),
            })
    return frames, source_records


def make_shared_palette(frames: list[dict], color_limit: int) -> tuple[Image.Image, list[str]]:
    visible_pixels: list[tuple[int, int, int]] = []
    for record in frames:
        image = record["native"]
        for red, green, blue, alpha in image.getdata():
            if alpha >= 96:
                visible_pixels.append((red, green, blue))
    if not visible_pixels:
        raise ValueError("no visible portrait pixels found")
    sample_width = 1024
    sample_height = (len(visible_pixels) + sample_width - 1) // sample_width
    padded = visible_pixels + [visible_pixels[-1]] * (sample_width * sample_height - len(visible_pixels))
    sample = Image.new("RGB", (sample_width, sample_height))
    sample.putdata(padded)
    reduced = sample.quantize(
        colors=color_limit,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )
    palette_data = reduced.getpalette()[:color_limit * 3]
    colors = [
        tuple(palette_data[index:index + 3])
        for index in range(0, len(palette_data), 3)
    ]
    palette = Image.new("P", (1, 1))
    padded_colors = colors + [colors[-1]] * (256 - len(colors))
    palette.putpalette([channel for color in padded_colors for channel in color])
    hex_colors = [f"#{red:02x}{green:02x}{blue:02x}" for red, green, blue in colors]
    return palette, hex_colors


def quantize_frame(image: Image.Image, palette: Image.Image) -> Image.Image:
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 96 else 0)
    quantized_rgb = image.convert("RGB").quantize(
        palette=palette,
        dither=Image.Dither.NONE,
    ).convert("RGB")
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output.paste(quantized_rgb, (0, 0), alpha)
    return output


def render_atlas(contract: dict) -> tuple[Image.Image, list[dict], list[dict], list[str]]:
    native_frames, source_records = load_native_frames(contract)
    palette, palette_colors = make_shared_palette(
        native_frames,
        contract["frame"]["visiblePaletteLimit"],
    )
    cell = contract["frame"]["width"]
    columns = contract["sheet"]["columns"]
    rows = contract["sheet"]["rows"]
    atlas = Image.new("RGBA", (cell * len(columns), cell * len(rows)), (0, 0, 0, 0))
    manifest_frames: list[dict] = []
    for index, record in enumerate(native_frames):
        row = rows.index(record["characterId"])
        column = columns.index(record["expression"])
        frame = quantize_frame(record["native"], palette)
        alpha = frame.getchannel("A")
        bounds = alpha.getbbox()
        if not bounds:
            raise ValueError(f"empty frame {record['characterId']}:{record['expression']}")
        gutter = min(bounds[0], bounds[1], cell - bounds[2], cell - bounds[3])
        if gutter < contract["frame"]["minimumTransparentGutter"]:
            raise ValueError(
                f"gutter violation {record['characterId']}:{record['expression']} {bounds}"
            )
        if set(alpha.getdata()) - {0, 255}:
            raise ValueError(
                f"non-binary alpha {record['characterId']}:{record['expression']}"
            )
        x, y = column * cell, row * cell
        atlas.alpha_composite(frame, (x, y))
        manifest_frames.append({
            "id": f"{record['characterId']}:{record['expression']}",
            "characterId": record["characterId"],
            "characterName": record["characterName"],
            "expression": record["expression"],
            "expressionSemantic": contract["expressions"][record["expression"]],
            "rect": [x, y, cell, cell],
            "sourceCell": record["sourceCell"],
            "localAlphaBounds": list(bounds),
            "minimumObservedGutter": gutter,
            "rgbaSha256": sha256(frame.tobytes()),
        })
    frame_hashes = {record["rgbaSha256"] for record in manifest_frames}
    if len(frame_hashes) != len(manifest_frames):
        raise ValueError("all 56 portrait cels must be distinct")
    return atlas, manifest_frames, source_records, palette_colors


FONT = {
    "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
    "C": ("01111", "10000", "10000", "10000", "10000", "10000", "01111"),
    "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
    "F": ("11111", "10000", "10000", "11110", "10000", "10000", "10000"),
    "G": ("01111", "10000", "10000", "10111", "10001", "10001", "01111"),
    "I": ("11111", "00100", "00100", "00100", "00100", "00100", "11111"),
    "K": ("10001", "10010", "10100", "11000", "10100", "10010", "10001"),
    "L": ("10000", "10000", "10000", "10000", "10000", "10000", "11111"),
    "M": ("10001", "11011", "10101", "10101", "10001", "10001", "10001"),
    "N": ("10001", "11001", "10101", "10011", "10001", "10001", "10001"),
    "O": ("01110", "10001", "10001", "10001", "10001", "10001", "01110"),
    "P": ("11110", "10001", "10001", "11110", "10000", "10000", "10000"),
    "Q": ("01110", "10001", "10001", "10001", "10101", "10010", "01101"),
    "R": ("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
    "S": ("01111", "10000", "10000", "01110", "00001", "00001", "11110"),
    "T": ("11111", "00100", "00100", "00100", "00100", "00100", "00100"),
    "U": ("10001", "10001", "10001", "10001", "10001", "10001", "01110"),
    "V": ("10001", "10001", "10001", "10001", "10001", "01010", "00100"),
    "Y": ("10001", "10001", "01010", "00100", "00100", "00100", "00100"),
    " ": ("00000",) * 7,
}


def label(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fill, scale: int = 1) -> None:
    for letter in text.upper():
        glyph = FONT.get(letter, FONT[" "])
        for glyph_y, row in enumerate(glyph):
            for glyph_x, on in enumerate(row):
                if on == "1":
                    draw.rectangle(
                        (
                            x + glyph_x * scale,
                            y + glyph_y * scale,
                            x + (glyph_x + 1) * scale - 1,
                            y + (glyph_y + 1) * scale - 1,
                        ),
                        fill=fill,
                    )
        x += 6 * scale


def render_contact(atlas: Image.Image, contract: dict) -> Image.Image:
    scale, left, top = 2, 96, 52
    cell = contract["frame"]["width"]
    display_cell = cell * scale
    columns = contract["sheet"]["columns"]
    rows = contract["sheet"]["rows"]
    contact = Image.new(
        "RGBA",
        (left + display_cell * len(columns) + 16, top + display_cell * len(rows) + 16),
        rgba("#0b1020"),
    )
    draw = ImageDraw.Draw(contact)
    for column, expression in enumerate(columns):
        label(draw, left + column * display_cell + 12, 18, expression, rgba("#d7c99a"))
    row_labels = {"lise": "NIKOLA"}
    for row, character_id in enumerate(rows):
        label(
            draw,
            8,
            top + row * display_cell + 86,
            row_labels.get(character_id, character_id),
            rgba("#d7c99a"),
            2,
        )
    for row in range(len(rows)):
        for column in range(len(columns)):
            x, y = left + column * display_cell, top + row * display_cell
            checker = Image.new("RGBA", (display_cell, display_cell), rgba("#16233a"))
            checker_draw = ImageDraw.Draw(checker)
            for checker_y in range(0, display_cell, 12):
                for checker_x in range(0, display_cell, 12):
                    if (checker_x // 12 + checker_y // 12) % 2:
                        checker_draw.rectangle(
                            (checker_x, checker_y, checker_x + 11, checker_y + 11),
                            fill=rgba("#202d3d"),
                        )
            contact.alpha_composite(checker, (x, y))
            frame = atlas.crop((
                column * cell,
                row * cell,
                (column + 1) * cell,
                (row + 1) * cell,
            )).resize((display_cell, display_cell), Image.Resampling.NEAREST)
            contact.alpha_composite(frame, (x, y))
            draw.rectangle(
                (x, y, x + display_cell - 1, y + display_cell - 1),
                outline=rgba("#27466b"),
            )
    return contact


def build_files() -> dict[str, bytes]:
    contract = load_contract()
    atlas, frames, source_records, palette_colors = render_atlas(contract)
    contact = render_contact(atlas, contract)
    atlas_data = png_bytes(atlas)
    contact_data = png_bytes(contact)
    visible_rgba = {
        color
        for count, color in atlas.getcolors(maxcolors=atlas.width * atlas.height) or []
        if color[3] == 255
    }
    alpha_values = sorted(set(atlas.getchannel("A").getdata()))
    manifest = {
        "assetId": contract["assetId"],
        "status": "review-quality-runtime-candidate",
        "runtimeIntegration": "current-browser-camp-and-scene-focus-v2",
        "provenance": contract["provenance"],
        "tool": {
            "name": Path(__file__).name,
            "pillowVersion": PILLOW_VERSION,
        },
        "geometry": {
            "columns": contract["atlas"]["columns"],
            "rows": contract["atlas"]["rows"],
            "cellWidth": contract["frame"]["width"],
            "cellHeight": contract["frame"]["height"],
            "sheetWidth": atlas.width,
            "sheetHeight": atlas.height,
            "minimumTransparentGutter": contract["frame"]["minimumTransparentGutter"],
        },
        "rowOrder": contract["sheet"]["rows"],
        "columnOrder": contract["sheet"]["columns"],
        "palette": {
            "method": "shared-median-cut",
            "requestedVisibleColors": contract["frame"]["visiblePaletteLimit"],
            "actualVisibleColors": len(visible_rgba),
            "colors": palette_colors,
            "dither": "none",
        },
        "alpha": {
            "policy": "binary",
            "values": alpha_values,
        },
        "frames": frames,
        "sources": [
            {
                "path": CONTRACT_PATH.name,
                "role": "portrait-v2-geometry-identity-and-provenance-contract",
                "sha256": sha256(CONTRACT_PATH.read_bytes()),
            },
            *source_records,
            {
                "path": Path(__file__).name,
                "role": "deterministic-pixelification-builder",
                "sha256": sha256(Path(__file__).read_bytes()),
            },
        ],
        "exports": [
            {
                "path": ATLAS_NAME,
                "role": "transparent-runtime-candidate",
                "width": atlas.width,
                "height": atlas.height,
                "mode": atlas.mode,
                "sha256": sha256(atlas_data),
            },
            {
                "path": CONTACT_NAME,
                "role": "labeled-review-only-not-runtime",
                "width": contact.width,
                "height": contact.height,
                "mode": contact.mode,
                "sha256": sha256(contact_data),
            },
        ],
        "validation": {
            "frameCount": len(frames),
            "distinctRgbaFrameHashes": len({frame["rgbaSha256"] for frame in frames}),
            "binaryTransparency": alpha_values == [0, 255],
            "minimumObservedGutter": min(frame["minimumObservedGutter"] for frame in frames),
            "deterministicCommand": "python build_party_portrait_suite_v2.py --check",
        },
        "review": {
            "agentVisualInspection": "passed",
            "humanExpressionReadability": "pending",
            "externalCulturalReview": "pending",
            "runtimeBrowserInspection": "targeted-tests-passed-live-browser-session-unavailable",
        },
    }
    manifest_data = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    readme = f"""# Party portrait expression suite v2

This package upgrades all seven party members across eight canonical expressions. The source boards are AI-generated, identity-locked portrait studies; the {atlas.width} × {atlas.height} runtime atlas is a deterministic {len(contract["sheet"]["rows"])} × {len(contract["sheet"]["columns"])} × {contract["frame"]["width"]} × {contract["frame"]["height"]} pixelification using one shared {contract["frame"]["visiblePaletteLimit"]}-color visible palette, no dithering, and binary transparency.

The art direction is original premium gothic 32-bit-era JRPG portraiture: elegant anime realism, ink-like contour control, baroque chiaroscuro, disciplined costume detail, and crisp pixel clusters. It targets the finish and readability of top-tier gothic action RPG portrait art without copying a franchise character, actor, celebrity, real person, or named artist.

- `{CONTRACT_PATH.name}` records geometry, identity, expression, crop, palette, alpha, and provenance contracts.
- `sources/` contains the seven chroma-removed 1536 × 1024 expression boards.
- `{ATLAS_NAME}` is the transparent 96 × 96-cel runtime candidate.
- `{CONTACT_NAME}` is the labeled review sheet and is not loaded by the game.
- `{MANIFEST_NAME}` records source/export hashes, the shared palette, exact frame rectangles, alpha bounds, and validation.

Provenance claim: deterministically pixelified from AI-generated raster sources; not hand-pixeled or pixel-authored.

Run `python build_party_portrait_suite_v2.py` to rebuild or `python build_party_portrait_suite_v2.py --check` for a byte-for-byte verification.
"""
    return {
        ATLAS_NAME: atlas_data,
        CONTACT_NAME: contact_data,
        MANIFEST_NAME: manifest_data,
        README_NAME: readme.encode("utf-8"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    files = build_files()
    if args.check:
        stale = [
            name
            for name, data in files.items()
            if not (ROOT / name).exists() or (ROOT / name).read_bytes() != data
        ]
        if stale:
            for name in stale:
                print(f"stale or missing: {name}", file=sys.stderr)
            return 1
        print(f"OK: {len(files)} portrait-v2 files are byte-identical")
        return 0
    for name, data in files.items():
        (ROOT / name).write_bytes(data)
        print(f"wrote {name}: {len(data)} bytes sha256={sha256(data)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
