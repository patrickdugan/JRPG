import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BATTLE_STAGE_ART,
  battleStageArtMatchesLevel,
  getBattleStageArt,
} from '../battle-stage-art.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import { getLevel } from '../content/levels.mjs';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(GAME_ROOT, '..');
const MANIFEST_PATH = resolve(REPO_ROOT, 'assets', 'art', 'regional-battle-stages', 'manifest.json');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('every canonical combat encounter resolves to one exact authored stage contract', () => {
  const combatEncounters = ENCOUNTERS.filter(({ format }) => !format.startsWith('noncombat'));
  const levelIds = [...new Set(combatEncounters.map(({ levelId }) => levelId))];
  assert.equal(combatEncounters.length, 22);
  assert.equal(levelIds.length, 19);
  assert.equal(Object.keys(BATTLE_STAGE_ART).length, 19);
  for (const levelId of levelIds) {
    const level = getLevel(levelId);
    const art = getBattleStageArt(levelId);
    assert.ok(art, levelId);
    assert.equal(battleStageArtMatchesLevel(art, level), true, levelId);
    assert.equal(Object.isFrozen(art), true, levelId);
  }
  assert.equal(getBattleStageArt('epilogue-memorial-walk'), null);
});

test('all 18 regional browser boards are byte-identical to their manifested production exports', async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const records = manifest.exports.filter(({ runtimeCandidate }) => runtimeCandidate);
  assert.equal(manifest.status, 'integrated-current-browser');
  assert.equal(records.length, 18);
  for (const record of records) {
    const art = getBattleStageArt(record.boardId);
    assert.ok(art, record.boardId);
    assert.equal(art.id, record.id);
    const [productionBytes, runtimeBytes] = await Promise.all([
      readFile(resolve(REPO_ROOT, 'assets', 'art', 'regional-battle-stages', record.path)),
      readFile(resolve(GAME_ROOT, art.url.replace(/^\.\//, ''))),
    ]);
    assert.equal(sha256(productionBytes), record.sha256, record.boardId);
    assert.equal(runtimeBytes.equals(productionBytes), true, record.boardId);
  }
});
