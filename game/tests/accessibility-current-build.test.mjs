import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

function tagWithId(html, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<[^>]+\\bid=["']${escaped}["'][^>]*>`));
  assert.ok(match, `Missing #${id}`);
  return match[0];
}

function channel(hex) {
  const value = Number.parseInt(hex, 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace('#', '');
  return (0.2126 * channel(value.slice(0, 2)))
    + (0.7152 * channel(value.slice(2, 4)))
    + (0.0722 * channel(value.slice(4, 6)));
}

function contrast(foreground, background) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

const SURFACES = [
  ['index.html', 'style.css'],
  ['campaign.html', 'campaign.css'],
  ['battle.html', 'battle.css'],
  ['camp.html', 'camp.css'],
  ['credits.html', 'credits.css'],
];

test('all five browser surfaces retain bypass, focus, and reduced-motion source contracts', () => {
  for (const [page, stylesheet] of SURFACES) {
    const html = source(page);
    const css = source(stylesheet);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(html, /<a class="skip-link" href="#mainContent">Skip to main content<\/a>/);
    assert.match(tagWithId(html, 'mainContent'), /\btabindex="-1"/);
    assert.doesNotMatch(html, /\btabindex="[1-9]\d*"/);
    assert.doesNotMatch(html, /\bautofocus\b/);
    assert.match(css, /\[tabindex\]:focus-visible/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important/);
  }
  assert.match(source('audio-controls.css'), /\.skip-link:focus/);
});

test('canvas gameplay surfaces retain text alternatives outside their pixels', () => {
  const index = source('index.html');
  const fp0Canvas = tagWithId(index, 'gameCanvas');
  assert.match(fp0Canvas, /aria-label="Bell Court tactical stage"/);
  assert.match(fp0Canvas, /aria-describedby="boardSummary feedback access-log"/);
  assert.match(index, /id="boardSummary"/);

  const campaign = source('campaign.html');
  const fieldCanvas = tagWithId(campaign, 'mapCanvas');
  assert.match(fieldCanvas, /aria-label="[^"]+"/);
  assert.match(fieldCanvas, /aria-describedby="fieldObjective fieldProgress fieldFeedback"/);
  assert.match(campaign, /class="scene-visual" aria-hidden="true"/);

  const battle = source('battle.html');
  const battleCanvas = tagWithId(battle, 'battleCanvas');
  assert.match(battleCanvas, /aria-label="[^"]+"/);
  assert.match(battleCanvas, /aria-describedby="activeActorLabel commandHint objectiveText objectiveProgress"/);
});

test('campaign, Storyworld, Camp, and Battle choice collections use ordinary group semantics', () => {
  const campaign = source('campaign.html');
  for (const id of ['fieldControls', 'choiceDeck', 'storyworldOptionDeck', 'witnessChoiceDeck']) {
    assert.match(tagWithId(campaign, id), /\brole="group"/);
    assert.match(tagWithId(campaign, id), /\baria-label(?:ledby)?="[^"]+"/);
  }

  const camp = source('camp.html');
  for (const id of ['campConversationList', 'campConversationChoices', 'partyCouncilList', 'partyCouncilChoices', 'archiveRecordList']) {
    assert.match(tagWithId(camp, id), /\brole="group"/);
    assert.match(tagWithId(camp, id), /\baria-label(?:ledby)?="[^"]+"/);
  }
  for (const [stageId, titleId] of [
    ['campConversationStage', 'campConversationTitle'],
    ['partyCouncilStage', 'partyCouncilTitle'],
    ['archiveRecordStage', 'archiveRecordTitle'],
  ]) assert.match(tagWithId(camp, stageId), new RegExp(`aria-labelledby="${titleId}"`));

  const battle = source('battle.html');
  assert.match(tagWithId(battle, 'partyPanel'), /role="group"[^>]*aria-label="[^"]+"/);
  assert.match(tagWithId(battle, 'commandButtons'), /role="group"[^>]*aria-label="Battle commands"/);
  assert.doesNotMatch(tagWithId(battle, 'commandButtons'), /role="toolbar"/);
});

test('visible numeric and reading shortcuts are exposed to assistive technology', () => {
  const campaignHtml = source('campaign.html');
  for (const id of ['interactField', 'continueDialogue', 'storyworldContinue', 'previousScene', 'nextScene']) {
    assert.match(tagWithId(campaignHtml, id), /aria-keyshortcuts="[^"]+"/);
  }
  const campaign = source('campaign.js');
  assert.ok((campaign.match(/setAttribute\('aria-keyshortcuts', String\(index \+ 1\)\)/g) ?? []).length >= 3);

  const campHtml = source('camp.html');
  for (const id of ['advanceCampConversation', 'advancePartyCouncil', 'advanceArchiveRecord']) {
    assert.match(tagWithId(campHtml, id), /aria-keyshortcuts="N"/);
  }
  assert.ok((source('camp.js').match(/setAttribute\('aria-keyshortcuts', String\(index \+ 1\)\)/g) ?? []).length >= 2);
});

test('live regions are atomic where state replaces whole phrases and Credits avoids timer spam', () => {
  const campaign = source('campaign.html');
  for (const id of ['fieldFeedback', 'choiceResult', 'storyworldText', 'storyworldReaction', 'battleStatus', 'witnessStageHint']) {
    const tag = tagWithId(campaign, id);
    assert.match(tag, /aria-live="polite"/);
    assert.match(tag, /aria-atomic="true"/);
  }

  const battle = source('battle.html');
  assert.match(tagWithId(battle, 'battleAnnouncements'), /aria-live="assertive"[^>]*aria-atomic="true"/);
  assert.doesNotMatch(tagWithId(battle, 'tempoQueue'), /aria-live/);
  assert.doesNotMatch(tagWithId(battle, 'resultLog'), /aria-live/);

  const credits = source('credits.html');
  assert.doesNotMatch(tagWithId(credits, 'creditsStatus'), /role="status"|aria-live/);
  assert.doesNotMatch(tagWithId(credits, 'timingAttribution'), /role="status"|aria-live/);
  assert.match(tagWithId(credits, 'evidenceExportHint'), /role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  const creditsJs = source('credits.js');
  assert.match(creditsJs, /function publishEvidenceExportHint\(readinessText\)/);
  assert.equal((creditsJs.match(/evidenceExportHint\.textContent\s*=/g) ?? []).length, 1,
    'only the change-detecting publisher may mutate the Credits live region');
});

test('victory focus is placed once and programmatic focus targets have visible indicators', () => {
  const battle = source('battle.js');
  assert.match(battle, /let victoryExitFocusPlaced = false/);
  assert.match(battle, /const victoryExitReady = !continueCampaign\.hidden/);
  assert.match(battle, /if \(!victoryExitReady\) victoryExitFocusPlaced = false/);
  assert.match(battle, /else if \(!victoryExitFocusPlaced\)[\s\S]*?continueCampaign\.focus\(\{ preventScroll: true \}\)[\s\S]*?victoryExitFocusPlaced = true/);
  assert.match(source('campaign.css'), /\[tabindex\]:focus-visible/);
  assert.match(source('credits.css'), /\[tabindex\]:focus-visible/);
});

test('critical explicit text/background pairs clear the WCAG AA normal-text ratio', () => {
  const samples = [
    ['audio-controls.css', '#090b17', '#fff1bd'],
    ['style.css', '#e8dfc9', '#171a31'],
    ['campaign.css', '#e2f1e7', '#142524'],
    ['battle.css', '#eee7d5', '#171e35'],
    ['camp.css', '#eee6d2', '#11172a'],
    ['credits.css', '#fff1be', '#29243a'],
  ];
  for (const [file, foreground, background] of samples) {
    const css = source(file).toLowerCase();
    assert.ok(css.includes(foreground), `${file} must retain ${foreground}`);
    assert.ok(css.includes(background), `${file} must retain ${background}`);
    assert.ok(contrast(foreground, background) >= 4.5,
      `${file} ${foreground} on ${background} must meet 4.5:1`);
  }
});
