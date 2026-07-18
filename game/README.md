# Bells of the Black Chrysanthemum — Browser Runtime

This folder contains the playable browser runtime and the original small combat proof. The campaign, field, quest, battle, advancement, loadout, and playtime saves now share one browser runtime, but the 20-hour target remains a production claim that requires an end-to-end timed playtest.

- **FP-0 (this folder):** one original Bell Court encounter that validates integer-space movement, 2-Pace turns, Tempo/recovery, Guard/Dodge, delivery + essence resistance, deterministic Oni AI, victory/defeat, and restart.
- **FP-1 (Takamine Vertical Slice content):** the 28–34 minute field route, scenes, learning battles, Mateus reveal, and boss specified in the narrative documents.
- **Campaign Atlas (`campaign.html`):** all 11 chapters / 60 authored scenes, deterministic local saves, every campaign map, exact grid-field movement, persistent authored interactions, deterministic hazards, placed encounter triggers, field loot, and encounter-plus-route gates across the canonical campaign.
- **Optional journal:** 13 finite side quests and four repeatable contracts use ordered objectives and direct journal travel to every objective map. The finite first pass is authored at 264 minutes; completion applies XP, currency, items, and key items, while contract repeats remain transparent grind loops.
- **Campaign Battle (`battle.html?encounter=...`):** a shared multi-party engine for all authored encounters, including Tempo/recovery, Pace, typed damage, Guard, Analyze, deterministic enemy AI, nonlethal/objective actions, XP, levels, rewards, repeat grinding, equipped loadout modifiers, and 1×/2×/4× speed.
- **Camp & Loadout (`camp.html`):** party vitals, Spirit/status recovery, consumables, shops, buy/sell, gear, forge upgrades, two Vow slots per character, three camp-rest tiers, and the original six-character field atlas, backed by a versioned save.
- **Active-play telemetry:** narrative, exploration, first-clear battles, repeat grind, and camp/menu time accumulate in one validated cross-page record. Samples suspend after 30 seconds without input; duration proof also requires campaign completion and every canonical first clear.

The rules contract is in [the technical GDD](../docs/02-technical-gdd.md). The prototype names Ren Ishikawa, Elisabet “Lise” Varga, and Father Mateus Avelar in its opening record so the intended narrative relationship is visible without pretending that this one-combatant proof has a full party or story implementation.

## Run it

No dependency install is required. Node.js and Python are the only local tools used.

```powershell
cd C:\projects\JRPG\game
npm run check
npm test
npm run serve
```

Then open `http://localhost:8080/` for FP-0, `http://localhost:8080/campaign.html` for the Campaign Atlas, or `http://localhost:8080/camp.html` for Camp & Loadout. Stop the local server with `Ctrl+C` when finished.

## FP-0 controls

| Control | Action |
| --- | --- |
| Arrow keys / WASD | Move Ren one orthogonal combat space. |
| Q / E / Z / C | Move Ren one diagonal combat space. |
| 1 / 2 / 3 | Courier’s Cut / Cinder Route / Dawn Signal. |
| G / F | Guard / Dodge. |
| R | Restart the encounter. |
| Mouse or touch | Use the labeled command buttons. |

## Campaign Atlas controls

| Control | Action |
| --- | --- |
| W / A / S / D | Move exactly one open field space orthogonally. |
| Q / E / Z / C | Move exactly one open field space diagonally; both cardinal corner spaces must be open. |
| X | Use a nearby authored interaction, advance a nearby side-story marker, or inspect/use an exact-tile exit. |
| Left / Right | Previous / next authored scene. |
| 1–9 | Select the corresponding scene choice. |
| Mouse or touch | Use the field pad and interaction button, or select chapters, quests, choices, and scene controls. |

The Atlas stores versioned, validated campaign, field, quest, loadout, advancement, and telemetry saves in browser local storage. Entering a placed encounter trigger opens the associated battle; victory resolves that trigger when the player returns. An authored exit can move to the next scene or an already-unlocked destination only when its field conditions and required first clears are satisfied. `New Game / clear all saves` starts a clean timing run across every save domain.

## Campaign battle controls

| Control | Action |
| --- | --- |
| W / A / S / D or arrows | Move the active party member one orthogonal combat space. |
| Q / E / Z / C | Move one strict diagonal combat space. |
| Command deck | Choose Attack, Skill, Guard, Analyze, or the encounter-specific Objective action. |
| Canvas / enemy cards | Select an adjacent destination or hostile target. |
| 1× / 2× / 4× | Accelerate enemy intent and recovery presentation while grinding; menus remain turn-based. |
| Restart | Replay the encounter. First-clear loot stays unique; repeat XP and currency diminish to a stable floor. |

The pacing model budgets 20 hours at 1×, with three hours assigned to optional level grinding. It estimates 18.5 hours at 2× and 17.75 hours at 4× because authored dialogue, exploration, and first-clear battles are not skipped. This remains a production target until an end-to-end timed playtest proves it.

The 13 side quests and first circuit of four contracts add an authored 264-minute optional-content receipt. That estimate is data validation, not measured playtime. The telemetry record is now capable of collecting the necessary cross-page evidence, but no complete run has yet met the duration-proof gate.

## Camp & Loadout controls

Camp is mouse/touch driven. Choose an unlocked party member, equip or store gear, learn and bind up to two Vows, use consumables, buy/sell/forge items, or choose one of three rest tiers. Rest and item transitions are atomic: failed purchases or already-full recovery do not spend currency or inventory. Equipment and Vow modifiers are applied when the campaign battle page builds party profiles.

Each Ren Activation begins with two Pace. Move first if useful, then commit one command. Commands add Recovery pulses (one pulse is 800 ms) before Ren can return to the Tempo ribbon. Menu time is paused; this is not real-time combat.

## What to look for

- The central lacquer gate makes the upper/lower flanks tactically meaningful.
- The Oni’s Ledger reveals 125% Ember/Radiance weakness and 75% Umbral resistance; Ren has 75% Umbral resistance.
- Every hit reports base damage, delivery, optional Essence, multiplier, Guard reduction, and final damage.
- Guard applies to the next hit. Dodge only applies to the next dodgeable physical hit; `Moonless Thorns` is Arcane + Umbral and cannot consume it.

All visuals are original project assets or Canvas pixel primitives. The provisional party atlas was generated for this project with a recorded prompt and explicitly excludes real-person likenesses; no copied character names or franchise assets are used.
