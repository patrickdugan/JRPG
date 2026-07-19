import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const campaignSource = await readFile(new URL('../campaign.js', import.meta.url), 'utf8');
const campaignHtml = await readFile(new URL('../campaign.html', import.meta.url), 'utf8');

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
  assert.match(campaignSource, /commitStateChanges\('Scene operation',[\s\S]*?adapter: sceneOperationAdapter[\s\S]*?nextState: result\.state/);
});

test('the rendered map publishes read-only exact route coordinates for control-only QA', () => {
  assert.match(campaignHtml, /id="mapCanvas"[^>]*data-coordinate-space="zero-based-grid"[^>]*data-field-state="loading"/);
  assert.match(campaignSource, /mapCanvas\.dataset\.beatId = getBeat\(\)\.id/);
  assert.match(campaignSource, /mapCanvas\.dataset\.levelId = level\.id/);
  assert.match(campaignSource, /mapCanvas\.dataset\.fieldX = String\(status\.position\.x\)/);
  assert.match(campaignSource, /mapCanvas\.dataset\.fieldY = String\(status\.position\.y\)/);
  assert.match(campaignSource, /mapCanvas\.dataset\.fieldState = sceneOperationMarker/);
  assert.match(campaignSource, /mapCanvas\.dataset\.storyOperationNodeId = sceneOperationMarker\.node\.id/);
  assert.match(campaignSource, /mapCanvas\.dataset\.storyOperationX = String\(sceneOperationMarker\.position\.x\)/);
  assert.match(campaignSource, /mapCanvas\.dataset\.storyOperationY = String\(sceneOperationMarker\.position\.y\)/);
  assert.match(campaignSource, /delete mapCanvas\.dataset\.storyOperationNodeId/);
});

test('the rendered map publishes and clears stable witness and side-story markers', () => {
  assert.match(campaignSource, /const routeMarker = witnessMarker\?\.position/);
  assert.match(campaignSource, /type: 'witness-chronicle'/);
  assert.match(campaignSource, /type: 'side-story'/);
  assert.match(campaignSource, /mapCanvas\.dataset\.routeMarkerType = routeMarker\.type/);
  assert.match(campaignSource, /mapCanvas\.dataset\.routeMarkerId = routeMarker\.id/);
  assert.match(campaignSource, /mapCanvas\.dataset\.routeMarkerOwnerId = routeMarker\.ownerId/);
  assert.match(campaignSource, /mapCanvas\.dataset\.routeMarkerX = String\(routeMarker\.position\.x\)/);
  assert.match(campaignSource, /mapCanvas\.dataset\.routeMarkerY = String\(routeMarker\.position\.y\)/);
  for (const field of ['routeMarkerType', 'routeMarkerId', 'routeMarkerOwnerId', 'routeMarkerX', 'routeMarkerY']) {
    assert.match(campaignSource, new RegExp(`delete mapCanvas\\.dataset\\.${field}`));
  }
});

test('the rendered map publishes the next incomplete field interaction or ready exit', () => {
  assert.match(campaignSource, /unfinishedFieldRequirement = status\.objective\.requirements\.find/);
  assert.match(campaignSource, /unfinishedFieldRequirement\?\.type === 'interaction'/);
  assert.match(campaignSource, /missingInteractablePrerequisite = requiredInteractable\?\.requires/);
  assert.match(campaignSource, /find\(\(item\) => item\.id === requiredInteractable\.requires\)/);
  assert.match(campaignSource, /status\.objective\.exits\.find\(\(exit\) => exit\.ready\)/);
  assert.match(campaignSource, /type: 'interaction'/);
  assert.match(campaignSource, /type: 'route-exit'/);
  for (const field of ['Type', 'Id', 'X', 'Y', 'Range']) {
    assert.match(campaignSource, new RegExp(`mapCanvas\\.dataset\\.fieldObjectiveTarget${field}`));
    assert.match(campaignSource, new RegExp(`delete mapCanvas\\.dataset\\.fieldObjectiveTarget${field}`));
  }
});

test('dashboard and field action share ready-exit interaction priority', () => {
  assert.match(campaignSource, /from '\.\/field-interaction-priority\.mjs'/);
  assert.match(campaignSource, /const authored = selectNearbyFieldInteractable\(status\)/);
  assert.match(campaignSource, /const nearby = selectNearbyFieldInteractable\(status\)/);
});

test('unfinished story operations cannot be abandoned through a route exit', () => {
  assert.match(campaignSource, /fieldRuntimeState\.current\.beatId === beat\.id && !currentSceneOperationComplete\(beat\)/);
  assert.match(campaignSource, /ordered scene operation must be completed before leaving/);
});

test('accepting a side story refreshes its rendered field marker before restoring feedback', () => {
  const acceptance = campaignSource.slice(
    campaignSource.indexOf("commitStateChanges('Side-story acceptance'"),
    campaignSource.indexOf("routeDueList.addEventListener('click'"),
  );
  const renderIndex = acceptance.indexOf('render();');
  const feedbackIndex = acceptance.indexOf('fieldFeedback.textContent = `Side story accepted:');
  assert.ok(renderIndex >= 0 && feedbackIndex > renderIndex);
  assert.doesNotMatch(acceptance, /renderQuestJournal\(getChapter\(\)\)/);
});

test('New Game and browser lifecycle clear, reload, and persist operation state', () => {
  assert.match(campaignSource, /const nextSceneOperationState = createSceneOperationState\(\)/);
  assert.match(campaignSource, /commitStateChanges\('New Game',[\s\S]*?adapter: sceneOperationAdapter[\s\S]*?nextState: nextSceneOperationState/);
  assert.match(campaignSource, /const refreshedSceneOperations = sceneOperationAdapter\.load\(\)/);
  const saveCalls = campaignSource.match(/sceneOperationAdapter\.save\(sceneOperationState\)/g) ?? [];
  assert.ok(saveCalls.length >= 2, 'pagehide and visibility remain explicit best-effort lifecycle saves');
});
