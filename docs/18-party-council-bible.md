# Party Council Bible

**System:** finite, multi-character camp councils

**Scope:** 30 canonical councils in three contiguous production groups of 10

**Completion policy:** one explicit decision per council, once per save

**Shipped catalogue volume:** 993 main lines, 180 authored response lines across both branches, 60 options, and 27,506 counted words

## Dramatic purpose

Party councils let three to six companions deliberate together after the campaign has changed the evidence in front of them. They are not majority-vote minigames, approval meters, or a place where the protagonists decide what affected communities must accept. Each scene begins from a specific operational conflict: prisoner care versus route pressure, testimony versus exposure, local custody versus centralized efficiency, or immediate defense versus the right to refuse.

No useful act automatically absolves Mateus. His technical knowledge and admissions can be relevant while remaining compromised by his service to the court. Lise and the rest of the party are never assigned responsibility for completing his redemption. Workers, survivors, patients, families, route keepers, and community representatives retain authority over testimony, care, names, shelter, and correction.

The councils grant no XP, currency, equipment, combat modifier, collectible, sacred loot, score, or elapsed-time credit. Their consequences are finite narrative records, not optimization rewards or hidden progression gates.

## Canonical plan

`game/party-council-contract.mjs` owns identity, sequence, unlock beat, camp, and participants. The three prose packs fill that plan without changing its metadata.

| Production group | Canonical slots | Unlock span | Dramatic work |
| --- | ---: | --- | --- |
| Early | 1-10 | `c2-06-name-from-europe` through `c5-02-ash-fields` | Forms the council practice around testimony, custody, refusal, local routes, and the party's expanding membership. |
| Middle | 11-20 | `c5-04-prison-locks` through `c8-03-black-gate-bargain` | Tests prisoner-first rescue, tribunal evidence, distributed copies, aqueduct names, community homecomings, and refusal at the Black Gate. |
| Late | 21-30 | `c8-05-gate-opened` through `e02-repaired-tower` | Carries the method into aftermath, archive custody, patient care, repair work, public correction, and the epilogue. |

The 10/10/10 split is a production boundary, not three replay tiers. Catalogue sequence is canonical, but the runtime does not invent a prior-council prerequisite. A council opens from its own exact beat, camp, and joined cast.

## Join-safe availability

The authored plan never schedules a speaker before that character's canonical join beat.

| Party member | Available from beat |
| --- | --- |
| Ren | `p00-delivery-in-rain` |
| Aya | `p05-archive-promise` |
| Lise | `c2-06-name-from-europe` |
| Mateus | `c2-06-name-from-europe` |
| Genta | `c3-05-gentas-order` |
| Kiku | `c4-06-kikus-terms` |

At runtime, a council is available only when:

1. its exact unlock beat appears in completed campaign beats;
2. the selected rest point matches its authored camp;
3. every planned participant is unlocked in advancement state;
4. no other party council is active;
5. that council has not already been completed.

The three authored rest points are Roadside Lantern (`roadside-lantern`), Lantern Safehouse (`lantern-safehouse`), and Hidden Infirmary (`hidden-infirmary`). An active council remains recoverable from its saved frontier. The gate fails closed for an unknown ID, missing beat, wrong camp, locked participant, another active council, or finite replay.

## Authored record contract

Every council contains exactly:

- canonical ID, global sequence, chapter, unlock beat, camp, and ordered participants;
- a unique concrete title and thematic statement;
- three to six unique, join-safe speakers;
- at least 30 main-dialogue lines;
- at least four main lines for every planned participant;
- one explicit prompt with exactly two readable options;
- at least three response lines for each option;
- one canonical consequence flag and concrete summary per option;
- at least 500 counted words across the complete record.

Option IDs use `<council-id>-choice-1` and `<council-id>-choice-2`. Consequence flags use `party-council.<council-id>.choice.1` and `.choice.2`. Completing a council exposes exactly one of those flags; the other remains an authored possibility, not an achieved result.

Strict validation checks exact schema, canonical order and metadata, participant use, line and word floors, choice identity, consequence identity, and global exact-text uniqueness. It rejects unsupported fields, duplicate prose or flags, placeholders, real-person or performer likenesses, borrowed-franchise material, duration claims, prizes, and sacred or persecuted experience framed as loot.

## Player-facing flow

The Camp page lists councils available at the selected rest point, the currently active council, and completed councils recorded for review. Beginning a council creates its finite save record. Each input acknowledges exactly one visible main line. Only after every main line has been acknowledged does the interface show both decision labels.

Choosing an option records it immediately and opens only that option's authored response. Response lines are acknowledged one at a time. The final selected response marks the council complete and exposes its consequence summary and flag. A second start attempt returns `already-complete` without changing the save.

The consequence describes the party's bounded method, understanding, or public commitment. It does not retroactively settle community testimony, forgive wrongdoing, determine spiritual truth, or change a campaign fact that belongs to affected people.

## Save, storage, and review behavior

Party councils use schema version 1 and the independent storage key `bells-black-chrysanthemum.party-councils.v1`. The top-level save contains only `schemaVersion`, `campaignId`, clean-run `runId`, canonical `records`, and monotonic `revision`. Each record contains only council ID, status, main-line frontier, selected choice ID, and response-line frontier.

Validation rejects unknown or duplicate IDs, non-canonical record order, more than one active council, a choice made before main dialogue ends, response progress without a choice, an impossible frontier, premature completion, and a revision inconsistent with represented successful transitions. A malformed or unreadable storage payload fails closed to a fresh state rather than fabricating progress.

The browser adapter writes every accepted start, line acknowledgement, choice, and response before replacing the live UI state. Redundant page-hide writes are deliberately omitted. Compare-and-swap revision checks reject stale tabs, conflicts, skipped transitions, and cleared-storage resurrection. The persisted run ID must match the current validated run receipt, so even an old payload whose namespace could not be deleted is reset rather than adopted by a new run. A cached page reloads the independent state, and New Game clears this namespace alongside the other campaign authorities.

A completed entry is labeled `Recorded`. Selecting it shows the chosen option and consequence summary with a disabled `Council complete` control. That review performs no transition, adds no flag, increments no revision, and records no council duration. Replay cannot be used to choose the alternate branch on the same save.

## Catalogue volume and canonical visible path

Catalogue volume includes both authored branches. Duration modeling uses a canonical first-choice path so unseen alternate prose is not counted as if the player had read it.

| Quantity | Complete catalogue | Canonical first-choice path |
| --- | ---: | ---: |
| Councils | 30 | 30 |
| Main dialogue lines | 993 | 993 |
| Response lines | 180 | 90 |
| Dialogue lines seen | - | 1,083 |
| Options authored or displayed | 60 authored | 60 labels displayed |
| Explicit decisions | 30 | 30 |
| Counted words | 27,506 | 25,072 visible |

The 25,072-word visible path includes title, theme, prompt, both option labels, every main line, the selected first response, and the selected consequence summary. It excludes the unselected response and unselected consequence summary. The 1,083 visible dialogue lines are exactly 993 main lines plus 90 selected response lines.

## DOM-free completion witness

`game/party-council-run.mjs` begins from the fully integrated canonical zero-time campaign result and completes all 30 councils through public runtime functions. It uses each exact camp context, acknowledges all 993 main lines, selects the first canonical option, acknowledges 90 selected response lines, verifies 30 unique consequence flags, and then attempts and rejects replay for every council.

| Witness quantity | Exact result |
| --- | ---: |
| Councils completed | 30 / 30 |
| Main-line acknowledgements | 993 / 993 |
| Selected response acknowledgements | 90 / 90 |
| Decisions recorded | 30 / 30 |
| Replay refusals without mutation | 30 / 30 |
| Successful runtime transitions | 1,143 |
| Trace events | 1,174 |
| Recorded timed duration | 0 ms / 0 minutes |

The 1,143 successful transitions are 30 starts, 993 main-line acknowledgements, 30 choices, and 90 response acknowledgements. The 1,174-event trace adds one canonical-seed event and 30 replay-refusal events. Its prose-bound catalogue signature is `fnv1a32:01bf3c11`; the completion signature is `fnv1a32:e19cc4d8`.

This witness proves deterministic reachability, authored-line coverage, canonical first-choice settlement, unique consequence flags, exact bounds, and once-per-save replay refusal. It does not exercise human reading, reflection, browser presentation, accessibility, or elapsed play.

## Estimate-versus-proof boundary

The shipped quantities can enter the duration audit's explicit reading-speed and interaction-time formulas. Arithmetic under those assumptions is an estimate, even when every input count and calculation is exact. It is not observed duration.

The DOM-free witness deliberately records zero timed minutes, sets `durationClaimed` to false, and sets `durationProven` to false. Zero is not an estimate that councils take no time; it is proof that the automated state witness did not fabricate elapsed time. All 30 councils belong to the 215-activity intended route, including final-beat pre-credits content; credits cannot seal until their completed evidence is present. Only a valid clean human run receipt with at least 1,200 active minutes and explicit credits completion can support the 20-hour claim.

## Writing review checklist

- Does the council arise from a scene-specific object, route, testimony conflict, care limit, or public decision?
- Do at least three speakers pursue distinguishable needs rather than rotate through exposition?
- Does every planned participant materially affect the deliberation?
- Are evidence limits, uncertainty, access, and correction routes explicit?
- Do affected people retain custody, refusal, care, naming, and disclosure authority?
- Can either option be chosen without turning persecution, faith, trauma, survival, or forgiveness into a morality meter?
- Does Mateus remain accountable without making another character responsible for his absolution?
- Is the consequence bounded, visible, finite, and free of progression value?
- Does the scene differ in structure and cadence from neighboring councils?
- Are real historical people, performer likenesses, borrowed characters, prizes, elapsed-time claims, and sacred loot absent?
