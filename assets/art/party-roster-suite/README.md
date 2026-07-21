# Deterministic party roster key art

This player-facing 1440 × 900 pixel-art composition is built entirely from the authored party combat atlas. It replaces the obsolete generated roster on live Campaign chapters. The third row retains the internal compatibility key `lise`, but its visible/source identity is Croatian hunter Nikola Dražanić.

- `party-roster-suite.source.json` fixes dimensions, row order, presentation names, and input contracts.
- `party-roster-key-art.png` is the runtime image.
- `manifest.json` records all source and export hashes.
- The composition contains no lettering, real-person likeness, generated-raster input, or sacred-object prop.

Run `python build_party_roster_suite.py` to rebuild or `python build_party_roster_suite.py --check` to byte-compare generated outputs.
