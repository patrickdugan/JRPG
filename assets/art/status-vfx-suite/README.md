# Status VFX Suite

This directory contains the editable deterministic pixel source for the six live campaign-combat statuses: Dread, Chill, Shock, Scorch, Bound, and Overheated. The 3 x 6 atlas uses exact 32 x 32 cells for application, persistent, and expiry signals. The game has no campaign-combat cleanse event, so no cleanse frame is claimed or authored.

The artwork uses original pressure-kite, cold-facet, charge-node, ember-tier, clamp-bar, and vent-step shapes. It contains no gore, devotional objects, real emblems, or borrowed raster material.

## Build

```powershell
python build_status_vfx_suite.py
python build_status_vfx_suite.py --check
```

The atlas is drawn at native resolution using integer coordinates and binary alpha. Every cell keeps at least three transparent pixels on every side. The review sheet enlarges frames exactly 4x with nearest-neighbor resampling and is never loaded at runtime.

## Signal contract

- `apply`: existing `status-applied` / `status-refreshed` log entries and already-gated `status-glyph` animation records.
- `active`: exact membership in a snapshot actor's `statuses` array.
- `expire`: existing `status-expired` log entries.
- Cleanse: unsupported because campaign combat emits no cleanse event.

## Export receipt

- `status-vfx-atlas.png`: 96 x 192 RGBA, SHA-256 `b05c0376e5ed60ef53579cbbc9e56da090bb2c70c0cbb922fec54d4e1d4d0232`.
- `status-vfx-contact-sheet.png`: 424 x 964 RGB, SHA-256 `9c10395db8aebcb771e7968ea088e5717a8e8b607d2cfc5f9272208eb5fbf0e9`.

`game/status-vfx-atlas.mjs` owns the pure resolver seam, and `game/battle.js` draws the resolved apply, persistent-active, and expire frames. Unknown markers, Final Ward Open, atlas load failure, and wrong-size images retain the existing generic/special fallback.
