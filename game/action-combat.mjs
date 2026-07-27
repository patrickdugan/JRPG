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
export const ACTION_COMBAT_SNAPSHOT_VERSION = 5;
export const ACTION_TAG_COOLDOWN_MS = 240;
export const ACTION_HIT_STUN_MS = 100;
export const ACTION_HIT_INVULNERABILITY_MS = 240;
export const ACTION_HIT_FLASH_MS = 120;
export const ACTION_KNOCKBACK_SPEED_X = 160;
export const ACTION_KNOCKBACK_LIFT_SPEED_Y = 120;
export const MINIMUM_COOLDOWN_MULTIPLIER = 0.55;
export const COOLDOWN_REDUCTION_PER_LEVEL = 0.0125;
export const ACTION_ARMOR_CONSTANT = 60;

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
const COYOTE_WINDOW_MS = 100;
const JUMP_BUFFER_WINDOW_MS = 120;
const RELEASED_JUMP_GRAVITY_MULTIPLIER = 2.25;

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

/**
 * Universal movement grammar for the Action Lab. Durations remain fixed-step
 * multiples, and speeds derive from the actor rather than browser frame rate.
 */
export const ACTION_MANEUVERS = deepFreeze({
  dash: {
    id: 'dash',
    name: 'Dash',
    durationMs: 120,
    cooldownMs: 220,
    speedMultiplier: 3,
    gravityMultiplier: 0.2,
    availability: 'ground-or-air',
    cancelAfterMs: 40,
    cancelInto: ['jump', 'attack', 'slide', 'uppercut'],
    airUses: 1,
  },
  slide: {
    id: 'slide',
    name: 'Low Slide',
    durationMs: 200,
    cooldownMs: 260,
    speedMultiplier: 2,
    gravityMultiplier: 1,
    availability: 'ground-only',
    hurtboxHeightMultiplier: 0.5,
    cancelAfterMs: 80,
    cancelInto: ['jump', 'attack', 'uppercut'],
  },
  uppercut: {
    id: 'uppercut',
    name: 'Storm Uppercut',
    durationMs: 240,
    cooldownMs: 420,
    speedMultiplier: 1.05,
    launchMultiplier: 1.18,
    gravityMultiplier: 0.82,
    availability: 'ground-only',
    cancelAfterMs: 120,
    cancelInto: ['thunder-kick'],
    attack: {
      id: 'maneuver:uppercut',
      name: 'Storm Uppercut',
      delivery: 'crush',
      essence: 'storm',
      power: 7,
      activeStartMs: 20,
      activeEndMs: 180,
      hitbox: { offsetX: 2, offsetY: 4, width: 34, height: 62 },
    },
  },
  'thunder-kick': {
    id: 'thunder-kick',
    name: 'Thunder Kick',
    durationMs: 360,
    cooldownMs: 480,
    speedMultiplier: 1.75,
    diveSpeed: 420,
    gravityMultiplier: 0.35,
    availability: 'air-only',
    cancelAfterMs: 360,
    cancelInto: [],
    finishOnLanding: true,
    attack: {
      id: 'maneuver:thunder-kick',
      name: 'Thunder Kick',
      delivery: 'crush',
      essence: 'storm',
      power: 9,
      activeStartMs: 20,
      activeEndMs: 340,
      hitbox: { offsetX: 6, offsetY: -4, width: 42, height: 38 },
    },
  },
});

export const ACTION_MANEUVER_IDS = Object.freeze(Object.keys(ACTION_MANEUVERS));

/**
 * Character movement identities layered over the shared fixed-step grammar.
 *
 * The four input slots remain stable so keyboard, touch, accessibility, and AI
 * callers never need character-specific branches. A profile changes the name,
 * timing, geometry, and traversal resources behind those slots instead.
 */
export const ACTION_MOVEMENT_PROFILES = deepFreeze({
  standard: {
    id: 'standard',
    name: 'Standard movement',
    moveSpeedMultiplier: 1,
    jumpSpeed: DEFAULT_JUMP_SPEED,
    gravity: DEFAULT_GRAVITY,
    airJumpUses: 0,
    maneuvers: {},
  },
  hunter: {
    id: 'hunter',
    name: 'Measured hunter',
    moveSpeedMultiplier: 0.96,
    jumpSpeed: 500,
    gravity: 1900,
    airJumpUses: 0,
    maneuvers: {
      dash: {
        name: 'Hunter Step', durationMs: 120, cooldownMs: 240, speedMultiplier: 2.8,
        availability: 'ground-only', airUses: 0,
      },
      slide: {
        name: 'Salt-Knee Slide', durationMs: 220, cooldownMs: 280, speedMultiplier: 1.8,
      },
      uppercut: {
        name: 'Rising Stake', durationMs: 240, cooldownMs: 440, launchMultiplier: 1.5,
        gravityMultiplier: 0.72,
        attack: {
          id: 'maneuver:hunter:rising-stake', name: 'Rising Stake', delivery: 'pierce', essence: 'radiance', power: 9,
          activeStartMs: 20, activeEndMs: 180,
          hitbox: { offsetX: 4, offsetY: 6, width: 32, height: 60 },
        },
      },
      'thunder-kick': {
        name: 'Falling Stake', durationMs: 340, cooldownMs: 500, speedMultiplier: 1.45, diveSpeed: 440,
        attack: {
          id: 'maneuver:hunter:falling-stake', name: 'Falling Stake', delivery: 'pierce', essence: 'radiance', power: 11,
          activeStartMs: 40, activeEndMs: 320,
          hitbox: { offsetX: 8, offsetY: -2, width: 38, height: 42 },
        },
      },
    },
  },
  vampire: {
    id: 'vampire',
    name: 'Vampire night passage',
    moveSpeedMultiplier: 0.98,
    jumpSpeed: 560,
    gravity: 1450,
    airJumpUses: 0,
    maneuvers: {
      dash: {
        name: 'Night Passage', durationMs: 160, cooldownMs: 300, speedMultiplier: 2.7,
        gravityMultiplier: 0, availability: 'ground-or-air', cancelAfterMs: 60, airUses: 2,
      },
      slide: {
        name: 'Low Shadow', durationMs: 200, cooldownMs: 280, speedMultiplier: 2.15,
      },
      uppercut: {
        name: 'Vesper Ascent', durationMs: 280, cooldownMs: 460, speedMultiplier: 0.95,
        launchMultiplier: 1.3, gravityMultiplier: 0.65,
        attack: {
          id: 'maneuver:vampire:vesper-ascent', name: 'Vesper Ascent', delivery: 'arcane', essence: 'umbral', power: 8,
          activeStartMs: 40, activeEndMs: 220,
          hitbox: { offsetX: 0, offsetY: 4, width: 38, height: 66 },
        },
      },
      'thunder-kick': {
        name: 'Penitent Fall', durationMs: 400, cooldownMs: 520, speedMultiplier: 1.55, diveSpeed: 380,
        gravityMultiplier: 0.2,
        attack: {
          id: 'maneuver:vampire:penitent-fall', name: 'Penitent Fall', delivery: 'arcane', essence: 'umbral', power: 10,
          activeStartMs: 40, activeEndMs: 380,
          hitbox: { offsetX: 4, offsetY: -6, width: 46, height: 42 },
        },
      },
    },
  },
  infiltrator: {
    id: 'infiltrator',
    name: 'Roofline infiltrator',
    moveSpeedMultiplier: 1.18,
    jumpSpeed: 600,
    gravity: 1750,
    airJumpUses: 0,
    wallTechnique: {
      clingFallSpeed: 88,
      jumpHorizontalMultiplier: 1.85,
      jumpVerticalMultiplier: 0.95,
      commitmentMs: 120,
    },
    maneuvers: {
      dash: {
        name: 'Roofline Rush', durationMs: 100, cooldownMs: 180, speedMultiplier: 3.5,
        gravityMultiplier: 0.12, availability: 'ground-or-air', cancelAfterMs: 40, airUses: 1,
      },
      slide: {
        name: 'Eaves Slide', durationMs: 180, cooldownMs: 220, speedMultiplier: 2.45,
        hurtboxHeightMultiplier: 0.42, cancelAfterMs: 60,
      },
      uppercut: {
        name: 'Gutter Hook', durationMs: 220, cooldownMs: 360, speedMultiplier: 1.2,
        launchMultiplier: 1.32, gravityMultiplier: 0.78, cancelAfterMs: 100,
        attack: {
          id: 'maneuver:infiltrator:gutter-hook', name: 'Gutter Hook', delivery: 'pierce', essence: null, power: 7,
          activeStartMs: 20, activeEndMs: 160,
          hitbox: { offsetX: 4, offsetY: 6, width: 32, height: 64 },
        },
      },
      'thunder-kick': {
        name: 'Rafter Dive', durationMs: 320, cooldownMs: 420, speedMultiplier: 1.95, diveSpeed: 460,
        attack: {
          id: 'maneuver:infiltrator:rafter-dive', name: 'Rafter Dive', delivery: 'cut', essence: null, power: 8,
          activeStartMs: 20, activeEndMs: 300,
          hitbox: { offsetX: 8, offsetY: -4, width: 40, height: 36 },
        },
      },
    },
  },
  'weather-scholar': {
    id: 'weather-scholar',
    name: 'Fourfold weather step',
    moveSpeedMultiplier: 1.04,
    jumpSpeed: 540,
    gravity: 1500,
    airJumpUses: 1,
    maneuvers: {
      dash: {
        name: 'Crosswind Step', durationMs: 180, cooldownMs: 280, speedMultiplier: 2.45,
        gravityMultiplier: 0.08, availability: 'ground-or-air', cancelAfterMs: 60, airUses: 1,
      },
      slide: {
        name: 'Ice Skim', durationMs: 240, cooldownMs: 300, speedMultiplier: 1.9,
        hurtboxHeightMultiplier: 0.55,
      },
      uppercut: {
        name: 'Stormlift', durationMs: 280, cooldownMs: 440, speedMultiplier: 0.9,
        launchMultiplier: 1.28, gravityMultiplier: 0.58,
        attack: {
          id: 'maneuver:weather-scholar:stormlift', name: 'Stormlift', delivery: 'arcane', essence: 'storm', power: 8,
          activeStartMs: 20, activeEndMs: 220,
          hitbox: { offsetX: -2, offsetY: 2, width: 42, height: 70 },
        },
      },
      'thunder-kick': {
        name: 'Thunderfall', durationMs: 380, cooldownMs: 500, speedMultiplier: 1.6, diveSpeed: 400,
        gravityMultiplier: 0.25,
        attack: {
          id: 'maneuver:weather-scholar:thunderfall', name: 'Thunderfall', delivery: 'arcane', essence: 'storm', power: 10,
          activeStartMs: 20, activeEndMs: 360,
          hitbox: { offsetX: 4, offsetY: -8, width: 48, height: 44 },
        },
      },
    },
  },
});

export const ACTION_MOVEMENT_PROFILE_BY_ACTOR_ID = deepFreeze({
  ren: 'infiltrator',
  lise: 'hunter',
  mateus: 'vampire',
  miyo: 'weather-scholar',
});

function movementProfileForId(profileId) {
  const normalizedId = String(profileId ?? 'standard');
  const profile = ACTION_MOVEMENT_PROFILES[normalizedId];
  if (!profile) throw new RangeError(`Unknown action movement profile ${normalizedId}.`);
  return profile;
}

function mergeManeuver(base, override = {}) {
  const merged = { ...base, ...override };
  if (base.attack || override.attack) {
    merged.attack = {
      ...(base.attack ?? {}),
      ...(override.attack ?? {}),
      hitbox: {
        ...(base.attack?.hitbox ?? {}),
        ...(override.attack?.hitbox ?? {}),
      },
    };
  }
  return deepFreeze(merged);
}

function maneuverSpecsForProfile(profile) {
  return deepFreeze(Object.fromEntries(ACTION_MANEUVER_IDS.map((maneuverId) => [
    maneuverId,
    mergeManeuver(ACTION_MANEUVERS[maneuverId], profile.maneuvers?.[maneuverId]),
  ])));
}

export const ACTION_COMPANION_AI = deepFreeze({
  followDistancePx: 96,
  leashDistancePx: 240,
  engageDistancePx: 260,
  verticalFollowDistancePx: 48,
  verticalAlignmentDistancePx: 42,
});

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

function factionsAreHostile(first, second) {
  if (first === 'neutral' || second === 'neutral' || first === second) return false;
  if (first === 'player' || second === 'player') {
    return (first === 'player' && second === 'enemy')
      || (first === 'enemy' && second === 'player');
  }
  return true;
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
    kind: String(source.kind ?? 'skill'),
    delivery: source.delivery ?? null,
    essence: source.essence ?? null,
    power: finiteNumber(source.power ?? 0, `${id}.power`),
    powerScale: finiteNumber(source.powerScale ?? 1, `${id}.powerScale`),
    guardPierce: finiteNumber(source.guardPierce ?? 0, `${id}.guardPierce`),
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
  if (attack.powerScale < 0) throw new RangeError(`${id}.powerScale must not be negative.`);
  if (attack.guardPierce < 0 || attack.guardPierce > 1) {
    throw new RangeError(`${id}.guardPierce must be between zero and one.`);
  }
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
  const movementProfile = movementProfileForId(source.movementProfileId);
  const maneuverSpecs = maneuverSpecsForProfile(movementProfile);
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
    movementProfileId: movementProfile.id,
    movementProfileName: movementProfile.name,
    movementProfile,
    maneuverSpecs,
    moveSpeed: roundPosition(
      positiveNumber(source.moveSpeed, `${id}.moveSpeed`, 120) * movementProfile.moveSpeedMultiplier,
    ),
    gravity: positiveNumber(source.gravity, `${id}.gravity`, movementProfile.gravity),
    jumpSpeed: positiveNumber(source.jumpSpeed, `${id}.jumpSpeed`, movementProfile.jumpSpeed),
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
    jumpHeld: false,
    jumpBufferRemainingMs: 0,
    coyoteRemainingMs: 0,
    airDashUsesRemaining: maneuverSpecs.dash.airUses,
    airJumpUsesRemaining: movementProfile.airJumpUses,
    wallContactSide: null,
    wallJumpRemainingMs: 0,
    wallJumpDirection: 0,
    activeManeuver: null,
    maneuverCooldowns: Object.fromEntries(ACTION_MANEUVER_IDS.map((maneuverId) => [maneuverId, 0])),
    activeAttack: null,
    offensiveCooldownRemainingMs: 0,
    attackCooldowns: Object.fromEntries(attackIds.map((attackId) => [attackId, 0])),
    hitStunRemainingMs: 0,
    hitInvulnerabilityRemainingMs: 0,
    hitFlashRemainingMs: 0,
    knockbackVelocityX: 0,
    lastImpactComboId: null,
    statuses: clone(source.statuses ?? []),
  };
}

/** Pure typed damage calculation shared by hit resolution and UI previews. */
export function calculateActionDamage(attacker, target, attack) {
  const rawPower = Math.max(
    1,
    Math.floor(((attacker.power ?? 0) * (attack.powerScale ?? 1)) + (attack.power ?? 0)),
  );
  const effectiveGuard = Math.max(0, target.guard ?? 0) * (1 - (attack.guardPierce ?? 0));
  const armorMultiplier = ACTION_ARMOR_CONSTANT / (ACTION_ARMOR_CONSTANT + effectiveGuard);
  const base = Math.max(1, Math.round(rawPower * armorMultiplier));
  const deliveryMultiplier = attack.delivery
    ? (target.resistances?.delivery?.[attack.delivery] ?? 1)
    : 1;
  const essenceMultiplier = attack.essence
    ? (target.resistances?.essence?.[attack.essence] ?? 1)
    : 1;
  const damage = Math.max(0, Math.round(base * deliveryMultiplier * essenceMultiplier));
  return { base, deliveryMultiplier, essenceMultiplier, damage };
}

export function actionActorHurtbox(actor) {
  const maneuver = actor.activeManeuver
    ? (actor.maneuverSpecs?.[actor.activeManeuver.id] ?? ACTION_MANEUVERS[actor.activeManeuver.id])
    : null;
  const height = actor.hurtbox.height * (maneuver?.hurtboxHeightMultiplier ?? 1);
  return {
    left: actor.position.x - actor.hurtbox.width / 2,
    right: actor.position.x + actor.hurtbox.width / 2,
    top: actor.position.y - height,
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
 * - afterAttackComplete({ actor, attack, active, event, kernel })
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
    this.automaticVictory = options.automaticVictory !== false;
    const requestedControlledActorId = options.controlledActorId == null
      ? null
      : String(options.controlledActorId);
    const livingPartyIds = this.actorOrder.filter((actorId) => {
      const actor = this.getActor(actorId);
      return actor.faction === 'player' && actor.hp > 0;
    });
    if (requestedControlledActorId != null) {
      const requestedActor = this.getActor(requestedControlledActorId);
      if (!requestedActor) throw new RangeError(`Unknown controlled actor ${requestedControlledActorId}.`);
      if (requestedActor.faction !== 'player') {
        throw new RangeError(`Controlled actor ${requestedControlledActorId} must belong to the player faction.`);
      }
      if (requestedActor.hp <= 0) {
        throw new RangeError(`Controlled actor ${requestedControlledActorId} must be living.`);
      }
    }
    this.controlledActorId = requestedControlledActorId ?? livingPartyIds[0] ?? null;
    this.tagCooldownRemainingMs = 0;
    this.nowMs = 0;
    this.accumulatorMs = 0;
    this.eventSequence = 0;
    this.events = [];
    this.outcome = null;
  }

  getActor(actorId) {
    return this.actors.get(actorId) ?? null;
  }

  /** Transfer player input authority without mutating either actor's live state. */
  switchControlledActor(actorId) {
    const requestedActorId = String(actorId ?? '');
    const actor = this.getActor(requestedActorId);
    if (!actor) return { ok: false, reason: 'unknown-actor' };
    if (actor.faction !== 'player') return { ok: false, reason: 'not-party-actor' };
    if (actor.hp <= 0) return { ok: false, reason: 'actor-defeated' };
    if (this.outcome) return { ok: false, reason: 'combat-ended' };
    const previousActorId = this.controlledActorId;
    if (previousActorId === requestedActorId) {
      return { ok: true, changed: false, previousActorId, controlledActorId: requestedActorId };
    }
    if (this.tagCooldownRemainingMs > 0) {
      return { ok: false, reason: 'tag-cooldown', remainingMs: this.tagCooldownRemainingMs };
    }
    this.controlledActorId = requestedActorId;
    this.tagCooldownRemainingMs = ACTION_TAG_COOLDOWN_MS;
    this._emit('control-switch', {
      previousActorId,
      actorId: requestedActorId,
      reason: 'player-request',
    });
    return { ok: true, changed: true, previousActorId, controlledActorId: requestedActorId };
  }

  /** Alias for adapters that model control assignment rather than tag switching. */
  setControlledActor(actorId) {
    return this.switchControlledActor(actorId);
  }

  /** End an objective-driven battle while leaving automatic defeat authoritative. */
  conclude(outcome) {
    if (outcome !== 'victory' && outcome !== 'defeat') {
      return { ok: false, reason: 'invalid-outcome' };
    }
    if (this.outcome) return { ok: false, reason: 'combat-ended', outcome: this.outcome };
    this.outcome = outcome;
    const winner = outcome === 'victory' ? 'player' : 'enemy';
    this._emit('combat-end', { outcome, winner, reason: 'explicit-conclusion' });
    return { ok: true, outcome };
  }

  _playerControlFailure(actor) {
    if (actor.hitStunRemainingMs > 0) {
      return { ok: false, reason: 'hit-stun', remainingMs: actor.hitStunRemainingMs };
    }
    return actor.faction === 'player' && actor.id !== this.controlledActorId
      ? { ok: false, reason: 'not-controlled-actor', controlledActorId: this.controlledActorId }
      : null;
  }

  setMovement(actorId, intent) {
    const actor = this.getActor(actorId);
    if (!actor) return { ok: false, reason: 'unknown-actor' };
    if (actor.hp <= 0) return { ok: false, reason: 'actor-defeated' };
    const controlFailure = this._playerControlFailure(actor);
    if (controlFailure) return controlFailure;
    actor.movementIntent = normalizeIntent(intent);
    return { ok: true, intent: { ...actor.movementIntent } };
  }

  setJumpHeld(actorId, held) {
    const actor = this.getActor(actorId);
    if (!actor) return { ok: false, reason: 'unknown-actor' };
    if (actor.hp <= 0) return { ok: false, reason: 'actor-defeated' };
    const controlFailure = this._playerControlFailure(actor);
    if (controlFailure) return controlFailure;
    actor.jumpHeld = Boolean(held);
    return { ok: true, held: actor.jumpHeld };
  }

  _canCancelManeuverInto(actor, nextAction) {
    if (!actor.activeManeuver) return false;
    const spec = actor.maneuverSpecs[actor.activeManeuver.id];
    return actor.activeManeuver.elapsedMs >= spec.cancelAfterMs
      && spec.cancelInto.includes(nextAction);
  }

  _startJump(actor, reason = null, held = true) {
    actor.activeManeuver = null;
    actor.grounded = false;
    actor.velocity.y = -actor.jumpSpeed;
    actor.jumpHeld = Boolean(held);
    actor.jumpBufferRemainingMs = 0;
    actor.coyoteRemainingMs = 0;
    this._emit('jump', {
      actorId: actor.id,
      velocityY: actor.velocity.y,
      ...(reason == null ? {} : { reason }),
    });
    return { ok: true, actorId: actor.id, velocityY: actor.velocity.y };
  }

  _startWallJump(actor, held = true) {
    const wall = actor.movementProfile.wallTechnique;
    const wallSide = actor.wallContactSide;
    actor.activeManeuver = null;
    actor.grounded = false;
    actor.wallContactSide = null;
    actor.wallJumpDirection = -wallSide;
    actor.wallJumpRemainingMs = wall.commitmentMs;
    actor.velocity.x = actor.wallJumpDirection * actor.moveSpeed * wall.jumpHorizontalMultiplier;
    actor.velocity.y = -actor.jumpSpeed * wall.jumpVerticalMultiplier;
    actor.jumpHeld = Boolean(held);
    actor.jumpBufferRemainingMs = 0;
    actor.coyoteRemainingMs = 0;
    this._emit('wall-jump', {
      actorId: actor.id,
      wallSide,
      velocityX: actor.velocity.x,
      velocityY: actor.velocity.y,
      commitmentMs: wall.commitmentMs,
    });
    return { ok: true, actorId: actor.id, wallJump: true, wallSide };
  }

  requestJump(actorId, options = {}) {
    const actor = this.getActor(actorId);
    if (!actor) return { ok: false, reason: 'unknown-actor' };
    if (actor.hp <= 0) return { ok: false, reason: 'actor-defeated' };
    if (this.outcome) return { ok: false, reason: 'combat-ended' };
    const controlFailure = this._playerControlFailure(actor);
    if (controlFailure) return controlFailure;
    if (actor.activeAttack) return { ok: false, reason: 'animation-commitment' };
    if (actor.activeManeuver) {
      if (!this._canCancelManeuverInto(actor, 'jump')) return { ok: false, reason: 'maneuver-commitment' };
      this._finishManeuver(actor, 'cancelled', 'jump');
    }
    if (actor.grounded) return this._startJump(actor, null, options.held ?? true);
    if (actor.coyoteRemainingMs > 0) return this._startJump(actor, 'coyote-window', options.held ?? true);
    if (actor.wallContactSide != null && actor.movementProfile.wallTechnique) {
      return this._startWallJump(actor, options.held ?? true);
    }
    if (actor.airJumpUsesRemaining > 0) {
      actor.airJumpUsesRemaining -= 1;
      return this._startJump(actor, 'air-jump', options.held ?? true);
    }
    if (options.buffer) {
      if (options.held != null) actor.jumpHeld = Boolean(options.held);
      actor.jumpBufferRemainingMs = JUMP_BUFFER_WINDOW_MS;
      return { ok: true, actorId, buffered: true, windowMs: JUMP_BUFFER_WINDOW_MS };
    }
    return { ok: false, reason: 'airborne' };
  }

  getManeuverState(actorId, maneuverId) {
    const actor = this.getActor(actorId);
    const spec = actor?.maneuverSpecs?.[maneuverId];
    if (!actor || !spec) return null;
    const cooldownRemainingMs = actor.maneuverCooldowns[maneuverId] ?? 0;
    let reason = null;
    if (actor.hp <= 0) reason = 'actor-defeated';
    else if (this.outcome) reason = 'combat-ended';
    else if (actor.faction === 'player' && actor.id !== this.controlledActorId) reason = 'not-controlled-actor';
    else if (actor.hitStunRemainingMs > 0) reason = 'hit-stun';
    else if (actor.activeAttack) reason = 'animation-commitment';
    else if (cooldownRemainingMs > 0) reason = 'maneuver-cooldown';
    else if (actor.activeManeuver && !this._canCancelManeuverInto(actor, maneuverId)) reason = 'maneuver-commitment';
    else if (spec.availability === 'ground-only' && !actor.grounded) reason = 'requires-ground';
    else if (spec.availability === 'air-only' && actor.grounded) reason = 'requires-air';
    else if (maneuverId === 'dash' && !actor.grounded && actor.airDashUsesRemaining <= 0) reason = 'air-dash-spent';
    return deepFreeze({
      actorId,
      maneuverId,
      name: spec.name,
      ready: reason == null,
      reason,
      cooldownRemainingMs,
    });
  }

  _startManeuver(actor, maneuverId) {
    const spec = actor.maneuverSpecs[maneuverId];
    if (actor.activeManeuver) this._finishManeuver(actor, 'cancelled', maneuverId);
    const direction = actor.movementIntent.x === 0 ? actor.facing : (actor.movementIntent.x > 0 ? 1 : -1);
    actor.facing = direction;
    actor.activeManeuver = {
      id: maneuverId,
      elapsedMs: 0,
      startedAtMs: this.nowMs,
      direction,
      hitActorIds: [],
    };
    actor.maneuverCooldowns[maneuverId] = spec.cooldownMs;
    actor.jumpBufferRemainingMs = 0;
    if (maneuverId === 'dash' && !actor.grounded) {
      actor.airDashUsesRemaining -= 1;
      actor.velocity.y = 0;
    } else if (maneuverId === 'uppercut') {
      actor.grounded = false;
      actor.coyoteRemainingMs = 0;
      actor.velocity.y = -actor.jumpSpeed * spec.launchMultiplier;
    } else if (maneuverId === 'thunder-kick') {
      actor.grounded = false;
      actor.velocity.y = Math.max(actor.velocity.y, spec.diveSpeed);
    }
    this._emit('maneuver-start', {
      actorId: actor.id,
      maneuverId,
      name: spec.name,
      direction,
      durationMs: spec.durationMs,
      cooldownMs: spec.cooldownMs,
    });
    return {
      ok: true,
      actorId: actor.id,
      maneuverId,
      startedAtMs: this.nowMs,
      direction,
      durationMs: spec.durationMs,
    };
  }

  requestManeuver(actorId, maneuverId) {
    const actor = this.getActor(actorId);
    const spec = actor?.maneuverSpecs?.[maneuverId];
    if (!actor) return { ok: false, reason: 'unknown-actor' };
    if (!spec) return { ok: false, reason: 'unknown-maneuver' };
    if (actor.hp <= 0) return { ok: false, reason: 'actor-defeated' };
    if (this.outcome) return { ok: false, reason: 'combat-ended' };
    const controlFailure = this._playerControlFailure(actor);
    if (controlFailure) return controlFailure;
    const state = this.getManeuverState(actorId, maneuverId);
    if (!state.ready) return {
      ok: false,
      reason: state.reason,
      remainingMs: state.reason === 'hit-stun'
        ? actor.hitStunRemainingMs
        : state.cooldownRemainingMs,
    };

    return this._startManeuver(actor, maneuverId);
  }

  /** Return the actor-specific definition behind one stable input slot. */
  getManeuverDefinition(actorId, maneuverId) {
    const actor = this.getActor(actorId);
    const spec = actor?.maneuverSpecs?.[maneuverId];
    return spec ? deepFreeze(clone(spec)) : null;
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
    else if (actor.hitStunRemainingMs > 0) reason = 'hit-stun';
    else if (committed) reason = 'animation-commitment';
    else if (actor.activeManeuver) reason = 'maneuver-commitment';
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
    const actor = this.getActor(actorId);
    if (actor) {
      const controlFailure = this._playerControlFailure(actor);
      if (controlFailure) return controlFailure;
      if (actor.activeManeuver) {
        if (!this._canCancelManeuverInto(actor, 'attack')) {
          return { ok: false, reason: 'maneuver-commitment' };
        }
        this._finishManeuver(actor, 'cancelled', 'attack');
      }
    }
    return this._beginAttack(actorId, attackId);
  }

  /** Atomically begin a synchronized attack for two or more living party actors. */
  requestCombo(comboId, initiatorActorId, participants) {
    const normalizedComboId = typeof comboId === 'string' ? comboId.trim() : '';
    if (!normalizedComboId) return { ok: false, reason: 'invalid-combo-id' };
    if (this.outcome) return { ok: false, reason: 'combat-ended' };
    if (!Array.isArray(participants) || participants.length < 2) {
      return { ok: false, reason: 'invalid-participants' };
    }

    const normalizedInitiatorActorId = String(initiatorActorId ?? '');
    const initiator = this.getActor(normalizedInitiatorActorId);
    if (!initiator) return { ok: false, reason: 'unknown-actor', actorId: normalizedInitiatorActorId };
    if (initiator.faction !== 'player' || initiator.id !== this.controlledActorId) {
      return { ok: false, reason: 'not-controlled-actor', controlledActorId: this.controlledActorId };
    }
    if (initiator.hp <= 0) return { ok: false, reason: 'actor-defeated', actorId: initiator.id };

    const normalizedParticipants = [];
    const participantActorIds = new Set();
    for (const [participantIndex, participant] of participants.entries()) {
      if (!participant || typeof participant !== 'object') {
        return { ok: false, reason: 'invalid-participant', participantIndex };
      }
      const actorId = String(participant.actorId ?? '');
      const attackId = String(participant.attackId ?? '');
      if (!actorId || !attackId) {
        return { ok: false, reason: 'invalid-participant', participantIndex };
      }
      if (participantActorIds.has(actorId)) {
        return { ok: false, reason: 'duplicate-participant', actorId };
      }
      participantActorIds.add(actorId);
      normalizedParticipants.push({ actorId, attackId });
    }
    if (!participantActorIds.has(initiator.id)) {
      return { ok: false, reason: 'initiator-not-participant', actorId: initiator.id };
    }

    const validatedParticipants = [];
    for (const participant of normalizedParticipants) {
      const actor = this.getActor(participant.actorId);
      if (!actor) return { ok: false, reason: 'unknown-actor', actorId: participant.actorId };
      if (actor.hp <= 0) return { ok: false, reason: 'actor-defeated', actorId: actor.id };
      if (actor.faction !== initiator.faction) {
        return { ok: false, reason: 'faction-mismatch', actorId: actor.id };
      }
      const attack = this.attacks[participant.attackId];
      if (!attack || !actor.attackIds.includes(participant.attackId)) {
        return {
          ok: false,
          reason: 'unknown-attack',
          actorId: actor.id,
          attackId: participant.attackId,
        };
      }
      const state = this.getAttackState(actor.id, attack.id);
      if (!state.ready) {
        return {
          ok: false,
          reason: state.reason,
          actorId: actor.id,
          attackId: attack.id,
          remainingMs: state.reason === 'hit-stun'
            ? actor.hitStunRemainingMs
            : state.effectiveCooldownRemainingMs,
        };
      }
      validatedParticipants.push({ actor, attack });
    }

    this._emit('combo-start', {
      comboId: normalizedComboId,
      initiatorActorId: initiator.id,
      participants: normalizedParticipants,
    });
    for (const { actor, attack } of validatedParticipants) {
      this._startAttack(actor, attack, { comboId: normalizedComboId });
    }
    return {
      ok: true,
      comboId: normalizedComboId,
      initiatorActorId: initiator.id,
      startedAtMs: this.nowMs,
      participants: normalizedParticipants,
    };
  }

  _beginAttack(actorId, attackId) {
    const state = this.getAttackState(actorId, attackId);
    if (!state) return { ok: false, reason: 'unknown-attack' };
    if (!state.ready) {
      const actor = this.getActor(actorId);
      return {
        ok: false,
        reason: state.reason,
        remainingMs: state.reason === 'hit-stun'
          ? actor.hitStunRemainingMs
          : state.effectiveCooldownRemainingMs,
      };
    }
    const actor = this.getActor(actorId);
    const attack = this.attacks[attackId];
    return this._startAttack(actor, attack);
  }

  _startAttack(actor, attack, { comboId = null } = {}) {
    actor.activeAttack = {
      attackId: attack.id,
      elapsedMs: 0,
      hitboxResolved: false,
      startedAtMs: this.nowMs,
      ...(comboId == null ? {} : { comboId }),
    };
    actor.movementIntent = { ...actor.movementIntent };
    this._emit('attack-start', {
      actorId: actor.id,
      attackId: attack.id,
      ...(comboId == null ? {} : { comboId }),
      phase: phaseFor(actor.activeAttack, attack),
      animationDurationMs: attack.windupMs + attack.activeMs + attack.recoveryMs,
    });
    return {
      ok: true,
      actorId: actor.id,
      attackId: attack.id,
      ...(comboId == null ? {} : { comboId }),
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
        power: actor.power,
        guard: actor.guard,
        resistances: clone(actor.resistances),
        position: { ...actor.position },
        velocity: { ...actor.velocity },
        grounded: actor.grounded,
        facing: actor.facing,
        movementIntent: { ...actor.movementIntent },
        movementProfileId: actor.movementProfileId,
        movementProfileName: actor.movementProfileName,
        moveSpeed: actor.moveSpeed,
        gravity: actor.gravity,
        jumpSpeed: actor.jumpSpeed,
        jumpHeld: actor.jumpHeld,
        jumpBufferRemainingMs: actor.jumpBufferRemainingMs,
        coyoteRemainingMs: actor.coyoteRemainingMs,
        airDashUsesRemaining: actor.airDashUsesRemaining,
        airJumpUsesRemaining: actor.airJumpUsesRemaining,
        wallContactSide: actor.wallContactSide,
        wallJumpRemainingMs: actor.wallJumpRemainingMs,
        activeManeuver: actor.activeManeuver ? clone(actor.activeManeuver) : null,
        maneuverCooldowns: { ...actor.maneuverCooldowns },
        effectiveHurtbox: actionActorHurtbox(actor),
        activeAttack,
        offensiveCooldownRemainingMs: actor.offensiveCooldownRemainingMs,
        attackCooldowns: { ...actor.attackCooldowns },
        attackStates,
        hitStunRemainingMs: actor.hitStunRemainingMs,
        hitInvulnerabilityRemainingMs: actor.hitInvulnerabilityRemainingMs,
        hitFlashRemainingMs: actor.hitFlashRemainingMs,
        knockbackVelocityX: actor.knockbackVelocityX,
        statuses: clone(actor.statuses),
      };
    });
    return deepFreeze({
      schemaVersion: ACTION_COMBAT_SNAPSHOT_VERSION,
      fixedStepMs: this.fixedStepMs,
      nowMs: this.nowMs,
      accumulatorMs: this.accumulatorMs,
      automaticVictory: this.automaticVictory,
      controlledActorId: this.controlledActorId,
      tagCooldownRemainingMs: this.tagCooldownRemainingMs,
      stage: { ...this.stage },
      outcome: this.outcome,
      actors,
    });
  }

  _fixedUpdate() {
    this.nowMs += this.fixedStepMs;
    this._tickCooldowns();
    this._advanceAttackAnimations();
    this._ensureLivingControlledActor();
    this._updateOutcome();
    if (!this.outcome) {
      this._updateAiActions();
      this._applyMovement();
      this._advanceManeuvers();
      this._ensureLivingControlledActor();
      this._updateOutcome();
    }
    this.statusHooks.onFixedStep?.({
      nowMs: this.nowMs,
      stepMs: this.fixedStepMs,
      kernel: this,
    });
  }

  _tickCooldowns() {
    this.tagCooldownRemainingMs = Math.max(0, this.tagCooldownRemainingMs - this.fixedStepMs);
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
      for (const maneuverId of ACTION_MANEUVER_IDS) {
        actor.maneuverCooldowns[maneuverId] = Math.max(
          0,
          actor.maneuverCooldowns[maneuverId] - this.fixedStepMs,
        );
      }
      actor.jumpBufferRemainingMs = Math.max(0, actor.jumpBufferRemainingMs - this.fixedStepMs);
      actor.coyoteRemainingMs = Math.max(0, actor.coyoteRemainingMs - this.fixedStepMs);
      actor.wallJumpRemainingMs = Math.max(0, actor.wallJumpRemainingMs - this.fixedStepMs);
      actor.hitStunRemainingMs = Math.max(0, actor.hitStunRemainingMs - this.fixedStepMs);
      actor.hitInvulnerabilityRemainingMs = Math.max(
        0,
        actor.hitInvulnerabilityRemainingMs - this.fixedStepMs,
      );
      actor.hitFlashRemainingMs = Math.max(0, actor.hitFlashRemainingMs - this.fixedStepMs);
      if (actor.hitStunRemainingMs === 0) actor.knockbackVelocityX = 0;
      if (actor.hitInvulnerabilityRemainingMs === 0) actor.lastImpactComboId = null;
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
      if (actor.hitStunRemainingMs > 0) continue;
      const attack = this.attacks[active.attackId];
      const previousElapsedMs = active.elapsedMs;
      active.elapsedMs += this.fixedStepMs;
      if (!active.hitboxResolved
        && previousElapsedMs < attack.windupMs + attack.activeMs
        && active.elapsedMs >= attack.windupMs) {
        this._resolveHitbox(actor, attack, active);
      }
      const animationDurationMs = attack.windupMs + attack.activeMs + attack.recoveryMs;
      if (active.elapsedMs >= animationDurationMs) this._completeAttack(actor, attack, active);
    }
  }

  _resolveHitbox(attacker, attack, active) {
    active.hitboxResolved = true;
    const hitbox = attackWorldHitbox(attacker, attack);
    const targetIds = [];
    for (const targetId of this.actorOrder) {
      const target = this.getActor(targetId);
      if (target.hp <= 0 || !factionsAreHostile(attacker.faction, target.faction)) continue;
      if (!overlaps(hitbox, actionActorHurtbox(target))) continue;
      targetIds.push(targetId);
      this._dealDamage(attacker, target, attack, {
        ...(active.comboId == null ? {} : { comboId: active.comboId }),
      });
    }
    this._emit('hitbox-resolved', {
      actorId: attacker.id,
      attackId: attack.id,
      ...(active.comboId == null ? {} : { comboId: active.comboId }),
      targetIds,
      hitbox,
    });
  }

  _dealDamage(attacker, target, attack, provenance = {}) {
    const continuesLinkedCombo = provenance.comboId != null
      && provenance.comboId === target.lastImpactComboId;
    if (target.hitInvulnerabilityRemainingMs > 0 && !continuesLinkedCombo) {
      return this._emit('hit-ignored', {
        actorId: attacker.id,
        targetId: target.id,
        attackId: attack.id,
        ...provenance,
        reason: 'post-hit-invulnerability',
        remainingMs: target.hitInvulnerabilityRemainingMs,
      });
    }
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
    if (resolution.damage > 0) target.hitFlashRemainingMs = ACTION_HIT_FLASH_MS;
    if (resolution.damage > 0 && target.hp > 0) {
      const knockbackDirection = target.position.x === attacker.position.x
        ? attacker.facing
        : (target.position.x > attacker.position.x ? 1 : -1);
      target.hitStunRemainingMs = ACTION_HIT_STUN_MS;
      target.hitInvulnerabilityRemainingMs = ACTION_HIT_INVULNERABILITY_MS;
      target.knockbackVelocityX = knockbackDirection * ACTION_KNOCKBACK_SPEED_X;
      target.lastImpactComboId = provenance.comboId ?? null;
      target.movementIntent = { x: 0, y: 0 };
      if (target.grounded) {
        target.grounded = false;
        target.velocity.y = -ACTION_KNOCKBACK_LIFT_SPEED_Y;
      }
    }
    const event = this._emit('hit', {
      actorId: attacker.id,
      targetId: target.id,
      attackId: attack.id,
      ...provenance,
      delivery: attack.delivery,
      essence: attack.essence,
      ...resolution,
      hpBefore,
      hpAfter: target.hp,
      hitStunMs: target.hp > 0 && resolution.damage > 0 ? ACTION_HIT_STUN_MS : 0,
      invulnerabilityMs: target.hp > 0 && resolution.damage > 0
        ? ACTION_HIT_INVULNERABILITY_MS
        : 0,
      knockbackVelocityX: target.hp > 0 && resolution.damage > 0 ? target.knockbackVelocityX : 0,
    });
    this.statusHooks.afterHit?.({ attacker, target, attack, resolution, event, kernel: this });
    return event;
  }

  _resolveManeuverHits(actor, active, spec) {
    const attack = spec.attack;
    if (!attack) return;
    const hitbox = attackWorldHitbox(actor, attack);
    const targetIds = [];
    for (const targetId of this.actorOrder) {
      if (active.hitActorIds.includes(targetId)) continue;
      const target = this.getActor(targetId);
      if (target.hp <= 0 || !factionsAreHostile(actor.faction, target.faction)) continue;
      if (!overlaps(hitbox, actionActorHurtbox(target))) continue;
      active.hitActorIds.push(targetId);
      targetIds.push(targetId);
      this._dealDamage(actor, target, attack, { maneuverId: active.id });
    }
    if (targetIds.length) {
      this._emit('maneuver-hitbox-resolved', {
        actorId: actor.id,
        maneuverId: active.id,
        attackId: attack.id,
        targetIds,
        hitbox,
      });
    }
  }

  _finishManeuver(actor, reason = 'duration', nextAction = null) {
    const active = actor.activeManeuver;
    if (!active) return;
    const spec = actor.maneuverSpecs[active.id];
    actor.activeManeuver = null;
    if (active.id === 'dash' || active.id === 'slide') {
      actor.velocity.x = actor.movementIntent.x * actor.moveSpeed;
    }
    this._emit('maneuver-complete', {
      actorId: actor.id,
      maneuverId: active.id,
      name: spec.name,
      reason,
      elapsedMs: active.elapsedMs,
      ...(nextAction == null ? {} : { nextAction }),
    });
  }

  _advanceManeuvers() {
    for (const actorId of this.actorOrder) {
      const actor = this.getActor(actorId);
      const active = actor.activeManeuver;
      if (!active) continue;
      if (actor.hp <= 0) {
        this._finishManeuver(actor, 'actor-defeated');
        continue;
      }
      if (actor.hitStunRemainingMs > 0) continue;
      const spec = actor.maneuverSpecs[active.id];
      const nextElapsedMs = active.elapsedMs + this.fixedStepMs;
      if (spec.attack
        && nextElapsedMs > spec.attack.activeStartMs
        && active.elapsedMs < spec.attack.activeEndMs) {
        this._resolveManeuverHits(actor, active, spec);
      }
      active.elapsedMs = nextElapsedMs;
      if (spec.finishOnLanding && actor.grounded && active.elapsedMs >= 40) {
        this._finishManeuver(actor, 'landed');
      } else if (active.elapsedMs >= spec.durationMs) {
        this._finishManeuver(actor, 'duration');
      }
    }
  }

  _completeAttack(actor, attack, active) {
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
    const event = this._emit('attack-complete', {
      actorId: actor.id,
      attackId: attack.id,
      ...(active.comboId == null ? {} : { comboId: active.comboId }),
      sharedCooldownMs,
      individualCooldownMs,
    });
    this.statusHooks.afterAttackComplete?.({
      actor,
      attack,
      active: { ...active },
      event,
      kernel: this,
    });
  }

  _ensureLivingControlledActor() {
    const controlled = this.getActor(this.controlledActorId);
    if (controlled?.faction === 'player' && controlled.hp > 0) return;
    const previousActorId = this.controlledActorId;
    const replacementActorId = this.actorOrder.find((actorId) => {
      const actor = this.getActor(actorId);
      return actor.faction === 'player' && actor.hp > 0;
    }) ?? null;
    if (replacementActorId === previousActorId) return;
    this.controlledActorId = replacementActorId;
    if (replacementActorId) {
      this._emit('control-switch', {
        previousActorId,
        actorId: replacementActorId,
        reason: 'actor-defeated',
      });
    }
  }

  _updateAiActions() {
    for (const actorId of this.actorOrder) {
      const actor = this.getActor(actorId);
      const isCompanion = actor.faction === 'player' && actor.id !== this.controlledActorId;
      const isEnemy = actor.faction === 'enemy'
        && ['deterministic-chase', 'deterministic-sentry'].includes(actor.ai);
      const isSentry = actor.ai === 'deterministic-sentry';
      if (actor.hp <= 0
          || actor.hitStunRemainingMs > 0
          || (!isCompanion && !isEnemy)
          || actor.activeAttack) continue;
      const target = this._nearestOpponent(actor);
      const leader = isCompanion ? this.getActor(this.controlledActorId) : null;
      if (isCompanion
          && leader?.hp > 0
          && leader.position.y < actor.position.y - ACTION_COMPANION_AI.verticalFollowDistancePx
          && !actor.activeManeuver) {
        const horizontalGap = leader.position.x - actor.position.x;
        const verticalGap = actor.position.y - leader.position.y;
        actor.movementIntent = normalizeIntent({ x: horizontalGap });
        if (actor.movementIntent.x !== 0) actor.facing = actor.movementIntent.x < 0 ? -1 : 1;
        let action = 'air-follow';
        if (actor.grounded && Math.abs(horizontalGap) > ACTION_COMPANION_AI.verticalAlignmentDistancePx) {
          action = 'align-rise';
        } else if (actor.grounded) {
          const naturalJumpRise = actor.jumpSpeed * actor.jumpSpeed / (2 * actor.gravity);
          const uppercutReady = actor.maneuverCooldowns.uppercut <= 0
            && actor.maneuverSpecs.uppercut?.availability !== 'air-only';
          if (uppercutReady && verticalGap > naturalJumpRise * 0.8) {
            this._startManeuver(actor, 'uppercut');
            action = 'rise-follow';
          } else {
            this._startJump(actor, 'companion-follow', true);
            action = 'jump-follow';
          }
        }
        this._emit('companion-decision', {
          actorId: actor.id,
          action,
          targetId: leader.id,
          intent: { ...actor.movementIntent },
        });
        continue;
      }
      if (target && target.position.x !== actor.position.x) {
        actor.facing = target.position.x > actor.position.x ? 1 : -1;
      }
      const attackOverlapsTarget = (attackId) => target != null
        && overlaps(attackWorldHitbox(actor, this.attacks[attackId]), actionActorHurtbox(target));
      const usableAttack = actor.attackIds.find((attackId) => {
        if (this.attacks[attackId].kind === 'subweapon') return false;
        const state = this.getAttackState(actor.id, attackId);
        return state.ready && (isSentry || attackOverlapsTarget(attackId));
      });
      if (usableAttack) {
        actor.movementIntent = { x: 0, y: 0 };
        this._beginAttack(actor.id, usableAttack);
        this._emit(isCompanion ? 'companion-decision' : 'enemy-decision', {
          actorId: actor.id,
          action: 'attack',
          attackId: usableAttack,
          targetId: target.id,
        });
        continue;
      }

      if (isCompanion && leader?.hp > 0) {
        const leaderDistance = Math.abs(leader.position.x - actor.position.x);
        const targetDistance = target == null ? Infinity : Math.abs(target.position.x - actor.position.x);
        const leaderTargetDistance = target == null ? Infinity : Math.abs(target.position.x - leader.position.x);
        const attackInRange = actor.attackIds.some((attackId) => (
          this.attacks[attackId].kind !== 'subweapon' && attackOverlapsTarget(attackId)
        ));
        const mustRegroup = leaderDistance > ACTION_COMPANION_AI.leashDistancePx;
        const threatOutsideFormation = targetDistance > ACTION_COMPANION_AI.engageDistancePx
          && leaderTargetDistance > ACTION_COMPANION_AI.engageDistancePx;

        if (mustRegroup || threatOutsideFormation) {
          const shouldMove = leaderDistance > ACTION_COMPANION_AI.followDistancePx;
          actor.movementIntent = shouldMove
            ? normalizeIntent({ x: leader.position.x - actor.position.x })
            : { x: 0, y: 0 };
          if (shouldMove) actor.facing = actor.movementIntent.x < 0 ? -1 : 1;
          this._emit('companion-decision', {
            actorId: actor.id,
            action: shouldMove ? 'follow' : 'guard',
            targetId: leader.id,
            intent: { ...actor.movementIntent },
          });
          continue;
        }

        if (attackInRange) {
          actor.movementIntent = { x: 0, y: 0 };
          this._emit('companion-decision', {
            actorId: actor.id,
            action: 'guard',
            targetId: target.id,
            intent: { ...actor.movementIntent },
          });
          continue;
        }
      }

      if (!target) {
        actor.movementIntent = { x: 0, y: 0 };
        continue;
      }
      if (isSentry) {
        actor.movementIntent = { x: 0, y: 0 };
        this._emit('enemy-decision', {
          actorId: actor.id,
          action: 'hold',
          targetId: target.id,
          intent: { ...actor.movementIntent },
        });
        continue;
      }
      const delta = { x: target.position.x - actor.position.x };
      actor.movementIntent = normalizeIntent(delta);
      this._emit(isCompanion ? 'companion-decision' : 'enemy-decision', {
        actorId: actor.id,
        action: 'move',
        targetId: target.id,
        intent: { ...actor.movementIntent },
      });
    }
  }

  _nearestOpponent(actor) {
    let best = null;
    let bestDistance = Infinity;
    for (const candidateId of this.actorOrder) {
      const candidate = this.getActor(candidateId);
      if (candidate.hp <= 0 || !factionsAreHostile(actor.faction, candidate.faction)) continue;
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
      const wasGrounded = actor.grounded;
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
      const maneuver = actor.activeManeuver;
      const maneuverSpec = maneuver ? actor.maneuverSpecs[maneuver.id] : null;
      const seconds = this.fixedStepMs / 1000;
      if (actor.hitStunRemainingMs > 0) actor.velocity.x = actor.knockbackVelocityX;
      else if (committed) actor.velocity.x = 0;
      else if (maneuver) actor.velocity.x = maneuver.direction * speed * maneuverSpec.speedMultiplier;
      else if (actor.wallJumpRemainingMs > 0 && actor.movementProfile.wallTechnique) {
        actor.velocity.x = actor.wallJumpDirection
          * speed
          * actor.movementProfile.wallTechnique.jumpHorizontalMultiplier;
      }
      else actor.velocity.x = intent.x * speed;
      if (actor.hitStunRemainingMs === 0
          && !committed
          && !maneuver
          && intent.x !== 0) actor.facing = intent.x > 0 ? 1 : -1;
      actor.position.x = roundPosition(clamp(
        actor.position.x + actor.velocity.x * seconds,
        this.stage.minX,
        this.stage.maxX,
      ));

      const wall = actor.movementProfile.wallTechnique;
      const pushingIntoLeftWall = actor.position.x === this.stage.minX && intent.x < 0;
      const pushingIntoRightWall = actor.position.x === this.stage.maxX && intent.x > 0;
      if (!actor.grounded && wall && actor.velocity.y >= 0 && (pushingIntoLeftWall || pushingIntoRightWall)) {
        const nextWallSide = pushingIntoLeftWall ? -1 : 1;
        if (actor.wallContactSide !== nextWallSide) {
          this._emit('wall-cling', { actorId: actor.id, wallSide: nextWallSide });
        }
        actor.wallContactSide = nextWallSide;
      } else {
        actor.wallContactSide = null;
      }

      if (!actor.grounded) {
        const releasedJumpMultiplier = !actor.jumpHeld && actor.velocity.y < 0
          ? RELEASED_JUMP_GRAVITY_MULTIPLIER
          : 1;
        actor.velocity.y += actor.gravity
          * (maneuverSpec?.gravityMultiplier ?? releasedJumpMultiplier)
          * seconds;
        if (actor.wallContactSide != null && wall) {
          actor.velocity.y = Math.min(actor.velocity.y, wall.clingFallSpeed);
        }
      }
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
        actor.coyoteRemainingMs = 0;
        actor.airDashUsesRemaining = actor.maneuverSpecs.dash.airUses;
        actor.airJumpUsesRemaining = actor.movementProfile.airJumpUses;
        actor.wallContactSide = null;
        actor.wallJumpRemainingMs = 0;
        actor.wallJumpDirection = 0;
        if (!wasGrounded
          && actor.jumpBufferRemainingMs > 0
          && !actor.activeAttack
          && !actor.activeManeuver) {
          this._startJump(actor, 'buffered-landing', actor.jumpHeld);
        }
      } else {
        actor.position.y = roundPosition(proposedPosition.y);
        actor.grounded = false;
        if (wasGrounded && actor.velocity.y >= 0 && !actor.activeManeuver) {
          actor.coyoteRemainingMs = COYOTE_WINDOW_MS;
        }
        if (actor.position.y === this.stage.minY && actor.velocity.y < 0) actor.velocity.y = 0;
      }
    }
  }

  _updateOutcome() {
    if (this.outcome) return;
    const actors = this.actorOrder.map((actorId) => this.getActor(actorId));
    const hasPlayerRoster = actors.some((actor) => actor.faction === 'player');
    const hasLivingPlayer = actors.some((actor) => actor.faction === 'player' && actor.hp > 0);
    if (hasPlayerRoster && !hasLivingPlayer) {
      this.outcome = 'defeat';
      this._emit('combat-end', { outcome: this.outcome, winner: 'enemy' });
      return;
    }
    const livingFactions = new Set(actors
      .filter((actor) => actor.hp > 0 && actor.faction !== 'neutral')
      .map((actor) => actor.faction));
    if (livingFactions.size > 1 || livingFactions.size === 0) return;
    const [winner] = livingFactions;
    if (winner === 'player' && !this.automaticVictory) return;
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
