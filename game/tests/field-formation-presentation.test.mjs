import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  FIELD_FORMATION_TRAIL_LIMIT,
  createFieldFormationPresentation,
  getFieldFormationPresentationContextKey,
  recordFieldFormationDeparture,
  resolveFieldFollowerPlacements,
  syncFieldFormationPresentation,
} from '../field-formation-presentation.mjs';

const BASE_CONTEXT = Object.freeze({
  levelId: 'kgr-ash-fields',
  beatId: 'c5-03-ash-route',
  formation: Object.freeze(['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']),
  leaderId: 'ren',
});

function record(state, position, facing = 'east', context = BASE_CONTEXT) {
  return recordFieldFormationDeparture(state, { ...context, moved: true, position, facing });
}

function resolve(state, overrides = {}) {
  return resolveFieldFollowerPlacements(state, {
    ...BASE_CONTEXT,
    currentPosition: { x: 8, y: 3 },
    width: 12,
    height: 7,
    blocked: [],
    ...overrides,
  });
}

test('context keys include level, beat, exact formation order, and effective leader', () => {
  assert.equal(
    getFieldFormationPresentationContextKey(BASE_CONTEXT),
    '["field-formation-v1","kgr-ash-fields","c5-03-ash-route",["ren","aya","lise","mateus","genta","kiku"],"ren"]',
  );
  assert.notEqual(
    getFieldFormationPresentationContextKey(BASE_CONTEXT),
    getFieldFormationPresentationContextKey({ ...BASE_CONTEXT, leaderId: 'aya' }),
  );
  assert.notEqual(
    getFieldFormationPresentationContextKey(BASE_CONTEXT),
    getFieldFormationPresentationContextKey({ ...BASE_CONTEXT, formation: [...BASE_CONTEXT.formation].reverse() }),
  );
});

test('invalid, duplicate, absent-leader, unknown-member, and imprecise contexts fail closed', () => {
  for (const context of [
    {},
    { ...BASE_CONTEXT, levelId: ' padded ' },
    { ...BASE_CONTEXT, formation: [] },
    { ...BASE_CONTEXT, formation: ['ren', 'ren'] },
    { ...BASE_CONTEXT, formation: ['ren', 'unknown'] },
    { ...BASE_CONTEXT, formation: ['aya'], leaderId: 'ren' },
  ]) assert.equal(getFieldFormationPresentationContextKey(context), null);
});

test('new and synchronized presentation states are deeply immutable and context-owned', () => {
  const initial = createFieldFormationPresentation(BASE_CONTEXT);
  assert.equal(Object.isFrozen(initial), true);
  assert.equal(Object.isFrozen(initial.trail), true);
  assert.deepEqual(initial.trail, []);
  assert.equal(syncFieldFormationPresentation(initial, BASE_CONTEXT), initial);

  const changed = syncFieldFormationPresentation(initial, { ...BASE_CONTEXT, beatId: 'c5-04-next-beat' });
  assert.notEqual(changed, initial);
  assert.deepEqual(changed.trail, []);
  assert.equal(Object.isFrozen(changed), true);
});

test('only an explicitly successful departure records an exact immutable node', () => {
  const initial = createFieldFormationPresentation(BASE_CONTEXT);
  for (const attempt of [
    { ...BASE_CONTEXT, moved: false, position: { x: 2, y: 3 }, facing: 'east' },
    { ...BASE_CONTEXT, moved: true, position: { x: 2.5, y: 3 }, facing: 'east' },
    { ...BASE_CONTEXT, moved: true, position: { x: -1, y: 3 }, facing: 'east' },
    { ...BASE_CONTEXT, moved: true, position: { x: 2, y: 3 }, facing: 'diagonal' },
  ]) assert.equal(recordFieldFormationDeparture(initial, attempt), initial);

  const next = record(initial, { x: 2, y: 3 });
  assert.deepEqual(next.trail, [{ x: 2, y: 3, facing: 'east' }]);
  assert.equal(Object.isFrozen(next), true);
  assert.equal(Object.isFrozen(next.trail), true);
  assert.equal(Object.isFrozen(next.trail[0]), true);
});

test('the newest departure leads and immutable history is capped at one 12 by 7 field', () => {
  let state = createFieldFormationPresentation(BASE_CONTEXT);
  for (let index = 0; index < FIELD_FORMATION_TRAIL_LIMIT + 7; index += 1) {
    state = record(state, { x: index, y: 0 }, index % 2 ? 'east' : 'west');
  }
  assert.equal(FIELD_FORMATION_TRAIL_LIMIT, 84);
  assert.equal(state.trail.length, FIELD_FORMATION_TRAIL_LIMIT);
  assert.deepEqual(state.trail[0], { x: 90, y: 0, facing: 'west' });
  assert.deepEqual(state.trail.at(-1), { x: 7, y: 0, facing: 'east' });
});

test('level, beat, formation, and effective-leader changes reset history before any new record', () => {
  const populated = record(createFieldFormationPresentation(BASE_CONTEXT), { x: 2, y: 3 });
  for (const context of [
    { ...BASE_CONTEXT, levelId: 'kgr-archive-furnace' },
    { ...BASE_CONTEXT, beatId: 'c5-04-next-beat' },
    { ...BASE_CONTEXT, formation: BASE_CONTEXT.formation.slice(0, 5) },
    { ...BASE_CONTEXT, leaderId: 'mateus' },
  ]) {
    const reset = recordFieldFormationDeparture(populated, { ...context, moved: false });
    assert.deepEqual(reset.trail, []);
    assert.equal(reset.contextKey, getFieldFormationPresentationContextKey(context));
  }
});

test('followers preserve canonical formation order after removing the selected leader exactly once', () => {
  const context = { ...BASE_CONTEXT, leaderId: 'mateus' };
  let state = createFieldFormationPresentation(context);
  for (let index = 0; index < 5; index += 1) {
    state = record(state, { x: 7 - index, y: 3 }, 'east', context);
  }
  const placements = resolve(state, { ...context });
  assert.deepEqual(placements.map(({ memberId }) => memberId), ['ren', 'aya', 'lise', 'genta', 'kiku']);
  assert.deepEqual(placements.map(({ position }) => position), [
    { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 },
  ]);
  assert.equal(Object.isFrozen(placements), true);
  assert.equal(placements.every((placement) => Object.isFrozen(placement) && Object.isFrozen(placement.position)), true);
});

test('missing history yields fewer followers and singleton formations remain invisible', () => {
  let state = createFieldFormationPresentation(BASE_CONTEXT);
  state = record(state, { x: 7, y: 3 });
  assert.deepEqual(resolve(state).map(({ memberId }) => memberId), ['aya']);

  const singleton = { ...BASE_CONTEXT, formation: ['ren'] };
  const singletonState = record(createFieldFormationPresentation(singleton), { x: 7, y: 3 }, 'east', singleton);
  assert.deepEqual(resolve(singletonState, singleton), []);
});

test('current, duplicate, blocked, malformed, and out-of-bounds trail nodes are skipped', () => {
  const contextKey = getFieldFormationPresentationContextKey(BASE_CONTEXT);
  const state = Object.freeze({
    contextKey,
    trail: Object.freeze([
      Object.freeze({ x: 8, y: 3, facing: 'east' }),
      Object.freeze({ x: 7, y: 3, facing: 'east' }),
      Object.freeze({ x: 7, y: 3, facing: 'west' }),
      Object.freeze({ x: 6, y: 3, facing: 'diagonal' }),
      Object.freeze({ x: 12, y: 3, facing: 'east' }),
      Object.freeze({ x: 5, y: 7, facing: 'south' }),
      Object.freeze({ x: 5, y: 3, facing: 'east' }),
      Object.freeze({ x: 4, y: 3, facing: 'west' }),
      Object.freeze({ x: 3, y: 3, facing: 'north' }),
    ]),
  });
  const placements = resolve(state, { blocked: ['5,3', { x: 3, y: 3 }] });
  assert.deepEqual(placements, [
    { memberId: 'aya', position: { x: 7, y: 3 }, facing: 'east' },
    { memberId: 'lise', position: { x: 4, y: 3 }, facing: 'west' },
  ]);
});

test('invalid bounds, current positions, blocked collections, and context mismatches return a shared empty result', () => {
  const state = record(createFieldFormationPresentation(BASE_CONTEXT), { x: 7, y: 3 });
  for (const overrides of [
    { width: 0 },
    { height: 2.5 },
    { currentPosition: { x: 12, y: 3 } },
    { currentPosition: { x: 8.25, y: 3 } },
    { blocked: ['not-a-tile'] },
    { blocked: {} },
    { beatId: 'different-beat' },
  ]) {
    const result = resolve(state, overrides);
    assert.deepEqual(result, []);
    assert.equal(Object.isFrozen(result), true);
  }
});

test('resolution is observational and never mutates presentation state or caller data', () => {
  let state = createFieldFormationPresentation(BASE_CONTEXT);
  state = record(state, { x: 7, y: 3 });
  state = record(state, { x: 6, y: 3 });
  const trailBefore = JSON.stringify(state.trail);
  const blocked = ['1,1'];
  resolve(state, { blocked });
  assert.equal(JSON.stringify(state.trail), trailBefore);
  assert.deepEqual(blocked, ['1,1']);
});

test('the module stays DOM-free and contains no persistence, schema, log, or simulation authority', async () => {
  const source = await readFile(new URL('../field-formation-presentation.mjs', import.meta.url), 'utf8');
  assert.match(source, /^import \{ PARTY_ATLAS_DIRECTIONS, PARTY_ATLAS_MEMBERS \} from '\.\/sprite-atlas\.mjs';/u);
  assert.doesNotMatch(source, /document|window|localStorage|sessionStorage|saveAdapter|schemaVersion|moveFieldBy|advanceFieldTime|routeProof|runReceipt|\.log\b/u);
});
