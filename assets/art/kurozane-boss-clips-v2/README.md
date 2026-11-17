# Shogun Kurozane: boss clips v2 (from the approved kits)

Kurozane's runtime boss clips are built from his two existing, approved
animation kits instead of new art:

- `../kurozane-final-battle-v1/`: court command, yearless thrust, blood-eclipse
  transform, black-chrysanthemum defeat (four clips x six keys);
- `../kurozane-oni-attack-suite-v1/`: gauntlet swipes, predator jump, spear wheel,
  mouth cannon, chest spiral barrage (36 keys).

## Provenance

The kits' keys are **AI-generated stylized concepts, deterministically
pixelified** (see each kit's README and manifest). This build re-renders those
keys through the toolkit's two-part cut-out rig (`anim_rig.two_part_rig`:
Scale2x x3 + nearest-neighbour rotation, no new colours, binary alpha), so its
lane is `deterministically-pixelified (rig-posed)`. It is not pixel-authored and
must not be described as hand-pixeled.

The kit keys are the only full pose changes. Rig-posed moving holds fill each
clip to the 20-30 unique-frame standard: a lean toward the next key, a
straining tremble on the held tell, a drive through the strike, recoil, daze,
settle onto the next key, breathing, and a stalking glide. Each kit row is first
normalised to one sole line (the rows' ground rows differ: court 157, thrust
150, transform 146, demon kneel 136, spear wheel 127).

## Clips

| Clip | Form | Keys | Frames (unique) |
| --- | --- | --- | ---: |
| `idle` | armour | court command ready | 20 (20) |
| `locomotion` | armour | spear wheel ready | 20 (20) |
| `strike` (Yearless Thrust) | armour | yearless thrust 1-6; 10 / 4 / 10 bands | 24 (24) |
| `signature` (Court Command) | armour | court command 1-6; 12 / 4 / 10 bands | 26 (26) |
| `stagger` | armour | gauntlet follow-through, predator-jump recovery, court ready | 21 (20) |
| `transition` (into the bell phase) | armour to demon | blood-eclipse transform 1-6 | 24 (24) |
| `idle@demon` | demon | transform recovery | 20 (20) |
| `locomotion@demon` | demon | transform commitment | 20 (20) |
| `stagger@demon` | demon | transform extension, chrysanthemum anticipation, transform recovery | 21 (21) |
| `eclipse` (Blood Eclipse) | demon | transform recovery, chrysanthemum anticipation and wind-up arcs | 24 (23) |
| `chrysanthemum` (Black Chrysanthemum) | demon | chrysanthemum anticipation, wind-up, radial active | 24 (24) |
| `transition@dawn` | demon | transform recovery, chrysanthemum anticipation and wind-up | 21 (20) |
| `defeat` | demon to ward-broken | ward-break, living collapse, living defeat | 21 (20) |

The manifest's `phaseForms` maps the boss phases `court`, `bell`, `dawn` to the
forms `""`, `demon`, `demon`; the runtime shows `clip@demon` in place of `clip`
while the demon form is active. `attackClips` binds the four live kernel
attacks. The defeat resolves to a living, ward-broken Kurozane kneeling with his
helmet set down, as doc 10 section 7.3 requires; there is no death loop.

The Oni kit's five attacks have no live kernel attack in `c9-kurozane`; their
ready, follow-through, and recovery keys pose the armoured locomotion and
stagger. Their attack keys wait for kernel attacks that use them.

## Geometry and runtime

- Logical frame 192 x 192, foot point (96, 166), native facing screen-left,
  presentation pixel scale 1.0 (the kits' native resolution; no resampling).
- One sheet, `kurozane.png`: 4095 x 1149 px, 1,532,960 bytes, 18.8 MB decoded,
  loaded only in the Kurozane encounter. A copy lives in
  `game/assets/art/boss-animation-suite-v2/` beside the other bosses.
- If the sheet or manifest fails, is invalid, or has the wrong size, the battle
  page draws the static seven-pose boss atlas exactly as before.

## Build

```powershell
python build_kurozane_boss_clips_v2.py
python build_kurozane_boss_clips_v2.py --check
```

`--check` rebuilds in memory and requires every artifact (sheet, manifest,
runtime copy, review contact sheet and GIF, build summary) to be byte-identical.
`review/` holds the labelled contact sheet and a GIF of the four attacks; both
are review material, never runtime input.
