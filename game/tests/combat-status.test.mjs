import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAMPAIGN_COMBAT_SNAPSHOT_VERSION,
  CAMPAIGN_COMBAT_PHASES,
  COMBAT_STATUS_DEFINITIONS,
  CampaignCombatEngine,
  PARTY_PROFILES,
  PARTY_SKILLS,
  SPIRIT_RULES,
} from '../campaign-combat.mjs';
import { getEncounter } from '../content/encounters.mjs';

function testLevel() {
  return {
    id: 'status-test-level',
    width: 6,
    height: 6,
    blocked: [],
    terrain: [],
    spawn: { x: 0, y: 0 },
  };
}

function statusEncounter(statusId = null, overrides = {}) {
  const effect = statusId ? { status: statusId, duration: 'one-activation' } : undefined;
  return {
    id: `status-test-${statusId ?? 'plain'}`,
    levelId: 'status-test-level',
    format: 'battle',
    objective: { type: 'defeatAll', text: 'Defeat the test attacker.' },
    party: { roster: ['ren'], deployment: [{ actorId: 'ren', at: '1,3' }] },
    enemies: [{
      id: 'status-attacker',
      name: 'Status Attacker',
      count: 1,
      positions: ['2,3'],
      ledger: 'A deterministic status fixture.',
      stats: { hp: 500, power: 6, guard: 4, speed: 10 },
      resistances: {
        delivery: { cut: 1, pierce: 1, crush: 1, arcane: 1 },
        essence: { ember: 1, frost: 1, storm: 1, radiance: 1, umbral: 1 },
      },
      skills: [{
        id: `apply-${statusId ?? 'plain'}`,
        name: `Apply ${statusId ?? 'Plain'}`,
        delivery: 'arcane',
        power: 4,
        range: 1,
        recoveryPulses: 2,
        dodgeable: false,
        ...(effect ? { effect } : {}),
      }],
    }],
    ...overrides,
  };
}

function profileWithSpirit(currentSpirit) {
  return {
    ...PARTY_PROFILES.ren,
    currentSpirit,
  };
}

function triggerStatus(statusId, currentSpirit = 20) {
  const engine = new CampaignCombatEngine({
    encounter: statusEncounter(statusId),
    level: testLevel(),
    partyProfiles: { ren: profileWithSpirit(currentSpirit) },
  });
  assert.equal(engine.guard('ren').ok, true);
  const advanced = engine.advanceUntilPlayerCommand();
  assert.equal(advanced.enemyActivations, 1);
  assert.equal(engine.activeActorId, 'ren');
  return engine;
}

test('every party actor has bounded deterministic Spirit and every authored skill declares its economy', () => {
  for (const profile of Object.values(PARTY_PROFILES)) {
    assert.ok(Number.isSafeInteger(profile.stats.spirit));
    assert.ok(profile.stats.spirit > 0);
  }
  for (const skill of Object.values(PARTY_SKILLS)) {
    assert.ok(Number.isSafeInteger(skill.spiritCost), `${skill.id} Spirit cost`);
    assert.ok(Number.isSafeInteger(skill.spiritGain), `${skill.id} Spirit gain`);
    assert.ok(skill.spiritCost > 0 || skill.spiritGain > 0, `${skill.id} has a spend or generation role`);
  }

  const engine = new CampaignCombatEngine({
    encounter: statusEncounter(),
    level: testLevel(),
    partyProfiles: { ren: profileWithSpirit(1) },
  });
  engine.getActor('status-attacker-1').pos = { x: 4, y: 3 };
  const before = engine.serialize();
  assert.deepEqual(engine.getSkillSpiritQuote('ren', 'cinder-route'), {
    actorId: 'ren',
    skillId: 'cinder-route',
    spirit: 1,
    maxSpirit: PARTY_PROFILES.ren.stats.spirit,
    spiritCost: 2,
    spiritGain: 0,
    affordable: false,
  });
  assert.equal(engine.previewDamage('ren', 'status-attacker-1', 'cinder-route'), null);
  assert.deepEqual(engine.useSkill('ren', 'cinder-route', 'status-attacker-1'), {
    ok: false,
    reason: 'Not enough Spirit (1/2).',
    spirit: engine.getSkillSpiritQuote('ren', 'cinder-route'),
  });
  assert.equal(engine.serialize(), before, 'an unaffordable skill cannot mutate or commit combat state');
});

test('skill spend, skill generation, and command recovery emit exact clamped Spirit transactions', () => {
  const spender = new CampaignCombatEngine({
    encounter: statusEncounter(),
    level: testLevel(),
    partyProfiles: { ren: profileWithSpirit(2) },
  });
  spender.getActor('status-attacker-1').pos = { x: 4, y: 3 };
  const spent = spender.useSkill('ren', 'cinder-route', 'status-attacker-1');
  assert.equal(spent.ok, true);
  assert.deepEqual(spent.spirit, {
    type: 'spirit-change',
    actorId: 'ren',
    reason: 'skill:cinder-route',
    before: 2,
    requestedDelta: -2,
    delta: -2,
    after: 0,
    maxSpirit: PARTY_PROFILES.ren.stats.spirit,
    pulse: 0,
    skillId: 'cinder-route',
    spiritCost: 2,
    spiritGain: 0,
  });

  const generator = new CampaignCombatEngine({
    encounter: statusEncounter(),
    level: testLevel(),
    partyProfiles: { ren: profileWithSpirit(10) },
  });
  const generated = generator.useSkill('ren', 'courier-cut', 'status-attacker-1');
  assert.equal(generated.ok, true);
  assert.equal(generated.spirit.delta, 3);
  assert.equal(generated.spirit.after, 13);

  const defender = new CampaignCombatEngine({
    encounter: statusEncounter(),
    level: testLevel(),
    partyProfiles: { ren: profileWithSpirit(PARTY_PROFILES.ren.stats.spirit - 2) },
  });
  const guarded = defender.guard('ren');
  assert.equal(guarded.spirit.requestedDelta, SPIRIT_RULES.guardGain);
  assert.equal(guarded.spirit.delta, 2);
  assert.equal(guarded.spirit.after, PARTY_PROFILES.ren.stats.spirit);
});

test('authored Dread and Chill trigger at the next activation and expire after its command', () => {
  const dread = triggerStatus('dread');
  assert.equal(dread.getActor('ren').spirit, 20, 'Guard restores six before Dread drains six');
  assert.equal(dread.getActor('ren').statuses[0].activeThisActivation, true);
  assert.deepEqual(dread.log.find((entry) => entry.type === 'status-effect' && entry.statusId === 'dread'), {
    type: 'status-effect',
    statusId: 'dread',
    actorId: 'ren',
    effect: 'spirit',
    requestedDelta: -6,
    delta: -6,
    before: 26,
    after: 20,
    pulse: 1,
  });
  dread.guard('ren');
  assert.deepEqual(dread.getActor('ren').statuses, []);
  assert.equal(dread.log.at(-2).type, 'status-expired');
  assert.equal(dread.log.at(-1).type, 'commit');

  const chill = triggerStatus('chill');
  assert.equal(chill.pace, 1);
  assert.deepEqual(chill.log.find((entry) => entry.type === 'status-effect' && entry.statusId === 'chill'), {
    type: 'status-effect',
    statusId: 'chill',
    actorId: 'ren',
    effect: 'pace',
    requestedDelta: -1,
    delta: -1,
    before: 2,
    after: 1,
    pulse: 1,
  });
});

test('Shock extends exact command Recovery while Bound caps movement Pace', () => {
  const shock = triggerStatus('shock');
  assert.equal(shock.nowPulse, 1);
  assert.equal(shock.guard('ren').ok, true);
  assert.equal(shock.getActor('ren').readyAtPulse, 3);
  assert.deepEqual(shock.log.find((entry) => entry.type === 'status-effect' && entry.statusId === 'shock'), {
    type: 'status-effect',
    statusId: 'shock',
    actorId: 'ren',
    effect: 'recovery',
    baseRecovery: 1,
    loadoutDelta: 0,
    statusDelta: 1,
    totalStatusDelta: 1,
    finalRecovery: 2,
    readyAtPulse: 3,
    pulse: 1,
  });

  const bound = triggerStatus('bound');
  assert.equal(bound.pace, 0);
  assert.equal(bound.move('ren', -1, 0).ok, false);
  assert.deepEqual(bound.log.find((entry) => entry.type === 'status-effect' && entry.statusId === 'bound'), {
    type: 'status-effect',
    statusId: 'bound',
    actorId: 'ren',
    effect: 'pace-cap',
    cap: 0,
    delta: -2,
    before: 2,
    after: 0,
    pulse: 1,
  });
});

test('Scorch and status-bearing hits preserve exact auditable damage and status logs', () => {
  const engine = triggerStatus('scorch');
  const damage = engine.log.find((entry) => entry.type === 'damage');
  assert.deepEqual(damage, {
    type: 'damage',
    attackerId: 'status-attacker-1',
    targetId: 'ren',
    skillId: 'apply-scorch',
    base: 7,
    deliveryMultiplier: 1,
    essenceMultiplier: 1,
    typedDamage: 7,
    absorbed: false,
    finalDamage: 4,
    guarded: true,
    targetHp: 114,
    statusId: 'scorch',
    statusApplied: true,
    pulse: 0,
  });
  assert.deepEqual(engine.log.find((entry) => entry.type === 'status-applied'), {
    type: 'status-applied',
    statusId: 'scorch',
    targetId: 'ren',
    sourceActorId: 'status-attacker-1',
    sourceSkillId: 'apply-scorch',
    durationActivations: 1,
    pulse: 0,
  });
  assert.deepEqual(engine.log.find((entry) => entry.type === 'status-damage'), {
    type: 'status-damage',
    statusId: 'scorch',
    targetId: 'ren',
    sourceActorId: 'status-attacker-1',
    sourceSkillId: 'apply-scorch',
    baseDamage: COMBAT_STATUS_DEFINITIONS.scorch.activationDamage,
    finalDamage: 5,
    hpBefore: 114,
    targetHp: 109,
    pulse: 1,
  });
});

test('Final Ward Open is a one-activation marker with no invented damage or stat modifier', () => {
  const canonicalEncounter = getEncounter('c9-kurozane');
  const canonicalKurozane = canonicalEncounter.enemies.find(({ id }) => id === 'kurozane');
  const blackChrysanthemum = canonicalKurozane.skills.find(({ id }) => id === 'black-chrysanthemum');
  const yearlessThrust = canonicalKurozane.skills.find(({ id }) => id === 'yearless-thrust');
  const fixture = statusEncounter(null, {
    id: 'final-ward-open-lifecycle',
    enemies: [{
      id: 'kurozane',
      name: canonicalKurozane.name,
      count: 1,
      positions: ['2,3'],
      ledger: canonicalKurozane.ledger,
      stats: { ...canonicalKurozane.stats, speed: 10 },
      resistances: canonicalKurozane.resistances,
      skills: [blackChrysanthemum],
    }],
  });
  const engine = new CampaignCombatEngine({ encounter: fixture, level: testLevel() });
  const definition = COMBAT_STATUS_DEFINITIONS['final-ward-open'];
  assert.deepEqual(definition, {
    id: 'final-ward-open',
    name: 'Final Ward Open',
    kind: 'tactical-marker',
  });

  assert.equal(engine.guard('ren').ok, true);
  assert.equal(engine.phase, CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND);
  const appliedAttack = engine.resolveEnemyActivation();
  assert.equal(appliedAttack.ok, true);
  assert.equal(appliedAttack.resolution.skillId, 'black-chrysanthemum');
  const kurozane = engine.getActor('kurozane-1');
  assert.deepEqual(kurozane.statuses, [{
    id: 'final-ward-open',
    sourceActorId: 'kurozane-1',
    sourceSkillId: 'black-chrysanthemum',
    appliedAtPulse: 0,
    durationActivations: 1,
    remainingActivations: 1,
    activeThisActivation: false,
  }]);
  assert.deepEqual(engine.log.find((entry) => entry.type === 'status-applied' && entry.statusId === 'final-ward-open'), {
    type: 'status-applied',
    statusId: 'final-ward-open',
    targetId: 'kurozane-1',
    sourceActorId: 'kurozane-1',
    sourceSkillId: 'black-chrysanthemum',
    durationActivations: 1,
    pulse: 0,
  });
  assert.equal(engine.log.some((entry) => entry.type === 'status-effect' && entry.statusId === 'final-ward-open'), false);
  assert.equal(engine.log.some((entry) => entry.type === 'status-damage' && entry.statusId === 'final-ward-open'), false);

  kurozane.skills = [yearlessThrust];
  while (engine.phase === CAMPAIGN_COMBAT_PHASES.PLAYER_COMMAND) {
    assert.equal(engine.guard(engine.activeActorId).ok, true);
  }
  assert.deepEqual(engine.log.find((entry) => entry.type === 'status-triggered' && entry.statusId === 'final-ward-open'), {
    type: 'status-triggered',
    statusId: 'final-ward-open',
    actorId: 'kurozane-1',
    sourceActorId: 'kurozane-1',
    sourceSkillId: 'black-chrysanthemum',
    remainingActivations: 1,
    pulse: 3,
  });
  assert.equal(engine.resolveEnemyActivation().ok, true);
  assert.deepEqual(kurozane.statuses, []);
  assert.deepEqual(engine.log.find((entry) => entry.type === 'status-expired' && entry.statusId === 'final-ward-open'), {
    type: 'status-expired',
    statusId: 'final-ward-open',
    actorId: 'kurozane-1',
    sourceActorId: 'kurozane-1',
    sourceSkillId: 'black-chrysanthemum',
    pulse: 3,
  });
});

test('status AI traces replay identically and snapshots are deeply immutable JSON', () => {
  const run = () => {
    const engine = triggerStatus('shock');
    engine.guard('ren');
    return engine.snapshot();
  };
  const first = run();
  const replay = run();
  assert.deepEqual(replay, first);
  assert.equal(first.schemaVersion, CAMPAIGN_COMBAT_SNAPSHOT_VERSION);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.actors), true);
  assert.equal(Object.isFrozen(first.actors[0]), true);
  assert.equal(Object.isFrozen(first.actors[0].statuses), true);
  assert.throws(() => {
    first.actors[0].spirit = 0;
  }, TypeError);

  const engine = triggerStatus('dread');
  const serialized = engine.serialize();
  assert.deepEqual(JSON.parse(serialized), engine.snapshot());
  const parsed = JSON.parse(serialized);
  parsed.actors[0].spirit = 0;
  assert.equal(engine.getActor('ren').spirit, 20, 'serialized state cannot mutate the live engine');
});
