# Opening-through-Mateus rendered-route receipt

**Audit date:** 2026-07-27  
**Scope:** default compact opening, canonical side-view action combat, Night Census through the Chapter 3 handoff  
**Policy:** rendered controls only; no direct storage mutation or runtime transition calls

## Result

The recovered diagnostic run reached `c3-01-separate-arrivals` after completing all 18 opening beats, the required **Witness, Not Family** after-boss Storyworld consequence, seven canonical action encounters, the Takamine cell lever, and the rain-lit exit.

| Evidence | Result |
| --- | --- |
| Run prefix | `5d286d6b` |
| Final frontier | Sodegaura Lanterns, Scene 1, Separate Arrivals |
| Played-scene receipt | 22 / 82, including required Storyworld scenes |
| Visible active time | 00:17:06 |
| Canonical opening battles | 7 |
| Battle restarts | 0 |
| Console errors at successful handoff | 0 |
| Page errors at successful handoff | 0 |

The 17:06 result is a control-driver lower bound, not evidence that a human will finish in the 30–45-minute target. The driver advances text and inputs more efficiently than an unfamiliar player.

## Action encounter evidence

| Encounter | Seconds | Inputs | Restarts | Lowest reported survivor state |
| --- | ---: | ---: | ---: | --- |
| Ashen Bailiff — River Escape | 17.032 | 40 | 0 | Ren 82 / 122 |
| Flooded Cedars — Cinder Hounds | 7.359 | 56 | 0 | Aya 7 / 89 |
| Flooded Cedars — Ash Wisps | 3.422 | 23 | 0 | Aya 68 / 96 |
| Tithe Hound | 23.906 | 172 | 0 | Aya 13 / 103 |
| Cedar Service Path — mixed group | 6.140 | 39 | 0 | Aya 26 / 110 |
| Flooded Archive | 5.125 | 24 | 0 | Nikola 114 / 141 |
| Father Mateus Avelar | 14.594 | 35 | 0 | Nikola 113 / 149 |

All seven objectives completed. Mateus resolved nonlethally in phase two. The very short automated encounter times and several low survivor ratios are balance-review signals: the route is reachable, but a blind human still needs to establish whether fights feel readable, satisfying, trivial, or abruptly lethal.

## Defects found and closed during the run

1. The campaign battle page padded Ren’s solo Bailiff deployment with an undefined support fighter. Canonical mode now uses the exact authored fighter list, including a one-person deployment.
2. The new Tithe Hound post-fight dialogue gate referenced a nonexistent encounter ID. All opening battle gates now validate against the encounter catalogue.
3. A ready field exit published zero interaction range even though gameplay permits use from one space away. The public route target now matches the real interaction rule.
4. Chapter 2’s terminal route attempted to complete the beat before its required after-beat Storyworld consequence could appear. The exit now commits the route flag, reveals the consequence, and advances only after that scene resolves.
5. Post-fight dialogue could previously be acknowledged before its corresponding fight. Tithe Hound, Flooded Archive, and Mateus aftermath lines now wait for exact encounter-win evidence.

## Proof boundary

This was a UUID-preserving recovery chain used while defects were being repaired, not one uninterrupted run on one immutable commit. It proves that the final repaired frontier can consume the preserved canonical state and reach Chapter 3 through rendered controls. It does not replace:

- a fresh clean-start automated run on the final commit;
- the complete repository test suite;
- the [blind human opening playtest](28-opening-slice-blind-playtest.md);
- subjective review of comprehension, enjoyment, input feel, label/effect overlap, and encounter duration.
