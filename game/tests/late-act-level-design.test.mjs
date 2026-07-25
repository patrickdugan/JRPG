import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAct5SequencePlan } from '../content/act-route-sequences.mjs';
import {
  ACT4_APPROACH_LEVEL_PLANS,
  ACT4_BLACK_GATE_PLAN,
  LATE_ACT_ACTION_ARENAS,
  ACT5_LEVEL_VISITS,
  LATE_ACT_LEVEL_DESIGN_SCHEMA_VERSION,
  LATE_ACT_TOPOLOGY_EDGES,
  getLateActActionArena,
  getLateActTopologyFrom,
  validateLateActLevelDesign,
} from '../content/late-act-level-design.mjs';
import { getActionStage } from '../action-stages.mjs';
import {
  getLevel,
  isBlocked,
  parseTileKey,
} from '../content/levels.mjs';

const DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function reachable(level, from, to) {
  const startKey = `${from.x},${from.y}`;
  const targetKey = `${to.x},${to.y}`;
  const queue = [startKey];
  const visited = new Set(queue);
  while (queue.length) {
    const key = queue.shift();
    if (key === targetKey) return true;
    const point = parseTileKey(key);
    for (const [dx, dy] of DIRECTIONS) {
      const next = { x: point.x + dx, y: point.y + dy };
      const nextKey = `${next.x},${next.y}`;
      if (visited.has(nextKey) || isBlocked(level, next.x, next.y)) continue;
      visited.add(nextKey);
      queue.push(nextKey);
    }
  }
  return false;
}

function resolveStepPoint(plan, pathStep) {
  const level = getLevel(pathStep.levelId ?? plan.levelId);
  if (pathStep.kind === 'interactable') {
    return {
      level,
      point: parseTileKey(level.interactables.find(({ id }) => id === pathStep.refId).at),
    };
  }
  if (pathStep.kind === 'exit') {
    return {
      level,
      point: parseTileKey(level.exits.find(({ id }) => id === pathStep.refId).at),
    };
  }
  return { level, point: null };
}

test('late-act plans resolve every authored level, interaction, encounter, hazard, exit, and Storyworld decision', () => {
  assert.equal(LATE_ACT_LEVEL_DESIGN_SCHEMA_VERSION, 1);
  assert.deepEqual(validateLateActLevelDesign(), []);
  assert.deepEqual(Object.keys(ACT4_APPROACH_LEVEL_PLANS).sort(), ['ash', 'paper', 'salt']);
  assert.equal(ACT5_LEVEL_VISITS.length, 6);
  assert.equal(new Set(ACT5_LEVEL_VISITS.map(({ id }) => id)).size, 6);
  assert.equal(Object.isFrozen(ACT5_LEVEL_VISITS), true);
  assert.equal(Object.isFrozen(ACT5_LEVEL_VISITS[0].criticalPath), true);
});

test('all three Act IV approaches converge at the Black Gate without erasing route identity', () => {
  for (const [theater, plan] of Object.entries(ACT4_APPROACH_LEVEL_PLANS)) {
    assert.equal(plan.theater, theater);
    const edge = getLateActTopologyFrom(plan.levelId).find(({ route }) => route === theater);
    assert.ok(edge);
    assert.equal(edge.to, ACT4_BLACK_GATE_PLAN.levelId);
    assert.match(plan.spatialThesis, /\S/u);
    assert.match(plan.consequenceRead, /\S/u);
  }
});

test('Act V owns five major sequences and six level visits including the evacuation return pass', () => {
  const act5 = buildAct5SequencePlan();
  assert.equal(act5.actId, 'act-v');
  assert.deepEqual(act5.sequences.map(({ ordinal }) => ordinal), [1, 2, 3, 4, 5]);
  assert.deepEqual(act5.sequences.map(({ id }) => id), [
    'act5-sequence-01',
    'act5-sequence-02',
    'act5-sequence-03',
    'act5-sequence-04',
    'act5-sequence-05',
  ]);
  assert.equal(ACT5_LEVEL_VISITS.at(-1).levelId, 'krh-outer-archive');
  assert.equal(ACT5_LEVEL_VISITS.at(-1).criticalPath.at(-1).refId, 'dawn-archive-exit');
});

test('five encounter-specific action arenas reuse three validated stages without traversal gates', () => {
  assert.equal(LATE_ACT_ACTION_ARENAS.length, 5);
  assert.deepEqual(
    [...new Set(LATE_ACT_ACTION_ARENAS.map(({ levelId }) => levelId))].sort(),
    ['c8-black-gate', 'krh-observatory', 'krh-outer-archive'],
  );
  for (const arena of LATE_ACT_ACTION_ARENAS) {
    const stage = getActionStage(arena.levelId);
    const anchorIds = new Set(stage.objectiveAnchors.map(({ id }) => id));
    assert.equal(arena.requiredAnchorIds.every((id) => anchorIds.has(id)), true);
    assert.ok(arena.movementLanes.length >= 3);
    assert.ok(arena.phaseFlow.length >= 3);
    assert.doesNotMatch(`${arena.opening} ${arena.cooldownRule} ${arena.tagRule}`, /ability gate|mandatory backtrack/iu);
    assert.equal(getLateActActionArena(arena.id), arena);
  }
  assert.equal(getLateActActionArena('missing-arena'), null);
});

test('the corrected castle topology ascends through every room and returns only for evacuation', () => {
  assert.deepEqual(
    LATE_ACT_TOPOLOGY_EDGES.map(({ from, to }) => `${from}->${to}`),
    [
      'c8-sodegaura-return->c8-black-gate',
      'c8-takamine-return->c8-black-gate',
      'c8-hoshigawa-return->c8-black-gate',
      'c8-black-gate->krh-outer-archive',
      'krh-outer-archive->krh-audience-hall',
      'krh-audience-hall->krh-blood-conservatory',
      'krh-blood-conservatory->krh-bell-spine',
      'krh-bell-spine->krh-observatory',
      'krh-observatory->krh-outer-archive',
      'krh-outer-archive->epi-hoshigawa-archive',
    ],
  );
  const outerArchiveExits = getLevel('krh-outer-archive').exits;
  assert.deepEqual(
    outerArchiveExits.map(({ id, destinationLevelId }) => [id, destinationLevelId]),
    [
      ['audience-hall-door', 'krh-audience-hall'],
      ['dawn-archive-exit', 'epi-hoshigawa-archive'],
    ],
  );
});

test('every ordered late-act map interaction is reachable on a non-hazard four-direction route', () => {
  const plans = [
    ...Object.values(ACT4_APPROACH_LEVEL_PLANS),
    ACT4_BLACK_GATE_PLAN,
    ...ACT5_LEVEL_VISITS,
  ];
  for (const plan of plans) {
    let currentLevel = getLevel(plan.levelId);
    let cursor = { x: currentLevel.spawn.x, y: currentLevel.spawn.y };
    for (const pathStep of plan.criticalPath) {
      const resolved = resolveStepPoint(plan, pathStep);
      if (!resolved.point) continue;
      if (resolved.level.id !== currentLevel.id) {
        currentLevel = resolved.level;
        cursor = { x: currentLevel.spawn.x, y: currentLevel.spawn.y };
      }
      assert.equal(
        reachable(currentLevel, cursor, resolved.point),
        true,
        `${plan.id ?? plan.title}:${pathStep.id} must be reachable on ${currentLevel.id}`,
      );
      cursor = resolved.point;
    }
  }
});
