# Top-to-bottom game evaluation and balance pass

**Date:** 2026-07-28

**Build basis:** canonical source at this change set

**Status:** deterministic corrections applied; fresh human playtest and current rendered full-route evidence remain open

This report evaluates the current game as a player route rather than as a catalogue of implemented systems. It combines the shipped Storyworld runtime, canonical campaign and combat witnesses, chapter/duration attribution, the side-view action kernel, and the JRPG Verifiers v2 evidence graph. Arithmetic and automated traces are diagnostic. They do not prove feel, comprehension, cultural quality, or observed playtime.

## Executive read

The game has a coherent identity: an evidence-minded historical gothic JRPG in which victory means separating rescue, accountability, political transfer, and punishment instead of collapsing all four into a boss death. The route systems support that identity unusually well. The main risk is pacing density, not lack of content.

Three conclusions are now firm:

1. The selected-route game and completionist proof are already separate. Shipped New Game creates the 5–6 hour narrative profile; the 215 activities are an optional completionist ledger. That boundary should remain explicit.
2. The canonical route is prose-heavy. Its reference model is 320.552 minutes, of which 262.187 minutes, or 81.8%, are attributed to narrative. Exploration is 30.665 minutes, combat 24.533, and Camp 3.167. The next pacing pass should create contrast and interaction inside long scenes, not add more text.
3. Combat needed minimum cadence, not more simultaneous systems. Several opening action fights ended before their teaching pattern could make a complete visual statement. A separate late tactical defect let Ujiro resolve after four objective commands without requiring his retreat.

## Storyworld balance

The Storyworld is structurally healthy. It tracks 35 bounded properties, keeps route histories distinct, exercises 30 history-sensitive entry options, and retains four reachable final outcomes plus 13 final reaction flows. Salt, Ash, and Paper remain materially different before the last command rather than becoming cosmetic route labels.

The original locked deterministic rehearsal—5,000 runs on each route, 15,000 histories total—produced this global ending distribution:

| Ending | Prior share |
| --- | ---: |
| Accord | 44.55% |
| Revision / civil-war emergency | 25.55% |
| Dawn abdication and seppuku | 13.37% |
| Prepared execution | 16.53% |

The problem was concentrated. Both witnessed return and provisional binding almost automatically selected Accord, even when the earlier history had not earned the same level of institutional trust. The final formulas now make a provisional binding meaningfully sensitive to court pressure, witness safety, network consent, party cohesion, proof integrity, and Nikola's oath revision. Witnessed return also carries a slightly stronger failure inclination when the routes cannot independently verify the transfer.

A locked 15,000-history confirmation sample after the change produced:

| Ending | Current share |
| --- | ---: |
| Revision / civil-war emergency | 37.15% |
| Accord | 32.96% |
| Prepared execution | 16.53% |
| Dawn abdication and seppuku | 13.37% |

This is an improvement, not a final human-balance claim. No ending exceeds the automated 40% domination gate, but Salt still leans heavily toward Revision and Paper toward Accord. That route asymmetry is thematically defensible; whether it feels like earned consequence or route predestination requires players who make intentional choices rather than uniform random selections.

## Level and chapter pacing

The campaign contains 60 beats, 48 authored levels, 60 scene operations with 185 operation nodes, 1,454 canonical field moves, 241 interactions, and 42 exits. That is enough playable structure to braid action through the story. The issue is how often the structure gives way to uninterrupted dialogue advancement.

The canonical script contains 39,294 words across 2,849 dialogue lines. Several scenes are much larger than their neighbors:

- `c9-05-dawn-at-observatory`: 105 lines / 1,418 words
- `c6-04-printmaker-flight`: 51 / 809
- `c3-04-lantern-boat-escort`: 55 / 795
- `c7-01-decision-map-table`: 57 / 767
- `c9-03-conservatory-offers`: 50 / 743

The opening already demonstrates the right correction: dialogue can pause for an exact field interaction and resume as consequence. Apply that grammar selectively to the largest mid- and late-game scenes. Do not mechanically split every scene or delete the strongest lines. Use two or three operation-backed interruptions where discovery, movement, or inspection changes what the next exchange means.

The all-finite chapter ledger remains a completionist diagnostic, not the default player route. Its 1× reference total is 1,244.604 minutes. The largest completionist chapters are Chapter 9 at 192.580 minutes, Chapter 5 at 149.717, Chapter 4 at 141.580, and the epilogue at 133.425. Their size is driven primarily by optional prose catalogues. The player-facing ledger must continue to call these activities optional and must never imply that reading every archive entry is required to see credits.

## Side-view combat tightness

The input foundation is technically strong:

- 20 ms fixed simulation steps
- 100 ms coyote time
- 120 ms jump buffering
- edge-triggered dash, slide, rising attack, and diving kick
- held movement resumes on the exact recovery or maneuver completion step
- shared and move-specific cooldowns remain explicit
- the direct actor and AI support actor retain distinct authority

Holy Water and the Throwing Cross are also in a reasonable tactical relationship. With a 20-Power attacker against 15 Guard at neutral Radiance, ordinary Cut deals 24, Holy Water 30, and the Cross 20. Against a 125% Radiance weakness they deal 38 and 25. Holy Water therefore pays limited stock and close ground placement for armor penetration; the Cross pays some neutral damage for a much longer lane and aerial availability. Current session stock is three waters and two crosses. Neither belongs in campaign inventory settlement.

The pacing defect was enemy durability in the opening side-view conversion. Companions and overlapping action hitboxes concentrate damage far faster than the tactical board values assume. Action-only HP multipliers now preserve tactical HP while keeping each teaching pattern visible. A new deterministic cadence verifier uses a simple close-distance, dash, first-ready-attack policy:

| Encounter | Current duration | Lowest survivor | Result |
| --- | ---: | ---: | --- |
| Cinder Hounds | 13.960 s | 75.00% | Victory |
| Ash Wisps | 7.360 s | 57.63% | Victory |
| Cedar Path mixed group | 15.360 s | 55.08% | Victory |
| Flooded Archive group | 31.560 s | 72.03% | Victory |

These are deterministic regression windows, not ideal human times. They establish that the fights neither disappear immediately nor become attrition walls under a deliberately plain policy. The more capable rendered-control verifier and fresh players should still be timed because combo use, Holy Water, Cross lanes, target selection, and defensive movement materially change the result.

## Tactical rollback and objective integrity

The tactical system remains a useful rollback and verifier surface. Its current chronological witness records 23/23 victories, 239 player commands, 96 enemy activations, zero party knockouts, and no balance-limit violations.

Ujiro was the clearest content defect. `disableOrdersAndProtect` previously treated objective completion as sufficient combat completion. Four objective commands could therefore end the named boss encounter after one hostile action. The objective family now requires both every tribunal action and the primary boss's forced retreat. The current trace is:

- 18 player commands
- 3 enemy activations
- 4 objective commands
- 10 skill commands
- 4 Guard commands
- 22.2222% Guard share

The solver also stops focus-firing non-required enemies while a protection encounter is waiting on an automatic survival condition. This keeps automated evidence aligned with the authored objective instead of turning every scenario into defeat-all.

Remaining tactical pacing concerns are visible rather than hidden: Yearless Bell still resolves in four objective commands and one enemy activation, while Kurozane uses 31 Guard commands in a 50-command trace. Those may be acceptable as a short prelude and resource cadence, respectively, but they are the first late-game cases to observe with humans.

## Game-flow assessment

The current product boundary is healthier than the old 215-activity description implied:

- New Game creates a narrative run receipt.
- Selected-route canonical scenes and Storyworld decisions determine story completion.
- Five hours of active play is the narrative proof floor.
- Completionist progress is displayed separately and remains optional.
- The 20-hour/215-activity contract is a distinct completionist evidence profile.

Do not merge those profiles. The canonical reference estimate of 320.552 minutes sits inside the intended 5–6 hour band before a fresh human timing run. The main flow concern is not route length but texture: 2,849 individual dialogue advances can flatten urgency if the interface and scene operations do not provide rhythm.

The next content pass should prioritize:

1. interaction breaks inside the five longest scenes;
2. silence, ambient barks, unfinished speech, and task-focused lines as contrast to the polished literary cadence;
3. a full current action route through Acts III–V;
4. a small human wave that explains why damage occurred and what each Camp choice changed;
5. a second human wave after the clearest corrections.

## Applied changes and verification

This pass changed production state in four bounded ways:

- rebalanced final Storyworld inclinations without adding properties, endings, or schema;
- added action-only opening HP cadence scalars and a DOM-free pacing audit;
- made Ujiro's tactical retreat part of combat completion;
- updated canonical duration, chapter pacing, signatures, and QA evidence to match the new route.

Reproduction:

```powershell
node game/action-combat-pacing-audit.mjs
node game/combat-balance-audit.mjs
node game/storyworld-balance-audit.mjs --runs 5000 --seed 42
python C:\Users\patri\.codex\skills\storyworld-building\scripts\sweepweave_validator.py validate storyworlds\bells-black-chrysanthemum.storyworld.json
node --test game\tests
cd jrpg-verifiers-v2
npm test
npm run report
```

The release-readiness verdict remains partial until fresh human findings and staffing/cultural review gates are satisfied. Automated success should not promote those nodes.
