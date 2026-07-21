import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMPAIGN_COMBAT_PHASES, createCampaignCombat } from '../campaign-combat.mjs';
import { getNewBossPhaseTransition, mergeBossTransitionPresentationRecord } from '../boss-combat-atlas.mjs';
import { ENCOUNTERS, getEncounter, validateEncounter } from '../content/encounters.mjs';

const PHASED_ENCOUNTERS = Object.freeze({
  'c1-tithe-hound': ['hunger', 'frantic'],
  'fp1-mateus': ['phase-1', 'phase-2', 'phase-3'],
  'c3-dock-patrol': ['closed-fan', 'first-mask-broken'],
  'c4-widow-of-fog': ['high-tide', 'low-tide'],
  'c5-furnace-abbot': ['forge', 'sigil-break'],
  'c6-masked-clerks': ['mirrored-seizure', 'second-mask-broken'],
  'c8-lady-enma': ['paired-last-mask', 'cinder-wing', 'subdued-for-terms'],
  'c9-kurozane': ['court', 'bell', 'dawn'],
});

const clone = (value) => JSON.parse(JSON.stringify(value));

function setBossRatio(engine, ratio) {
  const phase = engine.getBossPhaseStatus();
  const boss = engine.getActor(phase.bossId);
  boss.hp = Math.max(1, Math.floor(boss.maxHp * ratio));
  return engine._updateBossPhase('damage');
}

function activateMateusWards(engine) {
  for (const id of ['blood-ward-west-1', 'blood-ward-east-1']) {
    const ward = engine.getActor(id);
    ward.active = true;
    ward.hp = ward.maxHp;
  }
}

function advanceToPlayer(engine) {
  let snapshot = engine.snapshot();
  while (!snapshot.result && snapshot.phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND) {
    assert.equal(engine.resolveEnemyActivation().ok, true);
    snapshot = engine.snapshot();
  }
  return snapshot;
}

function breakBothMateusWards(engine) {
  for (const targetId of ['blood-ward-west', 'blood-ward-east']) {
    const before = advanceToPlayer(engine);
    const result = engine.performObjectiveAction(before.activeActorId, { type: 'breakObject', targetId });
    assert.equal(result.ok, true);
  }
  return engine.snapshot();
}

function forceWidowActivation(engine) {
  engine.phase = CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND;
  engine.activeActorId = 'widow-of-fog-1';
  const result = engine.resolveEnemyActivation();
  assert.equal(result.ok, true);
  return engine.snapshot();
}

test('all eight typed phase contracts validate with one explicit phase-zero initial state', () => {
  assert.deepEqual(ENCOUNTERS.flatMap((encounter) => (
    encounter.bossMechanic?.phases ? [encounter.id] : []
  )), Object.keys(PHASED_ENCOUNTERS));
  for (const [encounterId, phaseIds] of Object.entries(PHASED_ENCOUNTERS)) {
    const encounter = getEncounter(encounterId);
    assert.deepEqual(encounter.bossMechanic.phases.map(({ id }) => id), phaseIds);
    assert.equal(encounter.bossMechanic.phases[0].initial, true);
    assert.equal(encounter.bossMechanic.phases.slice(1).some(({ initial }) => initial === true), false);
    assert.deepEqual(validateEncounter(encounter), []);
  }

  const missingInitial = clone(getEncounter('c1-tithe-hound'));
  delete missingInitial.bossMechanic.phases[0].initial;
  assert.match(validateEncounter(missingInitial).join(' '), /phase zero.*initial/);

  const unknownEntry = clone(getEncounter('c5-furnace-abbot'));
  unknownEntry.bossMechanic.phases[1].enter.kind = 'prose-threshold';
  assert.match(validateEncounter(unknownEntry).join(' '), /unknown enter kind/);

  const invalidCadence = clone(getEncounter('c4-widow-of-fog'));
  invalidCadence.bossMechanic.phaseCycle.warningActivations = 2;
  assert.match(validateEncounter(invalidCadence).join(' '), /warning must precede/);
});

test('phase state is additive, immutable in snapshots, and absent from unphased encounters', () => {
  for (const [encounterId, phaseIds] of Object.entries(PHASED_ENCOUNTERS)) {
    const engine = createCampaignCombat(encounterId);
    const snapshot = engine.snapshot();
    assert.equal(snapshot.bossPhase.phaseId, phaseIds[0]);
    assert.equal(snapshot.bossPhase.ordinal, 0);
    assert.equal(snapshot.bossPhase.revision, 0);
    assert.deepEqual(snapshot.bossPhase.history, [phaseIds[0]]);
    assert.equal(Object.isFrozen(snapshot.bossPhase), true);
    assert.equal(Object.isFrozen(snapshot.bossPhase.history), true);
    assert.deepEqual(JSON.parse(engine.serialize()).bossPhase, snapshot.bossPhase);
  }
  assert.equal(Object.hasOwn(createCampaignCombat('c3-captain-kaji').snapshot(), 'bossPhase'), false);
});

test('HP phase thresholds enter once at the exact authored ratios and log deterministic transitions', () => {
  const cases = [
    ['c1-tithe-hound', 0.5, 'hunger', 'frantic'],
    ['c5-furnace-abbot', 0.5, 'forge', 'sigil-break'],
    ['c9-kurozane', 0.66, 'court', 'bell'],
  ];
  for (const [encounterId, threshold, initialId, nextId] of cases) {
    const engine = createCampaignCombat(encounterId);
    const boss = engine.getActor(engine.getBossPhaseStatus().bossId);
    boss.hp = Math.floor(boss.maxHp * threshold) + 1;
    assert.deepEqual(engine._updateBossPhase('damage'), []);
    const before = engine.snapshot();
    const transitions = setBossRatio(engine, threshold);
    const after = engine.snapshot();
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].fromPhaseId, initialId);
    assert.equal(transitions[0].toPhaseId, nextId);
    assert.equal(engine.getBossPhaseStatus().revision, 1);
    assert.deepEqual(engine.log.filter(({ type }) => type === 'boss-phase-entered').map(({ toPhaseId }) => toPhaseId), [nextId]);
    assert.equal(getNewBossPhaseTransition(before, after).toPhaseId, nextId);
    const presentation = mergeBossTransitionPresentationRecord(null, before, after, { startedAt: 4_000, speed: 1 });
    assert.equal(presentation.bossTransition.toPhaseId, nextId);
    assert.equal(presentation.timeline.durationMs, 0);
    assert.deepEqual(engine._updateBossPhase('damage'), [], 'the same threshold cannot re-enter a phase');
  }

  const kurozane = createCampaignCombat('c9-kurozane');
  setBossRatio(kurozane, 0.65);
  setBossRatio(kurozane, 0.33);
  assert.deepEqual(kurozane.getBossPhaseStatus().history, ['court', 'bell', 'dawn']);
  assert.equal(kurozane.getBossPhaseStatus().revision, 2);
});

test('Mateus phase three requires phase-two history while surrender and victory remain unchanged', () => {
  const earlyWards = createCampaignCombat('fp1-mateus');
  activateMateusWards(earlyWards);
  const earlyResult = breakBothMateusWards(earlyWards);
  assert.equal(earlyResult.result, 'victory', 'existing both-wards surrender remains authoritative');
  assert.equal(earlyResult.actors.find(({ instanceId }) => instanceId === 'mateus-1').active, false);
  assert.equal(earlyResult.bossPhase.phaseId, 'phase-1', 'presentation phase cannot skip required history');

  const phasedWards = createCampaignCombat('fp1-mateus');
  setBossRatio(phasedWards, 0.55);
  assert.equal(phasedWards.getBossPhaseStatus().phaseId, 'phase-2');
  activateMateusWards(phasedWards);
  const phasedResult = breakBothMateusWards(phasedWards);
  assert.equal(phasedResult.result, 'victory');
  assert.equal(phasedResult.bossPhase.phaseId, 'phase-3');
  assert.deepEqual(phasedResult.bossPhase.history, ['phase-1', 'phase-2', 'phase-3']);

  const hpRoute = createCampaignCombat('fp1-mateus');
  const chained = setBossRatio(hpRoute, 0.2);
  assert.deepEqual(chained.map(({ toPhaseId }) => toPhaseId), ['phase-2', 'phase-3']);
  assert.equal(hpRoute.result, null, 'phase observation does not resolve combat by itself');
});

test('Widow warns after one completed activation and alternates every second completed activation', () => {
  const engine = createCampaignCombat('c4-widow-of-fog');
  const states = Array.from({ length: 4 }, () => forceWidowActivation(engine).bossPhase);
  assert.deepEqual(states.map(({ phaseId }) => phaseId), ['high-tide', 'low-tide', 'low-tide', 'high-tide']);
  assert.deepEqual(states.map(({ completedBossActivations }) => completedBossActivations), [1, 2, 3, 4]);
  assert.deepEqual(states.map(({ warning }) => warning?.toPhaseId ?? null), ['low-tide', null, 'high-tide', null]);
  assert.deepEqual(states.map(({ revision }) => revision), [0, 1, 1, 2]);
  assert.deepEqual(engine.log.filter(({ type }) => type === 'boss-phase-warning').map(({ toPhaseId }) => toPhaseId), ['low-tide', 'high-tide']);
  assert.deepEqual(engine.log.filter(({ type }) => type === 'boss-phase-entered').map(({ toPhaseId }) => toPhaseId), ['low-tide', 'high-tide']);
});
