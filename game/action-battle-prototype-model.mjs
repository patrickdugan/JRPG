/**
 * DOM-free action battle proof.
 *
 * This deliberately small interface is the browser prototype's integration seam:
 * replace this module with the future action-combat kernel when it exposes the
 * same create/step/cooldown contract. It does not import or mutate the canonical
 * turn-based battle.
 */

export const ACTION_PROTOTYPE = Object.freeze({
  stageWidth: 960,
  playerMinX: 54,
  playerMaxX: 906,
  moveSpeed: 248,
  attackCommitmentMs: 420,
  attackStartupMs: 115,
  attackActiveMs: 120,
  attackRange: 108,
  baseCooldownMs: 1_120,
  skillAttackCommitmentMs: 580,
  skillAttackStartupMs: 170,
  skillAttackActiveMs: 180,
  skillAttackRange: 148,
  baseSkillCooldownMs: 3_200,
  jumpVelocity: 620,
  gravity: 1_720,
  enemyAttackCommitmentMs: 690,
  enemyAttackHitAtMs: 410,
  enemyAttackRange: 128,
  enemyMoveSpeed: 54,
  enemyCooldownMs: 1_450,
  playerMaxHp: 120,
  enemyMaxHp: 210,
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeLevel(level) {
  const numeric = Number(level);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(50, Math.trunc(numeric)));
}

export function getAttackCooldownMs(level = 1) {
  return Math.round(ACTION_PROTOTYPE.baseCooldownMs * getLevelCooldownMultiplier(level));
}

export function getSkillCooldownMs(level = 1) {
  return Math.round(ACTION_PROTOTYPE.baseSkillCooldownMs * getLevelCooldownMultiplier(level));
}

export function getLevelCooldownMultiplier(level = 1) {
  return Math.max(0.55, 1 - 0.0125 * (normalizeLevel(level) - 1));
}

export function getPlayerAttackDamage(level = 1) {
  return 20 + Math.floor((normalizeLevel(level) - 1) * 1.35);
}

export function getPlayerSkillDamage(level = 1) {
  return Math.round(getPlayerAttackDamage(level) * 1.55);
}

export function createActionBattleState({ level = 8 } = {}) {
  const resolvedLevel = normalizeLevel(level);
  return {
    elapsedMs: 0,
    result: null,
    level: resolvedLevel,
    player: {
      x: 218,
      y: 0,
      velocityY: 0,
      grounded: true,
      facing: 1,
      hp: ACTION_PROTOTYPE.playerMaxHp,
      maxHp: ACTION_PROTOTYPE.playerMaxHp,
      attack: null,
      offenseCooldownRemainingMs: 0,
      skillCooldownRemainingMs: 0,
      hurtRemainingMs: 0,
    },
    enemy: {
      x: 730,
      facing: -1,
      hp: ACTION_PROTOTYPE.enemyMaxHp,
      maxHp: ACTION_PROTOTYPE.enemyMaxHp,
      attack: null,
      cooldownRemainingMs: 520,
      hurtRemainingMs: 0,
    },
  };
}

export function setActionBattleLevel(state, level) {
  return {
    ...state,
    level: normalizeLevel(level),
  };
}

export function getPlayerCombatPhase(state) {
  if (state.result === 'defeat') return 'defeat';
  if (state.player.hurtRemainingMs > 0) return 'hurt';
  if (!state.player.attack) return state.player.offenseCooldownRemainingMs > 0 ? 'cooldown' : 'ready';
  const elapsed = state.player.attack.elapsedMs;
  const startupMs = state.player.attack.kind === 'skill'
    ? ACTION_PROTOTYPE.skillAttackStartupMs
    : ACTION_PROTOTYPE.attackStartupMs;
  const activeMs = state.player.attack.kind === 'skill'
    ? ACTION_PROTOTYPE.skillAttackActiveMs
    : ACTION_PROTOTYPE.attackActiveMs;
  if (elapsed < startupMs) return 'windup';
  if (elapsed < startupMs + activeMs) return 'active';
  return 'recovery';
}

export function getEnemyCombatPhase(state) {
  if (state.result === 'victory') return 'defeat';
  if (state.enemy.hurtRemainingMs > 0) return 'hurt';
  if (!state.enemy.attack) return 'neutral';
  return state.enemy.attack.elapsedMs < ACTION_PROTOTYPE.enemyAttackHitAtMs
    ? 'telegraph'
    : 'recovery';
}

export function canPlayerAttack(state, kind = 'basic') {
  return !state.result
    && state.player.hp > 0
    && state.enemy.hp > 0
    && !state.player.attack
    && state.player.grounded
    && state.player.offenseCooldownRemainingMs <= 0
    && (kind !== 'skill' || state.player.skillCooldownRemainingMs <= 0);
}

function startPlayerAttack(state, events, kind = 'basic') {
  if (canPlayerAttack(state, kind)) {
    const commitmentMs = kind === 'skill'
      ? ACTION_PROTOTYPE.skillAttackCommitmentMs
      : ACTION_PROTOTYPE.attackCommitmentMs;
    state.player.attack = { kind, elapsedMs: 0, hitResolved: false };
    events.push({
      type: 'attack-started',
      actor: 'player',
      kind,
      commitmentMs,
    });
    return;
  }
  if (!state.result) {
    let reason = 'offense-cooldown';
    let remainingMs = state.player.offenseCooldownRemainingMs;
    if (state.player.attack) {
      reason = 'commitment';
      const commitmentMs = state.player.attack.kind === 'skill'
        ? ACTION_PROTOTYPE.skillAttackCommitmentMs
        : ACTION_PROTOTYPE.attackCommitmentMs;
      remainingMs = commitmentMs - state.player.attack.elapsedMs;
    } else if (!state.player.grounded) {
      reason = 'airborne';
      remainingMs = 0;
    } else if (kind === 'skill' && state.player.skillCooldownRemainingMs > 0) {
      reason = 'skill-cooldown';
      remainingMs = state.player.skillCooldownRemainingMs;
    }
    events.push({
      type: 'attack-blocked',
      kind,
      reason,
      remainingMs,
    });
  }
}

function resolvePlayerAttack(state, events) {
  const attack = state.player.attack;
  if (!attack || attack.hitResolved) return;
  const isSkill = attack.kind === 'skill';
  const startupMs = isSkill ? ACTION_PROTOTYPE.skillAttackStartupMs : ACTION_PROTOTYPE.attackStartupMs;
  if (attack.elapsedMs < startupMs) return;

  attack.hitResolved = true;
  const enemyDelta = state.enemy.x - state.player.x;
  const facingTarget = Math.sign(enemyDelta || state.player.facing) === state.player.facing;
  const range = isSkill ? ACTION_PROTOTYPE.skillAttackRange : ACTION_PROTOTYPE.attackRange;
  if (facingTarget && Math.abs(enemyDelta) <= range) {
    const amount = Math.min(
      state.enemy.hp,
      isSkill ? getPlayerSkillDamage(state.level) : getPlayerAttackDamage(state.level),
    );
    state.enemy.hp -= amount;
    state.enemy.hurtRemainingMs = 190;
    events.push({
      type: 'damage',
      actor: 'player',
      target: 'enemy',
      amount,
      delivery: 'cut',
      essence: isSkill ? 'ember' : null,
      label: isSkill ? `CUT · EMBER ${amount}` : `CUT ${amount}`,
    });
  } else {
    events.push({ type: 'attack-missed', actor: 'player' });
  }
}

function advancePlayerAttack(state, deltaMs, events) {
  if (!state.player.attack) return;
  state.player.attack.elapsedMs += deltaMs;
  resolvePlayerAttack(state, events);
  const kind = state.player.attack.kind;
  const commitmentMs = kind === 'skill'
    ? ACTION_PROTOTYPE.skillAttackCommitmentMs
    : ACTION_PROTOTYPE.attackCommitmentMs;
  if (state.player.attack.elapsedMs < commitmentMs) return;

  state.player.attack = null;
  state.player.offenseCooldownRemainingMs = getAttackCooldownMs(state.level);
  if (kind === 'skill') state.player.skillCooldownRemainingMs = getSkillCooldownMs(state.level);
  events.push({
    type: 'cooldown-started',
    actor: 'player',
    kind,
    offenseDurationMs: state.player.offenseCooldownRemainingMs,
    skillDurationMs: kind === 'skill' ? state.player.skillCooldownRemainingMs : 0,
  });
}

function jumpPlayer(state, input, events) {
  if (!input.jumpPressed || state.result) return;
  if (state.player.grounded && !state.player.attack) {
    state.player.grounded = false;
    state.player.velocityY = ACTION_PROTOTYPE.jumpVelocity;
    events.push({ type: 'jump-started', actor: 'player' });
  }
}

function advancePlayerVertical(state, deltaMs, events) {
  if (state.player.grounded) return;
  state.player.y += state.player.velocityY * deltaMs / 1_000;
  state.player.velocityY -= ACTION_PROTOTYPE.gravity * deltaMs / 1_000;
  if (state.player.y > 0) return;
  state.player.y = 0;
  state.player.velocityY = 0;
  state.player.grounded = true;
  events.push({ type: 'landed', actor: 'player' });
}

function movePlayer(state, input, deltaMs) {
  if (state.player.attack || state.result) return;
  const direction = Number(Boolean(input.right)) - Number(Boolean(input.left));
  if (!direction) return;
  state.player.facing = direction;
  state.player.x = clamp(
    state.player.x + direction * ACTION_PROTOTYPE.moveSpeed * deltaMs / 1_000,
    ACTION_PROTOTYPE.playerMinX,
    ACTION_PROTOTYPE.playerMaxX,
  );
}

function updateEnemy(state, deltaMs, events) {
  if (state.result || state.enemy.hp <= 0) return;
  const distance = Math.abs(state.player.x - state.enemy.x);
  state.enemy.facing = state.player.x < state.enemy.x ? -1 : 1;

  if (!state.enemy.attack && state.enemy.cooldownRemainingMs <= 0
      && distance <= ACTION_PROTOTYPE.enemyAttackRange) {
    state.enemy.attack = { elapsedMs: 0, hitResolved: false };
    events.push({ type: 'enemy-telegraph', actor: 'enemy', durationMs: ACTION_PROTOTYPE.enemyAttackHitAtMs });
  }

  if (state.enemy.attack) {
    state.enemy.attack.elapsedMs += deltaMs;
    if (!state.enemy.attack.hitResolved
        && state.enemy.attack.elapsedMs >= ACTION_PROTOTYPE.enemyAttackHitAtMs) {
      state.enemy.attack.hitResolved = true;
      const strikeDistance = Math.abs(state.player.x - state.enemy.x);
      if (strikeDistance <= ACTION_PROTOTYPE.enemyAttackRange && state.player.y < 42) {
        const amount = Math.min(state.player.hp, 14);
        state.player.hp -= amount;
        state.player.hurtRemainingMs = 220;
        events.push({
          type: 'damage',
          actor: 'enemy',
          target: 'player',
          amount,
          delivery: 'arcane',
          essence: 'umbral',
          label: `ARCANE · UMBRAL ${amount}`,
        });
      } else {
        events.push({ type: 'attack-evaded', actor: 'enemy' });
      }
    }
    if (state.enemy.attack.elapsedMs >= ACTION_PROTOTYPE.enemyAttackCommitmentMs) {
      state.enemy.attack = null;
      state.enemy.cooldownRemainingMs = ACTION_PROTOTYPE.enemyCooldownMs;
    }
    return;
  }

  if (distance > ACTION_PROTOTYPE.enemyAttackRange - 12) {
    const direction = state.player.x < state.enemy.x ? -1 : 1;
    state.enemy.x = clamp(
      state.enemy.x + direction * ACTION_PROTOTYPE.enemyMoveSpeed * deltaMs / 1_000,
      ACTION_PROTOTYPE.playerMinX,
      ACTION_PROTOTYPE.playerMaxX,
    );
  }
}

function updateClocks(state, deltaMs) {
  state.player.offenseCooldownRemainingMs = Math.max(
    0,
    state.player.offenseCooldownRemainingMs - deltaMs,
  );
  state.player.skillCooldownRemainingMs = Math.max(
    0,
    state.player.skillCooldownRemainingMs - deltaMs,
  );
  if (!state.enemy.attack) {
    state.enemy.cooldownRemainingMs = Math.max(0, state.enemy.cooldownRemainingMs - deltaMs);
  }
  state.player.hurtRemainingMs = Math.max(0, state.player.hurtRemainingMs - deltaMs);
  state.enemy.hurtRemainingMs = Math.max(0, state.enemy.hurtRemainingMs - deltaMs);
}

function resolveResult(state, events) {
  if (state.enemy.hp <= 0 && state.result !== 'victory') {
    state.result = 'victory';
    events.push({ type: 'battle-ended', result: 'victory' });
  } else if (state.player.hp <= 0 && state.result !== 'defeat') {
    state.result = 'defeat';
    events.push({ type: 'battle-ended', result: 'defeat' });
  }
}

/**
 * Advance one deterministic simulation slice. State is mutated intentionally so
 * a future fixed-step kernel adapter can be dropped in without allocation churn.
 */
export function stepActionBattle(state, input = {}, deltaMs = 1_000 / 60) {
  if (!state || typeof state !== 'object') throw new TypeError('Action battle state is required.');
  const resolvedDelta = clamp(Number(deltaMs) || 0, 0, 50);
  const events = [];
  state.elapsedMs += resolvedDelta;

  updateClocks(state, resolvedDelta);
  jumpPlayer(state, input, events);
  if (input.attackPressed) startPlayerAttack(state, events, 'basic');
  if (input.skillPressed) startPlayerAttack(state, events, 'skill');
  advancePlayerAttack(state, resolvedDelta, events);
  movePlayer(state, input, resolvedDelta);
  advancePlayerVertical(state, resolvedDelta, events);
  updateEnemy(state, resolvedDelta, events);
  resolveResult(state, events);

  return events;
}
