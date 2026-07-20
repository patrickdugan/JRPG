import test from 'node:test';
import assert from 'node:assert/strict';

import { ENCOUNTERS } from '../content/encounters.mjs';
import {
  ENEMY_ATLAS,
  ENEMY_FAMILIES,
  enemyAtlasImageHasExpectedSize,
  getEnemyAtlasFrame,
  getEnemyFamily,
  hasAuthoredEnemyFamily,
} from '../enemy-atlas.mjs';

test('enemy atlas exposes exhaustive integer 8 by 4 authored source frames', () => {
  assert.equal(ENEMY_ATLAS.rows, 8);
  assert.equal(ENEMY_ATLAS.columns, 4);
  assert.equal(ENEMY_ATLAS.width, ENEMY_ATLAS.cellWidth * ENEMY_ATLAS.columns);
  assert.deepEqual(ENEMY_FAMILIES.map(({ row }) => row), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(ENEMY_ATLAS.rowCells.length, ENEMY_ATLAS.rows);
  assert.deepEqual(ENEMY_ATLAS.rowCells.map(({ y }) => y), [0, 80, 160, 240, 320, 400, 480, 560]);

  const rectangles = new Set();
  for (const family of ENEMY_FAMILIES) {
    for (const pose of ENEMY_ATLAS.poses) {
      const frame = getEnemyAtlasFrame(family.templateIds[0], pose);
      for (const field of [
        'row', 'column', 'cellX', 'cellY', 'cellWidth', 'cellHeight',
        'sourceInset', 'x', 'y', 'width', 'height',
      ]) assert.equal(Number.isSafeInteger(frame[field]), true, `${family.id}:${pose}:${field}`);

      assert.ok(frame.cellX >= 0 && frame.cellX + frame.cellWidth <= ENEMY_ATLAS.width);
      assert.ok(frame.cellY >= 0 && frame.cellY + frame.cellHeight <= ENEMY_ATLAS.height);
      assert.equal(frame.x, frame.cellX);
      assert.equal(frame.y, frame.cellY);
      assert.equal(frame.width, ENEMY_ATLAS.sourceWidth);
      assert.equal(frame.height, ENEMY_ATLAS.sourceHeight);
      assert.equal(frame.familyId, family.id);
      assert.equal(frame.pose, pose);
      assert.equal(frame.row, family.row);
      assert.equal(frame.column, ENEMY_ATLAS.poses.indexOf(pose));
      assert.equal(Object.isFrozen(frame), true);

      const key = `${frame.x},${frame.y},${frame.width},${frame.height}`;
      assert.equal(rectangles.has(key), false, key);
      rectangles.add(key);
    }
  }
  assert.equal(rectangles.size, 32);
});

test('enemy atlas image validation rejects decodable wrong-size rasters', () => {
  assert.equal(enemyAtlasImageHasExpectedSize({ naturalWidth: 256, naturalHeight: 640 }), true);
  assert.equal(enemyAtlasImageHasExpectedSize({ naturalWidth: 255, naturalHeight: 640 }), false);
  assert.equal(enemyAtlasImageHasExpectedSize({ naturalWidth: 256, naturalHeight: 639 }), false);
  assert.equal(enemyAtlasImageHasExpectedSize(null), false);
});

test('every enemy family template keeps a stable identity and pose mapping at one source scale', () => {
  const widths = new Set();
  const heights = new Set();
  for (const family of ENEMY_FAMILIES) {
    for (const templateId of family.templateIds) {
      for (const [column, pose] of ENEMY_ATLAS.poses.entries()) {
        const frame = getEnemyAtlasFrame(templateId, pose);
        assert.equal(frame.familyId, family.id);
        assert.equal(frame.row, family.row);
        assert.equal(frame.pose, pose);
        assert.equal(frame.column, column);
        assert.deepEqual(frame, getEnemyAtlasFrame(templateId, pose));
        widths.add(frame.width);
        heights.add(frame.height);
      }
    }
  }
  assert.deepEqual([...widths], [64]);
  assert.deepEqual([...heights], [80]);
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
