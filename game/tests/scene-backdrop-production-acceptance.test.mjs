import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { test } from 'node:test';

import { SCENE_BACKDROP_IDS } from '../scene-backdrop-atlas.mjs';

const ROOT = new URL('../../assets/art/scene-backdrop-suite/', import.meta.url);
const RUNTIME = new URL('../assets/art/scene-backdrop-suite/scene-backdrop-atlas.png', import.meta.url);

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
      assert.equal(data[8], 8, 'scene backdrop must use 8-bit channels');
      assert.equal(data[9], 6, 'scene backdrop must be RGBA');
      assert.equal(data[12], 0, 'scene backdrop must not be interlaced');
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

function cropRgba(decoded, rect) {
  const [x0, y0, width, height] = rect;
  const result = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y0 + row) * decoded.width + x0) * 4;
    decoded.rgba.copy(result, row * width * 4, sourceStart, sourceStart + width * 4);
  }
  return result;
}

test('scene-backdrop source and manifest preserve exact cultural and presentation boundaries', async () => {
  const [sourceBytes, manifestBytes, builderBytes] = await Promise.all([
    readFile(new URL('scene-backdrop-suite.source.json', ROOT)),
    readFile(new URL('manifest.json', ROOT)),
    readFile(new URL('build_scene_backdrop_suite.py', ROOT)),
  ]);
  const source = JSON.parse(sourceBytes);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(source.authorship, 'original-code-native-pixel-primitives');
  assert.deepEqual(source.geometry, {
    frameWidth: 320, frameHeight: 180, columns: 5, rows: 4,
    sheetWidth: 1600, sheetHeight: 720,
    uiCalmBand: [0, 132, 320, 48], focalSafeRect: [48, 20, 224, 106],
  });
  assert.equal(source.renderPolicy.presentationOnly, true);
  assert.equal(source.renderPolicy.collisionAuthority, 'none');
  assert.equal(source.renderPolicy.bakeVictimFixtures, true);
  for (const key of ['bakeActors', 'bakeText', 'bakeUi', 'bakeSacredObjects', 'bakeAuthenticHeraldry', 'generatedConceptPixels', 'externalPixels', 'partialAlpha']) {
    assert.equal(source.renderPolicy[key], false, `${key} must remain forbidden`);
  }
  assert.deepEqual(source.backdrops.map((entry) => entry.id), SCENE_BACKDROP_IDS);
  assert.equal(source.backdrops.flatMap((entry) => entry.beatIds).length, 60);
  assert.equal(new Set(source.backdrops.flatMap((entry) => entry.beatIds)).size, 60);
  assert.equal(source.backdrops.find(({ id }) => id === 'black-gate-causeway').victimFixtureCount, 10);
  assert.equal(source.backdrops.find(({ id }) => id === 'kurohana-living-archive').victimFixtureCount, 18);
  assert.equal(manifest.sourceSha256, sha256(sourceBytes));
  assert.equal(manifest.builderSha256, sha256(builderBytes));
  assert.deepEqual(manifest.coverage, {
    backdropCount: 20, mappedBeatCount: 60, unmappedBeatIds: [],
    duplicateBeatAssignments: [], distinctFrameHashes: 20,
  });
  assert.equal(manifest.externalCulturalReview, 'pending');
  assert.equal(manifest.artLock, false);
  assert.equal(manifest.twoIndependentRendersByteIdentical, true);
  assert.equal(manifest.runtimeProductionByteIdentical, true);
  const restrictions = source.restrictions.join(' ').toLowerCase();
  for (const phrase of ['no sacred', 'no celebrity', 'no pixels are sampled', 'external japanese']) {
    assert.match(restrictions, new RegExp(phrase));
  }
  assert.match(restrictions, /fictional kirishitan victim/u);
});

test('scene-backdrop builder check is non-writing and current', () => {
  const builder = new URL('build_scene_backdrop_suite.py', ROOT);
  const output = execFileSync('python', [fileURLToPath(builder), '--check'], { encoding: 'utf8' });
  assert.match(output, /scene backdrop suite is deterministic and current/u);
});

test('scene-backdrop atlas and runtime copy are exact manifested 1600x720 RGBA pixels', async () => {
  const [atlasBytes, runtimeBytes, manifestBytes] = await Promise.all([
    readFile(new URL('scene-backdrop-atlas.png', ROOT)),
    readFile(RUNTIME),
    readFile(new URL('manifest.json', ROOT)),
  ]);
  const manifest = JSON.parse(manifestBytes);
  assert.deepEqual(runtimeBytes, atlasBytes);
  const atlasExport = manifest.exports.find((entry) => entry.purpose === 'opaque-runtime-atlas');
  assert.deepEqual(atlasExport, {
    file: 'scene-backdrop-atlas.png', purpose: 'opaque-runtime-atlas',
    width: 1600, height: 720, mode: 'RGBA', sha256: sha256(atlasBytes),
  });
  const decoded = decodeRgbaPng(atlasBytes);
  assert.deepEqual({ width: decoded.width, height: decoded.height }, { width: 1600, height: 720 });
  const frameHashes = new Set();
  for (const [index, frame] of manifest.frames.entries()) {
    assert.equal(frame.id, SCENE_BACKDROP_IDS[index]);
    assert.deepEqual(frame.rect, [(index % 5) * 320, Math.floor(index / 5) * 180, 320, 180]);
    const raw = cropRgba(decoded, frame.rect);
    assert.equal(sha256(raw), frame.rgbaSha256);
    frameHashes.add(frame.rgbaSha256);
    const colors = new Set();
    const calmBandColors = new Set();
    for (let offset = 0; offset < raw.length; offset += 4) {
      assert.equal(raw[offset + 3], 255, `${frame.id} contains partial transparency`);
      colors.add(raw.subarray(offset, offset + 4).toString('hex'));
      if (Math.floor(offset / 4 / 320) >= 132) {
        calmBandColors.add(raw.subarray(offset, offset + 4).toString('hex'));
      }
    }
    assert.equal(colors.size, frame.colorCount);
    assert.ok(colors.size <= 24, `${frame.id} exceeds the 24-color review budget`);
    assert.ok(calmBandColors.size <= 2, `${frame.id} violates the lower-48-pixel calm band`);
  }
  assert.equal(frameHashes.size, 20);
});

test('scene-backdrop contact sheet is exact review-only half scale', async () => {
  const [contactBytes, manifestBytes] = await Promise.all([
    readFile(new URL('scene-backdrop-contact-sheet.png', ROOT)),
    readFile(new URL('manifest.json', ROOT)),
  ]);
  const manifest = JSON.parse(manifestBytes);
  const contactExport = manifest.exports.find((entry) => entry.purpose === 'half-scale-labeled-review-only');
  assert.deepEqual(contactExport, {
    file: 'scene-backdrop-contact-sheet.png', purpose: 'half-scale-labeled-review-only',
    width: 800, height: 440, mode: 'RGBA', sha256: sha256(contactBytes),
  });
  const decoded = decodeRgbaPng(contactBytes);
  assert.deepEqual({ width: decoded.width, height: decoded.height }, { width: 800, height: 440 });
});
