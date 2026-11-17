import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTION_COYOTE_WINDOW_MS,
  ACTION_FIXED_STEP_MS,
  ACTION_HIT_INVULNERABILITY_MS,
  ACTION_INPUT_BUFFER_WINDOW_MS,
  ACTION_JUMP_BUFFER_WINDOW_MS,
  ACTION_PARTY_HIT_INVULNERABILITY_MS,
  ActionCombatKernel,
} from '../action-combat.mjs';

const STEP = ACTION_FIXED_STEP_MS;
const HITBOX = Object.freeze({ offsetX: 4, offsetY: 0, width: 60, height: 48 });
const ATTACKS = Object.freeze({
  jab: { name: 'Jab', delivery: 'cut', power: 6, windupMs: 40, activeMs: 20, recoveryMs: 60, hitbox: HITBOX },
  art: { name: 'Art', delivery: 'arcane', power: 6, poiseDamage: 2, windupMs: 40, activeMs: 20, recoveryMs: 60, cooldownMs: 600, hitbox: HITBOX },
  smash: { name: 'Smash', delivery: 'crush', power: 9, windupMs: 400, activeMs: 20, recoveryMs: 100, hitbox: HITBOX },
  tell: { name: 'Tell', delivery: 'crush', power: 9, windupMs: 400, activeMs: 20, recoveryMs: 100, tellPoiseBonus: 1, hitbox: HITBOX },
});

function createKernel({ hero = {}, brute = {}, extraActors = [], physicsHooks } = {}) {
  return new ActionCombatKernel({
    attacks: ATTACKS,
    physicsHooks,
    actors: [
      {
        id: 'hero', faction: 'player', hp: 300, maxHp: 300, power: 10, offensiveCooldownMs: 60,
        position: { x: 100, y: 360 }, facing: 'right', attackIds: ['jab', 'art'], ...hero,
      },
      ...extraActors,
      {
        id: 'brute', faction: 'enemy', ai: null, hp: 900, maxHp: 900, power: 8, offensiveCooldownMs: 500,
        position: { x: 140, y: 360 }, facing: 'left', attackIds: ['smash', 'tell'], ...brute,
      },
    ],
  });
}

function stepCollect(kernel, steps) {
  const events = [];
  for (let index = 0; index < steps; index += 1) {
    kernel.step(1);
    events.push(...kernel.drainEvents());
  }
  return events;
}

test('leniency windows are wider than the pre-pass values and party grace outlasts enemy grace', () => {
  assert.equal(ACTION_COYOTE_WINDOW_MS, 140, 'coyote time was 100 ms');
  assert.equal(ACTION_JUMP_BUFFER_WINDOW_MS, 160, 'the landing jump buffer was 120 ms');
  assert.equal(ACTION_INPUT_BUFFER_WINDOW_MS, 160, 'attack and maneuver presses were not buffered');
  assert.equal(ACTION_PARTY_HIT_INVULNERABILITY_MS, 360, 'party post-hit grace was 240 ms');
  assert.equal(ACTION_HIT_INVULNERABILITY_MS, 240, 'enemies keep the pre-pass grace');
  for (const value of [ACTION_COYOTE_WINDOW_MS, ACTION_JUMP_BUFFER_WINDOW_MS, ACTION_INPUT_BUFFER_WINDOW_MS,
    ACTION_PARTY_HIT_INVULNERABILITY_MS]) {
    assert.equal(value % STEP, 0, 'every window is a whole number of fixed steps');
  }
});

test('a fighter who walks off a ledge can still jump for the whole coyote window', () => {
  // A 40 px ledge ends at x = 150; beyond it the fighter falls to the floor.
  const physicsHooks = {
    resolveGround({ proposedPosition, previousPosition }) {
      if (proposedPosition.x <= 150 && previousPosition.y <= 320 && proposedPosition.y >= 320) {
        return { grounded: true, groundY: 320 };
      }
      return { grounded: proposedPosition.y >= 360, groundY: 360 };
    },
  };
  const walkOff = () => {
    const kernel = createKernel({
      physicsHooks,
      hero: { position: { x: 140, y: 320 }, grounded: true, moveSpeed: 120 },
      brute: { position: { x: 600, y: 360 } },
    });
    kernel.setMovement('hero', { x: 1 });
    let steps = 0;
    while (kernel.getActor('hero').coyoteRemainingMs === 0 && steps < 20) {
      kernel.step(1);
      steps += 1;
    }
    assert.equal(kernel.getActor('hero').coyoteRemainingMs, ACTION_COYOTE_WINDOW_MS);
    kernel.drainEvents();
    return kernel;
  };

  const late = walkOff();
  late.step(120 / STEP);
  assert.equal(late.getActor('hero').grounded, false);
  const jump = late.requestJump('hero');
  assert.equal(jump.ok, true, 'a jump 120 ms after leaving the ledge (rejected under the old 100 ms window)');
  assert.equal(late.drainEvents().find(({ type }) => type === 'jump').reason, 'coyote-window');

  const tooLate = walkOff();
  tooLate.step(ACTION_COYOTE_WINDOW_MS / STEP);
  assert.deepEqual(tooLate.requestJump('hero'), { ok: false, reason: 'airborne' });
});

test('party fighters keep a longer post-hit grace than enemies', () => {
  const kernel = createKernel({ brute: { attackIds: ['smash', 'tell', 'jab'] } });
  assert.equal(kernel.requestAttack('brute', 'jab').ok, true);
  const first = stepCollect(kernel, 3).find(({ type }) => type === 'hit');
  assert.equal(first.targetId, 'hero');
  assert.equal(first.invulnerabilityMs, ACTION_PARTY_HIT_INVULNERABILITY_MS);
  assert.equal(kernel.getActor('hero').hitInvulnerabilityRemainingMs,
    ACTION_PARTY_HIT_INVULNERABILITY_MS - (kernel.nowMs - first.nowMs));

  // A second independent strike 300 ms later would have landed under the
  // old 240 ms grace; it is now ignored.
  kernel.getActor('brute').offensiveCooldownRemainingMs = 0;
  stepCollect(kernel, (300 - 40 - 60) / STEP);
  kernel.getActor('brute').offensiveCooldownRemainingMs = 0;
  assert.equal(kernel.requestAttack('brute', 'jab').ok, true);
  const second = stepCollect(kernel, 3);
  assert.equal(second.some(({ type, targetId }) => type === 'hit-ignored' && targetId === 'hero'), true);

  const reverse = createKernel();
  assert.equal(reverse.requestAttack('hero', 'jab').ok, true);
  const hit = stepCollect(reverse, 3).find(({ type }) => type === 'hit');
  assert.equal(hit.targetId, 'brute');
  assert.equal(hit.invulnerabilityMs, ACTION_HIT_INVULNERABILITY_MS);
});

test('a buffered attack press starts on the first legal step and never skips the shared cooldown', () => {
  const kernel = createKernel({ brute: { position: { x: 600, y: 360 } } });
  assert.equal(kernel.requestAttack('hero', 'jab').ok, true);
  kernel.step(4); // 80 ms: still in recovery (animation ends at 120 ms)
  assert.deepEqual(kernel.requestAttack('hero', 'art'), { ok: false, reason: 'animation-commitment', remainingMs: 0 },
    'an unbuffered press is still rejected as before');
  const buffered = kernel.requestAttack('hero', 'art', { buffer: true });
  assert.deepEqual(buffered, {
    ok: false,
    reason: 'animation-commitment',
    remainingMs: 0,
    buffered: true,
    windowMs: ACTION_INPUT_BUFFER_WINDOW_MS,
  });
  assert.equal(kernel.snapshot().actors[0].inputBuffer.id, 'art');
  const events = stepCollect(kernel, ACTION_INPUT_BUFFER_WINDOW_MS / STEP);
  const complete = events.find(({ type, attackId }) => type === 'attack-complete' && attackId === 'jab');
  const start = events.find(({ type, attackId }) => type === 'attack-start' && attackId === 'art');
  assert.ok(start, 'the held press fired inside its window');
  assert.equal(start.nowMs, complete.nowMs + complete.sharedCooldownMs,
    'it starts exactly when the shared cooldown reaches zero, not earlier');
  const consumed = events.find(({ type }) => type === 'input-buffer-consumed');
  assert.deepEqual([consumed.kind, consumed.id, consumed.heldMs], ['attack', 'art', start.nowMs - 80]);
  assert.equal(kernel.getActor('hero').inputBuffer, null);
});

test('a press made too early expires, the latest press wins, and a tag switch clears the buffer', () => {
  const kernel = createKernel({ hero: { offensiveCooldownMs: 600 }, brute: { position: { x: 600, y: 360 } } });
  assert.equal(kernel.requestAttack('hero', 'jab').ok, true);
  kernel.step(1);
  kernel.requestAttack('hero', 'jab', { buffer: true });
  kernel.requestAttack('hero', 'art', { buffer: true });
  assert.equal(kernel.getActor('hero').inputBuffer.id, 'art', 'the latest press replaces the earlier one');
  const events = stepCollect(kernel, ACTION_INPUT_BUFFER_WINDOW_MS / STEP);
  const expired = events.find(({ type }) => type === 'input-buffer-expired');
  assert.deepEqual([expired.id, expired.reason, expired.heldMs], ['art', 'shared-offensive-cooldown', ACTION_INPUT_BUFFER_WINDOW_MS],
    'it reports the block it was still waiting on');
  assert.equal(events.some(({ type, attackId }) => type === 'attack-start' && attackId === 'art'), false);

  const duo = createKernel({
    extraActors: [{
      id: 'ally', faction: 'player', hp: 200, maxHp: 200, power: 8, offensiveCooldownMs: 60,
      position: { x: 60, y: 360 }, facing: 'right', attackIds: ['jab'], ai: null,
    }],
    brute: { position: { x: 600, y: 360 } },
  });
  assert.equal(duo.requestAttack('hero', 'jab').ok, true);
  duo.requestAttack('hero', 'art', { buffer: true });
  assert.equal(duo.switchControlledActor('ally').ok, true);
  assert.equal(duo.getActor('hero').inputBuffer, null);
});

test('a dash pressed during recovery fires on the step the attack completes', () => {
  const kernel = createKernel({ brute: { position: { x: 600, y: 360 } } });
  assert.equal(kernel.requestAttack('hero', 'jab').ok, true);
  kernel.step(4);
  const response = kernel.requestManeuver('hero', 'dash', { buffer: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'animation-commitment');
  assert.equal(response.buffered, true);
  const events = stepCollect(kernel, 4);
  const complete = events.find(({ type }) => type === 'attack-complete');
  const dash = events.find(({ type, maneuverId }) => type === 'maneuver-start' && maneuverId === 'dash');
  assert.equal(dash.nowMs, complete.nowMs, 'movement verbs stay available during cooldown');
});

test('an attack still cooling never cancels a cancellable dash', () => {
  const kernel = createKernel({ hero: { offensiveCooldownMs: 600 }, brute: { position: { x: 600, y: 360 } } });
  assert.equal(kernel.requestAttack('hero', 'jab').ok, true);
  kernel.step(6);
  kernel.setMovement('hero', { x: 1 });
  assert.equal(kernel.requestManeuver('hero', 'dash').ok, true);
  kernel.step(3);
  const response = kernel.requestAttack('hero', 'jab');
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'shared-offensive-cooldown');
  assert.equal(kernel.getActor('hero').activeManeuver?.id, 'dash', 'the dash keeps running');
});

test('neutral hits chip poise only to the neutral floor; tell hits add the tell bonus and break', () => {
  const poise = { max: 4, neutralFloor: 3, regenDelayMs: 3_000, regenIntervalMs: 2_500, staggerMs: 800 };
  const kernel = createKernel({ brute: { poise } });
  const swing = (attackId) => {
    kernel.getActor('brute').position.x = 140; // undo knockback between swings
    kernel.getActor('hero').offensiveCooldownRemainingMs = 0;
    kernel.getActor('hero').attackCooldowns[attackId] = 0;
    assert.equal(kernel.requestAttack('hero', attackId).ok, true);
    const events = stepCollect(kernel, 3);
    stepCollect(kernel, 13); // clear the brute's post-hit grace
    return events.find(({ type }) => type === 'hit');
  };
  const chip = swing('art');
  assert.deepEqual([chip.poiseDamage, chip.poiseAfter, chip.poiseBroken, chip.poiseDuringTell], [1, 3, false, false]);
  const floor = swing('jab');
  assert.deepEqual([floor.poiseDamage, floor.poiseAfter], [0, 3], 'neutral pressure never goes below the floor');

  assert.equal(kernel.requestAttack('brute', 'tell').ok, true);
  const tellHit = swing('jab');
  assert.deepEqual([tellHit.poiseDamage, tellHit.poiseAfter, tellHit.poiseDuringTell], [2, 1, true],
    'weapon 1 + tell bonus 1');
  const breaker = swing('jab');
  assert.equal(breaker.poiseBroken, true);
  assert.equal(kernel.getActor('brute').activeAttack, null);

  const plain = createKernel({ brute: { poise: { max: 2, regenDelayMs: 400, regenIntervalMs: 200, staggerMs: 300 } } });
  assert.equal(plain.requestAttack('hero', 'jab').ok, true);
  const plainHit = stepCollect(plain, 3).find(({ type }) => type === 'hit');
  assert.equal(plainHit.poiseDamage, 0, 'without a neutral floor, neutral hits drain nothing (pre-pass contract)');
  assert.equal(plain.snapshot().actors.find(({ id }) => id === 'brute').poiseNeutralFloor, 2);
  assert.throws(() => createKernel({ brute: { poise: { max: 2, neutralFloor: 3 } } }), /neutralFloor/u);
});

test('maneuver strikes drain one poise point instead of corrupting poise', () => {
  const kernel = createKernel({
    hero: { movementProfileId: 'standard', position: { x: 120, y: 360 } },
    brute: { poise: { max: 4, neutralFloor: 3, regenDelayMs: 3_000, regenIntervalMs: 2_500, staggerMs: 800 } },
  });
  assert.equal(kernel.requestAttack('brute', 'smash').ok, true);
  kernel.step(1);
  assert.equal(kernel.requestManeuver('hero', 'uppercut').ok, true);
  const hit = stepCollect(kernel, 6).find(({ type, targetId }) => type === 'hit' && targetId === 'brute');
  assert.ok(hit, 'the uppercut connects during the wind-up');
  assert.equal(hit.maneuverId, 'uppercut');
  assert.equal(hit.poiseDamage, 1);
  assert.equal(kernel.getActor('brute').poise, 3);
  assert.equal(Number.isInteger(kernel.getActor('brute').poise), true);
});

test('buffered inputs, neutral chip, and tell bonuses replay identically', () => {
  const run = () => {
    const kernel = createKernel({
      brute: {
        ai: 'deterministic-chase',
        position: { x: 220, y: 360 },
        poise: { max: 4, neutralFloor: 3, regenDelayMs: 3_000, regenIntervalMs: 2_500, staggerMs: 800 },
      },
    });
    const log = [];
    for (let step = 0; step < 300; step += 1) {
      if (step % 7 === 0) kernel.requestAttack('hero', step % 14 === 0 ? 'art' : 'jab', { buffer: true });
      if (step % 23 === 0) kernel.requestManeuver('hero', 'dash', { buffer: true });
      kernel.setMovement('hero', { x: step % 40 < 20 ? 1 : -1 });
      kernel.step(1);
      log.push(...kernel.drainEvents());
    }
    return { log, snapshot: kernel.snapshot() };
  };
  const first = run();
  const second = run();
  assert.deepEqual(second.log, first.log);
  assert.deepEqual(second.snapshot, first.snapshot);
  assert.ok(first.log.some(({ type }) => type === 'input-buffer-consumed'));
});
