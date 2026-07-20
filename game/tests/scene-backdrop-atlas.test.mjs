import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { getAllChapters } from '../content/campaign.mjs';
import {
  SCENE_BACKDROP_ATLAS,
  SCENE_BACKDROP_BINDINGS,
  SCENE_BACKDROP_BY_BEAT_ID,
  SCENE_BACKDROP_CANONICAL_LEVEL_BY_BEAT_ID,
  SCENE_BACKDROP_IDS,
  getSceneBackdropBindingForBeat,
  getSceneBackdropFrame,
  getSceneBackdropFrameForBeat,
  getSceneBackdropIdForBeat,
  isSceneBackdropCompatibleWithLevel,
  sceneBackdropImageHasExpectedSize,
} from '../scene-backdrop-atlas.mjs';

test('scene backdrop mapping covers all 60 canonical beats exactly and uses every authored frame', () => {
  const canonicalBeatIds = getAllChapters().flatMap((chapter) => chapter.beats.map((beat) => beat.id));
  const mappedBeatIds = Object.keys(SCENE_BACKDROP_BY_BEAT_ID);
  assert.equal(canonicalBeatIds.length, 60);
  assert.equal(mappedBeatIds.length, 60);
  assert.deepEqual([...mappedBeatIds].sort(), [...canonicalBeatIds].sort());
  assert.deepEqual(
    [...new Set(Object.values(SCENE_BACKDROP_BY_BEAT_ID))].sort(),
    [...SCENE_BACKDROP_IDS].sort(),
  );
  assert.equal(SCENE_BACKDROP_IDS.length, 20);
  assert.equal(getSceneBackdropIdForBeat('unknown-beat'), null);
  assert.equal(getSceneBackdropFrameForBeat('unknown-beat'), null);
});

test('scene backdrop bindings match canonical beat levels and reject routed level mismatches', () => {
  const canonicalBeats = getAllChapters().flatMap((chapter) => chapter.beats);
  assert.deepEqual(
    Object.keys(SCENE_BACKDROP_BINDINGS).sort(),
    canonicalBeats.map((beat) => beat.id).sort(),
  );
  assert.deepEqual(
    Object.keys(SCENE_BACKDROP_CANONICAL_LEVEL_BY_BEAT_ID).sort(),
    canonicalBeats.map((beat) => beat.id).sort(),
  );
  for (const beat of canonicalBeats) {
    const binding = getSceneBackdropBindingForBeat(beat.id);
    assert.deepEqual(binding, {
      beatId: beat.id,
      backdropId: SCENE_BACKDROP_BY_BEAT_ID[beat.id],
      canonicalLevelId: beat.mapId,
      compatibleLevelIds: [beat.mapId],
    });
    assert.equal(Object.isFrozen(binding), true);
    assert.equal(Object.isFrozen(binding.compatibleLevelIds), true);
    assert.equal(SCENE_BACKDROP_CANONICAL_LEVEL_BY_BEAT_ID[beat.id], beat.mapId);
    assert.equal(isSceneBackdropCompatibleWithLevel(beat.id, beat.mapId), true);
    assert.equal(isSceneBackdropCompatibleWithLevel(beat.id, `${beat.mapId}-routed`), false);
    assert.equal(getSceneBackdropFrameForBeat(beat.id, beat.mapId)?.id, binding.backdropId);
    assert.equal(getSceneBackdropFrameForBeat(beat.id, `${beat.mapId}-routed`), null);
  }
  assert.equal(getSceneBackdropBindingForBeat('unknown-beat'), null);
  assert.equal(isSceneBackdropCompatibleWithLevel('unknown-beat', 'hsh-river-lane'), false);
});

test('scene backdrop atlas exposes one exact 320x180 frame in each cell of a 5x4 sheet', () => {
  assert.deepEqual(SCENE_BACKDROP_ATLAS, {
    id: 'campaign-scene-backdrop-suite-v1',
    url: './assets/art/scene-backdrop-suite/scene-backdrop-atlas.png',
    frameWidth: 320,
    frameHeight: 180,
    columns: 5,
    rows: 4,
    width: 1600,
    height: 720,
  });
  const rectangles = new Set();
  SCENE_BACKDROP_IDS.forEach((id, index) => {
    const frame = getSceneBackdropFrame(id);
    assert.deepEqual(frame, {
      id,
      index,
      column: index % 5,
      row: Math.floor(index / 5),
      x: (index % 5) * 320,
      y: Math.floor(index / 5) * 180,
      width: 320,
      height: 180,
    });
    assert.equal(Object.isFrozen(frame), true);
    rectangles.add(`${frame.x},${frame.y},${frame.width},${frame.height}`);
  });
  assert.equal(rectangles.size, 20);
  assert.equal(getSceneBackdropFrame('unknown-backdrop'), null);
});

test('scene backdrop image validation fails closed on undecoded and wrong-size rasters', () => {
  assert.equal(sceneBackdropImageHasExpectedSize(null), false);
  assert.equal(sceneBackdropImageHasExpectedSize({ naturalWidth: 0, naturalHeight: 0 }), false);
  assert.equal(sceneBackdropImageHasExpectedSize({ naturalWidth: 1600, naturalHeight: 719 }), false);
  assert.equal(sceneBackdropImageHasExpectedSize({ naturalWidth: 1599, naturalHeight: 720 }), false);
  assert.equal(sceneBackdropImageHasExpectedSize({ naturalWidth: 1600, naturalHeight: 720 }), true);
});

test('Campaign integration is decorative, explicit, static, and retains code-native fallback', async () => {
  const [html, css, source, smoke] = await Promise.all([
    readFile(new URL('../campaign.html', import.meta.url), 'utf8'),
    readFile(new URL('../campaign.css', import.meta.url), 'utf8'),
    readFile(new URL('../campaign.js', import.meta.url), 'utf8'),
    readFile(new URL('../tools/browser-smoke.py', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /<canvas id="sceneBackdrop"[^>]*width="320" height="180"[^>]*><\/canvas>/u);
  assert.match(html, /<div class="scene-visual" aria-hidden="true">[\s\S]*?id="sceneBackdrop"[\s\S]*?id="sceneFocusPortrait"/u);
  assert.match(source, /sceneBackdrop\.dataset\.artState = frame \? sceneBackdropState : 'fallback'/u);
  assert.match(source, /sceneBackdrop\.dataset\.backdropId = frame\?\.id \?\? ''/u);
  assert.match(source, /sceneBackdrop\.dataset\.activeLevelId = activeLevelId \?\? ''/u);
  assert.match(source, /sceneBackdropState === 'ready' && sceneBackdropImageHasExpectedSize\(sceneBackdropImage\)/u);
  assert.match(source, /getSceneBackdropFrameForBeat\(beat\?\.id, activeLevelId\)/u);
  assert.match(source, /renderSceneDirection\(beat, level\?\.id\)/u);
  assert.match(source, /sceneBackdropCtx\.fillRect\(0, 0, sceneBackdrop\.width, sceneBackdrop\.height\)/u);
  assert.match(source, /sceneBackdropCtx\.drawImage\(\s*sceneBackdropImage/u);
  assert.doesNotMatch(source, /getSceneBackdropFrameForBeat\([^)]*(?:title|location|atmosphere)/u);
  assert.doesNotMatch(css, /\.scene-backdrop[^}]*animation/u);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.scene-presentation \{ grid-template-columns: 1fr; \}/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important/u);
  assert.match(smoke, /invalid-png-for-scene-backdrop-fallback-qa/u);
  assert.match(smoke, /mismatchedFrame[\s\S]*getSceneBackdropFrameForBeat\([\s\S]*'hsh-census-square'/u);
  assert.match(smoke, /"mismatchedFrame": None/u);
});
