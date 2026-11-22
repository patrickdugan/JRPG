# Seven-boss optical QA diagnostics

The image audits read the **seven original paintings**, the preserved six-key
PNG atlases and all **70 committed 24-frame WebP motion atlases**, verify their
SHA-256 receipts, and output measurements for a human to inspect.

Run from the repository root:

```bash
python -m pip install 'pillow>=11,<13'
python -m unittest discover -s game/tools -p test_hd_boss_art_diagnostics.py -v
python game/tools/hd-boss-art-diagnostics.py --root . --output-dir artifacts/hd-boss-optical-diagnostics
```

The hosted GitHub workflow creates a **numerical report**, machine-readable
`metrics.json`, and **seven pose contact sheets** (one per named boss, all
six key poses over dark and warm-paper backgrounds). No network access or
generation model is used for these measurements.

The bright/charcoal edge detectors inspect semi-transparent pixels near opaque
silhouettes. White fabric, black ink and deliberately light effects can cause
false positives. The score is a **review queue**, not an objective matte
quality metric. All inputs remain unchanged; the script refuses to proceed
if any canonical `visualApproval` value has moved beyond `pending`.

The 24-frame temporal audit decodes every 192×192 WebP cell and rechecks its
RGBA SHA-256 against the already-committed manifest. It measures adjacent
mean RGB change over a neutral backing, bounding-box foot-anchor displacement
and loop-seam change. Automatic seam flagging is restricted to `idle`,
`locomotion`, and `guard` clips, because windup/attack/recovery/defeat
animations are intentionally non-cyclic.

**Interpretation:** judge discontinuities in the browser art review studio
(`cd game && npm run review:serve`) and check the fallback game renderer at
`?art=hd`. First inspect Lady Enma, Yearless Bell and Furnace Abbot for
matte artifacts; all seven still require a manual approval decision. Confirm
visual changes against the original immutable SHA-256 receipts before promoting
any repaired candidate art.
