#!/usr/bin/env python3
"""Deterministically build the canonical boss key-pose production suite."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "boss-combat-suite.source.json"
ATLAS_PATH = ROOT / "boss-combat-atlas.png"
CONTACT_PATH = ROOT / "boss-combat-contact-sheet.png"
MANIFEST_PATH = ROOT / "manifest.json"
POSES = ("neutral", "telegraph", "active", "break", "transition", "defeat", "recovery")
BOSSES = (
    "tithe-hound", "mateus", "captain-kaji", "widow-of-fog", "furnace-abbot",
    "ujiro", "bell-warden-chiyo", "lady-enma", "yearless-bell", "kurozane",
)
FORMATS = ("boss", "boss-rescue", "boss-phase", "final-boss")


def rgba(value: str) -> tuple[int, int, int, int]:
    value = value.removeprefix("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_source() -> dict:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    if tuple(source["bossInclusionRule"]["encounterFormats"]) != FORMATS:
        raise ValueError("Canonical boss encounter-format rule changed")
    geometry = source["geometry"]
    expected = {
        "columns": len(POSES), "rows": len(BOSSES), "cellWidth": 112, "cellHeight": 128,
        "minimumTransparentGutter": 6, "coordinateOrigin": "top-left",
    }
    if geometry != expected:
        raise ValueError(f"Boss geometry must remain {expected!r}")
    if tuple(item["id"] for item in source["poses"]) != POSES:
        raise ValueError("Boss pose order changed")
    if tuple(item["id"] for item in source["bosses"]) != BOSSES:
        raise ValueError("Canonical boss row order changed")
    if [item["row"] for item in source["bosses"]] != list(range(10)):
        raise ValueError("Boss rows must be exact and consecutive")
    encounters = set()
    for boss in source["bosses"]:
        if boss["encounterFormat"] not in FORMATS or boss["encounterId"] in encounters:
            raise ValueError(f"Invalid encounter mapping for {boss['id']}")
        encounters.add(boss["encounterId"])
        if boss["paletteId"] not in source["palettes"]:
            raise ValueError(f"Unknown palette for {boss['id']}")
        if boss["anchorProfile"] not in source["anchorProfiles"]:
            raise ValueError(f"Unknown anchor profile for {boss['id']}")
    if source["safety"] != {
        "gore": False, "realEmblems": False, "devotionalProps": False,
        "actorLikeness": False,
        "construction": "Invented mechanical, docket, cable, lattice, ash, and fog geometry only.",
    }:
        raise ValueError("Safety contract changed")
    return source


class Surface:
    def __init__(self, palette: dict[str, str]):
        self.image = Image.new("RGBA", (112, 128), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)
        self.colors = {key: rgba(value) for key, value in palette.items()}

    def c(self, key: str):
        return self.colors[key]

    def rect(self, box, color: str):
        self.draw.rectangle(box, fill=self.c(color))

    def poly(self, points, color: str):
        self.draw.polygon(points, fill=self.c(color))

    def line(self, points, color: str, width: int = 1):
        self.draw.line(points, fill=self.c(color), width=width, joint="curve")

    def ellipse(self, box, color: str):
        self.draw.ellipse(box, fill=self.c(color))

    def shadow(self, left: int, right: int, y: int = 116):
        self.rect((left + 5, y, right - 5, y + 3), "ink")
        self.rect((left, y + 1, right, y + 2), "ink")


POSE_OFFSET = {
    "neutral": (0, 0), "telegraph": (-3, 0), "active": (8, 1),
    "break": (-8, 7), "transition": (0, -5), "defeat": (-7, 21),
    "recovery": (-2, 4),
}


def humanoid_base(s: Surface, pose: str, broad: int = 0) -> dict:
    dx, dy = POSE_OFFSET[pose]
    cx = 56 + dx
    if pose == "defeat":
        s.shadow(25, 82, 118)
        s.poly([(cx - 15, 72), (cx + 8, 70), (cx + 19, 84), (cx + 12, 104),
                (cx + 27, 112), (cx + 24, 118), (cx + 2, 112), (cx - 10, 101),
                (cx - 25, 113), (cx - 33, 108), (cx - 18, 91)], "body")
        s.poly([(cx - 12, 76), (cx + 8, 75), (cx + 13, 87), (cx - 5, 91)], "light")
        s.poly([(cx - 13, 57), (cx + 1, 56), (cx + 9, 65), (cx + 4, 78),
                (cx - 11, 77), (cx - 18, 67)], "deep")
        s.rect((cx - 10, 64, cx + 3, 68), "ink")
        s.rect((cx - 7, 65, cx - 2, 66), "spark")
        return {"cx": cx, "cy": 85, "right": (cx + 18, 91), "left": (cx - 20, 91), "head": (cx - 5, 65)}

    s.shadow(24 + dx, 88 + dx)
    shoulder_y = 47 + dy
    hip_y = 81 + dy
    s.poly([(cx - 17 - broad, shoulder_y), (cx - 8, 39 + dy), (cx + 11, 40 + dy),
            (cx + 19 + broad, shoulder_y + 3), (cx + 17, hip_y), (cx + 8, hip_y + 9),
            (cx - 12, hip_y + 8), (cx - 20, hip_y)], "body")
    s.poly([(cx - 11, shoulder_y + 2), (cx + 8, shoulder_y), (cx + 12, hip_y - 7),
            (cx, hip_y + 2), (cx - 13, hip_y - 8)], "light")
    s.poly([(cx - 13, 42 + dy), (cx - 10, 24 + dy), (cx + 5, 20 + dy),
            (cx + 14, 30 + dy), (cx + 9, 44 + dy), (cx - 5, 47 + dy)], "deep")
    s.poly([(cx - 8, 27 + dy), (cx + 5, 25 + dy), (cx + 9, 33 + dy),
            (cx + 4, 40 + dy), (cx - 7, 38 + dy), (cx - 11, 32 + dy)], "body")
    s.rect((cx - 7, 32 + dy, cx + 7, 35 + dy), "ink")
    s.rect((cx + 2, 32 + dy, cx + 6, 33 + dy), "spark")

    arms = {
        "neutral": ((cx - 19 - broad, 50 + dy), (cx - 27 - broad, 78 + dy),
                    (cx + 18 + broad, 51 + dy), (cx + 26 + broad, 77 + dy)),
        "telegraph": ((cx - 18 - broad, 50 + dy), (cx - 32 - broad, 37 + dy),
                      (cx + 18 + broad, 51 + dy), (cx + 28 + broad, 69 + dy)),
        "active": ((cx - 18 - broad, 51 + dy), (cx - 25 - broad, 76 + dy),
                   (cx + 17 + broad, 50 + dy), (cx + 35, 54 + dy)),
        "break": ((cx - 18 - broad, 49 + dy), (cx - 32 - broad, 67 + dy),
                  (cx + 18 + broad, 51 + dy), (cx + 29 + broad, 73 + dy)),
        "transition": ((cx - 18 - broad, 50 + dy), (cx - 33 - broad, 37 + dy),
                       (cx + 18 + broad, 50 + dy), (cx + 34 + broad, 35 + dy)),
        "recovery": ((cx - 18 - broad, 50 + dy), (cx - 25 - broad, 82 + dy),
                     (cx + 18 + broad, 51 + dy), (cx + 24 + broad, 88 + dy)),
    }[pose]
    ls, lh, rs, rh = arms
    s.line([ls, lh], "ink", 9)
    s.line([ls, lh], "body", 6)
    s.line([ls, lh], "light", 2)
    s.line([rs, rh], "ink", 9)
    s.line([rs, rh], "body", 6)
    s.line([rs, rh], "light", 2)
    s.rect((lh[0] - 3, lh[1] - 3, lh[0] + 3, lh[1] + 3), "metal")
    s.rect((rh[0] - 3, rh[1] - 3, rh[0] + 3, rh[1] + 3), "metal")
    # Separate weighted coat tails and boots.
    s.poly([(cx - 14, hip_y - 2), (cx - 1, hip_y), (cx - 7, 110), (cx - 24, 111), (cx - 18, 91)], "deep")
    s.poly([(cx + 1, hip_y), (cx + 15, hip_y - 3), (cx + 22, 108), (cx + 6, 111), (cx + 3, 92)], "body")
    s.rect((cx - 24, 108, cx - 6, 115), "ink")
    s.rect((cx + 6, 108, cx + 24, 115), "ink")
    s.line([(cx, 50 + dy), (cx, 86 + dy)], "ink", 2)
    s.rect((cx - 3, 65 + dy, cx + 3, 69 + dy), "metal")
    return {"cx": cx, "cy": 63 + dy, "right": rh, "left": lh, "head": (cx, 31 + dy)}


def phase_brackets(s: Surface, pose: str, cx: int, top: int = 12):
    if pose != "transition":
        return
    s.line([(cx - 28, top + 12), (cx - 34, top + 12), (cx - 34, top + 28)], "accent", 3)
    s.line([(cx + 28, top + 12), (cx + 34, top + 12), (cx + 34, top + 28)], "spark", 3)
    s.rect((cx - 3, top, cx + 3, top + 5), "metal")


def draw_tithe_hound(s: Surface, pose: str):
    dx, dy = {"neutral": (0, 0), "telegraph": (-4, 4), "active": (8, -1),
              "break": (-10, 8), "transition": (1, -7), "defeat": (-7, 19),
              "recovery": (-2, 5)}[pose]
    cx = 53 + dx
    if pose == "defeat":
        s.shadow(16, 91, 118)
        s.poly([(17, 92), (30, 81), (62, 82), (82, 94), (88, 109), (74, 116), (36, 113), (20, 105)], "body")
        s.poly([(29, 85), (60, 85), (72, 92), (38, 95)], "light")
        s.poly([(69, 85), (85, 80), (94, 88), (92, 103), (79, 106), (70, 98)], "deep")
        s.rect((80, 93, 93, 99), "ink")
        s.rect((72, 97, 78, 105), "accent")
        return
    s.shadow(max(6, 13 + dx), min(105, 96 + dx))
    s.poly([(19 + dx, 70 + dy), (34 + dx, 55 + dy), (67 + dx, 56 + dy), (82 + dx, 69 + dy),
            (78 + dx, 91 + dy), (64 + dx, 101 + dy), (32 + dx, 98 + dy), (16 + dx, 86 + dy)], "body")
    s.poly([(30 + dx, 60 + dy), (60 + dx, 60 + dy), (72 + dx, 67 + dy), (38 + dx, 72 + dy)], "light")
    # Rib ledger plates.
    for px in (34, 45, 56, 67):
        s.poly([(px + dx, 67 + dy), (px + 7 + dx, 66 + dy), (px + 8 + dx, 80 + dy), (px + 2 + dx, 83 + dy)], "deep")
        s.rect((px + 2 + dx, 68 + dy, px + 5 + dx, 70 + dy), "metal")
    head_x = 72 + dx if pose != "break" else 40 + dx
    direction = 1 if pose != "break" else -1
    s.poly([(head_x - 7, 53 + dy), (head_x + 7, 45 + dy), (head_x + 20 * direction, 52 + dy),
            (head_x + 24 * direction, 67 + dy), (head_x + 10 * direction, 77 + dy), (head_x - 5, 69 + dy)], "deep")
    muzzle_x = head_x + 18 * direction
    s.rect((min(head_x, muzzle_x), 60 + dy, max(head_x, muzzle_x) + 7, 68 + dy), "body")
    s.rect((muzzle_x - 2, 62 + dy, muzzle_x + 5, 65 + dy), "ink")
    eye_a, eye_b = head_x + 8 * direction, head_x + 11 * direction
    s.rect((min(eye_a, eye_b), 54 + dy, max(eye_a, eye_b), 56 + dy), "spark")
    # Gauge collar and open phase latch.
    s.rect((65 + dx, 70 + dy, 73 + dx, 86 + dy), "accent")
    s.rect((67 + dx, 73 + dy, 71 + dx, 79 + dy), "spark")
    s.rect((68 + dx, 74 + dy, 70 + dx, 78 + dy), "ink")
    if pose == "transition":
        s.line([(69 + dx, 70 + dy), (60 + dx, 42 + dy)], "accent", 4)
        s.line([(72 + dx, 71 + dy), (83 + dx, 43 + dy)], "spark", 4)
        phase_brackets(s, pose, cx, 14)
    # Split chain tail and four jointed legs.
    s.line([(24 + dx, 73 + dy), (20 + dx, 62 + dy), (18 + dx, 52 + dy)], "metal", 3)
    s.line([(21 + dx, 62 + dy), (16 + dx, 69 + dy)], "accent", 2)
    legs = [(28, 91, 22, 113), (42, 94, 39, 115), (65, 91, 70, 114), (76, 87, 84, 111)]
    for x1, y1, x2, y2 in legs:
        s.line([(x1 + dx, y1 + dy), (x2 + dx, y2)], "ink", 8)
        s.line([(x1 + dx, y1 + dy), (x2 + dx, y2)], "body", 5)
        s.rect((x2 - 5 + dx, y2 - 1, x2 + 5 + dx, y2 + 3), "deep")


def draw_mateus(s: Surface, pose: str):
    g = humanoid_base(s, pose)
    cx = g["cx"]
    # Long split court coat, key guard, narrow docket blade.
    if pose != "defeat":
        s.poly([(cx - 17, 68), (cx - 3, 75), (cx - 12, 108), (cx - 30, 108)], "deep")
        s.poly([(cx + 2, 75), (cx + 18, 67), (cx + 29, 108), (cx + 10, 109)], "body")
        s.line([(cx - 11, 54), (cx + 8, 76)], "accent", 3)
    hand = g["right"]
    tips = {"neutral": (83, 91), "telegraph": (25, 27), "active": (100, 57),
            "break": (22, 89), "transition": (91, 20), "defeat": (81, 111),
            "recovery": (82, 112)}
    tip = tips[pose]
    s.line([hand, tip], "ink", 5)
    s.line([hand, tip], "metal", 3)
    s.line([hand, tip], "spark", 1)
    s.rect((hand[0] - 5, hand[1] - 4, hand[0] + 4, hand[1] + 4), "accent")
    s.rect((hand[0] - 2, hand[1] - 6, hand[0] + 1, hand[1] + 6), "metal")
    if pose == "transition":
        s.line([(cx - 15, 48), (cx - 28, 28)], "accent", 3)
        s.line([(cx + 14, 48), (cx + 28, 28)], "spark", 3)
        phase_brackets(s, pose, cx)


def draw_kaji(s: Surface, pose: str):
    g = humanoid_base(s, pose, broad=3)
    cx = g["cx"]
    if pose != "defeat":
        s.rect((cx - 18, 58 + POSE_OFFSET[pose][1], cx - 6, 76 + POSE_OFFSET[pose][1]), "deep")
        s.ellipse((cx - 16, 61, cx - 8, 69), "metal")
        s.rect((cx - 14, 63, cx - 10, 67), "ink")
        s.line([(cx - 12, 71), g["right"]], "accent", 2)
    hand = g["right"]
    hook = {"neutral": (89, 96), "telegraph": (22, 27), "active": (100, 64),
            "break": (18, 92), "transition": (94, 26), "defeat": (80, 108),
            "recovery": (86, 105)}[pose]
    s.line([hand, hook], "ink", 5)
    s.line([hand, hook], "metal", 3)
    s.line([(hook[0], hook[1]), (hook[0] - 7, hook[1] + 8), (hook[0] + 2, hook[1] + 12)], "spark", 3)
    if pose == "active":
        s.line([(27, 62), (101, 64)], "accent", 2)
    phase_brackets(s, pose, cx, 16)


def draw_widow(s: Surface, pose: str):
    dx, dy = POSE_OFFSET[pose]
    cx = 56 + dx
    if pose == "defeat":
        s.shadow(20, 86, 118)
        for i in range(5):
            s.poly([(27 + i * 10, 101 - i * 3), (34 + i * 10, 92 - i * 2),
                    (42 + i * 9, 111), (30 + i * 10, 116)], "body" if i % 2 else "light")
        s.rect((42, 84, 55, 96), "ink")
        s.rect((46, 87, 52, 91), "spark")
        return
    s.shadow(19 + dx, 92 + dx)
    s.poly([(24 + dx, 57 + dy), (37 + dx, 29 + dy), (55 + dx, 16 + dy), (73 + dx, 31 + dy),
            (86 + dx, 60 + dy), (78 + dx, 91 + dy), (66 + dx, 106 + dy),
            (54 + dx, 91 + dy), (40 + dx, 107 + dy), (24 + dx, 90 + dy)], "body")
    s.poly([(39 + dx, 37 + dy), (55 + dx, 22 + dy), (70 + dx, 38 + dy),
            (64 + dx, 56 + dy), (46 + dx, 56 + dy)], "deep")
    s.rect((47 + dx, 43 + dy, 63 + dx, 48 + dy), "ink")
    s.rect((51 + dx, 44 + dy, 59 + dx, 46 + dy), "spark")
    # Spindle and sparse net geometry.
    s.rect((50 + dx, 63 + dy, 61 + dx, 82 + dy), "ink")
    s.rect((53 + dx, 65 + dy, 58 + dx, 80 + dy), "metal")
    s.rect((48 + dx, 70 + dy, 63 + dx, 75 + dy), "accent")
    spread = 8 if pose == "telegraph" else 18 if pose == "active" else 3 if pose == "break" else 6 if pose == "recovery" else 13
    left = (max(7, 19 + dx - spread), 65 + dy)
    right = (min(104, 91 + dx + spread), 62 + dy)
    s.line([(48 + dx, 66 + dy), left], "metal", 3)
    s.line([(63 + dx, 66 + dy), right], "light", 3)
    s.line([left, (55 + dx, 80 + dy), right], "spark", 1)
    s.line([(29 + dx, 83 + dy), (18 + dx, 104), (34 + dx, 98)], "deep", 5)
    s.line([(77 + dx, 82 + dy), (94 + dx, 102), (78 + dx, 98)], "accent", 5)
    if pose == "transition":
        s.line([(20, 39), (55, 74), (91, 37)], "spark", 2)
        s.line([(22, 82), (55, 74), (89, 84)], "metal", 2)
        phase_brackets(s, pose, cx, 8)


def draw_furnace(s: Surface, pose: str):
    dx, dy = POSE_OFFSET[pose]
    cx = 56 + dx
    if pose == "defeat":
        s.shadow(17, 94, 118)
        s.poly([(23, 83), (76, 78), (92, 96), (83, 114), (31, 116), (17, 101)], "body")
        s.rect((37, 90, 73, 109), "ink")
        s.rect((45, 95, 65, 104), "accent")
        s.line([(73, 85), (98, 113)], "metal", 6)
        return
    s.shadow(17 + dx, 95 + dx)
    s.poly([(24 + dx, 42 + dy), (40 + dx, 31 + dy), (76 + dx, 33 + dy), (90 + dx, 49 + dy),
            (87 + dx, 92 + dy), (76 + dx, 108 + dy), (35 + dx, 108 + dy), (20 + dx, 91 + dy)], "body")
    s.poly([(29 + dx, 47 + dy), (81 + dx, 45 + dy), (84 + dx, 61 + dy), (25 + dx, 62 + dy)], "light")
    # Uneven chimney bank.
    for px, top in ((33, 13), (49, 8), (67, 18)):
        chimney_top = max(6, top + dy)
        s.rect((px + dx, chimney_top, px + 11 + dx, 42 + dy), "deep")
        s.rect((px + dx, chimney_top, px + 11 + dx, chimney_top + 4), "metal")
    # Riveted vent face.
    s.rect((34 + dx, 63 + dy, 77 + dx, 94 + dy), "ink")
    s.rect((40 + dx, 69 + dy, 71 + dx, 88 + dy), "accent")
    s.rect((47 + dx, 73 + dy, 64 + dx, 83 + dy), "spark")
    for px in (29, 82):
        for py in (50, 84):
            s.rect((px + dx, py + dy, px + 3 + dx, py + 3 + dy), "metal")
    if pose == "transition":
        for px in (39, 53, 67):
            s.line([(px, 69 + dy), (px - 5, 51 + dy)], "spark", 4)
        phase_brackets(s, pose, cx, 7)
    hand = (87 + dx, 67 + dy)
    tip = {"neutral": (99, 110), "telegraph": (21, 18), "active": (98, 94),
           "break": (18, 107), "transition": (98, 24), "recovery": (94, 113)}[pose]
    s.line([hand, tip], "ink", 8)
    s.line([hand, tip], "metal", 5)
    s.line([hand, tip], "spark", 1)
    s.line([(tip[0] - 8, tip[1]), (tip[0] + 5, tip[1] + 6)], "accent", 5)


def draw_ujiro(s: Surface, pose: str):
    g = humanoid_base(s, pose)
    cx = g["cx"]
    # Plain docket case and clamp.
    s.rect((cx - 25, 60 if pose != "defeat" else 91, cx - 8, 82 if pose != "defeat" else 111), "ink")
    s.rect((cx - 22, 63 if pose != "defeat" else 94, cx - 11, 78 if pose != "defeat" else 107), "accent")
    s.rect((cx - 19, 65 if pose != "defeat" else 96, cx - 14, 69 if pose != "defeat" else 100), "spark")
    hand = g["right"]
    tip = {"neutral": (88, 91), "telegraph": (25, 25), "active": (100, 59),
           "break": (17, 96), "transition": (92, 22), "defeat": (83, 113),
           "recovery": (84, 113)}[pose]
    s.line([hand, tip], "ink", 7)
    s.line([hand, tip], "metal", 4)
    s.rect((tip[0] - 4, tip[1] - 4, tip[0] + 4, tip[1] + 4), "accent")
    if pose == "break":
        s.line([(39, 50), (27, 44)], "spark", 2)
        s.line([(28, 43), (19, 48)], "metal", 2)
    phase_brackets(s, pose, cx)


def draw_chiyo(s: Surface, pose: str):
    g = humanoid_base(s, pose, broad=4)
    cx = g["cx"]
    if pose != "defeat":
        # Offset yoke, damper blocks, and exposed rescue reels.
        s.line([(cx - 25, 53), (cx - 30, 24), (cx - 13, 12), (cx + 22, 18), (cx + 31, 43)], "ink", 9)
        s.line([(cx - 25, 53), (cx - 30, 24), (cx - 13, 12), (cx + 22, 18), (cx + 31, 43)], "metal", 5)
        s.rect((cx - 35, 40, cx - 23, 56), "accent")
        s.rect((cx + 23, 37, cx + 38, 53), "deep")
        s.rect((cx - 32, 43, cx - 27, 50), "spark")
        s.rect((cx + 27, 41, cx + 33, 48), "light")
        for px in (cx - 18, cx + 11):
            s.ellipse((px, 69, px + 13, 82), "ink")
            s.rect((px + 4, 73, px + 9, 78), "accent")
            s.line([(px + 6, 81), (px + 6, 105)], "metal", 2)
    hand = g["right"]
    tip = {"neutral": (96, 95), "telegraph": (23, 21), "active": (100, 71),
           "break": (17, 96), "transition": (96, 23), "defeat": (84, 113),
           "recovery": (86, 113)}[pose]
    s.line([hand, tip], "ink", 7)
    s.line([hand, tip], "metal", 4)
    s.rect((tip[0] - 7, tip[1] - 5, tip[0] + 5, tip[1] + 5), "accent")
    s.rect((tip[0] - 4, tip[1] - 3, tip[0] + 2, tip[1] + 2), "spark")
    if pose == "transition":
        s.line([(cx - 19, 71), (cx - 32, 61)], "spark", 3)
        s.line([(cx + 17, 71), (cx + 34, 59)], "accent", 3)
        phase_brackets(s, pose, cx, 6)


def draw_enma(s: Surface, pose: str):
    dx, dy = POSE_OFFSET[pose]
    cx = 56 + dx
    if pose == "defeat":
        s.shadow(19, 90, 118)
        s.poly([(25, 82), (48, 70), (71, 79), (86, 103), (74, 115), (38, 113), (20, 100)], "body")
        s.rect((46, 87, 63, 103), "ink")
        s.rect((50, 91, 59, 98), "accent")
        s.line([(27, 90), (16, 108)], "metal", 4)
        s.line([(76, 88), (94, 105)], "spark", 4)
        return
    s.shadow(20 + dx, 91 + dx)
    s.poly([(29 + dx, 50 + dy), (42 + dx, 27 + dy), (57 + dx, 19 + dy), (73 + dx, 29 + dy),
            (84 + dx, 55 + dy), (79 + dx, 96 + dy), (64 + dx, 108 + dy),
            (53 + dx, 91 + dy), (38 + dx, 108 + dy), (23 + dx, 92 + dy)], "body")
    s.poly([(42 + dx, 37 + dy), (56 + dx, 27 + dy), (70 + dx, 38 + dy),
            (67 + dx, 57 + dy), (45 + dx, 58 + dy)], "deep")
    s.rect((48 + dx, 45 + dy, 64 + dx, 49 + dy), "ink")
    s.rect((52 + dx, 46 + dy, 60 + dx, 47 + dy), "spark")
    s.rect((46 + dx, 66 + dy, 68 + dx, 88 + dy), "ink")
    s.rect((51 + dx, 71 + dy, 63 + dx, 83 + dy), "accent")
    s.rect((54 + dx, 74 + dy, 60 + dx, 80 + dy), "spark")
    spread = 32 if pose in {"active", "transition"} else 18 if pose == "recovery" else 24
    s.poly([(36 + dx, 61 + dy), (max(9, 18 + dx - spread // 3), 48 + dy),
            (max(7, 11 + dx), 61 + dy), (29 + dx, 74 + dy)], "metal")
    s.poly([(75 + dx, 60 + dy), (min(101, 94 + dx + spread // 4), 46 + dy),
            (min(104, 102 + dx), 61 + dy), (82 + dx, 75 + dy)], "light")
    s.line([(18 + dx, 53 + dy), (34 + dx, 66 + dy)], "accent", 3)
    s.line([(94 + dx, 52 + dy), (78 + dx, 66 + dy)], "spark", 3)
    if pose == "transition":
        s.line([(13, 43), (56, 75), (101, 42)], "spark", 3)
        phase_brackets(s, pose, cx, 7)


def draw_yearless(s: Surface, pose: str):
    dx, dy = POSE_OFFSET[pose]
    cx = 56 + dx
    if pose == "defeat":
        s.shadow(15, 96, 118)
        s.poly([(18, 101), (37, 83), (60, 92), (76, 79), (94, 101), (84, 115), (27, 115)], "body")
        s.rect((43, 96, 67, 112), "ink")
        s.rect((50, 101, 60, 107), "accent")
        return
    s.shadow(16 + dx, 96 + dx)
    # Fictional rectangular registry resonator, not a real bell silhouette.
    s.poly([(27 + dx, 32 + dy), (44 + dx, 18 + dy), (74 + dx, 23 + dy), (88 + dx, 43 + dy),
            (83 + dx, 92 + dy), (69 + dx, 108 + dy), (37 + dx, 106 + dy), (22 + dx, 88 + dy)], "deep")
    s.rect((30 + dx, 39 + dy, 80 + dx, 91 + dy), "body")
    s.rect((36 + dx, 45 + dy, 74 + dx, 84 + dy), "ink")
    s.rect((43 + dx, 53 + dy, 67 + dx, 78 + dy), "accent")
    s.rect((49 + dx, 59 + dy, 61 + dx, 72 + dy), "spark")
    # Offset chime plates, braces, and four node sockets.
    s.rect((20 + dx, 42 + dy, 31 + dx, 83 + dy), "metal")
    s.rect((79 + dx, 35 + dy, 91 + dx, 78 + dy), "light")
    s.line([(31 + dx, 39 + dy), (46 + dx, 20 + dy)], "metal", 4)
    s.line([(75 + dx, 25 + dy), (90 + dx, 43 + dy)], "metal", 4)
    for px, py in ((28, 89), (43, 98), (68, 98), (83, 86)):
        s.rect((px + dx, py + dy, px + 8 + dx, py + 8 + dy), "ink")
        s.rect((px + 2 + dx, py + 2 + dy, px + 5 + dx, py + 5 + dy), "spark")
    if pose == "active":
        s.line([(12, 63), (101, 63)], "accent", 3)
    if pose == "break":
        s.line([(41, 50), (55, 64), (44, 78)], "spark", 3)
    if pose == "transition":
        for px, py in ((24, 26), (87, 27), (19, 88), (93, 87)):
            s.rect((px, py, px + 6, py + 6), "accent")
        phase_brackets(s, pose, cx, 6)


def draw_kurozane(s: Surface, pose: str):
    g = humanoid_base(s, pose, broad=5)
    cx = g["cx"]
    if pose != "defeat":
        # Stepped mantle tiers and broken lattice panels.
        s.poly([(cx - 20, 45), (max(8, cx - 37), 53), (max(10, cx - 31), 63),
                (max(6, cx - 44), 73), (max(8, cx - 33), 87), (cx - 20, 78)], "deep")
        s.poly([(cx + 20, 44), (min(103, cx + 38), 52), (min(99, cx + 31), 63),
                (min(104, cx + 45), 72), (min(102, cx + 34), 87), (cx + 18, 78)], "body")
        for side in (-1, 1):
            bx = cx + side * 27
            s.line([(bx, 57), (bx + side * 8, 65), (bx, 73), (bx + side * 8, 81)], "metal", 2)
        s.rect((cx - 11, 57, cx + 12, 82), "ink")
        s.rect((cx - 6, 62, cx + 7, 76), "accent")
        s.line([(cx, 62), (cx, 77)], "spark", 2)
    hand = g["right"]
    tip = {"neutral": (92, 99), "telegraph": (24, 17), "active": (100, 54),
           "break": (16, 99), "transition": (96, 18), "defeat": (85, 114),
           "recovery": (86, 114)}[pose]
    s.line([hand, tip], "ink", 7)
    s.line([hand, tip], "metal", 4)
    s.line([hand, tip], "spark", 1)
    s.poly([(tip[0] - 4, tip[1]), (tip[0] + 3, tip[1] - 6), (tip[0] + 5, tip[1] + 4)], "accent")
    if pose == "transition":
        for px in (cx - 29, cx - 12, cx + 11, cx + 28):
            s.rect((px - 3, 23, px + 3, 31), "accent" if px < cx else "spark")
            s.line([(px, 31), (cx, 65)], "metal", 1)
        phase_brackets(s, pose, cx, 6)
    if pose == "break":
        s.line([(cx - 7, 56), (cx + 7, 70)], "spark", 3)


DRAWERS = {
    "tithe-hound": draw_tithe_hound,
    "mateus": draw_mateus,
    "captain-kaji": draw_kaji,
    "widow-of-fog": draw_widow,
    "furnace-abbot": draw_furnace,
    "ujiro": draw_ujiro,
    "bell-warden-chiyo": draw_chiyo,
    "lady-enma": draw_enma,
    "yearless-bell": draw_yearless,
    "kurozane": draw_kurozane,
}


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def ihdr(data: bytes) -> dict:
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Invalid PNG")
    width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", data[16:29])
    return {"width": width, "height": height, "bitDepth": depth, "colorType": color,
            "compression": compression, "filter": filtering, "interlace": interlace}


def contact_sheet(atlas: Image.Image) -> Image.Image:
    width, row_height = 12 + 118 * len(POSES), 150
    sheet = Image.new("RGB", (width, 28 + row_height * len(BOSSES)), (11, 16, 32))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((8, 7), "CANONICAL BOSS KEY POSES - REVIEW ONLY / NOT RUNTIME", fill=(215, 201, 154), font=font)
    for boss in SOURCE["bosses"]:
        y = 28 + boss["row"] * row_height
        draw.rectangle((3, y, width - 4, y + row_height - 3), outline=(39, 70, 107))
        draw.text((7, y + 4), f"{boss['row'] + 1:02d} {boss['label']} / {boss['encounterId']}", fill=(246, 232, 185), font=font)
        for column, pose in enumerate(POSES):
            x = 7 + column * 118
            draw.text((x, y + 17), pose.upper(), fill=(136, 200, 197), font=font)
            frame = atlas.crop((column * 112, boss["row"] * 128, column * 112 + 112, boss["row"] * 128 + 128))
            sheet.paste(frame.convert("RGB"), (x, y + 21), frame.getchannel("A"))
    return sheet


def build_artifacts() -> dict[str, bytes]:
    atlas = Image.new("RGBA", (112 * len(POSES), 128 * len(BOSSES)), (0, 0, 0, 0))
    frames = []
    for boss in SOURCE["bosses"]:
        seen_masks = set()
        palette = SOURCE["palettes"][boss["paletteId"]]
        profile = SOURCE["anchorProfiles"][boss["anchorProfile"]]
        for column, pose in enumerate(POSES):
            surface = Surface(palette)
            DRAWERS[boss["id"]](surface, pose)
            alpha = surface.image.getchannel("A")
            bbox = alpha.getbbox()
            if not bbox:
                raise ValueError(f"Empty boss frame {boss['id']}:{pose}")
            left, top, right, bottom = bbox
            gutters = {"left": left, "top": top, "right": 112 - right, "bottom": 128 - bottom}
            if min(gutters.values()) < 6:
                raise ValueError(f"Insufficient gutter {boss['id']}:{pose}: {gutters}")
            mask_hash = sha256(alpha.tobytes())
            if mask_hash in seen_masks:
                raise ValueError(f"Repeated silhouette {boss['id']}:{pose}")
            seen_masks.add(mask_hash)
            opaque = sum(1 for value in alpha.getdata() if value)
            anchors = profile[pose]
            frames.append({
                "id": f"{boss['id']}:{pose}", "bossId": boss["id"],
                "encounterId": boss["encounterId"], "pose": pose,
                "tag": SOURCE["poses"][column]["tag"], "event": SOURCE["poses"][column]["event"],
                "paletteId": boss["paletteId"],
                "rect": {"x": column * 112, "y": boss["row"] * 128, "width": 112, "height": 128},
                "pivot": anchors["pivot"], "ground": anchors["ground"],
                "hitAnchor": anchors["hit"], "phaseAnchor": anchors["phase"],
                "alphaBounds": {"x": left, "y": top, "width": right - left, "height": bottom - top},
                "transparentGutter": gutters, "opaquePixelCount": opaque,
                "rgbaSha256": sha256(surface.image.tobytes()),
            })
            atlas.alpha_composite(surface.image, (column * 112, boss["row"] * 128))
    atlas_data = png_bytes(atlas)
    contact_data = png_bytes(contact_sheet(atlas))
    source_data = SOURCE_PATH.read_bytes()
    builder_data = Path(__file__).read_bytes()
    manifest = {
        "schemaVersion": 1,
        "assetId": SOURCE["assetId"],
        "status": "integrated-current-browser-boss-priority",
        "authorship": SOURCE["authorship"],
        "canonicalSource": SOURCE_PATH.name,
        "builder": Path(__file__).name,
        "bossInclusionRule": SOURCE["bossInclusionRule"],
        "geometry": SOURCE["geometry"],
        "poseOrder": list(POSES),
        "bossOrder": list(BOSSES),
        "encounterMappings": [
            {key: boss[key] for key in ("id", "row", "label", "encounterId", "encounterFormat", "resolution", "phaseRead")}
            for boss in SOURCE["bosses"]
        ],
        "safety": SOURCE["safety"],
        "sources": [
            {"path": SOURCE_PATH.name, "format": "json", "sha256": sha256(source_data)},
            {"path": Path(__file__).name, "format": "python", "sha256": sha256(builder_data)},
        ],
        "exports": [
            {"path": ATLAS_PATH.name, "role": "transparent-runtime-candidate", "runtimeCandidate": True,
             "sha256": sha256(atlas_data), "ihdr": ihdr(atlas_data)},
            {"path": CONTACT_PATH.name, "role": "labeled-review-contact-sheet", "runtimeCandidate": False,
             "sha256": sha256(contact_data), "ihdr": ihdr(contact_data)},
        ],
        "frames": frames,
    }
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return {ATLAS_PATH.name: atlas_data, CONTACT_PATH.name: contact_data, MANIFEST_PATH.name: manifest_data}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail unless generated artifacts are byte-exact")
    args = parser.parse_args()
    global SOURCE
    SOURCE = load_source()
    first = build_artifacts()
    second = build_artifacts()
    if first != second:
        raise SystemExit("Boss suite is not deterministic across two clean in-process builds")
    if args.check:
        errors = [name for name, data in first.items() if not (ROOT / name).exists() or (ROOT / name).read_bytes() != data]
        if errors:
            raise SystemExit("Boss suite check failed: " + ", ".join(errors))
        print("Boss combat suite is byte-identical across two clean builds.")
        return 0
    for name, data in first.items():
        (ROOT / name).write_bytes(data)
    print("Wrote " + ", ".join(first))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
