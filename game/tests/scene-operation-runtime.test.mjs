import assert from 'node:assert/strict';
import test from 'node:test';

import { SCENE_OPERATIONS, getSceneOperation } from '../content/scene-operations.mjs';
import {
  advanceSceneOperation,
  createSceneOperationState,
  createSceneOperationStorageAdapter,
  getSceneOperationProgress,
  getSceneOperationRuntimeMetrics,
  loadSceneOperationState,
  serializeSceneOperationState,
  validateSceneOperationPayload,
} from '../scene-operation-runtime.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('fresh progress exposes the exact first node and immutable campaign metrics', () => {
  const state = createSceneOperationState();
  const operation = SCENE_OPERATIONS.operations[0];
  const progress = getSceneOperationProgress(state, operation.beatId);
  assert.equal(progress.status, 'not-started');
  assert.equal(progress.currentNode.id, operation.nodes[0].id);
  assert.equal(progress.completedNodeCount, 0);
  assert.equal(Object.isFrozen(state), true);
  assert.deepEqual(getSceneOperationRuntimeMetrics(state), {
    operationCount: 60,
    nodeCount: 183,
    completedOperationCount: 0,
    completedNodeCount: 0,
    remainingOperationCount: 60,
    remainingNodeCount: 183,
    campaignComplete: false,
  });
});

test('nodes require exact order and exact field position, then complete once', () => {
  const operation = getSceneOperation('p00-delivery-in-rain');
  let state = createSceneOperationState();
  const first = operation.nodes[0];
  assert.equal(advanceSceneOperation(state, operation.beatId, operation.nodes[1].id, { at: operation.nodes[1].at }).code, 'wrong-node');
  assert.equal(advanceSceneOperation(state, operation.beatId, first.id, { at: '99,99' }).code, 'wrong-position');
  for (const node of operation.nodes) {
    const result = advanceSceneOperation(state, operation.beatId, node.id, { at: node.at, encounterWins: {} });
    assert.equal(result.ok, true);
    state = result.state;
  }
  const progress = getSceneOperationProgress(state, operation.beatId);
  assert.equal(progress.complete, true);
  assert.deepEqual(progress.completedNodeIds, operation.nodes.map((node) => node.id));
  assert.equal(advanceSceneOperation(state, operation.beatId, operation.nodes.at(-1).id, { at: operation.nodes.at(-1).at }).code, 'already-complete');
});

test('encounter-bound final nodes fail closed until every explicit victory exists', () => {
  const operation = getSceneOperation('c1-04-flooded-cedars');
  let state = createSceneOperationState();
  for (const node of operation.nodes.slice(0, -1)) {
    state = advanceSceneOperation(state, operation.beatId, node.id, { at: node.at }).state;
  }
  const final = operation.nodes.at(-1);
  const missing = advanceSceneOperation(state, operation.beatId, final.id, {
    at: final.at,
    encounterWins: { [final.encounterIds[0]]: 1 },
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'encounter-victory-required');
  assert.deepEqual(missing.pendingEncounterIds, final.encounterIds.slice(1));
  const completed = advanceSceneOperation(state, operation.beatId, final.id, {
    at: final.at,
    encounterWins: Object.fromEntries(final.encounterIds.map((id) => [id, 1])),
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.beatCompleted, true);
});

test('strict save validation rejects skipped prefixes, incoherent status, and unknown keys', () => {
  const operation = SCENE_OPERATIONS.operations[0];
  const base = createSceneOperationState();
  const corrupt = {
    ...base,
    records: [{
      beatId: operation.beatId,
      status: 'completed',
      nextNodeIndex: 1,
      completedNodeIds: [operation.nodes[1].id],
      invented: true,
    }],
  };
  const validation = validateSceneOperationPayload(corrupt);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(' '), /exactly|prefix|status/);
  assert.equal(loadSceneOperationState('{broken').ok, false);
});

test('serialization and storage round-trip canonically and recover safely', () => {
  const operation = SCENE_OPERATIONS.operations[0];
  const advanced = advanceSceneOperation(
    createSceneOperationState(),
    operation.beatId,
    operation.nodes[0].id,
    { at: operation.nodes[0].at },
  ).state;
  const loaded = loadSceneOperationState(serializeSceneOperationState(advanced));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state, advanced);
  const storage = memoryStorage();
  const adapter = createSceneOperationStorageAdapter(storage, 'test.scene-operations');
  assert.equal(adapter.save(advanced).ok, true);
  assert.deepEqual(adapter.load().state, advanced);
  assert.equal(adapter.clear().ok, true);
  assert.equal(adapter.load().found, false);
});
