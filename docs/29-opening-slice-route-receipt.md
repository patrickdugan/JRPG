# Opening-through-Mateus rendered-route receipt

**Audit date:** 2026-07-27  
**Scope:** default compact opening, canonical side-view action combat, Night Census through the Chapter 3 handoff  
**Policy:** rendered controls only; no direct storage mutation or runtime transition calls

## Current result

A fresh clean-start run completed all 18 opening beats, the required **Witness, Not Family** after-boss Storyworld consequence, seven canonical action encounters, the Takamine cell lever, and the rain-lit exit. The driver returned `target-reached` only after the Campaign published the exact requested frontier, `c3-01-separate-arrivals`; it did not depend on a scene-count coincidence or play any part of Chapter 3.

| Evidence | Result |
| --- | --- |
| Run prefix | `41236c32` |
| Final frontier | Sodegaura Lanterns, Scene 1, Separate Arrivals |
| Played-scene receipt | 22 / 82, including the required Storyworld consequence |
| Visible active time | 00:11:07 |
| Driver wall time | 898.407 seconds |
| Rendered control activations | 2,336 |
| Field moves | 989 |
| Battle commands | 961 |
| Canonical opening battles | 7 |
| Battle restarts | 0 |
| Console errors | 0 |
| Page errors | 0 |

The active-time result is a control-driver lower bound, not proof that an unfamiliar human will finish in the 30–45-minute target. The driver advances dialogue and enters controls much faster than a first-time player.

## Action encounter evidence

| Encounter | Seconds | Inputs | Restarts | Final state |
| --- | ---: | ---: | ---: | --- |
| Ashen Bailiff — River Escape | 16.578 | 75 | 0 | Ren 102 / 122 |
| Flooded Cedars — Cinder Hounds | 10.531 | 100 | 0 | Ren 73 / 131 |
| Flooded Cedars — Ash Wisps | 9.688 | 61 | 0 | Ren 133 / 140 |
| Tithe Hound | 62.235 | 559 | 0 | Frantic phase; Ren 136 / 149 |
| Cedar Service Path — mixed group | 8.360 | 67 | 0 | Ren 131 / 158 |
| Flooded Archive | 5.765 | 17 | 0 | Nikola 112 / 141; Ren 132 / 167 |
| Father Mateus Avelar | 24.406 | 82 | 0 | Phase 3; Nikola 101 / 149; Ren 110 / 176 |

All seven objectives completed without a restart. Combat totaled 137.563 seconds; the median encounter was 10.531 seconds and the longest was 62.235 seconds. Mateus withheld Blood Ward and Crimson Litany during phase one, entered the ward phase at 55% HP, and resolved nonlethally in phase three.

The early canonical formation now presents Ren as the active fighter and Aya as visible reserve healing. Nikola’s arrival introduces the two-character tag formation later in the opening. This follows the intended party roles and prevents the healer from being treated as a frame-zero melee target.

## Tithe Hound balance evidence

The initial route exposed three interacting defects: top-down X coordinates had projected Aya only 12 pixels from the Hound, early canonical deployment treated the passive healer as a front-line target, and Aya’s reserve heal was weaker than her on-field passive. The corrected action layout starts the threat at least two side-view tiles beyond the party, keeps Aya in reserve, and uses one consistent 12% heal every 1.6 seconds below 85% HP.

A five-trial, fresh-context, rendered-control soak then produced:

- 5 / 5 victories;
- 0 restarts;
- 0 console or page errors;
- 40.360-second median;
- 27.641–72.641-second observed range;
- surviving Ren between 99 / 131 and 115 / 131 HP.

The latest full opening route completed the Hound in 62.235 seconds with Ren at 136 / 149 HP, inside the prior five-trial soak range. A blind human should still be observed for telegraph comprehension and perceived challenge, but the prior repeated-loss spike is no longer present in automated evidence.

## Automated regression evidence

- `npm run check`: passed.
- Full test run with four-way concurrency and forced runner exit: 1,219 passed, 0 failed, 0 skipped.
- Focused ready-gate, combat-page, route-policy, and browser-probe source run: 29 passed, 0 failed.
- Installed-Chrome action probe: passed with zero restarts and empty console, page-error, and delivery-error arrays.
- The full run covers action combat, the turn-based rollback, side-view start-spacing contracts, Aya’s active and reserve healing, both Mateus victory routes, and the blind-test launcher source.

## Focused first-play presentation evidence

The opening now enters an opening-only focus layout. It places the current story card and its visible **Continue dialogue** control before the field map in both visual and document order, hides the chapter ledger, future-party card, journals, and irrelevant encounter rail, and retains the Camp link because recovery is part of the playable loop. The top prompt describes only the next action: read with `N`, follow a gold marker, interact with `X`, enter the named encounter, use the route exit, or continue to the next scene. Player mode no longer displays the 30–45-minute QA target, first-clear telemetry, average level, or state-machine terminology.

A fresh browser inspection measured the story card at viewport Y 399 and the map at Y 723 on clean start. At the first cadence gate, the prompt changed to **“Inspect the suspicious seal to continue”**, with the story at Y 109 and the map immediately below at Y 434. The story card was also the scene heading’s next DOM sibling, so keyboard and assistive reading order matched the visible order.

Clean run `b855ed5a` then traversed the focused presentation through the Chapter 3 handoff and continued into the following campaign before its deliberately bounded 720-second route budget expired:

- all seven opening action encounters cleared;
- 0 battle restarts;
- 110.142 seconds total combat;
- 12.438-second median and 38.875-second longest encounter;
- Mateus reached `phase-3`;
- 0 console errors and 0 page errors.

The time-budget status occurred after the opening had completed and the driver had continued beyond the slice. It is therefore supplemental evidence that the presentation wave preserved opening reachability, not a full-campaign completion receipt or human timing claim.

## First-clear battle ready gate

Every canonical opening first clear now pauses before simulation and places one prominent **Begin encounter** control over the battle stage. The fight card remains visible above it, the state badge reads **READY**, keyboard Enter/Space and controller A/B work, and replay or non-opening encounters retain immediate start behavior. The unavailable Hunter–Priest combination panel and shortcuts remain hidden until the actual Nikola/Mateus formation exists, so Ren’s first lesson does not advertise an unexplained future character.

The installed-Chrome probe held the opening gate for 500 ms and observed:

- kernel time unchanged at exactly 0 ms;
- `introReady: false`, `paused: true`, and state badge **READY**;
- future-combo presentation hidden;
- a visible Begin activation changing `introReady` to true before canonical combat;
- zero restarts and a committed victory transaction with Continue unlocked;
- zero console, page, or HTTP delivery errors.

The exact opening route then crossed all seven first-clear gates through their rendered Begin controls before reaching the Chapter 3 handoff. This proves the gate does not deadlock automated reachability; human reading time and comprehension remain part of the blind-test requirement.

## Blind-test endpoint evidence

`PLAYTEST_OPENING.cmd` now starts a run-bound, session-only feedback record alongside the clean New Game. It remains hidden throughout the opening. Once all 18 scenes, seven first clears, the cell lever, rain-lit exit, and after-boss consequence are complete, the Campaign:

- locks Chapter 3 advancement for that test tab;
- records candidate commit, clean-run ID, active time, real elapsed time, and opening-battle restarts;
- asks the seven unprompted comprehension questions from the blind-test protocol;
- records all eight 1–5 experience ratings plus prior exposure, outside help, best/confusing/memorable moments, and willingness to continue;
- downloads one self-contained `bells-opening-playtest-*.json` receipt;
- marks only mechanical checks automatically and retains `verdict: "human-review-required"`.

A fresh installed-Chrome rendered-control run exercised the complete endpoint path without storage injection or runtime transition calls:

| Evidence | Result |
| --- | --- |
| Route status | `opening-feedback-exported` |
| Opening scenes | 18 / 18 |
| Canonical action battles | 7 |
| Battle restarts | 0 |
| Driver wall time | 542.375 seconds |
| Machine active / session wall time | 332,658 / 476,003 ms |
| Compact viewport | 390 × 844 |
| Panel / first textarea / submit widths | 374 / 310 / 340 px |
| Console / page errors | 0 / 0 |
| Receipt kind | `bells-opening-blind-playtest-evidence` |
| Receipt verdict | `human-review-required` |

The synthetic form answers exist only to verify input, download, serialization, and compact geometry. Their deliberately short machine active time fails the 30–45-minute check, and their text is not comprehension evidence.

## Defects closed by the opening-slice pass

1. Ren’s solo Bailiff deployment no longer receives an undefined support fighter.
2. Tithe Hound, Flooded Archive, and Mateus aftermath dialogue requires exact encounter-win evidence.
3. The Takamine terminal exit can reveal and resolve its required after-beat consequence without deadlocking.
4. Published field exits use the same exact-tile rule as the runtime.
5. Mateus can no longer summon victory-condition wards during phase one.
6. Breaking both living Blood Wards after phase two enters the authored surrender phase before victory is presented.
7. Turn-based and action combat share the same canonical Blood Ward objective keys.
8. Opening action battles use authored left-to-right starts rather than overlapping top-down projections.
9. Aya stays in reserve during the early canonical fights, heals at the same cadence as her active passive, and remains available in Action Lab for explicit testing.
10. `PLAYTEST_OPENING.cmd` opens a clean local candidate while giving the tester only the permitted one-sentence instruction.
11. Opening first clears no longer simulate enemy attacks while a new player is reading the fight card.
12. Solo opening formations no longer expose the unavailable Hunter–Priest combo.
13. The rendered-control verifier can stop on the exact published Chapter 3 handoff instead of overshooting the slice.
14. The blind-test launcher now preserves build/run/timing/restart evidence and collects endpoint feedback without exposing the observer protocol.
15. The downloaded receipt refuses to auto-grade prose or declare the slice polished without human review.

## Proof boundary

This clean run proves current opening reachability, browser stability, zero-restart automated combat, and the corrected Mateus phase path through rendered controls. It does not prove:

- that an uninvolved human understands the plot, controls, or objectives without documentation;
- that the slice is enjoyable;
- that human completion time falls inside 30–45 minutes;
- final visual, audio, accessibility, or cultural quality.

Those claims remain gated by the [blind human opening playtest](28-opening-slice-blind-playtest.md).
