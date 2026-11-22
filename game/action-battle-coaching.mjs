/**
 * Progressive, presentation-only coaching for the opening action encounters.
 */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const OPENING_ACTION_ENCOUNTER_IDS = Object.freeze([
  'prologue-ashen-bailiff',
  'c1-cinder-hounds',
  'c1-ash-wisps',
  'c1-tithe-hound',
  'fp1-cedar-path',
  'fp1-flooded-archive',
  'fp1-mateus',
]);

const BASE = deepFreeze({
  title: 'Fight, read, recover',
  summary: 'Move freely while attack timers recover. A committed attack briefly locks movement, so strike after a telegraph or from safe spacing.',
  steps: [
    'Move with Left/Right or A/D.',
    'Use Z/J for the weapon and X/K for the character art.',
    'Watch the objective and enemy warning shapes; movement remains available during cooldown.',
    'Hits drain the poise pips under an enemy; a hit during a glowing wind-up can break it and stagger the enemy.',
  ],
});

const OPENING = deepFreeze({
  'prologue-ashen-bailiff': {
    title: 'Survive—do not kill Sato',
    summary: 'The Ashen Bailiff is an imprisoned villager. Avoid three completed attacks, then run to the marked river exit.',
    steps: [
      'Leave the long red warning line before it resolves.',
      'Attacking is optional; movement and survival are the lesson.',
      'After three enemy attacks, follow the gold exit marker and press E/B if prompted.',
    ],
  },
  'c1-cinder-hounds': {
    title: 'A resisted hit is information',
    summary: 'Cinder Hounds resist Cut and are weak to Pierce. Aya wards Ren from reserve while he fights.',
    steps: [
      'Use the weapon and art once each; compare the damage labels.',
      'Dash through or leave a hound’s red lunge lane.',
      'Keep moving while the attack timer counts down.',
    ],
  },
  'c1-ash-wisps': {
    title: 'Break the charge',
    summary: 'Ash Wisps ignore Umbral damage and open to Radiance. Focus one low-health wisp at a time.',
    steps: [
      'Strike a wisp while its charge glows: an art breaks the charge and staggers the wisp.',
      'Use the brighter Radiance art when available.',
      'A defeated wisp removes an entire source of pressure.',
    ],
  },
  'c1-tithe-hound': {
    title: 'Wait for the exposed seal',
    summary: 'Consume Ink draws a dark line and exposes the Hound’s seal. Evade first; Aya heals from reserve while Ren answers the recovery window.',
    steps: [
      'Leave the published line before Consume Ink lands, or break its long wind-up with Cinder Route.',
      'Target the low-health exposed seal when it appears.',
      'Pierce or Radiance gives the clearest result.',
    ],
  },
  'fp1-cedar-path': {
    title: 'Control the formation',
    summary: 'Remove the Ash Wisp first, then separate the two hounds so their lunge lanes do not overlap.',
    steps: [
      'Focus the lowest-health enemy instead of spreading damage.',
      'Dash through a lunge lane instead of trading repeated hits.',
      'Aya remains in reserve and heals Ren below the ward threshold.',
    ],
  },
  'fp1-flooded-archive': {
    title: 'Moths first, shield second',
    summary: 'Bell Moths multiply pressure. Clear them before committing to the guarded Tithe Enforcer.',
    steps: [
      'Use movement and long-reach arts to remove each moth.',
      'Pierce and Radiance are strong against the Enforcer.',
      'Do not stand in the Hook line when its shield points toward you.',
    ],
  },
});


/*
 * Encounter-authoritative battle reads for the seven premium painted bosses
 * and Kurozane. These are gameplay cues, independent of the HD art lane and
 * its pending visual approvals. Every mechanic and objective comes from
 * content/encounters.mjs; hints may follow the live boss phase.
 */
const LATE_BOSS_COACHING = deepFreeze({
  'c3-captain-kaji': {
    title: 'Protect the dock witnesses',
    summary: 'Chain Haul and Crane Surge mark their paths before impact. Keep both witnesses clear while disarming Kaji.',
    steps: [
      'Leave the yellow hook path before Chain Haul pulls its target.',
      'Move away from the marked storm-water lanes when both crane lanterns flash; keep the witnesses safe.',
      'Drain Kaji’s poise pips to interrupt his windup, then strike during recovery.',
    ],
  },
  'c4-widow-of-fog': {
    title: 'Move before the tide changes',
    summary: 'The waterline warns before High Tide and Low Tide exchange safe ground. Break the fog bell while staying ahead of the next tide.',
    steps: [
      'Watch the waterline warning and cross toward the next safe section before the tide shifts.',
      'Leave the three-space Name Drag line and the announced Receding Call ring.',
      'Ember and Radiance are stronger against the Widow; Umbral damage is heavily resisted.',
    ],
  },
  'c5-furnace-abbot': {
    title: 'Answer the Forge Sermon',
    summary: 'The Abbot absorbs Ember. The marked grates of Forge Sermon open a long recovery and an Overheated damage window.',
    steps: [
      'Avoid the glowing furnace grates before Forge Sermon releases.',
      'Use Frost or Pierce while the Abbot is Overheated and recovering.',
      'Watch the phase change below half health as the prison-lock sequence opens.',
    ],
  },
  'c6-ujiro': {
    title: 'Save the tribunal print blocks',
    summary: 'Seizure Order marks two protected blocks. Interrupt the command and keep all three blocks intact until the canal lock opens.',
    steps: [
      'Read the vermilion writs to identify which print blocks are under threat.',
      'Interrupt Seizure Order and clear the clerks before their commands compound.',
      'Use Radiance against Ujiro and protect the evidence through the encounter objective.',
    ],
  },
  'c7-bell-warden-chiyo': {
    title: 'Rescue the prisoners before four counts',
    summary: 'The prisoners are the objective. Free all three and reach extraction before the fourth bell count ends the rescue.',
    steps: [
      'Prioritize chain breaks and prisoner extraction over damaging Chiyo.',
      'Watch the next count and the marked extraction spaces while navigating Chain Cast.',
      'Use the objective interaction at authored rescue anchors; a boss defeat alone does not clear the rescue.',
    ],
  },
  'c8-lady-enma': {
    title: 'Hold a route between the ash lanes',
    summary: 'Paired Ashes marks an orange Ember lane and a violet Umbral lane. Expose a safe route before both ignite.',
    steps: [
      'Move into safety before the two marked lanes resolve.',
      'Keep the group together when Abandonment Cry targets an isolated ally.',
      'Use Frost or Radiance during Enma’s recovery to break her last mask.',
    ],
  },
  'c9-yearless-bell': {
    title: 'Break the four bell nodes',
    summary: 'The bell core is invulnerable while the stage nodes stand. Destroy all four nodes and defend the archive core.',
    steps: [
      'Target the north, east, south and west nodes rather than attacking the bell body.',
      'Leave the announced violet ring; its radius alternates between two and three tiles.',
      'Keep the archive core protected until all nodes fall and the phase resolves.',
    ],
  },
  'c9-kurozane': {
    title: 'Disrupt the court command',
    summary: 'The final fight opens with command clones and marked spear lanes. Umbral heals Kurozane; Radiance is effective.',
    steps: [
      'Remove summoned court clones while leaving the marked attack lanes.',
      'Protect the archive evidence as the encounter changes phases.',
      'Save Radiance pressure for a committed attack and its recovery window.',
    ],
  },
});

function lateBossCoaching(encounterId, snapshot) {
  const phase = snapshot?.bossPhase?.phaseId ?? null;
  if (encounterId === 'c5-furnace-abbot' && phase === 'sigil-break') {
    return {
      title: 'The prison locks are opening',
      summary: 'Below half health, Mateus breaks his court sigil as the Abbot recovers.',
      steps: [
        'Keep clear of Forge Sermon’s marked grates.',
        'Use Frost and Pierce to exploit the Overheated recovery window.',
        'Finish the objective while the prison doors are released.',
      ],
    };
  }
  if (encounterId === 'c8-lady-enma') {
    if (phase === 'subdued-for-terms' || snapshot?.outcome === 'victory') {
      return {
        title: 'Enma is subdued for the Three Terms',
        summary: 'The last mask is broken. Her death, custody or bounded defection is resolved by the following story decision.',
        steps: [
          'Complete the encounter objective and release the garrison.',
          'Continue to the witnessed Three Terms decision.',
          'The combat victory alone does not choose Enma’s fate.',
        ],
      };
    }
    if (phase === 'cinder-wing') {
      return {
        title: 'Read the Cinder Parasol Wing',
        summary: 'Below half health, Enma adds a longer signature windup with three recovery pulses.',
        steps: [
          'Hold a safe path between the orange and violet ash lanes.',
          'Watch the full Cinder Parasol Wing warning before committing.',
          'Use Frost or Radiance during the long recovery to break her last mask.',
        ],
      };
    }
  }
  if (encounterId === 'c9-kurozane') {
    if (snapshot?.outcome === 'victory') {
      return {
        title: 'Evacuate with the archive evidence',
        summary: 'Kurozane has fallen alive. Preserve the archive core and reach the exit before the Last Command decision.',
        steps: [
          'Follow the evacuation objective.',
          'Keep the surviving records protected.',
          'Continue to the witnessed political resolution after the fight.',
        ],
      };
    }
    if (phase === 'bell') {
      return {
        title: 'Read the bell-phase ring',
        summary: 'The middle phase tests safe positioning around the bell nodes and a declared ring attack.',
        steps: [
          'Leave the ring lane before impact.',
          'Keep the archive core protected as you change position.',
          'Use Radiance against Kurozane; Umbral heals him.',
        ],
      };
    }
    if (phase === 'dawn') {
      return {
        title: 'Strike in the dawn recovery',
        summary: 'Black Chrysanthemum announces a long recovery. The final phase rewards Radiance and the Hunter–Priest combination.',
        steps: [
          'Read the last signature telegraph before committing to an attack.',
          'Use Radiance in the three-pulse recovery after Black Chrysanthemum.',
          'Protect the archive evidence and prepare to evacuate after victory.',
        ],
      };
    }
  }
  return LATE_BOSS_COACHING[encounterId] ?? null;
}

function mateusCoaching(snapshot) {
  const phaseId = snapshot?.bossPhase?.phaseId ?? 'phase-1';
  const livingWards = (snapshot?.kernel?.actors ?? []).filter((actor) => (
    actor.faction === 'enemy'
      && actor.hp > 0
      && actor.id.startsWith('blood-ward-')
  ));
  if (phaseId === 'phase-3' || snapshot?.outcome === 'victory') {
    return {
      title: 'Mateus yields alive',
      summary: 'The duel is over. The victory is his surrender and the opening of the cells, not an execution.',
      steps: [
        'No killing blow is required.',
        'Continue to record his confession and release the witnesses.',
        'Trust has not been granted; accountability carries forward.',
      ],
    };
  }
  if (phaseId === 'phase-2' || livingWards.length) {
    return {
      title: 'Break the Blood Wards',
      summary: 'The two seals reduce damage to Mateus. Destroy both living ward actors, or force Mateus below one fifth health.',
      steps: [
        'Focus the lower-health Blood Ward before attacking Mateus.',
        'Leave Crimson Litany’s violet line, then attack during his long recovery.',
        'Pierce, Radiance, tag switching, and Aya’s reserve healing keep the duel controlled.',
      ],
    };
  }
  return {
    title: 'Force the ward phase',
    summary: 'Pressure Mateus to roughly half health. His Blood Wards and Crimson Litany appear only in the second phase.',
    steps: [
      'Pale Cut is short; Sanguine Step marks its destination lane.',
      'Attack after his commitment, then move while your timer recovers.',
      'Aya supports Nikola and Ren from reserve; tag out before either fighter falls.',
    ],
  };
}

export function getActionBattleCoaching(encounterId, snapshot = null) {
  const source = encounterId === 'fp1-mateus'
    ? mateusCoaching(snapshot)
    : lateBossCoaching(encounterId, snapshot) ?? OPENING[encounterId] ?? BASE;
  return deepFreeze({
    encounterId,
    title: source.title,
    summary: source.summary,
    steps: [...source.steps],
  });
}

export function isOpeningActionEncounter(encounterId) {
  return OPENING_ACTION_ENCOUNTER_IDS.includes(encounterId);
}
