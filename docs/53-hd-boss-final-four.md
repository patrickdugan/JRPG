# Final Four HD Boss Review Intake

Four separate boss review packages were produced on November 21, 2026, each with six key PNG poses, ten WebP strips of 24 cells each, source SHA-256 receipts, decoded-frame SHA-256 receipts, a contact sheet and GIF preview.

| Boss | Source provenance | Keys | Motion | Full-resolution status |
|---|---|---:|---:|---|
| Magistrate Ujiro Arata | Standalone RGBA painting at 1536×1024 | 6 | 240 cells | Individual HD candidate |
| Bell Warden Chiyo | Small (about 128px-wide) figures cut from comparison poster | 6 | 240 cells | Needs separate premium repaint |
| Lady Enma | Same comparison poster | 6 | 240 cells | Needs separate premium repaint |
| Yearless Bell | Same comparison poster | 6 | 240 cells | Needs separate premium repaint |

**Combined total: 40 clips and 960 source-derived cells.** The downloadable archive is `JRPG_HD_Boss_FinalFour_20261121.zip`, about 36.9 MB, containing four independent ZIP packages.

An intake means the source candidate, key atlas and motion sampler have passed *local integrity tests*. It does not mean the individual animation cells were hand-drawn, the figure silhouette was approved, or the binary assets were committed to GitHub.

## Verified locally

The existing `game/tools/import-hd-boss-pack.py` importer accepted all four packages via `--check`. Sequential imports into a clean temporary checkout produced four identities, 40 distinct clips and 960 decoded frames. The same imports repeated successfully and preserved previous atlas records. The importer checks all SHA-256 receipts, independently decodes every WebP frame, rejects diverging preexisting keys and caps each Git commit below 90 MiB.

## Import images into the Git branch

Check out the optional HD feature branch `feature/hd-boss-final-four-20261121` in an authenticated *local* Git checkout. Extract the four independent ZIP files from the combined archive and run:

```bash
python -m pip install Pillow
python game/tools/import-hd-boss-pack.py /path/to/JRPG_HD_Boss_ujiro_v1.zip --check
python game/tools/import-hd-boss-pack.py /path/to/JRPG_HD_Boss_ujiro_v1.zip --commit --push
python game/tools/import-hd-boss-pack.py /path/to/JRPG_HD_Boss_bell_warden_chiyo_v1.zip --commit --push
python game/tools/import-hd-boss-pack.py /path/to/JRPG_HD_Boss_lady_enma_v1.zip --commit --push
python game/tools/import-hd-boss-pack.py /path/to/JRPG_HD_Boss_yearless_bell_v1.zip --commit --push
```

Every candidate remains tagged `visualApproval: pending` even after importing. The game continues rendering the existing pixel boss clips and attack telegraphs whenever the optional HD asset lane has no usable art.

## Whole cast progress

There are seven named boss review candidates across available ZIP packages: Captain Kaji, Widow of Fog, Furnace Abbot, Ujiro, Chiyo, Enma and Yearless Bell. Four have individual detailed six-pose sources; three use lower-resolution comparison-board crops. Full production-grade animation and visual approval remain separate milestones. The Roster Keystone records the canonical counts of 62 total identities, including 7 playable, 28 regular enemies, 7 named bosses, 4 Kurozane forms and 16 civilian roles.
