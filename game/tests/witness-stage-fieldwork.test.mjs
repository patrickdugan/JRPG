import assert from 'node:assert/strict';
import test from 'node:test';

import { getEncounter } from '../content/encounters.mjs';
import { WITNESS_CHRONICLES } from '../content/witness-chronicles.mjs';
import { getLevel, isBlocked, parseTileKey, tileKey } from '../content/levels.mjs';
import {
  WITNESS_FIELDWORK_ACTIVITY_BLUEPRINTS,
  WITNESS_STAGE_FIELDWORK,
  WITNESS_STAGE_FIELDWORK_KEYS,
  WITNESS_STAGE_TASK_NODE_KEYS,
  deriveWitnessStageFieldwork,
  getWitnessStageFieldwork,
  getWitnessStageFieldworkMetrics,
  validateWitnessStageFieldwork,
} from '../witness-stage-fieldwork.mjs';

const DELTAS = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
  [1, -1], [1, 1], [-1, 1], [-1, -1],
];

function pointOf(value) {
  if (typeof value === 'string') return { ...parseTileKey(value), key: value };
  return { x: value.x, y: value.y, key: tileKey(value.x, value.y) };
}

function open(level, value) {
  const { x, y } = pointOf(value);
  return Number.isInteger(x) && Number.isInteger(y) && !isBlocked(level, x, y);
}

function neighbors(level, value) {
  const origin = pointOf(value);
  return DELTAS.flatMap(([dx, dy]) => {
    const target = { x: origin.x + dx, y: origin.y + dy };
    if (!open(level, target)) return [];
    if (dx !== 0 && dy !== 0
      && (!open(level, { x: origin.x + dx, y: origin.y })
        || !open(level, { x: origin.x, y: origin.y + dy }))) return [];
    return [pointOf(target)];
  });
}

function reachableDistances(level) {
  const start = pointOf(level.spawn);
  const distance = new Map([[start.key, 0]]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    for (const next of neighbors(level, current)) {
      if (distance.has(next.key)) continue;
      distance.set(next.key, distance.get(current.key) + 1);
      queue.push(next);
    }
  }
  return distance;
}

function hasStrictlyForwardRoute(level, from, destination, spawnDistances) {
  const start = pointOf(from);
  const target = pointOf(destination).key;
  const seen = new Set([start.key]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    if (current.key === target) return true;
    const currentDistance = spawnDistances.get(current.key);
    for (const next of neighbors(level, current)) {
      if (seen.has(next.key) || spawnDistances.get(next.key) !== currentDistance + 1) continue;
      seen.add(next.key);
      queue.push(next);
    }
  }
  return false;
}

function canonicalStageLookup() {
  return new Map(WITNESS_CHRONICLES.flatMap((chronicle) => chronicle.stages.map((stage) => [
    `${chronicle.id}\u0000${stage.id}`,
    { chronicle, stage },
  ])));
}

function reservedKeys(level, encounter) {
  return new Set([
    tileKey(level.spawn.x, level.spawn.y),
    ...(level.interactables ?? []).map((entry) => entry.at),
    ...(level.exits ?? []).map((entry) => entry.at),
    ...(level.hazards ?? []).flatMap((hazard) => hazard.tiles ?? []),
    ...(encounter?.party?.deployment ?? []).map((entry) => entry.at),
    ...(encounter?.enemies ?? []).flatMap((enemy) => enemy.positions ?? []),
  ]);
}

function recursivelyFrozen(value, seen = new Set()) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function') || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => recursivelyFrozen(child, seen));
}

test('fieldwork has exact schemas and covers all 67 canonical stages once in order', () => {
  const canonical = WITNESS_CHRONICLES.flatMap((chronicle) => chronicle.stages.map((stage) => ({
    chronicleId: chronicle.id,
    stageId: stage.id,
    mapId: stage.mapId,
    activityType: stage.activity.type,
  })));
  assert.equal(canonical.length, 67);
  assert.equal(WITNESS_STAGE_FIELDWORK.length, 67);
  assert.deepEqual(WITNESS_STAGE_FIELDWORK.map(({ nodes: _nodes, ...identity }) => identity), canonical);
  assert.equal(new Set(WITNESS_STAGE_FIELDWORK.map((entry) => `${entry.chronicleId}\0${entry.stageId}`)).size, 67);
  for (const entry of WITNESS_STAGE_FIELDWORK) {
    assert.deepEqual(Object.keys(entry).sort(), [...WITNESS_STAGE_FIELDWORK_KEYS].sort());
    assert.ok(entry.nodes.length >= 2 && entry.nodes.length <= 5, entry.stageId);
    entry.nodes.forEach((node, index) => {
      assert.deepEqual(Object.keys(node).sort(), [...WITNESS_STAGE_TASK_NODE_KEYS].sort());
      assert.equal(node.order, index + 1);
      assert.match(node.id, new RegExp(`^${entry.chronicleId}\\.${entry.stageId}\\.task-${String(index + 1).padStart(2, '0')}-`));
    });
    assert.equal(getWitnessStageFieldwork(entry.chronicleId, entry.stageId), entry);
  }
  assert.equal(getWitnessStageFieldwork('wc-missing', 'stage-missing'), null);
  assert.deepEqual(validateWitnessStageFieldwork(), { ok: true, errors: [] });
});

test('every task node is reachable open terrain and avoids authored occupancy', () => {
  const lookup = canonicalStageLookup();
  for (const entry of WITNESS_STAGE_FIELDWORK) {
    const { stage } = lookup.get(`${entry.chronicleId}\u0000${entry.stageId}`);
    const level = getLevel(entry.mapId);
    const encounter = stage.encounterId ? getEncounter(stage.encounterId) : null;
    const distances = reachableDistances(level);
    const reserved = reservedKeys(level, encounter);
    const usableReachable = [...distances.keys()].filter((key) => !reserved.has(key));
    assert.ok(usableReachable.length >= entry.nodes.length, `${entry.stageId} has enough legal tiles for unique nodes`);
    for (const node of entry.nodes) {
      assert.equal(open(level, node.at), true, `${entry.stageId}:${node.id} must be open`);
      assert.equal(distances.has(node.at), true, `${entry.stageId}:${node.id} must be reachable`);
      assert.equal(reserved.has(node.at), false, `${entry.stageId}:${node.id} overlaps authored occupancy`);
    }
  }
});

test('ordered nodes never overlap and admit an exact-movement route with no backward step', () => {
  for (const entry of WITNESS_STAGE_FIELDWORK) {
    const level = getLevel(entry.mapId);
    const distances = reachableDistances(level);
    assert.equal(new Set(entry.nodes.map((node) => node.at)).size, entry.nodes.length, entry.stageId);
    let prior = level.spawn;
    let priorDistance = 0;
    for (const node of entry.nodes) {
      const distance = distances.get(node.at);
      assert.ok(distance > priorDistance, `${entry.stageId}:${node.id} must advance from spawn`);
      assert.equal(
        hasStrictlyForwardRoute(level, prior, node.at, distances),
        true,
        `${entry.stageId}:${node.id} requires no backtracking`,
      );
      prior = node.at;
      priorDistance = distance;
    }
  }
});

test('each activity owns distinct verbs and ends in its exact authored action', () => {
  const lookup = canonicalStageLookup();
  const types = Object.keys(WITNESS_FIELDWORK_ACTIVITY_BLUEPRINTS);
  const verbsByType = new Map(types.map((type) => [type, new Set(
    WITNESS_STAGE_FIELDWORK.filter((entry) => entry.activityType === type)
      .flatMap((entry) => entry.nodes.map((node) => node.verb)),
  )]));
  const instructionsByType = new Map(types.map((type) => [type, new Set(
    WITNESS_STAGE_FIELDWORK.filter((entry) => entry.activityType === type)
      .flatMap((entry) => entry.nodes.map((node) => node.instruction)),
  )]));
  for (let left = 0; left < types.length; left += 1) {
    for (let right = left + 1; right < types.length; right += 1) {
      assert.deepEqual(
        [...verbsByType.get(types[left])].filter((verb) => verbsByType.get(types[right]).has(verb)),
        [],
        `${types[left]} and ${types[right]} must not share player-facing verbs`,
      );
      assert.deepEqual(
        [...instructionsByType.get(types[left])].filter((instruction) => instructionsByType.get(types[right]).has(instruction)),
        [],
        `${types[left]} and ${types[right]} must not share player-facing instructions`,
      );
    }
  }
  for (const entry of WITNESS_STAGE_FIELDWORK) {
    const { stage } = lookup.get(`${entry.chronicleId}\u0000${entry.stageId}`);
    const finalNode = entry.nodes.at(-1);
    if (stage.activity.type === 'combat') {
      const encounter = getEncounter(stage.encounterId);
      assert.equal(finalNode.verb, 'Fight');
      assert.equal(finalNode.encounterId, stage.encounterId);
      assert.equal(finalNode.instruction, encounter.objective.text);
      assert.ok(entry.nodes.slice(0, -1).every((node) => node.encounterId === null));
    } else {
      assert.equal(finalNode.instruction, stage.activity.instruction);
      assert.ok(entry.nodes.every((node) => node.encounterId === null));
    }
  }
});

test('derivation is deterministic, deeply frozen, and strict validation rejects drift', () => {
  const first = deriveWitnessStageFieldwork();
  const second = deriveWitnessStageFieldwork();
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
  assert.deepEqual(first, WITNESS_STAGE_FIELDWORK);
  assert.equal(recursivelyFrozen(first), true);
  assert.equal(recursivelyFrozen(WITNESS_STAGE_FIELDWORK), true);
  assert.equal(recursivelyFrozen(WITNESS_FIELDWORK_ACTIVITY_BLUEPRINTS), true);

  const moved = JSON.parse(JSON.stringify(first));
  moved[0].nodes[0].at = '0,0';
  assert.equal(validateWitnessStageFieldwork(moved).ok, false);

  const fakeCombat = JSON.parse(JSON.stringify(first));
  const combat = fakeCombat.find((entry) => entry.activityType === 'combat');
  combat.nodes.at(-1).encounterId = 'invented-encounter';
  assert.match(validateWitnessStageFieldwork(fakeCombat).errors.join(' '), /deterministic derivation|exact canonical encounter/);
});

test('aggregate metrics account for every activity and exact encounter task', () => {
  const metrics = getWitnessStageFieldworkMetrics();
  const allNodes = WITNESS_STAGE_FIELDWORK.flatMap((entry) => entry.nodes);
  assert.equal(metrics.chronicleCount, 18);
  assert.equal(metrics.stageCount, 67);
  assert.equal(metrics.nodeCount, allNodes.length);
  assert.equal(metrics.nodeCount, 152);
  assert.equal(metrics.mapCount, 40);
  assert.equal(metrics.combatStageCount, 12);
  assert.equal(metrics.exactEncounterTaskCount, 12);
  assert.equal(metrics.minNodesPerStage, 2);
  assert.equal(metrics.maxNodesPerStage, 4);
  assert.equal(metrics.forwardOnlyStageCount, 67);
  assert.equal(metrics.abilityGateCount, 0);
  assert.ok(metrics.minimumExactMovementSteps > metrics.nodeCount);
  const derivedMinimumSteps = WITNESS_STAGE_FIELDWORK.reduce((sum, entry) => (
    sum + reachableDistances(getLevel(entry.mapId)).get(entry.nodes.at(-1).at)
  ), 0);
  assert.equal(metrics.minimumExactMovementSteps, derivedMinimumSteps);
  assert.deepEqual(metrics.stageCountsByActivity, {
    interview: 15,
    inspect: 9,
    archive: 13,
    deliver: 7,
    combat: 12,
    council: 8,
    escort: 3,
  });
  assert.equal(Object.values(metrics.stageCountsByActivity).reduce((sum, count) => sum + count, 0), 67);
  assert.equal(Object.values(metrics.nodeCountsByActivity).reduce((sum, count) => sum + count, 0), 152);
});
