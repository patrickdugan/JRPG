export const OPENING_BEAT_ID = 'p00-delivery-in-rain';

export const OPENING_INTERACTION_GATES = Object.freeze([
  Object.freeze({ afterLine: 8, requiredCompletedNodeCount: 1, prompt: 'Inspect the suspicious seal to continue.' }),
  Object.freeze({ afterLine: 18, requiredCompletedNodeCount: 2, prompt: 'Bring the seal to the headman to continue.' }),
  Object.freeze({ afterLine: 27, requiredCompletedNodeCount: 3, prompt: 'Return to the courier and present what you learned.' }),
]);

export function getOpeningInteractionGate({ beatId, acknowledgedLines = 0, completedNodeCount = 0 } = {}) {
  if (beatId !== OPENING_BEAT_ID) return null;
  return OPENING_INTERACTION_GATES.find((gate) => (
    acknowledgedLines >= gate.afterLine
      && completedNodeCount < gate.requiredCompletedNodeCount
  )) ?? null;
}
