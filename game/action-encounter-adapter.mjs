/**
 * Migration adapter from the canonical authored encounter kit to the isolated
 * side-view ActionCombatKernel configuration.
 *
 * This module converts actors and attacks only. Source objectives, boss phases,
 * summons, displacements, and statuses are retained as migration metadata but
 * are not claimed as action-kernel behavior. Campaign Battle remains their
 * authority until dedicated action objective/effect adapters exist.
 */

import { getChapterLevelTarget, getParty } from './advancement.mjs';
import { PARTY_PROFILES, PARTY_SKILLS } from './campaign-combat.mjs';
import { ActionCombatKernel, ACTION_FIXED_STEP_MS } from './action-combat.mjs';
import { ENCOUNTERS, getEncounter, RECOVERY_PULSE_MS } from './content/encounters.mjs';
import { getLevel, parseTileKey } from './content/levels.mjs';
import { BATTLE_ITEM_IDS } from './loadout.mjs';

export const ACTION_ENCOUNTER_ADAPTER_SCHEMA_VERSION = 1;
export const ACTION_ENCOUNTER_IDS = Object.freeze(ENCOUNTERS.map(({ id }) => id));
export const ACTION_TILE_PX = 64;
export const ACTION_STAGE_GROUND_Y = 320;
export const ZERO_RECOVERY_COOLDOWN_FLOOR_MS = 420;
export const MINIMUM_SHARED_OFFENSIVE_COOLDOWN_MS = 260;

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
 * means no cooldown: it receives an explicit 420 ms floor.
 */
export function actionCooldownForRecovery(recoveryPulses = 0) {
  const pulses = Number.isInteger(recoveryPulses) && recoveryPulses > 0 ? recoveryPulses : 0;
  return Math.max(ZERO_RECOVERY_COOLDOWN_FLOOR_MS, pulses * RECOVERY_PULSE_MS);
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
      effectCompatibility: skill.effect ? 'source-retained-not-executed' : 'none',
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
    ai: null,
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
    statuses: [],
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

function summonedTemplate(template) {
  return !(template.positions ?? []).length
    || (template.ai ?? []).some((line) => /^Spawn only\b/u.test(line));
}

function enemyActor(template, instanceIndex, position, context, attackIds) {
  const instanceId = `${template.id}-${instanceIndex + 1}`;
  const nonHostile = context.encounter.format === 'noncombat-resolution';
  return {
    id: instanceId,
    name: (template.count ?? 1) > 1 ? `${template.name} ${instanceIndex + 1}` : template.name,
    faction: nonHostile ? 'neutral' : 'enemy',
    ai: nonHostile || attackIds.length === 0 ? null : 'deterministic-chase',
    level: positiveLevel(context.options.enemyLevel ?? context.chapterTarget, 'enemyLevel'),
    hp: template.stats.hp,
    maxHp: template.stats.hp,
    power: template.stats.power ?? 0,
    guard: template.stats.guard ?? 0,
    moveSpeed: movementSpeed(template.stats.speed),
    offensiveCooldownMs: sharedOffensiveCooldownMs(template.stats.speed),
    position,
    facing: 'left',
    resistances: resistances(template.resistances),
    attackIds,
    statuses: [],
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
  const context = { encounter, level, stage, chapterTarget, progress, options };

  const attacks = {};
  const attackManifest = [];
  const partyActors = [];
  const partyProfiles = [];
  for (const [index, deployment] of encounter.party.deployment.entries()) {
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

  return deepFreeze({
    schemaVersion: ACTION_ENCOUNTER_ADAPTER_SCHEMA_VERSION,
    encounterId: encounter.id,
    chapterId: encounter.chapterId,
    levelId: level.id,
    format: encounter.format,
    chapterLevelTarget: chapterTarget,
    objectiveMigration: objectiveMigration(encounter),
    effectMigration: {
      actionAuthority: false,
      compatibility: 'source-effects-retained-in-attack-manifest-not-executed',
    },
    kernelConfig: {
      stage,
      attacks,
      actors: [...partyActors, ...enemyActors],
    },
    dormantActors,
    profiles: {
      party: partyProfiles,
      enemies: enemyProfiles,
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
