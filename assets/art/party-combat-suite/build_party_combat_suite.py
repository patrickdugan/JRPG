#!/usr/bin/env python3
"""Deterministically build original party combat action key poses."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "party-combat-suite.source.json"
FIELD_SOURCE_PATH = ROOT / ".." / "party-field-suite" / "party-field-suite.source.json"
ATLAS_NAME = "party-combat-actions.png"
CONTACT_NAME = "party-combat-actions-contact-sheet.png"
MANIFEST_NAME = "manifest.json"
README_NAME = "README.md"
ROWS = ("ren", "aya", "lise", "mateus", "genta", "kiku")
COLUMNS = ("idle", "move", "guard", "hit", "basic-strike-windup", "basic-strike-active", "signature-a", "signature-b")
W, H = 48, 64
PIVOT = (24, 58)
GUTTER = 4


def color(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encode_png(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def load_contracts() -> tuple[dict, dict]:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    field = json.loads(FIELD_SOURCE_PATH.read_text(encoding="utf-8"))
    assert tuple(source["sheet"]["rows"]) == ROWS
    assert tuple(source["sheet"]["columns"]) == COLUMNS
    assert tuple(entry["id"] for entry in source["characters"]) == ROWS
    assert tuple(entry["id"] for entry in field["characters"]) == ROWS
    assert (source["frame"]["width"], source["frame"]["height"]) == (W, H)
    assert tuple(source["frame"]["pivot"]) == PIVOT
    assert source["frame"]["minimumTransparentGutter"] >= GUTTER
    return source, field


class Cel:
    def __init__(self, palette: dict[str, str], pose: str):
        self.image = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)
        self.c = {key: color(value) for key, value in palette.items()}
        self.pose = pose

    def rect(self, box, fill):
        self.draw.rectangle(box, fill=self.c[fill])

    def poly(self, points, fill):
        self.draw.polygon(points, fill=self.c[fill])

    def line(self, points, fill, width=1):
        self.draw.line(points, fill=self.c[fill], width=width)

    def px(self, x, y, fill):
        self.draw.point((x, y), fill=self.c[fill])


def combined_palette(field: dict, character_id: str) -> dict[str, str]:
    character = next(entry for entry in field["characters"] if entry["id"] == character_id)
    palette = {**field["sharedPalette"], **character["colors"]}
    palette.update({
        "ember": "#b34a3e", "emberLight": "#f0a060", "radiance": "#d7f0d5",
        "dawn": "#88c8c5", "umbral": "#781e39", "violet": "#401d42",
        "frost": "#9bd8df", "white": "#f6e8b9", "impact": "#d7b080",
    })
    return palette


def pose_offsets(pose: str) -> tuple[int, int]:
    return {
        "idle": (0, 0), "move": (3, 1), "guard": (1, 2), "hit": (-4, 1),
        "basic-strike-windup": (-2, 1), "basic-strike-active": (4, 0),
        "signature-a": (1, 0), "signature-b": (0, 1),
    }[pose]


def draw_head(cel: Cel, character_id: str, x: int, y: int):
    if cel.pose == "hit":
        x -= 2
        y += 1
    cel.rect((x - 6, y - 1, x + 4, y + 10), "outline")
    cel.rect((x - 5, y, x + 2, y + 3), "hair")
    cel.rect((x - 4, y + 4, x + 3, y + 8), "skin")
    cel.rect((x - 5, y + 7, x - 2, y + 10), "skinShadow")
    cel.px(x + 3, y + 5, "skinLight")
    cel.px(x + 2, y + 6, "deep")
    cel.px(x + 4, y + 8, "outline")
    if character_id in ("aya", "kiku"):
        cel.rect((x - 7, y + 1, x - 5, y + 10), "hair")
        cel.px(x - 8, y + 8, "hair")
    if character_id == "lise":
        cel.rect((x - 6, y, x - 3, y + 8), "hair")
        cel.px(x - 7, y + 6, "hair")
        cel.px(x + 3, y + 1, "light")
    if character_id == "mateus":
        cel.rect((x - 5, y - 1, x + 3, y + 1), "hair")
        cel.px(x - 6, y + 2, "hair")
    if character_id == "genta":
        cel.rect((x - 7, y - 1, x + 4, y + 1), "hair")
        cel.rect((x - 3, y + 8, x + 3, y + 11), "hair")


def draw_feet(cel: Cel, x: int, primary="primary", broad=False):
    spread = 6 if broad else 4
    if cel.pose == "move":
        cel.rect((x - 8, 48, x - 3, 56), "outline")
        cel.rect((x + 4, 46, x + 8, 54), "outline")
        cel.rect((x - 11, 56, x - 3, 58), "outline")
        cel.rect((x + 4, 54, x + 11, 57), "outline")
        cel.rect((x - 7, 49, x - 4, 54), primary)
        cel.rect((x + 5, 47, x + 7, 52), primary)
    elif cel.pose == "hit":
        cel.rect((x - 5, 48, x - 1, 56), "outline")
        cel.rect((x + 5, 50, x + 9, 57), "outline")
        cel.rect((x - 8, 56, x - 1, 58), "outline")
        cel.rect((x + 5, 57, x + 13, 59), "outline")
    else:
        cel.rect((x - spread - 2, 47, x - spread + 2, 56), "outline")
        cel.rect((x + spread - 2, 47, x + spread + 2, 56), "outline")
        cel.rect((x - spread - 4, 56, x - spread + 2, 58), "outline")
        cel.rect((x + spread - 2, 56, x + spread + 5, 58), "outline")
        cel.rect((x - spread - 1, 48, x - spread + 1, 54), primary)
        cel.rect((x + spread - 1, 48, x + spread + 1, 54), primary)


def body(cel: Cel, character_id: str, broad=False, long=False):
    dx, dy = pose_offsets(cel.pose)
    x = 22 + dx
    head_y = 9 + dy
    draw_feet(cel, x, broad=broad)
    if broad:
        cel.poly([(x - 13, 23), (x - 8, 19), (x + 8, 19), (x + 14, 24), (x + 10, 45), (x - 10, 45)], "outline")
        cel.poly([(x - 11, 24), (x - 7, 21), (x + 7, 21), (x + 11, 24), (x + 8, 42), (x - 8, 42)], "primary")
    elif long:
        cel.poly([(x - 8, 22), (x + 7, 22), (x + 9, 47), (x + 5, 52), (x - 7, 51), (x - 10, 46)], "outline")
        cel.poly([(x - 6, 23), (x + 5, 23), (x + 7, 45), (x + 3, 49), (x - 5, 48), (x - 8, 45)], "primary")
    else:
        cel.poly([(x - 8, 22), (x + 7, 22), (x + 10, 42), (x + 5, 48), (x - 7, 47), (x - 10, 41)], "outline")
        cel.poly([(x - 6, 23), (x + 5, 23), (x + 7, 40), (x + 4, 45), (x - 5, 44), (x - 8, 40)], "primary")
    cel.rect((x - 5, 24, x + 4, 29), "secondary")
    cel.line([(x - 5, 30), (x + 5, 38)], "light")
    draw_head(cel, character_id, x, head_y)
    return x


def guard_mark(cel: Cel, x: int):
    cel.line([(x + 5, 27), (x + 12, 31), (x + 11, 42)], "outline", 3)
    cel.line([(x + 6, 28), (x + 10, 32), (x + 9, 40)], "metal", 2)


def impact_cleft(cel: Cel, x=39, y=28, fill="white"):
    cel.line([(x - 3, y - 8), (x + 3, y), (x - 1, y + 10)], "outline", 3)
    cel.line([(x - 2, y - 8), (x + 2, y), (x, y + 9)], fill)


def draw_ren(cel: Cel):
    x = body(cel, "ren")
    # Satchel and spear remain silhouette anchors in every action.
    cel.rect((x - 13, 29, x - 7, 40), "outline")
    cel.rect((x - 12, 30, x - 8, 38), "light")
    cel.line([(x - 6, 23), (x - 10, 36)], "accent")
    if cel.pose == "basic-strike-windup":
        cel.line([(6, 39), (26, 19)], "outline", 3); cel.line([(7, 38), (26, 20)], "brass")
        cel.poly([(5, 40), (10, 37), (8, 43)], "metal")
    elif cel.pose in ("basic-strike-active", "signature-a"):
        cel.line([(x + 4, 31), (42, 23)], "outline", 3); cel.line([(x + 5, 30), (41, 23)], "brass")
        cel.poly([(43, 22), (39, 21), (41, 25)], "metal")
        impact_cleft(cel, 39, 29)
    else:
        cel.line([(x + 9, 12), (x + 9, 48)], "outline", 3); cel.line([(x + 9, 13), (x + 9, 46)], "brass")
        cel.poly([(x + 9, 8), (x + 6, 14), (x + 11, 13)], "metal")
    if cel.pose == "guard": guard_mark(cel, x)
    if cel.pose == "hit": cel.line([(9, 27), (15, 33)], "impact", 2)
    if cel.pose == "signature-b":
        cel.line([(9, 47), (39, 47)], "ember", 2)
        for px, py in ((12,43),(19,45),(28,42),(36,44)): cel.poly([(px,py),(px+2,py-5),(px+4,py)], "emberLight")


def draw_aya(cel: Cel):
    x = body(cel, "aya")
    cel.rect((x - 13, 27, x - 7, 41), "outline"); cel.rect((x - 12, 28, x - 8, 39), "deep")
    cel.px(x - 11, 29, "brass"); cel.px(x - 9, 38, "brass")
    if cel.pose == "guard":
        cel.poly([(x + 3,25),(x + 15,20),(x + 13,40),(x + 3,39)], "outline")
        cel.poly([(x + 5,26),(x + 13,23),(x + 11,37),(x + 5,37)], "paper")
    elif cel.pose == "basic-strike-windup":
        cel.poly([(8,33),(14,22),(23,29),(18,38)], "outline"); cel.line([(10,32),(21,29)], "paper", 3)
    elif cel.pose == "basic-strike-active":
        cel.line([(x+4,31),(41,31)], "outline", 3); cel.line([(x+6,30),(40,30)], "paper")
        cel.poly([(39,26),(43,31),(39,36),(36,31)], "radiance")
    else:
        cel.poly([(x+5,28),(x+13,22),(x+15,28),(x+8,34)], "outline")
        cel.line([(x+7,28),(x+13,24)], "paper", 2)
    if cel.pose == "signature-a":
        cel.line([(35,18),(41,24),(41,34),(35,40),(29,34),(29,24),(35,18)], "radiance", 2)
        cel.line([(31,29),(39,29)], "dawn")
    if cel.pose == "signature-b":
        cel.rect((31,20,41,36), "outline"); cel.rect((33,22,39,34), "paper")
        cel.line([(34,25),(38,25),(34,29),(38,29),(34,33)], "accent")
    if cel.pose == "hit": cel.line([(8,24),(15,31)], "impact", 2)


def draw_lise(cel: Cel):
    x = body(cel, "lise", long=True)
    cel.poly([(x-9,23),(x-14,30),(x-11,45),(x-5,40)], "outline")
    cel.poly([(x-9,25),(x-12,31),(x-10,41),(x-6,38)], "secondary")
    if cel.pose == "guard":
        cel.line([(x+1,24),(x+12,41)], "metal", 2); cel.line([(x+9,22),(x+15,31)], "brass", 2)
    elif cel.pose == "basic-strike-windup":
        cel.line([(10,42),(25,24)], "outline", 3); cel.line([(11,41),(25,25)], "metal")
    elif cel.pose in ("basic-strike-active", "signature-a"):
        cel.line([(x+3,31),(43,29)], "outline", 3); cel.line([(x+5,30),(42,29)], "metal")
        cel.poly([(43,29),(39,27),(40,31)], "white")
        cel.line([(30,27),(43,27)], "dawn")
    else:
        cel.line([(x+7,26),(x+12,45)], "outline", 2); cel.line([(x+8,27),(x+12,43)], "metal")
        cel.line([(x-2,28),(x+10,28)], "brass", 2)
    if cel.pose == "signature-b":
        cel.line([(x+6,27),(41,18)], "outline", 3); cel.line([(x+7,27),(40,19)], "brass")
        cel.poly([(42,17),(38,17),(40,21)], "radiance")
        cel.line([(35,14),(42,17),(39,24)], "dawn")
    if cel.pose == "hit": cel.line([(9,25),(15,30)], "impact", 2)


def draw_mateus(cel: Cel):
    x = body(cel, "mateus", long=True)
    cel.rect((x-5,21,x+4,25), "outline"); cel.rect((x-3,21,x+2,24), "light")
    cel.rect((x-1,25,x,46), "secondary")
    cel.line([(x+6,33),(x+12,42)], "brass")
    cel.px(x+13,43,"brass"); cel.px(x+11,44,"metal")
    if cel.pose == "guard":
        cel.line([(x+2,24),(x+11,34)], "light", 3); cel.line([(x+11,34),(x+5,41)], "accent", 2)
    elif cel.pose == "basic-strike-windup":
        cel.line([(10,38),(25,25)], "outline", 3); cel.line([(11,37),(25,26)], "metal")
    elif cel.pose == "basic-strike-active":
        cel.line([(x+3,31),(41,26)], "outline", 3); cel.line([(x+5,30),(40,26)], "metal")
        impact_cleft(cel, 39, 29, "umbral")
    if cel.pose == "signature-a":
        cel.line([(30,19),(39,23),(42,31),(38,40)], "umbral", 3)
        cel.line([(32,20),(40,29),(36,38)], "violet")
        for px,py in ((34,19),(41,27),(39,39)): cel.px(px,py,"white")
    if cel.pose == "signature-b":
        cel.line([(31,20),(38,25),(40,34),(35,42)], "dawn", 2)
        cel.line([(33,22),(39,33),(34,40)], "radiance")
        cel.rect((28,27,30,33), "accent")
    if cel.pose == "hit": cel.line([(8,24),(15,31)], "impact", 2)


def draw_genta(cel: Cel):
    x = body(cel, "genta", broad=True)
    shield_x = max(4, x - 17) if cel.pose != "guard" else x + 3
    cel.poly([(shield_x,27),(shield_x+7,23),(shield_x+12,28),(shield_x+10,45),(shield_x+4,50),(shield_x,43)], "outline")
    cel.poly([(shield_x+2,28),(shield_x+7,25),(shield_x+10,29),(shield_x+8,43),(shield_x+4,47),(shield_x+2,42)], "metal")
    if cel.pose == "basic-strike-windup":
        cel.line([(9,42),(29,17)], "outline", 4); cel.line([(11,40),(29,18)], "brass", 2)
        cel.rect((7,38,15,47), "outline"); cel.rect((9,39,14,44), "metalDark")
    elif cel.pose in ("basic-strike-active","signature-a"):
        cel.line([(x+2,25),(40,44)], "outline", 4); cel.line([(x+3,26),(39,43)], "brass", 2)
        cel.rect((37,40,43,48), "outline"); cel.rect((38,41,42,46), "metalDark")
        cel.line([(34,49),(43,49)], "impact", 2)
    else:
        cel.line([(x+7,15),(x+13,48)], "outline", 4); cel.line([(x+8,16),(x+12,46)], "brass", 2)
        cel.rect((x+4,11,x+14,19), "outline"); cel.rect((x+6,13,x+13,17), "metalDark")
    if cel.pose == "signature-b":
        cel.line([(32,20),(40,26),(40,42),(32,49)], "dawn", 2)
        cel.line([(33,23),(38,28),(38,40),(33,46)], "brass")
    if cel.pose == "hit": cel.line([(7,25),(14,31)], "impact", 2)


def draw_kiku(cel: Cel):
    x = body(cel, "kiku")
    cel.rect((x-14,28,x-7,43), "outline"); cel.rect((x-12,30,x-8,41), "secondary")
    cel.line([(x-12,35),(x-8,35)], "primary"); cel.px(x-10,31,"dawn"); cel.px(x-9,39,"brass")
    if cel.pose == "guard":
        cel.poly([(x+3,25),(x+14,29),(x+11,43),(x+2,39)], "outline")
        cel.poly([(x+5,28),(x+12,30),(x+9,40),(x+4,38)], "paper")
    elif cel.pose == "basic-strike-windup":
        cel.rect((11,28,18,37), "outline"); cel.rect((13,29,16,35), "frost")
    elif cel.pose == "basic-strike-active":
        cel.line([(x+4,31),(39,24)], "outline", 2)
        cel.rect((39,20,43,26), "outline"); cel.rect((40,21,42,24), "frost")
        cel.line([(35,29),(42,35)], "frost")
    else:
        cel.rect((x+6,26,x+10,34), "outline"); cel.rect((x+7,27,x+9,32), "frost")
    if cel.pose == "signature-a":
        cel.line([(31,20),(40,26),(39,38),(30,42)], "frost", 2)
        cel.line([(30,31),(42,31)], "white")
        cel.line([(36,23),(36,40)], "dawn")
    if cel.pose == "signature-b":
        cel.line([(29,43),(42,43)], "primary", 2)
        for px,py in ((31,39),(35,36),(39,39)): cel.poly([(px,py),(px+2,py-5),(px+4,py)], "radiance")
    if cel.pose == "hit": cel.line([(8,24),(15,31)], "impact", 2)


DRAW = {"ren": draw_ren, "aya": draw_aya, "lise": draw_lise, "mateus": draw_mateus, "genta": draw_genta, "kiku": draw_kiku}


def validate_cel(image: Image.Image, frame_id: str):
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError(f"empty cel {frame_id}")
    left, top, right, bottom = bounds
    if left < GUTTER or top < GUTTER or right > W - GUTTER or bottom > H - GUTTER:
        raise ValueError(f"gutter violation {frame_id}: {bounds}")
    if set(alpha.getdata()) - {0, 255}:
        raise ValueError(f"non-binary alpha {frame_id}")


def render_atlas(source: dict, field: dict) -> tuple[Image.Image, list[dict]]:
    atlas = Image.new("RGBA", (W * len(COLUMNS), H * len(ROWS)), (0, 0, 0, 0))
    frames = []
    character_contracts = {entry["id"]: entry for entry in source["characters"]}
    for row, character_id in enumerate(ROWS):
        for column, pose in enumerate(COLUMNS):
            cel = Cel(combined_palette(field, character_id), pose)
            DRAW[character_id](cel)
            frame_id = f"{character_id}:{pose}"
            validate_cel(cel.image, frame_id)
            x, y = column * W, row * H
            atlas.alpha_composite(cel.image, (x, y))
            action = source["actions"][pose]
            character = character_contracts[character_id]
            semantic = character.get("signatureA") if pose == "signature-a" else character.get("signatureB") if pose == "signature-b" else {"delivery": character["basicDelivery"]} if pose.startswith("basic-strike") else None
            frames.append({
                "id": frame_id, "characterId": character_id, "action": pose,
                "rect": [x, y, W, H], "pivot": list(PIVOT), "footPoint": list(PIVOT),
                "hitAnchor": action["hitAnchor"], "phase": action["phase"],
                "event": action["event"], "rule": action["rule"], "actionSemantic": semantic,
                "localAlphaBounds": list(cel.image.getchannel("A").getbbox()),
                "rgbaSha256": digest(cel.image.tobytes()),
            })
    assert len({entry["rgbaSha256"] for entry in frames}) == len(frames)
    return atlas, frames


FONT = {
    "A":("01110","10001","10001","11111","10001","10001","10001"),"B":("11110","10001","10001","11110","10001","10001","11110"),
    "C":("01111","10000","10000","10000","10000","10000","01111"),"D":("11110","10001","10001","10001","10001","10001","11110"),
    "E":("11111","10000","10000","11110","10000","10000","11111"),"G":("01111","10000","10000","10111","10001","10001","01111"),
    "H":("10001","10001","10001","11111","10001","10001","10001"),"I":("11111","00100","00100","00100","00100","00100","11111"),
    "K":("10001","10010","10100","11000","10100","10010","10001"),"L":("10000","10000","10000","10000","10000","10000","11111"),
    "M":("10001","11011","10101","10101","10001","10001","10001"),"N":("10001","11001","10101","10011","10001","10001","10001"),
    "O":("01110","10001","10001","10001","10001","10001","01110"),"P":("11110","10001","10001","11110","10000","10000","10000"),"R":("11110","10001","10001","11110","10100","10010","10001"),
    "S":("01111","10000","10000","01110","00001","00001","11110"),"T":("11111","00100","00100","00100","00100","00100","00100"),
    "U":("10001","10001","10001","10001","10001","10001","01110"),"V":("10001","10001","10001","10001","10001","01010","00100"),
    "W":("10001","10001","10001","10101","10101","11011","10001"),"Y":("10001","10001","01010","00100","00100","00100","00100"),
    "-":("00000","00000","00000","11111","00000","00000","00000")," ":("00000",)*7,
}


def label(draw, x, y, text, fill, scale=1):
    for letter in text.upper():
        glyph = FONT.get(letter, FONT[" "])
        for gy, row in enumerate(glyph):
            for gx, on in enumerate(row):
                if on == "1": draw.rectangle((x+gx*scale,y+gy*scale,x+(gx+1)*scale-1,y+(gy+1)*scale-1), fill=fill)
        x += 6 * scale


def render_contact(atlas: Image.Image) -> Image.Image:
    scale, left, top = 3, 100, 54
    cw, ch = W * scale, H * scale
    contact = Image.new("RGBA", (left + cw*8 + 16, top + ch*6 + 16), color("#0b1020"))
    draw = ImageDraw.Draw(contact)
    short = ("IDLE","MOVE","GUARD","HIT","WINDUP","ACTIVE","SIG-A","SIG-B")
    for column, text in enumerate(short): label(draw, left+column*cw+8, 18, text, color("#d7c99a"))
    for row, character_id in enumerate(ROWS): label(draw, 8, top+row*ch+84, character_id, color("#d7c99a"), 2)
    for row in range(6):
        for column in range(8):
            x, y = left+column*cw, top+row*ch
            checker = Image.new("RGBA", (cw,ch), color("#16233a")); cd = ImageDraw.Draw(checker)
            for cy in range(0,ch,12):
                for cx in range(0,cw,12):
                    if (cx//12+cy//12)%2: cd.rectangle((cx,cy,cx+11,cy+11),fill=color("#202d3d"))
            contact.alpha_composite(checker,(x,y))
            frame=atlas.crop((column*W,row*H,(column+1)*W,(row+1)*H)).resize((cw,ch),Image.Resampling.NEAREST)
            contact.alpha_composite(frame,(x,y)); draw.rectangle((x,y,x+cw-1,y+ch-1),outline=color("#27466b"))
            px,py=x+PIVOT[0]*scale,y+PIVOT[1]*scale
            draw.line((px-4,py,px+4,py),fill=color("#88c8c5")); draw.line((px,py-4,px,py+4),fill=color("#88c8c5"))
    return contact


def build_files() -> dict[str, bytes]:
    source, field = load_contracts()
    atlas, frames = render_atlas(source, field)
    contact = render_contact(atlas)
    atlas_data, contact_data = encode_png(atlas), encode_png(contact)
    palette_records = {}
    for entry in field["characters"]:
        palette_records[entry["id"]] = {"paletteId": entry["paletteId"], "silhouette": entry["silhouette"], "colors": entry["colors"]}
    manifest = {
        "assetId": source["assetId"], "status": "editable-production-combat-key-pose-suite",
        "runtimeIntegration": "current-browser-battle-key-poses", "authorship": source["authorship"],
        "geometry": {"columns":8,"rows":6,"cellWidth":W,"cellHeight":H,"sheetWidth":atlas.width,"sheetHeight":atlas.height,"pivot":list(PIVOT),"footPoint":list(PIVOT),"minimumTransparentGutter":GUTTER},
        "rowOrder": list(ROWS), "columnOrder": list(COLUMNS), "paletteAndSilhouetteReuse": palette_records,
        "actionSemantics": source["actions"], "frames": frames,
        "sources": [
            {"path":SOURCE_PATH.name,"role":"editable-combat-contract","sha256":digest(SOURCE_PATH.read_bytes())},
            {"path":str(source["canonicalFieldSource"]),"role":"canonical-palette-and-silhouette-contract","sha256":digest(FIELD_SOURCE_PATH.read_bytes())},
            {"path":Path(__file__).name,"role":"deterministic-builder","sha256":digest(Path(__file__).read_bytes())},
        ],
        "exports": [
            {"path":ATLAS_NAME,"role":"transparent-runtime-candidate","width":atlas.width,"height":atlas.height,"mode":atlas.mode,"sha256":digest(atlas_data)},
            {"path":CONTACT_NAME,"role":"labeled-review-only-not-runtime","width":contact.width,"height":contact.height,"mode":contact.mode,"sha256":digest(contact_data)},
        ],
        "validation": {"frameCount":48,"distinctRgbaFrameHashes":48,"binaryTransparency":True,"minimumObservedGutter":GUTTER,"deterministicCommand":"python build_party_combat_suite.py --check"},
        "review": {"visualInspection":"pending","externalCulturalReview":"pending","fullInbetweens":"pending","portraits":"not-in-this-suite"},
    }
    manifest_data=(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n").encode("utf-8")
    readme=f"""# Party combat action suite\n\nOriginal, code-authored combat key poses for Ren, Aya, Lise, Mateus, Genta, and Kiku. The builder reads the canonical palette IDs, colors, and silhouette descriptions from `../party-field-suite/party-field-suite.source.json`; it does not use generated concepts or raster atlases as input. Mateus has an original fictional face and proportions.\n\n- `{SOURCE_PATH.name}` is the editable action and event contract.\n- `{ATLAS_NAME}` is the transparent 384 × 384 runtime candidate: six rows, eight columns, 48 × 64 per cell.\n- `{CONTACT_NAME}` is a labeled {contact.width} × {contact.height} checkerboard review sheet and is not for runtime use.\n- `{MANIFEST_NAME}` records exact frames, pivots `(24, 58)`, foot points, hit anchors, action semantics, palette reuse, hashes, and review state.\n\nColumns are idle, move, guard, hit, basic-strike wind-up, basic-strike active, signature A, and signature B. Battle now selects these exact keys from live presentation phases with dimension-gated loading and a procedural-token failure fallback. These are silhouette-defining production keys, not complete animation clips. In-betweens, a dedicated recovery key, retreat/defeat, alternate facings, portraits, human readability testing, and external cultural review remain pending.\n\nRun `python build_party_combat_suite.py` to rebuild or `python build_party_combat_suite.py --check` to byte-compare every generated file.\n"""
    return {ATLAS_NAME:atlas_data,CONTACT_NAME:contact_data,MANIFEST_NAME:manifest_data,README_NAME:readme.encode("utf-8")}


def main() -> int:
    parser=argparse.ArgumentParser(); parser.add_argument("--check",action="store_true"); args=parser.parse_args()
    files=build_files()
    if args.check:
        stale=[name for name,data in files.items() if not (ROOT/name).exists() or (ROOT/name).read_bytes()!=data]
        if stale:
            for name in stale: print(f"stale or missing: {name}",file=sys.stderr)
            return 1
        print(f"OK: {len(files)} generated files are byte-identical")
        return 0
    for name,data in files.items():
        (ROOT/name).write_bytes(data); print(f"wrote {name}: {len(data)} bytes sha256={digest(data)}")
    return 0


if __name__ == "__main__": raise SystemExit(main())
