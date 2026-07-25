# Storyworld sequence production map

This is the production map for the eleven implemented Storyworld clusters. The authored source is [`storyworlds/bells-black-chrysanthemum.source.mjs`](../storyworlds/bells-black-chrysanthemum.source.mjs); exact campaign placement and related encounter IDs are generated in [`storyworlds/bells-black-chrysanthemum.bindings.json`](../storyworlds/bells-black-chrysanthemum.bindings.json). Generated files are not hand-edited.

## Scene arithmetic

- Canonical campaign: 60 scenes.
- Storyworld: 11 decision scenes plus 24 mutually exclusive consequence scenes = 35 authored scenes. The Act III war table and Lady Enma's dedicated spool each have three outcomes; the other nine decisions have two each.
- Total authored catalog: 60 + 35 = **95 scenes**.
- Salt route: 55 campaign scenes + 10 decisions + 10 consequences = **75 played scenes**.
- Ash route: 54 campaign scenes + 10 decisions + 10 consequences = **74 played scenes**.
- Paper route: 55 campaign scenes + 11 decisions + 11 consequences = **77 played scenes**.
- The route scheduler omits one regional operation and its owned Storyworld cluster. The authored 95-scene catalog remains available across routes; it is not a single-playthrough count.

Reactions occur inside those Storyworld scene nodes and do not add to the scene count.

The checked-in diagnostic in [`game/storyworld-pacing.mjs`](../game/storyworld-pacing.mjs) measures the full catalog ceiling: 2,440 visible words and at most 21 explicit decisions across all eleven clusters. Its 338.514-minute result combines that ceiling with all 60 authored campaign beats, so it is not a selected-route duration claim. Route receipts separately require at least 300 observed active minutes; fresh human route timing remains required.

## Carry-forward contract

Every cluster scheduled on the selected route is required for narrative credits. Salt omits `sw6-tribunal-afterword`, Ash omits `sw4-margin-varga-journal`, and Paper retains all eleven clusters while omitting the Sodegaura operation, which owns no separate cluster. The `act-route-decision` resolves before Act III's first campaign beat; a `before-boss-decision` resolves before its anchor beat can proceed; an `after-boss-consequence` or `after-level-consequence` resolves after its anchor beat. Each completed record preserves the selected decision, deterministic decision reaction, selected consequence, and consequence reaction. Their bounded effects update the projection used to select later reactions, the Act IV approach, and Act V political parameters.

The `sw3-sayos-warehouse-conditions` and `sw10-corrections-desk` strings remain opaque internal compatibility IDs, not claims that their new scenes have their old meanings. Exact legacy identities migrate only through the first two Storyworld records. A prior save that reached the old third record fails closed: the runtime will not reinterpret a warehouse-custody choice as a Salt, Ash, or Paper strategic priority. The same rule also prevents historical Enma and Corrections Desk outcomes from becoming political choices the player did not make.

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

3. **The Bellless House War Table** (`sw3-sayos-warehouse-conditions`, save-stable opaque ID)
   - Anchor: `c3-01-separate-arrivals`; placement: **act route** (`before-beat`, `act-route-decision`).
   - Related encounter IDs: none.
   - Consequences: **Salt Before Steel** / **Ash Before the Muster** / **Paper Before the Throne**.
   - Carry-forward: exact Salt, Ash, or Paper priority; initial theater commitment; Act IV approach-map selection; and Act V evacuation, Oni-supply, bell-intelligence, garrison-defection, succession, surrender-leverage, and civil-war-risk parameters.

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

## Act III and IV major-sequence integration

[`game/content/act-route-sequences.mjs`](../game/content/act-route-sequences.mjs) is the shared contract consumed by scene operations, presentation direction, tests, and the campaign UI. A route contains exactly eight major sequences; the smaller canonical beats remain its mapping and scripting units.

| # | Act III — The Three-Road War | Production binding |
|---|---|---|
| 1 | The Bellless House War Table | `sw3-sayos-warehouse-conditions`, `c3-01-separate-arrivals`, `hsh-map-table` |
| 2 | Chosen regional operation 1 | One of Sodegaura, Nagi, Kagura, or Kozui; all authored beat/map/encounter IDs travel with the operation package |
| 3 | Kurozane's counterstroke | Uses the first operation's closing map and boss encounter |
| 4 | Chosen regional operation 2 | Second unique operation package |
| 5 | Live Families at the Bellless House | `hsh-map-table`; reports live family, evacuation, evidence, and defection consequences |
| 6 | Chosen regional operation 3 | Third unique operation package; the fourth operation is omitted because the roads close |
| 7 | The Hushroad Emergency | Chapter 7 maps and encounters; `sw7-soldier-will-not-follow` |
| 8 | The Coalition Commits | `c7-04-lises-revised-oath`; freezes palace approaches and final-act parameters |

| # | Act IV — The Black Gate | Production binding |
|---|---|---|
| 1 | Three Homecomings | `c8-01-three-homecomings`; all three return maps |
| 2 | Route-specific approach | Salt → `c8-sodegaura-return`; Ash → `c8-takamine-return`; Paper → `c8-hoshigawa-return` |
| 3 | The Black Gate Bargain | `c8-03-black-gate-bargain`, `c8-black-gate` |
| 4 | Boats With Conditions | `sw8-boats-with-conditions` |
| 5 | The Lantern Breach | `c8-04-lantern-breach`, `c8-outer-court` |
| 6 | Lady Enma — The Last Mask | `c8-05-gate-opened`, `c8-lady-enma` |
| 7 | Three Terms for the Cinder Fan | `sw-enma-three-terms` |
| 8 | The Outer Archive Breathes | `c9-01-archive-breathes`, `krh-outer-archive`, `c9-archive-nodes`; Act V starts at `c9-02-ujiros-last-ledger` |

Every Act III–V canonical beat now receives the same `actId`, `majorSequenceId`, route-theater, and operation metadata in both its map operation and its presentation script. Automated validation fails if those two scripting surfaces drift or if a sequence references a missing beat, map, encounter, or Storyworld cluster.

## Cultural and narrative guardrails

- Sacred and devotional objects are not loot, combat consumables, puzzle tokens, or neutral gothic decoration. The clusters use fictional records, custody procedures, routes, and administrative evidence as their interactive material.
- Named Japanese organizers, witnesses, crews, and custodians retain authority over routes, access, custody, refusal, revision, and stop conditions. A refusal is a valid consequence, not a player obstacle to override.
- Lady Enma is an original culpable vampire and former court entertainer, not a claim that women, Japanese tradition, or a profession are monstrous. Her negotiated outcome is a revocable defection under witness, not romance, pardon, or instant redemption; her custody is distributed, and her death destroys living testimony.
- Mateus receives accountability, supervision, corroboration, and revocable limits—not absolution, command authority, private access, restored office, or narrative ownership. His useful knowledge never makes European authority the resistance's default leader.
- Nikola's Croatian birth, English ancestry through fictional Margaret Wychmere, and his house's claimed Wallachian origin remain distinct. The house advertises a male line but its own contracts show repeated transmission through noblewomen and negotiated marriages. The 1462 vampire emergency, Dracul blood precedent, and Covenant of the Severed Dragon are explicit alternate history; the Covenant is not a real chivalric order, Christian rite, or historical institution.
- **The Last Command** does not reduce politics to mercy versus punishment. Witnessed transfer leaves Kurozane alive, defeated, bound, and without honor; execution or failed transfer exposes the civil war built into an immortal regime with no safe succession mechanism. Neither branch grants Nikola, Mateus, or the party the surrendered office.
- Father Mateus Avelar and the full cast remain original fictional characters; no celebrity or actor likeness is permitted.
- The fiction must not turn a real faith, ethnicity, historical victim, or identifiable sacred tradition into a monster class, reward system, or boss prop. External historical and cultural review remains a production gate.
