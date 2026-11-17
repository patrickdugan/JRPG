# Boss animation suite v2

Runtime boss clips at the **20-30 unique-frame standard** (doc 10 section 2.2;
`skills/pixel-art-production/references/animation-contract.md`). This directory
builds nine bosses from code-authored pixel primitives. Shogun Kurozane is built
from his approved pixelified kits in `../kurozane-boss-clips-v2/` and shares the
runtime folder.

The seven-pose static atlas in `../boss-combat-suite/` is unchanged and remains
the exact runtime fallback.

## Provenance

`pixel-authored`: every frame is rasterized at native resolution from
integer-rounded primitives (`anim_primitives`) driven by keyframed pose
parameters (`anim_timeline`). Identity (palettes, motifs, inventory, safety
contract) comes from `../boss-combat-suite/boss-combat-suite.source.json`. No
raster input, generator, resampling, filtering, partial alpha, or dithering is
involved.

## Clips per boss

| Clip | Kind | Frames | Driven by |
| --- | --- | ---: | --- |
| `idle` | loop | 24 | kernel time |
| `locomotion` | loop | 24 | kernel time while moving (walk, prowl, hover drift, lumber) |
| `strike` | attack, 12 / 4 / 10 bands | 26 | the enemy attack's phase progress |
| `signature` | attack, 16 / 4 / 10 bands | 30 | the enemy attack's phase progress |
| `stagger` | progress | 22 | `staggerRemainingMs / staggerMs` (poise break) |
| `transition` | progress | 24 | `BOSS_TRANSITION_HOLD_MS` from the phase entry |
| `defeat` | progress, last frame held | 24 | `BOSS_DEFEAT_HOLD_MS` |

Signature and command attacks carry a distinct tell: Mateus's thorned crescent,
Kaji's cable whirl, Ujiro's raised docket case and order banner (an interruptible
command), Chiyo's dampers and hammer on the yoke, the Hound's latch and ink
line, the Widow's inverted ribbons and ring, the Abbot's three-step vents,
Enma's overhead fan and cinders, and the Bell's square socket sequence. The
`attackClips` map in each manifest binds every live kernel attack id.

| Boss | idle | loco | strike | signature | stagger | transition | defeat | sheet | PNG bytes | decoded |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | --- | ---: | ---: |
| tithe-hound | 24 | 24 | 26 (12/4/10) | 30 (16/4/10) | 22 | 24 | 24 | 4069 x 413 | 130,078 | 6.7 MB |
| mateus | 24 | 24 | 26 (12/4/10) | 30 (16/4/10) | 22 | 24 | 24 | 4053 x 540 | 149,374 | 8.8 MB |
| captain-kaji | 24 | 24 | 26 (12/4/10) | 30 (16/4/10) | 22 | 24 | 24 | 4091 x 479 | 143,323 | 7.8 MB |
| widow-of-fog | 24 | 24 | 26 (12/4/10) | 30 (16/4/10) | 22 | 24 | 23 | 4072 x 569 | 128,253 | 9.3 MB |
| furnace-abbot | 24 | 24 | 26 (12/4/10) | 30 (16/4/10) | 22 | 24 | 24 | 4081 x 730 | 147,645 | 11.9 MB |
| ujiro | 24 | 24 | 26 (12/4/10) | 30 (16/4/10) | 22 | 24 | 24 | 4063 x 507 | 129,874 | 8.2 MB |
| bell-warden-chiyo | 24 | 24 | 26 (12/4/10) | 30 (16/4/10) | 22 | 24 | 24 | 4091 x 607 | 190,902 | 9.9 MB |
| lady-enma | 24 | 24 | 26 (12/4/10) | 30 (16/4/10) | 22 | 24 | 24 | 4077 x 581 | 166,100 | 9.5 MB |
| yearless-bell | 24 | 24 | 26 (12/4/10) | 30 (16/4/10) | 22 | 24 | 24 | 4084 x 460 | 110,226 | 7.5 MB |

Counts are unique frames (alpha-trimmed pixel hashes); the Widow's defeat holds
its final dispersal for two frames, so it has 24 frames and 23 unique.

## Geometry

- Logical frame 232 x 160 with the foot point at (116, 148); authoring space is
  the v1 cell (112 x 128, soles on y 114) offset by (60, 32), so long reaches and
  overhead tells never clip. Every frame keeps a 2 px transparent gutter.
- Native facing screen-right; the runtime mirrors when a boss faces left.
- Frames are trimmed and shelf-packed into one sheet per boss, rows wrapping at
  4096 px. Presentation pixel scale 1.35 matches the static atlas path.

## Files

- `boss-animation-suite-v2.source.json`: clip plan (counts, band weights, events),
  attack bindings, tells, geometry, standard.
- `boss_rigs_v2.py` (humanoid rig and weapons), `boss_rigs_creature_v2.py`
  (quadruped, widow, Enma, furnace, bell rigs), `boss_motion_v2.py` (loops,
  secondary motion, stagger and defeat templates), `boss_cast_humanoid_v2.py` and
  `boss_cast_creature_v2.py` (key poses), `boss_performances_v2.py` (registry),
  `build_boss_animation_suite_v2.py` (assembly).
- `<boss>.png` / `<boss>.json`: sheet and `bbc-animation-clips/1` manifest;
  byte-identical runtime copies live in `game/assets/art/boss-animation-suite-v2/`.
- `review/<boss>-contact.png` and `review/<boss>-tells.gif`: labelled review
  material, never runtime input.
- `manifest.json`: suite summary with source, module, and toolkit hashes.

## Build

```powershell
python build_boss_animation_suite_v2.py --jobs 4
python build_boss_animation_suite_v2.py --check --jobs 4
python build_boss_animation_suite_v2.py --boss mateus --review-dir ..\..\..\_review   # strips and onion skins
```

Each worker process renders one boss and returns its bytes, so peak memory is
one character's frames per worker. `--check` writes nothing and requires every
sheet, manifest, runtime copy, review file, and the suite manifest to be
byte-identical. `--loose` (authoring only) reports gutter breaks as warnings.
