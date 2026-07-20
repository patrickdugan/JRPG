import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PARTY_PORTRAIT_ATLAS,
  PARTY_PORTRAIT_EXPRESSIONS,
  PARTY_PORTRAIT_MEMBERS,
  getPartyPortraitBackgroundPlacement,
  getPartyPortraitFrame,
  hasPartyPortraitMember,
  partyPortraitImageHasExpectedSize,
  portraitExpressionForGesture,
} from '../party-portrait-atlas.mjs';
import { SCENE_DIRECTIONS } from '../content/scene-direction.mjs';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('portrait atlas exposes 48 exact frames without an unused reserve', () => {
  const rectangles = new Set();
  for (const [row, memberId] of PARTY_PORTRAIT_MEMBERS.entries()) {
    assert.equal(hasPartyPortraitMember(memberId), true);
    for (const [column, expression] of PARTY_PORTRAIT_EXPRESSIONS.entries()) {
      const frame = getPartyPortraitFrame(memberId, expression);
      assert.deepEqual(frame, {
        memberId,
        expression,
        row,
        column,
        x: column * 64,
        y: row * 64,
        width: 64,
        height: 64,
      });
      assert.equal(Object.isFrozen(frame), true);
      rectangles.add(`${frame.x},${frame.y},${frame.width},${frame.height}`);
    }
  }
  assert.equal(rectangles.size, 48);
  assert.equal(PARTY_PORTRAIT_ATLAS.contentWidth, PARTY_PORTRAIT_ATLAS.columns * 64);
  assert.equal(PARTY_PORTRAIT_ATLAS.width - PARTY_PORTRAIT_ATLAS.contentWidth, 0);
  assert.equal(hasPartyPortraitMember('unknown'), false);
  assert.throws(() => getPartyPortraitFrame('unknown'), /Unknown party portrait member/);
});

test('gesture vocabulary selects only the eight authored expression keys', () => {
  assert.equal(portraitExpressionForGesture('points toward the open gate'), 'resolve');
  assert.equal(portraitExpressionForGesture('winces and braces the ledger'), 'strain');
  assert.equal(portraitExpressionForGesture('softens, then opens one palm'), 'soften');
  assert.equal(portraitExpressionForGesture('checks the patient and shields the child'), 'concern');
  assert.equal(portraitExpressionForGesture('glares, then strikes through the purge claim'), 'anger');
  assert.equal(portraitExpressionForGesture('gasps at the sudden reveal'), 'surprise');
  assert.equal(portraitExpressionForGesture('bows her head through the silence'), 'quiet');
  assert.equal(portraitExpressionForGesture('reads the page'), 'neutral');
  assert.ok(PARTY_PORTRAIT_EXPRESSIONS.includes(portraitExpressionForGesture(null)));
});

test('authored scene gestures exercise every speaking portrait expression', () => {
  const usedExpressions = new Set(SCENE_DIRECTIONS.map((direction) => (
    portraitExpressionForGesture(direction.gestureCue.action)
  )));
  assert.deepEqual([...usedExpressions].sort(), [...PARTY_PORTRAIT_EXPRESSIONS].sort());
});

test('Camp crop placement derives all six rows and eight columns from authored frames', () => {
  for (const [row, memberId] of PARTY_PORTRAIT_MEMBERS.entries()) {
    for (const [column, expression] of PARTY_PORTRAIT_EXPRESSIONS.entries()) {
      const frame = getPartyPortraitFrame(memberId, expression);
      const placement = getPartyPortraitBackgroundPlacement(frame, { cropWidth: 52, cropHeight: 60 });
      assert.equal(placement.cropWidth, 52);
      assert.equal(placement.cropHeight, 60);
      assert.equal(placement.scale, 0.9375);
      assert.equal(placement.backgroundWidth, 480);
      assert.equal(placement.backgroundHeight, 360);
      assert.equal(placement.x, -4 - column * 60);
      assert.equal(placement.y, -row * 60);
      assert.equal(placement.backgroundSize, '480px 360px');
      assert.equal(placement.backgroundPosition, `${-4 - column * 60}px ${-row * 60}px`);
      assert.equal(Object.isFrozen(placement), true);
    }
  }
});

test('portrait placement rejects invalid crop dimensions and frames outside authored content', () => {
  const frame = getPartyPortraitFrame('ren', 'neutral');
  assert.throws(() => getPartyPortraitBackgroundPlacement(frame), /positive crop dimensions/);
  assert.throws(() => getPartyPortraitBackgroundPlacement(frame, { cropWidth: 61, cropHeight: 60 }), /cannot be wider/);
  assert.throws(() => getPartyPortraitBackgroundPlacement({ ...frame, x: 512 }, { cropWidth: 52, cropHeight: 60 }), /content grid/);
  assert.throws(() => getPartyPortraitBackgroundPlacement(null, { cropWidth: 52, cropHeight: 60 }), /valid source frame/);
});

test('portrait image validation rejects decodable wrong-size rasters', () => {
  assert.equal(partyPortraitImageHasExpectedSize({ naturalWidth: 512, naturalHeight: 384 }), true);
  assert.equal(partyPortraitImageHasExpectedSize({ naturalWidth: 511, naturalHeight: 384 }), false);
  assert.equal(partyPortraitImageHasExpectedSize({ naturalWidth: 512, naturalHeight: 383 }), false);
  assert.equal(partyPortraitImageHasExpectedSize(null), false);
});

test('Camp consumes frame-derived placement and exposes selected frame datasets for browser QA', async () => {
  const source = await readFile(resolve(GAME_ROOT, 'camp.js'), 'utf8');
  assert.match(source, /const portraitFrame = getPartyPortraitFrame\(selectedMemberId, 'neutral'\)/u);
  assert.match(source, /getPartyPortraitBackgroundPlacement\(portraitFrame,/u);
  assert.match(source, /portraitToken\.style\.backgroundSize = portraitPlacement\.backgroundSize/u);
  assert.match(source, /portraitToken\.style\.backgroundPosition = portraitPlacement\.backgroundPosition/u);
  for (const dataset of ['memberId', 'expression', 'frameRow', 'frameColumn', 'frameX', 'frameY', 'frameWidth', 'frameHeight']) {
    assert.match(source, new RegExp(`portraitToken\\.dataset\\.${dataset} =`, 'u'));
  }
  assert.doesNotMatch(source, /PARTY_MEMBER_IDS|atlasRow|atlasRow \* 60/u);
  assert.match(source, /campPartyAtlasState === 'ready' && partyPortraitImageHasExpectedSize\(campPartyAtlasImage\)/u);
  assert.match(source, /removeProperty\('background-image'\)/u);
  assert.match(source, /removeProperty\('background-size'\)/u);
  assert.match(source, /removeProperty\('background-position'\)/u);
});
