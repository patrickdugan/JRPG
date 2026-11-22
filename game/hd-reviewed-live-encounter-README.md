# Live HD reviewed-windup gameplay audit

The trial integration from PR #29 now has a real Action Campaign exercise using the authored Chapter 8 `c8-lady-enma` and Chapter 9 `c9-yearless-bell` encounters.

The Playwright smoke opens the unmodified game/action-campaign-battle.html with `art=hd&motion=reviewed`, runs browser-clock-driven gameplay while natural AI attempts windups, and instruments only the test browser's canvas drawImage method to see which WebP atlas is actually drawn. It also opens ordinary HD mode and a blocked-preview case for each encounter.

Each test checks the boss is an actual enemy in a loaded encounter, that the correct rendered-art lane is selected, no browser error arises, and canonical progress/storage remains unchanged. Evidence is saved as six full-page gameplay screenshots and one JSON report containing actual WebP drawing paths, phase samples, and approved-versus-canonical fallback observations.

A reviewed WebP request alone cannot establish visual use; this test requires a genuine draw on `actionCampaignCanvas` during combat. Should AI fail to enter a windup naturally, the report identifies the missed combat phase as a remaining test coverage problem.

Run locally after `python -m pip install playwright` and `python -m playwright install chromium`: `python game/tools/hd-reviewed-live-encounter-smoke.py --virtual-ms 18000` from the repository root.

The test is read-only for repository art and gameplay source. The separate approved trial clips retain their hashes and the seven complete boss packages keep visual approval pending.
