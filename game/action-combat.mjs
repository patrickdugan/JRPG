/**
 * Deterministic, DOM-free side-view action-combat kernel.
 *
 * Coordinates use a side-view world: +x is right and +y is down. An actor's
 * position is the bottom-centre point of its hurtbox. Locomotion is grounded
 * left/right movement with deterministic jump/gravity physics. A physics hook
 * may supply platform ground resolution without changing combat timing.
 *
 * Cooldown formula (timers only; never animation phases):
 *   multiplier = max(0.55, 1 - 0.0125 * (level - 1))
 *   adjustedMs = round(baseMs * multiplier)
 *
 * The 55% floor is reached at level 37. Every completed attack starts the
 * actor's shared offensive cooldown. An attack may also author a longer,
 * move-specific cooldown. Both are exposed in milliseconds and an attack is
 * ready only when both have expired.
 */

export const ACTION_FIXED_STEP_MS = 20;
export const ACTION_COMBAT_SNAPSHOT_VERSION = 1;
export const MINIMUM_COOLDOWN_MULTIPLIER = 0.55;
export const COOLDOWN_REDUCTION_PER_LEVEL = 0.0125;

export const ACTION_PHASES = Object.freeze({
  WINDUP: 'windup',
  ACTIVE: 'active',
  RECOVERY: 'recovery',
});

const DEFAULT_STAGE = Object.freeze({ minX: 0, maxX: 640, minY: 48, maxY: 360 });
const DEFAULT_HURTBOX = Object.freeze({ width: 24, height: 48 });
const DEFAULT_OFFENSIVE_COOLDOWN_MS = 400;
const DEFAULT_GRAVITY = 1800;
const DEFAULT_JUMP_SPEED = 520;
const POSITION_PRECISION = 1_000_000;

const DELIVERY_KEYS = Object.freeze(['cut', 'pierce', 'crush', 'arcane']);
const ESSENCE_KEYS = Object.freeze(['ember', 'frost', 'storm', 'radiance', 'umbral']);

const neutralResistances = Object.freeze({
  delivery: Object.freeze(Object.fromEntries(DELIVERY_KEYS.map((key) => [key, 1]))),
  essence: Object.freeze(Object.fromEntries(ESSENCE_KEYS.map((key) => [key, 1]))),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be a finite number.`);
  return number;
}

function nonNegativeInteger(value, label, fallback = null) {
  const candidate = value ?? fallback;
  if (!Number.isSafeInteger(candidate) || candidate < 0) {
    throw new RangeError(`${label} must be a non-negative integer.`);
  }
  return candidate;
}

function positiveNumber(value, label, fallback = null) {
  const candidate = value ?? fallback;
  if (!Number.isFinite(candidate) || candidate <= 0) {
    throw new RangeError(`${label} must be a positive number.`);
  }
  return candidate;
}

function roundPosition(value) {
  return Math.round(value * POSITION_PRECISION) / POSITION_PRECISION;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeIntent(intent = {}) {
  return { x: clamp(finiteNumber(intent.x ?? 0, 'movement x'), -1, 1), y: 0 };
}

function normalizeLevel(level) {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.floor(level));
}

/** Return the bounded timer multiplier for an actor level. */
export function cooldownMultiplierForLevel(level) {
  return Math.max(
    MINIMUM_COOLDOWN_MULTIPLIER,
    1 - COOLDOWN_REDUCTION_PER_LEVEL * (normalizeLevel(level) - 1),
  );
}

/** Apply the level formula to an authored millisecond cooldown. */
export function levelAdjustedCooldownMs(baseMs, level) {
  const milliseconds = nonNegativeInteger(baseMs, 'base cooldown');
  return Math.round(milliseconds * cooldownMultiplierForLevel(level));
}

function normalizeStage(stage = {}) {
  const result = {
    minX: finiteNumber(stage.minX ?? DEFAULT_STAGE.minX, 'stage.minX'),
    maxX: finiteNumber(stage.maxX ?? DEFAULT_STAGE.maxX, 'stage.maxX'),
    minY: finiteNumber(stage.minY ?? DEFAULT_STAGE.minY, 'stage.minY'),
    maxY: finiteNumber(stage.maxY ?? DEFAULT_STAGE.maxY, 'stage.maxY'),
    groundY: finiteNumber(stage.groundY ?? stage.maxY ?? DEFAULT_STAGE.maxY, 'stage.groundY'),
  };
  if (result.maxX <= result.minX || result.maxY <= result.minY) {
    throw new RangeError('Stage maximums must be greater than stage minimums.');
  }
  if (result.groundY < result.minY || result.groundY > result.maxY) {
    throw new RangeError('stage.groundY must be within the vertical stage bounds.');
  }
  return result;
}

function normalizeAttack(id, source, stepMs) {
  const attack = {
    id,
    name: String(source.name ?? id),
    delivery: source.delivery ?? null,
    essence: source.essence ?? null,
    power: finiteNumber(source.power ?? 0, `${id}.power`),
    windupMs: nonNegativeInteger(source.windupMs, `${id}.windupMs`, 0),
    activeMs: nonNegativeInteger(source.activeMs, `${id}.activeMs`),
    recoveryMs: nonNegativeInteger(source.recoveryMs, `${id}.recoveryMs`, 0),
    cooldownMs: source.cooldownMs == null
      ? null
      : nonNegativeInteger(source.cooldownMs, `${id}.cooldownMs`),
    hitbox: {
      offsetX: finiteNumber(source.hitbox?.offsetX ?? 0, `${id}.hitbox.offsetX`),
      offsetY: finiteNumber(source.hitbox?.offsetY ?? 0, `${id}.hitbox.offsetY`),
      width: positiveNumber(source.hitbox?.width, `${id}.hitbox.width`),
      height: positiveNumber(source.hitbox?.height, `${id}.hitbox.height`),
    },
    tags: clone(source.tags ?? []),
  };
  if (attack.activeMs === 0) throw new RangeError(`${id}.activeMs must be greater than zero.`);
  for (const key of ['windupMs', 'activeMs', 'recoveryMs']) {
    if (attack[key] % stepMs !== 0) {
      throw new RangeError(`${id}.${key} must be a multiple of fixed step ${stepMs}ms.`);
    }
  }
  if (attack.delivery != null && !DELIVERY_KEYS.includes(attack.delivery)) {
    throw new RangeError(`${id}.delivery is unsupported.`);
  }
  if (attack.essence != null && !ESSENCE_KEYS.includes(attack.essence)) {
    throw new RangeError(`${id}.essence is unsupported.`);
  }
  return deepFreeze(attack);
}

function normalizeActor(source, attackCatalogue, stage) {
  const id = String(source.id ?? '');
  if (!id) throw new TypeError('Every actor requires an id.');
  const maxHp = positiveNumber(source.maxHp ?? source.hp, `${id}.maxHp`);
  const attackIds = [...(source.attackIds ?? [])].map(String);
  for (const attackId of attackIds) {
    if (!attackCatalogue[attackId]) throw new RangeError(`${id} references unknown attack ${attackId}.`);
  }
  return {
    id,
    name: String(source.name ?? id),
    faction: String(source.faction ?? 'neutral'),
    ai: Object.hasOwn(source, 'ai') ? source.ai : (source.faction === 'enemy' ? 'deterministic-chase' : null),
    level: normalizeLevel(source.level),
    hp: clamp(finiteNumber(source.hp ?? maxHp, `${id}.hp`), 0, maxHp),
    maxHp,
    power: finiteNumber(source.power ?? 0, `${id}.power`),
    guard: finiteNumber(source.guard ?? 0, `${id}.guard`),
    moveSpeed: positiveNumber(source.moveSpeed, `${id}.moveSpeed`, 120),
    gravity: positiveNumber(source.gravity, `${id}.gravity`, DEFAULT_GRAVITY),
    jumpSpeed: positiveNumber(source.jumpSpeed, `${id}.jumpSpeed`, DEFAULT_JUMP_SPEED),
    offensiveCooldownMs: nonNegativeInteger(
      source.offensiveCooldownMs,
      `${id}.offensiveCooldownMs`,
      DEFAULT_OFFENSIVE_COOLDOWN_MS,
    ),
    position: {
      x: clamp(finiteNumber(source.position?.x ?? 0, `${id}.position.x`), stage.minX, stage.maxX),
      y: clamp(finiteNumber(source.position?.y ?? stage.groundY, `${id}.position.y`), stage.minY, stage.maxY),
    },
    velocity: {
      x: finiteNumber(source.velocity?.x ?? 0, `${id}.velocity.x`),
      y: finiteNumber(source.velocity?.y ?? 0, `${id}.velocity.y`),
    },
    grounded: source.grounded ?? (source.position?.y == null || source.position.y >= stage.groundY),
    facing: source.facing === -1 || source.facing === 'left' ? -1 : 1,
    hurtbox: {
      width: positiveNumber(source.hurtbox?.width, `${id}.hurtbox.width`, DEFAULT_HURTBOX.width),
      height: positiveNumber(source.hurtbox?.height, `${id}.hurtbox.height`, DEFAULT_HURTBOX.height),
    },
    resistances: {
      delivery: { ...neutralResistances.delivery, ...(source.resistances?.delivery ?? {}) },
      essence: { ...neutralResistances.essence, ...(source.resistances?.essence ?? {}) },
    },
    attackIds,
    movementIntent: { x: 0, y: 0 },
    activeAttack: null,
    offensiveCooldownRemainingMs: 0,
    attackCooldowns: Object.fromEntries(attackIds.map((attackId) => [attackId, 0])),
    statuses: clone(source.statuses ?? []),
  };
}

/** Pure typed damage calculation shared by hit resolution and UI previews. */
export function calculateActionDamage(attacker, target, attack) {
  const base = Math.max(
    1,
    Math.floor((attacker.power ?? 0) + (attack.power ?? 0) - Math.floor((target.guard ?? 0) / 3)),
  );
  const deliveryMultiplier = attack.delivery
    ? (target.resistances?.delivery?.[attack.delivery] ?? 1)
    : 1;
  const essenceMultiplier = attack.essence
    ? (target.resistances?.essence?.[attack.essence] ?? 1)
    : 1;
  const damage = Math.max(0, Math.round(base * deliveryMultiplier * essenceMultiplier));
  return { base, deliveryMultiplier, essenceMultiplier, damage };
}

function actorHurtbox(actor) {
  return {
    left: actor.position.x - actor.hurtbox.width / 2,
    right: actor.position.x + actor.hurtbox.width / 2,
    top: actor.position.y - actor.hurtbox.height,
    bottom: actor.position.y,
  };
}

/** Build the current world-space hitbox for a facing-aware attack. */
export function attackWorldHitbox(actor, attack) {
  const { offsetX, offsetY, width, height } = attack.hitbox;
  const left = actor.facing === 1
    ? actor.position.x + offsetX
    : actor.position.x - offsetX - width;
  return {
    left,
    right: left + width,
    top: actor.position.y - offsetY - height,
    bottom: actor.position.y - offsetY,
  };
}

function overlaps(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function phaseFor(activeAttack, attack) {
  if (activeAttack.elapsedMs < attack.windupMs) return ACTION_PHASES.WINDUP;
  if (activeAttack.elapsedMs < attack.windupMs + attack.activeMs) return ACTION_PHASES.ACTIVE;
  return ACTION_PHASES.RECOVERY;
}

/**
 * Status adapters are optional deterministic extension points:
 * - modifyMovement({ actor, intent, speed, stepMs, nowMs, kernel })
 * - modifyDamage({ attacker, target, attack, resolution, nowMs, kernel })
 * - afterHit({ attacker, target, attack, resolution, event, kernel })
 * - onFixedStep({ nowMs, stepMs, kernel })
 *
 * Actor status payloads are copied into `actor.statuses` and left opaque to the
 * kernel. Hooks can interpret and update them without coupling this core to a
 * particular status catalogue. `physicsHooks.resolveGround` can return
 * `{ grounded, groundY }` for authored platforms; the default is stage.groundY.
 */
export class ActionCombatKernel {
  constructor(options = {}) {
    this.fixedStepMs = nonNegativeInteger(
      options.fixedStepMs,
      'fixedStepMs',
      ACTION_FIXED_STEP_MS,
    );
    if (this.fixedStepMs === 0) throw new RangeError('fixedStepMs must be greater than zero.');
    this.stage = normalizeStage(options.stage);
    this.statusHooks = options.statusHooks ?? {};
    this.physicsHooks = options.physicsHooks ?? {};
    this.attacks = Object.freeze(Object.fromEntries(
      Object.entries(options.attacks ?? {}).map(([id, attack]) => [id, normalizeAttack(id, attack, this.fixedStepMs)]),
    ));
    this.actorOrder = [];
    this.actors = new Map();
    for (const source of options.actors ?? []) {
      const actor = normalizeActor(source, this.attacks, this.stage);
      if (this.actors.has(actor.id)) throw new RangeError(`Duplicate actor id ${actor.id}.`);
      this.actorOrder.push(actor.id);
      this.actors.set(actor.id, actor);
    }
    if (this.actorOrder.length === 0) throw new RangeError('Action combat requires at least one actor.');
    this.nowMs = 0;
    this.accumulatorMs = 0;
    this.eventSequence = 0;
    this.events = [];
    this.outcome = null;
  }

  getActor(actorId) {
    return this.actors.get(actorId) ?? null;
  }

  setMovement(actorId, intent) {
    const actor = this.getActor(actorId);
    if (!actor) return { ok: false, reason: 'unknown-actor' };
    if (actor.hp <= 0) return { ok: false, reason: 'actor-defeated' };
    actor.movementIntent = normalizeIntent(intent);
    return { ok: true, intent: { ...actor.movementIntent } };
  }

  requestJump(actorId) {
    const actor = this.getActor(actorId);
    if (!actor) return { ok: false, reason: 'unknown-actor' };
    if (actor.hp <= 0) return { ok: false, reason: 'actor-defeated' };
    if (this.outcome) return { ok: false, reason: 'combat-ended' };
    if (actor.activeAttack) return { ok: false, reason: 'animation-commitment' };
    if (!actor.grounded) return { ok: false, reason: 'airborne' };
    actor.grounded = false;
    actor.velocity.y = -actor.jumpSpeed;
    this._emit('jump', { actorId, velocityY: actor.velocity.y });
    return { ok: true, actorId, velocityY: actor.velocity.y };
  }

  /** Return UI-ready shared, individual, and effective cooldown milliseconds. */
  getAttackState(actorId, attackId) {
    const actor = this.getActor(actorId);
    const attack = this.attacks[attackId];
    if (!actor || !attack || !actor.attackIds.includes(attackId)) return null;
    const individualCooldownRemainingMs = actor.attackCooldowns[attackId] ?? 0;
    const sharedCooldownRemainingMs = actor.offensiveCooldownRemainingMs;
    const committed = actor.activeAttack != null;
    const effectiveCooldownRemainingMs = Math.max(
      sharedCooldownRemainingMs,
      individualCooldownRemainingMs,
    );
    let reason = null;
    if (actor.hp <= 0) reason = 'actor-defeated';
    else if (this.outcome) reason = 'combat-ended';
    else if (committed) reason = 'animation-commitment';
    else if (sharedCooldownRemainingMs > 0) reason = 'shared-offensive-cooldown';
    else if (individualCooldownRemainingMs > 0) reason = 'attack-cooldown';
    return deepFreeze({
      actorId,
      attackId,
      ready: reason == null,
      reason,
      animationPhase: actor.activeAttack ? phaseFor(actor.activeAttack, this.attacks[actor.activeAttack.attackId]) : null,
      sharedCooldownRemainingMs,
      individualCooldownRemainingMs,
      effectiveCooldownRemainingMs,
    });
  }

  requestAttack(actorId, attackId) {
    const state = this.getAttackState(actorId, attackId);
    if (!state) return { ok: false, reason: 'unknown-attack' };
    if (!state.ready) return { ok: false, reason: state.reason, remainingMs: state.effectiveCooldownRemainingMs };
    const actor = this.getActor(actorId);
    const attack = this.attacks[attackId];
    actor.activeAttack = {
      attackId,
      elapsedMs: 0,
      hitboxResolved: false,
      startedAtMs: this.nowMs,
    };
    actor.movementIntent = { ...actor.movementIntent };
    this._emit('attack-start', {
      actorId,
      attackId,
      phase: phaseFor(actor.activeAttack, attack),
      animationDurationMs: attack.windupMs + attack.activeMs + attack.recoveryMs,
    });
    return {
      ok: true,
      actorId,
      attackId,
      startedAtMs: this.nowMs,
      animationEndsAtMs: this.nowMs + attack.windupMs + attack.activeMs + attack.recoveryMs,
    };
  }

  /** Advance wall-clock input through integer fixed updates only. */
  advance(elapsedMs) {
    const elapsed = nonNegativeInteger(elapsedMs, 'elapsedMs');
    this.accumulatorMs += elapsed;
    let steps = 0;
    while (this.accumulatorMs >= this.fixedStepMs) {
      this._fixedUpdate();
      this.accumulatorMs -= this.fixedStepMs;
      steps += 1;
    }
    return { steps, accumulatorMs: this.accumulatorMs, snapshot: this.snapshot() };
  }

  step(count = 1) {
    if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('step count must be a non-negative integer.');
    for (let index = 0; index < count; index += 1) this._fixedUpdate();
    return this.snapshot();
  }

  drainEvents() {
    const events = clone(this.events);
    this.events.length = 0;
    return deepFreeze(events);
  }

  snapshot() {
    const actors = this.actorOrder.map((actorId) => {
      const actor = this.getActor(actorId);
      const activeAttack = actor.activeAttack
        ? {
            ...actor.activeAttack,
            phase: phaseFor(actor.activeAttack, this.attacks[actor.activeAttack.attackId]),
          }
        : null;
      const attackStates = Object.fromEntries(actor.attackIds.map((attackId) => {
        const state = this.getAttackState(actor.id, attackId);
        return [attackId, {
          ready: state.ready,
          reason: state.reason,
          sharedCooldownRemainingMs: state.sharedCooldownRemainingMs,
          individualCooldownRemainingMs: state.individualCooldownRemainingMs,
          effectiveCooldownRemainingMs: state.effectiveCooldownRemainingMs,
        }];
      }));
      return {
        id: actor.id,
        name: actor.name,
        faction: actor.faction,
        level: actor.level,
        hp: actor.hp,
        maxHp: actor.maxHp,
        position: { ...actor.position },
        velocity: { ...actor.velocity },
        grounded: actor.grounded,
        facing: actor.facing,
        movementIntent: { ...actor.movementIntent },
        activeAttack,
        offensiveCooldownRemainingMs: actor.offensiveCooldownRemainingMs,
        attackCooldowns: { ...actor.attackCooldowns },
        attackStates,
        statuses: clone(actor.statuses),
      };
    });
    return deepFreeze({
      schemaVersion: ACTION_COMBAT_SNAPSHOT_VERSION,
      fixedStepMs: this.fixedStepMs,
      nowMs: this.nowMs,
      accumulatorMs: this.accumulatorMs,
      stage: { ...this.stage },
      outcome: this.outcome,
      actors,
    });
  }

  _fixedUpdate() {
    this.nowMs += this.fixedStepMs;
    this._tickCooldowns();
    this._advanceAttackAnimations();
    this._updateOutcome();
    if (!this.outcome) {
      this._updateEnemyActions();
      this._applyMovement();
    }
    this.statusHooks.onFixedStep?.({
      nowMs: this.nowMs,
      stepMs: this.fixedStepMs,
      kernel: this,
    });
  }

  _tickCooldowns() {
    for (const actorId of this.actorOrder) {
      const actor = this.getActor(actorId);
      actor.offensiveCooldownRemainingMs = Math.max(
        0,
        actor.offensiveCooldownRemainingMs - this.fixedStepMs,
      );
      for (const attackId of actor.attackIds) {
        actor.attackCooldowns[attackId] = Math.max(
          0,
          actor.attackCooldowns[attackId] - this.fixedStepMs,
        );
      }
    }
  }

  _advanceAttackAnimations() {
    for (const actorId of this.actorOrder) {
      const actor = this.getActor(actorId);
      const active = actor.activeAttack;
      if (!active) continue;
      if (actor.hp <= 0) {
        actor.activeAttack = null;
        this._emit('attack-cancelled', { actorId, attackId: active.attackId, reason: 'actor-defeated' });
        continue;
      }
      const attack = this.attacks[active.attackId];
      const previousElapsedMs = active.elapsedMs;
      active.elapsedMs += this.fixedStepMs;
      if (!active.hitboxResolved
        && previousElapsedMs < attack.windupMs + attack.activeMs
        && active.elapsedMs >= attack.windupMs) {
        this._resolveHitbox(actor, attack, active);
      }
      const animationDurationMs = attack.windupMs + attack.activeMs + attack.recoveryMs;
      if (active.elapsedMs >= animationDurationMs) this._completeAttack(actor, attack);
    }
  }

  _resolveHitbox(attacker, attack, active) {
    active.hitboxResolved = true;
    const hitbox = attackWorldHitbox(attacker, attack);
    const targetIds = [];
    for (const targetId of this.actorOrder) {
      const target = this.getActor(targetId);
      if (target.hp <= 0 || target.faction === attacker.faction) continue;
      if (!overlaps(hitbox, actorHurtbox(target))) continue;
      let resolution = calculateActionDamage(attacker, target, attack);
      const modified = this.statusHooks.modifyDamage?.({
        attacker,
        target,
        attack,
        resolution: { ...resolution },
        nowMs: this.nowMs,
        kernel: this,
      });
      if (modified != null) {
        const requestedDamage = typeof modified === 'number' ? modified : modified.damage;
        if (requestedDamage != null) {
          resolution = {
            ...resolution,
            damage: Math.max(0, Math.round(finiteNumber(requestedDamage, 'status-modified damage'))),
          };
        }
      }
      const hpBefore = target.hp;
      target.hp = Math.max(0, target.hp - resolution.damage);
      targetIds.push(targetId);
      const event = this._emit('hit', {
        actorId: attacker.id,
        targetId,
        attackId: attack.id,
        delivery: attack.delivery,
        essence: attack.essence,
        ...resolution,
        hpBefore,
        hpAfter: target.hp,
      });
      this.statusHooks.afterHit?.({ attacker, target, attack, resolution, event, kernel: this });
    }
    this._emit('hitbox-resolved', {
      actorId: attacker.id,
      attackId: attack.id,
      targetIds,
      hitbox,
    });
  }

  _completeAttack(actor, attack) {
    const sharedCooldownMs = levelAdjustedCooldownMs(actor.offensiveCooldownMs, actor.level);
    const authoredIndividualMs = attack.cooldownMs == null
      ? 0
      : levelAdjustedCooldownMs(attack.cooldownMs, actor.level);
    const individualCooldownMs = attack.cooldownMs == null
      ? 0
      : Math.max(sharedCooldownMs, authoredIndividualMs);
    actor.offensiveCooldownRemainingMs = sharedCooldownMs;
    actor.attackCooldowns[attack.id] = individualCooldownMs;
    actor.activeAttack = null;
    this._emit('attack-complete', {
      actorId: actor.id,
      attackId: attack.id,
      sharedCooldownMs,
      individualCooldownMs,
    });
  }

  _updateEnemyActions() {
    for (const actorId of this.actorOrder) {
      const actor = this.getActor(actorId);
      if (actor.hp <= 0 || actor.ai !== 'deterministic-chase' || actor.activeAttack) continue;
      const target = this._nearestOpponent(actor);
      if (!target) {
        actor.movementIntent = { x: 0, y: 0 };
        continue;
      }
      if (target.position.x !== actor.position.x) {
        actor.facing = target.position.x > actor.position.x ? 1 : -1;
      }
      const usableAttack = actor.attackIds.find((attackId) => {
        const state = this.getAttackState(actor.id, attackId);
        return state.ready && overlaps(attackWorldHitbox(actor, this.attacks[attackId]), actorHurtbox(target));
      });
      if (usableAttack) {
        actor.movementIntent = { x: 0, y: 0 };
        this.requestAttack(actor.id, usableAttack);
        this._emit('enemy-decision', { actorId: actor.id, action: 'attack', attackId: usableAttack, targetId: target.id });
        continue;
      }
      const delta = { x: target.position.x - actor.position.x };
      actor.movementIntent = normalizeIntent(delta);
      this._emit('enemy-decision', { actorId: actor.id, action: 'move', targetId: target.id, intent: { ...actor.movementIntent } });
    }
  }

  _nearestOpponent(actor) {
    let best = null;
    let bestDistance = Infinity;
    for (const candidateId of this.actorOrder) {
      const candidate = this.getActor(candidateId);
      if (candidate.hp <= 0 || candidate.faction === actor.faction) continue;
      const dx = candidate.position.x - actor.position.x;
      const dy = candidate.position.y - actor.position.y;
      const squaredDistance = dx * dx + dy * dy;
      if (squaredDistance < bestDistance) {
        best = candidate;
        bestDistance = squaredDistance;
      }
    }
    return best;
  }

  _applyMovement() {
    for (const actorId of this.actorOrder) {
      const actor = this.getActor(actorId);
      if (actor.hp <= 0) continue;
      let intent = { ...actor.movementIntent };
      let speed = actor.moveSpeed;
      const modified = this.statusHooks.modifyMovement?.({
        actor,
        intent: { ...intent },
        speed,
        stepMs: this.fixedStepMs,
        nowMs: this.nowMs,
        kernel: this,
      });
      if (typeof modified === 'number') speed = Math.max(0, finiteNumber(modified, 'status-modified speed'));
      else if (modified) {
        if (modified.speed != null) speed = Math.max(0, finiteNumber(modified.speed, 'status-modified speed'));
        if (modified.intent != null) intent = normalizeIntent(modified.intent);
      }
      const committed = actor.activeAttack != null;
      const seconds = this.fixedStepMs / 1000;
      actor.velocity.x = committed ? 0 : intent.x * speed;
      if (!committed && intent.x !== 0) actor.facing = intent.x > 0 ? 1 : -1;
      actor.position.x = roundPosition(clamp(
        actor.position.x + actor.velocity.x * seconds,
        this.stage.minX,
        this.stage.maxX,
      ));

      if (!actor.grounded) actor.velocity.y += actor.gravity * seconds;
      const previousPosition = { ...actor.position };
      const proposedPosition = {
        x: actor.position.x,
        y: clamp(actor.position.y + actor.velocity.y * seconds, this.stage.minY, this.stage.maxY),
      };
      const resolved = this.physicsHooks.resolveGround?.({
        actor,
        previousPosition,
        proposedPosition: { ...proposedPosition },
        stage: this.stage,
        nowMs: this.nowMs,
        kernel: this,
      });
      const groundY = finiteNumber(resolved?.groundY ?? this.stage.groundY, 'resolved groundY');
      const lands = resolved?.grounded ?? (actor.velocity.y >= 0 && proposedPosition.y >= groundY);
      if (lands) {
        actor.position.y = roundPosition(clamp(groundY, this.stage.minY, this.stage.maxY));
        actor.velocity.y = 0;
        actor.grounded = true;
      } else {
        actor.position.y = roundPosition(proposedPosition.y);
        actor.grounded = false;
        if (actor.position.y === this.stage.minY && actor.velocity.y < 0) actor.velocity.y = 0;
      }
    }
  }

  _updateOutcome() {
    const livingFactions = new Set(this.actorOrder
      .map((actorId) => this.getActor(actorId))
      .filter((actor) => actor.hp > 0 && actor.faction !== 'neutral')
      .map((actor) => actor.faction));
    if (livingFactions.size > 1 || livingFactions.size === 0 || this.outcome) return;
    const [winner] = livingFactions;
    this.outcome = winner === 'player' ? 'victory' : winner === 'enemy' ? 'defeat' : `${winner}-wins`;
    this._emit('combat-end', { outcome: this.outcome, winner });
  }

  _emit(type, payload = {}) {
    const event = deepFreeze({ sequence: ++this.eventSequence, type, nowMs: this.nowMs, ...clone(payload) });
    this.events.push(event);
    return event;
  }
}

export function createActionCombat(options) {
  return new ActionCombatKernel(options);
}
