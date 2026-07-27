import assert from 'node:assert/strict';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import {
  OPENING_SLICE_BEAT_IDS,
  OPENING_SLICE_DIALOGUE_METRICS,
  OPENING_SLICE_SCENES,
  OPENING_SLICE_TARGET_MINUTES,
  getOpeningSliceDialogue,
  getOpeningSliceProgress,
  isOpeningSliceBeat,
} from '../content/opening-slice-dialogue.mjs';

const expectedBeatIds = CAMPAIGN.chapters
  .slice(0, 3)
  .flatMap((chapter) => chapter.beats.map(({ id }) => id));

test('first-play dialogue covers the exact opening through Mateus in canonical order', () => {
  assert.deepEqual(OPENING_SLICE_BEAT_IDS, expectedBeatIds);
  assert.equal(OPENING_SLICE_SCENES.length, 18);
  assert.equal(OPENING_SLICE_TARGET_MINUTES.minimum, 30);
  assert.equal(OPENING_SLICE_TARGET_MINUTES.maximum, 45);
  assert.equal(OPENING_SLICE_DIALOGUE_METRICS.sceneCount, 18);
  assert.equal(OPENING_SLICE_DIALOGUE_METRICS.dialogueLines, 199);
  assert.equal(OPENING_SLICE_DIALOGUE_METRICS.dialogueWords, 1_809);
  assert.equal(Object.isFrozen(OPENING_SLICE_SCENES), true);
  assert.equal(Object.isFrozen(OPENING_SLICE_SCENES[0].dialogue), true);
});

test('opening cut preserves cadence gates and essential comprehension facts', () => {
  assert.equal(getOpeningSliceDialogue('p00-delivery-in-rain').length, 30);
  const allText = OPENING_SLICE_SCENES
    .flatMap(({ dialogue }) => dialogue.map(({ line }) => line))
    .join(' ');
  for (const required of [
    'Takamine',
    'Aya',
    'Nikola',
    'Mateus',
    'Kurozane',
    'Blood Wards',
    'one fifth',
    'Open the cells',
    'source under watch',
  ]) {
    assert.match(allText, new RegExp(required, 'u'));
  }
  assert.equal(isOpeningSliceBeat('fp1-mateus'), false);
  assert.equal(isOpeningSliceBeat('c2-06-name-from-europe'), true);
  assert.equal(getOpeningSliceDialogue('c3-01-separate-arrivals'), null);
});

test('opening progress remains an immutable 18-scene report', () => {
  const partial = getOpeningSliceProgress(OPENING_SLICE_BEAT_IDS.slice(0, 7), OPENING_SLICE_BEAT_IDS[7]);
  assert.deepEqual(partial, {
    complete: false,
    completedSceneCount: 7,
    requiredSceneCount: 18,
    currentSceneNumber: 8,
    targetMinutes: { minimum: 30, maximum: 45 },
  });
  assert.equal(Object.isFrozen(partial), true);
  assert.equal(getOpeningSliceProgress(OPENING_SLICE_BEAT_IDS).complete, true);
});
