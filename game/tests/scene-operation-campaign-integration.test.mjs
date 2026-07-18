import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const campaignSource = await readFile(new URL('../campaign.js', import.meta.url), 'utf8');

test('campaign loads, renders, and gates all canonical scene operations', () => {
  assert.match(campaignSource, /from '\.\/content\/scene-operations\.mjs'/);
  assert.match(campaignSource, /from '\.\/scene-operation-runtime\.mjs'/);
  assert.match(campaignSource, /createSceneOperationStorageAdapter\(\)/);
  assert.match(campaignSource, /getActiveSceneOperationMarker\(level/);
  assert.match(campaignSource, /currentSceneOperationComplete\(beat\)/);
  assert.match(campaignSource, /!operationCleared/);
  assert.match(campaignSource, /Complete the scene operation/);
});

test('operation interaction requires the exact node tile and explicit encounter-win evidence', () => {
  assert.match(campaignSource, /onExactFieldPosition\(fieldPosition\(\), sceneOperationMarker\.position\)/);
  assert.match(campaignSource, /advanceSceneOperation\([\s\S]*?sceneOperationMarker\.node\.id[\s\S]*?encounterWins: advancementState\.encounterWins/);
  assert.match(campaignSource, /result\.code === 'encounter-victory-required'/);
  assert.match(campaignSource, /sceneOperation: beat\.id/);
  assert.match(campaignSource, /sceneOperationNode: sceneOperationMarker\.node\.id/);
  assert.match(campaignSource, /sceneOperationAdapter\.save\(sceneOperationState\)/);
});

test('unfinished story operations cannot be abandoned through a route exit', () => {
  assert.match(campaignSource, /fieldRuntimeState\.current\.beatId === beat\.id && !currentSceneOperationComplete\(beat\)/);
  assert.match(campaignSource, /ordered scene operation must be completed before leaving/);
});

test('New Game and browser lifecycle clear, reload, and persist operation state', () => {
  assert.match(campaignSource, /sceneOperationState = createSceneOperationState\(\)/);
  assert.match(campaignSource, /sceneOperationAdapter\.clear\(\)/);
  assert.match(campaignSource, /const refreshedSceneOperations = sceneOperationAdapter\.load\(\)/);
  const saveCalls = campaignSource.match(/sceneOperationAdapter\.save\(sceneOperationState\)/g) ?? [];
  assert.ok(saveCalls.length >= 4, 'interaction, handoff, pagehide, and visibility saves are required');
});
