# Bells of the Black Chrysanthemum - Animation Bible

**Status:** production-ready animation contract
**Owner:** art direction / animation
**Applies to:** field actors, combat actors, enemies, bosses, hazards, and battle VFX
**Primary slice:** FP-1 Takamine Vertical Slice

**Runtime note (2026-07-18):** the provisional generated 6×8 party atlas now addresses all six members and four idle/walk facing pairs in Camp, field, scene-focus, and party battle rendering. Exact frame addressing and movement-facing reduction are tested in `game/sprite-atlas.mjs`; bespoke attack, hit, Guard, cast, Recovery, enemy, boss, and VFX clips in this bible remain an art-production gate.

## 1. Purpose and non-negotiables

Animation must make a deliberate, spatial turn system easier to read. It is not decoration and it must never redefine a combat result.

- The simulation owns positions, hit results, Tempo, and Recovery. A rendered sprite may interpolate between resolved positions, but the actor only exists on an integer 12 x 7 combat cell.
- All timing below is authored at **60 FPS**. A combat Recovery pulse is **800 ms / 48 frames** in the current technical contract; clip length never changes its pulse count.
- Every attack must show a readable **wind-up**, a concise **active** frame or frames, and a held **recovery** pose. The player must be able to identify commitment before damage is applied.
- Menus pause the combat clock. No clip may imply a reflex input window, real-time dodge roll, jump, or action-combat cancel.
- At 320 x 180 logical resolution, the active hand, weapon tip, target line, and protected side must remain recognizable without reading text.
- Pixel art is intentionally constructed: no blur, rotation filtering, sub-pixel camera motion, alpha haze, or smear that obscures a target zone.

## 2. Common terms and timing notation

| Term | Meaning | Rule |
| --- | --- | --- |
| Frame | One 60 FPS rendered image | All timelines use frame numbers beginning at 0. |
| Tick hold | Number of frames a cel remains on screen | Holds may be uneven where a readable pause is needed. |
| Key pose | A silhouette-defining pose | Approve key poses before in-betweens. |
| Wind-up | Preparation that declares vector and intent | Never hidden behind particles or another actor. |
| Active | The hit, ward, cast release, or hazard resolve | It is short and produces the game event. |
| Follow-through | Momentum immediately after active | Shows weight; it is not a second hit unless data says so. |
| Recovery pose | Vulnerable or committed final pose | Held or looped while the rule-layer Recovery lock remains. |
| Telegraph | A hostile future threat shape | Boss telegraphs hold at least 12 frames before active. |

### 2.1 Timing policy

Use `f` for frames and `p` for Recovery pulses. A clip finishes visually before or near its state change; the recovery lock is then communicated by the actor's held pose plus discrete UI pips.

| Action class | Visual clip | Standard rule Recovery | Required read |
| --- | ---: | ---: | --- |
| Step / reposition | 8f | 0p | Foot lands on exact next cell center. |
| Guard / Dodge commit | 12f | 1p | Protected side or evasion line is unmistakable. |
| Quick basic attack | 18f | 0-1p | Fast but still has a visible active frame. |
| Deliberate basic attack | 24f | 1p | Weapon and facing commit before impact. |
| Heavy / wide skill | 32-40f | 2-3p | The aftermath reads as exposure, not lag. |
| Boss strike | 28-44f | 1-3p | Threat geometry is held before resolution. |
| Boss area telegraph | 12f minimum hold, then 24-48f resolve | data-defined | A player can inspect the exact danger shape. |

Do not stretch a 24f swing across an entire 48f Recovery pulse merely to fill time. When the clip completes, display the appropriate recovery stance or a low-motion held loop until the simulation returns the actor to the initiative order.

## 3. Canvas, anchors, and source format

| Asset | Nominal frame | Pivot / foot point | Notes |
| --- | ---: | --- | --- |
| Field party / NPC | 32 x 48 px | `(16, 43)` | Foot box is 12 x 10 px; headwear and cloaks may extend upward only. |
| Standard combat actor | 48 x 64 px | `(24, 58)` | Center pivot aligns to a 32 px combat space. |
| Broad combat actor | 64 x 80 px | `(32, 73)` | Use only when silhouette needs width; do not hide neighbors. |
| Boss | 96 x 96 to 128 x 128 px | documented per boss | Supply a clean footprint and a separate hazard layer. |
| Battle VFX | 16-64 px local box | action-specific anchor | Never move unit pivots or resolved cells. |

- Use indexed or layered source files plus a flattened opaque PNG preview. Keep separate layers for body, weapon, cast object, shadow, and FX when useful.
- No baked screen shake, camera pan, pixel scaling, or UI text in a sprite export.
- Field root motion is visual only. Combat root motion is presentation only and must return to the resolved cell center by the final clip frame.
- Four field facings are required: north, east, south, west. Mirroring is permitted only when it does not reverse a satchel, asymmetric weapon, wound, shield, or key silhouette. Combat directions are authored per attack pattern, not assumed from a mirrored field body.

## 4. Palette and pixel-construction constraints

### 4.1 Shared palette

Use the project base palette before adding up to 4-6 local colors for an environment. Every local material normally uses 2-4 values. The following anchors are mandatory reference points, not an excuse to anti-alias every edge.

| Family | Anchors | Animation use |
| --- | --- | --- |
| Ink shadow | `#0B1020`, `#16233A` | silhouette separation, UI-dark depth |
| Rain indigo | `#27466B`, `#4F7392` | wet night, cool rim, distant depth |
| Cedar / earth | `#5A3A2C`, `#8B6043` | wood, leather, domestic warmth |
| Paper / candle | `#D7C99A`, `#F6E8B9` | ward, window, hopeful focal read |
| Lacquer authority | `#762B32`, `#B34A3E` | court trim, seals, hierarchy |
| Oxidized metal | `#637462`, `#A08B58` | bells, armor, old mechanisms |
| Court corruption | `#401D42`, `#781E39` | rare Umbral alarm; never ambient default |
| Dawn / repair | `#88C8C5`, `#D7F0D5` | Radiance and restoration |

### 4.2 Pixel rules

- Work in decisive clusters and stepped diagonals. A one-pixel highlight must describe edge, wetness, metal, or motion; it is never random sparkle.
- Keep shadows opaque. Ash Wisp translucency is implied through sparse clusters, a dark core, and a ground shadow rather than alpha blur.
- Candle glow uses 3-4 hard value steps. Rain is a separate, sparse 1-2 px directional layer. Metal receives one compact hard-highlight cluster.
- Effects use shape plus color: Cut cleft, Pierce line/diamond, Crush square ring, Arcane angular seal, Ember trident, Frost six-point shard, Storm zigzag, Radiance eight-ray disc, Umbral thorned crescent.
- The high-value or saturated effect budget is no more than 10% of a typical frame. A skill may brighten its focal point but may not erase unit silhouettes or legal target cells.

## 5. Field animation library

The field game is fixed-step, eight-direction navigation at 60 FPS. It has no jump and no coyote-time movement. The clips below support precise walking, collision, interaction, and story staging.

| Clip | Frames / holds | Duration | Key-pose instruction | Acceptance test |
| --- | --- | ---: | --- | --- |
| `idle` | 6 cels: `0, 6, 6, 6, 6, 6f` | 36f / 0.60s | Neutral, breath/cloth settle, one restrained material accent | No jitter at a standstill; foot point never wanders. |
| `walk` | 8 cels x 5f | 40f / 0.67s | Contact, down, passing, up, mirrored second half | Contact frames align to simulation movement cadence; no skating. |
| `turn` | 3 cels x 3f | 9f / 0.15s | Neutral -> shoulder/head pivot -> new facing | Direction change is readable without a teleport-like snap. |
| `interact` | 6 cels: `4, 4, 4, 4, 6, 8f` | 30f / 0.50s | Notice -> reach -> touch -> return | Reach stays inside the shown interaction radius. |
| `hurt` | 4 cels: `2, 4, 6, 8f` | 20f / 0.33s | impact, recoil, braced, return | Direction of hit reads; no comic spin. |
| `scene_emote` | 4 cels x 6f | 24f / 0.40s | one readable gesture, then rest | Used for dialogue only; never a substitute for camera clarity. |

### 5.1 Party-specific field accents

| Character | Idle / walk accent | Interaction pose | Do not do |
| --- | --- | --- | --- |
| Ren Ishikawa | Satchel settles after a forward-leaning measured step; spear remains a clean diagonal | Checks dispatch pouch or lowers spear to inspect | Wide heroic spinning or a spear that crosses his face. |
| Aya Shinohara | Sleeve and archive-case weight settle; paper edge moves one pixel | Opens case or angles a folded ward toward a record | Constant flutter that looks like ambient magic. |
| Lise Varga | Sea-weather coat hem and compact tool silhouette stay practical | Checks key, seal, or needle tool | Glamorous cape flourishes or a borrowed hunter archetype pose. |
| Father Mateus Avelar | Controlled stillness, keys shift only once | Holds a document or releases a court seal | Constant vampire fangs, animal motion, or celebrity-like posing. |
| Genta Mononobe | Broad mantle has slow weight; shield/tetsubo preserves side clearance | Braces a blocker or lifts debris | Bouncy run cycle that loses his mass. |
| Kiku Nawa | Medicine case and bottle packets give a small counter-swing | Selects a remedy or tests water | Throwing bottles during idle. |

## 6. Combat animation library

### 6.1 Standard combat states

| Clip | Frame plan at 60 FPS | Recovery-pose handoff | Required silhouette read |
| --- | --- | --- | --- |
| `combat_idle` | 6 cels x 8f = 48f / 0.80s | Loop until an activation or hit event | Weapon, facing, and role identify the actor. |
| `move_1cell` | 8 cels x 1f = 8f / 0.13s | Snap-return to neutral on destination cell | Travel is one 32 px board space; no diagonal drift beyond resolved path. |
| `guard_enter` | 4 cels: `3, 3, 3, 3f` = 12f | `guard_hold` loop: 4 cels x 6f | Protected side points at threat; body closes the lane. |
| `dodge_commit` | 4 cels: `2, 3, 3, 4f` = 12f | `dodge_hold` loop: 3 cels x 8f | Offset stance is visible, but it does not move the resolved cell. |
| `hit` | 4 cels: `2, 3, 5, 6f` = 16f | Resume state or defeated state | One clear impact-side recoil, then brace. |
| `defeat_enemy` | 6 cels: `3, 4, 5, 6, 8, 10f` = 36f | Remove after final frame | Non-gory loss: collapse, ash extinguish, or deactivation. |
| `defeat_human` | 5 cels: `3, 5, 7, 9, 12f` = 36f | Kneel/stagger state; scene decides exit | No kill spectacle or dismemberment. |

### 6.2 Attack pose template

Every attack contact sheet uses these labeled poses even if it adds in-betweens:

1. **N - neutral:** weapon/hand begins at readable rest.
2. **A1 - notice:** eyes, shoulders, or casting hand choose the target vector.
3. **A2 - load:** body weight and weapon move opposite the strike direction.
4. **A3 - peak wind-up:** maximum committed silhouette; this is the clearest pre-hit pose.
5. **H - active:** weapon edge, projectile, ward, or impact shape appears for 1-3 frames.
6. **F - follow-through:** momentum carries through without a second damage event.
7. **R1 - recovery low:** weapon/hand is displaced, balance is temporarily poor.
8. **R2 - recovery settle:** legible vulnerable pose that can be held while Recovery pips remain.

The event manifest must mark `windupStart`, `activeStart`, `activeEnd`, `recoveryStart`, and `complete`. The engine may fire damage only during the `active` window; it must not infer gameplay from a visual frame count.

### 6.3 Standard action timings

| Action | Total | N/A1/A2/A3 | H | F | R1/R2 | Mechanical intent |
| --- | ---: | --- | --- | --- | --- | --- |
| Quick Cut | 18f | 0-6f | 7-8f | 9-11f | 12-17f | Basic 0-1p action; white-edge cleft is brief. |
| Quick Pierce | 18f | 0-7f | 8-9f | 10-11f | 12-17f | Point/line remains visible at maximum extension. |
| Crush strike | 28f | 0-11f | 12-14f | 15-19f | 20-27f | 2p action; downward square impact ring. |
| Arcane cast | 32f | 0-13f | 14-17f | 18-21f | 22-31f | 2-3p action; nested angular seal stays local. |
| Guard | 12f | 0-8f | 9f ward flash | 10-11f | hold | 1p; state changes at commit, not at impact. |
| Dodge | 12f | 0-8f | 9f line-break mark | 10-11f | hold | 1p; deterministic dodge rules remain data-owned. |

### 6.4 Character combat emphases

| Character | Primary animation grammar | Signature key poses | Recovery read |
| --- | --- | --- | --- |
| Ren | Short spear establishes Pierce lines and redirection | Low target notice, rearward load, line-extension hit, one-foot braced recovery | Spear point drops one quadrant and satchel pulls him off balance. |
| Aya | Paper ward placement and careful Radiance arcs | Case-open load, squared ofuda fan, eight-ray disc active, sleeves settle | Ward hand remains extended, head turns to check allies. |
| Lise | Precise lunge / recoil with compact tool | Narrow side profile, low rear heel, clean pierce line, immediate withdrawal | Sea coat trails behind a controlled recoil; no pose-glamour. |
| Mateus | Stillness breaks into costly blood rite; no gore | Locked hands, controlled raised palm, thorned crescent line, low kneel-like recovery | Dried-wine accent dims; shoulders drop and keys go still. |
| Genta | Weight, bracing, and lane control | Shield/tetsubo mass planted, wide shoulder load, square impact, planted recovery | Feet remain separated; center of mass stays low. |
| Kiku | Toss, mix, and terrain placement | Medicine case open, packet/bottle arc, local terrain bloom, reaching recovery | Case remains in one hand; packet source is clear. |

## 7. Enemy, boss, and hazard timing

### 7.1 Enemy states

Each enemy package includes `idle`, `move`, `intent`, `attack`, `hit`, `defeat`, 32 x 32 Ledger portrait, and damage-type tag. Enemy intent is a separate overlay from animation; never ask a pose alone to communicate board geometry.

| Family | Idle / move | Attack plan | Defeat plan |
| --- | --- | --- | --- |
| Cinder Hound | 6f idle / 8f move; ember rises only on an active frame | 20f lunge: 0-9f crouch, 10-11f active, 12-19f skid/recover | 6f body slackens, ember core extinguishes; no gore. |
| Ash Wisp | 6f hover / 6f drift; dark core and local shadow stay aligned | 24f Ember burst: 0-11f condense, 12-14f active, 15-23f disperse | 5f collapses inward to a final coal cluster. |
| Bell Moth | 6f wing loop / 8f glide | 20f charge: 0-11f wing close, 12-13f bell pulse, 14-19f flutter recovery | 6f wing fold then fade to a dark floor shadow. |
| Tithe Enforcer | 6f armored idle / 10f heavy move | 28f shield/weapon telegraph; readable Crush and Umbral variants | 7f ember core dims and bell-metal joints unlock. |

### 7.2 FP-1 Mateus boss timing

Mateus is a named human/vampire opponent in FP-1. His defeat must be a nonlethal phase change, not a death animation.

| Move | Visual plan | Telegraph requirement | Recovery pose / data |
| --- | --- | --- | --- |
| Pale Cut | 20f; 0-7f facing and load, 8-9f active, 10-19f follow/recover | Front-facing 1-space intent stays visible for at least 12f before his activation resolves | Controlled low blade; **0p**. |
| Sanguine Step | 28f; 0-11f thorned afterimage target lane, 12-14f arrival/active, 15-27f recovery | Endpoint marker and 2-space line hold for 12f | Coat and keys settle from a failed balance; **1p**. |
| Blood Ward | 30f; 0-11f hands lock, 12-17f two ward seals form, 18-29f recovery | Ward locations remain distinct from unit and bell art | One hand remains raised toward the ward; **1p**. |
| Crimson Litany | 44f; 0-11f bell-note rise, 12-23f 4-space danger line holds, 24-27f active, 28-43f collapse | The full 4-space Umbral line is visible for **at least 12f** before frame 24 | Low, exposed stance; **3p**, conveyed by 3 lock pips plus hold pose. |
| Phase-3 surrender | 36f; spell breaks, nonlethal self-damage, kneel, guards dismissed | No active hit and no blood spray | Remain in `defeated_human` / dialogue pose. |

### 7.3 Boss and hazard rules

- Every boss has one dominant visual mechanic and one breakable read. Create a clean contact sheet for both before in-betweens.
- Build hazards as four named states: `idle`, `armed`, `active`, `cool`. Do not treat a particle loop as a hazard state.
- Boss-only hazards must hold their target shape for at least 12f before the hit. A 4f flash is not a telegraph.
- Keep attack telegraphs on their own layer below UI and above floor decoration. They must not cover player feet, cell markers, or ledger data for more than two active frames.
- Use a unique phase transition only when it changes tactics. A phase change gets its own contact sheet, event marker, and in-engine 320 x 180 review.

## 8. VFX, camera, and weather loops

| Asset class | Frame plan | Limits |
| --- | --- | --- |
| Ordinary impact | 3-5f | 12-24 px focal spread; end before it masks a target. |
| Skill impact | 6-10f | Wind-up/active/recovery shapes remain readable; no all-board cover beyond 2f. |
| Projectile / arc | 4-12f travel | Follows resolved path; never interpolates a new legal target. |
| Status marker | 4-6f loop | Shape plus color, small anchor near unit; no screen-covering halo. |
| Rain | 4-8f modular loop | Sparse left-to-right 1-2 px streaks on separate layer. |
| Candle / lantern | 4-6f loop | 3-4 hard value steps, no blurred bloom. |
| Camera shake | fixed 4f maximum for FP-1 bell ring | Accessibility option must suppress it; no gameplay information depends on shake. |

Keep audio hit timing aligned with the `active` event, not with a delayed visual flourish. Camera motion must be integer-pixel and must not make the 12 x 7 board appear to slide under a unit.

## 9. Sheet layout, manifests, and export names

### 9.1 Source handoff

For every sprite or effect, deliver:

1. Layered or indexed source with palette data.
2. Flattened opaque PNG sheet using nearest-neighbor pixels.
3. JSON frame map with frame rectangles, duration, pivot, foot point, tags, and action events.
4. Contact sheet containing neutral, wind-up, active, follow-through, and recovery keys for approval.
5. One 320 x 180 in-engine capture with UI and weather enabled.

### 9.2 Naming convention

Use lowercase ASCII and the art-direction convention:

```text
{area}_{subject}_{variant}_{state}_vNN.png
```

Examples:

```text
takamine_gate_rain_night_v01.png
chr_ren_combat_e_attack-basic_v01.png
chr_aya_field_s_walk_v01.png
enm_tithe-enforcer_combat_intent-umbral_v01.png
bos_mateus_bell-chamber_crimson-litany_v01.png
vfx_umbral_line_active_v01.png
hzd_bell-pulse_armed_v01.png
```

The frame map and contact sheet reuse the same stem:

```text
chr_ren_combat_e_attack-basic_v01.json
chr_ren_combat_e_attack-basic_v01-keys.png
```

Do not use `final`, `new`, dates, arbitrary personal initials, spaces, or unclear plural names. Increment `vNN` only when a reviewed export replaces the previous approved version.

### 9.3 Required JSON fields

```json
{
  "id": "chr_ren_combat_e_attack-basic_v01",
  "sheet": "chr_ren_combat_e_attack-basic_v01.png",
  "logicalFrame": [48, 64],
  "pivot": [24, 58],
  "footPoint": [24, 58],
  "paletteId": "pal_core_rain_v01",
  "fps": 60,
  "loop": false,
  "frames": [{"rect": [0, 0, 48, 64], "duration": 3}],
  "events": {
    "windupStart": 0,
    "activeStart": 7,
    "activeEnd": 8,
    "recoveryStart": 12,
    "complete": 18
  }
}
```

`events` are a visual audit map. Combat data remains the authority for range, damage, legal targets, and Recovery pulses.

## 10. Review gates and rejection criteria

### 10.1 Required approval sequence

1. Reference packet: narrative purpose, material reference, combat or collision sketch, and value thumbnail.
2. Monochrome silhouette check at field/combat scale.
3. Palette and module/sprite key approval.
4. Contact-sheet approval for N/A1/A2/A3/H/F/R1/R2.
5. Full clip and JSON review.
6. In-engine test at 320 x 180 with UI, rain, hazards, and accessibility settings.
7. Cultural/sensitivity review for costume, context, religious imagery, and invented enemy boundaries before lock.

### 10.2 Reject immediately if an asset

- obscures a legal board cell, target line, selected route, or recovery state;
- turns Recovery into a vague slow-motion flourish rather than a visible commitment;
- uses blur, automatic interpolation, alpha fog, or smooth gradients to hide weak construction;
- makes an ability look real-time, cancelable, or dependent on a frame-perfect reaction;
- makes a sacred object into loot, a generic enemy prop, or a spectacle of suffering;
- codes Japanese people, Christian people, or any ethnicity as a monster class;
- depends on a celebrity, film character, or another game's art language for recognition;
- cannot be understood in a static key-pose contact sheet.

## 11. FP-1 animation delivery cut

| Priority | Deliverable | Minimum acceptance |
| --- | --- | --- |
| P0 | Ren field/combat package | four field facings; idle, walk, interact, hurt; combat idle, move, Guard, hit, Cut/Pierce actions, defeat. |
| P0 | Aya field/combat package | four field facings; ward/read gestures; combat idle, move, Analyze/Radiance, Guard, hit, defeat. |
| P0 | Lise temporary-party package | field entrance/read; combat idle, move, Needlepoint/Hawthorn Pique, Guard, hit, defeat. |
| P0 | Tithe Enforcer and Bell Moth package | idle, intent, two attack reads, hit, defeat, Ledger portrait. |
| P0 | Cinder Hound and Ash Wisp package | idle, intent, attack, hit, defeat, Ledger portrait. |
| P0 | Mateus boss package | all five moves in section 7.2, phase-3 nonlethal defeat, 320 x 180 telegraph review. |
| P0 | Takamine rain/weather/hazard loops | rain, lantern, bell pulse, water, and any shown field obstacle follow section 8. |
| P0 | Delivery/essence VFX | Cut, Pierce, Crush, Arcane, Ember, Radiance, Umbral; all active frames fit the target-obscuration budget. |

## 12. Production-reference limitation

The opaque PNGs in `assets/production/` are original generated **production references** for palette, silhouette, composition, and mood. They are not source frames, tile sheets, font art, animation clips, or shippable game pixels. Rebuild every production asset in editable source using this bible and the approval gates above.
