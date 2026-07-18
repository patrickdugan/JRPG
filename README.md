# Bells of the Black Chrysanthemum

An original, gothic historical-fantasy JRPG set in a fictionalized early Edo Japan, where a vampiric Shogun turns persecution into a supernatural order. It combines party-based, turn-driven combat with deliberate arena positioning, attack recovery, and readable elemental detail.

## Current milestone

The repository now has a playable campaign spine alongside the deliberately small **FP-0 Combat Proof**. The Campaign Atlas runs the prologue-to-epilogue scene sequence, gates story progress at 23 explicitly bound encounters, persists choices and advancement, renders every documented map, and supports exact collision-aware field movement. The shared battle stage consumes every authored encounter with multi-party Tempo/recovery, typed damage, objective actions, XP, levels, first-clear rewards, repeat grinding, and saved 1×/2×/4× speed controls. The 20-hour pacing budget is designed but not yet proven by an end-to-end timed playtest.

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

Run [`game/`](game/README.md) and open either `http://localhost:8080/` for the FP-0 battle proof or `http://localhost:8080/campaign.html` for the Campaign Atlas. Production-reference art and its reproducible prompt record are in [`assets/production/`](assets/production/README.md).
