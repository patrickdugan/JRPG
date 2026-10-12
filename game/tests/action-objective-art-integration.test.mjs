import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../action-campaign-battle.js', import.meta.url), 'utf8');

function functionBody(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`${name} is unterminated`);
}

test('objective anchors stay the final statement block of drawStage()', () => {
  const body = functionBody('drawStage').trim();
  assert.match(body, /drawObjectiveAnchors\(\);$/u);
  assert.equal(body.match(/drawObjectiveAnchors\(\)/gu).length, 1);
  assert.doesNotMatch(body, /objectiveAnchors\b(?!\(\))/u, 'drawStage no longer walks anchors inline');
});

test('objective sprites load through the shared art gate and expose data-objective-art-state', () => {
  assert.match(source, /from '\.\/action-objective-atlas\.mjs'/u);
  assert.match(source, /objective: \{ image: new Image\(\), ready: false, source: ACTION_OBJECTIVE_ATLAS \}/u);
  assert.match(source, /for \(const key of \[[^\]]*'objective'\]\) loadArt\(key\)/u);
  assert.match(source, /elements\.canvas\.dataset\[`\$\{key\}ArtState`\]/u);
  assert.match(functionBody('objectiveArtReady'), /art\.objective\.ready && actionObjectiveImageHasExpectedSize\(art\.objective\.image\)/u);
  for (const key of ['objectiveArtSprites', 'objectiveArtFallbacks', 'objectiveArtFrames', 'canvasLabelCount', 'canvasLabelsHidden']) {
    assert.match(source, new RegExp(`setCanvasDataset\\('${key}'`, 'u'));
  }
});

test('rectangle fallbacks are preserved verbatim for failed atlases, wrong sizes, and unknown kinds', () => {
  const anchor = functionBody('drawObjectiveAnchorFallback');
  assert.match(anchor, /context\.fillStyle = 'rgba\(214, 184, 102, \.12\)'/u);
  assert.match(anchor, /context\.fillRect\(anchor\.x - anchor\.width \/ 2, anchor\.y - anchor\.height, anchor\.width, anchor\.height\)/u);
  assert.match(anchor, /context\.fillText\(anchor\.id\.toUpperCase\(\), anchor\.x, anchor\.y - anchor\.height - 6\)/u);
  const object = functionBody('drawObjectiveObjectFallback');
  assert.match(object, /context\.globalAlpha = object\.destroyed \? 0\.38 : 1/u);
  assert.match(object, /context\.fillStyle = object\.attackable \? '#6f4f86' : '#7e6849'/u);
  const token = functionBody('drawObjectiveTokenFallback');
  assert.match(token, /context\.fillStyle = token\.released \? '#d7cab2' : '#8d7897'/u);
  assert.match(token, /context\.strokeStyle = token\.secured \? '#8be0a4' : '#f1d386'/u);
  const anchors = functionBody('drawObjectiveAnchors');
  assert.match(anchors, /if \(!resolved\?\.frame\) \{\s*drawObjectiveAnchorFallback\(anchor\);/u);
  const entities = functionBody('drawObjectiveEntities');
  assert.match(entities, /if \(!resolved\?\.frame\) \{\s*drawObjectiveObjectFallback\(object\);/u);
  assert.match(entities, /if \(!resolved\?\.frame\) \{\s*drawObjectiveTokenFallback\(token\);/u);
  assert.match(entities, /: entities\.objects;/u, 'fallback keeps the authored object order');
});

test('sprites anchor at the old feet position and actor names go through the pure layout', () => {
  const sprite = functionBody('drawObjectiveSprite');
  assert.match(sprite, /context\.translate\(Math\.round\(x\), Math\.round\(y\)\)/u);
  assert.match(sprite, /-frame\.pivotX \* scale, -frame\.pivotY \* scale/u);
  assert.match(functionBody('drawObjectiveAnchors'), /drawObjectiveSprite\(resolved\.frame, anchor\.x, anchor\.y\)/u);
  assert.match(functionBody('drawObjectiveEntities'), /drawObjectiveSprite\(resolved\.frame, object\.position\.x, object\.position\.y\)/u);
  const actors = functionBody('drawActors');
  assert.match(actors, /drawCanvasLabels\(snapshot, actorLabels\)/u);
  assert.doesNotMatch(actors, /fillText\(actor\.name/u);
  assert.match(source, /from '\.\/action-label-layout\.mjs'/u);
  assert.match(functionBody('drawCanvasLabels'), /layoutCanvasLabels\(requests, \{ obstacles \}\)/u);
  assert.match(source, /'AI SUPPORT'/u);
});
