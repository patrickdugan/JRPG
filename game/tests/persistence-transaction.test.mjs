import assert from 'node:assert/strict';
import test from 'node:test';

import { commitPersistenceTransaction, stateSaveStep } from '../persistence-transaction.mjs';
import { createAdvancementState, createAdvancementStorageAdapter, recordEncounterWin } from '../advancement.mjs';
import { createLoadoutState, createLoadoutStorageAdapter, grantInventory } from '../loadout.mjs';
import { completeCurrentBeat, createCampaignState, createLocalStorageAdapter } from '../progression.mjs';

const reversible = (id, store, previousState, nextState) => stateSaveStep(
  id,
  store,
  previousState,
  nextState,
  { supportsOverwriteRollback: true },
);

function adapter(initial, failOn = new Set()) {
  let value = initial;
  let writes = 0;
  return {
    get value() { return value; },
    get writes() { return writes; },
    save(next) {
      writes += 1;
      if (failOn.has(writes)) return { ok: false, code: 'write-failed' };
      value = next;
      return { ok: true };
    },
  };
}

test('a complete persistence transaction commits every authority in order', () => {
  const story = adapter('story-old');
  const receipt = adapter('receipt-old');
  const result = commitPersistenceTransaction([
    reversible('story', story, story.value, 'story-new'),
    reversible('receipt', receipt, receipt.value, 'receipt-new'),
  ]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.committedIds, ['story', 'receipt']);
  assert.equal(story.value, 'story-new');
  assert.equal(receipt.value, 'receipt-new');
});

test('a later failure rolls prior authorities back before live state may change', () => {
  const quest = adapter('quest-old');
  const advancement = adapter('advancement-old');
  const loadout = adapter('loadout-old', new Set([1]));
  const result = commitPersistenceTransaction([
    reversible('quest', quest, quest.value, 'quest-new'),
    reversible('advancement', advancement, advancement.value, 'advancement-new'),
    reversible('loadout', loadout, loadout.value, 'loadout-new'),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.failedId, 'loadout');
  assert.equal(result.rollbackComplete, true);
  assert.deepEqual(result.rolledBackIds, ['advancement', 'quest']);
  assert.equal(quest.value, 'quest-old');
  assert.equal(advancement.value, 'advancement-old');
  assert.equal(loadout.value, 'loadout-old');
});

test('rollback failure is explicit instead of claiming atomic persistence', () => {
  const first = adapter('old', new Set([2]));
  const second = adapter('old', new Set([1]));
  const result = commitPersistenceTransaction([
    reversible('first', first, first.value, 'new'),
    reversible('second', second, second.value, 'new'),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.rollbackComplete, false);
  assert.deepEqual(result.rollbackFailedIds, ['first']);
  assert.equal(first.value, 'new');
});

test('state rollback must be explicitly limited to overwrite-capable adapters', () => {
  const store = adapter('old');
  assert.throws(
    () => stateSaveStep('cas-store', store, 'old', 'new'),
    /explicitly support overwrite rollback/,
  );
});

test('real campaign adapters restore earlier valid snapshots after a later authority fails', () => {
  const values = new Map();
  let failingKey = null;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (key === failingKey) throw new Error('quota');
      values.set(key, String(value));
    },
    removeItem: (key) => values.delete(key),
  };
  const campaignAdapter = createLocalStorageAdapter(storage, 'tx.campaign');
  const advancementAdapter = createAdvancementStorageAdapter(storage, 'tx.advancement');
  const loadoutAdapter = createLoadoutStorageAdapter(storage, 'tx.loadout');
  const oldCampaign = createCampaignState();
  const oldAdvancement = createAdvancementState();
  const oldLoadout = createLoadoutState();
  assert.equal(campaignAdapter.save(oldCampaign).ok, true);
  assert.equal(advancementAdapter.save(oldAdvancement).ok, true);
  assert.equal(loadoutAdapter.save(oldLoadout).ok, true);

  failingKey = 'tx.loadout';
  const result = commitPersistenceTransaction([
    reversible('campaign', campaignAdapter, oldCampaign, completeCurrentBeat(oldCampaign)),
    reversible('advancement', advancementAdapter, oldAdvancement, recordEncounterWin(oldAdvancement, 'c1-ash-wisps')),
    reversible('loadout', loadoutAdapter, oldLoadout, grantInventory(oldLoadout, { currency: 10 }).state),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.rollbackComplete, true);
  assert.deepEqual(campaignAdapter.load().state, oldCampaign);
  assert.deepEqual(advancementAdapter.load().state, oldAdvancement);
  assert.deepEqual(loadoutAdapter.load().value, oldLoadout);
});
