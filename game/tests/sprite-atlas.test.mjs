import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PARTY_ATLAS,
  PARTY_ATLAS_MEMBERS,
  atlasDirectionForMovement,
  getPartyAtlasFrame,
} from '../sprite-atlas.mjs';

test('party atlas addresses every member and directional idle/walk pair without overlap', () => {
  const keys = new Set();
  for (const memberId of PARTY_ATLAS_MEMBERS) {
    for (const direction of ['north', 'east', 'south', 'west']) {
      const idle = getPartyAtlasFrame(memberId, direction, 0);
      const walk = getPartyAtlasFrame(memberId, direction, 1);
      assert.equal(walk.column, idle.column + 1);
      assert.equal(idle.row, PARTY_ATLAS_MEMBERS.indexOf(memberId));
      for (const frame of [idle, walk]) {
        assert.ok(frame.x >= 0 && frame.x + frame.width <= PARTY_ATLAS.width);
        assert.ok(frame.y >= 0 && frame.y + frame.height <= PARTY_ATLAS.height + Number.EPSILON * 1024);
        keys.add(`${frame.row}:${frame.column}`);
      }
    }
  }
  assert.equal(keys.size, PARTY_ATLAS.rows * PARTY_ATLAS.columns);
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
