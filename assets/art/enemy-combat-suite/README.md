# Enemy Combat Suite

This directory is the editable, deterministic source for the eight live enemy silhouette families. The transparent `enemy-combat-atlas.png` is the browser candidate; `enemy-combat-contact-sheet.png` is a labeled review aid and must not be loaded by the game. The fifth defeat column is authored and copied into the browser asset tree, with runtime pose wiring tracked separately.

The artwork is original code-authored pixel art. It does not copy, trace, sample, or derive pixels from the provisional generated material in `assets/production/` or from an outside work. Shapes use invented docket, gauge, damper, resonator, net-spindle, and clinker-rake motifs. They intentionally avoid real emblems, ritual architecture, insignia, and devotional objects.

## Build

From this directory, run:

```powershell
python build_enemy_combat_suite.py
python build_enemy_combat_suite.py --check
```

`--check` rebuilds both PNGs and the manifest in memory and fails if any checked-in byte differs. The atlas has 64 x 80 pixel cells in an exact 5 x 8 grid. Every silhouette stays at least four transparent pixels from every cell edge. Art is drawn at native resolution using integer coordinates and hard color clusters; no resampling or anti-aliasing is involved.

Edit palette choices, labels, mappings, anchors, or motif notes in `enemy-combat-suite.source.json`. Silhouette construction lives in the deterministic Python builder so its integer primitives remain reviewable. `manifest.json` records the source and builder hashes, PNG IHDR data, atlas hash, per-frame raw-RGBA hashes, alpha bounds, gutters, and all pivot/ground/contact anchors.

## Pose columns

1. `neutral`: readable family stance.
2. `windup`: load direction and threat geometry.
3. `attack`: one unmistakable active extension.
4. `stagger`: opposite-line recoil with broken balance.
5. `defeat`: non-gory collapse, surrender, dispersal, or mechanical shutdown.

This is a key-pose suite, not final in-between animation. Runtime event timing remains data-driven; frame art never decides damage.

## Export receipt

- `enemy-combat-atlas.png`: 320 x 640 RGBA, SHA-256 `c1fe889a553397c3f2cd116e3280f278adae5ab831271f41127e77acec384872`.
- `enemy-combat-contact-sheet.png`: 696 x 1500 RGB, SHA-256 `b8387d4f21eb3f5f253ed78dea3378bd6c68ca6db25bae9160248edc62c43c7c`.

The second-pass runtime candidate adds articulated anatomy, layered equipment, separate props, pose-specific limb loads, and hard highlight/shadow clusters while preserving the original frame and anchor contract.
