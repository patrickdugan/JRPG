import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  BATTLE_COMMAND_PRESENTATION_BOUNDS,
  BATTLE_COMMAND_PRESENTATION_MS,
  BATTLE_COMMAND_PRESENTATION_SPEEDS,
  battleCommandPresentationIsActive,
  createBattleCommandPresentation,
  getBattleObjectiveCommandTile,
  getBattlePresentationBoundary,
  sampleBattleCommandPresentation,
} from '../battle-command-presentation.mjs';

test('objective command presentation uses the same first incomplete exact tile as board tokens', () => {
  const level = {
    id: 'objective-command-tile', width: 7, height: 5, blocked: [], terrain: [],
    spawn: { x: 0, y: 0 },
  };
  const requirement = {
    key: 'returned-name', action: 'returnItem', targetId: 'name-slip',
    count: 2, progress: 1, complete: false, tiles: ['4,1', '5,1'],
  };
  const actors = [
    { instanceId: 'ren', hp: 20, active: true, pos: { x: 2, y: 2 } },
    { instanceId: 'fallen', hp: 0, active: true, pos: { x: 5, y: 1 } },
  ];
  assert.deepEqual(getBattleObjectiveCommandTile({
    level, requirement, actors, fallbackTile: actors[0].pos,
  }), { x: 5, y: 1 }, 'progress 1 leaves the second authored tile as the first incomplete token');
  assert.deepEqual(getBattleObjectiveCommandTile({
    level, requirement: null, actors, fallbackTile: actors[0].pos,
  }), { x: 2, y: 2 });
});

test('Guard, Dodge, Item, Analyze, and Objective create exact bounded immutable records', () => {
  assert.deepEqual(BATTLE_COMMAND_PRESENTATION_SPEEDS, [1, 2, 4]);
  assert.deepEqual(BATTLE_COMMAND_PRESENTATION_MS, { guard: 400, dodge: 400, item: 720, analyze: 480, objective: 480 });
  assert.equal(Object.isFrozen(BATTLE_COMMAND_PRESENTATION_SPEEDS), true);
  assert.equal(Object.isFrozen(BATTLE_COMMAND_PRESENTATION_MS), true);

  const actorTile = { x: 2, y: 3 };
  const targetTile = { x: 7, y: 3 };
  const guard = createBattleCommandPresentation({
    type: 'guard', actorId: 'ren', actorName: 'Ren', actorTile, startedAt: 1_000,
  });
  const dodge = createBattleCommandPresentation({
    type: 'dodge', actorId: 'lise', actorName: 'Nikola', actorTile, startedAt: 1_000,
  });
  const analyze = createBattleCommandPresentation({
    type: 'analyze', actorId: 'aya', actorName: 'Aya', actorTile,
    targetId: 'oni-1', targetName: 'Ashen Oni', targetTile, startedAt: 1_000, speed: 2,
    detail: 'Ledger readout published.',
  });
  const item = createBattleCommandPresentation({
    type: 'item', actorId: 'ren', actorName: 'Ren', actorTile,
    targetId: 'aya', targetName: 'Aya', targetTile: { x: 3, y: 4 },
    itemId: 'river-salve', itemName: 'River Salve', detail: 'HP +80.', startedAt: 1_000,
  });
  const objective = createBattleCommandPresentation({
    type: 'objective', actorId: 'lise', actorName: 'Nikola', actorTile,
    targetId: 'east-node', targetName: 'East Node', targetTile,
    objectiveAction: 'breakObject', label: 'Break East Node', marker: 'node', color: '#e27d68',
    startedAt: 1_000, speed: 4,
  });

  assert.equal(guard.durationMs, 400);
  assert.equal(guard.endsAt, 1_400);
  assert.equal(dodge.durationMs, 400);
  assert.equal(item.durationMs, 720);
  assert.equal(analyze.durationMs, 240);
  assert.equal(objective.durationMs, 120);
  assert.ok(guard.baseDurationMs >= BATTLE_COMMAND_PRESENTATION_BOUNDS.minimumBaseDurationMs);
  assert.ok(analyze.baseDurationMs <= BATTLE_COMMAND_PRESENTATION_BOUNDS.maximumBaseDurationMs);
  assert.deepEqual(guard.targetTile, guard.actorTile);
  assert.deepEqual(dodge.targetTile, dodge.actorTile);
  assert.equal(guard.announcement, 'Ren guards.');
  assert.equal(dodge.announcement, 'Nikola readies Dodge.');
  assert.equal(dodge.marker, 'chevron');
  assert.equal(dodge.color, '#a98ae6');
  assert.equal(dodge.accentColor, '#f0e5ff');
  assert.equal(item.itemId, 'river-salve');
  assert.equal(item.itemName, 'River Salve');
  assert.equal(item.marker, 'item');
  assert.deepEqual(item.targetTile, { x: 3, y: 4 });
  assert.equal(item.announcement, 'Ren uses River Salve on Aya. HP +80.');
  assert.equal(Object.isFrozen(item), true);
  assert.equal(analyze.announcement, 'Aya analyzes Ashen Oni. Ledger readout published.');
  assert.equal(objective.announcement, 'Nikola: Break East Node.');
  assert.equal(objective.marker, 'node');
  assert.equal(objective.color, '#e27d68');
  assert.equal(Object.isFrozen(objective), true);
  assert.equal(Object.isFrozen(objective.actorTile), true);
  assert.deepEqual(actorTile, { x: 2, y: 3 }, 'caller tiles remain mutable and unchanged');
  assert.notEqual(objective.actorTile, actorTile);
});

test('sampling is deterministic, expires exactly, and reduced motion holds one static readable frame', () => {
  const record = createBattleCommandPresentation({
    type: 'analyze', actorId: 'aya', actorTile: { x: 1, y: 1 },
    targetId: 'wisp-1', targetTile: { x: 5, y: 1 }, startedAt: 2_000,
  });
  assert.equal(sampleBattleCommandPresentation(record, 1_999), null);
  const opening = sampleBattleCommandPresentation(record, 2_000);
  const middle = sampleBattleCommandPresentation(record, 2_240);
  assert.equal(opening.phase, 'appear');
  assert.equal(opening.linkProgress, 0);
  assert.equal(middle.phase, 'hold');
  assert.equal(middle.progress, 0.5);
  assert.equal(middle.linkProgress, 1);
  assert.equal(Object.isFrozen(middle), true);
  assert.equal(sampleBattleCommandPresentation(record, record.endsAt), null);
  assert.equal(battleCommandPresentationIsActive(record, record.startedAt), true);
  assert.equal(battleCommandPresentationIsActive(record, record.endsAt), false);

  const reducedEarly = sampleBattleCommandPresentation(record, 2_001, { reducedMotion: true });
  const reducedLate = sampleBattleCommandPresentation(record, 2_470, { reducedMotion: true });
  assert.deepEqual(reducedLate, reducedEarly);
  assert.equal(reducedEarly.phase, 'hold');
  assert.equal(reducedEarly.linkProgress, 1);
  assert.equal(reducedEarly.reducedMotion, true);
});

test('Dodge samples one actor-local violet chevron without a target link', () => {
  const record = createBattleCommandPresentation({
    type: 'dodge', actorId: 'lise', actorName: 'Nikola', actorTile: { x: 3, y: 2 }, startedAt: 500,
  });
  const animated = sampleBattleCommandPresentation(record, 700);
  assert.equal(animated.type, 'dodge');
  assert.equal(animated.marker, 'chevron');
  assert.deepEqual(animated.actorTile, { x: 3, y: 2 });
  assert.deepEqual(animated.targetTile, animated.actorTile);
  assert.equal(animated.linkProgress, 0);
  assert.equal(animated.reducedMotion, false);

  const reducedEarly = sampleBattleCommandPresentation(record, 501, { reducedMotion: true });
  const reducedLate = sampleBattleCommandPresentation(record, 899, { reducedMotion: true });
  assert.deepEqual(reducedLate, reducedEarly);
  assert.equal(reducedEarly.phase, 'hold');
  assert.equal(reducedEarly.progress, 0.5);
  assert.equal(reducedEarly.linkProgress, 0);
});

test('Item samples one exact source-to-party-target route and freezes under reduced motion', () => {
  const record = createBattleCommandPresentation({
    type: 'item', actorId: 'ren', actorName: 'Ren', actorTile: { x: 1, y: 2 },
    targetId: 'aya', targetName: 'Aya', targetTile: { x: 5, y: 4 },
    itemId: 'river-salve', itemName: 'River Salve', startedAt: 100,
  });
  const moving = sampleBattleCommandPresentation(record, 280);
  assert.equal(moving.type, 'item');
  assert.equal(moving.itemId, 'river-salve');
  assert.deepEqual(moving.actorTile, { x: 1, y: 2 });
  assert.deepEqual(moving.targetTile, { x: 5, y: 4 });
  assert.equal(moving.linkProgress > 0, true);
  const reducedEarly = sampleBattleCommandPresentation(record, 101, { reducedMotion: true });
  const reducedLate = sampleBattleCommandPresentation(record, 819, { reducedMotion: true });
  assert.deepEqual(reducedLate, reducedEarly);
  assert.equal(reducedEarly.linkProgress, 1);
  assert.equal(sampleBattleCommandPresentation(record, record.endsAt), null);
});

test('invalid command records fail explicitly and presentation boundaries compose without simulation data', () => {
  assert.throws(() => createBattleCommandPresentation({ type: 'move', actorTile: { x: 1, y: 1 } }), /Unsupported/);
  assert.throws(() => createBattleCommandPresentation({ type: 'guard', actorTile: { x: 1.5, y: 1 } }), /exact integer tile/);
  assert.throws(() => createBattleCommandPresentation({ type: 'analyze', actorTile: { x: 1, y: 1 } }), /targetTile/);
  assert.throws(() => createBattleCommandPresentation({ type: 'guard', actorTile: { x: 1, y: 1 }, speed: 3 }), /1, 2, or 4/);

  const guard = createBattleCommandPresentation({ type: 'guard', actorTile: { x: 1, y: 1 }, startedAt: 100 });
  const attackLike = { endsAt: 900, recoveryPulses: 99 };
  assert.equal(getBattlePresentationBoundary(guard, attackLike), 900);
  assert.equal(getBattlePresentationBoundary(null, undefined), null);
  assert.equal(Object.hasOwn(guard, 'recoveryPulses'), false, 'presentation records cannot alter simulation Recovery');
});

test('browser integrates command records into manual, Auto-Grind, reduced-motion, and announcement paths', async () => {
  const source = await readFile(new URL('../battle.js', import.meta.url), 'utf8');
  assert.match(source, /createBattleCommandPresentation\(\{/);
  assert.match(source, /sampleBattleCommandPresentation\(activeCommandPresentation, now, \{ reducedMotion: reducedMotion\.matches \}\)/);
  assert.match(source, /announcements\.textContent = activeCommandPresentation\.announcement/);
  assert.match(source, /publishActiveCommandAnnouncement\(\);/);
  assert.match(source, /function drawBattleCommandPresentationFx\(/);
  assert.match(source, /drawBattleCommandPresentationFx\(commandPresentation, geometry\)/);
  assert.match(source, /if \(command\.type === 'objective'\)[\s\S]*?startBattleCommandPresentation/);
  assert.match(source, /if \(command\.type === 'guard'\)[\s\S]*?startBattleCommandPresentation/);
  assert.match(source, /if \(command\.type === 'analyze'\)[\s\S]*?startBattleCommandPresentation/);
  assert.match(source, /getBattlePresentationBoundary\(activeBattleAnimation, activeCommandPresentation\)/);
  assert.match(source, /activeCommandPresentation = null/);
});
