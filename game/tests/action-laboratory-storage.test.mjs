import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_ADVANCEMENT_SAVE_KEY,
  createAdvancementState,
  serializeAdvancementState,
} from '../advancement.mjs';
import {
  canonicalStorageSnapshotsMatch,
  captureCanonicalStorageSnapshot,
  loadActionLaboratorySeed,
} from '../action-laboratory-storage.mjs';
import {
  advanceActionCampaignBattle,
  createActionCampaignBattleResult,
  createActionCampaignBattleSession,
} from '../action-campaign-battle-model.mjs';
import {
  DEFAULT_LOADOUT_SAVE_KEY,
  createLoadoutState,
  serializeLoadoutState,
} from '../loadout.mjs';
import { RECOVERY_CHECKPOINT_AUTHORITIES } from '../recovery-checkpoint.mjs';

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
    this.writeCount = 0;
  }

  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.writeCount += 1; this.values.set(key, String(value)); }
  removeItem(key) { this.writeCount += 1; this.values.delete(key); }
}

test('Action Lab seed loading is read-only and detached from canonical states', () => {
  const canonicalAdvancement = createAdvancementState();
  const canonicalLoadout = createLoadoutState();
  const storage = new MemoryStorage([
    [DEFAULT_ADVANCEMENT_SAVE_KEY, serializeAdvancementState(canonicalAdvancement)],
    [DEFAULT_LOADOUT_SAVE_KEY, serializeLoadoutState(canonicalLoadout)],
  ]);
  const before = captureCanonicalStorageSnapshot(storage);
  const seed = loadActionLaboratorySeed(storage);
  const after = captureCanonicalStorageSnapshot(storage);

  assert.equal(storage.writeCount, 0);
  assert.equal(canonicalStorageSnapshotsMatch(before, after), true);
  assert.deepEqual(seed.advancement, canonicalAdvancement);
  assert.deepEqual(seed.loadout, canonicalLoadout);
  assert.notEqual(seed.advancement, canonicalAdvancement);
  assert.notEqual(seed.loadout, canonicalLoadout);
  assert.equal(Object.isFrozen(seed.advancement), true);
  assert.equal(Object.isFrozen(seed.loadout), true);
});

test('canonical snapshot preserves every authority raw value and detects one-byte changes', () => {
  const storage = new MemoryStorage(RECOVERY_CHECKPOINT_AUTHORITIES.map(({ key }, index) => [key, `raw-${index}`]));
  const before = captureCanonicalStorageSnapshot(storage);
  assert.equal(before.length, RECOVERY_CHECKPOINT_AUTHORITIES.length);
  assert.deepEqual(before.map(({ value }) => value), RECOVERY_CHECKPOINT_AUTHORITIES.map((_, index) => `raw-${index}`));

  storage.values.set(RECOVERY_CHECKPOINT_AUTHORITIES[0].key, 'raw-changed');
  const after = captureCanonicalStorageSnapshot(storage);
  assert.equal(canonicalStorageSnapshotsMatch(before, after), false);
});

test('Action Lab victory and defeat leave every canonical storage byte unchanged', () => {
  const storage = new MemoryStorage(RECOVERY_CHECKPOINT_AUTHORITIES.map(({ key }, index) => [key, `sentinel-${index}`]));
  storage.values.set(DEFAULT_ADVANCEMENT_SAVE_KEY, serializeAdvancementState(createAdvancementState()));
  storage.values.set(DEFAULT_LOADOUT_SAVE_KEY, serializeLoadoutState(createLoadoutState()));
  const before = captureCanonicalStorageSnapshot(storage);

  const victorySeed = loadActionLaboratorySeed(storage);
  const victorySession = createActionCampaignBattleSession({
    encounterId: 'c1-cinder-hounds',
    advancementState: victorySeed.advancement,
    loadoutState: victorySeed.loadout,
  });
  for (const actor of victorySession.kernel.actors.values()) if (actor.faction === 'enemy') actor.hp = 0;
  const victory = advanceActionCampaignBattle(victorySession, 20);
  assert.equal(victory.outcome, 'victory');
  assert.equal(createActionCampaignBattleResult(victorySession).result, 'victory');

  const defeatSeed = loadActionLaboratorySeed(storage);
  const defeatSession = createActionCampaignBattleSession({
    encounterId: 'c1-cinder-hounds',
    advancementState: defeatSeed.advancement,
    loadoutState: defeatSeed.loadout,
  });
  for (const actor of defeatSession.kernel.actors.values()) if (actor.faction === 'player') actor.hp = 0;
  const defeat = advanceActionCampaignBattle(defeatSession, 20);
  assert.equal(defeat.outcome, 'defeat');

  const after = captureCanonicalStorageSnapshot(storage);
  assert.equal(storage.writeCount, 0);
  assert.equal(canonicalStorageSnapshotsMatch(before, after), true);
  assert.deepEqual(after, before);
});
