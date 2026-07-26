# Storyworld sequence production map

This is the production map for the eleven implemented Storyworld clusters. The authored source is [`storyworlds/bells-black-chrysanthemum.source.mjs`](../storyworlds/bells-black-chrysanthemum.source.mjs); exact campaign placement and related encounter IDs are generated in [`storyworlds/bells-black-chrysanthemum.bindings.json`](../storyworlds/bells-black-chrysanthemum.bindings.json). The dramatic authority, causal strands, effect vocabulary, and Act III–IV conversion contract are locked in [`38-five-act-master-storyworld-plan.md`](38-five-act-master-storyworld-plan.md). Generated files are not hand-edited.

## Scene arithmetic

- Canonical campaign: 60 scenes.
- Storyworld: 11 decision scenes plus 26 mutually exclusive consequence scenes = 37 authored scenes. The Act III war table and Lady Enma's dedicated spool each have three outcomes, the Last Command has four, and the other eight decisions have two each.
- Total authored catalog: 60 + 37 = **97 scenes**.
- Salt route: 55 campaign scenes + 10 decisions + 10 consequences = **75 played scenes**.
- Ash route: 54 campaign scenes + 10 decisions + 10 consequences = **74 played scenes**.
- Paper route: 55 campaign scenes + 11 decisions + 11 consequences = **77 played scenes**.
- The route scheduler omits one regional operation and its owned Storyworld cluster. The authored 97-scene catalog remains available across routes; it is not a single-playthrough count.

Reactions occur inside those Storyworld scene nodes and do not add to the scene count.

The checked-in diagnostic in [`game/storyworld-pacing.mjs`](../game/storyworld-pacing.mjs) measures the full catalog ceiling: 2,483 visible words and at most 21 explicit decisions across all eleven clusters. Its 338.925-minute result combines that ceiling with all 60 authored campaign beats, so it is not a selected-route duration claim. Route receipts separately require at least 300 observed active minutes; fresh human route timing remains required.

## Carry-forward contract

Every cluster scheduled on the selected route is required for narrative credits. Salt omits `sw6-tribunal-afterword`, Ash omits `sw4-margin-varga-journal`, and Paper retains all eleven clusters while omitting the Sodegaura operation, which owns no separate cluster. The `act-route-decision` resolves before Act III's first campaign beat; a `before-boss-decision` resolves before its anchor beat can proceed; an `after-boss-consequence` or `after-level-consequence` resolves after its anchor beat. Each completed record preserves the selected decision, deterministic decision reaction, selected consequence, and consequence reaction. Their bounded effects update the projection used to select later reactions, the Act IV approach, and Act V political parameters.

Late reactions are not single-stat morality checks. Every Act III–IV decision reaction now reads at least four already-authored threads. Regional completion effects convert personal disciplines into evacuation capacity, Oni-supply disruption, bell intelligence, garrison defection, and succession readiness rather than merely raising a route label. The Enma hearing and all five Last Command options retain weighted multi-property formulas. The final options read six to nine prior threads apiece, including proof, consent, witness safety, Mateus's accountability, Nikola's severed-command discipline, succession preparation, garrison defection, bell intelligence, Oni-supply disruption, Enma's categorical fate, and Kurozane's accumulated pride, indispensability claim, and guilt pressure.

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
   - Carry-forward: exact Salt, Ash, or Paper priority; initial theater commitment; Act IV approach-map selection; and history-sensitive consent, safety, proof, and public-reach texture. The chosen priority remains categorical even when the coalition revises the party's first framing.

4. **A Margin in the Severed Dragon Testament** (`sw4-margin-varga-journal`, save-stable legacy ID)
   - Anchor: `c4-03-varga-journal`; placement: **after level** (`after-beat`, `after-level-consequence`).
   - Related encounter IDs: none.
   - Consequences: **A Covenant Entered as Evidence** / **The Deadline Beside the Gap**.
   - Carry-forward: Salt commitment, evacuation capacity, bell intelligence, route safety, and durable inheritance/custody limits for later Storyworld reactions; no battle card.

5. **The Cipher Handoff** (`sw5-cipher-handoff`)
   - Anchor: `c5-05-sigil-burned`; placement: **before boss** (`before-beat`, `before-boss-decision`).
   - Related encounter ID: `c5-furnace-abbot`.
   - Consequences: **A Chain With Human Verbs** / **Separate Accounts, Shared Test**.
   - Carry-forward: Ash commitment, Oni-supply disruption, garrison-defection groundwork, bounded bell intelligence, and **Decision carried into encounter** context for `c5-furnace-abbot`.

6. **Tribunal Afterword** (`sw6-tribunal-afterword`)
   - Anchor: `c6-03-tribunal`; placement: **after boss** (`after-beat`, `after-boss-consequence`).
   - Related encounter ID: `c6-ujiro`.
   - Consequences: **Admission Under Corroboration** / **An Audience Is Not Owed**.
   - Carry-forward: Paper commitment, public reach, succession readiness, bell intelligence, Kurozane guilt pressure, and retrospective **Recorded aftermath** context for `c6-ujiro`.

7. **The Soldier Who Will Not Follow** (`sw7-soldier-will-not-follow`)
   - Anchor: `c7-03-aqueduct-names`; placement: **before boss** (`before-beat`, `before-boss-decision`).
   - Related encounter ID: `c7-name-slip-release`.
   - Consequences: **Help Without a Banner** / **Silence Is Not Betrayal**.
   - Carry-forward: shared evacuation capacity, Oni release, garrison defection, reduced Kurozane indispensability, and **Decision carried into encounter** context for `c7-name-slip-release`.

8. **Boats With Conditions** (`sw8-boats-with-conditions`)
   - Anchor: `c8-04-lantern-breach`; placement: **before boss** (`before-beat`, `before-boss-decision`).
   - Related encounter ID: `c8-outer-court`.
   - Consequences: **A Fleet With Many Owners** / **Evacuation Is Enough**.
   - Carry-forward: evacuation capacity, route safety, Salt continuity, network consent, reduced Kurozane indispensability, and **Decision carried into encounter** context for `c8-outer-court`.

9. **Three Terms for the Cinder Fan** (`sw-enma-three-terms`; dedicated `spool_enma`)
   - Anchor: `c8-05-gate-opened`; placement: **after boss** (`after-beat`, `after-boss-consequence`).
   - Related encounter ID: `c8-lady-enma`.
   - Consequences: **Custody Without a Trophy** / **The Cinder Fan Ends** / **A Defection Under Witness**.
   - Carry-forward: exact categorical Enma fate (`captured`, `killed`, or `negotiated`), bounded custody/testimony effects, and retrospective **Recorded aftermath** context for the third boss fight. Custody or compact adds bounded bell intelligence; compact can also advance garrison defection. Death explicitly loses both kinds of reach and hardens Kurozane's pride. Only custody or compact can produce Enma cooperation in Act V, modifying effective Oni disruption, garrison stand-down readiness, surrender leverage, and civil-war risk without granting pardon or authority.

10. **Mateus at the Living Archive** (`sw9-mateus-living-archive`)
   - Anchor: `c9-04-yearless-bell`; placement: **before boss** (`before-beat`, `before-boss-decision`).
   - Related encounter ID: `c9-yearless-bell`.
   - Consequences: **Knowledge Under Revocable Terms** / **The Translation Stops**.
   - Carry-forward: **Decision carried into encounter** context for `c9-yearless-bell`, including the selected limit on Mateus and its resolved consequence.

11. **The Last Command** (`sw10-corrections-desk`, opaque legacy internal ID)
    - Anchor: `c9-05-dawn-at-observatory`; placement: **after boss** (`after-beat`, `after-boss-consequence`).
    - Related encounter ID: `c9-kurozane`.
    - Consequences: **The Seals Returned** / **The Last Seal at Dawn** / **The Necessary Blade** / **The Empty Throne Mobilizes**.
    - Carry-forward: final living abdication, witnessed dawn seppuku, prepared execution, or unprepared execution/failed-parley civil-war state; retrospective **Recorded aftermath** context for `c9-kurozane`; and the route-ending political record. Witnessed return, provisional binding, dawn demand, execution demand, and **name the crime** each resolve from distinct multi-thread scores. Name the crime can produce incomplete concession, defensive rage, or the rare public-confession pride reversal. The prepared-execution consequence has separate Ash military and Paper civil-succession reactions so the record preserves which groundwork made the same terminal act survivable.

## Whole-route balance rehearsal

[`game/storyworld-balance-audit.mjs`](../game/storyworld-balance-audit.mjs) runs the shipped deterministic reaction engine against the exact Salt, Ash, and Paper schedules. The locked audit command is:

```text
node game/storyworld-balance-audit.mjs --runs 5000 --seed 42
```

The locked 15,000-run result is 44.09% **The Seals Returned**, 11.97% **The Last Seal at Dawn**, 16.46% **The Necessary Blade**, and 27.48% **The Empty Throne Mobilizes** overall. Every route expresses all four endings. Salt resolves 40.48% living abdication / 3.74% dawn seppuku / 9.72% prepared execution / 46.06% civil war. Ash resolves 43.36% / 4.94% / 19.46% / 32.24%; Paper resolves 48.42% / 27.24% / 20.20% / 4.14%. The confession-and-pride-reversal flow remains rare at 2.50% globally and 7.48% on Paper; execution pressure forces fearful surrender in a separate 0.36% tail. Paper's stronger political position remains earned rather than automatic: clean succession and witnessed dawn seppuku each appear in 54.26%, and civil-war-safe execution in 51.38%. Ash separately earns civil-war-safe execution in 60.60% through Oni-supply disruption and garrison stand-down. Rotating custody resolves 34.00% of Enma hearings, witnessed compact 62.82%, and death 3.18%. All three Enma outcomes, all thirteen final dramatic flows, and all four endings remain reachable in the locked rehearsal. The full findings and thread ledger are recorded in [`storyworlds/bells-black-chrysanthemum_long_range_authoring.md`](../storyworlds/bells-black-chrysanthemum_long_range_authoring.md).

## Act III and IV major-sequence integration

[`game/content/act-route-sequences.mjs`](../game/content/act-route-sequences.mjs) is the shared contract consumed by scene operations, presentation direction, tests, and the campaign UI. Acts III and IV contain exactly eight major sequences each; convergent Act V contains five. The smaller canonical beats remain their mapping and scripting units.

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

| # | Act V — The Living Castle | Production binding |
|---|---|---|
| 1 | Ujiro’s Last Ledger | `c9-02-ujiros-last-ledger`, `krh-audience-hall`; rescue both living prisoners before custody |
| 2 | The Conservatory Offers | `c9-03-conservatory-offers`, `krh-blood-conservatory`; Miyo’s refusal plus six playable offer refusals |
| 3 | The Bell Spine and the Yearless Bell | `krh-bell-spine` → transformed `krh-observatory`, `sw9-mateus-living-archive`, `c9-04-yearless-bell` |
| 4 | Dawn at the Observatory | `krh-observatory`, `c9-kurozane`, `sw10-corrections-desk`; physical defeat before political resolution |
| 5 | Leave the Evidence Alive | `c9-06-leave-evidence-alive`, safe reverse pass through `krh-outer-archive`, then epilogue |

Every Act III–V canonical beat now receives the same `actId`, `majorSequenceId`, route-theater, and operation metadata in both its map operation and its presentation script. Automated validation fails if those two scripting surfaces drift or if a sequence references a missing beat, map, encounter, or Storyworld cluster. The six exact Act V map visits, including the Outer Archive evacuation return, are validated separately in [`game/content/late-act-level-design.mjs`](../game/content/late-act-level-design.mjs).

## Cultural and narrative guardrails

- Sacred and devotional objects are not loot, combat consumables, puzzle tokens, or neutral gothic decoration. The clusters use fictional records, custody procedures, routes, and administrative evidence as their interactive material.
- Named Japanese organizers, witnesses, crews, and custodians retain authority over routes, access, custody, refusal, revision, and stop conditions. A refusal is a valid consequence, not a player obstacle to override.
- Lady Enma is an original culpable vampire and former court entertainer, not a claim that women, Japanese tradition, or a profession are monstrous. Her negotiated outcome is a revocable defection under witness, not romance, pardon, or instant redemption; her custody is distributed, and her death destroys living testimony.
- Mateus receives accountability, supervision, corroboration, and revocable limits—not absolution, command authority, private access, restored office, or narrative ownership. His useful knowledge never makes European authority the resistance's default leader.
- Nikola's Croatian birth, English ancestry through fictional Margaret Wychmere, and his house's claimed Wallachian origin remain distinct. The house advertises a male line but its own contracts show repeated transmission through noblewomen and negotiated marriages. The 1462 vampire emergency, Dracul blood precedent, and Covenant of the Severed Dragon are explicit alternate history; the Covenant is not a real chivalric order, Christian rite, or historical institution.
- **The Last Command** does not reduce politics to mercy versus punishment. Living abdication leaves Kurozane defeated, bound, and without office; dawn seppuku transfers every seal publicly before his death; prepared execution is survivable only when prior coalition work can issue mortal orders; and unprepared execution or failed parley exposes the civil war built into an immortal regime with no safe succession mechanism. No ending grants Nikola, Mateus, or the party the surrendered office.
- Father Mateus Avelar and the full cast remain original fictional characters; no celebrity or actor likeness is permitted.
- The fiction must not turn a real faith, ethnicity, historical victim, or identifiable sacred tradition into a monster class, reward system, or boss prop. External historical and cultural review remains a production gate.
