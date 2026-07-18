/**
 * Versioned optional-quest state for Bells of the Black Chrysanthemum.
 *
 * Content remains in content/sidequests.mjs. This module owns only player
 * progress and deliberately avoids DOM and direct localStorage access.
 */

import { CAMPAIGN } from './content/campaign.mjs';
import { ALL_OPTIONAL_QUESTS, getSideQuest } from './content/sidequests.mjs';

export const QUEST_SCHEMA_VERSION = 1;
export const DEFAULT_QUEST_SAVE_KEY = `${CAMPAIGN.id}.quests.v${QUEST_SCHEMA_VERSION}`;
export const QUEST_STATUSES = Object.freeze({ ACTIVE: 'active', COMPLETED: 'completed' });

const QUEST_ORDER = new Map(ALL_OPTIONAL_QUESTS.map((quest, index) => [quest.id, index]));
const STATE_KEYS = Object.freeze(['schemaVersion', 'campaignId', 'records', 'revision']);
const RECORD_KEYS = Object.freeze(['id', 'status', 'objectiveIndex', 'completions']);

function freezeState(records, revision) {
  return Object.freeze({
    schemaVersion: QUEST_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    records: Object.freeze(records.map((record) => Object.freeze({ ...record }))),
    revision,
  });
}

function nextState(state, records) {
  return freezeState(records, state.revision + 1);
}

function sortedRecords(records) {
  return [...records].sort((left, right) => QUEST_ORDER.get(left.id) - QUEST_ORDER.get(right.id));
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

function objectiveId(objective, index) {
  return objective?.id ?? `objective-${index + 1}`;
}

function isRepeatable(quest) {
  return quest?.kind === 'repeatable' || quest?.kind === 'contract' || Boolean(quest?.rewards?.repeat);
}

export function createQuestState() {
  return freezeState([], 0);
}

export function getQuestRecord(state, questId) {
  return state.records.find((record) => record.id === questId) ?? null;
}

export function getQuestProgress(state, questId) {
  const quest = getSideQuest(questId);
  if (!quest) return null;
  const record = getQuestRecord(state, questId);
  const objectiveCount = quest.objectives.length;
  const currentObjective = record?.status === QUEST_STATUSES.ACTIVE && record.objectiveIndex < objectiveCount
    ? quest.objectives[record.objectiveIndex]
    : null;
  return Object.freeze({
    quest,
    status: record?.status ?? 'not-started',
    objectiveIndex: record?.objectiveIndex ?? 0,
    objectiveCount,
    currentObjective,
    currentObjectiveId: currentObjective ? objectiveId(currentObjective, record.objectiveIndex) : null,
    readyToComplete: record?.status === QUEST_STATUSES.ACTIVE && record.objectiveIndex >= objectiveCount,
    completions: record?.completions ?? 0,
  });
}

function prerequisiteValues(prerequisites, key) {
  const value = prerequisites?.[key];
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function getQuestAvailability(state, questId, context = {}) {
  const quest = getSideQuest(questId);
  if (!quest) return Object.freeze({ available: false, reason: 'Unknown quest.' });
  const record = getQuestRecord(state, questId);
  if (record?.status === QUEST_STATUSES.ACTIVE) return Object.freeze({ available: false, reason: 'Quest is already active.' });
  if (record?.status === QUEST_STATUSES.COMPLETED && !isRepeatable(quest)) {
    return Object.freeze({ available: false, reason: 'Quest is already complete.' });
  }

  const completedBeats = new Set(context.campaignState?.completedBeatIds ?? []);
  const rawFlags = context.campaignState?.flags ?? [];
  const campaignFlags = new Set(Array.isArray(rawFlags) ? rawFlags : Object.keys(rawFlags));
  const encounterWins = context.advancementState?.encounterWins ?? {};
  const opensAfterBeatId = quest.prerequisites?.opensAfterBeatId;
  if (opensAfterBeatId && !completedBeats.has(opensAfterBeatId)) {
    return Object.freeze({ available: false, reason: `Opens after ${opensAfterBeatId}.` });
  }
  for (const prerequisiteQuestId of prerequisiteValues(quest.prerequisites, 'questIds')) {
    if (getQuestRecord(state, prerequisiteQuestId)?.status !== QUEST_STATUSES.COMPLETED) {
      return Object.freeze({ available: false, reason: `Requires ${prerequisiteQuestId}.` });
    }
  }
  for (const flag of prerequisiteValues(quest.prerequisites, 'campaignFlags')) {
    if (!campaignFlags.has(flag)) return Object.freeze({ available: false, reason: `Requires story flag ${flag}.` });
  }
  for (const encounterId of prerequisiteValues(quest.prerequisites, 'encounterIds')) {
    if (!encounterWins[encounterId]) return Object.freeze({ available: false, reason: `Requires encounter ${encounterId}.` });
  }
  return Object.freeze({ available: true, reason: record ? 'Repeat contract ready.' : 'Available.' });
}

export function acceptQuest(state, questId, context = {}) {
  const availability = getQuestAvailability(state, questId, context);
  if (!availability.available) return Object.freeze({ ok: false, reason: availability.reason, state });
  const prior = getQuestRecord(state, questId);
  const replacement = {
    id: questId,
    status: QUEST_STATUSES.ACTIVE,
    objectiveIndex: 0,
    completions: prior?.completions ?? 0,
  };
  const records = sortedRecords([...state.records.filter((record) => record.id !== questId), replacement]);
  return Object.freeze({ ok: true, state: nextState(state, records), progress: getQuestProgress(nextState(state, records), questId) });
}

export function advanceQuestObjective(state, questId, completedObjectiveId) {
  const quest = getSideQuest(questId);
  const record = getQuestRecord(state, questId);
  if (!quest || !record || record.status !== QUEST_STATUSES.ACTIVE) {
    return Object.freeze({ ok: false, reason: 'Quest is not active.', state });
  }
  if (record.objectiveIndex >= quest.objectives.length) {
    return Object.freeze({ ok: false, reason: 'Every objective is already recorded.', state });
  }
  const expectedId = objectiveId(quest.objectives[record.objectiveIndex], record.objectiveIndex);
  if (completedObjectiveId !== expectedId) {
    return Object.freeze({ ok: false, reason: `Expected objective ${expectedId}.`, state });
  }
  const replacement = { ...record, objectiveIndex: record.objectiveIndex + 1 };
  const records = state.records.map((entry) => entry.id === questId ? replacement : entry);
  const updated = nextState(state, records);
  return Object.freeze({ ok: true, state: updated, progress: getQuestProgress(updated, questId) });
}

export function completeQuest(state, questId) {
  const quest = getSideQuest(questId);
  const record = getQuestRecord(state, questId);
  if (!quest || !record || record.status !== QUEST_STATUSES.ACTIVE) {
    return Object.freeze({ ok: false, reason: 'Quest is not active.', state });
  }
  if (record.objectiveIndex < quest.objectives.length) {
    return Object.freeze({ ok: false, reason: 'Quest objectives remain.', state });
  }
  const replacement = {
    ...record,
    status: QUEST_STATUSES.COMPLETED,
    completions: record.completions + 1,
  };
  const records = state.records.map((entry) => entry.id === questId ? replacement : entry);
  const updated = nextState(state, records);
  const reward = record.completions > 0 && quest.rewards?.repeat ? quest.rewards.repeat : quest.rewards?.firstClear;
  return Object.freeze({ ok: true, state: updated, reward: reward ?? null, progress: getQuestProgress(updated, questId) });
}

export function validateQuestPayload(payload) {
  const errors = [];
  if (!exactKeys(payload, STATE_KEYS)) errors.push('Save must contain exactly the quest v1 state keys.');
  if (payload?.schemaVersion !== QUEST_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${QUEST_SCHEMA_VERSION}.`);
  if (payload?.campaignId !== CAMPAIGN.id) errors.push(`campaignId must equal ${CAMPAIGN.id}.`);
  if (!Number.isSafeInteger(payload?.revision) || payload.revision < 0) errors.push('revision must be a non-negative safe integer.');
  if (!Array.isArray(payload?.records)) {
    errors.push('records must be an array.');
  } else {
    const ids = new Set();
    payload.records.forEach((record, index) => {
      if (!exactKeys(record, RECORD_KEYS)) errors.push(`records[${index}] has unsupported keys.`);
      const quest = getSideQuest(record?.id);
      if (!quest) errors.push(`records[${index}] has unknown quest ID.`);
      if (ids.has(record?.id)) errors.push(`records[${index}] duplicates ${record.id}.`);
      ids.add(record?.id);
      if (!Object.values(QUEST_STATUSES).includes(record?.status)) errors.push(`records[${index}].status is invalid.`);
      if (!Number.isSafeInteger(record?.objectiveIndex) || record.objectiveIndex < 0 || (quest && record.objectiveIndex > quest.objectives.length)) {
        errors.push(`records[${index}].objectiveIndex is invalid.`);
      }
      if (!Number.isSafeInteger(record?.completions) || record.completions < 0) errors.push(`records[${index}].completions is invalid.`);
      if (record?.status === QUEST_STATUSES.COMPLETED && record?.completions < 1) errors.push(`records[${index}] completed status needs a completion.`);
    });
    const ordered = sortedRecords(payload.records);
    if (ordered.some((record, index) => record.id !== payload.records[index]?.id)) errors.push('records must use canonical quest order.');
  }
  if (errors.length) return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  return Object.freeze({ ok: true, state: freezeState(payload.records, payload.revision), errors: Object.freeze([]) });
}

export function serializeQuestState(state) {
  const validation = validateQuestPayload(state);
  if (!validation.ok) throw new TypeError(validation.errors.join(' '));
  return JSON.stringify(validation.state);
}

export function loadQuestState(serialized) {
  if (serialized == null || serialized === '') return Object.freeze({ ok: true, state: createQuestState(), fresh: true, errors: Object.freeze([]) });
  try {
    const result = validateQuestPayload(JSON.parse(serialized));
    return Object.freeze({ ...result, fresh: false });
  } catch {
    return Object.freeze({ ok: false, fresh: false, errors: Object.freeze(['Quest save is not valid JSON.']) });
  }
}

export function createQuestStorageAdapter(storage = globalThis.localStorage, key = DEFAULT_QUEST_SAVE_KEY) {
  return Object.freeze({
    load() {
      try {
        const loaded = loadQuestState(storage?.getItem?.(key));
        return loaded.ok ? loaded : Object.freeze({ ...loaded, state: createQuestState() });
      } catch {
        return Object.freeze({ ok: false, state: createQuestState(), errors: Object.freeze(['Quest storage could not be read.']) });
      }
    },
    save(state) {
      try {
        storage?.setItem?.(key, serializeQuestState(state));
        return Object.freeze({ ok: true });
      } catch {
        return Object.freeze({ ok: false, errors: Object.freeze(['Quest storage could not be written.']) });
      }
    },
    clear() {
      try {
        storage?.removeItem?.(key);
        return Object.freeze({ ok: true });
      } catch {
        return Object.freeze({ ok: false, errors: Object.freeze(['Quest storage could not be cleared.']) });
      }
    },
  });
}
