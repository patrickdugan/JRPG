from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "kyoto-route-junction.source.json"
MANIFEST_PATH = ROOT / "manifest.json"


def sha256_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    errors: list[str] = []
    routes = source["junction"]["routes"]

    if len(routes) != 3:
        errors.append(f"expected three visible exits, found {len(routes)}")
    if {route["routeId"] for route in routes} != {
        "direct-sea",
        "northern-road",
        "southern-passage",
    }:
        errors.append("junction route IDs do not match the Kyoto route model")
    if {route["direction"] for route in routes} != {"down-left", "up", "down-right"}:
        errors.append("stair directions are not materially distinct")
    signatures = {"|".join(f"{x},{y}" for x, y in route["path"]) for route in routes}
    if len(signatures) != 3:
        errors.append("junction path signatures are not distinct")
    for route in routes:
        if route["path"][0] != source["junction"]["origin"]:
            errors.append(f"{route['routeId']} does not begin at the shared landing")
        if len(route["path"]) < 5:
            errors.append(f"{route['routeId']} lacks enough traversal points")

    outputs = {record["path"]: record for record in manifest["outputs"]}
    expected = {
        "kyoto-route-junction-base-v1.png": ((320, 180), {255}),
        "kyoto-route-junction-all-exits-v1.png": ((320, 180), {255}),
        "kyoto-route-junction-preview-v1.png": ((1280, 720), {255}),
        "kyoto-route-junction-party-atlas-v1.png": ((128, 24), {0, 255}),
    }
    palette_ceiling = len(source["palette"])
    for filename, (size, alpha_values) in expected.items():
        path = ROOT / filename
        image = Image.open(path).convert("RGBA")
        if image.size != size:
            errors.append(f"{filename} has size {image.size}, expected {size}")
        if set(image.getchannel("A").getdata()) != alpha_values:
            errors.append(f"{filename} alpha policy drifted")
        if sha256_path(path) != outputs[filename]["sha256"]:
            errors.append(f"{filename} hash does not match manifest")
        if outputs[filename]["actualColors"] > palette_ceiling:
            errors.append(f"{filename} exceeds the {palette_ceiling}-color project palette")

    native = Image.open(ROOT / "kyoto-route-junction-all-exits-v1.png").convert("RGBA")
    sprites = Image.open(ROOT / "kyoto-route-junction-party-atlas-v1.png").convert("RGBA")
    review = native.copy()
    review.alpha_composite(sprites.crop((0, 0, 16, 24)), (152, 105))
    review.alpha_composite(sprites.crop((64, 0, 80, 24)), (137, 108))
    preview = Image.open(ROOT / "kyoto-route-junction-preview-v1.png").convert("RGBA")
    enlarged = review.resize(preview.size, Image.Resampling.NEAREST)
    if preview.tobytes() != enlarged.tobytes():
        errors.append("preview is not an exact nearest-neighbor enlargement of the review scene")

    if source["choicePolicy"]["canonicalMutation"] != (
        "none until an explicit campaign adapter consumes the route receipt"
    ):
        errors.append("junction no longer preserves the canonical-state boundary")

    if errors:
        raise SystemExit("Kyoto route-junction verification failed:\n" + "\n".join(errors))
    print(
        "Kyoto route-junction verification passed: three distinct stair exits, a shared landing, "
        "native 320x180 opaque scenes, an eight-frame binary-alpha duo atlas, exact 4x preview, "
        "bounded palette, and noncanonical choice policy."
    )


if __name__ == "__main__":
    main()
