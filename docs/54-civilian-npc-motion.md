# Civilian NPC field motion: 16-role source-derived studies

This development pass adds six optional motion clips for each of the 16 canonical NPC roles. It retains the authored 32×48 pixel characters and all existing quest, interaction, saving, and movement rules.

## Source and identity contracts

The 16 canonical roles are speaker, interviewee, confined-person, courier, dock-worker, ferry-captain, market-seller, trade-broker, print-organizer, port-clerk, physician, resident, former-retainer, caretaker, net-mender and post-keeper.

The IDs come directly from assets/art/npc-field-suite/npc-field-suite.source.json, preserving its exact four historical and twelve occupational roles. The runtime refuses free-text identity inference. Inanimate objects, sacred items, group objectives and unrelated markers remain outside NPC rendering.

## Frame format

| Clip | Source authored pose | Frames | Playback |
| --- | --- | ---: | --- |
| idle | south-idle | 24 | loop |
| walk | south-idle | 24 | loop |
| talk | south-gesture | 24 | loop |
| work | south-gesture | 24 | loop |
| react | south-gesture | 24 | one-shot candidate |
| leave | south-idle | 24 | one-shot candidate |

Each source-derived frame is 128 × 192. Twenty-four cells occupy two rows of 12 in a 1536 × 384 WebP atlas. A deterministic source manifest pins the original sprite atlas hash, each output WebP hash, and the hash of each decoded RGBA frame.

**Output: 16 roles, 96 clips, 2,304 frames.** The authored input still has just two native key poses per role. These new frames are slight subpixel transformations, useful for the field engine and visual review. They are not independently painted HD characters.

## Campaign

The optional loader in game/npc-motion-v1.mjs is integrated into game/campaign.js. Open Campaign with the query parameter npcMotion=1 to enable it. All rendering falls back to the existing NPC sprite sheet on asset failure. The built-in role resolution, objective markers, names, hitboxes, interaction ranges and all game systems remain unchanged.

Only idle and talk are selected by the existing marker renderer; the four other clips are available in game/npc-motion-review.html and await explicit gameplay-state integration.

Reduced-motion presentation freezes the first frame.

## Rebuild and test

    python -m pip install pillow==11.3.0
    python game/tools/build-npc-motion-v1.py
    python game/tools/build-npc-motion-v1.py --check
    node --test game/tests/npc-motion-v1.test.mjs
    python game/tools/npc-motion-browser-smoke.py

On the feature branch, .github/workflows/npc-motion-v1.yml builds the 96 strips, hashes all decoded frames, runs Node and Chromium acceptance, and commits the binary WebP files into the Git branch. The original NPC sprites are left untouched.

## Related boss-quality gate

Bell Warden Chiyo has a new individual 1536×1024 painterly source with six key poses and 240 derived frames, replacing the previous small comparison-poster source. The package is JRPG_HD_Boss_Chiyo_Premium_v2.zip; exact source, sheet and archive hashes are in her Roster Keystone record. Its full-resolution image binaries require a separate authenticated local Git import. Lady Enma and Yearless Bell still need individual premium source art.
