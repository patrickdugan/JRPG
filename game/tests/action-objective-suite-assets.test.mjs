import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { test } from 'node:test';

import {
  ACTION_OBJECTIVE_ATLAS,
  ACTION_OBJECTIVE_KINDS,
  getActionObjectiveFrame,
} from '../action-objective-atlas.mjs';

const ROOT = new URL('../../assets/art/action-objective-suite-v1/', import.meta.url);
const RUNTIME = new URL('../assets/art/action-objective-suite-v1/action-objective-atlas-v1.png', import.meta.url);

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
      assert.equal(data[8], 8, 'objective atlas must use 8-bit channels');
      assert.equal(data[9], 6, 'objective atlas must be RGBA');
      assert.equal(data[12], 0, 'objective atlas must not be interlaced');
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

function cropRgba(decoded, [x0, y0, width, height]) {
  const result = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const start = ((y0 + row) * decoded.width + x0) * 4;
    decoded.rgba.copy(result, row * width * 4, start, start + width * 4);
  }
  return result;
}

test('action objective builder --check rebuilds byte-identical outputs without writing', () => {
  const builder = new URL('build_action_objective_suite.py', ROOT);
  const output = execFileSync('python', [fileURLToPath(builder), '--check'], { encoding: 'utf8' });
  assert.match(output, /Action objective suite is deterministic and current/u);
});

test('action objective manifest pins sources, outputs, provenance, and the runtime copy', async () => {
  const [manifestBytes, sourceBytes, builderBytes, atlasBytes, reviewBytes, runtimeBytes, requirements, readme] = await Promise.all([
    readFile(new URL('manifest.json', ROOT)),
    readFile(new URL('action-objective-suite-v1.source.json', ROOT)),
    readFile(new URL('build_action_objective_suite.py', ROOT)),
    readFile(new URL('action-objective-atlas-v1.png', ROOT)),
    readFile(new URL('action-objective-review-sheet-v1.png', ROOT)),
    readFile(RUNTIME),
    readFile(new URL('requirements.txt', ROOT), 'utf8'),
    readFile(new URL('README.md', ROOT), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestBytes);
  const source = JSON.parse(sourceBytes);
  assert.equal(manifest.assetId, 'action-objective-suite-v1');
  assert.deepEqual(manifest.sources, [
    { path: 'action-objective-suite-v1.source.json', sha256: sha256(sourceBytes) },
    { path: 'build_action_objective_suite.py', sha256: sha256(builderBytes) },
  ]);
  const atlasOutput = manifest.outputs.find(({ purpose }) => purpose === 'transparent-runtime-atlas');
  assert.equal(atlasOutput.sha256, sha256(atlasBytes));
  assert.deepEqual(atlasOutput.ihdr, { width: 320, height: 2240, bitDepth: 8, colorType: 6, interlace: 0 });
  const reviewOutput = manifest.outputs.find(({ purpose }) => purpose === 'labelled-2x-nearest-review-sheet');
  assert.equal(reviewOutput.runtime, false);
  assert.equal(reviewOutput.sha256, sha256(reviewBytes));
  assert.deepEqual(runtimeBytes, atlasBytes, 'runtime atlas must be byte-identical to the suite atlas');
  assert.equal(manifest.runtimeCopy.byteIdenticalToAtlas, true);
  assert.equal(manifest.provenance.classification, 'pixel-authored-deterministic-production');
  assert.equal(manifest.provenance.generatorUsed, false);
  assert.equal(manifest.provenance.externalPixels, false);
  assert.equal(manifest.provenance.handPixeledClaim, false);
  assert.equal(manifest.builder.pillowVersion, '11.3.0');
  assert.match(requirements, /^Pillow==11\.3\.0\s*$/u);
  assert.match(readme, /pixel-authored deterministic production/u);
  assert.match(readme, /\*\*Not claimed:\*\* hand-pixeled work, generated art, or pixelification/u);
  assert.equal(manifest.palette.used, manifest.palette.declared);
  assert.equal(manifest.palette.declared, Object.keys(source.palette).length);
  assert.ok(source.restrictions.join(' ').toLowerCase().includes('no readable text'));
});

test('manifest kinds, states, rows, and per-frame heights mirror the runtime atlas module', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', ROOT)));
  assert.deepEqual(manifest.geometry.pivot, [ACTION_OBJECTIVE_ATLAS.pivotX, ACTION_OBJECTIVE_ATLAS.pivotY]);
  assert.equal(manifest.geometry.drawScale, ACTION_OBJECTIVE_ATLAS.drawScale);
  assert.equal(manifest.geometry.sheetWidth, ACTION_OBJECTIVE_ATLAS.width);
  assert.equal(manifest.geometry.sheetHeight, ACTION_OBJECTIVE_ATLAS.height);
  assert.deepEqual(
    manifest.kinds.map(({ id, role, row, states }) => ({ id, role, row, states })),
    ACTION_OBJECTIVE_KINDS.map(({ id, role, states }, row) => ({ id, role, row, states })),
  );
  for (const frame of manifest.frames) {
    const runtime = getActionObjectiveFrame(frame.kind, frame.state);
    assert.ok(runtime, `${frame.id} must resolve at runtime`);
    assert.deepEqual([runtime.x, runtime.y, runtime.width, runtime.height], frame.rect);
    assert.equal(runtime.visualHeight, frame.visualHeight, `${frame.id} visual height`);
  }
  assert.equal(manifest.frames.length, ACTION_OBJECTIVE_KINDS.reduce((sum, { states }) => sum + states.length, 0));
});

test('atlas frames are exact manifested binary-alpha pixels with empty unused cells', async () => {
  const [atlasBytes, manifestBytes] = await Promise.all([
    readFile(new URL('action-objective-atlas-v1.png', ROOT)),
    readFile(new URL('manifest.json', ROOT)),
  ]);
  const manifest = JSON.parse(manifestBytes);
  const decoded = decodeRgbaPng(atlasBytes);
  assert.deepEqual([decoded.width, decoded.height], [320, 2240]);
  for (let offset = 3; offset < decoded.rgba.length; offset += 4) {
    assert.ok(decoded.rgba[offset] === 0 || decoded.rgba[offset] === 255, 'partial alpha found');
  }
  const used = new Set();
  for (const frame of manifest.frames) {
    const raw = cropRgba(decoded, frame.rect);
    assert.equal(sha256(raw), frame.rgbaSha256, `${frame.id} pixels`);
    used.add(`${frame.rect[0]},${frame.rect[1]}`);
    for (let row = 78; row < 80; row += 1) {
      for (let x = 0; x < 64; x += 1) assert.equal(raw[(row * 64 + x) * 4 + 3], 0, `${frame.id} draws below the foot row`);
    }
  }
  for (let row = 0; row < 28; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      if (used.has(`${column * 64},${row * 80}`)) continue;
      const raw = cropRgba(decoded, [column * 64, row * 80, 64, 80]);
      assert.ok(raw.every((value, index) => index % 4 !== 3 || value === 0), `unused cell ${row}:${column} must be empty`);
    }
  }
});
