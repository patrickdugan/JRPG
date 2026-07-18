import assert from 'node:assert/strict';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import { PARTY_COUNCILS } from '../content/party-councils.mjs';
import {
  acknowledgePartyCouncilLine,
  acknowledgePartyCouncilResponse,
  beginPartyCouncil,
  choosePartyCouncilOption,
  createPartyCouncilState,
  createPartyCouncilStorageAdapter,
  getPartyCouncilAvailability,
  getPartyCouncilFlags,
  getPartyCouncilProgress,
  getPartyCouncilRuntimeMetrics,
  loadPartyCouncilState,
  serializePartyCouncilState,
  validatePartyCouncilPayload,
} from '../party-council-runtime.mjs';

const ALL_BEAT_IDS = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => beat.id));
const ALL_PARTY = ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'].map((id) => ({ id, unlocked: true }));

function contextFor(council, completedBeatIds = ALL_BEAT_IDS) {
  return {
    campaignState: { completedBeatIds },
    advancementState: { party: ALL_PARTY },
    campId: council.campId,
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

function completeCouncil(state, council, optionIndex = 0) {
  let result = beginPartyCouncil(state, council.id, contextFor(council));
  assert.equal(result.ok, true, result.reason);
  state = result.state;
  for (const expected of council.dialogue) {
    result = acknowledgePartyCouncilLine(state, council.id);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(result.line, expected);
    state = result.state;
  }
  const option = council.choice.options[optionIndex];
  result = choosePartyCouncilOption(state, council.id, option.id);
  assert.equal(result.ok, true, result.reason);
  state = result.state;
  for (const expected of option.response) {
    result = acknowledgePartyCouncilResponse(state, council.id);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(result.line, expected);
    state = result.state;
  }
  assert.equal(result.code, 'council-complete');
  return state;
}

test('availability fails closed on beat, camp, party, active, and finite replay gates', () => {
  const first = PARTY_COUNCILS.councils[0];
  let state = createPartyCouncilState();
  assert.equal(getPartyCouncilAvailability(state, first.id, contextFor(first, [])).code, 'beat-locked');
  assert.equal(getPartyCouncilAvailability(state, first.id, { ...contextFor(first), campId: 'roadside-lantern' }).code, 'wrong-camp');
  assert.equal(getPartyCouncilAvailability(state, first.id, {
    ...contextFor(first), advancementState: { party: [{ id: first.participants[0], unlocked: true }] },
  }).code, 'party-locked');
  state = beginPartyCouncil(state, first.id, contextFor(first)).state;
  assert.equal(getPartyCouncilAvailability(state, first.id, contextFor(first)).code, 'already-active');
  assert.equal(getPartyCouncilAvailability(state, PARTY_COUNCILS.councils[1].id, contextFor(PARTY_COUNCILS.councils[1])).code, 'another-active');
  state = completeCouncil(createPartyCouncilState(), first);
  assert.equal(getPartyCouncilAvailability(state, first.id, contextFor(first)).code, 'already-complete');
});

test('one council acknowledges every speaker line, requires an explicit choice, and exposes its consequence flag', () => {
  const council = PARTY_COUNCILS.councils[0];
  let state = beginPartyCouncil(createPartyCouncilState(), council.id, contextFor(council)).state;
  assert.equal(choosePartyCouncilOption(state, council.id, council.choice.options[0].id).code, 'choice-unavailable');
  for (let index = 0; index < council.dialogue.length; index += 1) {
    state = acknowledgePartyCouncilLine(state, council.id).state;
  }
  assert.equal(getPartyCouncilProgress(state, council.id).phase, 'choice');
  assert.equal(choosePartyCouncilOption(state, council.id, 'invented-choice').code, 'unknown-choice');
  state = choosePartyCouncilOption(state, council.id, council.choice.options[1].id).state;
  for (let index = 0; index < council.choice.options[1].response.length; index += 1) {
    state = acknowledgePartyCouncilResponse(state, council.id).state;
  }
  assert.equal(getPartyCouncilProgress(state, council.id).complete, true);
  assert.deepEqual(getPartyCouncilFlags(state), [council.choice.options[1].consequence.flag]);
  assert.equal(beginPartyCouncil(state, council.id, contextFor(council)).code, 'already-complete');
  assert.equal(acknowledgePartyCouncilResponse(state, council.id).code, 'already-complete');
});

test('all thirty finite councils complete with exact acknowledgement metrics', () => {
  let state = createPartyCouncilState();
  let expectedMainLines = 0;
  let expectedResponseLines = 0;
  for (const council of PARTY_COUNCILS.councils) {
    expectedMainLines += council.dialogue.length;
    expectedResponseLines += council.choice.options[0].response.length;
    state = completeCouncil(state, council);
  }
  const metrics = getPartyCouncilRuntimeMetrics(state);
  assert.equal(metrics.councilCount, 30);
  assert.equal(metrics.completedCouncilCount, 30);
  assert.equal(metrics.acknowledgedMainLineCount, expectedMainLines);
  assert.equal(metrics.acknowledgedResponseLineCount, expectedResponseLines);
  assert.equal(metrics.choiceCount, 30);
  assert.equal(metrics.complete, true);
  assert.equal(getPartyCouncilFlags(state).length, 30);
  assert.equal(new Set(getPartyCouncilFlags(state)).size, 30);
  assert.equal(Object.isFrozen(state.records[0]), true);
});

test('versioned payload and storage round-trip and reject incoherent frontiers', () => {
  const council = PARTY_COUNCILS.councils[0];
  const state = beginPartyCouncil(createPartyCouncilState(), council.id, contextFor(council)).state;
  const loaded = loadPartyCouncilState(serializePartyCouncilState(state));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state, state);
  assert.equal(validatePartyCouncilPayload({ ...state, revision: 0 }).ok, false);
  assert.equal(validatePartyCouncilPayload({
    ...state,
    records: [{ ...state.records[0], status: 'completed', choiceId: null, responseLineIndex: 0 }],
  }).ok, false);
  assert.equal(loadPartyCouncilState('{bad').ok, false);

  const storage = memoryStorage();
  const adapter = createPartyCouncilStorageAdapter(storage, 'test.party-councils');
  assert.equal(adapter.save(state).ok, true);
  assert.equal(adapter.save(state).ok, true, 'an identical lifecycle no-op remains safe');
  assert.deepEqual(adapter.load().state, state);
  const advanced = acknowledgePartyCouncilLine(state, council.id).state;
  assert.equal(adapter.save(advanced).ok, true);
  assert.equal(adapter.save(state).ok, false, 'an older tab cannot roll persisted progress back');
  assert.equal(adapter.clear().ok, true);
  assert.equal(adapter.save(advanced).ok, false, 'cleared storage rejects stale multi-transition resurrection');
  assert.equal(adapter.load().found, false);
  const resetStorage = memoryStorage();
  const staleTab = createPartyCouncilStorageAdapter(resetStorage, 'test.party-council-reset');
  assert.equal(staleTab.save(state).ok, true);
  resetStorage.removeItem('test.party-council-reset');
  assert.equal(staleTab.save(state).ok, false, 'external New Game clearing invalidates the stale adapter even at revision one');
  const unavailable = createPartyCouncilStorageAdapter({}, 'test.unavailable');
  assert.equal(unavailable.save(state).ok, false);
  assert.equal(unavailable.clear().ok, false);
});
