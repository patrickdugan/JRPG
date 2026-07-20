# Takamine Bell-Chamber Battle Environment Brief

Status: **editable production board integrated; external cultural review and final art lock pending.** The authored source, deterministic builder, manifest, and exports live in `assets/art/takamine-bell-chamber/`; the browser ships a byte-identical board from `game/assets/art/takamine-bell-chamber/`. Generated concept pixels remain mood reference only.

## Runtime authority

| Field | Locked value |
| --- | --- |
| Level | `tkm-bell-chamber` / FP-05 Bell Chamber |
| Encounter | `fp1-mateus` / Father Mateus Avelar |
| Simulation | 12 x 7 integer spaces |
| Source board | 384 x 224 from level metadata `spacePx: 32`; consumed through the frozen `tkm-bell-chamber` stage-art registry |
| Current canvas | 960 x 540 |
| Current backing-store grid | exact 64-pixel cells; 768 x 448 board at `(96,46)`; integer 2x source scale |
| Presentation role | Static environment beneath terrain, telegraphs, units, and effects; never collision authority |

The board art must be flat and cell-addressable. Perspective walls, roofs, stairs, galleries, and scenery belong outside the playable plane or only in cells already blocked by level data. The runtime's grid, blocked set, objective tokens, and actor positions remain authoritative even when the image suggests depth.

### Completed renderer migration

The renderer now composites the 384 x 224 source at exactly 2x as a 768 x 448 board inside the existing 960 x 540 shell. Drawing and pointer conversion use the same 64-pixel-cell transform; margin clicks fail closed. Stage loading validates level and natural-image dimensions, exposes loading/ready/error/fallback state on the canvas, disables smoothing, and retains opaque procedural terrain if the bitmap is absent or corrupt. Seventeen focused acceptance tests cover geometry, all 84 tile centers, desktop/narrow CSS scaling, manifest/live-data agreement, hashes, runtime byte identity, and paint order. Isolated Chrome evidence additionally records the ready board, a 12-color procedural corruption fallback, stable reduced-motion output, and no console, page, or HTTP errors.

## Exact occupancy contract

Blocked edge cells are `0,0`, `1,0`, `2,0`, `9,0`, `10,0`, `11,0`, `0,6`, `1,6`, `2,6`, `9,6`, `10,6`, and `11,6`. The buried registry-machine footprint occupies `5,2`, `6,2`, `5,3`, and `6,3`.

Special cells:

- high gallery: `0,2`, `0,3`, `0,4`;
- Blood Ward / bell nodes: `5,1`, `6,5`;
- dry lantern footing: `3,1`, `3,5`;
- party deployment: `2,3`, `2,4`, `3,3`;
- Mateus deployment: `9,3`;
- post-surrender exit: `11,3`.

All open cells need a quiet value range that supports pale grid strokes, aqua movement/exit cues, violet line telegraphs, crimson endpoint telegraphs, gold active-unit outlines, and readable party/enemy silhouettes. Saturated red, teal, violet, and gold reflections stay out of the playable plane.

## Fictional material language

Keep indigo rain, wet cedar, plaster infill, stone drainage, black lacquer, iron administrative hardware, restrained lantern light, and oppressive mountain scale. The room is Kurozane's experimental local registry apparatus, not a real temple interior.

- The central object is an invented buried **registry resonator**: a faceted cast-metal command machine with plain ribs, ledger tabs, black-lacquer conduits, and court-added mechanisms.
- Do not reproduce a Japanese temple bell's stud field, lotus bands, inscriptions, medallions, striker, or devotional pavilion.
- Do not place crosses, shrine talismans, Buddhist ritual objects, ceremonial masks, or sacred figures in the arena.
- Kurozane's mark is a visibly stolen and vandalized fiction: asymmetrical broken ledger-tab geometry, never a clean radial flower, authentic chrysanthemum, or Tokugawa hollyhock.
- Archive drawers, blank paper bundles, inspection rails, record chests, and drains may communicate bureaucratic violence without turning worship into scenery.

## Art construction and acceptance

1. Use generated imagery only as a mood/value reference. Rebuild the shipping floor from editable indexed or layered sources.
2. Supply a monochrome 12 x 7 occupancy thumbnail before color.
3. Supply a palette/module sheet with two to four value steps per material and no generated lettering.
4. Automated in-engine geometry, actors, movement, objective/intent layering, corrupt-image fallback, and reduced-motion checks pass. A human must still review both Blood Wards, Crimson Litany, result-log contrast, and narrow-screen readability before art lock.
5. Reject any asset whose paving lines disagree with the grid, whose props imply false collision, whose texture obscures a telegraph, or whose symbols resemble authentic heraldic or sacred material.
6. Complete the external Japanese religious-practice and cultural review documented in [the historical and cultural audit](20-historical-cultural-audit.md) before art lock.

The rain-court image generated on 2026-07-20 is a concept-only keyframe. Its original perspective grid, radial floral banners, and temple-bell-like centerpiece are explicitly rejected for runtime use; a corrected concept may be retained only as a mood reference.
