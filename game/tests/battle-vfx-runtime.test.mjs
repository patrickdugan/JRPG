import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  BATTLE_VFX_ANCHORS,
  BATTLE_VFX_ATLAS,
  BATTLE_VFX_EFFECTS,
  battleVfxImageHasExpectedSize,
  getBattleVfxFrame,
  resolveBattleVfxAnchors,
} from '../battle-vfx-atlas.mjs';
import {
  createEnemyFamilyTimeline,
  createPartySkillTimeline,
} from '../battle-animation.mjs';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUITE_ROOT = resolve(GAME_ROOT, '..', 'assets', 'art', 'battle-vfx-suite');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('battle VFX atlas exposes all delivery and essence rows with exact 64px frames', () => {
  assert.equal(Object.isFrozen(BATTLE_VFX_ATLAS), true);
  assert.equal(Object.isFrozen(BATTLE_VFX_EFFECTS), true);
  assert.deepEqual(BATTLE_VFX_EFFECTS, [
    'cut', 'pierce', 'crush', 'arcane', 'ember', 'frost', 'storm', 'radiance', 'umbral',
  ]);
  assert.deepEqual(BATTLE_VFX_ATLAS, {
    url: './assets/art/battle-vfx-suite/battle-vfx-suite-atlas.png',
    width: 384,
    height: 576,
    columns: 6,
    rows: 9,
    cellWidth: 64,
    cellHeight: 64,
    anchorX: 32,
    anchorY: 32,
  });

  for (const [row, effectId] of BATTLE_VFX_EFFECTS.entries()) {
    for (const [phase, phaseProgress] of [
      ['windup', 0], ['windup', 1], ['movement', 0.5], ['projectile-or-trail', 0.5],
      ['impact', 0.5], ['stagger', 0.5], ['status-glyph', 0.5], ['recovery', 1],
    ]) {
      const frame = getBattleVfxFrame({ delivery: effectId, phase, phaseProgress });
      assert.equal(frame.effectId, effectId);
      assert.equal(frame.row, row);
      assert.ok(frame.column >= 0 && frame.column < 6);
      assert.ok(frame.x >= 0 && frame.x + frame.width <= BATTLE_VFX_ATLAS.width);
      assert.ok(frame.y >= 0 && frame.y + frame.height <= BATTLE_VFX_ATLAS.height);
      assert.equal(Object.isFrozen(frame), true);
    }
  }
  assert.equal(getBattleVfxFrame({ delivery: 'unknown', phase: 'impact' }), null);
  assert.equal(getBattleVfxFrame({ delivery: 'cut', phase: 'unknown' }), null);
});

test('live party and enemy emission phases resolve to authored atlas frames', () => {
  const timelines = [
    createPartySkillTimeline('warding-script', {
      sourceTile: { x: 1, y: 1 },
      targetTile: { x: 5, y: 1 },
    }),
    createEnemyFamilyTimeline('hound', {
      sourceTile: { x: 6, y: 2 },
      targetTile: { x: 2, y: 2 },
    }),
  ];

  assert.equal(timelines[0].action.emissionKind, 'projectile');
  assert.equal(timelines[1].action.emissionKind, 'trail');
  for (const timeline of timelines) {
    for (const frame of timeline.frames) {
      const vfx = getBattleVfxFrame({
        delivery: timeline.action.delivery,
        essence: timeline.action.essence,
        phase: frame.phase,
        phaseProgress: frame.phaseProgress,
      });
      assert.ok(vfx, `${timeline.resolvedId} ${frame.phase} must resolve to authored VFX`);
    }
  }

  for (const phase of ['projectile', 'trail', 'projectile-or-trail']) {
    assert.equal(getBattleVfxFrame({ delivery: 'arcane', phase, phaseProgress: 0.5 }).column, 2);
  }
});

test('pure VFX anchor resolution keeps recovery and self status on the source actor', () => {
  const timeline = createPartySkillTimeline('cinder-route', {
    sourceTile: { x: 1, y: 1 },
    targetTile: { x: 5, y: 1 },
    statusId: 'scorch',
    selfStatusId: 'overheated',
  });
  const frameFor = (phase) => timeline.frames.find((frame) => frame.phase === phase);

  assert.deepEqual(resolveBattleVfxAnchors(frameFor('windup')), [
    { channel: 'phase', anchor: BATTLE_VFX_ANCHORS.source },
  ]);
  assert.deepEqual(resolveBattleVfxAnchors(frameFor('trail')), [
    { channel: 'phase', anchor: BATTLE_VFX_ANCHORS.emission },
  ]);
  assert.deepEqual(resolveBattleVfxAnchors(frameFor('impact')), [
    { channel: 'phase', anchor: BATTLE_VFX_ANCHORS.target },
  ]);
  assert.deepEqual(resolveBattleVfxAnchors(frameFor('recovery')), [
    { channel: 'phase', anchor: BATTLE_VFX_ANCHORS.source },
  ]);
  assert.deepEqual(resolveBattleVfxAnchors(frameFor('status-glyph')), [
    { channel: 'status', anchor: BATTLE_VFX_ANCHORS.target },
    { channel: 'self-status', anchor: BATTLE_VFX_ANCHORS.source },
  ]);
  assert.deepEqual(resolveBattleVfxAnchors({ phase: 'status-glyph', selfStatusGlyph: {} }), [
    { channel: 'self-status', anchor: BATTLE_VFX_ANCHORS.source },
  ]);
  assert.equal(Object.isFrozen(resolveBattleVfxAnchors(frameFor('recovery'))), true);
  assert.equal(Object.isFrozen(resolveBattleVfxAnchors(frameFor('recovery'))[0]), true);
  assert.deepEqual(resolveBattleVfxAnchors({ phase: 'unknown' }), []);
});

test('essence art takes precedence while pure attacks retain their delivery row', () => {
  assert.equal(getBattleVfxFrame({ delivery: 'arcane', essence: 'ember', phase: 'impact' }).effectId, 'ember');
  assert.equal(getBattleVfxFrame({ delivery: 'pierce', phase: 'impact' }).effectId, 'pierce');
  assert.equal(getBattleVfxFrame({ delivery: 'cut', essence: 'unknown', phase: 'impact' }).effectId, 'cut');
});

test('production and shipped VFX atlases are byte-identical to the integrated manifest', async () => {
  const [manifestText, production, runtime] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'battle-vfx-suite-atlas.png')),
    readFile(resolve(GAME_ROOT, 'assets', 'art', 'battle-vfx-suite', 'battle-vfx-suite-atlas.png')),
  ]);
  const manifest = JSON.parse(manifestText);
  const record = manifest.exports.find(({ id }) => id === 'runtime-atlas');
  assert.equal(manifest.runtimeStatus, 'current-browser-impact-overlay');
  assert.equal(sha256(production), record.sha256);
  assert.equal(sha256(runtime), record.sha256);
  assert.equal(runtime.equals(production), true);
  assert.equal(battleVfxImageHasExpectedSize({ naturalWidth: 384, naturalHeight: 576 }), true);
  assert.equal(battleVfxImageHasExpectedSize({ naturalWidth: 383, naturalHeight: 576 }), false);
});

test('battle loads the atlas with listeners first and retains procedural effects as fallback', async () => {
  const source = await readFile(resolve(GAME_ROOT, 'battle.js'), 'utf8');
  const loadListener = source.indexOf("battleVfxAtlasImage.addEventListener('load'");
  const errorListener = source.indexOf("battleVfxAtlasImage.addEventListener('error'");
  const sourceAssignment = source.indexOf('battleVfxAtlasImage.src = BATTLE_VFX_ATLAS.url');
  assert.ok(loadListener >= 0 && errorListener > loadListener && sourceAssignment > errorListener);
  assert.match(source, /canvas\.dataset\.vfxArtState = battleVfxAtlasState/);
  assert.match(source, /const anchors = resolveBattleVfxAnchors\(frame\)/);
  assert.match(source, /descriptor\.anchor === BATTLE_VFX_ANCHORS\.emission/);
  assert.doesNotMatch(source, /VFX_TARGET_PHASES/);
  assert.match(source, /getBattleVfxFrame\([\s\S]*?context\.drawImage\(\s*battleVfxAtlasImage/);
  assert.match(source, /if \(frame\.impact\)[\s\S]*?getBattleVfxFrame/,
    'procedural impact must remain below the authored overlay and available on image failure');
});
