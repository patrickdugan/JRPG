import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const campaignSource = await readFile(new URL('../campaign.js', import.meta.url), 'utf8');

test('Campaign records a follower departure only after movement persistence succeeds', () => {
  const movement = campaignSource.slice(
    campaignSource.indexOf('function attemptFieldMove'),
    campaignSource.indexOf('function drawNpcFieldMarker'),
  );
  const commit = movement.indexOf("commitStateChanges('Field movement', changes)");
  const publishState = movement.indexOf('fieldRuntimeState = result.state');
  const record = movement.indexOf('recordFieldFormationDeparture(fieldFormationPresentation');
  assert.ok(commit >= 0 && publishState > commit && record > publishState);
  assert.match(movement, /const departedPosition = fieldPosition\(\);[\s\S]*if \(result\.moved\) \{[\s\S]*moved: true,[\s\S]*position: departedPosition,[\s\S]*facing: fieldFacing/u);
  assert.doesNotMatch(movement.slice(0, commit), /recordFieldFormationDeparture/u);
});

test('followers are decorative, fail closed, and render behind authored characters and route markers', () => {
  const followers = campaignSource.slice(
    campaignSource.indexOf('function drawPartyFieldFollowerMarker'),
    campaignSource.indexOf('function drawMap'),
  );
  assert.match(followers, /partyAtlasState !== 'ready'/u);
  assert.match(followers, /getPartyAtlasWalkFrame\(memberId, facing, phase\)/u);
  assert.match(followers, /getPartyAtlasFrame\(memberId, facing, 0\)/u);
  assert.match(followers, /!reducedMotion\.matches && now < fieldWalkUntil/u);
  assert.doesNotMatch(followers, /drawFieldCharacterFallback|moveFieldBy|commitStateChanges|setMemberVitals/u);

  const draw = campaignSource.slice(campaignSource.indexOf('function drawMap'));
  const formation = draw.indexOf('drawFieldFormationFollowers(level');
  const characters = draw.indexOf('drawLevelFieldCharacters(level');
  const operation = draw.indexOf('getActiveSceneOperationMarker(level)');
  assert.ok(formation >= 0 && characters > formation && operation > characters);
  assert.match(campaignSource, /dataset\.fieldFollowerCount = String\(drawnIds\.length\)/u);
  assert.match(campaignSource, /dataset\.fieldFollowerIds = drawnIds\.join\('\|'\)/u);
});

test('follower presentation stays outside field saves, route proof, and playtime authority', async () => {
  const [fieldRuntime, receipt, evidence] = await Promise.all([
    readFile(new URL('../field-runtime.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../run-receipt.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../playtest-evidence.mjs', import.meta.url), 'utf8'),
  ]);
  for (const source of [fieldRuntime, receipt, evidence]) {
    assert.doesNotMatch(source, /fieldFormationPresentation|fieldFollower/u);
  }
});
