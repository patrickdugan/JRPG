/**
 * DOM-free presentation feedback for side-view action combat: enemy telegraph
 * markers, hit-stop and screen-shake impact budgets, phase-change beats, and a
 * simulation pacer.
 *
 * Nothing here changes the content of a fixed simulation step. Hit-stop and
 * slow motion only decide how much wall-clock time is handed to the
 * deterministic kernel on a given animation frame: a frozen frame simply runs
 * no steps, and those steps run unchanged once the freeze ends.
 */

import { attackWorldHitbox } from './action-combat.mjs';

export const ACTION_FEEDBACK_SCHEMA_VERSION = 1;

export const ACTION_TELEGRAPH_COLORS = Object.freeze({
  essence: Object.freeze({
    ember: '#ff7a3d',
    frost: '#8fd3ff',
    storm: '#f2e35b',
    radiance: '#fff0b0',
    umbral: '#b884ff',
  }),
  delivery: Object.freeze({
    cut: '#ff5d63',
    pierce: '#ffb347',
    crush: '#e0a46a',
    arcane: '#d08cff',
  }),
  neutral: '#ff6b6b',
});

export const ACTION_HIT_STOP = Object.freeze({
  minimumMs: 40,
  maximumMs: 90,
  heavinessScale: 250,
  artBonusMs: 10,
  partyHurtMs: 50,
  comboFinisherMs: 90,
  killMs: 90,
  bossKillMs: 120,
  staggerMs: 90,
  bossStaggerMs: 110,
  reducedMotionCapMs: 30,
});

export const ACTION_SCREEN_SHAKE = Object.freeze({
  minimumPx: 1.5,
  maximumPx: 5,
  heavinessScale: 20,
  killPx: 6,
  staggerPx: 5,
  partyHurtPx: 3,
  durationMs: 160,
  heavyDurationMs: 240,
});

export const ACTION_PHASE_BEAT = Object.freeze({
  bannerMs: 1_800,
  warningBannerMs: 1_200,
  flashMs: 220,
  slowMotionMs: 400,
  slowMotionScale: 0.5,
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function readable(id) {
  return String(id ?? '').split('-').filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(' ');
}

/** Essence colours win over delivery colours; untyped attacks use neutral red. */
export function telegraphColor(attack) {
  return ACTION_TELEGRAPH_COLORS.essence[attack?.essence]
    ?? ACTION_TELEGRAPH_COLORS.delivery[attack?.delivery]
    ?? ACTION_TELEGRAPH_COLORS.neutral;
}

/**
 * Every enemy wind-up publishes the exact world hitbox its active frame will
 * test, plus how far the wind-up has filled toward that frame.
 */
export function collectEnemyTelegraphs(kernelSnapshot, attacks) {
  const telegraphs = [];
  for (const actor of kernelSnapshot?.actors ?? []) {
    if (actor.faction !== 'enemy' || actor.hp <= 0 || !actor.activeAttack) continue;
    const attack = attacks?.[actor.activeAttack.attackId];
    if (!attack) continue;
    const phase = actor.activeAttack.phase;
    if (phase !== 'windup' && phase !== 'active') continue;
    const progress = phase === 'windup'
      ? (attack.windupMs > 0 ? clamp(actor.activeAttack.elapsedMs / attack.windupMs, 0, 1) : 1)
      : 1;
    telegraphs.push(Object.freeze({
      actorId: actor.id,
      attackId: attack.id ?? actor.activeAttack.attackId,
      name: attack.name ?? readable(actor.activeAttack.attackId.split(':').pop()),
      phase,
      progress,
      remainingMs: phase === 'windup' ? Math.max(0, attack.windupMs - actor.activeAttack.elapsedMs) : 0,
      hitbox: Object.freeze(attackWorldHitbox(actor, attack)),
      origin: Object.freeze({ x: actor.position.x, y: actor.position.y }),
      facing: actor.facing,
      centred: attack.hitbox.offsetX < 0,
      color: telegraphColor(attack),
      delivery: attack.delivery ?? null,
      essence: attack.essence ?? null,
      interruptOnHit: attack.interruptOnHit === true,
    }));
  }
  return Object.freeze(telegraphs);
}

function actorById(kernelSnapshot, actorId) {
  return kernelSnapshot?.actors?.find(({ id }) => id === actorId) ?? null;
}

/**
 * Hit-stop and shake budget for one frame's events. Overlapping impacts never
 * stack; the strongest impact wins. Reduced motion removes shake and caps the
 * freeze short.
 */
export function impactFeedbackForEvents(events, kernelSnapshot, {
  reducedMotion = false,
  bossActorIds = [],
  attacks = {},
} = {}) {
  const bosses = new Set(bossActorIds);
  let hitStopMs = 0;
  let shakePx = 0;
  let shakeMs = 0;
  const staggers = [];
  const kills = [];
  const take = (stop, shake, duration) => {
    hitStopMs = Math.max(hitStopMs, stop);
    if (shake > shakePx) {
      shakePx = shake;
      shakeMs = duration;
    }
  };
  for (const event of events ?? []) {
    if (event.type === 'poise-broken') {
      const boss = bosses.has(event.actorId);
      staggers.push(event.actorId);
      take(
        boss ? ACTION_HIT_STOP.bossStaggerMs : ACTION_HIT_STOP.staggerMs,
        ACTION_SCREEN_SHAKE.staggerPx + (boss ? 1 : 0),
        ACTION_SCREEN_SHAKE.heavyDurationMs,
      );
      continue;
    }
    if (event.type !== 'hit' || !(event.damage > 0)) continue;
    const target = actorById(kernelSnapshot, event.targetId);
    if (!target) continue;
    if (target.faction === 'player') {
      const heaviness = target.maxHp > 0 ? event.damage / target.maxHp : 0;
      take(
        clamp(ACTION_HIT_STOP.partyHurtMs + Math.round(heaviness * 60), ACTION_HIT_STOP.partyHurtMs, 70),
        ACTION_SCREEN_SHAKE.partyHurtPx,
        ACTION_SCREEN_SHAKE.durationMs,
      );
      continue;
    }
    if (event.hpAfter <= 0 && event.hpBefore > 0) {
      const boss = bosses.has(event.targetId);
      kills.push(event.targetId);
      take(
        boss ? ACTION_HIT_STOP.bossKillMs : ACTION_HIT_STOP.killMs,
        ACTION_SCREEN_SHAKE.killPx,
        ACTION_SCREEN_SHAKE.heavyDurationMs,
      );
      continue;
    }
    const heaviness = target.maxHp > 0 ? event.damage / target.maxHp : 0;
    const art = (attacks[event.attackId]?.poiseDamage ?? 1) >= 2;
    let stop = ACTION_HIT_STOP.minimumMs + Math.round(heaviness * ACTION_HIT_STOP.heavinessScale)
      + (art ? ACTION_HIT_STOP.artBonusMs : 0);
    if (event.comboId != null) stop = Math.max(stop, ACTION_HIT_STOP.comboFinisherMs);
    take(
      clamp(stop, ACTION_HIT_STOP.minimumMs, ACTION_HIT_STOP.maximumMs),
      clamp(
        ACTION_SCREEN_SHAKE.minimumPx + heaviness * ACTION_SCREEN_SHAKE.heavinessScale,
        ACTION_SCREEN_SHAKE.minimumPx,
        ACTION_SCREEN_SHAKE.maximumPx,
      ),
      ACTION_SCREEN_SHAKE.durationMs,
    );
  }
  if (reducedMotion) {
    hitStopMs = Math.min(hitStopMs, ACTION_HIT_STOP.reducedMotionCapMs);
    shakePx = 0;
    shakeMs = 0;
  }
  return Object.freeze({
    hitStopMs,
    shakePx: Math.round(shakePx * 100) / 100,
    shakeMs,
    staggers: Object.freeze(staggers),
    kills: Object.freeze(kills),
  });
}

/** Non-locking banner, flash, and brief slow motion for a boss phase change. */
export function phaseBeatForEvents(events, { reducedMotion = false, phaseNames = {} } = {}) {
  let beat = null;
  for (const event of events ?? []) {
    if (event.type === 'boss-phase-entered') {
      const phaseId = event.toPhaseId ?? event.phaseId;
      beat = {
        kind: 'entered',
        phaseId,
        title: phaseNames[phaseId] ?? readable(phaseId),
        bannerMs: ACTION_PHASE_BEAT.bannerMs,
        flashMs: reducedMotion ? 0 : ACTION_PHASE_BEAT.flashMs,
        slowMotionMs: reducedMotion ? 0 : ACTION_PHASE_BEAT.slowMotionMs,
        slowMotionScale: ACTION_PHASE_BEAT.slowMotionScale,
        animated: !reducedMotion,
      };
    } else if (event.type === 'boss-phase-warning' && beat?.kind !== 'entered') {
      const phaseId = event.toPhaseId;
      beat = {
        kind: 'warning',
        phaseId,
        title: phaseNames[phaseId] ?? readable(phaseId),
        bannerMs: ACTION_PHASE_BEAT.warningBannerMs,
        flashMs: 0,
        slowMotionMs: 0,
        slowMotionScale: 1,
        animated: !reducedMotion,
      };
    }
  }
  return beat == null ? null : Object.freeze(beat);
}

/**
 * Wall-clock to simulation pacing. Hit-stop consumes frame time first and
 * runs no steps; slow motion then scales what remains. The kernel still runs
 * only whole fixed steps, so step content never depends on this pacing.
 */
export function createSimulationPacer() {
  return {
    hitStopRemainingMs: 0,
    slowMotionRemainingMs: 0,
    slowMotionScale: 1,
    frozenTotalMs: 0,
    slowedTotalMs: 0,
  };
}

export function requestHitStop(pacer, milliseconds) {
  const value = Math.max(0, Number(milliseconds) || 0);
  pacer.hitStopRemainingMs = Math.max(pacer.hitStopRemainingMs, value);
  return pacer.hitStopRemainingMs;
}

export function requestSlowMotion(pacer, milliseconds, scale = ACTION_PHASE_BEAT.slowMotionScale) {
  const value = Math.max(0, Number(milliseconds) || 0);
  if (value <= 0) return pacer.slowMotionRemainingMs;
  pacer.slowMotionRemainingMs = Math.max(pacer.slowMotionRemainingMs, value);
  pacer.slowMotionScale = clamp(Number(scale) || 1, 0.1, 1);
  return pacer.slowMotionRemainingMs;
}

export function paceSimulation(pacer, frameMs) {
  let remaining = Math.max(0, Number(frameMs) || 0);
  const frozenMs = Math.min(remaining, pacer.hitStopRemainingMs);
  pacer.hitStopRemainingMs -= frozenMs;
  pacer.frozenTotalMs += frozenMs;
  remaining -= frozenMs;
  let simulatedMs = remaining;
  let slowedMs = 0;
  if (remaining > 0 && pacer.slowMotionRemainingMs > 0) {
    slowedMs = Math.min(remaining, pacer.slowMotionRemainingMs);
    pacer.slowMotionRemainingMs -= slowedMs;
    simulatedMs = remaining - slowedMs + slowedMs * pacer.slowMotionScale;
    pacer.slowedTotalMs += slowedMs;
    if (pacer.slowMotionRemainingMs <= 0) pacer.slowMotionScale = 1;
  }
  return Object.freeze({
    simulatedMs,
    frozenMs,
    slowedMs,
    frozen: frozenMs > 0 && simulatedMs === 0,
  });
}

/** Deterministic decaying shake offset for presentation (no randomness). */
export function screenShakeOffset(shake, nowMs) {
  if (!shake || shake.remainingMs <= 0 || shake.amplitudePx <= 0) return Object.freeze({ x: 0, y: 0 });
  const decay = shake.durationMs > 0 ? shake.remainingMs / shake.durationMs : 0;
  const amplitude = shake.amplitudePx * decay;
  return Object.freeze({
    x: Math.round(Math.sin(nowMs * 0.113) * amplitude * 100) / 100,
    y: Math.round(Math.cos(nowMs * 0.157) * amplitude * 0.6 * 100) / 100,
  });
}
