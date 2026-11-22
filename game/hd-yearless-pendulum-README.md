# Yearless Bell: articulated pendulum idle motion candidate

The seven-boss motion audit confirmed that the **Yearless Bell idle** study
contains very little visible variation despite 24 unique decoded hashes.
Its core painting depicts a suspended heavy bell below a wooden beam.
This experiment gives the hanging bell a physically legible pendulum swing,
with a manually delineated mask and a hinge at `(192, 79)` in its original
384px painted key cell.

The motion oscillates at approximately ±8° around the hinge through 24
frames, with mild second/third harmonics to distinguish the forward and
returning arc. The beam, pillars, and ribbons outside the traced bell mask
stay fixed. Frame cells are exported as a **review-only 12×2 lossless WebP
atlas** with 192px cells, matching the existing runtime geometry.

Nothing is deployed to `game/assets/art/hd-painted-v1/`; original artwork,
the old idle clip, original source ZIP, and Roster Keystone keep their exact
SHA-256 receipts. The script compares the existing and candidate idle
motion using the same silhouette-restricted perceptual metric as the
independent seven-boss motion audit. It requires a visible increase in
motion before publishing the candidate.

Run from repo root after installing Pillow and NumPy:

```bash
python -m unittest discover -s game/tools -p test_hd_yearless_pendulum_preview.py -v
python game/tools/hd-yearless-pendulum-preview.py --root . --output-dir artifacts/yearless-pendulum
```

Generated review package:
- `yearless-bell-idle-swing-candidate.webp`, **24 moving frames** in the
  2304×384 lossless atlas
- `yearless-bell-idle-swing-timeline.png`, original painted key and candidate
  at seven timeline points
- `yearless-bell-manual-pivot-mask.png`, the transparent layer isolation map
- `yearless-bell-pendulum-receipt.json`, original/candidate hashes, decoded
  frame hashes, pendulum angles, both perceptual motion scores, foot anchor,
  source pose and sample timing

Manual art review must inspect the hinge, chain attachment, seam, occlusion,
bottom-of-bell sweep, and frame-by-frame visual continuity. Once accepted,
a separate integration would update exactly one runtime clip with its
generated SHA-256 and 24 decoded-frame receipt while preserving gameplay
timing and the pixel-art fallback. No automatic visual approval occurs.
