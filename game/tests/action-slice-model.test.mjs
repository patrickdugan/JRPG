import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTION_SLICE_CONSEQUENCE,
  ACTION_SLICE_DEFAULT_FIGHTERS,
  ACTION_SLICE_ENCOUNTER_IDS,
  ACTION_SLICE_PHASES,
  ACTION_SLICE_ROSTER,
  acknowledgeActionSliceConsequence,
  beginActionSliceRun,
  createActionSliceRun,
  getActionSliceExpectedEncounter,
  hydrateActionSliceRun,
  leaveActionSliceSanctuary,
  migrateActionSliceRun,
  recordActionSliceBattleReceipt,
  selectActionSliceFighters,
  serializeActionSliceRun,
  snapshotActionSliceRun,
  useActionSliceSanctuary,
  validateActionSliceRun,
} from '../action-slice-model.mjs';
import {
  BATTLE_RESULT_SCHEMA_VERSION,
  createBattleResultRecord,
} from '../battle-result-contract.mjs';

const receipt = (encounterId, partyVitals, result = 'victory') => createBattleResultRecord({
  encounterId,
  result,
  partyVitals,
  itemDebits: { 'river-salve': 0 },
});

function reachSanctuary() {
  let run = beginActionSliceRun(createActionSliceRun());
  run = recordActionSliceBattleReceipt(run, receipt('c1-cinder-hounds', {
    lise: { hp: 70 },
    mateus: { hp: 61 },
  }));
  return recordActionSliceBattleReceipt(run, receipt('c1-ash-wisps', {
    lise: { hp: 48 },
  }));
}

test('manifest locks the noncanonical seven-phase route and exact selectable roster', () => {
  assert.deepEqual(ACTION_SLICE_ROSTER, ['ren', 'lise', 'mateus', 'miyo']);
  assert.deepEqual(ACTION_SLICE_DEFAULT_FIGHTERS, ['lise', 'mateus']);
  assert.deepEqual(ACTION_SLICE_PHASES.map(({ id }) => id), [
    'briefing',
    'ordinary-encounter',
    'platform-encounter',
    'aya-sanctuary',
    'boss-encounter',
    'consequence',
    'complete',
  ]);
  assert.deepEqual(ACTION_SLICE_ENCOUNTER_IDS, [
    'c1-cinder-hounds',
    'c1-ash-wisps',
    'c1-tithe-hound',
  ]);
  assert.match(ACTION_SLICE_CONSEQUENCE.text, /testimony/i);
  assert.equal(Object.isFrozen(ACTION_SLICE_PHASES[1]), true);

  const run = createActionSliceRun();
  assert.equal(run.canonical, false);
  assert.deepEqual(run.fighters, ['lise', 'mateus']);
  assert.equal(run.phase, 'briefing');
});

test('briefing accepts exactly two unique fighters from the four-member roster', () => {
  const selected = selectActionSliceFighters(createActionSliceRun(), ['ren', 'miyo'], {
    fighterVitals: {
      ren: { hp: 120, maxHp: 120 },
      miyo: { hp: 90, maxHp: 96 },
    },
  });
  assert.deepEqual(selected.fighters, ['ren', 'miyo']);
  assert.deepEqual(selected.vitals, {
    ren: { hp: 120, maxHp: 120 },
    miyo: { hp: 90, maxHp: 96 },
  });
  assert.throws(() => createActionSliceRun({ fighters: ['ren'] }), /exactly two/);
  assert.throws(() => createActionSliceRun({ fighters: ['ren', 'ren'] }), /unique/);
  assert.throws(() => createActionSliceRun({ fighters: ['ren', 'aya'] }), /unavailable fighter aya/);
  assert.throws(() => createActionSliceRun({
    fighters: ['ren', 'miyo'],
    fighterVitals: {
      ren: { hp: 50, maxHp: 104, invented: true },
      miyo: { hp: 84, maxHp: 84 },
    },
  }), /invented is not supported/);
  assert.throws(() => selectActionSliceFighters(beginActionSliceRun(selected), ['lise', 'mateus']), /only be selected during briefing/);
});

test('victory receipts advance only in order and preserve selected-pair attrition', () => {
  let run = beginActionSliceRun(createActionSliceRun());
  assert.equal(getActionSliceExpectedEncounter(run).encounterId, 'c1-cinder-hounds');

  run = recordActionSliceBattleReceipt(run, receipt('c1-cinder-hounds', {
    lise: { hp: 70 },
    mateus: { hp: 61 },
  }));
  assert.equal(run.phase, 'platform-encounter');
  assert.deepEqual(run.vitals, {
    lise: { hp: 70, maxHp: 109 },
    mateus: { hp: 61, maxHp: 98 },
  });
  assert.equal(getActionSliceExpectedEncounter(run).encounterId, 'c1-ash-wisps');

  run = recordActionSliceBattleReceipt(run, receipt('c1-ash-wisps', {
    lise: { hp: 48 },
  }));
  assert.equal(run.phase, 'aya-sanctuary');
  assert.deepEqual(run.vitals, {
    lise: { hp: 48, maxHp: 109 },
    mateus: { hp: 0, maxHp: 98 },
  }, 'a selected fighter omitted as downed becomes zero HP');
  assert.equal(getActionSliceExpectedEncounter(run), null);
});

test('Aya heals the selected pair once, then boss victory unlocks one acknowledgment', () => {
  const sanctuary = reachSanctuary();
  let run = useActionSliceSanctuary(sanctuary);
  assert.equal(run.phase, 'boss-encounter');
  assert.deepEqual(run.sanctuary, { resolved: true, used: true });
  assert.deepEqual(run.vitals, {
    lise: { hp: 109, maxHp: 109 },
    mateus: { hp: 98, maxHp: 98 },
  });
  assert.throws(() => useActionSliceSanctuary(run), /not available/);
  assert.equal(getActionSliceExpectedEncounter(run).encounterId, 'c1-tithe-hound');

  run = recordActionSliceBattleReceipt(run, receipt('c1-tithe-hound', {
    lise: { hp: 23 },
    mateus: { hp: 31 },
  }));
  assert.equal(run.phase, 'consequence');
  assert.deepEqual(run.consequence, { unlocked: true, acknowledged: false });
  assert.equal(run.battleReceipts.length, 3);

  run = acknowledgeActionSliceConsequence(run);
  assert.equal(run.phase, 'complete');
  assert.deepEqual(run.consequence, { unlocked: true, acknowledged: true });
  assert.throws(() => acknowledgeActionSliceConsequence(run), /only available after the boss victory/);
});

test('declining Aya preserves platform attrition and still resolves the sanctuary once', () => {
  const sanctuary = reachSanctuary();
  const run = leaveActionSliceSanctuary(sanctuary);
  assert.equal(run.phase, 'boss-encounter');
  assert.deepEqual(run.sanctuary, { resolved: true, used: false });
  assert.deepEqual(run.vitals, sanctuary.vitals);
  assert.throws(() => leaveActionSliceSanctuary(run), /not available/);
});

test('battle boundary rejects wrong encounters, defeats, excess HP, and unselected vitals', () => {
  const run = beginActionSliceRun(createActionSliceRun());
  assert.throws(() => recordActionSliceBattleReceipt(run, receipt('c1-ash-wisps', {
    lise: { hp: 50 },
  })), /must equal c1-cinder-hounds/);
  assert.throws(() => recordActionSliceBattleReceipt(run, receipt('c1-cinder-hounds', {}, 'defeat')), /defeat cannot advance/i);
  assert.throws(() => recordActionSliceBattleReceipt(run, receipt('c1-cinder-hounds', {
    ren: { hp: 50 },
  })), /unselected fighter ren/);
  assert.throws(() => recordActionSliceBattleReceipt(run, receipt('c1-cinder-hounds', {
    lise: { hp: 110 },
  })), /exceeds slice maxHp/);
  assert.equal(run.phase, 'ordinary-encounter');
  assert.equal(run.battleReceipts.length, 0);
});

test('session serialization round-trips while malformed and legacy payloads fail closed', () => {
  const run = reachSanctuary();
  const restored = hydrateActionSliceRun(serializeActionSliceRun(run));
  assert.equal(restored.ok, true);
  assert.deepEqual(restored.value, run);
  assert.notEqual(restored.value, run);

  assert.equal(hydrateActionSliceRun('{broken').ok, false);
  assert.equal(hydrateActionSliceRun(null).ok, false);
  assert.equal(migrateActionSliceRun({ schemaVersion: 0 }).ok, false);

  const extra = structuredClone(run);
  extra.campaignWrite = true;
  const extraChecked = validateActionSliceRun(extra);
  assert.equal(extraChecked.ok, false);
  assert.match(extraChecked.errors.join(' '), /campaignWrite is not supported/);

  const skipped = structuredClone(run);
  skipped.phase = 'boss-encounter';
  skipped.sanctuary = { resolved: true, used: true };
  const skippedChecked = validateActionSliceRun(skipped);
  assert.equal(skippedChecked.ok, false);
  assert.match(skippedChecked.errors.join(' '), /fully healed/);

  const forgedReceipt = structuredClone(run);
  forgedReceipt.battleReceipts[0].encounterId = 'c1-tithe-hound';
  const forgedChecked = validateActionSliceRun(forgedReceipt);
  assert.equal(forgedChecked.ok, false);
  assert.match(forgedChecked.errors.join(' '), /must equal c1-cinder-hounds/);
});

test('snapshots are detached and deeply immutable', () => {
  const run = reachSanctuary();
  const snapshot = snapshotActionSliceRun(run);
  assert.deepEqual(snapshot, run);
  assert.notEqual(snapshot, run);
  assert.notEqual(snapshot.vitals, run.vitals);
  assert.notEqual(snapshot.battleReceipts, run.battleReceipts);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.vitals.lise), true);
  assert.equal(Object.isFrozen(snapshot.battleReceipts[0].partyVitals.lise), true);
  assert.throws(() => { snapshot.vitals.lise.hp = 1; }, TypeError);
});

test('raw battle receipts retain the strict engine-neutral schema only', () => {
  const run = recordActionSliceBattleReceipt(
    beginActionSliceRun(createActionSliceRun()),
    receipt('c1-cinder-hounds', { lise: { hp: 80 }, mateus: { hp: 75 } }),
  );
  assert.deepEqual(Object.keys(run.battleReceipts[0]), [
    'schemaVersion', 'encounterId', 'result', 'partyVitals', 'itemDebits',
  ]);
  assert.equal(run.battleReceipts[0].schemaVersion, BATTLE_RESULT_SCHEMA_VERSION);
  assert.deepEqual(Object.keys(run.battleReceipts[0].partyVitals), ['lise', 'mateus']);
});
