/**
 * DOM-free campaign combat rules for Bells of the Black Chrysanthemum.
 *
 * The engine consumes the authored encounter and level records directly. A UI
 * supplies player commands and renders snapshots; this module owns movement,
 * Pace, activation order, damage, objective progress, and battle outcomes.
 */

import { getEncounter, RECOVERY_PULSE_MS } from './content/encounters.mjs';
import { getLevel, isBlocked, isInBounds, parseTileKey } from './content/levels.mjs';

export { RECOVERY_PULSE_MS };

export const CAMPAIGN_COMBAT_SNAPSHOT_VERSION = 1;

export const CAMPAIGN_COMBAT_PHASES = Object.freeze({
  PLAYER_COMMAND: 'player-command',
  ENEMY_COMMAND: 'enemy-command',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
});

export const OBJECTIVE_ACTIONS = Object.freeze({
  EXIT: 'exit',
  ESCORT_TOKEN: 'escortToken',
  PROTECT: 'protect',
  CLEAR_ANCHOR: 'clearAnchor',
  RELEASE_TARGET: 'releaseTarget',
  DISABLE_ORDERS: 'disableOrders',
  RETURN_ITEM: 'returnItem',
  EXTRACT: 'extract',
  ACTIVATE_RELAY: 'activateRelay',
  RELEASE_GARRISON: 'releaseGarrison',
  BREAK_OBJECT: 'breakObject',
  EVACUATE: 'evacuate',
  INTERACT: 'interact',
});

const DELIVERY_KEYS = Object.freeze(['cut', 'pierce', 'crush', 'arcane']);
const ESSENCE_KEYS = Object.freeze(['ember', 'frost', 'storm', 'radiance', 'umbral']);
const EIGHT_WAY_DIRECTIONS = Object.freeze([
  { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
]);
const GUARD_MULTIPLIER = 0.55;
const DEFAULT_PACE = 2;

export const SPIRIT_RULES = deepFreeze({
  guardGain: 6,
  analyzeGain: 4,
  objectiveGain: 2,
});

/**
 * One-activation status vocabulary used by the authored encounter effects.
 * Statuses trigger when their target next receives an activation, remain live
 * through that command (so Recovery modifiers can apply), then expire.
 */
export const COMBAT_STATUS_DEFINITIONS = deepFreeze({
  dread: {
    id: 'dread',
    name: 'Dread',
    activationSpiritDelta: -6,
  },
  chill: {
    id: 'chill',
    name: 'Chill',
    activationPaceDelta: -1,
  },
  shock: {
    id: 'shock',
    name: 'Shock',
    recoveryPulsesDelta: 1,
  },
  scorch: {
    id: 'scorch',
    name: 'Scorch',
    activationDamage: 5,
  },
  bound: {
    id: 'bound',
    name: 'Bound',
    activationPaceCap: 0,
  },
  overheated: {
    id: 'overheated',
    name: 'Overheated',
    recoveryPulsesDelta: 1,
  },
});

const neutralResistances = Object.freeze({
  delivery: Object.freeze(Object.fromEntries(DELIVERY_KEYS.map((key) => [key, 1]))),
  essence: Object.freeze(Object.fromEntries(ESSENCE_KEYS.map((key) => [key, 1]))),
});

export const PARTY_SKILLS = Object.freeze({
  'courier-cut': Object.freeze({ id: 'courier-cut', name: "Courier's Cut", delivery: 'cut', power: 11, range: 1, recoveryPulses: 2, dodgeable: true, spiritCost: 0, spiritGain: 3 }),
  'cinder-route': Object.freeze({ id: 'cinder-route', name: 'Cinder Route', delivery: 'arcane', essence: 'ember', power: 13, range: 4, recoveryPulses: 3, dodgeable: false, spiritCost: 2, spiritGain: 0 }),
  'warding-script': Object.freeze({ id: 'warding-script', name: 'Warding Script', delivery: 'arcane', essence: 'radiance', power: 10, range: 4, recoveryPulses: 2, dodgeable: false, spiritCost: 1, spiritGain: 0 }),
  'hunter-thrust': Object.freeze({ id: 'hunter-thrust', name: 'Hunter Thrust', delivery: 'pierce', power: 14, range: 2, recoveryPulses: 2, dodgeable: true, spiritCost: 0, spiritGain: 3 }),
  'dawn-bolt': Object.freeze({ id: 'dawn-bolt', name: 'Dawn Bolt', delivery: 'arcane', essence: 'radiance', power: 12, range: 5, recoveryPulses: 3, dodgeable: false, spiritCost: 2, spiritGain: 0 }),
  'penitent-night': Object.freeze({ id: 'penitent-night', name: 'Penitent Night', delivery: 'arcane', essence: 'umbral', power: 16, range: 4, recoveryPulses: 3, dodgeable: false, spiritCost: 2, spiritGain: 0 }),
  'pilgrim-maul': Object.freeze({ id: 'pilgrim-maul', name: 'Pilgrim Maul', delivery: 'crush', power: 16, range: 1, recoveryPulses: 2, dodgeable: true, spiritCost: 0, spiritGain: 4 }),
  'cold-medicine': Object.freeze({ id: 'cold-medicine', name: 'Cold Medicine', delivery: 'arcane', essence: 'frost', power: 12, range: 4, recoveryPulses: 2, dodgeable: false, spiritCost: 1, spiritGain: 0 }),
});

const partyProfile = (id, name, stats, skillIds, resistances = {}) => Object.freeze({
  id, name, stats: Object.freeze(stats), skillIds: Object.freeze(skillIds),
  resistances: Object.freeze({
    delivery: Object.freeze({ ...neutralResistances.delivery, ...resistances.delivery }),
    essence: Object.freeze({ ...neutralResistances.essence, ...resistances.essence }),
  }),
});

export const PARTY_PROFILES = Object.freeze({
  ren: partyProfile('ren', 'Ren Ishikawa', { hp: 118, spirit: 32, power: 12, guard: 10, speed: 104 }, ['courier-cut', 'cinder-route']),
  aya: partyProfile('aya', 'Aya', { hp: 96, spirit: 36, power: 10, guard: 9, speed: 101 }, ['warding-script'], { essence: { umbral: 0.75 } }),
  lise: partyProfile('lise', 'Lise Varga', { hp: 108, spirit: 30, power: 13, guard: 10, speed: 108 }, ['hunter-thrust', 'dawn-bolt']),
  mateus: partyProfile('mateus', 'Father Mateus Avelar', { hp: 126, spirit: 42, power: 14, guard: 12, speed: 94 }, ['penitent-night'], { essence: { umbral: 0.5 } }),
  genta: partyProfile('genta', 'Genta', { hp: 148, spirit: 26, power: 15, guard: 15, speed: 84 }, ['pilgrim-maul']),
  kiku: partyProfile('kiku', 'Kiku', { hp: 102, spirit: 34, power: 11, guard: 10, speed: 99 }, ['cold-medicine'], { essence: { frost: 0.75 } }),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function positionFrom(value) {
  if (typeof value === 'string') return parseTileKey(value);
  return { x: Number(value?.x), y: Number(value?.y) };
}

function keyOf(position) {
  return `${position.x},${position.y}`;
}

function distance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function asPositiveInteger(value, fallback = 1) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function boundedResource(value, maximum) {
  const numeric = Number.isFinite(value) ? Math.trunc(value) : maximum;
  return Math.max(0, Math.min(maximum, numeric));
}

function living(actors, faction) {
  return actors.filter((actor) => actor.faction === faction && actor.hp > 0 && actor.active !== false);
}

function requirement(key, action, options = {}) {
  return Object.freeze({ key, action, count: 1, ...options });
}

/** Convert every authored objective family into explicit, inspectable actions. */
export function buildObjectiveRequirements(objective = {}) {
  switch (objective.type) {
    case 'defeatAll': return [];
    case 'defeatBoss': return [];
    case 'surviveThenExit':
      return [requirement('survive', 'enemyActivation', { count: objective.surviveEnemyActivations ?? 1, automatic: true }), requirement('exit', OBJECTIVE_ACTIONS.EXIT, { tile: objective.exitTile })];
    case 'escortTokens':
      return [requirement('escorted-tokens', OBJECTIVE_ACTIONS.ESCORT_TOKEN, { count: objective.tokenCount ?? 1 })];
    case 'defeatBossWithProtection':
      return (objective.protectedTokens ?? []).map((id) => requirement(`protected:${id}`, OBJECTIVE_ACTIONS.PROTECT, { targetId: id }));
    case 'clearRoute':
      return [requirement('cleared-anchors', OBJECTIVE_ACTIONS.CLEAR_ANCHOR, { count: objective.anchors ?? 1 })];
    case 'releaseTarget':
      return [requirement(`released:${objective.targetId}`, OBJECTIVE_ACTIONS.RELEASE_TARGET, { targetId: objective.targetId })];
    case 'thresholdOrObjects':
      return (objective.objectCondition?.objectIds ?? []).map((id) => requirement(`broken:${id}`, OBJECTIVE_ACTIONS.BREAK_OBJECT, { targetId: id, alternative: `boss-hp-at-or-below:${objective.hpThreshold ?? 0}` }));
    case 'protectObjects':
      return [requirement('survive', 'enemyActivation', { count: objective.turns ?? 1, automatic: true }), ...(objective.protectedObjects ?? []).map((id) => requirement(`protected:${id}`, OBJECTIVE_ACTIONS.PROTECT, { targetId: id }))];
    case 'disableOrdersAndProtect':
      return [requirement('orders-disabled', OBJECTIVE_ACTIONS.DISABLE_ORDERS), ...(objective.protectedObjects ?? []).map((id) => requirement(`protected:${id}`, OBJECTIVE_ACTIONS.PROTECT, { targetId: id }))];
    case 'returnItemToTile':
      return [requirement(`returned:${objective.item}`, OBJECTIVE_ACTIONS.RETURN_ITEM, { targetId: objective.item, tiles: objective.targetTiles ?? [] })];
    case 'extractAllBeforeCountdown':
      return (objective.targets ?? []).map((id) => requirement(`extracted:${id}`, OBJECTIVE_ACTIONS.EXTRACT, { targetId: id }));
    case 'activateRelays':
      return (objective.relays ?? []).map((id) => requirement(`relay:${id}`, OBJECTIVE_ACTIONS.ACTIVATE_RELAY, { targetId: id }));
    case 'defeatBossAndRelease':
      return [requirement('garrison-released', OBJECTIVE_ACTIONS.RELEASE_GARRISON)];
    case 'breakObjects':
      return [requirement('objects-broken', OBJECTIVE_ACTIONS.BREAK_OBJECT, { count: objective.objectCount ?? 1 })];
    case 'breakPhaseObjects':
      return (objective.objectIds ?? []).map((id) => requirement(`broken:${id}`, OBJECTIVE_ACTIONS.BREAK_OBJECT, { targetId: id }));
    case 'defeatBossAndEvacuate':
      return [requirement('evacuated', OBJECTIVE_ACTIONS.EVACUATE)];
    case 'completeInteractions':
      return (objective.interactions ?? []).map((id) => requirement(`interaction:${id}`, OBJECTIVE_ACTIONS.INTERACT, { targetId: id }));
    default:
      return [requirement(`custom:${objective.type ?? 'unknown'}`, String(objective.action ?? objective.type ?? 'custom'))];
  }
}

/** Pure damage preview used by both commands and UI readouts. */
export function calculateTypedDamage(attacker, target, skill) {
  const base = Math.max(1, Math.floor((attacker.power ?? 0) + (skill.power ?? 0) - Math.floor((target.guard ?? 0) / 3)));
  const deliveryMultiplier = skill.delivery ? (target.resistances?.delivery?.[skill.delivery] ?? 1) : 1;
  const essenceMultiplier = skill.essence ? (target.resistances?.essence?.[skill.essence] ?? 1) : 1;
  const typedDamage = Math.round(base * deliveryMultiplier * essenceMultiplier);
  return { base, deliveryMultiplier, essenceMultiplier, typedDamage, absorbed: typedDamage < 0 };
}

/** Strict diagonal traversal: either blocked orthogonal shoulder forbids a diagonal. */
export function canMoveEightWay(level, from, dx, dy, occupied = new Set()) {
  if (!Number.isInteger(dx) || !Number.isInteger(dy) || (dx === 0 && dy === 0) || Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    return { ok: false, reason: 'Movement must be exactly one of eight adjacent spaces.' };
  }
  const target = { x: from.x + dx, y: from.y + dy };
  const blocked = (position) => isBlocked(level, position.x, position.y) || occupied.has(keyOf(position));
  if (!isInBounds(level, target.x, target.y) || blocked(target)) return { ok: false, reason: 'Destination is blocked.' };
  if (dx !== 0 && dy !== 0) {
    const shoulderX = { x: from.x + dx, y: from.y };
    const shoulderY = { x: from.x, y: from.y + dy };
    if (blocked(shoulderX) || blocked(shoulderY)) return { ok: false, reason: 'A strict corner blocks diagonal movement.' };
  }
  return { ok: true, position: target };
}

function enemyInstances(encounter, nonHostile) {
  return encounter.enemies.flatMap((template) => {
    const positions = template.positions ?? [];
    return Array.from({ length: template.count ?? positions.length ?? 1 }, (_, index) => {
      const position = positions[index];
      if (!position) return [];
      return [{
        instanceId: `${template.id}-${index + 1}`,
        templateId: template.id,
        name: template.count > 1 ? `${template.name} ${index + 1}` : template.name,
        faction: nonHostile ? 'neutral' : 'enemy',
        active: !nonHostile,
        hp: template.stats.hp,
        maxHp: template.stats.hp,
        spirit: boundedResource(template.stats.spirit, asPositiveInteger(template.stats.spirit, 0)),
        maxSpirit: asPositiveInteger(template.stats.spirit, 0),
        power: template.stats.power ?? 0,
        guard: template.stats.guard ?? 0,
        speed: template.stats.speed ?? 0,
        pos: positionFrom(position),
        readyAtPulse: 0,
        stance: 'neutral',
        resistances: clone(template.resistances ?? neutralResistances),
        skills: clone(template.skills ?? []),
        statuses: [],
        ledger: template.ledger ?? '',
        analyzed: false,
      }];
    }).flat();
  });
}

function partyInstances(encounter, profiles) {
  return encounter.party.deployment.map((deployment) => {
    const profile = profiles[deployment.actorId];
    if (!profile) throw new Error(`Missing party profile: ${deployment.actorId}`);
    const authoredSpirit = PARTY_PROFILES[deployment.actorId]?.stats.spirit ?? 24;
    const maxSpirit = asPositiveInteger(profile.stats.spirit, authoredSpirit);
    return {
      instanceId: deployment.actorId,
      templateId: deployment.actorId,
      name: profile.name,
      faction: 'party',
      active: true,
      hp: Math.max(1, Math.min(profile.stats.hp, profile.currentHp ?? profile.stats.hp)),
      maxHp: profile.stats.hp,
      spirit: boundedResource(profile.currentSpirit, maxSpirit),
      maxSpirit,
      power: profile.stats.power,
      guard: profile.stats.guard,
      speed: profile.stats.speed,
      paceDelta: Number.isFinite(profile.loadout?.paceDelta) ? Math.trunc(profile.loadout.paceDelta) : 0,
      recoveryPulsesDelta: Number.isFinite(profile.loadout?.recoveryPulsesDelta) ? Math.trunc(profile.loadout.recoveryPulsesDelta) : 0,
      pos: positionFrom(deployment.at),
      readyAtPulse: 0,
      stance: 'neutral',
      resistances: clone(profile.resistances),
      skills: profile.skillIds.map((id) => clone(PARTY_SKILLS[id])),
      statuses: [],
      analyzed: false,
    };
  });
}

export class CampaignCombatEngine {
  constructor(options = {}) {
    this.encounter = clone(options.encounter ?? getEncounter(options.encounterId));
    if (!this.encounter) throw new Error(`Unknown encounter: ${options.encounterId ?? '(missing)'}`);
    this.level = clone(options.level ?? getLevel(this.encounter.levelId));
    if (!this.level) throw new Error(`Unknown level: ${this.encounter.levelId}`);
    this.partyProfiles = { ...PARTY_PROFILES, ...(options.partyProfiles ?? {}) };
    this.pacePerActivation = options.pacePerActivation ?? DEFAULT_PACE;
    this.reset();
  }

  reset() {
    this.nowPulse = 0;
    this.enemyActivations = 0;
    this.actors = [
      ...partyInstances(this.encounter, this.partyProfiles),
      ...enemyInstances(this.encounter, this.encounter.format === 'noncombat-resolution'),
    ];
    this.objectiveRequirements = buildObjectiveRequirements(this.encounter.objective);
    this.objectiveProgress = Object.fromEntries(this.objectiveRequirements.map((item) => [item.key, 0]));
    this.phase = CAMPAIGN_COMBAT_PHASES.PLAYER_COMMAND;
    this.result = null;
    this.activeActorId = null;
    this.pace = 0;
    this.activationCount = 0;
    this.log = [];
    this._selectNext();
    return this.snapshot();
  }

  get pulseMs() { return RECOVERY_PULSE_MS; }

  getActor(id) {
    return this.actors.find((actor) => actor.instanceId === id) ?? null;
  }

  get activeActor() { return this.getActor(this.activeActorId); }

  snapshot() {
    return deepFreeze(clone({
      schemaVersion: CAMPAIGN_COMBAT_SNAPSHOT_VERSION,
      encounterId: this.encounter.id,
      levelId: this.level.id,
      phase: this.phase,
      result: this.result,
      nowPulse: this.nowPulse,
      nowMs: this.nowPulse * RECOVERY_PULSE_MS,
      activeActorId: this.activeActorId,
      pace: this.pace,
      actors: this.actors,
      objective: this.getObjectiveStatus(),
      log: this.log,
    }));
  }

  /** Stable, JSON-only handoff for receipts, diagnostics, and future saves. */
  serialize() {
    return JSON.stringify(this.snapshot());
  }

  getObjectiveStatus() {
    const requirementsComplete = this._requirementsComplete();
    const combatComplete = this._combatSatisfied();
    return {
      type: this.encounter.objective.type,
      text: this.encounter.objective.text,
      requirements: this.objectiveRequirements.map((item) => ({ ...item, progress: this.objectiveProgress[item.key] ?? 0, complete: (this.objectiveProgress[item.key] ?? 0) >= item.count })),
      requirementsComplete,
      combatComplete,
      complete: requirementsComplete && combatComplete,
    };
  }

  getAvailableCommands(actorId = this.activeActorId) {
    const actor = this.getActor(actorId);
    if (!actor || actor.faction !== 'party' || actor.hp <= 0 || actorId !== this.activeActorId || this.result) return [];
    return ['move', 'guard', 'analyze', 'skill', ...(this.objectiveRequirements.some((item) => !item.automatic && (this.objectiveProgress[item.key] ?? 0) < item.count) ? ['objective'] : [])];
  }

  _occupied(exceptId) {
    return new Set(this.actors.filter((actor) => actor.instanceId !== exceptId && actor.hp > 0 && actor.active !== false).map((actor) => keyOf(actor.pos)));
  }

  move(actorId, dx, dy) {
    const actor = this.getActor(actorId);
    const invalid = this._validatePartyCommand(actorId);
    if (invalid) return invalid;
    if (this.pace <= 0) return { ok: false, reason: 'No Pace remains.' };
    const movement = canMoveEightWay(this.level, actor.pos, dx, dy, this._occupied(actorId));
    if (!movement.ok) return movement;
    actor.pos = movement.position;
    this.pace -= 1;
    this.log.push({ type: 'move', actorId, at: keyOf(actor.pos), pulse: this.nowPulse });
    return { ok: true, position: clone(actor.pos), pace: this.pace };
  }

  previewDamage(attackerId, targetId, skillId) {
    const attacker = this.getActor(attackerId);
    const target = this.getActor(targetId);
    const skill = attacker?.skills.find((item) => item.id === skillId);
    if (!attacker || !target || !skill) return null;
    if (attacker.spirit < asPositiveInteger(skill.spiritCost, 0)) return null;
    return calculateTypedDamage(attacker, target, skill);
  }

  getSkillSpiritQuote(actorId, skillId) {
    const actor = this.getActor(actorId);
    const skill = actor?.skills.find((item) => item.id === skillId);
    if (!actor || !skill) return null;
    const spiritCost = asPositiveInteger(skill.spiritCost, 0);
    const spiritGain = asPositiveInteger(skill.spiritGain, 0);
    return deepFreeze({
      actorId,
      skillId,
      spirit: actor.spirit,
      maxSpirit: actor.maxSpirit,
      spiritCost,
      spiritGain,
      affordable: actor.spirit >= spiritCost,
    });
  }

  useSkill(actorId, skillId, targetId) {
    const invalid = this._validatePartyCommand(actorId);
    if (invalid) return invalid;
    const actor = this.getActor(actorId);
    const target = this.getActor(targetId);
    const skill = actor.skills.find((item) => item.id === skillId);
    if (!skill) return { ok: false, reason: 'Unknown skill.' };
    if (!target || target.hp <= 0 || target.faction !== 'enemy') return { ok: false, reason: 'Target is not a living enemy.' };
    if (distance(actor.pos, target.pos) > (skill.range ?? 1)) return { ok: false, reason: 'Target is outside skill range.' };
    const quote = this.getSkillSpiritQuote(actorId, skillId);
    if (!quote.affordable) return { ok: false, reason: `Not enough Spirit (${quote.spirit}/${quote.spiritCost}).`, spirit: quote };
    const spirit = this._applySkillSpirit(actor, skill);
    const resolution = this._resolveAttack(actor, target, skill);
    this._commit(actor, skill.recoveryPulses, 'skill');
    return { ok: true, ...resolution, spirit };
  }

  guard(actorId) {
    const invalid = this._validatePartyCommand(actorId);
    if (invalid) return invalid;
    const actor = this.getActor(actorId);
    actor.stance = 'guard';
    this.log.push({ type: 'guard', actorId, pulse: this.nowPulse });
    const spirit = this._changeSpirit(actor, SPIRIT_RULES.guardGain, 'guard');
    this._commit(actor, 1, 'guard');
    return { ok: true, spirit };
  }

  analyze(actorId, targetId) {
    const invalid = this._validatePartyCommand(actorId);
    if (invalid) return invalid;
    const actor = this.getActor(actorId);
    const target = this.getActor(targetId);
    if (!target || target.hp <= 0 || target.faction !== 'enemy') return { ok: false, reason: 'Analyze requires a living enemy.' };
    target.analyzed = true;
    const readout = { ledger: target.ledger, delivery: clone(target.resistances.delivery), essence: clone(target.resistances.essence) };
    this.log.push({ type: 'analyze', actorId, targetId, pulse: this.nowPulse });
    const spirit = this._changeSpirit(actor, SPIRIT_RULES.analyzeGain, 'analyze');
    this._commit(actor, 1, 'analyze');
    return { ok: true, readout, spirit };
  }

  performObjectiveAction(actorId, action) {
    const invalid = this._validatePartyCommand(actorId);
    if (invalid) return invalid;
    const actor = this.getActor(actorId);
    const candidates = this.objectiveRequirements.filter((item) => !item.automatic
      && item.action === action?.type
      && (!item.targetId || item.targetId === action.targetId)
      && (this.objectiveProgress[item.key] ?? 0) < item.count);
    const match = candidates[0];
    if (!match) return { ok: false, reason: 'That action does not advance this objective.' };
    if (match.tile && keyOf(actor.pos) !== match.tile) return { ok: false, reason: `Actor must stand at ${match.tile}.` };
    if (match.tiles?.length && !match.tiles.includes(keyOf(actor.pos))) return { ok: false, reason: `Actor must stand on an objective tile.` };
    const amount = Math.max(1, asPositiveInteger(action.amount, 1));
    this.objectiveProgress[match.key] = Math.min(match.count, (this.objectiveProgress[match.key] ?? 0) + amount);
    this.log.push({ type: 'objective', action: action.type, targetId: action.targetId ?? null, actorId, pulse: this.nowPulse });
    const spirit = this._changeSpirit(actor, SPIRIT_RULES.objectiveGain, 'objective');
    this._commit(actor, action.recoveryPulses ?? 1, 'objective');
    return { ok: true, requirement: match.key, progress: this.objectiveProgress[match.key], complete: this.result === 'victory', spirit };
  }

  /** Explicit hook for authored losses not represented by HP (countdowns, evidence, witnesses). */
  failObjective(reason) {
    if (this.result) return { ok: false, reason: 'Encounter already resolved.' };
    this.result = 'defeat';
    this.phase = CAMPAIGN_COMBAT_PHASES.DEFEAT;
    this.activeActorId = null;
    this.log.push({ type: 'objective-failure', reason, pulse: this.nowPulse });
    return { ok: true, result: this.result };
  }

  /** Resolve deterministic enemy activations until player input or an outcome. */
  advanceUntilPlayerCommand(maxEnemyActivations = 100) {
    let resolved = 0;
    while (!this.result && this.phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND) {
      if (resolved >= maxEnemyActivations) throw new Error('Enemy activation safety limit reached.');
      this.resolveEnemyActivation();
      resolved += 1;
    }
    return { ok: true, enemyActivations: resolved, snapshot: this.snapshot() };
  }

  resolveEnemyActivation() {
    const actor = this.activeActor;
    if (this.phase !== CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND || actor?.faction !== 'enemy') return { ok: false, reason: 'No enemy command is pending.' };
    const targets = living(this.actors, 'party').sort((a, b) => distance(actor.pos, a.pos) - distance(actor.pos, b.pos) || a.instanceId.localeCompare(b.instanceId));
    if (!targets.length) return this._evaluateOutcome();
    const target = targets[0];
    const skill = actor.skills.find((item) => distance(actor.pos, target.pos) <= (item.range ?? 1)
      && actor.spirit >= asPositiveInteger(item.spiritCost, 0));
    let resolution;
    if (skill) {
      this._applySkillSpirit(actor, skill);
      resolution = this._resolveAttack(actor, target, skill);
      this._schedule(actor, skill.recoveryPulses);
    } else {
      resolution = this._moveEnemyToward(actor, target);
      this._schedule(actor, 1);
    }
    this.enemyActivations += 1;
    this._incrementAutomatic('enemyActivation');
    this.log.push({ type: 'enemy-activation', actorId: actor.instanceId, pulse: this.nowPulse });
    this.activeActorId = null;
    this._evaluateOutcome();
    if (!this.result) this._selectNext();
    return { ok: true, resolution };
  }

  _validatePartyCommand(actorId) {
    if (this.result) return { ok: false, reason: 'Encounter already resolved.' };
    const actor = this.getActor(actorId);
    if (!actor || actor.faction !== 'party' || actor.hp <= 0) return { ok: false, reason: 'Actor cannot take a party command.' };
    if (this.phase !== CAMPAIGN_COMBAT_PHASES.PLAYER_COMMAND || this.activeActorId !== actorId) return { ok: false, reason: 'Actor is not ready.' };
    return null;
  }

  _changeSpirit(actor, requestedDelta, reason, details = {}) {
    const before = actor.spirit;
    const requested = Number.isFinite(requestedDelta) ? Math.trunc(requestedDelta) : 0;
    actor.spirit = boundedResource(before + requested, actor.maxSpirit);
    const event = {
      type: 'spirit-change',
      actorId: actor.instanceId,
      reason,
      before,
      requestedDelta: requested,
      delta: actor.spirit - before,
      after: actor.spirit,
      maxSpirit: actor.maxSpirit,
      pulse: this.nowPulse,
      ...details,
    };
    this.log.push(event);
    return deepFreeze(clone(event));
  }

  _applySkillSpirit(actor, skill) {
    const spiritCost = asPositiveInteger(skill.spiritCost, 0);
    const spiritGain = asPositiveInteger(skill.spiritGain, 0);
    if (spiritCost === 0 && spiritGain === 0) return null;
    return this._changeSpirit(actor, spiritGain - spiritCost, `skill:${skill.id}`, {
      skillId: skill.id,
      spiritCost,
      spiritGain,
    });
  }

  _applyStatus(source, target, statusId, skillId, duration) {
    const definition = COMBAT_STATUS_DEFINITIONS[statusId];
    if (!definition || !target || target.hp <= 0) return null;
    const durationActivations = Math.max(1, asPositiveInteger(
      Number.isInteger(duration) ? duration : duration?.activations,
      1,
    ));
    const existing = target.statuses.find((status) => status.id === statusId);
    const status = {
      id: statusId,
      sourceActorId: source.instanceId,
      sourceSkillId: skillId,
      appliedAtPulse: this.nowPulse,
      durationActivations,
      remainingActivations: durationActivations,
      activeThisActivation: false,
    };
    if (existing) Object.assign(existing, status);
    else target.statuses.push(status);
    const event = {
      type: existing ? 'status-refreshed' : 'status-applied',
      statusId,
      targetId: target.instanceId,
      sourceActorId: source.instanceId,
      sourceSkillId: skillId,
      durationActivations,
      pulse: this.nowPulse,
    };
    this.log.push(event);
    return deepFreeze(clone(event));
  }

  _resolveAttack(attacker, target, skill) {
    const calculation = calculateTypedDamage(attacker, target, skill);
    const guarded = target.stance === 'guard';
    let finalDamage = guarded && calculation.typedDamage > 0 ? Math.max(1, Math.round(calculation.typedDamage * GUARD_MULTIPLIER)) : calculation.typedDamage;
    if (guarded && calculation.typedDamage > 0) target.stance = 'neutral';
    if (finalDamage < 0) {
      const healed = Math.min(target.maxHp - target.hp, Math.abs(finalDamage));
      target.hp += healed;
      finalDamage = -healed;
    } else {
      target.hp = Math.max(0, target.hp - finalDamage);
    }
    const statusId = skill.effect?.status ?? null;
    const statusApplied = Boolean(statusId && COMBAT_STATUS_DEFINITIONS[statusId] && finalDamage > 0 && target.hp > 0);
    const resolution = {
      attackerId: attacker.instanceId,
      targetId: target.instanceId,
      skillId: skill.id,
      ...calculation,
      finalDamage,
      guarded,
      targetHp: target.hp,
      statusId,
      statusApplied,
    };
    this.log.push({ type: 'damage', ...resolution, pulse: this.nowPulse });
    if (statusApplied) this._applyStatus(attacker, target, statusId, skill.id, skill.effect?.duration);
    const selfStatusId = skill.effect?.selfStatus;
    if (selfStatusId) this._applyStatus(attacker, attacker, selfStatusId, skill.id, skill.effect?.selfDuration ?? skill.effect?.duration);
    return resolution;
  }

  _moveEnemyToward(actor, target) {
    const occupied = this._occupied(actor.instanceId);
    const options = EIGHT_WAY_DIRECTIONS.map((direction, index) => ({
      direction,
      index,
      result: canMoveEightWay(this.level, actor.pos, direction.x, direction.y, occupied),
    })).filter((item) => item.result.ok)
      .sort((a, b) => distance(a.result.position, target.pos) - distance(b.result.position, target.pos) || a.index - b.index);
    if (!options.length) return { type: 'wait', actorId: actor.instanceId };
    actor.pos = options[0].result.position;
    return { type: 'move', actorId: actor.instanceId, position: clone(actor.pos) };
  }

  _commit(actor, recoveryPulses, command) {
    this._schedule(actor, recoveryPulses);
    this.log.push({ type: 'commit', actorId: actor.instanceId, command, readyAtPulse: actor.readyAtPulse, pulse: this.nowPulse });
    this.activeActorId = null;
    this.pace = 0;
    this._evaluateOutcome();
    if (!this.result) this._selectNext();
  }

  _beginActivationStatuses(actor) {
    for (const status of actor.statuses) {
      status.activeThisActivation = true;
      const definition = COMBAT_STATUS_DEFINITIONS[status.id];
      this.log.push({
        type: 'status-triggered',
        statusId: status.id,
        actorId: actor.instanceId,
        sourceActorId: status.sourceActorId,
        sourceSkillId: status.sourceSkillId,
        remainingActivations: status.remainingActivations,
        pulse: this.nowPulse,
      });

      if (definition.activationSpiritDelta) {
        const spirit = this._changeSpirit(actor, definition.activationSpiritDelta, `status:${status.id}`, {
          statusId: status.id,
          sourceActorId: status.sourceActorId,
          sourceSkillId: status.sourceSkillId,
        });
        this.log.push({
          type: 'status-effect',
          statusId: status.id,
          actorId: actor.instanceId,
          effect: 'spirit',
          requestedDelta: definition.activationSpiritDelta,
          delta: spirit.delta,
          before: spirit.before,
          after: spirit.after,
          pulse: this.nowPulse,
        });
      }

      if (definition.activationDamage) {
        const hpBefore = actor.hp;
        const finalDamage = Math.min(hpBefore, definition.activationDamage);
        actor.hp = Math.max(0, hpBefore - finalDamage);
        this.log.push({
          type: 'status-damage',
          statusId: status.id,
          targetId: actor.instanceId,
          sourceActorId: status.sourceActorId,
          sourceSkillId: status.sourceSkillId,
          baseDamage: definition.activationDamage,
          finalDamage,
          hpBefore,
          targetHp: actor.hp,
          pulse: this.nowPulse,
        });
      }

      if (actor.faction === 'party' && definition.activationPaceDelta) {
        const before = this.pace;
        this.pace = Math.max(0, this.pace + definition.activationPaceDelta);
        this.log.push({
          type: 'status-effect',
          statusId: status.id,
          actorId: actor.instanceId,
          effect: 'pace',
          requestedDelta: definition.activationPaceDelta,
          delta: this.pace - before,
          before,
          after: this.pace,
          pulse: this.nowPulse,
        });
      }

      if (actor.faction === 'party' && Number.isInteger(definition.activationPaceCap)) {
        const before = this.pace;
        this.pace = Math.min(this.pace, definition.activationPaceCap);
        this.log.push({
          type: 'status-effect',
          statusId: status.id,
          actorId: actor.instanceId,
          effect: 'pace-cap',
          cap: definition.activationPaceCap,
          delta: this.pace - before,
          before,
          after: this.pace,
          pulse: this.nowPulse,
        });
      }
    }
  }

  _completeActivationStatuses(actor) {
    const remaining = [];
    for (const status of actor.statuses) {
      if (!status.activeThisActivation) {
        remaining.push(status);
        continue;
      }
      status.remainingActivations -= 1;
      status.activeThisActivation = false;
      if (status.remainingActivations > 0) {
        remaining.push(status);
      } else {
        this.log.push({
          type: 'status-expired',
          statusId: status.id,
          actorId: actor.instanceId,
          sourceActorId: status.sourceActorId,
          sourceSkillId: status.sourceSkillId,
          pulse: this.nowPulse,
        });
      }
    }
    actor.statuses = remaining;
  }

  _schedule(actor, recoveryPulses) {
    const baseRecovery = asPositiveInteger(recoveryPulses, 1);
    const loadoutDelta = actor.recoveryPulsesDelta ?? 0;
    const activeRecoveryStatuses = actor.statuses.filter((status) => status.activeThisActivation
      && COMBAT_STATUS_DEFINITIONS[status.id]?.recoveryPulsesDelta);
    const statusDelta = activeRecoveryStatuses.reduce((sum, status) => (
      sum + COMBAT_STATUS_DEFINITIONS[status.id].recoveryPulsesDelta
    ), 0);
    const finalRecovery = Math.max(1, baseRecovery + loadoutDelta + statusDelta);
    actor.readyAtPulse = this.nowPulse + finalRecovery;
    for (const status of activeRecoveryStatuses) {
      this.log.push({
        type: 'status-effect',
        statusId: status.id,
        actorId: actor.instanceId,
        effect: 'recovery',
        baseRecovery,
        loadoutDelta,
        statusDelta: COMBAT_STATUS_DEFINITIONS[status.id].recoveryPulsesDelta,
        totalStatusDelta: statusDelta,
        finalRecovery,
        readyAtPulse: actor.readyAtPulse,
        pulse: this.nowPulse,
      });
    }
    this._completeActivationStatuses(actor);
  }

  _incrementAutomatic(action) {
    for (const item of this.objectiveRequirements.filter((candidate) => candidate.automatic && candidate.action === action)) {
      this.objectiveProgress[item.key] = Math.min(item.count, (this.objectiveProgress[item.key] ?? 0) + 1);
    }
  }

  _selectNext() {
    const readyActors = this.actors.filter((actor) => actor.active !== false && actor.hp > 0 && actor.faction !== 'neutral');
    if (!readyActors.length) return this._evaluateOutcome();
    readyActors.sort((a, b) => a.readyAtPulse - b.readyAtPulse || b.speed - a.speed || a.instanceId.localeCompare(b.instanceId));
    const actor = readyActors[0];
    this.nowPulse = Math.max(this.nowPulse, actor.readyAtPulse);
    this.activeActorId = actor.instanceId;
    this.activationCount += 1;
    if (actor.faction === 'party') {
      this.phase = CAMPAIGN_COMBAT_PHASES.PLAYER_COMMAND;
      this.pace = Math.max(0, this.pacePerActivation + (actor.paceDelta ?? 0));
    } else {
      this.phase = CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND;
      this.pace = 0;
    }
    this._beginActivationStatuses(actor);
    if (actor.hp <= 0) {
      this.activeActorId = null;
      this.pace = 0;
      this._evaluateOutcome();
      if (!this.result) this._selectNext();
    }
  }

  _requirementsComplete() {
    if (this.encounter.objective.type === 'thresholdOrObjects') {
      const boss = this.actors.find((actor) => actor.faction === 'enemy');
      const thresholdMet = boss && boss.maxHp > 0 && boss.hp / boss.maxHp <= (this.encounter.objective.hpThreshold ?? 0);
      return Boolean(thresholdMet) || this.objectiveRequirements.every((item) => (this.objectiveProgress[item.key] ?? 0) >= item.count);
    }
    return this.objectiveRequirements.every((item) => (this.objectiveProgress[item.key] ?? 0) >= item.count);
  }

  _bossDefeated() {
    const first = this.actors.find((actor) => actor.faction === 'enemy');
    return !first || first.hp <= 0;
  }

  _combatSatisfied() {
    const type = this.encounter.objective.type;
    const allEnemiesDefeated = !living(this.actors, 'enemy').length;
    const bossRequired = ['defeatBoss', 'defeatBossWithProtection', 'defeatBossAndRelease', 'defeatBossAndEvacuate'].includes(type);
    return type === 'defeatAll' ? allEnemiesDefeated : bossRequired ? this._bossDefeated() : true;
  }

  _evaluateOutcome() {
    if (!living(this.actors, 'party').length) {
      this.result = 'defeat';
      this.phase = CAMPAIGN_COMBAT_PHASES.DEFEAT;
      this.activeActorId = null;
      return { result: this.result };
    }
    if (this._combatSatisfied() && this._requirementsComplete()) {
      this.result = 'victory';
      this.phase = CAMPAIGN_COMBAT_PHASES.VICTORY;
      this.activeActorId = null;
      this.pace = 0;
    }
    return { result: this.result };
  }
}

export function createCampaignCombat(encounterId, options = {}) {
  return new CampaignCombatEngine({ ...options, encounterId });
}
