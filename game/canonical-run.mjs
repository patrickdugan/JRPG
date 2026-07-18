/**
 * Bounded, DOM-free canonical completion audit.
 *
 * This is an executable integration harness, not a playtime simulator. It
 * starts every authority from its pristine constructor, uses public runtime
 * transitions for story, field, combat, rewards, vitals, and run evidence,
 * and deliberately records zero playtime.
 */

import {
  createAdvancementState,
  getEncounterRewardPreview,
  getEncounterWinCount,
  getParty,
  getPartyMember,
  preparePartyForEncounter,
  recordEncounterWin,
} from './advancement.mjs';
import { solveCampaignCombat } from './battle-solver.mjs';
import {
  PARTY_PROFILES,
  CampaignCombatEngine,
} from './campaign-combat.mjs';
import { CAMPAIGN } from './content/campaign.mjs';
import { getFullDialogue } from './content/full-dialogue.mjs';
import { getSceneOperation } from './content/scene-operations.mjs';
import { ENCOUNTERS, getEncounter } from './content/encounters.mjs';
import {
  LEVELS,
  getLevel,
  isBlocked,
  isInBounds,
  parseTileKey,
  tileKey,
} from './content/levels.mjs';
import {
  createFieldState,
  enterField,
  getCurrentFieldContext,
  getFieldObjectiveProgress,
  grantFieldFlags,
  interactField,
  moveFieldBy,
  resolveFieldEncounter,
  useFieldExit,
} from './field-runtime.mjs';
import {
  applyLoadoutToPartyProfile,
  createLoadoutState,
  grantInventory,
  restAtCamp,
  setMemberVitals,
  syncPartyVitals,
} from './loadout.mjs';
import {
  advanceNarrative,
  createNarrativeState,
  getNarrativeProgress,
} from './narrative-runtime.mjs';
import {
  appendChoice,
  completeCurrentBeat,
  createCampaignState,
  getCurrentBeat,
  isCampaignComplete,
  selectChoice,
} from './progression.mjs';
import {
  createRunReceipt,
  getRunProofReport,
  recordRunBeatCompletion,
  recordRunFirstClear,
} from './run-receipt.mjs';
import {
  advanceSceneOperation,
  createSceneOperationState,
  getSceneOperationRuntimeMetrics,
} from './scene-operation-runtime.mjs';

export const CANONICAL_RUN_VERSION = 2;
export const DEFAULT_CANONICAL_RUN_ID = 'canonical-run-audit-0001';

const BEAT_RECORDS = Object.freeze(CAMPAIGN.chapters.flatMap((chapter) =>
  chapter.beats.map((beat) => Object.freeze({ chapter, beat }))));
const ENCOUNTER_IDS = Object.freeze(ENCOUNTERS.map(({ id }) => id));
const LEVEL_IDS = new Set(LEVELS.map(({ id }) => id));
const MULTI_SELECT_BEAT_IDS = new Set(['c9-03-conservatory-offers']);
const DIRECTIONS = Object.freeze([
  Object.freeze({ dx: -1, dy: 0 }),
  Object.freeze({ dx: -1, dy: -1 }),
  Object.freeze({ dx: 0, dy: -1 }),
  Object.freeze({ dx: 1, dy: -1 }),
  Object.freeze({ dx: 1, dy: 0 }),
  Object.freeze({ dx: 1, dy: 1 }),
  Object.freeze({ dx: 0, dy: 1 }),
  Object.freeze({ dx: -1, dy: 1 }),
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function detailFor(result) {
  if (result?.reason) return result.reason;
  if (result?.code) return result.code;
  if (result?.errors?.length) return result.errors.join(' ');
  return 'unknown transition failure';
}

function requireOk(result, label) {
  if (!result?.ok) throw new Error(`${label}: ${detailFor(result)}`);
  return result;
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function traceSignature(trace) {
  return `fnv1a32:${fnv1a32(JSON.stringify(trace))}`;
}

function positionKey(position) {
  return tileKey(position.x, position.y);
}

function chebyshev(left, right) {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
}

function canTakeFieldStep(level, from, direction) {
  const target = { x: from.x + direction.dx, y: from.y + direction.dy };
  if (!isInBounds(level, target.x, target.y) || isBlocked(level, target.x, target.y)) return false;
  if (direction.dx !== 0 && direction.dy !== 0) {
    if (isBlocked(level, from.x + direction.dx, from.y)
      || isBlocked(level, from.x, from.y + direction.dy)) return false;
  }
  return true;
}

function shortestFieldPath(level, start, goal) {
  if (goal(start)) return [];
  const queue = [{ position: start, path: [] }];
  const visited = new Set([positionKey(start)]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const direction of DIRECTIONS) {
      if (!canTakeFieldStep(level, current.position, direction)) continue;
      const position = {
        x: current.position.x + direction.dx,
        y: current.position.y + direction.dy,
      };
      const key = positionKey(position);
      if (visited.has(key)) continue;
      const path = [...current.path, direction];
      if (goal(position)) return path;
      visited.add(key);
      queue.push({ position, path });
    }
  }
  return null;
}

function shortestLevelPath(startLevelId, targetLevelId) {
  if (startLevelId === targetLevelId) return [];
  const queue = [{ levelId: startLevelId, path: [] }];
  const visited = new Set([startLevelId]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const exit of getLevel(current.levelId)?.exits ?? []) {
      const edge = Object.freeze({ fromLevelId: current.levelId, exit });
      const path = [...current.path, edge];
      if (exit.destinationLevelId === targetLevelId) return Object.freeze(path);
      if (!LEVEL_IDS.has(exit.destinationLevelId) || visited.has(exit.destinationLevelId)) continue;
      visited.add(exit.destinationLevelId);
      queue.push({ levelId: exit.destinationLevelId, path });
    }
  }
  return null;
}

function canonicalProfiles(encounter, advancementState, loadoutState) {
  return Object.fromEntries(encounter.party.roster.map((memberId) => {
    const member = getPartyMember(advancementState, memberId);
    const adapted = applyLoadoutToPartyProfile({
      ...PARTY_PROFILES[memberId],
      stats: {
        hp: member.stats.hp,
        power: Math.max(member.stats.power, member.stats.arcana),
        guard: member.stats.guard,
        speed: member.stats.speed,
      },
    }, loadoutState, memberId);
    return [memberId, { ...adapted, currentHp: loadoutState.vitals[memberId].hp }];
  }));
}

function validateBounds(options) {
  const bounds = {
    maxFieldSteps: options.maxFieldSteps ?? 20_000,
    maxTraceEvents: options.maxTraceEvents ?? 100_000,
    maxPlayerCommandsPerBattle: options.maxPlayerCommandsPerBattle ?? 2_000,
    maxEnemyActivationsPerBattle: options.maxEnemyActivationsPerBattle ?? 5_000,
  };
  for (const [name, value] of Object.entries(bounds)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a positive safe integer.`);
  }
  return Object.freeze(bounds);
}

/**
 * Execute the canonical campaign once. No playtime transition is called, so
 * this can prove reachability and deterministic settlement but never length.
 */
export function runCanonicalCompletion(options = {}) {
  const bounds = validateBounds(options);
  const runId = options.runId ?? DEFAULT_CANONICAL_RUN_ID;
  let campaignState = createCampaignState();
  let advancementState = createAdvancementState();
  let loadoutState = createLoadoutState();
  let narrativeState = createNarrativeState();
  let sceneOperationState = createSceneOperationState();
  const firstBeat = BEAT_RECORDS[0]?.beat;
  if (!firstBeat || !getLevel(firstBeat.mapId)) throw new Error('Canonical campaign has no valid opening field level.');
  let fieldState = createFieldState({ levelId: firstBeat.mapId, beatId: firstBeat.id });
  let receiptState = requireOk(createRunReceipt({ runId, campaignState, advancementState }), 'create run receipt').state;

  const trace = [];
  let currentBeatRecord = BEAT_RECORDS[0];
  let fieldSteps = 0;
  let routeCount = 0;
  let requiredRouteCount = 0;
  let narrativeTransitionCount = 0;
  let interactionCount = 0;
  let sceneOperationNodeCount = 0;
  let exitCount = 0;
  let battleCount = 0;
  let restCount = 0;
  let choiceCount = 0;
  let dialogueLineCount = 0;
  let playerCommands = 0;
  let enemyActivations = 0;
  const routeGaps = [];
  const finalObjectiveGaps = [];

  const emit = (event) => {
    if (trace.length >= bounds.maxTraceEvents) throw new Error(`Canonical trace exceeded ${bounds.maxTraceEvents} events.`);
    trace.push(deepFreeze({ ...event }));
  };

  const externalFieldFlags = () => {
    const wonEncounters = ENCOUNTERS.filter(({ id }) => getEncounterWinCount(advancementState, id) > 0);
    return [
      ...Object.keys(campaignState.flags ?? {}),
      ...(advancementState.inventory?.keyItems ?? []),
      ...wonEncounters.flatMap((encounter) => [
        encounter.id,
        `${encounter.id}-cleared`,
        ...(encounter.reward?.flags ?? []),
        ...(encounter.reward?.keyItems ?? []),
      ]),
    ];
  };

  const applyFieldHazard = (event) => {
    const leaderId = currentBeatRecord.chapter.party?.[0] ?? 'ren';
    const vitals = loadoutState.vitals[leaderId];
    if (!vitals) return;
    const effect = event.effect ?? {};
    const patch = {};
    if (['fieldDamage', 'damage', 'physicalDamage'].includes(effect.type)) {
      const percent = effect.percentMaxHp ?? 10;
      const minimum = effect.minimumHp ?? 1;
      patch.hp = Math.max(minimum, vitals.hp - Math.ceil(vitals.maxHp * (percent / 100)));
    }
    if (effect.status) patch.statuses = [...new Set([...vitals.statuses, effect.status])];
    if (!Object.keys(patch).length) return;
    const result = requireOk(setMemberVitals(loadoutState, leaderId, patch), `apply field hazard ${event.hazardId}`);
    loadoutState = result.state;
    emit({ type: 'field-hazard', beatId: currentBeatRecord.beat.id, hazardId: event.hazardId, leaderId, patch });
  };

  const executeBattle = (encounterId, source) => {
    if (getEncounterWinCount(advancementState, encounterId) > 0) return false;
    const encounter = getEncounter(encounterId);
    if (!encounter) throw new Error(`Unknown canonical encounter ${encounterId}.`);

    advancementState = preparePartyForEncounter(advancementState, encounterId, { partyIds: encounter.party.roster });
    const synced = requireOk(syncPartyVitals(loadoutState, getParty(advancementState)), `sync ${encounterId} vitals`);
    loadoutState = synced.state;
    const engine = new CampaignCombatEngine({
      encounterId,
      partyProfiles: canonicalProfiles(encounter, advancementState, loadoutState),
    });
    const solution = solveCampaignCombat(engine, {
      maxPlayerCommands: bounds.maxPlayerCommandsPerBattle,
      maxEnemyActivations: bounds.maxEnemyActivationsPerBattle,
    });
    if (!solution.solved) {
      throw new Error(`Deterministic solver failed ${encounterId}: ${solution.reason}; commands=${solution.playerCommands}; enemies=${solution.enemyActivations}.`);
    }

    const priorWins = getEncounterWinCount(advancementState, encounterId);
    if (priorWins !== 0) throw new Error(`${encounterId} was not a first clear at settlement.`);
    const reward = getEncounterRewardPreview(encounterId, priorWins);
    const receiptResult = requireOk(
      recordRunFirstClear(receiptState, receiptState.runId, encounterId),
      `record ${encounterId} first clear`,
    );
    receiptState = receiptResult.state;
    advancementState = recordEncounterWin(advancementState, encounterId, { partyIds: encounter.party.roster });
    const granted = requireOk(
      grantInventory(loadoutState, { currency: reward.currency, items: reward.items }),
      `grant ${encounterId} loadout reward`,
    );
    if (granted.receipt.unknown.length) {
      throw new Error(`${encounterId} has uncatalogued loadout rewards: ${granted.receipt.unknown.join(', ')}.`);
    }
    loadoutState = granted.state;

    const survivorHp = {};
    for (const actor of solution.snapshot.actors.filter(({ faction }) => faction === 'party')) {
      survivorHp[actor.templateId] = Math.max(1, actor.hp);
      const vitals = requireOk(
        setMemberVitals(loadoutState, actor.templateId, { hp: survivorHp[actor.templateId] }),
        `settle ${encounterId} ${actor.templateId} HP`,
      );
      loadoutState = vitals.state;
    }

    const restingPartyIds = getParty(advancementState, { unlockedOnly: true }).map(({ id }) => id);
    const rest = restAtCamp(loadoutState, 'lantern-safehouse', restingPartyIds);
    let restReceipt = null;
    if (rest.ok) {
      loadoutState = rest.state;
      restReceipt = rest.receipt;
      restCount += 1;
    } else if (rest.reason !== 'The selected party members are already rested for this camp.') {
      throw new Error(`Post-${encounterId} camp settlement failed: ${rest.reason}`);
    }

    battleCount += 1;
    playerCommands += solution.playerCommands;
    enemyActivations += solution.enemyActivations;
    emit({
      type: 'battle-first-clear',
      beatId: currentBeatRecord.beat.id,
      encounterId,
      source,
      playerCommands: solution.playerCommands,
      enemyActivations: solution.enemyActivations,
      combatTraceSignature: traceSignature(solution.trace),
      combatTrace: solution.trace,
      survivorHp,
      reward: {
        xpPerMember: reward.xpPerMember,
        currency: reward.currency,
        items: reward.items,
        keyItems: reward.keyItems,
      },
      rest: restReceipt ? { campId: restReceipt.campId, cost: restReceipt.cost } : null,
    });
    return true;
  };

  const processFieldEvents = (events) => {
    for (const event of events) {
      if (event.type === 'hazard-hit') applyFieldHazard(event);
      if (event.type !== 'encounter-triggered') continue;
      const firstClear = executeBattle(event.encounterId, `field-trigger:${event.triggerId}`);
      const resolved = requireOk(
        resolveFieldEncounter(fieldState, event.triggerId),
        `resolve field trigger ${event.triggerId}`,
      );
      fieldState = resolved.state;
      emit({
        type: 'field-encounter-resolved',
        beatId: currentBeatRecord.beat.id,
        levelId: getCurrentFieldContext(fieldState).levelId,
        triggerId: event.triggerId,
        encounterId: event.encounterId,
        firstClear,
      });
    }
  };

  const takeFieldStep = (direction) => {
    const before = getCurrentFieldContext(fieldState);
    const result = moveFieldBy(fieldState, direction.dx, direction.dy, { flags: externalFieldFlags() });
    if (!result.moved) {
      const reason = result.events.find(({ type }) => type === 'movement-blocked')?.reason ?? 'blocked';
      throw new Error(`Illegal canonical field step at ${before.levelId}/${positionKey(before.position)}: ${reason}.`);
    }
    fieldState = result.state;
    fieldSteps += 1;
    if (fieldSteps > bounds.maxFieldSteps) throw new Error(`Canonical field traversal exceeded ${bounds.maxFieldSteps} exact steps.`);
    const after = getCurrentFieldContext(fieldState);
    emit({
      type: 'field-move',
      beatId: currentBeatRecord.beat.id,
      levelId: before.levelId,
      from: positionKey(before.position),
      to: positionKey(after.position),
      dx: direction.dx,
      dy: direction.dy,
    });
    processFieldEvents(result.events);
  };

  const walkUntil = (goal, label) => {
    let localSteps = 0;
    while (!goal(getCurrentFieldContext(fieldState).position)) {
      const context = getCurrentFieldContext(fieldState);
      const level = getLevel(context.levelId);
      const path = shortestFieldPath(level, context.position, goal);
      if (!path?.length) throw new Error(`No legal exact field path to ${label} from ${level.id}/${positionKey(context.position)}.`);
      takeFieldStep(path[0]);
      localSteps += 1;
      if (localSteps > level.width * level.height * 4) throw new Error(`Field walk to ${label} exceeded its local bound.`);
    }
  };

  const completeBeatSceneOperation = (beat) => {
    const operation = getSceneOperation(beat.id);
    if (!operation) throw new Error(`Canonical beat ${beat.id} has no finite scene operation.`);
    if (getCurrentFieldContext(fieldState).levelId !== operation.levelId) {
      throw new Error(`Scene operation ${beat.id} expected ${operation.levelId}.`);
    }
    for (const node of operation.nodes) {
      const at = parseTileKey(node.at);
      walkUntil(
        (position) => position.x === at.x && position.y === at.y,
        `${operation.levelId}/${node.id}`,
      );
      for (const encounterId of node.encounterIds) executeBattle(encounterId, `scene-operation:${node.id}`);
      const encounterWins = Object.fromEntries(ENCOUNTER_IDS.map((encounterId) => [
        encounterId,
        getEncounterWinCount(advancementState, encounterId),
      ]));
      const advanced = requireOk(
        advanceSceneOperation(sceneOperationState, beat.id, node.id, { at: node.at, encounterWins }),
        `record scene operation ${node.id}`,
      );
      sceneOperationState = advanced.state;
      sceneOperationNodeCount += 1;
      interactionCount += 1;
      emit({
        type: 'scene-operation-node',
        beatId: beat.id,
        nodeId: node.id,
        activityType: node.activityType,
        at: node.at,
        encounterIds: node.encounterIds,
        operationComplete: advanced.beatCompleted,
      });
    }
    const progress = getSceneOperationRuntimeMetrics(sceneOperationState);
    emit({
      type: 'scene-operation-complete',
      beatId: beat.id,
      completedOperationCount: progress.completedOperationCount,
      completedNodeCount: progress.completedNodeCount,
    });
  };

  const consumeInteraction = (level, item) => {
    const at = parseTileKey(item.at);
    walkUntil((position) => chebyshev(position, at) <= 1, `${level.id}/${item.id}`);
    const result = interactField(fieldState, item.id, {
      flags: externalFieldFlags(),
      ...(item.options ? { choice: item.options[0] } : {}),
    });
    if (!result.ok) return false;
    fieldState = result.state;
    if (result.repeated) return false;
    const event = result.events[0];
    let loot = null;
    if (event?.reward) {
      const granted = requireOk(
        grantInventory(loadoutState, { items: [{ name: event.reward, quantity: 1 }] }),
        `grant field reward ${event.reward}`,
      );
      loadoutState = granted.state;
      loot = { name: event.reward, catalogued: granted.receipt.unknown.length === 0 };
    }
    interactionCount += 1;
    emit({
      type: 'field-interaction',
      beatId: currentBeatRecord.beat.id,
      levelId: level.id,
      interactionId: item.id,
      selectedOption: event?.selectedOption ?? null,
      producedFlags: result.producedFlags,
      loot,
    });
    return true;
  };

  const triggerRequiredEncounter = (level, encounterId) => {
    const trigger = (level.encounterTriggers ?? []).find((candidate) => candidate.encounterId === encounterId);
    if (!trigger) return false;
    const tiles = trigger.tiles.map(parseTileKey);
    const onTrigger = (position) => tiles.some((tile) => tile.x === position.x && tile.y === position.y);
    const context = getCurrentFieldContext(fieldState);
    if (onTrigger(context.position)
      && !context.pendingEncounterTriggerIds.includes(trigger.id)
      && !context.triggeredEncounterIds.includes(trigger.id)) {
      const escape = DIRECTIONS.find((direction) => {
        if (!canTakeFieldStep(level, context.position, direction)) return false;
        return !onTrigger({ x: context.position.x + direction.dx, y: context.position.y + direction.dy });
      });
      if (!escape) throw new Error(`Placed encounter ${trigger.id} cannot be legally entered from its spawn tile.`);
      takeFieldStep(escape);
    }
    walkUntil(onTrigger, `${level.id}/${trigger.id}`);
    const refreshed = getCurrentFieldContext(fieldState);
    return refreshed.resolvedEncounterIds.includes(encounterId)
      || getEncounterWinCount(advancementState, encounterId) > 0;
  };

  const satisfyExit = (edge) => {
    const level = getLevel(edge.fromLevelId);
    const attemptBound = (level.interactables?.length ?? 0) + (level.encounterTriggers?.length ?? 0) + 8;
    for (let attempt = 0; attempt < attemptBound; attempt += 1) {
      const objective = getFieldObjectiveProgress(fieldState, { flags: externalFieldFlags() });
      const exitView = objective.exits.find(({ id }) => id === edge.exit.id);
      if (!exitView) throw new Error(`Field objective omitted exit ${edge.fromLevelId}/${edge.exit.id}.`);
      if (exitView.ready) break;

      const context = getCurrentFieldContext(fieldState);
      const requiredInteractionIds = exitView.requirements
        .filter(({ type, complete }) => type === 'interaction' && !complete)
        .map(({ id }) => id);
      const candidateIds = [...new Set([
        ...requiredInteractionIds,
        ...(level.interactables ?? []).map(({ id }) => id),
      ])];
      let progressed = false;
      for (const interactionId of candidateIds) {
        if (context.consumedInteractableIds.includes(interactionId)) continue;
        const item = (level.interactables ?? []).find(({ id }) => id === interactionId);
        if (item && consumeInteraction(level, item)) {
          progressed = true;
          break;
        }
      }
      if (progressed) continue;

      const encounterRequirement = exitView.requirements.find(({ type, complete }) => type === 'encounter' && !complete);
      if (encounterRequirement && triggerRequiredEncounter(level, encounterRequirement.id)) continue;
      const missing = exitView.requirements.filter(({ complete }) => !complete).map(({ id }) => id).join(', ');
      throw new Error(`Exit ${edge.fromLevelId}/${edge.exit.id} remains locked by ${missing || edge.exit.condition || 'unknown requirement'}.`);
    }

    const ready = getFieldObjectiveProgress(fieldState, { flags: externalFieldFlags() })
      .exits.find(({ id }) => id === edge.exit.id);
    if (!ready?.ready) throw new Error(`Exit ${edge.fromLevelId}/${edge.exit.id} exceeded its satisfaction bound.`);
    const at = parseTileKey(edge.exit.at);
    walkUntil((position) => position.x === at.x && position.y === at.y, `${edge.fromLevelId}/${edge.exit.id} exit`);
    const used = requireOk(useFieldExit(fieldState, edge.exit.id, {
      flags: externalFieldFlags(),
      enterDestination: true,
      destinationBeatId: currentBeatRecord.beat.id,
    }), `use exit ${edge.fromLevelId}/${edge.exit.id}`);
    fieldState = used.state;
    exitCount += 1;
    emit({
      type: 'field-exit',
      beatId: currentBeatRecord.beat.id,
      exitId: edge.exit.id,
      fromLevelId: edge.fromLevelId,
      destinationLevelId: edge.exit.destinationLevelId,
      condition: edge.exit.condition ?? null,
    });
  };

  const satisfyFinalObjective = () => {
    const level = getLevel(currentBeatRecord.beat.mapId);
    const bound = (level.interactables?.length ?? 0) + 4;
    for (let attempt = 0; attempt < bound; attempt += 1) {
      const objective = getFieldObjectiveProgress(fieldState, { flags: externalFieldFlags() });
      if (objective.completed) return;
      const context = getCurrentFieldContext(fieldState);
      const required = objective.requirements
        .filter(({ type, complete }) => type === 'interaction' && !complete)
        .map(({ id }) => id);
      let progressed = false;
      for (const interactionId of required) {
        if (context.consumedInteractableIds.includes(interactionId)) continue;
        const item = (level.interactables ?? []).find(({ id }) => id === interactionId);
        if (item && consumeInteraction(level, item)) {
          progressed = true;
          break;
        }
      }
      if (!progressed) {
        const missing = objective.requirements.filter(({ complete }) => !complete).map(({ id }) => id).join(', ');
        throw new Error(`Final field objective remains incomplete: ${missing}.`);
      }
    }
    throw new Error('Final field objective exceeded its satisfaction bound.');
  };

  for (let beatIndex = 0; beatIndex < BEAT_RECORDS.length; beatIndex += 1) {
    currentBeatRecord = BEAT_RECORDS[beatIndex];
    const { chapter, beat } = currentBeatRecord;
    if (getCurrentBeat(campaignState).id !== beat.id) {
      throw new Error(`Campaign cursor diverged at beat ${beatIndex}: expected ${beat.id}, found ${getCurrentBeat(campaignState).id}.`);
    }

    fieldState = enterField(fieldState, beat.mapId, beat.id, { flags: externalFieldFlags() });
    const lineCount = getFullDialogue(beat.id)?.length ?? (Array.isArray(beat.text) && beat.text.length ? beat.text.length : 1);
    while (!getNarrativeProgress(narrativeState, beat.id, lineCount).complete) {
      const advanced = requireOk(advanceNarrative(narrativeState, beat.id, lineCount), `advance ${beat.id} narrative`);
      narrativeState = advanced.state;
    }
    dialogueLineCount += lineCount;
    emit({ type: 'dialogue-complete', beatId: beat.id, lineCount });

    const selectedChoices = MULTI_SELECT_BEAT_IDS.has(beat.id)
      ? (beat.choices ?? [])
      : (beat.choices ?? []).slice(0, 1);
    for (const choice of selectedChoices) {
      campaignState = MULTI_SELECT_BEAT_IDS.has(beat.id)
        ? appendChoice(campaignState, choice.id)
        : selectChoice(campaignState, choice.id);
      choiceCount += 1;
      emit({ type: 'story-choice', beatId: beat.id, choiceId: choice.id, flag: choice.flag ?? null });
    }

    completeBeatSceneOperation(beat);

    for (const encounterId of beat.encounterIds ?? []) {
      const firstClear = executeBattle(encounterId, `beat:${beat.id}`);
      if (!firstClear) emit({ type: 'battle-requirement-already-cleared', beatId: beat.id, encounterId });
    }

    const nextRecord = BEAT_RECORDS[beatIndex + 1] ?? null;
    if (nextRecord) {
      const levelPath = shortestLevelPath(beat.mapId, nextRecord.beat.mapId);
      if (levelPath?.length) {
        requiredRouteCount += 1;
        const routeStartStep = fieldSteps;
        try {
          for (const edge of levelPath) satisfyExit(edge);
          fieldState = grantFieldFlags(fieldState, `beat-route-complete-${beat.id}`);
          routeCount += 1;
          emit({
            type: 'field-route-complete',
            beatId: beat.id,
            destinationBeatId: nextRecord.beat.id,
            edgeCount: levelPath.length,
            exactSteps: fieldSteps - routeStartStep,
          });
        } catch (error) {
          const gap = deepFreeze({
            beatId: beat.id,
            destinationBeatId: nextRecord.beat.id,
            fromLevelId: beat.mapId,
            destinationLevelId: nextRecord.beat.mapId,
            edgeIds: levelPath.map(({ fromLevelId, exit }) => `${fromLevelId}/${exit.id}`),
            reason: error instanceof Error ? error.message : String(error),
          });
          routeGaps.push(gap);
          emit({ type: 'field-route-gap', ...gap });
        }
      } else if (beat.mapId !== nextRecord.beat.mapId) {
        narrativeTransitionCount += 1;
        emit({
          type: 'narrative-map-transition',
          beatId: beat.id,
          destinationBeatId: nextRecord.beat.id,
          fromLevelId: beat.mapId,
          destinationLevelId: nextRecord.beat.mapId,
        });
      }
    } else {
      try {
        satisfyFinalObjective();
      } catch (error) {
        const gap = deepFreeze({
          beatId: beat.id,
          levelId: beat.mapId,
          reason: error instanceof Error ? error.message : String(error),
        });
        finalObjectiveGaps.push(gap);
        emit({ type: 'final-field-objective-gap', ...gap });
      }
    }

    const completedBefore = campaignState.completedBeatIds.length;
    campaignState = completeCurrentBeat(campaignState);
    if (campaignState.completedBeatIds.length !== completedBefore + 1) {
      throw new Error(`Beat ${beat.id} did not advance the canonical completion frontier.`);
    }
    const receiptResult = requireOk(
      recordRunBeatCompletion(receiptState, receiptState.runId, beat.id),
      `record ${beat.id} completion`,
    );
    receiptState = receiptResult.state;
    emit({ type: 'beat-complete', beatId: beat.id, beatNumber: beatIndex + 1 });
  }

  if (!isCampaignComplete(campaignState)) throw new Error('Canonical progression did not complete the campaign.');
  for (const encounterId of ENCOUNTER_IDS) {
    if (getEncounterWinCount(advancementState, encounterId) !== 1) {
      throw new Error(`Canonical encounter ${encounterId} does not have exactly one win.`);
    }
  }
  const sceneOperationMetrics = getSceneOperationRuntimeMetrics(sceneOperationState);
  if (!sceneOperationMetrics.campaignComplete) {
    throw new Error(`Canonical scene operations are incomplete: ${sceneOperationMetrics.completedOperationCount}/${sceneOperationMetrics.operationCount}.`);
  }
  const proof = getRunProofReport(receiptState);
  const summary = deepFreeze({
    beatCount: campaignState.completedBeatIds.length,
    firstClearCount: receiptState.firstClearEncounterIds.length,
    routeCount,
    requiredRouteCount,
    narrativeTransitionCount,
    fieldSteps,
    interactionCount,
    sceneOperationCount: sceneOperationMetrics.completedOperationCount,
    sceneOperationNodeCount,
    exitCount,
    battleCount,
    restCount,
    choiceCount,
    dialogueLineCount,
    playerCommands,
    enemyActivations,
    receiptPlaytimeMs: receiptState.playtime.totalMs,
    fieldPlaytimeMs: fieldState.totalPlaytimeMs,
  });
  const frozenTrace = deepFreeze([...trace]);
  return deepFreeze({
    ok: true,
    fullyIntegrated: routeGaps.length === 0 && finalObjectiveGaps.length === 0 && sceneOperationMetrics.campaignComplete,
    version: CANONICAL_RUN_VERSION,
    runId,
    signature: traceSignature(frozenTrace),
    summary,
    proof,
    fieldCoverage: {
      complete: routeGaps.length === 0 && finalObjectiveGaps.length === 0 && sceneOperationMetrics.campaignComplete,
      requiredRouteCount,
      completedRouteCount: routeCount,
      routeGaps,
      finalObjectiveGaps,
      sceneOperations: sceneOperationMetrics,
    },
    trace: frozenTrace,
    states: {
      campaign: campaignState,
      advancement: advancementState,
      loadout: loadoutState,
      field: fieldState,
      narrative: narrativeState,
      sceneOperations: sceneOperationState,
      receipt: receiptState,
    },
  });
}
