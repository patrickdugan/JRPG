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
- Base floor repeat borders are seamless

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

## Rebuild and verify

```powershell
python .\build_world_tileset_suite.py
python .\verify_world_tileset_suite.py
python .\build_world_tileset_suite.py --check
```
