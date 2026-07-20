import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const campaignHtml = readFileSync(new URL('../campaign.html', import.meta.url), 'utf8');
const campaignSource = readFileSync(new URL('../campaign.js', import.meta.url), 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source boundary: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source boundary: ${endMarker}`);
  assert.ok(end > start, `Invalid source boundaries: ${startMarker} / ${endMarker}`);
  return source.slice(start, end);
}

function htmlTagWithId(id) {
  const match = campaignHtml.match(new RegExp(`<[^>]+\\bid=["']${escapeRegExp(id)}["'][^>]*>`));
  assert.ok(match, `campaign.html must expose #${id}`);
  return match[0];
}

test('campaign exposes one accessible Storyworld panel contract for every consumed control', () => {
  const requiredIds = [
    'storyworldPanel',
    'storyworldPlacement',
    'storyworldTitle',
    'storyworldProgress',
    'storyworldText',
    'storyworldOptionDeck',
    'storyworldReaction',
    'storyworldStateSummary',
    'storyworldContinue',
  ];
  for (const id of requiredIds) {
    const htmlMatches = campaignHtml.match(new RegExp(`\\bid=["']${escapeRegExp(id)}["']`, 'g')) ?? [];
    assert.equal(htmlMatches.length, 1, `campaign.html must expose exactly one #${id}`);
    assert.match(campaignSource, new RegExp(`querySelector\\(\\s*['"]#${escapeRegExp(id)}['"]\\s*\\)`));
  }

  const panel = htmlTagWithId('storyworldPanel');
  assert.match(panel, /\bhidden\b/);
  assert.match(panel, /\baria-labelledby=["']storyworldTitle["']/);
  const panelFocusTarget = /\btabindex=["']-1["']/.test(panel)
    || /\btabindex=["']-1["']/.test(htmlTagWithId('storyworldTitle'));
  assert.equal(panelFocusTarget, true,
    'the changing encounter panel or its heading must be a programmatic focus target');
  assert.match(htmlTagWithId('storyworldOptionDeck'), /\brole=["']group["']/);
  assert.match(htmlTagWithId('storyworldOptionDeck'), /\baria-label=["'][^"']+["']/);
  for (const id of ['storyworldText', 'storyworldReaction']) {
    const status = htmlTagWithId(id);
    assert.match(status, /\brole=["']status["']/);
    assert.match(status, /\baria-live=["']polite["']/);
  }
});

test('canonical and Storyworld choice controls keep disjoint selectors and transition authorities', () => {
  const canonicalRender = sourceSection(campaignSource, 'function renderChoices(beat)', 'function renderQuestJournal');
  const storyworldRender = sourceSection(campaignSource, 'function renderStoryworldPanel(presentation)', 'function applyStoryworldBeforeBeatLock');
  assert.match(canonicalRender, /button\.dataset\.choiceId\s*=\s*choice\.id/);
  assert.doesNotMatch(canonicalRender, /storyworldOptionId/);
  assert.match(storyworldRender, /button\.dataset\.storyworldOptionId\s*=\s*option\.id/);
  assert.doesNotMatch(storyworldRender, /button\.dataset\.choiceId/);

  const canonicalHandler = sourceSection(
    campaignSource,
    "choiceDeck.addEventListener('click'",
    "storyworldOptionDeck.addEventListener('click'",
  );
  assert.match(canonicalHandler, /closest\(\s*['"]\[data-choice-id\]['"]\s*\)/);
  assert.doesNotMatch(canonicalHandler, /data-storyworld-option-id|chooseStoryworldOption/);

  const storyworldHandler = sourceSection(
    campaignSource,
    "storyworldOptionDeck.addEventListener('click'",
    "storyworldContinue.addEventListener('click'",
  );
  assert.match(storyworldHandler, /closest\(\s*['"]\[data-storyworld-option-id\]['"]\s*\)/);
  assert.match(storyworldHandler, /chooseStoryworldOption\(\s*storyworldState\s*,/);
  assert.match(storyworldHandler, /commitStoryworldTransition\(/);
  assert.doesNotMatch(storyworldHandler, /data-choice-id|\bchoose\(/);

  const storyworldContinueHandler = sourceSection(
    campaignSource,
    "storyworldContinue.addEventListener('click'",
    "continueDialogue.addEventListener('click'",
  );
  assert.match(storyworldContinueHandler, /beginStoryworldEncounter\(\s*storyworldState\s*,/);
  assert.match(storyworldContinueHandler, /advanceStoryworldEncounter\(\s*storyworldState\s*,/);
  assert.match(storyworldContinueHandler, /commitStoryworldTransition\(/);

  const transition = sourceSection(
    campaignSource,
    'function commitStoryworldTransition',
    'function renderDialogue',
  );
  assert.match(transition, /commitStateChanges\([\s\S]*?adapter:\s*storyworldAdapter[\s\S]*?nextState:\s*result\.state/);
  assert.match(transition, /recordRunStoryworldDecision\(\s*runReceiptState\s*,[\s\S]*?result\.progress\.cluster\.id/);
  assert.match(transition, /adapter:\s*runReceiptAdapter[\s\S]*?nextState:\s*nextRunReceiptState/,
    'completed Storyworld clusters and their receipt mirror must commit atomically');
  assert.match(transition, /storyworld(?:Panel|Title)\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/);
});

test('before-beat decisions lock direct play while after-beat consequences block completion', () => {
  const presentation = sourceSection(
    campaignSource,
    'function currentStoryworldPresentation',
    'function storyworldReactionForProgress',
  );
  assert.match(presentation, /cluster\.placement\s*===\s*['"]before-beat['"]\s*\|\|\s*baseBeatReady/);
  assert.match(presentation, /blocksBeforeBeat:\s*shouldPresent\s*&&\s*cluster\.placement\s*===\s*['"]before-beat['"]/);

  const render = sourceSection(campaignSource, 'function render()', 'function renderRunProofStatus');
  assert.match(render, /renderStoryworldPanel\(storyworldPresentation\)/);
  assert.match(render, /applyStoryworldBeforeBeatLock\(storyworldPresentation\.blocksBeforeBeat\)/);
  assert.match(render, /!storyworldCleared/);

  const lock = sourceSection(
    campaignSource,
    'function applyStoryworldBeforeBeatLock',
    'function renderDialogue',
  );
  for (const pattern of [
    /fieldControls\.querySelectorAll\(['"]button['"]\)/,
    /interactFieldButton\.disabled\s*=\s*(?:locked|true)/,
    /fieldLeaderSelect\.disabled\s*=\s*(?:locked|true)/,
    /continueDialogue\.disabled\s*=\s*true/,
    /choiceDeck\.querySelectorAll\(['"]button['"]\)/,
    /launchBattle\.removeAttribute\(['"]href['"]\)/,
  ]) assert.match(lock, pattern);

  const fieldMove = sourceSection(campaignSource, 'function attemptFieldMove', 'function drawNpcFieldMarker');
  assert.match(fieldMove, /currentStoryworldBeforeBeatBlocked\(\)/,
    'keyboard movement calls attemptFieldMove directly, so the function needs its own pre-beat gate');

  const completion = sourceSection(
    campaignSource,
    'function persistCurrentBeatCompletion',
    'function advance(direction)',
  );
  assert.match(completion, /getStoryworldGateForBeat\(\s*storyworldState\s*,/);
  assert.match(completion, /!\w+\.complete/,
    'completion must refuse an unfinished Storyworld authority, not depend only on disabled UI');
});

test('Storyworld keyboard precedence follows the visible panel instead of canonical choices', () => {
  const keyboard = sourceSection(
    campaignSource,
    "window.addEventListener('keydown'",
    'function persistRecoveryAuthorities',
  );
  const storyworldOptions = keyboard.indexOf('storyworldOptionDeck');
  const canonicalChoices = keyboard.indexOf('getBeat().choices');
  assert.ok(storyworldOptions >= 0, 'number keys must inspect currently visible Storyworld options');
  assert.ok(canonicalChoices > storyworldOptions,
    'visible Storyworld options must consume number keys before canonical scene choices');
  assert.match(keyboard, /storyworldPanel\.hidden/);
  assert.match(keyboard, /storyworldContinue\.click\(\)/,
    'N should advance the visible Storyworld phase before ordinary dialogue');
});

test('New Game and browser lifecycle create, reload, and save run-bound Storyworld progress', () => {
  const reset = sourceSection(
    campaignSource,
    "resetCampaign.addEventListener('click'",
    "window.addEventListener('keydown'",
  );
  assert.match(reset, /Storyworld/i, 'New Game confirmation must disclose that Storyworld choices are cleared');
  assert.match(reset, /profileId:\s*RUN_RECEIPT_PROFILE_IDS\.NARRATIVE_5_6H/,
    'ordinary New Game must explicitly choose the five-to-six-hour narrative receipt');
  assert.match(reset, /createStoryworldState\(\s*\{\s*runId:\s*receipt\.state\.runId\s*\}\s*\)/);
  assert.match(reset, /commitStateChanges\('New Game',[\s\S]*?adapter:\s*storyworldAdapter[\s\S]*?nextState:\s*nextStoryworldState/);
  assert.match(reset, /storyworldState\s*=\s*nextStoryworldState/);

  const pageshow = sourceSection(
    campaignSource,
    "window.addEventListener('pageshow'",
    "window.addEventListener('pagehide'",
  );
  assert.match(pageshow, /const\s+refreshedStoryworld\s*=\s*storyworldAdapter\.load\(\s*\)/);
  assert.match(pageshow, /refreshedStoryworld\.state\.runId\s*===\s*runReceiptState\.runId/,
    'a bfcache restore must not attach Storyworld choices from a different clean run');
  assert.match(pageshow, /createLegacyStoryworldState\(/,
    'missing or mismatched progress must remain explicitly proof-ineligible');

  const lifecycle = campaignSource.slice(campaignSource.indexOf("window.addEventListener('pagehide'"));
  const saveCalls = lifecycle.match(/storyworldAdapter\.save\(storyworldState\)/g) ?? [];
  assert.ok(saveCalls.length >= 2,
    'pagehide and hidden visibility changes must each best-effort save Storyworld progress');
});

test('the completionist ledger remains visible but never blocks narrative advancement', () => {
  const render = sourceSection(campaignSource, 'function render()', 'function renderRunProofStatus');
  assert.doesNotMatch(render, /routeEntryCleared|entryDueActivityCount\s*===\s*0/);

  const completion = sourceSection(
    campaignSource,
    'function persistCurrentBeatCompletion',
    'function advance(direction)',
  );
  assert.doesNotMatch(completion, /entryDueActivityCount/);

  const advance = sourceSection(
    campaignSource,
    'function advance(direction)',
    "chapterList.addEventListener('click'",
  );
  assert.doesNotMatch(advance, /entryDueActivityCount/);
  assert.match(campaignHtml, /Optional 20-hour route/);
  assert.match(campaignHtml, /never blocks story progress/);
});
