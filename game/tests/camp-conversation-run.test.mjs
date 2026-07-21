import assert from 'node:assert/strict';
import test from 'node:test';

import { CAMP_CONVERSATIONS } from '../content/camp-conversations.mjs';
import {
  CAMP_CONVERSATION_RUN_EXPECTATIONS,
  runCampConversationCompletion,
} from '../camp-conversation-run.mjs';

const EXACT_BOUNDS = {
  maxTransitions: CAMP_CONVERSATION_RUN_EXPECTATIONS.requiredTransitionCount,
  maxTraceEvents: CAMP_CONVERSATION_RUN_EXPECTATIONS.requiredTraceEventCount,
};
const RUN = runCampConversationCompletion(EXACT_BOUNDS);

function recursivelyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => recursivelyFrozen(child, seen));
}

test('all finite camp conversations complete deterministically at exact hard bounds', () => {
  const replay = runCampConversationCompletion(EXACT_BOUNDS);
  assert.equal(RUN.ok, true);
  assert.equal(RUN.signature, 'fnv1a32:e5fb2c5e');
  assert.equal(RUN.catalogueSignature, 'fnv1a32:3fdaa62f');
  assert.equal(replay.signature, RUN.signature);
  assert.deepEqual(replay.summary, RUN.summary);
  assert.deepEqual(replay.trace, RUN.trace);
  assert.equal(RUN.trace.length, CAMP_CONVERSATION_RUN_EXPECTATIONS.requiredTraceEventCount);
  assert.equal(recursivelyFrozen(RUN), true);
});

test('all 15 pairings and 90 conversations expose every canonical line and first response', () => {
  assert.equal(RUN.summary.conversationCount, 90);
  assert.equal(RUN.summary.pairCount, 15);
  assert.equal(RUN.summary.mainLineAcknowledgementCount, CAMP_CONVERSATIONS.metrics.mainLineCount);
  assert.equal(
    RUN.summary.responseLineAcknowledgementCount,
    CAMP_CONVERSATION_RUN_EXPECTATIONS.canonicalResponseLineAcknowledgementCount,
  );
  assert.equal(RUN.summary.choiceCount, 90);
  assert.equal(RUN.state.revision, CAMP_CONVERSATION_RUN_EXPECTATIONS.requiredTransitionCount);
  assert.deepEqual(RUN.state.records.map(({ id }) => id), CAMP_CONVERSATIONS.conversations.map(({ id }) => id));
  assert.ok(RUN.state.records.every((record, index) => (
    record.status === 'completed'
    && record.mainLineIndex === CAMP_CONVERSATIONS.conversations[index].dialogue.length
    && record.choiceId === CAMP_CONVERSATIONS.conversations[index].choice.options[0].id
    && record.responseLineIndex === CAMP_CONVERSATIONS.conversations[index].choice.options[0].response.length
  )));
  assert.equal(RUN.flags.length, 90);
  assert.equal(new Set(RUN.flags).size, 90);
});

test('every conversation refuses replay and the witness claims no elapsed time', () => {
  assert.equal(RUN.summary.replayRefusalCount, 90);
  assert.equal(RUN.trace.filter(({ type }) => type === 'camp-conversation-replay-refused').length, 90);
  assert.equal(RUN.summary.recordedPlaytimeMs, 0);
  assert.equal(RUN.summary.durationClaimed, false);
  assert.equal(RUN.summary.durationProven, false);
  assert.equal(RUN.canonical.proof.totalMs, 0);
  assert.equal(RUN.canonical.proof.durationProven, false);
  assert.deepEqual(RUN.durationEvidence, {
    recordedPlaytimeMs: 0,
    durationClaimed: false,
    durationProven: false,
    statement: 'This camp-conversation witness proves finite state transitions and authored-line coverage only; it is not timed-play evidence.',
  });
  assert.equal('estimatedMinutes' in RUN.summary, false);
});

test('invalid and insufficient camp-conversation bounds fail closed', () => {
  assert.throws(() => runCampConversationCompletion({ maxTransitions: 0 }), /positive safe integer/);
  assert.throws(
    () => runCampConversationCompletion({
      maxTransitions: CAMP_CONVERSATION_RUN_EXPECTATIONS.requiredTransitionCount - 1,
    }),
    /must allow the .* required camp-conversation transitions/,
  );
  assert.throws(
    () => runCampConversationCompletion({
      maxTraceEvents: CAMP_CONVERSATION_RUN_EXPECTATIONS.requiredTraceEventCount - 1,
    }),
    /must allow the .* required camp-conversation trace events/,
  );
  assert.throws(() => runCampConversationCompletion({ runId: '' }), /runId must be a non-empty string/);
});
