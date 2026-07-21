import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STORYWORLD_PACING_ASSUMPTIONS,
  STORYWORLD_PACING_REPORT,
} from '../storyworld-pacing.mjs';

test('maximum visible Storyworld path keeps the 80-scene reference route within five to six hours', () => {
  assert.equal(STORYWORLD_PACING_REPORT.perCluster.length, 10);
  assert.equal(STORYWORLD_PACING_REPORT.maximumVisibleWords, 1757);
  assert.equal(STORYWORLD_PACING_REPORT.maximumDecisionCount, 19);
  assert.equal(STORYWORLD_PACING_REPORT.storyworldReferenceMinutes, 15.118333333333332);
  assert.equal(STORYWORLD_PACING_REPORT.completeNarrativeReferenceMinutes, 324.36733333333336);
  assert.equal(STORYWORLD_PACING_REPORT.withinFiveToSixHourTarget, true);
});

test('pacing remains an explicit diagnostic and never claims observed playtime', () => {
  assert.equal(STORYWORLD_PACING_ASSUMPTIONS.readingWordsPerMinute, 200);
  assert.equal(STORYWORLD_PACING_ASSUMPTIONS.decisionDwellSeconds, 20);
  assert.equal(STORYWORLD_PACING_REPORT.diagnosticOnly, true);
  assert.equal(STORYWORLD_PACING_REPORT.observedPlaytimeProof, false);
  assert.equal(Object.isFrozen(STORYWORLD_PACING_REPORT.perCluster), true);
});
