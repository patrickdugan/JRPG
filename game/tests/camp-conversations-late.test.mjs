import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMP_CONVERSATION_GROUPS,
  getCampConversationPlan,
  validateCampConversationPack,
} from '../camp-conversation-contract.mjs';
import {
  CAMP_CONVERSATIONS_LATE,
  CAMP_CONVERSATIONS_LATE_VALIDATION,
} from '../content/camp-conversations-late.mjs';

const words = (value) => value.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;

function allText(conversation) {
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
  ];
}

function normalizedSpeakerPattern(conversation) {
  return conversation.dialogue
    .map(({ speaker }) => (speaker === 'kiku' ? 'K' : 'P'))
    .join('');
}

function assertDeepFrozen(value, path = 'root') {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  for (const [key, nested] of Object.entries(value)) assertDeepFrozen(nested, `${path}.${key}`);
}

test('late pack covers exactly five planned pairs and thirty canonical conversations', () => {
  assert.deepEqual(CAMP_CONVERSATION_GROUPS.late, [
    'ren-kiku', 'aya-kiku', 'lise-kiku', 'mateus-kiku', 'genta-kiku',
  ]);
  assert.equal(CAMP_CONVERSATIONS_LATE.length, 30);
  assert.equal(new Set(CAMP_CONVERSATIONS_LATE.map(({ pairId }) => pairId)).size, 5);

  const expected = CAMP_CONVERSATION_GROUPS.late.flatMap((pairId) => (
    getCampConversationPlan(pairId).conversations.map((planned) => ({ pairId, ...planned }))
  ));
  assert.deepEqual(CAMP_CONVERSATIONS_LATE.map((conversation) => ({
    pairId: conversation.pairId,
    id: conversation.id,
    sequence: conversation.sequence,
    unlockAfterBeatId: conversation.unlockAfterBeatId,
    campId: conversation.campId,
  })), expected);
});

test('every conversation exceeds line, speaker, response, choice, and word-volume requirements', () => {
  for (const conversation of CAMP_CONVERSATIONS_LATE) {
    const participants = conversation.pairId.split('-');
    assert.equal(conversation.dialogue.length, 40, `${conversation.id} main lines`);
    for (const participant of participants) {
      assert.equal(conversation.dialogue.filter(({ speaker }) => speaker === participant).length, 20, `${conversation.id}:${participant}`);
    }
    assert.equal(conversation.choice.options.length, 2);
    conversation.choice.options.forEach((option, optionIndex) => {
      assert.equal(option.id, `${conversation.id}-choice-${optionIndex + 1}`);
      assert.equal(option.response.length, 3);
      assert.equal(option.consequence.flag, `camp.${conversation.id}.choice.${optionIndex + 1}`);
    });
    const wordCount = allText(conversation).reduce((sum, text) => sum + words(text), 0);
    assert.ok(wordCount >= 450, `${conversation.id} has ${wordCount} words`);
  }
});

test('six materially different speaker cadences are distributed across every pair', () => {
  const expectedPatterns = new Map([
    [1, 'PK'.repeat(20)],
    [2, 'PPKK'.repeat(10)],
    [3, 'PKKPKPPK'.repeat(5)],
    [4, `${'KPKPPKKP'.repeat(4)}KPPKKPKP`],
    [5, 'PPPKKKPK'.repeat(5)],
    [6, 'KKPPKPKP'.repeat(5)],
  ]);

  for (const [sequence, expectedPattern] of expectedPatterns) {
    const conversations = CAMP_CONVERSATIONS_LATE.filter((conversation) => conversation.sequence === sequence);
    assert.equal(conversations.length, 5, `sequence ${sequence} distribution`);
    for (const conversation of conversations) {
      assert.equal(normalizedSpeakerPattern(conversation), expectedPattern, conversation.id);
    }
  }

  assert.equal(new Set(expectedPatterns.values()).size, 6);
  for (const pairId of CAMP_CONVERSATION_GROUPS.late) {
    const conversations = CAMP_CONVERSATIONS_LATE.filter((conversation) => conversation.pairId === pairId);
    assert.equal(new Set(conversations.map(normalizedSpeakerPattern)).size, 6, `${pairId} cadence coverage`);
  }
});

test('contract validator accepts exact canonical plan, flags, and complete volume', () => {
  const validation = validateCampConversationPack(CAMP_CONVERSATIONS_LATE, {
    expectedPairIds: CAMP_CONVERSATION_GROUPS.late,
  });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.deepEqual(CAMP_CONVERSATIONS_LATE_VALIDATION, validation);
  assert.deepEqual(validation.metrics, {
    conversationCount: 30,
    pairCount: 5,
    mainLineCount: 1200,
    responseLineCount: 180,
    choiceCount: 30,
    choiceOptionCount: 60,
    wordCount: validation.metrics.wordCount,
  });
  assert.ok(validation.metrics.wordCount >= 13_500);
});

test('all authored titles, themes, prompts, lines, labels, summaries, and responses are exact-text unique', () => {
  const text = CAMP_CONVERSATIONS_LATE.flatMap(allText).map((value) => value.trim().toLowerCase());
  assert.equal(new Set(text).size, text.length);
});

test('late pack and every nested conversation value are deeply immutable', () => {
  assertDeepFrozen(CAMP_CONVERSATIONS_LATE);
  assertDeepFrozen(CAMP_CONVERSATIONS_LATE_VALIDATION);
});
