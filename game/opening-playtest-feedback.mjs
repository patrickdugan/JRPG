export const OPENING_PLAYTEST_SCHEMA_VERSION = 1;
export const OPENING_PLAYTEST_STORAGE_KEY = 'bells.opening-playtest.v1';

export const OPENING_PLAYTEST_COMPREHENSION_IDS = Object.freeze([
  'cast',
  'persecution',
  'takamine',
  'mateus',
  'duel',
  'recovery',
  'next',
]);

export const OPENING_PLAYTEST_RATING_IDS = Object.freeze([
  'goalClarity',
  'controls',
  'telegraphs',
  'tagging',
  'ayaHealing',
  'characterVoices',
  'desireToContinue',
  'pacing',
]);

export const OPENING_PLAYTEST_REQUIRED_RATING_IDS = Object.freeze([
  'goalClarity',
  'controls',
  'characterVoices',
  'desireToContinue',
]);

const INPUT_DEVICES = Object.freeze(['keyboard', 'gamepad', 'touch', 'mixed', 'other']);
const YES_NO = Object.freeze(['yes', 'no']);
const CONTINUE_ANSWERS = Object.freeze(['yes', 'maybe', 'no']);
const EXPOSURE_ANSWERS = Object.freeze(['none', 'some']);
const STATUS_VALUES = Object.freeze(['active', 'complete', 'submitted']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function boundedText(value, label, {
  required = true,
  maximumLength = 4_000,
} = {}) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new TypeError(`${label} is required.`);
  if (text.length > maximumLength) throw new RangeError(`${label} exceeds ${maximumLength} characters.`);
  return text;
}

function finiteInteger(value, label, { minimum = 0 } = {}) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${label} must be an integer of at least ${minimum}.`);
  }
  return value;
}

function enumValue(value, options, label) {
  const normalized = String(value ?? '');
  if (!options.includes(normalized)) throw new RangeError(`${label} is not a supported value.`);
  return normalized;
}

function normalizeCandidateCommit(value) {
  const candidate = boundedText(value || 'unknown', 'Candidate build', { maximumLength: 80 });
  if (!/^[a-zA-Z0-9._-]+$/u.test(candidate)) {
    throw new TypeError('Candidate build contains unsupported characters.');
  }
  return candidate;
}

function normalizeRatings(ratings = {}) {
  return Object.fromEntries(OPENING_PLAYTEST_RATING_IDS.map((id) => {
    const rating = Number(ratings[id]);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new RangeError(`${id} must be rated from 1 to 5.`);
    }
    return [id, rating];
  }));
}

function normalizeComprehension(comprehension = {}) {
  return Object.fromEntries(OPENING_PLAYTEST_COMPREHENSION_IDS.map((id) => (
    [id, boundedText(comprehension[id], `Comprehension answer ${id}`)]
  )));
}

function normalizeResponses(responses = {}) {
  const helpNeeded = enumValue(responses.helpNeeded, YES_NO, 'Outside-help response');
  const helpDetails = boundedText(responses.helpDetails, 'Outside-help details', {
    required: helpNeeded === 'yes',
    maximumLength: 2_000,
  });
  return {
    testerCode: boundedText(responses.testerCode, 'Tester code', {
      required: false,
      maximumLength: 80,
    }),
    priorExposure: enumValue(responses.priorExposure, EXPOSURE_ANSWERS, 'Prior-exposure response'),
    inputDevice: enumValue(responses.inputDevice, INPUT_DEVICES, 'Input device'),
    helpNeeded,
    helpDetails,
    comprehension: normalizeComprehension(responses.comprehension),
    ratings: normalizeRatings(responses.ratings),
    bestMoment: boundedText(responses.bestMoment, 'Best moment'),
    confusion: boundedText(responses.confusion, 'Most confusing or tedious moment'),
    memorable: boundedText(responses.memorable, 'Most memorable line, mechanic, or image'),
    wouldContinue: enumValue(responses.wouldContinue, CONTINUE_ANSWERS, 'Continue response'),
  };
}

export function createOpeningPlaytestSession({
  candidateCommit = 'unknown',
  runId,
  startedAtEpochMs = Date.now(),
} = {}) {
  return deepFreeze({
    schemaVersion: OPENING_PLAYTEST_SCHEMA_VERSION,
    kind: 'bells-opening-blind-playtest-session',
    candidateCommit: normalizeCandidateCommit(candidateCommit),
    runId: boundedText(runId, 'Run ID', { maximumLength: 160 }),
    status: 'active',
    startedAtEpochMs: finiteInteger(startedAtEpochMs, 'Start timestamp', { minimum: 1 }),
    completion: null,
    restarts: [],
    responses: null,
    submittedAtEpochMs: null,
  });
}

export function recordOpeningPlaytestRestart(state, {
  encounterId,
  atEpochMs = Date.now(),
} = {}) {
  const validation = validateOpeningPlaytestSession(state);
  if (!validation.ok || validation.state.status !== 'active') return validation.ok ? validation.state : state;
  return deepFreeze({
    ...validation.state,
    restarts: [
      ...validation.state.restarts,
      {
        encounterId: boundedText(encounterId, 'Restart encounter ID', { maximumLength: 160 }),
        atEpochMs: finiteInteger(atEpochMs, 'Restart timestamp', { minimum: validation.state.startedAtEpochMs }),
      },
    ],
  });
}

export function completeOpeningPlaytestSession(state, {
  completedAtEpochMs = Date.now(),
  activePlaytimeMs,
  completedBeatCount,
  requiredBeatCount,
  openingEncounterWins,
} = {}) {
  const validation = validateOpeningPlaytestSession(state);
  if (!validation.ok) throw new TypeError(`Invalid opening playtest session: ${validation.errors.join(' ')}`);
  if (validation.state.status !== 'active') return validation.state;
  const completedAt = finiteInteger(completedAtEpochMs, 'Completion timestamp', {
    minimum: validation.state.startedAtEpochMs,
  });
  const wins = Object.fromEntries(Object.entries(openingEncounterWins ?? {}).map(([encounterId, count]) => (
    [boundedText(encounterId, 'Opening encounter ID', { maximumLength: 160 }), finiteInteger(count, 'Encounter win count')]
  )));
  return deepFreeze({
    ...validation.state,
    status: 'complete',
    completion: {
      completedAtEpochMs: completedAt,
      wallClockMs: completedAt - validation.state.startedAtEpochMs,
      activePlaytimeMs: finiteInteger(activePlaytimeMs, 'Active playtime'),
      completedBeatCount: finiteInteger(completedBeatCount, 'Completed opening beat count'),
      requiredBeatCount: finiteInteger(requiredBeatCount, 'Required opening beat count', { minimum: 1 }),
      openingEncounterWins: wins,
    },
  });
}

export function submitOpeningPlaytestSession(state, responses, {
  submittedAtEpochMs = Date.now(),
} = {}) {
  const validation = validateOpeningPlaytestSession(state);
  if (!validation.ok) throw new TypeError(`Invalid opening playtest session: ${validation.errors.join(' ')}`);
  if (validation.state.status !== 'complete') {
    throw new RangeError('Opening feedback can be submitted only after the slice is complete.');
  }
  return deepFreeze({
    ...validation.state,
    status: 'submitted',
    responses: normalizeResponses(responses),
    submittedAtEpochMs: finiteInteger(submittedAtEpochMs, 'Submission timestamp', {
      minimum: validation.state.completion.completedAtEpochMs,
    }),
  });
}

export function validateOpeningPlaytestSession(candidate) {
  const errors = [];
  try {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new TypeError('Opening playtest session must be an object.');
    }
    if (candidate.schemaVersion !== OPENING_PLAYTEST_SCHEMA_VERSION) {
      throw new RangeError(`Unsupported opening playtest schema ${candidate.schemaVersion}.`);
    }
    if (candidate.kind !== 'bells-opening-blind-playtest-session') {
      throw new TypeError('Opening playtest session kind is invalid.');
    }
    const normalized = {
      schemaVersion: OPENING_PLAYTEST_SCHEMA_VERSION,
      kind: candidate.kind,
      candidateCommit: normalizeCandidateCommit(candidate.candidateCommit),
      runId: boundedText(candidate.runId, 'Run ID', { maximumLength: 160 }),
      status: enumValue(candidate.status, STATUS_VALUES, 'Session status'),
      startedAtEpochMs: finiteInteger(candidate.startedAtEpochMs, 'Start timestamp', { minimum: 1 }),
      completion: null,
      restarts: [],
      responses: null,
      submittedAtEpochMs: null,
    };
    if (!Array.isArray(candidate.restarts)) throw new TypeError('Restart records must be an array.');
    normalized.restarts = candidate.restarts.map((restart) => ({
      encounterId: boundedText(restart?.encounterId, 'Restart encounter ID', { maximumLength: 160 }),
      atEpochMs: finiteInteger(restart?.atEpochMs, 'Restart timestamp', {
        minimum: normalized.startedAtEpochMs,
      }),
    }));
    if (normalized.status === 'active' && candidate.completion != null) {
      throw new TypeError('Active session cannot contain completion evidence.');
    }
    if (normalized.status !== 'active') {
      const completion = candidate.completion;
      if (!completion || typeof completion !== 'object') throw new TypeError('Completed session lacks completion evidence.');
      const completedAtEpochMs = finiteInteger(completion.completedAtEpochMs, 'Completion timestamp', {
        minimum: normalized.startedAtEpochMs,
      });
      const openingEncounterWins = {};
      if (!completion.openingEncounterWins || typeof completion.openingEncounterWins !== 'object') {
        throw new TypeError('Completed session lacks opening encounter wins.');
      }
      for (const [encounterId, count] of Object.entries(completion.openingEncounterWins)) {
        openingEncounterWins[boundedText(encounterId, 'Opening encounter ID', { maximumLength: 160 })] = finiteInteger(
          count,
          'Encounter win count',
        );
      }
      normalized.completion = {
        completedAtEpochMs,
        wallClockMs: finiteInteger(completion.wallClockMs, 'Wall-clock duration'),
        activePlaytimeMs: finiteInteger(completion.activePlaytimeMs, 'Active playtime'),
        completedBeatCount: finiteInteger(completion.completedBeatCount, 'Completed opening beat count'),
        requiredBeatCount: finiteInteger(completion.requiredBeatCount, 'Required opening beat count', { minimum: 1 }),
        openingEncounterWins,
      };
      if (normalized.completion.completedBeatCount > normalized.completion.requiredBeatCount) {
        throw new RangeError('Completed opening beat count cannot exceed its required count.');
      }
      if (normalized.completion.wallClockMs !== completedAtEpochMs - normalized.startedAtEpochMs) {
        throw new RangeError('Wall-clock duration does not match the session timestamps.');
      }
    }
    if (normalized.status === 'submitted') {
      normalized.responses = normalizeResponses(candidate.responses);
      normalized.submittedAtEpochMs = finiteInteger(candidate.submittedAtEpochMs, 'Submission timestamp', {
        minimum: normalized.completion.completedAtEpochMs,
      });
    } else if (candidate.responses != null || candidate.submittedAtEpochMs != null) {
      throw new TypeError('Unsubmitted session cannot contain submitted feedback.');
    }
    return Object.freeze({ ok: true, state: deepFreeze(normalized), errors: Object.freeze([]) });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Opening playtest session is invalid.');
    return Object.freeze({ ok: false, state: null, errors: Object.freeze(errors) });
  }
}

export function createOpeningPlaytestEvidence(state) {
  const validation = validateOpeningPlaytestSession(state);
  if (!validation.ok || validation.state.status !== 'submitted') {
    throw new RangeError('Only submitted opening feedback can become evidence.');
  }
  const session = validation.state;
  const ratingValues = OPENING_PLAYTEST_RATING_IDS.map((id) => session.responses.ratings[id]);
  const requiredRatingsPass = OPENING_PLAYTEST_REQUIRED_RATING_IDS.every((id) => (
    session.responses.ratings[id] >= 4
  ));
  const timeWithinTarget = session.completion.activePlaytimeMs >= 30 * 60_000
    && session.completion.activePlaytimeMs <= 45 * 60_000;
  return deepFreeze({
    schemaVersion: OPENING_PLAYTEST_SCHEMA_VERSION,
    kind: 'bells-opening-blind-playtest-evidence',
    candidateCommit: session.candidateCommit,
    runId: session.runId,
    startedAtEpochMs: session.startedAtEpochMs,
    completedAtEpochMs: session.completion.completedAtEpochMs,
    submittedAtEpochMs: session.submittedAtEpochMs,
    wallClockMs: session.completion.wallClockMs,
    activePlaytimeMs: session.completion.activePlaytimeMs,
    completedBeatCount: session.completion.completedBeatCount,
    requiredBeatCount: session.completion.requiredBeatCount,
    openingEncounterWins: session.completion.openingEncounterWins,
    restartCount: session.restarts.length,
    restarts: session.restarts,
    responses: session.responses,
    automaticChecks: {
      timeWithinThirtyToFortyFiveMinutes: timeWithinTarget,
      noOutsideHelpSelfReported: session.responses.helpNeeded === 'no',
      noPriorExposureSelfReported: session.responses.priorExposure === 'none',
      requiredRatingsAtLeastFour: requiredRatingsPass,
      averageRating: Math.round((ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length) * 100) / 100,
    },
    verdict: 'human-review-required',
    proofBoundary: 'Free-text comprehension, observed stalls, and whether confusion defined the run require review by someone other than the tester. This receipt does not declare the slice polished by itself.',
  });
}

export function serializeOpeningPlaytestEvidence(state) {
  return `${JSON.stringify(createOpeningPlaytestEvidence(state), null, 2)}\n`;
}

export function createOpeningPlaytestStorageAdapter(storage = globalThis.sessionStorage) {
  return Object.freeze({
    load() {
      let serialized;
      try {
        serialized = storage.getItem(OPENING_PLAYTEST_STORAGE_KEY);
      } catch (error) {
        return Object.freeze({ ok: false, found: false, state: null, error: String(error) });
      }
      if (serialized == null) return Object.freeze({ ok: true, found: false, state: null });
      try {
        const validation = validateOpeningPlaytestSession(JSON.parse(serialized));
        return validation.ok
          ? Object.freeze({ ok: true, found: true, state: validation.state })
          : Object.freeze({ ok: false, found: true, state: null, error: validation.errors.join(' ') });
      } catch (error) {
        return Object.freeze({ ok: false, found: true, state: null, error: String(error) });
      }
    },
    save(state) {
      const validation = validateOpeningPlaytestSession(state);
      if (!validation.ok) return Object.freeze({ ok: false, error: validation.errors.join(' ') });
      try {
        storage.setItem(OPENING_PLAYTEST_STORAGE_KEY, JSON.stringify(validation.state));
        return Object.freeze({ ok: true, state: validation.state });
      } catch (error) {
        return Object.freeze({ ok: false, error: String(error) });
      }
    },
    clear() {
      try {
        storage.removeItem(OPENING_PLAYTEST_STORAGE_KEY);
        return Object.freeze({ ok: true });
      } catch (error) {
        return Object.freeze({ ok: false, error: String(error) });
      }
    },
  });
}
