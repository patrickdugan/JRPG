import assert from 'node:assert/strict';
import test from 'node:test';

import { selectNearbyFieldInteractable } from '../field-interaction-priority.mjs';

const incomplete = Object.freeze({ id: 'rear-lock', consumed: false, available: true });
const futureLocked = Object.freeze({ id: 'future-lock', consumed: false, available: false, blockedBy: 'future-flag' });
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

test('a future-locked interaction cannot trap the player beside a ready exit', () => {
  assert.equal(selectNearbyFieldInteractable({
    nearbyInteractables: [futureLocked],
    exit: { id: 'rear-door', ready: true },
  }), null);
});

test('a future-locked interaction remains inspectable while the nearby exit is locked', () => {
  assert.equal(selectNearbyFieldInteractable({
    nearbyInteractables: [futureLocked],
    exit: { id: 'rear-door', ready: false },
  }), futureLocked);
});

test('completed authored content remains reviewable while the nearby exit is locked', () => {
  assert.equal(selectNearbyFieldInteractable({
    nearbyInteractables: [completed],
    exit: { id: 'rear-door', ready: false },
  }), completed);
});
