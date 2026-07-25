from __future__ import annotations

import argparse
import hashlib
import io
import json
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "kyoto-route-junction.source.json"
BUILDER_PATH = Path(__file__).resolve()
BASE_NAME = "kyoto-route-junction-base-v1.png"
ALL_EXITS_NAME = "kyoto-route-junction-all-exits-v1.png"
PREVIEW_NAME = "kyoto-route-junction-preview-v1.png"
SPRITE_NAME = "kyoto-route-junction-party-atlas-v1.png"
MANIFEST_NAME = "manifest.json"

FONT = {
    "A": ("010", "101", "111", "101", "101"),
    "B": ("110", "101", "110", "101", "110"),
    "C": ("011", "100", "100", "100", "011"),
    "D": ("110", "101", "101", "101", "110"),
    "E": ("111", "100", "110", "100", "111"),
    "F": ("111", "100", "110", "100", "100"),
    "G": ("011", "100", "101", "101", "011"),
    "H": ("101", "101", "111", "101", "101"),
    "I": ("111", "010", "010", "010", "111"),
    "J": ("001", "001", "001", "101", "010"),
    "K": ("101", "101", "110", "101", "101"),
    "L": ("100", "100", "100", "100", "111"),
    "M": ("101", "111", "111", "101", "101"),
    "N": ("101", "111", "111", "111", "101"),
    "O": ("010", "101", "101", "101", "010"),
    "P": ("110", "101", "110", "100", "100"),
    "Q": ("010", "101", "101", "011", "001"),
    "R": ("110", "101", "110", "101", "101"),
    "S": ("011", "100", "010", "001", "110"),
    "T": ("111", "010", "010", "010", "010"),
    "U": ("101", "101", "101", "101", "111"),
    "V": ("101", "101", "101", "101", "010"),
    "W": ("101", "101", "111", "111", "101"),
    "X": ("101", "101", "010", "101", "101"),
    "Y": ("101", "101", "010", "010", "010"),
    "Z": ("111", "001", "010", "100", "111"),
    "0": ("111", "101", "101", "101", "111"),
    "1": ("010", "110", "010", "010", "111"),
    "2": ("110", "001", "010", "100", "111"),
    "3": ("110", "001", "010", "001", "110"),
    "-": ("000", "000", "111", "000", "000"),
    "/": ("001", "001", "010", "100", "100"),
    " ": ("000",) * 5,
}


def sha256_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rgba(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (alpha,)


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def save_png(image: Image.Image, path: Path) -> None:
    path.write_bytes(png_bytes(image))


def draw_text(
    draw: ImageDraw.ImageDraw,
    position: tuple[int, int],
    text: str,
    color: tuple[int, int, int, int],
    scale: int = 1,
) -> None:
    cursor, y = position
    for character in text.upper():
        glyph = FONT.get(character, FONT[" "])
        for row, bits in enumerate(glyph):
            for column, bit in enumerate(bits):
                if bit == "1":
                    draw.rectangle(
                        (
                            cursor + column * scale,
                            y + row * scale,
                            cursor + column * scale + scale - 1,
                            y + row * scale + scale - 1,
                        ),
                        fill=color,
                    )
        cursor += 4 * scale


def centered_text(
    draw: ImageDraw.ImageDraw,
    center_x: int,
    y: int,
    text: str,
    color: tuple[int, int, int, int],
    scale: int = 1,
) -> None:
    width = max(0, len(text) * 4 * scale - scale)
    draw_text(draw, (center_x - width // 2, y), text, color, scale)


def draw_banner(
    draw: ImageDraw.ImageDraw,
    center_x: int,
    y: int,
    label: str,
    accent: tuple[int, int, int, int],
    palette: dict,
) -> None:
    width = len(label) * 4 + 11
    left = center_x - width // 2
    right = center_x + width // 2
    draw.polygon(
        ((left - 5, y + 3), (left, y), (right, y), (right + 5, y + 3), (right, y + 10), (left, y + 10)),
        fill=palette["ink"],
    )
    draw.rectangle((left, y + 1, right, y + 9), outline=palette["stoneLight"])
    draw.rectangle((left + 2, y + 2, left + 4, y + 8), fill=accent)
    centered_text(draw, center_x + 2, y + 3, label, palette["white"])


def draw_torii(draw: ImageDraw.ImageDraw, x: int, y: int, palette: dict, small: bool = False) -> None:
    scale = 1 if small else 2
    width = 23 * scale
    draw.rectangle((x, y + 4 * scale, x + width, y + 6 * scale), fill=palette["ink"])
    draw.rectangle((x - 2 * scale, y + 2 * scale, x + width + 2 * scale, y + 4 * scale), fill=palette["red"])
    draw.rectangle((x + 4 * scale, y + 6 * scale, x + 6 * scale, y + 18 * scale), fill=palette["woodDark"])
    draw.rectangle((x + width - 6 * scale, y + 6 * scale, x + width - 4 * scale, y + 18 * scale), fill=palette["woodDark"])
    draw.rectangle((x + 3 * scale, y + 7 * scale, x + 7 * scale, y + 9 * scale), fill=palette["redLight"])
    draw.rectangle((x + width - 7 * scale, y + 7 * scale, x + width - 3 * scale, y + 9 * scale), fill=palette["redLight"])


def draw_shrine_lantern(draw: ImageDraw.ImageDraw, x: int, y: int, palette: dict) -> None:
    draw.rectangle((x + 3, y + 8, x + 5, y + 17), fill=palette["stoneDark"])
    draw.rectangle((x, y + 5, x + 8, y + 9), fill=palette["stone"])
    draw.polygon(((x - 1, y + 5), (x + 4, y), (x + 9, y + 5)), fill=palette["stoneLight"])
    draw.rectangle((x + 3, y + 3, x + 5, y + 6), fill=palette["holy"])


def draw_scene(spec: dict, palette: dict, colored_exits: bool) -> Image.Image:
    width = spec["geometry"]["nativeWidth"]
    height = spec["geometry"]["nativeHeight"]
    image = Image.new("RGBA", (width, height), palette["skyDeep"])
    draw = ImageDraw.Draw(image)

    # Layered dusk sky.
    draw.rectangle((0, 23, width - 1, 58), fill=palette["sky"])
    draw.rectangle((0, 59, width - 1, 91), fill=palette["skyLight"])
    for x, y in ((11, 17), (27, 35), (52, 14), (82, 27), (111, 12), (201, 18), (236, 31), (285, 14), (307, 39)):
        draw.point((x, y), fill=palette["white"])
        if x % 2:
            draw.point((x + 1, y), fill=palette["moon"])
    draw.ellipse((263, 13, 292, 42), fill=palette["moon"])
    draw.rectangle((263, 28, 292, 42), fill=palette["sky"])
    draw.rectangle((271, 16, 275, 18), fill=palette["paper"])
    draw.rectangle((286, 24, 289, 26), fill=palette["paper"])

    # Hard-edged clouds and parallax ridges.
    draw.polygon(((7, 57), (24, 45), (40, 51), (56, 37), (79, 57)), fill=palette["cloud"])
    draw.polygon(((180, 55), (202, 38), (220, 49), (241, 33), (272, 56)), fill=palette["cloud"])
    far_ridge = (
        (0, 76), (23, 61), (46, 69), (69, 52), (91, 70), (116, 58), (143, 73),
        (169, 54), (194, 70), (221, 57), (245, 73), (274, 51), (320, 72), (320, 104), (0, 104),
    )
    draw.polygon(far_ridge, fill=palette["mountainFar"])
    near_ridge = (
        (0, 94), (31, 75), (59, 90), (89, 69), (122, 91), (150, 75),
        (180, 94), (214, 74), (246, 92), (283, 68), (320, 88), (320, 121), (0, 121),
    )
    draw.polygon(near_ridge, fill=palette["mountain"])
    for x in range(8, 315, 23):
        peak = 76 + (x * 7) % 15
        draw.line((x, peak, x + 6, peak - 4), fill=palette["stone"])

    # Harbor and southern ravine establish three genuinely different exits.
    draw.rectangle((0, 121, 100, 179), fill=palette["sea"])
    for y in range(128, 178, 8):
        for x in range(4 + (y % 3), 96, 17):
            draw.line((x, y, x + 8, y), fill=palette["seaLight"])
    draw.polygon(((225, 121), (320, 111), (320, 180), (245, 180)), fill=palette["mossDark"])
    for x in range(247, 318, 12):
        draw.polygon(((x, 135), (x + 4, 120 - (x % 7)), (x + 8, 135)), fill=palette["moss"])

    # Central wayside platform.
    draw.polygon(((94, 113), (226, 113), (246, 159), (75, 159)), fill=palette["stoneDark"])
    draw.polygon(((102, 116), (218, 116), (232, 151), (87, 151)), fill=palette["stone"])
    for x in range(94, 226, 14):
        draw.line((x, 118, x + 8, 149), fill=palette["stoneDark"])
    draw.line((88, 150, 232, 150), fill=palette["stoneLight"], width=2)

    # North stair rises to a torii.
    for step in range(12):
        y = 119 - step * 5
        half = 19 - step // 2
        draw.rectangle((160 - half, y, 160 + half, y + 3), fill=palette["stoneDark"])
        draw.line((160 - half + 1, y, 160 + half - 1, y), fill=palette["stoneLight"])
    draw_torii(draw, 139, 28, palette)
    draw_shrine_lantern(draw, 128, 69, palette)
    draw_shrine_lantern(draw, 183, 69, palette)

    # Sea stair descends down-left to a timber quay.
    for step in range(9):
        x = 143 - step * 10
        y = 126 + step * 4
        draw.polygon(((x - 10, y), (x + 7, y), (x + 1, y + 5), (x - 16, y + 5)), fill=palette["stoneDark"])
        draw.line((x - 9, y, x + 6, y), fill=palette["stoneLight"])
    draw.rectangle((26, 158, 89, 164), fill=palette["woodDark"])
    for x in range(30, 90, 12):
        draw.rectangle((x, 161, x + 2, 176), fill=palette["wood"])
    draw.line((42, 123, 42, 157), fill=palette["wood"], width=2)
    draw.polygon(((43, 126), (62, 139), (43, 139)), fill=palette["paper"])
    draw.polygon(((19, 156), (74, 156), (66, 164), (30, 164)), fill=palette["ink"])

    # South stair descends down-right through a smaller gate.
    for step in range(9):
        x = 177 + step * 10
        y = 126 + step * 4
        draw.polygon(((x - 7, y), (x + 10, y), (x + 16, y + 5), (x - 1, y + 5)), fill=palette["stoneDark"])
        draw.line((x - 6, y, x + 9, y), fill=palette["stoneLight"])
    draw_torii(draw, 265, 133, palette, small=True)

    # Central route stone and scene dressing.
    draw.polygon(((151, 112), (169, 112), (166, 137), (154, 137)), fill=palette["ink"])
    draw.polygon(((153, 111), (167, 111), (165, 134), (155, 134)), fill=palette["stoneLight"])
    draw.polygon(((160, 114), (164, 119), (160, 124), (156, 119)), fill=palette["holy"])
    draw_shrine_lantern(draw, 103, 119, palette)
    draw_shrine_lantern(draw, 208, 119, palette)

    # Route banners and a player-readable input legend.
    draw_banner(draw, 48, 101, "SEA", palette["routeSea"], palette)
    draw_banner(draw, 160, 10, "NORTH", palette["routeNorth"], palette)
    draw_banner(draw, 273, 101, "SOUTH", palette["routeSouth"], palette)
    draw.rectangle((6, 6, 107, 19), fill=palette["ink"])
    draw.rectangle((7, 7, 106, 18), outline=palette["stoneLight"])
    draw_text(draw, (12, 10), "THE THREE WAYS", palette["white"])

    if colored_exits:
        for route in spec["junction"]["routes"]:
            color = palette[route["color"]]
            points = [tuple(point) for point in route["path"]]
            draw.line(points, fill=palette["ink"], width=5, joint="curve")
            draw.line(points, fill=color, width=2, joint="curve")
            end_x, end_y = points[-1]
            draw.rectangle((end_x - 3, end_y - 3, end_x + 3, end_y + 3), fill=palette["ink"])
            draw.rectangle((end_x - 1, end_y - 1, end_x + 1, end_y + 1), fill=color)
    return image


def draw_party_frame(role: str, pose: int, palette: dict) -> Image.Image:
    image = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    ink = palette["ink"]
    leg_shift = (-1, 1, 0, 0)[pose]
    arm_shift = (0, 1, -1, -2)[pose]
    if role == "leader":
        # Lance, dark hair, light armor, and red sash.
        draw.line((13, 1, 13, 22), fill=ink, width=2)
        draw.line((13, 0, 13, 20), fill=palette["holy"])
        draw.polygon(((13, 0), (10, 4), (15, 3)), fill=palette["white"])
        draw.rectangle((5, 3, 10, 8), fill=ink)
        draw.rectangle((6, 5, 10, 9), fill=palette["skin"])
        draw.point((9, 6), fill=ink)
        draw.rectangle((5, 9, 11, 16), fill=palette["armor"])
        draw.rectangle((6, 10, 10, 14), fill=palette["stoneLight"])
        draw.rectangle((4, 14, 11, 16), fill=palette["red"])
        draw.line((5 + arm_shift, 11, 2 + arm_shift, 16), fill=palette["skin"], width=2)
        draw.line((10, 11, 13, 13), fill=palette["skin"], width=2)
        draw.line((6, 16, 5 + leg_shift, 22), fill=ink, width=2)
        draw.line((10, 16, 11 - leg_shift, 22), fill=ink, width=2)
    else:
        # Support character: hooded wine coat and a small lantern.
        draw.polygon(((4, 3), (8, 1), (12, 4), (11, 9), (5, 9)), fill=ink)
        draw.rectangle((6, 5, 10, 9), fill=palette["skin"])
        draw.point((9, 6), fill=ink)
        draw.polygon(((4, 9), (11, 9), (13, 18), (3, 18)), fill=palette["support"])
        draw.line((5 + arm_shift, 11, 2 + arm_shift, 15), fill=palette["skin"], width=2)
        draw.rectangle((0 + arm_shift, 15, 3 + arm_shift, 19), fill=ink)
        draw.point((1 + arm_shift, 16), fill=palette["holy"])
        draw.line((10, 12, 13, 16), fill=palette["skin"], width=2)
        draw.line((6, 18, 5 + leg_shift, 23), fill=ink, width=2)
        draw.line((10, 18, 11 - leg_shift, 23), fill=ink, width=2)
    return image


def build_sprite_atlas(spec: dict, palette: dict) -> Image.Image:
    frame_width = spec["geometry"]["spriteWidth"]
    frame_height = spec["geometry"]["spriteHeight"]
    atlas = Image.new("RGBA", (frame_width * 8, frame_height), (0, 0, 0, 0))
    for role_index, role in enumerate(("leader", "support")):
        for pose in range(4):
            atlas.alpha_composite(draw_party_frame(role, pose, palette), ((role_index * 4 + pose) * frame_width, 0))
    return atlas


def visible_colors(image: Image.Image) -> int:
    return len({pixel[:3] for pixel in image.getdata() if pixel[3]})


def build(output_root: Path) -> list[Path]:
    spec = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    palette = {key: rgba(value) for key, value in spec["palette"].items()}
    base = draw_scene(spec, palette, False)
    all_exits = draw_scene(spec, palette, True)
    sprites = build_sprite_atlas(spec, palette)
    review = all_exits.copy()
    review.alpha_composite(sprites.crop((0, 0, 16, 24)), (152, 105))
    review.alpha_composite(sprites.crop((64, 0, 80, 24)), (137, 108))
    preview_scale = spec["geometry"]["previewScale"]
    preview = review.resize(
        (review.width * preview_scale, review.height * preview_scale),
        Image.Resampling.NEAREST,
    )

    output_root.mkdir(parents=True, exist_ok=True)
    records = (
        (BASE_NAME, base, "opaque-native-runtime-background"),
        (ALL_EXITS_NAME, all_exits, "opaque-native-three-exit-review"),
        (PREVIEW_NAME, preview, "nearest-neighbor-review-with-duo"),
        (SPRITE_NAME, sprites, "binary-alpha-duo-runtime-atlas"),
    )
    for name, image, _purpose in records:
        save_png(image, output_root / name)

    manifest = {
        "schemaVersion": 1,
        "assetId": spec["assetId"],
        "status": spec["status"],
        "provenance": {
            "classification": spec["classification"],
            "sourceMethod": (
                "original code-native pixel primitives at 320x180; eight 16x24 duo frames; "
                "integer-aligned scene geometry and route overlays"
            ),
            "generatorUsed": False,
            "originalityPolicy": spec["originalityPolicy"],
        },
        "source": {
            "path": SOURCE_PATH.name,
            "sha256": sha256_path(SOURCE_PATH),
        },
        "geometry": spec["geometry"],
        "palette": {
            "ceiling": len(spec["palette"]),
            "colors": spec["palette"],
        },
        "spriteFrameOrder": spec["spriteFrameOrder"],
        "junction": spec["junction"],
        "choicePolicy": spec["choicePolicy"],
        "outputs": [
            {
                "path": name,
                "sha256": sha256_path(output_root / name),
                "dimensions": list(image.size),
                "actualColors": visible_colors(image),
                "alphaValues": sorted(set(image.getchannel("A").getdata())),
                "purpose": purpose,
            }
            for name, image, purpose in records
        ],
        "builder": {
            "path": BUILDER_PATH.name,
            "sha256": sha256_path(BUILDER_PATH),
            "pillowVersion": PILLOW_VERSION,
            "deterministic": True,
            "integerAligned": True,
            "nativeResampling": "none",
            "previewResampling": "nearest-neighbor",
        },
    }
    (output_root / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return [Path(name) for name, _image, _purpose in records] + [Path(MANIFEST_NAME)]


def check() -> None:
    with tempfile.TemporaryDirectory(prefix="kyoto-route-junction-check-") as temp:
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
    print("Deterministic check passed: all Kyoto route-junction outputs are byte-identical.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the three-exit Kyoto route junction.")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
    else:
        build(ROOT)
        print("Built native stair junction, three-exit review, duo atlas, preview, and manifest.")


if __name__ == "__main__":
    main()
