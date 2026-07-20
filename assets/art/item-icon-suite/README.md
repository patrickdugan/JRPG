# Item Icon Suite

This deterministic code-native suite covers all 25 live `ITEM_CATALOGUE` IDs in canonical order. Each item owns one distinct 16 × 16 transparent pixel icon in a 5 × 5, 80 × 80 runtime atlas.

- `item-icon-suite.source.json` owns order, motifs, palettes, authorship, and cultural restrictions.
- `build_item_icon_suite.py` paints integer-only primitives, rejects duplicate frames and gutter violations, and emits byte-identical artifacts.
- `item-icon-atlas.png` is the runtime atlas copied byte-for-byte into `game/assets/art/item-icon-suite/`.
- `item-icon-contact-sheet.png` is a labeled nearest-neighbor review sheet and is not shipped by the browser runtime.
- `manifest.json` locks exact rects, RGBA hashes, export hashes, geometry, and runtime scope.

The icons are decorative. Camp retains item names, kinds, quantities, descriptions, prices, and contextual control labels as the accessible authority. Image load or dimension failure keeps the text-only cards intact. The registry-token and route-note designs are secular evidence/route objects; no sacred, devotional, heraldic, or real military symbol is used.

Build or verify from this directory:

```powershell
python build_item_icon_suite.py
python build_item_icon_suite.py --check
```
