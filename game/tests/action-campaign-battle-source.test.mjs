import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../action-campaign-battle.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../action-campaign-battle.css', import.meta.url), 'utf8');
const browser = readFileSync(new URL('../action-campaign-battle.js', import.meta.url), 'utf8');
const model = readFileSync(new URL('../action-campaign-battle-model.mjs', import.meta.url), 'utf8');

test('isolated action campaign page uses the shared action, objective, result, and settlement seams', () => {
  assert.match(html, /action-campaign-battle\.css/u);
  assert.match(html, /action-campaign-battle\.js/u);
  assert.match(browser, /from '\.\/action-campaign-battle-model\.mjs'/u);
  assert.match(model, /from '\.\/action-combat\.mjs'/u);
  assert.match(model, /from '\.\/action-objective-runtime\.mjs'/u);
  assert.match(model, /from '\.\/battle-result-contract\.mjs'/u);
  assert.match(model, /from '\.\/battle-settlement\.mjs'/u);
  assert.doesNotMatch(browser, /from '\.\/battle\.js'|from '\.\/engine\.mjs'/u);
});

test('page carries text authority, keyboard and touch controls, and a settlement-locked Continue gate', () => {
  const canvas = html.match(/<canvas[\s\S]*?<\/canvas>/u)?.[0] ?? '';
  assert.match(canvas, /tabindex="0"/u);
  assert.match(canvas, /aria-describedby="battleInstructions battleReadout"/u);
  assert.match(html, /id="battleReadout"[^>]*aria-label="Text battle state"/u);
  assert.match(html, /id="objectiveRequirements"/u);
  assert.match(html, /id="partyReadout"/u);
  assert.match(html, /id="enemyReadout"/u);
  assert.match(html, /id="continueCampaign"[^>]*hidden[^>]*aria-disabled="true"/u);
  assert.match(html, /<kbd>E<\/kbd>[\s\S]*Hold objective action/u);
  assert.match(html, /data-held-control="left"/u);
  assert.match(html, /data-action-control="switch"/u);
});

test('runtime loads advancement, loadout, Storyworld, all handoffs, and pauses while hidden', () => {
  assert.match(browser, /createAdvancementStorageAdapter/u);
  assert.match(browser, /createLoadoutStorageAdapter/u);
  assert.match(browser, /loadStoryworldBattlePresentation/u);
  assert.match(browser, /createQuestStorageAdapter/u);
  assert.match(browser, /createFieldStorageAdapter/u);
  assert.match(browser, /createWitnessChronicleStorageAdapter/u);
  assert.match(browser, /document\.addEventListener\('visibilitychange'/u);
  assert.match(browser, /if \(!hidden && !session\.outcome\)/u);
  assert.match(browser, /pauseCurtain\.hidden = !hidden/u);
  assert.match(css, /\.pause-curtain\[hidden\] \{ display: none; \}/u);
});

test('shipped party, enemy, boss, and regional stage art retain accessible text fallbacks', () => {
  assert.match(browser, /PARTY_COMBAT_ATLAS/u);
  assert.match(browser, /ENEMY_ATLAS/u);
  assert.match(browser, /BOSS_COMBAT_ATLAS/u);
  assert.match(browser, /getBattleStageArt/u);
  assert.match(browser, /drawFallback/u);
  assert.match(browser, /actorListItem/u);
  assert.match(browser, /elements\.canvas\.dataset\.objectiveSupported/u);
  assert.match(browser, /elements\.canvas\.dataset\.settlement/u);
});
