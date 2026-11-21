# Optional HD painted sprites and encounter cards

This path is the local destination for the separately distributed painted-art ZIP. It contains 12 high-resolution raster six-pose sheets under `sheets/` and four illustrated cards under `cards/`, each declared in `manifest.json`.

Install from the pack with `python tools/install_hd_art.py /path/to/JRPG`, or from this checkout using `python game/tools/install-hd-painted-art.py /path/to/unpacked/JRPG_HD_Engine_Integration_v1`. The installer verifies the binary SHA-256 before copying.

Open an Action Campaign battle with `?art=hd` to opt into the new sprites. If the art is missing or invalid, the normal animated pixel sprites appear. The card links in the HOSTILES panel are shown only when the associated painted sprite is loaded and its card exists.

The PNGs are painted keyframe illustrations, not authored SVG vectors or completed 20–30-frame animation clips. Kurozane's transformation study stays outside the automatic action sampler until boss-phase mapping is reviewed.
