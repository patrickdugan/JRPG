import assert from 'node:assert/strict';
import test from 'node:test';

import { STORYWORLD_CLUSTERS } from '../content/storyworld-encounters.generated.mjs';
import {
  advanceStoryworldEncounter,
  beginStoryworldEncounter,
  chooseStoryworldOption,
  createLegacyStoryworldState,
  createStoryworldState,
  createStoryworldStorageAdapter,
  deriveStoryworldProjection,
  getCompletedStoryworldClusterIds,
  getStoryworldGateForBeat,
  getStoryworldProgress,
  getVisibleStoryworldOptions,
  isStoryworldNarrativeComplete,
  loadStoryworldState,
  selectStoryworldReaction,
  serializeStoryworldState,
  validateStoryworldPayload,
} from '../storyworld-runtime.mjs';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function resolveCluster(state, cluster, entryOptionIndex = 0) {
  let result = beginStoryworldEncounter(state, cluster.id);
  assert.equal(result.ok, true, result.code);
  state = result.state;
  const entryOption = getVisibleStoryworldOptions(state, cluster.id)[entryOptionIndex];
  result = chooseStoryworldOption(state, cluster.id, entryOption.id);
  assert.equal(result.ok, true, result.code);
  state = result.state;
  result = advanceStoryworldEncounter(state, cluster.id);
  assert.equal(result.ok, true, result.code);
  state = result.state;
  const progress = getStoryworldProgress(state, cluster.id);
  if (!progress.outcome.terminal) {
    const outcomeOption = getVisibleStoryworldOptions(state, cluster.id)[0];
    result = chooseStoryworldOption(state, cluster.id, outcomeOption.id);
    assert.equal(result.ok, true, result.code);
    state = result.state;
  }
  result = advanceStoryworldEncounter(state, cluster.id);
  assert.equal(result.ok, true, result.code);
  return result.state;
}

test('one cluster runs entry choice, deterministic reaction, consequence scene, response, and completion', () => {
  const cluster = STORYWORLD_CLUSTERS[0];
  let state = createStoryworldState({ runId: 'storyworld-runtime-0001' });
  assert.equal(getStoryworldGateForBeat(state, cluster.anchorBeatId, cluster.placement).complete, false);
  assert.equal(getStoryworldGateForBeat(state, cluster.anchorBeatId, cluster.placement === 'before-beat' ? 'after-beat' : 'before-beat').required, false);
  state = beginStoryworldEncounter(state, cluster.id).state;
  assert.equal(getStoryworldProgress(state, cluster.id).phase, 'entry');
  const option = cluster.entry.options[0];
  const selected = chooseStoryworldOption(state, cluster.id, option.id);
  assert.equal(selected.ok, true);
  assert.match(selected.reaction.id, /_r_accord$/u);
  assert.equal(selected.progress.phase, 'entry-reaction');
  assert.equal(selected.progress.outcome.id, cluster.outcomes[0].id);
  assert.notDeepEqual(selected.projectionBefore, selected.projectionAfter);
  state = advanceStoryworldEncounter(selected.state, cluster.id).state;
  assert.equal(getStoryworldProgress(state, cluster.id).phase, 'outcome');
  const carry = getVisibleStoryworldOptions(state, cluster.id)[0];
  state = chooseStoryworldOption(state, cluster.id, carry.id).state;
  assert.equal(getStoryworldProgress(state, cluster.id).phase, 'outcome-reaction');
  state = advanceStoryworldEncounter(state, cluster.id).state;
  assert.equal(getStoryworldProgress(state, cluster.id).complete, true);
  assert.equal(state.revision, 5);
  assert.equal(getStoryworldGateForBeat(state, cluster.anchorBeatId, cluster.placement).complete, true);
});
test('reaction ties deterministically favor the later-authored reaction', () => {
  const option = STORYWORLD_CLUSTERS[0].entry.options[1];
  const propertyId = option.reactions[0].score.propertyId;
  const selected = selectStoryworldReaction(option, { [propertyId]: 0.5 });
  assert.equal(selected.reaction.id, option.reactions[1].id);
  assert.equal(selected.score, 0.51);
});

test('all ten required clusters produce one eighty-scene narrative route and exact replay-derived state', () => {
  let state = createStoryworldState({ runId: 'storyworld-runtime-complete' });
  STORYWORLD_CLUSTERS.forEach((cluster, index) => {
    state = resolveCluster(state, cluster, index % 3);
  });
  assert.equal(isStoryworldNarrativeComplete(state), true);
  assert.equal(getCompletedStoryworldClusterIds(state).length, 10);
  assert.equal(state.records.length, 10);
  assert.equal(state.revision, 49);
  const projection = deriveStoryworldProjection(state);
  assert.equal(Object.keys(projection).length, 17);
  assert.equal(Object.values(projection).every((value) => value >= 0 && value <= 1), true);
  const serialized = serializeStoryworldState(state);
  const loaded = loadStoryworldState(serialized);
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.deepEqual(loaded.state, state);
  assert.deepEqual(deriveStoryworldProjection(loaded.state), projection);
});

test('legacy coverage exempts past anchors but cannot claim narrative proof', () => {
  const state = createLegacyStoryworldState({ runId: 'storyworld-legacy-0001', coverageStartBeatIndex: 30 });
  assert.equal(state.proofEligible, false);
  assert.equal(getStoryworldGateForBeat(state, STORYWORLD_CLUSTERS[0].anchorBeatId, STORYWORLD_CLUSTERS[0].placement).phase, 'legacy-exempt');
  assert.throws(() => createStoryworldState({ runId: 'bad-legacy', coverageStartBeatIndex: 1, proofEligible: true }), /cannot be proof eligible/u);
});

test('strict validation rejects source drift, impossible IDs, and revision drift before storage writes', () => {
  let state = createStoryworldState({ runId: 'storyworld-validation-0001' });
  state = beginStoryworldEncounter(state, STORYWORLD_CLUSTERS[0].id).state;
  assert.equal(validateStoryworldPayload({ ...state, sourceHash: 'sha256:wrong' }).ok, false);
  assert.equal(validateStoryworldPayload({ ...state, revision: 99 }).ok, false);
  assert.equal(validateStoryworldPayload({ ...state, records: [{ ...state.records[0], clusterId: 'invented' }] }).ok, false);
  assert.equal(loadStoryworldState('{bad-json').ok, false);
});

test('storage adapter round-trips exact run-bound history and clears only its own authority', () => {
  const storage = new MemoryStorage();
  const adapter = createStoryworldStorageAdapter(storage);
  assert.deepEqual(adapter.load(), { ok: true, found: false });
  const state = resolveCluster(createStoryworldState({ runId: 'storyworld-storage-0001' }), STORYWORLD_CLUSTERS[0], 2);
  assert.equal(adapter.save(state).ok, true);
  assert.deepEqual(adapter.load().state, state);
  assert.equal(adapter.clear().ok, true);
  assert.deepEqual(adapter.load(), { ok: true, found: false });
});
