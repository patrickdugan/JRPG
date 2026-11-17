#!/usr/bin/env python3
"""Review renders for ``bbc-animation-clips/1`` manifests: contact sheets, GIFs, strips, onion skins.

All outputs are review artifacts (nearest-neighbour, integer scale) and must
never be loaded at runtime. They are deterministic, so builders can include
them in ``--check``.

* ``contact_sheet``: every frame of every clip in labeled rows; a coloured bar
  under each frame marks its band (windup amber, active red, recovery teal);
  a dot marks key frames; event names print under their frame.
* ``motion_gif``: plays clips at their manifest timing (or a fixed step) so
  arcs, easing, and holds can be judged in motion.
* ``frame_strip``: one clip as a single PNG row (GIF viewers often show only
  the first frame; strips are for inspection tools that read PNGs).
* ``onion_skin``: all frames of one clip ghosted over each other so arcs and
  spacing (slow-in/slow-out) are visible in a still image.

CLI::

    python anim_preview.py --manifest path/to/char.json --out-dir review/ [--scale 3] [--check]
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path
from typing import Mapping, Sequence

from PIL import Image, ImageDraw, ImageFont

from anim_sheet import frame_from_sheet, load_sheets, png_bytes, write_or_check

BACKGROUND = (11, 16, 32)
PANEL = (22, 30, 52)
TEXT = (215, 201, 154)
DIM = (120, 132, 150)
BAND_COLORS = {"windup": (236, 170, 60), "active": (226, 70, 70), "recovery": (90, 190, 186), None: (70, 80, 100)}


def _font() -> ImageFont.ImageFont:
    return ImageFont.load_default()


def union_bounds(manifest: Mapping, clip_ids: Sequence[str] | None = None) -> tuple[int, int, int, int]:
    """Smallest logical-cell box containing every frame of the chosen clips."""
    fx, fy = manifest["footPoint"]
    left = top = 10 ** 9
    right = bottom = -1
    for clip in manifest["clips"]:
        if clip_ids and clip["id"] not in clip_ids:
            continue
        for entry in clip["frames"]:
            x0 = fx - entry["pivot"][0]
            y0 = fy - entry["pivot"][1]
            left, top = min(left, x0), min(top, y0)
            right, bottom = max(right, x0 + entry["rect"][2]), max(bottom, y0 + entry["rect"][3])
    return left, top, right, bottom


def _cell(sheets, manifest, entry, box, scale, background=PANEL) -> Image.Image:
    frame = frame_from_sheet(sheets, manifest, entry).crop(box)
    tile = Image.new("RGBA", frame.size, background + (255,))
    tile.alpha_composite(frame)
    tile = tile.convert("RGB")
    return tile.resize((tile.width * scale, tile.height * scale), Image.Resampling.NEAREST) if scale != 1 else tile


def contact_sheet(manifest: Mapping, sheets: Sequence[Image.Image], scale: int = 2, columns: int = 15,
                  title: str | None = None) -> Image.Image:
    font = _font()
    box = union_bounds(manifest)
    cw, ch = (box[2] - box[0]) * scale, (box[3] - box[1]) * scale
    pad, label_h, bar_h, event_h = 4, 12, 4, 11
    cell_w, cell_h = cw + pad, label_h + ch + bar_h + event_h + pad
    rows = []
    for clip in manifest["clips"]:
        count = len(clip["frames"])
        rows.append((clip, (count + columns - 1) // columns))
    width = 8 + columns * cell_w
    header = 22
    height = header + sum(18 + lines * cell_h for _, lines in rows) + 6
    sheet = Image.new("RGB", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    draw.text((6, 5), title or f"{manifest['characterId'].upper()} - CLIP REVIEW (NOT RUNTIME)", fill=TEXT, font=font)
    y = header
    for clip, lines in rows:
        bands = " / ".join(f"{band['name']} {band['count']}" for band in clip.get("bands", []))
        label = (f"{clip['id']}  [{clip['kind']}]  {clip['frameCount']} frames, {clip['uniqueFrames']} unique, "
                 f"{clip['durationMs']} ms nominal" + (f"  |  {bands}" if bands else ""))
        draw.text((6, y + 3), label, fill=(246, 232, 185), font=font)
        y += 18
        for index, entry in enumerate(clip["frames"]):
            col, line = index % columns, index // columns
            x0, y0 = 6 + col * cell_w, y + line * cell_h
            draw.text((x0, y0), f"{index:02d}", fill=DIM, font=font)
            if entry.get("key"):
                draw.rectangle((x0 + 16, y0 + 3, x0 + 19, y0 + 6), fill=(246, 232, 185))
            sheet.paste(_cell(sheets, manifest, entry, box, scale), (x0, y0 + label_h))
            draw.rectangle((x0, y0 + label_h + ch + 1, x0 + cw - 1, y0 + label_h + ch + bar_h - 1),
                           fill=BAND_COLORS.get(entry.get("band"), BAND_COLORS[None]))
            if entry.get("events"):
                draw.text((x0, y0 + label_h + ch + bar_h), ",".join(entry["events"])[:max(4, cw // 6)],
                          fill=(226, 120, 120), font=font)
        y += lines * cell_h
    return sheet


def frame_strip(manifest: Mapping, sheets: Sequence[Image.Image], clip_id: str, scale: int = 2) -> Image.Image:
    clip = next(item for item in manifest["clips"] if item["id"] == clip_id)
    box = union_bounds(manifest, [clip_id])
    cells = [_cell(sheets, manifest, entry, box, scale) for entry in clip["frames"]]
    strip = Image.new("RGB", (sum(cell.width + 2 for cell in cells), cells[0].height + 6), BACKGROUND)
    x = 0
    for entry, cell in zip(clip["frames"], cells):
        strip.paste(cell, (x, 0))
        ImageDraw.Draw(strip).rectangle((x, cell.height + 1, x + cell.width - 1, cell.height + 5),
                                        fill=BAND_COLORS.get(entry.get("band"), BAND_COLORS[None]))
        x += cell.width + 2
    return strip


def onion_skin(manifest: Mapping, sheets: Sequence[Image.Image], clip_id: str, scale: int = 3,
               band: str | None = None) -> Image.Image:
    """Ghost every frame (older = dimmer); the final frame is drawn solid on top."""
    clip = next(item for item in manifest["clips"] if item["id"] == clip_id)
    entries = [entry for entry in clip["frames"] if band is None or entry.get("band") == band]
    box = union_bounds(manifest, [clip_id])
    size = (box[2] - box[0], box[3] - box[1])
    canvas = Image.new("RGBA", size, PANEL + (255,))
    count = len(entries)
    for index, entry in enumerate(entries):
        frame = frame_from_sheet(sheets, manifest, entry).crop(box)
        if index < count - 1:
            strength = 40 + int(110 * (index + 1) / count)
            alpha = frame.getchannel("A").point(lambda value, s=strength: s if value else 0)
            frame.putalpha(alpha)
        canvas.alpha_composite(frame)
    canvas = canvas.convert("RGB")
    return canvas.resize((size[0] * scale, size[1] * scale), Image.Resampling.NEAREST)


def motion_gif(manifest: Mapping, sheets: Sequence[Image.Image], clip_ids: Sequence[str] | None = None,
               scale: int = 3, step_ms: int | None = None, repeats_for_loops: int = 2) -> bytes:
    """Animated GIF of clips in order. ``step_ms`` shows every frame for a fixed time instead."""
    font = _font()
    clips = [clip for clip in manifest["clips"] if not clip_ids or clip["id"] in clip_ids]
    box = union_bounds(manifest, [clip["id"] for clip in clips])
    frames, durations = [], []
    for clip in clips:
        sequence = clip["frames"] * (repeats_for_loops if clip["loop"] else 1)
        for index, entry in enumerate(sequence):
            cell = _cell(sheets, manifest, entry, box, scale, background=BACKGROUND)
            canvas = Image.new("RGB", (cell.width, cell.height + 14), BACKGROUND)
            canvas.paste(cell, (0, 14))
            draw = ImageDraw.Draw(canvas)
            band = entry.get("band") or ""
            draw.text((3, 2), f"{clip['id']} {index % len(clip['frames']):02d} {band}", fill=TEXT, font=font)
            draw.rectangle((0, 12, canvas.width - 1, 13), fill=BAND_COLORS.get(entry.get("band"), BAND_COLORS[None]))
            frames.append(canvas.convert("P", palette=Image.Palette.ADAPTIVE, colors=128))
            duration = step_ms if step_ms else entry["durationMs"]
            durations.append(max(20, int(round(duration / 10.0)) * 10))
        # brief hold between clips so the reviewer can see the clip boundary
        durations[-1] = max(durations[-1], 400)
    stream = io.BytesIO()
    frames[0].save(stream, format="GIF", save_all=True, append_images=frames[1:], duration=durations,
                   loop=0, disposal=1, optimize=False)
    return stream.getvalue()


def review_outputs(manifest: Mapping, sheets: Sequence[Image.Image], out_dir: Path, scale: int = 3,
                   strips: bool = True, onions: bool = True, gifs: bool = True) -> dict[Path, bytes]:
    stem = manifest["characterId"]
    outputs: dict[Path, bytes] = {out_dir / f"{stem}-contact.png": png_bytes(contact_sheet(manifest, sheets))}
    for clip in manifest["clips"]:
        if strips:
            outputs[out_dir / f"{stem}-{clip['id']}-strip.png"] = png_bytes(frame_strip(manifest, sheets, clip["id"]))
        if onions:
            outputs[out_dir / f"{stem}-{clip['id']}-onion.png"] = png_bytes(onion_skin(manifest, sheets, clip["id"]))
        if gifs:
            outputs[out_dir / f"{stem}-{clip['id']}.gif"] = motion_gif(manifest, sheets, [clip["id"]], scale=scale)
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--scale", type=int, default=3)
    parser.add_argument("--no-gif", action="store_true")
    parser.add_argument("--check", action="store_true", help="verify existing review files instead of writing")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    sheets = load_sheets(args.manifest, manifest)
    outputs = review_outputs(manifest, sheets, args.out_dir, scale=args.scale, gifs=not args.no_gif)
    return write_or_check(outputs, args.check, label=f"{manifest['characterId']} review")


if __name__ == "__main__":
    sys.exit(main())
