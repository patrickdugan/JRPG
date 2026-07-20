import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ENEMY_FAMILIES } from '../enemy-atlas.mjs';

const suiteDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'art', 'enemy-combat-suite');
const runtimeAtlasPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'art', 'enemy-combat-suite', 'enemy-combat-atlas.png');
const read = (name) => readFileSync(join(suiteDir, name));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(read('manifest.json'));
const source = JSON.parse(read('enemy-combat-suite.source.json'));

const LEGACY_RGBA_SHA256_BY_FRAME = Object.freeze({
  'hound:neutral': '9f9352d745b9af0d6b63fb5acd0a4ff5bb5eb562ff6dc3da2b0775e8f5b0c902',
  'hound:windup': '38b762da1821049af32854efb45f8583764d9c9e0a05e4e92cfbf82baa5c668f',
  'hound:attack': '12c2f2365508a98b93b9ce13b667a4148a7e88e9d5962b158983bceeaddf8b90',
  'hound:stagger': '2bb7b64b951e811f7ac6e04258e16b21e9e19283f29069dac9fec6af38a76b8e',
  'hound:defeat': 'e6b52f5619eb14cfe76c3cd3167217adff4d6c78cbf5f3c7124d2aad0b19594d',
  'wisp:neutral': 'ee53ef8edd03c17fd061d302868870d9adb45f9aa819ab89d4649be7f7050da6',
  'wisp:windup': '617896847bf375d5ad2a26f3c3bf339f8471d2b6158e80fdb7be7809cdeda841',
  'wisp:attack': '5a24e24ffbcd43268c7729c35001a27b2857a7f52d815c8db79c9aa378beb68d',
  'wisp:stagger': '85c07cc7db7417926af30632ee470eee689668f1ac13bdbdc7bad1e864ca936b',
  'wisp:defeat': 'b9617ac3dc9e9878e2901bd2abc377d8dddf7d794916092b1a3fc86e1d77723a',
  'ashen-oni:neutral': '28d54caefad11c6742007eab026373ff3fe29a8a972f4ff6186c21d6d3b329f4',
  'ashen-oni:windup': '6820e20f41a0db09bff048b694b398f10f8e5a56d5e398b67dad679e493b94d0',
  'ashen-oni:attack': '64b333a86572bd05db7fbff272609142028e75c4d39ba84c207571fdbc7a014b',
  'ashen-oni:stagger': 'f30050e418a9b1d0cfb549356e0fbe70a93a27a0fb999f426b9d6ffc0073a533',
  'ashen-oni:defeat': '393a1ffb87165baea4b0a29e04f65e23eb20848724c03ea1aaa9c893c25ec110',
  'court-retainer:neutral': '95f26370f57cfbcf5b592a5c67c42587d4fc9585da17aab36af52469b43de7b2',
  'court-retainer:windup': '901699754c70da5b47a2b44a7d1d22261748a47fa0522dc20447aec712d539af',
  'court-retainer:attack': 'a0feb43a8ea7ef4e2fe4d5a5565065deee664537186600ab28df1c73c3d2b83f',
  'court-retainer:stagger': 'bad222a278fc6772e270564ea2198961febad296166ce0d08ffccda1381fa548',
  'court-retainer:defeat': '09dc8a213812083152d9567e50547c6eddaacb973e2f5901e11c68177ec4ef7a',
  'widow:neutral': '7c59835aceb8aac50d9e347cd7695bb8ef1b28a89a40926dee23b07103bc4403',
  'widow:windup': 'a724d45b685ff05edfefc4879085e5985f0cbdfe952e0f46f7b0c378c5075e87',
  'widow:attack': 'aca0642e4ecd9f3921b41fedf843c6b91ff28ba72dd793741460a447d3a62126',
  'widow:stagger': '7c82ccef27d85a53c6cd73000b4bf3b43a2b7cf7aaba96fcd10b29c3998c31df',
  'widow:defeat': '3d89d995f1375ea7b36ed41a4a4c200b70955bbff116feca722fec917b445e4e',
  'furnace:neutral': 'd1c7a2a78c71950b003e9dcf3e53e3b2bc7de8fa04b922b41c358d7bf670ee67',
  'furnace:windup': 'd5469be1c3c802ac9bcc48954c021e1cf7abf1b83c52b00357ce9ee1a6c12089',
  'furnace:attack': '867e7ac5ba9673979c22bcdfd5489cc86078877409166c0b2a48f95e6b487c3c',
  'furnace:stagger': '805786a3876bdedcc7de82964efcf5399c8c275b3ea63d528c8a9fc6758629ba',
  'furnace:defeat': '574503485a108905d20d864eddbe137e31d9decfb7a2a346a65f66e94d84176b',
  'bell-warden:neutral': '19e83fbd19f7042a80765e397d9e543ba3590eb34968858fb543f5a5dac2f089',
  'bell-warden:windup': '4b6bdc20cb193811bbadad6b18a0d1c525a4b017e9f11d5896903b904927206a',
  'bell-warden:attack': 'ad968391fb87d80247daa1a634de33ece0e3444a44e2af66ef4ebaaf29d6f61e',
  'bell-warden:stagger': '1775ebfc57971eec50a513dd90f7ddea2516e1fed094f0b20752c33eebfba701',
  'bell-warden:defeat': '1dae986f9acdb6c2ba5c7ed84215567f5729ebe67684c619c5a0f2917705ce0e',
  'black-court:neutral': '45467dac0b1a0a5381e6b9da763c4e0d699af3d46ee4d83c1401440269ee764a',
  'black-court:windup': 'af00eeff07194e4dd6ea3a98866de9adf352f3be05a8766c4b6a45f93ec65a9c',
  'black-court:attack': 'ea253c14ce27ca59abb87950182a0e4efad0eb1c59e06f06d2ea1ce0c6a44925',
  'black-court:stagger': '267f533dae675fcde1f4f1192e80b3a8f4fb5fb7748ef5e2207018f503ee4a49',
  'black-court:defeat': 'ba0af71b2eb8c7fa0a095c550e31e951ec1de36ebe2d03302e4ad120117b05fc',
});

const RECOVERY_EXPECTATIONS = Object.freeze({
  hound: ['f041065c321c68885f1028c4e298678a07a00fd17526e36f5685b14a7a828df1', [30, 65], [30, 72], [50, 55], [8, 40, 4, 5]],
  wisp: ['b22704f6297eaf100c1717d44d567e3dd9ccb0857b7af649a9519d453b8b2e81', [32, 54], [32, 72], [48, 50], [9, 29, 6, 5]],
  'ashen-oni': ['5ae752e2f7cea268b87e38b45367e3424cd78a2bdbbd0a7ce646056cd6bb5e4f', [30, 64], [30, 73], [49, 55], [8, 19, 6, 5]],
  'court-retainer': ['13316913d59c910110d7b936552c4c1f5ae35d8728139f2a9fb33ce5967262e8', [29, 63], [29, 72], [49, 54], [11, 18, 6, 5]],
  widow: ['56755d4dcac583173e2eb1730c4ed3ea9a3dce9d85a460af7fda0ca91b379a00', [30, 56], [30, 72], [48, 52], [8, 23, 6, 5]],
  furnace: ['3bcef8040baddf03a864cfd4ab248e8ad02bdc4fd9af412caf362debe3963f8f', [30, 63], [30, 73], [49, 56], [8, 18, 6, 5]],
  'bell-warden': ['3564bbe423c72c21b8e509db7b8995cb0056b9cf04d8808d0f9894610a75dbff', [30, 63], [30, 73], [49, 54], [8, 19, 5, 5]],
  'black-court': ['9572d80ca781561de35074802300e5d89d34af1087b973ba19deaa6006baa364', [30, 62], [30, 73], [49, 53], [9, 13, 6, 5]],
});

function pngIhdr(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
    compression: bytes[26],
    filter: bytes[27],
    interlace: bytes[28],
  };
}

test('enemy combat production suite rebuild is byte-identical', () => {
  for (let pass = 0; pass < 2; pass += 1) {
    const output = execFileSync('python', ['build_enemy_combat_suite.py', '--check'], {
      cwd: suiteDir,
      encoding: 'utf8',
    });
    assert.match(output, /byte-identical/);
  }
});

test('enemy combat suite publishes exact transparent atlas geometry and review-only sheet', () => {
  assert.deepEqual(manifest.geometry, {
    columns: 6,
    rows: 8,
    cellWidth: 64,
    cellHeight: 80,
    minimumTransparentGutter: 4,
    coordinateOrigin: 'top-left',
  });
  const atlasExport = manifest.exports.find(({ role }) => role === 'transparent-runtime-atlas');
  const contactExport = manifest.exports.find(({ role }) => role === 'labeled-review-contact-sheet');
  const atlas = read(atlasExport.path);
  const runtimeAtlas = readFileSync(runtimeAtlasPath);
  const contact = read(contactExport.path);
  assert.equal(atlasExport.runtime, true);
  assert.equal(contactExport.runtime, false);
  assert.equal(digest(atlas), atlasExport.sha256);
  assert.equal(digest(runtimeAtlas), atlasExport.sha256);
  assert.equal(runtimeAtlas.equals(atlas), true);
  assert.equal(digest(contact), contactExport.sha256);
  assert.deepEqual(pngIhdr(atlas), atlasExport.ihdr);
  assert.deepEqual(pngIhdr(contact), contactExport.ihdr);
  assert.deepEqual(atlasExport.ihdr, {
    width: 384,
    height: 640,
    bitDepth: 8,
    colorType: 6,
    compression: 0,
    filter: 0,
    interlace: 0,
  });
  assert.equal(contactExport.ihdr.width, 832);
  assert.equal(contactExport.ihdr.height, 1500);
  assert.equal(contactExport.ihdr.colorType, 2);
  assert.equal(manifest.runtimeIntegration, 'current-browser-neutral-windup-attack-stagger-defeat-recovery');
});

test('all live enemy families and templates map to six distinct anchored frames', () => {
  assert.deepEqual(manifest.poseOrder, ['neutral', 'windup', 'attack', 'stagger', 'defeat', 'recovery']);
  assert.deepEqual(
    manifest.familyMappings.map(({ id, row, templateIds }) => ({ id, row, templateIds })),
    ENEMY_FAMILIES.map(({ id, row, templateIds }) => ({ id, row, templateIds })),
  );
  assert.equal(manifest.frames.length, 48);
  const rects = new Set();
  for (const family of ENEMY_FAMILIES) {
    const frames = manifest.frames.filter(({ familyId }) => familyId === family.id);
    assert.deepEqual(frames.map(({ pose }) => pose), manifest.poseOrder);
    assert.equal(new Set(frames.map(({ rgbaSha256 }) => rgbaSha256)).size, 6);
    assert.equal(new Set(frames.map(({ rgbaSha256, alphaBounds }) => (
      `${rgbaSha256}:${JSON.stringify(alphaBounds)}`
    ))).size, 6);
    for (const [column, frame] of frames.entries()) {
      assert.deepEqual(frame.rect, {
        x: column * 64,
        y: family.row * 80,
        width: 64,
        height: 80,
      });
      const rectKey = Object.values(frame.rect).join(',');
      assert.equal(rects.has(rectKey), false);
      rects.add(rectKey);
      assert.ok(frame.opaquePixelCount >= 140);
      assert.ok(Object.values(frame.transparentGutter).every((gutter) => gutter >= 4));
      for (const anchorName of ['pivot', 'ground', 'contact']) {
        const [x, y] = frame[anchorName];
        assert.equal(Number.isSafeInteger(x) && Number.isSafeInteger(y), true);
        assert.ok(x >= 0 && x < 64 && y >= 0 && y < 80);
      }
      assert.equal(frame.paletteId, family.id === 'hound'
        ? 'PAL-ENM-HOUND-01'
        : source.families.find(({ id }) => id === family.id).paletteId);
    }
  }
  assert.equal(rects.size, 48);
});

test('the appended recovery column preserves all 40 prior RGBA hashes exactly', () => {
  assert.equal(Object.keys(LEGACY_RGBA_SHA256_BY_FRAME).length, 40);
  for (const [frameId, expectedHash] of Object.entries(LEGACY_RGBA_SHA256_BY_FRAME)) {
    const frame = manifest.frames.find(({ id }) => id === frameId);
    assert.ok(frame, frameId);
    assert.equal(frame.rgbaSha256, expectedHash, frameId);
    assert.ok(frame.rect.x < 320, `${frameId} moved into the appended column`);
  }
});

test('all eight recovery frames have exact column, anchor, gutter, and RGBA receipts', () => {
  assert.equal(source.poses.at(-1).id, 'recovery');
  assert.equal(source.poses.at(-1).column, 5);
  for (const [familyId, expectation] of Object.entries(RECOVERY_EXPECTATIONS)) {
    const [hash, pivot, ground, contact, gutters] = expectation;
    const frame = manifest.frames.find(({ id }) => id === `${familyId}:recovery`);
    const family = ENEMY_FAMILIES.find(({ id }) => id === familyId);
    assert.ok(frame, familyId);
    assert.deepEqual(frame.rect, { x: 320, y: family.row * 80, width: 64, height: 80 });
    assert.equal(frame.rgbaSha256, hash);
    assert.deepEqual(frame.pivot, pivot);
    assert.deepEqual(frame.ground, ground);
    assert.deepEqual(frame.contact, contact);
    assert.deepEqual(
      [frame.transparentGutter.left, frame.transparentGutter.top,
        frame.transparentGutter.right, frame.transparentGutter.bottom],
      gutters,
    );
  }
});

test('source and production labels avoid real emblem and devotional design terms', () => {
  const productionLabels = source.families.map(({ label, motif }) => `${label} ${motif}`).join('\n').toLowerCase();
  for (const term of [
    'torii', 'kamon', 'coat of arms', 'crucifix', 'mandala', 'shimenawa',
    'halo', 'rosary', 'reliquary', 'sutra', 'shrine', 'sacred emblem',
  ]) {
    assert.equal(productionLabels.includes(term), false, term);
  }
  assert.match(manifest.originality, /Original integer-pixel primitives/);
  for (const entry of manifest.sources) assert.equal(digest(read(entry.path)), entry.sha256);
});
