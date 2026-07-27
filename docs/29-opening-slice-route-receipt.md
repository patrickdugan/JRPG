# Opening-through-Mateus rendered-route receipt

**Audit date:** 2026-07-27  
**Scope:** default compact opening, canonical side-view action combat, Night Census through the Chapter 3 handoff  
**Policy:** rendered controls only; no direct storage mutation or runtime transition calls

## Current result

A fresh clean-start run completed all 18 opening beats, the required **Witness, Not Family** after-boss Storyworld consequence, seven canonical action encounters, the Takamine cell lever, and the rain-lit exit. It stopped at the requested scene limit on `c3-01-separate-arrivals`.

| Evidence | Result |
| --- | --- |
| Run prefix | `e8ee6b00` |
| Final frontier | Sodegaura Lanterns, Scene 1, Separate Arrivals |
| Played-scene receipt | 22 / 82, including the required Storyworld consequence |
| Visible active time | 00:06:23 |
| Driver wall time | 553.437 seconds |
| Rendered control activations | 1,974 |
| Field moves | 989 |
| Battle commands | 606 |
| Canonical opening battles | 7 |
| Battle restarts | 0 |
| Console errors | 0 |
| Page errors | 0 |

The active-time result is a control-driver lower bound, not proof that an unfamiliar human will finish in the 30–45-minute target. The driver advances dialogue and enters controls much faster than a first-time player.

## Action encounter evidence

| Encounter | Seconds | Inputs | Restarts | Final state |
| --- | ---: | ---: | ---: | --- |
| Ashen Bailiff — River Escape | 18.344 | 50 | 0 | Ren 102 / 122 |
| Flooded Cedars — Cinder Hounds | 12.422 | 71 | 0 | Ren 37 / 131 |
| Flooded Cedars — Ash Wisps | 4.094 | 20 | 0 | Ren 114 / 140 |
| Tithe Hound | 32.797 | 248 | 0 | Frantic phase; Ren 120 / 149 |
| Cedar Service Path — mixed group | 9.500 | 81 | 0 | Ren 137 / 158 |
| Flooded Archive | 7.141 | 40 | 0 | Nikola 100 / 141; Ren 123 / 167 |
| Father Mateus Avelar | 27.734 | 96 | 0 | Phase 3; Nikola 101 / 149; Ren 125 / 176 |

All seven objectives completed without a restart. Combat totaled 112.032 seconds; the median encounter was 12.422 seconds and the longest was 32.797 seconds. Mateus withheld Blood Ward and Crimson Litany during phase one, entered the ward phase at 55% HP, and resolved nonlethally in phase three.

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

The subsequent full opening route completed the Hound in 32.797 seconds with Ren at 120 / 149 HP. A blind human should still be observed for telegraph comprehension and perceived challenge, but the prior repeated-loss spike is no longer present in automated evidence.

## Automated regression evidence

- `npm run check`: passed.
- Full test run with four-way concurrency and forced runner exit: 1,204 passed, 0 failed, 0 skipped.
- Focused opening-combat and launcher run: 72 passed, 0 failed.
- The full run covers action combat, the turn-based rollback, side-view start-spacing contracts, Aya’s active and reserve healing, both Mateus victory routes, and the blind-test launcher source.

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

## Proof boundary

This clean run proves current opening reachability, browser stability, zero-restart automated combat, and the corrected Mateus phase path through rendered controls. It does not prove:

- that an uninvolved human understands the plot, controls, or objectives without documentation;
- that the slice is enjoyable;
- that human completion time falls inside 30–45 minutes;
- final visual, audio, accessibility, or cultural quality.

Those claims remain gated by the [blind human opening playtest](28-opening-slice-blind-playtest.md).
