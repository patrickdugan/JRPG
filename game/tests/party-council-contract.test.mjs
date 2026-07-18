import assert from 'node:assert/strict';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import { CAMP_CATALOGUE } from '../loadout.mjs';
import {
  DEFAULT_PARTY_COUNCIL_SAVE_KEY,
  PARTY_COUNCIL_GROUP_NAMES,
  PARTY_COUNCIL_GROUPS,
  PARTY_COUNCIL_JOIN_BEAT_BY_MEMBER,
  PARTY_COUNCIL_PLAN,
  PARTY_COUNCIL_TARGETS,
  PARTY_COUNCIL_SAVE_SCHEMA_VERSION,
  getPartyCouncilGroupPlan,
  getPartyCouncilPlan,
  validatePartyCouncilPack,
} from '../party-council-contract.mjs';

const BEATS = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => ({
  id: beat.id,
  chapterId: chapter.id,
})));
const BEAT_ORDER = new Map(BEATS.map((beat, index) => [beat.id, index]));

function recursivelyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => recursivelyFrozen(child, seen));
}

function validCouncil(slot) {
  const dialogue = Array.from({ length: 30 }, (_, index) => ({
    speaker: slot.participants[index % slot.participants.length],
    line: `Council ${slot.sequence} main statement ${index + 1} identifies a distinct concern, tests available evidence, preserves community consent, and leaves a visible route for later correction by affected people.`,
  }));
  return {
    id: slot.id,
    sequence: slot.sequence,
    chapterId: slot.chapterId,
    unlockAfterBeatId: slot.unlockAfterBeatId,
    campId: slot.campId,
    participants: [...slot.participants],
    title: `Council Deliberation ${slot.sequence}`,
    theme: `Council ${slot.sequence} examines a distinct shared decision through evidence, consent, accountable conflict, and a correction path controlled by affected communities.`,
    dialogue,
    choice: {
      prompt: `Which bounded council approach should guide decision ${slot.sequence}?`,
      options: [0, 1].map((optionIndex) => ({
        id: `${slot.id}-choice-${optionIndex + 1}`,
        label: `Bounded approach ${slot.sequence}-${optionIndex + 1}`,
        response: Array.from({ length: 3 }, (_, responseIndex) => ({
          speaker: slot.participants[(optionIndex + responseIndex) % slot.participants.length],
          line: `Council ${slot.sequence} option ${optionIndex + 1} response ${responseIndex + 1} states a unique safeguard, assigns accountable follow-up, and preserves the right to revise or refuse this approach.`,
        })),
        consequence: {
          flag: `party-council.${slot.id}.choice.${optionIndex + 1}`,
          summary: `Council ${slot.sequence} records bounded approach ${optionIndex + 1} with an explicit safeguard and a public correction route.`,
        },
      })),
    },
  };
}

test('plan contains thirty non-repeatable councils in canonical story and 10/10/10 group order', () => {
  assert.equal(PARTY_COUNCIL_SAVE_SCHEMA_VERSION, 1);
  assert.equal(DEFAULT_PARTY_COUNCIL_SAVE_KEY, 'bells-black-chrysanthemum.party-councils.v1');
  assert.equal(PARTY_COUNCIL_PLAN.length, 30);
  assert.deepEqual(PARTY_COUNCIL_GROUP_NAMES, ['early', 'middle', 'late']);
  assert.deepEqual(Object.fromEntries(PARTY_COUNCIL_GROUP_NAMES.map((group) => [
    group,
    PARTY_COUNCIL_GROUPS[group].length,
  ])), { early: 10, middle: 10, late: 10 });
  assert.deepEqual(PARTY_COUNCIL_PLAN.map(({ sequence }) => sequence), Array.from({ length: 30 }, (_, index) => index + 1));
  assert.ok(PARTY_COUNCIL_PLAN.every(({ repeatable }) => repeatable === false));
  assert.equal(new Set(PARTY_COUNCIL_PLAN.map(({ id }) => id)).size, 30);
  let prior = -1;
  for (const slot of PARTY_COUNCIL_PLAN) {
    const order = BEAT_ORDER.get(slot.unlockAfterBeatId);
    assert.ok(order > prior, slot.id);
    prior = order;
    assert.equal(BEATS[order].chapterId, slot.chapterId);
    assert.ok(CAMP_CATALOGUE[slot.campId], slot.campId);
  }
  assert.equal(recursivelyFrozen(PARTY_COUNCIL_PLAN), true);
  assert.equal(recursivelyFrozen(PARTY_COUNCIL_GROUPS), true);
});

test('every planned cast has 3-6 unique members who have joined by its unlock beat', () => {
  for (const slot of PARTY_COUNCIL_PLAN) {
    assert.ok(slot.participants.length >= 3 && slot.participants.length <= 6, slot.id);
    assert.equal(new Set(slot.participants).size, slot.participants.length, slot.id);
    const unlockOrder = BEAT_ORDER.get(slot.unlockAfterBeatId);
    for (const participant of slot.participants) {
      assert.ok(PARTY_COUNCIL_JOIN_BEAT_BY_MEMBER[participant], participant);
      assert.ok(BEAT_ORDER.get(PARTY_COUNCIL_JOIN_BEAT_BY_MEMBER[participant]) <= unlockOrder, `${slot.id}/${participant}`);
    }
  }
  assert.equal(recursivelyFrozen(PARTY_COUNCIL_JOIN_BEAT_BY_MEMBER), true);
});

test('group and identity lookups are null-safe, exact, and immutable', () => {
  for (const group of PARTY_COUNCIL_GROUP_NAMES) {
    const slots = getPartyCouncilGroupPlan(group);
    assert.equal(slots.length, PARTY_COUNCIL_TARGETS.councilsPerGroup);
    assert.deepEqual(slots.map(({ id }) => id), PARTY_COUNCIL_GROUPS[group]);
    assert.equal(recursivelyFrozen(slots), true);
    for (const slot of slots) assert.equal(getPartyCouncilPlan(slot.id), slot);
  }
  assert.equal(getPartyCouncilGroupPlan('missing'), null);
  assert.equal(getPartyCouncilPlan('missing'), null);
});

test('strict partial and complete validators accept canonical high-volume packs', () => {
  for (const group of PARTY_COUNCIL_GROUP_NAMES) {
    const councils = getPartyCouncilGroupPlan(group).map(validCouncil);
    const result = validatePartyCouncilPack(councils, { expectedGroup: group });
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(result.metrics.councilCount, 10);
    assert.equal(result.metrics.mainLineCount, 300);
    assert.equal(result.metrics.responseLineCount, 60);
    assert.equal(result.metrics.choiceOptionCount, 20);
    assert.equal(result.metrics.byGroup[group], 10);
    assert.ok(result.metrics.wordCount >= 5_000);
    assert.equal(recursivelyFrozen(result), true);
  }

  const catalogue = PARTY_COUNCIL_PLAN.map(validCouncil);
  const full = validatePartyCouncilPack(catalogue, { strictCatalogue: true });
  assert.equal(full.ok, true, full.errors.join('\n'));
  assert.equal(full.metrics.councilCount, 30);
  assert.equal(full.metrics.mainLineCount, 900);
  assert.equal(full.metrics.responseLineCount, 180);
  assert.equal(full.metrics.choiceCount, 30);
  assert.equal(full.metrics.choiceOptionCount, 60);
  assert.deepEqual(full.metrics.byGroup, { early: 10, middle: 10, late: 10 });
  assert.ok(full.metrics.wordCount >= PARTY_COUNCIL_TARGETS.minimumCatalogueWords);
});

test('validator enforces exact participant use, choices, consequence flags, volume, and global uniqueness', () => {
  const councils = getPartyCouncilGroupPlan('early').map(validCouncil);
  const malformed = structuredClone(councils);
  malformed[0].reward = 10;
  malformed[0].minutes = 20;
  malformed[0].participants = ['ren', 'aya', 'kiku'];
  malformed[0].dialogue = malformed[0].dialogue.slice(0, 29);
  malformed[1].dialogue = malformed[1].dialogue.map((line) => ({ ...line, speaker: 'ren' }));
  malformed[2].dialogue[0].speaker = 'kiku';
  malformed[2].dialogue[1].line = 'too short';
  malformed[3].choice.options = malformed[3].choice.options.slice(0, 1);
  malformed[4].choice.options[0].id = 'wrong-choice';
  malformed[4].choice.options[0].consequence.flag = 'wrong.flag';
  malformed[5].choice.options[0].response = malformed[5].choice.options[0].response.slice(0, 2);
  malformed[6].dialogue[0].line = malformed[6].dialogue[1].line;
  malformed[7].theme = 'Adam Driver enters this placeholder council beside Tokugawa Ieyasu and borrowed Belmont lore.';
  malformed[8].dialogue[0].line = 'The council offers collectible sacred loot as a quest reward after ten minutes of discussion.';
  malformed[9].dialogue = malformed[9].dialogue.slice(0, 4);

  const result = validatePartyCouncilPack(malformed, { expectedGroup: 'early' });
  assert.equal(result.ok, false);
  const errors = result.errors.join(' ');
  assert.match(errors, /exactly the authored council keys/);
  assert.match(errors, /participants do not match/);
  assert.match(errors, /at least 30 main dialogue lines/);
  assert.match(errors, /underuses planned participant/);
  assert.match(errors, /speaker is outside/);
  assert.match(errors, /text is too short/);
  assert.match(errors, /exactly two options/);
  assert.match(errors, /id is not canonical/);
  assert.match(errors, /consequence flag is not canonical/);
  assert.match(errors, /at least three response lines/);
  assert.match(errors, /repeats exact authored text/);
  assert.match(errors, /borrowed, real-person, placeholder, duration, or prize/);
  assert.match(errors, /below 500 counted words/);
});

test('validator fails closed without one explicit partial group or full-catalogue mode', () => {
  const council = validCouncil(PARTY_COUNCIL_PLAN[0]);
  assert.match(validatePartyCouncilPack([council]).errors.join(' '), /must select expectedGroup/);
  assert.match(validatePartyCouncilPack([council], { expectedGroup: 'unknown' }).errors.join(' '), /must select expectedGroup/);
  assert.match(validatePartyCouncilPack([council], { strictCatalogue: true, expectedGroup: 'early' }).errors.join(' '), /cannot also select/);
  assert.match(validatePartyCouncilPack([council], { expectedGroup: 'early', extra: true }).errors.join(' '), /unsupported keys/);
  assert.match(validatePartyCouncilPack({}, { expectedGroup: 'early' }).errors.join(' '), /must be an array/);
});
