# Canonical Enemy Animation Suite V2

This package turns twelve original enemy animation concept boards into consistent
side-view runtime candidates. Each family has a 6×4 atlas of 160×160 RGBA cels
and a nearest-neighbor review GIF.

## Roster

| Catalog | Enemy | Combat lesson | Signature |
| --- | --- | --- | --- |
| ENM-001 | Cinder Hound | rushing beast / heat escalation | `cinder-overload` |
| ENM-002 | Ash Wisp | floating construct / area denial | `ash-nova` |
| ENM-003 | Bell Moth | flying diver / resonance zone | `bell-resonance` |
| ENM-004 | Tithe Enforcer | armored bruiser / seal slam | `tithe-seal` |
| ENM-005 | Registry Hound | court scout / pursuit mark | `registry-mark` |
| ENM-006 | Drowned Retainer | waterlogged duelist / lane bind | `undertow-bind` |
| ENM-007 | Lantern Leech | hovering siphon / tether drain | `lantern-drain` |
| ENM-008 | Salt Warden | sea-route elite / brittle rampart | `salt-rampart` |
| ENM-009 | Ashen Spearman | spacing infantry / lane charge | `ash-lane-charge` |
| ENM-010 | Ashen Banner Guard | defensive infantry / banner wall | `banner-wall` |
| ENM-011 | Forge Thrall | furnace construct / floor vent | `ember-vent` |
| ENM-012 | Bell Scribe | masked support / docket mark | `docket-mark` |

## Sheet contract

Every atlas is 960×640 pixels with six columns and four rows:

1. `locomotion` — contact, compression, passing, extension, second contact,
   ready.
2. `basic-attack` — ready, anticipation, commitment, active, follow-through,
   recovery. The damage event is frame 3.
3. `signature-attack` — ready, anticipation, charge, active, recoil, recovery.
   The enemy-specific signature event is frame 3.
4. `hurt-defeat` — hurt contact, compression, stagger, collapse, defeated,
   defeated hold.

The source contract records exact frame timings, event names, facing, root-motion
ownership, pivot profiles, foot points, and generic hurt bounds. Hit boxes and
effect anchors remain encounter-specific integration work.

## Production classification

The PNG boards in `sources/` are AI-generated stylized animation concepts made
with Codex built-in image generation. The transparent versions were produced
with the image-generation skill's chroma-removal helper. The runtime atlases are
deterministic BOX-resampled, non-dithered, palette-bounded derivatives.

These assets are **not pixel-authored**. They are classified as:

- source: `AI-generated stylized animation concepts`
- derivative: `deterministically pixelified`
- visible color ceiling: 64 colors per enemy family
- alpha: binary, values 0 and 255 only
- native cel: 160×160 pixels with a minimum 2-pixel transparent gutter

The chroma sources are intentionally retained for provenance and future
re-extraction.

## Build and verify

Install the pinned dependency:

```powershell
python -m pip install -r requirements.txt
```

Build:

```powershell
python build_enemy_animation_suite_v2.py
```

Verify byte-identical output:

```powershell
python build_enemy_animation_suite_v2.py --check
```

The builder proportionally derives the 6×4 source-grid boundaries from each
board's real dimensions, removes small edge-touching crop debris, hardens alpha,
fits the art into a stable 160×160 cel, creates one 64-color palette per enemy,
and writes atlas, GIF, contact-sheet, and manifest hashes.

## Review and integration

Start with
`enemy-animation-roster-contact-sheet-v2.png`, then inspect each
`*-all-actions-v2.gif` at nearest-neighbor scale. The `*-atlas-v2.png` files are
the transparent runtime candidates.

Before runtime promotion, tune per-encounter scale and verify pivots, hurt boxes,
attack hit boxes, VFX anchors, and event timing against the actual side-scroll
combat camera. No runtime code is changed by this asset package.
