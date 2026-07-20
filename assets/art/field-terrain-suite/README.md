# Field terrain overlay suite

This directory contains one original, deterministic 16 x 16 transparent pixel overlay for the default field floor and every terrain tag used by the 48 live Campaign levels. The browser first paints the existing level-owned flat color, then may composite the matching overlay; art never becomes movement, collision, hazard, exit, or interaction authority.

`field-terrain-suite.source.json` owns the exact live tag order and boundaries. `build_field_terrain_suite.py` produces the transparent runtime atlas, a labeled review-only contact sheet, the manifest, and the byte-identical browser copy. Run it with `--check` to prove checked-in outputs are current.

Unknown tags, image failure, or a wrong-size image retain the existing flat-color/geometric renderer. The motifs are secular material reads only: paving, water, wood, ash, metal, paper, and invented court hardware. They contain no sacred objects, devotional symbols, real heraldry, text, or readable historical documents.
