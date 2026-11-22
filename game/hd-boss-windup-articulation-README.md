# Two HD boss windup studies

The Yearless Bell and Lady Enma windups currently contain 24 distinct decoded
WebP frames with limited visible variation. This experiment creates alternate
review-only strips from the original, SHA-256-verified six-pose paintings.

**Yearless Bell:** a hand-defined layer isolates the bell from its wooden
support. Over the 24-frame windup the body recoils 15 degrees around a pivot
below the beam while the crossbeam and posts stay fixed.

**Lady Enma:** a hand-defined fan layer rotates 21 degrees clockwise around
the painted wrist, with a progressive local cinder-brightening effect. The
face and feet stay locked. The fan stays attached visually through the selected
pivot but a human must inspect the edge of the sleeve and wrist at full size.

Both candidates are built with the exact original clip lengths, source-pose
indices, foot-anchor metadata, 12×2 WebP packing, and 192px cells. Every
decoded frame receives a SHA-256 receipt. The generator compares foreground
motion to the original windup with the independent perceptual audit and rejects
candidates that fail to increase visible variation.

From the repository root, run:

```bash
python -m pip install 'pillow>=11,<13' 'numpy>=2,<3'
python -m unittest discover -s game/tools -p test_hd_boss_windup_articulation.py -v
python game/tools/hd-boss-windup-articulation.py --root . --output-dir artifacts/hd-boss-windup-studies
```

The output includes candidate lossless WebP motion strips, two timeline contact
sheets comparing each original key painting against the new 24-frame motion,
source layer masks, and a machine-readable provenance/quality receipt.

**These are painted-layer rigging studies.** They are not hand-drawn in-betweens
and must not be presented as approved premium production animation. Original
PNG, WebP, manifest, source ZIP, gameplay timing, hitboxes, and all seven
Roster Keystone visual-approval values remain unchanged. The existing
Lady Enma active clip is already more visually dynamic than its windup and is
retained unchanged pending human review of the attack cutover.
