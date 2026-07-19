import assert from 'node:assert/strict';
import test from 'node:test';

import { createCampaignState, completeCurrentBeat, isCampaignComplete } from '../progression.mjs';
import {
  REQUIRED_ROUTE_ACTIVITY_TYPES,
  REQUIRED_ROUTE_CONTRACT,
  REQUIRED_ROUTE_GRIND_MILESTONES,
  REQUIRED_ROUTE_METRICS,
  getRequiredRouteActivity,
  getRequiredRouteCreditsGate,
  getRequiredRouteStage,
  getRequiredRouteStageGate,
  validateRequiredRouteContract,
} from '../required-route-contract.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));

test('required route covers every canonical beat and exact finite catalogue once at unlock', () => {
  assert.deepEqual(REQUIRED_ROUTE_METRICS, {
    canonicalBeatCount: 60,
    requiredActivityCount: 215,
    finiteSideQuestCount: 13,
    witnessChronicleCount: 18,
    campConversationCount: 90,
    partyCouncilCount: 30,
    archiveRecordCount: 60,
    repeatGrindMilestoneCount: 4,
    requiredRepeatWinCount: 4,
    firstActivityAfterBeatId: 'p00-delivery-in-rain',
    finalActivityAfterBeatId: 'e02-repaired-tower',
  });
  assert.deepEqual(validateRequiredRouteContract(REQUIRED_ROUTE_CONTRACT), { ok: true, errors: [] });
  const activities = REQUIRED_ROUTE_CONTRACT.stages.flatMap((stage) => stage.activities);
  assert.equal(new Set(activities.map(({ id }) => id)).size, 215);
  assert.deepEqual(
    [...new Set(activities.map(({ type }) => type))].sort(),
    [...REQUIRED_ROUTE_ACTIVITY_TYPES].sort(),
  );
  for (const stage of REQUIRED_ROUTE_CONTRACT.stages) {
    assert.ok(Object.isFrozen(stage));
    assert.ok(Object.isFrozen(stage.activities));
    for (const activity of stage.activities) {
      assert.equal(activity.unlockAfterBeatId, stage.beatId);
      assert.equal(getRequiredRouteActivity(activity.id), activity);
    }
  }
});

test('finite activities are interleaved throughout campaign stages rather than appended after completion', () => {
  const stages = REQUIRED_ROUTE_CONTRACT.stages;
  assert.equal(stages[0].beatId, 'p00-delivery-in-rain');
  assert.equal(stages.at(-1).beatId, 'e02-repaired-tower');
  assert.ok(stages[0].activities.some(({ type }) => type === 'archive-record'));
  assert.ok(stages[1].activities.some(({ type }) => type === 'witness-chronicle'));
  assert.ok(stages[2].activities.some(({ type }) => type === 'finite-sidequest'));
  assert.ok(stages[5].activities.some(({ type }) => type === 'camp-conversation'));
  assert.ok(stages[17].activities.some(({ type }) => type === 'party-council'));
  for (const stage of stages) {
    assert.equal(stage.activities.filter(({ type }) => type === 'archive-record').length, 1,
      `${stage.beatId} must surface its own archive reading`);
  }
  const stagesWithActivities = stages.filter(({ activities }) => activities.length > 0);
  assert.equal(stagesWithActivities.length, 60);
  assert.equal(getRequiredRouteStage('c5-03-cipher-room').beatId, 'c5-03-cipher-room');
  assert.equal(getRequiredRouteStage('not-a-beat'), null);
});

test('four explicit grind milestones require one prior-clear replay and exact speed choices', () => {
  assert.deepEqual(REQUIRED_ROUTE_GRIND_MILESTONES.map((entry) => ({
    id: entry.id,
    questId: entry.questId,
    encounterId: entry.encounterId,
    after: entry.unlockAfterBeatId,
    circuits: entry.requiredContractCircuits,
    wins: entry.requiredRepeatWins,
    speeds: entry.speedMultipliers,
  })), [
    {
      id: 'grind-contract-c1-cinder-route',
      questId: 'contract-c1-cinder-route',
      encounterId: 'c1-cinder-hounds',
      after: 'c1-04-flooded-cedars',
      circuits: 1,
      wins: 1,
      speeds: [1, 2, 4],
    },
    {
      id: 'grind-contract-c3-dock-watch',
      questId: 'contract-c3-dock-watch',
      encounterId: 'c3-dock-patrol',
      after: 'c3-04-lantern-boat-escort',
      circuits: 1,
      wins: 1,
      speeds: [1, 2, 4],
    },
    {
      id: 'grind-contract-c5-ash-release',
      questId: 'contract-c5-ash-release',
      encounterId: 'c5-ashen-release',
      after: 'c5-03-cipher-room',
      circuits: 1,
      wins: 1,
      speeds: [1, 2, 4],
    },
    {
      id: 'grind-contract-c7-aqueduct-watch',
      questId: 'contract-c7-aqueduct-watch',
      encounterId: 'c7-name-slip-release',
      after: 'c7-03-aqueduct-names',
      circuits: 1,
      wins: 1,
      speeds: [1, 2, 4],
    },
  ]);
  assert.deepEqual(REQUIRED_ROUTE_CONTRACT.grindPolicy, {
    firstClearsAt1x: true,
    repeatPresentationSpeeds: [1, 2, 4],
    speedChangesCombatDecisions: false,
    speedChangesRewards: false,
    elapsedTimeClaimed: false,
  });
});

test('route validator rejects chronology drift, omissions, and unsupported grind speed', () => {
  const displaced = clone(REQUIRED_ROUTE_CONTRACT);
  displaced.stages[0].activities[0].unlockAfterBeatId = displaced.stages[1].beatId;
  assert.match(validateRequiredRouteContract(displaced).errors.join(' '), /displaced|differs/);

  const missing = clone(REQUIRED_ROUTE_CONTRACT);
  missing.stages[0].activities = [];
  assert.match(validateRequiredRouteContract(missing).errors.join(' '), /exactly 215|required activity/);

  const speed = clone(REQUIRED_ROUTE_CONTRACT);
  const milestone = speed.stages.flatMap((stage) => stage.activities)
    .find(({ type }) => type === 'repeat-grind-milestone');
  milestone.speedMultipliers = [1, 3, 4];
  assert.match(validateRequiredRouteContract(speed).errors.join(' '), /differs|grindPolicy/);
});

test('pure stage gate exposes exact outstanding activities for campaign UI', () => {
  const stage = getRequiredRouteStage('p00-delivery-in-rain');
  const fresh = createCampaignState();
  const locked = getRequiredRouteStageGate(fresh, stage.beatId);
  assert.equal(locked.unlocked, false);
  assert.equal(locked.readyForNextFrontier, false);
  assert.deepEqual(locked.remainingActivityIds, ['archive-p00-delivery-in-rain']);

  const completedBeat = completeCurrentBeat(fresh);
  const open = getRequiredRouteStageGate(completedBeat, stage.beatId);
  assert.equal(open.unlocked, true);
  assert.equal(open.enteredActivityCount, 0);
  const satisfied = getRequiredRouteStageGate(completedBeat, stage.beatId, open.remainingActivityIds);
  assert.equal(satisfied.entryGateSatisfied, true);
  assert.equal(satisfied.readyForNextFrontier, true);
  assert.equal(satisfied.enteredActivityCount, 1);
  assert.deepEqual(satisfied.remainingActivityIds, []);
  assert.equal(getRequiredRouteStageGate(fresh, 'not-a-beat'), null);
});

test('credits gate is distinct from frontier entry and requires all 215 completions', () => {
  let campaign = createCampaignState();
  while (!isCampaignComplete(campaign)) campaign = completeCurrentBeat(campaign);
  const allActivityIds = REQUIRED_ROUTE_CONTRACT.stages.flatMap((stage) => stage.activities.map(({ id }) => id));
  const noActivities = getRequiredRouteCreditsGate(campaign, []);
  assert.equal(noActivities.campaignComplete, true);
  assert.equal(noActivities.completedActivityCount, 0);
  assert.equal(noActivities.remainingActivityIds.length, 215);
  assert.equal(noActivities.creditsReady, false);

  const oneMissing = getRequiredRouteCreditsGate(campaign, allActivityIds.slice(0, -1));
  assert.equal(oneMissing.completedActivityCount, 214);
  assert.deepEqual(oneMissing.remainingActivityIds, [allActivityIds.at(-1)]);
  assert.equal(oneMissing.creditsReady, false);

  const ready = getRequiredRouteCreditsGate(campaign, allActivityIds);
  assert.equal(ready.completedActivityCount, 215);
  assert.deepEqual(ready.remainingActivityIds, []);
  assert.equal(ready.creditsReady, true);
  assert.equal(getRequiredRouteCreditsGate(createCampaignState(), allActivityIds).creditsReady, false);
});
