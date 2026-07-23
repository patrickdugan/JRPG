# Pixel-art provenance contract

## Classifications

### AI-generated pixel-styled concept

Use when a generative model produced the raster, even if it visually resembles hand-pixeled work.

Allowed claims:

- AI-generated pixel-styled concept
- generated review asset
- visual reference for later production work

Disallowed claims:

- hand-pixeled
- pixel-authored
- deterministic source art
- production-ready solely because it looks crisp

### Deterministically pixelified raster

Use when a documented transform resampled and palette-quantized an existing raster.

Allowed claims:

- deterministically pixelified
- fixed-resolution and palette-bounded
- reproducible under the recorded tool version and settings

Disallowed claims:

- hand-pixeled
- manually stenciled
- original pixel authorship

### Pixel-authored production asset

Use only when pixels or code-native pixel primitives were intentionally authored at native resolution and the editable source is retained.

Required evidence:

- editable native-resolution source or deterministic primitive builder
- explicit palette and alpha policy
- geometry contract and integer alignment
- source/output hashes
- rebuild or edit trail
- human visual review

## Derivative records

Every conversion manifest should record:

- classification;
- source path, hash, dimensions, and mode;
- resampling and palette method;
- target dimensions and actual color count;
- alpha policy;
- preview scale;
- tool and Pillow versions;
- output paths and hashes.

Provenance describes process, not quality. A pixelified derivative may be beautiful and useful without being pixel-authored.
