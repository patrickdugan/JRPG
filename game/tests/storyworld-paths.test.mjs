import assert from 'node:assert/strict';
import test from 'node:test';

import { STORYWORLD_CLUSTERS } from '../content/storyworld-encounters.generated.mjs';
import {
  advanceStoryworldEncounter,
  beginStoryworldEncounter,
  chooseStoryworldOption,
  createStoryworldState,
  deriveStoryworldProjection,
  getStoryworldProgress,
  getVisibleStoryworldOptions,
} from '../storyworld-runtime.mjs';

function resolveOne(state, cluster, option) {
  state = beginStoryworldEncounter(state, cluster.id).state;
  const entryResult = chooseStoryworldOption(state, cluster.id, option.id);
  assert.equal(entryResult.ok, true, entryResult.code);
  const entryReactionId = entryResult.reaction.id;
  state = advanceStoryworldEncounter(entryResult.state, cluster.id).state;
  const outcomeId = getStoryworldProgress(state, cluster.id).outcome.id;
  const outcomeOptions = getVisibleStoryworldOptions(state, cluster.id);
  if (outcomeOptions.length) {
    state = chooseStoryworldOption(state, cluster.id, outcomeOptions[0].id).state;
  }
  state = advanceStoryworldEncounter(state, cluster.id).state;
  return { state, entryReactionId, outcomeId };
}

function projectionKey(state) {
  return JSON.stringify(deriveStoryworldProjection(state));
}

test('bounded path union reaches both consequence scenes in every cluster and changes reactions to identical options', () => {
  let frontier = [createStoryworldState({ runId: 'storyworld-path-root' })];
  const reachedOutcomes = new Map(STORYWORLD_CLUSTERS.map(({ id }) => [id, new Set()]));
  const reactionsByOption = new Map();
  for (const cluster of STORYWORLD_CLUSTERS) {
    const nextByProjection = new Map();
    for (const state of frontier) {
      for (const option of cluster.entry.options) {
        const resolved = resolveOne(state, cluster, option);
        reachedOutcomes.get(cluster.id).add(resolved.outcomeId);
        const reactionKey = `${cluster.id}:${option.id}`;
        const reactions = reactionsByOption.get(reactionKey) ?? new Set();
        reactions.add(resolved.entryReactionId);
        reactionsByOption.set(reactionKey, reactions);
        const key = projectionKey(resolved.state);
        if (!nextByProjection.has(key)) nextByProjection.set(key, resolved.state);
      }
    }
    frontier = [...nextByProjection.values()];
    assert.ok(frontier.length > 0, cluster.id);
  }
  for (const cluster of STORYWORLD_CLUSTERS) {
    assert.deepEqual(
      [...reachedOutcomes.get(cluster.id)].sort(),
      cluster.outcomes.map(({ id }) => id).sort(),
      `${cluster.id} must expose both authored consequence scenes across the path union`,
    );
  }
  const historySensitive = [...reactionsByOption.values()].filter((reactions) => reactions.size > 1);
  assert.ok(historySensitive.length >= 3, `Only ${historySensitive.length} options changed reaction across histories.`);
  assert.ok(frontier.length >= 3, `Only ${frontier.length} materially distinct final projections survived.`);
});
