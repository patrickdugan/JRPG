import assert from 'node:assert/strict';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import {
  REQUIRED_SCENE_CUE_FIELDS,
  SCENE_DIRECTIONS,
  getAllSceneDirections,
  getSceneDirection,
  getSceneDirectionsForChapter,
  validateSceneDirections,
} from '../content/scene-direction.mjs';

function canonicalBeats() {
  return CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => ({
    chapterId: chapter.id,
    beatId: beat.id,
    beat,
  })));
}

function replaceDirection(index, replacement) {
  return SCENE_DIRECTIONS.map((direction, directionIndex) => directionIndex === index ? replacement : direction);
}

test('presentation script covers every canonical beat exactly once and in deterministic order', () => {
  const expected = canonicalBeats().map(({ chapterId, beatId }) => ({ chapterId, beatId }));
  const actual = SCENE_DIRECTIONS.map(({ chapterId, beatId }) => ({ chapterId, beatId }));

  assert.equal(expected.length, 60);
  assert.equal(SCENE_DIRECTIONS.length, expected.length);
  assert.equal(new Set(SCENE_DIRECTIONS.map(({ beatId }) => beatId)).size, expected.length);
  assert.deepEqual(actual, expected);
  assert.deepEqual(validateSceneDirections(), {
    valid: true,
    directionCount: 60,
    canonicalBeatCount: 60,
    errors: [],
  });
});

test('every beat has bespoke authored cues and a valid speaking cast gesture focus', () => {
  const canonicalByBeat = new Map(canonicalBeats().map((entry) => [entry.beatId, entry]));
  const castSpeakers = new Set(Object.values(CAMPAIGN.cast).map(({ id }) => id.toUpperCase()));
  const cueBundles = new Set();

  for (const direction of SCENE_DIRECTIONS) {
    assert.equal(Object.isFrozen(direction), true, `${direction.beatId} direction must be immutable`);
    assert.equal(Object.isFrozen(direction.gestureCue), true, `${direction.beatId} gesture must be immutable`);
    for (const field of REQUIRED_SCENE_CUE_FIELDS) {
      assert.equal(typeof direction[field], 'string', `${direction.beatId} needs ${field}`);
      assert.ok(direction[field].trim().length >= 20, `${direction.beatId} ${field} must be authored, not a stub`);
    }
    assert.ok(direction.gestureCue.action.trim().length >= 20, `${direction.beatId} needs an authored gesture`);
    assert.ok(castSpeakers.has(direction.gestureCue.speaker), `${direction.beatId} references an unknown cast speaker`);
    const canonical = canonicalByBeat.get(direction.beatId);
    assert.ok(canonical.beat.text.some(({ speaker }) => speaker === direction.gestureCue.speaker), `${direction.beatId} gesture speaker must participate in its dialogue`);

    const fingerprint = [
      ...REQUIRED_SCENE_CUE_FIELDS.map((field) => direction[field]),
      direction.gestureCue.speaker,
      direction.gestureCue.action,
    ].join('\n');
    assert.ok(!cueBundles.has(fingerprint), `${direction.beatId} repeats another beat's complete direction bundle`);
    cueBundles.add(fingerprint);
  }
});

test('DOM-free lookup returns canonical immutable records without reordering', () => {
  assert.equal(getAllSceneDirections(), SCENE_DIRECTIONS);
  assert.equal(getSceneDirection('c4-03-varga-journal'), SCENE_DIRECTIONS.find(({ beatId }) => beatId === 'c4-03-varga-journal'));
  assert.equal(getSceneDirection('not-a-beat'), null);

  for (const chapter of CAMPAIGN.chapters) {
    const directions = getSceneDirectionsForChapter(chapter.id);
    assert.equal(Object.isFrozen(directions), true);
    assert.deepEqual(directions.map(({ beatId }) => beatId), chapter.beats.map(({ id }) => id));
  }
  assert.deepEqual(getSceneDirectionsForChapter('not-a-chapter'), []);
});

test('validator rejects omissions, duplicates, and canonical order drift', () => {
  const omitted = validateSceneDirections(SCENE_DIRECTIONS.slice(0, -1));
  assert.equal(omitted.valid, false);
  assert.ok(omitted.errors.some(({ code }) => code === 'coverage-count'));
  assert.ok(omitted.errors.some(({ code }) => code === 'missing-beat'));

  const duplicatedDirections = [...SCENE_DIRECTIONS];
  duplicatedDirections[1] = duplicatedDirections[0];
  const duplicated = validateSceneDirections(duplicatedDirections);
  assert.equal(duplicated.valid, false);
  assert.ok(duplicated.errors.some(({ code }) => code === 'duplicate-beat'));
  assert.ok(duplicated.errors.some(({ code }) => code === 'missing-beat'));

  const reorderedDirections = [...SCENE_DIRECTIONS];
  [reorderedDirections[0], reorderedDirections[1]] = [reorderedDirections[1], reorderedDirections[0]];
  const reordered = validateSceneDirections(reorderedDirections);
  assert.equal(reordered.valid, false);
  assert.ok(reordered.errors.some(({ code }) => code === 'order-mismatch'));
});

test('validator rejects placeholders, invalid cast references, and borrowed-franchise cues', () => {
  const first = SCENE_DIRECTIONS[0];
  const placeholder = validateSceneDirections(replaceDirection(0, { ...first, atmosphere: 'TODO placeholder atmosphere' }));
  assert.equal(placeholder.valid, false);
  assert.ok(placeholder.errors.some(({ code }) => code === 'generic-cue'));

  const invalidSpeaker = validateSceneDirections(replaceDirection(0, {
    ...first,
    gestureCue: { speaker: 'COLLECTOR', action: first.gestureCue.action },
  }));
  assert.equal(invalidSpeaker.valid, false);
  assert.ok(invalidSpeaker.errors.some(({ code }) => code === 'invalid-cast-speaker'));

  const absentSpeaker = validateSceneDirections(replaceDirection(0, {
    ...first,
    gestureCue: { speaker: 'AYA', action: first.gestureCue.action },
  }));
  assert.equal(absentSpeaker.valid, false);
  assert.ok(absentSpeaker.errors.some(({ code }) => code === 'speaker-not-in-beat'));

  const borrowedReference = validateSceneDirections(replaceDirection(0, {
    ...first,
    musicCue: 'Borrow the Castlevania score for this scene.',
  }));
  assert.equal(borrowedReference.valid, false);
  assert.ok(borrowedReference.errors.some(({ code }) => code === 'non-original-reference'));
});
