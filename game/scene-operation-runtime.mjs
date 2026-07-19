/**
 * Immutable once-per-save progress for the finite story operations attached to
 * every canonical campaign beat. This module owns progress only; encounter
 * victories remain authoritative in advancement.mjs and are supplied as
 * explicit evidence when an encounter-bound node is recorded.
 */

import { CAMPAIGN } from './content/campaign.mjs';
import { getDefaultBrowserStorage } from './browser-storage.mjs';
import { SCENE_OPERATIONS, getSceneOperation } from './content/scene-operations.mjs';

export const SCENE_OPERATION_SAVE_SCHEMA_VERSION = 1;
export const DEFAULT_SCENE_OPERATION_SAVE_KEY = `${CAMPAIGN.id}.scene-operations.v${SCENE_OPERATION_SAVE_SCHEMA_VERSION}`;

const STATE_KEYS = Object.freeze(['schemaVersion', 'campaignId', 'records', 'revision']);
const RECORD_KEYS = Object.freeze(['beatId', 'status', 'nextNodeIndex', 'completedNodeIds']);
const OPERATION_ORDER = new Map(SCENE_OPERATIONS.operations.map((operation, index) => [operation.beatId, index]));

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function freezeState(records, revision) {
  return deepFreeze({
    schemaVersion: SCENE_OPERATION_SAVE_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    records: records.map((record) => ({ ...record, completedNodeIds: [...record.completedNodeIds] })),
    revision,
  });
}

function sortedRecords(records) {
  return [...records].sort((left, right) => OPERATION_ORDER.get(left.beatId) - OPERATION_ORDER.get(right.beatId));
}

function failed(state, code, reason, details = {}) {
  return deepFreeze({ ok: false, code, reason, state, ...details });
}

function keyForPosition(position) {
  if (typeof position === 'string') return position;
  if (Array.isArray(position) && position.length === 2) return `${position[0]},${position[1]}`;
  if (position && Number.isInteger(position.x) && Number.isInteger(position.y)) return `${position.x},${position.y}`;
  return null;
}

export function createSceneOperationState() {
  return freezeState([], 0);
}

export function getSceneOperationRecord(state, beatId) {
  return state?.records?.find((record) => record.beatId === beatId) ?? null;
}

export function getSceneOperationProgress(state, beatId) {
  const operation = getSceneOperation(beatId);
  if (!operation) return null;
  const record = getSceneOperationRecord(state, beatId);
  const completedNodeCount = record?.nextNodeIndex ?? 0;
  const complete = record?.status === 'completed';
  return deepFreeze({
    operation,
    beatId,
    status: record?.status ?? 'not-started',
    nodeCount: operation.nodes.length,
    completedNodeCount,
    completedNodeIds: record?.completedNodeIds ?? [],
    currentNodeIndex: complete ? null : completedNodeCount,
    currentNode: complete ? null : operation.nodes[completedNodeCount] ?? null,
    complete,
  });
}

export function getSceneOperationRuntimeMetrics(state) {
  const completedOperationCount = SCENE_OPERATIONS.operations
    .filter((operation) => getSceneOperationRecord(state, operation.beatId)?.status === 'completed').length;
  const completedNodeCount = (state?.records ?? [])
    .reduce((sum, record) => sum + (record.completedNodeIds?.length ?? 0), 0);
  return deepFreeze({
    operationCount: SCENE_OPERATIONS.metrics.operationCount,
    nodeCount: SCENE_OPERATIONS.metrics.nodeCount,
    completedOperationCount,
    completedNodeCount,
    remainingOperationCount: SCENE_OPERATIONS.metrics.operationCount - completedOperationCount,
    remainingNodeCount: SCENE_OPERATIONS.metrics.nodeCount - completedNodeCount,
    campaignComplete: completedOperationCount === SCENE_OPERATIONS.metrics.operationCount,
  });
}

/**
 * Record exactly the current node. Encounter-bound final nodes require every
 * bound encounter to have a positive integer win count in `evidence.encounterWins`.
 */
export function advanceSceneOperation(state, beatId, nodeId, evidence = {}) {
  const validation = validateSceneOperationPayload(state);
  if (!validation.ok) return failed(state, 'invalid-state', validation.errors.join(' '));
  const trustedState = validation.state;
  const progress = getSceneOperationProgress(trustedState, beatId);
  if (!progress) return failed(trustedState, 'unknown-beat', 'Unknown scene operation beat.');
  if (progress.complete) return failed(trustedState, 'already-complete', 'This finite scene operation is already complete.');
  const node = progress.currentNode;
  if (!node || node.id !== nodeId) {
    return failed(trustedState, 'wrong-node', `The next required node is ${node?.id ?? 'unavailable'}.`);
  }
  if (keyForPosition(evidence.at) !== node.at) {
    return failed(trustedState, 'wrong-position', `Stand on exact field space ${node.at} before recording this operation.`, { requiredAt: node.at });
  }
  const pendingEncounterIds = node.encounterIds.filter((encounterId) => {
    const wins = evidence?.encounterWins?.[encounterId];
    return !Number.isSafeInteger(wins) || wins < 1;
  });
  if (pendingEncounterIds.length) {
    return failed(
      trustedState,
      'encounter-victory-required',
      `Resolve the bound encounter${pendingEncounterIds.length === 1 ? '' : 's'} before recording this node.`,
      { pendingEncounterIds },
    );
  }

  const nextNodeIndex = progress.completedNodeCount + 1;
  const completed = nextNodeIndex === progress.nodeCount;
  const nextRecord = {
    beatId,
    status: completed ? 'completed' : 'active',
    nextNodeIndex,
    completedNodeIds: [...progress.completedNodeIds, node.id],
  };
  const records = trustedState.records.filter((record) => record.beatId !== beatId);
  records.push(nextRecord);
  const nextState = freezeState(sortedRecords(records), trustedState.revision + 1);
  return deepFreeze({
    ok: true,
    code: completed ? 'operation-complete' : 'node-complete',
    state: nextState,
    node,
    beatCompleted: completed,
    progress: getSceneOperationProgress(nextState, beatId),
  });
}

/** Strictly validate an untrusted scene-operation save payload. */
export function validateSceneOperationPayload(payload) {
  const errors = [];
  if (!exactKeys(payload, STATE_KEYS)) errors.push('Save must contain exactly the scene-operation state keys.');
  if (payload?.schemaVersion !== SCENE_OPERATION_SAVE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must equal ${SCENE_OPERATION_SAVE_SCHEMA_VERSION}.`);
  }
  if (payload?.campaignId !== CAMPAIGN.id) errors.push(`campaignId must equal ${CAMPAIGN.id}.`);
  if (!Number.isSafeInteger(payload?.revision) || payload.revision < 0) errors.push('revision must be a non-negative safe integer.');
  if (!Array.isArray(payload?.records)) {
    errors.push('records must be an array.');
  } else {
    const seen = new Set();
    payload.records.forEach((record, index) => {
      const label = `record ${index}`;
      if (!exactKeys(record, RECORD_KEYS)) errors.push(`${label} must contain exactly the scene-operation record keys.`);
      const operation = getSceneOperation(record?.beatId);
      if (!operation) errors.push(`${label} references an unknown beat.`);
      if (seen.has(record?.beatId)) errors.push(`${label} duplicates ${record?.beatId}.`);
      seen.add(record?.beatId);
      if (!['active', 'completed'].includes(record?.status)) errors.push(`${label} has an invalid status.`);
      if (!Number.isSafeInteger(record?.nextNodeIndex) || record.nextNodeIndex < 1 || (operation && record.nextNodeIndex > operation.nodes.length)) {
        errors.push(`${label} has an invalid nextNodeIndex.`);
      }
      if (!Array.isArray(record?.completedNodeIds)) {
        errors.push(`${label}.completedNodeIds must be an array.`);
      } else if (operation) {
        const expected = operation.nodes.slice(0, record.nextNodeIndex).map((node) => node.id);
        if (JSON.stringify(record.completedNodeIds) !== JSON.stringify(expected)) errors.push(`${label} completed nodes must be the exact canonical prefix.`);
      }
      if (operation) {
        const shouldBeCompleted = record.nextNodeIndex === operation.nodes.length;
        if ((record.status === 'completed') !== shouldBeCompleted) errors.push(`${label} status does not match its node frontier.`);
      }
    });
    const canonical = sortedRecords(payload.records);
    if (canonical.some((record, index) => record.beatId !== payload.records[index]?.beatId)) {
      errors.push('records must use canonical beat order.');
    }
  }
  if (errors.length) return deepFreeze({ ok: false, state: null, errors });
  return deepFreeze({ ok: true, state: freezeState(payload.records, payload.revision), errors: [] });
}

export function serializeSceneOperationState(state) {
  const validation = validateSceneOperationPayload(state);
  if (!validation.ok) throw new TypeError(`Cannot serialize scene-operation state: ${validation.errors.join(' ')}`);
  return JSON.stringify(validation.state);
}

export function loadSceneOperationState(serialized) {
  if (serialized == null || serialized === '') {
    return deepFreeze({ ok: true, state: createSceneOperationState(), fresh: true, found: false, errors: [] });
  }
  try {
    const validation = validateSceneOperationPayload(JSON.parse(serialized));
    if (!validation.ok) return deepFreeze({ ...validation, fresh: false, found: true });
    return deepFreeze({ ...validation, fresh: false, found: true });
  } catch {
    return deepFreeze({ ok: false, state: null, fresh: false, found: true, errors: ['Scene-operation save is not valid JSON.'] });
  }
}

export function createSceneOperationStorageAdapter(storage = getDefaultBrowserStorage(), key = DEFAULT_SCENE_OPERATION_SAVE_KEY) {
  return Object.freeze({
    key,
    load() {
      try {
        const loaded = loadSceneOperationState(storage?.getItem?.(key));
        return loaded.ok ? loaded : deepFreeze({ ...loaded, state: createSceneOperationState() });
      } catch {
        return deepFreeze({ ok: false, state: createSceneOperationState(), fresh: true, found: false, errors: ['Scene-operation storage could not be read.'] });
      }
    },
    save(state) {
      try {
        storage?.setItem?.(key, serializeSceneOperationState(state));
        return deepFreeze({ ok: true, errors: [] });
      } catch {
        return deepFreeze({ ok: false, errors: ['Scene-operation storage could not be written.'] });
      }
    },
    clear() {
      try {
        storage?.removeItem?.(key);
        return deepFreeze({ ok: true, errors: [] });
      } catch {
        return deepFreeze({ ok: false, errors: ['Scene-operation storage could not be cleared.'] });
      }
    },
  });
}
