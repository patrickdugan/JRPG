import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdvancementState } from '../advancement.mjs';
import { CAMPAIGN } from '../content/campaign.mjs';
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
  getStoryworldProgress,
  getVisibleStoryworldOptions,
} from '../storyworld-runtime.mjs';
import { STORYWORLD_CLUSTERS } from '../content/storyworld-encounters.generated.mjs';
import { deriveNarrativeCreditsGate } from '../narrative-credits-gate.mjs';

const RUN_ID = 'narrative-gate-run-001';

function completeAuthorities(activeMinutes = 300) {
  let receipt = createRunReceipt({
    runId: RUN_ID,
    campaignState: createCampaignState(),
    advancementState: createAdvancementState(),
    profileId: RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H,
  }).state;
  let storyworld = createStoryworldState({ runId: RUN_ID });
  for (const beat of CAMPAIGN.chapters.flatMap((chapter) => chapter.beats)) {
    receipt = recordRunBeatCompletion(receipt, RUN_ID, beat.id).state;
  }
  for (const cluster of STORYWORLD_CLUSTERS) {
    storyworld = beginStoryworldEncounter(storyworld, cluster.id).state;
    storyworld = chooseStoryworldOption(
      storyworld,
      cluster.id,
      getVisibleStoryworldOptions(storyworld, cluster.id)[0].id,
    ).state;
    storyworld = advanceStoryworldEncounter(storyworld, cluster.id).state;
    const outcome = getStoryworldProgress(storyworld, cluster.id).outcome;
    if (!outcome.terminal) {
      storyworld = chooseStoryworldOption(
        storyworld,
        cluster.id,
        getVisibleStoryworldOptions(storyworld, cluster.id)[0].id,
      ).state;
    }
    storyworld = advanceStoryworldEncounter(storyworld, cluster.id).state;
    receipt = recordRunStoryworldDecision(receipt, RUN_ID, cluster.id).state;
  }
  for (let minute = 0; minute < activeMinutes; minute += 1) {
    receipt = recordRunPlaytime(receipt, RUN_ID, 'narrative', 60_000, { chapterId: 'epilogue' }).state;
  }
  return { receipt, storyworld };
}

test('narrative gate reconciles 60 canonical and 22 Storyworld scenes at five active hours', () => {
  const { receipt, storyworld } = completeAuthorities();
  const gate = deriveNarrativeCreditsGate(receipt, storyworld);
  assert.deepEqual(gate.reasons, []);
  assert.equal(gate.ready, true);
  assert.equal(gate.completedCanonicalSceneCount, 60);
  assert.equal(gate.completedStoryworldSceneCount, 22);
  assert.equal(gate.completedStoryworldClusterIds.length, 11);
  assert.equal(gate.totalMs, 18_000_000);
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
