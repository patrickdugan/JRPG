from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path

from PIL import Image, ImageColor, __version__ as PILLOW_VERSION


TOOL_VERSION = "1.0.0"
RESAMPLERS = {
    "box": Image.Resampling.BOX,
    "nearest": Image.Resampling.NEAREST,
    "lanczos": Image.Resampling.LANCZOS,
}
DITHERS = {
    "none": Image.Dither.NONE,
    "floyd-steinberg": Image.Dither.FLOYDSTEINBERG,
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def portable_path(path: Path, base: Path) -> str:
    try:
        relative = os.path.relpath(path.resolve(), start=base.resolve())
    except ValueError:
        return str(path.resolve())
    return Path(relative).as_posix()


def parse_size(value: str) -> tuple[int, int]:
    try:
        width_text, height_text = value.lower().split("x", 1)
        width, height = int(width_text), int(height_text)
    except (TypeError, ValueError) as error:
        raise argparse.ArgumentTypeError("size must be WIDTHxHEIGHT") from error
    if width <= 0 or height <= 0:
        raise argparse.ArgumentTypeError("size dimensions must be positive")
    return width, height


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def load_palette(path: Path) -> tuple[list[tuple[int, int, int]], bytes]:
    data = path.read_bytes()
    payload = json.loads(data.decode("utf-8"))
    values = payload.get("colors") if isinstance(payload, dict) else payload
    if not isinstance(values, list) or not values:
        raise ValueError("palette JSON must be a non-empty array or contain a colors array")
    if len(values) > 256:
        raise ValueError("palette JSON cannot contain more than 256 colors")
    colors = [ImageColor.getrgb(str(value)) for value in values]
    return colors, data


def palette_image(colors: list[tuple[int, int, int]]) -> Image.Image:
    palette = Image.new("P", (1, 1))
    padded = list(colors)
    padded.extend([colors[-1]] * (256 - len(colors)))
    palette.putpalette([channel for color in padded for channel in color])
    return palette


def fit_rgba(
    source: Image.Image,
    target: tuple[int, int],
    resample: Image.Resampling,
    fit: str,
    matte: tuple[int, int, int],
) -> Image.Image:
    rgba = source.convert("RGBA")
    if fit == "stretch":
        return rgba.resize(target, resample)
    source_width, source_height = rgba.size
    target_width, target_height = target
    ratio = min(target_width / source_width, target_height / source_height)
    scaled = (
        max(1, round(source_width * ratio)),
        max(1, round(source_height * ratio)),
    )
    resized = rgba.resize(scaled, resample)
    canvas = Image.new("RGBA", target, (*matte, 255))
    offset = ((target_width - scaled[0]) // 2, (target_height - scaled[1]) // 2)
    canvas.alpha_composite(resized, offset)
    return canvas


def pixelify(
    source: Image.Image,
    target: tuple[int, int],
    colors: int,
    resample: str,
    dither: str,
    alpha_mode: str,
    alpha_threshold: int,
    matte: tuple[int, int, int],
    fit: str,
    fixed_palette: list[tuple[int, int, int]] | None,
) -> Image.Image:
    fitted = fit_rgba(source, target, RESAMPLERS[resample], fit, matte)
    alpha = fitted.getchannel("A")
    matte_image = Image.new("RGB", fitted.size, matte)
    matte_image.paste(fitted.convert("RGB"), mask=alpha)

    if fixed_palette:
        reduced = matte_image.quantize(
            palette=palette_image(fixed_palette),
            dither=DITHERS[dither],
        ).convert("RGB")
    else:
        reduced = matte_image.quantize(
            colors=colors,
            method=Image.Quantize.MEDIANCUT,
            dither=DITHERS[dither],
        ).convert("RGB")

    if alpha_mode == "opaque":
        reduced_alpha = Image.new("L", target, 255)
    elif alpha_mode == "binary":
        reduced_alpha = alpha.point(lambda value: 255 if value >= alpha_threshold else 0)
    else:
        reduced_alpha = alpha

    red, green, blue = reduced.split()
    return Image.merge("RGBA", (red, green, blue, reduced_alpha))


def color_count(image: Image.Image) -> int:
    colors = image.convert("RGBA").getcolors(maxcolors=image.width * image.height)
    if colors is None:
        raise ValueError("unable to count output colors")
    return len(colors)


def make_artifacts(args: argparse.Namespace) -> dict[Path, bytes]:
    source_path = args.input.resolve()
    manifest_base = args.manifest_out.resolve().parent
    source_bytes = source_path.read_bytes()
    with Image.open(io.BytesIO(source_bytes)) as opened:
        source = opened.copy()
        source_mode = opened.mode
        source_size = list(opened.size)

    fixed_palette = None
    palette_record = None
    if args.palette_json:
        palette_path = args.palette_json.resolve()
        fixed_palette, palette_bytes = load_palette(palette_path)
        palette_record = {
            "path": portable_path(palette_path, manifest_base),
            "sha256": sha256(palette_bytes),
            "declaredColors": len(fixed_palette),
        }

    matte = ImageColor.getrgb(args.matte)
    native = pixelify(
        source=source,
        target=args.target,
        colors=args.colors,
        resample=args.resample,
        dither=args.dither,
        alpha_mode=args.alpha,
        alpha_threshold=args.alpha_threshold,
        matte=matte,
        fit=args.fit,
        fixed_palette=fixed_palette,
    )
    preview = native.resize(
        (native.width * args.preview_scale, native.height * args.preview_scale),
        Image.Resampling.NEAREST,
    )
    native_bytes = png_bytes(native)
    preview_bytes = png_bytes(preview)

    manifest = {
        "classification": "deterministically-pixelified-raster",
        "tool": {
            "name": "pixel-art-production/scripts/pixelify.py",
            "version": TOOL_VERSION,
            "pillowVersion": PILLOW_VERSION,
            "dependencyLock": f"Pillow=={PILLOW_VERSION}",
        },
        "source": {
            "path": portable_path(source_path, manifest_base),
            "sha256": sha256(source_bytes),
            "width": source_size[0],
            "height": source_size[1],
            "mode": source_mode,
        },
        "settings": {
            "targetWidth": args.target[0],
            "targetHeight": args.target[1],
            "fit": args.fit,
            "resample": args.resample,
            "paletteMethod": "fixed-json" if fixed_palette else "median-cut",
            "requestedColors": len(fixed_palette) if fixed_palette else args.colors,
            "dither": args.dither,
            "alpha": args.alpha,
            "alphaThreshold": args.alpha_threshold,
            "matte": args.matte,
            "previewScale": args.preview_scale,
            "palette": palette_record,
        },
        "outputs": {
            "native": {
                "path": portable_path(args.native_out, manifest_base),
                "width": native.width,
                "height": native.height,
                "mode": native.mode,
                "actualColors": color_count(native),
                "sha256": sha256(native_bytes),
            },
            "preview": {
                "path": portable_path(args.preview_out, manifest_base),
                "width": preview.width,
                "height": preview.height,
                "mode": preview.mode,
                "actualColors": color_count(preview),
                "sha256": sha256(preview_bytes),
            },
        },
        "claim": "Mechanically pixelified from the recorded raster source; not hand-pixeled or pixel-authored.",
    }
    manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    return {
        args.native_out.resolve(): native_bytes,
        args.preview_out.resolve(): preview_bytes,
        args.manifest_out.resolve(): manifest_bytes,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Deterministically pixelify a raster image.")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--native-out", type=Path, required=True)
    parser.add_argument("--preview-out", type=Path, required=True)
    parser.add_argument("--manifest-out", type=Path, required=True)
    parser.add_argument("--target", type=parse_size, required=True)
    parser.add_argument("--colors", type=int, default=32)
    parser.add_argument("--palette-json", type=Path)
    parser.add_argument("--preview-scale", type=int, default=4)
    parser.add_argument("--resample", choices=RESAMPLERS, default="box")
    parser.add_argument("--dither", choices=DITHERS, default="none")
    parser.add_argument("--alpha", choices=("preserve", "binary", "opaque"), default="preserve")
    parser.add_argument("--alpha-threshold", type=int, default=128)
    parser.add_argument("--matte", default="#081326")
    parser.add_argument("--fit", choices=("contain", "stretch"), default="contain")
    parser.add_argument("--check", action="store_true")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if not 2 <= args.colors <= 256:
        raise SystemExit("--colors must be between 2 and 256")
    if args.preview_scale <= 0:
        raise SystemExit("--preview-scale must be positive")
    if not 0 <= args.alpha_threshold <= 255:
        raise SystemExit("--alpha-threshold must be between 0 and 255")
    artifacts = make_artifacts(args)
    if args.check:
        mismatches = [
            str(path)
            for path, expected in artifacts.items()
            if not path.exists() or path.read_bytes() != expected
        ]
        if mismatches:
            raise SystemExit("pixelification mismatch: " + ", ".join(mismatches))
        print("pixelification artifacts verified")
        return

    for path, data in artifacts.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    print("generated " + ", ".join(str(path) for path in artifacts))


if __name__ == "__main__":
    main()
