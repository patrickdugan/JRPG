import assert from 'node:assert/strict';
import test from 'node:test';

import { REQUIRED_ROUTE_CONTRACT } from '../required-route-contract.mjs';
import { runRequiredRouteCompletion } from '../required-route-run.mjs';

const routeRun = runRequiredRouteCompletion({ runId: 'required-route-test-0001' });

test('required route executes every finite activity at its chronological frontier', () => {
  const run = routeRun;
  assert.equal(run.ok, true);
  assert.equal(run.signature, 'fnv1a32:16ce2ff5');
  assert.deepEqual(run.summary, {
    canonicalBeatCount: 60,
    canonicalFirstClearCount: 23,
    canonicalChoiceCount: 59,
    requiredActivityCount: 215,
    completedRequiredActivityCount: 215,
    finiteSideQuestCount: 13,
    sidequestAndContractObjectiveCount: 71,
    witnessChronicleCount: 18,
    witnessDialogueLineAcknowledgementCount: 288,
    witnessStageCount: 67,
    witnessChoiceCount: 18,
    witnessPauseCount: 10,
    witnessResumeCount: 10,
    campConversationCount: 90,
    campMainLineAcknowledgementCount: 3644,
    campResponseLineAcknowledgementCount: 270,
    partyCouncilCount: 30,
    councilMainLineAcknowledgementCount: 993,
    councilResponseLineAcknowledgementCount: 90,
    archiveRecordCount: 60,
    archiveParagraphAcknowledgementCount: 498,
    repeatGrindMilestoneCount: 4,
    requiredRepeatWinCount: 4,
    rewardSettlementCount: 35,
    transitionCount: 6851,
    traceEventCount: 630,
    fieldworkStageCount: 67,
    fieldworkNodeCount: 152,
    fieldworkTraversalExecuted: false,
    recordedPlaytimeMs: 0,
    durationProven: false,
  });
  assert.deepEqual(run.completionProof, {
    valid: true,
    chronological: true,
    canonicalCampaignComplete: true,
    canonicalFirstClearsComplete: true,
    allRequiredActivitiesEnteredAtExactUnlock: true,
    allFiniteActivitiesComplete: true,
    grindMilestonesComplete: true,
    repeatDecisionsAndRewardsSpeedInvariant: true,
    creditsCompletionGateSatisfied: true,
    durationProven: false,
  });

  const traceIndex = new Map(run.trace.map((event, index) => [
    event.activityId ? `${event.type}:${event.activityId}` : `${event.type}:${event.beatId}:${index}`,
    index,
  ]));
  const eventType = {
    'finite-sidequest': 'finite-sidequest-complete',
    'witness-chronicle': 'witness-chronicle-accepted-at-unlock',
    'camp-conversation': 'camp-conversation-complete',
    'party-council': 'party-council-complete',
    'archive-record': 'archive-record-complete',
    'repeat-grind-milestone': 'repeat-grind-milestone-complete',
  };
  const beatEventIndices = new Map(run.trace
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.type === 'canonical-beat-complete')
    .map(({ event, index }) => [event.beatId, index]));
  for (const [stageIndex, stage] of REQUIRED_ROUTE_CONTRACT.stages.entries()) {
    const beatIndex = beatEventIndices.get(stage.beatId);
    const nextBeatIndex = stageIndex + 1 < REQUIRED_ROUTE_CONTRACT.stages.length
      ? beatEventIndices.get(REQUIRED_ROUTE_CONTRACT.stages[stageIndex + 1].beatId)
      : run.trace.length;
    for (const activity of stage.activities) {
      const activityIndex = traceIndex.get(`${eventType[activity.type]}:${activity.id}`);
      assert.ok(activityIndex > beatIndex, `${activity.id} must occur after ${stage.beatId}`);
      assert.ok(activityIndex < nextBeatIndex, `${activity.id} must enter before the next beat frontier`);
    }
  }

  assert.equal(run.states.quests.records.length, 17);
  assert.equal(run.states.witnessChronicles.records.length, 18);
  assert.equal(run.states.campConversations.records.length, 90);
  assert.equal(run.states.partyCouncils.records.length, 30);
  assert.equal(run.states.archiveRecords.records.length, 60);
  assert.equal(Object.isFrozen(run), true);
});

test('witness arcs pause only for future canonical evidence and later resume finitely', () => {
  const run = routeRun;
  const pauses = run.trace.filter(({ type }) => type === 'witness-chronicle-paused-for-canonical-evidence');
  const resumes = run.trace.filter(({ type }) => type === 'witness-chronicle-resumed');
  const completions = run.trace.filter(({ type }) => type === 'witness-chronicle-complete');
  assert.equal(pauses.length, 10);
  assert.equal(resumes.length, 10);
  assert.equal(completions.length, 18);
  assert.deepEqual(new Set(pauses.map(({ chronicleId }) => chronicleId)), new Set(resumes.map(({ chronicleId }) => chronicleId)));
  for (const completion of completions) {
    const acceptedIndex = run.trace.findIndex((event) => event.type === 'witness-chronicle-accepted-at-unlock'
      && event.chronicleId === completion.chronicleId);
    const completedIndex = run.trace.indexOf(completion);
    assert.ok(acceptedIndex >= 0 && completedIndex > acceptedIndex);
  }
});

test('required grind has measured scheduler outputs at exact ratios and no duration claim', () => {
  const run = routeRun;
  assert.equal(run.repeatScheduleAudit.schedules.length, 4);
  assert.deepEqual(run.repeatScheduleAudit.aggregateScheduledMsBySpeed, {
    1: 36800,
    2: 18400,
    4: 9200,
  });
  assert.deepEqual(run.repeatScheduleAudit.exactRatios, { 1: 1, 2: 2, 4: 4 });
  assert.equal(run.repeatScheduleAudit.scheduleOnly, true);
  assert.equal(run.repeatScheduleAudit.elapsedTimeRecordedMs, 0);
  for (const schedule of run.repeatScheduleAudit.schedules) {
    assert.equal(schedule.scheduledMsBySpeed[1], schedule.scheduledMsBySpeed[2] * 2);
    assert.equal(schedule.scheduledMsBySpeed[1], schedule.scheduledMsBySpeed[4] * 4);
    assert.deepEqual(schedule.ratios, { 1: 1, 2: 2, 4: 4 });
    assert.equal(schedule.decisionsAndRewardsInvariant, true);
    assert.equal(schedule.elapsedTimeRecordedMs, 0);
  }
  assert.deepEqual(run.durationEvidence, {
    recordedPlaytimeMs: 0,
    elapsedTimeClaimed: false,
    durationProven: false,
    repeatPresentationScheduleOnly: true,
    statement: 'This run proves chronological reachability, finite transition coverage, and exact repeat presentation ratios; it does not prove human elapsed duration.',
  });
  assert.equal(run.canonical.proof.totalMs, 0);
  assert.equal(run.canonical.proof.durationProven, false);
  assert.equal(run.fieldworkAudit.traversalExecuted, false);
});

test('required-route options fail closed on invalid identity and bounds', () => {
  assert.throws(() => runRequiredRouteCompletion({ runId: '' }), /non-empty string/);
  assert.throws(() => runRequiredRouteCompletion({ maxTransitions: 0 }), /positive safe integer/);
  assert.throws(() => runRequiredRouteCompletion({ maxTraceEvents: -1 }), /positive safe integer/);
});
