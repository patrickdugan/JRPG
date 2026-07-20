import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PARTY_ATLAS,
  PARTY_ATLAS_MEMBERS,
  PARTY_ATLAS_DIRECTIONS,
  PARTY_ATLAS_FIELD_POSES,
  atlasDirectionForMovement,
  getPartyAtlasFieldPoseFrame,
  getPartyAtlasFrame,
  getPartyAtlasWalkFrame,
  partyAtlasImageHasExpectedSize,
} from '../sprite-atlas.mjs';

const campaignSource = readFileSync(new URL('../campaign.js', import.meta.url), 'utf8');

function sourceSection(start, end) {
  const startIndex = campaignSource.indexOf(start);
  const endIndex = campaignSource.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `${start} section must exist`);
  return campaignSource.slice(startIndex, endIndex);
}

test('party atlas addresses every member directional pair and appended live field pose', () => {
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
    for (const pose of PARTY_ATLAS_FIELD_POSES) {
      const frame = getPartyAtlasFieldPoseFrame(memberId, pose);
      assert.equal(frame.row, PARTY_ATLAS_MEMBERS.indexOf(memberId));
      assert.equal(frame.direction, 'south');
      assert.equal(frame.pose, pose);
      assert.equal(frame.column, pose === 'interact' ? 8 : 9);
      assert.equal(Object.isFrozen(frame), true);
      keys.add(`${frame.row}:${frame.column}`);
      rectangles.add(`${frame.x}:${frame.y}:${frame.width}:${frame.height}`);
    }
  }
  assert.equal(keys.size, PARTY_ATLAS.rows * 10);
  assert.equal(rectangles.size, PARTY_ATLAS.rows * 10);
  assert.equal(PARTY_ATLAS.width, PARTY_ATLAS.cellWidth * PARTY_ATLAS.columns);
  assert.equal(PARTY_ATLAS.rowCells.length, PARTY_ATLAS.rows);
  assert.deepEqual(PARTY_ATLAS.rowCells.map(({ y }) => y), [0, 48, 96, 144, 192, 240]);
  assert.equal(Object.isFrozen(PARTY_ATLAS.rowCells), true);
});

test('every party member has two distinct directional walk keys appended without moving legacy cells', () => {
  const expectedWalkColumns = {
    north: [1, 10], east: [3, 11], south: [5, 12], west: [7, 13],
  };
  const rectangles = new Set();
  for (const memberId of PARTY_ATLAS_MEMBERS) {
    for (const direction of PARTY_ATLAS_DIRECTIONS) {
      const legacy = getPartyAtlasFrame(memberId, direction, 1);
      const walkA = getPartyAtlasWalkFrame(memberId, direction, 0);
      const walkB = getPartyAtlasWalkFrame(memberId, direction, 1);
      assert.deepEqual(
        ['row', 'column', 'x', 'y', 'width', 'height'].map((field) => walkA[field]),
        ['row', 'column', 'x', 'y', 'width', 'height'].map((field) => legacy[field]),
      );
      assert.deepEqual([walkA.column, walkB.column], expectedWalkColumns[direction]);
      assert.equal(walkB.row, PARTY_ATLAS_MEMBERS.indexOf(memberId));
      assert.equal(Object.isFrozen(walkB), true);
      rectangles.add(`${walkA.row}:${walkA.column}`);
      rectangles.add(`${walkB.row}:${walkB.column}`);
    }
  }
  assert.equal(rectangles.size, PARTY_ATLAS_MEMBERS.length * PARTY_ATLAS_DIRECTIONS.length * 2);
  assert.throws(() => getPartyAtlasWalkFrame('ren', 'south', -1), /non-negative/);
});

test('field event pose addressing is exact and rejects unsupported authored states', () => {
  assert.deepEqual(PARTY_ATLAS_FIELD_POSES, ['interact', 'hurt']);
  assert.equal(Object.isFrozen(PARTY_ATLAS_FIELD_POSES), true);
  assert.equal(getPartyAtlasFieldPoseFrame('ren', 'interact').x, 256);
  assert.equal(getPartyAtlasFieldPoseFrame('ren', 'hurt').x, 288);
  assert.equal(getPartyAtlasFieldPoseFrame('kiku', 'hurt').y, 240);
  assert.throws(() => getPartyAtlasFieldPoseFrame('ren', 'emote'), /Unknown party atlas field pose/);
  assert.throws(() => getPartyAtlasFieldPoseFrame('unknown', 'hurt'), /Unknown party atlas member/);
});

test('campaign wires authored event poses only to live interaction input and hazard-hit paths', () => {
  const timedHazard = sourceSection('function sampleFieldRuntime', 'function getFieldHazardConsequence');
  const movement = sourceSection('function attemptFieldMove', 'function drawMap');
  const interaction = sourceSection("interactFieldButton.addEventListener('click'", "previousScene.addEventListener('click'");
  const draw = sourceSection('function drawMap', 'function formatEnemies');

  assert.match(timedHazard, /important\?\.type === 'hazard-hit'[\s\S]*holdPartyFieldPose\('hurt'\)/u);
  assert.match(movement, /moveFieldBy\(fieldRuntimeState, dx, dy[\s\S]*commitStateChanges\('Field movement'[\s\S]*fieldWalkUntil = performance\.now\(\) \+ 320/u);
  assert.match(movement, /const hazardHits = result\.events\.filter[\s\S]*if \(hazardHits\.length\) holdPartyFieldPose\('hurt'\)/u);
  assert.doesNotMatch(movement, /getPartyAtlasWalkFrame/u, 'walk-frame sampling must remain outside movement authority');
  assert.match(interaction, /ensureFieldPosition\(level\)[\s\S]*holdPartyFieldPose\('interact'\)/u);
  assert.match(draw, /const moving = !reducedMotion\.matches && now < fieldWalkUntil[\s\S]*getPartyAtlasWalkFrame\('ren', fieldFacing, phase\)[\s\S]*getPartyAtlasFrame\('ren', fieldFacing, 0\)/u);
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
  assert.equal(partyAtlasImageHasExpectedSize({ naturalWidth: 448, naturalHeight: 288 }), true);
  assert.equal(partyAtlasImageHasExpectedSize({ naturalWidth: 447, naturalHeight: 288 }), false);
  assert.equal(partyAtlasImageHasExpectedSize({ naturalWidth: 448, naturalHeight: 287 }), false);
  assert.equal(partyAtlasImageHasExpectedSize(null), false);
});
