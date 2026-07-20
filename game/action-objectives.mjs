/**
 * Deterministic objective adapters for side-view real-time combat.
 *
 * Every canonical objective becomes a composition of four runtime semantics:
 * - event-count: authoritative kernel/domain events,
 * - overlap: a named subject overlapping an authored stage anchor,
 * - interact: one explicit player interaction at an authored anchor,
 * - cast-count: a completed, interruptible objective cast at authored anchors.
 */

import { getActionStage, validateActionStage } from './action-stages.mjs';

export const ACTION_OBJECTIVE_SCHEMA_VERSION = 1;
export const ACTION_OBJECTIVE_SEMANTICS = Object.freeze([
  'event-count',
  'overlap',
  'interact',
  'cast-count',
]);

export const ACTION_OBJECTIVE_TYPES = Object.freeze([
  'surviveThenExit', 'defeatAll', 'defeatBoss', 'thresholdOrObjects',
  'escortTokens', 'defeatBossWithProtection', 'clearRoute', 'releaseTarget',
  'protectObjects', 'disableOrdersAndProtect', 'returnItemToTile',
  'extractAllBeforeCountdown', 'activateRelays', 'defeatBossAndRelease',
  'breakObjects', 'breakPhaseObjects', 'defeatBossAndEvacuate',
  'completeInteractions',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${label} must be a positive integer.`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value) throw new TypeError(`${label} must be a non-empty string.`);
  return value;
}

function requirement(id, semantics, options = {}) {
  return { id, semantics, count: 1, after: [], ...options };
}

function required(id) {
  return { operator: 'requirement', id };
}

function all(requirementIds) {
  return { operator: 'all', clauses: requirementIds.map((id) => required(id)) };
}

function anchorById(stageContract, anchorId) {
  const result = stageContract.objectiveAnchors.find(({ id }) => id === anchorId);
  if (!result) throw new RangeError(`Action stage ${stageContract.id} is missing objective anchor ${anchorId}.`);
  return result;
}

function anchorsByKind(stageContract, kind) {
  return stageContract.objectiveAnchors.filter((entry) => entry.kind === kind);
}

function exactAnchorCount(stageContract, kind, count, label) {
  const anchors = anchorsByKind(stageContract, kind);
  if (anchors.length !== count) {
    throw new RangeError(`${stageContract.id} needs exactly ${count} ${label} anchor(s); found ${anchors.length}.`);
  }
  return anchors;
}

function enemyCount(encounter) {
  return encounter.enemies.reduce((total, enemy) => {
    const count = enemy.count ?? enemy.positions?.length;
    return total + positiveInteger(count, `${encounter.id}.${enemy.id}.count`);
  }, 0);
}

function bossTemplateId(encounter) {
  return requireString(encounter.enemies?.[0]?.id, `${encounter.id} boss template id`);
}

function failureRule(id, eventType, options = {}) {
  return { id, semantics: 'event-count', eventType, count: 1, match: {}, ...options };
}

function partyDefeatedRule() {
  return failureRule('party-defeated', 'faction-defeated', { match: { faction: 'player' } });
}

function adaptFailure(failure, objective, stageContract) {
  switch (failure) {
    case 'none': return [];
    case 'ren-defeated':
      return [failureRule('ren-defeated', 'actor-defeated', { match: { actorId: 'ren' } })];
    case 'all-active-party-defeated':
      return [partyDefeatedRule()];
    case 'both-witnesses-incapacitated':
      return [failureRule('witnesses-incapacitated', 'tagged-actor-incapacitated', { count: 2, match: { tag: 'witness' } })];
    case 'all-active-party-defeated-or-all-witnesses-lost':
      return [
        partyDefeatedRule(),
        failureRule('all-witnesses-lost', 'tagged-actor-incapacitated', {
          count: positiveInteger(objective.protectedTokens?.length, 'protected token count'),
          match: { actorIds: [...objective.protectedTokens] },
        }),
      ];
    case 'courier-defeated-or-two-print-blocks-destroyed':
      return [
        failureRule('courier-defeated', 'objective-object-destroyed', { match: { objectId: 'courier' } }),
        failureRule('two-print-blocks-destroyed', 'objective-object-destroyed', { count: 2, match: { idPrefix: 'print-block-' } }),
      ];
    case 'two-print-blocks-destroyed-or-all-active-party-defeated':
      return [
        failureRule('two-print-blocks-destroyed', 'objective-object-destroyed', { count: 2, match: { idPrefix: 'print-block-' } }),
        partyDefeatedRule(),
      ];
    case 'countdown-complete-or-all-active-party-defeated':
      return [
        failureRule('bell-count-complete', 'boss-cast-completed', {
          count: positiveInteger(objective.maxBossCounts, 'max boss counts'),
          match: { castId: 'bell-count' },
        }),
        partyDefeatedRule(),
      ];
    case 'all-active-party-defeated-or-three-spirits-lost':
      return [
        partyDefeatedRule(),
        failureRule('three-spirits-lost', 'tagged-actor-incapacitated', { count: 3, match: { tag: 'released-spirit' } }),
      ];
    case 'archive-core-destroyed-or-all-active-party-defeated':
    case 'all-active-party-defeated-or-archive-core-destroyed':
      anchorById(stageContract, 'archive-core');
      return [
        failureRule('archive-core-destroyed', 'objective-object-destroyed', { match: { objectId: 'archive-core' } }),
        partyDefeatedRule(),
      ];
    default:
      throw new RangeError(`Unsupported action objective failure contract: ${failure}.`);
  }
}

function adaptRequirements(encounter, stageContract) {
  const objective = encounter.objective;
  const type = objective.type;
  switch (type) {
    case 'defeatAll': {
      const entry = requirement('defeat-all', 'event-count', {
        eventType: 'enemy-defeated', count: enemyCount(encounter), match: { faction: 'enemy' },
      });
      return { requirements: [entry], completion: all([entry.id]) };
    }
    case 'defeatBoss': {
      const entry = requirement('defeat-boss', 'event-count', {
        eventType: 'actor-defeated', match: { actorTemplateId: bossTemplateId(encounter) },
      });
      return { requirements: [entry], completion: all([entry.id]) };
    }
    case 'surviveThenExit': {
      const exit = exactAnchorCount(stageContract, 'exit', 1, 'exit')[0];
      if (objective.exitTile && exit.sourceTile !== objective.exitTile) {
        throw new RangeError(`${stageContract.id} exit anchor does not preserve authored tile ${objective.exitTile}.`);
      }
      const survive = requirement('survive-enemy-actions', 'event-count', {
        eventType: 'enemy-action-completed',
        count: positiveInteger(objective.surviveEnemyActivations, 'survive enemy activations'),
        match: { faction: 'enemy' },
      });
      const leave = requirement('reach-exit', 'overlap', {
        subject: { kind: 'actor', actorId: 'ren' }, anchorIds: [exit.id], after: [survive.id],
      });
      return { requirements: [survive, leave], completion: all([survive.id, leave.id]) };
    }
    case 'thresholdOrObjects': {
      const ratio = Number(objective.hpThreshold);
      if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) throw new RangeError('hpThreshold must be between zero and one.');
      const bossId = bossTemplateId(encounter);
      const hp = requirement('boss-hp-threshold', 'event-count', {
        eventType: 'actor-hp-ratio-at-or-below', match: { actorTemplateId: bossId, ratio },
      });
      const objectIds = objective.objectCondition?.objectIds ?? [];
      if (!objectIds.length) throw new RangeError('thresholdOrObjects needs objectCondition.objectIds.');
      const objects = objectIds.map((objectId) => {
        anchorById(stageContract, objectId);
        return requirement(`break:${objectId}`, 'event-count', {
          eventType: 'objective-object-destroyed', match: { objectId },
        });
      });
      return {
        requirements: [hp, ...objects],
        completion: {
          operator: 'any',
          clauses: [required(hp.id), { operator: 'all', clauses: objects.map(({ id }) => required(id)) }],
        },
      };
    }
    case 'escortTokens': {
      const tokenCount = positiveInteger(objective.tokenCount, 'escort token count');
      const tokens = encounter.party?.objectiveTokens ?? [];
      if (tokens.length !== tokenCount) throw new RangeError(`${encounter.id} objective-token count does not match escort token count.`);
      const exit = exactAnchorCount(stageContract, 'escort-exit', 1, 'escort exit')[0];
      const entries = tokens.map(({ id }) => requirement(`escort:${id}`, 'overlap', {
        subject: { kind: 'objective-token', tokenId: id }, anchorIds: [exit.id],
      }));
      return { requirements: entries, completion: all(entries.map(({ id }) => id)) };
    }
    case 'defeatBossWithProtection': {
      const protectedTokens = objective.protectedTokens ?? [];
      if (!protectedTokens.length) throw new RangeError('defeatBossWithProtection needs protectedTokens.');
      const defeat = requirement('defeat-boss', 'event-count', {
        eventType: 'actor-defeated', match: { actorTemplateId: bossTemplateId(encounter) },
      });
      const safe = protectedTokens.map((tokenId) => {
        anchorById(stageContract, tokenId);
        const zone = stageContract.objectiveAnchors.find((entry) => entry.accepts?.includes(tokenId));
        if (!zone) throw new RangeError(`${stageContract.id} needs a safe overlap anchor for ${tokenId}.`);
        return requirement(`secure:${tokenId}`, 'overlap', {
          subject: { kind: 'objective-token', tokenId }, anchorIds: [zone.id],
        });
      });
      return { requirements: [defeat, ...safe], completion: all([defeat.id, ...safe.map(({ id }) => id)]) };
    }
    case 'clearRoute': {
      const count = positiveInteger(objective.anchors, 'route anchor count');
      const anchors = exactAnchorCount(stageContract, 'route-anchor', count, 'route');
      const entries = anchors.map(({ id }) => requirement(`clear:${id}`, 'cast-count', {
        castId: 'clear-fog-anchor', anchorIds: [id], durationMs: 900,
      }));
      return { requirements: entries, completion: all(entries.map(({ id }) => id)) };
    }
    case 'releaseTarget': {
      const targetId = requireString(objective.targetId, 'release target id');
      anchorById(stageContract, targetId);
      const entry = requirement(`release:${targetId}`, 'interact', {
        actionId: 'return-recorded-name', anchorIds: [targetId], payload: { itemId: 'name-slip' },
      });
      return { requirements: [entry], completion: all([entry.id]) };
    }
    case 'protectObjects': {
      const survive = requirement('survive-enemy-actions', 'event-count', {
        eventType: 'enemy-action-completed', count: positiveInteger(objective.turns, 'protected-object action count'), match: { faction: 'enemy' },
      });
      const objectIds = objective.protectedObjects ?? [];
      if (!objectIds.length) throw new RangeError('protectObjects needs protectedObjects.');
      const intact = objectIds.map((objectId) => {
        anchorById(stageContract, objectId);
        return requirement(`intact:${objectId}`, 'event-count', {
          eventType: 'objective-object-intact-at-checkpoint', match: { objectId }, after: [survive.id],
        });
      });
      return { requirements: [survive, ...intact], completion: all([survive.id, ...intact.map(({ id }) => id)]) };
    }
    case 'disableOrdersAndProtect': {
      const orders = exactAnchorCount(stageContract, 'orders', 1, 'orders')[0];
      const disable = requirement('disable-orders', 'cast-count', {
        castId: 'disable-orders', anchorIds: [orders.id], durationMs: 1_200,
      });
      const objectIds = objective.protectedObjects ?? [];
      if (!objectIds.length) throw new RangeError('disableOrdersAndProtect needs protectedObjects.');
      const intact = objectIds.map((objectId) => {
        anchorById(stageContract, objectId);
        return requirement(`intact:${objectId}`, 'event-count', {
          eventType: 'objective-object-intact-at-checkpoint', match: { objectId }, after: [disable.id],
        });
      });
      return { requirements: [disable, ...intact], completion: all([disable.id, ...intact.map(({ id }) => id)]) };
    }
    case 'returnItemToTile': {
      const itemId = requireString(objective.item, 'return item id');
      const targetTiles = objective.targetTiles ?? [];
      if (!targetTiles.length) throw new RangeError('returnItemToTile needs targetTiles.');
      const anchors = targetTiles.map((tile) => {
        const found = stageContract.objectiveAnchors.find((entry) => entry.kind === 'item-return' && entry.sourceTile === tile);
        if (!found) throw new RangeError(`${stageContract.id} has no item-return anchor for authored tile ${tile}.`);
        return found;
      });
      const entry = requirement(`return:${itemId}`, 'overlap', {
        subject: { kind: 'carried-item', itemId }, anchorIds: anchors.map(({ id }) => id), overlapMode: 'any-anchor',
      });
      return { requirements: [entry], completion: all([entry.id]) };
    }
    case 'extractAllBeforeCountdown': {
      const targetIds = objective.targets ?? [];
      if (!targetIds.length) throw new RangeError('extractAllBeforeCountdown needs targets.');
      const exit = exactAnchorCount(stageContract, 'extraction', 1, 'prisoner extraction')[0];
      const entries = targetIds.flatMap((targetId) => {
        anchorById(stageContract, targetId);
        const release = requirement(`release:${targetId}`, 'interact', {
          actionId: 'break-chain', anchorIds: [targetId],
        });
        const extract = requirement(`extract:${targetId}`, 'overlap', {
          subject: { kind: 'objective-token', tokenId: targetId }, anchorIds: [exit.id], after: [release.id],
        });
        return [release, extract];
      });
      return { requirements: entries, completion: all(entries.map(({ id }) => id)) };
    }
    case 'activateRelays': {
      const relayIds = objective.relays ?? [];
      if (!relayIds.length) throw new RangeError('activateRelays needs relays.');
      const entries = relayIds.map((relayId) => {
        anchorById(stageContract, relayId);
        return requirement(`relay:${relayId}`, 'cast-count', {
          castId: 'stabilize-lantern-relay', anchorIds: [relayId], durationMs: 1_000,
        });
      });
      return { requirements: entries, completion: all(entries.map(({ id }) => id)) };
    }
    case 'defeatBossAndRelease': {
      const releaseAnchor = exactAnchorCount(stageContract, 'release', 1, 'garrison release')[0];
      const defeat = requirement('defeat-boss', 'event-count', {
        eventType: 'actor-defeated', match: { actorTemplateId: bossTemplateId(encounter) },
      });
      const release = requirement('release-garrison', 'interact', {
        actionId: 'release-garrison', anchorIds: [releaseAnchor.id], after: [defeat.id],
      });
      return { requirements: [defeat, release], completion: all([defeat.id, release.id]) };
    }
    case 'breakObjects': {
      const count = positiveInteger(objective.objectCount, 'break object count');
      const anchors = stageContract.objectiveAnchors.filter(({ id, kind }) => kind === 'object' && id.startsWith('archive-node-'));
      if (anchors.length !== count) throw new RangeError(`${stageContract.id} needs ${count} archive-node object anchors; found ${anchors.length}.`);
      const entries = anchors.map(({ id }) => requirement(`break:${id}`, 'cast-count', {
        castId: 'use-bell-key', anchorIds: [id], durationMs: 700,
      }));
      return { requirements: entries, completion: all(entries.map(({ id }) => id)) };
    }
    case 'breakPhaseObjects': {
      const objectIds = objective.objectIds ?? [];
      if (!objectIds.length) throw new RangeError('breakPhaseObjects needs objectIds.');
      const entries = objectIds.map((objectId) => {
        anchorById(stageContract, objectId);
        return requirement(`break:${objectId}`, 'event-count', {
          eventType: 'objective-object-destroyed', match: { objectId },
        });
      });
      return { requirements: entries, completion: all(entries.map(({ id }) => id)) };
    }
    case 'defeatBossAndEvacuate': {
      const exit = exactAnchorCount(stageContract, 'exit', 1, 'evacuation exit')[0];
      anchorById(stageContract, 'archive-core');
      const defeat = requirement('defeat-boss', 'event-count', {
        eventType: 'actor-defeated', match: { actorTemplateId: bossTemplateId(encounter) },
      });
      const evacuate = requirement('evacuate', 'overlap', {
        subject: { kind: 'actor', faction: 'player', selection: 'any-living' }, anchorIds: [exit.id], after: [defeat.id],
      });
      return { requirements: [defeat, evacuate], completion: all([defeat.id, evacuate.id]) };
    }
    case 'completeInteractions': {
      const interactionIds = objective.interactions ?? [];
      if (!interactionIds.length) throw new RangeError('completeInteractions needs interactions.');
      const entries = interactionIds.map((interactionId) => {
        anchorById(stageContract, interactionId);
        return requirement(`interact:${interactionId}`, 'interact', {
          actionId: interactionId, anchorIds: [interactionId],
        });
      });
      return { requirements: entries, completion: all(entries.map(({ id }) => id)) };
    }
    default:
      throw new RangeError(`Unsupported action objective type: ${type}.`);
  }
}

function validateCompletion(node, requirementIds, errors, path = 'completion') {
  if (!node || typeof node !== 'object') {
    errors.push(`${path} is missing`);
    return;
  }
  if (node.operator === 'requirement') {
    if (!requirementIds.has(node.id)) errors.push(`${path} references unknown requirement ${node.id}`);
    return;
  }
  if (!['all', 'any'].includes(node.operator) || !Array.isArray(node.clauses) || !node.clauses.length) {
    errors.push(`${path} must be a non-empty all/any expression`);
    return;
  }
  node.clauses.forEach((clause, index) => validateCompletion(clause, requirementIds, errors, `${path}.clauses[${index}]`));
}

export function validateActionObjectiveContract(contract, stageContract = null) {
  const errors = [];
  if (contract?.schemaVersion !== ACTION_OBJECTIVE_SCHEMA_VERSION) errors.push('unsupported objective schema version');
  if (!ACTION_OBJECTIVE_TYPES.includes(contract?.objectiveType)) errors.push(`unsupported objective type ${contract?.objectiveType}`);
  const requirements = contract?.requirements;
  if (!Array.isArray(requirements) || !requirements.length) return [...errors, 'objective contract needs requirements'];
  const ids = new Set();
  const stage = stageContract ?? (() => {
    try { return getActionStage(contract.levelId); } catch { return null; }
  })();
  if (!stage) errors.push(`unsupported action stage ${contract?.levelId}`);
  for (const entry of requirements) {
    if (!entry?.id || ids.has(entry.id)) errors.push('objective requirements need unique ids');
    ids.add(entry?.id);
    if (!ACTION_OBJECTIVE_SEMANTICS.includes(entry?.semantics)) errors.push(`${entry?.id} has unsupported semantics`);
    if (!Number.isSafeInteger(entry?.count) || entry.count < 1) errors.push(`${entry?.id} needs a positive count`);
    if (!Array.isArray(entry?.after)) errors.push(`${entry?.id} needs an after array`);
    if (entry?.semantics === 'event-count' && !entry.eventType) errors.push(`${entry.id} needs eventType`);
    if (entry?.semantics === 'overlap' && (!entry.subject || !entry.anchorIds?.length)) errors.push(`${entry.id} needs overlap subject and anchors`);
    if (entry?.semantics === 'interact' && (!entry.actionId || !entry.anchorIds?.length)) errors.push(`${entry.id} needs interact action and anchors`);
    if (entry?.semantics === 'cast-count' && (!entry.castId || !entry.anchorIds?.length || !Number.isSafeInteger(entry.durationMs) || entry.durationMs < 1)) {
      errors.push(`${entry.id} needs cast id, anchors, and positive durationMs`);
    }
    for (const anchorId of entry?.anchorIds ?? []) {
      if (stage && !stage.objectiveAnchors.some(({ id }) => id === anchorId)) errors.push(`${entry.id} references unknown anchor ${anchorId}`);
    }
  }
  for (const entry of requirements) {
    for (const dependency of entry.after ?? []) if (!ids.has(dependency)) errors.push(`${entry.id} depends on unknown requirement ${dependency}`);
  }
  validateCompletion(contract?.completion, ids, errors);
  for (const failure of contract?.failures ?? []) {
    if (failure.semantics !== 'event-count' || !failure.eventType || !Number.isSafeInteger(failure.count) || failure.count < 1) {
      errors.push(`${failure?.id ?? 'failure'} has invalid failure semantics`);
    }
  }
  return errors;
}

export function adaptActionObjective(encounter, options = {}) {
  if (!encounter?.id) throw new TypeError('Action objective adapter requires an encounter id.');
  if (!encounter?.levelId) throw new TypeError(`${encounter.id} is missing levelId.`);
  if (!encounter?.objective?.type) throw new TypeError(`${encounter.id} is missing objective.type.`);
  if (!ACTION_OBJECTIVE_TYPES.includes(encounter.objective.type)) {
    throw new RangeError(`Unsupported action objective type: ${encounter.objective.type}.`);
  }
  const stageContract = options.stage ?? getActionStage(encounter.levelId);
  const stageErrors = validateActionStage(stageContract);
  if (stageErrors.length) throw new TypeError(`Invalid action stage ${stageContract?.id}: ${stageErrors.join('; ')}`);
  if (stageContract.id !== encounter.levelId) {
    throw new RangeError(`Encounter ${encounter.id} requires stage ${encounter.levelId}, not ${stageContract.id}.`);
  }
  const adapted = adaptRequirements(encounter, stageContract);
  const result = {
    schemaVersion: ACTION_OBJECTIVE_SCHEMA_VERSION,
    encounterId: encounter.id,
    levelId: encounter.levelId,
    objectiveType: encounter.objective.type,
    text: String(encounter.objective.text ?? ''),
    requirements: adapted.requirements,
    completion: adapted.completion,
    failures: adaptFailure(encounter.objective.failure, encounter.objective, stageContract),
  };
  const errors = validateActionObjectiveContract(result, stageContract);
  if (errors.length) throw new TypeError(`Invalid action objective contract for ${encounter.id}: ${errors.join('; ')}`);
  return deepFreeze(result);
}
