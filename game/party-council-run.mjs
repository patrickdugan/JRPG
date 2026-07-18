/**
 * Bounded, DOM-free completion witness for every finite party council.
 * Records no elapsed time; proves reachability, line coverage, and replay
 * refusal only.
 */

import { runCanonicalCompletion } from './canonical-run.mjs';
import { PARTY_COUNCILS } from './content/party-councils.mjs';
import {
  acknowledgePartyCouncilLine,
  acknowledgePartyCouncilResponse,
  beginPartyCouncil,
  choosePartyCouncilOption,
  createPartyCouncilState,
  getPartyCouncilAvailability,
  getPartyCouncilFlags,
  getPartyCouncilProgress,
  getPartyCouncilRuntimeMetrics,
} from './party-council-runtime.mjs';

export const PARTY_COUNCIL_RUN_VERSION = 1;
export const DEFAULT_PARTY_COUNCIL_RUN_ID = 'party-council-audit-0001';

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const canonicalResponseLineCount = PARTY_COUNCILS.councils.reduce(
  (sum, council) => sum + council.choice.options[0].response.length,
  0,
);
const requiredTransitionCount = PARTY_COUNCILS.metrics.councilCount
  + PARTY_COUNCILS.metrics.mainLineCount
  + PARTY_COUNCILS.metrics.councilCount
  + canonicalResponseLineCount;
const requiredTraceEventCount = 1 + requiredTransitionCount + PARTY_COUNCILS.metrics.councilCount;

export const PARTY_COUNCIL_RUN_EXPECTATIONS = deepFreeze({
  councilCount: 30,
  mainLineAcknowledgementCount: 993,
  canonicalResponseLineAcknowledgementCount: 90,
  choiceCount: 30,
  replayRefusalCount: 30,
  requiredTransitionCount: 1_143,
  requiredTraceEventCount: 1_174,
});

function validateShippedQuantities() {
  const actual = {
    councilCount: PARTY_COUNCILS.metrics.councilCount,
    mainLineAcknowledgementCount: PARTY_COUNCILS.metrics.mainLineCount,
    canonicalResponseLineAcknowledgementCount: canonicalResponseLineCount,
    choiceCount: PARTY_COUNCILS.metrics.councilCount,
    replayRefusalCount: PARTY_COUNCILS.metrics.councilCount,
    requiredTransitionCount,
    requiredTraceEventCount,
  };
  for (const [key, expected] of Object.entries(PARTY_COUNCIL_RUN_EXPECTATIONS)) {
    if (actual[key] !== expected) throw new Error(`Party-council audit expected ${key}=${expected}, found ${actual[key]}.`);
  }
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function signatureFor(value) {
  return `fnv1a32:${fnv1a32(JSON.stringify(value))}`;
}

const catalogueSignature = signatureFor(PARTY_COUNCILS.councils);

function validateBounds(options) {
  const bounds = {
    maxTransitions: options.maxTransitions ?? requiredTransitionCount,
    maxTraceEvents: options.maxTraceEvents ?? requiredTraceEventCount,
  };
  for (const [name, value] of Object.entries(bounds)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a positive safe integer.`);
  }
  if (bounds.maxTransitions < requiredTransitionCount) {
    throw new RangeError(`maxTransitions must allow the ${requiredTransitionCount} required party-council transitions.`);
  }
  if (bounds.maxTraceEvents < requiredTraceEventCount) {
    throw new RangeError(`maxTraceEvents must allow the ${requiredTraceEventCount} required party-council trace events.`);
  }
  return Object.freeze(bounds);
}

export function runPartyCouncilCompletion(options = {}) {
  validateShippedQuantities();
  const bounds = validateBounds(options);
  const runId = options.runId ?? DEFAULT_PARTY_COUNCIL_RUN_ID;
  if (typeof runId !== 'string' || !runId.trim()) throw new TypeError('runId must be a non-empty string.');

  const canonical = runCanonicalCompletion({ runId });
  if (!canonical.ok || !canonical.fullyIntegrated || !canonical.proof.valid
    || !canonical.proof.campaignComplete || !canonical.proof.firstClearsComplete) {
    throw new Error('Party-council audit requires a fully integrated canonical completion seed.');
  }
  if (canonical.proof.totalMs !== 0 || canonical.proof.durationProven !== false) {
    throw new Error('Canonical party-council seed unexpectedly contains duration evidence.');
  }

  let state = createPartyCouncilState(canonical.states.receipt.runId);
  let transitionCount = 0;
  let mainLineAcknowledgementCount = 0;
  let responseLineAcknowledgementCount = 0;
  let choiceCount = 0;
  let replayRefusalCount = 0;
  const trace = [];
  const emit = (event) => {
    if (trace.length >= bounds.maxTraceEvents) throw new Error(`Party-council trace exceeded ${bounds.maxTraceEvents} events.`);
    trace.push(deepFreeze({ sequence: trace.length + 1, ...event }));
  };
  const execute = (factory, label) => {
    if (transitionCount >= bounds.maxTransitions) throw new Error(`${label} would exceed the ${bounds.maxTransitions}-transition bound.`);
    const result = factory();
    if (!result?.ok) throw new Error(`${label}: ${result?.reason ?? result?.code ?? 'unknown transition failure'}`);
    transitionCount += 1;
    return result;
  };

  emit({ type: 'canonical-seed-accepted', signature: canonical.signature });
  for (const council of PARTY_COUNCILS.councils) {
    const context = {
      campaignState: canonical.states.campaign,
      advancementState: canonical.states.advancement,
      campId: council.campId,
    };
    const availability = getPartyCouncilAvailability(state, council.id, context);
    if (!availability.available) throw new Error(`Party council ${council.id} did not unlock: ${availability.reason}`);
    const begun = execute(() => beginPartyCouncil(state, council.id, context), `begin party council ${council.id}`);
    state = begun.state;
    emit({ type: 'party-council-begun', councilId: council.id, participants: council.participants });

    for (let index = 0; index < council.dialogue.length; index += 1) {
      const acknowledged = execute(
        () => acknowledgePartyCouncilLine(state, council.id),
        `acknowledge council line ${council.id}/${index + 1}`,
      );
      state = acknowledged.state;
      mainLineAcknowledgementCount += 1;
      emit({
        type: 'party-council-main-line-acknowledged',
        councilId: council.id,
        lineNumber: index + 1,
        speaker: acknowledged.line.speaker,
      });
    }

    const option = council.choice.options[0];
    const chosen = execute(
      () => choosePartyCouncilOption(state, council.id, option.id),
      `choose council decision ${council.id}/${option.id}`,
    );
    state = chosen.state;
    choiceCount += 1;
    emit({ type: 'party-council-choice-recorded', councilId: council.id, choiceId: option.id });

    for (let index = 0; index < option.response.length; index += 1) {
      const acknowledged = execute(
        () => acknowledgePartyCouncilResponse(state, council.id),
        `acknowledge council response ${council.id}/${index + 1}`,
      );
      state = acknowledged.state;
      responseLineAcknowledgementCount += 1;
      emit({
        type: acknowledged.code === 'council-complete'
          ? 'party-council-completed'
          : 'party-council-response-line-acknowledged',
        councilId: council.id,
        lineNumber: index + 1,
        speaker: acknowledged.line.speaker,
        consequenceFlag: acknowledged.consequence?.flag ?? null,
      });
    }

    const progress = getPartyCouncilProgress(state, council.id);
    if (!progress?.complete || progress.choiceId !== option.id) {
      throw new Error(`Party council ${council.id} did not settle at its canonical completion frontier.`);
    }
    const replay = beginPartyCouncil(state, council.id, context);
    if (replay.ok || replay.code !== 'already-complete'
      || replay.state.revision !== state.revision
      || signatureFor(replay.state) !== signatureFor(state)) {
      throw new Error(`Party council ${council.id} did not refuse finite replay without mutation.`);
    }
    replayRefusalCount += 1;
    emit({ type: 'party-council-replay-refused', councilId: council.id, reason: replay.reason });
  }

  const runtimeMetrics = getPartyCouncilRuntimeMetrics(state);
  const flags = getPartyCouncilFlags(state);
  if (!runtimeMetrics.complete
    || runtimeMetrics.completedCouncilCount !== PARTY_COUNCILS.metrics.councilCount
    || mainLineAcknowledgementCount !== PARTY_COUNCILS.metrics.mainLineCount
    || responseLineAcknowledgementCount !== canonicalResponseLineCount
    || choiceCount !== PARTY_COUNCILS.metrics.councilCount
    || replayRefusalCount !== PARTY_COUNCILS.metrics.councilCount
    || flags.length !== PARTY_COUNCILS.metrics.councilCount
    || new Set(flags).size !== flags.length
    || transitionCount !== requiredTransitionCount
    || trace.length !== requiredTraceEventCount) {
    throw new Error('Party-council completion totals do not match the shipped finite catalogue.');
  }

  const summary = deepFreeze({
    councilCount: runtimeMetrics.completedCouncilCount,
    mainLineAcknowledgementCount,
    responseLineAcknowledgementCount,
    choiceCount,
    replayRefusalCount,
    transitionCount,
    traceEventCount: trace.length,
    recordedPlaytimeMs: 0,
    durationClaimed: false,
    durationProven: false,
  });
  const frozenTrace = deepFreeze([...trace]);
  const completionProof = deepFreeze({
    valid: true,
    allCouncilsComplete: runtimeMetrics.complete,
    oncePerSaveEnforced: replayRefusalCount === PARTY_COUNCILS.metrics.councilCount,
    canonicalFirstChoiceRecorded: choiceCount === PARTY_COUNCILS.metrics.councilCount,
    durationProven: false,
  });
  const durationEvidence = deepFreeze({
    recordedPlaytimeMs: 0,
    durationClaimed: false,
    durationProven: false,
    statement: 'This party-council witness proves finite state transitions and authored-line coverage only; it is not timed-play evidence.',
  });

  return deepFreeze({
    ok: true,
    version: PARTY_COUNCIL_RUN_VERSION,
    runId,
    signature: signatureFor({ canonical: canonical.signature, catalogue: catalogueSignature, summary, trace: frozenTrace }),
    catalogueSignature,
    summary,
    completionProof,
    durationEvidence,
    canonical: { signature: canonical.signature, proof: canonical.proof },
    catalogueMetrics: PARTY_COUNCILS.metrics,
    flags,
    trace: frozenTrace,
    state,
  });
}
