# July 2026 Illustration Recovery and Art Direction

## Recovery finding

The high-resolution, original July character images remain in the GitHub repository. They were committed in July 2026, before the August C-drive dump. The archive is preserved under assets/art/concepts and assets/concepts. They are **original PNG illustrations** and reference boards; the repository records no editable character Illustrator/SVG source for these images. "Occidental vector-style illustration" describes the intended visual language, not the encoding of the recovered originals.

Visual inspection of the recovered boards matters: Nikola's July v2 original is already pixel-styled. Mateus's v2 concept and Kurozane's v3 concept use textured painterly shading. The July world target was explicitly briefed as pixel art. None of these four images, by itself, establishes the distinct Occidental vector-style originals described by the user. The specific earlier vector-art files have not been identified in the current repository scan. Character identities and costume designs can still be preserved as historical evidence. The live gameplay sprites, effects and maps remain their own production layer. The original art and that later pixel-derived art should be evaluated side by side before selecting new portraits or key art. Git blob identity proves image preservation, while a human visual review must decide artistic acceptance.

## Sources recovered and linked for review

| Reference | Original Git path | Original Git blob | July history |
| --- | --- | --- | --- |
| Nikola Dražanić / Lance of Longinus v2 | assets/art/concepts/dravanic-lance-of-longinus-concept-v2.png | 840e856e010e0eda5989f90ca8b3e195bd947399 | 7d7ca2d, July 23 |
| Father Mateus / Vampire Priest v2 | assets/art/concepts/vampire-priest-concept-v2.png | 2a753993b4bf64b477c47c574484cc7fd1d220fd | 7d7ca2d, July 23 |
| Kurozane three-state concept v3 | assets/art/concepts/kurozane-three-state-demon-mode-concept-v3.png | 571c39e645e50927a1316d46570fed6db412add7 | 217e50c, July 23 |
| Original world/story target v1 | assets/concepts/bells-world-story-target-v1.png | 030ed5f6ed09a5d155f545c9f6fd7bb8bb1d1583 | 5030f5d, July 17 |

The runtime review at game/illustration-review.html loads unchanged Git blobs under game/assets/art/july-illustrations-v1, aliased using their exact Git object IDs. Node tests check source and served images against the known Git hashes, along with exact binary equality. The originals have not been re-encoded, pixelified, repainted, or renamed in their authoritative source paths.

Comparisons in the archive reference a Nikola pixelification, a complete later party-portrait atlas, a Kurozane final-battle animation contact sheet and the later scene-backdrop contact sheet. Those later sheets have different geometry and intent, and only Nikola is a direct pixelification comparison.

## Current illustration direction for future work

Use these July character concepts as identity and costume evidence when pursuing the user-requested **Occidental Gothic vector-style illustration language**, with restrained flat areas of ink, clean contour geometry, economical internal lines, readable garment construction, and theatrical light. Apply that graphic method to characters across the Japanese and European cast with their own documented history, anatomy, clothing and identities intact.

For Nikola, preserve the Croatian frontier-hunter silhouette, dark oxblood doublet, rain cloak, and long-weapon posture. For Mateus, preserve the weary priest's economy of gesture and cassock-derived layering. Kurozane must retain the original Japanese facial identity across unarmored, Oni-armored and demon modes, supported by early-Edo material and armor references. Japanese characters retain Japanese identity regardless of whether their artwork uses a Western graphic method.

The specific house-style mistake to prevent is generic anime facial shorthand and automatic pixelification replacing the original high-resolution identity studies. Pixel sprites may still serve the running game, especially where animation and collision contracts already have 1,458 reported local game tests. New narrative portraits, title illustration, key art and marketing art should receive separate Occidental illustration approval rather than inheriting the portrait suite's documented "elegant anime realism" directive.

The July 17 world target was itself explicitly generated from a pixel-art brief. It remains composition, setting and palette evidence, not proof that the later Occidental character direction was already applied to every scene.

## Production control

1. Examine each original and later derivative at native resolution in game/illustration-review.html. Mark Use as primary reference or Needs revision and record exact likeness/style issues. Export the review JSON for the artist or renderer.
2. Use source images at their original high resolution for the next portrait and title mockups. Make any editable vector reconstruction an independently versioned SVG source, keeping original PNGs unchanged.
3. For a new illustration candidate, record the original Git blob, the working editable source, the render settings, the output and a visual acceptance decision. Face consistency and period costume correctness take priority over automated image matching.
4. Implement a candidate first behind a separate review mode, then run the exact existing game suite and rendered browser playthrough before replacing any canonical runtime asset.

The developer tool writes a dedicated local browser key, bells-black-chrysanthemum.illustration-review.v1. These editorial annotations stay separate from campaign saves and battle/release receipts. The hosted browser smoke checks image delivery, language-independent editorial state, JSON import/export, stale-source rejection, and console/HTTP errors.

## Scope note

This pass adds a **source archive and visual review gate**, linked from the developer title screen, and makes the intended future illustrated treatment explicit. It does not claim that existing pixel runtime art has been converted, that an Illustrator/SVG drawing has been recovered, or that human art acceptance is complete. The combined campaign/art/Gemini-renderer checkout described in the November 20 report may live on an unpublished local branch; reconcile it before merging visual-runtime changes.
