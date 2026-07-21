import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(GAME_ROOT, '..');
const SUITE_ROOT = resolve(REPO_ROOT, 'assets', 'art', 'party-combat-suite');
const FIELD_SOURCE_PATH = resolve(REPO_ROOT, 'assets', 'art', 'party-field-suite', 'party-field-suite.source.json');
const ROWS = ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'];
const COLUMNS = ['idle', 'move', 'guard', 'hit', 'basic-strike-windup', 'basic-strike-active', 'signature-a', 'signature-b', 'recovery', 'defeat'];

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
    } else if (type === 'IDAT') idat.push(data);
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
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth(left, above, upperLeft)][filter];
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

function alphaAt(image, x, y) {
  return image.pixels[pixelOffset(image, x, y) + 3];
}

function cellBytes(image, column, row) {
  const bytes = Buffer.alloc(48 * 64 * 4);
  for (let y = 0; y < 64; y += 1) {
    const source = pixelOffset(image, column * 48, row * 64 + y);
    image.pixels.copy(bytes, y * 48 * 4, source, source + 48 * 4);
  }
  return bytes;
}

test('combat source fixes the canonical six-by-ten 48x64 action contract', async () => {
  const source = JSON.parse(await readFile(resolve(SUITE_ROOT, 'party-combat-suite.source.json'), 'utf8'));
  assert.equal(source.authorship, 'original-code-native-pixel-primitives');
  assert.equal(source.canonicalFieldSource, '../party-field-suite/party-field-suite.source.json');
  assert.deepEqual(source.frame, {
    width: 48,
    height: 64,
    pivot: [24, 58],
    footPoint: [24, 58],
    minimumTransparentGutter: 4,
  });
  assert.deepEqual(source.sheet.rows, ROWS);
  assert.deepEqual(source.sheet.columns, COLUMNS);
  assert.deepEqual(source.characters.map(({ id }) => id), ROWS);
  assert.deepEqual(Object.keys(source.actions), COLUMNS);
  assert.equal(source.actions['basic-strike-active'].event, 'damage');
  assert.equal(source.actions['signature-a'].event, 'skill-a');
  assert.equal(source.actions['signature-b'].event, 'skill-b');
  const nikola = source.characters.find(({ id }) => id === 'lise');
  assert.equal(nikola.name, 'Nikola Dražanić');
  assert.equal(nikola.legacyCompatibilityId, 'lise');
  assert.match(nikola.likenessPolicy, /original fictional Croatian male face and proportions; no real-person or actor reference/u);
  assert.match(source.characters.find(({ id }) => id === 'mateus').likenessPolicy, /original fictional face and proportions; no real-person reference/u);
});

test('manifest reuses every canonical field palette and silhouette exactly', async () => {
  const [manifestText, fieldText] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(FIELD_SOURCE_PATH, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const field = JSON.parse(fieldText);
  assert.deepEqual(manifest.rowOrder, ROWS);
  assert.deepEqual(manifest.columnOrder, COLUMNS);
  assert.deepEqual(manifest.geometry, {
    columns: 10,
    rows: 6,
    cellWidth: 48,
    cellHeight: 64,
    sheetWidth: 480,
    sheetHeight: 384,
    pivot: [24, 58],
    footPoint: [24, 58],
    minimumTransparentGutter: 4,
  });
  for (const canonical of field.characters) {
    assert.deepEqual(manifest.paletteAndSilhouetteReuse[canonical.id], {
      paletteId: canonical.paletteId,
      silhouette: canonical.silhouette,
      colors: canonical.colors,
    });
  }
  const fieldRecord = manifest.sources.find(({ role }) => role === 'canonical-palette-and-silhouette-contract');
  assert.equal(fieldRecord.sha256, hash(Buffer.from(fieldText)));
});

test('all 60 manifested frames have stable pivots, exact hit anchors, events, and distinct pixels', async () => {
  const manifest = JSON.parse(await readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'));
  assert.equal(manifest.frames.length, 60);
  assert.equal(new Set(manifest.frames.map(({ rgbaSha256 }) => rgbaSha256)).size, 60);
  manifest.frames.forEach((frame, index) => {
    const row = Math.floor(index / 10);
    const column = index % 10;
    const action = manifest.actionSemantics[COLUMNS[column]];
    assert.equal(frame.id, `${ROWS[row]}:${COLUMNS[column]}`);
    assert.deepEqual(frame.rect, [column * 48, row * 64, 48, 64]);
    assert.deepEqual(frame.pivot, [24, 58]);
    assert.deepEqual(frame.footPoint, [24, 58]);
    assert.deepEqual(frame.hitAnchor, action.hitAnchor);
    assert.equal(frame.phase, action.phase);
    assert.equal(frame.event, action.event);
    assert.ok(frame.localAlphaBounds[0] >= 4 && frame.localAlphaBounds[1] >= 4);
    assert.ok(frame.localAlphaBounds[2] <= 44 && frame.localAlphaBounds[3] <= 60);
  });
});

test('runtime-candidate atlas is exact, binary-transparent, guttered, and byte-identical to its manifest and browser copy', async () => {
  const [manifestText, atlasBytes, runtimeBytes] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'party-combat-actions.png')),
    readFile(resolve(GAME_ROOT, 'assets', 'art', 'party-combat-suite', 'party-combat-actions.png')),
  ]);
  const manifest = JSON.parse(manifestText);
  const record = manifest.exports.find(({ role }) => role === 'transparent-runtime-candidate');
  assert.deepEqual([record.width, record.height, record.mode], [480, 384, 'RGBA']);
  assert.equal(hash(atlasBytes), record.sha256);
  assert.equal(runtimeBytes.equals(atlasBytes), true, 'browser and production party combat atlases must be byte-identical');
  const image = decodeRgbaPng(atlasBytes);
  assert.deepEqual([image.width, image.height], [480, 384]);
  const alphaValues = new Set();
  for (let index = 3; index < image.pixels.length; index += 4) alphaValues.add(image.pixels[index]);
  assert.deepEqual([...alphaValues].sort((a, b) => a - b), [0, 255]);
  const actualHashes = new Set();
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      actualHashes.add(hash(cellBytes(image, column, row)));
      const x0 = column * 48;
      const y0 = row * 64;
      for (let inset = 0; inset < 4; inset += 1) {
        for (let x = 0; x < 48; x += 1) {
          assert.equal(alphaAt(image, x0 + x, y0 + inset), 0);
          assert.equal(alphaAt(image, x0 + x, y0 + 63 - inset), 0);
        }
        for (let y = 0; y < 64; y += 1) {
          assert.equal(alphaAt(image, x0 + inset, y0 + y), 0);
          assert.equal(alphaAt(image, x0 + 47 - inset, y0 + y), 0);
        }
      }
    }
  }
  assert.equal(actualHashes.size, 60, 'every character/action key must have distinct RGBA pixels');
});

test('contact sheet is review-only and the builder has no generated raster input', async () => {
  const [manifestText, contactBytes, builderText] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'party-combat-actions-contact-sheet.png')),
    readFile(resolve(SUITE_ROOT, 'build_party_combat_suite.py'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const record = manifest.exports.find(({ role }) => role === 'labeled-review-only-not-runtime');
  assert.deepEqual([record.width, record.height], [1556, 1222]);
  assert.equal(hash(contactBytes), record.sha256);
  assert.equal(manifest.runtimeIntegration, 'current-browser-battle-key-poses');
  assert.doesNotMatch(builderText, /assets[\\/](?:production|concepts)|Adam Driver|celebrity likeness/iu);
});
