from __future__ import annotations

import argparse
import hashlib
import io
import json
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "southern-japan-route-map.source.json"
BUILDER_PATH = Path(__file__).resolve()
BASE_NAME = "southern-japan-route-map-base-v2.png"
ALL_ROUTES_NAME = "southern-japan-route-map-all-routes-v2.png"
PREVIEW_NAME = "southern-japan-route-map-preview-v2.png"
ICON_NAME = "southern-japan-route-icon-atlas-v2.png"
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


def draw_mountain(draw: ImageDraw.ImageDraw, x: int, y: int, palette: dict, scale: int = 1) -> None:
    """Draw an integer-aligned relief peak with a one-pixel cast shadow."""
    points = ((x, y + 12 * scale), (x + 7 * scale, y), (x + 15 * scale, y + 12 * scale))
    draw.polygon(tuple((px + scale, py + scale) for px, py in points), fill=palette["landShadow"])
    draw.polygon(points, fill=palette["mountainDark"])
    draw.polygon(
        ((x + 2 * scale, y + 11 * scale), (x + 7 * scale, y + scale), (x + 9 * scale, y + 11 * scale)),
        fill=palette["mountain"],
    )
    draw.polygon(
        ((x + 7 * scale, y + scale), (x + 13 * scale, y + 11 * scale), (x + 9 * scale, y + 8 * scale)),
        fill=palette["mountainLight"],
    )
    draw.polygon(
        ((x + 5 * scale, y + 4 * scale), (x + 7 * scale, y + scale), (x + 10 * scale, y + 6 * scale), (x + 7 * scale, y + 5 * scale)),
        fill=palette["snow"],
    )


def draw_tree(draw: ImageDraw.ImageDraw, x: int, y: int, palette: dict, variant: int = 0) -> None:
    height = 10 + (variant % 3)
    draw.rectangle((x + 3, y + height - 3, x + 4, y + height + 1), fill=palette["mountainDark"])
    draw.polygon(((x + 1, y + height), (x + 4, y), (x + 8, y + height)), fill=palette["forestDark"])
    draw.polygon(((x + 2, y + height - 1), (x + 4, y + 2), (x + 6, y + height - 1)), fill=palette["forest"])
    draw.point((x + 4, y + 2), fill=palette["forestLight"])


def draw_castle(draw: ImageDraw.ImageDraw, x: int, y: int, palette: dict) -> None:
    ink = palette["ink"]
    draw.rectangle((x + 4, y + 10, x + 19, y + 20), fill=ink)
    draw.rectangle((x + 6, y + 11, x + 17, y + 19), fill=palette["paperLight"])
    draw.rectangle((x + 9, y + 6, x + 15, y + 14), fill=palette["white"])
    draw.polygon(((x + 2, y + 11), (x + 12, y + 6), (x + 21, y + 11)), fill=palette["jewel"])
    draw.polygon(((x + 6, y + 7), (x + 12, y + 2), (x + 18, y + 7)), fill=ink)
    draw.rectangle((x + 11, y + 16, x + 13, y + 20), fill=ink)
    draw.point((x + 12, y + 1), fill=palette["holy"])


def draw_icon(icon_id: str, palette: dict) -> Image.Image:
    image = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    ink = palette["ink"]
    paper = palette["paperLight"]
    white = palette["white"]
    gold = palette["northRoute"]
    red = palette["southRoute"]
    blue = palette["seaRoute"]

    if icon_id in {"start-port", "port"}:
        draw.polygon(((2, 16), (21, 16), (18, 21), (6, 21)), fill=ink)
        draw.polygon(((4, 16), (19, 16), (17, 19), (7, 19)), fill=palette["frameLight"])
        draw.rectangle((10, 5, 12, 16), fill=ink)
        draw.polygon(((12, 6), (19, 12), (12, 12)), fill=paper)
        draw.line((3, 22, 20, 22), fill=blue, width=1)
        if icon_id == "start-port":
            draw.rectangle((1, 1, 7, 7), fill=ink)
            draw.rectangle((2, 2, 6, 6), fill=red)
            draw.point((4, 4), fill=white)
    elif icon_id == "post-town":
        draw.rectangle((3, 9, 20, 21), fill=ink)
        draw.rectangle((5, 11, 18, 20), fill=palette["landLight"])
        draw.rectangle((10, 14, 13, 21), fill=ink)
        draw.polygon(((1, 10), (12, 3), (22, 10)), fill=ink)
        draw.polygon(((4, 9), (12, 5), (19, 9)), fill=red)
        draw.rectangle((7, 12, 9, 14), fill=paper)
    elif icon_id == "castle-town":
        draw_castle(draw, 0, 1, palette)
    elif icon_id == "strait":
        draw.rectangle((1, 3, 8, 20), fill=palette["landDark"])
        draw.rectangle((15, 3, 22, 20), fill=palette["landDark"])
        draw.line((10, 3, 10, 20), fill=blue)
        draw.line((13, 3, 13, 20), fill=blue)
        draw.polygon(((8, 10), (12, 6), (16, 10), (12, 14)), fill=ink)
        draw.polygon(((10, 10), (12, 8), (14, 10), (12, 12)), fill=gold)
    elif icon_id == "ship":
        draw.polygon(((2, 15), (21, 15), (18, 20), (6, 20)), fill=ink)
        draw.rectangle((11, 3, 12, 15), fill=gold)
        draw.polygon(((12, 4), (20, 11), (12, 11)), fill=paper)
        draw.polygon(((10, 6), (4, 12), (10, 12)), fill=palette["frameLight"])
        draw.line((3, 22, 20, 22), fill=blue)
    elif icon_id == "ferry":
        draw.polygon(((2, 14), (21, 14), (18, 20), (5, 20)), fill=ink)
        draw.polygon(((4, 14), (19, 14), (17, 18), (7, 18)), fill=palette["frameLight"])
        draw.rectangle((5, 9, 18, 13), fill=paper)
        draw.rectangle((8, 6, 15, 9), fill=ink)
        draw.line((2, 22, 21, 22), fill=blue)
    elif icon_id == "mountain-pass":
        draw_mountain(draw, 3, 5, palette)
        draw.line((1, 21, 22, 21), fill=gold, width=2)
    elif icon_id == "capital":
        draw_castle(draw, 0, 1, palette)
        draw.rectangle((2, 2, 6, 6), fill=ink)
        draw.rectangle((3, 3, 5, 5), fill=gold)
        draw.rectangle((18, 2, 22, 6), fill=ink)
        draw.rectangle((19, 3, 21, 5), fill=gold)
    elif icon_id == "route-jewel":
        draw.polygon(((12, 1), (21, 7), (19, 17), (12, 23), (4, 17), (2, 7)), fill=ink)
        draw.polygon(((12, 3), (19, 8), (17, 16), (12, 20), (6, 16), (4, 8)), fill=red)
        draw.polygon(((12, 5), (17, 8), (12, 11), (7, 8)), fill=white)
    else:
        raise ValueError(f"Unknown icon {icon_id}.")
    return image


def icon_atlas(spec: dict, palette: dict) -> Image.Image:
    icon_width = spec["geometry"]["iconWidth"]
    icon_height = spec["geometry"]["iconHeight"]
    atlas = Image.new("RGBA", (len(spec["iconOrder"]) * icon_width, icon_height), (0, 0, 0, 0))
    for column, icon_id in enumerate(spec["iconOrder"]):
        atlas.alpha_composite(draw_icon(icon_id, palette), (column * icon_width, 0))
    return atlas


def resolved_nodes(spec: dict, route: dict) -> list[dict]:
    nodes = []
    for entry in route["nodes"]:
        if entry.get("shared"):
            nodes.append({"id": entry["id"], **spec["sharedNodes"][entry["id"]]})
        else:
            nodes.append(entry)
    return nodes


def draw_route(
    draw: ImageDraw.ImageDraw,
    nodes: list[dict],
    color: tuple[int, int, int, int],
    kind: str,
    width: int = 2,
) -> None:
    points = [tuple(node["position"]) for node in nodes]
    draw.line(points, fill=(23, 21, 27, 255), width=width + 4, joint="curve")
    draw.line(points, fill=color, width=width, joint="curve")
    for start, end in zip(points, points[1:]):
        steps = max(abs(end[0] - start[0]), abs(end[1] - start[1]))
        if steps <= 0:
            continue
        spacing = 9 if kind == "sea" else 11
        for step in range(0, steps + 1, spacing):
            x = round(start[0] + (end[0] - start[0]) * step / steps)
            y = round(start[1] + (end[1] - start[1]) * step / steps)
            if kind == "sea":
                draw.rectangle((x - 2, y - 1, x + 2, y + 1), fill=color)
                draw.point((x, y - 2), fill=(255, 241, 184, 255))
            else:
                draw.rectangle((x - 1, y - 1, x + 1, y + 1), fill=color)


def draw_coast(draw: ImageDraw.ImageDraw, points: tuple[tuple[int, int], ...], palette: dict) -> None:
    shadow = tuple((x + 3, y + 4) for x, y in points)
    draw.polygon(shadow, fill=palette["oceanDeep"])
    draw.line(shadow + (shadow[0],), fill=palette["water"], width=2, joint="curve")
    draw.polygon(points, fill=palette["land"])
    draw.line(points + (points[0],), fill=palette["ink"], width=2, joint="curve")
    inner = tuple((x, y - 1) for x, y in points)
    draw.line(inner + (inner[0],), fill=palette["landLight"], width=1, joint="curve")
    for index, (start, end) in enumerate(zip(points, points[1:] + points[:1])):
        if index % 2:
            continue
        x0, y0 = start
        x1, y1 = end
        midpoint = ((x0 + x1) // 2 + 2, (y0 + y1) // 2 + 3)
        draw.point(midpoint, fill=palette["foam"])


def draw_parchment_texture(draw: ImageDraw.ImageDraw, width: int, height: int, palette: dict) -> None:
    """Deterministic vellum grain, tide staining, folds, and worn sheet edges."""
    for y in range(12, height - 11, 3):
        for x in range(12, width - 11, 3):
            grain = (x * 37 + y * 61 + x * y * 3) % 173
            if grain == 0:
                draw.point((x, y), fill=palette["vellumDark"])
            elif grain in {7, 19}:
                draw.point((x, y), fill=palette["vellumMid"])
            elif grain == 41:
                draw.line((x, y, min(width - 12, x + 2), y), fill=palette["vellumLight"])

    # Old water and wax stains are hard-edged by design at native resolution.
    for bounds in ((22, 46, 86, 94), (370, 174, 457, 244), (173, 194, 247, 252)):
        draw.ellipse(bounds, outline=palette["vellumDark"], width=1)
        inset = tuple(value + (3 if index < 2 else -3) for index, value in enumerate(bounds))
        draw.arc(inset, 18, 205, fill=palette["stain"], width=1)
    draw.arc((31, 55, 77, 85), 190, 345, fill=palette["paperDark"])
    draw.arc((386, 190, 444, 232), 15, 174, fill=palette["paperDark"])

    # Fold wear crosses the sheet but never introduces subpixel softness.
    draw.line((239, 10, 239, height - 11), fill=palette["vellumDark"])
    draw.line((240, 10, 240, height - 11), fill=palette["vellumLight"])
    draw.line((10, 134, width - 11, 134), fill=palette["vellumDark"])
    draw.line((10, 135, width - 11, 135), fill=palette["vellumLight"])

    for x in range(15, width - 15, 18):
        if (x // 18) % 3:
            draw.line((x, 9, x + 8, 9), fill=palette["vellumLight"])
        else:
            draw.line((x, height - 10, x + 8, height - 10), fill=palette["vellumDark"])


def draw_cartographic_hachures(draw: ImageDraw.ImageDraw, palette: dict) -> None:
    groups = (
        (61, 183, 1), (91, 150, -1), (150, 93, 1), (183, 84, -1),
        (242, 82, 1), (286, 81, -1), (333, 78, 1), (381, 77, -1),
        (218, 177, 1), (269, 177, -1), (303, 173, 1),
    )
    for x, y, direction in groups:
        for offset in range(0, 14, 4):
            draw.line(
                (x + offset, y + 12, x + offset + 5 * direction, y + 18),
                fill=palette["mountainDark"],
            )
            if offset % 8 == 0:
                draw.point((x + offset + 2 * direction, y + 19), fill=palette["paperLight"])


def draw_region_texture(draw: ImageDraw.ImageDraw, palette: dict) -> None:
    # Hand-positioned relief clusters keep the raster deterministic and editable.
    mountain_groups = (
        (56, 171), (65, 190), (77, 202), (92, 142), (99, 118),
        (151, 86), (174, 76), (199, 72), (246, 69), (280, 72),
        (315, 68), (351, 73), (382, 70), (405, 67),
        (213, 168), (242, 171), (275, 163), (302, 167),
    )
    for index, (x, y) in enumerate(mountain_groups):
        draw_mountain(draw, x, y, palette)
        if index % 3 == 0:
            draw_mountain(draw, x + 10, y + 5, palette)

    forest_groups = (
        (49, 131), (58, 116), (70, 145), (83, 166), (99, 153), (111, 127),
        (139, 105), (160, 102), (184, 94), (235, 96), (260, 95), (292, 93),
        (339, 91), (365, 88), (398, 88), (232, 180), (260, 180), (289, 176),
    )
    for index, (x, y) in enumerate(forest_groups):
        draw_tree(draw, x, y, palette, index)
        draw_tree(draw, x + 7, y + 3, palette, index + 1)
        if index % 2 == 0:
            draw_tree(draw, x + 13, y, palette, index + 2)
    draw_cartographic_hachures(draw, palette)

    # Sparse survey marks and farmland strokes add scale without noisy labels.
    for x, y in (
        (72, 157), (105, 139), (137, 113), (171, 111), (203, 105),
        (254, 110), (299, 105), (349, 102), (393, 93),
        (231, 187), (281, 184), (315, 177),
    ):
        draw.line((x, y, x + 7, y - 2), fill=palette["road"])
        draw.line((x + 2, y + 3, x + 9, y + 1), fill=palette["paperDark"])


def draw_frame(draw: ImageDraw.ImageDraw, width: int, height: int, palette: dict) -> None:
    draw.rectangle((0, 0, width - 1, height - 1), fill=palette["ink"])
    draw.rectangle((2, 2, width - 3, height - 3), fill=palette["frameDark"])
    draw.rectangle((3, 3, width - 4, height - 4), outline=palette["frameMid"], width=2)
    draw.rectangle((5, 5, width - 6, height - 6), outline=palette["frameLight"], width=1)
    draw.rectangle((7, 7, width - 8, height - 8), outline=palette["paperDark"], width=2)
    for x in range(14, width - 14, 12):
        draw.point((x, 5), fill=palette["holy"])
        draw.point((x, height - 6), fill=palette["paper"])
    for y in range(14, height - 14, 12):
        draw.point((5, y), fill=palette["holy"])
        draw.point((width - 6, y), fill=palette["paper"])
    for x, y in ((5, 5), (width - 12, 5), (5, height - 12), (width - 12, height - 12)):
        draw.rectangle((x, y, x + 7, y + 7), fill=palette["paper"])
        draw.polygon(((x + 4, y + 1), (x + 7, y + 4), (x + 4, y + 7), (x + 1, y + 4)), fill=palette["jewel"])
        draw.point((x + 4, y + 4), fill=palette["holy"])


def map_background(spec: dict, palette: dict) -> Image.Image:
    width = spec["geometry"]["nativeWidth"]
    height = spec["geometry"]["nativeHeight"]
    image = Image.new("RGBA", (width, height), palette["oceanDeep"])
    draw = ImageDraw.Draw(image)
    draw_frame(draw, width, height, palette)
    draw.rectangle((9, 9, width - 10, height - 10), fill=palette["ocean"])
    draw_parchment_texture(draw, width, height, palette)

    for y in range(18, height - 14, 9):
        offset = 5 if (y // 8) % 2 else 0
        for x in range(15 + offset, width - 16, 22):
            if (x * 3 + y * 5) % 7:
                draw.line((x, y, x + 8, y), fill=palette["water"])
                if (x + y) % 3 == 0:
                    draw.point((x + 2, y - 1), fill=palette["foam"])

    kyushu = (
        (20, 145), (27, 129), (39, 121), (43, 108), (55, 105), (61, 93),
        (78, 88), (88, 98), (103, 94), (116, 104), (122, 120), (115, 133),
        (127, 147), (122, 160), (110, 170), (106, 188), (93, 205), (80, 226),
        (67, 240), (55, 236), (58, 219), (46, 204), (42, 190), (31, 185),
        (34, 169), (23, 160),
    )
    honshu = (
        (116, 75), (136, 66), (155, 61), (176, 56), (196, 49), (218, 52),
        (240, 47), (258, 51), (280, 46), (305, 50), (328, 45), (351, 51),
        (370, 46), (391, 52), (412, 49), (433, 57), (452, 55), (469, 62),
        (470, 72), (461, 81), (451, 91), (437, 95), (425, 104), (412, 108),
        (395, 113), (378, 109), (363, 119), (345, 116), (326, 124),
        (307, 120), (289, 129), (271, 123), (254, 131), (234, 125),
        (216, 132), (197, 126), (181, 133), (165, 126), (149, 133),
        (136, 124), (124, 128), (113, 116), (117, 103), (111, 92),
    )
    shikoku = (
        (193, 157), (214, 148), (234, 151), (252, 144), (272, 149), (292, 143),
        (313, 148), (330, 158), (328, 172), (314, 184), (294, 187), (277, 198),
        (255, 194), (237, 202), (220, 197), (206, 185), (193, 174),
    )
    awaji = ((344, 129), (352, 132), (356, 143), (351, 151), (345, 147), (342, 138))
    for region in (kyushu, honshu, shikoku, awaji):
        draw_coast(draw, region, palette)

    islands = (
        ((145, 139), (151, 136), (157, 140), (153, 145), (147, 144)),
        ((169, 147), (174, 143), (180, 146), (178, 151), (171, 152)),
        ((188, 139), (193, 136), (198, 139), (195, 143), (190, 144)),
        ((270, 137), (275, 134), (280, 137), (278, 141), (272, 141)),
        ((301, 128), (306, 125), (311, 128), (308, 132), (303, 132)),
    )
    for island in islands:
        shadow = tuple((x + 2, y + 3) for x, y in island)
        draw.polygon(shadow, fill=palette["oceanDeep"])
        draw.polygon(island, fill=palette["land"])
        draw.line(island + (island[0],), fill=palette["ink"], width=1)

    # Inland rivers and bays.
    draw.line(((402, 107), (409, 98), (413, 89), (423, 82)), fill=palette["inkBlue"], width=2)
    draw.line(((87, 145), (93, 133), (102, 126), (109, 116)), fill=palette["inkBlue"], width=1)
    draw.line(((284, 117), (290, 109), (299, 103)), fill=palette["inkBlue"], width=1)
    draw_region_texture(draw, palette)

    # Regional labels are subordinate to route information.
    draw_text(draw, (52, 213), "KYUSHU", palette["inkSoft"], 1)
    draw_text(draw, (254, 58), "WESTERN HONSHU", palette["inkSoft"], 1)
    draw_text(draw, (243, 188), "SHIKOKU", palette["inkSoft"], 1)
    draw_text(draw, (205, 139), "SETO INLAND SEA", palette["inkBlue"], 1)
    draw_text(draw, (360, 129), "OSAKA BAY", palette["inkBlue"], 1)

    # Illuminated title cartouche and map furniture.
    draw.rectangle((13, 13, 207, 45), fill=palette["vellumDark"])
    draw.rectangle((15, 15, 205, 43), fill=palette["inkSoft"])
    draw.rectangle((17, 17, 203, 41), outline=palette["frameLight"])
    draw.polygon(((13, 13), (21, 13), (13, 21)), fill=palette["holy"])
    draw.polygon(((207, 45), (199, 45), (207, 37)), fill=palette["jewel"])
    draw_text(draw, (23, 20), "THREE PASSAGES TO MIYAKO", palette["white"], 1)
    draw_text(draw, (23, 31), "NAGASAKI - KYOTO", palette["northRoute"], 1)

    # Eight-point compass rose, inked as a discrete cartographic ornament.
    draw.ellipse((435, 14, 463, 42), outline=palette["inkSoft"], width=1)
    draw.line((449, 12, 449, 45), fill=palette["inkSoft"], width=1)
    draw.line((432, 28, 466, 28), fill=palette["inkSoft"], width=1)
    draw.polygon(((449, 12), (444, 29), (449, 25), (454, 29)), fill=palette["southRoute"])
    draw.polygon(((449, 44), (445, 28), (449, 31), (453, 28)), fill=palette["paperLight"])
    draw.polygon(((432, 28), (449, 24), (445, 28), (449, 32)), fill=palette["frameLight"])
    draw.polygon(((466, 28), (449, 24), (453, 28), (449, 32)), fill=palette["holy"])
    draw_text(draw, (446, 48), "N", palette["inkSoft"], 1)

    draw.rectangle((395, 238, 459, 263), fill=palette["vellumMid"])
    draw.rectangle((397, 240, 457, 261), outline=palette["inkSoft"])
    draw.line((402, 247, 452, 247), fill=palette["inkSoft"], width=2)
    for x in range(402, 453, 10):
        draw.line((x, 244, x, 251), fill=palette["inkSoft"])
    draw_text(draw, (402, 253), "100 RI", palette["inkSoft"], 1)
    return image


def render_map(spec: dict, palette: dict, icons: Image.Image, colored: bool) -> Image.Image:
    image = map_background(spec, palette)
    draw = ImageDraw.Draw(image)
    for route in spec["routes"]:
        nodes = resolved_nodes(spec, route)
        route_color = palette[route["color"]] if colored else palette["routeMuted"]
        draw_route(draw, nodes, route_color, route["pathKind"], 3 if colored else 1)

    icon_lookup = {icon_id: index for index, icon_id in enumerate(spec["iconOrder"])}
    icon_width = spec["geometry"]["iconWidth"]
    icon_height = spec["geometry"]["iconHeight"]
    rendered_nodes = set()
    for route in spec["routes"]:
        for node in resolved_nodes(spec, route):
            if node["id"] in rendered_nodes:
                continue
            rendered_nodes.add(node["id"])
            x, y = node["position"]
            column = icon_lookup[node["icon"]]
            icon = icons.crop((column * icon_width, 0, column * icon_width + icon_width, icon_height))
            image.alpha_composite(icon, (x - icon_width // 2, y - icon_height // 2))

    if colored:
        legend_y = 241
        for route, x in zip(spec["routes"], (18, 128, 244)):
            draw.rectangle((x, legend_y, x + 8, legend_y + 8), fill=palette[route["color"]], outline=palette["ink"])
            draw_text(draw, (x + 13, legend_y + 1), route["shortLabel"], palette["white"], 1)

    # Priority labels: avoid a dense proof-map look while retaining geographic anchors.
    label_specs = (
        ("NAGASAKI", (17, 165), "white"),
        ("KANMON", (108, 78), "paperLight"),
        ("HIROSHIMA", (191, 84), "paperLight"),
        ("MATSUYAMA", (192, 177), "paperLight"),
        ("SAKAI", (372, 132), "paperLight"),
        ("KYOTO / MIYAKO", (394, 55), "white"),
    )
    for label, position, color_key in label_specs:
        x, y = position
        text_width = len(label) * 6
        draw.rectangle((x - 2, y - 2, x + text_width + 1, y + 8), fill=palette["inkSoft"])
        draw_text(draw, position, label, palette[color_key], 1)
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
            {
                "id": "route-map-iconography",
                "priority": "filled-v2",
                "needed": "expanded by southern-japan-route-map-v2",
            },
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
            "reachesKyoto": nodes[0]["id"] == "nagasaki" and nodes[-1]["id"] == "kyoto",
            "pathKind": route["pathKind"],
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
            "sourceMethod": (
                "original code-native pixel primitives at 480x270 with 24x24 icons; "
                "deterministic vellum grain, stains, fold wear, hachures, tide lines, "
                "and illuminated cartographic ornament"
            ),
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
    with tempfile.TemporaryDirectory(prefix="southern-japan-route-map-check-") as temp:
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
    print("Deterministic check passed: all Southern Japan route-map outputs are byte-identical.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Nagasaki-to-Kyoto route-selection map.")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
    else:
        build(ROOT)
        print("Built native Southern Japan map, icon atlas, route review, preview, inventory, and manifest.")


if __name__ == "__main__":
    main()
