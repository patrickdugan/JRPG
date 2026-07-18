import test from 'node:test';
import assert from 'node:assert/strict';

import { ENCOUNTERS } from '../content/encounters.mjs';
import {
  ENEMY_ATLAS,
  ENEMY_FAMILIES,
  getEnemyAtlasFrame,
  getEnemyFamily,
  hasAuthoredEnemyFamily,
} from '../enemy-atlas.mjs';

test('enemy atlas exposes exact non-overlapping 8 by 4 cells', () => {
  assert.equal(ENEMY_ATLAS.rows, 8);
  assert.equal(ENEMY_ATLAS.columns, 4);
  assert.equal(ENEMY_ATLAS.width, ENEMY_ATLAS.cellWidth * ENEMY_ATLAS.columns);
  assert.equal(ENEMY_ATLAS.height, ENEMY_ATLAS.cellHeight * ENEMY_ATLAS.rows);
  assert.deepEqual(ENEMY_FAMILIES.map(({ row }) => row), [0, 1, 2, 3, 4, 5, 6, 7]);

  const rectangles = new Set();
  for (const family of ENEMY_FAMILIES) {
    for (const pose of ENEMY_ATLAS.poses) {
      const frame = getEnemyAtlasFrame(family.templateIds[0], pose);
      const key = `${frame.x},${frame.y},${frame.width},${frame.height}`;
      assert.equal(rectangles.has(key), false, key);
      rectangles.add(key);
    }
  }
  assert.equal(rectangles.size, 32);
});

test('every canonical enemy template has an authored family mapping', () => {
  const enemyTemplateIds = [...new Set(ENCOUNTERS.flatMap((encounter) => (
    (encounter.enemies ?? []).map((enemy) => enemy.id)
  )))];
  assert.ok(enemyTemplateIds.length > 20);
  for (const templateId of enemyTemplateIds) {
    assert.equal(hasAuthoredEnemyFamily(templateId), true, templateId);
    assert.equal(getEnemyFamily(templateId), getEnemyFamily(templateId));
  }
});

test('unknown templates and poses fail soft to the Oni neutral frame', () => {
  assert.equal(getEnemyFamily('unknown-template').id, 'ashen-oni');
  assert.deepEqual(
    getEnemyAtlasFrame('unknown-template', 'not-a-pose'),
    getEnemyAtlasFrame('ashen-bailiff', 'neutral'),
  );
});
