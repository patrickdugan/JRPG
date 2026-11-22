# Boss HD archive source binaries

This directory contains Git-tracked pieces of the original high-resolution painted boss ZIP archives.
Every `part-*.bin` is an exact contiguous slice of the archive, at most **1,500,000 bytes** each. This is a transport container, and the user's original PNG/WebP sources are preserved within.

Run `python game/tools/hydrate-hd-boss-binary-packages.py --extract-dir /tmp/hd-boss-archives --import-check` to check all part-level Git hashes, reconstructed ZIP SHA-256 hashes and full 24-frame raster manifests.

`manifest.json` keeps `readyForImport:false` until **Lady Enma, Bell Warden Chiyo and Yearless Bell** are uploaded. The hosted importer will then commit unpacked atlases in individual under-90-MiB commits to the existing `?art=hd` presentation lane. All are review candidates and retain pending visual approval; source-derived clip frames remain distinguished from independently painted in-betweens. The original pixel boss motion remains the default fallback.
