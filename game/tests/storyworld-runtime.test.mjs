import assert from 'node:assert/strict';
import test from 'node:test';

import { getCampaignRouteSchedule } from '../campaign-route-scheduler.mjs';
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
  getLadyEnmaResolution,
  getRequiredStoryworldClusterIds,
  getStoryworldGateForBeat,
  getStoryworldProgress,
  getStoryworldRouteTheater,
  getVisibleStoryworldOptions,
  isStoryworldNarrativeComplete,
  LEGACY_STORYWORLD_CATALOG_IDENTITIES,
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

test('the Paper route requires all eleven clusters in route order and replays exact derived state', () => {
  let state = createStoryworldState({ runId: 'storyworld-runtime-complete' });
  STORYWORLD_CLUSTERS.forEach((cluster, index) => {
    state = resolveCluster(state, cluster, index % 3);
  });
  assert.equal(isStoryworldNarrativeComplete(state), true);
  assert.equal(getStoryworldRouteTheater(state), 'paper');
  assert.deepEqual(
    getRequiredStoryworldClusterIds(state),
    getCampaignRouteSchedule('paper').storyworldDecisionIds,
  );
  assert.equal(getCompletedStoryworldClusterIds(state).length, 11);
  assert.equal(state.records.length, 11);
  assert.equal(state.revision, 54);
  const projection = deriveStoryworldProjection(state);
  assert.equal(Object.keys(projection).length, 32);
  assert.equal(Object.values(projection).every((value) => value >= 0 && value <= 1), true);
  const serialized = serializeStoryworldState(state);
  const loaded = loadStoryworldState(serialized);
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.deepEqual(loaded.state, state);
  assert.deepEqual(deriveStoryworldProjection(loaded.state), projection);
});

test('Salt and Ash skip the Storyworld cluster owned by their omitted operation', () => {
  const warTable = STORYWORLD_CLUSTERS.find(({ id }) => id === 'sw3-sayos-warehouse-conditions');
  for (const [theater, optionIndex, omittedClusterId] of [
    ['salt', 0, 'sw6-tribunal-afterword'],
    ['ash', 1, 'sw4-margin-varga-journal'],
  ]) {
    let state = createStoryworldState({ runId: `storyworld-route-skip-${theater}` });
    for (const cluster of STORYWORLD_CLUSTERS.slice(0, 2)) state = resolveCluster(state, cluster);
    state = resolveCluster(state, warTable, optionIndex);
    assert.equal(getStoryworldRouteTheater(state), theater);
    assert.equal(getRequiredStoryworldClusterIds(state).includes(omittedClusterId), false);
    const omitted = STORYWORLD_CLUSTERS.find(({ id }) => id === omittedClusterId);
    assert.equal(
      getStoryworldGateForBeat(state, omitted.anchorBeatId, omitted.placement).phase,
      'route-skipped',
    );
    assert.equal(beginStoryworldEncounter(state, omittedClusterId).code, 'route-skipped');
  }
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

test('the exact pre-Nikola Storyworld identity migrates once without changing branch history', () => {
  const storage = new MemoryStorage();
  const adapter = createStoryworldStorageAdapter(storage);
  const current = resolveCluster(
    createStoryworldState({ runId: 'storyworld-nikola-migration-0001' }),
    STORYWORLD_CLUSTERS[0],
    1,
  );
  const legacyIdentity = LEGACY_STORYWORLD_CATALOG_IDENTITIES[0];
  const legacy = {
    ...current,
    sourceIFID: legacyIdentity.sourceIFID,
    sourceHash: legacyIdentity.sourceHash,
    catalogSignature: legacyIdentity.catalogSignature,
  };
  storage.setItem(adapter.key, JSON.stringify(legacy));

  const loaded = adapter.load();
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.migrationId, 'lise-to-nikola-canon-v1');
  assert.deepEqual(loaded.state.records, current.records);
  assert.equal(loaded.state.revision, current.revision);
  assert.equal(loaded.state.sourceHash, current.sourceHash);
  assert.equal(loaded.state.catalogSignature, current.catalogSignature);
  assert.equal(storage.getItem(adapter.key), serializeStoryworldState(current));

  const secondLoad = adapter.load();
  assert.equal(secondLoad.ok, true);
  assert.equal(Object.hasOwn(secondLoad, 'migrated'), false, 'migration is not repeated after rewrite');
});

test('the exact pre-Severed-Dragon identity migrates only the two records before the Act III route decision', () => {
  const storage = new MemoryStorage();
  const adapter = createStoryworldStorageAdapter(storage);
  let current = createStoryworldState({ runId: 'storyworld-severed-dragon-migration-0001' });
  for (const cluster of STORYWORLD_CLUSTERS.slice(0, 2)) current = resolveCluster(current, cluster, 0);
  const legacyIdentity = LEGACY_STORYWORLD_CATALOG_IDENTITIES[1];
  const legacy = {
    ...current,
    sourceIFID: legacyIdentity.sourceIFID,
    sourceHash: legacyIdentity.sourceHash,
    catalogSignature: legacyIdentity.catalogSignature,
  };
  storage.setItem(adapter.key, JSON.stringify(legacy));

  const loaded = adapter.load();
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.migrationId, 'severed-dragon-ending-v1');
  assert.deepEqual(loaded.state.records, current.records);
  assert.equal(loaded.state.revision, current.revision);
  assert.equal(storage.getItem(adapter.key), serializeStoryworldState(current));
});

test('the pre-English-heiress identity migrates only the two records before the Act III route decision', () => {
  const storage = new MemoryStorage();
  const adapter = createStoryworldStorageAdapter(storage);
  let current = createStoryworldState({ runId: 'storyworld-english-heiress-migration-0001' });
  for (const cluster of STORYWORLD_CLUSTERS.slice(0, 2)) current = resolveCluster(current, cluster, 0);
  const legacyIdentity = LEGACY_STORYWORLD_CATALOG_IDENTITIES[2];
  const legacy = {
    ...current,
    sourceIFID: legacyIdentity.sourceIFID,
    sourceHash: legacyIdentity.sourceHash,
    catalogSignature: legacyIdentity.catalogSignature,
  };
  storage.setItem(adapter.key, JSON.stringify(legacy));

  const loaded = adapter.load();
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.migrationId, 'english-heiress-lineage-v1');
  assert.deepEqual(loaded.state.records, current.records);
  assert.equal(loaded.state.revision, current.revision);
  assert.equal(storage.getItem(adapter.key), serializeStoryworldState(current));
});

test('the exact pre-Enma identity migrates only the two records before the Act III route decision', () => {
  const storage = new MemoryStorage();
  const adapter = createStoryworldStorageAdapter(storage);
  let current = createStoryworldState({ runId: 'storyworld-enma-migration-0001' });
  for (const cluster of STORYWORLD_CLUSTERS.slice(0, 2)) current = resolveCluster(current, cluster, 0);
  const legacyIdentity = LEGACY_STORYWORLD_CATALOG_IDENTITIES[3];
  const legacy = {
    ...current,
    sourceIFID: legacyIdentity.sourceIFID,
    sourceHash: legacyIdentity.sourceHash,
    catalogSignature: legacyIdentity.catalogSignature,
  };
  storage.setItem(adapter.key, JSON.stringify(legacy));

  const loaded = adapter.load();
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.migrationId, 'enma-three-terms-v1');
  assert.deepEqual(loaded.state.records, current.records);
});

test('the immediately previous catalog migrates only the two records before the new war table', () => {
  const storage = new MemoryStorage();
  const adapter = createStoryworldStorageAdapter(storage);
  let current = createStoryworldState({ runId: 'storyworld-war-table-migration-0001' });
  for (const cluster of STORYWORLD_CLUSTERS.slice(0, 2)) current = resolveCluster(current, cluster, 1);
  const legacyIdentity = LEGACY_STORYWORLD_CATALOG_IDENTITIES[4];
  const legacy = {
    ...current,
    sourceIFID: legacyIdentity.sourceIFID,
    sourceHash: legacyIdentity.sourceHash,
    catalogSignature: legacyIdentity.catalogSignature,
  };
  storage.setItem(adapter.key, JSON.stringify(legacy));

  const loaded = adapter.load();
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.migrationId, 'act-three-war-table-v1');
  assert.deepEqual(loaded.state.records, current.records);
});

test('Lady Enma resolution is categorical and remains unavailable until her spool completes', () => {
  const cluster = STORYWORLD_CLUSTERS.find(({ id }) => id === 'sw-enma-three-terms');
  let state = createStoryworldState({ runId: 'storyworld-enma-resolution-0001' });
  assert.equal(getLadyEnmaResolution(state), null);
  state = resolveCluster(state, cluster, 0);
  assert.equal(getLadyEnmaResolution(state), 'captured');
  assert.equal(deriveStoryworldProjection(state).enma_custody > 0, true);
});

test('every legacy identity fails closed at the old third record instead of inventing an Act III road choice', () => {
  const structuralIdentities = LEGACY_STORYWORLD_CATALOG_IDENTITIES
    .filter(({ maximumCompatibleRecordCount }) => maximumCompatibleRecordCount < 3);
  for (const [identityIndex, legacyIdentity] of structuralIdentities.entries()) {
    let prefix = createStoryworldState({ runId: `storyworld-old-third-record-${identityIndex}` });
    for (const cluster of STORYWORLD_CLUSTERS.slice(0, 3)) prefix = resolveCluster(prefix, cluster, 0);
    const legacy = {
      ...prefix,
      sourceIFID: legacyIdentity.sourceIFID,
      sourceHash: legacyIdentity.sourceHash,
      catalogSignature: legacyIdentity.catalogSignature,
    };
    const serialized = JSON.stringify(legacy);
    const storage = new MemoryStorage();
    const adapter = createStoryworldStorageAdapter(storage);
    storage.setItem(adapter.key, serialized);

    const loaded = adapter.load();
    assert.equal(loaded.ok, false);
    assert.match(loaded.errors.join(' '), /cannot be migrated without inventing a political choice/u);
    assert.equal(storage.getItem(adapter.key), serialized, 'rejected history must not be rewritten');
  }
});

test('the Act V prose rewrite preserves a complete compatible Storyworld history', () => {
  let current = createStoryworldState({ runId: 'storyworld-act-five-prose-migration-0001' });
  STORYWORLD_CLUSTERS.forEach((cluster, index) => {
    current = resolveCluster(current, cluster, index % 3);
  });
  const legacyIdentity = LEGACY_STORYWORLD_CATALOG_IDENTITIES
    .find(({ migrationId }) => migrationId === 'act-five-climax-writing-v1');
  assert.ok(legacyIdentity);
  const loaded = loadStoryworldState({
    ...current,
    sourceIFID: legacyIdentity.sourceIFID,
    sourceHash: legacyIdentity.sourceHash,
    catalogSignature: legacyIdentity.catalogSignature,
  });
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.migrationId, 'act-five-climax-writing-v1');
  assert.deepEqual(loaded.state.records, current.records);
});

test('the long-range balance model preserves already selected opaque outcomes', () => {
  let current = createStoryworldState({ runId: 'storyworld-long-range-balance-migration-0001' });
  STORYWORLD_CLUSTERS.forEach((cluster, index) => {
    current = resolveCluster(current, cluster, index % 3);
  });
  const legacyIdentity = LEGACY_STORYWORLD_CATALOG_IDENTITIES
    .find(({ migrationId }) => migrationId === 'long-range-reaction-balance-v1');
  assert.ok(legacyIdentity);
  const loaded = loadStoryworldState({
    ...current,
    sourceIFID: legacyIdentity.sourceIFID,
    sourceHash: legacyIdentity.sourceHash,
    catalogSignature: legacyIdentity.catalogSignature,
  });
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.migrationId, 'long-range-reaction-balance-v1');
  assert.deepEqual(loaded.state.records, current.records);
});
