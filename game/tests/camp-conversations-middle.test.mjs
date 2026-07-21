import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAMP_CONVERSATION_GROUPS,
  getCampConversationPlan,
  validateCampConversationPack,
} from '../camp-conversation-contract.mjs';
import {
  CAMP_CONVERSATIONS_MIDDLE,
  CAMP_CONVERSATIONS_MIDDLE_METRICS,
} from '../content/camp-conversations-middle.mjs';

function words(value) {
  return typeof value === 'string'
    ? value.match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu)?.length ?? 0
    : 0;
}

function authoredText(conversation) {
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

function normalizedCadence(conversation, lines) {
  const [left, right] = getCampConversationPlan(conversation.pairId).participants;
  return lines.map(({ speaker }) => {
    if (speaker === left) return 'L';
    if (speaker === right) return 'R';
    return '?';
  }).join('');
}

function speakerSwitches(signature) {
  return [...signature].slice(1).reduce((count, speaker, index) => (
    count + (speaker === signature[index] ? 0 : 1)
  ), 0);
}

function assertDeepFrozen(value, path = 'root', seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  for (const [key, nested] of Object.entries(value)) {
    assertDeepFrozen(nested, `${path}.${key}`, seen);
  }
}

test('middle pack covers exactly five canonical pairs with six talks apiece', () => {
  assert.deepEqual(CAMP_CONVERSATION_GROUPS.middle, [
    'lise-mateus',
    'ren-genta',
    'aya-genta',
    'lise-genta',
    'mateus-genta',
  ]);
  assert.equal(CAMP_CONVERSATIONS_MIDDLE.length, 30);
  assert.deepEqual(
    [...new Set(CAMP_CONVERSATIONS_MIDDLE.map(({ pairId }) => pairId))],
    CAMP_CONVERSATION_GROUPS.middle,
  );
  for (const pairId of CAMP_CONVERSATION_GROUPS.middle) {
    assert.equal(
      CAMP_CONVERSATIONS_MIDDLE.filter((conversation) => conversation.pairId === pairId).length,
      6,
      pairId,
    );
  }
});

test('middle records preserve canonical ids, sequence, unlock beats, and camps in plan order', () => {
  const expected = CAMP_CONVERSATION_GROUPS.middle.flatMap((pairId) => {
    const pairPlan = getCampConversationPlan(pairId);
    assert.ok(pairPlan, pairId);
    return pairPlan.conversations.map((planned) => ({
      id: planned.id,
      pairId,
      sequence: planned.sequence,
      unlockAfterBeatId: planned.unlockAfterBeatId,
      campId: planned.campId,
    }));
  });
  const actual = CAMP_CONVERSATIONS_MIDDLE.map((conversation) => ({
    id: conversation.id,
    pairId: conversation.pairId,
    sequence: conversation.sequence,
    unlockAfterBeatId: conversation.unlockAfterBeatId,
    campId: conversation.campId,
  }));
  assert.deepEqual(actual, expected);
});

test('every middle talk clears exact dialogue, participation, choice, response, and word targets', () => {
  for (const conversation of CAMP_CONVERSATIONS_MIDDLE) {
    const participants = getCampConversationPlan(conversation.pairId).participants;
    assert.equal(conversation.dialogue.length, 40, `${conversation.id} main lines`);
    for (const participant of participants) {
      assert.equal(
        conversation.dialogue.filter(({ speaker }) => speaker === participant).length,
        20,
        `${conversation.id} must give ${participant} twenty main lines`,
      );
    }

    assert.equal(conversation.choice.options.length, 2, conversation.id);
    conversation.choice.options.forEach((option, optionIndex) => {
      assert.equal(option.id, `${conversation.id}-choice-${optionIndex + 1}`);
      assert.equal(option.response.length, 3, option.id);
      assert.equal(option.consequence.flag, `camp.${conversation.id}.choice.${optionIndex + 1}`);
      assert.ok(option.response.every(({ speaker }) => participants.includes(speaker)), option.id);
      assert.equal(new Set(option.response.map(({ speaker }) => speaker)).size, 2, option.id);
    });

    const wordCount = authoredText(conversation).reduce((sum, value) => sum + words(value), 0);
    assert.ok(wordCount >= 450, `${conversation.id} has only ${wordCount} counted words`);
  }
});

test('contract validator accepts the complete middle pack and its deterministic volume', () => {
  const validation = validateCampConversationPack(CAMP_CONVERSATIONS_MIDDLE, {
    expectedPairIds: CAMP_CONVERSATION_GROUPS.middle,
  });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(validation.metrics, CAMP_CONVERSATIONS_MIDDLE_METRICS);
  assert.deepEqual(validation.metrics, {
    conversationCount: 30,
    pairCount: 5,
    mainLineCount: 1_200,
    responseLineCount: 180,
    choiceCount: 30,
    choiceOptionCount: 60,
    wordCount: 34_413,
  });
});

test('all thirty talks and choice exchanges have materially distinct cadence signatures', () => {
  const mainCadences = CAMP_CONVERSATIONS_MIDDLE.map((conversation) => (
    normalizedCadence(conversation, conversation.dialogue)
  ));
  const responseCadences = CAMP_CONVERSATIONS_MIDDLE.map((conversation) => (
    normalizedCadence(conversation, conversation.choice.options.flatMap(({ response }) => response))
  ));
  const topicBlocks = CAMP_CONVERSATIONS_MIDDLE.flatMap((conversation) => (
    [0, 10, 20, 30].map((offset) => normalizedCadence(
      conversation,
      conversation.dialogue.slice(offset, offset + 10),
    ))
  ));
  const topicFrequencies = [...new Set(topicBlocks)]
    .map((signature) => topicBlocks.filter((candidate) => candidate === signature).length);
  const switchCounts = new Set(mainCadences.map(speakerSwitches));

  assert.equal(new Set(mainCadences).size, 30, 'every main conversation needs its own cadence');
  assert.equal(new Set(responseCadences).size, 30, 'every paired choice response needs its own cadence');
  assert.equal(new Set(topicBlocks).size, 16, 'expected sixteen distinct scene-building families');
  assert.ok(Math.max(...topicFrequencies) <= 9, 'no topic family may dominate the middle pack');
  assert.ok(switchCounts.size >= 6, 'speaker-switch density should vary materially between scenes');
  for (const conversation of CAMP_CONVERSATIONS_MIDDLE) {
    const localBlocks = [0, 10, 20, 30].map((offset) => normalizedCadence(
      conversation,
      conversation.dialogue.slice(offset, offset + 10),
    ));
    assert.equal(new Set(localBlocks).size, 4, `${conversation.id} repeats a topic cadence family`);
  }
});

test('the recurring legacy renderer phrases are absent from materialized prose', () => {
  const corpus = CAMP_CONVERSATIONS_MIDDLE.flatMap(authoredText).join('\n');
  assert.doesNotMatch(corpus, /The point I cannot set aside in/);
  assert.doesNotMatch(corpus, /My answer on .+ begins with no defense/);
  assert.doesNotMatch(corpus, /The work I can offer for .+ is concrete/);
  assert.doesNotMatch(corpus, /That is the course I want remembered from/);
  assert.doesNotMatch(corpus, /therefore leaves the .+ test: its consequence must remain visible/);
  assert.doesNotMatch(corpus, /keep that point tied to/i);
});

test('titles, themes, prompts, dialogue, labels, summaries, and responses are exact-text unique', () => {
  const normalized = CAMP_CONVERSATIONS_MIDDLE
    .flatMap(authoredText)
    .map((value) => value.trim().toLocaleLowerCase('en-US'));
  assert.equal(new Set(normalized).size, normalized.length);
});

test('the five middle arcs keep their authored progression in canonical pair order', () => {
  const expectedTitles = {
    'lise-mateus': [
      'The Page and the Cipher',
      'Distance at the Salt Fire',
      'Two Inheritances Named',
      'An Oath Without a Specimen',
      'The Door Left Open',
      'Supervised Daylight',
    ],
    'ren-genta': [
      'Orders on the Dock',
      'Who Carries the Plan',
      'The Slow Prison Road',
      'Standing Where Asked',
      'No Clean Command',
      'Mile Markers',
    ],
    'aya-genta': [
      'Margin Beside the Order',
      'Care in the Record',
      'Chain of Signatures',
      'Names in the Current',
      'Custody Is a Verb',
      'Testimony With Corrections',
    ],
    'lise-genta': [
      'Weapon Lessons',
      'The Journal and the Uniform',
      'Breach Arithmetic',
      'A Stand-Down Without Fealty',
      'Six Inside the Gate',
      'Teaching the Refusal',
    ],
    'mateus-genta': [
      'Men Who Made Roads',
      'The Patient Before the Plan',
      'Cipher and Requisition',
      'No Rank in the Rescue',
      'Refusing the Easy Sentence',
      'Work Under Witness',
    ],
  };
  for (const [pairId, titles] of Object.entries(expectedTitles)) {
    assert.deepEqual(
      CAMP_CONVERSATIONS_MIDDLE
        .filter((conversation) => conversation.pairId === pairId)
        .map(({ title }) => title),
      titles,
    );
  }
});

test('middle pack and exported metrics are deeply immutable', () => {
  assertDeepFrozen(CAMP_CONVERSATIONS_MIDDLE);
  assertDeepFrozen(CAMP_CONVERSATIONS_MIDDLE_METRICS);
  assert.throws(() => { CAMP_CONVERSATIONS_MIDDLE.push({}); }, TypeError);
  assert.throws(() => { CAMP_CONVERSATIONS_MIDDLE[0].title = 'mutated'; }, TypeError);
  assert.throws(() => { CAMP_CONVERSATIONS_MIDDLE[0].dialogue[0].line = 'mutated'; }, TypeError);
  assert.throws(() => {
    CAMP_CONVERSATIONS_MIDDLE[0].choice.options[0].consequence.flag = 'mutated';
  }, TypeError);
});
