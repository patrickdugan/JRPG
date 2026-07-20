# Party portrait expression suite

Original, code-authored portrait-scale redraws for all six canonical party members. The deterministic builder reuses palette IDs, colors, and costume/silhouette motifs from `../party-field-suite/party-field-suite.source.json`; no generated concept or raster atlas is an input. Every face is a fictional design. Mateus has original age lines, facial proportions, and hair with no real-person reference.

- `party-portrait-suite.source.json`: editable face-shape, costume, expression, and anchor contract.
- `party-portrait-expressions.png`: transparent 512 × 384 runtime candidate; 6 rows × 8 columns × 64 × 64, with no transparent reserve columns.
- `party-portrait-expressions-contact-sheet.png`: labeled 1648 × 1220 checkerboard review sheet; not for runtime use.
- `manifest.json`: exact frame rectangles, eye lines, mouth/focus anchors, expression semantics, source/export hashes, and review state.

Columns are neutral, resolve, strain, soften, concern, anger, surprise, and quiet. These are the complete eight production expression keys; speaking in-betweens, human readability testing, and external cultural review remain pending.

Run `python build_party_portrait_suite.py` to rebuild or `python build_party_portrait_suite.py --check` to byte-compare all generated outputs.
