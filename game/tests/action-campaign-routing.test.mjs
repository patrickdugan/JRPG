import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const campaign = readFileSync(new URL('../campaign.js', import.meta.url), 'utf8');
const routeRunner = readFileSync(new URL('../tools/browser-route-playthrough.py', import.meta.url), 'utf8');

test('every campaign battle handoff uses canonical action routing through one helper', () => {
  assert.match(campaign, /function campaignBattleHref\(parameters\)/u);
  assert.match(campaign, /parameters\.set\('mode', 'campaign'\)/u);
  assert.match(campaign, /return `action-campaign-battle\.html\?\$\{parameters\.toString\(\)\}`/u);
  assert.equal((campaign.match(/campaignBattleHref\(parameters\)/gu) ?? []).length, 6);
  const outsideHelper = campaign.replace(
    campaign.slice(
      campaign.indexOf('function campaignBattleHref(parameters)'),
      campaign.indexOf('\n}', campaign.indexOf('function campaignBattleHref(parameters)')) + 2,
    ),
    '',
  );
  assert.doesNotMatch(outsideHelper, /window\.location\.href = `battle\.html|launchBattle\.href = `battle\.html/u);
});

test('legacy tactical battle is an explicit sticky rollback used by the rendered route verifier', () => {
  assert.match(campaign, /campaignQuery\.get\('legacyBattle'\) === '1'/u);
  assert.match(campaign, /sessionStorage\.setItem\('bells\.legacyBattle', '1'\)/u);
  assert.match(campaign, /return `battle\.html\?\$\{parameters\.toString\(\)\}`/u);
  assert.match(campaign, /parameters\.set\('return', 'campaign\.html\?legacyBattle=1'\)/u);
  assert.match(routeRunner, /campaign\.html\?legacyBattle=1/u);
});
