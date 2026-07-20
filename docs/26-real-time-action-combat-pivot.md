# Real-time action-combat pivot

**Status:** playable feel proof and full migration contracts implemented; canonical campaign controller pending

## Canonical combat identity

Campaign exploration remains a top-down, chapter-led JRPG. Entering combat changes to a side-view real-time arena using the project's larger side-facing combat sprites. Combat is not turn-based and movement is not paid from a turn resource.

The player directly controls one active party member at a time. Horizontal movement and grounded jumping are continuous and deterministic. Story progress remains quest-led; jumping is a combat/arena verb, not a Metroidvania ability gate.

## Attack timing contract

Every offensive action owns two distinct timing layers:

1. **Animation commitment:** authored wind-up, a single active hit window, and authored recovery frames. The actor cannot move or begin another action during this sequence. Level never shortens these frames.
2. **Post-animation cooldown:** begins only when animation recovery ends. Movement and positioning immediately return, but offensive input remains unavailable until the shared weapon cooldown reaches zero. A stronger art may also retain a longer per-art cooldown.

Cycling attacks cannot bypass the shared weapon cooldown. Defensive and movement verbs may remain available during cooldown when their own state permits them.

The exact level multiplier is:

```text
cooldownMultiplier(level) = max(0.55, 1 - 0.0125 * (level - 1))
effectiveCooldownMs = round(baseCooldownMs * cooldownMultiplier(level))
```

Level therefore improves attack cadence without deleting the minimum 55% recovery floor or making animation readability level-dependent.

## Preserved RPG authority

- Cut, Pierce, Crush, and Arcane delivery remain.
- Ember, Frost, Storm, Radiance, and Umbral essence remain.
- Ledger multipliers and explicit weak/resist/null/absorb feedback remain.
- Character HP, power, guard, level, equipment, Vows, items, encounter rewards, first-clear evidence, and survivor-vital settlement remain.
- Enemy attacks remain explicitly telegraphed. Telegraphs become real-time danger shapes with fixed durations rather than activation previews.
- Existing authored `recoveryPulses` remain migration input for base cooldowns; a zero-pulse basic action receives a nonzero weapon-cooldown floor.

## Presentation and control target

- Top-down field sprites remain the exploration authority.
- Existing 48×64 party and 64×80 enemy side-facing combat atlases seed the action presentation.
- Battle stages become side-view rooms with a stable ground plane, limited deterministic platforms where authored, and no perspective geometry that contradicts collision.
- The HUD displays HP, selected art, shared weapon cooldown, art cooldown, hit outcome, and enemy intent.
- Keyboard baseline: move left/right, jump, basic attack, selected art, guard or evade, party switch, pause.
- Pointer/touch/controller mappings must expose the same verbs without making the Canvas the only text authority.

## Pacing target

Combat begins with a short cut rather than a long transition. Common enemies should create quick movement-and-cooldown problems; bosses may use longer multi-phase rooms. Fast resolution comes from clean input, short ordinary animation commitments, enemy aggression, and readable cooldown routing—not from canceling every recovery frame or removing enemy telegraphs.

## Migration boundary

The existing turn-based engine remains a rollback/reference implementation until action combat preserves campaign victory settlement and all authored objective families. The action kernel and browser prototype must prove fixed-step determinism, free movement during cooldown, one-hit active windows, level scaling, typed damage, enemy telegraphs, victory/defeat, and safe pause/visibility behavior before the campaign's battle links switch permanently.

The current implementation now supplies the kernel, an isolated installed-Chrome feel proof, all-encounter actor/attack adaptation, 20 explicit side-view stage contracts, all 18 real-time objective contracts, a strict terminal-result projection, and engine-independent atomic victory settlement. The integrated automated suite passes 962/962 tests and static delivery passes 155/155 files. The remaining cutover work is the shared campaign action controller, companion AI/control switching, full boss/effect execution, action presentation for every stage, and human feel/readability tuning. No action-combat balance or canonical route-completion claim is made yet.
