# Current-Build Accessibility Audit

**Audit date:** 2026-07-20
**Scope:** source and automated contracts for `index.html`, `campaign.html`, `battle.html`, `camp.html`, and `credits.html`, including the Storyworld choice panel, Battle narrative-context card, and Credits evidence controls. This pass did not perform or simulate a duration run.

## Implemented findings

- All five pages retain a keyboard-visible skip link, a programmatically focusable main target, no positive `tabindex`, visible focus treatment for programmatic focus targets, and a reduced-motion stylesheet override.
- Canvas-only visuals retain nearby text authority: FP-0 publishes a board summary, Campaign describes field objectives/progress/feedback and hides decorative scene canvases, and Battle describes its canvas through actor, command, and objective text.
- Canonical choices, Storyworld choices, witness consequences, Camp narrative lists/choices, Battle commands, and party targets use ordinary labelled groups. Battle no longer claims toolbar keyboard semantics it does not implement.
- Implemented shortcuts are exposed with `aria-keyshortcuts`: Campaign interaction, dialogue, scene navigation, canonical/Storyworld/witness choices, and Camp narrative advance/choices. Native buttons and selectors remain the primary controls.
- Whole-phrase live regions are atomic. Rapidly rebuilt Tempo and Result Log histories remain non-live, with Battle using one concise announcement channel. Credits timing and receipt text are deliberately non-live so the once-per-second receipt refresh cannot flood announcements; the evidence-export status mutates only when its text actually changes.
- Battle moves focus to the durable victory exit once per terminal reveal instead of on every later render. Storyworld, Camp narrative headings, Credits result status, and rebuilt Battle/Campaign selectors have visible programmatic-focus treatment.
- Automated contrast spot checks cover one critical explicit foreground/background pair on each shared/page stylesheet and require at least 4.5:1. These checks are bounded source gates, not a claim that every gradient, pixel-art overlay, state, zoom level, or browser rendering has been visually approved.

## Automated evidence

Run from `game/`:

```text
node --test tests/accessibility-current-build.test.mjs tests/accessibility-input-integration.test.mjs tests/camp-accessibility-integration.test.mjs tests/storyworld-campaign-integration.test.mjs tests/battle-presentation-integration.test.mjs
```

Result: **42/42 tests passed**. The selection covers semantics, keyboard declarations and precedence, focus restoration/terminal focus, live-region cadence, reduced-motion source contracts, text alternatives, bounded contrast math, Storyworld gating, and related Battle/Camp presentation integration. It is not a full-suite or browser-assistive-technology result.

## Human-only and external gaps

- Narrator, NVDA, JAWS, VoiceOver, and switch-control reading/operation remain untested.
- Human keyboard-order, 200%/400% zoom, reflow, Windows high-contrast/forced-colors, color-vision, and cognitive-load review remain required.
- Human touch-target comfort, gesture behavior, and mobile screen-reader review remain required on physical devices.
- Pixel-art, focus-ring, telegraph, status, and text readability over every live backdrop/animation state remain subject to visual review.
- Audio descriptions/captions beyond the existing text-authoritative state and audio controls require product-level review.
- The external historical/cultural review remains separate and pending.

No automated result in this pass should be represented as WCAG conformance certification or human assistive-technology acceptance.
