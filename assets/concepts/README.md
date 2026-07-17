# Bells of the Black Chrysanthemum - Concept Assets

These two files are project-bound **visual direction concepts**, generated with the built-in image-generation workflow on 2026-07-16 and inspected before acceptance. They establish original mood, composition, and readability targets only. They are not shippable sprite, tileset, font, UI, character, or texture source files; final assets require editable, project-authored production art and the review gates in [docs/05-art-direction.md](../../docs/05-art-direction.md).

| Filename | Purpose | Acceptance note |
| --- | --- | --- |
| `bells-world-story-target-v1.png` | One-true world/story screenshot target | Accepted for rain-dark Gothic Japan, human-scale route, and fortress pressure. Final maps must use the 320 x 180 grid and no generated text. |
| `bells-battle-target-v1.png` | One-true battle screenshot target | Accepted for spatial board, selection route, turn rail, recovery locks, and element shapes. Final UI must follow the 12 x 7 technical contract and use editable icons/text. |

## Exact prompt: `bells-world-story-target-v1.png`

```text
Use case: historical-scene
Asset type: internal one-true world/story screenshot target for the original turn-based JRPG “Bells of the Black Chrysanthemum.”
Primary request: Create a polished, original 16-bit pixel-art JRPG field-scene screenshot target at a clean 4:3 presentation. It is late-sixteenth/early-seventeenth-century alternate Japan: a mountain village under Christian persecution, Gothic fantasy rather than a literal historical recreation. Show an original young European vampire-hunter descendant in a weather-worn dark traveler’s coat and a concealed Japanese shrine keeper crossing a rain-slick cedar bridge toward a hidden chapel; a distant black chrysanthemum crest flies from a castle gate above the village. No recognizable real person, no celebrity likeness.
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
Subject: an original four-person cast implied by three visible allied combatants: a European-descended hunter in dark blue coat and long spear, a Japanese shrine keeper with ofuda and short blade, a stern ex-soldier with matchlock, versus a horned oni court commander in lacquered armor and two masked ash soldiers. No recognizable real person, no celebrity likeness.
Style/medium: hand-authored 16-bit console-era pixel art, 320x180-inspired screenshot enlarged sharply; chunky controlled pixel clusters, limited anti-aliasing, readable character silhouettes at tactical scale, rich parallax backdrop, no painterly gradients, no 3D render.
Composition/framing: allies grouped on the left/lower-left, enemies on the right/upper-right, all action readable around the center grid; dark ornamental UI panels along top and bottom without any readable words.
Lighting/mood: cold indigo moon shafts, candle ivory, vermilion fire accents, theatrical doom, high contrast but readable.
Color palette: ink navy, blue-black, lacquer red, candle ivory, rain-stone gray, oxidized green, limited violet curse highlights; reserve bright color only for element and selection feedback.
Materials/textures: wet black stone, tarnished gold, paper seals, lacquer armor, ash, stained glass.
Constraints: make it look like an original game screenshot concept rather than a copy of any named game; clearly turn-based rather than real-time; no logos, no letters, no readable text, no watermark, no gore, no existing characters or franchise visual imitation.
```

## Generation method and limitation

**Method:** built-in image generation (not a CLI/API fallback). The original generated files remain in the Codex image directory; selected copies are stored here for the project.

**Limitation:** generated concept art can communicate a target image but cannot serve as final production art authority. It may use a larger render than the shipping logical resolution and does not provide editable sprite frames, tiles, animation timing, collision, localization-safe UI, or period/sensitivity validation. Treat it as a concise art brief and rebuild all final assets from original editable production sources.
