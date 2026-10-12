# Enemy Animation Suite V4: summoned wards, seal, echo, and record

This package replaces five side-view combat stand-ins that used to borrow the
art of unrelated enemies through `ENEMY_COMBAT_ANIMATION_ALIASES`:

| Catalog | Template | Was drawn as | Now | Signature |
| --- | --- | --- | --- | --- |
| SUM-001 | `blood-ward-west` | Ashen Spearman | hovering black-lacquer ward-lantern with a crimson blood-glass lens and thorned-crescent mark | `sanguine-ward-pulse` |
| SUM-002 | `blood-ward-east` | Ashen Banner Guard | the same ward, mirrored, with wine-dark glass and oxidized-bronze fittings | `sanguine-ward-pulse` |
| SUM-003 | `tithe-seal` | Salt Warden | the Tithe Hound's Exposed Seal: a scalloped red-wax registry seal on an indigo cord, trailing torn ledger tabs and orbiting ink beads | `ink-wax-stamp` |
| SUM-004 | `court-clone` | Mourning Ronin | an umbral echo of Kurozane: horned kabuto, lamellar armour, crimson office plate, spear, dissolving lower body | `clone-order` |
| SUM-005 | `unfiled-testimony` | Ash Wisp | a hooded robe of singed testimony pages around an empty, gold-dashed record gap, trailing an untied teal cord | `testimony-unfold` |

## Design notes

- **Blood Ward Seal.** Father Mateus summons two "black-red seals" beside the
  bell in phase two; they are attackable ward objects that cut his incoming
  damage until both break. The ward is an invented lacquer lantern-tablet. It
  is not a reliquary, monstrance, cross, or any real devotional object, and it
  has no gore: its glass shatters and the tablet lies broken on the floor in
  the defeated hold. The signature opens its side panels, throws a thorned
  crescent forward, and sends a tether of light upward toward the bell.
- **Exposed Seal.** Consume Ink exposes the seal beneath the Hound's jaw as a
  temporary weak point. The registry mark (a diamond crossed by a ledger line)
  is invented and unreadable. The basic action is a forward stamp with an ink
  imprint; the signature lights the mark gold and sprays ink spokes. Defeat
  splits the wax into two halves among scattered tabs.
- **Court Clone.** "A command made visible." The clone borrows Kurozane's
  silhouette language from `boss-combat-atlas.mjs` and
  `kurozane-final-battle-v1` (horned kabuto, lamellar plates, red chest plate,
  spear) in a darker umbral palette. Translucency comes from clustered binary
  holes that grow toward the feet, with a violet rim light. There is no partial
  alpha. Clone Order thrusts the spear and plants a small black chrysanthemum
  seal at the tip; the signature casts a large defaced seal. Defeat dissolves
  the clone into motes and leaves a cracked seal on the floor.
- **Unfiled Testimony.** A non-hostile record gap in the epilogue, which is
  acknowledged rather than defeated. Its "attacks" present pages (a fan) and
  unroll a testimony scroll. The defeated hold is a neat, cord-tied stack with
  a warm page on top: the record is kept, not destroyed.

Hovering objects (both wards, the seal, and the testimony) set `idleLoop`, so
the runtime keeps their bob and orbit loop going while they stand still.
Reduced motion holds the ready frame.

## Sheet contract

Each `{id}-atlas-v4.png` is `960x640`: six `160x160` cels by four clips, in
the same clip contract as V2/V3:

1. `locomotion`: hover or stride; frame 6 is the ready/idle pose;
2. `basic-attack`: ready, anticipation, commitment, active (`damage`), follow-through, recovery;
3. `signature-attack`: ready, anticipation, charge, active (signature event), recoil, recovery;
4. `hurt-defeat`: hurt contact, compression, stagger, collapse, defeated, defeated hold.

All cels face screen-left, use binary alpha, keep a transparent gutter of at
least 2 px, and stay within the 64-colour ceiling (13 to 21 colours per
family). Anchor profiles: `ward-object`, `seal-object`, and `paper-spirit` put
the pivot at `[80,148]` with the body floating above it; `umbral-human` puts
the pivot at `[80,148]` with the feet on `y=151`. The runtime simulation owns
root motion, damage, collision, and facing.

## Provenance

This is **pixel-authored deterministic production**.
`build_enemy_animation_suite_v4.py` rasterizes every cel at native resolution
from code-native primitives: integer-rounded polygons, ellipses, pixel runs,
and mask edge operations for outline, light, and shadow bands, all under an
explicit per-family palette. No image generator, source raster, resampling,
interpolation, or dithering is involved. The builder fails a cel that leaves
its palette, uses partial alpha, breaks the gutter, or duplicates another cel.

## Build

```powershell
python -m pip install -r requirements.txt
python build_enemy_animation_suite_v4.py
python build_enemy_animation_suite_v4.py --check
```

`--check` rebuilds everything in memory and verifies that all twelve
artifacts are byte-identical. `manifest.json` records builder and source
hashes, per-cel RGBA hashes, bounds, gutters, colour counts, events, anchors,
and palettes. The `{id}-review-3x-v4.png` sheets (labelled, with the pivot
marked) and `enemy-animation-roster-contact-sheet-v4.png` are for review only
and are not used at runtime.

The atlases are packed losslessly into rows 28 to 32 of
`../enemy-combat-animation-runtime-v1/enemy-combat-animation-atlas-v1.png` by
that package's builder. Rebuild it after changing this suite.
