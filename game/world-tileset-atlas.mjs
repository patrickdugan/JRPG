/** DOM-free addressing and conservative authoring hints for regional tiles. */

export const WORLD_TILESET_THEME_IDS = Object.freeze([
  'takamine-rain-village',
  'hoshigawa-river-ward',
  'sodegaura-relay-road',
  'kagura-ash-pass',
  'kurohana-black-castle',
  'hidden-archive-chapel',
  'oni-forge',
  'black-bell-engine',
]);

export const WORLD_TOP_DOWN_TILE_ROLES = Object.freeze([
  'floor-a', 'floor-b', 'floor-detail', 'path',
  'wall', 'wall-cap', 'edge-north', 'edge-south',
  'edge-west', 'edge-east', 'outer-corner', 'inner-corner',
  'hazard-or-liquid', 'prop-base', 'threshold', 'foreground-occluder',
]);

export const WORLD_SIDE_VIEW_TILE_ROLES = Object.freeze([
  'backfill', 'ground-left', 'ground-middle', 'ground-right',
  'platform-left', 'platform-middle', 'platform-right', 'wall',
  'ceiling', 'slope-up', 'stairs-up', 'pillar',
  'hazard', 'prop', 'door', 'foreground',
]);

export const WORLD_TILESET_ATLASES = Object.freeze({
  topDown: Object.freeze({
    id: 'world-tileset-suite-v1:top-down',
    url: './assets/art/world-tileset-suite-v1/top-down-regional-tiles-v1.png',
    tileWidth: 16,
    tileHeight: 16,
    columns: 16,
    rows: 8,
    width: 256,
    height: 128,
    alphaPolicy: 'opaque',
  }),
  sideView: Object.freeze({
    id: 'world-tileset-suite-v1:side-view',
    url: './assets/art/world-tileset-suite-v1/side-view-regional-tiles-v1.png',
    tileWidth: 32,
    tileHeight: 32,
    columns: 16,
    rows: 8,
    width: 512,
    height: 256,
    alphaPolicy: 'opaque',
  }),
});

const TOP_DOWN_SEMANTICS = Object.freeze({
  'floor-a': Object.freeze({ layer: 'ground', collisionHint: 'passable', hazardHint: false, occludesActor: false, transitionHint: false }),
  'floor-b': Object.freeze({ layer: 'ground', collisionHint: 'passable', hazardHint: false, occludesActor: false, transitionHint: false }),
  'floor-detail': Object.freeze({ layer: 'ground', collisionHint: 'passable', hazardHint: false, occludesActor: false, transitionHint: false }),
  path: Object.freeze({ layer: 'ground', collisionHint: 'passable', hazardHint: false, occludesActor: false, transitionHint: false }),
  wall: Object.freeze({ layer: 'structure', collisionHint: 'solid', hazardHint: false, occludesActor: true, transitionHint: false }),
  'wall-cap': Object.freeze({ layer: 'structure', collisionHint: 'solid', hazardHint: false, occludesActor: true, transitionHint: false }),
  'edge-north': Object.freeze({ layer: 'ground', collisionHint: 'level-authored', hazardHint: false, occludesActor: false, transitionHint: false }),
  'edge-south': Object.freeze({ layer: 'ground', collisionHint: 'level-authored', hazardHint: false, occludesActor: false, transitionHint: false }),
  'edge-west': Object.freeze({ layer: 'ground', collisionHint: 'level-authored', hazardHint: false, occludesActor: false, transitionHint: false }),
  'edge-east': Object.freeze({ layer: 'ground', collisionHint: 'level-authored', hazardHint: false, occludesActor: false, transitionHint: false }),
  'outer-corner': Object.freeze({ layer: 'structure', collisionHint: 'solid', hazardHint: false, occludesActor: true, transitionHint: false }),
  'inner-corner': Object.freeze({ layer: 'structure', collisionHint: 'level-authored', hazardHint: false, occludesActor: true, transitionHint: false }),
  'hazard-or-liquid': Object.freeze({ layer: 'effect', collisionHint: 'level-authored', hazardHint: true, occludesActor: false, transitionHint: false }),
  'prop-base': Object.freeze({ layer: 'structure', collisionHint: 'level-authored', hazardHint: false, occludesActor: false, transitionHint: false }),
  threshold: Object.freeze({ layer: 'interaction', collisionHint: 'passable', hazardHint: false, occludesActor: false, transitionHint: true }),
  'foreground-occluder': Object.freeze({ layer: 'foreground', collisionHint: 'level-authored', hazardHint: false, occludesActor: true, transitionHint: false }),
});

const SIDE_VIEW_SEMANTICS = Object.freeze({
  backfill: Object.freeze({ layer: 'background', collisionHint: 'none', hazardHint: false, occludesActor: false, transitionHint: false }),
  'ground-left': Object.freeze({ layer: 'structure', collisionHint: 'solid', hazardHint: false, occludesActor: false, transitionHint: false }),
  'ground-middle': Object.freeze({ layer: 'structure', collisionHint: 'solid', hazardHint: false, occludesActor: false, transitionHint: false }),
  'ground-right': Object.freeze({ layer: 'structure', collisionHint: 'solid', hazardHint: false, occludesActor: false, transitionHint: false }),
  'platform-left': Object.freeze({ layer: 'structure', collisionHint: 'one-way', hazardHint: false, occludesActor: false, transitionHint: false }),
  'platform-middle': Object.freeze({ layer: 'structure', collisionHint: 'one-way', hazardHint: false, occludesActor: false, transitionHint: false }),
  'platform-right': Object.freeze({ layer: 'structure', collisionHint: 'one-way', hazardHint: false, occludesActor: false, transitionHint: false }),
  wall: Object.freeze({ layer: 'structure', collisionHint: 'solid', hazardHint: false, occludesActor: true, transitionHint: false }),
  ceiling: Object.freeze({ layer: 'structure', collisionHint: 'solid', hazardHint: false, occludesActor: false, transitionHint: false }),
  'slope-up': Object.freeze({ layer: 'structure', collisionHint: 'slope-up', hazardHint: false, occludesActor: false, transitionHint: false }),
  'stairs-up': Object.freeze({ layer: 'structure', collisionHint: 'stairs-up', hazardHint: false, occludesActor: false, transitionHint: false }),
  pillar: Object.freeze({ layer: 'structure', collisionHint: 'solid', hazardHint: false, occludesActor: true, transitionHint: false }),
  hazard: Object.freeze({ layer: 'effect', collisionHint: 'level-authored', hazardHint: true, occludesActor: false, transitionHint: false }),
  prop: Object.freeze({ layer: 'interaction', collisionHint: 'level-authored', hazardHint: false, occludesActor: false, transitionHint: false }),
  door: Object.freeze({ layer: 'interaction', collisionHint: 'level-authored', hazardHint: false, occludesActor: false, transitionHint: true }),
  foreground: Object.freeze({ layer: 'foreground', collisionHint: 'none', hazardHint: false, occludesActor: true, transitionHint: false }),
});

export const WORLD_TILESET_RUNTIME_POLICY = Object.freeze({
  collisionAuthority: 'authored level data; collisionHint is a default authoring recommendation only',
  hazardAuthority: 'authored level data; hazardHint never applies damage by itself',
  transitionAuthority: 'authored level exits and interactions',
  occlusionAuthority: 'render-layer composition using occludesActor as the default sorting hint',
});

function viewContract(viewId) {
  if (viewId === 'topDown') {
    return { atlas: WORLD_TILESET_ATLASES.topDown, roles: WORLD_TOP_DOWN_TILE_ROLES, semantics: TOP_DOWN_SEMANTICS };
  }
  if (viewId === 'sideView') {
    return { atlas: WORLD_TILESET_ATLASES.sideView, roles: WORLD_SIDE_VIEW_TILE_ROLES, semantics: SIDE_VIEW_SEMANTICS };
  }
  return null;
}

/** Resolve one exact regional tile rectangle and its non-authoritative hints. */
export function getWorldTileFrame(viewId, themeId, roleId) {
  const view = viewContract(viewId);
  const row = WORLD_TILESET_THEME_IDS.indexOf(themeId);
  const column = view?.roles.indexOf(roleId) ?? -1;
  if (!view || row < 0 || column < 0) return null;
  return Object.freeze({
    id: `${viewId}:${themeId}:${roleId}`,
    viewId,
    themeId,
    roleId,
    row,
    column,
    x: column * view.atlas.tileWidth,
    y: row * view.atlas.tileHeight,
    width: view.atlas.tileWidth,
    height: view.atlas.tileHeight,
    semantics: view.semantics[roleId],
  });
}

const PALETTE_THEME_DEFAULTS = Object.freeze({
  'takamine-rain': 'takamine-rain-village',
  'archive-indigo': 'hidden-archive-chapel',
  'coast-fog': 'hoshigawa-river-ward',
  'kagura-ash': 'kagura-ash-pass',
  'court-vermilion': 'kurohana-black-castle',
  'daybreak-parchment': 'takamine-rain-village',
});

/**
 * Resolve a conservative presentation default. An explicit valid
 * `tilesetThemeId` always wins; level collision and game rules are untouched.
 */
export function resolveWorldThemeForLevel(levelOrId, paletteId = undefined) {
  const level = typeof levelOrId === 'object' && levelOrId !== null ? levelOrId : null;
  const levelId = String(level?.id ?? levelOrId ?? '');
  const explicit = level?.tilesetThemeId;
  if (WORLD_TILESET_THEME_IDS.includes(explicit)) return explicit;
  const resolvedPalette = paletteId ?? level?.palette?.id;

  if (/bell-spine|observatory|bell-engine/u.test(levelId)) return 'black-bell-engine';
  if (/archive-furnace|prison-locks|oni-forge/u.test(levelId)) return 'oni-forge';
  if (/^krh-|^c8-black-gate$/u.test(levelId)) return 'kurohana-black-castle';
  if (/chapel|undercroft|cell-block|shrine-archive|tax-storehouse|outer-archive/u.test(levelId)) return 'hidden-archive-chapel';
  if (/^sdg-|^epi-sodegaura/u.test(levelId)) return 'sodegaura-relay-road';
  if (/^kgr-/u.test(levelId)) return 'kagura-ash-pass';
  if (/^hsh-|^ngi-|canal-lock|^epi-hoshigawa/u.test(levelId)) return 'hoshigawa-river-ward';
  if (/^tkm-|^c1-flooded|^epi-takamine/u.test(levelId)) return 'takamine-rain-village';
  if (/^kzu-/u.test(levelId)) return 'hidden-archive-chapel';
  return PALETTE_THEME_DEFAULTS[resolvedPalette] ?? 'takamine-rain-village';
}

export function worldTilesetImageHasExpectedSize(image, viewId) {
  const atlas = WORLD_TILESET_ATLASES[viewId];
  return Boolean(atlas && image)
    && Number(image.naturalWidth) === atlas.width
    && Number(image.naturalHeight) === atlas.height;
}
