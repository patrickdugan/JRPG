import assert from 'node:assert/strict';
import test from 'node:test';

import { AUDIO_LOOP_DEFINITIONS } from '../audio-runtime.mjs';
import { CAMPAIGN } from '../content/campaign.mjs';
import { SCENE_DIRECTIONS } from '../content/scene-direction.mjs';
import {
  CAMPAIGN_AMBIENCE_FAMILIES,
  CAMPAIGN_SCORE_FAMILIES,
  SCENE_AUDIO_PRESENTATIONS,
  SCENE_SCORE_FAMILY_BY_BEAT,
  compileSceneAudioPresentations,
  getSceneAudioPresentation,
  validateSceneAudioPresentations,
} from '../scene-audio.mjs';

const canonicalBeatIds = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => beat.id));

test('all sixty authored music directions map exactly once in canonical order', () => {
  const report = validateSceneAudioPresentations();
  assert.deepEqual(report, {
    valid: true,
    presentationCount: 60,
    scoreFamilyCount: 9,
    ambienceFamilyCount: 9,
    errors: [],
  });
  assert.deepEqual(SCENE_AUDIO_PRESENTATIONS.map((presentation) => presentation.beatId), canonicalBeatIds);
  assert.deepEqual(SCENE_AUDIO_PRESENTATIONS.map((presentation) => presentation.beatId),
    SCENE_DIRECTIONS.map((direction) => direction.beatId));
  assert.deepEqual(Object.keys(SCENE_SCORE_FAMILY_BY_BEAT).sort(), canonicalBeatIds.toSorted());
});

test('each scene retains its authored cue while resolving one reusable score and ambience seam', () => {
  for (const [index, presentation] of SCENE_AUDIO_PRESENTATIONS.entries()) {
    const direction = SCENE_DIRECTIONS[index];
    const score = CAMPAIGN_SCORE_FAMILIES[presentation.scoreFamily];
    const ambience = CAMPAIGN_AMBIENCE_FAMILIES[presentation.ambienceFamily];
    assert.equal(presentation.sourceMusicCue, direction.musicCue, presentation.beatId);
    assert.equal(presentation.chapterId, direction.chapterId, presentation.beatId);
    assert.equal(presentation.loop, score.loop, presentation.beatId);
    assert.equal(presentation.ambienceFamily, score.ambienceFamily, presentation.beatId);
    assert.equal(presentation.ambienceLabel, ambience.label, presentation.beatId);
    assert.equal(AUDIO_LOOP_DEFINITIONS[presentation.loop].scoreFamily, score.id, presentation.beatId);
    assert.equal(AUDIO_LOOP_DEFINITIONS[presentation.loop].ambienceFamily, ambience.id, presentation.beatId);
  }
  assert.deepEqual(
    new Set(SCENE_AUDIO_PRESENTATIONS.map((presentation) => presentation.scoreFamily)),
    new Set(Object.keys(CAMPAIGN_SCORE_FAMILIES)),
  );
  assert.deepEqual(
    new Set(SCENE_AUDIO_PRESENTATIONS.map((presentation) => presentation.ambienceFamily)),
    new Set(Object.keys(CAMPAIGN_AMBIENCE_FAMILIES)),
  );
});

test('scene audio contracts are immutable, queryable, and unknown beats fail closed', () => {
  const opening = getSceneAudioPresentation(canonicalBeatIds[0]);
  assert.equal(opening.loop, 'rain-evidence');
  assert.equal(getSceneAudioPresentation('missing-beat'), null);
  assert.ok(Object.isFrozen(SCENE_AUDIO_PRESENTATIONS));
  assert.ok(Object.isFrozen(opening));
  assert.ok(Object.isFrozen(CAMPAIGN_SCORE_FAMILIES.evidence));
  assert.ok(Object.isFrozen(CAMPAIGN_AMBIENCE_FAMILIES.rain));
  assert.throws(() => { opening.loop = 'boss'; }, TypeError);
});

test('compiler and validator reject missing, unknown, reordered, and cue-detached mappings', () => {
  const missingAssignments = { ...SCENE_SCORE_FAMILY_BY_BEAT };
  delete missingAssignments[canonicalBeatIds[0]];
  const missing = compileSceneAudioPresentations({ assignments: missingAssignments });
  const missingReport = validateSceneAudioPresentations({
    presentations: missing,
    assignments: missingAssignments,
  });
  assert.equal(missingReport.valid, false);
  assert.match(missingReport.errors.join(' '), /exactly 60|unknown score family|unknown loop/);

  const unknownAssignments = { ...SCENE_SCORE_FAMILY_BY_BEAT, [canonicalBeatIds[0]]: 'missing-family' };
  const unknown = compileSceneAudioPresentations({ assignments: unknownAssignments });
  assert.match(validateSceneAudioPresentations({
    presentations: unknown,
    assignments: unknownAssignments,
  }).errors.join(' '), /unknown score family/);

  const reordered = SCENE_AUDIO_PRESENTATIONS.slice();
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.match(validateSceneAudioPresentations({ presentations: reordered }).errors.join(' '), /canonical order/);

  const detached = SCENE_AUDIO_PRESENTATIONS.map((presentation, index) => (
    index ? presentation : { ...presentation, sourceMusicCue: 'Different cue.' }
  ));
  assert.match(validateSceneAudioPresentations({ presentations: detached }).errors.join(' '), /detached/);
});
