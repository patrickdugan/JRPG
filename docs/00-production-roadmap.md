# Production Roadmap — Bells of the Black Chrysanthemum

This is the controlling execution order for the project. It applies the supplied JRPG project-plan template: document roughly 80% of the intended game first, validate the combat hook in a first playable, then expand chapter by chapter. It prevents a prototype from silently becoming an unbounded full production.

## Locked premise

**Genre:** gothic historical-fantasy, party-based turn-driven JRPG.

**Tone:** grave, intimate, and operatic. Sincere faith, fear, betrayal, and mercy are treated seriously; grotesque supernatural spectacle is never played as a wink.

**Hook:** turns are spatially staged. Combatants occupy meaningful lanes and ranges, commit to attacks with visible wind-up and recovery, and can answer that commitment with guard, dodge, elemental counterplay, displacement, or interruption. This makes a turn-based command battle feel as exacting as a duel without becoming real-time action combat.

**Progression shape:** a linear chapter loop—settlement, route, dungeon, boss, consequence—with optional side spaces. It is intentionally not a metroidvania: the reference point is a brisk 16-bit console-style party JRPG journey, not a backtracking structure.

**Historical stance:** the setting draws from the period of Jesuit missions and Christian persecution in Japan, but is a fictional alternate history. It does not present a real actor or film character as a game character; the former European priest is an original person with a distinct history and appearance.

## Roles and ownership

| Role | Current responsibility | Deliverables |
| --- | --- | --- |
| Creative director | Protect premise, approve scope and iteration | Decisions, feedback, release direction |
| Senior designer / writer | Establish narrative, characters, chapter structure, and first-playable script | `docs/01`, `03`, `04` |
| Technical director | Specify systems, choose the minimal runtime, and implement the vertical slice | `docs/02`, `game/` |
| Art director | Set visual rules, enumerate production art, and create the two key visual targets | `docs/05`, `06`, `assets/concepts/` |
| Producer / integrator | Track gates, validate cross-discipline consistency, run the build, and commit milestones | This roadmap, QA receipts, Git history |

## Milestones and approval gates

### 0. Asset management — complete

- Git repository initialized on `main`.
- Source project-plan template is committed intact.
- Ignore rules preserve source docs and designed art while excluding local build churn.

### 1. Design documentation — complete

Before broad content production, deliver and cross-check:

- Vision document: genre, hook, tone, party, gear, locations, and high-level plot.
- Technical GDD: battle state model, movement/position rules, stats, element math, data schemas, UI states, and first-playable acceptance criteria.
- Beats and detailed story outlines: chapter quest, locations, party, boss, scene order, thematic throughline.
- Master asset list: location/tileset, character, animation, UI, and enemy needs with an explicit first-playable subset.

**Exit criterion:** the four documents agree on the party, core hook, key locations, and the first-playable slice. Outstanding choices must be constrained to iteration-sized details.

### 2. One true screenshots — complete

Create an original battle target and world/story target. These are not marketing claims; they are visual contracts for systems, art, and tone.

- Battle target must make lanes, recovery timing, elemental information, party/enemy read, and atmosphere legible at a glance.
- World/story target must show the early-Edo gothic identity and emotional stakes.
- Menu target is implemented as a functional prototype UI rather than a static image when possible.

**Exit criterion:** each target makes genre, hook, and tone understandable without an accompanying pitch.

### 3. FP-0 combat proof and tooling — complete

Build only the systems the slice needs:

- precise field or encounter-space movement;
- initiative and a clear phase/state display;
- a committed attack with recovery lockout;
- guard/dodge/interrupt responses;
- elemental damage, resistance, and status feedback;
- data-driven abilities and enemies;
- save-free restart and debug-friendly encounter reset.

**Exit criterion:** a player can understand the hook, make a meaningful defensive response, and finish the encounter without developer intervention. This is **FP-0 Combat Proof**: a systems-validation build, not yet the plan-template's 20–40 minute first playable.

### 4. FP-1 first playable — implemented; timed external gate pending

Target the documented 28–34 minute Takamine vertical slice comprising:

1. A short oppressive approach or shrine scene.
2. An introduction to positioning and recovery.
3. A multi-enemy learning encounter.
4. A dialogue turn that reveals the apostate priest’s allegiance.
5. A boss encounter that tests elemental preparation and interruption.
6. A clean end card / restart loop plus a feedback prompt.

Test with a small group once FP-1 is reliable. Record completion, wipe, and unclear-rule observations before changing mechanics.

### 5. Full production — active

The user explicitly authorized broad production expansion on 2026-07-18 after the documented design, visual targets, combat proof, and campaign contracts were in place. That authorization records the scope transition required by this roadmap; it does not waive the external playtest, cultural review, final-art, accessibility, or measured-duration gates.

Current execution order:

- preserve the mechanically complete 11-chapter campaign and its deterministic completion receipt;
- preserve the completed finite expansion: exact-route operations, witness fieldwork, 90 companion conversations, 30 party councils, and 60 public archive readings;
- keep first-clear and repeat combat rewards separate while requiring one circuit of each of four contracts and leaving later 1×/2×/4× grinding optional;
- preserve all 19 manifested, editable combat boards—Takamine plus 18 regional boards—and their exact runtime geometry; never substitute rejected generated concept pixels, and retain subjective readability review as an art-lock gate;
- preserve the editable 84-frame party field atlas with paired directional walk phases for all six formation-owned selectable leaders and the presentation-only successful-move follower trail, the 19-overlay live-terrain foundation, party combat, eight-expression portrait, seven-pose eight-family regular-enemy, seven-pose ten-boss, nine-family battle-VFX, six-status apply/active/expire, 25-item icon, and metadata-only 16-role/32-frame NPC suite; preserve the 20-frame 320×180 scene-panorama suite mapped explicitly to all 60 beats through canonical-level compatibility, with no collision, route, save, telemetry, or evidence authority; preserve exact typed damage/heal flyouts, the 115-entry field-interaction copy catalogue, and the live Campaign Dodge and River Salve Item contracts; complete remaining combat/scene in-betweens, alternate action facings, NPC directions, variants, and whole-field map/tileset packages before final art lock;
- preserve Campaign Dodge as a deterministic pre-commit against the next art carrying exact `dodgeable: true` catalogue authority, never an inference from delivery, Essence, shape, animation, or prose. Its base Recovery is 1 with no Spirit cost; existing loadout/status Recovery modifiers apply to a minimum of 1. Non-dodgeable arts, status resolution, and other targets retain it; Guard and Dodge replace one another. Its code-native chevrons and existing authored move pose are presentation-only, never a real-time or simulation move, and require no bespoke bitmap. Current deterministic repeat traces reach dodgeable enemy arts in six encounters; balance and human review remain open gates;
- preserve River Salve as the only exact Campaign battle item until other resource authorities are reconciled: HP-only 80, any living deployed ally at any distance, no revive, base Recovery 2 with normal modifiers/minimum 1, no Pace or Spirit, and retained stance. Keep stock attempt-local and refundable until victory; net item debit, reward, and survivor HP in one loadout revision inside the existing compensating transaction. Auto-Grind must remain Item-free. Do not advertise MP, Spirit, or cleanse items in Battle yet;
- resolve the provisional findings in the [historical and cultural audit note](20-historical-cultural-audit.md), then run external cultural review, accessibility, browser/device, chapter-timing, and full clean-start playtests before release.

### 6. Campaign completeness and duration proof — active gate

The shipped browser build now has a complete canonical state path, all required first clears, finite narrative catalogues, versioned cross-page saves, and bounded zero-time completion witnesses. The intended first-play contract interleaves 215 activities at their exact story unlocks: 13 finite side quests, 18 witness chronicles, 90 companion talks, 30 party councils, 60 public archive records, and one circuit of each of four repeat contracts. Its v8 all-finite quantity model reaches 1,236.311 reference minutes at 1×, but the canonical-only reference estimate is 312.481 minutes and neither estimate is observed playtime.

The rendered-control receipt on recorded runtime `d45dfb2` proves 60/60-scene, 215/215-activity, and 23/23-first-clear reachability only. It records 1,693,181 ms of automated active control time and `durationProven: false`; none of the later status, NPC, feedback, walk-in-between, item-art, terrain, field-leader, level-metadata, telegraph-evasion, formation-follow, interaction-copy, typed-damage-outcome, Campaign Dodge, Campaign Item, or scene-backdrop waves has received another segmented route run.

**Exit criterion:** one clean-start human run completes the canonical story, all 23 first clears, and all 215 required-route activities, then explicitly completes credits to seal the UUID-bound receipt after at least 1,200 active minutes, accompanied by chapter timing notes. Execute and retain the evidence required by [the human full-route playtest protocol](19-human-playtest-protocol.md). Finite content must remain replay-refusing after completion; only the four required one-circuit repeat milestones may use the saved 1×/2×/4× presentation speed. No authored minute declaration, uncontrolled repeat treadmill, or deterministic zero-time runner may substitute for this gate.

## Scope-control rule

The team may make small, evidence-driven improvements during the slice. A request that changes the chapter structure, makes combat real-time, adds an open-world/metroidvania loop, changes the art language, or invalidates a documented data contract is a major change. It must be recorded and explicitly approved before implementation.
