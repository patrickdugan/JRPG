---
name: pixel-art-production
description: Create, convert, audit, and integrate pixel-art assets, including deterministic raster pixelification, palette reduction, native-resolution sprites, tiles, animation sheets, atlas geometry, pivots, hit frames, nearest-neighbor previews, and provenance manifests. Use when Codex needs to pixelify an image, build or review sprites or GIFs, enforce palette and alpha constraints, prepare runtime atlases, or distinguish AI-generated pixel-styled concepts from mechanically pixelified and genuinely pixel-authored production art.
---

# Pixel Art Production

Classify the asset before modifying it. Never infer authorship from appearance.

## Select the lane

1. **Generated concept**: Use an image generator for visual exploration. Label the result `AI-generated pixel-styled concept`; do not call it hand-pixeled or production-ready.
2. **Deterministic pixelification**: Convert an existing raster to a fixed native resolution and bounded palette with `scripts/pixelify.py`. Label the result `deterministically pixelified`; do not call it pixel-authored.
3. **Pixel-authored production**: Edit pixels or code-native primitives at native resolution, under an explicit palette and geometry contract. A pixelified image may be an underlay, but it is not proof of authorship.

Read [references/provenance-contract.md](references/provenance-contract.md) whenever reporting authorship or production status. Read [references/animation-contract.md](references/animation-contract.md) for clips, sheets, pivots, attacks, or runtime atlases.

## Pixelify a raster

1. Inspect the source at full size. Record its dimensions, color mode, alpha, and intended runtime or review use.
2. Choose a native target size before choosing a preview scale. Preserve aspect ratio unless the user explicitly requests a crop or stretch.
3. Choose a palette ceiling. Start with 16-32 colors for a character concept and 8-16 for small UI sprites; adjust after inspecting the 1x native result.
4. Prefer `BOX` downsampling, no dithering, binary or preserved alpha, and nearest-neighbor preview enlargement.
5. Run:

```powershell
python scripts/pixelify.py `
  --input <source.png> `
  --native-out <name-native.png> `
  --preview-out <name-preview.png> `
  --manifest-out <name.manifest.json> `
  --target 384x256 --colors 32 --preview-scale 4
```

6. Audit both files:

```powershell
python scripts/audit_pixel_art.py --input <name-native.png> --expected-size 384x256 --max-colors 32 --require-opaque-alpha
python scripts/audit_pixel_art.py --input <name-preview.png> --expected-size 1536x1024 --max-colors 32 --require-opaque-alpha --native-source <name-native.png> --preview-scale 4
python scripts/pixelify.py <same arguments> --check
```

7. Inspect the native file at 1x and the preview at integer zoom. Reject unreadable faces, broken silhouettes, palette banding that changes material identity, or lost weapon geometry.

Use `--palette-json <palette.json>` when a project palette exists. The JSON must be an array of hex colors or an object containing a `colors` array.

Use `requirements.txt` to reproduce the tested Pillow version when exact PNG byte identity matters.

## Author production pixels

Treat production work as source code or editable native pixels:

- Fix canvas, frame size, pivot, foot point, transparent gutter, palette, alpha policy, and facing before drawing in-betweens.
- Make every damaging action expose wind-up, active, recovery, and event timing.
- Keep transforms integer-aligned. Use nearest-neighbor only for review scaling.
- Store editable primitives, frames, or source layers beside a deterministic builder.
- Emit hashes and a manifest. Provide a `--check` mode that rebuilds byte-for-byte.
- Inspect at 1x, integer zoom, and in motion. Automated validation cannot judge anatomy, readability, cultural accuracy, or animation appeal.

## Required reporting

Report:

- provenance lane;
- source and output paths;
- native dimensions and preview scale;
- actual palette size and alpha policy;
- validation commands and results;
- remaining work before runtime integration.

Never say `hand-authored`, `hand-pixeled`, or `pixel-authored` for generated or mechanically pixelified raster output.

## Resources

- `scripts/pixelify.py`: deterministic fixed-resolution conversion, palette reduction, nearest-neighbor preview, manifest, and byte check.
- `scripts/audit_pixel_art.py`: dimension, palette, alpha, and nearest-neighbor preview audit.
- `requirements.txt`: tested Pillow version lock for byte-level reproducibility.
- `references/provenance-contract.md`: authorship classifications and allowed claims.
- `references/animation-contract.md`: sprite-sheet and combat-animation geometry contract.
