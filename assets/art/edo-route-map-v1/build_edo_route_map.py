from __future__ import annotations

import argparse
import hashlib
import io
import json
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "edo-route-map.source.json"
BUILDER_PATH = Path(__file__).resolve()
BASE_NAME = "edo-route-map-base-v1.png"
ALL_ROUTES_NAME = "edo-route-map-all-routes-v1.png"
PREVIEW_NAME = "edo-route-map-preview-v1.png"
ICON_NAME = "edo-route-icon-atlas-v1.png"
INVENTORY_NAME = "top-down-tile-inventory-v1.json"
MANIFEST_NAME = "manifest.json"

FONT = {
    "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
    "B": ("11110", "10001", "10001", "11110", "10001", "10001", "11110"),
    "C": ("01111", "10000", "10000", "10000", "10000", "10000", "01111"),
    "D": ("11110", "10001", "10001", "10001", "10001", "10001", "11110"),
    "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
    "F": ("11111", "10000", "10000", "11110", "10000", "10000", "10000"),
    "G": ("01111", "10000", "10000", "10111", "10001", "10001", "01111"),
    "H": ("10001", "10001", "10001", "11111", "10001", "10001", "10001"),
    "I": ("11111", "00100", "00100", "00100", "00100", "00100", "11111"),
    "J": ("00111", "00010", "00010", "00010", "10010", "10010", "01100"),
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
    "W": ("10001", "10001", "10001", "10101", "10101", "10101", "01010"),
    "X": ("10001", "10001", "01010", "00100", "01010", "10001", "10001"),
    "Y": ("10001", "10001", "01010", "00100", "00100", "00100", "00100"),
    "Z": ("11111", "00001", "00010", "00100", "01000", "10000", "11111"),
    "0": ("01110", "10001", "10011", "10101", "11001", "10001", "01110"),
    "1": ("00100", "01100", "00100", "00100", "00100", "00100", "01110"),
    "2": ("01110", "10001", "00001", "00010", "00100", "01000", "11111"),
    "3": ("11110", "00001", "00001", "01110", "00001", "00001", "11110"),
    "4": ("00010", "00110", "01010", "10010", "11111", "00010", "00010"),
    "5": ("11111", "10000", "10000", "11110", "00001", "00001", "11110"),
    "6": ("01110", "10000", "10000", "11110", "10001", "10001", "01110"),
    "7": ("11111", "00001", "00010", "00100", "01000", "01000", "01000"),
    "8": ("01110", "10001", "10001", "01110", "10001", "10001", "01110"),
    "9": ("01110", "10001", "10001", "01111", "00001", "00001", "01110"),
    "-": ("00000", "00000", "00000", "11111", "00000", "00000", "00000"),
    "/": ("00001", "00010", "00010", "00100", "01000", "01000", "10000"),
    " ": ("00000",) * 7,
}


def sha256_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def save_png(image: Image.Image, path: Path) -> None:
    path.write_bytes(png_bytes(image))


def rgba(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (alpha,)


def draw_text(draw: ImageDraw.ImageDraw, position: tuple[int, int], text: str, color: tuple[int, int, int, int], scale: int = 1) -> None:
    x, y = position
    cursor = x
    for character in text.upper():
        glyph = FONT.get(character, FONT[" "])
        for row, bits in enumerate(glyph):
            for column, bit in enumerate(bits):
                if bit == "1":
                    draw.rectangle(
                        (
                            cursor + column * scale,
                            y + row * scale,
                            cursor + column * scale + scale - 1,
                            y + row * scale + scale - 1,
                        ),
                        fill=color,
                    )
        cursor += 6 * scale


def draw_mountain(draw: ImageDraw.ImageDraw, x: int, y: int, palette: dict) -> None:
    draw.polygon(((x, y + 10), (x + 7, y), (x + 14, y + 10)), fill=palette["ink"])
    draw.polygon(((x + 2, y + 9), (x + 7, y + 2), (x + 12, y + 9)), fill=palette["mountain"])
    draw.polygon(((x + 5, y + 4), (x + 7, y + 2), (x + 9, y + 5), (x + 7, y + 4)), fill=palette["white"])


def draw_tree(draw: ImageDraw.ImageDraw, x: int, y: int, palette: dict) -> None:
    draw.rectangle((x + 3, y + 7, x + 4, y + 11), fill=palette["road"])
    draw.polygon(((x, y + 8), (x + 4, y), (x + 8, y + 8)), fill=palette["ink"])
    draw.polygon(((x + 1, y + 7), (x + 4, y + 2), (x + 7, y + 7)), fill=palette["leaf"])


def draw_icon(icon_id: str, palette: dict) -> Image.Image:
    image = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    ink = palette["ink"]
    light = palette["parchment"]
    gold = palette["gold"]
    red = palette["ridge"]
    water = palette["waterLight"]
    if icon_id == "council":
        draw.rectangle((2, 5, 13, 13), fill=ink)
        draw.rectangle((3, 6, 12, 12), fill=light)
        draw.line((5, 7, 10, 7), fill=red)
        draw.line((5, 9, 10, 9), fill=ink)
        draw.line((5, 11, 9, 11), fill=ink)
        draw.rectangle((6, 3, 9, 5), fill=gold)
    elif icon_id == "village":
        draw.polygon(((1, 8), (5, 3), (9, 8)), fill=ink)
        draw.rectangle((2, 8, 8, 13), fill=red)
        draw.polygon(((7, 8), (11, 4), (15, 8)), fill=ink)
        draw.rectangle((8, 8, 14, 13), fill=light)
        draw.rectangle((10, 10, 11, 13), fill=ink)
    elif icon_id == "mountain":
        draw.polygon(((0, 13), (6, 2), (12, 13)), fill=ink)
        draw.polygon(((3, 12), (7, 5), (15, 13)), fill=palette["mountain"])
        draw.polygon(((4, 6), (6, 2), (8, 6), (6, 5)), fill=light)
    elif icon_id == "post-town":
        draw.rectangle((2, 4, 13, 13), fill=ink)
        draw.rectangle((4, 6, 11, 13), fill=palette["landLight"])
        draw.rectangle((6, 8, 9, 13), fill=ink)
        draw.rectangle((1, 2, 14, 5), fill=red)
        draw.rectangle((3, 1, 12, 2), fill=ink)
    elif icon_id == "watch":
        draw.rectangle((5, 4, 10, 14), fill=ink)
        draw.rectangle((6, 5, 9, 13), fill=palette["mountain"])
        draw.polygon(((2, 5), (8, 1), (14, 5)), fill=red)
        draw.rectangle((7, 7, 8, 8), fill=gold)
    elif icon_id == "ferry":
        draw.polygon(((1, 10), (14, 10), (11, 14), (4, 14)), fill=ink)
        draw.line((3, 9, 12, 9), fill=light, width=2)
        draw.line((8, 2, 8, 10), fill=gold)
        draw.polygon(((8, 3), (13, 7), (8, 7)), fill=light)
        draw.line((1, 15, 14, 15), fill=water)
    elif icon_id == "gate":
        draw.rectangle((2, 4, 4, 14), fill=ink)
        draw.rectangle((11, 4, 13, 14), fill=ink)
        draw.rectangle((1, 3, 14, 5), fill=red)
        draw.rectangle((4, 7, 11, 9), fill=gold)
        draw.rectangle((6, 9, 9, 14), fill=ink)
    elif icon_id == "edo-castle":
        draw.rectangle((2, 9, 13, 14), fill=ink)
        draw.rectangle((4, 6, 11, 11), fill=light)
        draw.rectangle((6, 3, 9, 8), fill=palette["white"])
        draw.polygon(((1, 9), (8, 5), (15, 9)), fill=red)
        draw.polygon(((3, 6), (8, 2), (13, 6)), fill=ink)
        draw.point((8, 1), fill=gold)
    else:
        raise ValueError(f"Unknown icon {icon_id}.")
    return image


def icon_atlas(spec: dict, palette: dict) -> Image.Image:
    atlas = Image.new("RGBA", (len(spec["iconOrder"]) * 16, 16), (0, 0, 0, 0))
    for column, icon_id in enumerate(spec["iconOrder"]):
        atlas.alpha_composite(draw_icon(icon_id, palette), (column * 16, 0))
    return atlas


def resolved_nodes(spec: dict, route: dict) -> list[dict]:
    nodes = []
    for entry in route["nodes"]:
        if entry.get("shared"):
            nodes.append({"id": entry["id"], **spec["sharedNodes"][entry["id"]]})
        else:
            nodes.append(entry)
    return nodes


def draw_route(draw: ImageDraw.ImageDraw, nodes: list[dict], color: tuple[int, int, int, int], width: int = 2) -> None:
    points = [tuple(node["position"]) for node in nodes]
    draw.line(points, fill=(0, 0, 0, 255), width=width + 2, joint="curve")
    draw.line(points, fill=color, width=width, joint="curve")
    for start, end in zip(points, points[1:]):
        steps = max(abs(end[0] - start[0]), abs(end[1] - start[1]))
        if steps <= 0:
            continue
        for step in range(0, steps + 1, 8):
            x = round(start[0] + (end[0] - start[0]) * step / steps)
            y = round(start[1] + (end[1] - start[1]) * step / steps)
            draw.rectangle((x - 1, y - 1, x + 1, y + 1), fill=color)


def map_background(spec: dict, palette: dict) -> Image.Image:
    width = spec["geometry"]["nativeWidth"]
    height = spec["geometry"]["nativeHeight"]
    image = Image.new("RGBA", (width, height), palette["ocean"])
    draw = ImageDraw.Draw(image)

    land = (
        (0, 0), (320, 0), (320, 112), (304, 109), (288, 117), (270, 115),
        (253, 127), (231, 125), (210, 137), (190, 132), (169, 143), (146, 139),
        (123, 153), (99, 145), (77, 151), (55, 139), (35, 142), (17, 128), (0, 132),
    )
    draw.polygon(land, fill=palette["land"], outline=palette["ink"])
    draw.line(land[15:] + land[:1], fill=palette["landLight"], width=1)

    for x in range(8, width, 19):
        y = 158 + ((x * 7) % 13)
        draw.line((x, y, min(width - 1, x + 7), y), fill=palette["waterLight"])
        if x % 38 == 8:
            draw.point((x + 3, y - 1), fill=palette["coast"])
    for x, y in ((19, 21), (38, 31), (57, 17), (92, 28), (107, 12), (143, 20), (160, 11), (204, 24)):
        draw_mountain(draw, x, y, palette)
    for x, y in ((15, 61), (36, 49), (55, 69), (88, 55), (111, 58), (145, 54), (170, 64), (205, 57), (227, 44)):
        draw_tree(draw, x, y, palette)

    draw.line(((44, 66), (58, 82), (82, 97), (104, 110), (126, 137)), fill=palette["waterLight"], width=2)
    draw.line(((201, 28), (207, 50), (221, 72), (232, 100), (244, 126)), fill=palette["waterLight"], width=2)
    draw.line(((274, 54), (270, 75), (276, 96), (270, 114)), fill=palette["waterLight"], width=1)

    draw.rectangle((4, 4, 102, 17), fill=palette["ink"])
    draw_text(draw, (9, 7), "ROAD TO EDO", palette["parchment"], 1)
    draw_text(draw, (277, 97), "EDO", palette["parchment"], 1)
    draw.line((303, 15, 303, 31), fill=palette["parchment"])
    draw.polygon(((303, 12), (300, 19), (306, 19)), fill=palette["ridge"])
    draw_text(draw, (299, 34), "N", palette["parchment"], 1)
    return image


def render_map(spec: dict, palette: dict, icons: Image.Image, colored: bool) -> Image.Image:
    image = map_background(spec, palette)
    draw = ImageDraw.Draw(image)
    for route in spec["routes"]:
        nodes = resolved_nodes(spec, route)
        route_color = palette[route["color"]] if colored else palette["routeMuted"]
        draw_route(draw, nodes, route_color, 2 if colored else 1)

    icon_lookup = {icon_id: index for index, icon_id in enumerate(spec["iconOrder"])}
    rendered_nodes = set()
    for route in spec["routes"]:
        for node in resolved_nodes(spec, route):
            if node["id"] in rendered_nodes:
                continue
            rendered_nodes.add(node["id"])
            x, y = node["position"]
            column = icon_lookup[node["icon"]]
            icon = icons.crop((column * 16, 0, column * 16 + 16, 16))
            image.alpha_composite(icon, (x - 8, y - 8))

    if colored:
        legend_y = 160
        for route, x in zip(spec["routes"], (8, 104, 218)):
            draw.rectangle((x, legend_y, x + 7, legend_y + 7), fill=palette[route["color"]], outline=palette["ink"])
            draw_text(draw, (x + 11, legend_y), route["shortLabel"], palette["parchment"], 1)
    return image


def visible_colors(image: Image.Image) -> int:
    return len({pixel[:3] for pixel in image.getdata() if pixel[3]})


def build_inventory() -> dict:
    return {
        "schemaVersion": 1,
        "scope": "current top-down production inventory",
        "liveLevelCoverage": {
            "totalLevels": 48,
            "fieldLevels": 29,
            "battleLevels": 19,
        },
        "regionalTileFoundation": {
            "package": "../world-tileset-suite-v1",
            "themeCount": 8,
            "rolesPerTheme": 16,
            "nativeTile": [16, 16],
            "tileCount": 128,
            "roles": [
                "floor-a", "floor-b", "floor-detail", "path", "wall", "wall-cap",
                "edge-north", "edge-south", "edge-west", "edge-east", "outer-corner",
                "inner-corner", "hazard-or-liquid", "prop-base", "threshold",
                "foreground-occluder",
            ],
        },
        "terrainOverlays": {
            "package": "../field-terrain-suite",
            "nativeTile": [16, 16],
            "count": 19,
            "roles": [
                "stone", "wet-stone", "shallow-puddle", "paper-litter", "cracked-board",
                "swing-beam-lane", "water", "storm-water", "cold-pool", "ash-field",
                "ember-ash", "umbral-ash", "bell-node", "furnace-grate", "legal-seal",
                "flowing-water", "high-gallery", "archive-floor", "dry-lantern",
            ],
        },
        "fieldActors": {
            "partyCharacters": 7,
            "npcRoles": 16,
            "enemyAndBossStates": 32,
        },
        "remainingHoles": [
            {"id": "roof-autotiles", "priority": "P1", "needed": "ridge, eave, corner, snow/rain caps"},
            {"id": "bridge-sets", "priority": "P1", "needed": "wood, stone, rope, broken states"},
            {"id": "shoreline-transitions", "priority": "P1", "needed": "inner/outer corners, shallows, banks, foam"},
            {"id": "multi-tile-buildings", "priority": "P1", "needed": "homes, post stations, warehouses, gates, castle compounds"},
            {"id": "vegetation-clusters", "priority": "P2", "needed": "cedar, bamboo, reeds, chrysanthemum, dead ash growth"},
            {"id": "elevation-transitions", "priority": "P2", "needed": "cliffs, stairs, ramps, retaining walls"},
            {"id": "animated-water-weather", "priority": "P2", "needed": "water cycles, rain splashes, ash drift, lightning reflection"},
            {"id": "interior-furniture", "priority": "P2", "needed": "tables, shelves, screens, braziers, beds, workshop pieces"},
            {"id": "large-landmarks", "priority": "P2", "needed": "bells, furnaces, ferry cranes, archive machinery"},
            {"id": "route-map-iconography", "priority": "filled-v1", "needed": "expanded by edo-route-map-v1"},
        ],
    }


def build(output_root: Path) -> list[Path]:
    spec = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    palette = {key: rgba(value) for key, value in spec["palette"].items()}
    icons = icon_atlas(spec, palette)
    base = render_map(spec, palette, icons, False)
    all_routes = render_map(spec, palette, icons, True)
    preview_scale = spec["geometry"]["previewScale"]
    preview = all_routes.resize(
        (all_routes.width * preview_scale, all_routes.height * preview_scale),
        Image.Resampling.NEAREST,
    )

    output_root.mkdir(parents=True, exist_ok=True)
    base_path = output_root / BASE_NAME
    all_routes_path = output_root / ALL_ROUTES_NAME
    preview_path = output_root / PREVIEW_NAME
    icon_path = output_root / ICON_NAME
    inventory_path = output_root / INVENTORY_NAME
    save_png(base, base_path)
    save_png(all_routes, all_routes_path)
    save_png(preview, preview_path)
    save_png(icons, icon_path)
    inventory_path.write_text(json.dumps(build_inventory(), indent=2) + "\n", encoding="utf-8")

    route_receipts = []
    for route in spec["routes"]:
        nodes = resolved_nodes(spec, route)
        route_receipts.append({
            "id": route["id"],
            "campaignFlag": route["campaignFlag"],
            "nodeIds": [node["id"] for node in nodes],
            "pathSignature": ">".join(node["id"] for node in nodes),
            "exclusiveIntermediateNodes": len(nodes) - 2,
            "reachesEdo": nodes[0]["id"] == "hoshigawa-council" and nodes[-1]["id"] == "edo",
            "effects": route["effects"],
        })

    outputs = [
        (BASE_NAME, base_path, base, "opaque-native-runtime-background"),
        (ALL_ROUTES_NAME, all_routes_path, all_routes, "opaque-native-all-route-review"),
        (PREVIEW_NAME, preview_path, preview, "nearest-neighbor-review"),
        (ICON_NAME, icon_path, icons, "binary-alpha-runtime-icon-atlas"),
    ]
    manifest = {
        "schemaVersion": 1,
        "assetId": spec["assetId"],
        "status": spec["status"],
        "provenance": {
            "classification": spec["classification"],
            "sourceMethod": "original code-native pixel primitives at 320x180 and 16x16",
            "generatorUsed": False,
            "originalityPolicy": spec["originalityPolicy"],
        },
        "source": {
            "path": SOURCE_PATH.name,
            "sha256": sha256_path(SOURCE_PATH),
        },
        "geometry": spec["geometry"],
        "palette": {
            "ceiling": len(spec["palette"]),
            "colors": spec["palette"],
        },
        "iconOrder": spec["iconOrder"],
        "routes": route_receipts,
        "choicePolicy": spec["routeChoicePolicy"],
        "outputs": [
            {
                "path": name,
                "sha256": sha256_path(path),
                "dimensions": list(image.size),
                "actualColors": visible_colors(image),
                "alphaValues": sorted(set(image.getchannel("A").getdata())),
                "purpose": purpose,
            }
            for name, path, image, purpose in outputs
        ],
        "inventory": {
            "path": INVENTORY_NAME,
            "sha256": sha256_path(inventory_path),
        },
        "builder": {
            "path": BUILDER_PATH.name,
            "sha256": sha256_path(BUILDER_PATH),
            "pillowVersion": PILLOW_VERSION,
            "deterministic": True,
            "integerAligned": True,
            "nativeResampling": "none",
            "previewResampling": "nearest-neighbor",
        },
    }
    manifest_path = output_root / MANIFEST_NAME
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return [
        Path(BASE_NAME),
        Path(ALL_ROUTES_NAME),
        Path(PREVIEW_NAME),
        Path(ICON_NAME),
        Path(INVENTORY_NAME),
        Path(MANIFEST_NAME),
    ]


def check() -> None:
    with tempfile.TemporaryDirectory(prefix="edo-route-map-check-") as temp:
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
    print("Deterministic check passed: all Edo route-map outputs are byte-identical.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Road to Edo route-selection map.")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
    else:
        build(ROOT)
        print("Built native Road to Edo map, icon atlas, route review, preview, inventory, and manifest.")


if __name__ == "__main__":
    main()
