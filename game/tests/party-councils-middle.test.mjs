import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PARTY_COUNCIL_TARGETS,
  getPartyCouncilGroupPlan,
  validatePartyCouncilPack,
} from '../party-council-contract.mjs';
import {
  PARTY_COUNCILS_MIDDLE,
  PARTY_COUNCILS_MIDDLE_METRICS,
} from '../content/party-councils-middle.mjs';

const COUNCIL_KEYS = [
  'campId',
  'chapterId',
  'choice',
  'dialogue',
  'id',
  'participants',
  'sequence',
  'theme',
  'title',
  'unlockAfterBeatId',
];
const CHOICE_KEYS = ['options', 'prompt'];
const OPTION_KEYS = ['consequence', 'id', 'label', 'response'];
const CONSEQUENCE_KEYS = ['flag', 'summary'];
const LINE_KEYS = ['line', 'speaker'];

function words(value) {
  return typeof value === 'string'
    ? value.match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu)?.length ?? 0
    : 0;
}

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

function assertDeepFrozen(value, path = 'root', seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  for (const [key, nested] of Object.entries(value)) {
    assertDeepFrozen(nested, `${path}.${key}`, seen);
  }
}

test('middle pack fills exactly canonical council slots 11-20 in exact metadata and cast order', () => {
  const plan = getPartyCouncilGroupPlan('middle');
  assert.ok(plan);
  assert.equal(PARTY_COUNCILS_MIDDLE.length, 10);
  assert.deepEqual(PARTY_COUNCILS_MIDDLE.map(({ sequence }) => sequence),
    Array.from({ length: 10 }, (_, index) => index + 11));
  assert.deepEqual(PARTY_COUNCILS_MIDDLE.map((council) => ({
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
});

test('strict partial validator accepts the middle pack and its deterministic volume', () => {
  const validation = validatePartyCouncilPack(PARTY_COUNCILS_MIDDLE, { expectedGroup: 'middle' });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(validation.metrics, PARTY_COUNCILS_MIDDLE_METRICS);
  assert.deepEqual(validation.metrics, {
    councilCount: 10,
    mainLineCount: 310,
    responseLineCount: 60,
    choiceCount: 10,
    choiceOptionCount: 20,
    wordCount: 6_706,
    byGroup: { early: 0, middle: 10, late: 0 },
  });
});

test('every council is genuinely multi-voice and clears line, participation, branch, and word floors', () => {
  const plan = getPartyCouncilGroupPlan('middle');
  PARTY_COUNCILS_MIDDLE.forEach((council, councilIndex) => {
    const plannedParticipants = plan[councilIndex].participants;
    assert.ok(council.dialogue.length >= PARTY_COUNCIL_TARGETS.minimumMainLinesPerCouncil,
      `${council.id} main dialogue floor`);
    for (const participant of plannedParticipants) {
      const lineCount = council.dialogue.filter(({ speaker }) => speaker === participant).length;
      assert.ok(lineCount >= PARTY_COUNCIL_TARGETS.minimumMainLinesPerParticipant,
        `${council.id} underuses ${participant}: ${lineCount}`);
    }
    assert.ok(council.dialogue.every(({ speaker }) => plannedParticipants.includes(speaker)), council.id);

    assert.equal(council.choice.options.length, PARTY_COUNCIL_TARGETS.choiceOptionsPerCouncil, council.id);
    council.choice.options.forEach((option, optionIndex) => {
      assert.equal(option.id, `${council.id}-choice-${optionIndex + 1}`);
      assert.equal(option.consequence.flag, `party-council.${council.id}.choice.${optionIndex + 1}`);
      assert.ok(option.response.length >= PARTY_COUNCIL_TARGETS.minimumResponseLinesPerOption, option.id);
      assert.ok(option.response.every(({ speaker }) => plannedParticipants.includes(speaker)), option.id);
    });

    const wordCount = authoredText(council).reduce((sum, value) => sum + words(value), 0);
    assert.ok(wordCount >= PARTY_COUNCIL_TARGETS.minimumWordsPerCouncil,
      `${council.id} has only ${wordCount} counted words`);
  });
});

test('the ten scenes have distinct subjects, titles, and speaker cadences instead of one repeated scaffold', () => {
  assert.deepEqual(PARTY_COUNCILS_MIDDLE.map(({ title }) => title), [
    'The Cell Count Stays Above the Route',
    'Six Hands Around an Unfinished Case',
    'Three Women Refuse a Single City Queue',
    'After the Dais Lost Control',
    'Three Departures Without a Master Bundle',
    'The Prisoners Remain on the Map Edge',
    'A Name Is Not a Targeting Mark',
    'The Warning Belongs to Those Who Carry It',
    'Homecoming Lists Written by the Hosts',
    'No Person Becomes the Price at the Gate',
  ]);
  assert.deepEqual([...new Set(PARTY_COUNCILS_MIDDLE.map(({ dialogue }) => dialogue.length))].sort(), [30, 32]);
  const speakerCadences = PARTY_COUNCILS_MIDDLE.map(({ dialogue }) =>
    dialogue.map(({ speaker }) => speaker).join('|'));
  assert.equal(new Set(speakerCadences).size, PARTY_COUNCILS_MIDDLE.length);
});

test('all authored prose is globally exact-unique and keeps care, evidence, and affected people in view', () => {
  const normalized = PARTY_COUNCILS_MIDDLE
    .flatMap(authoredText)
    .map((value) => value.trim().toLocaleLowerCase('en-US'));
  assert.equal(new Set(normalized).size, normalized.length);

  for (const council of PARTY_COUNCILS_MIDDLE) {
    const text = authoredText(council).join(' ');
    assert.match(text, /evidence|account|record|testimony|ledger|report|map|slip|claim|observation|receipt|cipher|name/i,
      `${council.id} needs an explicit evidence limit`);
    assert.match(text, /care|medicine|shelter|rest|injur|patient|healer|carrier|consent|refus|authority|choice/i,
      `${council.id} needs an explicit care or consent conflict`);
    assert.match(text, /community|keeper|worker|survivor|prisoner|listener|person|people|village|family|network/i,
      `${council.id} needs affected-person or community agency`);
  }

  const tribunal = PARTY_COUNCILS_MIDDLE.find(({ id }) => id === 'council-14-c6-03-tribunal');
  const gate = PARTY_COUNCILS_MIDDLE.find(({ id }) => id === 'council-20-c8-03-black-gate-bargain');
  assert.match(authoredText(tribunal).join(' '), /without turning Mateus.s admission into absolution/i);
  assert.match(authoredText(gate).join(' '), /does not forgive what I did/i);
});

test('records expose only the exact finite narrative schema with no timing or prize fields', () => {
  for (const council of PARTY_COUNCILS_MIDDLE) {
    assert.deepEqual(Object.keys(council).sort(), COUNCIL_KEYS, council.id);
    assert.deepEqual(Object.keys(council.choice).sort(), CHOICE_KEYS, council.id);
    for (const line of council.dialogue) assert.deepEqual(Object.keys(line).sort(), LINE_KEYS, council.id);
    for (const option of council.choice.options) {
      assert.deepEqual(Object.keys(option).sort(), OPTION_KEYS, option.id);
      assert.deepEqual(Object.keys(option.consequence).sort(), CONSEQUENCE_KEYS, option.id);
      for (const line of option.response) assert.deepEqual(Object.keys(line).sort(), LINE_KEYS, option.id);
    }
    assert.equal('reward' in council, false);
    assert.equal('minutes' in council, false);
    assert.equal('repeatable' in council, false);
  }
});

test('middle council pack and metrics are recursively immutable', () => {
  assertDeepFrozen(PARTY_COUNCILS_MIDDLE);
  assertDeepFrozen(PARTY_COUNCILS_MIDDLE_METRICS);
  assert.throws(() => { PARTY_COUNCILS_MIDDLE.push({}); }, TypeError);
  assert.throws(() => { PARTY_COUNCILS_MIDDLE[0].title = 'mutated'; }, TypeError);
  assert.throws(() => { PARTY_COUNCILS_MIDDLE[0].dialogue[0].line = 'mutated'; }, TypeError);
  assert.throws(() => {
    PARTY_COUNCILS_MIDDLE[0].choice.options[0].consequence.flag = 'mutated';
  }, TypeError);
});
