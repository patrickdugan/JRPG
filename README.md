# Bells of the Black Chrysanthemum

An original, gothic historical-fantasy JRPG set in a fictionalized early Edo Japan, where a vampiric Shogun turns persecution into a supernatural order. It combines party-based, turn-driven combat with deliberate arena positioning, attack recovery, and readable elemental detail.

## Current milestone

The repository now has a playable campaign spine alongside the deliberately small **FP-0 Combat Proof**. The Campaign Atlas runs the prologue-to-epilogue scene sequence, gates story progress at 23 explicitly bound encounters and 34 tested conditional route chains, and persists choices, advancement, and authored field state. Its exact collision-aware exploration drives nearby interactions, timed and conditional hazards, placed encounter triggers, field loot, and conditional exits from level data instead of displaying those records only as map notes.

The intended first-play route now has an explicit chronological contract: 60 story beats plus 215 entered-at-unlock activities—13 finite side quests, 18 witness chronicles, 90 companion talks, 30 party councils, 60 public archive records, and one circuit of each of four repeatable combat contracts. Every due ledger entry is a one-click route action: field activities select or enter their exact journal route, while talks, councils, and records deep-link to the correct Camp surface and entry. Camp’s required reading surfaces support one-press keyboard advancement (`N`) and numbered choices (`1`/`2`) without accepting held-key repeats. Repeat battles keep saved 1×/2×/4× presentation speed; only those four measured presentation schedules accelerate. The deterministic witness executes all 152 witness-fieldwork nodes through 729 legal one-step runtime moves, with no coordinate jumps or elapsed-time claim. The v8 quantity audit estimates the canonical story alone at 309.135 reference minutes (about 5.15 hours) and the complete intended route at 1,232.141 reference minutes (about 20.54 hours). Those are arithmetic projections, not observed playtime. Campaign, Battle, Camp, and Credits all attribute clean-run samples to a canonical chapter; Credits displays the live five-category and eleven-chapter breakdown before sealing, and the combined exported verdict refuses any run with unattributed time. A witnessed clean human run with at least 1,200 active minutes is still required before the duration target can be called proven.

Release verification covers 774/774 tests and byte-exact localhost delivery of 132 browser files: 5 HTML, 6 CSS, 5 JS, 84 MJS, 31 PNG, and 1 SVG totaling 10,142,109 bytes. All 19 combat boards and the party field/combat/portrait, regular-enemy, boss, and nine-family delivery/essence VFX suites are deterministic, editable, manifested, dimension-gated pixel art with procedural/generic fallbacks. Party field art now contains 84 unique frames, including a second authored phase for every member and direction; Campaign currently samples the pair for fixed field leader Ren during the existing movement hold, while the other five rows are authored but not reachable through a leader-selection system. The status suite supplies 18 lifecycle frames; Camp supplies one distinct icon for each of 25 live items. The metadata-only NPC foundation maps exactly four individual side-story talk targets and 37 interview nodes, while four collective talk targets and every other field-marker class remain geometric.

Battle feedback remains presentation-only: movement, blocked cells, selected targets, real Recovery locks, Tempo readiness, Guard, Analyze, objectives, authored status lifecycles, actor recovery/defeat poses, and distinct victory and defeat canvas accents do not change simulation or input authority. The explicit-heal seam is dormant because Campaign emits no heal resolution; positive absorption remains hit feedback. Campaign Dodge, remaining combat/scene in-betweens, alternate action facings, a full NPC roster, and subjective/cultural review remain absent.

The isolated Chrome gate covers atlas readiness, a five-win 4× Auto-Grind queue, all 180 Camp entries, 215/215 credits/evidence, recovery import/export, responsive and semantic checks, reduced motion, denied storage, audio, and zero console/page/HTTP errors. Separately, the rendered-control-only route on recorded runtime `d45dfb2` completed 60/60 scenes, 215/215 activities, and 23/23 first clears on clean run `ec3182b2-73b3-4b83-90b1-79a740e036ed`, then sealed Credits. Its [schema-v2 evidence](docs/rendered-route-playtest-evidence.json) is byte-canonical and signature-valid (`fnv1a32:31d04d74`; SHA-256 `BDF021E41DC7DBD42948756D19DEC25E5BB25B682BB5874B19CB9F5366BAA57A`) with zero unattributed time and empty browser-error arrays. That route predates the current presentation wave and does not cover it. It records 1,693,181 ms of automated active control time and `durationProven: false`; recovery checkpoints remain continuity-only (`recoveryOnly: true`, `proofClaimed: false`).

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
- [Human full-route playtest protocol](docs/19-human-playtest-protocol.md)
- [Historical and cultural audit note](docs/20-historical-cultural-audit.md)
- [Takamine battle-environment production brief](docs/21-takamine-battle-environment-brief.md)

Run [`game/`](game/README.md) and open `http://localhost:8080/` for the FP-0 battle proof, `http://localhost:8080/campaign.html` for the Campaign Atlas, `http://localhost:8080/camp.html` for Camp & Loadout, or `http://localhost:8080/credits.html` for the explicit end-of-run credits boundary. Production-reference art and its reproducible prompt record are in [`assets/production/`](assets/production/README.md).
