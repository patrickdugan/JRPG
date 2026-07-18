import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PARTY_COUNCIL_TARGETS,
  getPartyCouncilGroupPlan,
  validatePartyCouncilPack,
} from '../party-council-contract.mjs';
import { PARTY_COUNCILS_EARLY } from '../content/party-councils-early.mjs';

const EXPECTED_TITLES = [
  'Questions Beyond the Cell Lever',
  'Three Errands Under One Lantern',
  'Salt Dust Across the Handwriting',
  'The Refusal After the Shout',
  'A Key Passed Hand to Hand',
  'The Shore Does Not Owe Passage',
  'Dry Stones Through the Tide Caves',
  'The Hold Speaks Before the Journal',
  'Six Bowls and an Open Place',
  'A Name Carried Out of Ash',
];

const COUNCIL_KEYS = [
  'campId', 'chapterId', 'choice', 'dialogue', 'id', 'participants',
  'sequence', 'theme', 'title', 'unlockAfterBeatId',
];

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

function recursivelyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value)
    && Object.values(value).every((child) => recursivelyFrozen(child, seen));
}

test('early pack validates and fills the exact canonical slots in order', () => {
  const plan = getPartyCouncilGroupPlan('early');
  const validation = validatePartyCouncilPack(PARTY_COUNCILS_EARLY, { expectedGroup: 'early' });

  assert.equal(PARTY_COUNCILS_EARLY.length, PARTY_COUNCIL_TARGETS.councilsPerGroup);
  assert.equal(validation.ok, true);
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.metrics.councilCount, 10);
  assert.equal(validation.metrics.byGroup.early, 10);
  assert.deepEqual(PARTY_COUNCILS_EARLY.map(({ title }) => title), EXPECTED_TITLES);
  assert.deepEqual(PARTY_COUNCILS_EARLY.map((council) => ({
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

test('every council is genuinely multi-voice and clears line and word floors', () => {
  const plan = getPartyCouncilGroupPlan('early');
  for (const [index, council] of PARTY_COUNCILS_EARLY.entries()) {
    assert.deepEqual(Object.keys(council).sort(), COUNCIL_KEYS, council.id);
    assert.ok(
      council.dialogue.length >= PARTY_COUNCIL_TARGETS.minimumMainLinesPerCouncil,
      council.id + ' main-line floor',
    );
    assert.ok(
      authoredText(council).reduce((sum, text) => sum + words(text), 0)
        >= PARTY_COUNCIL_TARGETS.minimumWordsPerCouncil,
      council.id + ' word floor',
    );
    assert.deepEqual([...new Set(council.dialogue.map(({ speaker }) => speaker))].sort(),
      [...plan[index].participants].sort(), council.id + ' speaker set');
    for (const participant of plan[index].participants) {
      assert.ok(
        council.dialogue.filter(({ speaker }) => speaker === participant).length
          >= PARTY_COUNCIL_TARGETS.minimumMainLinesPerParticipant,
        council.id + ' underuses ' + participant,
      );
    }
  }
});

test('every branch uses exact canonical identity, finite consequence flags, and responsive voices', () => {
  for (const council of PARTY_COUNCILS_EARLY) {
    assert.equal(council.choice.options.length, 2, council.id);
    council.choice.options.forEach((option, index) => {
      assert.deepEqual(Object.keys(option).sort(), ['consequence', 'id', 'label', 'response']);
      assert.deepEqual(Object.keys(option.consequence).sort(), ['flag', 'summary']);
      assert.equal(option.id, council.id + '-choice-' + (index + 1));
      assert.equal(option.consequence.flag, 'party-council.' + council.id + '.choice.' + (index + 1));
      assert.ok(option.response.length >= PARTY_COUNCIL_TARGETS.minimumResponseLinesPerOption);
      assert.ok(option.response.every(({ speaker }) => council.participants.includes(speaker)));
    });
  }
});

test('authored prose is globally exact-unique and council cadences are not one renderer template', () => {
  const text = PARTY_COUNCILS_EARLY.flatMap(authoredText)
    .map((entry) => entry.trim().toLowerCase());
  const cadence = PARTY_COUNCILS_EARLY.map((council) => (
    council.dialogue.map(({ speaker }) => speaker).join('>')
  ));
  const lineCounts = new Set(PARTY_COUNCILS_EARLY.map(({ dialogue }) => dialogue.length));
  const corpus = text.join(' ');

  assert.equal(new Set(text).size, text.length);
  assert.equal(new Set(cadence).size, PARTY_COUNCILS_EARLY.length);
  assert.ok(lineCounts.size >= 5, 'councils should vary their dramatic length and cadence');
  assert.doesNotMatch(corpus, /\brewards?\b|\bminutes?\b/i);
  assert.ok(PARTY_COUNCILS_EARLY.reduce(
    (sum, council) => sum + authoredText(council).reduce((subtotal, entry) => subtotal + words(entry), 0),
    0,
  ) >= PARTY_COUNCIL_TARGETS.minimumWordsPerCouncil * PARTY_COUNCILS_EARLY.length);
});

test('the named export and all authored descendants are immutable', () => {
  assert.equal(recursivelyFrozen(PARTY_COUNCILS_EARLY), true);
  assert.throws(() => { PARTY_COUNCILS_EARLY.push({}); }, TypeError);
  assert.throws(() => { PARTY_COUNCILS_EARLY[0].participants.push('genta'); }, TypeError);
  assert.throws(() => { PARTY_COUNCILS_EARLY[0].dialogue[0].line = 'changed'; }, TypeError);
  assert.throws(() => { PARTY_COUNCILS_EARLY[0].choice.options[0].consequence.flag = 'changed'; }, TypeError);
});

test('the shared validator rejects a broken early-pack clone', () => {
  const broken = structuredClone(PARTY_COUNCILS_EARLY);
  broken[0].participants.reverse();
  broken[1].dialogue = broken[1].dialogue.slice(0, 3);
  broken[2].choice.options[0].consequence.flag = 'party-council.invalid';
  broken[3].dialogue[0].line = broken[0].dialogue[0].line;

  const validation = validatePartyCouncilPack(broken, { expectedGroup: 'early' });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('participants')));
  assert.ok(validation.errors.some((error) => error.includes('30 main dialogue lines')));
  assert.ok(validation.errors.some((error) => error.includes('consequence flag')));
  assert.ok(validation.errors.some((error) => error.includes('repeats exact authored text')));
});
