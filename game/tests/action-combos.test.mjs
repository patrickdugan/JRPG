import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTION_COMBO_COOLDOWN_POLICY,
  ACTION_COMBO_RESOLUTION_POLICY,
  ACTION_COMBO_SCHEMA_VERSION,
  HUNTER_PRIEST_COMBO_CONTRACT,
  LISE_DAWN_BOLT_ACTION_ATTACK_ID,
  MATEUS_PENITENT_NIGHT_ACTION_ATTACK_ID,
  getActionComboAvailability,
  getHunterPriestComboAvailability,
  validateActionComboContract,
} from '../action-combos.mjs';
import { createActionEncounterKernel } from '../action-encounter-adapter.mjs';

function comboKernel(controlledActorId = 'lise') {
  return createActionEncounterKernel('c3-dock-patrol', {
    controlledActorId,
    automaticVictory: false,
  });
}

function availability(kernel, options = {}) {
  return getHunterPriestComboAvailability({
    kernelSnapshot: kernel.snapshot(),
    getAttackState: (actorId, attackId) => kernel.getAttackState(actorId, attackId),
    ...options,
  });
}

test('Black Sun Concord is a frozen Hunter-Priest contract over the canonical signature attack ids', () => {
  const contract = HUNTER_PRIEST_COMBO_CONTRACT;
  assert.equal(contract.schemaVersion, ACTION_COMBO_SCHEMA_VERSION);
  assert.equal(contract.id, 'hunter-priest:black-sun-concord');
  assert.equal(contract.name, 'Black Sun Concord');
  assert.match(contract.description, /dawnfire/u);
  assert.match(contract.description, /penitent night/u);
  assert.deepEqual(contract.participantActorIds, ['lise', 'mateus']);
  assert.deepEqual(contract.initiatorActorIds, ['lise', 'mateus']);
  assert.equal(contract.maxAllySeparationPx, 180);
  assert.equal(contract.cooldownPolicy, ACTION_COMBO_COOLDOWN_POLICY);
  assert.equal(contract.resolutionPolicy, ACTION_COMBO_RESOLUTION_POLICY);
  assert.deepEqual(contract.attacks.map(({ actorId, attackId, delivery, essence }) => ({
    actorId, attackId, delivery, essence,
  })), [
    { actorId: 'lise', attackId: LISE_DAWN_BOLT_ACTION_ATTACK_ID, delivery: 'arcane', essence: 'radiance' },
    { actorId: 'mateus', attackId: MATEUS_PENITENT_NIGHT_ACTION_ATTACK_ID, delivery: 'arcane', essence: 'umbral' },
  ]);
  assert.equal(Object.isFrozen(contract), true);
  assert.equal(Object.isFrozen(contract.attacks), true);
  assert.equal(Object.isFrozen(contract.attacks[0]), true);

  const { spec } = comboKernel();
  for (const attack of contract.attacks) {
    const manifest = spec.attackManifest.find(({ adapterAttackId }) => adapterAttackId === attack.attackId);
    assert.ok(manifest, attack.attackId);
    assert.equal(manifest.ownerTemplateId, attack.actorId);
    assert.equal(manifest.sourceSkillId, attack.sourceSkillId);
    assert.equal(manifest.sourceDelivery, attack.delivery);
    assert.equal(manifest.sourceEssence, attack.essence);
  }
});
test('contract validation is immutable and rejects combo-owned cooldowns or collapsed hit resolution', () => {
  const valid = validateActionComboContract(HUNTER_PRIEST_COMBO_CONTRACT);
  assert.deepEqual(valid, []);
  assert.equal(Object.isFrozen(valid), true);

  const collapsed = {
    ...HUNTER_PRIEST_COMBO_CONTRACT,
    resolutionPolicy: 'one-neutral-hit',
    cooldownMs: 0,
    attacks: HUNTER_PRIEST_COMBO_CONTRACT.attacks.map((attack, index) => (
      index === 0 ? { ...attack, cooldownReset: true } : { ...attack }
    )),
  };
  const errors = validateActionComboContract(collapsed);
  assert.equal(Object.isFrozen(errors), true);
  assert.equal(errors.some((error) => error.includes('resolutionPolicy')), true);
  assert.equal(errors.some((error) => error.includes('cooldownMs')), true);
  assert.equal(errors.some((error) => error.includes('cooldownReset')), true);
});

test('either controlled participant can initiate within 180px and receives two separate typed attack requests', () => {
  for (const controlledActorId of ['lise', 'mateus']) {
    const { kernel } = comboKernel(controlledActorId);
    kernel.getActor('mateus').position.x = kernel.getActor('lise').position.x + 180;
    const result = availability(kernel);
    assert.equal(result.available, true, controlledActorId);
    assert.equal(result.initiatorActorId, controlledActorId);
    assert.equal(result.controlledActorId, controlledActorId);
    assert.equal(result.separationPx, 180);
    assert.equal(result.cooldownPolicy, ACTION_COMBO_COOLDOWN_POLICY);
    assert.equal(result.resolutionPolicy, ACTION_COMBO_RESOLUTION_POLICY);
    assert.deepEqual(result.attackRequests, [
      { actorId: 'lise', attackId: LISE_DAWN_BOLT_ACTION_ATTACK_ID, delivery: 'arcane', essence: 'radiance' },
      { actorId: 'mateus', attackId: MATEUS_PENITENT_NIGHT_ACTION_ATTACK_ID, delivery: 'arcane', essence: 'umbral' },
    ]);
    assert.equal(result.participants.every(({ living, ready, committed }) => living && ready && !committed), true);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.attackRequests), true);
    assert.equal(Object.isFrozen(result.attackRequests[0]), true);
  }
});

test('availability fails closed for control, range, life, commitment, and attack readiness', () => {
  const wrongControl = comboKernel('ren').kernel;
  let result = availability(wrongControl);
  assert.equal(result.available, false);
  assert.equal(result.reasons.some(({ code }) => code === 'initiator-not-participant'), true);

  const { kernel } = comboKernel('lise');
  result = availability(kernel, { initiatorActorId: 'mateus' });
  assert.equal(result.available, false);
  assert.equal(result.reasons.some(({ code }) => code === 'initiator-not-controlled'), true);

  kernel.getActor('mateus').position.x = kernel.getActor('lise').position.x + 181;
  result = availability(kernel);
  assert.equal(result.available, false);
  assert.equal(result.reasons.some(({ code }) => code === 'allies-too-far'), true);

  kernel.getActor('mateus').position.x = kernel.getActor('lise').position.x + 100;
  kernel.getActor('mateus').hp = 0;
  result = availability(kernel);
  assert.equal(result.available, false);
  assert.equal(result.reasons.some(({ code, actorId }) => code === 'participant-defeated' && actorId === 'mateus'), true);
  kernel.getActor('mateus').hp = 1;

  assert.equal(kernel.requestAttack('lise', LISE_DAWN_BOLT_ACTION_ATTACK_ID).ok, true);
  result = availability(kernel);
  assert.equal(result.available, false);
  assert.equal(result.reasons.some(({ code, actorId }) => code === 'participant-committed' && actorId === 'lise'), true);
  assert.equal(result.reasons.some(({ code, actorId }) => code === 'signature-attack-not-ready' && actorId === 'lise'), true);
});

test('availability reports native cooldown state without mutating or resetting either participant', () => {
  const { kernel } = comboKernel('mateus');
  const lise = kernel.getActor('lise');
  const mateus = kernel.getActor('mateus');
  lise.offensiveCooldownRemainingMs = 220;
  lise.attackCooldowns[LISE_DAWN_BOLT_ACTION_ATTACK_ID] = 760;
  mateus.offensiveCooldownRemainingMs = 140;
  mateus.attackCooldowns[MATEUS_PENITENT_NIGHT_ACTION_ATTACK_ID] = 480;
  const before = kernel.snapshot();

  const result = availability(kernel);
  assert.equal(result.available, false);
  assert.deepEqual(result.participants.map(({ actorId, attackState }) => ({
    actorId,
    shared: attackState.sharedCooldownRemainingMs,
    individual: attackState.individualCooldownRemainingMs,
    effective: attackState.effectiveCooldownRemainingMs,
  })), [
    { actorId: 'lise', shared: 220, individual: 760, effective: 760 },
    { actorId: 'mateus', shared: 140, individual: 480, effective: 480 },
  ]);
  assert.deepEqual(kernel.snapshot(), before, 'availability must not reset or otherwise mutate native cooldown state');
});

test('invalid snapshot or lookup input throws, and unknown signature attacks remain unavailable', () => {
  const { kernel } = comboKernel();
  assert.throws(
    () => getActionComboAvailability(HUNTER_PRIEST_COMBO_CONTRACT, {
      kernelSnapshot: { ...kernel.snapshot(), schemaVersion: 999 },
      getAttackState: () => null,
    }),
    /Unsupported action kernel snapshot schema/u,
  );
  assert.throws(
    () => getHunterPriestComboAvailability({ kernelSnapshot: kernel.snapshot() }),
    /requires getAttackState/u,
  );
  const result = getHunterPriestComboAvailability({
    kernelSnapshot: kernel.snapshot(),
    getAttackState: () => null,
  });
  assert.equal(result.available, false);
  assert.equal(result.reasons.filter(({ code }) => code === 'signature-attack-unavailable').length, 2);
});
