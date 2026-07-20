import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BATTLE_STAGE_ART,
  battleStageArtMatchesLevel,
  battleStageImageHasExpectedSize,
  getBattleStageArt,
} from '../battle-stage-art.mjs';
import { getLevel } from '../content/levels.mjs';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(GAME_ROOT, '..');
const EXPECTED_ART = Object.freeze({
  id: 'takamine-bell-chamber-board-v1',
  levelId: 'tkm-bell-chamber',
  url: './assets/art/takamine-bell-chamber/takamine-bell-chamber-board.png',
  sourceWidth: 384,
  sourceHeight: 224,
  sourceCell: 32,
  columns: 12,
  rows: 7,
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('stage-art registry exposes one immutable exact Takamine board contract', () => {
  const stageArt = getBattleStageArt('tkm-bell-chamber');
  assert.deepEqual(stageArt, EXPECTED_ART);
  assert.equal(Object.isFrozen(BATTLE_STAGE_ART), true);
  assert.equal(Object.isFrozen(stageArt), true);
  assert.equal(BATTLE_STAGE_ART['tkm-bell-chamber'], stageArt);
  assert.equal(getBattleStageArt('not-a-real-level'), null);
  assert.equal(getBattleStageArt(), null);
});

test('stage-art dimensions must agree with the live level and the loaded image exactly', () => {
  const stageArt = getBattleStageArt('tkm-bell-chamber');
  const level = getLevel('tkm-bell-chamber');
  assert.equal(battleStageArtMatchesLevel(stageArt, level), true);
  assert.equal(battleStageArtMatchesLevel(stageArt, { ...level, width: 11 }), false);
  assert.equal(battleStageArtMatchesLevel(stageArt, { ...level, height: 8 }), false);
  assert.equal(battleStageArtMatchesLevel(stageArt, { ...level, spacePx: 16 }), false);
  assert.equal(battleStageArtMatchesLevel(stageArt, { ...level, id: 'other-stage' }), false);
  assert.equal(battleStageArtMatchesLevel(null, level), false);
  assert.equal(battleStageArtMatchesLevel(stageArt, null), false);

  assert.equal(battleStageImageHasExpectedSize(stageArt, { naturalWidth: 384, naturalHeight: 224 }), true);
  assert.equal(battleStageImageHasExpectedSize(stageArt, { naturalWidth: 385, naturalHeight: 224 }), false);
  assert.equal(battleStageImageHasExpectedSize(stageArt, { naturalWidth: 384, naturalHeight: 223 }), false);
  assert.equal(battleStageImageHasExpectedSize(stageArt, null), false);
});

test('served runtime board exists and is byte-identical to the manifested production export', async () => {
  const stageArt = getBattleStageArt('tkm-bell-chamber');
  const runtimePath = resolve(GAME_ROOT, stageArt.url.replace(/^\.\//, ''));
  const manifestPath = resolve(REPO_ROOT, 'assets', 'art', 'takamine-bell-chamber', 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const boardRecord = manifest.exports.find(({ id }) => id === 'board-png');
  assert.ok(boardRecord, 'manifest must include board-png');
  const productionPath = resolve(REPO_ROOT, 'assets', 'art', 'takamine-bell-chamber', boardRecord.path);
  const [runtimeBytes, productionBytes] = await Promise.all([readFile(runtimePath), readFile(productionPath)]);

  assert.equal(sha256(productionBytes), boardRecord.sha256.toLowerCase());
  assert.equal(sha256(runtimeBytes), boardRecord.sha256.toLowerCase(), 'served board must not drift from the production export');
  assert.equal(runtimeBytes.equals(productionBytes), true, 'served and production boards must be byte-identical');
});

test('battle integration exposes loading/ready/error/fallback states and retains the procedural fallback', async () => {
  const source = await readFile(resolve(GAME_ROOT, 'battle.js'), 'utf8');

  assert.match(source, /getBattleStageArt\(encounter\.levelId\)/);
  assert.match(source, /canvas\.dataset\.stageArtState\s*=\s*state/);
  for (const state of ['loading', 'ready', 'error', 'fallback']) {
    assert.match(source, new RegExp(`setBattleStageArtState\\(['"]${state}['"]\\)`), `battle.js must expose the ${state} stage state`);
  }
  assert.match(source, /if \(!configuredStageArt\)[\s\S]*?setBattleStageArtState\(['"]fallback['"]\)/);
  assert.match(source, /if \(!battleStageArtMatchesLevel\(configuredStageArt, engine\.level\)\)[\s\S]*?setBattleStageArtState\(['"]error['"]\)/);
  assert.match(source, /if \(!battleStageImageHasExpectedSize\(configuredStageArt, image\)\)[\s\S]*?setBattleStageArtState\(['"]error['"]\)/);
  assert.match(source, /else \{\s*context\.fillStyle = terrainColor\(terrain\.get\(key\)\)/, 'a failed or absent bitmap must retain procedural terrain rendering');
});

test('battle paint order keeps art below rules, telegraphs, units, and action effects', async () => {
  const source = await readFile(resolve(GAME_ROOT, 'battle.js'), 'utf8');
  const drawStart = source.indexOf('function drawBattle(');
  const drawEnd = source.indexOf('\nfunction createCombatantCard(', drawStart);
  assert.ok(drawStart >= 0 && drawEnd > drawStart, 'drawBattle function must remain inspectable');
  const draw = source.slice(drawStart, drawEnd);
  const orderedMarkers = [
    'context.fillRect(0, 0, canvas.width, canvas.height)',
    'battleStageArtImage,',
    'for (let y = 0; y < level.height; y += 1)',
    'drawObjectiveTokens(snapshot, level, geometry, visualNow)',
    'drawBossIntent(snapshot, geometry)',
    'const presentationActors = getBattlePresentationActors(',
    'drawBattleAnimationFx(animation, geometry)',
  ];
  let previous = -1;
  for (const marker of orderedMarkers) {
    const position = draw.indexOf(marker);
    assert.ok(position > previous, `${marker} must occur after the preceding paint layer`);
    previous = position;
  }
  assert.match(draw, /context\.imageSmoothingEnabled\s*=\s*false[\s\S]*?context\.drawImage\(\s*battleStageArtImage/);
  assert.match(draw, /battleStageArtImage,\s*originX,\s*originY,\s*geometry\.boardWidth,\s*geometry\.boardHeight/);
});
