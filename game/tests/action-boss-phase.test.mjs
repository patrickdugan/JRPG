import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceActionCampaignBattle,
  createActionCampaignBattleSession,
  snapshotActionCampaignBattle,
} from '../action-campaign-battle-model.mjs';
import { createAdvancementState } from '../advancement.mjs';
import { createLoadoutState } from '../loadout.mjs';

function session(encounterId) {
  return createActionCampaignBattleSession({
    encounterId,
    advancementState: createAdvancementState(),
    loadoutState: createLoadoutState(),
  });
}

function boss(runtime) {
  return runtime.kernel.getActor(runtime.bossPhaseDirector.bossActorId);
}

test('HP-authored action boss phases enter once and expose immutable browser-ready state', () => {
  const runtime = session('c1-tithe-hound');
  let snapshot = snapshotActionCampaignBattle(runtime);
  assert.equal(snapshot.bossPhase.phaseId, 'hunger');
  assert.deepEqual(snapshot.bossPhase.history, ['hunger']);

  const target = boss(runtime);
  target.hp = Math.floor(target.maxHp * 0.5);
  snapshot = advanceActionCampaignBattle(runtime, 20);
  assert.equal(snapshot.bossPhase.phaseId, 'frantic');
  assert.equal(snapshot.bossPhase.revision, 1);
  assert.deepEqual(snapshot.bossPhase.history, ['hunger', 'frantic']);
  assert.equal(snapshot.recentEvents.some(({ type, toPhaseId }) => (
    type === 'boss-phase-entered' && toPhaseId === 'frantic'
  )), true);

  snapshot = advanceActionCampaignBattle(runtime, 20);
  assert.equal(snapshot.bossPhase.revision, 1);
  assert.deepEqual(snapshot.bossPhase.history, ['hunger', 'frantic']);
  assert.equal(Object.isFrozen(snapshot.bossPhase), true);
});

test('Mateus phase move lists gate Litany, open the ward phase, then halt hostile arts at surrender', () => {
  const runtime = session('fp1-mateus');
  const mateus = boss(runtime);
  assert.equal(snapshotActionCampaignBattle(runtime).bossPhase.phaseId, 'phase-1');
  assert.equal(mateus.attackIds.includes('enemy:mateus:crimson-litany'), false);
  assert.equal(mateus.attackIds.includes('enemy:mateus:pale-cut'), true);

  mateus.hp = Math.floor(mateus.maxHp * 0.55);
  let snapshot = advanceActionCampaignBattle(runtime, 20);
  assert.equal(snapshot.bossPhase.phaseId, 'phase-2');
  assert.deepEqual(
    mateus.attackIds,
    ['enemy:mateus:blood-ward', 'enemy:mateus:crimson-litany'],
  );

  mateus.hp = Math.floor(mateus.maxHp * 0.2);
  snapshot = advanceActionCampaignBattle(runtime, 20);
  assert.equal(snapshot.bossPhase.phaseId, 'phase-3');
  assert.deepEqual(mateus.attackIds, []);
});
