import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ENEMY_FAMILIES } from '../enemy-atlas.mjs';

const suiteDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'art', 'enemy-combat-suite');
const runtimeAtlasPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'art', 'enemy-combat-suite', 'enemy-combat-atlas.png');
const read = (name) => readFileSync(join(suiteDir, name));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(read('manifest.json'));
const source = JSON.parse(read('enemy-combat-suite.source.json'));

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

test('enemy combat production suite rebuild is byte-identical', () => {
  for (let pass = 0; pass < 2; pass += 1) {
    const output = execFileSync('python', ['build_enemy_combat_suite.py', '--check'], {
      cwd: suiteDir,
      encoding: 'utf8',
    });
    assert.match(output, /byte-identical/);
  }
});

test('enemy combat suite publishes exact transparent atlas geometry and review-only sheet', () => {
  assert.deepEqual(manifest.geometry, {
    columns: 4,
    rows: 8,
    cellWidth: 64,
    cellHeight: 80,
    minimumTransparentGutter: 4,
    coordinateOrigin: 'top-left',
  });
  const atlasExport = manifest.exports.find(({ role }) => role === 'transparent-runtime-atlas');
  const contactExport = manifest.exports.find(({ role }) => role === 'labeled-review-contact-sheet');
  const atlas = read(atlasExport.path);
  const runtimeAtlas = readFileSync(runtimeAtlasPath);
  const contact = read(contactExport.path);
  assert.equal(atlasExport.runtime, true);
  assert.equal(contactExport.runtime, false);
  assert.equal(digest(atlas), atlasExport.sha256);
  assert.equal(digest(runtimeAtlas), atlasExport.sha256);
  assert.equal(runtimeAtlas.equals(atlas), true);
  assert.equal(digest(contact), contactExport.sha256);
  assert.deepEqual(pngIhdr(atlas), atlasExport.ihdr);
  assert.deepEqual(pngIhdr(contact), contactExport.ihdr);
  assert.deepEqual(atlasExport.ihdr, {
    width: 256,
    height: 640,
    bitDepth: 8,
    colorType: 6,
    compression: 0,
    filter: 0,
    interlace: 0,
  });
  assert.equal(contactExport.ihdr.width, 560);
  assert.equal(contactExport.ihdr.height, 1500);
  assert.equal(contactExport.ihdr.colorType, 2);
  assert.equal(manifest.runtimeIntegration, 'current-browser-neutral-windup-attack-stagger');
});

test('all live enemy families and templates map to four distinct anchored frames', () => {
  assert.deepEqual(manifest.poseOrder, ['neutral', 'windup', 'attack', 'stagger']);
  assert.deepEqual(
    manifest.familyMappings.map(({ id, row, templateIds }) => ({ id, row, templateIds })),
    ENEMY_FAMILIES.map(({ id, row, templateIds }) => ({ id, row, templateIds })),
  );
  assert.equal(manifest.frames.length, 32);
  const rects = new Set();
  for (const family of ENEMY_FAMILIES) {
    const frames = manifest.frames.filter(({ familyId }) => familyId === family.id);
    assert.deepEqual(frames.map(({ pose }) => pose), manifest.poseOrder);
    assert.equal(new Set(frames.map(({ rgbaSha256 }) => rgbaSha256)).size, 4);
    assert.equal(new Set(frames.map(({ rgbaSha256, alphaBounds }) => (
      `${rgbaSha256}:${JSON.stringify(alphaBounds)}`
    ))).size, 4);
    for (const [column, frame] of frames.entries()) {
      assert.deepEqual(frame.rect, {
        x: column * 64,
        y: family.row * 80,
        width: 64,
        height: 80,
      });
      const rectKey = Object.values(frame.rect).join(',');
      assert.equal(rects.has(rectKey), false);
      rects.add(rectKey);
      assert.ok(frame.opaquePixelCount >= 140);
      assert.ok(Object.values(frame.transparentGutter).every((gutter) => gutter >= 4));
      for (const anchorName of ['pivot', 'ground', 'contact']) {
        const [x, y] = frame[anchorName];
        assert.equal(Number.isSafeInteger(x) && Number.isSafeInteger(y), true);
        assert.ok(x >= 0 && x < 64 && y >= 0 && y < 80);
      }
      assert.equal(frame.paletteId, family.id === 'hound'
        ? 'PAL-ENM-HOUND-01'
        : source.families.find(({ id }) => id === family.id).paletteId);
    }
  }
  assert.equal(rects.size, 32);
});

test('source and production labels avoid real emblem and devotional design terms', () => {
  const productionLabels = source.families.map(({ label, motif }) => `${label} ${motif}`).join('\n').toLowerCase();
  for (const term of ['torii', 'kamon', 'coat of arms', 'crucifix', 'mandala', 'shimenawa']) {
    assert.equal(productionLabels.includes(term), false, term);
  }
  assert.match(manifest.originality, /Original integer-pixel primitives/);
  for (const entry of manifest.sources) assert.equal(digest(read(entry.path)), entry.sha256);
});
