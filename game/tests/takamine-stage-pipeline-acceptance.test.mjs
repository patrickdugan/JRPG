import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getEncounter } from '../content/encounters.mjs';
import { getLevel } from '../content/levels.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STAGE_DIR = resolve(REPO_ROOT, 'assets', 'art', 'takamine-bell-chamber');
const MANIFEST_PATH = resolve(STAGE_DIR, 'manifest.json');
const EXPECTED_GEOMETRY = Object.freeze({
  width: 384,
  height: 224,
  columns: 12,
  rows: 7,
  cellSize: 32,
  coordinateOrigin: 'top-left',
});
const EXPECTED_BLOCKED = Object.freeze([
  '0,0', '1,0', '2,0', '9,0', '10,0', '11,0',
  '0,6', '1,6', '2,6', '9,6', '10,6', '11,6',
  '5,2', '6,2', '5,3', '6,3',
]);
const EXPECTED_REGISTRY_FOOTPRINT = Object.freeze(['5,2', '6,2', '5,3', '6,3']);
const EXPECTED_SPECIAL_CELLS = Object.freeze({
  highGallery: ['0,2', '0,3', '0,4'],
  bloodWardNodes: ['5,1', '6,5'],
  dryLanternFooting: ['3,1', '3,5'],
  partyDeployment: ['2,3', '2,4', '3,3'],
  mateusDeployment: ['9,3'],
  postSurrenderExit: ['11,3'],
});
const FORBIDDEN_PRODUCTION_LABEL = /\b(?:authentic|sacred|devotional|religious|temple|shrine|torii|ofuda|gohei|shimenawa|buddhist?|bonsh[oō]|lotus|sutra|mandala|vajra|chrysanthemum|tokugawa|hollyhock|imperial\s+crest|clan\s+mon|crucifix)\b/i;

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function loadStageContract() {
  const manifest = await readJson(MANIFEST_PATH);
  const canonicalSourcePath = safeStagePath(manifest.canonicalSource, 'canonicalSource');
  const source = await readJson(canonicalSourcePath);
  return { manifest, source, canonicalSourcePath };
}

function safeStagePath(candidate, label) {
  assert.equal(typeof candidate, 'string', `${label} must be a relative path string`);
  assert.equal(isAbsolute(candidate), false, `${label} must not be absolute`);
  const path = resolve(STAGE_DIR, candidate);
  const fromStage = relative(STAGE_DIR, path);
  assert.equal(fromStage === '..' || fromStage.startsWith(`..${sep}`), false, `${label} must stay inside the stage directory`);
  return path;
}

function normalizedTiles(value, label, geometry = EXPECTED_GEOMETRY) {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  const seen = new Set();
  for (const tile of value) {
    assert.match(tile, /^(?:0|[1-9]\d*),(?:0|[1-9]\d*)$/, `${label} has a malformed tile: ${tile}`);
    const [x, y] = tile.split(',').map(Number);
    assert.ok(x >= 0 && x < geometry.columns, `${label} x is outside the board: ${tile}`);
    assert.ok(y >= 0 && y < geometry.rows, `${label} y is outside the board: ${tile}`);
    assert.equal(seen.has(tile), false, `${label} repeats ${tile}`);
    seen.add(tile);
  }
  return [...seen].sort((left, right) => {
    const [lx, ly] = left.split(',').map(Number);
    const [rx, ry] = right.split(',').map(Number);
    return ly - ry || lx - rx;
  });
}

function assertExactTiles(actual, expected, label) {
  assert.deepEqual(normalizedTiles(actual, label), normalizedTiles(expected, `${label} expected`), label);
}

function requiredGeometryFields(geometry) {
  return Object.fromEntries(Object.keys(EXPECTED_GEOMETRY).map((key) => [key, geometry?.[key]]));
}

function recordId(record) {
  return typeof record === 'string' ? record : record?.id;
}

function collectProductionLabels(value, location = 'root', found = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectProductionLabels(entry, `${location}[${index}]`, found));
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  for (const [key, entry] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    if (/^(?:label|name|title)$/i.test(key) && typeof entry === 'string') found.push({ location: childLocation, value: entry });
    collectProductionLabels(entry, childLocation, found);
  }
  return found;
}

function readPngIhdr(buffer, label) {
  assert.ok(buffer.length >= 33, `${label} is too short to contain a PNG IHDR`);
  assert.equal(buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), true, `${label} has an invalid PNG signature`);
  assert.equal(buffer.readUInt32BE(8), 13, `${label} must begin with a 13-byte IHDR`);
  assert.equal(buffer.toString('ascii', 12, 16), 'IHDR', `${label} first chunk must be IHDR`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
    compression: buffer[26],
    filter: buffer[27],
    interlace: buffer[28],
  };
}

async function assertFileRecord(record, collectionName) {
  assert.ok(record && typeof record === 'object', `${collectionName} entries must be objects`);
  assert.match(record.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${collectionName} id must be stable kebab-case`);
  const path = safeStagePath(record.path, `${collectionName}.${record.id}.path`);
  const file = await readFile(path);
  assert.ok(file.length > 0, `${record.path} must not be empty`);
  assert.match(record.sha256, /^[a-f\d]{64}$/i, `${record.path} must declare a SHA-256 hash`);
  assert.equal(createHash('sha256').update(file).digest('hex'), record.sha256.toLowerCase(), `${record.path} hash drifted from manifest`);

  if (String(record.format).toLowerCase() === 'png') {
    const ihdr = readPngIhdr(file, record.path);
    assert.equal(ihdr.width, record.width, `${record.path} IHDR width must match manifest`);
    assert.equal(ihdr.height, record.height, `${record.path} IHDR height must match manifest`);
    assert.equal(ihdr.bitDepth, 8, `${record.path} must use an 8-bit PNG channel depth`);
    assert.ok([2, 3, 6].includes(ihdr.colorType), `${record.path} must be RGB, indexed, or RGBA PNG data`);
    assert.equal(ihdr.compression, 0, `${record.path} uses an unsupported PNG compression method`);
    assert.equal(ihdr.filter, 0, `${record.path} uses an unsupported PNG filter method`);
    assert.ok([0, 1].includes(ihdr.interlace), `${record.path} has an invalid PNG interlace method`);
  }
  return { path, file };
}

test('Takamine manifest and canonical layered source lock the exact 12x7 at 32px contract', async () => {
  const { manifest, source, canonicalSourcePath } = await loadStageContract();

  assert.equal(manifest.assetId, 'tkm-bell-chamber');
  assert.equal(typeof manifest.status, 'string');
  assert.doesNotMatch(manifest.status, /concept/i, 'manifest must describe authored production material, not generated concept authority');
  assert.deepEqual(requiredGeometryFields(manifest.geometry), EXPECTED_GEOMETRY);
  assert.deepEqual(requiredGeometryFields(source.geometry), EXPECTED_GEOMETRY);
  assert.equal(EXPECTED_GEOMETRY.width, EXPECTED_GEOMETRY.columns * EXPECTED_GEOMETRY.cellSize);
  assert.equal(EXPECTED_GEOMETRY.height, EXPECTED_GEOMETRY.rows * EXPECTED_GEOMETRY.cellSize);
  assert.equal(canonicalSourcePath, resolve(STAGE_DIR, 'takamine-bell-chamber.source.json'));
  await stat(safeStagePath(manifest.builder, 'builder'));

  assert.ok(Array.isArray(manifest.sources) && manifest.sources.length > 0, 'manifest must enumerate authoritative sources');
  assert.ok(Array.isArray(manifest.exports) && manifest.exports.length > 0, 'manifest must enumerate generated exports');
  const sourcePaths = manifest.sources.map((record) => record.path);
  assert.ok(sourcePaths.includes(manifest.canonicalSource), 'canonicalSource must be covered by the source hash contract');
});

test('manifest occupancy and special cells agree exactly with live level and encounter authority', async () => {
  const { manifest, source } = await loadStageContract();
  const level = getLevel('tkm-bell-chamber');
  const encounter = getEncounter('fp1-mateus');
  assert.ok(level);
  assert.ok(encounter);
  assert.equal(encounter.levelId, level.id);

  assertExactTiles(manifest.occupancy.blocked, EXPECTED_BLOCKED, 'manifest blocked cells');
  assertExactTiles(manifest.occupancy.registryFootprint, EXPECTED_REGISTRY_FOOTPRINT, 'manifest registry footprint');
  assert.equal(manifest.occupancy.registryFootprint.every((tile) => manifest.occupancy.blocked.includes(tile)), true, 'registry footprint must be a named subset of blocked occupancy');
  assertExactTiles(manifest.occupancy.blocked, level.blocked, 'manifest blocked occupancy versus live level');
  assertExactTiles(source.occupancy.blocked, manifest.occupancy.blocked, 'source blocked cells versus manifest');
  assertExactTiles(source.occupancy.registryFootprint, manifest.occupancy.registryFootprint, 'source registry footprint versus manifest');

  const liveSpecialCells = {
    highGallery: level.terrain.filter(({ tag }) => tag === 'high-gallery').map(({ at }) => at),
    bloodWardNodes: level.terrain.filter(({ tag }) => tag === 'bell-node').map(({ at }) => at),
    dryLanternFooting: level.terrain.filter(({ tag }) => tag === 'dry-lantern').map(({ at }) => at),
    partyDeployment: encounter.party.deployment.map(({ at }) => at),
    mateusDeployment: encounter.enemies.find(({ id }) => id === 'mateus').positions,
    postSurrenderExit: level.exits.filter(({ id }) => id === 'cell-block-door').map(({ at }) => at),
  };
  for (const [id, expected] of Object.entries(EXPECTED_SPECIAL_CELLS)) {
    assertExactTiles(manifest.specialCells[id], expected, `manifest ${id}`);
    assertExactTiles(manifest.specialCells[id], liveSpecialCells[id], `manifest ${id} versus live data`);
    assertExactTiles(source.specialCells[id], manifest.specialCells[id], `source ${id} versus manifest`);
  }
});

test('source and export files are confined, nonempty, hash-locked, and PNG dimensions come from IHDR', async () => {
  const { manifest } = await loadStageContract();
  const records = [...manifest.sources, ...manifest.exports];
  assert.equal(new Set(records.map(({ path }) => path)).size, records.length, 'manifest must not repeat source/export paths');
  assert.equal(new Set(records.map(({ id }) => id)).size, records.length, 'manifest source/export ids must be globally unique');

  for (const source of manifest.sources) await assertFileRecord(source, 'sources');
  for (const output of manifest.exports) await assertFileRecord(output, 'exports');

  const boardPng = manifest.exports.find(({ path, format }) => path === 'takamine-bell-chamber-board.png' && String(format).toLowerCase() === 'png');
  assert.ok(boardPng, 'manifest must expose the stable takamine-bell-chamber-board.png export');
  assert.equal(boardPng.width, EXPECTED_GEOMETRY.width);
  assert.equal(boardPng.height, EXPECTED_GEOMETRY.height);
  const boardFile = await readFile(safeStagePath(boardPng.path, 'board PNG'));
  assert.deepEqual(readPngIhdr(boardFile, boardPng.path), {
    width: 384,
    height: 224,
    bitDepth: 8,
    colorType: readPngIhdr(boardFile, boardPng.path).colorType,
    compression: 0,
    filter: 0,
    interlace: readPngIhdr(boardFile, boardPng.path).interlace,
  });
});

test('manifest and canonical source preserve one explicit, unique layer order', async () => {
  const { manifest, source } = await loadStageContract();
  assert.ok(Array.isArray(manifest.layers) && manifest.layers.length >= 3, 'manifest needs an explicit multi-layer composition order');
  assert.ok(Array.isArray(source.layers), 'canonical source must retain editable layers');
  const manifestIds = manifest.layers.map(recordId);
  const sourceIds = source.layers.map(recordId);
  assert.equal(manifestIds.every(Boolean), true, 'every manifest layer needs an id');
  assert.equal(new Set(manifestIds).size, manifestIds.length, 'manifest layer ids must be unique');
  assert.deepEqual(sourceIds, manifestIds, 'source layer order must match the manifest exactly');

  for (const [index, layer] of manifest.layers.entries()) {
    if (typeof layer === 'object' && Object.hasOwn(layer, 'order')) assert.equal(layer.order, index, `${layer.id} order must match its array position`);
  }
  for (const [index, layer] of source.layers.entries()) {
    if (typeof layer === 'object' && Object.hasOwn(layer, 'order')) assert.equal(layer.order, index, `${layer.id} source order must match its array position`);
  }
});

test('production labels avoid claims or names that borrow authentic sacred and heraldic material', async () => {
  const { manifest, source } = await loadStageContract();
  const labels = [
    ...collectProductionLabels(manifest, 'manifest'),
    ...collectProductionLabels(source, 'source'),
    ...manifest.layers.map((layer, index) => ({ location: `manifest.layers[${index}]`, value: recordId(layer) })),
    ...source.layers.map((layer, index) => ({ location: `source.layers[${index}]`, value: recordId(layer) })),
  ];
  assert.ok(labels.length > 0, 'stage pipeline must expose reviewable production labels');
  for (const label of labels) {
    assert.doesNotMatch(label.value, FORBIDDEN_PRODUCTION_LABEL, `${label.location} uses a prohibited production label`);
  }
});
