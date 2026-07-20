import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAdvancementState,
  getEncounterWinCount,
} from '../advancement.mjs';
import { createBattleResultRecord } from '../battle-result-contract.mjs';
import { settleBattleVictory } from '../battle-settlement.mjs';
import { getEncounter } from '../content/encounters.mjs';
import { createFieldState, moveField } from '../field-runtime.mjs';
import { createLoadoutState } from '../loadout.mjs';
import { createCampaignState } from '../progression.mjs';
import { acceptQuest, createQuestState, getQuestProgress } from '../quest-runtime.mjs';
import { createRunReceipt } from '../run-receipt.mjs';
import {
  acceptWitnessChronicle,
  acknowledgeWitnessChronicleLine,
  advanceWitnessChronicle,
  createWitnessChronicleState,
  getWitnessChronicleProgress,
} from '../witness-chronicle-runtime.mjs';

function memoryAdapter(initialState, { failSaves = 0, found = true } = {}) {
  let state = initialState;
  let remainingFailures = failSaves;
  const saves = [];
  return {
    saves,
    get state() { return state; },
    load() { return { ok: true, found, state }; },
    save(nextState) {
      saves.push(nextState);
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        return { ok: false, reason: 'injected save failure' };
      }
      state = nextState;
      return { ok: true };
    },
  };
}

function resultFor(encounterId, partyVitals = { ren: { hp: 80 } }, itemDebits = { 'river-salve': 0 }) {
  return createBattleResultRecord({
    encounterId,
    result: 'victory',
    partyVitals,
    itemDebits,
  });
}

function coreSetup(encounterId, overrides = {}) {
  const advancement = overrides.advancement ?? createAdvancementState();
  const loadout = overrides.loadout ?? createLoadoutState();
  const runReceipt = overrides.runReceipt ?? null;
  return {
    encounter: getEncounter(encounterId),
    states: { advancement, loadout, runReceipt },
    adapters: {
      advancement: memoryAdapter(advancement),
      loadout: memoryAdapter(loadout),
      runReceipt: memoryAdapter(runReceipt),
      ...overrides.adapters,
    },
  };
}

test('victory settlement commits advancement, loadout, and first-clear receipt together', () => {
  const advancement = createAdvancementState();
  const receiptResult = createRunReceipt({
    runId: 'settlement-run-0001',
    campaignState: createCampaignState(),
    advancementState: advancement,
  });
  assert.equal(receiptResult.ok, true, receiptResult.errors?.join(' '));
  const setup = coreSetup('c1-cinder-hounds', {
    advancement,
    runReceipt: receiptResult.state,
  });

  const settled = settleBattleVictory({
    resultRecord: resultFor('c1-cinder-hounds'),
    ...setup,
    flushPlaytime: () => ({ ok: true, state: receiptResult.state }),
  });

  assert.equal(settled.ok, true, settled.message);
  assert.equal(getEncounterWinCount(settled.states.advancement, 'c1-cinder-hounds'), 1);
  assert.equal(settled.states.loadout.vitals.ren.hp, 80);
  assert.deepEqual(settled.states.runReceipt.firstClearEncounterIds, ['c1-cinder-hounds']);
  assert.equal(setup.adapters.advancement.saves.length, 1);
  assert.equal(setup.adapters.loadout.saves.length, 1);
  assert.equal(setup.adapters.runReceipt.saves.length, 1);
  assert.match(settled.messages.at(-1), /^Victory reward:/);
});

function acknowledgeCurrentStage(state, chronicleId) {
  let next = state;
  const lineCount = getWitnessChronicleProgress(next, chronicleId).dialogueLineCount;
  for (let index = 0; index < lineCount; index += 1) {
    const acknowledged = acknowledgeWitnessChronicleLine(next, chronicleId);
    assert.equal(acknowledged.ok, true, acknowledged.reason);
    next = acknowledged.state;
  }
  return next;
}

test('optional quest and witness handoffs join the same transaction', () => {
  const questId = 'sq-p-three-dry-bottles';
  const questObjectiveId = 'find-bottle-a';
  const acceptedQuest = acceptQuest(createQuestState(), questId, {
    campaignState: { completedBeatIds: ['p02-medicine-across-lane'] },
  });
  assert.equal(acceptedQuest.ok, true, acceptedQuest.reason);

  const chronicleId = 'wc-c1-ferry-three-tides';
  const chronicleStageId = 'clear-the-wisp-bank';
  const acceptedChronicle = acceptWitnessChronicle(createWitnessChronicleState(), chronicleId, {
    campaignState: { completedBeatIds: ['c1-01-registers-omissions'] },
  });
  assert.equal(acceptedChronicle.ok, true, acceptedChronicle.reason);
  let witnessState = acceptedChronicle.state;
  for (const stageId of ['read-the-tide-post', 'hear-three-crossings']) {
    witnessState = acknowledgeCurrentStage(witnessState, chronicleId);
    const advanced = advanceWitnessChronicle(witnessState, chronicleId, stageId);
    assert.equal(advanced.ok, true, advanced.reason);
    witnessState = advanced.state;
  }
  witnessState = acknowledgeCurrentStage(witnessState, chronicleId);

  const quest = memoryAdapter(acceptedQuest.state);
  const witness = memoryAdapter(witnessState);
  const setup = coreSetup('c1-ash-wisps', { adapters: { quest, witness } });
  const settled = settleBattleVictory({
    resultRecord: resultFor('c1-ash-wisps'),
    ...setup,
    handoff: { questId, questObjectiveId, chronicleId, chronicleStageId },
    flushPlaytime: () => true,
  });

  assert.equal(settled.ok, true, settled.message);
  assert.equal(getQuestProgress(quest.state, questId).objectiveIndex, 1);
  assert.equal(getWitnessChronicleProgress(witness.state, chronicleId).stageIndex, 3);
  assert.ok(settled.messages.includes(`Side-story objective recorded: ${questObjectiveId}.`));
  assert.ok(settled.messages.includes(`Witness chronicle stage recorded: ${chronicleStageId}.`));
});

test('a pending field encounter is resolved in the victory transaction', () => {
  let fieldState = createFieldState({
    levelId: 'tkm-cedar-service-path',
    beatId: 'settlement-field',
    position: { x: 10, y: 4 },
  });
  fieldState = moveField(fieldState, 'east').state;
  const field = memoryAdapter(fieldState);
  const setup = coreSetup('fp1-cedar-path', { adapters: { field } });

  const settled = settleBattleVictory({
    resultRecord: resultFor('fp1-cedar-path'),
    ...setup,
    handoff: { fieldTriggerId: 'cedar-path-ambush' },
    flushPlaytime: () => true,
  });

  assert.equal(settled.ok, true, settled.message);
  assert.ok(field.state.contexts[0].resolvedEncounterIds.includes('fp1-cedar-path'));
  assert.ok(settled.messages.includes('Field encounter cedar-path-ambush resolved for the route.'));
});

test('failed persistence rolls earlier writes back and keeps victory unsettled', () => {
  const advancement = createAdvancementState();
  const loadout = createLoadoutState();
  const advancementAdapter = memoryAdapter(advancement);
  const loadoutAdapter = memoryAdapter(loadout, { failSaves: 1 });
  const settled = settleBattleVictory({
    resultRecord: resultFor('c1-cinder-hounds'),
    encounter: getEncounter('c1-cinder-hounds'),
    states: { advancement, loadout, runReceipt: null },
    adapters: { advancement: advancementAdapter, loadout: loadoutAdapter },
    flushPlaytime: () => true,
  });

  assert.equal(settled.ok, false);
  assert.equal(settled.code, 'transaction-failed');
  assert.match(settled.message, /loadout could not be saved/);
  assert.match(settled.message, /Earlier writes were restored/);
  assert.equal(advancementAdapter.saves.length, 2);
  assert.equal(advancementAdapter.state, advancement);
  assert.equal(loadoutAdapter.state, loadout);
});

test('playtime failure and mismatched encounter results fail before authority writes', () => {
  const setup = coreSetup('c1-cinder-hounds');
  const playtimeFailure = settleBattleVictory({
    resultRecord: resultFor('c1-cinder-hounds'),
    ...setup,
    flushPlaytime: () => false,
  });
  assert.equal(playtimeFailure.code, 'playtime-save-failed');
  assert.equal(setup.adapters.advancement.saves.length, 0);
  assert.equal(setup.adapters.loadout.saves.length, 0);

  const mismatch = settleBattleVictory({
    resultRecord: resultFor('c1-ash-wisps'),
    ...setup,
    flushPlaytime: () => true,
  });
  assert.equal(mismatch.code, 'invalid-battle-result');
  assert.match(mismatch.message, /must equal c1-cinder-hounds/);
  assert.equal(setup.adapters.advancement.saves.length, 0);
});
