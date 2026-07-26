import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ENEMY_COMBAT_ANIMATION_ALIASES,
  ENEMY_COMBAT_ANIMATION_ATLAS,
  ENEMY_COMBAT_ANIMATION_ENTRIES,
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

test('runtime atlas covers all twenty-eight reviewed enemy animation families', async () => {
  const [v2, v3, manifest] = await Promise.all([
    readFile(new URL('../../assets/art/enemy-animation-suite-v2/enemy-animation-suite-v2.source.json', import.meta.url), 'utf8')
      .then(JSON.parse),
    readFile(new URL('../../assets/art/enemy-animation-suite-v3/enemy-animation-suite-v3.source.json', import.meta.url), 'utf8')
      .then(JSON.parse),
    readFile(new URL('manifest.json', packageUrl), 'utf8').then(JSON.parse),
  ]);
  const expectedIds = [...v2.enemies, ...v3.enemies].map(({ id }) => id);
  assert.equal(ENEMY_COMBAT_ANIMATION_ENTRIES.length, 28);
  assert.deepEqual(ENEMY_COMBAT_ANIMATION_ENTRIES.map(({ id }) => id), expectedIds);
  assert.deepEqual(manifest.rows.map(({ id }) => id), expectedIds);
  assert.deepEqual(
    [ENEMY_COMBAT_ANIMATION_ATLAS.width, ENEMY_COMBAT_ANIMATION_ATLAS.height],
    [3840, 4480],
  );
  assert.deepEqual(manifest.geometry.alphaValues, [0, 255]);
  assert.equal(manifest.provenance.notPixelAuthored, true);
});

test('canonical aliases resolve explicitly while unknown templates keep the old fallback lane', () => {
  assert.equal(getEnemyCombatAnimationEntry('cinder-hound').id, 'cinder-hound');
  assert.equal(getEnemyCombatAnimationEntry('ashen-bailiff').id, 'tithe-enforcer');
  assert.equal(getEnemyCombatAnimationEntry('court-clone').id, 'mourning-ronin');
  assert.equal(Object.keys(ENEMY_COMBAT_ANIMATION_ALIASES).length, 13);
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

  assert.equal(locomotion.localFrame, 2);
  assert.deepEqual([windup.localFrame, active.localFrame, recovery.localFrame], [2, 3, 5]);
  assert.equal(active.event, 'damage');
  assert.equal(signature.event, 'black-bloom-devour');
  assert.deepEqual([signature.row, signature.column], [24, 15]);
  assert.equal(defeated.localFrame, 5);
  assert.equal(defeated.event, 'defeatedHold');
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
  assert.equal(enemyCombatAnimationImageHasExpectedSize({
    naturalWidth: 3840,
    naturalHeight: 4480,
  }), true);
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
  }
});
