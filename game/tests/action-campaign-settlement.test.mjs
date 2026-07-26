import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceActionCampaignBattle,
  createActionCampaignBattleResult,
  createActionCampaignBattleSession,
} from '../action-campaign-battle-model.mjs';
import {
  createAdvancementState,
  getEncounterWinCount,
  preparePartyForEncounter,
} from '../advancement.mjs';
import { settleBattleVictory } from '../battle-settlement.mjs';
import { getEncounter } from '../content/encounters.mjs';
import { createLoadoutState } from '../loadout.mjs';
import { createCampaignState } from '../progression.mjs';
import { createRunReceipt, recordRunPlaytime } from '../run-receipt.mjs';

function memoryAdapter(initialState) {
  let state = initialState;
  return {
    load: () => ({ ok: true, found: true, state }),
    save(nextState) {
      state = nextState;
      return { ok: true };
    },
    get state() { return state; },
  };
}

test('an action victory atomically becomes campaign rewards, vitals, and clean-run evidence', () => {
  const encounterId = 'c1-cinder-hounds';
  const encounter = getEncounter(encounterId);
  const newGameAdvancement = createAdvancementState();
  const advancement = preparePartyForEncounter(newGameAdvancement, encounterId);
  const loadout = createLoadoutState();
  const createdReceipt = createRunReceipt({
    runId: 'action-canonical-settlement-0001',
    campaignState: createCampaignState(),
    advancementState: newGameAdvancement,
  });
  assert.equal(createdReceipt.ok, true, createdReceipt.errors?.join(' '));
  let runReceipt = createdReceipt.state;
  const runtime = createActionCampaignBattleSession({
    encounterId,
    advancementState: advancement,
    loadoutState: loadout,
    fighterActorIds: ['lise', 'mateus'],
  });
  for (const actor of runtime.kernel.actors.values()) {
    if (actor.faction === 'enemy') actor.hp = 0;
  }
  const terminal = advanceActionCampaignBattle(runtime, 20);
  assert.equal(terminal.outcome, 'victory');
  const resultRecord = createActionCampaignBattleResult(runtime);

  const adapters = {
    advancement: memoryAdapter(advancement),
    loadout: memoryAdapter(loadout),
    runReceipt: memoryAdapter(runReceipt),
  };
  const settled = settleBattleVictory({
    resultRecord,
    encounter,
    states: { advancement, loadout, runReceipt },
    adapters,
    flushPlaytime: () => {
      const recorded = recordRunPlaytime(
        runReceipt,
        runReceipt.runId,
        'firstClearCombat',
        1_200,
        { chapterId: encounter.chapterId },
      );
      assert.equal(recorded.ok, true);
      runReceipt = recorded.state;
      adapters.runReceipt.save(runReceipt);
      return { ok: true, state: runReceipt };
    },
  });

  assert.equal(settled.ok, true, settled.message);
  assert.equal(getEncounterWinCount(settled.states.advancement, encounterId), 1);
  assert.deepEqual(settled.states.runReceipt.firstClearEncounterIds, [encounterId]);
  assert.equal(settled.states.runReceipt.playtime.categories.firstClearCombat, 1_200);
  assert.deepEqual(
    Object.keys(resultRecord.partyVitals),
    ['lise', 'mateus'],
    'only the deployed surviving duo enters the canonical vitals settlement',
  );
  assert.equal(settled.states.loadout.vitals.lise.hp, resultRecord.partyVitals.lise.hp);
  assert.equal(settled.states.loadout.vitals.mateus.hp, resultRecord.partyVitals.mateus.hp);
});
