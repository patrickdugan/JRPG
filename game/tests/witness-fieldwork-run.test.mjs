import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTileKey } from '../content/levels.mjs';
import { WITNESS_STAGE_FIELDWORK } from '../witness-stage-fieldwork.mjs';
import { runWitnessFieldworkTraversal } from '../witness-fieldwork-run.mjs';

const RUN = runWitnessFieldworkTraversal();

function recursivelyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => recursivelyFrozen(child, seen));
}

test('fieldwork runner reaches every ordered task through exact runtime steps', () => {
  assert.equal(RUN.ok, true);
  assert.equal(RUN.signature, 'fnv1a32:03290d06');
  assert.deepEqual(RUN.summary, {
    stageCount: 67,
    completedStageCount: 67,
    nodeCount: 152,
    completedNodeCount: 152,
    exactMovementSteps: 729,
    movementEventCount: 729,
    coordinateJumpCount: 0,
    recordedPlaytimeMs: 0,
    elapsedTimeClaimed: false,
  });
  assert.equal(RUN.stages.length, WITNESS_STAGE_FIELDWORK.length);
  for (const [index, stage] of RUN.stages.entries()) {
    const authored = WITNESS_STAGE_FIELDWORK[index];
    assert.deepEqual(stage.completedNodeIds, authored.nodes.map(({ id }) => id));
    assert.equal(stage.finalAt, authored.nodes.at(-1).at);
    assert.equal(stage.exactMovementSteps, stage.path.length - 1);
    for (let step = 1; step < stage.path.length; step += 1) {
      const from = parseTileKey(stage.path[step - 1]);
      const to = parseTileKey(stage.path[step]);
      assert.ok(Math.abs(to.x - from.x) <= 1 && Math.abs(to.y - from.y) <= 1);
      assert.notDeepEqual(to, from);
    }
  }
});

test('fieldwork traversal is deterministic, deeply frozen, and records no duration', () => {
  const repeated = runWitnessFieldworkTraversal();
  assert.equal(repeated.signature, RUN.signature);
  assert.deepEqual(repeated, RUN);
  assert.equal(recursivelyFrozen(RUN), true);
  assert.equal(RUN.summary.recordedPlaytimeMs, 0);
  assert.equal(RUN.summary.elapsedTimeClaimed, false);
});

test('fieldwork traversal fails closed on invalid catalogs and bounds', () => {
  assert.throws(() => runWitnessFieldworkTraversal({ maxStages: 0 }), /positive safe integer/);
  assert.throws(() => runWitnessFieldworkTraversal({ maxMovementSteps: 728 }), /movement bound/);
  const drifted = JSON.parse(JSON.stringify(WITNESS_STAGE_FIELDWORK));
  drifted[0].nodes[0].at = '0,0';
  assert.throws(() => runWitnessFieldworkTraversal({ catalog: drifted }), /Invalid witness fieldwork/);
});
