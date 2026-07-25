from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "southern-japan-route-map.source.json"
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
    if {route["id"] for route in routes} != {"direct-sea", "northern-road", "southern-passage"}:
        errors.append("route IDs do not expose sea, northern, and southern choices")
    if {route["pathKind"] for route in routes} != {"sea", "land", "mixed"}:
        errors.append("route traversal kinds are not materially distinct")

    signatures: set[str] = set()
    flags: set[str] = set()
    exclusive_sets: list[set[str]] = []
    for route in routes:
        node_ids = [node["id"] for node in route["nodes"]]
        if node_ids[0] != "nagasaki" or node_ids[-1] != "kyoto":
            errors.append(f"{route['id']} does not connect Nagasaki to Kyoto")
        if len(node_ids[1:-1]) != 6:
            errors.append(f"{route['id']} does not have six exclusive intermediate nodes")
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
        "southern-japan-route-map-base-v2.png": ((480, 270), {255}),
        "southern-japan-route-map-all-routes-v2.png": ((480, 270), {255}),
        "southern-japan-route-map-preview-v2.png": ((1440, 810), {255}),
        "southern-japan-route-icon-atlas-v2.png": ((240, 24), {0, 255}),
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

    native = Image.open(ROOT / "southern-japan-route-map-all-routes-v2.png").convert("RGBA")
    preview = Image.open(ROOT / "southern-japan-route-map-preview-v2.png").convert("RGBA")
    enlarged = native.resize(preview.size, Image.Resampling.NEAREST)
    if preview.tobytes() != enlarged.tobytes():
        errors.append("preview is not an exact nearest-neighbor enlargement")

    if source["geographicFrame"]["start"] != "Nagasaki":
        errors.append("geographic start drifted from Nagasaki")
    if source["geographicFrame"]["destination"] != "Kyoto (Miyako)":
        errors.append("geographic destination drifted from Kyoto (Miyako)")
    if "Seto Inland Sea" not in source["geographicFrame"]["regionsShown"]:
        errors.append("Seto Inland Sea is missing from the geographic frame")
    if source["routeChoicePolicy"]["canonicalMutation"] != (
        "none until an explicit campaign adapter consumes a route receipt"
    ):
        errors.append("standalone route choice no longer preserves the canonical-state boundary")

    inventory = json.loads((ROOT / "top-down-tile-inventory-v1.json").read_text(encoding="utf-8"))
    if inventory["regionalTileFoundation"]["tileCount"] != 128:
        errors.append("top-down tile inventory count drifted")
    if inventory["terrainOverlays"]["count"] != 19:
        errors.append("terrain overlay inventory count drifted")

    if errors:
        raise SystemExit("Southern Japan route-map verification failed:\n" + "\n".join(errors))
    print(
        "Southern Japan route-map verification passed: three exclusive Nagasaki-to-Kyoto "
        "signatures, sea/land/mixed traversal, native 480x270 opaque maps, a binary-alpha "
        "ten-icon atlas, a 3x nearest-neighbor preview, bounded palette, and noncanonical receipts."
    )


if __name__ == "__main__":
    main()
