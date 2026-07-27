import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../campaign.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../campaign.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('../campaign.js', import.meta.url), 'utf8');

test('opening focus exposes one contextual route to the next playable control', () => {
  assert.match(html, /id="openingSliceAction"[^>]*data-opening-step="dialogue"[^>]*aria-describedby="openingSliceGuidance"/u);
  assert.match(html, /id="fieldObjectiveCard"[^>]*tabindex="-1"/u);
  assert.match(source, /getOpeningSliceNextStep\(\{/u);
  assert.match(source, /openingSliceAction\.dataset\.openingStep = nextStep\.id/u);
  assert.match(source, /choice: choiceDeck\.querySelector\('button:not\(\[disabled\]\)'\)/u);
  assert.match(source, /feedback: openingPlaytestPanel/u);
  assert.match(source, /target\.scrollIntoView\(\{/u);
  assert.match(source, /target\.focus\(\{ preventScroll: true \}\)/u);
  assert.match(css, /\.opening-slice-next button \{[\s\S]*?min-height: 40px/u);
  assert.match(css, /@media \(max-width: 600px\) \{[\s\S]*?\.opening-slice-next button \{[\s\S]*?min-height: 44px/u);
});

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
