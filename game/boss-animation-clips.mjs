/**
 * Boss binding for the v2 boss clips (game/assets/art/boss-animation-suite-v2/).
 *
 * Pure selection logic: which clip a boss shows and how it is sampled, given
 * the kernel actor plus presentation timers owned by the battle page. The
 * static seven-pose atlas in boss-combat-atlas.mjs remains the exact fallback
 * whenever a boss has no v2 manifest or its sheets are not ready.
 *
 * Nine bosses come from the code-authored v2 suite; Shogun Kurozane comes from
 * his pixelified final-battle and Oni kits (rig-posed). A manifest may declare
 * `phaseForms` (boss phase id -> form) and form variants named `clip@form`
 * (or `clip@phaseId`); a variant replaces its base clip while that form is active.
 */

import {
  sampleAttackPhase,
  sampleClipAtProgress,
  sampleClipAtTime,
} from './animation-clip-runtime.mjs';

export const BOSS_ANIMATION_SUITE = Object.freeze({
  id: 'boss-animation-suite-v2',
  baseUrl: './assets/art/boss-animation-suite-v2/',
  bosses: Object.freeze([
    'tithe-hound',
    'mateus',
    'captain-kaji',
    'widow-of-fog',
    'furnace-abbot',
    'ujiro',
    'bell-warden-chiyo',
    'lady-enma',
    'yearless-bell',
    'kurozane',
  ]),
  requiredClips: Object.freeze(['idle', 'locomotion', 'strike', 'signature', 'stagger', 'transition', 'defeat']),
  /** Same body scale as the static atlas path (drawHeight = 128 * min(1.35, scale)); manifests may override. */
  presentationPixelScale: 1.35,
});

const BOSS_IDS = new Set(BOSS_ANIMATION_SUITE.bosses);

export function hasBossAnimationClips(templateId) {
  return BOSS_IDS.has(templateId);
}

export function bossAnimationManifestUrl(templateId) {
  return hasBossAnimationClips(templateId) ? `${BOSS_ANIMATION_SUITE.baseUrl}${templateId}.json` : null;
}

/** Clip for a kernel attack id: the manifest's attackClips map, then its radius-variant base, then `strike`. */
export function bossAttackClipId(manifest, attackId) {
  const map = manifest?.attackClips ?? {};
  if (map[attackId]) return map[attackId];
  const base = String(attackId ?? '').split('@')[0];
  return map[base] ?? 'strike';
}

/** The form a phase puts the boss in ('' when the manifest has no form for it). */
export function bossFormForPhase(manifest, phaseId) {
  return (phaseId != null && manifest?.phaseForms?.[phaseId]) || '';
}

/** Most specific clip that exists: `base@phaseId`, then `base@form`, then `base`. */
export function resolveBossClipId(manifest, base, { phaseId = null, form = '' } = {}) {
  const ids = new Set((manifest?.clips ?? []).map(({ id }) => id));
  if (phaseId && ids.has(`${base}@${phaseId}`)) return `${base}@${phaseId}`;
  if (form && ids.has(`${base}@${form}`)) return `${base}@${form}`;
  return base;
}

/**
 * Decide what a boss shows this frame. Priority mirrors the static
 * getBossCombatPresentationPose: defeat, phase transition, stagger, attack
 * (by phase progress), locomotion, idle.
 *
 * - `defeatElapsedMs` / `defeatHoldMs`: wall-clock time since the boss was first
 *   drawn defeated, against the existing BOSS_DEFEAT_HOLD_MS (the last frame holds).
 * - `transitionElapsedMs` / `transitionHoldMs`: kernel time since the boss entered
 *   its current phase, against BOSS_TRANSITION_HOLD_MS; null when none.
 * - `staggerTotalMs`: the actor's poise staggerMs (stagger plays across it).
 * - `attackProgress`: the active attack phase's 0..1 progress.
 * - `phaseId`: the boss phase director's current phase, for form variants.
 */
export function selectBossAnimationClip({
  manifest = null,
  prepared = null,
  actor,
  phaseId = null,
  attackProgress = 0,
  staggerTotalMs = 0,
  defeatElapsedMs = 0,
  defeatHoldMs = 1,
  transitionElapsedMs = null,
  transitionHoldMs = 1,
  timeMs = 0,
} = {}) {
  if (!actor) throw new TypeError('actor is required');
  const source = manifest ?? prepared?.manifest ?? null;
  const form = bossFormForPhase(source, phaseId);
  const clip = (base) => resolveBossClipId(source, base, { phaseId, form });
  const result = (fields) => Object.freeze({ ...fields, form });
  if (actor.hp <= 0 || actor.active === false) {
    return result({ clipId: clip('defeat'), mode: 'progress', progress: defeatElapsedMs / Math.max(1, defeatHoldMs) });
  }
  if (transitionElapsedMs != null && transitionElapsedMs >= 0 && transitionElapsedMs < transitionHoldMs) {
    return result({ clipId: clip('transition'), mode: 'progress', progress: transitionElapsedMs / Math.max(1, transitionHoldMs) });
  }
  if (actor.staggerRemainingMs > 0) {
    const total = Math.max(actor.staggerRemainingMs, staggerTotalMs || 0, 1);
    return result({ clipId: clip('stagger'), mode: 'progress', progress: 1 - (actor.staggerRemainingMs / total) });
  }
  const attack = actor.activeAttack;
  if (attack && ['windup', 'active', 'recovery'].includes(attack.phase)) {
    return result({
      clipId: bossAttackClipId(source, attack.attackId),
      mode: 'phase',
      phase: attack.phase,
      progress: attackProgress,
    });
  }
  const moving = !actor.grounded || Math.abs(actor.movementIntent?.x ?? 0) > 0;
  return result({ clipId: clip(moving ? 'locomotion' : 'idle'), mode: 'time', timeMs });
}

export function sampleBossAnimation(prepared, selection, { reducedMotion = false } = {}) {
  if (selection.mode === 'phase') {
    return sampleAttackPhase(prepared, selection.clipId, selection.phase, selection.progress, { reducedMotion });
  }
  if (selection.mode === 'progress') {
    return sampleClipAtProgress(prepared, selection.clipId, selection.progress, { reducedMotion });
  }
  return sampleClipAtTime(prepared, selection.clipId, selection.timeMs, { reducedMotion });
}
