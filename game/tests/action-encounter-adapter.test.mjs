import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTION_ENCOUNTER_ADAPTER_SCHEMA_VERSION,
  ACTION_ENCOUNTER_IDS,
  ACTION_TILE_PX,
  adaptActionEncounter,
  adaptAllActionEncounters,
  actionCooldownForRecovery,
  createActionEncounterKernel,
  MINIMUM_SHARED_OFFENSIVE_COOLDOWN_MS,
  projectActionTerminalResult,
  sharedOffensiveCooldownMs,
  ZERO_RECOVERY_COOLDOWN_FLOOR_MS,
} from '../action-encounter-adapter.mjs';
import { ACTION_FIXED_STEP_MS, ActionCombatKernel } from '../action-combat.mjs';
import { createAdvancementState, getChapterLevelTarget } from '../advancement.mjs';
import { validateBattleResultRecord } from '../battle-result-contract.mjs';
import { PARTY_PROFILES, PARTY_SKILLS } from '../campaign-combat.mjs';
import { ENCOUNTERS, RECOVERY_PULSE_MS } from '../content/encounters.mjs';

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
    assert.equal(spec.effectMigration.actionAuthority, false);
    assert.equal(Object.isFrozen(spec), true);
    assert.equal(Object.isFrozen(spec.kernelConfig.attacks), true);

    const expectedManifestCount = sourceEnemySkillCount(source) + sourcePartySkillCount(source);
    assert.equal(spec.attackManifest.length, expectedManifestCount, source.id);
    assert.equal(Object.keys(spec.kernelConfig.attacks).length, expectedManifestCount, source.id);
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
  assert.equal(actionCooldownForRecovery(1), RECOVERY_PULSE_MS);
  assert.equal(actionCooldownForRecovery(3), RECOVERY_PULSE_MS * 3);
  assert.equal(sharedOffensiveCooldownMs(0) > 0, true);
  assert.equal(sharedOffensiveCooldownMs(999), MINIMUM_SHARED_OFFENSIVE_COOLDOWN_MS);
});

test('level geometry becomes grounded side-view positions instead of top-down lanes', () => {
  const spec = adaptActionEncounter('c1-cinder-hounds');
  assert.equal(spec.kernelConfig.stage.maxX, 12 * ACTION_TILE_PX);
  assert.equal(spec.kernelConfig.stage.groundY, 320);
  assert.equal(spec.kernelConfig.actors.every(({ position }) => position.y === 320), true);
  assert.equal(spec.kernelConfig.actors.every(({ position }) => position.x > 0 && position.x < spec.kernelConfig.stage.maxX), true);
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

test('dormant summons and weak points are templates, never initial hostile actors', () => {
  const mateus = adaptActionEncounter('fp1-mateus');
  assert.deepEqual(mateus.dormantActors.map(({ id }) => id), ['blood-ward-west-1', 'blood-ward-east-1']);
  assert.equal(mateus.kernelConfig.actors.some(({ id }) => id.startsWith('blood-ward')), false);

  const kurozane = adaptActionEncounter('c9-kurozane');
  assert.deepEqual(kurozane.dormantActors.map(({ id }) => id), ['court-clone-1', 'court-clone-2']);
  assert.equal(kurozane.attackManifest.some(({ ownerTemplateId, sourceSkillId }) => ownerTemplateId === 'court-clone' && sourceSkillId === 'clone-order'), true);
});

test('all specs are structurally accepted by ActionCombatKernel; representative constructors preserve rosters', () => {
  for (const spec of adaptAllActionEncounters()) {
    assert.doesNotThrow(() => new ActionCombatKernel(spec.kernelConfig), spec.encounterId);
  }

  const teaching = createActionEncounterKernel('c1-cinder-hounds');
  assert.equal(teaching.kernel.snapshot().actors.length, 4);
  assert.deepEqual(teaching.kernel.snapshot().actors.map(({ id }) => id), ['ren', 'aya', 'cinder-hound-1', 'cinder-hound-2']);

  const boss = createActionEncounterKernel('fp1-mateus');
  assert.deepEqual(boss.kernel.snapshot().actors.map(({ id }) => id), ['ren', 'aya', 'lise', 'mateus-1']);

  const finalBoss = createActionEncounterKernel('c9-kurozane');
  assert.equal(finalBoss.kernel.snapshot().actors.some(({ id }) => id === 'kurozane-1'), true);
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
