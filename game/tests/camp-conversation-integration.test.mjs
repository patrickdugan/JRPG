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

test('camp page exposes every finite conversation control consumed by its module', () => {
  for (const id of [
    'campConversationSummary',
    'campConversationList',
    'campConversationStage',
    'campConversationMeta',
    'campConversationTitle',
    'campConversationTheme',
    'campConversationLine',
    'campConversationChoices',
    'advanceCampConversation',
  ]) {
    const matches = campHtml.match(new RegExp(`\\bid=["']${escapeRegExp(id)}["']`, 'g')) ?? [];
    assert.equal(matches.length, 1, `camp.html must expose one #${id} control`);
    assert.match(campSource, new RegExp(`querySelector\\(\\s*['"]#${escapeRegExp(id)}['"]\\s*\\)`));
  }
  assert.match(campSource, /from '\.\/content\/camp-conversations\.mjs'/);
  assert.match(campSource, /from '\.\/camp-conversation-runtime\.mjs'/);
  assert.match(campSource, /createCampConversationStorageAdapter\(\)/);
  assert.match(campSource, /getCampConversationAvailability\(/);
  assert.match(campSource, /getCampConversationRuntimeMetrics\(/);
  assert.match(campSource, /button\.classList\.toggle\('is-complete', record\?\.status === 'completed'\)/);
  assert.doesNotMatch(campSource, /button\.disabled = record\?\.status === 'completed'/);
  assert.match(campSource, /progress\.selectedOption\.label/);
});

test('camp interactions begin once, advance one line, require a choice, and save each mutation', () => {
  const listInteraction = sourceSection(
    campSource,
    "campConversationList.addEventListener('click'",
    "campConversationChoices.addEventListener('click'",
  );
  assert.match(listInteraction, /beginCampConversation\(campConversationState, conversation\.id, campConversationContext\(\)\)/);
  assert.match(listInteraction, /campConversationState = result\.state/);
  assert.match(listInteraction, /const saved = campConversationAdapter\.save\(result\.state\)/);
  assert.match(listInteraction, /if \(!saved\.ok\)/);

  const choiceInteraction = sourceSection(
    campSource,
    "campConversationChoices.addEventListener('click'",
    "advanceCampConversation.addEventListener('click'",
  );
  assert.match(choiceInteraction, /chooseCampConversationOption\(/);
  assert.match(choiceInteraction, /button\.dataset\.campConversationChoice/);
  assert.match(choiceInteraction, /const saved = campConversationAdapter\.save\(result\.state\)/);
  assert.match(choiceInteraction, /if \(!saved\.ok\)/);

  const advanceInteraction = sourceSection(
    campSource,
    "advanceCampConversation.addEventListener('click'",
    'function tick(now)',
  );
  assert.match(advanceInteraction, /progress\?\.phase === 'main-dialogue'/);
  assert.match(advanceInteraction, /acknowledgeCampConversationLine\(/);
  assert.match(advanceInteraction, /progress\?\.phase === 'choice-response'/);
  assert.match(advanceInteraction, /acknowledgeCampConversationResponse\(/);
  assert.match(advanceInteraction, /const saved = campConversationAdapter\.save\(result\.state\)/);
  assert.match(advanceInteraction, /if \(!saved\.ok\)/);
});

test('camp-talk mutations persist synchronously, cached pages reload, and New Game clears their independent save', () => {
  const pagehide = sourceSection(
    campSource,
    "window.addEventListener('pagehide'",
    "document.addEventListener('visibilitychange'",
  );
  assert.doesNotMatch(pagehide, /campConversationAdapter\.save\(campConversationState\)/);

  const pageshow = sourceSection(
    campSource,
    "window.addEventListener('pageshow'",
    'document.title',
  );
  assert.match(pageshow, /const refreshedCampConversations = campConversationAdapter\.load\(\)/);
  assert.match(pageshow, /campConversationState = refreshedCampConversations\.state/);
  assert.match(pageshow, /selectedCampConversationId = campConversationState\.records\.find/);
  assert.match(pageshow, /render\(\)/);

  const reset = sourceSection(
    campaignSource,
    "resetCampaign.addEventListener('click'",
    "window.addEventListener('keydown'",
  );
  assert.match(reset, /campConversationAdapter\.clear\(\)/);
});
