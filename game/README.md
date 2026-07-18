# Bells of the Black Chrysanthemum — Browser Runtime

This folder contains the playable browser runtime and the original small combat proof. The full campaign path is now connected, but the 20-hour target remains a production claim that requires an end-to-end timed playtest.

- **FP-0 (this folder):** one original Bell Court encounter that validates integer-space movement, 2-Pace turns, Tempo/recovery, Guard/Dodge, delivery + essence resistance, deterministic Oni AI, victory/defeat, and restart.
- **FP-1 (Takamine Vertical Slice content):** the 28–34 minute field route, scenes, learning battles, Mateus reveal, and boss specified in the narrative documents.
- **Campaign Atlas (`campaign.html`):** all 11 chapters / 60 authored scenes, deterministic local saves, every campaign map, exact grid-field movement, and explicit gates for all 23 campaign encounters.
- **Campaign Battle (`battle.html?encounter=...`):** a shared multi-party engine for all authored encounters, including Tempo/recovery, Pace, typed damage, Guard, Analyze, deterministic enemy AI, nonlethal/objective actions, XP, levels, rewards, repeat grinding, and 1×/2×/4× speed.

The rules contract is in [the technical GDD](../docs/02-technical-gdd.md). The prototype names Ren Ishikawa, Elisabet “Lise” Varga, and Father Mateus Avelar in its opening record so the intended narrative relationship is visible without pretending that this one-combatant proof has a full party or story implementation.

## Run it

No dependency install is required. Node.js and Python are the only local tools used.

```powershell
cd C:\projects\JRPG\game
npm run check
npm test
npm run serve
```

Then open `http://localhost:8080/` for FP-0 or `http://localhost:8080/campaign.html` for the Campaign Atlas. Stop the local server with `Ctrl+C` when finished.

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
| Left / Right | Previous / next authored scene. |
| 1–9 | Select the corresponding scene choice. |
| Mouse or touch | Use the displayed field pad, or select chapters, choices, and scene controls. |

The Atlas stores a versioned, validated save in browser local storage. It shows authored exits but never auto-advances the narrative, so scene progress remains explicit and reviewable.

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

Each Ren Activation begins with two Pace. Move first if useful, then commit one command. Commands add Recovery pulses (one pulse is 800 ms) before Ren can return to the Tempo ribbon. Menu time is paused; this is not real-time combat.

## What to look for

- The central lacquer gate makes the upper/lower flanks tactically meaningful.
- The Oni’s Ledger reveals 125% Ember/Radiance weakness and 75% Umbral resistance; Ren has 75% Umbral resistance.
- Every hit reports base damage, delivery, optional Essence, multiplier, Guard reduction, and final damage.
- Guard applies to the next hit. Dodge only applies to the next dodgeable physical hit; `Moonless Thorns` is Arcane + Umbral and cannot consume it.

All visuals are original Canvas pixel primitives. The build has no downloaded assets, copied character names, or real-person likeness.
