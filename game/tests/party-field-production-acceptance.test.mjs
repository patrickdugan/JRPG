import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUITE_ROOT = resolve(GAME_ROOT, '..', 'assets', 'art', 'party-field-suite');
const EXTENSION_SOURCE_PATH = resolve(SUITE_ROOT, 'party-field-walk-inbetweens.source.json');
const ROWS = ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'];
const COLUMNS = [
  'north-idle', 'north-walk', 'east-idle', 'east-walk',
  'south-idle', 'south-walk', 'west-idle', 'west-walk',
  'south-interact', 'south-hurt',
  'north-walk-b', 'east-walk-b', 'south-walk-b', 'west-walk-b',
];
const LEGACY_COLUMNS = COLUMNS.slice(0, 10);
const LEGACY_FRAME_DIGEST = '794ab3b03b5068ff0aa6a6e979316746cfb41c7efcbfcbc888a4f8f3bc68da25';
const SUPERSEDED_PRE_NIKOLA_DIGEST = '72b35797d6688ceab2518bc03eca9cc7e0789e7299ebc6ec0bf6645bb24400a2';
const NIKOLA_LINEAGE = {
  birthAndStation: 'Croatian-born frontier minor aristocrat',
  claimedDescent: 'Nikola claims a Wallachian covenant line transmitted through noblewomen',
  englishAncestry: 'Nikola is English through his fictional mother Margaret Wychmere',
  inheritanceChain: 'the supposed male line is repeatedly rebuilt through heiresses and marriage contracts exchanging refuge, money, land, ships, and protection',
  affiliation: 'Covenant of the Severed Dragon',
  historicity: 'entirely invented alternate-history lore; makes no real-world claim that vampires, vampire hunters, or this Covenant existed',
};

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodeRgbaPng(bytes) {
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  let offset = 8;
  let width;
  let height;
  const compressed = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'sprite PNG must use 8-bit channels');
      assert.equal(data[9], 6, 'sprite PNG must be true RGBA');
      assert.equal(data[12], 0, 'sprite PNG must not be interlaced');
    } else if (type === 'IDAT') {
      compressed.push(data);
    }
    offset += length + 12;
    if (type === 'IEND') break;
  }
  const packed = inflateSync(Buffer.concat(compressed));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let packedOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = packed[packedOffset];
    packedOffset += 1;
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[packedOffset + x];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const above = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth(left, above, upperLeft)][filter];
      assert.notEqual(predictor, undefined, `unsupported PNG filter ${filter}`);
      pixels[y * stride + x] = (raw + predictor) & 0xff;
    }
    packedOffset += stride;
  }
  return { width, height, pixels };
}

function alphaAt(image, x, y) {
  return image.pixels[(y * image.width + x) * 4 + 3];
}

function rgbaFrameBytes(image, frame) {
  const [x0, y0, width, height] = frame.rect;
  const bytes = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((y0 + y) * image.width + x0) * 4;
    const targetStart = y * width * 4;
    image.pixels.copy(bytes, targetStart, sourceStart, sourceStart + width * 4);
  }
  return bytes;
}

test('Nikola migration preserves the stable six-by-fourteen field contract', async () => {
  const [sourceText, extensionText] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'party-field-suite.source.json'), 'utf8'),
    readFile(EXTENSION_SOURCE_PATH, 'utf8'),
  ]);
  const source = JSON.parse(sourceText);
  const extension = JSON.parse(extensionText);
  assert.equal(sha256(Buffer.from(sourceText)), '31dffb9e86453a1f188581a5ebbca91e06b6442adbb5a2e445a80824c8eff50a');
  assert.equal(source.authorship, 'original-code-native-pixel-primitives');
  assert.deepEqual(source.frame, {
    width: 32,
    height: 48,
    pivot: [16, 44],
    footPoint: [16, 44],
    transparentGutter: 1,
  });
  assert.deepEqual(source.sheet.rows, ROWS);
  assert.deepEqual(source.sheet.columns, LEGACY_COLUMNS);
  assert.equal(extension.canonicalSource, 'party-field-suite.source.json');
  assert.deepEqual(extension.appendColumns, COLUMNS.slice(10));
  assert.deepEqual(extension.frameContract, source.frame);
  assert.deepEqual(extension.animationSemantics.directionalWalkCycle, ['walk', 'walk-b']);
  assert.equal(extension.animationSemantics.standingFrame, 'idle');
  assert.equal(extension.animationSemantics.reducedMotionFrame, 'idle');
  assert.equal(extension.animationSemantics.legacyFrameRgbaSha256Digest, LEGACY_FRAME_DIGEST);
  assert.equal(extension.animationSemantics.supersededPreNikolaFrameRgbaSha256Digest, SUPERSEDED_PRE_NIKOLA_DIGEST);
  assert.deepEqual(source.characters.map(({ id }) => id), ROWS);
  assert.equal(new Set(source.characters.map(({ paletteId }) => paletteId)).size, ROWS.length);
  const nikola = source.characters.find(({ id }) => id === 'lise');
  assert.equal(nikola.name, 'Nikola Dražanić');
  assert.equal(nikola.legacyCompatibilityId, 'lise');
  assert.match(nikola.origin, /Croatian-born frontier minor aristocrat.*1622/u);
  assert.deepEqual(nikola.lineage, NIKOLA_LINEAGE);
  assert.match(nikola.silhouette, /square-shouldered.*doublet.*rapier.*upright/u);
  assert.match(nikola.likenessPolicy, /original fictional Croatian male face and proportions; no real-person or actor reference/u);
  assert.match(source.characters.find(({ id }) => id === 'mateus').likenessPolicy, /original fictional face and proportions/u);
});

test('manifest maps all 84 frames to stable pivots and preserves the migrated legacy-column digest', async () => {
  const manifest = JSON.parse(await readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.rowOrder, ROWS);
  assert.deepEqual(manifest.columnOrder, COLUMNS);
  assert.deepEqual(manifest.geometry, {
    frameWidth: 32,
    frameHeight: 48,
    columns: 14,
    rows: 6,
    sheetWidth: 448,
    sheetHeight: 288,
    pivot: [16, 44],
    footPoint: [16, 44],
    transparentGutter: 1,
    alphaBoundingBox: [2, 4, 446, 285],
  });
  assert.equal(manifest.frames.length, 84);
  assert.equal(new Set(manifest.frames.map(({ rgbaSha256 }) => rgbaSha256)).size, 84);
  manifest.frames.forEach((frame, index) => {
    const row = Math.floor(index / COLUMNS.length);
    const column = index % COLUMNS.length;
    assert.equal(frame.characterId, ROWS[row]);
    assert.equal(frame.tag, COLUMNS[column]);
    assert.deepEqual(frame.rect, [column * 32, row * 48, 32, 48]);
    assert.deepEqual(frame.pivot, [16, 44]);
    assert.deepEqual(frame.footPoint, [16, 44]);
  });
  assert.deepEqual(Object.keys(manifest.paletteIds), ROWS);
  assert.deepEqual(manifest.characterIdentity.lise.lineage, NIKOLA_LINEAGE);
  assert.equal(manifest.validation.legacyFrameCount, 60);
  assert.equal(manifest.validation.legacyFrameRgbaSha256Digest, LEGACY_FRAME_DIGEST);
  assert.equal(manifest.review.runtimeIntegration, 'current-browser-selectable-field-leader-two-phase-directional-walk-interact-hurt');
  assert.equal(manifest.review.fullAnimationExpansion, 'alternate-action-facings-and-additional-inbetweens-pending');

  const legacyLines = manifest.frames
    .filter(({ tag }) => LEGACY_COLUMNS.includes(tag))
    .map(({ id, rgbaSha256 }) => `${id}:${rgbaSha256}`)
    .join('\n') + '\n';
  assert.equal(sha256(Buffer.from(legacyLines)), LEGACY_FRAME_DIGEST);
});

test('transparent runtime PNG matches its manifest and shipped hashes and preserves every frame gutter', async () => {
  const [manifestText, bytes, runtimeBytes] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'party-field-foundation.png')),
    readFile(resolve(GAME_ROOT, 'assets', 'art', 'party-field-suite', 'party-field-foundation.png')),
  ]);
  const manifest = JSON.parse(manifestText);
  const record = manifest.exports.find(({ purpose }) => purpose === 'transparent-runtime-candidate');
  assert.ok(record);
  assert.equal(sha256(bytes), record.sha256);
  assert.equal(sha256(runtimeBytes), record.sha256);
  assert.equal(runtimeBytes.equals(bytes), true);
  const image = decodeRgbaPng(bytes);
  assert.deepEqual([image.width, image.height], [448, 288]);
  for (const frame of manifest.frames) {
    assert.equal(sha256(rgbaFrameBytes(image, frame)), frame.rgbaSha256, frame.id);
  }
  for (let row = 0; row < ROWS.length; row += 1) {
    for (let column = 0; column < COLUMNS.length; column += 1) {
      const x0 = column * 32;
      const y0 = row * 48;
      for (let x = 0; x < 32; x += 1) {
        assert.equal(alphaAt(image, x0 + x, y0), 0);
        assert.equal(alphaAt(image, x0 + x, y0 + 47), 0);
        assert.equal(alphaAt(image, x0 + x, y0 + 46), 0);
        assert.equal(alphaAt(image, x0 + x, y0 + 45), 0);
      }
      for (let y = 0; y < 48; y += 1) {
        assert.equal(alphaAt(image, x0, y0 + y), 0);
        assert.equal(alphaAt(image, x0 + 31, y0 + y), 0);
      }
    }
  }
});

test('contact sheet is labeled review material and builder has no generated-art input path', async () => {
  const [manifestText, contactBytes, builderText] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'party-field-foundation-contact-sheet.png')),
    readFile(resolve(SUITE_ROOT, 'build_party_field_suite.py'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const contact = manifest.exports.find(({ purpose }) => purpose === 'labeled-review-only-not-runtime');
  assert.deepEqual([contact.width, contact.height], [1888, 1210]);
  assert.equal(sha256(contactBytes), contact.sha256);
  assert.doesNotMatch(builderText, /assets[\\/](?:production|concepts)/iu);
  assert.doesNotMatch(builderText, /Adam Driver|celebrity likeness|\bofuda\b|\bkamon\b/iu);
});
