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
import {
  BOSS_DEFEAT_HOLD_MS,
  createBossTerminalPresentationRecord,
  getBossCombatPresentationPose,
  getNewlyTerminalBossCombatActors,
  mergeBossTerminalPresentationActors,
} from '../boss-combat-atlas.mjs';
import { CAMPAIGN_COMBAT_PHASES, createCampaignCombat } from '../campaign-combat.mjs';
import {
  getNewlyTerminalPartyCombatActors,
  getPartyCombatPresentationPose,
  mergePartyTerminalPresentationActors,
} from '../party-combat-atlas.mjs';
import {
  getEnemyCombatPresentationPose,
  getNewlyTerminalEnemyCombatActors,
  mergeEnemyTerminalPresentationActors,
} from '../enemy-atlas.mjs';

test('Auto-Grind start is rejected during an animation and every terminal hold', () => {
  assert.equal(canStartAutoGrindPresentation({ unlocked: true }), true);
  assert.equal(canStartAutoGrindPresentation({ unlocked: false }), false);
  assert.equal(canStartAutoGrindPresentation({ unlocked: true, animationActive: true }), false);
  assert.equal(canStartAutoGrindPresentation({ unlocked: true, result: 'victory' }), false);
  assert.equal(canStartAutoGrindPresentation({ unlocked: true, result: 'defeat' }), false);
  assert.equal(canStartAutoGrindPresentation({ unlocked: true, settling: true }), false);
});

test('manual and automated enemy intent always own a readable delay', () => {
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

  assert.equal(getNextBattleActionAt({
    nowMs: 9_000,
    stepDelayMs: 100,
    animationEndsAt: null,
    nextIsEnemy: true,
    speed: 2,
  }), 9_000 + (ENEMY_INTENT_BASE_DELAY_MS / 2), 'a non-animated action still earns a fresh enemy-intent window');
  assert.equal(getNextBattleActionAt({
    nowMs: 9_000,
    stepDelayMs: 500,
    animationEndsAt: null,
    nextIsEnemy: false,
    speed: 4,
  }), 9_500, 'party follow-ups do not gain an unrelated enemy-intent delay');
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

test('lethal boss resolution swaps the pre-action ghost to a defeat pose only in the terminal hold', () => {
  const party = { instanceId: 'ren-1', templateId: 'ren', faction: 'party', hp: 40, active: true, pos: { x: 1, y: 1 } };
  const livingBoss = { instanceId: 'kurozane-1', templateId: 'kurozane', faction: 'enemy', hp: 12, active: true, pos: { x: 5, y: 1 } };
  const defeatedBoss = { ...livingBoss, hp: 0 };
  const beforeActors = [party, livingBoss];
  const afterActors = [party, defeatedBoss];
  const terminal = getNewlyTerminalBossCombatActors(beforeActors, afterActors);
  assert.deepEqual(terminal, [defeatedBoss]);

  const preActionPresentation = getBattlePresentationActors(afterActors, [party, livingBoss]);
  assert.equal(preActionPresentation[1], livingBoss);
  assert.equal(mergeBossTerminalPresentationActors(preActionPresentation, terminal, false), preActionPresentation);
  assert.equal(getBossCombatPresentationPose({
    hp: preActionPresentation[1].hp,
    active: preActionPresentation[1].active,
    targetPose: 'stagger',
  }), 'break');

  const terminalPresentation = mergeBossTerminalPresentationActors(preActionPresentation, terminal, true);
  assert.equal(terminalPresentation[1], defeatedBoss);
  assert.equal(getBossCombatPresentationPose({
    hp: terminalPresentation[1].hp,
    active: terminalPresentation[1].active,
    targetPose: 'stagger',
  }), 'defeat');
  assert.equal(livingBoss.hp, 12, 'presentation composition does not mutate the pre-action snapshot');
  assert.equal(defeatedBoss.hp, 0, 'presentation composition does not mutate simulation output');
});

test('lethal party resolution swaps the pre-action ghost to a defeat pose only in the terminal hold', () => {
  const livingParty = { instanceId: 'ren-1', templateId: 'ren', faction: 'party', hp: 12, active: true, pos: { x: 1, y: 1 } };
  const defeatedParty = { ...livingParty, hp: 0 };
  const enemy = { instanceId: 'hound-1', templateId: 'cinder-hound', faction: 'enemy', hp: 20, active: true, pos: { x: 4, y: 1 } };
  const terminal = getNewlyTerminalPartyCombatActors([livingParty, enemy], [defeatedParty, enemy]);
  assert.deepEqual(terminal, [defeatedParty]);

  const preActionPresentation = getBattlePresentationActors([defeatedParty, enemy], [enemy, livingParty]);
  assert.equal(preActionPresentation.find(({ instanceId }) => instanceId === livingParty.instanceId), livingParty);
  assert.equal(mergePartyTerminalPresentationActors(preActionPresentation, terminal, false), preActionPresentation);

  const terminalPresentation = mergePartyTerminalPresentationActors(preActionPresentation, terminal, true);
  const presentedParty = terminalPresentation.find(({ instanceId }) => instanceId === livingParty.instanceId);
  assert.equal(presentedParty, defeatedParty);
  assert.equal(getPartyCombatPresentationPose({ hp: presentedParty.hp, active: presentedParty.active }), 'defeat');
});

test('lethal regular-enemy resolution swaps the pre-action ghost to a defeat pose only in the terminal hold', () => {
  const party = { instanceId: 'ren-1', templateId: 'ren', faction: 'party', hp: 40, active: true, pos: { x: 1, y: 1 } };
  const livingEnemy = { instanceId: 'hound-1', templateId: 'cinder-hound', faction: 'enemy', hp: 8, active: true, pos: { x: 4, y: 1 } };
  const defeatedEnemy = { ...livingEnemy, hp: 0 };
  const terminal = getNewlyTerminalEnemyCombatActors([party, livingEnemy], [party, defeatedEnemy]);
  assert.deepEqual(terminal, [defeatedEnemy]);

  const preActionPresentation = getBattlePresentationActors([party, defeatedEnemy], [party, livingEnemy]);
  assert.equal(preActionPresentation.find(({ instanceId }) => instanceId === livingEnemy.instanceId), livingEnemy);
  assert.equal(mergeEnemyTerminalPresentationActors(preActionPresentation, terminal, false), preActionPresentation);

  const terminalPresentation = mergeEnemyTerminalPresentationActors(preActionPresentation, terminal, true);
  const presentedEnemy = terminalPresentation.find(({ instanceId }) => instanceId === livingEnemy.instanceId);
  assert.equal(presentedEnemy, defeatedEnemy);
  assert.equal(getEnemyCombatPresentationPose({ hp: presentedEnemy.hp, active: presentedEnemy.active }), 'defeat');
});

test('nonlethal boss deactivation is appended for defeat presentation even when a ward was targeted', () => {
  const party = { instanceId: 'ren-1', templateId: 'ren', faction: 'party', hp: 40, active: true, pos: { x: 1, y: 1 } };
  const livingBoss = { instanceId: 'mateus-1', templateId: 'mateus', faction: 'enemy', hp: 18, active: true, pos: { x: 5, y: 1 } };
  const activeWard = { instanceId: 'ward-1', templateId: 'blood-ward-west', faction: 'enemy', hp: 6, active: true, pos: { x: 4, y: 1 } };
  const surrenderedBoss = { ...livingBoss, active: false };
  const brokenWard = { ...activeWard, hp: 0, active: false };
  const beforeActors = [party, livingBoss, activeWard];
  const afterActors = [party, surrenderedBoss, brokenWard];
  const terminal = getNewlyTerminalBossCombatActors(beforeActors, afterActors);
  assert.deepEqual(terminal, [surrenderedBoss], 'supporting actors never enter the primary boss terminal suite');

  const wardTargetPresentation = getBattlePresentationActors(afterActors, [party, activeWard]);
  assert.equal(wardTargetPresentation.some(({ instanceId }) => instanceId === livingBoss.instanceId), false);
  const terminalPresentation = mergeBossTerminalPresentationActors(wardTargetPresentation, terminal, true);
  const presentedBoss = terminalPresentation.find(({ instanceId }) => instanceId === livingBoss.instanceId);
  assert.equal(presentedBoss, surrenderedBoss);
  assert.equal(getBossCombatPresentationPose({ hp: presentedBoss.hp, active: presentedBoss.active }), 'defeat');
});

test('Mateus objective-only ward resolution creates a bounded terminal-only defeat hold', () => {
  const engine = createCampaignCombat('fp1-mateus');
  for (const wardId of ['blood-ward-west-1', 'blood-ward-east-1']) {
    const ward = engine.getActor(wardId);
    ward.active = true;
    ward.hp = ward.maxHp;
  }

  const advanceToPlayer = () => {
    let snapshot = engine.snapshot();
    while (!snapshot.result && snapshot.phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND) {
      const result = engine.resolveEnemyActivation();
      assert.equal(result.ok, true);
      snapshot = engine.snapshot();
    }
    return snapshot;
  };

  let snapshot = advanceToPlayer();
  const firstBreak = engine.performObjectiveAction(snapshot.activeActorId, {
    type: 'breakObject',
    targetId: 'blood-ward-west',
  });
  assert.equal(firstBreak.ok, true);

  snapshot = advanceToPlayer();
  const before = snapshot;
  const secondBreak = engine.performObjectiveAction(before.activeActorId, {
    type: 'breakObject',
    targetId: 'blood-ward-east',
  });
  const after = engine.snapshot();
  assert.equal(secondBreak.ok, true);
  assert.equal(secondBreak.complete, true);
  assert.equal(Object.hasOwn(secondBreak, 'targetId'), false, 'objective result is not a skill resolution');
  assert.equal(Object.hasOwn(secondBreak, 'skillId'), false, 'objective result is not a skill resolution');
  assert.equal(after.result, 'victory');

  const beforeMateus = before.actors.find(({ instanceId }) => instanceId === 'mateus-1');
  const afterMateus = after.actors.find(({ instanceId }) => instanceId === 'mateus-1');
  assert.equal(beforeMateus.active, true);
  assert.equal(afterMateus.active, false);
  assert.equal(afterMateus.hp > 0, true, 'surrender remains explicitly nonlethal');

  const record = createBossTerminalPresentationRecord(before.actors, after.actors, {
    startedAt: 5_000,
    speed: 1,
  });
  assert.equal(record.timeline.durationMs, 0);
  assert.deepEqual(record.timeline.frames, []);
  assert.equal(record.attackerId, null);
  assert.equal(record.targetId, null);
  assert.deepEqual(record.terminalPartyActors, []);
  assert.deepEqual(record.terminalEnemyActors, []);
  assert.equal(record.endsAt - record.timelineEndsAt, BOSS_DEFEAT_HOLD_MS);
  assert.deepEqual(record.terminalBossActors.map(({ instanceId }) => instanceId), ['mateus-1']);

  const visible = getBattlePresentationActors(after.actors, record.retainedActors);
  const held = mergeBossTerminalPresentationActors(visible, record.terminalBossActors, true);
  const presentedMateus = held.find(({ instanceId }) => instanceId === 'mateus-1');
  assert.equal(presentedMateus, afterMateus);
  assert.equal(getBossCombatPresentationPose(presentedMateus), 'defeat');
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
  const [source, markup] = await Promise.all([
    readFile(new URL('../battle.js', import.meta.url), 'utf8'),
    readFile(new URL('../battle.html', import.meta.url), 'utf8'),
  ]);
  assert.deepEqual(
    [...markup.matchAll(/data-speed="(\d+)"/g)].map((match) => Number(match[1])),
    [1, 2, 4],
    'the visible selector exposes every supported speed exactly once',
  );
  assert.doesNotMatch(source, /query\.get\(['"]speed['"]\)/, 'URL parameters cannot override the saved speed authority');
  assert.match(source, /resolveBattlePresentationSpeed\(encounterWinsAtLoad, advancementState\.speedMultiplier\)/);
  assert.match(source, /const nextSpeed = Number\(button\.dataset\.speed\);/);
  assert.match(source, /advancementState = setSpeedMultiplier\(advancementState, speedMultiplier\);\s+advancementAdapter\.save\(advancementState\);/);
  assert.match(source, /canStartAutoGrindPresentation\(\{/);
  assert.ok(source.indexOf('if (animationActive)') < source.indexOf('activeBattleAnimation = null;', source.indexOf('function toggleAutoGrind')));
  assert.match(source, /retainedActors: Object\.freeze\(\[attacker, target\]\)/);
  assert.match(source, /getBattlePresentationActors\(snapshot\.actors, animation\?\.retainedActors \?\? \[\]\)/);
  assert.match(source, /getNewlyTerminalBossCombatActors\(beforeSnapshot\.actors, afterSnapshot\.actors\)/);
  assert.match(source, /getNewlyTerminalPartyCombatActors\(beforeSnapshot\.actors, afterSnapshot\.actors\)/);
  assert.match(source, /getNewlyTerminalEnemyCombatActors\(beforeSnapshot\.actors, afterSnapshot\.actors\)/);
  assert.match(source, /endsAt: timelineEndsAt \+ defeatHoldMs/);
  assert.match(source, /now >= activeBattleAnimation\.timelineEndsAt/);
  assert.match(source, /mergeBossTerminalPresentationActors\(/);
  assert.equal((source.match(/mergeBossTerminalPresentationRecord\(/g) ?? []).length, 2,
    'manual and Auto-Grind mutations both merge objective-only boss terminal records');
  assert.match(source, /mergePartyTerminalPresentationActors\(/);
  assert.match(source, /mergeEnemyTerminalPresentationActors\(/);
  assert.match(source, /getBossCombatDrawPlacement\(frame, \{/);
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
    'cancelQueuedAutoGrind();',
    'autoSettleAt = null;',
    'clearEnemyIntentSchedule();',
    'battleFacingByActor.clear();',
    'battleMotionUntil.clear();',
    'battleEnemyPoseByActor.clear();',
    'battleEnemyPoseUntil.clear();',
    'activeBattleAnimation = null;',
    'victoryPersistenceError = null;',
    'victorySaveRetryAt = 0;',
  ]) assert.match(restart, new RegExp(requiredReset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  assert.match(source, /if \(snapshot\.result !== 'victory'\) return false;/, 'non-victories cannot record rewards');
  assert.match(source, /if \(rewardRecorded\) return true;/, 'a durable reward remains exactly-once guarded');
});

test('finite Auto-Grind queues expose 1/5/10 wins and only advance after durable settlement', async () => {
  const [source, html] = await Promise.all([
    readFile(new URL('../battle.js', import.meta.url), 'utf8'),
    readFile(new URL('../battle.html', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="autoGrindWins"/);
  for (const wins of [1, 5, 10]) assert.match(html, new RegExp(`<option value="${wins}"`));

  const durableIndex = source.indexOf('const durableVictory = recordVictoryIfNeeded(snapshot);');
  const queueIndex = source.indexOf('recordRepeatGrindVictory(repeatGrindQueue)');
  assert.ok(durableIndex >= 0 && queueIndex > durableIndex, 'the queue counts only a transactionally durable victory');
  assert.match(source, /if \(repeatGrindQueue\.active && queuedVictoryRecorded\) restartQueuedAutoGrind\(now\);/);
  assert.match(source, /cancelQueuedAutoGrind\(`Auto-Grind cancelled after/);
  assert.match(source, /repeatGrindQueue = startRepeatGrindQueue\(createRepeatGrindQueue\(Number\(autoGrindWins\.value\)\)\);/);
});

test('rendered battle state exposes exact active and authoritative objective tiles without inventing rules', async () => {
  const source = await readFile(new URL('../battle.js', import.meta.url), 'utf8');
  const publish = source.slice(
    source.indexOf('function publishRenderedBattleState(snapshot)'),
    source.indexOf('\nfunction renderTempo', source.indexOf('function publishRenderedBattleState(snapshot)')),
  );
  assert.match(publish, /canvas\.dataset\.activeActorId = actor\.instanceId/);
  assert.match(publish, /canvas\.dataset\.activeActorX = String\(actor\.pos\.x\)/);
  assert.match(publish, /canvas\.dataset\.activeActorY = String\(actor\.pos\.y\)/);
  assert.match(publish, /const target = livingEnemies\(snapshot\)/);
  assert.match(publish, /canvas\.dataset\.combatTargetX = String\(target\.pos\.x\)/);
  assert.match(publish, /canvas\.dataset\.combatTargetY = String\(target\.pos\.y\)/);
  assert.match(publish, /canvas\.dataset\.combatSkillRange = String\(actor\.skills\[0\]\.range \?\? 1\)/);
  assert.match(publish, /const suggestion = chooseRepeatBattleCommand\(engine\)/);
  assert.match(publish, /canvas\.dataset\.suggestedCommand = suggestion\.type/);
  assert.match(publish, /canvas\.dataset\.suggestedSkillId = suggestion\.skillId/);
  assert.match(publish, /canvas\.dataset\.suggestedTargetId = suggestion\.targetId/);
  assert.match(publish, /!requirement\.automatic && !requirement\.complete/);
  assert.match(publish, /if \(!pending\.tile && !pending\.tiles\?\.length\) return;/);
  assert.match(publish, /getObjectiveTokenPlacements\(engine\.level, \[pending\], occupied\)/);
  assert.match(publish, /canvas\.dataset\.objectiveTargetX = String\(target\.x\)/);
  assert.match(publish, /canvas\.dataset\.objectiveTargetY = String\(target\.y\)/);
  assert.match(source, /publishRenderedBattleState\(snapshot\);\s+renderCombatants\(snapshot\);/);
});

test('browser Dodge wiring is targetless, engine-owned, presentation-bounded, and never a hit cue', async () => {
  const [source, html] = await Promise.all([
    readFile(new URL('../battle.js', import.meta.url), 'utf8'),
    readFile(new URL('../battle.html', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /data-command="dodge" aria-keyshortcuts="F"/);
  assert.match(source, /if \(command\.type === 'dodge'\)[\s\S]*?engine\.dodge\(actorId\)[\s\S]*?type: 'dodge'/);
  assert.match(source, /selectedCommand === 'dodge'[\s\S]*?engine\.dodge\(actor\.instanceId\)/);
  assert.match(source, /\['guard', 'dodge', 'item', 'analyze', 'objective'\]\.includes\(selectedCommand\)/);
  assert.match(source, /dodged: Boolean\(result\.dodged\)/);
  const audio = source.slice(source.indexOf('const healFeedback ='), source.indexOf('const timelineEndsAt ='));
  assert.ok(audio.indexOf('result.dodged') >= 0 && audio.indexOf('result.dodged') < audio.indexOf('result.guarded'));
  assert.doesNotMatch(audio.slice(audio.indexOf('result.dodged'), audio.indexOf('result.guarded')), /playCue\('combatHit'\)/);
  assert.match(source, /function drawPersistentDodgeStances\(/);
  assert.match(source, /actor\.stance === 'dodge'/);
  assert.match(source, /canvas\.dataset\.activeActorStance = actor\.stance/);
  assert.match(source, /if \(!\['attack', 'skill', 'analyze'\]\.includes\(selectedCommand\)\) return;/);
});

test('browser Item wiring is party-targeted, presentation-locked, engine-owned, and outside attack timelines', async () => {
  const [source, html] = await Promise.all([
    readFile(new URL('../battle.js', import.meta.url), 'utf8'),
    readFile(new URL('../battle.html', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /data-command="item" aria-keyshortcuts="I"/);
  assert.match(html, /<label for="itemSelect">[\s\S]*?<select id="itemSelect"/);
  assert.match(source, /result = engine\.useItem\(actor\.instanceId, itemSelect\.value, targetSelect\.value\)/);
  assert.doesNotMatch(
    source.slice(source.indexOf("} else if (selectedCommand === 'item')"), source.indexOf("} else if (selectedCommand === 'analyze')")),
    /startCombatAnimation|useSkill/,
  );
  assert.match(source, /const presentationStartedAt = performance\.now\(\)/);
  assert.match(source, /startBattleCommandPresentation\(\{[\s\S]*?type: selectedCommand,[\s\S]*?startedAt: presentationStartedAt/);
  assert.match(source, /startBattleHealSystemFeedback\(result, snapshot, afterSnapshot, \{ startedAt: presentationStartedAt, speed: 1 \}\)/);
  assert.match(source, /selectedCommand === 'item' && partyTarget/);
  assert.match(source, /engine\.getBattleItemQuote\(actor\.instanceId, itemSelect\.value, partyTarget\.instanceId\)/);
  assert.match(source, /if \(!\['attack', 'skill', 'analyze'\]\.includes\(selectedCommand\)\) return;/,
    'enemy canvas targets are suppressed while Item is selected');
  assert.match(source, /const itemMode = selectedCommand === 'item'/);
  assert.match(source, /selectedItemTargetId/);
  assert.match(source, /selectedEnemyTargetId/);
  assert.match(source, /No item, Recovery, or turn will be spent/);
  assert.match(source, /River Salve would have no effect on any living ally/);
});

test('victory settles provisional item debits atomically before replacing live loadout state', async () => {
  const source = await readFile(new URL('../battle.js', import.meta.url), 'utf8');
  const victory = source.slice(
    source.indexOf('function recordVictoryIfNeeded(snapshot)'),
    source.indexOf('\nfunction renderResult', source.indexOf('function recordVictoryIfNeeded(snapshot)')),
  );
  assert.match(victory, /settleBattleLoadout\(loadoutState, \{/);
  assert.match(victory, /itemDebits: snapshot\.itemConsumption/);
  assert.match(victory, /reward: \{ currency: reward\.currency, items: reward\.items \}/);
  assert.match(victory, /partyVitals/);
  assert.match(victory, /entry\.faction === 'party' && entry\.hp > 0/);
  assert.doesNotMatch(victory, /Math\.max\(1, actor\.hp\)/);
  assert.ok(victory.indexOf('settleBattleLoadout(loadoutState') < victory.indexOf('commitPersistenceTransaction('));
  assert.ok(victory.indexOf('commitPersistenceTransaction(') < victory.indexOf('loadoutState = nextLoadoutState'));
  assert.match(victory, /if \(rewardRecorded\) return true/);
  const restart = source.slice(source.indexOf("restartBattle.addEventListener('click'"), source.indexOf("window.addEventListener('keydown'"));
  assert.match(restart, /engine = createEngine\(\)/, 'restart reconstructs provisional stock from durable loadout authority');
  assert.doesNotMatch(restart, /loadoutAdapter\.save|itemConsumption/, 'restart cannot persist an unearned debit');
});
