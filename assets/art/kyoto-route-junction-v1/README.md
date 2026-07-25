# Kyoto Route Junction v1

An original action-platformer-style route commitment scene for the Nagasaki to
Kyoto campaign selector. The party stands on a shared wayside landing and
physically approaches one of three exits:

- down-left to the wet harbor stair for the Direct Sea Passage;
- up the central shrine stair for the Northern Road;
- down-right through a vermilion gate for the Southern Passage.

The interaction borrows only the general design grammar of committing to a
branch by walking onto a staircase. It does not copy Castlevania III artwork,
stage geometry, sprites, tiles, UI, or proprietary motifs.

## Production contract

- Native scene: `320x180`, opaque
- Review preview: exact `4x` nearest-neighbor enlargement
- Duo atlas: eight `16x24` frames, binary alpha
- Sprite pivot: bottom-center
- Palette: bounded by the explicit source palette
- Root geometry: integer native pixels
- Choice output: frozen, noncanonical route receipt

This is a **pixel-authored production asset**. Scene architecture, route
geometry, backgrounds, props, and duo sprites are editable code-native
primitives authored at final resolution. No generative image model was used.

## Rebuild and verify

```powershell
python build_kyoto_route_junction.py
python verify_kyoto_route_junction.py
python build_kyoto_route_junction.py --check
```
