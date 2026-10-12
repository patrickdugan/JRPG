# Action Stage Backdrop Suite V1

Side-view backdrops and ground/platform surface tiles for the 20 real-time
action battle stages declared in `game/action-stages.mjs`. They replace the
earlier presentation, which stretched the top-down 12 x 7 tactical board art
behind side-view fighters.

## Contract

- One opaque backdrop per action stage: `backdrops/<stage-id>.png`,
  480 x 270 RGBA, presented at an exact 2x integer scale on the 960 x 540
  action canvas with nearest-neighbour sampling.
- Layered depth: sky or ceiling, far silhouettes, mid architecture or
  terrain, and a ground band whose walkable top row sits exactly on that
  stage's `groundY / 2` in native pixels.
- A calm, low-contrast band behind the fighters (native rows 64 to `groundY`).
  The manifest records mean, 5th and 95th percentile relative luminance and the
  share of bright pixels for that band. The acceptance test re-measures it.
- `action-stage-surface-tiles.png`: 96 x 320 RGBA with binary alpha. One row
  per stage, in `ACTION_STAGE_IDS` order. The six 16 x 16 columns are
  `ground-a`, `ground-b`, `platform-left`, `platform-middle`,
  `platform-right` and `support`. Row 0 of each tile is the walkable surface.
- The runtime draws the surfaces from the physics contract, never from the art.
  The ground row is tiled at `groundY` across the canvas. Each one-way
  platform gets caps and cropped middles spanning exactly `left..right` at
  `y`. Optional support posts run from below the deck to the ground. Organic
  ledges (cedar roots, tide shelves, reef spines) have no posts. The Python
  `surface_plan()` and the JS `planActionStageSurfaces()` emit identical draw
  operations, and the manifest stores a hash of each plan.
- Art never changes collision. `game/action-stages.mjs` owns the ground,
  platforms, spawns and objective anchors. The manifest copies each stage's
  geometry, and the acceptance test fails if the two drift apart.

## Stages

| Stage | Backdrop |
| --- | --- |
| `hsh-census-square` | Hoshigawa square in rain: townhouses, blank census board, fire-watch tower with a cracked alarm bell, river warehouses, distant Kurohana keep |
| `c1-flooded-cedars` | Flooded cedar grove in rain and mist; root ledges grow from two edge trunks; roadside box lantern |
| `c1-tax-storehouse` | Storehouse interior: lattice-joint lower wall, beams, barred window with a moonlight shaft, open fire-door, rice bales, ledger chests, iron brazier |
| `fp1-wet-cedar-stage` | Temple service path: stone steps into mist toward a roofed gatehouse, stone retaining wall, fence, cedars, temple halls on the ridge |
| `fp1-flooded-archive-stage` | Flooded archive hall: low-contrast shelving, lattice window with a moonlit cloud bank, hanging lanterns, reflective water floor |
| `tkm-bell-chamber` | Bell chamber: one wall-to-wall bell beam with knee braces, an unmarked bronze bell, striking log, rain lattices |
| `sdg-rain-docks` | Sodegaura harbour in rain: quay warehouses, moored boats, jib crane, lantern boats at the escort exit |
| `sdg-salt-warehouse` | Salt warehouse: board walls, heaped salt bags, crane hook with the bell key, open doors onto a storm harbour |
| `ngi-tide-caves` | Sea cave: rock masses, stalactites, a jagged mouth onto the fog sea, a fishers' net, tide pools |
| `ngi-storm-reef` | Fog sea under storm: carrack wreck on the horizon, wave rows, jagged reef rocks, spray |
| `kgr-ash-fields` | Kagura ash pass: smoking volcano, relay towers, stilt relay hut, warning posts, charred trees, sunken release channel |
| `kgr-archive-furnace` | Oni forge: furnace mouth above the fighters, closed iron doors, iron ledger racks, flues, chains, embers |
| `kzu-archive-roof` | Kozui rooftops at night: layered roofs, archive tower, canal glint, red patrol lanterns, moon |
| `kzu-public-tribunal` | Magistrate's court: lacquer hall with valance, blank notice boards, white-gravel court, tripod braziers, canal lock with winch |
| `hsh-prison-ferry` | Night river crossing: far-bank cedars and post-town lights, current lines, ferry cable, caged prison barge |
| `hsh-bell-aqueduct` | Stone aqueduct arcade with hanging count bells and spilling water |
| `c8-black-gate` | Kurohana Black Gate: keep beyond the walls, flanking towers, studded lacquer doors with umbral veins, lantern relays, ash haze |
| `krh-outer-archive` | Castle archive: black lacquer stacks, slatted blood-dark glass windows, bell-mouth wall opening, veined pillars |
| `krh-observatory` | Throne observatory: dome open to the stars, invented armillary rings, the unmarked Yearless Bell, empty throne dais, bell-mouth niches |
| `epi-hoshigawa-archive` | Public archive at daybreak: dawn lattice windows, repaired shelves and fresh timber, testimony table, tower lantern |

## Provenance

These are **pixel-authored production assets** made by deterministic
generation. `build_action_stage_backdrop_suite.py` is the editable source.
It draws every pixel at native resolution with integer-coordinate Pillow
primitives under an explicit per-stage palette, seeded by a SHA-256-keyed
xorshift generator. No raster is imported, sampled, traced or resampled, and no
image generator was used. This is not hand-pixeled art, and it makes no
hand-authorship claim. The labelled review sheet uses an embedded 5 x 7
bitmap font rather than a system font, so it rebuilds byte for byte.

The manifest records the builder hash, per-file SHA-256 and RGBA hashes,
colour counts, the geometry it was built against, the surface-plan hashes
and the calm-band metrics.

## Restrictions

No actors, lettering, readable records, UI, real heraldry, sacred objects or
devotional symbols. Gates, bell frames, windows and masts are deliberately
shaped so they do not form torii or cross silhouettes. Bells are generic and
unmarked. Kurohana corruption appears as umbral veins, bell mouths and
blood-dark glass, never as gore. The fictional victim fixtures on the
tactical boards are not depicted here. The suite still needs external
Japanese cultural review and is not art-locked.

## Rebuild and verify

Requires Python 3.12 with `Pillow==11.3.0` (`requirements.txt`).

```powershell
python .\build_action_stage_backdrop_suite.py          # writes suite and game/ runtime copies
python .\build_action_stage_backdrop_suite.py --check  # non-writing byte-identity receipt
```

The builder renders twice in memory and refuses to write unless the two
renders are byte-identical. It writes the runtime copies to
`game/assets/art/action-stage-backdrop-suite-v1/`, which
`game/action-stage-backdrop-atlas.mjs` addresses.
