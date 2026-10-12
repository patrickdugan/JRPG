import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { LEVELS, isBlocked } from '../content/levels.mjs';
import { FIELD_TERRAIN_ATLAS } from '../field-terrain-atlas.mjs';
import {
  FIELD_TILE_BORDER_BANDS,
  FIELD_TILE_LIQUID_TERRAIN,
  FIELD_TILE_SIZE,
  FIELD_TILE_THEME_LIQUIDS,
  canDrawFieldTileLayout,
  drawFieldTileLayout,
  fieldTileLayoutPixelSize,
  fieldTilePositionHash,
  resolveFieldTileLayout,
} from '../field-tileset-presentation.mjs';
import { WORLD_TILESET_ATLASES, WORLD_TILESET_THEME_IDS, getWorldTileFrame } from '../world-tileset-atlas.mjs';

const suiteUrl = new URL('../../assets/art/world-tileset-suite-v1/', import.meta.url);
const exactWorld = { naturalWidth: WORLD_TILESET_ATLASES.topDown.width, naturalHeight: WORLD_TILESET_ATLASES.topDown.height };
const exactTerrain = { naturalWidth: FIELD_TERRAIN_ATLAS.width, naturalHeight: FIELD_TERRAIN_ATLAS.height };

function grid(rows, extra = {}) {
  const blocked = [];
  rows.forEach((row, y) => [...row].forEach((char, x) => { if (char === '#') blocked.push(`${x},${y}`); }));
  return {
    id: extra.id ?? 'synthetic-grid',
    width: rows[0].length,
    height: rows.length,
    blocked,
    terrain: [],
    exits: [],
    spawn: { x: 0, y: rows.length - 1 },
    tilesetThemeId: 'takamine-rain-village',
    ...extra,
  };
}

function cellAt(layout, x, y) {
  return layout.cells[y * layout.width + x];
}

function layerIds(cell) {
  return cell.layers.map((layer) => layer.id);
}

function layer(cell, id) {
  return cell.layers.find((entry) => entry.id === id);
}

function fakeContext() {
  const calls = [];
  return { calls, drawImage: (...args) => calls.push(args) };
}

test('every live level resolves a known theme and a complete layout without exceptions', () => {
  assert.equal(LEVELS.length, 48);
  for (const level of LEVELS) {
    const layout = resolveFieldTileLayout(level);
    assert.ok(WORLD_TILESET_THEME_IDS.includes(layout.themeId), `${level.id} theme`);
    assert.equal(layout.cells.length, level.width * level.height, `${level.id} cell count`);
    assert.deepEqual(fieldTileLayoutPixelSize(layout), { width: level.width * 16, height: level.height * 16 });
    for (const cell of layout.cells) {
      assert.ok(cell.layers.length >= 1, `${level.id} ${cell.key} has a base tile`);
      assert.equal(cell.layers[0].atlas, 'world-top-down');
      for (const entry of cell.layers) {
        const atlas = entry.atlas === 'world-top-down' ? WORLD_TILESET_ATLASES.topDown : FIELD_TERRAIN_ATLAS;
        assert.ok(entry.sx >= 0 && entry.sy >= 0 && entry.sx + entry.sw <= atlas.width && entry.sy + entry.sh <= atlas.height);
        assert.ok(entry.dx >= 0 && entry.dy >= 0 && entry.dx + entry.sw <= FIELD_TILE_SIZE && entry.dy + entry.sh <= FIELD_TILE_SIZE);
      }
      if (cell.impassable) assert.ok(['face', 'top'].includes(cell.structure), `${level.id} ${cell.key} structure`);
      else assert.equal(cell.structure, null);
    }
  }
});

test('art mirrors collision authority exactly and never mutates level data', () => {
  for (const level of LEVELS) {
    const before = JSON.stringify(level);
    const layout = resolveFieldTileLayout(level);
    for (const cell of layout.cells) assert.equal(cell.impassable, isBlocked(level, cell.x, cell.y), `${level.id} ${cell.key}`);
    for (const exit of level.exits ?? []) {
      const [x, y] = exit.at.split(',').map(Number);
      assert.equal(cellAt(layout, x, y).base, 'threshold', `${level.id} exit ${exit.at}`);
    }
    assert.equal(JSON.stringify(level), before);
  }
});

test('resolution is deterministic, frozen, and never consults Math.random', async () => {
  const original = Math.random;
  Math.random = () => { throw new Error('Math.random must not be used for field tiles.'); };
  try {
    for (const level of LEVELS) assert.deepEqual(resolveFieldTileLayout(level), resolveFieldTileLayout(level));
  } finally {
    Math.random = original;
  }
  const layout = resolveFieldTileLayout(LEVELS[2]);
  assert.equal(Object.isFrozen(layout), true);
  assert.equal(Object.isFrozen(layout.cells), true);
  assert.equal(Object.isFrozen(layout.cells[0]), true);
  assert.equal(Object.isFrozen(layout.cells[0].layers[0]), true);
  assert.equal(fieldTilePositionHash(7, 3, 4), fieldTilePositionHash(7, 3, 4));
  assert.notEqual(fieldTilePositionHash(7, 3, 4), fieldTilePositionHash(7, 4, 3));
  const source = await readFile(new URL('../field-tileset-presentation.mjs', import.meta.url), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
  assert.doesNotMatch(code, /Math\.random|document\.|window\.|localStorage|sessionStorage|new Image/u);
});

test('floor variation uses floor-a, floor-b patches, and sparse floor-detail', () => {
  const counts = { 'floor-a': 0, 'floor-b': 0, 'floor-detail': 0 };
  for (const level of LEVELS) {
    for (const cell of resolveFieldTileLayout(level).cells) if (cell.base in counts) counts[cell.base] += 1;
  }
  const total = counts['floor-a'] + counts['floor-b'] + counts['floor-detail'];
  assert.ok(counts['floor-a'] / total > 0.5, 'floor-a dominates');
  assert.ok(counts['floor-b'] / total > 0.15 && counts['floor-b'] / total < 0.45, 'floor-b forms patches');
  assert.ok(counts['floor-detail'] / total > 0.02 && counts['floor-detail'] / total < 0.12, 'floor-detail stays sparse');

  const tagged = resolveFieldTileLayout(grid(['...'], { terrain: [{ at: '1,0', tag: 'paper-litter' }] }));
  assert.equal(cellAt(tagged, 1, 0).base, 'floor-a', 'tagged cells keep a quiet floor under their overlay');
  assert.equal(cellAt(tagged, 0, 0).base, 'floor-a', 'the spawn cell stays quiet');
});

test('impassable cells autotile as raised masses with faces toward walkable cells', () => {
  const layout = resolveFieldTileLayout(grid([
    '.....',
    '.#.#.',
    '.#...',
    '....#',
  ]));
  assert.equal(cellAt(layout, 1, 1).base, 'wall-cap', 'mass top: impassable cell to the south');
  assert.equal(cellAt(layout, 1, 1).structure, 'top');
  assert.equal(cellAt(layout, 1, 2).base, 'wall', 'mass face: walkable cell to the south');
  assert.equal(cellAt(layout, 1, 2).structure, 'face');
  assert.equal(cellAt(layout, 3, 1).base, 'wall', 'one-cell masses show their face');
  assert.equal(cellAt(layout, 4, 3).base, 'wall-cap', 'masses continue past the bottom map edge');
  for (const key of [[1, 1], [1, 2], [3, 1], [4, 3]]) {
    assert.deepEqual(layerIds(cellAt(layout, ...key)), [cellAt(layout, ...key).base], 'structure cells carry no border strips');
  }
});

test('walkable cells get exact edge, outer-corner, and inner-corner strips toward walls', () => {
  const { north, south, west, east, innerCorner } = FIELD_TILE_BORDER_BANDS;
  const layout = resolveFieldTileLayout(grid([
    '#....',
    '#....',
    '.....',
    '..#..',
    '.....',
  ]));
  const southOfFace = cellAt(layout, 0, 2);
  assert.deepEqual(layer(southOfFace, 'edge-north'), {
    atlas: 'world-top-down',
    id: 'edge-north',
    sx: getWorldTileFrame('topDown', 'takamine-rain-village', 'edge-north').x,
    sy: getWorldTileFrame('topDown', 'takamine-rain-village', 'edge-north').y,
    sw: 16,
    sh: north,
    dx: 0,
    dy: 0,
  });
  const eastOfWall = cellAt(layout, 1, 0);
  assert.deepEqual(layerIds(eastOfWall).slice(1), ['edge-west']);
  assert.equal(layer(eastOfWall, 'edge-west').sw, west);
  const betweenDiagonals = cellAt(layout, 1, 2);
  assert.deepEqual(layerIds(betweenDiagonals).slice(1), ['inner-corner', 'inner-corner']);
  assert.deepEqual(
    betweenDiagonals.layers.slice(1).map((entry) => [entry.dx, entry.dy, entry.sw, entry.sh]),
    [[0, 0, innerCorner, innerCorner], [16 - innerCorner, 16 - innerCorner, innerCorner, innerCorner]],
  );

  const northOfMass = cellAt(layout, 2, 2);
  assert.deepEqual(layerIds(northOfMass).slice(1), ['edge-south']);
  assert.deepEqual([layer(northOfMass, 'edge-south').dy, layer(northOfMass, 'edge-south').sh], [16 - south, south]);
  const westOfMass = cellAt(layout, 1, 3);
  assert.deepEqual(layerIds(westOfMass).slice(1), ['edge-east']);
  assert.deepEqual([layer(westOfMass, 'edge-east').dx, layer(westOfMass, 'edge-east').sw], [16 - east, east]);
  const southEastOfMass = cellAt(layout, 3, 4);
  assert.deepEqual(layerIds(southEastOfMass).slice(1), ['inner-corner']);
  assert.deepEqual([layer(southEastOfMass, 'inner-corner').dx, layer(southEastOfMass, 'inner-corner').dy], [0, 0]);
  const southWestOfMass = cellAt(layout, 1, 4);
  assert.deepEqual(layerIds(southWestOfMass).slice(1), ['inner-corner']);
  assert.deepEqual([layer(southWestOfMass, 'inner-corner').dx, layer(southWestOfMass, 'inner-corner').dy], [16 - innerCorner, 0]);

  const corner = resolveFieldTileLayout(grid(['##', '#.']));
  const concave = cellAt(corner, 1, 1);
  assert.deepEqual(layerIds(concave).slice(1), ['edge-north', 'edge-west', 'outer-corner']);
  assert.deepEqual(
    [layer(concave, 'outer-corner').dx, layer(concave, 'outer-corner').dy, layer(concave, 'outer-corner').sw, layer(concave, 'outer-corner').sh],
    [0, 0, west, north],
  );

  const open = resolveFieldTileLayout(grid(['...']));
  assert.deepEqual(layerIds(cellAt(open, 0, 0)), ['floor-a'], 'map edges never imply walls');
});

test('impassable terrain tags are structures that still composite their overlay', () => {
  const layout = resolveFieldTileLayout(grid(['...', '...'], { terrain: [{ at: '1,0', tag: 'high-gallery' }] }));
  const gallery = cellAt(layout, 1, 0);
  assert.equal(gallery.impassable, true);
  assert.equal(gallery.base, 'wall');
  assert.deepEqual(layerIds(gallery), ['wall', 'high-gallery']);
  assert.equal(gallery.layers[1].atlas, 'field-terrain');
  assert.ok(layerIds(cellAt(layout, 1, 1)).includes('edge-north'));
});

test('thresholds, liquids, and terrain overlays follow authored level data per theme', () => {
  const water = resolveFieldTileLayout(grid(['....'], {
    exits: [{ id: 'out', at: '3,0' }],
    terrain: [{ at: '1,0', tag: 'water' }, { at: '2,0', tag: 'furnace-grate' }],
  }));
  assert.equal(cellAt(water, 3, 0).base, 'threshold');
  assert.deepEqual(layerIds(cellAt(water, 1, 0)), ['hazard-or-liquid', 'water']);
  assert.deepEqual(layerIds(cellAt(water, 2, 0)), ['floor-a', 'furnace-grate'], 'ember terrain stays floor in a water theme');
  assert.ok(!layerIds(cellAt(water, 0, 0)).includes('stone'), 'the default stone overlay is replaced by the theme floor');

  const forge = resolveFieldTileLayout(grid(['...'], {
    tilesetThemeId: 'oni-forge',
    terrain: [{ at: '1,0', tag: 'furnace-grate' }, { at: '2,0', tag: 'water' }],
  }));
  assert.deepEqual(layerIds(cellAt(forge, 1, 0)), ['hazard-or-liquid', 'furnace-grate']);
  assert.deepEqual(layerIds(cellAt(forge, 2, 0)), ['floor-a', 'water'], 'water terrain never uses an ember liquid');

  for (const [themeId, kind] of Object.entries(FIELD_TILE_THEME_LIQUIDS)) {
    assert.ok(WORLD_TILESET_THEME_IDS.includes(themeId));
    assert.ok(Array.isArray(FIELD_TILE_LIQUID_TERRAIN[kind]));
  }
  assert.deepEqual(Object.keys(FIELD_TILE_THEME_LIQUIDS).sort(), [...WORLD_TILESET_THEME_IDS].sort());
});

test('dressedCells renders dressed impassable cells as floor plus prop-base and treats them as non-wall', () => {
  const level = grid([
    '.###.',
    '.###.',
    '.....',
  ]);
  const before = JSON.stringify(level);
  const plain = resolveFieldTileLayout(level);
  assert.equal(cellAt(plain, 2, 0).base, 'wall-cap');
  assert.ok(layerIds(cellAt(plain, 2, 2)).includes('edge-north'));

  const dressedCells = new Set(['2,1']);
  const dressed = resolveFieldTileLayout(level, { dressedCells });
  const prop = cellAt(dressed, 2, 1);
  assert.equal(prop.impassable, true, 'collision stays authored');
  assert.equal(prop.dressed, true);
  assert.equal(prop.structure, null);
  assert.equal(prop.base, 'prop-base');
  assert.deepEqual(layerIds(prop), ['prop-base', 'edge-north', 'edge-west', 'edge-east', 'outer-corner', 'outer-corner']);
  assert.equal(cellAt(dressed, 2, 0).base, 'wall', 'the mass north of a dressed cell shows its face');
  assert.equal(cellAt(dressed, 1, 0).base, 'wall-cap', 'masses away from the dressed cell keep their top');
  assert.deepEqual(
    layerIds(cellAt(dressed, 2, 2)).slice(1),
    ['inner-corner', 'inner-corner'],
    'walkable cells get no edge strip toward a dressed cell, only corners of real walls',
  );
  assert.ok(layerIds(cellAt(dressed, 1, 2)).includes('edge-north'));
  assert.deepEqual(dressed.dressedCells, ['2,1']);
  assert.deepEqual(dressed.ignoredDressedCells, []);
  assert.deepEqual(resolveFieldTileLayout(level, { dressedCells: new Set(['2,1']) }), dressed, 'deterministic');
  assert.deepEqual([...dressedCells], ['2,1'], 'the caller set is not mutated');
  assert.equal(JSON.stringify(level), before, 'level data is not mutated');

  const ignored = resolveFieldTileLayout(level, { dressedCells: new Set(['0,0', '9,9', 'nope', '1,0']) });
  assert.deepEqual(ignored.dressedCells, ['1,0']);
  assert.deepEqual(ignored.ignoredDressedCells, ['0,0', '9,9', 'nope']);
  const invalidOnly = resolveFieldTileLayout(level, { dressedCells: new Set(['0,0', '9,9', 'nope', '-1,0']) });
  assert.deepEqual(invalidOnly.cells, plain.cells, 'walkable, out-of-bounds, and malformed keys never change presentation');
  assert.deepEqual(invalidOnly.dressedCells, []);

  assert.deepEqual(resolveFieldTileLayout(level, { dressedCells: undefined }), plain);
  assert.deepEqual(resolveFieldTileLayout(level, { dressedCells: new Set() }), plain);
  assert.throws(() => resolveFieldTileLayout(level, { dressedCells: '2,1' }), TypeError);
  assert.throws(() => resolveFieldTileLayout(level, { dressedCells: 42 }), TypeError);
});

test('every live level accepts dressing of all of its impassable cells', () => {
  for (const level of LEVELS) {
    const plain = resolveFieldTileLayout(level);
    const allBlocked = new Set(plain.cells.filter((cell) => cell.impassable).map((cell) => cell.key));
    const dressed = resolveFieldTileLayout(level, { dressedCells: allBlocked });
    assert.equal(dressed.dressedCells.length, allBlocked.size, level.id);
    for (const cell of dressed.cells) {
      assert.equal(cell.structure, null, `${level.id} ${cell.key}`);
      assert.equal(cell.impassable, plain.cells[cell.y * level.width + cell.x].impassable);
      assert.ok(!layerIds(cell).some((id) => id.startsWith('edge-') || id.endsWith('-corner')), `${level.id} ${cell.key} has no walls to border`);
    }
  }
});

test('the fallback contract fails closed on unknown themes, missing images, and wrong sizes', () => {
  const level = LEVELS.find((entry) => entry.id === 'hsh-river-lane');
  const layout = resolveFieldTileLayout(level);
  const unknown = resolveFieldTileLayout(level, { themeId: 'not-a-theme' });
  assert.equal(unknown.themeId, null);
  assert.ok(unknown.cells.every((cell) => cell.layers.length === 0 && cell.base === null));
  assert.equal(canDrawFieldTileLayout(unknown, exactWorld), false);
  assert.equal(canDrawFieldTileLayout(layout, exactWorld), true);
  assert.equal(canDrawFieldTileLayout(null, exactWorld), false);
  for (const image of [null, undefined, { naturalWidth: 0, naturalHeight: 0 }, { naturalWidth: 256, naturalHeight: 127 }, { naturalWidth: 80, naturalHeight: 64 }]) {
    assert.equal(canDrawFieldTileLayout(layout, image), false);
    const context = fakeContext();
    assert.equal(drawFieldTileLayout(context, layout, { worldTopDown: image, fieldTerrain: exactTerrain }), 0);
    assert.equal(context.calls.length, 0, 'nothing is drawn when the gate fails');
  }
  const context = fakeContext();
  assert.equal(drawFieldTileLayout(context, unknown, { worldTopDown: exactWorld }), 0);
  assert.equal(context.calls.length, 0);
  assert.equal(drawFieldTileLayout(null, layout, { worldTopDown: exactWorld }), 0);
  assert.throws(() => resolveFieldTileLayout(null), TypeError);
  assert.throws(() => resolveFieldTileLayout({ id: 'bad', width: 0, height: 3 }), TypeError);
});

test('drawing paints every layer at native scale and skips overlays without an exact terrain atlas', () => {
  const level = LEVELS.find((entry) => entry.id === 'hsh-riverbank');
  const layout = resolveFieldTileLayout(level);
  const allLayers = layout.cells.flatMap((cell) => cell.layers.map((entry) => ({ cell, entry })));
  const worldLayers = allLayers.filter(({ entry }) => entry.atlas === 'world-top-down');
  assert.ok(allLayers.length > worldLayers.length, 'this level carries terrain overlays');

  const full = fakeContext();
  assert.equal(drawFieldTileLayout(full, layout, { worldTopDown: exactWorld, fieldTerrain: exactTerrain }, { originX: 5, originY: 7 }), allLayers.length);
  const [image, sx, sy, sw, sh, dx, dy, dw, dh] = full.calls[0];
  const first = layout.cells[0].layers[0];
  assert.equal(image, exactWorld);
  assert.deepEqual([sx, sy, sw, sh, dx, dy, dw, dh], [first.sx, first.sy, first.sw, first.sh, 5 + first.dx, 7 + first.dy, first.sw, first.sh]);
  for (const call of full.calls) assert.ok(Number.isInteger(call[5]) && Number.isInteger(call[6]), 'integer native placement');

  for (const terrain of [null, { naturalWidth: 79, naturalHeight: 64 }]) {
    const partial = fakeContext();
    assert.equal(drawFieldTileLayout(partial, layout, { worldTopDown: exactWorld, fieldTerrain: terrain }), worldLayers.length);
    assert.ok(partial.calls.every((call) => call[0] === exactWorld));
  }
});

test('module band and liquid contracts match the production suite and runtime copy', async () => {
  const [sourceText, runtimeText, manifestText, runtimePng] = await Promise.all([
    readFile(new URL('world-tileset-suite.source.json', suiteUrl), 'utf8'),
    readFile(new URL('world-tileset-runtime-v1.json', suiteUrl), 'utf8'),
    readFile(new URL('manifest.json', suiteUrl), 'utf8'),
    readFile(new URL('../assets/art/world-tileset-suite-v1/top-down-regional-tiles-v1.png', import.meta.url)),
  ]);
  const source = JSON.parse(sourceText);
  const runtime = JSON.parse(runtimeText);
  const manifest = JSON.parse(manifestText);
  assert.deepEqual(source.topDown.autotileBands, { ...FIELD_TILE_BORDER_BANDS });
  assert.deepEqual(runtime.views.topDown.autotileBands, { ...FIELD_TILE_BORDER_BANDS });
  for (const theme of source.themes) assert.equal(theme.topDownLiquid.kind, FIELD_TILE_THEME_LIQUIDS[theme.id], theme.id);
  for (const theme of runtime.themes) assert.equal(theme.topDownLiquid.kind, FIELD_TILE_THEME_LIQUIDS[theme.id], theme.id);
  assert.equal(createHash('sha256').update(runtimePng).digest('hex'), manifest.topDown.atlasSha256);
});

test('Campaign integrates regional tiles decoratively with the exact flat-color fallback intact', async () => {
  const source = await readFile(new URL('../campaign.js', import.meta.url), 'utf8');
  assert.match(source, /worldTileAtlasImage\.src = WORLD_TILESET_ATLASES\.topDown\.url/u);
  assert.match(source, /worldTileAtlasState = worldTilesetImageHasExpectedSize\(worldTileAtlasImage, 'topDown'\) \? 'ready' : 'error'/u);
  assert.match(source, /addEventListener\('error', \(\) => \{\s*worldTileAtlasState = 'error';/u);
  assert.match(source, /mapCanvas\.dataset\.worldTileArtState = worldTileAtlasState/u);
  assert.match(source, /mapCanvas\.dataset\.worldTileThemeId = worldTileThemeId/u);

  const base = source.slice(source.indexOf('function getFieldTileBase'), source.indexOf('function formatEnemies'));
  assert.match(base, /if \(worldTileAtlasState !== 'ready' \|\| !worldTilesetImageHasExpectedSize\(worldTileAtlasImage, 'topDown'\)\) return null;/u);
  assert.match(base, /canDrawFieldTileLayout\(layout, worldTileAtlasImage\)/u);
  assert.match(base, /catch \(error\)[\s\S]*base = null;/u);
  assert.doesNotMatch(base, /commitStateChanges|fieldRuntimeState|moveFieldBy|telemetry|evidence|localStorage/u);

  const draw = source.slice(source.indexOf('function drawMap'), source.indexOf('function getFieldTileBase'));
  const tiles = draw.indexOf('const worldTileBase = getFieldTileBase(level, propDressing?.dressedCells)');
  const legacy = draw.indexOf('mapCtx.fillStyle = terrainColor(terrain, palette)');
  const props = draw.indexOf('drawFieldPropDressing(mapCtx');
  const followers = draw.indexOf('drawFieldFormationFollowers(level');
  assert.ok(tiles > 0 && legacy > tiles && followers > legacy, 'tiles compose before the legacy branch and every actor');
  assert.ok(props > legacy && followers > props, 'props draw over floor tiles and under every actor');
  assert.match(draw, /if \(worldTileBase\) \{[\s\S]*\} else \{\s*mapCtx\.fillStyle = terrainColor\(terrain, palette\);/u);
  assert.match(draw, /if \(blocked\.has\(key\)\) \{\s*mapCtx\.fillStyle = palette\.blocked;/u);
  assert.match(draw, /if \(exits\.has\(key\)\) \{\s*mapCtx\.strokeStyle = '#72d7d0';/u, 'authored exit markers stay on top of thresholds');
});
