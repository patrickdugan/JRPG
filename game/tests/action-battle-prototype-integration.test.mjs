import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../action-battle-prototype.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../action-battle-prototype.css', import.meta.url), 'utf8');
const browser = readFileSync(new URL('../action-battle-prototype.js', import.meta.url), 'utf8');

test('standalone action proof uses the isolated model and shipped side-view atlases', () => {
  assert.match(html, /action-battle-prototype\.css/u);
  assert.match(html, /action-battle-prototype\.js/u);
  assert.match(browser, /from '\.\/action-battle-prototype-model\.mjs'/u);
  assert.match(browser, /from '\.\/party-combat-atlas\.mjs'/u);
  assert.match(browser, /from '\.\/enemy-atlas\.mjs'/u);
  assert.doesNotMatch(browser, /from '\.\/engine\.mjs'|from '\.\/battle\.js'/u);
});

test('canvas has keyboard focus, text authority, dual cooldown meters, and live event output', () => {
  const canvasTag = html.match(/<canvas[\s\S]*?<\/canvas>/u)?.[0] ?? '';
  assert.match(canvasTag, /tabindex="0"/u);
  assert.match(canvasTag, /aria-describedby="battleInstructions battleReadout"/u);
  assert.match(html, /id="battleReadout"[^>]*aria-label="Text battle state"/u);
  assert.match(html, /role="meter" aria-label="Shared offense cooldown"/u);
  assert.match(html, /role="meter" aria-label="Cinder Route cooldown"/u);
  assert.match(html, /id="battleAnnouncement"[^>]*role="status"[^>]*aria-live="polite"/u);
  assert.match(html, /<kbd>W<\/kbd>[\s\S]*Jump/u);
  assert.match(html, /<kbd>K<\/kbd>[\s\S]*Cinder Route/u);
});

test('browser runtime publishes inspectable action state and honors reduced motion', () => {
  assert.match(browser, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/u);
  assert.match(browser, /canvas\.dataset\.offenseCooldownMs/u);
  assert.match(browser, /canvas\.dataset\.skillCooldownMs/u);
  assert.match(browser, /canvas\.dataset\.playerGrounded/u);
  assert.match(browser, /if \(!reducedMotion\) shakeRemainingMs/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/u);
});
