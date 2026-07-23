import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(GAME_ROOT, '..');
const KIT_ROOT = resolve(REPO_ROOT, 'assets', 'art', 'kurozane-oni-attack-suite-v1');


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


test('Kurozane Oni attack kit preserves geometry and honest provenance', async () => {
  const [sourceText, manifestText] = await Promise.all([
    readFile(resolve(KIT_ROOT, 'kurozane-oni-attack-suite.source.json'), 'utf8'),
    readFile(resolve(KIT_ROOT, 'manifest.json'), 'utf8'),
  ]);
  const source = JSON.parse(sourceText);
  const manifest = JSON.parse(manifestText);

  assert.equal(source.assetId, 'kurozane-oni-attack-suite-v1');
  assert.equal(source.provenance.notPixelAuthored, true);
  assert.equal(manifest.provenance.notPixelAuthored, true);
  assert.equal(manifest.status, 'deterministically-pixelified-runtime-candidate');
  assert.deepEqual(manifest.combat.geometry, {
    columns: 6,
    rows: 6,
    frameWidth: 160,
    frameHeight: 160,
    atlasWidth: 960,
    atlasHeight: 960,
    minimumTransparentGutter: 2,
    facing: 'screen-left',
    rootMotionOwnership: 'runtime-simulation',
    weaponAndVfxOverflowPolicy: 'contained inside the authored frame',
  });
  assert.ok(manifest.combat.visibleColors <= 64);
  assert.deepEqual(manifest.combat.alphaValues, [0, 255]);
  assert.equal(manifest.safety.graphicGore, false);
  assert.equal(manifest.safety.chestOpeningIsMechanical, true);
});


test('Kurozane Oni atlas is exact, manifested, and contains 36 distinct cels', async () => {
  const manifest = JSON.parse(await readFile(resolve(KIT_ROOT, 'manifest.json'), 'utf8'));
  const atlasBytes = await readFile(resolve(KIT_ROOT, 'kurozane-oni-attack-atlas-v1.png'));

  assert.deepEqual(pngDimensions(atlasBytes), { width: 960, height: 960 });
  assert.equal(
    manifest.artifacts['kurozane-oni-attack-atlas-v1.png'].sha256,
    sha256(atlasBytes),
  );
  assert.equal(manifest.combat.frames.length, 36);
  assert.equal(
    new Set(manifest.combat.frames.map(({ rawRgbaSha256 }) => rawRgbaSha256)).size,
    36,
  );
  for (const frame of manifest.combat.frames) {
    assert.ok(Math.min(...Object.values(frame.transparentGutter)) >= 2);
  }
  assert.equal(manifest.artifacts['kurozane-oni-all-attacks-v1.gif'].frameCount, 36);
});


test('Kurozane Oni clips expose the requested attacks and release events', async () => {
  const manifest = JSON.parse(await readFile(resolve(KIT_ROOT, 'manifest.json'), 'utf8'));
  const clips = new Map(manifest.combat.clips.map((clip) => [clip.id, clip]));

  assert.deepEqual([...clips.keys()], [
    'oni-gauntlet-swipes',
    'oni-predator-jump',
    'oni-spear-wheel',
    'oni-mouth-cannon',
    'oni-chest-spiral-barrage',
  ]);
  assert.equal(clips.get('oni-gauntlet-swipes').events
    .filter(({ name }) => name === 'damage').length, 2);
  assert.equal(clips.get('oni-predator-jump').events
    .some(({ name, frameIndex }) => name === 'landShockwave' && frameIndex === 4), true);
  assert.equal(clips.get('oni-spear-wheel').events
    .filter(({ name }) => name === 'damage').length, 3);
  assert.deepEqual(
    clips.get('oni-mouth-cannon').events.map(({ name, frameIndex }) => [name, frameIndex]),
    [
      ['beamCharge', 2],
      ['beamDamageStart', 3],
      ['beamDamageSustain', 4],
      ['beamDamageEnd', 5],
    ],
  );
  const barrage = clips.get('oni-chest-spiral-barrage');
  assert.equal(barrage.frameDurationsMs.length, 12);
  assert.equal(barrage.events
    .filter(({ name }) => name === 'spiralFireballLaunch').length, 3);
  assert.equal(barrage.events
    .some(({ name, frameIndex }) => name === 'radialBurst' && frameIndex === 9), true);
  assert.equal(barrage.phases.at(-1), 'plate-relock');
});
