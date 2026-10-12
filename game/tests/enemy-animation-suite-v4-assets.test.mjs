import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import {
  ENEMY_COMBAT_ANIMATION_ATLAS,
  ENEMY_COMBAT_ANIMATION_CLIPS,
  ENEMY_COMBAT_ANIMATION_ENTRIES,
  getEnemyCombatAnimationEntry,
  getEnemyCombatAnimationFrame,
  sampleEnemyCombatAnimation,
  sampleEnemyCombatAnimationIdle,
  sampleEnemyCombatAnimationPhase,
} from '../enemy-combat-animation-atlas.mjs';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(GAME_ROOT, '..');
const SUITE_ROOT = resolve(REPO_ROOT, 'assets', 'art', 'enemy-animation-suite-v4');
const RUNTIME_ATLAS = resolve(GAME_ROOT, 'assets', 'art', 'enemy-combat-animation-runtime-v1', 'enemy-combat-animation-atlas-v1.png');
const IDS = ['blood-ward-west', 'blood-ward-east', 'tithe-seal', 'court-clone', 'unfiled-testimony'];
const PROFILES = ['ward-object', 'ward-object', 'seal-object', 'umbral-human', 'paper-spirit'];
const SIGNATURES = ['sanguine-ward-pulse', 'sanguine-ward-pulse', 'ink-wax-stamp', 'clone-order', 'testimony-unfold'];
const FORMER_ALIASES = [
  'ashen-bailiff', 'ashen-garrison', 'archive-warden', 'blood-ward-east', 'blood-ward-west',
  'bound-ashen-oni', 'bound-ashen-patrol', 'court-clone', 'dock-retainer', 'fog-skimmer',
  'masked-clerk', 'tithe-seal', 'unfiled-testimony',
];
const CLIP_IDS = ['locomotion', 'basic-attack', 'signature-attack', 'hurt-defeat'];

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (name) => JSON.parse(await readFile(resolve(SUITE_ROOT, name), 'utf8'));

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
      assert.equal(data[9], 6, 'atlas must be RGBA');
      assert.equal(data[12], 0, 'atlas must not be interlaced');
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
    const row = y * stride;
    const previous = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[sourceOffset + x];
      const left = x >= 4 ? pixels[row + x - 4] : 0;
      const above = y ? pixels[previous + x] : 0;
      let predictor;
      if (filter === 0) predictor = 0;
      else if (filter === 1) predictor = left;
      else if (filter === 2) predictor = above;
      else if (filter === 3) predictor = Math.floor((left + above) / 2);
      else if (filter === 4) predictor = paeth(left, above, y && x >= 4 ? pixels[previous + x - 4] : 0);
      else assert.fail(`unsupported PNG filter ${filter}`);
      pixels[row + x] = (raw + predictor) & 0xff;
    }
    sourceOffset += stride;
  }
  return { width, height, pixels };
}

function cel(image, column, row) {
  const frame = Buffer.alloc(160 * 160 * 4);
  for (let y = 0; y < 160; y += 1) {
    const start = ((row * 160 + y) * image.width + column * 160) * 4;
    image.pixels.copy(frame, y * 160 * 4, start, start + 160 * 4);
  }
  return frame;
}

test('V4 builder rebuild is byte-identical', () => {
  const output = execFileSync('python', ['build_enemy_animation_suite_v4.py', '--check'], {
    cwd: SUITE_ROOT,
    encoding: 'utf8',
  });
  assert.match(output, /12 V4 artifacts are byte-identical/u);
});

test('V4 source contract is pixel-authored and shares the runtime clip contract', async () => {
  const [source, v3] = await Promise.all([
    readJson('enemy-animation-suite-v4.source.json'),
    readFile(resolve(REPO_ROOT, 'assets', 'art', 'enemy-animation-suite-v3', 'enemy-animation-suite-v3.source.json'), 'utf8')
      .then(JSON.parse),
  ]);
  assert.equal(source.artifactVersion, 'v4');
  assert.equal(source.provenance.classification, 'pixel-authored deterministic production');
  assert.equal(source.provenance.notPixelAuthored, false);
  assert.match(source.provenance.generatorSurface, /no image generator/u);
  assert.deepEqual(source.enemies.map(({ id }) => id), IDS);
  assert.deepEqual(source.enemies.map(({ profile }) => profile), PROFILES);
  assert.deepEqual(source.enemies.map(({ signatureId }) => signatureId), SIGNATURES);
  assert.deepEqual(source.clips, v3.clips);
  assert.equal(source.runtimeAtlas.frameWidth, 160);
  assert.equal(source.runtimeAtlas.minimumTransparentGutter, 2);
  assert.equal(source.runtimeAtlas.visibleColorCeiling, 64);
});

test('V4 manifest fixes 120 distinct cels with binary alpha, gutters, and events', async () => {
  const manifest = await readJson('manifest.json');
  assert.deepEqual(manifest.enemyOrder, IDS);
  assert.equal(manifest.frames.length, 120);
  assert.equal(manifest.build.pillowVersion, '11.3.0');
  const builder = await readFile(resolve(SUITE_ROOT, manifest.build.builder));
  assert.equal(hash(builder), manifest.build.builderSha256);
  for (const [index, enemy] of manifest.enemies.entries()) {
    assert.equal(enemy.id, IDS[index]);
    assert.equal(enemy.frameCount, 24);
    assert.equal(enemy.distinctFrameCount, 24);
    assert.ok(enemy.visibleColorsInAtlas <= 64);
    assert.ok(enemy.paletteSize <= 64);
    const frames = manifest.frames.filter(({ enemyId }) => enemyId === enemy.id);
    assert.equal(new Set(frames.map(({ rgbaSha256 }) => rgbaSha256)).size, 24);
    for (const frame of frames) {
      assert.deepEqual(frame.alphaValues, [0, 255]);
      assert.ok(Math.min(...Object.values(frame.transparentGutter)) >= 2, frame.id);
      assert.ok(frame.visibleColors <= 64);
    }
    const signature = frames.find(({ clipId, frameIndex }) => clipId === 'signature-attack' && frameIndex === 3);
    assert.deepEqual(signature.events, [enemy.signatureId]);
    const damage = frames.find(({ clipId, frameIndex }) => clipId === 'basic-attack' && frameIndex === 3);
    assert.deepEqual(damage.events, ['damage']);
    const hold = frames.find(({ clipId, frameIndex }) => clipId === 'hurt-defeat' && frameIndex === 5);
    assert.deepEqual([hold.phase, hold.events], ['defeated-hold', ['defeatedHold']]);
  }
});

test('V4 atlases match the manifest and the packed runtime rows cel for cel', async () => {
  const manifest = await readJson('manifest.json');
  const runtime = decodeRgbaPng(await readFile(RUNTIME_ATLAS));
  assert.deepEqual([runtime.width, runtime.height], [ENEMY_COMBAT_ANIMATION_ATLAS.width, ENEMY_COMBAT_ANIMATION_ATLAS.height]);
  for (const id of IDS) {
    const record = manifest.exports.find(({ role, enemyId }) => role === 'transparent-runtime-atlas' && enemyId === id);
    const bytes = await readFile(resolve(SUITE_ROOT, record.path));
    assert.equal(hash(bytes), record.sha256);
    const image = decodeRgbaPng(bytes);
    assert.deepEqual([image.width, image.height], [960, 640]);
    const alpha = new Set();
    for (let index = 3; index < image.pixels.length; index += 4) alpha.add(image.pixels[index]);
    assert.deepEqual([...alpha].sort((a, b) => a - b), [0, 255]);
    const entry = getEnemyCombatAnimationEntry(id);
    for (const clip of ENEMY_COMBAT_ANIMATION_CLIPS) {
      const sourceRow = CLIP_IDS.indexOf(clip.id);
      for (let frame = 0; frame < 6; frame += 1) {
        const source = cel(image, frame, sourceRow);
        assert.ok(source.some((value, index) => index % 4 === 3 && value === 255), `${id}:${clip.id}:${frame} is empty`);
        const packed = cel(runtime, clip.startColumn + frame, entry.row);
        assert.equal(packed.equals(source), true, `${id}:${clip.id}:${frame} differs in the runtime atlas`);
        const manifestFrame = manifest.frames.find((item) => item.id === `${id}:${clip.id}:${frame}`);
        assert.equal(hash(source), manifestFrame.rgbaSha256);
      }
    }
  }
});

test('every formerly aliased template resolves to a valid entry with all clips and a sane pivot', async () => {
  const manifest = await readJson('manifest.json');
  for (const templateId of FORMER_ALIASES) {
    const entry = getEnemyCombatAnimationEntry(templateId);
    assert.ok(entry, `${templateId} must resolve`);
    assert.ok(Number.isInteger(entry.row) && entry.row >= 0 && entry.row < ENEMY_COMBAT_ANIMATION_ATLAS.rows);
    const [pivotX, pivotY] = entry.pivot;
    assert.ok(pivotX > 0 && pivotX < 160 && pivotY > 0 && pivotY < 160, `${templateId} pivot`);
    assert.ok(entry.footPoint[1] >= pivotY && entry.footPoint[1] < 160);
    assert.ok(entry.scale > 0.5 && entry.scale < 1.5);
    for (const clipId of CLIP_IDS) {
      for (let frame = 0; frame < 6; frame += 1) {
        const sample = getEnemyCombatAnimationFrame(templateId, clipId, frame);
        assert.equal(sample.row, entry.row);
        assert.ok(sample.x + sample.width <= ENEMY_COMBAT_ANIMATION_ATLAS.width);
        assert.ok(sample.y + sample.height <= ENEMY_COMBAT_ANIMATION_ATLAS.height);
      }
    }
  }
  for (const id of IDS) {
    const entry = getEnemyCombatAnimationEntry(id);
    const profile = manifest.anchorProfiles[entry.profile];
    assert.equal(entry.id, id);
    assert.equal(entry.provenanceLane, 'pixel-authored');
    assert.deepEqual(entry.pivot, profile.pivot);
    assert.deepEqual(entry.footPoint, profile.foot);
    assert.deepEqual(entry.hurtBounds, profile.hurtBounds);
    assert.equal(entry.row, ENEMY_COMBAT_ANIMATION_ENTRIES.findIndex((candidate) => candidate.id === id));
    assert.equal(sampleEnemyCombatAnimationPhase(id, 'signature-attack', 'active', 0).event, SIGNATURES[IDS.indexOf(id)]);
    assert.equal(sampleEnemyCombatAnimation(id, 'hurt-defeat', 10_000).complete, true);
  }
});

test('hovering V4 objects keep a pulse idle while grounded actors hold their ready frame', () => {
  for (const id of ['blood-ward-west', 'blood-ward-east', 'tithe-seal', 'unfiled-testimony']) {
    assert.equal(getEnemyCombatAnimationEntry(id).idleLoop, true);
    const frames = new Set([0, 130, 250, 340, 450, 560].map((ms) => sampleEnemyCombatAnimationIdle(id, ms).localFrame));
    assert.ok(frames.size >= 4, `${id} idle should cycle`);
    assert.equal(sampleEnemyCombatAnimationIdle(id, 250, { reducedMotion: true }).localFrame, 5);
  }
  for (const id of ['court-clone', 'mourning-ronin', 'ashen-bailiff']) {
    assert.equal(getEnemyCombatAnimationEntry(id).idleLoop, false);
    assert.equal(sampleEnemyCombatAnimationIdle(id, 250).localFrame, 5);
  }
  assert.throws(() => sampleEnemyCombatAnimationIdle('unknown-template', 0), RangeError);
});
