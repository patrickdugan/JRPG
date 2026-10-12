# Enemy Combat Animation Runtime v1

This package losslessly repacks the reviewed V2, V3, and V4 side-view enemy
animation sheets into one canvas-friendly runtime atlas. It holds thirty-three
enemy families, each with twenty-four `160x160` frames across four clips:

1. locomotion;
2. basic attack;
3. signature attack;
4. hurt through defeated hold.

The runtime atlas is `3840x5280`: twenty-four columns by thirty-three rows.
Every source cel stays integer-aligned and pixel-identical after repacking.
The simulation owns root motion, damage, collision, and facing.

## Provenance

The repack combines two separately labelled lanes. `manifest.json` records
each lane under `provenance.lanes` and tags every row with `provenanceLane`.

- **Rows 0-27, deterministically pixelified:** the derivatives in
  `enemy-animation-suite-v2` and `enemy-animation-suite-v3`, whose source
  boards were AI-generated stylized animation concepts. These rows are not
  pixel-authored.
- **Rows 28-32, pixel-authored:** the deterministic, code-native V4 families
  from `enemy-animation-suite-v4` (both Blood Ward Seals, the Exposed Seal,
  the Court Clone, and the Unfiled Testimony).

Packing performs no resampling, interpolation, recolouring, or new image
generation.

## Build

```powershell
python build_enemy_combat_animation_runtime_v1.py
python build_enemy_combat_animation_runtime_v1.py --check
```

`manifest.json` records source and output hashes, geometry, clip timing,
profiles, event frames, alpha policy, provenance lanes, and the exact order of
the roster rows.
