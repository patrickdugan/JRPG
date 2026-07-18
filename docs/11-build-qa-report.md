# Expanded Campaign Build — QA Report

Integration audit: 2026-07-18. This report distinguishes implemented runtime behavior from the still-unproven 20-hour playtime target.

## Result

| Area | Status | Evidence |
| --- | --- | --- |
| Campaign content | Pass | 11 chapters, 60 beats, 46 named map references, 48 level kits, and 23 encounter kits. Every map and encounter resolves. |
| Campaign path | Pass, route-foundation scope | Every encounter is bound to exactly one canonical story beat. Forward progress requires the beat’s first clears and, where maps connect, use of a satisfiable authored exit chain; 34 canonical beat-to-map routes execute in the route audit. |
| Field exploration | Pass, production-foundation scope | Versioned field state persists exact position and per-level/beat progress. Authored interactions, explicit choices, delayed/conditional/cyclic hazards, placed encounter triggers, and condition-checked exits execute from level data. |
| Shared combat | Pass, production-foundation scope | All 23 encounters instantiate in the multi-party engine with exact movement, Pace, readiness/recovery, delivery and essence multipliers, Guard, Analyze, deterministic enemy AI, and terminal results. |
| Objective families | Pass, generic presentation | All 18 authored objective types have explicit requirements/actions, including escape, escort, release, protect, rescue, relay, node, evacuation, and noncombat interaction contracts. Bespoke tokens, hazards, and encounter cinematics remain to be rendered. |
| Advancement and grinding | Pass | Six characters have deterministic XP/stat growth to level 50. First clears grant unique authored loot; repeat victories grant diminishing XP/currency. Equipped Pace/Recovery deltas alter engine timing. A saved 1×/2×/4× control accelerates enemy/recovery presentation. |
| Optional content | Pass, authored/runtime-foundation scope | 13 finite side quests (224 minutes) and four repeatable contracts (40-minute first circuit) validate against canonical chapters, beats, maps, encounters, prerequisites, objectives, and rewards. Every objective map is journal-reachable; completion applies XP, currency, items, and key items. |
| Camp and loadout | Pass, production-foundation scope | Versioned inventory and vitals support shops, buy/sell, field loot, consumables, equipment restrictions, forge ranks, two-slot Vows, Spirit/status recovery, and three camp tiers. Equipped modifiers adapt campaign-battle profiles and timing. |
| Playtime telemetry | Pass as instrumentation | One validated save separates narrative, exploration, first-clear combat, repeat grind, and camp/menu time, suspends after 30 seconds without input, and rejects elapsed-time-only proof. A clean New Game clears every save domain. |
| Twenty-hour duration | Unproven | The pacing budget totals 20 hours at 1× and assigns three hours to grinding, but no complete timed playthrough currently proves that the implemented content sustains that duration. |

## Reproducible checks

Run from `game/` unless noted otherwise.

| Check | Command / method | Result |
| --- | --- | --- |
| JavaScript syntax | `npm run check` | Pass across FP-0, Atlas, Battle, Camp, both combat engines, progression, advancement, field, quest, loadout, playtime, and content modules. |
| Unit tests | `npm test` | Pass: 130/130 including nested route cases. Coverage includes every encounter/objective family, movement/corner collision, Tempo/recovery, loadout timing, typed damage, deterministic AI, wounded-party entry, advancement/reward transactions, field persistence/interactions/hazards/triggers/exits, playtime evidence, quest progression/travel, optional-content integrity, map integrity, and 34 canonical route chains. |
| Diff whitespace | `git diff --check` from repository root | Pass for this documentation update. |
| Static delivery | Serve `game/`; request FP-0, Atlas, query-selected Battle, Camp, runtime/content modules, and runtime atlas | Pass: 13/13 requested URLs returned HTTP 200, including `battle.html?encounter=c1-cinder-hounds`, `camp.html`, field/loadout/playtime/quest modules, optional-content data, and the party atlas. |

## Runtime boundaries

1. The battle engine consumes the real encounter and level data. It does not hard-code one showcase enemy. Party stats are derived from the saved advancement profile and victory rewards return to that same versioned profile.

2. Field interactions, hazards, exits, and placed encounter triggers are now persistent runtime behavior. Their Canvas markers and feedback remain production-foundation presentation; this does not mean combat objectives have bespoke escort tokens, node art, hazard overlays, or encounter-specific cut-ins. Several combat objectives still use the generic `Objective` command.

3. Optional-content validation proves 13 finite quests plus four contracts and a 264-minute authored first-pass estimate. It is not a timed-play receipt. Rewards are atomic across quest, advancement, and loadout saves, and journal travel reaches every objective map; quest markers still use generated Canvas presentation rather than bespoke art.

4. Camp tracks equipment, Vows, consumables, currency, Spirit, statuses, and rest deterministically. Stat, Pace, and Recovery modifiers feed battle profile/engine creation. Full Spirit/status command use inside combat remains a later combat-system extension.

5. Battle speed changes presentation delay while command menus stay paused and turn-based. It is intended for repeat grinding and does not skip authored story scenes or first-clear content.

6. Cross-page telemetry separates Atlas narrative/exploration, first-clear combat, grind, and Camp time; hidden, resolved-battle, and 30-second-idle periods do not accrue. Duration proof requires the time targets, campaign completion, and all canonical first clears. It is not yet run-ID signed, and no completed run currently satisfies it.

7. The art remains original production reference material plus one provisional transparent party atlas used by Camp, not final editable frame work. Static HTTP delivery is verified, but no interactive browser-control surface was available in this environment; DOM/canvas click-through, visual comparison, responsive-layout review, and browser-console inspection remain outstanding.

## Next implementation gate

Replace generic combat objective actions with bespoke encounter tokens and presentation, extend Spirit/status effects through combat, add run-ID-signed completion receipts, complete interactive browser and visual QA, prove every battle from its canonical loadout, expand measured story/field volume, and run chapter-by-chapter timed playtests. The game is not complete until a normal first playthrough of the implemented build measures about 20 hours at 1× and the speed controls measurably shorten repeat grinding.
