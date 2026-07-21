import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceActionCampaignBattle,
  createActionCampaignBattleResult,
  createActionCampaignBattleSession,
  getActionCampaignComboState,
  parseActionCampaignBattleQuery,
  settleActionCampaignBattleVictory,
  snapshotActionCampaignBattle,
} from '../action-campaign-battle-model.mjs';
import { HUNTER_PRIEST_COMBO_CONTRACT } from '../action-combos.mjs';
import { createAdvancementState, getEncounterWinCount } from '../advancement.mjs';
import { validateBattleResultRecord } from '../battle-result-contract.mjs';
import { createLoadoutState } from '../loadout.mjs';
import { createCampaignState } from '../progression.mjs';
import { createRunReceipt } from '../run-receipt.mjs';

function memoryAdapter(initialState) {
  let state = initialState;
  return {
    load() { return { ok: true, found: true, state }; },
    save(nextState) { state = nextState; return { ok: true }; },
    get state() { return state; },
  };
}

function coreStates() {
  return { advancement: createAdvancementState(), loadout: createLoadoutState() };
}

function forceEnemyDefeat(session) {
  for (const actor of session.kernel.actors.values()) if (actor.faction === 'enemy') actor.hp = 0;
  return advanceActionCampaignBattle(session, 20);
}

test('query parser preserves canonical battle handoffs and rejects unsafe returns', () => {
  assert.deepEqual(parseActionCampaignBattleQuery(
    '?encounter=c1-cinder-hounds&return=campaign.html%3Fbeat%3Dc1&quest=sq-a&objective=find-a&fieldTrigger=cedar&chronicle=wc-a&chronicleStage=clear&chronicleChoice=mercy',
  ), {
    requestedEncounterId: 'c1-cinder-hounds',
    encounterId: 'c1-cinder-hounds',
    returnTarget: 'campaign.html?beat=c1',
    handoff: {
      questId: 'sq-a',
      questObjectiveId: 'find-a',
      fieldTriggerId: 'cedar',
      chronicleId: 'wc-a',
      chronicleStageId: 'clear',
      chronicleChoiceId: 'mercy',
    },
  });
  assert.equal(parseActionCampaignBattleQuery('?encounter=missing&return=https://evil.invalid').encounterId, 'prologue-ashen-bailiff');
  assert.equal(parseActionCampaignBattleQuery('?return=javascript:alert(1)').returnTarget, 'campaign.html');
  assert.equal(parseActionCampaignBattleQuery('?return=%2F%2Fevil.invalid').returnTarget, 'campaign.html');
});

test('session composes the real encounter, authored action stage, loadout vitals, party control, and objective runtime', () => {
  const states = coreStates();
  const session = createActionCampaignBattleSession({
    encounterId: 'c1-cinder-hounds',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  const snapshot = snapshotActionCampaignBattle(session);
  assert.equal(session.encounter.id, 'c1-cinder-hounds');
  assert.equal(session.stage.id, 'c1-flooded-cedars');
  assert.deepEqual(snapshot.kernel.stage, {
    minX: session.stage.bounds.minX,
    maxX: session.stage.bounds.maxX,
    minY: session.stage.bounds.minY,
    maxY: session.stage.bounds.maxY,
    groundY: session.stage.groundY,
  });
  assert.equal(snapshot.kernel.automaticVictory, false);
  assert.equal(snapshot.kernel.controlledActorId, 'ren');
  assert.equal(snapshot.objective.supported, true);
  assert.equal(snapshot.objective.status, 'pending');
  assert.deepEqual(snapshot.objective.requirements.map(({ id }) => id), ['defeat-all']);
  const ren = snapshot.kernel.actors.find(({ id }) => id === 'ren');
  assert.equal(ren.position.x, session.stage.spawns.party[0].x);
  assert.equal(ren.maxHp > 104, true, 'shipped loadout HP modifier is applied over advancement HP');
});

test('Hunter–Priest combo is contract-locked when Lise and Mateus are absent', () => {
  const states = coreStates();
  const session = createActionCampaignBattleSession({
    encounterId: 'c1-cinder-hounds',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  const combo = getActionCampaignComboState(session);
  assert.equal(combo.comboId, HUNTER_PRIEST_COMBO_CONTRACT.id);
  assert.equal(combo.available, false);
  assert.equal(combo.active, false);
  assert.deepEqual(combo.participants.map(({ attackName }) => attackName), ['Dawn Bolt', 'Penitent Night']);
  assert.ok(combo.reasons.some(({ code, actorId }) => code === 'participant-missing' && actorId === 'lise'));
  assert.ok(combo.reasons.some(({ code, actorId }) => code === 'participant-missing' && actorId === 'mateus'));

  const snapshot = advanceActionCampaignBattle(session, 0, { comboPressed: true });
  assert.equal(snapshot.recentEvents.some(({ type }) => type === 'combo-start'), false);
  assert.equal(snapshot.recentEvents.some(({ type }) => type === 'combo-blocked'), true);
  assert.equal(snapshot.kernel.actors.every(({ activeAttack }) => activeAttack == null), true);
});

test('Hunter and Priest start atomically and retain both contributing-art cooldowns', () => {
  const states = coreStates();
  const session = createActionCampaignBattleSession({
    encounterId: 'c4-widow-of-fog',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  assert.equal(session.kernel.switchControlledActor('lise').ok, true);
  const ready = getActionCampaignComboState(session);
  assert.equal(ready.available, true, JSON.stringify(ready.reasons));
  assert.equal(ready.separationPx <= ready.maxAllySeparationPx, true);

  let snapshot = advanceActionCampaignBattle(session, 0, { comboPressed: true });
  const comboEvents = snapshot.recentEvents.filter(({ comboId }) => comboId === ready.comboId);
  assert.equal(comboEvents.filter(({ type }) => type === 'combo-start').length, 1);
  assert.equal(comboEvents.filter(({ type }) => type === 'attack-start').length, 2);
  assert.equal(new Set(comboEvents.map(({ nowMs }) => nowMs)).size, 1, 'atomic start shares one kernel timestamp');
  for (const participant of ready.participants) {
    const actor = snapshot.kernel.actors.find(({ id }) => id === participant.actorId);
    assert.equal(actor.activeAttack.attackId, participant.attackId);
    assert.equal(actor.activeAttack.comboId, ready.comboId);
    assert.equal(actor.attackCooldowns[participant.attackId], 0, 'cooldown begins after animation, not at combo request');
  }

  const completed = [];
  for (let step = 0; step < 60; step += 1) {
    snapshot = advanceActionCampaignBattle(session, 20);
    completed.push(...snapshot.recentEvents.filter(({ type, comboId }) => type === 'attack-complete' && comboId === ready.comboId));
    if (ready.participants.every(({ actorId }) => session.kernel.getActor(actorId).activeAttack == null)) break;
  }
  assert.deepEqual(completed.map(({ actorId }) => actorId).sort(), ['lise', 'mateus']);
  for (const participant of ready.participants) {
    const actor = session.kernel.getActor(participant.actorId);
    assert.equal(actor.attackCooldowns[participant.attackId] > 0, true);
    assert.equal(actor.offensiveCooldownRemainingMs > 0, true);
  }
  assert.equal(session.kernel.getActor('lise').attackCooldowns['party:lise:hunter-thrust'], 0,
    'the combo preserves separate cooldown ownership and does not reset unrelated arts');
});

test('objective-authoritative terminal projection passes battle-result-contract', () => {
  const states = coreStates();
  const session = createActionCampaignBattleSession({
    encounterId: 'c1-cinder-hounds',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  const terminal = forceEnemyDefeat(session);
  assert.equal(terminal.objective.complete, true);
  assert.equal(terminal.combatSatisfied, true);
  assert.equal(terminal.outcome, 'victory');
  assert.equal(terminal.kernel.outcome, 'victory');
  const record = createActionCampaignBattleResult(session);
  const validation = validateBattleResultRecord(record, { expectedEncounterId: 'c1-cinder-hounds' });
  assert.equal(validation.ok, true, validation.errors.join(' '));
  assert.deepEqual(Object.keys(record.partyVitals), ['ren', 'aya']);
});

test('one real first-clear settles in memory without touching a persistent user profile', () => {
  const states = coreStates();
  const receipt = createRunReceipt({
    runId: 'action-first-clear-0001',
    campaignState: createCampaignState(),
    advancementState: states.advancement,
  });
  assert.equal(receipt.ok, true, receipt.errors?.join(' '));
  const session = createActionCampaignBattleSession({
    encounterId: 'c1-cinder-hounds',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  forceEnemyDefeat(session);
  const adapters = {
    advancement: memoryAdapter(states.advancement),
    loadout: memoryAdapter(states.loadout),
    runReceipt: memoryAdapter(receipt.state),
  };
  const settled = settleActionCampaignBattleVictory({
    session,
    states: { ...states, runReceipt: receipt.state },
    adapters,
    flushPlaytime: () => ({ ok: true, state: receipt.state }),
  });
  assert.equal(settled.ok, true, settled.message);
  assert.equal(getEncounterWinCount(settled.states.advancement, session.encounter.id), 1);
  assert.deepEqual(settled.states.runReceipt.firstClearEncounterIds, ['c1-cinder-hounds']);
  assert.equal(adapters.advancement.state, settled.states.advancement);
  assert.equal(adapters.loadout.state, settled.states.loadout);
  assert.equal(adapters.runReceipt.state, settled.states.runReceipt);
});

test('post-boss objectives stay live until the required interaction or evacuation overlap', () => {
  const states = coreStates();
  const enma = createActionCampaignBattleSession({
    encounterId: 'c8-lady-enma',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  let snapshot = forceEnemyDefeat(enma);
  assert.equal(snapshot.kernel.outcome, null, 'automatic combat victory must not trap the release step');
  assert.equal(snapshot.objective.requirements.find(({ id }) => id === 'defeat-boss').complete, true);
  assert.equal(snapshot.objective.complete, false);
  assert.equal(snapshot.outcome, null);
  const release = enma.stage.objectiveAnchors.find(({ id }) => id === 'garrison-release');
  const actor = enma.kernel.getActor(enma.kernel.snapshot().controlledActorId);
  actor.position = { x: release.x, y: release.y };
  snapshot = advanceActionCampaignBattle(enma, 20, { interactPressed: true, interactHeld: true });
  assert.equal(snapshot.objective.complete, true);
  assert.equal(snapshot.outcome, 'victory');

  const kurozane = createActionCampaignBattleSession({
    encounterId: 'c9-kurozane',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  snapshot = forceEnemyDefeat(kurozane);
  assert.equal(snapshot.kernel.outcome, null, 'evacuation remains playable after the boss is down');
  const exit = kurozane.stage.objectiveAnchors.find(({ id }) => id === 'evacuation-exit');
  kurozane.kernel.getActor(kurozane.kernel.snapshot().controlledActorId).position = { x: exit.x, y: exit.y };
  snapshot = advanceActionCampaignBattle(kurozane, 20);
  assert.equal(snapshot.objective.complete, true);
  assert.equal(snapshot.outcome, 'victory');
});

test('carried-item overlap is connected while token and destructible-scenery families fail closed', () => {
  const states = coreStates();
  const returnItem = createActionCampaignBattleSession({
    encounterId: 'c7-name-slip-release',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  assert.equal(snapshotActionCampaignBattle(returnItem).objective.supported, true);
  const water = returnItem.stage.objectiveAnchors.find(({ kind }) => kind === 'item-return');
  returnItem.kernel.getActor(returnItem.kernel.snapshot().controlledActorId).position = { x: water.x, y: water.y };
  assert.equal(advanceActionCampaignBattle(returnItem, 20).outcome, 'victory');

  for (const encounterId of ['c3-dock-patrol', 'c6-masked-clerks', 'c9-yearless-bell']) {
    const session = createActionCampaignBattleSession({ encounterId, advancementState: states.advancement, loadoutState: states.loadout });
    const snapshot = snapshotActionCampaignBattle(session);
    assert.equal(snapshot.objective.supported, false, encounterId);
    assert.equal(snapshot.objective.status, 'runtime-pending', encounterId);
    assert.throws(() => createActionCampaignBattleResult(session), /objective completion/u);
  }
});
