import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUITE_ROOT = resolve(GAME_ROOT, '..', 'assets', 'art', 'party-field-suite-v3');
const ROWS = ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku', 'miyo'];
const DIRECTIONS = ['north', 'east', 'south', 'west'];
const PHASES = [
  'contact-a', 'compression-a', 'passing-a', 'extension-a',
  'contact-b', 'compression-b', 'passing-b', 'extension-b',
];
const COLUMNS = DIRECTIONS.flatMap((direction) => [
  `${direction}-idle`,
  ...PHASES.map((phase) => `${direction}-${phase}`),
]).concat(['south-interact', 'south-hurt']);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('v3 reports generated masters and deterministic pixelification without false authorship claims', async () => {
  const source = JSON.parse(await readFile(resolve(SUITE_ROOT, 'party-field-suite-v3.source.json'), 'utf8'));
  assert.equal(source.classification, 'deterministically-pixelified');
  assert.equal(source.sourceClassification, 'AI-generated pixel-styled concept');
  assert.match(source.qualityTarget, /late-1990s PlayStation JRPG/u);
  assert.deepEqual(source.frame, {
    width: 64,
    height: 80,
    pivot: [32, 77],
    footPoint: [32, 77],
    transparentGutter: 2,
    alphaPolicy: 'binary',
  });
  assert.deepEqual(source.rows, ROWS);
  assert.deepEqual(source.walkPhases, PHASES);
  assert.equal(source.conversion.resampling, 'BOX');
  assert.equal(source.conversion.paletteCeilingPerCharacter, 48);
  assert.equal(source.conversion.dither, 'none');
  assert.equal(source.characters.length, 7);
  assert.equal(source.characters.find(({ id }) => id === 'lise').name, 'Nikola Dražanić');
});

test('v3 manifest covers 266 unique bounded frames with exact pivots and eight-phase timing', async () => {
  const manifest = JSON.parse(await readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'));
  assert.equal(manifest.classification, 'deterministically-pixelified');
  assert.equal(manifest.sourceClassification, 'AI-generated pixel-styled concept');
  assert.deepEqual(manifest.rowOrder, ROWS);
  assert.deepEqual(manifest.columnOrder, COLUMNS);
  assert.deepEqual(manifest.geometry, {
    frameWidth: 64,
    frameHeight: 80,
    columns: 38,
    rows: 7,
    sheetWidth: 2432,
    sheetHeight: 560,
    pivot: [32, 77],
    footPoint: [32, 77],
    transparentGutter: 2,
    alphaBounds: manifest.geometry.alphaBounds,
  });
  assert.equal(manifest.frames.length, 266);
  assert.equal(manifest.validation.frameCount, 266);
  assert.equal(manifest.validation.binaryAlpha, true);
  assert.equal(manifest.validation.actualMaximumVisibleColorsPerFrame <= 52, true);
  assert.equal(manifest.validation.allFramesUnique, true);
  assert.equal(manifest.validation.uniqueFrameHashes, 266);
  assert.equal(manifest.sources.filter(({ classification }) => classification === 'AI-generated pixel-styled concept').length, 8);

  manifest.frames.forEach((frame, index) => {
    const row = Math.floor(index / COLUMNS.length);
    const column = index % COLUMNS.length;
    assert.equal(frame.characterId, ROWS[row]);
    assert.deepEqual(frame.rect, [column * 64, row * 80, 64, 80]);
    assert.deepEqual(frame.pivot, [32, 77]);
    assert.deepEqual(frame.footPoint, [32, 77]);
    assert.ok(frame.alphaBounds[0] >= 2 && frame.alphaBounds[1] >= 2);
    assert.ok(frame.alphaBounds[2] <= 62 && frame.alphaBounds[3] <= 78);
    assert.ok(frame.visibleColorCount <= 52);
    assert.ok(frame.opaquePixelCount > 150);
    if (PHASES.includes(frame.state)) assert.equal(frame.durationMs, 40);
  });
});

test('v3 runtime atlas is byte-identical to the production export and its manifest hash', async () => {
  const [manifestText, production, runtime] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'party-field-atlas-v3.png')),
    readFile(resolve(GAME_ROOT, 'assets', 'art', 'party-field-suite-v3', 'party-field-atlas-v3.png')),
  ]);
  const manifest = JSON.parse(manifestText);
  const record = manifest.exports.find(({ purpose }) => purpose === 'transparent-runtime-atlas');
  assert.equal(production.equals(runtime), true);
  assert.equal(sha256(production), record.sha256);
  assert.deepEqual([production.readUInt32BE(16), production.readUInt32BE(20)], [2432, 560]);
});

test('browser runtime selects v3 and samples all eight movement phases', async () => {
  const source = await readFile(resolve(GAME_ROOT, 'sprite-atlas.mjs'), 'utf8');
  assert.match(source, /party-field-suite-v3\/party-field-atlas-v3\.png/u);
  assert.match(source, /width: 2432,[\s\S]*height: 560,[\s\S]*columns: 38/u);
  assert.match(source, /walkFrameDurationMs: 40,[\s\S]*walkFrameCount: 8/u);
  assert.match(source, /north: Object\.freeze\(\[1, 2, 3, 4, 5, 6, 7, 8\]\)/u);
  assert.match(source, /const FIELD_POSE_COLUMN = Object\.freeze\(\{ interact: 36, hurt: 37 \}\)/u);
});
