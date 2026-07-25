import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdvancementState } from '../advancement.mjs';
import { getCampaignRouteSchedule } from '../campaign-route-scheduler.mjs';
import { createCampaignState } from '../progression.mjs';
import {
  RUN_RECEIPT_PROFILE_IDS,
  createRunReceipt,
  recordRunBeatCompletion,
  recordRunPlaytime,
  recordRunStoryworldDecision,
} from '../run-receipt.mjs';
import {
  advanceStoryworldEncounter,
  beginStoryworldEncounter,
  chooseStoryworldOption,
  createLegacyStoryworldState,
  createStoryworldState,
  getRequiredStoryworldClusterIds,
  getStoryworldProgress,
  getStoryworldRouteTheater,
  getVisibleStoryworldOptions,
} from '../storyworld-runtime.mjs';
import { deriveNarrativeCreditsGate } from '../narrative-credits-gate.mjs';

const RUN_ID = 'narrative-gate-run-001';

function resolveCluster(storyworld, clusterId, theater) {
  let next = beginStoryworldEncounter(storyworld, clusterId).state;
  const entryOptions = getVisibleStoryworldOptions(next, clusterId);
  const entryOptionIndex = clusterId === 'sw3-sayos-warehouse-conditions'
    ? { salt: 0, ash: 1, paper: 2 }[theater]
    : 0;
  next = chooseStoryworldOption(next, clusterId, entryOptions[entryOptionIndex].id).state;
  next = advanceStoryworldEncounter(next, clusterId).state;
  const outcome = getStoryworldProgress(next, clusterId).outcome;
  if (!outcome.terminal) {
    next = chooseStoryworldOption(
      next,
      clusterId,
      getVisibleStoryworldOptions(next, clusterId)[0].id,
    ).state;
  }
  return advanceStoryworldEncounter(next, clusterId).state;
}

function completeAuthorities(activeMinutes = 300, theater = 'salt') {
  const schedule = getCampaignRouteSchedule(theater);
  let receipt = createRunReceipt({
    runId: RUN_ID,
    campaignState: createCampaignState(),
    advancementState: createAdvancementState(),
    profileId: RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H,
  }).state;
  let storyworld = createStoryworldState({ runId: RUN_ID });
  for (const beatId of schedule.beatIds) {
    receipt = recordRunBeatCompletion(receipt, RUN_ID, beatId).state;
  }
  for (const clusterId of schedule.storyworldDecisionIds) {
    storyworld = resolveCluster(storyworld, clusterId, theater);
    receipt = recordRunStoryworldDecision(receipt, RUN_ID, clusterId).state;
  }
  for (let minute = 0; minute < activeMinutes; minute += 1) {
    receipt = recordRunPlaytime(receipt, RUN_ID, 'narrative', 60_000, { chapterId: 'epilogue' }).state;
  }
  return { receipt, storyworld };
}

test('narrative gate reconciles each selected route at five active hours', () => {
  const expected = {
    salt: { beats: 55, storyworldScenes: 20, clusters: 10 },
    ash: { beats: 54, storyworldScenes: 20, clusters: 10 },
    paper: { beats: 55, storyworldScenes: 22, clusters: 11 },
  };
  for (const theater of Object.keys(expected)) {
    const { receipt, storyworld } = completeAuthorities(300, theater);
    const gate = deriveNarrativeCreditsGate(receipt, storyworld);
    assert.deepEqual(gate.reasons, []);
    assert.equal(gate.ready, true);
    assert.equal(gate.completedCanonicalSceneCount, expected[theater].beats);
    assert.equal(gate.completedStoryworldSceneCount, expected[theater].storyworldScenes);
    assert.equal(gate.completedStoryworldClusterIds.length, expected[theater].clusters);
    assert.equal(getStoryworldRouteTheater(storyworld), theater);
    assert.deepEqual(
      getRequiredStoryworldClusterIds(storyworld),
      getCampaignRouteSchedule(theater).storyworldDecisionIds,
    );
    assert.equal(gate.totalMs, 18_000_000);
  }
});

test('narrative gate fails closed on missing time, incomplete or legacy Storyworld, and cross-run state', () => {
  const { receipt, storyworld } = completeAuthorities();
  const shortReceipt = completeAuthorities(299).receipt;
  assert.ok(deriveNarrativeCreditsGate(shortReceipt, storyworld).reasons.includes('active-playtime-incomplete'));

  const incomplete = createStoryworldState({ runId: RUN_ID });
  assert.ok(deriveNarrativeCreditsGate(receipt, incomplete).reasons.includes('storyworld-incomplete'));

  const legacy = createLegacyStoryworldState({ runId: RUN_ID, coverageStartBeatIndex: 0 });
  assert.ok(deriveNarrativeCreditsGate(receipt, legacy).reasons.includes('storyworld-proof-ineligible'));

  const foreign = { ...storyworld, runId: 'narrative-gate-run-foreign' };
  assert.ok(deriveNarrativeCreditsGate(receipt, foreign).reasons.includes('run-binding-mismatch'));
});
