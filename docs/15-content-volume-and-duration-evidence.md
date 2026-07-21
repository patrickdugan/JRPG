# Content Volume and Duration Evidence

**Audit date:** 2026-07-18

**Target:** a normal first playthrough near 20 active hours at 1×, with faster repeat grinding at 2×/4×

**Current proof status:** unproven

This document separates three things that are easy to conflate:

1. authored duration declarations in planning data;
2. arithmetic estimates derived from shipped content quantities;
3. observed active playtime from a clean completed run.

Only the third can prove the duration target. The first two remain production planning and gap-finding evidence.

## Shipped finite campaign quantities

The DOM-free canonical runner starts every save authority from its pristine constructor, executes public story, field, operation, combat, reward, camp, and receipt transitions, and records zero time.

| Quantity | Exact shipped result |
| --- | ---: |
| Chapters / canonical beats | 11 / 60 |
| Full dialogue | 2,768 lines / 38,243 counted words |
| Canonical selected decisions | 59 |
| Story operations | 60 / 60 complete |
| Once-per-save operation nodes | 183 / 183 complete |
| Combined exact field movement | 1,428 legal steps |
| Combined field interactions | 236 |
| Authored exits | 41 |
| Canonical first clears | 23 / 23 |
| Player combat commands | 228 |
| Enemy activations | 100 |
| Safehouse rests | 16 |
| Recorded playtime | 0 ms |

The combined 1,428-step result is the useful traversal quantity. The standalone operation-placement audit reports 919 shortest-path steps when each beat starts at its spawn, but adding 919 to the old route-only total would double-count shared paths. The current runner traverses operations and exits in one route and therefore measures their actual deterministic combination.

Canonical trace signature: `fnv1a32:462b7ff8`.

## Finite optional-content completion

The finite-content runner begins from the canonical zero-time result and completes optional state transitions through their public APIs.

| Quantity | Exact result |
| --- | ---: |
| Finite side stories | 13 / 13 |
| Side-story objectives | 59 / 59 |
| Witness chronicles | 18 / 18 |
| Testimony acknowledgements | 288 / 288 |
| Witness stages | 67 / 67 |
| Witness fieldwork nodes traversed | 152 / 152 |
| Fresh-context exact movement steps | 729 / 729 |
| Atomic finite reward settlements | 31 |
| Replay refusals | 31 completions / 62 refused attempts |
| Repeat contracts included | 0 |
| Recorded playtime | 0 ms |

The 729 witness steps are both the deterministic minimum across 67 fresh stage contexts and the exact count executed by `witness-fieldwork-run.mjs` through the public one-step field runtime. The traversal reaches all 152 ordered nodes with zero coordinate jumps and records no elapsed time. Its isolated witness excludes repeat contracts; the separate intended-route contract below requires one measured circuit of each of the four repeatable contracts.

## Finite companion-conversation completion

The camp-conversation runner begins from the same canonical zero-time result and completes the entire ordered catalogue through public runtime transitions.

| Quantity | Exact result |
| --- | ---: |
| Unordered party pairings | 15 / 15 |
| Finite conversations | 90 / 90 |
| Main dialogue acknowledgements | 3,644 / 3,644 |
| Authored response lines across both branches | 540 |
| Selected first-branch response acknowledgements | 270 / 270 |
| Explicit choices | 90 |
| Complete-catalogue words | 83,460 |
| Canonical visible words | 76,572 |
| Successful runtime transitions | 4,094 |
| Replay refusals | 90 / 90 |
| Recorded playtime | 0 ms |

The visible-word count includes titles, themes, prompts, both option labels, every main line, the selected first response, and its consequence summary. It excludes the unseen alternate response. Prose-bound catalogue signature: `fnv1a32:a3a22f12`; completion signature: `fnv1a32:2fb89621`.

## Finite party-council completion

The party-council runner opens each join-safe multi-character scene at its exact story beat and camp, records one explicit decision, and refuses replay without granting progression value.

| Quantity | Exact result |
| --- | ---: |
| Finite councils | 30 / 30 |
| Main dialogue acknowledgements | 993 / 993 |
| Authored response lines across both branches | 180 |
| Selected first-branch response acknowledgements | 90 / 90 |
| Authored options / explicit decisions | 60 / 30 |
| Complete-catalogue words | 27,506 |
| Canonical visible words / dialogue lines | 25,072 / 1,083 |
| Successful runtime transitions | 1,143 |
| Replay refusals / trace events | 30 / 1,174 |
| Recorded playtime | 0 ms |

The visible path counts each title, theme, prompt, both displayed option labels, every multi-character main line, the selected first response, and its consequence summary. It excludes the unseen alternative response. Prose-bound catalogue signature: `fnv1a32:10ab0f26`; completion signature: `fnv1a32:0bd87a13`.

## Finite public-archive completion

The public reading table opens one record after every canonical beat. Its runner acknowledges the complete visible catalogue without granting a reward or recording elapsed time.

| Quantity | Exact result |
| --- | ---: |
| Beat-bound public records | 60 / 60 |
| Substantial paragraphs | 498 / 498 |
| Visible record words | 31,284 |
| Successful runtime transitions | 558 |
| Replay refusals | 60 / 60 |
| Trace events | 619 |
| Recorded playtime | 0 ms |

Each visible record word belongs to its title, form, custodian, access note, or paragraph. Prose-bound catalogue signature: `fnv1a32:92ea7832`; completion signature: `fnv1a32:c61b184f`.

## Intended-route contract

`game/required-route-contract.mjs` turns the all-finite content set into one exact chronological itinerary rather than assuming that a player happens to find every optional menu. It covers all 60 canonical beats and requires 215 activities:

| Required activity | Count |
| --- | ---: |
| Finite side quests | 13 |
| Witness chronicles | 18 |
| Companion conversations | 90 |
| Party councils | 30 |
| Public archive records | 60 |
| One-circuit repeat milestones | 4 |
| **Total** | **215** |

Each activity must be entered when its exact unlock beat becomes available. The player-facing ledger exposes the next due entries as buttons: quests and chronicles enter their exact field route, while companion talks, councils, and records carry a validated activity ID into Camp, select the required rest point and surface, and begin that entry from the same explicit player action. A witness chronicle may then pause until its later canonical-combat evidence frontier, but it cannot be silently deferred past the route contract. The four repeat milestones require one repeat victory apiece; 1×/2×/4× changes their presentation schedule only, not decisions or rewards. The final credits gate requires completed evidence for all 215 activities, not merely entry, and the run receipt stays active through final-beat camp content until credits are explicitly completed.

The deterministic required-route runner audits chronology, finite completion, replay refusal, the four repeat outcomes, speed-invariant decisions/rewards, and all 729 exact witness-fieldwork steps while recording zero elapsed time. This proves legal runtime traversal, not human route comprehension, controller feel, or elapsed duration.

## Quantity-based duration audit

Duration audit v8 applies exposed low/reference/high assumptions to shipped words, line advances, choices, combined canonical movement, interactions, exits, combat decisions, rests, finite objectives, witness fieldwork, companion talks, party councils, and public archive readings. Authored chapter, quest, chronicle, and contract-minute declarations are excluded. The intended route adds only the actual engine scheduler output for its four required repeat wins; open-ended repeats are excluded.

| Scenario | Canonical only | Canonical + quests/chronicles | Intended all-finite route |
| --- | ---: | ---: | ---: |
| Low | 188.936 min / 3.15 h | 225.645 min / 3.76 h | 779.587 min / 12.99 h |
| Reference | 312.481 min / 5.21 h | 396.929 min / 6.62 h | 1,236.311 min / 20.61 h |
| High | 504.237 min / 8.40 h | 697.827 min / 11.63 h | 1,924.351 min / 32.07 h |

The canonical-only column is the 60-beat story, required traversal, first clears, and canonical rests. “Canonical + quests/chronicles” adds the 13 finite side quests and 18 witness chronicles. The intended all-finite column adds all 90 talks, 30 councils, 60 archive records, final-beat pre-credits content, and the four one-circuit repeat milestones. The 1× reference model clears 20 hours by 36.311 minutes; the canonical-only reference model is about 5.21 hours, so no critical-path-only 20-hour claim is supportable.

| Repeat presentation speed | Intended-route reference estimate |
| --- | ---: |
| 1× | 1,236.311 min |
| 2× | 1,235.998 min |
| 4× | 1,235.841 min |

Only the four repeat schedules accelerate. The reference assumptions include 180 reading words per minute, 0.8 seconds per dialogue advance, 0.35 seconds per field step, 5 seconds per interaction, 4 seconds per player combat command, and explicit finite-objective handling time. These are editable model inputs, not confidence intervals and not observed behavior. Crossing 20 hours is a sensitivity result for the complete intended route, not proof that a player reads or acts at those rates.

## What can prove 20 hours

The versioned run receipt begins only beside pristine campaign and advancement state, uses a run UUID across pages, suspends samples while hidden or after 30 seconds without input, and requires:

- all 60 canonical beats completed in order;
- all 23 canonical first clears recorded once;
- all 215 intended-route activities completed before the credits gate will seal the run;
- explicit completion of the credits after final-beat content;
- at least 1,200 active minutes belonging to the same clean run.

A story-complete receipt remains active, allowing final-beat talks, council, and archive reading to accrue before the player explicitly completes credits. A deterministic completion trace cannot satisfy the time requirement because it calls no playtime transition. Campaign, Battle, Camp, and Credits attach their clean-run samples to the current canonical chapter. Credits exposes the live five-category and eleven-chapter ledger before sealing, then can export a signed schema-v2 JSON snapshot with run identity, receipt revision, category/chapter timing, checkpoint signature and per-chapter deltas, story and first-clear evidence, all six required-route activity types, remaining IDs, and a fail-closed release-target verdict. All three run-bound narrative ledgers must carry the receipt UUID and attributed chapter time must equal total time, or the combined verdict remains false. The signature detects accidental report drift but is not cryptographic or independent attestation. A release claim still needs a witnessed human playthrough; the ledger and export supply its chapter-level timing record.

### Chapter pacing checkpoints

The build audit re-attributes the reference scenario's shipped quantities to their canonical chapter: dialogue by scene or unlock beat, exact canonical and witness movement by trace, interactions and exits by beat, first-clear commands/activations/rests by encounter trace, finite content by chapter, and each of the four required 1× repeat schedules by milestone beat. Authored `estimatedMinutes` fields and observed elapsed time are excluded. Whole milliseconds use largest-remainder reconciliation, so the eleven checkpoints sum exactly to 74,178,683 ms (1,236.311 displayed minutes).

| Chapter | Reference checkpoint |
|---|---:|
| Prologue — The Night Census | 54.571 min |
| 1 — River of Names | 59.421 min |
| 2 — Bell at Takamine | 89.549 min |
| 3 — Sodegaura Lanterns | 122.170 min |
| 4 — The Sea Keeps No Ledger | 141.264 min |
| 5 — Ash in Kagura Pass | 149.717 min |
| 6 — The Court of Masks | 95.216 min |
| 7 — The Road of the Dead | 108.410 min |
| 8 — Lanterns Unhidden | 92.593 min |
| 9 — The Black Chrysanthemum | 185.965 min |
| Epilogue — Names at Daybreak | 133.425 min |

Credits displays actual/reference values throughout a run. An unfinished chapter is labeled not started or in progress; a completed chapter shows its percentage and over/short gap. These are tuning checkpoints only. They do not change the 1,200-minute receipt threshold and cannot make `durationProven` or `releaseTargetProven` true.

## Remaining proof and production gap

The intended all-finite route clears the arithmetic reference target by 36.311 minutes at 1×. That closes only the quantity-model gap for the explicitly contracted 215-activity route. It does not justify a measured 20-hour claim, establish a 20-hour canonical story, or show how naturally a player follows the entry-at-unlock itinerary. Exact witness-fieldwork traversal and chapter-level model attribution are now confirmed; the remaining work includes accessibility and cultural review, chapter-level human timing, a full clean-start intended-route playthrough, and evidence-driven tuning if observed play falls short. Any later expansion should remain finite authored play rather than idle timers or a mandatory repeat treadmill.

Until a clean receipt meets the gate, all documentation must say **20-hour target unproven**.
