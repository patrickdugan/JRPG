# Party combat action suite

Original, code-authored combat key poses for Ren, Aya, Nikola, Mateus, Genta, and Kiku. The stable third-row key remains `lise` for runtime compatibility, but its pixels and NIKOLA review label present Nikola Dražanić: an original male Croatian minor aristocrat with a square doublet, falling band, moustache, clipped beard, rapier, and no real-person likeness. The builder reads canonical palette IDs, colors, and silhouettes from `../party-field-suite/party-field-suite.source.json`; it does not use generated concepts or raster atlases as input.

- `party-combat-suite.source.json` is the editable action and event contract.
- `party-combat-actions.png` is the transparent 480 × 384 runtime candidate: 6 rows, 10 columns, 48 × 64 per cell.
- `party-combat-actions-contact-sheet.png` is a labeled 1556 × 1222 checkerboard review sheet and is not for runtime use.
- `manifest.json` records exact frames, pivots `(24, 58)`, foot points, hit anchors, action semantics, palette reuse, hashes, and review state.

Columns are idle, move, guard, hit, basic-strike wind-up, basic-strike active, signature A, signature B, a braced post-action recovery hold, and a non-gory collapsed defeat hold. These are silhouette-defining production keys, not complete animation clips. In-betweens, full recovery and defeat transitions, alternate facings, portraits, human readability testing, and external cultural review remain pending.

Run `python build_party_combat_suite.py` to rebuild or `python build_party_combat_suite.py --check` to byte-compare every generated file.
