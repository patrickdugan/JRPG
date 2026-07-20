# Human Full-Route Playtest Protocol

This protocol is the release gate for the intended 20-hour route. Deterministic runners, quantity estimates, recovery files, and accelerated automation cannot substitute for this test. The tester must play one clean-start run through the rendered browser controls and explicitly seal Credits on the same UUID-bound receipt.

## Build and test identity

Record these before starting:

| Field | Value |
| --- | --- |
| Tester |  |
| Date / timezone |  |
| Git commit |  |
| Browser and version |  |
| Operating system |  |
| Viewport / display scale |  |
| Keyboard, pointer, touch, or controller |  |
| Assistive technology, if any |  |

Use a normal supported browser profile with no other game tabs open. Start the local server from `game/`, open `campaign.html`, choose **New Game / clear all saves**, and record the eight-character run prefix shown by the clean-run badge. Do not seed or edit browser storage, invoke runtime functions through developer tools, or merge authorities from another run.

## Required route policy

Complete all story and route work as it becomes available:

- 60/60 canonical story scenes;
- 23/23 canonical first-clear encounters, played manually;
- 13/13 finite side quests;
- 18/18 witness chronicles;
- 90/90 companion conversations;
- 30/30 party councils;
- 60/60 public archive records;
- one completed circuit of each of the four required repeat contracts.

The repeat speed control may be set to 1×, 2×, or 4× after a manual first clear. Record every optional leveling queue and its speed. Do not add mandatory repeat wins merely to make the clock reach the target. If the natural intended route finishes below 20 active hours, preserve that result and tune finite authored content or pacing in a later build.

## Chapter timing log

At every chapter boundary, copy the visible active-play total and record player-facing observations. Use the Campaign recovery button only when the test must cross sessions; recovery preserves continuity but does not independently prove elapsed time or route completion.

| Chapter | Active time at exit | Wipes | Optional repeat wins and speed | Unclear objective / rule | Accessibility, visual, audio, input, or cultural note |
| --- | ---: | ---: | --- | --- | --- |
| Prologue |  |  |  |  |  |
| Chapter 1 |  |  |  |  |  |
| Chapter 2 |  |  |  |  |  |
| Chapter 3 |  |  |  |  |  |
| Chapter 4 |  |  |  |  |  |
| Chapter 5 |  |  |  |  |  |
| Chapter 6 |  |  |  |  |  |
| Chapter 7 |  |  |  |  |  |
| Chapter 8 |  |  |  |  |  |
| Chapter 9 |  |  |  |  |  |
| Epilogue |  |  |  |  |  |

For each recovery export, record the filename, SHA-256, current chapter/scene, route count, first-clear count, active time, and run prefix. Close the old tab before importing the checkpoint into a fresh session. Import only through Campaign's rendered file control and confirm that the same run prefix and all visible counts return.

## Subjective review prompts

Record concrete examples, not only a pass/fail impression:

1. Could the next required story or route action be found without outside instructions?
2. Were exact movement, target range, danger tiles, Tempo, Recovery, elements, Spirit, and boss-specific mechanics readable before committing?
3. Did any dialogue, archive entry, image, enemy, reward, or sacred-space treatment flatten Japanese characters, Christian communities, local practices, or historical persecution into scenery or loot?
4. Were text size, contrast, focus indication, status announcements, motion, audio state, keyboard order, touch targets, and input recovery comfortable for the tester's setup?
5. Which chapter felt rushed, padded, repetitive, or disproportionately slow, and why?
6. Did 2× or 4× repeat presentation save time without changing decisions, rewards, or first-clear play?

Log a reproduction path for every defect: page, chapter/scene or encounter, prior action, input used, expected result, actual result, and whether reload reproduced it.

## Credits and evidence boundary

After the final two epilogue route entries reach 215/215, choose **View credits & seal run**, then activate **Complete credits & seal run receipt**. Export the playtest evidence from Credits and retain the original JSON unchanged.

The release-duration gate passes only when the exported schema-v2 report satisfies all of these fields together:

| Evidence field | Required value |
| --- | --- |
| `cleanStart` | `true` |
| `status` | `"complete"` |
| `story.complete` | `true` |
| `story.creditsComplete` | `true` |
| `story.completedBeatCount` | `60` |
| `combat.firstClearCount` | `23` |
| `requiredRoute.allSourcesValid` | `true` |
| `requiredRoute.runBoundSourcesMatchReceipt` | `true` |
| `requiredRoute.completedActivityCount` | `215` |
| `requiredRoute.creditsGateReady` | `true` |
| `playtime.totalMs` | at least `72000000` |
| `playtime.unattributedMs` | `0` |
| `proof.durationProven` | `true` |
| `proof.releaseTargetProven` | `true` |

Also record the evidence filename, run UUID, internal `signature`, SHA-256, sealed active time, and Git commit. The internal FNV signature detects accidental report drift; it is not cryptographic attestation. Keep the chapter notes and tester identity alongside the evidence so later tuning decisions can be traced to observed play rather than the quantity model.

## Failure handling

If a save, crash, or browser defect prevents legitimate continuation, preserve the last recovery export, console/error capture if available, and exact reproduction steps. Do not repair the receipt or advance the route with storage edits. Fix the build, start a new clean run, and keep the failed run as diagnostic evidence.

If the route seals below 20 active hours, the build has failed the duration gate honestly. Use the chapter deltas and notes to add or deepen finite authored play where the experience is thin; do not add idle timers, forced rereading, or an uncontrolled grind requirement.
