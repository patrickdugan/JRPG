/** DOM-free frame addressing for the authored seven-by-twenty-two party field atlas. */

const PARTY_SOURCE_INSET = 0;
const PARTY_CELL_WIDTH = 40;
const PARTY_CELL_HEIGHT = 56;
const PARTY_SOURCE_WIDTH = PARTY_CELL_WIDTH - PARTY_SOURCE_INSET * 2;
const PARTY_SOURCE_HEIGHT = PARTY_CELL_HEIGHT - PARTY_SOURCE_INSET * 2;

const PARTY_ROW_CELLS = Object.freeze(
  Array.from({ length: 7 }, (_, row) => Object.freeze({
    y: row * PARTY_CELL_HEIGHT,
    height: PARTY_CELL_HEIGHT,
  })),
);

export const PARTY_ATLAS = Object.freeze({
  url: './assets/art/party-field-suite-v2/party-field-atlas-v2.png',
  width: 880,
  height: 392,
  columns: 22,
  rows: 7,
  cellWidth: PARTY_CELL_WIDTH,
  cellHeight: PARTY_CELL_HEIGHT,
  sourceInset: PARTY_SOURCE_INSET,
  sourceWidth: PARTY_SOURCE_WIDTH,
  sourceHeight: PARTY_SOURCE_HEIGHT,
  pivotX: 20,
  pivotY: 52,
  footPointX: 20,
  footPointY: 52,
  walkFrameDurationMs: 80,
  walkFrameCount: 4,
  rowCells: PARTY_ROW_CELLS,
});

export const PARTY_ATLAS_MEMBERS = Object.freeze([
  'ren',
  'aya',
  'lise',
  'mateus',
  'genta',
  'kiku',
  'miyo',
]);

export const PARTY_ATLAS_DIRECTIONS = Object.freeze(['north', 'east', 'south', 'west']);
export const PARTY_ATLAS_FIELD_POSES = Object.freeze(['interact', 'hurt']);

const DIRECTION_COLUMN = Object.freeze({ north: 0, east: 5, south: 10, west: 15 });
const WALK_COLUMN = Object.freeze({
  north: Object.freeze([1, 2, 3, 4]),
  east: Object.freeze([6, 7, 8, 9]),
  south: Object.freeze([11, 12, 13, 14]),
  west: Object.freeze([16, 17, 18, 19]),
});
const WALK_PHASE = Object.freeze(['contact', 'compression', 'passing', 'extension']);
const FIELD_POSE_COLUMN = Object.freeze({ interact: 20, hurt: 21 });

/** Resolve a directional idle or the first authored walk contact for compatibility. */
export function getPartyAtlasFrame(memberId, direction = 'south', walkingPhase = 0) {
  const row = PARTY_ATLAS_MEMBERS.indexOf(memberId);
  if (row < 0) throw new RangeError(`Unknown party atlas member: ${memberId}`);
  if (!PARTY_ATLAS_DIRECTIONS.includes(direction)) throw new RangeError(`Unknown party atlas direction: ${direction}`);
  if (!Number.isSafeInteger(walkingPhase) || walkingPhase < 0) {
    throw new RangeError('Walking phase must be a non-negative safe integer.');
  }
  const resolvedPhase = walkingPhase % 2;
  const column = resolvedPhase === 0 ? DIRECTION_COLUMN[direction] : WALK_COLUMN[direction][0];
  const cellX = column * PARTY_ATLAS.cellWidth;
  const cell = PARTY_ATLAS.rowCells[row];
  return Object.freeze({
    memberId,
    direction,
    walkingPhase: resolvedPhase,
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

/** Resolve the four authored walk phases without using the standing idle cell. */
export function getPartyAtlasWalkFrame(memberId, direction = 'south', walkingPhase = 0) {
  const row = PARTY_ATLAS_MEMBERS.indexOf(memberId);
  if (row < 0) throw new RangeError(`Unknown party atlas member: ${memberId}`);
  if (!PARTY_ATLAS_DIRECTIONS.includes(direction)) throw new RangeError(`Unknown party atlas direction: ${direction}`);
  if (!Number.isSafeInteger(walkingPhase) || walkingPhase < 0) {
    throw new RangeError('Walking phase must be a non-negative safe integer.');
  }
  const resolvedPhase = walkingPhase % PARTY_ATLAS.walkFrameCount;
  const column = WALK_COLUMN[direction][resolvedPhase];
  const cellX = column * PARTY_ATLAS.cellWidth;
  const cell = PARTY_ATLAS.rowCells[row];
  return Object.freeze({
    memberId,
    direction,
    walkingPhase: resolvedPhase,
    walkPhase: WALK_PHASE[resolvedPhase],
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
