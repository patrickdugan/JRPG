# Bells of the Black Chrysanthemum

## Vision document

**Working title:** *Bells of the Black Chrysanthemum*<br>
**Format:** 2D pixel-art, party-based turn RPG<br>
**Target scope:** an intended 20-hour first-play route; 6 permanent party members; 3 active combatants. Duration audit v8 estimates the 60-beat canonical story at about 5.15 reference hours and the complete 215-activity route at about 20.54 reference hours; human timing remains unproven.<br>
**Setting:** An alternate, historically informed Japan in Genna 8 (1622), during the early Edo transition and the widening suppression of Christianity. The date deliberately coincides with the historical Great Genna Martyrdom; the game neither reenacts that event nor borrows its victims, places, or methods. The country, rulers, clans, villages, supernatural events, and the precise fictional divergence are documented separately in the [historical and cultural audit note](20-historical-cultural-audit.md).

### One-sentence pitch

In a rain-darkened, alternate Genna 8 (1622) Japan ruled from the shadows by an immortal shogun, a village courier, a disgraced priest-vampire, and a foreign heir to an old hunting oath cross haunted provinces to break the bell that turns political fear into undeath.

### Player promise

*Bells* gives the player the party warmth and escalating adventure of a classic 16-bit JRPG, but makes every battle a readable, spatial duel on a compact gothic stage. Position, weapon damage type, elemental affinity, and recovery timing matter. The player wins by understanding the enemy, not by rushing inputs or grinding a single attack.

## Genre, hook, and tone

### Genre

Historical dark-fantasy JRPG. The baseline is a linear, chapter-led party adventure with towns, field routes, dungeons, bosses, gear, and optional side stories. Japan’s early-seventeenth-century encounter with foreign trade, clandestine Christian communities, and anti-Christian policy informs the human stakes. After the 1614 nationwide ban, any active missionaries in the story are concealed holdovers or clandestine returnees rather than members of an open mission; vampires, bell magic, and the Black Chrysanthemum court are wholly invented.

### Hook: the measured battle stage

Every encounter occurs on a small 2D combat stage: a shrine roof, ruined chapel, ship hold, prison yard, or castle hall. Turns remain fully turn-based, but an actor has a limited **Pace** allowance before choosing an action. That lets the player step out of a telegraphed sweep, line up a thrust, protect an ally, or move an enemy into a hazard.

Attack animations have an explicit wind-up, active hit, and **Recovery** value. A powerful sword cut may end a foe’s turn, but it also delays the user’s next activation. The meaningful question is never “can I mash this?” but “is this worth being exposed for two pulses?”

This is not action combat and not a platformer:

* Menus pause the action clock; commands are deliberate.
* Movement is precise and deterministic, but there are no reflex jumps, air control tests, or real-time dodge rolls.
* The world is not a Metroidvania. Progression is chapter-and-quest based; revisits and optional shortcuts reward curiosity but no movement power gates the main route.

### Tone

Somber, intimate, and ultimately defiant. The game takes religious persecution, betrayal, and coercion seriously without treating a living faith, a Japanese tradition, or an ethnicity as monstrous. Horror is baroque and mournful rather than splattery: rain on lacquered wood, a bell ringing under floorboards, candlelight behind paper screens, and the terrible compromise of surviving by serving evil.

Humor comes from party friction, awkward translation, travel routines, and small human warmth—not from victims or belief. The ending should leave the player with earned hope: power may silence a public voice, but it cannot decide what people owe one another.

## Design pillars

1. **Read the room, then take the turn.** Enemy intent, range, resistance, and recovery are visible or discoverable. Battles reward attention.
2. **Precision without twitch play.** Field navigation and battle positions are exact, with stable collision and clear danger shapes, but decisions happen at a human pace.
3. **A party changes the argument.** Each hero offers a different answer to fear: protect, flee, bargain, remember, retaliate, or refuse.
4. **Japan is a lived place, not wallpaper.** Domestic spaces, trade routes, local customs, changing political obligations, and the voices of Japanese characters carry the setting. Foreign characters are not default authorities.
5. **Pixel art by design.** Every sprite, map, and effect is composed around silhouette, value, material, and animation purpose before production. “Retro” is a constraint, not a substitute for art direction.

## Campaign structure and player loop

The critical path is a classic JRPG chain:

1. Receive a concrete local objective.
2. Speak with people in a town, outpost, or route hub.
3. Cross one field route and enter a themed dungeon.
4. Learn a faction’s immediate need and a new battle interaction.
5. Defeat a named boss, gain story information and a party/system reward.
6. Return to a hub, change party/gear, and choose a short optional detour or proceed.

The game has ten chapters, five principal regions, and a final castle assault. A chapter normally adds one party relationship, one enemy family, one dungeon mechanic, and one new combat consideration. No more than two new systems are taught in a single chapter.

## Battle system basics

### Party and turn structure

* **Active party:** 3 characters. **Roster:** 6 permanent members.
* **Turn order:** Each combatant fills a visible **Tempo** meter. When a meter reaches 1000, that combatant receives an Activation. The player may inspect the next six activations at all times.
* **Pace:** At the start of a friendly Activation, an actor has 2 Pace. One Pace shifts one 32-pixel combat space in any of eight directions. Pace is spent before the command and does not advance time.
* **Commands:** Strike, Skill, Guard, Dodge, Item, Analyze, and Change. A command is selected on an Activation; menu selection pauses the stage.
* **Recovery:** Every command adds a listed Recovery value (0–3 pulses) to the actor. Recovery is a second, visible lock layered over Tempo. A character whose meter fills while recovering waits until the listed pulses resolve. Basic strikes are quick but low impact; heavy attacks, spells, and wide-area tools deliberately create exposure.
* **Defence:** Guard and Dodge are mutually replacing pre-committed stances and planning tools, never reaction buttons. In FP-0, Guard reduces the next documented hit by 45% and the unchanged fixed-seed Dodge proof gives a documented dodgeable physical attempt a 65% miss chance. Campaign Dodge instead guarantees a miss from the next incoming art whose catalogue record contains exact boolean `dodgeable: true`; it is never inferred from delivery, Essence, shape, animation, or prose. Its base Recovery is 1 with no Spirit cost, while loadout/status Recovery modifiers still apply to a minimum of 1. Non-dodgeable arts, status resolution, and attacks against another actor leave it intact. It does not move the resolved cell or create a real-time input window; code-native chevrons and the existing authored move pose communicate it without a bespoke bitmap.
* **Battle Item:** Campaign currently opts in only River Salve. It restores up to 80 HP to any living deployed ally at any distance, cannot revive, spends no Pace or Spirit, preserves stance, and commits base Recovery 2 with the normal modifier pipeline and one-pulse floor. Stock remains provisional until victory; Auto-Grind never consumes it. Other consumables remain Camp-only until Campaign and loadout MP, Spirit, and status vocabularies share one authority.
* **Swap:** Change moves a reserve character into a designated edge space and costs 1 pulse. It is valuable against a known resistance, but cannot erase a mistake for free.

Combat spaces are authored as a 12 × 7 board at 32 logical pixels per space, overlaid invisibly on an illustrated stage. Rendering is at 320 × 180 logical pixels and scales cleanly. Collision, target selection, and hazard checks use integer spaces and ordered rules; display animation never changes a resolved result.

### Damage and element language

Damage has one **delivery** type and, where appropriate, one **essence**:

| Delivery | Typical use | Essence | Typical use |
| --- | --- | --- | --- |
| Cut | swords, sickles, claws | Ember | flame, cinders, furnace spirits |
| Pierce | spears, bolts, needles | Frost | ice, river mist, stillness |
| Crush | clubs, bells, falling stone | Storm | thunder, wind, electric charge |
| Arcane | rites, mechanisms, curses | Radiance | dawn, warding, truth |
| — | — | Umbral | blood, shadow, grave magic |

Each enemy exposes a compact **Ledger** after Analyze, repeated observation, or a story clue: delivery resistance, essence resistance, key status immunity, and a one-line behavior note. Multipliers use plain values: 1.25× weak, 1.00× normal, 0.75× resist, 0× null, and −1.00× absorb. The battle UI always names the damage dealt and shows the multiplier; the player never needs a wiki to understand why a hit changed.

Status conditions are intentionally few: Bleed (damage on activation), Scorch (damage after command), Chill (−1 Pace next activation), Shock (cannot Guard), Dread (reduced healing received), and Bound (cannot move until hit or expiry). Boss statuses must be telegraphed and bounded rather than surprise permanent locks; Campaign cleanse authority remains deferred.

### Character roles and abilities

* **Ren:** adaptive Cut/Pierce attacker; marks a target’s facing and can redirect a foe one space.
* **Aya:** wards, healing, Radiance/Umbral analysis, and safe positioning tools.
* **Nikola:** rapid Pierce and anti-undead techniques; converts an enemy’s revealed weakness into a one-use opening. His exact execution rewards discipline that his impatient, rank-conscious temperament initially lacks.
* **Mateus:** Umbral magic, self-damaging blood rites, and late-game ally manipulation; his redemption is reflected mechanically by learning protective rather than extractive rites.
* **Genta:** Crush tank and battlefield anchor; locks lanes and absorbs forced movement.
* **Kiku:** Ember/Frost mixtures, remedies, and terrain effects that alter a small number of spaces.

The intended early-game grammar is: move into a good angle, identify a resistance, exploit a weakness, then choose how much recovery is safe. Late game adds party combinations, not a flood of separate subsystems.

### Gear and progression

Each character has six gear slots: Weapon, Off-hand/Focus, Head, Body, Charm I, and Charm II. Weapons define basic Strike delivery, range pattern, and a signature recovery profile; charms create focused build choices rather than replacing a character’s role.

Levels increase core stats and provide a small, predictable HP/Spirit gain. At milestone levels, each party member chooses one of three **Vows**—a compact role board with 8–10 nodes total. Nodes improve an existing command, alter recovery by one pulse, or add a conditional combo. No randomized gear, gacha, durability, or opaque proc stacking.

## Field movement and exploration

The field game is top-down 8-direction movement at a fixed 60 FPS simulation. The player character uses a 12 × 10 logical-pixel foot collision box, stable wall sliding, coyote-free ledge rules, and camera easing that never pulls against movement. Interactions occur at a short, clearly shown radius; ladders, doors, and hazards use explicit snap points.

“Technically precise” here means a player can reproduce a route and understand collision, not that the game asks for frame-perfect inputs. There is no jumping. Narrow planks, collapsing floor panels, swinging temple beams, and rolling carts may require measured walking and observation, with checkpoints before any potentially punitive sequence.

Exploration is broad but not ability-gated. Later party skills reveal optional supplies, lore, or shortcuts in old locations; the main route is never blocked because the player lacks a double jump, morph form, or similarly Metroidvania-style traversal power.

## Pixel-art art direction

### Image language

* **Resolution:** 320 × 180 logical pixels; 16 × 16 terrain modules; 32 × 48 overworld characters; 48 × 64 combat characters; 64–128 px bosses.
* **Palette:** near-black indigo shadows; rain blue and cedar brown for everyday Japan; oxidized gold and vermilion for authority; sickly violet and black-red only for vampire influence; pale parchment and morning teal for resistance and hope.
* **Lighting:** manually painted clusters, not blur filters. Candle glow uses 3–4 stepped values; rain is sparse, directional single-pixel streaks; metallic surfaces receive one hard highlight.
* **Composition:** every battle stage has a legible combat floor, a midground story object, and one high-contrast focal shape. UI must never obscure a target zone.
* **Animation:** idle 4–6 frames, walk 6–8, attack 6–10, hit 3–4. Each attack clearly communicates wind-up, active hit, and recovery through silhouette change. Avoid smear-heavy animation that hides the timing contract.

Reference mood is late-sixteenth/early-seventeenth-century architecture, garments, trade goods, lacquer, paper, bells, and coastal weather—not copied sprites, character silhouettes, or specific scenes from another game. Character concept art must be approved as a black-and-white silhouette before color production.

### Initial art package

The first art package should prove the whole visual thesis with one playable shrine complex:

* Rain gate, cedar path, abandoned chapel interior, bell stair, and flooded undercroft tiles.
* Ren, Aya, Nikola, and Mateus full combat/field sprites.
* Cinder Hound, Ash Wisp, Bell Moth, Tithe Enforcer, and Mateus boss forms.
* Cut, Pierce, Crush, Ember, Frost, Storm, Radiance, and Umbral hit/readability effects.
* A Ledger panel and Tempo/Recovery UI in the final palette.

## Principal characters

### Ren Ishikawa — the courier who refuses the script

Ren, 20, carried dispatches between mountain villages because he could read weather, roads, and people. After a shogunal search party destroys the peace of his home, he pursues not revenge alone but proof of who ordered it. He mistrusts both elites and grand beliefs that demand ordinary people pay the cost. His arc is learning that neutrality is also a choice, while refusing to become the court’s mirror image.

### Aya Shinohara — the keeper of names

Aya, 26, is a shrine archivist whose family records births, land promises, floods, and local prayers. She joins when the court begins replacing those records with its own ledger of loyalty. Her rites come from attentive stewardship, not “exotic magic.” Aya leads the party’s investigation and repeatedly challenges the assumption that foreign and domestic traditions are clean, opposing sides.

### Lord Nikola Dražanić — the title carried too far

Nikola, born around 1590, is the younger son of a fictional minor Croatian frontier house from the Senj–Brinje hinterland, but the house claims Wallachian origins. Its own suspect genealogy says that an ancestor rode in Vlad III Drăculea’s 1462 campaign against Mehmed II. In this alternate history, Vlad used vampirism as an emergency weapon against Ottoman conquest, survived the war, and then refused to surrender the power that had made him indispensable. Orthodox confessors, border soldiers, and ward-smiths created the fictional **Covenant of the Severed Dragon** to separate a blood ruler from the offices, armies, and objects bound to him. A defeated branch carried that consecrated wardcraft west and eventually took the South Slavic name Dražanić. The covenant is invented fantasy, not a claim about a real church rite, Vlad III, or the historical Order of the Dragon.

The settlement imposed after the Uskok conflict displaced Nikola from the martial future he considered his birthright. Abroad he styles himself “Count Dražanić,” an inflated title that survives mainly because distant merchants find it convenient not to challenge an armed passenger. He is brave, technically accomplished, class-entitled, honor-obsessed, and paternalistic. He distrusts merchants while depending on their ships, letters of credit, and rumor networks at every stage of his journey.

He travels Ragusa–Lisbon–Goa–Melaka–Macao–Nagasaki while pursuing a Dražanić ledger and the predatory immortals named within it. Nikola speaks native Chakavian/Croatian, Italian/Venetian, Latin, and rough Portuguese, but almost no Japanese. He therefore cannot interpret Japanese motives or negotiate local authority into irrelevance; Aya, Sayo, Ren, and other local actors must mediate what he sees and decide whether his skills are useful. The wrecked house ledger reveals that his forebears converted the Severed Dragon’s protective wardcraft into a hereditary license to purge, then sold confiscated books, escort access, and vampire-hunting knowledge through the same mercantile system he despises. His arc is not the purification of a bloodline. It is the harder surrender of assumed command: recovering the covenant’s original function as a check on permanent emergency rule and placing courage and exact violence under earned, revocable discipline.

### Father Mateus Avelar — the apostate at the bell

Mateus, 43 in appearance, is a Portuguese-born former Jesuit priest turned vampire. He reached Japan through Goa and Macao before the 1614 nationwide ban, remained as a clandestine missionary after the expulsion order, and later sold the routes and language entrusted to him when he accepted the shogun’s blood. He became an interpreter and collector who persuades frightened communities to submit. His sophistication and survival are not signs of moral depth; he has rationalized cowardice as pragmatism. Meeting Nikola confronts him with a fellow European who can read his Latin evasions, recognizes the ports and brokers behind his betrayal, and carries the Severed Dragon counter-rite Mateus believed extinct. Their abrasive, darkly comic partnership works because each man attacks the other’s favorite lie: Mateus punctures Nikola’s borrowed grandeur; Nikola refuses to let Mateus rename surrender as prudence. Their combat concord becomes the ethical image of their relationship: Mateus supplies blood-authorized access while Nikola’s Radiance prevents that access from becoming command. Mateus changes course through costly actions—protecting victims, exposing the court, and surrendering power—not because Nikola forgives him.

Mateus has no visual, vocal, biographical, or behavioral relationship to a real actor or any existing film’s priest character.

### Genta Mononobe — the retainer without a lord

Genta, 34, was a professional retainer ordered to secure villages during the ban. He discovers his orders are feeding prisoners to the court’s undead engine and defects, carrying guilt without asking his victims to heal it for him. He supplies the party’s practical military knowledge and tests whether justice can include accountability.

### Kiku Nawa — the village physician

Kiku, 31, is a healer and herbalist who has kept people alive under taxes, raids, disease, and religious suspicion. She protects a hidden network of households with different reasons to resist the court. Kiku refuses to let the group turn suffering into romantic legend. Her remedies and elemental mixtures make the party resilient, while her moral clarity keeps the story local and concrete.

## Antagonists and factions

### Shogun Kurozane, the Black Chrysanthemum

Kurozane is an invented vampire who occupies the shogunal office in this alternate timeline. His black chrysanthemum is a deliberate theft and defacement of imperial symbolism, not an authentic shogunal crest; Japanese characters understand the emblem and his use of “Court” as an illegitimate claim to authority. He claims that taking the blood ended civil war and protected Japan from foreign conquest, then treats the emergency as permission to rule forever. Mateus supplied him with a translated account of the Dracul precedent, but Kurozane’s black-bell state, mythology, appearance, castle, and powers remain original Japanese alternate-history inventions rather than a transplanted Dracula plot. His “unity” is a blood system: denunciations are recorded in black bells, fear becomes supernatural fuel, and the court manufactures enemies it can consume.

### The Black Chrysanthemum Court

“Court” is Kurozane’s invented name for his usurping bakufu apparatus, not the Imperial Court in Kyoto. Human magistrates, corrupt retainers, informants, and undead officers profit from Kurozane’s order. Magistrate Ujiro Arata is the main human antagonist: brilliant, venal, and responsible for individual choices. The story never suggests all officials, samurai, or Japanese people share his corruption.

### Ashen Oni

The Ashen Oni are fabricated bell-forged soldiers with mask-like faces and furnace ash inside. “Oni” is a frightened, contested in-world label applied to them, and the designs are a deliberate fictional synthesis rather than a claim that Japanese oni have one canonical appearance or moral meaning. Their existence is evidence that the court has turned local fear into weapons; production must not reproduce a specific ceremonial mask, sacred figure, or identifiable local tradition.

### The Lantern Network

Farmers, artisans, displaced families, local officials, clergy, and sailors form a loose mutual-aid network. Named Japanese organizers retain their own authority: Sayo of Sodegaura, a fictional Kirishitan lay catechist and printer, conceals prayer sheets, assigns witness routes, and separates testimony from household movement. Members differ in faith, class, and goal. They are not a single “good religion” faction; they are people choosing to protect one another.

## Key locations

1. **Hoshigawa and Sodegaura Port:** Ren’s cedar-river home and the rain-lashed harbor where trade, rumor, and state inspection meet.
2. **Takamine Bell Temple:** A fictional mountain complex converted into a prison and Kurozane’s experimental local bell registry. It is an alternate-history precursor, not the later nationwide temple-certification system; its buried bell is the first visible piece of the court’s machine.
3. **Nagi Sea Road:** Fishing villages, fog islands, a wrecked foreign carrack, and the Lantern Network’s secret routes.
4. **Kagura Pass and the Ash Fields:** Volcanic ridges, abandoned relay stations, and Oni forges that reveal the human cost of “order.”
5. **Kurohana Castle:** A sprawling black-lacquer fortress above Edo Bay, part administrative capital and part living vampire organ. It is the final dungeon, not an interconnected world map.

## Highest-level plot beats

In alternate Genna 8 (1622), Black Chrysanthemum inspectors destroy a rural meeting and seize a fragment of a forbidden bell. Courier Ren Ishikawa survives and joins archivist Aya to trace the fragment to Takamine Bell Temple. There they meet Lord Nikola Dražanić, a displaced Croatian frontier noble pursuing his house ledger and the same bell network, and confront Father Mateus Avelar, the apostate vampire priest who serves the court.

Mateus recognizes the Dražanić household marks and the mercantile route behind them, then begins to betray Kurozane. The group learns the shogun’s persecution apparatus is also a supernatural machine: every forced denunciation feeds a network of black bells that turns the disappeared into Ashen Oni. The party crosses the coast, mountain routes, and forge fields to gather proof, allies, and the three bell keys needed to break the network.

At the midpoint, they discover Kurozane engineered the policy’s worst terror to make himself indispensable; the conflict is neither an ancient cultural curse nor solely a foreign intrusion, but a power structure built by named people making choices. In the final chapters, the party dismantles its human officers, turns the Lantern Network from survival into collective resistance, enters Kurohana Castle, and faces Kurozane. The boss fight breaks the bells and defeats his vampire body without deciding the polity’s future by damage alone. If the accumulated route has built enough consent, evidence, and accountable restraint, Nikola and Mateus use the Severed Dragon pattern to hold Kurozane vulnerable while Ren demands a witnessed return of the military, registry, and bell seals; Kurozane relinquishes power without receiving absolution. If the party executes him or cannot secure that transfer, the blood-bound offices rupture at once and rival governors begin a civil war. The outcome deliberately echoes, without reproducing, the later historical possibility of a shogun returning governing authority instead of making his own death the only transition.

## Narrative and production guardrails

* Do not use real victims, named historical officials, or actual sacred objects as boss fodder.
* Consult a Japanese cultural historian and sensitivity reader before locking dialogue, costumes, faith practices, and regional details.
* Treat the current historical and cultural audit as provisional until that external consultant review is complete.
* Depict conversion, apostasy, and resistance as personal and political pressures with varied voices; no group is inherently pure, gullible, or evil.
* Never use celebrity likenesses, actor references, or scene-for-scene adaptations.
* **FP-0 Combat Proof** is a narrow 5–10 minute, one-combat technical build. It validates exact board movement, Tempo/Pace/Recovery, Guard/Dodge, and the damage Ledger with Ren, Nikola named in the prelude, and an Ashen Oni Tithe Enforcer. It is deliberately not the template’s full first playable.
* **FP-1 Takamine Vertical Slice** is the 28–34 minute first-playable target defined in the detailed outline. It adds the rain-gate approach, field movement, three-party teaching encounters, Nikola’s arrival, and the Mateus boss. It begins only after FP-0’s combat contract passes testing.
* FP-1 does not include the full world map, shopping, crafting, or every later-game system.

## Sources

Historical context was checked against the following references; the game deliberately fictionalizes its people, events, and supernatural history.

* [Jesuits Japan, “About Us”](https://www.jesuits-japan.org/blank?lang=en) — Francis Xavier’s 1549 arrival and the Japanese Jesuit historical context.
* [Japan Agency for Cultural Affairs, Hidden Christian Sites nomination material](https://www.bunka.go.jp/seisaku/bunkazai/shokai/sekai_isan/ichiran/pdf/suisensho_02.pdf) — chronology including the 1587 expulsion edict, 1603 shogunate, and 1614 nationwide ban.
* [UNESCO, Supplementary Material on Hidden Christian Sites](https://whc.unesco.org/document/160507) — context for the severe early-seventeenth-century persecution and survival of hidden communities.
