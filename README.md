# Bells of the Black Chrysanthemum

An original, gothic historical-fantasy JRPG set in a fictionalized early Edo Japan, where a vampiric Shogun turns persecution into a supernatural order. It combines party-based, turn-driven combat with deliberate arena positioning, attack recovery, and readable elemental detail.

## Current milestone

The repository now has a playable campaign spine alongside the deliberately small **FP-0 Combat Proof**. The Campaign Atlas runs the prologue-to-epilogue scene sequence, gates story progress at 23 explicitly bound encounters and 34 tested conditional route chains, and persists choices, advancement, and authored field state. Its exact collision-aware exploration drives nearby interactions, timed and conditional hazards, placed encounter triggers, field loot, and conditional exits from level data instead of displaying those records only as map notes.

The optional journal adds 13 finite side quests, 18 witness chronicles, and four repeatable combat contracts. Active objectives route to authored maps, finite rewards settle atomically, and repeat battles remain an explicit optional grind surface with saved 1×/2×/4× presentation speed. A functional Camp & Loadout page provides shops, consumables, equipment, forge upgrades, two-slot Vows, Spirit/status recovery, three rest tiers, an original six-character pixel atlas, 90 finite companion talks, 30 multi-character party councils, and 60 beat-bound public archive records. The explicit quantity model now crosses 20 hours under its reference assumptions, but that arithmetic is not observed playtime. Cross-page telemetry suspends after inactivity and still requires a clean completed human run with every first clear and at least 1,200 active minutes before duration can be called proven.

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

Run [`game/`](game/README.md) and open `http://localhost:8080/` for the FP-0 battle proof, `http://localhost:8080/campaign.html` for the Campaign Atlas, or `http://localhost:8080/camp.html` for Camp & Loadout. Production-reference art and its reproducible prompt record are in [`assets/production/`](assets/production/README.md).
