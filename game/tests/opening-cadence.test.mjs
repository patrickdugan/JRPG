import test from 'node:test';
import assert from 'node:assert/strict';

import { getOpeningInteractionGate, OPENING_BEAT_ID } from '../opening-cadence.mjs';

test('the opening asks for play after eight lines and braids later dialogue through field tasks', () => {
  assert.equal(getOpeningInteractionGate({ beatId: OPENING_BEAT_ID, acknowledgedLines: 7, completedNodeCount: 0 }), null);
  assert.equal(getOpeningInteractionGate({ beatId: OPENING_BEAT_ID, acknowledgedLines: 8, completedNodeCount: 0 })?.requiredCompletedNodeCount, 1);
  assert.equal(getOpeningInteractionGate({ beatId: OPENING_BEAT_ID, acknowledgedLines: 18, completedNodeCount: 1 })?.requiredCompletedNodeCount, 2);
  assert.equal(getOpeningInteractionGate({ beatId: OPENING_BEAT_ID, acknowledgedLines: 27, completedNodeCount: 2 })?.requiredCompletedNodeCount, 3);
  assert.equal(getOpeningInteractionGate({ beatId: OPENING_BEAT_ID, acknowledgedLines: 27, completedNodeCount: 3 }), null);
});

test('opening cadence gates never affect later scenes', () => {
  assert.equal(getOpeningInteractionGate({ beatId: 'c01-somewhere-else', acknowledgedLines: 30, completedNodeCount: 0 }), null);
});
