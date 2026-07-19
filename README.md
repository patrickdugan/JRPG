# Bells of the Black Chrysanthemum

An original, gothic historical-fantasy JRPG set in a fictionalized early Edo Japan, where a vampiric Shogun turns persecution into a supernatural order. It combines party-based, turn-driven combat with deliberate arena positioning, attack recovery, and readable elemental detail.

## Current milestone

The repository now has a playable campaign spine alongside the deliberately small **FP-0 Combat Proof**. The Campaign Atlas runs the prologue-to-epilogue scene sequence, gates story progress at 23 explicitly bound encounters and 34 tested conditional route chains, and persists choices, advancement, and authored field state. Its exact collision-aware exploration drives nearby interactions, timed and conditional hazards, placed encounter triggers, field loot, and conditional exits from level data instead of displaying those records only as map notes.

The intended first-play route now has an explicit chronological contract: 60 story beats plus 215 entered-at-unlock activities—13 finite side quests, 18 witness chronicles, 90 companion talks, 30 party councils, 60 public archive records, and one circuit of each of four repeatable combat contracts. Every due ledger entry is a one-click route action: field activities select or enter their exact journal route, while talks, councils, and records deep-link to the correct Camp surface and entry. Camp’s required reading surfaces support one-press keyboard advancement (`N`) and numbered choices (`1`/`2`) without accepting held-key repeats. Repeat battles keep saved 1×/2×/4× presentation speed; only those four measured presentation schedules accelerate. The deterministic witness executes all 152 witness-fieldwork nodes through 729 legal one-step runtime moves, with no coordinate jumps or elapsed-time claim. The v8 quantity audit estimates the canonical story alone at 308.680 reference minutes (about 5.14 hours) and the complete intended route at 1,231.686 reference minutes (about 20.53 hours). Those are arithmetic projections, not observed playtime. Campaign, Battle, Camp, and Credits all attribute clean-run samples to a canonical chapter; Credits displays the live five-category and eleven-chapter breakdown before sealing, and the combined exported verdict refuses any run with unattributed time. A witnessed clean human run with at least 1,200 active minutes is still required before the duration target can be called proven.

Release verification on the integrated snapshot passes 519/519 tests and byte-exact localhost delivery for all 92 shipped browser files. The five browser surfaces now share an autoplay-safe synthesized score and cue layer with visible sound/volume controls, resilient suspended-context recovery, and a device preference kept outside run proof and recovery authorities. The isolated Chrome flow covers the authored Prologue party from New Game, a five-win 4× Auto-Grind queue with five separately durable rewards, a fresh one-click route entry, persisted keyboard archive advance, cross-page persistence, all 180 Camp catalogue entries completed through their rendered controls, the 215/215 credits gate, eleven actual/reference chapter checkpoints, sealed-report download with zero unattributed time, and a 13-authority recovery checkpoint exported, replaced by another run, restored, reloaded, and compared byte-for-byte. The same pass covers exact 390 px no-overflow checks, duplicate-ID/access-name/image-alt semantic gates across all five pages, denied-storage startup, keyboard reachability, and zero console/page/HTTP errors. A rendered-control-only route—with no direct storage access or runtime transition calls—has now continued across recovery-only UI checkpoints on the same clean run to 29/60 scenes, 70/215 route entries, 11/23 durable first clears, and 48:26 active play. The latest checkpoint preserves all thirteen authorities and remains explicitly recovery-only, not a complete route, browser-error ledger, or duration proof.

## Scope guardrails

- Chapter-based town / route / dungeon JRPG progression in the 16-bit console tradition.
- Not a metroidvania: no ability-gated backtracking loop or open-ended castle crawl is required for the core game.
- Action-game texture inside turns: position, wind-up, recovery, guard, dodge, interrupt, and elemental matchup matter.
- All characters, art, and lore are original. The European apostate priest is an original fictional character rather than an actor likeness or a film adaptation.

## Production documents

- [Milestone roadmap](docs/00-production-roadmap.md)
- [Vision document](docs/01-vision-doc.md)
- [Technical GDD](docs/02-technical-gdd.md)
- [Story beats](docs/03-beats-outline.md)
- [Detailed outline](docs/04-detailed-outline.md)
- [Art direction](docs/05-art-direction.md)
- [Master asset list](docs/06-master-asset-list.md)
- [Campaign content pipeline](docs/08-campaign-content-pipeline.md)
- [Level and encounter bible](docs/09-level-and-encounter-bible.md)
- [Animation bible](docs/10-animation-bible.md)
- [Build QA report](docs/11-build-qa-report.md)
- [Progression and save contract](docs/12-progression-save-contract.md)
- [Advancement and runtime pacing](docs/13-advancement-and-runtime-pacing.md)
- [Optional-content and side-quest ledger](docs/14-sidequest-ledger.md)
- [Content-volume and duration evidence](docs/15-content-volume-and-duration-evidence.md)
- [Companion conversation bible](docs/16-companion-conversation-bible.md)
- [Public archive bible](docs/17-public-archive-bible.md)
- [Party council bible](docs/18-party-council-bible.md)

Run [`game/`](game/README.md) and open `http://localhost:8080/` for the FP-0 battle proof, `http://localhost:8080/campaign.html` for the Campaign Atlas, `http://localhost:8080/camp.html` for Camp & Loadout, or `http://localhost:8080/credits.html` for the explicit end-of-run credits boundary. Production-reference art and its reproducible prompt record are in [`assets/production/`](assets/production/README.md).
