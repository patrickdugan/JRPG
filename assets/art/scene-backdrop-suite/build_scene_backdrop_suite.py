#!/usr/bin/env python3
"""Build the original deterministic Campaign scene-backdrop pixel suite."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
SOURCE_PATH = ROOT / "scene-backdrop-suite.source.json"
BUILDER_PATH = Path(__file__).resolve()
ATLAS_PATH = ROOT / "scene-backdrop-atlas.png"
CONTACT_PATH = ROOT / "scene-backdrop-contact-sheet.png"
MANIFEST_PATH = ROOT / "manifest.json"
README_PATH = ROOT / "README.md"
RUNTIME_PATH = REPO / "game" / "assets" / "art" / "scene-backdrop-suite" / ATLAS_PATH.name
FRAME_W, FRAME_H, COLUMNS, ROWS = 320, 180, 5, 4


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rgba(value: str) -> tuple[int, int, int, int]:
    value = value.removeprefix("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (255,)


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def stable_points(key: str, count: int, x0: int, y0: int, x1: int, y1: int) -> list[tuple[int, int]]:
    points = []
    for index in range(count):
        digest = hashlib.sha256(f"{key}:{index}".encode("utf-8")).digest()
        points.append((x0 + int.from_bytes(digest[:2], "big") % max(1, x1 - x0), y0 + int.from_bytes(digest[2:4], "big") % max(1, y1 - y0)))
    return points


def load_source() -> dict:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    geometry = source.get("geometry", {})
    if source.get("authorship") != "original-code-native-pixel-primitives":
        raise ValueError("Scene backdrops must retain original code-native authorship")
    if (geometry.get("frameWidth"), geometry.get("frameHeight"), geometry.get("columns"), geometry.get("rows")) != (FRAME_W, FRAME_H, COLUMNS, ROWS):
        raise ValueError("Scene-backdrop geometry drifted")
    records = source.get("backdrops", [])
    ids = [record.get("id") for record in records]
    beats = [beat for record in records for beat in record.get("beatIds", [])]
    if len(ids) != 20 or len(set(ids)) != 20:
        raise ValueError("Scene-backdrop source must contain 20 unique records")
    if len(beats) != 60 or len(set(beats)) != 60:
        raise ValueError("Scene-backdrop source must assign 60 unique beats")
    policy = source.get("renderPolicy", {})
    required_false = ("bakeActors", "bakeText", "bakeUi", "bakeSacredObjects", "bakeAuthenticHeraldry", "generatedConceptPixels", "externalPixels", "partialAlpha")
    if (not policy.get("presentationOnly") or policy.get("collisionAuthority") != "none"
            or policy.get("bakeVictimFixtures") is not True
            or any(policy.get(key) is not False for key in required_false)):
        raise ValueError("Scene-backdrop presentation boundaries drifted")
    restrictions = " ".join(source.get("restrictions", [])).lower()
    for phrase in ("no sacred", "no celebrity", "no pixels are sampled", "external japanese"):
        if phrase not in restrictions:
            raise ValueError(f"Missing scene-backdrop restriction: {phrase}")
    return source


def draw_weather(draw: ImageDraw.ImageDraw, record: dict, palette: dict) -> None:
    weather = record["weather"]
    if "rain" in weather or "storm" in weather:
        for x, y in stable_points(record["id"] + "-rain", 34, 2, 4, 318, 127):
            draw.line((x, y, x - 2, y + 4), fill=rgba(palette["edge"]))
    elif "ash" in weather or "draft" in weather:
        for x, y in stable_points(record["id"] + "-ash", 24, 4, 6, 316, 126):
            draw.point((x, y), fill=rgba(palette["edge"]))
    elif "mist" in weather or "fog" in weather or "seepage" in weather:
        for y in (38, 55, 72):
            offset = stable_points(record["id"] + str(y), 1, 0, 0, 18, 1)[0][0]
            draw.line((offset, y, min(319, offset + 112), y), fill=rgba(palette["far"]))


def draw_arch(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], palette: dict) -> None:
    x0, y0, x1, y1 = box
    draw.rectangle((x0, y0 + 18, x1, y1), fill=rgba(palette["shadow"]))
    draw.ellipse((x0, y0, x1, y0 + 42), fill=rgba(palette["edge"]))
    draw.ellipse((x0 + 7, y0 + 7, x1 - 7, y0 + 38), fill=rgba(palette["sky1"]))
    draw.rectangle((x0 + 7, y0 + 21, x1 - 7, y1), fill=rgba(palette["sky1"]))


def draw_roof(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, palette: dict, lit: bool = False) -> None:
    draw.polygon(((x - 5, y + 10), (x + w // 2, y), (x + w + 5, y + 10)), fill=rgba(palette["shadow"]))
    draw.rectangle((x, y + 10, x + w, y + h), fill=rgba(palette["cedar0"]))
    draw.rectangle((x + 5, y + 17, x + w - 5, y + h - 5), fill=rgba(palette["cedar1"]))
    if lit:
        draw.rectangle((x + w // 2 - 5, y + 18, x + w // 2 + 5, y + 29), fill=rgba(palette["light"]))


def draw_victim_fixture(draw: ImageDraw.ImageDraw, x: int, y: int, palette: dict, variant: int) -> None:
    """Draw a tiny fictional Kurohana execution fixture, never a live rule-layer actor."""
    timber = rgba(palette["cedar0"])
    outline = rgba(palette["edge"])
    garment = rgba(palette["far"] if variant % 3 else palette["paper"])
    wound = rgba(palette["alarm"])
    if variant % 2 == 0:
        draw.line((x, y, x, y + 25), fill=timber, width=2)
        draw.line((x - 6, y + 7, x + 6, y + 7), fill=timber, width=2)
        draw.rectangle((x - 1, y + 3, x + 1, y + 5), fill=outline)
        draw.line((x - 1, y + 7, x - 5, y + 10), fill=garment)
        draw.line((x + 1, y + 7, x + 5, y + 10), fill=garment)
        draw.rectangle((x - 2, y + 8, x + 2, y + 17), fill=garment)
        draw.line((x - 1, y + 17, x - 3, y + 22), fill=garment)
        draw.line((x + 1, y + 17, x + 3, y + 22), fill=garment)
        draw.point((x + (1 if variant % 4 else -1), y + 12), fill=wound)
    else:
        draw.line((x, y + 3, x, y + 27), fill=timber, width=2)
        draw.rectangle((x - 2, y + 4, x, y + 7), fill=outline)
        draw.line((x - 1, y + 8, x + 3, y + 16), fill=garment, width=2)
        draw.line((x + 2, y + 10, x + 5, y + 14), fill=garment)
        draw.line((x + 2, y + 16, x + 4, y + 22), fill=garment)
        draw.point((x, y + 15), fill=wound)


def draw_frame(record: dict, palette: dict, index: int) -> Image.Image:
    image = Image.new("RGBA", (FRAME_W, FRAME_H), rgba(palette["sky0"]))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 38, 319, 79), fill=rgba(palette["sky1"]))
    ridge = [(0, 75), (0, 62), (48, 46 + index % 7), (92, 61), (146, 42 + index % 9), (205, 60), (264, 47 + index % 5), (319, 64), (319, 79)]
    draw.polygon(ridge, fill=rgba(palette["far"]))
    draw.rectangle((0, 80, 319, 131), fill=rgba(palette["ground0"]))
    draw.rectangle((0, 132, 319, 179), fill=rgba(palette["ground1"]))
    draw.line((0, 132, 319, 132), fill=rgba(palette["edge"]))

    motif = record["motif"]
    if motif == "river-lane":
        draw_roof(draw, 10, 54, 78, 62, palette, True); draw_roof(draw, 232, 50, 74, 66, palette)
        draw.polygon(((115, 78), (205, 78), (244, 131), (72, 131)), fill=rgba(palette["water"]))
        draw.line((144, 68, 154, 78), fill=rgba(palette["accent"]), width=2); draw.rectangle((154, 78, 168, 94), fill=rgba(palette["accent"])); draw.rectangle((157, 81, 165, 91), fill=rgba(palette["light"]))
    elif motif == "record-room":
        draw.rectangle((12, 32, 308, 128), fill=rgba(palette["cedar0"])); draw.rectangle((22, 42, 102, 116), fill=rgba(palette["shadow"])); draw.rectangle((218, 42, 298, 116), fill=rgba(palette["shadow"]))
        for y in (58, 82, 106): draw.line((25, y, 99, y), fill=rgba(palette["cedar1"])); draw.line((221, y, 295, y), fill=rgba(palette["cedar1"]))
        draw.rectangle((106, 92, 214, 126), fill=rgba(palette["cedar1"])); draw.rectangle((132, 87, 190, 94), fill=rgba(palette["paper"])); draw.rectangle((158, 69, 165, 89), fill=rgba(palette["light"]))
    elif motif == "ferry-cedars":
        draw.rectangle((0, 92, 319, 131), fill=rgba(palette["water"]));
        for x in (30, 66, 244, 282): draw.rectangle((x, 40, x + 9, 116), fill=rgba(palette["cedar0"])); draw.line((x + 5, 42, x - 8, 72), fill=rgba(palette["cedar1"]))
        draw.polygon(((96, 103), (214, 103), (199, 116), (112, 116)), fill=rgba(palette["cedar1"])); draw.rectangle((154, 75, 158, 104), fill=rgba(palette["accent"]))
    elif motif == "tax-storehouse":
        draw.rectangle((8, 36, 312, 128), fill=rgba(palette["cedar0"]));
        for x in (18, 94, 218, 294): draw.rectangle((x, 38, x + 8, 128), fill=rgba(palette["shadow"]))
        draw.rectangle((84, 91, 236, 126), fill=rgba(palette["cedar1"])); draw.rectangle((111, 86, 184, 93), fill=rgba(palette["paper"])); draw.rectangle((245, 97, 267, 124), fill=rgba(palette["shadow"])); draw.rectangle((250, 103, 262, 114), fill=rgba(palette["alarm"]))
    elif motif == "registry-gate":
        draw.rectangle((54, 44, 266, 122), fill=rgba(palette["cedar0"])); draw.rectangle((72, 58, 248, 122), fill=rgba(palette["sky1"])); draw.rectangle((44, 40, 276, 50), fill=rgba(palette["shadow"])); draw.rectangle((78, 66, 132, 115), fill=rgba(palette["paper"])); draw.rectangle((188, 72, 238, 115), fill=rgba(palette["cedar1"])); draw.line((20, 126, 300, 126), fill=rgba(palette["water"]), width=3)
    elif motif == "undercrypt":
        for x in (18, 102, 186, 270): draw_arch(draw, (x, 42, x + 66, 128), palette)
        draw.rectangle((0, 112, 319, 131), fill=rgba(palette["water"])); draw.rectangle((142, 68, 178, 110), fill=rgba(palette["shadow"]));
        for x in range(146, 178, 8): draw.line((x, 70, x, 108), fill=rgba(palette["accent"]))
    elif motif == "market-customs":
        for x, w, lit in ((8, 70, True), (87, 62, False), (226, 82, True)): draw_roof(draw, x, 58, w, 61, palette, lit)
        draw.rectangle((154, 76, 218, 122), fill=rgba(palette["cedar0"])); draw.rectangle((161, 86, 211, 91), fill=rgba(palette["paper"])); draw.rectangle((25, 117, 292, 126), fill=rgba(palette["accent"]))
    elif motif == "rain-docks":
        draw.rectangle((0, 93, 319, 131), fill=rgba(palette["water"])); draw.rectangle((18, 104, 268, 116), fill=rgba(palette["cedar1"])); draw.line((244, 43, 244, 106), fill=rgba(palette["accent"]), width=4); draw.line((244, 44, 287, 70), fill=rgba(palette["accent"]), width=3); draw.polygon(((74, 109), (151, 109), (137, 123), (87, 123)), fill=rgba(palette["shadow"])); draw_roof(draw, 252, 69, 58, 50, palette, True)
    elif motif == "fog-shore":
        draw.rectangle((0, 104, 319, 131), fill=rgba(palette["water"])); draw_roof(draw, 18, 70, 62, 51, palette, True); draw_roof(draw, 238, 66, 66, 55, palette)
        draw.line((112, 65, 112, 116), fill=rgba(palette["cedar1"]), width=3); draw.line((112, 70, 174, 112), fill=rgba(palette["edge"])); draw.line((174, 70, 112, 112), fill=rgba(palette["edge"])); draw.polygon(((175, 112), (229, 112), (220, 123), (183, 123)), fill=rgba(palette["cedar0"]))
    elif motif == "tide-wreck":
        draw.ellipse((-34, 18, 354, 230), fill=rgba(palette["shadow"])); draw.ellipse((16, 38, 304, 190), fill=rgba(palette["sky1"])); draw.rectangle((0, 110, 319, 131), fill=rgba(palette["water"])); draw.polygon(((72, 112), (247, 94), (225, 125), (95, 125)), fill=rgba(palette["cedar0"]));
        for x in range(105, 225, 24): draw.line((x, 69, x + 8, 119), fill=rgba(palette["cedar1"]), width=3)
        draw.rectangle((242, 105, 266, 124), fill=rgba(palette["accent"])); draw.rectangle((246, 109, 262, 112), fill=rgba(palette["paper"]))
    elif motif == "relay-ash":
        draw_roof(draw, 190, 62, 104, 63, palette, True); draw.rectangle((35, 102, 109, 123), fill=rgba(palette["cedar1"])); draw.ellipse((40, 118, 57, 131), outline=rgba(palette["shadow"]), width=3); draw.ellipse((87, 118, 104, 131), outline=rgba(palette["shadow"]), width=3); draw.rectangle((143, 102, 151, 126), fill=rgba(palette["accent"])); draw.line((132, 104, 162, 104), fill=rgba(palette["edge"]), width=3)
    elif motif == "forge-archive":
        draw.rectangle((10, 35, 310, 129), fill=rgba(palette["shadow"])); draw.rectangle((25, 58, 91, 123), fill=rgba(palette["cedar0"])); draw.rectangle((229, 58, 295, 123), fill=rgba(palette["cedar0"])); draw.rectangle((115, 60, 205, 125), fill=rgba(palette["ground1"]));
        for x in (127, 151, 175, 199): draw.line((x, 66, x, 118), fill=rgba(palette["edge"]), width=3)
        draw.rectangle((140, 94, 180, 119), fill=rgba(palette["alarm"])); draw.rectangle((145, 99, 175, 106), fill=rgba(palette["light"])); draw.rectangle((34, 74, 78, 80), fill=rgba(palette["paper"]))
    elif motif == "printmaker-lane":
        draw_roof(draw, 8, 58, 88, 64, palette, True); draw_roof(draw, 224, 54, 88, 68, palette); draw.rectangle((102, 90, 218, 126), fill=rgba(palette["water"])); draw.rectangle((32, 91, 81, 119), fill=rgba(palette["cedar1"]));
        for y in (95, 105, 115): draw.rectangle((39, y, 74, y + 4), fill=rgba(palette["paper"]))
        draw.polygon(((119, 111), (184, 111), (173, 123), (128, 123)), fill=rgba(palette["cedar0"]))
    elif motif == "tribunal-roof":
        draw.rectangle((74, 60, 246, 124), fill=rgba(palette["cedar0"])); draw.polygon(((54, 66), (160, 38), (266, 66)), fill=rgba(palette["shadow"]));
        for x in range(68, 253, 18): draw.line((x, 64, x + 12, 56), fill=rgba(palette["edge"]))
        for x in (92, 132, 172, 212): draw.rectangle((x, 74, x + 8, 122), fill=rgba(palette["cedar1"]))
        draw.rectangle((0, 119, 319, 131), fill=rgba(palette["water"])); draw.rectangle((260, 104, 303, 119), fill=rgba(palette["accent"]))
    elif motif == "hushroad-camp":
        draw_roof(draw, 8, 72, 74, 50, palette); draw_roof(draw, 240, 70, 70, 52, palette); draw.rectangle((112, 97, 208, 124), fill=rgba(palette["cedar1"])); draw.rectangle((130, 90, 188, 99), fill=rgba(palette["paper"])); draw.rectangle((156, 108, 165, 123), fill=rgba(palette["alarm"])); draw.rectangle((158, 103, 163, 111), fill=rgba(palette["light"]))
    elif motif == "aqueduct":
        for x in (8, 86, 164, 242): draw_arch(draw, (x, 42, x + 70, 128), palette)
        draw.rectangle((0, 111, 319, 131), fill=rgba(palette["water"])); draw.line((30, 64, 30, 116), fill=rgba(palette["accent"]), width=3); draw.line((290, 64, 290, 116), fill=rgba(palette["accent"]), width=3)
    elif motif == "gate-planning":
        draw.rectangle((12, 38, 308, 128), fill=rgba(palette["cedar0"])); draw.rectangle((58, 88, 262, 126), fill=rgba(palette["cedar1"]));
        for x in (84, 128, 172, 216): draw.rectangle((x, 82, x + 28, 91), fill=rgba(palette["paper"]))
        for x in (36, 278): draw.rectangle((x, 61, x + 6, 110), fill=rgba(palette["accent"])); draw.rectangle((x - 4, 66, x + 10, 82), fill=rgba(palette["light"]))
    elif motif == "black-gate":
        draw.polygon(((0, 131), (100, 86), (220, 86), (319, 131)), fill=rgba(palette["ground0"])); draw.rectangle((78, 38, 242, 112), fill=rgba(palette["shadow"])); draw.rectangle((108, 56, 212, 112), fill=rgba(palette["sky0"])); draw.rectangle((70, 34, 250, 45), fill=rgba(palette["cedar0"]));
        for x in (72, 240): draw.rectangle((x, 82, x + 6, 126), fill=rgba(palette["accent"])); draw.rectangle((x - 4, 88, x + 10, 104), fill=rgba(palette["light"]))
        draw.polygon(((150, 52), (159, 47), (168, 52), (164, 58), (153, 57)), fill=rgba(palette["alarm"]))
        for fixture_index, x in enumerate((20, 38, 56, 88, 104, 216, 232, 264, 282, 300)):
            draw_victim_fixture(draw, x, 91 + fixture_index % 3, palette, fixture_index)
    elif motif == "living-archive":
        draw.rectangle((8, 28, 312, 129), fill=rgba(palette["shadow"]));
        for x in (22, 74, 238, 290): draw.rectangle((x, 38, x + 12, 124), fill=rgba(palette["cedar0"]));
        for y in (58, 82, 106): draw.line((25, y, 92, y), fill=rgba(palette["edge"])); draw.line((228, y, 300, y), fill=rgba(palette["edge"]))
        draw.polygon(((118, 43), (202, 43), (188, 116), (132, 116)), fill=rgba(palette["sky1"])); draw.line((160, 45, 160, 114), fill=rgba(palette["alarm"]), width=3); draw.rectangle((151, 79, 169, 101), outline=rgba(palette["accent"]), width=3); draw.rectangle((174, 49, 186, 112), fill=rgba(palette["light"]))
        for fixture_index, x in enumerate((18, 34, 50, 66, 82, 98, 112, 126, 140, 180, 194, 208, 222, 238, 254, 270, 286, 302)):
            draw_victim_fixture(draw, x, 91 + fixture_index % 4, palette, fixture_index)
    elif motif == "daybreak-repair":
        draw.rectangle((0, 30, 103, 128), fill=rgba(palette["cedar0"])); draw.rectangle((108, 42, 211, 128), fill=rgba(palette["cedar1"])); draw.rectangle((216, 24, 319, 128), fill=rgba(palette["far"]));
        for y in (54, 78, 102): draw.line((12, y, 91, y), fill=rgba(palette["paper"]), width=4)
        draw.rectangle((128, 70, 194, 119), fill=rgba(palette["shadow"])); draw.rectangle((143, 83, 179, 111), fill=rgba(palette["light"])); draw.rectangle((254, 42, 278, 120), fill=rgba(palette["cedar0"])); draw.line((230, 52, 302, 52), fill=rgba(palette["accent"]), width=3); draw.line((232, 90, 300, 90), fill=rgba(palette["accent"]), width=3)
    else:
        raise ValueError(f"Unsupported scene-backdrop motif: {motif}")

    draw_weather(draw, record, palette)
    # The dialogue UI and portrait overlay own this deliberately quiet band.
    draw.rectangle((0, 133, 319, 179), fill=rgba(palette["ground1"]))
    draw.line((0, 132, 319, 132), fill=rgba(palette["edge"]))
    if image.getchannel("A").getextrema() != (255, 255):
        raise ValueError(f"Backdrop must be fully opaque: {record['id']}")
    return image


def readme_bytes() -> bytes:
    return ("""# Campaign scene-backdrop suite

This package contains 20 original, deterministic 320 x 180 pixel panoramas mapped explicitly to all 60 Campaign beats. The atlas is decorative presentation beneath the existing portrait, atmosphere, dialogue, choices, and accessibility text. It never defines a field map, collision, route, encounter, objective, timing, or save state. The Black Gate and Chapter 9 panoramas contain 10 and 18 code-native fictional Kirishitan victim fixtures respectively, supporting Kurohana's authored mass-execution processional without becoming rule-layer actors.

`scene-backdrop-suite.source.json` owns the motif, beat, palette, safe-area, and cultural boundaries. `build_scene_backdrop_suite.py` uses only integer-coordinate Pillow primitives and creates the runtime atlas, a half-scale labeled review sheet, this manifest, and the byte-identical browser copy. Run it with `--check` for a non-writing deterministic receipt.

No frame contains live combat or NPC actors, lettering, readable records, sacred objects, devotional symbols, authentic heraldry, real-person likenesses, imported concept pixels, or copied franchise compositions. Execution beams are killing structures, not devotional crosses; the victim silhouettes are fictional, evidence-bound, and subject to external Japanese Christianity and historical-persecution review. This package is not art-locked.
""").encode("utf-8")


def build_outputs(source: dict) -> dict[Path, bytes]:
    atlas = Image.new("RGBA", (FRAME_W * COLUMNS, FRAME_H * ROWS), (0, 0, 0, 255))
    frames = []
    frame_images = []
    hashes = set()
    for index, record in enumerate(source["backdrops"]):
        frame = draw_frame(record, source["paletteFamilies"][record["paletteFamily"]], index)
        raw_hash = sha256(frame.tobytes())
        if raw_hash in hashes:
            raise ValueError(f"Duplicate scene backdrop: {record['id']}")
        hashes.add(raw_hash)
        x, y = index % COLUMNS * FRAME_W, index // COLUMNS * FRAME_H
        atlas.alpha_composite(frame, (x, y))
        frame_images.append(frame)
        frames.append({
            "id": record["id"], "index": index, "rect": [x, y, FRAME_W, FRAME_H],
            "paletteFamily": record["paletteFamily"], "beatIds": record["beatIds"],
            "victimFixtureCount": record.get("victimFixtureCount", 0),
            "rgbaSha256": raw_hash, "opaqueBounds": [0, 0, FRAME_W, FRAME_H],
            "colorCount": len(set(frame.getdata())),
        })
    atlas_data = png_bytes(atlas)

    contact = Image.new("RGBA", (800, 440), rgba("#111827"))
    contact_draw = ImageDraw.Draw(contact)
    font = ImageFont.load_default()
    for index, (record, frame) in enumerate(zip(source["backdrops"], frame_images)):
        x, y = index % COLUMNS * 160, index // COLUMNS * 110
        contact.alpha_composite(frame.resize((160, 90), Image.Resampling.NEAREST), (x, y))
        contact_draw.rectangle((x, y + 90, x + 159, y + 109), fill=rgba("#111827"))
        contact_draw.text((x + 3, y + 95), record["id"], font=font, fill=rgba("#F6E8B9"))
    contact_data = png_bytes(contact)
    manifest = {
        "schemaVersion": 1,
        "assetId": source["assetId"],
        "status": "production-foundation-review",
        "authorship": source["authorship"],
        "sourceSha256": sha256(SOURCE_PATH.read_bytes()),
        "builderSha256": sha256(BUILDER_PATH.read_bytes()),
        "geometry": source["geometry"],
        "coverage": {"backdropCount": 20, "mappedBeatCount": 60, "unmappedBeatIds": [], "duplicateBeatAssignments": [], "distinctFrameHashes": len(hashes)},
        "frames": frames,
        "exports": [
            {"file": ATLAS_PATH.name, "purpose": "opaque-runtime-atlas", "width": atlas.width, "height": atlas.height, "mode": atlas.mode, "sha256": sha256(atlas_data)},
            {"file": CONTACT_PATH.name, "purpose": "half-scale-labeled-review-only", "width": contact.width, "height": contact.height, "mode": contact.mode, "sha256": sha256(contact_data)},
        ],
        "twoIndependentRendersByteIdentical": True,
        "runtimeProductionByteIdentical": True,
        "externalCulturalReview": "pending",
        "artLock": False,
        "renderPolicy": source["renderPolicy"],
        "restrictions": source["restrictions"],
    }
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return {ATLAS_PATH: atlas_data, CONTACT_PATH: contact_data, MANIFEST_PATH: manifest_data, README_PATH: readme_bytes(), RUNTIME_PATH: atlas_data}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify checked-in outputs without writing")
    args = parser.parse_args()
    source = load_source()
    first = build_outputs(source)
    second = build_outputs(source)
    if first != second:
        raise ValueError("Independent scene-backdrop renders are not byte-identical")
    if args.check:
        stale = [str(path) for path, expected in first.items() if not path.exists() or path.read_bytes() != expected]
        if stale:
            print("stale or missing: " + ", ".join(stale), file=sys.stderr)
            return 1
        print("scene backdrop suite is deterministic and current")
        return 0
    for path, data in first.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    print(f"wrote {len(first)} scene-backdrop outputs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
