import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BATTLE_RESULT_SCHEMA_VERSION,
  createBattleResultFromSnapshot,
  createBattleResultRecord,
  validateBattleResultRecord,
} from '../battle-result-contract.mjs';

test('terminal engine snapshots reduce to a small immutable settlement record', () => {
  const snapshot = {
    encounterId: 'c1-cinder-hounds',
    result: 'victory',
    nowPulse: 19,
    actors: [
      { instanceId: 'ren', templateId: 'ren', faction: 'party', hp: 87, pos: { x: 4, y: 2 } },
      { instanceId: 'aya', templateId: 'aya', faction: 'party', hp: 0, pos: { x: 5, y: 2 } },
      { instanceId: 'cinder-hound-1', templateId: 'cinder-hound', faction: 'enemy', hp: 0 },
    ],
    itemConsumption: { 'river-salve': 1 },
    log: [{ type: 'damage' }],
  };

  const record = createBattleResultFromSnapshot(snapshot);
  assert.deepEqual(record, {
    schemaVersion: BATTLE_RESULT_SCHEMA_VERSION,
    encounterId: 'c1-cinder-hounds',
    result: 'victory',
    partyVitals: { ren: { hp: 87 } },
    itemDebits: { 'river-salve': 1 },
  });
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.partyVitals.ren), true);
  assert.equal(Object.hasOwn(record, 'actors'), false);
  assert.equal(Object.hasOwn(record, 'nowPulse'), false);
  assert.equal(Object.hasOwn(record, 'log'), false);
});

test('result validation is fail-closed and canonicalizes party order', () => {
  const valid = validateBattleResultRecord({
    schemaVersion: BATTLE_RESULT_SCHEMA_VERSION,
    encounterId: 'c9-kurozane',
    result: 'victory',
    partyVitals: { mateus: { hp: 40 }, ren: { hp: 90 } },
    itemDebits: { 'river-salve': 0 },
  }, { expectedEncounterId: 'c9-kurozane' });
  assert.equal(valid.ok, true);
  assert.deepEqual(Object.keys(valid.value.partyVitals), ['ren', 'mateus']);

  const invalid = validateBattleResultRecord({
    schemaVersion: BATTLE_RESULT_SCHEMA_VERSION,
    encounterId: 'wrong-encounter',
    result: 'victory',
    partyVitals: { stranger: { hp: 1 }, ren: { hp: 0 } },
    itemDebits: { 'river-salve': -1, invented: 2 },
    simulationClock: 500,
  }, { expectedEncounterId: 'c9-kurozane' });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join(' '), /simulationClock is not supported/);
  assert.match(invalid.errors.join(' '), /must equal c9-kurozane/);
  assert.match(invalid.errors.join(' '), /unknown party member stranger/);
  assert.match(invalid.errors.join(' '), /ren\.hp must be a positive safe integer/);
  assert.match(invalid.errors.join(' '), /invented is not supported/);
});

test('record creation rejects nonterminal snapshots and duplicate party identities', () => {
  assert.throws(() => createBattleResultFromSnapshot({ result: null, actors: [] }, 'c1-cinder-hounds'), /terminal victory or defeat/);
  assert.throws(() => createBattleResultFromSnapshot({
    result: 'victory',
    actors: [
      { templateId: 'ren', faction: 'party', hp: 20 },
      { templateId: 'ren', faction: 'party', hp: 10 },
    ],
    itemConsumption: { 'river-salve': 0 },
  }, 'c1-cinder-hounds'), /duplicate party member ren/);
  assert.throws(() => createBattleResultRecord({
    encounterId: 'c1-cinder-hounds',
    result: 'victory',
    partyVitals: {},
    itemDebits: { 'river-salve': 0 },
  }), /at least one living party member/);
});
