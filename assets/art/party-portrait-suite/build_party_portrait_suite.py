#!/usr/bin/env python3
"""Build the original six-character portrait expression atlas deterministically."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "party-portrait-suite.source.json"
FIELD_SOURCE_PATH = ROOT / ".." / "party-field-suite" / "party-field-suite.source.json"
ATLAS_NAME = "party-portrait-expressions.png"
CONTACT_NAME = "party-portrait-expressions-contact-sheet.png"
MANIFEST_NAME = "manifest.json"
README_NAME = "README.md"
ROWS = ("ren", "aya", "lise", "mateus", "genta", "kiku")
REVIEW_ROW_LABELS = {"lise": "NIKOLA"}
COLUMNS = ("neutral", "resolve", "strain", "soften", "concern", "anger", "surprise", "quiet")
CELL = 64
GUTTER = 4


def rgba(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def load_contracts() -> tuple[dict, dict]:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    field = json.loads(FIELD_SOURCE_PATH.read_text(encoding="utf-8"))
    assert tuple(source["sheet"]["rows"]) == ROWS
    assert tuple(source["sheet"]["columns"]) == COLUMNS
    assert tuple(source["expressions"]) == COLUMNS
    assert tuple(entry["id"] for entry in source["characters"]) == ROWS
    assert tuple(entry["id"] for entry in field["characters"]) == ROWS
    assert source["frame"] == {"width": CELL, "height": CELL, "minimumTransparentGutter": GUTTER}
    content_width = CELL * len(COLUMNS)
    assert source["atlas"] == {
        "width": content_width,
        "height": CELL * len(ROWS),
        "contentWidth": content_width,
        "transparentRightPadding": 0,
    }
    return source, field


def palette_for(field: dict, character_id: str) -> dict[str, str]:
    character = next(entry for entry in field["characters"] if entry["id"] == character_id)
    palette = {**field["sharedPalette"], **character["colors"]}
    palette.update({
        "faceDeep": "#6c4638", "eye": "#0b1020", "eyeLight": "#f6e8b9",
        "lip": "#762b32", "cheek": "#b8775c", "dawn": "#88c8c5",
        "paperDeep": "#a99b73", "wine": "#762b32", "cloakDeep": "#1a2938",
    })
    return palette


class Portrait:
    def __init__(self, palette: dict[str, str], expression: str):
        self.image = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)
        self.c = {name: rgba(value) for name, value in palette.items()}
        self.expression = expression

    def rect(self, box, fill): self.draw.rectangle(box, fill=self.c[fill])
    def poly(self, points, fill): self.draw.polygon(points, fill=self.c[fill])
    def line(self, points, fill, width=1): self.draw.line(points, fill=self.c[fill], width=width)
    def px(self, x, y, fill): self.draw.point((x, y), fill=self.c[fill])


FACE = {
    "ren": {"left":18,"right":45,"top":12,"jaw":44,"chin":48,"eyeY":27,"mouthY":37},
    "aya": {"left":19,"right":44,"top":11,"jaw":43,"chin":48,"eyeY":27,"mouthY":37},
    # The legacy `lise` atlas key is Nikola Dražanić. His broader jaw, high
    # forehead, moustache and clipped beard must read distinctly from Mateus.
    "lise": {"left":17,"right":47,"top":9,"jaw":45,"chin":51,"eyeY":27,"mouthY":38},
    "mateus": {"left":20,"right":45,"top":10,"jaw":43,"chin":50,"eyeY":27,"mouthY":38},
    "genta": {"left":16,"right":47,"top":11,"jaw":46,"chin":49,"eyeY":27,"mouthY":38},
    "kiku": {"left":18,"right":44,"top":11,"jaw":43,"chin":48,"eyeY":27,"mouthY":37},
}


def draw_shoulders(p: Portrait, character_id: str):
    if character_id == "genta":
        p.poly([(6,59),(8,50),(18,43),(46,43),(57,50),(59,59)], "outline")
        p.poly([(9,59),(11,51),(20,46),(44,46),(55,51),(57,59)], "primary")
        p.rect((27,45,38,51), "secondary")
        p.rect((39,47,44,52), "brass")
    elif character_id == "lise":
        # Square aristocratic doublet beneath a practical rain cloak.
        p.poly([(5,59),(8,49),(19,42),(46,42),(57,49),(59,59)], "outline")
        p.poly([(8,59),(11,50),(21,45),(44,45),(54,51),(57,59)], "primary")
        p.poly([(20,45),(31,50),(43,45),(48,59),(16,59)], "secondary")
        # Plain falling band: historical clothing, not a sacred-object motif.
        p.poly([(24,43),(31,49),(39,43),(42,48),(34,54),(29,54),(21,48)], "paper")
        p.rect((43,47,48,52), "brass")
        p.px(45,48,"candle")
    elif character_id == "mateus":
        p.poly([(10,59),(15,48),(25,43),(40,43),(50,49),(55,59)], "outline")
        p.poly([(13,59),(17,49),(27,45),(38,45),(47,50),(52,59)], "primary")
        p.poly([(24,44),(31,52),(39,44),(42,59),(21,59)], "secondary")
        p.rect((31,49,33,59), "wine")
    else:
        p.poly([(7,59),(11,51),(23,44),(41,44),(54,51),(58,59)], "outline")
        p.poly([(10,59),(14,52),(24,47),(40,47),(51,52),(55,59)], "primary")
        if character_id == "ren":
            p.poly([(13,52),(22,47),(32,59),(23,59)], "secondary")
            p.line([(42,48),(49,58)], "accent", 2)
        elif character_id == "aya":
            p.poly([(17,50),(26,46),(32,55),(39,46),(48,51),(46,59),(18,59)], "secondary")
            p.rect((46,51,51,58), "paper")
        elif character_id == "kiku":
            p.poly([(15,51),(24,46),(31,54),(41,46),(49,52),(47,59),(16,59)], "primary")
            p.rect((45,50,51,57), "secondary")
            p.px(48,52,"dawn"); p.px(48,55,"brass")


def draw_neck(p: Portrait, f: dict):
    p.rect((26, f["jaw"]-1, 39, 49), "outline")
    p.rect((28, f["jaw"]-2, 37, 48), "skinShadow")
    p.rect((30, f["jaw"]-1, 37, 46), "skin")


def draw_face_shape(p: Portrait, character_id: str):
    f = FACE[character_id]
    left,right,top,jaw,chin=f["left"],f["right"],f["top"],f["jaw"],f["chin"]
    if character_id == "genta":
        points=[(left+2,top),(right-3,top),(right,top+8),(right,jaw-5),(right-5,jaw+2),(36,chin),(24,chin),(left,jaw-6),(left,top+8)]
    elif character_id == "lise":
        points=[(left+3,top),(right-4,top),(right+1,top+9),(right,jaw-4),
                (right-5,jaw+2),(38,chin),(28,chin),(left+1,jaw-4),(left,top+9)]
    elif character_id == "mateus":
        points=[(left+3,top),(right-4,top),(right,top+8),(right-1,jaw-2),(38,chin),(30,chin),(left+1,jaw-4),(left,top+9)]
    elif character_id == "aya":
        points=[(left+4,top),(right-4,top),(right,top+8),(right-1,jaw-3),(37,chin),(29,chin),(left+1,jaw-4),(left,top+8)]
    else:
        points=[(left+3,top),(right-4,top),(right,top+8),(right-1,jaw-3),(38,chin),(28,chin),(left,jaw-5),(left,top+8)]
    p.poly(points,"outline")
    inset=[(x+(1 if x<32 else -1),y+(1 if y<chin else -1)) for x,y in points]
    p.poly(inset,"skinShadow")
    p.poly([(left+4,top+3),(right-5,top+3),(right-2,top+10),(right-3,jaw-4),(36,chin-3),(29,chin-4),(left+3,jaw-7),(left+3,top+10)],"skin")
    p.poly([(right-8,top+5),(right-3,top+10),(right-4,jaw-7),(36,chin-4),(34,top+12)],"skinLight")
    p.line([(left+4,top+11),(left+3,jaw-9),(28,chin-5)],"faceDeep")
    return f


def draw_hair(p: Portrait, character_id: str, f: dict):
    left,right,top=f["left"],f["right"],f["top"]
    if character_id == "ren":
        p.poly([(left-1,top+9),(left+1,top-1),(right-6,top-4),(right+1,top+4),(right-3,top+10),(35,top+6),(30,top+10),(24,top+6),(left+2,top+15)],"hair")
        p.line([(21,14),(29,10),(38,11)],"light")
    elif character_id == "aya":
        p.poly([(left-3,top+8),(left+1,top-3),(right-6,top-5),(right+2,top+3),(right+3,34),(right-1,43),(right-4,28),(38,top+6),(31,top+2),(25,top+8),(22,40),(left-2,43)],"hair")
        p.rect((15,25,20,42),"hair"); p.rect((43,23,48,42),"hair")
        p.px(16,39,"accent")
    elif character_id == "lise":
        # Backswept dark hair exposes a high forehead and widow's peak.
        p.poly([(left-2,top+9),(left,top-1),(27,top-5),(39,top-4),
                (right+2,top+2),(right,top+8),(42,top+4),(36,top+2),
                (32,top+7),(27,top+3),(21,top+10)],"hair")
        p.line([(20,13),(29,7),(40,8),(46,12)],"light")
        p.rect((16,17,19,25),"hair")
    elif character_id == "mateus":
        p.poly([(left-1,top+9),(left+3,top-2),(30,top-4),(right-5,top-1),(right+1,top+7),(40,top+5),(35,top+1),(30,top+3),(24,top+9),(22,25)],"hair")
        p.line([(26,11),(32,8),(39,10)],"light")
    elif character_id == "genta":
        p.poly([(left-1,top+10),(left+1,top-2),(right-5,top-3),(right+1,top+5),(right,top+12),(42,top+7),(35,top+9),(27,top+5),(20,top+10)],"hair")
        p.rect((17,12,22,24),"hair"); p.rect((43,13,48,24),"hair")
        p.poly([(21,38),(27,42),(35,43),(43,38),(41,46),(36,50),(27,48),(22,44)],"hair")
    elif character_id == "kiku":
        p.poly([(left-3,top+10),(left+1,top-3),(right-6,top-4),(right+2,top+4),(right+1,31),(40,top+8),(33,top+4),(26,top+8),(21,34),(left-2,41)],"hair")
        p.rect((15,24,20,41),"hair"); p.poly([(43,20),(49,25),(48,34),(43,31)],"hair")
        p.rect((47,27,51,34),"accent")


def draw_features(p: Portrait, character_id: str, f: dict):
    eye_y,mouth_y=f["eyeY"],f["mouthY"]
    # Three-quarter nose and cheek clusters are stable; expression lives in brows/eyes/mouth.
    if p.expression == "resolve":
        p.line([(22,eye_y-4),(28,eye_y-2)],"hair",2); p.line([(35,eye_y-2),(41,eye_y-4)],"hair",2)
        p.rect((23,eye_y,28,eye_y+1),"eye"); p.rect((35,eye_y,40,eye_y+1),"eye")
        p.px(27,eye_y,"eyeLight"); p.px(39,eye_y,"eyeLight")
        p.line([(31,mouth_y),(39,mouth_y)],"lip",2)
    elif p.expression == "strain":
        p.line([(22,eye_y-3),(28,eye_y-5)],"hair",2); p.line([(35,eye_y-5),(41,eye_y-2)],"hair",2)
        p.line([(23,eye_y),(28,eye_y+1)],"eye",2); p.line([(35,eye_y+1),(40,eye_y)],"eye",2)
        p.line([(32,mouth_y-1),(39,mouth_y+2),(35,mouth_y+4)],"lip",2)
        p.px(20,eye_y+6,"skinLight"); p.px(19,eye_y+8,"dawn")
    elif p.expression == "soften":
        p.line([(22,eye_y-3),(28,eye_y-3)],"hair"); p.line([(35,eye_y-3),(41,eye_y-3)],"hair")
        p.line([(23,eye_y),(28,eye_y+1)],"eye",2); p.line([(35,eye_y+1),(40,eye_y)],"eye",2)
        p.px(27,eye_y,"eyeLight"); p.px(39,eye_y,"eyeLight")
        p.line([(32,mouth_y),(35,mouth_y+1),(39,mouth_y-1)],"lip",2)
        p.px(41,mouth_y-3,"cheek")
    elif p.expression == "concern":
        p.line([(22,eye_y-3),(28,eye_y-5)],"hair",2); p.line([(35,eye_y-5),(41,eye_y-3)],"hair",2)
        p.rect((23,eye_y,28,eye_y+2),"eye"); p.rect((35,eye_y,40,eye_y+2),"eye")
        p.px(27,eye_y,"eyeLight"); p.px(39,eye_y,"eyeLight")
        p.line([(32,mouth_y+1),(35,mouth_y),(39,mouth_y+2)],"lip",2)
        p.px(41,mouth_y-4,"cheek")
    elif p.expression == "anger":
        p.line([(21,eye_y-5),(28,eye_y-1)],"hair",2); p.line([(35,eye_y-1),(42,eye_y-5)],"hair",2)
        p.line([(23,eye_y+1),(29,eye_y)],"eye",2); p.line([(35,eye_y),(41,eye_y+1)],"eye",2)
        p.px(28,eye_y,"eyeLight"); p.px(36,eye_y,"eyeLight")
        p.line([(31,mouth_y),(40,mouth_y+1)],"lip",2)
        p.line([(30,mouth_y-2),(39,mouth_y-2)],"faceDeep")
    elif p.expression == "surprise":
        p.line([(22,eye_y-6),(28,eye_y-6)],"hair",2); p.line([(35,eye_y-6),(41,eye_y-6)],"hair",2)
        p.rect((23,eye_y-1,28,eye_y+3),"eye"); p.rect((35,eye_y-1,40,eye_y+3),"eye")
        p.rect((25,eye_y,27,eye_y+1),"eyeLight"); p.rect((37,eye_y,39,eye_y+1),"eyeLight")
        p.rect((33,mouth_y-1,39,mouth_y+4),"lip"); p.rect((35,mouth_y,37,mouth_y+2),"eye")
    elif p.expression == "quiet":
        p.line([(22,eye_y-2),(28,eye_y-2)],"hair"); p.line([(35,eye_y-2),(41,eye_y-2)],"hair")
        p.line([(23,eye_y+1),(28,eye_y+2)],"eye",2); p.line([(35,eye_y+2),(40,eye_y+1)],"eye",2)
        p.line([(33,mouth_y+1),(38,mouth_y+1)],"lip")
        p.px(31,mouth_y-2,"skinLight")
    else:
        p.line([(22,eye_y-3),(28,eye_y-3)],"hair"); p.line([(35,eye_y-3),(41,eye_y-3)],"hair")
        p.rect((23,eye_y,28,eye_y+1),"eye"); p.rect((35,eye_y,40,eye_y+1),"eye")
        p.px(27,eye_y,"eyeLight"); p.px(39,eye_y,"eyeLight")
        p.line([(32,mouth_y),(38,mouth_y)],"lip")
    p.line([(33,eye_y+2),(35,eye_y+7),(32,eye_y+9),(36,eye_y+9)],"skinShadow")
    p.px(40,eye_y+7,"skinLight")
    if character_id == "mateus":
        p.line([(23,eye_y+5),(25,eye_y+9)],"faceDeep")
        p.line([(40,eye_y+4),(41,eye_y+8)],"faceDeep")
    if character_id == "lise":
        # Narrow moustache and clipped pointed beard stay visible through all
        # eight expression mouths without masking their semantic shapes.
        p.line([(28,mouth_y-3),(33,mouth_y-2)],"hair",2)
        p.line([(36,mouth_y-2),(42,mouth_y-3)],"hair",2)
        p.line([(31,mouth_y+3),(36,mouth_y+6),(40,mouth_y+3)],"hair",2)
        p.rect((34,mouth_y+5,37,mouth_y+9),"hair")
        p.px(38,mouth_y+7,"hair")
    if character_id == "genta":
        p.line([(23,eye_y+6),(28,eye_y+8)],"faceDeep")


def render_portrait(field: dict, character_id: str, expression: str) -> Image.Image:
    portrait=Portrait(palette_for(field,character_id),expression)
    draw_shoulders(portrait,character_id)
    f=FACE[character_id]
    draw_neck(portrait,f)
    f=draw_face_shape(portrait,character_id)
    draw_hair(portrait,character_id,f)
    draw_features(portrait,character_id,f)
    alpha=portrait.image.getchannel("A"); bounds=alpha.getbbox()
    if not bounds: raise ValueError(f"empty portrait {character_id}:{expression}")
    if bounds[0]<GUTTER or bounds[1]<GUTTER or bounds[2]>CELL-GUTTER or bounds[3]>CELL-GUTTER:
        raise ValueError(f"gutter violation {character_id}:{expression} {bounds}")
    if set(alpha.getdata())-{0,255}: raise ValueError(f"non-binary alpha {character_id}:{expression}")
    return portrait.image


def render_atlas(source: dict, field: dict) -> tuple[Image.Image,list[dict]]:
    atlas=Image.new("RGBA",(CELL*len(COLUMNS),CELL*len(ROWS)),(0,0,0,0)); frames=[]
    by_id={entry["id"]:entry for entry in source["characters"]}
    for row,character_id in enumerate(ROWS):
        for column,expression in enumerate(COLUMNS):
            portrait=render_portrait(field,character_id,expression); x,y=column*CELL,row*CELL
            atlas.alpha_composite(portrait,(x,y)); contract=by_id[character_id]
            frames.append({
                "id":f"{character_id}:{expression}","characterId":character_id,"expression":expression,
                "rect":[x,y,CELL,CELL],"eyeLine":contract["anchors"]["eyeLine"],
                "mouthAnchor":contract["anchors"]["mouth"],"focusAnchor":contract["anchors"]["focus"],
                "expressionSemantic":source["expressions"][expression],
                "localAlphaBounds":list(portrait.getchannel("A").getbbox()),"rgbaSha256":sha256(portrait.tobytes()),
            })
    if len({frame["rgbaSha256"] for frame in frames})!=len(frames): raise ValueError("portrait cels must be distinct")
    return atlas,frames


FONT={
"A":("01110","10001","10001","11111","10001","10001","10001"),"C":("01111","10000","10000","10000","10000","10000","01111"),"E":("11111","10000","10000","11110","10000","10000","11111"),
"F":("11111","10000","10000","11110","10000","10000","10000"),"G":("01111","10000","10000","10111","10001","10001","01111"),
"I":("11111","00100","00100","00100","00100","00100","11111"),"K":("10001","10010","10100","11000","10100","10010","10001"),
"L":("10000","10000","10000","10000","10000","10000","11111"),"M":("10001","11011","10101","10101","10001","10001","10001"),
"N":("10001","11001","10101","10011","10001","10001","10001"),"O":("01110","10001","10001","10001","10001","10001","01110"),
"P":("11110","10001","10001","11110","10000","10000","10000"),"Q":("01110","10001","10001","10001","10101","10010","01101"),"R":("11110","10001","10001","11110","10100","10010","10001"),"S":("01111","10000","10000","01110","00001","00001","11110"),
"T":("11111","00100","00100","00100","00100","00100","00100"),"U":("10001","10001","10001","10001","10001","10001","01110"),
"V":("10001","10001","10001","10001","10001","01010","00100"),"Y":("10001","10001","01010","00100","00100","00100","00100"),
" ":("00000",)*7}


def label(draw,x,y,text,fill,scale=1):
    for letter in text.upper():
        glyph=FONT.get(letter,FONT[" "])
        for gy,row in enumerate(glyph):
            for gx,on in enumerate(row):
                if on=="1": draw.rectangle((x+gx*scale,y+gy*scale,x+(gx+1)*scale-1,y+(gy+1)*scale-1),fill=fill)
        x+=6*scale


def render_contact(atlas: Image.Image) -> Image.Image:
    scale,left,top=3,96,52; cw=ch=CELL*scale
    contact=Image.new("RGBA",(left+cw*len(COLUMNS)+16,top+ch*len(ROWS)+16),rgba("#0b1020")); draw=ImageDraw.Draw(contact)
    for column,text in enumerate(COLUMNS): label(draw,left+column*cw+12,18,text,rgba("#d7c99a"))
    for row,character_id in enumerate(ROWS):
        label(draw,8,top+row*ch+86,REVIEW_ROW_LABELS.get(character_id,character_id),rgba("#d7c99a"),2)
    for row in range(len(ROWS)):
        for column in range(len(COLUMNS)):
            x,y=left+column*cw,top+row*ch
            checker=Image.new("RGBA",(cw,ch),rgba("#16233a")); cd=ImageDraw.Draw(checker)
            for cy in range(0,ch,12):
                for cx in range(0,cw,12):
                    if (cx//12+cy//12)%2: cd.rectangle((cx,cy,cx+11,cy+11),fill=rgba("#202d3d"))
            contact.alpha_composite(checker,(x,y)); cel=atlas.crop((column*CELL,row*CELL,(column+1)*CELL,(row+1)*CELL)).resize((cw,ch),Image.Resampling.NEAREST)
            contact.alpha_composite(cel,(x,y)); draw.rectangle((x,y,x+cw-1,y+ch-1),outline=rgba("#27466b"))
            # Cyan cross records focus anchor on the review sheet only.
            focus=(35,27); px,py=x+focus[0]*scale,y+focus[1]*scale
            draw.line((px-3,py,px+3,py),fill=rgba("#88c8c5")); draw.line((px,py-3,px,py+3),fill=rgba("#88c8c5"))
    return contact


def build_files() -> dict[str,bytes]:
    source,field=load_contracts(); atlas,frames=render_atlas(source,field); contact=render_contact(atlas)
    atlas_data,contact_data=png_bytes(atlas),png_bytes(contact)
    palette_reuse={entry["id"]:{"paletteId":entry["paletteId"],"colors":entry["colors"],"silhouette":entry["silhouette"]} for entry in field["characters"]}
    manifest={
        "assetId":source["assetId"],"status":"editable-production-portrait-expression-suite","runtimeIntegration":"current-browser-camp-and-scene-focus","authorship":source["authorship"],
        "geometry":{"columns":len(COLUMNS),"rows":len(ROWS),"cellWidth":CELL,"cellHeight":CELL,"contentWidth":CELL*len(COLUMNS),"contentHeight":CELL*len(ROWS),"sheetWidth":atlas.width,"sheetHeight":atlas.height,"transparentRightPadding":atlas.width-CELL*len(COLUMNS),"minimumTransparentGutter":GUTTER},
        "rowOrder":list(ROWS),"columnOrder":list(COLUMNS),"expressionSemantics":source["expressions"],"paletteCostumeReuse":palette_reuse,
        "characterIdentity":{entry["id"]:{key:entry[key] for key in ("name","legacyCompatibilityId","lineage") if key in entry} for entry in source["characters"]},"frames":frames,
        "sources":[
            {"path":SOURCE_PATH.name,"role":"editable-portrait-contract","sha256":sha256(SOURCE_PATH.read_bytes())},
            {"path":source["canonicalFieldSource"],"role":"canonical-palette-costume-contract","sha256":sha256(FIELD_SOURCE_PATH.read_bytes())},
            {"path":Path(__file__).name,"role":"deterministic-builder","sha256":sha256(Path(__file__).read_bytes())}],
        "exports":[
            {"path":ATLAS_NAME,"role":"transparent-runtime-candidate","width":atlas.width,"height":atlas.height,"mode":atlas.mode,"sha256":sha256(atlas_data)},
            {"path":CONTACT_NAME,"role":"labeled-review-only-not-runtime","width":contact.width,"height":contact.height,"mode":contact.mode,"sha256":sha256(contact_data)}],
        "validation":{"frameCount":len(frames),"distinctRgbaFrameHashes":len({frame["rgbaSha256"] for frame in frames}),"binaryTransparency":True,"minimumObservedGutter":GUTTER,"deterministicCommand":"python build_party_portrait_suite.py --check"},
        "review":{"visualInspection":"pending","humanExpressionReadability":"pending","externalCulturalReview":"pending","mateusOriginalityConstraint":"applied"}}
    manifest_data=(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n").encode("utf-8")
    readme=f"""# Party portrait expression suite\n\nOriginal, code-authored portrait-scale redraws for Ren, Aya, Nikola, Mateus, Genta, and Kiku. The stable third-row key remains `lise` for runtime compatibility, but its pixels and NIKOLA review label present Nikola Dražanić with an original broad male face, high forehead, narrow moustache, clipped beard, oxblood doublet, and plain falling band. The deterministic builder reuses palette IDs, colors, and costume/silhouette motifs from `../party-field-suite/party-field-suite.source.json`; no generated concept or raster atlas is an input and no face uses a real-person likeness.\n\n- `{SOURCE_PATH.name}`: editable face-shape, costume, expression, and anchor contract.\n- `{ATLAS_NAME}`: transparent {atlas.width} × {atlas.height} runtime candidate; {len(ROWS)} rows × {len(COLUMNS)} columns × {CELL} × {CELL}, with no transparent reserve columns.\n- `{CONTACT_NAME}`: labeled {contact.width} × {contact.height} checkerboard review sheet; not for runtime use.\n- `{MANIFEST_NAME}`: exact frame rectangles, eye lines, mouth/focus anchors, expression semantics, source/export hashes, and review state.\n\nColumns are neutral, resolve, strain, soften, concern, anger, surprise, and quiet. These are the complete eight production expression keys; speaking in-betweens, human readability testing, and external cultural review remain pending.\n\nRun `python build_party_portrait_suite.py` to rebuild or `python build_party_portrait_suite.py --check` to byte-compare all generated outputs.\n"""
    readme=readme.replace(
        "oxblood doublet, and plain falling band.",
        "oxblood doublet, and plain falling band. He is a Croatian-born frontier minor aristocrat with English ancestry through his fictional mother Margaret Wychmere. His house claims a Wallachian covenant line repeatedly transmitted through noblewomen and marriage contracts; this is alternate-history fiction, not a real-world claim that vampires, vampire hunters, or the Covenant existed.",
    )
    return {ATLAS_NAME:atlas_data,CONTACT_NAME:contact_data,MANIFEST_NAME:manifest_data,README_NAME:readme.encode("utf-8")}


def main() -> int:
    parser=argparse.ArgumentParser(); parser.add_argument("--check",action="store_true"); args=parser.parse_args(); files=build_files()
    if args.check:
        stale=[name for name,data in files.items() if not (ROOT/name).exists() or (ROOT/name).read_bytes()!=data]
        if stale:
            for name in stale: print(f"stale or missing: {name}",file=sys.stderr)
            return 1
        print(f"OK: {len(files)} generated files are byte-identical"); return 0
    for name,data in files.items(): (ROOT/name).write_bytes(data); print(f"wrote {name}: {len(data)} bytes sha256={sha256(data)}")
    return 0


if __name__=="__main__": raise SystemExit(main())
