import assert from 'node:assert/strict';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import {
  getEncountersForLevel,
  getEncounter,
} from '../content/encounters.mjs';
import {
  getLevel,
  isBlocked,
  isInBounds,
  parseTileKey,
  tileKey,
} from '../content/levels.mjs';
import {
  SCENE_OPERATION_ACTIVITY_TYPES,
  SCENE_OPERATION_METRICS,
  SCENE_OPERATION_SCHEMA,
  SCENE_OPERATIONS,
  getSceneOperation,
  getSceneOperationMetrics,
  validateSceneOperations,
} from '../content/scene-operations.mjs';

const DIRECTIONS = [
  { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
  { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 },
];

function canonicalBeats() {
  return CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => ({
    chapterId: chapter.id,
    beat,
  })));
}

function canStep(level, from, to) {
  if (!isInBounds(level, to.x, to.y) || isBlocked(level, to.x, to.y)) return false;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx && dy && (isBlocked(level, from.x + dx, from.y) || isBlocked(level, from.x, from.y + dy))) return false;
  return true;
}

function shortestSteps(level, start, goal) {
  const queue = [{ ...start, steps: 0 }];
  const seen = new Set([tileKey(start.x, start.y)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current.x === goal.x && current.y === goal.y) return current.steps;
    for (const direction of DIRECTIONS) {
      const next = { x: current.x + direction.dx, y: current.y + direction.dy };
      const key = tileKey(next.x, next.y);
      if (seen.has(key) || !canStep(level, current, next)) continue;
      seen.add(key);
      queue.push({ ...next, steps: current.steps + 1 });
    }
  }
  return null;
}

function deploymentTiles(encounter) {
  return [
    ...(encounter.party?.deployment ?? []).map((entry) => entry.at),
    ...(encounter.party?.guestSupport ?? []).map((entry) => entry.at),
    ...(encounter.enemies ?? []).flatMap((enemy) => enemy.positions ?? []),
  ];
}

function reservedTiles(level) {
  return new Set([
    tileKey(level.spawn.x, level.spawn.y),
    ...(level.exits ?? []).map((entry) => entry.at),
    ...(level.interactables ?? []).map((entry) => entry.at),
    ...(level.hazards ?? []).flatMap((entry) => entry.tiles ?? []),
    ...(level.encounterTriggers ?? []).flatMap((entry) => entry.tiles ?? []),
    ...getEncountersForLevel(level.id).flatMap(deploymentTiles),
  ].filter(Boolean));
}

function isDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((entry) => isDeepFrozen(entry, seen));
}

function hasTimeDeclaration(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value).some(([key, entry]) => /minute|duration|estimated.*time/i.test(key) || hasTimeDeclaration(entry, seen));
}

function replaceOperation(index, operation) {
  return {
    ...SCENE_OPERATIONS,
    operations: SCENE_OPERATIONS.operations.map((entry, entryIndex) => entryIndex === index ? operation : entry),
  };
}

test('finite operations cover all 60 canonical beats exactly once and in order', () => {
  const expected = canonicalBeats().map(({ chapterId, beat }) => ({ chapterId, beatId: beat.id, levelId: beat.mapId }));
  const actual = SCENE_OPERATIONS.operations.map(({ chapterId, beatId, levelId }) => ({ chapterId, beatId, levelId }));

  assert.equal(expected.length, 60);
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual.map(({ beatId }) => beatId)).size, 60);
  assert.equal(SCENE_OPERATIONS.finite, true);
  assert.equal(SCENE_OPERATIONS.repeatable, false);
  assert.equal(SCENE_OPERATIONS.completionPolicy, 'once-per-save');
  assert.equal(validateSceneOperations().ok, true);
});

test('schema, lookup, metrics, and every nested record are immutable', () => {
  assert.equal(isDeepFrozen(SCENE_OPERATION_SCHEMA), true);
  assert.equal(isDeepFrozen(SCENE_OPERATION_ACTIVITY_TYPES), true);
  assert.equal(isDeepFrozen(SCENE_OPERATIONS), true);
  assert.equal(isDeepFrozen(SCENE_OPERATION_METRICS), true);
  assert.equal(getSceneOperationMetrics(), SCENE_OPERATION_METRICS);
  assert.equal(getSceneOperation('c7-04-lises-revised-oath')?.beatId, 'c7-04-lises-revised-oath');
  assert.equal(getSceneOperation('missing-beat'), null);

  assert.deepEqual({
    operationCount: SCENE_OPERATION_METRICS.operationCount,
    nodeCount: SCENE_OPERATION_METRICS.nodeCount,
    shortestPathStepCount: SCENE_OPERATION_METRICS.shortestPathStepCount,
    encounterBindingCount: SCENE_OPERATION_METRICS.encounterBindingCount,
    reservedFallbackCount: SCENE_OPERATION_METRICS.reservedFallbackCount,
  }, {
    operationCount: 60,
    nodeCount: 183,
    shortestPathStepCount: 920,
    encounterBindingCount: 23,
    reservedFallbackCount: 0,
  });
});

test('derived placement is deterministic across independent module evaluation', async () => {
  const fresh = await import(`../content/scene-operations.mjs?determinism=${Date.now()}`);
  assert.deepEqual(fresh.SCENE_OPERATIONS, SCENE_OPERATIONS);
  assert.deepEqual(fresh.SCENE_OPERATION_METRICS, SCENE_OPERATION_METRICS);
  assert.equal(isDeepFrozen(fresh.SCENE_OPERATIONS), true);
});

test('every route has 3-5 unique, genuinely reachable, unreserved open tiles', () => {
  let exactTotal = 0;
  for (const operation of SCENE_OPERATIONS.operations) {
    const level = getLevel(operation.levelId);
    const reserved = reservedTiles(level);
    const used = new Set();
    let previous = { x: level.spawn.x, y: level.spawn.y };
    let operationTotal = 0;

    assert.ok(operation.nodes.length >= 3 && operation.nodes.length <= 5, operation.beatId);
    assert.equal(operation.placement, 'reserved-free', operation.beatId);
    for (const node of operation.nodes) {
      const point = parseTileKey(node.at);
      assert.equal(isInBounds(level, point.x, point.y), true, `${node.id} must be in bounds`);
      assert.equal(isBlocked(level, point.x, point.y), false, `${node.id} must be open`);
      assert.equal(reserved.has(node.at), false, `${node.id} must avoid spawn, exits, interactables, hazards, triggers, and deployments`);
      assert.equal(used.has(node.at), false, `${operation.beatId} must not repeat a task tile`);
      used.add(node.at);
      const steps = shortestSteps(level, previous, point);
      assert.notEqual(steps, null, `${node.id} must be reachable without diagonal corner cutting`);
      assert.equal(node.pathFromPreviousSteps, steps, `${node.id} must expose the exact conservative shortest path`);
      operationTotal += steps;
      previous = point;
    }
    assert.equal(operation.shortestPathSteps, operationTotal, operation.beatId);
    exactTotal += operationTotal;
  }
  assert.equal(exactTotal, SCENE_OPERATION_METRICS.shortestPathStepCount);
});

test('encounter beats bind their exact registered encounter only at the final node', () => {
  let bindingCount = 0;
  for (const { beat } of canonicalBeats()) {
    const operation = getSceneOperation(beat.id);
    const expected = beat.encounterIds ?? [];
    const finalNode = operation.nodes.at(-1);
    for (const node of operation.nodes.slice(0, -1)) assert.deepEqual(node.encounterIds, [], node.id);
    assert.deepEqual(finalNode.encounterIds, expected, beat.id);
    bindingCount += finalNode.encounterIds.length;

    if (expected.length) {
      assert.equal(finalNode.encounterPolicy, 'bind-existing-once');
      assert.equal(finalNode.noNewBattle, true);
      assert.equal(new Set(expected).size, expected.length);
      for (const id of expected) assert.ok(getEncounter(id), `${beat.id} must bind a real encounter`);
      const hostile = expected.some((id) => getEncounter(id).format !== 'noncombat-resolution');
      assert.equal(finalNode.activityType, hostile ? 'combat-evidence' : 'care-rescue');
    } else {
      assert.equal(finalNode.encounterPolicy, null);
      assert.equal(finalNode.noNewBattle, null);
    }
  }
  assert.equal(bindingCount, 23);
});

test('instructions are bespoke, reference-safe, finite, and represent every requested activity', () => {
  const nodeIds = new Set();
  const instructions = new Set();
  const represented = new Set();
  const forbidden = /adam driver|castlevania|symphony of the night|final fantasy|dracula|metroidvania|\bgame loot\b|sacred (?:loot|treasure|weapon)|holy relic|ability gate|double jump|grappling hook|dash gate/i;

  for (const operation of SCENE_OPERATIONS.operations) {
    assert.equal(operation.repeatable, false);
    for (const node of operation.nodes) {
      assert.equal(node.once, true);
      assert.ok(node.verb.length >= 2);
      assert.ok(node.instruction.length >= 20);
      assert.equal(forbidden.test(`${node.verb} ${node.instruction}`), false, node.id);
      assert.equal(nodeIds.has(node.id), false, `duplicate node id ${node.id}`);
      assert.equal(instructions.has(node.instruction), false, `repeated instruction: ${node.instruction}`);
      nodeIds.add(node.id);
      instructions.add(node.instruction);
      represented.add(node.activityType);
    }
  }
  assert.deepEqual([...represented].sort(), Object.keys(SCENE_OPERATION_ACTIVITY_TYPES).sort());
  for (const count of Object.values(SCENE_OPERATION_METRICS.byActivityType)) assert.ok(count > 0);
  assert.equal(hasTimeDeclaration(SCENE_OPERATIONS), false, 'operations must expose actions and steps, never declared minutes');
});

test('validator rejects order drift, unreachable coordinates, duplicate nodes, and duplicate-battle policy drift', () => {
  const first = SCENE_OPERATIONS.operations[0];
  const second = SCENE_OPERATIONS.operations[1];
  const reordered = {
    ...SCENE_OPERATIONS,
    operations: [second, first, ...SCENE_OPERATIONS.operations.slice(2)],
  };
  assert.equal(validateSceneOperations(reordered).ok, false);
  assert.ok(validateSceneOperations(reordered).errors.some((error) => error.includes('must cover')));

  const badTileNode = { ...first.nodes[0], at: '-1,-1' };
  const badTileOperation = { ...first, nodes: [badTileNode, ...first.nodes.slice(1)] };
  const badTile = validateSceneOperations(replaceOperation(0, badTileOperation));
  assert.equal(badTile.ok, false);
  assert.ok(badTile.errors.some((error) => error.includes('open canonical tile')));

  const duplicateNodeOperation = { ...first, nodes: [first.nodes[0], { ...first.nodes[1], id: first.nodes[0].id }, first.nodes[2]] };
  const duplicate = validateSceneOperations(replaceOperation(0, duplicateNodeOperation));
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.some((error) => error.includes('duplicate node id')));

  const combatIndex = SCENE_OPERATIONS.operations.findIndex(({ beatId }) => beatId === 'p03-bailiff-returns');
  const combat = SCENE_OPERATIONS.operations[combatIndex];
  const unsafeFinal = { ...combat.nodes.at(-1), encounterPolicy: 'spawn-new', noNewBattle: false };
  const unsafeCombat = { ...combat, nodes: [...combat.nodes.slice(0, -1), unsafeFinal] };
  const duplicateBattle = validateSceneOperations(replaceOperation(combatIndex, unsafeCombat));
  assert.equal(duplicateBattle.ok, false);
  assert.ok(duplicateBattle.errors.some((error) => error.includes('duplicate encounter')));
});
