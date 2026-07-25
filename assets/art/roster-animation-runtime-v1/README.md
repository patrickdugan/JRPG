# Roster Animation Runtime v1

This package closes two concrete animation gaps across the current combat roster:

- all **seven party characters** receive eight complete combat clips and forty
  native frames each;
- all **thirty-two enemy and boss states** receive a readable field encounter
  trigger sequence with dormant, sense, alert, pursuit, engage, and cooldown
  clips.

## Party runtime atlas

`party-combat-animation-atlas-v1.png` is `1920x448`: forty `48x64`
binary-alpha frames across seven rows.

Clip order:

1. idle — 4 frames;
2. move — 6 frames;
3. guard — 4 frames;
4. hurt — 4 frames;
5. basic strike — 6 frames, damage on frame 3;
6. signature A — 6 frames, skill event on frame 3;
7. signature B — 6 frames, skill event on frame 3;
8. defeat — 4 frames.

The stable `lise` row visibly remains Nikola Dražanić. Every character keeps
the original `48x64` geometry, pivot `(24,58)`, foot point `(24,58)`, and
right-facing convention. Simulation owns root motion.

This lane is a **pixel-authored production extension**. Its frozen source
snapshot comes from the original code-native party combat suite; the new phase
selection, body mechanics, attack arcs, character-specific VFX, timing, and
event frames are editable native-resolution code primitives.

## Enemy encounter-trigger atlas

`enemy-encounter-trigger-atlas-v1.png` is `576x1536`: twelve `48x48`
binary-alpha frames across thirty-two rows.

Every trigger visibly moves through:

1. dormant and idle breathing;
2. stir, suspicion, and turn;
3. alert wind-up;
4. alert active — emits `encounter-alert` exactly once;
5. pursuit contact and passing;
6. engage wind-up;
7. engage contact — emits `encounter-contact` exactly once;
8. recovery.

Profiles distinguish rushers, hovering enemies, humanoids, beasts, and ambush
plants. Simulation retains movement, facing, overlap, and encounter authority.
The animation never mutates campaign state.

This lane remains a **deterministically pixelified derivative** because its
frozen field-sprite source descends from AI-generated concept boards. The new
trigger indicators are code-native, but they do not change the underlying
enemy provenance.

## Build and verify

```powershell
python build_roster_animation_runtime.py
python verify_roster_animation_runtime.py
python build_roster_animation_runtime.py --check
```

GIFs in `previews/` and `enemy-encounter-trigger-motion-preview-v1.gif` are
review artifacts only. Runtime timing, pivots, frame events, clip order, source
hashes, and per-frame hashes live in `manifest.json`.

The standalone browser review surface is `game/roster-animation-review.html`.
It can select every party or enemy row, play individual clips, and run the full
dormant-to-contact encounter sequence without writing campaign or browser
storage.
