import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  FIELD_PROP_ATLAS,
  FIELD_PROP_FAMILY_IDS,
  FIELD_PROP_FAMILY_PIECES,
  FIELD_PROP_FAMILY_PROPS,
  FIELD_PROP_FAMILY_WIDE_PROPS,
  FIELD_PROP_FRAME_IDS,
  FIELD_PROP_TALL_IDS,
  FIELD_PROP_THEME_FAMILIES,
  fieldPropFamilyForTheme,
  fieldPropImageHasExpectedSize,
  getFieldPropFrame,
  listFieldPropFrames,
} from '../field-prop-atlas.mjs';
import { WORLD_TILESET_THEME_IDS } from '../world-tileset-atlas.mjs';

const SUITE = new URL('../../assets/art/field-prop-suite-v1/', import.meta.url);

test('field prop atlas module mirrors the builder manifest frame for frame', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', SUITE), 'utf8'));
  const source = JSON.parse(await readFile(new URL('field-prop-suite.source.json', SUITE), 'utf8'));
  assert.deepEqual(FIELD_PROP_FAMILY_IDS, source.familyOrder);
  assert.deepEqual(FIELD_PROP_THEME_FAMILIES, source.themeFamilies);
  assert.deepEqual(FIELD_PROP_FAMILY_PIECES, source.familyPieces);
  assert.deepEqual(FIELD_PROP_FAMILY_PROPS, source.familyProps);
  assert.deepEqual(FIELD_PROP_FAMILY_WIDE_PROPS, source.familyWideProps);
  assert.deepEqual(FIELD_PROP_TALL_IDS, source.tallProps);
  assert.equal(FIELD_PROP_ATLAS.width, manifest.geometry.sheetWidth);
  assert.equal(FIELD_PROP_ATLAS.height, manifest.geometry.sheetHeight);
  assert.equal(FIELD_PROP_ATLAS.url, './assets/art/field-prop-suite-v1/field-prop-atlas.png');

  assert.equal(listFieldPropFrames().length, 216);
  assert.deepEqual(FIELD_PROP_FRAME_IDS, manifest.frames.map((frame) => frame.id));
  for (const entry of manifest.frames) {
    const frame = getFieldPropFrame(entry.id);
    assert.deepEqual([frame.x, frame.y, frame.width, frame.height], entry.rect, entry.id);
    assert.equal(frame.widthCells, entry.widthCells);
    assert.equal(frame.heightCells, entry.heightCells);
    assert.equal(frame.kind, entry.kind);
    assert.equal(frame.family, entry.family);
    assert.equal(frame.width % 16, 0);
    assert.equal(frame.height % 16, 0);
    assert.ok(frame.x + frame.width <= FIELD_PROP_ATLAS.width && frame.y + frame.height <= FIELD_PROP_ATLAS.height);
    assert.equal(Object.isFrozen(frame), true);
  }
  assert.equal(getFieldPropFrame('village:unknown'), null);
  assert.equal(getFieldPropFrame(''), null);
});

test('every world tileset theme maps to exactly one prop family', () => {
  assert.deepEqual(Object.keys(FIELD_PROP_THEME_FAMILIES).sort(), [...WORLD_TILESET_THEME_IDS].sort());
  assert.deepEqual(new Set(Object.values(FIELD_PROP_THEME_FAMILIES)), new Set(FIELD_PROP_FAMILY_IDS));
  assert.equal(fieldPropFamilyForTheme('kurohana-black-castle'), 'castle');
  assert.equal(fieldPropFamilyForTheme('hoshigawa-river-ward'), 'river');
  assert.equal(fieldPropFamilyForTheme('unknown'), null);
});

test('field prop frames never overlap inside the atlas', () => {
  const occupied = new Map();
  for (const frame of listFieldPropFrames()) {
    for (let y = frame.y; y < frame.y + frame.height; y += 16) {
      for (let x = frame.x; x < frame.x + frame.width; x += 16) {
        const key = `${x},${y}`;
        assert.equal(occupied.has(key), false, `${frame.id} overlaps ${occupied.get(key)}`);
        occupied.set(key, frame.id);
      }
    }
  }
});

test('field prop image validation fails closed on undecoded and wrong-size images', () => {
  assert.equal(fieldPropImageHasExpectedSize(null), false);
  assert.equal(fieldPropImageHasExpectedSize({ naturalWidth: 0, naturalHeight: 0 }), false);
  assert.equal(fieldPropImageHasExpectedSize({ naturalWidth: 256, naturalHeight: 415 }), false);
  assert.equal(fieldPropImageHasExpectedSize({ naturalWidth: 256, naturalHeight: 416 }), true);
});
