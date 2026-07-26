import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STORYWORLD_PACING_ASSUMPTIONS,
  STORYWORLD_PACING_REPORT,
} from '../storyworld-pacing.mjs';

test('full-catalog pacing remains a diagnostic ceiling rather than a selected-route claim', () => {
  assert.equal(STORYWORLD_PACING_REPORT.perCluster.length, 12);
  assert.equal(STORYWORLD_PACING_REPORT.maximumVisibleWords, 2750);
  assert.equal(STORYWORLD_PACING_REPORT.maximumDecisionCount, 23);
  assert.equal(STORYWORLD_PACING_REPORT.storyworldReferenceMinutes, 21.416666666666668);
  assert.equal(STORYWORLD_PACING_REPORT.fullCatalogReferenceMinutes, 340.9266666666667);
  assert.equal(STORYWORLD_PACING_REPORT.fullCatalogReferenceHours, 5.682111111111111);
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
