import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ENCOUNTERS } from '../content/encounters.mjs';

const gameRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const suiteDir = join(gameRoot, '..', 'assets', 'art', 'boss-combat-suite');
const read = (name) => readFileSync(join(suiteDir, name));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = JSON.parse(read('boss-combat-suite.source.json'));
const manifest = JSON.parse(read('manifest.json'));
const canonicalFormats = ['boss', 'boss-rescue', 'boss-phase', 'final-boss'];

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

test('boss inventory is derived exhaustively from canonical live encounter formats', () => {
  const live = ENCOUNTERS
    .filter(({ format }) => canonicalFormats.includes(format))
    .map((encounter, row) => ({
      id: encounter.enemies[0].id,
      row,
      encounterId: encounter.id,
      encounterFormat: encounter.format,
    }));
  assert.deepEqual(source.bossInclusionRule.encounterFormats, canonicalFormats);
  assert.deepEqual(
    source.bosses.map(({ id, row, encounterId, encounterFormat }) => ({ id, row, encounterId, encounterFormat })),
    live,
  );
  assert.deepEqual(
    manifest.encounterMappings.map(({ id, row, encounterId, encounterFormat }) => ({ id, row, encounterId, encounterFormat })),
    live,
  );
  assert.equal(new Set(live.map(({ id }) => id)).size, 10);
});

test('boss suite is byte-identical across repeated deterministic checks', () => {
  for (let pass = 0; pass < 2; pass += 1) {
    const output = execFileSync('python', ['build_boss_combat_suite.py', '--check'], {
      cwd: suiteDir,
      encoding: 'utf8',
    });
    assert.match(output, /byte-identical across two clean builds/);
  }
});

test('boss runtime candidate and review sheet have exact manifested PNG contracts', () => {
  assert.deepEqual(manifest.geometry, {
    columns: 6,
    rows: 10,
    cellWidth: 112,
    cellHeight: 128,
    minimumTransparentGutter: 6,
    coordinateOrigin: 'top-left',
  });
  const atlasExport = manifest.exports.find(({ role }) => role === 'transparent-runtime-candidate');
  const contactExport = manifest.exports.find(({ role }) => role === 'labeled-review-contact-sheet');
  const atlas = read(atlasExport.path);
  const runtimeAtlas = readFileSync(join(gameRoot, 'assets', 'art', 'boss-combat-suite', 'boss-combat-atlas.png'));
  const contact = read(contactExport.path);
  assert.equal(atlasExport.runtimeCandidate, true);
  assert.equal(contactExport.runtimeCandidate, false);
  assert.equal(digest(atlas), atlasExport.sha256);
  assert.equal(runtimeAtlas.equals(atlas), true, 'browser and production boss atlases must be byte-identical');
  assert.equal(digest(contact), contactExport.sha256);
  assert.deepEqual(pngIhdr(atlas), atlasExport.ihdr);
  assert.deepEqual(pngIhdr(contact), contactExport.ihdr);
  assert.deepEqual(atlasExport.ihdr, {
    width: 672,
    height: 1280,
    bitDepth: 8,
    colorType: 6,
    compression: 0,
    filter: 0,
    interlace: 0,
  });
  assert.deepEqual([contactExport.ihdr.width, contactExport.ihdr.height, contactExport.ihdr.colorType], [720, 1528, 2]);
  assert.equal(manifest.status, 'integrated-current-browser-boss-priority');
});

test('all ten bosses expose six distinct anchored production frames', () => {
  assert.deepEqual(manifest.poseOrder, ['neutral', 'telegraph', 'active', 'break', 'transition', 'defeat']);
  assert.equal(manifest.frames.length, 60);
  const rects = new Set();
  for (const boss of source.bosses) {
    const frames = manifest.frames.filter(({ bossId }) => boss.id === bossId);
    assert.deepEqual(frames.map(({ pose }) => pose), manifest.poseOrder);
    assert.equal(new Set(frames.map(({ rgbaSha256 }) => rgbaSha256)).size, 6, boss.id);
    for (const [column, frame] of frames.entries()) {
      assert.deepEqual(frame.rect, {
        x: column * 112,
        y: boss.row * 128,
        width: 112,
        height: 128,
      });
      const rect = Object.values(frame.rect).join(',');
      assert.equal(rects.has(rect), false);
      rects.add(rect);
      assert.ok(frame.opaquePixelCount >= 250, `${frame.id}:${frame.opaquePixelCount}`);
      assert.ok(Object.values(frame.transparentGutter).every((value) => value >= 6), frame.id);
      for (const anchorName of ['pivot', 'ground', 'hitAnchor', 'phaseAnchor']) {
        const [x, y] = frame[anchorName];
        assert.equal(Number.isSafeInteger(x) && Number.isSafeInteger(y), true);
        assert.ok(x >= 0 && x < 112 && y >= 0 && y < 128, `${frame.id}:${anchorName}`);
      }
    }
  }
  assert.equal(rects.size, 60);
});

test('boss source enforces original non-gory fictional design guardrails', () => {
  assert.deepEqual(source.safety, {
    gore: false,
    realEmblems: false,
    devotionalProps: false,
    actorLikeness: false,
    construction: 'Invented mechanical, docket, cable, lattice, ash, and fog geometry only.',
  });
  assert.match(source.bosses.find(({ id }) => id === 'mateus').likenessPolicy, /no actor or celebrity likeness/i);
  const productionDesign = source.bosses.map(({ motif, phaseRead }) => `${motif} ${phaseRead}`).join('\n').toLowerCase();
  for (const term of ['crucifix', 'rosary', 'scripture', 'altar', 'torii', 'kamon', 'coat of arms']) {
    assert.equal(productionDesign.includes(term), false, term);
  }
  const builder = read('build_boss_combat_suite.py').toString('utf8');
  assert.doesNotMatch(builder, /assets[\\/](?:production|concepts)/iu);
  assert.doesNotMatch(builder, /Adam Driver|celebrity likeness/iu);
  for (const entry of manifest.sources) assert.equal(digest(read(entry.path)), entry.sha256);
});
