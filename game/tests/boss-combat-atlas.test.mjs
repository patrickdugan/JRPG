import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ENCOUNTERS, isBossEncounter } from '../content/encounters.mjs';
import {
  BOSS_COMBAT_ATLAS,
  BOSS_COMBAT_ANCHOR_PROFILES,
  BOSS_COMBAT_BOSSES,
  BOSS_COMBAT_POSES,
  BOSS_DEFEAT_HOLD_MS,
  bossCombatImageHasExpectedSize,
  getBossCombatDrawPlacement,
  getBossCombatFrame,
  getBossCombatPresentationPose,
  hasBossCombatTemplate,
} from '../boss-combat-atlas.mjs';

test('boss combat atlas maps every canonical primary boss to all six exact key poses', () => {
  const canonicalBosses = ENCOUNTERS.filter(isBossEncounter).map(({ enemies }) => enemies[0].id);
  assert.deepEqual(BOSS_COMBAT_BOSSES.map(({ id }) => id), canonicalBosses);
  const rectangles = new Set();
  for (const [row, boss] of BOSS_COMBAT_BOSSES.entries()) {
    assert.equal(boss.row, row);
    assert.equal(hasBossCombatTemplate(boss.id), true);
    for (const [column, pose] of BOSS_COMBAT_POSES.entries()) {
      const frame = getBossCombatFrame(boss.id, pose);
      assert.equal(frame.row, row);
      assert.equal(frame.column, column);
      assert.equal(frame.x, column * 112);
      assert.equal(frame.y, row * 128);
      assert.deepEqual([frame.width, frame.height], [112, 128]);
      assert.equal(Object.isFrozen(frame), true);
      rectangles.add(`${frame.x},${frame.y},${frame.width},${frame.height}`);
    }
  }
  assert.equal(rectangles.size, 60);
  assert.equal(BOSS_COMBAT_ATLAS.width, BOSS_COMBAT_ATLAS.columns * BOSS_COMBAT_ATLAS.cellWidth);
  assert.equal(BOSS_COMBAT_ATLAS.height, BOSS_COMBAT_ATLAS.rows * BOSS_COMBAT_ATLAS.cellHeight);
  assert.equal(hasBossCombatTemplate('court-clone'), false);
  assert.throws(() => getBossCombatFrame('court-clone'), /Unknown boss combat template/);
});

test('boss presentation states reserve transitions until an explicit live signal exists', () => {
  assert.equal(getBossCombatPresentationPose({ hp: 0, actorPose: 'attack' }), 'defeat');
  assert.equal(getBossCombatPresentationPose({ active: false, hp: 10 }), 'defeat');
  assert.equal(getBossCombatPresentationPose({ targetPose: 'stagger', phase: 'windup' }), 'break');
  assert.equal(getBossCombatPresentationPose({ phase: 'windup' }), 'telegraph');
  assert.equal(getBossCombatPresentationPose({ phase: 'status-glyph', actorPose: 'attack' }), 'active');
  assert.equal(getBossCombatPresentationPose({ phase: 'status-glyph' }), 'neutral');
  assert.equal(getBossCombatPresentationPose({ actorPose: 'attack' }), 'active');
  assert.equal(getBossCombatPresentationPose({}), 'neutral');
  assert.ok(BOSS_COMBAT_POSES.includes('transition'), 'the authored frame stays reserved in the atlas contract');
  assert.ok(BOSS_DEFEAT_HOLD_MS > 0 && BOSS_DEFEAT_HOLD_MS <= 500, 'terminal presentation is deliberately bounded');
});

test('runtime frame anchors match the authored source contract and keep every pose grounded', () => {
  const source = JSON.parse(readFileSync(
    new URL('../../assets/art/boss-combat-suite/boss-combat-suite.source.json', import.meta.url),
    'utf8',
  ));
  assert.deepEqual(Object.keys(BOSS_COMBAT_ANCHOR_PROFILES), Object.keys(source.anchorProfiles));

  for (const boss of BOSS_COMBAT_BOSSES) {
    const authoredBoss = source.bosses.find(({ id }) => id === boss.id);
    assert.equal(boss.anchorProfile, authoredBoss.anchorProfile);
    for (const pose of BOSS_COMBAT_POSES) {
      const frame = getBossCombatFrame(boss.id, pose);
      const authored = source.anchorProfiles[boss.anchorProfile][pose];
      assert.deepEqual([frame.pivot.x, frame.pivot.y], authored.pivot);
      assert.deepEqual([frame.ground.x, frame.ground.y], authored.ground);

      const placement = getBossCombatDrawPlacement(frame, {
        anchorX: 0,
        groundY: 100,
        drawHeight: 64 * frame.scale,
      });
      assert.ok(Math.abs((placement.x + (frame.ground.x * placement.pixelScale)) - placement.groundX) < 1e-9);
      assert.ok(Math.abs((placement.y + (frame.ground.y * placement.pixelScale)) - placement.groundY) < 1e-9);
      assert.ok(Math.abs((placement.x + (frame.pivot.x * placement.pixelScale)) - placement.pivotX) < 1e-9);
      assert.ok(Math.abs((placement.y + (frame.pivot.y * placement.pixelScale)) - placement.pivotY) < 1e-9);
      assert.equal(Object.isFrozen(placement), true);
    }
  }

  assert.throws(() => getBossCombatDrawPlacement(null), /boss frame/);
});

test('boss atlas image validation rejects decodable wrong-size rasters', () => {
  assert.equal(bossCombatImageHasExpectedSize({ naturalWidth: 672, naturalHeight: 1280 }), true);
  assert.equal(bossCombatImageHasExpectedSize({ naturalWidth: 671, naturalHeight: 1280 }), false);
  assert.equal(bossCombatImageHasExpectedSize({ naturalWidth: 672, naturalHeight: 1279 }), false);
  assert.equal(bossCombatImageHasExpectedSize(null), false);
});
