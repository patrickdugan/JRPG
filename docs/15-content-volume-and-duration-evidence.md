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

## Quantity-based duration audit

`game/duration-audit.mjs` applies exposed low/reference/high assumptions to shipped words, line advances, choices, combined canonical movement, interactions, exits, combat decisions, rests, finite objectives, and witness fieldwork. Authored chapter/quest/chronicle minute declarations and repeat loops are excluded.

| Scenario | Estimated finite minutes | Hours | Model gap to 20 hours |
| --- | ---: | ---: | ---: |
| Low | 223.258 | 3.72 | 976.742 min |
| Reference | 393.128 | 6.55 | 806.872 min |
| High | 691.875 | 11.53 | 508.125 min |

The reference assumptions include 180 reading words per minute, 0.8 seconds per dialogue advance, 0.35 seconds per field step, 5 seconds per interaction, 4 seconds per player combat command, and explicit finite-objective handling time. These are editable model inputs, not confidence intervals and not observed behavior.

## What can prove 20 hours

The versioned run receipt begins only beside pristine campaign and advancement state, uses a run UUID across pages, suspends samples while hidden or after 30 seconds without input, and requires:

- all 60 canonical beats completed in order;
- all 23 canonical first clears recorded once;
- at least 1,200 active minutes belonging to the same clean run.

A deterministic completion trace cannot satisfy the time requirement because it calls no playtime transition. A locally stored receipt is an internal QA instrument, not cryptographic or independent attestation. A release claim still needs a witnessed human playthrough and chapter-level timing notes.

## Remaining production gap

The shipped build is mechanically broad but does not yet justify a 20-hour claim. Under the reference quantity model, approximately 13.45 hours remain. Closing that gap should come from finite, authored play—not idle timers or a mandatory repeat treadmill. Candidate work packages are additional explorable scenes with consequential field objectives, dungeons with authored tactical routes and encounter variants, voiced-or-readable camp conversations, character-specific optional arcs, and measured tuning passes. Each package should enter the same finite runner and then be validated by chapter timing.

Until a clean receipt meets the gate, all documentation must say **20-hour target unproven**.
