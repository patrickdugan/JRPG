import assert from 'node:assert/strict';
import test from 'node:test';

import { PARTY_COUNCILS } from '../content/party-councils.mjs';
import {
  PARTY_COUNCIL_RUN_EXPECTATIONS,
  runPartyCouncilCompletion,
} from '../party-council-run.mjs';

const EXACT_BOUNDS = {
  maxTransitions: PARTY_COUNCIL_RUN_EXPECTATIONS.requiredTransitionCount,
  maxTraceEvents: PARTY_COUNCIL_RUN_EXPECTATIONS.requiredTraceEventCount,
};
const RUN = runPartyCouncilCompletion(EXACT_BOUNDS);

function recursivelyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => recursivelyFrozen(child, seen));
}

test('all finite party councils complete deterministically at exact hard bounds', () => {
  const replay = runPartyCouncilCompletion(EXACT_BOUNDS);
  assert.equal(RUN.ok, true);
  assert.equal(RUN.signature, 'fnv1a32:51f4030c');
  assert.equal(RUN.catalogueSignature, 'fnv1a32:01bf3c11');
  assert.equal(replay.signature, RUN.signature);
  assert.deepEqual(replay.summary, RUN.summary);
  assert.deepEqual(replay.trace, RUN.trace);
  assert.equal(RUN.trace.length, PARTY_COUNCIL_RUN_EXPECTATIONS.requiredTraceEventCount);
  assert.equal(recursivelyFrozen(RUN), true);
});

test('all thirty councils expose every selected line once and preserve canonical order', () => {
  assert.equal(RUN.summary.councilCount, 30);
  assert.equal(RUN.summary.mainLineAcknowledgementCount, PARTY_COUNCILS.metrics.mainLineCount);
  assert.equal(RUN.summary.responseLineAcknowledgementCount, PARTY_COUNCILS.playableMetrics.selectedResponseLineCount);
  assert.equal(RUN.state.revision, PARTY_COUNCIL_RUN_EXPECTATIONS.requiredTransitionCount);
  assert.deepEqual(RUN.state.records.map(({ id }) => id), PARTY_COUNCILS.councils.map(({ id }) => id));
  assert.ok(RUN.state.records.every((record, index) => (
    record.status === 'completed'
    && record.mainLineIndex === PARTY_COUNCILS.councils[index].dialogue.length
    && record.choiceId === PARTY_COUNCILS.councils[index].choice.options[0].id
    && record.responseLineIndex === PARTY_COUNCILS.councils[index].choice.options[0].response.length
  )));
});

test('every council refuses replay and the witness claims no elapsed time', () => {
  assert.equal(RUN.summary.choiceCount, 30);
  assert.equal(RUN.summary.replayRefusalCount, 30);
  assert.equal(RUN.trace.filter(({ type }) => type === 'party-council-replay-refused').length, 30);
  assert.equal(RUN.summary.recordedPlaytimeMs, 0);
  assert.equal(RUN.summary.durationClaimed, false);
  assert.equal(RUN.summary.durationProven, false);
  assert.equal(RUN.canonical.proof.totalMs, 0);
  assert.equal(RUN.canonical.proof.durationProven, false);
  assert.equal('estimatedMinutes' in RUN.summary, false);
});

test('invalid and insufficient council bounds fail closed', () => {
  assert.throws(() => runPartyCouncilCompletion({ maxTransitions: 0 }), /positive safe integer/);
  assert.throws(() => runPartyCouncilCompletion({
    maxTransitions: PARTY_COUNCIL_RUN_EXPECTATIONS.requiredTransitionCount - 1,
  }), /must allow the .* required party-council transitions/);
  assert.throws(() => runPartyCouncilCompletion({
    maxTraceEvents: PARTY_COUNCIL_RUN_EXPECTATIONS.requiredTraceEventCount - 1,
  }), /must allow the .* required party-council trace events/);
  assert.throws(() => runPartyCouncilCompletion({ runId: '' }), /runId must be a non-empty string/);
});
