# Acts IV–V — Black Gate and Living Castle Level Design

**Status:** runtime-integrated level-design pass  
**Playable span:** `c8-01-three-homecomings` through `c9-06-leave-evidence-alive`  
**Runtime flow authority:** `game/content/late-act-level-design.mjs`  
**Map authority:** `game/content/levels.mjs`  
**Side-view arena authority:** `game/action-stages.mjs`  
**Sequence authority:** `game/content/act-route-sequences.mjs`

## Level promise

Acts IV and V deliver a Castlevania-paced assault without making the campaign a Metroidvania.

- Exploration remains top-down, exact, and forward-moving.
- Combat’s production target is side-view real-time action with free horizontal movement and jumping.
- An attack has authored animation commitment, then a separate visible cooldown. Movement resumes during that cooldown.
- Level-scaled cooldown reduction changes attack availability, not animation speed.
- Nikola and Mateus are the primary playable duo; Ren, Miyo, and Aya retain their authored support or field functions.
- No movement technique is a progression key. Wall rebounds, air lifts, and Night Passage create better combat lines, not required doors.
- There are no random battles, ability-gated returns, hidden damage floors, or required castle loops.

The existing 12 × 7 battle records remain the encounter-semantic and compatibility authority for terrain, objectives, telegraphs, and the tactical Campaign Battle. The 960 × 540 side-view contracts define the action-combat geometry. A designer may change presentation between them, but not the objective.

## Macro topology

```text
                 Salt — Sodegaura Return ─┐
                  Ash — Takamine Return ──┼─> BLACK GATE
               Paper — Hoshigawa Return ──┘      │
                                                  v
  EPILOGUE <─ dawn exit <─ OUTER ARCHIVE <─ OBSERVATORY
                           │      ^              ^
                           v      │              │
                      AUDIENCE HALL              │
                           │                     │
                           v                     │
                      CONSERVATORY               │
                           │                     │
                           v                     │
                        BELL SPINE ──────────────┘
```

The Outer Archive is intentionally visited twice:

1. On entry, it is a hostile three-node release battle and leads east to the Audience Hall.
2. After Kurozane, the player reads one edge in reverse as a safe evacuation route and leaves west at dawn.

No enemy, Bell node, offer, or prisoner respawns on the return pass.

## Act IV — The Black Gate

Act IV has eight major sequences but only two spatial modes: three brief coalition homecomings and one sustained gate assault. Its shape is **breadth, convergence, impact**.

### IV.1 — Three Homecomings

The player sees all three communities before the selected approach is committed. Each scene answers the same practical question—what can this place contribute without being conscripted?—through a different spatial picture.

| Route | Map | Required field order | What remains visible at the gate |
|---|---|---|---|
| Salt | `c8-sodegaura-return` | inspect `dock-supplies` → receive terms at `boat-council` → `black-gate-route` | household boats, separate testimony custody, lower-causeway evacuation |
| Ash | `c8-takamine-return` | confirm `medical-tent-list` → read `lantern-route-map` → `black-gate-route` | treatment line, released patrol stand-down, service-stair knowledge |
| Paper | `c8-hoshigawa-return` | confirm `archive-runner-table` → inspect `evacuation-map` → `black-gate-route` | duplicated registry, runners, offices able to receive surrendered seals |

These are departure-state vignettes, not three interchangeable fetch quests.

- Salt uses a low dock lane for households and a raised customs walk for the party. Water shows time and route; it is not a damage surface.
- Ash uses staggered service landings beside medical tents. The narrowness establishes marching order, not a stealth or reflex failure.
- Paper shows two courier lanes passing records around an occupied center. There is no single glowing “master copy.”

The selected route owns `c8-02-consent-not-conscription`. The other two places remain real in the muster but do not silently become assault bonuses.

### IV.2 — Black Gate top-down objective grammar

The compatibility board is divided by an impassable central gatehouse.

```text
      west ash flank       gate mass       east ash flank
y1     E E . . . .          # #            . . U U
y2     . . . . .            # #            . . . .
y3  IN . . W-relay          # #       E-relay . . OUT
y4     . . . . .            # #            . . . .
y5     U U . . . .          . .            . . E E

E = Ember ash; U = Umbral ash; # = gatehouse blocker
```

Critical order:

1. Resolve **Boats With Conditions** at the coalition entry.
2. Stabilize the west relay.
3. Cross the lower causeway and stabilize the east relay.
4. Clear `c8-outer-court`.
5. Hold a hard combat checkpoint.
6. Fight `c8-lady-enma` without resetting relay or route state.
7. Resolve **Three Terms for the Cinder Fan** at the threshold.
8. Open `kurohana-gate`.

The central blocker prevents a straight damage rush. It must never become a key door or destructible shortcut; the encounter is about maintaining two public routes while pressure alternates between them.

### IV.3 — Side-view relay breach

`c8-black-gate` supplies one continuous 880-pixel lower causeway and two one-way gate-wall platforms.

```text
 y290      [ WEST RELAY ]                    [ EAST RELAY ]
 y444  PARTY ─────────────────────────────────── GARRISON
       40                    480                         920
```

First pass, `c8-outer-court`:

- The party starts west and the garrison holds east.
- Either relay may be reached first, but both must be stabilized.
- The court captain paints the lane the player just vacated, encouraging a deliberate cross-stage transfer.
- The lower causeway is long because post-animation cooldown is movement time. Waiting in place is never the intended answer.
- Either upper relay is a readable tag pocket. Tag recovery does not clear telegraphs or repair a failed relay.
- The garrison release at ground east ends the pass.

The checkpoint between encounters restores the battle start state that the combat rules normally restore, but it does not heal route consequences, erase relay failures, or choose Enma’s fate.

### IV.4 — Lady Enma, Last Mask

Enma uses the same stage so the player immediately understands space and can focus on escalation.

| Phase | Spatial demand | Damage opportunity |
|---|---|---|
| Rain remnant | bait one orange fan away from the active relay | punish the declared fan recovery |
| Archive remnant | cross to the opposite platform when the violet reflection marks the current side | break the visible reflection, then return to Enma |
| Last Mask | solve paired orange/violet lanes and the red-black parasol arc | full `Recovery 3` after Cinder Parasol Wing |

Ordinary pressure cannot stun-lock Enma. Her strongest repeatable punish window is the declared Recovery 3. A tag may preserve good spacing after a crossing, but its 240 ms recovery cannot cancel an attack already committed.

Her defeat does not open the castle immediately. The player remains at the threshold while witnesses determine death, rotating custody, or revocable defection. That result changes the castle’s support state, not its room order.

## Act V — The Living Castle

Act V is a five-sequence convergent ascent expressed as six map visits. Its shape is **release, custody, refusal, ascent, duel, evacuation**. Each room removes one way Kurozane makes himself necessary.

### V.1 — Outer Archive: release

Entry state:

```text
 y300    [ NODE A / west stack ]       [ NODE C / east stack ]
 y442  spirit exit ───── NODE B / catalogue floor ───── audience door
```

Critical order:

1. Break Node A and keep its released names moving toward the west spirit route.
2. Drop to Node B while the Archive Warden telegraphs a straight catalogue line.
3. Cross to Node C.
4. Resolve `c9-archive-nodes` without allowing an opened route to close.
5. Enter the Audience Hall through `audience-hall-door`.

The nodes form a clockwise combat read, not a key hunt. A node attack uses normal animation and cooldown rules; the controlled fighter may escort a released name while the attack cools down. The inactive partner protects the nearest opened route. Tagging never changes custody state.

The execution architecture is oppressive but legible. Production art may use the approved non-gory victim fixtures; names, living captives, escape lines, and later testimony must keep persecuted Christians from becoming anonymous Gothic ornament.

### V.2 — Living Audience Hall: rescue before custody

The throne block occupies the north-center. Two living prisoners lie on the lower approach, witnesses hold the clear west edge, and the conservatory exit remains visible east.

Critical order:

1. Cut down `living-martyr-west`.
2. Use the opened lower route to reach `living-martyr-east`.
3. Compare `ujiro-ledger` against copies already outside the castle.
4. Hear `witness-circle`.
5. Place Ujiro in public custody and open `conservatory`.

The second rescue unlocks the ledger confrontation. Ujiro must not be targetable as a boss or optional execution. The spatial reversal is deliberate: the player first removes people from the court’s display, then denies its administrator the power to control the record.

### V.3 — Blood Conservatory: offers in a visible room

Six black-glass reflections occupy a single shallow arc. The real eastbound door is visible behind them from entry.

```text
 entry ── Ren ─ Aya ─ Nikola ─ Mateus ─ Genta ─ Kiku ── real exit
                         Miyo refuses classification first
```

- Miyo’s refusal is dialogue, not a seventh offer collected on Mateus’s behalf.
- Each reflection darkens permanently when refused.
- Refusals can be examined in either direction, but the authored dialogue cadence remains Ren → Aya → Nikola → Mateus → Genta → Kiku.
- Each refusal may adjust a minor Kurozane opening resistance; none changes whether that character rejects the offer.
- The exit opens after all six. There is no dream-room teleport, false maze, or combat punishment for listening.

The room is the final low-pressure breath before the ascent. Its tension comes from character ownership and the visible door, not from uncertainty about how to leave.

### V.4 — Bell Spine: field rhythm into boss rhythm

The top-down spine has two safe landings around an eight-tile pulse band. The pulse runs every 3,000 ms with a 750 ms visual warning, deals 8% maximum HP, and cannot reduce the party below 1 HP.

Critical order:

1. Break `spine-node-a`.
2. Cross the declared pulse band.
3. Break `spine-node-b`.
4. Resolve **Mateus and the Living Archive**.
5. Enter the transformed observatory for the Yearless Bell.

The pulse teaches the boss rhythm: warning, movement, commitment, safe recovery. It is not a jump test. A hit returns the player to a readable landing and never resets a broken node.

### V.5 — Transformed Observatory: Yearless Bell

The Bell Spine opens directly into a dark observatory. This is a continuation, not a return through old rooms.

```text
 y214                    NORTH NODE
 y296  [ WEST NODE / RING ]            [ EAST NODE / RING ]
 y438         PARTY ─── SOUTH NODE + ARCHIVE CORE ─── BELL
```

Three-phase objective:

1. Protect the archive core while the first ring declares itself. Nodes remain invulnerable between exposed pulses.
2. Break west and east nodes from the upper rings and south from ground during recovery windows.
3. After three nodes fall, the north node descends into a reachable exposure. Break it to silence the Bell.

The ring warning must last longer than any required attack animation. Players can move through the safe ring while a node-breaking attack cools down. A tagged partner inherits the same core health, node state, and pulse. Black Sun Concord remains unavailable until this encounter is over.

The fourth node creates a hard checkpoint. It changes lighting, music, enemy set, and dialogue state without unloading the observatory.

### V.6 — Dawn Observatory: Kurozane

The defeated core stays at ground center as vulnerable evidence. Kurozane begins in the eastern command circle. Dawn first opens the west lane.

```text
           west ring / dawn                         east ring / command
 y296       [ regroup ]                              [ pressure ]
 y438  DAWN ─────── archive core ─────────────── KUROZANE
```

Phase structure:

| Phase | Kurozane | Level demand | Dialogue function |
|---|---|---|---|
| I — Last Shogun | spear lines, command clones, measured pursuit | cross under or over the declared line; punish without abandoning the core | historical accusation during movement |
| II — Oni Sovereign | ring pressure, faster pursuit, warded command bloom | use west/east loops; survive, do not race ward damage | live family and compromised duty |
| III — Black Sun | sovereign ward and alignment tell | bring Mateus and Nikola within 180 px; commit both authored hits | relic joke, theological correction, then tactical call |
| IV — Defeated ruler | no hidden regeneration; weapons remain present | hold position or execute according to the resolved Last Command path | transfer, execution, or failed-transfer consequence |

Black Sun Concord is two real hits: Mateus opens Umbral authorization and Nikola draws Severed Dragon Radiance. Both animations commit. Neither art resets the other’s cooldown. Their alignment strips the sovereign ward and opens Kurozane’s declared Recovery 3.

Combat must end with Kurozane physically defeated before negotiation determines the state’s outcome. If the player reaches the surrender path, the transfer is still staged with force: seals tear away, commands change outside the window, and the former shogun loses the center of the frame. If execution or failed transfer resolves, outer Bell fragments mobilize the civil war immediately.

### V.7 — Outer Archive: evacuation return

The observatory’s `archive-evacuation` exit now returns to `krh-outer-archive`. This is a short reverse pass, not dungeon repetition.

- Broken nodes remain broken.
- Released names and rescued people occupy the old enemy lanes.
- The entry’s spirit exit becomes the dawn route out of Kurohana.
- Aya divides decision records from testimony bundles.
- Route-specific support appears at the far threshold: Salt boats, Ash medical/garrison hands, or Paper runners.
- The transfer branch shows orders changing hands in sequence; the civil-war branch shows disputed riders beyond the safe route.

Completing `c9-06-leave-evidence-alive` opens `dawn-archive-exit` to `epi-hoshigawa-archive`.

## Checkpoints and failure boundaries

| Boundary | Restored on retry | Preserved |
|---|---|---|
| Black Gate approach → Outer Court | duo HP/cooldowns according to encounter-start rules | selected route, community terms |
| Outer Court → Lady Enma | boss-start combat state | relay results, garrison release, route consequences |
| Outer Archive clear → Audience Hall | room-entry combat state | all three nodes and spirit routes |
| Bell Spine → Yearless Bell | boss-start combat state | field nodes, Mateus terms |
| Yearless Bell → Kurozane | final-boss start state | core condition, all four nodes, Storyworld record |
| Kurozane → Last Command | defeated-ruler hold | HP result, ward break, combat evidence |
| Last Command → evacuation | safe return-pass state | exact transfer/execution result and route support |

No retry replays a resolved Storyworld decision. No checkpoint changes the selected route, rerolls a consequence, or respawns a rescued prisoner.

## Route carry-in without route-exclusive rooms

The palace layout converges; its parameters do not.

| Route | Act IV level read | Act V systemic payoff | Final-state expression |
|---|---|---|---|
| Salt | low causeway and boat signals | stronger civilian evacuation and granary continuity | best resistance to starvation and trapped households |
| Ash | service stair and treatment line | fewer Oni reinforcements, more garrison refusal | best resistance to rival patrol claims |
| Paper | split courier relay | stronger archive integrity and provisional-office readiness | best resistance to false succession records |

Routes change background actors, objective resilience, available political proof, and ending pressure. They do not delete rooms or make one route the “true” moral path.

## Implementation acceptance

1. Every required field interaction and exit is reachable by four-direction movement without crossing a blocked tile.
2. The three Act IV return maps converge only at `c8-black-gate`.
3. The Act V ascent includes all five rooms in order, then exactly one safe Outer Archive return.
4. `krh-outer-archive` cannot reach the Audience Hall before three archive nodes are broken.
5. `krh-observatory` cannot reach the evacuation pass before Kurozane is defeated and records are secured.
6. The five late-act action variants resolve real stages, encounters, objective anchors, and at least three movement lanes.
7. Mandatory attack animation never outlasts its associated hazard warning.
8. Post-animation cooldown permits movement; level scaling never accelerates authored animation.
9. No side-view movement technique is required to open a door, reach a story object, or recover from a checkpoint.
10. Full tests, Storyworld validation, and a human action-combat readability pass must all succeed before content lock.

