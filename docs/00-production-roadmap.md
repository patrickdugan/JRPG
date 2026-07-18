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

### 1. Design documentation — active gate

Before broad content production, deliver and cross-check:

- Vision document: genre, hook, tone, party, gear, locations, and high-level plot.
- Technical GDD: battle state model, movement/position rules, stats, element math, data schemas, UI states, and first-playable acceptance criteria.
- Beats and detailed story outlines: chapter quest, locations, party, boss, scene order, thematic throughline.
- Master asset list: location/tileset, character, animation, UI, and enemy needs with an explicit first-playable subset.

**Exit criterion:** the four documents agree on the party, core hook, key locations, and the first-playable slice. Outstanding choices must be constrained to iteration-sized details.

### 2. One true screenshots — active gate

Create an original battle target and world/story target. These are not marketing claims; they are visual contracts for systems, art, and tone.

- Battle target must make lanes, recovery timing, elemental information, party/enemy read, and atmosphere legible at a glance.
- World/story target must show the early-Edo gothic identity and emotional stakes.
- Menu target is implemented as a functional prototype UI rather than a static image when possible.

**Exit criterion:** each target makes genre, hook, and tone understandable without an accompanying pitch.

### 3. FP-0 combat proof and tooling — active after GDD

Build only the systems the slice needs:

- precise field or encounter-space movement;
- initiative and a clear phase/state display;
- a committed attack with recovery lockout;
- guard/dodge/interrupt responses;
- elemental damage, resistance, and status feedback;
- data-driven abilities and enemies;
- save-free restart and debug-friendly encounter reset.

**Exit criterion:** a player can understand the hook, make a meaningful defensive response, and finish the encounter without developer intervention. This is **FP-0 Combat Proof**: a systems-validation build, not yet the plan-template's 20–40 minute first playable.

### 4. FP-1 first playable — target

Target the documented 28–34 minute Takamine vertical slice comprising:

1. A short oppressive approach or shrine scene.
2. An introduction to positioning and recovery.
3. A multi-enemy learning encounter.
4. A dialogue turn that reveals the apostate priest’s allegiance.
5. A boss encounter that tests elemental preparation and interruption.
6. A clean end card / restart loop plus a feedback prompt.

Test with a small group once FP-1 is reliable. Record completion, wipe, and unclear-rule observations before changing mechanics.

### 5. Full production — active foundation

The user explicitly authorized broad production expansion on 2026-07-18 after the documented design, visual targets, combat proof, and campaign contracts were in place. That authorization records the scope transition required by this roadmap; it does not waive the external playtest, cultural review, final-art, accessibility, or measured-duration gates.

Current execution order:

- complete Chapter 1 with final environments and scenes;
- repeat chapter production with reusable systems and assets;
- reserve broad balance, full-save, large maps, shops, and final FX for their appropriate milestone;
- plan a full-game playtest with a substantially larger cohort before release.

## Scope-control rule

The team may make small, evidence-driven improvements during the slice. A request that changes the chapter structure, makes combat real-time, adds an open-world/metroidvania loop, changes the art language, or invalidates a documented data contract is a major change. It must be recorded and explicitly approved before implementation.
