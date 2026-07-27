import assert from 'node:assert/strict';
import test from 'node:test';

import { getActionBattleCoaching } from '../action-battle-coaching.mjs';

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
