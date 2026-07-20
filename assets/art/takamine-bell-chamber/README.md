# Takamine Bell-Chamber Tactical Board

This directory contains the first editable production stage for `tkm-bell-chamber`. The board is exactly **384 x 224 pixels**, organized as **12 x 7 cells at 32 pixels per cell**. It is presentation art only: `game/content/levels.mjs` remains collision authority.

## Files

- `takamine-bell-chamber.source.json` is the canonical layered source and exact geometry contract.
- `build_takamine_stage.py` validates that contract and deterministically emits the editable SVGs, PNGs, and `manifest.json`.
- `takamine-bell-chamber-board.svg` and `.png` are the production board source/export pair.
- `occupancy-reference.svg` and `.png` provide the required monochrome 12 x 7 occupancy thumbnail.
- `palette-modules.svg` and `.png` provide palette swatches and representative stone, cedar, iron, and plaster modules without generated lettering.
- `manifest.json` records dimensions, palette, ordered layers, collision references, review state, and SHA-256 hashes.

## Build and verify

From this directory, run:

```powershell
python .\build_takamine_stage.py --check
```

The command rebuilds every derivative and fails if geometry, occupancy, special cells, raster dimensions, layer order, or any declared artifact hash disagrees with the source contract. Running it twice must leave all hashes unchanged.

## Art decisions

Open tiles use restrained indigo stone values so movement, telegraph, targeting, and unit colors can remain dominant. Large architecture exists only in blocked edge cells. The high gallery remains visibly flat and traversable. The central object is a fictional, floor-buried registry resonator made from faceted iron, lacquer conduits, and irregular ledger tabs; it is confined to the four blocked footprint cells and does not reproduce historical or religious ornament. The east exit is drawn as an open threshold.

The game currently composites this 384 x 224 board at exactly 2x as a 768 x 448 runtime board with 64-pixel cells. Automated in-engine ready/fallback, pointer-boundary, layer-order, reduced-motion, desktop, and narrow CSS-scaling evidence passes. Art lock remains pending external cultural review and subjective Blood Ward, Crimson Litany, result-log, sprite-contrast, and narrow-screen review.
