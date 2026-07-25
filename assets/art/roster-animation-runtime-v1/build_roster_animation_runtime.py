from __future__ import annotations

import argparse
import hashlib
import io
import json
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "roster-animation-runtime.source.json"
BUILDER_PATH = Path(__file__).resolve()
PARTY_SOURCE_PATH = ROOT / "sources" / "party-combat-key-poses-v1.png"
ENEMY_SOURCE_PATH = ROOT / "sources" / "enemy-field-animation-atlas-v1.png"
PARTY_ATLAS_NAME = "party-combat-animation-atlas-v1.png"
PARTY_CONTACT_NAME = "party-combat-animation-contact-sheet-v1.png"
ENEMY_ATLAS_NAME = "enemy-encounter-trigger-atlas-v1.png"
ENEMY_CONTACT_NAME = "enemy-encounter-trigger-contact-sheet-v1.png"
ENEMY_PREVIEW_NAME = "enemy-encounter-trigger-motion-preview-v1.gif"
COVERAGE_NAME = "roster-animation-coverage-v1.json"
MANIFEST_NAME = "manifest.json"


def sha256_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sha256_rgba(image: Image.Image) -> str:
    return hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def save_png(image: Image.Image, path: Path) -> None:
    path.write_bytes(png_bytes(image))


def save_gif(frames: list[Image.Image], durations: list[int], path: Path) -> None:
    frames[0].save(
        path,
        format="GIF",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=False,
    )


def rgb(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (255,)


def crop_cell(
    atlas: Image.Image,
    column: int,
    row: int,
    width: int,
    height: int,
) -> Image.Image:
    return atlas.crop((column * width, row * height, (column + 1) * width, (row + 1) * height)).convert("RGBA")


def visible_bounds(image: Image.Image) -> list[int] | None:
    bounds = image.getchannel("A").getbbox()
    return list(bounds) if bounds else None


def visible_colors(image: Image.Image) -> int:
    return len({pixel[:3] for pixel in image.convert("RGBA").getdata() if pixel[3]})


def assert_binary_alpha(image: Image.Image, label: str) -> None:
    values = set(image.convert("RGBA").getchannel("A").getdata())
    if not values.issubset({0, 255}):
        raise ValueError(f"{label} alpha is not binary: {sorted(values)}")


def upper_shift(frame: Image.Image, dx: int = 0, dy: int = 0, cutoff: int = 48) -> Image.Image:
    """Move only the expressive upper body while keeping feet registered."""
    result = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    upper = frame.crop((0, 0, frame.width, cutoff))
    lower = frame.crop((0, cutoff, frame.width, frame.height))
    result.alpha_composite(upper, (dx, dy))
    result.alpha_composite(lower, (0, cutoff))
    return result


def whole_shift(frame: Image.Image, dx: int = 0, dy: int = 0) -> Image.Image:
    result = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    result.alpha_composite(frame, (dx, dy))
    return result


def draw_basic_arc(frame: Image.Image, accent: tuple[int, int, int, int], active: bool) -> Image.Image:
    result = frame.copy()
    draw = ImageDraw.Draw(result)
    if active:
        draw.line(((30, 20), (39, 17), (46, 21)), fill=accent, width=2)
        draw.line(((33, 24), (41, 22), (46, 25)), fill=accent)
        draw.point((44, 18), fill=(246, 231, 176, 255))
    else:
        draw.line(((34, 22), (41, 20), (45, 22)), fill=accent)
    return result


def draw_signature_vfx(
    frame: Image.Image,
    accent: tuple[int, int, int, int],
    stage: str,
    vfx: str,
    alternate: bool,
) -> Image.Image:
    result = frame.copy()
    draw = ImageDraw.Draw(result)
    white = (246, 231, 176, 255)
    if stage == "charge":
        draw.polygon(((39, 18), (43, 22), (39, 26), (35, 22)), outline=accent)
        draw.point((39, 22), fill=white)
        if vfx in {"lance-radiance", "hidden-cross-light"}:
            draw.line((39, 14, 39, 29), fill=accent)
            draw.line((35, 20, 43, 20), fill=accent)
    elif stage == "active":
        if vfx == "crescent":
            draw.line(((31, 12), (39, 15), (45, 23), (42, 31)), fill=accent, width=2)
        elif vfx == "paper-fan":
            draw.polygon(((33, 29), (37, 14), (44, 18), (46, 30)), outline=accent)
            draw.line((38, 18, 45, 27), fill=white)
        elif vfx == "lance-radiance":
            draw.line((26, 26, 46, 26), fill=white, width=2)
            draw.line((30, 23, 46, 23), fill=accent)
            draw.polygon(((45, 20), (46, 26), (42, 23)), fill=accent)
        elif vfx == "hidden-cross-light":
            draw.line((39, 12, 39, 34), fill=accent, width=2)
            draw.line((31, 20, 46, 20), fill=accent, width=2)
            draw.point((39, 20), fill=white)
        elif vfx == "hammer-spark":
            for x, y in ((32, 17), (39, 13), (45, 18), (42, 27), (34, 30)):
                draw.line((39, 22, x, y), fill=accent)
            draw.rectangle((38, 21, 40, 23), fill=white)
        elif vfx == "herb-lantern":
            draw.ellipse((33, 15, 46, 29), outline=accent, width=2)
            draw.polygon(((39, 16), (44, 22), (39, 28), (34, 22)), fill=white)
        elif vfx == "weather-ruler":
            draw.line((31, 31, 46, 14), fill=accent, width=2)
            draw.line((34, 16, 45, 29), fill=white)
            draw.point((46, 14), fill=white)
        if alternate:
            draw.line((29, 35, 46, 35), fill=accent)
            draw.point((44, 33), fill=white)
    elif stage == "recoil":
        draw.line((35, 29, 43, 31), fill=accent)
        draw.point((46, 32), fill=accent)
    return result


def party_clip_phase(clip_id: str, local_frame: int) -> str:
    phases = {
        "idle": ["neutral", "breath", "settle", "neutral"],
        "move": ["contact", "compression", "passing", "extension", "contact", "ready"],
        "guard": ["ready", "commitment", "hold", "recovery"],
        "hurt": ["ready", "contact", "recoil", "recovery"],
        "basic-strike": ["ready", "windup", "commitment", "active", "recoil", "recovery"],
        "signature-a": ["ready", "windup", "charge", "active", "recoil", "recovery"],
        "signature-b": ["ready", "windup", "charge", "active", "recoil", "recovery"],
        "defeat": ["hurt", "stagger", "collapse", "defeated-hold"],
    }
    return phases[clip_id][local_frame]


def build_party_row(
    source: Image.Image,
    source_row: int,
    character: dict,
    party_spec: dict,
) -> tuple[list[Image.Image], list[dict]]:
    width = party_spec["sourceGeometry"]["frameWidth"]
    height = party_spec["sourceGeometry"]["frameHeight"]
    source_keys = [crop_cell(source, column, source_row, width, height) for column in range(10)]
    accent = rgb(character["accent"])
    vfx = character["vfx"]
    frames: list[Image.Image] = []
    records: list[dict] = []

    recipes: dict[str, list[tuple[int, int, int, str | None]]] = {
        "idle": [(0, 0, 0, None), (0, 0, -1, None), (0, 0, 0, None), (0, 0, 0, None)],
        "move": [(1, 0, 0, None), (1, -1, 0, None), (1, 0, -1, None), (1, 1, 0, None), (1, 0, 0, None), (0, 0, 0, None)],
        "guard": [(0, 0, 0, None), (2, 0, 0, "guard"), (2, -1, 0, "guard"), (8, 0, 0, None)],
        "hurt": [(0, 0, 0, None), (3, -1, 0, None), (3, -2, 0, None), (8, 0, 0, None)],
        "basic-strike": [(0, 0, 0, None), (4, 0, 0, None), (4, -1, 0, "basic-ready"), (5, 0, 0, "basic-active"), (8, 0, 0, None), (0, 0, 0, None)],
        "signature-a": [(0, 0, 0, None), (4, 0, 0, None), (6, 0, 0, "sig-charge"), (6, 0, 0, "sig-active"), (8, 0, 0, "sig-recoil"), (0, 0, 0, None)],
        "signature-b": [(0, 0, 0, None), (4, 0, 0, None), (7, 0, 0, "sig-charge-alt"), (7, 0, 0, "sig-active-alt"), (8, 0, 0, "sig-recoil"), (0, 0, 0, None)],
        "defeat": [(3, -1, 0, None), (8, 0, 0, None), (9, 0, 0, None), (9, 0, 0, None)],
    }

    for clip in party_spec["clips"]:
        clip_id = clip["id"]
        for local_frame, (source_column, dx, dy, effect) in enumerate(recipes[clip_id]):
            frame = upper_shift(source_keys[source_column], dx, dy)
            if effect == "guard":
                draw = ImageDraw.Draw(frame)
                draw.line((34, 20, 42, 26), fill=accent, width=2)
                draw.line((34, 31, 42, 26), fill=accent, width=2)
            elif effect == "basic-ready":
                frame = draw_basic_arc(frame, accent, False)
            elif effect == "basic-active":
                frame = draw_basic_arc(frame, accent, True)
            elif effect and effect.startswith("sig-"):
                stage = effect.removeprefix("sig-").removesuffix("-alt")
                frame = draw_signature_vfx(frame, accent, stage, vfx, effect.endswith("-alt"))
            assert_binary_alpha(frame, f"{character['id']}:{clip_id}:{local_frame}")
            global_column = len(frames)
            frames.append(frame)
            event = clip.get("event")
            records.append({
                "id": f"{character['id']}:{clip_id}:{local_frame}",
                "characterId": character["id"],
                "clip": clip_id,
                "localFrame": local_frame,
                "column": global_column,
                "row": source_row,
                "rect": [global_column * width, source_row * height, width, height],
                "pivot": party_spec["runtimeGeometry"]["pivot"],
                "footPoint": party_spec["runtimeGeometry"]["footPoint"],
                "phase": party_clip_phase(clip_id, local_frame),
                "durationMs": clip["durationsMs"][local_frame],
                "event": event["name"] if event and event["frame"] == local_frame else None,
                "visibleBounds": visible_bounds(frame),
                "visibleColors": visible_colors(frame),
                "rgbaSha256": sha256_rgba(frame),
            })
    if len(frames) != party_spec["runtimeGeometry"]["columns"]:
        raise ValueError(f"{character['id']} emitted {len(frames)} party frames, expected 40")
    return frames, records


def draw_trigger_indicator(
    frame: Image.Image,
    kind: str,
    palette: dict,
    profile: str,
) -> Image.Image:
    result = frame.copy()
    draw = ImageDraw.Draw(result)
    sense = palette["sense"]
    alert = palette["alert"]
    danger = palette["danger"]
    white = palette["white"]
    shadow = palette["shadow"]
    if kind == "sense":
        draw.rectangle((38, 3, 45, 12), fill=shadow)
        draw.line((40, 5, 43, 5), fill=sense, width=2)
        draw.point((43, 6), fill=sense)
        draw.point((42, 7), fill=sense)
        draw.point((41, 10), fill=sense)
    elif kind == "alert-windup":
        draw.rectangle((39, 2, 44, 12), fill=shadow)
        draw.line((41, 4, 41, 8), fill=alert, width=2)
        draw.rectangle((41, 10, 42, 11), fill=alert)
    elif kind == "alert-active":
        draw.polygon(((41, 0), (47, 7), (44, 15), (37, 15), (34, 7)), fill=shadow)
        draw.line((40, 3, 40, 9), fill=white, width=2)
        draw.rectangle((40, 12, 41, 13), fill=alert)
        draw.line((33, 8, 29, 8), fill=alert)
        draw.line((46, 8, 47, 8), fill=alert)
    elif kind == "engage-windup":
        draw.line((2, 23, 7, 20), fill=danger, width=2)
        draw.line((2, 27, 7, 30), fill=danger, width=2)
        draw.line((45, 23, 40, 20), fill=danger, width=2)
        draw.line((45, 27, 40, 30), fill=danger, width=2)
    elif kind == "engage-contact":
        draw.rectangle((1, 1, 46, 46), outline=danger, width=1)
        draw.line((4, 24, 10, 24), fill=white, width=2)
        draw.line((37, 24, 43, 24), fill=white, width=2)
        if profile == "ambush":
            draw.line((12, 41, 16, 34), fill=danger)
            draw.line((36, 41, 32, 34), fill=danger)
    return result


def build_enemy_trigger_row(
    source: Image.Image,
    source_row: int,
    entry: dict,
    trigger_spec: dict,
) -> tuple[list[Image.Image], list[dict]]:
    width = trigger_spec["sourceGeometry"]["frameWidth"]
    height = trigger_spec["sourceGeometry"]["frameHeight"]
    source_columns = trigger_spec["sourceGeometry"]["southColumns"]
    keys = [crop_cell(source, column, source_row, width, height) for column in source_columns]
    profile = entry["profile"]
    palette = {key: rgb(value) for key, value in trigger_spec["indicatorPalette"].items()}
    frames = [
        keys[0],
        whole_shift(keys[0], 0, -1) if profile == "hover" else upper_shift(keys[0], 0, -1, 34),
        keys[2],
        draw_trigger_indicator(keys[3], "sense", palette, profile),
        keys[4],
        draw_trigger_indicator(keys[2], "alert-windup", palette, profile),
        draw_trigger_indicator(keys[0], "alert-active", palette, profile),
        whole_shift(keys[1], 2 if profile == "rush" else 0, -1 if profile == "hover" else 0),
        whole_shift(keys[3], -1 if profile == "rush" else 0, 0),
        draw_trigger_indicator(upper_shift(keys[2], 1 if profile == "humanoid" else 0, 0, 34), "engage-windup", palette, profile),
        draw_trigger_indicator(whole_shift(keys[4], 2 if profile in {"rush", "beast"} else 1, -1 if profile == "hover" else 0), "engage-contact", palette, profile),
        keys[0],
    ]
    records = []
    phase_order = trigger_spec["phaseOrder"]
    duration_lookup = {}
    event_lookup = {}
    for clip in trigger_spec["clips"]:
        for local, frame_index in enumerate(clip["frames"]):
            duration_lookup.setdefault(frame_index, clip["durationsMs"][local])
            event = clip.get("event")
            if event and event["frame"] == local:
                event_lookup[frame_index] = event["name"]
    for column, frame in enumerate(frames):
        assert_binary_alpha(frame, f"{entry['id']}:{phase_order[column]}")
        records.append({
            "id": f"{entry['id']}:{phase_order[column]}",
            "enemyId": entry["id"],
            "profile": profile,
            "phase": phase_order[column],
            "column": column,
            "row": source_row,
            "rect": [column * width, source_row * height, width, height],
            "pivot": trigger_spec["runtimeGeometry"]["pivot"],
            "footPoint": trigger_spec["runtimeGeometry"]["footPoint"],
            "durationMs": duration_lookup.get(column, 120),
            "event": event_lookup.get(column),
            "visibleBounds": visible_bounds(frame),
            "visibleColors": visible_colors(frame),
            "rgbaSha256": sha256_rgba(frame),
        })
    return frames, records


def checker_tile(width: int, height: int, unit: int = 8) -> Image.Image:
    image = Image.new("RGBA", (width, height), (36, 33, 41, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, height, unit):
        for x in range(0, width, unit):
            if (x // unit + y // unit) % 2:
                draw.rectangle((x, y, min(width - 1, x + unit - 1), min(height - 1, y + unit - 1)), fill=(53, 48, 58, 255))
    return image


def build_party_contact(
    party_rows: list[list[Image.Image]],
    party_spec: dict,
) -> Image.Image:
    scale = 2
    tile_width = 112
    tile_height = 150
    clips = party_spec["clips"]
    characters = party_spec["characters"]
    image = Image.new("RGBA", (tile_width * len(clips), tile_height * len(characters)), (22, 20, 27, 255))
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    for row, character in enumerate(characters):
        for column, clip in enumerate(clips):
            tile_x = column * tile_width
            tile_y = row * tile_height
            draw.rectangle((tile_x, tile_y, tile_x + tile_width - 2, tile_y + tile_height - 2), outline=(101, 88, 70, 255))
            local = clip["event"]["frame"] if clip.get("event") else min(clip["frames"] - 1, clip["frames"] // 2)
            frame = party_rows[row][clip["start"] + local]
            preview = frame.resize((frame.width * scale, frame.height * scale), Image.Resampling.NEAREST)
            background = checker_tile(preview.width, preview.height)
            background.alpha_composite(preview)
            image.alpha_composite(background, (tile_x + 8, tile_y + 16))
            draw.text((tile_x + 4, tile_y + 3), f"{character['id']} / {clip['id']}", fill=(246, 231, 176, 255), font=font)
    return image


def build_enemy_contact(
    trigger_rows: list[list[Image.Image]],
    trigger_spec: dict,
) -> Image.Image:
    columns = 4
    tile_width = 240
    tile_height = 92
    rows = (len(trigger_spec["entries"]) + columns - 1) // columns
    image = Image.new("RGBA", (tile_width * columns, tile_height * rows), (22, 20, 27, 255))
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    for index, entry in enumerate(trigger_spec["entries"]):
        tile_x = (index % columns) * tile_width
        tile_y = (index // columns) * tile_height
        draw.rectangle((tile_x, tile_y, tile_x + tile_width - 2, tile_y + tile_height - 2), outline=(74, 68, 80, 255))
        safe_name = entry["name"].replace("—", "-").replace("–", "-")
        draw.text((tile_x + 4, tile_y + 3), f"{index + 1:02d} {safe_name}", fill=(246, 231, 176, 255), font=font)
        for frame_slot, frame_index in enumerate((0, 6, 10)):
            frame = trigger_rows[index][frame_index]
            image.alpha_composite(frame, (tile_x + 18 + frame_slot * 68, tile_y + 27))
        draw.text((tile_x + 10, tile_y + 76), "DORMANT     ALERT      CONTACT", fill=(177, 160, 120, 255), font=font)
    return image


def build_party_gifs(
    party_rows: list[list[Image.Image]],
    party_spec: dict,
    output_root: Path,
) -> list[Path]:
    preview_paths = []
    scale = 3
    for row, character in enumerate(party_spec["characters"]):
        frames: list[Image.Image] = []
        durations: list[int] = []
        review_frame_index = 0
        for clip in party_spec["clips"]:
            for local in range(clip["frames"]):
                frame = party_rows[row][clip["start"] + local]
                preview = frame.resize((frame.width * scale, frame.height * scale), Image.Resampling.NEAREST)
                marker = ImageDraw.Draw(preview)
                marker.rectangle((0, 0, 20, 5), fill=(14, 13, 19, 255))
                for bit in range(6):
                    if review_frame_index & (1 << bit):
                        marker.rectangle((bit * 3 + 1, 1, bit * 3 + 2, 4), fill=(246, 231, 176, 255))
                frames.append(preview)
                durations.append(clip["durationsMs"][local])
                review_frame_index += 1
            frames.append(frames[-1].copy())
            pause_marker = ImageDraw.Draw(frames[-1])
            pause_marker.rectangle((0, 0, 20, 5), fill=(14, 13, 19, 255))
            for bit in range(6):
                if review_frame_index & (1 << bit):
                    pause_marker.rectangle((bit * 3 + 1, 1, bit * 3 + 2, 4), fill=(246, 231, 176, 255))
            durations.append(220)
            review_frame_index += 1
        relative = Path("previews") / f"{character['id']}-all-combat-clips-v1.gif"
        path = output_root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        save_gif(frames, durations, path)
        preview_paths.append(relative)
    return preview_paths


def build_enemy_preview(
    trigger_rows: list[list[Image.Image]],
    trigger_spec: dict,
    output_root: Path,
) -> Path:
    grid_columns = 8
    grid_rows = 4
    frame_width = 48
    frame_height = 48
    scale = 2
    frames = []
    durations = []
    for frame_index in range(12):
        canvas = Image.new("RGBA", (grid_columns * frame_width, grid_rows * frame_height), (18, 17, 24, 255))
        for enemy_index, row_frames in enumerate(trigger_rows):
            x = (enemy_index % grid_columns) * frame_width
            y = (enemy_index // grid_columns) * frame_height
            canvas.alpha_composite(row_frames[frame_index], (x, y))
        frames.append(canvas.resize((canvas.width * scale, canvas.height * scale), Image.Resampling.NEAREST))
        durations.append(140 if frame_index not in {6, 10} else 240)
    path = output_root / ENEMY_PREVIEW_NAME
    save_gif(frames, durations, path)
    return Path(ENEMY_PREVIEW_NAME)


def output_record(path: Path, purpose: str, output_root: Path) -> dict:
    record = {
        "path": path.relative_to(output_root).as_posix(),
        "sha256": sha256_path(path),
        "purpose": purpose,
    }
    if path.suffix.lower() == ".png":
        image = Image.open(path).convert("RGBA")
        record.update({
            "dimensions": list(image.size),
            "actualColors": visible_colors(image),
            "alphaValues": sorted(set(image.getchannel("A").getdata())),
        })
    elif path.suffix.lower() == ".gif":
        image = Image.open(path)
        record.update({
            "dimensions": list(image.size),
            "frameCount": getattr(image, "n_frames", 1),
            "reviewOnly": True,
        })
    return record


def build(output_root: Path) -> list[Path]:
    spec = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    party_spec = spec["party"]
    trigger_spec = spec["enemyTriggers"]
    party_source = Image.open(PARTY_SOURCE_PATH).convert("RGBA")
    enemy_source = Image.open(ENEMY_SOURCE_PATH).convert("RGBA")

    expected_party_size = (
        party_spec["sourceGeometry"]["frameWidth"] * party_spec["sourceGeometry"]["columns"],
        party_spec["sourceGeometry"]["frameHeight"] * party_spec["sourceGeometry"]["rows"],
    )
    expected_enemy_size = (
        trigger_spec["sourceGeometry"]["frameWidth"] * trigger_spec["sourceGeometry"]["columns"],
        trigger_spec["sourceGeometry"]["frameHeight"] * trigger_spec["sourceGeometry"]["rows"],
    )
    if party_source.size != expected_party_size:
        raise ValueError(f"party source has size {party_source.size}, expected {expected_party_size}")
    if enemy_source.size != expected_enemy_size:
        raise ValueError(f"enemy source has size {enemy_source.size}, expected {expected_enemy_size}")
    assert_binary_alpha(party_source, "party source")
    assert_binary_alpha(enemy_source, "enemy source")

    party_rows: list[list[Image.Image]] = []
    party_frame_records: list[dict] = []
    for row, character in enumerate(party_spec["characters"]):
        row_frames, records = build_party_row(party_source, row, character, party_spec)
        party_rows.append(row_frames)
        party_frame_records.extend(records)

    party_width = party_spec["runtimeGeometry"]["columns"] * party_spec["runtimeGeometry"]["frameWidth"]
    party_height = party_spec["runtimeGeometry"]["rows"] * party_spec["runtimeGeometry"]["frameHeight"]
    party_atlas = Image.new("RGBA", (party_width, party_height), (0, 0, 0, 0))
    for row, row_frames in enumerate(party_rows):
        for column, frame in enumerate(row_frames):
            party_atlas.alpha_composite(frame, (column * frame.width, row * frame.height))

    trigger_rows: list[list[Image.Image]] = []
    trigger_frame_records: list[dict] = []
    for row, entry in enumerate(trigger_spec["entries"]):
        row_frames, records = build_enemy_trigger_row(enemy_source, row, entry, trigger_spec)
        trigger_rows.append(row_frames)
        trigger_frame_records.extend(records)

    trigger_width = trigger_spec["runtimeGeometry"]["columns"] * trigger_spec["runtimeGeometry"]["frameWidth"]
    trigger_height = trigger_spec["runtimeGeometry"]["rows"] * trigger_spec["runtimeGeometry"]["frameHeight"]
    trigger_atlas = Image.new("RGBA", (trigger_width, trigger_height), (0, 0, 0, 0))
    for row, row_frames in enumerate(trigger_rows):
        for column, frame in enumerate(row_frames):
            trigger_atlas.alpha_composite(frame, (column * frame.width, row * frame.height))

    party_contact = build_party_contact(party_rows, party_spec)
    enemy_contact = build_enemy_contact(trigger_rows, trigger_spec)
    output_root.mkdir(parents=True, exist_ok=True)
    save_png(party_atlas, output_root / PARTY_ATLAS_NAME)
    save_png(party_contact, output_root / PARTY_CONTACT_NAME)
    save_png(trigger_atlas, output_root / ENEMY_ATLAS_NAME)
    save_png(enemy_contact, output_root / ENEMY_CONTACT_NAME)
    party_preview_paths = build_party_gifs(party_rows, party_spec, output_root)
    enemy_preview_path = build_enemy_preview(trigger_rows, trigger_spec, output_root)

    coverage = {
        "schemaVersion": 1,
        "party": {
            "expected": 7,
            "animated": len(party_rows),
            "clipsPerCharacter": len(party_spec["clips"]),
            "framesPerCharacter": party_spec["runtimeGeometry"]["columns"],
            "missing": [],
        },
        "enemyEncounterTriggers": {
            "expected": 32,
            "animated": len(trigger_rows),
            "clipsPerEnemy": len(trigger_spec["clips"]),
            "framesPerEnemy": trigger_spec["runtimeGeometry"]["columns"],
            "missing": [],
        },
        "totalRosterEntries": 39,
        "coverageComplete": len(party_rows) == 7 and len(trigger_rows) == 32,
    }
    coverage_path = output_root / COVERAGE_NAME
    coverage_path.write_text(json.dumps(coverage, indent=2) + "\n", encoding="utf-8")

    runtime_outputs = [
        (output_root / PARTY_ATLAS_NAME, "binary-alpha-party-combat-runtime-atlas"),
        (output_root / ENEMY_ATLAS_NAME, "binary-alpha-enemy-trigger-runtime-atlas"),
    ]
    review_outputs = [
        (output_root / PARTY_CONTACT_NAME, "party-animation-contact-sheet"),
        (output_root / ENEMY_CONTACT_NAME, "enemy-trigger-contact-sheet"),
        *((output_root / relative, "party-animation-gif-review") for relative in party_preview_paths),
        (output_root / enemy_preview_path, "enemy-trigger-gif-review"),
    ]
    manifest = {
        "schemaVersion": 1,
        "assetId": spec["assetId"],
        "status": spec["status"],
        "scope": spec["scope"],
        "provenance": spec["provenance"],
        "sources": [
            {
                "path": PARTY_SOURCE_PATH.relative_to(ROOT).as_posix(),
                "sha256": sha256_path(PARTY_SOURCE_PATH),
                "dimensions": list(party_source.size),
                "alphaValues": sorted(set(party_source.getchannel("A").getdata())),
            },
            {
                "path": ENEMY_SOURCE_PATH.relative_to(ROOT).as_posix(),
                "sha256": sha256_path(ENEMY_SOURCE_PATH),
                "dimensions": list(enemy_source.size),
                "alphaValues": sorted(set(enemy_source.getchannel("A").getdata())),
            },
        ],
        "party": {
            "geometry": party_spec["runtimeGeometry"],
            "rowOrder": [character["id"] for character in party_spec["characters"]],
            "clips": party_spec["clips"],
            "characters": party_spec["characters"],
            "frames": party_frame_records,
        },
        "enemyTriggers": {
            "geometry": trigger_spec["runtimeGeometry"],
            "rowOrder": [entry["id"] for entry in trigger_spec["entries"]],
            "phaseOrder": trigger_spec["phaseOrder"],
            "clips": trigger_spec["clips"],
            "entries": trigger_spec["entries"],
            "triggerContract": trigger_spec["triggerContract"],
            "frames": trigger_frame_records,
        },
        "outputs": [
            output_record(path, purpose, output_root)
            for path, purpose in runtime_outputs + review_outputs
        ],
        "coverage": {
            "path": COVERAGE_NAME,
            "sha256": sha256_path(coverage_path),
        },
        "builder": {
            "path": BUILDER_PATH.name,
            "sha256": sha256_path(BUILDER_PATH),
            "pillowVersion": PILLOW_VERSION,
            "deterministic": True,
            "integerAligned": True,
            "runtimeResampling": "none",
            "previewResampling": "nearest-neighbor",
        },
    }
    manifest_path = output_root / MANIFEST_NAME
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return [
        Path(PARTY_ATLAS_NAME),
        Path(PARTY_CONTACT_NAME),
        Path(ENEMY_ATLAS_NAME),
        Path(ENEMY_CONTACT_NAME),
        *party_preview_paths,
        enemy_preview_path,
        Path(COVERAGE_NAME),
        Path(MANIFEST_NAME),
    ]


def check() -> None:
    with tempfile.TemporaryDirectory(prefix="roster-animation-runtime-check-") as temp:
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
    print("Deterministic check passed: all roster-animation outputs are byte-identical.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build full party animation and enemy encounter-trigger atlases.")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
    else:
        build(ROOT)
        print("Built seven party animation rows, thirty-two enemy trigger rows, previews, coverage, and manifest.")


if __name__ == "__main__":
    main()
