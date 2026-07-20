import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  BATTLE_SYSTEM_FEEDBACK_MS,
  createBattleMoveFeedback,
  createSelectedTargetFeedback,
  sampleBattleMoveFeedback,
} from '../battle-system-feedback.mjs';

test('successful movement marks the exact engine destination without changing simulation data', () => {
  const result = { ok: true, position: { x: 3, y: 2 }, pace: 1 };
  const record = createBattleMoveFeedback({
    result, actorId: 'ren', actorName: 'Ren', sourceTile: { x: 2, y: 2 },
    dx: 1, dy: 0, board: { width: 8, height: 6 }, startedAt: 1_000,
  });
  assert.equal(record.kind, 'move-destination');
  assert.deepEqual(record.sourceTile, { x: 2, y: 2 });
  assert.deepEqual(record.attemptedTile, result.position);
  assert.deepEqual(record.displayTile, result.position);
  assert.equal(record.durationMs, BATTLE_SYSTEM_FEEDBACK_MS['move-destination']);
  assert.equal(record.endsAt, 1_320);
  assert.equal(record.announcement, 'Ren moves to 3,2.');
  assert.equal(Object.hasOwn(record, 'pace'), false);
  assert.deepEqual(result, { ok: true, position: { x: 3, y: 2 }, pace: 1 });
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(result), false);
});

test('blocked and out-of-bounds movement gets an exact visible rejection and accessible reason', () => {
  const blocked = createBattleMoveFeedback({
    result: { ok: false, reason: 'Destination is blocked.' },
    actorId: 'aya', actorName: 'Aya', sourceTile: { x: 2, y: 2 },
    dx: 1, dy: 0, board: { width: 6, height: 5 }, startedAt: 2_000, speed: 2,
  });
  assert.equal(blocked.kind, 'move-blocked');
  assert.deepEqual(blocked.attemptedTile, { x: 3, y: 2 });
  assert.deepEqual(blocked.displayTile, { x: 3, y: 2 });
  assert.equal(blocked.outOfBounds, false);
  assert.equal(blocked.durationMs, 240);
  assert.equal(blocked.announcement, 'Aya cannot move to 3,2. Destination is blocked.');

  const outside = createBattleMoveFeedback({
    result: { ok: false, reason: 'Destination is blocked.' },
    actorId: 'aya', sourceTile: { x: 0, y: 0 }, dx: -1, dy: -1,
    board: { width: 6, height: 5 },
  });
  assert.deepEqual(outside.attemptedTile, { x: -1, y: -1 });
  assert.deepEqual(outside.displayTile, { x: 0, y: 0 });
  assert.equal(outside.outOfBounds, true);
  assert.match(outside.announcement, /-1,-1/);
});

test('bounded movement sampling expires exactly and reduced motion holds one static frame', () => {
  const record = createBattleMoveFeedback({
    result: { ok: true, position: { x: 2, y: 1 } },
    sourceTile: { x: 1, y: 1 }, dx: 1, dy: 0,
    board: { width: 5, height: 4 }, startedAt: 500,
  });
  assert.equal(sampleBattleMoveFeedback(record, 499), null);
  assert.equal(sampleBattleMoveFeedback(record, record.endsAt), null);
  const middle = sampleBattleMoveFeedback(record, 660);
  assert.equal(middle.progress, 0.5);
  assert.equal(middle.routeProgress, 1);
  const reducedEarly = sampleBattleMoveFeedback(record, 501, { reducedMotion: true });
  const reducedLate = sampleBattleMoveFeedback(record, 819, { reducedMotion: true });
  assert.deepEqual(reducedLate, reducedEarly);
});

test('selected target feedback is a persistent exact-cell signal with a static reduced-motion state', () => {
  const first = createSelectedTargetFeedback({
    targetId: 'oni-1', targetName: 'Ashen Oni', targetTile: { x: 6, y: 3 }, nowMs: 0,
  });
  const pulsed = createSelectedTargetFeedback({
    targetId: 'oni-1', targetName: 'Ashen Oni', targetTile: { x: 6, y: 3 }, nowMs: 400,
  });
  assert.equal(first.kind, 'selected-target');
  assert.deepEqual(first.targetTile, { x: 6, y: 3 });
  assert.equal(first.announcement, 'Selected target Ashen Oni, space 6,3.');
  assert.ok(pulsed.opacity > first.opacity);
  const reducedA = createSelectedTargetFeedback({ targetId: 'oni-1', targetTile: { x: 6, y: 3 }, nowMs: 1, reducedMotion: true });
  const reducedB = createSelectedTargetFeedback({ targetId: 'oni-1', targetTile: { x: 6, y: 3 }, nowMs: 700, reducedMotion: true });
  assert.deepEqual(reducedB, reducedA);
});

test('browser wires move feedback through manual and Auto-Grind without joining simulation timing', async () => {
  const source = await readFile(new URL('../battle.js', import.meta.url), 'utf8');
  assert.match(source, /createBattleMoveFeedback\(\{/);
  assert.match(source, /sampleBattleMoveFeedback\(activeBattleSystemFeedback, now, \{ reducedMotion: reducedMotion\.matches \}\)/);
  assert.match(source, /function drawBattleSystemFeedback\(/);
  assert.match(source, /drawBattleSystemFeedback\(moveFeedback, selectedTargetFeedback, geometry\)/);
  assert.match(source, /function announceSelectedBattleTarget\(/);
  assert.match(source, /activeBattleSystemFeedback = null/);
  assert.doesNotMatch(source, /getBattlePresentationBoundary\([^)]*activeBattleSystemFeedback/,
    'system feedback cannot delay commands, Recovery, intent, or Auto-Grind');
});
