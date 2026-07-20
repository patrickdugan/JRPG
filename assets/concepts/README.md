# Bells of the Black Chrysanthemum - Concept Assets

These three files are project-bound **visual direction concepts**, generated with the built-in image-generation workflow on 2026-07-16 and 2026-07-20 and inspected before acceptance. They establish original mood, composition, and readability targets only. They are not shippable sprite, tileset, font, UI, character, or texture source files; final assets require editable, project-authored production art and the review gates in [docs/05-art-direction.md](../../docs/05-art-direction.md).

| Filename | Purpose | Acceptance note |
| --- | --- | --- |
| `bells-world-story-target-v1.png` | One-true world/story screenshot target | Accepted for rain-dark Gothic Japan, human-scale route, and fortress pressure. Final maps must use the 320 x 180 grid and no generated text. |
| `bells-battle-target-v1.png` | One-true battle screenshot target | Accepted for spatial board, selection route, turn rail, recovery locks, and element shapes. Final UI must follow the 12 x 7 technical contract and use editable icons/text. |
| `bells-takamine-registry-court-target-v1.png` | Takamine registry-court environment keyframe | Accepted only as a rain, value, material, and fortress-pressure keyframe. The quiet central arena and peripheral administrative clutter are useful direction; the pavilion-mounted cylindrical machine, repeated banner marks, paving geometry, props, reflections, and all generated pixels are rejected as production authority. Rebuild to the exact 12 x 7 brief with a buried fictional registry resonator and external cultural review. 1672 x 941 RGB; SHA-256 `2D51323C4B377501D57E4A4CC5D94E6244EC40EF126CA7D068E2F272A608213E`. |

## Exact prompt: `bells-world-story-target-v1.png`

```text
Use case: historical-scene
Asset type: internal one-true world/story screenshot target for the original turn-based JRPG “Bells of the Black Chrysanthemum.”
Primary request: Create a polished, original 16-bit pixel-art JRPG field-scene screenshot target at a clean 4:3 presentation. It is early-seventeenth-century alternate Genna 8 (1622) Japan: a mountain village under Christian persecution, Gothic fantasy rather than a literal historical recreation. Show an original young European vampire-hunter descendant in a weather-worn dark traveler’s coat and a concealed Japanese shrine archive keeper crossing a rain-slick cedar bridge toward a hidden chapel; a distant black chrysanthemum crest flies from a castle gate above the village as Kurozane’s deliberate theft and defacement of imperial imagery, never as an authentic shogunal crest. No recognizable real person, no celebrity likeness.
Scene/backdrop: tiered Japanese mountain village, tiled roofs and paper lanterns, cedar forest, narrow canal, weathered chapel cross subtly integrated into the setting, fortress silhouette on ridge, misty monsoon dusk.
Style/medium: hand-authored 16-bit console-era pixel art; deliberate pixel clusters, 1px/2px edge control, readable 3/4 top-down field perspective, strong silhouettes, no smooth digital painting, no photorealism, no 3D render.
Composition/framing: game camera isometric-ish 3/4 top-down, 320x180-inspired scene enlarged sharply; lead pair in lower center, bridge forms a diagonal to the chapel, layered background with a readable route forward; reserve a subtle lower-third calm zone suitable for eventual dialogue UI but do not draw a dialogue box.
Lighting/mood: rain afterglow, lantern-gold against indigo-blue dusk, solemn, devotional, ominous, theatrical.
Color palette: constrained 16-bit palette: ink navy, blue-black, desaturated cedar green, wet stone gray, lacquer red accents, paper-lantern amber, pale candle ivory, rare black-crimson supernatural accent.
Materials/textures: wet cedar boards, fired roof tile, plaster walls, glimmering water, fog, rain streaks rendered as pixel clusters.
Constraints: story-forward original game image; show no UI, no menu, no written letters, no readable signage, no text, no logo, no watermark, no existing game characters, no franchise visual imitation, no gore.
```

## Exact prompt: `bells-battle-target-v1.png`

```text
Use case: stylized-concept
Asset type: internal one-true battle screenshot target for the original turn-based JRPG “Bells of the Black Chrysanthemum.”
Primary request: Create a polished original 16-bit pixel-art battle screen at a clean 4:3 presentation. Three heroes face an aristocratic oni retainer and two masked ash soldiers inside a moonlit Japanese-Gothic castle chapel. The battle visibly communicates a turn-based tactical system with precise movement and recovery-limited attacks: the floor is a compact 3-by-6 runestone grid with a bright selected movement path, each combatant stands on a clear cell, a slim initiative rail of portrait medallions spans the top, and a recovery ledger at bottom shows three distinct action icons with cooling crescent timers. Elemental information must be visual, not written: fire = vermilion flame seal, frost = pale blue snowflake seal, holy = candle-ivory sunburst seal, curse = black-crimson thorn seal. The chosen hero is preparing a spear thrust; a translucent afterimage and a small locked recovery meter make the action-readiness state legible.
Scene/backdrop: vaulted chapel fused with Japanese castle architecture, shoji tracery, warped stone floor, black chrysanthemum stained-glass moonlight, towering altar, drifting ash, crimson banners.
Subject: an original four-person cast implied by three visible allied combatants: a European-descended hunter in dark blue coat and long spear, a Japanese shrine archive keeper with fictional record-seal slips and short blade, a stern ex-soldier with matchlock, versus a horned Ashen Oni court commander in lacquered armor and two masked ash soldiers. The Ashen Oni are a deliberate fictional synthesis under a contested in-world label; do not copy a specific sacred figure, ceremonial mask, or identifiable local tradition. No recognizable real person, no celebrity likeness.
Style/medium: hand-authored 16-bit console-era pixel art, 320x180-inspired screenshot enlarged sharply; chunky controlled pixel clusters, limited anti-aliasing, readable character silhouettes at tactical scale, rich parallax backdrop, no painterly gradients, no 3D render.
Composition/framing: allies grouped on the left/lower-left, enemies on the right/upper-right, all action readable around the center grid; dark ornamental UI panels along top and bottom without any readable words.
Lighting/mood: cold indigo moon shafts, candle ivory, vermilion fire accents, theatrical doom, high contrast but readable.
Color palette: ink navy, blue-black, lacquer red, candle ivory, rain-stone gray, oxidized green, limited violet curse highlights; reserve bright color only for element and selection feedback.
Materials/textures: wet black stone, tarnished gold, paper seals, lacquer armor, ash, stained glass.
Constraints: make it look like an original game screenshot concept rather than a copy of any named game; clearly turn-based rather than real-time; no logos, no letters, no readable text, no watermark, no gore, no existing characters or franchise visual imitation.
```

## Exact generation prompt: `bells-takamine-registry-court-target-v1.png`

```text
Create a brand-new original wide pixel-art environment asset for a turn-based JRPG battle backdrop. Scene: the rain-soaked fortified administrative bell court on Mount Takamine in an alternate Genna 8 / 1622 Japan. Empty stage with no characters. Three-quarter top-down oblique view, composed so a clear 12-by-7 tactical combat grid could be overlaid across the central wet-stone and packed-earth floor without visual ambiguity. Architecture should read as a severe early-Edo timber-and-plaster administrative compound: dark cedar galleries, stone footings, storm drains, a large bronze registry bell under a tiled roof, rope mechanisms, record chests, guarded gate, distant mountain walls. Show the regime's illegitimate fictional blackened-chrysanthemum emblem only as small damaged banners; do not imitate an authentic imperial crest or any real clan mon. Supernatural vampire atmosphere should be subtle and environmental: one impossible bell shadow, rain briefly bending upward near a sealed doorway, faint dark-red reflected lantern light, no gore and no victims. Avoid European church architecture, crosses, shrine talismans, Buddhist devotional objects, sacred masks, and generic fantasy castle towers. Palette: indigo night rain, charcoal cedar, cold wet stone, muted iron, restrained tarnished gold and oxblood accents. Crisp hand-clustered 16-bit-era pixel-art language, strong material readability, controlled dithering, hard pixel edges, no blur, no painterly brushwork, no anti-aliased vector look. Wide 16:9 composition, foreground/midground/background depth, central play area uncluttered, darker outer edges for UI contrast. No characters, no interface, no grid lines, no text, no letters, no logo, no watermark. Deliver as a polished game-ready background concept, not a screenshot of an existing game.
```

The initial image failed the cultural/heraldic concept gate because its clean radial banner mark resembled legitimate floral heraldry and its centerpiece resembled a decorated Japanese temple bell. The selected file is the non-destructive corrected sibling produced with this exact edit prompt:

```text
Use case: precise-object-edit
Asset type: concept-only environment keyframe for an original historical-fantasy JRPG
Input image: Image 1 is the edit target.
Primary request: Change only the potentially borrowed heraldic and sacred-object details. Preserve the entire wide composition, camera, architecture, empty central court, wet materials, rain, lighting, palette, pixel-art treatment, and all object placement unless a change is explicitly required below.
Edit 1 — invented regime mark: Replace every radial black flower emblem on all cloth banners and tower/door panels with one consistent visibly vandalized, non-heraldic registry mark. The new mark is asymmetrical broken ledger-tab geometry: three offset vertical rectangular black-lacquer strokes, crossed by one jagged diagonal fracture, with the lower segment missing and rough overpaint visible. It must have no petals, no radial symmetry, no surrounding circle, no chrysanthemum construction, no hollyhock construction, and no resemblance to an authentic Japanese mon. Keep the banners torn and weathered.
Edit 2 — fictional registry machinery: Replace the recognizable Japanese temple-bell-like bronze bell, stud fields, decorative bands, medallion relief, rope, and wooden striker with an unmistakably invented secular registry resonator in the same general footprint. The resonator is a faceted cast-metal administrative command machine with plain vertical ribs, hinged blank ledger plates, iron braces, black-lacquer conduits descending into the floor, and court-added mechanical clamps. No lotus details, dharma-wheel forms, inscriptions, devotional ornament, sacred motifs, traditional bell stud field, or temple striker. The surrounding roofed structure may remain as an administrative machinery shelter, but not a devotional bell pavilion.
Constraints: No people, no victims, no text, no letters, no readable signage, no crosses, no shrine talismans, no Buddhist ritual objects, no ceremonial masks, no logos, no watermark. Do not add new focal props. Keep the central floor free of clutter. This remains a mood reference, not a finished tactical grid.
```

## Generation method and limitation

**Method:** built-in image generation (not a CLI/API fallback). The original generated files remain in the Codex image directory; selected copies are stored here for the project.

**Limitation:** generated concept art can communicate a target image but cannot serve as final production art authority. It may use a larger render than the shipping logical resolution and does not provide editable sprite frames, tiles, animation timing, collision, localization-safe UI, or period/sensitivity validation. Treat it as a concise art brief and rebuild all final assets from original editable production sources. The Takamine keyframe is governed by [the exact battle-environment production brief](../../docs/21-takamine-battle-environment-brief.md).
