from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SPEC_PATH = ROOT / "world-tileset-suite.source.json"
BUILDER_PATH = Path(__file__).resolve()
TOP_ATLAS = "top-down-regional-tiles-v1.png"
SIDE_ATLAS = "side-view-regional-tiles-v1.png"
TOP_CONTACT = "top-down-regional-tiles-contact-sheet-v1.png"
SIDE_CONTACT = "side-view-regional-tiles-contact-sheet-v1.png"
MANIFEST_NAME = "manifest.json"
RUNTIME_CONTRACT = "world-tileset-runtime-v1.json"


def color(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (255,)


def sha256_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pixel_hash(seed: int, x: int, y: int) -> int:
    value = (seed + x * 374761393 + y * 668265263) & 0xFFFFFFFF
    value = (value ^ (value >> 13)) * 1274126177 & 0xFFFFFFFF
    return value ^ (value >> 16)


def texture(draw: ImageDraw.ImageDraw, bounds: tuple[int, int, int, int], palette: dict, seed: int, density: int = 9) -> None:
    left, top, right, bottom = bounds
    choices = (palette["shadow"], palette["light"], palette["material"])
    for y in range(top + 1, bottom - 1):
        for x in range(left + 1, right - 1):
            value = pixel_hash(seed, x, y)
            if value % density == 0:
                draw.point((x, y), fill=choices[(value >> 5) % len(choices)])


def motif_mark(draw: ImageDraw.ImageDraw, palette: dict, motif: str, size: int) -> None:
    center = size // 2
    if motif == "cedar":
        draw.line((center - 5, center, center + 5, center), fill=palette["material"], width=2)
        draw.point((center - 2, center - 1), fill=palette["accent"])
        draw.point((center + 3, center + 1), fill=palette["accent"])
    elif motif == "river":
        draw.arc((center - 6, center - 4, center + 3, center + 3), 15, 165, fill=palette["accent"])
        draw.arc((center - 2, center, center + 6, center + 5), 195, 345, fill=palette["light"])
    elif motif == "road":
        draw.line((center - 5, center - 4, center + 4, center + 5), fill=palette["material"])
        draw.line((center - 2, center - 5, center + 6, center + 3), fill=palette["accent"])
    elif motif == "ash":
        draw.line((center - 5, center + 4, center, center - 4, center + 5, center + 3), fill=palette["light"])
        draw.point((center, center - 1), fill=palette["hazard"])
    elif motif == "lacquer":
        draw.rectangle((center - 4, center - 4, center + 4, center + 4), outline=palette["accent"])
        draw.line((center, center - 3, center, center + 3), fill=palette["material"])
    elif motif == "archive":
        draw.rectangle((center - 5, center - 4, center + 5, center + 4), fill=palette["material"], outline=palette["outline"])
        draw.line((center - 3, center - 2, center + 3, center - 2), fill=palette["accent"])
        draw.line((center - 3, center + 1, center + 3, center + 1), fill=palette["light"])
    elif motif == "forge":
        draw.rectangle((center - 5, center - 4, center + 5, center + 4), fill=palette["shadow"], outline=palette["light"])
        draw.rectangle((center - 2, center - 2, center + 2, center + 2), fill=palette["hazard"])
    else:
        draw.ellipse((center - 5, center - 5, center + 5, center + 5), outline=palette["accent"], width=2)
        draw.ellipse((center - 2, center - 2, center + 2, center + 2), fill=palette["hazard"])


# ---------------------------------------------------------------------------
# Top-down field kit (v1.1). Every pixel below is an explicit palette index at
# native 16x16 resolution. Exterior floors keep a uniform `mid` border so they
# merge across cells; interior floors keep a uniform `shadow` seam border so
# boards and plates read as laid modules. Edge and corner roles follow the
# `topDown.autotileBands` strip contract consumed by
# `game/field-tileset-presentation.mjs`.
# ---------------------------------------------------------------------------

EXTERIOR_FLOORS = {"cedar", "river", "road", "ash"}
VILLAGE_WALLS = {"cedar", "river", "road", "ash"}


def put(draw: ImageDraw.ImageDraw, points, fill) -> None:
    for point in points:
        draw.point(point, fill=fill)


def floor_border_key(motif: str) -> str:
    return "mid" if motif in EXTERIOR_FLOORS else "shadow"


def paint_floor(draw: ImageDraw.ImageDraw, palette: dict, motif: str, variant: str, seed: int) -> None:
    """Paint a quiet floor module. `variant` is `a`, `b`, or `detail`.

    `a` is the most frequent module, so it carries only isolated specks; `b`
    carries the joint pattern; `detail` carries one small material story.
    Floors stay in the scene's midtones with no object-like shapes, so actors,
    markers, and masses win value contests.
    """
    p = palette
    if motif in EXTERIOR_FLOORS:
        draw.rectangle((0, 0, 15, 15), fill=p["mid"])
    else:
        draw.rectangle((0, 0, 15, 15), fill=p["shadow"])
        draw.rectangle((1, 1, 14, 14), fill=p["mid"])

    if motif == "cedar":  # wet stone road under cedar rain
        if variant == "a":
            put(draw, ((4, 4), (11, 10)), p["shadow"])
            put(draw, ((12, 3),), p["deep"])
            put(draw, ((3, 12),), p["light"])
        elif variant == "b":
            draw.line((1, 6, 6, 6), fill=p["shadow"])
            draw.line((6, 7, 6, 9), fill=p["shadow"])
            draw.line((2, 7, 3, 7), fill=p["light"])
            draw.line((9, 12, 12, 12), fill=p["shadow"])
            put(draw, ((10, 13), (11, 13)), p["shadow"])
            put(draw, ((10, 12),), p["light"])
        else:
            draw.line((4, 5, 6, 7), fill=p["material"])
            draw.line((10, 10, 12, 9), fill=p["material"])
            put(draw, ((6, 7),), p["accent"])
            draw.line((11, 4, 12, 4), fill=p["light"])
    elif motif == "river":  # river-ward embankment slabs
        if variant == "a":
            put(draw, ((5, 3), (10, 11)), p["shadow"])
            put(draw, ((12, 5),), p["deep"])
            put(draw, ((3, 9),), p["light"])
        elif variant == "b":
            draw.line((1, 8, 9, 8), fill=p["shadow"])
            draw.line((9, 9, 9, 12), fill=p["shadow"])
            put(draw, ((2, 9), (3, 9)), p["light"])
            draw.line((12, 2, 12, 4), fill=p["shadow"])
        else:
            for x, y in ((4, 6), (9, 9)):
                put(draw, ((x, y), (x + 1, y)), p["light"])
                put(draw, ((x, y + 1), (x + 1, y + 1)), p["shadow"])
            put(draw, ((11, 4),), p["deep"])
    elif motif == "road":  # packed relay-road earth
        if variant == "a":
            put(draw, ((3, 4), (11, 10)), p["light"])
            put(draw, ((7, 8),), p["deep"])
            put(draw, ((13, 3),), p["shadow"])
        elif variant == "b":
            draw.line((2, 12, 5, 12), fill=p["shadow"])
            draw.line((7, 5, 10, 5), fill=p["shadow"])
            draw.line((6, 6, 9, 6), fill=p["shadow"])
            put(draw, ((12, 11),), p["light"])
            put(draw, ((4, 3),), p["deep"])
        else:
            draw.line((4, 7, 6, 5), fill=p["accent"])
            put(draw, ((7, 6),), p["accent"])
            put(draw, ((10, 10), (12, 10), (11, 11)), p["shadow"])
    elif motif == "ash":  # ash pass cinders
        texture(draw, (0, 0, 16, 16), {"shadow": p["shadow"], "light": p["shadow"], "material": p["deep"]}, seed, 13)
        if variant == "b":
            put(draw, ((5, 6), (6, 6)), p["light"])
            draw.line((4, 7, 8, 7), fill=p["shadow"])
            put(draw, ((11, 11),), p["light"])
        elif variant == "detail":
            put(draw, ((8, 8),), p["hazard"])
            put(draw, ((7, 8), (8, 9)), p["accent"])
            put(draw, ((6, 9), (9, 7)), p["deep"])
    elif motif == "lacquer":  # black-lacquer castle boards
        draw.line((1, 7, 14, 7), fill=p["shadow"])
        joint_top, joint_bottom = (10, 5) if variant != "b" else (4, 11)
        draw.line((joint_top, 1, joint_top, 6), fill=p["shadow"])
        draw.line((joint_bottom, 8, joint_bottom, 14), fill=p["shadow"])
        if variant == "b":
            draw.line((6, 3, 8, 3), fill=p["light"])
        elif variant == "detail":
            draw.line((2, 3, 4, 3), fill=p["light"])
            put(draw, ((11, 11), (12, 11)), p["deep"])
    elif motif == "archive":  # cedar archive boards
        draw.line((1, 5, 14, 5), fill=p["shadow"])
        draw.line((1, 10, 14, 10), fill=p["shadow"])
        ends = {"a": (6, 11, 3), "b": (10, 4, 8), "detail": (8, 13, 5)}[variant]
        draw.line((ends[0], 1, ends[0], 4), fill=p["shadow"])
        draw.line((ends[1], 6, ends[1], 9), fill=p["shadow"])
        draw.line((ends[2], 11, ends[2], 14), fill=p["shadow"])
        if variant == "b":
            draw.line((1, 12, 3, 12), fill=p["light"])
        elif variant == "detail":
            put(draw, ((11, 7), (12, 8)), p["material"])
            put(draw, ((11, 8),), p["deep"])
    elif motif == "forge":  # scorched forge flags
        if variant == "a":
            draw.line((8, 1, 8, 14), fill=p["shadow"])
            put(draw, ((9, 1),), p["light"])
            put(draw, ((4, 10),), p["deep"])
        elif variant == "b":
            draw.line((1, 7, 14, 7), fill=p["shadow"])
            put(draw, ((1, 8), (2, 8)), p["light"])
            put(draw, ((10, 11), (11, 11), (11, 12)), p["deep"])
        else:
            draw.line((8, 1, 8, 14), fill=p["shadow"])
            draw.line((11, 3, 13, 5), fill=p["deep"])
            put(draw, ((12, 4),), p["hazard"])
            put(draw, ((11, 4),), p["accent"])
    else:  # bell-engine iron plates
        rivets = ((2, 2), (13, 2), (2, 12), (13, 12))
        if variant == "b":
            draw.line((8, 1, 8, 14), fill=p["shadow"])
            rivets = rivets + ((6, 2), (10, 2), (6, 12), (10, 12))
        for x, y in rivets:
            put(draw, ((x, y),), p["light"])
            put(draw, ((x, y + 1),), p["shadow"])
        if variant == "detail":
            draw.line((5, 9, 7, 7), fill=p["shadow"])
            put(draw, ((8, 7),), p["shadow"])
            put(draw, ((9, 10), (10, 10)), p["deep"])


def paint_border_bands(draw: ImageDraw.ImageDraw, palette: dict, sides: str, bands: dict) -> None:
    """Paint walkable-side outline/contact-shadow bands toward impassable sides (n, s, w, e)."""
    p = palette
    if "n" in sides:
        draw.line((0, 0, 15, 0), fill=p["outline"])
        draw.rectangle((0, 1, 15, bands["north"] - 1), fill=p["shadow"])
    if "s" in sides:
        draw.rectangle((0, 16 - bands["south"], 15, 15), fill=p["outline"])
    if "w" in sides:
        draw.line((0, 0, 0, 15), fill=p["outline"])
        draw.rectangle((1, 0, bands["west"] - 1, 15), fill=p["shadow"])
    if "e" in sides:
        draw.rectangle((16 - bands["east"], 0, 15, 15), fill=p["outline"])


def paint_outer_corners(draw: ImageDraw.ImageDraw, palette: dict, bands: dict) -> None:
    """All four concave joins; the resolver blits only the join a cell needs."""
    p = palette
    paint_border_bands(draw, palette, "nswe", bands)
    put(draw, ((1, 1),), p["deep"])
    put(draw, ((0, 0), (15, 0), (0, 15), (15, 15)), p["outline"])


def paint_inner_corners(draw: ImageDraw.ImageDraw, palette: dict) -> None:
    """Convex notches where only a diagonal neighbour is impassable (2x2 per corner)."""
    p = palette
    put(draw, ((0, 0),), p["outline"])
    put(draw, ((1, 0), (0, 1)), p["shadow"])
    put(draw, ((15, 0),), p["outline"])
    put(draw, ((15, 1),), p["shadow"])
    put(draw, ((0, 15),), p["outline"])
    put(draw, ((1, 15),), p["shadow"])
    put(draw, ((15, 15),), p["outline"])


def paint_village_roof(draw: ImageDraw.ImageDraw, palette: dict) -> None:
    """Kawara-style tile channels running down the slope, with course steps."""
    p = palette
    for y in range(16):
        for x in range(16):
            column = x % 4
            fill = (p["deep"], p["light"], p["shadow"], p["shadow"])[column]
            if y % 4 == 3 and column in (2, 3):
                fill = p["deep"]
            if y % 4 == 0 and column == 1:
                fill = p["mid"]
            draw.point((x, y), fill=fill)


def paint_eave(draw: ImageDraw.ImageDraw, palette: dict) -> None:
    """Front row of round tile ends over an eave shadow (rows 0-4)."""
    p = palette
    for x in range(16):
        column = x % 4
        draw.point((x, 0), fill=(p["deep"], p["light"], p["light"], p["deep"])[column])
        draw.point((x, 1), fill=(p["deep"], p["light"], p["shadow"], p["deep"])[column])
        draw.point((x, 2), fill=(p["deep"], p["shadow"], p["shadow"], p["deep"])[column])
    draw.line((0, 3, 15, 3), fill=p["outline"])
    draw.line((0, 4, 15, 4), fill=p["deep"])


def paint_village_face(draw: ImageDraw.ImageDraw, palette: dict, motif: str) -> None:
    p = palette
    paint_eave(draw, p)
    upper = p["light"] if motif in ("cedar", "river") else p["mid"]
    draw.rectangle((0, 5, 15, 9), fill=upper)
    draw.rectangle((0, 10, 15, 12), fill=p["material"])
    draw.line((0, 10, 15, 10), fill=p["shadow"])
    draw.line((1, 5, 1, 12), fill=p["material"])
    draw.line((14, 5, 14, 12), fill=p["material"])
    draw.line((0, 5, 0, 12), fill=p["shadow"])
    draw.line((15, 5, 15, 12), fill=p["shadow"])
    draw.rectangle((5, 5, 10, 8), fill=p["outline"])
    draw.rectangle((6, 6, 9, 8), fill=p["accent"])
    draw.line((7, 6, 7, 8), fill=p["material"])
    draw.line((6, 7, 9, 7), fill=p["material"])
    draw.rectangle((0, 13, 15, 14), fill=p["shadow"])
    put(draw, ((2, 13), (3, 13), (8, 14), (9, 14), (12, 13)), p["mid"])
    draw.line((0, 15, 15, 15), fill=p["deep"])


def paint_interior_face(draw: ImageDraw.ImageDraw, palette: dict, motif: str, seed: int) -> None:
    p = palette
    if motif == "archive":  # timber frame, plaster panel, board wainscot
        draw.line((0, 0, 15, 0), fill=p["deep"])
        draw.line((0, 1, 15, 1), fill=p["shadow"])
        draw.line((0, 2, 15, 2), fill=p["outline"])
        draw.rectangle((0, 3, 15, 12), fill=p["light"])
        draw.line((0, 3, 15, 3), fill=p["material"])
        draw.line((0, 8, 15, 8), fill=p["material"])
        draw.rectangle((0, 9, 15, 12), fill=p["mid"])
        for x in (3, 6, 9, 12):
            draw.line((x, 9, x, 12), fill=p["shadow"])
        draw.line((0, 3, 0, 12), fill=p["material"])
        draw.line((15, 3, 15, 12), fill=p["material"])
        draw.rectangle((5, 4, 10, 7), fill=p["accent"])
        draw.line((7, 4, 7, 7), fill=p["light"])
        draw.line((5, 5, 10, 5), fill=p["light"])
        draw.rectangle((0, 13, 15, 14), fill=p["shadow"])
        draw.line((0, 15, 15, 15), fill=p["deep"])
    elif motif == "lacquer":  # vertical black-lacquer boards between vermilion rails
        draw.rectangle((0, 0, 15, 15), fill=p["deep"])
        for x in range(16):
            draw.point((x, 0), fill=p["shadow"] if x % 4 in (1, 2) else p["outline"])
        draw.line((0, 1, 15, 1), fill=p["outline"])
        draw.line((0, 2, 15, 2), fill=p["deep"])
        draw.line((0, 3, 15, 3), fill=p["accent"])
        for x in (3, 7, 11, 15):
            draw.line((x, 4, x, 11), fill=p["outline"])
        draw.line((1, 5, 1, 9), fill=p["light"])
        draw.line((9, 6, 9, 8), fill=p["shadow"])
        draw.line((0, 12, 15, 12), fill=p["accent"])
        draw.line((0, 13, 15, 13), fill=p["material"])
        draw.line((0, 14, 15, 14), fill=p["outline"])
        draw.line((0, 15, 15, 15), fill=p["deep"])
    elif motif == "forge":  # rough stone blocks with soot
        draw.rectangle((0, 0, 15, 15), fill=p["shadow"])
        draw.line((0, 0, 15, 0), fill=p["deep"])
        draw.line((0, 1, 15, 1), fill=p["outline"])
        courses = ((2, 6, (0, 7)), (7, 11, (3, 11)), (12, 15, (0, 8)))
        for top, bottom, joints in courses:
            draw.rectangle((0, top, 15, bottom), fill=p["mid"])
            draw.line((0, bottom, 15, bottom), fill=p["outline"])
            for joint in joints:
                draw.line((joint, top, joint, bottom), fill=p["outline"])
            for joint in joints:
                put(draw, ((joint + 1, top), (joint + 2, top)), p["light"])
        draw.rectangle((9, 2, 13, 3), fill=p["deep"])
        put(draw, ((5, 8), (6, 8), (12, 13)), p["deep"])
        put(draw, ((6, 9),), p["accent"])
        draw.line((0, 15, 15, 15), fill=p["deep"])
    else:  # bell-engine riveted iron with a brass band
        draw.rectangle((0, 0, 15, 15), fill=p["shadow"])
        draw.line((0, 0, 15, 0), fill=p["deep"])
        draw.line((0, 1, 15, 1), fill=p["outline"])
        draw.line((7, 2, 7, 13), fill=p["outline"])
        draw.line((8, 2, 8, 13), fill=p["deep"])
        draw.line((0, 6, 15, 6), fill=p["accent"])
        draw.line((0, 7, 15, 7), fill=p["material"])
        for x, y in ((2, 3), (5, 3), (10, 3), (13, 3), (2, 10), (5, 10), (10, 10), (13, 10)):
            put(draw, ((x, y),), p["light"])
            put(draw, ((x, y + 1),), p["outline"])
        draw.line((0, 13, 15, 13), fill=p["light"])
        draw.line((0, 14, 15, 14), fill=p["material"])
        draw.line((0, 15, 15, 15), fill=p["deep"])


def paint_interior_cap(draw: ImageDraw.ImageDraw, palette: dict, motif: str, seed: int) -> None:
    p = palette
    if motif in ("archive", "lacquer"):  # dark coping tiles laid in staggered courses
        draw.rectangle((0, 0, 15, 15), fill=p["deep"])
        for top in (0, 4, 8, 12):
            draw.line((0, top + 3, 15, top + 3), fill=p["outline"])
            offset = 0 if top % 8 == 0 else 4
            for x in range(offset, 16, 8):
                draw.line((x, top, x, top + 2), fill=p["outline"])
                draw.line((x + 1, top, x + 3, top), fill=p["shadow"])
        if motif == "lacquer":
            put(draw, ((2, 4), (10, 12)), p["light"])
    elif motif == "forge":  # slag and rock top
        draw.rectangle((0, 0, 15, 15), fill=p["deep"])
        for box in ((1, 1, 6, 5), (9, 2, 14, 6), (3, 9, 8, 13), (11, 10, 14, 14)):
            draw.rectangle(box, fill=p["shadow"])
            draw.line((box[0], box[1], box[2], box[1]), fill=p["mid"])
        put(draw, ((10, 8), (2, 7), (13, 8)), p["outline"])
        put(draw, ((5, 7),), p["accent"])
    else:  # bell-engine iron grating
        draw.rectangle((0, 0, 15, 15), fill=p["deep"])
        for v in (1, 5, 9, 13):
            draw.line((v, 0, v, 15), fill=p["shadow"])
            draw.line((0, v, 15, v), fill=p["shadow"])
        for v in (1, 5, 9, 13):
            for w in (1, 5, 9, 13):
                draw.point((v, w), fill=p["light"] if (v + w) % 8 == 2 else p["mid"])


def paint_liquid(draw: ImageDraw.ImageDraw, palette: dict, liquid: dict) -> None:
    p = palette
    kind = liquid["kind"]
    if kind == "water":
        base = p[liquid["base"]]
        draw.rectangle((0, 0, 15, 15), fill=base)
        for x, y in ((2, 3), (9, 6), (4, 10), (11, 12)):
            draw.line((x, y, x + 2, y), fill=p[liquid["ripple"]])
            draw.line((x + 1, y + 1, x + 3, y + 1), fill=p[liquid["trough"]])
        put(draw, ((13, 3), (7, 13)), p[liquid["ripple"]])
    elif kind == "ember":
        draw.rectangle((0, 0, 15, 15), fill=p["accent"])
        for box in ((1, 1, 5, 4), (8, 2, 13, 5), (3, 8, 7, 12), (10, 9, 14, 13)):
            draw.rectangle(box, fill=p["material"])
            draw.line((box[0] + 1, box[1], box[2] - 1, box[1]), fill=p["shadow"])
        for x, y in ((6, 6), (7, 6), (14, 7), (8, 13), (2, 6), (12, 1)):
            draw.point((x, y), fill=p["hazard"])
    else:
        draw.rectangle((0, 0, 15, 15), fill=p["hazard"])
        for points in (((1, 4), (4, 3), (7, 5), (10, 4)), ((5, 11), (9, 10), (13, 12), (15, 11))):
            draw.line(points, fill=p["deep"])
        put(draw, ((3, 8), (12, 7)), p["material"])


def paint_threshold(draw: ImageDraw.ImageDraw, palette: dict, motif: str, seed: int) -> None:
    """A gate sill set into the floor: worn approach, beam, and two post bases."""
    p = palette
    paint_floor(draw, palette, motif, "a", seed)
    draw.rectangle((5, 1, 10, 9), fill=p["light"])
    put(draw, ((5, 1), (10, 1), (5, 9), (10, 9)), p["mid"])
    put(draw, ((7, 3), (8, 6), (6, 7)), p["mid"])
    draw.rectangle((1, 10, 14, 12), fill=p["material"])
    draw.line((1, 10, 14, 10), fill=p["accent"])
    draw.line((1, 13, 14, 13), fill=p["outline"])
    for left in (1, 12):
        draw.rectangle((left, 8, left + 2, 12), fill=p["outline"])
        draw.line((left, 8, left + 2, 8), fill=p["accent"])


def paint_prop_base(draw: ImageDraw.ImageDraw, palette: dict, motif: str, seed: int) -> None:
    """Floor with a low stone footing a prop layer can stand on."""
    p = palette
    paint_floor(draw, palette, motif, "a", seed)
    draw.rectangle((2, 7, 13, 13), fill=p["shadow"])
    draw.line((3, 7, 12, 7), fill=p["light"])
    put(draw, ((2, 7), (13, 7)), p["shadow"])
    draw.line((3, 14, 12, 14), fill=p["outline"])
    put(draw, ((2, 13), (13, 13)), p["deep"])
    put(draw, ((5, 10), (10, 11)), p["deep"])


def draw_top_tile(theme: dict, role_index: int, bands: dict) -> Image.Image:
    palette = {key: color(value) for key, value in theme["palette"].items()}
    motif = theme["motif"]
    image = Image.new("RGBA", (16, 16), palette["mid"])
    draw = ImageDraw.Draw(image)
    seed = sum(ord(char) for char in theme["id"]) * 31 + role_index * 101

    if role_index in (0, 1, 2):
        paint_floor(draw, palette, motif, ("a", "b", "detail")[role_index], seed)
    elif role_index == 4:
        if motif in VILLAGE_WALLS:
            paint_village_face(draw, palette, motif)
        else:
            paint_interior_face(draw, palette, motif, seed)
    elif role_index == 5:
        if motif in VILLAGE_WALLS:
            paint_village_roof(draw, palette)
        else:
            paint_interior_cap(draw, palette, motif, seed)
    elif role_index in (6, 7, 8, 9):
        paint_floor(draw, palette, motif, "a", seed)
        paint_border_bands(draw, palette, "nswe"[role_index - 6], bands)
    elif role_index == 10:
        paint_floor(draw, palette, motif, "a", seed)
        paint_outer_corners(draw, palette, bands)
    elif role_index == 11:
        paint_floor(draw, palette, motif, "a", seed)
        paint_inner_corners(draw, palette)
    elif role_index == 12:
        paint_liquid(draw, palette, theme["topDownLiquid"])
    elif role_index == 13:
        paint_prop_base(draw, palette, motif, seed)
    elif role_index == 14:
        paint_threshold(draw, palette, motif, seed)
    else:
        draw_legacy_top_tile(draw, image, palette, motif, role_index, seed)
    return image


def draw_legacy_top_tile(draw: ImageDraw.ImageDraw, image: Image.Image, palette: dict, motif: str, role_index: int, seed: int) -> None:
    """V1 primitives retained for the roles the field kit does not yet place (path, occluder)."""
    if role_index == 3:
        image.paste(palette["deep"], (0, 0, 16, 16))
        draw.rectangle((3, 0, 12, 15), fill=palette["material"])
        draw.line((4, 0, 4, 15), fill=palette["light"])
        draw.line((11, 0, 11, 15), fill=palette["shadow"])
        for y in (3, 9, 14):
            draw.point((7 + (y % 2), y), fill=palette["accent"])
    else:
        image.paste(palette["mid"], (0, 0, 16, 16))
        draw.rectangle((5, 0, 10, 15), fill=palette["material"], outline=palette["outline"])
        draw.line((6, 1, 6, 14), fill=palette["light"])
        draw.rectangle((3, 11, 12, 15), fill=palette["deep"])


def draw_side_tile(theme: dict, role_index: int) -> Image.Image:
    palette = {key: color(value) for key, value in theme["palette"].items()}
    motif = theme["motif"]
    image = Image.new("RGBA", (32, 32), palette["deep"])
    draw = ImageDraw.Draw(image)
    seed = sum(ord(char) for char in theme["id"]) * 47 + role_index * 131

    if role_index == 0:
        for y in range(32):
            draw.line((0, y, 31, y), fill=palette["deep"] if y < 16 else palette["shadow"])
        texture(draw, (0, 0, 32, 32), palette, seed, 17)
    elif role_index in (1, 2, 3):
        draw.rectangle((0, 17, 31, 31), fill=palette["shadow"])
        draw.line((0, 16, 31, 16), fill=palette["accent"], width=2)
        texture(draw, (0, 18, 32, 32), palette, seed, 9)
        if role_index == 1:
            draw.polygon(((0, 16), (7, 16), (2, 31), (0, 31)), fill=palette["outline"])
        elif role_index == 3:
            draw.polygon(((25, 16), (31, 16), (31, 31), (29, 31)), fill=palette["outline"])
    elif role_index in (4, 5, 6):
        draw.rectangle((0, 11, 31, 17), fill=palette["material"])
        draw.line((0, 10, 31, 10), fill=palette["accent"], width=2)
        draw.line((0, 18, 31, 18), fill=palette["outline"])
        if role_index == 4:
            draw.polygon(((0, 10), (7, 10), (2, 18), (0, 18)), fill=palette["outline"])
        elif role_index == 6:
            draw.polygon(((25, 10), (31, 10), (31, 18), (29, 18)), fill=palette["outline"])
    elif role_index == 7:
        image.paste(palette["shadow"], (0, 0, 32, 32))
        for y in range(1, 32, 7):
            offset = 0 if (y // 7) % 2 == 0 else 7
            for x in range(-offset, 32, 14):
                draw.rectangle((x, y, x + 11, y + 5), outline=palette["outline"])
        draw.line((2, 0, 2, 31), fill=palette["light"])
    elif role_index == 8:
        draw.rectangle((0, 0, 31, 11), fill=palette["shadow"])
        draw.line((0, 11, 31, 11), fill=palette["accent"], width=2)
        texture(draw, (0, 0, 32, 12), palette, seed, 8)
    elif role_index == 9:
        draw.polygon(((0, 31), (31, 8), (31, 31)), fill=palette["shadow"])
        draw.line((0, 30, 31, 7), fill=palette["accent"], width=2)
        for step in range(5, 30, 6):
            draw.line((step, 31 - step * 3 // 4, step + 5, 31 - step * 3 // 4), fill=palette["light"])
    elif role_index == 10:
        for step in range(0, 32, 6):
            draw.rectangle((step, 25 - step // 2, min(31, step + 7), 31), fill=palette["shadow"], outline=palette["accent"])
    elif role_index == 11:
        draw.rectangle((10, 0, 21, 31), fill=palette["material"], outline=palette["outline"])
        draw.line((12, 1, 12, 30), fill=palette["light"])
        draw.rectangle((6, 0, 25, 4), fill=palette["shadow"], outline=palette["accent"])
        draw.rectangle((6, 27, 25, 31), fill=palette["shadow"], outline=palette["accent"])
    elif role_index == 12:
        draw.rectangle((0, 23, 31, 31), fill=palette["hazard"])
        for x in range(0, 32, 6):
            draw.polygon(((x, 23), (x + 3, 14), (x + 6, 23)), fill=palette["accent"], outline=palette["outline"])
        draw.line((0, 25, 31, 25), fill=palette["light"])
    elif role_index == 13:
        motif_mark(draw, palette, motif, 32)
        draw.rectangle((7, 25, 24, 31), fill=palette["shadow"])
    elif role_index == 14:
        draw.rectangle((5, 2, 26, 31), fill=palette["material"], outline=palette["accent"], width=2)
        draw.rectangle((9, 7, 22, 31), fill=palette["outline"])
        draw.point((20, 18), fill=palette["light"])
    else:
        draw.rectangle((4, 0, 11, 31), fill=palette["material"], outline=palette["outline"])
        draw.rectangle((20, 0, 27, 31), fill=palette["material"], outline=palette["outline"])
        draw.line((5, 1, 5, 30), fill=palette["light"])
        draw.line((21, 1, 21, 30), fill=palette["light"])
    return image


def font(size: int) -> ImageFont.ImageFont:
    for name in ("DejaVuSansMono.ttf", "DejaVuSans.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def contact_sheet(atlas: Image.Image, themes: list[dict], tile_size: int, scale: int, title: str) -> Image.Image:
    row_height = tile_size * scale + 34
    width = atlas.width * scale + 24
    sheet = Image.new("RGB", (width, row_height * len(themes) + 34), (7, 11, 22))
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 8), title, font=font(16), fill=(240, 220, 160))
    for row, theme in enumerate(themes):
        y = 34 + row * row_height
        draw.text((12, y + 4), theme["name"], font=font(13), fill=(121, 196, 202))
        crop = atlas.crop((0, row * tile_size, atlas.width, (row + 1) * tile_size))
        enlarged = crop.resize((atlas.width * scale, tile_size * scale), Image.Resampling.NEAREST)
        sheet.paste(enlarged, (12, y + 28))
    return sheet


def tile_receipt(tile: Image.Image, theme: dict, role: str, index: int) -> dict:
    colors = {(r, g, b) for r, g, b, _ in tile.getdata()}
    return {
        "themeId": theme["id"],
        "role": role,
        "index": index,
        "sha256Rgba": hashlib.sha256(tile.tobytes()).hexdigest(),
        "actualColors": len(colors),
        "opaqueAlpha": set(tile.getchannel("A").getdata()) == {255},
    }


def runtime_contract(spec: dict) -> dict:
    themes = spec["themes"]
    views = {}
    for view_id, atlas_name in (("topDown", TOP_ATLAS), ("sideView", SIDE_ATLAS)):
        contract = spec[view_id]
        roles = []
        for column, role in enumerate(contract["roleOrder"]):
            roles.append({
                "id": role,
                "column": column,
                "rect": [
                    column * contract["tileWidth"],
                    0,
                    contract["tileWidth"],
                    contract["tileHeight"],
                ],
                **contract["roleSemantics"][role],
            })
        views[view_id] = {
            "atlas": atlas_name,
            "tileWidth": contract["tileWidth"],
            "tileHeight": contract["tileHeight"],
            "columns": contract["columns"],
            "rows": contract["rows"],
            "atlasWidth": contract["atlasWidth"],
            "atlasHeight": contract["atlasHeight"],
            "alphaPolicy": contract["alphaPolicy"],
            "roles": roles,
        }
        if "autotileBands" in contract:
            views[view_id]["autotileBands"] = contract["autotileBands"]
    return {
        "schemaVersion": 1,
        "assetId": spec["assetId"],
        "themeOrder": [theme["id"] for theme in themes],
        "themes": [
            {
                "id": theme["id"],
                "name": theme["name"],
                "row": row,
                "motif": theme["motif"],
                "topDownLiquid": theme["topDownLiquid"],
                "palette": theme["palette"],
            }
            for row, theme in enumerate(themes)
        ],
        "views": views,
        "runtimePolicy": spec["runtimePolicy"],
    }


def build(output_root: Path) -> list[Path]:
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    themes = spec["themes"]
    top_contract = spec["topDown"]
    side_contract = spec["sideView"]
    top_atlas = Image.new("RGBA", (top_contract["atlasWidth"], top_contract["atlasHeight"]), (0, 0, 0, 255))
    side_atlas = Image.new("RGBA", (side_contract["atlasWidth"], side_contract["atlasHeight"]), (0, 0, 0, 255))
    top_receipts = []
    side_receipts = []
    for row, theme in enumerate(themes):
        for column, role in enumerate(top_contract["roleOrder"]):
            tile = draw_top_tile(theme, column, top_contract["autotileBands"])
            top_atlas.paste(tile, (column * 16, row * 16))
            top_receipts.append(tile_receipt(tile, theme, role, column))
        for column, role in enumerate(side_contract["roleOrder"]):
            tile = draw_side_tile(theme, column)
            side_atlas.paste(tile, (column * 32, row * 32))
            side_receipts.append(tile_receipt(tile, theme, role, column))

    top_path = output_root / TOP_ATLAS
    side_path = output_root / SIDE_ATLAS
    top_contact_path = output_root / TOP_CONTACT
    side_contact_path = output_root / SIDE_CONTACT
    runtime_contract_path = output_root / RUNTIME_CONTRACT
    top_atlas.save(top_path, optimize=False)
    side_atlas.save(side_path, optimize=False)
    contact_sheet(top_atlas, themes, 16, 4, "TOP-DOWN REGIONAL TILE FAMILIES · 16x16 NATIVE").save(top_contact_path, optimize=False)
    contact_sheet(side_atlas, themes, 32, 2, "SIDE-VIEW REGIONAL TILE FAMILIES · 32x32 NATIVE").save(side_contact_path, optimize=False)
    runtime_contract_path.write_text(json.dumps(runtime_contract(spec), indent=2) + "\n", encoding="utf-8", newline="\n")

    manifest = {
        "schemaVersion": 1,
        "assetId": spec["assetId"],
        "status": spec["status"],
        "provenance": spec["provenance"],
        "topDown": {
            "contract": top_contract,
            "atlas": TOP_ATLAS,
            "atlasSha256": sha256_path(top_path),
            "contactSheet": TOP_CONTACT,
            "contactSheetSha256": sha256_path(top_contact_path),
            "tiles": top_receipts,
        },
        "sideView": {
            "contract": side_contract,
            "atlas": SIDE_ATLAS,
            "atlasSha256": sha256_path(side_path),
            "contactSheet": SIDE_CONTACT,
            "contactSheetSha256": sha256_path(side_contact_path),
            "tiles": side_receipts,
        },
        "themes": themes,
        "runtimeContract": {
            "path": RUNTIME_CONTRACT,
            "sha256": sha256_path(runtime_contract_path),
            "collisionAuthority": spec["runtimePolicy"]["collisionAuthority"],
            "hazardAuthority": spec["runtimePolicy"]["hazardAuthority"],
            "transitionAuthority": spec["runtimePolicy"]["transitionAuthority"],
            "occlusionAuthority": spec["runtimePolicy"]["occlusionAuthority"],
        },
        "builder": {
            "path": BUILDER_PATH.name,
            "sha256": sha256_path(BUILDER_PATH),
            "deterministic": True,
            "integerAligned": True,
            "resampling": "none at native scale; NEAREST for review sheets",
        },
    }
    manifest_path = output_root / MANIFEST_NAME
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    return [
        Path(TOP_ATLAS),
        Path(SIDE_ATLAS),
        Path(TOP_CONTACT),
        Path(SIDE_CONTACT),
        Path(RUNTIME_CONTRACT),
        Path(MANIFEST_NAME),
    ]


def check() -> None:
    with tempfile.TemporaryDirectory(prefix="world-tileset-check-") as temp:
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
    print("Deterministic check passed: all tileset outputs are byte-identical.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build top-down and side-view regional tiles.")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
    else:
        build(ROOT)
        print("Built 128 top-down tiles and 128 side-view tiles across eight themes.")


if __name__ == "__main__":
    main()
