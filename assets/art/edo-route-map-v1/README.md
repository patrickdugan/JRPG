# Road to Edo Route Map v1

An original late-8-bit branching route-selection map for the approach to Edo.
It uses the broad stage-map grammar of early console action adventures—coarse
terrain, bright node chains, route splits, and a castle destination—without
copying another game's geography, sprites, interface, or map layout.

The map presents three materially different route signatures:

1. **Cedar Ridge** — short, combat-heavy, forge salvage, low supplies.
2. **Witness Road** — balanced, testimony-heavy, stronger public support.
3. **Lantern Coast** — longer, water hazards, stronger supply recovery.

All three paths begin at Hoshigawa Council and converge at Edo, but each uses
four exclusive intermediate nodes and produces a distinct campaign flag.

## Files

- `edo-route-map-base-v1.png` — native runtime background, `320x180`
- `edo-route-map-all-routes-v1.png` — native all-route review
- `edo-route-map-preview-v1.png` — nearest-neighbor `4x` review
- `edo-route-icon-atlas-v1.png` — eight transparent `16x16` node icons
- `edo-route-map.source.json` — route graph, positions, consequences, palette
- `top-down-tile-inventory-v1.json` — current inventory and remaining holes
- `manifest.json` — geometry, hashes, palette, graph and provenance receipts

## Provenance

These are **pixel-authored production assets**. The editable source is a
deterministic native-resolution primitive builder with an explicit palette,
integer geometry, binary/opaque alpha policies, source and output hashes, and
byte-identical rebuild checks. No image generator was used.

## Build

```powershell
python build_edo_route_map.py
python verify_edo_route_map.py
python build_edo_route_map.py --check
```
