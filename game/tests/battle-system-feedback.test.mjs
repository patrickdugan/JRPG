import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { CampaignCombatEngine } from '../campaign-combat.mjs';

import {
  BATTLE_SYSTEM_FEEDBACK_MS,
  createBattleDamageOutcomeFeedback,
  createBattleDefeatAccent,
  createBattleHealFeedback,
  createBattleMoveFeedback,
  createBattleStanceDodgeFeedback,
  createBattleTelegraphEvadeFeedback,
  createBattleTempoPresentation,
  createBattleVictoryAccent,
  createRecoveryLockFeedback,
  createSelectedTargetFeedback,
  sampleBattleDamageOutcomeFeedback,
  sampleBattleHealFeedback,
  sampleBattleMoveFeedback,
  sampleBattleStanceDodgeFeedback,
  sampleBattleTelegraphEvadeFeedback,
  sampleRecoveryLockFeedback,
} from '../battle-system-feedback.mjs';

function damageSnapshots(event, {
  beforeHp = 100,
  afterHp = event.targetHp,
  beforeLog = [],
  afterEvents = [event],
} = {}) {
  return {
    beforeSnapshot: {
      actors: [
        { instanceId: event.attackerId, name: 'Attacker', faction: 'party', hp: 80, pos: { x: 2, y: 3 } },
        { instanceId: event.targetId, name: 'Target', faction: 'enemy', hp: beforeHp, pos: { x: 5, y: 2 } },
      ],
      log: beforeLog,
    },
    afterSnapshot: {
      actors: [
        { instanceId: event.attackerId, name: 'Attacker', faction: 'party', hp: 80, pos: { x: 2, y: 3 } },
        { instanceId: event.targetId, name: 'Target', faction: 'enemy', hp: afterHp, pos: { x: 5, y: 2 } },
      ],
      log: [...beforeLog, ...afterEvents],
    },
  };
}

function damageEvent(overrides = {}) {
  return {
    type: 'damage', attackerId: 'aya', targetId: 'oni-1', skillId: 'warding-script',
    base: 20, deliveryMultiplier: 1, essenceMultiplier: 1, typedDamage: 20,
    absorbed: false, finalDamage: 20, guarded: false, targetHp: 80, pulse: 4,
    ...overrides,
  };
}

function healSnapshots({
  beforeHp = 31,
  maxHp = 100,
  amount = 18,
  afterHp = beforeHp + amount,
  pulse = 4,
  sourceOverrides = {},
  beforeTargetOverrides = {},
  afterTargetOverrides = {},
  beforeLog = [],
  afterEvents = null,
  item = false,
  stockBefore = 2,
  consumptionBefore = 0,
} = {}) {
  const source = {
    instanceId: 'aya', name: 'Aya', faction: 'party', hp: 80, maxHp: 80,
    active: true, pos: { x: 2, y: 3 }, statuses: [], ...sourceOverrides,
  };
  const beforeTarget = {
    instanceId: 'ren', name: 'Ren', faction: 'party', hp: beforeHp, maxHp,
    active: true, pos: { x: 3, y: 3 }, statuses: [], ...beforeTargetOverrides,
  };
  const afterTarget = { ...beforeTarget, hp: afterHp, ...afterTargetOverrides };
  const heal = {
    type: 'heal', sourceActorId: source.instanceId, targetId: beforeTarget.instanceId,
    amount, hpBefore: beforeHp, targetHp: beforeHp + amount, pulse,
    ...(item ? { source: 'item', itemId: 'river-salve' } : {}),
  };
  const itemUsed = item ? {
    type: 'item-used', actorId: source.instanceId, targetId: beforeTarget.instanceId,
    itemId: 'river-salve', stockBefore, stockAfter: stockBefore - 1,
    recoveryPulses: 2, pulse,
  } : null;
  const events = afterEvents ?? [...(item ? [itemUsed] : []), heal];
  return {
    heal,
    itemUsed,
    beforeSnapshot: {
      nowPulse: pulse,
      actors: [source, beforeTarget],
      log: beforeLog,
      ...(item ? {
        itemStock: { 'river-salve': stockBefore },
        itemConsumption: { 'river-salve': consumptionBefore },
      } : {}),
    },
    afterSnapshot: {
      nowPulse: pulse,
      actors: [source, afterTarget],
      log: [...beforeLog, ...events],
      ...(item ? {
        itemStock: { 'river-salve': stockBefore - 1 },
        itemConsumption: { 'river-salve': consumptionBefore + 1 },
      } : {}),
    },
  };
}

function itemHealResolution(snapshots, overrides = {}) {
  return {
    ok: true,
    ...snapshots.heal,
    actorId: snapshots.itemUsed.actorId,
    stockBefore: snapshots.itemUsed.stockBefore,
    stockAfter: snapshots.itemUsed.stockAfter,
    recoveryPulses: snapshots.itemUsed.recoveryPulses,
    ...overrides,
  };
}

function dodgeSnapshots({
  eventOverrides = {},
  skillOverrides = {},
  attackerOverrides = {},
  beforeTargetOverrides = {},
  afterTargetOverrides = {},
  beforeLog = [{ type: 'dodge', actorId: 'lise', recoveryPulses: 1, pulse: 2 }],
  afterEvents = null,
} = {}) {
  const event = {
    type: 'dodge-resolved', attackerId: 'oni-1', targetId: 'lise', skillId: 'tetsubo-hew',
    base: 24, deliveryMultiplier: 1, essenceMultiplier: 1, typedDamage: 24, absorbed: false,
    hit: false, dodged: true, guarded: false, finalDamage: 0, targetHp: 108,
    statusId: null, statusApplied: false, pulse: 3,
    ...eventOverrides,
  };
  const attacker = {
    instanceId: 'oni-1', name: 'Ashen Oni', faction: 'enemy', hp: 90, stance: 'neutral', pos: { x: 6, y: 2 },
    power: 14,
    skills: [{ id: 'tetsubo-hew', name: 'Tetsubo Hew', delivery: 'crush', power: 13, dodgeable: true, ...skillOverrides }],
    ...attackerOverrides,
  };
  const beforeTarget = {
    instanceId: 'lise', name: 'Lise Varga', faction: 'party', hp: 108, stance: 'dodge', pos: { x: 2, y: 2 },
    guard: 10, resistances: { delivery: { crush: 1 }, essence: {} }, statuses: [],
    ...beforeTargetOverrides,
  };
  const afterTarget = { ...beforeTarget, stance: 'neutral', ...afterTargetOverrides };
  return {
    event,
    beforeSnapshot: { actors: [attacker, beforeTarget], log: beforeLog },
    afterSnapshot: {
      actors: [attacker, afterTarget],
      log: [...beforeLog, ...(afterEvents ?? [event, { type: 'enemy-activation', actorId: attacker.instanceId, pulse: 3 }])],
    },
  };
}

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

test('generic heal feedback requires one exact appended event and matching explicit resolution', () => {
  const { beforeSnapshot, afterSnapshot, heal } = healSnapshots();
  const record = createBattleHealFeedback({
    resolution: { ok: true, ...heal },
    beforeSnapshot,
    afterSnapshot,
    startedAt: 500,
    speed: 2,
  });
  assert.equal(record.kind, 'heal');
  assert.equal(record.amount, 18);
  assert.deepEqual(record.sourceTile, { x: 2, y: 3 });
  assert.deepEqual(record.targetTile, { x: 3, y: 3 });
  assert.equal(record.targetHpBefore, 31);
  assert.equal(record.targetHpAfter, 49);
  assert.equal(record.durationMs, BATTLE_SYSTEM_FEEDBACK_MS.heal / 2);
  assert.equal(record.announcement, 'Aya restores 18 HP to Ren at 3,3.');
  assert.equal(Object.isFrozen(record), true);

  const frame = sampleBattleHealFeedback(record, 680);
  assert.equal(frame.progress, 0.5);
  assert.equal(frame.routeProgress, 1);
  assert.equal(sampleBattleHealFeedback(record, record.endsAt), null);
  assert.deepEqual(
    sampleBattleHealFeedback(record, 501, { reducedMotion: true }),
    sampleBattleHealFeedback(record, 859, { reducedMotion: true }),
  );
  assert.equal(createBattleHealFeedback({ beforeSnapshot, afterSnapshot })?.kind, 'heal',
    'the exact appended generic event is independently sufficient authority');
  assert.equal(createBattleHealFeedback({
    resolution: { ok: true, type: 'heal', sourceActorId: 'aya', targetId: 'ren' },
    beforeSnapshot,
    afterSnapshot,
  }), null, 'a supplied generic resolution must carry the same exact HP boundary');
  const missingPulse = structuredClone(afterSnapshot);
  delete missingPulse.log[0].pulse;
  assert.equal(createBattleHealFeedback({ beforeSnapshot, afterSnapshot: missingPulse }), null);
});

test('River Salve feedback is capped by authored HP recovery and exact attempt stock evidence', () => {
  const snapshots = healSnapshots({ item: true, amount: 69, afterHp: 100 });
  const record = createBattleHealFeedback({
    resolution: itemHealResolution(snapshots),
    beforeSnapshot: snapshots.beforeSnapshot,
    afterSnapshot: snapshots.afterSnapshot,
  });
  assert.equal(record?.kind, 'heal');
  assert.equal(record?.amount, 69, '31 HP plus the authored 80 HP effect caps at 100');
  assert.equal(record?.targetHpBefore, 31);
  assert.equal(record?.targetHpAfter, 100);
});

test('River Salve reports its heal event rather than a later exact Scorch net delta', () => {
  const scorch = {
    id: 'scorch', sourceActorId: 'abbot-1', sourceSkillId: 'forge-sermon', appliedAtPulse: 1,
    durationActivations: 1, remainingActivations: 1, activeThisActivation: false,
  };
  const snapshots = healSnapshots({
    item: true,
    beforeHp: 20,
    amount: 80,
    afterHp: 95,
    beforeTargetOverrides: { statuses: [scorch] },
  });
  const triggered = {
    type: 'status-triggered', statusId: 'scorch', actorId: 'ren',
    sourceActorId: 'abbot-1', sourceSkillId: 'forge-sermon', remainingActivations: 1, pulse: 5,
  };
  const statusDamage = {
    type: 'status-damage', statusId: 'scorch', targetId: 'ren',
    sourceActorId: 'abbot-1', sourceSkillId: 'forge-sermon', baseDamage: 5,
    finalDamage: 5, hpBefore: 100, targetHp: 95, pulse: 5,
  };
  snapshots.afterSnapshot.nowPulse = 5;
  snapshots.afterSnapshot.log = [
    snapshots.itemUsed,
    snapshots.heal,
    { type: 'commit', actorId: 'aya', command: 'item', readyAtPulse: 6, pulse: 4 },
    triggered,
    statusDamage,
  ];

  const record = createBattleHealFeedback({
    resolution: itemHealResolution(snapshots),
    beforeSnapshot: snapshots.beforeSnapshot,
    afterSnapshot: snapshots.afterSnapshot,
  });
  assert.equal(record?.amount, 80);
  assert.equal(record?.targetHpBefore, 20);
  assert.equal(record?.targetHpAfter, 100, 'feedback preserves HP at the heal event, not final 95 HP');
  assert.equal(record?.announcement, 'Aya restores 80 HP to Ren at 3,3.');

  const malformed = [
    { events: [snapshots.itemUsed, snapshots.heal, statusDamage], message: 'Scorch damage needs its exact trigger' },
    { events: [snapshots.itemUsed, snapshots.heal, statusDamage, triggered], message: 'Scorch damage must follow its trigger' },
    { events: [snapshots.itemUsed, snapshots.heal, triggered, { ...statusDamage, hpBefore: 99, targetHp: 94 }], message: 'Scorch continues the ordered HP cursor' },
    { events: [snapshots.itemUsed, snapshots.heal, { ...triggered, sourceActorId: 'oni-1' }, statusDamage], message: 'Scorch trigger retains pre-existing source authority' },
    { events: [snapshots.itemUsed, snapshots.heal, triggered], message: 'Scorch trigger cannot omit authored activation damage' },
  ];
  for (const fixture of malformed) {
    assert.equal(createBattleHealFeedback({
      resolution: itemHealResolution(snapshots),
      beforeSnapshot: snapshots.beforeSnapshot,
      afterSnapshot: { ...snapshots.afterSnapshot, log: fixture.events },
    }), null, fixture.message);
  }
});

test('River Salve feedback survives the real engine cadence that activates a pre-existing Scorch', () => {
  const encounter = {
    id: 'item-status-feedback', levelId: 'item-status-feedback-level', format: 'battle',
    objective: { type: 'defeatAll', text: 'Defeat all.' },
    party: {
      roster: ['ren', 'aya'],
      deployment: [{ actorId: 'ren', at: '1,3' }, { actorId: 'aya', at: '2,3' }],
    },
    enemies: [{
      id: 'dummy', name: 'Dummy', count: 1, positions: ['4,3'], ledger: 'Test.',
      stats: { hp: 40, power: 6, guard: 3, speed: 10 },
      resistances: {
        delivery: { cut: 1, pierce: 1, crush: 1, arcane: 1 },
        essence: { ember: 1, frost: 1, storm: 1, radiance: 1, umbral: 1 },
      },
      skills: [{
        id: 'poke', name: 'Poke', delivery: 'pierce', power: 4, range: 1,
        recoveryPulses: 1, dodgeable: true,
      }],
    }],
  };
  const level = {
    id: encounter.levelId, width: 6, height: 6, blocked: [], terrain: [], spawn: { x: 0, y: 0 },
  };
  const engine = new CampaignCombatEngine({ encounter, level, itemStock: { 'river-salve': 1 } });
  engine.getActor('aya').hp = 20;
  engine.getActor('aya').statuses.push({
    id: 'scorch', sourceActorId: 'abbot-1', sourceSkillId: 'forge-sermon', appliedAtPulse: 0,
    durationActivations: 1, remainingActivations: 1, activeThisActivation: false,
  });
  const beforeSnapshot = engine.snapshot();
  const result = engine.useItem('ren', 'river-salve', 'aya');
  const afterSnapshot = engine.snapshot();

  assert.deepEqual(afterSnapshot.log.slice(beforeSnapshot.log.length).map((event) => event.type), [
    'item-used', 'heal', 'commit', 'status-triggered', 'status-damage',
  ]);
  assert.equal(result.targetHp, 96, 'the engine result retains the heal-event HP');
  assert.equal(afterSnapshot.actors.find((actor) => actor.instanceId === 'aya').hp, 91);
  const record = createBattleHealFeedback({ resolution: result, beforeSnapshot, afterSnapshot });
  assert.equal(record?.amount, 76);
  assert.equal(record?.targetHpBefore, 20);
  assert.equal(record?.targetHpAfter, 96, 'later Scorch cannot rewrite the heal feedback record');
});

test('River Salve heal authority fails closed on forged catalogue, inventory, relation, pulse, or HP evidence', () => {
  const valid = healSnapshots({ item: true, amount: 69, afterHp: 100 });
  const cases = [
    { mutate: ({ heal }) => { heal.pulse = 1.5; }, message: 'pulse must be a safe integer' },
    { mutate: ({ heal }) => { heal.pulse = -1; }, message: 'pulse cannot be negative' },
    { mutate: ({ heal }) => { heal.pulse = Number.MAX_SAFE_INTEGER + 1; }, message: 'pulse cannot exceed safe integer authority' },
    { mutate: ({ itemUsed }) => { itemUsed.actorId = 'ren'; }, message: 'item and heal source must match' },
    { mutate: ({ itemUsed }) => { itemUsed.targetId = 'aya'; }, message: 'item and heal target must match' },
    { mutate: ({ itemUsed }) => { itemUsed.itemId = 'spirit-tea'; }, message: 'item IDs must match' },
    { mutate: ({ itemUsed }) => { itemUsed.stockAfter = itemUsed.stockBefore; }, message: 'stock must decrement exactly once' },
    { mutate: ({ itemUsed }) => { itemUsed.recoveryPulses = 1; }, message: 'Recovery comes from authored battle metadata' },
    { mutate: ({ heal }) => { heal.amount = 68; heal.targetHp = 99; }, message: 'amount must equal the capped catalogue effect' },
    { mutate: ({ heal }) => { heal.hpBefore = 30; heal.targetHp = 99; }, message: 'event must begin at snapshot HP' },
    { mutate: ({ heal }) => { heal.targetHp = 101; heal.amount = 70; }, message: 'event cannot exceed max HP' },
    { mutate: ({ heal }) => { heal.itemId = 'traveler-plum'; }, message: 'an unopted mixed-effect consumable is not battle heal authority' },
    { mutate: ({ heal }) => { heal.source = 'skill'; }, message: 'battle item healing requires an explicit item source' },
    { mutate: ({ beforeSnapshot }) => { beforeSnapshot.itemStock['river-salve'] = 3; }, message: 'stock event needs snapshot corroboration' },
    { mutate: ({ afterSnapshot }) => { afterSnapshot.itemConsumption['river-salve'] = 2; }, message: 'consumption must advance once' },
    { mutate: ({ afterSnapshot }) => { afterSnapshot.actors[1].hp = 99; }, message: 'final cursor must match the snapshot' },
    { mutate: ({ afterSnapshot }) => { afterSnapshot.log.reverse(); }, message: 'item-used must immediately precede heal' },
    { mutate: ({ afterSnapshot }) => { afterSnapshot.log.push({ type: 'damage', attackerId: 'oni', targetId: 'ren', absorbed: true, finalDamage: -1, pulse: 4 }); }, message: 'absorbed damage cannot join heal authority' },
  ];
  for (const fixture of cases) {
    const mutated = structuredClone(valid);
    fixture.mutate(mutated);
    assert.equal(createBattleHealFeedback({
      resolution: itemHealResolution(mutated),
      beforeSnapshot: mutated.beforeSnapshot,
      afterSnapshot: mutated.afterSnapshot,
    }), null, fixture.message);
  }
  assert.equal(createBattleHealFeedback({
    resolution: itemHealResolution(valid, { amount: 68, targetHp: 99 }),
    beforeSnapshot: valid.beforeSnapshot,
    afterSnapshot: valid.afterSnapshot,
  }), null, 'the explicit result must match the appended heal event exactly');
});

test('absorption and generic positive status never masquerade as heal feedback', () => {
  const beforeSnapshot = {
    nowPulse: 4,
    actors: [
      { instanceId: 'aya', name: 'Aya', hp: 80, maxHp: 80, pos: { x: 2, y: 3 }, statuses: [] },
      { instanceId: 'furnace', name: 'Furnace Abbot', hp: 100, maxHp: 130, pos: { x: 6, y: 2 }, statuses: [] },
    ],
    log: [],
  };
  const afterSnapshot = {
    nowPulse: 4,
    actors: [
      { instanceId: 'aya', name: 'Aya', hp: 80, maxHp: 80, pos: { x: 2, y: 3 }, statuses: [] },
      { instanceId: 'furnace', name: 'Furnace Abbot', hp: 118, maxHp: 130, pos: { x: 6, y: 2 }, statuses: [] },
    ],
    log: [{ type: 'damage', attackerId: 'aya', targetId: 'furnace', absorbed: true, finalDamage: -18, pulse: 4 }],
  };
  assert.equal(createBattleHealFeedback({
    resolution: { ok: true, attackerId: 'aya', targetId: 'furnace', absorbed: true, finalDamage: -18 },
    beforeSnapshot,
    afterSnapshot,
  }), null);
  assert.equal(createBattleHealFeedback({
    resolution: { ok: true, type: 'status-applied', sourceActorId: 'aya', targetId: 'furnace', statusId: 'ward' },
    beforeSnapshot,
    afterSnapshot,
  }), null);
});

test('heal feedback cannot be inferred from a divergent snapshot log suffix', () => {
  const beforeSnapshot = {
    nowPulse: 4,
    actors: [
      { instanceId: 'aya', name: 'Aya', hp: 80, maxHp: 80, pos: { x: 2, y: 3 }, statuses: [] },
      { instanceId: 'ren', name: 'Ren', hp: 31, maxHp: 100, pos: { x: 3, y: 3 }, statuses: [] },
    ],
    log: [{ type: 'unrelated-before', pulse: 1 }],
  };
  const afterSnapshot = {
    nowPulse: 4,
    actors: [
      { instanceId: 'aya', name: 'Aya', hp: 80, maxHp: 80, pos: { x: 2, y: 3 }, statuses: [] },
      { instanceId: 'ren', name: 'Ren', hp: 49, maxHp: 100, pos: { x: 3, y: 3 }, statuses: [] },
    ],
    log: [
      { type: 'different-prefix', pulse: 1 },
      { type: 'heal', sourceActorId: 'aya', targetId: 'ren', amount: 18, hpBefore: 31, targetHp: 49, pulse: 4 },
    ],
  };
  assert.equal(createBattleHealFeedback({
    resolution: { ok: true, type: 'status-applied', sourceActorId: 'aya', targetId: 'ren' },
    beforeSnapshot,
    afterSnapshot,
  }), null);
});

test('typed damage feedback preserves weakness, Guard, Ward, exact percentages, and snapshots', () => {
  const event = damageEvent({
    base: 24,
    essenceMultiplier: 1.25,
    typedDamage: 30,
    finalDamage: 4,
    guarded: true,
    incomingDamageMultiplier: 0.25,
    targetHp: 96,
  });
  const snapshots = damageSnapshots(event, { beforeHp: 100, afterHp: 96 });
  const beforeCopy = JSON.parse(JSON.stringify(snapshots));
  const record = createBattleDamageOutcomeFeedback({ ...snapshots, startedAt: 200, speed: 2 });
  assert.equal(record.kind, 'damage-outcome');
  assert.equal(record.durationMs, BATTLE_SYSTEM_FEEDBACK_MS['damage-outcome'] / 2);
  assert.equal(record.endsAt, 560);
  assert.equal(record.entries.length, 1);
  assert.deepEqual(record.entries[0], {
    attackerId: 'aya', attackerName: 'Attacker', targetId: 'oni-1', targetName: 'Target',
    skillId: 'warding-script', targetTile: { x: 5, y: 2 }, outcome: 'weak',
    base: 24, typedDamage: 30, finalDamage: 4, damageAmount: 4, restoreAmount: 0,
    targetHpBefore: 100, targetHpAfter: 96,
    deliveryMultiplier: 1, essenceMultiplier: 1.25, affinityMultiplier: 1.25,
    deliveryPercent: 100, essencePercent: 125, affinityPercent: 125,
    guarded: true, incomingDamageMultiplier: 0.25, wardPercent: 25,
    displayValue: '4', outcomeLabel: 'WEAK',
    announcement: 'Attacker deals 4 damage to Target with warding-script (100% delivery, 125% essence, Guard, Ward 25%). Weakness.',
  });
  assert.equal(Object.isFrozen(record.entries[0].targetTile), true);
  assert.deepEqual(snapshots, beforeCopy, 'presentation cannot mutate engine snapshots');
});

test('typed damage outcomes distinguish neutral, resist, immune, absorption, and a nonlethal zero', () => {
  const cases = [
    { event: damageEvent(), beforeHp: 100, afterHp: 80, outcome: 'neutral', displayValue: '20', label: '' },
    {
      event: damageEvent({ deliveryMultiplier: 0.75, essenceMultiplier: 0.75, typedDamage: 11, finalDamage: 11, targetHp: 89 }),
      beforeHp: 100, afterHp: 89, outcome: 'resist', displayValue: '11', label: 'RESIST', affinityPercent: 56.25,
    },
    {
      event: damageEvent({ essenceMultiplier: 0, typedDamage: 0, finalDamage: 0, targetHp: 100 }),
      beforeHp: 100, afterHp: 100, outcome: 'immune', displayValue: '0', label: 'IMMUNE',
    },
    {
      event: damageEvent({ essenceMultiplier: -1, typedDamage: -20, absorbed: true, finalDamage: -12, targetHp: 112 }),
      beforeHp: 100, afterHp: 112, outcome: 'absorb', displayValue: '+12 HP', label: 'ABSORB',
    },
    {
      event: damageEvent({ essenceMultiplier: -1, typedDamage: -20, absorbed: true, finalDamage: -0, targetHp: 100 }),
      beforeHp: 100, afterHp: 100, outcome: 'absorb', displayValue: '+0 HP', label: 'ABSORB',
    },
    {
      event: damageEvent({ essenceMultiplier: 1.25, typedDamage: 25, finalDamage: 0, targetHp: 100 }),
      beforeHp: 100, afterHp: 100, outcome: 'weak', displayValue: '0', label: 'WEAK',
    },
  ];
  for (const item of cases) {
    const record = createBattleDamageOutcomeFeedback(damageSnapshots(item.event, item));
    assert.equal(record.entries[0].outcome, item.outcome);
    assert.equal(record.entries[0].displayValue, item.displayValue);
    assert.equal(record.entries[0].outcomeLabel, item.label);
    if (item.affinityPercent !== undefined) assert.equal(record.entries[0].affinityPercent, item.affinityPercent);
  }
});

test('typed damage feedback keeps exact event order across multiple targets and later status damage', () => {
  const first = damageEvent({ attackerId: 'mateus-1', targetId: 'lise', skillId: 'crimson-litany', finalDamage: 20, targetHp: 80 });
  const second = damageEvent({ attackerId: 'mateus-1', targetId: 'ren', skillId: 'crimson-litany', finalDamage: 10, targetHp: 70 });
  const statusDamage = { type: 'status-damage', targetId: 'lise', finalDamage: 3, targetHp: 77, statusId: 'scorch' };
  const beforeSnapshot = {
    actors: [
      { instanceId: 'mateus-1', name: 'Mateus', faction: 'enemy', hp: 200, pos: { x: 6, y: 3 } },
      { instanceId: 'lise', name: 'Lise', faction: 'party', hp: 100, pos: { x: 3, y: 2 } },
      { instanceId: 'ren', name: 'Ren', faction: 'party', hp: 80, pos: { x: 4, y: 2 } },
    ],
    log: [{ type: 'intent-answered', intentId: 'crimson-litany-1' }],
  };
  const afterSnapshot = {
    actors: [
      beforeSnapshot.actors[0],
      { ...beforeSnapshot.actors[1], hp: 77 },
      { ...beforeSnapshot.actors[2], hp: 70 },
    ],
    log: [...beforeSnapshot.log, first, second, statusDamage],
  };
  const record = createBattleDamageOutcomeFeedback({ beforeSnapshot, afterSnapshot });
  assert.deepEqual(record.entries.map(({ targetId }) => targetId), ['lise', 'ren']);
  assert.deepEqual(record.entries.map(({ targetHpBefore, targetHpAfter }) => [targetHpBefore, targetHpAfter]), [[100, 80], [80, 70]]);
  assert.match(record.announcement, /^Mateus deals 20 damage to Lise.*Mateus deals 10 damage to Ren/s);
});

test('typed damage feedback fails closed on divergent, malformed, or uncorroborated authority', () => {
  const event = damageEvent();
  const snapshots = damageSnapshots(event, { beforeLog: [{ type: 'prior', pulse: 1 }] });
  assert.equal(createBattleDamageOutcomeFeedback({
    beforeSnapshot: snapshots.beforeSnapshot,
    afterSnapshot: { ...snapshots.afterSnapshot, log: [{ type: 'different', pulse: 1 }, event] },
  }), null);
  assert.equal(createBattleDamageOutcomeFeedback(damageSnapshots({ ...event, essenceMultiplier: Number.NaN })), null);
  assert.equal(createBattleDamageOutcomeFeedback(damageSnapshots({ ...event, attackerId: '' })), null);
  assert.equal(createBattleDamageOutcomeFeedback({
    ...snapshots,
    afterSnapshot: { ...snapshots.afterSnapshot, actors: snapshots.afterSnapshot.actors.map((actor) => (
      actor.instanceId === event.targetId ? { ...actor, hp: 79 } : actor
    )) },
  }), null, 'after HP must match the typed event transition');
  assert.equal(createBattleDamageOutcomeFeedback({
    beforeSnapshot: { actors: snapshots.beforeSnapshot.actors, log: [] },
    afterSnapshot: { actors: snapshots.beforeSnapshot.actors, log: [{ type: 'message', text: '20 WEAK damage' }] },
  }), null, 'damage prose cannot authorize feedback');
  assert.equal(createBattleDamageOutcomeFeedback(damageSnapshots({
    ...event, essenceMultiplier: 0, typedDamage: 0, finalDamage: 1, targetHp: 99,
  }, { beforeHp: 100, afterHp: 99 })), null, 'zero affinity with nonzero damage is malformed');
  assert.equal(createBattleDamageOutcomeFeedback(damageSnapshots({
    ...event, typedDamage: 20, finalDamage: -20, targetHp: 120,
  }, { beforeHp: 100, afterHp: 120 })), null, 'positive affinity cannot restore HP');
  assert.equal(createBattleDamageOutcomeFeedback(damageSnapshots({
    ...event, typedDamage: 20, finalDamage: 21, targetHp: 79,
  }, { beforeHp: 100, afterHp: 79 })), null, 'final damage cannot exceed typed damage');
  assert.equal(createBattleDamageOutcomeFeedback(damageSnapshots({
    ...event, essenceMultiplier: -1, typedDamage: -20, absorbed: true, finalDamage: -30, targetHp: 130,
  }, { beforeHp: 100, afterHp: 130 })), null, 'absorbed healing cannot exceed typed absorption');
});

test('typed damage sampling expires exactly and reduced motion holds one static frame', () => {
  const event = damageEvent();
  const record = createBattleDamageOutcomeFeedback({ ...damageSnapshots(event), startedAt: 100, speed: 1 });
  assert.equal(sampleBattleDamageOutcomeFeedback(record, 99), null);
  const middle = sampleBattleDamageOutcomeFeedback(record, 460);
  assert.equal(middle.progress, 0.5);
  assert.equal(middle.entries[0].riseTiles, 0.65);
  assert.equal(sampleBattleDamageOutcomeFeedback(record, 820), null);
  assert.deepEqual(
    sampleBattleDamageOutcomeFeedback(record, 101, { reducedMotion: true }),
    sampleBattleDamageOutcomeFeedback(record, 819, { reducedMotion: true }),
  );
  assert.throws(() => createBattleDamageOutcomeFeedback({ ...damageSnapshots(event), speed: 3 }), /speed must be 1, 2, or 4/i);
});

test('stance Dodge feedback requires the exact authored engine result and unchanged target state', () => {
  const snapshots = dodgeSnapshots();
  const beforeCopy = JSON.parse(JSON.stringify(snapshots));
  const record = createBattleStanceDodgeFeedback({
    beforeSnapshot: snapshots.beforeSnapshot,
    afterSnapshot: snapshots.afterSnapshot,
    startedAt: 100,
    speed: 2,
  });

  assert.equal(record.kind, 'stance-dodge');
  assert.equal(record.durationMs, BATTLE_SYSTEM_FEEDBACK_MS['stance-dodge'] / 2);
  assert.equal(record.endsAt, 460);
  assert.deepEqual(record, {
    kind: 'stance-dodge',
    attackerId: 'oni-1', attackerName: 'Ashen Oni', attackerTile: { x: 6, y: 2 },
    targetId: 'lise', targetName: 'Lise Varga', targetTile: { x: 2, y: 2 },
    skillId: 'tetsubo-hew', skillName: 'Tetsubo Hew', delivery: 'crush', typedDamage: 24,
    targetHp: 108, sidestepVector: { x: 0, y: -1 }, displayLabel: 'DODGE',
    announcement: 'Lise Varga dodges Tetsubo Hew from Ashen Oni. Dodge consumed.',
    baseDurationMs: 720, durationMs: 360, startedAt: 100, endsAt: 460, presentationSpeed: 2,
  });
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.targetTile), true);
  assert.deepEqual(snapshots, beforeCopy, 'Dodge presentation cannot mutate engine snapshots');
  assert.notEqual(record.kind, createBattleTelegraphEvadeFeedback({
    beforeSnapshot: { actors: [], log: [] },
    afterSnapshot: { actors: [], log: [] },
  })?.kind ?? 'telegraph-evaded');
});

test('stance Dodge feedback fails closed on divergent logs, false stances, ineligible skills, HP changes, or outcome events', () => {
  const valid = dodgeSnapshots();
  assert.equal(createBattleStanceDodgeFeedback({
    beforeSnapshot: valid.beforeSnapshot,
    afterSnapshot: { ...valid.afterSnapshot, log: [{ type: 'different' }, valid.event] },
  }), null, 'the prior log must be an exact prefix');

  for (const fixture of [
    dodgeSnapshots({ beforeTargetOverrides: { stance: 'neutral' } }),
    dodgeSnapshots({ afterTargetOverrides: { stance: 'dodge' } }),
    dodgeSnapshots({ skillOverrides: { dodgeable: false } }),
    dodgeSnapshots({ eventOverrides: { dodged: false } }),
    dodgeSnapshots({ eventOverrides: { hit: true } }),
    dodgeSnapshots({ eventOverrides: { guarded: true } }),
    dodgeSnapshots({ eventOverrides: { finalDamage: 1 } }),
    dodgeSnapshots({ eventOverrides: { statusApplied: true } }),
    dodgeSnapshots({ eventOverrides: { pulse: -1 } }),
    dodgeSnapshots({ eventOverrides: { pulse: 1.5 } }),
    dodgeSnapshots({ eventOverrides: { pulse: undefined } }),
    dodgeSnapshots({ eventOverrides: { base: 25 } }),
    dodgeSnapshots({ eventOverrides: { deliveryMultiplier: 0.5 } }),
    dodgeSnapshots({ eventOverrides: { essenceMultiplier: 0.5 } }),
    dodgeSnapshots({ eventOverrides: { typedDamage: 12 } }),
    dodgeSnapshots({ eventOverrides: { absorbed: true } }),
    dodgeSnapshots({ attackerOverrides: { power: 15 } }),
    dodgeSnapshots({ attackerOverrides: { skills: {} } }),
    dodgeSnapshots({ skillOverrides: { power: 14 } }),
    dodgeSnapshots({ beforeTargetOverrides: { guard: 13 } }),
    dodgeSnapshots({ beforeTargetOverrides: { resistances: { delivery: { crush: 0.5 }, essence: {} } } }),
    dodgeSnapshots({ beforeTargetOverrides: { statuses: {} } }),
    dodgeSnapshots({ afterTargetOverrides: { hp: 107 } }),
    dodgeSnapshots({ afterTargetOverrides: { pos: { x: 2, y: 3 } } }),
  ]) {
    assert.equal(createBattleStanceDodgeFeedback(fixture), null);
  }

  assert.equal(createBattleStanceDodgeFeedback(
    dodgeSnapshots({ skillOverrides: { delivery: 'arcane' } }),
  )?.delivery, 'arcane', 'explicit authored dodgeability, not inferred delivery, is authoritative');

  const damage = dodgeSnapshots();
  damage.afterSnapshot.log.splice(1, 0, {
    type: 'damage', attackerId: 'oni-1', targetId: 'lise', skillId: 'tetsubo-hew',
    base: 24, deliveryMultiplier: 1, essenceMultiplier: 1, typedDamage: 24,
    absorbed: false, finalDamage: 0, guarded: false, targetHp: 108,
  });
  assert.equal(createBattleStanceDodgeFeedback(damage), null, 'a Dodge cannot coexist with a damage event');

  const targetStatus = dodgeSnapshots();
  targetStatus.afterSnapshot.log.splice(1, 0, { type: 'status-applied', targetId: 'lise', statusId: 'shock' });
  assert.equal(createBattleStanceDodgeFeedback(targetStatus), null, 'a Dodge cannot apply its target status');

  const selfStatus = dodgeSnapshots();
  selfStatus.afterSnapshot.log.splice(1, 0, { type: 'status-applied', targetId: 'oni-1', statusId: 'overheated' });
  assert.equal(createBattleStanceDodgeFeedback(selfStatus)?.kind, 'stance-dodge', 'an independently authored attacker self-status remains valid');

  assert.throws(() => createBattleStanceDodgeFeedback({ ...valid, speed: 3 }), /speed must be 1, 2, or 4/i);
});

test('stance Dodge feedback accepts only an authoritative later status activation through an ordered HP cursor', () => {
  const scorch = {
    id: 'scorch', sourceActorId: 'abbot-1', sourceSkillId: 'forge-sermon', appliedAtPulse: 1,
    durationActivations: 1, remainingActivations: 1, activeThisActivation: false,
  };
  const snapshots = dodgeSnapshots({ beforeTargetOverrides: { statuses: [scorch] } });
  const triggered = {
    type: 'status-triggered', statusId: 'scorch', actorId: 'lise',
    sourceActorId: 'abbot-1', sourceSkillId: 'forge-sermon', remainingActivations: 1, pulse: 4,
  };
  const statusDamage = {
    type: 'status-damage', statusId: 'scorch', targetId: 'lise',
    sourceActorId: 'abbot-1', sourceSkillId: 'forge-sermon', baseDamage: 5,
    finalDamage: 5, hpBefore: 108, targetHp: 103, pulse: 4,
  };
  snapshots.afterSnapshot.actors[1].hp = 103;
  snapshots.afterSnapshot.actors[1].statuses = [{ ...scorch, activeThisActivation: true }];
  snapshots.afterSnapshot.log = [
    ...snapshots.beforeSnapshot.log,
    snapshots.event,
    { type: 'enemy-activation', actorId: 'oni-1', pulse: 3 },
    triggered,
    statusDamage,
  ];

  const record = createBattleStanceDodgeFeedback(snapshots);
  assert.equal(record?.kind, 'stance-dodge');
  assert.equal(record?.targetHp, 108, 'the Dodge record preserves HP at the dodge-resolved event');

  const malformed = [
    { events: [snapshots.event, statusDamage], message: 'status damage needs its pre-existing status trigger' },
    { events: [triggered, snapshots.event, statusDamage], message: 'the trigger must follow the Dodge event' },
    { events: [snapshots.event, { ...triggered, statusId: 'dread' }, statusDamage], message: 'the trigger must name a pre-existing status' },
    { events: [snapshots.event, triggered, { ...statusDamage, sourceActorId: 'oni-1' }], message: 'status damage must preserve source authority' },
    { events: [snapshots.event, triggered, { ...statusDamage, baseDamage: 4, finalDamage: 4, targetHp: 104 }], message: 'status damage must match its authored definition' },
    { events: [snapshots.event, triggered, { ...statusDamage, hpBefore: 107, targetHp: 102 }], message: 'status damage must continue the HP cursor' },
    { events: [snapshots.event, triggered], message: 'an activation-damage trigger cannot omit its damage event' },
  ];
  for (const fixture of malformed) {
    assert.equal(createBattleStanceDodgeFeedback({
      beforeSnapshot: snapshots.beforeSnapshot,
      afterSnapshot: { ...snapshots.afterSnapshot, log: [...snapshots.beforeSnapshot.log, ...fixture.events] },
    }), null, fixture.message);
  }

  assert.equal(createBattleStanceDodgeFeedback({
    beforeSnapshot: snapshots.beforeSnapshot,
    afterSnapshot: { ...snapshots.afterSnapshot, actors: snapshots.afterSnapshot.actors.map((actor) => (
      actor.instanceId === 'lise' ? { ...actor, hp: 102 } : actor
    )) },
  }), null, 'the ordered cursor must end at the after snapshot HP');
});

test('stance Dodge feedback survives the engine cadence that activates a pre-existing Scorch after the miss', () => {
  const encounter = {
    id: 'dodge-status-feedback', levelId: 'dodge-status-feedback-level', format: 'battle',
    objective: { type: 'defeatAll', text: 'Defeat all.' },
    party: { roster: ['ren'], deployment: [{ actorId: 'ren', at: '1,3' }] },
    enemies: [{
      id: 'dummy', name: 'Dummy', count: 1, positions: ['2,3'], ledger: 'Test.',
      stats: { hp: 40, power: 6, guard: 3, speed: 10 },
      resistances: {
        delivery: { cut: 1, pierce: 1, crush: 1, arcane: 1 },
        essence: { ember: 1, frost: 1, storm: 1, radiance: 1, umbral: 1 },
      },
      skills: [{
        id: 'poke', name: 'Poke', delivery: 'pierce', power: 4, range: 1,
        recoveryPulses: 1, dodgeable: true,
      }],
    }],
  };
  const level = {
    id: encounter.levelId, width: 6, height: 6, blocked: [], terrain: [], spawn: { x: 0, y: 0 },
  };
  const engine = new CampaignCombatEngine({ encounter, level });
  engine.getActor('ren').statuses.push({
    id: 'scorch', sourceActorId: 'abbot-1', sourceSkillId: 'forge-sermon', appliedAtPulse: 0,
    durationActivations: 1, remainingActivations: 1, activeThisActivation: false,
  });
  assert.equal(engine.dodge('ren').ok, true);
  const beforeSnapshot = engine.snapshot();
  const result = engine.resolveEnemyActivation();
  const afterSnapshot = engine.snapshot();

  assert.equal(result.resolution.dodged, true);
  assert.equal(beforeSnapshot.actors.find((actor) => actor.instanceId === 'ren').hp, 118);
  assert.equal(afterSnapshot.actors.find((actor) => actor.instanceId === 'ren').hp, 113);
  assert.deepEqual(afterSnapshot.log.slice(beforeSnapshot.log.length).map((event) => event.type), [
    'dodge-resolved', 'enemy-activation', 'status-triggered', 'status-damage',
  ]);
  assert.equal(createBattleStanceDodgeFeedback({ beforeSnapshot, afterSnapshot })?.kind, 'stance-dodge');
});

test('stance Dodge sampling expires exactly and removes sidestep motion under reduced motion', () => {
  const snapshots = dodgeSnapshots();
  const record = createBattleStanceDodgeFeedback({ ...snapshots, startedAt: 100 });
  assert.equal(sampleBattleStanceDodgeFeedback(record, 99), null);
  const middle = sampleBattleStanceDodgeFeedback(record, 460);
  assert.equal(middle.kind, 'stance-dodge');
  assert.equal(middle.displayLabel, 'DODGE');
  assert.equal(middle.sidestepTiles, 0.18);
  assert.deepEqual(middle.sidestepVector, { x: 0, y: -1 });
  assert.equal(sampleBattleStanceDodgeFeedback(record, 820), null);
  const reducedEarly = sampleBattleStanceDodgeFeedback(record, 101, { reducedMotion: true });
  const reducedLate = sampleBattleStanceDodgeFeedback(record, 819, { reducedMotion: true });
  assert.deepEqual(reducedLate, reducedEarly);
  assert.equal(reducedEarly.sidestepTiles, 0);
  assert.equal(reducedEarly.progress, 0.5);
  assert.equal(reducedEarly.reducedMotion, true);
});

test('telegraph evasion requires an exact typed resolved-intent delta and party targets', () => {
  const published = {
    type: 'intent-published', intentId: 'crimson-litany-1', targetIdsAtPublish: ['lise'], pulse: 3,
  };
  const beforeSnapshot = {
    actors: [{ instanceId: 'lise', name: 'Lise Varga', faction: 'party', hp: 108, pos: { x: 3, y: 3 } }],
    log: [published],
  };
  const resolved = {
    type: 'intent-resolved', intentId: 'crimson-litany-1', hitTargetIds: [],
    avoidedTargetIds: ['lise'], aftermath: { recoveryPulses: 3 }, pulse: 4,
  };
  const afterSnapshot = {
    actors: [{ instanceId: 'lise', name: 'Lise Varga', faction: 'party', hp: 108, pos: { x: 3, y: 4 } }],
    log: [published, resolved],
  };
  const record = createBattleTelegraphEvadeFeedback({
    beforeSnapshot, afterSnapshot, startedAt: 200, speed: 2,
  });
  assert.equal(record.kind, 'telegraph-evaded');
  assert.equal(record.intentId, 'crimson-litany-1');
  assert.equal(record.durationMs, BATTLE_SYSTEM_FEEDBACK_MS['telegraph-evaded'] / 2);
  assert.deepEqual(record.targets, [{ actorId: 'lise', actorName: 'Lise Varga', tile: { x: 3, y: 4 } }]);
  assert.match(record.announcement, /Telegraph evaded/);
  assert.equal(Object.isFrozen(record.targets[0].tile), true);

  assert.equal(createBattleTelegraphEvadeFeedback({
    beforeSnapshot,
    afterSnapshot: { ...afterSnapshot, log: [{ ...published, pulse: 99 }, resolved] },
  }), null, 'a divergent log prefix cannot authorize presentation');
  assert.equal(createBattleTelegraphEvadeFeedback({
    beforeSnapshot,
    afterSnapshot: { ...afterSnapshot, log: [published, { ...resolved, avoidedTargetIds: [] }] },
  }), null, 'a fully hit line is not evasion');
  assert.equal(createBattleTelegraphEvadeFeedback({
    beforeSnapshot,
    afterSnapshot: {
      actors: [{ ...afterSnapshot.actors[0], faction: 'enemy' }],
      log: [published, resolved],
    },
  }), null, 'enemy IDs cannot masquerade as party telegraph evasion');
});

test('telegraph evasion expires exactly and freezes its exact-tile cue for reduced motion', () => {
  const record = {
    kind: 'telegraph-evaded', intentId: 'crimson-litany-1',
    targets: [{ actorId: 'lise', tile: { x: 3, y: 4 } }],
    startedAt: 100, durationMs: 720, endsAt: 820,
  };
  assert.equal(sampleBattleTelegraphEvadeFeedback(record, 99), null);
  const frame = sampleBattleTelegraphEvadeFeedback(record, 460);
  assert.equal(frame.kind, 'telegraph-evaded');
  assert.equal(frame.pulse, 1);
  assert.equal(frame.sidestep, 0.18);
  assert.deepEqual(frame.targets, [{ actorId: 'lise', tile: { x: 3, y: 4 }, direction: 1 }]);
  assert.equal(sampleBattleTelegraphEvadeFeedback(record, 820), null);
  assert.deepEqual(
    sampleBattleTelegraphEvadeFeedback(record, 101, { reducedMotion: true }),
    sampleBattleTelegraphEvadeFeedback(record, 819, { reducedMotion: true }),
  );
});

test('victory accent follows only the actual terminal victory result and freezes for reduced motion', () => {
  assert.equal(createBattleVictoryAccent({ result: null, bossMechanic: { resolution: { kind: 'nonlethal-surrender' } } }), null);
  assert.equal(createBattleVictoryAccent({ result: 'defeat', log: [{ type: 'surrender' }] }), null);
  const ordinary = createBattleVictoryAccent({ result: 'victory' }, { visualNowMs: 300 });
  assert.equal(ordinary.kind, 'victory-accent');
  assert.equal(ordinary.result, 'victory');
  assert.equal(Object.isFrozen(ordinary), true);
  const nonlethalVictory = createBattleVictoryAccent({
    result: 'victory',
    bossMechanic: { resolution: { kind: 'nonlethal-surrender' } },
  });
  assert.equal(nonlethalVictory.kind, 'victory-accent', 'a surrender only qualifies once current rules resolve it as player victory');
  assert.deepEqual(
    createBattleVictoryAccent({ result: 'victory' }, { visualNowMs: 1, reducedMotion: true }),
    createBattleVictoryAccent({ result: 'victory' }, { visualNowMs: 1_199, reducedMotion: true }),
  );
});

test('defeat accent follows only the actual terminal defeat result and freezes for reduced motion', () => {
  assert.equal(createBattleDefeatAccent({ result: null, actors: [{ faction: 'party', hp: 0 }] }), null);
  assert.equal(createBattleDefeatAccent({ result: 'victory', log: [{ type: 'party-defeated' }] }), null);
  const snapshot = { result: 'defeat', actors: [{ instanceId: 'ren', hp: 0 }] };
  const ordinary = createBattleDefeatAccent(snapshot, { visualNowMs: 400 });
  assert.equal(ordinary.kind, 'defeat-accent');
  assert.equal(ordinary.result, 'defeat');
  assert.equal(ordinary.announcement, 'Party defeated.');
  assert.equal(Object.isFrozen(ordinary), true);
  assert.equal(Object.isFrozen(snapshot), false);
  assert.deepEqual(snapshot, { result: 'defeat', actors: [{ instanceId: 'ren', hp: 0 }] });
  assert.notEqual(ordinary.kind, createBattleVictoryAccent({ result: 'victory' }).kind);
  assert.deepEqual(
    createBattleDefeatAccent({ result: 'defeat' }, { visualNowMs: 1, reducedMotion: true }),
    createBattleDefeatAccent({ result: 'defeat' }, { visualNowMs: 1_599, reducedMotion: true }),
  );
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
  assert.match(source, /createBattleHealFeedback\(\{/);
  assert.match(source, /sampleBattleHealFeedback\(activeBattleSystemFeedback, now, \{ reducedMotion: reducedMotion\.matches \}\)/);
  assert.match(source, /createBattleDamageOutcomeFeedback\(\{ beforeSnapshot, afterSnapshot, startedAt, speed \}\)/);
  assert.match(source, /sampleBattleDamageOutcomeFeedback\(activeBattleDamageFeedback, now, \{/);
  assert.match(source, /function drawBattleDamageOutcomeFeedback\(/);
  assert.match(source, /drawBattleDamageOutcomeFeedback\(damageFeedback, geometry\)/);
  assert.match(source, /createBattleTelegraphEvadeFeedback\(\{ beforeSnapshot, afterSnapshot, startedAt, speed \}\)/);
  assert.match(source, /sampleBattleTelegraphEvadeFeedback\(activeBattleSystemFeedback, now, \{ reducedMotion: reducedMotion\.matches \}\)/);
  assert.match(source, /startBattleTelegraphEvadeSystemFeedback\(before, after, \{ startedAt: now, speed: speedMultiplier \}\)/,
    'Auto-Grind consumes the same exact typed telegraph delta');
  assert.match(source, /startBattleTelegraphEvadeSystemFeedback\(snapshot, afterSnapshot, \{ startedAt: presentationStartedAt, speed: 1 \}\)/,
    'manual commands consume the same exact typed telegraph delta');
  assert.match(source, /startBattleDamageOutcomeFeedback\(before, after, \{ startedAt: now, speed: speedMultiplier \}\)/,
    'Auto-Grind consumes the exact typed damage delta');
  assert.match(source, /startBattleDamageOutcomeFeedback\(snapshot, afterSnapshot, \{ startedAt: presentationStartedAt, speed: 1 \}\)/,
    'manual party commands consume the exact typed damage delta');
  const manualEnemyResolution = source.slice(
    source.indexOf('function tick(now)'),
    source.indexOf('requestAnimationFrame(tick);'),
  );
  assert.match(manualEnemyResolution, /const after = engine\.snapshot\(\);[\s\S]*?startBattleDamageOutcomeFeedback\(before, after, \{ startedAt: now, speed: 1 \}\)/,
    'manual enemy activations consume the exact typed damage delta');
  const combatAnimationSource = source.slice(
    source.indexOf('function startCombatAnimation('),
    source.indexOf('function currentBattleAnimationFrame('),
  );
  assert.ok(
    combatAnimationSource.indexOf('const startedAt = performance.now();')
      > combatAnimationSource.indexOf('const timeline ='),
    'animation timing begins only after timeline preparation',
  );
  assert.ok(
    combatAnimationSource.indexOf('const healFeedback = startBattleHealSystemFeedback(')
      > combatAnimationSource.indexOf('const startedAt = performance.now();'),
    'heal presentation shares the restored post-preparation animation timestamp',
  );
  assert.match(source, /startBattleHealSystemFeedback\(result, snapshot, afterSnapshot, \{ startedAt: presentationStartedAt, speed: 1 \}\)/,
    'manual Item consumes the same exact heal authority at its command-presentation timestamp');
  assert.match(source, /function drawBattleVictoryAccent\(/);
  assert.match(source, /drawBattleVictoryAccent\(victoryAccent, geometry\)/);
  assert.match(source, /createBattleDefeatAccent\(snapshot, \{/);
  assert.match(source, /function drawBattleDefeatAccent\(/);
  assert.match(source, /context\.rect\(geometry\.originX, geometry\.originY, geometry\.boardWidth, geometry\.boardHeight\);\s+context\.clip\(\);/,
    'defeat accent remains clipped to the battle canvas board');
  assert.match(source, /drawBattleDefeatAccent\(defeatAccent, geometry\)/);
  assert.doesNotMatch(source, /result\.finalDamage < 0[^\n]*combatHeal/,
    'absorbed damage cannot trigger the heal cue');
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
  assert.match(source, /activeBattleDamageFeedback = null/);
  assert.doesNotMatch(source, /getBattlePresentationBoundary\([^)]*activeBattleSystemFeedback/,
    'system feedback cannot delay commands, Recovery, intent, or Auto-Grind');
  assert.doesNotMatch(source, /getBattlePresentationBoundary\([^)]*activeBattleDamageFeedback/,
    'damage flyouts cannot delay commands, Recovery, intent, or Auto-Grind');
  const playtimeAccounting = source.slice(
    source.indexOf('const countableElapsed = getBattlePresentationElapsedMs({'),
    source.indexOf('if (!inactive && countableElapsed > 0)'),
  );
  assert.doesNotMatch(playtimeAccounting, /activeBattleDamageFeedback/,
    'damage flyouts cannot join playtime accounting');
  assert.doesNotMatch(source, /getBattlePresentationBoundary\([^)]*victoryAccent/,
    'victory accent cannot extend the terminal hold or settlement boundary');
  assert.doesNotMatch(source, /getBattlePresentationBoundary\([^)]*defeatAccent/,
    'defeat accent cannot extend the terminal hold or settlement boundary');
  assert.doesNotMatch(source, /getBattlePresentationBoundary\([^)]*telegraph/,
    'telegraph evasion feedback cannot extend intent, Recovery, or Auto-Grind timing');
});
