# Extrapolation queue: Bells of the Black Chrysanthemum

Generated from the template DAG on 2026-11-21T14:23:17.103Z. Work in listed order; blocked tasks consume only verified upstream evidence.

## 1. Internal video teaser (presentation.video-teaser)

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
- presentation.battle-shot: docs/05-art-direction.md (b84066e5ce40)
- presentation.world-shot: assets/production/bells-takamine-keyframe-v1.png (17aea41ebe15)
- presentation.world-shot: docs/05-art-direction.md (b84066e5ce40)
- presentation.menu-shot: game/index.html (66e438c4b21b)
- presentation.menu-shot: docs/05-art-direction.md (b84066e5ce40)

## 2. Final playtests (qa.final-playtests)

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

## 3. Release-readiness synthesis (qa.release-readiness)

- Status: partial / required
- Target: docs/11-build-qa-report.md
- Objective: Synthesize human and automated evidence without promoting estimates or stale receipts into release claims.
- Blocked by: qa.final-playtests

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
- production.staffing: docs/56-staffing-and-contractor-plan.md (63ea89121d68)
- production.staffing: docs/00-production-roadmap.md (11c2b07bc4f8)
