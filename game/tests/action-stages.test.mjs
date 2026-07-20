import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ENCOUNTERS } from '../content/encounters.mjs';
import {
  ACTION_STAGE_IDS,
  ACTION_STAGES,
  createActionStagePhysicsHooks,
  getActionStage,
  getActionStageAnchor,
  toActionKernelStage,
  validateActionStage,
} from '../action-stages.mjs';

test('every unique authored encounter level has one explicit side-view stage', () => {
  const authoredLevelIds = [...new Set(ENCOUNTERS.map(({ levelId }) => levelId))].sort();
  assert.deepEqual([...ACTION_STAGE_IDS].sort(), authoredLevelIds);
  assert.equal(new Set(ACTION_STAGE_IDS).size, ACTION_STAGES.length);
  assert.equal(ACTION_STAGES.length, 20);
});

test('all action stages validate, are deeply frozen, and expose grounded spawn slots', () => {
  for (const stage of ACTION_STAGES) {
    assert.deepEqual(validateActionStage(stage), [], stage.id);
    assert.equal(Object.isFrozen(stage), true, stage.id);
    assert.equal(Object.isFrozen(stage.bounds), true, stage.id);
    assert.equal(Object.isFrozen(stage.spawns.party), true, stage.id);
    assert.ok(stage.spawns.party.length >= 1, stage.id);
    assert.ok(stage.spawns.enemy.length >= 1, stage.id);
    for (const spawn of [...stage.spawns.party, ...stage.spawns.enemy]) {
      const onPlatform = stage.platforms.some(({ left, right, y }) => (
        spawn.y === y && spawn.x >= left && spawn.x <= right
      ));
      assert.equal(spawn.y === stage.groundY || onPlatform, true, `${stage.id}:${spawn.id}`);
    }
  }
});

test('authored spawn capacity covers every current encounter deterministically', () => {
  for (const encounter of ENCOUNTERS) {
    const stage = getActionStage(encounter.levelId);
    const partyCount = encounter.party?.roster?.length ?? 0;
    const enemyCount = encounter.enemies.reduce((total, enemy) => (
      total + (enemy.count ?? enemy.positions?.length ?? 0)
    ), 0);
    assert.ok(stage.spawns.party.length >= partyCount, `${encounter.id} party spawn capacity`);
    assert.ok(stage.spawns.enemy.length >= enemyCount, `${encounter.id} enemy spawn capacity`);
  }
});

test('side-view stages do not import or infer top-down blocked tile geometry', () => {
  const source = readFileSync(new URL('../action-stages.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"]\.\/content\/levels\.mjs/u);
  assert.doesNotMatch(source, /\.blocked\b|isBlocked\(|parseTileKey\(/u);
  assert.match(source, /blocked tiles[\s\S]*never interpreted as platforms/u);
  for (const stage of ACTION_STAGES) {
    assert.equal(stage.coordinateSystem, 'side-view-world-pixels');
    for (const platform of stage.platforms) {
      assert.equal(platform.oneWay, true);
      assert.equal(Object.hasOwn(platform, 'tiles'), false);
    }
  }
});

test('kernel projection preserves exact authored bounds and ground', () => {
  const stage = getActionStage('tkm-bell-chamber');
  assert.deepEqual(toActionKernelStage(stage), {
    minX: stage.bounds.minX,
    maxX: stage.bounds.maxX,
    minY: stage.bounds.minY,
    maxY: stage.bounds.maxY,
    groundY: stage.groundY,
  });
  assert.equal(Object.isFrozen(toActionKernelStage(stage)), true);
});

test('platform hook lands only on downward authored crossings', () => {
  const stage = getActionStage('tkm-bell-chamber');
  const platform = stage.platforms[0];
  const hook = createActionStagePhysicsHooks(stage.id).resolveGround;
  const actor = { velocity: { y: 180 } };

  assert.deepEqual(hook({
    actor,
    previousPosition: { x: 170, y: platform.y - 8 },
    proposedPosition: { x: 170, y: platform.y + 4 },
  }), { grounded: true, groundY: platform.y });
  assert.deepEqual(hook({
    actor: { velocity: { y: -180 } },
    previousPosition: { x: 170, y: platform.y + 4 },
    proposedPosition: { x: 170, y: platform.y - 8 },
  }), { grounded: false, groundY: stage.groundY });
  assert.deepEqual(hook({
    actor,
    previousPosition: { x: 500, y: platform.y - 8 },
    proposedPosition: { x: 500, y: platform.y + 4 },
  }), { grounded: false, groundY: stage.groundY });
  assert.deepEqual(hook({
    actor,
    previousPosition: { x: 500, y: stage.groundY - 8 },
    proposedPosition: { x: 500, y: stage.groundY + 4 },
  }), { grounded: true, groundY: stage.groundY });
});

test('unknown stages and anchors fail clearly without a fallback', () => {
  assert.throws(() => getActionStage('missing-stage'), /Unsupported action stage levelId: missing-stage/u);
  assert.throws(
    () => getActionStageAnchor('hsh-census-square', 'missing-anchor'),
    /has no objective anchor: missing-anchor/u,
  );
  assert.throws(() => toActionKernelStage({ id: 'broken' }), /Invalid action stage contract/u);
});
