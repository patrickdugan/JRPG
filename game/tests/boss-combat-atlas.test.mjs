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
  BOSS_TRANSITION_HOLD_MS,
  bossCombatImageHasExpectedSize,
  createBossTerminalPresentationRecord,
  getBossCombatDrawPlacement,
  getBossCombatFrame,
  getBossCombatPresentationPose,
  getNewBossPhaseTransition,
  hasBossCombatTemplate,
  mergeBossTransitionPresentationRecord,
  mergeBossTerminalPresentationRecord,
} from '../boss-combat-atlas.mjs';

test('boss combat atlas maps every canonical primary boss to all seven exact key poses', () => {
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
  assert.equal(rectangles.size, 70);
  assert.equal(BOSS_COMBAT_ATLAS.width, BOSS_COMBAT_ATLAS.columns * BOSS_COMBAT_ATLAS.cellWidth);
  assert.equal(BOSS_COMBAT_ATLAS.height, BOSS_COMBAT_ATLAS.rows * BOSS_COMBAT_ATLAS.cellHeight);
  assert.equal(hasBossCombatTemplate('court-clone'), false);
  assert.throws(() => getBossCombatFrame('court-clone'), /Unknown boss combat template/);
});

test('boss presentation states use only an explicit phase signal for transitions', () => {
  assert.equal(getBossCombatPresentationPose({ hp: 0, actorPose: 'attack' }), 'defeat');
  assert.equal(getBossCombatPresentationPose({ active: false, hp: 10 }), 'defeat');
  assert.equal(getBossCombatPresentationPose({ targetPose: 'stagger', phase: 'windup' }), 'break');
  assert.equal(getBossCombatPresentationPose({ phase: 'windup' }), 'telegraph');
  assert.equal(getBossCombatPresentationPose({ phase: 'status-glyph', actorPose: 'attack' }), 'active');
  assert.equal(getBossCombatPresentationPose({ phase: 'status-glyph' }), 'neutral');
  assert.equal(getBossCombatPresentationPose({ hp: 0, transitionActive: true, targetPose: 'stagger' }), 'defeat');
  assert.equal(getBossCombatPresentationPose({ transitionActive: true, targetPose: 'stagger', phase: 'windup', actorPose: 'windup' }), 'transition');
  assert.equal(getBossCombatPresentationPose({ transitionActive: true, phase: 'recovery', actorPose: 'attack' }), 'transition');
  assert.equal(getBossCombatPresentationPose({ targetPose: 'stagger', phase: 'recovery', actorPose: 'attack' }), 'break');
  assert.equal(getBossCombatPresentationPose({ phase: 'recovery', actorPose: 'attack' }), 'recovery');
  assert.equal(getBossCombatPresentationPose({ actorPose: 'attack' }), 'active');
  assert.equal(getBossCombatPresentationPose({}), 'neutral');
  assert.ok(BOSS_COMBAT_POSES.includes('transition'), 'the authored frame stays reserved in the atlas contract');
  assert.ok(BOSS_COMBAT_POSES.includes('recovery'), 'post-action recovery owns a dedicated authored frame');
  assert.ok(BOSS_TRANSITION_HOLD_MS > 0 && BOSS_TRANSITION_HOLD_MS < BOSS_DEFEAT_HOLD_MS);
  assert.ok(BOSS_DEFEAT_HOLD_MS > 0 && BOSS_DEFEAT_HOLD_MS <= 500, 'terminal presentation is deliberately bounded');
});

test('pure phase presenter detects revision changes and appends a bounded post-skill hold', () => {
  const bossActor = { instanceId: 'kurozane-1', templateId: 'kurozane', faction: 'enemy', hp: 900, active: true };
  const before = {
    actors: [bossActor],
    bossPhase: { bossId: bossActor.instanceId, phaseId: 'court', revision: 0, lastTransition: null },
  };
  const transition = {
    bossId: bossActor.instanceId,
    bossTemplateId: bossActor.templateId,
    fromPhaseId: 'court',
    toPhaseId: 'bell',
    ordinal: 1,
    revision: 1,
    enteredAtPulse: 8,
    reason: 'damage',
  };
  const after = {
    actors: [bossActor],
    bossPhase: { bossId: bossActor.instanceId, phaseId: 'bell', revision: 1, lastTransition: transition },
  };
  const detected = getNewBossPhaseTransition(before, after);
  assert.equal(detected.bossActor, bossActor);
  assert.deepEqual({ ...detected, bossActor: undefined }, { ...transition, bossActor: undefined });
  assert.equal(getNewBossPhaseTransition(after, after), null);
  assert.equal(getNewBossPhaseTransition({ ...before, bossPhase: { ...before.bossPhase, revision: 1 } }, after), null, 'stale revisions cannot replay');
  assert.equal(getNewBossPhaseTransition({}, after), null, 'legacy snapshots cannot invent a transition');
  assert.equal(getNewBossPhaseTransition(before, { ...after, actors: [{ ...bossActor, hp: 0 }] }), null, 'defeat takes precedence');
  assert.equal(getNewBossPhaseTransition(before, { ...after, actors: [{ ...bossActor, active: false }] }), null, 'inactive bosses cannot transition');

  for (const speed of [1, 2, 4]) {
    const terminalOnly = mergeBossTransitionPresentationRecord(null, before, after, { startedAt: 500, speed });
    assert.equal(terminalOnly.startedAt, 500);
    assert.equal(terminalOnly.timelineEndsAt, 500);
    assert.equal(terminalOnly.bossTransition.startsAt, 500);
    assert.equal(terminalOnly.bossTransition.endsAt, 500 + (BOSS_TRANSITION_HOLD_MS / speed));
    assert.equal(terminalOnly.endsAt, terminalOnly.bossTransition.endsAt);
    assert.equal(Object.isFrozen(terminalOnly), true);
    assert.equal(Object.isFrozen(terminalOnly.timeline), true);
    assert.equal(Object.isFrozen(terminalOnly.bossTransition), true);
    assert.equal(Object.isFrozen(terminalOnly.terminalBossActors), true);
  }

  const timeline = Object.freeze({ durationMs: 600, frames: Object.freeze([]) });
  const skillRecord = Object.freeze({
    attackerId: 'ren',
    targetId: bossActor.instanceId,
    retainedActors: Object.freeze([]),
    terminalPartyActors: Object.freeze([]),
    terminalEnemyActors: Object.freeze([]),
    terminalBossActors: Object.freeze([]),
    timeline,
    startedAt: 1_000,
    timelineEndsAt: 1_600,
    endsAt: 1_600,
  });
  const merged = mergeBossTransitionPresentationRecord(skillRecord, before, after, { startedAt: 9_999, speed: 2 });
  assert.equal(merged.timeline, timeline);
  assert.equal(merged.attackerId, skillRecord.attackerId);
  assert.equal(merged.targetId, skillRecord.targetId);
  assert.equal(merged.bossTransition.startsAt, skillRecord.timelineEndsAt);
  assert.equal(merged.bossTransition.endsAt, skillRecord.timelineEndsAt + (BOSS_TRANSITION_HOLD_MS / 2));
  assert.equal(merged.endsAt, merged.bossTransition.endsAt);
  assert.equal(Object.isFrozen(merged), true);
  assert.equal(Object.isFrozen(merged.bossTransition), true);
});

test('pure terminal record composition supports objective-only holds and preserves skill timelines', () => {
  const party = { instanceId: 'ren-1', templateId: 'ren', faction: 'party', hp: 40, active: true };
  const livingBoss = { instanceId: 'mateus-1', templateId: 'mateus', faction: 'enemy', hp: 152, active: true };
  const surrenderedBoss = { ...livingBoss, active: false };
  const beforeActors = [party, livingBoss];
  const afterActors = [party, surrenderedBoss];

  const objectiveRecord = createBossTerminalPresentationRecord(beforeActors, afterActors, {
    startedAt: 1_000,
    speed: 2,
  });
  assert.deepEqual({
    attackerId: objectiveRecord.attackerId,
    targetId: objectiveRecord.targetId,
    retainedActors: objectiveRecord.retainedActors,
    timelineDurationMs: objectiveRecord.timeline.durationMs,
    timelineFrames: objectiveRecord.timeline.frames,
    startedAt: objectiveRecord.startedAt,
    timelineEndsAt: objectiveRecord.timelineEndsAt,
    endsAt: objectiveRecord.endsAt,
  }, {
    attackerId: null,
    targetId: null,
    retainedActors: [],
    timelineDurationMs: 0,
    timelineFrames: [],
    startedAt: 1_000,
    timelineEndsAt: 1_000,
    endsAt: 1_000 + (BOSS_DEFEAT_HOLD_MS / 2),
  });
  assert.deepEqual(objectiveRecord.terminalBossActors, [surrenderedBoss]);
  assert.equal(Object.isFrozen(objectiveRecord), true);
  assert.equal(Object.isFrozen(objectiveRecord.retainedActors), true);
  assert.equal(Object.isFrozen(objectiveRecord.terminalPartyActors), true);
  assert.equal(Object.isFrozen(objectiveRecord.terminalEnemyActors), true);
  assert.equal(Object.isFrozen(objectiveRecord.terminalBossActors), true);
  assert.equal(createBossTerminalPresentationRecord(beforeActors, beforeActors), null);

  const timeline = Object.freeze({ actionId: 'courier-cut' });
  const retainedActors = Object.freeze([party, livingBoss]);
  const skillRecord = Object.freeze({
    attackerId: party.instanceId,
    targetId: livingBoss.instanceId,
    retainedActors,
    terminalBossActors: Object.freeze([]),
    timeline,
    startedAt: 2_000,
    timelineEndsAt: 3_000,
    endsAt: 3_000,
  });
  const merged = mergeBossTerminalPresentationRecord(
    skillRecord,
    beforeActors,
    afterActors,
    { startedAt: 9_999, speed: 2 },
  );
  assert.equal(merged.timeline, timeline);
  assert.equal(merged.retainedActors, retainedActors);
  assert.equal(merged.attackerId, skillRecord.attackerId);
  assert.equal(merged.targetId, skillRecord.targetId);
  assert.equal(merged.startedAt, skillRecord.startedAt);
  assert.equal(merged.timelineEndsAt, skillRecord.timelineEndsAt);
  assert.equal(merged.endsAt, skillRecord.timelineEndsAt + (BOSS_DEFEAT_HOLD_MS / 2));
  assert.deepEqual(merged.terminalBossActors, [surrenderedBoss]);
  assert.equal(mergeBossTerminalPresentationRecord(skillRecord, beforeActors, beforeActors), skillRecord);
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
  assert.equal(bossCombatImageHasExpectedSize({ naturalWidth: 784, naturalHeight: 1280 }), true);
  assert.equal(bossCombatImageHasExpectedSize({ naturalWidth: 783, naturalHeight: 1280 }), false);
  assert.equal(bossCombatImageHasExpectedSize({ naturalWidth: 784, naturalHeight: 1279 }), false);
  assert.equal(bossCombatImageHasExpectedSize(null), false);
});
