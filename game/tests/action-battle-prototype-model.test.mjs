import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_PROTOTYPE,
  canPlayerAttack,
  createActionBattleState,
  getAttackCooldownMs,
  getLevelCooldownMultiplier,
  getSkillCooldownMs,
  stepActionBattle,
} from '../action-battle-prototype-model.mjs';

function advance(state, milliseconds, input = {}) {
  const events = [];
  let remaining = milliseconds;
  while (remaining > 0) {
    const slice = Math.min(50, remaining);
    events.push(...stepActionBattle(state, input, slice));
    remaining -= slice;
  }
  return events;
}

function quietState(level = 8) {
  const state = createActionBattleState({ level });
  state.enemy.x = 900;
  state.enemy.cooldownRemainingMs = 60_000;
  return state;
}

test('cooldowns use the exact level multiplier with a 55% floor', () => {
  assert.equal(getLevelCooldownMultiplier(1), 1);
  assert.equal(getLevelCooldownMultiplier(8), 0.9125);
  assert.equal(getLevelCooldownMultiplier(81), 0.55);
  assert.equal(getLevelCooldownMultiplier(999), 0.55);
  assert.equal(getAttackCooldownMs(8), Math.round(1_120 * 0.9125));
  assert.equal(getSkillCooldownMs(8), Math.round(3_200 * 0.9125));
});

test('basic attack locks movement for an invariant animation then starts offense cooldown', () => {
  for (const level of [1, 20, 40, 50]) {
    const state = quietState(level);
    const startX = state.player.x;
    const started = stepActionBattle(state, { attackPressed: true, right: true }, 0);
    assert.equal(started[0].type, 'attack-started');
    assert.equal(started[0].commitmentMs, ACTION_PROTOTYPE.attackCommitmentMs);

    advance(state, ACTION_PROTOTYPE.attackCommitmentMs - 1, { right: true });
    assert.equal(state.player.x, startX);
    assert.ok(state.player.attack);
    assert.equal(state.player.offenseCooldownRemainingMs, 0);

    const completed = advance(state, 1, { right: true });
    assert.equal(state.player.attack, null);
    assert.equal(state.player.offenseCooldownRemainingMs, getAttackCooldownMs(level));
    assert.equal(completed.some((event) => event.type === 'cooldown-started'), true);
  }
});

test('movement is free while the post-animation offense cooldown counts down', () => {
  const state = quietState(8);
  stepActionBattle(state, { attackPressed: true }, 0);
  advance(state, ACTION_PROTOTYPE.attackCommitmentMs);
  const xBeforeRecoveryMove = state.player.x;
  const cooldownBeforeMove = state.player.offenseCooldownRemainingMs;

  advance(state, 100, { right: true });

  assert.ok(state.player.x > xBeforeRecoveryMove);
  assert.ok(state.player.offenseCooldownRemainingMs < cooldownBeforeMove);
  assert.equal(canPlayerAttack(state), false);
});

test('grounded jump denies ground-only attacks while every cooldown keeps ticking', () => {
  const state = quietState(8);
  state.player.offenseCooldownRemainingMs = 500;
  state.player.skillCooldownRemainingMs = 1_500;

  const events = stepActionBattle(state, { jumpPressed: true, attackPressed: true, right: true }, 20);

  assert.equal(state.player.grounded, false);
  assert.ok(state.player.y > 0);
  assert.ok(state.player.x > 218);
  assert.equal(state.player.offenseCooldownRemainingMs, 480);
  assert.equal(state.player.skillCooldownRemainingMs, 1_480);
  assert.equal(events.some((event) => event.type === 'attack-blocked' && event.reason === 'airborne'), true);
});

test('skill starts its own post-animation cooldown plus shared offense cooldown', () => {
  const state = quietState(8);
  const started = stepActionBattle(state, { skillPressed: true }, 0);
  assert.equal(started[0].kind, 'skill');
  assert.equal(started[0].commitmentMs, ACTION_PROTOTYPE.skillAttackCommitmentMs);

  advance(state, ACTION_PROTOTYPE.skillAttackCommitmentMs);
  assert.equal(state.player.offenseCooldownRemainingMs, getAttackCooldownMs(8));
  assert.equal(state.player.skillCooldownRemainingMs, getSkillCooldownMs(8));

  advance(state, getAttackCooldownMs(8));
  assert.equal(state.player.offenseCooldownRemainingMs, 0);
  assert.ok(state.player.skillCooldownRemainingMs > 0);
  assert.equal(canPlayerAttack(state, 'basic'), true);
  assert.equal(canPlayerAttack(state, 'skill'), false);

  stepActionBattle(state, { attackPressed: true }, 0);
  const skillBeforeBasicCommitment = state.player.skillCooldownRemainingMs;
  advance(state, ACTION_PROTOTYPE.attackCommitmentMs);
  assert.ok(state.player.skillCooldownRemainingMs < skillBeforeBasicCommitment);
});
