import assert from 'node:assert/strict';
import test from 'node:test';
import { CombatEngine, PHASES } from '../engine.mjs';

test('starts at a paused Ren Activation with two Pace', () => {
  const engine = new CombatEngine();

  assert.equal(engine.phase, PHASES.PLAYER_COMMAND);
  assert.equal(engine.activeId, 'ren');
  assert.equal(engine.movementPoints, 2);
  assert.equal(engine.player.pos.x, 1);
  assert.equal(engine.player.pos.y, 3);
  assert.ok(engine.log.some(({ text }) => text === 'Ren reaches Takamine with Nikola Dražanić, a Croatian hunter whose house claims Wallachian origin.'));
  assert.ok(engine.log.some(({ text }) => text === 'Father Mateus Avelar’s seal carries the Dracul precedent; Nikola knows the Severed Dragon counter-ward.'));
});

test('movement changes exactly one legal 8-way space and consumes one Pace', () => {
  const engine = new CombatEngine();
  const result = engine.movePlayer(1, -1);

  assert.equal(result.ok, true);
  assert.deepEqual(engine.player.pos, { x: 2, y: 2 });
  assert.equal(engine.movementPoints, 1);
});

test('blocked and out-of-range commands do not consume a turn', () => {
  const engine = new CombatEngine();
  engine.player.pos = { x: 4, y: 3 };

  const blocked = engine.movePlayer(1, 0);
  assert.equal(blocked.ok, false);
  assert.deepEqual(engine.player.pos, { x: 4, y: 3 });
  assert.equal(engine.movementPoints, 2);

  const attack = engine.usePlayerSkill('cinder-route');
  assert.equal(attack.ok, false);
  assert.equal(engine.phase, PHASES.PLAYER_COMMAND);
  assert.equal(engine.player.readyAtMs, 0);
});

test('Cinder Route exposes its Ember weakness in the damage calculation', () => {
  const engine = new CombatEngine();
  const calculation = engine.calculateDamage(engine.player, engine.enemy, engine.getSkill('cinder-route'));

  assert.equal(calculation.base, 19);
  assert.equal(calculation.deliveryMultiplier, 1);
  assert.equal(calculation.essenceMultiplier, 1.25);
  assert.equal(calculation.typedDamage, 24);
});

test('Umbral damage is resisted by Ren', () => {
  const engine = new CombatEngine();
  const calculation = engine.calculateDamage(engine.enemy, engine.player, engine.getSkill('moonless-thorns'));

  assert.equal(calculation.base, 15);
  assert.equal(calculation.essenceMultiplier, 0.75);
  assert.equal(calculation.typedDamage, 11);
});

test('a committed skill applies recovery and rejects a second command', () => {
  const engine = new CombatEngine();
  engine.player.pos = { x: 6, y: 1 };

  const attack = engine.usePlayerSkill('cinder-route');
  assert.equal(attack.ok, true);
  assert.equal(engine.player.readyAtMs, 2400);
  assert.equal(engine.phase, PHASES.WAITING);

  const secondAttack = engine.usePlayerSkill('cinder-route');
  assert.equal(secondAttack.ok, false);
  assert.equal(engine.enemy.hp, 84);
});

test('Guard reduces the next hit and then consumes itself', () => {
  const engine = new CombatEngine();
  engine.player.stance = 'guard';

  const resolution = engine.resolveAttack(engine.enemy, engine.player, engine.getSkill('tetsubo-hew'));
  assert.equal(resolution.guarded, true);
  assert.equal(resolution.finalDamage, 11);
  assert.equal(engine.player.hp, 81);
  assert.equal(engine.player.stance, 'neutral');
});

test('Dodge reliably avoids a physical attack with a supplied successful roll', () => {
  const engine = new CombatEngine({ random: () => 0.1 });
  engine.player.stance = 'dodge';

  const resolution = engine.resolveAttack(engine.enemy, engine.player, engine.getSkill('tetsubo-hew'));
  assert.equal(resolution.dodged, true);
  assert.equal(engine.player.hp, 92);
  assert.equal(engine.player.stance, 'neutral');
});

test('an Arcane Umbral attack cannot consume Dodge', () => {
  const engine = new CombatEngine({ random: () => 0.1 });
  engine.player.stance = 'dodge';

  const resolution = engine.resolveAttack(engine.enemy, engine.player, engine.getSkill('moonless-thorns'));
  assert.equal(resolution.hit, true);
  assert.equal(resolution.finalDamage, 11);
  assert.equal(engine.player.stance, 'dodge');
});

test('the Oni receives a deterministic movement turn after the player commits', () => {
  const engine = new CombatEngine();
  engine.takeStance('guard');
  assert.equal(engine.phase, PHASES.WAITING);

  engine.advance(800);
  assert.equal(engine.phase, PHASES.ENEMY_THINK);
  engine.advance(650);

  assert.deepEqual(engine.enemy.pos, { x: 9, y: 3 });
  assert.equal(engine.phase, PHASES.PLAYER_COMMAND);
  assert.equal(engine.movementPoints, 2);
});

test('restart returns the encounter to its initial data state', () => {
  const engine = new CombatEngine();
  engine.player.hp = 1;
  engine.enemy.hp = 3;
  engine.restart();

  assert.equal(engine.player.hp, 92);
  assert.equal(engine.enemy.hp, 108);
  assert.equal(engine.phase, PHASES.PLAYER_COMMAND);
  assert.equal(engine.result, null);
});

test('a reachable final Cinder Route enters the victory state', () => {
  const engine = new CombatEngine();
  engine.player.pos = { x: 6, y: 1 };
  engine.enemy.hp = 1;

  const result = engine.usePlayerSkill('cinder-route');
  assert.equal(result.ok, true);
  assert.equal(engine.phase, PHASES.VICTORY);
  assert.equal(engine.result, 'victory');
  assert.equal(engine.message, 'The banner falls. Nikola finds Mateus’s Dracul translation beneath the lacquer.');
});

test('an enemy finishing blow enters the defeat state', () => {
  const engine = new CombatEngine();
  engine.player.hp = 1;
  engine.enemy.pos = { x: 2, y: 3 };
  engine.takeStance('guard');

  engine.advance(800);
  engine.advance(650);

  assert.equal(engine.phase, PHASES.DEFEAT);
  assert.equal(engine.result, 'defeat');
});
