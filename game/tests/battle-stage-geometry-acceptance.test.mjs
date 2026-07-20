import test from 'node:test';
import assert from 'node:assert/strict';

import {
  battleCanvasPointToTile,
  battleTileCenter,
  canvasPointToTile,
  deriveBattleStageGeometry,
  getBattleStageGeometry,
  tileCenter,
} from '../battle-stage-geometry.mjs';

const TAKAMINE_GEOMETRY_INPUT = Object.freeze({
  canvasWidth: 960,
  canvasHeight: 540,
  levelWidth: 12,
  levelHeight: 7,
  spacePx: 32,
});

test('Takamine uses one exact 2x source-grid transform in the 960x540 battle canvas', () => {
  const geometry = getBattleStageGeometry(TAKAMINE_GEOMETRY_INPUT);

  assert.deepEqual(geometry, {
    cell: 64,
    originX: 96,
    originY: 46,
    boardWidth: 768,
    boardHeight: 448,
    columns: 12,
    rows: 7,
    sourceCell: 32,
    sourceScale: 2,
  });
  assert.equal(geometry.boardWidth, TAKAMINE_GEOMETRY_INPUT.levelWidth * geometry.cell);
  assert.equal(geometry.boardHeight, TAKAMINE_GEOMETRY_INPUT.levelHeight * geometry.cell);
  assert.equal(geometry.originX * 2 + geometry.boardWidth, TAKAMINE_GEOMETRY_INPUT.canvasWidth);
  assert.equal(geometry.originY * 2 + geometry.boardHeight, TAKAMINE_GEOMETRY_INPUT.canvasHeight);
});

test('all 84 Takamine tile centers round-trip through the pointer transform', () => {
  const geometry = getBattleStageGeometry(TAKAMINE_GEOMETRY_INPUT);

  for (let y = 0; y < geometry.rows; y += 1) {
    for (let x = 0; x < geometry.columns; x += 1) {
      const tile = { x, y };
      const center = tileCenter(tile, geometry);
      assert.equal(Number.isInteger(center.x), true, `${x},${y} center x must be integer-aligned`);
      assert.equal(Number.isInteger(center.y), true, `${x},${y} center y must be integer-aligned`);
      assert.deepEqual(canvasPointToTile(center, geometry), tile, `${x},${y} center must round-trip`);
    }
  }
});

test('pointer boundaries are half-open and internal grid lines select the following tile', () => {
  const geometry = getBattleStageGeometry(TAKAMINE_GEOMETRY_INPUT);
  const left = geometry.originX;
  const top = geometry.originY;
  const right = left + geometry.boardWidth;
  const bottom = top + geometry.boardHeight;

  assert.deepEqual(canvasPointToTile({ x: left, y: top }, geometry), { x: 0, y: 0 });
  assert.deepEqual(canvasPointToTile({ x: right - 0.001, y: bottom - 0.001 }, geometry), { x: 11, y: 6 });

  assert.equal(canvasPointToTile({ x: left - 0.001, y: top }, geometry), null);
  assert.equal(canvasPointToTile({ x: left, y: top - 0.001 }, geometry), null);
  assert.equal(canvasPointToTile({ x: right, y: top }, geometry), null);
  assert.equal(canvasPointToTile({ x: left, y: bottom }, geometry), null);
  assert.equal(canvasPointToTile({ x: Number.NaN, y: top }, geometry), null);
  assert.equal(canvasPointToTile({ x: left, y: Number.POSITIVE_INFINITY }, geometry), null);

  for (let column = 1; column < geometry.columns; column += 1) {
    const boundaryX = left + column * geometry.cell;
    assert.deepEqual(canvasPointToTile({ x: boundaryX - 0.001, y: top + 1 }, geometry), { x: column - 1, y: 0 });
    assert.deepEqual(canvasPointToTile({ x: boundaryX, y: top + 1 }, geometry), { x: column, y: 0 });
  }
  for (let row = 1; row < geometry.rows; row += 1) {
    const boundaryY = top + row * geometry.cell;
    assert.deepEqual(canvasPointToTile({ x: left + 1, y: boundaryY - 0.001 }, geometry), { x: 0, y: row - 1 });
    assert.deepEqual(canvasPointToTile({ x: left + 1, y: boundaryY }, geometry), { x: 0, y: row });
  }
});

test('CSS-scaled desktop and narrow layouts preserve every pointer-to-tile roundtrip', () => {
  const geometry = getBattleStageGeometry(TAKAMINE_GEOMETRY_INPUT);
  const cssBounds = [
    { left: 0, top: 0, width: 960, height: 540 },
    { left: 17, top: 83, width: 640, height: 360 },
    { left: 11, top: 127, width: 358, height: 201.375 },
  ];

  for (const bounds of cssBounds) {
    const toClient = ({ x, y }) => ({
      x: bounds.left + x * bounds.width / TAKAMINE_GEOMETRY_INPUT.canvasWidth,
      y: bounds.top + y * bounds.height / TAKAMINE_GEOMETRY_INPUT.canvasHeight,
    });
    const toCanvas = ({ x, y }) => ({
      x: (x - bounds.left) * TAKAMINE_GEOMETRY_INPUT.canvasWidth / bounds.width,
      y: (y - bounds.top) * TAKAMINE_GEOMETRY_INPUT.canvasHeight / bounds.height,
    });
    for (let y = 0; y < geometry.rows; y += 1) {
      for (let x = 0; x < geometry.columns; x += 1) {
        const tile = { x, y };
        assert.deepEqual(canvasPointToTile(toCanvas(toClient(tileCenter(tile, geometry))), geometry), tile, `${bounds.width}px CSS board: ${x},${y}`);
      }
    }
    assert.equal(canvasPointToTile(toCanvas(toClient({
      x: geometry.originX + geometry.boardWidth,
      y: geometry.originY,
    })), geometry), null, `${bounds.width}px CSS board right edge must remain outside`);
  }
});

test('descriptive aliases are the same implementation, not divergent geometry paths', () => {
  assert.equal(deriveBattleStageGeometry, getBattleStageGeometry);
  assert.equal(battleCanvasPointToTile, canvasPointToTile);
  assert.equal(battleTileCenter, tileCenter);
});

test('missing or oversized source cells retain the bounded legacy fit fallback', () => {
  const withoutSourceCell = getBattleStageGeometry({
    ...TAKAMINE_GEOMETRY_INPUT,
    spacePx: undefined,
  });
  assert.deepEqual(withoutSourceCell, {
    cell: 77,
    originX: 18,
    originY: 0,
    boardWidth: 924,
    boardHeight: 539,
    columns: 12,
    rows: 7,
    sourceCell: null,
    sourceScale: null,
  });

  const oversizedSourceCell = getBattleStageGeometry({
    ...TAKAMINE_GEOMETRY_INPUT,
    spacePx: 96,
  });
  assert.equal(oversizedSourceCell.cell, 77);
  assert.equal(oversizedSourceCell.sourceCell, 96);
  assert.equal(oversizedSourceCell.sourceScale, null);
  assert.equal(oversizedSourceCell.boardWidth <= TAKAMINE_GEOMETRY_INPUT.canvasWidth, true);
  assert.equal(oversizedSourceCell.boardHeight <= TAKAMINE_GEOMETRY_INPUT.canvasHeight, true);
});

test('invalid or unrenderable geometry is rejected instead of leaking bad pointer math', () => {
  for (const input of [
    {},
    { ...TAKAMINE_GEOMETRY_INPUT, canvasWidth: 0 },
    { ...TAKAMINE_GEOMETRY_INPUT, canvasHeight: Number.NaN },
    { ...TAKAMINE_GEOMETRY_INPUT, levelWidth: -1 },
    { ...TAKAMINE_GEOMETRY_INPUT, levelHeight: 0 },
    { ...TAKAMINE_GEOMETRY_INPUT, canvasWidth: 5, canvasHeight: 5 },
  ]) {
    assert.throws(() => getBattleStageGeometry(input), RangeError);
  }
});
