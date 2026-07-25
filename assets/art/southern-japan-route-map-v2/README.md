# Southern Japan Route Map v2

An original late-32-bit tactical-atlas route selector for the journey from
Nagasaki to Kyoto (Miyako). The simplified geography distinguishes Kyushu,
western Honshu, Shikoku, Awaji, the Seto Inland Sea, and Osaka Bay. Its revised
material pass uses aged vellum, sepia cartographic ink, restrained mineral
pigments, relief hachures, tide lines, fold wear, stains, and illuminated border
ornament.

The route graph exposes three materially different passages:

- **Direct Sea Passage** — quickest and most volatile; sails through Kanmon and
  the Inland Sea, lands at Sakai, then completes the inland climb to Kyoto.
- **Northern Road** — the balanced post-road and testimony route across northern
  Kyushu and the San'yo corridor.
- **Southern Passage** — the longer supplied route through Shimabara, Bungo,
  Shikoku, and Awaji.

## Production contract

- Native map size: `480x270`
- Review preview: exact `3x` nearest-neighbor enlargement
- Icon atlas: ten `24x24` cells with binary alpha
- Map alpha: fully opaque
- Root geometry: integer native pixels
- Palette: bounded by the explicit source palette
- Runtime choice: emits a frozen, noncanonical receipt; it does not write
  campaign or browser storage

This is classified as a **pixel-authored production asset**: the landforms,
vellum grain, relief, hachures, water pattern, route ribbons, iconography, and
labels are built from editable code-native pixel primitives at final
resolution. No generative image model was used. The work invokes a general
late-32-bit tactical-atlas mood; it does not copy Final Fantasy Tactics artwork,
interface assets, map geometry, or proprietary motifs.

## Rebuild and verify

```powershell
python build_southern_japan_route_map.py
python verify_southern_japan_route_map.py
python build_southern_japan_route_map.py --check
```

Authored source lives in `southern-japan-route-map.source.json`. `manifest.json`
records source, builder, output, geometry, alpha, route, palette, and SHA-256
receipts.
