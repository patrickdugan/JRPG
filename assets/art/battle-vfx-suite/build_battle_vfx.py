#!/usr/bin/env python3
"""Deterministically build the original delivery/essence battle VFX suite."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import struct
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "battle-vfx-suite.source.json"
ATLAS_PATH = ROOT / "battle-vfx-suite-atlas.png"
CONTACT_PATH = ROOT / "battle-vfx-suite-contact-sheet.png"
MANIFEST_PATH = ROOT / "manifest.json"

EXPECTED_EFFECTS = [
    "vfx_delivery-cut_v01",
    "vfx_delivery-pierce_v01",
    "vfx_delivery-crush_v01",
    "vfx_delivery-arcane_v01",
    "vfx_essence-ember_v01",
    "vfx_essence-frost_v01",
    "vfx_essence-storm_v01",
    "vfx_essence-radiance_v01",
    "vfx_essence-umbral_v01",
]
EXPECTED_SHAPES = [
    "diagonal-cleft",
    "line-diamond",
    "square-impact",
    "asymmetric-angle-seal",
    "three-prong-flame",
    "irregular-six-point-shard",
    "split-zigzag",
    "broken-eight-ray-disc",
    "broken-thorn-arc",
]
EXPECTED_PHASES = ["windup", "windup", "active", "followThrough", "recovery", "recovery"]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_path(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def rgba(value: str) -> tuple[int, int, int, int]:
    value = value.removeprefix("#")
    if len(value) != 6:
        raise ValueError(f"Expected six-digit hex color, got {value!r}")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (255,)


def encode_png(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def read_ihdr(data: bytes) -> dict[str, int]:
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("Expected a PNG with IHDR as its first chunk")
    width, height, bit_depth, color_type, compression, filter_method, interlace = struct.unpack(
        ">IIBBBBB", data[16:29]
    )
    return {
        "width": width,
        "height": height,
        "bitDepth": bit_depth,
        "colorType": color_type,
        "compression": compression,
        "filter": filter_method,
        "interlace": interlace,
    }


def load_source() -> dict:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    if source.get("assetId") != "vfx_battle-delivery-essence_v01":
        raise ValueError("Unexpected assetId")
    if source.get("logicalFrame") != [64, 64] or source.get("atlasGrid") != [6, 9]:
        raise ValueError("The runtime atlas contract requires six 64x64 cells across nine rows")
    if source.get("anchor") != [32, 32] or source.get("fps") != 60:
        raise ValueError("The suite requires a centered anchor and 60 FPS timing metadata")
    if source.get("transparentGutterPx") != 20 or source.get("maxActiveBounds") != [24, 24]:
        raise ValueError("The 20px gutter / 24px focal-spread contract changed")
    if source.get("alphaPolicy") != "binary-only":
        raise ValueError("Only transparent and opaque runtime pixels are permitted")
    safety = source.get("safety", {})
    if safety.get("authenticReligiousSymbols") is not False or safety.get("authenticHeraldicSymbols") is not False:
        raise ValueError("Symbol safety flags must explicitly reject authentic sacred and heraldic motifs")

    effects = source.get("effects", [])
    if [effect.get("id") for effect in effects] != EXPECTED_EFFECTS:
        raise ValueError("Effect order or identifiers differ from the nine-type contract")
    if [effect.get("shapeId") for effect in effects] != EXPECTED_SHAPES:
        raise ValueError("Each damage type must keep its unique shape identifier")
    if [effect.get("category") for effect in effects] != ["delivery"] * 4 + ["essence"] * 5:
        raise ValueError("Expected four delivery rows followed by five essence rows")

    palette = source.get("palette", {})
    for effect in effects:
        frames = effect.get("frames", [])
        if len(frames) != 6 or [frame.get("phase") for frame in frames] != EXPECTED_PHASES:
            raise ValueError(f"{effect['id']} does not expose the six required readable keys")
        if [frame.get("step") for frame in frames] != list(range(6)):
            raise ValueError(f"{effect['id']} frame steps must be contiguous")
        if any(not isinstance(frame.get("duration"), int) or frame["duration"] < 1 for frame in frames):
            raise ValueError(f"{effect['id']} has an invalid 60 FPS hold")
        colors = effect.get("colors", [])
        if len(colors) != 3 or any(name not in palette for name in colors):
            raise ValueError(f"{effect['id']} must select three declared palette colors")
    return source


class PixelSurface:
    def __init__(self, size: tuple[int, int], colors: list[tuple[int, int, int, int]]):
        self.image = Image.new("RGBA", size, (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)
        self.colors = colors

    def rect(self, box: tuple[int, int, int, int], color: int) -> None:
        self.draw.rectangle(box, fill=self.colors[color])

    def point(self, x: int, y: int, color: int, size: int = 1) -> None:
        self.rect((x, y, x + size - 1, y + size - 1), color)

    def line(self, points: list[tuple[int, int]], color: int, width: int = 1) -> None:
        self.draw.line(points, fill=self.colors[color], width=width)

    def polygon(self, points: list[tuple[int, int]], color: int) -> None:
        self.draw.polygon(points, fill=self.colors[color])


def draw_cut(surface: PixelSurface, step: int) -> None:
    if step == 0:
        surface.point(29, 35, 0, 2); surface.point(33, 31, 0, 2)
    elif step == 1:
        surface.line([(27, 38), (37, 28)], 1, 2); surface.point(25, 40, 0)
    elif step == 2:
        surface.line([(21, 42), (42, 21)], 1, 2)
        surface.line([(23, 42), (42, 23)], 2)
        surface.point(21, 38, 2); surface.point(38, 21, 2)
    elif step == 3:
        surface.line([(23, 42), (42, 23)], 1, 2)
        surface.line([(28, 40), (40, 28)], 2)
        surface.point(21, 35, 0); surface.point(35, 21, 0)
    elif step == 4:
        surface.line([(27, 39), (33, 33)], 1)
        surface.line([(35, 31), (40, 26)], 0)
        surface.point(24, 41, 0); surface.point(40, 24, 0)
    else:
        surface.point(29, 37, 0, 2); surface.point(37, 27, 0); surface.point(41, 23, 0)


def draw_pierce(surface: PixelSurface, step: int) -> None:
    if step == 0:
        surface.line([(27, 32), (32, 32)], 0); surface.point(34, 32, 1)
    elif step == 1:
        surface.line([(24, 32), (37, 32)], 1, 2)
        surface.polygon([(37, 29), (41, 32), (37, 35), (35, 32)], 0)
    elif step == 2:
        surface.line([(20, 32), (40, 32)], 1, 2)
        surface.line([(23, 31), (40, 31)], 2)
        surface.polygon([(40, 28), (43, 32), (40, 36), (37, 32)], 2)
    elif step == 3:
        surface.line([(23, 32), (39, 32)], 1, 2)
        surface.polygon([(39, 29), (43, 32), (39, 35), (37, 32)], 0)
        surface.point(21, 30, 2); surface.point(21, 34, 2)
    elif step == 4:
        surface.line([(28, 32), (38, 32)], 1)
        surface.polygon([(38, 30), (41, 32), (38, 34), (36, 32)], 0)
    else:
        surface.point(32, 32, 1, 2); surface.point(38, 32, 0); surface.point(41, 32, 0)


def draw_crush(surface: PixelSurface, step: int) -> None:
    if step == 0:
        surface.rect((30, 25, 34, 29), 0); surface.point(32, 33, 1, 2)
    elif step == 1:
        surface.rect((28, 22, 36, 27), 1)
        surface.line([(32, 29), (32, 37)], 2, 2)
    elif step == 2:
        surface.line([(23, 22), (42, 22), (42, 41), (23, 41), (23, 22)], 2, 2)
        surface.line([(26, 25), (39, 25), (39, 38), (26, 38), (26, 25)], 1)
        surface.rect((29, 29, 35, 35), 0)
        surface.point(25, 42, 1, 2); surface.point(38, 42, 1, 2)
    elif step == 3:
        surface.line([(25, 27), (40, 27), (40, 40), (25, 40), (25, 27)], 1, 2)
        surface.point(22, 41, 2, 2); surface.point(42, 38, 2, 2)
        surface.line([(29, 32), (36, 32)], 0, 2)
    elif step == 4:
        surface.line([(27, 35), (30, 38), (33, 35), (36, 39), (39, 35)], 1)
        surface.point(24, 41, 0, 2); surface.point(40, 41, 0, 2)
    else:
        surface.point(27, 39, 0, 2); surface.point(33, 37, 1, 2); surface.point(39, 40, 0)


def draw_arcane(surface: PixelSurface, step: int) -> None:
    if step == 0:
        surface.line([(29, 34), (29, 29), (35, 29)], 0, 2); surface.point(36, 35, 1)
    elif step == 1:
        surface.line([(25, 34), (27, 25), (37, 23), (41, 31)], 1, 2)
        surface.line([(30, 37), (38, 37), (39, 33)], 0)
    elif step == 2:
        surface.line([(23, 27), (29, 21), (41, 24), (42, 36), (36, 42), (24, 40), (21, 31), (23, 27)], 1, 2)
        surface.line([(27, 29), (34, 25), (39, 30), (37, 37), (29, 38), (25, 33)], 2)
        surface.line([(30, 34), (30, 29), (35, 29), (35, 35), (33, 35)], 0, 2)
    elif step == 3:
        surface.line([(25, 25), (39, 24), (42, 34), (35, 41), (23, 36)], 1, 2)
        surface.line([(27, 31), (34, 27), (39, 32), (34, 38), (28, 36)], 2)
        surface.point(21, 30, 0); surface.point(41, 40, 0)
    elif step == 4:
        surface.line([(27, 27), (38, 26), (40, 35), (34, 39), (26, 35)], 1)
        surface.line([(30, 30), (36, 30), (36, 36), (31, 36)], 0)
    else:
        surface.line([(29, 29), (36, 28), (38, 34), (33, 38), (28, 34)], 0)
        surface.point(25, 37, 1); surface.point(40, 28, 1)


def draw_ember(surface: PixelSurface, step: int) -> None:
    if step == 0:
        surface.point(31, 37, 0, 3); surface.point(35, 34, 1)
    elif step == 1:
        surface.polygon([(27, 40), (28, 31), (32, 35), (33, 27), (37, 34), (40, 30), (39, 41)], 1)
        surface.point(29, 28, 2); surface.point(39, 26, 2)
    elif step == 2:
        surface.polygon([(23, 43), (24, 30), (29, 35), (31, 22), (35, 33), (41, 25), (40, 43)], 1)
        surface.polygon([(27, 41), (29, 32), (32, 37), (34, 28), (38, 39), (37, 43)], 2)
        surface.point(27, 24, 2, 2); surface.point(39, 20, 2); surface.point(42, 28, 2)
    elif step == 3:
        surface.polygon([(25, 42), (27, 33), (31, 38), (34, 29), (39, 39), (38, 43)], 1)
        surface.point(27, 27, 2, 2); surface.point(36, 23, 2); surface.point(42, 31, 0)
    elif step == 4:
        surface.polygon([(28, 42), (30, 35), (33, 40), (36, 34), (38, 42)], 0)
        surface.point(26, 30, 1); surface.point(36, 27, 1, 2); surface.point(41, 25, 1)
    else:
        surface.point(30, 39, 0, 2); surface.point(35, 35, 0); surface.point(28, 28, 1); surface.point(39, 25, 0)


def draw_frost(surface: PixelSurface, step: int) -> None:
    if step == 0:
        surface.polygon([(32, 28), (35, 32), (32, 37), (29, 32)], 0)
    elif step == 1:
        surface.polygon([(32, 23), (35, 29), (40, 27), (37, 33), (41, 37), (34, 36), (32, 42), (29, 36), (24, 39), (27, 32), (24, 27), (30, 29)], 1)
    elif step == 2:
        surface.polygon([(32, 20), (35, 28), (42, 25), (38, 32), (43, 37), (35, 36), (33, 43), (29, 37), (21, 40), (26, 33), (22, 27), (30, 29)], 1)
        surface.polygon([(32, 24), (34, 31), (39, 29), (36, 34), (40, 36), (33, 35), (32, 40), (30, 35), (25, 37), (29, 32)], 2)
        surface.point(21, 32, 2); surface.point(42, 30, 2)
    elif step == 3:
        surface.polygon([(32, 22), (35, 30), (41, 28), (37, 34), (41, 39), (34, 37), (32, 42), (29, 37), (24, 40), (27, 33), (23, 29), (30, 30)], 1)
        surface.line([(22, 43), (26, 39)], 2); surface.line([(39, 24), (43, 21)], 2)
    elif step == 4:
        surface.polygon([(32, 27), (35, 31), (39, 30), (36, 35), (39, 39), (33, 37), (31, 41), (29, 36), (25, 38), (28, 32)], 0)
        surface.point(23, 41, 1); surface.point(42, 24, 1)
    else:
        surface.line([(28, 39), (31, 35), (33, 38), (36, 34)], 0)
        surface.point(25, 41, 1); surface.point(39, 29, 0); surface.point(41, 25, 1)


def draw_storm(surface: PixelSurface, step: int) -> None:
    if step == 0:
        surface.line([(31, 28), (34, 31), (31, 35)], 0, 2)
    elif step == 1:
        surface.line([(31, 23), (37, 29), (32, 34), (37, 39)], 1, 2)
        surface.line([(29, 31), (25, 35)], 0)
    elif step == 2:
        surface.line([(31, 20), (39, 27), (33, 33), (39, 39), (34, 43)], 2, 2)
        surface.line([(29, 25), (34, 30), (28, 36), (32, 40)], 1, 2)
        surface.line([(36, 31), (43, 28)], 2); surface.point(22, 33, 2)
    elif step == 3:
        surface.line([(30, 22), (38, 29), (32, 35), (38, 41)], 1, 2)
        surface.line([(28, 29), (23, 34), (27, 38)], 2)
        surface.line([(36, 32), (42, 29)], 0)
    elif step == 4:
        surface.line([(31, 26), (36, 31), (31, 36), (35, 40)], 0, 2)
        surface.point(25, 37, 1); surface.point(41, 28, 1)
    else:
        surface.line([(31, 30), (34, 33), (31, 37)], 0)
        surface.point(26, 39, 1); surface.point(39, 28, 0)


def draw_radiance(surface: PixelSurface, step: int) -> None:
    if step == 0:
        surface.rect((30, 30, 34, 34), 0); surface.point(32, 27, 1)
    elif step == 1:
        surface.line([(28, 27), (36, 27)], 1); surface.line([(27, 29), (27, 36)], 1)
        surface.line([(29, 38), (37, 38)], 1); surface.line([(39, 29), (39, 35)], 1)
        surface.rect((30, 30, 35, 35), 2)
    elif step == 2:
        surface.line([(27, 24), (36, 24)], 1, 2); surface.line([(40, 27), (40, 35)], 1, 2)
        surface.line([(28, 40), (36, 40)], 1, 2); surface.line([(23, 29), (23, 36)], 1, 2)
        surface.rect((29, 29, 36, 36), 2)
        for x, y in [(32, 20), (32, 43), (20, 32), (43, 32), (23, 23), (41, 23), (23, 41), (41, 41)]:
            surface.point(x, y, 2, 2 if x < 43 and y < 43 else 1)
    elif step == 3:
        surface.line([(27, 25), (36, 25)], 1); surface.line([(39, 28), (39, 36)], 1)
        surface.line([(28, 39), (37, 39)], 1); surface.line([(24, 28), (24, 36)], 1)
        surface.rect((30, 30, 35, 35), 2)
        for x, y in [(32, 21), (32, 42), (21, 32), (42, 32), (24, 24), (40, 24), (24, 40), (40, 40)]:
            surface.point(x, y, 0)
    elif step == 4:
        surface.line([(28, 27), (36, 27)], 0); surface.line([(38, 29), (38, 36)], 0)
        surface.line([(29, 38), (36, 38)], 0); surface.line([(26, 29), (26, 35)], 0)
        surface.rect((31, 31, 34, 34), 1)
    else:
        surface.point(32, 32, 1, 2); surface.point(27, 27, 0); surface.point(38, 27, 0)
        surface.point(27, 38, 0); surface.point(38, 38, 0)


def draw_umbral(surface: PixelSurface, step: int) -> None:
    if step == 0:
        surface.line([(35, 28), (30, 30), (29, 35), (34, 37)], 0, 2)
    elif step == 1:
        surface.line([(38, 24), (31, 25), (26, 30), (25, 35), (30, 40), (37, 41)], 1, 2)
        surface.line([(36, 29), (32, 29), (29, 33), (32, 37), (36, 37)], 0)
    elif step == 2:
        surface.line([(38, 21), (31, 22), (25, 27), (22, 33), (25, 39), (32, 42)], 1, 2)
        surface.line([(37, 26), (32, 27), (28, 32), (31, 37), (37, 38)], 2, 2)
        surface.polygon([(27, 25), (22, 22), (25, 29)], 2)
        surface.polygon([(24, 37), (20, 40), (27, 40)], 2)
        surface.polygon([(33, 41), (38, 43), (35, 38)], 0)
        surface.point(41, 28, 2); surface.point(39, 33, 1); surface.point(35, 34, 2)
    elif step == 3:
        surface.line([(39, 23), (31, 24), (25, 29), (24, 35), (29, 40), (36, 42)], 1, 2)
        surface.line([(36, 28), (31, 29), (28, 33), (32, 37), (37, 37)], 0)
        surface.polygon([(27, 27), (22, 25), (25, 31)], 2)
        surface.point(40, 29, 2); surface.point(38, 33, 1); surface.point(35, 34, 2)
    elif step == 4:
        surface.line([(37, 26), (31, 27), (27, 31), (27, 35), (31, 39), (36, 40)], 0, 2)
        surface.point(39, 29, 1); surface.point(36, 32, 1); surface.point(33, 34, 1)
    else:
        surface.line([(35, 29), (31, 30), (29, 34), (33, 37)], 0)
        surface.point(38, 30, 1); surface.point(35, 33, 0); surface.point(32, 35, 1)


DRAWERS: dict[str, Callable[[PixelSurface, int], None]] = {
    "diagonal-cleft": draw_cut,
    "line-diamond": draw_pierce,
    "square-impact": draw_crush,
    "asymmetric-angle-seal": draw_arcane,
    "three-prong-flame": draw_ember,
    "irregular-six-point-shard": draw_frost,
    "split-zigzag": draw_storm,
    "broken-eight-ray-disc": draw_radiance,
    "broken-thorn-arc": draw_umbral,
}


def render_cells(source: dict) -> list[list[Image.Image]]:
    palette = source["palette"]
    result: list[list[Image.Image]] = []
    for effect in source["effects"]:
        colors = [rgba(palette[name]) for name in effect["colors"]]
        row = []
        for frame in effect["frames"]:
            surface = PixelSurface(tuple(source["logicalFrame"]), colors)
            DRAWERS[effect["shapeId"]](surface, frame["step"])
            row.append(surface.image)
        result.append(row)
    return result


def render_atlas(source: dict, cells: list[list[Image.Image]]) -> Image.Image:
    cell_width, cell_height = source["logicalFrame"]
    columns, rows = source["atlasGrid"]
    atlas = Image.new("RGBA", (columns * cell_width, rows * cell_height), (0, 0, 0, 0))
    for row, row_cells in enumerate(cells):
        for column, cell in enumerate(row_cells):
            atlas.alpha_composite(cell, (column * cell_width, row * cell_height))
    return atlas


def render_contact_sheet(source: dict, cells: list[list[Image.Image]]) -> Image.Image:
    label_width = 150
    preview_width = 112
    header_height = 36
    row_height = 92
    columns, rows = source["atlasGrid"]
    sheet = Image.new("RGB", (label_width + columns * preview_width, header_height + rows * row_height), "#0B1020")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.rectangle((0, 0, sheet.width - 1, sheet.height - 1), outline="#4F7392")
    for column, frame in enumerate(source["effects"][0]["frames"]):
        x = label_width + column * preview_width
        draw.text((x + 4, 7), frame["label"], fill="#F6E8B9", font=font)
        draw.text((x + 4, 20), frame["phase"], fill="#88C8C5", font=font)
    for row, (effect, row_cells) in enumerate(zip(source["effects"], cells, strict=True)):
        y = header_height + row * row_height
        draw.rectangle((0, y, sheet.width - 1, y + row_height - 1), outline="#27466B")
        draw.text((8, y + 22), effect["label"], fill="#F6E8B9", font=font)
        draw.text((8, y + 38), effect["category"], fill="#88C8C5", font=font)
        draw.text((8, y + 54), effect["shapeId"], fill="#A7B7C7", font=font)
        for column, cell in enumerate(row_cells):
            x = label_width + column * preview_width
            draw.rectangle((x + 23, y + 7, x + 88, y + 72), fill="#16233A", outline="#4F7392")
            sheet.paste(cell.convert("RGB"), (x + 24, y + 8), cell.getchannel("A"))
            frame = effect["frames"][column]
            draw.text((x + 4, y + 76), frame["label"], fill="#D7C99A", font=font)
            draw.text((x + 94, y + 76), f"{frame['duration']}f", fill="#88C8C5", font=font)
    return sheet


def frame_metadata(source: dict, cells: list[list[Image.Image]]) -> tuple[list[dict], list[dict]]:
    cell_width, cell_height = source["logicalFrame"]
    frames = []
    animations = []
    for row, (effect, row_cells) in enumerate(zip(source["effects"], cells, strict=True)):
        starts = []
        cursor = 0
        for frame in effect["frames"]:
            starts.append(cursor)
            cursor += frame["duration"]
        active_index = next(index for index, frame in enumerate(effect["frames"]) if frame["phase"] == "active")
        recovery_index = next(index for index, frame in enumerate(effect["frames"]) if frame["phase"] == "recovery")
        active_start = starts[active_index]
        active_end = active_start + effect["frames"][active_index]["duration"] - 1
        animations.append({
            "id": effect["id"],
            "label": effect["label"],
            "category": effect["category"],
            "shapeId": effect["shapeId"],
            "anchor": source["anchor"],
            "fps": source["fps"],
            "loop": False,
            "durationFrames": cursor,
            "durationMs": round(cursor * 1000 / source["fps"], 3),
            "events": {
                "windupStart": 0,
                "activeStart": active_start,
                "activeEnd": active_end,
                "impact": active_start,
                "recoveryStart": starts[recovery_index],
                "complete": cursor,
            },
            "frameIds": [f"{effect['id']}:{frame['label']}" for frame in effect["frames"]],
        })
        for column, (frame, cell) in enumerate(zip(effect["frames"], row_cells, strict=True)):
            bounds = cell.getchannel("A").getbbox()
            opaque_pixels = sum(1 for value in cell.getchannel("A").getdata() if value == 255)
            frames.append({
                "id": f"{effect['id']}:{frame['label']}",
                "effectId": effect["id"],
                "label": frame["label"],
                "phase": frame["phase"],
                "rect": [column * cell_width, row * cell_height, cell_width, cell_height],
                "localAlphaBounds": list(bounds) if bounds else None,
                "anchor": source["anchor"],
                "durationFrames": frame["duration"],
                "durationMs": round(frame["duration"] * 1000 / source["fps"], 3),
                "opaquePixels": opaque_pixels,
                "cellCoverage": round(opaque_pixels / (cell_width * cell_height), 6),
                "rgbaSha256": sha256_bytes(cell.tobytes()),
            })
    return frames, animations


def validate_pixels(source: dict, cells: list[list[Image.Image]], frames: list[dict]) -> dict:
    gutter = source["transparentGutterPx"]
    cell_width, cell_height = source["logicalFrame"]
    max_active_width, max_active_height = source["maxActiveBounds"]
    seen_hashes = set()
    max_coverage = 0.0
    max_active_bounds = [0, 0]
    for record, cell in zip(frames, (cell for row in cells for cell in row), strict=True):
        alpha_values = set(cell.getchannel("A").getdata())
        if not alpha_values.issubset({0, 255}):
            raise ValueError(f"{record['id']} contains partial alpha")
        bounds = record["localAlphaBounds"]
        if bounds is None:
            raise ValueError(f"{record['id']} is empty")
        left, top, right, bottom = bounds
        if left < gutter or top < gutter or right > cell_width - gutter or bottom > cell_height - gutter:
            raise ValueError(f"{record['id']} violates the {gutter}px transparent gutter: {bounds}")
        width, height = right - left, bottom - top
        if record["phase"] == "active":
            if width > max_active_width or height > max_active_height:
                raise ValueError(f"{record['id']} exceeds the target-obscuration budget: {width}x{height}")
            max_active_bounds = [max(max_active_bounds[0], width), max(max_active_bounds[1], height)]
        if record["cellCoverage"] > 0.10:
            raise ValueError(f"{record['id']} exceeds the 10% high-value/saturated frame budget")
        max_coverage = max(max_coverage, record["cellCoverage"])
        seen_hashes.add(record["rgbaSha256"])
    if len(seen_hashes) != len(frames):
        raise ValueError("Every key cel must remain visually distinct")
    return {
        "binaryAlpha": True,
        "minimumTransparentGutterPx": gutter,
        "maximumObservedActiveBounds": max_active_bounds,
        "maximumObservedCellCoverage": max_coverage,
        "distinctFrameCount": len(seen_hashes),
    }


def build_artifacts(source: dict) -> tuple[bytes, bytes, list[dict], list[dict], dict]:
    cells = render_cells(source)
    atlas_bytes = encode_png(render_atlas(source, cells))
    contact_bytes = encode_png(render_contact_sheet(source, cells))
    frames, animations = frame_metadata(source, cells)
    validation = validate_pixels(source, cells, frames)

    # A second independent render must produce the same encoded bytes.
    second_cells = render_cells(source)
    if atlas_bytes != encode_png(render_atlas(source, second_cells)):
        raise ValueError("Two runtime-atlas renders were not byte-identical")
    if contact_bytes != encode_png(render_contact_sheet(source, second_cells)):
        raise ValueError("Two contact-sheet renders were not byte-identical")
    return atlas_bytes, contact_bytes, frames, animations, validation


def create_manifest(
    source: dict,
    atlas_bytes: bytes,
    contact_bytes: bytes,
    frames: list[dict],
    animations: list[dict],
    validation: dict,
) -> dict:
    return {
        "schemaVersion": 1,
        "assetId": source["assetId"],
        "runtimeStatus": "current-browser-impact-overlay",
        "generator": {
            "path": Path(__file__).name,
            "python": "3.x",
            "pillow": PILLOW_VERSION,
            "determinism": "two independent in-process renders are byte-identical",
        },
        "sources": [
            {"path": SOURCE_PATH.name, "sha256": sha256_path(SOURCE_PATH)},
            {"path": Path(__file__).name, "sha256": sha256_path(Path(__file__).resolve())},
        ],
        "exports": [
            {
                "id": "runtime-atlas",
                "path": ATLAS_PATH.name,
                "sha256": sha256_bytes(atlas_bytes),
                "ihdr": read_ihdr(atlas_bytes),
                "transparent": True,
                "runtimeCandidate": True,
            },
            {
                "id": "labeled-contact-sheet",
                "path": CONTACT_PATH.name,
                "sha256": sha256_bytes(contact_bytes),
                "ihdr": read_ihdr(contact_bytes),
                "transparent": False,
                "runtimeCandidate": False,
            },
        ],
        "logicalFrame": source["logicalFrame"],
        "atlasGrid": source["atlasGrid"],
        "anchor": source["anchor"],
        "fps": source["fps"],
        "eventFrameSemantics": source["eventFrameSemantics"],
        "palette": source["palette"],
        "safety": source["safety"],
        "targetObscuration": {
            "sourceContracts": ["docs/05-art-direction.md", "docs/10-animation-bible.md"],
            "ordinaryImpactFocalSpreadPx": [12, 24],
            "maximumActiveBounds": source["maxActiveBounds"],
            "transparentGutterPx": source["transparentGutterPx"],
            "maximumCellCoverage": 0.10,
        },
        "validation": validation,
        "animations": animations,
        "frames": frames,
    }


def expected_files() -> dict[Path, bytes]:
    source = load_source()
    atlas_bytes, contact_bytes, frames, animations, validation = build_artifacts(source)
    manifest = create_manifest(source, atlas_bytes, contact_bytes, frames, animations, validation)
    manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return {ATLAS_PATH: atlas_bytes, CONTACT_PATH: contact_bytes, MANIFEST_PATH: manifest_bytes}


def write_build(files: dict[Path, bytes]) -> None:
    for path, data in files.items():
        path.write_bytes(data)


def check_build(files: dict[Path, bytes]) -> None:
    for path, expected in files.items():
        if not path.exists():
            raise FileNotFoundError(f"Missing generated artifact: {path.name}")
        actual = path.read_bytes()
        if actual != expected:
            raise ValueError(
                f"{path.name} is stale: expected {sha256_bytes(expected)}, got {sha256_bytes(actual)}"
            )
    manifest = json.loads(files[MANIFEST_PATH].decode("utf-8"))
    for export in manifest["exports"]:
        payload = files[ROOT / export["path"]]
        if export["sha256"] != sha256_bytes(payload) or export["ihdr"] != read_ihdr(payload):
            raise ValueError(f"Manifest metadata mismatch for {export['path']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail unless committed artifacts are byte-exact")
    args = parser.parse_args()
    files = expected_files()
    if args.check:
        check_build(files)
    else:
        write_build(files)
        check_build(files)
    manifest = json.loads(files[MANIFEST_PATH].decode("utf-8"))
    atlas = next(export for export in manifest["exports"] if export["id"] == "runtime-atlas")
    print(json.dumps({
        "ok": True,
        "mode": "check" if args.check else "build",
        "assetId": manifest["assetId"],
        "atlas": atlas["ihdr"],
        "atlasSha256": atlas["sha256"],
        "animations": len(manifest["animations"]),
        "frames": len(manifest["frames"]),
        "validation": manifest["validation"],
    }, separators=(",", ":")))


if __name__ == "__main__":
    main()
