import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(GAME_ROOT, '..');
const SUITE_ROOT = resolve(REPO_ROOT, 'assets', 'art', 'enemy-animation-suite-v2');
const IDS = [
  'cinder-hound',
  'ash-wisp',
  'bell-moth',
  'tithe-enforcer',
  'registry-hound',
  'drowned-retainer',
  'lantern-leech',
  'salt-warden',
  'ashen-spearman',
  'ashen-banner-guard',
  'forge-thrall',
  'bell-scribe',
];
const SIGNATURES = [
  'cinder-overload',
  'ash-nova',
  'bell-resonance',
  'tithe-seal',
  'registry-mark',
  'undertow-bind',
  'lantern-drain',
  'salt-rampart',
  'ash-lane-charge',
  'banner-wall',
  'ember-vent',
  'docket-mark',
];

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const dl = Math.abs(prediction - left);
  const da = Math.abs(prediction - above);
  const dul = Math.abs(prediction - upperLeft);
  if (dl <= da && dl <= dul) return left;
  return da <= dul ? above : upperLeft;
}

function decodeRgbaPng(bytes) {
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
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
      assert.equal(data[8], 8);
      assert.equal(data[9], 6, 'runtime candidate must be RGBA');
      assert.equal(data[12], 0, 'runtime candidate must not be interlaced');
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    offset += length + 12;
    if (type === 'IEND') break;
  }
  const packed = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = packed[sourceOffset];
    sourceOffset += 1;
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[sourceOffset + x];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const above = y ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      const predictor = [
        0,
        left,
        above,
        Math.floor((left + above) / 2),
        paeth(left, above, upperLeft),
      ][filter];
      assert.notEqual(predictor, undefined, `unsupported PNG filter ${filter}`);
      pixels[y * stride + x] = (raw + predictor) & 0xff;
    }
    sourceOffset += stride;
  }
  return { width, height, pixels };
}

function pixelOffset(image, x, y) {
  return (y * image.width + x) * 4;
}

function frameBytes(image, column, row) {
  const frame = Buffer.alloc(160 * 160 * 4);
  for (let y = 0; y < 160; y += 1) {
    const start = pixelOffset(image, column * 160, row * 160 + y);
    image.pixels.copy(frame, y * 160 * 4, start, start + 160 * 4);
  }
  return frame;
}

test('source contract defines twelve original 24-frame enemy families', async () => {
  const source = JSON.parse(
    await readFile(resolve(SUITE_ROOT, 'enemy-animation-suite-v2.source.json'), 'utf8'),
  );
  assert.equal(source.provenance.sourceClassification, 'AI-generated stylized animation concepts');
  assert.equal(source.provenance.derivativeClassification, 'deterministically pixelified');
  assert.equal(source.provenance.notPixelAuthored, true);
  assert.deepEqual(source.enemies.map(({ id }) => id), IDS);
  assert.deepEqual(source.enemies.map(({ signatureId }) => signatureId), SIGNATURES);
  assert.deepEqual(source.sourceGrid, {
    columns: 6,
    rows: 4,
    cropPolicy: "Proportional row and column boundaries derived from each source image's actual dimensions.",
  });
  assert.deepEqual(source.runtimeAtlas.frameWidth, 160);
  assert.deepEqual(source.runtimeAtlas.frameHeight, 160);
  assert.equal(source.runtimeAtlas.visibleColorCeiling, 64);
  assert.equal(source.runtimeAtlas.minimumTransparentGutter, 2);
});

test('manifest fixes timing, event, provenance, and defeat-hold contracts', async () => {
  const manifest = JSON.parse(await readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.enemyOrder, IDS);
  assert.deepEqual(manifest.geometry, {
    columns: 6,
    rows: 4,
    frameWidth: 160,
    frameHeight: 160,
    atlasWidth: 960,
    atlasHeight: 640,
    minimumTransparentGutter: 2,
  });
  assert.equal(manifest.frames.length, 288);
  assert.equal(manifest.enemies.length, 12);
  assert.equal(manifest.sources.length, 24);
  for (const [index, enemy] of manifest.enemies.entries()) {
    assert.equal(enemy.id, IDS[index]);
    assert.equal(enemy.signatureId, SIGNATURES[index]);
    assert.equal(enemy.frameCount, 24);
    assert.equal(enemy.distinctFrameCount, 24);
    const signature = manifest.frames.find(
      (frame) => frame.enemyId === enemy.id
        && frame.clipId === 'signature-attack'
        && frame.frameIndex === 3,
    );
    assert.deepEqual(signature.events, [enemy.signatureId]);
    assert.equal(signature.phase, 'active');
    const defeated = manifest.frames.find(
      (frame) => frame.enemyId === enemy.id
        && frame.clipId === 'hurt-defeat'
        && frame.frameIndex === 5,
    );
    assert.deepEqual(defeated.events, ['defeatedHold']);
    assert.equal(defeated.phase, 'defeated-hold');
  }
});

test('all runtime atlases are exact, binary-alpha, guttered, palette-bounded, and distinct', async () => {
  const manifest = JSON.parse(await readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'));
  for (const enemy of manifest.enemies) {
    const atlasRecord = manifest.exports.find(
      ({ role, enemyId }) => role === 'transparent-runtime-candidate' && enemyId === enemy.id,
    );
    const atlasBytes = await readFile(resolve(SUITE_ROOT, atlasRecord.path));
    assert.equal(hash(atlasBytes), atlasRecord.sha256);
    assert.deepEqual(
      [atlasRecord.width, atlasRecord.height, atlasRecord.mode],
      [960, 640, 'RGBA'],
    );
    const image = decodeRgbaPng(atlasBytes);
    assert.deepEqual([image.width, image.height], [960, 640]);
    const alphaValues = new Set();
    for (let index = 3; index < image.pixels.length; index += 4) {
      alphaValues.add(image.pixels[index]);
    }
    assert.deepEqual([...alphaValues].sort((a, b) => a - b), [0, 255]);
    const hashes = new Set();
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        hashes.add(hash(frameBytes(image, column, row)));
      }
    }
    assert.equal(hashes.size, 24, `${enemy.id} must keep 24 distinct cels`);
    const records = manifest.frames.filter(({ enemyId }) => enemyId === enemy.id);
    assert.equal(records.length, 24);
    for (const frame of records) {
      assert.deepEqual(frame.alphaValues, [0, 255]);
      assert.ok(frame.visibleColors <= 64);
      assert.ok(Math.min(...Object.values(frame.transparentGutter)) >= 2);
    }
  }
});

test('review artifacts are hashed and runtime integration remains explicit', async () => {
  const manifest = JSON.parse(await readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'));
  const contact = manifest.exports.find(
    ({ role }) => role === 'labeled-review-only-not-runtime',
  );
  const contactBytes = await readFile(resolve(SUITE_ROOT, contact.path));
  assert.equal(hash(contactBytes), contact.sha256);
  assert.deepEqual([contact.width, contact.height, contact.mode], [1280, 1170, 'RGB']);
  assert.equal(
    manifest.runtimeIntegration.status,
    'reviewed-runtime-candidates-not-yet-wired',
  );
  assert.match(manifest.runtimeIntegration.remaining, /pivots, hurt boxes, hit boxes/u);
  const gifs = manifest.exports.filter(({ role }) => role === 'nearest-neighbor-review-only');
  assert.equal(gifs.length, 12);
  for (const gif of gifs) {
    const bytes = await readFile(resolve(SUITE_ROOT, gif.path));
    assert.equal(hash(bytes), gif.sha256);
    assert.deepEqual([gif.width, gif.height, gif.mode], [320, 320, 'P']);
  }
});
