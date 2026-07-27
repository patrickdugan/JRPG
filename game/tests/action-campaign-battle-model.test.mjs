import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceActionCampaignBattle,
  createActionCampaignBattleResult,
  createActionCampaignBattleSession,
  getActionCampaignComboState,
  getActionCampaignManeuverChoices,
  getCanonicalActionFighterIds,
  parseActionCampaignBattleQuery,
  snapshotActionCampaignBattle,
  switchActionCampaignActor,
} from '../action-campaign-battle-model.mjs';
import { HUNTER_PRIEST_COMBO_CONTRACT } from '../action-combos.mjs';
import { createAdvancementState } from '../advancement.mjs';
import { validateBattleResultRecord } from '../battle-result-contract.mjs';
import { createLoadoutState } from '../loadout.mjs';

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
    canonical: false,
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
  assert.equal(parseActionCampaignBattleQuery('?mode=campaign').canonical, true);
  assert.equal(parseActionCampaignBattleQuery('?canonical=1').canonical, true);
  assert.equal(parseActionCampaignBattleQuery('?mode=lab&canonical=0').canonical, false);
});

test('canonical campaign deployment keeps required opening actors before converging on the Hunter–Priest duo', () => {
  assert.deepEqual(getCanonicalActionFighterIds('prologue-ashen-bailiff'), ['ren']);
  assert.deepEqual(getCanonicalActionFighterIds('c1-cinder-hounds'), ['ren', 'aya']);
  assert.deepEqual(getCanonicalActionFighterIds('fp1-mateus'), ['lise', 'ren']);
  assert.deepEqual(getCanonicalActionFighterIds('c3-dock-patrol'), ['lise', 'mateus']);
  assert.throws(() => getCanonicalActionFighterIds('missing'), /Unknown encounter ID/u);
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

test('Action Lab can deploy one AI support and swaps direct/AI roles without resetting either fighter', () => {
  const states = coreStates();
  const session = createActionCampaignBattleSession({
    encounterId: 'prologue-ashen-bailiff',
    advancementState: states.advancement,
    loadoutState: states.loadout,
    supportActorId: 'aya',
  });
  let snapshot = snapshotActionCampaignBattle(session);
  assert.deepEqual(
    snapshot.kernel.actors.filter(({ faction }) => faction === 'player').map(({ id }) => id),
    ['ren', 'aya'],
  );
  assert.deepEqual(snapshot.duo, {
    enabled: true,
    directActorId: 'ren',
    supportActorId: 'aya',
    aiControlledActorIds: ['aya'],
  });

  snapshot = advanceActionCampaignBattle(session, 20);
  assert.equal(snapshot.recentEvents.some(({ type, actorId, action }) => (
    type === 'companion-decision' && actorId === 'aya' && ['follow', 'guard', 'move', 'attack'].includes(action)
  )), true);
  const beforeSwitch = snapshot.kernel.actors.map(({ id, hp, position }) => ({ id, hp, position }));
  assert.equal(switchActionCampaignActor(session, 1).ok, true);
  snapshot = snapshotActionCampaignBattle(session);
  assert.equal(snapshot.duo.directActorId, 'aya');
  assert.equal(snapshot.duo.supportActorId, 'ren');
  assert.deepEqual(
    snapshot.kernel.actors.map(({ id, hp, position }) => ({ id, hp, position })),
    beforeSwitch,
  );
});

test('strict duo deployment tags between character movement identities without resetting traversal state', () => {
  const states = coreStates();
  const session = createActionCampaignBattleSession({
    encounterId: 'c9-kurozane',
    advancementState: states.advancement,
    loadoutState: states.loadout,
    fighterActorIds: ['lise', 'mateus'],
  });
  let snapshot = snapshotActionCampaignBattle(session);
  assert.deepEqual(
    snapshot.kernel.actors.filter(({ faction }) => faction === 'player').map(({ id }) => id),
    ['lise', 'mateus'],
  );
  assert.equal(snapshot.duo.directActorId, 'lise');
  assert.equal(snapshot.duo.supportActorId, 'mateus');
  assert.equal(snapshot.kernel.actors.find(({ id }) => id === 'lise').movementProfileId, 'hunter');
  assert.deepEqual(getActionCampaignManeuverChoices(session).map(({ name }) => name), [
    'Hunter Step', 'Salt-Knee Slide', 'Rising Stake', 'Falling Stake',
  ]);

  advanceActionCampaignBattle(session, 20, { right: true, maneuverPressed: 'dash' });
  const beforeTag = session.kernel.getActor('lise');
  assert.equal(beforeTag.activeManeuver.id, 'dash');
  const cooldownBeforeTag = beforeTag.maneuverCooldowns.dash;
  assert.equal(switchActionCampaignActor(session, 1).ok, true);
  snapshot = advanceActionCampaignBattle(session, 20);
  const nikola = snapshot.kernel.actors.find(({ id }) => id === 'lise');
  const mateus = snapshot.kernel.actors.find(({ id }) => id === 'mateus');
  assert.equal(snapshot.duo.directActorId, 'mateus');
  assert.equal(mateus.movementProfileId, 'vampire');
  assert.deepEqual(getActionCampaignManeuverChoices(session).map(({ name }) => name), [
    'Night Passage', 'Low Shadow', 'Vesper Ascent', 'Penitent Fall',
  ]);
  assert.equal(nikola.activeManeuver.id, 'dash');
  assert.equal(nikola.maneuverCooldowns.dash, cooldownBeforeTag - 20);
  assert.equal(mateus.airDashUsesRemaining, 2);
});

test('session-local party vitals override the laboratory seed without reviving a downed partner', () => {
  const states = coreStates();
  const session = createActionCampaignBattleSession({
    encounterId: 'c1-ash-wisps',
    advancementState: states.advancement,
    loadoutState: states.loadout,
    fighterActorIds: ['lise', 'mateus'],
    partyVitals: {
      lise: { hp: 23, maxHp: 109 },
      mateus: { hp: 0, maxHp: 98 },
    },
  });
  const party = snapshotActionCampaignBattle(session).kernel.actors
    .filter(({ faction }) => faction === 'player');
  assert.deepEqual(party.map(({ id, hp, maxHp }) => ({ id, hp, maxHp })), [
    { id: 'lise', hp: 23, maxHp: 109 },
    { id: 'mateus', hp: 0, maxHp: 98 },
  ]);
  advanceActionCampaignBattle(session, 20);
  assert.equal(snapshotActionCampaignBattle(session).kernel.controlledActorId, 'lise');
});

test('Nikola AI support can use Rising Stake to join Mateus on the high cedar root', () => {
  const states = coreStates();
  const session = createActionCampaignBattleSession({
    encounterId: 'c1-ash-wisps',
    advancementState: states.advancement,
    loadoutState: states.loadout,
    fighterActorIds: ['mateus', 'lise'],
  });
  const mateus = session.kernel.getActor('mateus');
  const nikola = session.kernel.getActor('lise');
  mateus.position = { x: 740, y: 318 };
  mateus.grounded = true;
  nikola.position = { x: 740, y: 452 };
  nikola.grounded = true;
  for (const actor of session.kernel.actors.values()) {
    if (actor.faction === 'enemy') actor.ai = null;
  }

  session.kernel.advance(20);
  const events = session.kernel.drainEvents();
  assert.ok(events.some(({ type, actorId, action }) => (
    type === 'companion-decision' && actorId === 'lise' && action === 'rise-follow'
  )));
  let joined = false;
  for (let step = 0; step < 100; step += 1) {
    session.kernel.advance(20);
    if (nikola.grounded && nikola.position.y === 318) {
      joined = true;
      break;
    }
  }
  assert.equal(joined, true);
});

test('campaign adapter exposes and edge-triggers Ren\'s four infiltrator movement verbs', () => {
  const states = coreStates();
  const session = createActionCampaignBattleSession({
    encounterId: 'c1-cinder-hounds',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  assert.deepEqual(getActionCampaignManeuverChoices(session).map(({ id, name }) => ({ id, name })), [
    { id: 'dash', name: 'Roofline Rush' },
    { id: 'slide', name: 'Eaves Slide' },
    { id: 'uppercut', name: 'Gutter Hook' },
    { id: 'thunder-kick', name: 'Rafter Dive' },
  ]);
  const before = snapshotActionCampaignBattle(session).kernel.actors.find(({ id }) => id === 'ren');
  let snapshot = advanceActionCampaignBattle(session, 20, {
    right: true,
    jumpHeld: false,
    maneuverPressed: 'dash',
  });
  let ren = snapshot.kernel.actors.find(({ id }) => id === 'ren');
  assert.equal(ren.activeManeuver.id, 'dash');
  assert.equal(ren.position.x > before.position.x, true);
  assert.equal(snapshot.recentEvents.some(({ type, maneuverId }) => type === 'maneuver-start' && maneuverId === 'dash'), true);

  snapshot = advanceActionCampaignBattle(session, 20, { right: true, jumpHeld: false });
  ren = snapshot.kernel.actors.find(({ id }) => id === 'ren');
  assert.equal(ren.activeManeuver.elapsedMs, 40, 'held frames do not retrigger an edge-triggered maneuver');
});

test('invalid contextual maneuver input produces an accessible blocked event without mutation', () => {
  const states = coreStates();
  const session = createActionCampaignBattleSession({
    encounterId: 'c1-cinder-hounds',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  const actor = session.kernel.getActor('ren');
  actor.position.y -= 80;
  actor.grounded = false;
  const before = session.kernel.snapshot().actors.find(({ id }) => id === 'ren');
  const snapshot = advanceActionCampaignBattle(session, 0, { maneuverPressed: 'slide' });
  const after = snapshot.kernel.actors.find(({ id }) => id === 'ren');
  assert.equal(after.activeManeuver, null);
  assert.deepEqual(after.position, before.position);
  assert.ok(snapshot.recentEvents.some(({ type, maneuverId, reason }) => (
    type === 'maneuver-blocked' && maneuverId === 'slide' && reason === 'requires-ground'
  )));
});

test('Hunter–Priest combo is contract-locked when Nikola and Mateus are absent', () => {
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

test('laboratory victory produces an engine-neutral result without settlement', () => {
  const states = coreStates();
  const session = createActionCampaignBattleSession({
    encounterId: 'c1-cinder-hounds',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  forceEnemyDefeat(session);
  const result = createActionCampaignBattleResult(session);
  assert.equal(result.result, 'victory');
  assert.equal(result.encounterId, 'c1-cinder-hounds');
  assert.deepEqual(Object.keys(result.partyVitals), ['ren', 'aya']);
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

test('carried items plus all token, protection, countdown, and phase-object families are authoritative', () => {
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

  for (const encounterId of [
    'c3-dock-patrol',
    'c3-captain-kaji',
    'c6-masked-clerks',
    'c6-ujiro',
    'c7-bell-warden-chiyo',
    'c9-yearless-bell',
  ]) {
    const session = createActionCampaignBattleSession({ encounterId, advancementState: states.advancement, loadoutState: states.loadout });
    const snapshot = snapshotActionCampaignBattle(session);
    assert.equal(snapshot.objective.supported, true, encounterId);
    assert.notEqual(snapshot.objective.status, 'runtime-pending', encounterId);
  }

  const dock = createActionCampaignBattleSession({
    encounterId: 'c3-dock-patrol',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  const dockView = snapshotActionCampaignBattle(dock);
  assert.equal(dockView.objective.entities.tokens.every(({ destination }) => destination?.id === 'boat-exit'), true);
  for (const [index, token] of dock.objectiveEntities.tokens.entries()) {
    token.position = { x: 870 + index * 8, y: dock.stage.groundY };
  }
  advanceActionCampaignBattle(dock, 20);
  const dockEnma = [...dock.kernel.actors.values()]
    .find(({ id }) => dock.actorTemplates[id] === 'lady-enma');
  dockEnma.hp = Math.floor(dockEnma.maxHp * 0.55);
  assert.equal(advanceActionCampaignBattle(dock, 20).outcome, 'victory');

  const kaji = createActionCampaignBattleSession({
    encounterId: 'c3-captain-kaji',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  assert.equal(forceEnemyDefeat(kaji).outcome, 'victory');

  const archive = createActionCampaignBattleSession({
    encounterId: 'c6-masked-clerks',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  archive.objectiveRuntime.advance({
    kernelSnapshot: archive.kernel.snapshot(),
    events: Array.from({ length: 4 }, (_, index) => ({
      type: 'enemy-action-completed',
      sequence: 10_000 + index,
      faction: 'enemy',
    })),
  });
  archive.objectiveEntities.enemyActionCount = 4;
  advanceActionCampaignBattle(archive, 20);
  const archiveEnma = [...archive.kernel.actors.values()]
    .find(({ id }) => archive.actorTemplates[id] === 'lady-enma');
  archiveEnma.hp = Math.floor(archiveEnma.maxHp * 0.3);
  assert.equal(advanceActionCampaignBattle(archive, 20).outcome, 'victory');

  const ujiro = createActionCampaignBattleSession({
    encounterId: 'c6-ujiro',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  const disableOrders = snapshotActionCampaignBattle(ujiro).objective.requirements
    .find(({ id }) => id === 'disable-orders');
  assert.deepEqual(disableOrders.targetAnchor, {
    id: 'orders-ledger',
    x: 760,
    y: 300,
    width: 56,
    height: 82,
  });
  ujiro.kernel.getActor(ujiro.kernel.snapshot().controlledActorId).position = { x: 760, y: 300 };
  for (let index = 0; index < 12; index += 1) {
    advanceActionCampaignBattle(ujiro, 100, { interactHeld: true });
  }
  assert.equal(snapshotActionCampaignBattle(ujiro).outcome, 'victory');

  const chiyo = createActionCampaignBattleSession({
    encounterId: 'c7-bell-warden-chiyo',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  const rescuer = chiyo.kernel.getActor(chiyo.kernel.snapshot().controlledActorId);
  for (const token of chiyo.objectiveEntities.tokens) {
    rescuer.position = { ...token.position };
    advanceActionCampaignBattle(chiyo, 20, { interactPressed: true });
    assert.equal(token.released, true, token.id);
    token.position = { x: 84, y: chiyo.stage.groundY };
  }
  assert.equal(advanceActionCampaignBattle(chiyo, 20).outcome, 'victory');

  const bell = createActionCampaignBattleSession({
    encounterId: 'c9-yearless-bell',
    advancementState: states.advancement,
    loadoutState: states.loadout,
  });
  const striker = bell.kernel.getActor(bell.kernel.snapshot().controlledActorId);
  striker.position = { x: 300, y: bell.stage.groundY };
  striker.facing = 1;
  striker.grounded = true;
  for (const object of bell.objectiveEntities.objects.filter(({ attackable }) => attackable)) {
    object.position = { x: 340, y: bell.stage.groundY };
  }
  for (let index = 0; index < 20 && !bell.outcome; index += 1) {
    advanceActionCampaignBattle(bell, 20, index === 0 ? { attackIndex: 0 } : {});
  }
  assert.equal(snapshotActionCampaignBattle(bell).outcome, 'victory');
  assert.doesNotThrow(() => createActionCampaignBattleResult(bell));
});
