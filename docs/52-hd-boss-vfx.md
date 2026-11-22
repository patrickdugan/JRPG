# Boss HD presentation effects: source-authoring pass

Developer-only visual effects for six named bosses with pending premium painted
body masters: Widow of Fog, Furnace Abbot, Magistrate Ujiro Arata, Bell Warden
Chiyo, Lady Enma of Ash, and Yearless Bell.

## Exact deliverable

- 12 RGBA PNG atlases, windup and active stages for each boss
- 12 independent 256-by-256 cells per atlas = **144 effects**
- Deterministic SHA-256 receipts for files and decoded frames in
  game/assets/art/hd-boss-vfx-v1/manifest.json
- Generator: game/tools/build-hd-boss-vfx.py
- Review page: game/hd-boss-vfx-review.html
- Optional combat canvas overlay under the existing ?art=hd setting

| Boss | Windup | Active effect | Named game attacks |
| --- | --- | --- | --- |
| Widow of Fog | converging lunar mist | widening tide filaments | Name Drag / Receding Call |
| Furnace Abbot | furnace vents heat | forge sparks, strike ring | Hammer Decree / Forge Sermon |
| Ujiro Arata | vermilion court writs | stamped sealing orders | Gavel Line / Seizure Order |
| Bell Warden Chiyo | taut brass chain | resonant bell pulses | Chain Cast / Ringing Count |
| Lady Enma | cinder fan ribs | flame arc and ash petals | Cinder Parasol Wing / Paired Ashes |
| Yearless Bell | temporal nodes | violet rings | Yearless Ring |

These are newly generated **presentation VFX**, separate from high-resolution
painted character bodies. Existing boss clips already supply the complete
fight loops. The kernel continues to determine attack timing and hitboxes,
while the previously authored telegraphs remain authoritative for safe
and dangerous tiles.

### Verification

    python -m pip install pillow
    python game/tools/build-hd-boss-vfx.py
    python game/tools/build-hd-boss-vfx.py --check
    node --test game/tests/hd-boss-vfx.test.mjs

Hosted CI rebuilds, validates, browser-previews and commits the generated art.
The Roster Keystone separately tracks effects and premium body status.

### Premium art remaining

A high-resolution six-pose Widow of Fog candidate was generated in the
current ChatGPT conversation and is held for visual review and binary import.
The other five named bosses still require concept-quality six-key body art,
character-specific in-betweens, anchored cels and human art approval.

## Immediate Git availability

Twelve SVG strips with 12 editable frame groups each are committed directly
under game/assets/art/hd-boss-vfx-v1/vector-sources, along with the
source-manifest.json Git-blob inventory. The browser loader and review studio
prefer the source-generated PNG strips once they are committed, and render
these editable SVG strips as the fallback in the meantime.

## Furnace Abbot premium-body candidate

The six-key painted Furnace Abbot candidate has its own checked pack: JRPG_HD_Boss_FurnaceAbbot_v1.zip. It contains a 1536×1024 original image, six 384×384 alpha-extracted keys, ten 24-frame WebP atlases, and an install/check script. The six-key source and the resulting motion are available in the conversation artifact and await binary Git import; no claim of body-art approval is made. See assets/art/roster-keystone/furnace-abbot-hd-intake.json for exact file SHA-256 receipts. The existing Furnace Abbot v2 boss-animation suite remains available as a fallback.


## Importing premium boss candidates to Git in individual batches

The 1536x1024 original paintings and 240-frame candidate packs travel in
downloadable ZIPs while their binary Git import is outstanding. The repository
now includes a guarded importer which merges a single boss into the optional HD
art manifest, checks each WebP's 24 decoded frame SHA-256 hashes, preserves all
other characters, and commits each boss separately under **90 MiB**.

From a checked-out JRPG repository branch (never main), run:

    python -m pip install Pillow
    python game/tools/import-hd-boss-pack.py /path/to/JRPG_HD_Boss_CaptainKaji_v1.zip --check
    python game/tools/import-hd-boss-pack.py /path/to/JRPG_HD_Boss_CaptainKaji_v1.zip --commit --push
    python game/tools/import-hd-boss-pack.py /path/to/JRPG_HD_Boss_WidowOfFog_v1.zip --commit --push
    python game/tools/import-hd-boss-pack.py /path/to/JRPG_HD_Boss_FurnaceAbbot_v1.zip --commit --push

Import records original source images separately in
assets/art/hd-painted-boss-review-v1/<boss-id>/, and adds engine atlases and
motion strips to game/assets/art/hd-painted-v1/. The importer updates the
Roster Keystone's binary Git state only when a Git commit is requested;
visual approval remains pending. It rejects any divergent pre-existing art.

The existing original boss-v2 pixel assets and safe-area telegraphs remain
untouched. Every full-resolution ZIP remains available through its conversation
artifact until the corresponding binary import is pushed.
