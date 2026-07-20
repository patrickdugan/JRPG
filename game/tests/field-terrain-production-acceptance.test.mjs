import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const suiteUrl = new URL('../../assets/art/field-terrain-suite/', import.meta.url);
const runtimeUrl = new URL('../assets/art/field-terrain-suite/field-terrain-atlas.png', import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('field terrain suite rebuilds byte-identically', () => {
  execFileSync('python', ['build_field_terrain_suite.py', '--check'], {
    cwd: fileURLToPath(suiteUrl), stdio: 'pipe',
  });
});

test('manifest locks 19 distinct overlays and the byte-identical runtime atlas', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', suiteUrl), 'utf8'));
  const source = JSON.parse(await readFile(new URL('field-terrain-suite.source.json', suiteUrl), 'utf8'));
  const atlas = await readFile(new URL('field-terrain-atlas.png', suiteUrl));
  const runtime = await readFile(runtimeUrl);
  assert.equal(manifest.assetId, source.assetId);
  assert.deepEqual(manifest.terrainOrder, source.terrainOrder);
  assert.equal(manifest.coverage.liveLevelCount, 48);
  assert.equal(manifest.coverage.liveTerrainKeys, 19);
  assert.equal(manifest.frames.length, 19);
  assert.equal(new Set(manifest.frames.map((frame) => frame.rgbaSha256)).size, 19);
  assert.equal(manifest.frames.every((frame) => frame.alphaBounds.length === 4), true);
  const atlasExport = manifest.exports.find((entry) => entry.file === 'field-terrain-atlas.png');
  assert.equal(sha256(atlas), atlasExport.sha256);
  assert.equal(sha256(runtime), atlasExport.sha256);
  assert.deepEqual(runtime, atlas);
  assert.match(manifest.runtimeIntegration, /decorative-overlays/);
  assert.equal(source.restrictions.some((entry) => /never define collision/i.test(entry)), true);
  assert.equal(source.restrictions.some((entry) => /do not depict sacred objects/i.test(entry)), true);
});
