import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OPENING_ACTION_ENCOUNTER_IDS,
  getActionBattleCoaching,
  isOpeningActionEncounter,
} from '../action-battle-coaching.mjs';

test('opening encounters publish concise controls and encounter-specific counterplay', () => {
  const bailiff = getActionBattleCoaching('prologue-ashen-bailiff');
  assert.match(bailiff.title, /Survive/u);
  assert.match(bailiff.summary, /three completed attacks/u);
  assert.equal(bailiff.steps.length, 3);

  const hound = getActionBattleCoaching('c1-tithe-hound');
  assert.match(hound.summary, /exposes the Hound’s seal/u);
  assert.match(hound.summary, /Aya heals from reserve/u);
  assert.equal(Object.isFrozen(hound), true);
  assert.equal(Object.isFrozen(hound.steps), true);
});

test('coaching names the interrupt read where the encounter teaches it', () => {
  assert.match(getActionBattleCoaching('c1-ash-wisps').steps[0], /charge glows: an art breaks the charge/u);
  assert.match(getActionBattleCoaching('c1-tithe-hound').steps[0], /break its long wind-up/u);
  assert.match(getActionBattleCoaching('c3-captain-kaji').steps.join(' '), /poise pips/u);
});

test('Mateus coaching follows the visible phase and ward state', () => {
  const first = getActionBattleCoaching('fp1-mateus', {
    bossPhase: { phaseId: 'phase-1' },
    kernel: { actors: [] },
  });
  assert.match(first.title, /Force the ward phase/u);
  assert.match(first.summary, /roughly half health/u);

  const ward = getActionBattleCoaching('fp1-mateus', {
    bossPhase: { phaseId: 'phase-2' },
    kernel: {
      actors: [{
        id: 'blood-ward-west-1',
        faction: 'enemy',
        hp: 96,
      }],
    },
  });
  assert.match(ward.title, /Break the Blood Wards/u);
  assert.match(ward.steps.join(' '), /Crimson Litany/u);

  const surrender = getActionBattleCoaching('fp1-mateus', {
    outcome: 'victory',
    bossPhase: { phaseId: 'phase-2' },
    kernel: { actors: [] },
  });
  assert.match(surrender.title, /yields alive/u);
});

test('the first-clear ready gate covers exactly the seven opening action encounters', () => {
  assert.deepEqual(OPENING_ACTION_ENCOUNTER_IDS, [
    'prologue-ashen-bailiff',
    'c1-cinder-hounds',
    'c1-ash-wisps',
    'c1-tithe-hound',
    'fp1-cedar-path',
    'fp1-flooded-archive',
    'fp1-mateus',
  ]);
  assert.equal(OPENING_ACTION_ENCOUNTER_IDS.every(isOpeningActionEncounter), true);
  assert.equal(isOpeningActionEncounter('c3-dock-patrol'), false);
  assert.equal(Object.isFrozen(OPENING_ACTION_ENCOUNTER_IDS), true);
});


test('seven HD painted boss encounters and Kurozane teach authored counterplay', () => {
  const reads = new Map([
    ['c3-captain-kaji', /Chain Haul|hook path/u],
    ['c4-widow-of-fog', /High Tide|Low Tide/u],
    ['c5-furnace-abbot', /Overheated/u],
    ['c6-ujiro', /Seizure Order/u],
    ['c7-bell-warden-chiyo', /fourth bell count/u],
    ['c8-lady-enma', /Paired Ashes/u],
    ['c9-yearless-bell', /four bell nodes|four nodes/u],
    ['c9-kurozane', /Umbral heals Kurozane/u],
  ]);
  for (const [id, expectedRead] of reads) {
    const coaching = getActionBattleCoaching(id);
    assert.equal(coaching.encounterId, id);
    assert.notEqual(coaching.title, 'Fight, read, recover');
    assert.equal(coaching.steps.length, 3);
    assert.match([coaching.title, coaching.summary, ...coaching.steps].join(' '), expectedRead);
    assert.equal(Object.isFrozen(coaching), true);
    assert.equal(Object.isFrozen(coaching.steps), true);
  }
});

test('late-fight coaching follows only the presented phase and outcome', () => {
  const furnace = getActionBattleCoaching('c5-furnace-abbot', {
    bossPhase: { phaseId: 'sigil-break' },
  });
  assert.match(furnace.summary, /Mateus breaks his court sigil/u);

  const enmaWing = getActionBattleCoaching('c8-lady-enma', {
    bossPhase: { phaseId: 'cinder-wing' },
  });
  assert.match(enmaWing.steps.join(' '), /Cinder Parasol Wing/u);
  const enmaYield = getActionBattleCoaching('c8-lady-enma', {
    bossPhase: { phaseId: 'subdued-for-terms' },
  });
  assert.match(enmaYield.summary, /custody/u);
  assert.match(getActionBattleCoaching('c8-lady-enma', {
    outcome: 'victory',
  }).title, /subdued/u);

  const court = getActionBattleCoaching('c9-kurozane', {
    bossPhase: { phaseId: 'court' },
  });
  const bell = getActionBattleCoaching('c9-kurozane', {
    bossPhase: { phaseId: 'bell' },
  });
  const dawn = getActionBattleCoaching('c9-kurozane', {
    bossPhase: { phaseId: 'dawn' },
  });
  const cleared = getActionBattleCoaching('c9-kurozane', { outcome: 'victory' });
  assert.match(court.title, /court command/u);
  assert.match(bell.title, /bell-phase/u);
  assert.match(dawn.title, /dawn recovery/u);
  assert.match(cleared.title, /Evacuate/u);
  assert.notEqual(bell.summary, dawn.summary);
  assert.match(getActionBattleCoaching('unknown').summary, /Move freely/u);
});
