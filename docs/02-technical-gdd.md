# Bells of the Black Chrysanthemum — Technical GDD

**Status:** FP-0 combat-proof contract<br>
**Audience:** programming, design, art, and playtest<br>
**Scope:** a narrow, save-free combat vertical slice

## 1. Technical decision

The first playable is a dependency-free HTML5 Canvas build. This workspace has Node.js and Python but no installed Godot runtime; a static browser build is the smallest dependable way to validate the spatial-turn hook immediately. It uses native ES modules, Canvas, and no package install, external network call, or copied art.

Rules live in `game/engine.mjs`, which is DOM-free and covered by Node tests. `game/game.js` is a replaceable input/rendering adapter. The same data and tests can move to a future Godot/Unity/custom runtime after the hook is proven.

All prototype artwork is original procedural pixel art: hard-edged, authored clusters and stepped palette values rather than imported sprites, filters, or AI-derived third-party imagery. It is a visual implementation aid, not final production art.

## 2. First-playable boundary

The combat slice is **FP-0: Bell Court at Takamine**, a deliberately narrow proof before the planned 28–34 minute **FP-1 Takamine Vertical Slice**. Courier **Ren Ishikawa** reaches an abandoned temple gate with **Elisabet “Lise” Varga**, heir to a European hunter oath. A short in-game prelude makes clear that **Father Mateus Avelar**, the court’s vampire interpreter, has directed the search; Lise recognizes the oath he thought extinguished. They face an **Ashen Oni Tithe Enforcer**, an invented retainer of the Black Chrysanthemum court.

The encounter establishes the central reversal without a full party system: Mateus begins as a court servant, while Lise’s arrival supplies the moral and historical challenge that will later force his costly change of course. It makes no use of a real actor’s likeness, a named film character, real victims, or sacred objects as enemy props.

Included:

- One 12 × 7 spatial combat board, an illustrated rain-gate stage, and one player-controlled combatant.
- Two-Pace positioning, initiative/Tempo ribbon, recovery pulses, three player attacks, Guard, Dodge, one enemy AI, element ledger, victory, defeat, and restart.
- A visible, auditable damage calculation after every hit.

Explicitly excluded:

- Field maps, ability-gated backtracking, jumping/platform traversal, inventory, saves, party swaps, or a generalized battle editor.
- A metroidvania progression loop. The eventual campaign is chapter-and-quest based; this slice tests an encounter board only.

## 3. Authoritative combat-space contract

The stage is a **12 × 7** integer board at **32 logical pixels per combat space**. Rendering can animate a sprite between spaces, but simulation never stores sub-space positions.

```js
{
  width: 12,
  height: 7,
  spacePx: 32,
  blocked: ['5,2', '5,3', '5,4', '6,2', '6,3', '6,4'],
  objective: 'Defeat the Ashen Oni Tithe Enforcer'
}
```

### Pace and legal movement

- A friendly Activation begins with **2 Pace**. One Pace moves exactly one adjacent space in any of eight directions, before the final command.
- Legal movement must stay in bounds, avoid blocked and occupied spaces, and cannot cut diagonally through two touching blockers.
- Each accepted movement command changes one or both coordinates by exactly one. All coordinate checks are integer comparisons.
- Arrow keys/WASD move orthogonally; Q/E/Z/C move diagonally. Keyboard input is edge-triggered and repeat-limited; it cannot create uncontrolled movement from one held key.
- A strike, skill, Guard, or Dodge ends the Activation. Movement alone never advances Tempo or recovery.

This is exact positional decision-making, not twitch input: menus pause the combat clock, there are no real-time dodge rolls, and no animation changes a resolved legal position.

## 4. State, Tempo, and recovery

```text
INTRO → SELECT_NEXT → WAITING → PLAYER_COMMAND | ENEMY_THINK
      → RESOLVE → SELECT_NEXT → VICTORY | DEFEAT
```

1. Every combatant has a numeric `readyAtMs`; the lowest living value owns the next Activation.
2. The initiative ribbon displays the next activations and their time-to-ready. A player Activation pauses at `PLAYER_COMMAND` until the player commits.
3. Every command specifies `recoveryPulses`; a pulse is 800 ms in this prototype. Committing a command sets `readyAtMs = now + recoveryPulses × 800`.
4. The command layer rejects attacks and position changes outside `PLAYER_COMMAND`. Recovery is a rule-layer lock, not an animation delay.
5. Enemy turns wait 650 ms at `ENEMY_THINK` so intent and position are readable, then resolve a deterministic decision.

The prototype’s timing is intentionally simple—Tempo is represented by ordered ready timestamps instead of a production meter animation—but keeps the important property: a heavier command produces a longer, visible interval before its next Activation.

## 5. Data schemas

### Combatant

```js
{
  id: 'ren',
  name: 'Ren Ishikawa',
  faction: 'player',
  hp: 92,
  maxHp: 92,
  power: 8,
  guard: 7,
  pos: { x: 1, y: 3 },
  readyAtMs: 0,
  stance: 'neutral', // 'neutral' | 'guard' | 'dodge'
  resistances: {
    delivery: { cut: 1, pierce: 1, crush: 1, arcane: 1 },
    essence: { ember: 1, frost: 1, storm: 1, radiance: 1, umbral: 0.75 }
  }
}
```

### Skill

```js
{
  id: 'cinder-route',
  name: 'Cinder Route',
  delivery: 'arcane',
  essence: 'ember', // optional for a purely physical command
  power: 13,
  range: 4, // Chebyshev distance on the 8-way board
  recoveryPulses: 3,
  dodgeable: false
}
```

The board uses Chebyshev targeting distance (`max(abs(dx), abs(dy))`) because movement is eight-way. Invalid range, blocked movement, and turn ownership are rejected before state changes.

## 6. Damage, resistance, Guard, and Dodge

The first playable implements the vision’s two labels:

- **Delivery:** Cut, Pierce, Crush, or Arcane.
- **Essence:** Ember, Frost, Storm, Radiance, or Umbral. A skill can omit Essence.

```text
base       = max(1, skill.power + attacker.power − floor(target.guard / 3))
delivery   = target.deliveryResistance[skill.delivery]
essence    = skill.essence ? target.essenceResistance[skill.essence] : 1
afterType  = round(base × delivery × essence)
final      = Guard ? max(1, round(afterType × 0.55)) : afterType
```

Damage feedback always prints the actual terms, for example: `Cinder Route: 19 base × Arcane 100% × Ember 125% = 24`.

First-playable ledger:

| Target | Cut | Pierce | Crush | Arcane | Ember | Radiance | Umbral |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ren | 100% | 100% | 100% | 100% | 100% | 100% | 75% |
| Ashen Oni Tithe Enforcer | 100% | 125% | 75% | 100% | 125% | 125% | 75% |

- **Guard** costs 1 Recovery pulse, protects the next hit of any type by 45%, then consumes itself.
- **Dodge** costs 1 Recovery pulse. The next dodgeable physical attack has a deterministic 65% chance to miss; it consumes Dodge on that physical attempt. Arcane/Umbral attacks cannot be dodged and do not remove Dodge.
- The engine accepts an optional deterministic random source. The app uses a fixed seed; tests can supply a known roll.

## 7. Encounter and AI contract

Initial positions are Ren `(1,3)` and the Oni `(10,3)`. A lacquered gate blocks the centre, leaving upper and lower flanks. Ren can move into skill range or read the ledger before committing; rushing the centre is not required.

Enemy decision order:

1. At adjacent range, use **Tetsubo Hew** (Crush, 2 Recovery pulses, dodgeable).
2. Within three spaces, use **Moonless Thorns** (Arcane + Umbral, 3 Recovery pulses, not dodgeable).
3. Otherwise, march one legal space toward Ren (1 Recovery pulse), using a stable direction tie-breaker.

The Oni’s Umbral attack meets Ren’s 75% Umbral resistance; Ember and Radiance attacks expose the Oni’s 125% weaknesses. This proves both an advantage and a resistance in one compact encounter.

## 8. UI states and art implementation

The Canvas is rendered at 320 × 180 logical pixels and integer-scaled with `image-rendering: pixelated`. It must reserve readable regions for:

- Stage: full 12 × 7 board, blocked gate, coordinates, valid-move markers, units, and a short attack flash.
- Header: current phase, Pace, and next-activation Tempo ribbon.
- Right ledger: HP, stance, distance, and delivery/essence multipliers.
- Footer: command buttons with range/recovery labels, combat log, explicit keyboard controls, restart/end card.

Original procedural pixel primitives create rain, cedar, lacquer, paper-screen glow, bell silhouette, Ren, and the Ashen Oni. The purpose is visual readability of silhouettes/value/material; final art remains the art-production deliverable.

## 9. Acceptance and automated verification

The slice is acceptable when:

1. It loads from a local static server to a visible Ren command turn and explicitly names Ren, Lise, and Mateus in the opening/log.
2. Movement never enters an invalid cell; a valid command changes exactly one 8-way space and consumes exactly one Pace.
3. One command ends an Activation; no action is accepted during recovery. The initiative ribbon makes the return order clear.
4. Out-of-range attacks cost nothing and leave the command turn open.
5. Damage feedback includes base, delivery, Essence where present, multiplier, Guard effect where applicable, and final damage.
6. Ember/Radiance weakness and Umbral resistance produce distinct readable results.
7. Guard reduces a hit, Dodge can avoid the defined physical attack, the Oni advances/attacks predictably, and victory, defeat, and restart work.
8. `npm run check` and `npm test` pass. A local browser smoke test loads the entry point with no console error.

## 10. Migration seam

The engine owns combat rules and serializable skill/combatant/map data; the browser layer owns Canvas, button wiring, input repeat filtering, and presentation-only effects. That separation is deliberate so an engine change does not silently rewrite battle math, collision, or recovery behavior.
