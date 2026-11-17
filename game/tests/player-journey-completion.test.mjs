import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  PLAYER_JOURNEY_STORAGE_KEY,
  canFinishJourney,
  createPlayerJourneyRecord,
  createPlayerJourneyStorageAdapter,
  isJourneyFinished,
  validatePlayerJourneyRecord,
} from '../player-journey-completion.mjs';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

test('only the active-play floor may be waived, and only for players', () => {
  const base = { developerMode: false, narrativeRun: true, storyComplete: true };
  assert.equal(canFinishJourney({ ...base, gateReasons: ['active-playtime-incomplete'] }), true);
  assert.equal(canFinishJourney({ ...base, developerMode: true, gateReasons: ['active-playtime-incomplete'] }), false,
    'developer mode keeps the strict proof gate');
  assert.equal(canFinishJourney({ ...base, storyComplete: false, gateReasons: ['active-playtime-incomplete'] }), false);
  assert.equal(canFinishJourney({ ...base, narrativeRun: false, gateReasons: ['active-playtime-incomplete'] }), false);
  assert.equal(canFinishJourney({ ...base, gateReasons: ['active-playtime-incomplete', 'storyworld-incomplete'] }), false,
    'any other missing condition still blocks');
  assert.equal(canFinishJourney({ ...base, gateReasons: [] }), false, 'a ready proof seals normally instead');
});

test('journey records round-trip through storage and bind to their run', () => {
  const storage = memoryStorage();
  const adapter = createPlayerJourneyStorageAdapter(storage);
  assert.deepEqual(adapter.load(), { ok: true, found: false, record: null });
  const record = createPlayerJourneyRecord('run-1', 860_000, new Date('2026-11-17T12:00:00Z'));
  assert.equal(adapter.save(record).ok, true);
  const loaded = adapter.load();
  assert.equal(loaded.found, true);
  assert.equal(loaded.record.activeMs, 860_000);
  assert.equal(isJourneyFinished(loaded.record, 'run-1'), true);
  assert.equal(isJourneyFinished(loaded.record, 'run-2'), false, 'a New Game run is not finished by an old record');
  storage.setItem(PLAYER_JOURNEY_STORAGE_KEY, '{"schemaVersion":1}');
  assert.equal(adapter.load().ok, false);
  assert.equal(validatePlayerJourneyRecord({ ...record, activeMs: -1 }).ok, false);
});

test('the credits page offers the journey finish without sealing the proof receipt', async () => {
  const source = await readFile(new URL('../credits.js', import.meta.url), 'utf8');
  const finish = source.slice(source.indexOf('canFinishJourney({\n      developerMode,\n      narrativeRun: true'));
  const branch = finish.slice(0, finish.indexOf('if (!gate.ready) {'));
  assert.match(branch, /journeyAdapter\.save\(createPlayerJourneyRecord/u);
  assert.doesNotMatch(branch, /completeRunCredits/u, 'the journey finish never seals the clean-run receipt');
  assert.match(source, /sealCredits\.textContent = 'Finish the journey'/u);
  assert.match(source, /creditsStatus\.dataset\.state = 'journey-complete'/u);
});
