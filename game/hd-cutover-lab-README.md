# Attack Cutover Lab

The source-derived windup candidates for Yearless Bell and Lady Enma are downloadable GitHub Actions artifacts. Their original runtime animations, painted masters and combat phase timing remain unchanged.

From the `game/` directory, run `npm run review:serve`, then open http://localhost:8080/game/hd-cutover-lab.html. The repository-root server exposes the original clip manifests and Roster Keystone.

Upload a candidate 2304×384 12×2 WebP atlas from PR #24 (`windup-review`) or PR #26 (`windup-effect-leadin`), together with `candidate-receipts.json` or `effect-leadin-receipts.json` from the same hosted workflow.

The browser compares the uploaded WebP file's SHA-256 with its generator receipt, checks the 24 declared decoded-frame hashes for uniqueness, and validates source active-clip identity. The source generator CI remains the authority for decoded RGBA SHA checks because browser decoders can premultiply alpha. Evidence capture requires a matching file hash.

Both lanes share the immutable active attack. Review phase stepping across windup frame 24 to active frame 1 with charcoal, warm-paper or checker backgrounds. The browser displays a 48px grayscale foreground-difference score as a review aid; PR #25 owns the separate reproducible Python metric.

After visually inspecting hinge, wrist, and silhouette continuity, enter a review recommendation and frame-specific notes. The screenshot PNG and paired JSON include candidate and source hashes, phase index, screenshot SHA-256 and the local review state. Notes persist in a separate browser key and can be exported.

Node tests: `node --test game/tests/hd-cutover-lab.test.mjs`.

Browser smoke: `python game/tools/hd-cutover-browser-smoke.py`, after installing Pillow and Playwright with Chromium.

The hosted workflow regenerates the actual Yearless Bell and Lady Enma effects-prelude candidates from SHA-pinned source paintings, then tests a real Yearless WebP upload and its CI receipt in Chromium. It also injects an incorrect-hash control to prove the evidence gate rejects mismatched bytes. Standalone local smoke defaults to a disposable synthetic candidate fixture. Neither the real generator preview nor the synthetic fixture constitutes artistic approval.

The existing runtime WebPs, original source art and ZIPs, hitboxes, timing, game saves and seven visual approvals stay untouched and pending.
