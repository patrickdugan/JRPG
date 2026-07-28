# Extrapolation queue: Bells of the Black Chrysanthemum

Generated from the template DAG on 2026-07-28T19:13:19.495Z. Work in listed order; blocked tasks consume only verified upstream evidence.

## 1. Staffing and contractor plan (production.staffing)

- Status: partial / required
- Target: docs/27-staffing-and-contractor-plan.md
- Objective: Map JRPG-specific production responsibilities, capability gaps, and decision ownership.

Suggested sections:

- Roles
- Relevant experience
- Ownership
- Hiring order
- Review gates
- Budget assumptions

Acceptance contract:

- At least 1 declared artifact(s) exist and are non-empty.
- Combined text contains at least 300 words.
- Evidence addresses: artist or art director or art.
- Evidence addresses: programmer or engineer or developer or technical.
- Evidence addresses: writer or narrative.
- Evidence addresses: producer or production.

Verified inputs:

- design.vision: docs/01-vision-doc.md (846b8f7db4e2)
- design.technical-gdd: docs/02-technical-gdd.md (08857e0484e6)
- production.asset-list: docs/06-master-asset-list.md (c4676b67501e)

## 2. Internal video teaser (presentation.video-teaser)

- Status: optional-missing / optional
- Target: assets/production/jrpg-internal-teaser.mp4
- Objective: Animate the battle and world vision for animation, VFX, and battle-scripting alignment.

Suggested sections:

- Shot list
- Timing
- Combat beat
- World beat
- Audio intent

Acceptance contract:

- At least 1 declared artifact(s) exist and are non-empty.

Current evidence problems:

- presentation.video-teaser needs at least 1 artifact(s).

Verified inputs:

- presentation.battle-shot: assets/production/bells-party-roster-v1.png (f6b28f192a35)
- presentation.battle-shot: docs/05-art-direction.md (c35ddf67203c)
- presentation.world-shot: assets/production/bells-takamine-keyframe-v1.png (17aea41ebe15)
- presentation.world-shot: docs/05-art-direction.md (c35ddf67203c)
- presentation.menu-shot: game/index.html (5797d7bf4f89)
- presentation.menu-shot: docs/05-art-direction.md (c35ddf67203c)

## 3. Final playtests (qa.final-playtests)

- Status: partial / required
- Target: docs/19-human-playtest-protocol.md
- Objective: Collect current-build human evidence for comprehension, balance, accessibility, pacing, and completion.

Suggested sections:

- Build identity
- Participants
- Protocol
- Observations
- Timing
- Defects
- Retest

Acceptance contract:

- At least 2 declared artifact(s) exist and are non-empty.
- Evidence includes: markdown, data.
- Evidence addresses: human.
- Evidence addresses: playtest.
- Evidence addresses: timing or duration.
- Evidence addresses: finding or result.

Verified inputs:

- chapter.content: docs/04-detailed-outline.md (b15388e09b23)
- chapter.content: game/content/campaign.mjs (369716fbb066)
- chapter.content: docs/rendered-route-playtest-evidence.json (bdf021e41dc7)
- chapter.content: game/tests/campaign-content.test.mjs (80bec21ea9eb)

## 4. Release-readiness synthesis (qa.release-readiness)

- Status: partial / required
- Target: docs/11-build-qa-report.md
- Objective: Synthesize human and automated evidence without promoting estimates or stale receipts into release claims.
- Blocked by: qa.final-playtests, production.staffing

Suggested sections:

- Build identity
- Automated verification
- Human evidence
- Accessibility
- Cultural review
- Balance
- Known risks
- Verdict

Acceptance contract:

- At least 3 declared artifact(s) exist and are non-empty.
- Evidence includes: markdown, data, test.
- Evidence addresses: accessibility.
- Evidence addresses: cultural or historical.
- Evidence addresses: balance.
- Evidence addresses: release or readiness.

Verified inputs:

- qa.final-playtests: docs/19-human-playtest-protocol.md (6e4ed6eef3db)
- qa.final-playtests: docs/rendered-route-playtest-evidence.json (bdf021e41dc7)
- production.staffing: docs/00-production-roadmap.md (d53cd7d016eb)
