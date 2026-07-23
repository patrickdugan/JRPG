from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def parse_size(value: str) -> tuple[int, int]:
    try:
        width, height = (int(part) for part in value.lower().split("x", 1))
    except (TypeError, ValueError) as error:
        raise argparse.ArgumentTypeError("size must be WIDTHxHEIGHT") from error
    return width, height


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit pixel-art raster constraints.")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--expected-size", type=parse_size)
    parser.add_argument("--max-colors", type=int)
    parser.add_argument("--require-binary-alpha", action="store_true")
    parser.add_argument("--require-opaque-alpha", action="store_true")
    parser.add_argument("--native-source", type=Path)
    parser.add_argument("--preview-scale", type=int)
    args = parser.parse_args()

    with Image.open(args.input) as opened:
        image = opened.convert("RGBA")
        mode = opened.mode
    rgba_colors = image.getcolors(maxcolors=image.width * image.height)
    actual_colors = len(rgba_colors) if rgba_colors is not None else None
    alpha_values = sorted(set(image.getchannel("A").getdata()))
    failures: list[str] = []

    if args.expected_size and image.size != args.expected_size:
        failures.append(f"size {image.size} != expected {args.expected_size}")
    if args.max_colors is not None and (actual_colors is None or actual_colors > args.max_colors):
        failures.append(f"colors {actual_colors} exceed maximum {args.max_colors}")
    if args.require_binary_alpha and not set(alpha_values).issubset({0, 255}):
        failures.append("alpha is not binary")
    if args.require_opaque_alpha and set(alpha_values) != {255}:
        failures.append("alpha is not fully opaque")

    nearest_preview_matches = None
    if args.native_source or args.preview_scale:
        if not args.native_source or not args.preview_scale:
            failures.append("--native-source and --preview-scale must be used together")
        else:
            with Image.open(args.native_source) as native_opened:
                native = native_opened.convert("RGBA")
            expected = native.resize(
                (native.width * args.preview_scale, native.height * args.preview_scale),
                Image.Resampling.NEAREST,
            )
            nearest_preview_matches = image.size == expected.size and image.tobytes() == expected.tobytes()
            if not nearest_preview_matches:
                failures.append("preview is not an exact nearest-neighbor enlargement")

    report = {
        "path": str(args.input.resolve()),
        "width": image.width,
        "height": image.height,
        "mode": mode,
        "actualColors": actual_colors,
        "alphaValueCount": len(alpha_values),
        "binaryAlpha": set(alpha_values).issubset({0, 255}),
        "opaqueAlpha": set(alpha_values) == {255},
        "nearestPreviewMatches": nearest_preview_matches,
        "status": "pass" if not failures else "fail",
        "failures": failures,
    }
    print(json.dumps(report, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
