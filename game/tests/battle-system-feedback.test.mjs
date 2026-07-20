import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  BATTLE_SYSTEM_FEEDBACK_MS,
  createBattleMoveFeedback,
  createBattleTempoPresentation,
  createRecoveryLockFeedback,
  createSelectedTargetFeedback,
  sampleBattleMoveFeedback,
  sampleRecoveryLockFeedback,
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

test('Recovery lock feedback only exists for a real locked party command attempt', () => {
  const actor = {
    instanceId: 'aya', name: 'Aya', faction: 'party', hp: 72, active: true,
    readyAtPulse: 11, pos: { x: 2, y: 4 },
  };
  const record = createRecoveryLockFeedback({
    actor, nowPulse: 7, activeActorId: 'ren', startedAt: 1_000,
  });
  assert.equal(record.kind, 'recovery-lock');
  assert.deepEqual(record.tile, { x: 2, y: 4 });
  assert.equal(record.remainingPulses, 4);
  assert.equal(record.readyAtPulse, 11);
  assert.equal(record.endsAt, 1_000 + BATTLE_SYSTEM_FEEDBACK_MS['recovery-lock']);
  assert.match(record.announcement, /Recovery locked for 4 more pulses; ready at pulse 11/);
  assert.equal(Object.isFrozen(record), true);
  assert.deepEqual(actor.pos, { x: 2, y: 4 });

  assert.equal(createRecoveryLockFeedback({ actor, nowPulse: 7, activeActorId: 'aya' }), null);
  assert.equal(createRecoveryLockFeedback({ actor: { ...actor, readyAtPulse: 7 }, nowPulse: 7, activeActorId: 'ren' }), null);
  assert.equal(createRecoveryLockFeedback({ actor: { ...actor, faction: 'enemy' }, nowPulse: 7, activeActorId: 'ren' }), null);

  const frame = sampleRecoveryLockFeedback(record, 1_280);
  assert.equal(frame.progress, 0.5);
  assert.deepEqual(frame.tile, actor.pos);
  assert.equal(sampleRecoveryLockFeedback(record, record.endsAt), null);
  assert.deepEqual(
    sampleRecoveryLockFeedback(record, 1_001, { reducedMotion: true }),
    sampleRecoveryLockFeedback(record, 1_559, { reducedMotion: true }),
  );
});

test('Tempo readiness uses only matching immutable commit pulses and keeps reduced motion static', () => {
  const snapshot = Object.freeze({
    nowPulse: 8,
    activeActorId: 'ren',
    actors: Object.freeze([
      Object.freeze({ instanceId: 'ren', name: 'Ren', faction: 'party', hp: 90, active: true, readyAtPulse: 8, pos: Object.freeze({ x: 1, y: 3 }) }),
      Object.freeze({ instanceId: 'aya', name: 'Aya', faction: 'party', hp: 70, active: true, readyAtPulse: 12, pos: Object.freeze({ x: 2, y: 3 }) }),
      Object.freeze({ instanceId: 'oni', name: 'Oni', faction: 'enemy', hp: 80, active: true, readyAtPulse: 10, pos: Object.freeze({ x: 6, y: 2 }) }),
    ]),
    log: Object.freeze([
      Object.freeze({ type: 'commit', actorId: 'aya', pulse: 2, readyAtPulse: 9 }),
      Object.freeze({ type: 'commit', actorId: 'aya', pulse: 4, readyAtPulse: 12 }),
      Object.freeze({ type: 'commit', actorId: 'oni', pulse: 6, readyAtPulse: 10 }),
    ]),
  });
  const frames = createBattleTempoPresentation(snapshot, { visualNowMs: 200 });
  const ren = frames.find((frame) => frame.actorId === 'ren');
  const aya = frames.find((frame) => frame.actorId === 'aya');
  const oni = frames.find((frame) => frame.actorId === 'oni');
  assert.equal(ren.status, 'active');
  assert.equal(ren.readiness, 1);
  assert.equal(aya.recoveryStartPulse, 4, 'stale commits with a different ready pulse are not reused');
  assert.equal(aya.totalRecoveryPulses, 8);
  assert.equal(aya.remainingPulses, 4);
  assert.equal(aya.readiness, 0.5);
  assert.equal(oni.readiness, 0.5);
  assert.equal(frames[0].scan, 0.25);
  assert.equal(Object.isFrozen(frames), true);
  assert.equal(Object.isFrozen(aya), true);
  assert.deepEqual(
    createBattleTempoPresentation(snapshot, { visualNowMs: 1, reducedMotion: true }),
    createBattleTempoPresentation(snapshot, { visualNowMs: 799, reducedMotion: true }),
  );
});

test('Tempo readiness refuses to invent a percentage without a matching commit', () => {
  const [frame] = createBattleTempoPresentation({
    nowPulse: 3,
    activeActorId: 'ren',
    actors: [{ instanceId: 'aya', name: 'Aya', faction: 'party', hp: 10, readyAtPulse: 8, pos: { x: 1, y: 1 } }],
    log: [{ type: 'commit', actorId: 'aya', pulse: 1, readyAtPulse: 7 }],
  });
  assert.equal(frame.status, 'recovery');
  assert.equal(frame.recoveryStartPulse, null);
  assert.equal(frame.totalRecoveryPulses, null);
  assert.equal(frame.readiness, 0);
});

test('browser wires move feedback through manual and Auto-Grind without joining simulation timing', async () => {
  const source = await readFile(new URL('../battle.js', import.meta.url), 'utf8');
  assert.match(source, /createBattleMoveFeedback\(\{/);
  assert.match(source, /sampleBattleMoveFeedback\(activeBattleSystemFeedback, now, \{ reducedMotion: reducedMotion\.matches \}\)/);
  assert.match(source, /function drawBattleSystemFeedback\(/);
  assert.match(source, /drawBattleSystemFeedback\(moveFeedback, selectedTargetFeedback, geometry\)/);
  assert.match(source, /sampleRecoveryLockFeedback\(activeBattleSystemFeedback, now, \{ reducedMotion: reducedMotion\.matches \}\)/);
  assert.match(source, /createBattleTempoPresentation\(snapshot, \{/);
  assert.match(source, /function drawBattleTempoPresentation\(/);
  assert.match(source, /drawBattleTempoPresentation\(tempoPresentation, geometry\)/);
  assert.match(source, /partyPanel\.addEventListener\('click'/);
  const partyAttemptWiring = source.slice(
    source.indexOf("partyPanel.addEventListener('click'"),
    source.indexOf("enemyPanel.addEventListener('click'"),
  );
  assert.match(partyAttemptWiring, /startRecoveryLockSystemFeedback\(actor, snapshot\)/);
  assert.doesNotMatch(partyAttemptWiring, /engine\.(?:move|useSkill|guard|analyze|performObjectiveAction|resolveEnemyActivation)\(/,
    'checking a locked party actor cannot issue or redirect an engine command');
  assert.match(source, /function announceSelectedBattleTarget\(/);
  assert.match(source, /activeBattleSystemFeedback = null/);
  assert.doesNotMatch(source, /getBattlePresentationBoundary\([^)]*activeBattleSystemFeedback/,
    'system feedback cannot delay commands, Recovery, intent, or Auto-Grind');
});
