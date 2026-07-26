# Bells of the Black Chrysanthemum — long-range authoring report

Audit date: 2026-07-25

Storyworld source version: 6

Scope: the 60-scene canonical campaign, all 37 authored Storyworld nodes, and every Salt, Ash, and Paper selected-route schedule.

## Outcome

The campaign now carries its early custodial, character, military, and political decisions into the Black Gate and Last Command through explicit multi-property reaction scores. Four final political outcomes remain live across the route union: living abdication under mortal custody, public abdication followed by witnessed seppuku at dawn, prepared execution with civil continuity, and unprepared execution or failed parley followed by civil war. Paper earns the broadest political possibility space; Ash can separately make execution survivable through military groundwork; neither route guarantees a stable ending.

The source, generated SweepWeave JSON, binding sidecar, browser runtime, route projection, save migration, and production documentation use one model. Existing scene, option, reaction, consequence, and effect identities were not renamed. Source version 6 adds three Kurozane inclinations, one final player tactic, three dramatic reactions, and the first explicitly non-nudge effect: the rare exact complement of Kurozane’s pride.

## Defects found and corrected

1. `sw9-mateus-living-archive` and `sw10-corrections-desk` still named obsolete Act V integration IDs. They now bind to `act5-sequence-03` and `act5-sequence-04`.
2. The final outcome was too dependent on one already-high property. A 15,000-run browser-runtime baseline produced 66.53% **The Seals Returned** and 33.47% **The Empty Throne Mobilizes**, with Paper at 76.82% surrender.
3. Four advertised Act V preparations were unreachable under the authored effect caps: clean succession, outer-garrison stand-down, civil-war-safe execution, and witnessed dawn seppuku.
4. Lady Enma's categorical fate was recorded but did not alter Act V logistics.
5. **Tribunal Afterword** reached **Admission Under Corroboration** in only about 3% of the first balanced sample because Kiku's unchanged 0.50 capacity always lost the reaction tie.
6. The generic SweepWeave rehearsal helper starts every bounded property at zero and ignores this project's route scheduler and activated-spool contract. Its result is therefore not valid for this campaign. The checked-in audit runs the shipped browser runtime and exact selected-route schedules.
7. The four-ending topology still compressed the emotional confrontation into strategic outcomes. The fifth **name the crime** tactic now separates incomplete concession, defensive rage, and public confession without adding redundant political endings.
8. An initial confession formula made the pride reversal unreachable. A 0.07 local desirability correction placed it in the intended tail. A separate execution-threat flow then needed a 0.04 local correction so all thirteen final reactions remained live without consuming prepared execution.

## Long-range thread ledger

| Thread | Establishment | Development | Late payoff |
|---|---|---|---|
| Custody, consent, and refusal | `sw1-clerks-second-copy` | `sw3`, `sw7`, `sw8` | Witnessed transfer and provisional binding in `sw10` read consent, proof, witness safety, Ren's noncoercion, and party cohesion. |
| Mateus earns bounded usefulness | `sw2-witness-not-family` | `sw5-cipher-handoff`, `sw6-tribunal-afterword` | `sw9` limits archive access; `sw10` uses accountability without restoring priestly office. |
| Nikola severs inherited command | `sw4-margin-varga-journal` | Enma custody at `sw-enma-three-terms` | The final binding reads Nikola's discipline and rejects private hunter succession. |
| Genta learns help without command | `sw5-cipher-handoff` | `sw7-soldier-will-not-follow` | Genta's accountability combines with consent and explicit defection readiness to determine whether the outer garrison can stand down. |
| Enma dies, enters custody, or defects | `sw-enma-three-terms` | Her testimony remains bounded by the chosen fate | Only custody or compact creates Enma cooperation. It improves cipher verification, Oni disruption, stand-down readiness, surrender leverage, and civil-war risk; death preserves none of that operational benefit. |
| Salt, Ash, and Paper coalition work | `sw3-sayos-warehouse-conditions` | Route-owned operations in `sw4`–`sw8` | Salt strengthens evacuation, Ash attacks Oni supply and organizes garrison stand-down, and Paper develops succession/public reach. Paper can unlock clean succession and witnessed seppuku; either Ash military continuity or Paper civil continuity can make execution survivable. |
| Kurozane’s sovereign psychology | Pride and indispensability begin high; guilt pressure begins low | Mateus’s bounded testimony, the independent soldier, local boats, the tribunal, Enma’s fate, and the Living Archive apply only ±0.05/±0.10 nudges | **Name the crime** reads all three inclinations. Only the rare confession maps pride to `1 − pride`; ordinary capitulation, fear, and rage retain nudge semantics. |

The Last Command's five player options now produce thirteen deterministic dramatic flows and consult six to nine earlier variables apiece. The result is not a morality meter: witnessed transfer can fail through an unverified office, provisional binding can fail through inherited custody, a dawn ceremony can become an ambush if its writ reaches only one stair, execution pressure can produce fear rather than repentance, and the accusation over Mateus’s son can produce concession, rage, or confession. Prepared execution has separate authored reactions for Ash's disrupted Oni supply and Paper's verified civil succession; they converge on one ending without erasing how the player earned it.

## Rehearsal results

Command:

```text
node game/storyworld-balance-audit.mjs --runs 5000 --seed 42
```

This performs 5,000 deterministic, uniformly option-sampled runs for each exact narrative route: 15,000 complete Storyworld runs total.

| Route | Seals Returned | Last Seal at Dawn | Necessary Blade | Empty Throne / civil war | Mean civil-war risk | Mean surrender leverage |
|---|---:|---:|---:|---:|---:|---:|
| Salt | 29.86% | 0.00% | 0.00% | 70.14% | 51.64% | 37.30% |
| Ash | 32.90% | 0.00% | 8.18% | 58.92% | 50.73% | 36.65% |
| Paper | 49.18% | 12.52% | 16.40% | 21.90% | 44.76% | 43.72% |
| All routes | 37.31% | 4.17% | 8.19% | 50.32% | — | — |

| Route | Mean pride before final tactic | Mean indispensability | Mean guilt pressure |
|---|---:|---:|---:|
| Salt | 80.79% | 57.76% | 19.61% |
| Ash | 81.05% | 58.06% | 24.48% |
| Paper | 80.14% | 56.83% | 24.93% |

Lady Enma's global outcome distribution is 37.75% rotating custody, 55.64% witnessed compact, and 6.61% death. Every result remains reachable. On Paper, the lowest-frequency Enma-death branch still appeared in 1.42% of 5,000 runs.

Paper's earned late gates are deliberately available but nonautomatic:

- witnessed seppuku at dawn: 42.66%;
- clean succession: 40.22%;
- execution without immediate civil war: 37.22%.

Ash independently prepares execution without immediate civil war in 54.26% of its rehearsals through Oni-supply disruption and garrison stand-down; player choice and the final reaction score convert 8.18% of Ash runs into **The Necessary Blade**.

The public-confession pride reversal occurs in 1.49% of all rehearsals and 4.46% of Paper rehearsals. The distinct fear-without-repentance surrender occurs in 0.84% overall. All thirteen final flows appear in the locked rehearsal.

The route union reaches all 26 consequence scenes. Nineteen entry options change deterministic reaction across different histories. The runtime rehearsal records no dead path; the separate bounded path-union test reaches every authored consequence and executes the pride complement in at least one bounded history.

## Save and production contract

Source version 6 adds the fifth final tactic, three reactions, three bounded properties, and one explicit complement effect. Existing opaque option, reaction, outcome, and effect identities remain unchanged. The exact source-version-5 catalog identity migrates a complete eleven-record history without replacing any selected ending; earlier choices supply bounded evidence for the new inclination projection.

Generated files remain owned by `game/tools/build-storyworld.mjs`. The balance audit is regression-tested, and source generation fails if the JSON, binding sidecar, or browser catalog drifts.
