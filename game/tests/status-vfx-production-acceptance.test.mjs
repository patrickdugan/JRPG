import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const suiteDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'art', 'status-vfx-suite');
const runtimeAtlasPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'art', 'status-vfx-suite', 'status-vfx-atlas.png');
const read = (name) => readFileSync(join(suiteDir, name));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(read('manifest.json'));
const source = JSON.parse(read('status-vfx-suite.source.json'));

const FRAME_HASHES = Object.freeze({
  'dread:apply': '1aa15c3ca7954874fc60f061f2e0d3c9e5fb5e4ecac0d4e21a5a3152dfd43927',
  'dread:active': '82b5401b963fa0768731b2b5c2178a86327d1e28235896208a23ae961f600dbd',
  'dread:expire': '0c543773d516cf2874d9581a0f5c5f30b120ec7747d9f956b7ead985e59cd975',
  'chill:apply': '955820d4dad1892889d2c5099c676288bac8292659a6d0a344a5b93634c80823',
  'chill:active': '4c170f5fc78909807c2807a5e8aae710b7ecd0590d084edf7f8af55431ef66e2',
  'chill:expire': 'e5d856656b2b7917e53f9529584a13a259c0ec0bc7d8883ec645737afcfb631a',
  'shock:apply': '99df6a54b9a7d8d56ed62efdf37831039eb5c001c54a53132e940ce0faa1c882',
  'shock:active': '0095c378d147d4f65e4f0f87f77bda7506073c7abab83ee73bb06a4ffb01aea2',
  'shock:expire': 'fe26120c9db769712b95eb53c06d3c596e1b4600cdc74f0baf60cf9acfe2b606',
  'scorch:apply': '665946647f47bf6f5a8f9ec0d5eaa9acba03bb7fc9b6c5d74c26034333434535',
  'scorch:active': '45fc7567ec5a67d781418273b81ff6ea61a8ec135de8d07e910fd2421547a2df',
  'scorch:expire': '3807ebd738fd614c0951069e4b395fd0aa154ffea26260101a2b655e1a06acd3',
  'bound:apply': '6ee46778ffa14bf9947028cd6b499591a9c7f92a88d2854881bc30781e172307',
  'bound:active': '5c16c9ab8fbc699d0aae793014cc11781f4b603c754fb492671c8a2a97733e52',
  'bound:expire': '3a8b8e1bde891a5d62820b740dca2a01faa2cca520b2cde78e2af20c3b5e82fb',
  'overheated:apply': '67959d9c74fe82051a164b72a4b776e247ea95856d3bf227d710c81769b16c87',
  'overheated:active': 'ed20698060d101b2811a56b73fcce747fa4d7367c3b9601aaaf7b87328f605ee',
  'overheated:expire': '103d8b92a55d210366d4f5bb01f21ae47009c282d0af0a2f2a8fb7e9c0c7d7f0',
});

function pngIhdr(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20),
    bitDepth: bytes[24], colorType: bytes[25], compression: bytes[26],
    filter: bytes[27], interlace: bytes[28],
  };
}

test('status VFX suite rebuilds byte-identically on repeated checks', () => {
  for (let pass = 0; pass < 2; pass += 1) {
    const output = execFileSync('python', ['build_status_vfx_suite.py', '--check'], { cwd: suiteDir, encoding: 'utf8' });
    assert.match(output, /byte-identical/);
  }
});

test('status VFX exports and runtime copy have exact manifested PNG contracts', () => {
  const atlasExport = manifest.exports.find(({ role }) => role === 'transparent-runtime-atlas');
  const contactExport = manifest.exports.find(({ role }) => role === 'labeled-review-contact-sheet');
  const atlas = read(atlasExport.path);
  const contact = read(contactExport.path);
  const runtime = readFileSync(runtimeAtlasPath);
  assert.deepEqual(pngIhdr(atlas), atlasExport.ihdr);
  assert.deepEqual(pngIhdr(contact), contactExport.ihdr);
  assert.deepEqual(atlasExport.ihdr, {
    width: 96, height: 192, bitDepth: 8, colorType: 6,
    compression: 0, filter: 0, interlace: 0,
  });
  assert.deepEqual([contactExport.ihdr.width, contactExport.ihdr.height, contactExport.ihdr.colorType], [424, 964, 2]);
  assert.equal(digest(atlas), 'b05c0376e5ed60ef53579cbbc9e56da090bb2c70c0cbb922fec54d4e1d4d0232');
  assert.equal(digest(contact), '9c10395db8aebcb771e7968ea088e5717a8e8b607d2cfc5f9272208eb5fbf0e9');
  assert.equal(runtime.equals(atlas), true);
});

test('all 18 lifecycle frames retain exact hashes, anchors, distinct shapes, and gutters', () => {
  assert.deepEqual(manifest.geometry, {
    columns: 3, rows: 6, cellWidth: 32, cellHeight: 32,
    minimumTransparentGutter: 3, coordinateOrigin: 'top-left',
  });
  assert.deepEqual(manifest.stateOrder, ['apply', 'active', 'expire']);
  assert.equal(manifest.frames.length, 18);
  assert.equal(new Set(manifest.frames.map(({ rgbaSha256 }) => rgbaSha256)).size, 18);
  assert.equal(new Set(manifest.frames.map(({ alphaSha256 }) => alphaSha256)).size, 18);
  for (const frame of manifest.frames) {
    assert.equal(frame.rgbaSha256, FRAME_HASHES[frame.id], frame.id);
    assert.deepEqual(frame.rect, { x: frame.column * 32, y: frame.row * 32, width: 32, height: 32 });
    assert.deepEqual(frame.pivot, [16, 16]);
    assert.deepEqual(frame.actorAnchor, [16, 24]);
    assert.ok(Object.values(frame.transparentGutter).every((gutter) => gutter >= 3));
    assert.ok(frame.opaquePixelCount >= 24);
  }
});

test('source and manifest state only reachable signals and original non-sacred vocabulary', () => {
  assert.deepEqual(manifest.signalContract, {
    apply: { events: ['status-applied', 'status-refreshed'], animation: 'status-glyph' },
    active: { snapshot: 'actor.statuses' },
    expire: { events: ['status-expired'] },
    cleanse: null,
  });
  assert.match(source.unsupportedSignals.join(' '), /no status-cleanse event/i);
  const copy = source.statuses.map(({ motif }) => motif).join('\n').toLowerCase();
  for (const term of ['torii', 'kamon', 'coat of arms', 'crucifix', 'mandala', 'shimenawa', 'rosary', 'reliquary', 'sutra']) {
    assert.equal(copy.includes(term), false, term);
  }
  assert.match(manifest.originality, /Original integer-pixel primitives/);
  for (const entry of manifest.sources) assert.equal(digest(read(entry.path)), entry.sha256);
});
