import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STORYWORLD_PACING_ASSUMPTIONS,
  STORYWORLD_PACING_REPORT,
} from '../storyworld-pacing.mjs';

test('full-catalog pacing remains a diagnostic ceiling rather than a selected-route claim', () => {
  assert.equal(STORYWORLD_PACING_REPORT.perCluster.length, 11);
  assert.equal(STORYWORLD_PACING_REPORT.maximumVisibleWords, 2440);
  assert.equal(STORYWORLD_PACING_REPORT.maximumDecisionCount, 21);
  assert.equal(STORYWORLD_PACING_REPORT.storyworldReferenceMinutes, 19.2);
  assert.equal(STORYWORLD_PACING_REPORT.fullCatalogReferenceMinutes, 338.71);
  assert.equal(STORYWORLD_PACING_REPORT.fullCatalogReferenceHours, 5.645166666666666);
  assert.equal(STORYWORLD_PACING_REPORT.fullCatalogWithinFiveToSixHourTarget, true);
  assert.equal(STORYWORLD_PACING_REPORT.selectedRouteDurationClaim, false);
});

test('pacing remains an explicit diagnostic and never claims observed playtime', () => {
  assert.equal(STORYWORLD_PACING_ASSUMPTIONS.fullCanonicalCatalogReferenceMinutes, 319.51);
  assert.equal(STORYWORLD_PACING_ASSUMPTIONS.readingWordsPerMinute, 200);
  assert.equal(STORYWORLD_PACING_ASSUMPTIONS.decisionDwellSeconds, 20);
  assert.equal(STORYWORLD_PACING_REPORT.diagnosticOnly, true);
  assert.equal(STORYWORLD_PACING_REPORT.observedPlaytimeProof, false);
  assert.equal(Object.isFrozen(STORYWORLD_PACING_REPORT.perCluster), true);
});
