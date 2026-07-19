/** Finite, session-only queue for optional repeat-battle automation. */

export const REPEAT_GRIND_QUEUE_OPTIONS = Object.freeze([1, 5, 10]);

function validatePlannedWins(plannedWins) {
  if (!REPEAT_GRIND_QUEUE_OPTIONS.includes(plannedWins)) {
    throw new RangeError(`Repeat grind wins must be one of ${REPEAT_GRIND_QUEUE_OPTIONS.join(', ')}.`);
  }
}

function freezeQueue({ plannedWins, completedWins, active, cancelled }) {
  return Object.freeze({ plannedWins, completedWins, active, cancelled });
}

export function createRepeatGrindQueue(plannedWins = 1) {
  validatePlannedWins(plannedWins);
  return freezeQueue({ plannedWins, completedWins: 0, active: false, cancelled: false });
}

export function startRepeatGrindQueue(queue) {
  validatePlannedWins(queue?.plannedWins);
  if (queue.completedWins !== 0) throw new RangeError('A completed or partially completed queue cannot be restarted.');
  return freezeQueue({ ...queue, active: true, cancelled: false });
}

export function recordRepeatGrindVictory(queue) {
  if (!queue?.active) throw new RangeError('A repeat victory requires an active grind queue.');
  const completedWins = queue.completedWins + 1;
  if (completedWins > queue.plannedWins) throw new RangeError('Repeat victories cannot exceed the planned queue.');
  const active = completedWins < queue.plannedWins;
  const state = freezeQueue({ ...queue, completedWins, active, cancelled: false });
  return Object.freeze({ state, shouldContinue: active, complete: !active });
}

export function cancelRepeatGrindQueue(queue) {
  validatePlannedWins(queue?.plannedWins);
  if (!queue.active) return queue;
  return freezeQueue({ ...queue, active: false, cancelled: true });
}
