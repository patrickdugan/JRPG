import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAMPAIGN_ROUTE_SCHEDULES,
  CANONICAL_CAMPAIGN_BEAT_IDS,
  getCampaignRouteSchedule,
  getNarrativeRouteSchedules,
  getRouteMapIdForBeat,
} from '../campaign-route-scheduler.mjs';
import {
  ACT3_OPERATION_POOL,
  buildAct3SequencePlan,
  buildAct4SequencePlan,
} from '../content/act-route-sequences.mjs';
import { getSceneOperation } from '../content/scene-operations.mjs';
import {
  completeCurrentBeat,
  createCampaignState,
  getNextBeat,
  getScheduledBeatIds,
  isCampaignComplete,
  validateSavePayload,
} from '../progression.mjs';

const EXPECTED = Object.freeze({
  salt: Object.freeze({
    selected: ['sodegaura-lanterns', 'nagi-sea-ledger', 'kagura-furnace'],
    omitted: 'kozui-print-war',
    beatCount: 55,
    storyworldCount: 11,
    playedSceneCount: 77,
    approachMapId: 'c8-sodegaura-return',
  }),
  ash: Object.freeze({
    selected: ['kagura-furnace', 'kozui-print-war', 'sodegaura-lanterns'],
    omitted: 'nagi-sea-ledger',
    beatCount: 54,
    storyworldCount: 11,
    playedSceneCount: 76,
    approachMapId: 'c8-takamine-return',
  }),
  paper: Object.freeze({
    selected: ['kozui-print-war', 'nagi-sea-ledger', 'kagura-furnace'],
    omitted: 'sodegaura-lanterns',
    beatCount: 55,
    storyworldCount: 11,
    playedSceneCount: 77,
    approachMapId: 'c8-hoshigawa-return',
  }),
});

test('war-table choices project exact three-operation schedules and eight-sequence Acts III and IV', () => {
  assert.equal(CAMPAIGN_ROUTE_SCHEDULES.canonical.beatIds, CANONICAL_CAMPAIGN_BEAT_IDS);
  assert.equal(getNarrativeRouteSchedules().length, 3);
  for (const [theater, expected] of Object.entries(EXPECTED)) {
    const schedule = getCampaignRouteSchedule(theater);
    const act3 = buildAct3SequencePlan({ priorityTheater: theater });
    const act4 = buildAct4SequencePlan({ priorityTheater: theater });
    assert.deepEqual(schedule.selectedOperationIds, expected.selected);
    assert.equal(schedule.omittedOperationId, expected.omitted);
    assert.equal(schedule.beatIds.length, expected.beatCount);
    assert.equal(schedule.storyworldDecisionIds.length, expected.storyworldCount);
    assert.equal(schedule.playedSceneCount, expected.playedSceneCount);
    assert.equal(schedule.approachMapId, expected.approachMapId);
    assert.equal(act3.sequences.length, 8);
    assert.equal(act4.sequences.length, 8);
    assert.equal(act4.approachMapId, expected.approachMapId);

    const omitted = ACT3_OPERATION_POOL.find(({ id }) => id === expected.omitted);
    for (const beatId of omitted.beatIds) assert.equal(schedule.beatIds.includes(beatId), false);
    for (const clusterId of omitted.storyworldClusterIds) {
      assert.equal(schedule.storyworldDecisionIds.includes(clusterId), false);
    }
  }
});

test('campaign progression walks each selected route without visiting its omitted operation', () => {
  for (const theater of Object.keys(EXPECTED)) {
    const schedule = getCampaignRouteSchedule(theater);
    const route = { priorityTheater: theater };
    let state = createCampaignState();
    assert.equal(getScheduledBeatIds(state, route), schedule.beatIds);
    for (const [index, beatId] of schedule.beatIds.entries()) {
      assert.equal(state.current.beatId, beatId);
      assert.equal(getNextBeat(state, route)?.id ?? null, schedule.beatIds[index + 1] ?? null);
      state = completeCurrentBeat(state, route);
    }
    assert.deepEqual(state.completedBeatIds, schedule.beatIds);
    assert.equal(isCampaignComplete(state), true);
    assert.equal(validateSavePayload(state).ok, true);
    for (const omittedBeatId of schedule.omittedBeatIds) {
      assert.equal(state.completedBeatIds.includes(omittedBeatId), false);
    }
  }
});

test('the Act IV consent operation instantiates on the selected approach map', () => {
  for (const [theater, expected] of Object.entries(EXPECTED)) {
    const operation = getSceneOperation(
      'c8-02-consent-not-conscription',
      { priorityTheater: theater },
    );
    assert.equal(operation.levelId, expected.approachMapId);
    assert.equal(operation.routeTheater, theater);
    assert.equal(
      getRouteMapIdForBeat('c8-02-consent-not-conscription', theater, 'c8-black-gate'),
      expected.approachMapId,
    );
    assert.equal(new Set(operation.nodes.map(({ at }) => at)).size, operation.nodes.length);
  }
});
