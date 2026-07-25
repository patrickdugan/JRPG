import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUITE_ROOT = resolve(GAME_ROOT, '..', 'assets', 'art', 'party-field-suite-v2');
const ROWS = ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku', 'miyo'];
const DIRECTIONS = ['north', 'east', 'south', 'west'];
const PHASES = ['contact', 'compression', 'passing', 'extension'];
const COLUMNS = DIRECTIONS.flatMap((direction) => [
  `${direction}-idle`,
  ...PHASES.map((phase) => `${direction}-${phase}`),
]).concat(['south-interact', 'south-hurt']);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('v2 source declares native production pixels and treats side art as reference only', async () => {
  const source = JSON.parse(await readFile(resolve(SUITE_ROOT, 'party-field-suite-v2.source.json'), 'utf8'));
  assert.equal(source.classification, 'pixel-authored-production-asset');
  assert.equal(source.authorship, 'original-code-native-pixel-primitives');
  assert.match(source.referencePolicy, /not sampled, scaled, traced, or composited/u);
  assert.deepEqual(source.frame, {
    width: 40,
    height: 56,
    pivot: [20, 52],
    footPoint: [20, 52],
    transparentGutter: 1,
    alphaPolicy: 'binary',
  });
  assert.deepEqual(source.rows, ROWS);
  assert.deepEqual(source.columns, COLUMNS);
  assert.deepEqual(source.walkPhases, PHASES);
  assert.equal(source.characters.length, 7);
  assert.equal(source.characters.find(({ id }) => id === 'lise').name, 'Nikola Dražanić');
  assert.match(source.characters.find(({ id }) => id === 'mateus').detail, /cross remains concealed/u);
});

test('v2 manifest covers 154 unique bounded frames with exact pivots and timing', async () => {
  const manifest = JSON.parse(await readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'));
  assert.equal(manifest.classification, 'pixel-authored-production-asset');
  assert.deepEqual(manifest.rowOrder, ROWS);
  assert.deepEqual(manifest.columnOrder, COLUMNS);
  assert.deepEqual(manifest.geometry, {
    frameWidth: 40,
    frameHeight: 56,
    columns: 22,
    rows: 7,
    sheetWidth: 880,
    sheetHeight: 392,
    pivot: [20, 52],
    footPoint: [20, 52],
    transparentGutter: 1,
    alphaBounds: [5, 4, 878, 388],
  });
  assert.equal(manifest.frames.length, 154);
  assert.equal(manifest.validation.binaryAlpha, true);
  assert.equal(manifest.validation.actualMaximumVisibleColorsPerFrame <= 20, true);
  assert.equal(manifest.validation.allFramesUnique, true);
  assert.equal(manifest.validation.uniqueFrameHashes, 154);
  assert.equal(manifest.sources.find(({ role }) => role === 'visual-quality-reference-not-raster-input').rasterSampled, false);

  manifest.frames.forEach((frame, index) => {
    const row = Math.floor(index / COLUMNS.length);
    const column = index % COLUMNS.length;
    assert.equal(frame.characterId, ROWS[row]);
    assert.deepEqual(frame.rect, [column * 40, row * 56, 40, 56]);
    assert.deepEqual(frame.pivot, [20, 52]);
    assert.deepEqual(frame.footPoint, [20, 52]);
    assert.ok(frame.alphaBounds[0] >= 1 && frame.alphaBounds[1] >= 1);
    assert.ok(frame.alphaBounds[2] <= 39 && frame.alphaBounds[3] <= 53);
    assert.ok(frame.visibleColorCount <= 20);
    assert.ok(frame.opaquePixelCount > 100);
    if (PHASES.includes(frame.state)) assert.equal(frame.durationMs, 80);
  });
});

test('v2 runtime atlas is byte-identical to the production export and matches manifest hashes', async () => {
  const [manifestText, production, runtime] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'party-field-atlas-v2.png')),
    readFile(resolve(GAME_ROOT, 'assets', 'art', 'party-field-suite-v2', 'party-field-atlas-v2.png')),
  ]);
  const manifest = JSON.parse(manifestText);
  const record = manifest.exports.find(({ purpose }) => purpose === 'transparent-runtime-atlas');
  assert.equal(production.equals(runtime), true);
  assert.equal(sha256(production), record.sha256);
  assert.deepEqual([production.readUInt32BE(16), production.readUInt32BE(20)], [880, 392]);
});

test('v2 remains a reproducible archived package after the browser moves to v3', async () => {
  const source = await readFile(resolve(GAME_ROOT, 'sprite-atlas.mjs'), 'utf8');
  assert.doesNotMatch(source, /url: '\.\/assets\/art\/party-field-suite-v2\//u);
  assert.match(source, /url: '\.\/assets\/art\/party-field-suite-v3\/party-field-atlas-v3\.png'/u);
});
