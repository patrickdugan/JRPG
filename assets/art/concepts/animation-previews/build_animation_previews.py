from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
GRID_COLUMNS = 6
GRID_ROWS = 4

ACTIONS = (
    {
        "id": "run",
        "row": 0,
        "durationsMs": (90, 75, 75, 90, 75, 75),
        "repeats": 2,
        "finalHoldMs": 120,
    },
    {
        "id": "jump",
        "row": 1,
        "durationsMs": (140, 90, 110, 155, 110, 150),
        "repeats": 1,
        "finalHoldMs": 220,
    },
    {
        "id": "basic-attack",
        "row": 2,
        "durationsMs": (150, 140, 85, 105, 105, 175),
        "repeats": 1,
        "finalHoldMs": 260,
    },
    {
        "id": "signature-attack",
        "row": 3,
        "durationsMs": (190, 170, 90, 90, 180, 230),
        "repeats": 1,
        "finalHoldMs": 420,
    },
)

ACTORS = (
    {
        "id": "ren",
        "displayName": "Ren Ishikawa",
        "category": "party",
        "sheet": "ren-animation-sheet-v1.png",
        "gif": "ren-all-actions-v1.gif",
        "signature": "Cinder Route",
    },
    {
        "id": "aya",
        "displayName": "Aya Shinohara",
        "category": "party",
        "sheet": "aya-animation-sheet-v1.png",
        "gif": "aya-all-actions-v1.gif",
        "signature": "Warding Script",
    },
    {
        "id": "nikola",
        "displayName": "Nikola Dravanić (Dravanic)",
        "category": "party",
        "sheet": "dravanic-longinus-animation-sheet-v1.png",
        "gif": "dravanic-longinus-all-actions-v1.gif",
        "signature": "holy Longinus power",
    },
    {
        "id": "mateus",
        "displayName": "Father Mateus Avelar",
        "category": "party",
        "sheet": "vampire-priest-animation-sheet-v1.png",
        "gif": "vampire-priest-all-actions-v1.gif",
        "signature": "red-eyed bloodlust",
    },
    {
        "id": "genta",
        "displayName": "Genta Mononobe",
        "category": "party",
        "sheet": "genta-animation-sheet-v1.png",
        "gif": "genta-all-actions-v1.gif",
        "signature": "Standing Bridge",
    },
    {
        "id": "kiku",
        "displayName": "Kiku Nawa",
        "category": "party",
        "sheet": "kiku-animation-sheet-v1.png",
        "gif": "kiku-all-actions-v1.gif",
        "signature": "Cold Medicine / Terrain Remedy",
    },
    {
        "id": "miyo",
        "displayName": "Miyo Senda",
        "category": "party",
        "sheet": "miyo-animation-sheet-v1.png",
        "gif": "miyo-all-actions-v1.gif",
        "signature": "Thunder Thread",
        "postprocess": "nearest-neighbor per-cell normalization from 1586x992 to 1536x1024",
    },
    {
        "id": "cinder-hound",
        "displayName": "Cinder Hound",
        "category": "enemy",
        "sheet": "cinder-hound-animation-sheet-v1.png",
        "gif": "cinder-hound-all-actions-v1.gif",
        "signature": "Cinder Overload",
    },
    {
        "id": "ash-wisp",
        "displayName": "Ash Wisp",
        "category": "enemy",
        "sheet": "ash-wisp-animation-sheet-v1.png",
        "gif": "ash-wisp-all-actions-v1.gif",
        "signature": "Ash Nova",
        "postprocess": "active bolt cell composited with the sheet's own visible canonical core",
    },
    {
        "id": "ashen-bailiff",
        "displayName": "Ashen Bailiff",
        "category": "enemy",
        "sheet": "ashen-bailiff-animation-sheet-v1.png",
        "gif": "ashen-bailiff-all-actions-v1.gif",
        "signature": "Tithe Seal",
    },
    {
        "id": "court-retainer",
        "displayName": "Court Retainer",
        "category": "enemy",
        "sheet": "court-retainer-animation-sheet-v1.png",
        "gif": "court-retainer-all-actions-v1.gif",
        "signature": "Docket Sever",
    },
    {
        "id": "widow-of-fog",
        "displayName": "Widow of Fog",
        "category": "enemy",
        "sheet": "widow-of-fog-animation-sheet-v1.png",
        "gif": "widow-of-fog-all-actions-v1.gif",
        "signature": "Tide Inversion",
    },
    {
        "id": "ash-furnace",
        "displayName": "Ash Furnace",
        "category": "enemy",
        "sheet": "ash-furnace-animation-sheet-v1.png",
        "gif": "ash-furnace-all-actions-v1.gif",
        "signature": "Overheat",
    },
    {
        "id": "bell-warden",
        "displayName": "Bell Warden",
        "category": "enemy",
        "sheet": "bell-warden-animation-sheet-v1.png",
        "gif": "bell-warden-all-actions-v1.gif",
        "signature": "Resonance Overload",
    },
    {
        "id": "black-court",
        "displayName": "Black Court",
        "category": "enemy",
        "sheet": "black-court-animation-sheet-v1.png",
        "gif": "black-court-all-actions-v1.gif",
        "signature": "Decree Fracture",
    },
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_sheet(path: Path) -> tuple[Image.Image, int, int]:
    sheet = Image.open(path).convert("RGB")
    width, height = sheet.size
    if width % GRID_COLUMNS or height % GRID_ROWS:
        raise ValueError(
            f"{path.name} must divide into a {GRID_COLUMNS}x{GRID_ROWS} grid; "
            f"got {width}x{height}"
        )
    return sheet, width // GRID_COLUMNS, height // GRID_ROWS


def crop_rows(sheet: Image.Image, cell_width: int, cell_height: int) -> list[list[Image.Image]]:
    rows: list[list[Image.Image]] = []
    for row in range(GRID_ROWS):
        frames: list[Image.Image] = []
        for column in range(GRID_COLUMNS):
            left = column * cell_width
            top = row * cell_height
            frames.append(sheet.crop((left, top, left + cell_width, top + cell_height)))
        rows.append(frames)
    return rows


def build_sequence(rows: list[list[Image.Image]]) -> tuple[list[Image.Image], list[int]]:
    frames: list[Image.Image] = []
    durations: list[int] = []
    for action in ACTIONS:
        action_frames = rows[action["row"]]
        for repeat in range(action["repeats"]):
            frames.extend(frame.copy() for frame in action_frames)
            action_durations = list(action["durationsMs"])
            if repeat == action["repeats"] - 1:
                action_durations[-1] += action["finalHoldMs"]
            durations.extend(action_durations)
    return frames, durations


def encode_gif(
    sheet: Image.Image,
    frames: list[Image.Image],
    durations: list[int],
) -> bytes:
    palette_source = sheet.resize((384, 256), Image.Resampling.NEAREST).quantize(
        colors=256,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )
    paletted = [
        frame.quantize(palette=palette_source, dither=Image.Dither.NONE)
        for frame in frames
    ]
    output = io.BytesIO()
    paletted[0].save(
        output,
        format="GIF",
        save_all=True,
        append_images=paletted[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=False,
    )
    return output.getvalue()


def build_artifacts() -> dict[str, bytes]:
    artifacts: dict[str, bytes] = {}
    actor_records: list[dict] = []

    for actor in ACTORS:
        sheet_path = ROOT / actor["sheet"]
        sheet_bytes = sheet_path.read_bytes()
        sheet, cell_width, cell_height = load_sheet(sheet_path)
        rows = crop_rows(sheet, cell_width, cell_height)
        crop_hashes = [
            sha256(frame.tobytes())
            for row in rows
            for frame in row
        ]
        if len(set(crop_hashes)) != GRID_COLUMNS * GRID_ROWS:
            raise ValueError(f"{sheet_path.name} contains duplicate grid cells")

        frames, durations = build_sequence(rows)
        gif_bytes = encode_gif(sheet, frames, durations)
        gif_name = actor["gif"]
        artifacts[gif_name] = gif_bytes

        with Image.open(io.BytesIO(gif_bytes)) as gif:
            gif_frame_count = getattr(gif, "n_frames", 1)
            gif_size = list(gif.size)
        if gif_frame_count != len(frames):
            raise ValueError(
                f"{gif_name} encoded {gif_frame_count} frames; expected {len(frames)}"
            )

        record = {
                "id": actor["id"],
                "displayName": actor["displayName"],
                "category": actor["category"],
                "signature": actor["signature"],
                "sheet": {
                    "path": actor["sheet"],
                    "width": sheet.width,
                    "height": sheet.height,
                    "sha256": sha256(sheet_bytes),
                    "distinctCellHashes": len(set(crop_hashes)),
                },
                "gif": {
                    "path": gif_name,
                    "width": gif_size[0],
                    "height": gif_size[1],
                    "frameCount": gif_frame_count,
                    "durationMs": sum(durations),
                    "sha256": sha256(gif_bytes),
                },
            }
        if actor.get("postprocess"):
            record["postprocess"] = actor["postprocess"]
        actor_records.append(record)

    manifest = {
        "assetId": "jrpg-party-enemy-animation-preview-standard-roster-v1",
        "status": "review-quality-generated-animation-concepts",
        "runtimeIntegration": "not-integrated",
        "grid": {
            "columns": GRID_COLUMNS,
            "rows": GRID_ROWS,
            "cellWidth": 256,
            "cellHeight": 256,
            "rowOrder": [action["id"] for action in ACTIONS],
        },
        "timing": [
            {
                "action": action["id"],
                "durationsMs": list(action["durationsMs"]),
                "repeats": action["repeats"],
                "finalHoldMs": action["finalHoldMs"],
            }
            for action in ACTIONS
        ],
        "actors": actor_records,
        "notes": [
            "GIFs are deterministic previews cropped from the 6x4 sheets.",
            "These generated concepts do not replace the canonical 48x64 runtime atlas.",
            "The Portuguese hidden-cross vampire-priest concept is mapped to canonical Father Mateus Avelar.",
            "This set includes the full seven-member party and all eight standard enemy families.",
            "Named bosses remain a separate animation-sheet pass.",
        ],
    }
    artifacts["manifest.json"] = (
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    ).encode("utf-8")
    return artifacts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify generated GIFs and manifest byte-for-byte without writing.",
    )
    args = parser.parse_args()
    artifacts = build_artifacts()
    if args.check:
        mismatches = [
            name
            for name, expected in artifacts.items()
            if not (ROOT / name).exists() or (ROOT / name).read_bytes() != expected
        ]
        if mismatches:
            raise SystemExit("animation preview mismatch: " + ", ".join(mismatches))
        print("animation preview artifacts verified")
        return

    for name, data in artifacts.items():
        (ROOT / name).write_bytes(data)
    print("generated " + ", ".join(artifacts))


if __name__ == "__main__":
    main()
