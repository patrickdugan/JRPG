#!/usr/bin/env python3
"""Deterministically build the Takamine tactical board from its layered JSON source."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "takamine-bell-chamber.source.json"
MANIFEST_PATH = ROOT / "manifest.json"

BOARD_SVG = ROOT / "takamine-bell-chamber-board.svg"
BOARD_PNG = ROOT / "takamine-bell-chamber-board.png"
OCCUPANCY_SVG = ROOT / "occupancy-reference.svg"
OCCUPANCY_PNG = ROOT / "occupancy-reference.png"
PALETTE_SVG = ROOT / "palette-modules.svg"
PALETTE_PNG = ROOT / "palette-modules.png"

EXPECTED_BLOCKED = {
    "0,0", "1,0", "2,0", "9,0", "10,0", "11,0",
    "0,6", "1,6", "2,6", "9,6", "10,6", "11,6",
    "5,2", "6,2", "5,3", "6,3",
}
EXPECTED_FOOTPRINT = {"5,2", "6,2", "5,3", "6,3"}
EXPECTED_SPECIALS = {
    "highGallery": {"0,2", "0,3", "0,4"},
    "bloodWardNodes": {"5,1", "6,5"},
    "dryLanternFooting": {"3,1", "3,5"},
    "partyDeployment": {"2,3", "2,4", "3,3"},
    "mateusDeployment": {"9,3"},
    "postSurrenderExit": {"11,3"},
}


def load_source() -> dict:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    geometry = source["geometry"]
    required_geometry = {
        "width": 384,
        "height": 224,
        "columns": 12,
        "rows": 7,
        "cellSize": 32,
    }
    for key, value in required_geometry.items():
        if geometry.get(key) != value:
            raise ValueError(f"geometry.{key} must be {value}, got {geometry.get(key)!r}")
    if source.get("assetId") != "tkm-bell-chamber":
        raise ValueError("assetId must bind the source to tkm-bell-chamber")
    if set(source["occupancy"]["blocked"]) != EXPECTED_BLOCKED:
        raise ValueError("blocked-cell contract differs from the live level")
    if set(source["occupancy"]["registryFootprint"]) != EXPECTED_FOOTPRINT:
        raise ValueError("registry footprint differs from the live level")
    for key, expected in EXPECTED_SPECIALS.items():
        if set(source["specialCells"].get(key, [])) != expected:
            raise ValueError(f"specialCells.{key} differs from the live level")
    layers = source["layers"]
    if len(layers) != len(set(layers)):
        raise ValueError("layer identifiers must be unique")
    return source


def hex_rgb(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    if len(value) != 6:
        raise ValueError(f"expected six-digit color, got {value!r}")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (255,)


class Surface:
    """One integer-pixel drawing command stream emitted to PNG and grouped SVG."""

    def __init__(self, width: int, height: int, palette: dict[str, str], title: str):
        self.width = width
        self.height = height
        self.palette = palette
        self.title = title
        self.image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)
        self.groups: list[tuple[str, list[str]]] = []
        self.group_id = "ungrouped"
        self.commands: list[str] = []

    def begin(self, group_id: str) -> None:
        if self.commands:
            self.groups.append((self.group_id, self.commands))
        self.group_id = group_id
        self.commands = []

    def finish(self) -> None:
        if self.commands:
            self.groups.append((self.group_id, self.commands))
            self.commands = []

    def color(self, value: str) -> str:
        return self.palette.get(value, value)

    def rect(self, x: int, y: int, width: int, height: int, fill: str) -> None:
        if width <= 0 or height <= 0:
            return
        color = self.color(fill)
        self.draw.rectangle((x, y, x + width - 1, y + height - 1), fill=hex_rgb(color))
        self.commands.append(
            f'<rect x="{x}" y="{y}" width="{width}" height="{height}" fill="{color}"/>'
        )

    def polygon(self, points: list[tuple[int, int]], fill: str) -> None:
        color = self.color(fill)
        self.draw.polygon(points, fill=hex_rgb(color))
        encoded = " ".join(f"{x},{y}" for x, y in points)
        self.commands.append(f'<polygon points="{encoded}" fill="{color}"/>')

    def line(self, points: list[tuple[int, int]], fill: str, width: int = 1) -> None:
        color = self.color(fill)
        self.draw.line(points, fill=hex_rgb(color), width=width)
        encoded = " ".join(f"{x},{y}" for x, y in points)
        self.commands.append(
            f'<polyline points="{encoded}" fill="none" stroke="{color}" stroke-width="{width}"/>'
        )

    def save(self, svg_path: Path, png_path: Path) -> None:
        self.finish()
        svg_lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            (
                f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.width}" '
                f'height="{self.height}" viewBox="0 0 {self.width} {self.height}" '
                'shape-rendering="crispEdges">'
            ),
            f"  <title>{escape(self.title)}</title>",
            "  <desc>Integer-pixel editable tactical environment; collision remains runtime authority.</desc>",
        ]
        for group_id, commands in self.groups:
            svg_lines.append(f'  <g id="{escape(group_id)}">')
            svg_lines.extend(f"    {command}" for command in commands)
            svg_lines.append("  </g>")
        svg_lines.append("</svg>")
        svg_path.write_text("\n".join(svg_lines) + "\n", encoding="utf-8", newline="\n")
        self.image.save(png_path, format="PNG", compress_level=9, optimize=False)


def tile_origin(cell: str, cell_size: int = 32) -> tuple[int, int]:
    column, row = (int(part) for part in cell.split(","))
    return column * cell_size, row * cell_size


def draw_board(source: dict) -> None:
    p = source["palette"]
    surface = Surface(384, 224, p, "Takamine bell-chamber tactical board")

    surface.begin("foundation")
    surface.rect(0, 0, 384, 224, "void")
    surface.rect(1, 1, 382, 222, "foundation")

    surface.begin("floor-modules")
    stone_steps = ["stone0", "stone1", "stone2", "stone1"]
    variants = source["construction"]["tileVariants"]
    for row in range(7):
        for column in range(12):
            x, y = column * 32, row * 32
            variant = (variants[column] + row * 3 + column * row) % len(stone_steps)
            surface.rect(x + 1, y + 1, 30, 30, stone_steps[variant])
            surface.rect(x + 2, y + 2, 28, 1, "stone3")
            surface.rect(x + 2, y + 29, 28, 1, "wetShadow")
            if (column + row) % 3 == 0:
                surface.rect(x + 7, y + 11, 12, 1, "wetHighlight")
                surface.rect(x + 7, y + 12, 7, 1, "stone3")
            elif (column * 2 + row) % 4 == 0:
                surface.rect(x + 18, y + 20, 8, 1, "wetHighlight")
            if (column * 5 + row * 7) % 6 == 0:
                surface.rect(x + 4, y + 25, 2, 2, "wetShadow")

    surface.begin("boundary-architecture")
    for cell in sorted(set(source["occupancy"]["blocked"]) - EXPECTED_FOOTPRINT):
        x, y = tile_origin(cell)
        top = y == 0
        surface.rect(x + 1, y + 1, 30, 30, "iron0")
        surface.rect(x + 3, y + 3, 26, 26, "cedar0")
        if top:
            surface.rect(x + 5, y + 4, 22, 17, "plaster0")
            surface.rect(x + 6, y + 5, 20, 14, "plaster1")
            surface.rect(x + 3, y + 22, 26, 6, "cedar1")
            surface.rect(x + 3, y + 27, 26, 2, "iron2")
            surface.rect(x + 8 + (x // 32) % 4, y + 8, 1, 6, "plaster0")
            surface.rect(x + 15 + (x // 32) % 5, y + 15, 6, 1, "plaster0")
        else:
            surface.rect(x + 3, y + 3, 26, 2, "iron2")
            surface.rect(x + 3, y + 7, 26, 6, "cedar1")
            surface.rect(x + 5, y + 15, 22, 13, "plaster0")
            surface.rect(x + 6, y + 16, 20, 11, "plaster1")
            surface.rect(x + 11 + (x // 32) % 6, y + 20, 7, 1, "plaster0")
        surface.rect(x + 3, y + 3, 3, 26, "cedar2")
        surface.rect(x + 26, y + 3, 3, 26, "cedar0")
        surface.rect(x + 5, y + (26 if top else 7), 2, 2, "agedBrass0")
        surface.rect(x + 25, y + (26 if top else 7), 2, 2, "agedBrass0")

    surface.begin("high-gallery")
    for row in (2, 3, 4):
        x, y = 0, row * 32
        surface.rect(x + 1, y + 1, 29, 30, "cedar0")
        surface.rect(x + 3, y + 2, 25, 6, "cedar1")
        surface.rect(x + 3, y + 10, 25, 6, "cedar2")
        surface.rect(x + 3, y + 18, 25, 5, "cedar1")
        surface.rect(x + 3, y + 25, 25, 5, "cedar2")
        surface.rect(x + 28, y + 1, 2, 30, "iron2")
        surface.rect(x + 26, y + 5, 2, 3, "iron3")
        surface.rect(x + 26, y + 24, 2, 3, "iron3")

    surface.begin("registry-resonator")
    # All heavy shapes stay inside the four-cell blocked footprint at x=160..223, y=64..127.
    surface.polygon(
        [(164, 64), (220, 64), (223, 68), (223, 123), (219, 127), (164, 127), (160, 123), (160, 68)],
        "iron0",
    )
    surface.polygon(
        [(166, 67), (218, 67), (220, 70), (220, 121), (217, 124), (166, 124), (163, 121), (163, 70)],
        "iron2",
    )
    surface.polygon([(168, 70), (190, 70), (190, 121), (168, 121), (166, 119), (166, 72)], "iron1")
    surface.polygon([(194, 70), (216, 70), (218, 72), (218, 119), (216, 121), (194, 121)], "iron1")
    surface.rect(190, 68, 4, 55, "lacquer")
    surface.rect(168, 75, 20, 3, "iron3")
    surface.rect(196, 75, 20, 3, "iron3")
    surface.rect(168, 113, 20, 3, "iron3")
    surface.rect(196, 113, 20, 3, "iron3")
    surface.rect(171, 81, 4, 27, "lacquer")
    surface.rect(209, 84, 4, 24, "lacquer")
    surface.rect(178, 83, 9, 3, "agedBrass0")
    surface.rect(181, 86, 6, 8, "agedBrass1")
    surface.rect(181, 94, 3, 7, "agedBrass0")
    surface.rect(197, 92, 11, 3, "agedBrass1")
    surface.rect(197, 95, 4, 9, "agedBrass0")
    surface.rect(201, 101, 7, 3, "agedBrass1")
    surface.rect(177, 105, 10, 3, "agedBrass0")
    surface.rect(204, 80, 4, 7, "agedBrass0")
    surface.rect(164, 92, 5, 5, "lacquer")
    surface.rect(215, 98, 5, 5, "lacquer")
    surface.rect(161, 74, 3, 14, "lacquer")
    surface.rect(220, 105, 3, 12, "lacquer")
    for x, y in ((164, 68), (214, 68), (164, 118), (214, 118)):
        surface.rect(x, y, 4, 4, "iron3")
        surface.rect(x + 1, y + 1, 2, 2, "agedBrass0")

    surface.begin("special-footings")
    for cell in source["specialCells"]["dryLanternFooting"]:
        x, y = tile_origin(cell)
        surface.rect(x + 5, y + 5, 22, 22, "dryStone")
        surface.rect(x + 6, y + 6, 20, 2, "dryEdge")
        surface.rect(x + 6, y + 24, 20, 2, "wetShadow")
        for px, py in ((8, 8), (22, 8), (8, 22), (22, 22)):
            surface.rect(x + px, y + py, 2, 2, "agedBrass1")
        surface.rect(x + 14, y + 13, 4, 6, "iron1")
    for cell in source["specialCells"]["bloodWardNodes"]:
        x, y = tile_origin(cell)
        surface.polygon(
            [(x + 7, y + 9), (x + 11, y + 5), (x + 24, y + 5), (x + 27, y + 8),
             (x + 27, y + 23), (x + 23, y + 27), (x + 8, y + 27), (x + 5, y + 24)],
            "iron0",
        )
        surface.rect(x + 9, y + 9, 14, 3, "iron3")
        surface.rect(x + 9, y + 15, 17, 3, "iron2")
        surface.rect(x + 9, y + 21, 11, 3, "iron3")
        surface.rect(x + 23, y + 10, 2, 5, "agedBrass0")
    # The exit is a passable threshold, not a wall or closed door.
    x, y = tile_origin(source["specialCells"]["postSurrenderExit"][0])
    surface.rect(x + 23, y + 2, 8, 28, "exitDepth")
    surface.rect(x + 27, y + 5, 4, 22, "exitLight")
    surface.rect(x + 19, y + 2, 4, 28, "iron2")
    surface.rect(x + 17, y + 4, 2, 24, "iron3")
    surface.rect(x + 9, y + 26, 10, 3, "dryStone")

    surface.begin("rain-drainage")
    for row_boundary in (32, 96, 160, 192):
        for start, end in ((32, 159), (224, 351)):
            surface.rect(start, row_boundary - 1, end - start + 1, 1, "wetShadow")
            if row_boundary in (96, 160):
                surface.rect(start + 7, row_boundary, end - start - 13, 1, "wetHighlight")
    for column in (1, 4, 7, 10):
        x = column * 32 + 27
        surface.rect(x, 35, 1, 154, "wetShadow")
        for y in range(40 + (column % 3) * 7, 186, 24):
            surface.rect(x - 1, y, 3, 5, "stone3")
    surface.rect(31, 66, 2, 92, "iron1")
    surface.rect(32, 70, 1, 84, "iron3")

    surface.begin("surface-detail")
    for row in range(1, 6):
        for column in range(1, 11):
            cell = f"{column},{row}"
            if cell in EXPECTED_FOOTPRINT:
                continue
            x, y = column * 32, row * 32
            selector = (column * 13 + row * 17 + source["construction"]["textureSeed"]) % 11
            if selector in (0, 5):
                surface.rect(x + 5, y + 7 + selector, 2, 1, "wetHighlight")
                surface.rect(x + 7, y + 8 + selector, 5, 1, "stone3")
            elif selector == 8:
                surface.rect(x + 21, y + 9, 1, 5, "wetShadow")
                surface.rect(x + 22, y + 13, 4, 1, "wetShadow")
    # Quiet scuffs identify deployment wear without painting unit markers.
    for cell in source["specialCells"]["partyDeployment"]:
        x, y = tile_origin(cell)
        surface.rect(x + 9, y + 23, 8, 1, "stone3")
        surface.rect(x + 18, y + 20, 5, 1, "wetShadow")
    x, y = tile_origin(source["specialCells"]["mateusDeployment"][0])
    surface.rect(x + 10, y + 8, 11, 1, "wetShadow")
    surface.rect(x + 15, y + 12, 8, 1, "stone3")

    surface.begin("edge-frame")
    surface.rect(0, 0, 384, 1, "void")
    surface.rect(0, 223, 384, 1, "void")
    surface.rect(0, 0, 1, 224, "void")
    surface.rect(383, 0, 1, 224, "void")
    surface.save(BOARD_SVG, BOARD_PNG)


def draw_occupancy(source: dict) -> None:
    palette = {
        "background": "#e4e7e8",
        "open": "#c8cdd0",
        "blocked": "#26303a",
        "footprint": "#111820",
        "special": "#68737b",
        "edge": "#8f989e",
        "light": "#f4f5f5",
    }
    surface = Surface(192, 112, palette, "Takamine monochrome occupancy reference")
    surface.begin("occupancy")
    surface.rect(0, 0, 192, 112, "background")
    blocked = set(source["occupancy"]["blocked"])
    footprint = set(source["occupancy"]["registryFootprint"])
    specials = {cell for values in source["specialCells"].values() for cell in values}
    for row in range(7):
        for column in range(12):
            x, y = column * 16, row * 16
            cell = f"{column},{row}"
            fill = "footprint" if cell in footprint else "blocked" if cell in blocked else "open"
            surface.rect(x + 1, y + 1, 14, 14, fill)
            if cell in specials and cell not in footprint:
                surface.rect(x + 4, y + 4, 8, 8, "special")
                surface.rect(x + 6, y + 6, 4, 4, "light")
    surface.save(OCCUPANCY_SVG, OCCUPANCY_PNG)


def draw_palette(source: dict) -> None:
    palette = source["palette"]
    surface = Surface(384, 128, palette, "Takamine palette and material modules")
    surface.begin("palette-swatches")
    surface.rect(0, 0, 384, 128, "void")
    swatches = list(palette)
    for index, key in enumerate(swatches):
        column, row = index % 8, index // 8
        surface.rect(column * 48 + 2, row * 20 + 2, 44, 16, key)
    surface.begin("material-modules")
    modules_y = 72
    for index, key in enumerate(("stone0", "stone1", "stone2", "stone3")):
        x = 4 + index * 36
        surface.rect(x, modules_y, 32, 32, key)
        surface.rect(x + 2, modules_y + 2, 28, 1, "wetHighlight")
        surface.rect(x + 5, modules_y + 19, 15, 1, "wetShadow")
    for index, key in enumerate(("cedar0", "cedar1", "cedar2")):
        x = 164 + index * 36
        surface.rect(x, modules_y, 32, 32, key)
        surface.rect(x + 3, modules_y + 7, 26, 2, "iron1")
        surface.rect(x + 3, modules_y + 22, 26, 1, "agedBrass0")
    x = 276
    surface.rect(x, modules_y, 32, 32, "iron0")
    surface.rect(x + 4, modules_y + 4, 24, 24, "iron2")
    surface.rect(x + 8, modules_y + 8, 16, 3, "iron3")
    surface.rect(x + 18, modules_y + 14, 4, 10, "agedBrass0")
    x = 324
    surface.rect(x, modules_y, 32, 32, "plaster0")
    surface.rect(x + 2, modules_y + 2, 28, 28, "plaster1")
    surface.rect(x + 8, modules_y + 10, 1, 8, "plaster0")
    surface.rect(x + 9, modules_y + 18, 12, 1, "plaster0")
    surface.save(PALETTE_SVG, PALETTE_PNG)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_dimensions(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        image.load()
        return image.size


def write_manifest(source: dict) -> None:
    layers = source["layers"]
    source_entries = [
        {
            "id": "layered-source",
            "path": SOURCE_PATH.name,
            "format": "json",
            "sha256": sha256(SOURCE_PATH),
        },
        {
            "id": "deterministic-builder",
            "path": Path(__file__).name,
            "format": "python",
            "sha256": sha256(Path(__file__).resolve()),
        },
    ]
    export_specs = [
        ("board-svg", BOARD_SVG, "svg", 384, 224),
        ("board-png", BOARD_PNG, "png", 384, 224),
        ("occupancy-svg", OCCUPANCY_SVG, "svg", 192, 112),
        ("occupancy-png", OCCUPANCY_PNG, "png", 192, 112),
        ("palette-svg", PALETTE_SVG, "svg", 384, 128),
        ("palette-png", PALETTE_PNG, "png", 384, 128),
    ]
    exports = []
    for export_id, path, file_format, width, height in export_specs:
        if file_format == "png" and png_dimensions(path) != (width, height):
            raise ValueError(f"{path.name} has unexpected raster dimensions")
        exports.append(
            {
                "id": export_id,
                "path": path.name,
                "format": file_format,
                "width": width,
                "height": height,
                "sha256": sha256(path),
            }
        )
    manifest = {
        "assetId": "tkm-bell-chamber",
        "status": "editable-production-stage",
        "canonicalSource": SOURCE_PATH.name,
        "builder": Path(__file__).name,
        "geometry": source["geometry"],
        "occupancy": source["occupancy"],
        "specialCells": source["specialCells"],
        "palette": source["palette"],
        "layers": layers,
        "sources": source_entries,
        "exports": exports,
        "runtimePolicy": {
            "collisionAuthority": "game/content/levels.mjs",
            "presentationOnly": True,
            "runtimeIntegration": "current 2x integer scale: 384 x 224 source composited as a 768 x 448 runtime board"
        },
        "review": {
            "internalCulturalConstraints": "applied",
            "externalCulturalReview": "pending",
            "artLock": False
        }
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def validate_manifest() -> dict:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    for entry in manifest["sources"] + manifest["exports"]:
        path = ROOT / entry["path"]
        if not path.is_file():
            raise ValueError(f"declared artifact is missing: {entry['path']}")
        actual = sha256(path)
        if actual != entry["sha256"]:
            raise ValueError(f"SHA-256 mismatch for {entry['path']}")
    if manifest["layers"] != load_source()["layers"]:
        raise ValueError("manifest and source layer order differ")
    if png_dimensions(BOARD_PNG) != (384, 224):
        raise ValueError("board PNG is not 384 x 224")
    return manifest


def build() -> dict:
    source = load_source()
    draw_board(source)
    draw_occupancy(source)
    draw_palette(source)
    write_manifest(source)
    return validate_manifest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="rebuild, then verify dimensions, source contracts, and every declared SHA-256",
    )
    parser.parse_args()
    manifest = build()
    board = next(item for item in manifest["exports"] if item["id"] == "board-png")
    print(
        json.dumps(
            {
                "ok": True,
                "assetId": manifest["assetId"],
                "board": board["path"],
                "dimensions": [board["width"], board["height"]],
                "sha256": board["sha256"],
                "layers": len(manifest["layers"]),
                "declaredArtifacts": len(manifest["sources"]) + len(manifest["exports"]),
            },
            separators=(",", ":"),
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
