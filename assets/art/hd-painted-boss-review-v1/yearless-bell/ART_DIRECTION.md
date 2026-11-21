# Yearless Bell: standalone six-pose premium art brief

Canonical game references:

- game/content/encounters.mjs, c8 Yearless Bell phase-object and the yearless-ring attack
- assets/art/boss-animation-suite-v2/boss-animation-suite-v2.source.json
- game/assets/art/boss-animation-suite-v2/yearless-bell.json
- game/assets/art/hd-boss-vfx-v1/yearless-bell-windup.png and yearless-bell-active.png

## Fixed silhouette

The boss is an ancient suspended **bronze ritual bell** with a visible clapper,
taut chains, an Edo-era shrine support frame, four node sockets, engraved chrysanthemum
and weathered ritual inscriptions. It remains recognizably the same mechanical
bell in each pose. Its great weight and immobility should read clearly against
the rain-dark shrine and moonlight. Antediluvian gold, ash grey and dark green
patina dominate; ultraviolet light appears only when the stage nodes charge.

Avoid anthropomorphizing the bell as a robed human. Avoid a roster poster,
captions, portraits, invented extra NPCs, extra bell copies, cropped silhouettes,
background scenery or progress reports in the six-pose source.

## Exact HD source deliverable

One standalone **1536 × 1024** painting with a 3 × 2 grid of six distinct
512 × 512 poses on transparent or uniformly matteable studio background.
Each complete mechanical bell, suspension chain, support and clapper must fit
its own cell, with a consistent baseline and camera size.

| Cell | Pose | Combat narrative |
| --- | --- | --- |
| 01 | idle / stillness | Suspended weight, chains motionless, four sockets dark |
| 02 | sway / movement | Heavy slow bell sway, chains tension in opposite directions |
| 03 | node-charge / windup | Four sockets illuminate in square order, clapper draws back |
| 04 | yearless-ring / active | Clapper strikes; visible concentric violet ring waves |
| 05 | ward / recovery | Defensive interlocked chain silhouette, dying echoes |
| 06 | broken / collapse | Fallen cracked bell, snapped frame, sockets extinguished |

Keep spell VFX separated from the bell's body so the combat renderer can show
telegraphs and status effects without repainting the character silhouette.

## Gameplay authority

The original Yearless Bell phase object is invulnerable until its four stage
nodes have been neutralized. Its current authored combat logic controls ring
timing, radius, damage, stage safety, objective progress and defeat.
The HD images are a presentation option only, loaded with ?art=hd.

## Animation acceptance

- Isolate six alpha PNG keys, 384 × 384 each, packed 2304 × 384.
- Generate ten named motion clips in 12 × 2 WebP strips, 192 × 192 cells,
  24 frames/clip, and a total of 240 decoded frames.
- Preserve the actual bell and its engravings through all poses.
- Verify original-source SHA-256, packed-sheet SHA-256 and all 240 decoded cells.
- Check fixed ground/clapper anchor, chain motion, correct phase-windup timing,
  alpha edges, and that the six cells are individual bodies rather than UI art.
- Retain original pixel and authored VFX fallback until the complete source
  is visually approved and the binary files are committed to Git.

## Current state

The older review package JRPG_HD_Boss_yearless_bell_v1.zip derives its
figures from small comparison-poster crops and is not premium-resolution art.
Several further image renders returned ornate production-status posters rather
than a clean independent six-pose sheet, so those were rejected. This brief
is the explicit source-of-truth for the next standalone render.
