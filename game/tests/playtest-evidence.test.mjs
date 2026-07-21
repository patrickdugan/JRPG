import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdvancementState } from '../advancement.mjs';
import { createArchiveRecordState } from '../archive-record-runtime.mjs';
import { createCampConversationState } from '../camp-conversation-runtime.mjs';
import { CAMPAIGN } from '../content/campaign.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import { STORYWORLD_CLUSTERS } from '../content/storyworld-encounters.generated.mjs';
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
  RUN_RECEIPT_PROFILE_IDS,
  completeRunCredits,
  createRunReceipt,
  recordRunBeatCompletion,
  recordRunFirstClear,
  recordRunPlaytime,
  recordRunStoryworldDecision,
} from '../run-receipt.mjs';
import {
  advanceStoryworldEncounter,
  beginStoryworldEncounter,
  chooseStoryworldOption,
  createStoryworldState,
  getStoryworldProgress,
  getVisibleStoryworldOptions,
} from '../storyworld-runtime.mjs';
import { createWitnessChronicleState } from '../witness-chronicle-runtime.mjs';

function freshAuthorities(runId = 'evidence-test-0001') {
  return {
    campaignState: createCampaignState(),
    advancementState: createAdvancementState(),
    questState: createQuestState(),
    witnessChronicleState: createWitnessChronicleState(),
    campConversationState: createCampConversationState(runId),
    partyCouncilState: createPartyCouncilState(runId),
    archiveRecordState: createArchiveRecordState(runId),
  };
}

function freshReceipt({
  runId = 'evidence-test-0001',
  profileId = RUN_RECEIPT_PROFILE_IDS.COMPLETIONIST_20H,
} = {}) {
  const authorities = freshAuthorities(runId);
  return createRunReceipt({
    runId,
    profileId,
    campaignState: authorities.campaignState,
    advancementState: authorities.advancementState,
  }).state;
}

function resolveStoryworld(runId, receipt) {
  let storyworld = createStoryworldState({ runId });
  let nextReceipt = receipt;
  for (const cluster of STORYWORLD_CLUSTERS) {
    storyworld = beginStoryworldEncounter(storyworld, cluster.id).state;
    storyworld = chooseStoryworldOption(
      storyworld,
      cluster.id,
      getVisibleStoryworldOptions(storyworld, cluster.id)[0].id,
    ).state;
    storyworld = advanceStoryworldEncounter(storyworld, cluster.id).state;
    if (!getStoryworldProgress(storyworld, cluster.id).outcome.terminal) {
      storyworld = chooseStoryworldOption(
        storyworld,
        cluster.id,
        getVisibleStoryworldOptions(storyworld, cluster.id)[0].id,
      ).state;
    }
    storyworld = advanceStoryworldEncounter(storyworld, cluster.id).state;
    nextReceipt = recordRunStoryworldDecision(nextReceipt, runId, cluster.id).state;
  }
  return { receipt: nextReceipt, storyworld };
}

function completeNarrativeRun({ attributed = true } = {}) {
  const runId = 'evidence-narrative-0001';
  let receipt = freshReceipt({ runId, profileId: RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H });
  for (const chapter of CAMPAIGN.chapters) {
    for (const beat of chapter.beats) receipt = recordRunBeatCompletion(receipt, runId, beat.id).state;
  }
  const resolved = resolveStoryworld(runId, receipt);
  receipt = resolved.receipt;
  for (let minute = 0; minute < 300; minute += 1) {
    receipt = recordRunPlaytime(receipt, runId, 'narrative', 60_000, attributed ? {
      chapterId: CAMPAIGN.chapters[minute % CAMPAIGN.chapters.length].id,
    } : {}).state;
  }
  receipt = completeRunCredits(receipt, runId).state;
  return { receipt, storyworld: resolved.storyworld };
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function sign(body) {
  return { ...body, signature: `fnv1a32:${fnv1a32(JSON.stringify(body))}` };
}

test('partial playtest exports publish separate, explicit profile verdicts', () => {
  const report = createPlaytestEvidenceReport(freshReceipt(), deriveRequiredRouteProgress(freshAuthorities()));
  assert.equal(report.schemaVersion, 3);
  assert.equal(report.profileId, RUN_RECEIPT_PROFILE_IDS.COMPLETIONIST_20H);
  assert.match(report.signature, /^fnv1a32:[0-9a-f]{8}$/);
  assert.equal(report.story.complete, false);
  assert.equal(report.combat.complete, false);
  assert.equal(report.requiredRoute.complete, false);
  assert.equal(report.requiredRoute.runBoundSourcesMatchReceipt, true);
  assert.equal(report.requiredRoute.requiredActivityCount, 215);
  assert.equal(report.playtime.totalMs, 0);
  assert.equal(report.playtime.unattributedMs, 0);
  assert.equal(report.pacing.diagnosticOnly, true);
  assert.equal(report.pacing.observedPlaytimeProof, false);
  assert.equal(report.pacing.checkpointSignature, 'fnv1a32:c0e61174');
  assert.equal(report.pacing.aggregateReferenceTargetMs, 74_178_683);
  assert.equal(report.pacing.chapters.length, 11);
  assert.equal(report.narrativeRoute.applicable, false);
  assert.equal(report.narrativeRoute.releaseTargetProven, false);
  assert.equal(report.completionistRoute.applicable, true);
  assert.equal(report.completionistRoute.releaseTargetProven, false);
  assert.equal(report.proof.releaseTargetProven, false);
  assert.equal(Object.isFrozen(report), true);
  assert.deepEqual(JSON.parse(serializePlaytestEvidenceReport(report)), report);
});

test('narrative evidence proves reconciled 60 plus 22 scenes and five attributed hours without 215 completion', () => {
  const { receipt, storyworld } = completeNarrativeRun();
  const report = createPlaytestEvidenceReport(
    receipt,
    deriveRequiredRouteProgress(freshAuthorities(receipt.runId)),
    storyworld,
  );
  assert.equal(report.profileId, RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H);
  assert.equal(report.story.completedBeatCount, 60);
  assert.equal(report.story.completedStoryworldPlayedSceneCount, 22);
  assert.equal(report.story.playedSceneCount, 82);
  assert.equal(report.requiredRoute.complete, false);
  assert.equal(report.narrativeRoute.applicable, true);
  assert.equal(report.narrativeRoute.strictCreditsGateReady, true);
  assert.deepEqual(report.narrativeRoute.strictCreditsGateReasons, []);
  assert.equal(report.narrativeRoute.completedCanonicalSceneCount, 60);
  assert.equal(report.narrativeRoute.completedStoryworldSceneCount, 22);
  assert.equal(report.narrativeRoute.completedStoryworldClusterIds.length, 11);
  assert.equal(report.narrativeRoute.minimumPlaytimeMet, true);
  assert.equal(report.narrativeRoute.chapterTimingComplete, true);
  assert.equal(report.narrativeRoute.releaseTargetProven, true);
  assert.equal(report.completionistRoute.applicable, false);
  assert.equal(report.completionistRoute.releaseTargetProven, false);
  assert.equal(report.proof.narrativeRoute, true);
  assert.equal(report.proof.releaseTargetProven, true);
});

test('narrative proof fails closed on missing, cross-run, or unattributed Storyworld evidence', () => {
  const complete = completeNarrativeRun();
  const progress = deriveRequiredRouteProgress(freshAuthorities(complete.receipt.runId));
  const missing = createPlaytestEvidenceReport(complete.receipt, progress);
  assert.equal(missing.narrativeRoute.strictCreditsGateReady, false);
  assert.ok(missing.narrativeRoute.strictCreditsGateReasons.includes('storyworld-invalid'));
  assert.equal(missing.narrativeRoute.releaseTargetProven, false);

  const foreign = createPlaytestEvidenceReport(complete.receipt, progress, {
    ...complete.storyworld,
    runId: 'evidence-narrative-foreign',
  });
  assert.ok(foreign.narrativeRoute.strictCreditsGateReasons.includes('run-binding-mismatch'));
  assert.equal(foreign.narrativeRoute.releaseTargetProven, false);

  const unattributed = completeNarrativeRun({ attributed: false });
  const unattributedReport = createPlaytestEvidenceReport(
    unattributed.receipt,
    progress,
    unattributed.storyworld,
  );
  assert.equal(unattributedReport.narrativeRoute.strictCreditsGateReady, true);
  assert.equal(unattributedReport.playtime.unattributedMs, 18_000_000);
  assert.equal(unattributedReport.narrativeRoute.chapterTimingComplete, false);
  assert.equal(unattributedReport.narrativeRoute.releaseTargetProven, false);
});

test('completionist proof retains the same-run 215-entry route and legacy twenty-hour timing contract', () => {
  const runId = 'evidence-complete-0001';
  const route = runRequiredRouteCompletion({ runId });
  let receipt = freshReceipt({ runId });
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
  assert.equal(report.completionistRoute.applicable, true);
  assert.equal(report.completionistRoute.durationProven, true);
  assert.equal(report.completionistRoute.chapterTimingComplete, true);
  assert.equal(report.completionistRoute.releaseTargetProven, true);
  assert.equal(report.proof.completionistRoute, true);
  assert.equal(report.proof.releaseTargetProven, true);

  const mixedRun = JSON.parse(JSON.stringify(progress));
  mixedRun.runBinding.campConversations = 'evidence-other-0001';
  const rejectedMix = createPlaytestEvidenceReport(receipt, mixedRun);
  assert.equal(rejectedMix.requiredRoute.complete, false);
  assert.equal(rejectedMix.requiredRoute.runBoundSourcesMatchReceipt, false);
  assert.equal(rejectedMix.completionistRoute.releaseTargetProven, false);
  assert.equal(rejectedMix.proof.releaseTargetProven, false);
});

test('serializer continues to validate and read signed schema-two completionist evidence', () => {
  const legacyReport = sign({
    schemaVersion: 2,
    campaignId: CAMPAIGN.id,
    runId: 'legacy-evidence-0001',
    proof: { releaseTargetProven: true },
  });
  assert.deepEqual(JSON.parse(serializePlaytestEvidenceReport(legacyReport)), legacyReport);
  assert.throws(
    () => serializePlaytestEvidenceReport({ ...legacyReport, runId: 'legacy-evidence-forged' }),
    /signature is invalid/,
  );
});

test('reports reject malformed receipts, route summaries, and signature drift', () => {
  const receipt = freshReceipt();
  const progress = deriveRequiredRouteProgress(freshAuthorities());
  assert.throws(() => createPlaytestEvidenceReport({ ...receipt, revision: 99 }, progress), /Invalid run receipt/);
  assert.throws(() => createPlaytestEvidenceReport(receipt, { ...progress, version: 99 }), /Invalid required-route progress/);
  const report = createPlaytestEvidenceReport(receipt, progress);
  assert.throws(() => serializePlaytestEvidenceReport({ ...report, status: 'complete' }), /signature is invalid/);
});
