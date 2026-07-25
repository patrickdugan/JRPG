# Combat Character Field Animation v1

This package closes the field-animation gap for the 32 enemy and boss-state
packages introduced by `combat-character-coverage-v1`.

Each character receives four directional clips. Every direction has one
standing key plus a four-phase walk cycle:

1. contact
2. compression
3. passing
4. extension

The native runtime cell is `48x48`. The combined atlas is `20` columns by `32`
rows (`960x1536`). East-facing frames are deterministic mirrors of west-facing
frames. Root motion belongs to simulation; the artwork contains only local
weight shift and one-pixel body mechanics.

## Provenance

The input field keys are deterministically pixelified derivatives of
AI-generated pixel-styled concept boards. These animation sheets remain
**deterministically pixelified derivatives**. They are not described as
hand-pixeled or pixel-authored.

## Build and verify

```powershell
python build_combat_character_field_animation.py
python verify_combat_character_field_animation.py
python build_combat_character_field_animation.py --check
```

`combat-character-field-animation-motion-preview-v1.gif` and the contact sheet
are review artifacts. Runtime timing, pivots, frame events, and clip order live
in `manifest.json`.
