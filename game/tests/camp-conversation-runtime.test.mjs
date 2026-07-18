import assert from 'node:assert/strict';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import { CAMP_CONVERSATIONS } from '../content/camp-conversations.mjs';
import {
  acknowledgeCampConversationLine,
  acknowledgeCampConversationResponse,
  beginCampConversation,
  chooseCampConversationOption,
  createCampConversationState,
  createCampConversationStorageAdapter,
  getCampConversationAvailability,
  getCampConversationFlags,
  getCampConversationProgress,
  getCampConversationRuntimeMetrics,
  loadCampConversationState,
  serializeCampConversationState,
  validateCampConversationPayload,
} from '../camp-conversation-runtime.mjs';

const ALL_BEAT_IDS = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => beat.id));
const ALL_PARTY = ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'].map((id) => ({ id, unlocked: true }));

function contextFor(conversation, completedBeatIds = ALL_BEAT_IDS) {
  return {
    campaignState: { completedBeatIds },
    advancementState: { party: ALL_PARTY },
    campId: conversation.campId,
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function completeConversation(state, conversation, optionIndex = 0) {
  let result = beginCampConversation(state, conversation.id, contextFor(conversation));
  assert.equal(result.ok, true, result.reason);
  state = result.state;
  for (const expected of conversation.dialogue) {
    result = acknowledgeCampConversationLine(state, conversation.id);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(result.line, expected);
    state = result.state;
  }
  const option = conversation.choice.options[optionIndex];
  result = chooseCampConversationOption(state, conversation.id, option.id);
  assert.equal(result.ok, true, result.reason);
  state = result.state;
  for (const expected of option.response) {
    result = acknowledgeCampConversationResponse(state, conversation.id);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(result.line, expected);
    state = result.state;
  }
  assert.equal(result.code, 'conversation-complete');
  return state;
}

test('availability fails closed on beat, camp, party, and pair sequence gates', () => {
  const state = createCampConversationState();
  const first = CAMP_CONVERSATIONS.conversations[0];
  assert.equal(getCampConversationAvailability(state, first.id, contextFor(first, [])).code, 'beat-locked');
  assert.equal(getCampConversationAvailability(state, first.id, { ...contextFor(first), campId: 'hidden-infirmary' }).code, 'wrong-camp');
  assert.equal(getCampConversationAvailability(state, first.id, {
    ...contextFor(first), advancementState: { party: [{ id: first.pairId.split('-')[0], unlocked: true }] },
  }).code, 'party-locked');
  const second = CAMP_CONVERSATIONS.conversations.find((conversation) => conversation.pairId === first.pairId && conversation.sequence === 2);
  assert.equal(getCampConversationAvailability(state, second.id, contextFor(second)).code, 'sequence-locked');
});

test('one conversation acknowledges every line, chooses explicitly, completes once, and exposes its flag', () => {
  const conversation = CAMP_CONVERSATIONS.conversations[0];
  let state = createCampConversationState();
  const started = beginCampConversation(state, conversation.id, contextFor(conversation));
  assert.equal(started.ok, true);
  state = started.state;
  assert.equal(chooseCampConversationOption(state, conversation.id, conversation.choice.options[0].id).code, 'choice-unavailable');
  for (let index = 0; index < conversation.dialogue.length; index += 1) {
    state = acknowledgeCampConversationLine(state, conversation.id).state;
  }
  assert.equal(getCampConversationProgress(state, conversation.id).phase, 'choice');
  assert.equal(chooseCampConversationOption(state, conversation.id, 'invented-choice').code, 'unknown-choice');
  state = chooseCampConversationOption(state, conversation.id, conversation.choice.options[1].id).state;
  for (let index = 0; index < conversation.choice.options[1].response.length; index += 1) {
    state = acknowledgeCampConversationResponse(state, conversation.id).state;
  }
  assert.equal(getCampConversationProgress(state, conversation.id).complete, true);
  assert.deepEqual(getCampConversationFlags(state), [conversation.choice.options[1].consequence.flag]);
  assert.equal(beginCampConversation(state, conversation.id, contextFor(conversation)).code, 'already-complete');
  assert.equal(acknowledgeCampConversationResponse(state, conversation.id).code, 'already-complete');
});

test('all 90 finite conversations complete in canonical order with exact acknowledgement metrics', () => {
  let state = createCampConversationState();
  let expectedMainLines = 0;
  let expectedResponseLines = 0;
  for (const conversation of CAMP_CONVERSATIONS.conversations) {
    expectedMainLines += conversation.dialogue.length;
    expectedResponseLines += conversation.choice.options[0].response.length;
    state = completeConversation(state, conversation);
  }
  const metrics = getCampConversationRuntimeMetrics(state);
  assert.equal(metrics.conversationCount, 90);
  assert.equal(metrics.completedConversationCount, 90);
  assert.equal(metrics.acknowledgedMainLineCount, expectedMainLines);
  assert.equal(metrics.acknowledgedResponseLineCount, expectedResponseLines);
  assert.equal(metrics.choiceCount, 90);
  assert.equal(metrics.complete, true);
  assert.equal(getCampConversationFlags(state).length, 90);
  assert.equal(new Set(getCampConversationFlags(state)).size, 90);
  assert.equal(Object.isFrozen(state.records[0]), true);
});

test('versioned payload and storage round-trip and reject incoherent frontiers', () => {
  const conversation = CAMP_CONVERSATIONS.conversations[0];
  const state = beginCampConversation(createCampConversationState(), conversation.id, contextFor(conversation)).state;
  const loaded = loadCampConversationState(serializeCampConversationState(state));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state, state);
  const corrupt = {
    ...state,
    records: [{ ...state.records[0], status: 'completed', choiceId: null, responseLineIndex: 0 }],
  };
  assert.equal(validateCampConversationPayload(corrupt).ok, false);
  assert.equal(validateCampConversationPayload({ ...state, revision: 0 }).ok, false);
  const later = CAMP_CONVERSATIONS.conversations.find((entry) => entry.pairId === conversation.pairId && entry.sequence === 2);
  assert.equal(validateCampConversationPayload({
    ...state,
    revision: 1,
    records: [{ id: later.id, status: 'active', mainLineIndex: 0, choiceId: null, responseLineIndex: 0 }],
  }).ok, false);
  assert.equal(loadCampConversationState('{bad').ok, false);

  const storage = memoryStorage();
  const adapter = createCampConversationStorageAdapter(storage, 'test.camp-talks');
  assert.equal(adapter.save(state).ok, true);
  assert.equal(adapter.save(state).ok, true, 'an identical lifecycle no-op remains safe');
  assert.deepEqual(adapter.load().state, state);
  const advanced = acknowledgeCampConversationLine(state, conversation.id).state;
  assert.equal(adapter.save(advanced).ok, true);
  assert.equal(adapter.save(state).ok, false, 'an older tab cannot roll persisted progress back');
  assert.equal(adapter.clear().ok, true);
  assert.equal(adapter.save(advanced).ok, false, 'cleared storage rejects stale multi-transition resurrection');
  assert.equal(adapter.load().found, false);
  const resetStorage = memoryStorage();
  const staleTab = createCampConversationStorageAdapter(resetStorage, 'test.camp-talk-reset');
  assert.equal(staleTab.save(state).ok, true);
  resetStorage.removeItem('test.camp-talk-reset');
  assert.equal(staleTab.save(state).ok, false, 'external New Game clearing invalidates the stale adapter even at revision one');
  const unavailable = createCampConversationStorageAdapter({}, 'test.unavailable');
  assert.equal(unavailable.save(state).ok, false);
  assert.equal(unavailable.clear().ok, false);
});
