import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  ENEMY_COMBAT_ANIMATION_ALIASES,
  ENEMY_COMBAT_ANIMATION_ATLAS,
  ENEMY_COMBAT_ANIMATION_ENTRIES,
  ENEMY_COMBAT_ANIMATION_PIXEL_AUTHORED_FIRST_ROW,
  enemyCombatAnimationImageHasExpectedSize,
  getEnemyCombatAnimationEntry,
  getEnemyCombatAnimationFrame,
  hasEnemyCombatAnimation,
  sampleEnemyCombatAnimation,
  sampleEnemyCombatAnimationPhase,
} from '../enemy-combat-animation-atlas.mjs';

const packageUrl = new URL('../../assets/art/enemy-combat-animation-runtime-v1/', import.meta.url);
const runtimeUrl = new URL('../assets/art/enemy-combat-animation-runtime-v1/', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readSource = (version) => readFile(
  new URL(`../../assets/art/enemy-animation-suite-${version}/enemy-animation-suite-${version}.source.json`, import.meta.url),
  'utf8',
).then(JSON.parse);

test('runtime atlas covers all thirty-three reviewed enemy animation families', async () => {
  const [v2, v3, v4, manifest] = await Promise.all([
    readSource('v2'),
    readSource('v3'),
    readSource('v4'),
    readFile(new URL('manifest.json', packageUrl), 'utf8').then(JSON.parse),
  ]);
  const expectedIds = [...v2.enemies, ...v3.enemies, ...v4.enemies].map(({ id }) => id);
  assert.equal(ENEMY_COMBAT_ANIMATION_ENTRIES.length, 33);
  assert.deepEqual(ENEMY_COMBAT_ANIMATION_ENTRIES.map(({ id }) => id), expectedIds);
  assert.deepEqual(manifest.rows.map(({ id }) => id), expectedIds);
  assert.deepEqual(
    [ENEMY_COMBAT_ANIMATION_ATLAS.width, ENEMY_COMBAT_ANIMATION_ATLAS.height],
    [3840, 5280],
  );
  assert.deepEqual(
    [ENEMY_COMBAT_ANIMATION_ATLAS.columns, ENEMY_COMBAT_ANIMATION_ATLAS.rows],
    [24, 33],
  );
  assert.deepEqual(
    [manifest.geometry.atlasWidth, manifest.geometry.atlasHeight, manifest.geometry.rows],
    [3840, 5280, 33],
  );
  assert.deepEqual(manifest.geometry.alphaValues, [0, 255]);
});

test('runtime provenance keeps pixelified and pixel-authored rows in separate lanes', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', packageUrl), 'utf8'));
  const lanes = Object.fromEntries(manifest.provenance.lanes.map((lane) => [lane.lane, lane]));
  assert.deepEqual(lanes['deterministically-pixelified'].packages, ['enemy-animation-suite-v2', 'enemy-animation-suite-v3']);
  assert.equal(lanes['deterministically-pixelified'].notPixelAuthored, true);
  assert.deepEqual(lanes['pixel-authored'].packages, ['enemy-animation-suite-v4']);
  assert.equal(lanes['pixel-authored'].notPixelAuthored, false);
  assert.equal(ENEMY_COMBAT_ANIMATION_PIXEL_AUTHORED_FIRST_ROW, 28);
  for (const row of manifest.rows) {
    const expectedLane = row.row >= 28 ? 'pixel-authored' : 'deterministically-pixelified';
    assert.equal(row.provenanceLane, expectedLane, row.id);
    assert.equal(row.sourcePackage, row.row >= 28 ? 'enemy-animation-suite-v4' : row.sourcePackage);
    assert.equal(ENEMY_COMBAT_ANIMATION_ENTRIES[row.row].provenanceLane, expectedLane);
  }
});

test('canonical aliases resolve explicitly while unknown templates keep the old fallback lane', () => {
  assert.equal(getEnemyCombatAnimationEntry('cinder-hound').id, 'cinder-hound');
  assert.equal(getEnemyCombatAnimationEntry('ashen-bailiff').id, 'tithe-enforcer');
  assert.equal(getEnemyCombatAnimationEntry('court-clone').id, 'court-clone');
  assert.equal(Object.keys(ENEMY_COMBAT_ANIMATION_ALIASES).length, 8);
  for (const bespoke of ['blood-ward-west', 'blood-ward-east', 'tithe-seal', 'court-clone', 'unfiled-testimony']) {
    assert.equal(Object.hasOwn(ENEMY_COMBAT_ANIMATION_ALIASES, bespoke), false, `${bespoke} must not borrow art`);
    assert.equal(getEnemyCombatAnimationEntry(bespoke).id, bespoke);
  }
  assert.equal(hasEnemyCombatAnimation('archive-warden'), true);
  assert.equal(hasEnemyCombatAnimation('unknown-template'), false);
  assert.equal(getEnemyCombatAnimationEntry('unknown-template'), null);
});

test('attack, movement, hurt, and defeat sampling expose stable geometry and events', () => {
  const locomotion = sampleEnemyCombatAnimation('cinder-hound', 'locomotion', 220);
  const windup = sampleEnemyCombatAnimationPhase('ashen-bailiff', 'basic-attack', 'windup', 1);
  const active = sampleEnemyCombatAnimationPhase('ashen-bailiff', 'basic-attack', 'active', 0);
  const recovery = sampleEnemyCombatAnimationPhase('ashen-bailiff', 'basic-attack', 'recovery', 1);
  const signature = sampleEnemyCombatAnimationPhase(
    'black-chrysanthemum-nest-woman',
    'signature-attack',
    'active',
    0,
  );
  const defeated = sampleEnemyCombatAnimationPhase('court-clone', 'hurt-defeat', 'defeat', 1);
  const cloneOrder = sampleEnemyCombatAnimationPhase('court-clone', 'signature-attack', 'active', 0);

  assert.equal(locomotion.localFrame, 2);
  assert.deepEqual([windup.localFrame, active.localFrame, recovery.localFrame], [2, 3, 5]);
  assert.equal(active.event, 'damage');
  assert.equal(signature.event, 'black-bloom-devour');
  assert.deepEqual([signature.row, signature.column], [24, 15]);
  assert.equal(defeated.localFrame, 5);
  assert.equal(defeated.event, 'defeatedHold');
  assert.deepEqual([defeated.row, defeated.assetId], [31, 'court-clone']);
  assert.deepEqual([cloneOrder.event, cloneOrder.column, cloneOrder.y], ['clone-order', 15, 31 * 160]);
  assert.throws(() => getEnemyCombatAnimationFrame('unknown-template', 'locomotion', 0), RangeError);
  assert.throws(() => getEnemyCombatAnimationFrame('cinder-hound', 'unknown', 0), RangeError);
});

test('production and browser runtime atlases are byte-identical and manifest-hashed', async () => {
  const [production, runtime, manifest] = await Promise.all([
    readFile(new URL('enemy-combat-animation-atlas-v1.png', packageUrl)),
    readFile(new URL('enemy-combat-animation-atlas-v1.png', runtimeUrl)),
    readFile(new URL('manifest.json', packageUrl), 'utf8').then(JSON.parse),
  ]);
  assert.equal(runtime.equals(production), true);
  assert.equal(hash(production), manifest.output.sha256);
  assert.deepEqual([production.readUInt32BE(16), production.readUInt32BE(20)], [3840, 5280]);
  assert.equal(enemyCombatAnimationImageHasExpectedSize({
    naturalWidth: 3840,
    naturalHeight: 5280,
  }), true);
  assert.equal(enemyCombatAnimationImageHasExpectedSize({
    naturalWidth: 3840,
    naturalHeight: 4480,
  }), false);
});

test('runtime repack rebuild is byte-identical', () => {
  const output = execFileSync('python', ['build_enemy_combat_animation_runtime_v1.py', '--check'], {
    cwd: fileURLToPath(packageUrl),
    encoding: 'utf8',
  });
  assert.equal(output.trim(), '');
});

test('both live battle renderers prefer the rich atlases while retaining legacy fallbacks', async () => {
  const [tactical, action] = await Promise.all([
    readFile(new URL('../battle.js', import.meta.url), 'utf8'),
    readFile(new URL('../action-campaign-battle.js', import.meta.url), 'utf8'),
  ]);
  for (const source of [tactical, action]) {
    assert.match(source, /from '\.\/enemy-combat-animation-atlas\.mjs'/u);
    assert.match(source, /from '\.\/roster-animation-atlas\.mjs'/u);
    assert.match(source, /getEnemyAtlasFrame/u);
    assert.match(source, /getPartyCombatFrame/u);
    assert.match(source, /sampleEnemyCombatAnimationIdle\(/u);
  }
  assert.match(action, /actor\.faction === 'enemy' \|\| actor\.faction === 'neutral'/u);
});
