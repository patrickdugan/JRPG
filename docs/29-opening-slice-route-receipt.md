# Opening-through-Mateus rendered-route receipt

**Audit date:** 2026-07-27  
**Scope:** default compact opening, canonical side-view action combat, Night Census through the Chapter 3 handoff  
**Policy:** rendered controls only; no direct storage mutation or runtime transition calls

## Current result

A fresh clean-start run completed all 18 opening beats, the required **Witness, Not Family** after-boss Storyworld consequence, seven canonical action encounters, the Takamine cell lever, and the rain-lit exit. It stopped at the requested scene limit on `c3-01-separate-arrivals`.

| Evidence | Result |
| --- | --- |
| Run prefix | `f1cae07c` |
| Final frontier | Sodegaura Lanterns, Scene 1, Separate Arrivals |
| Played-scene receipt | 22 / 82, including the required Storyworld consequence |
| Visible active time | 00:06:18 |
| Driver wall time | 554.125 seconds |
| Rendered control activations | 2,143 |
| Field moves | 989 |
| Battle commands | 773 |
| Canonical opening battles | 7 |
| Battle restarts | 2, both during Tithe Hound |
| Console errors | 0 |
| Page errors | 0 |

The active-time result is a control-driver lower bound, not proof that an unfamiliar human will finish in the 30–45-minute target. The driver advances dialogue and enters controls much faster than a first-time player.

## Action encounter evidence

| Encounter | Seconds | Inputs | Restarts | Final state |
| --- | ---: | ---: | ---: | --- |
| Ashen Bailiff — River Escape | 23.453 | 54 | 0 | Ren 82 / 122 |
| Flooded Cedars — Cinder Hounds | 9.250 | 58 | 0 | Ren 35 / 131; Aya down |
| Flooded Cedars — Ash Wisps | 3.735 | 26 | 0 | Ren 110 / 140; Aya 68 / 96 |
| Tithe Hound | 77.438 | 339 | 2 | Frantic phase; Ren 57 / 149; Aya down |
| Cedar Service Path — mixed group | 10.656 | 93 | 0 | Ren 95 / 158; Aya 6 / 110 |
| Flooded Archive | 7.078 | 59 | 0 | Nikola 103 / 141; Ren 123 / 167 |
| Father Mateus Avelar | 35.859 | 144 | 0 | Phase 3; Nikola 102 / 149; Ren 85 / 176 |

All seven objectives completed. Combat totaled 167.469 seconds; the median encounter was 10.656 seconds. Mateus now withholds Blood Ward and Crimson Litany during phase one, enters the ward phase at 55% HP, and resolves nonlethally in phase three. This replaces the earlier ten-second automated result that incorrectly ended during phase one.

The Tithe Hound is the principal blind-playtest watch item. Its 77.438-second run, two automated restarts, and downed Aya show that the encounter can become a genuine difficulty spike. This is not by itself proof of a player-facing defect, but the human observer should record whether the boss feels readable and recoverable or merely punishing.

## Automated regression evidence

- `npm run check`: passed.
- Full test run with four-way concurrency and forced runner exit: 1,201 passed, 0 failed, 0 skipped.
- Focused Mateus, objective, and combat compatibility run after canonicalizing the ward progress keys: 61 passed, 0 failed.
- The full run covers both action combat and the turn-based rollback. Both now consume the canonical `break:blood-ward-*` objective keys.

## Defects closed by the opening-slice pass

1. Ren’s solo Bailiff deployment no longer receives an undefined support fighter.
2. Tithe Hound, Flooded Archive, and Mateus aftermath dialogue requires exact encounter-win evidence.
3. The Takamine terminal exit can reveal and resolve its required after-beat consequence without deadlocking.
4. Published field exits use the same exact-tile rule as the runtime.
5. Mateus can no longer summon victory-condition wards during phase one.
6. Breaking both living Blood Wards after phase two now enters the authored surrender phase before victory is presented.
7. Turn-based and action combat now share the same canonical Blood Ward objective keys.

## Proof boundary

This clean run proves current opening reachability, browser stability, and the corrected Mateus phase path through rendered controls. It does not prove:

- that an uninvolved human understands the plot, controls, or objectives without documentation;
- that the slice is enjoyable;
- that human completion time falls inside 30–45 minutes;
- that Tithe Hound’s difficulty spike is fair;
- final visual, audio, accessibility, or cultural quality.

Those claims remain gated by the [blind human opening playtest](28-opening-slice-blind-playtest.md).
