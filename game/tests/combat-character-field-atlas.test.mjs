import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  COMBAT_CHARACTER_FIELD_ATLAS,
  COMBAT_CHARACTER_FIELD_DIRECTIONS,
  COMBAT_CHARACTER_FIELD_EVENTS,
  COMBAT_CHARACTER_FIELD_IDS,
  COMBAT_CHARACTER_FIELD_PHASES,
  COMBAT_CHARACTER_FIELD_WALK_CYCLE_MS,
  combatCharacterFieldImageHasExpectedSize,
  getCombatCharacterFieldEventFrame,
  getCombatCharacterFieldFrame,
  getCombatCharacterFieldPresentationId,
  getCombatCharacterFieldProfile,
  getCombatCharacterFieldTemplateFrame,
  getCombatCharacterFieldWalkFrame,
} from '../combat-character-field-atlas.mjs';

const suiteUrl = new URL('../../assets/art/enemy-field-suite-v3/', import.meta.url);
const runtimeUrl = new URL('../assets/art/enemy-field-suite-v3/enemy-field-atlas-v3.png', import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('enemy field v3 atlas addresses all 1,216 exact movement and event frames', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', suiteUrl), 'utf8'));
  assert.deepEqual(COMBAT_CHARACTER_FIELD_IDS, manifest.rowOrder);
  assert.deepEqual(COMBAT_CHARACTER_FIELD_DIRECTIONS, ['north', 'east', 'south', 'west']);
  assert.deepEqual(COMBAT_CHARACTER_FIELD_PHASES, [
    'idle',
    'contact-a',
    'compression-a',
    'passing-a',
    'extension-a',
    'contact-b',
    'compression-b',
    'passing-b',
    'extension-b',
  ]);
  assert.deepEqual(COMBAT_CHARACTER_FIELD_EVENTS, ['alert', 'hurt']);
  assert.equal(COMBAT_CHARACTER_FIELD_WALK_CYCLE_MS, 424);
  assert.equal(manifest.frames.length, 1216);
  assert.deepEqual(COMBAT_CHARACTER_FIELD_ATLAS, {
    id: 'enemy-field-suite-v3',
    url: './assets/art/enemy-field-suite-v3/enemy-field-atlas-v3.png',
    frameWidth: 80,
    frameHeight: 80,
    columns: 38,
    rows: 32,
    width: 3040,
    height: 2560,
    pivotX: 40,
    pivotY: 77,
    footX: 40,
    footY: 77,
    alphaPolicy: 'binary',
    rootMotionOwnership: 'runtime-simulation',
  });

  for (const record of manifest.frames) {
    const [, state] = record.state.split(/-(.+)/u);
    const direction = record.state.split('-', 1)[0];
    const frame = COMBAT_CHARACTER_FIELD_EVENTS.includes(state)
      ? getCombatCharacterFieldEventFrame(record.assetId, state)
      : getCombatCharacterFieldFrame(record.assetId, direction, state);
    assert.ok(frame, record.id);
    assert.equal(frame.id, record.id);
    assert.deepEqual([frame.x, frame.y, frame.width, frame.height], record.rect);
    assert.deepEqual([frame.pivotX, frame.pivotY], record.pivot);
    assert.deepEqual([frame.footX, frame.footY], record.footPoint);
    assert.equal(Object.isFrozen(frame), true);
  }
  assert.equal(getCombatCharacterFieldFrame('unknown', 'south', 'idle'), null);
  assert.equal(getCombatCharacterFieldFrame(COMBAT_CHARACTER_FIELD_IDS[0], 'diagonal', 'idle'), null);
});

test('walk sampling honors all eight phases and exact loop boundaries', () => {
  const id = 'kurozane-demon-mode';
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 0).phase, 'contact-a');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 53).phase, 'contact-a');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 54).phase, 'compression-a');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 99).phase, 'compression-a');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 100).phase, 'passing-a');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 153).phase, 'passing-a');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 154).phase, 'extension-a');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 211).phase, 'extension-a');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 212).phase, 'contact-b');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 423).phase, 'extension-b');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 424).phase, 'contact-a');
  assert.throws(() => getCombatCharacterFieldWalkFrame(id, 'west', -1), RangeError);
});

test('canonical encounter templates resolve to explicit PS1-density presentation aliases', () => {
  assert.equal(getCombatCharacterFieldPresentationId('cinder-hound'), 'cinder-hound');
  assert.equal(getCombatCharacterFieldPresentationId('tithe-hound'), 'registry-hound');
  assert.equal(getCombatCharacterFieldPresentationId('kurozane'), 'kurozane-oni-armor');
  assert.equal(getCombatCharacterFieldPresentationId('unknown-template'), 'tithe-enforcer');
  assert.equal(getCombatCharacterFieldProfile('tithe-hound'), 'rush');
  assert.equal(getCombatCharacterFieldProfile('kurozane'), 'heavy');
  const boss = getCombatCharacterFieldTemplateFrame('kurozane', 'north', 'idle');
  assert.equal(boss.assetId, 'kurozane-oni-armor');
  assert.equal(boss.displayScale, 1.16);
});

test('runtime field atlas is byte-identical to its verified production export', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', suiteUrl), 'utf8'));
  const [source, runtime] = await Promise.all([
    readFile(new URL(manifest.fieldAtlas.path, suiteUrl)),
    readFile(runtimeUrl),
  ]);
  assert.equal(sha256(source), manifest.fieldAtlas.sha256);
  assert.equal(runtime.equals(source), true);
  assert.equal(combatCharacterFieldImageHasExpectedSize({ naturalWidth: 3040, naturalHeight: 2560 }), true);
  assert.equal(combatCharacterFieldImageHasExpectedSize({ naturalWidth: 3040, naturalHeight: 2559 }), false);
});
