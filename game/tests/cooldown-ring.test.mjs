import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  COOLDOWN_GLINT_MS,
  COOLDOWN_RING_INNER,
  COOLDOWN_RING_OUTER,
  PARTY_LABEL_BOTTOM_OFFSET,
  advanceCooldownTracker,
  cooldownGlintStage,
  cooldownRingBox,
  cooldownRingCenter,
  cooldownRingPips,
  cooldownRingPlan,
  cooldownRingProgress,
} from '../cooldown-ring.mjs';
import { labelBoxesOverlap } from '../action-label-layout.mjs';

test('ring pips start at twelve oclock, run clockwise, and are whole pixels', () => {
  const pips = cooldownRingPips(COOLDOWN_RING_INNER);
  assert.equal(pips.length, COOLDOWN_RING_INNER.segments);
  assert.deepEqual(pips[0], { x: 0, y: -COOLDOWN_RING_INNER.radius });
  assert.deepEqual(pips[3], { x: COOLDOWN_RING_INNER.radius, y: 0 });
  assert.deepEqual(pips[6], { x: 0, y: COOLDOWN_RING_INNER.radius });
  assert.deepEqual(pips[9], { x: -COOLDOWN_RING_INNER.radius, y: 0 });
  for (const ring of [COOLDOWN_RING_INNER, COOLDOWN_RING_OUTER]) {
    const all = cooldownRingPips(ring);
    assert.equal(new Set(all.map(({ x, y }) => `${x},${y}`)).size, all.length, 'pips never share a pixel');
    for (const { x, y } of all) assert.ok(Number.isInteger(x) && Number.isInteger(y));
  }
});

test('progress sweeps from empty to full and is ready only at zero remaining', () => {
  assert.deepEqual(cooldownRingProgress(400, 400), { fraction: 0, filled: 0, segments: 12, ready: false });
  assert.equal(cooldownRingProgress(200, 400).filled, 6);
  assert.equal(cooldownRingProgress(1, 400).filled, 11);
  assert.deepEqual(cooldownRingProgress(0, 400), { fraction: 1, filled: 12, segments: 12, ready: true });
  assert.equal(cooldownRingProgress(0, 0).ready, true);
  assert.equal(cooldownRingProgress(NaN, 400).ready, true);
  let last = -1;
  for (let remaining = 400; remaining >= 0; remaining -= 8) {
    const { filled } = cooldownRingProgress(remaining, 400);
    assert.ok(filled >= last, 'monotonic');
    last = filled;
  }
});

test('tracker learns the total from the first remaining value and stamps completion once', () => {
  let state = advanceCooldownTracker(null, 0, 0);
  assert.equal(state.totalMs, 0);
  state = advanceCooldownTracker(state, 400, 100);
  assert.deepEqual(state, { totalMs: 400, remainingMs: 400, completedAtMs: null });
  state = advanceCooldownTracker(state, 250, 250);
  assert.equal(state.totalMs, 400);
  state = advanceCooldownTracker(state, 0, 400);
  assert.equal(state.completedAtMs, 400);
  const again = advanceCooldownTracker(state, 0, 500);
  assert.equal(again.completedAtMs, 400);
  const restarted = advanceCooldownTracker(again, 360, 520);
  assert.deepEqual(restarted, { totalMs: 360, remainingMs: 360, completedAtMs: null });
});

test('glint plays four stages then stops; reduced motion never glints', () => {
  assert.equal(cooldownGlintStage(null, 10), null);
  assert.equal(cooldownGlintStage(100, 100), 0);
  assert.equal(cooldownGlintStage(100, 100 + COOLDOWN_GLINT_MS - 1), 3);
  assert.equal(cooldownGlintStage(100, 100 + COOLDOWN_GLINT_MS), null);
  assert.equal(cooldownGlintStage(100, 120, true), null);
});

test('plan shows the ring only while cooling down or glinting, with an outer ring for longer art cooldowns', () => {
  assert.equal(cooldownRingPlan({}).visible, false);
  const shared = cooldownRingPlan({ sharedRemainingMs: 200, sharedTotalMs: 400, nowMs: 50 });
  assert.equal(shared.visible, true);
  assert.equal(shared.inner.filled, 6);
  assert.equal(shared.outer, null);
  const both = cooldownRingPlan({ sharedRemainingMs: 200, sharedTotalMs: 400, artRemainingMs: 900, artTotalMs: 1200 });
  assert.equal(both.outer.segments, COOLDOWN_RING_OUTER.segments);
  assert.equal(both.outer.filled, 4);
  const glint = cooldownRingPlan({ sharedTotalMs: 400, completedAtMs: 1000, nowMs: 1050 });
  assert.equal(glint.visible, true);
  assert.equal(glint.inner.ready, true);
  assert.equal(glint.glint, 0);
  const reduced = cooldownRingPlan({ sharedTotalMs: 400, completedAtMs: 1000, nowMs: 1050, reducedMotion: true });
  assert.equal(reduced.visible, false);
  const stillRing = cooldownRingPlan({ sharedRemainingMs: 100, sharedTotalMs: 400, reducedMotion: true });
  assert.equal(stillRing.visible, true);
  assert.equal(stillRing.glint, null);
});

test('ring clears the name label placed at the party label offset', () => {
  const center = cooldownRingCenter(300, 400);
  for (const ring of [COOLDOWN_RING_INNER, COOLDOWN_RING_OUTER]) {
    const box = cooldownRingBox(center.x, center.y, ring);
    const labelBottom = 400 - PARTY_LABEL_BOTTOM_OFFSET;
    const label = { left: 250, right: 350, top: labelBottom - 22, bottom: labelBottom };
    assert.equal(labelBoxesOverlap(box, label, 0), false);
  }
});
