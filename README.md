# Bells of the Black Chrysanthemum

An original, gothic historical-fantasy JRPG set in a fictionalized early Edo Japan, where a vampiric Shogun turns persecution into a supernatural order. It combines party-based, turn-driven combat with deliberate arena positioning, attack recovery, and readable elemental detail.

## Current milestone

The repository now has a playable campaign spine alongside the deliberately small **FP-0 Combat Proof**. The Campaign Atlas runs 60 canonical scenes plus ten Storyworld decisions and one of two consequence scenes for each decision: 90 scenes are authored and 80 are played in one complete narrative route. Storyworld scenes can resolve after a level, before a boss, or after a boss; their exact options, deterministic reactions, bounded state effects, and later battle-context cards persist under the clean run. Canonical progress still gates at 23 explicitly bound encounters and 34 tested conditional route chains. Exact collision-aware exploration drives nearby interactions, timed and conditional hazards, placed encounter triggers, field loot, and conditional exits from level data.

The ordinary New Game now has an explicit 5–6 hour receipt profile: 60 canonical scenes, 20 played Storyworld scenes, and at least 300 active minutes. The longest visible Storyworld path adds 1,653 words and at most 19 explicit decisions; at the checked-in reading/dwell assumptions, the combined reference route is 323.733 minutes (about 5.40 hours). Those quantities are diagnostic, not observed proof. Credits cross-check the run receipt against the strict Storyworld authority and refuse missing, late-coverage, stale-run, or mismatched decisions. The existing 215-activity route—13 finite side quests, 18 witness chronicles, 90 companion talks, 30 party councils, 60 public archive records, and four repeat circuits—remains an optional completionist ledger with its separate 20-hour verdict and unchanged route signature. It no longer blocks narrative progression or ordinary credits.

Release verification covers 897/897 tests and byte-exact localhost delivery of 144 browser files: 5 HTML, 6 CSS, 5 JS, 94 MJS, 33 PNG, and 1 SVG totaling 10,493,802 bytes. The current Storyworld wave has source/runtime/static verification but no fresh browser smoke or rendered full-route receipt; the recorded browser evidence below is historical and predates it. All 19 combat boards and the party field/combat/portrait, regular-enemy, boss, and nine-family delivery/essence VFX suites are deterministic, editable, manifested, dimension-gated pixel art with procedural/generic fallbacks. An original deterministic 20-frame, 320×180 Campaign panorama atlas maps 20/20 scene backdrops across all 60 canonical beats through exact beat-ID and canonical-level compatibility; it is decorative only, and unknown, mismatched, undecoded, or wrong-size art fails closed to a code-native fallback. Party field art contains 84 unique frames, including a second phase for every member and direction; the level-formation-owned selector makes all six rows reachable where present, and successful persisted moves now draw the remaining formation along a bounded ephemeral trail without creating occupied simulation tiles or save data. A 19-frame transparent terrain suite covers the default floor and every authored tag across all 48 levels without taking collision authority. The status suite supplies 18 lifecycle frames; Camp exposes one distinct icon for each of 25 live items, while Battle reuses River Salve's frame from that atlas. The four-role NPC foundation maps four individual side-story talks, 37 interview nodes, nine singleton level contacts, two confined people, and one courier; six refusal actors reuse exact party rows, while collective and ambiguous targets retain geometry. An exact 113-entry English interaction-copy catalogue keeps save-stable IDs internal and supplies authored labels, blocked/repeat text, completions, and the one field choice.

Battle feedback remains presentation-only: movement, blocked cells, selected targets, real Recovery locks, Tempo readiness, Guard, Analyze, objectives, authored status lifecycles, actor recovery/defeat poses, distinct victory/defeat accents, and exact Crimson Litany telegraph-evasion cues do not change simulation or input authority. Exact typed damage flyouts publish damage or restored HP plus WEAK, RESIST, IMMUNE, ABSORB, GUARD, WARD, and delivery/Essence percentages from corroborated engine events across manual and Auto-Grind paths. The published-line evasion cue is derived only from typed published-target and hit-target sets; it remains distinct from stance Dodge.

Campaign stance Dodge is live as a deterministic pre-commit: it guarantees a miss from the next incoming art whose catalogue record contains the exact boolean `dodgeable: true`. Eligibility is never inferred from delivery, Essence, shape, or prose. Dodge has base Recovery 1 and no Spirit cost; equipped loadout and active status Recovery modifiers still apply, with a minimum final Recovery of 1. A non-dodgeable art, status resolution, or attack against another actor leaves the stance intact. Guard and Dodge replace one another when committed. Neither command nor evasion changes the actor's simulation cell or creates a real-time response window. Persistent code-native chevrons and the existing authored move pose carry the presentation; no bespoke Dodge bitmap is claimed. Current deterministic repeat traces reach dodgeable enemy arts in six encounters, which does not establish balance or human feel.

Campaign Item is live for the deliberately narrow River Salve contract. The native `I` command targets any living deployed ally at any distance, restores at most the authored 80 HP, and commits base Recovery 2 with the existing loadout/status modifiers and a one-pulse floor; it spends no Pace or Spirit, does not revive, and leaves Guard/Dodge stance unchanged. Invalid and no-effect attempts are nonmutating. Stock is attempt-local until victory, so defeat, restart, or reload cannot persist a debit; victory nets consumption, encounter rewards, and surviving HP into one loadout revision inside the existing compensating cross-authority transaction. Auto-Grind never chooses Item. MP, Spirit, and cleanse consumables remain Camp-only until those resource/status authorities are reconciled. Remaining combat/scene in-betweens, alternate action facings, a full NPC roster, and subjective/cultural review remain absent.

The 170.359-second isolated Chrome gate on clean run `17c607f2` covers scene-panorama readiness plus broken-image, wrong-size, responsive, reduced-motion, and canonical-level registry behavior; it also retains one live six-member formation-follow move, a real River Salve heal from 479/563 to 559/563 HP, provisional stock 2, reload refund to 3, victory-only durable stock 2 in one settlement revision, a five-win 4× Auto-Grind queue, all 180 Camp entries, 215/215 credits/evidence, recovery import/export, semantic checks, denied storage, audio, and zero console/page/HTTP errors. Separately, the rendered-control-only route on recorded runtime `d45dfb2` completed 60/60 scenes, 215/215 activities, and 23/23 first clears on clean run `ec3182b2-73b3-4b83-90b1-79a740e036ed`, then sealed Credits. Its [schema-v2 evidence](docs/rendered-route-playtest-evidence.json) is byte-canonical and signature-valid (`fnv1a32:31d04d74`; SHA-256 `BDF021E41DC7DBD42948756D19DEC25E5BB25B682BB5874B19CB9F5366BAA57A`) with zero unattributed time and empty browser-error arrays. That locked route predates the current formation-follow, interaction-copy, typed-damage-outcome, Campaign Dodge, Campaign Item, and scene-backdrop waves and does not cover them. It records 1,693,181 ms of automated active control time and `durationProven: false`; recovery checkpoints remain continuity-only (`recoveryOnly: true`, `proofClaimed: false`).

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
- [Storyworld sequence production map](docs/22-storyworld-sequence-production-map.md)

Run [`game/`](game/README.md) and open `http://localhost:8080/` for the FP-0 battle proof, `http://localhost:8080/campaign.html` for the Campaign Atlas, `http://localhost:8080/camp.html` for Camp & Loadout, or `http://localhost:8080/credits.html` for the explicit end-of-run credits boundary. Production-reference art and its reproducible prompt record are in [`assets/production/`](assets/production/README.md).
