# Storyworld sequence production map

This is the production map for the ten implemented Storyworld clusters. The authored source is [`storyworlds/bells-black-chrysanthemum.source.mjs`](../storyworlds/bells-black-chrysanthemum.source.mjs); exact campaign placement and related encounter IDs are generated in [`storyworlds/bells-black-chrysanthemum.bindings.json`](../storyworlds/bells-black-chrysanthemum.bindings.json). Generated files are not hand-edited.

## Scene arithmetic

- Canonical campaign: 60 scenes.
- Storyworld: 10 decision scenes plus 20 mutually exclusive consequence scenes = 30 authored scenes.
- Total authored catalog: 60 + 30 = **90 scenes**.
- Complete narrative run: 60 canonical + 10 decisions + one of two consequences per decision = **80 played scenes**. The other 10 consequence scenes belong to alternate paths.

Reactions occur inside those Storyworld scene nodes and do not add to the scene count.

The checked-in diagnostic in [`game/storyworld-pacing.mjs`](../game/storyworld-pacing.mjs) takes the longest visible path through every cluster: 1,653 words and at most 19 explicit decisions. At 200 words per minute plus 20 seconds of decision dwell, the Storyworld layer adds 14.598 reference minutes. Combined with the current 308.927-minute canonical reference, the 80-scene route is 323.525 minutes (about 5.39 hours). This is a content projection, not observed playtime proof; the run receipt separately requires at least 300 active minutes.

## Carry-forward contract

Every cluster is required for narrative credits. A `before-boss-decision` resolves before its anchor beat can proceed; an `after-boss-consequence` or `after-level-consequence` resolves after its anchor beat. Each completed record preserves the selected decision, deterministic decision reaction, selected consequence, and consequence reaction. Their bounded effects update the projection used to select later reactions.

For a related battle, the presentation card carries the selected decision text, the consequence-scene title, and the resolved consequence reaction (falling back to consequence text). Pre-boss cards read **Decision carried into encounter**. After-boss records read **Recorded aftermath** when that encounter is subsequently presented. Clusters without a related encounter ID still carry their state and narrative context into later Storyworld selection, but do not create a battle card.

## Sequence ledger

1. **The Clerk's Second Copy** (`sw1-clerks-second-copy`)
   - Anchor: `c1-05-storehouse-clerk`; placement: **after level** (`after-beat`, `after-level-consequence`).
   - Related encounter IDs: none.
   - Consequences: **Custody With a Clock** / **Methods Without Names**.
   - Carry-forward: durable custody, consent, and evidence context for later Storyworld reactions; no battle card.

2. **Witness, Not Family** (`sw2-witness-not-family`)
   - Anchor: `c2-06-name-from-europe`; placement: **after boss** (`after-beat`, `after-boss-consequence`).
   - Related encounter ID: `fp1-mateus`.
   - Consequences: **Terms of Distant Testimony** / **The Refusal Stands**.
   - Carry-forward: retrospective **Recorded aftermath** context for `fp1-mateus`, including the selected decision and resolved consequence.

3. **Sayo's Warehouse Conditions** (`sw3-sayos-warehouse-conditions`)
   - Anchor: `c3-04-lantern-boat-escort`; placement: **before boss** (`before-beat`, `before-boss-decision`).
   - Related encounter ID: `c3-dock-patrol`.
   - Consequences: **Two Routes, Two Custodians** / **Capacity Chooses the Order**.
   - Carry-forward: **Decision carried into encounter** context for `c3-dock-patrol`, including Sayo's selected route conditions and their resolved consequence.

4. **A Margin in the Varga Journal** (`sw4-margin-varga-journal`)
   - Anchor: `c4-03-varga-journal`; placement: **after level** (`after-beat`, `after-level-consequence`).
   - Related encounter IDs: none.
   - Consequences: **An Inheritance Entered as Evidence** / **The Deadline Beside the Gap**.
   - Carry-forward: durable inheritance, custody, and archive-limit context for later Storyworld reactions; no battle card.

5. **The Cipher Handoff** (`sw5-cipher-handoff`)
   - Anchor: `c5-05-sigil-burned`; placement: **before boss** (`before-beat`, `before-boss-decision`).
   - Related encounter ID: `c5-furnace-abbot`.
   - Consequences: **A Chain With Human Verbs** / **Separate Accounts, Shared Test**.
   - Carry-forward: **Decision carried into encounter** context for `c5-furnace-abbot`, including the chosen evidence process and resolved consequence.

6. **Tribunal Afterword** (`sw6-tribunal-afterword`)
   - Anchor: `c6-03-tribunal`; placement: **after boss** (`after-beat`, `after-boss-consequence`).
   - Related encounter ID: `c6-ujiro`.
   - Consequences: **Admission Under Corroboration** / **An Audience Is Not Owed**.
   - Carry-forward: retrospective **Recorded aftermath** context for `c6-ujiro`, including the selected tribunal treatment and resolved consequence.

7. **The Soldier Who Will Not Follow** (`sw7-soldier-will-not-follow`)
   - Anchor: `c7-03-aqueduct-names`; placement: **before boss** (`before-beat`, `before-boss-decision`).
   - Related encounter ID: `c7-name-slip-release`.
   - Consequences: **Help Without a Banner** / **Silence Is Not Betrayal**.
   - Carry-forward: **Decision carried into encounter** context for `c7-name-slip-release`, including the boundary on aid and its resolved consequence.

8. **Boats With Conditions** (`sw8-boats-with-conditions`)
   - Anchor: `c8-04-lantern-breach`; placement: **before boss** (`before-beat`, `before-boss-decision`).
   - Related encounter ID: `c8-outer-court`.
   - Consequences: **A Fleet With Many Owners** / **Evacuation Is Enough**.
   - Carry-forward: **Decision carried into encounter** context for `c8-outer-court`, including the local crews' selected terms and resolved consequence.

9. **Mateus at the Living Archive** (`sw9-mateus-living-archive`)
   - Anchor: `c9-04-yearless-bell`; placement: **before boss** (`before-beat`, `before-boss-decision`).
   - Related encounter ID: `c9-yearless-bell`.
   - Consequences: **Knowledge Under Revocable Terms** / **The Translation Stops**.
   - Carry-forward: **Decision carried into encounter** context for `c9-yearless-bell`, including the selected limit on Mateus and its resolved consequence.

10. **The Corrections Desk** (`sw10-corrections-desk`)
    - Anchor: `e00-open-archive`; placement: **after level** (`after-beat`, `after-level-consequence`).
    - Related encounter IDs: none.
    - Consequences: **Corrections Remain Visible** / **The Limit Is Posted**.
    - Carry-forward: final archive-policy context and route-ending Storyworld state; no battle card.

## Cultural and narrative guardrails

- Sacred and devotional objects are not loot, combat consumables, puzzle tokens, or neutral gothic decoration. The clusters use fictional records, custody procedures, routes, and administrative evidence as their interactive material.
- Named Japanese organizers, witnesses, crews, and custodians retain authority over routes, access, custody, refusal, revision, and stop conditions. A refusal is a valid consequence, not a player obstacle to override.
- Mateus receives accountability, supervision, corroboration, and revocable limits—not absolution, command authority, private access, restored office, or narrative ownership. His useful knowledge never makes European authority the resistance's default leader.
- Father Mateus Avelar and the full cast remain original fictional characters; no celebrity or actor likeness is permitted.
- The fiction must not turn a real faith, ethnicity, historical victim, or identifiable sacred tradition into a monster class, reward system, or boss prop. External historical and cultural review remains a production gate.
