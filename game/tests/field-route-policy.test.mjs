import assert from 'node:assert/strict';
import test from 'node:test';

import { LEVELS } from '../content/levels.mjs';
import { resolveIntendedRouteExit } from '../field-route-policy.mjs';

test('story routing chooses the immediate Chapter 3 destination over a ready later branch', () => {
  const exit = resolveIntendedRouteExit(LEVELS, 'sdg-market-lane', 'sdg-customs-house');
  assert.equal(exit?.id, 'customs-house');
  assert.equal(exit?.destinationLevelId, 'sdg-customs-house');
});

test('story routing deterministically chooses the first step of a multi-map path', () => {
  const takamine = resolveIntendedRouteExit(LEVELS, 'tkm-rain-gate', 'tkm-abandoned-chapel');
  assert.equal(takamine?.id, 'service-path');

  const sodegaura = resolveIntendedRouteExit(LEVELS, 'sdg-market-lane', 'sdg-salt-warehouse');
  assert.equal(sodegaura?.id, 'rain-docks');
});

test('story routing returns no target for an unreachable, identical, or unknown destination', () => {
  assert.equal(resolveIntendedRouteExit(LEVELS, 'sdg-salt-warehouse', 'sdg-customs-house'), null);
  assert.equal(resolveIntendedRouteExit(LEVELS, 'sdg-market-lane', 'sdg-market-lane'), null);
  assert.equal(resolveIntendedRouteExit(LEVELS, 'missing-level', 'sdg-market-lane'), null);
});
