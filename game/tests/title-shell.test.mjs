import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('the default entry point is a player title shell rather than a combat proof', () => {
  const html = source('index.html');
  assert.match(html, /id="continueGame"[^>]*href="campaign\.html"/);
  assert.match(html, /id="newGame"/);
  assert.match(html, /id="combatSliceLink"[^>]*href="action-slice\.html"[^>]*>Combat Slice<\/a>/);
  assert.match(html, /id="toggleOptions"/);
  assert.match(html, /data-developer-only hidden>Open Training Court/);
  assert.doesNotMatch(html, /<canvas|FP-0|prototype/iu);
});

test('title New Game delegates to the campaign atomic reset and does not write save storage itself', () => {
  const title = source('title.js');
  const campaign = source('campaign.js');
  assert.match(title, /window\.location\.href = 'campaign\.html\?new=1'/);
  assert.doesNotMatch(title, /localStorage|\.setItem\(|\.removeItem\(/);
  assert.match(campaign, /let requestedNewGame = new URLSearchParams\(window\.location\.search\)\.get\('new'\) === '1'/);
  assert.match(campaign, /if \(!requestedNewGame && !window\.confirm/);
  assert.match(campaign, /window\.history\.replaceState\(null, '', 'campaign\.html'\);\s+requestedNewGame = false;/);
  assert.match(campaign, /if \(requestedNewGame\) \{\s+resetCampaign\.click\(\);\s+if \(requestedNewGame\) render\(\);/);
});
