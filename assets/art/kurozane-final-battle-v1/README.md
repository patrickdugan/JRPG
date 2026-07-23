# Shogun Kurozane — portrait and final-battle kit v1

This package prepares the approved Kurozane identity for Chapter 9 dialogue and
the canonical final encounter. It contains eight portrait expressions and four
six-frame battle clips:

- `court-command`
- `yearless-thrust`
- `blood-eclipse-transform`
- `black-chrysanthemum-defeat`

The last clip resolves to a living, ward-broken Kurozane. It is deliberately not
a death loop.

## Runtime geometry

| Asset | Grid | Frame | Atlas |
| --- | ---: | ---: | ---: |
| Portrait expressions | 8 × 1 | 128 × 128 | 1024 × 128 |
| Final-battle clips | 6 × 4 | 160 × 160 | 960 × 640 |

Both runtime atlases use binary alpha, at least a two-pixel transparent gutter,
no dithering, and no more than 64 visible RGB colors. GIFs and labeled contact
sheets are review artifacts; the timings, events, pivots, feet, and hurt bounds
in `manifest.json` are authoritative for integration.

## Build

Install the pinned dependency and build from this directory:

```powershell
python -m pip install -r requirements.txt
python build_kurozane_final_battle.py
python build_kurozane_final_battle.py --check
```

`--check` rebuilds the package in memory and verifies that every generated
artifact is byte-identical.

## Provenance

The full-resolution source boards are AI-generated stylized concepts. Their
transparent sources were produced through chroma-key removal. The runtime
candidates are deterministic BOX-resampled, palette-bounded derivatives; they
are not claimed as hand-pixeled or pixel-authored work.

The build contract is `kurozane-final-battle.source.json`, while `manifest.json`
records source and artifact hashes, frame records, animation phases, events,
anchor profiles, alpha values, palette counts, and the remaining runtime-binding
work.
