# Expanded Campaign Build - QA Report

Integration audit: 2026-07-18. This report distinguishes deterministic implementation evidence, static delivery checks, and quantity-based duration estimates from the still-missing timed human playthrough.

## Result

| Area | Status | Evidence |
| --- | --- | --- |
| Campaign content | Pass | 11 chapters and 60 canonical beats resolve against the shipped maps and 23 encounter kits. The playable script contains 2,746 dialogue lines and 37,717 words. |
| Scene operations | Pass, deterministic runtime scope | Every beat has a persistent scene operation: 60 operations containing 183 ordered exact-tile nodes. Node order, explicit encounter-win evidence, exit gating, save replay refusal, and full canonical completion are enforced; this still does not substitute for interactive visual QA. |
| Campaign path | Pass, deterministic reachability scope | The canonical runner completes 1,419 legal field moves, 236 interactions, 41 exits, all 23 first clears, 228 player commands, 100 enemy activations, and 16 rests. |
| Shared combat | Pass, production-foundation scope | All 23 encounters instantiate in the multi-party engine with exact movement, Pace, readiness/recovery, delivery and essence multipliers, Guard, Analyze, Spirit economy, deterministic enemy AI, objective actions, and terminal results. A deterministic legal policy clears every first encounter. |
| Objective families | Pass, bespoke presentation implemented | All 18 authored objective types have distinct player-facing presentations, labels, colors, and deterministic marker geometry, including escape, escort, release, protect, rescue, relay, node, evacuation, and noncombat interaction contracts. |
| Spirit and statuses | Pass, live combat behavior | Spirit costs and gains affect skill availability and solver decisions. Guard, Analyze, and objective actions regenerate Spirit. Dread, Chill, Shock, Scorch, Bound, and Overheated have deterministic application, duration, effect, and log behavior. |
| Advancement and grinding | Pass | Six characters have deterministic XP/stat growth to level 50. First clears grant unique authored loot; repeat victories grant diminishing XP/currency. Equipped Pace/Recovery deltas alter engine timing. Repeat-only Auto-Grind schedules the complete loop at exact 1x/2x/4x ratios. |
| Finite optional content | Pass for deterministic completion | The finite runner completes 13 sidequests, 59 quest objectives, 18 witness chronicles, 288 line acknowledgements, 67 ordered stages, and 31 once-only reward settlements. It excludes repeat contracts and refuses replay of finite arcs. |
| Camp and loadout | Pass, production-foundation scope | Versioned inventory and vitals support shops, buy/sell, field loot, consumables, equipment restrictions, forge ranks, two-slot Vows, Spirit/status recovery, and three camp tiers. Equipped modifiers adapt campaign-battle profiles and timing. |
| Pixel-art combat presentation | Pass, original production asset scope | The runtime uses an original transparent 8x4 enemy combat atlas with neutral, windup, attack, and stagger poses across eight enemy families. Deterministic attack timelines select and reset those poses. This is production raster art, not proof of final animation polish. |
| Playtime telemetry | Pass as instrumentation | A clean-start UUID receipt owns zero-based narrative, exploration, first-clear combat, repeat grind, and camp/menu time; suspends after 30 seconds without input; records the canonical beat prefix and unique first clears; and seals on campaign completion. Receipt-less historical saves remain unverified. |
| Canonical integrated run | Pass for deterministic reachability | One clean DOM-free run completes all 60 beats with 2,746 dialogue lines, 1,419 moves, 236 interactions, 41 exits, 23 first clears, 228 player commands, 100 enemy activations, and 16 rests. Its stable trace signature is `fnv1a32:029392d1`. It records zero time and therefore does not prove duration. |
| Finite-content integrated run | Pass for deterministic reachability | The finite witness signature is `fnv1a32:461c9442`. It completes 13 quests/59 objectives and 18 chronicles/288 acknowledgements/67 stages, settles 31 rewards once, rejects finite replay, and records zero time. |
| Twenty-hour duration | Unproven | The quantity audit estimates 223.258 minutes low, 393.128 minutes reference, and 691.875 minutes high. The reference estimate is 806.872 minutes short of 20 hours. Estimates are not timed-play evidence, and no complete human playthrough currently proves the target. |

## Reproducible checks

Run from `game/` unless noted otherwise.

| Check | Command / method | Result |
| --- | --- | --- |
| JavaScript syntax | `npm run check` | The dependency-free recursive syntax gate checks every shipped JS/MJS runtime and content module, including dialogue packs, animation, atlas, objective, witness, fieldwork, duration, scene-operation, and finite-run modules. |
| Unit and integration tests | `npm test` | Pass at milestone lock: 284/284 tests. Coverage includes combat presentation scheduling, every encounter/objective family, Spirit/status behavior, exact movement, scene-operation persistence/gates, canonical and finite completion, rewards/replay refusal, duration evidence, saves, routes, and world integrity. |
| Canonical completion | `node --test tests/canonical-run.test.mjs` | Verifies deterministic replay, exact legal completion quantities, immutable final authorities, and zero fabricated time. Current canonical signature: `fnv1a32:029392d1`. |
| Finite optional completion | `node --test tests/finite-content-run.test.mjs` | Verifies every finite quest/chronicle transition, exact acknowledgements and stages, canonical combat evidence, atomic rewards, replay refusal, hard bounds, deterministic identity, and zero duration proof. Current finite signature: `fnv1a32:461c9442`. |
| Duration audit | `node --test tests/duration-audit.test.mjs` | Verifies that declared chapter budgets are excluded from evidence, quantity estimates never become proof, and only a valid timed run receipt can prove 20 hours. Current reference estimate: 393.128 minutes; gap: 806.872 minutes. |
| Diff whitespace | `git diff --check` from repository root | Required before milestone lock. |
| Static delivery | Serve `game/` and request the HTML, runtime modules, content modules, and raster atlases | Pass: 21/21 requested URLs returned HTTP 200, including Campaign, query-selected Battle, Camp, all new operation/dialogue/witness/animation/audit modules, and both runtime atlases. This does not prove DOM interaction, canvas correctness, responsive layout, browser-console cleanliness, or visual quality. |
| Interactive browser QA | Browser-driven play and inspection | Outstanding. No interactive browser QA is claimed by this report. |

## Runtime boundaries

1. The battle engine consumes the real encounter and level data. It does not hard-code one showcase enemy. Party stats derive from saved advancement, and victory rewards return to the same versioned authority.

2. Spirit is now a live combat resource rather than a camp-only field. Skills declare costs or gains, unavailable actions fail closed, and the deterministic policy can fall back to Guard. The six shipped statuses alter Spirit, Pace, Recovery, or activation damage with explicit lifecycle logs.

3. All 18 objective action families now have bespoke presentation metadata and deterministic in-arena tokens. This establishes readable functional presentation; it does not establish that every encounter has final hand-authored cut-ins, effects, or animation polish.

4. Field interactions, hazards, exits, placed encounters, and objective tokens are persistent runtime behavior. The canonical witness proves the current route with 1,419 legal moves and 236 interactions. A deterministic witness proves reachability, not player comprehension or controller feel.

5. Optional-content evidence covers 13 finite quests plus 18 finite witness chronicles. The finite runner acknowledges every one of the 288 authored chronicle lines, completes all 67 stages, uses canonical victory evidence for combat stages, applies 31 rewards once across progression authorities, and refuses replay. Its zero-time receipt is intentionally not duration evidence.

6. The witness fieldwork catalog contains 152 deterministic nodes with 729 minimum exact movement steps. Those are audited traversal quantities. The DOM-free finite runner records zero performed movement and makes no elapsed-time claim from them.

7. First clears remain manual. Auto-Grind is available only on repeats and changes the presentation schedule for intro, movement, commands, enemy turns, Recovery, result, and reward. Engine decisions and rewards remain invariant across 1x/2x/4x schedules.

8. Cross-page telemetry separates narrative/exploration, first-clear combat, repeat grind, and camp time; hidden, resolved-battle, and 30-second-idle periods do not accrue. Duration proof requires the same clean-start UUID receipt, all 60 beats, all 23 canonical first clears, and the target elapsed time. Neither deterministic runner records time.

9. The 37,717-word script and 60 scene operations are shipped runtime volume. Reading-speed and activity formulas can estimate that volume, but the honest audit remains 223.258/393.128/691.875 minutes at low/reference/high assumptions. Even the high estimate is below 20 hours.

10. The original enemy atlas is a transparent 8x4 production raster used by the combat renderer, and attack timelines are deterministic. Interactive browser/canvas inspection, responsive review, visual comparison, input feel, and console inspection remain outstanding.

## Next implementation gate

The combat integration is stable under the syntax gate and 284/284 milestone tests. Next, perform static delivery plus interactive browser and visual QA. Expand measured finite story, field, encounter, and optional activity by the remaining evidence gap rather than relying on declared pacing budgets. Finally, run chapter-by-chapter and full clean-start human playtests. The 20-hour target remains unproven until a valid normal-speed receipt records the complete player-facing run.
