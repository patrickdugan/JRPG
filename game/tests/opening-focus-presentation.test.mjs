import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../campaign.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../campaign.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('../campaign.js', import.meta.url), 'utf8');

test('opening focus presents story before field controls and removes development-facing clutter', () => {
  assert.match(html, /PROLOGUE · THE NIGHT CENSUS/u);
  assert.doesNotMatch(html, /minute playtest target/u);
  assert.match(source, /classList\.toggle\('opening-focus', openingBeat\)/u);
  assert.match(source, /classList\.toggle\([\s\S]*?'opening-has-encounter'/u);
  assert.match(source, /storyAnchor\.after\(sceneCardElement\)/u);
  assert.match(css, /body\.opening-focus \.scene-card \{[\s\S]*?order: 1/u);
  assert.match(css, /body\.opening-focus \.map-wrap \{ order: 3; \}/u);
  assert.match(css, /body\.opening-focus \.chapter-rail,[\s\S]*?\.party-card,[\s\S]*?\.journal-drawer/u);
  assert.match(source, /'No battle blocks this scene\.'/u);
  assert.match(source, /'Uncleared · victory advances the story\.'/u);
});
