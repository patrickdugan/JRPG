# Enemy field suite v3

This package extends the PlayStation-density party field contract to all 28
enemy families and four Kurozane states. It rebuilds from the retained
high-resolution directional boards rather than enlarging the earlier 48 × 48
runtime exports.

The source boards are AI-generated pixel-styled concepts. The builder detects
their original five-column grids, selects the four field keys, downsamples with
BOX resampling into fixed 80 × 80 native frames, applies one shared 48-color
median-cut palette per enemy without dithering, and derives profile-specific
integer animation. The outputs are therefore **deterministically pixelified
derivatives**, not pixel-authored art.

## Runtime contract

- 32 rows in the inventory order recorded by the source coverage package.
- Four directions with one idle and eight walk phases per direction.
- `south-alert` and `south-hurt` field events.
- Separate twelve-frame encounter-trigger atlas preserving dormant, sense,
  alert, pursue, engage, and cooldown clips.
- Binary alpha and a two-pixel minimum transparent gutter.
- Fixed pivot and foot point at `(40, 77)`.
- Runtime-owned root motion; sprite sampling never changes simulation state.
- Encounter contact receipts remain explicitly non-canonical.

Human silhouettes use party-scale content density. Rush, hover, beast, heavy,
and ambush profiles receive distinct content boxes and integer motion without
changing the common atlas geometry.

## Files

- `enemy-field-suite-v3.source.json`: geometry, timing, conversion, and profile contract.
- `build_enemy_field_suite_v3.py`: deterministic builder and byte-identical check.
- `enemy-field-atlas-v3.png`: transparent movement/event runtime atlas.
- `enemy-encounter-trigger-atlas-v3.png`: transparent trigger runtime atlas.
- `enemy-field-contact-sheet-v3.png`: nearest-neighbor static review.
- `enemy-field-motion-preview-v3.gif`: eight-phase four-direction movement review.
- `enemy-encounter-trigger-preview-v3.gif`: full trigger-sequence review.
- `manifest.json`: source/output hashes, frame geometry, profiles, and provenance.

Run:

```powershell
python assets/art/enemy-field-suite-v3/build_enemy_field_suite_v3.py
python assets/art/enemy-field-suite-v3/build_enemy_field_suite_v3.py --check
```
