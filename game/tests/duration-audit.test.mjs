import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAdvancementState,
} from '../advancement.mjs';
import { CAMPAIGN } from '../content/campaign.mjs';
import {
  CAMP_CONVERSATION_METRICS,
  CAMP_CONVERSATION_PLAYABLE_METRICS,
} from '../content/camp-conversations.mjs';
import { ARCHIVE_RECORD_METRICS } from '../content/archive-records.mjs';
import {
  PARTY_COUNCIL_METRICS,
  PARTY_COUNCIL_PLAYABLE_METRICS,
} from '../content/party-councils.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import {
  createDurationAudit,
  DEFAULT_DURATION_ASSUMPTIONS,
  DURATION_TARGET_MINUTES,
} from '../duration-audit.mjs';
import {
  createCampaignState,
} from '../progression.mjs';
import {
  completeRunCredits,
  createRunReceipt,
  recordRunBeatCompletion,
  recordRunFirstClear,
  recordRunPlaytime,
  serializeRunReceipt,
} from '../run-receipt.mjs';

const BEAT_IDS = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => beat.id));

test('duration audit derives concrete shipped quantities and keeps estimates unproven', () => {
  const audit = createDurationAudit();

  assert.equal(audit.schemaVersion, 8);
  assert.equal(audit.targetMinutes, 1_200);
  assert.equal(audit.targetHours, 20);
  assert.equal(audit.status, 'duration-unproven');
  assert.equal(audit.durationProven, false);
  assert.equal(audit.estimateIsProof, false);
  assert.equal(audit.canonicalEvidence.fullyIntegrated, true);
  assert.match(audit.canonicalEvidence.signature, /^fnv1a32:[0-9a-f]{8}$/);
  assert.equal(audit.canonicalEvidence.durationProven, false);

  assert.deepEqual({
    chapters: audit.content.chapterCount,
    beats: audit.content.beatCount,
    lines: audit.content.dialogueLineCount,
    words: audit.content.dialogueWordCount,
    authoredChoices: audit.content.authoredChoiceOptionCount,
    canonicalChoices: audit.content.canonicalChoiceCount,
    moves: audit.content.fieldMoveCount,
    interactions: audit.content.interactionCount,
    exits: audit.content.exitCount,
    finiteQuests: audit.content.finiteQuestCount,
    finiteQuestObjectives: audit.content.finiteQuestObjectiveCount,
    encounters: audit.content.encounterCatalogCount,
  }, {
    chapters: 11,
    beats: 60,
    lines: 2_746,
    words: 37_776,
    authoredChoices: 68,
    canonicalChoices: 59,
    moves: 1_419,
    interactions: 236,
    exits: 41,
    finiteQuests: 13,
    finiteQuestObjectives: 59,
    encounters: 23,
  });
  assert.equal(audit.content.playerCommandCount, audit.canonicalEvidence.summary.playerCommands);
  assert.equal(audit.content.enemyActivationCount, audit.canonicalEvidence.summary.enemyActivations);
  assert.ok(audit.content.playerCommandCount > 0);
  assert.ok(audit.content.enemyActivationCount > 0);
  assert.equal(audit.content.finiteQuestRuntimeTextWordCount, 613);
  assert.equal(audit.content.finiteQuestAuthoredButNotRuntimeExposedWordCount, 528);
  assert.equal(audit.content.repeatableContractCount, 4);
  assert.equal(audit.content.repeatableContractObjectiveCount, 12);
  assert.equal(audit.content.sceneOperationCount, 60);
  assert.equal(audit.content.sceneOperationNodeCount, 183);
  assert.equal(audit.finiteContentEvidence.completionProof.valid, true);
  assert.equal(audit.finiteContentEvidence.completionProof.finiteSideQuestsComplete, true);
  assert.equal(audit.finiteContentEvidence.completionProof.witnessChroniclesComplete, true);
  assert.equal(audit.finiteContentEvidence.durationEvidence.durationProven, false);
  assert.equal(audit.campConversationEvidence.completionProof.valid, true);
  assert.equal(audit.campConversationEvidence.completionProof.allConversationsComplete, true);
  assert.equal(audit.campConversationEvidence.completionProof.oncePerSaveEnforced, true);
  assert.equal(audit.campConversationEvidence.summary.conversationCount, 90);
  assert.equal(audit.campConversationEvidence.durationEvidence.durationProven, false);
  assert.equal(audit.partyCouncilEvidence.completionProof.valid, true);
  assert.equal(audit.partyCouncilEvidence.completionProof.allCouncilsComplete, true);
  assert.equal(audit.partyCouncilEvidence.completionProof.oncePerSaveEnforced, true);
  assert.equal(audit.partyCouncilEvidence.summary.councilCount, 30);
  assert.equal(audit.partyCouncilEvidence.durationEvidence.durationProven, false);
  assert.equal(audit.archiveRecordEvidence.completionProof.valid, true);
  assert.equal(audit.archiveRecordEvidence.completionProof.allRecordsComplete, true);
  assert.equal(audit.archiveRecordEvidence.completionProof.oncePerSaveEnforced, true);
  assert.equal(audit.archiveRecordEvidence.summary.recordCount, 60);
  assert.equal(audit.archiveRecordEvidence.durationEvidence.durationProven, false);
  assert.equal(audit.requiredRouteEvidence.completionProof.valid, true);
  assert.equal(audit.requiredRouteEvidence.completionProof.grindMilestonesComplete, true);
  assert.equal(audit.requiredRouteEvidence.completionProof.repeatDecisionsAndRewardsSpeedInvariant, true);
  assert.equal(audit.requiredRouteEvidence.summary.repeatGrindMilestoneCount, 4);
  assert.equal(audit.requiredRouteEvidence.summary.requiredRepeatWinCount, 4);
  assert.equal(audit.requiredRouteEvidence.repeatScheduleAudit.schedules.length, 4);
  assert.deepEqual(audit.requiredRouteEvidence.repeatScheduleAudit.aggregateScheduledMsBySpeed, {
    1: 36_800,
    2: 18_400,
    4: 9_200,
  });
  assert.deepEqual(audit.requiredRouteEvidence.repeatScheduleAudit.exactRatios, { 1: 1, 2: 2, 4: 4 });
  assert.equal(audit.requiredRouteEvidence.repeatScheduleAudit.scheduleOnly, true);
  assert.equal(audit.requiredRouteEvidence.repeatScheduleAudit.elapsedTimeRecordedMs, 0);
  assert.equal(audit.requiredRouteEvidence.repeatScheduleAudit.schedules
    .every((schedule) => schedule.decisionsAndRewardsInvariant), true);

  assert.deepEqual(audit.authoredDurationDeclarations, {
    campaignChapterMinutes: 1_215,
    finiteSideQuestMinutes: 224,
    finiteWitnessChronicleMinutes: 398,
    firstRepeatableContractCircuitMinutes: 40,
    usedAsMeasuredEvidence: false,
    usedInQuantityEstimate: false,
  });
  assert.equal(audit.witnessChronicle.supplied, true);
  assert.equal(audit.witnessChronicle.source, 'shipped-witness-chronicle-runtime-v2');
  assert.deepEqual(audit.witnessChronicle.metrics, {
    dialogueWords: 3_012,
    dialogueLines: 288,
    choices: 18,
    fieldMoves: 729,
    interactions: 355,
    exits: 0,
    playerCommands: 0,
    enemyActivations: 0,
    campRests: 0,
    finiteEncounterCount: 0,
    finiteQuestCount: 18,
    finiteQuestObjectiveCount: 0,
  });
  assert.equal(audit.campConversation.source, 'shipped-camp-conversation-runtime-v1');
  assert.equal(audit.campConversation.finite, true);
  assert.equal(audit.campConversation.repeatable, false);
  assert.deepEqual(audit.campConversation.catalogueMetrics, CAMP_CONVERSATION_METRICS);
  assert.deepEqual(audit.campConversation.playableMetrics, CAMP_CONVERSATION_PLAYABLE_METRICS);
  assert.equal(CAMP_CONVERSATION_METRICS.mainLineCount, 3_644);
  assert.equal(CAMP_CONVERSATION_METRICS.responseLineCount, 540);
  assert.equal(CAMP_CONVERSATION_METRICS.wordCount, 83_435);
  assert.equal(CAMP_CONVERSATION_PLAYABLE_METRICS.visibleWordCount, 76_547);
  assert.deepEqual(audit.campConversation.metrics, {
    dialogueWords: CAMP_CONVERSATION_PLAYABLE_METRICS.visibleWordCount,
    dialogueLines: CAMP_CONVERSATION_PLAYABLE_METRICS.dialogueLineCount,
    choices: 90,
    fieldMoves: 0,
    interactions: 90,
    exits: 0,
    playerCommands: 0,
    enemyActivations: 0,
    campRests: 0,
    finiteEncounterCount: 0,
    finiteQuestCount: 0,
    finiteQuestObjectiveCount: 0,
  });
  assert.equal(audit.partyCouncil.source, 'shipped-party-council-runtime-v1');
  assert.equal(audit.partyCouncil.finite, true);
  assert.equal(audit.partyCouncil.repeatable, false);
  assert.deepEqual(audit.partyCouncil.catalogueMetrics, PARTY_COUNCIL_METRICS);
  assert.deepEqual(audit.partyCouncil.playableMetrics, PARTY_COUNCIL_PLAYABLE_METRICS);
  assert.equal(PARTY_COUNCIL_METRICS.councilCount, 30);
  assert.equal(PARTY_COUNCIL_METRICS.mainLineCount, 993);
  assert.equal(PARTY_COUNCIL_METRICS.responseLineCount, 180);
  assert.equal(PARTY_COUNCIL_METRICS.wordCount, 27_506);
  assert.equal(PARTY_COUNCIL_PLAYABLE_METRICS.visibleWordCount, 25_072);
  assert.deepEqual(audit.partyCouncil.metrics, {
    dialogueWords: PARTY_COUNCIL_PLAYABLE_METRICS.visibleWordCount,
    dialogueLines: PARTY_COUNCIL_PLAYABLE_METRICS.dialogueLineCount,
    choices: 30,
    fieldMoves: 0,
    interactions: 30,
    exits: 0,
    playerCommands: 0,
    enemyActivations: 0,
    campRests: 0,
    finiteEncounterCount: 0,
    finiteQuestCount: 0,
    finiteQuestObjectiveCount: 0,
  });
  assert.equal(audit.archiveRecord.source, 'shipped-public-archive-runtime-v1');
  assert.equal(audit.archiveRecord.finite, true);
  assert.equal(audit.archiveRecord.repeatable, false);
  assert.deepEqual(audit.archiveRecord.catalogueMetrics, ARCHIVE_RECORD_METRICS);
  assert.deepEqual(audit.archiveRecord.metrics, {
    dialogueWords: ARCHIVE_RECORD_METRICS.wordCount,
    dialogueLines: ARCHIVE_RECORD_METRICS.paragraphCount,
    choices: 0,
    fieldMoves: 0,
    interactions: 60,
    exits: 0,
    playerCommands: 0,
    enemyActivations: 0,
    campRests: 0,
    finiteEncounterCount: 0,
    finiteQuestCount: 0,
    finiteQuestObjectiveCount: 0,
  });

  assert.deepEqual(audit.postStoryPreCreditsContent, {
    finalBeatId: 'e02-repaired-tower',
    receiptRemainsActiveAfterFinalBeat: true,
    creditsCompletionSealsReceipt: true,
    includedInAllFiniteContent: true,
    sideQuestIds: [],
    witnessChronicleIds: [],
    campConversationIds: [],
    partyCouncilIds: ['council-30-e02-repaired-tower'],
    archiveRecordIds: ['archive-e02-repaired-tower'],
    metrics: {
      dialogueWords: 1_806,
      dialogueLines: 48,
      choices: 1,
      fieldMoves: 0,
      interactions: 2,
      exits: 0,
      playerCommands: 0,
      enemyActivations: 0,
      campRests: 0,
      finiteEncounterCount: 0,
      finiteQuestCount: 0,
      finiteQuestObjectiveCount: 0,
    },
  });
  assert.deepEqual(audit.partyCouncil.postStoryPreCreditsMetrics, {
    dialogueWords: 1_281,
    dialogueLines: 39,
    choices: 1,
    fieldMoves: 0,
    interactions: 1,
    exits: 0,
    playerCommands: 0,
    enemyActivations: 0,
    campRests: 0,
    finiteEncounterCount: 0,
    finiteQuestCount: 0,
    finiteQuestObjectiveCount: 0,
  });
  assert.equal(audit.archiveRecord.postStoryPreCreditsMetrics.dialogueWords, 525);
  assert.equal(audit.archiveRecord.postStoryPreCreditsMetrics.dialogueLines, 9);
  assert.deepEqual(audit.campConversation.postStoryPreCreditsIds, []);
  assert.deepEqual(
    audit.estimates.reference.postStoryPreCredits.quantities,
    audit.postStoryPreCreditsContent.metrics,
  );

  assert.deepEqual(audit.estimates.reference.canonicalOnly.quantities, {
    dialogueWords: 37_776,
    dialogueLines: 2_746,
    choices: 59,
    fieldMoves: 1_419,
    interactions: 236,
    exits: 41,
    playerCommands: 231,
    enemyActivations: 97,
    campRests: 17,
    finiteEncounterCount: 23,
    finiteQuestCount: 0,
    finiteQuestObjectiveCount: 0,
  });
  assert.equal(Object.hasOwn(audit.estimates.reference, 'criticalPath'), false);
  assert.match(audit.estimates.reference.canonicalOnly.scope, /Canonical dialogue/);
  assert.match(audit.estimates.reference.optionalInclusive.scope, /finite side quests/);
  assert.equal(
    audit.estimates.reference.optionalInclusive.quantities.dialogueWords
      - audit.estimates.reference.canonicalOnly.quantities.dialogueWords,
    audit.content.finiteQuestRuntimeTextWordCount + audit.witnessChronicle.metrics.dialogueWords,
  );
  assert.equal(
    audit.estimates.reference.allFiniteContent.quantities.dialogueLines
      - audit.estimates.reference.optionalInclusive.quantities.dialogueLines,
    CAMP_CONVERSATION_PLAYABLE_METRICS.dialogueLineCount
      + PARTY_COUNCIL_PLAYABLE_METRICS.dialogueLineCount
      + ARCHIVE_RECORD_METRICS.paragraphCount,
  );
  assert.ok(Math.abs(
    audit.estimates.reference.allFiniteContent.estimatedSeconds
      - audit.estimates.reference.allFiniteBeforeStoryCompletion.estimatedSeconds
      - audit.estimates.reference.postStoryPreCredits.estimatedSeconds,
  ) < 1e-9);
  assert.equal(audit.estimates.reference.canonicalOnly.estimatedMinutes, 309.249);
  assert.equal(audit.estimates.reference.optionalInclusive.estimatedMinutes, 393.697);
  assert.ok(audit.estimates.low.allFiniteBeforeStoryCompletion.estimatedMinutes
    < audit.estimates.reference.allFiniteBeforeStoryCompletion.estimatedMinutes);
  assert.ok(audit.estimates.reference.allFiniteBeforeStoryCompletion.estimatedMinutes
    < audit.estimates.high.allFiniteBeforeStoryCompletion.estimatedMinutes);
  assert.deepEqual(
    Object.fromEntries(Object.entries(audit.estimates).map(([name, estimate]) => [
      name,
      estimate.allFiniteBeforeStoryCompletion.estimatedMinutes,
    ])),
    { low: 769.649, reference: 1_221.359, high: 1_902.603 },
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(audit.estimates).map(([name, estimate]) => [
      name,
      estimate.allFiniteContent.estimatedMinutes,
    ])),
    { low: 776.975, reference: 1_232.299, high: 1_918.346 },
  );
  assert.equal(audit.estimates.reference.allFiniteContent.requiredRepeatPresentationMs, 36_800);
  assert.equal(audit.estimates.reference.allFiniteContent.breakdownMinutes.requiredRepeatPresentation, 0.613);
  assert.deepEqual(
    Object.fromEntries(Object.entries(audit.estimates.reference.allFiniteContent.repeatSpeedVariants)
      .map(([speed, variant]) => [speed, variant.estimatedMinutes])),
    { 1: 1_232.299, 2: 1_231.993, 4: 1_231.839 },
  );
  assert.equal(audit.estimates.reference.allFiniteContent.modelSurplusMinutesOver20Hours, 32.299);
  assert.equal(audit.estimates.low.allFiniteContent.reaches20HoursUnderModel, false);
  assert.equal(audit.estimates.reference.allFiniteContent.reaches20HoursUnderModel, true);
  assert.equal(audit.estimates.high.allFiniteContent.reaches20HoursUnderModel, true);
  assert.equal(audit.estimates.reference.allFiniteContent.eligibleBeforeCreditsSeal, true);
  assert.equal(audit.estimates.reference.postStoryPreCredits.eligibleBeforeCreditsSeal, true);
  assert.equal(audit.estimates.reference.postStoryPreCredits.includedInAllFiniteContent, true);
  for (const estimate of Object.values(audit.estimates)) {
    assert.equal(estimate.estimateIsProof, false);
    assert.equal(
      estimate.allFiniteContent.exactModelGapSecondsTo20Hours,
      Math.max(0, (DURATION_TARGET_MINUTES * 60) - estimate.allFiniteContent.estimatedSeconds),
    );
  }
  assert.equal(audit.finiteContentGapTo20Hours.isObservedPlaytime, false);
  assert.equal(Object.isFrozen(audit), true);
  assert.equal(Object.isFrozen(audit.estimates.reference.assumptions), true);
});

test('repeat timing reports a schedule-only full circuit and proves no required canonical grind', () => {
  const audit = createDurationAudit();
  const repeat = audit.repeatBattle;

  assert.equal(repeat.scheduleOnly, true);
  assert.equal(repeat.estimateOrProof, false);
  assert.equal(repeat.requiredRepeatBattleCountForCanonicalCompletion, 0);
  assert.equal(repeat.encounterCount, ENCOUNTERS.length);
  assert.equal(repeat.encounters.length, ENCOUNTERS.length);
  assert.equal(repeat.basePresentationMs,
    repeat.encounters.reduce((total, encounter) => total + encounter.basePresentationMs, 0));
  assert.equal(repeat.policyStepCount,
    repeat.encounters.reduce((total, encounter) => total + encounter.policyStepCount, 0));
  assert.equal(repeat.playerDecisionCount,
    repeat.encounters.reduce((total, encounter) => total + encounter.playerDecisionCount, 0));
  assert.equal(repeat.enemyActivationCount,
    repeat.encounters.reduce((total, encounter) => total + encounter.enemyActivationCount, 0));
  assert.equal(repeat.fullCircuitBySpeed[1].scheduledMs, repeat.basePresentationMs);
  assert.equal(repeat.fullCircuitBySpeed[2].scheduledMs, repeat.basePresentationMs / 2);
  assert.equal(repeat.fullCircuitBySpeed[4].scheduledMs, repeat.basePresentationMs / 4);
});

test('caller-supplied witness chronicle metrics can replace the shipped witness quantities explicitly', () => {
  const witnessChronicleMetrics = {
    source: 'witness-chronicle-test-fixture',
    dialogueWords: 9_000,
    dialogueLines: 500,
    choices: 30,
    fieldMoves: 2_000,
    interactions: 150,
    exits: 50,
    playerCommands: 500,
    enemyActivations: 200,
    campRests: 20,
    finiteEncounterCount: 10,
    finiteQuestCount: 5,
    finiteQuestObjectiveCount: 25,
  };
  const baseline = createDurationAudit({ witnessChronicleMetrics: null });
  const extended = createDurationAudit({
    witnessChronicleMetrics,
    assumptions: { reference: { readingWordsPerMinute: 200 } },
  });

  assert.equal(extended.witnessChronicle.supplied, true);
  assert.equal(extended.witnessChronicle.source, 'witness-chronicle-test-fixture');
  assert.deepEqual(extended.witnessChronicle.metrics, Object.fromEntries(
    Object.entries(witnessChronicleMetrics).filter(([key]) => key !== 'source'),
  ));
  assert.equal(extended.estimates.reference.assumptions.readingWordsPerMinute, 200);
  assert.equal(extended.estimates.reference.allFiniteContent.quantities.dialogueWords,
    baseline.estimates.reference.allFiniteContent.quantities.dialogueWords + 9_000);
  assert.equal(extended.estimates.reference.allFiniteContent.quantities.finiteQuestCount,
    baseline.estimates.reference.allFiniteContent.quantities.finiteQuestCount + 5);
  assert.ok(extended.estimates.reference.allFiniteContent.estimatedMinutes
    > baseline.estimates.reference.allFiniteContent.estimatedMinutes);
  assert.equal(extended.durationProven, false, 'content metrics remain estimates, however large');

  assert.throws(
    () => createDurationAudit({ witnessChronicleMetrics: { inventedMetric: 1 } }),
    /Unknown witness chronicle metric/,
  );
  assert.throws(
    () => createDurationAudit({ assumptions: { reference: { readingWordsPerMinute: 0 } } }),
    /greater than zero/,
  );
  assert.deepEqual(DEFAULT_DURATION_ASSUMPTIONS.low.readingWordsPerMinute, 260);
});

function storyCompleteTwentyHourReceipt() {
  const created = createRunReceipt({
    runId: 'duration-audit-proof-0001',
    campaignState: createCampaignState(),
    advancementState: createAdvancementState(),
  });
  assert.equal(created.ok, true);
  let receipt = created.state;
  for (let minute = 0; minute < 1_020; minute += 1) {
    receipt = recordRunPlaytime(receipt, receipt.runId, 'exploration', 60_000).state;
  }
  for (let minute = 0; minute < 180; minute += 1) {
    receipt = recordRunPlaytime(receipt, receipt.runId, 'grind', 60_000).state;
  }
  for (const encounter of ENCOUNTERS) {
    receipt = recordRunFirstClear(receipt, receipt.runId, encounter.id).state;
  }
  for (const beatId of BEAT_IDS) {
    receipt = recordRunBeatCompletion(receipt, receipt.runId, beatId).state;
  }
  return receipt;
}

test('post-story play remains countable and only explicit credits completion can prove duration', () => {
  const invalid = createDurationAudit({ runReceipt: { fabricated: true } });
  assert.equal(invalid.durationProven, false);
  assert.equal(invalid.proofReceipt.valid, false);
  assert.equal(invalid.proofReceipt.status, 'invalid');

  const receipt = storyCompleteTwentyHourReceipt();
  const unsealed = createDurationAudit({ runReceipt: serializeRunReceipt(receipt) });
  assert.equal(unsealed.durationProven, false);
  assert.equal(unsealed.proofReceipt.report.storyComplete, true);
  assert.equal(unsealed.proofReceipt.report.creditsComplete, false);

  const postStoryReading = recordRunPlaytime(
    receipt,
    receipt.runId,
    'narrative',
    60_000,
  );
  assert.equal(postStoryReading.ok, true);
  const sealed = completeRunCredits(postStoryReading.state, receipt.runId);
  assert.equal(sealed.ok, true);
  const audit = createDurationAudit({ runReceipt: serializeRunReceipt(sealed.state) });
  assert.equal(audit.status, 'duration-proven-by-valid-run-receipt');
  assert.equal(audit.durationProven, true);
  assert.equal(audit.proofReceipt.valid, true);
  assert.equal(audit.proofReceipt.report.campaignComplete, true);
  assert.equal(audit.proofReceipt.report.firstClearsComplete, true);
  assert.equal(audit.proofReceipt.report.totalMinutes, 1_201);
  assert.equal(audit.proofReceipt.report.durationProven, true);
  assert.equal(audit.estimateIsProof, false, 'the estimate remains separate even with proof');
});
