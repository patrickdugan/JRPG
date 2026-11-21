# JRPG Roster Keystone

**Canonical identity and production-status ledger**. Source of truth for the 62-identity JRPG roster, cross-checked against the game's character source, boss source and NPC role taxonomy. [JSON index](./roster.json).

Do not infer final visual approval from generated image or motion file counts. The existing HD motion sources in the downloadable ZIPs are uncommitted candidates. Each painted key sheet has six poses; each normal HD motion set contains 10 clips of 24 frames. Four Kurozane form identities share one six-clip study, pending engine-specific phase mapping.

| Type | Identities | Six-key painted candidates | 24-frame motion candidates | Missing HD | Existing pixel animation |
| --- | ---: | ---: | ---: | ---: | ---: |
| Playable party | 7 | 7 | 7 | 0 | 7 |
| Regular enemies | 28 | 12 | 12 | 16 | 28 |
| Major named bosses | 7 | 0 | 0 | 7 | 7 |
| Kurozane forms | 4 | Shared form study | Shared 6-clip study | Phase mapping | 4 |
| Civilian NPC roles | 16 | 0 | 0 | 16 | 16 |

**Existing HD candidate motion count**: 196 clips / 4,704 frames in downloadable packages, consisting of 70 party + 120 regular enemy + 6 Kurozane studies. Additional 160 regular-enemy clips / 3,840 frames are the immediate goal. A separate Git-committed *source-derived* lane may fill engine-visible gaps; it must retain honest provenance distinct from hand-painted HD masters.

## Production checklist

| Canonical ID | Kind | Family | Painted master | 24f motion | Binary Git | Engine | Visual review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ren` | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `aya` | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `nikola-drazanic` | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `mateus` | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `genta` | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `kiku` | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `miyo-senda` | party | playable | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `cinder-hound` | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `ash-wisp` | regular-enemy | initial | pending | pending | pending | fallback-only | pending |
| `bell-moth` | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `tithe-enforcer` | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `registry-hound` | regular-enemy | initial | pending | pending | pending | fallback-only | pending |
| `drowned-retainer` | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `lantern-leech` | regular-enemy | initial | pending | pending | pending | fallback-only | pending |
| `salt-warden` | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `ashen-spearman` | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `ashen-banner-guard` | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `forge-thrall` | regular-enemy | initial | pending | pending | pending | fallback-only | pending |
| `bell-scribe` | regular-enemy | initial | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `mourning-ronin` | regular-enemy | humanoid | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `court-arquebusier` | regular-enemy | humanoid | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `veil-courier` | regular-enemy | humanoid | pending | pending | pending | fallback-only | pending |
| `provincial-banner-guard` | regular-enemy | humanoid | pending | pending | pending | fallback-only | pending |
| `storm-nue` | regular-enemy | beast | pending | pending | pending | fallback-only | pending |
| `dream-baku` | regular-enemy | beast | pending | pending | pending | fallback-only | pending |
| `twin-tail-nekomata` | regular-enemy | beast | pending | pending | pending | fallback-only | pending |
| `silk-jorogumo` | regular-enemy | beast | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `sickle-weasel` | regular-enemy | beast | pending | pending | pending | fallback-only | pending |
| `drum-tanuki` | regular-enemy | beast | pending | pending | pending | fallback-only | pending |
| `marsh-kappa-beast` | regular-enemy | beast | pending | pending | pending | fallback-only | pending |
| `ushi-oni-behemoth` | regular-enemy | beast | pending | pending | pending | fallback-only | pending |
| `black-chrysanthemum-nest-woman` | regular-enemy | plant | pending | pending | pending | fallback-only | pending |
| `razor-bamboo-stalker` | regular-enemy | plant | candidate-in-ZIP | candidate-in-ZIP | pending | optional-hd-mode | pending |
| `spider-lily-ambusher` | regular-enemy | plant | pending | pending | pending | fallback-only | pending |
| `lantern-vine-maw` | regular-enemy | plant | pending | pending | pending | fallback-only | pending |
| `kurozane-court-human` | kurozane-form | kurozane | shared-study-in-ZIP | shared-six-clip-study | pending | phase-mapping-pending | pending |
| `kurozane-oni-armor` | kurozane-form | kurozane | shared-study-in-ZIP | shared-six-clip-study | pending | phase-mapping-pending | pending |
| `kurozane-demon-mode` | kurozane-form | kurozane | shared-study-in-ZIP | shared-six-clip-study | pending | phase-mapping-pending | pending |
| `kurozane-ward-broken` | kurozane-form | kurozane | shared-study-in-ZIP | shared-six-clip-study | pending | phase-mapping-pending | pending |
| `captain-kaji` | named-boss | major-boss | pending | pending | pending | fallback-only | pending |
| `widow-of-fog` | named-boss | major-boss | pending | pending | pending | fallback-only | pending |
| `furnace-abbot` | named-boss | major-boss | pending | pending | pending | fallback-only | pending |
| `ujiro` | named-boss | major-boss | pending | pending | pending | fallback-only | pending |
| `bell-warden-chiyo` | named-boss | major-boss | pending | pending | pending | fallback-only | pending |
| `lady-enma` | named-boss | major-boss | pending | pending | pending | fallback-only | pending |
| `yearless-bell` | named-boss | major-boss | pending | pending | pending | fallback-only | pending |
| `npc-speaker` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-interviewee` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-confined-person` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-courier` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-dock-worker` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-ferry-captain` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-market-seller` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-trade-broker` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-print-organizer` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-port-clerk` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-physician` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-resident` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-former-retainer` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-caretaker` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-net-mender` | npc | civilian | pending | pending | pending | fallback-only | pending |
| `npc-post-keeper` | npc | civilian | pending | pending | pending | fallback-only | pending |

## Acceptance gates

- **Source image**: preserve and hash original PNG / high-resolution concept; do not describe an AI-generated concept as editable vector artwork.
- **Six-pose sheet**: native full-body transparent RGBA, costume and facial identity stable, effects separated where possible.
- **Motion**: genuine frame-specific motion reviewed at game scale; 24 different pixel hashes alone are an integrity check, not evidence of articulated quality.
- **Engine**: phase sampler uses authoritative simulation windup/active/recovery, and pixel-art fallback always remains.
- **Human review**: alpha/white matte, foot anchors, pose clarity, armor/period authenticity and effect occlusion.

The reviewer should update statuses in `roster.json` with every approved or committed batch. `game/tests/roster-keystone.test.mjs` validates ID completeness against the canonical sources.
