# Voice audition ledger and render handoff

The developer Voice Lab (`game/voice-lab.html`) is the listening and acceptance desk for the synthetic voice prototype suites (`last-command`, `cast-auditions`, `battle-barks`, and `trio-highlights` across all 14 speaking roles; see [`docs/57-voice-cast-and-campaign-playback.md`](57-voice-cast-and-campaign-playback.md)). It uses the authored voice manifest; the canonical English and Japanese script remains with the game content. The same review workflow can be used for future Gemini and locally rendered batches once their manifests are integrated.

## Reviewer workflow

1. Serve `game/` through an HTTP server and open `voice-lab.html`.
2. Switch between English and Japanese, listen to the actual rendered take, and mark each line **Accept**, **Retake**, **Pronunciation**, or **Script / translation**. Put actionable direction in its note.
3. Use **Export review JSON** at the end of each session. Send the JSON to whoever runs the next render. The page preserves notes in local browser storage until cleared, and **Import review JSON** recovers them on a second machine.
4. After a re-render or script correction, reopen the ledger. An old record's identity binds language, speaker, exact text, output file, seed and chosen take. If the version changes, the browser locks editing while keeping the previous JSON exportable. Export the older notes, then clear/import a matching ledger as needed.
5. Native Japanese speakers must approve register, diction and pronunciation before any Japanese performance is marked production-ready. The prototype credits remain synthetic placeholders. No real person's voice should be cloned without written permission and licensing.

**Evidence boundary:** the verdicts are personal editorial annotations, kept under `bells-black-chrysanthemum.voice-review.v1`. They do not enter campaign saves, canonical story outcomes, progress receipts, or release-duration proof. A review acceptance describes a single generated take and is not final casting approval.

## Hosted verification

The standalone browser check at `game/tools/voice-review-browser-smoke.py` tests actual rendered controls, reload persistence, language isolation, JSON export/import, stale-take rejection, and browser console/page/HTTP errors. Its GitHub Actions workflow runs the Node unit contract and a real headless Chromium page load, saving a screenshot artifact. It does not replace a human listening pass or the separate full-game rendered-control route and blind playtests.

Run locally:

```bash
node --test game/tests/voice-review.test.mjs game/tests/dialogue-voice-runtime.test.mjs game/tests/battle-bark-runtime.test.mjs
python -m pip install playwright
python -m playwright install chromium
python game/tools/voice-review-browser-smoke.py
```
