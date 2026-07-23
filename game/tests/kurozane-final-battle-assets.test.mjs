import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(GAME_ROOT, '..');
const KIT_ROOT = resolve(REPO_ROOT, 'assets', 'art', 'kurozane-final-battle-v1');


function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}


function pngDimensions(bytes) {
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}


test('Kurozane kit preserves its production geometry and honest provenance', async () => {
  const [sourceText, manifestText] = await Promise.all([
    readFile(resolve(KIT_ROOT, 'kurozane-final-battle.source.json'), 'utf8'),
    readFile(resolve(KIT_ROOT, 'manifest.json'), 'utf8'),
  ]);
  const source = JSON.parse(sourceText);
  const manifest = JSON.parse(manifestText);

  assert.equal(source.assetId, 'kurozane-final-battle-v1');
  assert.equal(source.provenance.notPixelAuthored, true);
  assert.equal(manifest.provenance.notPixelAuthored, true);
  assert.equal(manifest.status, 'deterministically-pixelified-runtime-candidate');
  assert.deepEqual(manifest.portrait.geometry, {
    columns: 8,
    rows: 1,
    frameWidth: 128,
    frameHeight: 128,
    contentWidth: 96,
    contentHeight: 128,
    contentOffset: [16, 0],
    atlasWidth: 1024,
    atlasHeight: 128,
    minimumTransparentGutter: 2,
  });
  assert.deepEqual(manifest.combat.geometry, {
    columns: 6,
    rows: 4,
    frameWidth: 160,
    frameHeight: 160,
    atlasWidth: 960,
    atlasHeight: 640,
    minimumTransparentGutter: 2,
    facing: 'screen-left',
    rootMotionOwnership: 'runtime-simulation',
    vfxOverflowPolicy: 'contained inside the authored frame',
  });
  assert.ok(manifest.portrait.visibleColors <= 64);
  assert.ok(manifest.combat.visibleColors <= 64);
  assert.deepEqual(manifest.portrait.alphaValues, [0, 255]);
  assert.deepEqual(manifest.combat.alphaValues, [0, 255]);
});


test('Kurozane atlases are exact, manifested, and contain distinct frames', async () => {
  const manifest = JSON.parse(await readFile(resolve(KIT_ROOT, 'manifest.json'), 'utf8'));
  const [portraitBytes, combatBytes] = await Promise.all([
    readFile(resolve(KIT_ROOT, 'kurozane-portrait-atlas-v1.png')),
    readFile(resolve(KIT_ROOT, 'kurozane-final-battle-atlas-v1.png')),
  ]);

  assert.deepEqual(pngDimensions(portraitBytes), { width: 1024, height: 128 });
  assert.deepEqual(pngDimensions(combatBytes), { width: 960, height: 640 });
  assert.equal(
    manifest.artifacts['kurozane-portrait-atlas-v1.png'].sha256,
    sha256(portraitBytes),
  );
  assert.equal(
    manifest.artifacts['kurozane-final-battle-atlas-v1.png'].sha256,
    sha256(combatBytes),
  );
  assert.equal(manifest.portrait.frames.length, 8);
  assert.equal(manifest.combat.frames.length, 24);
  assert.equal(
    new Set(manifest.portrait.frames.map(({ rawRgbaSha256 }) => rawRgbaSha256)).size,
    8,
  );
  assert.equal(
    new Set(manifest.combat.frames.map(({ rawRgbaSha256 }) => rawRgbaSha256)).size,
    24,
  );
  for (const frame of [...manifest.portrait.frames, ...manifest.combat.frames]) {
    assert.ok(Math.min(...Object.values(frame.transparentGutter)) >= 2);
  }
});


test('Kurozane final-battle clips expose canonical beats and end in living defeat', async () => {
  const manifest = JSON.parse(await readFile(resolve(KIT_ROOT, 'manifest.json'), 'utf8'));
  const clips = new Map(manifest.combat.clips.map((clip) => [clip.id, clip]));

  assert.deepEqual([...clips.keys()], [
    'court-command',
    'yearless-thrust',
    'blood-eclipse-transform',
    'black-chrysanthemum-defeat',
  ]);
  assert.deepEqual(
    clips.get('court-command').events.map(({ name, frameIndex }) => [name, frameIndex]),
    [['summonCourtClones', 3]],
  );
  assert.deepEqual(
    clips.get('yearless-thrust').events.map(({ name, frameIndex }) => [name, frameIndex]),
    [['damage', 3]],
  );
  assert.deepEqual(
    clips.get('blood-eclipse-transform').events.map(({ name, frameIndex }) => [
      name,
      frameIndex,
    ]),
    [['bloodEclipseClose', 2], ['demonModeReady', 5]],
  );
  const finale = clips.get('black-chrysanthemum-defeat');
  assert.deepEqual(finale.phases.slice(-2), ['living-collapse', 'living-defeat']);
  assert.deepEqual(
    finale.events.map(({ name, frameIndex }) => [name, frameIndex]),
    [['damage', 2], ['finalWardOpen', 3], ['livingDefeatHold', 5]],
  );
  assert.equal(manifest.safety.livingDefeatRequired, true);
  assert.match(manifest.safety.defeatRead, /remains alive/u);
});
