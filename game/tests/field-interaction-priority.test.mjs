import assert from 'node:assert/strict';
import test from 'node:test';

import { selectNearbyFieldInteractable } from '../field-interaction-priority.mjs';

const incomplete = Object.freeze({ id: 'rear-lock', consumed: false });
const completed = Object.freeze({ id: 'rear-lock', consumed: true });

test('an incomplete authored interaction outranks a ready exit within interaction range', () => {
  assert.equal(selectNearbyFieldInteractable({
    nearbyInteractables: [incomplete],
    exit: { id: 'rear-door', ready: true },
  }), incomplete);
});

test('a ready exit outranks completed Review content within interaction range', () => {
  assert.equal(selectNearbyFieldInteractable({
    nearbyInteractables: [completed],
    exit: { id: 'rear-door', ready: true },
  }), null);
});

test('completed authored content remains reviewable while the nearby exit is locked', () => {
  assert.equal(selectNearbyFieldInteractable({
    nearbyInteractables: [completed],
    exit: { id: 'rear-door', ready: false },
  }), completed);
});
