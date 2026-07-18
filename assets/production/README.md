# Bells of the Black Chrysanthemum - Production References

These original, project-bound PNG files were generated with the built-in image-generation workflow. The three 2026-07-16 images are opaque production references. The 2026-07-18 party and enemy atlases are provisional transparent runtime assets used by Camp, field movement, scene focus, and battle tokens while hand-authored frame cleanup remains open.

Use [the animation bible](../../docs/10-animation-bible.md) and [the art-direction contract](../../docs/05-art-direction.md) to rebuild all game art as editable, authored assets. Do not cut pixels, text, or UI out of these images.

| Filename | Dimensions | SHA-256 | Purpose | Acceptance result |
| --- | ---: | --- | --- | --- |
| `bells-party-roster-v1.png` | 1448 x 1086 | `f6b28f192a35f19bbc60efd366cf88af10b0b79c2f2b4aa788d59ec749fe95c5` | Six-party silhouette, palette, and costume-layering reference | Accepted: Ren, Aya, Lise, Mateus, Genta, and Kiku read as distinct roles before facial detail; no text or real-person likeness. |
| `bells-enemy-bosses-v1.png` | 1448 x 1086 | `5b02d5144c4c5ec1e6557df672848ce8d8037103485af01b3bebc67f6f1b17df` | Enemy hierarchy and boss-scale silhouette reference | Accepted: Cinder Hound, Ash Wisp, Bell Moth, Tithe Enforcer, Tithe Enforcer Ascendant, and Takamine Bell Warden stay distinct with clean size escalation; no text or gore. |
| `bells-takamine-keyframe-v1.png` | 1448 x 1086 | `17aea41ebe154d79fcdd509c2951a6a5a3b0273d7c4fe569c5e40561d6be16ac` | FP-1 Takamine Rain Gate environment/keyframe reference | Accepted: gate, wet approach, service-route read, warm lantern destination, and cold court pressure are legible; no text. |
| `bells-party-field-atlas-v1.png` | 1536 x 1024 | `df3600769c333788126c50390fa36e3ccc4d1436578c2bf8503749617ec0c4b3` | Six-row, eight-column party field/camp atlas | Accepted provisionally: six original party silhouettes, directional pose variation, transparent background, no text or real-person likeness; wired into Camp, field, scene-focus, and party battle rendering. |
| `bells-enemy-combat-atlas-v1.png` | 896 x 1792 | `37c8efac4ded9223b3580a5d89bee65af71310fa7ed79348c260cfc995449805` | Eight-row, four-column enemy-family combat atlas | Accepted provisionally: 32 populated neutral/wind-up/attack/stagger cells, transparent corners, original silhouettes, no text or real-person likeness; wired into enemy battle rendering by family. |

## Generation method

- **Method:** built-in image generation, not CLI/API fallback.
- **Output type:** the original references are opaque PNGs. The party atlas was generated against a flat chroma field, converted locally to RGBA, and visually checked after transparency extraction.
- **Enemy-atlas processing:** generated against flat chroma magenta, converted locally to RGBA with the installed image-generation chroma helper, then nearest-neighbor normalized to exact 224 x 224 cells and visually checked after extraction.
- **Review:** each generated image was visually inspected for original character design, no readable text, no logos/watermarks, no celebrity likeness, no direct franchise imitation, and consistency with the project's historical/sensitivity constraints before it was copied here.
- **Source copies:** the original generated files remain in the Codex generated-image directory. These stable filenames are the project copies to reference in production planning.

## Exact prompt: `bells-party-roster-v1.png`

```text
Use case: stylized-concept
Asset type: internal character art production-reference key-art roster for the original pixel-art JRPG "Bells of the Black Chrysanthemum."
Primary request: Create a single original six-character party roster image that serves as a production reference for silhouette, palette allocation, and costume layering. Each person must be a fully original fictional character, shown in a clear 3/4 view at consistent height with generous spacing; no copied game character designs and no real-person likenesses.
Scene/backdrop: a simple moonlit rain-indigo studio backdrop with one low wet-cedar platform and subtle paper-screen geometry, no scenery that competes with the characters.
Subject: (1) Ren Ishikawa, Japanese village courier, forward-leaning short coat, courier satchel, short spear, cedar brown and rain blue; (2) Aya Shinohara, Japanese shrine archive keeper, squared record case, layered sleeves, folded ofuda fan, parchment and muted teal; (3) Lise Varga, European-descended vampire-hunter heir, short dark hair, practical sea-weather travel coat, compact rapier-and-needle-tool profile, desaturated blue and brass; (4) Father Mateus Avelar, European court interpreter and vampire, original narrow cassock-derived coat with high collar and ring of keys, charcoal with dried-wine accent, tired controlled posture; (5) Genta Mononobe, Japanese former retainer, broad shoulder mantle, tetsubo/shield mass, earth gray and oxidized gold; (6) Kiku Nawa, Japanese village physician, short cloak, medicine box, bottle and packet shapes, herb green and candle ivory.
Style/medium: crisp original hand-authored 16-bit-era pixel-art character-key-art, deliberate pixel clusters, stepped diagonals, selected 1px highlights, 2-4 values per material, clean silhouette gaps, no blurry painting, no 3D, no smooth gradients.
Composition/framing: 4:3 landscape, full bodies in a shallow arc, all six equally readable; Ren and Aya slightly forward as early party anchors; leave clear negative space between weapons and bodies; character faces are small and simplified, not detailed portraits.
Lighting/mood: candle-ivory rim light against rain-dark indigo, somber and resolute, a restrained black-crimson court accent only on Mateus.
Color palette: ink shadow, rain indigo, cedar brown, parchment/candle ivory, muted teal, desaturated blue/brass, earth gray/oxidized gold, herb green, with rare lacquer red and black-crimson.
Materials/textures: rain-worn cloth, lacquer trim, cedar leather, paper, old bronze, compact travel gear.
Constraints: no lettering, no logo, no watermark, no UI, no readable signage, no explicit religious symbols as weapons or loot, no gore, no actor likeness, no film character, no existing franchise character, no direct visual imitation.
```

## Final prompt: `bells-party-field-atlas-v1.png`

```text
Use case: stylized-concept
Asset type: production field-sprite atlas for the original historical gothic JRPG "Bells of the Black Chrysanthemum."
Primary request: Create one clean sprite sheet for six fully original fictional party members. Arrange exactly six horizontal character rows and eight evenly spaced columns. Each row is one character; columns show readable field-animation poses in this order: north idle, north walk, east idle, east walk, south idle, south walk, west idle, west walk. Keep every figure centered in a consistent cell with no overlap.
Subjects, top to bottom: (1) Ren Ishikawa, Japanese courier with short spear, satchel, cedar-brown and rain-blue coat; (2) Aya Shinohara, Japanese archive keeper with squared record case and folded paper fan, parchment and muted teal; (3) Lise Varga, original European-descended vampire-hunter heir with compact rapier, short dark hair, sea-weather blue coat and brass; (4) Father Mateus Avelar, original European vampire interpreter in a narrow charcoal cassock-derived coat with keys and a restrained dried-wine accent, with no actor or film likeness; (5) Genta Mononobe, broad Japanese former retainer with repair maul and earth-gray/oxidized-gold layers; (6) Kiku Nawa, Japanese village physician with medicine box, herb-green cloak, and candle-ivory packets.
Style/medium: original late-16-bit-era pixel art, hard pixel clusters, stepped diagonals, limited 2-4-value materials, strong silhouettes, nearest-neighbor clarity, restrained animation changes, no painterly blur, no anti-aliased illustration, no 3D.
Composition: exact 6-by-8 contact sheet; generous gutters; consistent scale, feet line, lighting, and view angle. Use the south idle column as the cleanest camp-portrait pose. No borders, labels, numbers, text, logo, UI, or watermark.
Background: perfectly flat saturated chroma green #00ff00 across every unused pixel, with no gradient, shadow, texture, green clothing, or green reflected light, so it can be removed deterministically.
Palette/mood: ink shadow, rain indigo, cedar brown, parchment ivory, muted teal, desaturated blue, old brass, earth gray, oxidized gold, herb green shifted away from chroma green, rare lacquer red and black-crimson. Somber, practical, rain-worn, and resolute.
Constraints: historically grounded alternate early-Edo travel clothing with invented fantasy details; no direct franchise imitation; no copyrighted characters; no celebrity, Adam Driver, or film-character likeness; no gore; no readable religious text; no sacred object used as a weapon or loot; no missing character row; no extra figures.
```

## Final prompt: `bells-enemy-combat-atlas-v1.png`

```text
Use case: stylized-concept
Asset type: provisional runtime enemy animation atlas for the original historical-gothic turn-based JRPG "Bells of the Black Chrysanthemum."
Primary request: Create one exact sprite sheet of eight fully original fictional enemy families, arranged in exactly eight horizontal rows and four evenly spaced columns. Each row is one enemy family; columns show neutral combat pose, readable wind-up/telegraph pose, attack pose, and staggered/hurt pose. Keep every figure centered inside a consistent cell, with generous gutters and no overlap.
Subjects, top to bottom: (1) low Cinder Hound, a four-legged ash-and-bell-metal predator with compact muzzle and a broken bronze collar; (2) hovering Ash Wisp, a coal-dark core wrapped in angular folded-paper ash with sparse ember flecks; (3) Ashen Oni court enforcer, an entirely invented bell-forged armored soldier with abstract geometric mask, lacquer shield, ledger tabs, and broken bronze joints; (4) corrupt court retainer, human-sized rain-worn lamellar silhouette with blank document mask and hooked polearm, clearly a fictional official rather than a real historical person; (5) Widow-of-Fog, a broad spectral maritime figure made from torn sailcloth, net weights, and cold mist, mournful rather than gory; (6) Furnace Abbot, a massive invented ash-and-bell-bronze boss with sealed furnace mantle and frost-cracked joints, no real religious vestment or sacred symbol; (7) Bell Warden, a tall angular guardian carrying a suspended abstract resonance frame with three readable rings; (8) Shogun Kurozane, an original super-vampire ruler in black lacquer court armor with chrysanthemum-like geometric plates, long restrained silhouette and one black-crimson mantle, no real shogun likeness.
Style/medium: original late-16-bit-era pixel art, crisp hard pixel clusters, stepped diagonals, limited 2-4-value materials, strong silhouettes, nearest-neighbor clarity, no painterly blur, no anti-aliased illustration, no 3D.
Composition/framing: exact 8-by-4 contact sheet, consistent feet or hover baseline within each row, consistent scale except bosses may use more vertical cell height; every pose readable at small game-token scale. No borders, labels, numbers, text, logo, UI, or watermark.
Background: perfectly flat saturated chroma magenta #ff00ff across every unused pixel, with no gradient, shadow, texture, floor plane, reflection, or magenta lighting, so it can be removed deterministically. Do not use #ff00ff anywhere in any subject.
Palette/mood: ink shadow, rain indigo, ash gray, wet black lacquer, paper ivory, old bronze, cold blue, sparse ember vermilion, rare black-crimson. Somber, oppressive, theatrical, and mournful.
Constraints: historically grounded alternate early-Edo fantasy with invented supernatural details; all designs original; no direct franchise or artist imitation; no copyrighted characters; no celebrity, actor, or film-character likeness; no gore; no readable religious text; no sacred object used as weapon or loot; no real ceremonial mask; no human ethnicity coded as monstrous; exactly eight rows and four columns; no extra figures.
```

## Exact prompt: `bells-enemy-bosses-v1.png`

```text
Use case: stylized-concept
Asset type: internal enemy and boss silhouette-sheet production reference for the original pixel-art JRPG "Bells of the Black Chrysanthemum."
Primary request: Create an original, carefully organized bestiary silhouette sheet showing six distinct enemy/boss archetypes at a shared visual scale, intended to guide editable production sprites, animation, enemy hierarchy, and battle readability. This is not a final sprite atlas and must contain no labels, letters, UI, or text.
Scene/backdrop: flat deep ink-indigo presentation field with faint 8-pixel grid texture and a thin wet-stone baseline; no busy scenery.
Subject: arrange these six original designs left-to-right with clear spacing and mostly side/three-quarter combat-facing poses: (1) Cinder Hound, low four-legged ash-coated predator with rising 2-pixel ember motes, compact muzzle and broken bell-metal collar; (2) Ash Wisp, hovering coal of folded paper ash with a readable dark core and a small ground shadow, its transparency suggested only with sparse clusters; (3) Bell Moth, broad angular wings whose pattern suggests an abstract bell, clean separate shadow below; (4) Tithe Enforcer, bell-forged Ashen Oni retainer with invented geometric face mask, lacquered shield, vertical ledger tabs, broken bell-metal joints, ember core visible only in active pose; (5) Tithe Enforcer Ascendant, a 96x96 boss-scale version with massive bell-backed club and two visible breakable bell-seal reads; (6) Takamine Bell Warden, a separate boss silhouette with a vertical bronze bell frame, folded court robes, and three suspended resonance rings that clearly signal its arena mechanic.
Style/medium: original hand-authored 16-bit-era pixel-art production reference, decisive chunky pixel clusters, controlled stepped diagonals, 2-4 values per material, hard one-pixel highlights, no painted blur, no smooth gradients, no 3D render, no direct imitation of any game or artist.
Composition/framing: 4:3 landscape contact-sheet feel; small enemies occupy the lower baseline while bosses rise above it; every body and weapon needs clear negative space; designs are readable in monochrome first. Give the Ashen Oni and the two bosses the strongest vertical silhouette hierarchy. Do not draw a grid board, labels, plates, or framing boxes.
Lighting/mood: cold rain-indigo rim light, ember/vermilion active accents, oxidized bronze highlights, theatrical and mournful rather than gory.
Color palette: ink shadow, rain indigo, stone gray, ash gray, oxidized green, old bronze, limited lacquer red, rare black-crimson and vermilion only for court corruption / active cores.
Materials/textures: clumped ash, wet lacquer, corroded bell bronze, folded paper, cracked stone, matte cloth.
Constraints: invented fantasy enemies only; Ashen Oni are court-forged fiction and must not copy a real ceremonial mask or living religious figure; no gore; no skull pile; no human ethnicity coded as monstrous; no copyrighted character, logo, lettering, readable symbols, watermark, celebrity likeness, franchise visual imitation, or text.
```

## Exact prompt: `bells-takamine-keyframe-v1.png`

```text
Use case: historical-scene
Asset type: internal environment/keyframe production reference for FP-1 Takamine in the original pixel-art JRPG "Bells of the Black Chrysanthemum."
Primary request: Create an original 4:3 pixel-art field-scene keyframe for the FP-00 Rain Gate: a mountain bell temple under curfew in alternate 1622 Japan. The image must guide modular environment construction, navigation readability, rain layering, and the first playable's somber story tone; it is a reference, not a shippable map.
Scene/backdrop: five readable depth bands. Far background: misty mountain ridge and a distant black-lacquer registry tower with one small cold red vertical court accent. Mid-distance: tall black cedar gate with a closed double door, roof tiles, wet bronze hardware, and dark bell-frame geometry. Play space: a broad rain-slick stone approach with clearly walkable bands and a separate right-side cedar service path that curves behind the gate. Human detail: a supply cart with blank paper bundles, a rain basin, paper lanterns glowing behind wooden lattice, and maintained eaves. Foreground witness: a few dark cedar boughs and rain chains framing edges without blocking the route.
Subject: Ren Ishikawa and Aya Shinohara are small field-scale figures in lower center: Ren with courier satchel and short spear, Aya with squared archive case and folded paper fan. They face the closed gate and service path, communicating cooperation and caution. No other character is required.
Style/medium: original hand-authored 16-bit-era pixel art enlarged with sharp nearest-neighbor character, deliberate 1px/2px clusters, stepped diagonals, 2-4 value materials, sparse directional rain streaks, no blur, no smooth gradients, no 3D render, no visual imitation of any specific game or artist.
Composition/framing: 4:3 landscape, camera at a readable three-quarter top-down field-game angle; gate and locked door form the high-contrast focal shape at upper center, lower third remains calm enough for future dialogue UI, main walkable route visibly runs from the lower center toward the right-side service path. Do not draw interface panels or grid overlays.
Lighting/mood: monsoon dusk with rain falling left-to-right; lantern amber and candle ivory identify a human-scale point of care, cold indigo shadows establish threat; solemn, intimate, theatrical.
Color palette: ink black and indigo shadow, rain blue, wet stone gray, cedar brown, paper/candle ivory, oxidized bronze, a very limited lacquer red / black-crimson court accent, muted teal only near Aya.
Materials/textures: wet cedar grain, mottled stone, roof tile, bronze bell hardware, paper, water in broken reflecting bands.
Constraints: no text, no logo, no watermark, no readable signage, no historical crest, no real sacred object used as loot or a monster prop, no gore, no celebrity or actor likeness, no existing franchise characters, and no direct franchise visual imitation.
```

## Limitation

Generated art does not supply editable frame layers, collision, tile boundaries, palette-index source, localization-safe UI, cultural review, or a final 320 x 180 production pass. Treat the atlas as provisional runtime art and rebuild/clean it through the animation production gate.
