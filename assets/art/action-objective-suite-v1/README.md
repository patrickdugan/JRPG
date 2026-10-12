# Action objective suite v1

Side-view sprites for every objective anchor, protected or attackable objective object, and escort/extraction token that the 23 authored encounters place on the action battle stage (`game/action-campaign-battle.html`). They replace the translucent gold anchor boxes and flat entity rectangles; the rectangles remain as the exact fallback.

## Provenance

- **Lane:** pixel-authored deterministic production (code-native primitives). Every pixel is placed by integer-coordinate Pillow rectangles, points, lines, polygons, and ellipses in `build_action_objective_suite.py`, under the named 61-colour palette in `action-objective-suite-v1.source.json`.
- **Not claimed:** hand-pixeled work, generated art, or pixelification. No image generator, concept raster, photograph, or other game's sprite was used or sampled.
- **Alpha:** binary (0 or 255). Every frame is validated for palette membership, side/top gutters, and nothing below the foot row.

## Geometry

- 28 kinds x up to 5 states in a 320 x 2240 RGBA atlas of 64 x 80 cells; columns are states in the order listed in the source JSON.
- Pivot `(32, 77)` is the feet point: the runtime places it on the anchor's or entity's `(x, y)`, which is the same feet position the old rectangles used.
- Draw scale 1.75x, matching the party combat sprites in `drawParty()`; civilians stand about 75 world pixels tall beside the roughly 83-pixel fighters.

## Kinds and states

| Kind | States | Used for |
| --- | --- | --- |
| river-gate | locked, open, complete | prologue river exit |
| archive-door | locked, open, complete | observatory evacuation exit, archive spirit passage |
| lantern-boat | waiting, boarding, complete | dock escort exit |
| safe-shelter | waiting, complete | Kaji's witness safe zones |
| escape-arch | waiting, complete | aqueduct prisoner extraction (bell countdown pips drawn by the page) |
| canal-lock | closed, open | tribunal canal lock |
| chain-post | chained, broken | prisoner anchors |
| release-gate | locked, ready, open | prison locks, garrison release |
| lantern-relay | dark, charging, lit | Black Gate relays |
| net-post | fogged, clearing, cleared | fog net anchors |
| seal-dais | dormant, active, broken | Blood Ward and exposed-seal mounts |
| fog-bell | ringing, silenced | storm-reef fog bell |
| slip-box | full, empty | name-slip sources |
| water-trough | flowing, released | flowing-water returns |
| release-mark | waiting, complete | bound Ashen Oni name return |
| orders-lectern | active, disabling, disabled | Ujiro's command orders |
| testimony-table, corrections-shelf, record-chest, tower-lantern | pending/unlit, complete/lit | epilogue memorial interactions |
| shelter-crates | idle | witness start positions |
| courier | safe, hurt, down | protected civilian courier |
| print-block | intact, damaged, cracked, destroyed | protected print blocks |
| archive-core | intact, damaged, critical, destroyed | protected archive evidence |
| bell-node | active, charging, broken, dormant | phase nodes and archive nodes |
| civilian-a/b/c | idle, walk, bound, safe, down | witness and prisoner tokens |

## Content boundaries

All objects are original and fictional. Ledgers, slips, records, and print blocks carry abstract marks only, never readable text. There are no shrine gates, temple bells, crests, or devotional objects; the fog bell is a secular harbour bell, and the bell nodes are an invented faceted shape. Civilians are non-combatants in varied dress and skin tones. Their incapacitated pose is seated with the head bowed, and prisoners are bound with rope. Nothing is gory. Record and evidence objects show preservation or repair when complete, never loot or trophies.

## Build and check

```powershell
python -m pip install -r requirements.txt
python build_action_objective_suite.py          # writes atlas, review sheet, manifest, runtime copy
python build_action_objective_suite.py --check  # non-writing byte-identity check
```

The builder renders twice and fails on any difference. It writes `action-objective-atlas-v1.png`, the labelled `action-objective-review-sheet-v1.png` (2x nearest-neighbour, review only), `manifest.json` (hashes, per-frame bounds and visual heights, palette usage), and the byte-identical runtime copy `game/assets/art/action-objective-suite-v1/action-objective-atlas-v1.png`.

## Runtime

`game/action-objective-atlas.mjs` is the DOM-free resolver. It maps kind + state to a frame (null for unknown pairs), checks image size, maps anchors, objects, and tokens to kinds, and reads presentation states from objective authority it never changes. `game/action-campaign-battle.js` draws the sprites, falls back to the old rectangles when the atlas fails, has the wrong size, or a kind is unknown, and reports `data-objective-art-state` on the canvas.
