import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMPAIGN } from '../content/campaign.mjs';
import {
  appendChoice,
  completeCurrentBeat,
  createCampaignState,
  createLocalStorageAdapter,
  getCanonicalBeatIds,
  getCanonicalChapterIds,
  getCurrentBeat,
  getFlagValue,
  getSelectedChoiceIds,
  getUnlockedBeatIds,
  hasFlag,
  isBeatCompleted,
  isCampaignComplete,
  loadCampaignState,
  moveToBeat,
  PROGRESSION_SCHEMA_VERSION,
  resetCampaignState,
  selectChoice,
  serializeCampaignState,
  validateSavePayload,
} from '../progression.mjs';

function advanceTo(state, targetBeatId) {
  let next = state;
  const maximumSteps = getCanonicalBeatIds().length + 1;
  for (let step = 0; step < maximumSteps; step += 1) {
    if (next.current.beatId === targetBeatId) return next;
    next = completeCurrentBeat(next);
  }
  throw new Error(`Could not advance to ${targetBeatId}.`);
}

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, value);
  }

  removeItem(key) {
    this.#values.delete(key);
  }
}

test('creates an immutable opening state using the canonical campaign IDs', () => {
  const state = createCampaignState();

  assert.equal(state.schemaVersion, PROGRESSION_SCHEMA_VERSION);
  assert.equal(state.campaignId, CAMPAIGN.id);
  assert.deepEqual(state.current, { chapterId: 'prologue', beatId: 'p00-delivery-in-rain' });
  assert.deepEqual(state.completedBeatIds, []);
  assert.deepEqual(state.choiceIds, []);
  assert.deepEqual(state.flags, {});
  assert.deepEqual(getUnlockedBeatIds(state), ['p00-delivery-in-rain']);
  assert.equal(getCurrentBeat(state).id, 'p00-delivery-in-rain');
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.current), true);
  assert.deepEqual(getCanonicalChapterIds(), [
    'prologue',
    'chapter-1',
    'chapter-2',
    'chapter-3',
    'chapter-4',
    'chapter-5',
    'chapter-6',
    'chapter-7',
    'chapter-8',
    'chapter-9',
    'epilogue',
  ]);
});

test('only advances through the canonical beat frontier and permits completed-beat replay', () => {
  const initial = createCampaignState();
  assert.throws(
    () => moveToBeat(initial, 'chapter-1', 'c1-01-registers-omissions'),
    /not unlocked/,
  );

  const afterOpening = completeCurrentBeat(initial);
  assert.equal(afterOpening.current.beatId, 'p01-altered-order');
  assert.deepEqual(afterOpening.completedBeatIds, ['p00-delivery-in-rain']);
  assert.equal(isBeatCompleted(afterOpening, 'p00-delivery-in-rain'), true);
  assert.equal(isCampaignComplete(afterOpening), false);

  const replay = moveToBeat(afterOpening, 'prologue', 'p00-delivery-in-rain');
  const replayAdvance = completeCurrentBeat(replay);
  assert.equal(replayAdvance.current.beatId, 'p01-altered-order');
  assert.deepEqual(replayAdvance.completedBeatIds, ['p00-delivery-in-rain']);
  assert.equal(replayAdvance.revision, replay.revision + 1);
});

test('selection writes deterministic flags and safely replaces a route choice', () => {
  let state = completeCurrentBeat(createCampaignState());
  state = selectChoice(state, 'p01-read-order-aloud');

  assert.deepEqual(getSelectedChoiceIds(state), ['p01-read-order-aloud']);
  assert.equal(hasFlag(state, 'prologue_order_read'), true);
  assert.equal(getFlagValue(state, 'prologue_order_read'), 'p01-read-order-aloud');

  state = advanceTo(state, 'c1-02-kikus-threshold');
  state = selectChoice(state, 'c1-take-supply-route');
  assert.equal(getFlagValue(state, 'c1_supply_route_complete'), 'c1-take-supply-route');

  state = selectChoice(state, 'c1-go-to-ferry');
  assert.deepEqual(getSelectedChoiceIds(state), ['c1-go-to-ferry']);
  assert.equal(hasFlag(state, 'c1_supply_route_complete'), false);
  assert.equal(getFlagValue(state, 'c1_supply_route_deferred'), 'c1-go-to-ferry');
  assert.equal(state.choiceIds.includes('c1-take-supply-route'), false);
});

test('appendChoice preserves authored multi-interaction choices and exposes a flag array', () => {
  let state = advanceTo(createCampaignState(), 'c9-03-conservatory-offers');
  state = appendChoice(state, 'c9-ren-refuses-obedience');
  state = appendChoice(state, 'c9-aya-refuses-perfect-archive');

  assert.deepEqual(getSelectedChoiceIds(state), [
    'c9-ren-refuses-obedience',
    'c9-aya-refuses-perfect-archive',
  ]);
  assert.deepEqual(getFlagValue(state, 'c9_offer_responses'), [
    'c9-ren-refuses-obedience',
    'c9-aya-refuses-perfect-archive',
  ]);
  assert.equal(hasFlag(state, 'c9_offer_responses'), true);
  assert.throws(() => selectChoice(state, 'p01-read-order-aloud'), /current beat/);
});

test('serializes stably and rejects mismatched, noncanonical, or tampered save payloads', () => {
  let state = completeCurrentBeat(createCampaignState());
  state = selectChoice(state, 'p01-read-order-aloud');
  const serialized = serializeCampaignState(state);
  const roundTrip = loadCampaignState(serialized);

  assert.equal(roundTrip.ok, true);
  assert.deepEqual(roundTrip.value, state);
  assert.equal(serialized, JSON.stringify(state));

  const mismatchedCursor = validateSavePayload({
    ...state,
    current: { chapterId: 'chapter-1', beatId: 'p01-altered-order' },
  });
  assert.equal(mismatchedCursor.ok, false);
  assert.match(mismatchedCursor.errors.join(' '), /must own/);

  const skippedBeat = validateSavePayload({
    ...state,
    completedBeatIds: ['p01-altered-order'],
  });
  assert.equal(skippedBeat.ok, false);
  assert.match(skippedBeat.errors.join(' '), /contiguous campaign prefix/);

  const tamperedFlags = validateSavePayload({
    ...state,
    flags: { prologue_order_read: true },
  });
  assert.equal(tamperedFlags.ok, false);
  assert.match(tamperedFlags.errors.join(' '), /derived from save.choiceIds/);

  const badJson = loadCampaignState('{not-json');
  assert.equal(badJson.ok, false);
  assert.deepEqual(badJson.errors, ['Save payload is not valid JSON.']);
});

test('reset is deterministic and does not mutate an advanced state', () => {
  const advanced = completeCurrentBeat(createCampaignState());
  const reset = resetCampaignState();

  assert.equal(advanced.current.beatId, 'p01-altered-order');
  assert.deepEqual(reset, createCampaignState());
  assert.equal(reset.revision, 0);
});

test('localStorage adapter handles round trips, missing slots, corrupt data, and unavailable storage safely', () => {
  const storage = new MemoryStorage();
  const adapter = createLocalStorageAdapter(storage, 'progression-test');
  let state = completeCurrentBeat(createCampaignState());
  state = selectChoice(state, 'p01-read-order-aloud');

  assert.equal(adapter.available, true);
  assert.deepEqual(adapter.save(state), { ok: true });
  const loaded = adapter.load();
  assert.equal(loaded.ok, true);
  assert.equal(loaded.found, true);
  assert.deepEqual(loaded.state, state);

  assert.deepEqual(adapter.clear(), { ok: true });
  const empty = adapter.load();
  assert.equal(empty.ok, true);
  assert.equal(empty.found, false);
  assert.deepEqual(empty.state, createCampaignState());

  storage.setItem('progression-test', '{broken');
  const corrupt = adapter.load();
  assert.equal(corrupt.ok, false);
  assert.equal(corrupt.code, 'invalid-save');

  const unavailable = createLocalStorageAdapter(null, 'unavailable-test');
  assert.equal(unavailable.available, false);
  assert.deepEqual(unavailable.save(state), { ok: false, code: 'storage-unavailable' });
  assert.deepEqual(unavailable.load(), { ok: false, code: 'storage-unavailable' });
  assert.deepEqual(unavailable.clear(), { ok: false, code: 'storage-unavailable' });
});
