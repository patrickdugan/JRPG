#!/usr/bin/env python3
"""Build the deterministic campaign-combat status VFX atlas and review sheet."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "status-vfx-suite.source.json"
ATLAS_PATH = ROOT / "status-vfx-atlas.png"
CONTACT_PATH = ROOT / "status-vfx-contact-sheet.png"
MANIFEST_PATH = ROOT / "manifest.json"
STATES = ("apply", "active", "expire")
STATUSES = ("dread", "chill", "shock", "scorch", "bound", "overheated")


def rgba(value: str) -> tuple[int, int, int, int]:
    value = value.removeprefix("#")
    if len(value) != 6:
        raise ValueError(f"Expected six-digit color, got {value!r}")
    return tuple(int(value[offset:offset + 2], 16) for offset in (0, 2, 4)) + (255,)


def load_source() -> dict:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    expected_geometry = {
        "columns": 3,
        "rows": 6,
        "cellWidth": 32,
        "cellHeight": 32,
        "minimumTransparentGutter": 3,
        "coordinateOrigin": "top-left",
    }
    if source.get("geometry") != expected_geometry:
        raise ValueError("Status VFX geometry must remain the exact 3 x 6 native grid")
    if tuple(item.get("id") for item in source.get("states", [])) != STATES:
        raise ValueError("State order must be apply, active, expire")
    if tuple(item.get("id") for item in source.get("statuses", [])) != STATUSES:
        raise ValueError("Status rows must match the six live campaign statuses")
    if [item.get("row") for item in source["statuses"]] != list(range(6)):
        raise ValueError("Status rows must be consecutive")
    forbidden_terms = (
        "torii", "kamon", "coat of arms", "crucifix", "mandala", "shimenawa",
        "rosary", "reliquary", "sutra", "shrine", "real-world emblem",
    )
    for status in source["statuses"]:
        if set(status.get("palette", {})) != {"shade", "body", "bright", "pale"}:
            raise ValueError(f"Incomplete palette for {status['id']}")
        if set(status.get("anchors", {})) != set(STATES):
            raise ValueError(f"Incomplete state anchors for {status['id']}")
        design_copy = f"{status.get('name', '')} {status.get('motif', '')}".lower()
        if any(term in design_copy for term in forbidden_terms):
            raise ValueError(f"Restricted design term in {status['id']}")
        for state, anchors in status["anchors"].items():
            if set(anchors) != {"pivot", "actorAnchor"}:
                raise ValueError(f"Incomplete anchors for {status['id']}:{state}")
            for point in anchors.values():
                if (
                    not isinstance(point, list) or len(point) != 2
                    or any(not isinstance(value, int) for value in point)
                    or not 0 <= point[0] < 32 or not 0 <= point[1] < 32
                ):
                    raise ValueError(f"Invalid anchor for {status['id']}:{state}")
    if not any("no status-cleanse event" in item for item in source.get("unsupportedSignals", [])):
        raise ValueError("The absent cleanse signal must remain explicit")
    return source


class PixelSurface:
    """Native-resolution integer-only RGBA surface."""

    def __init__(self, palette: dict[str, str]):
        self.image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)
        self.colors = {name: rgba(value) for name, value in palette.items()}

    def rect(self, box: tuple[int, int, int, int], color: str) -> None:
        self.draw.rectangle(box, fill=self.colors[color])

    def polygon(self, points: list[tuple[int, int]], color: str) -> None:
        self.draw.polygon(points, fill=self.colors[color])

    def line(self, points: list[tuple[int, int]], color: str, width: int = 1) -> None:
        self.draw.line(points, fill=self.colors[color], width=width)


def draw_dread(s: PixelSurface, state: str) -> None:
    if state == "apply":
        s.polygon([(16, 5), (24, 11), (21, 23), (16, 27), (10, 22), (8, 11)], "body")
        s.polygon([(16, 8), (21, 12), (18, 16), (21, 21), (16, 24), (12, 20), (14, 16), (11, 12)], "bright")
        s.polygon([(14, 12), (16, 10), (18, 12), (16, 16)], "shade")
        s.rect((4, 14, 7, 17), "pale"); s.rect((25, 10, 27, 13), "bright")
    elif state == "active":
        s.polygon([(16, 7), (23, 12), (20, 23), (16, 26), (10, 22), (9, 12)], "shade")
        s.polygon([(16, 9), (20, 13), (18, 17), (20, 21), (16, 23), (13, 20), (14, 16), (12, 13)], "body")
        s.rect((15, 12, 17, 18), "bright"); s.rect((16, 21, 18, 23), "pale")
    else:
        s.polygon([(5, 9), (10, 7), (12, 12), (8, 15)], "body")
        s.polygon([(21, 6), (27, 10), (23, 15), (19, 11)], "bright")
        s.polygon([(7, 21), (12, 17), (15, 24), (10, 27)], "bright")
        s.polygon([(20, 18), (27, 21), (24, 27), (18, 23)], "body")
        s.rect((15, 14, 17, 17), "shade")


def draw_chill(s: PixelSurface, state: str) -> None:
    if state == "apply":
        s.polygon([(16, 4), (20, 11), (18, 16), (22, 24), (16, 28), (12, 20), (13, 15), (9, 9)], "body")
        s.polygon([(16, 7), (18, 12), (16, 16), (18, 22), (16, 25), (14, 19), (15, 14), (12, 10)], "pale")
        s.polygon([(5, 16), (10, 13), (12, 18), (8, 21)], "bright")
        s.polygon([(22, 9), (27, 12), (24, 17), (20, 14)], "bright")
    elif state == "active":
        s.polygon([(15, 6), (20, 11), (18, 16), (22, 22), (16, 27), (12, 21), (13, 16), (9, 11)], "shade")
        s.polygon([(15, 9), (18, 12), (16, 16), (19, 21), (16, 24), (14, 19), (15, 15), (12, 12)], "bright")
        s.rect((16, 11, 17, 14), "pale"); s.rect((13, 20, 15, 22), "body")
    else:
        s.polygon([(5, 8), (11, 6), (12, 13), (7, 15)], "bright")
        s.polygon([(21, 5), (27, 9), (23, 14), (19, 11)], "body")
        s.polygon([(6, 21), (11, 17), (15, 23), (10, 27)], "body")
        s.polygon([(21, 18), (27, 22), (23, 27), (18, 23)], "pale")
        s.rect((15, 14, 18, 17), "shade")


def draw_shock(s: PixelSurface, state: str) -> None:
    if state == "apply":
        s.polygon([(17, 4), (10, 14), (15, 14), (11, 26), (22, 12), (17, 12), (22, 4)], "bright")
        s.polygon([(18, 7), (14, 12), (18, 12), (15, 20), (20, 11), (17, 11), (20, 7)], "pale")
        s.rect((4, 8, 7, 11), "body"); s.rect((24, 19, 27, 22), "body")
        s.rect((5, 23, 8, 26), "shade")
    elif state == "active":
        s.polygon([(17, 6), (11, 15), (16, 15), (12, 25), (21, 13), (17, 13), (21, 6)], "body")
        s.polygon([(18, 9), (15, 13), (18, 13), (15, 20), (19, 14), (17, 14), (20, 9)], "pale")
        s.rect((8, 10, 11, 13), "bright"); s.rect((21, 20, 24, 23), "bright")
    else:
        s.polygon([(5, 6), (11, 8), (8, 14), (4, 12)], "body")
        s.polygon([(21, 5), (27, 7), (24, 14), (20, 11)], "bright")
        s.polygon([(7, 20), (13, 17), (11, 26), (5, 24)], "bright")
        s.polygon([(21, 18), (27, 22), (23, 27), (18, 23)], "body")
        s.rect((15, 14, 17, 17), "pale")


def draw_scorch(s: PixelSurface, state: str) -> None:
    if state == "apply":
        s.polygon([(16, 4), (22, 12), (20, 17), (24, 22), (20, 28), (11, 27), (8, 21), (12, 15), (11, 9)], "body")
        s.polygon([(16, 8), (19, 13), (17, 17), (20, 21), (18, 25), (13, 24), (11, 21), (15, 16), (14, 12)], "bright")
        s.rect((15, 18, 18, 22), "shade"); s.rect((16, 13, 18, 16), "pale")
        s.rect((5, 10, 8, 13), "bright"); s.rect((24, 8, 27, 11), "body")
    elif state == "active":
        s.polygon([(16, 7), (21, 13), (19, 17), (22, 22), (18, 27), (12, 26), (9, 21), (13, 16), (12, 11)], "shade")
        s.polygon([(16, 10), (18, 14), (16, 18), (19, 21), (17, 24), (13, 23), (12, 21), (15, 16), (14, 13)], "body")
        s.rect((15, 17, 18, 21), "bright"); s.rect((16, 13, 17, 15), "pale")
    else:
        s.polygon([(6, 6), (11, 10), (9, 15), (4, 12)], "bright")
        s.polygon([(21, 5), (27, 9), (24, 14), (19, 11)], "body")
        s.polygon([(5, 21), (11, 17), (14, 24), (9, 27)], "body")
        s.polygon([(20, 18), (27, 21), (24, 27), (18, 24)], "bright")
        s.rect((15, 14, 18, 18), "shade")


def draw_bound(s: PixelSurface, state: str) -> None:
    if state == "apply":
        s.rect((5, 8, 11, 23), "body"); s.rect((20, 7, 26, 22), "body")
        s.rect((8, 11, 23, 16), "bright"); s.rect((9, 19, 22, 24), "bright")
        s.rect((11, 13, 20, 22), "shade"); s.rect((13, 15, 18, 19), "pale")
        s.rect((4, 5, 7, 8), "pale"); s.rect((25, 24, 28, 27), "body")
    elif state == "active":
        s.rect((7, 8, 12, 24), "shade"); s.rect((20, 8, 25, 24), "shade")
        s.rect((10, 11, 22, 16), "body"); s.rect((10, 19, 22, 24), "body")
        s.rect((12, 13, 20, 21), "bright"); s.rect((14, 15, 18, 19), "shade")
        s.rect((8, 10, 10, 13), "pale"); s.rect((22, 20, 24, 23), "pale")
    else:
        s.rect((4, 7, 10, 12), "body"); s.rect((6, 13, 11, 17), "bright")
        s.rect((22, 6, 28, 11), "bright"); s.rect((20, 12, 25, 16), "body")
        s.rect((5, 22, 11, 27), "bright"); s.rect((12, 19, 16, 24), "body")
        s.rect((21, 21, 27, 26), "body"); s.rect((17, 18, 22, 22), "bright")
        s.rect((14, 14, 18, 18), "shade")


def draw_overheated(s: PixelSurface, state: str) -> None:
    if state == "apply":
        s.rect((9, 12, 23, 26), "body"); s.rect((12, 15, 20, 23), "shade")
        s.rect((14, 17, 18, 21), "pale"); s.rect((10, 10, 14, 13), "bright")
        s.polygon([(11, 10), (8, 7), (11, 4), (14, 8)], "bright")
        s.polygon([(19, 11), (17, 7), (20, 4), (23, 9)], "pale")
        s.rect((5, 18, 8, 22), "bright"); s.rect((24, 14, 27, 18), "body")
    elif state == "active":
        s.rect((9, 12, 23, 26), "shade"); s.rect((11, 14, 21, 24), "body")
        s.rect((14, 17, 18, 21), "bright"); s.rect((15, 18, 17, 20), "pale")
        s.polygon([(11, 12), (9, 8), (12, 5), (15, 10)], "body")
        s.polygon([(18, 12), (17, 8), (20, 5), (23, 10)], "bright")
    else:
        s.rect((13, 13, 19, 19), "shade")
        s.polygon([(5, 6), (11, 8), (9, 14), (4, 12)], "bright")
        s.polygon([(21, 5), (27, 8), (24, 14), (19, 11)], "body")
        s.rect((5, 21, 11, 26), "body"); s.rect((9, 18, 14, 22), "bright")
        s.rect((21, 20, 27, 25), "bright"); s.rect((18, 17, 23, 21), "body")


DRAWERS = {
    "dread": draw_dread,
    "chill": draw_chill,
    "shock": draw_shock,
    "scorch": draw_scorch,
    "bound": draw_bound,
    "overheated": draw_overheated,
}


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def ihdr(data: bytes) -> dict:
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("Invalid PNG signature or missing IHDR")
    width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(
        ">IIBBBBB", data[16:29]
    )
    return {
        "width": width,
        "height": height,
        "bitDepth": bit_depth,
        "colorType": color_type,
        "compression": compression,
        "filter": filtering,
        "interlace": interlace,
    }


def frame_metadata(image: Image.Image, status: dict, state: dict) -> dict:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError(f"Empty frame {status['id']}:{state['id']}")
    left, top, right, bottom = bbox
    gutters = {"left": left, "top": top, "right": 32 - right, "bottom": 32 - bottom}
    if min(gutters.values()) < SOURCE["geometry"]["minimumTransparentGutter"]:
        raise ValueError(f"Insufficient gutter in {status['id']}:{state['id']}: {gutters}")
    opaque_pixels = sum(1 for value in alpha.getdata() if value)
    if opaque_pixels < 24:
        raise ValueError(f"Frame {status['id']}:{state['id']} is too sparse")
    anchors = status["anchors"][state["id"]]
    return {
        "id": f"{status['id']}:{state['id']}",
        "statusId": status["id"],
        "statusName": status["name"],
        "state": state["id"],
        "tag": state["tag"],
        "row": status["row"],
        "column": state["column"],
        "rect": {"x": state["column"] * 32, "y": status["row"] * 32, "width": 32, "height": 32},
        "pivot": anchors["pivot"],
        "actorAnchor": anchors["actorAnchor"],
        "alphaBounds": {"x": left, "y": top, "width": right - left, "height": bottom - top},
        "transparentGutter": gutters,
        "opaquePixelCount": opaque_pixels,
        "rgbaSha256": sha256(image.tobytes()),
        "alphaSha256": sha256(alpha.tobytes()),
    }


def build_contact_sheet(atlas: Image.Image) -> Image.Image:
    scale = 4
    frame_width = 32 * scale + 8
    row_height = 32 * scale + 28
    width = 16 + frame_width * len(STATES)
    height = 28 + row_height * len(STATUSES)
    sheet = Image.new("RGB", (width, height), (11, 16, 32))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((8, 7), "STATUS VFX - 4X NEAREST REVIEW / NOT RUNTIME", fill=(215, 201, 154), font=font)
    for status in SOURCE["statuses"]:
        row_y = 28 + status["row"] * row_height
        draw.rectangle((4, row_y, width - 5, row_y + row_height - 4), outline=(39, 70, 107), width=1)
        draw.text((8, row_y + 5), f"{status['row'] + 1:02d}  {status['name'].upper()}", fill=(246, 232, 185), font=font)
        for state in SOURCE["states"]:
            cell_x = 8 + state["column"] * frame_width
            draw.text((cell_x, row_y + 18), state["id"].upper(), fill=(136, 200, 197), font=font)
            frame = atlas.crop((
                state["column"] * 32, status["row"] * 32,
                (state["column"] + 1) * 32, (status["row"] + 1) * 32,
            ))
            scaled = frame.resize((128, 128), Image.Resampling.NEAREST)
            sheet.paste(scaled.convert("RGB"), (cell_x, row_y + 28), scaled.getchannel("A"))
    return sheet


def build_artifacts() -> dict[str, bytes]:
    atlas = Image.new("RGBA", (96, 192), (0, 0, 0, 0))
    frames = []
    alpha_hashes = set()
    for status in SOURCE["statuses"]:
        for state in SOURCE["states"]:
            surface = PixelSurface(status["palette"])
            DRAWERS[status["id"]](surface, state["id"])
            alpha_hash = sha256(surface.image.getchannel("A").tobytes())
            if alpha_hash in alpha_hashes:
                raise ValueError(f"Repeated shape vocabulary at {status['id']}:{state['id']}")
            alpha_hashes.add(alpha_hash)
            frames.append(frame_metadata(surface.image, status, state))
            atlas.alpha_composite(surface.image, (state["column"] * 32, status["row"] * 32))

    atlas_data = png_bytes(atlas)
    contact_data = png_bytes(build_contact_sheet(atlas))
    source_data = SOURCE_PATH.read_bytes()
    builder_data = Path(__file__).read_bytes()
    manifest = {
        "assetId": SOURCE["assetId"],
        "status": "production-resolver-ready",
        "runtimeIntegration": "battle-runtime-apply-active-expire-with-generic-fallback",
        "canonicalSource": SOURCE_PATH.name,
        "builder": Path(__file__).name,
        "originality": "Original integer-pixel primitives; no generated or external raster pixels used.",
        "geometry": SOURCE["geometry"],
        "stateOrder": list(STATES),
        "statusOrder": list(STATUSES),
        "signalContract": {
            "apply": {"events": ["status-applied", "status-refreshed"], "animation": "status-glyph"},
            "active": {"snapshot": "actor.statuses"},
            "expire": {"events": ["status-expired"]},
            "cleanse": None,
        },
        "unsupportedSignals": SOURCE["unsupportedSignals"],
        "sources": [
            {"path": SOURCE_PATH.name, "format": "json", "sha256": sha256(source_data)},
            {"path": Path(__file__).name, "format": "python", "sha256": sha256(builder_data)},
        ],
        "exports": [
            {"path": ATLAS_PATH.name, "role": "transparent-runtime-atlas", "runtime": True, "sha256": sha256(atlas_data), "ihdr": ihdr(atlas_data)},
            {"path": CONTACT_PATH.name, "role": "labeled-review-contact-sheet", "runtime": False, "sha256": sha256(contact_data), "ihdr": ihdr(contact_data)},
        ],
        "frames": frames,
    }
    return {
        ATLAS_PATH.name: atlas_data,
        CONTACT_PATH.name: contact_data,
        MANIFEST_PATH.name: (json.dumps(manifest, indent=2) + "\n").encode("utf-8"),
    }


def verify_two_clean_builds() -> None:
    first = build_artifacts()
    second = build_artifacts()
    for name in first:
        if first[name] != second[name]:
            raise ValueError(f"Non-deterministic output detected: {name}")


def write_or_check(artifacts: dict[str, bytes], check: bool) -> None:
    if check:
        mismatches = []
        for name, expected in artifacts.items():
            path = ROOT / name
            if not path.exists():
                mismatches.append(f"missing {name}")
            elif path.read_bytes() != expected:
                mismatches.append(f"stale {name}")
        if mismatches:
            raise SystemExit("Status VFX suite check failed: " + ", ".join(mismatches))
        print("Status VFX suite is byte-identical to a clean deterministic build.")
        return
    for name, data in artifacts.items():
        (ROOT / name).write_bytes(data)
    print(f"Wrote {', '.join(artifacts)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if checked-in artifacts differ")
    args = parser.parse_args()
    SOURCE = load_source()
    verify_two_clean_builds()
    write_or_check(build_artifacts(), args.check)
