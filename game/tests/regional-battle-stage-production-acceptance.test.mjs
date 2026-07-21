import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEVELS } from '../content/levels.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUITE_DIR = join(REPO_ROOT, 'assets', 'art', 'regional-battle-stages');
const read = (name) => readFileSync(join(SUITE_DIR, name));
const source = JSON.parse(read('regional-battle-stages.source.json'));
const manifest = JSON.parse(read('manifest.json'));
const builder = read('build_regional_battle_stages.py').toString('utf8');
const digest = (value) => createHash('sha256').update(value).digest('hex');

const EXPECTED_IDS = [
  'hsh-census-square', 'c1-flooded-cedars', 'fp1-wet-cedar-stage',
  'c1-tax-storehouse', 'fp1-flooded-archive-stage', 'hsh-prison-ferry', 'hsh-bell-aqueduct',
  'sdg-rain-docks', 'sdg-salt-warehouse', 'ngi-tide-caves', 'ngi-storm-reef',
  'kgr-ash-fields', 'kgr-archive-furnace',
  'kzu-archive-roof', 'kzu-public-tribunal', 'c8-black-gate', 'krh-outer-archive', 'krh-observatory',
];

function pngIhdr(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
    compression: bytes[26],
    filter: bytes[27],
    interlace: bytes[28],
  };
}

function liveSnapshot(level) {
  return {
    id: level.id,
    chapterId: level.chapterId,
    name: level.name,
    width: level.width,
    height: level.height,
    spacePx: level.spacePx,
    paletteId: level.palette.id,
    blocked: [...(level.blocked ?? [])],
    terrain: (level.terrain ?? []).map(({ at, tag }) => ({ at, tag })),
    specialCells: {
      exits: (level.exits ?? []).map(({ id, at }) => ({ id, at })),
      interactables: (level.interactables ?? []).filter(({ at }) => at).map(({ id, at }) => ({ id, at })),
      hazards: (level.hazards ?? []).map(({ id, tiles = [] }) => ({ id, tiles: [...tiles] })),
      spawn: level.spawn ? { x: level.spawn.x, y: level.spawn.y } : null,
    },
  };
}

function sourceSnapshot(board) {
  return {
    id: board.id,
    chapterId: board.chapterId,
    name: board.name,
    width: board.width,
    height: board.height,
    spacePx: board.spacePx,
    paletteId: board.paletteId,
    blocked: board.blocked,
    terrain: board.terrain,
    specialCells: board.specialCells,
  };
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

test('regional stage builder check is non-writing and byte exact on repeated runs', () => {
  const before = new Map(manifest.exports.map(({ path }) => [path, digest(read(path))]));
  for (let pass = 0; pass < 2; pass += 1) {
    const output = execFileSync('python', ['build_regional_battle_stages.py', '--check'], {
      cwd: SUITE_DIR,
      encoding: 'utf8',
    });
    assert.match(output, /"ok":true/);
    assert.match(output, /"mode":"check"/);
  }
  for (const [path, hash] of before) assert.equal(digest(read(path)), hash, `${path} changed during --check`);
  assert.equal(manifest.validation.twoIndependentRendersByteIdentical, true);
});

test('source snapshots exactly cover every live battle board not owned by Takamine', () => {
  const uncovered = LEVELS.filter(({ kind, id }) => kind === 'battle' && id !== 'tkm-bell-chamber');
  assert.equal(uncovered.length, 18);
  assert.deepEqual(source.boards.map(({ id }) => id), EXPECTED_IDS);
  assert.deepEqual(new Set(source.boards.map(({ id }) => id)), new Set(uncovered.map(({ id }) => id)));
  assert.equal(new Set(source.boards.map(({ style }) => style)).size, 18);

  for (const board of source.boards) {
    const level = uncovered.find(({ id }) => id === board.id);
    assert.ok(level, `${board.id} must remain a live uncovered battle level`);
    assert.deepEqual(sourceSnapshot(board), liveSnapshot(level), `${board.id} source snapshot drifted from live data`);
    const record = manifest.boards.find(({ id }) => id === board.id);
    assert.deepEqual(record.snapshot, liveSnapshot(level), `${board.id} manifest snapshot drifted from live data`);
    assert.equal(record.occupancySha256, digest(Buffer.from(canonical(liveSnapshot(level)))));
  }
});

test('five exact material kits own 3/4/4/2/5 distinct board exports', () => {
  const expected = [
    ['rain-v01', 'takamine-rain', 3],
    ['archive-v01', 'archive-indigo', 4],
    ['coast-v01', 'coast-fog', 4],
    ['ash-v01', 'kagura-ash', 2],
    ['court-v01', 'court-vermilion', 5],
  ];
  assert.deepEqual(source.kits.map(({ id, paletteId }) => [id, paletteId, source.boards.filter(({ kitId }) => kitId === id).length]), expected);
  assert.deepEqual(manifest.kits.map(({ id, paletteId, boardIds }) => [id, paletteId, boardIds.length]), expected);
  assert.equal(new Set(manifest.exports.filter(({ runtimeCandidate }) => runtimeCandidate).map(({ sha256 }) => sha256)).size, 18);
});

test('all 18 board PNGs are exact distinct 384x224 RGBA exports with truthful hashes and IHDR', () => {
  const exports = manifest.exports.filter(({ runtimeCandidate }) => runtimeCandidate);
  assert.equal(exports.length, 18);
  assert.deepEqual(exports.map(({ boardId }) => boardId), EXPECTED_IDS);
  for (const record of exports) {
    const bytes = read(record.path);
    assert.equal(digest(bytes), record.sha256);
    assert.deepEqual(pngIhdr(bytes), record.ihdr);
    assert.deepEqual(record.ihdr, {
      width: 384,
      height: 224,
      bitDepth: 8,
      colorType: 6,
      compression: 0,
      filter: 0,
      interlace: 0,
    });
  }
  assert.equal(manifest.validation.distinctBoardHashes, 18);
  assert.equal(manifest.validation.allBoardsOpaque, true);
});

test('module and labeled contact sheets keep their exact non-runtime review dimensions', () => {
  const moduleRecord = manifest.exports.find(({ id }) => id === 'regional-module-sheet');
  const contactRecord = manifest.exports.find(({ id }) => id === 'labeled-contact-sheet');
  assert.equal(moduleRecord.runtimeCandidate, false);
  assert.equal(contactRecord.runtimeCandidate, false);
  for (const record of [moduleRecord, contactRecord]) {
    const bytes = read(record.path);
    assert.equal(digest(bytes), record.sha256);
    assert.deepEqual(pngIhdr(bytes), record.ihdr);
  }
  assert.deepEqual([moduleRecord.ihdr.width, moduleRecord.ihdr.height], [640, 128]);
  assert.deepEqual([contactRecord.ihdr.width, contactRecord.ihdr.height], [768, 640]);
});

test('production policy and drawing path exclude live rule-layer and authentic-symbol content', () => {
  for (const key of ['bakeTelegraphs', 'bakeActors', 'bakeObjectives', 'bakeInteractableIcons', 'authenticReligiousSymbols', 'authenticHeraldicSymbols']) {
    assert.equal(source.renderPolicy[key], false, `${key} must remain false`);
    assert.equal(manifest.renderPolicy[key], false, `${key} manifest value must remain false`);
  }
  assert.equal(source.renderPolicy.bakeVictimFixtures, true);
  assert.equal(manifest.renderPolicy.bakeVictimFixtures, true);
  assert.equal(manifest.validation.kurohanaVictimFixtureCount, 42);
  assert.deepEqual(
    manifest.boards.filter(({ victimFixtureCount }) => victimFixtureCount > 0).map(({ id, victimFixtureCount }) => [id, victimFixtureCount]),
    [['c8-black-gate', 14], ['krh-outer-archive', 14], ['krh-observatory', 14]],
  );
  const renderStart = builder.indexOf('def render_board(');
  const renderEnd = builder.indexOf('\ndef render_module_sheet(', renderStart);
  assert.ok(renderStart >= 0 && renderEnd > renderStart);
  const renderBoard = builder.slice(renderStart, renderEnd);
  assert.doesNotMatch(renderBoard, /specialCells|hazards|interactables|spawn|objectives|telegraphs|actors/);
  assert.match(manifest.review.visualContactSheetReview, /^passed-/);
  assert.equal(manifest.review.externalCulturalReview, 'pending');
  assert.equal(manifest.review.artLock, false);
});
