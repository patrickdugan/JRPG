# Enemy Animation Suite V3

This package adds sixteen original side-view enemy families:

- four recognizably human adversaries;
- eight wholly bestial creatures inspired by Japanese folklore;
- four lethal botanical monsters.

Each family has a 6×4 atlas of 160×160 transparent RGBA cels and a timed,
nearest-neighbor review GIF.

## Human adversaries

| ID | Enemy | Combat lesson | Signature |
| --- | --- | --- | --- |
| HUM-001 | Mourning Ronin | committed human duelist | `last-vow-draw` |
| HUM-002 | Court Arquebusier | ranged line pressure | `ash-match-volley` |
| HUM-003 | Veil Courier | smoke-assisted reposition | `smoke-relay` |
| HUM-004 | Provincial Banner Guard | formation defense | `banner-wall` |

The humans retain ordinary anatomy, visible Japanese faces, and grounded
early-17th-century clothing or equipment. The revised Provincial Banner Guard
uses Japanese `tōsei-gusoku` construction: lacquered `dō`, `kusazuri`, `sode`,
`kote`, `haidate`, `suneate`, an open-faced `kabuto`, `sashimono`, and `yari`.
It does not reuse the Western plate silhouette or oni-mutant anatomy of the
earlier experimental guard.

## Mythic beasts

| ID | Enemy | Folklore inspiration | Signature |
| --- | --- | --- | --- |
| BST-001 | Storm Nue | nue chimera | `storm-tail` |
| BST-002 | Dream Baku | baku dream-eater | `dream-vacuum` |
| BST-003 | Twin-Tail Nekomata | nekomata | `twin-flame-lash` |
| BST-004 | Silk Jorogumo | jorōgumo spider lore | `silk-prison` |
| BST-005 | Sickle Weasel | kamaitachi | `crosswind-dash` |
| BST-006 | Drum Tanuki | tanuki | `belly-drum-quake` |
| BST-007 | Marsh Kappa-Beast | kappa | `shell-surge` |
| BST-008 | Ushi-Oni Behemoth | ushi-oni | `earth-gore-charge` |

These are original game reinterpretations, not claims of a single canonical
folklore appearance. They remain animals or animal monsters: no human torsos,
costumes, or pseudo-humanoid oni bodies.

## Lethal plants

| ID | Enemy | Silhouette | Signature |
| --- | --- | --- | --- |
| PLT-001 | Black Chrysanthemum Nest-Woman | adult serpent-woman nested in one giant bloom | `black-bloom-devour` |
| PLT-002 | Razor Bamboo Stalker | mobile rhizome and telescoping culms | `razor-canopy` |
| PLT-003 | Spider-Lily Ambusher | crawling bulbs, root legs, and stamen whips | `crimson-pollen-ambush` |
| PLT-004 | Lantern-Vine Maw | bioluminescent flower lure and snapping bloom | `false-lantern-lure` |

The Nest-Woman is an adult, non-sexualized floral horror design. Her upper body
is covered by petal-and-leaf armor, her lower body is a serpentine vine, and the
chrysanthemum closes around her for the defeated hold.

## Sheet contract

Every atlas is 960×640 pixels with six columns and four rows:

1. `locomotion` — contact, compression, passing, extension, second contact,
   ready;
2. `basic-attack` — ready, anticipation, commitment, active, follow-through,
   recovery;
3. `signature-attack` — ready, anticipation, charge, active, recoil, recovery;
4. `hurt-defeat` — hurt contact, compression, stagger, collapse, defeated,
   defeated hold.

Damage and signature events occur on frame 3 of their respective rows. Root
motion belongs to the runtime. The source contract records timings, pivots, foot
points, generic hurt bounds, facing, and provenance.

## Production classification

The boards in `sources/` are AI-generated stylized animation concepts created
with Codex built-in image generation on a flat magenta chroma background.
Transparent versions were produced with the image-generation skill’s local
chroma-removal helper. Purple-heavy families use a tightened matte tolerance to
preserve violet anatomy.

The runtime atlases are:

- classified as `deterministically pixelified`;
- **not pixel-authored**;
- BOX-resampled without dithering;
- palette-bounded to at most 64 visible colors per family;
- binary-alpha with values 0 and 255;
- 160×160 per cel with a minimum two-pixel transparent gutter.

## Build and verify

Install the pinned dependency:

```powershell
python -m pip install -r requirements.txt
```

Build or verify:

```powershell
python build_enemy_animation_suite_v3.py
python build_enemy_animation_suite_v3.py --check
```

The V3 entry point reuses the verified V2 atlas implementation while supplying
its own source contract, versioned filenames, sixteen-family contact layout,
builder hash, and manifest.

## Runtime integration

Begin review with `enemy-animation-roster-contact-sheet-v3.png`, then inspect
the `*-all-actions-v3.gif` files. The `*-atlas-v3.png` files are transparent
runtime candidates.

Before promotion, tune per-encounter scale and verify pivots, hurt boxes, attack
hit boxes, projectile paths, VFX anchors, root motion, and event timing against
the side-scroll combat camera. This art package does not modify combat runtime
code.
