import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCampaignCombat,
  OBJECTIVE_ACTIONS,
} from '../campaign-combat.mjs';
import { chooseCampaignCombatCommand } from '../battle-solver.mjs';

function enterPhaseTwo() {
  const engine = createCampaignCombat('fp1-mateus');
  engine.getActor('mateus-1').hp = 400;
  assert.equal(engine.guard(engine.activeActorId).ok, true);
  assert.equal(engine.activeActorId, 'mateus-1');
  const activation = engine.resolveEnemyActivation();
  assert.equal(activation.ok, true);
  assert.equal(activation.resolution.skillId, 'blood-ward');
  return engine;
}

function advanceToPublishedLitany(engine) {
  for (let commands = 0; commands < 30 && !engine.getBossMechanicStatus().pendingIntent; commands += 1) {
    if (engine.phase === 'player-command') assert.equal(engine.guard(engine.activeActorId).ok, true);
    else assert.equal(engine.resolveEnemyActivation().ok, true);
  }
  return engine.getBossMechanicStatus().pendingIntent;
}

test('boss mechanic status remains absent from every non-FP-1 snapshot', () => {
  const engine = createCampaignCombat('prologue-ashen-bailiff');
  assert.equal(engine.getBossMechanicStatus(), null);
  assert.equal(Object.hasOwn(engine.snapshot(), 'bossMechanic'), false);
});

test('FP-1 starts with authored Blood Ward spawns dormant', () => {
  const engine = createCampaignCombat('fp1-mateus');
  const mechanic = engine.getBossMechanicStatus();
  assert.equal(mechanic.activeWardCount, 0);
  assert.equal(mechanic.incomingDamageMultiplier, 1);
  assert.deepEqual(mechanic.wards.map(({ active }) => active), [false, false]);
  assert.equal(engine.getActor('blood-ward-west-1').canAct, false);
  assert.equal(engine.getActor('blood-ward-east-1').canAct, false);
  assert.equal(engine.performObjectiveAction(engine.activeActorId, {
    type: OBJECTIVE_ACTIONS.BREAK_OBJECT,
    targetId: 'blood-ward-west',
  }).ok, false);
  const actor = engine.activeActor;
  const dormantWard = engine.getActor('blood-ward-west-1');
  dormantWard.pos = { x: actor.pos.x + 1, y: actor.pos.y };
  assert.equal(engine.previewDamage(actor.instanceId, dormantWard.instanceId, actor.skills[0].id), null);
  assert.match(engine.useSkill(actor.instanceId, actor.skills[0].id, dormantWard.instanceId).reason, /not a living enemy/i);
  assert.notEqual(chooseCampaignCombatCommand(engine)?.type, 'objective');
});

test('Blood Ward conditionally restores both seals and explicitly mitigates Mateus damage', () => {
  const engine = enterPhaseTwo();
  const mechanic = engine.getBossMechanicStatus();
  assert.equal(mechanic.activeWardCount, 2);
  assert.equal(mechanic.incomingDamageMultiplier, 0.25);
  assert.deepEqual(mechanic.wards.map(({ hp, maxHp }) => hp === maxHp), [true, true]);
  assert.equal(engine.log.filter(({ type }) => type === 'summon').length, 2);

  const actor = engine.activeActor;
  const mateus = engine.getActor('mateus-1');
  mateus.pos = { x: actor.pos.x + 1, y: actor.pos.y };
  const preview = engine.previewDamage(actor.instanceId, mateus.instanceId, actor.skills[0].id);
  assert.equal(preview.incomingDamageMultiplier, 0.25);
  assert.equal(preview.mitigatedDamage, Math.max(1, Math.round(preview.typedDamage * 0.25)));
  const hit = engine.useSkill(actor.instanceId, actor.skills[0].id, mateus.instanceId);
  assert.equal(hit.ok, true);
  assert.equal(hit.incomingDamageMultiplier, 0.25);
  assert.equal(hit.finalDamage, preview.mitigatedDamage);
  assert.equal(engine.log.some(({ type, source }) => type === 'damage-mitigated' && source === 'blood-ward'), true);
});

test('the shared solver publishes a ward objective only after Blood Ward activates it', () => {
  const engine = enterPhaseTwo();
  const command = chooseCampaignCombatCommand(engine);
  assert.equal(command.type, 'objective');
  assert.equal(command.action.type, OBJECTIVE_ACTIONS.BREAK_OBJECT);
  assert.equal(command.action.targetId, 'blood-ward-west');
});

test('Crimson Litany publishes a four-tile answer window before resolving into Recovery 3', () => {
  const engine = enterPhaseTwo();
  const intent = advanceToPublishedLitany(engine);
  assert.ok(intent);
  assert.equal(intent.skillId, 'crimson-litany');
  assert.equal(intent.kind, 'line');
  assert.equal(intent.tiles.length, 4);
  assert.equal(intent.answerActivationsRequired, 1);
  assert.equal(intent.answerActivations, 0);
  assert.equal(intent.recoveryPulses, 3);
  assert.match(intent.answer, /Move|Guard/);
  assert.equal(engine.log.some(({ type }) => type === 'intent-resolved'), false);

  assert.equal(engine.guard(engine.activeActorId).ok, true);
  const mechanic = engine.getBossMechanicStatus();
  assert.equal(mechanic.pendingIntent, null);
  assert.equal(mechanic.recovery.sourceSkillId, 'crimson-litany');
  assert.equal(mechanic.recovery.recoveryPulses, 3);
  const resolved = engine.log.find(({ type }) => type === 'intent-resolved');
  assert.equal(resolved.answerActivations, 1);
  assert.deepEqual(resolved.avoidedTargetIds, []);
  assert.equal(resolved.aftermath.recoveryPulses, 3);
  const answered = engine.log.find(({ type }) => type === 'intent-answered');
  assert.equal(answered.answerActivationsRequired, 1);
});

test('Crimson Litany records exact published targets that cleared the line without inventing stance Dodge', () => {
  const engine = enterPhaseTwo();
  const intent = advanceToPublishedLitany(engine);
  assert.deepEqual(intent.targetIdsAtPublish, ['lise']);
  const lise = engine.getActor('lise');
  lise.pos = { x: 3, y: 4 };
  const hpBefore = lise.hp;
  assert.equal(engine.guard(engine.activeActorId).ok, true);
  const resolved = engine.log.find(({ type }) => type === 'intent-resolved');
  assert.deepEqual(resolved.hitTargetIds, []);
  assert.deepEqual(resolved.avoidedTargetIds, ['lise']);
  assert.equal(lise.hp, hpBefore);
  assert.equal(engine.log.some(({ type }) => type === 'attack-evaded'), false);
});

test('breaking both active wards resolves FP-1 as a nonlethal surrender at 20 percent HP', () => {
  const engine = enterPhaseTwo();
  for (const targetId of ['blood-ward-west', 'blood-ward-east']) {
    const result = engine.performObjectiveAction(engine.activeActorId, {
      type: OBJECTIVE_ACTIONS.BREAK_OBJECT,
      targetId,
    });
    assert.equal(result.ok, true);
  }
  const mateus = engine.getActor('mateus-1');
  const resolution = engine.getBossMechanicStatus().resolution;
  assert.equal(engine.result, 'victory');
  assert.equal(mateus.hp, Math.ceil(mateus.maxHp * 0.2));
  assert.equal(mateus.active, false);
  assert.deepEqual(resolution, {
    kind: 'nonlethal-surrender',
    reason: 'both-wards-broken',
    actorId: 'mateus-1',
    hp: 152,
    hpThreshold: 152,
    bothWardsBroken: true,
    pulse: 0,
  });
  assert.equal(engine.log.at(-1).type, 'commit');
  assert.equal(engine.log.some(({ type }) => type === 'surrender'), true);
  assert.equal(engine.log.some(({ type, targetId }) => type === 'damage' && targetId === 'mateus-1'), false);
});
