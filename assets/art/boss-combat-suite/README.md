# Boss Combat Suite

This directory contains the editable key-pose production candidate for every distinct boss selected from canonical live encounters whose format is `boss`, `boss-rescue`, `boss-phase`, or `final-boss`. The first enemy in each such encounter is the boss; temporary weak points, wards, clerks, and clones remain supporting actors. The resulting ten rows are derived from live content and verified by the acceptance test.

The transparent runtime candidate uses one exact 6 x 10 atlas geometry: six 112 x 128 cells per row, producing a 672 x 1280 RGBA PNG. The larger cell preserves boss-scale silhouettes, equipment, phase mechanisms, and non-gory resolution poses. Every cel keeps at least six fully transparent pixels at all four edges.

Columns are `neutral`, `telegraph`, `active`, `break`, `transition`, and `defeat`. The defeat column includes surrender, retreat, release, dispersal, containment, or deactivation where appropriate; it is not a gore sheet. `boss-combat-contact-sheet.png` is labeled review material and must never be loaded at runtime. The atlas itself is integrated in Battle with dimension-gated loading; the ten primary boss templates take priority over the generic enemy-family atlas, while image failure falls back through that family atlas and then the procedural token.

All pixels are original integer-coordinate Pillow primitives. No generated atlas, concept image, outside game, actor likeness, real emblem, or devotional prop is an input. Edit inventory metadata, palettes, anchor profiles, and phase reads in `boss-combat-suite.source.json`; edit silhouette primitives in `build_boss_combat_suite.py`.

```powershell
python build_boss_combat_suite.py
python build_boss_combat_suite.py --check
```

The manifest records source and builder hashes, PNG IHDR and SHA-256 data, canonical encounter mappings, per-frame raw-RGBA hashes and alpha bounds, and explicit pivot, ground, hit, and phase anchors. The builder renders twice in memory before writing or checking any file.
