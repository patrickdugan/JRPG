# SVG Motion Cells: 62-Identity Source Art Pass (2026-11-20)

The Gothic SVG motion source suite under assets/art/svg-cel-suite-v1 implements the requested editable animation cells across all 62 known actor identities, including the seven-party roster, 28 regular enemies, the four Kurozane forms, seven remaining named bosses, and all 16 authored civilian NPC roles. Boss Mateus and Tithe Hound reuse their corresponding party/enemy identity.

The visual style uses new clean-contour, muted-color Occidental Gothic SVG artwork and the original July concepts as **identity references**. The system creates 13 action key-pose cells, 8 directional field poses for the party, and 2 noncombat gesture poses for civilians. Generated sheets preserve the 144 × 160 coordinate space, explicit anchor coordinates, semantic body-part groups, SHA-256 checksums and source provenance. The browser review studio loads actual SVG strips and cycles their poses.

These are original vector redraws at a first-production-study level, not tracings of the original PNG concept files and not a claim of recovered vector masters. The previously introduced pixel artwork and existing combat kernel remain intact. The illustrated SVG key poses do not yet have the 20–30 distinct in-between frames, complex cutout rigging, human cultural review, performance profiling or full game-playthrough acceptance needed to become default runtime sprites.

The source generator, XML contracts, raster-visible checks, 69 regenerated sheets, and Chromium browser studio have a hosted CI acceptance workflow, plus a full-roster contact sheet artifact for art review.

## Acceptance checklist

- [ ] 62 identities in 7 precise catalog groups, with the canonical source-reference path for each.
- [ ] 69 reproducible SVG strips and 686 frame cells.
- [ ] All SVGs are vector-native, with no raster image embeds or external image dependencies.
- [ ] Browser-rendered frame viewer and export metadata validated.
- [ ] Human visual review at native game scale, especially NPC occupation reads and named boss identity.
- [ ] Optional reversible runtime adapter validated against timing, hitbox, objective and save contracts.
