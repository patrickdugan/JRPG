import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const suiteUrl = new URL('../../assets/art/item-icon-suite/', import.meta.url);
const runtimeUrl = new URL('../assets/art/item-icon-suite/item-icon-atlas.png', import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('item icon suite rebuilds byte-identically', () => {
  execFileSync('python', ['build_item_icon_suite.py', '--check'], {
    cwd: fileURLToPath(suiteUrl),
    stdio: 'pipe',
  });
});

test('manifest locks 25 distinct live frames and byte-identical runtime art', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', suiteUrl), 'utf8'));
  const source = JSON.parse(await readFile(new URL('item-icon-suite.source.json', suiteUrl), 'utf8'));
  const atlas = await readFile(new URL('item-icon-atlas.png', suiteUrl));
  const runtime = await readFile(runtimeUrl);
  assert.equal(manifest.assetId, source.assetId);
  assert.equal(manifest.geometry.sheetWidth, 80);
  assert.equal(manifest.geometry.sheetHeight, 80);
  assert.equal(manifest.frames.length, 25);
  assert.deepEqual(manifest.itemOrder, source.items.map((item) => item.id));
  assert.equal(new Set(manifest.frames.map((frame) => frame.rgbaSha256)).size, 25);
  for (const frame of manifest.frames) {
    assert.equal(frame.localAlphaBounds.every((value) => Number.isInteger(value)), true);
    assert.ok(frame.localAlphaBounds[0] >= 1 && frame.localAlphaBounds[1] >= 1);
    assert.ok(frame.localAlphaBounds[2] <= 15 && frame.localAlphaBounds[3] <= 15);
  }
  const atlasExport = manifest.exports.find((entry) => entry.file === 'item-icon-atlas.png');
  assert.equal(sha256(atlas), atlasExport.sha256);
  assert.equal(sha256(runtime), atlasExport.sha256);
  assert.deepEqual(runtime, atlas);
  assert.match(manifest.runtimeIntegration, /decorative-icons-with-text-fallback/);
  assert.equal(source.restrictions.some((entry) => /never as a sacred collectible/i.test(entry)), true);
});
