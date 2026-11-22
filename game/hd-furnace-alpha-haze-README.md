# Furnace Abbot faint alpha haze experiment

The existing verified six-pose atlas contains low-opacity background speckle
outside the painted figure, giving it a checker-like haze over charcoal.
This experiment makes a **reversible, review-only alpha proposal**. It leaves
the original Git PNG, source painting, animations, and Roster Keystone intact.

The algorithm considers only pixels whose original alpha is 1–12. It keeps
those pixels when any alpha 192+ pixel lies within an eight-pixel square
guard radius **in the same 384×384 pose**. Remaining faint pixels are cleared.
All RGB bytes remain identical, including transparent pixels. Dense smoke,
edge anti-aliasing near opaque objects, fire, and painted fabric are protected
by the threshold or proximity rule. The algorithm can still remove intended
ultra-faint ambient smoke, so it requires human approval. A 12.5% per-cell
change cap rejects unexpectedly diffuse replacement operations.

Run:
```bash
python -m pip install 'pillow>=11,<13'
python -m unittest discover -s game/tools -p test_hd_furnace_alpha_haze.py -v
python game/tools/hd-furnace-alpha-haze.py --root . --output-dir artifacts/hd-furnace-alpha-haze
```

Output files are strictly CI/download artifacts:
`furnace-abbot-alpha-before-after.png` has six poses before/after on both
charcoal and warm paper; `furnace-abbot-alpha-candidate.png` is the proposed
RGBA atlas; `furnace-abbot-alpha-hotspots.png` marks cleared pixels;
`furnace-abbot-alpha-receipt.json` preserves SHA-256 of the original painting,
original key atlas, and candidate, plus per-pose changes and the exact guard
parameters.

The six-pose and motion atlas manifest remains pointed at its original key
hash. Existing WebP strips are source-derived motion studies. No automatic
replacement or visual-approval promotion is performed.
