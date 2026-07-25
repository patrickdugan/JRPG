# Bells of the Black Chrysanthemum — long-range authoring report

Audit date: 2026-07-25

Storyworld source version: 4

Scope: the 60-scene canonical campaign, all 35 authored Storyworld nodes, and every Salt, Ash, and Paper selected-route schedule.

## Outcome

The campaign now carries its early custodial, character, military, and political decisions into the Black Gate and Last Command through explicit multi-property reaction scores. Both final political outcomes remain live on all three routes. The Paper route earns the strongest succession tools, but does not guarantee the non-civil-war ending.

The source, generated SweepWeave JSON, binding sidecar, browser runtime, route projection, save migration, and production documentation use one model. No scene, option, reaction, consequence, or effect identity was renamed.

## Defects found and corrected

1. `sw9-mateus-living-archive` and `sw10-corrections-desk` still named obsolete Act V integration IDs. They now bind to `act5-sequence-03` and `act5-sequence-04`.
2. The final outcome was too dependent on one already-high property. A 15,000-run browser-runtime baseline produced 66.53% **The Seals Returned** and 33.47% **The Empty Throne Mobilizes**, with Paper at 76.82% surrender.
3. Four advertised Act V preparations were unreachable under the authored effect caps: clean succession, outer-garrison stand-down, civil-war-safe execution, and witnessed dawn seppuku.
4. Lady Enma's categorical fate was recorded but did not alter Act V logistics.
5. **Tribunal Afterword** reached **Admission Under Corroboration** in only about 3% of the first balanced sample because Kiku's unchanged 0.50 capacity always lost the reaction tie.
6. The generic SweepWeave rehearsal helper starts every bounded property at zero and ignores this project's route scheduler and activated-spool contract. Its result is therefore not valid for this campaign. The checked-in audit runs the shipped browser runtime and exact selected-route schedules.

## Long-range thread ledger

| Thread | Establishment | Development | Late payoff |
|---|---|---|---|
| Custody, consent, and refusal | `sw1-clerks-second-copy` | `sw3`, `sw7`, `sw8` | Witnessed transfer and provisional binding in `sw10` read consent, proof, witness safety, Ren's noncoercion, and party cohesion. |
| Mateus earns bounded usefulness | `sw2-witness-not-family` | `sw5-cipher-handoff`, `sw6-tribunal-afterword` | `sw9` limits archive access; `sw10` uses accountability without restoring priestly office. |
| Nikola severs inherited command | `sw4-margin-varga-journal` | Enma custody at `sw-enma-three-terms` | The final binding reads Nikola's discipline and rejects private hunter succession. |
| Genta learns help without command | `sw5-cipher-handoff` | `sw7-soldier-will-not-follow` | Genta's accountability combines with consent and explicit defection readiness to determine whether the outer garrison can stand down. |
| Enma dies, enters custody, or defects | `sw-enma-three-terms` | Her testimony remains bounded by the chosen fate | Only custody or compact creates Enma cooperation. It improves cipher verification, Oni disruption, stand-down readiness, surrender leverage, and civil-war risk; death preserves none of that operational benefit. |
| Salt, Ash, and Paper coalition work | `sw3-sayos-warehouse-conditions` | Route-owned operations in `sw4`–`sw8` | Salt strengthens evacuation, Ash attacks Oni supply, and Paper develops succession/public reach. Paper alone can normally unlock clean succession, witnessed seppuku, and civil-war-safe execution. |

The Last Command's three player options now consult six to eight earlier variables apiece. The result is not a morality meter: witnessed transfer can fail through an unverified office, provisional binding can fail through inherited custody, and an execution demand can force surrender only when other commands are already moving without Kurozane.

## Rehearsal results

Command:

```text
node game/storyworld-balance-audit.mjs --runs 5000 --seed 42
```

This performs 5,000 deterministic, uniformly option-sampled runs for each exact narrative route: 15,000 complete Storyworld runs total.

| Route | The Seals Returned | Empty Throne / civil war | Mean civil-war risk | Mean surrender leverage |
|---|---:|---:|---:|---:|
| Salt | 47.14% | 52.86% | 51.64% | 37.30% |
| Ash | 44.40% | 55.60% | 50.73% | 36.65% |
| Paper | 73.94% | 26.06% | 44.76% | 43.72% |
| All routes | 55.16% | 44.84% | — | — |

Lady Enma's global outcome distribution is 37.75% rotating custody, 55.64% witnessed compact, and 6.61% death. Every result remains reachable. On Paper, the lowest-frequency Enma-death branch still appeared in 1.42% of 5,000 runs.

Paper's earned late gates are deliberately available but nonautomatic:

- witnessed seppuku at dawn: 42.66%;
- clean succession: 40.22%;
- execution without immediate civil war: 37.22%.

The route union reaches all 24 consequence scenes. Seventeen entry options change deterministic reaction across different histories. The runtime rehearsal records no dead path; the separate bounded path-union test reaches every authored consequence.

## Save and production contract

Source version 4 changes reaction desirability formulas, Act V integration labels, and derived route parameters. Existing opaque option, reaction, outcome, and effect identities remain unchanged. The exact prior catalog identity migrates a complete eleven-record history without replacing any selected outcome.

Generated files remain owned by `game/tools/build-storyworld.mjs`. The balance audit is regression-tested, and source generation fails if the JSON, binding sidecar, or browser catalog drifts.
