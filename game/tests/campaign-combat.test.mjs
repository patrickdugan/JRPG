import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildObjectiveRequirements,
  calculateTypedDamage,
  CAMPAIGN_COMBAT_PHASES,
  CampaignCombatEngine,
  canMoveEightWay,
  createCampaignCombat,
  OBJECTIVE_ACTIONS,
  PARTY_PROFILES,
  RECOVERY_PULSE_MS,
} from '../campaign-combat.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';

function simpleLevel(blocked = []) {
  return { id: 'test-level', width: 6, height: 6, blocked, terrain: [], spawn: { x: 0, y: 0 } };
}

function simpleEncounter(overrides = {}) {
  return {
    id: 'test-encounter', levelId: 'test-level', format: 'battle',
    objective: { type: 'defeatAll', text: 'Defeat all.' },
    party: { roster: ['ren', 'aya'], deployment: [{ actorId: 'ren', at: '1,3' }, { actorId: 'aya', at: '1,4' }] },
    enemies: [{
      id: 'dummy', name: 'Dummy', count: 1, positions: ['4,3'], ledger: 'A test target.',
      stats: { hp: 40, power: 6, guard: 3, speed: 10 },
      resistances: { delivery: { cut: 0.75, pierce: 1.25, crush: 1, arcane: 1 }, essence: { ember: 1.25, frost: 1, storm: 1, radiance: 1, umbral: 1 } },
      skills: [{ id: 'poke', name: 'Poke', delivery: 'pierce', power: 4, range: 1, recoveryPulses: 2 }],
    }],
    ...overrides,
  };
}

test('loads authored encounter and level data into multiple actor instances', () => {
  const engine = createCampaignCombat('c1-cinder-hounds');
  assert.equal(engine.level.id, 'c1-flooded-cedars');
  assert.deepEqual(engine.actors.filter((actor) => actor.faction === 'party').map((actor) => actor.instanceId), ['ren', 'aya']);
  assert.deepEqual(engine.actors.filter((actor) => actor.faction === 'enemy').map((actor) => actor.instanceId), ['cinder-hound-1', 'cinder-hound-2']);
  assert.equal(engine.activeActorId, 'ren');
  assert.equal(engine.pace, 2);
  assert.equal(engine.pulseMs, RECOVERY_PULSE_MS);
});

test('party profiles may enter battle wounded without reducing maximum HP', () => {
  const engine = new CampaignCombatEngine({
    encounterId: 'c1-cinder-hounds',
    partyProfiles: { ren: { ...PARTY_PROFILES.ren, currentHp: 37 } },
  });
  const ren = engine.snapshot().actors.find((actor) => actor.templateId === 'ren');
  assert.equal(ren.hp, 37);
  assert.equal(ren.maxHp, PARTY_PROFILES.ren.stats.hp);
});

test('loadout timing modifiers grant Pace and shorten recovery deterministically', () => {
  const engine = new CampaignCombatEngine({
    encounter: simpleEncounter(),
    level: simpleLevel(),
    partyProfiles: {
      ren: { ...PARTY_PROFILES.ren, loadout: { paceDelta: 1, recoveryPulsesDelta: -1 } },
    },
  });
  const ren = engine.getActor('ren');
  assert.equal(ren.paceDelta, 1);
  assert.equal(ren.recoveryPulsesDelta, -1);
  assert.equal(engine.pace, 3);
  assert.equal(engine.move('ren', 1, 0).ok, true);
  assert.equal(engine.move('ren', 1, 0).ok, true);
  assert.equal(engine.useSkill('ren', 'courier-cut', 'dummy-1').ok, true);
  assert.equal(ren.readyAtPulse, 1);
});

test('loadout timing modifiers cannot produce negative Pace or sub-pulse recovery', () => {
  const engine = new CampaignCombatEngine({
    encounter: simpleEncounter(),
    level: simpleLevel(),
    partyProfiles: {
      ren: { ...PARTY_PROFILES.ren, loadout: { paceDelta: -99, recoveryPulsesDelta: -99 } },
    },
  });
  assert.equal(engine.pace, 0);
  assert.equal(engine.move('ren', 1, 0).ok, false);
  assert.equal(engine.guard('ren').ok, true);
  assert.equal(engine.getActor('ren').readyAtPulse, 1);
});

test('every authored campaign encounter instantiates with a first-class objective contract', () => {
  for (const encounter of ENCOUNTERS) {
    const engine = createCampaignCombat(encounter.id);
    assert.equal(engine.encounter.id, encounter.id);
    assert.equal(engine.level.id, encounter.levelId);
    assert.equal(engine.objectiveRequirements.some((item) => item.key.startsWith('custom:')), false, encounter.id);
  }
});

test('8-way movement is exact, collision-aware, and obeys strict corner rules', () => {
  const level = simpleLevel(['2,1']);
  assert.equal(canMoveEightWay(level, { x: 1, y: 1 }, 1, 1).ok, false);
  assert.equal(canMoveEightWay(level, { x: 1, y: 1 }, 2, 0).ok, false);
  assert.equal(canMoveEightWay(simpleLevel(), { x: 1, y: 1 }, 1, 1, new Set(['2,1'])).ok, false);
  assert.deepEqual(canMoveEightWay(simpleLevel(), { x: 1, y: 1 }, 1, 0).position, { x: 2, y: 1 });
});

test('each legal move spends one Pace without committing the activation', () => {
  const engine = new CampaignCombatEngine({ encounter: simpleEncounter(), level: simpleLevel() });
  assert.deepEqual(engine.move('ren', 1, -1), { ok: true, position: { x: 2, y: 2 }, pace: 1 });
  assert.equal(engine.activeActorId, 'ren');
  assert.equal(engine.move('ren', 0, -1).ok, true);
  assert.equal(engine.move('ren', 0, -1).ok, false);
});

test('Dodge is an exact one-pulse party command with no Spirit transaction', () => {
  const engine = new CampaignCombatEngine({ encounter: simpleEncounter(), level: simpleLevel() });
  assert.equal(engine.getAvailableCommands('ren').includes('dodge'), true);
  const spiritBefore = engine.getActor('ren').spirit;
  engine.getActor('ren').stance = 'guard';
  assert.deepEqual(engine.dodge('ren'), { ok: true, stance: 'dodge', recoveryPulses: 1 });
  assert.equal(engine.getActor('ren').stance, 'dodge', 'Dodge replaces Guard');
  assert.equal(engine.getActor('ren').readyAtPulse, 1);
  assert.equal(engine.getActor('ren').spirit, spiritBefore);
  assert.deepEqual(engine.log.find(({ type }) => type === 'dodge'), {
    type: 'dodge', actorId: 'ren', recoveryPulses: 1, pulse: 0,
  });
  assert.deepEqual(engine.log.find(({ type, actorId }) => type === 'commit' && actorId === 'ren'), {
    type: 'commit', actorId: 'ren', command: 'dodge', readyAtPulse: 1, pulse: 0,
  });
  assert.equal(engine.log.some(({ type, reason }) => type === 'spirit-change' && reason === 'dodge'), false);
  const logLength = engine.log.length;
  assert.equal(engine.dodge('ren').ok, false, 'an actor without command authority cannot re-arm Dodge');
  assert.equal(engine.log.length, logLength);

  const guard = new CampaignCombatEngine({ encounter: simpleEncounter(), level: simpleLevel() });
  guard.getActor('ren').stance = 'dodge';
  assert.equal(guard.guard('ren').ok, true);
  assert.equal(guard.getActor('ren').stance, 'guard', 'Guard replaces Dodge');
});

test('delivery and essence multipliers stack, including absorption', () => {
  const target = { guard: 3, hp: 10, maxHp: 40, resistances: { delivery: { arcane: 0.5 }, essence: { ember: 1.25, umbral: -1 } } };
  const attacker = { power: 10 };
  const ember = calculateTypedDamage(attacker, target, { power: 11, delivery: 'arcane', essence: 'ember' });
  const umbral = calculateTypedDamage(attacker, target, { power: 11, delivery: 'arcane', essence: 'umbral' });
  assert.deepEqual(ember, { base: 20, deliveryMultiplier: 0.5, essenceMultiplier: 1.25, typedDamage: 13, absorbed: false });
  assert.equal(umbral.typedDamage, -10);
  assert.equal(umbral.absorbed, true);
});

test('Guard reduces and consumes the next positive hit', () => {
  const encounter = simpleEncounter({ party: { roster: ['ren'], deployment: [{ actorId: 'ren', at: '1,3' }] } });
  const engine = new CampaignCombatEngine({ encounter, level: simpleLevel() });
  engine.getActor('dummy-1').pos = { x: 2, y: 3 };
  engine.guard('ren');
  engine.advanceUntilPlayerCommand();
  assert.equal(engine.getActor('ren').hp < engine.getActor('ren').maxHp, true);
  assert.equal(engine.getActor('ren').stance, 'neutral');
  const hit = engine.log.find((entry) => entry.type === 'damage');
  assert.equal(hit.guarded, true);
});

test('Dodge deterministically consumes only on an explicitly dodgeable attack', () => {
  const encounter = simpleEncounter({
    party: { roster: ['ren'], deployment: [{ actorId: 'ren', at: '1,3' }] },
    enemies: [{
      ...simpleEncounter().enemies[0],
      positions: ['2,3'],
      skills: [{
        id: 'binding-poke', name: 'Binding Poke', delivery: 'pierce', power: 4,
        range: 1, recoveryPulses: 2, dodgeable: true,
        effect: { status: 'bound', duration: 'one-activation' },
      }],
    }],
  });
  const engine = new CampaignCombatEngine({ encounter, level: simpleLevel() });
  const hpBefore = engine.getActor('ren').hp;
  assert.equal(engine.dodge('ren').ok, true);
  const activation = engine.resolveEnemyActivation();
  assert.equal(activation.ok, true);
  assert.deepEqual(activation.resolution, {
    attackerId: 'dummy-1',
    targetId: 'ren',
    skillId: 'binding-poke',
    base: 7,
    deliveryMultiplier: 1,
    essenceMultiplier: 1,
    typedDamage: 7,
    absorbed: false,
    hit: false,
    dodged: true,
    guarded: false,
    finalDamage: 0,
    targetHp: hpBefore,
    statusId: 'bound',
    statusApplied: false,
  });
  assert.equal(engine.getActor('ren').hp, hpBefore);
  assert.equal(engine.getActor('ren').stance, 'neutral');
  assert.deepEqual(engine.getActor('ren').statuses, []);
  assert.deepEqual(engine.log.find(({ type }) => type === 'dodge-resolved'), {
    type: 'dodge-resolved',
    ...activation.resolution,
    pulse: 0,
  });
  assert.equal(engine.log.some(({ type }) => type === 'damage'), false);
  assert.equal(engine.log.some(({ type }) => type === 'status-applied'), false);
});

test('an attack against another party member leaves Dodge armed', () => {
  const encounter = simpleEncounter({
    enemies: [{
      ...simpleEncounter().enemies[0],
      positions: ['2,4'],
      skills: [{ id: 'marked-poke', name: 'Marked Poke', delivery: 'pierce', power: 4, range: 1, recoveryPulses: 2, dodgeable: true }],
    }],
  });
  const engine = new CampaignCombatEngine({ encounter, level: simpleLevel() });
  assert.equal(engine.dodge('ren').ok, true);
  assert.equal(engine.guard('aya').ok, true);
  const activation = engine.resolveEnemyActivation();
  assert.equal(activation.ok, true);
  assert.equal(activation.resolution.targetId, 'aya');
  assert.equal(engine.getActor('ren').stance, 'dodge');
  assert.equal(engine.log.some(({ type }) => type === 'dodge-resolved'), false);
});

test('Analyze reveals the full authored Ledger and resistance table', () => {
  const engine = new CampaignCombatEngine({ encounter: simpleEncounter(), level: simpleLevel() });
  const result = engine.analyze('ren', 'dummy-1');
  assert.equal(result.ok, true);
  assert.equal(result.readout.ledger, 'A test target.');
  assert.equal(result.readout.delivery.pierce, 1.25);
  assert.equal(engine.getActor('dummy-1').analyzed, true);
});

test('readiness selects all party members and applies recovery pulses', () => {
  const engine = new CampaignCombatEngine({ encounter: simpleEncounter(), level: simpleLevel() });
  engine.guard('ren');
  assert.equal(engine.getActor('ren').readyAtPulse, 1);
  assert.equal(engine.activeActorId, 'aya');
  engine.guard('aya');
  assert.equal(engine.activeActorId, 'dummy-1');
  engine.advanceUntilPlayerCommand();
  assert.equal(engine.nowPulse, 1);
  assert.equal(engine.activeActorId, 'ren');
});

test('enemy AI produces the same attack and movement trace from identical state', () => {
  const encounter = simpleEncounter({ party: { roster: ['ren'], deployment: [{ actorId: 'ren', at: '1,3' }] } });
  const run = () => {
    const engine = new CampaignCombatEngine({ encounter, level: simpleLevel() });
    engine.guard('ren');
    engine.advanceUntilPlayerCommand();
    return engine.log.filter((entry) => ['damage', 'enemy-activation'].includes(entry.type));
  };
  assert.deepEqual(run(), run());
});

test('defeatAll and all-party defeat enter terminal phases', () => {
  const win = new CampaignCombatEngine({ encounter: simpleEncounter(), level: simpleLevel() });
  assert.equal(win.getObjectiveStatus().complete, false);
  const enemy = win.getActor('dummy-1');
  enemy.pos = { x: 2, y: 3 };
  enemy.hp = 1;
  assert.equal(win.useSkill('ren', 'courier-cut', enemy.instanceId).ok, true);
  assert.equal(win.phase, CAMPAIGN_COMBAT_PHASES.VICTORY);

  const lose = new CampaignCombatEngine({ encounter: simpleEncounter({ party: { roster: ['ren'], deployment: [{ actorId: 'ren', at: '1,3' }] } }), level: simpleLevel() });
  lose.getActor('ren').hp = 1;
  lose.getActor('dummy-1').pos = { x: 2, y: 3 };
  lose.guard('ren');
  lose.advanceUntilPlayerCommand();
  assert.equal(lose.phase, CAMPAIGN_COMBAT_PHASES.DEFEAT);
});

test('threshold-or-objects boss objective supports its authored nonlethal branch', () => {
  const engine = createCampaignCombat('fp1-mateus');
  engine.getActor('mateus-1').hp = 400;
  engine.guard(engine.activeActorId);
  engine.resolveEnemyActivation();
  assert.equal(engine.performObjectiveAction(engine.activeActorId, { type: OBJECTIVE_ACTIONS.BREAK_OBJECT, targetId: 'blood-ward-west' }).ok, true);
  assert.equal(engine.performObjectiveAction(engine.activeActorId, { type: OBJECTIVE_ACTIONS.BREAK_OBJECT, targetId: 'blood-ward-east' }).ok, true);
  assert.equal(engine.result, 'victory');
  assert.equal(engine.getActor('mateus-1').hp, 152);
  assert.equal(engine.getBossMechanicStatus().resolution.kind, 'nonlethal-surrender');
});

test('objective action requirements explicitly cover non-defeat encounters', () => {
  const requirements = buildObjectiveRequirements({ type: 'activateRelays', relays: ['west', 'east'] });
  assert.deepEqual(requirements.map((item) => [item.action, item.targetId]), [['activateRelay', 'west'], ['activateRelay', 'east']]);

  const epilogue = createCampaignCombat('epilogue-memorial-walk');
  for (const targetId of ['testimony-table', 'corrections-shelf', 'unfiled-names', 'tower-lantern']) {
    const actorId = epilogue.activeActorId;
    const result = epilogue.performObjectiveAction(actorId, { type: OBJECTIVE_ACTIONS.INTERACT, targetId });
    assert.equal(result.ok, true);
  }
  assert.equal(epilogue.result, 'victory');
});

test('survival objectives require automatic enemy activations and exact exit tile', () => {
  const encounter = simpleEncounter({
    objective: { type: 'surviveThenExit', surviveEnemyActivations: 1, exitTile: '2,3' },
    party: { roster: ['ren'], deployment: [{ actorId: 'ren', at: '1,3' }] },
  });
  const engine = new CampaignCombatEngine({ encounter, level: simpleLevel() });
  assert.equal(engine.performObjectiveAction('ren', { type: OBJECTIVE_ACTIONS.EXIT }).ok, false);
  assert.equal(engine.move('ren', 1, 0).ok, true);
  engine.guard('ren');
  engine.advanceUntilPlayerCommand();
  assert.equal(engine.getObjectiveStatus().requirements.find((item) => item.key === 'survive').complete, true);
  assert.equal(engine.performObjectiveAction('ren', { type: OBJECTIVE_ACTIONS.EXIT }).ok, true);
  assert.equal(engine.result, 'victory');
});
