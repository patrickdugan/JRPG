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
