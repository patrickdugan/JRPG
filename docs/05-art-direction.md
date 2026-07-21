# Bells of the Black Chrysanthemum - Art Direction

**Status:** pre-production visual contract<br>
**Audience:** art director, environment artists, character artists, UI/UX, VFX, animation, technical art<br>
**Scope:** 2D pixel-art JRPG, 320 x 180 logical pixels, integer-scaled; the first playable and the 20-25 hour production target.

**Runtime note (2026-07-20):** the current Campaign reuses its original 84-frame party field atlas for visible formation followers. The stable third-row key remains `lise` solely for save, formation, and atlas compatibility, while every authored pixel and visible/source name in that row presents Nikola Dražanić. A deterministic player-facing roster is composed from the same combat atlas, replacing the obsolete generated female roster. Only successful persisted departures enter a bounded presentation trail; followers disappear on context changes and never imply collision, hazard, interaction, or save authority. Campaign Battle also uses code-native typed damage flyouts for exact values and WEAK/RESIST/IMMUNE/ABSORB/GUARD/WARD reads. These are production-foundation implementations, not final subjective readability approval.

## 1. Visual thesis

*Bells of the Black Chrysanthemum* is a Gothic early-Edo fantasy of rain, records, bells, and mutual aid. Its image should feel like a remembered place rather than a collage of familiar genre signals: wet cedar outside a household, paper windows glowing through a curfew, a registry seal on a door, and an impossible black-lacquer court above it all.

The style is **hand-authored 16-bit pixel art with theatrical staging**. Everyday materials make the supernatural readable: lacquer, ash, paper, water, bronze, and cedar establish the world before violet blood-light or bell magic breaks it. The camera, lighting, and UI must make the turn-based spatial hook legible at a glance.

This project is original IP. Do not trace, recreate, or deliberately mimic another game's sprite work, enemy silhouettes, menus, maps, or effects. Do not use celebrity likenesses. Father Mateus Avelar is an original fictional character; his look is defined below, not by an actor or a film role.

## 2. The two one-true screenshot targets

These are approval targets, not source images to cut into the game. They establish composition, palette priority, environmental density, and the amount of information a player should understand within a second.

| Target | File | Must communicate | Non-negotiable read |
| --- | --- | --- | --- |
| World/story | [bells-world-story-target-v1.png](../assets/concepts/bells-world-story-target-v1.png) | A lived Japanese mountain settlement under an inhuman court; human companionship against rain and scale | A traversable bridge, a safe-but-watched settlement, a chapel/hidden-faith implication, and a distant authoritarian fortress |
| Battle | [bells-battle-target-v1.png](../assets/concepts/bells-battle-target-v1.png) | Deliberate turn-based spatial combat on a Gothic Japanese stage | Friendly/enemy sides, a selected board position, a move route, upcoming turns, recovery locks, and elemental categories without needing text |

The generated concepts successfully establish atmosphere and macro-composition. They are intentionally **not** pixel-perfect UI layouts or production sprites: final scenes follow the 320 x 180 grid, the 12 x 7 combat contract, the palette budget, and the cultural review process below.

## 3. Image language and technical rules

### Logical canvas and scale

| Element | Production specification |
| --- | --- |
| Logical screen | Field/story production target: 320 x 180, 16:9. The current browser battle canvas is a separate 960 x 540 presentation surface whose exact grid geometry is defined below; do not scale a field screenshot into it. |
| Display | Integer scale with nearest-neighbor sampling is the final-art target; the current responsive browser prototype does not yet satisfy it at every viewport and must not be cited as final pixel-scale proof. |
| Field terrain | 16 x 16 base modules; 16 x 32, 32 x 32, and 32 x 48 overlays for walls, roof edges, trees, and foreground masking. |
| Field actor | 32 x 48 nominal body box, with a 12 x 10 foot collision box supplied by design. Taller hats/hair/cloaks may exceed the frame upward only. |
| Combat actor | 48 x 64 standard; 64 x 80 for broad silhouettes; named bosses 96 x 96 to 128 x 128. |
| Combat board | Simulation uses a 12 x 7 integer grid and consumes level `spacePx: 32` metadata through one shared draw/input transform. The 960 x 540 backing store uses exact 64-pixel cells and centers a 768 x 448 board at `(96,46)`, preserving a 384 x 224 authored floor at 2x. Other layouts retain a bounded fallback. A production floor must be an exact flat 12 x 7 module or collision-matched cell modules; perspective paving may not imply a different grid. |
| UI | Nine-slice panels and icon cells on an 8-pixel rhythm. UI text uses a purpose-made bitmap font; never ask generated art to supply lettering. |

### Pixel construction

- Build with decisive clusters, stepped diagonals, and intentional one-pixel highlights. A pixel is a mark, not low-resolution blur.
- Use 2-4 values per local material before borrowing a shared accent. Avoid airbrushed ramps, global noise, and automatic outlines.
- Put the strongest contrast at the player route, current target, attack active frame, and story focal object. The background never wins a value contest against a command target.
- Rain is sparse directional one-pixel or two-pixel marks on separate layers. It never becomes a screen-wide gray veil.
- Candle halos use 3-4 hard value steps; metal gets one cold or warm specular pixel group; wet surfaces mirror only broken bands of light.
- Keep silhouette gaps. Spears, folded archive-seal fans, matchlocks, bells, and folded sleeves need negative space around their function.

### Palette contract

The entire game shares a restricted base palette. A location can add 4-6 local colors, but should not replace the core value logic.

| Family | Use | Suggested anchors |
| --- | --- | --- |
| Ink shadow | deepest interior, UI fill, silhouette separation | `#0B1020`, `#16233A` |
| Rain indigo | night sky, wet stone, distant depth | `#27466B`, `#4F7392` |
| Cedar / earth | domestic wood, routes, human-scale warmth | `#5A3A2C`, `#8B6043` |
| Paper / candle | windows, records, holy or hopeful reads | `#D7C99A`, `#F6E8B9` |
| Lacquer authority | court trim, seals, enemy hierarchy | `#762B32`, `#B34A3E` |
| Oxidized metal | bells, shrine hardware, old mechanisms | `#637462`, `#A08B58` |
| Court corruption | rare supernatural accent only | `#401D42`, `#781E39` |
| Dawn / repair | late-game resistance, restoration, Radiance | `#88C8C5`, `#D7F0D5` |

**Value rule:** 70% of a scene lives in shadow/midtones, 20% establishes local material and navigation, and no more than 10% is high-value or saturated guidance. Court corruption must never be the default ambient color; it is a deliberate alarm.

## 4. Environment direction

### Depth stack

Every field scene is built in five readable bands:

1. **Sky / weather:** restrained cloud, ridge, or sea color; establishes time and weather.
2. **Distant authority:** castle, registry tower, bell frame, patrol lantern, or coast silhouette.
3. **Play space:** walkable path and collision landmarks, clean enough to read at speed.
4. **Human detail:** homes, work, trade goods, records, laundry, tools, food, boats, and small signs of care.
5. **Foreground witness:** eaves, branches, shutters, reeds, rain chains, or masks, used sparingly to frame rather than hide the route.

At least one warm practical light must identify a human-scale destination in a night scene. At least one cold or red vertical accent identifies court pressure where appropriate. Do not make every village permanently miserable: calm mornings, practical labor, food, humor, and seasonal color are necessary contrast.

### Region palettes and signatures

| Region | Visual signature | Reusable kit | Supernatural intrusion |
| --- | --- | --- | --- |
| Hoshigawa / Sodegaura | cedar river, terraced homes, harbor inspection, monsoon slate | bridge, riverbank, roof, lantern, pier, warehouse, fishing gear | black registry tags, one bell echo in water |
| Takamine Bell Temple | mountain steps, experimental local bell registry, hidden chapel rooms, wet bronze | stairs, corridor, prison lattice, bell, paper screen, cedar gate | seams of ash in bell cavities; red wax on official records |
| Nagi Sea Road | fog islands, carrack wreck, salt-worn shrines, net sheds | docks, sea rocks, boats, sail cloth, tide pools, storm walls | moonlit Umbral reflection; impossible still water around a bell shard |
| Kagura Pass / Ash Fields | volcanic slope, relay stations, furnace sheds, wind-blown grass | black rock, rope bridge, kiln, cart, warning posts | soot that rises against wind; Ashen Oni mask patterns in slag |
| Kurohana Castle | black lacquer administration becoming living fortress | palace corridor, archive, chapel, gate, organ-like bell machinery | architecture subtly develops veins, bell mouths, and blood-dark glass |

### Cultural and historical guardrails

- Treat early-Edo Japan as a lived world with varied Japanese people, occupations, regional practices, and political positions. It is not a generic backdrop for foreign heroes.
- Historical reference is for material truth: roof construction, garments, trade objects, paper, lacquer, coastal labor, records, architecture, and weather. Confirm period details with the planned Japanese cultural historian before final art lock.
- Christianity, shrine practice, and domestic ritual may appear as people and places, never as interchangeable magic decorations. Do not turn real sacred objects or real historical victims into loot, enemy props, or boss arenas.
- The Ashen Oni are a deliberate fictional synthesis under a contested in-world label. Their masks, anatomy, and behavior must not claim a canonical oni design or reproduce a specific sacred figure, ceremonial mask, or identifiable local tradition.
- Kurozane’s black chrysanthemum is deliberately stolen and defaced imperial imagery. Frame it as illegitimate usurpation, never as an authentic shogunal crest or a neutral government emblem.
- Court uniforms are invented: dark lacquer, chrysanthemum geometry, iron ledger tabs, and blood-black seals. They do not need to copy a real shogunal insignia.
- The Covenant of the Severed Dragon, its 1462 vampire emergency, and its counter-ward are invented. Use a broken, asymmetrical dragon-line abstraction that reads as an interrupted command circuit; do not reproduce the historical Order of the Dragon's insignia, authentic Wallachian heraldry, a Christian sacrament, or a real devotional seal.

## 5. Character and enemy language

### Party silhouette rules

At 32 x 48, each party member must be identifiable in monochrome, from either field-facing direction, and against rain-dark ground.

| Character | Silhouette anchor | Base color cue | Animation emphasis |
| --- | --- | --- | --- |
| Ren Ishikawa | courier satchel, short spear, forward-leaning coat | cedar brown + rain blue | quick measured step; spear line makes Pierce range clear |
| Aya Shinohara | squared archive case, folded record-seal fan, layered sleeves | parchment + muted teal | deliberate seal placement; paper arc stays readable; no devotional talismans |
| Nikola Dražanić | square-shouldered rain cloak over a fitted oxblood doublet and plain falling band; compact crossbow, long rapier, brass signet clasp bearing an invented severed-line device | dusk blue + dark oxblood + brass | proud upright idle, exact rapier lunge, controlled recoil; Severed Dragon Radiance interrupts command seals without crowning its bearer; high forehead, narrow moustache, and clipped beard establish an original Croatian male face distinct from Mateus |
| Father Mateus Avelar | narrow cassock-derived coat, high collar, ring of keys, controlled posture | charcoal + dried-wine accent | a held stillness that breaks into costly blood-rite motion; original face and proportions |
| Genta Mononobe | broad shoulder mantle, tetsubo or shield mass | earth gray + oxidized gold | braced stance and lane-blocking impact |
| Kiku Nawa | medicine box, short cloak, bottle/packet read | herb green + candle ivory | toss, mix, and terrain placement instead of attack flourishes |

Combat portraits use 32 x 32 or 40 x 40 frames with a flat value field behind them. Portraits should communicate role and current state, not fashion illustration detail.

### Enemy hierarchy

- **Human court personnel:** crisp verticals, paper seals, lacquer trim, readable weapons; corruption shows in behavior and accessories rather than race or deformity.
- **Ashen Oni:** furnace-ash body, invented geometric face mask, broken bell-metal joints, ember core visible only in active frames. No cultural shorthand for evil.
- **Undead officers:** court clothing remains recognizable but the silhouette has one impossible feature (too-long shadow, empty sleeve, bell halo, or unblinking mask). Avoid gore.
- **Bosses:** one visually dominant mechanic and one breakable read. A bell boss has a visible resonant throat; a forge boss exposes a slag vent; Kurozane's court form reveals the black-bell network and individually separable office seals rather than becoming a pile of unrelated spikes. His final read must support a living, ward-broken surrender tableau before the Storyworld branch; execution is never staged as a collectible kill flourish.

### Final political-branch presentation

The witnessed-transfer branch frames route delegates and named witnesses above Kurozane: each military, registry, granary, and bell seal leaves his body separately, while the Severed Dragon boundary stays visibly temporary and does not pass into Nikola. The execution/failed-transfer branch preserves the same evidence but shows command lines rupturing outward into competing seals, mounted messengers, guarded rice roads, and civil-war checkpoints. Do not substitute a clean castle explosion, triumphant coronation, radiant absolution, or heroic execution pose for either political consequence.

## 6. Battle-stage, UI, and VFX language

### Battle stage composition

Each stage has a legible floor plane, one midground story object, and one high-contrast focal shape. The following zones are reserved:

| Screen zone | Required content | Do not place |
| --- | --- | --- |
| Header | Tempo ribbon, active portrait, compact phase state | scenery with critical contrast behind portrait icons |
| Center | 12 x 7 board, units, selection path, hazards | tall props that obscure legal spaces |
| Right / inspect zone | Ledger values and enemy intent when open | key attack telegraph or selected target |
| Footer | commands, recovery count, damage log | opaque art that hides the board edge |

The concept target's large board treatment is a communication reference. Final implementation uses the technical GDD's exact 12 x 7 spatial contract; no artwork may move a resolved unit or conceal a blocked cell.

### Element and damage code

Icons use shape plus color so they remain legible under accessibility filters and at small scale.

| Type | Shape and motion | Accent |
| --- | --- | --- |
| Cut | diagonal cleft, short white edge | steel blue |
| Pierce | narrow line and diamond point | brass / rain blue |
| Crush | square impact ring and downward fragments | stone gray |
| Arcane | nested angular seal | violet-neutral |
| Ember | three-prong flame, rising 2-pixel embers | vermilion |
| Frost | six-point shard, outward 1-pixel crack | pale blue |
| Storm | split zigzag, brief vertical flash | cool white / electric blue |
| Radiance | eight-ray disc, opening ring | candle ivory / dawn teal |
| Umbral | thorned crescent, inward-falling particles | black-crimson / restrained violet |

Weakness, resistance, null, and absorb must change both a concise symbol and the damage-log treatment. Do not communicate multiplier only through red/green color. Recovery appears as discrete pulse pips or crescent locks: it is a rule-layer state, not an arbitrary slow animation.

### VFX limits

- Ordinary hit: 3-5 frames, 12-24 pixels of focal spread.
- Skill hit: 6-10 frames, a distinct wind-up/active/recovery silhouette, never covers all units for more than two frames.
- Ultimate / boss telegraph: may fill the board but first holds its danger shape for at least 12 frames before the active hit.
- Use particles for information, not confetti. Ember rises, Frost settles, Storm forks, Radiance opens, Umbral collapses inward.

## 7. Animation contract

| Asset | Minimum frame plan | Approval criterion |
| --- | --- | --- |
| Field idle | 4-6 | rain, cloth, or breathing does not create distracting jitter |
| Field walk | 6-8 | footfalls align with collision/pace; no skating |
| Combat idle | 4-6 | stance identifies weapon and facing |
| Basic action | 6-10 | wind-up, active frame, and recovery are visually distinct |
| Hit / guard | 3-4 | direction and protected side are legible |
| Death / retreat | 5-8 | readable non-gory outcome; no need for a unique complex collapse for every enemy |
| Weather loop | 4-8 | sparse, modular, and stable under parallax |

Animation timing communicates game rules. A heavy action must visibly commit before its recovery lock; a quick action cannot masquerade as the same timing. Final timing remains owned by the simulation and UI, never by an artistically extended clip.

## 8. Production handoff and approval gates

1. **Reference packet:** material reference, rough map, collision sketch, value thumbnail, and story purpose.
2. **Black-and-white thumbnail:** validate route, focal shape, and party silhouette before palette work.
3. **Palette key and module sheet:** approve terrain modules, depth bands, and material ramps before a full map.
4. **Animation key poses:** approve wind-up, active, and recovery on a contact sheet before in-betweens.
5. **In-engine review:** inspect field/story work at 320 x 180 and battle work on the current 960 x 540 canvas with its exact 12 x 7 overlay, UI, telegraphs, and weather enabled.
6. **Cultural/sensitivity pass:** review final costume, religious context, wording on signs/records, and fictionalization boundaries before locking.

Reject an asset if it: breaks the grid; relies on blur; makes a collectible of a sacred object; obscures combat geometry; makes all Japanese civilians visually identical; turns a real faith or ethnicity into a monster class; or needs a franchise/celebrity comparison to explain its appeal.

## 9. Art delivery convention

- Source: indexed or layered working file plus a flattened PNG preview; retain palette and frame data.
- Export: `area_subject_variant_state.png` in `assets/art/` once the production pipeline exists. Example: `takamine_gate_rain_night_v01.png`.
- Sprite sheets include a JSON or CSV frame map, pivot/foot point, palette ID, and animation tags.
- Concepts live in `assets/concepts/` and remain separate from shippable sprite/tileset source. Do not bake their generated pixels into the final game.
