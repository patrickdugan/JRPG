# User-approved HD windup trial lane

The user approved advancing the previously reviewed Yearless Bell and Lady Enma windup candidates. This integration is deliberately limited to two 24-frame clip trials. Their existing active, idle, recovery, signature and all other motion clips remain the canonical source versions.

## Enable the approved-for-testing artwork

Open a relevant Action Campaign encounter with **`?art=hd&motion=reviewed`**. The optional HD runtime will load `reviewed-motion/<boss>/windup.webp` for Yearless Bell or Lady Enma during the windup phase. For all other animation clips, the original `motion-manifest.json` and original WebPs are used. The existing `?art=hd` mode stays canonical. `?art=hd&motion=0` disables motion as before.

The canonical source paintings and ten-clip manifests are intact. The two trial WebPs live under `game/assets/art/hd-painted-v1/reviewed-motion/`, with a separate `manifest.json` that records source SHA-256, canonical windup and active SHA-256, each reviewed binary SHA-256, decoded 24-frame hashes, foot anchor, source pose, and original `frameMs`.

The trial loader requires the explicit query string, a closed two-boss/one-clip manifest schema, canonical source and phase hashes, and matching geometry and frame timing. If the overlay is missing, malformed, fails to load, or has wrong dimensions, the renderer uses the original windup clip. It never changes fixed-step combat, attack duration, hitboxes, saved state, or fallback pixel sprites.

These two WebPs are recreated from PR #26's exact pinned inputs by `python game/tools/install-reviewed-hd-windups.py --install`. The installer fails closed unless the output bytes equal the previously audited hashes:

- Yearless Bell windup: `914bf7f42c7535f18e91177a29e5f6b6e7415e796739fe98e51c717c992e07e1`
- Lady Enma windup: `2c2e18d0486c4f10aa9d73f6c8d6ea13b85bde80bf7bc678b5d9786bbffc1a47`

The GitHub Actions importer commits those two generated WebPs and their reviewed-motion manifest to the feature branch, then checks the full 70-clip original inventory. The Chromium smoke renders both real boss windups, verifies ordinary HD still displays canonical motion, and blocks one preview request to verify immediate canonical fallback.

### Approval boundary

`user-approved-clip-trial` in this isolated manifest records permission to test these windups. All seven complete boss packages remain `visualApproval: pending` in the Roster Keystone. The visible phase change to original active art still needs the painted release-pose work from Issue #27. Completing that broader artistic review requires separate approval and its own acceptance receipts.

Run the local review page using `cd game && npm run review:serve`, then open `http://localhost:8080/game/hd-cutover-lab.html` to inspect the exact transition. The ordinary classic gameplay mode continues to use pixel-art assets.
