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
| Full dialogue | 2,746 lines / 37,717 counted words |
| Canonical selected decisions | 59 |
| Story operations | 60 / 60 complete |
| Once-per-save operation nodes | 183 / 183 complete |
| Combined exact field movement | 1,419 legal steps |
| Combined field interactions | 236 |
| Authored exits | 41 |
| Canonical first clears | 23 / 23 |
| Player combat commands | 228 |
| Enemy activations | 100 |
| Safehouse rests | 16 |
| Recorded playtime | 0 ms |

The combined 1,419-step result is the useful traversal quantity. The standalone operation-placement audit reports 920 shortest-path steps when each beat starts at its spawn, but adding 920 to the old route-only total would double-count shared paths. The current runner traverses operations and exits in one route and therefore measures their actual deterministic combination.

Canonical trace signature: `fnv1a32:029392d1`.

## Finite optional-content completion

The finite-content runner begins from the canonical zero-time result and completes optional state transitions through their public APIs.

| Quantity | Exact result |
| --- | ---: |
| Finite side stories | 13 / 13 |
| Side-story objectives | 59 / 59 |
| Witness chronicles | 18 / 18 |
| Testimony acknowledgements | 288 / 288 |
| Witness stages | 67 / 67 |
| Witness fieldwork nodes audited | 152 |
| Minimum fresh-context witness steps | 729 |
| Atomic finite reward settlements | 31 |
| Replay refusals | 31 completions / 62 refused attempts |
| Repeat contracts included | 0 |
| Recorded playtime | 0 ms |

The 729 witness steps are a deterministic minimum across 67 fresh stage contexts. The optional completion runner audits that route catalog but does not pretend to traverse it or record elapsed time. Repeat contracts remain a transparent grind surface and are excluded from finite-content duration.

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
| Complete-catalogue words | 83,435 |
| Canonical visible words | 76,547 |
| Successful runtime transitions | 4,094 |
| Replay refusals | 90 / 90 |
| Recorded playtime | 0 ms |

The visible-word count includes titles, themes, prompts, both option labels, every main line, the selected first response, and its consequence summary. It excludes the unseen alternate response. Prose-bound catalogue signature: `fnv1a32:3265b9bc`; completion signature: `fnv1a32:d09e58ef`.

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

The visible path counts each title, theme, prompt, both displayed option labels, every multi-character main line, the selected first response, and its consequence summary. It excludes the unseen alternative response. Prose-bound catalogue signature: `fnv1a32:01bf3c11`; completion signature: `fnv1a32:51f4030c`.

## Finite public-archive completion

The public reading table opens one record after every canonical beat. Its runner acknowledges the complete visible catalogue without granting a reward or recording elapsed time.

| Quantity | Exact result |
| --- | ---: |
| Beat-bound public records | 60 / 60 |
| Substantial paragraphs | 498 / 498 |
| Visible record words | 31,163 |
| Successful runtime transitions | 558 |
| Replay refusals | 60 / 60 |
| Trace events | 619 |
| Recorded playtime | 0 ms |

Each visible record word belongs to its title, form, custodian, access note, or paragraph. Prose-bound catalogue signature: `fnv1a32:afd97309`; completion signature: `fnv1a32:fda26e63`.

## Quantity-based duration audit

`game/duration-audit.mjs` applies exposed low/reference/high assumptions to shipped words, line advances, choices, combined canonical movement, interactions, exits, combat decisions, rests, finite objectives, witness fieldwork, companion talks, party councils, and public archive readings. Authored chapter/quest/chronicle minute declarations and repeat loops are excluded.

| Scenario | Estimated finite minutes | Hours | Model gap to 20 hours |
| --- | ---: | ---: | ---: |
| Low | 776.013 | 12.93 | 423.987 min |
| Reference | 1,231.072 | 20.52 | 0 min |
| High | 1,916.650 | 31.94 | 0 min |

The reference assumptions include 180 reading words per minute, 0.8 seconds per dialogue advance, 0.35 seconds per field step, 5 seconds per interaction, 4 seconds per player combat command, and explicit finite-objective handling time. These are editable model inputs, not confidence intervals and not observed behavior. The reference and high-input scenarios cross 20 hours; that is a sensitivity result for the all-finite path, not proof that players read or act at those rates or that every player will choose all optional content.

## What can prove 20 hours

The versioned run receipt begins only beside pristine campaign and advancement state, uses a run UUID across pages, suspends samples while hidden or after 30 seconds without input, and requires:

- all 60 canonical beats completed in order;
- all 23 canonical first clears recorded once;
- at least 1,200 active minutes belonging to the same clean run.

A deterministic completion trace cannot satisfy the time requirement because it calls no playtime transition. A locally stored receipt is an internal QA instrument, not cryptographic or independent attestation. A release claim still needs a witnessed human playthrough and chapter-level timing notes.

## Remaining proof and production gap

The shipped all-finite path now clears the arithmetic reference target by 31.072 minutes. That closes the reference-model content gap; it does not justify a measured 20-hour claim, establish the duration of a critical-path-only run, or show how much optional material a normal player will complete. The remaining work is interactive browser and accessibility QA, cultural review, chapter-level human timing, full clean-start timing, and evidence-driven tuning if observed routes fall short. Any later expansion should remain finite authored play rather than idle timers or a mandatory repeat treadmill.

Until a clean receipt meets the gate, all documentation must say **20-hour target unproven**.
