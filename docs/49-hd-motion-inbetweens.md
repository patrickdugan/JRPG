# HD painted motion v2: 24-cell animation integration

The earlier HD art engine PR supplies six detailed painted key poses per actor. This branch adds a presentation-only sampler for the **24-cell motion atlas per clip**. The source artwork is rendered as transparent WebP tiles on a 192×192 logical cell with the same ground anchor and drawn game height as the 384×384 key artwork.

## Current motion delivery

The accompanying conversation artifact `JRPG_HD_Motion_Expanded_v2.zip` contains **12 actors, 116 motion atlases, 2,784 individually addressable cells**. Eleven combat identities have ten clips each: idle, locomotion, windup, active, recovery, guard, hurt, defeat, signature and stagger. Kurozane has six distinct 24-cell form studies; these are not generic attack clips and require an explicit boss phase-form assignment.

Each animation cell is a deterministic, foot-anchored deformation of **one original painted pose**. The build maintains detailed painterly source pixels and small secondary motion; these are derived frames, not 2,784 independently illustrated in-betweens. Cross-pose optical-flow interpolation was rejected after visual inspection because it created ghosted faces and doubled limbs.

## Game-engine integration

`game/hd-painted-motion.mjs` samples motion by the action kernel's existing state. Active attack windup/impact/recovery clips take the kernel's immutable phase progress, while idle/locomotion/guard are sampled by simulation time. Hit and stagger supersede attacks. Reduced-motion mode freezes loops and selects representative attack frames.

The old `game/hd-painted-animation.mjs` six-pose loader remains the fallback if motion assets have yet to load, have the wrong decoded dimensions, have mismatched source metadata, or are absent. The original pixel sprites remain the final fallback. Runtime code touches **presentation only**; attack timing, telegraphs, hitboxes, collision, saving and battle settlement stay with the existing engine.

`?art=hd` enables the painted art and loads v2 clips when present. Append `&motion=0` to retain the six-key painted view. Without `art=hd`, the original pixel art continues to render normally.

## Installation

1. Check out `feature/hd-painted-motion-inbetweens`, based on the existing HD engine integration branch.
2. Extract `JRPG_HD_Motion_Expanded_v2.zip` and run `python tools/install_hd_motion.py /path/to/JRPG` from the package directory. This copies the verified six-pose sources, four enemy cards, v2 manifest and all 116 WebP atlases, atomically and idempotently, into `game/assets/art/hd-painted-v1/`.
3. Serve `game` via HTTP and open an action encounter with `?art=hd`.
4. Use the package's `review.html` and animated GIFs to inspect the work at native resolution.

The source paintings and motion WebP binaries are provided in the downloadable conversation archive. **This Git branch contains the engine changes and tests; it does not yet contain the 76-MB binary art pack.**

## Verification

- `node --test game/tests/hd-painted-motion.test.mjs game/tests/hd-painted-animation.test.mjs`
- `npm run check` in `game`
- `python tools/test_motion_assets.py` inside the extracted motion package checks each of the 116 sheet SHA-256 hashes and the 2,784 post-decoded RGBA frame hashes.
- `python tools/install_hd_motion.py /path/to/JRPG --check` verifies the package and reports intended copies.

**Visual acceptance remains open.** These clips are faithful motion studies with subtle deformation; full character-specific articulated limb action, independently cleaned midposes, and Kurozane phase mapping should follow before normal gameplay art replacement.
