# Takamine Bell-Chamber Battle Environment Brief

Status: **production contract; final board art and external cultural review pending.** This brief converts the accepted Takamine rain mood into an exact tactical asset without treating generated concept pixels as shippable art.

## Runtime authority

| Field | Locked value |
| --- | --- |
| Level | `tkm-bell-chamber` / FP-05 Bell Chamber |
| Encounter | `fp1-mateus` / Father Mateus Avelar |
| Simulation | 12 x 7 integer spaces |
| Nominal source board | 384 x 224 from level metadata `spacePx: 32`; not yet consumed by the renderer |
| Current canvas | 960 x 540 |
| Current backing-store grid | 77-pixel cells; 924 x 539 board at `(18,0)`; 18-pixel side margins and one unused bottom row |
| Presentation role | Static environment beneath terrain, telegraphs, units, and effects; never collision authority |

The board art must be flat and cell-addressable. Perspective walls, roofs, stairs, galleries, and scenery belong outside the playable plane or only in cells already blocked by level data. The runtime's grid, blocked set, objective tokens, and actor positions remain authoritative even when the image suggests depth.

### Open renderer/art-lock gate

The responsive prototype derives 77 backing-store pixels per cell and therefore cannot claim integer scaling of a nominal 32-pixel source board. Do not stretch a 384 x 224 final pixel-art board to 924 x 539 and call it integer-scaled. Before a stage is promoted from manifested source to final runtime art, choose and test the coherent migration: composite the 384 x 224 source at exactly 2x as a 768 x 448 board inside the existing 960 x 540 shell, then update draw and pointer geometry to the same 64-pixel cells. The current milestone intentionally leaves runtime geometry unchanged until that migration has pointer-boundary, telegraph, sprite-legibility, desktop, and 390-pixel responsive evidence.

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
4. Review the board in engine with every blocked cell, both Blood Wards, Crimson Litany, movement range, actors, result log, and reduced-motion mode visible.
5. Reject any asset whose paving lines disagree with the grid, whose props imply false collision, whose texture obscures a telegraph, or whose symbols resemble authentic heraldic or sacred material.
6. Complete the external Japanese religious-practice and cultural review documented in [the historical and cultural audit](20-historical-cultural-audit.md) before art lock.

The rain-court image generated on 2026-07-20 is a concept-only keyframe. Its original perspective grid, radial floral banners, and temple-bell-like centerpiece are explicitly rejected for runtime use; a corrected concept may be retained only as a mood reference.
