import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdvancementState } from '../advancement.mjs';
import { createArchiveRecordStorageAdapter } from '../archive-record-runtime.mjs';
import { createCampConversationStorageAdapter } from '../camp-conversation-runtime.mjs';
import { createPartyCouncilStorageAdapter } from '../party-council-runtime.mjs';
import { createCampaignState } from '../progression.mjs';
import {
  DEFAULT_RUN_RECEIPT_SAVE_KEY,
  createRunReceipt,
  recordRunPlaytime,
  serializeRunReceipt,
} from '../run-receipt.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function receipt(runId) {
  const created = createRunReceipt({
    runId,
    campaignState: createCampaignState(),
    advancementState: createAdvancementState(),
  });
  assert.equal(created.ok, true);
  return created.state;
}

test('all finite narrative adapters reject a stale first write after New Game changes the clean-run identity', () => {
  const storage = memoryStorage();
  storage.setItem(DEFAULT_RUN_RECEIPT_SAVE_KEY, serializeRunReceipt(receipt('finite-narrative-run-a')));
  const cases = [
    createCampConversationStorageAdapter(storage, 'test.run-bound.camp'),
    createPartyCouncilStorageAdapter(storage, 'test.run-bound.council'),
    createArchiveRecordStorageAdapter(storage, 'test.run-bound.archive'),
  ];
  const loadedStates = cases.map((adapter) => {
    const loaded = adapter.load();
    assert.equal(loaded.ok, true);
    assert.equal(loaded.state.runId, 'finite-narrative-run-a');
    return loaded.state;
  });

  storage.setItem(DEFAULT_RUN_RECEIPT_SAVE_KEY, serializeRunReceipt(receipt('finite-narrative-run-b')));
  for (const [index, adapter] of cases.entries()) {
    assert.equal(adapter.save(loadedStates[index]).ok, false, `${adapter.key} must reject a stale-tab write after New Game`);
  }
});

test('receipt progress within one run does not invalidate a finite narrative adapter', () => {
  const storage = memoryStorage();
  let run = receipt('finite-narrative-same-run');
  storage.setItem(DEFAULT_RUN_RECEIPT_SAVE_KEY, serializeRunReceipt(run));
  const adapter = createPartyCouncilStorageAdapter(storage, 'test.same-run.council');
  const loaded = adapter.load();
  assert.equal(loaded.ok, true);
  run = recordRunPlaytime(run, run.runId, 'menusAndRest', 1_000).state;
  storage.setItem(DEFAULT_RUN_RECEIPT_SAVE_KEY, serializeRunReceipt(run));
  assert.equal(adapter.save(loaded.state).ok, true);
});

test('a new adapter discards and safely replaces old-run payloads when namespace deletion failed', () => {
  const storage = memoryStorage();
  storage.setItem(DEFAULT_RUN_RECEIPT_SAVE_KEY, serializeRunReceipt(receipt('failed-clear-old-run')));
  const factories = [
    [createCampConversationStorageAdapter, 'test.failed-clear.camp'],
    [createPartyCouncilStorageAdapter, 'test.failed-clear.council'],
    [createArchiveRecordStorageAdapter, 'test.failed-clear.archive'],
  ];
  for (const [factory, key] of factories) {
    const oldAdapter = factory(storage, key);
    const oldState = oldAdapter.load().state;
    assert.equal(oldAdapter.save(oldState).ok, true);
  }

  storage.setItem(DEFAULT_RUN_RECEIPT_SAVE_KEY, serializeRunReceipt(receipt('failed-clear-new-run')));
  for (const [factory, key] of factories) {
    const newAdapter = factory(storage, key);
    const loaded = newAdapter.load();
    assert.equal(loaded.ok, true);
    assert.equal(loaded.resetForRun, true);
    assert.equal(loaded.state.runId, 'failed-clear-new-run');
    assert.equal(loaded.state.revision, 0);
    assert.equal(loaded.state.records.length, 0);
    assert.equal(newAdapter.save(loaded.state).ok, true);
    assert.equal(newAdapter.load().state.runId, 'failed-clear-new-run');
  }
});

test('pre-runId payloads fail closed to fresh current-run state and are replaceable without manual clearing', () => {
  const storage = memoryStorage();
  storage.setItem(DEFAULT_RUN_RECEIPT_SAVE_KEY, serializeRunReceipt(receipt('run-id-migration')));
  const factories = [
    [createCampConversationStorageAdapter, 'test.migration.camp'],
    [createPartyCouncilStorageAdapter, 'test.migration.council'],
    [createArchiveRecordStorageAdapter, 'test.migration.archive'],
  ];
  for (const [factory, key] of factories) {
    const writer = factory(storage, key);
    const current = writer.load().state;
    assert.equal(writer.save(current).ok, true);
    const legacy = JSON.parse(storage.getItem(key));
    delete legacy.runId;
    storage.setItem(key, JSON.stringify(legacy));

    const migrating = factory(storage, key);
    const loaded = migrating.load();
    assert.equal(loaded.ok, false);
    assert.equal(loaded.state.runId, 'run-id-migration');
    assert.equal(loaded.state.revision, 0);
    assert.equal(loaded.state.records.length, 0);
    assert.equal(migrating.save(loaded.state).ok, true);
    assert.equal(migrating.load().ok, true);
    assert.equal(migrating.load().state.runId, 'run-id-migration');
  }
});
