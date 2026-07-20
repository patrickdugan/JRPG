# Generic NPC field-sprite foundation

This directory contains an original, deterministic 32 x 48 pixel-art foundation for Campaign markers that the live data explicitly identifies as people. It is code-authored from editable JSON palettes and Pillow primitives; generated or borrowed art is not an input.

The four canonical roles are `speaker` (an explicitly typed individual contact), `interviewee` (a person named by the scene-operation interview schema), `confined-person` (the two explicitly typed prisoner-grate contacts), and `courier` (the explicitly typed archive-roof civilian escort). Four collective side-story talk targets and the level-owned `witness-circle` retain geometric markers. The runtime does not infer roles from actions, IDs, names, labels, results, or prose. Witness fieldwork currently emits only its first and final blueprint nodes, so its unused `Invite` blueprint is deliberately not mapped. Props, hazards, exits, evidence, mechanisms, deliveries, care/rescue procedures, councils or ambiguous groups, unrelated combat markers, devotional objects, and every other untyped marker retain Campaign's prior art.

Files:

- `npc-field-suite.source.json`: editable geometry, taxonomy, palette, policy, and exclusions.
- `build_npc_field_suite.py`: deterministic native-resolution pixel builder.
- `npc-field-atlas.png`: transparent 128 x 48 runtime atlas.
- `npc-field-contact-sheet.png`: labeled 944 x 412 review sheet; never used at runtime.
- `manifest.json`: dimensions, mappings, frame rectangles, per-frame RGBA hashes, and export hashes.

Run `python build_npc_field_suite.py` to rebuild the generated artifacts and runtime copy. Run `python build_npc_field_suite.py --check` to byte-compare them. Each frame uses pivot/foot point `(16, 44)`, a transparent border, and three transparent rows below the feet. These are generic fictional people with plain invented clothing geometry: no real-person likeness, real insignia, weapon, or sacred/devotional prop is present.
