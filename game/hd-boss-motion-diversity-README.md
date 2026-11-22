# Seven-boss perceptual-motion audit

The existing integrity tests establish **70 individual 24-frame WebP clip
files** and verify 1,680 distinct decoded-frame SHA-256 receipts. They cannot
prove that the generated frame images differ visibly. This audit reads exactly
those original WebP atlas cells and evaluates their appearance over a neutral
background, ignoring arbitrary RGB changes in fully transparent pixels.

Run from the repository root:

```bash
python -m pip install 'pillow>=11,<13' 'numpy>=2,<3'
python -m unittest discover -s game/tools -p test_hd_boss_motion_diversity.py -v
python game/tools/hd-boss-motion-diversity.py --root . --output-dir artifacts/hd-motion-diversity
```

Outputs in GitHub Actions artifacts:
- `motion-timeline-<boss>.png`, seven large contact sheets showing ten clips
  and seven chronological image samples (frames 1, 5, 9, 13, 17, 21, 24)
- `motion-metrics.json`, grayscale and alpha-based movement measurements,
  alignments against frame one and hashes of every source WebP
- `motion-report.md`, near-static ranking and a manual-review queue

Perceptual motion is measured by grayscale mean absolute difference after
compositing each frame onto an identical RGB backdrop. A 48×48 thumbnail
suppresses subpixel quantization noise. A second metric averages changes inside the union of the first and selected silhouettes, so articulated limbs do not disappear into empty background. Thumbnail shift alignment over ±3
pixels estimates how much change a rigid translation can explain. Bounding
box centroid travel provides a second descriptive measure.

The experimental flags `nearStaticReviewCandidate` and
`rigidShiftReviewCandidate` are **triage heuristics**, not a graded quality
standard. Small breathing loops can be appropriate; intended windup,
signature and active motions warrant articulated body changes and readable
attack silhouettes.

All seven canonical `visualApproval` fields remain pending. Original source
PNG/WebP files, their SHA-256 receipts, action-combat timing, and hitboxes are
never modified. The next art direction decision should use the real timeline
boards before spending compute on new in-betweens.
