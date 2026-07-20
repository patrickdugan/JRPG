import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  STORYWORLD_CLUSTERS,
} from '../content/storyworld-encounters.generated.mjs';
import {
  advanceStoryworldEncounter,
  beginStoryworldEncounter,
  chooseStoryworldOption,
  createStoryworldState,
  createStoryworldStorageAdapter,
  getStoryworldProgress,
} from '../storyworld-runtime.mjs';
import {
  STORYWORLD_BATTLE_PRESENTATION_SCHEMA_VERSION,
  getStoryworldBattlePresentation,
  loadStoryworldBattlePresentation,
} from '../storyworld-battle-bridge.mjs';

const runId = 'storyworld-battle-bridge-run';

function completeCluster(cluster) {
  let state = createStoryworldState({ runId });
  state = beginStoryworldEncounter(state, cluster.id).state;
  const entryProgress = getStoryworldProgress(state, cluster.id);
  state = chooseStoryworldOption(state, cluster.id, entryProgress.cluster.entry.options[0].id).state;
  state = advanceStoryworldEncounter(state, cluster.id).state;
  const outcomeProgress = getStoryworldProgress(state, cluster.id);
  if (!outcomeProgress.outcome.terminal) {
    state = chooseStoryworldOption(state, cluster.id, outcomeProgress.outcome.options[0].id).state;
  }
  state = advanceStoryworldEncounter(state, cluster.id).state;
  return state;
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('completed pre-boss decisions create a bounded presentation with no combat authority', () => {
  const cluster = STORYWORLD_CLUSTERS.find(({ sequenceRole }) => sequenceRole === 'before-boss-decision');
  const encounterId = cluster.relatedEncounterIds[0];
  const state = completeCluster(cluster);
  const presentation = getStoryworldBattlePresentation({ encounterId, storyworldState: state, runId });

  assert.deepEqual(Object.keys(presentation), [
    'schemaVersion',
    'encounterId',
    'clusterId',
    'sequenceRole',
    'eyebrow',
    'title',
    'decisionText',
    'consequenceText',
  ]);
  assert.equal(presentation.schemaVersion, STORYWORLD_BATTLE_PRESENTATION_SCHEMA_VERSION);
  assert.equal(presentation.eyebrow, 'Decision carried into encounter');
  assert.equal(presentation.clusterId, cluster.id);
  assert.equal(Object.isFrozen(presentation), true);
  assert.equal('effects' in presentation, false);
  assert.equal('stats' in presentation, false);
  assert.equal('modifiers' in presentation, false);
});
test('completed after-boss records are clearly presented as recorded aftermath on replay', () => {
  const cluster = STORYWORLD_CLUSTERS.find(({ sequenceRole }) => sequenceRole === 'after-boss-consequence');
  const encounterId = cluster.relatedEncounterIds[0];
  const presentation = getStoryworldBattlePresentation({
    encounterId,
    storyworldState: completeCluster(cluster),
    runId,
  });

  assert.equal(presentation.eyebrow, 'Recorded aftermath');
  assert.equal(presentation.sequenceRole, 'after-boss-consequence');
  assert.ok(presentation.decisionText.length > 0);
  assert.ok(presentation.consequenceText.length > 0);
});

test('bridge rejects incomplete, unrelated, invalid, and cross-run state', () => {
  const cluster = STORYWORLD_CLUSTERS.find(({ sequenceRole }) => sequenceRole === 'before-boss-decision');
  const encounterId = cluster.relatedEncounterIds[0];
  const incomplete = beginStoryworldEncounter(createStoryworldState({ runId }), cluster.id).state;
  const complete = completeCluster(cluster);

  assert.equal(getStoryworldBattlePresentation({ encounterId, storyworldState: incomplete, runId }), null);
  assert.equal(getStoryworldBattlePresentation({ encounterId: 'unrelated-encounter', storyworldState: complete, runId }), null);
  assert.equal(getStoryworldBattlePresentation({ encounterId, storyworldState: complete, runId: 'another-run' }), null);
  assert.equal(getStoryworldBattlePresentation({ encounterId, storyworldState: { ...complete, revision: 999 }, runId }), null);
  assert.equal(getStoryworldBattlePresentation({ encounterId, storyworldState: complete }), null);
});

test('storage bridge uses the strict save adapter and the current run id', () => {
  const cluster = STORYWORLD_CLUSTERS.find(({ sequenceRole }) => sequenceRole === 'before-boss-decision');
  const encounterId = cluster.relatedEncounterIds[0];
  const state = completeCluster(cluster);
  const storage = memoryStorage();
  assert.equal(createStoryworldStorageAdapter(storage).save(state).ok, true);

  assert.equal(loadStoryworldBattlePresentation({ encounterId, runId, storage }).clusterId, cluster.id);
  assert.equal(loadStoryworldBattlePresentation({ encounterId, runId: 'stale-run', storage }), null);
});

test('every related encounter has one deterministic Storyworld owner', () => {
  const relatedIds = STORYWORLD_CLUSTERS.flatMap(({ relatedEncounterIds }) => relatedEncounterIds);
  assert.ok(relatedIds.length > 0);
  assert.equal(new Set(relatedIds).size, relatedIds.length);
});

test('battle page renders Storyworld context as an optional briefing card', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('../battle.html', import.meta.url), 'utf8'),
    readFile(new URL('../battle.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="storyworldContextCard"[^>]*hidden/);
  assert.match(html, /id="storyworldContextTitle"/);
  assert.match(html, /id="storyworldContextDecision"/);
  assert.match(html, /id="storyworldContextConsequence"/);
  assert.match(script, /loadStoryworldBattlePresentation/);
  assert.match(script, /renderStoryworldBattleContext/);
});
