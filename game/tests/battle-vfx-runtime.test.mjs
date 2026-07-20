import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  BATTLE_VFX_ATLAS,
  BATTLE_VFX_EFFECTS,
  battleVfxImageHasExpectedSize,
  getBattleVfxFrame,
} from '../battle-vfx-atlas.mjs';

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
  assert.match(source, /getBattleVfxFrame\([\s\S]*?context\.drawImage\(\s*battleVfxAtlasImage/);
  assert.match(source, /if \(frame\.impact\)[\s\S]*?getBattleVfxFrame/,
    'procedural impact must remain below the authored overlay and available on image failure');
});
