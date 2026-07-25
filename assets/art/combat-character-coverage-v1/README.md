# Combat Character Coverage V1

This package closes portrait and top-down field gaps for the current combat
roster and links every entry to its existing side-view sheet.

## Coverage

- Seven party members reuse their existing 96x96 portrait and 32x48 field
  atlases.
- Twenty-eight enemy families receive new 96x96 portraits and four-view
  48x48 field atlases.
- Kurozane receives separate coverage for court-human, oni-armor,
  demon-mode, and ward-broken states.
- All 39 state packages reference a 64x64-cel side-view atlas.

The resulting inventory covers 36 combat identities through 39 state
packages.

## Contracts

Portraits are `96x96`, use at most 32 visible colors, binary alpha, and a
two-pixel transparent gutter.

Enemy and boss field atlases are `192x48` with four `48x48` frames:

1. south idle
2. west contact
3. north idle
4. south extension

East-facing field presentation mirrors west at runtime. Root motion remains
runtime-owned.

## Provenance

- Source boards: **AI-generated pixel-styled concepts**
- Runtime derivatives: **deterministically pixelified**
- These files are **not pixel-authored**

The chroma-key and alpha source boards are retained in `sources/`. The alpha
boards were produced with the installed image-generation chroma-removal
helper using soft matte, despill, and one-pixel edge contraction.

## Rebuild and verify

```powershell
python .\build_combat_character_coverage.py
python .\verify_combat_character_coverage.py
python .\build_combat_character_coverage.py --check
```
