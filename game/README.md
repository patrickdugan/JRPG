# Bells of the Black Chrysanthemum — Browser Runtime

This folder contains the playable browser runtime and the original small combat proof. The campaign, field, quest, battle, advancement, loadout, and playtime saves now share one browser runtime, but the 20-hour target remains a production claim that requires an end-to-end timed playtest.

- **FP-0 (this folder):** one original Bell Court encounter that validates integer-space movement, 2-Pace turns, Tempo/recovery, Guard/Dodge, delivery + essence resistance, deterministic Oni AI, victory/defeat, and restart.
- **FP-1 (Takamine Vertical Slice content):** the 28–34 minute field route, scenes, learning battles, Mateus reveal, and boss specified in the narrative documents.
- **Campaign (`campaign.html`):** all 11 chapters / 60 authored scenes, 2,746 persistent dialogue lines, 60 bespoke atmosphere/score/camera/blocking transcripts, and 183 ordered once-per-save field operations. Every operation uses exact movement and authored instructions; encounter nodes bind the existing canonical fight and cannot create a duplicate battle. New Game unlocks the complete authored Prologue roster, and each completed frontier atomically unlocks the next chapter's roster. A witness combat stage consumes an already-recorded canonical victory instead of forcing a duplicate battle. A live route ledger prevents the next story frontier from closing until each newly unlocked intended-route entry has begun. Its due entries are actionable: one click enters the exact quest/chronicle route or deep-links to and begins the requested Camp talk, council, or archive record.
- **Intended-route journal:** 13 finite side quests, 18 finite witness chronicles, and four one-circuit repeat milestones use ordered objectives and direct journal travel. Witness testimony advances one line at a time across 152 exact fieldwork nodes; finite rewards settle transactionally and refuse one-time replay.
- **Campaign Battle (`battle.html?encounter=...`):** a shared multi-party engine for all authored encounters, including bounded Spirit, six live statuses, Tempo/recovery, Pace, typed damage, Guard, Analyze, deterministic enemy AI, 18 objective presentations, nonlethal actions, XP, levels, rewards, equipped loadout modifiers, deterministic attack timelines, and repeat-only 1×/2×/4× Auto-Grind. Optional queues run 1, 5, or 10 wins; every victory and reward becomes durable before the next repeat starts, while cancellation, defeat, restart, or reload stops the session-only queue. Victory is durable before Continue appears: advancement, loot/vitals, requested quest or chronicle evidence, field resolution, and clean-run first-clear evidence share one compensating transaction.
- **Camp & Loadout (`camp.html`):** party vitals, Spirit/status recovery, consumables, shops, buy/sell, gear, forge upgrades, two Vow slots per character, three camp-rest tiers, the original six-character field atlas, 90 finite two-person companion conversations, 30 multi-character party councils, and a 60-record public reading table tied to canonical story beats. Required reading supports `N` for one exact next-line transition and `1`/`2` for explicit choices; held-key repeats are ignored.
- **Active-play telemetry:** narrative, exploration, first-clear battles, repeat grind, and camp/menu time accumulate in both a general record and a clean-start, UUID-bound run receipt. Samples suspend after 30 seconds without input. Campaign, Battle, Camp, and Credits attach every clean-run sample to a canonical chapter; Credits renders the live five-category ledger plus actual/reference time and completed-chapter gap for all eleven chapters. The 20:31:41 reference checkpoints are quantity-model diagnostics, never observed proof, and reconcile exactly to the complete 215-activity 1× route. The exported combined verdict requires zero unattributed time. The player-facing credits seal additionally requires completed evidence for all 215 intended-route activities; duration proof still needs 20 active hours from that same run, all 60 scenes, every canonical first clear, and explicit credits completion. Credits can export a signed schema-v2 JSON report containing every satisfied or missing proof condition plus the diagnostic checkpoint signature and per-chapter actual/reference deltas.
- **Recovery checkpoints:** Campaign can export or import one portable, signed recovery-only JSON file containing the exact serialized values of all 13 save authorities. Restore validates every record, run binding, campaign/receipt beat agreement, first-clear support, route summary, and contract signature before writing; a failed write rolls every touched value back exactly. Restore replaces the whole bundle and reloads the recovered run. It never merges progress and never counts as independent duration or route proof.

The rules contract is in [the technical GDD](../docs/02-technical-gdd.md). The prototype names Ren Ishikawa, Elisabet “Lise” Varga, and Father Mateus Avelar in its opening record so the intended narrative relationship is visible without pretending that this one-combatant proof has a full party or story implementation.

## Run it

No dependency install is required. Node.js and Python are the only local tools used.

```powershell
cd C:\projects\JRPG\game
npm run check
npm test
npm run serve
```

Then open `http://localhost:8080/` for the optional training proof, `http://localhost:8080/campaign.html` for the full Campaign, `http://localhost:8080/camp.html` for Camp & Loadout, or `http://localhost:8080/credits.html` for the explicit ending boundary. Stop the local server with `Ctrl+C` when finished.

For an isolated real-browser pass, install the optional Python `playwright` package and run:

```powershell
python tools/browser-smoke.py
```

The harness uses fresh Chromium contexts and an ephemeral localhost port. It verifies New Game exposes both authored Prologue members, a fresh one-click opening route action and Camp deep link, a real keyboard archive advance, Campaign/Camp receipt continuity, first-clear speed gating, saved 4× repeat speed, and a complete Auto-Grind victory and reward. A separate clean context seeds only canonical story/party prerequisites, then completes all 90 companion talks, 30 councils, and 60 archive readings through their rendered list, choice, and advance controls—5,795 persisted control activations—while proving the receipt gained neither beat evidence nor a duration verdict. Another clean context exports all 13 recovery records, replaces the run, restores the file through the rendered import control, reloads, and compares every authority string exactly while retaining `durationProven: false`. The harness also covers the all-215 credits gate and explicit seal, a downloaded and parsed evidence report, exact 390×844 no-overflow geometry and visible primary controls across all five pages, duplicate-ID/access-name/image-alt semantic gates, keyboard reachability, denied-storage startup, HTTP delivery, and console cleanliness without touching the player's browser profile.

For the stricter rendered-control-only route probe, run:

```powershell
python tools/browser-route-playthrough.py --max-scenes 10 --max-seconds 300
```

That driver starts with the rendered New Game button, reads only published DOM text/`data-*` state, and mutates the game only through clicks and keys. A chained same-run receipt has reached 14/60 scenes, 21/215 route entries, 6/23 durable first clears, and 19:14 active play, with no console/page errors. It is not yet a complete route witness. Add `--require-complete` only when running an intentionally long full-route gate.

Long QA routes can continue across bounded sessions without direct save injection. Export and restore the game's explicitly recovery-only 13-authority bundle through its rendered controls:

```powershell
python tools/browser-route-playthrough.py --max-scenes 10 --max-seconds 450 --recovery-out route-recovery.json
python tools/browser-route-playthrough.py --max-scenes 10 --max-seconds 450 --recovery-in route-recovery.json --recovery-out route-recovery-next.json
```

The runner labels both files `recoveryOnly: true` and `proofClaimed: false`; they preserve continuity but cannot prove duration.

To verify every shipped browser file over a real local HTTP boundary without installing another package, run:

```powershell
python tools/static-delivery.py
```

The current release manifest contains 88 byte-verified files: five pages, five stylesheets, five controllers, 67 modules, five PNG production assets, and one SVG favicon.

## FP-0 controls

| Control | Action |
| --- | --- |
| Arrow keys / WASD | Move Ren one orthogonal combat space. |
| Q / E / Z / C | Move Ren one diagonal combat space. |
| 1 / 2 / 3 | Courier’s Cut / Cinder Route / Dawn Signal. |
| G / F | Guard / Dodge. |
| R | Restart the encounter. |
| Mouse or touch | Use the labeled command buttons. |

## Campaign controls

| Control | Action |
| --- | --- |
| W / A / S / D | Move exactly one open field space orthogonally. |
| Q / E / Z / C | Move exactly one open field space diagonally; both cardinal corner spaces must be open. |
| X | Record the current exact-tile story operation, use an authored interaction, advance a side-story/witness marker, or inspect/use an exit. |
| N | Advance and acknowledge the staged scene dialogue. |
| Left / Right | Previous / next authored scene. |
| 1–9 | Select the corresponding scene choice. |
| Mouse or touch | Use the field pad and interaction button, or select chapters, quests, choices, and scene controls. |

The Atlas stores versioned, validated campaign, scene-operation, field, narrative, quest, witness, companion-conversation, party-council, public-archive, loadout, advancement, telemetry, and run-receipt saves in browser local storage. Entering a placed encounter trigger opens the associated battle; victory resolves that trigger when the player returns. An authored exit can move to the next scene or an already-unlocked destination only when its field conditions, ordered operation, and required first clears are satisfied. `New Game / clear all saves` starts a zero-time UUID run receipt across every save domain and grants the authored current-chapter roster; older saves remain explicitly unverified instead of inheriting historical time. Campaign's recovery controls export or replace all 13 domains together; close other game tabs before importing.

## Campaign battle controls

| Control | Action |
| --- | --- |
| W / A / S / D or arrows | Move the active party member one orthogonal combat space. |
| Q / E / Z / C | Move one strict diagonal combat space. |
| Command deck | Choose Attack, Skill, Guard, Analyze, or the encounter-specific Objective action. |
| Canvas / enemy cards | Select an adjacent destination or hostile target. |
| 1× / 2× / 4× | Set the saved repeat speed. Manual play shortens enemy presentation only. |
| Repeat wins + Start Auto-Grind | After one manual clear, queue 1, 5, or 10 deterministic repeat wins at the saved speed. Each reward saves before the next fight; cancellation, defeat, restart, or reload stops the queue. |
| Restart | Replay the encounter. First-clear loot stays unique; repeat XP and currency diminish to a stable floor. |

The explicit 215-activity route targets 20 hours at 1×. Duration audit v8 excludes authored minute labels and open-ended repeats; it estimates the canonical story at 186.549/308.680/498.286 minutes and the complete intended route at 776.626/1,231.686/1,917.264 minutes low/reference/high. The intended-route reference model clears 20 hours by 31.686 minutes, while canonical-only reference play is about 5.14 hours. Only four measured repeat schedules accelerate, producing reference estimates of 1,231.379 minutes at 2× and 1,231.226 at 4×. This arithmetic is not observed playtime. The target remains unproven until one clean human run completes the route and records at least 20 active hours.

The bounded `canonical-run.mjs` audit proves mechanical completion without pretending to prove duration: one deterministic zero-time run covers 60 beats, 2,746 dialogue lines, 59 choices, 60/60 scene operations, 183/183 operation nodes, 34 route chains, 1,419 legal field moves, 236 interactions, 41 exits, 23 first clears, 228 player commands, 100 enemy activations, and 16 safehouse rests. Its stable signature is `fnv1a32:029392d1`; its run receipt is complete and correctly reports `durationProven: false`.

The separate `finite-content-run.mjs` witness completes all 13 side quests, 59 objectives, 18 chronicles, 288 testimony acknowledgements, 67 stages, and 31 one-time reward settlements while refusing replay and leaving all four repeat contracts out of the finite count. It deliberately records zero elapsed time. The UUID run receipt can collect the necessary same-run cross-page evidence, but no complete run has yet met the duration-proof gate.

The chronological `required-route-run.mjs` witness combines the canonical and finite systems into the exact 215-activity itinerary. It completes 60 beats, 23 first clears, 13 quests, 18 chronicles, 90 talks, 30 councils, 60 archive records, and four genuine repeat wins through 7,580 public transitions. Its witness-fieldwork component starts 67 fresh authored map contexts and reaches all 152 ordered nodes through exactly 729 public `moveFieldBy` steps, with zero coordinate jumps. Contract signature: `fnv1a32:b7b98301`; fieldwork traversal signature: `fnv1a32:18eed422`; executable signature: `fnv1a32:deee52ef`. Its 1×/2×/4× repeat schedules are measured engine output with invariant decisions and rewards. It records zero elapsed time and makes no duration claim from deterministic traversal.

The `camp-conversation-run.mjs` witness completes all 90 finite companion talks in canonical order: 3,644 main-line acknowledgements, 270 selected response acknowledgements, 90 explicit choices, 4,094 successful transitions, and 90 replay refusals. The catalogue contains 83,435 authored words across both branches; the duration audit counts 76,547 words visible on its canonical first-choice path. Its prose-bound catalogue signature is `fnv1a32:3265b9bc`, its completion signature is `fnv1a32:d09e58ef`, and it records zero elapsed time.

The `party-council-run.mjs` witness completes all 30 multi-character councils: 993 main-line acknowledgements, 90 selected response acknowledgements, 30 decisions, 1,143 successful transitions, and 30 replay refusals. Its 27,506-word catalogue exposes 25,072 words on the canonical first-choice path. Its prose-bound catalogue signature is `fnv1a32:01bf3c11`, its completion signature is `fnv1a32:51f4030c`, and it records zero elapsed time.

The `archive-record-run.mjs` witness reads all 60 beat-bound public records across 498 paragraphs, executes 558 successful transitions, records 619 trace events, and refuses all 60 replay attempts. Its prose-bound catalogue signature is `fnv1a32:afd97309`, its completion signature is `fnv1a32:fda26e63`, and it records zero elapsed time.

## Camp & Loadout controls

Camp supports mouse/touch throughout and keyboard reading controls for finite narrative: `N` acknowledges exactly one current talk, council, or archive line, while `1`/`2` selects the corresponding visible response or decision. Held-key repeats and modified shortcuts are ignored. Choose an unlocked party member, equip or store gear, learn and bind up to two Vows, use consumables, buy/sell/forge items, or choose one of three rest tiers. The selected rest point exposes eligible companion talks and join-safe party councils; finish the selected branch before beginning another entry in that system. The public reading table opens one record after each completed story beat. Completed talks, councils, and records can be reviewed without mutating finite progress. Rest and item transitions are atomic: failed purchases or already-full recovery do not spend currency or inventory. Equipment and Vow modifiers are applied when the campaign battle page builds party profiles.

The narrative-rest systems are documented in [the companion conversation bible](../docs/16-companion-conversation-bible.md), [the public archive reading bible](../docs/17-public-archive-bible.md), and [the party council bible](../docs/18-party-council-bible.md).

Each Ren Activation begins with two Pace. Move first if useful, then commit one command. Commands add Recovery pulses (one pulse is 800 ms) before Ren can return to the Tempo ribbon. Menu time is paused; this is not real-time combat.

## What to look for

- The central lacquer gate makes the upper/lower flanks tactically meaningful.
- The Oni’s Ledger reveals 125% Ember/Radiance weakness and 75% Umbral resistance; Ren has 75% Umbral resistance.
- Every hit reports base damage, delivery, optional Essence, multiplier, Guard reduction, and final damage.
- Guard applies to the next hit. Dodge only applies to the next dodgeable physical hit; `Moonless Thorns` is Arcane + Umbral and cannot consume it.

All visuals are original project assets or Canvas pixel primitives. The provisional directional party atlas and transparent eight-family enemy combat atlas were generated for this project with recorded prompts. The battle renderer combines those atlases with deterministic wind-up, exact-grid lunge, projectile/trail, impact, status, stagger, and recovery phases. The assets explicitly exclude real-person likenesses; no copied character names or franchise assets are used.
