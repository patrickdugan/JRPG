import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, css, campaign, actionBattle] = await Promise.all([
  readFile(new URL('../campaign.html', import.meta.url), 'utf8'),
  readFile(new URL('../campaign.css', import.meta.url), 'utf8'),
  readFile(new URL('../campaign.js', import.meta.url), 'utf8'),
  readFile(new URL('../action-campaign-battle.js', import.meta.url), 'utf8'),
]);

test('blind-test feedback appears only through the explicit test session at opening completion', () => {
  assert.match(html, /id="openingPlaytestPanel"[^>]*tabindex="-1"[^>]*hidden/u);
  assert.match(campaign, /campaignQuery\.get\('openingTest'\) === '1'/u);
  assert.match(campaign, /function openingPlaytestEnabled\(\)/u);
  assert.match(campaign, /openingCompleted && openingPlaytestEnabled\(\) && sameRun/u);
  assert.match(campaign, /completeOpeningPlaytestSession\(openingPlaytestState/u);
  assert.match(campaign, /nextScene\.disabled = true/u);
  assert.match(campaign, /Opening complete — finish feedback above/u);
  assert.match(campaign, /Opening complete — you may stop/u);
  assert.match(campaign, /if \(openingPlaytestEnabled\(\)\) startOpeningPlaytestSession\(receipt\.state\.runId\)/u);
});

test('endpoint form carries every unprompted comprehension and experience item', () => {
  for (const id of ['cast', 'persecution', 'takamine', 'mateus', 'duel', 'recovery', 'next']) {
    assert.match(html, new RegExp(`name="comp-${id}"[^>]*required`, 'u'));
  }
  for (const id of [
    'goalClarity', 'controls', 'telegraphs', 'tagging', 'ayaHealing',
    'characterVoices', 'desireToContinue', 'pacing',
  ]) {
    assert.match(html, new RegExp(`name="rating-${id}"[^>]*required`, 'u'));
  }
  assert.match(html, /name="priorExposure" required/u);
  assert.match(html, /name="helpNeeded" required/u);
  assert.match(html, /name="wouldContinue" required/u);
  assert.match(html, /id="openingPlaytestSubmit"[^>]*type="submit"/u);
  assert.match(html, /id="openingPlaytestDownloadAgain"/u);
});

test('submission downloads one structured receipt and never auto-judges free-text comprehension', () => {
  assert.match(campaign, /submitOpeningPlaytestSession\(/u);
  assert.match(campaign, /serializeOpeningPlaytestEvidence\(openingPlaytestState\)/u);
  assert.match(campaign, /bells-opening-playtest-\$\{candidate\}/u);
  assert.match(campaign, /openingPlaytestAdapter\.save\(openingPlaytestState\)/u);
  assert.match(campaign, /openingPlaytestThanks\.focus/u);
  assert.doesNotMatch(campaign, /comprehension(?:Score|Pass)|gradeComprehension/u);
});

test('opening battle restart evidence is scoped to the same clean run and opening encounters', () => {
  const restart = actionBattle.slice(
    actionBattle.indexOf('function restart()'),
    actionBattle.indexOf('\nfunction isTypingTarget', actionBattle.indexOf('function restart()')),
  );
  assert.match(restart, /canonicalMode && isOpeningActionEncounter\(query\.encounterId\)/u);
  assert.match(restart, /loadedOpeningPlaytest\.state\.status === 'active'/u);
  assert.match(restart, /loadedOpeningPlaytest\.state\.runId === runReceiptState\?\.runId/u);
  assert.match(restart, /recordOpeningPlaytestRestart/u);
  assert.match(restart, /encounterId: query\.encounterId/u);
});

test('feedback layout remains keyboard-visible and collapses to one column on compact screens', () => {
  assert.match(css, /\.opening-playtest-form :is\(textarea, input, select\):focus-visible/u);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.opening-playtest-header,[\s\S]*\.opening-playtest-grid,[\s\S]*\.opening-playtest-rating-grid \{ grid-template-columns: 1fr; \}/u);
  assert.match(css, /\.opening-playtest-submit-row button,[\s\S]*min-height: 44px/u);
  assert.match(html, /role="status" aria-live="polite" aria-atomic="true"/u);
});
