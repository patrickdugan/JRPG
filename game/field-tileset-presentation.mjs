/**
 * DOM-free presentation resolver for regional top-down field tiles.
 *
 * For one authored level this module deterministically resolves per-cell
 * native (16x16) tile layers from `world-tileset-suite-v1`'s top-down atlas:
 *
 * - walkable cells get the theme floor (`floor-a`, with `floor-b` patches and
 *   sparse `floor-detail` chosen by a stable position hash, never
 *   `Math.random`), `threshold` at authored exits, and `hazard-or-liquid`
 *   under authored liquid/ember terrain tags where the theme's liquid fits;
 * - impassable cells are autotiled as raised masses: `wall` (the visible
 *   front face) when the cell to the south is walkable, otherwise `wall-cap`
 *   (the top surface);
 * - every walkable cell receives `edge-*`, `outer-corner`, and `inner-corner`
 *   border strips toward impassable neighbours, so masses read with an outline
 *   and a contact shadow on the walkable side;
 * - authored terrain tags other than the default `stone` floor still composite
 *   their `field-terrain-atlas.mjs` overlay on top.
 *
 * Art never owns collision, hazards, exits, interactions, saves, telemetry, or
 * evidence. The resolver only reads level data (`blocked`, `terrain`, `exits`,
 * `TERRAIN_TAGS[tag].passable` through `isBlocked`) and never mutates it.
 *
 * Prop-dressing interface (`dressedCells`):
 *   resolveFieldTileLayout(level, { dressedCells: new Set(['4,2', '5,2']) })
 * `dressedCells` is an optional `Set` of `"x,y"` keys naming impassable cells
 * that another layer (e.g. a field prop atlas) will dress with props. Such a
 * cell renders as theme floor plus `prop-base` instead of `wall`/`wall-cap`,
 * and is treated as non-wall when its neighbours' autotiles are computed (the
 * mass north of it shows a face, walkable neighbours get no border strip
 * toward it, and it gets border strips toward remaining walls). Collision is
 * unchanged: the cell stays impassable in level data. Keys that are malformed,
 * out of bounds, or name walkable cells are ignored and listed in
 * `layout.ignoredDressedCells`. Only pass cells the dressing layer will
 * actually draw this frame; otherwise a blocked cell would read as floor.
 */

import { isBlocked } from './content/levels.mjs';
import { FIELD_TERRAIN_ATLAS, getFieldTerrainFrame } from './field-terrain-atlas.mjs';
import {
  WORLD_TILESET_ATLASES,
  WORLD_TILESET_THEME_IDS,
  getWorldTileFrame,
  resolveWorldThemeForLevel,
  worldTilesetImageHasExpectedSize,
} from './world-tileset-atlas.mjs';

export const FIELD_TILE_SIZE = 16;

/**
 * Border strip geometry in native pixels. The builder in
 * `assets/art/world-tileset-suite-v1` paints the edge and corner roles to this
 * exact contract (`topDown.autotileBands` in the suite source).
 */
export const FIELD_TILE_BORDER_BANDS = Object.freeze({
  north: 3,
  south: 1,
  west: 2,
  east: 1,
  innerCorner: 2,
});

/** Which authored terrain tags sit on the theme's `hazard-or-liquid` tile. */
export const FIELD_TILE_THEME_LIQUIDS = Object.freeze({
  'takamine-rain-village': 'water',
  'hoshigawa-river-ward': 'water',
  'sodegaura-relay-road': 'water',
  'kagura-ash-pass': 'ember',
  'kurohana-black-castle': 'corruption',
  'hidden-archive-chapel': 'water',
  'oni-forge': 'ember',
  'black-bell-engine': 'corruption',
});

export const FIELD_TILE_LIQUID_TERRAIN = Object.freeze({
  water: Object.freeze(['water', 'flowing-water', 'storm-water', 'cold-pool']),
  ember: Object.freeze(['furnace-grate']),
  corruption: Object.freeze([]),
});

/** Default untagged floor; its overlay is replaced by the theme floor. */
const DEFAULT_TERRAIN_ID = 'stone';
const FLOOR_B_PATCH_PERCENT = 45;
const FLOOR_B_CELL_PERCENT = 75;
const FLOOR_DETAIL_PERCENT = 7;

function hashString(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Stable 32-bit position hash; identical inputs always give identical output. */
export function fieldTilePositionHash(seed, x, y) {
  let value = (seed + Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function keyOfPosition(position) {
  if (typeof position === 'string') return position;
  if (Array.isArray(position)) return `${position[0]},${position[1]}`;
  if (position && typeof position === 'object') {
    if (typeof position.at === 'string') return position.at;
    return `${position.x},${position.y}`;
  }
  return '';
}

function parseKey(key) {
  if (typeof key !== 'string' || !/^\d+,\d+$/u.test(key)) return null;
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

function normalizeDressedCells(dressedCells) {
  if (dressedCells === undefined || dressedCells === null) return [];
  if (typeof dressedCells === 'string' || typeof dressedCells[Symbol.iterator] !== 'function') {
    throw new TypeError('dressedCells must be a Set of "x,y" keys.');
  }
  return [...dressedCells];
}

function worldLayer(themeId, roleId, sx = 0, sy = 0, sw = FIELD_TILE_SIZE, sh = FIELD_TILE_SIZE, dx = sx, dy = sy) {
  const frame = getWorldTileFrame('topDown', themeId, roleId);
  return Object.freeze({
    atlas: 'world-top-down',
    id: roleId,
    sx: frame.x + sx,
    sy: frame.y + sy,
    sw,
    sh,
    dx,
    dy,
  });
}

function terrainLayer(terrainId) {
  const frame = getFieldTerrainFrame(terrainId);
  if (!frame) return null;
  return Object.freeze({
    atlas: 'field-terrain',
    id: terrainId,
    sx: frame.x,
    sy: frame.y,
    sw: frame.width,
    sh: frame.height,
    dx: 0,
    dy: 0,
  });
}

function borderLayers(themeId, solidAt, x, y) {
  const { north: n, south: s, west: w, east: e, innerCorner: c } = FIELD_TILE_BORDER_BANDS;
  const size = FIELD_TILE_SIZE;
  const north = solidAt(x, y - 1);
  const south = solidAt(x, y + 1);
  const west = solidAt(x - 1, y);
  const east = solidAt(x + 1, y);
  const layers = [];
  if (north) layers.push(worldLayer(themeId, 'edge-north', 0, 0, size, n));
  if (south) layers.push(worldLayer(themeId, 'edge-south', 0, size - s, size, s));
  if (west) layers.push(worldLayer(themeId, 'edge-west', 0, 0, w, size));
  if (east) layers.push(worldLayer(themeId, 'edge-east', size - e, 0, e, size));
  if (north && west) layers.push(worldLayer(themeId, 'outer-corner', 0, 0, w, n));
  if (north && east) layers.push(worldLayer(themeId, 'outer-corner', size - e, 0, e, n));
  if (south && west) layers.push(worldLayer(themeId, 'outer-corner', 0, size - s, w, s));
  if (south && east) layers.push(worldLayer(themeId, 'outer-corner', size - e, size - s, e, s));
  if (!north && !west && solidAt(x - 1, y - 1)) layers.push(worldLayer(themeId, 'inner-corner', 0, 0, c, c));
  if (!north && !east && solidAt(x + 1, y - 1)) layers.push(worldLayer(themeId, 'inner-corner', size - c, 0, c, c));
  if (!south && !west && solidAt(x - 1, y + 1)) layers.push(worldLayer(themeId, 'inner-corner', 0, size - c, c, c));
  if (!south && !east && solidAt(x + 1, y + 1)) layers.push(worldLayer(themeId, 'inner-corner', size - c, size - c, c, c));
  return layers;
}

function floorRole(seed, x, y, quiet) {
  if (quiet) return 'floor-a';
  const cellHash = fieldTilePositionHash(seed, x, y);
  if (cellHash % 100 < FLOOR_DETAIL_PERCENT) return 'floor-detail';
  const patchHash = fieldTilePositionHash(seed ^ 0x5bd1e995, Math.floor(x / 3), Math.floor(y / 2));
  if (patchHash % 100 < FLOOR_B_PATCH_PERCENT && (cellHash >>> 8) % 100 < FLOOR_B_CELL_PERCENT) return 'floor-b';
  return 'floor-a';
}

/**
 * Resolve the per-cell tile layers for one level.
 *
 * @param {object} level authored level (`width`, `height`, `blocked`, `terrain`, `exits`).
 * @param {{ dressedCells?: Set<string>, themeId?: string }} [options]
 *   `dressedCells`: impassable `"x,y"` keys another layer dresses with props.
 *   `themeId`: explicit theme override; an unknown id resolves `themeId: null`.
 * @returns frozen layout `{ levelId, themeId, width, height, tileSize, cells,
 *   dressedCells, ignoredDressedCells }`; `cells` is row-major and each cell is
 *   `{ x, y, key, impassable, dressed, structure, base, terrainTag, layers }`
 *   where every layer is `{ atlas, id, sx, sy, sw, sh, dx, dy }` in native
 *   pixels (`dw = sw`, `dh = sh`).
 */
export function resolveFieldTileLayout(level, options = {}) {
  if (!level || typeof level !== 'object') throw new TypeError('A level object is required.');
  const width = Number(level.width);
  const height = Number(level.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new TypeError(`Level ${level.id ?? '(unnamed)'} has invalid dimensions.`);
  }
  const requestedTheme = options.themeId;
  const themeId = requestedTheme === undefined ? resolveWorldThemeForLevel(level) : requestedTheme;
  const knownTheme = WORLD_TILESET_THEME_IDS.includes(themeId);
  const dressedInput = normalizeDressedCells(options.dressedCells);

  const inBounds = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
  const levelForCollision = {
    ...level,
    blocked: Array.isArray(level.blocked) ? level.blocked : [],
    terrain: Array.isArray(level.terrain) ? level.terrain : [],
  };
  const impassable = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) impassable[y * width + x] = isBlocked(levelForCollision, x, y) ? 1 : 0;
  }

  const dressed = new Set();
  const ignoredDressedCells = [];
  for (const key of dressedInput) {
    const position = parseKey(key);
    if (!position || !inBounds(position.x, position.y) || !impassable[position.y * width + position.x]) {
      ignoredDressedCells.push(String(key));
    } else {
      dressed.add(`${position.x},${position.y}`);
    }
  }

  const terrainByKey = new Map();
  for (const entry of levelForCollision.terrain) {
    const key = keyOfPosition(entry);
    const tag = entry?.tag ?? entry?.type ?? entry?.terrain;
    if (key && typeof tag === 'string' && !terrainByKey.has(key)) terrainByKey.set(key, tag);
  }
  const exits = new Set((Array.isArray(level.exits) ? level.exits : []).map(keyOfPosition).filter(Boolean));
  const spawnKey = level.spawn ? keyOfPosition(level.spawn) : '';

  /** A wall for autotiling: impassable and not dressed. Out of bounds is not a wall for borders. */
  const wallAt = (x, y) => inBounds(x, y) && impassable[y * width + x] === 1 && !dressed.has(`${x},${y}`);
  /** Structure faces only open toward an in-bounds non-wall cell; masses continue past the map edge. */
  const faceOpensSouth = (x, y) => inBounds(x, y + 1) && !wallAt(x, y + 1);

  const liquidKind = knownTheme ? FIELD_TILE_THEME_LIQUIDS[themeId] : null;
  const liquidTags = new Set(liquidKind ? FIELD_TILE_LIQUID_TERRAIN[liquidKind] : []);
  const seed = hashString(`${level.id ?? ''}:${themeId ?? ''}`);
  const cells = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x},${y}`;
      const isImpassable = impassable[y * width + x] === 1;
      const isDressed = dressed.has(key);
      const terrainTag = terrainByKey.get(key) ?? DEFAULT_TERRAIN_ID;
      let structure = null;
      let base;
      const layers = [];
      if (knownTheme) {
        if (isImpassable && !isDressed) {
          structure = faceOpensSouth(x, y) ? 'face' : 'top';
          base = structure === 'face' ? 'wall' : 'wall-cap';
          layers.push(worldLayer(themeId, base));
        } else {
          if (isDressed) base = 'prop-base';
          else if (exits.has(key)) base = 'threshold';
          else if (liquidTags.has(terrainTag)) base = 'hazard-or-liquid';
          else base = floorRole(seed, x, y, terrainTag !== DEFAULT_TERRAIN_ID || key === spawnKey);
          layers.push(worldLayer(themeId, base));
          layers.push(...borderLayers(themeId, wallAt, x, y));
        }
        if (terrainTag !== DEFAULT_TERRAIN_ID) {
          const overlay = terrainLayer(terrainTag);
          if (overlay) layers.push(overlay);
        }
      }
      cells.push(Object.freeze({
        x,
        y,
        key,
        impassable: isImpassable,
        dressed: isDressed,
        structure,
        base: base ?? null,
        terrainTag,
        layers: Object.freeze(layers),
      }));
    }
  }

  return Object.freeze({
    levelId: level.id ?? null,
    themeId: knownTheme ? themeId : null,
    width,
    height,
    tileSize: FIELD_TILE_SIZE,
    cells: Object.freeze(cells),
    dressedCells: Object.freeze([...dressed].sort()),
    ignoredDressedCells: Object.freeze(ignoredDressedCells),
  });
}

/** Exact gate: a known theme, at least one layer, and an exactly sized decoded top-down atlas. */
export function canDrawFieldTileLayout(layout, worldTopDownImage) {
  return Boolean(layout
    && WORLD_TILESET_THEME_IDS.includes(layout.themeId)
    && layout.cells?.length === layout.width * layout.height
    && worldTilesetImageHasExpectedSize(worldTopDownImage, 'topDown'));
}

function terrainImageReady(image) {
  return Boolean(image
    && Number(image.naturalWidth) === FIELD_TERRAIN_ATLAS.width
    && Number(image.naturalHeight) === FIELD_TERRAIN_ATLAS.height);
}

/**
 * Paint a resolved layout into a 2D context at native scale (one tile = 16
 * pixels), starting at `(originX, originY)`. Terrain overlays are skipped when
 * the terrain atlas is missing or wrongly sized. Returns the number of
 * `drawImage` calls, or 0 when the world atlas gate fails (nothing is drawn).
 */
export function drawFieldTileLayout(context, layout, images = {}, { originX = 0, originY = 0 } = {}) {
  const world = images.worldTopDown;
  if (!context || !canDrawFieldTileLayout(layout, world)) return 0;
  const terrain = terrainImageReady(images.fieldTerrain) ? images.fieldTerrain : null;
  let draws = 0;
  for (const cell of layout.cells) {
    const cellX = originX + cell.x * layout.tileSize;
    const cellY = originY + cell.y * layout.tileSize;
    for (const layer of cell.layers) {
      const image = layer.atlas === 'world-top-down' ? world : terrain;
      if (!image) continue;
      context.drawImage(image, layer.sx, layer.sy, layer.sw, layer.sh, cellX + layer.dx, cellY + layer.dy, layer.sw, layer.sh);
      draws += 1;
    }
  }
  return draws;
}

/** Native pixel size of a layout's composed base layer. */
export function fieldTileLayoutPixelSize(layout) {
  return { width: layout.width * layout.tileSize, height: layout.height * layout.tileSize };
}

export const FIELD_TILESET_PRESENTATION_ATLAS = WORLD_TILESET_ATLASES.topDown;
