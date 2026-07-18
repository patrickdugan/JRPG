import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANIMATION_DURATION_BOUNDS,
  BATTLE_ANIMATION_PHASE_ORDER,
  DELIVERY_ANIMATION_COLORS,
  ENEMY_FAMILY_ANIMATIONS,
  ESSENCE_ANIMATION_COLORS,
  PARTY_SKILL_ANIMATIONS,
  STATUS_GLYPH_PRESENTATION,
  SUPPORTED_PRESENTATION_SPEEDS,
  createBattleAnimationTimeline,
  createEnemyFamilyTimeline,
  createPartySkillTimeline,
  normalizePresentationSpeed,
  sampleBattleAnimation,
} from '../battle-animation.mjs';
import { COMBAT_STATUS_DEFINITIONS, PARTY_SKILLS } from '../campaign-combat.mjs';
import { ENEMY_FAMILIES } from '../enemy-atlas.mjs';

const PARTY_IDS = Object.keys(PARTY_SKILLS);
const FAMILY_IDS = ENEMY_FAMILIES.map(({ id }) => id);
const STATUS_IDS = Object.keys(COMBAT_STATUS_DEFINITIONS);

function assertDeepFrozen(value, path = 'root') {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  for (const [key, nested] of Object.entries(value)) assertDeepFrozen(nested, `${path}.${key}`);
}

function canonicalPhaseRank(phase) {
  if (phase === 'projectile' || phase === 'trail') return BATTLE_ANIMATION_PHASE_ORDER.indexOf('projectile-or-trail');
  return BATTLE_ANIMATION_PHASE_ORDER.indexOf(phase);
}

test('every authored party skill maps its live delivery and essence vocabulary', () => {
  assert.deepEqual(Object.keys(PARTY_SKILL_ANIMATIONS).sort(), PARTY_IDS.sort());
  for (const skillId of PARTY_IDS) {
    const skill = PARTY_SKILLS[skillId];
    const profile = PARTY_SKILL_ANIMATIONS[skillId];
    assert.equal(profile.delivery, skill.delivery, `${skillId} delivery`);
    assert.equal(profile.essence, skill.essence ?? null, `${skillId} essence`);
    assert.ok(Object.hasOwn(DELIVERY_ANIMATION_COLORS, profile.delivery));
    if (profile.essence) assert.ok(Object.hasOwn(ESSENCE_ANIMATION_COLORS, profile.essence));

    const timeline = createPartySkillTimeline(skillId, {
      sourceTile: { x: 2, y: 5 },
      targetTile: { x: 7, y: 2 },
    });
    assert.equal(timeline.resolvedId, skillId);
    assert.equal(timeline.fallbackUsed, false);
    assert.equal(timeline.action.delivery, skill.delivery);
    assert.equal(timeline.action.essence, skill.essence ?? null);
  }
});

test('every enemy atlas family and every canonical template resolves to its explicit motion profile', () => {
  assert.deepEqual(Object.keys(ENEMY_FAMILY_ANIMATIONS), FAMILY_IDS);
  for (const family of ENEMY_FAMILIES) {
    const familyTimeline = createEnemyFamilyTimeline(family.id, {
      source: { x: 8, y: 3 }, target: { x: 2, y: 4 },
    });
    assert.equal(familyTimeline.resolvedId, family.id);
    assert.equal(familyTimeline.fallbackUsed, false);
    for (const templateId of family.templateIds) {
      const templateTimeline = createEnemyFamilyTimeline(templateId, {
        source: { x: 8, y: 3 }, target: { x: 2, y: 4 },
      });
      assert.equal(templateTimeline.resolvedId, family.id, templateId);
      assert.equal(templateTimeline.fallbackUsed, false, templateId);
    }
  }
});

test('all combat statuses have an immutable glyph pulse using the exact live status id and name', () => {
  assert.deepEqual(Object.keys(STATUS_GLYPH_PRESENTATION).sort(), STATUS_IDS.sort());
  for (const statusId of STATUS_IDS) {
    const presentation = STATUS_GLYPH_PRESENTATION[statusId];
    assert.equal(presentation.name, COMBAT_STATUS_DEFINITIONS[statusId].name);
    assert.match(presentation.color, /^#[0-9a-f]{6}$/i);
    assert.ok(presentation.glyph.length >= 1);

    const timeline = createPartySkillTimeline('courier-cut', {
      source: { x: 1, y: 1 }, target: { x: 2, y: 1 }, statusId,
    });
    assert.ok(timeline.simulationOrder.includes('status-glyph'));
    const pulses = timeline.frames.filter((frame) => frame.statusGlyph);
    assert.equal(pulses.length, 5);
    assert.ok(pulses.every((frame) => frame.statusGlyph.id === statusId));
    assert.ok(pulses.every((frame) => frame.statusGlyph.name === COMBAT_STATUS_DEFINITIONS[statusId].name));
  }
});

test('phases preserve windup, exact-grid movement, appropriate emission, impact, stagger, status, and recovery order', () => {
  for (const profile of [...Object.values(PARTY_SKILL_ANIMATIONS), ...Object.values(ENEMY_FAMILY_ANIMATIONS)]) {
    const create = PARTY_SKILL_ANIMATIONS[profile.id]
      ? createPartySkillTimeline
      : createEnemyFamilyTimeline;
    const timeline = create(profile.id, {
      sourceTile: { x: 2, y: 5 },
      targetTile: { x: 7, y: 2 },
      statusId: 'shock',
    });
    const ranks = timeline.simulationOrder.map(canonicalPhaseRank);
    assert.ok(ranks.every((rank) => rank >= 0), `${profile.id} has a known phase`);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), `${profile.id} phase order`);
    assert.equal(timeline.simulationOrder[0], 'windup');
    assert.equal(timeline.simulationOrder[1], 'movement');
    assert.equal(timeline.simulationOrder.at(-1), 'recovery');
    assert.ok(timeline.simulationOrder.includes('impact'));
    assert.ok(timeline.simulationOrder.includes('stagger'));
    assert.ok(timeline.simulationOrder.includes('status-glyph'));
    assert.equal(timeline.simulationOrder.includes('projectile'), profile.emissionKind === 'projectile');
    assert.equal(timeline.simulationOrder.includes('trail'), profile.emissionKind === 'trail');
  }
});

test('lunge endpoints are exact integer grid tiles and presentation never changes simulation position', () => {
  const source = { x: 4, y: 5 };
  const target = { x: 7, y: 2 };
  const timeline = createPartySkillTimeline('hunter-thrust', { sourceTile: source, targetTile: target });
  assert.deepEqual(timeline.motion.gridVector, { x: 1, y: -1 });
  assert.deepEqual(timeline.motion.lungeTile, { x: 5, y: 4 });
  assert.deepEqual(timeline.motion.returnTile, source);
  assert.equal(timeline.motion.simulationPositionChanges, false);
  assert.ok(Number.isInteger(timeline.motion.lungeTile.x));
  assert.ok(Number.isInteger(timeline.motion.lungeTile.y));
  assert.ok(timeline.frames.every((frame) => (
    frame.actor.simulationTile.x === source.x && frame.actor.simulationTile.y === source.y
  )));
  assert.deepEqual(timeline.frames.at(-1).actor.renderTile, source);
  assert.equal(timeline.frames.at(-1).actor.pose, 'neutral');
});

test('authored phase and timeline durations are explicit, bounded, and speed scales only presentation time', () => {
  for (const skillId of PARTY_IDS) {
    const timelines = SUPPORTED_PRESENTATION_SPEEDS.map((speed) => createPartySkillTimeline(skillId, {
      source: { x: 1, y: 1 }, target: { x: 5, y: 1 }, statusId: 'dread', speed,
    }));
    const base = timelines[0];
    assert.ok(base.baseDurationMs >= ANIMATION_DURATION_BOUNDS.minimumBaseTimelineMs);
    assert.ok(base.baseDurationMs <= ANIMATION_DURATION_BOUNDS.maximumBaseTimelineMs);
    for (const phase of base.phases) {
      assert.ok(phase.baseDurationMs >= ANIMATION_DURATION_BOUNDS.minimumBasePhaseMs, `${skillId}:${phase.id}`);
      assert.ok(phase.baseDurationMs <= ANIMATION_DURATION_BOUNDS.maximumBasePhaseMs, `${skillId}:${phase.id}`);
    }
    for (const timeline of timelines) {
      assert.equal(timeline.durationMs, base.baseDurationMs / timeline.presentationSpeed);
      assert.deepEqual(timeline.simulationOrder, base.simulationOrder);
      assert.equal(timeline.frames.length, base.frames.length);
      assert.deepEqual(timeline.frames.map((frame) => frame.baseAtMs), base.frames.map((frame) => frame.baseAtMs));
      assert.ok(timeline.frames.every((frame, index) => (
        frame.atMs === base.frames[index].baseAtMs / timeline.presentationSpeed
      )));
    }
  }
});

test('concrete enemy skills override colors with live delivery, essence, and status without changing family motion', () => {
  const skill = {
    id: 'crane-surge',
    delivery: 'arcane',
    essence: 'storm',
    effect: { status: 'shock' },
  };
  const timeline = createEnemyFamilyTimeline('captain-kaji', {
    source: { x: 8, y: 3 }, target: { x: 2, y: 3 }, skill,
  });
  assert.equal(timeline.resolvedId, 'court-retainer');
  assert.equal(timeline.actionId, 'crane-surge');
  assert.equal(timeline.action.delivery, 'arcane');
  assert.equal(timeline.action.essence, 'storm');
  assert.equal(timeline.action.statusId, 'shock');
  assert.equal(timeline.colors.delivery, DELIVERY_ANIMATION_COLORS.arcane);
  assert.equal(timeline.colors.impact, ESSENCE_ANIMATION_COLORS.storm);
  assert.equal(timeline.action.movementKind, ENEMY_FAMILY_ANIMATIONS['court-retainer'].movementKind);
});

test('timeline replay is byte-deterministic, deeply frozen, sampleable, and cannot mutate its inputs', () => {
  const options = {
    sourceTile: { x: 3, y: 4 },
    targetTile: { x: 9, y: 1 },
    statusId: 'scorch',
    speed: 2,
  };
  const before = JSON.stringify(options);
  const first = createPartySkillTimeline('cinder-route', options);
  const second = createPartySkillTimeline('cinder-route', options);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify(options), before);
  assertDeepFrozen(first);
  assert.equal(sampleBattleAnimation(first, -100), first.frames[0]);
  assert.equal(sampleBattleAnimation(first, Number.POSITIVE_INFINITY), first.frames[0]);
  assert.equal(sampleBattleAnimation(first, first.durationMs + 100), first.frames.at(-1));
  assert.equal(sampleBattleAnimation(null, 10), null);
});

test('unsupported ids, malformed tiles, damage keys, statuses, and speeds resolve to safe deterministic fallbacks', () => {
  assert.equal(normalizePresentationSpeed(3), 1);
  assert.equal(normalizePresentationSpeed('4'), 4);
  const unknownParty = createPartySkillTimeline('missing-skill', {
    source: { x: 1.5, y: 'bad' },
    target: null,
    speed: 99,
    delivery: 'laser',
    essence: 'void',
    statusId: 'silenced',
  });
  assert.equal(unknownParty.fallbackUsed, true);
  assert.equal(unknownParty.resolvedId, 'fallback');
  assert.equal(unknownParty.presentationSpeed, 1);
  assert.deepEqual(unknownParty.motion.sourceTile, { x: 0, y: 0 });
  assert.deepEqual(unknownParty.motion.targetTile, { x: 0, y: 0 });
  assert.equal(unknownParty.action.delivery, 'cut');
  assert.equal(unknownParty.action.essence, null);
  assert.equal(unknownParty.action.statusId, null);

  const unknownEnemy = createEnemyFamilyTimeline('missing-family', {
    source: { x: 3, y: 3 }, target: { x: 4, y: 3 },
  });
  assert.equal(unknownEnemy.fallbackUsed, true);
  assert.equal(unknownEnemy.resolvedId, 'ashen-oni');

  const generic = createBattleAnimationTimeline({ source: { x: 1, y: 2 }, target: { x: 2, y: 2 } });
  assert.equal(generic.sourceType, 'fallback');
  assert.equal(generic.fallbackUsed, true);
  assertDeepFrozen(generic);
});
