# Enemy Combat Animation Runtime v1

This package losslessly repacks the reviewed V2 and V3 side-view enemy
animation sheets into one canvas-friendly runtime atlas. It contains twenty-
eight enemy families, twenty-four `160x160` frames per family, and four clips:

1. locomotion;
2. basic attack;
3. signature attack;
4. hurt through defeated hold.

The runtime atlas is `3840x4480`: twenty-four columns by twenty-eight rows.
Every source cel remains integer-aligned and byte-equivalent at the pixel level
after repacking. Simulation owns root motion, damage, collision, and facing.

## Provenance

This is a **deterministically pixelified runtime repack**, not pixel-authored
art. Its sources are the deterministically pixelified derivatives in
`enemy-animation-suite-v2` and `enemy-animation-suite-v3`; those source boards
were AI-generated stylized animation concepts. Packing performs no resampling,
interpolation, recoloring, or new image generation.

## Build

```powershell
python build_enemy_combat_animation_runtime_v1.py
python build_enemy_combat_animation_runtime_v1.py --check
```

`manifest.json` records source and output hashes, geometry, clip timing,
profiles, event frames, alpha policy, and the exact roster row order.
