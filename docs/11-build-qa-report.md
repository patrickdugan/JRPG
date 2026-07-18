# Expanded Campaign Build — QA Report

Integration audit: 2026-07-17. This report distinguishes implemented runtime behavior from the still-unproven 20-hour playtime target.

## Result

| Area | Status | Evidence |
| --- | --- | --- |
| Campaign content | Pass | 11 chapters, 60 beats, 46 named map references, 48 level kits, and 23 encounter kits. Every map and encounter resolves. |
| Campaign path | Pass | Every encounter is bound to exactly one canonical story beat. The Atlas blocks forward progress until that beat’s required first clears are recorded. |
| Shared combat | Pass, production-foundation scope | All 23 encounters instantiate in the multi-party engine with exact movement, Pace, readiness/recovery, delivery and essence multipliers, Guard, Analyze, deterministic enemy AI, and terminal results. |
| Objective families | Pass, generic presentation | All 18 authored objective types have explicit requirements/actions, including escape, escort, release, protect, rescue, relay, node, evacuation, and noncombat interaction contracts. Bespoke tokens, hazards, and encounter cinematics remain to be rendered. |
| Advancement and grinding | Pass | Six characters have deterministic XP/stat growth to level 50. First clears grant unique authored loot; repeat victories grant diminishing XP/currency. A saved 1×/2×/4× control accelerates enemy/recovery presentation. |
| Twenty-hour duration | Unproven | The pacing budget totals 20 hours at 1× and assigns three hours to grinding, but no complete timed playthrough currently proves that the implemented content sustains that duration. |

## Reproducible checks

Run from `game/` unless noted otherwise.

| Check | Command / method | Result |
| --- | --- | --- |
| JavaScript syntax | `npm run check` | Pass across FP-0, Campaign Atlas, Campaign Battle, both combat engines, progression, advancement, and content modules. |
| Unit tests | `npm test` | Pass: 50/50. Includes all encounter instantiation, all objective families, movement/corner collision, Tempo/recovery, typed damage, deterministic AI, XP/rewards, chapter catch-up, level-target attainability, save validation, beat bindings, map integrity, and exit reachability. |
| Diff whitespace | `git diff --check` from repository root | Pass at integration time. |
| Static delivery | Serve `game/`; request Atlas, Battle, JS/CSS modules, content, and art | Pass: eleven runtime/content/art URLs returned HTTP 200, including a query-selected campaign encounter. |

## Runtime boundaries

1. The battle engine consumes the real encounter and level data. It does not hard-code one showcase enemy. Party stats are derived from the saved advancement profile and victory rewards return to that same versioned profile.

2. Objective actions are mechanically distinct and validated, but several currently use a generic `Objective` command rather than bespoke map objects, escort-token animation, hazard overlays, or encounter-specific cut-ins. This is acceptable scaffolding, not final encounter presentation.

3. Battle speed changes presentation delay while command menus stay paused and turn-based. It is intended for repeat grinding and does not skip authored story scenes or first-clear content.

4. The art remains original production reference material, not final editable sprite sheets. No interactive browser-control surface was available in this environment; DOM/canvas click-through and visual console inspection remain outstanding.

## Next implementation gate

Replace generic objective actions with level-resident tokens and authored interactions, connect field exits and encounter triggers directly instead of using Atlas buttons, implement hazards/statuses/healing/Spirit/Vows/gear, and run chapter-by-chapter timed playtests. The goal is complete only when a normal first playthrough of the implemented build measures about 20 hours at 1× and the speed controls measurably shorten repeat grinding.
