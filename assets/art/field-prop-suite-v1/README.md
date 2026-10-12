# Field prop suite v1

Top-down three-quarter buildings, walls, trees, and work goods that dress the
authored impassable cells of Campaign field maps, so blocked runs read as
places (row houses, temple halls, storehouses, castle walls, forge sheds,
bell machinery) instead of dark rectangles.

## Provenance

**Pixel-authored production asset.** `build_field_prop_suite.py` draws every
frame from code-native integer primitives (rectangles, lines, integer
ellipses, stepped hip diagonals) at native 16 x 16 cell resolution, under the
explicit per-family palettes in `field-prop-suite.source.json`. No image
generator, traced reference, photograph, or external pixel is read. The
builder renders the atlas twice in memory and refuses to write unless both
renders are byte-identical; `--check` rebuilds without writing and fails when
any output, including the runtime copy, is stale. Human visual review was done
on composite level previews (see below); external Japanese cultural review is
still pending, so the manifest keeps `artLock: false`.

## Contract

- Atlas: `field-prop-atlas.png`, 256 x 416 RGBA, 216 frames, every frame a
  whole multiple of the 16 x 16 cell.
- Alpha: binary art alpha (0 or 255) plus one fixed ink shadow value
  `rgba(11,16,32,112)`, written only onto otherwise transparent pixels.
- Layout: eight family bands of 16 x 3 cells in world-theme order (village,
  river, relay, ash, castle, archive, forge, engine), then one band of shared
  1 x 2 tall props. `game/field-prop-atlas.mjs` mirrors the rectangles exactly.
- Light: from the north-west; tall props lean slightly and drop a south-east
  shadow so they read as raised above the floor.

| Kind | Per family | Frames |
| --- | --- | --- |
| 1-tall building / wall strip | left, mid-a, mid-b, mid-c (door), right | 5 |
| North-south wall or fence run | top, mid, bottom | 3 |
| 2-tall building strip | left, mid-a, mid-b (door), right | 4 |
| Roof blocks seen from above | 2 x 2, 3 x 2, 3 x 3 | 3 |
| Single-cell props (family palette) | nine | 9 |
| 2 x 1 wide props | two | 2 |
| Shared tall props (1 x 2) | cedar, pine, dead pine, watch post, fire-watch bell tower, chimney, pipe stack, lacquer lantern | 8 |

Families: Takamine kawara tile roofs with cedar and lit paper windows;
Hoshigawa plank-and-plaster with stone-weighted plank roofs; Sodegaura
thatched post stations with lattice fronts and plain red lanterns; Kagura
slate-roofed stone huts under ash; Kurohana black-lacquer walls and a two-tier
turret with vermilion trim; hidden-archive plaster storehouses with heavy tile
and white ridges; Oni-forge soot masonry with ember vents and a furnace
throat; black-bell-engine riveted iron, bronze pipes, a gear housing, a boiler,
and a bell dome.

## Files

- `field-prop-suite.source.json`: palettes, families, layout, prop selections, restrictions.
- `build_field_prop_suite.py`: deterministic builder (`--check` for byte identity).
- `field-prop-atlas.png`: transparent runtime atlas (copied byte-identically to
  `game/assets/art/field-prop-suite-v1/`).
- `field-prop-contact-sheet.png`: labelled 3x review sheet over regional floor swatches; review only.
- `manifest.json`: geometry, per-frame rectangles, RGBA hashes, alpha bounds, colour counts, source/builder hashes.
- `render_level_previews.py`: review-only composites of real levels (floor colour,
  terrain overlays, resolved dressing) at an integer scale.
- `requirements.txt`: `Pillow==11.3.0` for byte-level reproducibility.

```powershell
python .\build_field_prop_suite.py
python .\build_field_prop_suite.py --check
python .\render_level_previews.py --out ..\..\..\..\_shots\field-props --scale 3 hsh-river-lane krh-audience-hall
```

## Runtime

`game/field-prop-dressing.mjs` exports `resolveFieldPropDressing(level, { themeId })`,
a pure resolver that finds impassable cells (`blocked` plus impassable
terrain), decomposes them into top border rows, 3 x 3 masses, two-tall runs,
one-tall runs, vertical runs, and singles, and picks family pieces with a
stable FNV-1a position hash. It never covers walkable cells, exits, spawn
points, hazard tiles, or interactable positions, and it leaves blocked cells
that carry an authored passable terrain surface (for example a map table)
undressed. `drawFieldPropDressing(ctx, image, dressing, originX, originY, cell)`
draws the placements with nearest-neighbour scaling and fails closed on a
missing or wrong-size image. Collision always stays with level data.

## Restrictions

No text, glyphs, or readable documents are baked into any frame (notice boards
and ledgers show blank sheets). Stone lanterns and fire-watch bells are secular
roadside and village fixtures, never loot or trophies. Castle ornament is
invented lacquer and vermilion geometry with no real crest, insignia, or
heraldry.
