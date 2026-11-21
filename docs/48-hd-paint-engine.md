# HD painted animation: Action Campaign engine integration

The action battle renderer now supports an **opt-in, reversible** painted animation mode:

`game/action-campaign-battle.html?encounter=c1-cinder-hounds&lead=ren&support=miyo&art=hd`

Run the game's normal local HTTP server. With `art=hd`, the engine tries painted character atlases; without it, the original tested pixel-animation path stays active.

The renderer module `game/hd-painted-animation.mjs` loads a local manifest on demand, decodes only the requested character sprites, verifies the expected 2304×384 sheet dimensions, samples one of six key poses from the existing fixed-step combat state, and draws the chosen cel at the actor's original foot position. The routine changes neither damage timing nor collision, objectives, saves or settlements. A missing image or invalid manifest immediately falls through to the previous sprite renderer.

## Painted artwork package

[JRPG HD Engine Integration, version 1] is distributed as a separate downloadable ZIP from the user conversation. It includes 12 transparent raster sprite atlases: seven party members, Silk Jorogumo, Bell Moth, Cinder Hound, Razor Bamboo Stalker, and a Kurozane transformation study. Each sheet has six 384×384 key poses, totaling 72. Kurozane's transformations are reserved for form-specific animation work; the runtime refuses to interpret them as ordinary attack phases.

The pack also includes four 768×1152 enemy encounter cards. Each card retains its original high-resolution source in the ZIP, plus a hashed production copy. When HD mode loads a supported enemy and its card URL resolves, the battle HOSTILES panel exposes a link to the illustrated encounter card.

These are detailed painted PNGs, with separate animation-source and card-source copies; no claim of editable SVG source or motion parity with the original 20–30-frame game animations is made.

## Installing from the ZIP

Unzip the package beside a local checkout of `feature/hd-painted-engine-integration`, then run:

```sh
python tools/install_hd_art.py /path/to/JRPG
```

The matching checkout-side command is `python game/tools/install-hd-painted-art.py /path/to/unpacked/JRPG_HD_Engine_Integration_v1`. Both installers check SHA-256 hashes of all 12 sprite sheets and four cards, then install them only under `game/assets/art/hd-painted-v1/`. Repeated installs keep the established pixel sprites intact.

A downloadable offline gallery (`review.html`) previews all six cels for each identity. The `cards.html` gallery shows the four illustrated encounter cards.

## Testing and release boundary

The canvas exposes `data-hd-art-mode`, `data-hd-art-state`, and `data-hd-art-draw-count`. Node tests cover the exact actor-phase map, security of atlas filenames and geometry, and failure-safe rendering. GitHub Actions also exercises an actual Chromium browser with **synthetic test fixtures**, covering opt-in HD drawing, classic rendering, the card link and missing-art fallback; test fixtures are never used as shipping art.

The existing complete Node suite includes art-builders that require cross-platform binary-identical PNGs. Their baseline has produced 13 mismatches on hosted Linux, even with the correct pinned Pillow 11.3.0. The CI run retains that test log separately and does not treat it as passing. HD-specific integration tests and browser tests are separate release gates.

Final art acceptance requires in-game cropping/anchor QA, review of fading and overlapping effects, additional in-betweens and a full-route playable test before any default-art switch.
