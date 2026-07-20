import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMPAIGN } from '../content/campaign.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import {
  createAdvancementState,
  recordEncounterWin,
} from '../advancement.mjs';
import {
  completeCurrentBeat,
  createCampaignState,
} from '../progression.mjs';
import {
  completeRunCredits,
  createRunReceipt,
  createRunReceiptStorageAdapter,
  getRunProofReport,
  loadRunReceipt,
  DEFAULT_RUN_RECEIPT_SAVE_KEY,
  LEGACY_RUN_RECEIPT_SAVE_KEY,
  LEGACY_RUN_RECEIPT_V2_SAVE_KEY,
  NARRATIVE_STORYWORLD_DECISION_IDS,
  recordRunBeatCompletion,
  recordRunFirstClear,
  recordRunPlaytime,
  recordRunStoryworldDecision,
  RUN_RECEIPT_PROFILE_CONTRACTS,
  RUN_RECEIPT_PROFILE_IDS,
  RUN_RECEIPT_STATUSES,
  RUN_RECEIPT_SCHEMA_VERSION,
  serializeRunReceipt,
  validateRunReceiptPayload,
} from '../run-receipt.mjs';

const BEAT_IDS = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => beat.id));
const ENCOUNTER_IDS = ENCOUNTERS.map((encounter) => encounter.id);

function start(runId = 'run-clean-0001') {
  const result = createRunReceipt({
    runId,
    campaignState: createCampaignState(),
    advancementState: createAdvancementState(),
  });
  assert.equal(result.ok, true, result.errors?.join(' '));
  return result.state;
}

function startNarrative(runId = 'run-narrative-0001') {
  const result = createRunReceipt({
    runId,
    campaignState: createCampaignState(),
    advancementState: createAdvancementState(),
    profileId: RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H,
  });
  assert.equal(result.ok, true, result.errors?.join(' '));
  return result.state;
}

function completeNarrativeStory(state) {
  let next = state;
  for (const beatId of BEAT_IDS) next = recordRunBeatCompletion(next, next.runId, beatId).state;
  for (const decisionId of NARRATIVE_STORYWORLD_DECISION_IDS) {
    next = recordRunStoryworldDecision(next, next.runId, decisionId).state;
  }
  return next;
}

function recordMinutes(state, minutes, category = 'narrative') {
  let next = state;
  for (let minute = 0; minute < minutes; minute += 1) {
    next = recordRunPlaytime(next, next.runId, category, 60_000).state;
  }
  return next;
}

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('a run receipt can start only beside pristine campaign and advancement states', () => {
  const clean = createRunReceipt({
    runId: 'run-clean-0001',
    campaignState: createCampaignState(),
    advancementState: createAdvancementState(),
  });
  assert.equal(clean.ok, true);
  assert.equal(clean.state.runId, 'run-clean-0001');
  assert.equal(clean.state.schemaVersion, RUN_RECEIPT_SCHEMA_VERSION);
  assert.equal(clean.state.cleanStart, true);
  assert.equal(clean.state.status, RUN_RECEIPT_STATUSES.ACTIVE);
  assert.equal(clean.state.profileId, RUN_RECEIPT_PROFILE_IDS.COMPLETIONIST_20H);
  assert.equal(clean.state.playtime.totalMs, 0);
  assert.equal(Object.isFrozen(clean.state), true);

  const dirtyCampaign = createRunReceipt({
    runId: 'run-dirty-campaign',
    campaignState: completeCurrentBeat(createCampaignState()),
    advancementState: createAdvancementState(),
  });
  assert.equal(dirtyCampaign.ok, false);
  assert.match(dirtyCampaign.errors.join(' '), /pristine New Game/);

  const dirtyAdvancement = createRunReceipt({
    runId: 'run-dirty-advance',
    campaignState: createCampaignState(),
    advancementState: recordEncounterWin(createAdvancementState(), ENCOUNTER_IDS[0]),
  });
  assert.equal(dirtyAdvancement.ok, false);
  assert.match(dirtyAdvancement.errors.join(' '), /advancement state must be.*pristine/);
  assert.equal(createRunReceipt({ runId: 'short' }).ok, false);
  assert.equal(createRunReceipt({
    runId: 'run-profile-bad',
    campaignState: createCampaignState(),
    advancementState: createAdvancementState(),
    profileId: 'invented-profile',
  }).ok, false);
});

test('narrative profile is explicit and records the ten Storyworld decisions in exact order', () => {
  let state = startNarrative('run-narrative-order');
  assert.equal(state.profileId, RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H);
  assert.equal(RUN_RECEIPT_PROFILE_CONTRACTS[state.profileId].minimumActiveMinutes, 300);
  assert.equal(RUN_RECEIPT_PROFILE_CONTRACTS[state.profileId].maximumActiveMinutes, 360);

  const outOfOrder = recordRunStoryworldDecision(
    state,
    state.runId,
    NARRATIVE_STORYWORLD_DECISION_IDS[1],
  );
  assert.equal(outOfOrder.ok, false);
  assert.equal(outOfOrder.code, 'out-of-order-storyworld-decision');

  state = recordRunStoryworldDecision(state, state.runId, NARRATIVE_STORYWORLD_DECISION_IDS[0]).state;
  const duplicate = recordRunStoryworldDecision(state, state.runId, NARRATIVE_STORYWORLD_DECISION_IDS[0]);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.recorded, false);
  assert.equal(duplicate.state.revision, state.revision);

  const completionist = start('run-no-storyworld');
  const notTracked = recordRunStoryworldDecision(
    completionist,
    completionist.runId,
    NARRATIVE_STORYWORLD_DECISION_IDS[0],
  );
  assert.equal(notTracked.ok, false);
  assert.equal(notTracked.code, 'profile-does-not-track-storyworld');
});

test('narrative credits require 60 canonical scenes, 10 Storyworld decisions, and 300 active minutes', () => {
  let state = startNarrative('run-narrative-proof');
  for (const beatId of BEAT_IDS) state = recordRunBeatCompletion(state, state.runId, beatId).state;
  for (const decisionId of NARRATIVE_STORYWORLD_DECISION_IDS.slice(0, -1)) {
    state = recordRunStoryworldDecision(state, state.runId, decisionId).state;
  }
  state = recordMinutes(state, 300);
  const missingDecision = completeRunCredits(state, state.runId);
  assert.equal(missingDecision.ok, false);
  assert.equal(missingDecision.code, 'story-incomplete');

  state = recordRunStoryworldDecision(state, state.runId, NARRATIVE_STORYWORLD_DECISION_IDS.at(-1)).state;
  const sealed = completeRunCredits(state, state.runId);
  assert.equal(sealed.ok, true, sealed.errors?.join(' '));
  const proof = getRunProofReport(sealed.state);
  assert.equal(proof.profileId, RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H);
  assert.equal(proof.profileLabel, 'Narrative 5-6 hour route');
  assert.equal(proof.canonicalStoryComplete, true);
  assert.equal(proof.storyworldDecisionsComplete, true);
  assert.equal(proof.completedStoryworldDecisionCount, 10);
  assert.equal(proof.requiredStoryworldDecisionCount, 10);
  assert.equal(proof.completedStoryworldPlayedSceneCount, 20);
  assert.equal(proof.requiredStoryworldPlayedSceneCount, 20);
  assert.equal(proof.playedSceneCount, 80);
  assert.equal(proof.requiredPlayedSceneCount, 80);
  assert.equal(proof.firstClearCount, 0);
  assert.equal(proof.requiredFirstClearCount, 0);
  assert.equal(proof.firstClearsComplete, true);
  assert.equal(proof.targetMinimumMinutes, 300);
  assert.equal(proof.targetMaximumMinutes, 360);
  assert.equal(proof.durationWithinTarget, true);
  assert.equal(proof.durationProven, true);
});

test('narrative credits reject sub-five-hour receipts but do not disqualify overtime', () => {
  let short = completeNarrativeStory(startNarrative('run-narrative-short'));
  short = recordMinutes(short, 299);
  const early = completeRunCredits(short, short.runId);
  assert.equal(early.ok, false);
  assert.equal(early.code, 'playtime-incomplete');

  const forged = JSON.parse(serializeRunReceipt(short));
  forged.status = RUN_RECEIPT_STATUSES.COMPLETE;
  forged.creditsCompleted = true;
  forged.revision += 1;
  const forgedValidation = validateRunReceiptPayload(forged);
  assert.equal(forgedValidation.ok, false);
  assert.match(forgedValidation.errors.join(' '), /300 active minutes/);

  let overtime = completeNarrativeStory(startNarrative('run-narrative-overtime'));
  overtime = recordMinutes(overtime, 361);
  overtime = completeRunCredits(overtime, overtime.runId).state;
  const overtimeProof = getRunProofReport(overtime);
  assert.equal(overtimeProof.durationWithinTarget, false);
  assert.equal(overtimeProof.overTargetMs, 60_000);
  assert.equal(overtimeProof.durationProven, true, 'the six-hour target is diagnostic, not a credits ceiling');
});

test('every sample and evidence transition requires the matching run ID', () => {
  const initial = start('run-bound-0001');
  const mismatch = recordRunPlaytime(initial, 'run-bound-0002', 'exploration', 1000, { chapterId: 'prologue' });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, 'run-id-mismatch');
  assert.deepEqual(mismatch.state, initial);

  const sampled = recordRunPlaytime(initial, initial.runId, 'exploration', 1000, { chapterId: 'prologue' });
  assert.equal(sampled.ok, true);
  assert.equal(sampled.state.playtime.totalMs, 1000);
  assert.equal(sampled.state.revision, 1);
  assert.equal(initial.playtime.totalMs, 0);

  const malformed = recordRunPlaytime(sampled.state, initial.runId, 'invented', 1000);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.code, 'invalid-playtime-sample');
  assert.deepEqual(malformed.state, sampled.state);
});

test('beat completion is a canonical run-local prefix and first clears are canonical and unique', () => {
  let state = start('run-evidence-001');
  const outOfOrder = recordRunBeatCompletion(state, state.runId, BEAT_IDS[1]);
  assert.equal(outOfOrder.ok, false);
  assert.equal(outOfOrder.code, 'out-of-order-beat');

  state = recordRunBeatCompletion(state, state.runId, BEAT_IDS[0]).state;
  const duplicateBeat = recordRunBeatCompletion(state, state.runId, BEAT_IDS[0]);
  assert.equal(duplicateBeat.ok, true);
  assert.equal(duplicateBeat.recorded, false);
  assert.equal(duplicateBeat.state.revision, state.revision);

  state = recordRunFirstClear(state, state.runId, ENCOUNTER_IDS.at(-1)).state;
  state = recordRunFirstClear(state, state.runId, ENCOUNTER_IDS[0]).state;
  assert.deepEqual(state.firstClearEncounterIds, [ENCOUNTER_IDS[0], ENCOUNTER_IDS.at(-1)]);
  const duplicateClear = recordRunFirstClear(state, state.runId, ENCOUNTER_IDS[0]);
  assert.equal(duplicateClear.recorded, false);
  assert.equal(duplicateClear.state.revision, state.revision);
  assert.equal(recordRunFirstClear(state, state.runId, 'invented-encounter').code, 'unknown-encounter');
});

test('proof uses only same-run zero-based time, completion, and first-clear evidence', () => {
  let completed = start('run-proof-0001');
  for (let minute = 0; minute < 1020; minute += 1) {
    completed = recordRunPlaytime(completed, completed.runId, 'exploration', 60_000).state;
  }
  for (let minute = 0; minute < 180; minute += 1) {
    completed = recordRunPlaytime(completed, completed.runId, 'grind', 60_000).state;
  }
  for (const encounterId of ENCOUNTER_IDS) completed = recordRunFirstClear(completed, completed.runId, encounterId).state;
  for (const beatId of BEAT_IDS) completed = recordRunBeatCompletion(completed, completed.runId, beatId).state;

  const storyProof = getRunProofReport(completed);
  assert.equal(completed.status, RUN_RECEIPT_STATUSES.ACTIVE, 'the final beat leaves post-final camp time open');
  assert.equal(storyProof.storyComplete, true);
  assert.equal(storyProof.creditsComplete, false);
  assert.equal(storyProof.campaignComplete, false);
  assert.equal(storyProof.durationProven, false, 'unsealed credits cannot prove duration');
  const postFinal = recordRunPlaytime(completed, completed.runId, 'menusAndRest', 500);
  assert.equal(postFinal.ok, true, 'post-final camp activity remains recordable');
  completed = completeRunCredits(postFinal.state, completed.runId).state;

  const proof = getRunProofReport(completed);
  assert.equal(proof.runScoped, true);
  assert.equal(proof.runId, completed.runId);
  assert.equal(proof.campaignComplete, true);
  assert.equal(proof.storyComplete, true);
  assert.equal(proof.creditsComplete, true);
  assert.equal(proof.firstClearsComplete, true);
  assert.equal(proof.durationProven, true);
  assert.equal(proof.targetMinimumMinutes, 1_200);
  assert.equal(proof.targetMaximumMinutes, null);
  assert.deepEqual(proof.missingBeatIds, []);
  assert.deepEqual(proof.missingFirstClearEncounterIds, []);

  const newRun = start('run-proof-0002');
  const newProof = getRunProofReport(newRun);
  assert.equal(newProof.totalMs, 0, 'prior-run time is not inherited');
  assert.equal(newProof.durationProven, false, 'prior completion cannot prove a new run');
  assert.equal(recordRunBeatCompletion(completed, newRun.runId, BEAT_IDS[0]).code, 'run-id-mismatch');

  const frozen = recordRunPlaytime(completed, completed.runId, 'exploration', 1000);
  assert.equal(frozen.ok, false);
  assert.equal(frozen.code, 'run-complete');
  assert.equal(frozen.state.playtime.totalMs, completed.playtime.totalMs);
});

test('credits cannot seal an unfinished story and explicit completion survives storage reload', () => {
  const initial = start('run-credits-0001');
  const early = completeRunCredits(initial, initial.runId);
  assert.equal(early.ok, false);
  assert.equal(early.code, 'story-incomplete');

  let storyComplete = initial;
  for (const beatId of BEAT_IDS) storyComplete = recordRunBeatCompletion(storyComplete, storyComplete.runId, beatId).state;
  const sealed = completeRunCredits(storyComplete, storyComplete.runId);
  assert.equal(sealed.ok, true);
  assert.equal(sealed.state.status, RUN_RECEIPT_STATUSES.COMPLETE);
  assert.equal(sealed.state.creditsCompleted, true);
  assert.equal(sealed.state.revision, storyComplete.revision + 1);

  const storage = new MemoryStorage();
  const adapter = createRunReceiptStorageAdapter(storage, 'credits-reload');
  assert.equal(adapter.save(sealed.state).ok, true);
  const reloaded = adapter.load();
  assert.equal(reloaded.ok, true);
  assert.equal(reloaded.state.creditsCompleted, true);
  assert.equal(getRunProofReport(reloaded.state).creditsComplete, true);
  assert.equal(recordRunPlaytime(reloaded.state, reloaded.state.runId, 'narrative', 1).code, 'run-complete');
});

test('schema-one receipts migrate to an active unsealed current receipt and persist under the new key', () => {
  let oldState = start('run-legacy-0001');
  for (const beatId of BEAT_IDS) oldState = recordRunBeatCompletion(oldState, oldState.runId, beatId).state;
  const legacyPayload = {
    schemaVersion: 1,
    campaignId: oldState.campaignId,
    runId: oldState.runId,
    cleanStart: true,
    status: RUN_RECEIPT_STATUSES.COMPLETE,
    playtime: oldState.playtime,
    completedBeatIds: oldState.completedBeatIds,
    firstClearEncounterIds: oldState.firstClearEncounterIds,
    revision: oldState.revision,
  };
  const migrated = loadRunReceipt(legacyPayload);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.fromSchemaVersion, 1);
  assert.equal(migrated.state.schemaVersion, RUN_RECEIPT_SCHEMA_VERSION);
  assert.equal(migrated.state.status, RUN_RECEIPT_STATUSES.ACTIVE);
  assert.equal(migrated.state.creditsCompleted, false);
  assert.equal(getRunProofReport(migrated.state).storyComplete, true);
  assert.equal(getRunProofReport(migrated.state).creditsComplete, false);

  const storage = new MemoryStorage();
  storage.setItem(LEGACY_RUN_RECEIPT_SAVE_KEY, JSON.stringify(legacyPayload));
  const adapter = createRunReceiptStorageAdapter(storage);
  const loaded = adapter.load();
  assert.equal(loaded.ok, true);
  assert.equal(loaded.migrationPersisted, true);
  assert.equal(storage.getItem(LEGACY_RUN_RECEIPT_SAVE_KEY), null);
  assert.ok(storage.getItem(DEFAULT_RUN_RECEIPT_SAVE_KEY));
  assert.equal(createRunReceiptStorageAdapter(storage).load().state.creditsCompleted, false);
  storage.setItem(LEGACY_RUN_RECEIPT_SAVE_KEY, JSON.stringify(legacyPayload));
  assert.equal(adapter.clear().ok, true);
  assert.equal(storage.getItem(DEFAULT_RUN_RECEIPT_SAVE_KEY), null);
  assert.equal(storage.getItem(LEGACY_RUN_RECEIPT_V2_SAVE_KEY), null);
  assert.equal(storage.getItem(LEGACY_RUN_RECEIPT_SAVE_KEY), null, 'clear cannot resurrect a legacy receipt');
});

test('schema-two receipts migrate to the completionist profile before schema-one fallback', () => {
  let current = start('run-v2-migration');
  current = recordRunPlaytime(current, current.runId, 'narrative', 60_000).state;
  current = recordRunBeatCompletion(current, current.runId, BEAT_IDS[0]).state;
  const v2Payload = {
    schemaVersion: 2,
    campaignId: current.campaignId,
    runId: current.runId,
    cleanStart: true,
    status: current.status,
    creditsCompleted: current.creditsCompleted,
    playtime: current.playtime,
    completedBeatIds: current.completedBeatIds,
    firstClearEncounterIds: current.firstClearEncounterIds,
    revision: current.revision,
  };
  const migrated = loadRunReceipt(v2Payload);
  assert.equal(migrated.ok, true, migrated.errors?.join(' '));
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.fromSchemaVersion, 2);
  assert.equal(migrated.state.schemaVersion, RUN_RECEIPT_SCHEMA_VERSION);
  assert.equal(migrated.state.profileId, RUN_RECEIPT_PROFILE_IDS.COMPLETIONIST_20H);
  assert.deepEqual(migrated.state.completedStoryworldDecisionIds, []);

  const storage = new MemoryStorage();
  storage.setItem(LEGACY_RUN_RECEIPT_V2_SAVE_KEY, JSON.stringify(v2Payload));
  storage.setItem(LEGACY_RUN_RECEIPT_SAVE_KEY, '{invalid-but-lower-priority');
  const loaded = createRunReceiptStorageAdapter(storage).load();
  assert.equal(loaded.ok, true, loaded.errors?.join(' '));
  assert.equal(loaded.fromSchemaVersion, 2);
  assert.equal(loaded.migrationPersisted, true);
  assert.equal(storage.getItem(LEGACY_RUN_RECEIPT_V2_SAVE_KEY), null);
  assert.ok(storage.getItem(DEFAULT_RUN_RECEIPT_SAVE_KEY));
});

test('run receipts round-trip, reject tampering, and persist independently', () => {
  let state = start('run-storage-001');
  state = recordRunPlaytime(state, state.runId, 'narrative', 500, { chapterId: 'prologue' }).state;
  state = recordRunFirstClear(state, state.runId, ENCOUNTER_IDS[0]).state;
  const serialized = serializeRunReceipt(state);
  assert.deepEqual(loadRunReceipt(serialized).state, state);

  const tampered = JSON.parse(serialized);
  tampered.revision += 1;
  const invalid = validateRunReceiptPayload(tampered);
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join(' '), /transition receipt/);

  const mixed = JSON.parse(serialized);
  mixed.firstClearEncounterIds = [ENCOUNTER_IDS.at(-1), ENCOUNTER_IDS[0]];
  assert.equal(validateRunReceiptPayload(mixed).ok, false);
  assert.equal(loadRunReceipt('{broken').ok, false);

  const storage = new MemoryStorage();
  const adapter = createRunReceiptStorageAdapter(storage, 'run-test');
  assert.deepEqual(adapter.load(), { ok: true, found: false, state: null, errors: [] });
  assert.deepEqual(adapter.save(state), { ok: true });
  assert.deepEqual(adapter.load().state, state);
  assert.deepEqual(adapter.clear(), { ok: true });
});
