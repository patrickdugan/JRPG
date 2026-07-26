# Real-time action-combat pivot

**Status:** canonical action link cutover complete and browser-proven; tactical controller retained as an explicit rollback

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

The existing turn-based engine remains a rollback/reference implementation. Action cutover required fixed-step determinism, free movement during cooldown, one-hit active windows, level scaling, typed damage, enemy telegraphs, victory/defeat, safe pause/visibility behavior, every authored objective family, and durable campaign settlement.

The current implementation supplies the kernel, the isolated feel proof, all-encounter actor/attack adaptation, 20 explicit side-view stage contracts, all 18 real-time objective contracts and their DOM-free evaluator, strict terminal-result projection, and engine-independent atomic victory settlement. `action-campaign-battle.html` composes those systems over real encounter data with one controlled party member, deterministic companions, cooldown-preserving tag switches, shipped side-view art, keyboard/touch input, hidden-tab pause, Storyworld context, and the existing durable campaign transaction.

Black Sun Concord is the first linked party art. It becomes available when Nikola and Mateus are both deployed and living, within 180 px, ready to attack, and either participant is directly controlled. One request commits both actors at the same kernel time without flattening the pair into one damage packet: Dawn Bolt retains its Arcane/Radiance typing and Penitent Night retains its Arcane/Umbral typing. Each attack completes independently, then begins its own level-adjusted native cooldown; the combo neither resets unrelated cooldowns nor permits a partial commitment when any prerequisite fails. Keyboard `L` and a labeled touch control invoke it, while the HUD exposes its readiness or exact lock reason.

All 18 objective families are settlement-authoritative in the integrated page. A deterministic objective-entity director owns escorted and incapacitated witnesses/prisoners, protected scenery and archive cores, attackable phase objects, interaction release, extraction destinations, intact checkpoints, and Chiyo's authored countdown casts. Boss-linked objectives also require the declared boss resolution before victory. Campaign battle links now supply `mode=campaign` and route to `action-campaign-battle.html`; the page records active first-clear/grind time and enters the same compensating settlement transaction used by the tactical controller. The unqualified page remains an isolated laboratory, and `campaign.html?legacyBattle=1` is the sticky per-tab rollback to `battle.html`.

The source encounter effects are live rather than metadata-only: pulls/pushes, Bound/Chill/Shock/Dread/Scorch, guard and forced-move immunity, self-status vulnerability windows, Enma repositioning, weak points, Blood Wards, clerks, and court clones execute through status hooks. Mateus's living wards impose the authored 25% incoming-damage multiplier until both seals break. Typed HP-threshold and activation-cadence boss phases publish warning/entry events, restrict authored phase move lists where supplied, and expose accessible browser state.

The integrated automated suite passes 1,182/1,182 tests; syntax checks and 7/7 repo verifiers pass. Static delivery serves 213/213 files (28,187,277 bytes) byte-for-byte. The installed-Chrome probe verifies isolated movement/cooldown and Black Sun Concord behavior, then starts a fresh campaign run and wins Cinder Hounds through visible action inputs without a restart. Advancement, loadout, playtime, and run-receipt authorities exist, settlement reports `committed`, and Continue appears only afterward; isolated contexts retain empty storage and all console/page/HTTP error arrays remain empty. This is a bounded current action-combat and settlement proof, not a full action-driven campaign route or human balance/readability approval. The long rendered-route verifier currently opts into the tactical rollback until it gains side-view route policy.
