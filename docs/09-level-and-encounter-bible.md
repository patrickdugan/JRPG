# Bells of the Black Chrysanthemum — Level and Encounter Bible

**Status:** runtime-ready content kit, schema version 1
**Owners:** level design and encounter design
**Runtime sources:** `game/content/levels.mjs` and `game/content/encounters.mjs`

This is the level-design handoff for the whole campaign. The vision, technical combat contract, beats outline, and detailed FP-1 outline remain canonical. This document turns them into concrete boards, terrain rules, telegraphs, and objectives without adding traversal powers, real-time reactions, or unannounced hazards.

## Runtime contract

All positions are zero-based `x,y` tile keys with the origin at the top-left.

| Surface | Grid | Tile size | Authority |
| --- | ---: | ---: | --- |
| Field map | 20 × 12 | 16 logical px | Exact walking, interaction, field hazards, exits |
| Battle stage | 12 × 7 | 32 logical px | Pace movement, targeting, hazards, objectives |

`LEVELS` exports the required `{ id, chapterId, name, width, height, blocked, terrain, spawn, exits, objective, palette }` data plus hazards, interactables, and encounter triggers. `ENCOUNTERS` exports the required `{ id, chapterId, levelId, name, objective, lesson, enemies, bossMechanic, reward }` data plus deployment, Ledger, skill, and phase data.

**Coverage:** 48 loadable level kits: all 46 named campaign-map references plus the two dedicated FP-1 battle-stage IDs (`fp1-wet-cedar-stage` and `fp1-flooded-archive-stage`). There are 23 encounter kits, including every campaign encounter reference and the noncombat epilogue resolution.

- `blocked` is the collision authority. Terrain with `passable: false` also blocks, so rendering and movement cannot disagree.
- Terrain is explicit. A water tile is not automatically harmful; its hazard declares the trigger and effect.
- Enemy telegraphs name their shape, warning, and Recovery. Animation must communicate these facts but may not alter them.
- Each campaign chapter has a `primary` map and encounter. Every encounter has a valid level reference; static party and enemy spawns are kept off blocked tiles.
- `getLevelForChapter`, `getEncounterForChapter`, tile lookup helpers, and validation helpers are provided for a browser runtime without DOM coupling.

## FP-1 Takamine vertical slice

The FP-1 route is 28–34 minutes on first clear. It contains no random encounters, no shop, no ability gate, and no reflex jump test.

| ID | Grid | Route / obstruction | Objective and intended read |
| --- | --- | --- | --- |
| `tkm-rain-gate` | 20 × 12 | Closed main gate is physically blocked; the right service opening is visible. | Inspect the supply cart, then use the service path. Teach interaction range and eight-way field movement. |
| `tkm-cedar-service-path` | 20 × 12 | Retaining wall, low cart, optional chest route, and chapel door. | One authored encounter trigger, then a careful optional chest route. |
| `fp1-wet-cedar-stage` | 12 × 7 | Two cedar-root blockers and two harmless puddles split approach lanes. | Cinder Hounds teach Cut 75% / Pierce 125%; Wisp teaches Radiance 125% / Umbral 0%. |
| `tkm-abandoned-chapel` | 20 × 12 | Grates and paper screens make prisoner interactions visible; rear door requires Nikola’s key. | Witness notes are optional; Nikola changes the party without a forced battle. |
| `tkm-bell-stair` | 20 × 12 | One-space beam lane, three cracked boards, safe landings, checkpoint lantern. | Creak cue is 0.5 seconds before a 2.5-second beam cycle; hit is 15% max HP, returns to safe landing, and cannot kill. |
| `tkm-flooded-undercroft` | 20 × 12 | Archive shelves frame a water lane and lantern alcove. | Inspect brazier before battle: Storm + marked water applies Chill; dry lantern space is safe. |
| `fp1-flooded-archive-stage` | 12 × 7 | Shelves at the rear, water in the middle, dry spaces on both flanks. | Flank a Guarded Enforcer with Pierce/Radiance; avoid a forced move into conditional water. |
| `tkm-bell-chamber` | 12 × 7 | Buried bell blocks the center and creates three readable lanes. | Mateus boss: Blood Ward is targetable; Crimson Litany creates a Recovery 3 attack window. |
| `tkm-cell-block` | 20 × 12 | Six cells, tangible lever, rain exit. | The player pulls the lever; rescue is gameplay, not only a cutscene. |

### FP-1 battle-board legend

`#` blocker; `~` water or harmless puddle; `L` dry lantern; `R` Ren; `A` Aya; `N` Nikola; `H` Cinder Hound; `W` Ash Wisp or ward; `M` hostile boss; `E` Enforcer. Board data, not these diagrams, is authoritative.

#### Wet Cedar Path — `fp1-wet-cedar-stage`

```text
y0  ###......###
y1  #.H...W..H.#
y2  ....#..#....
y3  ....~..~....
y4  ............
y5  .....RA.....
y6  ##........##
    012345678901
```

- Ren begins at `5,5`; Aya at `6,5`.
- Hounds begin at `2,1` and `9,1`; the Wisp begins at `6,1`.
- The puddles are visual footing only. They prove that a terrain tag does not imply damage.
- Hound Lunge is a three-space line with Recovery 1. The preferred first read is Cut resistance, then Analyze or Pierce.

#### Flooded Archive — `fp1-flooded-archive-stage`

```text
y0  ###......###
y1  .###M..M###.
y2  ....~~E~....
y3  ....~..~....
y4  #L........L#
y5  #..........#
y6  ....ARN.....
    012345678901
```

- The moths start at `4,1` and `7,1`; the Enforcer starts at `6,2`.
- The Enforcer’s Shield Hook telegraphs a two-space pull. Its Guard prevents forced movement but not a flanking Pierce or Radiance hit.
- Water becomes dangerous only if a Storm strike resolved that round. Entering then applies Chill (`−1 Pace` next activation); this is pre-taught by the brazier.
- Bell Moths synchronize a group pulse, so their Recovery 2 is an intentional window for Hawthorn Pique or a restore.

#### Bell Chamber — `tkm-bell-chamber`

```text
y0  ###......###
y1  ...L.W......
y2  #....##.....
y3  #.RN.....M..
y4  #.A.........
y5  ...L..W.....
y6  ###......###
    012345678901
```

- The central black bell occupies `5,2`, `6,2`, `5,3`, and `6,3`; the west gallery at `x0` is not walkable.
- Mateus starts at `9,3`. Ward seals appear at `5,1` and `6,5` when he uses Blood Ward.
- Sanguine Step marks its lane endpoint before its Umbral slash. Crimson Litany marks a four-space line over two boss activations, then imposes Recovery 3.
- Boss end condition is **Mateus at 20% HP** or **both wards broken after phase two**. The phase-three self-damage is nonlethal and ends hostile AI.

### FP-1 encounter sequence

| Encounter | Enemy Ledger / intent | Telegraphed answer | Reward |
| --- | --- | --- | --- |
| `fp1-cedar-path` | Hounds: Cut 75%, Pierce 125%, Ember 75%. Wisp: Radiance 125%, Umbral 0%. | Spend Pace out of the Lunge line or Guard; analyze voluntarily or after the second resisted Cut. | River Salve; path clear. |
| `fp1-flooded-archive` | Enforcer: Cut 75%, Pierce/Radiance 125%, Guard prevents pushes. Moths: Ember 125%, Frost 75%. | Use Nikola’s angle, keep an ally from Shield Hook water pull, commit after moth Recovery 2. | Bell-room key and Ward Tonic. |
| `fp1-mateus` | Mateus has a targetable Blood Ward; seals are Pierce/Radiance weak. | Avoid Litany line, then use its Recovery 3 for seal damage, healing, or setup. | Temple key; Nikola permanent; Mateus becomes an accountable source. |

## Campaign encounter kits

Each later chapter has one concise normal/route kit plus an anchor boss or objective. The maps and exact data live in the two content modules; this table is the design reading order.

| Chapter | Map kit | Encounter / mechanic | Element and positional lesson |
| --- | --- | --- | --- |
| Prologue | `hsh-census-square` | Ashen Bailiff escape. Survive three activations and reach the river marker. | Long Crush sweep is a clear red line; Pace is an escape tool, not an attack-tax. |
| 1: River of Names | `c1-flooded-cedars`, `c1-tax-storehouse` | Cinder Hounds / Ash Wisps; then Tithe Hound. | Cut/Pierce and Radiance/Umbral Ledger reads; Consume Ink exposes a targetable seal during Recovery 3. |
| 2: Bell at Takamine | FP-1 maps above. | Hounds/Wisp, Enforcer/Moths, Mateus. | Teaching sequence culminates in visible boss Recovery. |
| 3: Sodegaura Lanterns | `sdg-rain-docks`, `sdg-salt-warehouse` | Escort through hook patrol; Captain Kaji’s hook and crane surge. | Facing, Guard, Genta Anchor, and storm-water lanes protect witnesses. Kaji is disarmed and taken alive. |
| 4: The Sea Keeps No Ledger | `ngi-tide-caves`, `ngi-storm-reef` | Fog net anchors; Widow-of-Fog tide boss. | Ember creates dry safety; Frost is resisted by the Widow; high/low tide announces the next safe tiles one boss activation ahead. |
| 5: Ash in Kagura Pass | `kgr-ash-fields`, `kgr-archive-furnace` | Bound Ashen Oni release; Furnace Abbot. | Returning a name slip is the nonlethal win condition. Abbot absorbs Ember, resists Crush, is weak to Frost/Pierce, and overheats after Forge Sermon Recovery 3. |
| 6: Court of Masks | `kzu-archive-roof`, `kzu-public-tribunal` | Protect courier and print blocks; Ujiro’s Seizure Order and clerk summons. | Multi-target threat triage. Writs mark exact objectives before damage; Ujiro retreats rather than being executed for spectacle. |
| 7: Road of the Dead | `hsh-prison-ferry`, `hsh-bell-aqueduct` | Carry a name slip to water; Bell Warden Chiyo rescue countdown. | Swap has Recovery and solves position. Killing Chiyo without extracting all prisoners is a loss. |
| 8: Lanterns Unhidden | `c8-black-gate` | Relay breach and Lady Enma’s paired Ember/Umbral ash lanes. | Six roles answer a shared hazard grammar: ward, terrain change, anchor, redirect, expose, protect. |
| 9: Black Chrysanthemum | `krh-outer-archive`, `krh-observatory` | Archive-node release, Yearless Bell nodes, then Kurozane. | Final exam repeats objects, rescue, node positions, rings, command clones, Umbral absorb, Radiance dawn, and Recovery 3. |
| Epilogue | `epi-hoshigawa-archive` | Memorial Walk, represented in the same encounter schema but with no hostile actions. | Testimony, correction, supplies, and lantern light replace combat. `Unfiled Testimony` is a non-hostile record gap, never a target to defeat. |

## Boss design rules

Every boss mechanic is designed around a small visible question.

| Boss | Telegraph | Player counterplay | Recovery / phase payoff |
| --- | --- | --- | --- |
| Tithe Hound | Black name line for Consume Ink | Leave line, expose seal, Pierce/Radiance it | Recovery 3 after Consume Ink |
| Mateus | Afterimage endpoint, two-note Litany line, ward spawns | Reposition, break seals, use safe window | Litany Recovery 3; phase 3 is surrender |
| Captain Kaji | Hook path and crane lane | Guard / Anchor / move witness | Crane Surge Recovery 3 |
| Widow-of-Fog | Announced high/low tide and fog line | Move toward next safe state; Ember dry spaces | Receding Call Recovery 2 |
| Furnace Abbot | Eight glowing grates | Frost footing, leave grate zones, Pierce after overheat | Forge Sermon Recovery 3 |
| Ujiro | Vermilion writ above exact print targets | Interrupt order or protect target | Order Recovery 2; no kill spectacle |
| Bell Warden Chiyo | Chain endpoint and numbered bell count | Break chain, Swap into rescue space | Count is visible; extraction is mandatory |
| Lady Enma — Rain Mask | Orange five-space fan lane across the witness route | Guard hooks, keep the escort moving, punish Frost/Radiance | Cinder Fan Draw Recovery 3; forced retreat at 55% HP |
| Lady Enma — Archive Mask | Black clerk writ followed by one violet reflected target | Break the visible mirror while protecting courier and blocks | Mirror Writ Recovery 3; forced retreat at 30% HP |
| Lady Enma — Last Mask | One orange and one violet lane plus a red-black parasol arc | Assign party roles to stabilize both, then punish the full-activation arc | Cinder Parasol Wing Recovery 3; subdued alive for the three-outcome spool |
| Kurozane | Clone seals, ring, spear line, five-petal bloom | Apply learned answers; avoid Umbral; use dawn lane | Black Chrysanthemum Recovery 3 after ward break |

## Production and playtest invariants

1. A static spawn, objective token, interactable, and exit must be in-bounds and non-blocked unless the object explicitly has a non-walkable terrain state. Dynamic summons must name a legal spawn rule.
2. A hazard always declares its trigger. “Storm water” never deals damage merely because it looks charged; it checks the stated Storm condition.
3. No battle requires real-time input. All attacks, hazards, Guard, Dodge, Swap, and Recovery resolve under turn ownership.
4. Field hazards use a clear warning, a recoverable outcome, and a checkpoint before repeated punishment. Bell Stair cannot kill the player and has no jump input.
5. Elemental language remains consistent: Cut / Pierce / Crush / Arcane delivery; Ember / Frost / Storm / Radiance / Umbral essence. Values are visible multipliers, not hidden build math.
6. Bosses involving named human characters resolve through disarmament, custody, surrender, testimony, or release where the story calls for it. No real people, sacred objects, celebrity likenesses, or copied game scenes are used.
7. Required playtest reads are measurable: Analyze use by Battle 2, fewer than 10% double-fails on Bell Stair, 55–80% first-session Mateus clear rate, and at least 70% recognition of the Litany recovery answer after one failure.

## Implementation handoff

The data is intentionally more complete than the current FP-0 engine so a future browser runtime can load an authored level rather than hard-code a map.

1. Load `LEVELS` by ID, use `blocked` plus non-passable terrain for movement, and render terrain/hazard cues from the data.
2. Resolve an encounter by its `levelId`; place `party.deployment`, enemy `positions`, and objective tokens using the same tile system.
3. Render a telegraph before scheduling the listed resolution. Recovery values must be shown in the Tempo ribbon and never be shortened to match animation.
4. Evaluate `objective.type` before ordinary “all enemies dead” logic. Escape, release, protect, and rescue encounters are deliberately not all damage races.
5. Use the exported validators in a content test or boot check before loading a map.
