function positiveInteger(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Derive one integer-aligned board transform for both rendering and input.
 *
 * Authored battle boards declare their source-space cell size through
 * `spacePx`. When at least one whole-number source scale fits, preserve that
 * grid instead of stretching cells to an arbitrary size. Oversized or legacy
 * boards fall back to the former largest-cell-that-fits behavior.
 */
export function getBattleStageGeometry({
  canvasWidth,
  canvasHeight,
  levelWidth,
  levelHeight,
  spacePx,
} = {}) {
  const width = positiveInteger(canvasWidth);
  const height = positiveInteger(canvasHeight);
  const columns = positiveInteger(levelWidth);
  const rows = positiveInteger(levelHeight);
  const sourceCell = positiveInteger(spacePx);

  if (!width || !height || !columns || !rows) {
    throw new RangeError('Battle geometry requires positive canvas and level dimensions.');
  }

  const largestCellThatFits = Math.floor(Math.min(width / columns, height / rows));
  if (largestCellThatFits < 1) {
    throw new RangeError('Battle board cannot fit inside the canvas.');
  }

  const sourceScale = sourceCell > 0 ? Math.floor(largestCellThatFits / sourceCell) : 0;
  const cell = sourceScale >= 1 ? sourceCell * sourceScale : largestCellThatFits;
  const boardWidth = columns * cell;
  const boardHeight = rows * cell;

  return {
    cell,
    originX: Math.floor((width - boardWidth) / 2),
    originY: Math.floor((height - boardHeight) / 2),
    boardWidth,
    boardHeight,
    columns,
    rows,
    sourceCell: sourceCell || null,
    sourceScale: sourceScale || null,
  };
}

export function tileCenter(tile, geometry) {
  return {
    x: geometry.originX + tile.x * geometry.cell + geometry.cell / 2,
    y: geometry.originY + tile.y * geometry.cell + geometry.cell / 2,
  };
}

export function canvasPointToTile(point, geometry) {
  const localX = point.x - geometry.originX;
  const localY = point.y - geometry.originY;
  if (
    !Number.isFinite(localX)
    || !Number.isFinite(localY)
    || localX < 0
    || localY < 0
    || localX >= geometry.boardWidth
    || localY >= geometry.boardHeight
  ) return null;

  return {
    x: Math.floor(localX / geometry.cell),
    y: Math.floor(localY / geometry.cell),
  };
}

// Descriptive aliases keep call sites readable without creating a second
// geometry implementation.
export const deriveBattleStageGeometry = getBattleStageGeometry;
export const battleTileCenter = tileCenter;
export const battleCanvasPointToTile = canvasPointToTile;
