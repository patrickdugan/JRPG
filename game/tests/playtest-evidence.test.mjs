import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdvancementState } from '../advancement.mjs';
import { createArchiveRecordState } from '../archive-record-runtime.mjs';
import { createCampConversationState } from '../camp-conversation-runtime.mjs';
import { CAMPAIGN } from '../content/campaign.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import { createPartyCouncilState } from '../party-council-runtime.mjs';
import {
  createPlaytestEvidenceReport,
  serializePlaytestEvidenceReport,
} from '../playtest-evidence.mjs';
import { createCampaignState } from '../progression.mjs';
import { createQuestState } from '../quest-runtime.mjs';
import { deriveRequiredRouteProgress } from '../required-route-progress.mjs';
import { runRequiredRouteCompletion } from '../required-route-run.mjs';
import {
  completeRunCredits,
  createRunReceipt,
  recordRunBeatCompletion,
  recordRunFirstClear,
  recordRunPlaytime,
} from '../run-receipt.mjs';
import { createWitnessChronicleState } from '../witness-chronicle-runtime.mjs';

function freshAuthorities() {
  return {
    campaignState: createCampaignState(),
    advancementState: createAdvancementState(),
    questState: createQuestState(),
    witnessChronicleState: createWitnessChronicleState(),
    campConversationState: createCampConversationState('evidence-test-0001'),
    partyCouncilState: createPartyCouncilState('evidence-test-0001'),
    archiveRecordState: createArchiveRecordState('evidence-test-0001'),
  };
}

function freshReceipt() {
  const authorities = freshAuthorities();
  return createRunReceipt({
    runId: 'evidence-test-0001',
    campaignState: authorities.campaignState,
    advancementState: authorities.advancementState,
  }).state;
}

test('partial playtest exports remain explicit about every missing proof', () => {
  const report = createPlaytestEvidenceReport(freshReceipt(), deriveRequiredRouteProgress(freshAuthorities()));
  assert.equal(report.schemaVersion, 1);
  assert.match(report.signature, /^fnv1a32:[0-9a-f]{8}$/);
  assert.equal(report.story.complete, false);
  assert.equal(report.combat.complete, false);
  assert.equal(report.requiredRoute.complete, false);
  assert.equal(report.requiredRoute.runBoundSourcesMatchReceipt, true);
  assert.equal(report.requiredRoute.requiredActivityCount, 215);
  assert.equal(report.playtime.totalMs, 0);
  assert.equal(report.playtime.unattributedMs, 0);
  assert.equal(report.proof.chapterTimingComplete, true);
  assert.equal(report.proof.durationProven, false);
  assert.equal(report.proof.releaseTargetProven, false);
  assert.equal(Object.isFrozen(report), true);
  assert.deepEqual(JSON.parse(serializePlaytestEvidenceReport(report)), report);
});

test('twenty hours alone cannot prove release target without route completion', () => {
  let receipt = freshReceipt();
  for (let sample = 0; sample < 1200; sample += 1) {
    receipt = recordRunPlaytime(receipt, receipt.runId, 'narrative', 60_000).state;
  }
  for (const encounter of ENCOUNTERS) receipt = recordRunFirstClear(receipt, receipt.runId, encounter.id).state;
  for (const chapter of CAMPAIGN.chapters) {
    for (const beat of chapter.beats) receipt = recordRunBeatCompletion(receipt, receipt.runId, beat.id).state;
  }
  receipt = completeRunCredits(receipt, receipt.runId).state;
  const report = createPlaytestEvidenceReport(receipt, deriveRequiredRouteProgress(freshAuthorities()));
  assert.equal(report.proof.durationProven, true);
  assert.equal(report.proof.chapterTimingComplete, false);
  assert.equal(report.playtime.unattributedMs, 72_000_000);
  assert.equal(report.requiredRoute.complete, false);
  assert.equal(report.proof.releaseTargetProven, false);
});

test('the combined release verdict needs same-run 215/215 route and timing proof', () => {
  const runId = 'evidence-complete-0001';
  const route = runRequiredRouteCompletion({ runId });
  let receipt = createRunReceipt({
    runId,
    campaignState: createCampaignState(),
    advancementState: createAdvancementState(),
  }).state;
  for (let sample = 0; sample < 1200; sample += 1) {
    receipt = recordRunPlaytime(receipt, runId, 'narrative', 60_000, {
      chapterId: CAMPAIGN.chapters[sample % CAMPAIGN.chapters.length].id,
    }).state;
  }
  for (const encounter of ENCOUNTERS) receipt = recordRunFirstClear(receipt, runId, encounter.id).state;
  for (const chapter of CAMPAIGN.chapters) {
    for (const beat of chapter.beats) receipt = recordRunBeatCompletion(receipt, runId, beat.id).state;
  }
  receipt = completeRunCredits(receipt, runId).state;
  const progress = deriveRequiredRouteProgress({
    campaignState: route.states.campaign,
    advancementState: route.states.advancement,
    questState: route.states.quests,
    witnessChronicleState: route.states.witnessChronicles,
    campConversationState: route.states.campConversations,
    partyCouncilState: route.states.partyCouncils,
    archiveRecordState: route.states.archiveRecords,
  });
  const report = createPlaytestEvidenceReport(receipt, progress);
  assert.equal(report.requiredRoute.completedActivityCount, 215);
  assert.equal(report.requiredRoute.runBoundSourcesMatchReceipt, true);
  assert.equal(report.proof.durationProven, true);
  assert.equal(report.proof.chapterTimingComplete, true);
  assert.equal(report.playtime.unattributedMs, 0);
  assert.equal(report.proof.releaseTargetProven, true);

  const mixedRun = JSON.parse(JSON.stringify(progress));
  mixedRun.runBinding.campConversations = 'evidence-other-0001';
  const rejectedMix = createPlaytestEvidenceReport(receipt, mixedRun);
  assert.equal(rejectedMix.requiredRoute.complete, false);
  assert.equal(rejectedMix.requiredRoute.runBoundSourcesMatchReceipt, false);
  assert.equal(rejectedMix.proof.releaseTargetProven, false);
});

test('reports reject malformed receipts, route summaries, and signature drift', () => {
  const receipt = freshReceipt();
  const progress = deriveRequiredRouteProgress(freshAuthorities());
  assert.throws(() => createPlaytestEvidenceReport({ ...receipt, revision: 99 }, progress), /Invalid run receipt/);
  assert.throws(() => createPlaytestEvidenceReport(receipt, { ...progress, version: 99 }), /Invalid required-route progress/);
  const report = createPlaytestEvidenceReport(receipt, progress);
  assert.throws(() => serializePlaytestEvidenceReport({ ...report, status: 'complete' }), /signature is invalid/);
});
