/** Immutable finite progress for the party's two-person camp conversations. */

import { CAMPAIGN } from './content/campaign.mjs';
import { getDefaultBrowserStorage } from './browser-storage.mjs';
import {
  CAMP_CONVERSATIONS,
  getCampConversation,
} from './content/camp-conversations.mjs';
import {
  CAMP_CONVERSATION_SAVE_SCHEMA_VERSION,
  DEFAULT_CAMP_CONVERSATION_SAVE_KEY,
  getCampConversationPlan,
} from './camp-conversation-contract.mjs';
import {
  DEFAULT_RUN_RECEIPT_SAVE_KEY,
  loadRunReceipt,
} from './run-receipt.mjs';

export { CAMP_CONVERSATION_SAVE_SCHEMA_VERSION, DEFAULT_CAMP_CONVERSATION_SAVE_KEY };

const STATE_KEYS = Object.freeze(['schemaVersion', 'campaignId', 'runId', 'records', 'revision']);
const RECORD_KEYS = Object.freeze(['id', 'status', 'mainLineIndex', 'choiceId', 'responseLineIndex']);
const CONVERSATION_ORDER = new Map(CAMP_CONVERSATIONS.conversations.map((conversation, index) => [conversation.id, index]));
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
    schemaVersion: CAMP_CONVERSATION_SAVE_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    runId,
    records: records.map((record) => ({ ...record })),
    revision,
  });
}

function sortedRecords(records) {
  return [...records].sort((left, right) => CONVERSATION_ORDER.get(left.id) - CONVERSATION_ORDER.get(right.id));
}

function failed(state, code, reason, details = {}) {
  return deepFreeze({ ok: false, code, reason, state, ...details });
}

function replaceRecord(state, nextRecord) {
  const records = state.records.filter((record) => record.id !== nextRecord.id);
  records.push(nextRecord);
  return freezeState(sortedRecords(records), state.revision + 1, state.runId);
}

export function createCampConversationState(runId = UNVERIFIED_RUN_ID) {
  if (typeof runId !== 'string' || !runId.trim()) throw new TypeError('Camp-conversation runId must be a non-empty string.');
  return freezeState([], 0, runId.trim());
}

export function getCampConversationRecord(state, conversationId) {
  return state?.records?.find((record) => record.id === conversationId) ?? null;
}

function selectedOption(conversation, choiceId) {
  return conversation?.choice.options.find((option) => option.id === choiceId) ?? null;
}

export function getCampConversationProgress(state, conversationId) {
  const conversation = getCampConversation(conversationId);
  if (!conversation) return null;
  const record = getCampConversationRecord(state, conversationId);
  const mainLineIndex = record?.mainLineIndex ?? 0;
  const option = selectedOption(conversation, record?.choiceId);
  const responseLineIndex = record?.responseLineIndex ?? 0;
  const status = record?.status ?? 'not-started';
  const phase = status === 'completed'
    ? 'completed'
    : status === 'not-started'
      ? 'not-started'
      : mainLineIndex < conversation.dialogue.length
        ? 'main-dialogue'
        : !option
          ? 'choice'
          : 'choice-response';
  return deepFreeze({
    conversation,
    status,
    phase,
    mainLineIndex,
    mainLineCount: conversation.dialogue.length,
    currentMainLine: phase === 'main-dialogue' ? conversation.dialogue[mainLineIndex] : null,
    mainDialogueComplete: mainLineIndex === conversation.dialogue.length,
    choiceId: record?.choiceId ?? null,
    selectedOption: option,
    responseLineIndex,
    responseLineCount: option?.response.length ?? 0,
    currentResponseLine: phase === 'choice-response' ? option.response[responseLineIndex] ?? null : null,
    complete: status === 'completed',
  });
}

function previousConversation(conversation) {
  if (conversation.sequence <= 1) return null;
  const plan = getCampConversationPlan(conversation.pairId);
  const previousId = plan?.conversations[conversation.sequence - 2]?.id;
  return previousId ? getCampConversation(previousId) : null;
}

export function getCampConversationAvailability(state, conversationId, context = {}) {
  const conversation = getCampConversation(conversationId);
  if (!conversation) return deepFreeze({ available: false, code: 'unknown-conversation', reason: 'Unknown camp conversation.' });
  const record = getCampConversationRecord(state, conversationId);
  if (record?.status === 'active') return deepFreeze({ available: false, code: 'already-active', reason: 'This camp conversation is already active.' });
  if (record?.status === 'completed') return deepFreeze({ available: false, code: 'already-complete', reason: 'This finite camp conversation is already complete.' });
  if (state?.records?.some((candidate) => candidate.status === 'active')) {
    return deepFreeze({ available: false, code: 'another-active', reason: 'Finish the active camp conversation before beginning another.' });
  }
  const completedBeats = new Set(context?.campaignState?.completedBeatIds ?? []);
  if (!completedBeats.has(conversation.unlockAfterBeatId)) {
    return deepFreeze({ available: false, code: 'beat-locked', reason: `Opens after ${conversation.unlockAfterBeatId}.` });
  }
  if (context?.campId !== conversation.campId) {
    return deepFreeze({ available: false, code: 'wrong-camp', reason: `Available at ${conversation.campId}.` });
  }
  const participants = getCampConversationPlan(conversation.pairId)?.participants ?? [];
  const unlockedMembers = new Set((context?.advancementState?.party ?? [])
    .filter((member) => member.unlocked)
    .map((member) => member.id));
  const lockedParticipants = participants.filter((participant) => !unlockedMembers.has(participant));
  if (lockedParticipants.length) {
    return deepFreeze({ available: false, code: 'party-locked', reason: `Party member not yet available: ${lockedParticipants.join(', ')}.` });
  }
  const previous = previousConversation(conversation);
  if (previous && getCampConversationRecord(state, previous.id)?.status !== 'completed') {
    return deepFreeze({ available: false, code: 'sequence-locked', reason: `Complete ${previous.id} first.` });
  }
  return deepFreeze({ available: true, code: 'available', reason: 'Available.' });
}

export function getAvailableCampConversations(state, context = {}) {
  return deepFreeze(CAMP_CONVERSATIONS.conversations.filter((conversation) =>
    getCampConversationAvailability(state, conversation.id, context).available));
}

export function beginCampConversation(state, conversationId, context = {}) {
  const validation = validateCampConversationPayload(state);
  if (!validation.ok) return failed(state, 'invalid-state', validation.errors.join(' '));
  const trustedState = validation.state;
  const availability = getCampConversationAvailability(trustedState, conversationId, context);
  if (!availability.available) return failed(trustedState, availability.code, availability.reason);
  const nextState = replaceRecord(trustedState, {
    id: conversationId,
    status: 'active',
    mainLineIndex: 0,
    choiceId: null,
    responseLineIndex: 0,
  });
  return deepFreeze({ ok: true, code: 'conversation-started', state: nextState, progress: getCampConversationProgress(nextState, conversationId) });
}

export function acknowledgeCampConversationLine(state, conversationId) {
  const validation = validateCampConversationPayload(state);
  if (!validation.ok) return failed(state, 'invalid-state', validation.errors.join(' '));
  const trustedState = validation.state;
  const progress = getCampConversationProgress(trustedState, conversationId);
  if (!progress) return failed(trustedState, 'unknown-conversation', 'Unknown camp conversation.');
  if (progress.phase !== 'main-dialogue') return failed(trustedState, 'main-dialogue-unavailable', 'No main camp line is waiting for acknowledgement.');
  const record = getCampConversationRecord(trustedState, conversationId);
  const line = progress.currentMainLine;
  const nextState = replaceRecord(trustedState, { ...record, mainLineIndex: record.mainLineIndex + 1 });
  return deepFreeze({ ok: true, code: 'main-line-acknowledged', state: nextState, line, progress: getCampConversationProgress(nextState, conversationId) });
}

export function chooseCampConversationOption(state, conversationId, choiceId) {
  const validation = validateCampConversationPayload(state);
  if (!validation.ok) return failed(state, 'invalid-state', validation.errors.join(' '));
  const trustedState = validation.state;
  const progress = getCampConversationProgress(trustedState, conversationId);
  if (!progress) return failed(trustedState, 'unknown-conversation', 'Unknown camp conversation.');
  if (progress.phase !== 'choice') return failed(trustedState, 'choice-unavailable', 'Finish the main conversation before choosing.');
  const option = selectedOption(progress.conversation, choiceId);
  if (!option) return failed(trustedState, 'unknown-choice', 'Choose one of the two authored responses.');
  const record = getCampConversationRecord(trustedState, conversationId);
  const nextState = replaceRecord(trustedState, { ...record, choiceId, responseLineIndex: 0 });
  return deepFreeze({ ok: true, code: 'choice-recorded', state: nextState, option, progress: getCampConversationProgress(nextState, conversationId) });
}

export function acknowledgeCampConversationResponse(state, conversationId) {
  const validation = validateCampConversationPayload(state);
  if (!validation.ok) return failed(state, 'invalid-state', validation.errors.join(' '));
  const trustedState = validation.state;
  const progress = getCampConversationProgress(trustedState, conversationId);
  if (!progress) return failed(trustedState, 'unknown-conversation', 'Unknown camp conversation.');
  if (progress.phase !== 'choice-response' || !progress.currentResponseLine) {
    return failed(trustedState, progress.complete ? 'already-complete' : 'response-unavailable', progress.complete
      ? 'This finite camp conversation is already complete.'
      : 'Choose a response before acknowledging its consequence.');
  }
  const record = getCampConversationRecord(trustedState, conversationId);
  const line = progress.currentResponseLine;
  const responseLineIndex = record.responseLineIndex + 1;
  const completed = responseLineIndex === progress.responseLineCount;
  const nextState = replaceRecord(trustedState, {
    ...record,
    status: completed ? 'completed' : 'active',
    responseLineIndex,
  });
  return deepFreeze({
    ok: true,
    code: completed ? 'conversation-complete' : 'response-line-acknowledged',
    state: nextState,
    line,
    consequence: completed ? progress.selectedOption.consequence : null,
    progress: getCampConversationProgress(nextState, conversationId),
  });
}

export function getCampConversationFlags(state) {
  return deepFreeze((state?.records ?? [])
    .filter((record) => record.status === 'completed')
    .map((record) => selectedOption(getCampConversation(record.id), record.choiceId)?.consequence.flag)
    .filter(Boolean));
}

export function getCampConversationRuntimeMetrics(state) {
  const completed = (state?.records ?? []).filter((record) => record.status === 'completed');
  return deepFreeze({
    conversationCount: CAMP_CONVERSATIONS.metrics.conversationCount,
    completedConversationCount: completed.length,
    remainingConversationCount: CAMP_CONVERSATIONS.metrics.conversationCount - completed.length,
    activeConversationCount: (state?.records ?? []).filter((record) => record.status === 'active').length,
    acknowledgedMainLineCount: (state?.records ?? []).reduce((sum, record) => sum + record.mainLineIndex, 0),
    acknowledgedResponseLineCount: (state?.records ?? []).reduce((sum, record) => sum + record.responseLineIndex, 0),
    choiceCount: (state?.records ?? []).filter((record) => record.choiceId).length,
    complete: completed.length === CAMP_CONVERSATIONS.metrics.conversationCount,
  });
}

export function validateCampConversationPayload(payload) {
  const errors = [];
  if (!exactKeys(payload, STATE_KEYS)) errors.push('Save must contain exactly the camp-conversation state keys.');
  if (payload?.schemaVersion !== CAMP_CONVERSATION_SAVE_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${CAMP_CONVERSATION_SAVE_SCHEMA_VERSION}.`);
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
      const conversation = getCampConversation(record?.id);
      if (!exactKeys(record, RECORD_KEYS)) errors.push(`${label} must contain exactly the camp-conversation record keys.`);
      if (!conversation) errors.push(`${label} references an unknown conversation.`);
      if (seen.has(record?.id)) errors.push(`${label} duplicates ${record?.id}.`);
      seen.add(record?.id);
      if (!['active', 'completed'].includes(record?.status)) errors.push(`${label} has an invalid status.`);
      if (record?.status === 'active') activeCount += 1;
      expectedRevision += 1;
      if (Number.isSafeInteger(record?.mainLineIndex) && record.mainLineIndex >= 0) expectedRevision += record.mainLineIndex;
      if (record?.choiceId !== null) expectedRevision += 1;
      if (Number.isSafeInteger(record?.responseLineIndex) && record.responseLineIndex >= 0) expectedRevision += record.responseLineIndex;
      if (!Number.isSafeInteger(record?.mainLineIndex) || record.mainLineIndex < 0 || (conversation && record.mainLineIndex > conversation.dialogue.length)) {
        errors.push(`${label} has an invalid mainLineIndex.`);
      }
      const option = selectedOption(conversation, record?.choiceId);
      if (record?.choiceId !== null && !option) errors.push(`${label} has an invalid choiceId.`);
      if (!Number.isSafeInteger(record?.responseLineIndex) || record.responseLineIndex < 0 || (option && record.responseLineIndex > option.response.length)) {
        errors.push(`${label} has an invalid responseLineIndex.`);
      }
      if (!option && record?.responseLineIndex !== 0) errors.push(`${label} has response progress without a choice.`);
      if (option && record?.mainLineIndex !== conversation?.dialogue.length) errors.push(`${label} chose before completing main dialogue.`);
      if (record?.status === 'completed' && (!option || record.responseLineIndex !== option.response.length)) errors.push(`${label} completion frontier is incoherent.`);
      if (record?.status === 'active' && option && record.responseLineIndex === option.response.length) errors.push(`${label} should be completed after its final response.`);
    });
    if (activeCount > 1) errors.push('Only one camp conversation may be active.');
    const recordsById = new Map(payload.records.map((record) => [record.id, record]));
    payload.records.forEach((record, index) => {
      const conversation = getCampConversation(record.id);
      if (!conversation || conversation.sequence <= 1) return;
      const plan = getCampConversationPlan(conversation.pairId);
      const previousId = plan?.conversations[conversation.sequence - 2]?.id;
      if (!previousId || recordsById.get(previousId)?.status !== 'completed') {
        errors.push(`record ${index} skips incomplete prior pair conversation ${previousId ?? 'unknown'}.`);
      }
    });
    if (Number.isSafeInteger(payload?.revision) && payload.revision !== expectedRevision) {
      errors.push(`revision must equal the ${expectedRevision} successful camp-conversation transitions represented by the save.`);
    }
    const canonical = sortedRecords(payload.records);
    if (canonical.some((record, index) => record.id !== payload.records[index]?.id)) errors.push('records must use canonical conversation order.');
  }
  if (errors.length) return deepFreeze({ ok: false, state: null, errors });
  return deepFreeze({ ok: true, state: freezeState(payload.records, payload.revision, payload.runId), errors: [] });
}

export function serializeCampConversationState(state) {
  const validation = validateCampConversationPayload(state);
  if (!validation.ok) throw new TypeError(`Cannot serialize camp-conversation state: ${validation.errors.join(' ')}`);
  return JSON.stringify(validation.state);
}

export function loadCampConversationState(serialized) {
  if (serialized == null || serialized === '') {
    return deepFreeze({ ok: true, state: createCampConversationState(), fresh: true, found: false, errors: [] });
  }
  try {
    const validation = validateCampConversationPayload(JSON.parse(serialized));
    if (!validation.ok) return deepFreeze({ ...validation, fresh: false, found: true });
    return deepFreeze({ ...validation, fresh: false, found: true });
  } catch {
    return deepFreeze({ ok: false, state: null, fresh: false, found: true, errors: ['Camp-conversation save is not valid JSON.'] });
  }
}

export function createCampConversationStorageAdapter(storage = getDefaultBrowserStorage(), key = DEFAULT_CAMP_CONVERSATION_SAVE_KEY) {
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
        const loaded = loadCampConversationState(serialized);
        replaceInvalidOnNextSave = Boolean(serialized && !loaded.ok);
        if (loaded.ok && (!loaded.found || loaded.state.runId !== activeRunId)) {
          return deepFreeze({
            ok: true,
            state: createCampConversationState(activeRunId),
            fresh: true,
            found: loaded.found,
            resetForRun: loaded.found,
            errors: loaded.found ? ['Stored camp-conversation progress belongs to a different clean run.'] : [],
          });
        }
        return loaded.ok ? loaded : deepFreeze({ ...loaded, state: createCampConversationState(activeRunId) });
      } catch {
        return deepFreeze({ ok: false, state: createCampConversationState(currentRunId() ?? UNVERIFIED_RUN_ID), fresh: true, found: false, errors: ['Camp-conversation storage could not be read.'] });
      }
    },
    save(state) {
      try {
        if (typeof storage?.setItem !== 'function') throw new TypeError('Storage has no setItem method.');
        if (typeof storage?.getItem !== 'function') throw new TypeError('Storage has no getItem method.');
        const serialized = serializeCampConversationState(state);
        const currentSerialized = storage.getItem(key);
        const activeRunId = currentRunId();
        if (hasObservedRunId && activeRunId !== observedRunId) {
          throw new Error('Camp-conversation adapter belongs to a different clean run.');
        }
        hasObservedRunId = true;
        observedRunId = activeRunId;
        const boundRunId = activeRunId ?? UNVERIFIED_RUN_ID;
        if (state.runId !== boundRunId) throw new Error('Camp-conversation state belongs to a different clean run.');
        if (hasObservedStorage && (currentSerialized ?? null) !== lastObservedSerialized) {
          throw new Error('Camp-conversation storage changed after this adapter last observed it.');
        }
        if (replaceInvalidOnNextSave) {
          storage.setItem(key, serialized);
          replaceInvalidOnNextSave = false;
          hasObservedStorage = true;
          lastObservedSerialized = serialized;
          return deepFreeze({ ok: true, errors: [] });
        }
        if (currentSerialized == null || currentSerialized === '') {
          if (state.revision > 1) throw new Error('Cleared camp-conversation storage rejects stale progress.');
        } else {
          const current = loadCampConversationState(currentSerialized);
          if (!current.ok || !current.state) throw new Error('Invalid camp-conversation storage cannot be overwritten.');
          if (current.state.runId !== state.runId) {
            storage.setItem(key, serialized);
            hasObservedStorage = true;
            lastObservedSerialized = serialized;
            return deepFreeze({ ok: true, errors: [] });
          }
          if (current.state.revision === state.revision) {
            if (serializeCampConversationState(current.state) !== serialized) {
              throw new Error('Conflicting camp-conversation states share one revision.');
            }
            hasObservedStorage = true;
            lastObservedSerialized = currentSerialized;
            return deepFreeze({ ok: true, errors: [] });
          }
          if (state.revision !== current.state.revision + 1) {
            throw new Error('Camp-conversation save is stale or skips a persisted transition.');
          }
        }
        storage.setItem(key, serialized);
        hasObservedStorage = true;
        lastObservedSerialized = serialized;
        return deepFreeze({ ok: true, errors: [] });
      } catch {
        return deepFreeze({ ok: false, errors: ['Camp-conversation storage could not be written because it was unavailable, stale, cleared, conflicting, or non-sequential.'] });
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
        return deepFreeze({ ok: false, errors: ['Camp-conversation storage could not be cleared.'] });
      }
    },
  });
}
