# Party animation suite v2

Banded 20 to 24 frame party clips and the cooldown "tired" loop for all seven
fighters (Ren, Aya, Nikola as `lise`, Mateus, Genta, Kiku, Miyo).

## Provenance

**Pixel-authored lane.** Every frame is composed from the frozen native-resolution
key poses in `../roster-animation-runtime-v1/sources/party-combat-key-poses-v1.png`
(which descend from the code-authored `party-combat-suite`) using integer puppet
operations: whole-row chest stretch, whole-pixel shear, a separate head block,
independently moved feet, cloth-hem and weapon-tip sway, a hit flash, and
code-drawn breath, sweat, fan, smear and signature marks. No generated art, no
resampling, binary alpha, no new palette entries beyond a handful of breath and
sweat tints.

## Atlas

`party-animation-atlas-v2.png` is 1440 x 4480: 30 columns of 48 x 64 cells, 70
rows (character-major, ten clips per character). Pivot and foot point
`(24, 58)`, right-facing, simulation owns root motion.

| clip | frames | sampling |
| --- | --- | --- |
| idle | 24 | time, loops |
| move | 20 | time, loops |
| tired | 24 | cooldown progress (slump-in 0-5, heavy-breath 6-17, straighten 18-23) |
| ready-snap | 6 | time, plays once after the ring completes |
| basic-strike | 21 | phase progress: windup 0-6, active 7-12, recovery 13-20, damage event on 7 |
| guard | 24 | time |
| hurt | 22 | hit-stun progress, then time for the follow-through |
| signature-a / signature-b | 21 each | phase bands as basic-strike |
| defeat | 20 | time since defeat, holds the final frame |

Every clip has at least 20 unique frames for every character (the builder fails
otherwise, and `game/tests/party-extended-animation.test.mjs` re-checks the
manifest hashes). `ready-snap` has 6.

Tired idioms per character: steam breath for Ren, Nikola and Genta; running
sweat for Aya and Mateus; a flicked paper fan for Kiku; a trembling-hand sweat
bead for Miyo. Ren, Aya, Mateus, Genta, Kiku and Miyo slump into the planted
recovery stance; Nikola stays upright and heaves.

## Runtime

`game/party-extended-animation.mjs` samples the atlas. `game/action-campaign-battle.js`
uses it when the atlas has loaded and falls back to the 4 to 6 frame clips of
`roster-animation-runtime-v1`, then to `party-combat-suite`. The tired loop plays
only while a fighter stands free during the shared offensive cooldown; wind-up,
active, recovery, hit-stun, maneuvers and movement keep their own clips.

## Build

```
python build_party_animation_suite.py          # rebuild
python build_party_animation_suite.py --check  # byte-compare every output
python build_party_animation_suite.py --strips <dir>  # per-clip review strips
```

The runtime copy of the atlas lives in `game/assets/art/party-animation-suite-v2/`.

## Review receipt

Reviewed on `party-animation-tired-contact-sheet-v2.png` (tired plus ready-snap,
every character) and per-clip strips at 3x. Two critique passes. Pass one: smear and
signature marks were clamped inside the 48 px cell, hit flash became a solid
silhouette, guard and hurt hold frames received extra shudder so each clip clears 20
unique frames, and the stretch operation was fixed to keep weapon tips. Pass two
(on the tired contact sheet): breath puffs, sweat beads and the fan were enlarged
because they read too faint at 1.75x game scale.
Limits: arms are not separate layers, so the weapon arm moves with the torso; the
pose changes between key poses are stepped rather than eased.
