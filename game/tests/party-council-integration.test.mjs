import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const campHtml = readFileSync(new URL('../camp.html', import.meta.url), 'utf8');
const campSource = readFileSync(new URL('../camp.js', import.meta.url), 'utf8');
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

test('camp page exposes every finite party-council control consumed by its module', () => {
  for (const id of [
    'partyCouncilSummary',
    'partyCouncilList',
    'partyCouncilStage',
    'partyCouncilMeta',
    'partyCouncilTitle',
    'partyCouncilTheme',
    'partyCouncilLine',
    'partyCouncilChoices',
    'advancePartyCouncil',
  ]) {
    const matches = campHtml.match(new RegExp(`\\bid=["']${escapeRegExp(id)}["']`, 'g')) ?? [];
    assert.equal(matches.length, 1, `camp.html must expose one #${id} control`);
    assert.match(campSource, new RegExp(`querySelector\\(\\s*["']#${escapeRegExp(id)}["']\\s*\\)`));
  }
  assert.match(campSource, /from '\.\/content\/party-councils\.mjs'/);
  assert.match(campSource, /from '\.\/party-council-runtime\.mjs'/);
  assert.match(campSource, /createPartyCouncilStorageAdapter\(\)/);
  assert.match(campSource, /!partyCouncilLoaded\.ok \? 'Party-council progress was unreadable and reset for this run\.'/);
  assert.match(campSource, /partyCouncilLoaded\.resetForRun \? 'Party-council progress from another run was reset\.'/);
  assert.match(campSource, /getPartyCouncilAvailability\(/);
  assert.match(campSource, /getPartyCouncilRuntimeMetrics\(/);
  assert.match(campSource, /button\.classList\.toggle\('is-complete', record\?\.status === 'completed'\)/);
  assert.doesNotMatch(campSource, /button\.disabled = record\?\.status === 'completed'/);
  assert.match(campSource, /progress\.selectedOption\.consequence\.summary/);
  assert.match(campHtml, /id="partyCouncilTitle" tabindex="-1"/);
  assert.match(campHtml, /id="partyCouncilChoices"[^>]*role="group"[^>]*aria-labelledby="partyCouncilLine"/);
});

test('party-council interactions begin once, advance one line, require a choice, and save every mutation', () => {
  const listInteraction = sourceSection(
    campSource,
    "partyCouncilList.addEventListener('click'",
    "partyCouncilChoices.addEventListener('click'",
  );
  assert.match(listInteraction, /beginPartyCouncil\(partyCouncilState, council\.id, partyCouncilContext\(\)\)/);
  assert.match(listInteraction, /const saved = partyCouncilAdapter\.save\(result\.state\)/);
  assert.match(listInteraction, /if \(!saved\.ok\)/);
  assert.match(listInteraction, /partyCouncilState = result\.state/);
  assert.match(listInteraction, /advancePartyCouncil\.focus\(\)/);
  assert.match(listInteraction, /partyCouncilTitle\.focus\(\)/);

  const choiceInteraction = sourceSection(
    campSource,
    "partyCouncilChoices.addEventListener('click'",
    "advancePartyCouncil.addEventListener('click'",
  );
  assert.match(choiceInteraction, /choosePartyCouncilOption\(/);
  assert.match(choiceInteraction, /button\.dataset\.partyCouncilChoice/);
  assert.match(choiceInteraction, /const saved = partyCouncilAdapter\.save\(result\.state\)/);
  assert.match(choiceInteraction, /if \(!saved\.ok\)/);
  assert.match(choiceInteraction, /advancePartyCouncil\.focus\(\)/);

  const advanceInteraction = sourceSection(
    campSource,
    "advancePartyCouncil.addEventListener('click'",
    "archiveRecordList.addEventListener('click'",
  );
  assert.match(advanceInteraction, /progress\?\.phase === 'main-dialogue'/);
  assert.match(advanceInteraction, /acknowledgePartyCouncilLine\(/);
  assert.match(advanceInteraction, /progress\?\.phase === 'choice-response'/);
  assert.match(advanceInteraction, /acknowledgePartyCouncilResponse\(/);
  assert.match(advanceInteraction, /const saved = partyCouncilAdapter\.save\(result\.state\)/);
  assert.match(advanceInteraction, /if \(!saved\.ok\)/);
  assert.match(advanceInteraction, /partyCouncilTitle\.focus\(\)/);
  assert.match(advanceInteraction, /result\.progress\?\.phase === 'choice'/);
  assert.match(advanceInteraction, /partyCouncilChoices\.querySelector\('\[data-party-council-choice\]'\)\?\.focus\(\)/);
  assert.doesNotMatch(advanceInteraction, /campFeedback\.textContent = `\$\{castName\(result\.line\.speaker\)\}/);
});

test('camp changes reconcile a hidden completed council instead of leaving a stale stage visible', () => {
  const renderSection = sourceSection(campSource, 'function renderPartyCouncils()', 'function archiveRecordContext()');
  assert.match(renderSection, /selectedPartyCouncilId !== activeId/);
  assert.match(renderSection, /!visible\.some\(\(council\) => council\.id === selectedPartyCouncilId\)/);
  assert.match(renderSection, /selectedPartyCouncilId = null/);
  const campChange = sourceSection(campSource, "campSelect.addEventListener('change'", "restParty.addEventListener('click'");
  assert.match(campChange, /renderPartyCouncils\(\)/);
});

test('party-council mutations persist synchronously, cached pages reload, and New Game clears the independent save', () => {
  const pagehide = sourceSection(
    campSource,
    "window.addEventListener('pagehide'",
    "document.addEventListener('visibilitychange'",
  );
  assert.doesNotMatch(pagehide, /partyCouncilAdapter\.save\(partyCouncilState\)/);

  const pageshow = sourceSection(
    campSource,
    "window.addEventListener('pageshow'",
    'document.title',
  );
  assert.match(pageshow, /const refreshedPartyCouncils = partyCouncilAdapter\.load\(\)/);
  assert.match(pageshow, /partyCouncilState = refreshedPartyCouncils\.state/);
  assert.match(pageshow, /selectedPartyCouncilId = partyCouncilState\.records\.find/);
  assert.match(pageshow, /render\(\)/);

  const reset = sourceSection(
    campaignSource,
    "resetCampaign.addEventListener('click'",
    "window.addEventListener('keydown'",
  );
  assert.match(campaignSource, /import \{ DEFAULT_PARTY_COUNCIL_SAVE_KEY \} from '\.\/party-council-contract\.mjs'/);
  assert.match(reset, /localStorage\?\.removeItem\(DEFAULT_PARTY_COUNCIL_SAVE_KEY\)/);
});
