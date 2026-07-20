/** DOM-free frame addressing for the provisional six-by-eight party atlas. */

const PARTY_SOURCE_INSET = 4;
const PARTY_CELL_WIDTH = 192;
const PARTY_CELL_HEIGHT = 172;
const PARTY_SOURCE_WIDTH = PARTY_CELL_WIDTH - PARTY_SOURCE_INSET * 2;
const PARTY_SOURCE_HEIGHT = PARTY_CELL_HEIGHT - PARTY_SOURCE_INSET * 2;

/*
 * The generated bitmap is 1024px high, which cannot be divided into six
 * integer rows. These measured, integer-authored cells follow the transparent
 * gaps between character families instead of allowing drawImage to resample a
 * fractional boundary. Some cells overlap only in known-transparent margin;
 * their inset source rectangles contain at most one authored character row.
 */
const PARTY_ROW_CELLS = Object.freeze([
  Object.freeze({ y: 12, height: PARTY_CELL_HEIGHT }),
  Object.freeze({ y: 174, height: PARTY_CELL_HEIGHT }),
  Object.freeze({ y: 334, height: PARTY_CELL_HEIGHT }),
  Object.freeze({ y: 494, height: PARTY_CELL_HEIGHT }),
  Object.freeze({ y: 655, height: PARTY_CELL_HEIGHT }),
  Object.freeze({ y: 821, height: PARTY_CELL_HEIGHT }),
]);

export const PARTY_ATLAS = Object.freeze({
  url: 'assets/production/bells-party-field-atlas-v1.png',
  width: 1536,
  height: 1024,
  columns: 8,
  rows: 6,
  cellWidth: PARTY_CELL_WIDTH,
  cellHeight: PARTY_CELL_HEIGHT,
  sourceInset: PARTY_SOURCE_INSET,
  sourceWidth: PARTY_SOURCE_WIDTH,
  sourceHeight: PARTY_SOURCE_HEIGHT,
  rowCells: PARTY_ROW_CELLS,
});

export const PARTY_ATLAS_MEMBERS = Object.freeze([
  'ren',
  'aya',
  'lise',
  'mateus',
  'genta',
  'kiku',
]);

export const PARTY_ATLAS_DIRECTIONS = Object.freeze(['north', 'east', 'south', 'west']);

const DIRECTION_COLUMN = Object.freeze({ north: 0, east: 2, south: 4, west: 6 });

/** Resolve one stable source rectangle. Walking phase alternates idle/walk cells. */
export function getPartyAtlasFrame(memberId, direction = 'south', walkingPhase = 0) {
  const row = PARTY_ATLAS_MEMBERS.indexOf(memberId);
  if (row < 0) throw new RangeError(`Unknown party atlas member: ${memberId}`);
  if (!PARTY_ATLAS_DIRECTIONS.includes(direction)) throw new RangeError(`Unknown party atlas direction: ${direction}`);
  if (!Number.isSafeInteger(walkingPhase) || walkingPhase < 0) {
    throw new RangeError('Walking phase must be a non-negative safe integer.');
  }
  const column = DIRECTION_COLUMN[direction] + (walkingPhase % 2);
  const cellX = column * PARTY_ATLAS.cellWidth;
  const cell = PARTY_ATLAS.rowCells[row];
  return Object.freeze({
    memberId,
    direction,
    walkingPhase: walkingPhase % 2,
    row,
    column,
    cellX,
    cellY: cell.y,
    cellWidth: PARTY_ATLAS.cellWidth,
    cellHeight: cell.height,
    sourceInset: PARTY_ATLAS.sourceInset,
    x: cellX + PARTY_ATLAS.sourceInset,
    y: cell.y + PARTY_ATLAS.sourceInset,
    width: PARTY_ATLAS.sourceWidth,
    height: PARTY_ATLAS.sourceHeight,
  });
}

/** Reduce an exact eight-way movement vector to the atlas' four authored facings. */
export function atlasDirectionForMovement(dx, dy, fallback = 'south') {
  if (!PARTY_ATLAS_DIRECTIONS.includes(fallback)) throw new RangeError(`Unknown fallback atlas direction: ${fallback}`);
  if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    throw new RangeError('Atlas movement must be an exact -1, 0, or 1 vector.');
  }
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  if (dy !== 0) return dy > 0 ? 'south' : 'north';
  return dx > 0 ? 'east' : 'west';
}
