#!/usr/bin/env python3
"""Cut-out rig for raster sprites: slice parts, pivot them, pose them, pack clips.

Use this to convert an existing raster frame (a pixelified enemy, a party
combat key, a field walk key) into 20-30 frame clips without redrawing it:

1. **Slice** the source into parts with rectangles or polygons (in source
   pixels). Give each part a ``pivot`` (its joint, in source pixels) and a
   ``parent``. Slices should *overlap* their parent by 2-4 px past the joint
   so rotation never opens a gap.
2. **Pose** each part with ``angle`` (degrees, clockwise on screen), ``dx``
   and ``dy`` (pixels, parent space). Transforms are hierarchical: a child
   follows its parent's rotation about the child's own joint.
3. **Render** with RotSprite-style sampling: every part is enlarged 8x once
   with Scale2x (EPX) x3, and each output pixel samples that enlargement at
   its rotated pixel centre with nearest-neighbour. No colours are invented,
   edges stay clean at small angles, and there is no filtering or alpha.
4. **Clean up**: joint caps (``cap`` radius) paste the unrotated joint pixels
   beneath the parts to fill wedge gaps; orphan pixels are pruned, 1-px
   pinholes filled, and an optional ink outline re-ringed around the final
   silhouette.

Rig output inherits the source's provenance lane. A pixelified source stays
``deterministically-pixelified``; a pixel-authored source becomes
``pixel-authored (rig-posed)``. Never relabel rig output as hand-pixeled.

Spec-driven CLI (JSON rig + keyframes -> sheet + manifest + review)::

    python anim_rig.py --spec enemy.rig.json --out-dir build/ [--review-dir review/] [--check]

See ``references/animation-contract.md`` for the spec format and a worked
example. ``python anim_rig.py --self-test`` runs the deterministic self-test.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping, Sequence

from PIL import Image, ImageDraw

from anim_primitives import Xf, dilate4, fill_pinholes, prune_orphans, rgba, sub
from anim_sheet import Clip, Frame, build_character, write_or_check
from anim_timeline import Timeline, band_times, loop_times, wave, weights_to_durations

UPSCALE = 8  # three Scale2x passes


def scale2x(image: Image.Image) -> Image.Image:
    """EPX / Scale2x on RGBA pixels (exact colour equality, no blending)."""
    w, h = image.size
    src = list(image.getdata())
    out: list = [None] * (4 * w * h)
    ow = 2 * w
    for y in range(h):
        row = y * w
        up = (y - 1) * w if y > 0 else row
        down = (y + 1) * w if y < h - 1 else row
        for x in range(w):
            p = src[row + x]
            a = src[up + x]
            d = src[down + x]
            c = src[row + x - 1] if x > 0 else p
            b = src[row + x + 1] if x < w - 1 else p
            e0 = a if (c == a and c != d and a != b) else p
            e1 = b if (a == b and a != c and b != d) else p
            e2 = c if (d == c and d != b and c != a) else p
            e3 = d if (b == d and b != a and d != c) else p
            o = (2 * y) * ow + 2 * x
            out[o], out[o + 1], out[o + ow], out[o + ow + 1] = e0, e1, e2, e3
    result = Image.new("RGBA", (2 * w, 2 * h))
    result.putdata(out)
    return result


def rotsprite_source(image: Image.Image) -> Image.Image:
    up = image
    for _ in range(3):
        up = scale2x(up)
    return up


@dataclass
class Part:
    """A rig part cut from a source raster.

    ``origin`` is where ``image``'s top-left sat in the source; ``pivot`` is
    the joint in source coordinates. In the rest pose (all angles zero) every
    part lands exactly where it was cut from, reproducing the source.
    """

    name: str
    image: Image.Image
    origin: tuple[int, int]
    pivot: tuple[float, float]
    parent: str | None = None
    z: int = 0
    cap: int = 0
    _up: Image.Image | None = field(default=None, repr=False)

    @property
    def up(self) -> Image.Image:
        if self._up is None:
            self._up = rotsprite_source(self.image)
        return self._up


def cut_part(source: Image.Image, name: str, *, pivot: Sequence[float], rect: Sequence[int] | None = None,
             polygon: Sequence[Sequence[float]] | None = None, parent: str | None = None, z: int = 0,
             cap: int = 0) -> Part:
    """Slice a part by rectangle ``[x, y, w, h]`` or polygon (source pixels)."""
    if (rect is None) == (polygon is None):
        raise ValueError(f"{name}: give exactly one of rect or polygon")
    if rect is not None:
        x, y, w, h = (int(v) for v in rect)
        crop = source.crop((x, y, x + w, y + h))
        bbox = crop.getchannel("A").getbbox()  # trim empty margins: the 8x enlargement costs area
        if bbox is None:
            raise ValueError(f"{name}: empty slice")
        crop = crop.crop(bbox)
        return Part(name, crop, (x + bbox[0], y + bbox[1]), (float(pivot[0]), float(pivot[1])), parent, z, cap)
    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).polygon([(int(round(px)), int(round(py))) for px, py in polygon], fill=255)
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError(f"{name}: empty polygon")
    clipped = Image.new("RGBA", source.size, (0, 0, 0, 0))
    clipped.paste(source, (0, 0), mask)
    crop = clipped.crop(bbox)
    return Part(name, crop, (bbox[0], bbox[1]), (float(pivot[0]), float(pivot[1])), parent, z, cap)


class Rig:
    def __init__(self, source: Image.Image, parts: Sequence[Part], cell_size: tuple[int, int],
                 source_offset: tuple[int, int] = (0, 0), outline: str | None = None, prune: bool = True):
        self.source = source.convert("RGBA")
        self.parts = {part.name: part for part in parts}
        if len(self.parts) != len(parts):
            raise ValueError("Part names must be unique")
        for part in parts:
            if part.parent is not None and part.parent not in self.parts:
                raise ValueError(f"{part.name}: unknown parent {part.parent!r}")
        self.cell_size = cell_size
        self.source_offset = source_offset  # where source (0,0) lands in the output cell
        self.outline = rgba(outline) if outline else None
        self.prune = prune
        self.order = sorted(parts, key=lambda part: (part.z, list(self.parts).index(part.name)))

    def _world(self, name: str, pose: Mapping[str, Mapping[str, float]], cache: dict) -> Xf:
        """Source-space -> cell-space transform of one part."""
        if name in cache:
            return cache[name]
        part = self.parts[name]
        local = pose.get(name, {})
        angle = float(local.get("angle", 0.0))
        dx, dy = float(local.get("dx", 0.0)), float(local.get("dy", 0.0))
        own = Xf.rotate(angle, part.pivot).then(Xf.translate(dx, dy))
        if part.parent is None:
            root = pose.get("root", {})
            base = Xf.rotate(float(root.get("angle", 0.0)), part.pivot).then(
                Xf.translate(self.source_offset[0] + float(root.get("dx", 0.0)),
                             self.source_offset[1] + float(root.get("dy", 0.0))))
            world = own.then(base)
        else:
            world = own.then(self._world(part.parent, pose, cache))
        cache[name] = world
        return world

    @staticmethod
    def _inverse(xf: Xf) -> tuple[float, ...]:
        a, b, c, d, e, f = xf.m
        det = a * e - b * d
        if abs(det) < 1e-12:
            raise ValueError("Degenerate part transform")
        ia, ib, id_, ie = e / det, -b / det, -d / det, a / det
        return (ia, ib, -(ia * c + ib * f), id_, ie, -(id_ * c + ie * f))

    def _draw_part(self, cell: Image.Image, part: Part, world: Xf) -> None:
        # Map cell pixel centres -> part-local 8x pixels. Pillow samples output
        # pixel centres, so the inverse transform is used directly.
        ia, ib, ic, id_, ie, if_ = self._inverse(world)
        ox, oy = part.origin
        k = UPSCALE
        coeffs = (k * ia, k * ib, k * (ic - ox), k * id_, k * ie, k * (if_ - oy))
        layer = part.up.transform(cell.size, Image.Transform.AFFINE, coeffs, resample=Image.Resampling.NEAREST)
        cell.alpha_composite(layer)

    def _draw_cap(self, cell: Image.Image, part: Part, world: Xf) -> None:
        r = part.cap
        px, py = part.pivot
        box = (int(px - r), int(py - r), int(px + r) + 1, int(py + r) + 1)
        patch = self.source.crop(box)
        mask = Image.new("L", patch.size, 0)
        ImageDraw.Draw(mask).ellipse((0, 0, patch.width - 1, patch.height - 1), fill=255)
        alpha = Image.composite(patch.getchannel("A"), Image.new("L", patch.size, 0), mask)
        patch.putalpha(alpha)
        jx, jy = world.pt(px, py)
        cell.alpha_composite(patch, (int(round(jx - r)), int(round(jy - r))))

    def render(self, pose: Mapping[str, Mapping[str, float]] | None = None) -> Image.Image:
        pose = pose or {}
        cell = Image.new("RGBA", self.cell_size, (0, 0, 0, 0))
        cache: dict = {}
        for part in self.order:  # joint caps go underneath every part
            if part.cap and part.parent is not None:
                self._draw_cap(cell, part, self._world(part.name, pose, cache))
        for part in self.order:
            self._draw_part(cell, part, self._world(part.name, pose, cache))
        return self.cleanup(cell)

    def cleanup(self, cell: Image.Image) -> Image.Image:
        alpha = cell.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
        if self.prune:
            alpha = fill_pinholes(prune_orphans(alpha))
        out = Image.new("RGBA", cell.size, (0, 0, 0, 0))
        # Fill pinholes with the left/upper neighbour colour (no new colours).
        filled = cell.copy()
        holes = sub(alpha, cell.getchannel("A").point(lambda value: 255 if value >= 128 else 0))
        if holes.getbbox():
            src = filled.load()
            hp = holes.load()
            w, h = cell.size
            for y in range(h):
                for x in range(w):
                    if hp[x, y]:
                        for nx, ny in ((x - 1, y), (x, y - 1), (x + 1, y), (x, y + 1)):
                            if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] >= 128:
                                src[x, y] = src[nx, ny][:3] + (255,)
                                break
        solid = filled.copy()
        solid.putalpha(255)
        out.paste(solid, (0, 0), alpha)
        if self.outline:
            out.paste(self.outline, (0, 0), sub(dilate4(alpha), alpha))
        return out


def alpha_centroid(image: Image.Image, box: tuple[int, int, int, int] | None = None) -> tuple[float, float]:
    """Mean position of opaque pixels (optionally inside ``box``), in image coordinates."""
    alpha = image.getchannel("A")
    x0, y0, x1, y1 = box or (0, 0, image.width, image.height)
    sx = sy = n = 0
    data = alpha.load()
    for y in range(max(0, y0), min(image.height, y1)):
        for x in range(max(0, x0), min(image.width, x1)):
            if data[x, y]:
                sx += x
                sy += y
                n += 1
    return (sx / n, sy / n) if n else (image.width / 2, image.height / 2)


def two_part_rig(cell: Image.Image, foot: tuple[float, float], waist_fraction: float = 0.5,
                 overlap: int = 3, cap: int = 3) -> tuple[Rig, tuple[float, float]]:
    """Moving-hold rig for one raster key: ``lower`` (root, pivots on the foot point)
    and ``upper`` (child, pivots at the waist), cut with ``overlap`` rows of shared
    pixels so bending never opens a seam. Returns the rig and its waist pivot.

    Pose keys: ``root.angle`` rotates the whole figure about the feet (keeps long
    weapons straight); ``root.dx/dy`` shifts it; ``upper.angle/dx/dy`` bends the
    torso at the waist (breathing, lean, recoil). The rest pose reproduces the key.
    """
    bbox = cell.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Cannot rig an empty cell")
    top, bottom = bbox[1], bbox[3]
    waist_y = int(round(top + (bottom - top) * waist_fraction))
    band = (bbox[0], waist_y - 4, bbox[2], waist_y + 4)
    waist_x = alpha_centroid(cell, band)[0]
    pivot = (round(waist_x, 3), float(waist_y))
    lower = cut_part(cell, "lower", rect=(0, waist_y - overlap, cell.width, cell.height - (waist_y - overlap)),
                     pivot=foot)
    upper = cut_part(cell, "upper", rect=(0, 0, cell.width, waist_y + overlap), pivot=pivot, parent="lower",
                     z=1, cap=cap)
    return Rig(cell, [lower, upper], cell.size, prune=False), pivot


# ---------------------------------------------------------------------------
# Spec-driven clips
# ---------------------------------------------------------------------------


def _flatten(pose: Mapping) -> dict[str, float]:
    flat = {}
    for part, values in pose.items():
        for key, value in values.items():
            flat[f"{part}.{key}"] = float(value)
    return flat


def _unflatten(flat: Mapping[str, float]) -> dict[str, dict[str, float]]:
    pose: dict[str, dict[str, float]] = {}
    for key, value in flat.items():
        part, param = key.split(".", 1)
        pose.setdefault(part, {})[param] = value
    return pose


def _timeline(keys: Sequence[Mapping]) -> Timeline:
    return Timeline.from_poses([(k["t"], _flatten(k.get("pose", {})), k.get("ease", "in-out")) for k in keys])


def _apply_waves(flat: dict, waves: Sequence[Mapping], t: float) -> dict:
    out = dict(flat)
    for item in waves or []:
        out[item["param"]] = out.get(item["param"], 0.0) + wave(t, item.get("cycles", 1), item.get("phase", 0.0),
                                                                 item.get("amplitude", 1.0))
    return out


def clip_from_spec(rig: Rig, spec: Mapping) -> Clip:
    kind = spec["kind"]
    frames: list[Frame] = []
    if kind == "attack":
        for band in ("windup", "active", "recovery"):
            band_spec = spec["bands"][band]
            count = int(band_spec["frames"])
            timeline = _timeline(band_spec["keys"])
            durations = weights_to_durations(band_spec.get("weights", [1] * count), int(band_spec.get("durationMs", 40 * count)))
            key_index = band_spec.get("key", count - 1)
            for index, t in enumerate(band_times(count)):
                events = tuple(band_spec.get("events", {}).get(str(index), []))
                pose = _unflatten(_apply_waves(timeline.sample(t), band_spec.get("waves"), t))
                frames.append(Frame(rig.render(pose), durations[index], band=band, events=events, key=index == key_index))
    else:
        count = int(spec["frames"])
        timeline = _timeline(spec["keys"])
        times = loop_times(count) if kind == "loop" else band_times(count, include_start=True)
        per_frame = int(spec.get("durationMs", 60))
        keys = set(spec.get("keyFrames", [0]))
        for index, t in enumerate(times):
            pose = _unflatten(_apply_waves(timeline.sample(t), spec.get("waves"), t))
            frames.append(Frame(rig.render(pose), per_frame, key=index in keys))
    return Clip(spec["id"], kind, frames, notes=dict(spec.get("notes", {})))


def rig_from_spec(spec: Mapping, base_dir: Path) -> Rig:
    source = Image.open(base_dir / spec["source"]).convert("RGBA")
    if spec.get("sourceRect"):
        x, y, w, h = spec["sourceRect"]
        source = source.crop((x, y, x + w, y + h))
    parts = [cut_part(source, item["name"], pivot=item["pivot"], rect=item.get("rect"), polygon=item.get("polygon"),
                      parent=item.get("parent"), z=item.get("z", 0), cap=item.get("cap", 0)) for item in spec["parts"]]
    return Rig(source, parts, tuple(spec["cell"]), tuple(spec.get("sourceOffset", (0, 0))), spec.get("outline"))


def build_from_spec(spec_path: Path) -> tuple[dict, object]:
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    lane = spec.get("sourceLane")
    if lane not in ("pixel-authored", "deterministically-pixelified", "ai-generated-concept"):
        raise ValueError("sourceLane must name the source's provenance lane")
    rig = rig_from_spec(spec, spec_path.parent)
    clips = [clip_from_spec(rig, item) for item in spec["clips"]]
    provenance = {
        "lane": f"{lane} (rig-posed)" if lane == "pixel-authored" else lane,
        "derivation": "cut-out rig: Scale2x x3 + nearest-neighbour rotation, orphan prune, pinhole fill",
        "rigSpec": spec_path.name,
        "source": spec["source"],
    }
    build = build_character(spec["id"], clips, logical_size=tuple(spec["cell"]), foot_point=tuple(spec["footPoint"]),
                            sheet_basename=spec.get("basename", spec["id"]), native_facing=spec.get("nativeFacing", "right"),
                            provenance=provenance)
    return spec, build


def _self_test() -> None:
    # A tiny two-part sprite: torso block plus an arm hanging from a shoulder joint.
    src = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    draw = ImageDraw.Draw(src)
    draw.rectangle((12, 8, 24, 30), fill=(40, 60, 90, 255))
    draw.rectangle((13, 9, 23, 12), fill=(120, 140, 170, 255))
    draw.rectangle((22, 10, 26, 26), fill=(160, 90, 60, 255))
    draw.rectangle((22, 24, 26, 26), fill=(230, 200, 140, 255))
    torso = cut_part(src, "torso", rect=(12, 8, 13, 23), pivot=(18, 30))
    arm = cut_part(src, "arm", rect=(22, 8, 5, 19), pivot=(24, 11), parent="torso", z=1, cap=2)
    rig = Rig(src, [torso, arm], (40, 40))
    rest = rig.render({})
    assert rest.tobytes() == rig.cleanup(src.copy()).tobytes(), "rest pose must reproduce the source"
    posed = rig.render({"arm": {"angle": -35}, "torso": {"angle": 4}})
    assert posed.tobytes() == rig.render({"arm": {"angle": -35}, "torso": {"angle": 4}}).tobytes()
    source_colors = {p for p in src.getdata() if p[3]}
    posed_colors = {p for p in posed.getdata() if p[3]}
    assert posed_colors <= source_colors, posed_colors - source_colors
    assert set(posed.getchannel("A").getdata()) <= {0, 255}
    # A gap test: no transparent pixel enclosed by opaque pixels on all four sides.
    alpha = posed.getchannel("A")
    assert fill_pinholes(alpha).tobytes() == alpha.tobytes()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--spec", type=Path, help="rig + clip JSON spec")
    parser.add_argument("--out-dir", type=Path, help="where the sheet and manifest go")
    parser.add_argument("--review-dir", type=Path, help="optional contact sheet / GIF / strip output")
    parser.add_argument("--check", action="store_true", help="verify outputs are byte-identical instead of writing")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test or not args.spec:
        _self_test()
        print("anim_rig self-test passed")
        if not args.spec:
            return 0
    spec, build = build_from_spec(args.spec)
    out_dir = args.out_dir or args.spec.parent
    outputs = {out_dir / name: data for name, data in build.outputs().items()}
    if args.review_dir:
        from anim_preview import review_outputs
        outputs.update(review_outputs(build.manifest, build.sheets, args.review_dir))
    return write_or_check(outputs, args.check, label=spec["id"])


if __name__ == "__main__":
    sys.exit(main())
