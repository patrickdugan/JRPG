import assert from 'node:assert/strict';
import test from 'node:test';

import { ARCHIVE_RECORDS } from '../content/archive-records.mjs';
import {
  ARCHIVE_RECORD_RUN_EXPECTATIONS,
  runArchiveRecordCompletion,
} from '../archive-record-run.mjs';

const EXACT_BOUNDS = {
  maxTransitions: ARCHIVE_RECORD_RUN_EXPECTATIONS.requiredTransitionCount,
  maxTraceEvents: ARCHIVE_RECORD_RUN_EXPECTATIONS.requiredTraceEventCount,
};
const RUN = runArchiveRecordCompletion(EXACT_BOUNDS);

function recursivelyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => recursivelyFrozen(child, seen));
}

test('all finite archive records complete deterministically at exact hard bounds', () => {
  const replay = runArchiveRecordCompletion(EXACT_BOUNDS);
  assert.equal(RUN.ok, true);
  assert.equal(RUN.signature, 'fnv1a32:c61b184f');
  assert.equal(RUN.catalogueSignature, 'fnv1a32:92ea7832');
  assert.equal(replay.signature, RUN.signature);
  assert.deepEqual(replay.summary, RUN.summary);
  assert.deepEqual(replay.trace, RUN.trace);
  assert.equal(RUN.trace.length, ARCHIVE_RECORD_RUN_EXPECTATIONS.requiredTraceEventCount);
  assert.equal(recursivelyFrozen(RUN), true);
});

test('all 60 records expose every paragraph once and preserve canonical order', () => {
  assert.equal(RUN.summary.recordCount, 60);
  assert.equal(RUN.summary.paragraphAcknowledgementCount, ARCHIVE_RECORDS.metrics.paragraphCount);
  assert.equal(RUN.state.revision, ARCHIVE_RECORD_RUN_EXPECTATIONS.requiredTransitionCount);
  assert.deepEqual(RUN.state.records.map(({ id }) => id), ARCHIVE_RECORDS.records.map(({ id }) => id));
  assert.ok(RUN.state.records.every((progressRecord, index) => (
    progressRecord.status === 'completed'
    && progressRecord.paragraphIndex === ARCHIVE_RECORDS.records[index].paragraphs.length
  )));
});

test('all records refuse replay and claim no elapsed time', () => {
  assert.equal(RUN.summary.replayRefusalCount, 60);
  assert.equal(RUN.trace.filter(({ type }) => type === 'archive-replay-refused').length, 60);
  assert.equal(RUN.summary.recordedPlaytimeMs, 0);
  assert.equal(RUN.summary.durationClaimed, false);
  assert.equal(RUN.summary.durationProven, false);
  assert.equal(RUN.canonical.proof.totalMs, 0);
  assert.equal(RUN.canonical.proof.durationProven, false);
  assert.equal('estimatedMinutes' in RUN.summary, false);
});

test('invalid and insufficient archive bounds fail closed', () => {
  assert.throws(() => runArchiveRecordCompletion({ maxTransitions: 0 }), /positive safe integer/);
  assert.throws(() => runArchiveRecordCompletion({
    maxTransitions: ARCHIVE_RECORD_RUN_EXPECTATIONS.requiredTransitionCount - 1,
  }), /must allow the .* required archive transitions/);
  assert.throws(() => runArchiveRecordCompletion({
    maxTraceEvents: ARCHIVE_RECORD_RUN_EXPECTATIONS.requiredTraceEventCount - 1,
  }), /must allow the .* required archive trace events/);
  assert.throws(() => runArchiveRecordCompletion({ runId: '' }), /runId must be a non-empty string/);
});
