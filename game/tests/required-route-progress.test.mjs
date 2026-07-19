import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdvancementState } from '../advancement.mjs';
import {
  acknowledgeArchiveRecordParagraph,
  beginArchiveRecord,
  createArchiveRecordState,
  getArchiveRecordProgress,
} from '../archive-record-runtime.mjs';
import { createCampConversationState } from '../camp-conversation-runtime.mjs';
import { createPartyCouncilState } from '../party-council-runtime.mjs';
import { completeCurrentBeat, createCampaignState } from '../progression.mjs';
import { createQuestState } from '../quest-runtime.mjs';
import {
  REQUIRED_ROUTE_ACTIVITY_TYPES,
  REQUIRED_ROUTE_CONTRACT,
  REQUIRED_ROUTE_GRIND_MILESTONES,
} from '../required-route-contract.mjs';
import { deriveRequiredRouteProgress } from '../required-route-progress.mjs';
import { runRequiredRouteCompletion } from '../required-route-run.mjs';
import { createWitnessChronicleState } from '../witness-chronicle-runtime.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));

function inputs(overrides = {}) {
  return {
    campaignState: createCampaignState(),
    questState: createQuestState(),
    witnessChronicleState: createWitnessChronicleState(),
    campConversationState: createCampConversationState('route-progress-test'),
    partyCouncilState: createPartyCouncilState('route-progress-test'),
    archiveRecordState: createArchiveRecordState('route-progress-test'),
    advancementState: createAdvancementState(),
    ...overrides,
  };
}

let completedRun;
function getCompletedRun() {
  completedRun ??= runRequiredRouteCompletion({ runId: 'route-progress-full-0001' });
  return completedRun;
}

function completedInputs(overrides = {}) {
  const run = getCompletedRun();
  return inputs({
    campaignState: run.states.campaign,
    questState: run.states.quests,
    witnessChronicleState: run.states.witnessChronicles,
    campConversationState: run.states.campConversations,
    partyCouncilState: run.states.partyCouncils,
    archiveRecordState: run.states.archiveRecords,
    advancementState: run.states.advancement,
    ...overrides,
  });
}

test('fresh valid states expose a locked, zero-credit 215-activity ledger', () => {
  const progress = deriveRequiredRouteProgress(inputs());
  assert.deepEqual(progress.sourceValidity, {
    campaign: true,
    quests: true,
    witnessChronicles: true,
    campConversations: true,
    partyCouncils: true,
    archiveRecords: true,
    advancement: true,
  });
  assert.deepEqual(progress.runBinding, {
    campConversations: 'route-progress-test',
    partyCouncils: 'route-progress-test',
    archiveRecords: 'route-progress-test',
  });
  assert.deepEqual(progress.metrics.total, {
    requiredActivityCount: 215,
    unlockedActivityCount: 0,
    enteredActivityCount: 0,
    completedActivityCount: 0,
    dueActivityCount: 0,
    entryDueActivityCount: 0,
    inProgressActivityCount: 0,
    remainingActivityCount: 215,
    lockedActivityCount: 215,
  });
  assert.deepEqual(progress.enteredActivityIds, []);
  assert.deepEqual(progress.completedActivityIds, []);
  assert.equal(progress.remainingActivityIds.length, 215);
  assert.equal(progress.creditsGate.creditsReady, false);
});
test('an unlocked active activity is entered, due, and in progress but not complete', () => {
  const campaignState = completeCurrentBeat(createCampaignState());
  const firstActivity = REQUIRED_ROUTE_CONTRACT.stages[0].activities[0];
  assert.equal(firstActivity.type, 'archive-record');
  const started = beginArchiveRecord(
    createArchiveRecordState('route-progress-active'),
    firstActivity.id,
    { campaignState },
  );
  assert.equal(started.ok, true);

  const active = deriveRequiredRouteProgress(inputs({
    campaignState,
    archiveRecordState: started.state,
  }));
  assert.deepEqual(active.unlockedActivityIds, [firstActivity.id]);
  assert.deepEqual(active.enteredActivityIds, [firstActivity.id]);
  assert.deepEqual(active.completedActivityIds, []);
  assert.deepEqual(active.dueActivityIds, [firstActivity.id]);
  assert.deepEqual(active.entryDueActivityIds, []);
  assert.deepEqual(active.inProgressActivityIds, [firstActivity.id]);

  let archiveState = started.state;
  while (!getArchiveRecordProgress(archiveState, firstActivity.id).complete) {
    archiveState = acknowledgeArchiveRecordParagraph(archiveState, firstActivity.id).state;
  }
  const completed = deriveRequiredRouteProgress(inputs({ campaignState, archiveRecordState: archiveState }));
  assert.deepEqual(completed.completedActivityIds, [firstActivity.id]);
  assert.deepEqual(completed.dueActivityIds, []);
  assert.deepEqual(completed.inProgressActivityIds, []);
});

test('full executable route supplies completed evidence for every activity type', () => {
  const progress = deriveRequiredRouteProgress(completedInputs());
  assert.equal(progress.metrics.total.requiredActivityCount, 215);
  assert.equal(progress.metrics.total.enteredActivityCount, 215);
  assert.equal(progress.metrics.total.completedActivityCount, 215);
  assert.deepEqual(progress.remainingActivityIds, []);
  assert.equal(progress.creditsGate.creditsReady, true);
  assert.deepEqual(Object.keys(progress.metrics.byType), [...REQUIRED_ROUTE_ACTIVITY_TYPES]);
  assert.deepEqual(Object.fromEntries(REQUIRED_ROUTE_ACTIVITY_TYPES.map((type) => [
    type,
    progress.metrics.byType[type].completedActivityCount,
  ])), {
    'finite-sidequest': 13,
    'witness-chronicle': 18,
    'camp-conversation': 90,
    'party-council': 30,
    'archive-record': 60,
    'repeat-grind-milestone': 4,
  });
});

test('repeat milestone needs both a completed contract circuit and a second encounter win', () => {
  const milestone = REQUIRED_ROUTE_GRIND_MILESTONES[0];
  const advancementState = clone(getCompletedRun().states.advancement);
  advancementState.encounterWins[milestone.encounterId] = 1;
  const missingReplay = deriveRequiredRouteProgress(completedInputs({ advancementState }));
  assert.equal(missingReplay.enteredActivityIds.includes(milestone.id), true);
  assert.equal(missingReplay.completedActivityIds.includes(milestone.id), false);
  assert.equal(missingReplay.dueActivityIds.includes(milestone.id), true);

  advancementState.encounterWins[milestone.encounterId] = 2;
  const questState = clone(getCompletedRun().states.quests);
  const contractRecord = questState.records.find(({ id }) => id === milestone.questId);
  contractRecord.status = 'active';
  contractRecord.completions = 0;
  const missingCircuit = deriveRequiredRouteProgress(completedInputs({ questState, advancementState }));
  assert.equal(missingCircuit.completedActivityIds.includes(milestone.id), false);

  contractRecord.completions = 1;
  const nextCircuitActive = deriveRequiredRouteProgress(completedInputs({ questState, advancementState }));
  assert.equal(nextCircuitActive.completedActivityIds.includes(milestone.id), true,
    'accepting a later circuit must not erase the persisted completed circuit');
});

test('malformed or missing sources never throw and never manufacture credit', () => {
  const fullCampaign = getCompletedRun().states.campaign;
  const progress = deriveRequiredRouteProgress({
    campaignState: fullCampaign,
    questState: {
      records: [{ id: 'contract-c1-cinder-route', status: 'completed', completions: 99 }],
    },
    witnessChronicleState: 'completed',
    campConversationState: null,
    partyCouncilState: { records: 'all' },
    archiveRecordState: { records: [{ id: 'archive-e02-repaired-tower', status: 'completed' }] },
    advancementState: { encounterWins: { 'c1-cinder-hounds': 999 } },
  });
  assert.equal(progress.sourceValidity.campaign, true);
  assert.deepEqual({ ...progress.sourceValidity, campaign: undefined }, {
    campaign: undefined,
    quests: false,
    witnessChronicles: false,
    campConversations: false,
    partyCouncils: false,
    archiveRecords: false,
    advancement: false,
  });
  assert.equal(progress.metrics.total.unlockedActivityCount, 215);
  assert.equal(progress.metrics.total.completedActivityCount, 0);
  assert.equal(progress.metrics.total.dueActivityCount, 215);
  assert.equal(progress.creditsGate.creditsReady, false);

  const absent = deriveRequiredRouteProgress();
  assert.equal(absent.metrics.total.unlockedActivityCount, 0);
  assert.equal(absent.metrics.total.completedActivityCount, 0);
  assert.equal(absent.metrics.total.remainingActivityCount, 215);
});

test('derivation is deterministic, canonically ordered, and deeply immutable', () => {
  const source = completedInputs();
  const first = deriveRequiredRouteProgress(source);
  const second = deriveRequiredRouteProgress(source);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.completedActivityIds,
    REQUIRED_ROUTE_CONTRACT.stages.flatMap((stage) => stage.activities.map(({ id }) => id)),
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.completedActivityIds), true);
  assert.equal(Object.isFrozen(first.metrics), true);
  assert.equal(Object.isFrozen(first.metrics.byType['repeat-grind-milestone']), true);
  assert.throws(() => first.completedActivityIds.push('fabricated-credit'), TypeError);
  assert.throws(() => {
    first.metrics.total.completedActivityCount = 0;
  }, TypeError);
});
