# Expanded Campaign Build — QA Report

Integration audit: 2026-07-18. This report distinguishes implemented runtime behavior from the still-unproven 20-hour playtime target.

## Result

| Area | Status | Evidence |
| --- | --- | --- |
| Campaign content | Pass | 11 chapters, 60 beats, 46 named map references, 48 level kits, and 23 encounter kits. Every map and encounter resolves. |
| Campaign path | Pass, route-foundation scope | Every encounter is bound to exactly one canonical story beat. Forward progress requires the beat’s first clears and, where maps connect, use of a satisfiable authored exit chain; 34 canonical beat-to-map routes execute in the route audit. |
| Field exploration | Pass, production-foundation scope | Versioned field state persists exact position and per-level/beat progress. Authored interactions, explicit choices, delayed/conditional/cyclic hazards, placed encounter triggers, and condition-checked exits execute from level data. |
| Shared combat | Pass, production-foundation scope | All 23 encounters instantiate in the multi-party engine with exact movement, Pace, readiness/recovery, delivery and essence multipliers, Guard, Analyze, deterministic enemy AI, and terminal results. A competent policy produces deterministic legal first-clear victories for all 23. |
| Objective families | Pass, generic presentation | All 18 authored objective types have explicit requirements/actions, including escape, escort, release, protect, rescue, relay, node, evacuation, and noncombat interaction contracts. Bespoke tokens, hazards, and encounter cinematics remain to be rendered. |
| Advancement and grinding | Pass | Six characters have deterministic XP/stat growth to level 50. First clears grant unique authored loot; repeat victories grant diminishing XP/currency. Equipped Pace/Recovery deltas alter engine timing. Repeat-only Auto-Grind schedules its complete loop at exact 1×/2×/4× ratios and clears all 23 encounters from their canonical leveled, fully rested repeat states. |
| Optional content | Pass, authored/runtime-foundation scope | 13 finite side quests (224 minutes) and four repeatable contracts (40-minute first circuit) validate against canonical chapters, beats, maps, encounters, prerequisites, objectives, and rewards. Every objective map is journal-reachable; completion applies XP, currency, items, and key items. |
| Camp and loadout | Pass, production-foundation scope | Versioned inventory and vitals support shops, buy/sell, field loot, consumables, equipment restrictions, forge ranks, two-slot Vows, Spirit/status recovery, and three camp tiers. Equipped modifiers adapt campaign-battle profiles and timing. |
| Playtime telemetry | Pass as instrumentation | A clean-start UUID receipt owns its own zero-based narrative, exploration, first-clear combat, repeat grind, and camp/menu time; suspends after 30 seconds without input; records the canonical beat prefix and unique first clears; and seals on campaign completion. Receipt-less historical saves remain unverified. |
| Canonical integrated run | Pass for deterministic reachability | One clean DOM-free run completes 60 beats, 184 dialogue lines, 59 choices, 34/34 route chains, 599 legal field moves, 53 interactions, 41 exits, 23 first clears, and 16 paid safehouse rests. Its stable trace signature is `fnv1a32:79a6adbd`; it records zero fabricated time and therefore correctly fails duration proof. |
| Twenty-hour duration | Unproven | The pacing budget totals 20 hours at 1× and assigns three hours to grinding, but no complete timed playthrough currently proves that the implemented content sustains that duration. |

## Reproducible checks

Run from `game/` unless noted otherwise.

| Check | Command / method | Result |
| --- | --- | --- |
| JavaScript syntax | `npm run check` | Pass across FP-0, Atlas, Battle, Camp, both combat engines, progression, advancement, field, quest, loadout, playtime, and content modules. |
| Unit tests | `npm test` | Pass: 199/199 including nested route, battle, and repeat-grind cases. Coverage includes every encounter/objective family, movement/corner collision, Tempo/recovery, loadout timing, typed damage, deterministic AI, continuous-vitals completion, advancement/reward/rest transactions, field persistence/interactions/hazards/triggers/exits, all-interactable reachability, narrative staging, scene-direction coverage, run receipts, playtime evidence, quest progression/travel, optional-content integrity, map integrity, and 34 canonical route chains. |
| Diff whitespace | `git diff --check` from repository root | Pass for this documentation update. |
| Static delivery | Serve `game/`; request Campaign, query-selected Battle, Camp, runtime/content modules, and runtime atlas | Pass: 18/18 requested URLs returned HTTP 200, including `campaign.html`, `battle.html?encounter=c1-cinder-hounds`, `camp.html`, the canonical-run/solver/receipt/narrative/scene modules, and the party atlas. |
| Cross-page state audit | Read-only source integration audit across Campaign, Battle, and Camp | Pass after fixes: BFCache now reloads Battle authorities, Auto-Grind persists an earned victory before its delayed reveal, completed-scene choices are immutable in replay, all 94 queried DOM IDs resolve, and atlas motion uses one consistent animation clock. |

## Runtime boundaries

1. The battle engine consumes the real encounter and level data. It does not hard-code one showcase enemy. Party stats are derived from the saved advancement profile and victory rewards return to that same versioned profile.

2. Field interactions, hazards, exits, and placed encounter triggers are now persistent runtime behavior. Their Canvas markers and feedback remain production-foundation presentation; this does not mean combat objectives have bespoke escort tokens, node art, hazard overlays, or encounter-specific cut-ins. Several combat objectives still use the generic `Objective` command.

   The integrated run exposed and fixed one sealed-dais topology error in the Kurohana Audience Hall; a permanent world-integrity test now requires every interactable to have a reachable live-range space and every placed encounter to have a reachable open trigger tile.

3. Optional-content validation proves 13 finite quests plus four contracts and a 264-minute authored first-pass estimate. It is not a timed-play receipt. Rewards are atomic across quest, advancement, and loadout saves, and journal travel reaches every objective map; quest markers still use generated Canvas presentation rather than bespoke art.

4. Camp tracks equipment, Vows, consumables, currency, Spirit, statuses, and rest deterministically. Stat, Pace, and Recovery modifiers feed battle profile/engine creation. Full Spirit/status command use inside combat remains a later combat-system extension.

5. First clears remain manual. Auto-Grind is available only on repeats and changes the presentation schedule for intro, moves, skills/objectives/guards, enemy turns, Recovery, result, and reward; engine decisions and rewards are invariant. Manual repeat play only shortens enemy presentation and is labeled accordingly.

6. Cross-page telemetry separates Atlas narrative/exploration, first-clear combat, grind, and Camp time; hidden, resolved-battle, and 30-second-idle periods do not accrue. Duration proof consumes only the same clean-start UUID receipt and requires the time targets, all 60 scenes, and all 23 canonical first clears. No completed run currently satisfies it.

7. The art remains original production reference material plus one provisional transparent directional party atlas used by Camp, field movement, scene focus, and party battle tokens, not final editable frame work. Static HTTP delivery is verified, but no interactive browser-control surface was available in this environment; DOM/canvas click-through, visual comparison, responsive-layout review, and browser-console inspection remain outstanding.

## Next implementation gate

Replace generic combat objective actions with bespoke encounter tokens and presentation, extend Spirit/status effects through combat, complete interactive browser and visual QA, expand measured story/field volume, and run chapter-by-chapter timed playtests. The game is not complete until a normal first playthrough of the implemented build measures about 20 hours at 1×; the deterministic repeat schedule already proves exact speed ratios, but the full player-facing grind loop still needs browser timing and usability observation.
