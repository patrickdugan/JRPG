# HD painted humanoid enemy wave, November 21, 2026

Eight canonical humanoid enemy IDs now have a six-pose painted HD key sheet and ten 24-frame derived motion clips in a **separate review ZIP**, \`JRPG_HD_Humanoid_Enemy_Motion_Wave1.zip\`. The picture binaries are not included in this GitHub branch. The branch adds the exact canonical ID registry and tests that the existing action engine accepts a merged 20-actor/196-clip package.

New actors: Mourning Ronin, Ashen Spearman, Court Arquebusier, Bell Scribe, Tithe Enforcer, Drowned Retainer, Salt Warden, and Ashen Banner Guard. The first four were painted on separate 1536×1024 3×2 sheets; the latter four were extracted from a four-quadrant board. Their lower source resolution is explicitly flagged for future HD redraw.

## Delivered in the download

- **48 newly isolated PNG key poses** across eight actors, six at 384×384 each, packed in 2304×384 per-actor strips.
- **80 motion WebP strips**, each 12×2 cells at 192×192, making **1,920 individually hash-verified derived frames**.
- Source image originals, separate SHA-256 key and motion manifests, a preview contact sheet, animated GIF previews and an offline HTML review player.
- \`tools/install_wave.py\` safely merges the pack with the existing \`JRPG_HD_Motion_Expanded_v2\` installation: atomic copy, SHA-256 verification, immutable prior keys, idempotence and opt-in conflict replacement.
- \`tools/test_wave.py\` verifies every decoded WebP frame, loop seam and installed merged manifest.

Install the PR #6 base engine and its previous 12-actor art ZIP before applying this add-on. The resulting optional HD art mode contains 20 identities (7 playable, 12 regular enemies and a Kurozane form study), 196 clips, and 4,704 motion frames. The main game continues using the established pixel art unless \`?art=hd\` is selected.

The new 24-frame sequences use foot-anchored deformations of an existing painted pose. They are animation studies and should receive a manually articulated animation pass before production sign-off. Collision, attack timing, save files and outcome logic stay under the existing combat engine.

## Remaining work

Of 28 canonical regular enemies, 12 have HD animation and **16 remain**: Ash Wisp, Registry Hound, Lantern Leech, Forge Thrall, Veil Courier, Provincial Banner Guard, Storm Nue, Dream Baku, Twin-Tail Nekomata, Sickle Weasel, Drum Tanuki, Marsh Kappa-Beast, Ushi-Oni Behemoth, Black Chrysanthemum Nest-Woman, Spider-Lily Ambusher and Lantern-Vine Maw. The three humanoid priorities are Forge Thrall, Veil Courier and Provincial Banner Guard.

Seven additional major bosses (Captain Kaji, Widow of Fog, Furnace Abbot, Magistrate Ujiro, Bell Warden Chiyo, Lady Enma and Yearless Bell) still need their own HD pose suites. Kurozane's six HD form studies remain unmapped to his boss-phase director. The 16 civilian roles have no separate HD body-animation series yet.

The lower-resolution four-quadrant figures are review candidates rather than character-art approvals. Painted figures are PNG source images; the generated motion uses WebP raster frames, never masquerading as editable SVG.
