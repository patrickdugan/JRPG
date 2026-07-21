import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(GAME_ROOT, '..');
const SUITE_ROOT = resolve(REPO_ROOT, 'assets', 'art', 'party-portrait-suite');
const FIELD_SOURCE_PATH = resolve(REPO_ROOT, 'assets', 'art', 'party-field-suite', 'party-field-suite.source.json');
const ROWS = ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku'];
const COLUMNS = ['neutral', 'resolve', 'strain', 'soften', 'concern', 'anger', 'surprise', 'quiet'];
const NIKOLA_LINEAGE = {
  birthAndStation: 'Croatian-born frontier minor aristocrat',
  claimedDescent: 'Nikola claims a Wallachian covenant line transmitted through noblewomen',
  englishAncestry: 'Nikola is English through his fictional mother Margaret Wychmere',
  inheritanceChain: 'the supposed male line is repeatedly rebuilt through heiresses and marriage contracts exchanging refuge, money, land, ships, and protection',
  affiliation: 'Covenant of the Severed Dragon',
  historicity: 'entirely invented alternate-history lore; makes no real-world claim that vampires, vampire hunters, or this Covenant existed',
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

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
  const compressed = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8);
      assert.equal(data[9], 6, 'portrait runtime candidate must use true RGBA');
      assert.equal(data[12], 0);
    } else if (type === 'IDAT') compressed.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  const packed = inflateSync(Buffer.concat(compressed));
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

const pixelOffset = (image, x, y) => (y * image.width + x) * 4;
const alphaAt = (image, x, y) => image.pixels[pixelOffset(image, x, y) + 3];

function cellBytes(image, column, row) {
  const output = Buffer.alloc(64 * 64 * 4);
  for (let y = 0; y < 64; y += 1) {
    const start = pixelOffset(image, column * 64, row * 64 + y);
    image.pixels.copy(output, y * 64 * 4, start, start + 64 * 4);
  }
  return output;
}

test('portrait source defines the exact six-by-eight expression and originality contract', async () => {
  const source = JSON.parse(await readFile(resolve(SUITE_ROOT, 'party-portrait-suite.source.json'), 'utf8'));
  assert.equal(source.authorship, 'original-code-native-pixel-primitives');
  assert.equal(source.canonicalFieldSource, '../party-field-suite/party-field-suite.source.json');
  assert.deepEqual(source.frame, { width: 64, height: 64, minimumTransparentGutter: 4 });
  assert.deepEqual(source.atlas, { width: 512, height: 384, contentWidth: 512, transparentRightPadding: 0 });
  assert.deepEqual(source.sheet.rows, ROWS);
  assert.deepEqual(source.sheet.columns, COLUMNS);
  assert.deepEqual(Object.keys(source.expressions), COLUMNS);
  assert.deepEqual(source.characters.map(({ id }) => id), ROWS);
  const nikola = source.characters.find(({ id }) => id === 'lise');
  assert.equal(nikola.name, 'Nikola Dražanić');
  assert.equal(nikola.legacyCompatibilityId, 'lise');
  assert.deepEqual(nikola.lineage, NIKOLA_LINEAGE);
  assert.equal(nikola.faceShape, 'square-angular-male');
  assert.equal(nikola.facialHair, 'narrow-moustache-and-trim-pointed-beard');
  assert.match(nikola.likenessPolicy, /original fictional Croatian-English male face and proportions; no real-person or actor reference/u);
  const mateus = source.characters.find(({ id }) => id === 'mateus');
  assert.match(mateus.likenessPolicy, /original fictional face, age lines, proportions, and hair; no real-person or actor reference/u);
  assert.doesNotMatch(JSON.stringify(source), /Adam Driver|celebrity likeness/iu);
});

test('manifest preserves canonical palette/costume motifs and exact expression anchors', async () => {
  const [manifestText, sourceText, fieldText] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'party-portrait-suite.source.json'), 'utf8'),
    readFile(FIELD_SOURCE_PATH, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const source = JSON.parse(sourceText);
  const field = JSON.parse(fieldText);
  assert.deepEqual(manifest.geometry, {
    columns: 8,
    rows: 6,
    cellWidth: 64,
    cellHeight: 64,
    contentWidth: 512,
    contentHeight: 384,
    sheetWidth: 512,
    sheetHeight: 384,
    transparentRightPadding: 0,
    minimumTransparentGutter: 4,
  });
  assert.deepEqual(manifest.rowOrder, ROWS);
  assert.deepEqual(manifest.columnOrder, COLUMNS);
  for (const character of field.characters) {
    assert.deepEqual(manifest.paletteCostumeReuse[character.id], {
      paletteId: character.paletteId,
      colors: character.colors,
      silhouette: character.silhouette,
    });
  }
  const byId = Object.fromEntries(source.characters.map((entry) => [entry.id, entry]));
  assert.deepEqual(manifest.characterIdentity.lise.lineage, byId.lise.lineage);
  manifest.frames.forEach((frame, index) => {
    const row = Math.floor(index / 8);
    const column = index % 8;
    const anchors = byId[ROWS[row]].anchors;
    assert.equal(frame.id, `${ROWS[row]}:${COLUMNS[column]}`);
    assert.deepEqual(frame.rect, [column * 64, row * 64, 64, 64]);
    assert.deepEqual(frame.eyeLine, anchors.eyeLine);
    assert.deepEqual(frame.mouthAnchor, anchors.mouth);
    assert.deepEqual(frame.focusAnchor, anchors.focus);
    assert.deepEqual(frame.expressionSemantic, source.expressions[COLUMNS[column]]);
    assert.ok(frame.localAlphaBounds[0] >= 4 && frame.localAlphaBounds[1] >= 4);
    assert.ok(frame.localAlphaBounds[2] <= 60 && frame.localAlphaBounds[3] <= 60);
  });
});

test('transparent portrait atlas is exact, binary-alpha, guttered, hashed, distinct, and byte-identical in the browser', async () => {
  const [manifestText, bytes, runtimeBytes] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'party-portrait-expressions.png')),
    readFile(resolve(GAME_ROOT, 'assets', 'art', 'party-portrait-suite', 'party-portrait-expressions.png')),
  ]);
  const manifest = JSON.parse(manifestText);
  const record = manifest.exports.find(({ role }) => role === 'transparent-runtime-candidate');
  assert.deepEqual([record.width, record.height, record.mode], [512, 384, 'RGBA']);
  assert.equal(sha256(bytes), record.sha256);
  assert.equal(runtimeBytes.equals(bytes), true, 'browser and production portrait atlases must be byte-identical');
  const image = decodeRgbaPng(bytes);
  assert.deepEqual([image.width, image.height], [512, 384]);
  const alphaValues = new Set();
  for (let index = 3; index < image.pixels.length; index += 4) alphaValues.add(image.pixels[index]);
  assert.deepEqual([...alphaValues].sort((a, b) => a - b), [0, 255]);
  const actualHashes = new Set();
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      actualHashes.add(sha256(cellBytes(image, column, row)));
      const x0 = column * 64;
      const y0 = row * 64;
      for (let inset = 0; inset < 4; inset += 1) {
        for (let x = 0; x < 64; x += 1) {
          assert.equal(alphaAt(image, x0 + x, y0 + inset), 0);
          assert.equal(alphaAt(image, x0 + x, y0 + 63 - inset), 0);
        }
        for (let y = 0; y < 64; y += 1) {
          assert.equal(alphaAt(image, x0 + inset, y0 + y), 0);
          assert.equal(alphaAt(image, x0 + 63 - inset, y0 + y), 0);
        }
      }
    }
  }
  assert.equal(actualHashes.size, 48);
  assert.equal(new Set(manifest.frames.map(({ rgbaSha256 }) => rgbaSha256)).size, 48);
});

test('labeled contact sheet is review-only and builder has no generated raster dependency', async () => {
  const [manifestText, contactBytes, builderText] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'party-portrait-expressions-contact-sheet.png')),
    readFile(resolve(SUITE_ROOT, 'build_party_portrait_suite.py'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const contact = manifest.exports.find(({ role }) => role === 'labeled-review-only-not-runtime');
  assert.deepEqual([contact.width, contact.height], [1648, 1220]);
  assert.equal(sha256(contactBytes), contact.sha256);
  assert.equal(manifest.runtimeIntegration, 'current-browser-camp-and-scene-focus');
  assert.equal(manifest.review.mateusOriginalityConstraint, 'applied');
  assert.doesNotMatch(builderText, /assets[\\/](?:production|concepts)|Adam Driver|celebrity likeness/iu);
});
