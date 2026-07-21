/**
 * Bells of the Black Chrysanthemum — DOM-free first-playable rules.
 *
 * Canvas/UI code may animate presentation, but every legal position, damage
 * result, recovery lock, and activation order is resolved here.
 */

export const DELIVERY_TYPES = Object.freeze({
  cut: { label: 'Cut', color: '#d8d1bf' },
  pierce: { label: 'Pierce', color: '#b7d4e8' },
  crush: { label: 'Crush', color: '#c7a681' },
  arcane: { label: 'Arcane', color: '#baa9dc' },
});

export const ESSENCE_TYPES = Object.freeze({
  ember: { label: 'Ember', color: '#f27a45' },
  frost: { label: 'Frost', color: '#8ccddd' },
  storm: { label: 'Storm', color: '#d8cc72' },
  radiance: { label: 'Radiance', color: '#f7d77d' },
  umbral: { label: 'Umbral', color: '#9d84c8' },
});

export const PHASES = Object.freeze({
  INTRO: 'intro',
  SELECT_NEXT: 'select_next',
  WAITING: 'waiting',
  PLAYER_COMMAND: 'player_command',
  ENEMY_THINK: 'enemy_think',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
});

const PULSE_MS = 800;
const ENEMY_THINK_MS = 650;
const GUARD_MULTIPLIER = 0.55;
const DODGE_CHANCE = 0.65;

// Stable tie order is part of deterministic enemy movement.
const EIGHT_WAY_DIRECTIONS = Object.freeze([
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
]);

const DEFAULT_MAP = Object.freeze({
  width: 12,
  height: 7,
  spacePx: 32,
  blocked: ['5,2', '5,3', '5,4', '6,2', '6,3', '6,4'],
  objective: 'Defeat the Ashen Oni Tithe Enforcer',
});

const PLAYER_SKILLS = Object.freeze({
  'courier-cut': {
    id: 'courier-cut',
    name: 'Courier’s Cut',
    delivery: 'cut',
    essence: null,
    power: 11,
    range: 1,
    recoveryPulses: 2,
    dodgeable: true,
  },
  'cinder-route': {
    id: 'cinder-route',
    name: 'Cinder Route',
    delivery: 'arcane',
    essence: 'ember',
    power: 13,
    range: 4,
    recoveryPulses: 3,
    dodgeable: false,
  },
  'dawn-signal': {
    id: 'dawn-signal',
    name: 'Dawn Signal',
    delivery: 'arcane',
    essence: 'radiance',
    power: 9,
    range: 3,
    recoveryPulses: 2,
    dodgeable: false,
  },
});

const ENEMY_SKILLS = Object.freeze({
  'tetsubo-hew': {
    id: 'tetsubo-hew',
    name: 'Tetsubo Hew',
    delivery: 'crush',
    essence: null,
    power: 13,
    range: 1,
    recoveryPulses: 2,
    dodgeable: true,
  },
  'moonless-thorns': {
    id: 'moonless-thorns',
    name: 'Moonless Thorns',
    delivery: 'arcane',
    essence: 'umbral',
    power: 8,
    range: 3,
    recoveryPulses: 3,
    dodgeable: false,
  },
});

function tileKey(position) {
  return `${position.x},${position.y}`;
}

function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function clonePosition(position) {
  return { x: position.x, y: position.y };
}

function formatPercent(multiplier) {
  return `${Math.round(multiplier * 100)}%`;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createPlayer() {
  return {
    id: 'ren',
    name: 'Ren Ishikawa',
    title: 'Courier of Takamine',
    faction: 'player',
    hp: 92,
    maxHp: 92,
    power: 8,
    guard: 7,
    speed: 100,
    pos: { x: 1, y: 3 },
    readyAtMs: 0,
    stance: 'neutral',
    resistances: {
      delivery: { cut: 1, pierce: 1, crush: 1, arcane: 1 },
      essence: { ember: 1, frost: 1, storm: 1, radiance: 1, umbral: 0.75 },
    },
  };
}

function createEnemy() {
  return {
    id: 'ashen-oni',
    name: 'Ashen Oni Tithe Enforcer',
    title: 'Black Chrysanthemum Retainer',
    faction: 'enemy',
    hp: 108,
    maxHp: 108,
    power: 9,
    guard: 6,
    speed: 86,
    pos: { x: 10, y: 3 },
    readyAtMs: PULSE_MS,
    stance: 'neutral',
    resistances: {
      delivery: { cut: 1, pierce: 1.25, crush: 0.75, arcane: 1 },
      essence: { ember: 1.25, frost: 1, storm: 1, radiance: 1.25, umbral: 0.75 },
    },
  };
}

/**
 * A deterministic turn engine. `advance` moves the clock only while no player
 * command is pending; it cannot turn this into real-time combat.
 */
export class CombatEngine {
  constructor(options = {}) {
    this.seed = Number.isInteger(options.seed) ? options.seed : 0x0b3115;
    this.randomOverride = typeof options.random === 'function' ? options.random : null;
    this.start();
  }

  start() {
    this.now = 0;
    this.random = this.randomOverride || seededRandom(this.seed);
    this.map = {
      width: DEFAULT_MAP.width,
      height: DEFAULT_MAP.height,
      spacePx: DEFAULT_MAP.spacePx,
      blocked: new Set(DEFAULT_MAP.blocked),
      objective: DEFAULT_MAP.objective,
    };
    this.player = createPlayer();
    this.enemy = createEnemy();
    this.skills = { ...PLAYER_SKILLS, ...ENEMY_SKILLS };
    this.phase = PHASES.INTRO;
    this.activeId = null;
    this.enemyActionAtMs = null;
    this.movementPoints = 0;
    this.result = null;
    this.message = 'Rain strikes the Bell Court. Ren moves first.';
    this.log = [];
    this.lastResolution = null;
    this.turnNumber = 0;
    this._appendLog('Ren reaches Takamine with Nikola Dražanić, a Croatian hunter who calls himself Count.', 'scene');
    this._appendLog('Father Mateus Avelar’s seal marks the court’s orders; Nikola knows the cipher.', 'scene');
    this._appendLog('An Ashen Oni Tithe Enforcer bars the black chrysanthemum gate.', 'scene');
    this.phase = PHASES.SELECT_NEXT;
    this._selectNext();
  }

  restart() {
    this.start();
  }

  getActor(id) {
    if (id === this.player.id) return this.player;
    if (id === this.enemy.id) return this.enemy;
    return null;
  }

  getSkill(id) {
    return this.skills[id] || null;
  }

  get distance() {
    return chebyshevDistance(this.player.pos, this.enemy.pos);
  }

  get timeUntilNextMs() {
    if (this.phase === PHASES.PLAYER_COMMAND || this.phase === PHASES.ENEMY_THINK) return 0;
    const living = [this.player, this.enemy].filter((actor) => actor.hp > 0);
    if (!living.length) return 0;
    return Math.max(0, Math.min(...living.map((actor) => actor.readyAtMs)) - this.now);
  }

  getUpcoming() {
    return [this.player, this.enemy]
      .filter((actor) => actor.hp > 0)
      .sort((a, b) => a.readyAtMs - b.readyAtMs || a.id.localeCompare(b.id))
      .map((actor) => ({
        id: actor.id,
        name: actor.name,
        readyInMs: Math.max(0, actor.readyAtMs - this.now),
        active: actor.id === this.activeId,
      }));
  }

  getActionAvailability() {
    const playerTurn = this.phase === PHASES.PLAYER_COMMAND;
    return ['courier-cut', 'cinder-route', 'dawn-signal'].map((id) => {
      const skill = PLAYER_SKILLS[id];
      return {
        ...skill,
        recoveryMs: skill.recoveryPulses * PULSE_MS,
        inRange: this.distance <= skill.range,
        available: playerTurn && this.distance <= skill.range,
      };
    });
  }

  getLegalMoves(actorId = this.player.id) {
    const actor = this.getActor(actorId);
    if (!actor || actor.hp <= 0) return [];
    return EIGHT_WAY_DIRECTIONS
      .map((direction) => ({
        dx: direction.x,
        dy: direction.y,
        destination: { x: actor.pos.x + direction.x, y: actor.pos.y + direction.y },
      }))
      .filter((move) => this._canOccupy(actor, move.destination));
  }

  getSnapshot() {
    return {
      now: this.now,
      phase: this.phase,
      activeId: this.activeId,
      movementPoints: this.movementPoints,
      result: this.result,
      message: this.message,
      distance: this.distance,
      player: this._snapshotActor(this.player),
      enemy: this._snapshotActor(this.enemy),
      upcoming: this.getUpcoming(),
    };
  }

  _snapshotActor(actor) {
    return {
      ...actor,
      pos: clonePosition(actor.pos),
      resistances: {
        delivery: { ...actor.resistances.delivery },
        essence: { ...actor.resistances.essence },
      },
    };
  }

  advance(deltaMs) {
    const elapsed = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    // Command menus deliberately pause the stage clock; this is never action combat.
    if (this.result || elapsed === 0 || this.phase === PHASES.PLAYER_COMMAND) return;
    this.now += elapsed;

    if (this.phase === PHASES.WAITING) this._selectNext();
    if (this.phase === PHASES.ENEMY_THINK && this.now >= this.enemyActionAtMs) {
      this._runEnemyTurn();
    }
  }

  movePlayer(dx, dy) {
    if (this.phase !== PHASES.PLAYER_COMMAND) {
      return this._reject('Movement is locked until Ren reaches the Tempo ribbon.');
    }
    if (!Number.isInteger(dx) || !Number.isInteger(dy) || (dx === 0 && dy === 0)
      || Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      return this._reject('Movement must be exactly one adjacent combat space.');
    }
    if (this.movementPoints <= 0) {
      return this._reject('No Pace remains. Commit one art or defensive position.');
    }

    const destination = { x: this.player.pos.x + dx, y: this.player.pos.y + dy };
    if (!this._canOccupy(this.player, destination)) {
      return this._reject('That space is blocked, occupied, outside the court, or cuts a sealed corner.');
    }

    this.player.pos = destination;
    this.movementPoints -= 1;
    this.message = `Ren steps to [${destination.x + 1}, ${destination.y + 1}]. ${this.movementPoints} Pace remain.`;
    this._appendLog(this.message, 'move');
    return { ok: true, destination: clonePosition(destination), movementPoints: this.movementPoints };
  }

  usePlayerSkill(skillId) {
    if (this.phase !== PHASES.PLAYER_COMMAND) {
      return this._reject('Ren is recovering and cannot issue another command.');
    }
    const skill = PLAYER_SKILLS[skillId];
    if (!skill) return this._reject('That combat art is not bound to Ren.');
    if (this.distance > skill.range) {
      return this._reject(`${skill.name} needs range ${skill.range}; the target is ${this.distance} spaces away.`);
    }

    // An offensive commitment replaces an unspent defensive position.
    this.player.stance = 'neutral';
    const resolution = this.resolveAttack(this.player, this.enemy, skill);
    this._completeTurn(this.player, skill.recoveryPulses);
    return { ok: true, resolution };
  }

  takeStance(stance) {
    if (this.phase !== PHASES.PLAYER_COMMAND) {
      return this._reject('Ren is recovering and cannot change position.');
    }
    if (stance !== 'guard' && stance !== 'dodge') return this._reject('Choose Guard or Dodge.');

    this.player.stance = stance;
    this.message = stance === 'guard'
      ? 'Ren braces: Guard will reduce the next hit by 45%.'
      : 'Ren takes Dodge: the next physical hit has a 65% miss chance.';
    this._appendLog(this.message, 'stance');
    this._completeTurn(this.player, 1);
    return { ok: true, stance, recoveryPulses: 1 };
  }

  calculateDamage(attacker, target, skill) {
    const base = Math.max(1, skill.power + attacker.power - Math.floor(target.guard / 3));
    const deliveryMultiplier = target.resistances.delivery[skill.delivery] ?? 1;
    const essenceMultiplier = skill.essence ? (target.resistances.essence[skill.essence] ?? 1) : 1;
    const totalMultiplier = deliveryMultiplier * essenceMultiplier;
    const typedDamage = Math.max(1, Math.round(base * totalMultiplier));
    return {
      base,
      deliveryMultiplier,
      essenceMultiplier,
      totalMultiplier,
      typedDamage,
      deliveryPercent: formatPercent(deliveryMultiplier),
      essencePercent: formatPercent(essenceMultiplier),
      totalPercent: formatPercent(totalMultiplier),
    };
  }

  /** Public for tests; command callers must validate phase and range first. */
  resolveAttack(attacker, target, skill) {
    const calculation = this.calculateDamage(attacker, target, skill);
    const canDodge = target.stance === 'dodge' && skill.dodgeable;

    if (canDodge) {
      const roll = this.random();
      target.stance = 'neutral';
      if (roll < DODGE_CHANCE) {
        const dodged = {
          attackerId: attacker.id,
          targetId: target.id,
          skillId: skill.id,
          atMs: this.now,
          hit: false,
          dodged: true,
          guarded: false,
          finalDamage: 0,
          ...calculation,
          text: `${target.name} slips past ${skill.name} (Dodge ${Math.round(DODGE_CHANCE * 100)}%).`,
        };
        this.lastResolution = dodged;
        this.message = dodged.text;
        this._appendLog(dodged.text, 'dodge');
        return dodged;
      }
    }

    const guarded = target.stance === 'guard';
    let finalDamage = calculation.typedDamage;
    if (guarded) {
      finalDamage = Math.max(1, Math.round(finalDamage * GUARD_MULTIPLIER));
      target.stance = 'neutral';
    }
    target.hp = Math.max(0, target.hp - finalDamage);

    const deliveryLabel = DELIVERY_TYPES[skill.delivery].label;
    const essenceText = skill.essence
      ? ` × ${ESSENCE_TYPES[skill.essence].label} ${calculation.essencePercent}`
      : '';
    const guardText = guarded ? ` × Guard ${formatPercent(GUARD_MULTIPLIER)}` : '';
    const text = `${attacker.name} uses ${skill.name}: ${calculation.base} base × ${deliveryLabel} ${calculation.deliveryPercent}${essenceText}${guardText} = ${finalDamage}.`;
    const resolution = {
      attackerId: attacker.id,
      targetId: target.id,
      skillId: skill.id,
      atMs: this.now,
      hit: true,
      dodged: false,
      guarded,
      finalDamage,
      ...calculation,
      text,
    };
    this.lastResolution = resolution;
    this.message = text;
    this._appendLog(text, skill.essence || skill.delivery);
    return resolution;
  }

  _selectNext() {
    if (this.result) return;
    const actors = [this.player, this.enemy]
      .filter((actor) => actor.hp > 0)
      .sort((a, b) => a.readyAtMs - b.readyAtMs || a.id.localeCompare(b.id));
    const next = actors[0];
    if (!next) return;

    if (next.readyAtMs > this.now) {
      this.phase = PHASES.WAITING;
      this.activeId = null;
      const seconds = (next.readyAtMs - this.now) / 1000;
      this.message = `Recovery holds the court for ${seconds >= 1 ? seconds.toFixed(1) : '<1'}s.`;
      return;
    }

    this.activeId = next.id;
    this.turnNumber += 1;
    if (next.faction === 'player') {
      this.phase = PHASES.PLAYER_COMMAND;
      this.movementPoints = 2;
      this.message = 'Ren’s Activation: spend up to 2 Pace, then commit one art or stance.';
      this._appendLog('Bell chime: Ren’s Activation.', 'turn');
      return;
    }

    this.phase = PHASES.ENEMY_THINK;
    this.enemyActionAtMs = this.now + ENEMY_THINK_MS;
    this.message = 'The Ashen Oni weighs the distance…';
    this._appendLog('The Ashen Oni measures the court.', 'turn');
  }

  _runEnemyTurn() {
    if (this.phase !== PHASES.ENEMY_THINK || this.enemy.hp <= 0 || this.player.hp <= 0) return;
    const distance = this.distance;
    if (distance === 1) {
      const skill = ENEMY_SKILLS['tetsubo-hew'];
      this.resolveAttack(this.enemy, this.player, skill);
      this._completeTurn(this.enemy, skill.recoveryPulses);
      return;
    }
    if (distance <= ENEMY_SKILLS['moonless-thorns'].range) {
      const skill = ENEMY_SKILLS['moonless-thorns'];
      this.resolveAttack(this.enemy, this.player, skill);
      this._completeTurn(this.enemy, skill.recoveryPulses);
      return;
    }

    const moved = this._moveEnemyTowardPlayer();
    this.message = moved
      ? `The Ashen Oni marches to [${this.enemy.pos.x + 1}, ${this.enemy.pos.y + 1}].`
      : 'The Ashen Oni bellows against the sealed gate; no route opens.';
    this._appendLog(this.message, 'move');
    this._completeTurn(this.enemy, 1);
  }

  _moveEnemyTowardPlayer() {
    const candidates = EIGHT_WAY_DIRECTIONS
      .map((direction, order) => ({
        pos: { x: this.enemy.pos.x + direction.x, y: this.enemy.pos.y + direction.y },
        order,
      }))
      .filter((candidate) => this._canOccupy(this.enemy, candidate.pos))
      .sort((a, b) => {
        const difference = chebyshevDistance(a.pos, this.player.pos) - chebyshevDistance(b.pos, this.player.pos);
        return difference || a.order - b.order;
      });
    if (!candidates.length) return false;
    this.enemy.pos = candidates[0].pos;
    return true;
  }

  _canOccupy(actor, destination) {
    if (!this._isOpenSpace(actor, destination)) return false;
    const dx = destination.x - actor.pos.x;
    const dy = destination.y - actor.pos.y;
    if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
      const horizontal = { x: actor.pos.x + dx, y: actor.pos.y };
      const vertical = { x: actor.pos.x, y: actor.pos.y + dy };
      // A diagonal can glide past one corner but never pass through a sealed one.
      if (!this._isOpenSpace(actor, horizontal) && !this._isOpenSpace(actor, vertical)) return false;
    }
    return true;
  }

  _isOpenSpace(actor, destination) {
    const inBounds = destination.x >= 0
      && destination.y >= 0
      && destination.x < this.map.width
      && destination.y < this.map.height;
    if (!inBounds || this.map.blocked.has(tileKey(destination))) return false;
    const opponent = actor.id === this.player.id ? this.enemy : this.player;
    return opponent.hp <= 0 || tileKey(opponent.pos) !== tileKey(destination);
  }

  _completeTurn(actor, recoveryPulses) {
    actor.readyAtMs = this.now + recoveryPulses * PULSE_MS;
    this.activeId = null;
    this.movementPoints = 0;
    this.enemyActionAtMs = null;
    if (this._checkOutcome()) return;
    this.phase = PHASES.SELECT_NEXT;
    this._selectNext();
  }

  _checkOutcome() {
    if (this.enemy.hp <= 0) {
      this.result = 'victory';
      this.phase = PHASES.VICTORY;
      this.message = 'The banner falls. Nikola sees Mateus’s seal beneath the lacquer.';
      this._appendLog(this.message, 'victory');
      return true;
    }
    if (this.player.hp <= 0) {
      this.result = 'defeat';
      this.phase = PHASES.DEFEAT;
      this.message = 'Ren falls beneath the bell. The court keeps its tithe.';
      this._appendLog(this.message, 'defeat');
      return true;
    }
    return false;
  }

  _reject(message) {
    this.message = message;
    return { ok: false, reason: message };
  }

  _appendLog(text, kind) {
    this.log.unshift({ atMs: this.now, text, kind });
    this.log = this.log.slice(0, 8);
  }
}

export const combatData = Object.freeze({
  playerSkills: PLAYER_SKILLS,
  enemySkills: ENEMY_SKILLS,
  map: DEFAULT_MAP,
  pulseMs: PULSE_MS,
  guardMultiplier: GUARD_MULTIPLIER,
  dodgeChance: DODGE_CHANCE,
});
