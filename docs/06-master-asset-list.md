# Bells of the Black Chrysanthemum - Master Asset List

**Status:** pre-production inventory, version 1<br>
**Coverage target:** 80-90% of visual production needs for a 20-25 hour, ten-chapter, 2D pixel-art JRPG.<br>
**Assumptions:** 320 x 180 logical pixels; 16 x 16 terrain modules; six permanent party members; three active combatants; five principal regions plus Kurohana Castle; a chapter-led route rather than ability-gated Metroidvania progression.

This list is the art-production authority. Quantity is a planned final count, not a promise that every item must be unique. Reuse a carefully bounded kit aggressively; create bespoke assets only where story, navigation, or battle readability requires it.

**Current authored-runtime status (2026-07-20):** all 19 current combat boards are authored: Takamine plus 18 regional boards. The party field atlas contains 84 unique frames (6 × 14) with paired directional walk phases plus live interact/hurt; every row is reachable through a selector bounded by each level's canonical formation, the visible leader owns field-hazard vitals, and remaining members follow successful persisted departures through a presentation-only trail. Combat-action keys (6 × 10, including recovery and defeat) and portrait expressions (6 × 8) remain integrated. Runtime art also includes 19 transparent terrain overlays covering all 48 levels, eight regular-enemy families × seven poses, ten bosses × seven poses, nine delivery/essence VFX × six phase frames, six statuses × three lifecycle frames, a 25-icon item atlas fully exposed by Camp, and a metadata-only 16-role NPC suite with south-idle and empty-hand conversation frames. Nine level contacts and four named side-story contacts use explicit community roles; 37 schema-bounded interview nodes retain the generic interviewee role. Battle reuses River Salve's one frame from the item atlas. Exact code-native damage flyouts cover WEAK, RESIST, IMMUNE, ABSORB, GUARD, and WARD outcomes; River Salve adds an exact heal flyout and source-to-ally command route. Campaign Dodge presentation is live through persistent code-native chevrons and the existing authored party `move` pose; it adds no bespoke Dodge bitmap and never changes the resolved simulation cell. River Salve reuses the authored item icon and requires no new bitmap. Procedural/generic/text/flat-color fallbacks remain. Remaining combat/scene in-betweens, alternate action facings, NPC directions, and variants are still absent. Human readability, external cultural review, and Accepted/art lock remain pending.

The live scene-panorama package accepts `MAP-CIN-001-020`: 20 distinct opaque 320×180 frames in one manifested 1600×720 atlas, mapped explicitly across 60/60 canonical beats. Exact canonical-level compatibility, natural-dimension validation, a static code-native fallback, a deterministic builder, raw-RGBA frame hashes, production/runtime byte identity, and a labeled review sheet are automated. This is decorative dialogue/cutscene coverage only. It does not replace the 19 combat boards, accept any of the other 49 planned map/backdrop deliverables, establish the still-unproduced whole-field map/prop/foreground packages, or accept the 24 core/reuse tileset kits. Human backdrop/portrait/text readability, Narrator/NVDA, external cultural review, and Accepted/art lock remain pending.

## 1. Asset states, priorities, and naming

| Code | Meaning |
| --- | --- |
| P0 | Blocks the first playable, an art style lock, or an early chapter map. |
| P1 | Needed before full chapter production begins. |
| P2 | Needed for later chapter, optional content, or polish. |
| P3 | Post-vertical-slice variation; never blocks core path. |
| Briefed | reference, use case, collision/animation purpose, and acceptance rule are approved. |
| Produced | source and export exist; not yet accepted in engine. |
| Integrated | authored export is wired into the runtime with automated addressing/fallback checks; human review may still prevent Accepted/art lock. |
| Accepted | reviewed in-engine at logical resolution with UI/lighting enabled. |

**ID convention:** `CAT-REGION-NNN` (for example `ENV-TAK-014`). Animation sheets append `_anim`; variants append `_v02`. Every sheet records source path, palette ID, pivot/foot point, collision class, frame tags, and owner.

## 2. Concept and art-direction anchors

| ID | Asset | Qty | Priority | Acceptance / dependency |
| --- | --- | ---: | --- | --- |
| CON-001 | World/story screenshot target | 1 | P0 | [World concept](../assets/concepts/bells-world-story-target-v1.png) approved for mood, depth, and route readability; not a production source. |
| CON-002 | Battle screenshot target | 1 | P0 | [Battle concept](../assets/concepts/bells-battle-target-v1.png) approved for board/UI/element communication; final board follows 12 x 7 GDD. |
| ART-001 | Base palette, ramps, accessibility contrast sheet | 1 | P0 | 8 core families, day/night variants, color-blind validation swatches. |
| ART-002 | Pixel-cluster, outline, material, and rain style sheet | 1 | P0 | Demonstrates cedar, lacquer, paper, bronze, water, ash, stone, skin, cloth. |
| ART-003 | UI ornament / icon grammar sheet | 1 | P0 | Nine-slice rules; element shapes; selection, weakness, resist, recovery, and focus state. |
| ART-004 | Character silhouette approval board | 1 | P0 | Six party members, 10 core enemy families, and five bosses readable in monochrome. |

## 3. Foundation tiles, props, and field systems

| ID range | Asset family | Planned qty | Priority | Reuse / acceptance rule |
| --- | --- | ---: | --- | --- |
| ENV-GEN-001-012 | universal terrain: earth, grass, wet stone, wood, plaster, roof, water, cliff, ash, snow/frost, sand, black lacquer | 12 material families | P0 | 16 x 16 base, edge, inner/outer corner, transition, damaged, wet/dry variants; each uses the base palette. |
| ENV-GEN-013-020 | traversal interaction kit | 8 sets | P0 | door, ladder, bridge, rope bridge, stair, gate, plank, cart. Clearly mark collision/snap/foreground layers. |
| ENV-GEN-021-030 | weather / time layers | 10 | P0 | rain, heavy rain, mist, sea spray, ash, ember, wind grass, candle flicker, lightning, dawn particles. Modular, non-obscuring. |
| PROP-GEN-001-025 | domestic and trade prop kit | 25 clusters | P1 | baskets, barrels, nets, rice sacks, paper bundles, crates, tools, cookfire, cloth, signs with planned localization space. |
| PROP-GEN-026-042 | authority / registry prop kit | 17 clusters | P1 | registry desk, ledger chest, seal stand, patrol lantern, barrier, notice board, prisoner lattice, inspection kit. No real insignia. |
| PROP-GEN-043-058 | shrine / chapel / bell kit | 16 clusters | P1 | generic fictional ritual and architectural pieces; review before final art; not loot or enemy trophies. |
| PROP-GEN-059-070 | destruction and repair states | 12 clusters | P2 | intact, damaged, burned, flooded, repaired variants of reusable story props. |

**Current field-terrain receipt:** the live 80 × 64 transparent atlas contains 19 distinct 16 × 16 overlays: the default stone floor plus every terrain tag authored across all 48 levels. The browser paints the level-owned flat color first and composites the overlay only after an exact dimension gate; image failure, wrong size, and unknown tags retain the flat-color/geometric renderer. This is complete coverage of current live tags, not the planned edge/corner/transition, prop, landmark, foreground-mask, or weather packages above. Overlay pixels never define collision, exits, hazards, movement, or interactions.

## 4. Location and map production

Each kit includes tile sheet, auto/edge rules, 6-12 large landmarks, 12-20 small props, foreground masks, collision reference, weather layer, and a 320 x 180 value thumbnail per map. Counts below are maps, not individual screens.

| ID range | Region / map group | Map qty | Tileset kits | Landmark / set-piece qty | Priority | Notes |
| --- | --- | ---: | ---: | ---: | --- | --- |
| MAP-HOS-001-006 | Hoshigawa village, cedar routes, Sodegaura Port | 6 | 3 | 12 | P0/P1 | Opening town, river bridge, inspection dock, household interiors, rain gate. Establishes domestic warmth under pressure. |
| MAP-TAK-001-008 | Takamine Bell Temple, registry, prison, undercroft | 8 | 4 | 16 | P0/P1 | First playable uses the rain gate; include first board backdrop and bell/prison story objects. |
| MAP-NAG-001-007 | Nagi Sea Road, fishing villages, fog islands, wreck | 7 | 4 | 14 | P1 | Waterline collision, wet rock readability, ship interior/exterior reuse. |
| MAP-KAG-001-008 | Kagura Pass, relay station, ash fields, oni forge | 8 | 4 | 16 | P1 | Ash/weather legibility; moving carts and falling floor hazards need explicit states. |
| MAP-KUR-001-012 | Kurohana Castle exterior, archive, court, chapel, bell engine, throne | 12 | 6 | 24 | P1/P2 | Final dungeon uses modular black-lacquer kit plus increasing organic/bell intrusion. |
| MAP-OPT-001-008 | optional revisits, side rooms, Lantern Network refuges | 8 | 3 reuse extensions | 10 | P2 | No main-route movement power gate; create shortcuts and lore/supply rewards only. |
| MAP-CIN-001-020 | chapter scene backdrops / panorama composites | 20 | derived | 20 | P1/P2 | Dialogue/cutscene compositions: one key background per chapter plus major reversal/boss scenes. |

**Map total:** 69 map/backdrop deliverables; 24 core/reuse tileset kits; approximately 92 major landmarks/set pieces. Final individual room count is a level-design decision; art begins only after each map's collision sketch and value plan are accepted.

**Current scene-panorama receipt:** `MAP-CIN-001-020` is Integrated, not Accepted. Each frame reserves a quiet lower 48-pixel overlay band and a declared focal-safe rectangle, uses no actor or readable-text pixels, and remains subordinate to the existing portrait, location, atmosphere, dialogue, choices, and presentation transcript. The exact 60-beat registry is presentation-only and owns no map, collision, route, hazard, objective, encounter, actor, save, telemetry, or evidence state. The 69-deliverable and 24-tileset plans above remain unchanged.

## 5. Party, NPC, and portrait assets

| ID range | Asset family | Qty | Priority | Minimum production package |
| --- | --- | ---: | --- | --- |
| CHR-PARTY-001-006 | Ren, Aya, Lise, Mateus, Genta, Kiku field sprites | 6 | P0/P1 | 4 directional idle, 4 directional walk, interact, hurt, celebration/scene pose; 32 x 48 nominal. |
| CHR-PARTY-007-012 | party combat sprites | 6 | P0/P1 | idle, move, guard, hit, basic strike, 2 signature skills, defeat/retreat; 48 x 64 nominal. Live Dodge deliberately reuses `move` plus code-native chevrons rather than requiring a bespoke bitmap. |
| CHR-PARTY-013-018 | party portraits + emotion set | 6 x 8 expressions | P1 | neutral, determined, concern, anger, pain, relief, surprise, quiet; original faces only. |
| CHR-PARTY-019-024 | party gear accent overlays | 6 sets | P2 | weapon/off-hand and major Vow visual changes; do not require separate full sprite bodies per equipment item. |
| NPC-HOS-001-018 | Hoshigawa / port named and crowd NPCs | 18 | P1 | 8 named, 10 modular; farmer, courier, sailor, artisan, official, family silhouettes. |
| NPC-TAK-001-014 | Takamine named and crowd NPCs | 14 | P0/P1 | prisoners, caretakers, guards, registrar, Lantern contacts; state variants for key scenes. |
| NPC-NAG-001-012 | Sea Road NPCs | 12 | P1 | fishers, smugglers, sailors, wreck survivors, local officials. |
| NPC-KAG-001-012 | Pass / ash field NPCs | 12 | P1 | relay workers, defectors, forge prisoners, traveling households. |
| NPC-KUR-001-016 | Court / castle NPCs | 16 | P1/P2 | magistrates, clerks, retainers, servants, prisoners; court clothing is fictionalized. |
| NPC-GEN-001-012 | generic reuse NPC sheet | 12 bodies x 4 palettes | P1 | body/garment combinations, 4-direction idle/walk; localization-safe speech pose. |

**Character art total:** 6 party field sheets, 6 party battle sheets, 48 party portrait expressions, 84 regional/named NPC packages, and 48 generic NPC combinations.

**Current NPC foundation receipt:** the live 128 × 48 atlas contains `speaker`, `interviewee`, `confined-person`, and `courier`, one 32 × 48 south-idle frame each with feet pivot `(16, 44)`. Exact `type: 'talk'` plus `targetKind: 'person'` metadata maps 4/71 side-story objectives; four `targetKind: 'group'` talks retain geometry. Exact `activityType: 'interview'` maps 37/183 scene-operation nodes. Level schema v2 explicitly maps nine singleton speakers, two confined people, and one courier; six refusal contacts use their exact existing party rows. No action/ID/label/name/result/prose inference exists; witness fieldwork and all untyped prop, hazard, exit, evidence, mechanism, delivery, care/rescue, council, combat, and ambiguous markers retain geometric fallback. The planned totals above remain unchanged.

## 6. Enemy and boss production

Enemy package = field silhouette where needed, combat idle, move, attack/telegraph, hit, defeat, 32 x 32 portrait, Ledger icon, and damage-type tag. A family shares base anatomy and has 2-4 palette/weapon variants.

| ID range | Family / boss | Variants | Priority | Readability and reuse note |
| --- | --- | ---: | --- | --- |
| ENM-001 | Cinder Hound | 3 | P0 | Ember tell is rising cinders, not a generic red glow. |
| ENM-002 | Ash Wisp | 3 | P0 | Umbral/Arcane status telegraph; transparent look is faked with clusters, no alpha haze. |
| ENM-003 | Bell Moth | 3 | P0 | flight height and bell-sound attack need a clean shadow/target read. |
| ENM-004 | Tithe Enforcer | 2 | P0 | First-playable Ashen Oni retainer; Crush and Umbral actions have distinct silhouette. |
| ENM-005 | Registry Hound / court scout | 3 | P1 | human/court hierarchy, readable notice-scroll weapon. |
| ENM-006 | Drowned Retainer | 3 | P1 | Frost/Umbral accents; wet cloth and water trail stay contained. |
| ENM-007 | Lantern Leech | 3 | P1 | status enemy; use readable tether path, never screen-covering particles. |
| ENM-008 | Salt Warden | 2 | P1 | sea-route elite; Pierce resistance/Crush weakness visible through armor. |
| ENM-009 | Ashen Spearman | 3 | P1 | spacing teacher; long spear telegraph shows future cells. |
| ENM-010 | Ashen Banner Guard | 2 | P1 | lane-blocking elite; banner makes Guard state visible. |
| ENM-011 | Forge Thrall | 3 | P1 | Ember hazard spawner; compact furnace core. |
| ENM-012 | Bell Scribe | 2 | P2 | Arcane support; uses record/mark graphics, not real sacred text. |
| ENM-013 | Court Vampire Officer | 3 | P2 | aristocratic but original; one impossible silhouette feature per variant. |
| ENM-014 | Black Bell Fragment | 2 | P2 | environmental enemy/mechanism, clear break/active state. |
| BOS-001 | Tithe Enforcer Ascendant | 1 | P0 | Chapter 1 boss; 96 x 96, bell-backed club telegraph, two breakable reads. |
| BOS-002 | Takamine Bell Warden | 1 | P1 | temple/register boss; visible resonance zones. |
| BOS-003 | Wreck Matriarch | 1 | P1 | sea boss; water-space hazards, not a real folklore figure. |
| BOS-004 | Forge of Names | 1 | P1 | mechanical forge boss; exposes vent/slag logic. |
| BOS-005 | Magistrate Ujiro Arata | 1 | P2 | named human antagonist; authority/cowardice expressed in tools and staging. |
| BOS-006 | Father Mateus Avelar - court form | 1 | P1 | original vampire priest form; redemption context affects staging; no celebrity reference. |
| BOS-007 | Shogun Kurozane, Black Chrysanthemum | 2 phases | P2 | original final form plus bell-network phase; no borrowed castle/vampire design. |

**Enemy total:** 14 base families / 38 planned variants, 7 named boss encounters, 8 boss-form deliverables including phase distinction.

## 7. Battle stages and hazards

| ID range | Asset family | Qty | Priority | Acceptance rule |
| --- | --- | ---: | --- | --- |
| BST-001-015 | standard battle stages | 15 | P0/P1 | one for each recurring environment cadence; floor plane aligns to 12 x 7 spaces; one story object; no target-zone obstruction. |
| BST-016-024 | boss battle stages | 9 | P1/P2 | bespoke mechanics with clear hazard geometry, phase art states, and UI safe zones. |
| HZD-001-012 | reusable hazards | 12 | P0/P1 | fire line, frost patch, bell pulse, falling beam, water current, ash vent, thorn seal, unstable plank, etc.; idle/armed/active/cool states. |
| HZD-013-018 | boss-only hazards | 6 | P2 | unique warnings and resolve states; minimum 12-frame telegraph before hit. |
| BTL-001-010 | player command targeting overlays | 10 | P0 | movement route, melee, line, cross, cone, radius, ally target, swap edge, invalid cell, focus. |
| BTL-011-018 | enemy intent overlays | 8 | P0/P1 | intended line/area/facing, guard, charge, recover, buff, summon, hazard trigger. |

## 8. VFX, icons, UI, and typography

| ID range | Asset family | Qty | Priority | Minimum package |
| --- | --- | ---: | --- | --- |
| VFX-DEL-001-004 | delivery effects: Cut, Pierce, Crush, Arcane | 4 | P0 | wind-up/active/recovery marker, hit, weak/resist variation. |
| VFX-ESS-001-005 | essence effects: Ember, Frost, Storm, Radiance, Umbral | 5 | P0 | cast, projectile/area, impact, linger, weak/resist variation. |
| VFX-STA-001-006 | status effects: Dread, Chill, Shock, Scorch, Bound, Overheated | 6 | P1 | Live authored apply/refreshed, persistent-active, and expire frames; cleanse is unsupported because Campaign has no cleanse event. |
| VFX-SYS-001-014 | system feedback | 14 | P0 | Move, selected cell, blocked, Guard, Campaign Dodge commit/stance/resolution, Item route/heal, Analyze, objectives, recovery lock, Tempo, exact published-line evasion, distinct non-locking victory/defeat accents, and typed damage-outcome flyouts are live. Campaign Dodge uses code-native chevrons and the existing move pose; River Salve reuses its item icon; route preview remains one-step. |
| UI-001-010 | battle UI kit | 10 panels | P0 | header/Tempo ribbon, Ledger, command row, recovery pips, HP/Spirit, damage log, tooltip, pause, victory, defeat. |
| UI-011-020 | field/menu UI kit | 10 panels | P1 | dialogue, nameplate, journal, party, equipment, Vow board, shop, save, map, accessibility. |
| ICO-001-036 | icon atlas | 36 | P0/P1 | 9 damage types, 6 statuses, 6 gear slots, 6 commands, navigation, currency, quest, danger, network, etc. |
| FNT-001-003 | bitmap font and localization support | 3 | P0 | Latin, Japanese-capable plan/placeholder, numerals/symbols; runtime text not baked into art. |
| CUT-001-015 | scene transition / dialogue accents | 15 | P1 | bell pulse, paper reveal, rain fade, seal break, chapter card frame, choice focus, flashback treatment. |

**Current item-icon receipt:** a separate live 80 × 80 atlas supplies one distinct 16 × 16 decorative icon for all 25 `ITEM_CATALOGUE` IDs. Camp inventory/shop and Battle Item text remain authoritative and intact on load or dimension failure. River Salve uses its canonical frame at 2× scale in the native selector and battle Canvas; the broader 36-icon UI target above remains planned.

## 9. Item, equipment, and interface illustration

| ID range | Asset family | Qty | Priority | Notes |
| --- | --- | ---: | --- | --- |
| ITM-001-030 | consumables / key items | 30 | P1 | icon plus one field pickup where needed; bottles, remedies, maps, seals, keys, bell fragments. |
| EQP-001-036 | weapons / focus / armor icons | 36 | P1/P2 | weapon changes basic Strike identity; use overlays only for major visible equipment. |
| VOW-001-036 | Vow-node icons | 36 | P1 | six characters x 6 final planned nodes; compact, role-specific, accessible shape language. |
| ILL-001-012 | journal/ledger spot illustrations | 12 | P2 | maps, faction marks, monster notes, historical-material thumbnails; never claim a real historical document. |

## 10. Chapter 1 / first-playable delivery cut

This cut is the first staffing and outsourcing package. It is intentionally complete enough to validate the look without producing the entire game first.

| ID | Deliverable | Quantity | Blocks | Definition of done |
| --- | --- | ---: | --- | --- |
| C1-ART-001 | palette/style/UI grammar sheets | 3 | all production | approved against both concept targets and in-engine 320 x 180 review |
| C1-ART-002 | Takamine Bell-Chamber battle stage | 1 | first playable | Produced and integrated as an editable 384 x 224, 12 x 7 board at exact 2x; automated geometry/layer/fallback checks pass; subjective telegraph and external cultural review remain before Accepted/art lock. |
| C1-ART-003 | Takamine path, gate, registry, chapel, undercroft map kits | 5 | Chapter 1 | collision thumbnails, day/rain variants, story objects, foreground mask |
| C1-ART-004 | Ren field/combat/portrait package | 1 | first playable | all required movement, command, Guard, hit, defeat tags |
| C1-ART-005 | Lise scene/field/portrait package | 1 | first playable narrative | original traveler/hunter silhouette; no real-person reference |
| C1-ART-006 | Father Mateus Avelar scene/portrait package | 1 | first playable narrative | original court interpreter silhouette, no likeness reference, and consistent with the permanent party-art package |
| C1-ART-007 | Ashen Oni Tithe Enforcer package | 1 | first playable | two attacks, intent, hit/defeat, Ledger portrait, original mask language |
| C1-ART-008 | Cinder Hound, Ash Wisp, Bell Moth packages | 3 | Chapter 1 | core enemies test Ember/Radiance weakness and Umbral resistance feedback |
| C1-ART-009 | Cut/Pierce/Crush/Arcane + Ember/Radiance/Umbral VFX | 7 | first playable | wind-up/active/recovery, weak/resist state, no obscuring particles |
| C1-ART-010 | Tempo/Recovery/Ledger/command UI | 4 panels + 18 icons | first playable | readable actual recovery and damage multipliers at 320 x 180 |
| C1-ART-011 | Chapter 1 NPC package | 14 | Chapter 1 | named contacts, prisoners, officials, generic variants; cultural review scheduled |
| C1-ART-012 | Tithe Enforcer Ascendant boss stage/form | 1 boss + 1 stage | Chapter 1 finale | telegraph zones and phase transition are readable, non-gory, and test pacing |

## 11. Out-of-scope protections

- Do not commission final art for ability-gated traversal, platform jumps, morph forms, or other Metroidvania power locks. The game uses chapter routes, optional shortcuts, and story/party discoveries.
- Do not make a bespoke sprite body for every equipment item. Use weapon/focus overlays and portrait accents unless a story costume needs a new silhouette.
- Do not bake English/Japanese dialogue or localized button labels into background art. Reserve text-safe panels and use the bitmap font.
- Do not make distinct particle systems for every damage-number outcome. Shared delivery/essence modules plus clear weak/resist feedback are the production-saving rule.
- Do not place generated concept pixels in production sprite sheets. They are references; all shippable pixels require original, editable source and the normal approval gates.

## 12. Asset-list maintenance cadence

The producer updates this file weekly during pre-production and after each chapter outline lock. Any new P0/P1 item needs: story/map owner, technical requirement, art reference, rough effort, reuse decision, and approval date. A late item that creates a new tileset, party silhouette, UI system, or boss family is a scope change and must be reviewed before assignment.
