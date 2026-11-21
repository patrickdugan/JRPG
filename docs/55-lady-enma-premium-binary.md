# Premium Lady Enma: standalone painted animation and Git binary intake

Lady Enma now has an individual 1536×1024 painted six-pose source, replacing her previous small comparison-board body. The original charcoal studio background was matted to alpha while preserving her black-red fan, robe, mask, hair ornaments, and cinder effects. The downloadable package is JRPG_HD_Boss_LadyEnma_Premium_v2.zip.

The pack contains six isolated 384×384 PNG poses, one 2304×384 six-key sheet, ten 24-cell WebP motion clips, 240 decoded-frame hash receipts, original source art, and a review GIF/contact sheet. The in-betweens use foot-anchored pose deformation and await manual articulation and final art approval.

## Git binary transfer proof

The first real animation asset was committed under game/assets/art/hd-painted-v1/motion/lady-enma/idle.webp. Its SHA-256 is 44e0fa74aa636ad7d831ed5de4e3bbe7adac4a4e60f9bd2ca5b498d9f5f0ca4c, and the Git blob SHA is 10e65340d18b6b3abbe4d0444eee8715ad404dc3. This is an actual 387126-byte WebP, transferred byte-for-byte and verified against the local image.

Nine motion strips, the six-key source atlas and the original painting remain distributed in the ZIP. The optional HD root manifests have intentionally not been installed into this branch while assets are incomplete; legacy boss sprite fallback stays intact.

The corrected ZIP was accepted by the local guarded importer with ten clips, 240 source-derived frames and 9,805,234 bytes planned for one batch. For an authenticated local Git checkout:

    python game/tools/import-hd-boss-pack.py /path/to/JRPG_HD_Boss_lady_enma_v2.zip --check
    python game/tools/import-hd-boss-pack.py /path/to/JRPG_HD_Boss_lady_enma_v2.zip --commit --push

The Roster Keystone records the partially transferred source without implying final visual approval.

## Remaining mechanical boss work

Yearless Bell still uses a smaller source cut from a comparison board. Its original pixel boss sequence and generated spell VFX continue to work; its premium standalone painted body still needs a six-pose redraw. Several Yearless render attempts returned promotional status posters and were excluded from the asset inventory. Chiyo's standalone high-resolution repaint is also awaiting its binary Git import.
