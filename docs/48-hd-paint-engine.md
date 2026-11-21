# HD Painted Art: Action Campaign Integration

The side-view action battle renderer now has a reversible, opt-in painted animation lane. Open
\`game/action-campaign-battle.html?encounter=c1-cinder-hounds&lead=ren&support=miyo&art=hd\`
on the game's normal HTTP server to preview it. Without \`art=hd\`, the original
pixel sprites and all their timing remain the default.

The \`game/hd-painted-animation.mjs\` loader reads a local \`manifest.json\`,
loads only needed character atlases, checks exact image dimensions, selects
one of six authored poses from the simulation's existing windup, active,
recovery, movement, hit and defeat states, and draws the image at the existing
foot anchor. Missing, invalid, or wrong-size sheets use the normal game
sprite path. Collision, hitboxes, objectives, progression and saved state are
unchanged.

The companion \`JRPG_HD_Engine_Integration_v1.zip\` includes 72 painted
key poses for seven party members, four enemies, and an unmapped Kurozane
form study. The 12 RGBA atlases are each 2304x384, containing six 384x384
frames. The boss form art is deliberately not auto-mapped onto ordinary
attack phases. These are generated raster illustrations, not native editable
SVG, and the six poses are a production study rather than finished in-betweens.

Extract the ZIP and run \`python game/tools/install-hd-painted-art.py
/path/to/extracted/JRPG_HD_Engine_Integration_v1\` from a JRPG checkout on
this branch. The installer checks the SHA-256 of every copied atlas and writes
only into \`game/assets/art/hd-painted-v1/\`.

The canvas records data-hd-art-mode, data-hd-art-state and
data-hd-art-draw-count for browser validation. Before shipping the
art as default, review native-size pose alignment, cell-boundary
clipping, effects and Cinder Hound matte edges, then add more
in-between frames and run a full campaign acceptance test.
