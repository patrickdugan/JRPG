/**
 * Bounded, DOM-free completion witness for every finite public archive record.
 * Records no elapsed time; proves reachability and paragraph coverage only.
 */

import { runCanonicalCompletion } from './canonical-run.mjs';
import { ARCHIVE_RECORDS } from './content/archive-records.mjs';
import {
  acknowledgeArchiveRecordParagraph,
  beginArchiveRecord,
  createArchiveRecordState,
  getArchiveRecordAvailability,
  getArchiveRecordProgress,
  getArchiveRecordRuntimeMetrics,
} from './archive-record-runtime.mjs';

export const ARCHIVE_RECORD_RUN_VERSION = 1;
export const DEFAULT_ARCHIVE_RECORD_RUN_ID = 'archive-record-audit-0001';

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const requiredTransitionCount = ARCHIVE_RECORDS.metrics.recordCount + ARCHIVE_RECORDS.metrics.paragraphCount;
const requiredTraceEventCount = 1 + requiredTransitionCount + ARCHIVE_RECORDS.metrics.recordCount;

export const ARCHIVE_RECORD_RUN_EXPECTATIONS = deepFreeze({
  recordCount: 60,
  paragraphAcknowledgementCount: 498,
  replayRefusalCount: 60,
  requiredTransitionCount: 558,
  requiredTraceEventCount: 619,
});

function validateShippedQuantities() {
  const actual = {
    recordCount: ARCHIVE_RECORDS.metrics.recordCount,
    paragraphAcknowledgementCount: ARCHIVE_RECORDS.metrics.paragraphCount,
    replayRefusalCount: ARCHIVE_RECORDS.metrics.recordCount,
    requiredTransitionCount,
    requiredTraceEventCount,
  };
  for (const [key, expected] of Object.entries(ARCHIVE_RECORD_RUN_EXPECTATIONS)) {
    if (actual[key] !== expected) {
      throw new Error(`Archive audit expected ${key}=${expected}, found ${actual[key]}.`);
    }
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

const catalogueSignature = signatureFor(ARCHIVE_RECORDS.records);

function validateBounds(options) {
  const bounds = {
    maxTransitions: options.maxTransitions ?? requiredTransitionCount,
    maxTraceEvents: options.maxTraceEvents ?? requiredTraceEventCount,
  };
  for (const [name, value] of Object.entries(bounds)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a positive safe integer.`);
  }
  if (bounds.maxTransitions < requiredTransitionCount) {
    throw new RangeError(`maxTransitions must allow the ${requiredTransitionCount} required archive transitions.`);
  }
  if (bounds.maxTraceEvents < requiredTraceEventCount) {
    throw new RangeError(`maxTraceEvents must allow the ${requiredTraceEventCount} required archive trace events.`);
  }
  return Object.freeze(bounds);
}

export function runArchiveRecordCompletion(options = {}) {
  validateShippedQuantities();
  const bounds = validateBounds(options);
  const runId = options.runId ?? DEFAULT_ARCHIVE_RECORD_RUN_ID;
  if (typeof runId !== 'string' || !runId.trim()) throw new TypeError('runId must be a non-empty string.');

  const canonical = runCanonicalCompletion({ runId });
  if (!canonical.ok || !canonical.fullyIntegrated || !canonical.proof.valid
    || !canonical.proof.campaignComplete || !canonical.proof.firstClearsComplete) {
    throw new Error('Archive audit requires a fully integrated canonical completion seed.');
  }
  if (canonical.proof.totalMs !== 0 || canonical.proof.durationProven !== false) {
    throw new Error('Canonical archive seed unexpectedly contains duration evidence.');
  }

  let state = createArchiveRecordState(canonical.states.receipt.runId);
  let transitionCount = 0;
  let paragraphAcknowledgementCount = 0;
  let replayRefusalCount = 0;
  const trace = [];
  const emit = (event) => {
    if (trace.length >= bounds.maxTraceEvents) throw new Error(`Archive trace exceeded ${bounds.maxTraceEvents} events.`);
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
  const context = { campaignState: canonical.states.campaign };
  for (const record of ARCHIVE_RECORDS.records) {
    const availability = getArchiveRecordAvailability(state, record.id, context);
    if (!availability.available) throw new Error(`Archive record ${record.id} did not unlock: ${availability.reason}`);
    const begun = execute(() => beginArchiveRecord(state, record.id, context), `begin archive record ${record.id}`);
    state = begun.state;
    emit({ type: 'archive-reading-begun', recordId: record.id });
    for (let index = 0; index < record.paragraphs.length; index += 1) {
      const acknowledged = execute(
        () => acknowledgeArchiveRecordParagraph(state, record.id),
        `acknowledge archive paragraph ${record.id}/${index + 1}`,
      );
      state = acknowledged.state;
      paragraphAcknowledgementCount += 1;
      emit({
        type: acknowledged.code === 'archive-reading-complete'
          ? 'archive-reading-completed'
          : 'archive-paragraph-acknowledged',
        recordId: record.id,
        paragraphNumber: index + 1,
      });
    }
    if (!getArchiveRecordProgress(state, record.id)?.complete) {
      throw new Error(`Archive record ${record.id} did not settle at its completion frontier.`);
    }
    const replay = beginArchiveRecord(state, record.id, context);
    if (replay.ok || replay.code !== 'already-complete'
      || replay.state.revision !== state.revision
      || signatureFor(replay.state) !== signatureFor(state)) {
      throw new Error(`Archive record ${record.id} did not refuse finite replay without mutation.`);
    }
    replayRefusalCount += 1;
    emit({ type: 'archive-replay-refused', recordId: record.id, reason: replay.reason });
  }

  const runtimeMetrics = getArchiveRecordRuntimeMetrics(state);
  if (!runtimeMetrics.complete
    || runtimeMetrics.completedRecordCount !== ARCHIVE_RECORDS.metrics.recordCount
    || paragraphAcknowledgementCount !== ARCHIVE_RECORDS.metrics.paragraphCount
    || replayRefusalCount !== ARCHIVE_RECORDS.metrics.recordCount
    || transitionCount !== requiredTransitionCount
    || trace.length !== requiredTraceEventCount) {
    throw new Error('Archive completion totals do not match the shipped finite catalogue.');
  }

  const summary = deepFreeze({
    recordCount: runtimeMetrics.completedRecordCount,
    paragraphAcknowledgementCount,
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
    allRecordsComplete: runtimeMetrics.complete,
    oncePerSaveEnforced: replayRefusalCount === ARCHIVE_RECORDS.metrics.recordCount,
    allParagraphsAcknowledged: paragraphAcknowledgementCount === ARCHIVE_RECORDS.metrics.paragraphCount,
    durationProven: false,
  });
  const durationEvidence = deepFreeze({
    recordedPlaytimeMs: 0,
    durationClaimed: false,
    durationProven: false,
    statement: 'This archive witness proves finite state transitions and paragraph coverage only; it is not timed-play evidence.',
  });

  return deepFreeze({
    ok: true,
    version: ARCHIVE_RECORD_RUN_VERSION,
    runId,
    signature: signatureFor({ canonical: canonical.signature, catalogue: catalogueSignature, summary, trace: frozenTrace }),
    catalogueSignature,
    summary,
    completionProof,
    durationEvidence,
    canonical: { signature: canonical.signature, proof: canonical.proof },
    catalogueMetrics: ARCHIVE_RECORDS.metrics,
    trace: frozenTrace,
    state,
  });
}
