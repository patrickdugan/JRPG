import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { ITEM_CATALOGUE, ITEM_IDS } from '../loadout.mjs';
import {
  ITEM_ICON_ATLAS,
  ITEM_ICON_IDS,
  getItemIconFrame,
  itemIconImageHasExpectedSize,
} from '../item-icon-atlas.mjs';

test('item icon atlas addresses every live item exactly once in canonical order', () => {
  assert.deepEqual(ITEM_ICON_IDS, ITEM_IDS);
  assert.equal(ITEM_ICON_IDS.length, 25);
  assert.equal(new Set(ITEM_ICON_IDS).size, ITEM_ICON_IDS.length);
  assert.deepEqual(ITEM_ICON_ATLAS, {
    id: 'item-icon-suite-v1',
    url: './assets/art/item-icon-suite/item-icon-atlas.png',
    frameWidth: 16,
    frameHeight: 16,
    columns: 5,
    rows: 5,
    width: 80,
    height: 80,
  });
  ITEM_ICON_IDS.forEach((id, index) => {
    const frame = getItemIconFrame(id);
    assert.equal(Boolean(ITEM_CATALOGUE[id]), true);
    assert.deepEqual(frame, {
      id,
      index,
      column: index % 5,
      row: Math.floor(index / 5),
      x: (index % 5) * 16,
      y: Math.floor(index / 5) * 16,
      width: 16,
      height: 16,
    });
    assert.equal(Object.isFrozen(frame), true);
  });
  assert.equal(getItemIconFrame('unknown-item'), null);
});

test('item icon image validation fails closed on undecoded and wrong-size images', () => {
  assert.equal(itemIconImageHasExpectedSize(null), false);
  assert.equal(itemIconImageHasExpectedSize({ naturalWidth: 0, naturalHeight: 0 }), false);
  assert.equal(itemIconImageHasExpectedSize({ naturalWidth: 1, naturalHeight: 1 }), false);
  assert.equal(itemIconImageHasExpectedSize({ naturalWidth: 80, naturalHeight: 79 }), false);
  assert.equal(itemIconImageHasExpectedSize({ naturalWidth: 80, naturalHeight: 80 }), true);
});

test('Camp keeps item icons decorative and text-authoritative with a load fallback', async () => {
  const source = await readFile(new URL('../camp.js', import.meta.url), 'utf8');
  assert.match(source, /ITEM_ICON_ATLAS/);
  assert.match(source, /itemIconImageHasExpectedSize/);
  assert.match(source, /dataset\.itemArtState/);
  assert.match(source, /function itemIconElement\(/);
  assert.match(source, /aria-hidden', 'true'/);
  assert.match(source, /getItemIconFrame\(itemId\)/);
  assert.match(source, /itemIconAtlasState !== 'ready'/);
  assert.match(source, /card\.append\(itemIconElement\(item\.id\)/);
});

test('Battle reuses the canonical atlas as decorative exact-frame art with fallback readiness', async () => {
  const [source, html, smoke] = await Promise.all([
    readFile(new URL('../battle.js', import.meta.url), 'utf8'),
    readFile(new URL('../battle.html', import.meta.url), 'utf8'),
    readFile(new URL('../tools/browser-smoke.py', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="itemIconPreview"[^>]*aria-hidden="true"[^>]*data-item-art-state="loading"/);
  assert.match(html, /<select id="itemSelect"/);
  assert.match(source, /ITEM_ICON_ATLAS/);
  assert.match(source, /itemIconImageHasExpectedSize\(battleItemAtlasImage\)/);
  assert.match(source, /itemIconPreview\.dataset\.itemArtState = state/);
  assert.match(source, /function renderItemIconPreview\(itemId\)/);
  assert.match(source, /getItemIconFrame\(itemId\)/);
  assert.match(source, /itemIconPreview\.classList\.add\('item-icon-fallback'\)/);
  assert.match(source, /context\.drawImage\([\s\S]*?battleItemAtlasImage[\s\S]*?frame\.x[\s\S]*?frame\.y/);
  assert.match(source, /canvas\.dataset\.itemArtState/);
  assert.match(smoke, /Campaign Item QA seed drifted/);
  assert.match(smoke, /recovers 80 HP from River Salve/);
  assert.match(smoke, /Reload did not refund provisional River Salve stock and HP/);
  assert.match(smoke, /Victory did not settle exactly one River Salve in one revision/);
  assert.match(smoke, /campaign_item=item_result/);
});
