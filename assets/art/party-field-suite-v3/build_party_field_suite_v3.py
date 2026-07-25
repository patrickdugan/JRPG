from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "party-field-suite-v3.source.json"
PROMPTS_PATH = ROOT / "generation-prompts.md"
RUNTIME_ROOT = ROOT.parents[2] / "game" / "assets" / "art" / "party-field-suite-v3"

ATLAS_NAME = "party-field-atlas-v3.png"
CONTACT_NAME = "party-field-contact-sheet-v3.png"
MOTION_NAME = "party-field-motion-preview-v3.gif"
MANIFEST_NAME = "manifest.json"

FRAME_W = 64
FRAME_H = 80
PIVOT = (32, 77)
ROWS = ("ren", "aya", "lise", "mateus", "genta", "kiku", "miyo")
DIRECTIONS = ("north", "east", "south", "west")
SOURCE_DIRECTIONS = ("south", "east", "north", "west")
PHASES = (
    "contact-a",
    "compression-a",
    "passing-a",
    "extension-a",
    "contact-b",
    "compression-b",
    "passing-b",
    "extension-b",
)
COLUMNS = tuple(
    f"{direction}-{state}"
    for direction in DIRECTIONS
    for state in ("idle", *PHASES)
) + ("south-interact", "south-hurt")

DISPLAY_NAMES = {
    "ren": "REN",
    "aya": "AYA",
    "lise": "NIKOLA",
    "mateus": "MATEUS",
    "genta": "GENTA",
    "kiku": "KIKU",
    "miyo": "MIYO",
}

STRIDE = (0, 1, 2, 1, 0, -1, -2, -1)
BOB = (0, 1, 1, 0, 0, -1, -1, 0)
SWAY = (-1, -1, 0, 1, 1, 1, 0, -1)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def gif_bytes(frames: list[Image.Image], durations: list[int]) -> bytes:
    stream = io.BytesIO()
    frames[0].save(
        stream,
        format="GIF",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=False,
    )
    return stream.getvalue()


def load_source() -> dict:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    assert source["classification"] == "deterministically-pixelified"
    assert source["sourceClassification"] == "AI-generated pixel-styled concept"
    assert source["frame"] == {
        "width": FRAME_W,
        "height": FRAME_H,
        "pivot": list(PIVOT),
        "footPoint": list(PIVOT),
        "transparentGutter": 2,
        "alphaPolicy": "binary",
    }
    assert tuple(source["rows"]) == ROWS
    assert tuple(source["sourceColumnOrder"]) == SOURCE_DIRECTIONS
    assert tuple(source["runtimeDirectionOrder"]) == DIRECTIONS
    assert tuple(source["walkPhases"]) == PHASES
    assert tuple(character["id"] for character in source["characters"]) == ROWS
    return source


def is_chroma(red: int, green: int, blue: int) -> bool:
    return (
        red >= 205
        and blue >= 165
        and green <= 115
        and red + blue - green * 2 >= 320
    )


def remove_chroma(image: Image.Image) -> Image.Image:
    source = image.convert("RGBA")
    output = Image.new("RGBA", source.size, (0, 0, 0, 0))
    src = source.load()
    dst = output.load()
    for y in range(source.height):
        for x in range(source.width):
            red, green, blue, alpha = src[x, y]
            if alpha == 0 or is_chroma(red, green, blue):
                continue
            # Suppress residual magenta spill without changing ordinary purple cloth.
            spill = max(0, min(red, blue) - green - 48)
            if spill and red > 145 and blue > 145:
                red = max(green + 48, red - spill)
                blue = max(green + 48, blue - spill)
            dst[x, y] = (red, green, blue, 255)
    return output


def crop_source_views(master: Image.Image) -> dict[str, Image.Image]:
    views = {}
    for index, direction in enumerate(SOURCE_DIRECTIONS):
        left = index * master.width // 4
        right = (index + 1) * master.width // 4
        view = remove_chroma(master.crop((left, 0, right, master.height)))
        bounds = view.getchannel("A").getbbox()
        assert bounds, f"{direction}: chroma removal produced an empty view"
        views[direction] = view.crop(bounds)
    return views


def resize_views_shared(views: dict[str, Image.Image], max_size: tuple[int, int]) -> dict[str, Image.Image]:
    maximum_width = max(view.width for view in views.values())
    maximum_height = max(view.height for view in views.values())
    scale = min(max_size[0] / maximum_width, max_size[1] / maximum_height)
    resized = {}
    for direction, view in views.items():
        width = max(1, round(view.width * scale))
        height = max(1, round(view.height * scale))
        resized[direction] = view.resize((width, height), Image.Resampling.BOX)
    return resized


def compose_native_views(views: dict[str, Image.Image]) -> dict[str, Image.Image]:
    frames = {}
    for direction, view in views.items():
        frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        x = (FRAME_W - view.width) // 2
        y = PIVOT[1] - 2 - view.height
        frame.alpha_composite(view, (x, y))
        frames[direction] = frame
    return frames


def shared_palette(frames: dict[str, Image.Image], colors: int) -> dict[str, Image.Image]:
    strip = Image.new("RGBA", (FRAME_W * len(SOURCE_DIRECTIONS), FRAME_H), (0, 0, 0, 0))
    for index, direction in enumerate(SOURCE_DIRECTIONS):
        strip.alpha_composite(frames[direction], (index * FRAME_W, 0))
    alpha = strip.getchannel("A").point(lambda value: 255 if value >= 80 else 0)
    matte = Image.new("RGB", strip.size, (255, 0, 255))
    matte.paste(strip.convert("RGB"), mask=alpha)
    quantized = matte.quantize(
        colors=colors,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    ).convert("RGBA")
    quantized.putalpha(alpha)
    output = {}
    for index, direction in enumerate(SOURCE_DIRECTIONS):
        output[direction] = quantized.crop((index * FRAME_W, 0, (index + 1) * FRAME_W, FRAME_H))
    return output


def row_shear(base: Image.Image, phase: int) -> Image.Image:
    output = Image.new("RGBA", base.size, (0, 0, 0, 0))
    stride = STRIDE[phase]
    bob = BOB[phase]
    sway = SWAY[phase]
    for y in range(FRAME_H):
        lower_factor = max(0.0, min(1.0, (y - 50) / 24))
        cloth_factor = max(0.0, min(1.0, (y - 30) / 32))
        shift_x = round(sway * (0.35 + cloth_factor * 0.65) + stride * lower_factor)
        target_y = y + bob
        if not 0 <= target_y < FRAME_H:
            continue
        row = base.crop((0, y, FRAME_W, y + 1))
        output.alpha_composite(row, (shift_x, target_y))
    return output


def add_interact(base: Image.Image, character_id: str) -> Image.Image:
    output = base.copy()
    draw = ImageDraw.Draw(output)
    bounds = output.getchannel("A").getbbox()
    assert bounds
    x = min(FRAME_W - 6, bounds[2] - 2)
    y = max(7, bounds[1] + round((bounds[3] - bounds[1]) * 0.38))
    accent = {
        "ren": (206, 166, 86, 255),
        "aya": (246, 232, 185, 255),
        "lise": (238, 224, 178, 255),
        "mateus": (184, 142, 69, 255),
        "genta": (185, 172, 133, 255),
        "kiku": (112, 224, 230, 255),
        "miyo": (220, 181, 83, 255),
    }[character_id]
    draw.line((x - 4, y, x + 4, y), fill=accent, width=1)
    draw.line((x, y - 4, x, y + 4), fill=accent, width=1)
    draw.point((x - 2, y - 2), fill=accent)
    draw.point((x + 2, y + 2), fill=accent)
    return output


def add_hurt(base: Image.Image) -> Image.Image:
    output = Image.new("RGBA", base.size, (0, 0, 0, 0))
    # A restrained upper-body recoil while the registered feet remain near the pivot.
    for y in range(FRAME_H):
        shift = round(max(0, 4 - y / 14))
        row = base.crop((0, y, FRAME_W, y + 1))
        output.alpha_composite(row, (shift, y))
    draw = ImageDraw.Draw(output)
    draw.line((52, 17, 60, 9), fill=(246, 232, 185, 255), width=2)
    draw.line((53, 9, 60, 17), fill=(246, 232, 185, 255), width=2)
    draw.point((57, 13), fill=(191, 70, 55, 255))
    return output


def visible_colors(image: Image.Image) -> list[str]:
    return sorted({
        "#{:02x}{:02x}{:02x}".format(red, green, blue)
        for red, green, blue, alpha in image.getdata()
        if alpha
    })


def validate_frame(frame: Image.Image, frame_id: str):
    assert frame.mode == "RGBA"
    assert frame.size == (FRAME_W, FRAME_H)
    alpha = frame.getchannel("A")
    assert set(alpha.getdata()).issubset({0, 255}), f"{frame_id}: alpha must be binary"
    bounds = alpha.getbbox()
    assert bounds, f"{frame_id}: empty"
    assert bounds[0] >= 2 and bounds[1] >= 2, f"{frame_id}: gutter breach {bounds}"
    assert bounds[2] <= FRAME_W - 2 and bounds[3] <= FRAME_H - 2, f"{frame_id}: gutter breach {bounds}"
    assert len(visible_colors(frame)) <= 52, f"{frame_id}: palette exceeds derivative allowance"


def build_character_frames(source: dict, character: dict) -> tuple[dict[str, Image.Image], dict]:
    master_path = ROOT / character["master"]
    master = Image.open(master_path).convert("RGBA")
    views = crop_source_views(master)
    views = resize_views_shared(views, tuple(source["conversion"]["maximumContentBox"]))
    bases = shared_palette(compose_native_views(views), source["conversion"]["paletteCeilingPerCharacter"])
    frames = {}
    for direction in DIRECTIONS:
        frames[f"{direction}-idle"] = bases[direction]
        for phase_index, phase in enumerate(PHASES):
            frames[f"{direction}-{phase}"] = row_shear(bases[direction], phase_index)
    frames["south-interact"] = add_interact(bases["south"], character["id"])
    frames["south-hurt"] = add_hurt(bases["south"])
    for tag, frame in frames.items():
        validate_frame(frame, f"{character['id']}:{tag}")
    source_record = {
        "path": character["master"],
        "classification": source["sourceClassification"],
        "dimensions": [master.width, master.height],
        "mode": master.mode,
        "sha256": sha256(master_path.read_bytes()),
        "sourceColumnOrder": list(SOURCE_DIRECTIONS),
        "chromaKey": source["conversion"]["chromaKey"],
    }
    return frames, source_record


def render_atlas(source: dict) -> tuple[Image.Image, list[dict], list[dict]]:
    atlas = Image.new("RGBA", (FRAME_W * len(COLUMNS), FRAME_H * len(ROWS)), (0, 0, 0, 0))
    records = []
    source_records = []
    for row, character in enumerate(source["characters"]):
        character_id = character["id"]
        frames, source_record = build_character_frames(source, character)
        source_records.append(source_record)
        for column, tag in enumerate(COLUMNS):
            frame = frames[tag]
            x = column * FRAME_W
            y = row * FRAME_H
            atlas.alpha_composite(frame, (x, y))
            alpha = frame.getchannel("A")
            state = tag.split("-", 1)[1]
            if state in PHASES:
                duration = source["animation"]["walkFrameDurationMs"][PHASES.index(state)]
                phase = state
            elif state == "idle":
                duration = 240
                phase = "hold"
            else:
                duration = source["animation"][f"{state}FrameDurationMs"]
                phase = state
            colors = visible_colors(frame)
            records.append({
                "id": f"{character_id}:{tag}",
                "characterId": character_id,
                "direction": tag.split("-", 1)[0],
                "state": state,
                "phase": phase,
                "durationMs": duration,
                "rect": [x, y, FRAME_W, FRAME_H],
                "pivot": list(PIVOT),
                "footPoint": list(PIVOT),
                "alphaBounds": list(alpha.getbbox()),
                "opaquePixelCount": sum(1 for value in alpha.getdata() if value),
                "visibleColorCount": len(colors),
                "visibleColors": colors,
                "rgbaSha256": sha256(frame.tobytes()),
            })
    return atlas, records, source_records


def checker(width: int, height: int, tile: int = 8) -> Image.Image:
    image = Image.new("RGBA", (width, height), (14, 20, 31, 255))
    draw = ImageDraw.Draw(image)
    colors = ((14, 20, 31, 255), (23, 33, 47, 255))
    for y in range(0, height, tile):
        for x in range(0, width, tile):
            draw.rectangle(
                (x, y, min(width - 1, x + tile - 1), min(height - 1, y + tile - 1)),
                fill=colors[(x // tile + y // tile) % 2],
            )
    return image


CONTACT_TAGS = (
    "north-idle", "north-contact-a", "north-passing-a",
    "east-idle", "east-contact-a", "east-passing-a",
    "south-idle", "south-contact-a", "south-compression-a", "south-passing-a", "south-extension-a",
    "west-idle", "west-contact-a", "west-passing-a",
    "south-interact", "south-hurt",
)


def render_contact(atlas: Image.Image) -> Image.Image:
    scale = 2
    label_w = 96
    header_h = 38
    cell_w = FRAME_W * scale
    cell_h = FRAME_H * scale
    output = checker(label_w + len(CONTACT_TAGS) * cell_w, header_h + len(ROWS) * cell_h, 12)
    draw = ImageDraw.Draw(output)
    font = ImageFont.load_default()
    for column, tag in enumerate(CONTACT_TAGS):
        draw.text((label_w + column * cell_w + 3, 12), tag.upper(), fill=(224, 210, 164, 255), font=font)
    for row, character_id in enumerate(ROWS):
        y = header_h + row * cell_h
        draw.text((8, y + cell_h // 2 - 5), DISPLAY_NAMES[character_id], fill=(246, 232, 185, 255), font=font)
        for display_column, tag in enumerate(CONTACT_TAGS):
            source_column = COLUMNS.index(tag)
            frame = atlas.crop((source_column * FRAME_W, row * FRAME_H, (source_column + 1) * FRAME_W, (row + 1) * FRAME_H))
            enlarged = frame.resize((cell_w, cell_h), Image.Resampling.NEAREST)
            x = label_w + display_column * cell_w
            output.alpha_composite(enlarged, (x, y))
            draw.rectangle((x, y, x + cell_w - 1, y + cell_h - 1), outline=(47, 82, 111, 255))
            pivot_x = x + PIVOT[0] * scale
            pivot_y = y + PIVOT[1] * scale
            draw.line((pivot_x - 3, pivot_y, pivot_x + 3, pivot_y), fill=(107, 204, 206, 255))
            draw.line((pivot_x, pivot_y - 3, pivot_x, pivot_y + 3), fill=(107, 204, 206, 255))
    return output


def render_motion(atlas: Image.Image) -> tuple[list[Image.Image], list[int]]:
    scale = 3
    card_w = FRAME_W * scale + 20
    card_h = FRAME_H * scale + 32
    columns = 4
    rows = 2
    frames = []
    durations = []
    font = ImageFont.load_default()
    for direction in DIRECTIONS:
        for phase in PHASES:
            output = checker(card_w * columns, card_h * rows, 12)
            draw = ImageDraw.Draw(output)
            tag = f"{direction}-{phase}"
            source_column = COLUMNS.index(tag)
            for index, character_id in enumerate(ROWS):
                card_x = (index % columns) * card_w
                card_y = (index // columns) * card_h
                frame = atlas.crop((source_column * FRAME_W, index * FRAME_H, (source_column + 1) * FRAME_W, (index + 1) * FRAME_H))
                enlarged = frame.resize((FRAME_W * scale, FRAME_H * scale), Image.Resampling.NEAREST)
                output.alpha_composite(enlarged, (card_x + 10, card_y + 23))
                draw.text((card_x + 8, card_y + 6), f"{DISPLAY_NAMES[character_id]}  {direction.upper()} / {phase.upper()}", fill=(246, 232, 185, 255), font=font)
                draw.rectangle((card_x, card_y, card_x + card_w - 1, card_y + card_h - 1), outline=(47, 82, 111, 255))
            frames.append(output.convert("P", palette=Image.Palette.ADAPTIVE, colors=192))
            durations.append(40)
    return frames, durations


def build_files() -> dict[Path, bytes]:
    source = load_source()
    atlas, frames, master_records = render_atlas(source)
    contact = render_contact(atlas)
    motion_frames, motion_durations = render_motion(atlas)
    atlas_data = png_bytes(atlas)
    contact_data = png_bytes(contact)
    motion_data = gif_bytes(motion_frames, motion_durations)
    reference_path = ROOT / source["reviewReference"]["path"]
    source_bytes = SOURCE_PATH.read_bytes()
    atlas_alpha = atlas.getchannel("A")
    manifest = {
        "assetId": source["assetId"],
        "formatVersion": source["formatVersion"],
        "classification": source["classification"],
        "sourceClassification": source["sourceClassification"],
        "qualityTarget": source["qualityTarget"],
        "tool": {
            "builder": Path(__file__).name,
            "pillow": PILLOW_VERSION,
            "runtimeResampling": source["conversion"]["resampling"],
            "reviewResampling": source["conversion"]["previewResampling"],
            "dither": source["conversion"]["dither"],
        },
        "geometry": {
            "frameWidth": FRAME_W,
            "frameHeight": FRAME_H,
            "columns": len(COLUMNS),
            "rows": len(ROWS),
            "sheetWidth": atlas.width,
            "sheetHeight": atlas.height,
            "pivot": list(PIVOT),
            "footPoint": list(PIVOT),
            "transparentGutter": 2,
            "alphaBounds": list(atlas_alpha.getbbox()),
        },
        "rowOrder": list(ROWS),
        "columnOrder": list(COLUMNS),
        "directions": list(DIRECTIONS),
        "walkPhases": list(PHASES),
        "clips": {
            direction: {
                "idle": [f"{direction}-idle"],
                "walk": [f"{direction}-{phase}" for phase in PHASES],
                "frameDurationMs": source["animation"]["walkFrameDurationMs"],
                "loop": True,
            }
            for direction in DIRECTIONS
        } | {
            "interact": {"frames": ["south-interact"], "frameDurationMs": [source["animation"]["interactFrameDurationMs"]], "loop": False},
            "hurt": {"frames": ["south-hurt"], "frameDurationMs": [source["animation"]["hurtFrameDurationMs"]], "loop": False},
        },
        "conversion": source["conversion"],
        "sources": [
            {
                "path": SOURCE_PATH.name,
                "role": "conversion-geometry-timing-contract",
                "sha256": sha256(source_bytes),
            },
            {
                "path": PROMPTS_PATH.name,
                "role": "generated-source-prompt-record",
                "sha256": sha256(PROMPTS_PATH.read_bytes()),
            },
            {
                "path": source["reviewReference"]["path"],
                "role": source["reviewReference"]["role"],
                "classification": source["sourceClassification"],
                "runtimeInput": False,
                "sha256": sha256(reference_path.read_bytes()),
            },
            *master_records,
        ],
        "frames": frames,
        "exports": [
            {"path": ATLAS_NAME, "purpose": "transparent-runtime-atlas", "width": atlas.width, "height": atlas.height, "mode": atlas.mode, "sha256": sha256(atlas_data)},
            {"path": CONTACT_NAME, "purpose": "opaque-review-contact-sheet", "width": contact.width, "height": contact.height, "mode": contact.mode, "previewScale": 2, "sha256": sha256(contact_data)},
            {"path": MOTION_NAME, "purpose": "nearest-neighbor-motion-review", "width": motion_frames[0].width, "height": motion_frames[0].height, "frames": len(motion_frames), "previewScale": 3, "sha256": sha256(motion_data)},
        ],
        "validation": {
            "frameCount": len(frames),
            "expectedFrameCount": len(ROWS) * len(COLUMNS),
            "binaryAlpha": set(atlas_alpha.getdata()).issubset({0, 255}),
            "actualGlobalVisibleColors": len(visible_colors(atlas)),
            "actualMaximumVisibleColorsPerFrame": max(frame["visibleColorCount"] for frame in frames),
            "uniqueFrameHashes": len({frame["rgbaSha256"] for frame in frames}),
            "allFramesUnique": len({frame["rgbaSha256"] for frame in frames}) == len(frames),
            "runtimeCopy": str((RUNTIME_ROOT / ATLAS_NAME).relative_to(ROOT.parents[2])),
        },
        "review": {
            "runtimeIntegration": "campaign-field-leader-and-followers-eight-phase-directional-walk",
            "remaining": "human in-game scale review and external cultural review remain advisable",
        },
    }
    manifest_data = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return {
        ROOT / ATLAS_NAME: atlas_data,
        ROOT / CONTACT_NAME: contact_data,
        ROOT / MOTION_NAME: motion_data,
        ROOT / MANIFEST_NAME: manifest_data,
        RUNTIME_ROOT / ATLAS_NAME: atlas_data,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs = build_files()
    if args.check:
        failures = [
            str(path)
            for path, expected in outputs.items()
            if not path.exists() or path.read_bytes() != expected
        ]
        if failures:
            raise SystemExit("Generated outputs differ:\n" + "\n".join(failures))
        print(f"PASS byte-identical rebuild: {len(outputs)} files")
        return 0
    for path, data in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        print(f"WROTE {path.relative_to(ROOT.parents[2])} ({len(data)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
