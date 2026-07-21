import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMBAT_BALANCE_AUDIT_SCHEMA_VERSION,
  COMBAT_BALANCE_LIMITS,
  createCombatBalanceAudit,
} from '../combat-balance-audit.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';

const audit = createCombatBalanceAudit();

test('all 23 chronological first clears and first replays stay inside bounded balance limits', () => {
  assert.equal(audit.schemaVersion, COMBAT_BALANCE_AUDIT_SCHEMA_VERSION);
  assert.equal(audit.encounterCount, ENCOUNTERS.length);
  assert.equal(audit.encounterCount, 23);
  assert.equal(audit.scheduleOnly, true);
  assert.equal(audit.wallClockTimingUsed, false);
  assert.deepEqual(audit.violations, []);
  assert.deepEqual(audit.summary, {
    firstClearVictories: 23,
    firstClearPlayerCommands: 231,
    firstClearEnemyActivations: 98,
    firstClearPartyKnockouts: 0,
    minimumSurvivorHpRatio: 0.154545,
    minimumSurvivorEncounterId: 'fp1-cedar-path',
    maximumPlayerCommands: 55,
    maximumPlayerCommandEncounterId: 'c9-kurozane',
    repeatPolicySteps: 608,
    repeatBasePresentationMs: 353_880,
    maximumRepeatBasePresentationMs: 53_800,
    maximumRepeatEncounterId: 'c9-kurozane',
    speedInvariantEncounterCount: 23,
    kurozaneObservedSkillIds: [
      'black-chrysanthemum',
      'blood-eclipse',
      'court-command',
      'yearless-thrust',
    ],
    kurozaneObservedRecoveryPulses: [1, 2, 3],
    violationCount: 0,
  });
  assert.equal(Object.isFrozen(audit), true);
  assert.equal(Object.isFrozen(COMBAT_BALANCE_LIMITS), true);
});

test('the tuned Cedar Path teaching fight preserves pressure without a policy knockout', () => {
  const encounter = audit.encounters.find(({ encounterId }) => encounterId === 'fp1-cedar-path');
  assert.equal(encounter.firstClear.solved, true);
  assert.equal(encounter.firstClear.partyKnockouts, 0);
  assert.equal(encounter.firstClear.minimumSurvivorHpRatio, 0.154545);
  assert.equal(encounter.firstClear.aggregatePartyHpRatio, 0.55597);
  assert.equal(encounter.firstClear.partyDamageTaken, 119);
  assert.equal(encounter.firstClear.enemyActivations, 17);
  assert.deepEqual(encounter.firstClear.observedEnemyRecoveryPulses, [1, 2]);
  assert.ok(encounter.firstClear.minimumSurvivorHpRatio
    >= COMBAT_BALANCE_LIMITS.minimumFirstClearSurvivorHpRatio);
});

test('Kurozane exercises every authored phase skill and exact 1/2/3-pulse recovery bands', () => {
  const encounter = audit.encounters.find(({ encounterId }) => encounterId === 'c9-kurozane');
  assert.deepEqual(encounter.firstClear.observedEnemySkillIds, [
    'black-chrysanthemum',
    'blood-eclipse',
    'court-command',
    'yearless-thrust',
  ]);
  assert.deepEqual(encounter.firstClear.observedEnemyRecoveryPulses, [1, 2, 3]);
  assert.equal(encounter.firstClear.playerCommands, 55);
  assert.equal(encounter.firstClear.guardCommands, 37);
  assert.equal(encounter.firstClear.guardShare, 0.672727);
  assert.equal(encounter.firstClear.enemyActivations, 9);
  assert.equal(encounter.firstClear.partyDamageTaken, 141);
  assert.equal(encounter.firstClear.partyKnockouts, 0);
});

test('every replay has identical decisions/rewards at exact 1x/2x/4x schedules', () => {
  for (const encounter of audit.encounters) {
    assert.equal(encounter.repeat.result, 'victory', encounter.encounterId);
    assert.equal(encounter.repeat.decisionsAndRewardsInvariant, true, encounter.encounterId);
    assert.equal(encounter.repeat.verified, true, encounter.encounterId);
    assert.deepEqual(encounter.repeat.exactSpeedRatios, { 1: 1, 2: 2, 4: 4 }, encounter.encounterId);
    assert.equal(encounter.repeat.scheduledMsBySpeed[1], encounter.repeat.basePresentationMs);
    assert.equal(encounter.repeat.scheduledMsBySpeed[2], encounter.repeat.basePresentationMs / 2);
    assert.equal(encounter.repeat.scheduledMsBySpeed[4], encounter.repeat.basePresentationMs / 4);
  }
});
