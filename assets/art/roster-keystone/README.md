# JRPG Roster Keystone

**Canonical identity and production-status ledger**. Source of truth for the 62-identity JRPG roster, cross-checked against the game's character source, boss source and NPC role taxonomy. [JSON index](./roster.json).

Do not infer final visual approval from generated image or motion file counts. The existing HD motion sources in the downloadable ZIPs are uncommitted candidates. Each painted key sheet has six poses; each normal HD motion set contains 10 clips of 24 frames. Four Kurozane form identities share one six-clip study. The optional battle renderer now binds its six study keys to the live court/bell/dawn phase IDs; the painted image binaries remain in the downloadable HD package and visual approval is still pending.

| Type | Identities | Six-key painted candidates | 24-frame motion candidates | Missing HD | Existing pixel animation |
| --- | ---: | ---: | ---: | ---: | ---: |
| Playable party | 7 | 7 | 7 | 0 | 7 |
| Regular enemies | 28 | 12 | 12 | 16 | 28 |
| Major named bosses | 7 | 7 individual painted review candidates | 7 candidate sets | 0 need standalone sources; matte and motion polish pending | 7 |
| Kurozane forms | 4 | Shared form study | Shared 6-clip study | Phase-bound optional HD; binaries in ZIP | 4 |
| Civilian NPC roles | 16 | 0 | 0 | 16 | 16 |

**Existing HD candidate motion count**: 196 clips / 4,704 frames in downloadable packages, consisting of 70 party + 120 regular enemy + 6 Kurozane studies. Additional 160 regular-enemy clips / 3,840 frames are the immediate goal. A separate Git-committed *source-derived* lane may fill engine-visible gaps; it must retain honest provenance distinct from hand-painted HD masters.

## Six-boss HD presentation VFX (review lane)

Widow of Fog, Furnace Abbot, Ujiro, Bell Warden Chiyo, Lady Enma and Yearless Bell now have a versioned 12-frame windup / 12-frame active VFX generator. The generated transparent images remain a separate art stream from boss body animation. **The six premium painted body masters are still pending** and old pixel boss animation remains the exact fallback. Source: [boss VFX documentation](../../../docs/52-hd-boss-vfx.md).

**Widow of Fog candidate (Nov 21):** six newly painted key poses and 240 generated motion cells are packaged for direct art review, with the source hash recorded in [the Widow intake](widow-of-fog-hd-intake.json). These painted binaries remain outside the Git tree pending manual acceptance and upload. The six-boss VFX source, meanwhile, is tracked separately in this branch.

**Furnace Abbot candidate (Nov 21):** six new concept-quality key poses with the canonical Hammer Decree and Forge Sermon tells, ten generated 24-frame clips, and a separately validated installer. See [the Furnace intake](furnace-abbot-hd-intake.json); its binary PNG/WebP assets are distributed in the conversation ZIP pending Git upload and manual visual review. The light-source matte has provisional transparency and requires edge cleanup.

## Chiyo individual premium-source redraw

Bell Warden Chiyo now has a standalone 1536×1024 RGBA six-pose source replacing the low-resolution comparison-crop candidate. The revised package `JRPG_HD_Boss_Chiyo_Premium_v2.zip` includes ten 24-frame clips and preserves hashes of the source and prepared six-key atlas in `bell-warden-chiyo-hd-intake.json`. The image binaries remain in the downloadable package until Git import; `assetInGit` remains false and visual approval stays pending.

## Final four named boss HD art candidates

Magistrate Ujiro, Bell Warden Chiyo, Lady Enma and Yearless Bell now have six-key candidate bodies and ten 24-frame motion clips each in `JRPG_HD_Boss_FinalFour_20261121.zip`. Ujiro uses an individually generated 1536×1024 painted source. Chiyo, Enma and Yearless Bell use small comparison-poster figures that remain subject to a premium full-resolution redraw. These four add **40 candidate clips and 960 derived frames** to the separate conversation-distributed art packages.

The Roster Keystone stores each boss source SHA-256, final six-key atlas SHA-256 and exact quality flag. The binary `PNG` and `WebP` assets are not yet in Git; the guarded importer can add them in per-boss commits under 90 MiB. See [import and verification guide](../../../docs/53-hd-boss-final-four.md). Pixel boss animation remains available, and the visuals have yet to pass the final art-review gate.

## Sixteen civilian field-motion candidates

The source-authored NPC field-motion generator covers the **16 canonical person roles** from `npc-field-suite.source.json`, producing **six clips of 24 derived frames per role** (96 clips and 2,304 cells). The native 32×48 role silhouettes remain authoritative; the new 128×192 WebP animation strips add smoother presentation when `?npcMotion=1` is specified. Standard world interactions, collision geometry, saves and encounter transitions remain unchanged.

The generator, runtime and all **96 actual WebP motion strips** are committed in Git at [`c1bd6f4`](https://github.com/patrickdugan/JRPG/commit/c1bd6f465c378853911e5930b6cf82834750065b). CI verified 2,304 distinct decoded frames and every asset SHA-256; all 16 civilian entries now carry `npcFieldMotion.binaryGit: true`. These are **pixel-derived field-motion studies**, not 16 new individual premium painted NPC characters. Each roster record holds a distinct `npcFieldMotion` status, leaving premium `paintedKeyArt` pending. See [NPC field animation design and verification](../../../docs/54-civilian-npc-motion.md).

## Production checklist

| Canonical ID | Kind | Family | Painted master | 24f motion | Binary Git | Engine | Visual review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ren | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| aya | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| nikola-drazanic | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| mateus | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| genta | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| kiku | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| miyo-senda | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| cinder-hound | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| ash-wisp | regular-enemy | initial | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| bell-moth | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| tithe-enforcer | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| registry-hound | regular-enemy | initial | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| drowned-retainer | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| lantern-leech | regular-enemy | initial | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| salt-warden | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| ashen-spearman | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| ashen-banner-guard | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| forge-thrall | regular-enemy | initial | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| bell-scribe | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| mourning-ronin | regular-enemy | humanoid | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| court-arquebusier | regular-enemy | humanoid | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| veil-courier | regular-enemy | humanoid | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| provincial-banner-guard | regular-enemy | humanoid | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| storm-nue | regular-enemy | beast | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| dream-baku | regular-enemy | beast | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| twin-tail-nekomata | regular-enemy | beast | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| silk-jorogumo | regular-enemy | beast | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| sickle-weasel | regular-enemy | beast | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| drum-tanuki | regular-enemy | beast | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| marsh-kappa-beast | regular-enemy | beast | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| ushi-oni-behemoth | regular-enemy | beast | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| black-chrysanthemum-nest-woman | regular-enemy | plant | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| razor-bamboo-stalker | regular-enemy | plant | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| spider-lily-ambusher | regular-enemy | plant | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| lantern-vine-maw | regular-enemy | plant | pending | pending | source-derived committed | optional-source-derived-fallback | pending |
| kurozane-court-human | kurozane-form | kurozane | shared-study-in-ZIP | shared-six-clip-study | pending | phase-mapped-optional-hd | pending |
| kurozane-oni-armor | kurozane-form | kurozane | shared-study-in-ZIP | shared-six-clip-study | pending | phase-mapped-optional-hd | pending |
| kurozane-demon-mode | kurozane-form | kurozane | shared-study-in-ZIP | shared-six-clip-study | pending | phase-mapped-optional-hd | pending |
| kurozane-ward-broken | kurozane-form | kurozane | shared-study-in-ZIP | shared-six-clip-study | pending | phase-mapped-optional-hd | pending |
| captain-kaji | named-boss | major-boss | candidate-in-ZIP | 240-frame candidate-in-ZIP | pending | optional-HD-after-install | pending |
| widow-of-fog | named-boss | major-boss | pending | pending | pending | fallback-only | pending |
| furnace-abbot | named-boss | major-boss | candidate-in-ZIP | candidate-in-ZIP | candidate-in-ZIP | optional-hd-after-package-install | candidate-in-ZIP |
| ujiro | named-boss | major-boss | pending | pending | pending | fallback-only | pending |
| bell-warden-chiyo | named-boss | major-boss | pending | pending | pending | fallback-only | pending |
| lady-enma | named-boss | major-boss | pending | pending | pending | fallback-only | pending |
| yearless-bell | named-boss | major-boss | pending | pending | pending | fallback-only | pending |
| npc-speaker | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-interviewee | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-confined-person | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-courier | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-dock-worker | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-ferry-captain | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-market-seller | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-trade-broker | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-print-organizer | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-port-clerk | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-physician | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-resident | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-former-retainer | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-caretaker | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-net-mender | npc | civilian | pending | pending | pending | fallback-only | pending |
| npc-post-keeper | npc | civilian | pending | pending | pending | fallback-only | pending |

## Kurozane painterly form selection

The engine now selects the retained six-frame high-detail Kurozane study through the boss director, rather than guessing from HP alone. In `?art=hd` mode only, `court` uses source keys 01/02 (idle/committed action), `bell` uses keys 03/04, and `dawn` uses 05/06. Defeat holds key 06. The matching 24-frame `form-01` through `form-06` WebP studies are selected through the existing HD motion sampler; the six-key PNG is its immediate fallback. Source art must be installed from the prior HD ZIP before either lane becomes visible.

The original tested boss v2 clip system remains the render fallback when these optional binary files are absent, fail decoding, or lack a valid boss phase. Kurozane's historical human, armor, and demon references survive unchanged. The binding is a presentation-only engineering acceptance, with review of effects, hand-articulated transitions and boss-specific poses still outstanding.

## Captain Kaji's HD painted source (review candidate)

The six-key painted original preserves his salt-cut sword, chain-haul hook, spool reel, scarred captain's face, and Crane Surge overhead tell. The source SHA-256 is `a616f7d710cbf7005432ba6f3c9a2e8b2fcf8290a89173a6424b4f1e43522b16`; the package `JRPG_HD_Boss_CaptainKaji_v1.zip` includes 6 isolated PNG key poses, a six-key engine PNG, ten 24-frame derived WebP motion strips and a checksum-verifying installer. Source and clip integrity tests pass locally. These painterly binaries are in the conversation download and remain to be imported into Git; they are **not** counted as Git-committed artwork. Human acceptance and dedicated animation in-betweens are still open.

## Acceptance gates

- **Source image**: preserve and hash original PNG / high-resolution concept; do not describe an AI-generated concept as editable vector artwork.
- **Six-pose sheet**: native full-body transparent RGBA, costume and facial identity stable, effects separated where possible.
- **Motion**: genuine frame-specific motion reviewed at game scale; 24 different pixel hashes alone are an integrity check, not evidence of articulated quality.
- **Engine**: phase sampler uses authoritative simulation windup/active/recovery, and pixel-art fallback always remains.
- **Human review**: alpha/white matte, foot anchors, pose clarity, armor/period authenticity and effect occlusion.

The reviewer should update statuses in `roster.json` with every approved or committed batch. `game/tests/roster-keystone.test.mjs` validates ID completeness against the canonical sources.

## Final three premium boss source archives committed as Git binaries

Lady Enma, Bell Warden Chiyo and Yearless Bell each have a new individual 1536×1024 source and a ten-clip motion candidate. All three **original, exact source ZIP archives** are now stored as 1.5 MB SHA-verified Git binary chunks under `assets/art/hd-boss-binary-import-v1/`. The hosted import job reconstructs these bytes and commits the unpacked runtime images in separate under-90-MiB Git commits. Original pixel boss clips and gameplay hitboxes remain authoritative. All high-resolution candidates need final visual approval. See [binary import documentation](../../../docs/55-hd-final-boss-binary-import.md).
