import assert from 'node:assert/strict';
import test from 'node:test';

import { createArchiveRecordState, createArchiveRecordStorageAdapter } from '../archive-record-runtime.mjs';
import { getDefaultBrowserStorage } from '../browser-storage.mjs';
import { createCampConversationState, createCampConversationStorageAdapter } from '../camp-conversation-runtime.mjs';
import { createLoadoutState, createLoadoutStorageAdapter } from '../loadout.mjs';
import { createNarrativeState, createNarrativeStorageAdapter } from '../narrative-runtime.mjs';
import { createPartyCouncilState, createPartyCouncilStorageAdapter } from '../party-council-runtime.mjs';
import { createPlaytimeState, createPlaytimeStorageAdapter } from '../playtime.mjs';
import { createQuestState, createQuestStorageAdapter } from '../quest-runtime.mjs';
import { createSceneOperationState, createSceneOperationStorageAdapter } from '../scene-operation-runtime.mjs';
import { createWitnessChronicleState, createWitnessChronicleStorageAdapter } from '../witness-chronicle-runtime.mjs';

test('a denied localStorage getter resolves to a non-crashing unavailable store', () => {
  const deniedScope = Object.defineProperty({}, 'localStorage', {
    get() {
      throw new Error('SecurityError');
    },
  });
  const storage = getDefaultBrowserStorage(deniedScope);
  assert.equal(storage.getItem('save'), null);
  assert.throws(() => storage.setItem('save', '{}'), /unavailable/);
  assert.throws(() => storage.removeItem('save'), /unavailable/);
});
test('the default browser adapters initialize and report failed writes when storage is absent', async (t) => {
  const cases = [
    ['loadout', createLoadoutStorageAdapter, createLoadoutState],
    ['narrative', createNarrativeStorageAdapter, createNarrativeState],
    ['playtime', createPlaytimeStorageAdapter, createPlaytimeState],
    ['quest', createQuestStorageAdapter, createQuestState],
    ['witness chronicle', createWitnessChronicleStorageAdapter, createWitnessChronicleState],
    ['scene operation', createSceneOperationStorageAdapter, createSceneOperationState],
    ['camp conversation', createCampConversationStorageAdapter, createCampConversationState],
    ['party council', createPartyCouncilStorageAdapter, createPartyCouncilState],
    ['archive record', createArchiveRecordStorageAdapter, createArchiveRecordState],
  ];

  for (const [label, createAdapter, createState] of cases) {
    await t.test(label, () => {
      const adapter = createAdapter();
      const loaded = adapter.load();
      assert.equal(loaded.ok, true, `${label} should fall back to a fresh readable state`);
      assert.ok(loaded.state ?? loaded.value, `${label} should expose its fresh state`);
      assert.equal(adapter.save(createState()).ok, false, `${label} must not claim an unavailable write succeeded`);
    });
  }
});
