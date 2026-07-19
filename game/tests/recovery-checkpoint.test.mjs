import assert from 'node:assert/strict';
import test from 'node:test';

import { serializeAdvancementState } from '../advancement.mjs';
import { serializeArchiveRecordState } from '../archive-record-runtime.mjs';
import { serializeCampConversationState } from '../camp-conversation-runtime.mjs';
import { runCanonicalCompletion } from '../canonical-run.mjs';
import { serializeFieldState } from '../field-runtime.mjs';
import { serializeLoadoutState } from '../loadout.mjs';
import { serializeNarrativeState } from '../narrative-runtime.mjs';
import { serializePartyCouncilState } from '../party-council-runtime.mjs';
import { createPlaytimeState, serializePlaytimeState } from '../playtime.mjs';
import { serializeCampaignState } from '../progression.mjs';
import { serializeQuestState } from '../quest-runtime.mjs';
import {
  createRecoveryCheckpoint,
  RECOVERY_CHECKPOINT_AUTHORITIES,
  restoreRecoveryCheckpoint,
  serializeRecoveryCheckpoint,
  validateRecoveryCheckpoint,
} from '../recovery-checkpoint.mjs';
import { runRequiredRouteCompletion } from '../required-route-run.mjs';
import { serializeRunReceipt } from '../run-receipt.mjs';
import { serializeSceneOperationState } from '../scene-operation-runtime.mjs';
import { serializeWitnessChronicleState } from '../witness-chronicle-runtime.mjs';

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

class OneShotFailingStorage extends MemoryStorage {
  constructor(entries, failAtWrite) {
    super(entries);
    this.failAtWrite = failAtWrite;
    this.writeCount = 0;
    this.failed = false;
  }

  setItem(key, value) {
    this.writeCount += 1;
    if (!this.failed && this.writeCount === this.failAtWrite) {
      this.failed = true;
      throw new Error('Injected recovery write failure.');
    }
    super.setItem(key, value);
  }
}

const RUN_ID = 'recovery-checkpoint-test-0001';
const canonical = runCanonicalCompletion({ runId: RUN_ID });
const required = runRequiredRouteCompletion({ runId: RUN_ID });

function completeEntries() {
  const serializedById = {
    campaign: serializeCampaignState(required.states.campaign),
    advancement: serializeAdvancementState(required.states.advancement),
    playtime: serializePlaytimeState(createPlaytimeState()),
    runReceipt: serializeRunReceipt(canonical.states.receipt),
    quests: serializeQuestState(required.states.quests),
    narrative: serializeNarrativeState(canonical.states.narrative),
    witnessChronicles: serializeWitnessChronicleState(required.states.witnessChronicles),
    sceneOperations: serializeSceneOperationState(canonical.states.sceneOperations),
    field: serializeFieldState(canonical.states.field),
    loadout: serializeLoadoutState(required.states.loadout),
    campConversations: serializeCampConversationState(required.states.campConversations),
    partyCouncils: serializePartyCouncilState(required.states.partyCouncils),
    archiveRecords: serializeArchiveRecordState(required.states.archiveRecords),
  };
  return RECOVERY_CHECKPOINT_AUTHORITIES.map(({ id, key }) => [key, serializedById[id]]);
}

function snapshot(storage) {
  return RECOVERY_CHECKPOINT_AUTHORITIES.map(({ key }) => [key, storage.getItem(key)]);
}

test('recovery checkpoint round-trips all thirteen exact authorities with a reconciled route summary', () => {
  const storage = new MemoryStorage(completeEntries());
  const created = createRecoveryCheckpoint(storage, { createdAtEpochMs: 1_700_000_000_000 });
  assert.equal(created.ok, true, created.errors?.join(' '));
  assert.equal(created.checkpoint.records.length, 13);
  assert.equal(created.checkpoint.recoveryOnly, true);
  assert.equal(created.checkpoint.summary.runId, RUN_ID);
  assert.equal(created.checkpoint.summary.completedBeatCount, 60);
  assert.equal(created.checkpoint.summary.firstClearCount, 23);
  assert.equal(created.checkpoint.summary.routeCompletedActivityCount, 215);
  assert.equal(created.checkpoint.summary.routeRequiredActivityCount, 215);
  assert.equal(created.checkpoint.summary.routeCreditsReady, true);
  assert.match(created.checkpoint.signature, /^fnv1a32:[0-9a-f]{8}$/u);
  const serialized = serializeRecoveryCheckpoint(created.checkpoint);
  const validated = validateRecoveryCheckpoint(serialized);
  assert.equal(validated.ok, true, validated.errors?.join(' '));
  assert.deepEqual(validated.checkpoint, created.checkpoint);
  assert.equal(Object.isFrozen(validated.checkpoint.records[0]), true);
});

test('checkpoint creation and validation reject omissions, corruption, mixed runs, and signature drift before writes', () => {
  const entries = completeEntries();
  const missing = new MemoryStorage(entries.slice(1));
  assert.match(createRecoveryCheckpoint(missing).errors.join(' '), /campaign has no serialized state/u);

  const corrupt = new MemoryStorage(entries);
  corrupt.setItem(RECOVERY_CHECKPOINT_AUTHORITIES[4].key, '{}');
  assert.match(createRecoveryCheckpoint(corrupt).errors.join(' '), /quests is invalid/u);

  const mixed = new MemoryStorage(entries);
  const other = JSON.parse(mixed.getItem(RECOVERY_CHECKPOINT_AUTHORITIES[10].key));
  other.runId = 'recovery-checkpoint-other-run';
  mixed.setItem(RECOVERY_CHECKPOINT_AUTHORITIES[10].key, JSON.stringify(other));
  assert.match(createRecoveryCheckpoint(mixed).errors.join(' '), /campConversations is not bound/u);

  const valid = createRecoveryCheckpoint(new MemoryStorage(entries), { createdAtEpochMs: 42 }).checkpoint;
  assert.equal(validateRecoveryCheckpoint({ ...valid, createdAtEpochMs: 43 }).ok, false);
  assert.equal(validateRecoveryCheckpoint('{not-json').ok, false);
  assert.equal(createRecoveryCheckpoint(new MemoryStorage(entries), { createdAtEpochMs: -1 }).ok, false);
});

test('restore replaces the whole snapshot exactly and never merges later progress', () => {
  const source = new MemoryStorage(completeEntries());
  const checkpoint = createRecoveryCheckpoint(source, { createdAtEpochMs: 77 }).checkpoint;
  const destinationEntries = RECOVERY_CHECKPOINT_AUTHORITIES.map(({ id, key }) => [key, `later-${id}`]);
  const destination = new MemoryStorage(destinationEntries);
  const restored = restoreRecoveryCheckpoint(destination, checkpoint);
  assert.equal(restored.ok, true, restored.errors?.join(' '));
  assert.equal(restored.writesApplied, 13);
  assert.deepEqual(snapshot(destination), checkpoint.records.map(({ key, serialized }) => [key, serialized]));
  assert.doesNotMatch(JSON.stringify(snapshot(destination)), /later-/u);
});

test('every injected restore write failure rolls all prior raw values back exactly', async (t) => {
  const checkpoint = createRecoveryCheckpoint(new MemoryStorage(completeEntries()), { createdAtEpochMs: 99 }).checkpoint;
  for (let failAtWrite = 1; failAtWrite <= RECOVERY_CHECKPOINT_AUTHORITIES.length; failAtWrite += 1) {
    await t.test(`write ${failAtWrite}`, () => {
      const prior = RECOVERY_CHECKPOINT_AUTHORITIES.map(({ id, key }) => [key, `prior-${id}`]);
      const destination = new OneShotFailingStorage(prior, failAtWrite);
      const restored = restoreRecoveryCheckpoint(destination, checkpoint);
      assert.equal(restored.ok, false);
      assert.equal(restored.code, 'restore-write-failed');
      assert.equal(restored.rollbackComplete, true, restored.errors.join(' '));
      assert.deepEqual(snapshot(destination), prior);
    });
  }
});
