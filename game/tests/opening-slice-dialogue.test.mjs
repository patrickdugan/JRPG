import assert from 'node:assert/strict';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import {
  OPENING_SLICE_BEAT_IDS,
  OPENING_SLICE_DIALOGUE_METRICS,
  OPENING_SLICE_SCENES,
  OPENING_SLICE_TARGET_MINUTES,
  getOpeningSliceDialogue,
  getOpeningSliceGuidance,
  getOpeningSliceNextStep,
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

test('opening guidance teaches the next visible action without playtest jargon', () => {
  assert.match(getOpeningSliceGuidance(), /Continue the scene with N/u);
  assert.match(getOpeningSliceGuidance({
    interactionPrompt: 'Inspect the suspicious seal to continue.',
  }), /WASD.*interact with X/u);
  assert.match(getOpeningSliceGuidance({
    interactionPrompt: 'Complete the duel with Mateus before continuing the scene.',
    interactionKind: 'battle',
  }), /encounter briefing and begin when ready/u);
  assert.match(getOpeningSliceGuidance({
    narrativeComplete: true,
    choicesComplete: true,
  }), /Follow the gold marker/u);
  assert.match(getOpeningSliceGuidance({
    narrativeComplete: true,
    choicesComplete: true,
    operationComplete: true,
    pendingEncounterName: 'Tithe Hound',
  }), /Enter Tithe Hound/u);
  assert.match(getOpeningSliceGuidance({
    narrativeComplete: true,
    choicesComplete: true,
    operationComplete: true,
    battlesCleared: true,
  }), /gold route marker/u);
  assert.match(getOpeningSliceGuidance({
    narrativeComplete: true,
  }), /story response/u);
  assert.match(getOpeningSliceGuidance({
    narrativeComplete: true,
    choicesComplete: true,
    operationComplete: true,
    battlesCleared: true,
    fieldRouteComplete: true,
    storyworldPlacement: 'after-beat',
  }), /what this scene changed/u);
  assert.match(getOpeningSliceGuidance({ complete: true }), /opening chapter is complete/u);
  assert.match(getOpeningSliceGuidance({
    complete: true,
    feedbackRequired: true,
  }), /feedback before anyone explains/u);
  assert.doesNotMatch(getOpeningSliceGuidance(), /playtest|first clear|state machine/iu);
});

test('opening next-step navigation names one exact visible destination', () => {
  assert.deepEqual(getOpeningSliceNextStep(), {
    id: 'dialogue',
    label: 'Continue dialogue',
  });
  assert.equal(getOpeningSliceNextStep({ interactionKind: 'field' }).id, 'field');
  assert.equal(getOpeningSliceNextStep({ interactionKind: 'battle' }).id, 'battle');
  assert.equal(getOpeningSliceNextStep({
    narrativeComplete: true,
  }).id, 'choice');
  assert.equal(getOpeningSliceNextStep({
    narrativeComplete: true,
    choicesComplete: true,
    operationComplete: true,
  }).id, 'battle');
  assert.equal(getOpeningSliceNextStep({
    narrativeComplete: true,
    choicesComplete: true,
    operationComplete: true,
    battlesCleared: true,
    fieldRouteComplete: true,
    storyworldPlacement: 'after-beat',
  }).id, 'storyworld');
  assert.equal(getOpeningSliceNextStep({
    complete: true,
    feedbackRequired: true,
  }).id, 'feedback');
  assert.equal(Object.isFrozen(getOpeningSliceNextStep()), true);
});
