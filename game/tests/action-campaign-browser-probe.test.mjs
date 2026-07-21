import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const probe = readFileSync(new URL('../tools/action-campaign-browser-probe.py', import.meta.url), 'utf8');

test('installed-Chrome probe covers movement, the locked gate, and the live two-actor combo lifecycle', () => {
  assert.match(probe, /action-campaign-battle\.html\?encounter=c1-cinder-hounds/u);
  assert.match(probe, /dataset\.partyArtState === 'ready'/u);
  assert.match(probe, /dataset\.enemyArtState === 'ready'/u);
  assert.match(probe, /dataset\.stageArtState === 'ready'/u);
  assert.match(probe, /page\.keyboard\.down\("d"\)/u);
  assert.match(probe, /offensiveCooldownRemainingMs > 0/u);
  assert.match(probe, /Movement stayed locked during live cooldown/u);
  assert.match(probe, /Cooldown timer did not count down independently/u);
  assert.match(probe, /controlledX.*before\["controlledX"\]/u);
  assert.match(probe, /continueHidden/u);
  assert.match(probe, /dataset\.comboAvailable === 'false'/u);
  assert.match(probe, /participant-missing/u);
  assert.match(probe, /page\.keyboard\.press\("l"\)/u);
  assert.match(probe, /action-campaign-battle\.html\?encounter=c4-widow-of-fog/u);
  assert.match(probe, /combo_page\.keyboard\.press\("Tab"\)[\s\S]*combo_page\.keyboard\.press\("Tab"\)/u);
  assert.match(probe, /snapshot\.combo\.available === true/u);
  assert.match(probe, /active\.length === 2/u);
  assert.match(probe, /event\.type === 'attack-complete'/u);
  assert.match(probe, /party:lise:dawn-bolt/u);
  assert.match(probe, /party:mateus:penitent-night/u);
  assert.match(probe, /party:lise:hunter-thrust/u);
  assert.match(probe, /combo_context = browser\.new_context/u);
  assert.match(probe, /storageKeys.*== \[\]/u);
  assert.match(probe, /require\(not console_errors/u);
  assert.match(probe, /require\(not page_errors/u);
  assert.match(probe, /require\(not delivery_errors/u);
});
