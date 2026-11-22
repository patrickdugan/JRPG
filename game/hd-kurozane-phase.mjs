/**
 * Pure presentation mapping from the canonical Kurozane boss-phase director
 * to the six approved painterly source-key studies.
 *
 * Phase IDs are the live encounter IDs in the existing pixel boss manifest:
 * court, bell, dawn.  Each has a calm and a committed-action key.
 * Never affect simulation, move selection, HP thresholds or boss outcomes.
 */
export const HD_KUROZANE_PHASE_FORMS = Object.freeze({
  court: Object.freeze({ idle: 1, committed: 2 }),
  bell: Object.freeze({ idle: 3, committed: 4 }),
  dawn: Object.freeze({ idle: 5, committed: 6 }),
});

export function hdKurozanePhaseId(director, actor) {
  if (!director || !actor || director.bossTemplateId !== 'kurozane' ||
      director.bossActorId !== actor.id) return null;
  const index = director.phaseIndex;
  if (!Number.isInteger(index) || index < 0) return null;
  const id = director.phases?.[index]?.id;
  return Object.hasOwn(HD_KUROZANE_PHASE_FORMS, id) ? id : null;
}

export function selectHdKurozaneForm(actor, director) {
  const phase = hdKurozanePhaseId(director, actor);
  if (!phase) return null;
  // One-way terminal form holds after the death event; never signals combat.
  if (actor.hp <= 0 || actor.active === false) return 6;
  const pair = HD_KUROZANE_PHASE_FORMS[phase];
  if (actor.staggerRemainingMs > 0 || actor.hitStunRemainingMs > 0) {
    return pair.idle;
  }
  const attackPhase = actor.activeAttack?.phase;
  if (attackPhase === 'windup' || attackPhase === 'active') return pair.committed;
  if (actor.activeManeuver?.id === 'uppercut' ||
      actor.activeManeuver?.id === 'thunder-kick') return pair.committed;
  return pair.idle;
}

/**
 * The source motion clips are six 24-frame loops named form-01...form-06.
 * Mapping only picks one such clip; sampling stays with hd-painted-motion.mjs.
 */
export function hdKurozaneClipName(form) {
  return Number.isInteger(form) && form >= 1 && form <= 6
    ? 'form-0' + String(form)
    : null;
}
