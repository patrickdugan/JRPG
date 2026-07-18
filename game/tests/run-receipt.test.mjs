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
  createRunReceipt,
  createRunReceiptStorageAdapter,
  getRunProofReport,
  loadRunReceipt,
  recordRunBeatCompletion,
  recordRunFirstClear,
  recordRunPlaytime,
  RUN_RECEIPT_STATUSES,
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
  assert.equal(clean.state.cleanStart, true);
  assert.equal(clean.state.status, RUN_RECEIPT_STATUSES.ACTIVE);
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

  const proof = getRunProofReport(completed);
  assert.equal(proof.runScoped, true);
  assert.equal(proof.runId, completed.runId);
  assert.equal(proof.campaignComplete, true);
  assert.equal(proof.firstClearsComplete, true);
  assert.equal(proof.durationProven, true);
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
