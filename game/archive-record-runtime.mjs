/** Immutable finite reading progress for the public archive catalogue. */

import { CAMPAIGN } from './content/campaign.mjs';
import { getDefaultBrowserStorage } from './browser-storage.mjs';
import {
  ARCHIVE_RECORDS,
  getArchiveRecord,
} from './content/archive-records.mjs';
import {
  ARCHIVE_RECORD_SAVE_SCHEMA_VERSION,
  DEFAULT_ARCHIVE_RECORD_SAVE_KEY,
} from './archive-record-contract.mjs';
import {
  DEFAULT_RUN_RECEIPT_SAVE_KEY,
  loadRunReceipt,
} from './run-receipt.mjs';

export { ARCHIVE_RECORD_SAVE_SCHEMA_VERSION, DEFAULT_ARCHIVE_RECORD_SAVE_KEY };

const STATE_KEYS = Object.freeze(['schemaVersion', 'campaignId', 'runId', 'records', 'revision']);
const RECORD_KEYS = Object.freeze(['id', 'status', 'paragraphIndex']);
const RECORD_ORDER = new Map(ARCHIVE_RECORDS.records.map((record, index) => [record.id, index]));
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
    schemaVersion: ARCHIVE_RECORD_SAVE_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    runId,
    records: records.map((record) => ({ ...record })),
    revision,
  });
}

function sortedRecords(records) {
  return [...records].sort((left, right) => RECORD_ORDER.get(left.id) - RECORD_ORDER.get(right.id));
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

export function createArchiveRecordState(runId = UNVERIFIED_RUN_ID) {
  if (typeof runId !== 'string' || !runId.trim()) throw new TypeError('Archive-record runId must be a non-empty string.');
  return freezeState([], 0, runId.trim());
}

export function getArchiveRecordProgressRecord(state, recordId) {
  return state?.records?.find((record) => record.id === recordId) ?? null;
}

export function getArchiveRecordProgress(state, recordId) {
  const archiveRecord = getArchiveRecord(recordId);
  if (!archiveRecord) return null;
  const progressRecord = getArchiveRecordProgressRecord(state, recordId);
  const status = progressRecord?.status ?? 'not-started';
  const paragraphIndex = progressRecord?.paragraphIndex ?? 0;
  const phase = status === 'completed' ? 'completed' : status === 'active' ? 'reading' : 'not-started';
  return deepFreeze({
    record: archiveRecord,
    status,
    phase,
    paragraphIndex,
    paragraphCount: archiveRecord.paragraphs.length,
    currentParagraph: phase === 'reading' ? archiveRecord.paragraphs[paragraphIndex] ?? null : null,
    complete: status === 'completed',
  });
}

export function getArchiveRecordAvailability(state, recordId, context = {}) {
  const archiveRecord = getArchiveRecord(recordId);
  if (!archiveRecord) return deepFreeze({ available: false, code: 'unknown-record', reason: 'Unknown archive record.' });
  const progressRecord = getArchiveRecordProgressRecord(state, recordId);
  if (progressRecord?.status === 'active') return deepFreeze({ available: false, code: 'already-active', reason: 'This archive reading is already active.' });
  if (progressRecord?.status === 'completed') return deepFreeze({ available: false, code: 'already-complete', reason: 'This finite archive reading is already complete.' });
  if (state?.records?.some((record) => record.status === 'active')) {
    return deepFreeze({ available: false, code: 'another-active', reason: 'Finish the active archive reading before beginning another.' });
  }
  if (!new Set(context?.campaignState?.completedBeatIds ?? []).has(archiveRecord.unlockAfterBeatId)) {
    return deepFreeze({ available: false, code: 'beat-locked', reason: `Opens after ${archiveRecord.unlockAfterBeatId}.` });
  }
  return deepFreeze({ available: true, code: 'available', reason: 'Available.' });
}

export function getAvailableArchiveRecords(state, context = {}) {
  return deepFreeze(ARCHIVE_RECORDS.records.filter((record) =>
    getArchiveRecordAvailability(state, record.id, context).available));
}

export function beginArchiveRecord(state, recordId, context = {}) {
  const validation = validateArchiveRecordPayload(state);
  if (!validation.ok) return failed(state, 'invalid-state', validation.errors.join(' '));
  const availability = getArchiveRecordAvailability(validation.state, recordId, context);
  if (!availability.available) return failed(validation.state, availability.code, availability.reason);
  const nextState = replaceRecord(validation.state, { id: recordId, status: 'active', paragraphIndex: 0 });
  return deepFreeze({
    ok: true,
    code: 'archive-reading-started',
    state: nextState,
    progress: getArchiveRecordProgress(nextState, recordId),
  });
}

export function acknowledgeArchiveRecordParagraph(state, recordId) {
  const validation = validateArchiveRecordPayload(state);
  if (!validation.ok) return failed(state, 'invalid-state', validation.errors.join(' '));
  const progress = getArchiveRecordProgress(validation.state, recordId);
  if (!progress) return failed(validation.state, 'unknown-record', 'Unknown archive record.');
  if (progress.phase !== 'reading' || !progress.currentParagraph) {
    return failed(validation.state, progress.complete ? 'already-complete' : 'paragraph-unavailable', progress.complete
      ? 'This finite archive reading is already complete.'
      : 'No archive paragraph is waiting for acknowledgement.');
  }
  const progressRecord = getArchiveRecordProgressRecord(validation.state, recordId);
  const paragraph = progress.currentParagraph;
  const paragraphIndex = progressRecord.paragraphIndex + 1;
  const completed = paragraphIndex === progress.paragraphCount;
  const nextState = replaceRecord(validation.state, {
    ...progressRecord,
    status: completed ? 'completed' : 'active',
    paragraphIndex,
  });
  return deepFreeze({
    ok: true,
    code: completed ? 'archive-reading-complete' : 'archive-paragraph-acknowledged',
    state: nextState,
    paragraph,
    progress: getArchiveRecordProgress(nextState, recordId),
  });
}

export function getArchiveRecordRuntimeMetrics(state) {
  const completed = (state?.records ?? []).filter((record) => record.status === 'completed');
  return deepFreeze({
    recordCount: ARCHIVE_RECORDS.metrics.recordCount,
    completedRecordCount: completed.length,
    remainingRecordCount: ARCHIVE_RECORDS.metrics.recordCount - completed.length,
    activeRecordCount: (state?.records ?? []).filter((record) => record.status === 'active').length,
    acknowledgedParagraphCount: (state?.records ?? []).reduce((sum, record) => sum + record.paragraphIndex, 0),
    complete: completed.length === ARCHIVE_RECORDS.metrics.recordCount,
  });
}

export function validateArchiveRecordPayload(payload) {
  const errors = [];
  if (!exactKeys(payload, STATE_KEYS)) errors.push('Save must contain exactly the archive-record state keys.');
  if (payload?.schemaVersion !== ARCHIVE_RECORD_SAVE_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${ARCHIVE_RECORD_SAVE_SCHEMA_VERSION}.`);
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
      const archiveRecord = getArchiveRecord(record?.id);
      if (!exactKeys(record, RECORD_KEYS)) errors.push(`${label} must contain exactly the archive progress keys.`);
      if (!archiveRecord) errors.push(`${label} references an unknown archive record.`);
      if (seen.has(record?.id)) errors.push(`${label} duplicates ${record?.id}.`);
      seen.add(record?.id);
      if (!['active', 'completed'].includes(record?.status)) errors.push(`${label} has an invalid status.`);
      if (record?.status === 'active') activeCount += 1;
      expectedRevision += 1;
      if (Number.isSafeInteger(record?.paragraphIndex) && record.paragraphIndex >= 0) expectedRevision += record.paragraphIndex;
      if (!Number.isSafeInteger(record?.paragraphIndex) || record.paragraphIndex < 0
        || (archiveRecord && record.paragraphIndex > archiveRecord.paragraphs.length)) {
        errors.push(`${label} has an invalid paragraphIndex.`);
      }
      if (record?.status === 'completed' && archiveRecord && record.paragraphIndex !== archiveRecord.paragraphs.length) {
        errors.push(`${label} completion frontier is incoherent.`);
      }
      if (record?.status === 'active' && archiveRecord && record.paragraphIndex >= archiveRecord.paragraphs.length) {
        errors.push(`${label} should be completed after its final paragraph.`);
      }
    });
    if (activeCount > 1) errors.push('Only one archive reading may be active.');
    if (Number.isSafeInteger(payload?.revision) && payload.revision !== expectedRevision) {
      errors.push(`revision must equal the ${expectedRevision} successful archive transitions represented by the save.`);
    }
    const canonical = sortedRecords(payload.records);
    if (canonical.some((record, index) => record.id !== payload.records[index]?.id)) errors.push('records must use canonical archive order.');
  }
  if (errors.length) return deepFreeze({ ok: false, state: null, errors });
  return deepFreeze({ ok: true, state: freezeState(payload.records, payload.revision, payload.runId), errors: [] });
}

export function serializeArchiveRecordState(state) {
  const validation = validateArchiveRecordPayload(state);
  if (!validation.ok) throw new TypeError(`Cannot serialize archive-record state: ${validation.errors.join(' ')}`);
  return JSON.stringify(validation.state);
}

export function loadArchiveRecordState(serialized) {
  if (serialized == null || serialized === '') {
    return deepFreeze({ ok: true, state: createArchiveRecordState(), fresh: true, found: false, errors: [] });
  }
  try {
    const validation = validateArchiveRecordPayload(JSON.parse(serialized));
    if (!validation.ok) return deepFreeze({ ...validation, fresh: false, found: true });
    return deepFreeze({ ...validation, fresh: false, found: true });
  } catch {
    return deepFreeze({ ok: false, state: null, fresh: false, found: true, errors: ['Archive-record save is not valid JSON.'] });
  }
}

export function createArchiveRecordStorageAdapter(storage = getDefaultBrowserStorage(), key = DEFAULT_ARCHIVE_RECORD_SAVE_KEY) {
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
        const loaded = loadArchiveRecordState(serialized);
        replaceInvalidOnNextSave = Boolean(serialized && !loaded.ok);
        if (loaded.ok && (!loaded.found || loaded.state.runId !== activeRunId)) {
          return deepFreeze({
            ok: true,
            state: createArchiveRecordState(activeRunId),
            fresh: true,
            found: loaded.found,
            resetForRun: loaded.found,
            errors: loaded.found ? ['Stored archive-record progress belongs to a different clean run.'] : [],
          });
        }
        return loaded.ok ? loaded : deepFreeze({ ...loaded, state: createArchiveRecordState(activeRunId) });
      } catch {
        return deepFreeze({ ok: false, state: createArchiveRecordState(currentRunId() ?? UNVERIFIED_RUN_ID), fresh: true, found: false, errors: ['Archive-record storage could not be read.'] });
      }
    },
    save(state) {
      try {
        if (typeof storage?.setItem !== 'function') throw new TypeError('Storage has no setItem method.');
        if (typeof storage?.getItem !== 'function') throw new TypeError('Storage has no getItem method.');
        const serialized = serializeArchiveRecordState(state);
        const currentSerialized = storage.getItem(key);
        const activeRunId = currentRunId();
        if (hasObservedRunId && activeRunId !== observedRunId) {
          throw new Error('Archive-record adapter belongs to a different clean run.');
        }
        hasObservedRunId = true;
        observedRunId = activeRunId;
        const boundRunId = activeRunId ?? UNVERIFIED_RUN_ID;
        if (state.runId !== boundRunId) throw new Error('Archive-record state belongs to a different clean run.');
        if (hasObservedStorage && (currentSerialized ?? null) !== lastObservedSerialized) {
          throw new Error('Archive-record storage changed after this adapter last observed it.');
        }
        if (replaceInvalidOnNextSave) {
          storage.setItem(key, serialized);
          replaceInvalidOnNextSave = false;
          hasObservedStorage = true;
          lastObservedSerialized = serialized;
          return deepFreeze({ ok: true, errors: [] });
        }
        if (currentSerialized == null || currentSerialized === '') {
          if (state.revision > 1) throw new Error('Cleared archive-record storage rejects stale progress.');
        } else {
          const current = loadArchiveRecordState(currentSerialized);
          if (!current.ok || !current.state) throw new Error('Invalid archive-record storage cannot be overwritten.');
          if (current.state.runId !== state.runId) {
            storage.setItem(key, serialized);
            hasObservedStorage = true;
            lastObservedSerialized = serialized;
            return deepFreeze({ ok: true, errors: [] });
          }
          if (current.state.revision === state.revision) {
            if (serializeArchiveRecordState(current.state) !== serialized) {
              throw new Error('Conflicting archive-record states share one revision.');
            }
            hasObservedStorage = true;
            lastObservedSerialized = currentSerialized;
            return deepFreeze({ ok: true, errors: [] });
          }
          if (state.revision !== current.state.revision + 1) {
            throw new Error('Archive-record save is stale or skips a persisted transition.');
          }
        }
        storage.setItem(key, serialized);
        hasObservedStorage = true;
        lastObservedSerialized = serialized;
        return deepFreeze({ ok: true, errors: [] });
      } catch {
        return deepFreeze({ ok: false, errors: ['Archive-record storage could not be written because it was unavailable, stale, cleared, conflicting, or non-sequential.'] });
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
        return deepFreeze({ ok: false, errors: ['Archive-record storage could not be cleared.'] });
      }
    },
  });
}
