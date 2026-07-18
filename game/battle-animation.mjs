/**
 * Deterministic, DOM-free battle animation timelines.
 *
 * The combat engine remains authoritative. These timelines describe only
 * presentation: an actor may lunge away from its simulation tile, but every
 * timeline records that the simulation position is unchanged and returns the
 * rendered actor to the authored source tile during Recovery.
 */

import { COMBAT_STATUS_DEFINITIONS, PARTY_SKILLS } from './campaign-combat.mjs';
import { ENEMY_FAMILIES } from './enemy-atlas.mjs';

export const BATTLE_ANIMATION_SCHEMA_VERSION = 1;

export const SUPPORTED_PRESENTATION_SPEEDS = Object.freeze([1, 2, 4]);

export const ENEMY_INTENT_BASE_DELAY_MS = 650;

export const BATTLE_ANIMATION_PHASE_ORDER = Object.freeze([
  'windup',
  'movement',
  'projectile-or-trail',
  'impact',
  'stagger',
  'status-glyph',
  'recovery',
]);

export const ANIMATION_DURATION_BOUNDS = Object.freeze({
  minimumBasePhaseMs: 80,
  maximumBasePhaseMs: 560,
  minimumBaseTimelineMs: 720,
  maximumBaseTimelineMs: 2400,
  minimumScaledFrameStepMs: 5,
});

export const DELIVERY_ANIMATION_COLORS = deepFreeze({
  cut: '#d65d62',
  pierce: '#e4bd64',
  crush: '#b7835b',
  arcane: '#9d7ad7',
});

export const ESSENCE_ANIMATION_COLORS = deepFreeze({
  ember: '#ef6a3b',
  frost: '#76c7e5',
  storm: '#d7d55c',
  radiance: '#f4e59a',
  umbral: '#69468e',
});

export const STATUS_GLYPH_PRESENTATION = deepFreeze({
  dread: { id: 'dread', name: COMBAT_STATUS_DEFINITIONS.dread.name, glyph: '!', color: '#8e62a8' },
  chill: { id: 'chill', name: COMBAT_STATUS_DEFINITIONS.chill.name, glyph: '*', color: '#83d2ec' },
  shock: { id: 'shock', name: COMBAT_STATUS_DEFINITIONS.shock.name, glyph: 'Z', color: '#e5df55' },
  scorch: { id: 'scorch', name: COMBAT_STATUS_DEFINITIONS.scorch.name, glyph: '^', color: '#f2773f' },
  bound: { id: 'bound', name: COMBAT_STATUS_DEFINITIONS.bound.name, glyph: '#', color: '#c3a577' },
  overheated: { id: 'overheated', name: COMBAT_STATUS_DEFINITIONS.overheated.name, glyph: '++', color: '#ff9b54' },
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function animationProfile({
  id,
  delivery,
  essence = null,
  movementKind,
  lungeTiles,
  emissionKind,
  emissionVisual,
  durations,
}) {
  return deepFreeze({
    id,
    delivery,
    essence,
    movementKind,
    lungeTiles,
    emissionKind,
    emissionVisual,
    durations: {
      windupMs: durations.windupMs,
      movementMs: durations.movementMs,
      emissionMs: durations.emissionMs,
      impactMs: durations.impactMs,
      staggerMs: durations.staggerMs,
      statusGlyphMs: durations.statusGlyphMs,
      recoveryMs: durations.recoveryMs,
    },
  });
}

/** Every currently authored party skill has an explicit presentation profile. */
export const PARTY_SKILL_ANIMATIONS = deepFreeze({
  'courier-cut': animationProfile({
    id: 'courier-cut', delivery: 'cut', movementKind: 'lunge', lungeTiles: 1,
    emissionKind: 'none', emissionVisual: 'short-sword-arc',
    durations: { windupMs: 160, movementMs: 160, emissionMs: 0, impactMs: 160, staggerMs: 160, statusGlyphMs: 160, recoveryMs: 240 },
  }),
  'cinder-route': animationProfile({
    id: 'cinder-route', delivery: 'arcane', essence: 'ember', movementKind: 'plant', lungeTiles: 0,
    emissionKind: 'trail', emissionVisual: 'ground-cinder-route',
    durations: { windupMs: 240, movementMs: 80, emissionMs: 400, impactMs: 160, staggerMs: 160, statusGlyphMs: 160, recoveryMs: 320 },
  }),
  'warding-script': animationProfile({
    id: 'warding-script', delivery: 'arcane', essence: 'radiance', movementKind: 'plant', lungeTiles: 0,
    emissionKind: 'projectile', emissionVisual: 'written-ward',
    durations: { windupMs: 240, movementMs: 80, emissionMs: 320, impactMs: 160, staggerMs: 160, statusGlyphMs: 160, recoveryMs: 240 },
  }),
  'hunter-thrust': animationProfile({
    id: 'hunter-thrust', delivery: 'pierce', movementKind: 'grid-thrust', lungeTiles: 1,
    emissionKind: 'trail', emissionVisual: 'silver-thrust-line',
    durations: { windupMs: 160, movementMs: 240, emissionMs: 160, impactMs: 160, staggerMs: 160, statusGlyphMs: 160, recoveryMs: 240 },
  }),
  'dawn-bolt': animationProfile({
    id: 'dawn-bolt', delivery: 'arcane', essence: 'radiance', movementKind: 'plant', lungeTiles: 0,
    emissionKind: 'projectile', emissionVisual: 'dawn-bolt',
    durations: { windupMs: 320, movementMs: 80, emissionMs: 320, impactMs: 160, staggerMs: 160, statusGlyphMs: 160, recoveryMs: 320 },
  }),
  'penitent-night': animationProfile({
    id: 'penitent-night', delivery: 'arcane', essence: 'umbral', movementKind: 'shadow-step', lungeTiles: 1,
    emissionKind: 'trail', emissionVisual: 'penitent-afterimage',
    durations: { windupMs: 320, movementMs: 160, emissionMs: 320, impactMs: 160, staggerMs: 240, statusGlyphMs: 160, recoveryMs: 320 },
  }),
  'pilgrim-maul': animationProfile({
    id: 'pilgrim-maul', delivery: 'crush', movementKind: 'heavy-lunge', lungeTiles: 1,
    emissionKind: 'trail', emissionVisual: 'maul-shock-line',
    durations: { windupMs: 320, movementMs: 240, emissionMs: 160, impactMs: 240, staggerMs: 240, statusGlyphMs: 160, recoveryMs: 320 },
  }),
  'cold-medicine': animationProfile({
    id: 'cold-medicine', delivery: 'arcane', essence: 'frost', movementKind: 'plant', lungeTiles: 0,
    emissionKind: 'projectile', emissionVisual: 'frost-vial',
    durations: { windupMs: 240, movementMs: 80, emissionMs: 320, impactMs: 160, staggerMs: 160, statusGlyphMs: 160, recoveryMs: 240 },
  }),
});

/** Every row in the enemy atlas has an explicit default attack language. */
export const ENEMY_FAMILY_ANIMATIONS = deepFreeze({
  hound: animationProfile({
    id: 'hound', delivery: 'pierce', essence: 'ember', movementKind: 'low-lunge', lungeTiles: 2,
    emissionKind: 'trail', emissionVisual: 'cinder-claw-line',
    durations: { windupMs: 160, movementMs: 240, emissionMs: 160, impactMs: 160, staggerMs: 160, statusGlyphMs: 160, recoveryMs: 240 },
  }),
  wisp: animationProfile({
    id: 'wisp', delivery: 'arcane', essence: 'storm', movementKind: 'hover', lungeTiles: 0,
    emissionKind: 'projectile', emissionVisual: 'paper-ash-orb',
    durations: { windupMs: 320, movementMs: 80, emissionMs: 400, impactMs: 160, staggerMs: 160, statusGlyphMs: 160, recoveryMs: 320 },
  }),
  'ashen-oni': animationProfile({
    id: 'ashen-oni', delivery: 'crush', essence: 'ember', movementKind: 'heavy-lunge', lungeTiles: 1,
    emissionKind: 'none', emissionVisual: 'ash-guard-swing',
    durations: { windupMs: 320, movementMs: 240, emissionMs: 0, impactMs: 240, staggerMs: 160, statusGlyphMs: 160, recoveryMs: 320 },
  }),
  'court-retainer': animationProfile({
    id: 'court-retainer', delivery: 'pierce', movementKind: 'measured-step', lungeTiles: 1,
    emissionKind: 'trail', emissionVisual: 'hook-or-blade-line',
    durations: { windupMs: 240, movementMs: 160, emissionMs: 240, impactMs: 160, staggerMs: 160, statusGlyphMs: 160, recoveryMs: 240 },
  }),
  widow: animationProfile({
    id: 'widow', delivery: 'arcane', essence: 'frost', movementKind: 'hover', lungeTiles: 0,
    emissionKind: 'projectile', emissionVisual: 'fog-tide-ring',
    durations: { windupMs: 400, movementMs: 80, emissionMs: 480, impactMs: 160, staggerMs: 240, statusGlyphMs: 160, recoveryMs: 400 },
  }),
  furnace: animationProfile({
    id: 'furnace', delivery: 'crush', essence: 'ember', movementKind: 'heavy-lunge', lungeTiles: 1,
    emissionKind: 'trail', emissionVisual: 'furnace-hammer-wave',
    durations: { windupMs: 400, movementMs: 240, emissionMs: 240, impactMs: 240, staggerMs: 240, statusGlyphMs: 160, recoveryMs: 400 },
  }),
  'bell-warden': animationProfile({
    id: 'bell-warden', delivery: 'arcane', essence: 'umbral', movementKind: 'plant', lungeTiles: 0,
    emissionKind: 'projectile', emissionVisual: 'bell-ring',
    durations: { windupMs: 400, movementMs: 80, emissionMs: 480, impactMs: 240, staggerMs: 240, statusGlyphMs: 160, recoveryMs: 400 },
  }),
  'black-court': animationProfile({
    id: 'black-court', delivery: 'pierce', essence: 'umbral', movementKind: 'shadow-step', lungeTiles: 2,
    emissionKind: 'trail', emissionVisual: 'black-chrysanthemum-lane',
    durations: { windupMs: 480, movementMs: 240, emissionMs: 400, impactMs: 240, staggerMs: 240, statusGlyphMs: 160, recoveryMs: 480 },
  }),
});

const FALLBACK_PROFILE = animationProfile({
  id: 'fallback', delivery: 'cut', movementKind: 'lunge', lungeTiles: 1,
  emissionKind: 'none', emissionVisual: 'plain-hit',
  durations: { windupMs: 160, movementMs: 160, emissionMs: 0, impactMs: 160, staggerMs: 160, statusGlyphMs: 160, recoveryMs: 240 },
});

const FRAME_PROGRESS_POINTS = Object.freeze([0, 0.25, 0.5, 0.75, 1]);

export function normalizePresentationSpeed(value) {
  const numeric = Number(value);
  return SUPPORTED_PRESENTATION_SPEEDS.includes(numeric) ? numeric : 1;
}

function safeNowMs(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Create one readable manual enemy-intent window. */
export function createEnemyIntentSchedule(nowMs, speed = 1) {
  const startedAt = safeNowMs(nowMs);
  const presentationSpeed = normalizePresentationSpeed(speed);
  const durationMs = ENEMY_INTENT_BASE_DELAY_MS / presentationSpeed;
  return deepFreeze({
    startedAt,
    dueAt: startedAt + durationMs,
    durationMs,
    presentationSpeed,
  });
}

/** Preserve elapsed intent-window progress when the player changes speed. */
export function rescaleEnemyIntentSchedule(schedule, nowMs, speed = 1) {
  if (!schedule) return null;
  const now = safeNowMs(nowMs);
  const elapsed = Math.max(0, now - safeNowMs(schedule.startedAt));
  const oldDuration = Number.isFinite(schedule.durationMs) && schedule.durationMs > 0
    ? schedule.durationMs
    : Math.max(0, safeNowMs(schedule.dueAt) - safeNowMs(schedule.startedAt));
  const progress = oldDuration > 0 ? Math.min(1, elapsed / oldDuration) : 1;
  const next = createEnemyIntentSchedule(now, speed);
  const elapsedAtNewSpeed = next.durationMs * progress;
  return deepFreeze({
    startedAt: now - elapsedAtNewSpeed,
    dueAt: now + (next.durationMs - elapsedAtNewSpeed),
    durationMs: next.durationMs,
    presentationSpeed: next.presentationSpeed,
  });
}

/** Keep an automated next enemy action behind both the current animation and a fresh intent window. */
export function getNextBattleActionAt({
  nowMs = 0,
  stepDelayMs = 0,
  animationEndsAt = null,
  nextIsEnemy = false,
  speed = 1,
} = {}) {
  const now = safeNowMs(nowMs);
  const delayedAt = now + (Number.isFinite(stepDelayMs) ? Math.max(0, stepDelayMs) : 0);
  if (!Number.isFinite(animationEndsAt)) return delayedAt;
  let dueAt = Math.max(delayedAt, animationEndsAt);
  if (nextIsEnemy) dueAt = Math.max(dueAt, createEnemyIntentSchedule(animationEndsAt, speed).dueAt);
  return dueAt;
}

/** Terminal play is settled only after its animation and optional auto result hold. */
export function isBattlePresentationSettled({ result = null, animationActive = false, settling = false } = {}) {
  return Boolean(result) && !animationActive && !settling;
}

/** Count the exact portion of a sampled interval that still belongs to battle presentation. */
export function getBattlePresentationElapsedMs({
  elapsedMs = 0,
  intervalEndMs = 0,
  result = null,
  settling = false,
  animationEndsAt = null,
} = {}) {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, Math.floor(elapsedMs)) : 0;
  if (!result || settling) return elapsed;
  if (!Number.isFinite(animationEndsAt)) return 0;
  const intervalEnd = safeNowMs(intervalEndMs);
  const intervalStart = intervalEnd - elapsed;
  return Math.floor(Math.max(0, Math.min(elapsed, Math.min(intervalEnd, animationEndsAt) - intervalStart)));
}

/** Starting automation is a state transition; stopping an active run remains separate. */
export function canStartAutoGrindPresentation({
  unlocked = false,
  animationActive = false,
  result = null,
  settling = false,
} = {}) {
  return Boolean(unlocked) && !animationActive && !result && !settling;
}

/**
 * Keep the pre-resolution attacker/target visible while a presentation timeline
 * plays, even when the authoritative post-action snapshot marks either dead.
 */
export function getBattlePresentationActors(currentActors = [], retainedActors = []) {
  const visible = currentActors.filter((actor) => actor?.hp > 0 && actor.active !== false);
  const visibleIds = new Set(visible.map((actor) => actor.instanceId));
  for (const actor of retainedActors) {
    if (!actor?.instanceId || actor.hp <= 0 || actor.active === false || visibleIds.has(actor.instanceId)) continue;
    visible.push(actor);
    visibleIds.add(actor.instanceId);
  }
  return Object.freeze(visible);
}

function safeInteger(value, fallback = 0) {
  return Number.isSafeInteger(value) ? value : fallback;
}

function safeTile(value, fallback = { x: 0, y: 0 }) {
  return {
    x: safeInteger(value?.x, fallback.x),
    y: safeInteger(value?.y, fallback.y),
  };
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function interpolateTile(from, to, progress) {
  return {
    x: round(from.x + ((to.x - from.x) * progress)),
    y: round(from.y + ((to.y - from.y) * progress)),
  };
}

function resolveDamageKey(candidate, vocabulary, fallback) {
  return Object.hasOwn(vocabulary, candidate) ? candidate : fallback;
}

function resolveStatusId(candidate) {
  return Object.hasOwn(COMBAT_STATUS_DEFINITIONS, candidate) ? candidate : null;
}

function resolveMotion(sourceTile, targetTile, lungeTiles) {
  const gridVector = {
    x: Math.sign(targetTile.x - sourceTile.x),
    y: Math.sign(targetTile.y - sourceTile.y),
  };
  const distance = Math.max(
    Math.abs(targetTile.x - sourceTile.x),
    Math.abs(targetTile.y - sourceTile.y),
  );
  const requested = Number.isInteger(lungeTiles) && lungeTiles > 0 ? lungeTiles : 0;
  const steps = Math.min(requested, distance);
  const lungeTile = {
    x: sourceTile.x + (gridVector.x * steps),
    y: sourceTile.y + (gridVector.y * steps),
  };
  return {
    sourceTile,
    targetTile,
    gridVector,
    lungeTiles: steps,
    lungeTile,
    returnTile: sourceTile,
    simulationPositionChanges: false,
  };
}

function phaseDescriptors(profile, hasStatus, speed) {
  const authored = [
    ['windup', profile.durations.windupMs],
    ['movement', profile.durations.movementMs],
    ...(profile.emissionKind === 'none' ? [] : [[profile.emissionKind, profile.durations.emissionMs]]),
    ['impact', profile.durations.impactMs],
    ['stagger', profile.durations.staggerMs],
    ...(hasStatus ? [['status-glyph', profile.durations.statusGlyphMs]] : []),
    ['recovery', profile.durations.recoveryMs],
  ];
  let baseCursor = 0;
  return authored.map(([id, baseDurationMs], ordinal) => {
    const phase = {
      id,
      ordinal,
      baseStartMs: baseCursor,
      baseDurationMs,
      baseEndMs: baseCursor + baseDurationMs,
      startMs: baseCursor / speed,
      durationMs: baseDurationMs / speed,
      endMs: (baseCursor + baseDurationMs) / speed,
    };
    baseCursor += baseDurationMs;
    return phase;
  });
}

function actorPresentation(phaseId, progress, motion) {
  let renderTile = motion.lungeTile;
  let pose = 'attack';
  if (phaseId === 'windup') {
    renderTile = motion.sourceTile;
    pose = 'windup';
  } else if (phaseId === 'movement') {
    renderTile = interpolateTile(motion.sourceTile, motion.lungeTile, progress);
  } else if (phaseId === 'recovery') {
    renderTile = interpolateTile(motion.lungeTile, motion.returnTile, progress);
    pose = progress === 1 ? 'neutral' : 'attack';
  }
  return {
    simulationTile: motion.sourceTile,
    renderTile,
    pose,
    facing: motion.gridVector,
    scale: phaseId === 'windup' ? round(1 + (0.08 * progress)) : 1,
  };
}

function targetPresentation(phaseId, progress, motion) {
  const staggerPulse = phaseId === 'stagger'
    ? round((1 - Math.abs((2 * progress) - 1)) * 0.125)
    : 0;
  return {
    simulationTile: motion.targetTile,
    renderTile: {
      x: round(motion.targetTile.x + (motion.gridVector.x * staggerPulse)),
      y: round(motion.targetTile.y + (motion.gridVector.y * staggerPulse)),
    },
    pose: ['impact', 'stagger'].includes(phaseId) ? 'stagger' : 'neutral',
  };
}

function emissionPresentation(phaseId, progress, profile, motion, colors) {
  if (!['projectile', 'trail'].includes(phaseId)) return null;
  const headTile = interpolateTile(motion.lungeTile, motion.targetTile, progress);
  return {
    kind: phaseId,
    visual: profile.emissionVisual,
    fromTile: motion.lungeTile,
    toTile: motion.targetTile,
    headTile,
    color: colors.impact,
    accentColor: colors.delivery,
    progress,
    leavesTrail: phaseId === 'trail',
  };
}

function impactPresentation(phaseId, progress, motion, colors) {
  if (phaseId !== 'impact') return null;
  return {
    tile: motion.targetTile,
    color: colors.impact,
    accentColor: colors.delivery,
    radiusTiles: round(0.25 + (0.5 * progress)),
    opacity: round(1 - (0.65 * progress)),
  };
}

function statusPresentation(phaseId, progress, statusId, motion, placement = 'target') {
  if (phaseId !== 'status-glyph' || !statusId) return null;
  const presentation = STATUS_GLYPH_PRESENTATION[statusId];
  const pulse = 1 - Math.abs((2 * progress) - 1);
  const anchor = placement === 'source' ? motion.sourceTile : motion.targetTile;
  return {
    ...presentation,
    placement,
    tile: { x: anchor.x, y: round(anchor.y - 0.75 - (0.25 * progress)) },
    scale: round(1 + (0.5 * pulse)),
    opacity: round(0.35 + (0.65 * pulse)),
  };
}

function buildFrames(phases, profile, motion, colors, statusId, selfStatusId, speed) {
  const frames = [];
  for (const phase of phases) {
    for (const progress of FRAME_PROGRESS_POINTS) {
      const baseAtMs = phase.baseStartMs + (phase.baseDurationMs * progress);
      frames.push({
        index: frames.length,
        phase: phase.id,
        phaseOrdinal: phase.ordinal,
        phaseProgress: progress,
        baseAtMs,
        atMs: baseAtMs / speed,
        actor: actorPresentation(phase.id, progress, motion),
        target: targetPresentation(phase.id, progress, motion),
        emission: emissionPresentation(phase.id, progress, profile, motion, colors),
        impact: impactPresentation(phase.id, progress, motion, colors),
        statusGlyph: statusPresentation(phase.id, progress, statusId, motion, 'target'),
        selfStatusGlyph: statusPresentation(phase.id, progress, selfStatusId, motion, 'source'),
        recovery: phase.id === 'recovery' ? {
          progress,
          remaining: round(1 - progress),
          color: colors.recovery,
        } : null,
      });
    }
  }
  return frames;
}

function buildTimeline(profile, options) {
  const speed = normalizePresentationSpeed(options.speed);
  const sourceTile = safeTile(options.sourceTile ?? options.source);
  const targetTile = safeTile(options.targetTile ?? options.target, sourceTile);
  const delivery = resolveDamageKey(options.delivery, DELIVERY_ANIMATION_COLORS, profile.delivery);
  const essence = resolveDamageKey(options.essence, ESSENCE_ANIMATION_COLORS, profile.essence);
  const statusId = resolveStatusId(options.statusId);
  const selfStatusId = resolveStatusId(options.selfStatusId);
  const motion = resolveMotion(sourceTile, targetTile, profile.lungeTiles);
  const colors = {
    delivery: DELIVERY_ANIMATION_COLORS[delivery],
    essence: essence ? ESSENCE_ANIMATION_COLORS[essence] : null,
    impact: essence ? ESSENCE_ANIMATION_COLORS[essence] : DELIVERY_ANIMATION_COLORS[delivery],
    recovery: '#8f88a8',
    status: statusId ? STATUS_GLYPH_PRESENTATION[statusId].color : null,
    selfStatus: selfStatusId ? STATUS_GLYPH_PRESENTATION[selfStatusId].color : null,
  };
  const phases = phaseDescriptors(profile, Boolean(statusId || selfStatusId), speed);
  const lastPhase = phases.at(-1);
  const timeline = {
    schemaVersion: BATTLE_ANIMATION_SCHEMA_VERSION,
    sourceType: options.sourceType,
    requestedId: options.requestedId,
    resolvedId: profile.id,
    actionId: options.actionId ?? profile.id,
    fallbackUsed: Boolean(options.fallbackUsed),
    presentationSpeed: speed,
    baseDurationMs: lastPhase.baseEndMs,
    durationMs: lastPhase.endMs,
    simulationOrder: phases.map(({ id }) => id),
    action: {
      delivery,
      essence,
      statusId,
      selfStatusId,
      movementKind: profile.movementKind,
      emissionKind: profile.emissionKind,
      emissionVisual: profile.emissionVisual,
    },
    colors,
    motion,
    phases,
    frames: buildFrames(phases, profile, motion, colors, statusId, selfStatusId, speed),
  };
  return deepFreeze(timeline);
}

/** Create a presentation timeline for one of the eight canonical party skills. */
export function createPartySkillTimeline(skillId, options = {}) {
  const skill = PARTY_SKILLS[skillId];
  const profile = PARTY_SKILL_ANIMATIONS[skillId] ?? FALLBACK_PROFILE;
  const statusId = options.statusApplied === false ? null : (options.statusId ?? skill?.effect?.status);
  const selfStatusId = options.selfStatusApplied === false ? null : (options.selfStatusId ?? skill?.effect?.selfStatus);
  return buildTimeline(profile, {
    ...options,
    sourceType: 'party-skill',
    requestedId: String(skillId ?? ''),
    actionId: skill?.id ?? profile.id,
    delivery: skill?.delivery ?? options.delivery,
    essence: skill?.essence ?? options.essence,
    statusId,
    selfStatusId,
    fallbackUsed: !skill,
  });
}

function findEnemyFamily(candidate) {
  if (ENEMY_FAMILY_ANIMATIONS[candidate]) return candidate;
  return ENEMY_FAMILIES.find((family) => family.templateIds.includes(candidate))?.id ?? null;
}

/**
 * Create an enemy timeline from an atlas family id or canonical template id.
 * Passing the concrete enemy skill keeps its live delivery/essence/status
 * vocabulary while retaining the atlas family's silhouette motion language.
 */
export function createEnemyFamilyTimeline(familyOrTemplateId, options = {}) {
  const familyId = findEnemyFamily(familyOrTemplateId);
  const profile = ENEMY_FAMILY_ANIMATIONS[familyId] ?? ENEMY_FAMILY_ANIMATIONS['ashen-oni'];
  const skill = options.skill ?? {};
  const statusId = options.statusApplied === false ? null : (options.statusId ?? skill.effect?.status);
  const selfStatusId = options.selfStatusApplied === false ? null : (options.selfStatusId ?? skill.effect?.selfStatus);
  return buildTimeline(profile, {
    ...options,
    sourceType: 'enemy-family',
    requestedId: String(familyOrTemplateId ?? ''),
    actionId: skill.id ?? profile.id,
    delivery: skill.delivery ?? options.delivery,
    essence: skill.essence ?? options.essence,
    statusId,
    selfStatusId,
    fallbackUsed: !familyId,
  });
}

/** Generic canvas-facing entry point with a safe plain-hit fallback. */
export function createBattleAnimationTimeline(options = {}) {
  if (options.skillId) return createPartySkillTimeline(options.skillId, options);
  if (options.familyId || options.templateId) {
    return createEnemyFamilyTimeline(options.familyId ?? options.templateId, options);
  }
  return buildTimeline(FALLBACK_PROFILE, {
    ...options,
    sourceType: 'fallback',
    requestedId: '',
    actionId: 'fallback',
    fallbackUsed: true,
  });
}

/** Return the last immutable keyframe at or before a presentation timestamp. */
export function sampleBattleAnimation(timeline, elapsedMs = 0) {
  if (!timeline?.frames?.length) return null;
  const numeric = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  const clamped = Math.max(0, Math.min(timeline.durationMs, numeric));
  let selected = timeline.frames[0];
  for (const frame of timeline.frames) {
    if (frame.atMs > clamped) break;
    selected = frame;
  }
  return selected;
}
