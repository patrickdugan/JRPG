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

test('Campaign loads the enemy field atlas and retains a geometric fallback', () => {
  assert.match(campaignSource, /from '\.\/combat-character-field-atlas\.mjs'/u);
  assert.match(campaignSource, /const enemyFieldAtlasImage = new Image\(\)/u);
  assert.match(campaignSource, /mapCanvas\.dataset\.enemyArtState = enemyFieldAtlasState/u);
  assert.match(campaignSource, /combatCharacterFieldImageHasExpectedSize\(enemyFieldAtlasImage\)/u);
  assert.match(campaignSource, /enemyFieldAtlasImage\.src = COMBAT_CHARACTER_FIELD_ATLAS\.url/u);
  assert.match(campaignSource, /if \(!drawEnemyFieldMarker\(enemy, position, partyPosition/u);
});

test('only exact marker metadata is sent to the NPC resolver', () => {
  assert.match(campaignSource, /markerType: 'scene-operation',[\s\S]*?activityType: sceneOperationMarker\.node\.activityType/u);
  assert.match(campaignSource, /markerType: 'side-story',[\s\S]*?objectiveType: questMarker\.objective\.type,[\s\S]*?targetKind: questMarker\.objective\.targetKind/u);
  assert.match(campaignSource, /presentationRole: questMarker\.objective\.presentationRole/u);
  assert.doesNotMatch(campaignSource, /markerType: 'witness-chronicle'/u,
    'the current witness fieldwork catalogue exposes no metadata-proven person node');
});

test('level field characters use a dedicated metadata-only render pass', () => {
  assert.match(campaignSource, /resolveFieldCharacterPresentation\(interactable\.fieldCharacter\)/u);
  assert.match(campaignSource, /drawLevelFieldCharacters\(level, originX, originY, cell\)/u);
  assert.match(campaignSource, /presentation\.kind === 'npc'[\s\S]*?drawNpcFieldMarker\(presentation\.role/u);
  assert.match(campaignSource, /drawPartyFieldCharacterMarker\(presentation/u);
  assert.match(campaignSource, /if \(!drawn\) drawFieldCharacterFallback\(presentation/u);
  const passStart = campaignSource.indexOf('function drawLevelFieldCharacters');
  const passEnd = campaignSource.indexOf('function drawPartyFieldFollowerMarker', passStart);
  const pass = campaignSource.slice(passStart, passEnd);
  assert.doesNotMatch(pass, /\.id|\.action|\.label|\.result|\.text/u,
    'level character presentation must never infer from interactable identity or prose');
});

test('person sprites preserve operation order and every geometric fallback', () => {
  assert.match(campaignSource, /Math\.floor\(performance\.now\(\) \/ 900\)[\s\S]*?'south-gesture'/u);
  assert.match(campaignSource, /reducedMotion\.matches[\s\S]*?'south-idle'/u);
  assert.match(campaignSource, /drawNpcFieldMarker\(role, px, py, cell, \{ badge: sceneOperationMarker\.nodeIndex \+ 1 \}\)/u);
  assert.match(campaignSource, /if \(!drawNpcFieldMarker\(role, px, py, cell/u);
  assert.match(campaignSource, /mapCtx\.strokeRect\(px - cell \* 0\.28/u);
  assert.match(campaignSource, /mapCtx\.moveTo\(px, py - cell \* 0\.28\)/u);
  assert.match(campaignSource, /mapCtx\.arc\(px, py, cell \* 0\.24/u);
  assert.match(campaignSource, /npcFieldAtlasState !== 'ready'/u);
});

test('enemy tokens and party sprite paths remain separate from the NPC atlas', () => {
  const mapStart = campaignSource.indexOf('function drawMap');
  const partyPositionStart = campaignSource.indexOf('const partyPosition =', mapStart);
  const enemyStart = campaignSource.indexOf('const enemyTokens =', partyPositionStart);
  const partySpriteStart = campaignSource.indexOf('const fieldLeaderId =', enemyStart);
  assert.ok(mapStart > 0 && partyPositionStart > mapStart && enemyStart > partyPositionStart);
  assert.ok(partySpriteStart > enemyStart);
  assert.doesNotMatch(campaignSource.slice(enemyStart, partySpriteStart), /npcField/u);
  assert.match(campaignSource.slice(enemyStart, partySpriteStart), /drawEnemyFieldMarker/u);
  assert.match(campaignSource.slice(partySpriteStart), /getPartyAtlasFieldPoseFrame|getPartyAtlasFrame/u);
});
