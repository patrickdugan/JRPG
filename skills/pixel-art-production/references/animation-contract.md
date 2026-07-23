# Pixel-animation contract

Use this contract for action clips, sprite sheets, GIF previews, and runtime atlases.

## Geometry

Define before authoring:

- native frame width and height;
- grid columns and rows;
- pivot and foot point;
- minimum transparent gutter;
- facing convention;
- root-motion ownership;
- weapon and VFX overflow policy.

All frame rectangles must be integer-aligned. Review previews must use integer nearest-neighbor scaling.

## Action phases

Movement clips should expose contact, compression, passing, and airborne or extension phases.

Attacks should expose:

1. anticipation or wind-up;
2. commitment;
3. active contact frame;
4. recoil or follow-through;
5. recovery.

Record the exact damage-event frame separately from the artwork. A large VFX frame must still preserve the attacker silhouette unless an authored full-screen effect explicitly owns the shot.

## Consistency

Check across every frame:

- identity, proportions, costume, palette, and facing;
- weapon length, grip, and motion arc;
- foot placement relative to the pivot;
- body volume through squash and stretch;
- hair, cloth, chain, and ribbon follow-through;
- no neighboring-cell bleed;
- readable pose at 1x without labels.

## Runtime evidence

Store in a manifest:

- action and frame order;
- frame durations;
- pivot, foot point, hit anchor, and hurt bounds;
- wind-up, active, and recovery phases;
- event name and frame index;
- source and frame hashes;
- atlas dimensions and alpha policy.

GIFs are review artifacts. They do not replace runtime timing, hitbox, root-motion, or event data.
