# Expanded Campaign Build — QA Report

Final integration audit: 2026-07-16. This report separates the authored campaign foundation from the fully executable FP-0 combat proof so the project does not overstate its playable scope.

## Result

| Area | Status | Evidence |
| --- | --- | --- |
| Campaign content | Pass | 11 chapters, 60 beats, 46 named map references, 48 level kits, and 23 encounter kits. Every campaign map reference resolves. |
| Field Atlas | Pass, bounded scope | `campaign.html` renders the authored sequence, saves validated progress, resolves all map data, and supports exact collision-aware one-space movement with strict diagonal corner checks. |
| FP-0 combat proof | Pass | One executable Bell Court encounter covers the core Pace, recovery, Guard/Dodge, resistance, deterministic enemy, victory, defeat, and restart loop. |
| Save/progression model | Pass | Seven deterministic tests cover canonical navigation, choices, reset, serialization validation, and unavailable/corrupt local storage. |
| Full 20–25 hour runtime | Not complete | The campaign’s routes, scenes, maps, encounter rules, art references, and progression are authored; its individual battles have not yet been connected to a shared multi-party battle runner. |

## Reproducible checks

Run from `game/` unless noted otherwise.

| Check | Command / method | Result |
| --- | --- | --- |
| JavaScript syntax | `npm run check` | Pass. Checks FP-0, Campaign Atlas, progression, campaign, levels, and encounter modules. |
| Unit tests | `npm test` | Pass: 26/26. Campaign content and world integrity: 6; FP-0 engine: 13; progression: 7. |
| Diff whitespace | `git diff --check` from repository root | Pass. |
| Content cross-reference | Import campaign, levels, and encounters; verify beat/map IDs, campaign map IDs, exit targets, encounter level IDs, static deployment coordinates, and exit reachability | Pass: 60/60 beats and 46/46 map references resolve; zero invalid exits, encounter-level links, blocked/out-of-bounds deployments, or unreachable exits. |
| Static delivery smoke | Serve `game/` and request `campaign.html`, JS/CSS modules, and each production reference-art file | Pass: ten requested URLs returned HTTP 200. |

## Scope notes

1. Every Atlas scene has an explicit resolving `mapId`. The Atlas is intentionally chapter-based, not a metroidvania. It never auto-advances a scene when the party marker reaches an exit; the exit is an authored field cue and narrative progression remains explicit.

2. Field movement is precise by design: W/A/S/D moves one orthogonal space; Q/E/Z/C moves one diagonal space only when the destination and both cardinal corner spaces are open. Repeated keydown events are ignored.

3. The production art is original reference material with reproducible prompts and source limitations documented in [the production-art README](../assets/production/README.md). It is not represented as final editable sprite-sheet output.

4. No interactive browser surface was available in this execution environment for a visual click-through or console inspection. Automated, data, syntax, unit, and static HTTP verification remain the evidence recorded here.

## Next implementation gate

Reuse the proven FP-0 rules engine behind an encounter adapter that consumes `content/encounters.mjs`, then connect chapter route exits, hazards, rewards, and multi-party combat state to progression. That is the remaining work required to turn the authored campaign foundation into the intended full game.
