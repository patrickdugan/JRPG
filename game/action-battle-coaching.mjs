/**
 * Progressive, presentation-only coaching for the opening action encounters.
 */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const BASE = deepFreeze({
  title: 'Fight, read, recover',
  summary: 'Move freely while attack timers recover. A committed attack briefly locks movement, so strike after a telegraph or from safe spacing.',
  steps: [
    'Move with Left/Right or A/D.',
    'Use Z/J for the weapon and X/K for the character art.',
    'Watch the objective and enemy warning shapes; movement remains available during cooldown.',
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
      'Close distance before committing an attack.',
      'Use the brighter Radiance art when available.',
      'A defeated wisp removes an entire source of pressure.',
    ],
  },
  'c1-tithe-hound': {
    title: 'Wait for the exposed seal',
    summary: 'Consume Ink draws a dark line and exposes the Hound’s seal. Evade first; Aya heals from reserve while Ren answers the recovery window.',
    steps: [
      'Leave the published line before Consume Ink lands.',
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
    : OPENING[encounterId] ?? BASE;
  return deepFreeze({
    encounterId,
    title: source.title,
    summary: source.summary,
    steps: [...source.steps],
  });
}
