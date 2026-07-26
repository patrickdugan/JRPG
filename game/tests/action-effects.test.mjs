import assert from 'node:assert/strict';
import test from 'node:test';

import { createActionEncounterKernel } from '../action-encounter-adapter.mjs';

function silenceAi(kernel) {
  for (const actorId of kernel.actorOrder) {
    const actor = kernel.getActor(actorId);
    actor.ai = null;
    if (actor.faction === 'player' && actor.id !== kernel.controlledActorId) actor.faction = 'neutral';
  }
}

function completeAttack(kernel, actorId, attackId) {
  const started = kernel.requestAttack(actorId, attackId);
  assert.equal(started.ok, true, `${actorId} should start ${attackId}`);
  let steps = 0;
  while (kernel.getActor(actorId).activeAttack && steps < 200) {
    kernel.advance(20);
    steps += 1;
  }
  assert.equal(kernel.getActor(actorId).activeAttack, null, `${attackId} should complete`);
  return kernel.drainEvents();
}

test('Blood Ward completion activates both dormant seals and enforces 25% mitigation until they break', () => {
  const { kernel } = createActionEncounterKernel('fp1-mateus', { automaticVictory: false });
  silenceAi(kernel);
  const attackId = 'enemy:mateus:blood-ward';
  const events = completeAttack(kernel, 'mateus-1', attackId);
  assert.deepEqual(
    events.filter(({ type }) => type === 'summon-activated').map(({ summonedActorId }) => summonedActorId),
    ['blood-ward-west-1', 'blood-ward-east-1'],
  );
  const mateus = kernel.getActor('mateus-1');
  const wards = ['blood-ward-west-1', 'blood-ward-east-1'].map((id) => kernel.getActor(id));
  assert.equal(wards.every(({ hp }) => hp > 0), true);
  assert.equal(mateus.statuses.some(({ id }) => id === 'blood-ward'), true);
  const player = kernel.getActor(kernel.controlledActorId);
  const warded = kernel.statusHooks.modifyDamage({
    attacker: player,
    target: mateus,
    attack: kernel.attacks[player.attackIds[0]],
    resolution: { damage: 100 },
    kernel,
  });
  assert.equal(warded.damage, 25);

  wards.forEach((ward) => { ward.hp = 0; });
  kernel.step();
  assert.equal(mateus.statuses.some(({ id }) => id === 'blood-ward'), false);
});

test('Call Clerks activates imported dormant combatants with their canonical attacks', () => {
  const { kernel, spec } = createActionEncounterKernel('c6-ujiro', { automaticVictory: false });
  silenceAi(kernel);
  assert.equal(spec.profiles.summons[0].templateId, 'masked-clerk');
  const events = completeAttack(kernel, 'ujiro-1', 'enemy:ujiro:call-clerks');
  assert.deepEqual(
    events.filter(({ type }) => type === 'summon-activated').map(({ summonedActorId }) => summonedActorId),
    ['masked-clerk-1', 'masked-clerk-2'],
  );
  for (const id of ['masked-clerk-1', 'masked-clerk-2']) {
    const clerk = kernel.getActor(id);
    assert.equal(clerk.hp > 0, true);
    assert.equal(clerk.faction, 'enemy');
    assert.equal(clerk.attackIds.includes('enemy:masked-clerk:seize-copy'), true);
  }
});

test('authored hit statuses and pulls execute at the real hitbox seam and expire deterministically', () => {
  const { kernel } = createActionEncounterKernel('c7-bell-warden-chiyo', { automaticVictory: false });
  silenceAi(kernel);
  const chiyo = kernel.getActor('bell-warden-chiyo-1');
  const player = kernel.getActor(kernel.controlledActorId);
  chiyo.position.x = 300;
  player.position.x = 360;
  chiyo.facing = 1;
  const beforeX = player.position.x;
  const events = completeAttack(kernel, chiyo.id, 'enemy:bell-warden-chiyo:chain-cast');
  assert.equal(events.some(({ type, targetId }) => type === 'hit' && targetId === player.id), true);
  assert.equal(events.some(({ type, targetId, kind }) => (
    type === 'effect-displacement' && targetId === player.id && kind === 'pull'
  )), true);
  assert.equal(player.position.x < beforeX, true);
  assert.equal(player.statuses.some(({ id }) => id === 'bound'), true);
  assert.equal(kernel.statusHooks.modifyMovement({ actor: player, speed: 200 }), 0);

  completeAttack(kernel, player.id, player.attackIds[0]);
  assert.equal(player.statuses.some(({ id }) => id === 'bound'), false);
});
