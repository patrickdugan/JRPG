import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACT3_OPERATION_POOL,
  ACT_ROUTE_THEATERS,
  buildAct3SequencePlan,
  buildAct4SequencePlan,
  getActSequenceContextForBeat,
} from '../content/act-route-sequences.mjs';
import { STORYWORLD_CLUSTER_BY_ID } from '../content/storyworld-encounters.generated.mjs';
import { getEncounter } from '../content/encounters.mjs';
import { getLevel } from '../content/levels.mjs';
import { getSceneDirection } from '../content/scene-direction.mjs';
import { getSceneOperation } from '../content/scene-operations.mjs';

test('every theater produces exactly eight Act III and eight Act IV major sequences', () => {
  for (const priorityTheater of Object.keys(ACT_ROUTE_THEATERS)) {
    const act3 = buildAct3SequencePlan({ priorityTheater });
    const act4 = buildAct4SequencePlan({ priorityTheater });
    assert.equal(act3.sequences.length, 8);
    assert.equal(act4.sequences.length, 8);
    assert.deepEqual(act3.sequences.map(({ ordinal }) => ordinal), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(act4.sequences.map(({ ordinal }) => ordinal), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(act3.selectedOperationIds.length, 3);
    assert.equal(new Set(act3.selectedOperationIds).size, 3);
    assert.equal(act3.sequences.filter(({ kind }) => kind === 'regional-operation').length, 3);
    assert.equal(act4.sequences[1].mapIds[0], ACT_ROUTE_THEATERS[priorityTheater].approachMapId);
  }
});

test('the dynamic Act III operation selection is finite, unique, and validates player choices', () => {
  const ids = ACT3_OPERATION_POOL.slice(0, 3).map(({ id }) => id);
  const plan = buildAct3SequencePlan({ priorityTheater: 'salt', selectedOperationIds: ids });
  assert.deepEqual(plan.selectedOperationIds, ids);
  assert.equal(plan.omittedOperationId, ACT3_OPERATION_POOL[3].id);
  assert.throws(
    () => buildAct3SequencePlan({ priorityTheater: 'salt', selectedOperationIds: [ids[0], ids[0], ids[1]] }),
    /must be unique/u,
  );
  assert.throws(
    () => buildAct3SequencePlan({ priorityTheater: 'paper', selectedOperationIds: ids.slice(0, 3) }),
    /must include its priority paper theater/u,
  );
});

test('every sequence reference resolves to an authored map, encounter, beat script, or Storyworld cluster', () => {
  for (const priorityTheater of Object.keys(ACT_ROUTE_THEATERS)) {
    const sequences = [
      ...buildAct3SequencePlan({ priorityTheater }).sequences,
      ...buildAct4SequencePlan({ priorityTheater }).sequences,
    ];
    for (const sequence of sequences) {
      for (const mapId of sequence.mapIds ?? []) assert.ok(getLevel(mapId), `${sequence.id}/${mapId}`);
      for (const encounterId of sequence.encounterIds ?? []) assert.ok(getEncounter(encounterId), `${sequence.id}/${encounterId}`);
      for (const clusterId of sequence.storyworldClusterIds ?? []) {
        assert.ok(STORYWORLD_CLUSTER_BY_ID.get(clusterId), `${sequence.id}/${clusterId}`);
      }
      for (const beatId of [...(sequence.beatIds ?? []), ...(sequence.anchorBeatIds ?? [])]) {
        assert.ok(getActSequenceContextForBeat(beatId), `${sequence.id}/${beatId}`);
      }
    }
  }
});

test('map operations and scene directions share the same act-sequence identity', () => {
  for (const beatId of [
    'c3-01-separate-arrivals',
    'c4-03-varga-journal',
    'c5-05-sigil-burned',
    'c6-03-tribunal',
    'c7-03-aqueduct-names',
    'c8-04-lantern-breach',
    'c9-01-archive-breathes',
    'c9-05-dawn-at-observatory',
  ]) {
    const context = getActSequenceContextForBeat(beatId);
    const operation = getSceneOperation(beatId);
    const direction = getSceneDirection(beatId);
    assert.equal(operation.actId, context.actId);
    assert.equal(direction.actId, context.actId);
    assert.equal(operation.majorSequenceId, context.majorSequenceId);
    assert.equal(direction.majorSequenceId, context.majorSequenceId);
    assert.equal(operation.operationId, context.operationId);
    assert.equal(direction.routeTheater, context.routeTheater);
  }
});
