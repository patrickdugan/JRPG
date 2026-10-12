/**
 * Pure, deterministic dressing of authored impassable field cells with
 * top-down buildings, walls, trees, and props from field-prop-suite-v1.
 *
 * The resolver never changes collision: it only reads `blocked` and
 * impassable terrain, and it never covers walkable cells, exits, spawn points,
 * hazard tiles, or interactable positions. Variety comes from a stable FNV-1a
 * position hash, never Math.random.
 *
 * drawMap() integration (after floor and terrain, before characters):
 *
 *   const propDressing = resolveFieldPropDressing(level);            // pure; cache per level id if desired
 *   const propsReady = fieldPropAtlasState === 'ready';              // Image of FIELD_PROP_ATLAS.url decoded
 *   const dressedCells = propsReady ? propDressing.dressedCells : new Set();
 *   // ...pass { dressedCells } to the floor/wall tileset resolver so dressed cells render as floor...
 *   if (propsReady) drawFieldPropDressing(mapCtx, fieldPropAtlasImage, propDressing, originX, originY, cell);
 */

import { TERRAIN_TAGS } from './content/levels.mjs';
import { WORLD_TILESET_THEME_IDS, resolveWorldThemeForLevel } from './world-tileset-atlas.mjs';
import {
  FIELD_PROP_FAMILY_PROPS,
  FIELD_PROP_FAMILY_WIDE_PROPS,
  FIELD_PROP_THEME_FAMILIES,
  fieldPropImageHasExpectedSize,
  getFieldPropFrame,
} from './field-prop-atlas.mjs';

/**
 * Per-family composition rules.
 * - splitLongRuns: break long 1- or 2-tall runs into several buildings.
 * - verticalPairs: a 1 x 2 vertical run becomes a tall prop or a wall.
 * - talls: tall props used for vertical pairs and as gaps between buildings.
 */
export const FIELD_PROP_FAMILY_RULES = Object.freeze({
  village: Object.freeze({ splitLongRuns: true, verticalPairs: 'tall', talls: Object.freeze(['cedar', 'pine', 'fire-bell-tower']) }),
  river: Object.freeze({ splitLongRuns: true, verticalPairs: 'tall', talls: Object.freeze(['cedar', 'watch-post', 'pine']) }),
  relay: Object.freeze({ splitLongRuns: true, verticalPairs: 'tall', talls: Object.freeze(['pine', 'watch-post', 'cedar']) }),
  ash: Object.freeze({ splitLongRuns: true, verticalPairs: 'tall', talls: Object.freeze(['dead-pine', 'watch-post']) }),
  castle: Object.freeze({ splitLongRuns: false, verticalPairs: 'wall', talls: Object.freeze(['lacquer-lantern', 'pine']) }),
  archive: Object.freeze({ splitLongRuns: true, verticalPairs: 'wall', talls: Object.freeze(['cedar']) }),
  forge: Object.freeze({ splitLongRuns: false, verticalPairs: 'tall', talls: Object.freeze(['chimney']) }),
  engine: Object.freeze({ splitLongRuns: false, verticalPairs: 'tall', talls: Object.freeze(['pipe-stack']) }),
});

const EMPTY = Object.freeze({ themeId: null, familyId: null, placements: Object.freeze([]) });

/** Stable 32-bit FNV-1a with a final avalanche; deterministic across platforms. */
export function fieldPropHash(text) {
  let hash = 0x811c9dc5;
  const value = String(text);
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function parseCell(key, width, height) {
  const parts = String(key ?? '').split(',');
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) return null;
  return `${x},${y}`;
}

function collectImpassable(level, width, height) {
  const cells = new Set();
  for (const key of level.blocked ?? []) {
    const cell = parseCell(key, width, height);
    if (cell) cells.add(cell);
  }
  for (const tile of level.terrain ?? []) {
    if (TERRAIN_TAGS[tile?.tag]?.passable !== false) continue;
    const cell = parseCell(tile.at, width, height);
    if (cell) cells.add(cell);
  }
  return cells;
}

/** Cells the dressing must never cover even when they are impassable. */
function collectForbidden(level, width, height) {
  const cells = new Set();
  const add = (key) => {
    const cell = parseCell(key, width, height);
    if (cell) cells.add(cell);
  };
  for (const exit of level.exits ?? []) add(exit?.at);
  for (const interactable of level.interactables ?? []) add(interactable?.at);
  for (const hazard of level.hazards ?? []) (hazard?.tiles ?? []).forEach(add);
  const spawns = Array.isArray(level.spawn) ? level.spawn : level.spawn ? [level.spawn] : [];
  for (const spawn of spawns) {
    if (spawn && Number.isInteger(spawn.x) && Number.isInteger(spawn.y)) add(`${spawn.x},${spawn.y}`);
  }
  return cells;
}

/**
 * Blocked cells that also carry an authored passable terrain tag (for example
 * a map table drawn with archive-floor) keep their authored surface read.
 */
function collectAuthoredSurfaces(level, width, height) {
  const blocked = new Set((level.blocked ?? []).map((key) => parseCell(key, width, height)).filter(Boolean));
  const cells = new Set();
  for (const tile of level.terrain ?? []) {
    const cell = parseCell(tile?.at, width, height);
    if (cell && blocked.has(cell) && TERRAIN_TAGS[tile.tag]?.passable !== false) cells.add(cell);
  }
  return cells;
}

function resolveTheme(level, themeId) {
  if (WORLD_TILESET_THEME_IDS.includes(themeId)) return themeId;
  return resolveWorldThemeForLevel(level);
}

/**
 * Resolve decorative placements for one level.
 * @returns {{ themeId: string|null, familyId: string|null,
 *   placements: Array<{ frameId: string, x: number, y: number, widthCells: number, heightCells: number, cells: string[] }>,
 *   dressedCells: Set<string> }}
 */
export function resolveFieldPropDressing(level, { themeId } = {}) {
  const width = level?.width;
  const height = level?.height;
  if (!level || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return { ...EMPTY, dressedCells: new Set() };
  }
  const resolvedTheme = resolveTheme(level, themeId);
  const familyId = FIELD_PROP_THEME_FAMILIES[resolvedTheme] ?? 'village';
  const rules = FIELD_PROP_FAMILY_RULES[familyId];
  const levelKey = String(level.id ?? '');
  const forbidden = collectForbidden(level, width, height);
  const surfaces = collectAuthoredSurfaces(level, width, height);
  const free = new Set([...collectImpassable(level, width, height)]
    .filter((cell) => !forbidden.has(cell) && !surfaces.has(cell)));
  const placements = [];
  const singleProps = new Map();
  const cellFrames = new Map();

  const isFree = (x, y) => free.has(`${x},${y}`);
  const seed = (x, y, salt) => fieldPropHash(`${levelKey}|${x},${y}|${salt}`);
  const place = (frameName, x, y, widthCells, heightCells) => {
    const frameId = frameName.includes(':') ? frameName : `${familyId}:${frameName}`;
    const frame = getFieldPropFrame(frameId);
    if (!frame || frame.widthCells !== widthCells || frame.heightCells !== heightCells) {
      throw new Error(`Field prop frame mismatch: ${frameId}`);
    }
    const cells = [];
    for (let dy = 0; dy < heightCells; dy += 1) {
      for (let dx = 0; dx < widthCells; dx += 1) {
        const key = `${x + dx},${y + dy}`;
        if (!free.has(key)) throw new Error(`Field prop dressing would cover a non-dressable cell: ${key}`);
        cells.push(key);
      }
    }
    cells.forEach((key) => {
      free.delete(key);
      cellFrames.set(key, frame);
    });
    placements.push({ frameId, x, y, widthCells, heightCells, cells });
  };

  const placeSingle = (x, y) => {
    const props = FIELD_PROP_FAMILY_PROPS[familyId];
    let index = seed(x, y, 'single') % props.length;
    for (let attempt = 0; attempt < props.length; attempt += 1) {
      const name = props[index];
      if (singleProps.get(`${x - 1},${y}`) !== name && singleProps.get(`${x},${y - 1}`) !== name) break;
      index = (index + 1) % props.length;
    }
    singleProps.set(`${x},${y}`, props[index]);
    place(props[index], x, y, 1, 1);
  };

  const placeTall = (x, y) => {
    place(`tall:${rules.talls[seed(x, y, 'tall') % rules.talls.length]}`, x, y, 1, 2);
  };

  const placeBuilding1 = (x0, y, w) => {
    if (w === 1) {
      placeSingle(x0, y);
      return;
    }
    const door = w >= 4 || (w === 3 && seed(x0, y, 'door') % 2 === 0)
      ? 1 + (seed(x0, y, 'door-at') % (w - 2))
      : -1;
    let previous = 'a';
    for (let index = 0; index < w; index += 1) {
      let piece;
      if (index === 0) piece = 'left';
      else if (index === w - 1) piece = 'right';
      else if (index === door) piece = 'mid-c';
      else {
        const roll = seed(x0 + index, y, 'mid') % 5;
        piece = roll >= 3 && previous === 'a' && index + 1 !== door ? 'mid-b' : 'mid-a';
      }
      previous = piece === 'mid-a' ? 'a' : 'b';
      place(`strip1-${piece}`, x0 + index, y, 1, 1);
    }
  };

  const placeBuilding2 = (x0, y, w) => {
    if (w === 1) {
      if (rules.verticalPairs === 'tall') placeTall(x0, y);
      else {
        place('wall-top', x0, y, 1, 1);
        place('wall-bottom', x0, y + 1, 1, 1);
      }
      return;
    }
    if (w === 2) {
      place('block-2x2', x0, y, 2, 2);
      return;
    }
    if (w === 3) {
      place('block-3x2', x0, y, 3, 2);
      return;
    }
    const door = 1 + (seed(x0, y, 'door2') % (w - 2));
    for (let index = 0; index < w; index += 1) {
      const piece = index === 0 ? 'left' : index === w - 1 ? 'right' : index === door ? 'mid-b' : 'mid-a';
      place(`strip2-${piece}`, x0 + index, y, 1, 2);
    }
  };

  const nextSeed = (value) => fieldPropHash(`next|${value}`);

  const placeRun1 = (x0, y, w) => {
    let s = seed(x0, y, 'run1');
    if (w === 2) {
      const roll = s % 20;
      if (roll < 9) placeBuilding1(x0, y, 2);
      else if (roll < 16) {
        const wides = FIELD_PROP_FAMILY_WIDE_PROPS[familyId];
        place(wides[nextSeed(s) % wides.length], x0, y, 2, 1);
      } else {
        placeSingle(x0, y);
        placeSingle(x0 + 1, y);
      }
      return;
    }
    if (rules.splitLongRuns && (w === 3 || w === 4) && s % 20 >= 12) {
      // A shorter house (or, on three cells, work goods) with one prop beside it breaks repeated rows.
      const propFirst = nextSeed(s) % 2 === 0;
      const xRest = propFirst ? x0 + 1 : x0;
      if (w === 3 && s % 20 >= 17) {
        const wides = FIELD_PROP_FAMILY_WIDE_PROPS[familyId];
        place(wides[nextSeed(s + 1) % wides.length], xRest, y, 2, 1);
      } else {
        placeBuilding1(xRest, y, w - 1);
      }
      placeSingle(propFirst ? x0 : x0 + w - 1, y);
      return;
    }
    if (rules.splitLongRuns && (w === 5 || w === 6) && s % 10 < 4 + (w - 5)) {
      const first = w === 5 ? 2 + (s % 2) : [3, 2, 4, 3, 3][s % 5];
      placeBuilding1(x0, y, first);
      placeBuilding1(x0 + first, y, w - first);
      return;
    }
    if (!rules.splitLongRuns || w <= 6) {
      placeBuilding1(x0, y, w);
      return;
    }
    let x = x0;
    let remaining = w;
    while (remaining > 0) {
      if (remaining <= 6) {
        placeBuilding1(x, y, remaining);
        return;
      }
      let length = 3 + (s % 4);
      if (remaining - length === 1) length -= 1;
      placeBuilding1(x, y, length);
      x += length;
      remaining -= length;
      s = nextSeed(s);
      if (remaining >= 3 && s % 3 === 0) {
        placeSingle(x, y);
        x += 1;
        remaining -= 1;
      }
      s = nextSeed(s);
    }
  };

  const placeRun2 = (x0, y, w) => {
    let s = seed(x0, y, 'run2');
    const small = (x, length) => {
      if (length === 4 && s % 4 === 0) {
        placeBuilding2(x, y, 2);
        placeBuilding2(x + 2, y, 2);
      } else if (length === 5 && s % 5 < 2) {
        const first = s % 2 === 0 ? 3 : 2;
        placeBuilding2(x, y, first);
        placeBuilding2(x + first, y, 5 - first);
      } else {
        placeBuilding2(x, y, length);
      }
    };
    if (!rules.splitLongRuns || w <= 5) {
      if (w <= 5) small(x0, w);
      else placeBuilding2(x0, y, w);
      return;
    }
    let x = x0;
    let remaining = w;
    while (remaining > 0) {
      if (remaining <= 5) {
        small(x, remaining);
        return;
      }
      let length = 2 + (s % 4);
      if (remaining - length === 1) length += length < 5 ? 1 : -1;
      placeBuilding2(x, y, length);
      x += length;
      remaining -= length;
      s = nextSeed(s);
      if (remaining >= 3 && s % 3 === 0) {
        placeBuilding2(x, y, 1);
        x += 1;
        remaining -= 1;
      }
      s = nextSeed(s);
    }
  };

  // Pass 1: a long top border row that is clearly wider than the mass beneath it.
  for (let x = 0; x < width; x += 1) {
    if (!isFree(x, 0)) continue;
    let w = 0;
    while (isFree(x + w, 0)) w += 1;
    let beneath = 0;
    for (let bx = 0; bx < width; bx += 1) {
      if (!isFree(bx, 1)) continue;
      let run = 0;
      while (isFree(bx + run, 1)) run += 1;
      if (bx <= x + w - 1 && bx + run - 1 >= x) beneath = Math.max(beneath, run);
      bx += run;
    }
    if (w >= beneath + 3) placeRun1(x, 0, w);
    x += w;
  }

  // Pass 2: full 3 x 3 masses become landmark blocks.
  for (let y = 0; y + 2 < height; y += 1) {
    for (let x = 0; x + 2 < width; x += 1) {
      let fits = true;
      for (let dy = 0; dy < 3 && fits; dy += 1) {
        for (let dx = 0; dx < 3 && fits; dx += 1) fits = isFree(x + dx, y + dy);
      }
      if (fits) place('block-3x3', x, y, 3, 3);
    }
  }

  // Pass 3: aligned two-tall runs become 2 x 2 / 3 x 2 blocks or tall strips.
  for (let y = 0; y + 1 < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isFree(x, y) || !isFree(x, y + 1)) continue;
      let w = 0;
      while (isFree(x + w, y) && isFree(x + w, y + 1)) w += 1;
      if (w >= 2) placeRun2(x, y, w);
      x += w - 1;
    }
  }

  // Pass 4: one-tall horizontal runs become row houses, walls, or wide props.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x + 1 < width; x += 1) {
      if (!isFree(x, y) || !isFree(x + 1, y)) continue;
      let w = 0;
      while (isFree(x + w, y)) w += 1;
      placeRun1(x, y, w);
      x += w - 1;
    }
  }

  // Pass 5: one-wide vertical runs become tall props or north-south walls.
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y + 1 < height; y += 1) {
      if (!isFree(x, y) || !isFree(x, y + 1)) continue;
      let length = 0;
      while (isFree(x, y + length)) length += 1;
      if (length === 2 && rules.verticalPairs === 'tall') placeTall(x, y);
      else {
        place('wall-top', x, y, 1, 1);
        for (let index = 1; index < length - 1; index += 1) place('wall-mid', x, y + index, 1, 1);
        place('wall-bottom', x, y + length - 1, 1, 1);
      }
      y += length - 1;
    }
  }

  // Pass 6: remaining isolated cells become single props; in walled families a
  // cell hanging directly off a building or wall becomes a short wall stub.
  const isStructure = (key) => cellFrames.get(key)?.kind === 'structure';
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isFree(x, y)) continue;
      if (rules.verticalPairs === 'wall' && isStructure(`${x},${y - 1}`)) place('wall-bottom', x, y, 1, 1);
      else if (rules.verticalPairs === 'wall' && isStructure(`${x},${y + 1}`)) place('wall-top', x, y, 1, 1);
      else placeSingle(x, y);
    }
  }

  placements.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  for (const placement of placements) Object.freeze(placement.cells);
  return {
    themeId: resolvedTheme,
    familyId,
    placements: placements.map((placement) => Object.freeze(placement)),
    dressedCells: new Set(placements.flatMap((placement) => placement.cells)),
  };
}

/** Coverage summary: how many authored impassable cells received dressing. */
export function fieldPropDressingCoverage(level, dressing = resolveFieldPropDressing(level)) {
  const width = level?.width;
  const height = level?.height;
  if (!Number.isInteger(width) || !Number.isInteger(height)) return { impassableCells: 0, dressedCells: 0, coverage: 0 };
  const impassable = collectImpassable(level, width, height);
  const dressed = [...dressing.dressedCells].filter((cell) => impassable.has(cell)).length;
  return {
    impassableCells: impassable.size,
    dressedCells: dressed,
    coverage: impassable.size ? dressed / impassable.size : 1,
  };
}

/**
 * Draw resolved placements with nearest-neighbour scaling. Fails closed (draws
 * nothing, returns 0) when the atlas image is missing or the wrong size.
 */
export function drawFieldPropDressing(ctx, image, dressing, originX, originY, cell) {
  if (!ctx || !fieldPropImageHasExpectedSize(image) || !dressing?.placements?.length || !(cell > 0)) return 0;
  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  let drawn = 0;
  for (const placement of dressing.placements) {
    const frame = getFieldPropFrame(placement.frameId);
    if (!frame) continue;
    ctx.drawImage(
      image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      originX + placement.x * cell,
      originY + placement.y * cell,
      placement.widthCells * cell,
      placement.heightCells * cell,
    );
    drawn += 1;
  }
  ctx.imageSmoothingEnabled = previousSmoothing;
  return drawn;
}
