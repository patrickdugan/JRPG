import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIELD_SCHEMA_VERSION,
  advanceFieldTime,
  createFieldState,
  createFieldStorageAdapter,
  enterField,
  getCurrentFieldContext,
  getFieldObjectiveProgress,
  getFieldStatus,
  getNearbyInteractables,
  interactField,
  loadFieldState,
  moveField,
  moveFieldBy,
  resolveFieldEncounter,
  serializeFieldState,
  useFieldExit,
  validateFieldPayload,
} from '../field-runtime.mjs';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('fresh state is immutable and stores independent level/beat contexts', () => {
  let state = createFieldState({ levelId: 'tkm-rain-gate', beatId: 'chapter-2-beat-a' });
  assert.equal(state.schemaVersion, FIELD_SCHEMA_VERSION);
  assert.deepEqual(getCurrentFieldContext(state).position, { x: 2, y: 9 });
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.contexts), true);

  state = moveField(state, 'east').state;
  assert.deepEqual(getCurrentFieldContext(state).position, { x: 3, y: 9 });
  state = enterField(state, 'tkm-rain-gate', 'chapter-2-beat-b');
  assert.deepEqual(getCurrentFieldContext(state).position, { x: 2, y: 9 });
  state = enterField(state, 'tkm-rain-gate', 'chapter-2-beat-a');
  assert.deepEqual(getCurrentFieldContext(state).position, { x: 3, y: 9 });
  assert.equal(state.contexts.length, 2);
});

test('movement is one exact eight-way step and rejects collision and corner cutting', () => {
  let state = createFieldState({
    levelId: 'tkm-rain-gate',
    beatId: 'movement',
    position: { x: 5, y: 1 },
  });
  const corner = moveField(state, 'south-west');
  assert.equal(corner.moved, false);
  assert.equal(corner.events.at(-1).reason, 'diagonal-corner');
  assert.deepEqual(corner.position, { x: 5, y: 1 });

  state = createFieldState({ levelId: 'tkm-rain-gate', beatId: 'movement-open' });
  const diagonal = moveFieldBy(state, 1, -1);
  assert.equal(diagonal.moved, true);
  assert.deepEqual(diagonal.position, { x: 3, y: 8 });
  assert.equal(getCurrentFieldContext(diagonal.state).facing, 'north-east');
  assert.throws(() => moveFieldBy(diagonal.state, 2, 0), /one non-zero eight-way step/);
  assert.throws(() => moveField(diagonal.state, 'jump'), /Unknown field direction/);
});

test('nearby authored interactions discover, consume, grant flags, and drive objectives', () => {
  let state = createFieldState({
    levelId: 'tkm-rain-gate',
    beatId: 'supply-cart',
    position: { x: 4, y: 8 },
  });
  const nearby = getNearbyInteractables(state);
  assert.deepEqual(nearby.map(({ id }) => id), ['supply-cart']);
  assert.equal(nearby[0].discovered, true);
  assert.equal(getFieldObjectiveProgress(state).completed, false);

  const result = interactField(state, 'supply-cart');
  assert.equal(result.ok, true);
  assert.equal(result.repeated, false);
  assert.ok(result.producedFlags.includes('inspect-supply-cart'));
  state = result.state;
  assert.equal(getCurrentFieldContext(state).consumedInteractableIds.includes('supply-cart'), true);
  assert.equal(getFieldObjectiveProgress(state).completed, true);

  const repeat = interactField(state, 'supply-cart');
  assert.equal(repeat.ok, true);
  assert.equal(repeat.repeated, true);
  assert.equal(repeat.state, state);
});

test('interaction requirements and explicit authored choices are enforced', () => {
  let state = createFieldState({
    levelId: 'ngi-wrecked-carrack',
    beatId: 'rescue-choice',
    position: { x: 14, y: 5 },
  });
  const required = interactField(state, 'survivor-hold');
  assert.equal(required.ok, false);
  assert.equal(required.code, 'choice-required');
  assert.deepEqual(required.choices, ['send-kiku', 'keep-kiku']);

  const chosen = interactField(state, 'survivor-hold', { choice: 'send-kiku' });
  assert.equal(chosen.ok, true);
  state = chosen.state;
  assert.equal(getFieldObjectiveProgress(state).completed, true);

  const locked = createFieldState({
    levelId: 'tkm-abandoned-chapel',
    beatId: 'locked-door',
    position: { x: 16, y: 5 },
  });
  const blocked = interactField(locked, 'rear-lock');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'requirement-missing');
  assert.equal(blocked.blockedBy, 'c2-lise-trusted-with-key');
  assert.equal(blocked.interaction.id, 'rear-lock');
  assert.equal(blocked.state, locked);
  const unlocked = interactField(locked, 'rear-lock', { flags: ['c2_lise_trusted_with_key'] });
  assert.equal(unlocked.ok, true);
});

test('placed encounter triggers are deterministic, resolvable, and once-only', () => {
  let state = createFieldState({
    levelId: 'tkm-cedar-service-path',
    beatId: 'cedar-encounter',
    position: { x: 10, y: 4 },
  });
  const entered = moveField(state, 'east');
  assert.equal(entered.moved, true);
  assert.equal(entered.events.some(({ type, encounterId }) => type === 'encounter-triggered' && encounterId === 'fp1-cedar-path'), true);
  state = entered.state;
  assert.deepEqual(getFieldStatus(state).pendingEncounters, [{ triggerId: 'cedar-path-ambush', encounterId: 'fp1-cedar-path' }]);

  const resolved = resolveFieldEncounter(state, 'fp1-cedar-path');
  assert.equal(resolved.ok, true);
  state = resolved.state;
  assert.equal(getCurrentFieldContext(state).resolvedEncounterIds.includes('fp1-cedar-path'), true);
  assert.equal(getFieldObjectiveProgress(state).completed, true);

  state = moveField(state, 'west').state;
  const reentered = moveField(state, 'east');
  assert.equal(reentered.events.some(({ type }) => type === 'encounter-triggered'), false);
});

test('delayed, conditional, and cyclic hazards emit effects on deterministic clocks', () => {
  let state = createFieldState({
    levelId: 'tkm-bell-stair',
    beatId: 'cracked-boards',
    position: { x: 6, y: 7 },
  });
  const entered = moveField(state, 'east');
  assert.equal(entered.events.some(({ type, hazardId }) => type === 'hazard-armed' && hazardId === 'cracked-boards'), true);
  state = advanceFieldTime(entered.state, 749).state;
  assert.deepEqual(getCurrentFieldContext(state).position, { x: 7, y: 7 });
  const collapse = advanceFieldTime(state, 1);
  assert.equal(collapse.events.some(({ type }) => type === 'hazard-hit'), true);
  assert.deepEqual(getCurrentFieldContext(collapse.state).position, { x: 6, y: 7 });
  assert.equal(getCurrentFieldContext(collapse.state).hazardHitCounts['cracked-boards'], 1);

  state = createFieldState({
    levelId: 'tkm-flooded-undercroft',
    beatId: 'conditional-water',
    position: { x: 6, y: 4 },
  });
  const chilled = moveField(state, 'east', { flags: ['storm strike resolved this round'] });
  assert.equal(chilled.events.some(({ type, hazardId }) => type === 'hazard-hit' && hazardId === 'storm-water-chill'), true);

  state = createFieldState({
    levelId: 'krh-bell-spine',
    beatId: 'cycle-pulse',
    position: { x: 8, y: 3 },
  });
  const warning = advanceFieldTime(state, 2250);
  assert.equal(warning.events.some(({ type }) => type === 'hazard-warning'), true);
  const pulse = advanceFieldTime(warning.state, 750);
  assert.equal(pulse.events.some(({ type }) => type === 'hazard-hit'), true);
  assert.equal(getCurrentFieldContext(pulse.state).hazardHitCounts['spine-pulse'], 1);
});

test('exit use requires exact position and authored condition', () => {
  let state = createFieldState({
    levelId: 'tkm-rain-gate',
    beatId: 'exit',
    position: { x: 18, y: 3 },
  });
  assert.equal(useFieldExit(state, 'service-path').code, 'exit-locked');

  state = createFieldState({
    levelId: 'tkm-rain-gate',
    beatId: 'exit',
    position: { x: 18, y: 3 },
    flags: ['inspect-supply-cart'],
  });
  const used = useFieldExit(state, 'service-path');
  assert.equal(used.ok, true);
  assert.deepEqual(used.transition, {
    exitId: 'service-path',
    fromLevelId: 'tkm-rain-gate',
    destinationLevelId: 'tkm-cedar-service-path',
  });
  assert.equal(used.state, state, 'transition is reported without moving story state by default');
});

test('playtime counters serialize per context and reject corrupted payloads', () => {
  let state = createFieldState({ levelId: 'tkm-rain-gate', beatId: 'clock-a' });
  state = advanceFieldTime(state, 1000).state;
  state = enterField(state, 'tkm-rain-gate', 'clock-b');
  state = advanceFieldTime(state, 250).state;
  assert.equal(state.totalPlaytimeMs, 1250);
  assert.deepEqual(state.contexts.map(({ elapsedMs }) => elapsedMs), [1000, 250]);

  const serialized = serializeFieldState(state);
  const loaded = loadFieldState(serialized);
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.value, state);
  assert.equal(Object.isFrozen(loaded.value), true);

  const tampered = JSON.parse(serialized);
  tampered.totalPlaytimeMs = 999;
  assert.equal(validateFieldPayload(tampered).ok, false);
  const badPosition = JSON.parse(serialized);
  badPosition.contexts[0].position = { x: -1, y: 2 };
  assert.equal(validateFieldPayload(badPosition).ok, false);
  assert.deepEqual(loadFieldState('{broken').errors, ['Save payload is not valid JSON.']);
});

test('storage adapter handles empty, valid, corrupt, and unavailable saves', () => {
  const storage = new MemoryStorage();
  const adapter = createFieldStorageAdapter(storage, 'field-test');
  const state = advanceFieldTime(createFieldState({ levelId: 'tkm-rain-gate', beatId: 'save' }), 100).state;

  const empty = adapter.load({ levelId: 'tkm-rain-gate', beatId: 'save' });
  assert.equal(empty.ok, true);
  assert.equal(empty.found, false);
  assert.deepEqual(adapter.save(state), { ok: true });
  assert.deepEqual(adapter.load(), { ok: true, found: true, state });
  assert.deepEqual(adapter.clear(), { ok: true });

  storage.setItem('field-test', '{bad');
  assert.equal(adapter.load().code, 'invalid-save');
  const unavailable = createFieldStorageAdapter(null);
  assert.equal(unavailable.available, false);
  assert.deepEqual(unavailable.save(state), { ok: false, code: 'storage-unavailable' });
});
