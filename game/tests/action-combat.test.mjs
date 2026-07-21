import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTION_FIXED_STEP_MS,
  ActionCombatKernel,
  calculateActionDamage,
  cooldownMultiplierForLevel,
  createActionCombat,
  levelAdjustedCooldownMs,
} from '../action-combat.mjs';

const ATTACKS = Object.freeze({
  slash: Object.freeze({
    name: 'Cinder Slash',
    delivery: 'cut',
    essence: 'ember',
    power: 10,
    windupMs: 40,
    activeMs: 40,
    recoveryMs: 60,
    cooldownMs: 800,
    hitbox: { offsetX: 12, offsetY: 0, width: 40, height: 48 },
  }),
  thrust: Object.freeze({
    name: 'Hunter Thrust',
    delivery: 'pierce',
    power: 8,
    windupMs: 20,
    activeMs: 20,
    recoveryMs: 40,
    hitbox: { offsetX: 12, offsetY: 0, width: 46, height: 40 },
  }),
});

function actors(overrides = {}) {
  return [
    {
      id: 'ren',
      faction: 'player',
      level: 1,
      hp: 200,
      maxHp: 200,
      power: 10,
      guard: 6,
      moveSpeed: 120,
      jumpSpeed: 200,
      gravity: 1000,
      offensiveCooldownMs: 400,
      position: { x: 100, y: 300 },
      attackIds: ['slash', 'thrust'],
      ...overrides.ren,
    },
    {
      id: 'oni',
      faction: 'enemy',
      ai: null,
      level: 1,
      hp: 200,
      maxHp: 200,
      power: 8,
      guard: 3,
      moveSpeed: 100,
      offensiveCooldownMs: 400,
      position: { x: 140, y: 300 },
      facing: 'left',
      attackIds: ['thrust'],
      resistances: {
        delivery: { cut: 1.25 },
        essence: { ember: 1.2 },
      },
      ...overrides.oni,
    },
  ];
}

function kernel(options = {}) {
  return createActionCombat({
    stage: { minX: 0, maxX: 500, minY: 0, maxY: 300, groundY: 300 },
    attacks: ATTACKS,
    actors: actors(options.actorOverrides),
    statusHooks: options.statusHooks,
    physicsHooks: options.physicsHooks,
    controlledActorId: options.controlledActorId,
    automaticVictory: options.automaticVictory,
  });
}

function partyKernel(options = {}) {
  const [ren, oni] = actors({
    ren: { position: { x: 100, y: 300 }, ...options.actorOverrides?.ren },
    oni: {
      ai: options.enemyAi ?? 'deterministic-chase',
      hp: 400,
      maxHp: 400,
      position: { x: 300, y: 300 },
      ...options.actorOverrides?.oni,
    },
  });
  return createActionCombat({
    stage: { minX: 0, maxX: 500, minY: 0, maxY: 300, groundY: 300 },
    attacks: ATTACKS,
    actors: [
      ren,
      {
        id: 'aya',
        faction: 'player',
        ai: 'deterministic-companion',
        level: 1,
        hp: 240,
        maxHp: 240,
        power: 9,
        guard: 5,
        moveSpeed: 110,
        offensiveCooldownMs: 400,
        position: { x: 80, y: 300 },
        attackIds: ['slash'],
        ...options.actorOverrides?.aya,
      },
      oni,
      ...(options.includeNeutral ? [{
        id: 'witness',
        faction: 'neutral',
        ai: null,
        hp: 50,
        maxHp: 50,
        moveSpeed: 1,
        position: { x: 110, y: 300 },
        attackIds: [],
      }] : []),
    ],
    controlledActorId: options.controlledActorId ?? 'ren',
    automaticVictory: options.automaticVictory,
  });
}

function actorSnapshot(engine, actorId) {
  return engine.snapshot().actors.find((actor) => actor.id === actorId);
}

test('cooldown level scaling is exact, bounded at 55%, and independent of animation durations', () => {
  assert.equal(cooldownMultiplierForLevel(1), 1);
  assert.equal(cooldownMultiplierForLevel(10), 0.8875);
  assert.equal(cooldownMultiplierForLevel(37), 0.55);
  assert.equal(cooldownMultiplierForLevel(99), 0.55);
  assert.equal(levelAdjustedCooldownMs(1000, 1), 1000);
  assert.equal(levelAdjustedCooldownMs(1000, 10), 888);
  assert.equal(levelAdjustedCooldownMs(1000, 37), 550);

  const levelOne = kernel();
  const levelThirtySeven = kernel({ actorOverrides: { ren: { level: 37 } } });
  assert.equal(levelOne.requestAttack('ren', 'slash').animationEndsAtMs, 140);
  assert.equal(levelThirtySeven.requestAttack('ren', 'slash').animationEndsAtMs, 140);
  levelOne.advance(140);
  levelThirtySeven.advance(140);
  assert.equal(actorSnapshot(levelOne, 'ren').attackCooldowns.slash, 800);
  assert.equal(actorSnapshot(levelThirtySeven, 'ren').attackCooldowns.slash, 440);
});

test('arbitrary elapsed chunks produce the same fixed-step side-view movement', () => {
  const whole = kernel();
  const chunked = kernel();
  whole.setMovement('ren', { x: 1 });
  chunked.setMovement('ren', { x: 1 });
  whole.advance(200);
  for (const elapsed of [7, 13, 41, 19, 63, 37, 20]) chunked.advance(elapsed);
  assert.deepEqual(chunked.snapshot(), whole.snapshot());
  assert.equal(actorSnapshot(whole, 'ren').position.x, 124);
  assert.equal(whole.snapshot().fixedStepMs, ACTION_FIXED_STEP_MS);
});

test('grounded movement supports deterministic jump, gravity, velocity, and landing', () => {
  const engine = kernel();
  assert.equal(actorSnapshot(engine, 'ren').grounded, true);
  assert.deepEqual(engine.requestJump('ren'), { ok: true, actorId: 'ren', velocityY: -200 });
  engine.advance(100);
  const airborne = actorSnapshot(engine, 'ren');
  assert.equal(airborne.grounded, false);
  assert.equal(airborne.position.y < 300, true);
  assert.equal(airborne.velocity.y, -100);
  assert.deepEqual(engine.requestJump('ren'), { ok: false, reason: 'airborne' });
  engine.advance(400);
  const landed = actorSnapshot(engine, 'ren');
  assert.equal(landed.grounded, true);
  assert.equal(landed.position.y, 300);
  assert.equal(landed.velocity.y, 0);
});

test('authored platform adapters can resolve a deterministic ground height', () => {
  const engine = kernel({
    actorOverrides: { ren: { position: { x: 100, y: 200 }, grounded: true } },
    physicsHooks: {
      resolveGround({ actor }) {
        return actor.id === 'ren' ? { groundY: 200 } : null;
      },
    },
  });
  engine.requestJump('ren');
  engine.advance(500);
  assert.equal(actorSnapshot(engine, 'ren').grounded, true);
  assert.equal(actorSnapshot(engine, 'ren').position.y, 200);
});

test('authored attack animation is the only locomotion lock; movement resumes on completion', () => {
  const engine = kernel();
  engine.setMovement('ren', { x: 1 });
  engine.advance(20);
  assert.equal(actorSnapshot(engine, 'ren').position.x, 102.4);
  assert.equal(engine.requestAttack('ren', 'slash').ok, true);
  assert.deepEqual(engine.requestJump('ren'), { ok: false, reason: 'animation-commitment' });

  engine.advance(120);
  assert.equal(actorSnapshot(engine, 'ren').position.x, 102.4);
  assert.equal(actorSnapshot(engine, 'ren').activeAttack.phase, 'recovery');
  engine.advance(20);
  const after = actorSnapshot(engine, 'ren');
  assert.equal(after.activeAttack, null);
  assert.equal(after.position.x, 104.8, 'held movement resumes on the exact completion step');
  assert.equal(after.offensiveCooldownRemainingMs, 400);
  assert.equal(after.attackCooldowns.slash, 800);
});

test('shared offensive timer prevents attack cycling while longer per-attack timer remains distinct', () => {
  const engine = kernel();
  engine.requestAttack('ren', 'slash');
  engine.advance(140);
  assert.deepEqual(engine.getAttackState('ren', 'thrust'), {
    actorId: 'ren',
    attackId: 'thrust',
    ready: false,
    reason: 'shared-offensive-cooldown',
    animationPhase: null,
    sharedCooldownRemainingMs: 400,
    individualCooldownRemainingMs: 0,
    effectiveCooldownRemainingMs: 400,
  });
  assert.deepEqual(engine.requestAttack('ren', 'thrust'), {
    ok: false,
    reason: 'shared-offensive-cooldown',
    remainingMs: 400,
  });

  engine.advance(400);
  assert.equal(engine.getAttackState('ren', 'thrust').ready, true);
  assert.equal(engine.getAttackState('ren', 'slash').ready, false);
  assert.equal(engine.getAttackState('ren', 'slash').individualCooldownRemainingMs, 400);
  assert.equal(engine.requestAttack('ren', 'thrust').ok, true);
});

test('active hitbox resolves once and preserves delivery, essence, HP, and audit data', () => {
  const engine = kernel();
  const preview = calculateActionDamage(engine.getActor('ren'), engine.getActor('oni'), ATTACKS.slash);
  assert.deepEqual(preview, {
    base: 19,
    deliveryMultiplier: 1.25,
    essenceMultiplier: 1.2,
    damage: 29,
  });

  engine.requestAttack('ren', 'slash');
  engine.advance(140);
  assert.equal(actorSnapshot(engine, 'oni').hp, 171);
  const events = engine.drainEvents();
  const hits = events.filter((event) => event.type === 'hit');
  const resolutions = events.filter((event) => event.type === 'hitbox-resolved');
  assert.equal(hits.length, 1);
  assert.equal(resolutions.length, 1);
  assert.deepEqual(resolutions[0].targetIds, ['oni']);
  assert.equal(hits[0].deliveryMultiplier, 1.25);
  assert.equal(hits[0].essenceMultiplier, 1.2);
  assert.equal(hits[0].hpBefore, 200);
  assert.equal(hits[0].hpAfter, 171);
});

test('opaque statuses and deterministic status hooks extend movement and hit resolution', () => {
  const engine = kernel({
    actorOverrides: { ren: { statuses: [{ id: 'fury', stacks: 1 }] } },
    statusHooks: {
      modifyMovement({ actor, speed }) {
        return actor.statuses.some(({ id }) => id === 'fury') ? speed * 0.5 : speed;
      },
      modifyDamage({ attacker, resolution }) {
        return attacker.statuses.some(({ id }) => id === 'fury')
          ? { damage: resolution.damage + 3 }
          : resolution;
      },
      afterHit({ target }) {
        target.statuses.push({ id: 'scorched', remainingMs: 600 });
      },
    },
  });
  engine.setMovement('ren', { x: 1 });
  engine.advance(20);
  assert.equal(actorSnapshot(engine, 'ren').position.x, 101.2);
  engine.requestAttack('ren', 'slash');
  engine.advance(140);
  assert.equal(actorSnapshot(engine, 'oni').hp, 168);
  assert.deepEqual(actorSnapshot(engine, 'oni').statuses, [{ id: 'scorched', remainingMs: 600 }]);
});

test('deterministic enemy chase, attack choice, and events replay identically across chunking', () => {
  const options = {
    actorOverrides: {
      ren: { position: { x: 100, y: 300 } },
      oni: { ai: 'deterministic-chase', position: { x: 300, y: 300 } },
    },
  };
  const whole = kernel(options);
  const chunked = kernel(options);
  whole.advance(2400);
  for (const elapsed of [133, 7, 260, 401, 99, 500, 1000]) chunked.advance(elapsed);
  assert.deepEqual(chunked.snapshot(), whole.snapshot());
  assert.deepEqual(chunked.drainEvents(), whole.drainEvents());
  assert.equal(actorSnapshot(whole, 'ren').hp < 200, true);
});

test('exactly one party actor accepts player input and tag switching preserves live actor state', () => {
  const engine = partyKernel({ enemyAi: null });
  assert.equal(engine.snapshot().controlledActorId, 'ren');
  assert.deepEqual(engine.setMovement('aya', { x: 1 }), {
    ok: false,
    reason: 'not-controlled-actor',
    controlledActorId: 'ren',
  });
  assert.deepEqual(engine.requestJump('aya'), {
    ok: false,
    reason: 'not-controlled-actor',
    controlledActorId: 'ren',
  });
  assert.deepEqual(engine.requestAttack('aya', 'slash'), {
    ok: false,
    reason: 'not-controlled-actor',
    controlledActorId: 'ren',
  });

  assert.equal(engine.requestAttack('ren', 'slash').ok, true);
  engine.advance(20);
  const actorsDuringCommitment = engine.snapshot().actors;
  assert.equal(actorSnapshot(engine, 'ren').activeAttack.phase, 'windup');
  assert.deepEqual(engine.switchControlledActor('aya'), {
    ok: true,
    changed: true,
    previousActorId: 'ren',
    controlledActorId: 'aya',
  });
  assert.deepEqual(engine.snapshot().actors, actorsDuringCommitment,
    'switching changes input authority without touching HP, position, cooldown, or animation state');
  assert.equal(engine.snapshot().controlledActorId, 'aya');
  assert.equal(engine.setMovement('aya', { x: -1 }).ok, true);
  assert.equal(engine.setMovement('ren', { x: 1 }).reason, 'not-controlled-actor');

  engine.advance(120);
  const actorsWithCooldown = engine.snapshot().actors;
  assert.equal(actorSnapshot(engine, 'ren').offensiveCooldownRemainingMs, 400);
  assert.equal(engine.setControlledActor('ren').ok, true);
  assert.deepEqual(engine.snapshot().actors, actorsWithCooldown,
    'switching back does not reset the former actor cooldown');
  const switchEvents = engine.drainEvents().filter(({ type }) => type === 'control-switch');
  assert.deepEqual(switchEvents.map(({ previousActorId, actorId, reason }) => ({ previousActorId, actorId, reason })), [
    { previousActorId: 'ren', actorId: 'aya', reason: 'player-request' },
    { previousActorId: 'aya', actorId: 'ren', reason: 'player-request' },
  ]);
});

test('companion and enemy AI are deterministic, target only hostile factions, and ignore neutral actors', () => {
  const options = { includeNeutral: true };
  const whole = partyKernel(options);
  const chunked = partyKernel(options);
  whole.advance(2400);
  for (const elapsed of [133, 7, 260, 401, 99, 500, 1000]) chunked.advance(elapsed);
  assert.deepEqual(chunked.snapshot(), whole.snapshot());
  const wholeEvents = whole.drainEvents();
  assert.deepEqual(chunked.drainEvents(), wholeEvents);

  const companionDecisions = wholeEvents.filter(({ type }) => type === 'companion-decision');
  const enemyDecisions = wholeEvents.filter(({ type }) => type === 'enemy-decision');
  assert.equal(companionDecisions.length > 0, true);
  assert.equal(enemyDecisions.length > 0, true);
  assert.equal(companionDecisions.every(({ actorId, targetId }) => actorId === 'aya' && targetId === 'oni'), true);
  assert.equal(enemyDecisions.every(({ actorId, targetId }) => actorId === 'oni' && ['ren', 'aya'].includes(targetId)), true);
  assert.equal(wholeEvents.some(({ type, targetId }) => type === 'hit' && targetId === 'witness'), false);
  assert.equal(actorSnapshot(whole, 'witness').hp, 50);
});

test('a defeated controlled actor deterministically transfers control to the next living party actor', () => {
  const engine = partyKernel({ enemyAi: null });
  engine.getActor('ren').hp = 0;
  engine.step();
  assert.equal(engine.snapshot().controlledActorId, 'aya');
  assert.equal(engine.snapshot().outcome, null);
  assert.equal(engine.setMovement('aya', { x: 1 }).ok, true);
  assert.deepEqual(engine.drainEvents().filter(({ type }) => type === 'control-switch').map((event) => ({
    previousActorId: event.previousActorId,
    actorId: event.actorId,
    reason: event.reason,
  })), [{ previousActorId: 'ren', actorId: 'aya', reason: 'actor-defeated' }]);
});

test('objective-driven battles can suppress automatic victory and conclude explicitly without suppressing defeat', () => {
  const objectiveBattle = partyKernel({ automaticVictory: false, enemyAi: null });
  objectiveBattle.getActor('oni').hp = 0;
  objectiveBattle.step();
  assert.equal(objectiveBattle.snapshot().automaticVictory, false);
  assert.equal(objectiveBattle.snapshot().outcome, null);
  assert.deepEqual(objectiveBattle.conclude('retreat'), { ok: false, reason: 'invalid-outcome' });
  assert.deepEqual(objectiveBattle.conclude('victory'), { ok: true, outcome: 'victory' });
  assert.equal(objectiveBattle.snapshot().outcome, 'victory');
  assert.deepEqual(objectiveBattle.conclude('defeat'), {
    ok: false,
    reason: 'combat-ended',
    outcome: 'victory',
  });

  const wipedParty = partyKernel({ automaticVictory: false, enemyAi: null });
  wipedParty.getActor('ren').hp = 0;
  wipedParty.getActor('aya').hp = 0;
  wipedParty.getActor('oni').hp = 0;
  wipedParty.step();
  assert.equal(wipedParty.snapshot().controlledActorId, null);
  assert.equal(wipedParty.snapshot().outcome, 'defeat', 'party wipe wins over a simultaneous hostile wipe');
});

test('attack animation timings must align to the fixed step', () => {
  assert.throws(() => new ActionCombatKernel({
    attacks: {
      bad: {
        power: 1,
        windupMs: 15,
        activeMs: 20,
        recoveryMs: 20,
        hitbox: { width: 10, height: 10 },
      },
    },
    actors: [{ id: 'actor', faction: 'player', hp: 1, attackIds: ['bad'] }],
  }), /multiple of fixed step 20ms/);
});
