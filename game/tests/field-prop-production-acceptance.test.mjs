import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { test } from 'node:test';

const ROOT = new URL('../../assets/art/field-prop-suite-v1/', import.meta.url);
const RUNTIME = new URL('../assets/art/field-prop-suite-v1/field-prop-atlas.png', import.meta.url);
const SHADOW = [11, 16, 32, 112];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const textSha256 = (bytes) => sha256(Buffer.from(bytes.toString('utf8').replace(/\r\n/gu, '\n'), 'utf8'));

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
      assert.equal(data[8], 8, 'field prop atlas must use 8-bit channels');
      assert.equal(data[9], 6, 'field prop atlas must be RGBA');
      assert.equal(data[12], 0, 'field prop atlas must not be interlaced');
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

test('field prop builder check is non-writing, current, and byte-identical', () => {
  const output = execFileSync('python', [fileURLToPath(new URL('build_field_prop_suite.py', ROOT)), '--check'], {
    cwd: fileURLToPath(ROOT), encoding: 'utf8',
  });
  assert.match(output, /field prop suite is deterministic and current/u);
});

test('field prop source and manifest keep provenance, palette, and cultural boundaries', async () => {
  const [sourceBytes, manifestBytes, builderBytes, requirements, readme] = await Promise.all([
    readFile(new URL('field-prop-suite.source.json', ROOT)),
    readFile(new URL('manifest.json', ROOT)),
    readFile(new URL('build_field_prop_suite.py', ROOT)),
    readFile(new URL('requirements.txt', ROOT), 'utf8'),
    readFile(new URL('README.md', ROOT), 'utf8'),
  ]);
  const source = JSON.parse(sourceBytes);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(source.authorship, 'original-code-native-pixel-primitives');
  assert.equal(manifest.provenanceLane, 'pixel-authored-production');
  assert.equal(manifest.sourceSha256, textSha256(sourceBytes));
  assert.equal(manifest.builderSha256, textSha256(builderBytes));
  assert.equal(manifest.pillowVersion, '11.3.0');
  assert.equal(requirements.trim(), 'Pillow==11.3.0');
  assert.equal(manifest.twoIndependentRendersByteIdentical, true);
  assert.equal(manifest.externalCulturalReview, 'pending');
  assert.equal(manifest.artLock, false);
  assert.equal(manifest.frameCount, 216);
  assert.deepEqual(manifest.frameKinds, { structure: 120, prop: 72, 'wide-prop': 16, 'tall-prop': 8 });
  assert.equal(manifest.distinctFrameHashes, 216);
  for (const [family, count] of Object.entries(manifest.palette.perFamily)) {
    assert.ok(count <= 48, `${family} exceeds the 48-colour family budget`);
  }
  const restrictions = source.restrictions.join(' ').toLowerCase();
  for (const phrase of ['never define collision', 'no text', 'sacred objects', 'no real insignia', 'no image generator', 'walkable cells']) {
    assert.match(restrictions, new RegExp(phrase, 'u'));
  }
  assert.doesNotMatch(readme, /hand-pixeled|hand-authored/iu);
  assert.match(readme, /pixel-authored production/iu);
});

test('field prop atlas and runtime copy are exact manifested RGBA frames with binary art alpha', async () => {
  const [atlasBytes, runtimeBytes, manifestBytes, contactBytes] = await Promise.all([
    readFile(new URL('field-prop-atlas.png', ROOT)),
    readFile(RUNTIME),
    readFile(new URL('manifest.json', ROOT)),
    readFile(new URL('field-prop-contact-sheet.png', ROOT)),
  ]);
  const manifest = JSON.parse(manifestBytes);
  assert.deepEqual(runtimeBytes, atlasBytes);
  assert.deepEqual(manifest.exports.find((entry) => entry.purpose === 'transparent-runtime-atlas'), {
    file: 'field-prop-atlas.png', purpose: 'transparent-runtime-atlas', width: 256, height: 416, mode: 'RGBA', sha256: sha256(atlasBytes),
  });
  const contact = manifest.exports.find((entry) => entry.file === 'field-prop-contact-sheet.png');
  assert.equal(contact.sha256, sha256(contactBytes));
  assert.match(contact.purpose, /review-only/u);

  const decoded = decodeRgbaPng(atlasBytes);
  assert.deepEqual([decoded.width, decoded.height], [256, 416]);
  for (const frame of manifest.frames) {
    const raw = cropRgba(decoded, frame.rect);
    assert.equal(sha256(raw), frame.rgbaSha256, frame.id);
    let opaque = 0;
    for (let offset = 0; offset < raw.length; offset += 4) {
      const alpha = raw[offset + 3];
      assert.ok(alpha === 0 || alpha === 255 || alpha === SHADOW[3], `${frame.id} has partial alpha ${alpha}`);
      if (alpha === SHADOW[3]) assert.deepEqual([...raw.subarray(offset, offset + 4)], SHADOW, `${frame.id} shadow drifted`);
      if (alpha === 255) opaque += 1;
    }
    assert.ok(opaque > 0, `${frame.id} is empty`);
    if (frame.kind === 'structure') {
      assert.ok(opaque / (frame.rect[2] * frame.rect[3]) >= 0.6, `${frame.id} does not read as a solid mass`);
    }
  }
});
