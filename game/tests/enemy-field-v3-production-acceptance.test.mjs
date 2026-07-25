import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUITE_ROOT = resolve(GAME_ROOT, '..', 'assets', 'art', 'enemy-field-suite-v3');
const DIRECTIONS = ['north', 'east', 'south', 'west'];
const PHASES = [
  'contact-a', 'compression-a', 'passing-a', 'extension-a',
  'contact-b', 'compression-b', 'passing-b', 'extension-b',
];
const COLUMNS = DIRECTIONS.flatMap((direction) => [
  `${direction}-idle`,
  ...PHASES.map((phase) => `${direction}-${phase}`),
]).concat(['south-alert', 'south-hurt']);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('enemy v3 reports generated-board ancestry and deterministic pixelification honestly', async () => {
  const source = JSON.parse(await readFile(resolve(SUITE_ROOT, 'enemy-field-suite-v3.source.json'), 'utf8'));
  assert.equal(source.classification, 'deterministically-pixelified');
  assert.equal(source.sourceClassification, 'AI-generated pixel-styled concept');
  assert.match(source.qualityTarget, /late-1990s PlayStation JRPG/u);
  assert.deepEqual(source.frame, {
    width: 80,
    height: 80,
    pivot: [40, 77],
    footPoint: [40, 77],
    transparentGutter: 2,
    alphaPolicy: 'binary',
  });
  assert.deepEqual(source.walkPhases, PHASES);
  assert.equal(source.conversion.resampling, 'BOX');
  assert.equal(source.conversion.paletteCeilingPerEnemy, 48);
  assert.equal(source.conversion.dither, 'none');
  assert.equal(Object.keys(source.profiles).length, 32);
  assert.deepEqual(
    [...new Set(Object.values(source.profiles))].sort(),
    ['ambush', 'beast', 'heavy', 'hover', 'humanoid', 'rush'],
  );
});

test('enemy v3 manifest covers every bounded field and trigger frame', async () => {
  const manifest = JSON.parse(await readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'));
  assert.equal(manifest.classification, 'deterministically-pixelified');
  assert.equal(manifest.sourceClassification, 'AI-generated pixel-styled concept');
  assert.equal(manifest.rowOrder.length, 32);
  assert.deepEqual(manifest.columnOrder, COLUMNS);
  assert.equal(manifest.fieldAtlas.width, 3040);
  assert.equal(manifest.fieldAtlas.height, 2560);
  assert.equal(manifest.triggerAtlas.width, 960);
  assert.equal(manifest.triggerAtlas.height, 2560);
  assert.equal(manifest.frames.length, 1216);
  assert.equal(manifest.triggerFrames.length, 384);
  assert.equal(manifest.validation.fieldBinaryAlpha, true);
  assert.equal(manifest.validation.triggerBinaryAlpha, true);
  assert.ok(manifest.validation.maximumVisibleColorsPerFieldFrame <= 56);
  assert.ok(manifest.validation.maximumVisibleColorsPerTriggerFrame <= 56);
  assert.equal(manifest.sources.filter(({ boardId }) => boardId).length, 8);

  for (const frame of [...manifest.frames, ...manifest.triggerFrames]) {
    assert.deepEqual(frame.pivot, [40, 77]);
    assert.deepEqual(frame.footPoint, [40, 77]);
    assert.ok(frame.alphaBounds[0] >= 2 && frame.alphaBounds[1] >= 2, frame.id);
    assert.ok(frame.alphaBounds[2] <= 78 && frame.alphaBounds[3] <= 78, frame.id);
    assert.ok(frame.visibleColorCount <= 56, frame.id);
    assert.ok(frame.opaquePixelCount > 100, frame.id);
  }

  for (const assetId of manifest.rowOrder) {
    for (const direction of DIRECTIONS) {
      const hashes = PHASES.map((phase) => manifest.frames.find(({ assetId: current, state }) => (
        current === assetId && state === `${direction}-${phase}`
      )).rgbaSha256);
      assert.equal(hashes.length, 8);
      assert.ok(new Set(hashes).size >= 5, `${assetId}:${direction}`);
    }
  }
});

test('enemy v3 runtime atlases are byte-identical to production and manifest hashes', async () => {
  const [manifestText, fieldProduction, fieldRuntime, triggerProduction, triggerRuntime] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'enemy-field-atlas-v3.png')),
    readFile(resolve(GAME_ROOT, 'assets', 'art', 'enemy-field-suite-v3', 'enemy-field-atlas-v3.png')),
    readFile(resolve(SUITE_ROOT, 'enemy-encounter-trigger-atlas-v3.png')),
    readFile(resolve(GAME_ROOT, 'assets', 'art', 'enemy-field-suite-v3', 'enemy-encounter-trigger-atlas-v3.png')),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(fieldProduction.equals(fieldRuntime), true);
  assert.equal(triggerProduction.equals(triggerRuntime), true);
  assert.equal(sha256(fieldProduction), manifest.fieldAtlas.sha256);
  assert.equal(sha256(triggerProduction), manifest.triggerAtlas.sha256);
  assert.deepEqual(
    [fieldProduction.readUInt32BE(16), fieldProduction.readUInt32BE(20)],
    [3040, 2560],
  );
  assert.deepEqual(
    [triggerProduction.readUInt32BE(16), triggerProduction.readUInt32BE(20)],
    [960, 2560],
  );
});

test('campaign and isolated trigger runtime select enemy v3 without storage authority', async () => {
  const [campaign, fieldModule, triggerModule] = await Promise.all([
    readFile(resolve(GAME_ROOT, 'campaign.js'), 'utf8'),
    readFile(resolve(GAME_ROOT, 'combat-character-field-atlas.mjs'), 'utf8'),
    readFile(resolve(GAME_ROOT, 'roster-animation-atlas.mjs'), 'utf8'),
  ]);
  assert.match(fieldModule, /enemy-field-suite-v3\/enemy-field-atlas-v3\.png/u);
  assert.match(fieldModule, /columns: 38,[\s\S]*width: 3040,[\s\S]*height: 2560/u);
  assert.match(fieldModule, /COMBAT_CHARACTER_FIELD_WALK_PHASES[\s\S]*contact-b[\s\S]*extension-b/u);
  assert.match(campaign, /drawEnemyFieldMarker\(enemy, position, partyPosition/u);
  assert.match(triggerModule, /enemy-field-suite-v3\/enemy-encounter-trigger-atlas-v3\.png/u);
  assert.match(triggerModule, /canonicalMutation: false/u);
  assert.doesNotMatch(triggerModule, /localStorage|sessionStorage|campaign.*settle/iu);
});
