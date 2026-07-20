import test from 'node:test';
import assert from 'node:assert/strict';

import { PARTY_PROFILES, PARTY_SKILLS } from '../campaign-combat.mjs';
import {
  PARTY_COMBAT_ATLAS,
  PARTY_COMBAT_MEMBERS,
  PARTY_COMBAT_POSES,
  PARTY_COMBAT_SKILL_POSES,
  getPartyCombatFrame,
  getPartyCombatPresentationPose,
  partyCombatImageHasExpectedSize,
} from '../party-combat-atlas.mjs';

test('party combat atlas exposes all 48 exact authored cells', () => {
  const rectangles = new Set();
  for (const [row, memberId] of PARTY_COMBAT_MEMBERS.entries()) {
    for (const [column, pose] of PARTY_COMBAT_POSES.entries()) {
      const frame = getPartyCombatFrame(memberId, pose);
      assert.deepEqual(frame, {
        memberId,
        pose,
        row,
        column,
        x: column * 48,
        y: row * 64,
        width: 48,
        height: 64,
        pivotX: 24,
        pivotY: 58,
      });
      assert.equal(Object.isFrozen(frame), true);
      rectangles.add(`${frame.x},${frame.y},${frame.width},${frame.height}`);
    }
  }
  assert.equal(rectangles.size, 48);
  assert.equal(PARTY_COMBAT_ATLAS.width, PARTY_COMBAT_ATLAS.columns * PARTY_COMBAT_ATLAS.cellWidth);
  assert.equal(PARTY_COMBAT_ATLAS.height, PARTY_COMBAT_ATLAS.rows * PARTY_COMBAT_ATLAS.cellHeight);
  assert.throws(() => getPartyCombatFrame('unknown', 'idle'), /Unknown party combat member/);
  assert.throws(() => getPartyCombatFrame('ren', 'unknown'), /Unknown party combat pose/);
});

test('every canonical live skill maps to its owner profile signature slot', () => {
  const expected = Object.fromEntries(Object.values(PARTY_PROFILES).flatMap((profile) => (
    profile.skillIds.map((skillId, slot) => [skillId, slot === 0 ? 'signature-a' : 'signature-b'])
  )));

  assert.equal(Object.isFrozen(PARTY_COMBAT_SKILL_POSES), true);
  assert.deepEqual(PARTY_COMBAT_SKILL_POSES, expected);
  assert.deepEqual(
    new Set(Object.keys(PARTY_COMBAT_SKILL_POSES)),
    new Set(Object.keys(PARTY_SKILLS)),
  );

  for (const profile of Object.values(PARTY_PROFILES)) {
    assert.ok(profile.skillIds.length >= 1 && profile.skillIds.length <= 2, profile.id);
    profile.skillIds.forEach((skillId, slot) => {
      assert.equal(PARTY_SKILLS[skillId]?.id, skillId, `${profile.id}:${skillId}`);
      assert.equal(
        PARTY_COMBAT_SKILL_POSES[skillId],
        slot === 0 ? 'signature-a' : 'signature-b',
        `${profile.id}:${skillId}`,
      );
    });
  }
});

test('four signature-b cells are authored reserves with no current live owner skill', () => {
  const reservedMembers = PARTY_COMBAT_MEMBERS.filter((memberId) => (
    !PARTY_PROFILES[memberId].skillIds.some((skillId) => PARTY_COMBAT_SKILL_POSES[skillId] === 'signature-b')
  ));

  assert.deepEqual(reservedMembers, ['aya', 'mateus', 'genta', 'kiku']);
  for (const memberId of reservedMembers) {
    assert.equal(PARTY_PROFILES[memberId].skillIds.length, 1, memberId);
    assert.deepEqual(getPartyCombatFrame(memberId, 'signature-b'), {
      memberId,
      pose: 'signature-b',
      row: PARTY_COMBAT_MEMBERS.indexOf(memberId),
      column: PARTY_COMBAT_POSES.indexOf('signature-b'),
      x: 7 * 48,
      y: PARTY_COMBAT_MEMBERS.indexOf(memberId) * 64,
      width: 48,
      height: 64,
      pivotX: 24,
      pivotY: 58,
    });
  }
});

test('live animation phases resolve to authored party combat keys', () => {
  assert.equal(getPartyCombatPresentationPose({}), 'idle');
  assert.equal(getPartyCombatPresentationPose({ stance: 'guard' }), 'guard');
  assert.equal(getPartyCombatPresentationPose({ moving: true }), 'move');
  assert.equal(getPartyCombatPresentationPose({ phase: 'movement', stance: 'guard' }), 'move');
  assert.equal(getPartyCombatPresentationPose({ phase: 'windup', actorPose: 'attack' }), 'basic-strike-windup');
  assert.equal(getPartyCombatPresentationPose({ actorPose: 'attack', actionId: 'courier-cut' }), 'signature-a');
  assert.equal(getPartyCombatPresentationPose({ actorPose: 'attack', actionId: 'cinder-route' }), 'signature-b');
  assert.equal(getPartyCombatPresentationPose({ actorPose: 'attack', actionId: 'future-skill' }), 'basic-strike-active');
  assert.equal(getPartyCombatPresentationPose({ phase: 'recovery', actorPose: 'attack' }), 'idle');
  assert.equal(getPartyCombatPresentationPose({ targetPose: 'stagger', phase: 'windup' }), 'hit');
});

test('party combat image validation rejects decodable wrong-size rasters', () => {
  assert.equal(partyCombatImageHasExpectedSize({ naturalWidth: 384, naturalHeight: 384 }), true);
  assert.equal(partyCombatImageHasExpectedSize({ naturalWidth: 383, naturalHeight: 384 }), false);
  assert.equal(partyCombatImageHasExpectedSize({ naturalWidth: 384, naturalHeight: 383 }), false);
  assert.equal(partyCombatImageHasExpectedSize(null), false);
});
