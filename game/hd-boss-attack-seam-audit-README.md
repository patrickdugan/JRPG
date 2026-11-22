# Yearless Bell and Lady Enma: windup to active cutover audit

The two painted-layer windup studies from PR #24 increased visible motion.
This audit examines the exact frame where each new windup would meet the
currently committed active-attack WebP. Both original and proposed windups
are compared with the same immutable active clip from the source manifest.

The diagnostic first re-generates the two candidate WebPs from the pinned
six-key paintings and verifies all 24 decoded-frame SHA-256 receipts.
For each boss it measures:

- The image change from windup frame 24 to original active frame 1
- The change from windup frame 23 to 24 and from active frame 1 to 2
- Full 48x48 grayscale difference on a neutral background
- Foreground-union grayscale difference, silhouette alpha overlap, and
  silhouette centroid displacement in original 192px cell coordinates

Outputs include a per-boss PNG with the four last windup cells and four
first active cells in two separate rows, one using the original windup
and one using the proposal. A side-by-side animated GIF plays the actual
last eight windup frames followed immediately by the first eight active
frames. The GIF uses playback slowed relative to source frame times.

A candidate-to-original seam ratio above 1.15 flags further manual
inspection. This is a diagnostic queue threshold rather than a release
criterion. The current active-attack body painting may differ from the
windup key painting, especially around Yearless Bell's chain attachment
and Lady Enma's fan and sleeve. Only close inspection can establish
whether a phase boundary conveys a readable attack.

Run from repository root after installing Pillow and NumPy:

```bash
python -m unittest discover -s game/tools -p test_hd_boss_attack_seam_audit.py -v
python game/tools/hd-boss-attack-seam-audit.py --root . --output-dir artifacts/hd-boss-attack-seams
```

The original PNGs, source ZIPs, every runtime WebP and SHA manifest, attack
hitboxes/timing, and all seven canonical visual-approval values are
unchanged. The generated animations remain separate human-review artifacts.
