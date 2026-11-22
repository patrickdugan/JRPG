# Four-boss reversible matte preview experiment

Run from the repository root after installing Pillow:

```bash
python -m pip install 'pillow>=11,<13'
python -m unittest discover -s game/tools -p test_hd_boss_matte_proposals.py
python game/tools/hd-boss-matte-proposals.py --root . --output-dir artifacts/hd-boss-matte-proposals
```

The default targets are **Lady Enma** (dark charcoal matte), **Furnace
Abbot** (light checkerboard / smoke edge hypothesis), **Yearless Bell**
(pale fringe hypothesis), and **Captain Kaji** (bright salt-spray edge
hypothesis). The latter two may have substantial intentional bright
effects. There is no shared global matte setting or automatic approval.

Only semi-transparent neutral-colored edge pixels with an opaque neighbor
within two pixels are eligible. The strict contrast profile determines
which RGB values receive the alternative nearest-interior color.
**The alpha channel remains byte-for-byte unchanged.**

For each boss the tool writes:
- `comparison-<boss>.png`: all six key poses before and proposed after,
  each on dark and parchment backgrounds
- `proposed-<boss>.png`: review-only candidate transparent six-key PNG
- `hotspots-<boss>.png`: red mask indicating every changed RGB pixel
- `proposals.json`: original and proposed SHA-256, identical alpha-channel
  hashes, and per-pose changed-pixel counts

Generated images are **CI artifacts only**. None enters the game asset
directory or modifies the existing six-key atlas manifest, WebP motion
clips, animation hashes or Roster Keystone. Existing animations still
refer to the exact original source atlas.

The experiment cannot repair any opaque original matte region and may
misidentify deliberate white smoke, ink shadows and magical effects.
Inspect the images at full size, then test a separately approved source
rewrite against the full seven-boss integrity and real gameplay backdrop
gate. Every named boss remains `visualApproval: pending`.
