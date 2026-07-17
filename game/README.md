# Bells of the Black Chrysanthemum — FP-0 Combat Proof

This is a small, playable browser proof for the project's measured battle-stage hook. It is deliberately **not** the template-compliant 20–40 minute first playable.

- **FP-0 (this folder):** one original Bell Court encounter that validates integer-space movement, 2-Pace turns, Tempo/recovery, Guard/Dodge, delivery + essence resistance, deterministic Oni AI, victory/defeat, and restart.
- **FP-1 (planned Takamine Vertical Slice):** the 28–34 minute field route, scenes, learning battles, Mateus reveal, and boss specified in the narrative documents.

The rules contract is in [the technical GDD](../docs/02-technical-gdd.md). The prototype names Ren Ishikawa, Elisabet “Lise” Varga, and Father Mateus Avelar in its opening record so the intended narrative relationship is visible without pretending that this one-combatant proof has a full party or story implementation.

## Run it

No dependency install is required. Node.js and Python are the only local tools used.

```powershell
cd C:\projects\JRPG\game
npm run check
npm test
npm run serve
```

Then open `http://localhost:8080` in a browser. Stop the local server with `Ctrl+C` when finished.

## Controls

| Control | Action |
| --- | --- |
| Arrow keys / WASD | Move Ren one orthogonal combat space. |
| Q / E / Z / C | Move Ren one diagonal combat space. |
| 1 / 2 / 3 | Courier’s Cut / Cinder Route / Dawn Signal. |
| G / F | Guard / Dodge. |
| R | Restart the encounter. |
| Mouse or touch | Use the labeled command buttons. |

Each Ren Activation begins with two Pace. Move first if useful, then commit one command. Commands add Recovery pulses (one pulse is 800 ms) before Ren can return to the Tempo ribbon. Menu time is paused; this is not real-time combat.

## What to look for

- The central lacquer gate makes the upper/lower flanks tactically meaningful.
- The Oni’s Ledger reveals 125% Ember/Radiance weakness and 75% Umbral resistance; Ren has 75% Umbral resistance.
- Every hit reports base damage, delivery, optional Essence, multiplier, Guard reduction, and final damage.
- Guard applies to the next hit. Dodge only applies to the next dodgeable physical hit; `Moonless Thorns` is Arcane + Umbral and cannot consume it.

All visuals are original Canvas pixel primitives. The build has no downloaded assets, copied character names, or real-person likeness.
