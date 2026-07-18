import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAdvancementState,
} from '../advancement.mjs';
import { CAMPAIGN } from '../content/campaign.mjs';
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
  createRunReceipt,
  recordRunBeatCompletion,
  recordRunFirstClear,
  recordRunPlaytime,
  serializeRunReceipt,
} from '../run-receipt.mjs';

const BEAT_IDS = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => beat.id));

test('duration audit derives concrete shipped quantities and keeps estimates unproven', () => {
  const audit = createDurationAudit();

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
    words: 37_717,
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
  assert.ok(audit.estimates.low.allFiniteContent.estimatedMinutes
    < audit.estimates.reference.allFiniteContent.estimatedMinutes);
  assert.ok(audit.estimates.reference.allFiniteContent.estimatedMinutes
    < audit.estimates.high.allFiniteContent.estimatedMinutes);
  for (const estimate of Object.values(audit.estimates)) {
    assert.equal(estimate.estimateIsProof, false);
    assert.equal(estimate.allFiniteContent.reaches20HoursUnderModel, false);
    assert.equal(
      estimate.allFiniteContent.exactModelGapSecondsTo20Hours,
      (DURATION_TARGET_MINUTES * 60) - estimate.allFiniteContent.estimatedSeconds,
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

function completedTwentyHourReceipt() {
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

test('only a valid completed twenty-hour run receipt can prove duration', () => {
  const invalid = createDurationAudit({ runReceipt: { fabricated: true } });
  assert.equal(invalid.durationProven, false);
  assert.equal(invalid.proofReceipt.valid, false);
  assert.equal(invalid.proofReceipt.status, 'invalid');

  const receipt = completedTwentyHourReceipt();
  const audit = createDurationAudit({ runReceipt: serializeRunReceipt(receipt) });
  assert.equal(audit.status, 'duration-proven-by-valid-run-receipt');
  assert.equal(audit.durationProven, true);
  assert.equal(audit.proofReceipt.valid, true);
  assert.equal(audit.proofReceipt.report.campaignComplete, true);
  assert.equal(audit.proofReceipt.report.firstClearsComplete, true);
  assert.equal(audit.proofReceipt.report.totalMinutes, 1_200);
  assert.equal(audit.proofReceipt.report.durationProven, true);
  assert.equal(audit.estimateIsProof, false, 'the estimate remains separate even with proof');
});
