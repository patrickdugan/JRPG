# Gothic SVG motion suite v1

Editable vector animation cells for the roster of **Bells of the Black Chrysanthemum**. This is a newly code-authored SVG interpretation of the surviving July character concepts and the project's authored roster/boss contracts. Every shape is a vector path or primitive with named body-part groups. No PNG is embedded in an SVG. The original image files remain unchanged and editable Illustrator or historical SVG character sources are not claimed to have been recovered.

## Coverage

- 46 combat identities (7 party, 28 regular enemies, 4 Kurozane forms, 7 other named bosses), each with 13 action phase cells.
- 7 party field sheets, 8 poses per character (south, north, east, west, idle/walk).
- 16 civilian field-role sheets, two poses each (south idle and empty-hand gesture), sourced from the canonical NPC role taxonomy.

**62 identities, 69 SVG sheets, 686 individually authored-frame outputs.** Full 686 standalone SVG cells can be generated on demand, without tracking duplicate exports in Git.

## Native contract

Each animation cell uses a transparent 144 × 160 SVG view, with foot anchor (72, 149). Screen-right is the native side-view orientation. The game simulation owns root motion and timing. The action pose sequence is:

idle-a, idle-b, run-contact, run-pass, jump, windup, active, recovery, guard, signature, stagger, hurt, defeat.

The authored curves represent key poses for a consistent illustrative motion study; they are not yet motion parity with the current 20–30 unique frames per clip. The existing pixel-art runtime remains canonical.

Source layout:

- cast.json: identities, per-actor rig/body silhouette, equipment, palette and existing concept references.
- geometry.py: SVG body part geometry and pose transforms.
- build.py: deterministic build, hashes, per-sheet metadata and standalone-cell export.
- sheets/: one transparent pose strip per identity and facing lane.
- manifest.json: source, output SHA-256, cell counts, frame size, pose order and anchors.
- make_contact.py: an actual vector-to-PNG contact sheet of all 62 actors.
- tests/test_svg_cels.py: source coverage, XML semantics, independence and raster-visible frame tests.

Build and inspect from the repository root:

    python assets/art/svg-cel-suite-v1/build.py
    python assets/art/svg-cel-suite-v1/build.py --check
    python assets/art/svg-cel-suite-v1/build.py --emit-cells

The last command writes standalone SVG frames under cells/ID/variant/pose.svg. Open game/svg-motion-studio.html through the local HTTP server for a selector, pose timeline and animation preview.

To run the full vector QA locally:

    python -m pip install cairosvg pillow playwright
    python -m unittest discover -s assets/art/svg-cel-suite-v1/tests -v
    python assets/art/svg-cel-suite-v1/make_contact.py
    python -m playwright install chromium
    python game/tools/svg-motion-browser-smoke.py

## Production limits and next work

The known 16 civilian roles reuse generic images according to the game's role taxonomy, and the existing human/boss/enemy contracts remain their collision authorities. Review all characters at game scale, revise shapes and expressions for identity, increase true in-between coverage for motion quality, verify early-Edo details and cultural sensitivity, then introduce a reversible development-only runtime switch. The earlier August C-drive incident does not affect the original PNG source art preserved by July Git commits.
