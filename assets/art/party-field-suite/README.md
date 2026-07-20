# Party field suite foundation

This directory contains an original, code-authored 32 x 48 field-sprite foundation for the six canonical party members. Pixels are drawn from the editable JSON palette and deterministic Pillow primitives; no generated atlas or concept pixels are inputs.

## Files

- `party-field-suite.source.json`: byte-stable canonical frame, palette, silhouette, row, and legacy-column contract shared by the combat and portrait pipelines.
- `party-field-walk-inbetweens.source.json`: editable four-column directional-walk in-between extension and legacy-hash contract.
- `build_party_field_suite.py`: deterministic native-resolution pixel builder.
- `party-field-foundation.png`: transparent 448 x 288 flattened sheet; current browser runtime input.
- `party-field-foundation-contact-sheet.png`: labeled 1888 x 1210 review sheet with checkerboard and cyan pivot marks; never use it at runtime.
- `manifest.json`: frame rectangles, stable pivots, per-cell RGBA hashes, palette IDs, dimensions, and review state.

Rows are `ren`, `aya`, `lise`, `mateus`, `genta`, `kiku`. The first ten columns retain the original north/east/south/west idle/walk cells plus south interact and south hurt. Four appended `walk-b` cells provide the complementary directional step. All six rows are authored and addressable; the current field leader is Ren, so live Campaign movement samples Ren's pair while the other five pairs are ready for a future leader/formation authority. Standing and reduced-motion presentation use the original idle cell. Interact is a brief reach driven by the rendered field control; hurt is a non-gory recoil driven only by committed `hazard-hit` events. Every frame has a 32 x 48 logical box, pivot/foot point `(16, 44)`, a transparent outer border, and three transparent rows below the feet. The builder verifies a single digest over all 60 legacy frame IDs and RGBA hashes before it can emit files.

Run `python build_party_field_suite.py` to rebuild. Run `python build_party_field_suite.py --check` to build in memory and byte-compare all generated outputs.

## Scope and limits

This is a readable field key-pose suite with a minimal two-phase directional walk for the active Ren field leader and authored matching keys for the other five members, not the complete 4-6 frame idle or 6-8 frame walk requirement. It establishes character silhouettes, four-direction movement, foot registration, palette ownership, and live interaction/hazard reactions. A selectable leader or visible formation, alternate facings and in-betweens for interaction and recoil, portraits, and external cultural review remain separate approval work. Mateus uses an original fictional face and proportions. Costume and tool marks use only plain, invented geometry; there are no sacred-object props.
