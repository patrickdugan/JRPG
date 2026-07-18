import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAMP_CONVERSATION_GROUPS,
  getCampConversationPlan,
  validateCampConversationPack,
} from '../camp-conversation-contract.mjs';
import {
  CAMP_CONVERSATIONS_EARLY,
  EARLY_CAMP_CONVERSATIONS,
  EARLY_CAMP_CONVERSATION_METRICS,
} from '../content/camp-conversations-early.mjs';

function words(value) {
  return typeof value === 'string'
    ? value.match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu)?.length ?? 0
    : 0;
}

function conversationWords(conversation) {
  return [
    conversation.title,
    conversation.theme,
    conversation.choice.prompt,
    ...conversation.dialogue.map(({ line }) => line),
    ...conversation.choice.options.flatMap((option) => [
      option.label,
      option.consequence.summary,
      ...option.response.map(({ line }) => line),
    ]),
  ].reduce((sum, text) => sum + words(text), 0);
}

function recursivelyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => recursivelyFrozen(child, seen));
}

test('early pack covers exactly five canonical pairs and thirty planned conversations', () => {
  assert.equal(EARLY_CAMP_CONVERSATIONS, CAMP_CONVERSATIONS_EARLY);
  assert.equal(EARLY_CAMP_CONVERSATIONS.length, 30);
  assert.equal(new Set(EARLY_CAMP_CONVERSATIONS.map(({ pairId }) => pairId)).size, 5);
  assert.deepEqual(
    [...new Set(EARLY_CAMP_CONVERSATIONS.map(({ pairId }) => pairId))],
    CAMP_CONVERSATION_GROUPS.early,
  );
  for (const pairId of CAMP_CONVERSATION_GROUPS.early) {
    assert.equal(EARLY_CAMP_CONVERSATIONS.filter((entry) => entry.pairId === pairId).length, 6);
  }
  const validation = validateCampConversationPack(EARLY_CAMP_CONVERSATIONS, {
    expectedPairIds: CAMP_CONVERSATION_GROUPS.early,
  });
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.ok, true);
  assert.deepEqual(validation.metrics, EARLY_CAMP_CONVERSATION_METRICS);
});

test('every record exactly follows planned identity, sequence, unlock, and camp order', () => {
  const expected = CAMP_CONVERSATION_GROUPS.early.flatMap((pairId) => {
    const plan = getCampConversationPlan(pairId);
    return plan.conversations.map((conversation) => ({
      id: conversation.id,
      pairId,
      sequence: conversation.sequence,
      unlockAfterBeatId: conversation.unlockAfterBeatId,
      campId: conversation.campId,
    }));
  });
  assert.deepEqual(EARLY_CAMP_CONVERSATIONS.map((conversation) => ({
    id: conversation.id,
    pairId: conversation.pairId,
    sequence: conversation.sequence,
    unlockAfterBeatId: conversation.unlockAfterBeatId,
    campId: conversation.campId,
  })), expected);
});

test('every conversation clears line, speaker, choice-response, and word floors', () => {
  for (const conversation of EARLY_CAMP_CONVERSATIONS) {
    const participants = getCampConversationPlan(conversation.pairId).participants;
    assert.ok(conversation.dialogue.length >= 40, conversation.id);
    for (const participant of participants) {
      assert.ok(
        conversation.dialogue.filter(({ speaker }) => speaker === participant).length >= 15,
        `${conversation.id} underuses ${participant}`,
      );
    }
    assert.equal(conversation.choice.options.length, 2, conversation.id);
    conversation.choice.options.forEach((option, index) => {
      assert.equal(option.id, `${conversation.id}-choice-${index + 1}`);
      assert.equal(option.consequence.flag, `camp.${conversation.id}.choice.${index + 1}`);
      assert.ok(option.response.length >= 3, option.id);
      assert.ok(option.response.every(({ speaker }) => participants.includes(speaker)), option.id);
    });
    assert.ok(conversationWords(conversation) >= 450, `${conversation.id} word floor`);
    assert.ok(conversation.title.length >= 5, conversation.id);
    assert.ok(conversation.theme.length >= 20, conversation.id);
  }
  assert.equal(EARLY_CAMP_CONVERSATION_METRICS.conversationCount, 30);
  assert.equal(EARLY_CAMP_CONVERSATION_METRICS.pairCount, 5);
  assert.ok(EARLY_CAMP_CONVERSATION_METRICS.mainLineCount >= 1_200);
  assert.ok(EARLY_CAMP_CONVERSATION_METRICS.responseLineCount >= 180);
  assert.ok(EARLY_CAMP_CONVERSATION_METRICS.wordCount >= 13_500);
});

test('all authored titles, framing, dialogue, labels, summaries, and responses are exact-unique', () => {
  const text = EARLY_CAMP_CONVERSATIONS.flatMap((conversation) => [
    conversation.title,
    conversation.theme,
    conversation.choice.prompt,
    ...conversation.dialogue.map(({ line }) => line),
    ...conversation.choice.options.flatMap((option) => [
      option.label,
      option.consequence.summary,
      ...option.response.map(({ line }) => line),
    ]),
  ]).map((entry) => entry.trim().toLowerCase());
  assert.equal(new Set(text).size, text.length);
});

test('the exported early pack and every nested record are immutable', () => {
  assert.equal(recursivelyFrozen(EARLY_CAMP_CONVERSATIONS), true);
  assert.equal(recursivelyFrozen(EARLY_CAMP_CONVERSATION_METRICS), true);
  assert.throws(() => { EARLY_CAMP_CONVERSATIONS.push({}); }, TypeError);
  assert.throws(() => { EARLY_CAMP_CONVERSATIONS[0].dialogue[0].line = 'mutated'; }, TypeError);
});
