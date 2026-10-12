import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('campaign battle draws the backdrop at integer scale and keeps the legacy fallback intact', async () => {
  const source = await readFile(new URL('../action-campaign-battle.js', import.meta.url), 'utf8');
  assert.match(source, /from '\.\/action-stage-backdrop-atlas\.mjs'/u);
  assert.match(source, /backdrop: \{ image: new Image\(\), ready: false, source: getActionStageBackdrop\(session\.stage\.id\) \}/u);
  assert.match(source, /if \(art\.backdrop\.source\) art\.backdropTiles\.source = ACTION_STAGE_SURFACE_TILES;/u);
  assert.match(source, /const stageSurfacePlan = planActionStageSurfaces\(session\.stage, art\.backdrop\.source\);/u, 'surfaces follow the physics contract');
  assert.match(source, /'stage', 'backdrop', 'backdropTiles'(?:, '[A-Za-z]+')*\]\) loadArt\(key\)/u);
  assert.match(source, /dataset\.backdropArtState = 'unmapped'/u);
  assert.match(source, /record\.ready = record\.image\.naturalWidth === width && record\.image\.naturalHeight === height;/u);
  const drawStage = source.slice(source.indexOf('function drawStage() {'), source.indexOf('function drawObjectiveEntities('));
  assert.match(drawStage, /resolveActionStageRenderMode\(\{\s*backdrop: art\.backdrop\.source,\s*backdropReady: art\.backdrop\.ready,\s*tilesReady: art\.backdropTiles\.ready,\s*\}\)/u);
  assert.match(drawStage, /dataset\.stageRender = stageRender/u);
  assert.match(drawStage, /if \(stageRender === 'board-fallback'\) \{\s*drawLegacyStageBackground\(\);/u);
  assert.match(drawStage, /context\.drawImage\(art\.backdrop\.image, 0, 0, ACTION_STAGE_BACKDROP_SUITE\.canvasWidth, ACTION_STAGE_BACKDROP_SUITE\.canvasHeight\)/u);
  assert.match(drawStage, /if \(stageRender === 'backdrop'\) drawStageSurfaceTiles\(\);\s*else drawLegacyStageSurfaces\(\);/u);
  const legacyBackground = source.slice(source.indexOf('function drawLegacyStageBackground() {'), source.indexOf('function drawLegacyStageSurfaces() {'));
  assert.match(legacyBackground, /context\.globalAlpha = \.68;\s*context\.drawImage\(art\.stage\.image, 0, -10, 960, 560\);/u);
  const legacySurfaces = source.slice(source.indexOf('function drawLegacyStageSurfaces() {'), source.indexOf('function drawStageSurfaceTiles() {'));
  assert.match(legacySurfaces, /context\.strokeStyle = '#695163';/u);
  assert.match(legacySurfaces, /context\.lineTo\(platform\.right, platform\.y\);/u);
  assert.match(source, /context\.drawImage\(art\.backdropTiles\.image, op\.sx, op\.sy, op\.sw, op\.sh, op\.dx, op\.dy, op\.dw, op\.dh\)/u);
  assert.match(source, /getBattleStageArt\(session\.encounter\.levelId\)/u, 'board art still loads for tools that wait on data-stage-art-state');
});
