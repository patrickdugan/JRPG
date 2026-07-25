import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceActionCampaignBattle,
  createActionCampaignBattleResult,
  createActionCampaignBattleSession,
  snapshotActionCampaignBattle,
} from '../action-campaign-battle-model.mjs';
import { createAdvancementState } from '../advancement.mjs';
import { createLoadoutState } from '../loadout.mjs';
import {
  acknowledgeActionSliceConsequence,
  beginActionSliceRun,
  createActionSliceRun,
  getActionSliceExpectedEncounter,
  recordActionSliceBattleReceipt,
  useActionSliceSanctuary,
} from '../action-slice-model.mjs';

function winCurrentBattle(run, damageByActorId = {}) {
  const encounterId = getActionSliceExpectedEncounter(run)?.encounterId;
  assert.ok(encounterId, `phase ${run.phase} must expose one battle`);
  const session = createActionCampaignBattleSession({
    encounterId,
    advancementState: createAdvancementState(),
    loadoutState: createLoadoutState(),
    fighterActorIds: run.fighters,
    partyVitals: run.vitals,
  });
  const startingParty = snapshotActionCampaignBattle(session).kernel.actors
    .filter(({ faction }) => faction === 'player');
  assert.deepEqual(
    Object.fromEntries(startingParty.map(({ id, hp, maxHp }) => [id, { hp, maxHp }])),
    run.vitals,
    'each battle must start from the slice checkpoint rather than the canonical save',
  );
  for (const actor of session.kernel.actors.values()) {
    if (actor.faction === 'enemy') actor.hp = 0;
    else actor.hp = Math.max(1, actor.hp - (damageByActorId[actor.id] ?? 0));
  }
  const terminal = advanceActionCampaignBattle(session, 20);
  assert.equal(terminal.outcome, 'victory');
  return recordActionSliceBattleReceipt(run, createActionCampaignBattleResult(session));
}

test('selected duo, attrition, Aya sanctuary, boss receipt, and consequence form one isolated slice', () => {
  let run = beginActionSliceRun(createActionSliceRun());
  run = winCurrentBattle(run, { lise: 9, mateus: 4 });
  assert.equal(run.phase, 'platform-encounter');
  assert.deepEqual(run.vitals, {
    lise: { hp: 82, maxHp: 109 },
    mateus: { hp: 94, maxHp: 98 },
  });

  run = winCurrentBattle(run, { lise: 12, mateus: 7 });
  assert.equal(run.phase, 'aya-sanctuary');
  assert.deepEqual(run.vitals, {
    lise: { hp: 70, maxHp: 109 },
    mateus: { hp: 87, maxHp: 98 },
  });

  run = useActionSliceSanctuary(run);
  assert.deepEqual(run.vitals, {
    lise: { hp: 109, maxHp: 109 },
    mateus: { hp: 98, maxHp: 98 },
  });

  run = winCurrentBattle(run, { lise: 31, mateus: 18 });
  assert.equal(run.phase, 'consequence');
  assert.equal(run.battleReceipts.length, 3);
  assert.deepEqual(run.vitals, {
    lise: { hp: 78, maxHp: 109 },
    mateus: { hp: 80, maxHp: 98 },
  });

  run = acknowledgeActionSliceConsequence(run);
  assert.equal(run.phase, 'complete');
  assert.equal(run.canonical, false);
});
