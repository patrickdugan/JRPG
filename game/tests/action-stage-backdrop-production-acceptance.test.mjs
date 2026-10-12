import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { test } from 'node:test';

import { ACTION_STAGES, ACTION_STAGE_IDS } from '../action-stages.mjs';
import { getActionStageBackdrop } from '../action-stage-backdrop-atlas.mjs';

const SUITE = new URL('../../assets/art/action-stage-backdrop-suite-v1/', import.meta.url);
const RUNTIME = new URL('../assets/art/action-stage-backdrop-suite-v1/', import.meta.url);
const CALM_LIMITS = Object.freeze({ minMeanMilli: 8, maxMeanMilli: 80, maxP95Milli: 250, maxBrightPermille: 30 });

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= upDistance && leftDistance <= upperLeftDistance
    ? left
    : upDistance <= upperLeftDistance ? up : upperLeft;
}

function decodeRgbaPng(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8;
  let width;
  let height;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'action-stage art must use 8-bit channels');
      assert.equal(data[9], 6, 'action-stage art must be RGBA');
      assert.equal(data[12], 0, 'action-stage art must not be interlaced');
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  const packed = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = Buffer.alloc(width * height * 4);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = packed[sourceOffset];
    sourceOffset += 1;
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[sourceOffset + x];
      const left = x >= 4 ? rgba[y * stride + x - 4] : 0;
      const up = y > 0 ? rgba[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? rgba[(y - 1) * stride + x - 4] : 0;
      const value = filter === 0 ? raw
        : filter === 1 ? raw + left
          : filter === 2 ? raw + up
            : filter === 3 ? raw + Math.floor((left + up) / 2)
              : filter === 4 ? raw + paeth(left, up, upperLeft)
                : Number.NaN;
      assert.equal(Number.isNaN(value), false, `unsupported PNG filter ${filter}`);
      rgba[y * stride + x] = value & 0xff;
    }
    sourceOffset += stride;
  }
  return { width, height, rgba };
}

function linear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(rgba, offset) {
  return 0.2126 * linear(rgba[offset]) + 0.7152 * linear(rgba[offset + 1]) + 0.0722 * linear(rgba[offset + 2]);
}

test('builder check is non-writing, deterministic, and current', () => {
  const builder = new URL('build_action_stage_backdrop_suite.py', SUITE);
  const output = execFileSync('python', [fileURLToPath(builder), '--check'], { encoding: 'utf8' });
  assert.match(output, /action stage backdrop suite is deterministic and current/u);
});

test('manifest records provenance, tooling, policy, and the current builder', async () => {
  const [manifestBytes, builderBytes, requirements, readme] = await Promise.all([
    readFile(new URL('manifest.json', SUITE)),
    readFile(new URL('build_action_stage_backdrop_suite.py', SUITE)),
    readFile(new URL('requirements.txt', SUITE), 'utf8'),
    readFile(new URL('README.md', SUITE), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.assetId, 'action-stage-backdrop-suite-v1');
  assert.equal(manifest.builderSha256, sha256(builderBytes));
  assert.equal(manifest.provenance.lane, 'pixel-authored deterministic production');
  assert.equal(manifest.provenance.generatedConceptPixels, false);
  assert.equal(manifest.provenance.externalPixels, false);
  assert.deepEqual(manifest.provenance.claimsNotMade, ['hand-pixeled', 'hand-authored']);
  assert.equal(manifest.tooling.pillow, '11.3.0');
  assert.equal(requirements.trim(), 'Pillow==11.3.0');
  assert.equal(manifest.renderPolicy.presentationOnly, true);
  assert.equal(manifest.renderPolicy.collisionAuthority, 'game/action-stages.mjs');
  for (const key of ['bakeActors', 'bakeText', 'bakeUi', 'bakeSacredObjects', 'bakeAuthenticHeraldry', 'bakeVictimFixtures', 'gore']) {
    assert.equal(manifest.renderPolicy[key], false, `${key} must remain forbidden`);
  }
  assert.equal(manifest.twoIndependentRendersByteIdentical, true);
  assert.equal(manifest.artLock, false);
  assert.deepEqual(manifest.geometry, {
    nativeWidth: 480, nativeHeight: 270, runtimeScale: 2, canvasWidth: 960, canvasHeight: 540,
    calmBandTopNative: 64, tileSize: 16,
    tileRoles: ['ground-a', 'ground-b', 'platform-left', 'platform-middle', 'platform-right', 'support'],
  });
  assert.match(readme, /pixel-authored\s+production\s+assets/u);
  assert.match(readme, /not\s+hand-pixeled\s+art/u);
  assert.match(readme, /no\s+image\s+generator\s+was\s+used/u);
});

test('manifest geometry mirrors action-stages.mjs for all 20 stages, each exactly once', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', SUITE), 'utf8'));
  assert.deepEqual(manifest.coverage.stageIds, [...ACTION_STAGE_IDS]);
  assert.equal(manifest.coverage.backdropCount, 20);
  assert.equal(manifest.coverage.distinctBackdropHashes, 20);
  assert.deepEqual(manifest.backdrops.map(({ stageId }) => stageId), [...ACTION_STAGE_IDS]);
  assert.equal(new Set(manifest.backdrops.map(({ file }) => file)).size, 20);
  for (const [index, stage] of ACTION_STAGES.entries()) {
    const record = manifest.backdrops[index];
    assert.equal(record.levelId, stage.id);
    assert.equal(record.tileRow, index);
    assert.equal(record.groundY, stage.groundY, `${stage.id} groundY drifted from the art`);
    assert.deepEqual(
      record.platforms,
      stage.platforms.map(({ id, left, right, y }) => ({ id, left, right, y })),
      `${stage.id} platforms drifted from the art`,
    );
    assert.equal(record.file, `backdrops/${stage.id}.png`);
    assert.equal(`./assets/art/action-stage-backdrop-suite-v1/${record.file}`, getActionStageBackdrop(stage.id).url);
  }
});

test('backdrops are exact manifested 480x270 opaque RGBA with byte-identical runtime copies', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', SUITE), 'utf8'));
  const rgbaHashes = new Set();
  for (const record of manifest.backdrops) {
    const [suiteBytes, runtimeBytes] = await Promise.all([
      readFile(new URL(record.file, SUITE)),
      readFile(new URL(record.file, RUNTIME)),
    ]);
    assert.deepEqual(runtimeBytes, suiteBytes, `${record.stageId} runtime copy differs`);
    assert.equal(sha256(suiteBytes), record.sha256);
    const decoded = decodeRgbaPng(suiteBytes);
    assert.deepEqual([decoded.width, decoded.height], [480, 270]);
    assert.deepEqual([record.width, record.height, record.mode], [480, 270, 'RGBA']);
    assert.equal(sha256(decoded.rgba), record.rgbaSha256);
    rgbaHashes.add(record.rgbaSha256);
    const colors = new Set();
    for (let offset = 0; offset < decoded.rgba.length; offset += 4) {
      assert.equal(decoded.rgba[offset + 3], 255, `${record.stageId} must be opaque`);
      colors.add(decoded.rgba.readUInt32BE(offset));
    }
    assert.equal(colors.size, record.colorCount);
    assert.ok(colors.size <= record.paletteSize && colors.size <= 40, `${record.stageId} exceeds its palette budget`);
  }
  assert.equal(rgbaHashes.size, 20);
});

test('the fighters band stays calm and low-contrast on every backdrop', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', SUITE), 'utf8'));
  for (const record of manifest.backdrops) {
    const decoded = decodeRgbaPng(await readFile(new URL(record.file, SUITE)));
    const top = manifest.geometry.calmBandTopNative;
    const bottom = record.groundY / 2;
    assert.deepEqual(record.calmBand.rows, [top, bottom]);
    const values = [];
    for (let y = top; y < bottom; y += 1) {
      for (let x = 0; x < 480; x += 1) values.push(luminance(decoded.rgba, (y * 480 + x) * 4));
    }
    values.sort((a, b) => a - b);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const p95 = values[Math.floor(values.length * 95 / 100)];
    const bright = values.filter((value) => value > 0.2).length / values.length;
    assert.ok(Math.abs(Math.round(mean * 1000) - record.calmBand.meanLuminanceMilli) <= 1, `${record.stageId} mean drifted`);
    assert.ok(mean * 1000 >= CALM_LIMITS.minMeanMilli, `${record.stageId} fighters band is too dark for dark sprites`);
    assert.ok(mean * 1000 <= CALM_LIMITS.maxMeanMilli, `${record.stageId} fighters band is too bright for light labels`);
    assert.ok(p95 * 1000 <= CALM_LIMITS.maxP95Milli, `${record.stageId} fighters band has too much high-value area`);
    assert.ok(bright * 1000 <= CALM_LIMITS.maxBrightPermille, `${record.stageId} fighters band has too many bright pixels`);
  }
});

test('surface tile atlas is a binary-alpha 96x320 sheet with a byte-identical runtime copy', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', SUITE), 'utf8'));
  const [suiteBytes, runtimeBytes] = await Promise.all([
    readFile(new URL('action-stage-surface-tiles.png', SUITE)),
    readFile(new URL('action-stage-surface-tiles.png', RUNTIME)),
  ]);
  assert.deepEqual(runtimeBytes, suiteBytes);
  assert.deepEqual(manifest.surfaceTiles, {
    file: 'action-stage-surface-tiles.png', width: 96, height: 320, columns: 6, rows: 20, mode: 'RGBA',
    alphaPolicy: 'binary', alphaValues: [0, 255], sha256: sha256(suiteBytes),
  });
  const decoded = decodeRgbaPng(suiteBytes);
  assert.deepEqual([decoded.width, decoded.height], [96, 320]);
  for (let row = 0; row < 20; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const role = manifest.geometry.tileRoles[column];
      let opaque = 0;
      let surfaceRowOpaque = 0;
      for (let y = 0; y < 16; y += 1) {
        for (let x = 0; x < 16; x += 1) {
          const alpha = decoded.rgba[((row * 16 + y) * 96 + column * 16 + x) * 4 + 3];
          assert.ok(alpha === 0 || alpha === 255, 'tile alpha must be binary');
          if (alpha === 255) opaque += 1;
          if (alpha === 255 && y === 0) surfaceRowOpaque += 1;
        }
      }
      const stageId = ACTION_STAGE_IDS[row];
      if (role === 'support' && !getActionStageBackdrop(stageId).supports) {
        assert.equal(opaque, 0, `${stageId} has no support art`);
      } else {
        assert.ok(opaque > 0, `${stageId} ${role} tile is empty`);
      }
      if (role.startsWith('ground-') || role === 'platform-middle') {
        assert.equal(surfaceRowOpaque, 16, `${stageId} ${role} walkable top row must be continuous`);
      }
    }
  }
});

test('labelled review sheet is manifested and review-only', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', SUITE), 'utf8'));
  const bytes = await readFile(new URL('action-stage-backdrop-review-sheet.png', SUITE));
  assert.equal(manifest.reviewSheet.file, 'action-stage-backdrop-review-sheet.png');
  assert.equal(manifest.reviewSheet.purpose, 'labelled-review-only');
  assert.equal(manifest.reviewSheet.sha256, sha256(bytes));
  const decoded = decodeRgbaPng(bytes);
  assert.deepEqual([decoded.width, decoded.height], [manifest.reviewSheet.width, manifest.reviewSheet.height]);
  await assert.rejects(readFile(new URL('action-stage-backdrop-review-sheet.png', RUNTIME)), 'review sheet must not ship at runtime');
});
