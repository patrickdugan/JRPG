import test from 'node:test';
import assert from 'node:assert/strict';

import { ALL_OPTIONAL_QUESTS } from '../content/sidequests.mjs';
import {
  acceptQuest,
  advanceQuestObjective,
  completeQuest,
  createQuestState,
  getQuestProgress,
  loadQuestState,
  serializeQuestState,
  validateQuestPayload,
} from '../quest-runtime.mjs';

function openContext(quest) {
  return {
    campaignState: {
      completedBeatIds: quest.prerequisites?.opensAfterBeatId ? [quest.prerequisites.opensAfterBeatId] : [],
      flags: quest.prerequisites?.campaignFlags ?? [],
    },
    advancementState: {
      encounterWins: Object.fromEntries((quest.prerequisites?.encounterIds ?? []).map((id) => [id, 1])),
    },
  };
}

test('a fresh optional-quest ledger is immutable and round-trips', () => {
  const state = createQuestState();
  assert.ok(Object.isFrozen(state));
  const loaded = loadQuestState(serializeQuestState(state));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state, state);
});

test('an available quest advances only in authored objective order', () => {
  const quest = ALL_OPTIONAL_QUESTS.find((entry) => !(entry.prerequisites?.questIds?.length)) ?? ALL_OPTIONAL_QUESTS[0];
  let state = createQuestState();
  const accepted = acceptQuest(state, quest.id, openContext(quest));
  assert.equal(accepted.ok, true, accepted.reason);
  state = accepted.state;
  for (let index = 0; index < quest.objectives.length; index += 1) {
    const id = quest.objectives[index].id ?? `objective-${index + 1}`;
    const result = advanceQuestObjective(state, quest.id, id);
    assert.equal(result.ok, true, result.reason);
    state = result.state;
  }
  assert.equal(getQuestProgress(state, quest.id).readyToComplete, true);
  const completed = completeQuest(state, quest.id);
  assert.equal(completed.ok, true, completed.reason);
  assert.equal(completed.progress.completions, 1);
  assert.ok(completed.reward);
});

test('quest saves reject unknown IDs and out-of-range objective indexes', () => {
  const state = JSON.parse(serializeQuestState(createQuestState()));
  state.records.push({ id: 'not-canonical', status: 'active', objectiveIndex: 999, completions: 0 });
  const validation = validateQuestPayload(state);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(' '), /unknown quest ID|objectiveIndex/);
});
