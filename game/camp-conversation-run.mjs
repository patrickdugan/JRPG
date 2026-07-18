/**
 * Bounded, DOM-free completion witness for every finite camp conversation.
 *
 * This harness uses the public conversation transitions against a completed
 * canonical campaign seed. It records no elapsed time and is evidence of
 * reachability and finite state coverage only, never campaign duration.
 */

import { runCanonicalCompletion } from './canonical-run.mjs';
import {
  CAMP_CONVERSATION_METRICS,
  CAMP_CONVERSATIONS,
} from './content/camp-conversations.mjs';
import {
  acknowledgeCampConversationLine,
  acknowledgeCampConversationResponse,
  beginCampConversation,
  chooseCampConversationOption,
  createCampConversationState,
  getCampConversationAvailability,
  getCampConversationFlags,
  getCampConversationProgress,
  getCampConversationRuntimeMetrics,
} from './camp-conversation-runtime.mjs';

export const CAMP_CONVERSATION_RUN_VERSION = 1;
export const DEFAULT_CAMP_CONVERSATION_RUN_ID = 'camp-conversation-audit-0001';

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const canonicalResponseLineCount = CAMP_CONVERSATIONS.conversations.reduce(
  (sum, conversation) => sum + conversation.choice.options[0].response.length,
  0,
);
const requiredTransitionCount = CAMP_CONVERSATION_METRICS.conversationCount
  + CAMP_CONVERSATION_METRICS.mainLineCount
  + CAMP_CONVERSATION_METRICS.conversationCount
  + canonicalResponseLineCount;
const requiredTraceEventCount = 1 + requiredTransitionCount + CAMP_CONVERSATION_METRICS.conversationCount;

export const CAMP_CONVERSATION_RUN_EXPECTATIONS = deepFreeze({
  conversationCount: 90,
  pairCount: 15,
  mainLineAcknowledgementCount: 3_644,
  canonicalResponseLineAcknowledgementCount: 270,
  choiceCount: 90,
  replayRefusalCount: 90,
  requiredTransitionCount: 4_094,
  requiredTraceEventCount: 4_185,
});

function validateShippedQuantities() {
  const actual = {
    conversationCount: CAMP_CONVERSATION_METRICS.conversationCount,
    pairCount: CAMP_CONVERSATION_METRICS.pairCount,
    mainLineAcknowledgementCount: CAMP_CONVERSATION_METRICS.mainLineCount,
    canonicalResponseLineAcknowledgementCount: canonicalResponseLineCount,
    choiceCount: CAMP_CONVERSATION_METRICS.conversationCount,
    replayRefusalCount: CAMP_CONVERSATION_METRICS.conversationCount,
    requiredTransitionCount,
    requiredTraceEventCount,
  };
  for (const [key, expected] of Object.entries(CAMP_CONVERSATION_RUN_EXPECTATIONS)) {
    if (actual[key] !== expected) {
      throw new Error(`Camp-conversation audit expected ${key}=${expected}, found ${actual[key]}.`);
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

const catalogueSignature = signatureFor(CAMP_CONVERSATIONS.conversations);

function validateBounds(options) {
  const bounds = {
    maxTransitions: options.maxTransitions ?? requiredTransitionCount,
    maxTraceEvents: options.maxTraceEvents ?? requiredTraceEventCount,
  };
  for (const [name, value] of Object.entries(bounds)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`${name} must be a positive safe integer.`);
    }
  }
  if (bounds.maxTransitions < requiredTransitionCount) {
    throw new RangeError(`maxTransitions must allow the ${requiredTransitionCount} required camp-conversation transitions.`);
  }
  if (bounds.maxTraceEvents < requiredTraceEventCount) {
    throw new RangeError(`maxTraceEvents must allow the ${requiredTraceEventCount} required camp-conversation trace events.`);
  }
  return Object.freeze(bounds);
}

function failureDetail(result) {
  return result?.reason ?? result?.code ?? 'unknown transition failure';
}

export function runCampConversationCompletion(options = {}) {
  validateShippedQuantities();
  const bounds = validateBounds(options);
  const runId = options.runId ?? DEFAULT_CAMP_CONVERSATION_RUN_ID;
  if (typeof runId !== 'string' || !runId.trim()) throw new TypeError('runId must be a non-empty string.');

  const canonical = runCanonicalCompletion({ runId });
  if (!canonical.ok || !canonical.fullyIntegrated || !canonical.proof.valid
    || !canonical.proof.campaignComplete || !canonical.proof.firstClearsComplete) {
    throw new Error('Camp-conversation audit requires a fully integrated canonical completion seed.');
  }
  if (canonical.proof.totalMs !== 0 || canonical.proof.durationProven !== false) {
    throw new Error('Canonical camp-conversation seed unexpectedly contains duration evidence.');
  }

  let state = createCampConversationState(canonical.states.receipt.runId);
  let transitionCount = 0;
  let mainLineAcknowledgementCount = 0;
  let responseLineAcknowledgementCount = 0;
  let choiceCount = 0;
  let replayRefusalCount = 0;
  const trace = [];

  const emit = (event) => {
    if (trace.length >= bounds.maxTraceEvents) {
      throw new Error(`Camp-conversation trace exceeded ${bounds.maxTraceEvents} events.`);
    }
    trace.push(deepFreeze({ sequence: trace.length + 1, ...event }));
  };
  const execute = (factory, label) => {
    if (transitionCount >= bounds.maxTransitions) {
      throw new Error(`${label} would exceed the ${bounds.maxTransitions}-transition bound.`);
    }
    const result = factory();
    if (!result?.ok) throw new Error(`${label}: ${failureDetail(result)}`);
    transitionCount += 1;
    return result;
  };

  emit({ type: 'canonical-seed-accepted', signature: canonical.signature });

  for (const conversation of CAMP_CONVERSATIONS.conversations) {
    const context = {
      campaignState: canonical.states.campaign,
      advancementState: canonical.states.advancement,
      campId: conversation.campId,
    };
    const availability = getCampConversationAvailability(state, conversation.id, context);
    if (!availability.available) {
      throw new Error(`Camp conversation ${conversation.id} did not unlock: ${availability.reason}`);
    }

    const begun = execute(
      () => beginCampConversation(state, conversation.id, context),
      `begin camp conversation ${conversation.id}`,
    );
    state = begun.state;
    emit({ type: 'camp-conversation-begun', conversationId: conversation.id, pairId: conversation.pairId });

    for (let index = 0; index < conversation.dialogue.length; index += 1) {
      const acknowledged = execute(
        () => acknowledgeCampConversationLine(state, conversation.id),
        `acknowledge camp line ${conversation.id}/${index + 1}`,
      );
      state = acknowledged.state;
      mainLineAcknowledgementCount += 1;
      emit({
        type: 'camp-main-line-acknowledged',
        conversationId: conversation.id,
        lineNumber: index + 1,
        speaker: acknowledged.line.speaker,
      });
    }

    const option = conversation.choice.options[0];
    const chosen = execute(
      () => chooseCampConversationOption(state, conversation.id, option.id),
      `choose camp response ${conversation.id}/${option.id}`,
    );
    state = chosen.state;
    choiceCount += 1;
    emit({ type: 'camp-choice-recorded', conversationId: conversation.id, choiceId: option.id });

    for (let index = 0; index < option.response.length; index += 1) {
      const acknowledged = execute(
        () => acknowledgeCampConversationResponse(state, conversation.id),
        `acknowledge camp response ${conversation.id}/${index + 1}`,
      );
      state = acknowledged.state;
      responseLineAcknowledgementCount += 1;
      emit({
        type: acknowledged.code === 'conversation-complete'
          ? 'camp-conversation-completed'
          : 'camp-response-line-acknowledged',
        conversationId: conversation.id,
        lineNumber: index + 1,
        speaker: acknowledged.line.speaker,
        consequenceFlag: acknowledged.consequence?.flag ?? null,
      });
    }

    const progress = getCampConversationProgress(state, conversation.id);
    if (!progress?.complete || progress.choiceId !== option.id) {
      throw new Error(`Camp conversation ${conversation.id} did not settle at its canonical completion frontier.`);
    }
    const replay = beginCampConversation(state, conversation.id, context);
    if (replay.ok || replay.code !== 'already-complete'
      || replay.state.revision !== state.revision
      || signatureFor(replay.state) !== signatureFor(state)) {
      throw new Error(`Camp conversation ${conversation.id} did not refuse finite replay without mutation.`);
    }
    replayRefusalCount += 1;
    emit({ type: 'camp-conversation-replay-refused', conversationId: conversation.id, reason: replay.reason });
  }

  const runtimeMetrics = getCampConversationRuntimeMetrics(state);
  const flags = getCampConversationFlags(state);
  if (!runtimeMetrics.complete
    || runtimeMetrics.completedConversationCount !== CAMP_CONVERSATION_METRICS.conversationCount
    || transitionCount !== requiredTransitionCount
    || trace.length !== requiredTraceEventCount
    || mainLineAcknowledgementCount !== CAMP_CONVERSATION_METRICS.mainLineCount
    || responseLineAcknowledgementCount !== canonicalResponseLineCount
    || choiceCount !== CAMP_CONVERSATION_METRICS.conversationCount
    || replayRefusalCount !== CAMP_CONVERSATION_METRICS.conversationCount
    || flags.length !== CAMP_CONVERSATION_METRICS.conversationCount
    || new Set(flags).size !== flags.length) {
    throw new Error('Camp-conversation completion totals do not match the shipped finite catalogue.');
  }

  const summary = deepFreeze({
    conversationCount: runtimeMetrics.completedConversationCount,
    pairCount: CAMP_CONVERSATION_METRICS.pairCount,
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
    allConversationsComplete: runtimeMetrics.complete,
    allPairsComplete: runtimeMetrics.completedConversationCount === CAMP_CONVERSATION_METRICS.conversationCount,
    oncePerSaveEnforced: replayRefusalCount === CAMP_CONVERSATION_METRICS.conversationCount,
    canonicalFirstChoiceRecorded: choiceCount === CAMP_CONVERSATION_METRICS.conversationCount,
    durationProven: false,
  });
  const durationEvidence = deepFreeze({
    recordedPlaytimeMs: 0,
    durationClaimed: false,
    durationProven: false,
    statement: 'This camp-conversation witness proves finite state transitions and authored-line coverage only; it is not timed-play evidence.',
  });

  return deepFreeze({
    ok: true,
    version: CAMP_CONVERSATION_RUN_VERSION,
    runId,
    signature: signatureFor({ canonical: canonical.signature, catalogue: catalogueSignature, summary, trace: frozenTrace }),
    catalogueSignature,
    summary,
    completionProof,
    durationEvidence,
    canonical: {
      signature: canonical.signature,
      proof: canonical.proof,
    },
    catalogueMetrics: CAMP_CONVERSATION_METRICS,
    flags,
    trace: frozenTrace,
    state,
  });
}
