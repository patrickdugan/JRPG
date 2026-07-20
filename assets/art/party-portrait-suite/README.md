# Party portrait expression suite

Original, code-authored portrait-scale redraws for all six canonical party members. The deterministic builder reuses palette IDs, colors, and costume/silhouette motifs from `../party-field-suite/party-field-suite.source.json`; no generated concept or raster atlas is an input. Every face is a fictional design. Mateus has original age lines, facial proportions, and hair with no real-person reference.

- `party-portrait-suite.source.json`: editable face-shape, costume, expression, and anchor contract.
- `party-portrait-expressions.png`: transparent 384 × 384 runtime candidate; six rows × four columns × 64 × 64.
- `party-portrait-expressions-contact-sheet.png`: labeled 880 × 1220 checkerboard review sheet; not for runtime use.
- `manifest.json`: exact frame rectangles, eye lines, mouth/focus anchors, expression semantics, source/export hashes, and review state.

Columns are neutral, resolve, strain, and soften. Camp uses the neutral column and Campaign scene focus selects one of the four keys from its authored gesture cue, with dimension-gated loading and procedural fallbacks. These are production expression keys, not a full eight-expression dialogue set. Additional emotions, speaking in-betweens, human readability testing, and external cultural review remain pending.

Run `python build_party_portrait_suite.py` to rebuild or `python build_party_portrait_suite.py --check` to byte-compare all generated outputs.
