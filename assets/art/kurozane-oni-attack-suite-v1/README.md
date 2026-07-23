# Shogun Kurozane — Oni attack suite v1

This package extends the approved Kurozane final-battle identity with five
player-readable Oni attack clips:

| Clip | Frames | Total authored timing | Active behavior |
| --- | ---: | ---: | --- |
| `oni-gauntlet-swipes` | 6 | 870 ms | Two discrete swipe hits |
| `oni-predator-jump` | 6 | 920 ms | Runtime-owned jump and landing shockwave |
| `oni-spear-wheel` | 6 | 890 ms | Three spear-spin damage pulses |
| `oni-mouth-cannon` | 6 | 570 ms | Flicker on/off, pre-flash bulge, instant column, snap-off |
| `oni-chest-spiral-barrage` | 12 | 2,350 ms | Mechanical plate opening, three fireball launches, radial burst, relock |

The chest opening is mechanical armor movement, not a wound. The source and
runtime contracts explicitly prohibit graphic gore.

The revised mouth cannon is deliberately not a sustained laser or fireball. Its
tell flickers, briefly disappears, swells just outside the menpo, then becomes a
single hard-edged horizontal column for one 60 ms active frame before snapping
off. Palette generation remains pinned to the original v1 source segments so
mouth-cannon revisions cannot recolor unrelated clips.

## Runtime geometry

- Atlas: 960 × 960
- Grid: 6 columns × 6 rows
- Native cel: 160 × 160
- Facing: screen-left
- Root motion: runtime simulation
- Palette: no more than 64 visible RGB colors
- Alpha: binary
- Transparent gutter: at least two pixels

The first four clips each own one atlas row. The twelve-frame chest barrage owns
the final two rows. `manifest.json` is authoritative for frame timing, phases,
events, pivots, foot points, and hurt bounds; GIFs are review artifacts.

## Build

```powershell
python -m pip install -r requirements.txt
python build_kurozane_oni_attack_suite.py
python build_kurozane_oni_attack_suite.py --check
```

`--check` rebuilds all generated artifacts in memory and requires byte-identical
outputs.

## Provenance

The two full-resolution keyframe boards are AI-generated stylized animation
concepts made with the built-in image-generation surface. Their transparent
sources were produced through chroma-key removal. The runtime atlas is a
deterministic BOX-resampled, palette-bounded derivative. It is not claimed as
hand-pixeled or pixel-authored work.

Before runtime integration, bind the five clip IDs to Kurozane's canonical phase
controller, author gameplay hitboxes and projectile trajectories from the
declared events, then verify jump root motion, spear reach, beam lanes, and
spiral-fireball readability in the live renderer.
