import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  STATUS_VFX_EXPIRY_MS,
  createStatusVfxExpiryPresentations,
  sampleStatusVfxExpiryPresentations,
} from '../battle-status-vfx-presentation.mjs';
import {
  resolveStatusGlyphVfx,
  statusVfxImageHasExpectedSize,
} from '../status-vfx-atlas.mjs';

test('status expiry presentation is bounded, exact-tile, immutable, and prefix-safe', () => {
  const beforeSnapshot = Object.freeze({
    actors: Object.freeze([
      Object.freeze({ instanceId: 'ren', name: 'Ren', pos: Object.freeze({ x: 2, y: 3 }) }),
    ]),
    log: Object.freeze([Object.freeze({ type: 'commit', actorId: 'ren', pulse: 2 })]),
  });
  const afterSnapshot = Object.freeze({
    actors: Object.freeze([
      Object.freeze({ instanceId: 'ren', name: 'Ren', pos: Object.freeze({ x: 2, y: 3 }), statuses: Object.freeze([]) }),
    ]),
    log: Object.freeze([
      Object.freeze({ type: 'commit', actorId: 'ren', pulse: 2 }),
      Object.freeze({ type: 'status-expired', actorId: 'ren', statusId: 'dread', pulse: 4 }),
    ]),
  });
  const records = createStatusVfxExpiryPresentations({
    beforeSnapshot,
    afterSnapshot,
    startedAt: 1_000,
    speed: 2,
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].statusId, 'dread');
  assert.deepEqual(records[0].tile, { x: 2, y: 3 });
  assert.equal(records[0].frame.state, 'expire');
  assert.equal(records[0].durationMs, STATUS_VFX_EXPIRY_MS / 2);
  assert.equal(records[0].endsAt, 1_260);
  assert.equal(Object.isFrozen(records), true);
  assert.equal(Object.isFrozen(records[0]), true);
  assert.equal(sampleStatusVfxExpiryPresentations(records, 1_260).length, 0);
  const reducedA = sampleStatusVfxExpiryPresentations(records, 1_001, { reducedMotion: true });
  const reducedB = sampleStatusVfxExpiryPresentations(records, 1_259, { reducedMotion: true });
  assert.deepEqual(reducedB, reducedA);

  assert.deepEqual(createStatusVfxExpiryPresentations({
    beforeSnapshot,
    afterSnapshot: {
      ...afterSnapshot,
      log: [{ type: 'different', pulse: 2 }, { type: 'status-expired', actorId: 'ren', statusId: 'dread', pulse: 4 }],
    },
  }), [], 'divergent logs cannot manufacture expiry art');
});

test('unsupported and Final Ward Open statuses have no authored integration mapping', () => {
  assert.equal(resolveStatusGlyphVfx({ id: 'final-ward-open', tile: { x: 4, y: 2 } }), null);
  assert.equal(resolveStatusGlyphVfx({ id: 'unknown', tile: { x: 4, y: 2 } }), null);
  const unsupported = createStatusVfxExpiryPresentations({
    beforeSnapshot: { actors: [], log: [] },
    afterSnapshot: {
      actors: [{ instanceId: 'boss', name: 'Boss', pos: { x: 4, y: 2 }, statuses: [] }],
      log: [
        { type: 'status-expired', actorId: 'boss', statusId: 'final-ward-open', pulse: 9 },
        { type: 'status-expired', actorId: 'boss', statusId: 'unknown', pulse: 9 },
      ],
    },
  });
  assert.deepEqual(unsupported, []);
});

test('battle dimension-gates the status atlas and keeps generic glyph fallback on load failure', async () => {
  const source = await readFile(new URL('../battle.js', import.meta.url), 'utf8');
  const loadListener = source.indexOf("battleStatusVfxAtlasImage.addEventListener('load'");
  const errorListener = source.indexOf("battleStatusVfxAtlasImage.addEventListener('error'");
  const sourceAssignment = source.indexOf('battleStatusVfxAtlasImage.src = STATUS_VFX_ATLAS.url');
  assert.ok(loadListener >= 0 && errorListener > loadListener && sourceAssignment > errorListener);
  assert.match(source, /battleStatusVfxAtlasState = statusVfxImageHasExpectedSize\(battleStatusVfxAtlasImage\) \? 'ready' : 'error'/);
  assert.match(source, /battleStatusVfxAtlasImage\.addEventListener\('error',[\s\S]*?battleStatusVfxAtlasState = 'error'/);
  assert.match(source, /canvas\.dataset\.statusVfxArtState = battleStatusVfxAtlasState/);
  assert.equal(statusVfxImageHasExpectedSize({ naturalWidth: 96, naturalHeight: 192 }), true);
  assert.equal(statusVfxImageHasExpectedSize({ naturalWidth: 95, naturalHeight: 192 }), false);

  const applicationDraw = source.slice(
    source.indexOf('function drawBattleStatusApplicationVfx'),
    source.indexOf('function drawBattleAnimationFx'),
  );
  assert.match(applicationDraw, /battleStatusVfxAtlasState === 'ready'[\s\S]*?statusVfxImageHasExpectedSize\(battleStatusVfxAtlasImage\)[\s\S]*?resolveStatusGlyphVfx\(glyph\)/);
  assert.match(applicationDraw, /if \(authored\)[\s\S]*?else drawGenericStatusGlyph\(glyph, geometry\)/,
    'load errors, wrong dimensions, and unsupported mappings must retain the existing glyph');
});

test('battle consumes resolver-owned application, persistence, and expiry without joining timing boundaries', async () => {
  const source = await readFile(new URL('../battle.js', import.meta.url), 'utf8');
  assert.match(source, /drawStatusVfxAtlasFrame\(authored\.frame, authored\.tile, geometry/);
  assert.match(source, /const reducedStatusApplicationFrame = reducedMotion\.matches/);
  assert.match(source, /if \(reducedStatusApplicationFrame\) drawBattleStatusApplicationVfx\(reducedStatusApplicationFrame, geometry\)/);
  assert.match(source, /for \(const marker of getPersistentStatusVfxMarkers\(snapshot\)\)/);
  assert.match(source, /drawStatusVfxAtlasFrame\(marker\.frame, marker\.actorTile, geometry/);
  assert.match(source, /createStatusVfxExpiryPresentations\(\{/);
  assert.match(source, /sampleStatusVfxExpiryPresentations\(activeStatusExpiryVfx, now/);
  assert.match(source, /drawStatusExpiryVfx\(statusExpiryFrames, geometry\)/);
  assert.match(source, /if \(entry\.type === 'status-expired'\)/);
  assert.doesNotMatch(source, /getBattlePresentationBoundary\([^)]*(?:activeStatusExpiryVfx|statusExpiryFrames)/,
    'status lifecycle art cannot delay animation, commands, Recovery, terminal holds, or Auto-Grind');
  assert.doesNotMatch(source, /hasAuthoredStatusVfx|STATUS_VFX_STATUSES/,
    'battle integration must not duplicate or extend the resolver mapping');
});
