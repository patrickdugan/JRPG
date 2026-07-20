/**
 * Authored encounter-kit data for Bells of the Black Chrysanthemum.
 *
 * This is presentation-agnostic, serializable data. Shapes use board tiles,
 * recovery is expressed in 800 ms combat pulses, and every enemy intent is
 * designed to be shown before it resolves. A runtime may add animation, but
 * must not hide a listed telegraph or alter an authored recovery value.
 */

export const ENCOUNTER_SCHEMA_VERSION = 1;
export const RECOVERY_PULSE_MS = 800;

const neutralResistances = {
  delivery: { cut: 1, pierce: 1, crush: 1, arcane: 1 },
  essence: { ember: 1, frost: 1, storm: 1, radiance: 1, umbral: 1 },
};

const partyDeployment = (members) => members.map(([actorId, at]) => ({ actorId, at }));

/**
 * Encounter fields intentionally remain plain data:
 * - `objective` supplies win/loss rules suitable for a state machine.
 * - `enemies` contains deployment, Ledger values, skills, and deterministic AI.
 * - `bossMechanic` exists even for non-boss encounters so UI can show the
 *   encounter's authored rule rather than infer it from an enemy name.
 */
export const ENCOUNTERS = [
  {
    id: 'prologue-ashen-bailiff',
    chapterId: 'prologue',
    primary: true,
    levelId: 'hsh-census-square',
    name: 'Ashen Bailiff — River Escape',
    format: 'tutorial-escape',
    objective: {
      type: 'surviveThenExit',
      text: 'Survive three enemy activations, then move Ren to the river exit.',
      surviveEnemyActivations: 3,
      exitTile: '11,5',
      failure: 'ren-defeated',
    },
    lesson: {
      primary: 'Read a long telegraphed sweep and spend Pace before committing a command.',
      playerRead: 'The red line remains visible for one full Bailiff activation.',
      successSignal: 'The exit marker lights only after the third enemy activation.',
    },
    party: {
      roster: ['ren'],
      deployment: partyDeployment([['ren', '1,5']]),
      guestSupport: [{ id: 'hushigawa-civilian', at: '2,5', action: 'point-river-exit', recoveryPulses: 0 }],
    },
    enemies: [
      {
        id: 'ashen-bailiff',
        name: 'Ashen Bailiff',
        count: 1,
        positions: ['9,3'],
        role: 'immovable tutorial pursuer',
        stats: { hp: 999, power: 14, guard: 11, speed: 88 },
        resistances: { ...neutralResistances, essence: { ...neutralResistances.essence, umbral: 0.75 } },
        ledger: 'A familiar silhouette packed into court ash. Do not treat a person as a trophy.',
        skills: [
          {
            id: 'census-sweep', name: 'Census Sweep', delivery: 'crush', power: 18, range: 5,
            shape: { type: 'line', tiles: ['3,4', '4,4', '5,4', '6,4', '7,4'] },
            telegraph: 'Raises the bell-staff; a red five-space line appears one activation before impact.',
            recoveryPulses: 2, dodgeable: true, effect: { push: { spaces: 1, direction: 'south' } },
          },
          {
            id: 'ash-step', name: 'Ash Step', delivery: 'arcane', essence: 'umbral', power: 8, range: 4,
            telegraph: 'Ash gathers at the nearest civilian marker.', recoveryPulses: 1, dodgeable: false,
          },
        ],
        ai: ['Telegraph Census Sweep if Ren can stand in its line.', 'Otherwise Ash Step toward Ren.', 'Never pursue beyond the river threshold.'],
      },
    ],
    bossMechanic: {
      type: 'escape-boss',
      telegraphs: ['census-sweep'],
      rule: 'The Bailiff cannot be defeated here; the state machine resolves only after the survival count and exit tile.',
      humaneResolution: 'The bell fracture interrupts the command. The transformed villager is not treated as loot.',
    },
    reward: { keyItems: ['Hot black bell fragment'], story: 'Aya can identify the Takamine seal at dawn.' },
  },

  {
    id: 'c1-cinder-hounds',
    chapterId: 'chapter-1',
    levelId: 'c1-flooded-cedars',
    name: 'Flooded Cedars — Cinder Hounds',
    format: 'teaching-battle',
    objective: { type: 'defeatAll', text: 'Defeat the two Cinder Hounds.', failure: 'all-active-party-defeated' },
    lesson: {
      primary: 'A resisted Cut is information; Analyze turns it into a reusable Ledger read.',
      playerRead: 'The first Courier Cut prints “Cut 75%” in the result line.',
      successSignal: 'Pierce damage prints 125% after Analyze or the second resisted hit.',
    },
    party: { roster: ['ren', 'aya'], deployment: partyDeployment([['ren', '4,5'], ['aya', '6,5']]) },
    enemies: [
      {
        id: 'cinder-hound', name: 'Cinder Hound', count: 2, positions: ['3,1', '8,1'], role: 'line-lunge skirmisher',
        stats: { hp: 86, power: 12, guard: 8, speed: 94 },
        resistances: {
          delivery: { cut: 0.75, pierce: 1.25, crush: 1, arcane: 1 },
          essence: { ember: 0.75, frost: 1, storm: 1, radiance: 1, umbral: 1 },
        },
        ledger: 'Soot-hardened hide turns a blade; the throat seam opens to a thrust.',
        skills: [
          {
            id: 'cinder-lunge', name: 'Cinder Lunge', delivery: 'pierce', essence: 'ember', power: 12, range: 3,
            shape: { type: 'line', length: 3, origin: 'hound-facing' },
            telegraph: 'The hound lowers its head and burns a three-space red path.', recoveryPulses: 1, dodgeable: true,
          },
          { id: 'ash-bite', name: 'Ash Bite', delivery: 'cut', essence: 'ember', power: 10, range: 1, telegraph: 'Jaws flare at adjacent range.', recoveryPulses: 0, dodgeable: true },
        ],
        ai: ['If a target is in Lunge line, telegraph Cinder Lunge.', 'If adjacent, use Ash Bite.', 'Otherwise move toward the nearest target.'],
      },
    ],
    bossMechanic: { type: 'teaching-pattern', telegraphs: ['cinder-lunge'], rule: 'Both hounds share the same readable lunge grammar.' },
    reward: { items: ['River Salve x1'], system: 'Analyze prompt unlocks permanently.' },
  },

  {
    id: 'c1-ash-wisps',
    chapterId: 'chapter-1',
    levelId: 'c1-flooded-cedars',
    name: 'Flooded Cedars — Ash Wisps',
    format: 'teaching-battle',
    objective: { type: 'defeatAll', text: 'Disperse the two Ash Wisps before their paper-ash burst completes.', failure: 'all-active-party-defeated' },
    lesson: {
      primary: 'A nonphysical weakness and a null result are both clear Ledger facts.',
      playerRead: 'Umbral prints 0% on the Wisp; Radiance prints 125%.',
      successSignal: 'The player chooses a target before both wisps finish charging.',
    },
    party: { roster: ['ren', 'aya'], deployment: partyDeployment([['ren', '4,5'], ['aya', '6,5']]) },
    enemies: [
      {
        id: 'ash-wisp', name: 'Ash Wisp', count: 2, positions: ['4,1', '7,1'], role: 'slow charged burst caster',
        stats: { hp: 52, power: 11, guard: 5, speed: 82 },
        resistances: {
          delivery: { cut: 1, pierce: 1, crush: 1, arcane: 1 },
          essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: 0 },
        },
        ledger: 'A hovering coal wrapped in copied ash. Radiance separates the paper; Umbral only feeds the shadow.',
        skills: [
          {
            id: 'paper-ash-burst', name: 'Paper Ash Burst', delivery: 'arcane', essence: 'ember', power: 14, range: 4,
            shape: { type: 'cross', radius: 1, origin: 'targeted-tile' },
            telegraph: 'The Wisp gathers two pulses of paper ash around a marked target tile.', recoveryPulses: 2, dodgeable: false,
          },
        ],
        ai: ['Charge Paper Ash Burst if two allies can be caught.', 'Otherwise drift to maintain range four.'],
      },
    ],
    bossMechanic: { type: 'charge-window', telegraphs: ['paper-ash-burst'], rule: 'The charge persists across the Wisp’s next activation and can be interrupted.' },
    reward: { items: ['Cedar Route note'], system: 'Radiance/Umbral Ledger language reinforced.' },
  },

  {
    id: 'c1-tithe-hound',
    chapterId: 'chapter-1',
    primary: true,
    levelId: 'c1-tax-storehouse',
    name: 'Tithe Hound',
    format: 'boss',
    objective: { type: 'defeatBoss', text: 'Expose the seal after Consume Ink and defeat the Tithe Hound before copied names are lost.', failure: 'all-active-party-defeated' },
    lesson: {
      primary: 'A boss can temporarily change its own Ledger; wait for the exposed seal, then use Pierce during recovery.',
      playerRead: 'The seal gets a direct HP bar and displays Pierce 125%.',
      successSignal: 'Aya copies the names before the player destroys the weaponized ledger.',
    },
    party: { roster: ['ren', 'aya'], deployment: partyDeployment([['ren', '4,5'], ['aya', '6,5']]) },
    enemies: [
      {
        id: 'tithe-hound', name: 'Tithe Hound', count: 1, positions: ['6,2'], role: 'ledger predator',
        stats: { hp: 360, power: 16, guard: 13, speed: 96 },
        resistances: {
          delivery: { cut: 0.75, pierce: 1.25, crush: 1, arcane: 1 },
          essence: { ember: 1, frost: 1, storm: 1, radiance: 1, umbral: 0.75 },
        },
        ledger: 'A false ledger’s hunger made into teeth. The seal beneath its jaw is the weak point.',
        skills: [
          {
            id: 'consume-ink', name: 'Consume Ink', delivery: 'arcane', essence: 'umbral', power: 13, range: 5,
            shape: { type: 'line', tiles: ['3,3', '4,3', '5,3', '6,3', '7,3'] },
            telegraph: 'Names lift off the floor and align in a five-space black line.', recoveryPulses: 3, dodgeable: false,
            effect: { status: 'dread', exposes: 'tithe-seal' },
          },
          { id: 'ledger-maul', name: 'Ledger Maul', delivery: 'cut', power: 17, range: 1, telegraph: 'The jaw opens at adjacent range.', recoveryPulses: 1, dodgeable: true },
        ],
        ai: ['At 3+ distance, telegraph Consume Ink.', 'At adjacency, Ledger Maul.', 'Otherwise approach the nearest target.'],
      },
      {
        id: 'tithe-seal', name: 'Exposed Seal', count: 1, positions: [], role: 'temporary weak-point summon',
        stats: { hp: 72, power: 0, guard: 2, speed: 0 },
        resistances: {
          delivery: { cut: 1, pierce: 1.25, crush: 1, arcane: 1 },
          essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: 0.75 },
        },
        ledger: 'Appears only after Consume Ink resolves; destroying it cancels the next line attack.',
        skills: [], ai: ['Spawn at the Hound’s front tile when Consume Ink resolves.'],
      },
    ],
    bossMechanic: {
      type: 'exposed-weak-point', telegraphs: ['consume-ink'],
      phases: [
        { id: 'hunger', when: 'hp-above-50', rule: 'The Hound alternates approach and Consume Ink.' },
        { id: 'frantic', when: 'hp-at-or-below-50', rule: 'Consume Ink returns faster, but the exposed seal lasts one extra activation.' },
      ],
      counterplay: 'Move out of the line, then Pierce or Radiance the exposed seal during Recovery 3.',
    },
    reward: { keyItems: ['Takamine supply manifest', 'Lantern Network code'], story: 'The copied evidence survives the fire.' },
  },

  {
    id: 'fp1-cedar-path',
    chapterId: 'chapter-2',
    levelId: 'fp1-wet-cedar-stage',
    name: 'Cedar Service Path — Cinder Hounds and Ash Wisp',
    format: 'teaching-battle',
    objective: { type: 'defeatAll', text: 'Defeat Cinder Hound x2 and Ash Wisp x1.', failure: 'all-active-party-defeated' },
    lesson: {
      primary: 'Reinforce Pace, Analyze, a resisted Cut, and a three-space telegraph in one small formation.',
      playerRead: 'Aya’s Analyze prompt follows the first resisted Cut but is not mandatory.',
      successSignal: 'The player may leave the Lunge lane, Guard, or accept a calculated hit.',
    },
    party: { roster: ['ren', 'aya'], deployment: partyDeployment([['ren', '5,5'], ['aya', '6,5']]) },
    enemies: [
      {
        id: 'cinder-hound', name: 'Cinder Hound', count: 2, positions: ['2,1', '9,1'], role: 'line-lunge skirmisher',
        stats: { hp: 94, power: 14, guard: 9, speed: 94 },
        resistances: {
          delivery: { cut: 0.75, pierce: 1.25, crush: 1, arcane: 1 },
          essence: { ember: 0.75, frost: 1, storm: 1, radiance: 1, umbral: 1 },
        },
        ledger: 'Soot-covered hide: Cut 75%, Pierce 125%, Ember 75%.',
        skills: [
          { id: 'cinder-lunge', name: 'Cinder Lunge', delivery: 'pierce', essence: 'ember', power: 13, range: 3, shape: { type: 'line', length: 3, origin: 'hound-facing' }, telegraph: 'A three-space red line appears before the lunge.', recoveryPulses: 1, dodgeable: true },
          { id: 'ash-bite', name: 'Ash Bite', delivery: 'cut', essence: 'ember', power: 11, range: 1, telegraph: 'Adjacent jaw flare.', recoveryPulses: 0, dodgeable: true },
        ],
        ai: ['Lunge a target in line.', 'Bite an adjacent target.', 'Otherwise move one space toward the nearest target.'],
      },
      {
        id: 'ash-wisp', name: 'Ash Wisp', count: 1, positions: ['6,1'], role: 'charged burst caster',
        stats: { hp: 60, power: 12, guard: 5, speed: 82 },
        resistances: {
          delivery: { cut: 1, pierce: 1, crush: 1, arcane: 1 },
          essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: 0 },
        },
        ledger: 'A hovering coal of paper ash: Radiance 125%, Umbral 0%.',
        skills: [
          { id: 'paper-ash-burst', name: 'Paper Ash Burst', delivery: 'arcane', essence: 'ember', power: 14, range: 4, shape: { type: 'cross', radius: 1, origin: 'targeted-tile' }, telegraph: 'Paper ash gathers around a marked tile.', recoveryPulses: 2, dodgeable: false },
        ],
        ai: ['Charge the largest reachable cluster.', 'Maintain range four if no cluster exists.'],
      },
    ],
    bossMechanic: { type: 'teaching-pattern', telegraphs: ['cinder-lunge', 'paper-ash-burst'], rule: 'No environmental damage; every read comes from enemy intent and Ledger feedback.' },
    reward: { items: ['River Salve x1'], flags: ['fp1-cedar-path-cleared'] },
  },

  {
    id: 'fp1-flooded-archive',
    chapterId: 'chapter-2',
    levelId: 'fp1-flooded-archive-stage',
    name: 'Flooded Archive — Tithe Enforcer and Bell Moths',
    format: 'teaching-battle',
    objective: { type: 'defeatAll', text: 'Defeat the Tithe Enforcer and both Bell Moths.', failure: 'all-active-party-defeated' },
    lesson: {
      primary: 'Combine flanking, delivery/essence weakness, forced movement prevention, and conditional water terrain.',
      playerRead: 'The brazier declares Storm-water Chill before the battle; the Enforcer Ledger explains its shield rule.',
      successSignal: 'Lise can reach a Pierce angle after one Pace while Ren protects a water lane.',
    },
    party: { roster: ['ren', 'aya', 'lise'], deployment: partyDeployment([['ren', '5,6'], ['aya', '4,6'], ['lise', '6,6']]) },
    enemies: [
      {
        id: 'tithe-enforcer', name: 'Tithe Enforcer', count: 1, positions: ['6,2'], role: 'shielded forced-movement guard',
        stats: { hp: 214, power: 17, guard: 15, speed: 88 },
        resistances: {
          delivery: { cut: 0.75, pierce: 1.25, crush: 1, arcane: 1 },
          essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: 0.75 },
        },
        ledger: 'Court shield: Cut 75%, Pierce 125%, Radiance 125%. It cannot be pushed while Guarded.',
        skills: [
          { id: 'shield-hook', name: 'Shield Hook', delivery: 'crush', power: 15, range: 2, shape: { type: 'line', length: 2, origin: 'enforcer-facing' }, telegraph: 'The shield rim points at a two-space pull line.', recoveryPulses: 1, dodgeable: true, effect: { pull: { spaces: 1 } } },
          { id: 'registry-guard', name: 'Registry Guard', delivery: 'arcane', essence: 'umbral', power: 0, range: 0, telegraph: 'The shield locks into a black stance.', recoveryPulses: 1, dodgeable: false, effect: { stance: 'guard', immuneToForcedMove: true } },
        ],
        ai: ['If a target can be pulled into water, telegraph Shield Hook.', 'If not Guarded, use Registry Guard.', 'Otherwise advance toward Lise or Aya.'],
      },
      {
        id: 'bell-moth', name: 'Bell Moth', count: 2, positions: ['4,1', '7,1'], role: 'group-pulse nuisance',
        stats: { hp: 64, power: 12, guard: 5, speed: 102 },
        resistances: {
          delivery: { cut: 1, pierce: 1, crush: 1, arcane: 1 },
          essence: { ember: 1.25, frost: 0.75, storm: 1, radiance: 1, umbral: 1 },
        },
        ledger: 'Thin bell wings: Ember 125%, Frost 75%, low health.',
        skills: [
          { id: 'bell-dust', name: 'Bell Dust', delivery: 'arcane', essence: 'storm', power: 11, range: 4, shape: { type: 'radius', radius: 1, origin: 'moth' }, telegraph: 'The wings ring twice; both moths fire on their next activation.', recoveryPulses: 2, dodgeable: false },
        ],
        ai: ['If both moths live, synchronize Bell Dust.', 'Otherwise fire at the nearest two targets.'],
      },
    ],
    bossMechanic: { type: 'terrain-timing', telegraphs: ['shield-hook', 'bell-dust'], rule: 'Storm causes Chill only when a unit enters marked water after the strike; water itself is not surprise damage.' },
    reward: { keyItems: ['Bell-room key'], items: ['Ward Tonic x1'] },
  },

  {
    id: 'fp1-mateus',
    chapterId: 'chapter-2',
    primary: true,
    levelId: 'tkm-bell-chamber',
    name: 'Father Mateus Avelar',
    format: 'boss',
    objective: {
      type: 'thresholdOrObjects',
      text: 'Reduce Mateus to 20% health, or destroy both Blood Ward seals after phase two.',
      hpThreshold: 0.2,
      objectCondition: { objectIds: ['blood-ward-west', 'blood-ward-east'], afterPhase: 2 },
      failure: 'all-active-party-defeated',
      nonlethal: true,
    },
    lesson: {
      primary: 'Recovery is an explicit tactical resource: Crimson Litany’s Recovery 3 creates the boss’s largest safe window.',
      playerRead: 'The Tempo ribbon and a one-time 0.75-second teaching pause label Recovery 3.',
      successSignal: 'The player attacks, heals, or breaks a seal while Mateus is visibly delayed.',
    },
    party: { roster: ['ren', 'aya', 'lise'], deployment: partyDeployment([['ren', '2,3'], ['aya', '2,4'], ['lise', '3,3']]) },
    enemies: [
      {
        id: 'mateus', name: 'Father Mateus Avelar', count: 1, positions: ['9,3'], role: 'mobile vampire duelist',
        stats: { hp: 760, spirit: 120, power: 21, guard: 16, speed: 108 },
        resistances: {
          delivery: { cut: 1, pierce: 1, crush: 1, arcane: 0.75 },
          essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: 0.5 },
        },
        ledger: 'Court vampire. Blood Ward is a separate, targetable defense; this fight resolves in surrender, not death.',
        skills: [
          { id: 'pale-cut', name: 'Pale Cut', delivery: 'cut', power: 17, range: 1, shape: { type: 'front', length: 1 }, telegraph: 'Mateus turns his shoulders toward one adjacent space.', recoveryPulses: 0, dodgeable: true },
          { id: 'sanguine-step', name: 'Sanguine Step', delivery: 'cut', essence: 'umbral', power: 18, range: 4, shape: { type: 'laneEndpoint', length: 2, origin: 'afterimage' }, telegraph: 'A red afterimage marks the destination lane before the two-space slash.', recoveryPulses: 1, dodgeable: false },
          { id: 'blood-ward', name: 'Blood Ward', delivery: 'arcane', essence: 'umbral', power: 0, range: 0, telegraph: 'Two black-red seals rise beside the bell.', recoveryPulses: 1, dodgeable: false, effect: { summons: ['blood-ward-west', 'blood-ward-east'], incomingDamageMultiplier: 0.25 } },
          { id: 'crimson-litany', name: 'Crimson Litany', delivery: 'arcane', essence: 'umbral', power: 22, range: 4, shape: { type: 'line', length: 4, origin: 'mateus-facing' }, telegraph: 'Two rising bell-note activations draw a four-space violet line.', recoveryPulses: 3, dodgeable: false, effect: { status: 'dread', duration: 'one-activation' } },
        ],
        ai: [
          'Phase 1: Pale Cut, Sanguine Step, then Blood Ward.',
          'Do not select Crimson Litany until the player has seen Analyze or struck a Warded Mateus twice.',
          'Phase 2: use Crimson Litany after Blood Ward; prefer a lane containing two heroes.',
          'Phase 3: cancel hostile AI and resolve the surrender scene.',
        ],
      },
      {
        id: 'blood-ward-west', name: 'Blood Ward Seal', count: 1, positions: ['5,1'], role: 'temporary ward object',
        stats: { hp: 96, power: 0, guard: 7, speed: 0 },
        resistances: { delivery: { cut: 1, pierce: 1.25, crush: 1, arcane: 1 }, essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: 0 } },
        ledger: 'Blood seal: Pierce or Radiance breaks it cleanly.', skills: [], ai: ['Spawn only when Blood Ward resolves.'],
      },
      {
        id: 'blood-ward-east', name: 'Blood Ward Seal', count: 1, positions: ['6,5'], role: 'temporary ward object',
        stats: { hp: 96, power: 0, guard: 7, speed: 0 },
        resistances: { delivery: { cut: 1, pierce: 1.25, crush: 1, arcane: 1 }, essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: 0 } },
        ledger: 'Blood seal: Pierce or Radiance breaks it cleanly.', skills: [], ai: ['Spawn only when Blood Ward resolves.'],
      },
    ],
    bossMechanic: {
      type: 'three-phase-recovery-boss',
      telegraphs: ['pale-cut', 'sanguine-step', 'blood-ward', 'crimson-litany'],
      phases: [
        { id: 'phase-1', when: 'hp-above-55-percent', moves: ['pale-cut', 'sanguine-step', 'blood-ward'], rule: 'No Litany until the player has a Ledger teaching opportunity.' },
        { id: 'phase-2', when: 'hp-at-or-below-55-percent', moves: ['blood-ward', 'crimson-litany'], rule: 'First Litany pauses only the HUD for 0.75 seconds to call out Recovery 3.' },
        { id: 'phase-3', when: 'hp-at-or-below-20-percent OR both-wards-broken-after-phase-2', moves: [], rule: 'Mateus takes 20% nonlethal self-damage and orders guards away.' },
      ],
      counterplay: 'Leave the Litany line, then exploit its three Recovery pulses with Pierce/Radiance seal damage, healing, or setup.',
    },
    reward: { keyItems: ['Bell-room key', 'Takamine temple key'], party: ['Lise joins permanently'], story: 'Mateus opens the cells and becomes a source, not a forgiven friend.' },
  },

  {
    id: 'c3-dock-patrol',
    chapterId: 'chapter-3',
    levelId: 'sdg-rain-docks',
    name: 'Sodegaura Lantern Route Patrol',
    format: 'escort-route',
    objective: { type: 'escortTokens', text: 'Move two witness tokens to the boat exit; a visible bad route begins this battle instead of a stealth game-over.', tokenCount: 2, failure: 'both-witnesses-incapacitated' },
    lesson: { primary: 'Facing controls hook lines; Guard protects an escort lane before a forced move.', playerRead: 'Patrol cones and the hook path are visible before engagement.', successSignal: 'At least one witness reaches the lantern boat.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus'], deployment: partyDeployment([['ren', '2,4'], ['aya', '2,3'], ['lise', '3,4'], ['mateus', '3,3']]), objectiveTokens: [{ id: 'witness-a', at: '1,2' }, { id: 'witness-b', at: '1,5' }] },
    enemies: [
      {
        id: 'dock-retainer', name: 'Dock Retainer', count: 2, positions: ['8,2', '8,5'], role: 'hook-line guard',
        stats: { hp: 132, power: 15, guard: 12, speed: 91 }, resistances: neutralResistances,
        ledger: 'A human court employee with a crane hook; facing tells you who can be dragged.',
        skills: [
          { id: 'dock-hook', name: 'Dock Hook', delivery: 'pierce', power: 14, range: 4, shape: { type: 'line', length: 4, origin: 'retainer-facing' }, telegraph: 'The retainer plants a hook along a four-space line.', recoveryPulses: 2, dodgeable: true, effect: { pull: { spaces: 2 } } },
          { id: 'baton-check', name: 'Baton Check', delivery: 'crush', power: 12, range: 1, telegraph: 'Raises a short baton.', recoveryPulses: 0, dodgeable: true },
        ], ai: ['Hook a witness if possible.', 'Otherwise hook the nearest unguarded hero.', 'Baton at adjacency.'],
      },
    ],
    bossMechanic: { type: 'visible-route-punishment', telegraphs: ['dock-hook'], rule: 'Choosing a bad lantern route starts this fair encounter; it never resets the player to a prior dialogue.' },
    reward: { flags: ['c3-lantern-route'], story: 'Witnesses reach the lantern boat and Genta sees the transport mark.' },
  },

  {
    id: 'c3-captain-kaji',
    chapterId: 'chapter-3',
    primary: true,
    levelId: 'sdg-salt-warehouse',
    name: 'Captain Kaji',
    format: 'boss',
    objective: { type: 'defeatBossWithProtection', text: 'Disarm Captain Kaji while no witness remains in a storm-water lane.', protectedTokens: ['witness-a', 'witness-b'], failure: 'all-active-party-defeated-or-all-witnesses-lost' },
    lesson: { primary: 'Guard, facing, and Genta’s anchor prevent hook drags into declared hazard tiles.', playerRead: 'Kaji’s hook endpoint and crane charge are marked one activation before resolution.', successSignal: 'Genta anchors someone before Kaji’s strongest hook.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta'], deployment: partyDeployment([['ren', '2,4'], ['aya', '2,3'], ['lise', '3,4'], ['mateus', '3,3'], ['genta', '2,5']]), objectiveTokens: [{ id: 'witness-a', at: '1,2' }, { id: 'witness-b', at: '1,5' }] },
    enemies: [
      {
        id: 'captain-kaji', name: 'Captain Kaji', count: 1, positions: ['8,3'], role: 'hook-and-crane commander',
        stats: { hp: 620, power: 20, guard: 17, speed: 101 },
        resistances: { delivery: { cut: 1, pierce: 1, crush: 0.75, arcane: 1 }, essence: { ember: 1, frost: 1, storm: 0.75, radiance: 1, umbral: 1 } },
        ledger: 'A human captain who turns cargo equipment into weapons. Disarm; do not make a spectacle of execution.',
        skills: [
          { id: 'chain-haul', name: 'Chain Haul', delivery: 'pierce', power: 17, range: 5, shape: { type: 'line', length: 5, origin: 'kaji-facing' }, telegraph: 'A yellow hook line locks to a target before the pull.', recoveryPulses: 2, dodgeable: true, effect: { pull: { spaces: 2 } } },
          { id: 'crane-surge', name: 'Crane Surge', delivery: 'arcane', essence: 'storm', power: 19, range: 6, shape: { type: 'zone', tiles: ['4,1', '5,1', '6,1', '7,1', '4,5', '5,5', '6,5', '7,5'] }, telegraph: 'Both crane lanterns flash on the storm-water lanes.', recoveryPulses: 3, dodgeable: false, effect: { status: 'shock', duration: 'one-activation' } },
          { id: 'salt-cut', name: 'Salt Cut', delivery: 'cut', power: 16, range: 1, telegraph: 'Kaji squares up at adjacent range.', recoveryPulses: 0, dodgeable: true },
        ], ai: ['If a witness can be pulled into water, Chain Haul.', 'Every third activation, Crane Surge.', 'Salt Cut at adjacency.'],
      },
    ],
    bossMechanic: { type: 'forced-movement-hazard', telegraphs: ['chain-haul', 'crane-surge'], counterplay: 'Guard reduces the incoming hook hit; Genta Anchor prevents the pull; move witnesses before the crane charge.', resolution: 'Dock workers take Kaji alive after witnessing his order.' },
    reward: { keyItems: ['First bell key'], party: ['Genta joins permanently'], story: 'Genta gives a full account of the orders he carried.' },
  },

  {
    id: 'c4-fog-nets',
    chapterId: 'chapter-4',
    levelId: 'ngi-tide-caves',
    name: 'Bell-Fog Nets',
    format: 'field-encounter',
    objective: { type: 'clearRoute', text: 'Clear bell fog from three net anchors and make a dry lantern route for the fishers.', anchors: 3, failure: 'all-active-party-defeated' },
    lesson: { primary: 'Elemental tools affect terrain in a small, explicit way.', playerRead: 'Ember on a marked wet tile creates a Dry Lantern space for two rounds.', successSignal: 'A fisher token crosses the created dry route.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '2,4'], ['aya', '2,3'], ['lise', '3,4'], ['mateus', '3,3'], ['genta', '3,5'], ['kiku', '4,4']]) },
    enemies: [
      {
        id: 'fog-skimmer', name: 'Fog Skimmer', count: 3, positions: ['7,1', '9,3', '7,5'], role: 'water-zone harrier',
        stats: { hp: 118, power: 14, guard: 8, speed: 99 },
        resistances: { delivery: { cut: 1, pierce: 1, crush: 1, arcane: 1 }, essence: { ember: 1.25, frost: 0.75, storm: 1, radiance: 1, umbral: 1 } },
        ledger: 'Fog given a fin. Ember exposes it; Frost feeds its cold wake.',
        skills: [{ id: 'cold-wake', name: 'Cold Wake', delivery: 'arcane', essence: 'frost', power: 12, range: 3, shape: { type: 'trail', length: 3 }, telegraph: 'A pale blue wake marks three tiles.', recoveryPulses: 1, dodgeable: false, effect: { status: 'chill', duration: 'next-activation' } }],
        ai: ['Lay Cold Wake through the nearest wet route.', 'Otherwise hold a net anchor.'],
      },
    ],
    bossMechanic: { type: 'terrain-creation', telegraphs: ['cold-wake'], rule: 'Kiku or an Ember skill converts only marked wet tiles; it does not erase the level’s whole terrain system.' },
    reward: { flags: ['nagi-passage-earned'], story: 'Fishers offer passage after practical help, not a speech.' },
  },

  {
    id: 'c4-widow-of-fog',
    chapterId: 'chapter-4',
    primary: true,
    levelId: 'ngi-storm-reef',
    name: 'Widow-of-Fog',
    format: 'boss',
    objective: { type: 'defeatBoss', text: 'Break the fog bell and return the sailors’ names during changing tide states.', failure: 'all-active-party-defeated' },
    lesson: { primary: 'Terrain phases change safely when their cadence and safe tiles are stated in advance.', playerRead: 'The waterline warns one full boss activation before High Tide or Low Tide changes the safe tiles.', successSignal: 'The party moves toward the next safe terrain rather than reacting after damage.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '2,4'], ['aya', '2,3'], ['lise', '3,4'], ['mateus', '3,3'], ['genta', '2,5'], ['kiku', '3,2']]) },
    enemies: [
      {
        id: 'widow-of-fog', name: 'Widow-of-Fog', count: 1, positions: ['6,3'], role: 'tide-phase ghost',
        stats: { hp: 720, power: 19, guard: 14, speed: 95 },
        resistances: { delivery: { cut: 1, pierce: 1, crush: 1, arcane: 0.75 }, essence: { ember: 1.25, frost: 0.75, storm: 1, radiance: 1.25, umbral: 0.5 } },
        ledger: 'Bell-made fog repeating sailors’ unrecorded names. Frost 75%; Ember 125%; Radiance 125%.',
        skills: [
          { id: 'receding-call', name: 'Receding Call', delivery: 'arcane', essence: 'frost', power: 16, range: 4, shape: { type: 'ring', radius: 2, origin: 'widow' }, telegraph: 'The fog draws inward and names a tide state for the next activation.', recoveryPulses: 2, dodgeable: false },
          { id: 'name-drag', name: 'Name Drag', delivery: 'arcane', essence: 'umbral', power: 15, range: 5, shape: { type: 'line', length: 3, origin: 'widow-facing' }, telegraph: 'A sailor name trails across a three-tile pull path.', recoveryPulses: 1, dodgeable: false, effect: { pull: { spaces: 1 } } },
        ], ai: ['Alternate Receding Call and Name Drag.', 'Switch tide state every two boss activations.'],
      },
    ],
    bossMechanic: { type: 'tide-phase', telegraphs: ['receding-call', 'name-drag'], phases: [{ id: 'high-tide', safeTiles: ['2,3', '9,3'] }, { id: 'low-tide', safeTiles: ['4,1', '5,1', '6,1', '7,1', '4,5', '5,5', '6,5', '7,5'] }], counterplay: 'Use Ember to create dry safety and strike with Ember or Radiance.' },
    reward: { keyItems: ['Second bell key'], party: ['Kiku joins permanently'], story: 'The sailors’ names return to the survivors rather than becoming loot.' },
  },

  {
    id: 'c5-ashen-release',
    chapterId: 'chapter-5',
    levelId: 'kgr-ash-fields',
    name: 'Bound Ashen Oni — Name Release',
    format: 'nonlethal-encounter',
    objective: { type: 'releaseTarget', text: 'Return the name slip to the speaking Ashen Oni; defeat is not the intended solution.', targetId: 'bound-ashen-oni', failure: 'all-active-party-defeated' },
    lesson: { primary: 'A nonlethal objective can change an enemy state without adding a separate moral meter.', playerRead: 'Aya’s Analyze identifies the name-slip tile and the release action.', successSignal: 'The enemy’s hostile intents cease when the slip reaches water or its spoken-name tile.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '2,3'], ['aya', '2,2'], ['lise', '3,3'], ['mateus', '3,2'], ['genta', '2,4'], ['kiku', '3,4']]) },
    enemies: [
      {
        id: 'bound-ashen-oni', name: 'Bound Ashen Oni', count: 1, positions: ['8,3'], role: 'releaseable bell-forged soldier',
        stats: { hp: 480, power: 18, guard: 18, speed: 84 },
        resistances: { delivery: { cut: 0.75, pierce: 1.25, crush: 0.75, arcane: 1 }, essence: { ember: 1, frost: 1.25, storm: 1, radiance: 1.25, umbral: 0.75 } },
        ledger: 'Fabricated court armor around a stolen name; “oni” is a frightened in-world label, not a canonical design claim.',
        skills: [{ id: 'ash-guard-swing', name: 'Ash Guard Swing', delivery: 'crush', essence: 'ember', power: 16, range: 1, telegraph: 'The ash shell raises a heavy arm.', recoveryPulses: 2, dodgeable: true }],
        ai: ['Use Ash Guard Swing at adjacency.', 'Otherwise walk toward the name-slip guard tile.', 'Turn neutral as soon as the name release resolves.'],
      },
    ],
    bossMechanic: { type: 'nonlethal-release', telegraphs: ['ash-guard-swing'], rule: 'The target remains defensible but killing it cannot satisfy the objective; release changes the encounter result.' },
    reward: { flags: ['first-ashen-name-returned'], story: 'The released person points the party toward the cipher room.' },
  },

  {
    id: 'c5-furnace-abbot',
    chapterId: 'chapter-5',
    primary: true,
    levelId: 'kgr-archive-furnace',
    name: 'Furnace Abbot',
    format: 'boss',
    objective: { type: 'defeatBoss', text: 'Overheat the Furnace Abbot, exploit its recovery, and open the prison locks.', failure: 'all-active-party-defeated' },
    lesson: { primary: 'Absorb is distinct from resist; a punishing attack can still create the safest offensive window.', playerRead: 'Ember prints “Absorb −100%,” Crush prints 75%, and Frost/Pierce become highlighted after Forge Sermon.', successSignal: 'The party waits through Forge Sermon, then acts in Recovery 3.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '2,3'], ['aya', '2,2'], ['lise', '3,3'], ['mateus', '3,2'], ['genta', '2,4'], ['kiku', '3,4']]) },
    enemies: [
      {
        id: 'furnace-abbot', name: 'Furnace Abbot', count: 1, positions: ['8,3'], role: 'forge command construct',
        stats: { hp: 860, power: 24, guard: 21, speed: 86 },
        resistances: { delivery: { cut: 1, pierce: 1.25, crush: 0.75, arcane: 1 }, essence: { ember: -1, frost: 1.25, storm: 1, radiance: 1, umbral: 0.75 } },
        ledger: 'A bell-forged command construct. Ember heals it; Frost disrupts the furnace shell.',
        skills: [
          { id: 'forge-sermon', name: 'Forge Sermon', delivery: 'arcane', essence: 'ember', power: 23, range: 5, shape: { type: 'markedTiles', tiles: ['3,2', '4,2', '7,2', '8,2', '3,4', '4,4', '7,4', '8,4'] }, telegraph: 'Eight furnace grates glow for two notes.', recoveryPulses: 3, dodgeable: false, effect: { status: 'scorch', duration: 'one-command', selfStatus: 'overheated' } },
          { id: 'hammer-decree', name: 'Hammer Decree', delivery: 'crush', power: 19, range: 2, shape: { type: 'front', length: 2 }, telegraph: 'The Abbot locks a hammer line.', recoveryPulses: 1, dodgeable: true },
        ], ai: ['Use Forge Sermon every third activation.', 'Use Hammer Decree if two targets are in front.', 'Otherwise advance.'],
      },
    ],
    bossMechanic: { type: 'overheat-window', telegraphs: ['forge-sermon', 'hammer-decree'], phases: [{ id: 'forge', when: 'hp-above-50', rule: 'Forge Sermon creates hazards and applies Overheated.' }, { id: 'sigil-break', when: 'hp-at-or-below-50', rule: 'Mateus burns his court sigil to unlock prison doors while the boss is recovering.' }], counterplay: 'Create Frost footing, avoid grates, then Pierce during Overheated Recovery 3.' },
    reward: { story: 'Forge records expose Ujiro and Kurozane’s manufactured raids; Mateus burns his court sigil.' },
  },

  {
    id: 'c6-masked-clerks',
    chapterId: 'chapter-6',
    levelId: 'kzu-archive-roof',
    name: 'Printmaker Flight — Masked Clerks',
    format: 'protect-objective',
    objective: { type: 'protectObjects', text: 'Escort the civilian courier and preserve three print blocks through four enemy activations.', protectedObjects: ['courier', 'print-block-a', 'print-block-b', 'print-block-c'], turns: 4, failure: 'courier-defeated-or-two-print-blocks-destroyed' },
    lesson: { primary: 'Threat triage makes “who acts next” more important than simply focusing the highest HP target.', playerRead: 'Each clerk’s target is marked directly on a courier or print block.', successSignal: 'The party can interrupt one order while protecting another target.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '3,4'], ['aya', '2,3'], ['lise', '3,3'], ['mateus', '4,3'], ['genta', '2,4'], ['kiku', '3,5']]) },
    enemies: [
      {
        id: 'masked-clerk', name: 'Masked Clerk', count: 3, positions: ['8,1', '9,3', '8,5'], role: 'objective saboteur',
        stats: { hp: 142, power: 14, guard: 10, speed: 100 }, resistances: neutralResistances,
        ledger: 'A court clerk choosing to seize evidence. The mask conceals responsibility; it does not remove it.',
        skills: [
          { id: 'seize-copy', name: 'Seize Copy', delivery: 'arcane', essence: 'umbral', power: 0, range: 5, shape: { type: 'singleObjective', selection: 'nearest-print-block-or-courier' }, telegraph: 'A black writ pins the chosen objective one activation early.', recoveryPulses: 2, dodgeable: false, effect: { objectiveDamage: 1 } },
          { id: 'seal-snap', name: 'Seal Snap', delivery: 'crush', power: 12, range: 1, telegraph: 'A seal stamp is raised.', recoveryPulses: 0, dodgeable: true },
        ], ai: ['Target the least-protected print block.', 'Target the courier if two blocks are guarded.', 'Seal Snap only when blocked.'],
      },
    ],
    bossMechanic: { type: 'multi-objective-countdown', telegraphs: ['seize-copy'], rule: 'The encounter ends when copies leave; killing every clerk is optional once the timed objective resolves.' },
    reward: { flags: ['three-evidence-bundles-dispatched'], story: 'The public proof travels by three routes.' },
  },

  {
    id: 'c6-ujiro',
    chapterId: 'chapter-6',
    primary: true,
    levelId: 'kzu-public-tribunal',
    name: 'Magistrate Ujiro Arata',
    format: 'boss',
    objective: { type: 'disableOrdersAndProtect', text: 'Disable Ujiro’s command actions and preserve all three print blocks until the canal lock opens.', protectedObjects: ['print-block-a', 'print-block-b', 'print-block-c'], failure: 'two-print-blocks-destroyed-or-all-active-party-defeated' },
    lesson: { primary: 'A human boss can be tactically dangerous through commands, summons, and legal hazard zones without becoming supernaturally invulnerable.', playerRead: 'Seizure Order shows its exact targets and next activation in the Tempo ribbon.', successSignal: 'The party interrupts a command action rather than only attacking Ujiro.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '2,3'], ['aya', '2,2'], ['lise', '3,3'], ['mateus', '3,2'], ['genta', '2,4'], ['kiku', '3,4']]) },
    enemies: [
      {
        id: 'ujiro', name: 'Magistrate Ujiro Arata', count: 1, positions: ['8,3'], role: 'command-and-summon human boss',
        stats: { hp: 690, power: 18, guard: 15, speed: 105 },
        resistances: { delivery: { cut: 1, pierce: 1, crush: 1, arcane: 0.75 }, essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: 1 } },
        ledger: 'A named human collaborator. His power is paperwork enforced through chosen violence.',
        skills: [
          { id: 'seizure-order', name: 'Seizure Order', delivery: 'arcane', essence: 'umbral', power: 0, range: 6, shape: { type: 'markedTiles', count: 2, selection: 'nearest-print-blocks' }, telegraph: 'Vermilion writs mark two objectives.', recoveryPulses: 2, dodgeable: false, effect: { objectiveDamage: 1 } },
          { id: 'call-clerks', name: 'Call Clerks', delivery: 'arcane', power: 0, range: 0, telegraph: 'The tribunal doors open behind Ujiro.', recoveryPulses: 1, dodgeable: false, effect: { summons: ['masked-clerk', 'masked-clerk'] } },
          { id: 'gavel-line', name: 'Gavel Line', delivery: 'crush', power: 16, range: 4, shape: { type: 'line', length: 4, origin: 'ujiro-facing' }, telegraph: 'A legal seal stamps a straight lane.', recoveryPulses: 1, dodgeable: true, effect: { status: 'bound', duration: 'one-activation' } },
        ], ai: ['If a print block is below 2 HP, use Seizure Order.', 'If fewer than two clerks live, Call Clerks.', 'Otherwise Gavel Line at the largest cluster.'],
      },
    ],
    bossMechanic: { type: 'command-interruption', telegraphs: ['seizure-order', 'call-clerks', 'gavel-line'], counterplay: 'Interrupt orders, protect the print blocks, and use Radiance against his arcane defense; he retreats instead of dying in a duel.' },
    reward: { keyItems: ['Third bell key'], story: 'Copies escape; Ujiro flees toward Kurohana after his secrecy fails.' },
  },

  {
    id: 'c7-name-slip-release',
    chapterId: 'chapter-7',
    levelId: 'hsh-prison-ferry',
    name: 'Hushroad Name-Slip Release',
    format: 'nonlethal-encounter',
    objective: { type: 'returnItemToTile', text: 'Carry a name slip to flowing water and release the bound patrol.', item: 'name-slip', targetTiles: ['2,1', '3,1'], failure: 'all-active-party-defeated' },
    lesson: { primary: 'Movement and swaps can solve a board objective that damage cannot.', playerRead: 'The carrying actor is marked and their route is visible.', successSignal: 'The patrol turns neutral and opens a safe route once the slip reaches water.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '2,3'], ['aya', '2,2'], ['lise', '3,3'], ['mateus', '3,2'], ['genta', '2,4'], ['kiku', '3,4']]) },
    enemies: [
      {
        id: 'bound-ashen-patrol', name: 'Bound Ashen Patrol', count: 2, positions: ['8,2', '8,4'], role: 'releaseable lane guards',
        stats: { hp: 330, power: 17, guard: 16, speed: 88 }, resistances: { delivery: { cut: 0.75, pierce: 1.25, crush: 0.75, arcane: 1 }, essence: { ember: 1, frost: 1.25, storm: 1, radiance: 1.25, umbral: 0.75 } },
        ledger: 'Bound people in ash armor. Returning the slip, not depletion, ends the command.',
        skills: [{ id: 'chain-wall', name: 'Chain Wall', delivery: 'crush', power: 15, range: 2, shape: { type: 'front', length: 2 }, telegraph: 'A chain line locks across the carrier route.', recoveryPulses: 2, dodgeable: true, effect: { status: 'bound', duration: 'one-activation' } }],
        ai: ['Block the name-slip carrier’s shortest route.', 'Attack only when the carrier is adjacent.', 'Turn neutral after a release.'],
      },
    ],
    bossMechanic: { type: 'carry-and-release', telegraphs: ['chain-wall'], rule: 'The player can change carrier with a Swap but pays its one-pulse recovery.' },
    reward: { flags: ['c7-first-name-released'], story: 'The released patrol reveals a safer prisoner route.' },
  },

  {
    id: 'c7-bell-warden-chiyo',
    chapterId: 'chapter-7',
    primary: true,
    levelId: 'hsh-bell-aqueduct',
    name: 'Bell Warden Chiyo',
    format: 'boss-rescue',
    objective: { type: 'extractAllBeforeCountdown', text: 'Break chains and extract all prisoners before the fourth bell count. Defeating Chiyo alone is a tactical loss.', targets: ['prisoner-a', 'prisoner-b', 'prisoner-c'], maxBossCounts: 4, failure: 'countdown-complete-or-all-active-party-defeated' },
    lesson: { primary: 'Rescue spaces, swaps, and countdowns turn positioning into an explicit win condition.', playerRead: 'Every prisoner chain, extraction zone, and next bell count is permanently visible.', successSignal: 'The player values extraction over lethal damage when the count becomes urgent.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '2,3'], ['aya', '2,2'], ['lise', '3,3'], ['mateus', '3,2'], ['genta', '2,4'], ['kiku', '3,4']]), objectiveTokens: [{ id: 'prisoner-a', at: '8,1' }, { id: 'prisoner-b', at: '9,3' }, { id: 'prisoner-c', at: '8,5' }] },
    enemies: [
      {
        id: 'bell-warden-chiyo', name: 'Bell Warden Chiyo', count: 1, positions: ['6,3'], role: 'chain-countdown commander',
        stats: { hp: 780, power: 21, guard: 18, speed: 103 },
        resistances: { delivery: { cut: 1, pierce: 1, crush: 0.75, arcane: 1 }, essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: 0.75 } },
        ledger: 'A court warden using chained people as leverage. The system demands rescue, not a body count.',
        skills: [
          { id: 'ringing-count', name: 'Ringing Count', delivery: 'arcane', essence: 'umbral', power: 0, range: 0, telegraph: 'The next count number appears over every prisoner.', recoveryPulses: 2, dodgeable: false, effect: { countdownDelta: 1, chainStrengthDelta: 1 } },
          { id: 'chain-cast', name: 'Chain Cast', delivery: 'pierce', power: 15, range: 4, shape: { type: 'chainLine', count: 1, origin: 'warden' }, telegraph: 'A chain picks an unoccupied rescue space.', recoveryPulses: 1, dodgeable: true, effect: { pull: { spaces: 1 }, status: 'bound' } },
          { id: 'warden-bell', name: 'Warden Bell', delivery: 'crush', power: 18, range: 2, shape: { type: 'radius', radius: 1, origin: 'warden' }, telegraph: 'The bell guard expands around Chiyo.', recoveryPulses: 1, dodgeable: true },
        ], ai: ['Use Ringing Count every second activation.', 'Chain Cast at the nearest rescuer.', 'Warden Bell when surrounded.'],
      },
    ],
    bossMechanic: { type: 'rescue-countdown', telegraphs: ['ringing-count', 'chain-cast', 'warden-bell'], counterplay: 'Break chains, Swap a rescuer into an extraction space, and ignore lethal damage when the countdown dictates it.' },
    reward: { story: 'Rescued communities carry the warning to the Lantern Network; the final ritual begins anyway.' },
  },

  {
    id: 'c8-outer-court',
    chapterId: 'chapter-8',
    levelId: 'c8-black-gate',
    name: 'Outer Court Lantern Breach',
    format: 'party-combination',
    objective: { type: 'activateRelays', text: 'Stabilize two lantern relays while releasing the outer Ashen garrison.', relays: ['lantern-relay-west', 'lantern-relay-east'], failure: 'all-active-party-defeated' },
    lesson: { primary: 'The six-character party combines around familiar hazards rather than each receiving a disconnected puzzle.', playerRead: 'Each relay names which role can help: ward, remedy, anchor, redirect, expose, or protect.', successSignal: 'The player deliberately sequences at least two roles on the same lane.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '2,3'], ['aya', '2,2'], ['lise', '3,3'], ['mateus', '3,2'], ['genta', '2,4'], ['kiku', '3,4']]) },
    enemies: [
      {
        id: 'ashen-garrison', name: 'Ashen Garrison', count: 3, positions: ['8,1', '9,3', '8,5'], role: 'hazard-lane guard',
        stats: { hp: 280, power: 18, guard: 16, speed: 90 }, resistances: { delivery: { cut: 0.75, pierce: 1.25, crush: 0.75, arcane: 1 }, essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: 0.75 } },
        ledger: 'Bell-forged garrison. Reveal the name slip at the relay to release it rather than grind it down.',
        skills: [{ id: 'ash-lane-guard', name: 'Ash Lane Guard', delivery: 'arcane', essence: 'ember', power: 14, range: 3, shape: { type: 'line', length: 3, origin: 'garrison-facing' }, telegraph: 'Orange and violet ash mark the lane before it flares.', recoveryPulses: 1, dodgeable: false }],
        ai: ['Guard the unlit relay.', 'Attack anyone carrying a revealed name slip.', 'Turn neutral once the relay release resolves.'],
      },
    ],
    bossMechanic: { type: 'combination-relays', telegraphs: ['ash-lane-guard'], rule: 'Aya wards, Kiku alters terrain, Genta anchors, Ren redirects, Lise exposes, and Mateus protects; no role is mandatory for every action.' },
    reward: { flags: ['outer-court-relays-lit'], story: 'Lantern signals show people inside the castle that outer routes remain open.' },
  },

  {
    id: 'c8-lady-enma',
    chapterId: 'chapter-8',
    primary: true,
    levelId: 'c8-black-gate',
    name: 'Lady Enma of Ash',
    format: 'boss',
    objective: { type: 'defeatBossAndRelease', text: 'Defeat Lady Enma while turning Ember and Umbral ash lanes into safe routes for the garrison release.', failure: 'all-active-party-defeated' },
    lesson: { primary: 'Late-game hazards remain readable because the tag, essence, and counter-role never change.', playerRead: 'Orange means Ember and violet means Umbral on every telegraph and tile.', successSignal: 'The party creates or holds a safe lane before Enma’s paired zone resolves.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '2,3'], ['aya', '2,2'], ['lise', '3,3'], ['mateus', '3,2'], ['genta', '2,4'], ['kiku', '3,4']]) },
    enemies: [
      {
        id: 'lady-enma', name: 'Lady Enma of Ash', count: 1, positions: ['8,3'], role: 'paired-hazard commander',
        stats: { hp: 910, power: 25, guard: 20, speed: 105 },
        resistances: { delivery: { cut: 1, pierce: 1, crush: 0.75, arcane: 0.75 }, essence: { ember: 0.75, frost: 1.25, storm: 1, radiance: 1.25, umbral: 0.75 } },
        ledger: 'A court officer carrying ashes of the disappeared; the garrison can be released, not merely destroyed.',
        skills: [
          { id: 'paired-ashes', name: 'Paired Ashes', delivery: 'arcane', power: 21, range: 6, shape: { type: 'pairedZones', tags: ['ember-ash', 'umbral-ash'] }, telegraph: 'Enma paints one orange and one violet lane before they ignite.', recoveryPulses: 2, dodgeable: false, effect: { essenceByTag: { 'ember-ash': 'ember', 'umbral-ash': 'umbral' } } },
          { id: 'abandonment-cry', name: 'Abandonment Cry', delivery: 'arcane', essence: 'umbral', power: 17, range: 4, shape: { type: 'cone', length: 3 }, telegraph: 'A violet cone points at the nearest isolated ally.', recoveryPulses: 1, dodgeable: false, effect: { status: 'dread', duration: 'one-activation' } },
        ], ai: ['Use Paired Ashes every other activation.', 'Use Abandonment Cry against an isolated ally.', 'Prioritize an unlit relay.'],
      },
    ],
    bossMechanic: { type: 'paired-elemental-hazards', telegraphs: ['paired-ashes', 'abandonment-cry'], counterplay: 'Ward, terrain change, anchor, redirect, expose, and protection all answer a declared lane; Frost is Enma’s strongest elemental weakness.' },
    reward: { story: 'The Ashen garrison is released and the Black Gate opens by collective choice.' },
  },

  {
    id: 'c9-archive-nodes',
    chapterId: 'chapter-9',
    levelId: 'krh-outer-archive',
    name: 'Kurohana Archive Node Release',
    format: 'dungeon-objective',
    objective: { type: 'breakObjects', text: 'Use the three bell keys to break three archive nodes while protecting released spirits.', objectCount: 3, failure: 'all-active-party-defeated-or-three-spirits-lost' },
    lesson: { primary: 'The final dungeon restates earlier rescue priorities before the final boss.', playerRead: 'Each node has a key slot, HP bar, and a spirit escape lane.', successSignal: 'The party creates a path for a released spirit instead of only maximizing damage.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '2,3'], ['aya', '2,2'], ['lise', '3,3'], ['mateus', '3,2'], ['genta', '2,4'], ['kiku', '3,4']]) },
    enemies: [
      {
        id: 'archive-warden', name: 'Archive Warden', count: 2, positions: ['8,2', '8,4'], role: 'node defender',
        stats: { hp: 380, power: 20, guard: 18, speed: 96 }, resistances: { delivery: { cut: 0.75, pierce: 1.25, crush: 0.75, arcane: 1 }, essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: 0.5 } },
        ledger: 'A court record made into a body. The node is the objective; released spirits need a lane.',
        skills: [{ id: 'catalogue-line', name: 'Catalogue Line', delivery: 'arcane', essence: 'umbral', power: 17, range: 4, shape: { type: 'line', length: 4 }, telegraph: 'Paper pages stand upright along a line.', recoveryPulses: 2, dodgeable: false, effect: { status: 'bound', duration: 'one-activation' } }],
        ai: ['Block spirit escape lanes.', 'Use Catalogue Line on key carriers.', 'Retreat toward the next intact node.'],
      },
    ],
    bossMechanic: { type: 'node-and-escort', telegraphs: ['catalogue-line'], rule: 'The keys advance a route in authored order; this is a dungeon sequence, not a backtracking maze.' },
    reward: { flags: ['yearless-bell-path-open'], story: 'Named spirits leave the archive as the party reaches the observatory.' },
  },

  {
    id: 'c9-yearless-bell',
    chapterId: 'chapter-9',
    levelId: 'krh-observatory',
    name: 'Yearless Bell',
    format: 'boss-phase',
    objective: { type: 'breakPhaseObjects', text: 'Protect the archive core and break the four stage nodes before Kurozane fully manifests.', objectIds: ['north-node', 'east-node', 'south-node', 'west-node'], failure: 'archive-core-destroyed-or-all-active-party-defeated' },
    lesson: { primary: 'A multi-phase boss can expose a clear objective before its damage race begins.', playerRead: 'The active ring, node HP, and archive core HP never share a UI layer.', successSignal: 'The party uses position around the bell core to protect objects rather than chasing an invulnerable boss.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '2,3'], ['aya', '2,2'], ['lise', '3,3'], ['mateus', '3,2'], ['genta', '2,4'], ['kiku', '3,4']]) },
    enemies: [
      {
        id: 'yearless-bell', name: 'Yearless Bell', count: 1, positions: ['6,1'], role: 'invulnerable phase-object',
        stats: { hp: 1, power: 23, guard: 99, speed: 98 }, resistances: { delivery: { cut: 0, pierce: 0, crush: 0, arcane: 0 }, essence: { ember: 0, frost: 0, storm: 0, radiance: 0, umbral: 0 } },
        ledger: 'The bell core cannot take damage while any stage node remains. The nodes and archive core are visible objectives.',
        skills: [{ id: 'yearless-ring', name: 'Yearless Ring', delivery: 'arcane', essence: 'umbral', power: 20, range: 4, shape: { type: 'ring', center: 'bell-core', radii: [2, 3] }, telegraph: 'The next violet ring lights for one full activation.', recoveryPulses: 2, dodgeable: false, effect: { status: 'dread', duration: 'one-activation' } }],
        ai: ['Alternate radius 2 and radius 3 rings.', 'Target the archive core only if no hero occupies its protection lane.'],
      },
    ],
    bossMechanic: { type: 'node-protection-phase', telegraphs: ['yearless-ring'], rule: 'Phase resolves only when four nodes fall; Kurozane’s damage phase begins afterward.' },
    reward: { flags: ['kurozane-manifested'], story: 'The Yearless Bell loses its ward and daylight starts to reach the observatory.' },
  },

  {
    id: 'c9-kurozane',
    chapterId: 'chapter-9',
    primary: true,
    levelId: 'krh-observatory',
    name: 'Shogun Kurozane, the Black Chrysanthemum',
    format: 'final-boss',
    objective: { type: 'defeatBossAndEvacuate', text: 'Defeat Kurozane, protect the surviving archive evidence, and leave through the evacuation exit.', failure: 'all-active-party-defeated-or-archive-core-destroyed' },
    lesson: { primary: 'The final exam recombines every taught system without a new hidden rule.', playerRead: 'Every phase repeats a known grammar: command clone, node position, then recovery window and Radiance dawn lane.', successSignal: 'The player explains why each phase has a positional, elemental, or recovery answer.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '2,3'], ['aya', '2,2'], ['lise', '3,3'], ['mateus', '3,2'], ['genta', '2,4'], ['kiku', '3,4']]) },
    enemies: [
      {
        id: 'kurozane', name: 'Shogun Kurozane', count: 1, positions: ['8,3'], role: 'vampire ruler and full-system final boss',
        stats: { hp: 1480, spirit: 220, power: 29, guard: 23, speed: 112 },
        resistances: { delivery: { cut: 0.75, pierce: 1, crush: 1, arcane: 0.5 }, essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: -1 } },
        ledger: 'Kurozane’s rule is a made system of fear, records, and blood. Umbral heals him; dawn exposes him.',
        skills: [
          { id: 'court-command', name: 'Court Command', delivery: 'arcane', essence: 'umbral', power: 0, range: 5, shape: { type: 'markedTiles', count: 2, selection: 'highest-tempo-allies' }, telegraph: 'Two black chrysanthemum seals mark future clone positions.', recoveryPulses: 1, dodgeable: false, effect: { summons: ['court-clone', 'court-clone'] } },
          { id: 'blood-eclipse', name: 'Blood Eclipse', delivery: 'arcane', essence: 'umbral', power: 24, range: 4, shape: { type: 'ring', center: 'kurozane', radii: [2] }, telegraph: 'A black-red ring surrounds Kurozane one activation before it closes.', recoveryPulses: 2, dodgeable: false, effect: { status: 'dread', duration: 'one-activation' } },
          { id: 'yearless-thrust', name: 'Yearless Thrust', delivery: 'pierce', essence: 'umbral', power: 23, range: 4, shape: { type: 'line', length: 4, origin: 'kurozane-facing' }, telegraph: 'The throne spear fixes a four-space lane.', recoveryPulses: 1, dodgeable: true },
          { id: 'black-chrysanthemum', name: 'Black Chrysanthemum', delivery: 'arcane', essence: 'umbral', power: 29, range: 6, shape: { type: 'cross', radius: 2, origin: 'bell-core' }, telegraph: 'Five petals bloom around the bell core over two activations.', recoveryPulses: 3, dodgeable: false, effect: { selfStatus: 'final-ward-open' } },
        ],
        ai: ['Phase 1: Court Command and Yearless Thrust.', 'Phase 2: move around nodes, then Blood Eclipse.', 'Phase 3: Black Chrysanthemum opens a Recovery 3 dawn window after Mateus cracks the ward.'],
      },
      {
        id: 'court-clone', name: 'Court Clone', count: 2, positions: [], role: 'temporary command summon',
        stats: { hp: 125, power: 14, guard: 8, speed: 104 }, resistances: { delivery: { cut: 1, pierce: 1, crush: 1, arcane: 0.75 }, essence: { ember: 1, frost: 1, storm: 1, radiance: 1.25, umbral: 0 } },
        ledger: 'A command made visible. Radiance clears it; Umbral only renews it.',
        skills: [{ id: 'clone-order', name: 'Clone Order', delivery: 'arcane', essence: 'umbral', power: 12, range: 3, telegraph: 'A small black seal selects a target.', recoveryPulses: 1, dodgeable: false }], ai: ['Spawn only through Court Command.', 'Attack archive-core protectors first.'],
      },
    ],
    bossMechanic: {
      type: 'three-phase-final-exam', telegraphs: ['court-command', 'blood-eclipse', 'yearless-thrust', 'black-chrysanthemum'],
      phases: [
        { id: 'court', when: 'hp-above-66-percent', rule: 'Command clones and spear lines test target priority and Pace.' },
        { id: 'bell', when: 'hp-66-to-34-percent', rule: 'Bell-node positioning and ring telegraphs test hazard lanes.' },
        { id: 'dawn', when: 'hp-at-or-below-33-percent', rule: 'Mateus gives up his strongest Umbral rite; Black Chrysanthemum has Recovery 3 and daylight grants Radiance 125%.' },
      ],
      counterplay: 'Never use Umbral on Kurozane, protect the archive core, use Pace against marked shapes, then spend the final Recovery window in the dawn lane.',
    },
    reward: { story: 'The bell network breaks, evidence survives, and the six heroes leave repair choices to living communities.' },
  },

  {
    id: 'epilogue-memorial-walk',
    chapterId: 'epilogue',
    primary: true,
    levelId: 'epi-hoshigawa-archive',
    name: 'Memorial Walk — Open Archive',
    format: 'noncombat-resolution',
    objective: { type: 'completeInteractions', text: 'Open the testimony table, record a correction, deliver medical supplies, and light the tower lantern.', interactions: ['testimony-table', 'corrections-shelf', 'unfiled-names', 'tower-lantern'], failure: 'none' },
    lesson: { primary: 'The closing interaction loop is repair and accountability, not a victory combat encounter.', playerRead: 'Every action names a concrete person-facing practice: testimony, correction, care, or contact.', successSignal: 'The final packet contains people asking after one another, not an order.' },
    party: { roster: ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'], deployment: partyDeployment([['ren', '10,10'], ['aya', '9,10'], ['lise', '11,10'], ['mateus', '8,10'], ['genta', '12,10'], ['kiku', '10,11']]) },
    enemies: [
      {
        id: 'unfiled-testimony', name: 'Unfiled Testimony', count: 1, positions: ['13,5'], role: 'non-hostile narrative obstacle',
        stats: { hp: 1, power: 0, guard: 0, speed: 0 }, resistances: neutralResistances,
        ledger: 'Not an enemy to defeat: a gap in a public record that must be acknowledged and kept open to correction.',
        skills: [], ai: ['No hostile actions. It resolves through Listen or Record Correction.'],
      },
    ],
    bossMechanic: { type: 'noncombat-repair-loop', telegraphs: [], rule: 'No damage, Tempo race, or hostile action occurs. This record exists in the shared encounter schema so the campaign can load a playable ending.' },
    reward: { flags: ['epilogue-testimony-opened'], story: 'The repaired tower holds a lantern; the bell remains silent.' },
  },
];

export function getEncounter(id) {
  return ENCOUNTERS.find((encounter) => encounter.id === id) ?? null;
}

export function isBossEncounter(encounter) {
  return typeof encounter?.format === 'string' && encounter.format.includes('boss');
}

export function getEncountersForChapter(chapterId) {
  return ENCOUNTERS.filter((encounter) => encounter.chapterId === chapterId);
}

export function getEncounterForChapter(chapterId) {
  const chapterEncounters = getEncountersForChapter(chapterId);
  return chapterEncounters.find((encounter) => encounter.primary) ?? chapterEncounters[0] ?? null;
}

export function getEncountersForLevel(levelId) {
  return ENCOUNTERS.filter((encounter) => encounter.levelId === levelId);
}

/** Lightweight authoring validation, intentionally independent of a renderer. */
export function validateEncounter(encounter) {
  const errors = [];
  if (!encounter?.id) errors.push('missing id');
  if (!encounter?.chapterId) errors.push('missing chapterId');
  if (!encounter?.levelId) errors.push('missing levelId');
  if (!encounter?.objective?.type) errors.push('missing objective type');
  if (!encounter?.lesson?.primary) errors.push('missing lesson');
  if (!Array.isArray(encounter?.enemies) || encounter.enemies.length === 0) errors.push('missing enemies');
  if (!encounter?.bossMechanic?.type) errors.push('missing boss mechanic');
  for (const enemy of encounter?.enemies ?? []) {
    if (!enemy.id || !enemy.name) errors.push(`incomplete enemy in ${encounter.id}`);
    if (!enemy.resistances?.delivery || !enemy.resistances?.essence) errors.push(`missing ledger resistances for ${enemy.id}`);
  }
  return errors;
}
