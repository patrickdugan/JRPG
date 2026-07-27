/**
 * Migration adapter from the canonical authored encounter kit to the isolated
 * side-view ActionCombatKernel configuration.
 *
 * This module converts actors, attacks, authored status/effect hooks, and
 * dormant summon slots. Objective authority is composed by the campaign action
 * model so the kernel stays reusable.
 */

import { getChapterLevelTarget, getParty } from './advancement.mjs';
import { PARTY_PROFILES, PARTY_SKILLS } from './campaign-combat.mjs';
import {
  ACTION_FIXED_STEP_MS,
  ACTION_MOVEMENT_PROFILE_BY_ACTOR_ID,
  ActionCombatKernel,
} from './action-combat.mjs';
import { createActionEffectHooks } from './action-effects.mjs';
import { ENCOUNTERS, getEncounter } from './content/encounters.mjs';
import { getLevel, parseTileKey } from './content/levels.mjs';
import { BATTLE_ITEM_IDS } from './loadout.mjs';

export const ACTION_ENCOUNTER_ADAPTER_SCHEMA_VERSION = 2;
export const ACTION_ENCOUNTER_IDS = Object.freeze(ENCOUNTERS.map(({ id }) => id));
export const ACTION_TILE_PX = 64;
export const ACTION_STAGE_GROUND_Y = 320;
export const ACTION_RECOVERY_PULSE_MS = 600;
export const ZERO_RECOVERY_COOLDOWN_FLOOR_MS = 360;
export const MINIMUM_SHARED_OFFENSIVE_COOLDOWN_MS = 260;
export const ACTION_ENEMY_HP_COMPRESSION_THRESHOLD = 400;
export const ACTION_ENEMY_HP_EXCESS_RATIO = 0.65;
export const ACTION_ENEMY_POWER_PER_LEVEL = 0.025;
export const ACTION_ENEMY_POWER_MULTIPLIER_CAP = 1.9;
export const ACTION_ENEMY_GROUP_COOLDOWN_PER_EXTRA = 0.5;
export const ACTION_ENEMY_GROUP_COOLDOWN_MULTIPLIER_CAP = 2.5;
export const ACTION_ENEMY_GROUP_DAMAGE_FLOOR = 0.65;
export const ACTION_BOSS_SHARED_COOLDOWN_FLOOR_MS = 2_000;

const PARTY_ATTACK_PREFIX = 'party';
const ENEMY_ATTACK_PREFIX = 'enemy';
const NEUTRAL_RESISTANCES = Object.freeze({
  delivery: Object.freeze({ cut: 1, pierce: 1, crush: 1, arcane: 1 }),
  essence: Object.freeze({ ember: 1, frost: 1, storm: 1, radiance: 1, umbral: 1 }),
});
const COMPLEX_SHAPES = new Set(['cross', 'ring', 'markedTiles', 'laneEndpoint']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function roundToStep(milliseconds) {
  return Math.max(ACTION_FIXED_STEP_MS, Math.round(milliseconds / ACTION_FIXED_STEP_MS) * ACTION_FIXED_STEP_MS);
}

function positiveLevel(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${label} must be a positive integer.`);
  return value;
}

function actionStageForLevel(level) {
  const worldWidth = Math.max(640, level.width * ACTION_TILE_PX);
  return {
    minX: 0,
    maxX: worldWidth,
    minY: 0,
    maxY: ACTION_STAGE_GROUND_Y,
    groundY: ACTION_STAGE_GROUND_Y,
  };
}

function sidePosition(tileKey, ordinal, stage) {
  const tile = parseTileKey(tileKey);
  const duplicateOffset = ((ordinal % 3) - 1) * 12;
  return {
    x: Math.max(stage.minX + 24, Math.min(stage.maxX - 24, ((tile.x + 0.5) * ACTION_TILE_PX) + duplicateOffset)),
    y: stage.groundY,
  };
}

function dormantPosition(ordinal, stage) {
  return {
    x: Math.max(stage.minX + 24, stage.maxX - 96 - (ordinal * 36)),
    y: stage.groundY,
  };
}

function resistances(source) {
  return {
    delivery: { ...NEUTRAL_RESISTANCES.delivery, ...(source?.delivery ?? {}) },
    essence: { ...NEUTRAL_RESISTANCES.essence, ...(source?.essence ?? {}) },
  };
}

function movementSpeed(sourceSpeed) {
  return roundToStep(Math.max(80, 80 + (Math.max(0, sourceSpeed ?? 0) * 0.6)));
}

/** Every actor receives a nonzero weapon gate; higher Speed shortens its base. */
export function sharedOffensiveCooldownMs(sourceSpeed) {
  const speedSteps = Math.floor(Math.max(0, Number(sourceSpeed) || 0) / 10);
  return Math.max(MINIMUM_SHARED_OFFENSIVE_COOLDOWN_MS, 500 - (speedSteps * 20));
}

/**
 * Convert turn Recovery into a visible move-specific timer. Recovery 0 never
 * means no cooldown: it receives an explicit 360 ms floor.
 */
export function actionCooldownForRecovery(recoveryPulses = 0) {
  const pulses = Number.isInteger(recoveryPulses) && recoveryPulses > 0 ? recoveryPulses : 0;
  return Math.max(ZERO_RECOVERY_COOLDOWN_FLOOR_MS, pulses * ACTION_RECOVERY_PULSE_MS);
}

/** Preserve ordinary foes while compressing only the action boss-health tail. */
export function actionEnemyHp(sourceHp, multiplier = 1) {
  const hp = Math.max(1, Math.round(Number(sourceHp) || 1));
  const scalar = Number(multiplier);
  if (!Number.isFinite(scalar) || scalar <= 0) {
    throw new RangeError('Action enemy HP multiplier must be a positive finite number.');
  }
  const adapted = hp <= ACTION_ENEMY_HP_COMPRESSION_THRESHOLD
    ? hp
    : Math.round(
      ACTION_ENEMY_HP_COMPRESSION_THRESHOLD
        + ((hp - ACTION_ENEMY_HP_COMPRESSION_THRESHOLD) * ACTION_ENEMY_HP_EXCESS_RATIO),
    );
  return Math.max(1, Math.round(adapted * scalar));
}

/** Keep late-game enemy contact relevant as party HP and guard grow. */
export function actionEnemyPower(sourcePower, level) {
  const power = Math.max(0, Number(sourcePower) || 0);
  const normalizedLevel = Math.max(1, Math.round(Number(level) || 1));
  const multiplier = Math.min(
    ACTION_ENEMY_POWER_MULTIPLIER_CAP,
    1 + ((normalizedLevel - 1) * ACTION_ENEMY_POWER_PER_LEVEL),
  );
  return Math.round(power * multiplier);
}

/** Preserve readable counterplay when several turn-authored foes act simultaneously. */
export function actionEnemyGroupCooldownMs(baseMs, activeEnemyCount = 1) {
  const count = Math.max(1, Math.trunc(Number(activeEnemyCount) || 1));
  const multiplier = Math.min(
    ACTION_ENEMY_GROUP_COOLDOWN_MULTIPLIER_CAP,
    1 + ((count - 1) * ACTION_ENEMY_GROUP_COOLDOWN_PER_EXTRA),
  );
  return roundToStep(Math.max(MINIMUM_SHARED_OFFENSIVE_COOLDOWN_MS, baseMs) * multiplier);
}

/** Bound aggregate mob damage while retaining simultaneous positional pressure. */
export function actionEnemyGroupDamageMultiplier(activeEnemyCount = 1) {
  const count = Math.max(1, Math.trunc(Number(activeEnemyCount) || 1));
  return Math.max(ACTION_ENEMY_GROUP_DAMAGE_FLOOR, 1 / (1 + ((count - 1) * 0.35)));
}

function attackTiming(skill, sourceKind) {
  const range = Math.max(0, Number(skill.range) || 0);
  const shapeType = skill.shape?.type ?? 'front';
  const arcane = skill.delivery === 'arcane';
  const complex = COMPLEX_SHAPES.has(shapeType);
  const windupMs = roundToStep(
    sourceKind === PARTY_ATTACK_PREFIX
      ? 100 + (arcane ? 80 : 0) + Math.min(60, range * 10)
      : 180 + (skill.telegraph ? 40 : 0) + (complex ? 60 : 0) + Math.min(80, range * 20),
  );
  const activeMs = roundToStep(arcane || range > 1 ? 100 : 80);
  const recoveryMs = roundToStep(
    sourceKind === PARTY_ATTACK_PREFIX
      ? 140 + (arcane ? 80 : 20)
      : 180 + (complex ? 60 : 0) + (skill.dodgeable === false ? 40 : 0),
  );
  return { windupMs, activeMs, recoveryMs };
}

function attackHitbox(skill) {
  const range = Math.max(0, Number(skill.range) || 0);
  const shapeType = skill.shape?.type ?? 'front';
  const effectiveRange = Math.max(1, range);
  if (shapeType === 'ring' || shapeType === 'cross' || shapeType === 'markedTiles') {
    const radius = Math.max(ACTION_TILE_PX, effectiveRange * ACTION_TILE_PX);
    return {
      offsetX: -radius,
      offsetY: 0,
      width: radius * 2,
      height: 112,
    };
  }
  if (range === 0) {
    return { offsetX: -16, offsetY: 0, width: 32, height: 64 };
  }
  return {
    offsetX: 14,
    offsetY: 0,
    width: Math.max(44, effectiveRange * ACTION_TILE_PX),
    height: skill.delivery === 'arcane' ? 88 : 64,
  };
}

function actionAttackId(sourceKind, ownerTemplateId, sourceSkillId) {
  return `${sourceKind}:${ownerTemplateId}:${sourceSkillId}`;
}

function adaptAttack(skill, { sourceKind, ownerTemplateId }) {
  const id = actionAttackId(sourceKind, ownerTemplateId, skill.id);
  const recoveryPulses = Number.isInteger(skill.recoveryPulses) ? skill.recoveryPulses : 0;
  return {
    id,
    config: {
      name: skill.name,
      delivery: skill.delivery ?? null,
      essence: skill.essence ?? null,
      power: skill.power ?? 0,
      ...attackTiming(skill, sourceKind),
      cooldownMs: actionCooldownForRecovery(recoveryPulses),
      hitbox: attackHitbox(skill),
      tags: [sourceKind, skill.shape?.type ?? 'front', skill.dodgeable === false ? 'committed' : 'dodgeable'],
    },
    manifest: {
      adapterAttackId: id,
      sourceKind,
      ownerTemplateId,
      sourceSkillId: skill.id,
      sourceRecoveryPulses: recoveryPulses,
      sourceRange: skill.range ?? 0,
      sourceDelivery: skill.delivery ?? null,
      sourceEssence: skill.essence ?? null,
      sourceShape: clone(skill.shape ?? null),
      sourceEffect: clone(skill.effect ?? null),
      effectCompatibility: skill.effect ? 'action-effect-hooks' : 'none',
    },
  };
}

function partyProgressById(advancementState) {
  if (advancementState == null) return new Map();
  return new Map(getParty(advancementState).map((member) => [member.id, member]));
}

function partyLevel(actorId, chapterTarget, progress, partyLevels) {
  if (partyLevels && Object.hasOwn(partyLevels, actorId)) {
    return positiveLevel(partyLevels[actorId], `partyLevels.${actorId}`);
  }
  return progress.get(actorId)?.level ?? chapterTarget;
}

function partyStats(actorId, profile, progress) {
  const advancement = progress.get(actorId);
  if (!advancement) return profile.stats;
  return {
    hp: advancement.stats.hp,
    power: advancement.stats.power,
    guard: advancement.stats.guard,
    speed: advancement.stats.speed,
  };
}

function currentHpFor(actorId, maximum, partyVitals) {
  const authored = partyVitals?.[actorId];
  const value = typeof authored === 'number' ? authored : authored?.hp;
  if (value == null) return maximum;
  if (!Number.isFinite(value)) throw new TypeError(`partyVitals.${actorId}.hp must be finite.`);
  return Math.max(1, Math.min(maximum, Math.trunc(value)));
}

function partyActor(deployment, index, context) {
  const actorId = deployment.actorId;
  const profile = PARTY_PROFILES[actorId];
  if (!profile) throw new RangeError(`Encounter ${context.encounter.id} references unknown party profile ${actorId}.`);
  const stats = partyStats(actorId, profile, context.progress);
  const attackIds = profile.skillIds.map((skillId) => actionAttackId(PARTY_ATTACK_PREFIX, actorId, skillId));
  const actor = {
    id: actorId,
    name: profile.name,
    faction: 'player',
    ai: 'deterministic-companion',
    movementProfileId: ACTION_MOVEMENT_PROFILE_BY_ACTOR_ID[actorId] ?? 'standard',
    level: partyLevel(actorId, context.chapterTarget, context.progress, context.options.partyLevels),
    hp: currentHpFor(actorId, stats.hp, context.options.partyVitals),
    maxHp: stats.hp,
    power: stats.power,
    guard: stats.guard,
    moveSpeed: movementSpeed(stats.speed),
    offensiveCooldownMs: sharedOffensiveCooldownMs(stats.speed),
    position: sidePosition(deployment.at, index, context.stage),
    facing: 'right',
    resistances: resistances(profile.resistances),
    attackIds,
    statuses: actorId === 'aya'
      ? [{
          id: 'passive-healer',
          nextTickAtMs: 1_600,
          intervalMs: 1_600,
          restoreFraction: 0.12,
          minimumRestore: 10,
          triggerRatio: 0.85,
        }]
      : [],
  };
  return {
    actor,
    profile: {
      sourceKind: 'party',
      templateId: actorId,
      instanceIds: [actorId],
      sourceSkillIds: [...profile.skillIds],
      actionAttackIds: attackIds,
      level: actor.level,
      stats: { hp: actor.maxHp, power: actor.power, guard: actor.guard, speed: stats.speed },
      resistances: clone(actor.resistances),
      spawnState: 'initial',
    },
  };
}

function partyDeploymentsWithSupport(encounter, supportActorId, fighterActorIds = null) {
  if (fighterActorIds != null) {
    if (!Array.isArray(fighterActorIds) || fighterActorIds.length < 1 || fighterActorIds.length > 2) {
      throw new RangeError('Action fighterActorIds must contain one or two canonical party actor IDs.');
    }
    const normalizedIds = fighterActorIds.map((actorId) => String(actorId).trim());
    if (new Set(normalizedIds).size !== normalizedIds.length) {
      throw new RangeError('Action fighterActorIds must be unique.');
    }
    for (const actorId of normalizedIds) {
      if (!PARTY_PROFILES[actorId]) throw new RangeError(`Unknown action fighter ${actorId || '(empty)'}.`);
    }
    const deployments = normalizedIds.map((actorId, index) => {
      const authored = encounter.party.deployment.find((deployment) => deployment.actorId === actorId);
      return {
        actorId,
        at: authored?.at ?? encounter.party.deployment[index]?.at ?? encounter.party.deployment[0]?.at ?? '1,5',
      };
    });
    return { deployments, supportActorId: normalizedIds[1] ?? null };
  }
  const deployments = encounter.party.deployment.map((deployment) => ({ ...deployment }));
  if (supportActorId == null) return { deployments, supportActorId: null };
  const normalizedSupportActorId = String(supportActorId).trim();
  if (!PARTY_PROFILES[normalizedSupportActorId]) {
    throw new RangeError(`Unknown action support actor ${normalizedSupportActorId || '(empty)'}.`);
  }
  if (!deployments.some(({ actorId }) => actorId === normalizedSupportActorId)) {
    deployments.push({
      actorId: normalizedSupportActorId,
      at: deployments[0]?.at ?? '1,5',
    });
  }
  return { deployments, supportActorId: normalizedSupportActorId };
}

function summonedTemplate(template) {
  return !(template.positions ?? []).length
    || (template.ai ?? []).some((line) => /^Spawn only\b/u.test(line));
}

function requestedEffectSpawns(encounter) {
  const requested = new Map();
  for (const enemy of encounter.enemies) {
    for (const skill of enemy.skills ?? []) {
      const ids = [
        ...(skill.effect?.summons ?? []),
        ...(skill.effect?.exposes ? [skill.effect.exposes] : []),
        ...(skill.effect?.createsWeakPoint ? [skill.effect.createsWeakPoint] : []),
      ];
      const counts = new Map();
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
      for (const [id, count] of counts) requested.set(id, Math.max(requested.get(id) ?? 0, count));
    }
  }
  return requested;
}

function canonicalEnemyTemplate(templateId) {
  for (const encounter of ENCOUNTERS) {
    const template = encounter.enemies.find(({ id }) => id === templateId);
    if (template) return template;
  }
  return null;
}

function effectSpawnTemplate(templateId, count) {
  const canonical = canonicalEnemyTemplate(templateId);
  if (canonical) {
    return {
      ...clone(canonical),
      count,
      positions: [],
      ai: [...(canonical.ai ?? []), 'Spawn only through an authored action effect.'],
    };
  }
  return {
    id: templateId,
    name: readableEffectName(templateId),
    count,
    positions: [],
    role: 'temporary action weak point',
    stats: { hp: 72, power: 0, guard: 2, speed: 0 },
    resistances: NEUTRAL_RESISTANCES,
    skills: [],
    ai: ['Spawn only through an authored action effect.'],
  };
}

function readableEffectName(id) {
  return String(id).split('-').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

function enemyActor(template, instanceIndex, position, context, attackIds) {
  const instanceId = `${template.id}-${instanceIndex + 1}`;
  const nonHostile = context.encounter.format === 'noncombat-resolution';
  const tutorialSentry = String(template.role ?? '').includes('immovable');
  const primaryBoss = ['boss', 'boss-rescue', 'boss-phase', 'final-boss'].includes(context.encounter.format)
    && template.id === context.encounter.enemies[0]?.id;
  const hp = actionEnemyHp(template.stats.hp, template.actionHpMultiplier ?? 1);
  const level = positiveLevel(context.options.enemyLevel ?? context.chapterTarget, 'enemyLevel');
  const adaptedPower = actionEnemyPower(template.stats.power, level);
  return {
    id: instanceId,
    name: (template.count ?? 1) > 1 ? `${template.name} ${instanceIndex + 1}` : template.name,
    faction: nonHostile ? 'neutral' : 'enemy',
    ai: nonHostile || attackIds.length === 0
      ? null
      : tutorialSentry
        ? 'deterministic-sentry'
        : 'deterministic-chase',
    level,
    hp,
    maxHp: hp,
    power: tutorialSentry ? Math.max(1, Math.round(adaptedPower * 0.5)) : adaptedPower,
    guard: template.stats.guard ?? 0,
    moveSpeed: movementSpeed(template.stats.speed),
    offensiveCooldownMs: tutorialSentry
      ? 1_200
      : Math.max(
          primaryBoss ? ACTION_BOSS_SHARED_COOLDOWN_FLOOR_MS : 0,
          actionEnemyGroupCooldownMs(
            sharedOffensiveCooldownMs(template.stats.speed),
            context.activeEnemyCount,
          ),
        ),
    position,
    facing: 'left',
    resistances: resistances(template.resistances),
    attackIds,
    statuses: context.activeEnemyCount > 1
      ? [{
          id: 'group-pressure',
          damageMultiplier: actionEnemyGroupDamageMultiplier(context.activeEnemyCount),
          activeEnemyCount: context.activeEnemyCount,
        }]
      : [],
  };
}

function adaptEnemyTemplate(template, templateIndex, context) {
  const attackRecords = (template.skills ?? []).map((skill) => adaptAttack(skill, {
    sourceKind: ENEMY_ATTACK_PREFIX,
    ownerTemplateId: template.id,
  }));
  const attackIds = attackRecords.map(({ id }) => id);
  const count = template.count ?? template.positions?.length ?? 1;
  const isDormant = summonedTemplate(template);
  const actors = [];
  const dormantActors = [];
  for (let index = 0; index < count; index += 1) {
    const sourcePosition = template.positions?.[index];
    const position = sourcePosition
      ? sidePosition(sourcePosition, templateIndex + index, context.stage)
      : dormantPosition(templateIndex + index, context.stage);
    const actor = enemyActor(template, index, position, context, attackIds);
    (isDormant ? dormantActors : actors).push(actor);
  }
  return {
    actors,
    dormantActors,
    attackRecords,
    profile: {
      sourceKind: 'enemy',
      templateId: template.id,
      instanceIds: actors.map(({ id }) => id),
      dormantInstanceIds: dormantActors.map(({ id }) => id),
      sourceSkillIds: (template.skills ?? []).map(({ id }) => id),
      actionAttackIds: attackIds,
      level: positiveLevel(context.options.enemyLevel ?? context.chapterTarget, 'enemyLevel'),
      stats: clone(template.stats),
      resistances: resistances(template.resistances),
      spawnState: isDormant ? 'authored-summon-not-instantiated' : (context.encounter.format === 'noncombat-resolution' ? 'initial-neutral' : 'initial'),
      role: template.role ?? null,
    },
  };
}

function objectiveMigration(encounter) {
  return {
    sourceType: encounter.objective?.type ?? null,
    sourceObjective: clone(encounter.objective ?? null),
    actionAuthority: false,
    compatibility: encounter.format === 'noncombat-resolution'
      ? 'noncombat-source-do-not-run-as-action-battle'
      : 'source-retained-objective-not-enforced',
  };
}

/**
 * Convert one current encounter into a frozen ActionCombatKernel specification.
 * Optional advancement state supplies actual party levels/stats; otherwise the
 * canonical chapter level target is used for both sides.
 */
export function adaptActionEncounter(encounterId, options = {}) {
  const encounter = getEncounter(encounterId);
  if (!encounter) throw new RangeError(`Unknown encounter ID: ${encounterId}`);
  const level = getLevel(encounter.levelId);
  if (!level) throw new RangeError(`Encounter ${encounterId} references unknown level ${encounter.levelId}.`);
  const chapterTarget = getChapterLevelTarget(encounter.chapterId);
  const progress = partyProgressById(options.advancementState);
  const stage = actionStageForLevel(level);
  const activeEnemyCount = encounter.enemies.reduce((total, template) => (
    total + (summonedTemplate(template) ? 0 : (template.count ?? template.positions?.length ?? 1))
  ), 0);
  const context = { encounter, level, stage, chapterTarget, progress, options, activeEnemyCount };
  const partyDeployment = partyDeploymentsWithSupport(
    encounter,
    options.supportActorId,
    options.fighterActorIds,
  );
  const deployedPartyIds = new Set(partyDeployment.deployments.map(({ actorId }) => actorId));
  const passiveSupportActorIds = (encounter.party?.roster ?? [])
    .filter((actorId) => actorId === 'aya' && !deployedPartyIds.has(actorId));

  const attacks = {};
  const attackManifest = [];
  const partyActors = [];
  const partyProfiles = [];
  for (const [index, deployment] of partyDeployment.deployments.entries()) {
    const adapted = partyActor(deployment, index, context);
    partyActors.push(adapted.actor);
    partyProfiles.push(adapted.profile);
    for (const skillId of PARTY_PROFILES[deployment.actorId].skillIds) {
      const skill = PARTY_SKILLS[skillId];
      if (!skill) throw new RangeError(`Party profile ${deployment.actorId} references unknown skill ${skillId}.`);
      const record = adaptAttack(skill, { sourceKind: PARTY_ATTACK_PREFIX, ownerTemplateId: deployment.actorId });
      attacks[record.id] = record.config;
      attackManifest.push(record.manifest);
    }
  }

  const enemyActors = [];
  const dormantActors = [];
  const enemyProfiles = [];
  const summonProfiles = [];
  for (const [index, template] of encounter.enemies.entries()) {
    const adapted = adaptEnemyTemplate(template, index, context);
    enemyActors.push(...adapted.actors);
    dormantActors.push(...adapted.dormantActors);
    enemyProfiles.push(adapted.profile);
    for (const record of adapted.attackRecords) {
      attacks[record.id] = record.config;
      attackManifest.push(record.manifest);
    }
  }
  const authoredTemplateIds = new Set(encounter.enemies.map(({ id }) => id));
  for (const [templateId, count] of requestedEffectSpawns(encounter)) {
    if (authoredTemplateIds.has(templateId)) continue;
    const adapted = adaptEnemyTemplate(
      effectSpawnTemplate(templateId, count),
      encounter.enemies.length + summonProfiles.length,
      context,
    );
    dormantActors.push(...adapted.dormantActors, ...adapted.actors);
    summonProfiles.push(adapted.profile);
    for (const record of adapted.attackRecords) {
      if (!attacks[record.id]) {
        attacks[record.id] = record.config;
        attackManifest.push(record.manifest);
      }
    }
  }
  const instanceIdsByTemplate = Object.fromEntries(
    [...enemyProfiles, ...summonProfiles].map((profile) => [
      profile.templateId,
      [...profile.instanceIds, ...profile.dormantInstanceIds],
    ]),
  );
  const statusHooks = createActionEffectHooks({
    attackManifest,
    instanceIdsByTemplate,
    passiveSupportActorIds,
  });

  return deepFreeze({
    schemaVersion: ACTION_ENCOUNTER_ADAPTER_SCHEMA_VERSION,
    encounterId: encounter.id,
    chapterId: encounter.chapterId,
    levelId: level.id,
    format: encounter.format,
    supportActorId: partyDeployment.supportActorId,
    passiveSupportActorIds,
    chapterLevelTarget: chapterTarget,
    objectiveMigration: objectiveMigration(encounter),
    effectMigration: {
      actionAuthority: true,
      compatibility: 'status-hooks-displacement-summons-defense-and-objective-effect-bridge',
      instanceIdsByTemplate,
    },
    kernelConfig: {
      stage,
      attacks,
      actors: [
        ...partyActors,
        ...enemyActors,
        ...dormantActors.map((actor) => ({
          ...actor,
          hp: 0,
          statuses: [{ id: 'dormant-summon' }],
        })),
      ],
      controlledActorId: options.controlledActorId ?? partyActors.find(({ hp }) => hp > 0)?.id ?? null,
      automaticVictory: options.automaticVictory !== false,
      statusHooks,
    },
    dormantActors,
    profiles: {
      party: partyProfiles,
      enemies: enemyProfiles,
      summons: summonProfiles,
    },
    attackManifest,
  });
}

/** Adapt every canonical encounter in canonical order. */
export function adaptAllActionEncounters(options = {}) {
  return Object.freeze(ACTION_ENCOUNTER_IDS.map((encounterId) => adaptActionEncounter(encounterId, options)));
}

/** Convenience constructor; objective/effect migration metadata stays on spec. */
export function createActionEncounterKernel(encounterId, options = {}) {
  const spec = adaptActionEncounter(encounterId, options);
  return Object.freeze({ spec, kernel: new ActionCombatKernel(spec.kernelConfig) });
}

/**
 * Project an action terminal snapshot into battle-result-contract v1 shape.
 * No contract module import is used: this remains an engine-side compatibility
 * boundary while that shared contract stabilizes.
 */
export function projectActionTerminalResult(encounterOrSpec, snapshot, options = {}) {
  const encounterId = typeof encounterOrSpec === 'string'
    ? encounterOrSpec
    : encounterOrSpec?.encounterId;
  if (!ACTION_ENCOUNTER_IDS.includes(encounterId)) throw new RangeError(`Unknown encounter ID: ${encounterId}.`);
  if (!snapshot || !['victory', 'defeat'].includes(snapshot.outcome)) {
    throw new TypeError('A terminal action snapshot with victory or defeat is required.');
  }
  if (!Array.isArray(snapshot.actors)) throw new TypeError('Action snapshot actors must be an array.');

  const partyVitals = {};
  for (const actor of snapshot.actors) {
    if (actor?.faction !== 'player' || !(actor.hp > 0) || !PARTY_PROFILES[actor.id]) continue;
    if (!Number.isSafeInteger(actor.hp)) throw new TypeError(`Action party HP for ${actor.id} must be a safe integer.`);
    if (Object.hasOwn(partyVitals, actor.id)) throw new TypeError(`Duplicate action party actor ${actor.id}.`);
    partyVitals[actor.id] = { hp: actor.hp };
  }

  const suppliedDebits = options.itemDebits ?? {};
  const itemDebits = Object.fromEntries(BATTLE_ITEM_IDS.map((itemId) => {
    const quantity = suppliedDebits[itemId] ?? 0;
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new RangeError(`itemDebits.${itemId} must be a non-negative safe integer.`);
    }
    return [itemId, quantity];
  }));
  for (const itemId of Object.keys(suppliedDebits)) {
    if (!BATTLE_ITEM_IDS.includes(itemId)) throw new RangeError(`Unknown battle item debit ${itemId}.`);
  }

  return deepFreeze({
    schemaVersion: 1,
    encounterId,
    result: snapshot.outcome,
    partyVitals,
    itemDebits,
  });
}
