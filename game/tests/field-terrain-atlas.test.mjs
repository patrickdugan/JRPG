import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { LEVELS } from '../content/levels.mjs';
import {
  FIELD_TERRAIN_ATLAS,
  FIELD_TERRAIN_IDS,
  fieldTerrainImageHasExpectedSize,
  getFieldTerrainFrame,
} from '../field-terrain-atlas.mjs';

test('field terrain atlas covers the default floor and every live authored tag exactly', () => {
  const live = [...new Set(['stone', ...LEVELS.flatMap((level) => (level.terrain ?? []).map((entry) => entry.tag))])].sort();
  assert.equal(LEVELS.length, 48);
  assert.deepEqual([...FIELD_TERRAIN_IDS].sort(), live);
  assert.equal(FIELD_TERRAIN_IDS.length, 19);
  assert.deepEqual(FIELD_TERRAIN_ATLAS, {
    id: 'field-terrain-overlay-suite-v1',
    url: './assets/art/field-terrain-suite/field-terrain-atlas.png',
    frameWidth: 16, frameHeight: 16, columns: 5, rows: 4, width: 80, height: 64,
  });
  FIELD_TERRAIN_IDS.forEach((id, index) => assert.deepEqual(getFieldTerrainFrame(id), {
    id, index, column: index % 5, row: Math.floor(index / 5),
    x: (index % 5) * 16, y: Math.floor(index / 5) * 16, width: 16, height: 16,
  }));
  assert.equal(getFieldTerrainFrame('unknown'), null);
});

test('field terrain image validation fails closed on undecoded and wrong-size images', () => {
  assert.equal(fieldTerrainImageHasExpectedSize(null), false);
  assert.equal(fieldTerrainImageHasExpectedSize({ naturalWidth: 0, naturalHeight: 0 }), false);
  assert.equal(fieldTerrainImageHasExpectedSize({ naturalWidth: 80, naturalHeight: 63 }), false);
  assert.equal(fieldTerrainImageHasExpectedSize({ naturalWidth: 80, naturalHeight: 64 }), true);
});

test('Campaign integration remains decorative and retains the flat-color fallback', async () => {
  const source = await readFile(new URL('../campaign.js', import.meta.url), 'utf8');
  assert.match(source, /terrainColor\(terrain, palette\)/);
  assert.match(source, /fieldTerrainAtlasState/);
  assert.match(source, /getFieldTerrainFrame\(terrain\)/);
  assert.match(source, /fieldTerrainAtlasState === 'ready'/);
  assert.match(source, /drawImage\(\s*fieldTerrainAtlasImage/);
});
