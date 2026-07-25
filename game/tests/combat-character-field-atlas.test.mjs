import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  COMBAT_CHARACTER_FIELD_ATLAS,
  COMBAT_CHARACTER_FIELD_DIRECTIONS,
  COMBAT_CHARACTER_FIELD_IDS,
  COMBAT_CHARACTER_FIELD_PHASES,
  COMBAT_CHARACTER_FIELD_WALK_CYCLE_MS,
  combatCharacterFieldImageHasExpectedSize,
  getCombatCharacterFieldFrame,
  getCombatCharacterFieldWalkFrame,
} from '../combat-character-field-atlas.mjs';

const suiteUrl = new URL('../../assets/art/combat-character-field-animation-v1/', import.meta.url);
const runtimeUrl = new URL('../assets/art/combat-character-field-animation-v1/combat-character-field-animation-atlas-v1.png', import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('combat-character field atlas addresses all 640 exact frames', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', suiteUrl), 'utf8'));
  assert.deepEqual(COMBAT_CHARACTER_FIELD_IDS, manifest.rowOrder);
  assert.deepEqual(COMBAT_CHARACTER_FIELD_DIRECTIONS, ['north', 'east', 'south', 'west']);
  assert.deepEqual(COMBAT_CHARACTER_FIELD_PHASES, ['idle', 'contact', 'compression', 'passing', 'extension']);
  assert.equal(COMBAT_CHARACTER_FIELD_WALK_CYCLE_MS, 360);
  assert.deepEqual(COMBAT_CHARACTER_FIELD_ATLAS, {
    id: 'combat-character-field-animation-v1',
    url: './assets/art/combat-character-field-animation-v1/combat-character-field-animation-atlas-v1.png',
    frameWidth: 48,
    frameHeight: 48,
    columns: 20,
    rows: 32,
    width: 960,
    height: 1536,
    pivotX: 24,
    pivotY: 46,
    footX: 24,
    footY: 46,
    alphaPolicy: 'binary',
    rootMotionOwnership: 'runtime-simulation',
  });

  for (const record of manifest.frames) {
    const frame = getCombatCharacterFieldFrame(record.assetId, record.direction, record.phase);
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

test('walk sampling honors contact, compression, passing, extension, and exact loop boundaries', () => {
  const id = 'kurozane-demon-mode';
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 0).phase, 'contact');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 89).phase, 'contact');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 90).phase, 'compression');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 164).phase, 'compression');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 165).phase, 'passing');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 254).phase, 'passing');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 255).phase, 'extension');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 359).phase, 'extension');
  assert.equal(getCombatCharacterFieldWalkFrame(id, 'west', 360).phase, 'contact');
  assert.throws(() => getCombatCharacterFieldWalkFrame(id, 'west', -1), RangeError);
});

test('runtime field-animation atlas is byte-identical to its verified production export', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', suiteUrl), 'utf8'));
  const [source, runtime] = await Promise.all([
    readFile(new URL(manifest.atlas.path, suiteUrl)),
    readFile(runtimeUrl),
  ]);
  assert.equal(sha256(source), manifest.atlas.sha256);
  assert.equal(runtime.equals(source), true);
  assert.equal(combatCharacterFieldImageHasExpectedSize({ naturalWidth: 960, naturalHeight: 1536 }), true);
  assert.equal(combatCharacterFieldImageHasExpectedSize({ naturalWidth: 960, naturalHeight: 1535 }), false);
});
