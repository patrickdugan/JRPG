/** Immutable finite progress for authored multi-character party councils. */

import { CAMPAIGN } from './content/campaign.mjs';
import { getDefaultBrowserStorage } from './browser-storage.mjs';
import {
  PARTY_COUNCILS,
  getPartyCouncil,
} from './content/party-councils.mjs';
import {
  DEFAULT_PARTY_COUNCIL_SAVE_KEY,
  PARTY_COUNCIL_SAVE_SCHEMA_VERSION,
} from './party-council-contract.mjs';
import {
  DEFAULT_RUN_RECEIPT_SAVE_KEY,
  loadRunReceipt,
} from './run-receipt.mjs';

export { DEFAULT_PARTY_COUNCIL_SAVE_KEY, PARTY_COUNCIL_SAVE_SCHEMA_VERSION };

const STATE_KEYS = Object.freeze(['schemaVersion', 'campaignId', 'runId', 'records', 'revision']);
const RECORD_KEYS = Object.freeze(['id', 'status', 'mainLineIndex', 'choiceId', 'responseLineIndex']);
const COUNCIL_ORDER = new Map(PARTY_COUNCILS.councils.map((council, index) => [council.id, index]));
const UNVERIFIED_RUN_ID = 'unverified';

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

function freezeState(records, revision, runId = UNVERIFIED_RUN_ID) {
  return deepFreeze({
    schemaVersion: PARTY_COUNCIL_SAVE_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    runId,
    records: records.map((record) => ({ ...record })),
    revision,
  });
}

function sortedRecords(records) {
  return [...records].sort((left, right) => COUNCIL_ORDER.get(left.id) - COUNCIL_ORDER.get(right.id));
}

function failed(state, code, reason) {
  return deepFreeze({ ok: false, code, reason, state });
}

function replaceRecord(state, nextRecord) {
  return freezeState(sortedRecords([
    ...state.records.filter((record) => record.id !== nextRecord.id),
    nextRecord,
  ]), state.revision + 1, state.runId);
}

function selectedOption(council, choiceId) {
  return council?.choice.options.find((option) => option.id === choiceId) ?? null;
}

export function createPartyCouncilState(runId = UNVERIFIED_RUN_ID) {
  if (typeof runId !== 'string' || !runId.trim()) throw new TypeError('Party-council runId must be a non-empty string.');
  return freezeState([], 0, runId.trim());
}

export function getPartyCouncilRecord(state, councilId) {
  return state?.records?.find((record) => record.id === councilId) ?? null;
}

export function getPartyCouncilProgress(state, councilId) {
  const council = getPartyCouncil(councilId);
  if (!council) return null;
  const record = getPartyCouncilRecord(state, councilId);
  const mainLineIndex = record?.mainLineIndex ?? 0;
  const option = selectedOption(council, record?.choiceId);
  const responseLineIndex = record?.responseLineIndex ?? 0;
  const status = record?.status ?? 'not-started';
  const phase = status === 'completed'
    ? 'completed'
    : status === 'not-started'
      ? 'not-started'
      : mainLineIndex < council.dialogue.length
        ? 'main-dialogue'
        : !option
          ? 'choice'
          : 'choice-response';
  return deepFreeze({
    council,
    status,
    phase,
    mainLineIndex,
    mainLineCount: council.dialogue.length,
    currentMainLine: phase === 'main-dialogue' ? council.dialogue[mainLineIndex] : null,
    mainDialogueComplete: mainLineIndex === council.dialogue.length,
    choiceId: record?.choiceId ?? null,
    selectedOption: option,
    responseLineIndex,
    responseLineCount: option?.response.length ?? 0,
    currentResponseLine: phase === 'choice-response' ? option.response[responseLineIndex] ?? null : null,
    complete: status === 'completed',
  });
}

export function getPartyCouncilAvailability(state, councilId, context = {}) {
  const council = getPartyCouncil(councilId);
  if (!council) return deepFreeze({ available: false, code: 'unknown-council', reason: 'Unknown party council.' });
  const record = getPartyCouncilRecord(state, councilId);
  if (record?.status === 'active') return deepFreeze({ available: false, code: 'already-active', reason: 'This party council is already active.' });
  if (record?.status === 'completed') return deepFreeze({ available: false, code: 'already-complete', reason: 'This finite party council is already complete.' });
  if (state?.records?.some((candidate) => candidate.status === 'active')) {
    return deepFreeze({ available: false, code: 'another-active', reason: 'Finish the active party council before beginning another.' });
  }
  if (!new Set(context?.campaignState?.completedBeatIds ?? []).has(council.unlockAfterBeatId)) {
    return deepFreeze({ available: false, code: 'beat-locked', reason: `Opens after ${council.unlockAfterBeatId}.` });
  }
  if (context?.campId !== council.campId) {
    return deepFreeze({ available: false, code: 'wrong-camp', reason: `Available at ${council.campId}.` });
  }
  const unlockedMembers = new Set((context?.advancementState?.party ?? [])
    .filter((member) => member.unlocked)
    .map((member) => member.id));
  const lockedParticipants = council.participants.filter((participant) => !unlockedMembers.has(participant));
  if (lockedParticipants.length) {
    return deepFreeze({ available: false, code: 'party-locked', reason: `Party member not yet available: ${lockedParticipants.join(', ')}.` });
  }
  return deepFreeze({ available: true, code: 'available', reason: 'Available.' });
}

export function getAvailablePartyCouncils(state, context = {}) {
  return deepFreeze(PARTY_COUNCILS.councils.filter((council) =>
    getPartyCouncilAvailability(state, council.id, context).available));
}

export function beginPartyCouncil(state, councilId, context = {}) {
  const validation = validatePartyCouncilPayload(state);
  if (!validation.ok) return failed(state, 'invalid-state', validation.errors.join(' '));
  const availability = getPartyCouncilAvailability(validation.state, councilId, context);
  if (!availability.available) return failed(validation.state, availability.code, availability.reason);
  const nextState = replaceRecord(validation.state, {
    id: councilId,
    status: 'active',
    mainLineIndex: 0,
    choiceId: null,
    responseLineIndex: 0,
  });
  return deepFreeze({
    ok: true,
    code: 'council-started',
    state: nextState,
    progress: getPartyCouncilProgress(nextState, councilId),
  });
}

export function acknowledgePartyCouncilLine(state, councilId) {
  const validation = validatePartyCouncilPayload(state);
  if (!validation.ok) return failed(state, 'invalid-state', validation.errors.join(' '));
  const progress = getPartyCouncilProgress(validation.state, councilId);
  if (!progress) return failed(validation.state, 'unknown-council', 'Unknown party council.');
  if (progress.phase !== 'main-dialogue') {
    return failed(validation.state, 'main-dialogue-unavailable', 'No main council line is waiting for acknowledgement.');
  }
  const record = getPartyCouncilRecord(validation.state, councilId);
  const line = progress.currentMainLine;
  const nextState = replaceRecord(validation.state, { ...record, mainLineIndex: record.mainLineIndex + 1 });
  return deepFreeze({
    ok: true,
    code: 'main-line-acknowledged',
    state: nextState,
    line,
    progress: getPartyCouncilProgress(nextState, councilId),
  });
}

export function choosePartyCouncilOption(state, councilId, choiceId) {
  const validation = validatePartyCouncilPayload(state);
  if (!validation.ok) return failed(state, 'invalid-state', validation.errors.join(' '));
  const progress = getPartyCouncilProgress(validation.state, councilId);
  if (!progress) return failed(validation.state, 'unknown-council', 'Unknown party council.');
  if (progress.phase !== 'choice') {
    return failed(validation.state, 'choice-unavailable', 'Finish the main council discussion before choosing.');
  }
  const option = selectedOption(progress.council, choiceId);
  if (!option) return failed(validation.state, 'unknown-choice', 'Choose one of the two authored council decisions.');
  const record = getPartyCouncilRecord(validation.state, councilId);
  const nextState = replaceRecord(validation.state, { ...record, choiceId, responseLineIndex: 0 });
  return deepFreeze({
    ok: true,
    code: 'choice-recorded',
    state: nextState,
    option,
    progress: getPartyCouncilProgress(nextState, councilId),
  });
}

export function acknowledgePartyCouncilResponse(state, councilId) {
  const validation = validatePartyCouncilPayload(state);
  if (!validation.ok) return failed(state, 'invalid-state', validation.errors.join(' '));
  const progress = getPartyCouncilProgress(validation.state, councilId);
  if (!progress) return failed(validation.state, 'unknown-council', 'Unknown party council.');
  if (progress.phase !== 'choice-response' || !progress.currentResponseLine) {
    return failed(validation.state, progress.complete ? 'already-complete' : 'response-unavailable', progress.complete
      ? 'This finite party council is already complete.'
      : 'Choose a council decision before acknowledging its response.');
  }
  const record = getPartyCouncilRecord(validation.state, councilId);
  const line = progress.currentResponseLine;
  const responseLineIndex = record.responseLineIndex + 1;
  const completed = responseLineIndex === progress.responseLineCount;
  const nextState = replaceRecord(validation.state, {
    ...record,
    status: completed ? 'completed' : 'active',
    responseLineIndex,
  });
  return deepFreeze({
    ok: true,
    code: completed ? 'council-complete' : 'response-line-acknowledged',
    state: nextState,
    line,
    consequence: completed ? progress.selectedOption.consequence : null,
    progress: getPartyCouncilProgress(nextState, councilId),
  });
}

export function getPartyCouncilFlags(state) {
  return deepFreeze((state?.records ?? [])
    .filter((record) => record.status === 'completed')
    .map((record) => selectedOption(getPartyCouncil(record.id), record.choiceId)?.consequence.flag)
    .filter(Boolean));
}

export function getPartyCouncilRuntimeMetrics(state) {
  const completed = (state?.records ?? []).filter((record) => record.status === 'completed');
  return deepFreeze({
    councilCount: PARTY_COUNCILS.metrics.councilCount,
    completedCouncilCount: completed.length,
    remainingCouncilCount: PARTY_COUNCILS.metrics.councilCount - completed.length,
    activeCouncilCount: (state?.records ?? []).filter((record) => record.status === 'active').length,
    acknowledgedMainLineCount: (state?.records ?? []).reduce((sum, record) => sum + record.mainLineIndex, 0),
    acknowledgedResponseLineCount: (state?.records ?? []).reduce((sum, record) => sum + record.responseLineIndex, 0),
    choiceCount: (state?.records ?? []).filter((record) => record.choiceId).length,
    complete: completed.length === PARTY_COUNCILS.metrics.councilCount,
  });
}

export function validatePartyCouncilPayload(payload) {
  const errors = [];
  if (!exactKeys(payload, STATE_KEYS)) errors.push('Save must contain exactly the party-council state keys.');
  if (payload?.schemaVersion !== PARTY_COUNCIL_SAVE_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${PARTY_COUNCIL_SAVE_SCHEMA_VERSION}.`);
  if (payload?.campaignId !== CAMPAIGN.id) errors.push(`campaignId must equal ${CAMPAIGN.id}.`);
  if (typeof payload?.runId !== 'string' || !payload.runId.trim()) errors.push('runId must be a non-empty string.');
  if (!Number.isSafeInteger(payload?.revision) || payload.revision < 0) errors.push('revision must be a non-negative safe integer.');
  if (!Array.isArray(payload?.records)) {
    errors.push('records must be an array.');
  } else {
    const seen = new Set();
    let activeCount = 0;
    let expectedRevision = 0;
    payload.records.forEach((record, index) => {
      const label = `record ${index}`;
      const council = getPartyCouncil(record?.id);
      if (!exactKeys(record, RECORD_KEYS)) errors.push(`${label} must contain exactly the party-council record keys.`);
      if (!council) errors.push(`${label} references an unknown party council.`);
      if (seen.has(record?.id)) errors.push(`${label} duplicates ${record?.id}.`);
      seen.add(record?.id);
      if (!['active', 'completed'].includes(record?.status)) errors.push(`${label} has an invalid status.`);
      if (record?.status === 'active') activeCount += 1;
      expectedRevision += 1;
      if (Number.isSafeInteger(record?.mainLineIndex) && record.mainLineIndex >= 0) expectedRevision += record.mainLineIndex;
      if (record?.choiceId !== null) expectedRevision += 1;
      if (Number.isSafeInteger(record?.responseLineIndex) && record.responseLineIndex >= 0) expectedRevision += record.responseLineIndex;
      if (!Number.isSafeInteger(record?.mainLineIndex) || record.mainLineIndex < 0
        || (council && record.mainLineIndex > council.dialogue.length)) {
        errors.push(`${label} has an invalid mainLineIndex.`);
      }
      const option = selectedOption(council, record?.choiceId);
      if (record?.choiceId !== null && !option) errors.push(`${label} has an invalid choiceId.`);
      if (!Number.isSafeInteger(record?.responseLineIndex) || record.responseLineIndex < 0
        || (option && record.responseLineIndex > option.response.length)) {
        errors.push(`${label} has an invalid responseLineIndex.`);
      }
      if (!option && record?.responseLineIndex !== 0) errors.push(`${label} has response progress without a choice.`);
      if (option && record?.mainLineIndex !== council?.dialogue.length) errors.push(`${label} chose before completing main dialogue.`);
      if (record?.status === 'completed' && (!option || record.responseLineIndex !== option.response.length)) {
        errors.push(`${label} completion frontier is incoherent.`);
      }
      if (record?.status === 'active' && option && record.responseLineIndex === option.response.length) {
        errors.push(`${label} should be completed after its final response.`);
      }
    });
    if (activeCount > 1) errors.push('Only one party council may be active.');
    if (Number.isSafeInteger(payload?.revision) && payload.revision !== expectedRevision) {
      errors.push(`revision must equal the ${expectedRevision} successful party-council transitions represented by the save.`);
    }
    const canonical = sortedRecords(payload.records);
    if (canonical.some((record, index) => record.id !== payload.records[index]?.id)) {
      errors.push('records must use canonical party-council order.');
    }
  }
  if (errors.length) return deepFreeze({ ok: false, state: null, errors });
  return deepFreeze({ ok: true, state: freezeState(payload.records, payload.revision, payload.runId), errors: [] });
}

export function serializePartyCouncilState(state) {
  const validation = validatePartyCouncilPayload(state);
  if (!validation.ok) throw new TypeError(`Cannot serialize party-council state: ${validation.errors.join(' ')}`);
  return JSON.stringify(validation.state);
}

export function loadPartyCouncilState(serialized) {
  if (serialized == null || serialized === '') {
    return deepFreeze({ ok: true, state: createPartyCouncilState(), fresh: true, found: false, errors: [] });
  }
  try {
    const validation = validatePartyCouncilPayload(JSON.parse(serialized));
    if (!validation.ok) return deepFreeze({ ...validation, fresh: false, found: true });
    return deepFreeze({ ...validation, fresh: false, found: true });
  } catch {
    return deepFreeze({ ok: false, state: null, fresh: false, found: true, errors: ['Party-council save is not valid JSON.'] });
  }
}

export function createPartyCouncilStorageAdapter(storage = getDefaultBrowserStorage(), key = DEFAULT_PARTY_COUNCIL_SAVE_KEY) {
  let hasObservedStorage = false;
  let lastObservedSerialized = null;
  let hasObservedRunId = false;
  let observedRunId = null;
  let replaceInvalidOnNextSave = false;
  const currentRunId = () => {
    if (typeof storage?.getItem !== 'function') return null;
    const receipt = loadRunReceipt(storage.getItem(DEFAULT_RUN_RECEIPT_SAVE_KEY));
    return receipt.ok && receipt.state ? receipt.state.runId : null;
  };
  return Object.freeze({
    key,
    load() {
      try {
        const serialized = storage?.getItem?.(key);
        hasObservedStorage = true;
        lastObservedSerialized = serialized ?? null;
        hasObservedRunId = true;
        observedRunId = currentRunId();
        const activeRunId = currentRunId() ?? UNVERIFIED_RUN_ID;
        const loaded = loadPartyCouncilState(serialized);
        replaceInvalidOnNextSave = Boolean(serialized && !loaded.ok);
        if (loaded.ok && (!loaded.found || loaded.state.runId !== activeRunId)) {
          return deepFreeze({
            ok: true,
            state: createPartyCouncilState(activeRunId),
            fresh: true,
            found: loaded.found,
            resetForRun: loaded.found,
            errors: loaded.found ? ['Stored party-council progress belongs to a different clean run.'] : [],
          });
        }
        return loaded.ok ? loaded : deepFreeze({ ...loaded, state: createPartyCouncilState(activeRunId) });
      } catch {
        return deepFreeze({ ok: false, state: createPartyCouncilState(currentRunId() ?? UNVERIFIED_RUN_ID), fresh: true, found: false, errors: ['Party-council storage could not be read.'] });
      }
    },
    save(state) {
      try {
        if (typeof storage?.setItem !== 'function') throw new TypeError('Storage has no setItem method.');
        if (typeof storage?.getItem !== 'function') throw new TypeError('Storage has no getItem method.');
        const serialized = serializePartyCouncilState(state);
        const currentSerialized = storage.getItem(key);
        const activeRunId = currentRunId();
        if (hasObservedRunId && activeRunId !== observedRunId) {
          throw new Error('Party-council adapter belongs to a different clean run.');
        }
        hasObservedRunId = true;
        observedRunId = activeRunId;
        const boundRunId = activeRunId ?? UNVERIFIED_RUN_ID;
        if (state.runId !== boundRunId) throw new Error('Party-council state belongs to a different clean run.');
        if (hasObservedStorage && (currentSerialized ?? null) !== lastObservedSerialized) {
          throw new Error('Party-council storage changed after this adapter last observed it.');
        }
        if (replaceInvalidOnNextSave) {
          storage.setItem(key, serialized);
          replaceInvalidOnNextSave = false;
          hasObservedStorage = true;
          lastObservedSerialized = serialized;
          return deepFreeze({ ok: true, errors: [] });
        }
        if (currentSerialized == null || currentSerialized === '') {
          if (state.revision > 1) throw new Error('Cleared party-council storage rejects stale progress.');
        } else {
          const current = loadPartyCouncilState(currentSerialized);
          if (!current.ok || !current.state) throw new Error('Invalid party-council storage cannot be overwritten.');
          if (current.state.runId !== state.runId) {
            storage.setItem(key, serialized);
            hasObservedStorage = true;
            lastObservedSerialized = serialized;
            return deepFreeze({ ok: true, errors: [] });
          }
          if (current.state.revision === state.revision) {
            if (serializePartyCouncilState(current.state) !== serialized) {
              throw new Error('Conflicting party-council states share one revision.');
            }
            hasObservedStorage = true;
            lastObservedSerialized = currentSerialized;
            return deepFreeze({ ok: true, errors: [] });
          }
          if (state.revision !== current.state.revision + 1) {
            throw new Error('Party-council save is stale or skips a persisted transition.');
          }
        }
        storage.setItem(key, serialized);
        hasObservedStorage = true;
        lastObservedSerialized = serialized;
        return deepFreeze({ ok: true, errors: [] });
      } catch {
        return deepFreeze({ ok: false, errors: ['Party-council storage could not be written because it was unavailable, stale, cleared, conflicting, or non-sequential.'] });
      }
    },
    clear() {
      try {
        if (typeof storage?.removeItem !== 'function') throw new TypeError('Storage has no removeItem method.');
        storage.removeItem(key);
        replaceInvalidOnNextSave = false;
        hasObservedStorage = true;
        lastObservedSerialized = null;
        hasObservedRunId = true;
        observedRunId = currentRunId();
        return deepFreeze({ ok: true, errors: [] });
      } catch {
        return deepFreeze({ ok: false, errors: ['Party-council storage could not be cleared.'] });
      }
    },
  });
}
