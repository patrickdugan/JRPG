# Source-Derived Enemy Motion: Gap Closure

The Roster Keystone at ../roster-keystone/README.md identifies **16 regular enemies still awaiting premium six-pose painted masters**. This package generates playable motion from their **committed, high-resolution source animation boards** in assets/art/enemy-animation-suite-v2/sources and v3/sources. Each source board has four rows of six poses: locomotion, basic attack, signature, and hurt/defeat.

**Provenance:** source-derived animation candidates, not newly hand-painted imagery and not articulated rigs. All 24 frames per clip sample the original source poses with small deterministic whole-figure movement. Premium painted masters remain a separate, first-priority engine lane.

## Deliverables

- 16 six-key transparent PNG sheets, each 2304×384 with six 384×384 poses.
- 160 WebP motion clips, each 2304×384 with 24 separate 192×192 frames.
- 3,840 derived animation frames and a contact sheet.
- Two native engine JSON manifests (bbc-hd-painted/1 and bbc-hd-motion/2).
- SHA-256 file receipts plus SHA-256 hashes of each **decoded RGBA frame**.
- Four Git commits in batches of four enemies, with each batch verified below 90 MiB.

| Batch | Actor IDs |
| --- | --- |
| A | ash-wisp, registry-hound, lantern-leech, forge-thrall |
| B | veil-courier, provincial-banner-guard, storm-nue, dream-baku |
| C | twin-tail-nekomata, sickle-weasel, drum-tanuki, marsh-kappa-beast |
| D | ushi-oni-behemoth, black-chrysanthemum-nest-woman, spider-lily-ambusher, lantern-vine-maw |

## Build and validate

    python -m pip install pillow==11.3.0
    python assets/art/hd-missing-enemies-v1/build.py
    python assets/art/hd-missing-enemies-v1/verify.py

The output is stored at game/assets/art/hd-painted-v1/overlay-missing-v1/. Preview using the developer-only game/hd-source-derived-review.html.

## Gameplay behavior

When enabled through ?art=hd, the Action Campaign renderer tries the previously approved painted pack first, then this new source-derived pack. If neither is available, it retains the tested pixel animation. The query option &motion=0 selects six-pose images in both HD lanes. Neither painted source changes gameplay simulation, hitboxes, attack timings, collision, quest objectives, victory settlement, or campaign saves.

Visual approval is still required for alpha edges, costume consistency, root anchors and motion readability. Frame-hash uniqueness verifies file delivery, not artistic quality. Replace these provisional sources with a newly reviewed painted master when available.
