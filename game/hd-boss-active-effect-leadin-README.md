# Two boss attack-effect lead-in experiments

The source-verified attack-seam audit (PR #25) showed large frame jumps
between each articulated windup and the original active-attack painting.
The Yearless Bell jumps from a recoiling bell to the large purple ring,
while Lady Enma changes her full-body stance as the flame arc appears.

This optional study introduces **only the colored effect pixels present
in the existing active-attack frame one** during windup frames 17-24.
The Yearless Bell profile selects purple emissions; Lady Enma selects
bright orange cinders. The manually tuned color/spatial thresholds also
require the corresponding candidate windup region to have alpha below
128, so opaque character and bell body regions are protected.

The effect ramps in with smoothstep; the first 16 frames remain byte-
identical to the source-derived windup candidate. The output retains the
exact 2304x384 lossless WebP layout, 24 decoded frame hashes, and existing
windup frame timing. The unchanged active attack remains the destination
at the frame-24-to-frame-1 boundary.

CI regenerates both source windups from the original verified painted PNGs,
verifies both original active WebP SHAs, then measures the candidate-to-active
cutover with the independent optical seam auditor. Each effect preview must
improve foreground transition delta against its immediate source candidate.

Use the downloadable effect-only mask and side-by-side transition GIFs
to inspect for floating magical effects, occlusion, and flicker. The
experiment **does not retarget the body posture**. Yearless Bell needs
a painted bell-release body key, and Lady Enma needs a new pose sequence
connecting her raised fan with the sweeping active-attack stance.

Run from repo root:

```bash
python -m unittest discover -s game/tools -p test_hd_boss_active_effect_leadin.py -v
python game/tools/hd-boss-active-effect-leadin.py --root . --output-dir artifacts/hd-active-effect-leadin
```

Original PNG, WebP, source ZIP, runtime manifests, hitboxes, attack time,
and all seven visual approvals remain untouched and pending. No study
is automatically promoted to production.
