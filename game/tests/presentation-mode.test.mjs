import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRESENTATION_MODES,
  applyPresentationMode,
  getPresentationMode,
} from '../presentation-mode.mjs';

test('player presentation is the default and developer presentation is explicit', () => {
  assert.equal(getPresentationMode(''), PRESENTATION_MODES.PLAYER);
  assert.equal(getPresentationMode('?chapter=prologue'), PRESENTATION_MODES.PLAYER);
  assert.equal(getPresentationMode('?dev=1'), PRESENTATION_MODES.DEVELOPER);
  assert.equal(getPresentationMode('?dev=true'), PRESENTATION_MODES.PLAYER);
});

test('applying presentation mode hides developer-only surfaces in player mode', () => {
  const developerOnly = [{ hidden: false }, { hidden: false }];
  const documentRef = {
    documentElement: { dataset: {} },
    querySelectorAll: () => developerOnly,
  };
  assert.equal(applyPresentationMode(documentRef, ''), PRESENTATION_MODES.PLAYER);
  assert.equal(documentRef.documentElement.dataset.presentationMode, 'player');
  assert.deepEqual(developerOnly.map(({ hidden }) => hidden), [true, true]);
  assert.equal(applyPresentationMode(documentRef, '?dev=1'), PRESENTATION_MODES.DEVELOPER);
  assert.deepEqual(developerOnly.map(({ hidden }) => hidden), [false, false]);
});
