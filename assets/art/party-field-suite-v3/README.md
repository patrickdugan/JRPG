# Party field suite v3

This suite supersedes v2 as the Campaign runtime atlas. Its visual target is an original late-1990s PlayStation JRPG field-sprite density: mature proportions, smaller readable faces, richer material separation, selective outlines, and more articulated movement.

## Provenance

The directional masters and visual direction board are AI-generated pixel-styled concepts. The builder removes their recorded flat chroma key, crops the four directional views, downsamples with BOX resampling to a fixed 64 × 80 native frame, applies one shared 48-color median-cut palette per character without dithering, and derives eight integer-aligned walk phases. The runtime outputs are therefore **deterministically pixelified derivatives**, not pixel-authored art.

## Runtime contract

- Seven characters and four directional facings.
- Native frame: 64 × 80 RGBA.
- Pivot and foot point: `(32, 77)`.
- Eight walk phases per direction at 40 ms each.
- South interact and hurt states.
- Binary alpha and a two-pixel transparent gutter.
- Runtime-owned root motion.

## Files

- `party-field-suite-v3.source.json`: source, conversion, geometry, and timing contract.
- `generation-prompts.md`: retained prompt record for the generated source concepts.
- `sources/`: generated review board and directional masters.
- `build_party_field_suite_v3.py`: deterministic conversion, animation, validation, and export builder.
- `party-field-atlas-v3.png`: transparent runtime atlas.
- `party-field-contact-sheet-v3.png`: opaque 2× review sheet.
- `party-field-motion-preview-v3.gif`: nearest-neighbor 3× motion review.
- `manifest.json`: source/output hashes, per-frame geometry, timing, colors, bounds, and provenance.

Run `python build_party_field_suite_v3.py` to rebuild. Run `python build_party_field_suite_v3.py --check` to verify byte-identical outputs.
