import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { ACTION_STAGES, ACTION_STAGE_IDS, getActionStage } from '../action-stages.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import {
  ACTION_STAGE_BACKDROP_IDS,
  ACTION_STAGE_BACKDROP_SUITE,
  ACTION_STAGE_SURFACE_TILES,
  ACTION_STAGE_SURFACE_TILE_ROLES,
  actionStageBackdropImageHasExpectedSize,
  actionStageSurfaceTilesImageHasExpectedSize,
  getActionStageBackdrop,
  getActionStageSurfaceTile,
  planActionStageSurfaces,
  resolveActionStageRenderMode,
} from '../action-stage-backdrop-atlas.mjs';

const MANIFEST_URL = new URL('../../assets/art/action-stage-backdrop-suite-v1/manifest.json', import.meta.url);
const NO_SUPPORT_STAGES = ['c1-flooded-cedars', 'fp1-wet-cedar-stage', 'ngi-tide-caves', 'ngi-storm-reef'];

function spans(ops) {
  return ops.map(({ dx, dw }) => [dx, dx + dw]).sort((a, b) => a[0] - b[0]);
}

function assertContiguous(ranges, start, end, label) {
  assert.ok(ranges.length > 0, `${label} has no tiles`);
  assert.equal(ranges[0][0], start, `${label} must start at ${start}`);
  for (let index = 1; index < ranges.length; index += 1) {
    assert.equal(ranges[index][0], ranges[index - 1][1], `${label} tiles must abut without gaps or overlap`);
  }
  assert.equal(ranges.at(-1)[1], end, `${label} must end at ${end}`);
}

test('every action stage maps to exactly one backdrop, in tile-row order', () => {
  assert.equal(ACTION_STAGE_IDS.length, 20);
  assert.deepEqual([...ACTION_STAGE_BACKDROP_IDS], [...ACTION_STAGE_IDS]);
  const urls = new Set();
  for (const [index, stageId] of ACTION_STAGE_IDS.entries()) {
    const backdrop = getActionStageBackdrop(stageId);
    assert.deepEqual(backdrop, {
      id: `${stageId}-backdrop-v1`,
      stageId,
      levelId: stageId,
      index,
      tileRow: index,
      url: `./assets/art/action-stage-backdrop-suite-v1/backdrops/${stageId}.png`,
      width: 480,
      height: 270,
      scale: 2,
      supports: !NO_SUPPORT_STAGES.includes(stageId),
    });
    assert.equal(Object.isFrozen(backdrop), true);
    assert.equal(getActionStageBackdrop(getActionStage(stageId)), backdrop, 'stage contracts resolve by id');
    assert.equal(getActionStageBackdrop({ levelId: stageId }), backdrop, 'level-shaped objects resolve by levelId');
    urls.add(backdrop.url);
  }
  assert.equal(urls.size, 20);
  assert.equal(getActionStageBackdrop('not-a-stage'), null);
  assert.equal(getActionStageBackdrop(undefined), null);
  assert.equal(getActionStageBackdrop(null), null);
  assert.equal(getActionStageBackdrop({}), null);
});

test('every encounter on an action stage resolves its backdrop through its levelId', () => {
  const covered = new Set();
  for (const encounter of ENCOUNTERS) {
    if (!ACTION_STAGE_IDS.includes(encounter.levelId)) continue;
    assert.equal(getActionStageBackdrop(encounter.levelId)?.stageId, encounter.levelId, encounter.id);
    covered.add(encounter.levelId);
  }
  assert.deepEqual([...covered].sort(), [...ACTION_STAGE_IDS].sort());
});

test('backdrop and tile dimensions form an exact integer-scale contract', () => {
  assert.deepEqual(ACTION_STAGE_BACKDROP_SUITE, {
    id: 'action-stage-backdrop-suite-v1',
    root: './assets/art/action-stage-backdrop-suite-v1/',
    nativeWidth: 480,
    nativeHeight: 270,
    scale: 2,
    canvasWidth: 960,
    canvasHeight: 540,
  });
  assert.equal(ACTION_STAGE_BACKDROP_SUITE.nativeWidth * ACTION_STAGE_BACKDROP_SUITE.scale, 960);
  assert.equal(ACTION_STAGE_BACKDROP_SUITE.nativeHeight * ACTION_STAGE_BACKDROP_SUITE.scale, 540);
  assert.deepEqual(ACTION_STAGE_SURFACE_TILES, {
    id: 'action-stage-backdrop-suite-v1:surface-tiles',
    url: './assets/art/action-stage-backdrop-suite-v1/action-stage-surface-tiles.png',
    tileWidth: 16,
    tileHeight: 16,
    columns: 6,
    rows: 20,
    width: 96,
    height: 320,
    scale: 2,
    alphaPolicy: 'binary',
  });
  assert.deepEqual([...ACTION_STAGE_SURFACE_TILE_ROLES], [
    'ground-a', 'ground-b', 'platform-left', 'platform-middle', 'platform-right', 'support',
  ]);
  const rects = new Set();
  for (const stageId of ACTION_STAGE_IDS) {
    for (const role of ACTION_STAGE_SURFACE_TILE_ROLES) {
      const tile = getActionStageSurfaceTile(stageId, role);
      assert.equal(tile.width, 16);
      assert.equal(tile.height, 16);
      assert.ok(tile.x + tile.width <= 96 && tile.y + tile.height <= 320);
      rects.add(`${tile.x},${tile.y}`);
    }
  }
  assert.equal(rects.size, 120);
  assert.equal(getActionStageSurfaceTile('hsh-census-square', 'wall'), null);
  assert.equal(getActionStageSurfaceTile('unknown', 'ground-a'), null);
});

test('image validation fails closed on undecoded or wrong-size rasters', () => {
  for (const check of [actionStageBackdropImageHasExpectedSize, actionStageSurfaceTilesImageHasExpectedSize]) {
    assert.equal(check(null), false);
    assert.equal(check(undefined), false);
    assert.equal(check({ naturalWidth: 0, naturalHeight: 0 }), false);
  }
  assert.equal(actionStageBackdropImageHasExpectedSize({ naturalWidth: 480, naturalHeight: 270 }), true);
  assert.equal(actionStageBackdropImageHasExpectedSize({ naturalWidth: 960, naturalHeight: 540 }), false);
  assert.equal(actionStageBackdropImageHasExpectedSize({ naturalWidth: 480, naturalHeight: 269 }), false);
  assert.equal(actionStageSurfaceTilesImageHasExpectedSize({ naturalWidth: 96, naturalHeight: 320 }), true);
  assert.equal(actionStageSurfaceTilesImageHasExpectedSize({ naturalWidth: 96, naturalHeight: 319 }), false);
});

test('surface plans align exactly to groundY and every platform left/right/y', () => {
  for (const stage of ACTION_STAGES) {
    const backdrop = getActionStageBackdrop(stage.id);
    const ops = planActionStageSurfaces(stage);
    assert.equal(Object.isFrozen(ops), true);
    for (const op of ops) {
      assert.ok(Number.isInteger(op.sw) && Number.isInteger(op.sh), `${stage.id} source rect must be whole native pixels`);
      assert.ok(op.sw > 0 && op.sw <= 16 && op.sh > 0 && op.sh <= 16);
      assert.equal(op.dw, op.sw * 2);
      assert.equal(op.dh, op.sh * 2);
      const tile = getActionStageSurfaceTile(stage.id, op.role);
      assert.deepEqual([op.sx, op.sy], [tile.x, tile.y], `${stage.id} ${op.role} reads its own tile row`);
      assert.equal(op.dx % 2, 0);
      assert.equal(op.dy % 2, 0);
    }
    const ground = ops.filter(({ role }) => role.startsWith('ground-'));
    assert.ok(ground.every(({ dy, dh }) => dy === stage.groundY && dh === 32), `${stage.id} ground row sits on groundY`);
    assertContiguous(spans(ground), 0, 960, `${stage.id} ground`);
    for (const platform of stage.platforms) {
      const deck = ops.filter(({ role, dy, dx }) => role.startsWith('platform-') && dy === platform.y
        && dx >= platform.left && dx < platform.right);
      assert.equal(deck.filter(({ role }) => role === 'platform-left').length, 1);
      assert.equal(deck.filter(({ role }) => role === 'platform-right').length, 1);
      assertContiguous(spans(deck), platform.left, platform.right, `${stage.id}/${platform.id} deck`);
      const posts = ops.filter(({ role, dx }) => role === 'support' && dx >= platform.left && dx + 32 <= platform.right);
      if (backdrop.supports) {
        const columns = new Map();
        for (const post of posts) columns.set(post.dx, [...(columns.get(post.dx) ?? []), [post.dy, post.dy + post.dh]]);
        assert.ok(columns.size >= 2, `${stage.id}/${platform.id} needs posts at both ends`);
        for (const [x, ranges] of columns) {
          ranges.sort((a, b) => a[0] - b[0]);
          assert.equal(ranges[0][0], platform.y + 16, `${stage.id} post at ${x} starts under the deck`);
          for (let index = 1; index < ranges.length; index += 1) assert.equal(ranges[index][0], ranges[index - 1][1]);
          assert.equal(ranges.at(-1)[1], stage.groundY, `${stage.id} post at ${x} reaches the ground`);
        }
      } else {
        assert.equal(posts.length, 0, `${stage.id} organic ledges have no posts`);
      }
    }
    const order = ops.map(({ role }) => (role === 'support' ? 0 : role.startsWith('platform-') ? 1 : 2));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${stage.id} draws supports, then decks, then ground`);
  }
  assert.deepEqual(planActionStageSurfaces({ id: 'unknown', groundY: 440, platforms: [] }), []);
  assert.deepEqual(planActionStageSurfaces(null), []);
});

test('JS surface plans are byte-for-byte the plans the builder hashed', async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_URL, 'utf8'));
  for (const stage of ACTION_STAGES) {
    const record = manifest.backdrops.find(({ stageId }) => stageId === stage.id);
    const plan = planActionStageSurfaces(stage).map((op) => ({ ...op }));
    const hash = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
    assert.equal(hash, record.surfacePlanSha256, `${stage.id} surface plan drifted from the builder`);
    assert.equal(record.supports, getActionStageBackdrop(stage.id).supports);
  }
});

test('render mode falls back to the unchanged board rendering unless the backdrop is ready', () => {
  const backdrop = getActionStageBackdrop('tkm-bell-chamber');
  assert.equal(resolveActionStageRenderMode(), 'board-fallback');
  assert.equal(resolveActionStageRenderMode({ backdrop: null, backdropReady: true, tilesReady: true }), 'board-fallback');
  assert.equal(resolveActionStageRenderMode({ backdrop, backdropReady: false, tilesReady: true }), 'board-fallback');
  assert.equal(resolveActionStageRenderMode({ backdrop, backdropReady: 'ready', tilesReady: true }), 'board-fallback');
  assert.equal(resolveActionStageRenderMode({ backdrop, backdropReady: true, tilesReady: false }), 'backdrop-strokes');
  assert.equal(resolveActionStageRenderMode({ backdrop, backdropReady: true, tilesReady: true }), 'backdrop');
});
