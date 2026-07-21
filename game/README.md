# Bells of the Black Chrysanthemum — Browser Runtime

## Action-combat migration

`action-battle-prototype.html` is the non-canonical side-view real-time feel proof. Ren runs and jumps freely except during fixed wind-up, active-hit, and recovery animation commitment. A shared weapon cooldown and longer Cinder Route cooldown begin only afterward, remain visible in milliseconds, and permit immediate movement. Level changes timers through `max(0.55, 1 - 0.0125 × (level - 1))` without accelerating animation.

`action-campaign-battle.html?encounter=c1-cinder-hounds` is the non-canonical integrated campaign controller. It uses real encounter/stage data, the fixed-step action kernel, deterministic companion AI, one directly controlled fighter, live-state-preserving party switching, all 18 objective contracts through the shared evaluator, and the existing atomic victory transaction. When both are deployed, Nikola and Mateus can invoke Black Sun Concord within 180 px: Dawn Bolt remains a separate Arcane/Radiance hit, Penitent Night remains a separate Arcane/Umbral hit, both commit at the same kernel time, and each art starts only its normal level-scaled cooldown after animation. Twelve objective families are fully connected. Six families that need escort/incapacitation tokens, protected scenery, or attackable phase objects explicitly keep settlement locked. The existing Campaign Battle remains canonical until those families and full boss/effect behavior migrate.

This folder contains the playable browser runtime and the original small combat proof. The campaign, field, quest, battle, advancement, loadout, Storyworld, and playtime saves share one browser runtime. The ordinary 5–6 hour narrative target and optional 20-hour completionist target remain production claims until measured by end-to-end human playtests.

- **FP-0 (this folder):** one original Bell Court encounter that validates integer-space movement, 2-Pace turns, Tempo/recovery, Guard/Dodge, delivery + essence resistance, deterministic Oni AI, victory/defeat, and restart.
- **FP-1 (Takamine Vertical Slice content):** the 28–34 minute field route, scenes, learning battles, Mateus reveal, and boss specified in the narrative documents.
- **Campaign (`campaign.html`):** all 11 chapters / 60 canonical scenes plus ten Storyworld decisions and one of two consequences per decision: 90 authored scenes, 80 played on one narrative route. Five Storyworld decisions occur before bosses, three consequences after levels, and two consequences after bosses. The 2,746 persistent canonical dialogue lines, 60 bespoke atmosphere/score/camera/blocking transcripts, and 183 ordered once-per-save field operations remain intact. Every operation uses exact movement and authored instructions; encounter nodes bind the existing canonical fight and cannot create a duplicate battle. The party field atlas supplies directional idle/walk plus live interaction and non-gory hazard-hit reactions; successful persisted movement leaves an ephemeral, collision-free trail for visible formation followers. Exact presentation copy covers all 113 field interactables while save-stable IDs remain internal. New Game unlocks the complete authored Prologue roster, and each completed frontier atomically unlocks the next chapter's roster. A witness combat stage consumes an already-recorded canonical victory instead of forcing a duplicate battle. The actionable 215-activity route ledger remains visible as optional completionist work and never blocks narrative advancement.
- **Scene panoramas:** one original deterministic 1600×720 atlas contains 20 opaque 320×180 backdrops mapped explicitly across all 60 canonical beats. A separate decorative 16:9 Canvas sits beneath the existing focus portrait and adjacent text authority. Exact canonical-level compatibility rejects routed mismatches; unknown, mismatched, undecoded, and wrong-size art retains the static code-native fallback without affecting maps, collision, routes, objectives, saves, telemetry, or evidence.
- **Intended-route journal:** 13 finite side quests, 18 finite witness chronicles, and four one-circuit repeat milestones use ordered objectives and direct journal travel. Witness testimony advances one line at a time across 152 exact fieldwork nodes; finite rewards settle transactionally and refuse one-time replay.
- **Campaign Battle (`battle.html?encounter=...`):** a shared multi-party engine for all authored encounters, including bounded Spirit, six live statuses, Tempo/recovery, Pace, typed damage, Guard, Dodge, Item, Analyze, deterministic enemy AI, 18 objective presentations, nonlethal actions, XP, levels, rewards, equipped loadout modifiers, deterministic attack timelines, and repeat-only 1×/2×/4× Auto-Grind. Guard, Dodge, Item, Analyze, and objective commands have bounded actor/target feedback; move, blocked-move, selected-target, real Recovery-lock attempts, and pulse-exact Tempo readiness use exact board geometry without adding input locks. Corroborated typed damage and heal events publish exact damage/restoration flyouts through their exact seams. Party, regular-enemy, and boss recovery use authored poses; regular-enemy target staggers use authored non-gory hurt keys; and five bosses have typed phase state, exact warnings, and transition holds. FP-1 Mateus has dormant/active/broken Blood Wards, explicit 25% ward mitigation, a four-tile Crimson Litany answer window, Recovery 3, and a nonlethal surrender branch. Optional queues run 1, 5, or 10 wins; Auto-Grind never selects Item, and every victory and reward becomes durable before the next repeat starts. Victory is durable before Continue appears: advancement, loadout item debits/rewards/survivor HP, requested quest or chronicle evidence, field resolution, and clean-run first-clear evidence share one compensating transaction.
- **Camp & Loadout (`camp.html`):** party vitals, Spirit/status recovery, consumables, shops, buy/sell, gear, forge upgrades, two Vow slots per character, three camp-rest tiers, the authored six-character/eight-expression portrait atlas with a procedural failure fallback, 90 finite two-person companion conversations, 30 multi-character party councils, and a 60-record public reading table tied to canonical story beats. Required reading supports `N` for one exact next-line transition and `1`/`2` for explicit choices; held-key repeats are ignored.
- **Synthesized audio:** all five browser surfaces expose the same labelled Sound toggle, volume range, and polite status. AudioContext creation remains behind the visible player gesture; exploration, battle, and boss loops plus transition cues are generated locally without fetched assets. The versioned device preference is intentionally excluded from New Game, the fourteen recovery authorities, playtime, receipts, and evidence exports.
- **Active-play telemetry:** narrative, exploration, first-clear battles, repeat grind, and camp/menu time accumulate in both a general record and a clean-start, UUID-bound run receipt. Samples suspend after 30 seconds without input. Campaign, Battle, Camp, and Credits attach every clean-run sample to a canonical chapter; Credits renders the live five-category ledger plus actual/reference time and completed-chapter gap for all eleven chapters. Narrative New Game requires 60 canonical scenes, 20 played Storyworld scenes, and at least five observed active hours; the 215-activity/20-hour completionist contract is separate and optional. The 20:31:55.967 completionist checkpoints are quantity-model diagnostics, never observed proof. Signed schema-v3 evidence publishes separate narrative and completionist verdicts, reconciles Storyworld and receipt authorities, and requires zero unattributed time.
- **Recovery checkpoints:** Campaign can export or import one portable, signed recovery-only JSON file containing the exact serialized values of all 14 save authorities, including Storyworld. Restore validates every record, run binding, campaign/receipt beat agreement, first-clear support, Storyworld ordering, route summary, and contract signature before writing; a failed write rolls every touched value back exactly. Restore replaces the whole bundle and reloads the recovered run. It never merges progress and never counts as independent duration or route proof. Signed 13-authority legacy files migrate to explicitly proof-ineligible late-coverage Storyworld state.

The NPC atlas contains 16 exact community roles with idle and gesture poses, for 32 deterministic runtime frames. Nine singleton level contacts and four named side-story contacts resolve explicit roles from authored metadata; four collective talk targets remain geometric. The 37/183 interview operations intentionally retain the generic interviewee presentation. The resolver never infers roles from IDs, prose, labels, or names. Reduced motion freezes gestures on idle. Witness fieldwork and props, hazards, exits, evidence, mechanisms, deliveries, care/rescue, councils, combat, and ambiguous groups retain geometric markers; interviewee number badges remain visible. The generated 1448×1086 community roster in `assets/production` is a non-runtime external-review reference, not a shipped sprite authority.

Campaign Battle draws distinct authored apply/refreshed, persistent-active, and expire art for Dread, Chill, Shock, Scorch, Bound, and Overheated. Expiry is non-locking, 520 ms at 1× and presentation-scaled at 2×/4×; reduced motion holds a static readable frame. No cleanse event exists, so there is no cleanse frame. Unknown statuses and Final Ward Open retain their existing generic/special fallback. Distinct victory and defeat border treatments are live, result-gated, non-locking, and reduced-motion static. Typed damage feedback gives absorption its own exact restored-HP/ABSORB read. River Salve now emits exact `item-used` and `heal` records; the feedback seam proves catalogue, event order, HP, stock, consumption, actor, target, and pulse before showing its heal flyout and single `combatHeal` cue. A later exact Scorch trigger may reduce the final snapshot without rewriting the heal boundary.

Campaign Dodge is deterministic: after the command, the next incoming art with an exact catalogue value of `dodgeable: true` misses and consumes the stance. The engine never infers eligibility from delivery, Essence, target shape, animation, or prose. Non-dodgeable arts, status resolution, and attacks against other party members retain the stance; committing Guard replaces Dodge and committing Dodge replaces Guard. Its base Recovery is 1, it spends no Spirit, and the same loadout/status Recovery deltas as other commands apply with a final minimum of 1. It never changes a simulation position or creates a reflex window. The renderer uses persistent code-native chevrons and the existing authored move pose for the bounded evasion read, not a bespoke Dodge bitmap. Current deterministic repeat traces expose a dodgeable enemy art in six encounters; balance and human-readability review remain unproven. This Campaign rule is separate from FP-0's unchanged seeded 65% physical-dodge proof.

River Salve is the only battle-eligible consumable. `I` opens text-authoritative item and ally selectors; any living deployed ally can be targeted at any distance, but defeated or full-HP targets cannot consume stock. It restores at most 80 HP, has base Recovery 2 with normal modifiers and a one-pulse floor, spends no Pace or Spirit, and preserves stance. Its 720 ms command presentation reuses the canonical item icon atlas and becomes static under reduced motion; it never invokes an attack animation or hit cue. Stock remains provisional through defeat, restart, and reload and is debited only with victory. MP, Spirit, and status-cleansing consumables remain Camp-only pending authority reconciliation.

Party field art provides walk-A and walk-B keys for all six members and four directions. Campaign's field-leader selector is populated only from the active level's canonical formation, persists one preferred member in the existing field-v1 flag authority, and falls back to that formation's first member without erasing the preference. The effective leader owns idle, both walk keys, interact/hurt poses, and field-hazard vitals. Remaining formation members consume only successful departed tiles from an 84-node presentation trail; blocked or failed-persistence movement cannot update it, context changes reset it, and no follower owns collision, hazards, interaction range, saves, or proof. Reduced motion keeps every row on directional idle. A deterministic 19-overlay terrain atlas covers all live level tags while leaving flat colors as the load/wrong-size/unknown fallback. Camp inventory/shop cards and Battle's River Salve preview reuse the complete 25-frame item-icon atlas while retaining item names, descriptions, quantities, prices, and contextual labels as the accessible authority and a text/code-native image-failure path.

The rules contract is in [the technical GDD](../docs/02-technical-gdd.md). The prototype names Ren Ishikawa, Nikola Dražanić, and Father Mateus Avelar in its opening record so the intended narrative relationship is visible without pretending that this one-combatant proof has a full party or story implementation. Nikola is a fictional minor Croatian frontier noble who insists on a grander countly style than his standing warrants; his competence, entitlement, and abrasive rapport with Mateus are deliberate character flaws rather than player endorsement.

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

The harness uses fresh Chromium contexts and an ephemeral localhost port. The current integrated pass completed in 159.4 seconds on installed Chrome. It verifies New Game selects the narrative profile and exposes both authored Prologue members, a fresh one-click opening route action and Camp deep link, a real keyboard archive advance, Campaign/Camp receipt continuity, first-clear speed gating, one real `F`-selected Dodge with an armed cue and HP-neutral consumed miss, and one real `I`-selected River Salve heal with ready icon art, reload refund, victory-only deduction, and one settlement revision. The opening scene panorama must decode `ready` at exact 320×180; broken and wrong-size PNGs must retain the nonblank fallback, the browser-loaded registry must reject a noncanonical level, responsive scaling must remain 16:9, and reduced motion must remain static. It also proves saved 4× repeat speed and a complete Auto-Grind victory and reward without Item selection. A separate Kagura context performs one legal persisted field move and requires Aya to render as the first follower in the exact six-member formation. Another context renders the `sw3` pre-boss decision, proves movement/dialogue/battle/advance controls blocked, makes entry and consequence choices through player-facing controls, and requires the receipt and Storyworld authority to persist the same ordered prefix. The recovery context exports all 14 authorities, replaces the run, restores through the rendered import control, and compares every raw string exactly while retaining `durationProven: false`. A narrative-complete 80-scene setup remains unsealed for `active-playtime-incomplete`; downloaded schema-v3 evidence retains false duration/release verdicts while the optional 215 ledger stays nonblocking. The full 180-entry Camp catalogue, exact 390×844 geometry, semantic gates, keyboard reachability, denied-storage startup, HTTP delivery, and empty console/page/HTTP error arrays are also covered without touching the player's browser profile. This bounded smoke does not claim a current full route or five-hour timing proof.

For the stricter rendered-control-only route probe, run:

```powershell
python tools/browser-route-playthrough.py --max-scenes 10 --max-seconds 300
```

That driver starts with the rendered New Game button, reads only published DOM text/`data-*` state, and mutates the game only through clicks, keys, and player-visible native prompt choices. Three chained sessions on runtime commit `d45dfb2` completed 60/60 scenes, 215/215 intended-route activities, and 23/23 durable first clears on clean run `ec3182b2-73b3-4b83-90b1-79a740e036ed`, then explicitly sealed Credits at 00:28:13. The [downloaded schema-v2 evidence](../docs/rendered-route-playtest-evidence.json) is byte-canonical with signature `fnv1a32:31d04d74` and SHA-256 `BDF021E41DC7DBD42948756D19DEC25E5BB25B682BB5874B19CB9F5366BAA57A`; it records zero unattributed milliseconds and correctly retains `durationProven: false`. Every segment recorded empty console/page error arrays. Rendered recovery import/export preserved continuity across fresh contexts, but each file remains labeled `recoveryOnly: true` and `proofClaimed: false`; the cumulative rendered logs and final signed evidence witness the current recorded route, while no checkpoint file independently proves route completion or duration. Add `--require-complete` and `--evidence-out` for an intentionally long full-route gate that must seal Credits and retain the downloaded evidence report.

The segmented route receipt above covers only the recorded `d45dfb2` runtime. It predates every later status, NPC, battle-feedback, walk-in-between, item-art, terrain, field-leader, level-metadata, telegraph-evasion, formation-follow, interaction-copy, typed-damage-outcome, and scene-backdrop wave; those waves pass their own full unit, static-delivery, and Chrome gates but have not inherited a segmented route claim. It also predates Campaign Dodge and Campaign Item, which likewise do not inherit a segmented route claim. `durationProven` remains false.

Long QA routes can continue across bounded sessions without direct save injection. Export and restore the game's explicitly recovery-only 14-authority bundle through its rendered controls:

```powershell
python tools/browser-route-playthrough.py --max-scenes 10 --max-seconds 450 --recovery-out route-recovery.json
python tools/browser-route-playthrough.py --max-scenes 10 --max-seconds 450 --recovery-in route-recovery.json --recovery-out route-recovery-next.json
python tools/browser-route-playthrough.py --max-scenes 60 --max-seconds 900 --recovery-in route-recovery-next.json --require-complete --evidence-out route-evidence.json
```

The runner labels both recovery files `recoveryOnly: true` and `proofClaimed: false`; they preserve continuity but cannot prove duration. The separate evidence file is available only after the rendered Credits seal succeeds.

To verify every shipped browser file over a real local HTTP boundary without installing another package, run:

```powershell
python tools/static-delivery.py
```

The current release manifest contains 162 byte-verified files and 10,802,743 delivered bytes: seven pages, eight stylesheets, seven controllers, 105 modules, 34 PNG production assets, and one SVG favicon.

## FP-0 controls

| Control | Action |
| --- | --- |
| Arrow keys / WASD | Move Ren one orthogonal combat space. |
| Q / E / Z / C | Move Ren one diagonal combat space. |
| 1 / 2 / 3 | Courier’s Cut / Cinder Route / Dawn Signal. |
| G / F | Guard / Dodge. |
| R | Restart the encounter. |
| Mouse or touch | Use the eight-way movement pad and labeled command buttons. |

## Integrated action-controller controls

| Control | Action |
| --- | --- |
| A / D or Left / Right | Run freely across the side-view stage. |
| W or Up | Grounded jump. |
| J / Space | Commit the controlled fighter's weapon art. |
| K | Commit the controlled fighter's second art when present. |
| L | Invoke Black Sun Concord when Nikola and Mateus are living, within 180 px, ready, and one is directly controlled. |
| E | Interact with or hold the current objective cast at an authored anchor. |
| Tab / Shift+Tab | Switch direct control forward/backward through living party members without resetting position, HP, animation, or cooldowns. |
| R | Restart the unsettled encounter. |
| Touch controls | Expose movement, jump, both ordinary arts, objective action, party switching, and the Hunter + Priest combo. |

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

The Atlas stores versioned, validated campaign, Storyworld, scene-operation, field, narrative, quest, witness, companion-conversation, party-council, public-archive, loadout, advancement, telemetry, and run-receipt saves in browser local storage. Entering a placed encounter trigger opens the associated battle; victory resolves that trigger when the player returns. An authored exit can move to the next scene or an already-unlocked destination only when its field conditions, ordered operation, and required first clears are satisfied. `New Game / clear all saves` starts a zero-time narrative-profile UUID run receipt across every save domain and grants the authored current-chapter roster; older saves remain explicitly unverified instead of inheriting historical time. Campaign's recovery controls export or replace all 14 domains together; close other game tabs before importing.

## Campaign battle controls

| Control | Action |
| --- | --- |
| W / A / S / D or arrows | Move the active party member one orthogonal combat space. |
| Q / E / Z / C | Move one strict diagonal combat space. |
| F | Select Dodge without replacing the existing 1–6 command shortcuts. |
| I | Select Item without replacing the existing 1–6 or `F` shortcuts. |
| Command deck | Choose Attack, Skill, Guard, Dodge, Item, Analyze, or the encounter-specific Objective action. |
| Canvas / actor cards | Select an adjacent destination, hostile target, or living Item ally. |
| 1× / 2× / 4× | Set the saved repeat speed. Manual play shortens enemy presentation only. |
| Repeat wins + Start Auto-Grind | After one manual clear, queue 1, 5, or 10 deterministic repeat wins at the saved speed. The policy never uses Item. Each reward saves before the next fight; cancellation, defeat, restart, or reload stops the queue. |
| Restart | Replay the encounter and refund attempt-local Item use. First-clear loot stays unique; repeat XP and currency diminish to a stable floor. |

The ordinary 80-scene narrative route has a 309.249-minute canonical reference plus 15.118 minutes for the longest visible Storyworld path, or 324.367 minutes (about 5.41 hours). The optional 215-activity route targets 20 hours at 1×. Duration audit v8 excludes authored minute labels and open-ended repeats; it estimates canonical content at 186.868/309.249/499.306 minutes and the all-finite route at 776.975/1,232.299/1,918.346 minutes low/reference/high. The optional reference clears 20 hours by 32.299 minutes. Only four measured repeat schedules accelerate, producing reference estimates of 1,231.993 minutes at 2× and 1,231.839 at 4×. This arithmetic is not observed playtime; both targets require human receipts.

The bounded `canonical-run.mjs` audit proves mechanical completion without pretending to prove duration: one deterministic zero-time run covers 60 beats, 2,746 dialogue lines, 59 choices, 60/60 scene operations, 183/183 operation nodes, 34 route chains, 1,419 legal field moves, 236 interactions, 41 exits, 23 first clears, 231 player commands, 97 enemy activations, and 17 safehouse rests. Its stable signature is `fnv1a32:ff4e1361`; its run receipt correctly reports `durationProven: false`.

The separate `finite-content-run.mjs` witness completes all 13 side quests, 59 objectives, 18 chronicles, 288 testimony acknowledgements, 67 stages, and 31 one-time reward settlements while refusing replay and leaving all four repeat contracts out of the finite count. It deliberately records zero elapsed time. The UUID run receipt can collect the necessary same-run cross-page evidence, but no complete run has yet met the duration-proof gate.

The chronological `required-route-run.mjs` witness combines the canonical and finite systems into the exact 215-activity itinerary. It completes 60 beats, 23 first clears, 13 quests, 18 chronicles, 90 talks, 30 councils, 60 archive records, and four genuine repeat wins through 7,580 public transitions. Its witness-fieldwork component starts 67 fresh authored map contexts and reaches all 152 ordered nodes through exactly 729 public `moveFieldBy` steps, with zero coordinate jumps. Contract signature: `fnv1a32:b7b98301`; fieldwork traversal signature: `fnv1a32:18eed422`; executable signature: `fnv1a32:deee52ef`. Its 1×/2×/4× repeat schedules are measured engine output with invariant decisions and rewards. It records zero elapsed time and makes no duration claim from deterministic traversal.

The `camp-conversation-run.mjs` witness completes all 90 finite companion talks in canonical order: 3,644 main-line acknowledgements, 270 selected response acknowledgements, 90 explicit choices, 4,094 successful transitions, and 90 replay refusals. The catalogue contains 83,435 authored words across both branches; the duration audit counts 76,547 words visible on its canonical first-choice path. Its prose-bound catalogue signature is `fnv1a32:27c27bb7`, its completion signature is `fnv1a32:316369e1`, and it records zero elapsed time.

The `party-council-run.mjs` witness completes all 30 multi-character councils: 993 main-line acknowledgements, 90 selected response acknowledgements, 30 decisions, 1,143 successful transitions, and 30 replay refusals. Its 27,506-word catalogue exposes 25,072 words on the canonical first-choice path. Its prose-bound catalogue signature is `fnv1a32:10ab0f26`, its completion signature is `fnv1a32:3d9bf1af`, and it records zero elapsed time.

The `archive-record-run.mjs` witness reads all 60 beat-bound public records across 498 paragraphs, executes 558 successful transitions, records 619 trace events, and refuses all 60 replay attempts. Its prose-bound catalogue signature is `fnv1a32:b98f9711`, its completion signature is `fnv1a32:d5cae18f`, and it records zero elapsed time.

## Camp & Loadout controls

Camp supports mouse/touch throughout and keyboard reading controls for finite narrative: `N` acknowledges exactly one current talk, council, or archive line, while `1`/`2` selects the corresponding visible response or decision. Held-key repeats and modified shortcuts are ignored. Choose an unlocked party member, equip or store gear, learn and bind up to two Vows, use consumables, buy/sell/forge items, or choose one of three rest tiers. The selected rest point exposes eligible companion talks and join-safe party councils; finish the selected branch before beginning another entry in that system. The public reading table opens one record after each completed story beat. Completed talks, councils, and records can be reviewed without mutating finite progress. Camp-local rest and item transitions validate before changing state: failed purchases or already-full recovery do not spend currency or inventory. Campaign victory instead uses the documented compensating multi-authority transaction and does not claim crash-proof or cross-tab atomicity. Equipment and Vow modifiers are applied when the campaign battle page builds party profiles.

The narrative-rest systems are documented in [the companion conversation bible](../docs/16-companion-conversation-bible.md), [the public archive reading bible](../docs/17-public-archive-bible.md), and [the party council bible](../docs/18-party-council-bible.md).

Each Ren Activation begins with two Pace. Move first if useful, then commit one command. Commands add Recovery pulses (one pulse is 800 ms) before Ren can return to the Tempo ribbon. Menu time is paused; this is not real-time combat.

## What to look for

- The central lacquer gate makes the upper/lower flanks tactically meaningful.
- The Oni’s Ledger reveals 125% Ember/Radiance weakness and 75% Umbral resistance; Ren has 75% Umbral resistance.
- Every hit reports base damage, delivery, optional Essence, multiplier, Guard reduction, and final damage.
- In FP-0, Guard applies to the next hit and its seeded 65% Dodge applies only to the next dodgeable physical attempt; `Moonless Thorns` is Arcane + Umbral and cannot consume it. Campaign uses the separate exact-boolean deterministic contract above.

The additional live authored suites are a 96 × 192 status atlas containing 18 distinct 32 × 32 lifecycle frames, a 128 × 48 NPC foundation atlas containing four 32 × 48 south-idle role frames, an 80 × 64 field-terrain atlas containing 19 transparent 16 × 16 material overlays, and a 1600 × 720 scene-panorama atlas containing 20 distinct 320 × 180 opaque frames. All are dimension-gated and retain geometric/generic/flat-color fallback behavior; none should be read as complete animation, full named-NPC or whole-field-map coverage, collision authority, external cultural acceptance, or final art lock.

All shipped visuals are original project assets or Canvas pixel primitives. The live authored suites are editable, deterministic code-native pixel art: 19 combat boards, 20 Campaign scene panoramas, six-party field/combat/portrait atlases, an eight-family regular-enemy atlas, a ten-boss key-pose atlas, and a nine-family battle-VFX atlas. Generated concept sheets remain reference-only and are not runtime pixels. The battle renderer combines the authored suites with deterministic wind-up, exact-grid lunge, projectile/trail, impact, status, stagger, and recovery phases while retaining procedural load/error fallbacks. Scene panoramas remain beneath portraits/dialogue and never become field or battle geometry. The assets explicitly exclude real-person likenesses; no copied character names or franchise assets are used.
