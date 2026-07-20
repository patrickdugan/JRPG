/** DOM-free frame addressing for the authored six-by-ten party field atlas. */

const PARTY_SOURCE_INSET = 0;
const PARTY_CELL_WIDTH = 32;
const PARTY_CELL_HEIGHT = 48;
const PARTY_SOURCE_WIDTH = PARTY_CELL_WIDTH - PARTY_SOURCE_INSET * 2;
const PARTY_SOURCE_HEIGHT = PARTY_CELL_HEIGHT - PARTY_SOURCE_INSET * 2;

const PARTY_ROW_CELLS = Object.freeze([
  Object.freeze({ y: 0, height: PARTY_CELL_HEIGHT }),
  Object.freeze({ y: 48, height: PARTY_CELL_HEIGHT }),
  Object.freeze({ y: 96, height: PARTY_CELL_HEIGHT }),
  Object.freeze({ y: 144, height: PARTY_CELL_HEIGHT }),
  Object.freeze({ y: 192, height: PARTY_CELL_HEIGHT }),
  Object.freeze({ y: 240, height: PARTY_CELL_HEIGHT }),
]);

export const PARTY_ATLAS = Object.freeze({
  url: './assets/art/party-field-suite/party-field-foundation.png',
  width: 320,
  height: 288,
  columns: 10,
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
export const PARTY_ATLAS_FIELD_POSES = Object.freeze(['interact', 'hurt']);

const DIRECTION_COLUMN = Object.freeze({ north: 0, east: 2, south: 4, west: 6 });
const FIELD_POSE_COLUMN = Object.freeze({ interact: 8, hurt: 9 });

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

/** Resolve one appended front-facing event key without altering movement addressing. */
export function getPartyAtlasFieldPoseFrame(memberId, pose) {
  const row = PARTY_ATLAS_MEMBERS.indexOf(memberId);
  if (row < 0) throw new RangeError(`Unknown party atlas member: ${memberId}`);
  if (!PARTY_ATLAS_FIELD_POSES.includes(pose)) throw new RangeError(`Unknown party atlas field pose: ${pose}`);
  const column = FIELD_POSE_COLUMN[pose];
  const cellX = column * PARTY_ATLAS.cellWidth;
  const cell = PARTY_ATLAS.rowCells[row];
  return Object.freeze({
    memberId,
    direction: 'south',
    pose,
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

export function partyAtlasImageHasExpectedSize(image) {
  return Boolean(image)
    && image.naturalWidth === PARTY_ATLAS.width
    && image.naturalHeight === PARTY_ATLAS.height;
}
