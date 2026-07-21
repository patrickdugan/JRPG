# Storyworld sequence production map

This is the production map for the eleven implemented Storyworld clusters. The authored source is [`storyworlds/bells-black-chrysanthemum.source.mjs`](../storyworlds/bells-black-chrysanthemum.source.mjs); exact campaign placement and related encounter IDs are generated in [`storyworlds/bells-black-chrysanthemum.bindings.json`](../storyworlds/bells-black-chrysanthemum.bindings.json). Generated files are not hand-edited.

## Scene arithmetic

- Canonical campaign: 60 scenes.
- Storyworld: 11 decision scenes plus 23 mutually exclusive consequence scenes = 34 authored scenes. Lady Enma's dedicated spool has three outcomes; the other ten decisions have two each.
- Total authored catalog: 60 + 34 = **94 scenes**.
- Complete narrative run: 60 canonical + 11 decisions + one consequence per decision = **82 played scenes**. The other 12 consequence scenes belong to alternate paths.

Reactions occur inside those Storyworld scene nodes and do not add to the scene count.

The checked-in diagnostic in [`game/storyworld-pacing.mjs`](../game/storyworld-pacing.mjs) takes the longest visible path through every cluster: 2,249 words and at most 21 explicit decisions. At 200 words per minute plus 20 seconds of decision dwell, the Storyworld layer adds 18.245 reference minutes. Combined with the current 312.481-minute canonical reference, the 82-scene route is 330.726 minutes (about 5.51 hours). This is a content projection, not observed playtime proof; the run receipt separately requires at least 300 active minutes.

## Carry-forward contract

Every cluster is required for narrative credits. A `before-boss-decision` resolves before its anchor beat can proceed; an `after-boss-consequence` or `after-level-consequence` resolves after its anchor beat. Each completed record preserves the selected decision, deterministic decision reaction, selected consequence, and consequence reaction. Their bounded effects update the projection used to select later reactions.

The `sw10-corrections-desk` string remains an opaque internal compatibility ID, not a claim that the new scene has the old meaning. Exact legacy identities migrate only through the first eight Storyworld records. A prior save that crossed the new Lady Enma hearing or reached the old Chapter 9 translation/corrections sequence fails closed: the runtime will not invent an Enma fate or reinterpret **Corrections Remain Visible** as surrender and **The Limit Is Posted** as execution. Historical outcomes have explicit storage and signed-recovery rejection fixtures.

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

4. **A Margin in the Severed Dragon Testament** (`sw4-margin-varga-journal`, save-stable legacy ID)
   - Anchor: `c4-03-varga-journal`; placement: **after level** (`after-beat`, `after-level-consequence`).
   - Related encounter IDs: none.
   - Consequences: **A Covenant Entered as Evidence** / **The Deadline Beside the Gap**.
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

9. **Three Terms for the Cinder Fan** (`sw-enma-three-terms`; dedicated `spool_enma`)
   - Anchor: `c8-05-gate-opened`; placement: **after boss** (`after-beat`, `after-boss-consequence`).
   - Related encounter ID: `c8-lady-enma`.
   - Consequences: **Custody Without a Trophy** / **The Cinder Fan Ends** / **A Defection Under Witness**.
   - Carry-forward: exact categorical Enma fate (`captured`, `killed`, or `negotiated`), bounded custody/testimony effects, and retrospective **Recorded aftermath** context for the third boss fight.

10. **Mateus at the Living Archive** (`sw9-mateus-living-archive`)
   - Anchor: `c9-04-yearless-bell`; placement: **before boss** (`before-beat`, `before-boss-decision`).
   - Related encounter ID: `c9-yearless-bell`.
   - Consequences: **Knowledge Under Revocable Terms** / **The Translation Stops**.
   - Carry-forward: **Decision carried into encounter** context for `c9-yearless-bell`, including the selected limit on Mateus and its resolved consequence.

11. **The Last Command** (`sw10-corrections-desk`, opaque legacy internal ID)
    - Anchor: `c9-05-dawn-at-observatory`; placement: **after boss** (`after-beat`, `after-boss-consequence`).
    - Related encounter ID: `c9-kurozane`.
    - Consequences: **The Seals Returned** / **The Empty Throne Mobilizes**.
    - Carry-forward: final witnessed-transfer or execution/civil-war state, retrospective **Recorded aftermath** context for `c9-kurozane`, and the route-ending political record.

## Cultural and narrative guardrails

- Sacred and devotional objects are not loot, combat consumables, puzzle tokens, or neutral gothic decoration. The clusters use fictional records, custody procedures, routes, and administrative evidence as their interactive material.
- Named Japanese organizers, witnesses, crews, and custodians retain authority over routes, access, custody, refusal, revision, and stop conditions. A refusal is a valid consequence, not a player obstacle to override.
- Lady Enma is an original culpable vampire and former court entertainer, not a claim that women, Japanese tradition, or a profession are monstrous. Her negotiated outcome is a revocable defection under witness, not romance, pardon, or instant redemption; her custody is distributed, and her death destroys living testimony.
- Mateus receives accountability, supervision, corroboration, and revocable limits—not absolution, command authority, private access, restored office, or narrative ownership. His useful knowledge never makes European authority the resistance's default leader.
- Nikola's Croatian birth, English ancestry through fictional Margaret Wychmere, and his house's claimed Wallachian origin remain distinct. The house advertises a male line but its own contracts show repeated transmission through noblewomen and negotiated marriages. The 1462 vampire emergency, Dracul blood precedent, and Covenant of the Severed Dragon are explicit alternate history; the Covenant is not a real chivalric order, Christian rite, or historical institution.
- **The Last Command** does not reduce politics to mercy versus punishment. Witnessed transfer leaves Kurozane alive, defeated, bound, and without honor; execution or failed transfer exposes the civil war built into an immortal regime with no safe succession mechanism. Neither branch grants Nikola, Mateus, or the party the surrendered office.
- Father Mateus Avelar and the full cast remain original fictional characters; no celebrity or actor likeness is permitted.
- The fiction must not turn a real faith, ethnicity, historical victim, or identifiable sacred tradition into a monster class, reward system, or boss prop. External historical and cultural review remains a production gate.
