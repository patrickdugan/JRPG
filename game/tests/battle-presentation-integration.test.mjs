import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ENEMY_INTENT_BASE_DELAY_MS,
  canStartAutoGrindPresentation,
  createEnemyFamilyTimeline,
  createEnemyIntentSchedule,
  getBattlePresentationElapsedMs,
  getBattlePresentationActors,
  isBattlePresentationSettled,
  getNextBattleActionAt,
  rescaleEnemyIntentSchedule,
} from '../battle-animation.mjs';

test('Auto-Grind start is rejected during an animation and every terminal hold', () => {
  assert.equal(canStartAutoGrindPresentation({ unlocked: true }), true);
  assert.equal(canStartAutoGrindPresentation({ unlocked: false }), false);
  assert.equal(canStartAutoGrindPresentation({ unlocked: true, animationActive: true }), false);
  assert.equal(canStartAutoGrindPresentation({ unlocked: true, result: 'victory' }), false);
  assert.equal(canStartAutoGrindPresentation({ unlocked: true, result: 'defeat' }), false);
  assert.equal(canStartAutoGrindPresentation({ unlocked: true, settling: true }), false);
});

test('manual enemy intent always owns a complete readable delay after an animation', () => {
  const animationEndsAt = 10_000;
  const schedule = createEnemyIntentSchedule(animationEndsAt, 1);
  assert.deepEqual(schedule, {
    startedAt: animationEndsAt,
    dueAt: animationEndsAt + ENEMY_INTENT_BASE_DELAY_MS,
    durationMs: ENEMY_INTENT_BASE_DELAY_MS,
    presentationSpeed: 1,
  });
  assert.equal(Object.isFrozen(schedule), true);

  const nextEnemy = createEnemyIntentSchedule(schedule.dueAt + 1_200, 2);
  assert.equal(nextEnemy.dueAt, schedule.dueAt + 1_200 + (ENEMY_INTENT_BASE_DELAY_MS / 2));
  assert.ok(nextEnemy.startedAt > schedule.dueAt, 'consecutive enemies receive a new window after the prior animation');

  assert.equal(getNextBattleActionAt({
    nowMs: 9_000,
    stepDelayMs: 400,
    animationEndsAt,
    nextIsEnemy: true,
    speed: 2,
  }), animationEndsAt + (ENEMY_INTENT_BASE_DELAY_MS / 2), 'Auto-Grind also waits after the animation');
  assert.equal(getNextBattleActionAt({
    nowMs: 9_000,
    stepDelayMs: 1_500,
    animationEndsAt,
    nextIsEnemy: false,
    speed: 2,
  }), 10_500, 'a later authored step delay remains authoritative');
});

test('speed changes preserve elapsed intent progress instead of restarting the wait', () => {
  const original = createEnemyIntentSchedule(1_000, 1);
  const halfway = 1_000 + (ENEMY_INTENT_BASE_DELAY_MS / 2);
  const faster = rescaleEnemyIntentSchedule(original, halfway, 4);
  assert.equal(faster.presentationSpeed, 4);
  assert.equal(faster.durationMs, ENEMY_INTENT_BASE_DELAY_MS / 4);
  assert.equal(faster.dueAt - halfway, ENEMY_INTENT_BASE_DELAY_MS / 8);
  assert.equal((halfway - faster.startedAt) / faster.durationMs, 0.5);

  const completed = rescaleEnemyIntentSchedule(original, original.dueAt + 25, 2);
  assert.equal(completed.dueAt, original.dueAt + 25, 'an already-earned activation remains immediately due');
  assert.equal(rescaleEnemyIntentSchedule(null, 10, 4), null);
});

test('pre-action target remains a presentation ghost through a lethal terminal timeline', () => {
  const currentAttacker = { instanceId: 'ren', hp: 40, active: true, pos: { x: 1, y: 1 } };
  const deadTarget = { instanceId: 'boss-1', hp: 0, active: true, pos: { x: 4, y: 1 } };
  const unrelatedDead = { instanceId: 'minion-1', hp: 0, active: true, pos: { x: 5, y: 1 } };
  const retainedAttacker = { ...currentAttacker, hp: 50 };
  const retainedTarget = { ...deadTarget, hp: 12 };
  const current = [currentAttacker, deadTarget, unrelatedDead];
  const retained = [retainedAttacker, retainedTarget];

  const presented = getBattlePresentationActors(current, retained);
  assert.equal(Object.isFrozen(presented), true);
  assert.deepEqual(presented.map(({ instanceId }) => instanceId), ['ren', 'boss-1']);
  assert.equal(presented[0], currentAttacker, 'living simulation actor stays authoritative');
  assert.equal(presented[1], retainedTarget, 'lethal target uses its frozen pre-action visual record');
  assert.equal(Object.isFrozen(current), false, 'helper does not freeze or mutate caller state');
});

test('target status glyph requires actual application and self-status is anchored to source', () => {
  const skill = {
    id: 'forge-sermon',
    delivery: 'arcane',
    essence: 'ember',
    effect: { status: 'scorch', selfStatus: 'overheated' },
  };
  const lethal = createEnemyFamilyTimeline('furnace-abbot', {
    source: { x: 8, y: 3 },
    target: { x: 2, y: 3 },
    skill,
    statusId: 'scorch',
    statusApplied: false,
    selfStatusId: 'overheated',
    selfStatusApplied: true,
  });
  assert.equal(lethal.action.statusId, null);
  assert.equal(lethal.action.selfStatusId, 'overheated');
  assert.equal(lethal.frames.some((frame) => frame.statusGlyph), false);
  const selfGlyphs = lethal.frames.filter((frame) => frame.selfStatusGlyph);
  assert.equal(selfGlyphs.length, 5);
  assert.ok(selfGlyphs.every(({ selfStatusGlyph }) => selfStatusGlyph.placement === 'source'));
  assert.ok(selfGlyphs.every(({ selfStatusGlyph }) => selfStatusGlyph.tile.x === 8));

  const applied = createEnemyFamilyTimeline('furnace-abbot', {
    source: { x: 8, y: 3 }, target: { x: 2, y: 3 }, skill,
    statusId: 'scorch', statusApplied: true,
    selfStatusId: 'overheated', selfStatusApplied: true,
  });
  assert.equal(applied.frames.filter((frame) => frame.statusGlyph).length, 5);
  assert.equal(applied.frames.filter((frame) => frame.selfStatusGlyph).length, 5);
});

test('manual terminal playtime settles only after the final animation', () => {
  assert.equal(isBattlePresentationSettled({ result: null }), false);
  assert.equal(isBattlePresentationSettled({ result: 'victory', animationActive: true }), false);
  assert.equal(isBattlePresentationSettled({ result: 'defeat', animationActive: true }), false);
  assert.equal(isBattlePresentationSettled({ result: 'victory', settling: true }), false);
  assert.equal(isBattlePresentationSettled({ result: 'victory' }), true);
  assert.equal(isBattlePresentationSettled({ result: 'defeat' }), true);

  assert.equal(getBattlePresentationElapsedMs({
    elapsedMs: 16,
    intervalEndMs: 1_006,
    result: 'victory',
    animationEndsAt: 1_000,
  }), 10, 'the final sampled interval counts only its active-animation portion');
  assert.equal(getBattlePresentationElapsedMs({
    elapsedMs: 16,
    intervalEndMs: 1_006.75,
    result: 'victory',
    animationEndsAt: 1_000.25,
  }), 9, 'playtime evidence remains an exact integer even with fractional RAF timestamps');
  assert.equal(getBattlePresentationElapsedMs({
    elapsedMs: 16,
    intervalEndMs: 990,
    result: 'victory',
    animationEndsAt: 1_000,
  }), 16);
  assert.equal(getBattlePresentationElapsedMs({
    elapsedMs: 16,
    intervalEndMs: 1_006,
    result: 'victory',
    settling: true,
    animationEndsAt: 1_000,
  }), 16, 'Auto-Grind settlement presentation remains countable');
  assert.equal(getBattlePresentationElapsedMs({ elapsedMs: 16, intervalEndMs: 1_006, result: 'victory' }), 0);
});

test('browser controller wires locks, ghosts, fresh intent scheduling, and complete restart cleanup', async () => {
  const source = await readFile(new URL('../battle.js', import.meta.url), 'utf8');
  assert.match(source, /canStartAutoGrindPresentation\(\{/);
  assert.ok(source.indexOf('if (animationActive)') < source.indexOf('activeBattleAnimation = null;', source.indexOf('function toggleAutoGrind')));
  assert.match(source, /retainedActors: Object\.freeze\(\[attacker, target\]\)/);
  assert.match(source, /getBattlePresentationActors\(snapshot\.actors, animation\?\.retainedActors \?\? \[\]\)/);
  assert.match(source, /activeBattleAnimation = null;\s+clearEnemyIntentSchedule\(\);\s+render\(\);/);
  assert.match(source, /scheduleEnemyIntent\(\);/);
  assert.match(source, /rescaleEnemyIntentSchedule\(enemyIntentSchedule, performance\.now\(\), nextSpeed\)/);
  assert.match(source, /isBattlePresentationSettled\(\{/);
  assert.match(source, /getBattlePresentationElapsedMs\(\{/);
  assert.match(source, /let battlePlaytimeCategory = getBattlePlaytimeCategory/);
  assert.match(source, /const category = battlePlaytimeCategory;/);
  assert.match(source, /for \(const glyph of \[frame\.statusGlyph, frame\.selfStatusGlyph\]\.filter\(Boolean\)\)/);

  const restart = source.slice(source.indexOf("restartBattle.addEventListener('click'"), source.indexOf("window.addEventListener('keydown'"));
  for (const requiredReset of [
    'stopAutoGrind();',
    'autoSettleAt = null;',
    'clearEnemyIntentSchedule();',
    'battleFacingByActor.clear();',
    'battleMotionUntil.clear();',
    'battleEnemyPoseByActor.clear();',
    'battleEnemyPoseUntil.clear();',
    'activeBattleAnimation = null;',
  ]) assert.match(restart, new RegExp(requiredReset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  assert.match(source, /if \(snapshot\.result !== 'victory' \|\| rewardRecorded\) return;/, 'reward remains exactly-once guarded');
});
