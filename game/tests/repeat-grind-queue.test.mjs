import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAdvancementState,
  createAdvancementStorageAdapter,
  getEncounterWinCount,
  getEncounterRewardPreview,
  recordEncounterWin,
} from '../advancement.mjs';
import { benchmarkRepeatBattleSpeeds } from '../repeat-battle.mjs';
import {
  cancelRepeatGrindQueue,
  createRepeatGrindQueue,
  recordRepeatGrindVictory,
  REPEAT_GRIND_QUEUE_OPTIONS,
  startRepeatGrindQueue,
} from '../repeat-grind-queue.mjs';

const ENCOUNTER_ID = 'c1-cinder-hounds';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('repeat queues are finite, immutable, and restricted to the player-facing 1/5/10 choices', () => {
  assert.deepEqual(REPEAT_GRIND_QUEUE_OPTIONS, [1, 5, 10]);
  assert.equal(Object.isFrozen(REPEAT_GRIND_QUEUE_OPTIONS), true);
  assert.deepEqual(createRepeatGrindQueue(), {
    plannedWins: 1,
    completedWins: 0,
    active: false,
    cancelled: false,
  });
  assert.throws(() => createRepeatGrindQueue(0), /must be one of 1, 5, 10/);
  assert.throws(() => createRepeatGrindQueue(4), /must be one of 1, 5, 10/);
});

test('a five-win queue advances once per durable victory and stops exactly at its bound', () => {
  let queue = startRepeatGrindQueue(createRepeatGrindQueue(5));
  for (let completed = 1; completed <= 5; completed += 1) {
    const result = recordRepeatGrindVictory(queue);
    queue = result.state;
    assert.equal(queue.completedWins, completed);
    assert.equal(result.shouldContinue, completed < 5);
    assert.equal(result.complete, completed === 5);
  }
  assert.deepEqual(queue, {
    plannedWins: 5,
    completedWins: 5,
    active: false,
    cancelled: false,
  });
  assert.throws(() => recordRepeatGrindVictory(queue), /active grind queue/);
  assert.throws(() => startRepeatGrindQueue(queue), /cannot be restarted/);
});

test('cancellation preserves the saved count and a reload begins with no active queue', () => {
  let queue = startRepeatGrindQueue(createRepeatGrindQueue(10));
  queue = recordRepeatGrindVictory(queue).state;
  queue = recordRepeatGrindVictory(queue).state;
  queue = cancelRepeatGrindQueue(queue);
  assert.deepEqual(queue, {
    plannedWins: 10,
    completedWins: 2,
    active: false,
    cancelled: true,
  });
  assert.equal(cancelRepeatGrindQueue(queue), queue);
  assert.deepEqual(createRepeatGrindQueue(), {
    plannedWins: 1,
    completedWins: 0,
    active: false,
    cancelled: false,
  });
});

test('five queued repeat rewards persist independently while 1x/2x/4x schedules remain exact', () => {
  const storage = new MemoryStorage();
  const adapter = createAdvancementStorageAdapter(storage, 'queued-repeat-test');
  let advancement = recordEncounterWin(createAdvancementState(), ENCOUNTER_ID);
  assert.deepEqual(adapter.save(advancement), { ok: true });
  let queue = startRepeatGrindQueue(createRepeatGrindQueue(5));
  const scheduledMs = { 1: 0, 2: 0, 4: 0 };

  while (queue.active) {
    const priorWins = getEncounterWinCount(advancement, ENCOUNTER_ID);
    const benchmark = benchmarkRepeatBattleSpeeds({ encounterId: ENCOUNTER_ID, priorWins });
    assert.equal(benchmark.verified, true);
    assert.deepEqual(benchmark.runs[0].reward, getEncounterRewardPreview(ENCOUNTER_ID, priorWins));
    for (const run of benchmark.runs) scheduledMs[run.speedMultiplier] += run.simulatedDurationMs;

    advancement = recordEncounterWin(advancement, ENCOUNTER_ID);
    assert.deepEqual(adapter.save(advancement), { ok: true });
    const reloaded = adapter.load();
    assert.equal(reloaded.ok, true);
    assert.equal(reloaded.found, true);
    assert.deepEqual(reloaded.state, advancement);
    queue = recordRepeatGrindVictory(queue).state;
  }

  assert.equal(getEncounterWinCount(advancement, ENCOUNTER_ID), 6);
  assert.equal(queue.completedWins, 5);
  assert.equal(scheduledMs[1], scheduledMs[2] * 2);
  assert.equal(scheduledMs[1], scheduledMs[4] * 4);
});
