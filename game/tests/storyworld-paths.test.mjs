import assert from 'node:assert/strict';
import test from 'node:test';

import { getNarrativeRouteSchedules } from '../campaign-route-scheduler.mjs';
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

const MAX_PROJECTION_FRONTIER = 512;

function stableHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function boundedDiverseFrontier(nextByProjection) {
  const candidates = [...nextByProjection.entries()].map(([key, state]) => ({
    key,
    state,
    projection: deriveStoryworldProjection(state),
  }));
  if (candidates.length <= MAX_PROJECTION_FRONTIER) return candidates.map(({ state }) => state);
  const selected = new Map();
  const extrema = Object.fromEntries(Object.keys(candidates[0].projection).map((propertyId) => [
    propertyId,
    { minimum: candidates[0], maximum: candidates[0] },
  ]));
  for (const candidate of candidates.slice(1)) {
    for (const [propertyId, pair] of Object.entries(extrema)) {
      if (candidate.projection[propertyId] < pair.minimum.projection[propertyId]) pair.minimum = candidate;
      if (candidate.projection[propertyId] > pair.maximum.projection[propertyId]) pair.maximum = candidate;
    }
  }
  for (const { minimum, maximum } of Object.values(extrema)) {
    selected.set(minimum.key, minimum.state);
    selected.set(maximum.key, maximum.state);
  }
  for (const candidate of candidates.sort((left, right) => stableHash(left.key) - stableHash(right.key))) {
    if (selected.size >= MAX_PROJECTION_FRONTIER) break;
    selected.set(candidate.key, candidate.state);
  }
  return [...selected.values()];
}

test('bounded selected-route path union reaches every consequence scene and history-sensitive reaction', () => {
  const reachedOutcomes = new Map(STORYWORLD_CLUSTERS.map(({ id }) => [id, new Set()]));
  const reactionsByOption = new Map();
  const finalProjections = new Set();
  let prideReversalTransitions = 0;
  const clusterById = new Map(STORYWORLD_CLUSTERS.map((cluster) => [cluster.id, cluster]));
  const warTableOptionIndex = { salt: 0, ash: 1, paper: 2 };
  for (const schedule of getNarrativeRouteSchedules()) {
    let frontier = [createStoryworldState({ runId: `storyworld-path-${schedule.priorityTheater}` })];
    for (const clusterId of schedule.storyworldDecisionIds) {
      const cluster = clusterById.get(clusterId);
      const options = clusterId === 'sw3-sayos-warehouse-conditions'
        ? [cluster.entry.options[warTableOptionIndex[schedule.priorityTheater]]]
        : cluster.entry.options;
      const nextByProjection = new Map();
      for (const state of frontier) {
        for (const option of options) {
          const projectionBefore = deriveStoryworldProjection(state);
          const resolved = resolveOne(state, cluster, option);
          if (resolved.entryReactionId.endsWith('_r_confession-reversal')) {
            const projectionAfter = deriveStoryworldProjection(resolved.state);
            assert.equal(
              projectionAfter.kurozane_pride,
              Math.round((1 - projectionBefore.kurozane_pride) * 10_000) / 10_000,
            );
            prideReversalTransitions += 1;
          }
          reachedOutcomes.get(cluster.id).add(resolved.outcomeId);
          const reactionKey = `${cluster.id}:${option.id}`;
          const reactions = reactionsByOption.get(reactionKey) ?? new Set();
          reactions.add(resolved.entryReactionId);
          reactionsByOption.set(reactionKey, reactions);
          const key = projectionKey(resolved.state);
          if (!nextByProjection.has(key)) nextByProjection.set(key, resolved.state);
        }
      }
      frontier = boundedDiverseFrontier(nextByProjection);
      assert.ok(frontier.length > 0, `${schedule.priorityTheater}:${cluster.id}`);
    }
    frontier.forEach((state) => finalProjections.add(projectionKey(state)));
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
  assert.ok(prideReversalTransitions > 0, 'The bounded route union never reached Kurozane’s pride reversal.');
  assert.ok(finalProjections.size >= 3, `Only ${finalProjections.size} materially distinct final projections survived.`);
});
