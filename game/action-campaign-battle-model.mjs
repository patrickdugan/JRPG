/**
 * DOM-free composition root for the non-canonical campaign action battle.
 *
 * The model deliberately keeps the authored-objective runtime injectable. The
 * fallback below authorizes only objectives that the current combat snapshot
 * can prove without tokens, destructible scenery, casts, or interactions.
 */

import { ActionCombatKernel } from './action-combat.mjs';
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
  createActionStagePhysicsHooks,
  getActionStage,
  toActionKernelStage,
} from './action-stages.mjs';
import { createBattleResultRecord } from './battle-result-contract.mjs';
import { settleBattleVictory } from './battle-settlement.mjs';
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
  'clearRoute',
  'releaseTarget',
  'returnItemToTile',
  'activateRelays',
  'defeatBossAndRelease',
  'breakObjects',
  'defeatBossAndEvacuate',
  'completeInteractions',
]);
const BOSS_COMBAT_TYPES = new Set([
  'defeatBoss',
  'defeatBossWithProtection',
  'defeatBossAndRelease',
  'defeatBossAndEvacuate',
]);

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
  for (const profile of [...spec.profiles.party, ...spec.profiles.enemies]) {
    for (const actorId of profile.instanceIds) result[actorId] = profile.templateId;
  }
  return result;
}

function applySpawnSlots(actors, stage) {
  const party = actors.filter(({ faction }) => faction === 'player');
  const enemies = actors.filter(({ faction }) => faction === 'enemy');
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
    })),
    failures: snapshot.failures,
    runtime: snapshot,
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
  const subjects = session.objectiveContract.requirements
    .filter((requirement) => requirement.semantics === 'overlap' && requirement.subject?.kind === 'carried-item')
    .map((requirement) => ({
      kind: 'carried-item',
      itemId: requirement.subject.itemId,
      position: { ...actor.position },
    }));
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

export function createActionCampaignBattleSession({
  encounterId,
  advancementState,
  loadoutState,
  objectiveRuntimeFactory = createActionObjectiveRuntime,
} = {}) {
  const encounter = getEncounter(encounterId);
  if (!encounter) throw new RangeError(`Unknown encounter ID: ${encounterId}.`);
  const stage = getActionStage(encounter.levelId);
  const objectiveContract = adaptActionObjective(encounter, { stage });
  const sourceSpec = adaptActionEncounter(encounter.id, {
    advancementState,
    partyVitals: loadoutState?.vitals,
  });
  let actors = applySpawnSlots(sourceSpec.kernelConfig.actors, stage);
  let attacks = clone(sourceSpec.kernelConfig.attacks);
  ({ actors, attacks } = applyLoadout(actors, attacks, sourceSpec.attackManifest, loadoutState));
  const spec = deepFreeze({
    ...clone(sourceSpec),
    kernelConfig: {
      ...clone(sourceSpec.kernelConfig),
      stage: toActionKernelStage(stage),
      attacks,
      actors,
      physicsHooks: createActionStagePhysicsHooks(encounter.levelId),
      automaticVictory: false,
      controlledActorId: actors.find(({ faction }) => faction === 'player')?.id,
    },
  });
  const session = {
    schemaVersion: ACTION_CAMPAIGN_BATTLE_SCHEMA_VERSION,
    encounter,
    stage,
    objectiveContract,
    spec,
    actorTemplates: actorTemplateMap(spec),
    kernel: new ActionCombatKernel(spec.kernelConfig),
    objectiveRuntime: null,
    outcome: null,
    recentEvents: [],
  };
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
  return Object.freeze(actor.attackIds.map((attackId) => {
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
  if (controlledActorId) {
    session.kernel.setMovement(controlledActorId, {
      x: Number(Boolean(input.right)) - Number(Boolean(input.left)),
      y: 0,
    });
    if (input.jumpPressed) session.kernel.requestJump(controlledActorId);
    if (Number.isSafeInteger(input.attackIndex)) {
      const attackId = session.kernel.getActor(controlledActorId)?.attackIds[input.attackIndex];
      if (attackId) session.kernel.requestAttack(controlledActorId, attackId);
    }
  }
  const controllerEvents = [];
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
  session.kernel.advance(Math.max(0, Math.min(100, Math.round(Number(elapsedMs) || 0))));
  const events = [...controllerEvents, ...session.kernel.drainEvents()];
  const kernelSnapshot = session.kernel.snapshot();
  session.recentEvents = events;
  const signals = objectiveSignals(session, kernelSnapshot, input);
  session.objectiveRuntime?.advance?.({
    kernelSnapshot,
    events,
    ...signals,
  });
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
  return deepFreeze({
    schemaVersion: ACTION_CAMPAIGN_BATTLE_SCHEMA_VERSION,
    encounterId: session.encounter.id,
    outcome: session.outcome,
    kernel: kernelSnapshot,
    objective: objectiveSnapshot(session, kernelSnapshot),
    combo: getActionCampaignComboState(session, kernelSnapshot.controlledActorId),
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

export function settleActionCampaignBattleVictory({ session, itemDebits, ...settlement } = {}) {
  return settleBattleVictory({
    ...settlement,
    encounter: session.encounter,
    resultRecord: createActionCampaignBattleResult(session, itemDebits),
  });
}
