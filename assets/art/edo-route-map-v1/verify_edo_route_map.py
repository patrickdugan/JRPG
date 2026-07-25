from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "edo-route-map.source.json"
MANIFEST_PATH = ROOT / "manifest.json"


def sha256_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    errors: list[str] = []
    routes = source["routes"]
    if len(routes) != 3:
        errors.append(f"expected 3 visible routes, found {len(routes)}")
    signatures = set()
    flags = set()
    exclusive_sets = []
    for route in routes:
        node_ids = [node["id"] for node in route["nodes"]]
        if node_ids[0] != "hoshigawa-council" or node_ids[-1] != "edo":
            errors.append(f"{route['id']} does not connect Hoshigawa Council to Edo")
        if len(node_ids[1:-1]) != 4:
            errors.append(f"{route['id']} does not have four exclusive intermediate nodes")
        signatures.add(">".join(node_ids))
        flags.add(route["campaignFlag"])
        exclusive_sets.append(set(node_ids[1:-1]))
    if len(signatures) != 3:
        errors.append("route signatures are not distinct")
    if len(flags) != 3:
        errors.append("campaign flags are not distinct")
    for index, first in enumerate(exclusive_sets):
        for second in exclusive_sets[index + 1:]:
            if first & second:
                errors.append(f"intermediate node overlap: {sorted(first & second)}")

    outputs = {record["path"]: record for record in manifest["outputs"]}
    expected = {
        "edo-route-map-base-v1.png": ((320, 180), {255}),
        "edo-route-map-all-routes-v1.png": ((320, 180), {255}),
        "edo-route-map-preview-v1.png": ((1280, 720), {255}),
        "edo-route-icon-atlas-v1.png": ((128, 16), {0, 255}),
    }
    for filename, (size, alpha_values) in expected.items():
        path = ROOT / filename
        image = Image.open(path).convert("RGBA")
        if image.size != size:
            errors.append(f"{filename} has size {image.size}, expected {size}")
        if set(image.getchannel("A").getdata()) != alpha_values:
            errors.append(f"{filename} alpha policy drifted")
        if sha256_path(path) != outputs[filename]["sha256"]:
            errors.append(f"{filename} hash does not match manifest")
        if outputs[filename]["actualColors"] > 16:
            errors.append(f"{filename} exceeds the 16-color project palette")

    native = Image.open(ROOT / "edo-route-map-all-routes-v1.png").convert("RGBA")
    preview = Image.open(ROOT / "edo-route-map-preview-v1.png").convert("RGBA")
    if preview.tobytes() != native.resize(preview.size, Image.Resampling.NEAREST).tobytes():
        errors.append("preview is not an exact nearest-neighbor enlargement")
    inventory = json.loads((ROOT / "top-down-tile-inventory-v1.json").read_text(encoding="utf-8"))
    if inventory["regionalTileFoundation"]["tileCount"] != 128:
        errors.append("top-down tile inventory count drifted")
    if inventory["terrainOverlays"]["count"] != 19:
        errors.append("terrain overlay inventory count drifted")
    if inventory["liveLevelCoverage"] != {"totalLevels": 48, "fieldLevels": 29, "battleLevels": 19}:
        errors.append("live level inventory count drifted")

    if errors:
        raise SystemExit("Edo route-map verification failed:\n" + "\n".join(errors))
    print(
        "Edo route-map verification passed: three distinct Hoshigawa-to-Edo route signatures, "
        "four exclusive intermediate nodes per path, native 320x180 opaque maps, a binary-alpha "
        "eight-icon atlas, a 4x nearest-neighbor preview, bounded 16-color palette, and inventory receipts."
    )


if __name__ == "__main__":
    main()
