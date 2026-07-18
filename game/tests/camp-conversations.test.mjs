import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAMP_CONVERSATION_PLAN,
  CAMP_CONVERSATION_TARGETS,
  validateCampConversationPack,
} from '../camp-conversation-contract.mjs';
import {
  CAMP_CONVERSATION_METRICS,
  CAMP_CONVERSATION_PLAYABLE_METRICS,
  CAMP_CONVERSATIONS,
  getCampConversation,
  getCampConversationsForCamp,
  getCampConversationsForPair,
} from '../content/camp-conversations.mjs';

test('complete camp catalogue validates in exact canonical pair and sequence order', () => {
  const validation = validateCampConversationPack(CAMP_CONVERSATIONS.conversations, { strictCatalogue: true });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(CAMP_CONVERSATION_METRICS.conversationCount, 90);
  assert.equal(CAMP_CONVERSATION_METRICS.pairCount, 15);
  assert.equal(CAMP_CONVERSATION_METRICS.choiceOptionCount, 180);
  assert.ok(CAMP_CONVERSATION_METRICS.wordCount >= CAMP_CONVERSATION_TARGETS.minimumCatalogueWords);
  assert.deepEqual(
    CAMP_CONVERSATIONS.conversations.map(({ id }) => id),
    CAMP_CONVERSATION_PLAN.flatMap((entry) => entry.conversations.map(({ id }) => id)),
  );
});

test('playable metrics count one visible branch and exclude the unseen response branch', () => {
  const expectedSelectedResponseLines = CAMP_CONVERSATIONS.conversations.reduce(
    (sum, conversation) => sum + conversation.choice.options[0].response.length,
    0,
  );
  assert.deepEqual(CAMP_CONVERSATION_PLAYABLE_METRICS, {
    conversationCount: 90,
    mainLineCount: CAMP_CONVERSATION_METRICS.mainLineCount,
    selectedResponseLineCount: expectedSelectedResponseLines,
    dialogueLineCount: CAMP_CONVERSATION_METRICS.mainLineCount + expectedSelectedResponseLines,
    choiceCount: 90,
    visibleWordCount: CAMP_CONVERSATION_PLAYABLE_METRICS.visibleWordCount,
  });
  assert.ok(CAMP_CONVERSATION_PLAYABLE_METRICS.visibleWordCount > 0);
  assert.ok(CAMP_CONVERSATION_PLAYABLE_METRICS.visibleWordCount < CAMP_CONVERSATION_METRICS.wordCount);
});

test('catalogue lookups are null-safe, complete, and deeply immutable', () => {
  assert.equal(getCampConversation('missing'), null);
  assert.deepEqual(getCampConversationsForPair('missing'), []);
  assert.deepEqual(getCampConversationsForCamp('missing'), []);
  for (const plan of CAMP_CONVERSATION_PLAN) {
    const entries = getCampConversationsForPair(plan.pairId);
    assert.equal(entries.length, 6);
    assert.equal(Object.isFrozen(entries), true);
    assert.ok(entries.every((entry) => getCampConversation(entry.id) === entry));
  }
  assert.equal(Object.isFrozen(getCampConversationsForCamp('roadside-lantern')), true);
  assert.equal(Object.isFrozen(CAMP_CONVERSATIONS), true);
  assert.equal(Object.isFrozen(CAMP_CONVERSATIONS.conversations), true);
  assert.equal(Object.isFrozen(CAMP_CONVERSATIONS.conversations[0].dialogue[0]), true);
  assert.equal(Object.isFrozen(CAMP_CONVERSATION_METRICS), true);
  assert.equal(Object.isFrozen(CAMP_CONVERSATION_PLAYABLE_METRICS), true);
});
