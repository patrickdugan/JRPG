# Party portrait expression suite v2

This package upgrades all seven party members across eight canonical expressions. The source boards are AI-generated, identity-locked portrait studies; the 768 × 672 runtime atlas is a deterministic 7 × 8 × 96 × 96 pixelification using one shared 64-color visible palette, no dithering, and binary transparency.

The art direction is original premium gothic 32-bit-era JRPG portraiture: elegant anime realism, ink-like contour control, baroque chiaroscuro, disciplined costume detail, and crisp pixel clusters. It targets the finish and readability of top-tier gothic action RPG portrait art without copying a franchise character, actor, celebrity, real person, or named artist.

- `party-portrait-suite-v2.source.json` records geometry, identity, expression, crop, palette, alpha, and provenance contracts.
- `sources/` contains the seven chroma-removed 1536 × 1024 expression boards.
- `party-portrait-expressions-v2.png` is the transparent 96 × 96-cel runtime candidate.
- `party-portrait-expressions-v2-contact-sheet.png` is the labeled review sheet and is not loaded by the game.
- `manifest.json` records source/export hashes, the shared palette, exact frame rectangles, alpha bounds, and validation.

Provenance claim: deterministically pixelified from AI-generated raster sources; not hand-pixeled or pixel-authored.

Run `python build_party_portrait_suite_v2.py` to rebuild or `python build_party_portrait_suite_v2.py --check` for a byte-for-byte verification.
