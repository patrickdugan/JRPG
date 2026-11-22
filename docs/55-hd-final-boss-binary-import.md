# Premium HD boss archives: exact Git binary import

Three new, individual 1536×1024 painted six-pose sources are delivered for **Lady Enma, Bell Warden Chiyo and Yearless Bell**. Each is accompanied by six transparent PNG key poses and ten 24-cell WebP action clips. Their complete original ZIPs are committed to Git as contiguous **1.5 MB binary blobs**, referenced by a machine-verifiable manifest.

| Boss | Original archive | Git binary bytes | Chunks | Clips | Derived cells |
| --- | --- | ---: | ---: | ---: | ---: |
| Lady Enma | JRPG_HD_Boss_lady_enma_v2.zip | 12,561,500 | 9 | 10 | 240 |
| Bell Warden Chiyo | JRPG_HD_Boss_bell_warden_chiyo_v2.zip | 10,742,579 | 8 | 10 | 240 |
| Yearless Bell | JRPG_HD_Boss_yearless_bell_v2.zip | 13,319,588 | 9 | 10 | 240 |
| **Total** | | **36,623,667** | **26** | **30** | **720** |

Binary parts live under `assets/art/hd-boss-binary-import-v1/<boss>-v2/`, each under 1.5 MB. The exact original ZIP SHA-256 and every Git blob SHA-1 are recorded in the companion manifest. This avoids manually copying hundreds of image files into Git API calls.

## Verification

```bash
python -m pip install Pillow
python game/tools/hydrate-hd-boss-binary-packages.py --require-complete --extract-dir /tmp/jrpg-hd-bosses --import-check
node --test game/tests/hd-boss-binary-manifest.test.mjs
```

The repo's existing strict importer verifies key PNG geometry, SHA-256 for source and animation strips, 24 decoded-frame hashes per motion clip, and all character IDs. The Git workflow runs these checks before importing any runtime files. For each boss, the importer creates a separate Git commit of less than 90 MiB, copying the original painting to the review source folder and writing playable atlas PNGs and WebP strips to `game/assets/art/hd-painted-v1/`.

The Roster Keystone differentiates **original archives in Git**, **runtime images committed**, and **manual visual approval**. New generated cels are rigid/deformation studies, not hand-drawn key-by-key animation. Yearless Bell's white background was matted into transparency and still requires silhouette cleanup; Lady Enma likewise needs charcoal matte review. Chiyo has an authored alpha background.

The existing boss pixel-body animations, telegraph geometry, phase director, hitboxes, saves and outcomes are unchanged. Optional runtime art is selected with `?art=hd`.

## Production status

All seven named boss identities now have six-pose source candidates. The earlier Captain Kaji, Widow of Fog, Furnace Abbot and Ujiro packages remain separate unless they have independently been imported. The three newly stored premium archives above contain the complete original source and actual derived motion binaries.
