import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PARTY_ATLAS,
  PARTY_ATLAS_MEMBERS,
  PARTY_ATLAS_DIRECTIONS,
  atlasDirectionForMovement,
  getPartyAtlasFrame,
  partyAtlasImageHasExpectedSize,
} from '../sprite-atlas.mjs';

test('party atlas addresses every member and directional idle/walk pair with exact authored frames', () => {
  const keys = new Set();
  const rectangles = new Set();
  for (const memberId of PARTY_ATLAS_MEMBERS) {
    for (const direction of PARTY_ATLAS_DIRECTIONS) {
      const idle = getPartyAtlasFrame(memberId, direction, 0);
      const walk = getPartyAtlasFrame(memberId, direction, 1);
      assert.equal(walk.column, idle.column + 1);
      assert.equal(idle.row, PARTY_ATLAS_MEMBERS.indexOf(memberId));
      for (const frame of [idle, walk]) {
        for (const field of [
          'row', 'column', 'cellX', 'cellY', 'cellWidth', 'cellHeight',
          'sourceInset', 'x', 'y', 'width', 'height',
        ]) assert.equal(Number.isSafeInteger(frame[field]), true, `${memberId}:${direction}:${field}`);

        assert.ok(frame.cellX >= 0 && frame.cellX + frame.cellWidth <= PARTY_ATLAS.width);
        assert.ok(frame.cellY >= 0 && frame.cellY + frame.cellHeight <= PARTY_ATLAS.height);
        assert.equal(frame.x, frame.cellX);
        assert.equal(frame.y, frame.cellY);
        assert.equal(frame.width, PARTY_ATLAS.sourceWidth);
        assert.equal(frame.height, PARTY_ATLAS.sourceHeight);
        assert.equal(Object.isFrozen(frame), true);

        keys.add(`${frame.row}:${frame.column}`);
        rectangles.add(`${frame.x}:${frame.y}:${frame.width}:${frame.height}`);
      }
    }
  }
  assert.equal(keys.size, PARTY_ATLAS.rows * PARTY_ATLAS.columns);
  assert.equal(rectangles.size, PARTY_ATLAS.rows * PARTY_ATLAS.columns);
  assert.equal(PARTY_ATLAS.width, PARTY_ATLAS.cellWidth * PARTY_ATLAS.columns);
  assert.equal(PARTY_ATLAS.rowCells.length, PARTY_ATLAS.rows);
  assert.deepEqual(PARTY_ATLAS.rowCells.map(({ y }) => y), [0, 48, 96, 144, 192, 240]);
  assert.equal(Object.isFrozen(PARTY_ATLAS.rowCells), true);
});

test('party frame identity, authored pose mapping, and source scale stay stable', () => {
  const expectedColumns = { north: 0, east: 2, south: 4, west: 6 };
  const widths = new Set();
  const heights = new Set();
  for (const [row, memberId] of PARTY_ATLAS_MEMBERS.entries()) {
    for (const direction of PARTY_ATLAS_DIRECTIONS) {
      for (const phase of [0, 1]) {
        const frame = getPartyAtlasFrame(memberId, direction, phase);
        assert.equal(frame.memberId, memberId);
        assert.equal(frame.direction, direction);
        assert.equal(frame.walkingPhase, phase);
        assert.equal(frame.row, row);
        assert.equal(frame.column, expectedColumns[direction] + phase);
        assert.deepEqual(frame, getPartyAtlasFrame(memberId, direction, phase + 2));
        widths.add(frame.width);
        heights.add(frame.height);
      }
    }
  }
  assert.deepEqual([...widths], [32]);
  assert.deepEqual([...heights], [48]);
});

test('eight-way movement resolves deterministically to four authored facings', () => {
  assert.equal(atlasDirectionForMovement(0, -1), 'north');
  assert.equal(atlasDirectionForMovement(1, 0), 'east');
  assert.equal(atlasDirectionForMovement(0, 1), 'south');
  assert.equal(atlasDirectionForMovement(-1, 0), 'west');
  assert.equal(atlasDirectionForMovement(1, -1), 'north');
  assert.equal(atlasDirectionForMovement(-1, 1), 'south');
  assert.equal(atlasDirectionForMovement(0, 0, 'west'), 'west');
  assert.throws(() => atlasDirectionForMovement(2, 0), /exact/);
});

test('party atlas image validation rejects decodable wrong-size rasters', () => {
  assert.equal(partyAtlasImageHasExpectedSize({ naturalWidth: 256, naturalHeight: 288 }), true);
  assert.equal(partyAtlasImageHasExpectedSize({ naturalWidth: 255, naturalHeight: 288 }), false);
  assert.equal(partyAtlasImageHasExpectedSize({ naturalWidth: 256, naturalHeight: 287 }), false);
  assert.equal(partyAtlasImageHasExpectedSize(null), false);
});
