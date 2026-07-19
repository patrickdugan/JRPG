/**
 * Versioned, finite progress state for authored witness chronicles.
 *
 * This module is DOM-free and does not read localStorage directly. Successful
 * transitions return a new immutable state; failed transitions preserve the
 * caller's state and explain the unmet contract.
 */

import { CAMPAIGN } from './content/campaign.mjs';
import { getDefaultBrowserStorage } from './browser-storage.mjs';
import {
  WITNESS_CHRONICLES,
  getWitnessChronicle,
  getWitnessChronicleMetrics,
} from './content/witness-chronicles.mjs';

export const WITNESS_CHRONICLE_SAVE_SCHEMA_VERSION = 2;
export const DEFAULT_WITNESS_CHRONICLE_SAVE_KEY = `${CAMPAIGN.id}.witness-chronicles.v${WITNESS_CHRONICLE_SAVE_SCHEMA_VERSION}`;
export const WITNESS_CHRONICLE_STATUSES = Object.freeze({ ACTIVE: 'active', COMPLETED: 'completed' });

const STATE_KEYS = Object.freeze(['schemaVersion', 'campaignId', 'records', 'revision']);
const RECORD_KEYS = Object.freeze(['id', 'status', 'stageIndex', 'choiceId', 'acknowledgedLines']);
const CHRONICLE_ORDER = new Map(WITNESS_CHRONICLES.map((entry, index) => [entry.id, index]));

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
    schemaVersion: WITNESS_CHRONICLE_SAVE_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    records: records.map((record) => ({ ...record })),
    revision,
  });
}

function sortedRecords(records) {
  return [...records].sort((left, right) => CHRONICLE_ORDER.get(left.id) - CHRONICLE_ORDER.get(right.id));
}

function nextState(state, records) {
  return freezeState(sortedRecords(records), state.revision + 1);
}

function failed(state, reason) {
  return deepFreeze({ ok: false, reason, state });
}

export function createWitnessChronicleState() {
  return freezeState([], 0);
}

export function getWitnessChronicleRecord(state, chronicleId) {
  return state?.records?.find((record) => record.id === chronicleId) ?? null;
}

function selectedOption(entry, choiceId) {
  return entry?.choice.options.find((candidate) => candidate.id === choiceId) ?? null;
}

export function getWitnessChronicleProgress(state, chronicleId) {
  const entry = getWitnessChronicle(chronicleId);
  if (!entry) return null;
  const record = getWitnessChronicleRecord(state, chronicleId);
  const stageIndex = record?.stageIndex ?? 0;
  const currentStage = record?.status === WITNESS_CHRONICLE_STATUSES.ACTIVE && stageIndex < entry.stages.length
    ? entry.stages[stageIndex]
    : null;
  const option = selectedOption(entry, record?.choiceId);
  return deepFreeze({
    chronicle: entry,
    status: record?.status ?? 'not-started',
    stageIndex,
    stageCount: entry.stages.length,
    currentStage,
    currentStageId: currentStage?.id ?? null,
    acknowledgedLines: record?.acknowledgedLines ?? 0,
    dialogueLineCount: currentStage?.dialogue.length ?? 0,
    currentDialogueLine: currentStage?.dialogue[record?.acknowledgedLines ?? 0] ?? null,
    dialogueComplete: Boolean(currentStage) && (record?.acknowledgedLines ?? 0) === currentStage.dialogue.length,
    choiceId: record?.choiceId ?? null,
    selectedConsequence: option?.consequence ?? null,
    readyToComplete: record?.status === WITNESS_CHRONICLE_STATUSES.ACTIVE && stageIndex === entry.stages.length,
  });
}

export function getWitnessChronicleAvailability(state, chronicleId, context = {}) {
  const entry = getWitnessChronicle(chronicleId);
  if (!entry) return deepFreeze({ available: false, reason: 'Unknown witness chronicle.' });
  const record = getWitnessChronicleRecord(state, chronicleId);
  if (record?.status === WITNESS_CHRONICLE_STATUSES.ACTIVE) {
    return deepFreeze({ available: false, reason: 'Witness chronicle is already active.' });
  }
  if (record?.status === WITNESS_CHRONICLE_STATUSES.COMPLETED) {
    return deepFreeze({ available: false, reason: 'Witness chronicle is finite and already complete.' });
  }
  const completedBeats = new Set(context?.campaignState?.completedBeatIds ?? []);
  if (!completedBeats.has(entry.opensAfterBeatId)) {
    return deepFreeze({ available: false, reason: `Opens after ${entry.opensAfterBeatId}.` });
  }
  return deepFreeze({ available: true, reason: 'Available.' });
}

/** Accepts a chronicle once its same-chapter opening beat is complete. */
export function acceptWitnessChronicle(state, chronicleId, context = {}) {
  const availability = getWitnessChronicleAvailability(state, chronicleId, context);
  if (!availability.available) return failed(state, availability.reason);
  const record = {
    id: chronicleId,
    status: WITNESS_CHRONICLE_STATUSES.ACTIVE,
    stageIndex: 0,
    choiceId: null,
    acknowledgedLines: 0,
  };
  const updated = nextState(state, [...state.records, record]);
  return deepFreeze({ ok: true, state: updated, progress: getWitnessChronicleProgress(updated, chronicleId) });
}

/** Acknowledges exactly one authored line in the current stage. */
export function acknowledgeWitnessChronicleLine(state, chronicleId) {
  const entry = getWitnessChronicle(chronicleId);
  const record = getWitnessChronicleRecord(state, chronicleId);
  if (!entry || !record || record.status !== WITNESS_CHRONICLE_STATUSES.ACTIVE) {
    return failed(state, 'Witness chronicle is not active.');
  }
  const currentStage = entry.stages[record.stageIndex];
  if (!currentStage) return failed(state, 'Every authored stage is already recorded.');
  if (record.acknowledgedLines >= currentStage.dialogue.length) {
    return failed(state, 'Every authored line in this stage is already acknowledged.');
  }
  const replacement = { ...record, acknowledgedLines: record.acknowledgedLines + 1 };
  const updated = nextState(state, state.records.map((candidate) => candidate.id === chronicleId ? replacement : candidate));
  return deepFreeze({
    ok: true,
    state: updated,
    line: currentStage.dialogue[record.acknowledgedLines],
    progress: getWitnessChronicleProgress(updated, chronicleId),
  });
}

/**
 * Advances exactly one authored stage.
 *
 * evidence.choiceId is required on the chronicle's choice stage. Combat stages
 * additionally require the exact canonical encounter ID and victory: true.
 */
export function advanceWitnessChronicle(state, chronicleId, completedStageId, evidence = {}) {
  const entry = getWitnessChronicle(chronicleId);
  const record = getWitnessChronicleRecord(state, chronicleId);
  if (!entry || !record || record.status !== WITNESS_CHRONICLE_STATUSES.ACTIVE) {
    return failed(state, 'Witness chronicle is not active.');
  }
  if (record.stageIndex >= entry.stages.length) return failed(state, 'Every authored stage is already recorded.');
  const currentStage = entry.stages[record.stageIndex];
  if (completedStageId !== currentStage.id) return failed(state, `Expected stage ${currentStage.id}.`);
  if (record.acknowledgedLines !== currentStage.dialogue.length) {
    return failed(state, `Stage requires all ${currentStage.dialogue.length} authored dialogue lines.`);
  }

  if (currentStage.encounterId) {
    if (evidence.encounterId !== currentStage.encounterId || evidence.victory !== true) {
      return failed(state, `Stage requires victory in ${currentStage.encounterId}.`);
    }
  } else if (evidence.encounterId != null || evidence.victory != null) {
    return failed(state, 'Non-combat stage does not accept encounter evidence.');
  }

  const isChoiceStage = entry.choice.stageId === currentStage.id;
  let choiceId = record.choiceId;
  if (isChoiceStage) {
    if (!selectedOption(entry, evidence.choiceId)) return failed(state, 'Stage requires one authored consequence choice.');
    choiceId = evidence.choiceId;
  } else if (evidence.choiceId != null) {
    return failed(state, `Choice belongs to stage ${entry.choice.stageId}.`);
  }

  const replacement = { ...record, stageIndex: record.stageIndex + 1, choiceId, acknowledgedLines: 0 };
  const updated = nextState(state, state.records.map((candidate) => candidate.id === chronicleId ? replacement : candidate));
  return deepFreeze({ ok: true, state: updated, progress: getWitnessChronicleProgress(updated, chronicleId) });
}

/** Completes a finite chronicle once, returning its one-time reward and consequence. */
export function completeWitnessChronicle(state, chronicleId) {
  const entry = getWitnessChronicle(chronicleId);
  const record = getWitnessChronicleRecord(state, chronicleId);
  if (!entry || !record || record.status !== WITNESS_CHRONICLE_STATUSES.ACTIVE) {
    return failed(state, 'Witness chronicle is not active.');
  }
  if (record.stageIndex !== entry.stages.length) return failed(state, 'Authored stages remain.');
  const option = selectedOption(entry, record.choiceId);
  if (!option) return failed(state, 'An authored consequence choice remains.');
  const replacement = { ...record, status: WITNESS_CHRONICLE_STATUSES.COMPLETED };
  const updated = nextState(state, state.records.map((candidate) => candidate.id === chronicleId ? replacement : candidate));
  return deepFreeze({
    ok: true,
    state: updated,
    reward: entry.reward,
    consequence: option.consequence,
    progress: getWitnessChronicleProgress(updated, chronicleId),
  });
}

/** Strictly validates an untrusted v2 save payload. */
export function validateWitnessChroniclePayload(payload) {
  const errors = [];
  if (!exactKeys(payload, STATE_KEYS)) errors.push('Save must contain exactly the witness-chronicle v1 state keys.');
  if (payload?.schemaVersion !== WITNESS_CHRONICLE_SAVE_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${WITNESS_CHRONICLE_SAVE_SCHEMA_VERSION}.`);
  if (payload?.campaignId !== CAMPAIGN.id) errors.push(`campaignId must equal ${CAMPAIGN.id}.`);
  if (!Number.isSafeInteger(payload?.revision) || payload.revision < 0) errors.push('revision must be a non-negative safe integer.');
  if (!Array.isArray(payload?.records)) {
    errors.push('records must be an array.');
  } else {
    const ids = new Set();
    payload.records.forEach((record, index) => {
      if (!exactKeys(record, RECORD_KEYS)) errors.push(`records[${index}] has unsupported keys.`);
      const entry = getWitnessChronicle(record?.id);
      if (!entry) errors.push(`records[${index}] has unknown witness chronicle ID.`);
      if (ids.has(record?.id)) errors.push(`records[${index}] duplicates ${record.id}.`);
      ids.add(record?.id);
      if (!Object.values(WITNESS_CHRONICLE_STATUSES).includes(record?.status)) errors.push(`records[${index}].status is invalid.`);
      if (!Number.isSafeInteger(record?.stageIndex) || record.stageIndex < 0 || (entry && record.stageIndex > entry.stages.length)) {
        errors.push(`records[${index}].stageIndex is invalid.`);
      }
      if (!Number.isSafeInteger(record?.acknowledgedLines) || record.acknowledgedLines < 0) {
        errors.push(`records[${index}].acknowledgedLines is invalid.`);
      }
      if (entry) {
        const choiceStageIndex = entry.stages.findIndex((current) => current.id === entry.choice.stageId);
        const option = selectedOption(entry, record?.choiceId);
        if (record.stageIndex <= choiceStageIndex && record.choiceId !== null) errors.push(`records[${index}].choiceId is set before its stage.`);
        if (record.stageIndex > choiceStageIndex && !option) errors.push(`records[${index}].choiceId must select an authored option.`);
        if (record.status === WITNESS_CHRONICLE_STATUSES.COMPLETED && record.stageIndex !== entry.stages.length) {
          errors.push(`records[${index}] completed status requires every stage.`);
        }
        const currentStage = entry.stages[record.stageIndex] ?? null;
        if (currentStage && record.acknowledgedLines > currentStage.dialogue.length) {
          errors.push(`records[${index}].acknowledgedLines exceeds the current stage dialogue.`);
        }
        if (!currentStage && record.acknowledgedLines !== 0) {
          errors.push(`records[${index}].acknowledgedLines must reset after the final stage.`);
        }
      }
    });
    const ordered = sortedRecords(payload.records);
    if (ordered.some((record, index) => record.id !== payload.records[index]?.id)) errors.push('records must use canonical witness-chronicle order.');
  }
  if (errors.length) return deepFreeze({ ok: false, errors });
  return deepFreeze({ ok: true, state: freezeState(payload.records, payload.revision), errors: [] });
}

export function serializeWitnessChronicleState(state) {
  const validation = validateWitnessChroniclePayload(state);
  if (!validation.ok) throw new TypeError(validation.errors.join(' '));
  return JSON.stringify(validation.state);
}

export function loadWitnessChronicleState(serialized) {
  if (serialized == null || serialized === '') {
    return deepFreeze({ ok: true, state: createWitnessChronicleState(), fresh: true, errors: [] });
  }
  try {
    const validation = validateWitnessChroniclePayload(JSON.parse(serialized));
    return deepFreeze({ ...validation, fresh: false });
  } catch {
    return deepFreeze({ ok: false, fresh: false, errors: ['Witness chronicle save is not valid JSON.'] });
  }
}

export function createWitnessChronicleStorageAdapter(storage = getDefaultBrowserStorage(), key = DEFAULT_WITNESS_CHRONICLE_SAVE_KEY) {
  return Object.freeze({
    load() {
      try {
        const loaded = loadWitnessChronicleState(storage?.getItem?.(key));
        return loaded.ok ? loaded : deepFreeze({ ...loaded, state: createWitnessChronicleState() });
      } catch {
        return deepFreeze({ ok: false, state: createWitnessChronicleState(), errors: ['Witness chronicle storage could not be read.'] });
      }
    },
    save(state) {
      try {
        storage?.setItem?.(key, serializeWitnessChronicleState(state));
        return deepFreeze({ ok: true });
      } catch {
        return deepFreeze({ ok: false, errors: ['Witness chronicle storage could not be written.'] });
      }
    },
    clear() {
      try {
        storage?.removeItem?.(key);
        return deepFreeze({ ok: true });
      } catch {
        return deepFreeze({ ok: false, errors: ['Witness chronicle storage could not be cleared.'] });
      }
    },
  });
}

export function getWitnessChronicleRuntimeMetrics(state) {
  const content = getWitnessChronicleMetrics();
  const completedIds = state.records.filter((record) => record.status === WITNESS_CHRONICLE_STATUSES.COMPLETED).map((record) => record.id);
  const activeIds = state.records.filter((record) => record.status === WITNESS_CHRONICLE_STATUSES.ACTIVE).map((record) => record.id);
  const completedMinutes = completedIds.reduce((sum, id) => sum + getWitnessChronicle(id).estimatedMinutes, 0);
  const completedStages = state.records.reduce((sum, record) => sum + record.stageIndex, 0);
  return deepFreeze({
    totalChronicles: content.chronicleCount,
    completedChronicles: completedIds.length,
    activeChronicles: activeIds.length,
    completedStages,
    totalStages: content.stageCount,
    completedMinutes,
    remainingFiniteMinutes: content.totalMinutes - completedMinutes,
    percentChroniclesComplete: Number(((completedIds.length / content.chronicleCount) * 100).toFixed(1)),
    completedIds,
    activeIds,
  });
}
