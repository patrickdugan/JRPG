import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPartyCouncilGroupPlan,
  validatePartyCouncilPack,
} from '../party-council-contract.mjs';
import {
  PARTY_COUNCILS_LATE,
  PARTY_COUNCILS_LATE_VALIDATION,
} from '../content/party-councils-late.mjs';

const words = (value) => value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;

function authoredText(council) {
  return [
    council.title,
    council.theme,
    council.choice.prompt,
    ...council.dialogue.map(({ line }) => line),
    ...council.choice.options.flatMap((option) => [
      option.label,
      option.consequence.summary,
      ...option.response.map(({ line }) => line),
    ]),
  ];
}

function assertDeepFrozen(value, path = 'root') {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  for (const [key, child] of Object.entries(value)) assertDeepFrozen(child, `${path}.${key}`);
}

function normalizedSpeakerPattern(council) {
  const participantIndex = new Map(council.participants.map((participant, index) => [participant, index]));
  return council.dialogue.map(({ speaker }) => participantIndex.get(speaker)).join('');
}

test('late pack binds exactly the ten canonical nonrepeatable council slots', () => {
  const plan = getPartyCouncilGroupPlan('late');
  assert.equal(plan.length, 10);
  assert.ok(plan.every(({ repeatable }) => repeatable === false));
  assert.equal(PARTY_COUNCILS_LATE.length, 10);
  assert.deepEqual(PARTY_COUNCILS_LATE.map((council) => ({
    id: council.id,
    sequence: council.sequence,
    chapterId: council.chapterId,
    unlockAfterBeatId: council.unlockAfterBeatId,
    campId: council.campId,
    participants: council.participants,
  })), plan.map((slot) => ({
    id: slot.id,
    sequence: slot.sequence,
    chapterId: slot.chapterId,
    unlockAfterBeatId: slot.unlockAfterBeatId,
    campId: slot.campId,
    participants: slot.participants,
  })));
  assert.ok(PARTY_COUNCILS_LATE.every((council) => !Object.hasOwn(council, 'repeatable')));
});

test('every late council meets cast, line, choice, response, flag, and word requirements', () => {
  for (const council of PARTY_COUNCILS_LATE) {
    assert.equal(council.dialogue.length, 36, `${council.id} main lines`);
    assert.ok(council.participants.length >= 3 && council.participants.length <= 6, council.id);
    for (const participant of council.participants) {
      const participantLines = council.dialogue.filter(({ speaker }) => speaker === participant);
      assert.equal(participantLines.length, 36 / council.participants.length, `${council.id}/${participant}`);
      assert.ok(participantLines.length >= 4, `${council.id}/${participant} minimum voice share`);
    }

    assert.equal(council.choice.options.length, 2, `${council.id} choice count`);
    council.choice.options.forEach((option, optionIndex) => {
      assert.equal(option.id, `${council.id}-choice-${optionIndex + 1}`);
      assert.equal(option.response.length, 3, `${option.id} response lines`);
      assert.ok(option.response.every(({ speaker }) => council.participants.includes(speaker)), option.id);
      assert.equal(option.consequence.flag, `party-council.${council.id}.choice.${optionIndex + 1}`);
      assert.ok(option.consequence.summary.length >= 20, option.id);
    });

    const councilWords = authoredText(council).reduce((total, text) => total + words(text), 0);
    assert.ok(councilWords >= 500, `${council.id} has only ${councilWords} counted words`);
  }
});

test('all ten councils use distinctive balanced multi-voice cadences', () => {
  const patterns = PARTY_COUNCILS_LATE.map(normalizedSpeakerPattern);
  assert.equal(new Set(patterns).size, 10);

  for (const council of PARTY_COUNCILS_LATE) {
    const castSize = council.participants.length;
    for (let start = 0; start < council.dialogue.length; start += castSize) {
      const cycle = council.dialogue.slice(start, start + castSize).map(({ speaker }) => speaker);
      assert.equal(new Set(cycle).size, castSize, `${council.id} voice cycle at ${start}`);
    }
  }
});

test('late council prose is globally exact-text distinctive', () => {
  const normalized = PARTY_COUNCILS_LATE
    .flatMap(authoredText)
    .map((text) => text.trim().toLowerCase());
  assert.equal(new Set(normalized).size, normalized.length);
});

test('strict late validation accepts the complete authored volume and metrics', () => {
  const validation = validatePartyCouncilPack(PARTY_COUNCILS_LATE, { expectedGroup: 'late' });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.deepEqual(PARTY_COUNCILS_LATE_VALIDATION, validation);
  assert.deepEqual(validation.metrics, {
    councilCount: 10,
    mainLineCount: 360,
    responseLineCount: 60,
    choiceCount: 10,
    choiceOptionCount: 20,
    wordCount: 13_540,
    byGroup: { early: 0, middle: 0, late: 10 },
  });
  assert.ok(validation.metrics.wordCount >= 5_000);
});

test('late councils and their validation receipt are deeply immutable', () => {
  assertDeepFrozen(PARTY_COUNCILS_LATE);
  assertDeepFrozen(PARTY_COUNCILS_LATE_VALIDATION);
});
