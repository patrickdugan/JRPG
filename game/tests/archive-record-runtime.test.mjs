import assert from 'node:assert/strict';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import { ARCHIVE_RECORDS } from '../content/archive-records.mjs';
import {
  acknowledgeArchiveRecordParagraph,
  beginArchiveRecord,
  createArchiveRecordState,
  createArchiveRecordStorageAdapter,
  getArchiveRecordAvailability,
  getArchiveRecordProgress,
  getArchiveRecordRuntimeMetrics,
  loadArchiveRecordState,
  serializeArchiveRecordState,
  validateArchiveRecordPayload,
} from '../archive-record-runtime.mjs';

const ALL_BEATS = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => beat.id));
const context = (completedBeatIds = ALL_BEATS) => ({ campaignState: { completedBeatIds } });

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function completeRecord(state, record) {
  let result = beginArchiveRecord(state, record.id, context());
  assert.equal(result.ok, true, result.reason);
  state = result.state;
  for (const expected of record.paragraphs) {
    result = acknowledgeArchiveRecordParagraph(state, record.id);
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.paragraph, expected);
    state = result.state;
  }
  assert.equal(result.code, 'archive-reading-complete');
  return state;
}

test('archive availability requires its completed story beat and one active reading at a time', () => {
  const first = ARCHIVE_RECORDS.records[0];
  const second = ARCHIVE_RECORDS.records[1];
  let state = createArchiveRecordState();
  assert.equal(getArchiveRecordAvailability(state, first.id, context([])).code, 'beat-locked');
  assert.equal(getArchiveRecordAvailability(state, first.id, context()).available, true);
  state = beginArchiveRecord(state, first.id, context()).state;
  assert.equal(getArchiveRecordAvailability(state, first.id, context()).code, 'already-active');
  assert.equal(getArchiveRecordAvailability(state, second.id, context()).code, 'another-active');
});

test('one archive record exposes every paragraph, completes once, and refuses replay', () => {
  const record = ARCHIVE_RECORDS.records[0];
  let state = createArchiveRecordState();
  state = completeRecord(state, record);
  const progress = getArchiveRecordProgress(state, record.id);
  assert.equal(progress.complete, true);
  assert.equal(progress.paragraphIndex, record.paragraphs.length);
  assert.equal(beginArchiveRecord(state, record.id, context()).code, 'already-complete');
  assert.equal(acknowledgeArchiveRecordParagraph(state, record.id).code, 'already-complete');
});

test('all 60 finite records complete in canonical order with exact paragraph metrics', () => {
  let state = createArchiveRecordState();
  for (const record of ARCHIVE_RECORDS.records) state = completeRecord(state, record);
  const metrics = getArchiveRecordRuntimeMetrics(state);
  assert.equal(metrics.recordCount, 60);
  assert.equal(metrics.completedRecordCount, 60);
  assert.equal(metrics.acknowledgedParagraphCount, ARCHIVE_RECORDS.metrics.paragraphCount);
  assert.equal(metrics.complete, true);
  assert.deepEqual(state.records.map(({ id }) => id), ARCHIVE_RECORDS.records.map(({ id }) => id));
  assert.equal(Object.isFrozen(state.records[0]), true);
});

test('versioned archive payload and storage round-trip and reject incoherent frontiers', () => {
  const record = ARCHIVE_RECORDS.records[0];
  const state = beginArchiveRecord(createArchiveRecordState(), record.id, context()).state;
  const loaded = loadArchiveRecordState(serializeArchiveRecordState(state));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state, state);
  assert.equal(loadArchiveRecordState('{bad').ok, false);
  assert.equal(validateArchiveRecordPayload({
    ...state,
    records: [{ ...state.records[0], status: 'completed', paragraphIndex: 0 }],
  }).ok, false);
  assert.equal(validateArchiveRecordPayload({ ...state, revision: 0 }).ok, false);

  const storage = memoryStorage();
  const adapter = createArchiveRecordStorageAdapter(storage, 'test.archive-records');
  assert.equal(adapter.save(state).ok, true);
  assert.equal(adapter.save(state).ok, true, 'an identical lifecycle no-op remains safe');
  assert.deepEqual(adapter.load().state, state);
  const advanced = acknowledgeArchiveRecordParagraph(state, record.id).state;
  assert.equal(adapter.save(advanced).ok, true);
  assert.equal(adapter.save(state).ok, false, 'an older tab cannot roll persisted progress back');
  assert.equal(adapter.clear().ok, true);
  assert.equal(adapter.save(advanced).ok, false, 'cleared storage rejects stale multi-transition resurrection');
  assert.equal(adapter.load().found, false);
  const resetStorage = memoryStorage();
  const staleTab = createArchiveRecordStorageAdapter(resetStorage, 'test.archive-reset');
  assert.equal(staleTab.save(state).ok, true);
  resetStorage.removeItem('test.archive-reset');
  assert.equal(staleTab.save(state).ok, false, 'external New Game clearing invalidates the stale adapter even at revision one');
  const unavailable = createArchiveRecordStorageAdapter({}, 'test.unavailable');
  assert.equal(unavailable.save(state).ok, false);
  assert.equal(unavailable.clear().ok, false);
});
