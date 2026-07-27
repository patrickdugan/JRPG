export const OPENING_BEAT_ID = 'p00-delivery-in-rain';

export const OPENING_INTERACTION_GATES = Object.freeze([
  Object.freeze({ afterLine: 8, requiredCompletedNodeCount: 1, prompt: 'Inspect the suspicious seal to continue.' }),
  Object.freeze({ afterLine: 18, requiredCompletedNodeCount: 2, prompt: 'Bring the seal to the headman to continue.' }),
  Object.freeze({ afterLine: 27, requiredCompletedNodeCount: 3, prompt: 'Return to the courier and present what you learned.' }),
]);

export const OPENING_BATTLE_DIALOGUE_GATES = Object.freeze([
  Object.freeze({
    beatId: 'c1-06-copy-before-fire',
    afterLine: 3,
    encounterId: 'c1-tithe-hound',
    prompt: 'Defeat the Tithe Hound before recording what survives.',
  }),
  Object.freeze({
    beatId: 'c2-05-undercrypt-truth',
    afterLine: 6,
    encounterId: 'fp1-flooded-archive',
    prompt: 'Clear the flooded archive before entering the bell room.',
  }),
  Object.freeze({
    beatId: 'c2-06-name-from-europe',
    afterLine: 10,
    encounterId: 'fp1-mateus',
    prompt: 'Complete the duel with Mateus before continuing the scene.',
  }),
]);

export function getOpeningInteractionGate({
  beatId,
  acknowledgedLines = 0,
  completedNodeCount = 0,
  clearedEncounterIds = [],
} = {}) {
  if (beatId === OPENING_BEAT_ID) {
    const fieldGate = OPENING_INTERACTION_GATES.find((gate) => (
      acknowledgedLines >= gate.afterLine
        && completedNodeCount < gate.requiredCompletedNodeCount
    ));
    if (fieldGate) return fieldGate;
  }

  const clearedEncounters = new Set(clearedEncounterIds);
  return OPENING_BATTLE_DIALOGUE_GATES.find((gate) => (
    beatId === gate.beatId
      && acknowledgedLines >= gate.afterLine
      && !clearedEncounters.has(gate.encounterId)
  )) ?? null;
}
