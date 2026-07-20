# Generic NPC field-sprite foundation

This directory contains an original, deterministic 32 x 48 pixel-art suite for Campaign markers that the live data explicitly identifies as people. It is code-authored from editable JSON palettes and Pillow primitives; generated or borrowed pixels are not an input. A separate generated roster under `assets/production/` is a silhouette reference only.

The four legacy roles remain `speaker`, `interviewee`, `confined-person`, and `courier`. Twelve additional authored community roles are `dock-worker`, `ferry-captain`, `market-seller`, `trade-broker`, `print-organizer`, `port-clerk`, `physician`, `resident`, `former-retainer`, `caretaker`, `net-mender`, and `post-keeper`. The nine individually typed level contacts and four person-target side-story contacts use exact structured role metadata; 37 interview nodes retain the generic `interviewee` row because their schema does not identify a more specific visual role. Four collective side-story talk targets and the level-owned `witness-circle` retain geometric markers. The runtime does not infer roles from actions, IDs, names, labels, results, or prose.

Every role has `south-idle` and `south-gesture` frames. Campaign shows the empty-hand gesture for one bounded phase of a slow decorative loop and freezes on idle under reduced motion. The pose never changes interaction range, timing, collision, or save state. Props, hazards, exits, evidence, mechanisms, deliveries, care/rescue procedures, councils or ambiguous groups, unrelated combat markers, devotional objects, and every other untyped marker retain Campaign's prior art.

Files:

- `npc-field-suite.source.json`: editable geometry, taxonomy, palette, policy, and exclusions.
- `build_npc_field_suite.py`: deterministic native-resolution pixel builder.
- `npc-field-atlas.png`: transparent 512 x 96 runtime atlas containing 32 frames.
- `npc-field-contact-sheet.png`: labeled 1072 x 928 review sheet; never used at runtime.
- `manifest.json`: dimensions, mappings, frame rectangles, per-frame RGBA hashes, and export hashes.

Run `python build_npc_field_suite.py` to rebuild the generated artifacts and runtime copy. Run `python build_npc_field_suite.py --check` to byte-compare them. Each frame uses pivot/foot point `(16, 44)`, a transparent border, and three transparent rows below the feet. These are fictional people with plain invented clothing geometry and secular work items: no real-person likeness, real insignia, weapon, or sacred/devotional prop is present.
