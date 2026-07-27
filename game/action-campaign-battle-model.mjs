/**
 * DOM-free composition root for the non-canonical campaign action battle.
 *
 * The model deliberately keeps the authored-objective runtime injectable. The
 * The objective entity director below owns side-view tokens and destructible
 * scenery while the combat kernel remains the sole authority for actors,
 * attacks, movement, damage, and cooldowns.
 */

import { ACTION_MANEUVER_IDS, ActionCombatKernel } from './action-combat.mjs';
import {
  HUNTER_PRIEST_COMBO_CONTRACT,
  getHunterPriestComboAvailability,
} from './action-combos.mjs';
import {
  actionCooldownForRecovery,
  adaptActionEncounter,
  projectActionTerminalResult,
  sharedOffensiveCooldownMs,
} from './action-encounter-adapter.mjs';
import { adaptActionObjective } from './action-objectives.mjs';
import { createActionObjectiveRuntime } from './action-objective-runtime.mjs';
import {
  ACTION_SUBWEAPON_IDS,
  ACTION_SUBWEAPONS,
  createActionSubweaponStock,
  getActionSubweapon,
} from './action-subweapons.mjs';
import {
  createActionStagePhysicsHooks,
  getActionStage,
  toActionKernelStage,
} from './action-stages.mjs';
import { createBattleResultRecord } from './battle-result-contract.mjs';
import { getEncounter, ENCOUNTERS } from './content/encounters.mjs';
import { BATTLE_ITEM_IDS, getLoadoutModifiers } from './loadout.mjs';

export const ACTION_CAMPAIGN_BATTLE_SCHEMA_VERSION = 1;

const SAFE_RETURN_TARGET = /^[a-z0-9][a-z0-9._/?=&-]*$/iu;
const FALLBACK_OBJECTIVE_TYPES = new Set(['defeatAll', 'defeatBoss', 'thresholdOrObjects']);
const CONNECTED_OBJECTIVE_TYPES = new Set([
  'surviveThenExit',
  'defeatAll',
  'defeatBoss',
  'thresholdOrObjects',
  'escortTokens',
  'defeatBossWithProtection',
  'clearRoute',
  'releaseTarget',
  'protectObjects',
  'disableOrdersAndProtect',
  'returnItemToTile',
  'extractAllBeforeCountdown',
  'activateRelays',
  'defeatBossAndRelease',
  'breakObjects',
  'breakPhaseObjects',
  'defeatBossAndEvacuate',
  'completeInteractions',
]);
const BOSS_COMBAT_TYPES = new Set([
  'defeatBoss',
  'defeatBossWithProtection',
  'defeatBossAndRelease',
  'defeatBossAndEvacuate',
]);
const OBJECTIVE_TOKEN_SPEED_PX_PER_SECOND = 160;
const OBJECTIVE_TOKEN_RECRUIT_DISTANCE_PX = 132;
const OBJECTIVE_TOKEN_TRAIL_DISTANCE_PX = 34;
const OBJECTIVE_TOKEN_BOUNDS = Object.freeze({ width: 28, height: 54 });
const OBJECTIVE_OBJECT_DEFAULT_HP = 3;
const OBJECTIVE_CORE_HP = 6;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function readableId(value) {
  return String(value ?? '').split('-').map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '').join(' ');
}

function actorTemplateMap(spec) {
  const result = {};
  for (const profile of [...spec.profiles.party, ...spec.profiles.enemies, ...(spec.profiles.summons ?? [])]) {
    for (const actorId of [...profile.instanceIds, ...(profile.dormantInstanceIds ?? [])]) {
      result[actorId] = profile.templateId;
    }
  }
  return result;
}

function applySpawnSlots(actors, stage) {
  const party = actors.filter(({ faction, hp }) => faction === 'player' && hp > 0);
  const enemies = actors.filter(({ faction, hp }) => faction === 'enemy' && hp > 0);
  if (party.length > stage.spawns.party.length || enemies.length > stage.spawns.enemy.length) {
    throw new RangeError(
      `Action stage ${stage.id} lacks spawn capacity for ${party.length} party and ${enemies.length} enemy actors.`,
    );
  }
  const result = actors.map((actor) => clone(actor));
  const byId = new Map(result.map((actor) => [actor.id, actor]));
  for (const [index, actor] of party.entries()) {
    const slot = stage.spawns.party[index];
    Object.assign(byId.get(actor.id), {
      position: { x: slot.x, y: slot.y },
      facing: slot.facing,
      grounded: true,
    });
  }
  for (const [index, actor] of enemies.entries()) {
    const slot = stage.spawns.enemy[index];
    Object.assign(byId.get(actor.id), {
      position: { x: slot.x, y: slot.y },
      facing: slot.facing,
      grounded: true,
    });
  }
  return result;
}

function multiplyResistances(base, modifiers) {
  const result = { delivery: {}, essence: {} };
  for (const family of ['delivery', 'essence']) {
    for (const [key, value] of Object.entries(base?.[family] ?? {})) {
      result[family][key] = Math.round(value * (modifiers?.[family]?.[key] ?? 1) * 10_000) / 10_000;
    }
  }
  return result;
}

function applyLoadout(actors, attacks, manifest, loadoutState) {
  if (!loadoutState) return { actors, attacks };
  const nextActors = actors.map((actor) => {
    if (actor.faction !== 'player') return actor;
    const modifiers = getLoadoutModifiers(loadoutState, actor.id);
    const maximumHp = Math.max(1, actor.maxHp + modifiers.stats.hp);
    const savedHp = loadoutState.vitals?.[actor.id]?.hp;
    const sourceSpeed = Math.max(0, Math.round((actor.moveSpeed - 80) / 0.6));
    const adjustedSpeed = Math.max(0, sourceSpeed + modifiers.stats.speed);
    const speed = Math.max(1, Math.round(80 + adjustedSpeed * 0.6));
    return {
      ...actor,
      hp: Math.max(1, Math.min(maximumHp, Number.isFinite(savedHp) ? Math.trunc(savedHp) : maximumHp)),
      maxHp: maximumHp,
      power: actor.power + modifiers.stats.power,
      guard: actor.guard + modifiers.stats.guard,
      moveSpeed: speed,
      offensiveCooldownMs: sharedOffensiveCooldownMs(adjustedSpeed),
      resistances: multiplyResistances(actor.resistances, modifiers.resistances),
      statuses: [...(loadoutState.vitals?.[actor.id]?.statuses ?? [])],
    };
  });
  const nextAttacks = clone(attacks);
  for (const record of manifest) {
    if (record.sourceKind !== 'party') continue;
    const modifiers = getLoadoutModifiers(loadoutState, record.ownerTemplateId);
    const recoveryPulses = Math.max(0, record.sourceRecoveryPulses + modifiers.recoveryPulsesDelta);
    nextAttacks[record.adapterAttackId].cooldownMs = actionCooldownForRecovery(recoveryPulses);
  }
  return { actors: nextActors, attacks: nextAttacks };
}

function applyPartyVitals(actors, partyVitals) {
  if (partyVitals == null) return actors;
  if (typeof partyVitals !== 'object' || Array.isArray(partyVitals)) {
    throw new TypeError('partyVitals must be an object when supplied.');
  }
  return actors.map((actor) => {
    if (actor.faction !== 'player' || !Object.hasOwn(partyVitals, actor.id)) return actor;
    const hp = partyVitals[actor.id]?.hp;
    if (!Number.isSafeInteger(hp) || hp < 0 || hp > actor.maxHp) {
      throw new RangeError(`partyVitals.${actor.id}.hp must be an integer from zero through ${actor.maxHp}.`);
    }
    return { ...actor, hp };
  });
}

function requirementView(contract, completedIds) {
  return contract.requirements.map((requirement) => ({
    id: requirement.id,
    semantics: requirement.semantics,
    complete: completedIds.has(requirement.id),
  }));
}

function living(snapshot, faction) {
  return snapshot.actors.filter((actor) => actor.faction === faction && actor.hp > 0);
}

function bossActor(session, snapshot) {
  const bossTemplateId = session.spec.profiles.enemies[0]?.templateId;
  return snapshot.actors.find((actor) => session.actorTemplates[actor.id] === bossTemplateId) ?? null;
}

function createBossPhaseDirector(encounter, spec, kernel, actorTemplates) {
  const phases = encounter.bossMechanic?.phases;
  if (!Array.isArray(phases) || phases.length === 0) return null;
  const bossTemplateId = encounter.objective?.bossId ?? spec.profiles.enemies[0]?.templateId;
  const bossActorId = kernel.actorOrder.find((actorId) => actorTemplates[actorId] === bossTemplateId);
  const boss = bossActorId ? kernel.getActor(bossActorId) : null;
  if (!boss) return null;
  const director = {
    bossActorId,
    bossTemplateId,
    phases: clone(phases),
    phaseIndex: 0,
    history: [phases[0].id],
    revision: 0,
    completedBossActivations: 0,
    warnedForActivation: null,
    lastTransition: null,
    allAttackIds: [...boss.attackIds],
  };
  applyBossPhaseMoves(director, kernel, spec);
  return director;
}

function phaseMoveAttackIds(director, phase, spec) {
  if (!Array.isArray(phase.moves)) return director.allAttackIds;
  const sourceSkills = new Set(phase.moves);
  return spec.attackManifest
    .filter(({ ownerTemplateId, sourceSkillId }) => (
      ownerTemplateId === director.bossTemplateId && sourceSkills.has(sourceSkillId)
    ))
    .map(({ adapterAttackId }) => adapterAttackId);
}

function applyBossPhaseMoves(director, kernel, spec = null) {
  const boss = kernel.getActor(director.bossActorId);
  const phase = director.phases[director.phaseIndex];
  if (!boss || !phase || !spec) return;
  boss.attackIds = phaseMoveAttackIds(director, phase, spec);
  if (boss.attackIds.length === 0 && Array.isArray(phase.moves)) boss.movementIntent = { x: 0, y: 0 };
}

function bossHpPhaseSatisfied(phase, boss, director, objective = null) {
  const enter = phase.enter;
  if (!enter) return false;
  const hpRatio = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0;
  if (enter.kind === 'boss-hp-ratio-at-or-below') return hpRatio <= enter.value;
  if (enter.kind !== 'any') return false;
  if (enter.requiresPhaseId && !director.history.includes(enter.requiresPhaseId)) return false;
  const completedObjectiveIds = new Set(
    (objective?.requirements ?? [])
      .filter(({ complete }) => complete)
      .map(({ id }) => id),
  );
  return (enter.conditions ?? []).some((condition) => (
    (condition.kind === 'boss-hp-ratio-at-or-below' && hpRatio <= condition.value)
      || (
        condition.kind === 'objective-keys-complete'
          && (condition.keys ?? []).length > 0
          && condition.keys.every((key) => completedObjectiveIds.has(key))
      )
  ));
}

function bossPhaseEvent(type, director, kernel, payload = {}) {
  return {
    type,
    nowMs: kernel.nowMs,
    bossActorId: director.bossActorId,
    phaseId: director.phases[director.phaseIndex].id,
    revision: director.revision,
    ...payload,
  };
}

function updateBossPhaseDirector(session, kernelEvents, objective = null) {
  const director = session.bossPhaseDirector;
  if (!director) return [];
  const boss = session.kernel.getActor(director.bossActorId);
  if (!boss) return [];
  const emitted = [];
  const completed = kernelEvents.filter(({ type, actorId }) => (
    type === 'attack-complete' && actorId === director.bossActorId
  )).length;
  director.completedBossActivations += completed;

  const cadence = session.encounter.bossMechanic?.phaseCycle;
  if (cadence && completed > 0) {
    const phaseLength = cadence.completedBossActivationsPerPhase;
    const nextTransitionAt = (Math.floor(director.completedBossActivations / phaseLength) + 1) * phaseLength;
    const warningAt = nextTransitionAt - cadence.warningActivations;
    if (director.completedBossActivations === warningAt
        && director.warnedForActivation !== nextTransitionAt) {
      director.warnedForActivation = nextTransitionAt;
      const toIndex = (director.phaseIndex + 1) % director.phases.length;
      emitted.push(bossPhaseEvent('boss-phase-warning', director, session.kernel, {
        toPhaseId: director.phases[toIndex].id,
        transitionAtActivation: nextTransitionAt,
      }));
    }
    if (director.completedBossActivations > 0
        && director.completedBossActivations % phaseLength === 0) {
      const fromPhaseId = director.phases[director.phaseIndex].id;
      director.phaseIndex = (director.phaseIndex + 1) % director.phases.length;
      director.revision += 1;
      director.history.push(director.phases[director.phaseIndex].id);
      director.lastTransition = {
        fromPhaseId,
        toPhaseId: director.phases[director.phaseIndex].id,
        atMs: session.kernel.nowMs,
        reason: 'boss-activation-cadence',
      };
      applyBossPhaseMoves(director, session.kernel, session.spec);
      emitted.push(bossPhaseEvent('boss-phase-entered', director, session.kernel, director.lastTransition));
    }
  } else {
    while (director.phaseIndex + 1 < director.phases.length
        && bossHpPhaseSatisfied(director.phases[director.phaseIndex + 1], boss, director, objective)) {
      const fromPhaseId = director.phases[director.phaseIndex].id;
      director.phaseIndex += 1;
      director.revision += 1;
      director.history.push(director.phases[director.phaseIndex].id);
      director.lastTransition = {
        fromPhaseId,
        toPhaseId: director.phases[director.phaseIndex].id,
        atMs: session.kernel.nowMs,
        reason: 'boss-hp-threshold',
      };
      applyBossPhaseMoves(director, session.kernel, session.spec);
      emitted.push(bossPhaseEvent('boss-phase-entered', director, session.kernel, director.lastTransition));
    }
  }
  return emitted;
}

function bossPhaseSnapshot(session, kernelSnapshot) {
  const director = session.bossPhaseDirector;
  if (!director) return null;
  const phase = director.phases[director.phaseIndex];
  const boss = kernelSnapshot.actors.find(({ id }) => id === director.bossActorId);
  return deepFreeze({
    bossActorId: director.bossActorId,
    phaseId: phase.id,
    name: readableId(phase.id),
    rule: phase.rule ?? null,
    revision: director.revision,
    history: [...director.history],
    completedBossActivations: director.completedBossActivations,
    hpRatio: boss?.maxHp > 0 ? Math.round((boss.hp / boss.maxHp) * 10_000) / 10_000 : 0,
    lastTransition: clone(director.lastTransition),
  });
}

function anchorById(stage, id) {
  return stage.objectiveAnchors.find((anchor) => anchor.id === id) ?? null;
}

function rectsOverlap(left, right) {
  return left.left <= right.right
    && left.right >= right.left
    && left.top <= right.bottom
    && left.bottom >= right.top;
}

function anchorRect(anchor) {
  return {
    left: anchor.x - anchor.width / 2,
    right: anchor.x + anchor.width / 2,
    top: anchor.y - anchor.height,
    bottom: anchor.y,
  };
}

function tokenRect(token) {
  return {
    left: token.position.x - token.bounds.width / 2,
    right: token.position.x + token.bounds.width / 2,
    top: token.position.y - token.bounds.height,
    bottom: token.position.y,
  };
}

function eventHitboxRect(event) {
  const hitbox = event?.hitbox;
  if (!hitbox || ![hitbox.left, hitbox.right, hitbox.top, hitbox.bottom].every(Number.isFinite)) return null;
  return hitbox;
}

function requirementDestination(session, tokenId) {
  const requirement = session.objectiveContract.requirements.find((entry) => (
    entry.semantics === 'overlap'
      && entry.subject?.kind === 'objective-token'
      && entry.subject.tokenId === tokenId
  ));
  return (requirement?.anchorIds ?? []).map((id) => anchorById(session.stage, id)).find(Boolean) ?? null;
}

function createObjectiveEntityDirector(encounter, stage, contract) {
  const tokenIds = new Set([
    ...(encounter.party?.objectiveTokens ?? []).map(({ id }) => id),
    ...contract.requirements
      .filter((entry) => entry.subject?.kind === 'objective-token')
      .map((entry) => entry.subject.tokenId),
  ]);
  const prisonerIds = new Set(encounter.objective?.targets ?? []);
  const tokens = [...tokenIds].map((id, index) => {
    const anchor = anchorById(stage, id);
    if (!anchor) throw new RangeError(`${encounter.id} objective token ${id} has no side-view anchor.`);
    return {
      id,
      position: { x: anchor.x, y: anchor.y },
      bounds: { ...OBJECTIVE_TOKEN_BOUNDS },
      hp: 3,
      maxHp: 3,
      tag: id.startsWith('witness-') ? 'witness' : id.startsWith('prisoner-') ? 'prisoner' : 'objective',
      released: !prisonerIds.has(id),
      recruited: !prisonerIds.has(id),
      secured: false,
      order: index,
    };
  });

  const protectedIds = new Set(encounter.objective?.protectedObjects ?? []);
  const enemyTemplateIds = new Set(encounter.enemies.map(({ id }) => id));
  const attackableIds = new Set([
    ...(encounter.objective?.objectIds ?? []),
    ...(encounter.objective?.objectCondition?.objectIds ?? []),
  ].filter((id) => !enemyTemplateIds.has(id)));
  const objectIds = new Set([...protectedIds, ...attackableIds]);
  if ((contract.failures ?? []).some(({ match }) => match?.objectId === 'archive-core')) {
    objectIds.add('archive-core');
    protectedIds.add('archive-core');
  }
  const objects = [...objectIds].map((id) => {
    const anchor = anchorById(stage, id);
    if (!anchor) throw new RangeError(`${encounter.id} objective object ${id} has no side-view anchor.`);
    const maxHp = id === 'archive-core'
      ? OBJECTIVE_CORE_HP
      : attackableIds.has(id) ? 1 : OBJECTIVE_OBJECT_DEFAULT_HP;
    return {
      id,
      position: { x: anchor.x, y: anchor.y },
      bounds: { width: anchor.width, height: anchor.height },
      hp: maxHp,
      maxHp,
      protected: protectedIds.has(id),
      attackable: attackableIds.has(id),
      destroyed: false,
    };
  });
  return {
    tokens,
    objects,
    enemyActionCount: 0,
    intactCheckpointEmitted: false,
    bellCount: 0,
  };
}

function objectiveEntitySnapshot(session) {
  const director = session.objectiveEntities;
  return deepFreeze({
    tokens: director.tokens.map((token) => ({
      id: token.id,
      position: { ...token.position },
      destination: clone(requirementDestination(session, token.id)),
      bounds: { ...token.bounds },
      hp: token.hp,
      maxHp: token.maxHp,
      tag: token.tag,
      released: token.released,
      recruited: token.recruited,
      secured: token.secured,
    })),
    objects: director.objects.map((object) => ({
      id: object.id,
      position: { ...object.position },
      bounds: { ...object.bounds },
      hp: object.hp,
      maxHp: object.maxHp,
      protected: object.protected,
      attackable: object.attackable,
      destroyed: object.destroyed,
    })),
    enemyActionCount: director.enemyActionCount,
    bellCount: director.bellCount,
  });
}

function requirementAnchorSnapshot(session, requirementId) {
  const requirement = session.objectiveContract.requirements.find(({ id }) => id === requirementId);
  const anchor = (requirement?.anchorIds ?? [])
    .map((anchorId) => anchorById(session.stage, anchorId))
    .find(Boolean);
  return anchor == null ? null : {
    id: anchor.id,
    x: anchor.x,
    y: anchor.y,
    width: anchor.width,
    height: anchor.height,
  };
}

function entityEventsFromCombat(session, events) {
  const result = [];
  const director = session.objectiveEntities;
  const sourceSkillByAttackId = new Map(
    session.spec.attackManifest.map(({ adapterAttackId, sourceSkillId }) => [adapterAttackId, sourceSkillId]),
  );
  for (const event of events) {
    if (event.type === 'attack-complete') {
      const actor = session.kernel.getActor(event.actorId);
      if (actor?.faction === 'enemy') {
        director.enemyActionCount += 1;
        if (sourceSkillByAttackId.get(event.attackId) === 'ringing-count') {
          director.bellCount += 1;
          result.push({
            type: 'boss-cast-completed',
            castId: 'bell-count',
            actorId: event.actorId,
            count: director.bellCount,
          });
        }
      }
    }
    if (event.type !== 'hitbox-resolved') continue;
    const hitbox = eventHitboxRect(event);
    const attacker = session.kernel.getActor(event.actorId);
    if (!hitbox || !attacker) continue;
    if (attacker.faction === 'player') {
      for (const object of director.objects) {
        if (!object.attackable || object.destroyed || !rectsOverlap(hitbox, {
          left: object.position.x - object.bounds.width / 2,
          right: object.position.x + object.bounds.width / 2,
          top: object.position.y - object.bounds.height,
          bottom: object.position.y,
        })) continue;
        object.hp = Math.max(0, object.hp - 1);
        result.push({ type: 'objective-object-hit', objectId: object.id, actorId: attacker.id, hp: object.hp });
        if (object.hp === 0) {
          object.destroyed = true;
          result.push({ type: 'objective-object-destroyed', objectId: object.id, actorId: attacker.id });
        }
      }
    } else if (attacker.faction === 'enemy') {
      for (const object of director.objects) {
        if (!object.protected || object.destroyed || !rectsOverlap(hitbox, {
          left: object.position.x - object.bounds.width / 2,
          right: object.position.x + object.bounds.width / 2,
          top: object.position.y - object.bounds.height,
          bottom: object.position.y,
        })) continue;
        object.hp = Math.max(0, object.hp - 1);
        if (object.hp === 0) {
          object.destroyed = true;
          result.push({ type: 'objective-object-destroyed', objectId: object.id, actorId: attacker.id });
        }
      }
      for (const token of director.tokens) {
        if (token.hp <= 0 || !token.released || !rectsOverlap(hitbox, tokenRect(token))) continue;
        token.hp = Math.max(0, token.hp - 1);
        if (token.hp === 0) {
          result.push({
            type: 'tagged-actor-incapacitated',
            actorId: token.id,
            actorIds: [token.id],
            tag: token.tag,
          });
        }
      }
    }
  }
  return result;
}

function moveObjectiveTokens(session, elapsedMs, kernelSnapshot, input) {
  const actor = kernelSnapshot.actors.find(({ id }) => id === kernelSnapshot.controlledActorId && id) ?? null;
  if (!actor || actor.hp <= 0) return;
  for (const token of session.objectiveEntities.tokens) {
    if (!token.released || token.secured || token.hp <= 0) continue;
    const distance = Math.hypot(token.position.x - actor.position.x, token.position.y - actor.position.y);
    if (distance <= OBJECTIVE_TOKEN_RECRUIT_DISTANCE_PX
        && (input.interactPressed || session.objectiveContract.objectiveType === 'escortTokens')) {
      token.recruited = true;
    }
    if (!token.recruited) continue;
    const destination = requirementDestination(session, token.id);
    const actorAtDestination = destination && actorOverlapsAnchor(actor, destination);
    const trailOffset = OBJECTIVE_TOKEN_TRAIL_DISTANCE_PX + token.order * 12;
    const target = actorAtDestination
      ? {
          x: destination.x + (token.order - (session.objectiveEntities.tokens.length - 1) / 2) * 18,
          y: destination.y,
        }
      : {
          x: actor.position.x - actor.facing * trailOffset,
          y: actor.position.y,
        };
    const deltaX = target.x - token.position.x;
    const deltaY = target.y - token.position.y;
    const length = Math.hypot(deltaX, deltaY);
    const maximum = OBJECTIVE_TOKEN_SPEED_PX_PER_SECOND * elapsedMs / 1000;
    if (length > 0) {
      const scale = Math.min(1, maximum / length);
      token.position.x = Math.max(
        session.stage.bounds.minX,
        Math.min(session.stage.bounds.maxX, token.position.x + deltaX * scale),
      );
      token.position.y = Math.max(
        session.stage.bounds.minY,
        Math.min(session.stage.bounds.maxY, token.position.y + deltaY * scale),
      );
    }
    if (destination && rectsOverlap(tokenRect(token), anchorRect(destination))) token.secured = true;
  }
}

function intactCheckpointEvents(session) {
  if (session.objectiveEntities.intactCheckpointEmitted) return [];
  const type = session.objectiveContract.objectiveType;
  const runtime = session.objectiveRuntime?.snapshot?.();
  const ready = type === 'protectObjects'
    ? session.objectiveEntities.enemyActionCount >= (session.encounter.objective.turns ?? 0)
    : type === 'disableOrdersAndProtect'
      ? runtime?.requirements.some(({ id, completed }) => id === 'disable-orders' && completed)
      : false;
  if (!ready) return [];
  session.objectiveEntities.intactCheckpointEmitted = true;
  return session.objectiveEntities.objects
    .filter((object) => object.protected && !object.destroyed)
    .map((object) => ({ type: 'objective-object-intact-at-checkpoint', objectId: object.id }));
}

function syncObjectiveEntityDependencies(session) {
  const runtime = session.objectiveRuntime?.snapshot?.();
  if (!runtime) return;
  for (const token of session.objectiveEntities.tokens) {
    if (runtime.requirements.some(({ id, completed }) => id === `release:${token.id}` && completed)) {
      token.released = true;
      token.recruited = true;
    }
    if (runtime.requirements.some(({ id, completed }) => (
      (id === `escort:${token.id}` || id === `secure:${token.id}` || id === `extract:${token.id}`)
        && completed
    ))) token.secured = true;
  }
}

function fallbackObjectiveSnapshot(session, kernelSnapshot) {
  const type = session.objectiveContract.objectiveType;
  const supported = FALLBACK_OBJECTIVE_TYPES.has(type);
  const completedIds = new Set();
  const boss = bossActor(session, kernelSnapshot);
  if (type === 'defeatAll' && living(kernelSnapshot, 'enemy').length === 0) completedIds.add('defeat-all');
  if (type === 'defeatBoss' && (!boss || boss.hp <= 0)) completedIds.add('defeat-boss');
  if (type === 'thresholdOrObjects' && boss && boss.maxHp > 0
      && boss.hp / boss.maxHp <= session.encounter.objective.hpThreshold) {
    completedIds.add('boss-hp-threshold');
  }
  const complete = supported && (
    type === 'thresholdOrObjects'
      ? completedIds.has('boss-hp-threshold')
      : session.objectiveContract.requirements.every(({ id }) => completedIds.has(id))
  );
  return deepFreeze({
    supported,
    complete,
    failed: living(kernelSnapshot, 'player').length === 0,
    status: supported ? (complete ? 'complete' : 'active') : 'runtime-pending',
    message: supported
      ? 'Combat events are authoritative for this objective.'
      : `The ${type} action-objective runtime is not connected; settlement remains locked.`,
    requirements: requirementView(session.objectiveContract, completedIds),
  });
}

/**
 * Replaceable objective bridge. A full runtime may be supplied with
 * `objectiveRuntimeFactory({ contract, encounter, stage, spec })`; it must
 * expose `advance(frame)` and `snapshot(frame)` returning the fallback shape.
 */
function createObjectiveBridge(session, objectiveRuntimeFactory) {
  if (typeof objectiveRuntimeFactory !== 'function') return null;
  const runtime = objectiveRuntimeFactory({
    contract: session.objectiveContract,
    stage: session.stage,
    initialKernelSnapshot: session.kernel.snapshot(),
  });
  if (!runtime || typeof runtime.snapshot !== 'function') {
    throw new TypeError('Objective runtime factory must return a runtime with snapshot().');
  }
  return runtime;
}

function objectiveSnapshot(session, kernelSnapshot = session.kernel.snapshot()) {
  if (!session.objectiveRuntime) return fallbackObjectiveSnapshot(session, kernelSnapshot);
  const snapshot = session.objectiveRuntime.snapshot();
  const supported = CONNECTED_OBJECTIVE_TYPES.has(session.objectiveContract.objectiveType);
  const complete = snapshot.status === 'completed';
  const failed = snapshot.status === 'failed';
  return deepFreeze({
    supported,
    complete,
    failed,
    status: supported ? snapshot.status : 'runtime-pending',
    message: supported
      ? 'Kernel events and authored actor overlap/interact/cast signals are authoritative.'
      : `The ${session.objectiveContract.objectiveType} contract needs token or destructible-scenery authority not connected by this page; settlement remains locked.`,
    requirements: snapshot.requirements.map((requirement) => ({
      id: requirement.id,
      semantics: requirement.semantics,
      available: requirement.available,
      value: requirement.value,
      target: requirement.target,
      complete: requirement.completed,
      castElapsedMs: requirement.castElapsedMs,
      castDurationMs: requirement.castDurationMs,
      targetAnchor: requirementAnchorSnapshot(session, requirement.id),
    })),
    failures: snapshot.failures,
    runtime: snapshot,
    entities: objectiveEntitySnapshot(session),
  });
}

function actorOverlapsAnchor(actor, anchor) {
  return actor.position.x >= anchor.x - anchor.width / 2
    && actor.position.x <= anchor.x + anchor.width / 2
    && actor.position.y >= anchor.y - anchor.height
    && actor.position.y <= anchor.y;
}

function objectiveSignals(session, snapshot, input) {
  const actor = snapshot.actors.find(({ id }) => id === snapshot.controlledActorId && id) ?? null;
  if (!actor || actor.hp <= 0) return { subjects: [], interactions: [], casts: [] };
  const subjects = [
    ...session.objectiveEntities.tokens
      .filter((token) => token.released && token.hp > 0)
      .map((token) => ({
        kind: 'objective-token',
        tokenId: token.id,
        position: { ...token.position },
        bounds: { ...token.bounds },
      })),
    ...session.objectiveContract.requirements
    .filter((requirement) => requirement.semantics === 'overlap' && requirement.subject?.kind === 'carried-item')
    .map((requirement) => ({
      kind: 'carried-item',
      itemId: requirement.subject.itemId,
      position: { ...actor.position },
    })),
  ];
  const interactions = [];
  const casts = [];
  for (const requirement of session.objectiveContract.requirements) {
    const anchor = (requirement.anchorIds ?? [])
      .map((anchorId) => session.stage.objectiveAnchors.find(({ id }) => id === anchorId))
      .find((candidate) => candidate && actorOverlapsAnchor(actor, candidate));
    if (!anchor) continue;
    if (requirement.semantics === 'interact' && input.interactPressed) {
      interactions.push({
        actionId: requirement.actionId,
        anchorId: anchor.id,
        actorId: actor.id,
        ...(requirement.payload ? { payload: requirement.payload } : {}),
      });
    }
    if (requirement.semantics === 'cast-count' && input.interactHeld) {
      casts.push({ castId: requirement.castId, anchorId: anchor.id, actorId: actor.id, state: 'active' });
    }
  }
  return { subjects, interactions, casts };
}

function combatSatisfied(session, snapshot) {
  const type = session.objectiveContract.objectiveType;
  if (type === 'defeatAll') return living(snapshot, 'enemy').length === 0;
  if (BOSS_COMBAT_TYPES.has(type)) {
    const boss = bossActor(session, snapshot);
    return !boss || boss.hp <= 0;
  }
  if (session.encounter.objective?.bossId) {
    const boss = bossActor(session, snapshot);
    if (session.encounter.objective.bossResolution === 'force-retreat') {
      const phases = session.encounter.bossMechanic?.phases ?? [];
      const retreatRatio = [...phases].reverse()
        .find(({ enter }) => enter?.kind === 'boss-hp-ratio-at-or-below')
        ?.enter.value;
      return !boss || boss.hp <= 0 || (
        Number.isFinite(retreatRatio)
        && boss.maxHp > 0
        && boss.hp / boss.maxHp <= retreatRatio
      );
    }
    return !boss || boss.hp <= 0;
  }
  return true;
}

export function parseActionCampaignBattleQuery(search = '', fallbackEncounterId = ENCOUNTERS[0].id) {
  const query = search instanceof URLSearchParams ? search : new URLSearchParams(String(search));
  const requestedEncounterId = query.get('encounter');
  const encounterId = getEncounter(requestedEncounterId)?.id ?? getEncounter(fallbackEncounterId)?.id ?? ENCOUNTERS[0].id;
  const requestedReturn = query.get('return');
  return deepFreeze({
    requestedEncounterId,
    encounterId,
    canonical: query.get('mode') === 'campaign' || query.get('canonical') === '1',
    returnTarget: requestedReturn && SAFE_RETURN_TARGET.test(requestedReturn) ? requestedReturn : 'campaign.html',
    handoff: {
      questId: query.get('quest'),
      questObjectiveId: query.get('objective'),
      fieldTriggerId: query.get('fieldTrigger'),
      chronicleId: query.get('chronicle'),
      chronicleStageId: query.get('chronicleStage'),
      chronicleChoiceId: query.get('chronicleChoice'),
    },
  });
}

export function getCanonicalActionFighterIds(encounterId) {
  const encounter = getEncounter(encounterId);
  if (!encounter) throw new RangeError(`Unknown encounter ID: ${encounterId}.`);
  const roster = encounter.party?.roster ?? [];
  if (roster.includes('lise') && roster.includes('mateus')) return deepFreeze(['lise', 'mateus']);
  if (roster.includes('lise') && roster.includes('ren')) return deepFreeze(['lise', 'ren']);
  if (roster.includes('ren') && roster.includes('aya')) return deepFreeze(['ren']);
  if (roster.includes('ren')) return deepFreeze(['ren']);
  if (roster.includes('lise')) return deepFreeze(['lise', 'mateus']);
  if (roster.includes('mateus')) return deepFreeze(['mateus', 'lise']);
  if (roster.includes('miyo')) return deepFreeze(['miyo', 'lise']);
  return deepFreeze(['lise', 'mateus']);
}

export function createActionCampaignBattleSession({
  encounterId,
  advancementState,
  loadoutState,
  partyVitals = null,
  supportActorId = null,
  fighterActorIds = null,
  objectiveRuntimeFactory = createActionObjectiveRuntime,
} = {}) {
  const encounter = getEncounter(encounterId);
  if (!encounter) throw new RangeError(`Unknown encounter ID: ${encounterId}.`);
  const stage = getActionStage(encounter.levelId);
  const objectiveContract = adaptActionObjective(encounter, { stage });
  const sourceSpec = adaptActionEncounter(encounter.id, {
    advancementState,
    partyVitals: partyVitals ?? loadoutState?.vitals,
    supportActorId,
    fighterActorIds,
  });
  let actors = applySpawnSlots(sourceSpec.kernelConfig.actors, stage);
  let attacks = clone(sourceSpec.kernelConfig.attacks);
  ({ actors, attacks } = applyLoadout(actors, attacks, sourceSpec.attackManifest, loadoutState));
  actors = applyPartyVitals(actors, partyVitals);
  for (const subweaponId of ACTION_SUBWEAPON_IDS) {
    const subweapon = ACTION_SUBWEAPONS[subweaponId];
    attacks[subweapon.attackId] = clone(subweapon.attack);
  }
  actors = actors.map((actor) => actor.faction === 'player'
    ? {
        ...actor,
        attackIds: [
          ...actor.attackIds,
          ...ACTION_SUBWEAPON_IDS.map((id) => ACTION_SUBWEAPONS[id].attackId),
        ],
    }
    : actor);
  const {
    kernelConfig: sourceKernelConfig,
    ...sourceSpecMetadata
  } = sourceSpec;
  const {
    statusHooks,
    ...cloneableKernelConfig
  } = sourceKernelConfig;
  const spec = deepFreeze({
    ...clone(sourceSpecMetadata),
    kernelConfig: {
      ...clone(cloneableKernelConfig),
      stage: toActionKernelStage(stage),
      attacks,
      actors,
      statusHooks,
      physicsHooks: createActionStagePhysicsHooks(encounter.levelId),
      automaticVictory: false,
      controlledActorId: actors.find(({ faction }) => faction === 'player')?.id,
    },
  });
  const actorTemplates = actorTemplateMap(spec);
  const kernel = new ActionCombatKernel(spec.kernelConfig);
  const session = {
    schemaVersion: ACTION_CAMPAIGN_BATTLE_SCHEMA_VERSION,
    encounter,
    stage,
    objectiveContract,
    spec,
    actorTemplates,
    kernel,
    bossPhaseDirector: createBossPhaseDirector(encounter, spec, kernel, actorTemplates),
    objectiveRuntime: null,
    objectiveEntities: null,
    outcome: null,
    recentEvents: [],
    subweaponStock: createActionSubweaponStock(),
  };
  session.objectiveEntities = createObjectiveEntityDirector(encounter, stage, objectiveContract);
  session.objectiveRuntime = createObjectiveBridge(session, objectiveRuntimeFactory);
  return session;
}

export function switchActionCampaignActor(session, direction = 1) {
  const snapshot = session.kernel.snapshot();
  const available = snapshot.actors.filter(({ faction, hp }) => faction === 'player' && hp > 0).map(({ id }) => id);
  if (!available.length) return { ok: false, reason: 'party-defeated' };
  const currentIndex = Math.max(0, available.indexOf(snapshot.controlledActorId));
  const nextId = available[(currentIndex + (direction < 0 ? -1 : 1) + available.length) % available.length];
  return session.kernel.switchControlledActor(nextId);
}

export function getActionCampaignAttackChoices(session, actorId = session.kernel.snapshot().controlledActorId) {
  const actor = session.kernel.getActor(actorId);
  if (!actor) return Object.freeze([]);
  return Object.freeze(actor.attackIds.filter((attackId) => (
    session.spec.kernelConfig.attacks[attackId]?.kind !== 'subweapon'
  )).map((attackId) => {
    const source = session.spec.kernelConfig.attacks[attackId];
    return deepFreeze({
      id: attackId,
      name: source.name,
      delivery: source.delivery,
      essence: source.essence,
      state: session.kernel.getAttackState(actorId, attackId),
    });
  }));
}

/** UI-ready, session-local holy subweapon stock and readiness. */
export function getActionCampaignSubweaponChoices(
  session,
  actorId = session.kernel.snapshot().controlledActorId,
) {
  if (!actorId) return Object.freeze([]);
  const actor = session.kernel.getActor(actorId);
  return Object.freeze(ACTION_SUBWEAPON_IDS.map((id) => {
    const subweapon = getActionSubweapon(id);
    const attackState = session.kernel.getAttackState(actorId, subweapon.attackId);
    const stock = session.subweaponStock[id] ?? 0;
    const requiresGround = id === 'holy-water' && !actor?.grounded;
    return deepFreeze({
      id,
      attackId: subweapon.attackId,
      name: subweapon.name,
      input: subweapon.input,
      description: subweapon.description,
      stock,
      state: {
        ...attackState,
        ready: stock > 0 && !requiresGround && attackState.ready,
        reason: stock <= 0 ? 'out-of-stock' : requiresGround ? 'requires-ground' : attackState.reason,
      },
    });
  }));
}

/** UI-ready movement verbs and their live deterministic readiness. */
export function getActionCampaignManeuverChoices(session, actorId = session.kernel.snapshot().controlledActorId) {
  const actor = session.kernel.getActor(actorId);
  if (!actor) return Object.freeze([]);
  return Object.freeze(ACTION_MANEUVER_IDS.map((maneuverId) => session.kernel.getManeuverDefinition(actorId, maneuverId))
    .filter(Boolean)
    .map((maneuver) => deepFreeze({
    id: maneuver.id,
    name: maneuver.name,
    state: session.kernel.getManeuverState(actorId, maneuver.id),
    })));
}

/** UI-ready Hunter–Priest availability derived only from the shared contract. */
export function getActionCampaignComboState(session, initiatorActorId = session.kernel.snapshot().controlledActorId) {
  const kernelSnapshot = session.kernel.snapshot();
  const availability = getHunterPriestComboAvailability({
    kernelSnapshot,
    initiatorActorId,
    getAttackState: (actorId, attackId) => session.kernel.getAttackState(actorId, attackId),
  });
  const participants = availability.participants.map((participant) => ({
    ...participant,
    attackName: session.spec.kernelConfig.attacks[participant.attackId]?.name ?? readableId(participant.sourceSkillId),
  }));
  const active = kernelSnapshot.actors.some((actor) => (
    actor.activeAttack?.comboId === HUNTER_PRIEST_COMBO_CONTRACT.id
  ));
  return deepFreeze({
    ...availability,
    active,
    status: active ? 'active' : availability.available ? 'ready' : 'locked',
    participants,
  });
}

export function advanceActionCampaignBattle(session, elapsedMs, input = {}) {
  if (session.outcome) return snapshotActionCampaignBattle(session);
  const controlledActorId = session.kernel.snapshot().controlledActorId;
  const controllerEvents = [];
  if (controlledActorId) {
    const jumpHeld = input.jumpHeld ?? Boolean(input.jumpPressed);
    session.kernel.setMovement(controlledActorId, {
      x: Number(Boolean(input.right)) - Number(Boolean(input.left)),
      y: 0,
    });
    session.kernel.setJumpHeld(controlledActorId, jumpHeld);
    if (input.jumpPressed) session.kernel.requestJump(controlledActorId, { buffer: true, held: jumpHeld });
    if (typeof input.maneuverPressed === 'string') {
      const started = session.kernel.requestManeuver(controlledActorId, input.maneuverPressed);
      if (!started.ok) {
        controllerEvents.push({
          type: 'maneuver-blocked',
          actorId: controlledActorId,
          maneuverId: input.maneuverPressed,
          reason: started.reason,
          remainingMs: started.remainingMs ?? 0,
        });
      }
    }
    if (Number.isSafeInteger(input.attackIndex)) {
      const attackId = getActionCampaignAttackChoices(session, controlledActorId)[input.attackIndex]?.id;
      if (attackId) session.kernel.requestAttack(controlledActorId, attackId);
    }
    if (typeof input.subweaponPressed === 'string') {
      const choice = getActionCampaignSubweaponChoices(session, controlledActorId)
        .find(({ id }) => id === input.subweaponPressed);
      if (!choice?.state.ready) {
        controllerEvents.push({
          type: 'subweapon-blocked',
          actorId: controlledActorId,
          subweaponId: input.subweaponPressed,
          name: choice?.name ?? input.subweaponPressed,
          reason: choice?.state.reason ?? 'unknown-subweapon',
          remainingMs: choice?.state.effectiveCooldownRemainingMs ?? 0,
        });
      } else {
        const started = session.kernel.requestAttack(controlledActorId, choice.attackId);
        if (started.ok) {
          session.subweaponStock[choice.id] -= 1;
          controllerEvents.push({
            type: 'subweapon-used',
            actorId: controlledActorId,
            subweaponId: choice.id,
            attackId: choice.attackId,
            name: choice.name,
            stockRemaining: session.subweaponStock[choice.id],
          });
        } else {
          controllerEvents.push({
            type: 'subweapon-blocked',
            actorId: controlledActorId,
            subweaponId: choice.id,
            name: choice.name,
            reason: started.reason,
            remainingMs: started.remainingMs ?? 0,
          });
        }
      }
    }
  }
  if (input.comboPressed) {
    const combo = getActionCampaignComboState(session, controlledActorId);
    if (combo.available) {
      const started = session.kernel.requestCombo(
        HUNTER_PRIEST_COMBO_CONTRACT.id,
        controlledActorId,
        combo.attackRequests.map(({ actorId, attackId }) => ({ actorId, attackId })),
      );
      if (!started.ok) {
        controllerEvents.push({
          type: 'combo-blocked',
          comboId: combo.comboId,
          name: combo.name,
          reasons: [{ code: started.reason, ...started }],
        });
      }
    } else {
      controllerEvents.push({
        type: 'combo-blocked',
        comboId: combo.comboId,
        name: combo.name,
        reasons: combo.reasons,
      });
    }
  }
  const elapsed = Math.max(0, Math.min(100, Math.round(Number(elapsedMs) || 0)));
  session.kernel.advance(elapsed);
  const kernelEvents = session.kernel.drainEvents();
  const bossPhaseEvents = updateBossPhaseDirector(session, kernelEvents);
  const kernelSnapshot = session.kernel.snapshot();
  moveObjectiveTokens(session, elapsed, kernelSnapshot, input);
  const entityEvents = entityEventsFromCombat(session, kernelEvents);
  let events = [...controllerEvents, ...kernelEvents, ...bossPhaseEvents, ...entityEvents];
  const signals = objectiveSignals(session, kernelSnapshot, input);
  session.objectiveRuntime?.advance?.({
    kernelSnapshot,
    events,
    ...signals,
  });
  syncObjectiveEntityDependencies(session);
  const objectiveBossPhaseEvents = updateBossPhaseDirector(
    session,
    [],
    objectiveSnapshot(session, kernelSnapshot),
  );
  if (objectiveBossPhaseEvents.length) events = [...events, ...objectiveBossPhaseEvents];
  const checkpointEvents = intactCheckpointEvents(session);
  if (checkpointEvents.length) {
    session.objectiveRuntime?.advance?.({
      kernelSnapshot,
      events: checkpointEvents,
      ...objectiveSignals(session, kernelSnapshot, input),
    });
  }
  session.recentEvents = [...events, ...checkpointEvents];
  const objective = objectiveSnapshot(session, session.kernel.snapshot());
  const currentSnapshot = session.kernel.snapshot();
  if (objective.failed || living(currentSnapshot, 'player').length === 0) {
    session.outcome = 'defeat';
    session.kernel.conclude?.('defeat');
  } else if (objective.supported && objective.complete && combatSatisfied(session, currentSnapshot)) {
    session.outcome = 'victory';
    session.kernel.conclude?.('victory');
  }
  return snapshotActionCampaignBattle(session);
}

export function snapshotActionCampaignBattle(session) {
  const kernelSnapshot = session.kernel.snapshot();
  const livingParty = kernelSnapshot.actors.filter(({ faction, hp }) => faction === 'player' && hp > 0);
  const aiControlledActorIds = livingParty
    .filter(({ id }) => id !== kernelSnapshot.controlledActorId)
    .map(({ id }) => id);
  return deepFreeze({
    schemaVersion: ACTION_CAMPAIGN_BATTLE_SCHEMA_VERSION,
    encounterId: session.encounter.id,
    outcome: session.outcome,
    kernel: kernelSnapshot,
    duo: {
      enabled: livingParty.length >= 2,
      directActorId: kernelSnapshot.controlledActorId,
      supportActorId: aiControlledActorIds[0] ?? null,
      aiControlledActorIds,
    },
    objective: objectiveSnapshot(session, kernelSnapshot),
    bossPhase: bossPhaseSnapshot(session, kernelSnapshot),
    combo: getActionCampaignComboState(session, kernelSnapshot.controlledActorId),
    subweapons: getActionCampaignSubweaponChoices(session, kernelSnapshot.controlledActorId),
    combatSatisfied: combatSatisfied(session, kernelSnapshot),
    recentEvents: clone(session.recentEvents),
  });
}

export function createActionCampaignBattleResult(session, itemDebits = {}) {
  const snapshot = snapshotActionCampaignBattle(session);
  if (snapshot.outcome !== 'victory' || !snapshot.objective.supported || !snapshot.objective.complete
      || !snapshot.combatSatisfied) {
    throw new TypeError('Action campaign victory requires objective completion and its authored combat condition.');
  }
  const canonicalDebits = Object.fromEntries(BATTLE_ITEM_IDS.map((itemId) => [itemId, itemDebits[itemId] ?? 0]));
  const projected = projectActionTerminalResult(session.spec, {
    ...snapshot.kernel,
    outcome: 'victory',
  }, { itemDebits: canonicalDebits });
  return createBattleResultRecord(projected);
}
