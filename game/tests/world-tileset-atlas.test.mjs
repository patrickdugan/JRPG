import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  WORLD_SIDE_VIEW_TILE_ROLES,
  WORLD_TILESET_ATLASES,
  WORLD_TILESET_RUNTIME_POLICY,
  WORLD_TILESET_THEME_IDS,
  WORLD_TOP_DOWN_TILE_ROLES,
  getWorldTileFrame,
  resolveWorldThemeForLevel,
  worldTilesetImageHasExpectedSize,
} from '../world-tileset-atlas.mjs';

const suiteUrl = new URL('../../assets/art/world-tileset-suite-v1/', import.meta.url);
const runtimeRoot = new URL('../assets/art/world-tileset-suite-v1/', import.meta.url);

test('world tileset module exactly addresses all 256 regional tiles and semantics', async () => {
  const contract = JSON.parse(await readFile(new URL('world-tileset-runtime-v1.json', suiteUrl), 'utf8'));
  assert.deepEqual(WORLD_TILESET_THEME_IDS, contract.themeOrder);
  assert.deepEqual(WORLD_TOP_DOWN_TILE_ROLES, contract.views.topDown.roles.map(({ id }) => id));
  assert.deepEqual(WORLD_SIDE_VIEW_TILE_ROLES, contract.views.sideView.roles.map(({ id }) => id));
  assert.deepEqual(WORLD_TILESET_RUNTIME_POLICY, {
    collisionAuthority: contract.runtimePolicy.collisionAuthority,
    hazardAuthority: contract.runtimePolicy.hazardAuthority,
    transitionAuthority: contract.runtimePolicy.transitionAuthority,
    occlusionAuthority: contract.runtimePolicy.occlusionAuthority,
  });

  for (const [viewId, roleIds] of [
    ['topDown', WORLD_TOP_DOWN_TILE_ROLES],
    ['sideView', WORLD_SIDE_VIEW_TILE_ROLES],
  ]) {
    const sourceRoles = Object.fromEntries(contract.views[viewId].roles.map((role) => [role.id, role]));
    for (let row = 0; row < WORLD_TILESET_THEME_IDS.length; row += 1) {
      for (let column = 0; column < roleIds.length; column += 1) {
        const frame = getWorldTileFrame(viewId, WORLD_TILESET_THEME_IDS[row], roleIds[column]);
        assert.deepEqual([frame.row, frame.column], [row, column]);
        assert.deepEqual(
          [frame.x, frame.y, frame.width, frame.height],
          [
            column * contract.views[viewId].tileWidth,
            row * contract.views[viewId].tileHeight,
            contract.views[viewId].tileWidth,
            contract.views[viewId].tileHeight,
          ],
        );
        const { id, column: ignoredColumn, rect, ...semantics } = sourceRoles[roleIds[column]];
        assert.deepEqual(frame.semantics, semantics);
        assert.equal(Object.isFrozen(frame.semantics), true);
      }
    }
  }
  assert.equal(getWorldTileFrame('isometric', WORLD_TILESET_THEME_IDS[0], 'floor-a'), null);
  assert.equal(getWorldTileFrame('topDown', 'unknown', 'floor-a'), null);
  assert.equal(getWorldTileFrame('topDown', WORLD_TILESET_THEME_IDS[0], 'unknown'), null);
});

test('theme resolution prefers explicit authorship and otherwise supplies regional presentation defaults', () => {
  assert.equal(
    resolveWorldThemeForLevel({ id: 'custom', tilesetThemeId: 'oni-forge', palette: { id: 'takamine-rain' } }),
    'oni-forge',
  );
  assert.equal(resolveWorldThemeForLevel('krh-bell-spine'), 'black-bell-engine');
  assert.equal(resolveWorldThemeForLevel('kgr-archive-furnace'), 'oni-forge');
  assert.equal(resolveWorldThemeForLevel('krh-audience-hall'), 'kurohana-black-castle');
  assert.equal(resolveWorldThemeForLevel('sdg-rain-docks'), 'sodegaura-relay-road');
  assert.equal(resolveWorldThemeForLevel('hsh-river-lane'), 'hoshigawa-river-ward');
  assert.equal(resolveWorldThemeForLevel({ id: 'unknown', palette: { id: 'archive-indigo' } }), 'hidden-archive-chapel');
});

test('runtime tile atlases are byte-identical and image validation fails closed', async () => {
  for (const [viewId, filename] of [
    ['topDown', 'top-down-regional-tiles-v1.png'],
    ['sideView', 'side-view-regional-tiles-v1.png'],
  ]) {
    const [source, runtime] = await Promise.all([
      readFile(new URL(filename, suiteUrl)),
      readFile(new URL(filename, runtimeRoot)),
    ]);
    assert.equal(runtime.equals(source), true);
    const atlas = WORLD_TILESET_ATLASES[viewId];
    assert.equal(worldTilesetImageHasExpectedSize({ naturalWidth: atlas.width, naturalHeight: atlas.height }, viewId), true);
    assert.equal(worldTilesetImageHasExpectedSize({ naturalWidth: atlas.width - 1, naturalHeight: atlas.height }, viewId), false);
  }
  assert.equal(worldTilesetImageHasExpectedSize({ naturalWidth: 1, naturalHeight: 1 }, 'unknown'), false);
});
