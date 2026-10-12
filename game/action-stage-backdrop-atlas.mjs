/**
 * DOM-free addressing for the side-view action-stage backdrop suite.
 *
 * Each of the 20 action stages owns one opaque 480 x 270 backdrop presented at
 * an exact 2x integer scale on the 960 x 540 action canvas, plus one row of
 * 16 x 16 binary-alpha surface tiles (ground, one-way platform caps/middle,
 * and an optional support post). Surface placement is derived only from the
 * side-view stage contract in action-stages.mjs; art never alters collision.
 */

export const ACTION_STAGE_BACKDROP_SUITE = Object.freeze({
  id: 'action-stage-backdrop-suite-v1',
  root: './assets/art/action-stage-backdrop-suite-v1/',
  nativeWidth: 480,
  nativeHeight: 270,
  scale: 2,
  canvasWidth: 960,
  canvasHeight: 540,
});

export const ACTION_STAGE_SURFACE_TILE_ROLES = Object.freeze([
  'ground-a',
  'ground-b',
  'platform-left',
  'platform-middle',
  'platform-right',
  'support',
]);

/** Stage order is the tile-row order of the surface atlas. */
export const ACTION_STAGE_BACKDROP_IDS = Object.freeze([
  'hsh-census-square',
  'c1-flooded-cedars',
  'c1-tax-storehouse',
  'fp1-wet-cedar-stage',
  'fp1-flooded-archive-stage',
  'tkm-bell-chamber',
  'sdg-rain-docks',
  'sdg-salt-warehouse',
  'ngi-tide-caves',
  'ngi-storm-reef',
  'kgr-ash-fields',
  'kgr-archive-furnace',
  'kzu-archive-roof',
  'kzu-public-tribunal',
  'hsh-prison-ferry',
  'hsh-bell-aqueduct',
  'c8-black-gate',
  'krh-outer-archive',
  'krh-observatory',
  'epi-hoshigawa-archive',
]);

/** Organic ledges (roots, rock shelves, reef spines) read better without posts. */
const STAGES_WITHOUT_SUPPORTS = new Set([
  'c1-flooded-cedars',
  'fp1-wet-cedar-stage',
  'ngi-tide-caves',
  'ngi-storm-reef',
]);

const TILE = 16;

export const ACTION_STAGE_SURFACE_TILES = Object.freeze({
  id: 'action-stage-backdrop-suite-v1:surface-tiles',
  url: `${ACTION_STAGE_BACKDROP_SUITE.root}action-stage-surface-tiles.png`,
  tileWidth: TILE,
  tileHeight: TILE,
  columns: ACTION_STAGE_SURFACE_TILE_ROLES.length,
  rows: ACTION_STAGE_BACKDROP_IDS.length,
  width: TILE * ACTION_STAGE_SURFACE_TILE_ROLES.length,
  height: TILE * ACTION_STAGE_BACKDROP_IDS.length,
  scale: ACTION_STAGE_BACKDROP_SUITE.scale,
  alphaPolicy: 'binary',
});

const BACKDROPS = new Map(ACTION_STAGE_BACKDROP_IDS.map((stageId, index) => [stageId, Object.freeze({
  id: `${stageId}-backdrop-v1`,
  stageId,
  levelId: stageId,
  index,
  tileRow: index,
  url: `${ACTION_STAGE_BACKDROP_SUITE.root}backdrops/${stageId}.png`,
  width: ACTION_STAGE_BACKDROP_SUITE.nativeWidth,
  height: ACTION_STAGE_BACKDROP_SUITE.nativeHeight,
  scale: ACTION_STAGE_BACKDROP_SUITE.scale,
  supports: !STAGES_WITHOUT_SUPPORTS.has(stageId),
})]));

/** Resolve a backdrop from a stage id, a levelId, or a stage/level object. */
export function getActionStageBackdrop(stageOrLevel) {
  const key = typeof stageOrLevel === 'object' && stageOrLevel !== null
    ? (stageOrLevel.id ?? stageOrLevel.levelId)
    : stageOrLevel;
  return BACKDROPS.get(String(key ?? '')) ?? null;
}

export function getActionStageSurfaceTile(stageOrLevel, role) {
  const backdrop = getActionStageBackdrop(stageOrLevel);
  const column = ACTION_STAGE_SURFACE_TILE_ROLES.indexOf(role);
  if (!backdrop || column < 0) return null;
  return Object.freeze({
    stageId: backdrop.stageId,
    role,
    x: column * TILE,
    y: backdrop.tileRow * TILE,
    width: TILE,
    height: TILE,
  });
}

function imageHasSize(image, width, height) {
  return Boolean(image)
    && Number(image.naturalWidth) === width
    && Number(image.naturalHeight) === height;
}

export function actionStageBackdropImageHasExpectedSize(image) {
  return imageHasSize(image, ACTION_STAGE_BACKDROP_SUITE.nativeWidth, ACTION_STAGE_BACKDROP_SUITE.nativeHeight);
}

export function actionStageSurfaceTilesImageHasExpectedSize(image) {
  return imageHasSize(image, ACTION_STAGE_SURFACE_TILES.width, ACTION_STAGE_SURFACE_TILES.height);
}

/** Post x positions: both platform ends plus one roughly every 128 canvas px. */
function supportXs(left, right) {
  const first = left + 16;
  const last = right - 48;
  const gaps = Math.max(1, Math.floor((last - first + 64) / 128));
  return Array.from({ length: gaps + 1 }, (_, index) => (
    Math.floor((first + Math.floor(((last - first) * index) / gaps)) / 2) * 2
  ));
}

/**
 * Exact tile draw operations, in canvas pixels, for one stage contract:
 * support posts first, then platform decks, then the ground row. Every source
 * rectangle is a whole number of native pixels; every destination is 2x it.
 */
export function planActionStageSurfaces(stageContract, backdrop = getActionStageBackdrop(stageContract)) {
  if (!backdrop || !stageContract) return Object.freeze([]);
  const scale = ACTION_STAGE_BACKDROP_SUITE.scale;
  const step = TILE * scale;
  const groundY = stageContract.groundY;
  const ops = [];
  const op = (role, sw, sh, dx, dy) => {
    const frame = getActionStageSurfaceTile(backdrop.stageId, role);
    ops.push(Object.freeze({
      role,
      sx: frame.x,
      sy: frame.y,
      sw,
      sh,
      dx,
      dy,
      dw: sw * scale,
      dh: sh * scale,
    }));
  };
  if (backdrop.supports) {
    for (const platform of stageContract.platforms ?? []) {
      for (const x of supportXs(platform.left, platform.right)) {
        for (let y = platform.y + 16; y < groundY; y += step) {
          op('support', TILE, Math.min(step, groundY - y) / scale, x, y);
        }
      }
    }
  }
  for (const platform of stageContract.platforms ?? []) {
    op('platform-left', TILE, TILE, platform.left, platform.y);
    for (let x = platform.left + step; x < platform.right - step; x += step) {
      op('platform-middle', Math.min(step, platform.right - step - x) / scale, TILE, x, platform.y);
    }
    op('platform-right', TILE, TILE, platform.right - step, platform.y);
  }
  const columns = ACTION_STAGE_BACKDROP_SUITE.canvasWidth / step;
  for (let index = 0; index < columns; index += 1) {
    op(index % 3 === 2 ? 'ground-b' : 'ground-a', TILE, TILE, index * step, groundY);
  }
  return Object.freeze(ops);
}

/**
 * Presentation mode for drawStage():
 * - 'backdrop': opaque backdrop plus tiled ground/platform surfaces;
 * - 'backdrop-strokes': backdrop ready but tiles missing, so the legacy
 *   ground and platform strokes mark the surfaces;
 * - 'board-fallback': unknown stage, or the backdrop is still loading, failed,
 *   or decoded at the wrong size, so the legacy rendering runs unchanged.
 */
export function resolveActionStageRenderMode({ backdrop, backdropReady, tilesReady } = {}) {
  if (!backdrop || backdropReady !== true) return 'board-fallback';
  return tilesReady === true ? 'backdrop' : 'backdrop-strokes';
}
