import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(GAME_ROOT, '..');
const SUITE_ROOT = resolve(REPO_ROOT, 'assets', 'art', 'party-portrait-suite-v2');
const RUNTIME_PATH = resolve(
  GAME_ROOT,
  'assets',
  'art',
  'party-portrait-suite-v2',
  'party-portrait-expressions-v2.png',
);
const ROWS = ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku', 'miyo'];
const COLUMNS = [
  'neutral',
  'resolve',
  'strain',
  'soften',
  'concern',
  'anger',
  'surprise',
  'quiet',
];


function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}


function pngDimensions(bytes) {
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}


test('portrait v2 contract preserves exact geometry, identity order, and honest provenance', async () => {
  const source = JSON.parse(await readFile(
    resolve(SUITE_ROOT, 'party-portrait-suite-v2.source.json'),
    'utf8',
  ));
  assert.equal(source.assetId, 'party-portrait-expression-suite-v2');
  assert.equal(source.provenance.sourceClassification, 'ai-generated-pixel-styled-expression-sheets');
  assert.equal(
    source.provenance.runtimeClassification,
    'deterministically-pixelified-raster-derivative',
  );
  assert.match(source.provenance.claim, /neither is hand-pixeled or pixel-authored/u);
  assert.deepEqual(source.frame, {
    width: 96,
    height: 96,
    minimumTransparentGutter: 2,
    visiblePaletteLimit: 64,
    alphaPolicy: 'binary',
  });
  assert.deepEqual(source.atlas, {
    width: 768,
    height: 672,
    columns: 8,
    rows: 7,
  });
  assert.deepEqual(source.sheet.rows, ROWS);
  assert.deepEqual(source.sheet.columns, COLUMNS);
  assert.deepEqual(source.characters.map(({ id }) => id), ROWS);
  assert.equal(source.characters.find(({ id }) => id === 'lise').name, 'Nikola Dražanić');
  assert.equal(source.characters.find(({ id }) => id === 'mateus').name, 'Father Mateus Avelar');
  assert.doesNotMatch(JSON.stringify(source), /Adam Driver|celebrity likeness/iu);
});


test('portrait v2 atlas and browser copy are exact, manifested, and fully distinct', async () => {
  const [manifestText, atlasBytes, runtimeBytes, runtimeModule] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'party-portrait-expressions-v2.png')),
    readFile(RUNTIME_PATH),
    readFile(resolve(GAME_ROOT, 'party-portrait-atlas.mjs'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.deepEqual(pngDimensions(atlasBytes), { width: 768, height: 672 });
  assert.equal(runtimeBytes.equals(atlasBytes), true);
  const runtimeExport = manifest.exports.find(({ role }) => role === 'transparent-runtime-candidate');
  assert.equal(runtimeExport.sha256, sha256(atlasBytes));
  assert.deepEqual(
    [runtimeExport.width, runtimeExport.height, runtimeExport.mode],
    [768, 672, 'RGBA'],
  );
  assert.equal(manifest.frames.length, 56);
  assert.equal(new Set(manifest.frames.map(({ rgbaSha256 }) => rgbaSha256)).size, 56);
  assert.equal(manifest.validation.frameCount, 56);
  assert.equal(manifest.validation.distinctRgbaFrameHashes, 56);
  assert.equal(manifest.validation.binaryTransparency, true);
  assert.ok(manifest.validation.minimumObservedGutter >= 2);
  assert.ok(manifest.palette.actualVisibleColors <= 64);
  assert.deepEqual(manifest.alpha.values, [0, 255]);
  assert.equal(
    manifest.sources.filter(({ role }) => (
      role === 'ai-generated-expression-source-with-chroma-removed'
    )).length,
    7,
  );
  assert.match(
    runtimeModule,
    /assets\/art\/party-portrait-suite-v2\/party-portrait-expressions-v2\.png/u,
  );
});
