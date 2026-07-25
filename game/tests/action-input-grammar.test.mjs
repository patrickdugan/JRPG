import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMPACT_DASH_TAP_WINDOW_MS,
  resolveCompactActionKeyDown,
  resolveCompactActionKeyUp,
} from '../action-input-grammar.mjs';

test('arrow keys move and a quick second horizontal tap becomes a dash', () => {
  const firstTap = resolveCompactActionKeyDown({
    key: 'ArrowRight',
    nowMs: 1000,
    lastDirectionTapAt: { left: -Infinity, right: -Infinity },
  });
  assert.deepEqual(firstTap.held, { right: true });
  assert.equal(firstTap.edge, null);
  assert.deepEqual(firstTap.tap, { direction: 'right', at: 1000 });

  const secondTap = resolveCompactActionKeyDown({
    key: 'ArrowRight',
    nowMs: 1000 + COMPACT_DASH_TAP_WINDOW_MS,
    lastDirectionTapAt: { right: firstTap.tap.at },
  });
  assert.deepEqual(secondTap.edge, { type: 'maneuver', id: 'dash' });

  const heldRepeat = resolveCompactActionKeyDown({
    key: 'ArrowRight',
    repeat: true,
    nowMs: 1001,
    lastDirectionTapAt: { right: 1000 },
  });
  assert.equal(heldRepeat.edge, null);
  assert.equal(heldRepeat.tap, null);
});

test('Space jumps, while Down plus Space slides', () => {
  const jump = resolveCompactActionKeyDown({ key: ' ', held: {} });
  assert.deepEqual(jump.held, { jump: true });
  assert.deepEqual(jump.edge, { type: 'jump' });

  const slide = resolveCompactActionKeyDown({ key: ' ', held: { down: true } });
  assert.deepEqual(slide.edge, { type: 'maneuver', id: 'slide' });
  assert.deepEqual(slide.held, {});
});

test('Z selects weapon attack, uppercut, slide, or thunder kick from direction and footing', () => {
  assert.deepEqual(
    resolveCompactActionKeyDown({ key: 'z' }).edge,
    { type: 'attack', index: 0 },
  );
  assert.deepEqual(
    resolveCompactActionKeyDown({ key: 'z', held: { up: true } }).edge,
    { type: 'maneuver', id: 'uppercut' },
  );
  assert.deepEqual(
    resolveCompactActionKeyDown({ key: 'z', held: { down: true }, grounded: true }).edge,
    { type: 'maneuver', id: 'slide' },
  );
  assert.deepEqual(
    resolveCompactActionKeyDown({ key: 'z', held: { down: true }, grounded: false }).edge,
    { type: 'maneuver', id: 'thunder-kick' },
  );
});

test('X selects the equipped art or a directional holy subweapon and held keys release cleanly', () => {
  assert.deepEqual(
    resolveCompactActionKeyDown({ key: 'x' }).edge,
    { type: 'attack', index: 1 },
  );
  assert.deepEqual(
    resolveCompactActionKeyDown({ key: 'x', held: { up: true } }).edge,
    { type: 'subweapon', id: 'throwing-cross' },
  );
  assert.deepEqual(
    resolveCompactActionKeyDown({ key: 'x', held: { down: true } }).edge,
    { type: 'subweapon', id: 'holy-water' },
  );
  assert.deepEqual(resolveCompactActionKeyUp('ArrowUp').held, { up: false });
  assert.deepEqual(resolveCompactActionKeyUp('ArrowDown').held, { down: false });
  assert.deepEqual(resolveCompactActionKeyUp(' ').held, { jump: false });
  assert.equal(resolveCompactActionKeyUp('z').handled, false);
});
