#!/usr/bin/env python3
"""Review-only composites: level floor colour + terrain overlays + resolved prop dressing.

Runs the real runtime resolver (game/field-prop-dressing.mjs) through Node, then
composes each requested level at native 16 px cells and enlarges it with
nearest-neighbour scaling. Undressed impassable cells keep drawMap()'s dark
inset so gaps stay visible. Outputs are review artefacts, never runtime art.

    python render_level_previews.py --out <dir> [--scale 3] [level-id ...]
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
GAME = REPO / "game"
ATLAS = ROOT / "field-prop-atlas.png"
TERRAIN_ATLAS = REPO / "assets" / "art" / "field-terrain-suite" / "field-terrain-atlas.png"
NPC_ATLAS = REPO / "assets" / "art" / "npc-field-suite" / "npc-field-atlas.png"
CELL = 16
DEFAULT_LEVELS = [
    "hsh-river-lane", "tkm-rain-gate", "krh-audience-hall", "kgr-requisition-town",
    "tkm-cell-block", "kgr-prison-locks", "krh-bell-spine", "sdg-market-lane",
]
TERRAIN_COLORS = {
    "shallow-puddle": "#24546b", "paper-litter": "#7d7361", "cracked-board": "#624a3c",
    "swing-beam-lane": "#765947", "water": "#24546b", "storm-water": "#39718a", "cold-pool": "#5b9ab2",
    "ash-field": "#4a4146", "ember-ash": "#79433a", "umbral-ash": "#382c4b", "bell-node": "#5c4b2d",
    "furnace-grate": "#773f2f", "legal-seal": "#7d3540", "flowing-water": "#2d7490", "high-gallery": "#2a2433",
    "archive-floor": "#5b4a3e", "dry-lantern": "#6f5a35",
}
TERRAIN_ORDER = [
    "stone", "wet-stone", "shallow-puddle", "paper-litter", "cracked-board",
    "swing-beam-lane", "water", "storm-water", "cold-pool", "ash-field",
    "ember-ash", "umbral-ash", "bell-node", "furnace-grate", "legal-seal",
    "flowing-water", "high-gallery", "archive-floor", "dry-lantern",
]

NODE_SCRIPT = r"""
import { LEVELS, TERRAIN_TAGS } from './content/levels.mjs';
import { resolveFieldPropDressing, fieldPropDressingCoverage } from './field-prop-dressing.mjs';
import { getFieldPropFrame } from './field-prop-atlas.mjs';
const wanted = JSON.parse(process.argv[1]);
const out = [];
for (const level of LEVELS) {
  if (wanted.length && !wanted.includes(level.id)) continue;
  const dressing = resolveFieldPropDressing(level);
  const impassable = new Set(level.blocked);
  for (const tile of level.terrain) if (TERRAIN_TAGS[tile.tag]?.passable === false) impassable.add(tile.at);
  out.push({
    id: level.id, name: level.name, kind: level.kind, width: level.width, height: level.height,
    palette: level.palette, terrain: level.terrain, impassable: [...impassable],
    exits: level.exits.map((e) => e.at), interactables: level.interactables.map((i) => i.at),
    spawn: level.spawn ? `${level.spawn.x},${level.spawn.y}` : null,
    themeId: dressing.themeId, familyId: dressing.familyId,
    coverage: fieldPropDressingCoverage(level, dressing),
    placements: dressing.placements.map((p) => ({ ...p, frame: getFieldPropFrame(p.frameId) })),
  });
}
process.stdout.write(JSON.stringify(out));
"""


def hex_rgba(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def blend(base, top, alpha: float):
    return tuple(round(base[i] * (1 - alpha) + top[i] * alpha) for i in range(3)) + (255,)


def resolve(levels: list[str]) -> list[dict]:
    result = subprocess.run(
        ["node", "--input-type=module", "-e", NODE_SCRIPT, json.dumps(levels)],
        cwd=GAME, check=True, capture_output=True, text=True, encoding="utf-8",
    )
    return json.loads(result.stdout)


def compose(level: dict, atlas: Image.Image, terrain_atlas: Image.Image, npc: Image.Image) -> Image.Image:
    width, height = level["width"], level["height"]
    palette = level["palette"]
    floor = hex_rgba(palette.get("ground", "#23314a"))
    shadow = hex_rgba(palette.get("shadow", "#101624"))
    image = Image.new("RGBA", (width * CELL, height * CELL), (8, 12, 22, 255))
    draw = ImageDraw.Draw(image)
    terrain = {entry["at"]: entry["tag"] for entry in level["terrain"]}
    impassable = set(level["impassable"])
    dressed = {cell for placement in level["placements"] for cell in placement["cells"]}
    for y in range(height):
        for x in range(width):
            key = f"{x},{y}"
            tag = terrain.get(key, "stone")
            base = hex_rgba(TERRAIN_COLORS[tag]) if tag in TERRAIN_COLORS else floor
            base = blend(base, (255, 255, 255) if (x + y) % 2 else (0, 0, 0), 0.035)
            px, py = x * CELL, y * CELL
            draw.rectangle((px, py, px + CELL - 1, py + CELL - 1), fill=base)
            index = TERRAIN_ORDER.index(tag) if tag in TERRAIN_ORDER else 0
            tile = terrain_atlas.crop(((index % 5) * CELL, (index // 5) * CELL, (index % 5 + 1) * CELL, (index // 5 + 1) * CELL))
            image.alpha_composite(tile, (px, py))
            if key in impassable and key not in dressed:
                draw.rectangle((px + 1, py + 1, px + CELL - 2, py + CELL - 2), fill=shadow)
                draw.rectangle((px + 2, py + 2, px + CELL - 3, py + 3), fill=blend(shadow, (255, 255, 255), 0.13))
    for placement in level["placements"]:
        frame = placement["frame"]
        crop = atlas.crop((frame["x"], frame["y"], frame["x"] + frame["width"], frame["y"] + frame["height"]))
        image.alpha_composite(crop, (placement["x"] * CELL, placement["y"] * CELL))
    for key in level["exits"]:
        x, y = (int(v) for v in key.split(","))
        draw.rectangle((x * CELL + 2, y * CELL + 2, x * CELL + CELL - 3, y * CELL + CELL - 3), outline=(114, 215, 208, 255))
    for key in level["interactables"]:
        x, y = (int(v) for v in key.split(","))
        cx, cy = x * CELL + 8, y * CELL + 8
        draw.polygon([(cx, cy - 3), (cx + 3, cy), (cx, cy + 3), (cx - 3, cy)], fill=(244, 190, 92, 255))
    if level["spawn"]:
        x, y = (int(v) for v in level["spawn"].split(","))
        figure = npc.crop((0, 0, 32, 48)).resize((14, 21), Image.Resampling.BOX)
        alpha = figure.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
        figure.putalpha(alpha)
        image.alpha_composite(figure, (x * CELL + 1, y * CELL + CELL - 20))
    return image


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("levels", nargs="*")
    parser.add_argument("--out", required=True)
    parser.add_argument("--scale", type=int, default=3)
    parser.add_argument("--sheet", default="", help="also write one labelled sheet with every rendered level")
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    atlas = Image.open(ATLAS).convert("RGBA")
    terrain_atlas = Image.open(TERRAIN_ATLAS).convert("RGBA")
    npc = Image.open(NPC_ATLAS).convert("RGBA")
    font = ImageFont.load_default()
    rendered = []
    for level in resolve(args.levels or DEFAULT_LEVELS):
        image = compose(level, atlas, terrain_atlas, npc)
        big = image.resize((image.width * args.scale, image.height * args.scale), Image.Resampling.NEAREST)
        label_h = 18
        framed = Image.new("RGBA", (big.width, big.height + label_h), (17, 21, 34, 255))
        framed.alpha_composite(big, (0, label_h))
        coverage = level["coverage"]
        ImageDraw.Draw(framed).text(
            (6, 3),
            f"{level['id']} - {level['name']} | {level['themeId']} ({level['familyId']}) | dressed {coverage['dressedCells']}/{coverage['impassableCells']}",
            font=font, fill=(246, 232, 185, 255),
        )
        path = out / f"{level['id']}-props-{args.scale}x.png"
        framed.save(path)
        rendered.append(framed)
        print(path)
    if args.sheet and rendered:
        columns = 2
        cell_w = max(image.width for image in rendered)
        cell_h = max(image.height for image in rendered)
        rows = (len(rendered) + columns - 1) // columns
        sheet = Image.new("RGBA", (columns * cell_w + (columns + 1) * 8, rows * cell_h + (rows + 1) * 8), (8, 10, 18, 255))
        for index, image in enumerate(rendered):
            sheet.alpha_composite(image, (8 + (index % columns) * (cell_w + 8), 8 + (index // columns) * (cell_h + 8)))
        sheet.save(out / args.sheet)
        print(out / args.sheet)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
