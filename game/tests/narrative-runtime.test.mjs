import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceNarrative,
  createNarrativeState,
  createNarrativeStorageAdapter,
  getNarrativeProgress,
  loadNarrativeState,
  serializeNarrativeState,
} from '../narrative-runtime.mjs';

test('dialogue lines advance one acknowledgment at a time and persist canonically', () => {
  let state = createNarrativeState();
  assert.equal(getNarrativeProgress(state, 'p00-delivery-in-rain', 3).currentLineIndex, 0);
  state = advanceNarrative(state, 'p00-delivery-in-rain', 3).state;
  assert.equal(getNarrativeProgress(state, 'p00-delivery-in-rain', 3).currentLineIndex, 1);
  state = advanceNarrative(state, 'p00-delivery-in-rain', 3).state;
  state = advanceNarrative(state, 'p00-delivery-in-rain', 3).state;
  assert.equal(getNarrativeProgress(state, 'p00-delivery-in-rain', 3).complete, true);
  assert.equal(advanceNarrative(state, 'p00-delivery-in-rain', 3).state, state);
  assert.equal(serializeNarrativeState(loadNarrativeState(serializeNarrativeState(state)).state), serializeNarrativeState(state));
});

test('corrupt narrative records fail closed and storage can clear a clean run', () => {
  const invalid = loadNarrativeState(JSON.stringify({ ...createNarrativeState(), records: [{ beatId: 'unknown', acknowledgedLines: 1 }] }));
  assert.equal(invalid.ok, false);
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const adapter = createNarrativeStorageAdapter(storage, 'narrative.test');
  const state = advanceNarrative(createNarrativeState(), 'p00-delivery-in-rain', 3).state;
  assert.equal(adapter.save(state).ok, true);
  assert.equal(adapter.load().state.revision, 1);
  assert.equal(adapter.clear().ok, true);
  assert.equal(values.size, 0);
});
