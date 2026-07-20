import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const campaignSource = await readFile(new URL('../campaign.js', import.meta.url), 'utf8');

test('Campaign loads the NPC atlas with a published ready/error state', () => {
  assert.match(campaignSource, /from '\.\/npc-field-atlas\.mjs'/u);
  assert.match(campaignSource, /const npcFieldAtlasImage = new Image\(\)/u);
  assert.match(campaignSource, /mapCanvas\.dataset\.npcArtState = npcFieldAtlasState/u);
  assert.match(campaignSource, /npcFieldAtlasImageHasExpectedSize\(npcFieldAtlasImage\)/u);
  assert.match(campaignSource, /npcFieldAtlasImage\.src = NPC_FIELD_ATLAS\.url/u);
});

test('only exact marker metadata is sent to the NPC resolver', () => {
  assert.match(campaignSource, /markerType: 'scene-operation',[\s\S]*?activityType: sceneOperationMarker\.node\.activityType/u);
  assert.match(campaignSource, /markerType: 'side-story',[\s\S]*?objectiveType: questMarker\.objective\.type/u);
  assert.doesNotMatch(campaignSource, /markerType: 'witness-chronicle'/u,
    'the current witness fieldwork catalogue exposes no metadata-proven person node');
});

test('person sprites preserve operation order and every geometric fallback', () => {
  assert.match(campaignSource, /drawNpcFieldMarker\(role, px, py, cell, \{ badge: sceneOperationMarker\.nodeIndex \+ 1 \}\)/u);
  assert.match(campaignSource, /if \(!drawNpcFieldMarker\(role, px, py, cell/u);
  assert.match(campaignSource, /mapCtx\.strokeRect\(px - cell \* 0\.28/u);
  assert.match(campaignSource, /mapCtx\.moveTo\(px, py - cell \* 0\.28\)/u);
  assert.match(campaignSource, /mapCtx\.arc\(px, py, cell \* 0\.24/u);
  assert.match(campaignSource, /npcFieldAtlasState !== 'ready'/u);
});

test('enemy tokens and party sprite paths remain separate from the NPC atlas', () => {
  const enemyStart = campaignSource.indexOf('const enemyTokens =');
  const partyStart = campaignSource.indexOf('const partyPosition =', enemyStart);
  assert.ok(enemyStart > 0 && partyStart > enemyStart);
  assert.doesNotMatch(campaignSource.slice(enemyStart, partyStart), /npcField/u);
  assert.match(campaignSource.slice(partyStart), /getPartyAtlasFieldPoseFrame|getPartyAtlasFrame/u);
});
