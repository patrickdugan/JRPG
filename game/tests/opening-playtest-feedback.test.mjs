import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OPENING_PLAYTEST_COMPREHENSION_IDS,
  OPENING_PLAYTEST_RATING_IDS,
  OPENING_PLAYTEST_REQUIRED_RATING_IDS,
  OPENING_PLAYTEST_STORAGE_KEY,
  completeOpeningPlaytestSession,
  createOpeningPlaytestEvidence,
  createOpeningPlaytestSession,
  createOpeningPlaytestStorageAdapter,
  recordOpeningPlaytestRestart,
  serializeOpeningPlaytestEvidence,
  submitOpeningPlaytestSession,
  validateOpeningPlaytestSession,
} from '../opening-playtest-feedback.mjs';

function completeSession() {
  const started = createOpeningPlaytestSession({
    candidateCommit: '878f092-dirty',
    runId: 'run-opening-feedback',
    startedAtEpochMs: 1_000,
  });
  const restarted = recordOpeningPlaytestRestart(started, {
    encounterId: 'c1-tithe-hound',
    atEpochMs: 200_000,
  });
  return completeOpeningPlaytestSession(restarted, {
    completedAtEpochMs: 2_101_000,
    activePlaytimeMs: 35 * 60_000,
    completedBeatCount: 18,
    requiredBeatCount: 18,
    openingEncounterWins: {
      'prologue-ashen-bailiff': 1,
      'fp1-mateus': 1,
    },
  });
}

function validResponses() {
  return {
    testerCode: 'blind-01',
    priorExposure: 'none',
    inputDevice: 'keyboard',
    helpNeeded: 'no',
    helpDetails: '',
    comprehension: Object.fromEntries(OPENING_PLAYTEST_COMPREHENSION_IDS.map((id) => (
      [id, `Unprompted answer for ${id}.`]
    ))),
    ratings: Object.fromEntries(OPENING_PLAYTEST_RATING_IDS.map((id) => [id, 4])),
    bestMoment: 'The cells opening after Mateus yielded.',
    confusion: 'The archive route took a moment to read.',
    memorable: 'The Blood Wards breaking.',
    wouldContinue: 'yes',
  };
}

test('opening playtest session records one run, exact timing, and explicit restarts immutably', () => {
  const completed = completeSession();
  assert.equal(completed.status, 'complete');
  assert.equal(completed.candidateCommit, '878f092-dirty');
  assert.equal(completed.runId, 'run-opening-feedback');
  assert.equal(completed.completion.wallClockMs, 2_100_000);
  assert.equal(completed.completion.activePlaytimeMs, 2_100_000);
  assert.equal(completed.completion.completedBeatCount, 18);
  assert.equal(completed.restarts.length, 1);
  assert.equal(completed.restarts[0].encounterId, 'c1-tithe-hound');
  assert.equal(Object.isFrozen(completed), true);
  assert.equal(Object.isFrozen(completed.completion.openingEncounterWins), true);
});

test('submitted evidence preserves unprompted answers while leaving correctness to human review', () => {
  const submitted = submitOpeningPlaytestSession(completeSession(), validResponses(), {
    submittedAtEpochMs: 2_200_000,
  });
  const evidence = createOpeningPlaytestEvidence(submitted);
  assert.equal(evidence.kind, 'bells-opening-blind-playtest-evidence');
  assert.equal(evidence.restartCount, 1);
  assert.equal(evidence.automaticChecks.timeWithinThirtyToFortyFiveMinutes, true);
  assert.equal(evidence.automaticChecks.noOutsideHelpSelfReported, true);
  assert.equal(evidence.automaticChecks.noPriorExposureSelfReported, true);
  assert.equal(evidence.automaticChecks.requiredRatingsAtLeastFour, true);
  assert.equal(evidence.automaticChecks.averageRating, 4);
  assert.equal(evidence.verdict, 'human-review-required');
  assert.match(evidence.proofBoundary, /does not declare the slice polished/u);
  assert.match(serializeOpeningPlaytestEvidence(submitted), /"verdict": "human-review-required"/u);
});

test('feedback validation rejects coached, incomplete, or out-of-range response structures', () => {
  const incomplete = validResponses();
  incomplete.comprehension.mateus = '';
  assert.throws(() => submitOpeningPlaytestSession(completeSession(), incomplete), /mateus is required/u);

  const outOfRange = validResponses();
  outOfRange.ratings.controls = 6;
  assert.throws(() => submitOpeningPlaytestSession(completeSession(), outOfRange), /controls must be rated/u);

  const unexplainedHelp = validResponses();
  unexplainedHelp.helpNeeded = 'yes';
  assert.throws(() => submitOpeningPlaytestSession(completeSession(), unexplainedHelp), /help details is required/u);

  assert.throws(
    () => submitOpeningPlaytestSession(createOpeningPlaytestSession({
      candidateCommit: '878f092',
      runId: 'unfinished',
      startedAtEpochMs: 1,
    }), validResponses()),
    /only after the slice is complete/iu,
  );
});

test('the session-storage adapter round-trips valid state and fails closed on malformed evidence', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const adapter = createOpeningPlaytestStorageAdapter(storage);
  assert.deepEqual(adapter.load(), { ok: true, found: false, state: null });
  const session = completeSession();
  assert.equal(adapter.save(session).ok, true);
  assert.equal(adapter.load().state.runId, session.runId);
  values.set(OPENING_PLAYTEST_STORAGE_KEY, '{"status":"submitted"}');
  assert.equal(adapter.load().ok, false);
  assert.equal(adapter.clear().ok, true);
  assert.deepEqual(adapter.load(), { ok: true, found: false, state: null });
});

test('validation owns the exact question and rating vocabulary', () => {
  assert.deepEqual(OPENING_PLAYTEST_COMPREHENSION_IDS, [
    'cast', 'persecution', 'takamine', 'mateus', 'duel', 'recovery', 'next',
  ]);
  assert.deepEqual(OPENING_PLAYTEST_RATING_IDS, [
    'goalClarity', 'controls', 'telegraphs', 'tagging', 'ayaHealing',
    'characterVoices', 'desireToContinue', 'pacing',
  ]);
  assert.deepEqual(OPENING_PLAYTEST_REQUIRED_RATING_IDS, [
    'goalClarity', 'controls', 'characterVoices', 'desireToContinue',
  ]);
  assert.equal(validateOpeningPlaytestSession(completeSession()).ok, true);
  const malformed = structuredClone(completeSession());
  malformed.completion.wallClockMs += 1;
  assert.equal(validateOpeningPlaytestSession(malformed).ok, false);
  const premature = structuredClone(createOpeningPlaytestSession({
    candidateCommit: '878f092',
    runId: 'premature',
    startedAtEpochMs: 1,
  }));
  premature.completion = structuredClone(completeSession().completion);
  assert.equal(validateOpeningPlaytestSession(premature).ok, false);
});
