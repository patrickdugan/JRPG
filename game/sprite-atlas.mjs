/** DOM-free frame addressing for the provisional six-by-eight party atlas. */

export const PARTY_ATLAS = Object.freeze({
  url: 'assets/production/bells-party-field-atlas-v1.png',
  width: 1536,
  height: 1024,
  columns: 8,
  rows: 6,
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
  const width = PARTY_ATLAS.width / PARTY_ATLAS.columns;
  const height = PARTY_ATLAS.height / PARTY_ATLAS.rows;
  return Object.freeze({
    memberId,
    direction,
    walkingPhase: walkingPhase % 2,
    row,
    column,
    x: column * width,
    y: row * height,
    width,
    height,
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
