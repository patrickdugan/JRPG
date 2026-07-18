import assert from 'node:assert/strict';
import test from 'node:test';

import { PARTY_COUNCIL_PLAN, validatePartyCouncilPack } from '../party-council-contract.mjs';
import {
  PARTY_COUNCIL_METRICS,
  PARTY_COUNCIL_PLAYABLE_METRICS,
  PARTY_COUNCILS,
  getPartyCouncil,
  getPartyCouncilsForCamp,
  getPartyCouncilsForChapter,
} from '../content/party-councils.mjs';

function recursivelyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => recursivelyFrozen(child, seen));
}

test('complete party-council catalogue passes strict validation in canonical order', () => {
  const validation = validatePartyCouncilPack(PARTY_COUNCILS.councils, { strictCatalogue: true });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(PARTY_COUNCILS.schemaVersion, 1);
  assert.equal(PARTY_COUNCILS.finite, true);
  assert.equal(PARTY_COUNCILS.repeatable, false);
  assert.equal(PARTY_COUNCILS.completionPolicy, 'once-per-save');
  assert.deepEqual(PARTY_COUNCILS.councils.map(({ id }) => id), PARTY_COUNCIL_PLAN.map(({ id }) => id));
  assert.deepEqual(PARTY_COUNCIL_METRICS, validation.metrics);
  assert.deepEqual(PARTY_COUNCIL_METRICS, {
    councilCount: 30,
    mainLineCount: 993,
    responseLineCount: 180,
    choiceCount: 30,
    choiceOptionCount: 60,
    wordCount: 27_506,
    byGroup: { early: 10, middle: 10, late: 10 },
  });
  assert.equal(recursivelyFrozen(PARTY_COUNCILS), true);
});

test('playable metrics count only the selected first response while catalogue metrics count both branches', () => {
  const expectedSelectedResponses = PARTY_COUNCILS.councils.reduce(
    (sum, council) => sum + council.choice.options[0].response.length,
    0,
  );
  assert.equal(PARTY_COUNCIL_PLAYABLE_METRICS.councilCount, 30);
  assert.equal(PARTY_COUNCIL_PLAYABLE_METRICS.mainLineCount, PARTY_COUNCIL_METRICS.mainLineCount);
  assert.equal(PARTY_COUNCIL_PLAYABLE_METRICS.selectedResponseLineCount, expectedSelectedResponses);
  assert.equal(PARTY_COUNCIL_PLAYABLE_METRICS.dialogueLineCount, PARTY_COUNCIL_METRICS.mainLineCount + expectedSelectedResponses);
  assert.equal(PARTY_COUNCIL_PLAYABLE_METRICS.choiceCount, 30);
  assert.equal(PARTY_COUNCIL_PLAYABLE_METRICS.visibleWordCount, 25_072);
  assert.ok(PARTY_COUNCIL_PLAYABLE_METRICS.visibleWordCount <= PARTY_COUNCIL_METRICS.wordCount);
});

test('party-council lookups are exact, immutable, and null-safe', () => {
  for (const council of PARTY_COUNCILS.councils) {
    assert.equal(getPartyCouncil(council.id), council);
    assert.ok(getPartyCouncilsForCamp(council.campId).includes(council));
    assert.ok(getPartyCouncilsForChapter(council.chapterId).includes(council));
  }
  assert.equal(getPartyCouncil('missing'), null);
  assert.deepEqual(getPartyCouncilsForCamp('missing'), []);
  assert.deepEqual(getPartyCouncilsForChapter('missing'), []);
  assert.equal(Object.isFrozen(getPartyCouncilsForCamp('missing')), true);
});
