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
import {
  DEFAULT_RUN_RECEIPT_SAVE_KEY,
  LEGACY_RUN_RECEIPT_V2_SAVE_KEY,
  loadRunReceipt,
  serializeRunReceipt,
} from '../run-receipt.mjs';
import { serializeSceneOperationState } from '../scene-operation-runtime.mjs';
import { STORYWORLD_CLUSTERS } from '../content/storyworld-encounters.generated.mjs';
import {
  advanceStoryworldEncounter,
  beginStoryworldEncounter,
  chooseStoryworldOption,
  createStoryworldState,
  getStoryworldProgress,
  getVisibleStoryworldOptions,
  LEGACY_STORYWORLD_CATALOG_IDENTITIES,
  loadStoryworldState,
  serializeStoryworldState,
} from '../storyworld-runtime.mjs';
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
    storyworld: serializeStoryworldState(createStoryworldState({ runId: RUN_ID })),
  };
  return RECOVERY_CHECKPOINT_AUTHORITIES.map(({ id, key }) => [key, serializedById[id]]);
}

function snapshot(storage) {
  return RECOVERY_CHECKPOINT_AUTHORITIES.map(({ key }) => [key, storage.getItem(key)]);
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function legacyV1Checkpoint(currentCheckpoint) {
  const {
    storyworldCompletedClusterCount: _completed,
    storyworldRequiredClusterCount: _required,
    storyworldNarrativeComplete: _complete,
    storyworldProofEligible: _eligible,
    storyworldCatalogSignature: _catalog,
    ...summary
  } = currentCheckpoint.summary;
  const records = currentCheckpoint.records.slice(0, -1).map((record) => {
    if (record.id !== 'runReceipt') return record;
    const current = JSON.parse(record.serialized);
    const legacyV2 = {
      schemaVersion: 2,
      campaignId: current.campaignId,
      runId: current.runId,
      cleanStart: current.cleanStart,
      status: current.status,
      creditsCompleted: current.creditsCompleted,
      playtime: current.playtime,
      completedBeatIds: current.completedBeatIds,
      firstClearEncounterIds: current.firstClearEncounterIds,
      revision: current.revision,
    };
    return { id: record.id, key: LEGACY_RUN_RECEIPT_V2_SAVE_KEY, serialized: JSON.stringify(legacyV2) };
  });
  const body = {
    schemaVersion: 1,
    kind: currentCheckpoint.kind,
    campaignId: currentCheckpoint.campaignId,
    recoveryOnly: currentCheckpoint.recoveryOnly,
    createdAtEpochMs: currentCheckpoint.createdAtEpochMs,
    summary,
    records,
  };
  return { ...body, signature: `fnv1a32:${fnv1a32(JSON.stringify(body))}` };
}

function legacyStoryworldCheckpoint(currentCheckpoint, identityIndex = 0) {
  const identity = LEGACY_STORYWORLD_CATALOG_IDENTITIES[identityIndex];
  const records = currentCheckpoint.records.map((record) => {
    if (record.id !== 'storyworld') return record;
    const state = JSON.parse(record.serialized);
    return {
      ...record,
      serialized: JSON.stringify({
        ...state,
        sourceIFID: identity.sourceIFID,
        sourceHash: identity.sourceHash,
        catalogSignature: identity.catalogSignature,
      }),
    };
  });
  const body = {
    ...Object.fromEntries(Object.entries(currentCheckpoint).filter(([key]) => key !== 'signature')),
    summary: {
      ...currentCheckpoint.summary,
      storyworldCatalogSignature: identity.catalogSignature,
    },
    records,
  };
  return { ...body, signature: `fnv1a32:${fnv1a32(JSON.stringify(body))}` };
}

function resolveStoryworldCluster(state, cluster) {
  state = beginStoryworldEncounter(state, cluster.id).state;
  state = chooseStoryworldOption(
    state,
    cluster.id,
    getVisibleStoryworldOptions(state, cluster.id)[0].id,
  ).state;
  state = advanceStoryworldEncounter(state, cluster.id).state;
  const progress = getStoryworldProgress(state, cluster.id);
  if (!progress.outcome.terminal) {
    state = chooseStoryworldOption(
      state,
      cluster.id,
      getVisibleStoryworldOptions(state, cluster.id)[0].id,
    ).state;
  }
  return advanceStoryworldEncounter(state, cluster.id).state;
}

function incompatibleCorrectionsDeskCheckpoint(currentCheckpoint, suffix, outcomeEncounterId) {
  const identity = LEGACY_STORYWORLD_CATALOG_IDENTITIES[1];
  let state = createStoryworldState({ runId: RUN_ID });
  for (const cluster of STORYWORLD_CLUSTERS.slice(0, 9)) state = resolveStoryworldCluster(state, cluster);
  state = {
    ...state,
    sourceIFID: identity.sourceIFID,
    sourceHash: identity.sourceHash,
    catalogSignature: identity.catalogSignature,
    records: [
      ...state.records,
      {
        clusterId: 'sw10-corrections-desk',
        phase: 'complete',
        entryOptionId: 'page_sw10_decision_opt_annotate-errors',
        entryReactionId: `page_sw10_decision_opt_annotate-errors_r_${suffix}`,
        outcomeEncounterId,
        outcomeOptionId: null,
        outcomeReactionId: null,
      },
    ],
    revision: state.revision + 4,
  };
  const records = currentCheckpoint.records.map((record) => (
    record.id === 'storyworld' ? { ...record, serialized: JSON.stringify(state) } : record
  ));
  const body = {
    ...Object.fromEntries(Object.entries(currentCheckpoint).filter(([key]) => key !== 'signature')),
    summary: {
      ...currentCheckpoint.summary,
      storyworldCompletedClusterCount: 10,
      storyworldRequiredClusterCount: 10,
      storyworldNarrativeComplete: true,
      storyworldProofEligible: true,
      storyworldCatalogSignature: identity.catalogSignature,
    },
    records,
  };
  return { ...body, signature: `fnv1a32:${fnv1a32(JSON.stringify(body))}` };
}

test('recovery checkpoint round-trips all fourteen exact authorities with a reconciled Storyworld summary', () => {
  const storage = new MemoryStorage(completeEntries());
  const created = createRecoveryCheckpoint(storage, { createdAtEpochMs: 1_700_000_000_000 });
  assert.equal(created.ok, true, created.errors?.join(' '));
  assert.equal(created.checkpoint.schemaVersion, 2);
  assert.equal(created.checkpoint.records.length, 14);
  assert.equal(created.checkpoint.recoveryOnly, true);
  assert.equal(created.checkpoint.summary.runId, RUN_ID);
  assert.equal(created.checkpoint.summary.completedBeatCount, 60);
  assert.equal(created.checkpoint.summary.firstClearCount, 23);
  assert.equal(created.checkpoint.summary.routeCompletedActivityCount, 215);
  assert.equal(created.checkpoint.summary.routeRequiredActivityCount, 215);
  assert.equal(created.checkpoint.summary.routeCreditsReady, true);
  assert.equal(created.checkpoint.summary.storyworldCompletedClusterCount, 0);
  assert.equal(created.checkpoint.summary.storyworldRequiredClusterCount, 11);
  assert.equal(created.checkpoint.summary.storyworldNarrativeComplete, false);
  assert.equal(created.checkpoint.summary.storyworldProofEligible, true);
  assert.match(created.checkpoint.summary.storyworldCatalogSignature, /^sha256:[0-9a-f]{64}$/u);
  assert.match(created.checkpoint.signature, /^fnv1a32:[0-9a-f]{8}$/u);
  const serialized = serializeRecoveryCheckpoint(created.checkpoint);
  const validated = validateRecoveryCheckpoint(serialized);
  assert.equal(validated.ok, true, validated.errors?.join(' '));
  assert.deepEqual(validated.checkpoint, created.checkpoint);
  assert.equal(Object.isFrozen(validated.checkpoint.records[0]), true);
});

test('signed v1 checkpoints remain valid and restore a synthesized proof-ineligible Storyworld authority', () => {
  const current = createRecoveryCheckpoint(
    new MemoryStorage(completeEntries()),
    { createdAtEpochMs: 1_700_000_000_001 },
  ).checkpoint;
  const legacy = legacyV1Checkpoint(current);
  const validated = validateRecoveryCheckpoint(legacy);
  assert.equal(validated.ok, true, validated.errors?.join(' '));
  assert.equal(validated.sourceSchemaVersion, 1);
  assert.equal(validated.requiresMigration, true);
  assert.equal(validated.states.storyworld.runId, RUN_ID);
  assert.equal(validated.states.storyworld.coverageStartBeatIndex, 60);
  assert.equal(validated.states.storyworld.proofEligible, false);
  assert.equal(validated.migrationRecord.id, 'storyworld');
  assert.equal(validated.migratedRunReceiptRecord.key, DEFAULT_RUN_RECEIPT_SAVE_KEY);

  const prior = RECOVERY_CHECKPOINT_AUTHORITIES.map(({ id, key }) => [key, `later-${id}`]);
  const destination = new MemoryStorage(prior);
  const restored = restoreRecoveryCheckpoint(destination, legacy);
  assert.equal(restored.ok, true, restored.errors?.join(' '));
  assert.equal(restored.migratedFromSchemaVersion, 1);
  assert.equal(restored.writesApplied, 14);
  const storyworldRecord = RECOVERY_CHECKPOINT_AUTHORITIES.at(-1);
  const migrated = loadStoryworldState(destination.getItem(storyworldRecord.key));
  assert.equal(migrated.ok, true, migrated.errors?.join(' '));
  assert.equal(migrated.state.proofEligible, false);
  assert.equal(migrated.state.coverageStartBeatIndex, 60);
  for (const record of legacy.records.filter(({ id }) => id !== 'runReceipt')) {
    assert.equal(destination.getItem(record.key), record.serialized);
  }
  const migratedReceipt = loadRunReceipt(destination.getItem(DEFAULT_RUN_RECEIPT_SAVE_KEY));
  assert.equal(migratedReceipt.ok, true, migratedReceipt.errors?.join(' '));
  assert.equal(migratedReceipt.state.schemaVersion, 3);
  assert.equal(migratedReceipt.state.runId, RUN_ID);
  assert.equal(destination.getItem(LEGACY_RUN_RECEIPT_V2_SAVE_KEY), null,
    'restore writes the migrated receipt to the active key instead of a stale fallback key');
});

test('signed pre-Nikola checkpoints restore all fourteen authorities with migrated Storyworld identity', () => {
  const current = createRecoveryCheckpoint(
    new MemoryStorage(completeEntries()),
    { createdAtEpochMs: 1_700_000_000_002 },
  ).checkpoint;
  const legacy = legacyStoryworldCheckpoint(current);
  const validated = validateRecoveryCheckpoint(legacy);
  assert.equal(validated.ok, true, validated.errors?.join(' '));
  assert.equal(validated.requiresMigration, true);
  assert.equal(validated.sourceSchemaVersion, 2);
  assert.equal(validated.migrationId, 'lise-to-nikola-canon-v1');
  assert.equal(validated.migrationRecord.id, 'storyworld');

  const destination = new MemoryStorage(
    RECOVERY_CHECKPOINT_AUTHORITIES.map(({ id, key }) => [key, `later-${id}`]),
  );
  const restored = restoreRecoveryCheckpoint(destination, legacy);
  assert.equal(restored.ok, true, restored.errors?.join(' '));
  assert.equal(restored.writesApplied, 14);
  assert.equal(restored.migrationId, 'lise-to-nikola-canon-v1');
  const storyworldRecord = RECOVERY_CHECKPOINT_AUTHORITIES.at(-1);
  const loaded = loadStoryworldState(destination.getItem(storyworldRecord.key));
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.equal(Object.hasOwn(loaded, 'migrated'), false, 'restored authority already uses current hashes');
  assert.notEqual(loaded.state.catalogSignature, LEGACY_STORYWORLD_CATALOG_IDENTITIES[0].catalogSignature);
});

test('signed early pre-Severed-Dragon checkpoints restore before the revised Chapter 9 sequence', () => {
  const current = createRecoveryCheckpoint(
    new MemoryStorage(completeEntries()),
    { createdAtEpochMs: 1_700_000_000_003 },
  ).checkpoint;
  const legacy = legacyStoryworldCheckpoint(current, 1);
  const validated = validateRecoveryCheckpoint(legacy);
  assert.equal(validated.ok, true, validated.errors?.join(' '));
  assert.equal(validated.requiresMigration, true);
  assert.equal(validated.migrationId, 'severed-dragon-ending-v1');

  const destination = new MemoryStorage();
  const restored = restoreRecoveryCheckpoint(destination, legacy);
  assert.equal(restored.ok, true, restored.errors?.join(' '));
  assert.equal(restored.writesApplied, 14);
  assert.equal(restored.migrationId, 'severed-dragon-ending-v1');
  const storyworldRecord = RECOVERY_CHECKPOINT_AUTHORITIES.at(-1);
  const loaded = loadStoryworldState(destination.getItem(storyworldRecord.key));
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.equal(Object.hasOwn(loaded, 'migrated'), false, 'restored authority already uses current hashes');
  assert.notEqual(loaded.state.catalogSignature, LEGACY_STORYWORLD_CATALOG_IDENTITIES[1].catalogSignature);
});

test('signed pre-English-heiress checkpoints restore complete compatible Storyworld history', () => {
  const current = createRecoveryCheckpoint(
    new MemoryStorage(completeEntries()),
    { createdAtEpochMs: 1_700_000_000_005 },
  ).checkpoint;
  const legacy = legacyStoryworldCheckpoint(current, 2);
  const validated = validateRecoveryCheckpoint(legacy);
  assert.equal(validated.ok, true, validated.errors?.join(' '));
  assert.equal(validated.requiresMigration, true);
  assert.equal(validated.migrationId, 'english-heiress-lineage-v1');

  const destination = new MemoryStorage();
  const restored = restoreRecoveryCheckpoint(destination, legacy);
  assert.equal(restored.ok, true, restored.errors?.join(' '));
  assert.equal(restored.writesApplied, 14);
  assert.equal(restored.migrationId, 'english-heiress-lineage-v1');
  const storyworldRecord = RECOVERY_CHECKPOINT_AUTHORITIES.at(-1);
  const loaded = loadStoryworldState(destination.getItem(storyworldRecord.key));
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.equal(Object.hasOwn(loaded, 'migrated'), false);
  assert.notEqual(loaded.state.catalogSignature, LEGACY_STORYWORLD_CATALOG_IDENTITIES[2].catalogSignature);
});

test('signed historical Corrections Desk checkpoints fail closed for both old outcomes before any write', () => {
  const current = createRecoveryCheckpoint(
    new MemoryStorage(completeEntries()),
    { createdAtEpochMs: 1_700_000_000_004 },
  ).checkpoint;
  for (const [suffix, outcomeEncounterId] of [
    ['accord', 'page_end_corrections_visible'],
    ['revision', 'page_end_limits_posted'],
  ]) {
    const legacy = incompatibleCorrectionsDeskCheckpoint(current, suffix, outcomeEncounterId);
    const validated = validateRecoveryCheckpoint(legacy);
    assert.equal(validated.ok, false);
    assert.match(validated.errors.join(' '), /cannot be migrated without inventing a political choice/u);

    const prior = RECOVERY_CHECKPOINT_AUTHORITIES.map(({ id, key }) => [key, `prior-${id}-${suffix}`]);
    const destination = new MemoryStorage(prior);
    const restored = restoreRecoveryCheckpoint(destination, legacy);
    assert.equal(restored.ok, false);
    assert.deepEqual(snapshot(destination), prior);
  }
});

test('checkpoint creation and validation reject omissions, corruption, mixed runs, and signature drift before writes', () => {
  const entries = completeEntries();
  const missing = new MemoryStorage(entries.slice(1));
  assert.match(createRecoveryCheckpoint(missing).errors.join(' '), /campaign has no serialized state/u);

  const corrupt = new MemoryStorage(entries);
  corrupt.setItem(RECOVERY_CHECKPOINT_AUTHORITIES[4].key, '{}');
  assert.match(createRecoveryCheckpoint(corrupt).errors.join(' '), /quests is invalid/u);

  const corruptStoryworld = new MemoryStorage(entries);
  corruptStoryworld.setItem(RECOVERY_CHECKPOINT_AUTHORITIES.at(-1).key, '{}');
  assert.match(createRecoveryCheckpoint(corruptStoryworld).errors.join(' '), /storyworld is invalid/u);

  const mixed = new MemoryStorage(entries);
  const other = JSON.parse(mixed.getItem(RECOVERY_CHECKPOINT_AUTHORITIES[10].key));
  other.runId = 'recovery-checkpoint-other-run';
  mixed.setItem(RECOVERY_CHECKPOINT_AUTHORITIES[10].key, JSON.stringify(other));
  assert.match(createRecoveryCheckpoint(mixed).errors.join(' '), /campConversations is not bound/u);

  const mixedStoryworld = new MemoryStorage(entries);
  const otherStoryworld = JSON.parse(mixedStoryworld.getItem(RECOVERY_CHECKPOINT_AUTHORITIES.at(-1).key));
  otherStoryworld.runId = 'recovery-checkpoint-other-run';
  mixedStoryworld.setItem(RECOVERY_CHECKPOINT_AUTHORITIES.at(-1).key, JSON.stringify(otherStoryworld));
  assert.match(createRecoveryCheckpoint(mixedStoryworld).errors.join(' '), /storyworld is not bound/u);

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
  assert.equal(restored.writesApplied, 14);
  assert.deepEqual(snapshot(destination), checkpoint.records.map(({ key, serialized }) => [key, serialized]));
  assert.doesNotMatch(JSON.stringify(snapshot(destination)), /later-/u);
});

test('v1 migration rolls all thirteen legacy writes back if the synthesized Storyworld write fails', () => {
  const current = createRecoveryCheckpoint(new MemoryStorage(completeEntries()), { createdAtEpochMs: 78 }).checkpoint;
  const legacy = legacyV1Checkpoint(current);
  const prior = RECOVERY_CHECKPOINT_AUTHORITIES.map(({ id, key }) => [key, `prior-${id}`]);
  const destination = new OneShotFailingStorage(prior, 14);
  const restored = restoreRecoveryCheckpoint(destination, legacy);
  assert.equal(restored.ok, false);
  assert.equal(restored.code, 'restore-write-failed');
  assert.equal(restored.writesApplied, 13);
  assert.equal(restored.rollbackComplete, true, restored.errors.join(' '));
  assert.deepEqual(snapshot(destination), prior);
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
