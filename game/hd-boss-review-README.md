# Seven-boss HD visual QA studio

This review surface uses the **actual Git-tracked original paintings, six-key
transparent PNGs, and 70 source-derived 24-cell motion atlases** imported by the
stacked HD artwork PRs. All seven named boss entries retain their independent
`visualApproval: pending` state until human art review.

## Open

From the repository's `game/` directory:

```bash
npm run review:serve
```

Then open **http://localhost:8080/game/hd-boss-review.html** in a browser.
The review server intentionally serves the *repository root* to expose both
`assets/art/hd-painted-boss-review-v1/` (preserved source paintings) and
`game/assets/art/hd-painted-v1/` (runtime atlases). The ordinary
`npm run serve` serves only `game/` and cannot reach source paintings.

Use `?boss=lady-enma`, for example, to open a named boss directly.

## Quality gates

Read the original painting at full resolution before judging the six key poses.
Compare the alpha edges under checker, dark, and light backdrops. Review all ten
motion strips, using the frame slider to inspect isolated defects and foot
anchoring. Prioritize gameplay-important windup, active, recovery, and signature
sequences. Check a second time over the studio arena mockup. The optional
`?art=hd` Action Campaign view remains the actual game-compositing check.

Reviewer choices are **unreviewed**, **needs-fixes**, and **ready-for-signoff**.
They are local recommendations. They do not update the Roster Keystone, grant
release approval, or alter combat assets. The existing pixel-art runtime remains
the gameplay fallback.

## Exported evidence

`Capture PNG comparison` downloads one 1680×1120 PNG with the source, six
keys, selected clip frame, and review notes. `Download JSON receipt` then
downloads its paired metadata, including the selected frame index, backdrop,
playback speed, original-source SHA-256 from the intake, six-key atlas SHA-256,
clip SHA-256, and SHA-256 of the screenshot PNG itself.

`Export all review notes` generates one JSON file for all seven bosses and
all 70 individual clip note entries. Notes are versioned in this page's own
localStorage key and deliberately segregated from game saves. Reloading the
review page retains notes in the same browser. Copy the JSON receipt and PNG to
a PR for human evaluation; canonical approval must be handled separately.

The PNG receipt records the current browser composition. The CI import pipeline
owns source-binary and decoded-frame verification. The reviewer determines
whether those images are visually acceptable.

## Checks

```bash
node --test game/tests/hd-boss-review.test.mjs \
  game/tests/hd-boss-final-four-intake.test.mjs \
  game/tests/hd-seven-named-boss-art-git.test.mjs
python game/tools/hd-boss-review-browser-smoke.py
```

The Python smoke requires `pip install playwright` and a Chromium browser
(`python -m playwright install chromium`). The hosted workflow produces a
full-page screenshot, paired PNG/JSON clip evidence, and a smoke summary as
a downloadable CI artifact. It verifies that Roster Keystone is unchanged.

Source-derived deformations are provisional. Lady Enma and Yearless Bell retain
matte-removal risks; the Furnace Abbot intake also explicitly records checker
cleanup pending. All seven require human inspection of silhouette integrity and
attack readability before future art promotion.
