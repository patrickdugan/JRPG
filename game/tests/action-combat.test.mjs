import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTION_COMPANION_AI,
  ACTION_FIXED_STEP_MS,
  ACTION_HIT_FLASH_MS,
  ACTION_HIT_INVULNERABILITY_MS,
  ACTION_HIT_STUN_MS,
  ACTION_KNOCKBACK_SPEED_X,
  ACTION_MOVEMENT_PROFILES,
  ACTION_TAG_COOLDOWN_MS,
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
      ai: Object.hasOwn(options, 'enemyAi') ? options.enemyAi : 'deterministic-chase',
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
    physicsHooks: options.physicsHooks,
  });
}

function actorSnapshot(engine, actorId) {
  return engine.snapshot().actors.find((actor) => actor.id === actorId);
}

test('deterministic sentries telegraph at range without erasing an immovable encounter role', () => {
  const engine = partyKernel({
    enemyAi: 'deterministic-sentry',
    actorOverrides: {
      ren: { position: { x: 40, y: 300 } },
      aya: { position: { x: 60, y: 300 } },
      oni: { position: { x: 440, y: 300 } },
    },
  });
  engine.advance(20);
  const sentry = actorSnapshot(engine, 'oni');
  assert.equal(sentry.position.x, 440);
  assert.equal(sentry.activeAttack?.attackId, 'thrust');
  assert.equal(engine.drainEvents().some(({ type, actorId, action }) => (
    type === 'enemy-decision' && actorId === 'oni' && action === 'attack'
  )), true);
  engine.advance(100);
  assert.equal(actorSnapshot(engine, 'oni').position.x, 440);
  assert.equal(actorSnapshot(engine, 'ren').hp, 200);
});

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

test('dash responds on the next fixed step and travels an exact chunk-independent burst', () => {
  const whole = kernel();
  const chunked = kernel();
  for (const engine of [whole, chunked]) {
    engine.setMovement('ren', { x: 1 });
    assert.deepEqual(engine.requestManeuver('ren', 'dash'), {
      ok: true,
      actorId: 'ren',
      maneuverId: 'dash',
      startedAtMs: 0,
      direction: 1,
      durationMs: 120,
    });
  }
  whole.advance(120);
  for (const elapsed of [7, 13, 19, 21, 40, 20]) chunked.advance(elapsed);
  assert.deepEqual(chunked.snapshot(), whole.snapshot());
  const ren = actorSnapshot(whole, 'ren');
  assert.equal(ren.position.x, 143.2, 'six fixed steps move at exactly 3x actor speed');
  assert.equal(ren.activeManeuver, null);
  assert.equal(ren.velocity.x, 120, 'held walk speed resumes without a dead frame');
  assert.equal(ren.maneuverCooldowns.dash, 100);
  assert.deepEqual(whole.drainEvents().filter(({ type }) => type.startsWith('maneuver')).map(({ type, maneuverId, reason }) => ({
    type,
    maneuverId,
    reason,
  })), [
    { type: 'maneuver-start', maneuverId: 'dash', reason: undefined },
    { type: 'maneuver-complete', maneuverId: 'dash', reason: 'duration' },
  ]);
});

test('slide lowers the live hurtbox and exposes its jump cancel on the exact authored step', () => {
  const engine = kernel();
  engine.setMovement('ren', { x: 1 });
  assert.equal(engine.requestManeuver('ren', 'slide').ok, true);
  engine.advance(60);
  let ren = actorSnapshot(engine, 'ren');
  assert.equal(ren.activeManeuver.id, 'slide');
  assert.equal(ren.effectiveHurtbox.bottom - ren.effectiveHurtbox.top, 24);
  assert.deepEqual(engine.requestJump('ren'), { ok: false, reason: 'maneuver-commitment' });
  engine.advance(20);
  assert.deepEqual(engine.requestJump('ren'), { ok: true, actorId: 'ren', velocityY: -200 });
  ren = actorSnapshot(engine, 'ren');
  assert.equal(ren.activeManeuver, null);
  assert.equal(ren.grounded, false);
  assert.equal(ren.effectiveHurtbox.bottom - ren.effectiveHurtbox.top, 48);
  const cancel = engine.drainEvents().find(({ type, maneuverId }) => type === 'maneuver-complete' && maneuverId === 'slide');
  assert.deepEqual({ reason: cancel.reason, nextAction: cancel.nextAction, elapsedMs: cancel.elapsedMs }, {
    reason: 'cancelled',
    nextAction: 'jump',
    elapsedMs: 80,
  });
});

test('uppercut and thunder kick carry deterministic strike geometry through their movement arcs', () => {
  const uppercut = kernel();
  uppercut.setMovement('ren', { x: 1 });
  assert.equal(uppercut.requestManeuver('ren', 'uppercut').ok, true);
  uppercut.advance(80);
  const rising = actorSnapshot(uppercut, 'ren');
  assert.equal(rising.grounded, false);
  assert.equal(rising.position.y < 300, true);
  assert.equal(actorSnapshot(uppercut, 'oni').hp < 200, true);
  assert.equal(uppercut.drainEvents().filter(({ type, maneuverId }) => type === 'hit' && maneuverId === 'uppercut').length, 1);
  uppercut.advance(120);
  assert.equal(uppercut.drainEvents().filter(({ type, maneuverId }) => type === 'hit' && maneuverId === 'uppercut').length, 0,
    'one moving maneuver cannot damage the same target twice');

  const diving = kernel({
    actorOverrides: { ren: { position: { x: 100, y: 240 }, grounded: false, velocity: { x: 0, y: 0 } } },
  });
  diving.setMovement('ren', { x: 1 });
  assert.equal(diving.requestManeuver('ren', 'thunder-kick').ok, true);
  diving.advance(180);
  const landed = actorSnapshot(diving, 'ren');
  assert.equal(landed.grounded, true);
  assert.equal(landed.activeManeuver, null);
  assert.equal(landed.airDashUsesRemaining, 1);
  assert.equal(actorSnapshot(diving, 'oni').hp < 200, true);
  assert.equal(diving.drainEvents().filter(({ type, maneuverId }) => type === 'hit' && maneuverId === 'thunder-kick').length, 1);
});

test('dash-to-attack cancel, one-use air dash, variable jump, and landing buffer are explicit', () => {
  const cancelling = kernel();
  cancelling.setMovement('ren', { x: 1 });
  cancelling.requestManeuver('ren', 'dash');
  cancelling.advance(20);
  assert.deepEqual(cancelling.requestAttack('ren', 'slash'), { ok: false, reason: 'maneuver-commitment' });
  cancelling.advance(20);
  assert.equal(cancelling.requestAttack('ren', 'slash').ok, true);
  const cancel = cancelling.drainEvents().find(({ type, maneuverId }) => type === 'maneuver-complete' && maneuverId === 'dash');
  assert.equal(cancel.nextAction, 'attack');
  assert.equal(cancel.elapsedMs, 40);

  const airborne = kernel({
    actorOverrides: { ren: { position: { x: 100, y: 180 }, grounded: false, velocity: { x: 0, y: 0 } } },
  });
  airborne.setMovement('ren', { x: 1 });
  airborne.requestManeuver('ren', 'dash');
  airborne.advance(220);
  assert.deepEqual(airborne.requestManeuver('ren', 'dash'), {
    ok: false,
    reason: 'air-dash-spent',
    remainingMs: 0,
  });

  const held = kernel();
  const released = kernel();
  held.requestJump('ren');
  released.requestJump('ren');
  held.setJumpHeld('ren', true);
  released.setJumpHeld('ren', false);
  held.advance(100);
  released.advance(100);
  assert.equal(actorSnapshot(held, 'ren').position.y < actorSnapshot(released, 'ren').position.y, true,
    'holding jump yields a higher arc than releasing it');

  const buffered = kernel({
    actorOverrides: { ren: { position: { x: 100, y: 299 }, grounded: false, velocity: { x: 0, y: 120 } } },
  });
  assert.deepEqual(buffered.requestJump('ren', { buffer: true, held: true }), {
    ok: true,
    actorId: 'ren',
    buffered: true,
    windowMs: 120,
  });
  buffered.advance(20);
  assert.equal(actorSnapshot(buffered, 'ren').grounded, false);
  assert.equal(actorSnapshot(buffered, 'ren').velocity.y, -200, 'the buffered press fires on the landing step');
  assert.equal(buffered.drainEvents().some(({ type, reason }) => type === 'jump' && reason === 'buffered-landing'), true);
});

test('character movement profiles preserve the shared grammar while changing traversal physics', () => {
  const profileActor = (id, movementProfileId, position = { x: 100, y: 300 }, grounded = true) => ({
    id,
    faction: 'player',
    level: 1,
    hp: 100,
    maxHp: 100,
    moveSpeed: 120,
    position,
    grounded,
    attackIds: [],
    movementProfileId,
  });
  const createProfileKernel = (actor) => createActionCombat({
    stage: { minX: 0, maxX: 500, minY: 0, maxY: 300, groundY: 300 },
    attacks: {},
    actors: [actor],
    controlledActorId: actor.id,
    automaticVictory: false,
  });

  const ren = createProfileKernel(profileActor('ren', 'infiltrator'));
  const nikola = createProfileKernel(profileActor('lise', 'hunter'));
  const mateus = createProfileKernel(profileActor('mateus', 'vampire', { x: 100, y: 140 }, false));
  const miyo = createProfileKernel(profileActor('miyo', 'weather-scholar'));

  assert.deepEqual([
    actorSnapshot(ren, 'ren').movementProfileId,
    actorSnapshot(nikola, 'lise').movementProfileId,
    actorSnapshot(mateus, 'mateus').movementProfileId,
    actorSnapshot(miyo, 'miyo').movementProfileId,
  ], ['infiltrator', 'hunter', 'vampire', 'weather-scholar']);
  assert.deepEqual([
    actorSnapshot(ren, 'ren').moveSpeed,
    actorSnapshot(nikola, 'lise').moveSpeed,
    actorSnapshot(mateus, 'mateus').moveSpeed,
    actorSnapshot(miyo, 'miyo').moveSpeed,
  ], [141.6, 115.2, 117.6, 124.8]);
  assert.equal(ren.getManeuverDefinition('ren', 'dash').name, 'Roofline Rush');
  assert.equal(nikola.getManeuverDefinition('lise', 'dash').name, 'Hunter Step');
  assert.equal(mateus.getManeuverDefinition('mateus', 'dash').name, 'Night Passage');
  assert.equal(miyo.getManeuverDefinition('miyo', 'dash').name, 'Crosswind Step');
  assert.equal(nikola.getManeuverState('lise', 'dash').ready, true);

  assert.equal(miyo.requestJump('miyo').ok, true);
  miyo.advance(20);
  assert.equal(miyo.requestJump('miyo').ok, true, 'Miyo may spend one weather-lift air jump');
  assert.equal(actorSnapshot(miyo, 'miyo').airJumpUsesRemaining, 0);
  assert.equal(actorSnapshot(miyo, 'miyo').velocity.y, -ACTION_MOVEMENT_PROFILES['weather-scholar'].jumpSpeed);

  assert.equal(actorSnapshot(mateus, 'mateus').airDashUsesRemaining, 2);
  assert.equal(mateus.requestManeuver('mateus', 'dash').ok, true);
  assert.equal(actorSnapshot(mateus, 'mateus').airDashUsesRemaining, 1);
});

test('Ren alone can arrest a fall at a stage wall and rebound without a progression gate', () => {
  const wallKernel = (movementProfileId) => createActionCombat({
    stage: { minX: 0, maxX: 500, minY: 0, maxY: 300, groundY: 300 },
    attacks: {},
    actors: [{
      id: 'runner',
      faction: 'player',
      hp: 100,
      maxHp: 100,
      moveSpeed: 120,
      position: { x: 0, y: 180 },
      velocity: { x: 0, y: 180 },
      grounded: false,
      movementProfileId,
      attackIds: [],
    }],
    controlledActorId: 'runner',
    automaticVictory: false,
  });
  const ren = wallKernel('infiltrator');
  const ordinary = wallKernel('standard');
  ren.setMovement('runner', { x: -1 });
  ordinary.setMovement('runner', { x: -1 });
  ren.advance(20);
  ordinary.advance(20);
  assert.equal(actorSnapshot(ren, 'runner').wallContactSide, -1);
  assert.equal(actorSnapshot(ren, 'runner').velocity.y, ACTION_MOVEMENT_PROFILES.infiltrator.wallTechnique.clingFallSpeed);
  assert.equal(actorSnapshot(ordinary, 'runner').wallContactSide, null);
  assert.equal(actorSnapshot(ordinary, 'runner').velocity.y > actorSnapshot(ren, 'runner').velocity.y, true);

  assert.deepEqual(ren.requestJump('runner'), { ok: true, actorId: 'runner', wallJump: true, wallSide: -1 });
  ren.advance(20);
  const rebound = actorSnapshot(ren, 'runner');
  assert.equal(rebound.position.x > 0, true);
  assert.equal(rebound.velocity.x > 0, true);
  assert.equal(ren.drainEvents().some(({ type }) => type === 'wall-jump'), true);
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

test('a damaging hit applies fixed-step stun, knockback, flash, and post-hit invulnerability', () => {
  const engine = kernel();
  engine.requestAttack('ren', 'slash');
  engine.advance(40);

  const impacted = actorSnapshot(engine, 'oni');
  assert.equal(impacted.hitStunRemainingMs, ACTION_HIT_STUN_MS);
  assert.equal(impacted.hitInvulnerabilityRemainingMs, ACTION_HIT_INVULNERABILITY_MS);
  assert.equal(impacted.hitFlashRemainingMs, ACTION_HIT_FLASH_MS);
  assert.equal(impacted.knockbackVelocityX, ACTION_KNOCKBACK_SPEED_X);
  assert.equal(impacted.position.x, 143.2, 'knockback moves on the same deterministic fixed step');
  assert.equal(impacted.grounded, false, 'grounded victims receive the modest lift impulse');
  assert.deepEqual(engine.requestAttack('oni', 'thrust'), {
    ok: false,
    reason: 'hit-stun',
    remainingMs: ACTION_HIT_STUN_MS,
  });

  const hit = engine.drainEvents().find(({ type }) => type === 'hit');
  assert.equal(hit.hitStunMs, ACTION_HIT_STUN_MS);
  assert.equal(hit.invulnerabilityMs, ACTION_HIT_INVULNERABILITY_MS);
  assert.equal(hit.knockbackVelocityX, ACTION_KNOCKBACK_SPEED_X);

  engine.advance(ACTION_HIT_STUN_MS);
  const recovered = actorSnapshot(engine, 'oni');
  assert.equal(recovered.hitStunRemainingMs, 0);
  assert.equal(recovered.knockbackVelocityX, 0);
  assert.equal(recovered.hitInvulnerabilityRemainingMs,
    ACTION_HIT_INVULNERABILITY_MS - ACTION_HIT_STUN_MS);
  engine.advance(ACTION_HIT_INVULNERABILITY_MS - ACTION_HIT_STUN_MS);
  assert.equal(actorSnapshot(engine, 'oni').hitInvulnerabilityRemainingMs, 0);
});

test('post-hit invulnerability rejects overlapping independent hits but preserves linked combo hits', () => {
  const engine = createActionCombat({
    stage: { minX: 0, maxX: 500, minY: 0, maxY: 300, groundY: 300 },
    attacks: ATTACKS,
    actors: [
      actors()[0],
      { ...actors()[1], id: 'oni-a', position: { x: 100, y: 300 }, facing: 'right' },
      { ...actors()[1], id: 'oni-b', position: { x: 100, y: 300 }, facing: 'right' },
    ],
  });
  engine.requestAttack('oni-a', 'thrust');
  engine.requestAttack('oni-b', 'thrust');
  engine.advance(20);

  const impactEvents = engine.drainEvents().filter(({ type }) => ['hit', 'hit-ignored'].includes(type));
  assert.deepEqual(impactEvents.map(({ type, actorId, targetId, reason }) => ({
    type, actorId, targetId, reason,
  })), [
    { type: 'hit', actorId: 'oni-a', targetId: 'ren', reason: undefined },
    {
      type: 'hit-ignored',
      actorId: 'oni-b',
      targetId: 'ren',
      reason: 'post-hit-invulnerability',
    },
  ]);
  assert.equal(actorSnapshot(engine, 'ren').hp, impactEvents[0].hpAfter);

  const linked = partyKernel({
    enemyAi: null,
    actorOverrides: { oni: { ai: null, position: { x: 130, y: 300 } } },
  });
  linked.requestCombo('hunter-priest', 'ren', [
    { actorId: 'ren', attackId: 'slash' },
    { actorId: 'aya', attackId: 'slash' },
  ]);
  linked.advance(40);
  const linkedEvents = linked.drainEvents();
  assert.equal(linkedEvents.filter(({ type }) => type === 'hit').length, 2);
  assert.equal(linkedEvents.some(({ type }) => type === 'hit-ignored'), false);
});

test('hit stun pauses an authored attack phase without rewriting its animation or cooldown values', () => {
  const engine = kernel();
  engine.requestAttack('ren', 'slash');
  engine.requestAttack('oni', 'thrust');
  engine.advance(20);
  assert.equal(actorSnapshot(engine, 'ren').activeAttack.elapsedMs, 20);
  assert.equal(actorSnapshot(engine, 'ren').hitStunRemainingMs, ACTION_HIT_STUN_MS);

  engine.advance(80);
  assert.equal(actorSnapshot(engine, 'ren').activeAttack.elapsedMs, 20,
    'the committed frame is held for the readable hit-stun window');
  engine.advance(20);
  assert.equal(actorSnapshot(engine, 'ren').activeAttack.elapsedMs, 40);
  engine.advance(100);
  const recovered = actorSnapshot(engine, 'ren');
  assert.equal(recovered.activeAttack, null);
  assert.equal(recovered.offensiveCooldownRemainingMs, 400,
    'the unchanged authored shared cooldown starts only after animation completion');
  assert.equal(recovered.attackCooldowns.slash, 800);
});

test('diminishing armor remains useful without creating immunity and penetration stays bounded', () => {
  const attacker = { power: 30 };
  const attack = { power: 0, delivery: null, essence: null };
  const target = (guard) => ({ guard, resistances: { delivery: {}, essence: {} } });
  assert.equal(calculateActionDamage(attacker, target(0), attack).damage, 30);
  assert.equal(calculateActionDamage(attacker, target(60), attack).damage, 15);
  assert.equal(calculateActionDamage(attacker, target(180), attack).damage, 8);
  assert.equal(calculateActionDamage(attacker, target(60), { ...attack, guardPierce: 0.5 }).damage, 20);
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
  assert.equal(engine.snapshot().tagCooldownRemainingMs, ACTION_TAG_COOLDOWN_MS);
  assert.deepEqual(engine.setControlledActor('ren'), {
    ok: false,
    reason: 'tag-cooldown',
    remainingMs: ACTION_TAG_COOLDOWN_MS,
  });
  assert.equal(engine.setMovement('aya', { x: -1 }).ok, true);
  assert.equal(engine.setMovement('ren', { x: 1 }).reason, 'not-controlled-actor');

  engine.advance(ACTION_TAG_COOLDOWN_MS);
  const actorsWithCooldown = engine.snapshot().actors;
  assert.equal(actorSnapshot(engine, 'ren').offensiveCooldownRemainingMs, 280);
  assert.equal(engine.setControlledActor('ren').ok, true);
  assert.deepEqual(engine.snapshot().actors, actorsWithCooldown,
    'switching back does not reset the former actor cooldown');
  const switchEvents = engine.drainEvents().filter(({ type }) => type === 'control-switch');
  assert.deepEqual(switchEvents.map(({ previousActorId, actorId, reason }) => ({ previousActorId, actorId, reason })), [
    { previousActorId: 'ren', actorId: 'aya', reason: 'player-request' },
    { previousActorId: 'aya', actorId: 'ren', reason: 'player-request' },
  ]);
});

test('synchronized combos start atomically, retain provenance, and replay deterministically', () => {
  const participants = [
    { actorId: 'ren', attackId: 'slash' },
    { actorId: 'aya', attackId: 'slash' },
  ];
  const comboOptions = {
    enemyAi: null,
    actorOverrides: { oni: { ai: null, position: { x: 130, y: 300 } } },
  };
  const whole = partyKernel(comboOptions);
  const chunked = partyKernel(comboOptions);
  const expectedStart = {
    ok: true,
    comboId: 'hunter-priest',
    initiatorActorId: 'ren',
    startedAtMs: 0,
    participants,
  };
  assert.deepEqual(whole.requestCombo(' hunter-priest ', 'ren', participants), expectedStart);
  assert.deepEqual(chunked.requestCombo('hunter-priest', 'ren', participants), expectedStart);

  for (const engine of [whole, chunked]) {
    assert.deepEqual(actorSnapshot(engine, 'ren').activeAttack, {
      attackId: 'slash',
      elapsedMs: 0,
      hitboxResolved: false,
      startedAtMs: 0,
      comboId: 'hunter-priest',
      phase: 'windup',
    });
    assert.equal(actorSnapshot(engine, 'aya').activeAttack.comboId, 'hunter-priest');
    assert.equal(actorSnapshot(engine, 'aya').activeAttack.startedAtMs, 0);
  }

  whole.advance(140);
  for (const elapsed of [13, 7, 41, 19, 40, 20]) chunked.advance(elapsed);
  assert.deepEqual(chunked.snapshot(), whole.snapshot());
  const events = whole.drainEvents();
  assert.deepEqual(chunked.drainEvents(), events);
  assert.deepEqual(events.slice(0, 3).map((event) => ({
    type: event.type,
    nowMs: event.nowMs,
    comboId: event.comboId,
    actorId: event.actorId,
  })), [
    { type: 'combo-start', nowMs: 0, comboId: 'hunter-priest', actorId: undefined },
    { type: 'attack-start', nowMs: 0, comboId: 'hunter-priest', actorId: 'ren' },
    { type: 'attack-start', nowMs: 0, comboId: 'hunter-priest', actorId: 'aya' },
  ]);
  const comboStart = events.find(({ type }) => type === 'combo-start');
  assert.equal(comboStart.initiatorActorId, 'ren');
  assert.deepEqual(comboStart.participants, participants);
  assert.deepEqual(events.filter(({ type }) => type === 'attack-complete').map((event) => ({
    actorId: event.actorId,
    comboId: event.comboId,
  })), [
    { actorId: 'ren', comboId: 'hunter-priest' },
    { actorId: 'aya', comboId: 'hunter-priest' },
  ]);
  assert.equal(events
    .filter(({ type }) => type === 'hitbox-resolved')
    .every(({ comboId }) => comboId === 'hunter-priest'), true);
  assert.deepEqual(events.filter(({ type }) => type === 'hit').map((event) => ({
    actorId: event.actorId,
    targetId: event.targetId,
    comboId: event.comboId,
  })), [
    { actorId: 'ren', targetId: 'oni', comboId: 'hunter-priest' },
    { actorId: 'aya', targetId: 'oni', comboId: 'hunter-priest' },
  ]);
});

test('combo validation failures are atomic and emit no partial lifecycle events', () => {
  const validParticipants = [
    { actorId: 'ren', attackId: 'slash' },
    { actorId: 'aya', attackId: 'slash' },
  ];
  const cases = [
    {
      request: ['', 'ren', validParticipants],
      expected: { ok: false, reason: 'invalid-combo-id' },
    },
    {
      request: ['solo', 'ren', [validParticipants[0]]],
      expected: { ok: false, reason: 'invalid-participants' },
    },
    {
      request: ['duplicate', 'ren', [validParticipants[0], { actorId: 'ren', attackId: 'thrust' }]],
      expected: { ok: false, reason: 'duplicate-participant', actorId: 'ren' },
    },
    {
      request: ['wrong-lead', 'aya', validParticipants],
      expected: { ok: false, reason: 'not-controlled-actor', controlledActorId: 'ren' },
    },
    {
      request: ['absent-lead', 'ren', [validParticipants[1], { actorId: 'oni', attackId: 'thrust' }]],
      expected: { ok: false, reason: 'initiator-not-participant', actorId: 'ren' },
    },
    {
      request: ['mixed-side', 'ren', [validParticipants[0], { actorId: 'oni', attackId: 'thrust' }]],
      expected: { ok: false, reason: 'faction-mismatch', actorId: 'oni' },
    },
    {
      request: ['bad-attack', 'ren', [validParticipants[0], { actorId: 'aya', attackId: 'thrust' }]],
      expected: { ok: false, reason: 'unknown-attack', actorId: 'aya', attackId: 'thrust' },
    },
  ];

  for (const { request, expected } of cases) {
    const engine = partyKernel({ enemyAi: null });
    const before = engine.snapshot();
    assert.deepEqual(engine.requestCombo(...request), expected);
    assert.deepEqual(engine.snapshot(), before, expected.reason);
    assert.deepEqual(engine.drainEvents(), [], expected.reason);
  }

  const defeatedCompanion = partyKernel({ enemyAi: null });
  defeatedCompanion.getActor('aya').hp = 0;
  const beforeDefeatedRequest = defeatedCompanion.snapshot();
  assert.deepEqual(defeatedCompanion.requestCombo('fallen-pair', 'ren', validParticipants), {
    ok: false,
    reason: 'actor-defeated',
    actorId: 'aya',
  });
  assert.deepEqual(defeatedCompanion.snapshot(), beforeDefeatedRequest);
  assert.deepEqual(defeatedCompanion.drainEvents(), []);

  const committedInitiator = partyKernel({ enemyAi: null });
  committedInitiator.requestAttack('ren', 'slash');
  committedInitiator.drainEvents();
  const beforeCommittedRequest = committedInitiator.snapshot();
  assert.deepEqual(committedInitiator.requestCombo('late-link', 'ren', validParticipants), {
    ok: false,
    reason: 'animation-commitment',
    actorId: 'ren',
    attackId: 'slash',
    remainingMs: 0,
  });
  assert.deepEqual(committedInitiator.snapshot(), beforeCommittedRequest);
  assert.deepEqual(committedInitiator.drainEvents(), []);

  const ended = partyKernel({ enemyAi: null });
  ended.conclude('defeat');
  ended.drainEvents();
  const beforeEndedRequest = ended.snapshot();
  assert.deepEqual(ended.requestCombo('too-late', 'ren', validParticipants), {
    ok: false,
    reason: 'combat-ended',
  });
  assert.deepEqual(ended.snapshot(), beforeEndedRequest);
  assert.deepEqual(ended.drainEvents(), []);
});

test('ordinary attacks retain their pre-combo snapshot and event shapes', () => {
  const engine = partyKernel({ enemyAi: null });
  engine.requestAttack('ren', 'slash');
  assert.equal(Object.hasOwn(actorSnapshot(engine, 'ren').activeAttack, 'comboId'), false);
  const start = engine.drainEvents().find(({ type }) => type === 'attack-start');
  assert.equal(Object.hasOwn(start, 'comboId'), false);
  engine.advance(140);
  const complete = engine.drainEvents().find((event) => event.type === 'attack-complete' && event.actorId === 'ren');
  assert.equal(Object.hasOwn(complete, 'comboId'), false);
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

test('AI support holds formation, follows beyond its leash, and hands the role over on control switch', () => {
  const guarding = partyKernel({
    enemyAi: null,
    actorOverrides: {
      ren: { position: { x: 100, y: 300 } },
      aya: { position: { x: 70, y: 300 } },
      oni: { position: { x: 480, y: 300 } },
    },
  });
  guarding.advance(ACTION_FIXED_STEP_MS);
  const guardDecision = guarding.drainEvents().find(({ type }) => type === 'companion-decision');
  assert.equal(guardDecision.action, 'guard');
  assert.equal(guardDecision.actorId, 'aya');
  assert.equal(guardDecision.targetId, 'ren');
  assert.deepEqual(actorSnapshot(guarding, 'aya').movementIntent, { x: 0, y: 0 });

  const following = partyKernel({
    enemyAi: null,
    actorOverrides: {
      ren: { position: { x: 300, y: 300 } },
      aya: { position: { x: 20, y: 300 } },
      oni: { position: { x: 490, y: 300 } },
    },
  });
  assert.equal(300 - 20 > ACTION_COMPANION_AI.leashDistancePx, true);
  following.advance(ACTION_FIXED_STEP_MS);
  const followDecision = following.drainEvents().find(({ type }) => type === 'companion-decision');
  assert.equal(followDecision.action, 'follow');
  assert.equal(followDecision.actorId, 'aya');
  assert.equal(followDecision.targetId, 'ren');
  assert.equal(actorSnapshot(following, 'aya').position.x > 20, true);

  assert.equal(following.switchControlledActor('aya').ok, true);
  following.drainEvents();
  following.advance(ACTION_FIXED_STEP_MS);
  assert.equal(following.drainEvents().some(({ type, actorId }) => (
    type === 'companion-decision' && actorId === 'ren'
  )), true);
});

test('backline support retreats from melee range before committing its ranged art', () => {
  const engine = partyKernel({
    enemyAi: null,
    actorOverrides: {
      ren: { position: { x: 80, y: 300 } },
      aya: {
        ai: 'deterministic-support',
        position: { x: 210, y: 300 },
      },
      oni: { position: { x: 300, y: 300 } },
    },
  });
  engine.advance(ACTION_FIXED_STEP_MS);
  const decision = engine.drainEvents().find(({ type, actorId }) => (
    type === 'companion-decision' && actorId === 'aya'
  ));
  assert.equal(decision.action, 'retreat');
  assert.equal(decision.targetId, 'oni');
  assert.deepEqual(decision.intent, { x: -1, y: 0 });
  assert.equal(actorSnapshot(engine, 'aya').position.x < 210, true);
  assert.equal(actorSnapshot(engine, 'aya').activeAttack, null);
});

test('AI support jumps onto an authored one-way platform to rejoin the controlled fighter', () => {
  const platformY = 240;
  const engine = partyKernel({
    enemyAi: null,
    actorOverrides: {
      ren: { position: { x: 240, y: platformY }, grounded: true },
      aya: { position: { x: 220, y: 300 }, grounded: true },
      oni: { position: { x: 480, y: 300 } },
    },
    physicsHooks: {
      resolveGround({ actor, previousPosition, proposedPosition }) {
        if (actor.velocity.y >= 0
            && proposedPosition.x >= 180
            && proposedPosition.x <= 320
            && previousPosition.y <= platformY
            && proposedPosition.y >= platformY) {
          return { grounded: true, groundY: platformY };
        }
        if (proposedPosition.y >= 300) return { grounded: true, groundY: 300 };
        return { grounded: false, groundY: 300 };
      },
    },
  });
  engine.advance(ACTION_FIXED_STEP_MS);
  const launched = actorSnapshot(engine, 'aya');
  assert.equal(launched.grounded, false);
  assert.equal(launched.position.y < 300, true);
  assert.equal(engine.drainEvents().some(({ type, action, actorId }) => (
    type === 'companion-decision' && action === 'jump-follow' && actorId === 'aya'
  )), true);

  let reunited = null;
  for (let step = 0; step < 60; step += 1) {
    engine.advance(20);
    const support = actorSnapshot(engine, 'aya');
    if (support.grounded && support.position.y === platformY) {
      reunited = support;
      break;
    }
  }
  assert.notEqual(reunited, null);
  assert.equal(reunited.position.y, platformY);
});

test('AI support uses its character rising maneuver when an authored platform exceeds normal jump height', () => {
  const platformY = 180;
  const engine = partyKernel({
    enemyAi: null,
    actorOverrides: {
      ren: { position: { x: 240, y: platformY }, grounded: true },
      aya: { position: { x: 220, y: 300 }, grounded: true, movementProfileId: 'hunter' },
      oni: { position: { x: 480, y: 300 } },
    },
    physicsHooks: {
      resolveGround({ actor, previousPosition, proposedPosition }) {
        if (actor.velocity.y >= 0
            && proposedPosition.x >= 180
            && proposedPosition.x <= 320
            && previousPosition.y <= platformY
            && proposedPosition.y >= platformY) {
          return { grounded: true, groundY: platformY };
        }
        if (proposedPosition.y >= 300) return { grounded: true, groundY: 300 };
        return { grounded: false, groundY: 300 };
      },
    },
  });
  engine.advance(ACTION_FIXED_STEP_MS);
  const launched = actorSnapshot(engine, 'aya');
  const events = engine.drainEvents();
  assert.equal(launched.activeManeuver?.id, 'uppercut');
  assert.equal(events.some(({ type, action, actorId }) => (
    type === 'companion-decision' && action === 'rise-follow' && actorId === 'aya'
  )), true);
  assert.equal(events.some(({ type, maneuverId, actorId }) => (
    type === 'maneuver-start' && maneuverId === 'uppercut' && actorId === 'aya'
  )), true);

  let reunited = null;
  for (let step = 0; step < 100; step += 1) {
    engine.advance(20);
    const support = actorSnapshot(engine, 'aya');
    if (support.grounded && support.position.y === platformY) {
      reunited = support;
      break;
    }
  }
  assert.notEqual(reunited, null);
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
