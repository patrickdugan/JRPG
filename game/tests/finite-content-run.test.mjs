import assert from 'node:assert/strict';
import test from 'node:test';

import { REPEATABLE_CONTRACTS, SIDE_QUESTS } from '../content/sidequests.mjs';
import { WITNESS_CHRONICLES } from '../content/witness-chronicles.mjs';
import {
  FINITE_CONTENT_RUN_EXPECTATIONS,
  runFiniteContentCompletion,
} from '../finite-content-run.mjs';

const EXACT_BOUNDS = {
  maxTransitions: FINITE_CONTENT_RUN_EXPECTATIONS.requiredTransitionCount,
  maxTraceEvents: FINITE_CONTENT_RUN_EXPECTATIONS.requiredTraceEventCount,
};
const RUN = runFiniteContentCompletion(EXACT_BOUNDS);

function recursivelyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => recursivelyFrozen(child, seen));
}

test('finite completion replays identically at its exact hard bounds', () => {
  const replay = runFiniteContentCompletion(EXACT_BOUNDS);
  assert.equal(RUN.ok, true);
  assert.match(RUN.signature, /^fnv1a32:[0-9a-f]{8}$/);
  assert.equal(replay.signature, RUN.signature);
  assert.deepEqual(replay.trace, RUN.trace);
  assert.deepEqual(replay.summary, RUN.summary);
  assert.deepEqual(replay.rewardAudit, RUN.rewardAudit);
  assert.equal(RUN.trace.length, FINITE_CONTENT_RUN_EXPECTATIONS.requiredTraceEventCount);
  assert.equal(recursivelyFrozen(RUN), true);
});

test('all 13 finite sidequests and all 18 chronicles finish in canonical order with exact transition counts', () => {
  assert.equal(RUN.summary.finiteSideQuestCount, 13);
  assert.equal(RUN.summary.sideQuestObjectiveCount, 59);
  assert.equal(RUN.summary.witnessChronicleCount, 18);
  assert.equal(RUN.summary.witnessDialogueLineAcknowledgements, 288);
  assert.equal(RUN.summary.witnessStageCount, 67);
  assert.equal(RUN.summary.witnessChoiceCount, 18);
  assert.equal(RUN.summary.witnessCombatEvidenceCount, 12);
  assert.equal(RUN.summary.optionalTransitionCount, 538);
  assert.equal(RUN.states.quests.revision, 85);
  assert.equal(RUN.states.witnessChronicles.revision, 391);

  assert.deepEqual(RUN.states.quests.records.map(({ id }) => id), SIDE_QUESTS.map(({ id }) => id));
  assert.ok(RUN.states.quests.records.every((record) => (
    record.status === 'completed'
    && record.completions === 1
    && record.objectiveIndex === SIDE_QUESTS.find((quest) => quest.id === record.id).objectives.length
  )));
  assert.deepEqual(
    RUN.states.witnessChronicles.records.map(({ id }) => id),
    WITNESS_CHRONICLES.map(({ id }) => id),
  );
  assert.ok(RUN.states.witnessChronicles.records.every((record) => {
    const entry = WITNESS_CHRONICLES.find((chronicle) => chronicle.id === record.id);
    return record.status === 'completed'
      && record.stageIndex === entry.stages.length
      && record.acknowledgedLines === 0
      && record.choiceId === entry.choice.options[0].id;
  }));

  assert.equal(RUN.trace.filter(({ type }) => type === 'sidequest-objective-complete').length, 59);
  assert.equal(RUN.trace.filter(({ type }) => type === 'witness-line-acknowledged').length, 288);
  assert.equal(RUN.trace.filter(({ type }) => type === 'witness-stage-complete').length, 67);
  const combatStages = RUN.trace.filter((event) => event.type === 'witness-stage-complete' && event.combatEvidence);
  assert.equal(combatStages.length, 12);
  assert.ok(combatStages.every(({ combatEvidence }) => (
    combatEvidence.victory === true
    && combatEvidence.canonicalWinCount === 1
    && RUN.states.advancement.encounterWins[combatEvidence.encounterId] === 1
  )));
  assert.ok(RUN.trace
    .filter((event) => event.type === 'witness-stage-complete' && !event.combatEvidence)
    .every((event) => event.combatEvidence === null));
});

test('all 31 rewards settle once across advancement and loadout', () => {
  assert.equal(RUN.summary.finiteRewardCount, 31);
  assert.equal(RUN.summary.atomicRewardSettlementCount, 31);
  assert.equal(RUN.summary.advancementRewardTransactionCount, 31);
  assert.equal(RUN.summary.loadoutRewardTransactionCount, 31);
  assert.equal(RUN.rewardAudit.settlementCount, 31);
  assert.equal(RUN.rewardAudit.authoredXpPerMember, 12755);
  assert.equal(RUN.rewardAudit.currency, 5638);
  assert.deepEqual(RUN.rewardAudit.advancementItems, { 'River Salve': 41, 'Ward Tonic': 42 });
  assert.deepEqual(RUN.rewardAudit.loadoutItems, { 'river-salve': 41, 'ward-tonic': 42 });
  assert.equal(RUN.rewardAudit.authoredKeyItems, 25);
  assert.equal(RUN.rewardAudit.addedKeyItems, 25);
  assert.equal(RUN.rewardAudit.alreadyOwnedKeyItems, 0);
  assert.equal(
    RUN.rewardAudit.advancementCurrencyAfter - RUN.rewardAudit.advancementCurrencyBefore,
    RUN.rewardAudit.currency,
  );
  assert.equal(
    RUN.rewardAudit.loadoutCurrencyAfter - RUN.rewardAudit.loadoutCurrencyBefore,
    RUN.rewardAudit.currency,
  );
  assert.equal(
    RUN.rewardAudit.advancementRevisionAfter - RUN.rewardAudit.advancementRevisionBefore,
    31,
  );
  assert.equal(RUN.rewardAudit.loadoutRevisionAfter - RUN.rewardAudit.loadoutRevisionBefore, 31);
  assert.equal(RUN.rewardAudit.atomicAcrossCompletionAndBothRewardLedgers, true);
  assert.equal(RUN.trace.filter(({ type }) => type === 'reward-settled-atomically').length, 31);
});

test('finite content refuses replay and excludes all repeat contracts', () => {
  const refusalEvents = RUN.trace.filter(({ type }) => type === 'finite-replay-refused');
  assert.equal(refusalEvents.length, 31);
  assert.equal(RUN.summary.replayRefusalCount, 31);
  assert.equal(RUN.summary.replayAttemptCount, 62);
  assert.ok(refusalEvents.every((event) => (
    /already complete|finite and already complete/.test(event.acceptanceReason)
    && /not active/.test(event.duplicateCompletionReason)
  )));
  assert.equal(RUN.summary.repeatContractCatalogCount, REPEATABLE_CONTRACTS.length);
  assert.equal(RUN.summary.repeatContractCompletionCount, 0);
  assert.equal(RUN.completionProof.repeatContractsCounted, false);
  const stateIds = new Set(RUN.states.quests.records.map(({ id }) => id));
  assert.ok(REPEATABLE_CONTRACTS.every(({ id }) => !stateIds.has(id)));
});

test('fieldwork quantities are audited while every playtime and duration claim remains zero', () => {
  assert.deepEqual(RUN.fieldworkAudit, {
    catalogSignature: RUN.fieldworkAudit.catalogSignature,
    stageCount: 67,
    nodeCount: 152,
    minimumExactMovementSteps: 729,
    traversalPerformedByHarness: false,
    exactMovementStepsRecorded: 0,
  });
  assert.match(RUN.fieldworkAudit.catalogSignature, /^fnv1a32:[0-9a-f]{8}$/);
  assert.equal(RUN.summary.fieldworkNodeCount, 152);
  assert.equal(RUN.summary.auditedMinimumExactMovementSteps, 729);
  assert.equal(RUN.summary.exactMovementStepsRecorded, 0);
  assert.equal(RUN.summary.recordedPlaytimeMs, 0);
  assert.equal(RUN.summary.durationClaimed, false);
  assert.equal(RUN.summary.durationProven, false);
  assert.equal(RUN.states.receipt.playtime.totalMs, 0);
  assert.equal(RUN.states.field.totalPlaytimeMs, 0);
  assert.equal(RUN.canonical.proof.totalMs, 0);
  assert.equal(RUN.canonical.proof.durationProven, false);
  assert.deepEqual(RUN.durationEvidence, {
    recordedPlaytimeMs: 0,
    durationClaimed: false,
    durationProven: false,
    statement: 'This completion witness proves finite state transitions and audited traversal quantities only; it is not timed-play evidence.',
  });
  assert.equal('estimatedMinutes' in RUN.summary, false);
});

test('invalid and insufficient transition or trace bounds fail closed', () => {
  assert.throws(() => runFiniteContentCompletion({ maxTransitions: 0 }), /positive safe integer/);
  assert.throws(
    () => runFiniteContentCompletion({ maxTransitions: FINITE_CONTENT_RUN_EXPECTATIONS.requiredTransitionCount - 1 }),
    /must allow the 538 required finite transitions/,
  );
  assert.throws(
    () => runFiniteContentCompletion({ maxTraceEvents: FINITE_CONTENT_RUN_EXPECTATIONS.requiredTraceEventCount - 1 }),
    /must allow the 540 required finite trace events/,
  );
  assert.throws(() => runFiniteContentCompletion({ runId: '' }), /runId must be a non-empty string/);
});
