# Regional battle-stage production wave

This package contains the first editable whole-campaign environment wave for the 18 canonical battle boards that do not use the independently authored Takamine Bell-Chamber floor.

## Source and outputs

- `regional-battle-stages.source.json` is the editable authority for five material kits and exact snapshots of live blocked, terrain, exit, interactable, hazard, and spawn cells.
- `build_regional_battle_stages.py` emits 18 distinct `384 x 224` RGBA board PNGs, one per `12 x 7` / `32 px` battle level.
- `regional-battle-stage-modules.png` is the exact `640 x 128` reusable five-kit material sheet.
- `regional-battle-stages-contact-sheet.png` is the labeled `768 x 640` half-scale review sheet.
- `manifest.json` records source and export hashes, PNG IHDR values, per-board occupancy signatures, kit mappings, render policy, and validation results.

All 18 board exports are copied byte-identically into the browser runtime and registered beside the independently authored Takamine board, so every canonical combat encounter now resolves to an authored floor. `game/content/levels.mjs` remains collision and rules authority. The Black Gate, Outer Archive, and Throne Observatory floors each bake fourteen fictional Kirishitan victim fixtures—alternating crucified and impaled silhouettes—into blocked architecture, for forty-two visible fixtures across Kurohana's approach and final dungeon. They are environmental evidence, never actors, targets, loot, or collision authority. The renderer continues to draw live grid, terrain overlays, objectives, telegraphs, units, and VFX above these static floors, with its procedural floor retained for image failure.

## Deterministic build

From the repository root:

```powershell
python .\assets\art\regional-battle-stages\build_regional_battle_stages.py
python .\assets\art\regional-battle-stages\build_regional_battle_stages.py --check
```

The builder renders every artifact twice and rejects byte drift. `--check` performs no writes and fails when any generated artifact or manifest byte is stale.

## Visual and cultural limits

The five kits use original hard-edged pixel primitives for rain, archive, coast, ash, and court materials. No actors, objectives, active hazards, telegraphs, authentic religious symbols, authentic heraldry, or generated concept pixels are baked into the boards. The court kit uses plain invented administrative brackets, drawers, rails, and broken asymmetry rather than a crest.

The contact sheet received an internal distinctiveness pass, including replacement of a directional-looking observatory floor texture with quiet right-angle mechanical seams. External cultural review, live-unit and telegraph contrast review, runtime integration, and final art lock remain pending.
