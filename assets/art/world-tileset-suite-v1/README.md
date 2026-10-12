# World Tileset Suite V1

This package establishes reusable top-down and side-view environment tiles for
eight regional material families:

1. Takamine rain village
2. Hoshigawa river ward
3. Sodegaura relay road
4. Kagura ash pass
5. Kurohana black castle
6. Hidden archive chapel
7. Oni forge
8. Black bell engine

Each family provides sixteen top-down roles and sixteen side-view roles.

## Top-down contract

- Native tile: `16x16`
- Atlas: `256x128`
- Eight theme rows, sixteen role columns
- Opaque alpha
- Base floor repeat borders are seamless (exterior floors use a uniform `mid`
  border; interior boards and plates use a uniform `shadow` seam border)
- `topDown.autotileBands` (north 3, south 1, west 2, east 1, inner corner 2
  native pixels) is the strip contract for `edge-*`, `outer-corner`, and
  `inner-corner`; `verify_world_tileset_suite.py` checks it for every theme
- Each theme declares `topDownLiquid` (`water`, `ember`, or `corruption`) so
  the runtime places `hazard-or-liquid` only under matching authored terrain

## Field kit v1.1 (top-down)

The top-down row was repainted for in-context field use. Village themes
(Takamine, Hoshigawa, Sodegaura, Kagura) read impassable masses as buildings:
`wall-cap` is a tile roof seen from above and `wall` is an eave over a timber
front with a lit paper window and a stone footing. Interior themes read as a
timber-and-plaster archive wall under dark coping, vertical black-lacquer
boards between vermilion rails, rough soot-stained forge masonry under slag,
and riveted bell-engine iron under a grating. `floor-a` is deliberately the
quietest module because it is the most frequent, `floor-b` carries the joint
pattern, and `floor-detail` carries one small material story without any
object-like shape. `threshold` is a gate sill set into the floor and
`prop-base` is a low stone footing for a prop layer. `path` and
`foreground-occluder` keep their v1 primitives and are not yet placed. The
side-view atlas is unchanged.

## Side-view contract

- Native tile: `32x32`
- Atlas: `512x256`
- Eight theme rows, sixteen role columns
- Opaque alpha
- Includes ground, platforms, walls, ceiling, slope, stairs, pillar, hazard,
  prop, door, and foreground roles

## Provenance

These are **pixel-authored production assets**: the editable source is a
deterministic native-resolution primitive builder with explicit palettes,
integer geometry, source/output hashes, and byte-identical rebuild checks.
No image generator was used for these tiles.

This is a modular foundation, not final room composition. Collision, hazards,
exits, foreground masking, and interaction authority remain owned by level
data and runtime systems.

`world-tileset-runtime-v1.json` makes every theme row and tile-role column
addressable and supplies conservative collision, hazard, transition, and
occlusion hints. These hints never supersede authored level data: a hazard tile
does not deal damage and a door does not transition scenes without an authored
level contract.

## Runtime integration status

**Top-down: Integrated (decorative), not Accepted. Side-view: not integrated.**

Campaign's field map composes the top-down atlas through
`game/field-tileset-presentation.mjs`, a DOM-free resolver that reads only
level data:

- theme floor with hash-stable `floor-a` / `floor-b` / `floor-detail`
  variation (no `Math.random`);
- `wall` (front face) versus `wall-cap` (top surface) for impassable cells,
  chosen by whether the cell to the south is walkable;
- walkable-side outline and contact-shadow strips from `edge-*`,
  `outer-corner`, and `inner-corner`;
- `threshold` at authored exits and `hazard-or-liquid` under liquid/ember tags
  that match the theme's `topDownLiquid`;
- the existing `field-terrain-suite` overlays on every tagged cell.

The browser loads the runtime copy in
`game/assets/art/world-tileset-suite-v1/`, validates the exact `256x128`
dimensions, caches one native-resolution base per level, and exposes
`#mapCanvas[data-world-tile-art-state]` and `data-world-tile-theme-id`. Load
failure, wrong size, or an unknown theme keeps the previous flat-color renderer
exactly. The resolver's optional `{ dressedCells }` Set lets a prop layer turn
impassable cells into floor plus `prop-base` without changing collision.

Art never owns collision, hazards, exits, interactions, saves, telemetry, or
evidence. Human readability review, cultural review, and art lock remain
pending. The current 40-pixel field cell scales the 16-pixel modules by a
non-integer 2.5.

## Rebuild and verify

```powershell
python .\build_world_tileset_suite.py
python .\verify_world_tileset_suite.py
python .\build_world_tileset_suite.py --check
Copy-Item .\top-down-regional-tiles-v1.png ..\..\..\game\assets\art\world-tileset-suite-v1\
```

The builder writes JSON with LF line endings so `--check` is byte-identical on
Windows and POSIX. `game/tests/world-tileset-atlas.test.mjs` asserts that the
runtime copies stay byte-identical to these production atlases, and
`game/tests/field-tileset-presentation.test.mjs` asserts the band and liquid
contracts plus the manifest hash of the runtime top-down atlas.
