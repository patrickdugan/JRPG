# Original Late-16-Bit JRPG Combat Roster V1

This package gives the current combat roster a shared, compact late-16-bit
console-JRPG silhouette language without copying or tracing any existing
franchise sprites.

## Coverage

- Seven party members
- Twelve V2 enemy families
- Four human enemy families
- Eight mythic-beast enemy families
- Four lethal-plant enemy families
- Kurozane in four final-battle states

The suite contains 39 four-pose atlases representing 36 combat identities.
Kurozane's four transformation states are separate runtime atlases.

## Pose contract

Every atlas is `256x64`, arranged as four `64x64` cels:

1. idle
2. movement/contact
3. signature attack
4. hurt or defeat hold

All subjects face screen-left. Root motion belongs to the runtime. The
canonical pivot is `(32, 58)` and the foot anchor is `(32, 61)`.

## Production contract

- Source lane: **AI-generated pixel-styled concept**
- Derivative lane: **deterministically pixelified**
- These assets are **not pixel-authored**
- Resampling: BOX
- Dither: none
- Visible-color ceiling: 24 colors per cel
- Alpha: binary
- Native cel: `64x64`
- Nearest-neighbor review preview: 4x

The flat magenta source boards are retained in `sources/` for provenance and
rebuildability. Runtime atlases are in `sprites/`; enlarged checkerboard
previews are in `previews/`.

## Rebuild

```powershell
python .\build_late_snes_roster_suite.py
python .\build_late_snes_roster_suite.py --check
python .\verify_late_snes_roster_suite.py
```

The second command rebuilds every generated file in a temporary directory and
requires byte-identical output. The verifier checks all 156 native cels for
geometry, palette, binary alpha, and transparent gutter compliance.
