import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTION_BOSS_SHARED_COOLDOWN_FLOOR_MS,
  ACTION_ENCOUNTER_ADAPTER_SCHEMA_VERSION,
  ACTION_ENCOUNTER_IDS,
  ACTION_RECOVERY_PULSE_MS,
  ACTION_START_TILE_OVERRIDES,
  ACTION_TILE_PX,
  adaptActionEncounter,
  adaptAllActionEncounters,
  actionCooldownForRecovery,
  actionEnemyHp,
  actionEnemyGroupCooldownMs,
  actionEnemyGroupDamageMultiplier,
  actionEnemyPower,
  createActionEncounterKernel,
  MINIMUM_SHARED_OFFENSIVE_COOLDOWN_MS,
  projectActionTerminalResult,
  sharedOffensiveCooldownMs,
  ZERO_RECOVERY_COOLDOWN_FLOOR_MS,
} from '../action-encounter-adapter.mjs';
import {
  ACTION_FIXED_STEP_MS,
  ACTION_MOVEMENT_PROFILE_BY_ACTOR_ID,
  ActionCombatKernel,
} from '../action-combat.mjs';
import { createAdvancementState, getChapterLevelTarget } from '../advancement.mjs';
import { validateBattleResultRecord } from '../battle-result-contract.mjs';
import { PARTY_PROFILES, PARTY_SKILLS } from '../campaign-combat.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';

function sourceEnemySkillCount(encounter) {
  return encounter.enemies.reduce((total, enemy) => total + (enemy.skills?.length ?? 0), 0);
}

function sourcePartySkillCount(encounter) {
  return encounter.party.deployment.reduce(
    (total, { actorId }) => total + PARTY_PROFILES[actorId].skillIds.length,
    0,
  );
}

test('every canonical encounter, profile, and skill record has an explicit action adaptation', () => {
  const specs = adaptAllActionEncounters();
  assert.equal(specs.length, ENCOUNTERS.length);
  assert.deepEqual(ACTION_ENCOUNTER_IDS, ENCOUNTERS.map(({ id }) => id));
  assert.deepEqual(specs.map(({ encounterId }) => encounterId), ACTION_ENCOUNTER_IDS);

  const coveredPartyProfiles = new Set();
  let enemyProfileCount = 0;
  let enemySkillCount = 0;
  let partySkillCount = 0;
  for (const [index, spec] of specs.entries()) {
    const source = ENCOUNTERS[index];
    assert.equal(spec.schemaVersion, ACTION_ENCOUNTER_ADAPTER_SCHEMA_VERSION);
    assert.equal(spec.encounterId, source.id);
    assert.equal(spec.levelId, source.levelId);
    assert.equal(spec.chapterLevelTarget, getChapterLevelTarget(source.chapterId));
    assert.equal(spec.profiles.party.length, source.party.deployment.length);
    assert.equal(spec.profiles.enemies.length, source.enemies.length);
    assert.equal(spec.objectiveMigration.actionAuthority, false);
    assert.equal(spec.effectMigration.actionAuthority, true);
    assert.equal(Object.isFrozen(spec), true);
    assert.equal(Object.isFrozen(spec.kernelConfig.attacks), true);

    const expectedManifestCount = sourceEnemySkillCount(source) + sourcePartySkillCount(source);
    assert.equal(spec.attackManifest.length >= expectedManifestCount, true, source.id);
    assert.equal(Object.keys(spec.kernelConfig.attacks).length, spec.attackManifest.length, source.id);
    assert.equal(typeof spec.kernelConfig.statusHooks.afterHit, 'function');
    assert.equal(typeof spec.kernelConfig.statusHooks.afterAttackComplete, 'function');
    enemySkillCount += sourceEnemySkillCount(source);
    partySkillCount += sourcePartySkillCount(source);
    enemyProfileCount += source.enemies.length;

    for (const [partyIndex, profile] of spec.profiles.party.entries()) {
      const deployment = source.party.deployment[partyIndex];
      const canonical = PARTY_PROFILES[deployment.actorId];
      coveredPartyProfiles.add(profile.templateId);
      assert.equal(profile.templateId, deployment.actorId);
      assert.deepEqual(profile.sourceSkillIds, canonical.skillIds);
      assert.deepEqual(profile.resistances, canonical.resistances);
      assert.equal(profile.level, getChapterLevelTarget(source.chapterId));
    }

    for (const [enemyIndex, profile] of spec.profiles.enemies.entries()) {
      const canonical = source.enemies[enemyIndex];
      assert.equal(profile.templateId, canonical.id);
      assert.deepEqual(profile.sourceSkillIds, (canonical.skills ?? []).map(({ id }) => id));
      assert.deepEqual(profile.resistances, canonical.resistances);
      assert.equal(profile.level, getChapterLevelTarget(source.chapterId));
      assert.equal(profile.instanceIds.length + profile.dormantInstanceIds.length, canonical.count ?? canonical.positions?.length ?? 1);
    }

    for (const actor of [...spec.kernelConfig.actors, ...spec.dormantActors]) {
      assert.equal(actor.offensiveCooldownMs >= MINIMUM_SHARED_OFFENSIVE_COOLDOWN_MS, true);
      assert.equal(actor.position.y, spec.kernelConfig.stage.groundY);
      assert.equal(actor.level >= 1, true);
    }

    for (const manifest of spec.attackManifest) {
      const attack = spec.kernelConfig.attacks[manifest.adapterAttackId];
      assert.ok(attack, `${source.id}:${manifest.adapterAttackId}`);
      assert.equal(attack.delivery, manifest.sourceDelivery);
      assert.equal(attack.essence, manifest.sourceEssence);
      assert.equal(attack.cooldownMs > 0, true);
      assert.equal(attack.windupMs % ACTION_FIXED_STEP_MS, 0);
      assert.equal(attack.activeMs % ACTION_FIXED_STEP_MS, 0);
      assert.equal(attack.recoveryMs % ACTION_FIXED_STEP_MS, 0);
      assert.equal(attack.hitbox.width > 0, true);
      assert.equal(attack.hitbox.height > 0, true);
      if (manifest.sourceRecoveryPulses === 0) {
        assert.equal(attack.cooldownMs, ZERO_RECOVERY_COOLDOWN_FLOOR_MS);
      }
    }
  }

  assert.deepEqual([...coveredPartyProfiles].sort(), Object.keys(PARTY_PROFILES).sort());
  assert.equal(enemyProfileCount, ENCOUNTERS.reduce((total, encounter) => total + encounter.enemies.length, 0));
  assert.equal(enemySkillCount, ENCOUNTERS.reduce((total, encounter) => total + sourceEnemySkillCount(encounter), 0));
  assert.equal(partySkillCount, ENCOUNTERS.reduce((total, encounter) => total + sourcePartySkillCount(encounter), 0));
  const coveredPartySkills = new Set(specs.flatMap(({ attackManifest }) => attackManifest
    .filter(({ sourceKind }) => sourceKind === 'party')
    .map(({ sourceSkillId }) => sourceSkillId)));
  assert.deepEqual([...coveredPartySkills].sort(), Object.keys(PARTY_SKILLS).sort());
});

test('Recovery pulses map to cooldown milliseconds with a nonzero zero-pulse floor', () => {
  assert.equal(actionCooldownForRecovery(0), ZERO_RECOVERY_COOLDOWN_FLOOR_MS);
  assert.equal(actionCooldownForRecovery(-1), ZERO_RECOVERY_COOLDOWN_FLOOR_MS);
  assert.equal(actionCooldownForRecovery(1), ACTION_RECOVERY_PULSE_MS);
  assert.equal(actionCooldownForRecovery(3), ACTION_RECOVERY_PULSE_MS * 3);
  assert.equal(sharedOffensiveCooldownMs(0) > 0, true);
  assert.equal(sharedOffensiveCooldownMs(999), MINIMUM_SHARED_OFFENSIVE_COOLDOWN_MS);
});

test('Action Lab preserves ordinary enemy HP and compresses only the boss-health tail', () => {
  assert.equal(actionEnemyHp(120), 120);
  assert.equal(actionEnemyHp(400), 400);
  assert.equal(actionEnemyHp(760), 634);
  assert.equal(actionEnemyHp(1480), 1102);
});

test('Mateus action tuning lengthens the duel without changing generic HP adaptation', () => {
  const mateus = adaptActionEncounter('fp1-mateus');
  const boss = mateus.kernelConfig.actors.find(({ id }) => id === 'mateus-1');
  assert.equal(boss.maxHp, actionEnemyHp(760) * 2);
  assert.throws(() => actionEnemyHp(100, 0), /positive finite/u);
});

test('Action Lab enemy Power follows party progression without an unbounded late-game spike', () => {
  assert.equal(actionEnemyPower(20, 1), 20);
  assert.equal(actionEnemyPower(20, 21), 30);
  assert.equal(actionEnemyPower(20, 40), 38);
  assert.equal(actionEnemyPower(20, 99), 38);
});

test('simultaneous enemy groups retain a bounded readable shared-action cadence', () => {
  assert.equal(actionEnemyGroupCooldownMs(320, 1), 320);
  assert.equal(actionEnemyGroupCooldownMs(320, 2), 480);
  assert.equal(actionEnemyGroupCooldownMs(320, 4), 800);
  assert.equal(actionEnemyGroupCooldownMs(320, 20), 800);
  assert.equal(actionEnemyGroupDamageMultiplier(1), 1);
  assert.equal(Math.round(actionEnemyGroupDamageMultiplier(2) * 1_000), 741);
  assert.equal(actionEnemyGroupDamageMultiplier(20), 0.65);
  const cinderHounds = adaptActionEncounter('c1-cinder-hounds');
  assert.equal(
    cinderHounds.kernelConfig.actors
      .filter(({ id }) => id.startsWith('cinder-hound-'))
      .every(({ offensiveCooldownMs, statuses }) => (
        offensiveCooldownMs === 480
        && statuses.some(({ id, activeEnemyCount }) => id === 'group-pressure' && activeEnemyCount === 2)
      )),
    true,
  );
  assert.equal(
    adaptActionEncounter('c1-tithe-hound').kernelConfig.actors
      .find(({ id }) => id === 'tithe-hound-1')
      ?.offensiveCooldownMs,
    ACTION_BOSS_SHARED_COOLDOWN_FLOOR_MS,
  );
});

test('level geometry becomes grounded side-view positions instead of top-down lanes', () => {
  const spec = adaptActionEncounter('c1-cinder-hounds');
  assert.equal(spec.kernelConfig.stage.maxX, 12 * ACTION_TILE_PX);
  assert.equal(spec.kernelConfig.stage.groundY, 320);
  assert.equal(spec.kernelConfig.actors.every(({ position }) => position.y === 320), true);
  assert.equal(spec.kernelConfig.actors.every(({ position }) => position.x > 0 && position.x < spec.kernelConfig.stage.maxX), true);
});

test('opening action starts use authored left-to-right spacing without hostile overlap', () => {
  assert.deepEqual(Object.keys(ACTION_START_TILE_OVERRIDES), [
    'c1-cinder-hounds',
    'c1-ash-wisps',
    'c1-tithe-hound',
    'fp1-cedar-path',
    'fp1-flooded-archive',
    'fp1-mateus',
  ]);
  for (const encounterId of Object.keys(ACTION_START_TILE_OVERRIDES)) {
    const spec = adaptActionEncounter(encounterId);
    const party = spec.kernelConfig.actors.filter(({ faction, hp }) => faction === 'player' && hp > 0);
    const enemies = spec.kernelConfig.actors.filter(({ faction, hp }) => faction === 'enemy' && hp > 0);
    const rightmostParty = Math.max(...party.map(({ position }) => position.x));
    const leftmostEnemy = Math.min(...enemies.map(({ position }) => position.x));
    assert.equal(
      leftmostEnemy - rightmostParty >= ACTION_TILE_PX * 2,
      true,
      `${encounterId} must show threats at least two side-view tiles beyond the party`,
    );
  }
});

test('actual advancement views override recommended party levels and stats', () => {
  const recommended = adaptActionEncounter('c9-kurozane');
  assert.equal(recommended.profiles.party.every(({ level }) => level === 40), true);

  const advancementState = createAdvancementState();
  const actual = adaptActionEncounter('c9-kurozane', { advancementState });
  assert.equal(actual.profiles.party.every(({ level }) => level === 1), true);
  const ren = actual.kernelConfig.actors.find(({ id }) => id === 'ren');
  assert.equal(ren.level, 1);
  assert.equal(ren.maxHp, 104, 'level-one advancement HP replaces the static campaign-combat profile HP');

  const explicit = adaptActionEncounter('c9-kurozane', { advancementState, partyLevels: { ren: 17 } });
  assert.equal(explicit.kernelConfig.actors.find(({ id }) => id === 'ren').level, 17);
});

test('canonical action fighters retain distinct movement profiles through adaptation and advancement', () => {
  const expected = {
    ren: 'infiltrator',
    lise: 'hunter',
    mateus: 'vampire',
    miyo: 'weather-scholar',
  };
  assert.deepEqual(ACTION_MOVEMENT_PROFILE_BY_ACTOR_ID, expected);
  for (const advancementState of [null, createAdvancementState()]) {
    const spec = adaptActionEncounter('c9-kurozane', { advancementState });
    const kernel = new ActionCombatKernel(spec.kernelConfig);
    const snapshots = new Map(kernel.snapshot().actors.map((actor) => [actor.id, actor]));
    for (const [actorId, movementProfileId] of Object.entries(expected)) {
      const source = spec.kernelConfig.actors.find(({ id }) => id === actorId);
      assert.equal(source.movementProfileId, movementProfileId);
      assert.equal(snapshots.get(actorId).movementProfileId, movementProfileId);
    }
    assert.equal(snapshots.get('ren').moveSpeed > snapshots.get('miyo').moveSpeed, true);
    assert.equal(snapshots.get('miyo').moveSpeed > snapshots.get('mateus').moveSpeed, true);
    assert.equal(snapshots.get('mateus').moveSpeed > snapshots.get('lise').moveSpeed, true);
  }
});

test('an explicit action fighter pair produces a strict duo in authored order', () => {
  const spec = adaptActionEncounter('c9-kurozane', { fighterActorIds: ['lise', 'mateus'] });
  assert.deepEqual(spec.kernelConfig.actors.filter(({ faction }) => faction === 'player').map(({ id }) => id), ['lise', 'mateus']);
  assert.deepEqual(spec.profiles.party.map(({ templateId }) => templateId), ['lise', 'mateus']);
  assert.equal(spec.supportActorId, 'mateus');
  assert.throws(
    () => adaptActionEncounter('c9-kurozane', { fighterActorIds: ['lise', 'lise'] }),
    /must be unique/u,
  );
  assert.throws(
    () => adaptActionEncounter('c9-kurozane', { fighterActorIds: ['lise', 'unknown'] }),
    /Unknown action fighter/u,
  );
});

test('dormant summons and weak points are zero-HP kernel slots until authored activation', () => {
  const mateus = adaptActionEncounter('fp1-mateus');
  assert.deepEqual(mateus.dormantActors.map(({ id }) => id), ['blood-ward-west-1', 'blood-ward-east-1']);
  assert.equal(mateus.kernelConfig.actors
    .filter(({ id }) => id.startsWith('blood-ward'))
    .every(({ hp }) => hp === 0), true);

  const kurozane = adaptActionEncounter('c9-kurozane');
  assert.deepEqual(kurozane.dormantActors.map(({ id }) => id), ['court-clone-1', 'court-clone-2']);
  assert.equal(kurozane.attackManifest.some(({ ownerTemplateId, sourceSkillId }) => ownerTemplateId === 'court-clone' && sourceSkillId === 'clone-order'), true);
  const ujiro = adaptActionEncounter('c6-ujiro');
  assert.deepEqual(ujiro.profiles.summons.map(({ templateId }) => templateId), ['masked-clerk']);
  assert.equal(ujiro.kernelConfig.actors.filter(({ id }) => id.startsWith('masked-clerk')).length, 2);
  assert.equal(ujiro.kernelConfig.actors.filter(({ id }) => id.startsWith('masked-clerk')).every(({ hp }) => hp === 0), true);
});

test('all specs are structurally accepted by ActionCombatKernel; representative constructors preserve rosters', () => {
  for (const spec of adaptAllActionEncounters()) {
    assert.doesNotThrow(() => new ActionCombatKernel(spec.kernelConfig), spec.encounterId);
  }

  const teaching = createActionEncounterKernel('c1-cinder-hounds');
  assert.equal(teaching.kernel.snapshot().actors.length, 4);
  assert.deepEqual(teaching.kernel.snapshot().actors.map(({ id }) => id), ['ren', 'aya', 'cinder-hound-1', 'cinder-hound-2']);
  assert.equal(teaching.kernel.snapshot().controlledActorId, 'ren');
  assert.deepEqual(
    teaching.spec.kernelConfig.actors
      .filter(({ faction }) => faction === 'player')
      .map(({ id, ai }) => ({ id, ai })),
    [
      { id: 'ren', ai: 'deterministic-companion' },
      { id: 'aya', ai: 'deterministic-support' },
    ],
  );

  const boss = createActionEncounterKernel('fp1-mateus');
  assert.deepEqual(
    boss.kernel.snapshot().actors.filter(({ hp }) => hp > 0).map(({ id }) => id),
    ['ren', 'aya', 'lise', 'mateus-1'],
  );

  const finalBoss = createActionEncounterKernel('c9-kurozane');
  assert.equal(finalBoss.kernel.snapshot().actors.some(({ id }) => id === 'kurozane-1'), true);
});

test('an optional action support actor creates a duo without duplicating authored party members', () => {
  const prologueDuo = adaptActionEncounter('prologue-ashen-bailiff', { supportActorId: 'aya' });
  assert.equal(prologueDuo.supportActorId, 'aya');
  assert.equal(
    prologueDuo.kernelConfig.actors.find(({ id }) => id === 'ashen-bailiff-1')?.ai,
    'deterministic-sentry',
  );
  const actionBailiff = prologueDuo.kernelConfig.actors.find(({ id }) => id === 'ashen-bailiff-1');
  assert.equal(actionBailiff.power, 7);
  assert.equal(actionBailiff.offensiveCooldownMs, 1_200);
  assert.deepEqual(
    prologueDuo.kernelConfig.actors.filter(({ faction }) => faction === 'player').map(({ id }) => id),
    ['ren', 'aya'],
  );
  assert.equal(prologueDuo.profiles.party.find(({ templateId }) => templateId === 'aya')?.sourceSkillIds.length > 0, true);
  assert.equal(prologueDuo.attackManifest.some(({ ownerTemplateId }) => ownerTemplateId === 'aya'), true);

  const authoredDuo = adaptActionEncounter('c1-cinder-hounds', { supportActorId: 'aya' });
  assert.deepEqual(
    authoredDuo.kernelConfig.actors.filter(({ faction }) => faction === 'player').map(({ id }) => id),
    ['ren', 'aya'],
  );
  assert.equal(
    authoredDuo.kernelConfig.actors
      .find(({ id }) => id === 'aya')
      ?.statuses.some(({ id }) => id === 'passive-healer'),
    true,
  );
  assert.throws(
    () => adaptActionEncounter('prologue-ashen-bailiff', { supportActorId: 'missing' }),
    /Unknown action support actor missing/,
  );
});

test('encounter construction accepts explicit control and objective-owned victory options', () => {
  const { spec, kernel } = createActionEncounterKernel('fp1-mateus', {
    controlledActorId: 'lise',
    automaticVictory: false,
  });
  assert.equal(spec.kernelConfig.controlledActorId, 'lise');
  assert.equal(spec.kernelConfig.automaticVictory, false);
  assert.equal(kernel.snapshot().controlledActorId, 'lise');
  assert.equal(kernel.snapshot().automaticVictory, false);
  assert.equal(kernel.setMovement('ren', { x: 1 }).reason, 'not-controlled-actor');
  assert.equal(kernel.setMovement('lise', { x: 1 }).ok, true);
});

test('noncombat resolution remains explicitly outside action objective authority', () => {
  const spec = adaptActionEncounter('epilogue-memorial-walk');
  assert.equal(spec.objectiveMigration.compatibility, 'noncombat-source-do-not-run-as-action-battle');
  assert.equal(spec.objectiveMigration.actionAuthority, false);
  const testimony = spec.kernelConfig.actors.find(({ id }) => id === 'unfiled-testimony-1');
  assert.equal(testimony.faction, 'neutral');
  assert.equal(testimony.ai, null);
});

test('terminal projection validates against battle-result-contract without an adapter dependency', () => {
  const { spec, kernel } = createActionEncounterKernel('c1-cinder-hounds');
  for (const actor of kernel.actors.values()) {
    if (actor.faction === 'enemy') actor.hp = 0;
  }
  kernel.step();
  assert.equal(kernel.snapshot().outcome, 'victory');
  const projected = projectActionTerminalResult(spec, kernel.snapshot(), {
    itemDebits: { 'river-salve': 1 },
  });
  assert.deepEqual(projected, {
    schemaVersion: 1,
    encounterId: 'c1-cinder-hounds',
    result: 'victory',
    partyVitals: { ren: { hp: 118 }, aya: { hp: 96 } },
    itemDebits: { 'river-salve': 1 },
  });
  const validated = validateBattleResultRecord(projected, { expectedEncounterId: spec.encounterId });
  assert.equal(validated.ok, true, validated.errors.join(' '));
  assert.deepEqual(validated.value, projected);
  assert.throws(
    () => projectActionTerminalResult(spec, { ...kernel.snapshot(), outcome: null }),
    /terminal action snapshot/,
  );
});
